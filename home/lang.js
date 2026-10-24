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
// A word file:
//   aosLang.add({ 'Done': 'Готово', 'Grocery list': 'Список покупок' },
//     [[/^(\d+) items?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'позиция', 'позиции', 'позиций')]]);
// A pattern's function gets the match; aosLang.t(text) translates a part of it (or gives it back as it was).
// window.aosLang: get() 'en' | 'ru'; set(lang) (every open page is drawn again in it); add(words, patterns);
// t(text); plural(n, one, few, many); list [[id, name]]. 'aos:lang' fires on window before a change reloads.
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
    for (const [re, f] of PATTERNS) { const m = re.exec(k); if (m) return typeof f === 'function' ? f(m) : k.replace(re, f); }
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
      if (started) sweep(document.documentElement);   // a word file that came late: what's on the page already
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
  if (lang !== 'ru') return;
  root.lang = 'ru';

  // ---- dates and numbers in Russian ----
  const swap = l => { const f = Array.isArray(l) ? l[0] : l; return f == null || /^en\b/i.test(String(f)) ? 'ru-RU' : l; };
  for (const [proto, names] of [[Date.prototype, ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']], [Number.prototype, ['toLocaleString']]]) {
    for (const n of names) { const f = proto[n]; proto[n] = function (l, o) { return f.call(this, swap(l), o); }; }
  }
  for (const k of ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'ListFormat', 'DisplayNames']) {
    const C = Intl[k]; if (!C) continue;
    const W = function (l, o) { return new C(swap(l), o); };
    W.prototype = C.prototype; W.supportedLocalesOf = C.supportedLocalesOf.bind(C);
    Intl[k] = W;
  }

  // ---- the words on the page ----
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|CODE|PRE)$/i;
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const done = new WeakMap();              // text node -> what we put there (so our own change isn't redone)
  const doneAttr = new WeakMap();          // element -> { attr: what we put there }
  const kept = el => !el || !!(el.closest && el.closest('[translate="no"],[contenteditable="true"],[contenteditable=""]'));
  function text(n) {
    const p = n.parentElement;
    if (!p || SKIP.test(p.nodeName) || done.get(n) === n.data || kept(p)) return;
    const s = n.data; if (!/[A-Za-z]/.test(s)) return;
    const r = t(s);
    if (r !== s) { const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0]; n.data = lead + r + trail; done.set(n, n.data); }   // only what we changed: the rest is looked at again when more words come
  }
  function attrs(el) {
    if (kept(el)) return;
    let mine = doneAttr.get(el);
    const names = el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) ? [...ATTRS, 'value'] : ATTRS;
    for (const a of names) {
      const v = el.getAttribute(a); if (v == null || !/[A-Za-z]/.test(v) || (mine && mine[a] === v)) continue;
      const r = t(v);
      if (r !== v) { el.setAttribute(a, r); (mine || (doneAttr.set(el, mine = {}), mine))[a] = r; }
    }
  }
  function sweep(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1 || SKIP.test(node.nodeName)) return;
    attrs(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: x => (x.nodeType === 1 && SKIP.test(x.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let x = w.nextNode(); x; x = w.nextNode()) x.nodeType === 3 ? text(x) : attrs(x);
  }
  let started = false;
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') { if (m.target.nodeType === 1) attrs(m.target); }
      else for (const n of m.addedNodes) sweep(n);
    }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'value'] });
  started = true;
  sweep(root);
})();
