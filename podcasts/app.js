// podcasts's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
// Two designs, picked in Settings > Design: Vintage (the default) and Standard (Sea glass), kept on
// this phone (../home/design.js, as in Clock).
(function(){
  'use strict';
  // Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
  if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
    document.body.textContent = 'Podcasts can’t be opened inside another page.';
    throw new Error('Podcasts refuses to run inside a frame');
  }
  const KEY = 'allison-podcasts-v1';
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const MAX_EPS = 250;                     // newest episodes kept for each show
  const $ = id => document.getElementById(id);
  // Switches with a sliding glass thumb: the shared AllisonOS one (home/slide.js).
  // Without it, the chosen option keeps its own background.
  const slide = (window.AllisonOS && window.AllisonOS.slide) || (() => {});
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const I = {
    play:'<svg viewBox="0 0 24 24" class="f"><path d="M7.4 4.8v14.4a1.1 1.1 0 0 0 1.7.9l11.2-7.2a1.1 1.1 0 0 0 0-1.8L9.1 3.9a1.1 1.1 0 0 0-1.7.9z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" class="f"><rect x="5.8" y="4.4" width="4.4" height="15.2" rx="1.4"/><rect x="13.8" y="4.4" width="4.4" height="15.2" rx="1.4"/></svg>',
    bm:'<svg viewBox="0 0 24 24"><path d="M6.4 4.8a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15.3a.6.6 0 0 1-1 .5L12 16.9l-4.6 3.7a.6.6 0 0 1-1-.5z"/></svg>',
    bmOn:'<svg viewBox="0 0 24 24" class="fs"><path d="M6.4 4.8a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15.3a.6.6 0 0 1-1 .5L12 16.9l-4.6 3.7a.6.6 0 0 1-1-.5z"/></svg>',
    more:'<svg viewBox="0 0 24 24" class="f"><circle cx="5.4" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.6" cy="12" r="1.7"/></svg>',
    check:'<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    plus:'<svg viewBox="0 0 24 24" class="b"><path d="M12 5.2v13.6M5.2 12h13.6"/></svg>',
    x:'<svg viewBox="0 0 24 24" class="b"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    video:'<svg viewBox="0 0 24 24"><rect x="2.8" y="6" width="12.6" height="12" rx="3"/><path d="M15.4 10.6l4.8-2.9a.6.6 0 0 1 .9.5v7.6a.6.6 0 0 1-.9.5l-4.8-2.9"/></svg>',
    next:'<svg viewBox="0 0 24 24"><path d="M3.8 11h12.4M3.8 16h12.4M3.8 6h7"/><path d="M15.4 3.4v5.4a.5.5 0 0 0 .8.4l3.8-2.7a.5.5 0 0 0 0-.8l-3.8-2.7a.5.5 0 0 0-.8.4z"/></svg>',
    last:'<svg viewBox="0 0 24 24"><path d="M3.8 6h12.4M3.8 11h12.4M3.8 16h7"/><path d="M15.4 14.4v5.4a.5.5 0 0 0 .8.4l3.8-2.7a.5.5 0 0 0 0-.8l-3.8-2.7a.5.5 0 0 0-.8.4z"/></svg>',
    share:'<svg viewBox="0 0 24 24"><path d="M12 14.4V3.6"/><path d="M8.2 7l3.1-3.1a1 1 0 0 1 1.4 0L15.8 7"/><path d="M8.6 10.2H7.4a3.2 3.2 0 0 0-3.2 3.2v4.4A3.2 3.2 0 0 0 7.4 21h9.2a3.2 3.2 0 0 0 3.2-3.2v-4.4a3.2 3.2 0 0 0-3.2-3.2h-1.2"/></svg>',
    link:'<svg viewBox="0 0 24 24"><path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l3.2-3.2a3.9 3.9 0 0 0-5.5-5.5l-1.1 1.1"/><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-3.2 3.2a3.9 3.9 0 0 0 5.5 5.5l1.1-1.1"/></svg>',
    refresh:'<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
    circle:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/></svg>',
    done:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M8.2 12.4l2.5 2.5 5.1-5.4"/></svg>',
    podcast:'<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="2.4"/><path d="M12 12.4V21"/><path d="M8 14a5.6 5.6 0 1 1 8 0"/><path d="M5.3 16.8a9.2 9.2 0 1 1 13.4 0"/></svg>',
    headph:'<svg viewBox="0 0 24 24"><path d="M3.8 15.4V12a8.2 8.2 0 0 1 16.4 0v3.4"/><rect x="3.2" y="13.6" width="4.8" height="7" rx="2"/><rect x="16" y="13.6" width="4.8" height="7" rx="2"/></svg>',
    moon:'<svg viewBox="0 0 24 24"><path d="M19.8 14.6A8 8 0 0 1 9.4 4.2a8.2 8.2 0 1 0 10.4 10.4z"/></svg>',
    unfollow:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M8.4 12h7.2"/></svg>',
    sort:'<svg viewBox="0 0 24 24"><path d="M7.4 4.4v15.2M3.8 16l3.6 3.6L11 16M16.6 19.6V4.4M13 8l3.6-3.6L20.2 8"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.2"/><path d="M16.2 16.2l4.3 4.3"/></svg>',
  };
  // Skip buttons: a circular arrow with the seconds inside, as on the iPhone.
  const skipIcon = (n, fwd) => '<svg viewBox="0 0 24 24">' + (fwd
    ? '<path d="M12 3.8a8.6 8.6 0 1 0 7.4 4.2"/><path d="M9.8 1.4l2.4 2.4-2.4 2.4"/>'
    : '<path d="M12 3.8a8.6 8.6 0 1 1-7.4 4.2"/><path d="M14.2 1.4l-2.4 2.4 2.4 2.4"/>')
    + '<text x="12" y="15.7" text-anchor="middle" font-size="7.2" font-weight="700" fill="currentColor" stroke="none" font-family="-apple-system,BlinkMacSystemFont,system-ui,sans-serif">' + esc(n) + '</text></svg>';

  // =====================================================================
  // STATE: localStorage (small things) + IndexedDB (each show's episodes)
  // =====================================================================
  const DEF_SET = {back:15, fwd:30, speed:1, auto:true, cc:'us'};
  const okSnap = e => !!(e && typeof e.k === 'string' && typeof e.u === 'string');
  const S = (function(){
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY)); } catch(e) {}
    v = v && typeof v === 'object' ? v : {};
    const arr = (a, ok) => Array.isArray(a) ? a.filter(ok) : [];
    return {
      follows: arr(v.follows, f => f && typeof f.id === 'string' && typeof f.feed === 'string'),
      prog: v.prog && typeof v.prog === 'object' ? v.prog : {},
      saved: arr(v.saved, okSnap), queue: arr(v.queue, okSnap), hist: arr(v.hist, okSnap),
      now: okSnap(v.now) ? v.now : null,
      set: (s => {
        // The US is the default. The first version defaulted to the UK and
        // saved it, so move those to the US unless the UK was chosen in Settings.
        if (s.cc === 'gb' && !s.ccChosen) s.cc = 'us';
        return s;
      })(Object.assign({}, DEF_SET, v.set && typeof v.set === 'object' ? v.set : {})),
      lastRefresh: +v.lastRefresh || 0, lastClean: +v.lastClean || 0,
      // deleted (an unfollow, an episode unsaved, History cleared): kind:id -> when, for the family's Google Sheet
      graves: v.graves && typeof v.graves === 'object' && !Array.isArray(v.graves) ? v.graves : {}
    };
  })();
  let warned = false;
  // Writes S to this phone. save() also notes what changed for the family's Google Sheet and syncs a moment later.
  function persist(){
    const write = () => localStorage.setItem(KEY, JSON.stringify(S));
    try { write(); }
    catch(e) {
      pruneProg(300);
      try { write(); } catch(e2) { if (!warned) { warned = true; toast('This phone’s storage is full, so some progress may not be kept.'); } }
    }
  }
  function save(){
    const changed = track();
    persist();
    // a playing episode's progress, every ten seconds, is not worth a sync by itself; pausing is
    const ticking = cur && !player.paused && changed.every(k => k === 'prog:' + cur.k);
    if (changed.length && !ticking && signedIn()) scheduleSync();
  }
  // Progress: {t: seconds in, d: length, p: played, at: when, e: the episode
  // (kept only while it's part-played, for Up Next), updated}. Trimmed to the
  // newest: what's dropped is only forgotten here (no grave: the Sheet keeps it).
  function pruneProg(keep){
    const ents = Object.entries(S.prog).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    ents.slice(keep).forEach(([k]) => shadow.delete('prog:' + k));
    S.prog = Object.fromEntries(ents.slice(0, keep));
  }

  const idb = (function(){
    let dbp = null;
    // After design.js has moved the old Podcasts Vintage app's databases over (at its old address, once), so they aren't made empty first
    const open = () => dbp || (dbp = Promise.resolve(window.aosDesign && aosDesign.moved).then(() => new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('No IndexedDB'));
      const r = indexedDB.open('allison-podcasts', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('shows');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    })));
    const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction('shows', mode), req = fn(tx.objectStore('shows'));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    }));
    return {
      get: k => run('readonly', s => s.get(k)).catch(() => undefined),
      put: (k, v) => run('readwrite', s => s.put(v, k)).catch(() => {}),
      // Walks every stored show; fn returns true to delete it.
      sweep: fn => open().then(db => new Promise(res => {
        const tx = db.transaction('shows', 'readwrite'), c = tx.objectStore('shows').openCursor();
        c.onsuccess = () => { const cur = c.result; if (!cur) return; if (fn(cur.key, cur.value)) cur.delete(); cur.continue(); };
        tx.oncomplete = tx.onerror = tx.onabort = res;
      })).catch(() => {})
    };
  })();

  const shows = new Map();    // show id -> {id, feed, title, author, art, itArt, desc, link, genre, eps, at}
  const epIdx = new Map();    // episode key -> episode
  const followOf = id => S.follows.find(f => f.id === id) || null;
  const isFollowed = id => !!followOf(id);
  // Apple's artwork (600px) where we have it, as feeds' own can be huge.
  const artFor = sh => { const f = followOf(sh.id); return (f && f.art) || sh.itArt || sh.art || ''; };
  function adopt(sh){
    const art = artFor(sh);
    for (const e of sh.eps) { e.st = sh.title; e.sa = art; e.feed = sh.feed; epIdx.set(e.k, e); }
    shows.set(sh.id, sh);
    return sh;
  }
  async function ensureShow(id){
    if (shows.has(id)) return shows.get(id);
    const sh = await idb.get(id);
    return sh && Array.isArray(sh.eps) ? adopt(sh) : null;
  }
  function getEp(k){
    return epIdx.get(k) || [S.now, ...S.queue, ...S.saved, ...S.hist].find(x => x && x.k === k) || (S.prog[k] && S.prog[k].e) || null;
  }
  async function fullEp(e){
    if (e.h != null) return e;
    const sh = await ensureShow(e.sid);
    return (sh && sh.eps.find(x => x.k === e.k)) || e;
  }
  // What's kept of an episode outside its show: enough to list and play it.
  const snap = e => ({k:e.k, sid:e.sid, t:e.t, d:e.d, u:e.u, v:!!e.v, dur:e.dur || 0, img:e.img || '', st:e.st || '', sa:e.sa || '', feed:e.feed || '', link:e.link || '', s:(e.s || '').slice(0, 300), sn:e.sn || 0, en:e.en || 0, x:e.x || ''});

  // =====================================================================
  // SMALL HELPERS
  // =====================================================================
  // Only web addresses. Pictures and episodes load over https: a page on
  // https can't load them over http anyway.
  function webUrl(u, upgrade){
    if (!u) return '';
    try {
      const x = new URL(String(u).trim());
      if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
      if (upgrade) x.protocol = 'https:';
      return x.href;
    } catch(e) { return ''; }
  }
  const media = u => webUrl(u, true);
  function hash(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  const showId = feed => 's' + hash(String(feed).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, ''));
  function secs(v){
    v = String(v || '').trim();
    if (!v) return 0;
    if (/^\d+(\.\d+)?$/.test(v)) return Math.round(+v);
    const p = v.split(':').map(Number);
    return p.some(isNaN) ? 0 : Math.round(p.reduce((a, b) => a * 60 + b, 0));
  }
  function clock(s){
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
  }
  function len(s){
    s = Math.round(s || 0);
    if (s < 60) return s + ' sec';
    const m = Math.round(s / 60), h = Math.floor(m / 60);
    return h ? h + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
  }
  function day(ms){
    if (!ms) return '';
    const d = new Date(ms), n = new Date(), mid = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((mid(n) - mid(d)) / DAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff > 1 && diff < 7) return d.toLocaleDateString([], {weekday:'long'});
    return d.toLocaleDateString([], {day:'numeric', month:'short', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric'});
  }
  function ago(ms){
    const m = Math.round((Date.now() - ms) / MIN);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 24 * 60 ? Math.round(m / 60) + ' hr ago' : day(ms);
  }
  function epNum(e){
    const x = e.x === 'trailer' ? 'Trailer' : e.x === 'bonus' ? 'Bonus' : '';
    const n = e.sn && e.en ? 'S' + e.sn + ' E' + e.en : e.en ? 'Episode ' + e.en : '';
    return [n, x].filter(Boolean).join(' · ');
  }
  const art = (src, size, cls) => '<span class="art' + (cls ? ' ' + cls : '') + '"' + (size ? ' style="--s:' + size + 'px"' : '') + '>'
    + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>';
  // A picture that fails to load leaves the coloured tile behind it.
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.parentElement && t.parentElement.classList.contains('art')) t.remove(); }, true);
  async function pool(items, n, fn){
    let i = 0;
    const worker = async () => { while (i < items.length) { const it = items[i++]; try { await fn(it); } catch(e) {} } };
    await Promise.all(Array.from({length: Math.min(n, items.length)}, worker));
  }
  function plain(html){
    html = String(html || '');
    if (!/[<&]/.test(html)) return html.replace(/\s+/g, ' ').trim();
    const d = new DOMParser().parseFromString(html.slice(0, 4000), 'text/html');   // inert: nothing runs or loads
    return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // =====================================================================
  // WHAT SYNCS WITH THE FAMILY'S GOOGLE SHEET (the syncing itself is near the end)
  // Four kinds, each item with an id and `updated` (stamped on any change), and
  // a grave (S.graves, kind:id -> when) for anything deleted, so your other
  // phones delete it too (as in Fitness):
  //   shows  what you follow (S.follows; id: the show's id)
  //   saved  your saved episodes (S.saved; id: the episode's key k; at: when saved)
  //   hist   History (S.hist; id: k; pl: when you played it)
  //   prog   where you got to, and what's played (S.prog; id: k)
  // hist and prog are dated (date: the day played, or last listened). Once
  // synced, the phone keeps the last 90 days of History (at most 100) and asks
  // the Sheet for older; what's played stays on the phone however old (at most
  // 3000), so an old episode doesn't look new again, but only its last 90 days
  // come from the Sheet. Shows' episode lists, Up Next, what's playing and
  // Settings stay on each phone.
  // =====================================================================
  const KEEP_DAYS = 90, HIST_MAX = 100;
  const pad2 = n => String(n).padStart(2, '0');
  const ymd = ms => { if (!(ms > 0)) return ''; const d = new Date(ms); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d.getTime()); };
  const today = () => ymd(Date.now());
  const SK = {cfg: KEY + '-sheet', at: KEY + '-sync-at', synced: KEY + '-synced'};
  const lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch(e) {} };
  const signedIn = () => !!(window.AllisonOS && AllisonOS.account && AllisonOS.account.token());
  // Synced with the family Sheet at least once: from then on the phone keeps 90 days of History.
  let synced = lsGet(SK.synced) === '1';
  const pruneFrom = () => synced ? addDays(today(), -(KEEP_DAYS - 1)) : null;
  // Older History fetched from the Sheet this session (kind:id), kept until the next tidy-up.
  const older = new Set();
  let olderFrom = null, olderEnd = false, olderBusy = false;
  const str = v => String(v == null ? '' : v);
  // An episode from the Sheet, as the app keeps one: only web links, as from a feed.
  const epIn = r => snap({k: r.id, sid: str(r.sid || r.id.split('|')[0]), t: str(r.t), d: +r.d || 0, u: media(r.u), v: !!r.v, dur: +r.dur || 0, img: media(r.img),
    st: str(r.st), sa: media(r.sa), feed: webUrl(r.feed), link: webUrl(r.link), s: str(r.s), sn: +r.sn || 0, en: +r.en || 0, x: str(r.x)});
  const okEp = r => typeof r.u === 'string';
  const byNewest = f => (a, b) => (f(b[1]) || 0) - (f(a[1]) || 0);
  // Each kind: its items as [id, the object the app keeps]; what's sent of one (out: never `updated`, which
  // goes beside it); one from the Sheet made into the app's (in, given this phone's own copy, if any); and
  // putting a merged list back.
  const SYNC = {
    shows: {
      items: () => S.follows.map(f => [f.id, f]),
      out: (id, f) => ({id, feed: f.feed, title: f.title || '', author: f.author || '', art: f.art || '', genre: f.genre || '', at: f.at || 0}),
      ok: r => !!webUrl(r.feed),
      // when its newest episode came out, and an error loading it, are this phone's own
      in: (r, l) => ({id: r.id, feed: webUrl(r.feed), title: str(r.title), author: str(r.author), art: media(r.art), genre: str(r.genre), at: +r.at || 0,
        latest: (l && l.latest) || 0, err: (l && l.err) || '', updated: +r.updated || 0}),
      set: list => { S.follows = list.sort(byNewest(f => f.at)).map(x => x[1]); }
    },
    saved: {
      items: () => S.saved.map(e => [e.k, e]),
      out: (id, e) => Object.assign({id}, snap(e), {at: e.at || 0}),
      ok: okEp,
      in: r => Object.assign(epIn(r), {at: +r.at || 0, updated: +r.updated || 0}),
      set: list => { S.saved = list.sort(byNewest(e => e.at)).map(x => x[1]); }
    },
    hist: {
      dated: true, day: e => ymd(e.pl),
      items: () => S.hist.map(e => [e.k, e]),
      out: (id, e) => Object.assign({id}, snap(e), {pl: e.pl || 0, date: ymd(e.pl)}),
      ok: okEp,
      in: r => Object.assign(epIn(r), {pl: +r.pl || 0, updated: +r.updated || 0}),
      set: list => { S.hist = list.sort(byNewest(e => e.pl)).map(x => x[1]); capHist(); }
    },
    prog: {
      dated: true, keepAll: true, day: p => ymd(p.at),
      items: () => Object.entries(S.prog).filter(([, p]) => p && typeof p === 'object'),
      out: (id, p) => { const o = {id, t: p.t || 0, d: p.d || 0, p: !!p.p, at: p.at || 0, date: ymd(p.at)}; if (p.e) o.e = snap(p.e); return o; },
      ok: () => true,
      in: r => {
        const p = {t: +r.t || 0, d: +r.d || 0, at: +r.at || 0, updated: +r.updated || 0};
        if (r.p) p.p = true;
        if (r.e && typeof r.e === 'object' && typeof r.e.k === 'string') p.e = epIn(Object.assign({}, r.e, {id: r.e.k}));
        return p;
      },
      set: list => { S.prog = Object.fromEntries(list); }
    }
  };
  // History keeps its newest 100 (and what was fetched from the Sheet this session); the rest is only
  // forgotten here, with no grave: the Sheet keeps it.
  function capHist(){
    let n = 0;
    S.hist = S.hist.filter(e => { if (older.has('hist:' + e.k) || n++ < HIST_MAX) return true; shadow.delete('hist:' + e.k); return false; });
  }
  // What each item looked like at the last save (as in Fitness and Travel): a change stamps `updated`, and a
  // gone one leaves a grave.
  const shadow = new Map();
  function initShadow(){
    shadow.clear();
    for (const kind in SYNC) for (const [id, o] of SYNC[kind].items()) {
      if (!o.updated) o.updated = 1;
      shadow.set(kind + ':' + id, JSON.stringify(SYNC[kind].out(id, o)));
    }
  }
  function track(){
    const now = Date.now(), have = new Set(), changed = [];
    for (const kind in SYNC) for (const [id, o] of SYNC[kind].items()) {
      const k = kind + ':' + id, j = JSON.stringify(SYNC[kind].out(id, o));
      have.add(k);
      if (shadow.get(k) !== j || !o.updated) { o.updated = now; shadow.set(k, j); delete S.graves[k]; changed.push(k); }
    }
    shadow.forEach((j, k) => { if (!have.has(k)) { S.graves[k] = now; shadow.delete(k); changed.push(k); } });
    return changed;
  }
  // From before the Sheet was the record: when each saved episode was saved and each History one played (its
  // progress's time, else when it came out), in the lists' order; and graves over 400 days old go.
  S.saved.forEach((e, i) => { if (!(e.at > 0)) e.at = Date.now() - i * 1000; });
  S.hist.forEach((e, i) => { if (!(e.pl > 0)) e.pl = (S.prog[e.k] && S.prog[e.k].at) || e.d || Date.now() - i * 1000; });
  Object.keys(S.graves).forEach(k => { if (!(Date.now() - S.graves[k] < 400 * DAY)) delete S.graves[k]; });
  if (Object.keys(S.prog).length > 3000) pruneProg(3000);
  initShadow();

  // =====================================================================
  // FEEDS
  // =====================================================================
  // ../podcasts/api/ is the Pages Function beside this app, named from the site root's side so it is the
  // same from the old Podcasts Vintage address, which opens this same app (../home/design.js). Where it isn't (GitHub
  // Pages, a local server) the answer is a 404 or an HTML page, and the app
  // goes straight to the feed for the rest of the session.
  let apiGone = false;
  // bg: a call nobody tapped for (the refresh on open and its timer, the Top shows chart): signed out, the
  // 401 comes back as 'signin' with no sign-in sheet, and the app shows what it has. A tap (Search, a show,
  // Refresh, Check for New Episodes) asks for Face ID.
  async function api(path, bg){
    if (apiGone) throw new Error('noapi');
    let r;
    // signed in to the family where accounts are on (the route only answers family): the session goes with it
    const A = window.AllisonOS && AllisonOS.account && AllisonOS.account.fetch, opts = {headers:{'X-Podcasts':'1'}, cache:'no-store', credentials:'same-origin'};
    try { r = await (A ? A('../podcasts/api/' + path, opts, {quiet: !!bg}) : fetch('../podcasts/api/' + path, opts)); }
    catch(e) { throw new Error('offline'); }
    const ct = r.headers.get('Content-Type') || '';
    if (r.status === 404 || r.status === 405 || /html/i.test(ct)) { apiGone = true; throw new Error('noapi'); }
    if (r.status === 401) throw new Error('signin');
    if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch(e) {} throw new Error(m || 'The feed couldn’t be loaded.'); }
    return r;
  }
  const quiet = m => m === 'noapi' || m === 'offline' || m === 'signin';
  async function fetchFeed(url, bg){
    try { return await (await api('feed?url=' + encodeURIComponent(url), bg)).text(); }
    catch(e) {
      try { const r = await fetch(media(url), {cache:'no-store', credentials:'omit'}); if (r.ok) return await r.text(); } catch(_) {}
      if (navigator.onLine === false) throw new Error('You’re offline.');
      throw new Error(quiet(e.message) ? 'This show’s feed can’t be read from here.' : e.message);
    }
  }

  const NS_IT = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
  // A child element by name: kid(item, 'title') for <title>,
  // kid(item, 'duration', 'itunes') for <itunes:duration>.
  function kid(el, name, pre){
    for (const c of el.children) {
      if (c.localName !== name) continue;
      if (pre ? (c.prefix === pre || (pre === 'itunes' && c.namespaceURI === NS_IT)) : !c.prefix) return c;
    }
    return null;
  }
  const txt = (el, name, pre) => { const c = kid(el, name, pre); return c ? c.textContent.trim() : ''; };
  const att = (el, name, pre, a) => { const c = kid(el, name, pre); return c ? (c.getAttribute(a) || '').trim() : ''; };
  const entities = new Map();
  function htmlEntity(n){
    if (!entities.has(n)) {
      const c = new DOMParser().parseFromString('&' + n + ';', 'text/html').body.textContent;
      entities.set(n, c === '&' + n + ';' ? '&amp;' + n + ';' : [...c].map(ch => '&#' + ch.codePointAt(0) + ';').join(''));
    }
    return entities.get(n);
  }
  function parseXml(text){
    text = String(text).replace(/^[\s﻿]+/, '');
    const P = new DOMParser();
    let doc = P.parseFromString(text, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      // HTML names like &nbsp; aren't XML; many feeds use them anyway. Turn
      // them into numbered ones, and any other stray & into &amp;.
      text = text.replace(/&([a-z][a-z\d]*);/gi, (m, n) => /^(amp|lt|gt|quot|apos)$/.test(n) ? m : htmlEntity(n))
        .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, '&amp;');
      doc = P.parseFromString(text, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('This feed couldn’t be read.');
    }
    return doc;
  }
  function parseFeed(text, sid){
    const doc = parseXml(text), ch = doc.getElementsByTagName('channel')[0];
    if (!ch) throw new Error('That isn’t a podcast feed.');
    const img = kid(ch, 'image');
    const out = {
      title: txt(ch, 'title') || txt(ch, 'title', 'itunes') || 'Untitled show',
      author: txt(ch, 'author', 'itunes') || txt(ch, 'managingEditor'),
      art: media(att(ch, 'image', 'itunes', 'href') || (img ? txt(img, 'url') : '')),
      desc: (txt(ch, 'description') || txt(ch, 'summary', 'itunes')).slice(0, 6000),
      link: webUrl(txt(ch, 'link')),
      genre: att(ch, 'category', 'itunes', 'text'),
      newFeed: webUrl(txt(ch, 'new-feed-url', 'itunes')),
      eps: []
    };
    const seen = new Set();
    for (const it of ch.children) {
      if (it.localName !== 'item' || it.prefix) continue;
      const enc = kid(it, 'enclosure');
      let u = enc ? enc.getAttribute('url') : '', ty = enc ? (enc.getAttribute('type') || '') : '';
      if (!u) {
        const mc = [...it.children].find(c => c.localName === 'content' && c.prefix === 'media' && c.getAttribute('url'));
        if (mc) { u = mc.getAttribute('url'); ty = mc.getAttribute('type') || (mc.getAttribute('medium') === 'video' ? 'video/mp4' : ''); }
      }
      u = media(u);
      if (!u) continue;
      const v = /^video\//i.test(ty) || (!/^audio\//i.test(ty) && /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(u));
      const g = (txt(it, 'guid') || u).slice(0, 300), k = sid + '|' + g;
      if (seen.has(k)) continue;
      seen.add(k);
      const h = (txt(it, 'encoded', 'content') || txt(it, 'description') || txt(it, 'summary', 'itunes')).slice(0, 12000);
      out.eps.push({
        k, sid, g, u, v,
        t: txt(it, 'title') || txt(it, 'title', 'itunes') || 'Untitled episode',
        d: Date.parse(txt(it, 'pubDate')) || Date.parse(txt(it, 'date', 'dc')) || 0,
        dur: secs(txt(it, 'duration', 'itunes')),
        img: media(att(it, 'image', 'itunes', 'href')),
        link: webUrl(txt(it, 'link')),
        sn: parseInt(txt(it, 'season', 'itunes'), 10) || 0,
        en: parseInt(txt(it, 'episode', 'itunes'), 10) || 0,
        x: txt(it, 'episodeType', 'itunes').toLowerCase(),
        h, s: ''
      });
    }
    out.eps.sort((a, b) => b.d - a.d);
    out.eps = out.eps.slice(0, MAX_EPS);
    for (const e of out.eps) e.s = plain(e.h).slice(0, 300);
    return out;
  }

  async function loadShow(feed, id, meta, bg){
    const p = parseFeed(await fetchFeed(feed, bg), id);
    const old = shows.get(id), f = followOf(id);
    const sh = {id, feed: p.newFeed || feed, title: p.title, author: p.author, art: p.art,
      itArt: (meta && meta.art) || (old && old.itArt) || '', desc: p.desc, link: p.link,
      genre: p.genre || (meta && meta.genre) || (old && old.genre) || '', eps: p.eps, at: Date.now()};
    if (f) { f.title = sh.title; f.author = sh.author; f.feed = sh.feed; f.latest = sh.eps[0] ? sh.eps[0].d : 0; f.err = ''; if (!f.art) f.art = sh.itArt || sh.art; save(); }
    adopt(sh);
    idb.put(id, sh);
    return sh;
  }

  let refreshing = false;
  async function refreshAll(manual){
    if (refreshing) return;
    if (!S.follows.length) { if (manual) toast('Follow a show first.'); return; }
    refreshing = true;
    $('refreshBtn').classList.add('busy');
    syncPill('run', 'Checking for new episodes');
    let fresh = 0, failed = 0;
    await pool([...S.follows], 4, async f => {
      const had = shows.get(f.id), newest = had && had.eps[0] ? had.eps[0].d : (f.latest || 0);
      try {
        const sh = await loadShow(f.feed, f.id, undefined, !manual);
        if (newest) fresh += sh.eps.filter(e => e.d > newest).length;
      } catch(e) { failed++; f.err = e.message || 'Couldn’t update'; }
    });
    S.lastRefresh = Date.now(); save();
    refreshing = false;
    $('refreshBtn').classList.remove('busy');
    syncPill('done', fresh ? fresh + (fresh === 1 ? ' new episode' : ' new episodes') : failed ? failed + (failed === 1 ? ' show couldn’t be checked' : ' shows couldn’t be checked') : 'Up to date');
    render();
  }
  let pillTimer = 0;
  function syncPill(state, text){
    const p = $('syncPill');
    clearTimeout(pillTimer);
    $('syncPillTxt').textContent = text;
    p.classList.remove('out');
    p.classList.toggle('done', state === 'done');
    p.hidden = false;
    if (state === 'done') pillTimer = setTimeout(() => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); }, 1600);
  }

  // Apple's directory: search, and the top shows chart.
  const itShow = r => ({title: r.collectionName || r.trackName || '', author: r.artistName || '', feed: r.feedUrl || '',
    art: media(r.artworkUrl600 || r.artworkUrl100 || ''), genre: r.primaryGenreName || ''});
  const cleanShow = r => ({title: String(r.title || ''), author: String(r.author || ''), feed: webUrl(r.feed), art: media(r.art), genre: String(r.genre || '')});
  async function directory(path, direct, bg){
    try { return ((await (await api(path, bg)).json()).results || []).map(cleanShow); }
    catch(e) {
      if (!quiet(e.message)) throw e;
      // Apple's own addresses, where they let a page read them
      try { return (await direct()).map(cleanShow); } catch(_) { throw new Error('Search isn’t available right now.'); }
    }
  }
  const itJson = async u => { const r = await fetch(u, {credentials:'omit'}); if (!r.ok) throw new Error('Search isn’t available right now.'); return r.json(); };
  const searchShows = term => directory('search?cc=' + S.set.cc + '&term=' + encodeURIComponent(term), async () =>
    ((await itJson('https://itunes.apple.com/search?media=podcast&entity=podcast&limit=30&country=' + S.set.cc + '&term=' + encodeURIComponent(term))).results || []).map(itShow));
  const topShows = () => directory('top?cc=' + S.set.cc, async () => {   // loaded on its own as the Search tab opens: no sign-in sheet for it
    const chart = await itJson('https://rss.applemarketingtools.com/api/v2/' + S.set.cc + '/podcasts/top/50/podcasts.json');
    const ids = ((chart.feed && chart.feed.results) || []).map(r => r.id);
    const look = await itJson('https://itunes.apple.com/lookup?entity=podcast&country=' + S.set.cc + '&id=' + ids.join(','));
    const by = new Map((look.results || []).map(r => [String(r.collectionId), itShow(r)]));
    return ids.map(id => by.get(String(id))).filter(Boolean);
  }, true);

  // =====================================================================
  // FOLLOWING, SAVED, UP NEXT, PLAYED
  // =====================================================================
  function follow(meta){
    const feed = webUrl(meta.feed);
    if (!feed) return;
    const id = showId(feed);
    if (isFollowed(id)) return;
    const sh = shows.get(id);
    S.follows.unshift({id, feed: sh ? sh.feed : feed, title: meta.title || (sh && sh.title) || '', author: meta.author || (sh && sh.author) || '',
      art: meta.art || (sh && (sh.itArt || sh.art)) || '', genre: meta.genre || '', at: Date.now(), latest: sh && sh.eps[0] ? sh.eps[0].d : 0});
    save();
    toast('Following ' + (meta.title || (sh && sh.title) || 'this show'));
    if (sh) adopt(sh);
    else loadShow(feed, id, meta).then(render, e => { const f = followOf(id); if (f) { f.err = e.message; save(); } render(); });
    render();
  }
  function unfollow(id){
    const i = S.follows.findIndex(f => f.id === id);
    if (i < 0) return;
    const f = S.follows.splice(i, 1)[0];
    save(); render();
    toast('Unfollowed ' + (f.title || 'show'), () => { S.follows.splice(i, 0, f); save(); render(); });
  }
  const isSaved = k => S.saved.some(x => x.k === k);
  function toggleSave(k){
    const e = getEp(k);
    if (!e) return;
    if (isSaved(k)) { S.saved = S.saved.filter(x => x.k !== k); toast('Removed from Saved'); }
    else { S.saved.unshift(Object.assign(snap(e), {at: Date.now()})); toast('Saved'); }
    save(); render();
  }
  const inQueue = k => S.queue.some(x => x.k === k);
  function queue(e, next){
    S.queue = S.queue.filter(x => x.k !== e.k);
    if (next) S.queue.unshift(snap(e)); else S.queue.push(snap(e));
    save(); render();
    toast(next ? 'Plays next' : 'Added to Up Next');
  }
  const unqueue = k => { S.queue = S.queue.filter(x => x.k !== k); save(); render(); };
  const isPlayed = k => !!(S.prog[k] && S.prog[k].p);
  function markPlayed(k, on){
    const p = S.prog[k];
    if (on) { S.prog[k] = {p:true, t:0, d:(p && p.d) || 0, at:Date.now()}; S.queue = S.queue.filter(x => x.k !== k); }
    else delete S.prog[k];
    save(); render();
  }
  const resumeAt = e => { const p = S.prog[e.k]; return p && !p.p && p.t > 2 ? Math.max(0, p.t - 2) : 0; };

  // Up Next, as on the iPhone: what's playing, your queue, what you're part
  // way through, then the newest unplayed episode of each show you follow.
  function upNext(){
    const out = [], seen = new Set();
    const add = e => { if (e && !seen.has(e.k) && !isPlayed(e.k)) { seen.add(e.k); out.push(e); } };
    if (cur) add(getEp(cur.k) || cur);
    S.queue.forEach(x => add(getEp(x.k) || x));
    Object.entries(S.prog).filter(([, p]) => p && !p.p && p.t > 0).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 12)
      .forEach(([k, p]) => add(getEp(k) || p.e));
    const since = Date.now() - 45 * DAY;
    S.follows.map(f => shows.get(f.id)).filter(Boolean)
      .map(sh => sh.eps.find(e => e.x !== 'trailer')).filter(e => e && e.d > since && !S.prog[e.k])
      .sort((a, b) => b.d - a.d).forEach(add);
    return out.slice(0, 16);
  }
  function newEpisodes(){
    const all = [];
    S.follows.forEach(f => { const sh = shows.get(f.id); if (sh) all.push(...sh.eps.slice(0, 40)); });
    return all.sort((a, b) => b.d - a.d);
  }

  // =====================================================================
  // RENDERING
  // =====================================================================
  const st = {tab:'home', lib:'shows', newFilter:'all', newLimit:30, q:'', results:null, searching:false, searchErr:'',
    top:null, topErr:'', topCc:'', show:null, showMeta:null, showErr:'', showFilter:'all', showSort:'new', showLimit:40, descOpen:false, scroll:{}};
  try { const t = localStorage.getItem(KEY + '-tab'); if (t === 'lib' || t === 'search') st.tab = t; const l = localStorage.getItem(KEY + '-lib'); if (l === 'saved' || l === 'hist') st.lib = l; } catch(e) {}

  function pill(e, big){
    const p = S.prog[e.k], isCur = cur && cur.k === e.k, on = isCur && !player.paused;
    const d = (p && p.d) || e.dur;
    let label, pct = 0, cls = '';
    if (p && p.p && !isCur) { label = 'Played'; cls = ' done'; }
    else if (p && p.t > 0 && d) { label = len(Math.max(0, d - p.t)) + ' left'; pct = Math.min(100, p.t / d * 100); }
    else label = d ? len(d) : 'Play';
    return '<button class="playpill' + cls + (big ? ' big' : '') + '" type="button" data-play="' + esc(e.k) + '" aria-label="' + (on ? 'Pause' : 'Play') + ', ' + esc(label) + '">'
      + (cls ? I.check : on ? I.pause : I.play)
      + (pct ? '<span class="pbar"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '')
      + '<span>' + esc(label) + '</span></button>';
  }
  function epRow(e, withArt, i){
    const p = S.prog[e.k], played = !!(p && p.p), fresh = !p && e.d > Date.now() - 14 * DAY;
    const rest = [esc(day(e.d)), esc(epNum(e)), e.v ? I.video : ''].filter(Boolean).join(' · ');
    const meta = (withArt && e.st ? '<span translate="no">' + esc(e.st) + (rest ? ' · ' : '') + '</span>' : '') + rest;
    const saved = isSaved(e.k);
    return '<article class="ep' + (played ? ' played' : '') + '" style="--i:' + (i || 0) + '">'
      + '<button class="epmain" type="button" data-ep="' + esc(e.k) + '">' + (withArt ? art(e.sa, 56) : '')
      + '<span class="eptx"><span class="epm">' + (fresh ? '<i class="dot" aria-label="New"></i>' : '') + meta + '</span>'
      + '<span class="ept" translate="no">' + esc(e.t) + '</span>' + (e.s ? '<span class="epd" translate="no">' + esc(e.s) + '</span>' : '') + '</span></button>'
      + '<div class="epbar">' + pill(e) + '<span class="grow"></span>'
      + '<button class="icbtn" type="button" data-save="' + esc(e.k) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove from Saved' : 'Save episode') + '">' + (saved ? I.bmOn : I.bm) + '</button>'
      + '<button class="icbtn" type="button" data-more="' + esc(e.k) + '" aria-label="More for this episode">' + I.more + '</button></div></article>';
  }
  const upCard = (e, i) => '<article class="upcard glass" style="--i:' + i + '"><button class="uptop" type="button" data-ep="' + esc(e.k) + '">' + art(e.sa, 64)
    + '<span class="uptx" translate="no"><span class="upm">' + esc(e.st) + '</span><span class="upt">' + esc(e.t) + '</span></span></button>'
    + '<div class="upbar">' + pill(e) + '<span class="upd">' + esc(day(e.d)) + '</span></div></article>';
  const chip = (act, label, on, n) => '<button class="chip glass" type="button" data-act="' + act + '" aria-pressed="' + !!on + '">' + label + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</button>';
  const emptyCard = (title, text, btn) => '<div class="empty glass">' + I.headph + '<strong>' + title + '</strong>' + (text ? '<span>' + text + '</span>' : '') + (btn || '') + '</div>';
  // A row of filter chips where one is chosen: its thumb (a new show's jumps).
  const slideChips = (el, key, opt) => { const c = el.querySelector('.chips'); if (c) slide(c, c.querySelector('.chip[aria-pressed="true"]:not([data-act="sort"])'), key, opt); };
  function animateIn(el){ el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  function renderHome(){
    $('homeSub').textContent = S.follows.length && S.lastRefresh ? 'Checked ' + ago(S.lastRefresh) : '';
    $('refreshBtn').hidden = !S.follows.length;
    const up = upNext();
    let h = '';
    if (up.length) h += '<section><p class="sechead">Up Next</p><div class="shelf">' + up.map(upCard).join('') + '</div></section>';
    if (!S.follows.length) {
      h += emptyCard('Find something to listen to', 'Follow a show to see its new episodes.',
        '<button class="btn" type="button" data-act="go-search">' + I.search + 'Search podcasts</button>');
    } else {
      const all = newEpisodes(), hasVideo = all.some(e => e.v);
      const list = all.filter(e => st.newFilter === 'unplayed' ? !isPlayed(e.k) : st.newFilter === 'video' ? e.v : true);
      h += '<section><p class="sechead">New Episodes</p><div class="chips">' + chip('new:all', 'All', st.newFilter === 'all') + chip('new:unplayed', 'Unplayed', st.newFilter === 'unplayed')
        + (hasVideo ? chip('new:video', I.video + 'Video', st.newFilter === 'video') : '') + '</div>';
      if (!all.length && !refreshing && S.follows.every(f => f.err)) h += '<div class="notice glass"><span>' + esc(S.follows[0].err) + '</span><button class="linkbtn" type="button" data-act="refresh">Try again</button></div>';
      else if (!all.length) h += '<div class="skel"></div><div class="skel"></div>';
      else if (!list.length) h += '<div class="empty glass"><span>Nothing here.</span></div>';
      else {
        h += '<div class="rgroup glass">' + list.slice(0, st.newLimit).map((e, i) => epRow(e, true, i)).join('') + '</div>';
        if (list.length > st.newLimit) h += '<button class="morebtn" type="button" data-act="new-more">Show more</button>';
      }
      h += '</section>';
    }
    $('homeBody').innerHTML = h;
    slideChips($('homeBody'), 'new');
  }

  function renderLib(){
    const tabs = [['shows', 'Shows', S.follows.length], ['saved', 'Saved', S.saved.length], ['hist', 'History', null]];
    $('libChips').innerHTML = tabs.map(([id, label, n]) => chip('lib:' + id, label, st.lib === id, n || null)).join('');
    slideChips($('libView'), 'lib');
    $('libSub').textContent = '';
    let h = '';
    if (st.lib === 'saved') {
      const eps = S.saved.map(x => getEp(x.k) || x);
      h = eps.length ? '<div class="rgroup glass">' + eps.map((e, i) => epRow(e, true, i)).join('') + '</div>'
        : emptyCard('No saved episodes', 'Tap an episode’s bookmark to save it.');
    } else if (st.lib === 'hist') {
      const eps = S.hist.map(x => getEp(x.k) || x);
      // older than the 90 days this phone keeps: from the family's Google Sheet, a year at a time
      const more = synced && signedIn() && !olderEnd ? '<button class="morebtn" type="button" data-act="hist-older"' + (olderBusy ? ' disabled' : '') + '>' + (olderBusy ? 'Loading…' : 'Show older') + '</button>' : '';
      h = eps.length ? '<div class="rgroup glass">' + eps.map((e, i) => epRow(e, true, i)).join('') + '</div>' + more + '<button class="morebtn" type="button" data-act="hist-clear">Clear history</button>'
        : emptyCard('Nothing played yet', '') + more;
    } else if (!S.follows.length) {
      h = emptyCard('No shows yet', '',
        '<button class="btn" type="button" data-act="go-search">' + I.search + 'Search podcasts</button>');
    } else {
      const list = [...S.follows].sort((a, b) => (b.latest || 0) - (a.latest || 0) || (b.at || 0) - (a.at || 0));
      h = '<div class="sgrid">' + list.map((f, i) => {
        const sh = shows.get(f.id), title = f.title || (sh && sh.title) || 'Loading…';
        return '<button class="stile" type="button" data-show="' + esc(f.id) + '" style="--i:' + i + '">' + art(f.art || (sh && (sh.itArt || sh.art)), 0, 'fill')
          + '<span class="sn"' + (f.title || sh ? ' translate="no"' : '') + '>' + esc(title) + '</span>'
          + (f.err && !sh ? '<span class="sm err">Couldn’t load</span>' : '<span class="sm">' + esc(f.latest ? day(f.latest) : '') + '</span>') + '</button>';
      }).join('') + '</div>';
    }
    $('libBody').innerHTML = h;
  }

  const looksLikeFeed = q => /^(https?:\/\/|feed:\/\/|www\.)\S+$/i.test(q) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(q);
  const feedFromInput = q => webUrl(q.replace(/^feed:\/\//i, 'https://').replace(/^(?!https?:\/\/)/i, 'https://'));
  function srow(r, i, rank){
    const id = r.feed ? showId(r.feed) : '', on = id && isFollowed(id);
    return '<div class="srow" style="--i:' + i + '"><button class="sopen" type="button" data-res="' + i + '"' + (r.feed ? '' : ' disabled') + '>'
      + (rank ? '<span class="rank">' + rank + '</span>' : '') + art(r.art, 56)
      + '<span class="stx"><b' + (r.open ? '' : ' translate="no"') + '>' + esc(r.title) + '</b><span' + (r.feed ? ' translate="no"' : '') + '>' + esc(r.feed ? [r.author, r.genre].filter(Boolean).join(' · ') : 'Only on Apple Podcasts') + '</span></span></button>'
      + '<button class="fbtn" type="button" data-fres="' + i + '" aria-pressed="' + !!on + '" aria-label="' + (on ? 'Following ' : 'Follow ') + esc(r.title) + '"' + (r.feed ? '' : ' disabled') + '>' + (on ? I.check : I.plus) + '</button></div>';
  }
  const CC = {us:'the US', gb:'the UK', ie:'Ireland', ca:'Canada', au:'Australia', nz:'New Zealand'};
  function renderSearch(){
    const q = st.q.trim();
    $('qClear').hidden = !st.q;
    let h = '';
    if (!q) {
      st.list = st.top || [];
      h += '<section><p class="sechead">Top shows in ' + esc(CC[S.set.cc] || 'the US') + '</p>';
      if (st.topErr) h += '<div class="notice glass"><span>' + esc(st.topErr) + '</span><button class="linkbtn" type="button" data-act="top-retry">Try again</button></div>';
      else if (!st.top) h += '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
      else if (!st.top.length) h += '<div class="empty glass"><span>No chart right now.</span></div>';
      else h += '<div class="rgroup glass">' + st.top.map((r, i) => srow(r, i, i + 1)).join('') + '</div>';
      h += '</section>';
    } else if (looksLikeFeed(q)) {
      st.list = [{title: 'Open this feed', author: feedFromInput(q), feed: feedFromInput(q), art: '', genre: '', open: true}];
      h = '<div class="rgroup glass">' + srow(st.list[0], 0) + '</div>';
    } else if (st.searchErr) {
      h = '<div class="notice glass"><span>' + esc(st.searchErr) + '</span><button class="linkbtn" type="button" data-act="search-retry">Try again</button></div>';
    } else if (!st.results || st.searching) {
      h = '<div class="skel"></div><div class="skel"></div>';
    } else {
      st.list = st.results;
      h = st.results.length ? '<div class="rgroup glass">' + st.results.map((r, i) => srow(r, i)).join('') + '</div>'
        : '<div class="empty glass"><strong>No shows found</strong><span>Try other words, or paste a feed link.</span></div>';
    }
    $('searchBody').innerHTML = h;
  }
  let topBusy = false;
  async function loadTop(force){
    if (topBusy || (st.top && st.topCc === S.set.cc && !force)) return;
    const CK = KEY + '-top';
    if (!force) {
      try { const c = JSON.parse(localStorage.getItem(CK)); if (c && c.cc === S.set.cc && Date.now() - c.at < 6 * HOUR && Array.isArray(c.results)) { st.top = c.results.map(cleanShow); st.topCc = c.cc; renderSearchIfOpen(); return; } } catch(e) {}
    }
    topBusy = true; st.topErr = ''; st.top = null; renderSearchIfOpen();
    try {
      st.top = await topShows(); st.topCc = S.set.cc;
      try { localStorage.setItem(CK, JSON.stringify({cc: S.set.cc, at: Date.now(), results: st.top})); } catch(e) {}
    } catch(e) { st.topErr = navigator.onLine === false ? 'You’re offline.' : 'The chart couldn’t be loaded.'; }
    topBusy = false;
    renderSearchIfOpen();
  }
  const renderSearchIfOpen = () => { if (st.tab === 'search' && !st.show) renderSearch(); };
  let searchTimer = 0, searchSeq = 0;
  async function runSearch(){
    const q = st.q.trim(), seq = ++searchSeq;
    if (!q || looksLikeFeed(q)) { renderSearch(); return; }
    st.searching = true; st.searchErr = ''; renderSearch();
    try { const r = await searchShows(q); if (seq === searchSeq) st.results = r; }
    catch(e) { if (seq === searchSeq) st.searchErr = navigator.onLine === false ? 'You’re offline.' : (e.message || 'Search isn’t available right now.'); }
    if (seq === searchSeq) { st.searching = false; renderSearchIfOpen(); animateIn($('searchBody')); }
  }

  function renderShow(){
    const id = st.show, sh = shows.get(id), m = st.showMeta || {}, f = followOf(id);
    const title = (sh && sh.title) || m.title || (f && f.title) || '';
    const author = (sh && sh.author) || m.author || (f && f.author) || '';
    const pic = (f && f.art) || (sh && (sh.itArt || sh.art)) || m.art || '';
    $('showBarTitle').textContent = title;
    const eps = sh ? sh.eps : [];
    const nVideo = eps.filter(e => e.v).length, mixed = nVideo && nVideo < eps.length;
    const meta = [sh ? sh.genre : m.genre, eps.length ? eps.length + (eps.length === MAX_EPS ? '+' : '') + ' episodes' : '', nVideo && !mixed ? 'Video' : ''].filter(Boolean).join(' · ');
    let h = '<div class="hero">' + art(pic, Math.min(220, Math.round(innerWidth * .56)))
      + '<h2' + (title ? ' translate="no"' : '') + '>' + esc(title || 'Loading…') + '</h2>' + (author ? '<span class="by" translate="no">' + esc(author) + '</span>' : '')
      + (meta ? '<span class="hm">' + esc(meta) + '</span>' : '')
      + '<button class="pillbtn follow' + (f ? '' : ' bluec') + '" type="button" data-act="follow-show"' + (sh || m.feed ? '' : ' disabled') + '>' + (f ? I.check + 'Following' : I.plus + 'Follow') + '</button></div>';
    if (sh && sh.desc) h += '<p class="desc' + (st.descOpen ? ' open' : '') + '" data-act="desc" translate="no">' + esc(plain(sh.desc)) + '</p>';
    if (!sh) {
      h += st.showErr ? '<div class="notice glass"><span>' + esc(st.showErr) + '</span><button class="linkbtn" type="button" data-act="show-retry">Try again</button></div>'
        : '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    } else if (!eps.length) {
      h += '<div class="empty glass"><span>No episodes yet.</span></div>';
    } else {
      let list = eps.filter(e => st.showFilter === 'unplayed' ? !isPlayed(e.k) : st.showFilter === 'video' ? e.v : st.showFilter === 'audio' ? !e.v : true);
      if (st.showSort === 'old') list = list.slice().reverse();
      h += '<div class="chips">' + chip('sf:all', 'All', st.showFilter === 'all', eps.length) + chip('sf:unplayed', 'Unplayed', st.showFilter === 'unplayed')
        + (mixed ? chip('sf:video', I.video + 'Video', st.showFilter === 'video', nVideo) + chip('sf:audio', 'Audio', st.showFilter === 'audio') : '')
        + chip('sort', I.sort + (st.showSort === 'new' ? 'Newest first' : 'Oldest first'), false) + '</div>';
      h += list.length ? '<div class="rgroup glass">' + list.slice(0, st.showLimit).map((e, i) => epRow(e, false, Math.min(i, 12))).join('') + '</div>'
        : '<div class="empty glass"><span>Nothing here.</span></div>';
      if (list.length > st.showLimit) h += '<button class="morebtn" type="button" data-act="show-more">Show more</button>';
    }
    $('showBody').innerHTML = h;
    slideChips($('showBody'), 'sf', {group: st.show});
  }

  function render(){
    if (st.show) renderShow();
    else if (st.tab === 'home') renderHome();
    else if (st.tab === 'lib') renderLib();
    else renderSearch();
    renderMini();
    if (!$('np').hidden) renderQueue();
    if (!$('epSheet').hidden && st.ep) renderEpActs();
  }
  // Just the play buttons, while something plays.
  function refreshPills(){
    document.querySelectorAll('.playpill[data-play]').forEach(b => {
      const e = getEp(b.dataset.play);
      if (e) { const t = document.createElement('div'); t.innerHTML = pill(e, b.classList.contains('big')); b.replaceWith(t.firstChild); }
    });
  }

  // =====================================================================
  // VIEWS: the three tabs, and a show pushed on top of one
  // =====================================================================
  function showViews(){
    $('homeView').hidden = st.show || st.tab !== 'home';
    $('libView').hidden = st.show || st.tab !== 'lib';
    $('searchView').hidden = st.show || st.tab !== 'search';
    $('showView').hidden = !st.show;
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
    $('searchTab').setAttribute('aria-pressed', String(st.tab === 'search'));
    slideTabs();
  }
  // The tab bar's thumb; it goes while Search (its own button) is chosen.
  const slideTabs = jump => { const t = document.querySelector('.tabs'); slide(t, t.querySelector('.tab[aria-selected="true"]'), 'tabs', {jump}); };
  const reslide = () => {
    slideTabs(true); slideChips($('libView'), 'lib', {jump:true}); slideChips($('homeBody'), 'new', {jump:true}); slideChips($('showBody'), 'sf', {group: st.show, jump:true}); slideOpts(true);
  };
  window.addEventListener('resize', reslide);
  window.addEventListener('aos:design', () => requestAnimationFrame(reslide));   // Futura and the system font are different widths
  function setTab(t){
    if (st.show) { st.show = null; }
    else if (t === st.tab) { window.scrollTo({top:0, behavior:'smooth'}); return; }
    else st.scroll[st.tab] = window.scrollY;
    st.tab = t;
    try { localStorage.setItem(KEY + '-tab', t); } catch(e) {}
    showViews(); render();
    animateIn($(t === 'home' ? 'homeBody' : t === 'lib' ? 'libBody' : 'searchBody'));
    requestAnimationFrame(() => window.scrollTo(0, st.scroll[t] || 0));
    if (t === 'search') loadTop();
  }
  async function openShow(meta){
    const feed = webUrl(meta.feed), id = meta.id || (feed && showId(feed));
    if (!id) return;
    if (!st.show) st.scroll[st.tab] = window.scrollY;
    st.show = id; st.showMeta = Object.assign({}, meta, {feed}); st.showErr = ''; st.showFilter = 'all'; st.showSort = 'new'; st.showLimit = 40; st.descOpen = false;
    const sh = await ensureShow(id);
    showViews(); render(); window.scrollTo(0, 0); $('showHead').classList.remove('scrolled');
    const src = (sh && sh.feed) || feed || (followOf(id) || {}).feed;
    if (src && (!sh || Date.now() - sh.at > 30 * MIN)) {
      try { await loadShow(src, id, meta); } catch(e) { st.showErr = e.message || 'This show couldn’t be loaded.'; }
      if (st.show === id) renderShow();
    }
  }
  async function retryShow(){
    const id = st.show, m = st.showMeta || {}, feed = m.feed || (followOf(id) || {}).feed;
    if (!id || !feed) return;
    st.showErr = ''; renderShow();
    try { await loadShow(feed, id, m); } catch(e) { st.showErr = e.message || 'This show couldn’t be loaded.'; }
    if (st.show === id) renderShow();
  }
  function openShowById(id){
    const f = followOf(id), sh = shows.get(id), e = [S.now, ...S.queue, ...S.saved, ...S.hist].find(x => x && x.sid === id);
    openShow({id, feed: (sh && sh.feed) || (f && f.feed) || (e && e.feed) || '', title: (f && f.title) || (e && e.st) || '', art: (f && f.art) || (e && e.sa) || ''});
  }
  function closeShow(){
    st.show = null; showViews(); render();
    requestAnimationFrame(() => window.scrollTo(0, st.scroll[st.tab] || 0));
  }
  $('showBack').onclick = closeShow;
  addEventListener('scroll', () => { if (st.show) $('showHead').classList.toggle('scrolled', window.scrollY > 200); }, {passive:true});
  // Swipe in from the left edge to go back, as on the iPhone.
  (function(){
    let sx = null, sy = 0;
    addEventListener('touchstart', e => { const t = e.touches[0]; sx = st.show && e.touches.length === 1 && t.clientX < 28 && document.querySelectorAll('.sheetwrap:not([hidden])').length === 0 ? t.clientX : null; sy = t.clientY; }, {passive:true});
    addEventListener('touchend', e => { if (sx == null) return; const t = e.changedTouches[0]; if (t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 60) closeShow(); sx = null; }, {passive:true});
  })();
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('searchTab').onclick = () => { setTab('search'); };

  $('q').addEventListener('input', () => { st.q = $('q').value; st.results = null; st.searchErr = ''; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 380); renderSearch(); });
  $('qForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(searchTimer); $('q').blur(); runSearch(); });
  $('qClear').onclick = () => { $('q').value = ''; st.q = ''; st.results = null; renderSearch(); $('q').focus(); };
  $('refreshBtn').onclick = () => refreshAll(true);

  // =====================================================================
  // SHEETS, TOAST, CHOICES (as in Notes)
  // =====================================================================
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id){ if (!$(id).hidden) return; focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id){ if ($(id).hidden) return; $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); if (id === 'epSheet') st.ep = null; }
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(w.id); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  // Swipe a sheet down by its handle or title bar to close it.
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, t0 = 0, dy = 0, dragging = false, suppressClick = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    function start(y, target){ if (!target.closest('.grab, .sheethead') || target.closest('.sheethead button:not([data-close])')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; dragging = false; }
    function move(y, e){
      if (y0 === null) return;
      dy = y - y0;
      if (!dragging) { if (dy < 8) return; dragging = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault();
      const d = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + d + 'px)';
      scrim.style.opacity = String(Math.max(0, 1 - d / sheet.offsetHeight));
    }
    function end(){
      if (y0 === null) return;
      y0 = null;
      if (!dragging) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
      const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
      sheet.classList.remove('dragging'); sheet.classList.add('settling');
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(calc(100% + 16px))'; scrim.style.opacity = '0'; setTimeout(() => { closeSheet(w.id); reset(); }, 260); }
      else { sheet.style.transform = ''; scrim.style.opacity = ''; setTimeout(reset, 300); }
    }
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, {passive:true});
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), {passive:false});
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientY, e));
    window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
      if (open) closeSheet(open.id); else if (st.show) closeShow();
    } else if (e.key === ' ' && cur && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) { e.preventDefault(); toggle(); }
  });

  let toastTimer;
  function toast(msg, undo){
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
  }

  // A list of choices in a small sheet: [{label, sub, icon, on, danger, run}].
  let choices = [];
  function choose(title, rows, own){   // own: the title is an episode's or a show's name, kept as written
    choices = rows;
    $('actLbl').textContent = title;
    $('actLbl').translate = !own;
    $('actRows').innerHTML = rows.map((r, i) => '<button class="rowbtn' + (r.danger ? ' danger' : '') + '" type="button" data-i="' + i + '">'
      + (r.icon ? '<span class="ic">' + r.icon + '</span>' : '') + '<span>' + esc(r.label) + (r.sub ? '<span class="sub">' + esc(r.sub) + '</span>' : '') + '</span>'
      + (r.on ? '<span class="tick">' + I.check + '</span>' : '') + '</button>').join('');
    openSheet('actSheet');
  }
  $('actRows').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const r = choices[+b.dataset.i]; closeSheet('actSheet'); if (r) r.run(); });

  async function share(title, text, url){
    if (navigator.share) { try { await navigator.share({title, text, url}); return; } catch(e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch(e) { toast(url); }
  }
  const showLink = feed => location.origin + location.pathname + '?feed=' + encodeURIComponent(feed);

  function epMenu(k){
    const e = getEp(k);
    if (!e) return;
    const played = isPlayed(k), q = inQueue(k), saved = isSaved(k);
    const rows = [
      {label:'Play Next', icon:I.next, run:() => queue(e, true)},
      q ? {label:'Remove from Up Next', icon:I.x, run:() => unqueue(k)} : {label:'Play Later', sub:'At the end of Up Next', icon:I.last, run:() => queue(e, false)},
      {label: saved ? 'Remove from Saved' : 'Save Episode', icon: saved ? I.bmOn : I.bm, run:() => toggleSave(k)},
      {label: played ? 'Mark as Unplayed' : 'Mark as Played', icon: played ? I.circle : I.done, run:() => markPlayed(k, !played)},
      {label:'Share Episode', icon:I.share, run:() => share(e.t, e.st, e.link || e.u)}
    ];
    if (st.show !== e.sid) rows.push({label:'Go to Show', icon:I.podcast, run:() => { closeSheet('epSheet'); closeSheet('np'); openShowById(e.sid); }});
    choose(e.t, rows, true);
  }
  $('showMore').onclick = () => {
    const id = st.show, sh = shows.get(id), f = followOf(id), feed = (sh && sh.feed) || (st.showMeta && st.showMeta.feed);
    if (!id) return;
    const rows = [];
    if (sh && sh.eps.length) rows.push({label:'Mark All as Played', icon:I.done, run:() => {
      const before = {}; sh.eps.forEach(e => { before[e.k] = S.prog[e.k]; S.prog[e.k] = {p:true, t:0, d:(S.prog[e.k] && S.prog[e.k].d) || 0, at:Date.now()}; });
      save(); render();
      toast('Marked ' + sh.eps.length + ' episodes as played', () => { Object.entries(before).forEach(([k, p]) => { if (p) S.prog[k] = p; else delete S.prog[k]; }); save(); render(); });
    }});
    if (feed) rows.push({label:'Share Show', icon:I.share, run:() => share(sh ? sh.title : '', 'Podcast', showLink(feed))});
    if (feed) rows.push({label:'Copy Feed Link', icon:I.link, run:async () => { try { await navigator.clipboard.writeText(feed); toast('Feed link copied'); } catch(e) { toast(feed); } }});
    if (feed) rows.push({label:'Check for New Episodes', icon:I.refresh, run:async () => {
      st.showErr = '';
      try { await loadShow(feed, id, st.showMeta); toast('Up to date'); } catch(e) { toast(e.message || 'Couldn’t update'); }
      if (st.show === id) renderShow();
    }});
    if (f) rows.push({label:'Unfollow', icon:I.unfollow, danger:true, run:() => unfollow(id)});
    choose((sh && sh.title) || (f && f.title) || 'Show', rows, !!((sh && sh.title) || (f && f.title)));
  };

  // ---------- an episode's page ----------
  // Show notes are publishers' HTML: rebuilt here from plain elements only,
  // with web links opening in a new tab. Nothing from the feed runs, and
  // pictures aren't loaded. Times like 12:34 become buttons that play from
  // there.
  const KEEP = new Set(['P','BR','B','STRONG','I','EM','U','UL','OL','LI','BLOCKQUOTE','A','H1','H2','H3','H4','H5','H6','HR','CODE','PRE','SMALL','SUB','SUP','DIV','SPAN']);
  const DROP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','IFRAME','OBJECT','EMBED','SVG','MATH','HEAD','TITLE','FORM','BUTTON','SELECT','TEXTAREA','INPUT','VIDEO','AUDIO','CANVAS','IMG','PICTURE']);
  const TS = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;
  function addText(to, text, inLink){
    if (inLink) { to.appendChild(document.createTextNode(text)); return; }
    let at = 0, m;
    TS.lastIndex = 0;
    while ((m = TS.exec(text))) {
      if (m.index > at) to.appendChild(document.createTextNode(text.slice(at, m.index)));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ts'; b.textContent = m[0];
      b.dataset.ts = String((+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]));
      to.appendChild(b);
      at = m.index + m[0].length;
    }
    if (at < text.length) to.appendChild(document.createTextNode(text.slice(at)));
  }
  function copyNodes(from, to, inLink){
    for (const n of from.childNodes) {
      if (n.nodeType === 3) { addText(to, n.nodeValue, inLink); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (DROP.has(tag)) continue;
      if (!KEEP.has(tag)) { copyNodes(n, to, inLink); continue; }
      let el;
      if (tag === 'A') {
        const href = webUrl(n.getAttribute('href')) || (/^mailto:/i.test(n.getAttribute('href') || '') ? n.getAttribute('href') : '');
        if (!href || inLink) { copyNodes(n, to, inLink); continue; }
        el = document.createElement('a'); el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer';
        copyNodes(n, el, true); to.appendChild(el); continue;
      }
      if (/^H\d$/.test(tag)) { el = document.createElement('p'); el.className = 'nh'; }
      else el = document.createElement(tag.toLowerCase());
      copyNodes(n, el, inLink);
      to.appendChild(el);
    }
  }
  function notesInto(box, e){
    box.replaceChildren();
    box.dataset.k = e.k;
    const h = e.h == null ? null : String(e.h).trim();
    box.translate = !h;   // the notes stay as the show wrote them; "Loading notes…" is the app's
    if (h == null) { box.innerHTML = '<span class="quiet">Loading notes…</span>'; return; }
    if (!h) { box.innerHTML = '<span class="quiet">No notes for this episode.</span>'; return; }
    if (/<[a-z][\s\S]*>/i.test(h)) copyNodes(new DOMParser().parseFromString(h, 'text/html').body, box, false);
    else h.split(/\n{2,}/).forEach(par => { const p = document.createElement('p'); par.split('\n').forEach((line, i) => { if (i) p.appendChild(document.createElement('br')); addText(p, line, false); }); box.appendChild(p); });
  }
  async function openEp(k){
    let e = getEp(k);
    if (!e) return;
    st.ep = k;
    renderEp(e);
    openSheet('epSheet');
    $('epBody').scrollTop = 0;
    if (e.h == null) { e = await fullEp(e); if (st.ep === k) renderEp(e); }
  }
  function renderEp(e){
    $('epLbl').textContent = e.st || 'Episode';
    $('epLbl').translate = !e.st;
    const meta = [day(e.d), e.dur ? len(e.dur) : '', epNum(e), e.v ? 'Video' : ''].filter(Boolean).join(' · ');
    $('epBody').innerHTML = '<div class="ephead">' + art(e.img || e.sa, 84) + '<span class="eptx"><button class="epshow" type="button" data-show="' + esc(e.sid) + '" translate="no">' + esc(e.st) + '</button>'
      + '<span class="epm">' + esc(meta) + '</span></span></div><h3 class="eph" translate="no">' + esc(e.t) + '</h3>'
      + '<div class="epacts" id="epActs"></div><div class="notes glass" id="epNotes"></div>';
    renderEpActs();
    notesInto($('epNotes'), e);
  }
  function renderEpActs(){
    const e = getEp(st.ep), el = $('epActs');
    if (!e || !el) return;
    const saved = isSaved(e.k);
    el.innerHTML = pill(e, true) + '<span class="grow"></span><button class="iconbtn" type="button" data-save="' + esc(e.k) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove from Saved' : 'Save episode') + '">' + (saved ? I.bmOn : I.bm) + '</button>'
      + '<button class="iconbtn" type="button" data-more="' + esc(e.k) + '" aria-label="More for this episode">' + I.more + '</button>';
  }

  // ---------- one click handler for everything in the lists ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-play],[data-ep],[data-save],[data-more],[data-show],[data-res],[data-fres],[data-act],.ts,[data-qplay],[data-qdel]');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.play) { const ep = getEp(d.play); if (ep) { if (cur && cur.k === ep.k) toggle(); else play(ep); } }
    else if (d.ep) openEp(d.ep);
    else if (d.save) toggleSave(d.save);
    else if (d.more) epMenu(d.more);
    else if (d.show) { closeSheet('epSheet'); closeSheet('np'); if (st.show !== d.show) openShowById(d.show); }
    else if (d.res) { const r = st.list && st.list[+d.res]; if (r) openShow(r); }
    else if (d.fres) {
      const r = st.list && st.list[+d.fres];
      if (!r || !r.feed) return;
      if (isFollowed(showId(r.feed))) unfollow(showId(r.feed)); else follow(r);
    }
    else if (t.classList.contains('ts')) {
      const box = t.closest('[data-k]'), ep = box && getEp(box.dataset.k);
      if (ep) { if (cur && cur.k === ep.k) { seek(+d.ts); toggle(true); } else play(ep, +d.ts); }
    }
    else if (d.qplay != null) { const x = S.queue[+d.qplay]; if (x) play(getEp(x.k) || x); }
    else if (d.qdel != null) { const x = S.queue[+d.qdel]; if (x) unqueue(x.k); }
    else if (d.act) act(d.act, t);
  });
  function act(a){
    if (a === 'go-search') setTab('search');
    else if (a.startsWith('new:')) { st.newFilter = a.slice(4); st.newLimit = 30; renderHome(); }
    else if (a === 'new-more') { st.newLimit += 30; renderHome(); }
    else if (a.startsWith('lib:')) { st.lib = a.slice(4); try { localStorage.setItem(KEY + '-lib', st.lib); } catch(e) {} renderLib(); animateIn($('libBody')); }
    else if (a === 'hist-clear') { const h = S.hist; S.hist = []; save(); renderLib(); toast('History cleared', () => { S.hist = h; save(); renderLib(); }); }
    else if (a === 'hist-older') loadOlder();
    else if (a.startsWith('sf:')) { st.showFilter = a.slice(3); st.showLimit = 40; renderShow(); }
    else if (a === 'sort') { st.showSort = st.showSort === 'new' ? 'old' : 'new'; st.showLimit = 40; renderShow(); }
    else if (a === 'show-more') { st.showLimit += 40; renderShow(); }
    else if (a === 'desc') { st.descOpen = !st.descOpen; renderShow(); }
    else if (a === 'show-retry') retryShow();
    else if (a === 'refresh') refreshAll(true);
    else if (a === 'follow-show') {
      const id = st.show, sh = shows.get(id), m = st.showMeta || {};
      if (isFollowed(id)) unfollow(id);
      else follow({feed: (sh && sh.feed) || m.feed, title: (sh && sh.title) || m.title, author: (sh && sh.author) || m.author, art: m.art || (sh && sh.itArt), genre: (sh && sh.genre) || m.genre});
    }
    else if (a === 'top-retry') loadTop(true);
    else if (a === 'search-retry') runSearch();
  }

  // =====================================================================
  // PLAYER
  // =====================================================================
  // Audio plays in an <audio>, which keeps going with the screen locked;
  // video in the <video> on the Now Playing screen. Only one has a source.
  const audio = $('audio'), video = $('video');
  let player = audio, cur = null, pendingSeek = null, sleep = null, sleepTimer = 0, lastSave = 0, lastPills = 0, scrubbing = false;
  const dur = () => isFinite(player.duration) && player.duration > 0 ? player.duration : ((cur && S.prog[cur.k] && S.prog[cur.k].d) || (cur && cur.dur) || 0);
  const loaded = () => !!player.getAttribute('src');

  function attach(e, at){
    const el = e.v ? video : audio, other = el === audio ? video : audio;
    if (other.getAttribute('src')) { other.pause(); other.removeAttribute('src'); other.load(); }
    player = el;
    el.src = e.u;
    el.defaultPlaybackRate = el.playbackRate = S.set.speed;
    if (el === video) video.poster = e.img || e.sa || '';
    pendingSeek = at > 0 ? at : null;
  }
  function play(e, from){
    savePos();
    if (isPlayed(e.k)) delete S.prog[e.k];
    cur = snap(e);
    S.now = cur;
    S.queue = S.queue.filter(x => x.k !== e.k);
    S.hist = [Object.assign({}, cur, {pl: Date.now()}), ...S.hist.filter(x => x.k !== e.k)];
    capHist();
    attach(cur, from != null ? from : resumeAt(cur));
    player.play().catch(playFailed);
    save(); session(); render(); if (!$('np').hidden) renderNP();
  }
  function playFailed(err){
    if (err && err.name === 'NotAllowedError') return;          // needs a tap; the button is there
    if (err && err.name === 'AbortError') return;               // replaced by another episode
    toast('This episode can’t be played right now.');
  }
  function toggle(want){
    if (!cur) return;
    if (!loaded()) attach(cur, resumeAt(cur));
    if (want == null) want = player.paused;
    if (want) player.play().catch(playFailed); else player.pause();
  }
  function seek(t){
    if (!cur) return;
    if (!loaded()) { attach(cur, t); player.load(); return; }
    const d = dur();
    player.currentTime = Math.max(0, d ? Math.min(t, d - 1) : t);
    savePos(true); uiTick(true);
  }
  const skip = n => { if (cur) seek((loaded() ? player.currentTime : resumeAt(cur)) + n); };

  function savePos(force){
    if (!cur || !loaded()) return;
    const t = player.currentTime || 0, d = dur(), p = S.prog[cur.k];
    if (t < 1 && !(p && p.t)) return;
    // The last 15 seconds (credits, a sign-off) count as played.
    if (player.ended || (d && t > d - (d > 60 ? 15 : 1))) { if (!(p && p.p)) markPlayed(cur.k, true); return; }
    S.prog[cur.k] = {t: Math.round(t), d: Math.round(d), at: Date.now(), e: cur};
    lastSave = Date.now();
    save();
    if (force) refreshPills();
  }

  function uiTick(all){
    if (!cur) return;
    const t = loaded() ? player.currentTime : resumeAt(cur), d = dur(), pct = d ? Math.min(100, t / d * 100) : 0;
    $('miniProg').style.width = pct + '%';
    if (!$('np').hidden && !scrubbing) {
      $('scrub').value = d ? Math.round(t / d * 1000) : 0;
      $('scrub').style.setProperty('--p', pct + '%');
      $('scrub').disabled = !d;
      $('npAt').textContent = clock(t);
      $('npLeft').textContent = d ? '-' + clock(d - t) : '';
    }
    if (Date.now() - lastSave > 10000) savePos();
    if (all || Date.now() - lastPills > 15000) { lastPills = Date.now(); refreshPills(); }
  }
  function playState(){
    const on = !!cur && !player.paused;
    $('miniPlay').innerHTML = on ? I.pause : I.play;
    $('miniPlay').setAttribute('aria-label', on ? 'Pause' : 'Play');
    $('npPlay').innerHTML = on ? I.pause : I.play;
    $('npPlay').setAttribute('aria-label', on ? 'Pause' : 'Play');
    $('npMedia').classList.toggle('paused', !on);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = cur ? (on ? 'playing' : 'paused') : 'none';
    refreshPills();
  }
  [audio, video].forEach(el => {
    const mine = f => ev => { if (ev.target === player) f(ev); };
    el.addEventListener('loadedmetadata', mine(() => {
      if (pendingSeek != null) { try { player.currentTime = pendingSeek; } catch(e) {} pendingSeek = null; }
      player.playbackRate = S.set.speed;
      uiTick(true); position();
    }));
    el.addEventListener('timeupdate', mine(() => uiTick()));
    el.addEventListener('play', mine(playState));
    el.addEventListener('pause', mine(() => { playState(); savePos(true); }));
    el.addEventListener('ratechange', mine(position));
    el.addEventListener('seeked', mine(position));
    el.addEventListener('ended', mine(ended));
    el.addEventListener('error', mine(() => { if (el.getAttribute('src')) { toast('This episode couldn’t be loaded.'); playState(); } }));
    // AirPlay: Safari says when a speaker or TV is around.
    el.addEventListener('webkitplaybacktargetavailabilitychanged', ev => { el._air = ev.availability === 'available'; renderAir(); });
  });
  function ended(){
    const k = cur.k;
    markPlayed(k, true);
    if (sleep && sleep.end) { setSleep(null); toast('Sleep timer: stopped at the end of the episode'); playState(); return; }
    const next = S.set.auto ? S.queue.find(x => x.k !== k) : null;
    if (next) play(getEp(next.k) || next); else { playState(); render(); }
  }
  video.addEventListener('click', () => toggle());

  // Lock screen, Control Centre, headphones and the car.
  function session(){
    if (!('mediaSession' in navigator) || !cur) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({title: cur.t, artist: cur.st, album: cur.st,
        artwork: (cur.img || cur.sa) ? [{src: cur.img || cur.sa, sizes:'512x512'}] : []});
    } catch(e) {}
  }
  function position(){
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const d = isFinite(player.duration) ? player.duration : 0;
    try { if (d) navigator.mediaSession.setPositionState({duration: d, playbackRate: player.playbackRate || 1, position: Math.min(player.currentTime || 0, d)}); } catch(e) {}
  }
  if ('mediaSession' in navigator) {
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch(e) {} };
    h('play', () => toggle(true));
    h('pause', () => toggle(false));
    h('seekbackward', d => skip(-((d && d.seekOffset) || S.set.back)));
    h('seekforward', d => skip((d && d.seekOffset) || S.set.fwd));
    h('seekto', d => { if (d && d.seekTime != null) seek(d.seekTime); });
  }

  // ---------- mini player ----------
  function renderMini(){
    const on = !!cur;
    $('mini').hidden = !on;
    $('app').classList.toggle('hasmini', on);
    if (!on) return;
    if ($('mini').dataset.k !== cur.k) {   // by episode, not title: two shows' "Episode 12" are two episodes
      $('mini').dataset.k = cur.k;
      $('miniTitle').textContent = cur.t;
      $('miniShow').textContent = cur.st;
      $('miniArt').innerHTML = (cur.sa || cur.img) ? '<img src="' + esc(cur.sa || cur.img) + '" alt="">' : '';
    }
    $('miniFwd').innerHTML = skipIcon(S.set.fwd, true);
    $('miniFwd').setAttribute('aria-label', 'Skip forward ' + S.set.fwd + ' seconds');
    playState(); uiTick();
  }
  $('miniPlay').onclick = () => toggle();
  $('miniFwd').onclick = () => skip(S.set.fwd);
  $('miniOpen').onclick = () => openNP();

  // ---------- Now Playing ----------
  function openNP(){ if (!cur) return; openSheet('np'); renderNP(); $('np').querySelector('.sheetbody').scrollTop = 0; }
  async function renderNP(){
    if (!cur) return;
    const pic = cur.img || cur.sa;
    $('npBg').style.backgroundImage = pic ? 'url(' + JSON.stringify(pic) + ')' : '';
    $('npArt').hidden = !pic;
    if (pic && $('npArt').getAttribute('src') !== pic) $('npArt').src = pic;
    $('npMedia').classList.toggle('isvideo', !!cur.v);
    $('npDate').textContent = [day(cur.d), epNum(cur)].filter(Boolean).join(' · ');
    $('npTitle').textContent = cur.t;
    $('npShow').textContent = cur.st;
    $('npBack').innerHTML = skipIcon(S.set.back, false);
    $('npBack').setAttribute('aria-label', 'Skip back ' + S.set.back + ' seconds');
    $('npFwd').innerHTML = skipIcon(S.set.fwd, true);
    $('npFwd').setAttribute('aria-label', 'Skip forward ' + S.set.fwd + ' seconds');
    $('npSpeed').textContent = speedLabel(S.set.speed);
    const pipOk = !!(document.pictureInPictureEnabled || (video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode('picture-in-picture')));
    $('npPip').hidden = !cur.v || !pipOk;
    $('npFull').hidden = !cur.v || !(video.requestFullscreen || video.webkitEnterFullscreen);
    renderSleep(); renderAir(); renderQueue(); playState(); uiTick(true);
    const k = cur.k, full = await fullEp(getEp(k) || cur);
    if (cur && cur.k === k) notesInto($('npNotes'), full.h == null ? Object.assign({}, full, {h:''}) : full);
  }
  function renderQueue(){
    const q = S.queue.map(x => getEp(x.k) || x);
    $('npQueueWrap').hidden = !q.length;
    $('npQueue').innerHTML = q.map((e, i) => '<div class="qrow"><button class="sopen" type="button" data-qplay="' + i + '">' + art(e.sa, 40)
      + '<span class="stx"><b translate="no">' + esc(e.t) + '</b><span><span translate="no">' + esc((e.st || '') + (e.st && e.dur ? ' · ' : '')) + '</span>' + esc(e.dur ? len(e.dur) : '') + '</span></span></button>'
      + '<button class="icbtn" type="button" data-qdel="' + i + '" aria-label="Remove from Up Next">' + I.x + '</button></div>').join('');
  }
  $('npQueueClear').onclick = () => { const q = S.queue; S.queue = []; save(); render(); toast('Up Next cleared', () => { S.queue = q; save(); render(); }); };
  $('npPlay').onclick = () => toggle();
  $('npBack').onclick = () => skip(-S.set.back);
  $('npFwd').onclick = () => skip(S.set.fwd);
  $('npShow').onclick = () => { if (!cur) return; const id = cur.sid; closeSheet('np'); if (st.show !== id) openShowById(id); };
  $('npMore').onclick = () => { if (cur) epMenu(cur.k); };
  $('scrub').addEventListener('input', () => {
    scrubbing = true;
    const d = dur(), t = $('scrub').value / 1000 * d;
    $('scrub').style.setProperty('--p', ($('scrub').value / 10) + '%');
    $('npAt').textContent = clock(t);
    $('npLeft').textContent = '-' + clock(d - t);
  });
  $('scrub').addEventListener('change', () => { const d = dur(); if (d) seek($('scrub').value / 1000 * d); scrubbing = false; });

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const speedLabel = s => String(s).replace(/^0\./, '.') + '×';
  $('npSpeed').onclick = () => choose('Playback speed', SPEEDS.map(s => ({label: speedLabel(s), sub: s === 1 ? 'Normal' : '', on: s === S.set.speed, run:() => {
    S.set.speed = s; save();
    player.defaultPlaybackRate = player.playbackRate = s;
    $('npSpeed').textContent = speedLabel(s);
  }})));

  function setSleep(v){
    sleep = v;
    clearInterval(sleepTimer);
    if (v && v.until) sleepTimer = setInterval(() => {
      if (Date.now() >= sleep.until) { player.pause(); setSleep(null); toast('Sleep timer: paused'); }
      else renderSleep();
    }, 1000);
    renderSleep();
  }
  function renderSleep(){
    const b = $('npSleep');
    b.setAttribute('aria-pressed', String(!!sleep));
    b.innerHTML = I.moon + (sleep ? (sleep.end ? 'End of episode' : clock((sleep.until - Date.now()) / 1000)) : '');
    b.setAttribute('aria-label', sleep ? 'Sleep timer on' : 'Sleep timer');
  }
  $('npSleep').onclick = () => choose('Sleep timer', [
    ...[5, 15, 30, 45, 60].map(m => ({label: m === 60 ? '1 hour' : m + ' minutes', run:() => { setSleep({until: Date.now() + m * MIN}); }})),
    {label:'End of episode', on: !!(sleep && sleep.end), run:() => setSleep({end:true})},
    ...(sleep ? [{label:'Turn off', icon:I.x, run:() => setSleep(null)}] : [])
  ]);

  function renderAir(){ $('npAir').hidden = !(player && player._air && typeof player.webkitShowPlaybackTargetPicker === 'function'); }
  $('npAir').onclick = () => { try { player.webkitShowPlaybackTargetPicker(); } catch(e) {} };
  $('npPip').onclick = async () => {
    try {
      if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function')
        video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      else if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch(e) { toast('Picture in Picture isn’t available here.'); }
  };
  $('npFull').onclick = () => {
    try {
      if (video.requestFullscreen && document.fullscreenEnabled) video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch(e) {}
  };

  // =====================================================================
  // SETTINGS, IMPORT AND EXPORT
  // =====================================================================
  function renderSettings(){
    const opts = (id, list, val, set) => {
      $(id).innerHTML = list.map(([v, label]) => '<button class="opt" type="button" role="radio" data-v="' + esc(v) + '" aria-checked="' + (String(v) === String(val)) + '">' + esc(label) + '</button>').join('');
      $(id).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; set(b.dataset.v); save(); renderSettings(); if (cur) { renderMini(); if (!$('np').hidden) renderNP(); } };
    };
    opts('setBack', [[10, '10 sec'], [15, '15 sec'], [30, '30 sec']], S.set.back, v => { S.set.back = +v; });
    opts('setFwd', [[15, '15 sec'], [30, '30 sec'], [45, '45 sec'], [60, '60 sec']], S.set.fwd, v => { S.set.fwd = +v; });
    opts('setAuto', [['1', 'Play next in Up Next'], ['0', 'Stop']], S.set.auto ? '1' : '0', v => { S.set.auto = v === '1'; });
    opts('setCc', Object.entries(CC).map(([k, v]) => [k, v.replace(/^the /, '')]), S.set.cc, v => { S.set.cc = v; S.set.ccChosen = true; st.top = null; });
    slideOpts();
  }
  // Each choice's thumb; only once the sheet is open, as a hidden one can't be measured.
  const slideOpts = jump => ['setBack', 'setFwd', 'setAuto', 'setCc'].forEach(id => slide($(id), $(id).querySelector('[aria-checked="true"]'), 'opt:' + id, {jump}));
  $('setBtn').onclick = () => { renderSettings(); openSheet('setSheet'); slideOpts(); };
  // Design, the first section: Vintage or Standard, at once and just on this phone (../home/design.js); not part of the other settings
  if (window.aosDesign) {
    $('setBack').parentElement.insertAdjacentHTML('afterbegin', '<p class="label">Design</p><div class="rgroup glass" id="setDesign">' + aosDesign.picker() + '</div>');
    aosDesign.bind($('setDesign'));
  }
  $('setExport').onclick = () => {
    if (!S.follows.length) { toast('You’re not following any shows yet.'); return; }
    const body = S.follows.map(f => '    <outline type="rss" text="' + esc(f.title) + '" title="' + esc(f.title) + '" xmlUrl="' + esc(f.feed) + '"/>').join('\n');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Podcasts</title><dateCreated>' + new Date().toUTCString() + '</dateCreated></head>\n  <body>\n' + body + '\n  </body>\n</opml>\n';
    saveFile('Podcasts.opml', xml, 'text/x-opml');
  };
  async function saveFile(name, text, type){
    const file = new File([text], name, {type});
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      try { await navigator.share({files:[file], title:name}); return; } catch(e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('setImport').onclick = () => $('opmlFile').click();
  $('opmlFile').onchange = async () => {
    const file = $('opmlFile').files[0];
    $('opmlFile').value = '';
    if (!file) return;
    let n = 0;
    try {
      const doc = parseXml(await file.text());
      for (const o of doc.getElementsByTagName('outline')) {
        const feed = webUrl(o.getAttribute('xmlUrl') || o.getAttribute('xmlurl'));
        if (!feed) continue;
        const id = showId(feed);
        if (isFollowed(id)) continue;
        S.follows.push({id, feed, title: o.getAttribute('title') || o.getAttribute('text') || '', author:'', art:'', genre:'', at: Date.now(), latest: 0});
        n++;
      }
    } catch(e) { toast('That file couldn’t be read.'); return; }
    save();
    toast(n ? 'Added ' + n + (n === 1 ? ' show' : ' shows') : 'No new shows in that file.');
    closeSheet('setSheet');
    render();
    if (n) refreshAll(false);
  };

  // =====================================================================
  // THE FAMILY'S GOOGLE SHEET: the record of everyone's Podcasts, each row
  // marked with whose it is (aOS/SHEETS.md). This phone keeps a working copy
  // (what syncs, at the top: your shows, Saved, the last 90 days of History,
  // and where you got to); older History comes from the Sheet when you ask.
  // Syncs go through aOS (../home/sheet.js, functions/sheet/api), signed in,
  // so the phone holds no Sheet link or phrase and only ever gets your own
  // rows: the same on each of your phones. It syncs by itself, with nothing to
  // set up here: the owner links the Sheet in aOS (Account → Google Sheets).
  // Signed out, the app works on this phone alone.
  // =====================================================================
  const SHEET_APP = 'allison-podcasts-sync';
  const SH = () => window.AllisonOS && AllisonOS.sheet;
  let syncing = false, syncAgain = false, syncTimer = 0, syncState = 'idle', errShown = false, syncDelay = 2000;
  let lastSyncAt = +lsGet(SK.at) || 0;
  // The one-way backup's own: its time and this phone's id (it told phones apart; the Sheet now goes by person).
  lsDel(KEY + '-sheet-at'); lsDel(KEY + '-device');
  const SYNC_ERRORS = {
    signin: 'Sign in to sync your shows.',
    'no-sheet': 'The family’s Podcasts Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.',
    'wrong-secret': 'aOS’s phrase for the Podcasts Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.',
    'old-script': 'The Podcasts Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).',
    'secret-not-set': 'The Podcasts Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.',
    busy: 'The Sheet was busy. Trying again shortly.',
    offline: 'Offline. Changes will sync when you’re back online.',
    'sheet-unreachable': 'Couldn’t reach the Sheet. Trying again later.',
    'not-json': 'The Sheet didn’t answer as expected. Trying again later.'
  };
  // The link and phrase this phone used to keep (before aOS kept them), in localStorage and in a small database
  // of their own: on the owner's phone they go to aOS once (it keeps them from then on); on every phone, once aOS
  // has them, they're forgotten here.
  const sheetKeep = (function(){
    let dbp = null;
    const open = () => dbp || (dbp = Promise.resolve(window.aosDesign && aosDesign.moved).then(() => new Promise((res, rej) => {   // after design.js's move (as the episode database)
      if (!window.indexedDB) return rej(new Error('No IndexedDB'));
      const r = indexedDB.open('allison-podcasts-sheet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = t.onabort = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', x => x.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', x => v == null ? x.delete(k) : x.put(v, k)).catch(() => {})
    };
  })();
  async function handOver(){
    let old = null;
    try { old = JSON.parse(lsGet(SK.cfg)); } catch(e) {}
    if (!old || !old.secret) old = await sheetKeep.get('sheet');
    if (!old || !old.secret || !SH() || !signedIn()) return;
    if (await SH().adopt('podcasts', {url: old.url, secret: old.secret})) { lsDel(SK.cfg); sheetKeep.set('sheet', null); sheetKeep.set('device', null); }
  }
  // The Sheet's answer, merged into this phone's copy: the newest change of each item wins, and graves delete.
  // Dated items older than the 90 days go (no grave: the Sheet keeps them), except what's played.
  function applyRemote(res){
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((S.graves[k] || 0) < t) S.graves[k] = t; });
    const gone = (k, o) => { const g = S.graves[k]; return !!(g && g >= (+o.updated || 0)); };
    const from = pruneFrom();
    let localNewer = false;
    for (const kind in SYNC) {
      const K = SYNC[kind], inWin = o => !K.dated || !from || K.day(o) >= from;
      const mine = new Map(), kept = new Map();
      for (const [id, o] of K.items()) {
        if (inWin(o)) mine.set(id, o);
        else if (K.keepAll || older.has(kind + ':' + id)) kept.set(id, o);   // not compared: the Sheet sends only the 90 days
      }
      const remote = (Array.isArray(res[kind]) ? res[kind] : []).filter(r => r && typeof r === 'object' && typeof r.id === 'string' && r.id && K.ok(r));
      const ids = new Set();
      remote.forEach(r => {
        ids.add(r.id);
        const l = mine.get(r.id);
        if (!l || (+r.updated || 0) > (+l.updated || 0)) mine.set(r.id, K.in(r, l || kept.get(r.id)));
        else if ((+l.updated || 0) > (+r.updated || 0)) localNewer = true;
      });
      mine.forEach((o, id) => { if (!ids.has(id) && !S.graves[kind + ':' + id]) localNewer = true; });
      kept.forEach((o, id) => { if (!mine.has(id)) mine.set(id, o); });
      K.set([...mine].filter(([id, o]) => !gone(kind + ':' + id, o)));
    }
    initShadow(); persist();
    if (localNewer) syncAgain = true;
    // shows followed on another phone: their episodes, from this phone's store or their feeds
    const missing = S.follows.filter(f => !shows.has(f.id));
    if (missing.length) Promise.all(missing.map(f => ensureShow(f.id))).then(() => {
      render();
      const still = S.follows.filter(f => !shows.has(f.id));
      if (still.length) pool(still, 4, f => loadShow(f.feed, f.id).catch(e => { f.err = e.message; })).then(render);
    });
    render();
  }
  // Always quietly, and only when signed in (it never asks for Face ID). A real error shows once a session;
  // signed out or no Sheet in aOS yet says nothing: the owner sets the Sheet up in aOS.
  async function sync(){
    if (!SH() || !signedIn()) { syncState = signedIn() ? 'idle' : 'signin'; return false; }
    if (syncing) { syncAgain = true; return false; }
    if (navigator.onLine === false) { syncState = 'offline'; return false; }
    syncing = true; syncState = 'syncing';
    let ok = false;
    try {
      track(); persist();
      // all of it the first time; then the last 90 days of what's dated (older is in the Sheet already)
      const from = pruneFrom(), body = {action: 'sync', v: 2, window: KEEP_DAYS, today: today(), graves: S.graves};
      for (const kind in SYNC) {
        const K = SYNC[kind];
        body[kind] = K.items().filter(([, o]) => !K.dated || !from || K.day(o) >= from).map(([id, o]) => Object.assign(K.out(id, o), {updated: o.updated}));
      }
      const res = await SH().sync('podcasts', body, {ask: false});
      if (res.app && res.app !== SHEET_APP) throw new Error('not-json');
      if (!res.aos) throw new Error('old-script');
      lastSyncAt = Date.now(); lsSet(SK.at, String(lastSyncAt));
      if (!synced) { synced = true; lsSet(SK.synced, '1'); }
      syncState = 'ok'; ok = true;
      applyRemote(res);
    } catch(e) {
      const code = e.message;
      syncState = code === 'signin' ? 'signin' : code === 'offline' ? 'offline' : 'error';
      if (!errShown && syncState === 'error' && code !== 'no-sheet') { errShown = true; toast(SYNC_ERRORS[code] || 'Sync didn’t work. Trying again later.'); }
      if (code === 'busy') scheduleSync(10000);
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  function scheduleSync(ms){ clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(), ms == null ? syncDelay : ms); }
  // Looking back past the 90 days of History this phone keeps: a year at a time from the Sheet (Library →
  // History → Show older), kept here until the next tidy-up.
  async function loadOlder(){
    const floor = pruneFrom();
    if (!floor || olderBusy || olderEnd || !SH()) return;
    const to = addDays(olderFrom || floor, -1), from = addDays(to, -364);
    olderBusy = true; renderLib();
    try {
      const res = await SH().sync('podcasts', {action: 'range', from, to}, {ask: true});
      olderFrom = from;
      let n = 0;
      for (const kind of ['hist', 'prog']) {
        const K = SYNC[kind], have = new Set(K.items().map(x => x[0]));
        for (const r of (Array.isArray(res[kind]) ? res[kind] : [])) {
          if (!r || typeof r.id !== 'string' || !r.id || r.id === '__proto__' || !K.ok(r) || have.has(r.id) || S.graves[kind + ':' + r.id]) continue;   // S.prog is a plain object
          const o = K.in(r);
          if (!o.updated) o.updated = 1;
          if (kind === 'hist') { S.hist.push(o); n++; } else S.prog[r.id] = o;
          older.add(kind + ':' + r.id); shadow.set(kind + ':' + r.id, JSON.stringify(K.out(r.id, o)));
        }
      }
      if (n) S.hist.sort((a, b) => (b.pl || 0) - (a.pl || 0));
      else { olderEnd = true; toast('Nothing older in the family’s Google Sheet.'); }
      persist();
    } catch(e) { toast(SYNC_ERRORS[e.message] || 'Couldn’t reach the Sheet. Try again later.'); }
    olderBusy = false; renderLib();
  }
  // An old setup link from another phone (#sync=…): aOS keeps the Sheet now, so it's only taken off the address.
  if (location.hash.startsWith('#sync=')) history.replaceState(null, '', location.pathname + location.search);
  // On start (after handing over), on sign-in, when the app comes back to the front, and when the phone is online again.
  setTimeout(() => handOver().finally(() => sync()), 600);
  addEventListener('aos:account', e => { if (e.detail) handOver().then(() => sync()); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastSyncAt > 30000) sync(); });
  addEventListener('online', () => sync());
  // For the tests (podcasts/scripts/app-test.mjs) only.
  window.__podcasts = {S, save, sync, syncState: () => syncState, setSyncDelay: ms => { syncDelay = ms; }, pruneFrom, loadOlder, older: () => [...older]};

  // =====================================================================
  // START
  // =====================================================================
  const flush = () => savePos();
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
    else if (Date.now() - S.lastRefresh > 30 * MIN) refreshAll(false);
  });

  (async function start(){
    if (S.now) cur = S.now;
    await Promise.all(S.follows.map(f => ensureShow(f.id)));
    showViews(); render();
    animateIn($(st.tab === 'home' ? 'homeBody' : st.tab === 'lib' ? 'libBody' : 'searchBody'));
    if (st.tab === 'search') loadTop();
    // A shared show: ?feed=<feed link>
    const shared = new URLSearchParams(location.search).get('feed');
    if (shared && webUrl(shared)) { history.replaceState(null, '', location.pathname); openShow({feed: shared}); }
    if (Date.now() - S.lastRefresh > 20 * MIN) setTimeout(() => refreshAll(false), 700);
    // Once a day: forget stored shows nothing uses any more.
    if (Date.now() - S.lastClean > DAY) setTimeout(() => {
      const keep = new Set([...S.follows.map(f => f.id), ...[S.now, ...S.queue, ...S.saved, ...S.hist].filter(Boolean).map(e => e.sid)]);
      Object.values(S.prog).forEach(p => { if (p && p.e) keep.add(p.e.sid); });
      idb.sweep((id, sh) => !keep.has(id) && !(sh && sh.at > Date.now() - 14 * DAY));
      S.lastClean = Date.now(); save();
    }, 8000);
  })();

  // "Updated": the app fingerprints its own code; when the fingerprint changes
  // (a new version was published), the pill shows once for 5 seconds. The very
  // first open only records the fingerprint. The code is in app.js now, so the
  // fingerprint is the page's styles and sw.js's CACHE name, which every
  // release of this app bumps; offline, it waits for the next open.
  (async function(){
    let cache = '';
    try { const r = await fetch('sw.js', {cache:'no-store'}); if (!r.ok) return; cache = (/const CACHE = '([^']+)'/.exec(await r.text()) || [])[1] || ''; } catch(e) { return; }
    if (!cache) return;
    const src = [...document.querySelectorAll('style')].map(e => e.textContent).join('') + cache;
    const ver = hash(src), VK = KEY + '-version';
    let prev = null;
    try { prev = localStorage.getItem(VK); localStorage.setItem(VK, ver); } catch(e) { return; }
    if (!prev || prev === ver) return;
    const pill = $('updPill');
    pill.hidden = false;
    setTimeout(() => { pill.classList.add('out'); setTimeout(() => { pill.hidden = true; pill.classList.remove('out'); }, 450); }, 5000);
  })();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
