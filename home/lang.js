// The language: English (the default) or Russian, picked in aOS (Account > Appearance > Language) for
// aOS and every app at once, and kept on this phone: localStorage aos.lang = 'en' | 'ru' (synced with the
// family account, aOS/prefs-sync.js). Every page loads it in <head>, before its words:
//   <script src="../home/lang.js"></script>
//   <script src="../home/lang/ru/shared.js"></script>   welcome, walkthroughs, update screens, Ipsy, sign-in
//   <script src="../home/lang/ru/<app>.js"></script>    the app's own
// In English it does nothing (the word files only call add(), which keeps nothing). In Russian it:
//   - puts lang="ru" on <html>;
//   - swaps the words as the page draws them: each text node, and placeholder, aria-label, title and alt
//     (and a button input's value), found whole in the words or matched by one of the patterns, and a
//     MutationObserver keeps up as the app draws more. Anything inside translate="no" is left as it is:
//     what the family wrote (notes, lists, mail, events) and outside content (news, podcasts);
//   - dates and numbers in Russian: toLocale*String and the Intl formats, asked for in the phone's
//     language or in English, are given Russian (21:41, 24 октября, 1 234,5).
// In either language, once you've picked your helper (home/ipsy.js, aos.helper {who, name}), the words say
// its name where they said Ipsy (or Ипси): "Or just tell Biscuit…", or with no name, "Ask the fox". Not inside translate="no" (what the family
// wrote, the chat itself) or data-ipsy="as-is" (the release log: what each version said then).
// A word file:
//   aosLang.add({ 'Done': 'Готово', 'Grocery list': 'Список покупок' },
//     [[/^(\d+) items?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'позиция', 'позиции', 'позиций')]]);
// A pattern's function gets the match; aosLang.t(text) translates a part of it (or gives it back as it was).
// window.aosLang: get() 'en' | 'ru'; set(lang) (every open page is drawn again in it); add(words, patterns);
// t(text); plural(n, one, few, many); list [[id, name]]; helper() (the helper's name changed: draw it again);
// named(text) (Ipsy in it as your helper).
// 'aos:lang' fires on window before a change reloads.
'use strict';
(() => {
  if (window.aosLang) return;
  const KEY = 'aos.lang', LIST = [['en', 'English'], ['ru', 'Русский']];
  const ok = v => (v === 'ru' ? 'ru' : 'en');
  let lang = 'en'; try { lang = ok(localStorage.getItem(KEY)); } catch {}
  const root = document.documentElement;
  const WORDS = new Map(), PATTERNS = [];
  const norm = s => s.replace(/\s+/g, ' ').trim();
  // Russian plurals: 1 день, 2 дня, 5 дней (11-14 are many)
  const plural = (n, one, few, many) => { n = Math.abs(parseInt(n, 10)) % 100; const d = n % 10; return n > 10 && n < 20 ? many : d === 1 ? one : d > 1 && d < 5 ? few : many; };
  function t(s) {
    if (s == null) return s;
    const k = norm(String(s));
    if (!k || !/[A-Za-z]/.test(k)) return s;
    const w = WORDS.get(k); if (w != null) return w;
    for (const [re, f] of PATTERNS) {   // a pattern's function can give back nothing (null): not this one, the next is tried
      const m = re.exec(k); if (!m) continue;
      const r = typeof f === 'function' ? f(m) : k.replace(re, f);
      if (r != null) return r;
    }
    return s;
  }
  window.aosLang = {
    get: () => lang,
    list: LIST,
    plural,
    t: s => (lang === 'ru' ? t(s) : s),
    add(words, patterns) {
      if (lang !== 'ru') return;
      for (const k in words || {}) WORDS.set(norm(k), words[k]);
      for (const p of patterns || []) PATTERNS.push(p);
      if (started) { changed = false; sweep(document.documentElement); if (changed) tell(); }   // a word file that came late: what's on the page already
    },
    set(next) {
      next = ok(next);
      try { localStorage.setItem(KEY, next); } catch {}
      if (next === lang) return;
      window.dispatchEvent(new CustomEvent('aos:lang', { detail: next }));
      location.reload();
    },
  };
  // another page (aOS's Appearance, an app in another frame) changed it: draw this one again in it
  addEventListener('storage', e => { if (e.key === KEY && ok(e.newValue) !== lang) location.reload(); });
  const ru = lang === 'ru';

  // ---- your helper's name ----
  const HELPER = 'aos.helper', IPSY = /\bIpsy\b|Ипси/g, HAS = /\bIpsy\b|Ипси/;
  // a helper picked but not named goes by what it is: "Ask the fox" (Mia is Mia). In Russian, where a word like
  // лиса would need its case ("скажите лисе"), it stays Ипси, which never changes.
  const KINDS = { fox: 'the fox', owl: 'the owl', robot: 'the robot', octopus: 'the octopus', hedgehog: 'the hedgehog', otter: 'the otter' };
  const nameNow = () => {   // '' while it's Ipsy (not picked, or a name that is Ipsy); in Tron, Ares (Tron: Ares's rider)
    if (root.getAttribute('data-look') === 'grid') return ru ? 'Арес' : 'Ares';
    try {
      const h = JSON.parse(localStorage.getItem(HELPER)) || {}, n = String(h.name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
      if (n) return /\bipsy\b|ипси/i.test(n) ? '' : n;
      return h.who === 'mia' ? (ru ? 'Мия' : 'Mia') : ru ? '' : KINDS[h.who] || '';
    } catch { return ''; }
  };
  let NAME = nameNow();
  const asIs = el => !!(el && el.closest && el.closest('[data-ipsy="as-is"]'));
  const named = (s, el) => (NAME && HAS.test(s) && !asIs(el) ? s.replace(IPSY, (m, at) => (/^the /.test(NAME) && /(^\s*["“‘(]?|[.!?…]\s+)$/.test(s.slice(0, at)) ? 'T' + NAME.slice(1) : NAME)) : s);   // "The fox is reading…"
  window.aosLang.named = s => named(String(s));
  const words = s => /[A-Za-z]/.test(s) || (NAME && s.includes('Ипси'));
  window.aosLang.helper = () => {
    const n = nameNow(); if (n === NAME) return;
    NAME = n;
    if (!started) { if (NAME) start(); return; }
    for (const x of drawn) {   // what has a name in it: drawn again from what it said
      if (!x.isConnected) { drawn.delete(x); continue; }
      if (x.nodeType === 3) { const o = src.get(x); if (o && done.get(x) === x.data) { done.delete(x); x.data = o; text(x); } continue; }
      const o = srcAttr.get(x) || {}, mine = doneAttr.get(x) || {};
      for (const a in o) if (x.getAttribute(a) === mine[a]) { delete mine[a]; x.setAttribute(a, o[a]); }
      attrs(x);
    }
    sweep(root);
  };
  addEventListener('storage', e => { if (e.key === HELPER) window.aosLang.helper(); });   // named in another app or frame
  new MutationObserver(() => window.aosLang.helper()).observe(root, { attributes: true, attributeFilter: ['data-look'] });   // Tron's Ares, or back
  if (ru) root.lang = 'ru';

  // ---- dates and numbers in Russian ----
  // a locale marked -x-keep ('en-US-x-keep') stays as asked: for text that leaves aOS (an email's quoted date)
  if (ru) {
    const swap = l => { const f = Array.isArray(l) ? l[0] : l; return f != null && /-x-keep$/i.test(String(f)) ? l : f == null || /^en\b/i.test(String(f)) ? 'ru-RU' : l; };
    for (const [proto, names] of [[Date.prototype, ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']], [Number.prototype, ['toLocaleString']]]) {
      for (const n of names) { const f = proto[n]; proto[n] = function (l, o) { return f.call(this, swap(l), o); }; }
    }
    for (const k of ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'ListFormat', 'DisplayNames']) {
      const C = Intl[k]; if (!C) continue;
      const W = function (l, o) { return new C(swap(l), o); };
      W.prototype = C.prototype; W.supportedLocalesOf = C.supportedLocalesOf.bind(C);
      Intl[k] = W;
    }
  }

  // ---- the words on the page ----
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|CODE|PRE)$/i;
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const done = new WeakMap();              // text node -> what we put there (so our own change isn't redone)
  const doneAttr = new WeakMap();          // element -> { attr: what we put there }
  const src = new WeakMap(), srcAttr = new WeakMap();   // ... and what it said before, where a name went in
  const drawn = new Set();                 // the nodes and elements with a name in them (drawn again on a new name)
  let cap = 400;
  const keep = x => { drawn.add(x); if (drawn.size > cap) { for (const y of drawn) if (!y.isConnected) drawn.delete(y); cap = Math.max(400, drawn.size * 2); } };   // not what's gone from the page
  const say = (s, el) => named(ru ? t(s) : s, el);
  const kept = el => !el || !!(el.closest && el.closest('[translate="no"],[contenteditable="true"],[contenteditable=""]'));
  function text(n) {
    const p = n.parentElement;
    if (!p || SKIP.test(p.nodeName) || done.get(n) === n.data || kept(p)) return;
    const s = n.data; if (!words(s)) return;
    const r = say(s, p);
    if (r !== s) {   // only what we changed: the rest is looked at again when more words come
      const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0]; n.data = lead + r + trail; done.set(n, n.data); changed = true;
      if (HAS.test(s)) { src.set(n, s); keep(n); }
    }
  }
  function attrs(el) {
    if (kept(el)) return;
    let mine = doneAttr.get(el);
    const names = el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) ? [...ATTRS, 'value'] : ATTRS;
    for (const a of names) {
      const v = el.getAttribute(a); if (v == null || !words(v) || (mine && mine[a] === v)) continue;
      const r = say(v, el);
      if (r !== v) {
        el.setAttribute(a, r); (mine || (doneAttr.set(el, mine = {}), mine))[a] = r;
        if (HAS.test(v)) { (srcAttr.get(el) || (srcAttr.set(el, {}), srcAttr.get(el)))[a] = v; keep(el); }
      }
    }
  }
  function sweep(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1) return;
    if (SKIP.test(node.nodeName)) { if (node.nodeName === 'TEXTAREA') attrs(node); return; }   // a text box's placeholder, never what's typed in it
    attrs(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: x => {
      if (x.nodeType === 1 && SKIP.test(x.nodeName)) { if (x.nodeName === 'TEXTAREA') attrs(x); return NodeFilter.FILTER_REJECT; }
      return NodeFilter.FILTER_ACCEPT;
    } });
    for (let x = w.nextNode(); x; x = w.nextNode()) x.nodeType === 3 ? text(x) : attrs(x);
  }
  let started = false, changed = false, told = 0;
  // words that changed size: 'aos:words' on window, once a frame, so what was measured in English is measured
  // again (home/slide.js's thumbs)
  const tell = () => { if (told) return; told = requestAnimationFrame(() => { told = 0; window.dispatchEvent(new Event('aos:words')); }); };
  const mo = new MutationObserver(list => {
    changed = false;
    for (const m of list) {
      if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') { if (m.target.nodeType === 1) attrs(m.target); }
      else for (const n of m.addedNodes) sweep(n);
    }
    if (changed) tell();
  });
  function start() {   // in Russian, or once the helper has a name (in English, until then, nothing to do)
    started = true;
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'value'] });
    sweep(root);
  }
  if (ru || NAME) start();
})();
