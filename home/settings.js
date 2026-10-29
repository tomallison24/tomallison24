// Settings, the same in every aOS app: its look (CSS, below) and the rows, so every app's Settings has the
// same sections, rows and words (.claude/skills/new-aos-app/SKILL.md, "Settings"). Each app loads it before
// its own script (and lists it in its sw.js SHELL):
//
//   <script src="../home/settings.js"></script>
//
// and builds its sheet's body from sections of rows (strings of HTML, put in with innerHTML):
//
//   const S = AllisonOS.settings;
//   body.innerHTML = S.section('AI helper', [
//       S.claude('travel'),   // Use Claude in Travel, on this phone: first in every AI helper section
//       S.toggle({ id: 'stAi', title: 'Ipsy fills in what’s missing', sub: 'Completes new bookings from their emails.', on: true }),
//       S.action({ id: 'stScan', icon: 'refresh', title: 'Check now', sub: 'Last checked 5 minutes ago.' }),
//     ], { hint: 'Models: Check Haiku 5.5.' });
//
// Every row takes { id, title, sub, disabled, data: { key: value } } (data-* attributes); titles and subs are
// plain text (escaped here), or html: true to pass them as they are. A switch is aria-checked; S.flip(button)
// turns it and says what it is now. A danger row asks again: S.armed(button) is true on the second tap.
// The words: Design · the app's own · Connected accounts · AI helper · Notifications · Your data · Family account,
// in that order; one sentence under a row at most, ending with a full stop; never "On." or "Off." in the words.
(() => {
  'use strict';
  const A = (window.AllisonOS = window.AllisonOS || {});
  if (A.settings) return;
  // The look, added to the page as a <style> (the pages take inline styles only, as with ../home/design.js).
  const CSS = `
/* Settings, the same in every aOS app: the sections, the rows and the switch (home/settings.js writes them,
   .claude/skills/new-aos-app/SKILL.md says how an app uses them). Learn it in one app and every app works
   the same way.

   A sheet's body is sections, in this order, each one only where the app has it:
     Design · the app's own · Connected accounts · AI helper · Notifications · Your data · Family account
   A section is a label, a group of rows, and at most one line under it. A row is one of:
     switch (st-switch)   on or off: the name, a sentence under it saying what it does, the switch
     choice (st-choice)   two or three options: a segmented control under the name
     select (st-select)   four or more: the name, the value on the right
     nav (st-nav)         opens more: the name, the value, a chevron
     action (st-act)      does something: an icon and a verb, in the accent colour
     danger (st-danger)   deletes or signs out: in red, and it asks again (a second tap)
     info (st-info)       says how things stand: no tap
     input (st-input)     something to type
   Sea glass first; Vintage after it; Layers and Tron are generated from Vintage at the end of this file by
   aOS/scripts/make-looks.mjs (don't edit those by hand). The font is the page's own. */

/* ---- Sea glass ---- */
:root { --st-card: rgba(255,255,255,.72); --st-edge: rgba(16,24,26,.08); --st-text: #10181A; --st-muted: rgba(16,24,26,.62);
  --st-rule: rgba(16,24,26,.08); --st-accent: #3B7366; --st-danger: #B3261E; --st-on: #34C759; --st-off: rgba(16,24,26,.34);
  --st-knob: #FFFFFF; --st-glow: rgba(52,199,89,.35); --st-seg: rgba(118,118,128,.12); --st-seg-on: #FFFFFF; --st-press: rgba(118,118,128,.1) }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --st-card: rgba(255,255,255,.06); --st-edge: rgba(255,255,255,.09);
  --st-text: #EEF4F2; --st-muted: rgba(238,244,242,.58); --st-rule: rgba(255,255,255,.07); --st-accent: #A9D3C7; --st-danger: #F2B8B5;
  --st-off: rgba(238,244,242,.4); --st-knob: #FFFFFF; --st-seg: rgba(255,255,255,.08); --st-seg-on: rgba(255,255,255,.18); --st-press: rgba(255,255,255,.06) } }
:root[data-theme="dark"] { --st-card: rgba(255,255,255,.06); --st-edge: rgba(255,255,255,.09);
  --st-text: #EEF4F2; --st-muted: rgba(238,244,242,.58); --st-rule: rgba(255,255,255,.07); --st-accent: #A9D3C7; --st-danger: #F2B8B5;
  --st-off: rgba(238,244,242,.4); --st-knob: #FFFFFF; --st-seg: rgba(255,255,255,.08); --st-seg-on: rgba(255,255,255,.18); --st-press: rgba(255,255,255,.06) }

/* ---- the shapes, the same in every look ---- */
.st-sec { margin: 0 0 22px; color: var(--st-text) }
.st-sec:last-child { margin-bottom: 0 }
.st-sec[hidden], .st-row[hidden] { display: none }
.st-lbl { margin: 0 8px 8px; font-size: 12px; font-weight: 600; line-height: 1.2; letter-spacing: .12em; text-transform: uppercase; color: var(--st-muted) }
.st-group { border-radius: 20px; background: var(--st-card); box-shadow: inset 0 0 0 1px var(--st-edge); overflow: hidden }
html[data-look="glass"] .st-group, html[data-look="layers"] .st-group { -webkit-backdrop-filter: blur(18px) saturate(150%); backdrop-filter: blur(18px) saturate(150%) }
.st-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; margin: 0; padding: 11px 14px 11px 16px; border: 0;
  background: none; text-align: left; font: inherit; font-size: 16px; font-weight: 600; line-height: 1.25; color: var(--st-text); -webkit-tap-highlight-color: transparent }
.st-row + .st-row { border-top: 1px solid var(--st-rule) }
button.st-row { cursor: pointer }
button.st-row:not(:disabled):active { background: var(--st-press) }
.st-row:focus-visible, .st-seg button:focus-visible, .st-field:focus-visible { outline: 2px solid var(--st-accent); outline-offset: -2px }
.st-row:disabled, .st-row[aria-disabled="true"] { opacity: .5; cursor: default }
.st-text { flex: 1; min-width: 0 }
.st-title { display: block; overflow-wrap: anywhere }
.st-sub { display: block; margin-top: 2px; font-size: 13px; font-weight: 400; line-height: 1.35; color: var(--st-muted) }
.st-val { flex: none; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 400; color: var(--st-muted) }
.st-ic { flex: none; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round }
.st-chev { flex: none; width: 8px; height: 13px; fill: none; stroke: var(--st-muted); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round }
.st-act { color: var(--st-accent) }
.st-danger { color: var(--st-danger) }
.st-act .st-sub, .st-danger .st-sub { color: var(--st-muted) }
.st-hint { margin: 8px 10px 0; font-size: 12.5px; line-height: 1.4; color: var(--st-muted) }
.st-hint:empty { display: none }
.st-raw { display: block; padding: 0 }

/* a choice of two or three: the name, then a segmented control */
.st-choice { flex-wrap: wrap }
.st-choice .st-seg { flex: 1 1 100% }
.st-seg { display: flex; gap: 3px; padding: 3px; border-radius: 999px; background: var(--st-seg) }
.st-seg button { flex: 1; min-width: 0; min-height: 34px; padding: 6px 8px; border: 0; border-radius: 999px; background: none; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--st-muted); cursor: pointer; transition: background .2s, color .2s }
.st-seg button[aria-checked="true"] { background: var(--st-seg-on); color: var(--st-text); box-shadow: 0 1px 4px rgba(0,0,0,.14) }

/* a select of four or more, and something to type */
.st-field { flex: none; max-width: 58%; min-width: 0; margin: -6px 0; padding: 6px 2px 6px 8px; border: 0; background: none; font: inherit; font-size: 16px; font-weight: 400;
  color: var(--st-accent); text-align: right; text-align-last: right; -webkit-appearance: none; appearance: none; cursor: pointer }
.st-select .st-field { padding-right: 18px; background: no-repeat right 2px center / 9px 6px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 6'%3E%3Cpath d='M1 1l3.5 3.5L8 1' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") }
.st-input { flex-wrap: wrap }
.st-input .st-field { flex: 1 1 100%; max-width: none; margin: 4px 0 0; padding: 9px 12px; border-radius: 12px; background: var(--st-seg); color: var(--st-text); text-align: left; text-align-last: auto; cursor: text }
.st-input .st-field::placeholder { color: var(--st-muted) }

/* the switch: Bead + Labeled. A slim frosted track that glows with the look's colour when on, a small lens bead,
   and a | in the track when on, an o when off, so it reads without colour */
.st-sw { position: relative; flex: none; width: 48px; height: 22px; border-radius: 999px;
  background: color-mix(in srgb, var(--st-card) 60%, transparent); -webkit-backdrop-filter: blur(8px) saturate(160%); backdrop-filter: blur(8px) saturate(160%);
  box-shadow: inset 0 0 0 1px var(--st-off), inset 0 1px 2px rgba(0,0,0,.12); transition: background .22s ease, box-shadow .22s ease }
.st-sw::after { content: ""; position: absolute; top: 4px; left: 4px; width: 14px; height: 14px; border-radius: 50%;
  background: radial-gradient(120% 120% at 30% 25%, #fff 0%, var(--st-knob) 45%, color-mix(in srgb, var(--st-knob) 80%, #9aa3ad) 100%);
  box-shadow: 0 1px 4px rgba(0,0,0,.28), inset 0 -1px 1px rgba(0,0,0,.08); transition: transform .32s cubic-bezier(.3,1.35,.5,1), scale .2s ease }
.st-sw::before { content: ""; position: absolute; top: 50%; right: 8px; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--st-off); transition: opacity .2s }
.st-sw > i { position: absolute; top: 50%; left: 10px; width: 1.5px; height: 8px; margin-top: -4px; border-radius: 1px; background: var(--st-knob); opacity: 0; transition: opacity .2s }
[aria-checked="true"] > .st-sw { background: color-mix(in srgb, var(--st-on) 88%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-on) 70%, #fff), 0 0 14px -2px var(--st-glow) }
[aria-checked="true"] > .st-sw::after { transform: translateX(26px) }
[aria-checked="true"] > .st-sw::before { opacity: 0 }
[aria-checked="true"] > .st-sw > i { opacity: .95 }
.st-switch:not(:disabled):active > .st-sw::after { scale: 1.2 }
/* the same switch on its own, outside a Settings row (an editor's Private, an alarm): the button is the switch (S.sw) */
button.st-sw { margin: 0; padding: 0; border: 0; cursor: pointer; font: inherit; -webkit-tap-highlight-color: transparent }
button.st-sw:disabled { opacity: .5; cursor: default }
button.st-sw > .st-hit { position: absolute; inset: -11px -4px }
button.st-sw:focus-visible { outline: 2px solid var(--st-accent); outline-offset: 3px }
.st-sw[aria-checked="true"] { background: color-mix(in srgb, var(--st-on) 88%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-on) 70%, #fff), 0 0 14px -2px var(--st-glow) }
.st-sw[aria-checked="true"]::after { transform: translateX(26px) }
.st-sw[aria-checked="true"]::before { opacity: 0 }
.st-sw[aria-checked="true"] > i { opacity: .95 }
button.st-sw:not(:disabled):active::after { scale: 1.2 }

/* asking first, in the app (S.ask): never the browser's confirm(). A card over a dimmed page, its buttons at the bottom */
.st-ask { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: flex-end; justify-content: center;
  padding: 16px max(16px, env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(0,0,0,.32); animation: st-fade .18s ease }
.st-ask-card { width: 100%; max-width: 420px; border-radius: 24px; padding: 20px 18px 16px; background: var(--st-card); color: var(--st-text);
  box-shadow: inset 0 0 0 1px var(--st-edge), 0 18px 40px -12px rgba(0,0,0,.4); -webkit-backdrop-filter: blur(24px) saturate(160%); backdrop-filter: blur(24px) saturate(160%); animation: st-rise .26s cubic-bezier(.2,.8,.2,1) }
html[data-look="glass"] .st-ask-card, html[data-look="layers"] .st-ask-card { background: color-mix(in srgb, var(--st-card) 92%, transparent) }
.st-ask h2 { margin: 0 2px 6px; font-size: 18px; font-weight: 650; line-height: 1.3 }
.st-ask p { margin: 0 2px 16px; font-size: 15px; line-height: 1.4; color: var(--st-muted) }
.st-ask-btns { display: flex; gap: 10px }
.st-ask-btns button { flex: 1; min-height: 48px; border: 0; border-radius: 16px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; background: var(--st-seg); color: var(--st-text) }
.st-ask-btns .st-yes { background: var(--st-accent); color: var(--st-card) }
.st-ask-btns .st-yes.st-bad { background: var(--st-danger); color: var(--st-card) }
.st-ask-btns button:focus-visible { outline: 2px solid var(--st-accent); outline-offset: 2px }
@keyframes st-fade { from { opacity: 0 } }
@keyframes st-rise { from { transform: translateY(24px); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .st-ask, .st-ask-card { animation: none } }
@media (prefers-reduced-motion: reduce) { .st-sw, .st-sw::after, .st-sw::before, .st-sw > i, .st-seg button { transition: none } }

/* ---- Vintage: flat cream cards, teal for on, Futura-ish labels from the page ---- */
/* vintage: start */
html[data-look="vintage"] { --st-card: #FBF5E9; --st-edge: rgba(43,37,34,.14); --st-text: #2B2522; --st-muted: #5B4A3F; --st-rule: rgba(43,37,34,.12);
  --st-accent: #1F6F6B; --st-danger: #9E3A1A; --st-on: #1F6F6B; --st-off: rgba(43,37,34,.42); --st-knob: #FFF8EC; --st-glow: rgba(31,111,107,.35);
  --st-seg: rgba(43,37,34,.07); --st-seg-on: #FFF8EC; --st-press: rgba(43,37,34,.06) }
@media (prefers-color-scheme: dark) { html[data-look="vintage"]:not([data-theme="light"]) { --st-card: #322A25; --st-edge: rgba(244,236,221,.14); --st-text: #F4ECDD; --st-muted: #CFC1AC;
  --st-rule: rgba(244,236,221,.12); --st-accent: #4FB3AB; --st-danger: #F2906E; --st-on: #4FB3AB; --st-off: rgba(244,236,221,.5); --st-knob: #FFF8EC; --st-glow: rgba(79,179,171,.35);
  --st-seg: rgba(244,236,221,.08); --st-seg-on: #4A3E36; --st-press: rgba(244,236,221,.06) } }
html[data-look="vintage"][data-theme="dark"] { --st-card: #322A25; --st-edge: rgba(244,236,221,.14); --st-text: #F4ECDD; --st-muted: #CFC1AC;
  --st-rule: rgba(244,236,221,.12); --st-accent: #4FB3AB; --st-danger: #F2906E; --st-on: #4FB3AB; --st-off: rgba(244,236,221,.5); --st-knob: #FFF8EC; --st-glow: rgba(79,179,171,.35);
  --st-seg: rgba(244,236,221,.08); --st-seg-on: #4A3E36; --st-press: rgba(244,236,221,.06) }
/* vintage: end */
html[data-look="vintage"] .st-group { box-shadow: inset 0 0 0 1.5px var(--st-edge) }
html[data-look="vintage"] .st-lbl { letter-spacing: .16em }
html[data-look="grid"] .st-lbl { letter-spacing: .2em }
/* Tron: the picked option of a choice carries the red light, so it stands out on the black */
html[data-look="grid"] .st-seg button[aria-checked="true"] { box-shadow: inset 0 0 0 1px var(--st-accent), 0 0 10px -3px var(--st-accent); color: var(--st-accent) }
/* Layers: frosted glass over the sky, the way its pages are */
html[data-look="layers"] .st-group { background: color-mix(in srgb, var(--st-card) 78%, transparent) }

/* ---- Layers and Tron: generated from the Vintage block above by aOS/scripts/make-looks.mjs - don't edit by hand ---- */
/* generated: start */
html[data-look="layers"]{--st-card:#F9FBFE;--st-edge:rgba(19,26,35,.14);--st-text:#131A23;--st-muted:#3A414A;--st-rule:rgba(19,26,35,.12);--st-accent:#306E61;--st-danger:#973F3D;--st-on:#306E61;--st-off:rgba(19,26,35,.42);--st-knob:#FBFDFF;--st-glow:rgba(48,110,97,.35);--st-seg:rgba(19,26,35,.07);--st-seg-on:#FBFDFF;--st-press:rgba(19,26,35,.06)}
@media (prefers-color-scheme: dark){
html[data-look="layers"]:not([data-theme="light"]){--st-card:#191F26;--st-edge:rgba(235,239,243,.14);--st-text:#EBEFF3;--st-muted:#C2C7CD;--st-rule:rgba(235,239,243,.12);--st-accent:#6ABBA9;--st-danger:#F59B95;--st-on:#6ABBA9;--st-off:rgba(235,239,243,.5);--st-knob:#F7FAFE;--st-glow:rgba(106,187,169,.35);--st-seg:rgba(235,239,243,.08);--st-seg-on:#2B3138;--st-press:rgba(235,239,243,.06)}
}
html[data-look="layers"][data-theme="dark"]{--st-card:#191F26;--st-edge:rgba(235,239,243,.14);--st-text:#EBEFF3;--st-muted:#C2C7CD;--st-rule:rgba(235,239,243,.12);--st-accent:#6ABBA9;--st-danger:#F59B95;--st-on:#6ABBA9;--st-off:rgba(235,239,243,.5);--st-knob:#F7FAFE;--st-glow:rgba(106,187,169,.35);--st-seg:rgba(235,239,243,.08);--st-seg-on:#2B3138;--st-press:rgba(235,239,243,.06)}
html[data-look="grid"]{--st-card:#FAFCFE;--st-edge:rgba(23,27,32,.14);--st-text:#171B20;--st-muted:#3D4146;--st-rule:rgba(23,27,32,.12);--st-accent:#973835;--st-danger:#A50310;--st-on:#973835;--st-off:rgba(23,27,32,.42);--st-knob:#FCFDFF;--st-glow:rgba(151,56,53,.35);--st-seg:rgba(23,27,32,.07);--st-seg-on:#FCFDFF;--st-press:rgba(23,27,32,.06)}
@media (prefers-color-scheme: dark){
html[data-look="grid"]:not([data-theme="light"]){--st-card:#0D0F11;--st-edge:rgba(238,240,242,.14);--st-text:#EEF0F2;--st-muted:#C8CACD;--st-rule:rgba(238,240,242,.12);--st-accent:#FFA39B;--st-danger:#FE9185;--st-on:#FFA39B;--st-off:rgba(238,240,242,.5);--st-knob:#F8FAFC;--st-glow:rgba(255,163,155,.35);--st-seg:rgba(238,240,242,.08);--st-seg-on:#1E2023;--st-press:rgba(238,240,242,.06)}
}
html[data-look="grid"][data-theme="dark"]{--st-card:#0D0F11;--st-edge:rgba(238,240,242,.14);--st-text:#EEF0F2;--st-muted:#C8CACD;--st-rule:rgba(238,240,242,.12);--st-accent:#FFA39B;--st-danger:#FE9185;--st-on:#FFA39B;--st-off:rgba(238,240,242,.5);--st-knob:#F8FAFC;--st-glow:rgba(255,163,155,.35);--st-seg:rgba(238,240,242,.08);--st-seg-on:#1E2023;--st-press:rgba(238,240,242,.06)}
/* generated: end */
`;
  if (!document.getElementById('aos-settings')) { const el = document.createElement('style'); el.id = 'aos-settings'; el.textContent = CSS; document.head.appendChild(el); }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = d => `<svg class="st-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  // the icons an action row can have, one look in every app
  const ICONS = {
    refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 4.4v4.3h-4.3"/>'),
    upload: svg('<path d="M12 14.2V3.8"/><path d="M7.6 7.8 12 3.6l4.4 4.2"/><path d="M4 14.6v2.2a3.2 3.2 0 0 0 3.2 3.2h9.6a3.2 3.2 0 0 0 3.2-3.2v-2.2"/>'),
    download: svg('<path d="M12 3.8v10.4"/><path d="M7.6 10 12 14.4l4.4-4.4"/><path d="M4 14.6v2.2a3.2 3.2 0 0 0 3.2 3.2h9.6a3.2 3.2 0 0 0 3.2-3.2v-2.2"/>'),
    out: svg('<path d="M14 4.5h3.3a2.2 2.2 0 0 1 2.2 2.2v10.6a2.2 2.2 0 0 1-2.2 2.2H14"/><path d="M10 8 6 12l4 4M6 12h9"/>'),
    trash: svg('<path d="M4.5 6.8h15M9.6 6.8V4.9a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.9M6.6 6.8l.8 11.6a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.8-11.6"/>'),
    mail: svg('<rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/>'),
    face: svg('<path d="M4 8.5V6.6A2.6 2.6 0 0 1 6.6 4h1.9M15.5 4h1.9A2.6 2.6 0 0 1 20 6.6v1.9M20 15.5v1.9a2.6 2.6 0 0 1-2.6 2.6h-1.9M8.5 20H6.6A2.6 2.6 0 0 1 4 17.4v-1.9"/><path d="M9 9.6v1.2M15 9.6v1.2M12 9.4v3.4h-.8M9.4 15.4a3.8 3.8 0 0 0 5.2 0"/>'),
    eye: svg('<path d="M2.8 12s3.3-6.2 9.2-6.2 9.2 6.2 9.2 6.2-3.3 6.2-9.2 6.2S2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    play: svg('<path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4A.8.8 0 0 0 8 5.6z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    link: svg('<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>'),
    send: svg('<path d="M20.4 3.6 10.2 13.8M20.4 3.6l-6.4 16.8-3.8-6.6-6.6-3.8z"/>'),
    list: svg('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.1"/><circle cx="4.6" cy="12" r="1.1"/><circle cx="4.6" cy="17.5" r="1.1"/>'),
    lock: svg('<rect x="4.6" y="10.4" width="14.8" height="10.4" rx="3"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>'),
    phone: svg('<rect x="6.6" y="2.8" width="10.8" height="18.4" rx="2.8"/><path d="M10.6 18h2.8"/>'),
  };
  const CHEV = '<svg class="st-chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg>';
  const t = (o, k) => (o.html ? String(o[k] == null ? '' : o[k]) : esc(o[k]));
  const attrs = o => (o.id ? ` id="${esc(o.id)}"` : '') + Object.entries(o.data || {}).map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join('')
    + (o.label ? ` aria-label="${esc(o.label)}"` : '');
  const text = o => `<span class="st-text"><span class="st-title">${t(o, 'title')}</span>${o.sub != null && o.sub !== '' ? `<span class="st-sub">${t(o, 'sub')}</span>` : ''}</span>`;
  const val = o => (o.value != null && o.value !== '' ? `<span class="st-val">${t(o, 'value')}</span>` : '');

  const S = {
    ICONS,
    esc,
    // a section: its label (or '' for none), its rows, and at most one line under it
    section(label, rows, { hint = '', id = '', hintId = '', html = false } = {}) {
      const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean).join('');
      if (!list) return '';
      return `<section class="st-sec"${id ? ` id="${esc(id)}"` : ''}>${label ? `<h3 class="st-lbl">${esc(label)}</h3>` : ''}<div class="st-group">${list}</div>`
        + (hint || hintId ? `<p class="st-hint"${hintId ? ` id="${esc(hintId)}"` : ''}>${html ? hint : esc(hint)}</p>` : '') + '</section>';
    },
    // on or off
    toggle: o => `<button type="button" class="st-row st-switch" role="switch" aria-checked="${!!o.on}"${o.disabled ? ' disabled' : ''}${attrs(o)}>${text(o)}<span class="st-sw" aria-hidden="true"><i></i></span></button>`,
    // does something: an icon and a verb
    action: o => `<button type="button" class="st-row ${o.danger ? 'st-danger' : 'st-act'}"${o.disabled ? ' disabled' : ''}${attrs(o)}>${ICONS[o.icon] || ''}${text(o)}${val(o)}</button>`,
    // deletes or signs out: red, and asks again (S.armed)
    danger: o => S.action({ icon: 'trash', ...o, danger: true }),
    // opens more
    nav: o => `<button type="button" class="st-row st-nav"${o.disabled ? ' disabled' : ''}${attrs(o)}>${o.icon ? ICONS[o.icon] || '' : ''}${text(o)}${val(o)}${CHEV}</button>`,
    // how things stand; no tap. extra: html put at the end of the row (a small button, say)
    info: o => `<div class="st-row st-info"${attrs(o)}>${text(o)}${val(o)}${o.extra || ''}</div>`,
    // two or three options. options: [[value, label]...]
    choice: o => `<div class="st-row st-choice"${o.id ? ` id="${esc(o.id)}-row"` : ''}>${text(o)}<div class="st-seg" role="radiogroup" aria-label="${esc(o.label || o.title)}"${attrs({ id: o.id, data: o.data })}>`
      + o.options.map(([v, l]) => `<button type="button" role="radio" data-value="${esc(v)}" aria-checked="${String(v) === String(o.value)}">${esc(l)}</button>`).join('') + '</div></div>',
    // four or more: a select, its value on the right. options: [[value, label]...]
    select: o => `<label class="st-row st-select">${text(o)}<select class="st-field"${attrs(o)}${o.disabled ? ' disabled' : ''}>`
      + o.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(o.value) ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select></label>',
    // something to type. attrs: extra attributes for the input, as a string (type="url" inputmode="url"...)
    input: o => `<label class="st-row st-input">${text(o)}<input class="st-field" type="${esc(o.type || 'text')}" value="${esc(o.value || '')}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${attrs(o)} ${o.attrs || ''}></label>`,
    // anything else that lives in a group (the Design picker, a list of chips): given as it is
    raw: (html, o = {}) => `<div class="st-row st-raw"${attrs(o)}>${html}</div>`,
    // the same switch on its own, outside a Settings row (an editor's Private, an alarm). label: what VoiceOver says; .st-hit makes its tap area 44 tall
    sw: o => `<button type="button" class="st-sw" role="switch" aria-checked="${!!o.on}"${o.disabled ? ' disabled' : ''}${attrs(o)}><i aria-hidden="true"></i><span class="st-hit" aria-hidden="true"></span></button>`,
    // asking first, in the app, never the browser's confirm(): resolves true for yes. danger: the yes button in red
    //   if (!await S.ask({ title: 'Remove Ella?', text: 'Her progress goes on every phone.', yes: 'Remove', danger: true })) return;
    ask({ title, text = '', yes = 'OK', no = 'Cancel', danger = false } = {}) {
      return new Promise(done => {
        const was = document.activeElement, box = document.createElement('div');
        box.className = 'st-ask'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true');
        box.innerHTML = `<div class="st-ask-card"><h2 id="st-ask-t">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}`
          + `<div class="st-ask-btns"><button type="button" class="st-no">${esc(no)}</button><button type="button" class="st-yes${danger ? ' st-bad' : ''}">${esc(yes)}</button></div></div>`;
        box.setAttribute('aria-labelledby', 'st-ask-t');
        const end = v => { document.removeEventListener('keydown', key, true); box.remove(); if (was && was.focus) try { was.focus({ preventScroll: true }); } catch {} done(v); };
        const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(false); } };
        box.addEventListener('click', e => { if (e.target === box || e.target.closest('.st-no')) end(false); else if (e.target.closest('.st-yes')) end(true); });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(box);
        box.querySelector(danger ? '.st-no' : '.st-yes').focus({ preventScroll: true });
      });
    },
    // Claude for this app on this phone (AllisonOS.claude, ../home/account.js): the first row of the app's AI helper
    // section, and the same row in aOS Account > AI helper's list. It turns itself (below), so the page doesn't handle it.
    claude(app) {
      const C = A.claude, e = C && C.apps.find(x => x[0] === app); if (!e) return '';
      return S.toggle({ id: 'claude-' + app, title: 'Use Claude in ' + e[1], sub: e[2], on: C.on(app), data: { claude: app } });
    },
    // a switch turned: its new state
    flip(btn) { const on = btn.getAttribute('aria-checked') !== 'true'; btn.setAttribute('aria-checked', String(on)); return on; },
    // a choice picked: marks it, and gives its value (or null if the tap wasn't on an option)
    pick(e) {
      const b = e.target.closest('.st-seg [role="radio"]'); if (!b) return null;
      b.parentElement.querySelectorAll('[role="radio"]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      return b.dataset.value;
    },
    // a danger row asks again: the first tap says what will happen and waits 4 seconds for the second
    armed(btn, again = 'Tap again to confirm') {
      if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; restore(btn); return true; }
      const title = btn.querySelector('.st-title'); if (title) { btn.dataset.was = title.textContent; title.textContent = again; }
      btn.dataset.armed = String(setTimeout(() => { delete btn.dataset.armed; restore(btn); }, 4000));
      return false;
    },
  };
  function restore(btn) { const title = btn.querySelector('.st-title'); if (title && btn.dataset.was != null) { title.textContent = btn.dataset.was; delete btn.dataset.was; } }
  A.settings = S;
  // a Claude switch (S.claude, aOS Account's list), wherever it is
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.st-switch[data-claude]');
    if (b && !b.disabled && A.claude) A.claude.set(b.dataset.claude, S.flip(b));
  });
})();
