// labs/tron-icons: draws every app's icon in each Tron style (styles.js). On the site the icons come from each
// app's folder (icon.svg, and icon-grid.svg for today's); published elsewhere, from window.TRON_ICONS beside this page.
'use strict';
(async () => {
  const APPS = [['aos', 'aOS', 'aOS'], ['house', 'house', 'Home'], ['mail', 'mail', 'Mail'], ['weather', 'weather', 'Weather'],
    ['calendar', 'calendar', 'Calendar'], ['clock', 'clock', 'Clock'], ['news', 'news', 'News'], ['notes', 'notes', 'Notes'],
    ['podcasts', 'podcasts', 'Podcasts'], ['travel', 'travel', 'Travel'], ['places', 'places', 'Places'], ['fitness', 'fitness', 'Fitness'],
    ['drinks', 'drinks', 'Drinks'], ['meals', 'meals', 'Meals'], ['orders', 'orders', 'Orders'], ['money', 'money', 'Money'], ['sparkle', 'sparkle', 'Sparkle']];
  const KEEP = 'lab.tronicons.app';
  const $ = id => document.getElementById(id);
  const url = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

  const icons = window.TRON_ICONS || Object.fromEntries(await Promise.all(APPS.map(async ([id, dir]) => {
    const get = f => fetch(`../../${dir}/${f}`).then(r => r.ok ? r.text() : '').catch(() => '');
    return [id, { v: await get('icon.svg'), g: await get('icon-grid.svg') }];
  })));
  const ok = APPS.filter(([id]) => icons[id] && icons[id].v);

  // each app in each style, made once
  const drawn = {};
  for (const [id] of ok) {
    const { v, g } = icons[id], ground = (/<rect width="512" height="512" fill="(#[0-9A-Fa-f]{6})"/.exec(g) || [])[1];
    drawn[id] = {};
    for (const st of window.tronStyles) {
      try { drawn[id][st.id] = url(st.make ? st.make(v, ground) : g); } catch { drawn[id][st.id] = ''; }
    }
  }

  let pick = 'house';
  try { const k = localStorage.getItem(KEEP); if (k && drawn[k]) pick = k; } catch {}
  const name = id => (APPS.find(a => a[0] === id) || [])[2] || id;

  function showBig() {
    $('big').innerHTML = window.tronStyles.map(st => `<figure class="big" style="margin:0"><img src="${drawn[pick][st.id]}" alt="${name(pick)} in ${st.name}"><span>${st.name}</span></figure>`).join('');
    for (const b of $('apps').children) b.setAttribute('aria-pressed', String(b.dataset.id === pick));
  }
  function choose(id) {
    pick = id; showBig();
    try { localStorage.setItem(KEEP, id); } catch {}
  }

  $('apps').innerHTML = ok.map(([id, , label]) => `<button type="button" data-id="${id}" aria-pressed="false">${label}</button>`).join('');
  $('apps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(b.dataset.id); });

  $('styles').innerHTML = window.tronStyles.map((st, i) => `<section class="style" aria-labelledby="h-${st.id}">
      <div class="words"><span class="tag">${i ? 'Idea ' + i : 'Today'}</span><h2 id="h-${st.id}">${st.name}</h2><p class="muted">${st.about}</p></div>
      <div class="home">${ok.map(([id, , label]) => `<button type="button" data-id="${id}" aria-label="Show ${label} big"><img src="${drawn[id][st.id]}" alt=""><span>${label}</span></button>`).join('')}</div>
    </section>`).join('');
  $('styles').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) { choose(b.dataset.id); scrollTo({ top: 0, behavior: 'smooth' }); } });

  showBig();
})();
