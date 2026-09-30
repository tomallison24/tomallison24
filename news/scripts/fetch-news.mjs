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

// A paper's DOI, lower-cased: Nature and Science put it in <prism:doi> or
// <dc:identifier>doi:…</dc:identifier>, Cell Press in <dc:identifier>,
// Europe PMC in its doi.org links. The same paper from two feeds then counts
// once (see dedupe below).
function doiOf(...texts) {
  for (const t of texts) {
    const m = String(t || '').match(/\b(10\.\d{4,9}\/[^\s"<>?#]+)/);
    if (m) return m[1].replace(/[.,;]+$/, '').toLowerCase();
  }
  return null;
}

function parse(xml, feed) {
  // RSS 2.0 <item>s, or Atom <entry>s (The Conversation).
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  // "max": a broad journal feed (Nature, Cell) whose stories are filtered
  // down to one topic can read more than PER_FEED items.
  return items.slice(0, feed.max || PER_FEED).map(item => {
    const url = itemLink(item);
    const title = text(item, 'title');
    if (!title || !/^https?:\/\//i.test(url)) return null;
    const date = new Date(text(item, 'pubDate') || text(item, 'dc:date') || text(item, 'prism:publicationDate') || text(item, 'published') || text(item, 'updated'));
    const link = canonical(url);
    const tags = feed.tags ? categories(item) : [];
    const doi = doiOf(text(item, 'prism:doi'), text(item, 'dc:identifier'), link);
    // Nature's journal feeds only have <content:encoded>, which opens with
    // "Nature, Published online: 29 September 2026; doi:…"; Science's
    // description is just "Science, Volume 393, Issue 6818…". Neither is a summary.
    const summary = (text(item, 'description') || text(item, 'summary') || text(item, 'content') || text(item, 'content:encoded'))
      .replace(/^[^;]{0,120}, Published online: [^;]*; doi:\S+\s*/i, '')
      .replace(/^Science, (Volume \d+, Issue \d+, Page [\d-]+, \w+ \d{4}|Ahead of Print)\.\s*$/i, '');
    return {
      id: createHash('sha1').update(link).digest('hex').slice(0, 12),
      topic: feed.topic,
      source: feed.source,
      title,
      summary: clip(summary.replace(/\s*Continue reading(\.\.\.|\u2026)\s*$/i, ''), 220),
      url: link,
      image: image(item),
      published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      ...(doi ? { doi } : {}),
      ...(tags.length ? { tags } : {}),
    };
  }).filter(Boolean);
}

// Europe PMC search results (JSON): peer-reviewed papers (SRC:MED, with
// OPEN_ACCESS:y so every link is free to read) or preprints (SRC:PPR, which
// covers bioRxiv and medRxiv).
async function europePmc(feed) {
  const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?' + new URLSearchParams({
    query: feed.query, sort: 'P_PDATE_D desc', format: 'json', pageSize: String(PER_FEED), resultType: 'core',
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'news-home-screen-app/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = (await res.json())?.resultList?.result || [];
  return list.map(r => {
    const link = r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`;
    const date = new Date(r.firstPublicationDate || r.firstIndexDate || '');
    const title = decode(String(r.title || '').replace(/<[^>]*>/g, '')).replace(/\.$/, '').trim();
    return title && {
      id: createHash('sha1').update(link).digest('hex').slice(0, 12),
      topic: feed.topic,
      source: r.source === 'PPR'
        ? `${r.bookOrReportDetails?.publisher || feed.source} (preprint)`
        : r.journalInfo?.journal?.title || feed.source,
      title,
      summary: clip(decode(String(r.abstractText || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(), 220),
      url: link,
      image: null,
      published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      ...(r.doi ? { doi: String(r.doi).toLowerCase() } : {}),
    };
  }).filter(Boolean);
}

// A feed's "rank" (0 when absent) says which copy of a duplicate to keep:
// lower wins. The journal's own feed is 0; indexes that link to the same
// paper (Nature's subject feeds, Europe PMC) are 1; STEMCELL Science News,
// whose items are summaries that link on to the paper, is 2; preprints are 3.
const ranked = (feed, stories) => feed.rank ? stories.map(s => ({ ...s, rank: feed.rank })) : stories;

async function fetchFeed(feed) {
  const started = Date.now();
  try {
    if (feed.type === 'europepmc') {
      const stories = await europePmc(feed);
      if (!stories.length) throw new Error('no items found');
      return { ...feed, url: 'https://europepmc.org', ok: true, count: stories.length, ms: Date.now() - started, stories: ranked(feed, stories) };
    }
    // nature.com now and then sends a request through its sign-in service
    // (idp.nature.com) and answers with a web page instead of the feed; the
    // same request a moment later gets the feed. So a feed that turns into
    // a page on another site is tried once more.
    let stories = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'news-home-screen-app/1.0 (personal RSS reader)', Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      stories = parse(await res.text(), feed);
      if (stories.length || new URL(res.url).host === new URL(feed.url).host) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!stories.length) throw new Error('no items found');
    return { ...feed, ok: true, count: stories.length, ms: Date.now() - started, stories: ranked(feed, stories) };
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
// With "matchSummary" the summary counts too, not just the headline.
function termMatcher(terms, withSummary) {
  const res = terms.map(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, /^[A-Z0-9]+$/.test(t) ? '' : 'i'));
  return s => res.some(re => re.test(withSummary ? `${s.title}\n${s.summary}` : s.title));
}

// A topic with "filter" terms keeps only its own feeds' stories that use one
// of them (Stem cells: only pluripotent stem cell stories). A feed marked
// "trusted" is about the topic already (Cell Stem Cell, Nature's stem cell
// subject feeds), so all its stories stay. "skipTitles" drops notices whose
// headline starts with one of them ("Author Correction: …"), trusted or not.
let all = results.flatMap(r => r.stories);
const trusted = new Set(results.filter(r => r.trusted).flatMap(r => r.stories));
for (const { id, filter, matchSummary, skipTitles } of config.topics) {
  if (!filter && !skipTitles) continue;
  const ok = filter ? termMatcher(filter, matchSummary) : () => true;
  const skip = skipTitles ? new RegExp(`^(${skipTitles.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i') : null;
  const before = all.filter(s => s.topic === id).length;
  all = all.filter(s => s.topic !== id || ((trusted.has(s) || ok(s)) && !skip?.test(s.title)));
  console.log(`${id}: ${all.filter(s => s.topic === id).length} of ${before} stories pass the filter`);
}

const collected = {};
const moved = new Map();   // topic -> URLs that now live elsewhere
for (const { id, collect, moveFrom = [], matchSummary } of config.topics) {
  if (!collect) continue;
  const matches = termMatcher(collect, matchSummary);
  collected[id] = all.filter(s => s.topic !== id && matches(s)).map(({ tags: _, ...s }) => ({ ...s, topic: id }));
  for (const s of all) {
    if (moveFrom.includes(s.topic) && matches(s)) {
      if (!moved.has(s.topic)) moved.set(s.topic, new Set());
      moved.get(s.topic).add(s.url);
    }
  }
  console.log(`${id}: ${collected[id].length} stories collected from other topics`);
}
for (const [topic, urls] of moved) console.log(`${topic}: ${urls.size} stories moved to their own topic`);

// Topics with "keepDays" hold on to stories from the last run's news.json
// for that many days, so a quiet topic doesn't empty out when its feeds move
// on. The last run's copy is kept in .cache-news/ (the workflow restores it
// from the Actions cache); failing that, the published copy ("previous" in
// feeds.json), which only works while the site is public.
const CACHE_COPY = join(ROOT, '..', '.cache-news', 'news.json');
const carried = {};
if (config.topics.some(t => t.keepDays)) {
  try {
    let prev = null;
    try {
      prev = JSON.parse(await readFile(CACHE_COPY, 'utf8'));
      console.log('Previous news.json: from the Actions cache');
    } catch {
      if (!config.previous) throw new Error('no cached copy');
      const res = await fetch(config.previous, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      prev = res.ok ? await res.json() : null;
      console.log(`Previous news.json: from ${config.previous} (${res.status})`);
    }
    for (const { id, keepDays } of config.topics) {
      if (!keepDays || !prev?.stories) continue;
      const since = new Date(Date.now() - keepDays * 864e5).toISOString();
      carried[id] = prev.stories.filter(s => s.topic === id && (s.published || '') >= since);
      console.log(`${id}: ${carried[id].length} stories carried over from the last update`);
    }
  } catch (err) {
    console.log(`Previous news.json unavailable (${err.message}); starting fresh`);
  }
}

// One story per article or paper within a topic, however many feeds carry
// it: the same link (BBC's UK and World feeds), the same DOI (a Cell Stem
// Cell paper from its journal feed and from Europe PMC), or the same
// headline once case, punctuation and accents are ignored. Headlines of
// fewer than 4 words (not counting "the", "of" and so on) only match by
// link: BBC names every episode of a programme "Tech Life". Topics with
// "fuzzyDedupe" also treat near-identical headlines as one (a preprint and
// its published version often differ by a word or two): at least 75% of
// all their words shared. Only headlines of 6 or more words (not counting
// "the", "of" and so on) are compared. Kept strict on purpose: "X reaches
// Y" and "X fails to reach Y without Z" share most words but are different
// papers, and hiding a real paper is worse than showing one twice.
// The copy kept is the one with the lowest rank (the publisher's own, see
// fetchFeed), then the newest; it takes over the other copy's picture,
// summary or DOI when it has none.
const doiIn = s => s.doi || doiOf(s.url);
const titleKey = s => s.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set('a an and are as at by for from in into is its of on or than that the their this to via with'.split(' '));
const words = s => new Set(titleKey(s).split(' ').filter(w => w.length > 1 && !STOP.has(w)));
// Stories saved before ranks existed: Europe PMC links go to doi.org or europepmc.org.
const rankOf = s => s.rank ?? (/ \(preprint\)$/.test(s.source) ? 3 : /^https:\/\/(doi\.org|europepmc\.org)\//.test(s.url) ? 1 : 0);
function similar(a, b) {
  if (a.size < 6 || b.size < 6) return false;
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  return both / (a.size + b.size - both) >= 0.75;
}
function dedupe(id, list, fuzzy) {
  const kept = [];
  const byKey = new Map();
  const dropped = { link: 0, doi: 0, headline: 0, similar: 0 };
  const shown = [];   // a few merges by headline, for the job log
  // Best copy first.
  for (const s of [...list].sort((a, b) => rankOf(a) - rankOf(b) || byTime(a, b))) {
    const doi = doiIn(s);
    const w = words(s);
    const keys = [['link', s.url], ['doi', doi && `doi:${doi}`], ['headline', w.size >= 4 && `t:${titleKey(s)}`]].filter(([, k]) => k);
    let [why, twin] = keys.map(([w, k]) => [w, byKey.get(k)]).find(([, t]) => t) || [];
    if (!twin && fuzzy) [why, twin] = ['similar', kept.find(k => similar(w, k.words))];
    if (twin) {
      dropped[why]++;
      const k = twin.story;
      if ((why === 'headline' || why === 'similar') && shown.length < 8) shown.push(`  ${why === 'similar' ? '≈' : '='} ${k.source}: ${k.title.slice(0, 70)} | ${s.source}: ${s.title.slice(0, 70)}`);
      if (!k.image && s.image) k.image = s.image;
      if (!k.summary && s.summary) k.summary = s.summary;
      if (!k.doi && doi) k.doi = doi;
      for (const [, key] of keys) if (!byKey.has(key)) byKey.set(key, twin);
      continue;
    }
    const entry = { story: { ...s }, words: w };
    kept.push(entry);
    for (const [, key] of keys) byKey.set(key, entry);
  }
  const n = Object.values(dropped).reduce((a, b) => a + b, 0);
  const label = { link: 'same link', doi: 'same DOI', headline: 'same headline', similar: 'near-identical headline' };
  if (n) console.log(`${id}: ${n} duplicates removed (${Object.entries(dropped).filter(([, v]) => v).map(([k, v]) => `${v} ${label[k]}`).join(', ')})\n${shown.join('\n')}`.trimEnd());
  return kept.map(k => k.story);
}

for (const { id, keep, fuzzyDedupe } of config.topics) {
  const gone = moved.get(id) || new Set();
  stories.push(...dedupe(id, [...all.filter(s => s.topic === id && !gone.has(s.url)), ...(collected[id] || []), ...(carried[id] || [])], fuzzyDedupe)
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
  feeds: results.map(({ stories: _, tags: __, trusted: ___, max: ____, rank: _____, ...r }) => r),
  stories,
}));
console.log(`Wrote ${stories.length} stories (${results.length - failed}/${results.length} feeds ok) to ${OUT}`);
// Keep this run's copy for the next run's carry-over.
await mkdir(dirname(CACHE_COPY), { recursive: true });
await writeFile(CACHE_COPY, await readFile(OUT));

// Scores fallback copy (see fetch-scores.mjs). Run from here so the workflow
// file, whose last editor owns the refresh schedule, doesn't need changing.
try {
  const { saveScores } = await import('./fetch-scores.mjs');
  await saveScores();
} catch (err) {
  console.log(`Scores copy skipped: ${err.message}`);
}
