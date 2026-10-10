// Cloudflare Worker that keeps the News headlines fresh: every 30 minutes it
// asks GitHub to run the News workflow (.github/workflows/news.yml, which
// fetches the feeds and republishes the live release).
//
// news.yml has its own schedule, but GitHub runs scheduled workflows when it
// has room - in practice every few hours, not every 30 minutes. Cloudflare's
// cron triggers fire on time, so this Worker starts the run instead (a
// workflow_dispatch, like pressing Run workflow in the Actions tab). If a News
// run already started in the last 20 minutes (GitHub's schedule did fire, or a
// merge released), it leaves it at that.
//
// Deployed by .github/workflows/news-tick.yml. Needs one secret, NEWS_TICK_TOKEN:
// a GitHub fine-grained token for this repository with Actions: Read and write
// (news/README.md, "Refreshing every 30 minutes").

export const WORKFLOW = 'news.yml';
export const RECENT_MS = 20 * 60e3;

export async function tick(env, { fetch: f = fetch, now = Date.now() } = {}) {
  const repo = env.REPO, token = env.NEWS_TICK_TOKEN;
  if (!repo || !token) return { ran: false, why: 'no-token' };
  const gh = (path, init = {}) => f('https://api.github.com/repos/' + repo + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'AllisonOS-news-tick', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const r = await gh('');
  if (!r.ok) return { ran: false, why: 'repo ' + r.status };
  const ref = (await r.json()).default_branch;
  const runs = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=1`);
  if (runs.ok) {
    const last = ((await runs.json()).workflow_runs || [])[0];
    if (last && now - Date.parse(last.created_at) < RECENT_MS) return { ran: false, why: 'recent' };
  }
  const d = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref, inputs: { release: '' } }) });
  return d.ok ? { ran: true, ref } : { ran: false, why: 'dispatch ' + d.status };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env).then(r => console.log(JSON.stringify(r))));
  },
  // Its workers.dev address has nothing to show; it only runs on the cron.
  async fetch() { return new Response('Not found', { status: 404 }); },
};
