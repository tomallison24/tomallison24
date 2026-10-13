// Meals' sums, kept free of the page so they can be tested in Node
// (meals/scripts/logic-test.mjs):
//
//   MealsLogic.sections(items, nameOf)   items grouped in store order, by the same
//                                        grocery sections as Notes' grocery lists
//                                        (../home/aisles.js): [{ id, name, items }]
//   MealsLogic.shopping(meals, deals)    one list for the whole plan: the same
//                                        ingredient across nights once, with each
//                                        night's amount, staples apart, and the
//                                        sale price when it's on sale
//   MealsLogic.dealFor(item, deals)      the sale that matches an ingredient, or null
//   MealsLogic.weekLabel(week)           "Wed, Oct 7 – Tue, Oct 13"
//   MealsLogic.total(amounts)            "1 lb" x 4 is "4 lb"; mixed units stay "1 lb + 2 cups"
//   MealsLogic.listText(groups)          the list as plain text, to paste into Notes
(function (root) {
  'use strict';
  const A = root.NotesAisles;
  const key = s => A.key(String(s || ''));
  const words = s => key(s).split(' ').filter(Boolean);

  function sections(items, nameOf) {
    const by = new Map(A.SECTIONS.map(s => [s.id, { id: s.id, name: s.name, items: [] }]));
    for (const x of items) by.get(A.sectionOf(nameOf(x))).items.push(x);
    return [...by.values()].filter(s => s.items.length);
  }

  // A sale matches when every word naming the ingredient is in the sale's name:
  // "chicken thighs" matches "Organic boneless skinless chicken thighs", but
  // "chicken broth" doesn't match "chicken thighs".
  function dealFor(item, deals) {
    const w = words(item); if (!w.length || !deals) return null;
    let best = null, bestLen = Infinity;
    for (const d of deals.items || []) {
      const dw = new Set(words(d.name));
      if (w.every(x => dw.has(x)) && dw.size < bestLen) { best = d; bestLen = dw.size; }
    }
    return best;
  }

  function shopping(meals, deals) {
    const by = new Map();
    for (const m of meals || []) for (const i of m.ingredients || []) {
      const k = key(i.item) || i.item.toLowerCase();
      let x = by.get(k);
      if (!x) by.set(k, x = { key: k, item: i.item, amounts: [], nights: [], pantry: true });
      if (i.qty) x.amounts.push(i.qty);
      if (!x.nights.includes(m.day)) x.nights.push(m.day);
      x.pantry = x.pantry && !!i.pantry;   // a staple only if every night calls it one
    }
    const all = [...by.values()].map(x => Object.assign(x, { deal: dealFor(x.item, deals) }));
    return { buy: all.filter(x => !x.pantry), pantry: all.filter(x => x.pantry) };
  }

  // Amounts in the same unit add up ("1.5 lb" four times is "6 lb", "1/2 cup" twice
  // "1 cup"); anything else is listed as it is, joined with +.
  const num = s => { const m = /^(\d+)\/(\d+)$/.exec(s); return m ? +m[1] / +m[2] : +s; };
  function total(amounts) {
    const parts = (amounts || []).map(a => /^(\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/.exec(String(a).trim()));
    if (parts.length > 1 && parts.every(p => p && p[2].toLowerCase() === parts[0][2].toLowerCase())) {
      const n = Math.round(parts.reduce((t, p) => t + num(p[1]), 0) * 100) / 100;
      return (n + ' ' + parts[0][2]).trim();
    }
    return (amounts || []).join(' + ');
  }

  const day = s => { const d = new Date(s + 'T12:00:00'); return isNaN(d) ? null : d; };
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  function weekLabel(week, from, to) {
    const a = day(from || week), b = to ? day(to) : a && new Date(a.getTime() + 6 * 864e5);
    return a && b ? fmt(a) + ' – ' + fmt(b) : '';
  }

  const listText = groups => groups.map(g => g.name + '\n' + g.items.map(x => '- ' + x.item + (x.amounts && x.amounts.length ? ' (' + total(x.amounts) + ')' : '')).join('\n')).join('\n\n');

  root.MealsLogic = { sections, shopping, dealFor, weekLabel, total, listText };
})(typeof window !== 'undefined' ? window : globalThis);
