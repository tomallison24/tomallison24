// labs/layouts: five ways to lay out aOS Home, side by side (see index.html). Each is drawn at an
// iPhone's 390 x 844 and scaled to fit; a tap on an app says it would open it. "Time me" races you
// through six apps on one layout and keeps your times on this phone (lab.layouts).
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KEY = 'lab.layouts';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const NAMES = { mail: 'Mail', calendar: 'Calendar', clock: 'Clock', news: 'News', weather: 'Weather', notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel', places: 'Places',
    fitness: 'Fitness', drinks: 'Drinks', meals: 'Meals', orders: 'Orders', money: 'Money', house: 'Home', sparkle: 'Sparkle Kingdom' };
  const TAGS = { meals: 'This week’s dinners', notes: 'Lists and notes', news: 'Today’s stories', travel: 'Trips and flights', clock: 'Alarms and timers', fitness: 'Workouts',
    orders: 'Packages on the way', places: 'Saved spots', podcasts: 'Up next', drinks: 'Recipes', money: 'Budget', sparkle: 'The game' };
  const ALL = Object.keys(NAMES);
  const FIXED = ['house', 'mail', 'weather', 'calendar'];
  // sample usage: the four opened most over two weeks, or at this time of day
  const USED = { weeks: ['meals', 'notes', 'news', 'travel'], morning: ['news', 'fitness', 'meals', 'clock'], afternoon: ['orders', 'travel', 'notes', 'places'], evening: ['meals', 'podcasts', 'drinks', 'notes'] };
  // sample live data for the widgets
  const S = { temp: '64°', sky: 'Partly cloudy', hilo: 'H 68° · L 52°', when: '4:30 PM', event: 'Soccer practice', then: 'Then Dinner at Nana’s, 6:30', unread: 3, from: 'School office: Field trip form', lights: 2, inside: '70°' };
  // on the site the icons are each app's own; published elsewhere, beside this page
  const onSite = /\/labs\//.test(location.pathname);
  const src = id => onSite ? `../../${id}/icon-180.png` : `icons/${id}.png`;
  const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.7 5 2.6 6.9 7.5 7.5-4.9.6-6.8 2.5-7.5 7.5-.7-5-2.6-6.9-7.5-7.5 4.9-.6 6.8-2.5 7.5-7.5z"/><path d="M19 15.5c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z" opacity=".7"/></svg>';
  const GLASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  const PERSON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z"/></svg>';
  const TODAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 12h5"/></svg>';

  const hour = new Date().getHours();
  const st = Object.assign({ mode: 'weeks', tod: hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : 'evening', hand: 'right', times: {}, lightsOff: false }, load());
  const used = () => USED[st.mode === 'now' ? st.tod : 'weeks'];
  const rest = () => ALL.filter(id => !FIXED.includes(id) && !used().includes(id));
  const usedTitle = () => st.mode === 'now' ? `Right now · ${st.tod[0].toUpperCase() + st.tod.slice(1)}` : 'Most opened';
  const date = new Date(), DAY = date.toLocaleDateString('en-US', { weekday: 'long' }), MON = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // ---- pieces ----
  const label = id => esc(NAMES[id]) + (id === 'mail' ? `, ${S.unread} unread` : '');
  const ic = (id, extra = '') => `<span class="ic"><img src="${src(id)}" alt="" draggable="false">${id === 'mail' && !extra ? `<em class="unread" aria-hidden="true">${S.unread}</em>` : ''}${extra}</span>`;
  const app = (id, cls = '', extra = '') => `<button type="button" class="app ${cls}" data-open="${id}" aria-label="${label(id)}">${ic(id, extra)}<b>${esc(NAMES[id])}</b></button>`;
  const ipsy = () => `<button type="button" class="ipsy" data-ipsy><span class="disc">${SPARK}</span><span>Find an app, or ask Ipsy</span>${GLASS}</button>`;
  const chead = (right = '') => `<div class="chead"><div><span class="mk">aOS</span><span class="dt">${esc(DAY)}, ${esc(MON)}</span></div><div class="hb">${right}<span class="avatar">${PERSON}</span></div></div>`;
  const homeLine = () => st.lightsOff ? 'All lights off' : `${S.lights} lights on`;
  const live = {
    weather: { v: S.temp, s: S.sky, badge: ['sun', S.temp] },
    calendar: { v: S.when, s: S.event, badge: ['', S.when.replace(' PM', '')] },
    mail: { v: `${S.unread} unread`, s: S.from, badge: ['hot', String(S.unread)] },
    house: { v: homeLine(), s: `${S.inside} inside`, badge: ['', st.lightsOff ? 'Off' : `${S.lights} on`] },
  };
  const tile = id => { const l = live[id]; return `<button type="button" class="tile t-${id}" data-open="${id}" aria-label="${label(id)}: ${esc(l.v)}, ${esc(l.s)}"><span class="th">${ic(id, ' ')}${esc(NAMES[id])}</span><span class="tv">${esc(l.v)}</span><small>${esc(l.s)}</small></button>`; };
  const badge = id => { const [c, t] = live[id].badge; return `<em class="live ${c}" aria-hidden="true">${esc(t)}</em>`; };

  // ---- the layouts ----
  const LAYOUTS = [
    { key: 'now', name: 'Now', idea: 'Today’s Home, to compare against. Weather and Calendar are widgets; Home and Mail are only in Favorites if you pin them, and most apps are below the fold.',
      chips: [['meh', 'Live: weather, next event'], ['meh', 'Home and Mail not fixed']],
      draw: () => {
        const groups = [['Family', ['calendar', 'meals', 'notes', 'house', 'orders']], ['Every day', ['weather', 'news', 'mail', 'clock', 'podcasts']], ['Out and about', ['travel', 'places']], ['You', ['fitness', 'drinks', 'money']], ['Games', ['sparkle']]];
        return `<div class="atoms" aria-hidden="true"><b></b><b></b><b></b></div><div class="scroll">
          <div class="h0"><div><span class="mk">aOS</span><h1>Home</h1><small>${esc(DAY)}, ${esc(MON)}</small><div class="bars"><i></i><i></i><i></i></div></div><div class="hb"><span class="round">${TODAY}</span><span class="avatar">${PERSON}</span></div></div>
          ${ipsy()}
          <div class="sec">Favorites<span>Edit</span></div>
          <div class="favs">
            <button type="button" class="wid wx" data-open="weather" aria-label="Weather: ${S.temp}, ${S.sky}"><span class="wh"><img src="${src('weather')}" alt="">Home</span><span class="bigt">${S.temp}</span><small>${S.sky}<br>${S.hilo}</small></button>
            ${used().map(id => app(id)).join('')}
            <button type="button" class="wid cal" data-open="calendar" aria-label="Calendar: next, ${S.event}, ${S.when}"><img src="${src('calendar')}" alt=""><span><em>Next · ${S.when}</em><b>${S.event}</b><small>${S.then}</small></span></button>
          </div>
          <div class="sec">Every app</div>
          <div class="hcats">${groups.map(([t, ids]) => `<div class="hcat${ids.length <= 2 ? ' half' : ''}"><h3>${t}</h3><div class="hg" style="--n:${ids.length <= 2 ? 2 : 5}">${ids.map(id => app(id)).join('')}</div></div>`).join('')}</div>
        </div>`;
      } },
    { key: 'one', name: 'One screen', idea: 'Every app on one screen, no scrolling. The fixed four are live tiles at the top, your most opened under them, then the rest. Ipsy moves down to your thumb.',
      chips: [['good', 'Live: all four'], ['good', 'Ipsy in thumb reach']],
      draw: () => `<div class="scroll">${chead()}
          <div class="four">${FIXED.map(tile).join('')}</div>
          <div class="sec tight">${usedTitle()}</div>
          <div class="grid4 big">${used().map(id => app(id)).join('')}</div>
          <div class="sec tight">Everything else</div>
          <div class="grid4">${rest().map(id => app(id)).join('')}</div>
        </div><div class="bottomask">${ipsy()}</div>` },
    { key: 'glance', name: 'Glance', idea: 'The fixed four as one live card you can read without opening anything, each with a shortcut straight to what you’d do there. Lights off works right from Home.',
      chips: [['good', 'Live: all four'], ['good', '4 shortcuts']],
      draw: () => {
        const rows = [
          ['weather', 'Weather', `${S.temp} ${S.sky}`, S.hilo, `<button type="button" class="qa" data-open="weather" data-say="Opens Weather at the hour by hour">Hourly</button>`],
          ['calendar', `Next · ${S.when}`, S.event, S.then, `<button type="button" class="qa" data-open="calendar" data-say="Opens Calendar at a new event">+ Event</button>`],
          ['mail', `${S.unread} unread`, 'Mail', S.from, `<button type="button" class="qa" data-open="mail" data-say="Opens Mail at a new message">Write</button>`],
          ['house', 'Home', homeLine(), `${S.inside} inside · Doors locked`, `<button type="button" class="qa${st.lightsOff ? ' done' : ''}" data-lights>${st.lightsOff ? 'Lights on' : 'Lights off'}</button>`],
        ];
        return `<div class="scroll">${chead()}${ipsy()}
          <div class="glance">${rows.map(([id, em, b, sm, qa]) => `<div class="grow"><button type="button" class="gmain" data-open="${id}" aria-label="${label(id)}: ${esc(b)}">${ic(id, ' ')}<span class="gt"><em>${esc(em)}</em><b>${esc(b)}</b><small>${esc(sm)}</small></span></button>${qa}</div>`).join('')}</div>
          <div class="sec tight">${usedTitle()}</div>
          <div class="grid4 big">${used().map(id => app(id)).join('')}</div>
          <div class="sec tight">Everything else</div>
          <div class="grid4">${rest().map(id => app(id)).join('')}</div>
        </div>`;
      } },
    { key: 'dock', name: 'Dock', idea: 'The fixed four ride in a dock that never scrolls away, each with its live number on it. Your most opened get the big spots up top.',
      chips: [['good', 'Fixed four always on screen'], ['meh', 'Live: numbers only']],
      draw: () => `<div class="scroll">${chead()}${ipsy()}
          <div class="sec tight">${usedTitle()}</div>
          <div class="big2">${used().map(id => `<button type="button" data-open="${id}" aria-label="${label(id)}">${ic(id)}<span class="t"><b>${esc(NAMES[id])}</b><small>${esc(TAGS[id] || '')}</small></span></button>`).join('')}</div>
          <div class="sec tight">Everything else</div>
          <div class="grid4">${rest().map(id => app(id)).join('')}</div>
        </div><div class="dock">${FIXED.map(id => app(id, '', badge(id))).join('')}</div>` },
    { key: 'arc', name: 'Thumb arc', idea: 'Built for one hand: the fixed four on the inner ring, your most opened on the outer one, all where your thumb rests. Ipsy sits in the corner. Flip it for your left hand.',
      chips: [['good', 'One-handed'], ['good', 'Live: all four']],
      draw: () => {
        const W = 390, cx = 346, cy = 336, flip = x => st.hand === 'left' ? W - x : x;
        const at = (r, i) => { const a = [6, 32, 58, 84][i] * Math.PI / 180; return [flip(cx - r * Math.cos(a)), cy - r * Math.sin(a)]; };
        const ring = (cls, r) => `<i class="ring ${cls}" style="left:${flip(cx) - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px"></i>`;
        const inner = FIXED.map((id, i) => { const [x, y] = at(166, i); return `<button type="button" class="app inner" data-open="${id}" aria-label="${label(id)}" style="left:${x}px;top:${y}px">${ic(id, badge(id))}</button>`; }).join('');
        const outer = used().map((id, i) => { const [x, y] = at(272, i); return `<button type="button" class="app outer" data-open="${id}" aria-label="${label(id)}" style="left:${x}px;top:${y}px">${ic(id)}<b>${esc(NAMES[id])}</b></button>`; }).join('');
        return `<div class="scroll">${chead()}
          <div class="glints">
            <button type="button" class="chipx" data-open="weather" aria-label="Weather: ${S.temp}"><img src="${src('weather')}" alt=""><span>${S.temp} ${S.sky}</span></button>
            <button type="button" class="chipx" data-open="calendar" aria-label="Calendar: ${S.event}"><img src="${src('calendar')}" alt=""><span>${S.when} ${S.event}</span></button>
            <button type="button" class="chipx" data-open="mail" aria-label="Mail: ${S.unread} unread"><img src="${src('mail')}" alt=""><span>${S.unread} unread</span></button>
            <button type="button" class="chipx" data-open="house" aria-label="Home: ${homeLine()}"><img src="${src('house')}" alt=""><span>${homeLine()}</span></button>
          </div>
          <div class="sec tight">Everything else<span><button type="button" class="handbtn" data-hand>${st.hand === 'left' ? 'Right hand' : 'Left hand'}</button></span></div>
          <div class="grid4">${rest().map(id => app(id)).join('')}</div>
        </div>
        <div class="arc">${ring('r2', 322)}${ring('r1', 218)}${outer}${inner}<button type="button" class="orb" data-ipsy aria-label="Ask Ipsy" style="left:${flip(cx)}px;top:${cy}px">${SPARK}</button></div>`;
      } },
  ];

  // ---- drawing ----
  const phones = $('#phones'), cards = {};
  for (const L of LAYOUTS) {
    const card = document.createElement('article');
    card.className = 'pcard'; card.id = 'p-' + L.key;
    card.innerHTML = `<div class="cap"><h2>${esc(L.name)}</h2><p>${esc(L.idea)}</p><ul class="chips"><li data-vis></li>${L.chips.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>
      <div class="caprow"><button type="button" class="time" data-time>Time me</button><span class="best" data-best></span></div></div>
      <div class="fit"><div class="phone"><div class="screen l-${L.key}"><div class="sb"><span>9:41</span><i></i></div><div class="notch"></div><div class="race"></div><div class="body"></div><div class="toast" role="status"></div><div class="homebar"></div></div></div></div>`;
    phones.append(card);
    cards[L.key] = { L, card, screen: card.querySelector('.screen'), body: card.querySelector('.body') };
  }
  function draw(key) {
    const c = cards[key], sc = c.body.querySelector('.scroll'), top = sc ? sc.scrollTop : 0;
    c.body.innerHTML = c.L.draw();
    const s2 = c.body.querySelector('.scroll'); if (s2) s2.scrollTop = top;
    requestAnimationFrame(() => countVisible(key));
  }
  const drawAll = () => LAYOUTS.forEach(L => draw(L.key));

  // how many different apps you can tap on the first screen, without scrolling
  function countVisible(key) {
    const c = cards[key], box = c.screen.getBoundingClientRect(), k = box.height / 844;
    const seen = new Set();
    for (const el of c.screen.querySelectorAll('[data-open]')) {
      const r = el.getBoundingClientRect(), sc = el.closest('.scroll');
      if (sc && sc.scrollTop > 0) continue;
      if (r.top >= box.top + 50 * k && r.bottom <= box.bottom - 18 * k && r.height > 0) seen.add(el.dataset.open);
    }
    const n = seen.size, li = c.card.querySelector('[data-vis]');
    li.textContent = `${n} of ${ALL.length} apps without scrolling`;
    li.className = n === ALL.length ? 'good' : 'meh';
  }

  // ---- size: one phone at a time on a phone, side by side on a wide screen ----
  function fit() {
    const w = document.documentElement.clientWidth;
    const s = w <= 760 ? Math.min(1, (w - 32) / 402) : w >= 1700 ? .8 : w >= 1100 ? .74 : .7;
    document.documentElement.style.setProperty('--s', s.toFixed(4));
    LAYOUTS.forEach(L => countVisible(L.key));
  }
  addEventListener('resize', fit);

  // ---- the controls ----
  const tabs = $('#tabs');
  tabs.innerHTML = LAYOUTS.map(L => `<button type="button" data-go="${L.key}">${esc(L.name)}</button>`).join('');
  const press = (wrap, attr, val) => wrap.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
  tabs.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; phones.scrollTo({ left: cards[b.dataset.go].card.offsetLeft - phones.offsetLeft - 16, behavior: 'smooth' }); });
  let tick = 0;
  phones.addEventListener('scroll', () => { cancelAnimationFrame(tick); tick = requestAnimationFrame(() => {
    const mid = phones.scrollLeft + phones.clientWidth / 2;
    const on = LAYOUTS.find(L => { const el = cards[L.key].card; return el.offsetLeft - phones.offsetLeft <= mid && el.offsetLeft - phones.offsetLeft + el.offsetWidth >= mid; }) || LAYOUTS[0];
    press(tabs, 'go', on.key);
  }); }, { passive: true });
  press(tabs, 'go', 'now');
  const paintOpts = () => { press($('#mode'), 'mode', st.mode); press($('#tod'), 'tod', st.tod); $('#todrow').hidden = st.mode !== 'now'; };
  $('#mode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; st.mode = b.dataset.mode; save(); paintOpts(); drawAll(); });
  $('#tod').addEventListener('click', e => { const b = e.target.closest('[data-tod]'); if (!b) return; st.tod = b.dataset.tod; save(); paintOpts(); drawAll(); });
  $('#reset').addEventListener('click', () => { st.times = {}; save(); paintScore(); LAYOUTS.forEach(L => paintBest(L.key)); });

  // ---- tapping inside a phone ----
  function toast(key, text) {
    const t = cards[key].screen.querySelector('.toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1400);
  }
  phones.addEventListener('click', e => {
    const card = e.target.closest('.pcard'); if (!card) return;
    const key = card.id.slice(2);
    if (e.target.closest('[data-time]')) return startRace(key);
    if (e.target.closest('[data-lights]')) { st.lightsOff = !st.lightsOff; save(); drawAll(); return toast(key, st.lightsOff ? 'Lights off, without opening Home' : 'Lights back on'); }
    if (e.target.closest('[data-hand]')) { st.hand = st.hand === 'left' ? 'right' : 'left'; save(); return draw('arc'); }
    if (e.target.closest('[data-ipsy]')) return toast(key, 'Type a few letters, Return opens the app');
    const o = e.target.closest('[data-open]'); if (!o) return;
    const r = race[key];
    if (r) return raceTap(key, o.dataset.open);
    toast(key, o.dataset.say || `Opens ${NAMES[o.dataset.open]} · 1 tap`);
  });

  // ---- Time me: six apps, two of each kind, as fast as you can ----
  const race = {};
  const pick = (a, n) => a.slice().sort(() => Math.random() - .5).slice(0, n);
  function startRace(key) {
    if (race[key]) return stopRace(key, false);
    const targets = pick([...pick(FIXED, 2), ...pick(used(), 2), ...pick(rest(), 2)], 6);
    const sc = cards[key].body.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
    race[key] = { targets, i: 0, at: 0, total: 0, misses: 0 };
    cards[key].card.querySelector('[data-time]').textContent = 'Stop'; cards[key].card.querySelector('[data-time]').classList.add('on');
    cards[key].screen.classList.add('racing');
    nextTarget(key);
  }
  function nextTarget(key) {
    const r = race[key], el = cards[key].screen.querySelector('.race');
    el.innerHTML = `Tap <b>${esc(NAMES[r.targets[r.i]])}</b> <small>${r.i + 1} of ${r.targets.length}</small>`;
    el.classList.add('on'); r.at = performance.now();
  }
  function raceTap(key, id) {
    const r = race[key];
    if (id !== r.targets[r.i]) { r.misses++; return toast(key, 'Not that one'); }
    r.total += performance.now() - r.at; r.i++;
    if (r.i < r.targets.length) return nextTarget(key);
    stopRace(key, true);
  }
  function stopRace(key, done) {
    const r = race[key]; delete race[key];
    const c = cards[key];
    c.screen.querySelector('.race').classList.remove('on'); c.screen.classList.remove('racing');
    const b = c.card.querySelector('[data-time]'); b.textContent = 'Time me'; b.classList.remove('on');
    const sc = c.body.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
    if (!done) return;
    const avg = r.total / r.targets.length / 1000;
    (st.times[key] = st.times[key] || []).push({ avg: +avg.toFixed(2), misses: r.misses });
    save(); paintBest(key); paintScore();
    toast(key, `${avg.toFixed(2)}s an app${r.misses ? `, ${r.misses} miss${r.misses > 1 ? 'es' : ''}` : ''}`);
  }
  const stats = key => { const t = st.times[key] || []; if (!t.length) return null;
    return { runs: t.length, best: Math.min(...t.map(x => x.avg)), avg: t.reduce((a, x) => a + x.avg, 0) / t.length, misses: t.reduce((a, x) => a + x.misses, 0) }; };
  function paintBest(key) { const s = stats(key); cards[key].card.querySelector('[data-best]').textContent = s ? `Best ${s.best.toFixed(2)}s an app · ${s.runs} run${s.runs > 1 ? 's' : ''}` : 'Six apps, as fast as you can'; }
  function paintScore() {
    const rows = LAYOUTS.map(L => [L, stats(L.key)]), best = Math.min(...rows.filter(r => r[1]).map(r => r[1].avg));
    $('#score').innerHTML = `<tr><th>Layout</th><th>Average</th><th>Best</th><th>Misses</th><th>Runs</th></tr>` + rows.map(([L, s]) => s
      ? `<tr><td>${esc(L.name)}</td><td class="${s.avg === best ? 'win' : ''}">${s.avg.toFixed(2)}s</td><td>${s.best.toFixed(2)}s</td><td>${s.misses}</td><td>${s.runs}</td></tr>`
      : `<tr><td>${esc(L.name)}</td><td colspan="4" style="color:var(--muted)">Not timed yet</td></tr>`).join('');
  }

  paintOpts(); drawAll(); fit(); paintScore(); LAYOUTS.forEach(L => paintBest(L.key));
  // the fonts change the sizes a little once they're in
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => LAYOUTS.forEach(L => countVisible(L.key)));
})();
