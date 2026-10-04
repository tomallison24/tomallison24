// Places: where you want to go and where you've been. See README.md.
(() => {
  'use strict';
  const P = window.PlacesParse;
  const slide = (window.AllisonOS && window.AllisonOS.slide) || (() => {});
  const KEY = 'allison-places-v1', SYNC_KEY = KEY + '-sync', GRAVE_KEY = KEY + '-graves', HERE_KEY = KEY + '-here', AT_KEY = KEY + '-synced';
  const NOTES_SYNC = 'allison-notes-v1-sync';        // Notes' Google Sheet link and secret, when this browser has them
  // The map is CARTO's (OpenStreetMap data), with the same free key as Weather's radar map.
  const CARTO_KEY = 'cb1_48id_1_0ed95665ed15e6f191380e40';
  const PHOTON = 'https://photon.komoot.io';          // OpenStreetMap search
  const OVERPASS = 'https://overpass-api.de/api/interpreter';   // a place's OpenStreetMap tags
  const DAY = 864e5, KEEP_GRAVES = 180 * DAY;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { toast('This phone couldn’t save: storage is full.'); } },
  };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const miles = /^en-(US|LR|MM)$/i.test(navigator.language || 'en-US');

  // ---------- data ----------
  // A place: { id, name, status: 'want'|'been', rating 0-5, price 0-4, planned, visited (YYYY-MM-DD, the latest visit),
  //   visits [YYYY-MM-DD, newest first], cal {uid, at} (added from the Family calendar: scripts/from-calendar.mjs),
  //   notes, tags[], lat, lon, address, city, category, emoji, osm {type, id}, info {hours, phone, website, cuisine, at},
  //   created, updated }
  function tidy(p) {
    const s = (v, n) => String(v == null ? '' : v).slice(0, n);
    const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
    const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
    return {
      id: s(p.id, 40) || newId(), name: s(p.name, 200), status: p.status === 'been' ? 'been' : 'want',
      rating: Math.max(0, Math.min(5, Math.round(n(p.rating) || 0))), price: Math.max(0, Math.min(4, Math.round(n(p.price) || 0))),
      planned: date(p.planned), visited: date(p.visited), notes: s(p.notes, 5000),
      visits: [...new Set((Array.isArray(p.visits) ? p.visits : []).concat(p.visited || []).map(date).filter(Boolean))].sort().reverse().slice(0, 200),
      cal: p.cal && typeof p.cal.uid === 'string' ? { uid: s(p.cal.uid, 300), at: n(p.cal.at) || 0 } : null,
      tags: Array.isArray(p.tags) ? p.tags.map(t => s(t, 40)).filter(Boolean).slice(0, 30) : [],
      lat: n(p.lat), lon: n(p.lon), address: s(p.address, 300), city: s(p.city, 100), category: s(p.category, 60), emoji: s(p.emoji, 8) || '📍',
      osm: p.osm && /^(node|way|relation)$/.test(p.osm.type) && n(p.osm.id) ? { type: p.osm.type, id: n(p.osm.id) } : null,
      info: p.info && typeof p.info === 'object' ? { hours: s(p.info.hours, 400), phone: s(p.info.phone, 60), website: s(p.info.website, 300), cuisine: s(p.info.cuisine, 120), at: n(p.info.at) || 0 } : null,
      created: n(p.created) || Date.now(), updated: n(p.updated) || 0,
    };
  }
  let places = store.get(KEY, []).map(tidy);
  let graves = store.get(GRAVE_KEY, {});
  let syncCfg = store.get(SYNC_KEY, null);
  const st = {
    tab: 'want', view: 'list', q: '', tag: null,
    sort: Object.assign({ want: 'soon', been: 'recent' }, store.get(KEY + '-sort', {})),
    here: store.get(HERE_KEY, null), edit: null, editIsNew: false, lastSync: store.get(AT_KEY, 0),
    layers: Object.assign({ food: true, fun: true, shops: false }, store.get(KEY + '-layers', {})),   // businesses shown on the map
  };
  function persist() {
    const cut = Date.now() - KEEP_GRAVES;
    for (const k of Object.keys(graves)) if (graves[k] < cut) delete graves[k];
    store.set(KEY, places); store.set(GRAVE_KEY, graves);
  }
  function save() { persist(); render(); if (syncCfg) scheduleSync(); }
  const tagsOf = text => [...new Set((String(text || '').match(/(^|\s)#[a-z0-9][\w-]*/gi) || []).map(t => t.trim().slice(1).toLowerCase()))];

  // ---------- small helpers for the list ----------
  const distOf = p => st.here && p.lat != null ? P.distance(st.here, p) : null;
  function fmtDist(m) {
    if (m == null) return '';
    if (m < 30) return 'here';
    if (miles) { const mi = m / 1609.344; return mi < 0.1 ? Math.round(m * 3.28084 / 50) * 50 + ' ft' : (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + ' mi'; }
    return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' km';
  }
  function fmtDate(d) {
    if (!d) return '';
    if (d === today()) return 'Today';
    const t = new Date(d + 'T12:00'), y = new Date().getFullYear();
    return t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: t.getFullYear() === y ? undefined : 'numeric' });
  }
  const starsHtml = n => '<span class="stars" aria-label="' + n + ' out of 5 stars">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span></span>';
  const priceTxt = n => n ? '$'.repeat(n) : '';

  // ---------- the list ----------
  const LAYERS = [['food', '🍽️ Food & drink'], ['fun', '🎭 Things to do'], ['shops', '🛍️ Shops']];
  const SORTS = { want: [['soon', 'Soonest'], ['near', 'Nearest'], ['new', 'Newest']], been: [['recent', 'Recent'], ['top', 'Top rated'], ['near', 'Nearest']] };
  function shown() {
    const q = st.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    return places.filter(p => p.status === st.tab && (!st.tag || p.tags.includes(st.tag)) && words.every(w => w.startsWith('#')
      ? p.tags.some(t => t.startsWith(w.slice(1)))
      : (p.name + ' ' + p.category + ' ' + p.address + ' ' + p.city + ' ' + p.notes).toLowerCase().includes(w)));
  }
  function sorted(list) {
    const s = st.sort[st.tab], byNew = (a, b) => b.created - a.created;
    if (s === 'near' && st.here) return list.slice().sort((a, b) => (distOf(a) ?? 1e12) - (distOf(b) ?? 1e12));
    if (s === 'top') return list.slice().sort((a, b) => b.rating - a.rating || String(b.visited || '').localeCompare(String(a.visited || '')));
    if (s === 'recent') return list.slice().sort((a, b) => String(b.visited || '').localeCompare(String(a.visited || '')) || byNew(a, b));
    if (s === 'soon') return list.slice().sort((a, b) => String(a.planned || '9999').localeCompare(String(b.planned || '9999')) || byNew(a, b));
    return list.slice().sort(byNew);
  }
  function row(p) {
    const d = distOf(p);
    const sub = [p.category, p.city || (p.address || '').split(',')[0], fmtDist(d)].filter(Boolean).join(' · ') || (p.notes || '').split('\n')[0];
    const right = p.status === 'been'
      ? (p.rating ? starsHtml(p.rating) : '') + (p.price ? '<span class="price">' + priceTxt(p.price) + '</span>' : '') + (p.visited ? '<span>' + esc(fmtDate(p.visited)) + (p.visits.length > 1 ? ' · ' + p.visits.length + '×' : '') + '</span>' : '')
      : (p.planned ? '<span class="when">' + esc(fmtDate(p.planned)) + '</span>' : '') + (p.price ? '<span class="price">' + priceTxt(p.price) + '</span>' : '');
    return '<button class="row" type="button" data-id="' + esc(p.id) + '"><span class="em" aria-hidden="true">' + esc(p.emoji) + '</span>'
      + '<span class="t"><b>' + esc(p.name || 'Untitled') + '</b><small>' + esc(sub) + '</small></span><span class="r">' + right + '</span></button>';
  }
  function render() {
    const want = places.filter(p => p.status === 'want').length, been = places.length - want;
    $('nWant').textContent = want; $('nBeen').textContent = been;
    $('sub').textContent = places.length ? (places.length + (places.length === 1 ? ' place' : ' places')) + syncLabel() : syncLabel().replace(/^ · /, '');
    document.querySelectorAll('#seg [data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === st.tab));
    slide($('seg'), $('seg').querySelector('[aria-pressed="true"]'), 'tab');
    const tags = [...new Set(places.filter(p => p.status === st.tab).flatMap(p => p.tags))].sort();
    if (st.tag && !tags.includes(st.tag)) st.tag = null;
    $('chips').innerHTML = st.view === 'map' ? LAYERS.map(([k, n]) => '<button class="chip glass" type="button" data-layer="' + k + '" aria-pressed="' + !!st.layers[k] + '">' + n + '</button>').join('') : SORTS[st.tab].map(([k, n]) => '<button class="chip glass" type="button" data-sort="' + k + '" aria-pressed="' + (st.sort[st.tab] === k) + '">' + n + '</button>').join('')
      + tags.map(t => '<button class="chip glass" type="button" data-tag="' + esc(t) + '" aria-pressed="' + (st.tag === t) + '">#' + esc(t) + '</button>').join('');
    $('viewBtn').innerHTML = st.view === 'map' ? ICON.list : ICON.map;
    $('viewBtn').setAttribute('aria-label', st.view === 'map' ? 'Show the list' : 'Show the map');
    $('viewBtn').setAttribute('aria-pressed', st.view === 'map');
    $('syncBtn').innerHTML = ICON.cloud;

    const list = sorted(shown());
    let h = '';
    if (!list.length) {
      const any = places.some(p => p.status === st.tab);
      h = '<div class="empty glass"><strong>' + (any ? 'Nothing matches' : st.tab === 'want' ? 'Nowhere yet' : 'Nothing rated yet') + '</strong>'
        + (any ? 'Try another word or tag.' : st.tab === 'want' ? 'Tap + to add a place you’d like to go: search, use where you are, or paste a link from Apple Maps.'
          : 'When you’ve been somewhere, open it and tap Been, then give it stars.') + '</div>';
    } else if (st.tab === 'want' && st.sort.want === 'soon') {
      const t = today(), soon = list.filter(p => p.planned && p.planned >= t), some = list.filter(p => !p.planned), gone = list.filter(p => p.planned && p.planned < t);
      for (const [label, g] of [['Coming up', soon], ['Someday', some], ['Date passed', gone]]) if (g.length) h += group(label, g);
    } else h = group(st.sort[st.tab] === 'near' && !st.here ? 'Newest (tap Nearest again once location is allowed)' : SORTS[st.tab].find(s => s[0] === st.sort[st.tab])[1], list);
    $('list').innerHTML = h;
    if (st.view === 'map') { drawPins(list); if (biz) drawBusinesses(); }
  }
  const group = (label, g) => '<section class="group glass"><h2><span>' + esc(label) + '</span><span>' + g.length + '</span></h2>' + g.map(row).join('') + '</section>';

  const ICON = {
    map: '<svg class="i" viewBox="0 0 24 24"><path d="M9 4.5L3.8 6.6v12.9L9 17.4l6 2.1 5.2-2.1V4.5L15 6.6z"/><path d="M9 4.5v12.9M15 6.6v12.9"/></svg>',
    list: '<svg class="i" viewBox="0 0 24 24"><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><circle cx="4.6" cy="6.5" r="1" fill="currentColor"/><circle cx="4.6" cy="12" r="1" fill="currentColor"/><circle cx="4.6" cy="17.5" r="1" fill="currentColor"/></svg>',
    cloud: '<svg class="i" viewBox="0 0 24 24"><path d="M7.2 18.6h10a3.9 3.9 0 0 0 .6-7.8 5.6 5.6 0 0 0-10.9-.9A4.4 4.4 0 0 0 7.2 18.6z"/><path d="M12 15.6v-5M9.8 12.6l2.2-2.2 2.2 2.2"/></svg>',
  };

  $('seg').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b && st.tab !== b.dataset.tab) { st.tab = b.dataset.tab; st.tag = null; render(); } });
  $('chips').addEventListener('click', async e => {
    const s = e.target.closest('[data-sort]'), t = e.target.closest('[data-tag]');
    if (s) {
      st.sort[st.tab] = s.dataset.sort; store.set(KEY + '-sort', st.sort); render();
      if (s.dataset.sort === 'near') { try { await locate(); render(); } catch (err) { toast(err.message); } }
    }
    if (t) { st.tag = st.tag === t.dataset.tag ? null : t.dataset.tag; render(); }
    const l = e.target.closest('[data-layer]');
    if (l) { st.layers[l.dataset.layer] = !st.layers[l.dataset.layer]; store.set(KEY + '-layers', st.layers); render(); loadBusinesses(true); }
  });
  $('filter').addEventListener('input', e => { st.q = e.target.value; render(); });
  $('list').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) openPlace(places.find(p => p.id === r.dataset.id)); });

  // ---------- where you are ----------
  function locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('Location isn’t available here.'));
      navigator.geolocation.getCurrentPosition(p => {
        st.here = { lat: p.coords.latitude, lon: p.coords.longitude }; store.set(HERE_KEY, st.here); res(st.here);
      }, e => rej(new Error(e.code === 1 ? 'Location is off for Places. Allow it in Settings → Privacy → Location Services.' : 'Couldn’t find where you are.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  // ---------- the map ----------
  let map = null, pins = null, me = null, fitted = false;
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  function ensureMap() {
    if (map || !window.L) return map;
    map = L.map('map', { zoomControl: false, tapHold: true, worldCopyJump: true }).setView(st.here ? [st.here.lat, st.here.lon] : [39.5, -98.35], st.here ? 12 : 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark() ? 'dark_all' : 'rastertiles/voyager') + '/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY,
      { subdomains: 'abcd', maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    biz = L.layerGroup().addTo(map);
    pins = L.layerGroup().addTo(map);
    // Touch and hold (or right-click) on the map: add a place there.
    map.on('contextmenu', e => addAt(e.latlng.lat, e.latlng.lng));
    map.on('moveend', () => { clearTimeout(bizTimer); bizTimer = setTimeout(() => loadBusinesses(), 700); });
    return map;
  }

  // ---------- businesses on the map (OpenStreetMap, through Overpass) ----------
  // Once you're zoomed in to streets, every named business in view, as a dot
  // coloured by group: tap one for its card, and add it from there. The groups
  // (Food & drink, Things to do, Shops) are the chips at the top in map view.
  // What came back is kept for the visit, so panning back costs nothing.
  const BIZ_ZOOM = 15, BIZ_COLOR = { food: '#FF6B57', fun: '#8E6CFF', shops: '#15A3A3' };
  let biz = null, bizTimer = null, bizCtl = null, bizBox = null, bizShown = new Map();
  const bizSeen = new Map();                         // 'node/123' -> place fields
  const bizKey = o => o.osm.type + '/' + o.osm.id;
  function hint(text) { $('mapHint').textContent = text || ''; $('mapHint').hidden = !text; }
  async function loadBusinesses(force) {
    if (!map || st.view !== 'map') return;
    const groups = Object.keys(st.layers).filter(k => st.layers[k]);
    if (!groups.length) { biz.clearLayers(); bizShown.clear(); hint(''); return; }
    if (map.getZoom() < BIZ_ZOOM) { biz.clearLayers(); bizShown.clear(); hint('Zoom in to see businesses'); return; }
    const view = map.getBounds();
    const sig = groups.join(',');
    if (!force && bizBox && bizBox.sig === sig && bizBox.bounds.contains(view)) return drawBusinesses();
    const wide = view.pad(0.25);
    if (bizCtl) bizCtl.abort();
    bizCtl = new AbortController();
    hint('Loading businesses…');
    try {
      const q = P.overpassQuery(groups, wide.getSouth(), wide.getWest(), wide.getNorth(), wide.getEast());
      const r = await fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: bizCtl.signal });
      if (!r.ok) throw new Error('Overpass ' + r.status);
      for (const el of (await r.json()).elements || []) {
        const o = P.fromElement(el);
        if (o.lat != null && o.osm && o.name && o.group) bizSeen.set(bizKey(o), o);
      }
      if (bizSeen.size > 4000) [...bizSeen.keys()].slice(0, bizSeen.size - 4000).forEach(k => bizSeen.delete(k));
      bizBox = { sig, bounds: wide };
      hint('');
      drawBusinesses();
    } catch (e) {
      if (e.name !== 'AbortError') hint('Couldn’t load businesses right now');
    }
  }
  function drawBusinesses() {
    const view = map.getBounds().pad(0.1), mine = new Set(places.filter(p => p.osm).map(p => p.osm.type + '/' + p.osm.id));
    const want = new Map();
    for (const [k, o] of bizSeen) if (st.layers[o.group] && !mine.has(k) && view.contains([o.lat, o.lon])) want.set(k, o);
    for (const [k, m] of bizShown) if (!want.has(k)) { biz.removeLayer(m); bizShown.delete(k); }
    for (const [k, o] of want) {
      if (bizShown.has(k)) continue;
      const m = L.circleMarker([o.lat, o.lon], { radius: 6, weight: 2, color: '#fff', fillColor: BIZ_COLOR[o.group], fillOpacity: 0.95, className: 'osm-dot osm-' + o.group })
        .bindPopup(() => bizCard(o), { className: 'bizpop', closeButton: false, autoPanPaddingTopLeft: [20, 200] })
        .addTo(biz);
      bizShown.set(k, m);
    }
  }
  function bizCard(o) {
    const i = o.info || {}, hours = i.hours ? P.hoursText(i.hours).split('\n')[0] : '';
    return '<div class="bizcard" data-biz="' + esc(bizKey(o)) + '"><b>' + esc(o.emoji) + ' ' + esc(o.name) + '</b>'
      + '<small>' + esc([o.category, i.cuisine].filter(Boolean).join(' · ')) + '</small>'
      + (o.address ? '<small>' + esc(o.address) + '</small>' : '') + (hours ? '<small>🕒 ' + esc(hours) + '</small>' : '')
      + '<div class="bizacts"><button type="button" data-bizadd="want">Want to go</button><button type="button" data-bizadd="been">Been</button><button type="button" data-bizdir>Directions</button></div></div>';
  }
  document.addEventListener('click', e => {
    const card = e.target.closest('.bizcard'); if (!card) return;
    const o = bizSeen.get(card.dataset.biz); if (!o) return;
    const add = e.target.closest('[data-bizadd]');
    if (add) {
      map.closePopup();
      const status = add.dataset.bizadd;
      openPlace(tidy(Object.assign({}, o, { id: newId(), status, visited: status === 'been' ? today() : null, created: Date.now(), updated: 0 })), true);
    }
    if (e.target.closest('[data-bizdir]')) location.href = 'https://maps.apple.com/?daddr=' + encodeURIComponent(o.lat.toFixed(6) + ',' + o.lon.toFixed(6)) + '&dirflg=d';
  });
  function drawPins(list) {
    if (!ensureMap()) return;
    pins.clearLayers();
    const pts = [];
    for (const p of list) {
      if (p.lat == null) continue;
      const icon = L.divIcon({ className: '', html: '<div class="pin ' + p.status + '"><span>' + esc(p.emoji) + '</span></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
      L.marker([p.lat, p.lon], { icon, title: p.name, keyboard: true }).on('click', () => openPlace(p)).addTo(pins);
      pts.push([p.lat, p.lon]);
    }
    if (!fitted && pts.length) { fitted = true; fit(pts); }
  }
  function fit(pts) {
    pts = pts || sorted(shown()).filter(p => p.lat != null).map(p => [p.lat, p.lon]);
    if (!pts.length) { if (st.here) map.setView([st.here.lat, st.here.lon], 13); return; }
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(pts, { padding: [40, 40], paddingTopLeft: [40, 220], maxZoom: 15 });
  }
  function setView(v) {
    st.view = v;
    document.body.classList.toggle('mapmode', v === 'map');
    document.documentElement.classList.toggle('locked', v === 'map');
    $('map').hidden = v !== 'map'; $('mapBtns').hidden = v !== 'map'; $('filterWrap').hidden = v === 'map';
    render();
    if (v === 'map' && map) setTimeout(() => { map.invalidateSize(); loadBusinesses(); }, 50);
    if (v !== 'map') hint('');
  }
  $('viewBtn').onclick = () => setView(st.view === 'map' ? 'list' : 'map');
  $('fitBtn').onclick = () => fit();
  $('locBtn').onclick = async () => {
    try {
      const h = await locate();
      if (me) me.setLatLng([h.lat, h.lon]); else me = L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }), interactive: false }).addTo(map);
      map.setView([h.lat, h.lon], Math.max(map.getZoom(), 14));
    } catch (e) { toast(e.message); }
  };

  // ---------- sheets ----------
  const focusBack = [];
  function openSheet(id) { focusBack.push(document.activeElement); $(id).hidden = false; document.documentElement.classList.add('locked'); }
  function closeSheet(id) {
    $(id).hidden = true;
    if (st.view !== 'map' && ![...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden)) document.documentElement.classList.remove('locked');
    const f = focusBack.pop(); if (f && f.focus && document.contains(f)) f.focus();
  }
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(w.id); }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeSheet(open.id);
  });

  let toastTimer;
  function toast(msg, undo) {
    $('toastMsg').textContent = msg; $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { $('toast').hidden = true; undo(); };
    $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, undo ? 5000 : 3500);
  }

  // ---------- adding ----------
  $('fab').onclick = () => {
    $('find').value = ''; $('results').hidden = true; $('results').innerHTML = ''; $('pasteBox').hidden = true;
    openSheet('addSheet'); setTimeout(() => $('find').focus(), 250);
  };
  let findCtl = null, findTimer = null, found = [];
  async function find(q) {
    q = q.trim();
    if (findCtl) findCtl.abort();
    if (q.length < 3) { $('results').hidden = true; $('findSpin').hidden = true; return; }
    findCtl = new AbortController();
    $('findSpin').hidden = false;
    const near = st.here ? '&lat=' + st.here.lat.toFixed(4) + '&lon=' + st.here.lon.toFixed(4) : '';
    try {
      const r = await fetch(PHOTON + '/api/?q=' + encodeURIComponent(q) + '&limit=10&lang=en' + near, { signal: findCtl.signal });
      const j = await r.json();
      found = (j.features || []).map(P.fromPhoton).filter(p => p.lat != null);
      $('results').innerHTML = found.length ? found.map((p, i) => '<button class="result" type="button" data-i="' + i + '"><span class="em">' + esc(p.emoji) + '</span><span><b>' + esc(p.name) + '</b><small>'
        + esc([p.category, p.address, fmtDist(distOf(p))].filter(Boolean).join(' · ')) + '</small></span></button>').join('')
        : '<p class="hint" style="padding:14px 6px">No matches on OpenStreetMap. Try fewer words, or add it by hand.</p>';
      $('results').hidden = false;
    } catch (e) {
      if (e.name === 'AbortError') return;
      $('results').innerHTML = '<p class="hint" style="padding:14px 6px">Search isn’t reachable right now. Check your connection.</p>'; $('results').hidden = false;
    } finally { $('findSpin').hidden = true; }
  }
  $('find').addEventListener('input', e => { clearTimeout(findTimer); const v = e.target.value; findTimer = setTimeout(() => find(v), 450); });
  $('findForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(findTimer); find($('find').value); });
  $('results').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const f = found[+b.dataset.i];
    const dup = f.osm && places.find(p => p.osm && p.osm.type === f.osm.type && p.osm.id === f.osm.id);
    closeSheet('addSheet');
    if (dup) { toast('Already in ' + (dup.status === 'been' ? 'Been' : 'Want to go')); return openPlace(dup); }
    openPlace(draft(f), true);
  });
  const draft = f => tidy(Object.assign({ status: st.tab, visited: st.tab === 'been' ? today() : null }, f, { id: newId(), created: Date.now(), updated: 0 }));

  async function reverse(lat, lon) {
    try {
      const r = await fetch(PHOTON + '/reverse?lat=' + lat + '&lon=' + lon + '&lang=en&limit=1');
      const f = ((await r.json()).features || [])[0];
      return f ? P.fromPhoton(f) : null;
    } catch { return null; }
  }
  async function addAt(lat, lon) {
    const near = await reverse(lat, lon);
    const p = draft({ lat, lon, name: near && near.isPlace ? near.name : '', address: near ? near.address : '', city: near ? near.city : '',
      category: near && near.isPlace ? near.category : '', emoji: near && near.isPlace ? near.emoji : '📍', osm: near && near.isPlace ? near.osm : null });
    openPlace(p, true);
    if (!p.name) setTimeout(() => $('plName').focus(), 300);
  }
  $('addHere').onclick = async () => {
    $('addHere').disabled = true;
    try { const h = await locate(); closeSheet('addSheet'); await addAt(h.lat, h.lon); }
    catch (e) { toast(e.message); }
    finally { $('addHere').disabled = false; }
  };
  $('addBlank').onclick = () => { closeSheet('addSheet'); openPlace(draft({}), true); setTimeout(() => $('plName').focus(), 300); };
  $('addPaste').onclick = async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch {}
    if (text && await fromLink(text)) return;
    $('pasteBox').hidden = false; $('pasteText').value = text || ''; $('pasteText').focus();
  };
  $('pasteGo').onclick = () => fromLink($('pasteText').value);
  // A pasted Apple Maps or Google Maps link: its name and position, then the matching
  // OpenStreetMap place if there is one within 150 m (for its type, hours and so on).
  async function fromLink(text) {
    const l = P.mapLink(text);
    if (!l) { toast('That doesn’t look like a map link.'); return false; }
    if (l.short) { toast('That’s a short link, which Places can’t open. Search for the place by name instead.'); return false; }
    let lat = l.lat, lon = l.lon, extra = {};
    try {
      const q = l.name || l.address;
      if (q) {
        const near = lat != null ? '&lat=' + lat + '&lon=' + lon : '';
        const j = await (await fetch(PHOTON + '/api/?q=' + encodeURIComponent(q) + '&limit=5&lang=en' + near)).json();
        const cands = (j.features || []).map(P.fromPhoton).filter(p => p.lat != null);
        const best = lat != null ? cands.find(c => P.distance({ lat, lon }, c) < 150) : cands[0];
        if (best) { extra = best; if (lat == null) { lat = best.lat; lon = best.lon; } }
      }
    } catch {}
    closeSheet('addSheet');
    const p = draft(Object.assign({}, extra, { name: l.name || extra.name || '', address: l.address || extra.address || '', lat, lon }));
    const dup = p.osm && places.find(x => x.osm && x.osm.type === p.osm.type && x.osm.id === p.osm.id);
    if (dup) { toast('Already in ' + (dup.status === 'been' ? 'Been' : 'Want to go')); openPlace(dup); return true; }
    openPlace(p, true);
    return true;
  }

  // ---------- one place ----------
  function openPlace(p, isNew) {
    if (!p) return;
    st.edit = JSON.parse(JSON.stringify(p)); st.editIsNew = !!isNew;
    $('plName').value = p.name; $('plNotes').value = p.notes;
    $('plLbl').textContent = isNew ? 'New place' : (p.status === 'been' ? 'Been' : 'Want to go');
    $('plDelete').hidden = !!isNew;
    renderPlace();
    openSheet('placeSheet');
    slide($('plStatus'), $('plStatus').querySelector('[aria-checked="true"]'), 'plStatus', { jump: true });
    if (p.osm && (!p.info || Date.now() - p.info.at > 7 * DAY)) loadInfo(st.edit);
  }
  function renderPlace() {
    const p = st.edit, been = p.status === 'been';
    $('plMeta').textContent = [p.emoji !== '📍' ? p.emoji : '', p.category, p.address].filter(Boolean).join(' · ') || (p.lat != null ? 'Pinned on the map' : 'No map pin');
    document.querySelectorAll('#plStatus [data-st]').forEach(b => b.setAttribute('aria-checked', b.dataset.st === p.status));
    slide($('plStatus'), $('plStatus').querySelector('[aria-checked="true"]'), 'plStatus');
    $('plRateField').hidden = !been;
    $('plRate').innerHTML = [1, 2, 3, 4, 5].map(n => '<button type="button" role="radio" data-r="' + n + '" aria-checked="' + (p.rating === n) + '" aria-label="' + n + (n === 1 ? ' star' : ' stars') + '" class="' + (n <= p.rating ? 'on' : '') + '">★</button>').join('');
    $('plPrice').innerHTML = [1, 2, 3, 4].map(n => '<button class="opt" type="button" role="radio" data-p="' + n + '" aria-checked="' + (p.price === n) + '">' + '$'.repeat(n) + '</button>').join('');
    $('plDateLbl').textContent = been ? 'Went on' : 'Planned for';
    const others = been ? p.visits.filter(v => v !== p.visited) : [];
    $('plDateHint').textContent = been ? (others.length ? 'Been ' + (others.length + 1) + ' times. Before that: ' + others.map(fmtDate).join(', ') + '.' : 'The day you went. Been is sorted most recent first.')
      : 'An event or a booking? Put its date here. Want to go is sorted soonest first.';
    $('plAgain').hidden = !been || p.visited === today();
    $('plCal').hidden = !p.cal;
    $('plDate').value = (been ? p.visited : p.planned) || '';
    $('plDateClear').hidden = !$('plDate').value;
    const i = p.info, rows = [];
    if (i && i.hours) rows.push(['🕒', esc(P.hoursText(i.hours))]);
    if (i && i.phone) rows.push(['📞', '<a href="tel:' + esc(i.phone.replace(/[^\d+]/g, '')) + '">' + esc(i.phone) + '</a>']);
    if (i && i.website) { let host = i.website; try { host = new URL(i.website).hostname.replace(/^www\./, ''); } catch {} rows.push(['🌐', '<a href="' + esc(i.website) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a>']); }
    if (i && i.cuisine) rows.push(['🍴', esc(i.cuisine)]);
    $('plInfoField').hidden = !p.osm;
    $('plInfo').innerHTML = rows.length ? rows.map(([k, v]) => '<div><span class="k">' + k + '</span><span class="v">' + v + '</span></div>').join('')
      : '<div><span class="v" style="color:var(--muted)">' + (p.infoLoading ? 'Looking it up…' : 'OpenStreetMap has no hours, phone or website for this place. Open in Apple Maps for more.') + '</span></div>';
    $('plMapRow').hidden = p.lat == null && !p.address;
  }
  async function loadInfo(p) {
    p.infoLoading = true; renderPlace();
    try {
      const q = '[out:json][timeout:15];' + p.osm.type + '(' + p.osm.id + ');out tags;';
      const r = await fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      const el = ((await r.json()).elements || [])[0];
      if (el) {
        const info = Object.assign(P.fromTags(el.tags), { at: Date.now() });
        p.info = info;
        if (el.tags && !p.category) { const k = Object.keys(el.tags).find(k => ['amenity', 'shop', 'tourism', 'leisure', 'historic'].includes(k)); if (k) { const kind = P.kindOf(k, el.tags[k]); p.category = kind.label; p.emoji = kind.emoji; } }
        // A saved place keeps what it learned even if you close without saving.
        const saved = places.find(x => x.id === p.id);
        if (saved) { saved.info = info; persist(); }
      }
    } catch {}
    delete p.infoLoading;
    if (st.edit === p && !$('placeSheet').hidden) renderPlace();
  }
  $('plStatus').addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    const p = st.edit; p.status = b.dataset.st;
    if (p.status === 'been' && !p.visited) p.visited = today();
    renderPlace();
  });
  $('plRate').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { const n = +b.dataset.r; st.edit.rating = st.edit.rating === n ? 0 : n; renderPlace(); } });
  $('plPrice').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { const n = +b.dataset.p; st.edit.price = st.edit.price === n ? 0 : n; renderPlace(); } });
  $('plDate').addEventListener('change', e => {
    const p = st.edit, v = e.target.value || null;
    if (p.status === 'been') { p.visits = p.visits.filter(x => x !== p.visited); p.visited = v; } else p.planned = v;
    renderPlace();
  });
  $('plDateClear').onclick = () => { const p = st.edit; if (p.status === 'been') { p.visits = p.visits.filter(x => x !== p.visited); p.visited = p.visits[0] || null; } else p.planned = null; renderPlace(); };
  $('plToday').onclick = () => { st.edit[st.edit.status === 'been' ? 'visited' : 'planned'] = today(); renderPlace(); };
  // Went again: today becomes the latest visit, and the earlier ones are kept.
  $('plAgain').onclick = () => { const p = st.edit; if (p.visited) p.visits = [...new Set([p.visited, ...p.visits])]; p.visited = today(); renderPlace(); };
  $('plSave').onclick = () => {
    const p = st.edit;
    p.name = $('plName').value.trim(); p.notes = $('plNotes').value.replace(/\s+$/, ''); p.tags = tagsOf(p.notes);
    if (!p.name) { $('plName').focus(); toast('Give it a name first.'); return; }
    delete p.infoLoading;
    const clean = tidy(Object.assign(p, { updated: Date.now() })), i = places.findIndex(x => x.id === clean.id);
    if (i >= 0) places[i] = clean; else places.push(clean);
    delete graves['places:' + clean.id];
    const moved = clean.status !== st.tab;
    closeSheet('placeSheet'); save();
    if (st.editIsNew || moved) toast((st.editIsNew ? 'Added to ' : 'Moved to ') + (clean.status === 'been' ? 'Been' : 'Want to go'));
  };
  $('plDelete').onclick = () => {
    const i = places.findIndex(x => x.id === st.edit.id); if (i < 0) return;
    const gone = places[i];
    places.splice(i, 1); graves['places:' + gone.id] = Date.now();
    closeSheet('placeSheet'); save();
    toast('Deleted ' + (gone.name || 'place'), () => { gone.updated = Date.now(); places.splice(i, 0, gone); delete graves['places:' + gone.id]; save(); });
  };
  // Apple Maps: directions there from wherever you are, or the place itself.
  const target = p => p.lat != null ? p.lat.toFixed(6) + ',' + p.lon.toFixed(6) : p.address;
  $('plDirections').onclick = () => { const p = st.edit; location.href = 'https://maps.apple.com/?daddr=' + encodeURIComponent(target(p)) + '&dirflg=d'; };
  $('plOpen').onclick = () => {
    const p = st.edit, name = $('plName').value.trim() || p.name;
    location.href = p.lat != null ? 'https://maps.apple.com/?ll=' + target(p) + '&q=' + encodeURIComponent(name || 'Place')
      : 'https://maps.apple.com/?q=' + encodeURIComponent([name, p.address].filter(Boolean).join(', '));
  };

  // ---------- Google Sheet sync (the same Sheet as Notes) ----------
  let syncing = false, again = false, syncTimer = null, syncState = syncCfg ? 'idle' : 'off', syncErr = '';
  const ERR = {
    'wrong-secret': 'The secret code doesn’t match the one in the script.',
    'secret-not-set': 'The script still has CHANGE-ME as its secret.',
    'busy': 'The Sheet was busy. Trying again shortly.',
    'network': 'Couldn’t reach the Sheet. You may be offline.',
    'not-json': 'That link didn’t answer like the Notes script. Check it ends in /exec.',
    'old-script': 'The Sheet’s script needs updating for Places: paste the new notes/google-sheet-sync.gs and deploy a new version (Notes README, “Changing the script later”).',
  };
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const syncLabel = () => !syncCfg ? '' : syncState === 'syncing' ? ' · Syncing…' : syncState === 'error' ? ' · Not synced' : st.lastSync ? ' · Synced' : '';
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 1500 : ms); }
  async function sync(loud) {
    if (!syncCfg) return false;
    if (syncing) { again = true; return false; }
    syncing = true; syncState = 'syncing'; renderSync();
    let ok = false;
    try {
      let r, res;
      try {
        r = await fetch(syncCfg.url, { method: 'POST', redirect: 'follow', cache: 'no-store', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ secret: syncCfg.secret, action: 'places', v: 1, places, graves }) });
      } catch { throw new Error('network'); }
      try { res = await r.json(); } catch { throw new Error('not-json'); }
      if (!res || !res.ok) throw new Error((res && res.error) || 'not-json');
      if (!Array.isArray(res.places)) throw new Error('old-script');
      applyRemote(res);
      st.lastSync = Date.now(); store.set(AT_KEY, st.lastSync);
      syncState = 'ok'; syncErr = ''; ok = true;
    } catch (e) {
      syncState = 'error'; syncErr = e.message;
      if (loud) toast(ERR[syncErr] || 'Sync didn’t work. Trying again later.');
    } finally {
      syncing = false; renderSync();
      if (again) { again = false; scheduleSync(800); }
    }
    return ok;
  }
  function applyRemote(res) {
    for (const [k, t] of Object.entries(res.graves || {})) if (k.startsWith('places:') && (graves[k] || 0) < +t) graves[k] = +t;
    const byId = new Map(places.map(p => [p.id, p]));
    let mine = false;
    for (const r of res.places) {
      if (!r || typeof r.id !== 'string') continue;
      const l = byId.get(r.id);
      if (!l || (+r.updated || 0) > (+l.updated || 0)) byId.set(r.id, tidy(r));
      else if ((+l.updated || 0) > (+r.updated || 0)) mine = true;
    }
    const theirs = new Set(res.places.map(r => r && r.id));
    for (const l of places) if (!theirs.has(l.id) && !graves['places:' + l.id]) mine = true;
    places = [...byId.values()].filter(p => { const g = graves['places:' + p.id]; return !(g && g >= (+p.updated || 0)); });
    persist(); render();
    if (mine) again = true;
  }
  function renderSync() {
    const on = !!syncCfg;
    const line = !on ? 'Not connected. Places keeps your lists on this phone; connect the Google Sheet to share them with your wife’s phone and keep a copy.'
      : syncState === 'error' ? (ERR[syncErr] || 'Not synced.') : syncState === 'syncing' ? 'Syncing…' : st.lastSync ? 'Connected. Last synced ' + ago(st.lastSync) + '.' : 'Connected.';
    $('syStatus').textContent = line;
    $('syForm').hidden = on; $('syOn').hidden = !on;
    const notes = store.get(NOTES_SYNC, null);
    $('syNotes').hidden = on || !(notes && notes.url && notes.secret);
    $('sub').textContent = places.length ? (places.length + (places.length === 1 ? ' place' : ' places')) + syncLabel() : syncLabel().replace(/^ · /, '');
  }
  async function connect(url, secret) {
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { $('syStatus').textContent = 'Paste the web app link from Apps Script. It starts with https://script.google.com/ and ends in /exec.'; return; }
    if (!secret) { $('syStatus').textContent = 'Enter the secret code you put in the script.'; return; }
    const before = syncCfg;
    syncCfg = { url, secret };
    $('syConnect').disabled = true; $('syStatus').textContent = 'Connecting…';
    const ok = await sync(false);
    $('syConnect').disabled = false;
    if (!ok) { const e = syncErr; syncCfg = before; renderSync(); $('syStatus').textContent = ERR[e] || 'Couldn’t connect.'; return; }
    store.set(SYNC_KEY, syncCfg); renderSync();
    toast('Connected. ' + places.length + (places.length === 1 ? ' place' : ' places') + ' in the Sheet.');
  }
  $('syncBtn').onclick = () => { renderSync(); if (syncCfg) { $('syUrl').value = syncCfg.url; $('sySecret').value = syncCfg.secret; } openSheet('syncSheet'); };
  $('syForm').addEventListener('submit', e => { e.preventDefault(); connect($('syUrl').value.trim(), $('sySecret').value.trim()); });
  $('syNotes').onclick = () => { const n = store.get(NOTES_SYNC, null); if (n) connect(n.url, n.secret); };
  $('syPaste').onclick = async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { $('syStatus').textContent = 'Couldn’t read the clipboard here. Paste the link and secret into the boxes instead.'; return; }
    const m = /#sync=([\w-]+)/.exec(text || '');
    if (!m) { $('syStatus').textContent = 'The clipboard doesn’t have a setup link. In Notes: the download button, Google Sheet sync, Copy setup link.'; return; }
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      $('syUrl').value = c.u; $('sySecret').value = c.s; connect(c.u, c.s);
    } catch { $('syStatus').textContent = 'That setup link is damaged. Copy it again.'; }
  };
  $('syNow').onclick = async () => { if (await sync(true)) toast('Synced'); };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    syncCfg = null; syncState = 'off'; store.set(SYNC_KEY, null); renderSync(); render();
    toast('Disconnected. Your places stay on this phone and in the Sheet.');
  };
  document.addEventListener('visibilitychange', () => { if (syncCfg && document.visibilityState === 'visible' && Date.now() - st.lastSync > 30000) sync(false); });
  window.addEventListener('online', () => { if (syncCfg) sync(false); });

  // ---------- start ----------
  render();
  slide($('seg'), $('seg').querySelector('[aria-pressed="true"]'), 'tab', { jump: true });
  window.addEventListener('resize', () => slide($('seg'), $('seg').querySelector('[aria-pressed="true"]'), 'tab', { jump: true }));
  if (syncCfg) setTimeout(() => sync(false), 400);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
