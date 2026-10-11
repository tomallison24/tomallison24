// Made-up ESPN scoreboards and a saved scores copy for the News app's browser
// test: the shapes ESPN's public feed and scripts/fetch-scores.mjs produce, a
// few leagues, games in play, finished and coming up. Dates are relative to
// now, so the test works on any day. No real data.
const HOUR = 36e5, DAY = 864e5;
const logo = id => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#${id}"/></svg>`)}`;
const T = (name, short, c) => ({ displayName: name, shortDisplayName: short, logo: logo(c) });

// league id -> [path, state of the day]
export const LEAGUES = {
  'eng.1': 'soccer/eng.1', 'eng.2': 'soccer/eng.2', 'uefa.champions': 'soccer/uefa.champions',
  nfl: 'football/nfl', 'rugby.267979': 'rugby/267979',
};

const game = (id, state, offsetH, home, away, hs, as, detail, tv) => ({
  id, date: new Date(Date.now() + offsetH * HOUR).toISOString(),
  status: { type: { state, shortDetail: detail || (state === 'post' ? 'FT' : '') } },
  links: [{ rel: ['summary'], href: `https://www.espn.com/soccer/match/_/gameId/${id}` }],
  competitions: [{
    competitors: [
      { homeAway: 'home', team: home, score: state === 'pre' ? null : String(hs), winner: state === 'post' && hs > as },
      { homeAway: 'away', team: away, score: state === 'pre' ? null : String(as), winner: state === 'post' && as > hs },
    ],
    geoBroadcasts: tv ? [{ media: { shortName: tv } }] : [],
  }],
});

const TEAMS = {
  liv: T('Liverpool', 'Liverpool', 'C8102E'), ars: T('Arsenal', 'Arsenal', 'EF0107'), che: T('Chelsea', 'Chelsea', '034694'),
  mci: T('Manchester City', 'Man City', '6CABDD'), tot: T('Tottenham Hotspur', 'Tottenham', '132257'), eve: T('Everton', 'Everton', '003399'),
  lee: T('Leeds United', 'Leeds', 'FFCD00'), shu: T('Sheffield United', 'Sheff Utd', 'EE2737'),
  rma: T('Real Madrid', 'Real Madrid', 'FEBE10'), int: T('Inter Milan', 'Inter', '010E80'),
  kc: T('Kansas City Chiefs', 'Chiefs', 'E31837'), buf: T('Buffalo Bills', 'Bills', '00338D'),
  nor: T('Northampton Saints', 'Northampton', '006633'), lei: T('Leicester Tigers', 'Leicester', '004225'),
};

// ESPN's scoreboard for today, per league.
const TODAY = {
  'eng.1': () => [
    game('1', 'in', -1, TEAMS.liv, TEAMS.ars, 2, 1, "63'", 'USA Network'),
    game('2', 'post', -4, TEAMS.che, TEAMS.mci, 0, 2),
    game('3', 'pre', 3, TEAMS.tot, TEAMS.eve, 0, 0, '', 'Peacock'),
  ],
  'eng.2': () => [game('4', 'post', -3, TEAMS.lee, TEAMS.shu, 1, 1)],
  'uefa.champions': () => [game('5', 'pre', 6, TEAMS.liv, TEAMS.int, 0, 0, '', 'Paramount+'), game('6', 'in', -1, TEAMS.rma, TEAMS.int, 0, 0, "12'")],
  nfl: () => [game('7', 'in', -1, TEAMS.buf, TEAMS.kc, 14, 17, 'Q3 5:12')],
  'rugby.267979': () => [game('8', 'pre', 20, TEAMS.nor, TEAMS.lei, 0, 0)],
};

export function espnFor(path) {
  const id = Object.keys(LEAGUES).find(k => LEAGUES[k] === path);
  return { events: id ? TODAY[id]() : [] };
}

// The saved copy: today's games and the fixtures to come.
const upcoming = (league, n, pair) => Array.from({ length: n }, (_, i) => {
  const [h, a] = pair(i);
  const g = game(`${league}-up${i}`, 'pre', 24 * (i + 2) + 2, h, a);
  return {
    id: g.id, league, state: 'pre', start: g.date, detail: '', tv: i === 0 ? ['Peacock'] : [],
    link: g.links[0].href,
    home: { name: h.displayName, short: h.shortDisplayName, logo: h.logo }, away: { name: a.displayName, short: a.shortDisplayName, logo: a.logo },
  };
});
export function snapshot() {
  const t = TEAMS;
  const pl = [[t.ars, t.che], [t.mci, t.liv], [t.eve, t.lee], [t.tot, t.ars], [t.liv, t.shu], [t.che, t.eve], [t.mci, t.tot]];
  return {
    generatedAt: new Date(Date.now() - 10 * 60e3).toISOString(),
    leagues: [
      { id: 'eng.1', ok: true, games: [], upcoming: upcoming('eng.1', 7, i => pl[i]) },
      { id: 'eng.2', ok: true, games: [], upcoming: upcoming('eng.2', 3, i => [[t.lee, t.eve], [t.shu, t.lee], [t.eve, t.shu]][i]) },
      { id: 'uefa.champions', ok: true, games: [], upcoming: upcoming('uefa.champions', 2, i => [[t.int, t.liv], [t.rma, t.mci]][i]) },
      { id: 'nfl', ok: true, games: [], upcoming: upcoming('nfl', 2, i => [[t.kc, t.buf], [t.buf, t.kc]][i]) },
      { id: 'rugby.267979', ok: true, games: [], upcoming: upcoming('rugby.267979', 2, i => [[t.lei, t.nor], [t.nor, t.lei]][i]) },
    ],
  };
}

// Just enough news that the Sport tab has stories.
export function newsJson() {
  const now = Date.now();
  return {
    generatedAt: new Date(now - 5 * 60e3).toISOString(),
    feeds: [{ source: 'BBC Sport', topic: 'sport', ok: true }],
    topics: [{ id: 'sport', label: 'Sport' }],
    stories: [
      { id: 's1', topic: 'sport', source: 'BBC Sport', title: 'Liverpool edge a thriller', url: 'https://example.com/1', published: new Date(now - HOUR).toISOString(), image: null, summary: '' },
      { id: 's2', topic: 'sport', source: 'BBC Sport', title: 'Northampton name their side', url: 'https://example.com/2', published: new Date(now - 2 * HOUR).toISOString(), image: null, summary: '' },
    ],
  };
}
