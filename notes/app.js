// notes's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
(function(){
  const KEY = 'allison-notes-v1';
  const COLORS = ['none','yellow','green','blue','pink','purple'];
  const LIST_COLORS = ['#3B82F6','#F59E0B','#10B981','#8B5CF6','#EC4899','#06B6D4','#EF4444'];
  // Lists, reminders and notes that arrive from outside this phone (a backup
  // file, the Sheet) are checked before they are kept, and every id and colour
  // is escaped where it is drawn as well, so nothing in them can become part of
  // the page. sane* fix only what is wrong and hand back anything that is
  // already fine untouched, so a good record is never stamped as changed.
  const okId = v => typeof v === 'string' && v.length > 0 && v.length <= 100;
  const okHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const hexOr = c => okHex(c) ? c : LIST_COLORS[0];
  const prioOf = t => [0, 1, 2, 3].includes(t.prio) ? t.prio : 0;
  const strs = a => Array.isArray(a) && a.every(x => typeof x === 'string');
  function saneList(l){
    if (!l || typeof l !== 'object' || !okId(l.id) || typeof l.name !== 'string') return null;
    return okHex(l.color) ? l : Object.assign({}, l, { color: LIST_COLORS[0] });
  }
  function saneTodo(t){
    if (!t || typeof t !== 'object' || !okId(t.id) || typeof t.title !== 'string') return null;
    const fix = {};
    if (t.prio != null && ![0, 1, 2, 3].includes(t.prio)) fix.prio = 0;
    if (t.done != null && typeof t.done !== 'boolean') fix.done = !!t.done;
    if (t.flagged != null && typeof t.flagged !== 'boolean') fix.flagged = !!t.flagged;
    if (t.list != null && typeof t.list !== 'string') fix.list = '';
    if (!strs(t.tags)) fix.tags = Array.isArray(t.tags) ? t.tags.filter(x => typeof x === 'string') : [];
    return Object.keys(fix).length ? Object.assign({}, t, fix) : t;
  }
  function saneNote(n){
    if (!n || typeof n !== 'object' || !okId(n.id) || typeof n.title !== 'string' || typeof n.body !== 'string') return null;
    const fix = {};
    if (n.color != null && !COLORS.includes(n.color)) fix.color = 'none';
    if (!strs(n.tags)) fix.tags = Array.isArray(n.tags) ? n.tags.filter(x => typeof x === 'string') : [];
    return Object.keys(fix).length ? Object.assign({}, n, fix) : n;
  }
  const saneAll = (arr, fn) => (Array.isArray(arr) ? arr : []).map(fn).filter(Boolean);
  let linkServer = null;   // a setup link's notification server, waiting for Connect (see takeSetupLink)
  const H = 3600e3, D = 24*H, now = Date.now();
  const I = {
    pin:'<svg viewBox="0 0 24 24"><path d="M9.2 3.4h5.6a.8.8 0 0 1 .6 1.3l-1 1.3v4.4l2.7 2.6a1 1 0 0 1-.7 1.7H7.6a1 1 0 0 1-.7-1.7l2.7-2.6V6l-1-1.3a.8.8 0 0 1 .6-1.3z"/><path d="M12 15v5.6"/></svg>',
    pinFill:'<svg viewBox="0 0 24 24" class="fs"><path d="M9.2 3.4h5.6a.8.8 0 0 1 .6 1.3l-1 1.3v4.4l2.7 2.6a1 1 0 0 1-.7 1.7H7.6a1 1 0 0 1-.7-1.7l2.7-2.6V6l-1-1.3a.8.8 0 0 1 .6-1.3z"/><path d="M12 15v5.6"/></svg>',
    bell:'<svg viewBox="0 0 24 24"><path d="M6 10.8a6 6 0 0 1 12 0v3.4a3.6 3.6 0 0 0 1.1 2.6l.2.2a1 1 0 0 1-.7 1.7H5.4a1 1 0 0 1-.7-1.7l.2-.2A3.6 3.6 0 0 0 6 14.2z"/><path d="M9.9 20.9a2.4 2.4 0 0 0 4.2 0"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3 2"/></svg>',
    grid:'<svg viewBox="0 0 24 24"><rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2.2"/><rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2.2"/><rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2.2"/></svg>',
    rows:'<svg viewBox="0 0 24 24"><rect x="3.6" y="4" width="16.8" height="6.4" rx="2.2"/><rect x="3.6" y="13.6" width="16.8" height="6.4" rx="2.2"/></svg>',
    x:'<svg viewBox="0 0 24 24" class="b"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M3.4 6.2h17.2"/><path d="M8.8 6.2V5.1a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.1"/><path d="M5.5 6.2l.8 12.2a2.8 2.8 0 0 0 2.8 2.6h5.8a2.8 2.8 0 0 0 2.8-2.6l.8-12.2"/><path d="M10 10.6v5.8M14 10.6v5.8"/></svg>',
    flag:'<svg viewBox="0 0 24 24"><path d="M5.2 21.2V4.6"/><path d="M5.2 4.6c1.9-1.2 3.9-1.4 6.1-.4s4.3 1 6.6-.2a.6.6 0 0 1 .9.5v8.3a1 1 0 0 1-.5.9c-2.1 1.1-4.3 1.1-7 0-2.1-.9-4.1-.7-6.1.4z"/></svg>',
    archive:'<svg viewBox="0 0 24 24"><rect x="2.8" y="3.4" width="18.4" height="5.4" rx="2.2"/><path d="M4.6 8.8v8.2a3.2 3.2 0 0 0 3.2 3.2h8.4a3.2 3.2 0 0 0 3.2-3.2V8.8"/><path d="M9.8 12.6h4.4"/></svg>',
    tag:'<svg viewBox="0 0 24 24"><path d="M3 11.4V5.6A2.6 2.6 0 0 1 5.6 3h5.8a2.6 2.6 0 0 1 1.8.8l7.2 7.2a2.6 2.6 0 0 1 0 3.7l-5.5 5.5a2.6 2.6 0 0 1-3.7 0l-7.2-7.2a2.6 2.6 0 0 1-.8-1.8z"/><circle cx="7.9" cy="7.9" r="1.6"/></svg>',
    sparkle:'<svg viewBox="0 0 24 24"><path d="M11 3.6l1.5 4.1a2.4 2.4 0 0 0 1.4 1.4l4.1 1.5-4.1 1.5a2.4 2.4 0 0 0-1.4 1.4L11 17.6l-1.5-4.1a2.4 2.4 0 0 0-1.4-1.4L4 10.6l4.1-1.5a2.4 2.4 0 0 0 1.4-1.4z"/><path d="M18.2 15.2l.6 1.6.6.6 1.6.6-1.6.6-.6.6-.6 1.6-.6-1.6-.6-.6-1.6-.6 1.6-.6.6-.6z"/></svg>',
    lock:'<svg viewBox="0 0 24 24" class="lk"><rect x="4.6" y="10.4" width="14.8" height="10.4" rx="3"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/></svg>',
    check:'<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    plus:'<svg viewBox="0 0 24 24" class="b"><path d="M12 5.2v13.6M5.2 12h13.6"/></svg>'
  };
  const VIEWS = { today:'Today', upcoming:'Upcoming', flagged:'Flagged', all:'All' };

  // ---------- dates ----------
  const iso = t => new Date(t).toISOString();
  const at = (days, hour) => { const d = new Date(now + days*D); d.setHours(hour,0,0,0); return iso(d); };
  const pad = n => String(n).padStart(2,'0');
  const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const dayOff = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
  const todayStr = () => ymd(new Date());
  const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return ymd(d); };

  // ---------- sample data ----------
  const SAMPLE_NOTES = [
    {id:'n1',title:'Welcome to Notes',body:'Tap the pencil (bottom right) to write a note.\nAdd tags with #, like #home or #ideas, then tap a tag to filter.\nSearch finds words and #tags.\nReminders live in the Reminders tab.\nCopied something from Claude? Tap the clipboard button next to the pencil to turn it into a note, or into reminders on the Reminders tab.\n\nEverything stays on this phone. Use the download button at the top to back up.',tags:['start'],color:'blue',pinned:true,reminder:null,created:now,updated:1}
  ];
  const SAMPLE_LISTS = [
    {id:'l1',updated:1,name:'Personal',color:'#3B82F6'},
    {id:'l2',updated:1,name:'Home',color:'#F59E0B'},
    {id:'l3',updated:1,name:'Groceries',color:'#10B981'},
    {id:'l4',updated:1,name:'Family',color:'#8B5CF6'}
  ];
  let _c = 0;
  const T = (list, title, o={}) => ({id:'t'+(++_c), list, title, notes:'', date:null, time:null, prio:0, flagged:false, done:false, doneAt:null, tags:[], created:now-_c*H, ...o});
  const SAMPLE_TODOS = [];

  const clone = x => JSON.parse(JSON.stringify(x));
  const saved = load();
  // Google Sheet sync (see "Google Sheet sync" further down).
  const SYNC_KEY = KEY + '-sync', GRAVE_KEY = KEY + '-graves', shadow = new Map();
  let syncCfg = null, graves = {};
  // Notifications (see "notifications" further down): this phone's choices.
  const PUSH_KEY = KEY + '-push';
  const push = {server:'', on:false, skip:[], nudges:true, morning:'09:00', tz:''};
  try { Object.assign(push, JSON.parse(localStorage.getItem(PUSH_KEY)) || {}); } catch(e) {}
  const savePush = () => { try { localStorage.setItem(PUSH_KEY, JSON.stringify(push)); } catch(e) {} };
  let pushDirty = false, pendingOpen = null;
  try { syncCfg = JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch(e) {}
  // The Sheet link and code are also kept in IndexedDB, so they survive if
  // localStorage is cleared or full (every AllisonOS app shares its space).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-notes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', st => st.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', st => v == null ? st.delete(k) : st.put(v, k)).catch(() => {})
    };
  })();
  let storeWarned = false;
  function storeFailed(){
    if (storeWarned) return; storeWarned = true;
    setTimeout(() => toast('This phone couldn’t save Notes: storage is full.' + (syncCfg ? ' Your notes are safe in the Google Sheet.' : ' Back up soon.')), 800);
  }
  function saveSyncCfg(){
    try { syncCfg ? localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg)) : localStorage.removeItem(SYNC_KEY); } catch(e) { storeFailed(); }
    keep.set('sync', syncCfg ? {url:syncCfg.url, secret:syncCfg.secret} : null);
  }
  try { graves = JSON.parse(localStorage.getItem(GRAVE_KEY)) || {}; } catch(e) {}
  let notes = saved ? saneAll(saved.notes, saneNote) : clone(SAMPLE_NOTES);
  // Every note has a creation time (older notes: read from their id), an
  // archived flag and a deletedAt time for Trash; Trash empties after 30 days.
  function fixNotes(){
    const idTime = id => { const m = /^n([0-9a-z]{8})/.exec(id || ''); const t = m ? parseInt(m[1], 36) : 0; return t > 1.5e12 && t < 4e12 ? t : 0; };
    notes.forEach(n => { if (!n.created) n.created = idTime(n.id) || n.updated || Date.now(); if (n.archived === undefined) n.archived = false; if (n.deletedAt === undefined) n.deletedAt = null; });
    notes = notes.filter(n => { const keep = !n.deletedAt || Date.now() - n.deletedAt < 30 * 864e5; if (!keep) graves['notes:' + n.id] = Date.now(); return keep; });
  }
  fixNotes();
  let lists = saved ? saneAll(saved.lists, saneList) : clone(SAMPLE_LISTS);
  if (!lists.length) lists = clone(SAMPLE_LISTS);
  let todos = saved ? saneAll(saved.todos, saneTodo) : clone(SAMPLE_TODOS);
  // What each item looked like at the last save, so any change anywhere in
  // the app stamps it with a new 'updated' time, and anything that vanished
  // is recorded as deleted (a "grave") for the other phone.
  function initShadow(){
    shadow.clear();
    [['notes', notes], ['todos', todos], ['lists', lists]].forEach(([kind, arr]) => arr.forEach(it => {
      if (!it.updated) it.updated = it.created || 1;
      const {updated, ...rest} = it; shadow.set(kind + ':' + it.id, JSON.stringify(rest));
    }));
  }
  function track(){
    const now = Date.now(), seen = new Set();
    [['notes', notes], ['todos', todos], ['lists', lists]].forEach(([kind, arr]) => arr.forEach(it => {
      const k = kind + ':' + it.id, {updated, ...rest} = it, j = JSON.stringify(rest);
      seen.add(k);
      if (shadow.get(k) !== j) { it.updated = now; shadow.set(k, j); delete graves[k]; }
    }));
    shadow.forEach((j, k) => { if (!seen.has(k)) { graves[k] = now; shadow.delete(k); } });
  }
  initShadow();
  const st = { tab:'notes', sel:new Set(), remOnly:false, q:'', view:'grid', editing:null, isNew:false,
               coll:null, rview:'today', rlist:null, rq:'', rsearch:false, showDone:false, todo:null, listEdit:null, shareFrom:null };
  try { st.view = localStorage.getItem(KEY+'-view') || 'grid'; st.tab = localStorage.getItem(KEY+'-tab') || 'notes'; } catch(e){}

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const normTag = s => s.trim().replace(/^#+/,'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-_]/g,'');
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const HUES = [211, 28, 268, 162, 340, 45, 190, 300, 120, 10];
  const hue = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
  const tchip = (t, q) => '<span class="tchip" style="--h:'+hue(t)+'">'+hl(t, q)+'</span>';
  function animateIn(el){ el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  function load(){ try { const v = JSON.parse(localStorage.getItem(KEY)); return v && Array.isArray(v.notes) ? v : null; } catch(e){ return null; } }
  function save(){ track(); persist(); if (syncCfg) scheduleSync(); pushDirty = true; }
  function persist(){ try { localStorage.setItem(KEY, JSON.stringify({notes, lists, todos})); localStorage.setItem(GRAVE_KEY, JSON.stringify(graves)); } catch(e){ storeFailed(); } }

  function countTags(items){
    const m = new Map();
    items.forEach(n => n.tags.forEach(t => m.set(t, (m.get(t)||0)+1)));
    return [...m.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  }
  const tokensOf = q => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isTagTok = t => t.startsWith('#') && t.length > 1;
  const matchQuery = (q, hay, tags) => tokensOf(q).every(tok => isTagTok(tok) ? tags.some(t => t.startsWith(tok.slice(1))) : hay.includes(tok));
  function hl(text, q){
    const terms = tokensOf(q).filter(t => !isTagTok(t));
    if (!terms.length) return esc(text);
    const re = new RegExp('(' + terms.map(reEsc).join('|') + ')', 'gi');
    return String(text).split(re).map((p,i) => i % 2 ? '<mark>'+esc(p)+'</mark>' : esc(p)).join('');
  }
  const extractTags = (text, into) => { (text.match(/(^|\s)#[a-z0-9][\w\-]*/gi) || []).forEach(m => { const t = normTag(m); if (t && !into.includes(t)) into.push(t); }); };

  // ---------- sheets, toast, tag editor ----------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap, #cook')].some(w => !w.hidden));
  function openSheet(id){ focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id){ $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { editor:() => finishEdit(), todoSheet:() => finishTodo() };
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) (closers[w.id] || (() => closeSheet(w.id)))();
  }));
  // Swipe a sheet down by its handle or title bar to close it. Not from the
  // content: on iPhone, dragging the content to reach the title (while the
  // keyboard moves things around) would otherwise close the sheet.
  // Keep sheets inside the part of the screen the keyboard leaves visible.
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  // When a field in a sheet gets focus, bring it into view inside the sheet.
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el.matches && el.matches('input') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({block:'nearest'}), 350);
  });
  const closeWrap = w => (closers[w.id] || (() => closeSheet(w.id)))();
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    if (sheet.classList.contains('page')) return;   // full pages close with their back button
    let y0 = null, t0 = 0, dy = 0, fromHead = false, dragging = false, suppressClick = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    function start(y, target){
      fromHead = !!target.closest('.grab, .sheethead');
      if (!fromHead) { y0 = null; return; }
      y0 = y; t0 = Date.now(); dy = 0; dragging = false;
    }
    function move(y, e){
      if (y0 === null) return;
      dy = y - y0;
      if (!dragging) {
        if (dy < -6 && !fromHead) { y0 = null; return; }        // scrolling up: leave it to the page
        if (dy < 8) return;
        dragging = true; sheet.classList.add('dragging');
      }
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
      if (dy > 110 || (fast && dy > 30)) {
        sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0';
        setTimeout(() => { closeWrap(w); reset(); }, 260);
      } else {
        sheet.style.transform = ''; scrim.style.opacity = '';
        setTimeout(reset, 300);
      }
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
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) (closers[open.id] || (() => closeSheet(open.id)))();
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

  function tagEditor(wrapId, inputId, getItem){
    const wrap = $(wrapId), input = $(inputId);
    function render(){
      wrap.querySelectorAll('.tchip').forEach(x => x.remove());
      getItem().tags.forEach(t => {
        const s = document.createElement('span');
        s.className = 'tchip';
        s.style.setProperty('--h', hue(t));
        s.innerHTML = esc(t)+'<button type="button" aria-label="Remove tag '+esc(t)+'">'+I.x+'</button>';
        s.querySelector('button').onclick = () => { const it = getItem(); it.tags = it.tags.filter(x => x !== t); render(); };
        input.before(s);
      });
    }
    function add(raw){ const t = normTag(raw), it = getItem(); if (t && !it.tags.includes(t)) it.tags.push(t); input.value = ''; render(); }
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); }
      else if (e.key === 'Backspace' && !input.value && getItem().tags.length) { getItem().tags.pop(); render(); }
    });
    input.addEventListener('change', () => { if (input.value.trim()) add(input.value); });
    return { render, flush(){ if (input.value.trim()) add(input.value); } };
  }

  // ---------- tabs ----------
  // Switches with a sliding glass thumb: the shared AllisonOS one (home/slide.js).
  const slide = window.AllisonOS.slide;
  const tabBar = document.querySelector('.tabs');
  const slideTabs = jump => slide(tabBar, tabBar.querySelector('.tab[aria-selected="true"]'), 'tabs', { jump });
  const slideRem = jump => { slide($('seg'), $('seg').querySelector('[aria-pressed="true"]'), 'seg', { jump }); slide($('listChips'), $('listChips').querySelector('.chip[aria-pressed="true"]'), 'lists', { jump }); };
  function setTab(t){
    if (st.tab !== t) window.scrollTo(0, 0);
    st.tab = t;
    try { localStorage.setItem(KEY+'-tab', t); } catch(e){}
    $('notesView').hidden = t !== 'notes';
    animateIn(t === 'notes' ? $('list') : $('remBody'));
    $('remView').hidden = t !== 'rem';
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    slideTabs();
    $('fab').setAttribute('aria-label', t === 'notes' ? 'New note' : 'New reminder');
    render();
  }
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('fab').onclick = () => {
    if (st.tab === 'notes') openEditor(null);
    else { window.scrollTo(0, 0); $('qa').focus(); }
  };

  function render(){
    $('tagList').innerHTML = countTags([...notes.filter(n => !n.deletedAt), ...todos]).map(([t]) => '<option value="'+esc(t)+'">').join('');
    if (st.tab === 'notes') renderNotes(); else renderRem();
  }

  // =====================================================================
  // NOTES
  // =====================================================================
  function fmtRem(s){
    const d = new Date(s), t = d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
    const day = x => { const c = new Date(x); c.setHours(0,0,0,0); return c.getTime(); };
    const diff = Math.round((day(d) - day(new Date())) / D);
    if (d.getTime() < Date.now()) return {txt:'Overdue', over:true};
    if (diff === 0) return {txt:'Today '+t};
    if (diff === 1) return {txt:'Tomorrow '+t};
    return {txt:d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})};
  }
  // ---------- where notes live: home, collections (tags), archive, trash ----------
  // st.coll: null = home; 'tag:<name>', 'untagged', 'all', 'nudges', 'archive', 'trash'.
  const TRASH_DAYS = 30;
  const alive = () => notes.filter(n => !n.deletedAt);
  const shelf = () => alive().filter(n => !n.archived);
  const byCreated = (a, b) => (b.created || 0) - (a.created || 0);
  const collName = c => c === 'untagged' ? 'No tag' : c === 'all' ? 'All notes' : c === 'nudges' ? 'Nudges' : c === 'private' ? 'Private' : c === 'archive' ? 'Archive' : c === 'trash' ? 'Trash'
    : c.slice(4).replace(/-/g, ' ').replace(/^./, x => x.toUpperCase());
  function inColl(n, c){
    if (c === 'trash') return !!n.deletedAt;
    if (n.deletedAt) return false;
    if (c === 'archive') return !!n.archived;
    if (n.archived) return false;
    if (c === 'all') return true;
    if (c === 'untagged') return !n.tags.length;
    if (c === 'nudges') return !!n.reminder;
    if (c === 'private') return !!n.private;
    return n.tags.includes(c.slice(4));
  }
  const noteMatches = n => !n.deletedAt && matchQuery(st.q, (n.title + '\n' + n.body + '\n' + n.tags.join(' ')).toLowerCase(), n.tags);
  const fmtDay = t => {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / D);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], {weekday:'long'});
    return d.toLocaleDateString([], {day:'numeric', month:'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric'});
  };
  const monthOf = t => new Date(t).toLocaleDateString([], {month:'long', year:'numeric'});

  function card(n, i, opts = {}){
    const rem = n.reminder ? fmtRem(n.reminder) : null;
    const meta = (n.archived && opts.flagArchived ? '<span class="tchip bare">' + I.archive + 'Archived</span>' : '')
      + (rem ? '<span class="tchip bare' + (rem.over ? ' over' : '') + '">' + I.bell + esc(rem.txt) + '</span>' : '')
      + n.tags.map(t => tchip(t, st.q)).join('');
    return '<div class="sw" data-id="' + esc(n.id) + '">' + swipeActs()
      + '<button class="card glass" type="button" style="--i:' + (i || 0) + '" data-id="' + esc(n.id) + '" data-color="' + esc(n.color) + '">'
      + (n.title ? '<h3><span>' + hl(n.title, st.q) + '</span>' + (n.private ? I.lock : '') + (n.pinned ? I.pinFill : '') + '</h3>' : '')
      + (n.body ? '<p>' + hl(n.body, st.q) + '</p>' : '')
      + (meta ? '<div class="meta">' + meta + '</div>' : '')
      + (opts.date ? '<span class="cdate">' + esc(fmtDay(n.created)) + '</span>' : '')
      + '</button></div>';
  }
  // Swipe actions behind each note, as in Mail: right shows Pin and Tag, left shows Archive and Delete.
  const swipeActs = () => st.coll === 'trash' ? '' : '<div class="sw-acts" aria-hidden="true">'
    + '<div class="sw-l"><button type="button" class="sa pin" data-sw-act="pin" tabindex="-1"><span class="gi">' + I.pin + '</span><span class="sl">Pin</span></button>'
    + '<button type="button" class="sa tag" data-sw-act="tag" tabindex="-1"><span class="gi">' + I.tag + '</span><span class="sl">Tag</span></button></div>'
    + '<div class="sw-r"><button type="button" class="sa arch" data-sw-act="archive" tabindex="-1"><span class="gi">' + I.archive + '</span><span class="sl">' + (st.coll === 'archive' ? 'Restore' : 'Archive') + '</span></button>'
    + '<button type="button" class="sa bin" data-sw-act="trash" tabindex="-1"><span class="gi">' + I.trash + '</span><span class="sl">Delete</span></button></div></div>';

  // Deal cards into columns, each to whichever column is shorter so far
  // (by a rough height estimate), keeping the reading order.
  const est = n => 70 + Math.ceil((n.title || '').length / 16) * 21 + Math.min(6, (n.body || '').split('\n').reduce((k, l) => k + Math.max(1, Math.ceil(l.length / 20)), 0)) * 20 + (n.tags.length || n.reminder ? 34 : 0);
  function grid(list, opts){
    const cols = st.view === 'list' ? [[]] : [[], []], hgt = cols.map(() => 0);
    list.forEach((n, i) => { const c = hgt.indexOf(Math.min(...hgt)); cols[c].push(card(n, i, opts)); hgt[c] += est(n) + (opts && opts.date ? 18 : 0); });
    return '<div class="grid">' + cols.map(c => '<div class="col">' + c.join('') + '</div>').join('') + '</div>';
  }
  const snippet = n => (n.body || '').split('\n').map(l => l.trim().replace(/^[•*-]\s*/, '')).filter(l => l && !/^[A-Z][A-Z &]+:?$/.test(l))[0] || '';
  const nrow = (n, i) => '<div class="sw" data-id="' + esc(n.id) + '">' + swipeActs()
    + '<button class="nrow" type="button" style="--i:' + i + '" data-id="' + esc(n.id) + '"><span class="nt">' + esc(n.title || snippet(n) || 'Untitled')
    + (n.private ? I.lock : '') + (n.pinned ? I.pinFill : '') + '</span><span class="ns">' + esc(n.title ? snippet(n) : '') + '</span><span class="nd">' + esc(fmtDay(n.created)) + '</span></button></div>';

  function renderNotes(){
    const c = st.coll, searching = tokensOf(st.q).length > 0;
    const live = shelf();
    $('collBack').hidden = !c;
    $('notesTitle').textContent = c ? collName(c) : 'Notes';
    let h = '';
    if (!c && !searching && needsBackup()) h += '<div class="notice glass"><span>' + esc(backupStatus()) + ' Everything lives only in this browser.</span><button class="linkbtn" type="button" data-open-backup>Back up</button></div>';

    if (searching) {
      const res = alive().filter(n => (!c || c === 'trash' ? true : inColl(n, c) || (c === 'archive' && n.archived)) && noteMatches(n)).sort(byCreated);
      $('notesSub').textContent = plural(res.length, 'result') + (c ? ' in ' + collName(c) : '');
      h += res.length ? grid(res, {date:true, flagArchived:true}) : '<div class="empty glass"><strong>No matching notes</strong>Try a different word or #tag.</div>';
    } else if (!c) {
      $('notesSub').textContent = plural(live.length, 'note') + syncLabel();
      const pinned = live.filter(n => n.pinned).sort(byCreated);
      if (pinned.length) h += '<section><h2 class="sechead">Pinned</h2>' + grid(pinned) + '</section>';
      const tags = countTags(live), untagged = live.filter(n => !n.tags.length);
      const latest = t => live.filter(n => t ? n.tags.includes(t) : !n.tags.length).sort(byCreated)[0];
      const tile = (coll, name, count, h, last, i) => '<button class="ctile glass" type="button" style="--h:' + h + ';--i:' + i + '" data-coll="' + esc(coll) + '">'
        + '<span class="ctop"><i></i><span class="cn">' + count + '</span></span><span class="cname">' + esc(name) + '</span>'
        + '<span class="clast">' + esc(last ? (last.title || snippet(last) || 'Untitled') : '') + '</span></button>';
      const tiles = tags.map(([t, k], i) => tile('tag:' + t, collName('tag:' + t), k, hue(t), latest(t), i));
      if (untagged.length) tiles.push(tile('untagged', 'No tag', untagged.length, 0, latest(null), tiles.length).replace('class="ctile glass"', 'class="ctile glass plain"'));
      if (tiles.length) h += '<section><h2 class="sechead">Collections</h2><div class="ctiles">' + tiles.join('') + '</div></section>';
      const recent = live.slice().sort(byCreated).slice(0, 5);
      if (recent.length) h += '<section><h2 class="sechead">Recent</h2><div class="rgroup glass nlist">' + recent.map(nrow).join('') + '</div></section>';
      if (!live.length) h += '<div class="empty glass"><strong>No notes yet</strong>Tap the pencil to write one, or the clipboard to paste.</div>';
      const arch = alive().filter(n => n.archived).length, trash = notes.filter(n => n.deletedAt).length, nudges = live.filter(n => n.reminder).length, priv = live.filter(n => n.private).length, tidy = tidySuggestions().length;
      h += '<div class="morechips">'
        + '<button class="chip glass" type="button" data-coll="all">All notes <span class="n">' + live.length + '</span></button>'
        + (priv ? '<button class="chip glass" type="button" data-coll="private">' + I.lock + 'Private <span class="n">' + priv + '</span></button>' : '')
        + (nudges ? '<button class="chip glass" type="button" data-coll="nudges">' + I.bell + 'Nudges <span class="n">' + nudges + '</span></button>' : '')
        + (arch ? '<button class="chip glass" type="button" data-coll="archive">' + I.archive + 'Archive <span class="n">' + arch + '</span></button>' : '')
        + (trash ? '<button class="chip glass" type="button" data-coll="trash">' + I.trash + 'Trash <span class="n">' + trash + '</span></button>' : '')
        + '<button class="chip glass" type="button" id="tidyBtn">' + I.sparkle + 'Tidy up' + (tidy ? ' <span class="badge">' + tidy + '</span>' : '') + '</button>'
        + '</div>';
    } else if (c === 'trash') {
      const list = notes.filter(n => n.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
      $('notesSub').textContent = plural(list.length, 'note') + ' · deleted for good after ' + TRASH_DAYS + ' days';
      if (list.length) {
        h += '<button class="btn danger" type="button" id="emptyTrash">Empty Trash</button>';
        h += '<div class="rgroup glass nlist">' + list.map((n, i) => {
          const left = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - n.deletedAt) / D));
          return '<div class="trow" style="--i:' + i + '"><span class="tt"><span class="nt">' + esc(n.title || snippet(n) || 'Untitled') + '</span><span class="nd">' + plural(left, 'day') + ' left</span></span>'
            + '<button class="textbtn" type="button" data-restore="' + esc(n.id) + '">Restore</button>'
            + '<button class="iconbtn danger" type="button" data-purge="' + esc(n.id) + '" aria-label="Delete for good">' + I.trash + '</button></div>';
        }).join('') + '</div>';
      } else h += '<div class="empty glass"><strong>Trash is empty</strong>Deleted notes stay here for ' + TRASH_DAYS + ' days.</div>';
    } else {
      const list = alive().filter(n => inColl(n, c)).sort(c === 'nudges' ? (a, b) => new Date(a.reminder) - new Date(b.reminder) : byCreated);
      $('notesSub').textContent = plural(list.length, 'note') + (c === 'nudges' ? ' · soonest first' : ' · newest first');
      if (!list.length) h += '<div class="empty glass"><strong>Nothing here</strong>' + (c === 'archive' ? 'Swipe a note left and tap Archive to keep it out of the way.' : 'Notes you add here will show newest first.') + '</div>';
      else if (c === 'nudges') h += grid(list);
      else {
        // Newest first, in month groups.
        const groups = [];
        list.forEach(n => { const m = monthOf(n.created); if (!groups.length || groups[groups.length - 1].m !== m) groups.push({m, items:[]}); groups[groups.length - 1].items.push(n); });
        h += groups.map(g => '<section><h2 class="sechead">' + esc(g.m) + '</h2>' + grid(g.items, {date:true}) + '</section>').join('');
      }
    }
    $('list').innerHTML = h;
    $('viewBtn').innerHTML = st.view === 'grid' ? I.rows : I.grid;
    $('viewBtn').setAttribute('aria-label', st.view === 'grid' ? 'Switch to list view' : 'Switch to grid view');
    $('qClear').hidden = !st.q;
    $('q').placeholder = c ? 'Search ' + collName(c) : 'Search notes or #tag';
  }
  function openColl(c){ st.coll = c; st.q = ''; $('q').value = ''; closeSwipe(); animateIn($('list')); render(); window.scrollTo(0, 0); }
  $('collBack').onclick = () => openColl(null);

  // ---------- note actions (swipe buttons, trash) ----------
  const findNote = id => notes.find(n => n.id === id);
  function withUndo(msg, fn){
    const before = clone(notes);
    fn(); save(); render();
    toast(msg, () => { notes = before; save(); render(); });
  }
  function noteAction(act, id){
    const n = findNote(id); if (!n) return;
    const name = '“' + (n.title || snippet(n) || 'Untitled').slice(0, 40) + '”';
    if (act === 'pin') withUndo(n.pinned ? 'Unpinned ' + name : 'Pinned ' + name, () => { n.pinned = !n.pinned; });
    else if (act === 'archive') withUndo(n.archived ? 'Moved back to notes' : 'Archived ' + name, () => { n.archived = !n.archived; n.pinned = n.archived ? false : n.pinned; });
    else if (act === 'trash') withUndo('Moved to Trash', () => { n.deletedAt = Date.now(); n.pinned = false; });
    else if (act === 'tag') openQuickTag(id);
  }

  // ---------- swiping a note, as in Mail ----------
  let swOpen = null;
  function closeSwipe(){ if (swOpen) { swOpen.classList.remove('open-l', 'open-r', 'swiping', 'show-l', 'show-r', 'armed-l', 'armed-r'); swOpen.querySelector('.card, .nrow').style.transform = ''; swOpen = null; } }
  (function(){
    const list = $('list');
    let sw = null, el = null, x0 = 0, y0 = 0, dx = 0, mode = null, base = 0, suppress = false;
    const W = () => el.offsetWidth, REVEAL = () => Math.min(116, W() - 40);
    list.addEventListener('touchstart', e => {
      const s = e.target.closest('.sw'); if (!s || e.touches.length !== 1 || !s.querySelector('.sw-acts')) { sw = null; return; }
      if (swOpen && swOpen !== s) closeSwipe();
      sw = s; el = s.querySelector('.card, .nrow'); x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null;
      base = s.classList.contains('open-l') ? -REVEAL() : s.classList.contains('open-r') ? REVEAL() : 0;
    }, {passive:true});
    list.addEventListener('touchmove', e => {
      if (!sw) return;
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!mode) { if (Math.abs(mx) < 10 && Math.abs(my) < 10) return; mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y'; if (mode === 'y') { sw = null; return; } sw.classList.add('swiping'); el.style.transition = 'none'; }
      e.preventDefault();
      dx = base + mx;
      const lim = W() * 0.9; dx = Math.max(-lim, Math.min(lim, dx));
      el.style.transform = 'translateX(' + dx + 'px)';
      sw.classList.toggle('armed-l', dx < -W() * 0.6);
      sw.classList.toggle('armed-r', dx > W() * 0.6);
      sw.classList.toggle('show-l', dx > 0);
      sw.classList.toggle('show-r', dx < 0);
    }, {passive:false});
    const end = () => {
      if (!sw || mode !== 'x') { sw = null; return; }
      const s = sw, id = s.dataset.id; sw = null; suppress = true; setTimeout(() => { suppress = false; }, 80);
      el.style.transition = ''; s.classList.remove('armed-l', 'armed-r');
      if (dx < -W() * 0.6) { el.style.transform = 'translateX(-110%)'; setTimeout(() => { swOpen = null; noteAction('trash', id); }, 180); return; }
      if (dx > W() * 0.6) { el.style.transform = ''; s.classList.remove('swiping', 'show-l'); swOpen = null; noteAction('tag', id); return; }
      if (dx < -48) { el.style.transform = 'translateX(' + -REVEAL() + 'px)'; s.classList.add('open-l'); s.classList.remove('open-r', 'show-l'); swOpen = s; }
      else if (dx > 48) { el.style.transform = 'translateX(' + REVEAL() + 'px)'; s.classList.add('open-r'); s.classList.remove('open-l', 'show-r'); swOpen = s; }
      else { swOpen = s; closeSwipe(); }
    };
    list.addEventListener('touchend', end);
    list.addEventListener('touchcancel', end);
    list.addEventListener('click', e => {
      if (suppress) { e.preventDefault(); e.stopPropagation(); return; }
      const a = e.target.closest('[data-sw-act]');
      if (a) { const id = a.closest('.sw').dataset.id; closeSwipe(); noteAction(a.dataset.swAct, id); return; }
      if (swOpen) { closeSwipe(); return; }
      const coll = e.target.closest('[data-coll]'); if (coll) { openColl(coll.dataset.coll); return; }
      if (e.target.closest('#tidyBtn')) { openTidy(); return; }
      const r = e.target.closest('[data-restore]');
      if (r) { const n = findNote(r.dataset.restore); withUndo('Restored', () => { n.deletedAt = null; n.archived = false; }); return; }
      const pg = e.target.closest('[data-purge]');
      if (pg) { const id = pg.dataset.purge; withUndo('Deleted for good', () => { notes = notes.filter(n => n.id !== id); }); return; }
      const et = e.target.closest('#emptyTrash');
      if (et) {
        if (!et.dataset.armed) { et.dataset.armed = '1'; et.textContent = 'Tap again to delete ' + plural(notes.filter(n => n.deletedAt).length, 'note') + ' for good'; setTimeout(() => { if (et.isConnected) { delete et.dataset.armed; et.textContent = 'Empty Trash'; } }, 3500); return; }
        withUndo('Trash emptied', () => { notes = notes.filter(n => !n.deletedAt); }); return;
      }
      const c = e.target.closest('.card, .nrow'); if (c) openEditor(c.dataset.id);
    }, true);
    document.addEventListener('touchstart', e => { if (swOpen && !swOpen.contains(e.target)) closeSwipe(); }, {passive:true});
  })();

  // ---------- quick tag (swipe right) ----------
  let qt = null;
  const qtTags = tagEditor('qtTags', 'qtInput', () => qt);
  function openQuickTag(id){
    const n = findNote(id); if (!n) return;
    qt = {id, tags:[...n.tags]};
    $('qtLbl').textContent = 'Tag “' + (n.title || snippet(n) || 'Untitled').slice(0, 30) + '”';
    renderQuickTag(); openSheet('qtSheet');
  }
  function renderQuickTag(){
    qtTags.render();
    $('qtAll').innerHTML = countTags(alive()).map(([t]) => '<button class="opt" type="button" data-qt="' + esc(t) + '" aria-pressed="' + qt.tags.includes(t) + '" style="--lc:hsl(' + hue(t) + ' 90% 62%)"><span class="sw"></span>' + esc(t) + '</button>').join('');
  }
  $('qtAll').addEventListener('click', e => { const b = e.target.closest('[data-qt]'); if (!b) return; const t = b.dataset.qt; qt.tags = qt.tags.includes(t) ? qt.tags.filter(x => x !== t) : [...qt.tags, t]; renderQuickTag(); });
  function finishQuickTag(){
    if (!qt) { closeSheet('qtSheet'); return; }
    qtTags.flush();
    const n = findNote(qt.id), tags = qt.tags; qt = null; closeSheet('qtSheet');
    if (n && JSON.stringify(n.tags) !== JSON.stringify(tags)) withUndo('Tags updated', () => { n.tags = tags; n.updated = Date.now(); });
  }
  $('qtDone').onclick = finishQuickTag;
  closers.qtSheet = finishQuickTag;

  // ---------- tidy up ----------
  const bodyKey = n => (n.title + '\n' + n.body).toLowerCase().replace(/\s+/g, ' ').trim();
  function tidySuggestions(){
    const live = shelf(), out = [], names = list => list.slice(0, 3).map(n => '“' + (n.title || snippet(n) || 'Untitled').slice(0, 32) + '”').join(', ') + (list.length > 3 ? ' and ' + (list.length - 3) + ' more' : '');
    const groups = new Map();
    live.forEach(n => { const k = bodyKey(n); if (k.length >= 3) { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); } });
    const dups = [...groups.values()].filter(g => g.length > 1), extra = dups.reduce((k, g) => k + g.length - 1, 0);
    if (dups.length) out.push({id:'dups', head:plural(extra, 'duplicate note'), detail:names(dups.map(g => g[0])), act:'Keep newest, delete the rest',
      run(){ dups.forEach(g => g.slice().sort(byCreated).slice(1).forEach(n => { n.deletedAt = Date.now(); n.pinned = false; })); }});
    const empty = live.filter(n => !n.title.trim() && n.body.trim().length < 3);
    if (empty.length) out.push({id:'empty', head:plural(empty.length, 'empty note'), detail:'Nothing written in ' + (empty.length === 1 ? 'it' : 'them') + '.', act:'Delete',
      run(){ empty.forEach(n => { n.deletedAt = Date.now(); }); }});
    const untitled = live.filter(n => !n.title.trim() && n.body.trim().length >= 3);
    if (untitled.length) out.push({id:'untitled', head:plural(untitled.length, 'note') + ' without a title', detail:names(untitled), act:'Use first line as title',
      run(){ untitled.forEach(n => { const lines = n.body.split('\n'), i = lines.findIndex(l => l.trim()); n.title = lines[i].trim().replace(/^#+\s*/, '').slice(0, 80); n.body = lines.slice(i + 1).join('\n').trim(); n.updated = Date.now(); }); }});
    const recipes = live.filter(n => !n.tags.includes('recipe') && looksLikeRecipe(n.body, n.tags));
    if (recipes.length) out.push({id:'recipes', head:plural(recipes.length, 'recipe') + ' without the recipe tag', detail:names(recipes), act:'Tag as recipe',
      run(){ recipes.forEach(n => n.tags.push('recipe')); }});
    // Tags that are the same word: recipe / recipes, to-do / todo. Merge the less used into the more used.
    const tc = countTags(live), used = new Map(tc), squash = t => t.replace(/[-_]/g, '');
    const same = (a, b) => { const x = squash(a), y = squash(b); return x === y || x + 's' === y || x + 'es' === y || y + 's' === x || y + 'es' === x; };
    const merges = [];
    tc.forEach(([a]) => tc.forEach(([b]) => {
      if (a === b || !same(a, b) || merges.some(m => m.from === a || m.from === b)) return;
      const keepB = used.get(b) > used.get(a) || (used.get(b) === used.get(a) && b.length < a.length);
      if (keepB) merges.push({from:a, to:b});
    }));
    if (merges.length) out.push({id:'merge', head:merges.length === 1 ? 'Two tags that look the same' : merges.length + ' pairs of tags that look the same', detail:merges.map(m => '#' + m.from + ' → #' + m.to).join(', '), act:'Merge',
      run(){ merges.forEach(m => notes.forEach(n => { if (n.tags.includes(m.from)) n.tags = [...new Set(n.tags.map(t => t === m.from ? m.to : t))]; })); }});
    const stale = live.filter(n => !n.pinned && !n.reminder && Date.now() - (n.updated || n.created) > 182 * D);
    if (stale.length) out.push({id:'stale', head:plural(stale.length, 'note') + ' untouched for 6 months', detail:names(stale), act:'Archive',
      run(){ stale.forEach(n => { n.archived = true; }); }});
    const untagged = live.filter(n => !n.tags.length);
    if (untagged.length >= 3) out.push({id:'untagged', head:plural(untagged.length, 'note') + ' without a tag', detail:'Tag them so they land in a collection.', act:'Show them', open:'untagged'});
    return out;
  }
  function openTidy(){ renderTidy(); openSheet('tidySheet'); }
  function renderTidy(){
    const list = tidySuggestions();
    $('tidyBody').innerHTML = list.length ? '<div class="rgroup glass">' + list.map(s => '<div class="tidyrow"><span class="tt"><span class="nt">' + esc(s.head) + '</span><span class="ns">' + esc(s.detail) + '</span></span>'
      + '<button class="textbtn" type="button" data-tidy="' + s.id + '">' + esc(s.act) + '</button></div>').join('') + '</div>'
      : '<div class="empty glass"><strong>All tidy</strong>No duplicates, empty notes or stray tags.</div>';
  }
  $('tidyBody').addEventListener('click', e => {
    const b = e.target.closest('[data-tidy]'); if (!b) return;
    const s = tidySuggestions().find(x => x.id === b.dataset.tidy); if (!s) return;
    if (s.open) { closeSheet('tidySheet'); openColl(s.open); return; }
    withUndo('Done: ' + s.act.toLowerCase(), s.run);
    renderTidy();
  });

  const toLocalInput = s => { const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,16); };
  const noteTags = tagEditor('edTags', 'edTagInput', () => st.editing);
  function openEditor(id, pre){
    const base = id ? notes.find(n => n.id === id) : null;
    st.isNew = !base;
    st.editing = base ? clone(base) : {id:'n'+Date.now().toString(36), title:'', body:'', tags: st.coll && st.coll.startsWith('tag:') ? [st.coll.slice(4)] : [], color:'none', pinned:false, reminder:null, created:Date.now(), updated:Date.now(), archived:false, deletedAt:null};
    if (!base && pre) { st.editing.title = pre.title || ''; st.editing.body = pre.body || ''; pre.tags.forEach(t => { if (!st.editing.tags.includes(t)) st.editing.tags.push(t); }); }
    $('edTitle').value = st.editing.title;
    $('edBody').value = st.editing.body;
    $('edTagInput').value = '';
    $('edLbl').textContent = st.isNew ? 'New note' : 'Note';
    $('edDelete').hidden = st.isNew;
    renderEditor();
    openSheet('editor');
    $('editor').querySelector('.sheetbody').scrollTop = 0;
    requestAnimationFrame(growBody);
    updateRecipeBar();
    (st.isNew && !pre && !isIOS ? $('edTitle') : $('edDone')).focus({preventScroll:true});
  }
  function renderEditor(){
    const e = st.editing;
    $('edPaper').dataset.color = e.color;
    noteTags.render();
    $('edRem').value = e.reminder ? toLocalInput(e.reminder) : '';
    $('edRemClear').hidden = !e.reminder;
    $('swatches').innerHTML = COLORS.map(c => '<button class="swatch" type="button" role="radio" data-color="'+c+'" data-sw="'+c+'" aria-label="'+(c === 'none' ? 'Clear glass' : c)+'" aria-checked="'+(e.color === c)+'"></button>').join('');
    $('edPrivate').setAttribute('aria-checked', !!e.private);
    $('edPrivHint').textContent = e.private ? 'Only on this phone. Not sent to the Google Sheet or anyone else\u2019s phone.'
      : syncCfg ? 'Synced to the Google Sheet and the other phones. Turn on Private to keep it on this phone only.'
      : 'Private notes stay on this phone, even once Google Sheet sync is on.';
    $('edPin').innerHTML = e.pinned ? I.pinFill : I.pin;
    $('edPin').setAttribute('aria-pressed', e.pinned);
    $('edPin').setAttribute('aria-label', e.pinned ? 'Unpin note' : 'Pin note');
  }
  function syncFields(){
    const e = st.editing;
    e.title = $('edTitle').value.trim();
    e.body = $('edBody').value.replace(/\s+$/,'');
    extractTags(e.body, e.tags);
    noteTags.flush();
  }
  function finishEdit(){
    syncFields();
    const e = st.editing;
    if (st.isNew) { if (e.title || e.body) { e.updated = Date.now(); notes.unshift(e); } }
    else {
      const i = notes.findIndex(n => n.id === e.id);
      if (JSON.stringify({...notes[i], updated:0}) !== JSON.stringify({...e, updated:0})) { e.updated = Date.now(); notes[i] = e; }
    }
    st.editing = null; save(); closeSheet('editor'); render();
  }
  $('edDone').onclick = finishEdit;
  $('edBack').onclick = finishEdit;
  // The note text grows with its content, so the page scrolls rather than a box.
  const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  const growBody = () => { grow($('edTitle')); grow($('edBody')); };
  $('edBody').addEventListener('input', growBody);
  // The title wraps onto more lines but stays one line of text: Return moves to the note.
  $('edTitle').addEventListener('input', e => { const t = e.target; if (/\n/.test(t.value)) t.value = t.value.replace(/\s*\n+\s*/g, ' '); grow(t); });
  $('edTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('edBody').focus(); } });
  window.addEventListener('resize', () => { if (!$('editor').hidden) growBody(); });
  $('edPrivate').onclick = () => { st.editing.private = !st.editing.private; renderEditor(); };
  $('edPin').onclick = () => { st.editing.pinned = !st.editing.pinned; renderEditor(); };
  $('edRem').addEventListener('change', e => { st.editing.reminder = e.target.value ? iso(new Date(e.target.value)) : null; renderEditor(); });
  $('edRemClear').onclick = () => { st.editing.reminder = null; renderEditor(); };
  $('quick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const d = new Date();
    if (b.dataset.q === 'later') d.setHours(d.getHours() + 3, 0, 0, 0);
    else if (b.dataset.q === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9,0,0,0); }
    else { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9,0,0,0); }
    st.editing.reminder = iso(d); renderEditor();
  });
  $('swatches').addEventListener('click', e => { const b = e.target.closest('[data-sw]'); if (b) { st.editing.color = b.dataset.sw; renderEditor(); } });
  $('edDelete').onclick = () => {
    const id = st.editing.id; st.editing = null; closeSheet('editor');
    withUndo('Moved to Trash', () => { const n = notes.find(x => x.id === id); if (n) { n.deletedAt = Date.now(); n.pinned = false; } });
  };
  $('q').addEventListener('input', e => { st.q = e.target.value; render(); });
  $('qClear').onclick = () => { st.q = ''; $('q').value = ''; render(); $('q').focus(); };
  $('viewBtn').onclick = () => { st.view = st.view === 'grid' ? 'list' : 'grid'; try { localStorage.setItem(KEY+'-view', st.view); } catch(e){} render(); };

  // =====================================================================
  // REMINDERS
  // =====================================================================
  const listById = id => lists.find(l => l.id === id) || lists[0];
  const dueTime = t => t.date ? new Date(t.date + 'T' + (t.time || '23:59')) : null;
  const isOverdue = t => !t.done && t.date && (t.time ? dueTime(t) < new Date() : t.date < todayStr());
  const RECENT = 1500;
  const recentlyDone = t => t.done && t.doneAt && Date.now() - t.doneAt < RECENT;
  const inView = (v, t) => v === 'today' ? !!t.date && t.date <= todayStr() : v === 'upcoming' ? !!t.date : v === 'flagged' ? t.flagged : true;
  const inList = t => !st.rlist || t.list === st.rlist;
  const openIn = v => todos.filter(t => !t.done && inList(t) && inView(v, t)).length;

  function bucket(t){
    if (!t.date) return 'none';
    const td = todayStr();
    if (t.date < td) return t.done ? 'earlier' : 'overdue';
    if (t.date === td) return isOverdue(t) ? 'overdue' : 'today';
    if (t.date === dayOff(1)) return 'tomorrow';
    if (t.date <= dayOff(7)) return 'week';
    return 'later';
  }
  const BUCKETS = [['overdue','Overdue'],['today','Today'],['tomorrow','Tomorrow'],['week','Next 7 days'],['later','Later'],['none','No date'],['earlier','Earlier']];

  function fmtDue(t){
    if (!t.date) return '';
    const time = t.time ? dueTime(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
    let day;
    if (t.date === todayStr()) day = 'Today';
    else if (t.date === dayOff(1)) day = 'Tomorrow';
    else if (t.date === dayOff(-1)) day = 'Yesterday';
    else day = new Date(t.date+'T12:00').toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
    return day + (time ? ' ' + time : '');
  }
  function todoRow(t, i){
    const l = listById(t.list);
    const meta = [];
    if (t.date) meta.push('<span class="tchip bare'+(isOverdue(t) ? ' over' : '')+'">'+(alertsHere(t) ? I.bell : I.clock)+esc(fmtDue(t))+'</span>');
    if (!st.rlist) meta.push('<span class="tchip lst">'+esc(l.name)+'</span>');
    t.tags.forEach(x => meta.push(tchip(x, st.rq)));
    return '<div class="todo'+(t.done ? ' done' : '')+'" style="--lc:'+hexOr(l.color)+';--i:'+(i||0)+'">'
      + '<button class="check" type="button" role="checkbox" aria-checked="'+!!t.done+'" data-check="'+esc(t.id)+'" aria-label="Complete '+esc(t.title)+'">'+I.check+'</button>'
      + '<button class="tbody" type="button" data-todo="'+esc(t.id)+'"><span class="t">'+hl(t.title, st.rq)+'</span>'
      + (t.notes ? '<span class="n">'+hl(t.notes.split('\n')[0], st.rq)+'</span>' : '')
      + (meta.length ? '<span class="tmeta">'+meta.join('')+'</span>' : '')+'</button>'
      + '<span class="tside">'
      + (prioOf(t) ? '<span class="prio p'+prioOf(t)+'" aria-label="'+['','Low','Medium','High'][prioOf(t)]+' priority"><i></i><i></i><i></i></span>' : '')
      + (t.flagged ? '<span class="flag" aria-label="Flagged">'+I.flag+'</span>' : '')
      + '</span></div>';
  }
  function sortTodos(a, b){
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = dueTime(a), db = dueTime(b);
    if (da && db && da - db) return da - db;
    if (!!da !== !!db) return da ? -1 : 1;
    return (b.prio - a.prio) || (a.created - b.created);
  }

  // ---------- grocery sections (aisles.js) ----------
  // A grocery list shows its items under store sections in supermarket order.
  // An item's section is the one chosen for it, else what the list has learned
  // for that name, else worked out from the words.
  const AISLE = window.NotesAisles;
  const isGrocery = l => !!l && (l.grocery != null ? !!l.grocery : AISLE.groceryName(l.name));
  const aisleOf = t => t.aisle && AISLE.NAMES[t.aisle] ? t.aisle : AISLE.sectionOf(t.title, (lists.find(l => l.id === t.list) || {}).learn);
  function learnAisle(t, aisle){
    const l = lists.find(x => x.id === t.list), k = AISLE.key(t.title); if (!l || !k) return;
    const learn = Object.assign({}, l.learn);
    delete learn[k];
    if (aisle) learn[k] = aisle;
    const ks = Object.keys(learn); ks.slice(0, Math.max(0, ks.length - 300)).forEach(x => delete learn[x]);   // the newest 300
    l.learn = learn;
  }

  function renderRem(){
    const open = todos.filter(t => !t.done);
    const dueToday = open.filter(t => t.date && t.date <= todayStr()).length;
    $('remSub').textContent = dueToday ? plural(dueToday, 'thing') + ' for today' : 'Nothing due today';
    $('seg').innerHTML = Object.entries(VIEWS).map(([v, name]) => {
      const warn = v === 'today' && todos.some(t => inList(t) && isOverdue(t));
      return '<button type="button" data-view="'+v+'" aria-pressed="'+(st.rview === v)+'"'+(warn ? ' class="warn"' : '')+'><b>'+openIn(v)+'</b>'+name+'</button>';
    }).join('');
    let c = '<button class="chip glass" type="button" data-list="" aria-pressed="'+(!st.rlist)+'">All lists</button>';
    lists.forEach(l => {
      const n = todos.filter(t => !t.done && t.list === l.id).length;
      c += '<button class="chip glass" type="button" data-list="'+esc(l.id)+'" style="--lc:'+hexOr(l.color)+'" aria-pressed="'+(st.rlist === l.id)+'"><span class="sw"></span>'+esc(l.name)+' <span class="n">'+n+'</span></button>';
    });
    c += '<button class="chip ghost" type="button" id="addList">'+I.plus+'List</button>';
    $('listChips').innerHTML = c;
    slideRem();
    $('rqWrap').hidden = !st.rsearch;
    $('rqClear').hidden = !st.rq;
    $('remSearchBtn').setAttribute('aria-pressed', st.rsearch);

    $('qa').placeholder = 'Add to ' + listById(st.rlist || lists[0].id).name + (st.rview === 'today' ? ' for today' : st.rview === 'flagged' ? ', flagged' : '') + '…';

    let h = '';
    const searching = st.rsearch && tokensOf(st.rq).length;
    const items = todos.filter(t => (searching || inList(t)) && (searching
        ? matchQuery(st.rq, (t.title+'\n'+t.notes+'\n'+t.tags.join(' ')).toLowerCase(), t.tags)
        : inView(st.rview, t))
      && (!t.done || st.showDone || recentlyDone(t))).sort(sortTodos);
    const doneCount = todos.filter(t => t.done && (searching ? matchQuery(st.rq, (t.title+'\n'+t.notes+'\n'+t.tags.join(' ')).toLowerCase(), t.tags) : inList(t) && inView(st.rview, t))).length;

    if (searching) h += '<p class="resulthead">'+plural(items.length, 'result')+' across all lists</p>';
    if (!items.length) {
      h += '<div class="empty"><strong>'+(searching ? 'No matching reminders' : 'All clear')+'</strong>'
        + (searching ? 'Try a different word or #tag.' : st.rview === 'today' ? 'Nothing due today. Enjoy it.' : 'Add one above.') + '</div>';
    } else {
      const groups = new Map();
      const aisles = !searching && st.rlist && isGrocery(listById(st.rlist));
      items.forEach(t => { const b = t.done && !recentlyDone(t) ? 'done' : aisles ? aisleOf(t) : bucket(t); if (!groups.has(b)) groups.set(b, []); groups.get(b).push(t); });
      [...(aisles ? AISLE.SECTIONS.map(x => [x.id, x.name]) : BUCKETS), ['done','Completed']].forEach(([k, label]) => {
        const g = groups.get(k); if (!g) return;
        h += '<section class="rgroup glass"><h2 class="sechead'+(k === 'overdue' ? ' over' : '')+'"><span>'+label+'</span><span>'+g.length+'</span></h2>'
          + g.map(todoRow).join('')+'</section>';
      });
    }
    if (doneCount) h += '<button class="morebtn glass" type="button" id="toggleDone">'+(st.showDone ? 'Hide completed' : 'Show '+doneCount+' completed')+'</button>';
    $('remBody').innerHTML = h;
  }

  let doneTimer;
  $('remView').addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) { st.rview = v.dataset.view; st.showDone = false; animateIn($('remBody')); render(); return; }
    const l = e.target.closest('[data-list]');
    if (l) {
      const id = l.dataset.list || null;
      if (id && st.rlist === id) openListEditor(id);
      else { st.rlist = id; if (id && isGrocery(listById(id))) st.rview = 'all'; animateIn($('remBody')); render(); }
      return;
    }
    if (e.target.closest('#addList')) { openListEditor(null); return; }
    if (e.target.closest('#toggleDone')) { st.showDone = !st.showDone; render(); return; }
    const chk = e.target.closest('[data-check]');
    if (chk) {
      const t = todos.find(x => x.id === chk.dataset.check);
      t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
      save(); render();
      clearTimeout(doneTimer); doneTimer = setTimeout(render, RECENT + 50);
      return;
    }
    const row = e.target.closest('[data-todo]');
    if (row) openTodo(row.dataset.todo);
  });
  $('remSearchBtn').onclick = () => { st.rsearch = !st.rsearch; if (!st.rsearch) { st.rq = ''; $('rq').value = ''; } render(); if (st.rsearch) $('rq').focus(); };
  $('rq').addEventListener('input', e => { st.rq = e.target.value; render(); });
  $('rqClear').onclick = () => { st.rq = ''; $('rq').value = ''; render(); $('rq').focus(); };

  $('quickAdd').addEventListener('submit', e => {
    e.preventDefault();
    let text = $('qa').value.trim(); if (!text) return;
    const t = T(st.rlist || lists[0].id, '', {created:Date.now(), id:'t'+Date.now().toString(36)});
    extractTags(text, t.tags);
    text = text.replace(/(^|\s)#[a-z0-9][\w\-]*/gi, ' ');
    const m = text.match(/\b(today|tomorrow)\b/i);
    if (m) { t.date = m[1].toLowerCase() === 'today' ? todayStr() : dayOff(1); text = text.replace(m[0], ' '); }
    else if (st.rview === 'today') t.date = todayStr();
    if (st.rview === 'flagged') t.flagged = true;
    t.title = text.replace(/\s+/g, ' ').trim() || 'New reminder';
    todos.push(t); save();
    $('qa').value = '';
    if (!inView(st.rview, t)) toast('Added to ' + listById(t.list).name + (t.date ? ' · ' + fmtDue(t) : ''));
    render();
  });

  // reminder details
  const todoTags = tagEditor('tdTags', 'tdTagInput', () => st.todo);
  function openTodo(id){
    st.todo = clone(todos.find(t => t.id === id));
    $('tdTitle').value = st.todo.title;
    $('tdNotes').value = st.todo.notes;
    renderTodo();
    openSheet('todoSheet');
    slideTodo(true);
    $('tdDone').focus();
  }
  function renderTodo(){
    const t = st.todo;
    const q = t.date === todayStr() ? 'today' : t.date === dayOff(1) ? 'tomorrow' : t.date === nextMonday() ? 'week' : t.date ? 'pick' : 'none';
    $('tdQuick').innerHTML = [['none','No date'],['today','Today'],['tomorrow','Tomorrow'],['week','Next Monday']]
      .map(([k, n]) => '<button class="opt" type="button" role="radio" data-q="'+k+'" aria-checked="'+(q === k)+'">'+n+'</button>').join('');
    $('tdDate').value = t.date || '';
    $('tdTime').value = t.time || '';
    $('tdTime').disabled = !t.date;
    $('tdCal').hidden = !t.date;
    $('tdAlertField').hidden = !t.date;
    if (t.date) {
      let a = alertOf(t);
      if (!t.time && a > 0) a = Math.round(a / 1440) * 1440;
      $('tdAlert').innerHTML = (t.time ? ALERTS_TIMED : ALERTS_DAY)
        .map(([m, n]) => '<button class="opt" type="button" role="radio" data-a="'+m+'" aria-checked="'+(a === m)+'">'+n+'</button>').join('');
      $('tdAlertHint').textContent = !push.on ? 'Turn on notifications with the bell at the top of Reminders to get this alert on this phone.'
        : push.skip.includes(t.list) ? 'This phone doesn\u2019t get alerts for ' + listById(t.list).name + '. Change it with the bell at the top of Reminders.'
        : !t.time && a >= 0 ? 'Without a time, it alerts at ' + fmtClock(push.morning) + (a ? '' : ' on the day') + '.' : '';
    }
    $('tdPrio').innerHTML = ['None','Low','Medium','High'].map((p, i) => '<button class="opt" type="button" role="radio" data-p="'+i+'" aria-checked="'+(t.prio === i)+'">'+p+'</button>').join('');
    const groc = isGrocery(listById(t.list));
    $('tdAisleField').hidden = !groc;
    if (groc) {
      const auto = AISLE.sectionOf($('tdTitle').value || t.title, listById(t.list).learn), cur = t.aisle && AISLE.NAMES[t.aisle] ? t.aisle : '';
      $('tdAisle').innerHTML = '<button class="opt" type="button" role="radio" data-ai="" aria-checked="'+!cur+'">Auto · '+esc(AISLE.NAMES[auto])+'</button>'
        + AISLE.SECTIONS.map(x => '<button class="opt" type="button" role="radio" data-ai="'+x.id+'" aria-checked="'+(cur === x.id)+'">'+esc(x.name)+'</button>').join('');
    }
    $('tdList').innerHTML = lists.map(l => '<button class="opt" type="button" role="radio" data-l="'+esc(l.id)+'" style="--lc:'+hexOr(l.color)+'" aria-checked="'+(t.list === l.id)+'"><span class="sw"></span>'+esc(l.name)+'</button>').join('');
    $('tdFlag').setAttribute('aria-checked', t.flagged);
    todoTags.render();
    slideTodo();
  }
  // When, Priority and List slide their thumbs; a newly opened reminder places them without moving.
  const slideTodo = jump => ['tdQuick', 'tdAlert', 'tdPrio', 'tdList', 'tdAisle'].forEach(id => slide($(id), $(id).querySelector('[aria-checked="true"]'), id, { jump }));
  window.addEventListener('resize', () => { slideTabs(true); slideRem(true); slideTodo(true); });
  function finishTodo(){
    const t = st.todo;
    t.title = $('tdTitle').value.trim() || t.title;
    t.notes = $('tdNotes').value.replace(/\s+$/,'');
    todoTags.flush();
    if (t.aisleSet !== undefined) { learnAisle(t, t.aisleSet); delete t.aisleSet; }
    todos[todos.findIndex(x => x.id === t.id)] = t;
    st.todo = null; save(); closeSheet('todoSheet'); render();
  }
  $('tdDone').onclick = finishTodo;
  $('tdQuick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const q = b.dataset.q;
    st.todo.date = q === 'today' ? todayStr() : q === 'tomorrow' ? dayOff(1) : q === 'week' ? nextMonday() : null;
    if (!st.todo.date) st.todo.time = null;
    renderTodo();
  });
  $('tdDate').addEventListener('change', e => { st.todo.date = e.target.value || null; if (!st.todo.date) st.todo.time = null; renderTodo(); });
  $('tdTime').addEventListener('change', e => { st.todo.time = e.target.value || null; renderTodo(); });
  $('tdAlert').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { st.todo.alert = +b.dataset.a; renderTodo(); } });
  $('tdPrio').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { st.todo.prio = +b.dataset.p; renderTodo(); } });
  $('tdList').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) { st.todo.list = b.dataset.l; renderTodo(); } });
  $('tdAisle').addEventListener('click', e => {
    const b = e.target.closest('[data-ai]'); if (!b) return;
    const a = b.dataset.ai || null;
    if (a) st.todo.aisle = a; else delete st.todo.aisle;
    st.todo.aisleSet = a;                     // learned when the reminder is saved
    renderTodo();
  });
  $('tdFlag').onclick = () => { st.todo.flagged = !st.todo.flagged; renderTodo(); };
  // Where the site is on Cloudflare, the Calendar app's function puts the
  // reminder straight into the iCloud Family calendar (calendar/README.md);
  // anywhere else, or if that fails, a calendar file as before.
  let calAvail = null;
  $('tdCal').onclick = async () => {
    const t = st.todo; if (!t.date) return;
    t.title = $('tdTitle').value.trim() || t.title; t.notes = $('tdNotes').value;
    const text = icsFor(t);
    if (calAvail !== false) {
      try {
        const r = await (window.AllisonOS && AllisonOS.account ? AllisonOS.account.fetch : (u, o) => fetch(u, o))(new URL('../calendar/api/import', location.href).href, { method: 'POST', headers: { 'X-Calendar': '1', 'Content-Type': 'text/calendar; charset=utf-8' }, body: text, cache: 'no-store' });
        let d = null; try { d = await r.json(); } catch(e) {}
        if (r.ok && d && d.ok) { calAvail = true; toast('Added to the ' + (d.calendar && d.calendar.name || 'Family') + ' calendar'); return; }
        if (r.status === 404 || (d && d.error === 'no-account')) calAvail = false;
        else if (d && d.error) toast('The Family calendar couldn\u2019t take it (' + d.error + '). Saving a file instead.');
      } catch(e) {}
    }
    download(new File([text], fileName(t.title) + '.ics', {type:'text/calendar'}));
    toast('Open the downloaded file to add it to your calendar');
  };
  $('tdDelete').onclick = () => {
    const i = todos.findIndex(x => x.id === st.todo.id), removed = todos[i];
    todos.splice(i, 1); st.todo = null; save(); closeSheet('todoSheet'); render();
    toast('Reminder deleted', () => { todos.splice(i, 0, removed); save(); render(); });
  };

  // list editor
  function openListEditor(id){
    const l = id ? listById(id) : null;
    st.listEdit = l ? clone(l) : {id:'l'+Date.now().toString(36), name:'', color:LIST_COLORS[lists.length % LIST_COLORS.length], isNew:true};
    $('lsLbl').textContent = l ? 'Edit list' : 'New list';
    $('lsName').value = st.listEdit.name;
    $('lsDelete').hidden = !l || lists.length < 2;
    renderListColors(); renderListGrocery();
    openSheet('listSheet');
    $('lsName').focus();
  }
  function renderListColors(){
    $('lsColors').innerHTML = LIST_COLORS.map(c => '<button class="swatch list" type="button" role="radio" data-c="'+c+'" style="--lc:'+c+'" aria-label="Color '+c+'" aria-checked="'+(st.listEdit.color === c)+'"></button>').join('');
  }
  const editGrocery = () => isGrocery(Object.assign({}, st.listEdit, {name: $('lsName').value}));
  function renderListGrocery(){ $('lsGrocery').setAttribute('aria-checked', editGrocery()); }
  $('lsGrocery').onclick = () => { st.listEdit.grocery = !editGrocery(); renderListGrocery(); };
  $('lsName').addEventListener('input', renderListGrocery);
  $('lsColors').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { st.listEdit.color = b.dataset.c; renderListColors(); } });
  $('lsName').addEventListener('keydown', e => { if (e.key === 'Enter') $('lsSave').click(); });
  $('lsSave').onclick = () => {
    const l = st.listEdit, name = $('lsName').value.trim();
    if (!name) { $('lsName').focus(); toast('Give the list a name first.'); return; }
    l.name = name;
    if (l.isNew) { delete l.isNew; lists.push(l); st.rlist = l.id; }
    else lists[lists.findIndex(x => x.id === l.id)] = l;
    save(); closeSheet('listSheet'); render();
  };
  $('lsDelete').onclick = () => {
    const id = st.listEdit.id, li = lists.findIndex(x => x.id === id);
    const removedList = lists[li], removedTodos = todos.filter(t => t.list === id);
    lists.splice(li, 1); todos = todos.filter(t => t.list !== id);
    st.rlist = null; save(); closeSheet('listSheet'); render();
    toast('Deleted ' + removedList.name, () => { lists.splice(li, 0, removedList); todos.push(...removedTodos); save(); render(); });
  };

  // ---------- share ----------
  function openShare(kind){
    let what;
    if (kind === 'note') { syncFields(); what = 'Note: ' + (st.editing.title || 'Untitled'); }
    else { st.todo.title = $('tdTitle').value.trim() || st.todo.title; st.todo.notes = $('tdNotes').value; what = 'Reminder: ' + st.todo.title; }
    st.shareFrom = kind;
    $('shWhat').textContent = what;
    openSheet('share');
  }
  $('edShare').onclick = () => openShare('note');
  $('tdShare').onclick = () => openShare('todo');
  const b64e = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const b64d = str => decodeURIComponent(escape(atob(str.replace(/-/g,'+').replace(/_/g,'/'))));
  const fileName = str => (str || 'note').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,40) || 'note';
  function download(file){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // Hand something to the phone's share menu; fall back to a download or the clipboard.
  async function shareOut({title, text, url, file}){
    try {
      if (file && navigator.canShare && navigator.canShare({files:[file]})) { await navigator.share({files:[file], title}); return 'shared'; }
      if (!file && navigator.share) { await navigator.share({title, text, url}); return 'shared'; }
    } catch(e) { if (e.name === 'AbortError') return 'cancelled'; }
    if (file) { download(file); return 'downloaded'; }
    try { await navigator.clipboard.writeText(url || text); return 'copied'; } catch(e) { return 'failed'; }
  }
  function payload(){
    if (st.shareFrom === 'note') { const e = st.editing; return {k:'note', d:{title:e.title, body:e.body, color:e.color, tags:e.tags, reminder:e.reminder}}; }
    const t = st.todo;
    return {k:'todo', d:{title:t.title, notes:t.notes, date:t.date, time:t.time, prio:t.prio, flagged:t.flagged, tags:t.tags, list:listById(t.list).name}};
  }
  const packFile = (items, name) => new File([JSON.stringify({app:'allison-notes', v:1, items}, null, 2)], name + '.json', {type:'application/json'});
  $('share').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-share]'); if (!b) return;
    const kind = b.dataset.share, p = payload(), title = p.d.title || 'Untitled';
    closeSheet('share');
    if (kind === 'copy') {
      const txt = p.k === 'note'
        ? (p.d.title ? p.d.title + '\n\n' : '') + p.d.body + (p.d.tags.length ? '\n\n' + p.d.tags.map(t => '#'+t).join(' ') : '')
        : '[ ] ' + p.d.title + (p.d.date ? ' (due ' + fmtDue(p.d) + ')' : '') + (p.d.notes ? '\n' + p.d.notes : '');
      try { await navigator.clipboard.writeText(txt); toast('Copied to clipboard'); }
      catch(err) { toast('Copy isn\u2019t available here. Select the text instead.'); }
      return;
    }
    let r;
    if (kind === 'link') {
      const url = location.href.split('#')[0] + '#add=' + b64e(JSON.stringify([p]));
      if (url.length > 6000) {
        r = await shareOut({title, file:packFile([p], fileName(title))});
        toast(r === 'cancelled' ? 'Not shared' : 'Too long for a link, so it was saved as a file');
        return;
      }
      r = await shareOut({title, text:'Tap to add \u201c' + title + '\u201d to your Notes:', url});
      toast({shared:'Shared', copied:'Link copied. Paste it into a message.', cancelled:'Not shared', failed:'Couldn\u2019t share from here'}[r]);
    } else {
      r = await shareOut({title, file:packFile([p], fileName(title))});
      toast({shared:'Shared', downloaded:'Saved to Downloads', cancelled:'Not shared'}[r] || 'Couldn\u2019t save');
    }
  });

  // ---------- receiving: shared links and files ----------
  let pending = [];
  const newId = pfx => pfx + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function offerImport(items, hint){
    pending = (Array.isArray(items) ? items : []).filter(p => p && (p.k === 'note' || p.k === 'todo') && p.d && typeof p.d === 'object');
    if (!pending.length) { toast('Nothing to add from that.'); return; }
    const allTodos = pending.every(p => p.k === 'todo');
    $('imLbl').textContent = pending.length === 1 ? 'Add this ' + (pending[0].k === 'note' ? 'note' : 'reminder') + '?' : 'Add ' + pending.length + (allTodos ? ' reminders?' : ' items?');
    $('imList').innerHTML = pending.map(p => '<li>' + (p.k === 'note' ? 'Note: ' : 'Reminder: ') + esc(p.d.title || 'Untitled') + '</li>').join('');
    $('imHint').textContent = hint || 'They\u2019ll be added as new copies. Nothing you already have is changed.';
    openSheet('importSheet');
  }
  const str = (v, d = '') => typeof v === 'string' ? v : d;
  const tagsOf = v => Array.isArray(v) ? v.map(x => normTag(String(x))).filter(Boolean) : [];
  $('imAdd').onclick = () => {
    let n = 0;
    pending.forEach(({k, d}) => {
      if (k === 'note') {
        const rem = str(d.reminder);
        notes.unshift({id:newId('n'), title:str(d.title), body:str(d.body), tags:tagsOf(d.tags), color:COLORS.includes(d.color) ? d.color : 'none',
          pinned:false, reminder:rem && !isNaN(new Date(rem)) ? rem : null, created:Date.now(), updated:Date.now(), archived:false, deletedAt:null});
      } else {
        const l = lists.find(x => x.name.toLowerCase() === str(d.list).toLowerCase()) || lists[0];
        todos.push({id:newId('t'), list:l.id, title:str(d.title, 'Reminder') || 'Reminder', notes:str(d.notes),
          date:/^\d{4}-\d\d-\d\d$/.test(d.date) ? d.date : null, time:/^\d\d:\d\d$/.test(d.time) ? d.time : null,
          prio:[0,1,2,3].includes(d.prio) ? d.prio : 0, flagged:!!d.flagged, done:false, doneAt:null, tags:tagsOf(d.tags), created:Date.now()});
      }
      n++;
    });
    pending = []; save(); closeSheet('importSheet'); render();
    toast('Added ' + plural(n, 'item'));
  };
  function checkIncoming(){
    if (/^#sync=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); takeSetupLink(h); return; }
    const m = location.hash.match(/^#add=([\w-]+)$/);
    if (!m) return;
    const link = location.href;
    history.replaceState(null, '', location.pathname + location.search);
    let items;
    try { items = JSON.parse(b64d(m[1])); } catch(e) { toast('That link is damaged. Ask for it to be sent again.'); return; }
    if (isIOS && !standalone()) offerOpenInApp(link, items);
    else offerImport(items, 'Shared with you. It\u2019ll be added as a new copy.');
  }
  window.addEventListener('hashchange', checkIncoming);

  // ---------- paste: from Claude or anywhere ----------
  // On iPhone a home-screen app keeps its own storage, separate from Safari,
  // so things get into it by copy and paste rather than by opening links.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const cleanInline = l => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)');
  const BULLET = /^\s*(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
  const isHeading = l => /^\s*#{1,6}\s+\S/.test(l);
  const isRule = l => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);

  function textToNote(text){
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    // Title: a markdown heading near the top (skipping a chatty first line), else the first line.
    let ti = lines.slice(0, 6).findIndex(isHeading), hadHeading = ti >= 0;
    if (!hadHeading) ti = lines.findIndex(l => l.trim());
    const title = cleanInline(lines[ti].trim().replace(/^#{1,6}\s+/, '').replace(/[:：]\s*$/, '')).slice(0, 120);
    const out = [];
    (hadHeading ? lines.slice(ti + 1) : lines.slice(0, ti).concat(lines.slice(ti + 1))).forEach(raw => {
      if (isRule(raw)) return;
      if (isHeading(raw)) { if (out.length && out[out.length - 1] !== '') out.push(''); out.push(cleanInline(raw.trim().replace(/^#{1,6}\s+/, ''))); return; }
      const indent = raw.match(/^\s*/)[0].length >= 2 ? '   ' : '';
      const m = raw.match(BULLET);
      if (m) {
        const num = raw.trim().match(/^(\d+)[.)]/);
        out.push(indent + (num ? num[1] + '. ' : '• ') + cleanInline(raw.slice(m[0].length).trim()));
      } else out.push(cleanInline(raw.trimEnd()));
    });
    const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const tags = [];
    extractTags(text, tags);
    if (/ingredients/i.test(text) && /(method|instructions|directions|steps|preparation)/i.test(text) && !tags.includes('recipe')) tags.push('recipe');
    return {title, body, tags};
  }

  function textToTodos(text){
    const l = listById(st.rlist || lists[0].id);
    return text.replace(/\r\n?/g, '\n').split('\n')
      .filter(x => x.trim() && !isHeading(x) && !isRule(x) && !/:\s*$/.test(x.trim()))
      .map(x => {
        const tags = []; extractTags(x, tags);
        const title = cleanInline(x.replace(BULLET, '').replace(/(^|\s)#[a-z0-9][\w\-]*/gi, ' ')).replace(/\s+/g, ' ').trim().slice(0, 200);
        return {k:'todo', d:{title, list:l.name, tags, date:st.rview === 'today' ? todayStr() : null, flagged:st.rview === 'flagged'}};
      })
      .filter(p => p.d.title);
  }

  function handlePaste(text){
    text = (text || '').trim();
    if (!text) { toast('The clipboard is empty. Copy something first.'); return; }
    if (takeSetupLink(text)) return;
    const link = text.match(/#add=([\w-]+)/);
    if (link) {
      try { offerImport(JSON.parse(b64d(link[1])), 'Shared with you. It’ll be added as a new copy.'); }
      catch(e) { toast('That link is damaged. Ask for it to be sent again.'); }
      return;
    }
    if (text[0] === '{') {
      try { const data = JSON.parse(text); if (data && Array.isArray(data.items)) { offerImport(data.items); return; } } catch(e) {}
    }
    if (st.tab === 'rem') {
      const items = textToTodos(text);
      if (!items.length) { toast('Nothing to add from that.'); return; }
      offerImport(items, 'Each line becomes a reminder in ' + items[0].d.list + '.');
    } else {
      openEditor(null, textToNote(text));
    }
  }

  function openPasteSheet(){
    $('psLbl').textContent = st.tab === 'rem' ? 'Paste as reminders' : 'Paste as a note';
    $('psHint').textContent = st.tab === 'rem'
      ? 'Touch and hold in the box, tap Paste, then Add. Each line becomes a reminder.'
      : 'Touch and hold in the box, tap Paste, then Add. The first line or heading becomes the title.';
    $('psText').value = '';
    openSheet('pasteSheet');
  }
  $('pasteBtn').onclick = async () => {
    let text = '';
    try { if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText(); } catch(e) {}
    if (text && text.trim()) handlePaste(text); else openPasteSheet();
  };
  $('psAdd').onclick = () => { const t = $('psText').value; closeSheet('pasteSheet'); handlePaste(t); };

  // A share link opened in Safari on iPhone would land in Safari's copy, not the
  // home-screen app's, so offer to copy it for pasting there instead.
  let openHereItems = null;
  function offerOpenInApp(link, items){
    openHereItems = items;
    $('lkLink').value = link;
    openSheet('linkSheet');
  }
  $('lkCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('lkLink').value); toast('Copied. Now open Notes from your Home Screen and tap the clipboard button.'); closeSheet('linkSheet'); }
    catch(e) { $('lkLink').hidden = false; $('lkLink').select(); toast('Select the link and copy it.'); }
  };
  $('lkHere').onclick = () => { closeSheet('linkSheet'); if (openHereItems) offerImport(openHereItems, 'It’ll be added in this browser.'); };

  // ---------- recipes: tidy into ingredients + method, and cook step by step ----------
  // Rule-based, on the phone: section headings, quantities and cooking verbs.
  const QTY = /^(?:\d+[\d\/.,\s-]*|[½⅓⅔¼¾⅛⅜⅝⅞]|a |an |one |two |three |four |five |six |half |pinch|handful|dash|splash|few |some |knob|sprig|bunch|clove|zest|juice|salt|pepper|oil)/i;
  const ING_HEAD = /^(ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|shopping list)\b[\s:：]*$/i;
  const STEP_HEAD = /^(method|instructions?|directions?|steps?|preparation|how to make(?: it)?)\b[\s:：]*$/i;
  const NOTE_HEAD = /^(notes?|tips?|to serve|serving suggestions?|storage|variations?)\b[\s:：]*$/i;
  const META = /\b(serves|servings?|makes|yields?|prep(?:aration)? time|cook(?:ing)? time|total time|minutes|mins?|hours?|hrs?)\b/i;
  const VERB = /^(preheat|heat|warm|add|mix|stir|whisk|combine|place|put|pour|bring|boil|simmer|cook|bake|roast|fry|saut[eé]|chop|slice|dice|cut|season|serve|transfer|remove|return|cover|leave|let|drain|toss|fold|beat|melt|spread|sprinkle|garnish|arrange|blend|grill|reduce|taste|finish|meanwhile|once|when|then|in a|using|line|grease|knead|rest|marinate|pat|trim|peel|grate|squeeze|scatter|spoon|divide|top|layer|allow|check|turn|lower|increase|set|start|wash|rinse|soak|mash|shred|roll|shape|brush|pre-heat|microwave|refrigerate|chill|freeze|store|enjoy)\b/i;
  const stripMark = l => l.replace(/^\s*(?:[-*+•·▪◦]|\d+\s*[.)]|step\s*\d+\s*[:.)\-–]?)\s*/i, '').replace(/^\[[ xX]\]\s*/, '').trim();
  const isSubHead = l => /[:：]\s*$/.test(l) && l.length <= 40 && !QTY.test(stripMark(l)) || /^for the\b/i.test(l) && l.length <= 40 && !/\d/.test(l);
  const looksIngredient = l => { const s = stripMark(l); return s.length <= 70 && QTY.test(s) && !VERB.test(s) && !/[.!?]\s+\S/.test(s); };
  const looksStep = l => { const s = stripMark(l); return VERB.test(s) || s.length > 70 || /^\s*(?:\d+\s*[.)]|step\s*\d)/i.test(l); };
  function pushSteps(steps, text){
    if (text.length <= 240) { steps.push({text}); return; }
    // A long paragraph becomes a few shorter steps, two sentences at a time.
    const sentences = (text.match(/[^.!?]+[.!?]+["')\]]*(?:\s+|$)|[^.!?]+$/g) || [text]).map(x => x.trim()).filter(Boolean);
    for (let i = 0; i < sentences.length; i += 2) steps.push({text: sentences.slice(i, i + 2).join(' ')});
  }
  function parseRecipe(body){
    const r = {meta:[], intro:[], groups:[{name:'', items:[]}], steps:[], notes:[], sections:false};
    let mode = 'pre';
    body.replace(/\r\n?/g, '\n').split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line || /^([-*_])(\s*\1){2,}$/.test(line)) return;
      const bare = line.replace(/[:：]\s*$/, '').trim();
      if (ING_HEAD.test(line)) { mode = 'ing'; r.sections = true; return; }
      if (STEP_HEAD.test(line)) { mode = 'steps'; r.sections = true; return; }
      if (NOTE_HEAD.test(line)) { mode = 'notes'; r.sections = true; return; }
      if (mode === 'pre') { (META.test(line) && line.length < 60 && !VERB.test(stripMark(line)) ? r.meta : r.intro).push(line); return; }
      if (mode === 'ing') {
        if (isSubHead(line)) r.groups.push({name:bare, items:[]});
        else r.groups[r.groups.length - 1].items.push(stripMark(line));
        return;
      }
      if (mode === 'steps') { if (isSubHead(line)) r.steps.push({head:bare}); else pushSteps(r.steps, stripMark(line)); return; }
      r.notes.push(stripMark(line));
    });
    if (!r.sections) {
      // No headings: sort lines by what they look like, keeping the order.
      const lines = r.intro; r.intro = [];
      let started = false;
      lines.forEach(l => {
        const s = stripMark(l);
        if (!r.steps.length && looksIngredient(l)) { r.groups[0].items.push(s); started = true; }
        else if (looksStep(l) && (started || VERB.test(s))) { pushSteps(r.steps, s); started = true; }
        else if (!started) r.intro.push(l);
        else if (r.steps.length) pushSteps(r.steps, s);
        else r.groups[0].items.push(s);
      });
    }
    r.groups = r.groups.filter(g => g.items.length);
    return r;
  }
  function formatRecipe(r){
    const out = [];
    if (r.meta.length) out.push(r.meta.join(' · '));
    if (r.intro.length) out.push('', r.intro.join('\n'));
    if (r.groups.length) {
      out.push('', 'INGREDIENTS');
      r.groups.forEach(g => { if (g.name) out.push('', g.name + ':'); g.items.forEach(x => out.push('• ' + x)); });
    }
    let n = 0;
    if (r.steps.some(s => s.text)) {
      out.push('', 'METHOD');
      r.steps.forEach((s, i) => { if (i) out.push(''); out.push(s.head ? s.head + ':' : ++n + '. ' + s.text); });
    }
    if (r.notes.length) { out.push('', 'NOTES'); r.notes.forEach(x => out.push('• ' + x)); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const countRecipe = r => ({ings: r.groups.reduce((k, g) => k + g.items.length, 0), steps: r.steps.filter(s => s.text).length});
  function looksLikeRecipe(body, tags){
    if (tags.includes('recipe')) return true;
    if (/\bingredients?\b/i.test(body) && /\b(method|instructions?|directions?|steps?)\b/i.test(body)) return true;
    const lines = body.split('\n');
    return lines.filter(l => looksIngredient(l)).length >= 3 && lines.some(l => VERB.test(stripMark(l)));
  }
  function updateRecipeBar(){ if (st.editing) $('edRecipe').hidden = !looksLikeRecipe($('edBody').value, st.editing.tags); }
  $('edBody').addEventListener('input', updateRecipeBar);

  $('edConvert').onclick = () => {
    const before = $('edBody').value, r = parseRecipe(before), c = countRecipe(r);
    if (!c.ings && !c.steps) { toast('Couldn’t find ingredients or steps in this note.'); return; }
    $('edBody').value = formatRecipe(r);
    const addedTag = !st.editing.tags.includes('recipe');
    if (addedTag) { st.editing.tags.push('recipe'); noteTags.render(); }
    growBody(); updateRecipeBar();
    $('editor').querySelector('.sheetbody').scrollTop = 0;
    toast('Tidied: ' + plural(c.ings, 'ingredient') + ', ' + plural(c.steps, 'step'), () => {
      $('edBody').value = before;
      if (addedTag && st.editing) { st.editing.tags = st.editing.tags.filter(t => t !== 'recipe'); noteTags.render(); }
      growBody(); updateRecipeBar();
    });
  };

  // Step by step: ingredients checklist first, then one step per screen.
  let cook = null, wake = null;
  async function keepAwake(){ try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch(e) { wake = null; } }
  function letSleep(){ try { if (wake) wake.release(); } catch(e) {} wake = null; }
  document.addEventListener('visibilitychange', () => { if (cook && document.visibilityState === 'visible') keepAwake(); });

  $('edCook').onclick = () => {
    const r = parseRecipe($('edBody').value);
    const screens = [];
    if (r.groups.length) screens.push({type:'ing'});
    let head = '';
    r.steps.forEach(s => { if (s.head) head = s.head; else screens.push({type:'step', text:s.text, head}); });
    if (!screens.some(s => s.type === 'step')) { toast('Couldn’t find the steps. Try Convert first.'); return; }
    screens.push({type:'done'});
    cook = {r, screens, i:0, ticked:new Set(), title:$('edTitle').value.trim() || 'Recipe', nSteps:screens.filter(s => s.type === 'step').length};
    $('ckTitle').textContent = cook.title;
    $('cook').hidden = false; lockPage();
    renderCook(0);
    keepAwake();
    $('ckNext').focus({preventScroll:true});
  };
  function closeCook(){ $('cook').hidden = true; lockPage(); cook = null; letSleep(); $('edCook').focus({preventScroll:true}); }
  function renderCook(dir){
    const c = cook, sc = c.screens[c.i], last = c.screens.length - 1;
    const stepNo = c.screens.slice(0, c.i + 1).filter(s => s.type === 'step').length;
    $('ckCount').textContent = sc.type === 'step' ? stepNo + ' / ' + c.nSteps : sc.type === 'ing' ? 'Prep' : 'Done';
    $('ckBar').style.width = (last ? c.i / last * 100 : 100) + '%';
    let h;
    if (sc.type === 'ing') {
      h = '<p class="k">Before you start</p><h2 class="big">Ingredients</h2><p class="sub">Tap each one as you get it out.</p><ul class="ingl">'
        + c.r.groups.map((g, gi) => (g.name ? '<li class="gh">' + esc(g.name) + '</li>' : '')
          + g.items.map((x, xi) => { const k = gi + '-' + xi, on = c.ticked.has(k);
              return '<li><button type="button" data-ing="' + k + '" aria-pressed="' + on + '"><span class="bx">' + I.check + '</span><span>' + esc(x) + '</span></button></li>'; }).join('')).join('')
        + '</ul>';
    } else if (sc.type === 'step') {
      h = '<p class="k">Step ' + stepNo + ' of ' + c.nSteps + '</p>' + (sc.head ? '<p class="sub">' + esc(sc.head) + '</p>' : '') + '<p class="big">' + esc(sc.text) + '</p>';
    } else {
      h = '<p class="k">All done</p><p class="big">Enjoy your ' + esc(c.title) + '.</p><button class="btn" type="button" id="ckFinish">Back to the recipe</button>';
    }
    const card = $('ckCard');
    card.innerHTML = h; card.scrollTop = 0;
    card.classList.remove('from-l', 'from-r'); void card.offsetWidth;
    if (dir) card.classList.add(dir > 0 ? 'from-r' : 'from-l');
    $('ckPrev').disabled = c.i === 0;
    $('ckNext').disabled = c.i === last;
    $('ckDots').innerHTML = c.screens.length <= 16 ? c.screens.map((s, i) => '<i' + (i === c.i ? ' class="on"' : '') + '></i>').join('') : '';
  }
  const go = d => { if (!cook) return; const i = cook.i + d; if (i < 0 || i >= cook.screens.length) return; cook.i = i; renderCook(d); };
  $('ckPrev').onclick = () => go(-1);
  $('ckNext').onclick = () => go(1);
  $('ckClose').onclick = closeCook;
  $('ckCard').addEventListener('click', e => {
    const b = e.target.closest('[data-ing]');
    if (b) { const k = b.dataset.ing; cook.ticked.has(k) ? cook.ticked.delete(k) : cook.ticked.add(k); b.setAttribute('aria-pressed', cook.ticked.has(k)); return; }
    if (e.target.closest('#ckFinish')) closeCook();
  });
  // Swipe sideways on the card to move between steps.
  let sx = null, sy = 0;
  $('ckCard').addEventListener('touchstart', e => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, {passive:true});
  $('ckCard').addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', e => {
    if (!cook) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeCook(); }
  }, true);

  // ---------- Google Sheet sync: one shared Sheet for both phones ----------
  // The app sends everything to a small Apps Script in the Sheet a couple of
  // seconds after each change (and when it opens); the script merges it with
  // what the other phone sent (newest change wins) and sends the whole lot
  // back. Deleted-for-good items travel as "graves" so they stay deleted.
  let syncing = false, syncAgain = false, syncTimer = null, syncState = syncCfg ? 'idle' : 'off', syncErr = '', errShown = false;
  let lastSyncAt = 0;
  try { lastSyncAt = +localStorage.getItem(SYNC_KEY + '-at') || 0; } catch(e) {}
  const SYNC_ERRORS = {
    'wrong-secret':'The secret code doesn’t match the SECRET in the script.',
    'secret-not-set':'The script still says SECRET = ‘CHANGE-ME’. Change it, save, and deploy a new version.',
    'busy':'The Sheet was busy. Trying again shortly.',
    'bad-request':'The Sheet didn’t understand the request.',
    'network':'Couldn’t reach the Sheet. Check the link, or you may be offline.',
    'not-json':'That link didn’t answer like the Notes script. Check it ends in /exec and “Who has access” is Anyone.'
  };
  const syncLabel = () => ({off:'', idle:'', syncing:' · Syncing…', ok:' · Synced', error:' · Not synced', offline:' · Offline'})[syncState] || '';
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

  function applyRemote(res){
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    let localNewer = false;
    const mergeKind = (kind, local, remote) => {
      const map = new Map(local.map(x => [x.id, x]));
      const mine = new Set(local.filter(x => x.private).map(x => x.id));   // private: this phone's copy always wins
      (remote || []).forEach(r => {
        if (!r || typeof r.id !== 'string' || mine.has(r.id)) return;
        const l = map.get(r.id);
        if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r);
        else if ((+l.updated || 0) > (+r.updated || 0)) localNewer = true;
      });
      const remoteIds = new Set((remote || []).map(r => r && r.id));
      local.forEach(l => { if (!l.private && !remoteIds.has(l.id) && !graves[kind + ':' + l.id]) localNewer = true; });
      return [...map.values()].filter(x => { if (x.private) return true; const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); });
    };
    notes = mergeKind('notes', notes, saneAll(res.notes, saneNote));
    todos = mergeKind('todos', todos, saneAll(res.todos, saneTodo));
    lists = mergeKind('lists', lists, saneAll(res.lists, saneList));
    if (!lists.length) lists = clone(SAMPLE_LISTS);
    todos.forEach(t => { if (!lists.some(l => l.id === t.list)) t.list = lists[0].id; });
    fixNotes(); initShadow(); persist();
    if (localNewer) syncAgain = true;
    render();
  }

  // Private notes are never sent. Each one goes out only as a "deleted" mark,
  // so a note that was synced before it was made private leaves the Sheet and
  // the other phones; turning Private off later makes it newer than that mark.
  function sendGraves(){
    const g = Object.assign({}, graves);
    notes.forEach(n => { if (n.private) g['notes:' + n.id] = Math.max(g['notes:' + n.id] || 0, +n.updated || 0); });
    return g;
  }
  async function sync(loud){
    if (!syncCfg) return false;
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { syncState = 'offline'; renderSyncStatus(); return false; }
    syncing = true; syncState = 'syncing'; renderSyncStatus();
    let ok = false;
    try {
      track(); persist();
      let r, res;
      try {
        r = await fetch(syncCfg.url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, redirect:'follow', cache:'no-store',
          body: JSON.stringify({secret:syncCfg.secret, action:'sync', v:1, notes: notes.filter(n => !n.private), todos, lists, graves: sendGraves()})});
      } catch(e) { throw new Error('network'); }
      try { res = await r.json(); } catch(e) { throw new Error('not-json'); }
      if (!res || !res.ok) throw new Error((res && res.error) || 'not-json');
      lastSyncAt = Date.now(); try { localStorage.setItem(SYNC_KEY + '-at', String(lastSyncAt)); } catch(e) {}
      syncState = 'ok'; syncErr = ''; errShown = false; ok = true;
      applyRemote(res);
      if (pushDirty) { pushDirty = false; pokePush(); }
      if (pendingOpen) { const w = pendingOpen; pendingOpen = null; openFrom(w, true); }
    } catch(e) {
      syncState = 'error'; syncErr = e.message;
      if (loud || !errShown) { errShown = true; toast(SYNC_ERRORS[syncErr] || 'Sync didn’t work. Trying again later.'); }
    } finally {
      syncing = false; renderSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  function scheduleSync(ms){ clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 2000 : ms); }

  function renderSyncStatus(){
    const on = !!syncCfg;
    const line = !on ? 'Not connected' : syncState === 'error' ? (SYNC_ERRORS[syncErr] || 'Not synced') : syncState === 'syncing' ? 'Syncing…'
      : syncState === 'offline' ? 'Offline. Changes will sync when you’re back online.' : lastSyncAt ? 'Connected. Last synced ' + ago(lastSyncAt) + '.' : 'Connected.';
    $('bkSheetSub').textContent = line;
    $('syStatus').textContent = on ? line : 'Not connected in ' + place() + '. Notes opened from its own icon, from aOS and in Safari each keep their own copy, so each needs connecting once.';
    $('syForm').hidden = on; $('syOn').hidden = !on;
    if (st.tab === 'notes' && !st.coll && !tokensOf(st.q).length) $('notesSub').textContent = plural(shelf().length, 'note') + syncLabel();
    syncPill();
  }
  // The pill at the top: shows while a sync runs (at least ~1s, so it never
  // just flickers), turns into a tick and "Synced", then fades away.
  let pillAt = 0, pillTimer = null;
  function syncPill(){
    const p = $('syncPill'), txt = $('syncPillTxt');
    if (syncState === 'syncing') {
      clearTimeout(pillTimer);
      if (p.hidden) pillAt = Date.now();
      p.classList.remove('out', 'done'); p.hidden = false; txt.textContent = 'Syncing';
      return;
    }
    if (p.hidden || p.classList.contains('done') || p.classList.contains('out')) return;
    clearTimeout(pillTimer);
    const hide = () => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); };
    pillTimer = setTimeout(() => {
      if (syncState !== 'ok') return hide();
      p.classList.add('done'); txt.textContent = 'Synced';
      pillTimer = setTimeout(hide, 1200);
    }, Math.max(0, 1000 - (Date.now() - pillAt)));
  }
  const place = () => {
    const app = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    return app ? 'the Notes app' : 'this browser';
  };
  function openSyncSheet(pre){
    $('syUrl').value = pre ? pre.u : syncCfg ? syncCfg.url : '';
    $('sySecret').value = pre ? pre.s : syncCfg ? syncCfg.secret : '';
    if (pre && syncCfg) { $('syForm').hidden = false; $('syOn').hidden = true; }
    renderSyncStatus();
    if (pre) {
      $('syForm').hidden = false; $('syOn').hidden = true;
      // Say exactly where the link points, so a link from anyone else stands out.
      let where = pre.u; try { const u = new URL(pre.u); where = u.host + u.pathname.replace(/^(\/macros\/s\/.{6}).*(\/exec)$/, '$1…$2'); } catch(e) {}
      const other = syncCfg && syncCfg.url !== pre.u;
      $('syStatus').textContent = 'From a setup link to ' + where + '. ' + (other ? 'That is a different Sheet from the one this phone uses now. ' : '')
        + 'Connect sends your notes and reminders there. Only tap Connect if the link came from your own Notes.';
    }
    openSheet('syncSheet');
  }
  $('bkSheet').onclick = () => { closeSheet('backupSheet'); openSyncSheet(); };
  $('syForm').onsubmit = async e => {
    e.preventDefault();
    const url = $('syUrl').value.trim(), secret = $('sySecret').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { $('syStatus').textContent = 'Paste the web app link from Apps Script. It starts with https://script.google.com/ and ends in /exec.'; return; }
    if (!secret) { $('syStatus').textContent = 'Enter the secret code you put in the script.'; return; }
    const before = syncCfg;
    syncCfg = {url, secret};
    $('syConnect').disabled = true; $('syStatus').textContent = 'Connecting…';
    const ok = await sync(true);
    $('syConnect').disabled = false;
    if (!ok) { syncCfg = before; renderSyncStatus(); $('syStatus').textContent = SYNC_ERRORS[syncErr] || 'Couldn’t connect.'; return; }
    saveSyncCfg();
    if (linkServer && !push.on) { push.server = linkServer; savePush(); }
    linkServer = null;
    renderSyncStatus();
    toast('Connected. ' + plural(alive().length, 'note') + ' and ' + plural(todos.length, 'reminder') + ' now in the Sheet.');
  };
  $('syNow').onclick = async () => { if (await sync(true)) toast('Synced'); };
  $('syShare').onclick = async () => {
    const link = location.href.split('#')[0] + '#sync=' + b64e(JSON.stringify(Object.assign({u:syncCfg.url, s:syncCfg.secret}, push.server ? {p:push.server} : {})));
    try { await navigator.clipboard.writeText(link); toast('Setup link copied. To use it, copy it, open Notes and tap the clipboard button. Only send it to your wife.'); }
    catch(e) { toast('Copy isn’t available here.'); }
  };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    syncCfg = null; syncState = 'off'; saveSyncCfg();
    renderSyncStatus(); toast('Disconnected. Your notes stay on this phone and in the Sheet.');
  };
  function takeSetupLink(text){
    const m = text.match(/#sync=([\w-]+)/); if (!m) return false;
    // The link's notification server (p) is only taken once Connect works.
    try { const c = JSON.parse(b64d(m[1])); if (c && typeof c.u === 'string' && typeof c.s === 'string') { linkServer = typeof c.p === 'string' && okServer(c.p) ? c.p : null; openSyncSheet(c); return true; } } catch(e) {}
    toast('That setup link is damaged. Copy it again.'); return true;
  }
  document.addEventListener('visibilitychange', () => { if (syncCfg && document.visibilityState === 'visible' && Date.now() - lastSyncAt > 30000) sync(false); });
  window.addEventListener('online', () => { if (syncCfg) sync(false); });

  // ---------- notifications (notes/push; notes/README.md, "Notifications") ----------
  // The server alerts this phone when a reminder is due, or a note's nudge
  // comes round, even with Notes closed. It reads them from the Google Sheet,
  // so it needs the Sheet connected; this phone tells it its time zone, which
  // lists to alert for, whether to include nudges, and when "no time" is.
  const okServer = u => /^(https:\/\/[\w.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d+)?(\/[\w.\/-]*)?$/.test(u);
  const pushable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) { return ''; } };
  const serverUrl = p => new URL(p, push.server.replace(/\/*$/, '/')).href;
  const keyBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  const bytesKey = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fmtClock = hm => new Date('2000-01-01T' + (hm || '09:00')).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  const PUSH_ERRORS = {
    'no-sheet':'Connect the Google Sheet first (the download button, then Google Sheet sync). The server reads your reminders from it.',
    'wrong-secret':'The server says the Sheet’s secret code is wrong. Reconnect the Google Sheet, then try again.',
    'other-sheet':'This server already alerts for a different Google Sheet. Use the setup link from the phone that set it up.',
    'sheet-network':'The server couldn’t reach the Google Sheet. Try again in a minute.',
    'sheet-not-json':'The server couldn’t read the Google Sheet. Check that Sync now works, then try again.',
    'sheet-busy':'The Google Sheet was busy. Try again in a moment.',
    'sheet-secret-not-set':'The Sheet’s script still has CHANGE-ME as its secret.',
    'bad-subscription':'The server didn’t accept this phone. Turn notifications off and on again.',
    'not-subscribed':'This phone isn’t signed up any more. Turn notifications on again.',
    'network':'Couldn’t reach the server. Check the address, or you may be offline.',
    'denied':'Notifications are turned off for Notes. Allow them in the iPhone’s Settings → Notifications → Notes, then try again.',
    'no-key':'That address didn’t answer like the Notes server. Check it (it ends in workers.dev).'
  };
  const pushErr = e => PUSH_ERRORS[e && e.message] || 'That didn’t work (' + ((e && e.message) || 'unknown') + ').';
  async function pushPost(path, body){
    let r, d = null;
    try { r = await fetch(serverUrl(path), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), cache:'no-store'}); }
    catch(e) { throw new Error('network'); }
    try { d = await r.json(); } catch(e) {}
    if (!r.ok || !d || !d.ok) throw new Error((d && d.error) || 'server-' + r.status);
    return d;
  }
  async function pushReg(){ await navigator.serviceWorker.register('sw.js'); return navigator.serviceWorker.ready; }
  async function currentSub(){ if (!pushable()) return null; try { return (await pushReg()).pushManager.getSubscription(); } catch(e) { return null; } }
  const alertOf = t => t.alert == null ? 0 : +t.alert;
  const alertsHere = t => push.on && !t.done && !!t.date && alertOf(t) >= 0 && !push.skip.includes(t.list);
  const ALERTS_TIMED = [[0,'At time'],[5,'5 min before'],[15,'15 min before'],[30,'30 min before'],[60,'1 hour before'],[120,'2 hours before'],[1440,'1 day before'],[2880,'2 days before'],[10080,'1 week before'],[-1,'None']];
  const ALERTS_DAY = [[0,'On the day'],[1440,'1 day before'],[2880,'2 days before'],[10080,'1 week before'],[-1,'None']];

  function pushPrefs(){ return {tz:zone(), lang:navigator.language || 'en-US', morning:push.morning, skip:push.skip, nudges:push.nudges}; }
  async function subscribeHere(sub){
    await pushPost('subscribe', {subscription:sub.toJSON(), sheet:{url:syncCfg.url, secret:syncCfg.secret}, prefs:pushPrefs()});
    push.tz = zone(); savePush();
  }
  function renderPush(){
    $('remBellDot').hidden = !push.on;
    const on = push.on;
    $('puOff').hidden = on; $('puOnBox').hidden = !on;
    $('puStatus').textContent = !pushable()
      ? (isIOS && !standalone() ? 'On iPhone, notifications only work in Notes opened from its own Home Screen icon. Open it from there and turn them on.' : 'This browser can’t show notifications.')
      : !syncCfg ? PUSH_ERRORS['no-sheet']
      : on ? 'On in ' + place() + '. Reminders alert here at their Alert time, even with Notes closed.'
      : 'Get an alert on this phone when a reminder is due or a note’s nudge comes round, even with Notes closed.';
    $('puLists').innerHTML = lists.map(l => '<button class="opt" type="button" data-pl="'+esc(l.id)+'" style="--lc:'+hexOr(l.color)+'" aria-pressed="'+!push.skip.includes(l.id)+'"><span class="sw"></span>'+esc(l.name)+'</button>').join('');
    $('puNudges').setAttribute('aria-checked', push.nudges);
    $('puMorning').value = push.morning;
  }
  function openPush(){ $('puServer').value = push.server; renderPush(); openSheet('pushSheet'); }
  $('remBellBtn').onclick = openPush;

  $('puOn').onclick = async () => {
    const server = $('puServer').value.trim().replace(/\/+$/, '');
    if (!pushable()) { renderPush(); return; }
    if (!syncCfg) { $('puStatus').textContent = PUSH_ERRORS['no-sheet']; return; }
    if (!okServer(server)) { $('puStatus').textContent = 'Enter the server address. It starts with https:// and ends in workers.dev.'; return; }
    $('puOn').disabled = true; $('puStatus').textContent = 'Turning on…';
    try {
      // First, while the tap still counts: iPhone only asks from a tap.
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('denied');
      push.server = server;
      let key = null;
      try { key = (await (await fetch(serverUrl('key'), {cache:'no-store'})).json()).key; } catch(e) { throw new Error('no-key'); }
      if (!key) throw new Error('no-key');
      const reg = await pushReg();
      let sub = await reg.pushManager.getSubscription();
      const had = sub && sub.options && sub.options.applicationServerKey;
      if (sub && (!had || bytesKey(had) !== key)) { await sub.unsubscribe(); sub = null; }   // made for another server
      if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:keyBytes(key)});
      await subscribeHere(sub);
      push.on = true; savePush(); renderPush(); render();
      toast('Notifications on for this phone');
    } catch(e) {
      savePush(); $('puStatus').textContent = pushErr(e);
    } finally { $('puOn').disabled = false; }
  };
  // A change of lists, nudges or morning time goes to the server a moment later.
  let prefsTimer = null;
  function prefsChanged(){
    savePush(); renderPush(); render();
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(async () => {
      const sub = await currentSub();
      if (!sub) { push.on = false; savePush(); renderPush(); render(); toast(PUSH_ERRORS['not-subscribed']); return; }
      try { await subscribeHere(sub); } catch(e) { toast(pushErr(e)); }
    }, 700);
  }
  $('puLists').addEventListener('click', e => {
    const b = e.target.closest('[data-pl]'); if (!b) return;
    const id = b.dataset.pl;
    push.skip = push.skip.includes(id) ? push.skip.filter(x => x !== id) : [...push.skip, id];
    prefsChanged();
  });
  $('puNudges').onclick = () => { push.nudges = !push.nudges; prefsChanged(); };
  $('puMorning').addEventListener('change', e => { if (/^\d{2}:\d{2}$/.test(e.target.value)) { push.morning = e.target.value; prefsChanged(); } });
  $('puTest').onclick = async () => {
    const sub = await currentSub();
    if (!sub) { push.on = false; savePush(); renderPush(); $('puStatus').textContent = PUSH_ERRORS['not-subscribed']; return; }
    try { await pushPost('test', {endpoint:sub.endpoint}); toast('Test sent. It should arrive in a few seconds.'); }
    catch(e) { if (e.message === 'not-subscribed') { push.on = false; savePush(); renderPush(); } toast(pushErr(e)); }
  };
  $('puOffBtn').onclick = async () => {
    const sub = await currentSub();
    push.on = false; savePush(); renderPush(); render();
    if (sub) { pushPost('unsubscribe', {endpoint:sub.endpoint}).catch(() => {}); sub.unsubscribe().catch(() => {}); }
    toast('Notifications off for this phone');
  };
  // After this phone syncs a change, the server reads the Sheet again, so a
  // new or moved reminder alerts on time rather than at the next 15-minute read.
  function pokePush(){
    if (!push.on || !push.server) return;
    currentSub().then(sub => {
      if (!sub) return;
      return pushPost('refresh', {endpoint:sub.endpoint}).catch(e => { if (e.message === 'not-subscribed' && syncCfg) return subscribeHere(sub); });
    }).catch(() => {});
  }
  // Opening a notification: the reminder or note it's about. If it isn't on
  // this phone yet (added on the other phone), after the next sync.
  function openFrom(what, late){
    if (!what) return;
    if (what === 'rem') { setTab('rem'); return; }
    const i = what.indexOf(':'), kind = what.slice(0, i), id = what.slice(i + 1);
    if (kind === 'todo' && todos.some(t => t.id === id)) { setTab('rem'); if (!$('todoSheet').hidden) finishTodo(); openTodo(id); return; }
    if (kind === 'note' && notes.some(n => n.id === id)) { setTab('notes'); if (!$('editor').hidden) finishEdit(); openEditor(id); return; }
    if (!late && syncCfg) { pendingOpen = what; sync(false); return; }
    toast(kind === 'note' ? 'That note isn’t here any more.' : 'That reminder isn’t here any more.');
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && typeof e.data.open === 'string') openFrom(e.data.open); });
  // Opening the app: still allowed to notify? Moved time zone?
  function checkPush(){
    renderPush();
    if (!push.on) return;
    if (!pushable() || Notification.permission === 'denied') { push.on = false; savePush(); renderPush(); render(); return; }
    if (push.tz !== zone()) prefsChanged();
  }

  // ---------- backup ----------
  const LAST = KEY + '-backup';
  const lastBackup = () => { try { return +localStorage.getItem(LAST) || 0; } catch(e) { return 0; } };
  const needsBackup = () => (notes.length + todos.length > 3) && Date.now() - lastBackup() > 7 * D && !(syncCfg && Date.now() - lastSyncAt < 7 * D);
  function backupStatus(){
    const t = lastBackup();
    if (!t) return 'Not backed up yet.';
    const days = Math.floor((Date.now() - t) / D);
    return 'Last backup ' + (days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago') + '.';
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-open-backup]')) return;
    $('bkStatus').textContent = backupStatus();
    openSheet('backupSheet');
  });
  $('bkExport').onclick = async () => {
    const file = new File([JSON.stringify({app:'allison-notes', v:1, kind:'backup', saved:new Date().toISOString(), notes, lists, todos}, null, 2)],
      'notes-backup-' + todayStr() + '.json', {type:'application/json'});
    const r = await shareOut({title:'Notes backup', file});
    if (r === 'shared' || r === 'downloaded') { try { localStorage.setItem(LAST, String(Date.now())); } catch(e){} }
    closeSheet('backupSheet'); render();
    toast({shared:'Backup saved', downloaded:'Backup saved to Downloads', cancelled:'Backup canceled'}[r] || 'Couldn\u2019t save the backup');
  };
  $('bkImport').onclick = () => $('bkFile').click();
  $('bkFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    closeSheet('backupSheet');
    let data;
    try { data = JSON.parse(await f.text()); } catch(err) { toast('That file isn\u2019t a Notes file.'); return; }
    if (data && data.kind === 'backup' && Array.isArray(data.notes) && Array.isArray(data.lists) && Array.isArray(data.todos)) {
      const haveN = new Set(notes.map(n => n.id)), haveT = new Set(todos.map(t => t.id)), haveL = new Set(lists.map(l => l.id));
      const addL = saneAll(data.lists, saneList).filter(l => !haveL.has(l.id));
      const addN = saneAll(data.notes, saneNote).filter(n => Array.isArray(n.tags) && !haveN.has(n.id));
      const addT = saneAll(data.todos, saneTodo).filter(t => !haveT.has(t.id));
      if (!addL.length && !addN.length && !addT.length) { toast('Nothing new in that file.'); return; }
      if (!confirm('Add ' + plural(addN.length, 'note') + ', ' + plural(addT.length, 'reminder') + ' and ' + plural(addL.length, 'list') + ' from this file? Only restore files you made yourself.')) return;
      lists.push(...addL); notes.push(...addN); todos.push(...addT); fixNotes();
      const known = new Set(lists.map(l => l.id)); todos.forEach(t => { if (!known.has(t.list)) t.list = lists[0].id; });
      save(); render();
      toast('Restored ' + plural(addN.length, 'note') + ' and ' + plural(addT.length, 'reminder'));
    } else if (data && Array.isArray(data.items)) offerImport(data.items);
    else toast('That file isn\u2019t a Notes file.');
  });

  // ---------- add to calendar: the phone's calendar does the alerting ----------
  function icsFor(t){
    const esc2 = v => String(v).replace(/[\\;,]/g, m => '\\' + m).replace(/\r\n|\r|\n/g, '\\n');   // \r too: a lone \r would start a line of its own
    const d = t.date.replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Allison OS//Notes//EN','BEGIN:VEVENT','UID:' + String(t.id).replace(/[\r\n]/g, '') + '@allison-notes','DTSTAMP:' + stamp];
    if (t.time) {
      const end = new Date(t.date + 'T' + t.time); end.setMinutes(end.getMinutes() + 30);
      lines.push('DTSTART:' + d + 'T' + t.time.replace(':', '') + '00', 'DTEND:' + ymd(end).replace(/-/g, '') + 'T' + pad(end.getHours()) + pad(end.getMinutes()) + '00');
      lines.push('BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:' + esc2(t.title),'END:VALARM');
    } else {
      const next = new Date(t.date + 'T12:00'); next.setDate(next.getDate() + 1);
      lines.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + ymd(next).replace(/-/g, ''));
      lines.push('BEGIN:VALARM','TRIGGER:PT9H','ACTION:DISPLAY','DESCRIPTION:' + esc2(t.title),'END:VALARM');
    }
    lines.push('SUMMARY:' + esc2(t.title));
    if (t.notes) lines.push('DESCRIPTION:' + esc2(t.notes));
    lines.push('END:VEVENT','END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  // ---------- tags manager ----------
  function renderTagRows(){
    const nc = new Map(countTags(alive())), tc = new Map(countTags(todos));
    const all = countTags([...alive(), ...todos]);
    $('tagRows').innerHTML = all.length ? all.map(([t], i) => {
      const parts = []; if (nc.get(t)) parts.push(plural(nc.get(t), 'note')); if (tc.get(t)) parts.push(plural(tc.get(t), 'reminder'));
      return '<div class="tagrow"><span class="grow"><input class="plain" id="tg'+i+'" value="'+esc(t)+'" data-old="'+esc(t)+'" aria-label="Rename tag '+esc(t)+'" style="font-weight:700"><span class="sub">'+parts.join(' · ')+'</span></span>'
        + (nc.get(t) ? '<button class="linkbtn" type="button" data-filter="'+esc(t)+'">Show notes</button>' : '')
        + '<button class="iconbtn danger" type="button" data-del="'+esc(t)+'" aria-label="Delete tag '+esc(t)+'">'+I.trash+'</button></div>';
    }).join('') : '<div class="tagrow"><span class="sub">No tags yet. Add one from a note or reminder.</span></div>';
  }
  $('tagsBtn').onclick = $('remTagsBtn').onclick = () => { renderTagRows(); openSheet('tagsSheet'); };
  $('tagRows').addEventListener('change', e => {
    const inp = e.target; if (!inp.dataset.old) return;
    const from = inp.dataset.old, to = normTag(inp.value);
    if (!to || to === from) { inp.value = from; return; }
    [...notes, ...todos].forEach(n => { if (n.tags.includes(from)) n.tags = [...new Set(n.tags.map(t => t === from ? to : t))]; });
    if (st.coll === 'tag:' + from) st.coll = 'tag:' + to;
    save(); render(); renderTagRows(); toast('Renamed #'+from+' to #'+to);
  });
  $('tagRows').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.old) e.target.blur(); });
  $('tagRows').addEventListener('click', e => {
    const f = e.target.closest('[data-filter]'), d = e.target.closest('[data-del]');
    if (f) { closeSheet('tagsSheet'); setTab('notes'); openColl('tag:' + f.dataset.filter); }
    if (d) {
      const t = d.dataset.del, before = new Map([...notes, ...todos].map(n => [n.id, [...n.tags]]));
      [...notes, ...todos].forEach(n => { n.tags = n.tags.filter(x => x !== t); });
      if (st.coll === 'tag:' + t) st.coll = null; save(); render(); renderTagRows();
      toast('Deleted #'+t+'. Items kept.', () => {
        [...notes, ...todos].forEach(n => { if (before.has(n.id)) n.tags = before.get(n.id); }); save(); render(); renderTagRows();
      });
    }
  });

  setTab(st.tab === 'rem' ? 'rem' : 'notes');
  checkIncoming();
  renderSyncStatus();
  checkPush();
  (function(){
    const q = new URLSearchParams(location.search).get('open');
    if (!q) return;
    history.replaceState(null, '', location.pathname + location.hash);
    openFrom(q);
  })();
  if (syncCfg) { setTimeout(() => sync(false), 600); keep.get('sync').then(c => { if (!c || c.url !== syncCfg.url || c.secret !== syncCfg.secret) saveSyncCfg(); }); }
  else keep.get('sync').then(c => {
    if (syncCfg || !c || !c.url || !c.secret) return;
    syncCfg = {url:c.url, secret:c.secret}; syncState = 'idle';
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg)); } catch(e) {}
    renderSyncStatus(); sync(false);
    toast('Reconnected to the Google Sheet from this phone’s backup copy.');
  });
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
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    const ver = (h >>> 0).toString(36), VK = KEY + '-version';
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
