// Cloudflare Pages Function for the Podcasts app (podcasts/). Podcast feeds and
// Apple's directory don't let a page on another site read them (CORS), so the
// app asks this, on its own site, to fetch them instead:
//
//   /podcasts/api/feed?url=<RSS feed>     the feed, as text
//   /podcasts/api/search?term=<words>     Apple Podcasts search (shows)
//   /podcasts/api/top?cc=us               Apple's top shows for a country
//
// It runs only where the site is on Cloudflare Pages (behind Cloudflare
// Access, like the rest of it). Wrangler picks up this functions/ folder when
// .github/workflows/news.yml deploys from the repository root. On GitHub Pages
// it is just a file; the app then reads feeds directly where the feed allows.
//
// It only fetches, never stores. To keep it from being used for anything else:
// - requests must carry the X-Podcasts header, which a link or a form can't
//   add, so nothing can be opened here by visiting an address;
// - replies are plain text or JSON with nosniff and a sandbox CSP, so nothing
//   fetched can ever run as a page on this site;
// - only http(s) addresses on ordinary host names and ports, checked again at
//   every redirect, and feeds only (checked for <rss> or <feed>), up to 25 MB.

const UA = 'AllisonOS-Podcasts/1.0 (personal podcast app)';
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const COUNTRIES = new Set(['gb', 'us', 'ie', 'ca', 'au', 'nz']);

export async function onRequestGet({ request, params }) {
  if (request.headers.get('X-Podcasts') !== '1') return reply('Not found', 404);
  const route = [].concat(params.route || []).join('/');
  const q = new URL(request.url).searchParams;
  try {
    if (route === 'feed') return await feed(q.get('url'));
    if (route === 'search') return await search(q.get('term'), q.get('cc'));
    if (route === 'top') return await top(q.get('cc'));
  } catch (e) {
    return reply(JSON.stringify({ error: String(e && e.message || e).slice(0, 200) }), 502, 'application/json');
  }
  return reply('Not found', 404);
}

function reply(body, status = 200, type = 'text/plain; charset=utf-8', maxAge = 0) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': maxAge ? `private, max-age=${maxAge}` : 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
const json = (v, maxAge) => reply(JSON.stringify(v), 200, 'application/json; charset=utf-8', maxAge);

// An ordinary public address: http(s), a host name (not an IP or a local
// name), and the usual ports.
function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h.startsWith('[') || /^[\d.]+$/.test(h)) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa)$/.test(h)) return null;
  return u;
}

// fetch, following up to 5 redirects by hand so each hop is checked. The
// timeout covers reading the body too, so it is left running.
async function get(raw, accept) {
  let u = safeUrl(raw);
  if (!u) throw new Error('That address can’t be fetched');
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), TIMEOUT_MS);
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(u.href, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: accept } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('Location')) {
      u = safeUrl(new URL(res.headers.get('Location'), u).href);
      if (!u) throw new Error('Redirected somewhere that can’t be fetched');
      continue;
    }
    if (!res.ok) throw new Error('The server answered ' + res.status);
    return { res, url: u.href };
  }
  throw new Error('Too many redirects');
}

async function readText(res) {
  const len = Number(res.headers.get('Content-Length') || 0);
  if (len > MAX_BYTES) throw new Error('Feed too large');
  const reader = res.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { reader.cancel(); throw new Error('Feed too large'); }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder('utf-8').decode(all);
}

async function feed(raw) {
  const { res, url } = await get(raw, 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5');
  const text = await readText(res);
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 65536))) throw new Error('That address isn’t a podcast feed');
  const r = reply(text, 200, 'text/plain; charset=utf-8', 300);
  r.headers.set('X-Feed-Url', url);
  return r;
}

const cc = raw => COUNTRIES.has(String(raw || '').toLowerCase()) ? String(raw).toLowerCase() : 'us';

async function itunes(path) {
  const { res } = await get('https://itunes.apple.com/' + path, 'application/json');
  return JSON.parse(await readText(res));
}

const show = r => ({
  id: String(r.collectionId || r.trackId || ''),
  title: r.collectionName || r.trackName || '',
  author: r.artistName || '',
  feed: r.feedUrl || '',
  art: r.artworkUrl600 || r.artworkUrl100 || '',
  genre: r.primaryGenreName || '',
  count: r.trackCount || 0,
});

async function search(term, country) {
  term = String(term || '').trim().slice(0, 100);
  if (!term) return json({ results: [] });
  const data = await itunes(`search?media=podcast&entity=podcast&limit=30&country=${cc(country)}&term=${encodeURIComponent(term)}`);
  return json({ results: (data.results || []).map(show).filter(s => s.title) }, 600);
}

// Apple's chart gives ids, names and artwork but no feeds; one lookup call
// adds the feeds. The newer chart first, then the older one.
async function top(country) {
  const c = cc(country);
  let ids = [];
  try {
    const { res } = await get(`https://rss.applemarketingtools.com/api/v2/${c}/podcasts/top/50/podcasts.json`, 'application/json');
    const data = JSON.parse(await readText(res));
    ids = ((data.feed && data.feed.results) || []).map(r => String(r.id));
  } catch {}
  if (!ids.length) {
    const data = await itunes(`${c}/rss/toppodcasts/limit=50/json`);
    ids = ((data.feed && data.feed.entry) || []).map(e => e.id && e.id.attributes && e.id.attributes['im:id']).filter(Boolean);
  }
  if (!ids.length) return json({ results: [] });
  const data = await itunes(`lookup?entity=podcast&country=${c}&id=${ids.slice(0, 50).join(',')}`);
  const byId = new Map((data.results || []).map(r => [String(r.collectionId), show(r)]));
  return json({ results: ids.map(id => byId.get(id)).filter(s => s && s.feed) }, 21600);
}
