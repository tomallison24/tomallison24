// Runs a browser group's tests side by side (.github/workflows/apps-check.yml): the runner has four
// cores and a browser test mostly waits (for a page, a tap's animation, a server), so several at once
// take about as long as the longest, not all of them in a row. Each test's output is kept and shown
// whole, in its own fold, as it finishes; every test runs even when one fails, and each failure is named.
//   TESTS="[NAME=value ...] <test> [args]\n..." JOBS=3 node .github/scripts/ci-run.mjs
import { spawn } from 'child_process';

const tests = String(process.env.TESTS || '').split('\n').map(t => t.trim()).filter(Boolean);
const jobs = Math.max(1, +process.env.JOBS || 3);
const gh = !!process.env.GITHUB_ACTIONS;
const failed = [];

function run(t) {
  return new Promise(done => {
    const t0 = Date.now(), out = [];
    const words = t.split(/\s+/), env = { ...process.env };
    while (/^[A-Z_]+=/.test(words[0])) { const [k, ...v] = words.shift().split('='); env[k] = v.join('='); }   // a line's own settings
    const p = spawn(process.execPath, words, { stdio: ['ignore', 'pipe', 'pipe'], env });
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => out.push(d));
    p.on('close', code => {
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      process.stdout.write((gh ? '::group::' : '== ') + `node ${t} (${secs}s${code ? ', failed' : ''})\n`);
      process.stdout.write(Buffer.concat(out));
      if (gh) process.stdout.write('::endgroup::\n');
      if (code) { failed.push(t); if (gh) process.stdout.write(`::error::node ${t} failed\n`); }
      done();
    });
  });
}

// the queue, in the group's order, so its longest tests (put first) start first
const queue = [...tests];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
if (failed.length) { console.log('Failed:\n' + failed.map(t => '  node ' + t).join('\n')); process.exit(1); }
console.log(`${tests.length} passed`);
