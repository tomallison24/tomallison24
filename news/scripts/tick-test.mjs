// Tests the News tick Worker (news/tick) against a stand-in GitHub API.
//   node news/scripts/tick-test.mjs
import { tick, RECENT_MS } from '../tick/worker.js';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };
const NOW = Date.UTC(2026, 9, 10, 12, 15);
const env = { REPO: 'tomallison24/tomallison24', NEWS_TICK_TOKEN: 'tok' };

function github({ lastRun = null, repoStatus = 200, dispatchStatus = 204 } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers, body: init.body });
    const path = url.replace('https://api.github.com/repos/tomallison24/tomallison24', '');
    if (path === '') return new Response(JSON.stringify({ default_branch: 'main-ish' }), { status: repoStatus });
    if (path.startsWith('/actions/workflows/news.yml/runs')) return new Response(JSON.stringify({ workflow_runs: lastRun ? [{ created_at: new Date(lastRun).toISOString() }] : [] }));
    if (path === '/actions/workflows/news.yml/dispatches') return new Response(null, { status: dispatchStatus });
    return new Response('?', { status: 404 });
  };
  return { f, calls };
}

{
  const g = github({ lastRun: NOW - 40 * 60e3 });
  const r = await tick(env, { fetch: g.f, now: NOW });
  const d = g.calls.find(c => c.method === 'POST');
  ok('runs News when the last run is old', r.ran === true);
  ok('dispatches news.yml on the default branch, as a refresh (no release)', d && d.url.endsWith('/actions/workflows/news.yml/dispatches') && JSON.parse(d.body).ref === 'main-ish' && JSON.parse(d.body).inputs.release === '');
  ok('signs in with the token', g.calls.every(c => c.headers.Authorization === 'Bearer tok'));
}
{
  const g = github({ lastRun: NOW - RECENT_MS + 60e3 });
  const r = await tick(env, { fetch: g.f, now: NOW });
  ok('leaves it when News ran in the last 20 minutes', !r.ran && r.why === 'recent' && !g.calls.some(c => c.method === 'POST'));
}
{
  const g = github();
  ok('runs News when it has never run', (await tick(env, { fetch: g.f, now: NOW })).ran);
}
{
  const g = github();
  const r = await tick({ REPO: env.REPO }, { fetch: g.f, now: NOW });
  ok('does nothing without a token', !r.ran && r.why === 'no-token' && g.calls.length === 0);
}
{
  const g = github({ repoStatus: 401 });
  const r = await tick(env, { fetch: g.f, now: NOW });
  ok('says so when the token is refused', !r.ran && r.why === 'repo 401' && !g.calls.some(c => c.method === 'POST'));
}
{
  const g = github({ dispatchStatus: 403 });
  const r = await tick(env, { fetch: g.f, now: NOW });
  ok('says so when the run is refused (token without Actions: write)', !r.ran && r.why === 'dispatch 403');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
