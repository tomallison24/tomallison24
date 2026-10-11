// news's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
(() => {
  'use strict';

  const DATA_URL = 'data/news.json';
  const CATALOG_URL = 'sport-catalog.json';
  const LEAGUES_URL = 'leagues.json';
  const SCORES_URL = 'data/scores.json';                  // copy saved on each refresh
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
  const STALE_MS = 10 * 60 * 1000;          // refetch on return after this long
  const LATEST = { id: 'latest', label: 'Latest' };
  const SPORT = 'sport';
  const LATEST_PER_TOPIC = 50;              // no one topic can crowd out Latest
  const NOT_IN_LATEST = new Set(['sport']);  // Sport has its own tab; it swamped Latest
  const DEFAULT_TOPICS = [
    { id: 'uk', label: 'UK' }, { id: 'world', label: 'World' }, { id: 'us', label: 'US' },
    { id: 'business', label: 'Business' }, { id: 'tech', label: 'Tech' }, { id: 'ai', label: 'AI' },
    { id: 'science', label: 'Science' }, { id: 'sport', label: 'Sport' }, { id: 'stemcells', label: 'Stem cells' },
  ];
  const TOPIC_COLOURS = {
    uk: '#FF453A', world: '#30B0C7', us: '#0A84FF', business: '#FF9F0A',
    tech: '#5E5CE6', ai: '#BF5AF2', science: '#30D158', sport: '#FF6B2C', stemcells: '#FF2D92',
  };
  const ICON = {
    sliders: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 7.2h9.4M17.8 7.2h2.4M3.8 16.8h2.4M10.8 16.8h9.4"/><circle cx="15.5" cy="7.2" r="2.3"/><circle cx="8.5" cy="16.8" r="2.3"/></svg>',
    tick: '<svg class="i bold tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 12.6l4.4 4.4 9.2-9.6"/></svg>',
    x: '<svg class="i bold" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    tv: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="5.8" width="18.4" height="12.6" rx="3"/><path d="M9 21h6M8.4 2.6l3.6 3.2 3.6-3.2"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.2v13.6M5.2 12h13.6"/></svg>',
    down: '<svg class="dn" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>',
    chev: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(180deg)"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>',
  };
  // The topic picker's icons, one per topic, filled like Home's (Material Design Icons); any other topic gets a tag.
  const topicSvg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
  const TOPIC_ICONS = {
    latest: topicSvg('M4 7V19H19V21H4C2 21 2 19 2 19V7H4M21 5V15H8V5H21M21.3 3H7.7C6.76 3 6 3.7 6 4.55V15.45C6 16.31 6.76 17 7.7 17H21.3C22.24 17 23 16.31 23 15.45V4.55C23 3.7 22.24 3 21.3 3M9 6H12V11H9V6M20 14H9V12H20V14M20 8H14V6H20V8M20 11H14V9H20V11Z'),
    uk: topicSvg('M12 8L15 13.2L18 10.5L17.3 14H6.7L6 10.5L9 13.2L12 8M12 4L8.5 10L3 5L5 16H19L21 5L15.5 10L12 4M19 18H5V19C5 19.6 5.4 20 6 20H18C18.6 20 19 19.6 19 19V18Z'),
    world: topicSvg('M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z'),
    us: topicSvg('M6.5,10H4.5V17H6.5V10M12.5,10H10.5V17H12.5V10M21,19H2V21H21V19M18.5,10H16.5V17H18.5V10M11.5,3.26L16.71,6H6.29L11.5,3.26M11.5,1L2,6V8H21V6L11.5,1Z'),
    business: topicSvg('M20,6C20.58,6 21.05,6.2 21.42,6.59C21.8,7 22,7.45 22,8V19C22,19.55 21.8,20 21.42,20.41C21.05,20.8 20.58,21 20,21H4C3.42,21 2.95,20.8 2.58,20.41C2.2,20 2,19.55 2,19V8C2,7.45 2.2,7 2.58,6.59C2.95,6.2 3.42,6 4,6H8V4C8,3.42 8.2,2.95 8.58,2.58C8.95,2.2 9.42,2 10,2H14C14.58,2 15.05,2.2 15.42,2.58C15.8,2.95 16,3.42 16,4V6H20M4,8V19H20V8H4M14,6V4H10V6H14Z'),
    tech: topicSvg('M6,4H18V5H21V7H18V9H21V11H18V13H21V15H18V17H21V19H18V20H6V19H3V17H6V15H3V13H6V11H3V9H6V7H3V5H6V4M11,15V18H12V15H11M13,15V18H14V15H13M15,15V18H16V15H15Z'),
    ai: topicSvg('M9 4L11.5 9.5L17 12L11.5 14.5L9 20L6.5 14.5L1 12L6.5 9.5L9 4M9 8.83L8 11L5.83 12L8 13L9 15.17L10 13L12.17 12L10 11L9 8.83M19 9L17.74 6.26L15 5L17.74 3.75L19 1L20.25 3.75L23 5L20.25 6.26L19 9M19 23L17.74 20.26L15 19L17.74 17.75L19 15L20.25 17.75L23 19L20.25 20.26L19 23Z'),
    science: topicSvg('M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L13,8.35V4H11V8.35L5.18,18.43C5.07,18.59 5,18.79 5,19M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M13,16L14.34,14.66L16.27,18H7.73L10.39,13.39L13,16M12.5,12A0.5,0.5 0 0,1 13,12.5A0.5,0.5 0 0,1 12.5,13A0.5,0.5 0 0,1 12,12.5A0.5,0.5 0 0,1 12.5,12Z'),
    sport: topicSvg('M16.93 17.12L16.13 15.76L17.59 11.39L19 10.92L20 11.67C20 11.7 20 11.75 20 11.81C20 11.88 20.03 11.94 20.03 12C20.03 13.97 19.37 15.71 18.06 17.21L16.93 17.12M9.75 15L8.38 10.97L12 8.43L15.62 10.97L14.25 15H9.75M12 20.03C11.12 20.03 10.29 19.89 9.5 19.61L8.81 18.1L9.47 17H14.58L15.19 18.1L14.5 19.61C13.71 19.89 12.88 20.03 12 20.03M5.94 17.21C5.41 16.59 4.95 15.76 4.56 14.75C4.17 13.73 3.97 12.81 3.97 12C3.97 11.94 4 11.88 4 11.81C4 11.75 4 11.7 4 11.67L5 10.92L6.41 11.39L7.87 15.76L7.07 17.12L5.94 17.21M11 5.29V6.69L7 9.46L5.66 9.04L5.24 7.68C5.68 7 6.33 6.32 7.19 5.66S8.87 4.57 9.65 4.35L11 5.29M14.35 4.35C15.13 4.57 15.95 5 16.81 5.66C17.67 6.32 18.32 7 18.76 7.68L18.34 9.04L17 9.47L13 6.7V5.29L14.35 4.35M4.93 4.93C3 6.89 2 9.25 2 12S3 17.11 4.93 19.07 9.25 22 12 22 17.11 21 19.07 19.07 22 14.75 22 12 21 6.89 19.07 4.93 14.75 2 12 2 6.89 3 4.93 4.93Z'),
    stemcells: topicSvg('M4,2H6V4C6,5.44 6.68,6.61 7.88,7.78C8.74,8.61 9.89,9.41 11.09,10.2L9.26,11.39C8.27,10.72 7.31,10 6.5,9.21C5.07,7.82 4,6.1 4,4V2M18,2H20V4C20,6.1 18.93,7.82 17.5,9.21C16.09,10.59 14.29,11.73 12.54,12.84C10.79,13.96 9.09,15.05 7.88,16.22C6.68,17.39 6,18.56 6,20V22H4V20C4,17.9 5.07,16.18 6.5,14.79C7.91,13.41 9.71,12.27 11.46,11.16C13.21,10.04 14.91,8.95 16.12,7.78C17.32,6.61 18,5.44 18,4V2M14.74,12.61C15.73,13.28 16.69,14 17.5,14.79C18.93,16.18 20,17.9 20,20V22H18V20C18,18.56 17.32,17.39 16.12,16.22C15.26,15.39 14.11,14.59 12.91,13.8L14.74,12.61M7,3H17V4L16.94,4.5H7.06L7,4V3M7.68,6H16.32C16.08,6.34 15.8,6.69 15.42,7.06L14.91,7.5H9.07L8.58,7.06C8.2,6.69 7.92,6.34 7.68,6M9.09,16.5H14.93L15.42,16.94C15.8,17.31 16.08,17.66 16.32,18H7.68C7.92,17.66 8.2,17.31 8.58,16.94L9.09,16.5M7.06,19.5H16.94L17,20V21H7V20L7.06,19.5Z'),
  };
  const topicIcon = id => TOPIC_ICONS[id] || topicSvg('M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z');

  const $ = id => document.getElementById(id);
  const feedEl = $('feed'), filterEl = $('filterbar'), refreshBtn = $('refresh');
  const viewBtn = $('viewBtn'), viewMenu = $('viewMenu');
  const sheetWrap = $('sheet'), sheetEl = sheetWrap.querySelector('.sheet'), sheetBody = $('sheet-body'), searchEl = $('sheet-search');
  const segEl = $('sheet-seg'), sheetReset = $('sheet-reset'), sheetShow = $('sheet-show');
  const toastEl = $('toast'), toastText = $('toast-text'), toastUndo = $('toast-undo');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let data = store.get('news.data');
  let topic = store.get('news.topic') || LATEST.id;
  let loading = false;
  let lastFetch = 0;

  // Sport picks live on this device only. Ids come from sport-catalog.json
  // ("team:football:arsenal") or are typed keywords ("kw:Lewis Hamilton").
  let catalog = null, catalogFailed = false;
  let picks = Array.isArray(store.get('news.sport.picks')) ? store.get('news.sport.picks').filter(x => typeof x === 'string') : [];
  let pickList = [];               // what the Sport tab shows: a quick team, else the saved picks
  let savedPickList = [];          // the saved picks alone
  // One-tap team button (sport-catalog.json "quick"), on until tapped again.
  let quick = typeof store.get('news.sport.quick') === 'string' ? store.get('news.sport.quick') : null;
  let sportMode = store.get('news.sport.mode') === 'scores' ? 'scores' : 'news';
  // Scores: the league each pill shows (null: Premier League, or all leagues
  // while a team filter is on), and which pill menu is open.
  const LEAGUE_ALL = 'all', LEAGUE_HOME = 'eng.1';
  let pickedLeague = { scores: store.get('news.scores.league') || null, next: store.get('news.scores.next') || null };
  let openMenu = null;             // 'team' | 'scores' | 'next'
  let nextMore = false;            // "Show more" under Coming up

  // ---- helpers ----
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;
  const byTime = (a, b) => (b.published || '').localeCompare(a.published || '');

  // Journals date papers by day only ("2026-09-29", read as midnight UTC):
  // those show by that date (Today, Yesterday, 29 Sep), not a time of day.
  const dateOnly = iso => /T00:00:00(\.000)?Z$/.test(iso || '');
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function ago(iso, now = Date.now()) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    if (dateOnly(iso)) {
      const today = new Date(now), y = new Date(now);
      y.setDate(y.getDate() - 1);
      const day = iso.slice(0, 10);
      if (day === dayKey(today)) return 'Today';
      if (day === dayKey(y)) return 'Yesterday';
      return new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    }
    const m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = new Date(t);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  // BBC thumbnails are 240px wide; ask for a sharper one and fall back if refused.
  function sharper(url) {
    return url.replace(/(ichef\.bbci\.co\.uk\/(?:ace\/standard|news))\/240\//, '$1/800/');
  }

  function img(url, alt, big) {
    const src = safeUrl(url);
    if (!src) return '';
    const hi = big ? sharper(src) : src;
    const fallback = hi !== src ? ` data-fallback="${esc(src)}"` : '';
    return `<img src="${esc(hi)}"${fallback} alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  // Tabs run A to Z after Latest, whatever order the data lists them in.
  function topics() {
    const list = (data && Array.isArray(data.topics) && data.topics.length) ? data.topics : DEFAULT_TOPICS;
    return [...list].sort((a, b) => a.label.localeCompare(b.label, 'en-US'));
  }
  function topicLabel(id) { return (topics().find(t => t.id === id) || {}).label || id; }
  // Newest first on every tab, whatever order the data lists them in.
  function topicStories(id) { return (data && Array.isArray(data.stories)) ? data.stories.filter(s => s.topic === id).sort(byTime) : []; }

  // ---- sport matching ----
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const straight = s => String(s || '').replace(/[‘’]/g, "'");
  const reCache = new Map();

  // Whole-word match. Team and competition names are matched with their
  // capitals ("Heat", not "heat"); sports and typed keywords ignore case.
  function termRe(term, anyCase) {
    const key = (anyCase ? 'i:' : 's:') + term;
    let re = reCache.get(key);
    if (!re) {
      const src = straight(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { re = new RegExp(`(?<![\\p{L}\\p{N}])${src}(?![\\p{L}\\p{N}])`, anyCase ? 'iu' : 'u'); }
      catch { re = new RegExp(`\\b${src}\\b`, anyCase ? 'i' : ''); }
      reCache.set(key, re);
    }
    return re;
  }

  function buildCatalog(raw) {
    const entries = new Map();
    const sportLabel = {};
    const sports = (raw.sports || []).map(s => {
      sportLabel[s.id] = s.label;
      const e = { id: `sport:${s.id}`, kind: 'sport', sport: s.id, label: s.label,
        paths: s.paths || [], tags: (s.tags || []).map(t => t.toLowerCase()), terms: s.terms || [] };
      entries.set(e.id, e);
      return e;
    });
    const make = (kind, sport, name, lastWord, group) => {
      const [label, ...also] = Array.isArray(name) ? name : [name];
      const terms = [label, ...also];
      if (lastWord) terms.push(label.split(' ').pop());
      const e = { id: `${kind}:${sport || 'any'}:${slug(label)}`, kind, sport: sport || null, group, label, terms: [...new Set(terms)] };
      entries.set(e.id, e);
      return e;
    };
    const competitions = (raw.competitions || []).map(g => ({
      title: g.sport ? sportLabel[g.sport] || g.sport : 'Multi-sport',
      items: (g.names || []).map(n => make('comp', g.sport, n, false, g.sport ? sportLabel[g.sport] || g.sport : 'Multi-sport')),
    }));
    const teams = (raw.teams || []).map(g => ({
      title: g.group, items: (g.names || []).map(n => make('team', g.sport, n, g.lastWord, g.group)),
    }));
    // A button can cover several entries (England: football and rugby); its
    // first id is the key the device remembers.
    const quickTeams = (raw.quick || []).map(q => {
      const ids = (q.ids || [q.id]).filter(id => entries.has(id));
      return ids.length ? { key: ids[0], label: q.label, ids, menOnly: !!q.menOnly } : null;
    }).filter(Boolean);
    return { entries, sports, competitions, teams, sportLabel, quick: quickTeams, womenTerms: raw.womenTerms || [] };
  }

  function pickEntry(id) {
    if (id.startsWith('kw:')) return { id, kind: 'kw', label: id.slice(3) };
    return catalog ? catalog.entries.get(id) || null : null;
  }
  function refreshPicks() {
    savedPickList = picks.map(pickEntry).filter(Boolean);
    const q = quickTeam();
    pickList = q ? q.ids.map(pickEntry) : savedPickList;
  }
  const quickTeam = () => (quick && catalog && catalog.quick.find(q => q.key === quick)) || null;
  const quickOn = () => !!quickTeam();

  // Which sports a story is about: its web address (/football/, /f1/), the
  // publisher's tags, or the sport's own words. Worked out once per story.
  let facts = new WeakMap();
  function factsFor(s) {
    let f = facts.get(s);
    if (f) return f;
    let segs = [];
    try { segs = new URL(s.url).pathname.toLowerCase().split('/').filter(Boolean); } catch {}
    const tags = (s.tags || []).map(t => String(t).toLowerCase());
    const text = straight([s.title, s.summary, ...(s.tags || [])].join('\n'));
    const sports = new Set();
    for (const sp of catalog ? catalog.sports : []) {
      if (sp.paths.some(p => segs.includes(p)) || sp.tags.some(t => tags.includes(t)) ||
          sp.terms.some(t => termRe(t, true).test(text))) sports.add(sp.sport);
    }
    f = { text, sports };
    facts.set(s, f);
    return f;
  }

  // A team or competition only counts when its sport matches too, so
  // "Rangers" in football never picks up the Texas Rangers.
  function matches(p, s) {
    const f = factsFor(s);
    if (p.kind === 'sport') return f.sports.has(p.sport);
    if (p.kind === 'kw') return termRe(p.label, true).test(f.text);
    if (p.sport && !f.sports.has(p.sport)) return false;
    return p.terms.some(t => termRe(t, false).test(f.text));
  }
  const firstMatch = (s, list) => list.find(p => matches(p, s)) || null;

  // A men's-only team button drops stories that mention the women's game.
  const menOnly = () => { const q = quickTeam(); return !!(q && q.menOnly); };
  const aboutWomen = s => catalog.womenTerms.some(t => termRe(t, true).test(factsFor(s).text));
  function sportMatches() {
    const men = menOnly();
    return topicStories(SPORT).filter(s => firstMatch(s, pickList) && !(men && aboutWomen(s)));
  }

  function storiesFor(id) {
    if (id === SPORT) return (pickList.length ? sportMatches() : topicStories(SPORT)).slice(0, 100);
    if (id !== LATEST.id) return hasFilters(id) ? filteredStories(id) : topicStories(id);
    const seen = new Set();
    return topics()
      .filter(t => !NOT_IN_LATEST.has(t.id))
      .flatMap(t => topicStories(t.id).slice(0, LATEST_PER_TOPIC))
      .filter(s => !seen.has(s.id) && seen.add(s.id))
      .sort(byTime)
      .slice(0, 80);
  }

  // "New" tag: on topics with "newTag" in feeds.json (Stem cells), stories
  // published on today's date (a day-only date counts as that date),
  // wherever they show. Gone once the day is.
  function isToday(iso, now = new Date()) {
    if (!iso) return false;
    return (dateOnly(iso) ? iso.slice(0, 10) : dayKey(new Date(iso))) === dayKey(now);
  }
  const tagsNew = s => !!(data?.topics || []).find(t => t.id === s.topic)?.newTag && isToday(s.published);

  function meta(s, showTopic) {
    const parts = [];
    if (tagsNew(s)) parts.push('<span class="new">New</span>');
    const pick = s.topic === SPORT && pickList.length ? firstMatch(s, pickList) : null;
    if (showTopic) parts.push(`<span class="dot" style="background:${TOPIC_COLOURS[s.topic] || 'var(--muted)'}"></span><span>${esc(pick ? pick.label : topicLabel(s.topic))}</span>`);
    else if (pick) parts.push(`<span class="pickname">${esc(pick.label)}</span>`);
    parts.push(`<span>${esc(s.source)}</span>`);
    const when = ago(s.published);
    if (when) parts.push(`<span>${esc(when)}</span>`);
    // No dot between the tag and what follows.
    const html = parts[0]?.startsWith('<span class="new">') ? parts[0] + ' ' + parts.slice(1).join('<span class="sep">·</span>') : parts.join('<span class="sep">·</span>');
    return `<div class="meta">${html}</div>`;
  }

  // ---- switches with a sliding glass thumb: the shared AllisonOS one (home/slide.js) ----
  // Called after each redraw; a label newly chosen gets .ink (see the CSS).
  const slide = (window.AllisonOS && window.AllisonOS.slide) || (() => {});
  // The Sport and Stem cells bar: News | Scores or the time range.
  function slideBar(jump) {
    const modes = filterEl.querySelector('.modes');
    if (modes) slide(modes, modes.querySelector('[aria-selected="true"]'), `modes:${topic}`, { jump });
  }
  const slideSeg = jump => slide(segEl, segEl.querySelector('[aria-selected="true"]'), 'sheet-seg', { jump });
  window.addEventListener('resize', () => { slideBar(true); if (sheetOpen) slideSeg(true); });

  // ---- render ----
  // The topic picker: the pill shows the chosen topic, the menu lists them all.
  function renderTabs() {
    const list = [LATEST, ...topics()];
    if (!list.some(t => t.id === topic)) topic = LATEST.id;
    const now = list.find(t => t.id === topic);
    $('vbName').textContent = now.label;
    if ($('vbIcon').dataset.t !== now.id) { $('vbIcon').dataset.t = now.id; $('vbIcon').innerHTML = topicIcon(now.id); }
    if (!viewBtn.querySelector('.vb-chev svg')) viewBtn.querySelector('.vb-chev').innerHTML = ICON.chev;
    if (!viewMenu.hidden) drawViewMenu();
  }
  function drawViewMenu() {
    viewMenu.innerHTML = [LATEST, ...topics()].map(t =>
      `<button type="button" role="option" data-topic="${esc(t.id)}" aria-selected="${t.id === topic}">
        <span class="ic">${topicIcon(t.id)}</span><span class="k">${esc(t.label)}</span><span class="tick">${ICON.tick}</span></button>`).join('');
  }
  function closeViewMenu() { viewMenu.hidden = true; viewBtn.setAttribute('aria-expanded', 'false'); }

  // Sport tab: a News | Scores switch, then one line saying what is
  // filtered, with Filters and Reset (filters apply to both).
  function renderFilterbar() {
    const lists = topic !== SPORT && hasFilters(topic);
    filterEl.hidden = topic !== SPORT && !lists;
    if (filterEl.hidden) return;
    filterEl.setAttribute('aria-label', `${topicLabel(topic)} filters`);
    if (lists) return renderListFilters();
    const live = liveCount();
    const modes = `<div class="modes" role="tablist" aria-label="Sport view">
      <button class="seg" role="tab" data-mode="news" aria-selected="${sportMode === 'news'}">News</button>
      <button class="seg" role="tab" data-mode="scores" aria-selected="${sportMode === 'scores'}"${live ? ` aria-label="Scores, ${live} live"` : ''}>${live ? '<span class="live-dot" aria-hidden="true"></span>' : ''}Scores${live ? `<span class="n" aria-hidden="true">${live}</span>` : ''}</button>
    </div>`;
    filterEl.innerHTML = `<div class="fb-top">${modes}${teamPill()}</div>`;
    slideBar();
    syncMenus();
  }

  // One pill for everything you follow: the one-tap teams, your own filters
  // and Reset live in its menu instead of a row of chips.
  function teamPill() {
    const q = quickTeam();
    const n = q ? 0 : savedPickList.length;
    const label = q ? q.label : n ? 'Filters' : 'My teams';
    const row = (attrs, body, on) => `<button type="button" role="menuitem" ${attrs}${on === undefined ? '' : ` aria-pressed="${on}"`}>${body}</button>`;
    const items = [
      row('data-quick-clear', `<span class="k">${n ? 'My filters' : 'All sport'}${n ? ` <span class="sub">${n}</span>` : ''}</span>${ICON.tick}`, !q),
      ...(catalog ? catalog.quick.map(t => row(`data-quick="${esc(t.key)}"`, `<span class="k">${esc(t.label)}</span>${ICON.tick}`, !!q && quick === t.key)) : []),
      '<hr>',
      row('data-action="edit-picks"', `<span class="ic">${ICON.sliders}</span><span class="k">Choose sports and teams…</span>`),
      ...(n ? [row('data-action="reset-picks"', `<span class="ic">${ICON.x}</span><span class="k">Reset filters</span>`)] : []),
    ].join('');
    return `<div class="pillwrap right">
      <button type="button" class="chip pill${q ? ' on' : ''}" data-menu-btn="team" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label)}${n ? `, ${n} on` : ''}">${ICON.sliders}<span class="lbl">${esc(label)}</span>${n ? `<span class="n">${n}</span>` : ''}${ICON.down}</button>
      <div class="pmenu" role="menu" data-menu="team" aria-label="My teams" hidden>${items}</div>
    </div>`;
  }

  // Pill menus open under their pill and close on a pick, a tap outside or Escape.
  function syncMenus() {
    document.querySelectorAll('[data-menu-btn]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.menuBtn === openMenu)));
    document.querySelectorAll('[data-menu]').forEach(m => { m.hidden = m.dataset.menu !== openMenu; });
  }
  function setMenu(name) {
    openMenu = name && openMenu !== name ? name : null;
    syncMenus();
    const open = document.querySelector('.pmenu:not([hidden])');
    if (open) { const on = open.querySelector('[aria-pressed="true"], [aria-selected="true"]'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  }

  function renderFeed() {
    if (topic === SPORT && sportMode === 'scores') { feedEl.innerHTML = renderScores(); syncMenus(); return; }
    if (!data) { feedEl.innerHTML = loading ? skeleton() : notice('No stories yet', 'Couldn’t reach the news service. Check your connection and try again.', '<button data-action="retry">Try again</button>'); return; }

    const isLatest = topic === LATEST.id;
    const stories = storiesFor(topic);
    if (!stories.length) {
      if (topic === SPORT && quickOn()) {
        feedEl.innerHTML = notice(`Nothing on ${esc(quickTeam().label)} right now`,
          'None of the latest sport stories mention them. They’ll show here as soon as one does.',
          `<button data-quick="${esc(quick)}">${savedPickList.length ? 'Back to my filters' : 'Show all sport'}</button>`) + status();
        return;
      }
      if (topic === SPORT && pickList.length) {
        const names = pickList.map(p => p.label);
        const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
        feedEl.innerHTML = notice('Nothing on your filters right now',
          `None of the latest sport stories mention ${esc(list)}. They’ll show here as soon as one does.`,
          '<button data-action="reset-picks">Reset filters</button><button class="secondary" data-action="edit-picks">Edit filters</button>') + status();
        return;
      }
      if (hasFilters(topic) && filtersOn(topic)) {
        feedEl.innerHTML = notice('Nothing matches your filters', 'No stories from the chosen sources in this time range.',
          '<button data-action="reset-list-filters">Show everything</button>') + status();
        return;
      }
      feedEl.innerHTML = notice('Nothing here right now', `No ${esc(topicLabel(topic))} stories came through on the last update.`, '<button data-action="retry">Try again</button>') + status();
      return;
    }

    // Lead: the newest story, shown large when it has a picture. Only the
    // newest, so the list stays strictly newest first.
    const lead = safeUrl(stories[0].image) ? stories[0] : null;
    const rest = lead ? stories.slice(1) : stories;

    let html = '';
    if (lead) {
      html += `<a class="lead" href="${esc(safeUrl(lead.url))}" target="_blank" rel="noopener">
        <div class="img">${img(lead.image, '', true)}</div>
        <div class="body">${meta(lead, isLatest)}<h2>${esc(lead.title)}</h2>${lead.summary ? `<p>${esc(lead.summary)}</p>` : ''}</div>
      </a>`;
    }
    if (rest.length) {
      html += `<div class="list">${rest.map(s => `
        <a class="row" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">
          <div class="text">${meta(s, isLatest)}<h3>${esc(s.title)}</h3></div>
          ${safeUrl(s.image) ? `<div class="thumb">${img(s.image, '', false)}</div>` : ''}
        </a>`).join('')}</div>`;
    }
    feedEl.innerHTML = html + status();
  }

  function status() {
    if (!data) return '';
    const sources = [...new Set((data.feeds || []).filter(f => f.ok).map(f => f.source.replace(/ (News|Sport)$/, '')))];
    const down = (data.feeds || []).filter(f => !f.ok).length;
    const when = ago(data.generatedAt);
    const updated = !when ? '' : /^\d/.test(when) && !when.endsWith('ago') ? `Updated ${when}` : `Updated ${when.toLowerCase()}`;
    return `<p class="status">${[updated, sources.join(', ')].filter(Boolean).map(esc).join(' · ')}${down ? `<br>${down} feed${down > 1 ? 's' : ''} unavailable on the last update` : ''}</p>`;
  }

  function notice(title, body, actions) {
    return `<div class="notice"><h2>${esc(title)}</h2><p>${body}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }

  function skeleton() {
    const row = `<div class="row"><div class="text"><div class="sk" style="width:40%;height:10px"></div><div class="sk" style="width:95%;height:14px;margin-top:10px"></div><div class="sk" style="width:70%;height:14px;margin-top:6px"></div></div><div class="thumb sk"></div></div>`;
    return `<div class="lead"><div class="img sk" style="border-radius:0"></div><div class="body"><div class="sk" style="width:35%;height:10px"></div><div class="sk" style="width:90%;height:20px;margin-top:12px"></div><div class="sk" style="width:60%;height:20px;margin-top:6px"></div></div></div>
      <div class="list">${row.repeat(5)}</div>`;
  }

  function render() { renderTabs(); renderFilterbar(); renderFeed(); }

  // ---- source and time filters: topics with "filters" in feeds.json (Stem cells) ----
  // Newest first always; the bar narrows the list to some sources and/or a
  // time range. Saved on this device, per topic.
  const WINDOWS = [[0, 'All'], [1, 'Today'], [7, '7 days'], [30, '30 days']];
  let listFilters = store.get('news.filters') || {};
  const hasFilters = id => !!topics().find(t => t.id === id)?.filters;
  function filtersOf(id) {
    const f = listFilters[id] || {};
    return {
      sources: Array.isArray(f.sources) ? f.sources.filter(x => typeof x === 'string') : [],
      days: WINDOWS.some(([d]) => d === f.days) ? f.days : 0,
    };
  }
  const filtersOn = id => { const f = filtersOf(id); return !!(f.sources.length || f.days); };
  // Sources match whatever the capitals: Europe PMC writes "Stem cell reports".
  const sourceKey = s => String(s.source || '').trim().toLowerCase();
  // Today, or today and the days before it, by calendar date (a day-only
  // journal date counts as that date, as for the New tag).
  function withinDays(s, days) {
    if (!days) return true;
    if (!s.published || Number.isNaN(new Date(s.published).getTime())) return false;
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    const day = dateOnly(s.published) ? s.published.slice(0, 10) : dayKey(new Date(s.published));
    return day >= dayKey(from);
  }
  function filteredStories(id) {
    const { sources, days } = filtersOf(id);
    return topicStories(id)
      .filter(s => (!sources.length || sources.includes(sourceKey(s))) && withinDays(s, days))
      .sort(byTime);
  }
  // Every source in the topic, with how many stories it has in the chosen
  // time range; most first. Its name as written with the most capitals.
  function sourceList(id) {
    const { sources, days } = filtersOf(id);
    const all = new Map();
    for (const s of topicStories(id)) {
      const k = sourceKey(s);
      if (!k) continue;
      const e = all.get(k) || { key: k, names: [], n: 0 };
      e.names.push(String(s.source).trim());
      if (withinDays(s, days)) e.n++;
      all.set(k, e);
    }
    for (const k of sources) if (!all.has(k)) all.set(k, { key: k, names: [k], n: 0 });
    const caps = n => (n.match(/[A-Z]/g) || []).length;
    return [...all.values()]
      .map(e => ({ key: e.key, n: e.n, label: e.names.sort((a, b) => caps(b) - caps(a))[0] }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'en-US'));
  }

  function renderListFilters() {
    const { sources, days } = filtersOf(topic);
    const names = sourceList(topic).filter(e => sources.includes(e.key)).map(e => e.label);
    const windows = `<div class="modes four" role="tablist" aria-label="How recent">${WINDOWS.map(([d, label]) =>
      `<button class="seg" role="tab" data-days="${d}" aria-selected="${d === days}">${label}</button>`).join('')}</div>`;
    const chip = sources.length
      ? `<button class="chip" data-action="edit-sources" aria-label="Sources, ${sources.length} chosen">${ICON.sliders}Sources<span class="n">${sources.length}</span></button>
         <button class="chip icon" data-action="reset-sources" aria-label="Show all sources">${ICON.x}</button>
         <span class="fb-summary">${esc(names.join(', '))}</span>`
      : `<button class="chip" data-action="edit-sources">${ICON.sliders}All sources</button>`;
    filterEl.innerHTML = windows + `<div class="fb-row">${chip}</div>`;
    slideBar();
  }

  function setListFilters(id, next) {
    listFilters = { ...listFilters, [id]: { ...filtersOf(id), ...next } };
    store.set('news.filters', listFilters);
    if (srcOpen) { renderSrcSheet(); return; }
    renderFilterbar();
    renderFeed();
    keepBarInPlace();
  }

  const srcWrap = $('src-sheet'), srcSheetEl = srcWrap.querySelector('.sheet'), srcBody = $('src-body');
  const srcSearch = $('src-search'), srcReset = $('src-reset'), srcShow = $('src-show');
  let srcOpen = false;

  function renderSrcSheet(resetScroll) {
    const { sources, days } = filtersOf(topic);
    const q = srcSearch.value.trim().toLowerCase();
    const rows = sourceList(topic).filter(e => !q || e.label.toLowerCase().includes(q)).map(e =>
      `<button class="opt" data-source="${esc(e.key)}" aria-pressed="${sources.includes(e.key)}">
        <span class="label">${esc(e.label)}<span class="sub"> · ${e.n}</span></span>${ICON.tick}</button>`);
    const range = (WINDOWS.find(([d]) => d === days) || WINDOWS[0])[1];
    const title = days ? `Stories: ${range.toLowerCase() === 'today' ? 'today' : `last ${range}`}` : 'Stories on this tab';
    const scroll = srcBody.scrollTop;
    srcBody.innerHTML = rows.length ? section(title, rows) : '<p class="sheet-note">No source by that name.</p>';
    srcBody.scrollTop = resetScroll ? 0 : scroll;
    srcReset.disabled = !sources.length;
    const n = filteredStories(topic).length;
    srcShow.textContent = !sources.length ? 'Show all sources' : n ? `Show ${n} ${n === 1 ? 'story' : 'stories'}` : 'Done';
  }

  function openSrcSheet() {
    if (srcOpen) return;
    srcOpen = true;
    srcSearch.value = '';
    renderSrcSheet(true);
    srcWrap.hidden = false;
    document.documentElement.classList.add('locked');
    requestAnimationFrame(() => requestAnimationFrame(() => srcWrap.classList.add('open')));
    srcSheetEl.focus({ preventScroll: true });
  }

  function closeSrcSheet() {
    if (!srcOpen) return;
    srcOpen = false;
    srcWrap.classList.remove('open');
    document.documentElement.classList.remove('locked');
    const hide = () => { if (!srcOpen) srcWrap.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) hide(); else setTimeout(hide, 330);
    renderFilterbar();
    renderFeed();
    keepBarInPlace();
    const back = filterEl.querySelector('[data-action="edit-sources"]');
    if (back) back.focus({ preventScroll: true });
  }

  // ---- filter sheet ----
  const SEGMENTS = [['sports', 'Sports'], ['competitions', 'Competitions'], ['teams', 'Teams']];
  const KIND_OF_SEG = { sports: ['sport'], competitions: ['comp'], teams: ['team', 'kw'] };
  let sheetOpen = false, sheetSeg = 'sports', picksChanged = false, returnFocus = null;

  const keywordPicks = () => pickList.filter(p => p.kind === 'kw');

  function optRow(e, sub) {
    return `<button class="opt" data-pick="${esc(e.id)}" aria-pressed="${picks.includes(e.id)}">
      <span class="label">${esc(e.label)}${sub ? `<span class="sub"> · ${esc(sub)}</span>` : ''}</span>${ICON.tick}</button>`;
  }
  function section(title, rows) {
    return rows.length ? `<div class="sect">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="card">${rows.join('')}</div></div>` : '';
  }

  function renderSheet(resetScroll) {
    const q = searchEl.value.trim();
    segEl.hidden = !!q;
    segEl.innerHTML = SEGMENTS.map(([id, label]) => {
      const n = pickList.filter(p => KIND_OF_SEG[id].includes(p.kind)).length;
      return `<button class="seg" role="tab" data-seg="${id}" aria-selected="${sheetSeg === id}">${label}${n ? `<span class="n">${n}</span>` : ''}</button>`;
    }).join('');

    let html = '';
    if (q) {
      const ql = q.toLowerCase();
      const hit = e => e.label.toLowerCase().includes(ql) || (e.terms || []).some(t => t.toLowerCase().includes(ql));
      const all = catalog ? [...catalog.entries.values()] : [];
      const sports = all.filter(e => e.kind === 'sport' && hit(e));
      const comps = all.filter(e => e.kind === 'comp' && hit(e)).slice(0, 30);
      const teams = all.filter(e => e.kind === 'team' && hit(e)).slice(0, 30);
      const kws = keywordPicks().filter(hit);
      const exact = [...sports, ...comps, ...teams, ...kws].some(e => e.label.toLowerCase() === ql);
      const typed = q.slice(0, 40);
      if (!exact) html += section('', [`<button class="opt add" data-add="${esc(typed)}">${ICON.plus}<span class="label">Follow “${esc(typed)}”</span></button>`]);
      html += section('Sports', sports.map(e => optRow(e)))
        + section('Competitions', comps.map(e => optRow(e, e.group)))
        + section('Teams', teams.map(e => optRow(e, e.group)))
        + section('Players & keywords', kws.map(e => optRow(e)));
      if (!sports.length && !comps.length && !teams.length && !kws.length) {
        html += '<p class="sheet-note">Not in the list. Follow it to see any headline that mentions it.</p>';
      }
    } else if (!catalog) {
      html = `<p class="sheet-note">${catalogFailed ? 'Couldn’t load the list of sports and teams. You can still search for anything and follow it.' : 'Loading…'}</p>`;
    } else if (sheetSeg === 'sports') {
      html = section('', catalog.sports.map(e => optRow(e)));
    } else if (sheetSeg === 'competitions') {
      // Sports with only a competition or two share one "More" list.
      const big = catalog.competitions.filter(g => g.items.length >= 3);
      const small = catalog.competitions.filter(g => g.items.length < 3);
      html = big.map(g => section(g.title, g.items.map(e => optRow(e)))).join('')
        + section('More', small.flatMap(g => g.items.map(e => optRow(e, g.title))));
    } else {
      html = section('Players & keywords', keywordPicks().map(e => optRow(e)))
        + catalog.teams.map(g => section(g.title, g.items.map(e => optRow(e)))).join('');
    }
    const scroll = sheetBody.scrollTop;
    sheetBody.innerHTML = html;
    sheetBody.scrollTop = resetScroll ? 0 : scroll;

    sheetReset.disabled = !picks.length;
    const n = pickList.length ? sportMatches().length : 0;
    sheetShow.textContent = !pickList.length ? 'Show all sport' : n ? `Show ${n} ${n === 1 ? 'story' : 'stories'}` : 'Done';
    slideSeg();
  }

  function openSheet() {
    if (sheetOpen) return;
    if (quick) setQuick(null);      // the sheet edits the saved picks
    sheetOpen = true;
    picksChanged = false;
    returnFocus = document.activeElement;
    searchEl.value = '';
    if (!catalog && !catalogFailed) loadCatalog();
    renderSheet(true);
    sheetWrap.hidden = false;
    slideSeg(true);                 // hidden until now, so nothing to measure before
    document.documentElement.classList.add('locked');
    requestAnimationFrame(() => requestAnimationFrame(() => sheetWrap.classList.add('open')));
    sheetEl.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetWrap.classList.remove('open');
    document.documentElement.classList.remove('locked');
    const hide = () => { if (!sheetOpen) sheetWrap.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) hide(); else setTimeout(hide, 330);
    renderFilterbar();
    renderFeed();
    if (picksChanged) keepBarInPlace();
    const back = returnFocus && returnFocus.isConnected ? returnFocus : filterEl.querySelector('[data-action="edit-picks"]');
    if (back) back.focus({ preventScroll: true });
  }

  function setQuick(id) {
    quick = id && quick !== id ? id : null;
    store.set('news.sport.quick', quick);
    refreshPicks();
    renderFilterbar();
    renderFeed();
    keepBarInPlace();
    if (topic === SPORT && sportMode === 'scores') fetchScores();
  }

  function setPicks(next) {
    picks = next;
    picksChanged = true;
    store.set('news.sport.picks', picks);
    refreshPicks();
    if (sheetOpen) renderSheet();
    else { renderFilterbar(); renderFeed(); }
    if (topic === SPORT && sportMode === 'scores') fetchScores();
  }

  // Reset from the results page clears every filter, with a few seconds to undo.
  let toastTimer = 0, undoPicks = null;
  function resetFromResults() {
    if (!picks.length) return;
    undoPicks = picks.slice();
    setPicks([]);
    keepBarInPlace();
    toastText.textContent = 'Filters cleared';
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; undoPicks = null; }, 6000);
  }
  toastUndo.addEventListener('click', () => {
    clearTimeout(toastTimer);
    toastEl.hidden = true;
    if (undoPicks) setPicks(undoPicks);
    undoPicks = null;
  });

  // ---- scores ----
  // Read live from ESPN's public scoreboard feed while the Scores view is
  // open: every minute while anything is in play, every 5 minutes otherwise.
  // If ESPN can't be reached, fall back to the copy saved on each refresh.
  // Fixtures (games still to come) always come from that saved copy.
  let leagues = store.get('news.leagues');
  let scores = {};                  // league id -> games
  let fixtures = {};                // league id -> upcoming games, soonest first
  let scoresAt = 0, scoresSource = '', scoresLoading = false, scoresTimer = 0;
  let snap = null, snapFetched = 0;

  // Keep in step with normalize() in scripts/fetch-scores.mjs.
  function normalize(json, league) {
    return ((json && json.events) || []).map(ev => {
      const comp = (ev.competitions || [])[0] || {};
      const sides = comp.competitors || [];
      const side = where => {
        const c = sides.find(x => x.homeAway === where) || {};
        const t = c.team || {};
        return {
          name: t.displayName || t.name || '',
          short: t.shortDisplayName || t.abbreviation || t.displayName || '',
          logo: t.logo || (t.logos && t.logos[0] && t.logos[0].href) || null,
          score: c.score == null ? null : String(typeof c.score === 'object' ? (c.score.displayValue ?? '') : c.score),
          winner: !!c.winner,
        };
      };
      const type = (ev.status || comp.status || {}).type || {};
      const link = (ev.links || []).find(l => (l.rel || []).includes('summary')) || (ev.links || [])[0];
      const tv = [...new Set([
        ...(comp.geoBroadcasts || []).map(b => b.media && b.media.shortName),
        ...(comp.broadcasts || []).flatMap(b => b.names || []),
      ].filter(Boolean))].slice(0, 3);
      return {
        tv, id: String(ev.id), league: league.id, state: type.state || 'pre',
        detail: type.shortDetail || type.detail || '', start: ev.date || comp.date || null,
        home: side('home'), away: side('away'), link: (link && link.href) || null,
      };
    });
  }

  const allGames = () => Object.values(scores).flat();
  function liveCount() {
    return (leagues || []).reduce((n, l) => n + (scores[l.id] || []).filter(g => g.state === 'in' && gameMatches(g, l)).length, 0);
  }

  // Leagues worth fetching for the current filters.
  function relevantLeagues() {
    const all = (leagues || []).filter(l => !(l.women && menOnly()));
    if (!pickList.length) return all;
    return all.filter(l => pickList.some(p =>
      p.kind === 'kw' || (p.kind === 'team' && !p.sport) ||
      (p.kind === 'sport' && p.sport === l.sport) ||
      (p.kind === 'comp' && p.id === l.comp) ||
      (p.kind === 'team' && p.sport === l.sport)));
  }

  // A team is the whole name or its start: "Northampton" is ESPN's
  // "Northampton Saints", but "England" isn't "New England". Keep in step
  // with sameTeam() in scripts/fetch-scores.mjs.
  const sameTeam = (term, name) => { const n = String(name || '').trim(); return n === term || n.startsWith(`${term} `); };

  function gameMatches(g, l) {
    if (!pickList.length) return true;
    const names = [g.home.name, g.home.short, g.away.name, g.away.short];
    if (menOnly() && (l.women || names.some(n => /\bwomen\b/i.test(n || '')))) return false;
    return pickList.some(p => {
      if (p.kind === 'sport') return p.sport === l.sport;
      if (p.kind === 'comp') return p.id === l.comp;
      if (p.kind === 'kw') return termRe(p.label, true).test(names.join('\n'));
      if (p.sport && p.sport !== l.sport) return false;
      return p.terms.some(t => names.some(n => sameTeam(t, n)));
    });
  }

  async function loadLeagues() {
    try {
      const res = await fetch(LEAGUES_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      leagues = (await res.json()).leagues || [];
      store.set('news.leagues', leagues);
    } catch (err) {
      console.warn('League list failed to load:', err);
    }
    if (topic === SPORT && sportMode === 'scores') fetchScores();
  }

  // The saved copy, re-read once it's older than maxAge (ms).
  async function getSnapshot(maxAge) {
    if (snap && Date.now() - snapFetched < maxAge) return snap;
    try {
      const res = await fetch(`${SCORES_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      snap = await res.json();
      snapFetched = Date.now();
      fixtures = {};
      for (const l of snap.leagues || []) fixtures[l.id] = l.upcoming || [];
    } catch (err) {
      console.warn('Saved scores unavailable:', err);
    }
    return snap;
  }

  async function loadSnapshot() {
    const copy = await getSnapshot(0);
    if (!copy) return false;
    for (const l of copy.leagues || []) if (l.ok) scores[l.id] = l.games || [];
    scoresAt = Date.parse(copy.generatedAt) || 0;
    scoresSource = 'copy';
    return true;
  }

  async function fetchScores() {
    clearTimeout(scoresTimer);
    if (scoresLoading || !leagues) return;
    scoresLoading = true;
    if (topic === SPORT && sportMode === 'scores') renderFeed();
    const list = relevantLeagues();
    const [got] = await Promise.all([
      Promise.allSettled(list.map(l =>
        fetch(`${ESPN}/${l.path}/scoreboard`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(json => [l.id, normalize(json, l)]))),
      getSnapshot(15 * 60e3),
    ]);
    const ok = got.filter(r => r.status === 'fulfilled');
    for (const r of ok) scores[r.value[0]] = r.value[1];
    if (ok.length) { scoresAt = Date.now(); scoresSource = 'live'; }
    else if (list.length) await loadSnapshot();
    scoresLoading = false;
    renderFilterbar();
    if (topic === SPORT && sportMode === 'scores') renderFeed();
    scheduleScores();
  }

  function scheduleScores() {
    clearTimeout(scoresTimer);
    if (document.visibilityState !== 'visible' || topic !== SPORT || sportMode !== 'scores') return;
    const live = allGames().some(g => g.state === 'in');
    scoresTimer = setTimeout(fetchScores, live ? 60e3 : 300e3);
  }

  function kickoff(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === new Date().toDateString()) return time;
    const soon = d.getTime() - Date.now() < 6 * 864e5;
    return `${d.toLocaleDateString('en-US', soon ? { weekday: 'short' } : { day: 'numeric', month: 'short' })}<br>${time}`;
  }

  function gameRow(g, l) {
    const decided = g.state === 'post' && (g.home.winner || g.away.winner);
    const stat = g.state === 'in' ? `<span class="live-dot" aria-hidden="true"></span>${esc(g.detail || 'Live')}`
      : g.state === 'post' ? esc(g.detail || 'FT') : kickoff(g.start);
    const team = t => `<div class="gteam${t.winner ? ' win' : ''}">
        ${safeUrl(t.logo) ? `<img class="glogo" src="${esc(t.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="glogo"></span>'}
        <span class="gname">${esc(t.short || t.name)}</span>
        <span class="gscore">${g.state === 'pre' || t.score == null ? '' : esc(t.score)}</span>
      </div>`;
    const [first, second] = l.homeFirst ? [g.home, g.away] : [g.away, g.home];
    // Where to watch (US TV/streaming from ESPN), until the game is over.
    const tv = g.state !== 'post' && Array.isArray(g.tv) && g.tv.length
      ? `<div class="gtv">${ICON.tv}<span>${esc(g.tv.join(' · '))}</span></div>` : '';
    const body = `<div class="gstat ${esc(g.state)}">${stat}</div><div class="gteams">${team(first)}${team(second)}${tv}</div>`;
    const cls = `game ${esc(g.state)}${decided ? ' decided' : ''}`;
    return safeUrl(g.link) ? `<a class="${cls}" href="${esc(g.link)}" target="_blank" rel="noopener">${body}</a>` : `<div class="${cls}">${body}</div>`;
  }

  const STATE_ORDER = { in: 0, pre: 1, post: 2 };

  // Which league a pill shows. A league you picked stays while it has games;
  // otherwise the Premier League, or every league while a team filter is on
  // (a team plays in several), or every league if the Premier League is quiet.
  function leagueShown(which, secs) {
    const ids = secs.map(x => x.l.id), saved = pickedLeague[which];
    if (saved === LEAGUE_ALL || ids.includes(saved)) return saved;
    return !pickList.length && ids.includes(LEAGUE_HOME) ? LEAGUE_HOME : LEAGUE_ALL;
  }

  // The header of one block (Scores, Coming up): its name and a pill to pick the league.
  function blockHead(which, title, secs, shown) {
    const name = secs.length === 1 ? secs[0].l.label : shown === LEAGUE_ALL ? 'All leagues' : secs.find(x => x.l.id === shown).l.label;
    if (secs.length < 2) return `<div class="sect-head"><h3>${esc(title)}</h3>${secs.length ? `<span class="fb-summary one">${esc(name)}</span>` : ''}</div>`;
    const count = x => which === 'scores' ? x.games.length : x.next.length;
    const row = (id, label, n, live) => `<button type="button" role="menuitem" data-league="${esc(id)}" data-for="${which}" aria-selected="${id === shown}">
        <span class="k">${live ? '<span class="live-dot" aria-hidden="true"></span>' : ''}${esc(label)}</span><span class="sub">${n}</span>${ICON.tick}</button>`;
    const total = secs.reduce((n, x) => n + count(x), 0);
    // Pinned leagues (leagues.json "pin") sit at the top, under All leagues; the rest follow, live ones first.
    const line = x => row(x.l.id, x.l.label, count(x), which === 'scores' && x.live);
    const pinned = secs.filter(x => x.l.pin), others = secs.filter(x => !x.l.pin);
    const list = pinned.map(line).join('') + (pinned.length && others.length ? '<hr>' : '') + others.map(line).join('');
    return `<div class="sect-head"><h3>${esc(title)}</h3>
      <div class="pillwrap">
        <button type="button" class="chip pill" data-menu-btn="${which}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(title)}: ${esc(name)}">${which === 'scores' && secs.some(x => x.live && (shown === LEAGUE_ALL || x.l.id === shown)) ? '<span class="live-dot" aria-hidden="true"></span>' : ''}<span class="lbl">${esc(name)}</span>${ICON.down}</button>
        <div class="pmenu" role="menu" data-menu="${which}" aria-label="${esc(title)} league" hidden>${row(LEAGUE_ALL, 'All leagues', total, false)}${list}</div>
      </div></div>`;
  }

  function renderScores() {
    if (!leagues || (scoresLoading && !allGames().length)) return skeleton();
    const now = Date.now();
    const secs = relevantLeagues()
      .map((l, i) => {
        const current = scores[l.id] || [];
        const games = current.filter(g => gameMatches(g, l))
          .sort((a, b) => (STATE_ORDER[a.state] ?? 1) - (STATE_ORDER[b.state] ?? 1) || (a.start || '').localeCompare(b.start || ''));
        // The next fixtures not already on today's scoreboard.
        const ids = new Set(current.map(g => g.id));
        const next = (fixtures[l.id] || []).filter(g => !ids.has(g.id) && Date.parse(g.start) > now && gameMatches(g, l));
        return { l, i, games, next, live: games.some(g => g.state === 'in') };
      })
      .sort((a, b) => (b.live - a.live) || (a.i - b.i));
    const withGames = secs.filter(x => x.games.length), withNext = secs.filter(x => x.next.length);
    const when = scoresAt ? ago(new Date(scoresAt).toISOString()) : '';
    const fixWhen = snap && withNext.length ? ago(snap.generatedAt) : '';
    const foot = `<p class="status">Scores from ESPN${when ? ` · updated ${esc(when.toLowerCase())}` : ''}${scoresSource === 'copy' ? ' · saved copy, ESPN unreachable just now' : ''}${fixWhen ? ` · fixtures checked ${esc(fixWhen.toLowerCase())}` : ''}</p>`;
    if (!withGames.length && !withNext.length) {
      if (!scoresAt) return notice('Scores unavailable', 'Couldn’t reach ESPN or the saved copy. Check your connection and try again.', '<button data-action="retry-scores">Try again</button>');
      if (quickOn()) return notice(`No games for ${esc(quickTeam().label)}`, 'Nothing on now or in the next two weeks.',
        `<button data-quick="${esc(quick)}">${savedPickList.length ? 'Back to my filters' : 'Show all leagues'}</button>`) + foot;
      return pickList.length
        ? notice('No games for your filters', 'None of the games on now or coming up involve your filters.', '<button data-action="reset-picks">Reset filters</button><button class="secondary" data-action="edit-picks">Edit filters</button>') + foot
        : notice('No games right now', 'There are no games or fixtures listed in these leagues at the moment.', '') + foot;
    }

    // One block per question: what's on (Scores) and what's next (Coming up),
    // each showing one league until you pick another, or every league.
    const block = (which, title, list, cards) => {
      if (!list.length) return '';
      const shown = leagueShown(which, list);
      const chosen = shown === LEAGUE_ALL ? list : list.filter(x => x.l.id === shown);
      const body = chosen.map(x => `${shown === LEAGUE_ALL ? `<h4 class="lg-name">${esc(x.l.label)}</h4>` : ''}${cards(x, shown)}`).join('');
      return `<section class="sect">${blockHead(which, title, list, shown)}${body}</section>`;
    };
    const scoreCard = x => `<div class="card scores">${x.games.map(g => gameRow(g, x.l)).join('')}</div>`;
    // Coming up: a few a league, or a gameweek's worth of one league, with Show more.
    const nextCard = (x, shown) => {
      const single = shown !== LEAGUE_ALL, cap = single ? (nextMore ? 10 : 5) : (pickList.length ? 5 : 3);
      const rows = x.next.slice(0, cap);
      const more = single && !nextMore && x.next.length > cap ? `<button type="button" class="more" data-action="more-next">Show ${x.next.length - cap} more</button>` : '';
      return `<div class="card scores">${rows.map(g => gameRow(g, x.l)).join('')}${more}</div>`;
    };
    return (withGames.length ? block('scores', 'Scores', withGames, scoreCard)
        : `<section class="sect"><div class="sect-head"><h3>Scores</h3></div><p class="gnone">No games on right now.</p></section>`)
      + block('next', 'Coming up', withNext, nextCard) + foot;
  }

  function setLeague(which, id) {
    pickedLeague[which] = id;
    store.set(which === 'scores' ? 'news.scores.league' : 'news.scores.next', id);
    nextMore = false;
    openMenu = null;
    renderFeed();
  }

  function setMode(mode) {
    if (mode === sportMode) return;
    sportMode = mode;
    store.set('news.sport.mode', mode);
    renderFilterbar();
    renderFeed();
    keepBarInPlace();
    if (mode === 'scores') fetchScores(); else clearTimeout(scoresTimer);
  }

  // ---- data ----
  async function load() {
    if (loading) return;
    loading = true;
    refreshBtn.classList.add('spinning');
    if (!data) renderFeed();
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = await res.json();
      if (!next || !Array.isArray(next.stories)) throw new Error('Bad data');
      data = next;
      lastFetch = Date.now();
      store.set('news.data', data);
    } catch (err) {
      console.warn('News update failed:', err);
    } finally {
      loading = false;
      refreshBtn.classList.remove('spinning');
      render();
    }
  }

  async function loadCatalog() {
    try {
      const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      catalog = buildCatalog(raw);
      store.set('news.sport.catalog', raw);
      catalogFailed = false;
      facts = new WeakMap();          // sports were unknown until now
      refreshPicks();
    } catch (err) {
      catalogFailed = true;
      console.warn('Sport list failed to load:', err);
    } finally {
      render();
      if (sheetOpen) renderSheet();
    }
  }

  // Bring the start of the new list (or the Sport or Stem cells controls) to just under the clock.
  function keepBarInPlace() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:var(--inset-top);visibility:hidden';
    document.body.append(probe);
    const inset = probe.offsetHeight;
    probe.remove();
    const anchor = !filterEl.hidden ? filterEl : feedEl;
    const top = anchor.getBoundingClientRect().top + window.scrollY - inset - 8;
    if (window.scrollY > top) window.scrollTo({ top });
  }

  function select(id) {
    if (id === topic) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    topic = id;
    store.set('news.topic', topic);
    render();
    keepBarInPlace();
    if (topic === SPORT && sportMode === 'scores') fetchScores(); else clearTimeout(scoresTimer);
  }

  // ---- events ----
  viewBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!viewMenu.hidden) return closeViewMenu();
    drawViewMenu(); viewMenu.hidden = false; viewBtn.setAttribute('aria-expanded', 'true');
    const on = viewMenu.querySelector('[aria-selected="true"]');
    if (on) on.scrollIntoView({ block: 'nearest' });
  });
  viewMenu.addEventListener('click', e => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    closeViewMenu();
    select(b.dataset.topic);
  });
  document.addEventListener('click', e => { if (!viewMenu.hidden && !e.target.closest('#viewMenu, #viewBtn')) closeViewMenu(); });
  document.addEventListener('click', e => { if (openMenu && !e.target.closest('.pillwrap')) setMenu(null); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenu) { const b = document.querySelector(`[data-menu-btn="${openMenu}"]`); setMenu(null); if (b) b.focus(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !viewMenu.hidden) { closeViewMenu(); viewBtn.focus(); } });
  filterEl.addEventListener('click', e => {
    const d = e.target.closest('[data-days]');
    if (d) return setListFilters(topic, { days: Number(d.dataset.days) });
    if (e.target.closest('[data-action="edit-sources"]')) return openSrcSheet();
    if (e.target.closest('[data-action="reset-sources"]')) return setListFilters(topic, { sources: [] });
    const m = e.target.closest('[data-mode]');
    if (m) return setMode(m.dataset.mode);
    const mb = e.target.closest('[data-menu-btn]');
    if (mb) return setMenu(mb.dataset.menuBtn);
    if (e.target.closest('[data-quick-clear]')) { openMenu = null; return setQuick(null); }
    const q = e.target.closest('[data-quick]');
    if (q) { openMenu = null; return setQuick(q.dataset.quick); }
    if (e.target.closest('[data-action="edit-picks"]')) { openMenu = null; syncMenus(); return openSheet(); }
    if (e.target.closest('[data-action="reset-picks"]')) { openMenu = null; syncMenus(); return resetFromResults(); }
  });
  feedEl.addEventListener('click', e => {
    if (e.target.closest('[data-action="retry"]')) return load();
    if (e.target.closest('[data-action="reset-list-filters"]')) return setListFilters(topic, { sources: [], days: 0 });
    if (e.target.closest('[data-action="retry-scores"]')) return fetchScores();
    const mb = e.target.closest('[data-menu-btn]');
    if (mb) return setMenu(mb.dataset.menuBtn);
    const lg = e.target.closest('[data-league]');
    if (lg) return setLeague(lg.dataset.for, lg.dataset.league);
    if (e.target.closest('[data-action="more-next"]')) { nextMore = true; return renderFeed(); }
    const q = e.target.closest('[data-quick]');
    if (q) return setQuick(q.dataset.quick);
    if (e.target.closest('[data-action="edit-picks"]')) return openSheet();
    if (e.target.closest('[data-action="reset-picks"]')) return resetFromResults();
  });
  refreshBtn.addEventListener('click', load);

  segEl.addEventListener('click', e => {
    const b = e.target.closest('[data-seg]');
    if (!b || b.dataset.seg === sheetSeg) return;
    sheetSeg = b.dataset.seg;
    renderSheet(true);
  });
  sheetWrap.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-sheet"]')) return closeSheet();
    if (e.target.closest('[data-action="reset-picks"]')) return setPicks([]);
    const add = e.target.closest('[data-add]');
    if (add) {
      const id = `kw:${add.dataset.add}`;
      if (!picks.includes(id)) setPicks([...picks, id]);
      return;
    }
    const b = e.target.closest('[data-pick]');
    if (b) {
      const id = b.dataset.pick;
      setPicks(picks.includes(id) ? picks.filter(x => x !== id) : [...picks, id]);
    }
  });
  searchEl.addEventListener('input', () => renderSheet(true));
  srcWrap.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-src"]')) return closeSrcSheet();
    if (e.target.closest('[data-action="src-reset"]')) return setListFilters(topic, { sources: [] });
    const b = e.target.closest('[data-source]');
    if (!b) return;
    const k = b.dataset.source, { sources } = filtersOf(topic);
    setListFilters(topic, { sources: sources.includes(k) ? sources.filter(x => x !== k) : [...sources, k] });
  });
  srcSearch.addEventListener('input', () => renderSrcSheet(true));
  srcSearch.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); srcSearch.blur(); } });
  searchEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const add = sheetBody.querySelector('[data-add]');
    const hits = sheetBody.querySelectorAll('[data-pick]');
    if (add) add.click(); else if (hits.length === 1) hits[0].click();
    searchEl.blur();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'Escape' && srcOpen) closeSrcSheet();
  });

  // Broken or refused images: try the original, then drop the frame.
  feedEl.addEventListener('error', e => {
    const im = e.target;
    if (im.tagName !== 'IMG') return;
    if (im.classList.contains('glogo')) { im.style.visibility = 'hidden'; return; }
    if (im.dataset.fallback) { im.src = im.dataset.fallback; delete im.dataset.fallback; return; }
    const frame = im.closest('.thumb, .img');
    if (frame) frame.remove();
  }, true);

  // Swipe left/right on the list to move between topics.
  let sx = 0, sy = 0, st = 0;
  feedEl.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  feedEl.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (sx < 24 || sx > window.innerWidth - 24) return;           // leave edge swipes to the OS
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - st > 600) return;
    const ids = [LATEST.id, ...topics().map(t => t.id)];
    const i = ids.indexOf(topic) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < ids.length) select(ids[i]);
  }, { passive: true });

  // Redraw when the date changes, so yesterday's "New" tags go: at midnight
  // if the app is open, or on coming back to it on a later day.
  let shownDay = dayKey(new Date());
  function redrawIfNewDay() {
    if (dayKey(new Date()) === shownDay) return;
    shownDay = dayKey(new Date());
    $('today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    render();
  }
  (function atMidnight() {
    const next = new Date(); next.setHours(24, 0, 1, 0);
    setTimeout(() => { redrawIfNewDay(); atMidnight(); }, next - Date.now());
  })();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') redrawIfNewDay();
    if (document.visibilityState === 'visible' && Date.now() - lastFetch > STALE_MS) load();
    if (document.visibilityState === 'visible' && topic === SPORT && sportMode === 'scores') fetchScores();
    else clearTimeout(scoresTimer);
  });

  $('today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  // Last copy of the sport list first, so picks apply from the first frame.
  try { const raw = store.get('news.sport.catalog'); if (raw) catalog = buildCatalog(raw); } catch {}
  refreshPicks();
  render();
  load();
  loadCatalog();
  loadLeagues();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
