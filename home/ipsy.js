// Ipsy: the AllisonOS helper you chat with. Each person's own: a character they pick and name, that
// acts out what it's doing, in the look of the app it's in: the design picked in its Settings
// (../home/design.js, data-look on <html>), following a change at once (aos:design, aos:look).
//
//   <script src="../home/ipsy.js"></script>     (before the app's script)
//   AllisonOS.ipsy.mount({
//     app: 'orders',                      // its own storage: ipsy.<app>.*
//     endpoint: '../orders/api/ipsy',     // the app's server route: adds Ipsy's instructions and
//     headers: { 'X-Orders': '1' },       //   tools, asks Claude, hands back the answer as it is
//     slot: element,                      // where its button goes (else the bottom left corner)
//     intro, placeholder, suggestions,    // the words on an empty chat
//     consent,                            // what is sent where, shown once before the first question
//     context: () => 'On screen: …',      // added to every question, with today's date
//     tools: { name: async (input, { confirm }) => ({ content, change: { text, undo } }) },
//                                         // confirm(text, { yes, no }): asks in the chat first (a card with
//                                         //   Yes / No) and resolves true or false; nothing runs until tapped
//     label: (name, input) => 'Looking at your orders',   // what Ipsy says it's doing
//   })   -> { open, close, busy, hint(text, onTap), ask(text, opt), note(text), change(text, undo), working(on), prompt(text) }
//          for work the app does with Ipsy by itself (Orders checks its "To check" orders)
//
// Tapped, Ipsy's chat pops out of it as a speech bubble (not a page): the bubble rises from
// above its head, tail pointing at it, and shrinks back into it when put away.
// A chat that's done (nothing still being answered or asked) is put away once it has been closed for a minute, so
// Ipsy opens with a new one; opened again sooner (a look at what it showed you, an Undo), it's the same chat. The last
// five put away are kept on the phone (ipsy.<app>.history), behind the clock in the chat's corner.
// The chat lives on the phone (localStorage ipsy.<app>.chat). Each step sends the whole
// conversation to the app's route; when Claude asks for one of the app's tools, it runs here (the
// data lives here) and its result goes back with the next step. Web search and web pages run at
// Anthropic and come back in the same answer. Every change a tool makes shows in the chat with Undo.
//
// The conversation is kept exactly as Claude returned it (thinking and web results included) and
// only ever added to: the API checks that earlier turns weren't changed.
//
// Ipsy is the person's own helper: one of seven characters (Mia, the family's Australian Shepherd, a
// fox, an owl, a robot, an octopus, a hedgehog, an otter), picked and named the first time the chat
// opens (aos.helper; also in aOS, Account). It acts out each job: listening (the box has focus),
// thinking (waiting for Claude), reading, searching with its glasses on, writing, showing (by the
// tool's name: jobOf), talking (the answer appearing) and a hop when a change is saved. Reduce
// Motion holds it still; each job is still a pose.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  if (AOS.ipsy) return;
  const me = document.currentScript;
  // The look: fixed by data-look on this script, else the page's (data-look on <html>), and kept in step with it.
  const FIXED = me && me.dataset.look;
  // Night Drive, Folk and Tron wear the Vintage outfit, in their own colours (ipsy-neon, ipsy-folk, ipsy-grid on top of ipsy-vintage).
  const LOOK = () => { const l = FIXED || document.documentElement.dataset.look; return /^(vintage|neon|folk|grid)$/.test(l || '') ? l : 'glass'; };
  const followers = new Set();                       // elements that wear the page's look
  const dress = (el, l) => { for (const k of ['vintage', 'glass', 'neon', 'folk', 'grid']) el.classList.toggle('ipsy-' + k, l === k || (k === 'vintage' && (l === 'neon' || l === 'folk' || l === 'grid'))); };
  const wear = (el, l) => dress(el, l || LOOK());
  const follow = el => { followers.add(el); wear(el); };
  for (const ev of ['aos:design', 'aos:look']) addEventListener(ev, () => { followers.forEach(el => wear(el)); redrawAll(); });
  // the look changed (Tron's rider, or back to the helper you picked)
  function redrawAll() { const h = helper(); cells.forEach(c => { if (!c.fixed && c.host.isConnected) drawChar(c, h ? h.who : c.peek); }); }
  new MutationObserver(() => redrawAll()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The language a short message asks for ("English", "switch to English please", «на русский»), or null
  const LANG_NAME = { en: 'English', ru: 'Русский' };
  const BUILT_LABEL = { set_language: 'Changing the language', get_settings: 'Looking at your settings', change_setting: 'Changing a setting', open_setting: 'Opening Settings' };
  const LANG_WORDS = /^(?:(?:please|pls|switch|change|set|go|back|to|the|language|lang|in|into|use|speak|i|want|need|can't|cant|read|this|it|пожалуйста|переключи|переключись|переключить|верни|вернуть|поменяй|смени|сделай|включи|язык|на|по|хочу)\s+)*(english|eng|russian|английский|англ|русский|рус)(?:\s+(?:please|language|pls|пожалуйста|язык))?$/;
  const langAsked = s => {
    const m = LANG_WORDS.exec(String(s || '').toLowerCase().replace(/[.!?,«»"]/g, ' ').replace(/\s+/g, ' ').trim());
    return m ? (/^(english|eng|английский|англ)$/.test(m[1]) ? 'en' : 'ru') : null;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);   // a key of the list itself, never 'constructor' or '__proto__'
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const f1 = n => n.toFixed(1);
  const MAX_STEPS = 24;                 // model calls for one question, at most
  const MAX_CHAT = 950 * 1024;          // a conversation bigger than this is full (the route takes 1 MB)
  const MAX_RESULT = 40000;             // characters of one tool result

  const DEG = Math.PI / 180;
  // ---------------------------------------------------------------------------
  // The helpers: everyone picks their own (Mia, the family's Australian Shepherd, or a fox, an owl, a
  // robot, an octopus, a hedgehog or an otter) and names it. All of them share one rig: rubber-hose
  // arms, a face, and the props for each job, so each acts out what Ipsy is doing:
  //   idle (bobs, blinks, waves now and then), listen (hand to its ear), think (hand on its chin, thought
  //   bubbles), read (a book: get_*, read_*…), scan (glasses and a magnifying glass: find_*, search_*),
  //   write (a notepad: create_*, set_*, update_*…), show (points: show_*), talk (the answer appearing),
  //   done (a hop: a change saved).
  // Night Drive puts mirror shades on every helper, Folk a red neckerchief with white dots, Tron a lit visor.
  // ---------------------------------------------------------------------------
  const EGG = 'M100 56C134 56 152 80 152 114C152 150 130 168 100 168C70 168 48 150 48 114C48 80 66 56 100 56Z';
  const SPIKES = (() => {
    const pts = [];
    for (let a = 160, i = 0; a <= 380; a += 11, i++) { const r = i % 2 ? 70 : 54, t = a * DEG; pts.push(f1(100 + r * Math.cos(t)) + ' ' + f1(116 + r * Math.sin(t))); }
    return 'M' + pts.join('L') + 'L100 140Z';
  })();
  const STROKE = (c, w, d) => '<path fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" d="' + d + '"/>';
  // kind: what it is, for screen readers and for Claude (the picker shows them unnamed)
  const HELPERS = {
    mia: { label: 'Australian Shepherd', kind: 'Mia, the family’s Australian Shepherd', sh: 52, pupil: true, cheeks: false,
      vars: '--limb:#24211E;--limbw:10;--paw:#FFFDF7;--pawedge:#24211E;--foot:#FFFDF7;--eye:#7A4523;--brow:#C27A3E;--broww:6.5;--specl:#E3A72F',
      back: '<path d="M64 62C42 64 32 92 36 120C38 136 50 140 58 128C62 108 66 86 76 68Z" fill="#24211E"/><path d="M136 62C158 64 168 92 164 120C162 136 150 140 142 128C138 108 134 86 124 68Z" fill="#24211E"/>'
        + STROKE('#24211E', 2, 'M37 96c-6 2-10 0-12-4M36 112c-6 4-11 3-14 0M38 132c-4 4-10 6-14 4M163 96c6 2 10 0 12-4M164 112c6 4 11 3 14 0M162 132c4 4 10 6 14 4'),
      body: '<path d="' + EGG + '" fill="#24211E"/>'
        + '<path d="M70 118C66 128 70 140 80 144L88 132Z" fill="#C27A3E"/><path d="M130 118C134 128 130 140 120 144L112 132Z" fill="#C27A3E"/>'
        + '<path d="M97 56C98 70 97 84 94 98C88 106 78 112 76 122C76 136 88 144 100 144C112 144 124 136 124 122C122 112 112 106 106 98C103 84 102 70 103 56Z" fill="#FFFDF7"/>'
        + '<circle cx="88" cy="120" r="1.6" fill="#8E949B"/><circle cx="113" cy="124" r="1.4" fill="#8E949B"/><circle cx="108" cy="113" r="1.2" fill="#8E949B"/>'
        + '<path d="M70 146l6 10 6-8 6 11 6-10 6 11 6-10 6 11 6-8 6 10c4 14-14 22-30 22s-34-8-30-22z" fill="#FFFDF7"/>',
      front: '<ellipse class="h-ink" cx="100" cy="116" rx="8" ry="5.5"/><ellipse cx="97" cy="114" rx="2.4" ry="1.4" fill="#fff" opacity=".35"/>' },
    fox: { label: 'Fox', kind: 'a fox', sh: 52, vars: '--limb:#C9622A;--limbw:9;--paw:#3B2A22;--pawedge:#3B2A22;--foot:#3B2A22',
      back: '<g class="h-wag" style="transform-origin:132px 150px"><path d="M130 150c34 8 56-20 44-52c-2 26-22 38-44 36z" fill="#E07B39"/><path d="M174 98c-8 4-12 12-10 22c8-4 12-12 10-22z" fill="#FFF7EC"/></g>'
        + '<path d="M60 84L66 40L94 64Z" fill="#E07B39"/><path d="M67 70L70 50L84 63Z" fill="#3B2A22"/><path d="M140 84L134 40L106 64Z" fill="#E07B39"/><path d="M133 70L130 50L116 63Z" fill="#3B2A22"/>',
      body: '<path d="' + EGG + '" fill="#E07B39"/><path d="M60 108C66 132 84 142 100 142C116 142 134 132 140 108C128 120 114 124 100 116C86 124 72 120 60 108Z" fill="#FFF7EC"/><ellipse cx="100" cy="154" rx="22" ry="12" fill="#FFF7EC"/>',
      front: '<ellipse class="h-ink" cx="100" cy="115" rx="5.5" ry="4"/>' },
    owl: { label: 'Owl', kind: 'an owl', sh: 54, smile: false, vars: '--limb:#1F6F6B;--limbw:11;--paw:#17524F;--pawedge:#17524F;--foot:#E3A72F',
      back: '<path d="M58 72L62 46L82 62Z" fill="#17524F"/><path d="M142 72L138 46L118 62Z" fill="#17524F"/>',
      body: '<path d="' + EGG + '" fill="#1F6F6B"/><ellipse cx="100" cy="146" rx="30" ry="20" fill="#F4E3BE"/>' + STROKE('#B98A4A', 2.4, 'M86 140l5 4 5-4M100 140l5 4 5-4M93 150l5 4 5-4M107 150l5 4')
        + '<circle cx="86" cy="104" r="15" fill="#F4E3BE"/><circle cx="114" cy="104" r="15" fill="#F4E3BE"/>',
      front: '<path d="M94 115l6 9 6-9z" fill="#E3A72F"/>' },
    robot: { label: 'Robot', kind: 'a retro robot', sh: 54, vars: '--limb:#2B2522;--limbw:6;--foot:#2B2522',
      back: STROKE('#2B2522', 3, 'M100 58V40') + '<circle class="h-bulb" cx="100" cy="36" r="7"/><circle cx="50" cy="104" r="6" fill="#E3A72F"/><circle cx="150" cy="104" r="6" fill="#E3A72F"/>',
      body: '<rect x="52" y="58" width="96" height="106" rx="22" fill="#4FB3AB"/><rect x="64" y="80" width="72" height="56" rx="14" fill="#FBF5E9"/><circle cx="84" cy="150" r="4.5" fill="#D8572A"/><circle cx="100" cy="150" r="4.5" fill="#E3A72F"/><circle cx="116" cy="150" r="4.5" fill="#7E8C34"/>',
      front: '' },
    octopus: { label: 'Octopus', kind: 'an octopus', sh: 50, feet: false, vars: '--limb:#E8806A;--limbw:11;--paw:#E8806A;--pawedge:#D2654F',
      back: STROKE('#E8806A', 11, 'M70 140c-10 14-8 28 6 28M88 146c-4 12 0 22 10 22M112 146c4 12 0 22-10 22M130 140c10 14 8 28-6 28'),
      body: '<path d="M100 50C136 50 154 76 154 108C154 134 138 148 100 148C62 148 46 134 46 108C46 76 64 50 100 50Z" fill="#E8806A"/><circle cx="126" cy="70" r="6" fill="#F4A894"/><circle cx="138" cy="86" r="4" fill="#F4A894"/><circle cx="70" cy="74" r="4.5" fill="#F4A894"/>',
      front: '' },
    hedgehog: { label: 'Hedgehog', kind: 'a hedgehog', sh: 56, vars: '--limb:#E8C58F;--limbw:9;--paw:#7A4E2D;--pawedge:#7A4E2D;--foot:#7A4E2D',
      back: '<path d="' + SPIKES + '" fill="#7A4E2D"/><circle cx="136" cy="54" r="10" fill="#D8572A"/>' + STROKE('#7E8C34', 3, 'M136 44q4-6 9-5'),
      body: '<circle cx="100" cy="118" r="48" fill="#E8C58F"/><circle cx="72" cy="80" r="8" fill="#E8C58F"/><circle cx="128" cy="80" r="8" fill="#E8C58F"/>',
      front: '<circle class="h-ink" cx="100" cy="116" r="5"/>' },
    otter: { label: 'Otter', kind: 'an otter', sh: 52, vars: '--limb:#8B5A3C;--limbw:10;--paw:#3B2A22;--pawedge:#3B2A22;--foot:#3B2A22',
      back: '<g class="h-wag" style="transform-origin:130px 156px"><path d="M128 154c20 2 36 8 44 18c-16 2-32-2-46-10z" fill="#6E4630"/></g><circle cx="64" cy="72" r="10" fill="#8B5A3C"/><circle cx="136" cy="72" r="10" fill="#8B5A3C"/><circle cx="64" cy="72" r="5" fill="#3B2A22"/><circle cx="136" cy="72" r="5" fill="#3B2A22"/>',
      body: '<path d="' + EGG + '" fill="#8B5A3C"/><ellipse cx="100" cy="112" rx="40" ry="30" fill="#E2C29E"/><ellipse cx="100" cy="152" rx="24" ry="13" fill="#E2C29E"/>',
      front: '<path d="M94 112h12l-6 6z" fill="#2B2522" stroke="#2B2522" stroke-width="3" stroke-linejoin="round"/>' + STROKE('#2B2522', 1.6, 'M80 118l-14-2M80 122l-13 3M120 118l14-2M120 122l13 3').replace('/>', ' opacity=".6"/>') },
  };
  const WHO = Object.keys(HELPERS);
  // Tron's rider (Tron: Ares, as the Light Cycle's driver in Tesla's cars): in the Tron look, everyone's helper suits up as
  // this - black suit and helmet lit with red, the identity disc behind - whichever helper they picked (its name stays theirs).
  // Not in the picker. Its jobs are the others': a lit data pad to read, a light that sweeps the visor to search, a stylus of
  // light to write; across aOS Home's bar it rides its Light Cycle, the red trail behind it.
  const RED = '#FF2A2A';
  HELPERS.rider = { label: 'Tron rider', kind: 'the Tron rider', sh: 54, smile: false, cheeks: false,
    vars: '--limb:#141418;--limbw:11;--paw:#141418;--pawedge:' + RED + ';--foot:#141418',
    back: '<circle cx="100" cy="116" r="60" fill="none" stroke="' + RED + '" stroke-opacity=".35" stroke-width="3"/><circle cx="100" cy="116" r="48" fill="none" stroke="' + RED + '" stroke-opacity=".18" stroke-width="2"/>'
      + '<g class="h-cycle"><path class="h-trail" d="M-250 164H34"/><circle cx="38" cy="162" r="20" fill="#0E0E10" stroke="' + RED + '" stroke-width="5"/><circle cx="162" cy="162" r="20" fill="#0E0E10" stroke="' + RED + '" stroke-width="5"/>'
      + '<path d="M22 158Q34 128 82 130L156 136Q172 140 168 156Q128 148 92 156Z" fill="#111114" stroke="' + RED + '" stroke-width="3"/></g>',
    body: '<path d="M58 168Q56 120 74 108Q100 98 126 108Q144 120 142 168Z" fill="#141418" stroke="#2C2C30" stroke-width="1.5"/>'
      + '<path d="M64 74Q64 34 100 34Q136 34 136 74V94Q136 108 122 110H78Q64 108 64 94Z" fill="#0E0E10" stroke="#2C2C30" stroke-width="1.5"/>'
      + '<g class="h-rlit" fill="none" stroke="' + RED + '" stroke-width="2.6" stroke-linecap="round"><path d="M100 36V58"/><path d="M66 86Q67 100 78 106"/><path d="M134 86Q133 100 122 106"/>'
      + '<path d="M70 122Q100 138 130 122"/><path d="M100 132V166"/><path d="M62 160Q64 134 76 116"/><path d="M138 160Q136 134 124 116"/><circle cx="100" cy="150" r="6"/></g>',
    front: '<g class="h-rvis"><path class="h-rvisor" d="M71 70Q100 58 129 70V90Q100 98 71 90Z"/><rect class="h-rsweep" x="93" y="64" width="14" height="30" rx="7"/>'
      + '<path d="M80 73Q90 68 102 67" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path class="h-rline" d="M80 84Q100 90 120 84"/></g>' };
  const MOODS = ['idle', 'listen', 'think', 'read', 'scan', 'write', 'show', 'talk', 'done'];

  function charSvg(who) {
    const c = HELPERS[who] || HELPERS.mia, lx = c.sh, sy = 120, rx = 200 - lx, hb = lx + 17.5;
    // where the hands end up for each job (the arm's rest, turned: see the CSS)
    const mg = [f1(rx + 24.4), f1(sy + 13.5)], pn = [f1(rx - 22.5), f1(sy + 16.4)], pt = [f1(rx + 21), f1(sy - 18.3)];
    const pg = x => 'M' + x + ' 130Q' + f1((x + 100) / 2) + ' 126 100 132V158Q' + f1((x + 100) / 2) + ' 152 ' + x + ' 156Z';
    const eye = x => '<ellipse class="h-eye" cx="' + x + '" cy="104" rx="6" ry="8.5"/>' + (c.pupil ? '<circle class="h-pupil" cx="' + x + '" cy="105" r="3.6"/>' : '') + '<circle class="h-glint" cx="' + (x + 2) + '" cy="101" r="2"/>';
    const arm = (side, sx) => {
      const d = side === 'L' ? -1 : 1, hx = sx + d * 10, hy = sy + 26, o = 'transform-origin:' + sx + 'px ' + sy + 'px';
      return '<g class="h-rig h-rig' + side + '" style="' + o + '"><g class="h-arm h-arm' + side + '" style="' + o + '"><path class="h-lim" d="M' + sx + ' ' + sy + 'Q' + (sx + d * 13) + ' ' + (sy + 11) + ' ' + hx + ' ' + hy + '"/><circle class="h-hand" cx="' + hx + '" cy="' + hy + '" r="7"/></g>';
    };
    const star = (x, y, s) => '<path class="h-star" style="transform-origin:' + x + 'px ' + y + 'px" d="M' + x + ' ' + (y - 10 * s) + 'l' + 2.5 * s + ' ' + 7.5 * s + ' ' + 7.5 * s + ' ' + 2.5 * s + '-' + 7.5 * s + ' ' + 2.5 * s + '-' + 2.5 * s + ' ' + 7.5 * s + '-' + 2.5 * s + '-' + 7.5 * s + '-' + 7.5 * s + '-' + 2.5 * s + ' ' + 7.5 * s + '-' + 2.5 * s + 'z"/>';
    return '<svg class="ipsy-char" viewBox="0 0 200 200" aria-hidden="true" focusable="false" data-who="' + who + '" style="' + c.vars + '">'
      + '<ellipse class="h-shadow" cx="100" cy="182" rx="44" ry="6"/>'
      + '<g class="h-pose"><g class="h-hop"><g class="h-bob"><g class="h-lean">'
      + c.back + (c.feet === false ? '' : '<ellipse class="h-foot" cx="84" cy="168" rx="11" ry="6"/><ellipse class="h-foot" cx="116" cy="168" rx="11" ry="6"/>')
      + c.body
      + '<g class="h-eyes"><g class="h-lids">' + eye(86) + eye(114) + '</g></g>'
      + '<path class="h-brow h-browL" d="M78 89Q85 85 92 88" style="transform-origin:85px 88px"/><path class="h-brow h-browR" d="M108 88Q115 85 122 89" style="transform-origin:115px 88px"/>'
      + c.front
      + '<g class="h-specs"><circle class="h-spec" cx="86" cy="104" r="12"/><circle class="h-spec" cx="114" cy="104" r="12"/><path class="h-bridge" d="M98 103q2-3 4 0M74 102l-8-3M126 102l8-3"/></g>'
      + '<g class="h-visor"><rect class="h-vband" x="70" y="96" width="60" height="15" rx="7.5"/><path class="h-vlight" d="M78 103.5h44"/></g>'
      + '<g class="h-shades"><rect class="h-lens2" x="73" y="96" width="25" height="15" rx="6"/><rect class="h-lens2" x="102" y="96" width="25" height="15" rx="6"/><path class="h-sbridge" d="M98 101h4"/><path class="h-sglint" d="M78 107l7-8M107 107l7-8"/></g>'
      + (c.smile === false ? '' : (c.cheeks === false ? '' : '<ellipse class="h-cheek" cx="72" cy="122" rx="7" ry="4"/><ellipse class="h-cheek" cx="128" cy="122" rx="7" ry="4"/>') + '<path class="h-smile" d="M93 123Q100 130 107 123"/>')
      + '<ellipse class="h-mouth" cx="100" cy="127" rx="6" ry="5"/>'
      + '<g class="h-scarf"><path class="h-kerchief" d="M68 136Q100 150 132 136L114 158Q100 166 86 158Z"/><g class="h-kdots"><circle cx="86" cy="146" r="2.4"/><circle cx="114" cy="146" r="2.4"/><circle cx="100" cy="156" r="2.4"/></g><circle class="h-knot" cx="100" cy="146" r="5"/></g>'
      + '<g class="h-prop h-book"><path class="h-cover" d="M' + (hb - 6) + ' 128h' + f1(2 * (100 - hb) + 12) + 'v32h-' + f1(2 * (100 - hb) + 12) + 'z"/>'
      + '<path class="h-page" d="' + pg(hb - 2) + '"/><path class="h-page" d="' + pg(f1(202 - hb)) + '"/>'
      + '<path class="h-pl" d="M' + (hb + 4) + ' 138h' + f1(92 - hb) + 'M' + (hb + 4) + ' 144h' + f1(88 - hb) + 'M' + (hb + 4) + ' 150h' + f1(92 - hb) + 'M106 138h' + f1(92 - hb) + 'M106 144h' + f1(86 - hb) + 'M106 150h' + f1(92 - hb) + '"/>'
      + '<path class="h-page h-flip" style="transform-origin:100px 145px" d="' + pg(f1(202 - hb)) + '"/></g>'
      + '<g class="h-prop h-notepad" transform="rotate(-8 92 146)"><rect class="h-pad" x="66" y="128" width="50" height="36" rx="4"/><rect class="h-padtop" x="66" y="128" width="50" height="7" rx="3"/>'
      + '<path class="h-wl" d="M72 143h34"/><path class="h-wl" d="M72 150h34"/><path class="h-wl" d="M72 157h24"/></g>'
      + '<g class="h-prop h-think"><circle class="h-bubble" cx="' + (rx + 4) + '" cy="72" r="5"/><circle class="h-bubble" cx="' + (rx + 14) + '" cy="56" r="7.5"/><circle class="h-bubble" cx="' + (rx + 28) + '" cy="36" r="11"/></g>'
      + '<g class="h-prop h-waves"><path class="h-wave" d="M' + (lx - 16) + ' 86q-6 8 0 16"/><path class="h-wave" d="M' + (lx - 24) + ' 80q-9 14 0 28"/></g>'
      + '<g class="h-prop h-shine">' + star(f1(+pt[0] + 12), f1(pt[1] - 12), 1.2) + '</g>'
      + '<g class="h-prop h-yay">' + star(36, 60, 1) + star(166, 52, 1) + '</g>'
      + arm('L', lx) + '</g>' + arm('R', rx)
      + '<g class="h-prop h-mag"><path class="h-handle" d="M' + mg[0] + ' ' + mg[1] + 'L' + f1(+mg[0] + 6) + ' ' + f1(mg[1] - 14) + '"/><circle class="h-lens" cx="' + f1(+mg[0] + 10) + '" cy="' + f1(mg[1] - 26) + '" r="13"/></g>'
      + '<g class="h-prop h-pen"><path class="h-pencil" d="M' + f1(+pn[0] + 9) + ' ' + f1(pn[1] - 12) + 'l6 4-12 18-6-4z"/><path class="h-tip" d="M' + f1(pn[0] - 3) + ' ' + f1(+pn[1] + 6) + 'l6 4-7 3z"/></g>'
      + '</g></g></g></g></g></svg>';
  }

  // Your helper and its name: aos.helper { who, name } on this device (every app inside aOS shares aOS's storage,
  // and it follows you to your other devices with your settings: aOS/prefs-sync.js). None yet: the helpers take
  // turns peeking out of the corner, and the chat starts by asking you to pick one.
  const HELPER_KEY = 'aos.helper';
  const helper = () => { try { const h = JSON.parse(ls.get(HELPER_KEY, 'null')); return h && own(HELPERS, h.who) ? { who: h.who, name: String(h.name || '').slice(0, 16) } : null; } catch { return null; } };
  const helperName = () => { const h = helper(); return (h && h.name.trim()) || 'Ipsy'; };
  // the chat's title: its name, or with none, what it is (Mia is Mia; in Russian, Ipsy)
  const title = () => { const h = helper(); return !h || h.name.trim() ? helperName() : (ru => h.who === 'mia' ? (ru ? 'Мия' : 'Mia') : ru ? 'Ipsy' : HELPERS[h.who].label)(window.aosLang && aosLang.get() === 'ru'); };
  function setHelper(who, name) {
    if (!own(HELPERS, who)) return;
    ls.set(HELPER_KEY, JSON.stringify({ who, name: String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16) }));
    helperChanged();
  }
  const onHelper = new Set();   // what redraws when it changes (each mounted Ipsy, a picker)
  function helperChanged() {
    const h = helper();
    cells.forEach(c => { if (!c.fixed) { c.peeking = false; drawChar(c, h ? h.who : c.peek); } });
    onHelper.forEach(fn => { try { fn(h); } catch {} });
    if (window.aosLang && aosLang.helper) aosLang.helper();   // the words on the page that say Ipsy say the new name (home/lang.js)
  }
  addEventListener('storage', e => { if (e.key === HELPER_KEY) helperChanged(); });   // changed in another app or frame

  // Each drawn helper: its host carries the mood (data-mood) and the CSS does the rest. A helper not picked yet
  // takes turns with the others (peek), one every few seconds.
  const cells = new Set();
  let peekAt = Math.floor(Math.random() * WHO.length), peekT = 0;
  const looksAs = who => (LOOK() === 'grid' ? 'rider' : who);
  function drawChar(c, who) {
    if (!c.fixed) who = looksAs(who);
    if (c.who === who) return;
    c.who = who; c.host.innerHTML = charSvg(who); c.svg = c.host.firstChild;
    if (c.peeking) c.svg.classList.add('h-peek');
  }
  function addCell(host, o = {}) {   // a helper drawn in host (o.who: always that one)
    const h = helper();
    const c = { host, mood: 'idle', fixed: !!o.who, peek: WHO[peekIndex()], who: '' };
    drawChar(c, o.who || (h ? h.who : c.peek));
    cells.add(c); setMood(c, 'idle'); peekLoop();
    return c;
  }
  function peekIndex() { return peekAt % WHO.length; }
  function peekLoop() {
    if (peekT || helper()) return;
    peekT = setInterval(() => {
      if (helper()) { clearInterval(peekT); peekT = 0; return; }
      if (document.visibilityState !== 'visible' || still() || LOOK() === 'grid') return;
      peekAt++;
      cells.forEach(c => { if (!c.host.isConnected) { cells.delete(c); return; } if (c.fixed || c.mood !== 'idle' || c.host.closest('.ipsy-wrap:not([hidden])')) return; c.peek = WHO[peekIndex()]; c.peeking = true; drawChar(c, c.peek); });
    }, 4200);
  }
  // a tool's job, by its name: what the helper acts out while it runs
  function jobOf(name) {
    const n = String(name || '');
    if (/^(find|search)(_|$)/.test(n)) return 'scan';
    if (/^(show|open)(_|$)/.test(n)) return 'show';
    if (/^(create|edit|set|update|add|delete|remove|move|merge|rename|make|accept|discard|tick|tidy|sort|change)_/.test(n)) return 'write';
    return 'read';
  }
  function setMood(c, mood) {
    mood = mood === 'work' ? 'read' : MOODS.includes(mood) ? mood : 'idle';
    c.mood = mood; c.host.dataset.mood = mood;
  }
  function syncIpsyVisibility() {
    document.documentElement.classList.toggle('ipsy-paused', document.visibilityState !== 'visible');
  }
  document.addEventListener('visibilitychange', syncIpsyVisibility);
  syncIpsyVisibility();

  // ---------------------------------------------------------------------------
  // Across a bar (aOS Home's Ipsy bar): each helper in its own way, out to the far end and back.
  // Keyframes: [offset, how far along (0..1), the pose]. cross(slot, d) runs it; the animations come back,
  // so a tap can finish them (it's home at once).
  // ---------------------------------------------------------------------------
  const spurts = (dir, from, to, n) => {   // the octopus: squash, shoot forward, settle, n times
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = from + (to - from) * k / n, s = (to - from) / n, x0 = dir > 0 ? k / n : 1 - k / n, x1 = dir > 0 ? (k + 1) / n : 1 - (k + 1) / n;
      out.push([a + s * 0.25, x0, 'scale(1.14,.84)'], [a + s * 0.6, x1, 'translateY(-10px) rotate(' + 14 * dir + 'deg) scale(.86,1.16)'], [a + s, x1, 'none']);
    }
    return out;
  };
  const MOVES = {
    // zoomies: races out bouncing, spins on the spot, races back
    mia: { speed: 1, frames: [[0, 0, 'none'], ...[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((x, i) => [0.06 + i * 0.06, x, i % 2 ? 'rotate(6deg)' : 'translateY(-14px) rotate(6deg)']), [0.42, 1, 'none'],
      [0.47, 1, 'translateY(-22px) rotate(180deg)'], [0.52, 1, 'translateY(-22px) rotate(360deg)'], [0.56, 1, 'rotate(360deg) scale(1.08,.9)'],
      ...[0.85, 0.7, 0.55, 0.4, 0.25, 0.1].map((x, i) => [0.62 + i * 0.05, x, i % 2 ? 'rotate(354deg)' : 'translateY(-14px) rotate(354deg)']), [1, 0, 'rotate(360deg)']] },
    // creeps out on tiptoe, freezes, then pounces home
    fox: { speed: 1.25, frames: [[0, 0, 'none'], ...Array.from({ length: 9 }, (_, i) => [0.05 * (i + 1), 0.11 * (i + 1) - 0.07, 'scale(1.04,.86)' + (i % 2 ? ' translateY(-3px) rotate(3deg)' : ' rotate(-4deg)')]),
      [0.5, 1, 'none'], [0.6, 1, 'none'], [0.64, 1, 'scale(1.1,.8)'], [0.72, 0.55, 'translateY(-46px) rotate(-24deg)'], [0.8, 0.1, 'rotate(-30deg) scale(1.1,.85)'], [0.86, 0.1, 'scale(1.1,.85)'],
      [0.93, 0, 'translateY(-16px) rotate(-10deg)'], [1, 0, 'none']] },
    // flies out flapping, loops the loop, flies back
    owl: { speed: 1.05, frames: [[0, 0, 'none'], [0.1, 0.1, 'translateY(-26px) rotate(10deg)'], [0.2, 0.3, 'translateY(-10px) rotate(12deg)'], [0.3, 0.55, 'translateY(-30px) rotate(12deg)'],
      [0.4, 0.8, 'translateY(-12px) rotate(10deg)'], [0.48, 1, 'translateY(-34px) rotate(0deg)'], [0.55, 1, 'translateY(-38px) rotate(-180deg)'], [0.62, 0.9, 'translateY(-30px) rotate(-360deg)'],
      [0.72, 0.6, 'translateY(-12px) rotate(-372deg)'], [0.82, 0.35, 'translateY(-28px) rotate(-370deg)'], [0.92, 0.1, 'translateY(-10px) rotate(-366deg)'], [1, 0, 'rotate(-360deg)']] },
    // moonwalks out in shades, strikes a pose, walks back
    robot: { speed: 1.2, frames: [[0, 0, 'none'], [0.05, 0, 'rotate(-7deg)'], [0.42, 1, 'rotate(-7deg)'], [0.46, 1, 'translateY(-4px)'], [0.56, 1, 'translateY(-4px)'], [0.6, 1, 'rotate(5deg)'], [0.96, 0, 'rotate(5deg)'], [1, 0, 'none']] },
    // jets out in squishy spurts, and back
    octopus: { speed: 1.1, frames: [[0, 0, 'none'], ...spurts(1, 0, 0.5, 4), ...spurts(-1, 0.5, 1, 4)] },
    // curls up and rolls out, pops up with a ta-da, rolls back (turns: from how far it goes)
    hedgehog: { speed: 1, frames: d => { const t = Math.max(1, Math.round(d / (0.3 * 56) / (2 * Math.PI))) * 360; return [[0, 0, 'scale(.8) rotate(0deg)'], [0.4, 1, 'scale(.8) rotate(' + t + 'deg)'],
      [0.45, 1, 'translateY(-22px) rotate(' + t + 'deg)'], [0.5, 1, 'rotate(' + t + 'deg)'], [0.6, 1, 'rotate(' + t + 'deg)'], [0.63, 1, 'scale(.8) rotate(' + t + 'deg)'], [0.97, 0, 'scale(.8) rotate(0deg)'], [1, 0, 'none']]; } },
    // a run-up, then a belly slide out; stands, and slides back
    otter: { speed: 1.1, frames: [[0, 0, 'none'], [0.05, 0.06, 'translateY(-8px) rotate(8deg)'], [0.1, 0.12, 'rotate(6deg)'], [0.15, 0.2, 'translateY(-14px) rotate(50deg)'], [0.2, 0.3, 'translateY(12px) rotate(90deg)', 'cubic-bezier(.1,.6,.3,1)'],
      [0.42, 1, 'translateY(12px) rotate(90deg)'], [0.47, 1, 'translateY(-12px) rotate(0deg)'], [0.52, 1, 'none'], [0.57, 0.94, 'translateY(-14px) rotate(-50deg)'], [0.62, 0.84, 'translateY(12px) rotate(-90deg)', 'cubic-bezier(.1,.6,.3,1)'],
      [0.9, 0, 'translateY(12px) rotate(-90deg)'], [0.95, 0, 'translateY(-10px) rotate(0deg)'], [1, 0, 'none']] },
  };
  // the rider: mounts, rides its Light Cycle out (leaning in), turns at the end, rides back
  MOVES.rider = { speed: 0.9, frames: [[0, 0, 'none'], [0.06, 0, 'translateY(-6px)'], [0.44, 1, 'rotate(-5deg)', 'cubic-bezier(.55,0,.25,1)'], [0.5, 1, 'scaleX(-1) rotate(-5deg)'],
    [0.94, 0, 'scaleX(-1) rotate(-5deg)', 'cubic-bezier(.55,0,.25,1)'], [1, 0, 'none']] };
  function cross(slot, d) {
    const host = slot.querySelector('.ipsy-host'), svg = slot.querySelector('.ipsy-char'), pose = svg && svg.querySelector('.h-pose');
    if (!host || !pose || still()) return null;
    const who = svg.dataset.who, m = MOVES[who] || MOVES.mia, frames = typeof m.frames === 'function' ? m.frames(d) : m.frames;
    const duration = Math.round(2 * (900 + d * 2) / 0.84 * m.speed);
    const ease = f => f[3] || 'ease-in-out';
    host.dataset.mood = 'cross'; host.style.setProperty('--cross', duration + 'ms');
    const anims = [slot.animate(frames.map(f => ({ offset: f[0], transform: 'translateX(' + f1(f[1] * d) + 'px)', easing: ease(f) })), { duration }),
      pose.animate(frames.map(f => ({ offset: f[0], transform: f[2], easing: ease(f) })), { duration })];
    anims[0].finished.catch(() => {}).then(() => { if (host.dataset.mood === 'cross') host.dataset.mood = 'idle'; });
    return anims;
  }

  // The picker: every helper, unnamed (their kind for screen readers), then a name. pick(who, name) when done.
  function pickerHtml(id, h) {
    return '<div class="ipsy-who" role="radiogroup" aria-label="Your helper">' + WHO.map(w => '<button type="button" class="ipsy-whobtn" role="radio" data-who="' + w + '" aria-checked="' + !!(h && h.who === w) + '" aria-label="' + esc(HELPERS[w].kind.replace(/^an? /, '')) + '"><span class="ipsy-host" data-mood="idle">' + charSvg(w) + '</span></button>').join('') + '</div>'
      + '<label class="ipsy-namel" for="' + id + '">Name</label><input class="ipsy-name" id="' + id + '" maxlength="16" autocomplete="off" spellcheck="false" placeholder="' + (h ? 'Give them a name' : 'Pick a helper first') + '"' + (h ? ' value="' + esc(h.name) + '"' : ' disabled') + '>';
  }
  function bindPicker(root, done) {
    const who = () => { const b = root.querySelector('.ipsy-whobtn[aria-checked="true"]'); return b ? b.dataset.who : ''; };   // as shown (another picker may have changed it)
    root.addEventListener('click', e => {
      const b = e.target.closest('.ipsy-whobtn'); if (!b) return;
      root.querySelectorAll('.ipsy-whobtn').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      const n = root.querySelector('.ipsy-name'); n.disabled = false; n.placeholder = 'Give them a name'; n.focus();
      if (done) done(who(), n.value, false);
    });
    root.addEventListener('input', e => { if (e.target.classList.contains('ipsy-name') && who() && done) done(who(), e.target.value, false); });
    return { who, name: () => (root.querySelector('.ipsy-name') || {}).value || '' };
  }
  // In aOS Account, Your helper: picks and names it as you go (saved at once); changed(helper) after each change
  let pickers = 0;
  function picker(host, changed) {
    addStyle();
    const id = 'ipsyName' + (++pickers);   // one page can hold two (Account's, and Run through setup's over it)
    host.innerHTML = '<div class="ipsy-picker">' + pickerHtml(id, helper()) + '</div>';
    const root = host.firstChild;
    follow(root);
    bindPicker(root, (who, name) => { setHelper(who, name); if (changed) changed(helper()); });
    // picked or named elsewhere (another picker, Ipsy, another app): this one shows it too
    const sync = h => {
      if (!root.isConnected) { onHelper.delete(sync); return; }
      root.querySelectorAll('.ipsy-whobtn').forEach(b => b.setAttribute('aria-checked', String(!!h && b.dataset.who === h.who)));
      const n = root.querySelector('.ipsy-name');
      if (h && document.activeElement !== n) { n.disabled = false; n.placeholder = 'Give them a name'; n.value = h.name; }
      if (changed) changed(h);
    };
    onHelper.add(sync);
  }

  // ---------------------------------------------------------------------------
  // The look: the app's own tokens, so it's Sea glass or Vintage, light or dark, as the app is
  // ---------------------------------------------------------------------------
  const CSS = `
.ipsy-hint{position:fixed;z-index:6;max-width:min(260px,calc(100vw - 110px));padding:9px 13px;border-radius:18px 18px 18px 6px;font-size:14px;font-weight:600;line-height:1.3;
  cursor:pointer;border:0;text-align:left;font-family:inherit;animation:ipsyPop .4s cubic-bezier(.2,1.3,.35,1) both;transform-origin:0 100%}
.ipsy-glass.ipsy-hint{background:var(--sheet,rgba(248,250,249,.95));color:var(--text,#10181A);box-shadow:0 8px 24px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.5);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.ipsy-vintage.ipsy-hint{background:var(--mc-card,#FBF5E9);color:var(--mc-ink,#2B2522);box-shadow:0 0 0 2.5px var(--mc-mustard,#E3A72F),0 8px 20px rgba(43,37,34,.2)}
.ipsy-hint.out{animation:ipsyShrink .2s ease-in both}
.ipsy-btn{position:relative;width:78px;height:78px;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ipsy-btn:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px;border-radius:50%}
.ipsy-btn .ipsy-host{width:100%;height:100%}
.ipsy-btn:active .ipsy-host{transform:scale(.92)}
:where(.ipsy-host){position:relative;display:block}
.ipsy-char{width:100%;height:100%;display:block;overflow:visible;--line:#2B2522;--limb:var(--line);--limbw:6;--paw:#FFFDF7;--pawedge:var(--line);--foot:var(--line)}
.ipsy-char g,.ipsy-char path,.ipsy-char ellipse,.ipsy-char circle,.ipsy-char rect{transform-box:view-box}
.ipsy-glass .ipsy-char{filter:drop-shadow(0 6px 12px rgba(129,147,188,.35))}
.ipsy-grid .ipsy-char{filter:drop-shadow(0 0 2.5px var(--tr-line,#FF2A2A))}   /* a rim of light, so a dark helper (Mia) shows on black */
.ipsy-neon .ipsy-char{filter:drop-shadow(0 0 2.5px #FF3D9A)}
.ipsy-char .h-shadow{fill:#2B2522;opacity:.12;transform-origin:100px 182px;animation:ipsyShade 4.8s ease-in-out infinite}
.h-pose{transform-origin:100px 120px}
.h-lim{fill:none;stroke:var(--limb);stroke-width:var(--limbw);stroke-linecap:round}
.h-hand{fill:var(--paw);stroke:var(--pawedge);stroke-width:2.5}
.h-foot{fill:var(--foot)}
.h-eye{fill:var(--eye,var(--line))} .h-glint{fill:#fff} .h-pupil{fill:#1A1410} .h-ink{fill:var(--line)} .h-bulb{fill:#D8572A}
.h-brow{fill:none;stroke:var(--brow,var(--line));stroke-width:var(--broww,3.4);stroke-linecap:round;transition:transform .35s ease}
.h-cheek{fill:#D8572A;opacity:.55}
.h-smile{fill:none;stroke:var(--line);stroke-width:3.4;stroke-linecap:round}
.h-mouth{fill:var(--line);opacity:0;transform-origin:100px 127px}
.h-arm,.h-rig{transition:transform .55s cubic-bezier(.3,1.35,.5,1)}
.h-prop{opacity:0;transition:opacity .3s}
.h-eyes{transition:transform .35s ease}
.h-lean{transform-origin:100px 170px;transition:transform .5s cubic-bezier(.3,1.35,.5,1)}
.h-cover{fill:#1F6F6B} .h-page{fill:#FFFDF7;stroke:var(--line);stroke-width:1.6} .h-pl{stroke:var(--line);stroke-width:1.6;opacity:.45;stroke-linecap:round}
.h-pad{fill:#FFFDF7;stroke:var(--line);stroke-width:2} .h-padtop{fill:#D8572A}
.h-wl{stroke:#1F6F6B;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:34;stroke-dashoffset:34}
.h-pencil{fill:#E3A72F;stroke:var(--line);stroke-width:1.8} .h-tip{fill:var(--line)}
.h-spec{fill:rgba(255,255,255,.35);stroke:var(--specl,var(--line));stroke-width:3.2}
.h-bridge{fill:none;stroke:var(--specl,var(--line));stroke-width:3.2;stroke-linecap:round}
.h-specs{opacity:0;transform:translateY(-40px);transition:transform .55s cubic-bezier(.3,1.5,.5,1),opacity .2s}
.h-lens{fill:#DCEBE9;stroke:#1F6F6B;stroke-width:4} .h-handle{stroke:var(--line);stroke-width:5;stroke-linecap:round}
.h-bubble{fill:#FFFDF7;stroke:var(--line);stroke-width:2} .h-star{fill:#D8572A} .h-wave{fill:none;stroke:#1F6F6B;stroke-width:3;stroke-linecap:round}
/* Night Drive: mirror shades (off while the glasses are on); Folk: a red neckerchief with white dots; Tron: a lit visor */
.h-shades,.h-scarf,.h-visor{display:none}
.ipsy-grid .h-visor{display:inline}
.ipsy-grid .h-lids{opacity:0}
[data-mood="scan"] .h-visor,[data-mood="cross"] [data-who="robot"] .h-visor{display:none}
.ipsy-grid[data-mood="scan"] .h-lids,.ipsy-grid [data-mood="scan"] .h-lids{opacity:1}
.h-vband{fill:#08090B;stroke:var(--tr-line,#FF2A2A);stroke-width:2.4}
.h-vlight{fill:none;stroke:var(--tr-line,#FF2A2A);stroke-width:3.4;stroke-linecap:round;stroke-dasharray:14 30;animation:ipsyScan 2.4s ease-in-out infinite alternate;filter:drop-shadow(0 0 3px var(--tr-line,#FF2A2A))}
@keyframes ipsyScan{from{stroke-dashoffset:0}to{stroke-dashoffset:-30}}
.ipsy-grid .h-cheek{fill:var(--tr-line,#FF2A2A);opacity:.6}
.ipsy-neon .h-shades{display:inline}
.h-lens2{fill:#120B1F;stroke:#FF3D9A;stroke-width:2.6} .h-sbridge{fill:none;stroke:#FF3D9A;stroke-width:2.6;stroke-linecap:round} .h-sglint{fill:none;stroke:#22D3EE;stroke-width:2.2;stroke-linecap:round;opacity:.9}
.ipsy-neon .h-cheek{fill:#FF3D9A}
.ipsy-folk .h-scarf{display:inline}
.h-kerchief,.h-knot{fill:var(--fk-scarf,#C7261C)} .h-kdots circle{fill:var(--fk-dot,#F6E7C6)} .h-knot{stroke:var(--fk-dot,#F6E7C6);stroke-width:1.5}
/* Tron's rider: a visor for a face (no eyes, brows, mouth or glasses); its props lit red; the Light Cycle only to cross */
[data-who="rider"] :is(.h-eyes,.h-brow,.h-smile,.h-mouth,.h-cheek,.h-specs,.h-visor,.h-shades,.h-scarf,.h-mag){display:none}
.ipsy-grid [data-who="rider"],[data-who="rider"]{filter:drop-shadow(0 0 2px rgba(255,42,42,.55))}
.h-rlit{filter:drop-shadow(0 0 2.5px #FF2A2A)}
.h-rvisor{fill:#060607;stroke:#FF2A2A;stroke-width:1.8}
.h-rline{fill:none;stroke:#FF2A2A;stroke-width:2.2;stroke-linecap:round;opacity:.7}
.h-rsweep{fill:#FF2A2A;opacity:0;transform-origin:100px 79px}
[data-mood="scan"] [data-who="rider"] .h-rsweep{opacity:.85;animation:ipsyVisor 1.2s ease-in-out infinite alternate}
@keyframes ipsyVisor{from{transform:translateX(-20px)}to{transform:translateX(20px)}}
[data-mood="talk"] [data-who="rider"] .h-rline{animation:ipsyRtalk .32s ease-in-out infinite alternate}
@keyframes ipsyRtalk{from{opacity:.25}to{opacity:1}}
[data-who="rider"] .h-cover{fill:#1A0204;stroke:#FF2A2A;stroke-width:2.4} [data-who="rider"] .h-page{fill:#0E0E10;stroke:#FF2A2A} [data-who="rider"] .h-pl{stroke:#FF8A8A;opacity:.95}
[data-who="rider"] .h-pad{fill:#0E0E10;stroke:#FF2A2A} [data-who="rider"] .h-padtop{fill:#FF2A2A} [data-who="rider"] .h-wl{stroke:#FF8A8A}
[data-who="rider"] .h-pencil{fill:#FF2A2A;stroke:#FFD3D3} [data-who="rider"] .h-tip{fill:#FFE1E1}
[data-who="rider"] :is(.h-star){fill:#FF2A2A} [data-who="rider"] .h-wave{stroke:#FF2A2A} [data-who="rider"] .h-bubble{fill:#0E0E10;stroke:#FF2A2A}
[data-who="rider"] .h-shadow{fill:#FF2A2A;opacity:.18}
.ipsy-char[data-who="rider"] .h-foot{fill:#141418;stroke:#FF2A2A;stroke-width:2}
.h-cycle{display:none}
.h-trail{fill:none;stroke:#FF2A2A;stroke-width:5;stroke-linecap:round;filter:drop-shadow(0 0 5px #FF2A2A)}
[data-mood="cross"] [data-who="rider"] .h-cycle{display:inline}
[data-mood="cross"] [data-who="rider"] .h-foot{display:none}
[data-mood="cross"] [data-who="rider"] .h-armL{transform:rotate(-75deg)}
[data-mood="cross"] [data-who="rider"] .h-armR{transform:rotate(-40deg)}
.h-peek{animation:ipsyPeek .5s cubic-bezier(.2,1.3,.35,1) both}
/* idle: bobs, blinks, waves now and then; a tail wags */
.h-bob{animation:ipsyBob 4.8s ease-in-out infinite}
.h-lids{transform-origin:100px 104px;animation:ipsyBlink 6s infinite}
.h-wag{animation:ipsyWag 2.4s ease-in-out infinite}
.ipsy-host:not([data-mood]) .h-armR,[data-mood="idle"] .h-armR{animation:ipsyWave 9s ease-in-out infinite}
/* listening: leans in, hand to its ear */
[data-mood="listen"] .h-lean{transform:rotate(-6deg)}
[data-mood="listen"] .h-armL{transform:rotate(145deg)}
[data-mood="listen"] .h-brow{transform:translateY(-4px)}
[data-mood="listen"] .h-waves{opacity:1}
[data-mood="listen"] .h-wave{animation:ipsyPulse 1.4s ease-out infinite}
[data-mood="listen"] .h-wave+.h-wave{animation-delay:.35s}
/* thinking: hand on its chin, looks up, thought bubbles (the robot's bulb flashes) */
[data-mood="think"] .h-armR{transform:rotate(91deg)}
[data-mood="think"] .h-eyes{transform:translate(4px,-5px)}
[data-mood="think"] .h-browL{transform:translateY(-3px) rotate(-8deg)}
[data-mood="think"] .h-browR{transform:translateY(2px) rotate(6deg)}
[data-mood="think"] .h-think{opacity:1}
[data-mood="think"] .h-bubble{animation:ipsyBubble 1.8s ease-in-out infinite}
[data-mood="think"] .h-bubble:nth-child(2){animation-delay:.3s}
[data-mood="think"] .h-bubble:nth-child(3){animation-delay:.6s}
[data-mood="think"] .h-bulb{animation:ipsyGlow .5s steps(2) infinite}
/* reading: a book, eyes along the lines, a page turning */
[data-mood="read"] .h-armL{transform:rotate(-60deg)}
[data-mood="read"] .h-armR{transform:rotate(60deg)}
[data-mood="read"] .h-book{opacity:1}
[data-mood="read"] .h-eyes{animation:ipsyRead 2.4s ease-in-out infinite}
[data-mood="read"] .h-flip{animation:ipsyFlip 4.8s ease-in-out infinite}
/* scanning: glasses on, a magnifying glass sweeping, eyes darting */
[data-mood="scan"] .h-armR{transform:rotate(-40deg)}
[data-mood="scan"] .h-rigR{animation:ipsySweep 1.6s ease-in-out infinite}
[data-mood="scan"] .h-mag{opacity:1}
[data-mood="scan"] .h-specs{opacity:1;transform:translateY(0)}
[data-mood="scan"] .h-shades{display:none}
[data-mood="scan"] .h-eyes{animation:ipsyDart 1.6s ease-in-out infinite}
[data-mood="scan"] .h-browL{transform:translateY(-6px)}
/* writing: a notepad, the pencil scribbling, lines appearing */
[data-mood="write"] .h-armL{transform:rotate(-60deg)}
[data-mood="write"] .h-armR{transform:rotate(75deg)}
[data-mood="write"] .h-notepad,[data-mood="write"] .h-pen{opacity:1}
[data-mood="write"] .h-rigR{animation:ipsyScribble .5s linear infinite}
[data-mood="write"] .h-wl{animation:ipsyLine 3s linear infinite}
[data-mood="write"] .h-wl:nth-of-type(2){animation-delay:1s}
[data-mood="write"] .h-wl:nth-of-type(3){animation-delay:2s}
[data-mood="write"] .h-eyes{transform:translate(-3px,5px)}
[data-mood="write"] .h-brow{transform:translateY(2px)}
/* showing: points at it, a sparkle */
[data-mood="show"] .h-armR{transform:rotate(-110deg)}
[data-mood="show"] .h-eyes{transform:translate(5px,-2px)}
[data-mood="show"] .h-shine{opacity:1}
[data-mood="show"] .h-star{animation:ipsyTwinkle 1.2s ease-in-out infinite}
/* talking: mouth and hands */
[data-mood="talk"] .h-smile{opacity:0}
[data-mood="talk"] .h-mouth{opacity:1;animation:ipsyJaw .26s ease-in-out infinite alternate}
[data-mood="talk"] .h-rigL{animation:ipsyGestL 1.1s ease-in-out infinite}
[data-mood="talk"] .h-rigR{animation:ipsyGestR 1.1s ease-in-out infinite .3s}
/* done: a hop, arms up, sparkles */
[data-mood="done"] .h-hop{animation:ipsyHop .9s cubic-bezier(.3,0,.4,1) infinite}
[data-mood="done"] .h-armL{transform:rotate(126deg)}
[data-mood="done"] .h-armR{transform:rotate(-126deg)}
[data-mood="done"] .h-smile{opacity:0}
[data-mood="done"] .h-mouth{opacity:1}
[data-mood="done"] .h-brow{transform:translateY(-4px)}
[data-mood="done"] .h-yay{opacity:1}
[data-mood="done"] .h-yay .h-star{animation:ipsyTwinkle .9s ease-in-out infinite}
[data-mood="done"] .h-wag{animation-duration:.6s}
/* crossing aOS Home's bar (cross()): no bob; the owl flaps, the robot moonwalks and poses, the hedgehog's ta-da */
[data-mood="cross"] .h-bob,[data-mood="cross"] .h-shadow{animation:none}
[data-mood="cross"] [data-who="owl"] .h-armL{animation:ipsyFlapL .22s ease-in-out infinite alternate}
[data-mood="cross"] [data-who="owl"] .h-armR{animation:ipsyFlapR .22s ease-in-out infinite alternate}
[data-mood="cross"] [data-who="mia"] .h-armL,[data-mood="cross"] [data-who="otter"] .h-armL{transform:rotate(-40deg)}
[data-mood="cross"] [data-who="mia"] .h-armR,[data-mood="cross"] [data-who="otter"] .h-armR{transform:rotate(40deg)}
[data-mood="cross"] [data-who="robot"] .h-specs{opacity:1;transform:none}
[data-mood="cross"] [data-who="robot"] .h-spec{fill:#2B2522}
[data-mood="cross"] [data-who="robot"] .h-shades{display:none}
[data-mood="cross"] [data-who="robot"] .h-foot{animation:ipsyMoon .7s ease-in-out infinite}
[data-mood="cross"] [data-who="robot"] .h-foot+.h-foot{animation-delay:.35s}
[data-mood="cross"] [data-who="robot"] .h-armL{animation:ipsyBotL var(--cross,4s) ease-in-out}
[data-mood="cross"] [data-who="robot"] .h-armR{animation:ipsyBotR var(--cross,4s) ease-in-out}
[data-mood="cross"] [data-who="hedgehog"] .h-armL{animation:ipsyHogL var(--cross,4s)}
[data-mood="cross"] [data-who="hedgehog"] .h-armR{animation:ipsyHogR var(--cross,4s)}
[data-mood="cross"] [data-who="octopus"] .h-armL{transform:rotate(60deg)}
[data-mood="cross"] [data-who="octopus"] .h-armR{transform:rotate(-60deg)}
[data-mood="cross"] [data-who="fox"] .h-armL{transform:rotate(-70deg)}
[data-mood="cross"] [data-who="fox"] .h-armR{transform:rotate(-30deg)}
@keyframes ipsyBob{50%{transform:translateY(-4px)}}
@keyframes ipsyShade{50%{transform:scaleX(.9);opacity:.08}}
@keyframes ipsyBlink{0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}
@keyframes ipsyWag{0%,100%{transform:rotate(0)}50%{transform:rotate(8deg)}}
@keyframes ipsyGlow{50%{fill:#E3A72F}}
@keyframes ipsyWave{0%,70%,100%{transform:rotate(0)}75%{transform:rotate(-125deg)}78%{transform:rotate(-100deg)}81%{transform:rotate(-125deg)}84%{transform:rotate(-100deg)}90%{transform:rotate(0)}}
@keyframes ipsyPulse{0%{opacity:0;transform:translateX(0)}30%{opacity:1}100%{opacity:0;transform:translateX(-8px)}}
@keyframes ipsyBubble{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}
@keyframes ipsyRead{0%{transform:translate(-5px,5px)}40%{transform:translate(5px,5px)}50%{transform:translate(-5px,7px)}90%{transform:translate(5px,7px)}100%{transform:translate(-5px,5px)}}
@keyframes ipsyFlip{0%,55%{transform:scaleX(1)}75%,100%{transform:scaleX(-1)}}
@keyframes ipsySweep{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(7deg)}}
@keyframes ipsyDart{0%,100%{transform:translate(3px,-1px)}30%{transform:translate(5px,1px)}60%{transform:translate(1px,-2px)}}
@keyframes ipsyScribble{0%,100%{transform:translate(0,0)}25%{transform:translate(3px,1px)}50%{transform:translate(-1px,2px)}75%{transform:translate(4px,-1px)}}
@keyframes ipsyLine{0%{stroke-dashoffset:34}30%,100%{stroke-dashoffset:0}}
@keyframes ipsyTwinkle{0%,100%{transform:scale(.6) rotate(0);opacity:.5}50%{transform:scale(1.1) rotate(20deg);opacity:1}}
@keyframes ipsyJaw{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
@keyframes ipsyGestL{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
@keyframes ipsyGestR{0%,100%{transform:rotate(0)}50%{transform:rotate(22deg)}}
@keyframes ipsyHop{0%,100%{transform:translateY(0)}35%{transform:translateY(-14px)}60%{transform:translateY(0)}70%{transform:translateY(-3px)}}
@keyframes ipsyPeek{from{opacity:0;transform:translateY(30%) scale(.8)}}
@keyframes ipsyFlapL{from{transform:rotate(90deg)}to{transform:rotate(160deg)}}
@keyframes ipsyFlapR{from{transform:rotate(-90deg)}to{transform:rotate(-160deg)}}
@keyframes ipsyMoon{0%{transform:translate(4px,0)}40%{transform:translate(-8px,0)}60%{transform:translate(-8px,-6px)}100%{transform:translate(4px,0)}}
@keyframes ipsyBotL{0%,42%,58%,100%{transform:rotate(-20deg)}46%,54%{transform:rotate(126deg)}}
@keyframes ipsyBotR{0%,42%,58%,100%{transform:rotate(20deg)}46%,54%{transform:rotate(-70deg)}}
@keyframes ipsyHogL{0%,42%{transform:rotate(-60deg)}46%,58%{transform:rotate(126deg)}64%,97%{transform:rotate(-60deg)}100%{transform:rotate(0)}}
@keyframes ipsyHogR{0%,42%{transform:rotate(60deg)}46%,58%{transform:rotate(-126deg)}64%,97%{transform:rotate(60deg)}100%{transform:rotate(0)}}
/* the picker: every helper, unnamed, then a name */
.ipsy-pick{display:grid;gap:10px;padding:12px;border-radius:18px;background:var(--glass,rgba(255,255,255,.6));border:1px solid var(--hair,rgba(16,24,26,.08))}
.ipsy-vintage .ipsy-pick{background:var(--mc-card-2,#F0E5D0);border:0}
.ipsy-pick>p{margin:0;font-size:14.5px;line-height:1.4}
.ipsy-who{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.ipsy-whobtn{border:0;border-radius:16px;padding:2px;background:var(--glass-2,rgba(255,255,255,.7));cursor:pointer;aspect-ratio:1;min-width:0;-webkit-tap-highlight-color:transparent}
.ipsy-vintage .ipsy-whobtn{background:var(--mc-card,#FBF5E9)}
.ipsy-whobtn[aria-checked="true"]{box-shadow:inset 0 0 0 2.5px var(--accent,#3B7366)}
.ipsy-vintage .ipsy-whobtn[aria-checked="true"]{box-shadow:inset 0 0 0 2.5px var(--mc-mustard,#E3A72F);background:color-mix(in srgb,var(--mc-mustard,#E3A72F) 26%,var(--mc-card,#FBF5E9))}
.ipsy-whobtn:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px}
.ipsy-whobtn .ipsy-host{width:100%;height:100%}
.ipsy-whobtn .h-armR{animation:none!important}
.ipsy-namel{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-name{font:inherit;font-size:16px;color:var(--text,#10181A);padding:10px 14px;border-radius:14px;background:var(--glass-2,rgba(255,255,255,.86));border:1px solid var(--hair,rgba(16,24,26,.1));min-width:0}
.ipsy-vintage .ipsy-name{background:var(--mc-card,#FBF5E9);border:2px solid var(--mc-edge,rgba(43,37,34,.14))}
.ipsy-name:disabled{opacity:.55}
.ipsy-name:focus{outline:2px solid var(--accent,#3B7366);outline-offset:1px}
.ipsy-picker{display:grid;gap:10px}
.ipsy-head h2 button{all:unset;cursor:pointer;display:block}
.ipsy-head h2 button:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px;border-radius:6px}
.ipsy-paused .ipsy-host *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.ipsy-host *,.ipsy-wrap *{animation:none!important;transition:none!important}}

.ipsy-wrap{position:fixed;inset:0;z-index:60}
.ipsy-wrap[hidden]{display:none}
.ipsy-scrim{position:absolute;inset:0;background:rgba(0,0,0,.22);animation:ipsyFade .3s both}
.ipsy-closing .ipsy-scrim{animation:ipsyFadeOut .22s ease-in both}
/* Ipsy itself, over the dark, where its button is (lifted above the keyboard); a tap puts the bubble away */
.ipsy-speaker{position:fixed;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transform:translateY(calc(-1 * var(--ipsy-kb,0px)));transition:transform .25s}
/* the chat: a speech bubble that pops out of Ipsy, its tail pointing back at it */
.ipsy-bubble{position:fixed;left:var(--bx,12px);bottom:calc(var(--by,96px) + var(--ipsy-kb,0px));width:var(--bw,360px);max-height:var(--bh,520px);display:flex;flex-direction:column;
  color:var(--text,#10181A);border-radius:26px;padding:10px 12px 12px;transform-origin:var(--tail,40px) calc(100% + 16px);animation:ipsyPop .46s cubic-bezier(.2,1.3,.35,1) both}
.ipsy-closing .ipsy-bubble{animation:ipsyShrink .22s ease-in both}
.ipsy-below .ipsy-bubble{bottom:auto;top:var(--bt,120px);transform-origin:var(--tail,40px) -16px}
.ipsy-below .ipsy-bubble::after{bottom:auto;top:-8px;border-radius:5px 0 0 0}
.ipsy-bubble::after{content:"";position:absolute;bottom:-8px;left:calc(var(--tail,40px) - 9px);width:18px;height:18px;transform:rotate(45deg);border-radius:0 0 5px 0}
.ipsy-glass .ipsy-bubble{background:var(--sheet,rgba(248,250,249,.94));-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);box-shadow:0 18px 50px rgba(0,0,0,.24),inset 0 0 0 1px rgba(255,255,255,.45)}
.ipsy-glass .ipsy-bubble::after{background:var(--sheet,rgba(248,250,249,.94))}
.ipsy-vintage .ipsy-bubble{background:var(--mc-card,#FBF5E9);box-shadow:0 0 0 3px var(--mc-mustard,#E3A72F),0 16px 34px rgba(43,37,34,.26)}
.ipsy-vintage .ipsy-bubble::after{background:var(--mc-card,#FBF5E9);box-shadow:3px 3px 0 0 var(--mc-mustard,#E3A72F)}
.ipsy-vintage.ipsy-below .ipsy-bubble::after{box-shadow:-3px -3px 0 0 var(--mc-mustard,#E3A72F)}
@keyframes ipsyPop{from{opacity:0;transform:scale(.12)}60%{opacity:1}}
@keyframes ipsyShrink{to{opacity:0;transform:scale(.12)}}
@keyframes ipsyFadeOut{to{opacity:0}}
.ipsy-head{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 0 0 4px}
.ipsy-head h2{flex:1;margin:0;font-size:17px;font-weight:700}
.ipsy-head h2 small:empty{display:none}
.ipsy-head h2 small{display:block;font-size:12px;font-weight:500;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-x,.ipsy-new{height:34px;border:0;border-radius:999px;padding:0 12px;font:inherit;font-size:14px;font-weight:600;color:var(--accent-text,var(--accent,#3B7366));background:var(--glass,rgba(127,127,127,.12));cursor:pointer}
.ipsy-vintage .ipsy-x,.ipsy-vintage .ipsy-new{background:transparent;box-shadow:inset 0 0 0 2px var(--mc-edge,rgba(43,37,34,.14));color:var(--mc-teal,#1F6F6B)}
.ipsy-x{width:34px;padding:0;font-size:18px;line-height:1}
.ipsy-hist{width:34px;height:34px;border:0;border-radius:999px;padding:0;display:grid;place-items:center;color:var(--accent-text,var(--accent,#3B7366));background:var(--glass,rgba(127,127,127,.12));cursor:pointer}
.ipsy-hist[hidden]{display:none}
.ipsy-hist svg{width:17px;height:17px}
.ipsy-hist[aria-expanded="true"]{box-shadow:inset 0 0 0 2px currentColor}
.ipsy-vintage .ipsy-hist{background:transparent;box-shadow:inset 0 0 0 2px var(--mc-edge,rgba(43,37,34,.14));color:var(--mc-teal,#1F6F6B)}
.ipsy-vintage .ipsy-hist[aria-expanded="true"]{background:var(--mc-teal,#1F6F6B);color:#fff;box-shadow:none}
.ipsy-hlist{display:grid;gap:8px;margin-bottom:auto}
.ipsy-hlist>p{margin:2px 4px;font-size:13px;font-weight:600;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-hrow{display:grid;gap:2px;text-align:left;border:1px solid var(--hair,rgba(16,24,26,.1));background:var(--glass,rgba(255,255,255,.6));color:var(--text,#10181A);font:inherit;padding:10px 12px;border-radius:16px;cursor:pointer}
.ipsy-hrow b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ipsy-hrow small{font-size:12px;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-vintage .ipsy-hrow{background:transparent;border:2px solid var(--mc-edge,rgba(43,37,34,.14))}
.ipsy-x:focus-visible,.ipsy-new:focus-visible,.ipsy-hist:focus-visible,.ipsy-hrow:focus-visible,.ipsy-send:focus-visible,.ipsy-chip:focus-visible,.ipsy-undo:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px}
.ipsy-log{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:8px;padding:14px 2px 10px;overscroll-behavior:contain}
.ipsy-msg{max-width:86%;padding:9px 13px;border-radius:18px;font-size:15px;line-height:1.42;overflow-wrap:anywhere;white-space:pre-wrap}
.ipsy-msg ul{margin:4px 0;padding-left:18px;white-space:normal}
.ipsy-msg a{color:inherit}
.ipsy-me{align-self:flex-end;border-bottom-right-radius:6px;background:var(--accent,#3B7366);color:var(--on-accent,#fff)}
.ipsy-vintage .ipsy-me{background:var(--mc-teal,#1F6F6B);color:#FBF5E9}
.ipsy-it{align-self:flex-start;border-bottom-left-radius:6px;background:var(--glass-2,rgba(255,255,255,.86));border:1px solid var(--hair,rgba(16,24,26,.08))}
.ipsy-vintage .ipsy-it{background:var(--mc-card-2,#F0E5D0);border:0}
.ipsy-src{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:12px;white-space:normal}
.ipsy-src a{color:var(--muted,rgba(16,24,26,.64))}
.ipsy-act{align-self:flex-start;font-size:13px;color:var(--muted,rgba(16,24,26,.64));padding:0 6px;display:flex;gap:6px;align-items:center}
.ipsy-act::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.6}
.ipsy-change{align-self:stretch;display:flex;align-items:center;gap:10px;font-size:13.5px;padding:8px 10px 8px 12px;border-radius:14px;
  background:color-mix(in srgb,var(--accent,#3B7366) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent,#3B7366) 30%,transparent)}
.ipsy-vintage .ipsy-change{background:color-mix(in srgb,var(--mc-mustard,#E3A72F) 22%,transparent);border-color:var(--mc-mustard,#E3A72F)}
.ipsy-change span{flex:1;min-width:0}
.ipsy-undo{border:0;background:none;font:inherit;font-weight:700;color:var(--accent-text,var(--accent,#3B7366));padding:6px 4px;cursor:pointer}
.ipsy-vintage .ipsy-undo{color:var(--mc-teal,#1F6F6B)}
.ipsy-change.undone{opacity:.6}.ipsy-change.undone span{text-decoration:line-through}
.ipsy-ask{align-self:stretch;display:grid;gap:10px;font-size:14.5px;line-height:1.4;padding:12px 12px 12px 14px;border-radius:16px;
  background:color-mix(in srgb,var(--accent,#3B7366) 9%,transparent);border:1.5px solid color-mix(in srgb,var(--accent,#3B7366) 45%,transparent)}
.ipsy-vintage .ipsy-ask{background:color-mix(in srgb,var(--mc-teal,#1F6F6B) 10%,transparent);border-color:var(--mc-teal,#1F6F6B)}
.ipsy-ask b{font-weight:700}
.ipsy-ask .ipsy-ans{display:flex;gap:8px;flex-wrap:wrap}
.ipsy-ask button{min-height:40px;padding:0 16px;border-radius:999px;font:inherit;font-weight:700;cursor:pointer;border:1.5px solid var(--accent,#3B7366);background:transparent;color:var(--accent-text,var(--accent,#3B7366))}
.ipsy-ask button[data-ans="yes"]{background:var(--accent,#3B7366);color:var(--on-accent,#fff)}
.ipsy-vintage .ipsy-ask button{border-color:var(--mc-teal,#1F6F6B);color:var(--mc-teal,#1F6F6B)}
.ipsy-vintage .ipsy-ask button[data-ans="yes"]{background:var(--mc-teal,#1F6F6B);color:#FBF5E9}
.ipsy-ask small{color:var(--muted,rgba(16,24,26,.64));font-size:13px}
.ipsy-err{align-self:stretch;font-size:14px;padding:10px 12px;border-radius:14px;color:var(--danger-ink,#AE2117);background:color-mix(in srgb,var(--danger,#E5281D) 10%,transparent)}
.ipsy-empty{margin:auto 0 6px;display:grid;gap:12px;font-size:15px;line-height:1.45}
.ipsy-empty p{margin:0;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-chips{display:flex;flex-wrap:wrap;gap:8px}
.ipsy-chip{border:1px solid var(--hair,rgba(16,24,26,.1));background:var(--glass,rgba(255,255,255,.6));color:var(--text,#10181A);font:inherit;font-size:14px;padding:8px 12px;border-radius:999px;cursor:pointer;text-align:left}
.ipsy-vintage .ipsy-chip{background:transparent;border:2px solid var(--mc-mustard,#E3A72F)}
.ipsy-consent{display:grid;gap:10px;padding:12px 14px;border-radius:16px;background:var(--glass,rgba(255,255,255,.6));border:1px solid var(--hair,rgba(16,24,26,.08));font-size:14px;line-height:1.45}
.ipsy-vintage .ipsy-consent{background:var(--mc-card-2,#F0E5D0);border:0}
.ipsy-consent p{margin:0;color:var(--text,#10181A)}
.ipsy-form{display:flex;gap:8px;align-items:flex-end;padding-top:6px}
.ipsy-in{flex:1;min-width:0;resize:none;max-height:120px;min-height:44px;padding:11px 14px;border-radius:22px;font:inherit;font-size:16px;line-height:1.35;color:var(--text,#10181A);
  background:var(--glass-2,rgba(255,255,255,.86));border:1px solid var(--hair,rgba(16,24,26,.1))}
.ipsy-vintage .ipsy-in{background:var(--mc-card-2,#F0E5D0);border:2px solid var(--mc-edge,rgba(43,37,34,.14))}
.ipsy-in:focus{outline:2px solid var(--accent,#3B7366);outline-offset:1px}
.ipsy-send{width:44px;height:44px;flex:none;border:0;border-radius:50%;background:var(--cta,var(--accent,#3B7366));color:var(--cta-ink,#10181A);font-size:20px;font-weight:700;cursor:pointer}
.ipsy-vintage .ipsy-send{background:var(--cta,#C24C28);color:var(--cta-ink,#FFF8EC)}
.ipsy-send:disabled{opacity:.45;cursor:default}
.ipsy-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes ipsyUp{from{transform:translateY(100%)}}
@keyframes ipsyFade{from{opacity:0}}
`;
  let styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    const defs = document.createElement('div');
    defs.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><linearGradient id="ipsyGlass" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#A9D3C7"/><stop offset=".45" stop-color="#B9C6E0"/><stop offset=".8" stop-color="#E3C5C3"/><stop offset="1" stop-color="#E9D6B4"/></linearGradient></defs></svg>';
    document.body.appendChild(defs.firstChild);
  }

  // ---------------------------------------------------------------------------
  // Words: Ipsy's replies, as text with **bold**, "- " lists and plain links
  // ---------------------------------------------------------------------------
  function rich(text) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?']/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (u.length > 48 ? '…' : '') + '</a>');
    const out = []; let list = null;
    String(text).trim().split('\n').forEach(line => {
      const m = /^\s*[-•*]\s+(.*)$/.exec(line);
      if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[1])); }
      else { list = null; out.push(inline(line)); }
    });
    return out.map(x => Array.isArray(x) ? '<ul>' + x.map(i => '<li>' + i + '</li>').join('') + '</ul>' : x).join('\n').replace(/\n?(<ul>)/g, '$1').replace(/(<\/ul>)\n?/g, '$1');
  }
  const ERRORS = {
    signin: 'Sign in with Face ID to chat with Ipsy.', 'accounts-off': 'Family sign-in isn’t switched on yet, so Ipsy can’t be used.',
    'no-ai': 'Ipsy isn’t set up yet: the owner needs to add the AI key.', limit: 'That’s a lot of questions for one day. Ipsy will be back tomorrow.',
    'ai-key': 'Anthropic didn’t accept the key. The owner can check it.', 'ai-busy': 'Claude is busy. Try again in a minute.',
    'ai-unreachable': 'Couldn’t reach Claude. Try again in a minute.', offline: 'No connection. Try again when you’re online.',
    'too-long': 'This chat is full. Tap New chat to keep going.', full: 'This chat is full. Tap New chat to keep going.',
    refused: 'Ipsy can’t help with that one.', steps: 'That took more steps than Ipsy is allowed for one question. Ask again with a little more detail.',
  };

  // ---------------------------------------------------------------------------
  // Settings Ipsy can change or show, in every app and in aOS (Claude's get_settings, change_setting and
  // open_setting: server/ipsy.js SETTINGS_TOOLS). The list is here, on the phone, and nothing outside it can
  // be changed, whatever a question, an email or a web page says. What's on it (aOS/RELEASING.md, "Ipsy and
  // settings"): how things look and read, for this person, and easy to put back (each with Undo); a few that
  // reach the family's settings or turn Ipsy's own access down ask first (ask: true). Never: sign-ins and
  // connections, the plan, anything that lets Ipsy or anyone see more, anything that deletes or moves the
  // family's things, and Meals' "Never in a plan" (the family's allergies): for those, open_setting shows where.
  // ---------------------------------------------------------------------------
  const SET_APPS = ['calendar', 'clock', 'drinks', 'fitness', 'house', 'mail', 'meals', 'news', 'notes', 'orders', 'places', 'podcasts', 'travel', 'weather'];
  const LOOKS = ['vintage', 'glass', 'neon', 'folk', 'grid'];
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const CLOCK = 'allison-clock-v1', CAL = 'allison-calendar-v1-settings', POD = 'allison-podcasts-v1', ORD = 'allison-orders-v1';
  const inObj = (key, path, def) => ({   // a value inside a JSON object in storage
    get: () => { let x = jget(key, {}); for (const p of path) x = x && typeof x === 'object' ? x[p] : undefined; return x === undefined ? def : x; },
    put: v => { const o = jget(key, {}) || {}; let x = o; path.slice(0, -1).forEach(p => { x = x[p] = x[p] && typeof x[p] === 'object' ? x[p] : {}; }); x[path[path.length - 1]] = v; jset(key, o); },
  });
  const raw = (key, def) => ({ get: () => ls.get(key, def), put: v => ls.set(key, String(v)) });
  // values: what Claude passes -> what's stored (and back, for get_settings)
  const choice = (pairs, store) => ({ values: Object.keys(pairs), to: v => pairs[v], from: s => Object.keys(pairs).find(k => String(pairs[k]) === String(s)), ...store });
  const onoff = store => choice({ on: true, off: false }, store);
  const range = (lo, hi, step, store) => ({ values: [lo + '-' + hi + ' in steps of ' + step], ok: v => Number.isFinite(+v) && +v >= lo && +v <= hi && (+v - lo) % step === 0, to: v => +v, from: s => String(s), ...store });
  const lookOf = id => (id === 'clock' ? ((jget(CLOCK, {}) || {}).set || {}).design : ls.get('design.' + id, '')) || 'vintage';
  function putLook(id, v) {   // an app's design; an open copy of it follows at once (design.js / clock/design.js: the storage event)
    if (id === 'clock') inObj(CLOCK, ['set', 'design']).put(v); else ls.set('design.' + id, v);
    if (id === pageApp()) { if (window.aosDesign) aosDesign.set(v); else if (window.clockDesign) clockDesign.set(v); }
  }
  const afterReply = [];   // what waits until Ipsy's answer has been read: the language, an app drawn again
  const pageApp = () => (window.aosDesign && aosDesign.app) || (window.aosLook ? 'aos' : '');
  const SETTINGS = {
    theme: { app: '*', live: true, about: 'Light or dark, for aOS and every app', ...choice({ auto: 'auto', light: 'light', dark: 'dark' }, {
      get: () => (AOS.welcome && AOS.welcome.theme ? AOS.welcome.theme.read() : 'auto'), put: v => AOS.welcome && AOS.welcome.theme && AOS.welcome.theme.set(v) }) },
    look: { app: '*', live: true, about: 'The look of aOS and every app: Vintage, Sea glass, Night Drive, Folk or Tron Special Edition', ...choice({ vintage: 'vintage', glass: 'glass', neon: 'neon', folk: 'folk', grid: 'grid' }, {
      get: () => ls.get('aos.look', 'vintage'),
      put: v => {   // every app, as aOS's own Look picker writes it (AllisonOS.welcome.data.APPS): Money and Sparkle too, not only the apps with settings here
        const all = (AOS.welcome && AOS.welcome.data && AOS.welcome.data.APPS) || SET_APPS;
        if (window.aosLook) return aosLook.set(v, { apps: all }); ls.set('aos.look', v); all.forEach(id => putLook(id, v)); } }) },
    language: { app: '*', live: true, about: 'The language of aOS and every app (drawn again in it after your reply)', ...choice({ en: 'en', ru: 'ru' }, {
      get: () => (window.aosLang ? aosLang.get() : 'en'), put: v => { for (let i = afterReply.length; i--;) if (afterReply[i].lang) afterReply.splice(i, 1); if (window.aosLang && v !== aosLang.get()) afterReply.push(Object.assign(() => aosLang.set(v), { lang: true })); } }) },
    favorites: { app: 'aos', about: 'The apps pinned in Favorites on aOS Home, up to 4, by id (' + SET_APPS.join(', ') + ')', values: ['a comma-separated list of up to 4 app ids'],
      ok: v => { const l = String(v).split(',').map(s => s.trim()).filter(Boolean); return l.length <= 4 && l.every(id => SET_APPS.includes(id)); },
      to: v => [...new Set(String(v).split(',').map(s => s.trim()).filter(Boolean))], from: s => (Array.isArray(s) ? s.join(',') : ''),
      get: () => jget('aos.home.picks', []), put: v => jset('aos.home.picks', v) },
    'calendar.week_start': { app: 'calendar', about: 'Calendar: the day weeks start on', ...choice({ sunday: 0, monday: 1 }, { get: inObj(CAL, ['weekStart'], 0).get, put: v => { inObj(CAL, ['weekStart']).put(v); inObj(CAL, ['weekStartPicked']).put(true); } }) },
    'calendar.time': { app: 'calendar', about: 'Calendar: 12- or 24-hour times (auto: as the language)', ...choice({ auto: 'auto', '12': '12', '24': '24' }, inObj(CAL, ['clock'], 'auto')) },
    'calendar.temperature': { app: 'calendar', about: 'Calendar: °F or °C on its weather', ...choice({ auto: 'auto', f: 'f', c: 'c' }, inObj(CAL, ['units'], 'auto')) },
    'calendar.day_view_opens_at': { app: 'calendar', about: 'Calendar: the hour Day view opens at (0-23)', ...range(0, 23, 1, inObj(CAL, ['dayStart'], 7)) },
    ...Object.fromEntries(['holidays', 'notes', 'travel', 'mail', 'fitness', 'drinks', 'weather'].map(l => ['calendar.show_' + l, { app: 'calendar', about: 'Calendar: show the ' + l + ' calendar', ...onoff(inObj(CAL, ['layers', l], l !== 'drinks')) }])),
    'calendar.new_event_length': { app: 'calendar', ask: true, about: 'Calendar: how long a new event is, in minutes', ...choice({ '15': 15, '30': 30, '45': 45, '60': 60, '90': 90, '120': 120 }, inObj(CAL, ['duration'], 60)) },
    'calendar.new_event_alert': { app: 'calendar', ask: true, about: 'Calendar: the alert a new event gets', ...choice({ none: '', at_start: 'PT0M', '5_min': '-PT5M', '10_min': '-PT10M', '15_min': '-PT15M', '30_min': '-PT30M', '1_hour': '-PT1H', '2_hours': '-PT2H', '1_day': '-P1D' }, inObj(CAL, ['alertTimed'], '-PT15M')) },
    'clock.24_hour': { app: 'clock', about: 'Clock: 24-hour time', ...onoff({ get: () => { const s = (jget(CLOCK, {}) || {}).set || {}; return s.h24Picked ? !!s.h24 : !!s.h24 || (window.aosLang && aosLang.get() === 'ru'); }, put: v => { inObj(CLOCK, ['set', 'h24']).put(v); inObj(CLOCK, ['set', 'h24Picked']).put(true); } }) },
    'clock.seconds': { app: 'clock', about: 'Clock: seconds on the Nightstand clock', ...onoff(inObj(CLOCK, ['set', 'secs'], false)) },
    'clock.face': { app: 'clock', about: 'Clock: the Nightstand clock face', ...choice({ digital: false, analog: true }, inObj(CLOCK, ['set', 'analog'], false)) },
    'weather.units': { app: 'weather', about: 'Weather (and Home\'s weather): °F, mph, in or °C, km/h, mm', ...choice({ us: 'us', metric: 'metric' }, { get: () => jget('wx.units', 'us'), put: v => jset('wx.units', v) }) },
    'podcasts.skip_back': { app: 'podcasts', about: 'Podcasts: seconds the skip-back button goes', ...choice({ '10': 10, '15': 15, '30': 30 }, inObj(POD, ['set', 'back'], 15)) },
    'podcasts.skip_forward': { app: 'podcasts', about: 'Podcasts: seconds the skip-forward button goes', ...choice({ '15': 15, '30': 30, '45': 45, '60': 60 }, inObj(POD, ['set', 'fwd'], 30)) },
    'podcasts.when_episode_ends': { app: 'podcasts', about: 'Podcasts: play the next episode or stop', ...choice({ play_next: true, stop: false }, inObj(POD, ['set', 'auto'], true)) },
    'fitness.step_goal': { app: 'fitness', about: 'Fitness: daily step goal', ...range(2000, 30000, 1000, raw('allison-fitness-v1-step-goal', '10000')) },
    'fitness.move_goal': { app: 'fitness', about: 'Fitness: daily move goal, kcal', ...range(100, 2000, 50, raw('allison-fitness-v1-move-goal', '500')) },
    ...Object.fromEntries([['pickup', 'store pickups'], ['food', 'food orders'], ['digital', 'subscriptions and digital'], ['other', 'tickets and other']].map(([k, n]) => ['orders.count_' + k, { app: 'orders', about: 'Orders: count ' + n + ' as orders', ...onoff(inObj(ORD, ['kinds', k], k === 'pickup')) }])),
    // Ipsy's own access: only ever turned down here (back on is in the app's Settings, by the person)
    ...Object.fromEntries(['orders', 'travel', 'calendar'].map(a => ['ipsy.gmail_' + a, { app: a, ask: true, about: 'Ipsy in ' + a + ': searching Gmail (can only be turned off here)', ...choice({ off: false }, { get: () => !!privacy.gmail(a), put: v => privacy.gmail(a, !!v) }), from: s => (s ? 'on' : 'off') }])),
    'orders.ipsy_keeps_orders_up_to_date': { app: 'orders', ask: true, about: 'Orders: Ipsy rereads and fixes orders by itself (can only be turned off here)', ...choice({ off: '0' }, raw(ORD + '-ipsy-auto', '')), from: s => (s === '1' ? 'on' : 'off') },
    'travel.ipsy_fills_in': { app: 'travel', ask: true, about: 'Travel: Ipsy fills in what\'s missing from bookings (can only be turned off here)', ...choice({ off: '0' }, raw('allison-travel-v1-ai-on', '1')), from: s => (s === '0' ? 'off' : 'on') },
    'travel.ipsy_checks_by_itself': { app: 'travel', ask: true, about: 'Travel: Ipsy checks new bookings by itself (can only be turned off here)', ...choice({ off: '0' }, raw('allison-travel-v1-ipsy-auto', '')), from: s => (s === '1' ? 'on' : 'off') },
    'helper.character': { app: '*', live: true, about: 'Your helper\'s look (' + WHO.map(w => w + ': ' + HELPERS[w].kind).join(', ') + ')', ...choice(Object.fromEntries(WHO.map(w => [w, w])), {
      get: () => (helper() || {}).who || '', put: v => setHelper(v, (helper() || {}).name || '') }) },
    'helper.name': { app: '*', live: true, keepCase: true, about: 'Your helper\'s name (Ipsy until it has one, up to 16 letters)', values: ['a name, up to 16 letters'], ok: v => v.length >= 1 && v.length <= 16, to: v => v, from: v => v,
      get: () => (helper() || {}).name || '', put: v => setHelper((helper() || {}).who || 'mia', v) },
    ...Object.fromEntries(SET_APPS.map(id => ['design_' + id, { app: id, live: true, about: 'Just ' + id + '\'s own design (look sets every app)', ...choice({ vintage: 'vintage', glass: 'glass', neon: 'neon', folk: 'folk', grid: 'grid' }, { get: () => lookOf(id), put: v => putLook(id, v) }) }])),
  };
  // where a setting is: each app's Settings (the button that opens it), and aOS's Account sections
  const OPENER = { calendar: '#setBtn', clock: '#setBtn', drinks: '#moreBtn', fitness: '#setBtn', house: '#gear', mail: '#gear', meals: '#setBtn', news: '#setBtn', notes: '#setBtn', orders: '#setBtn', places: '#setBtn', podcasts: '#setBtn', travel: '#setBtn', weather: '[data-action="location"]' };
  const ACCOUNT = { 'aos.helper': 'helper', 'aos.appearance': 'appearance', 'aos.notifications': 'notifications', 'aos.subscription': 'plan', 'aos.updates': 'updates', 'aos.lost_phone': 'lost', 'aos.replacing_phone': 'move', 'aos.owner_tools': 'owner', 'aos.account': '' };
  const aosTop = () => { try { return window.top !== window && window.top.aosHomeTab ? window.top : (window.aosHomeTab ? window : null); } catch { return window.aosHomeTab ? window : null; } };
  const shown = (id, s) => { const v = s.get(); return s.from ? (s.from(v) ?? v) : v; };
  function settingsTools(o, closeChat) {
    const later = fn => afterReply.push(fn);
    const here = o.app;
    return {
      get_settings: async () => ({ content: Object.entries(SETTINGS).map(([id, s]) => ({ id, now: shown(id, s), values: s.values, about: s.about, ...(s.ask ? { asks_first: true } : {}) })) }),
      change_setting: async ({ setting, value } = {}, { confirm }) => {
        const s = own(SETTINGS, setting) ? SETTINGS[setting] : null;
        if (!s) return { error: true, content: 'That isn\'t a setting Ipsy can change. Use open_setting to show the person where it is.' };
        value = String(value == null ? '' : value).trim().replace(/\s+/g, ' '); if (!s.keepCase) value = value.toLowerCase();
        if (s.ok ? !s.ok(value) : !s.values.includes(value)) return { error: true, content: `${setting} takes: ${s.values.join(', ')}.` };
        const was = s.get(), to = s.to(value);
        if (JSON.stringify(was) === JSON.stringify(to)) return { content: `${setting} is already ${value}.` };
        if (s.ask && !await confirm(`Change ${s.about.replace(/ \(.*\)$/, '')} to ${value}?`, { yes: 'Yes, change it', no: 'No' })) return { content: 'The person said no; nothing changed.' };
        const put = v => apply(s, () => s.put(v));
        await put(to);
        return { content: `Done: ${setting} is ${value}.` + (s.app === here && !s.live ? ' The app is drawn again with it after your reply.' : ''),
          change: { text: `${s.about.replace(/ \(.*\)$/, '')}: ${value}`, undo: () => put(was) } };
      },
      open_setting: async ({ place } = {}) => {
        const top = aosTop();
        if (own(ACCOUNT, place)) {
          if (!top || !top.aosAccount) return { error: true, content: 'This is in aOS (Account). Ask the person to open aOS, then their name at the top of Home.' };
          closeChat(); if (top !== window) top.aosHomeTab.show(null);
          top.aosAccount.open(ACCOUNT[place]);
          return { content: 'Opened ' + place.replace('aos.', 'aOS > Account > ').replace(/_/g, ' ') + '.' };
        }
        if (!own(OPENER, place)) return { error: true, content: 'No such place. Places: ' + [...Object.keys(ACCOUNT), ...SET_APPS].join(', ') + '.' };
        if (place === here) { closeChat(); const b = document.querySelector(OPENER[place]); if (b) b.click(); return { content: 'Opened Settings in this app.' }; }
        if (top) { closeChat(); top.aosHomeTab.openSettings(place, OPENER[place]); return { content: 'Opened ' + place + '\'s Settings in aOS.' }; }
        return { error: true, content: `Settings for ${place} are in that app: ask the person to open it from aOS and tap its Settings button.` };
      },
    };
    // a change reaches the app that keeps it: in aOS, an app open out of sight closes first (so it can't save its
    // old setting over the new one), then opens again; the app Ipsy is in is drawn again after Ipsy answers
    async function apply(s, write) {
      if (s.live || s.app === '*') return write();
      const top = aosTop();
      if (s.app === here && here !== 'aos') { write(); later(() => location.reload()); return; }
      if (top) return top.aosHomeTab.around([s.app], write);
      write();
    }
  }

  // ---------------------------------------------------------------------------
  // mount: the button, the chat bubble and the loop, for one app
  // ---------------------------------------------------------------------------
  function mount(o) {
    addStyle();
    // the app's tools, for Ipsy in aOS: aOS opens the app out of sight and runs them there (aOS/home-tab.js)
    AOS.ipsy.mounted = { app: o.app, name: o.name, tools: o.tools || {}, label: o.label, context: o.context };
    const K = { chat: 'ipsy.' + o.app + '.chat', ok: 'ipsy.' + o.app + '.ok', hist: 'ipsy.' + o.app + '.history', closed: 'ipsy.' + o.app + '.closed' };
    // Built in, in every app and in aOS: the language (../home/lang.js), for someone who switched to one they can't
    // read. Claude's set_language tool (server/ipsy.js LANG_TOOL) or just typing "English" / «Русский» (no question
    // used up, and before Ipsy is set up): aOS and every app are drawn again in it once Ipsy has answered.
    let langTo = null;
    const BUILT_IN = {
      set_language: async ({ lang } = {}) => {
        if (!window.aosLang) return { error: true, content: 'There is no language setting here.' };
        if (!LANG_NAME[lang]) return { error: true, content: 'lang must be "en" or "ru".' };
        if (lang === aosLang.get()) return { content: 'aOS is already in ' + (lang === 'ru' ? 'Russian.' : 'English.') };
        langTo = lang;
        return { content: 'Done: aOS and every app switch to ' + (lang === 'ru' ? 'Russian' : 'English') + ' as soon as your reply is shown. Reply in that language, in a line.',
          change: { text: LANG_NAME[lang], undo: () => { langTo = null; } } };
      },
      ...settingsTools(o, () => close()),   // the settings Ipsy may change or show (above)
    };
    let messages = [], view = [], busy = false, undos = new Map();
    let showing = false;                  // the list of recent chats is on screen instead of the chat
    const asks = new Map();               // questions waiting on a Yes or No: id -> resolve
    try { const saved = JSON.parse(ls.get(K.chat, 'null')); if (saved && Array.isArray(saved.messages) && Array.isArray(saved.view)) { messages = saved.messages; view = saved.view; } } catch {}

    // The button
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ipsy-btn'; follow(btn); btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="ipsy-host"></span>';
    if (o.slot) { o.slot.textContent = ''; o.slot.appendChild(btn); }
    else { btn.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:5'; document.body.appendChild(btn); }
    const btnCell = addCell(btn.firstChild);

    // The chat: a bubble that pops out of Ipsy
    const sub = o.subtitle != null ? o.subtitle : 'Your ' + (o.name || 'aOS') + ' helper';   // '' for none
    const wrap = document.createElement('div');
    wrap.className = 'ipsy-wrap'; follow(wrap); wrap.hidden = true;
    wrap.innerHTML = '<div class="ipsy-scrim" data-close></div>'
      + '<button class="ipsy-speaker ipsy-host" type="button" aria-label="Put Ipsy away" data-close></button>'
      + '<section class="ipsy-bubble" role="dialog" aria-modal="true" aria-labelledby="ipsyTitle">'
      + '<div class="ipsy-head"><h2 id="ipsyTitle"><button type="button" id="ipsyWho" aria-label="Your helper: change it or its name"><span id="ipsyNm" translate="no"></span></button><small id="ipsyStatus">' + esc(sub) + '</small></h2>'
      + '<button class="ipsy-hist" type="button" id="ipsyHist" aria-label="Recent chats" aria-expanded="false" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/></svg></button>'
      + '<button class="ipsy-new" type="button" id="ipsyNew">New chat</button><button class="ipsy-x" type="button" aria-label="Close" data-close>×</button></div>'
      + '<div class="ipsy-log" id="ipsyLog" aria-live="polite"></div>'
      + '<form class="ipsy-form" id="ipsyForm"><label class="ipsy-sr" for="ipsyIn">Message Ipsy</label>'
      + '<textarea class="ipsy-in" id="ipsyIn" rows="1" enterkeyhint="send" placeholder="' + esc(o.placeholder || 'Ask Ipsy') + '"></textarea>'
      + '<button class="ipsy-send" id="ipsySend" type="submit" aria-label="Send">↑</button></form></section>';
    document.body.appendChild(wrap);
    const $ = id => wrap.querySelector('#' + id);
    const log = $('ipsyLog'), input = $('ipsyIn'), sendBtn = $('ipsySend'), status = $('ipsyStatus');
    const speaker = wrap.querySelector('.ipsy-speaker'), peek = addCell(speaker);
    const mood = m => { setMood(peek, m); setMood(btnCell, m === 'listen' ? 'idle' : m); };
    const say = s => { status.textContent = s || sub; };
    // what the status line says while your helper does each job ("Mia is reading…")
    const DOING = { think: 'is thinking…', read: 'is reading…', scan: 'is searching…', write: 'is writing…', show: 'is showing you', done: 'is done' };
    const doing = job => 'Ipsy ' + (DOING[job] || DOING.think);   // home/lang.js says your helper's name in place of Ipsy, here and below
    const named = () => { $('ipsyNm').textContent = title(); btn.setAttribute('aria-label', 'Ask Ipsy'); input.placeholder = o.placeholder || 'Ask Ipsy'; };
    named();
    onHelper.add(() => { named(); if (!wrap.hidden && !busy) draw(); });
    $('ipsyWho').addEventListener('click', () => { if (busy || asks.size) return; showing = showing === 'pick' ? false : 'pick'; draw(); });

    // Where the bubble goes: Ipsy stands in for its button (the same cell, in the same place, over the
    // dark), and the bubble rises from just above its head, its tail pointing down at it.
    const vv = window.visualViewport;
    function place() {
      const r = btn.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      const kb = vv ? Math.max(0, H - vv.height - vv.offsetTop) : 0;
      const box = r.width ? r : { left: 12, top: H - 90, width: 62, height: 62 };
      Object.assign(speaker.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
      const w = Math.min(380, W - 24), cx = box.left + box.width / 2;
      const left = Math.max(12, Math.min(cx - 44, W - w - 12)), by = H - box.top + 2;
      // a button high on the page (aOS Home's): the bubble hangs below it instead, its tail pointing up.
      // Typing (the keyboard up, and iOS scrolling the page to the box), Ipsy goes to the top of what's
      // still in sight and the bubble fills the rest, down to the keyboard.
      const below = box.top + box.height / 2 < H * 0.45;
      const vTop = vv ? vv.offsetTop : 0, vH = vv ? vv.height : H, typing = kb > 40 || vTop > 0;
      const sTop = below && typing ? vTop + 10 : box.top, bt = sTop + box.height + 14;
      wrap.classList.toggle('ipsy-below', below);
      wrap.style.setProperty('--ipsy-kb', (below ? box.top - sTop : kb) + 'px');   // how far Ipsy rises
      wrap.style.setProperty('--bx', left + 'px'); wrap.style.setProperty('--by', by + 'px'); wrap.style.setProperty('--bw', w + 'px'); wrap.style.setProperty('--bt', bt + 'px');
      wrap.style.setProperty('--bh', (below ? Math.max(160, Math.min(560, vTop + vH - bt - 12)) : Math.max(220, Math.min(560, (H - kb) * 0.68, H - by - kb - 64))) + 'px');   // it grows with the chat, up to about two thirds of the screen
      wrap.style.setProperty('--tail', Math.max(22, Math.min(w - 22, cx - left)) + 'px');
    }
    let lastFocus = null, shut = 0;
    function open() {
      clearTimeout(shut); wrap.classList.remove('ipsy-closing');
      lastFocus = document.activeElement;
      place(); btn.style.visibility = 'hidden';
      wrap.hidden = false; document.documentElement.classList.add('locked');
      freshIfDone(); ls.del(K.closed);
      mood(busy ? peek.mood : 'idle'); showing = false; draw();
      setTimeout(() => { if (ls.get(K.ok, '')) input.focus(); }, 350);
    }
    function close() {
      if (wrap.hidden || wrap.classList.contains('ipsy-closing')) return;
      input.blur(); wrap.classList.add('ipsy-closing');
      const done = () => {
        wrap.hidden = true; wrap.classList.remove('ipsy-closing'); btn.style.visibility = '';
        if (!busy && !asks.size && view.length) ls.set(K.closed, String(Date.now()));   // done: put away in a minute (freshIfDone)
        if (![...document.querySelectorAll('.sheetwrap, .sheet-wrap')].some(w => !w.hidden)) document.documentElement.classList.remove('locked');   // an app's own sheet still open keeps the page dimmed
        if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
      };
      if (still()) done(); else shut = setTimeout(done, 220);
    }
    btn.addEventListener('click', open);
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) close(); });
    input.addEventListener('focus', () => { if (!busy) mood('listen'); });
    input.addEventListener('blur', () => { if (!busy) mood('idle'); });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });
    $('ipsyForm').addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('ipsyNew').addEventListener('click', () => { if (busy || asks.size) return; putAway(); showing = false; draw(); input.focus(); });
    $('ipsyHist').addEventListener('click', () => { if (busy || asks.size) return; showing = showing === true ? false : true; draw(); });

    // ---- Recent chats: the last five put away, newest first, on this phone ----
    // A chat's Undo buttons last while the page is open (the undos are kept by id), as in the chat itself.
    const HIST = 5, HIST_MAX = 600000;   // characters, for all five (the phone's storage is shared by every app)
    function recent() { try { const h = JSON.parse(ls.get(K.hist, '[]')); return Array.isArray(h) ? h : []; } catch { return []; } }
    function keepHistory(list) {
      // Too much to keep: the oldest goes first; one chat too long on its own is kept to read, without what Claude needs to carry on.
      list = list.slice(0, HIST);
      while (list.length) {
        const str = JSON.stringify(list);
        if (str.length <= HIST_MAX && ls.set(K.hist, str)) return;
        if (list.length > 1) list.pop(); else if (list[0].messages) delete list[0].messages; else break;
      }
      ls.del(K.hist);
    }
    const titleOf = v => { const m = v.find(x => x.t === 'me') || v.find(x => x.text); return m ? String(m.text).replace(/\s+/g, ' ').slice(0, 80) : 'Chat'; };
    // Closed for a minute (or more, the app since closed), a finished chat is put away: Ipsy opens with a new one.
    const GRACE = 60 * 1000;
    function freshIfDone() { const at = +ls.get(K.closed, 0); if (at && Date.now() - at > GRACE && !busy && !asks.size) { putAway(); ls.del(K.closed); } }
    function putAway() {
      if (!view.length) return;
      keepHistory([{ at: Date.now(), title: titleOf(view), messages, view }, ...recent()]);
      messages = []; view = []; persist();
    }
    function bringBack(i) {
      const h = recent(), c = h[i]; if (!c) return;
      h.splice(i, 1);
      if (view.length) h.unshift({ at: Date.now(), title: titleOf(view), messages, view });
      keepHistory(h);
      messages = Array.isArray(c.messages) ? c.messages : []; view = Array.isArray(c.view) ? c.view : [];
      if (!c.messages) view = view.concat({ t: 'act', text: 'This chat was too long to keep whole: a new question starts afresh.' });
      persist(); showing = false; draw();
    }
    const whenSaid = at => {
      const d = new Date(at), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), n = Math.round((day(now) - day(d)) / 864e5);
      return n === 0 ? 'Today, ' + t : n === 1 ? 'Yesterday, ' + t : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    // The keyboard, a turned phone: Ipsy and its bubble move up above the keyboard, and fit the screen.
    const refit = () => { if (!wrap.hidden) place(); };
    if (vv) { vv.addEventListener('resize', refit); vv.addEventListener('scroll', refit); }
    window.addEventListener('resize', refit);

    // What's in the chat, drawn from `view` (what the person saw), not from the raw messages.
    function pickCard(first) {
      const h = helper();
      return '<div class="ipsy-pick" id="ipsyPick"><p><b>' + (first ? 'Who’s your helper?' : 'Your helper') + '</b> ' + (first ? 'Pick one and give it a name. Change either any time: tap its name up here, or in aOS, Account.' : 'Pick another, or change its name.') + '</p>'
        + pickerHtml('ipsyPickName', h) + '<button class="ipsy-chip" type="button" id="ipsyPickDone"' + (h ? '' : ' disabled') + '>Done</button></div>';
    }
    function bindPick() {
      const el = $('ipsyPick'); if (!el) return;
      const p = bindPicker(el, () => { $('ipsyPickDone').disabled = false; });
      $('ipsyPickDone').addEventListener('click', () => { if (!p.who()) return; setHelper(p.who(), p.name()); showing = false; draw(); setTimeout(() => input.focus(), 50); });
      el.querySelector('.ipsy-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('ipsyPickDone').click(); } });
    }
    function draw() {
      const ok = !!ls.get(K.ok, ''), past = recent(), hb = $('ipsyHist');
      hb.hidden = !past.length && showing !== true; hb.setAttribute('aria-expanded', String(showing === true));
      if (showing === 'pick') {
        log.innerHTML = pickCard(false); bindPick();
        input.disabled = true; sendBtn.disabled = true; log.scrollTop = 0;
        return;
      }
      if (showing) {
        log.innerHTML = '<div class="ipsy-hlist"><p>Recent chats</p>' + (past.length ? past.map((c, i) => '<button class="ipsy-hrow" type="button" data-hist="' + i + '"><b translate="no">' + esc(c.title) + '</b><small>' + esc(whenSaid(c.at)) + '</small></button>').join('')
          : '<p>No earlier chats yet.</p>') + '</div>';
        input.disabled = true; sendBtn.disabled = true; log.scrollTop = 0;
        return;
      }
      let h = '';
      if (!view.length) {
        if (!helper()) {   // no helper yet: pick one first; the chat starts once it's picked
          log.innerHTML = '<div class="ipsy-empty">' + pickCard(true) + '</div>'; bindPick();
          input.disabled = true; sendBtn.disabled = true; log.scrollTop = 0;
          return;
        }
        h = '<div class="ipsy-empty">' + (o.intro === '' ? '' : '<p>' + esc(o.intro || 'Hi! Ask me anything.') + '</p>')
          + (ok ? '<div class="ipsy-chips">' + (o.suggestions || []).map(s => '<button class="ipsy-chip" type="button" data-ask="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>'
            : '<div class="ipsy-consent"><p>' + esc(o.consent || '') + '</p><button class="ipsy-chip" type="button" id="ipsyOk">OK, let’s go</button></div>') + '</div>';
      }
      h += view.map(item).join('');
      log.innerHTML = h; bindPick();
      input.disabled = !ok; sendBtn.disabled = !ok || busy;
      log.scrollTop = log.scrollHeight;
    }
    function item(v, i) {
      if (v.t === 'me') return '<div class="ipsy-msg ipsy-me" translate="no">' + esc(v.text) + '</div>';
      if (v.t === 'it') return '<div class="ipsy-msg ipsy-it" translate="no">' + rich(v.text) + (v.src && v.src.length ? '<div class="ipsy-src">' + v.src.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + '</a>').join('') + '</div>' : '') + '</div>';
      if (v.t === 'act') return '<div class="ipsy-act">' + esc(v.text) + '</div>';
      if (v.t === 'change') return '<div class="ipsy-change' + (v.undone ? ' undone' : '') + '"><span>' + esc(v.text) + '</span>' + (!v.undone && undos.has(v.id) ? '<button class="ipsy-undo" type="button" data-undo="' + esc(v.id) + '">Undo</button>' : '') + '</div>';
      if (v.t === 'err') return '<div class="ipsy-err" role="alert">' + esc(v.text) + '</div>';
      if (v.t === 'ask') return '<div class="ipsy-ask" role="group" aria-label="Ipsy is asking first"><span>' + rich(v.text) + '</span>'
        + (v.state === 'yes' ? '<small>You said yes.</small>' : v.state === 'no' ? '<small>You said no, so nothing changed.</small>'
          : asks.has(v.id) ? '<div class="ipsy-ans"><button type="button" data-ans="yes" data-q="' + esc(v.id) + '">' + esc(v.yes) + '</button><button type="button" data-ans="no" data-q="' + esc(v.id) + '">' + esc(v.no) + '</button></div>'
          : '<small>Not answered, so nothing changed.</small>') + '</div>';
      return '';
    }
    log.addEventListener('click', e => {
      const ans = e.target.closest('[data-ans]');
      if (ans) {
        const id = ans.dataset.q, done = asks.get(id), v = view.find(x => x.id === id);
        if (!done || !v) return;
        asks.delete(id); v.state = ans.dataset.ans; persist(); draw(); done(v.state === 'yes'); return;
      }
      const hr = e.target.closest('[data-hist]'); if (hr) { bringBack(+hr.dataset.hist); input.focus(); return; }
      const ask = e.target.closest('[data-ask]'); if (ask) { input.value = ask.dataset.ask; submit(); return; }
      if (e.target.closest('#ipsyOk')) { ls.set(K.ok, '1'); draw(); input.focus(); return; }
      const u = e.target.closest('[data-undo]');
      if (u) {
        const fn = undos.get(u.dataset.undo), v = view.find(x => x.id === u.dataset.undo);
        if (!fn || !v || u.disabled) return;
        // An undo may go to a server (Meals'): it only says Undone once that has worked.
        u.disabled = true; u.textContent = 'Undoing…';
        Promise.resolve().then(fn).then(
          () => { v.undone = true; undos.delete(v.id); add({ t: 'act', text: 'Undone: ' + v.text }); },
          err => add({ t: 'err', text: 'Couldn’t undo that: ' + (err && err.message || err) }))
          .then(() => { persist(); draw(); });
      }
    });
    function add(v) { view.push(v); if (!wrap.hidden) { if (showing) { showing = false; draw(); return; } log.insertAdjacentHTML('beforeend', item(v)); log.scrollTop = log.scrollHeight; } }
    function persist() {
      // A chat too big to keep is kept on screen only (the phone's storage is shared by every app).
      const s = JSON.stringify({ messages, view });
      if (s.length > 1.5e6 || !ls.set(K.chat, s)) ls.del(K.chat);
    }

    // One step: the conversation to the app's route, Claude's answer back.
    async function step() {
      const body = JSON.stringify({ messages });
      if (body.length > MAX_CHAT) throw Object.assign(new Error('full'), { code: 'full' });
      const opts = { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(o.headers || {}) }, body };
      const acct = AOS.account;
      let r;
      try { r = acct ? await acct.fetch(o.endpoint, opts) : await fetch(o.endpoint, opts); }
      catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
      let j = null; try { j = await r.json(); } catch {}
      if (!r.ok || !j) throw Object.assign(new Error((j && (j.why || j.error)) || 'http-' + r.status), { code: (j && j.error) || (r.status === 404 ? 'no-ai' : 'server'), why: j && j.why });
      return j;
    }
    // A tool that changes something the person should approve first (Calendar's events) asks here:
    // a card in the chat with exactly what will change, and Yes / No buttons. Nothing happens until a
    // button is tapped; the tool gets true for Yes, false for No.
    function confirm(text, opt = {}) {
      const id = uid('q');
      return new Promise(resolve => {
        asks.set(id, resolve);
        if (wrap.hidden) open();
        add({ t: 'ask', id, text: String(text), yes: opt.yes || 'Yes, do it', no: opt.no || 'No' });
        mood('listen'); say('Waiting for your answer…');
      }).then(ok => { mood('write'); say(doing('write')); return ok; });
    }
    async function runTool(u) {
      const fn = BUILT_IN[u.name] || (o.tools && o.tools[u.name]);
      if (!fn) return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'No such tool here.' };
      try {
        const res = await fn(u.input || {}, { confirm }) || {};
        if (res.change && res.change.text) {
          const id = uid('c');
          if (typeof res.change.undo === 'function') undos.set(id, res.change.undo);
          add({ t: 'change', id, text: res.change.text });
        }
        let text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content == null ? { ok: true } : res.content);
        if (text.length > MAX_RESULT) text = text.slice(0, MAX_RESULT) + '\n[cut off here: ask for less at a time]';
        return { type: 'tool_result', tool_use_id: u.id, content: text, ...(res.error ? { is_error: true } : {}) };
      } catch (err) {
        return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(err && err.message || err).slice(0, 500) };
      }
    }
    // Claude's words, with the web pages it cited.
    function words(content) {
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      const src = [], seen = new Set();
      content.forEach(b => (b.type === 'text' && Array.isArray(b.citations) ? b.citations : []).forEach(c => {
        if (c && c.url && /^https?:/.test(c.url) && !seen.has(c.url) && src.length < 4) { seen.add(c.url); src.push({ url: c.url, title: String(c.title || '').slice(0, 60) }); }
      }));
      return { text, src };
    }
    async function reveal(v) {
      // The answer appears a little at a time while Ipsy talks.
      // The chat keeps the whole answer from the start; only the bubble on screen fills in, and
      // if the chat is redrawn meanwhile (an Undo tapped, the chat closed) it simply shows it all.
      mood('talk');
      if (still() || wrap.hidden || v.text.length < 2) { add(v); return; }
      view.push(v);
      log.insertAdjacentHTML('beforeend', item({ ...v, text: '', src: [] }));
      const el = log.lastElementChild;
      for (let i = 0; i < v.text.length && el.isConnected; i += 3) {
        el.innerHTML = rich(v.text.slice(0, i + 3));
        log.scrollTop = log.scrollHeight;
        await new Promise(r => setTimeout(r, 12));
      }
      if (el.isConnected) { el.outerHTML = item(v); log.scrollTop = log.scrollHeight; }
    }
    const today = () => {
      const d = new Date(), p = n => String(n).padStart(2, '0');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' (' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ')';
    };
    const ACT_WEB = { web_search: i => 'Searching the web' + (i && i.query ? ': ' + i.query : ''), web_fetch: i => 'Reading ' + (i && i.url ? String(i.url).replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'a web page') };

    async function submit() {
      const text = input.value.trim();
      const want = langAsked(text);
      if (want && !busy && window.aosLang) {   // "English", «Русский», "switch to English": at once, with no question to Claude
        input.value = ''; input.style.height = '';
        add({ t: 'me', text });
        if (want === aosLang.get()) add({ t: 'it', text: want === 'ru' ? 'aOS уже на русском.' : 'aOS is already in English.' });
        else { add({ t: 'it', text: want === 'ru' ? 'Переключаю aOS на русский…' : 'Switching aOS to English…' }); persist(); setTimeout(() => aosLang.set(want), 900); }
        persist(); return;
      }
      if (!text || busy || !ls.get(K.ok, '')) return;
      input.value = ''; input.style.height = '';
      busy = true; sendBtn.disabled = true;
      const mark = messages.length;          // where this question starts, to go back to if it fails
      let ctx = ''; try { ctx = o.context ? o.context() : ''; } catch {}
      const ru = window.aosLang && aosLang.get() === 'ru' ? ' The person has aOS in Russian: answer in Russian.' : '';   // ../home/lang.js
      const me = helper(), who = me ? ' You are this person’s helper, ' + (me.name.trim() ? 'named ' + me.name.trim() + ', ' : '') + 'drawn as ' + HELPERS[me.who].kind + '.' : '';
      messages.push({ role: 'user', content: [{ type: 'text', text: '[From the app: today is ' + today() + '.' + (ctx ? ' ' + ctx : '') + ru + who + ']' }, { type: 'text', text }] });
      add({ t: 'me', text });
      let failed = null;
      try {
        for (let n = 0; ; n++) {
          if (n >= MAX_STEPS) throw Object.assign(new Error('steps'), { code: 'steps' });
          if (!n) { mood('think'); say(doing('think')); }
          const res = await step();
          if (res.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { code: 'refused' });
          const content = Array.isArray(res.content) ? res.content : [];
          if (!content.length) throw Object.assign(new Error('empty'), { code: 'server' });
          messages.push({ role: 'assistant', content });
          content.forEach(b => { if (b.type === 'server_tool_use' && ACT_WEB[b.name]) add({ t: 'act', text: ACT_WEB[b.name](b.input) }); });
          const w = words(content);
          const uses = content.filter(b => b.type === 'tool_use');
          if (w.text) await reveal({ t: 'it', text: w.text, src: w.src });
          if (res.stop_reason === 'pause_turn') continue;                    // Anthropic paused a long search: carry on
          if (res.stop_reason === 'tool_use' && uses.length) {
            uses.forEach(u => { const l = BUILT_LABEL[u.name] || (o.label ? o.label(u.name, u.input || {}) : ''); if (l) add({ t: 'act', text: l }); });
            const results = [], changes = view.filter(v => v.t === 'change').length;
            for (const u of uses) { const job = jobOf(u.name); mood(job); say(doing(job)); results.push(await runTool(u)); }   // one at a time: they share the app's data
            if (view.filter(v => v.t === 'change').length > changes) { mood('done'); say(doing('done')); }   // a change saved: a hop while Claude carries on
            messages.push({ role: 'user', content: results });
            persist();
            continue;
          }
          if (res.stop_reason === 'max_tokens' && !w.text) throw Object.assign(new Error('server'), { code: 'server' });
          break;
        }
      } catch (e) {
        failed = e;
        if (!e.code) console.warn('Ipsy:', e);         // a fault here, not an answer that said no
      }
      if (failed) {
        // Back to before the question: the changes its tools made stay (each with its Undo),
        // and the conversation stays one Claude can carry on from.
        messages.length = mark;
        const code = failed.code || 'server';
        add({ t: 'err', text: ERRORS[code] || ('Something went wrong' + (failed.why ? ': ' + failed.why : '') + '. Try again in a minute.') });
        if (code === 'full') { /* nothing more to say */ }
      }
      busy = false; persist(); mood(document.activeElement === input ? 'listen' : 'idle'); say(''); draw();
      if (langTo) { const l = langTo; langTo = null; afterReply.push(() => aosLang.set(l)); }
      if (afterReply.length) { const run = afterReply.splice(0); setTimeout(() => run.forEach(f => f()), 1600); }   // after the answer has been read
    }

    // ---- For the app: Ipsy doing things by itself (Orders and Travel check their "To check" items) ----
    let hintEl = null, hintTimer = 0;
    function hint(text, onTap, ms = 9000) {
      // A small speech bubble beside Ipsy's button, while the chat is closed; a tap opens the chat (or onTap).
      if (!wrap.hidden && !wrap.classList.contains('ipsy-closing')) return;   // the chat is open: it's said there
      if (hintEl) hintEl.remove();
      clearTimeout(hintTimer);
      const r = btn.getBoundingClientRect(); if (!r.width) return;   // (still laid out while the chat is open: only hidden)
      const el = hintEl = document.createElement('button');
      el.type = 'button'; el.className = 'ipsy-hint'; follow(el); el.textContent = text;
      el.style.left = (r.right - 4) + 'px'; el.style.bottom = (window.innerHeight - r.top - 6) + 'px';
      el.addEventListener('click', () => { gone(); (onTap || open)(); });
      document.body.appendChild(el);
      const gone = () => { if (el !== hintEl) return; hintEl = null; el.classList.add('out'); setTimeout(() => el.remove(), still() ? 0 : 200); };
      hintTimer = setTimeout(gone, ms);
      setMood(btnCell, 'talk'); setTimeout(() => { if (!busy) setMood(btnCell, 'idle'); }, 1400);
    }
    return {
      open, close, get busy() { return busy; },
      hint,
      ask: (text, opt) => confirm(text, opt).then(ok => { if (!busy) { mood(document.activeElement === input ? 'listen' : 'idle'); say(''); } return ok; }),
      // A line in the chat, or a change with its Undo, from work the app did with Ipsy outside a question.
      note: text => { if (wrap.hidden) freshIfDone(); add({ t: 'act', text }); persist(); },
      change: (text, undo) => {
        if (wrap.hidden) freshIfDone();
        const id = uid('c');
        if (typeof undo === 'function') undos.set(id, undo);
        add({ t: 'change', id, text }); persist();
      },
      // Ipsy at work in its corner (its button's mood) while the app does something for it.
      working: on => { if (!busy) setMood(btnCell, on ? 'work' : 'idle'); },
      // Open the chat and ask a question, as if typed (an app's "Ask Ipsy about this" button).
      prompt: text => { open(); if (busy || !ls.get(K.ok, '')) { input.value = text; return; } input.value = text; submit(); },
    };
  }

  // A helper on its own, for a page that only shows Ipsy (aOS's Meet Ipsy card and page):
  //   const c = AllisonOS.ipsy.character(host, { look: 'vintage', mood: 'idle', who: 'fox' })
  //   c.mood('read'); c.who('owl'); c.look('glass')
  // who: one of the helpers; none: the person's own (the helpers taking turns until they pick one).
  function character(host, o = {}) {
    addStyle();
    host.classList.add('ipsy-host');
    const setLook = l => dress(host, l);
    if (o.look) setLook(o.look); else follow(host);
    const c = addCell(host, { who: HELPERS[o.who] ? o.who : '' });
    setMood(c, o.mood || 'idle');
    return {
      mood: m => setMood(c, m),
      who: w => { if (HELPERS[w]) { c.fixed = true; drawChar(c, w); } },
      look: setLook,
    };
  }

  // Private: what the person keeps from Ipsy. A note, an order, a booking or an event can be marked
  // Private in its app: the app's tools leave it out of everything they read, out of context() and
  // out of the work Ipsy does by itself, and can't change it. It still syncs as usual: Private only
  // hides it from Ipsy. These are the parts the apps share:
  //   privacy.gmail(app)          -> false once Ipsy's Gmail is turned off in that app's Settings (this phone)
  //   privacy.gmail(app, on)         turns it on or off
  //   privacy.gmailOff(name)      -> what a Gmail tool answers while it's off
  //   privacy.guard(keys)         -> { hides(msg, text) }. keys: the private items' emails,
  //                                  [{ msgId, threadId, words: [order number, tracking, confirmation…] }].
  //                                  An email is hidden if it is one of them, is in one of their threads,
  //                                  or names one of their numbers in its subject, sender, snippet or text.
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const privacy = {
    gmail(app, on) {
      const k = 'ipsy.' + app + '.gmail';
      if (on === undefined) return ls.get(k, '') !== 'off';
      if (on) ls.del(k); else ls.set(k, 'off');
      return !!on;
    },
    gmailOff: name => 'The person has turned off Gmail for Ipsy in ' + name + ' (Settings, Ipsy), so Ipsy can’t search or read email here. Don’t try again; you can tell them it can be turned back on there.',
    guard(keys) {
      const ids = new Set(), threads = new Set(), nums = new Set(), codes = new Set();
      (keys || []).forEach(k => {
        if (!k) return;
        if (k.msgId) ids.add(String(k.msgId));
        if (k.threadId) threads.add(String(k.threadId));
        (k.words || []).forEach(w => {
          const n = norm(w);
          if (/\d/.test(n) ? n.length >= 5 : n.length >= 6) (/\d/.test(n) ? nums : codes).add(n);   // a number, or a code of letters (a booking reference)
        });
      });
      return {
        hides(m, text) {
          if (!m) return false;
          if (ids.has(String(m.id)) || (m.threadId && threads.has(String(m.threadId)))) return true;
          if (!nums.size && !codes.size) return false;
          const heads = ((m.payload && m.payload.headers) || []).filter(h => /^(subject|from)$/i.test(h.name)).map(h => h.value);
          const raw = [m.subject, m.from, m.snippet, ...heads, text].filter(Boolean).join(' ').toLowerCase();
          const flat = norm(raw);
          for (const n of nums) if (flat.includes(n)) return true;               // 112-1234567 matches 1121234567
          const words = new Set(raw.split(/[^a-z0-9]+/));
          for (const c of codes) if (words.has(c)) return true;                  // a code of letters only as a word of its own
          return false;
        },
      };
    },
  };

  // helper(): { who, name } or null; helpers: [{ id, kind }]; picker(host): pick and name it (aOS Account); cross(slot, d): across aOS Home's bar
  AOS.ipsy = { mount, character, privacy, wear, helper, setHelper, picker, cross, jobOf, helpers: WHO.map(id => ({ id, kind: HELPERS[id].kind, label: HELPERS[id].label })), name: helperName,
    look: LOOK, settings: () => Object.keys(SETTINGS) };   // look(): 'vintage' | 'glass' | 'neon' | 'folk' | 'grid'
})();
