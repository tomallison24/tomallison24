// Saves a copy of every scoreboard in ../leagues.json to ../data/scores.json.
// The app reads scores live from ESPN while the Scores view is open; this
// copy is the fallback for when it can't (offline, or ESPN refuses the
// browser). ESPN's scoreboard feed is public but undocumented, so it may
// change without notice. Never fails the build: a missing copy only means
// no fallback.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'scores.json');
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';

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
  const out = await Promise.all(leagues.map(async league => {
    try {
      const res = await fetch(`${ESPN}/${league.path}/scoreboard`, {
        signal: AbortSignal.timeout(15000),
        headers: { Origin: 'https://tomallison24.github.io', 'User-Agent': 'news-home-screen-app/1.0' },
      });
      if (cors === null) cors = res.headers.get('access-control-allow-origin');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const games = normalize(json, league);
      const name = json?.leagues?.[0]?.name || '?';
      console.log(`ok   scores ${league.id.padEnd(17)} ${String(games.length).padStart(3)} games, ${games.filter(g => g.state === 'in').length} live  (ESPN: ${name})`);
      return { id: league.id, ok: true, games };
    } catch (err) {
      console.log(`FAIL scores ${league.id.padEnd(17)} ${err.message}`);
      return { id: league.id, ok: false, games: [] };
    }
  }));
  console.log(`ESPN Access-Control-Allow-Origin: ${cors ?? '(none)'}`);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), leagues: out }));
  console.log(`Wrote scores for ${out.filter(l => l.ok).length}/${out.length} leagues to ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await saveScores();
