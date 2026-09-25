// Fetches every RSS feed in ../feeds.json and writes ../data/news.json, the
// only file the app reads. Runs in GitHub Actions on a schedule (see
// .github/workflows/news.yml) and locally with `node news/scripts/fetch-news.mjs`.
//
// Why a build step at all: news sites don't send CORS headers, so an iPhone
// browser can't read their feeds directly. Fetching here and publishing the
// result next to the app keeps everything same-origin, key-free and fast.
//
// No dependencies: Node 20+ has fetch, and RSS 2.0 is regular enough for a
// small tag reader.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'news.json');
const PER_FEED = 25;      // items kept from each feed
const PER_TOPIC = 50;     // stories kept per topic after merging sources (a topic's "keep" overrides)
const TIMEOUT_MS = 15000;

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€',
};

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function unCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

// Text of the first <name>…</name> in xml, with CDATA, entities and any
// embedded HTML removed.
function text(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  const html = decode(unCdata(m[1]));
  return decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Inner markup of the first <name>…</name>, CDATA and entities undone.
function raw(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(unCdata(m[1])) : '';
}

function attrs(tag) {
  const out = {};
  for (const [, k, dq, sq] of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[k.toLowerCase()] = decode(dq ?? sq);
  return out;
}

// Largest image the item offers: media:content (The Guardian),
// media:thumbnail (BBC) or an image enclosure; failing those, the first
// real picture in the story's HTML (NPR).
function image(xml) {
  let best = null;
  for (const [tag] of xml.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi)) {
    const a = attrs(tag);
    if (!a.url || !/^https:\/\//i.test(a.url)) continue;
    if (tag.toLowerCase().startsWith('<enclosure') && !/^image\//i.test(a.type || '')) continue;
    if (a.medium && a.medium !== 'image') continue;
    const w = parseInt(a.width, 10) || 0;
    if (!best || w > best.w) best = { url: a.url, w };
  }
  if (best) return best.url;
  for (const name of ['content:encoded', 'content', 'description', 'summary']) {
    for (const [tag] of raw(xml, name).matchAll(/<img\b[^>]*>/gi)) {
      const a = attrs(tag);
      if (!a.src || !/^https:\/\//i.test(a.src)) continue;
      if (a.width === '1' || a.height === '1' || /pixel|tracking|feeds\.feedburner/i.test(a.src)) continue;
      return a.src;
    }
  }
  return null;
}

// Subject tags the publisher attached: RSS <category>Arsenal</category>,
// Atom <category term="Arsenal"/>. The Guardian tags every sport story with
// its sport, competition and teams, which the Sport filters match on.
function categories(xml) {
  const out = new Set();
  for (const [, inner] of xml.matchAll(/<category(?:\s[^>]*)?(?<!\/)>([\s\S]*?)<\/category>/gi)) {
    const t = decode(unCdata(inner)).replace(/<[^>]*>/g, '').trim();
    if (t && t.length < 60) out.add(t);
  }
  for (const [tag] of xml.matchAll(/<category\b[^>]*\/>/gi)) {
    const a = attrs(tag);
    if (a.term && a.term.length < 60) out.add(a.term);
  }
  return [...out].slice(0, 15);
}

// RSS: <link>url</link>. Atom: <link rel="alternate" href="url"/>.
function itemLink(xml) {
  const rss = text(xml, 'link');
  if (rss) return rss;
  for (const [tag] of xml.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(tag);
    if (a.href && (!a.rel || a.rel === 'alternate')) return a.href;
  }
  return text(xml, 'guid');
}

function clip(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,;:.–—-]+$/, '') + '…';
}

// Same story, same key: drops tracking params so a link shared across a
// source's feeds (e.g. BBC's UK and World) is only shown once per topic.
function canonical(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(at_|utm_|ocid|cmp)/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return url; }
}

function parse(xml, feed) {
  // RSS 2.0 <item>s, or Atom <entry>s (The Conversation).
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return items.slice(0, PER_FEED).map(item => {
    const url = itemLink(item);
    const title = text(item, 'title');
    if (!title || !/^https?:\/\//i.test(url)) return null;
    const date = new Date(text(item, 'pubDate') || text(item, 'dc:date') || text(item, 'published') || text(item, 'updated'));
    const link = canonical(url);
    const tags = feed.tags ? categories(item) : [];
    return {
      id: createHash('sha1').update(link).digest('hex').slice(0, 12),
      topic: feed.topic,
      source: feed.source,
      title,
      summary: clip((text(item, 'description') || text(item, 'summary') || text(item, 'content')).replace(/\s*Continue reading(\.\.\.|\u2026)\s*$/i, ''), 220),
      url: link,
      image: image(item),
      published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      ...(tags.length ? { tags } : {}),
    };
  }).filter(Boolean);
}

async function fetchFeed(feed) {
  const started = Date.now();
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'news-home-screen-app/1.0 (personal RSS reader)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stories = parse(await res.text(), feed);
    if (!stories.length) throw new Error('no items found');
    return { ...feed, ok: true, count: stories.length, ms: Date.now() - started, stories };
  } catch (err) {
    return { ...feed, ok: false, count: 0, ms: Date.now() - started, error: String(err.message || err), stories: [] };
  }
}

const config = JSON.parse(await readFile(join(ROOT, 'feeds.json'), 'utf8'));
// A topic can ask for its feeds' tags ("tags": true) and keep more stories ("keep").
const topicOf = Object.fromEntries(config.topics.map(t => [t.id, t]));
const results = await Promise.all(config.feeds.map(f => fetchFeed({ ...f, tags: !!topicOf[f.topic]?.tags })));

for (const r of results) {
  const pics = r.stories.filter(s => s.image).length;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.topic.padEnd(9)} ${r.source.padEnd(16)} ${String(r.count).padStart(3)} items ${String(pics).padStart(3)} images ${String(r.ms).padStart(5)}ms ${r.error || ''} ${r.url}`);
}

const byTime = (a, b) => (b.published || '').localeCompare(a.published || '');
const stories = [];
// A topic with "collect" terms also picks up any other topic's story whose
// headline uses one of them (AI gets the BBC's tech stories about AI).
// Topics listed in its "moveFrom" lose those stories, so AI news shows under
// AI and not under Tech as well.
// All-capitals terms such as "AI" must match exactly; others ignore case.
function headlineMatcher(terms) {
  const res = terms.map(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, /^[A-Z0-9]+$/.test(t) ? '' : 'i'));
  return title => res.some(re => re.test(title));
}

const all = results.flatMap(r => r.stories);
const collected = {};
const moved = new Map();   // topic -> URLs that now live elsewhere
for (const { id, collect, moveFrom = [] } of config.topics) {
  if (!collect) continue;
  const matches = headlineMatcher(collect);
  collected[id] = all.filter(s => s.topic !== id && matches(s.title)).map(({ tags: _, ...s }) => ({ ...s, topic: id }));
  for (const s of all) {
    if (moveFrom.includes(s.topic) && matches(s.title)) {
      if (!moved.has(s.topic)) moved.set(s.topic, new Set());
      moved.get(s.topic).add(s.url);
    }
  }
  console.log(`${id}: ${collected[id].length} stories collected from other topics`);
}
for (const [topic, urls] of moved) console.log(`${topic}: ${urls.size} stories moved to their own topic`);

for (const { id, keep } of config.topics) {
  const seen = new Set();
  const gone = moved.get(id) || new Set();
  stories.push(...[...all.filter(s => s.topic === id && !gone.has(s.url)), ...(collected[id] || [])]
    .filter(s => !seen.has(s.url) && seen.add(s.url))
    .sort(byTime)
    .slice(0, keep || PER_TOPIC));
}

const failed = results.filter(r => !r.ok).length;
if (failed === results.length) {
  // Nothing fetched: fail the run so the previous deploy stays live.
  console.error('Every feed failed; not writing news.json.');
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  topics: config.topics,
  feeds: results.map(({ stories: _, tags: __, ...r }) => r),
  stories,
}));
console.log(`Wrote ${stories.length} stories (${results.length - failed}/${results.length} feeds ok) to ${OUT}`);
