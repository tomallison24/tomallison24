// How to make a Home Assistant token, shown: a small iPhone running the Home
// Assistant app, looping through the real steps with a finger - ☰ -> your name
// at the bottom of the menu -> Security -> scroll to Long-lived access tokens ->
// Create token -> name it "AllisonOS <name>" -> Copy (it's shown only once) ->
// paste it into Home. Drawn after the Home Assistant app on iPhone (2026.9, dark),
// from the owner's screenshots; a likeness, not a screenshot. The token on screen
// is made up.
//
//   AllisonOS.haGuide.mount(host, { name })   draws it into host and loops while
//                                             host is on screen; returns { stop }
(() => {
  'use strict';
  const A = window.AllisonOS = window.AllisonOS || {};
  if (A.haGuide) return;
  // The button under the name once the keyboard is down. Not in the screenshots
  // (the keyboard covers it); HA's dialogs end with it bottom right, like Close.
  const OK = 'OK';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const CSS = `
.hg { --hg-bg: #111111; --hg-bar: #1c1c1c; --hg-card: #1c1c1c; --hg-edge: #2f2f2f; --hg-text: #e1e1e1; --hg-dim: #9b9b9b; --hg-blue: #03a9f4; --hg-tab: #8ab4f8;
  display: flex; flex-direction: column; align-items: center; gap: 12px; user-select: none; -webkit-user-select: none; }
.hg-phone { width: 214px; height: 440px; padding: 7px; border-radius: 40px; background: #2a2b30; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.12), 0 18px 40px rgba(0,0,0,.35); }
.hg-screen { position: relative; width: 100%; height: 100%; border-radius: 33px; overflow: hidden; background: var(--hg-bg); color: var(--hg-text);
  font: 9px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, system-ui, sans-serif; }
.hg-island { position: absolute; z-index: 9; top: 7px; left: 50%; width: 62px; height: 18px; margin-left: -31px; border-radius: 10px; background: #000; }
.hg-s { position: absolute; inset: 0; opacity: 0; transition: opacity .35s, transform .45s cubic-bezier(.2,.8,.2,1); }
.hg-s.on { opacity: 1; }
.hg-top { height: 58px; padding: 30px 12px 0; display: flex; align-items: center; gap: 10px; background: var(--hg-bar); border-bottom: 1px solid var(--hg-edge); font-size: 11px; }
.hg-burger { position: relative; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; }
.hg-burger svg { width: 14px; height: 14px; }
.hg-burger b { position: absolute; top: 1px; right: 1px; width: 7px; height: 7px; border-radius: 50%; background: #8ab4f8; }
.hg-cards { padding: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.hg-cards i { height: 44px; border-radius: 10px; background: var(--hg-card); border: 1px solid var(--hg-edge); }
.hg-cards i:nth-child(1), .hg-cards i:nth-child(6) { grid-column: span 2; height: 70px; }
.hg-drawer { position: absolute; z-index: 5; top: 0; bottom: 0; left: 0; width: 60%; background: var(--hg-bar); border-right: 1px solid var(--hg-edge); transform: translateX(-102%); transition: transform .4s cubic-bezier(.2,.8,.2,1); display: flex; flex-direction: column; }
.hg-drawer.on { transform: none; }
.hg-shade { position: absolute; z-index: 4; inset: 0; background: rgba(0,0,0,.5); opacity: 0; transition: opacity .4s; }
.hg-shade.on { opacity: 1; }
.hg-dh { height: 58px; padding: 30px 12px 0; font-size: 11px; border-bottom: 1px solid var(--hg-edge); }
.hg-item { display: flex; align-items: center; gap: 9px; padding: 6px 12px; font-size: 9.5px; }
.hg-item svg { width: 12px; height: 12px; color: var(--hg-dim); flex: 0 0 12px; }
.hg-dfoot { margin-top: auto; padding-bottom: 12px; }
.hg-user { display: flex; align-items: center; gap: 9px; padding: 6px 8px; margin: 2px 4px; border-radius: 8px; font-size: 9.5px; transition: background .2s; }
.hg-user.tap, .hg-tabs span.tap, .hg-tap { background: rgba(255,255,255,.12) !important; }
.hg-av { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #a9d8f5; color: #10324a; font-size: 10px; }
.hg-page { position: absolute; top: 58px; left: 0; right: 0; bottom: 38px; overflow: hidden; }
.hg-inner { padding: 8px; transition: transform 1.1s cubic-bezier(.4,.1,.2,1); }
.hg-card { border-radius: 12px; background: var(--hg-card); border: 1px solid var(--hg-edge); padding: 10px; margin-bottom: 9px; }
.hg-card h4 { margin: 0 0 6px; font-size: 13px; font-weight: 400; }
.hg-card p { margin: 0 0 6px; color: var(--hg-text); font-size: 8.5px; line-height: 1.45; }
.hg-card p u { color: #8ab4f8; }
.hg-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; color: var(--hg-dim); font-size: 8px; }
.hg-row b { display: block; color: var(--hg-text); font-weight: 400; font-size: 9px; }
.hg-row i { flex: 0 0 14px; height: 14px; border-radius: 4px; background: #3a3a3a; }
.hg-row .bin { margin-left: auto; flex: 0 0 10px; height: 12px; border-radius: 2px; background: #bdbdbd; }
.hg-btns { display: flex; justify-content: flex-end; border-top: 1px solid var(--hg-edge); margin: 8px -10px -10px; padding: 7px 8px; }
.hg-red { padding: 6px 11px; border-radius: 999px; background: #3a1216; color: #ff7b7b; font-size: 9px; }
.hg-cta { padding: 7px 13px; border-radius: 999px; background: var(--hg-blue); color: #fff; font-size: 9.5px; font-weight: 500; transition: filter .2s, transform .2s; }
.hg-cta.tap { filter: brightness(1.25); transform: scale(.95); }
.hg-line { height: 7px; border-radius: 4px; background: #2c2c2c; margin: 5px 0; }
.hg-tabs { position: absolute; left: 0; right: 0; bottom: 0; height: 38px; display: flex; background: var(--hg-bar); border-top: 1px solid var(--hg-edge); }
.hg-tabs span { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 8px; color: var(--hg-text); transition: color .2s, background .2s; }
.hg-tabs svg { width: 12px; height: 12px; }
.hg-tabs span.on { color: var(--hg-tab); }
.hg-dlg { position: absolute; inset: 0; background: var(--hg-bar); transform: translateY(100%); transition: transform .4s cubic-bezier(.2,.8,.2,1); }
.hg-dlg.on { transform: none; }
.hg-dlg .hg-dt { display: flex; align-items: center; gap: 12px; padding: 34px 12px 10px; font-size: 12px; color: var(--hg-text); }
.hg-dlg .hg-dt span:first-child { font-size: 13px; color: var(--hg-dim); }
.hg-field { margin: 4px 10px; padding: 6px 9px 7px; background: #2c2c2c; border-radius: 4px 4px 0 0; border-bottom: 1.5px solid #6f9cf2; min-height: 34px; }
.hg-field small { display: block; color: #8ab4f8; font-size: 7.5px; }
.hg-field span { font-size: 10px; }
.hg-caret { display: inline-block; width: 1px; height: 11px; background: #8ab4f8; vertical-align: -2px; animation: hg-blink 1s step-end infinite; }
@keyframes hg-blink { 50% { opacity: 0; } }
.hg-kb { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 3px 16px; background: #2b2b2d; border-radius: 14px 14px 0 0; transition: transform .35s cubic-bezier(.2,.8,.2,1); }
.hg-kb.off { transform: translateY(105%); }
.hg-acc { position: absolute; left: 6px; right: 6px; top: -30px; height: 24px; border-radius: 12px; background: #3a3a3c; display: flex; align-items: center; justify-content: flex-end; padding: 0 10px; color: #fff; font-size: 12px; transition: opacity .2s; }
.hg-kb.off .hg-acc { opacity: 0; }
.hg-acc b { font-weight: 400; padding: 2px 6px; border-radius: 8px; transition: background .2s; }
.hg-krow { display: flex; justify-content: center; gap: 3px; margin-top: 5px; }
.hg-krow i { width: 17px; height: 24px; border-radius: 5px; background: #4a4a4c; color: #fff; font-style: normal; font-size: 10px; display: grid; place-items: center; transition: background .08s; }
.hg-krow i.wide { width: 74px; } .hg-krow i.mid { width: 26px; } .hg-krow i.dn { background: #8a8a8e; }
.hg-ok { position: absolute; right: 12px; bottom: 26px; }
.hg-tok { display: flex; align-items: center; gap: 8px; margin: 10px; }
.hg-tok span:first-child { flex: 1; min-width: 0; padding: 9px 8px; background: #2c2c2c; border-bottom: 1px solid #9b9b9b; border-radius: 4px 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 8.5px; color: #cfcfcf; }
.hg-copy { color: #29b6f6; font-size: 10px; display: flex; align-items: center; gap: 3px; padding: 4px; border-radius: 6px; transition: background .2s; }
.hg-copy svg { width: 13px; height: 13px; }
.hg-qr { text-align: center; color: #29b6f6; font-size: 9.5px; margin-top: 8px; }
.hg-made p { margin: 4px 12px; font-size: 9px; color: var(--hg-text); }
.hg-toast { position: absolute; z-index: 8; left: 50%; bottom: 70px; transform: translate(-50%, 20px); padding: 7px 14px; border-radius: 8px; background: #323232; color: #fff; font-size: 9px; opacity: 0; transition: opacity .25s, transform .3s; }
.hg-toast.on { opacity: 1; transform: translate(-50%, 0); }
/* the end: back in Home, paste it in */
.hg-home { background: linear-gradient(160deg, #20233a, #12131a); }
.hg-home .hg-ht { padding: 36px 14px 8px; font-size: 18px; font-weight: 800; color: #fff; }
.hg-hsheet { position: absolute; left: 6px; right: 6px; bottom: 6px; top: 96px; border-radius: 24px; background: rgba(40,42,50,.96); padding: 14px 10px; color: #fff; }
.hg-hsheet h5 { margin: 0 0 10px; font-size: 12px; }
.hg-hf { padding: 6px 9px; margin-bottom: 7px; border-radius: 10px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.12); }
.hg-hf small { display: block; font-size: 7px; color: rgba(235,235,245,.6); font-weight: 600; }
.hg-hf span { font-size: 9.5px; }
.hg-hgo { margin-top: 10px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: #0A84FF; font-size: 10px; font-weight: 700; transition: transform .2s, filter .2s; }
.hg-hgo.tap { transform: scale(.95); filter: brightness(1.2); }
.hg-paste { position: absolute; left: 50%; top: 150px; transform: translateX(-50%) scale(.9); padding: 5px 10px; border-radius: 8px; background: #3a3a3c; color: #fff; font-size: 9px; opacity: 0; transition: opacity .2s, transform .2s; }
.hg-paste.on { opacity: 1; transform: translateX(-50%) scale(1); }
.hg-finger { position: absolute; z-index: 10; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: rgba(255,255,255,.55);
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.7), 0 4px 12px rgba(0,0,0,.4); opacity: 0; transition: transform .6s cubic-bezier(.4,.1,.2,1), opacity .25s; }
.hg-finger.on { opacity: 1; } .hg-finger.press { width: 22px; height: 22px; margin: -11px 0 0 -11px; background: rgba(255,255,255,.8); }
.hg-cap { display: flex; align-items: center; gap: 10px; min-height: 40px; max-width: 320px; font-size: 15px; line-height: 1.3; text-align: left; transition: opacity .25s; }
.hg-cap.fade { opacity: 0; }
.hg-n { flex: 0 0 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #0A84FF; color: #fff; font-size: 13px; font-weight: 700; }
.hg-dots { display: flex; gap: 5px; } .hg-dots i { width: 6px; height: 6px; border-radius: 3px; background: rgba(128,128,128,.35); transition: width .3s, background .3s; }
.hg-dots i.on { width: 16px; background: #0A84FF; }
@media (prefers-reduced-motion: reduce) { .hg * { transition-duration: .01s !important; animation: none !important; } }`;

  const I = {
    burger: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 4h12M2 8h12M2 12h8"/></svg>',
    person: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c.6-3 3-4.4 6-4.4s5.4 1.4 6 4.4z"/></svg>',
    lock: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="4" width="8" height="10" rx="1"/><path d="M3 11V2.5h7"/></svg>',
    item: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="3" opacity=".9"/></svg>',
    bell: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a4 4 0 0 0-4 4v3L2.5 11.5h11L12 9V6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0z"/></svg>',
  };
  const STEPS = [
    'In the Home Assistant app, tap <b>☰</b>',
    'Tap <b>your name</b>, at the bottom',
    'Tap <b>Security</b>',
    'Scroll down, tap <b>Create token</b>',
    n => `Name it <b>${esc(n)}</b>, then tap <b>${OK}</b>`,
    'Tap <b>Copy</b>: it\'s only shown once',
    'Back in Home: paste it, tap <b>Connect</b>',
  ];
  const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const FAKE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhbGxpc29ub3MtZGVtbyJ9.ZGVtbw';

  function mount(host, opts = {}) {
    if (!document.getElementById('hg-css')) { const st = document.createElement('style'); st.id = 'hg-css'; st.textContent = CSS; document.head.appendChild(st); }
    const first = String(opts.name || '').trim().split(/\s+/)[0];
    const label = 'AllisonOS ' + (first || 'Home'), user = (first || 'you').toLowerCase();
    const menu = ['Overview', 'Map', 'Energy', 'Logbook', 'History', 'Media', 'To-do lists'];
    host.innerHTML = `<div class="hg" aria-hidden="true"><div class="hg-phone"><div class="hg-screen"><i class="hg-island"></i>
      <div class="hg-s hg-dash"><div class="hg-top"><span class="hg-burger">${I.burger}<b></b></span>Overview</div><div class="hg-cards"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="hg-shade"></div>
      <div class="hg-drawer"><div class="hg-dh">Home Assistant</div>${menu.map(m => `<div class="hg-item">${I.item}${m}</div>`).join('')}
        <div class="hg-dfoot"><div class="hg-item">${I.bell}Notifications</div><div class="hg-user"><span class="hg-av">${esc(user[0])}</span>${esc(user)}</div></div></div>
      <div class="hg-s hg-prof"><div class="hg-top"><span class="hg-burger">${I.burger}<b></b></span></div>
        <div class="hg-page"><div class="hg-inner hg-sec">
          <div class="hg-card hg-gen"><h4>${esc(user)}</h4><div class="hg-line" style="width:70%"></div><div class="hg-line" style="width:50%"></div><div class="hg-line" style="width:80%"></div></div>
          <div class="hg-card hg-gen"><div class="hg-line" style="width:60%"></div><div class="hg-line" style="width:85%"></div><div class="hg-line" style="width:40%"></div></div>
          <div class="hg-card hg-sc" hidden><h4>Refresh tokens</h4><div class="hg-row"><i></i><span><b>iOS app</b>Created 3 months ago<br>Expires in 3 days</span></div>
            <div class="hg-row"><i></i><span><b>Safari</b>Created 2 weeks ago<br>Expires in 80 days</span></div><div class="hg-btns"><span class="hg-red">Delete all tokens</span></div></div>
          <div class="hg-card hg-sc" hidden><h4>Long-lived access tokens</h4><p>Create long-lived access tokens to allow your scripts to interact with your Home Assistant instance. Each token will be valid for 10 years from creation. <u>Learn how to make authenticated requests.</u></p>
            <div class="hg-row"><span><b>iPad</b>Created 2 months ago</span><span class="bin"></span></div>
            <div class="hg-btns"><span class="hg-cta hg-create">Create token</span></div></div>
        </div></div>
        <div class="hg-tabs"><span class="on hg-tgen">${I.person}General</span><span class="hg-tsec">${I.lock}Security</span></div></div>
      <div class="hg-dlg hg-create-d"><div class="hg-dt"><span>✕</span><span>Create token</span></div>
        <div class="hg-field"><small>Name*</small><span class="hg-typed"></span><i class="hg-caret"></i></div>
        <span class="hg-cta hg-ok">${OK}</span>
        <div class="hg-kb"><div class="hg-acc"><b class="hg-done">✓</b></div>${KEYS.map(r => `<div class="hg-krow">${[...r].map(k => `<i data-k="${k}">${k}</i>`).join('')}</div>`).join('')}
          <div class="hg-krow"><i class="mid">123</i><i class="wide" data-k=" "></i><i class="mid">↵</i></div></div></div>
      <div class="hg-dlg hg-made"><div class="hg-dt"><span>✕</span><span>Token created: ${esc(label)}</span></div>
        <p>Copy your access token. It will not be shown again.</p>
        <div class="hg-tok"><span>${FAKE}</span><span class="hg-copy">${I.copy}Copy</span></div><div class="hg-qr">Generate QR code</div>
        <span class="hg-cta hg-ok">Close</span><div class="hg-toast">Copied to clipboard</div></div>
      <div class="hg-s hg-home"><div class="hg-ht">Home</div><div class="hg-hsheet"><h5>Home Assistant</h5>
        <div class="hg-hf"><small>Address</small><span>https://••••••.ui.nabu.casa</span></div>
        <div class="hg-hf hg-tokf"><small>Long-lived access token</small><span class="hg-pasted">Paste the token</span></div>
        <div class="hg-hgo">Connect</div></div><div class="hg-paste">Paste</div></div>
      <i class="hg-finger"></i>
    </div></div>
    <div class="hg-cap" role="status"><span class="hg-n">1</span><span class="hg-t"></span></div>
    <div class="hg-dots">${STEPS.map(() => '<i></i>').join('')}</div></div>`;

    const $ = s => host.querySelector(s), $$ = s => host.querySelectorAll(s);
    const screen = $('.hg-screen'), finger = $('.hg-finger');
    let alive = true, run = 0;
    const visible = () => alive && host.isConnected && host.offsetParent !== null;
    const wait = ms => new Promise((res, rej) => { const id = run; setTimeout(() => (alive && id === run ? res() : rej(new Error('stop'))), ms); });
    const until = async () => { while (alive && !visible()) await new Promise(r => setTimeout(r, 400)); if (!alive) throw new Error('stop'); };
    const at = el => { const s = screen.getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2]; };
    const move = async (el, ms = 650) => { const [x, y] = at(el); finger.classList.add('on'); finger.style.transform = `translate(${x}px, ${y}px)`; await wait(ms); };
    const tap = async (el, cls = 'tap') => { await move(el); finger.classList.add('press'); el.classList.add(cls); await wait(220); finger.classList.remove('press'); await wait(260); el.classList.remove(cls); };
    const cap = async (i, name) => {
      const c = $('.hg-cap'); c.classList.add('fade'); await wait(200);
      const t = STEPS[i]; $('.hg-n').textContent = i + 1; $('.hg-t').innerHTML = typeof t === 'function' ? t(name) : t;
      $$('.hg-dots i').forEach((d, j) => d.classList.toggle('on', j === i)); c.classList.remove('fade');
    };
    const show = cls => { for (const s of $$('.hg-s')) s.classList.toggle('on', s.classList.contains(cls)); };
    const reset = () => {
      show('hg-dash'); $('.hg-drawer').classList.remove('on'); $('.hg-shade').classList.remove('on');
      for (const d of $$('.hg-dlg')) d.classList.remove('on');
      $$('.hg-gen').forEach(e => e.hidden = false); $$('.hg-sc').forEach(e => e.hidden = true);
      $('.hg-tgen').classList.add('on'); $('.hg-tsec').classList.remove('on'); $('.hg-sec').style.transform = '';
      $('.hg-typed').textContent = ''; $('.hg-kb').classList.remove('off'); $('.hg-toast').classList.remove('on');
      $('.hg-pasted').textContent = 'Paste the token'; $('.hg-pasted').style.opacity = .5; $('.hg-paste').classList.remove('on');
      finger.classList.remove('on'); finger.style.transform = 'translate(107px, 300px)';
    };

    async function loop() {
      for (;;) {
        await until(); run++; reset(); await wait(700);
        // 1. ☰
        await cap(0); await wait(500); await tap($('.hg-dash .hg-burger'));
        $('.hg-shade').classList.add('on'); $('.hg-drawer').classList.add('on'); await wait(700);
        // 2. your name, at the bottom of the menu
        await cap(1); await wait(400); await tap($('.hg-user'));
        show('hg-prof'); $('.hg-drawer').classList.remove('on'); $('.hg-shade').classList.remove('on'); await wait(800);
        // 3. Security, in the bottom bar
        await cap(2); await wait(400); await tap($('.hg-tsec'));
        $('.hg-tgen').classList.remove('on'); $('.hg-tsec').classList.add('on');
        $$('.hg-gen').forEach(e => e.hidden = true); $$('.hg-sc').forEach(e => e.hidden = false); await wait(700);
        // 4. scroll down to Long-lived access tokens, Create token
        await cap(3); await wait(300);
        const page = $('.hg-page'), inner = $('.hg-sec'), drop = Math.max(0, inner.scrollHeight - page.clientHeight + 8);
        await move(page, 400); inner.style.transform = `translateY(${-drop}px)`; finger.style.transform += ' translateY(-60px)'; await wait(1300);
        await tap($('.hg-create'));
        $('.hg-create-d').classList.add('on'); await wait(700);
        // 5. the name, then ✓ and OK
        await cap(4, label); await wait(400);
        finger.classList.remove('on');
        for (const ch of label) {
          const k = $(`.hg-kb [data-k="${ch === ' ' ? ' ' : ch.toUpperCase()}"]`);
          if (k) { k.classList.add('dn'); setTimeout(() => k.classList.remove('dn'), 110); }
          $('.hg-typed').textContent += ch; await wait(95);
        }
        await wait(300); await tap($('.hg-done')); $('.hg-kb').classList.add('off'); await wait(500);
        await tap($('.hg-create-d .hg-ok'));
        $('.hg-made').classList.add('on'); await wait(800);
        // 6. Copy: shown only once
        await cap(5); await wait(400); await tap($('.hg-copy'), 'hg-tap'); $('.hg-toast').classList.add('on'); await wait(1400);
        // 7. back in Home: paste, Connect
        await cap(6); show('hg-home'); for (const d of $$('.hg-dlg')) d.classList.remove('on'); await wait(600);
        const f = $('.hg-tokf'); await move(f); finger.classList.add('press'); await wait(500); finger.classList.remove('press'); $('.hg-paste').classList.add('on'); await wait(500);
        await tap($('.hg-paste')); $('.hg-paste').classList.remove('on'); $('.hg-pasted').textContent = '••••••••••••••••••••'; $('.hg-pasted').style.opacity = 1; await wait(500);
        await tap($('.hg-hgo')); await wait(2200);
      }
    }
    loop().catch(() => {});
    return { stop: () => { alive = false; run++; } };
  }

  A.haGuide = { mount, steps: STEPS.length };
})();
