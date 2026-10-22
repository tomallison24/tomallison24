// home/welcome-lab.html: the Welcome Lab's buttons (its own file: the site's CSP header allows no inline scripts).
const W = AllisonOS.welcome;
for (const b of document.querySelectorAll('.opt')) b.onclick = () => {
  if (b.dataset.d === 'first') return W.play();
  if (b.dataset.d === 'app') return W.playApp('weather');
  if (b.dataset.d === 'install') { try { sessionStorage.removeItem('aos.later.weather'); } catch {} return W.playInstall('weather'); }
  // examples only, taken out again afterwards
  // the next versions after the newest in the log: x.y -> x.(y+1), and x -> x+1
  const R = W.data.RELEASES, now = W.data.latest(), [M, m = 0] = now.split('.').map(Number);
  const next = b.dataset.d === 'major' ? String(M + 1) : M + '.' + (m + 1);
  const ex = b.dataset.d === 'major'
    ? { v: next, highlights: ['An example highlight: a whole new look', 'Another: everything faster'], notes: ['A smaller note'] }
    : { v: next, notes: ['An example'], apps: { weather: { highlights: ['An example highlight: radar loads faster', 'Another: hourly rain chance'], notes: ['A smaller note, in aOS only'] } } };
  R.unshift(ex);
  const done = () => { const k = R.indexOf(ex); if (k >= 0) R.splice(k, 1); };
  (b.dataset.d === 'major' ? W.playUpdate('fitness', now, next) : W.playUpdate('weather', now, next)).then(done, done);
};
