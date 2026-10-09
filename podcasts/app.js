// podcasts's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
(function(){
  'use strict';
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
    trash:'<svg viewBox="0 0 24 24"><path d="M3.4 6.2h17.2"/><path d="M8.8 6.2V5.1a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.1"/><path d="M5.5 6.2l.8 12.2a2.8 2.8 0 0 0 2.8 2.6h5.8a2.8 2.8 0 0 0 2.8-2.6l.8-12.2"/></svg>'
  };
  // Skip buttons: a circular arrow with the seconds inside, as on the iPhone.
  const skipIcon = (n, fwd) => '<svg viewBox="0 0 24 24">' + (fwd
    ? '<path d="M12 3.8a8.6 8.6 0 1 0 7.4 4.2"/><path d="M9.8 1.4l2.4 2.4-2.4 2.4"/>'
    : '<path d="M12 3.8a8.6 8.6 0 1 1-7.4 4.2"/><path d="M14.2 1.4l-2.4 2.4 2.4 2.4"/>')
    + '<text x="12" y="15.7" text-anchor="middle" font-size="7.2" font-weight="700" fill="currentColor" stroke="none" font-family="-apple-system,BlinkMacSystemFont,system-ui,sans-serif">' + n + '</text></svg>';

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
      lastRefresh: +v.lastRefresh || 0, lastClean: +v.lastClean || 0
    };
  })();
  let warned = false;
  function save(){
    const write = () => localStorage.setItem(KEY, JSON.stringify(S));
    try { write(); }
    catch(e) {
      pruneProg(300);
      try { write(); } catch(e2) { if (!warned) { warned = true; toast('This phone’s storage is full, so some progress may not be kept.'); } }
    }
  }
  // Progress: {t: seconds in, d: length, p: played, at: when, e: the episode
  // (kept only while it's part-played, for Up Next)}.
  function pruneProg(keep){
    const ents = Object.entries(S.prog).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    S.prog = Object.fromEntries(ents.slice(0, keep));
  }
  if (Object.keys(S.prog).length > 3000) pruneProg(3000);

  const idb = (function(){
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('No IndexedDB'));
      const r = indexedDB.open('allison-podcasts', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('shows');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
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
  // FEEDS
  // =====================================================================
  // ./api/ is the Pages Function beside this app. Where it isn't (GitHub
  // Pages, a local server) the answer is a 404 or an HTML page, and the app
  // goes straight to the feed for the rest of the session.
  let apiGone = false;
  async function api(path){
    if (apiGone) throw new Error('noapi');
    let r;
    try { r = await fetch('api/' + path, {headers:{'X-Podcasts':'1'}, cache:'no-store', credentials:'same-origin'}); }
    catch(e) { throw new Error('offline'); }
    const ct = r.headers.get('Content-Type') || '';
    if (r.status === 404 || r.status === 405 || /html/i.test(ct)) { apiGone = true; throw new Error('noapi'); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch(e) {} throw new Error(m || 'The feed couldn’t be loaded.'); }
    return r;
  }
  const quiet = m => m === 'noapi' || m === 'offline';
  async function fetchFeed(url){
    try { return await (await api('feed?url=' + encodeURIComponent(url))).text(); }
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

  async function loadShow(feed, id, meta){
    const p = parseFeed(await fetchFeed(feed), id);
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
    if (!S.follows.length) { if (manual) toast('Follow a show and its new episodes show up here.'); return; }
    refreshing = true;
    $('refreshBtn').classList.add('busy');
    syncPill('run', 'Checking for new episodes');
    let fresh = 0, failed = 0;
    await pool([...S.follows], 4, async f => {
      const had = shows.get(f.id), newest = had && had.eps[0] ? had.eps[0].d : (f.latest || 0);
      try {
        const sh = await loadShow(f.feed, f.id);
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
  async function directory(path, direct){
    try { return ((await (await api(path)).json()).results || []).map(cleanShow); }
    catch(e) {
      if (!quiet(e.message)) throw e;
      // Apple's own addresses, where they let a page read them
      try { return (await direct()).map(cleanShow); } catch(_) { throw new Error('Search isn’t available right now.'); }
    }
  }
  const itJson = async u => { const r = await fetch(u, {credentials:'omit'}); if (!r.ok) throw new Error('Search isn’t available right now.'); return r.json(); };
  const searchShows = term => directory('search?cc=' + S.set.cc + '&term=' + encodeURIComponent(term), async () =>
    ((await itJson('https://itunes.apple.com/search?media=podcast&entity=podcast&limit=30&country=' + S.set.cc + '&term=' + encodeURIComponent(term))).results || []).map(itShow));
  const topShows = () => directory('top?cc=' + S.set.cc, async () => {
    const chart = await itJson('https://rss.applemarketingtools.com/api/v2/' + S.set.cc + '/podcasts/top/50/podcasts.json');
    const ids = ((chart.feed && chart.feed.results) || []).map(r => r.id);
    const look = await itJson('https://itunes.apple.com/lookup?entity=podcast&country=' + S.set.cc + '&id=' + ids.join(','));
    const by = new Map((look.results || []).map(r => [String(r.collectionId), itShow(r)]));
    return ids.map(id => by.get(String(id))).filter(Boolean);
  });

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
    else { S.saved.unshift(snap(e)); toast('Saved'); }
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
    const meta = [withArt ? esc(e.st) : '', esc(day(e.d)), esc(epNum(e)), e.v ? I.video : ''].filter(Boolean).join(' · ');
    const saved = isSaved(e.k);
    return '<article class="ep' + (played ? ' played' : '') + '" style="--i:' + (i || 0) + '">'
      + '<button class="epmain" type="button" data-ep="' + esc(e.k) + '">' + (withArt ? art(e.sa, 56) : '')
      + '<span class="eptx"><span class="epm">' + (fresh ? '<i class="dot" aria-label="New"></i>' : '') + meta + '</span>'
      + '<span class="ept">' + esc(e.t) + '</span>' + (e.s ? '<span class="epd">' + esc(e.s) + '</span>' : '') + '</span></button>'
      + '<div class="epbar">' + pill(e) + '<span class="grow"></span>'
      + '<button class="icbtn" type="button" data-save="' + esc(e.k) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove from Saved' : 'Save episode') + '">' + (saved ? I.bmOn : I.bm) + '</button>'
      + '<button class="icbtn" type="button" data-more="' + esc(e.k) + '" aria-label="More for this episode">' + I.more + '</button></div></article>';
  }
  const upCard = (e, i) => '<article class="upcard glass" style="--i:' + i + '"><button class="uptop" type="button" data-ep="' + esc(e.k) + '">' + art(e.sa, 64)
    + '<span class="uptx"><span class="upm">' + esc(e.st) + '</span><span class="upt">' + esc(e.t) + '</span></span></button>'
    + '<div class="upbar">' + pill(e) + '<span class="upd">' + esc(day(e.d)) + '</span></div></article>';
  const chip = (act, label, on, n) => '<button class="chip glass" type="button" data-act="' + act + '" aria-pressed="' + !!on + '">' + label + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</button>';
  const emptyCard = (title, text, btn) => '<div class="empty glass">' + I.headph + '<strong>' + title + '</strong><span>' + text + '</span>' + (btn || '') + '</div>';
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
      h += emptyCard('Find something to listen to', 'Follow shows and their new episodes show up here. Video podcasts play right in the player.',
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
        : emptyCard('No saved episodes', 'Tap the bookmark on any episode to keep it here.');
    } else if (st.lib === 'hist') {
      const eps = S.hist.map(x => getEp(x.k) || x);
      h = eps.length ? '<div class="rgroup glass">' + eps.map((e, i) => epRow(e, true, i)).join('') + '</div><button class="morebtn" type="button" data-act="hist-clear">Clear history</button>'
        : emptyCard('Nothing played yet', 'Episodes you play show up here.');
    } else if (!S.follows.length) {
      h = emptyCard('No shows yet', 'Search for a show and tap Follow, or import your shows from another app in Settings.',
        '<button class="btn" type="button" data-act="go-search">' + I.search + 'Search podcasts</button>');
    } else {
      const list = [...S.follows].sort((a, b) => (b.latest || 0) - (a.latest || 0) || (b.at || 0) - (a.at || 0));
      h = '<div class="sgrid">' + list.map((f, i) => {
        const sh = shows.get(f.id), title = f.title || (sh && sh.title) || 'Loading…';
        return '<button class="stile" type="button" data-show="' + esc(f.id) + '" style="--i:' + i + '">' + art(f.art || (sh && (sh.itArt || sh.art)), 0, 'fill')
          + '<span class="sn">' + esc(title) + '</span>'
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
      + '<span class="stx"><b>' + esc(r.title) + '</b><span>' + esc(r.feed ? [r.author, r.genre].filter(Boolean).join(' · ') : 'Only on Apple Podcasts') + '</span></span></button>'
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
      h += '</section><p class="hint">Can’t find a show? Paste its RSS feed link in the search box. Private and premium feeds work too.</p>';
    } else if (looksLikeFeed(q)) {
      st.list = [{title: 'Open this feed', author: feedFromInput(q), feed: feedFromInput(q), art: '', genre: ''}];
      h = '<div class="rgroup glass">' + srow(st.list[0], 0) + '</div><p class="hint">Opens the show so you can see its episodes and follow it.</p>';
    } else if (st.searchErr) {
      h = '<div class="notice glass"><span>' + esc(st.searchErr) + '</span><button class="linkbtn" type="button" data-act="search-retry">Try again</button></div>';
    } else if (!st.results || st.searching) {
      h = '<div class="skel"></div><div class="skel"></div>';
    } else {
      st.list = st.results;
      h = st.results.length ? '<div class="rgroup glass">' + st.results.map((r, i) => srow(r, i)).join('') + '</div>'
        : '<div class="empty glass"><strong>No shows found</strong><span>Try other words, or paste the show’s feed link.</span></div>';
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
      + '<h2>' + esc(title || 'Loading…') + '</h2>' + (author ? '<span class="by">' + esc(author) + '</span>' : '')
      + (meta ? '<span class="hm">' + esc(meta) + '</span>' : '')
      + '<button class="pillbtn follow' + (f ? '' : ' bluec') + '" type="button" data-act="follow-show"' + (sh || m.feed ? '' : ' disabled') + '>' + (f ? I.check + 'Following' : I.plus + 'Follow') + '</button></div>';
    if (sh && sh.desc) h += '<p class="desc' + (st.descOpen ? ' open' : '') + '" data-act="desc">' + esc(plain(sh.desc)) + '</p>';
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
  window.addEventListener('resize', () => {
    slideTabs(true); slideChips($('libView'), 'lib', {jump:true}); slideChips($('homeBody'), 'new', {jump:true}); slideChips($('showBody'), 'sf', {group: st.show, jump:true}); slideOpts(true);
  });
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
  function choose(title, rows){
    choices = rows;
    $('actLbl').textContent = title;
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
    choose(e.t, rows);
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
    if (feed) rows.push({label:'Share Show', sub:'A link that opens it in this app', icon:I.share, run:() => share(sh ? sh.title : '', 'Podcast', showLink(feed))});
    if (feed) rows.push({label:'Copy Feed Link', icon:I.link, run:async () => { try { await navigator.clipboard.writeText(feed); toast('Feed link copied'); } catch(e) { toast(feed); } }});
    if (feed) rows.push({label:'Check for New Episodes', icon:I.refresh, run:async () => {
      st.showErr = '';
      try { await loadShow(feed, id, st.showMeta); toast('Up to date'); } catch(e) { toast(e.message || 'Couldn’t update'); }
      if (st.show === id) renderShow();
    }});
    if (f) rows.push({label:'Unfollow', icon:I.unfollow, danger:true, run:() => unfollow(id)});
    choose((sh && sh.title) || (f && f.title) || 'Show', rows);
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
    const meta = [day(e.d), e.dur ? len(e.dur) : '', epNum(e), e.v ? 'Video' : ''].filter(Boolean).join(' · ');
    $('epBody').innerHTML = '<div class="ephead">' + art(e.img || e.sa, 84) + '<span class="eptx"><button class="epshow" type="button" data-show="' + esc(e.sid) + '">' + esc(e.st) + '</button>'
      + '<span class="epm">' + esc(meta) + '</span></span></div><h3 class="eph">' + esc(e.t) + '</h3>'
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
    S.hist = [cur, ...S.hist.filter(x => x.k !== e.k)].slice(0, 100);
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
    if ($('miniTitle').textContent !== cur.t) {
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
      + '<span class="stx"><b>' + esc(e.t) + '</b><span>' + esc([e.st, e.dur ? len(e.dur) : ''].filter(Boolean).join(' · ')) + '</span></span></button>'
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
  // first open only records the fingerprint.
  (function(){
    const src = [...document.querySelectorAll('style, script:not([src])')].map(e => e.textContent).join('');
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
