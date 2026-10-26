// Your helper's name on the page. Once you've picked your helper (home/ipsy.js, aos.helper {who, name}), the
// words say its name where they said Ipsy: "Or just tell Biscuit…", or with no name, what it is ("Ask the
// fox"; Mia is Mia); in Tron, Ares (Tron: Ares's rider). Not inside translate="no" (what the family wrote,
// the chat itself) or data-ipsy="as-is" (the release log: what each version said then). Every page loads it
// in <head>, before its words:
//   <script src="../home/names.js"></script>
// Until a helper is picked (it's Ipsy), it does nothing.
// window.aosNames: helper() (the helper's name changed: draw it again); named(text) (Ipsy in it as your helper).
// 'aos:words' fires on window, once a frame, when words on the page changed size (home/slide.js measures again).
'use strict';
(() => {
  if (window.aosNames) return;
  const root = document.documentElement;
  const HELPER = 'aos.helper', IPSY = /\bIpsy\b/g, HAS = /\bIpsy\b/;
  const KINDS = { fox: 'the fox', owl: 'the owl', robot: 'the robot', octopus: 'the octopus', hedgehog: 'the hedgehog', otter: 'the otter' };
  const nameNow = () => {   // '' while it's Ipsy (not picked, or a name that is Ipsy)
    if (root.getAttribute('data-look') === 'grid') return 'Ares';
    try {
      const h = JSON.parse(localStorage.getItem(HELPER)) || {}, n = String(h.name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
      if (n) return /\bipsy\b/i.test(n) ? '' : n;
      return h.who === 'mia' ? 'Mia' : KINDS[h.who] || '';
    } catch { return ''; }
  };
  let NAME = nameNow();
  const asIs = el => !!(el && el.closest && el.closest('[data-ipsy="as-is"]'));
  const named = (s, el) => (NAME && HAS.test(s) && !asIs(el) ? s.replace(IPSY, (m, at) => (/^the /.test(NAME) && /(^\s*["“‘(]?|[.!?…]\s+)$/.test(s.slice(0, at)) ? 'T' + NAME.slice(1) : NAME)) : s);   // "The fox is reading…"
  window.aosNames = {
    named: s => named(String(s)),
    helper() {
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
    },
  };
  addEventListener('storage', e => { if (e.key === HELPER) window.aosNames.helper(); });   // named in another app or frame
  new MutationObserver(() => window.aosNames.helper()).observe(root, { attributes: true, attributeFilter: ['data-look'] });   // Tron's Ares, or back

  // ---- the words on the page ----
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|CODE|PRE)$/i;
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const done = new WeakMap();              // text node -> what we put there (so our own change isn't redone)
  const doneAttr = new WeakMap();          // element -> { attr: what we put there }
  const src = new WeakMap(), srcAttr = new WeakMap();   // ... and what it said before the name went in
  const drawn = new Set();                 // the nodes and elements with a name in them (drawn again on a new name)
  let cap = 400;
  const keep = x => { drawn.add(x); if (drawn.size > cap) { for (const y of drawn) if (!y.isConnected) drawn.delete(y); cap = Math.max(400, drawn.size * 2); } };   // not what's gone from the page
  const kept = el => !el || !!(el.closest && el.closest('[translate="no"],[contenteditable="true"],[contenteditable=""]'));
  function text(n) {
    const p = n.parentElement;
    if (!p || SKIP.test(p.nodeName) || done.get(n) === n.data || kept(p)) return;
    const s = n.data; if (!HAS.test(s)) return;
    const r = named(s, p);
    if (r !== s) { n.data = r; done.set(n, n.data); src.set(n, s); keep(n); changed = true; }
  }
  function attrs(el) {
    if (kept(el)) return;
    let mine = doneAttr.get(el);
    const names = el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) ? [...ATTRS, 'value'] : ATTRS;
    for (const a of names) {
      const v = el.getAttribute(a); if (v == null || !HAS.test(v) || (mine && mine[a] === v)) continue;
      const r = named(v, el);
      if (r !== v) {
        el.setAttribute(a, r); (mine || (doneAttr.set(el, mine = {}), mine))[a] = r;
        (srcAttr.get(el) || (srcAttr.set(el, {}), srcAttr.get(el)))[a] = v; keep(el);
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
  function start() {   // once the helper has a name: until then, nothing to do
    started = true;
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'value'] });
    sweep(root);
  }
  if (NAME) start();
})();
