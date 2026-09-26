// Saves a copy of every scoreboard in ../leagues.json to ../data/scores.json.
// The app reads scores live from ESPN while the Scores view is open; this
// copy is the fallback for when it can't (offline, or ESPN refuses the
// browser). It also carries each league's next fixtures, which the app always
// reads from here: finding them takes a request per day ahead, too many to
// make from a phone. (ESPN answers a date range with HTTP 400, so each day is
// asked for on its own, stopping once enough fixtures are found.) ESPN's scoreboard feed is public but undocumented, so it may
// change without notice. Never fails the build: a missing copy only means
// no fallback.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'scores.json');
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const AHEAD_DAYS = 14;     // how far ahead to look for fixtures
const KEEP_UPCOMING = 10;  // fixtures kept per league
const HEADERS = { Origin: 'https://tomallison24.github.io', 'User-Agent': 'news-home-screen-app/1.0' };

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');

async function espn(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// Games that haven't started yet, soonest first.
async function upcoming(league, now) {
  const found = new Map();
  for (let day = 0; day <= AHEAD_DAYS && found.size < KEEP_UPCOMING; day++) {
    const res = await espn(`${ESPN}/${league.path}/scoreboard?dates=${ymd(new Date(now.getTime() + day * 864e5))}`);
    for (const g of normalize(await res.json(), league))
      if (g.state === 'pre' && Date.parse(g.start) > now.getTime()) found.set(g.id, g);
  }
  return [...found.values()]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, KEEP_UPCOMING)
    .map(({ home, away, ...g }) => ({ ...g, home: { name: home.name, short: home.short, logo: home.logo }, away: { name: away.name, short: away.short, logo: away.logo } }));
}

// Keep in step with normalize() in index.html.
export function normalize(json, league) {
  return (json?.events || []).map(ev => {
    const comp = (ev.competitions || [])[0] || {};
    const sides = comp.competitors || [];
    const side = where => {
      const c = sides.find(x => x.homeAway === where) || {};
      const t = c.team || {};
      return {
        name: t.displayName || t.name || '',
        short: t.shortDisplayName || t.abbreviation || t.displayName || '',
        logo: t.logo || t.logos?.[0]?.href || null,
        score: c.score == null ? null : String(typeof c.score === 'object' ? c.score.displayValue ?? '' : c.score),
        winner: !!c.winner,
      };
    };
    const type = (ev.status || comp.status || {}).type || {};
    const link = (ev.links || []).find(l => (l.rel || []).includes('summary')) || (ev.links || [])[0];
    return {
      id: String(ev.id),
      league: league.id,
      state: type.state || 'pre',
      detail: type.shortDetail || type.detail || '',
      start: ev.date || comp.date || null,
      home: side('home'),
      away: side('away'),
      link: link?.href || null,
    };
  });
}

export async function saveScores() {
  const { leagues } = JSON.parse(await readFile(join(ROOT, 'leagues.json'), 'utf8'));
  let cors = null;
  const now = new Date();
  const out = await Promise.all(leagues.map(async league => {
    const entry = { id: league.id, ok: false, games: [], upcoming: [] };
    try {
      const res = await espn(`${ESPN}/${league.path}/scoreboard`);
      if (cors === null) cors = res.headers.get('access-control-allow-origin');
      const json = await res.json();
      entry.games = normalize(json, league);
      entry.ok = true;
      const name = json?.leagues?.[0]?.name || '?';
      console.log(`ok   scores ${league.id.padEnd(17)} ${String(entry.games.length).padStart(3)} games, ${entry.games.filter(g => g.state === 'in').length} live  (ESPN: ${name})`);
    } catch (err) {
      console.log(`FAIL scores ${league.id.padEnd(17)} ${err.message}`);
    }
    try {
      entry.upcoming = await upcoming(league, now);
      const next = entry.upcoming[0];
      console.log(`ok   next   ${league.id.padEnd(17)} ${String(entry.upcoming.length).padStart(3)} fixtures${next ? `, first ${next.start} ${next.home.short} v ${next.away.short}` : ''}`);
    } catch (err) {
      console.log(`FAIL next   ${league.id.padEnd(17)} ${err.message}`);
    }
    return entry;
  }));
  console.log(`ESPN Access-Control-Allow-Origin: ${cors ?? '(none)'}`);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), leagues: out }));
  console.log(`Wrote scores for ${out.filter(l => l.ok).length}/${out.length} leagues and fixtures for ${out.filter(l => l.upcoming.length).length} to ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await saveScores();
