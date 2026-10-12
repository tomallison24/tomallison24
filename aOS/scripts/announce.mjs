// Tells the family "aOS updated to 1.x" (a notification that opens the Updates screen)
// when a release brings a new version, from the release workflow (.github/workflows/news.yml)
// once the site is published:
//   node aOS/scripts/announce.mjs https://tomallison24-news.pages.dev   (CLOUDFLARE_API_TOKEN set)
//   node aOS/scripts/announce.mjs --key                                  prints the key (see below)
// It tells the server (server/push.js, "announce/...") the newest version in the release log that
// isn't silent; the server tells each person with notifications on, once per version, however many
// merges release it again (the very first time it only notes the version). ANNOUNCE_AGAIN=true
// (Actions -> News -> Run workflow -> "announce again") tells everyone once more. It never fails the
// release: anything it can't do is a warning.
//
// The key between this and the Pages project is derived from the Cloudflare token (the workflow
// sets it as the Pages secret ANNOUNCE_KEY with --key), so there is nothing to set up. If the
// site is behind a Cloudflare Access policy that stops this call, give it a service token:
// the repository secrets ACCESS_CLIENT_ID and ACCESS_CLIENT_SECRET are sent if they exist.
import { createHmac } from 'crypto';
import fs from 'fs';
import { pathToFileURL } from 'url';

export const announceKey = token => createHmac('sha256', String(token)).update('aos-announce').digest('hex');

// The newest version in the release log (home/welcome.js) that isn't silent.
export function newestVersion(text) {
  const i = text.indexOf('const RELEASES = ['); if (i < 0) return null;
  const log = text.slice(i, text.indexOf('\n  ];', i) > 0 ? text.indexOf('\n  ];', i) : undefined);
  const heads = [...log.matchAll(/\{\s*v:\s*'([^']+)'([^\n]*)\n([^\n]*)/g)];
  for (const h of heads) if (!/\bsilent:\s*true/.test(h[2] + ' ' + h[3].split(/highlights|notes|apps/)[0])) return h[1];
  return null;
}

// -> a sentence for the log
export async function announce(base, key, version, { fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)), extra = {}, again = false } = {}) {
  const post = async (step, body) => {
    for (let tries = 0; ; tries++) {
      try {
        const res = await fetchImpl(`${base}/aOS/api/announce/${step}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...extra }, body: JSON.stringify(body) });
        let j = null; try { j = await res.json(); } catch {}
        if (res.ok && j) return j;
        // a deploy takes a moment to answer, so a "not found" or a non-answer is tried again
        if (tries >= 6 || (j && res.status !== 404)) throw new Error(`${step}: ${res.status}${j && j.error ? ' ' + j.error : ' (not the accounts server: is the site behind Cloudflare Access?)'}`);
      } catch (e) { if (tries >= 6 || /^[a-z]+: \d/.test(e.message)) throw e; }
      await wait(10000);
    }
  };
  const begin = await post('begin', { version, again });
  if (begin.already) return `aOS ${version} was already announced`;
  if (begin.first) return `aOS ${version} noted as the version everyone has: the next new version is announced`;
  let sent = 0, failed = 0;
  for (const p of begin.people || []) { const r = await post('send', { version, to: p.id || p, again }); sent += r.sent || 0; failed += (r.failed || 0) + (r.gone || 0); }
  await post('done', { version });
  return `Announced aOS ${version} to ${(begin.people || []).length} people on ${sent} phones${failed ? ` (${failed} didn't take it)` : ''}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.CLOUDFLARE_API_TOKEN || '';
  if (process.argv[2] === '--key') { if (!token) process.exit(1); process.stdout.write(announceKey(token)); }
  else {
    const base = (process.argv[2] || '').replace(/\/+$/, '');
    const version = newestVersion(fs.readFileSync(new URL('../../home/welcome.js', import.meta.url), 'utf8'));
    const extra = process.env.ACCESS_CLIENT_ID && process.env.ACCESS_CLIENT_SECRET ? { 'CF-Access-Client-Id': process.env.ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.ACCESS_CLIENT_SECRET } : {};
    if (!base || !token || !version) { console.log('::warning::Not announcing: needs the site address, the Cloudflare token and a version in the release log'); process.exit(0); }
    try { console.log(await announce(base, announceKey(token), version, { extra, again: process.env.ANNOUNCE_AGAIN === 'true' })); }
    catch (e) { console.log(`::warning::Couldn't announce aOS ${version}: ${e.message}`); }
  }
}
