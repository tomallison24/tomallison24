// Fitness's vitals alert, the schedule's side (.github/workflows/fitness-vitals.yml, hourly):
//   node fitness/scripts/vitals-check.mjs https://tomallison24-news.pages.dev   (CLOUDFLARE_API_TOKEN set)
// asks the site (functions/fitness/api, alerts/begin) who to check, then checks each one on their
// own (alerts/check): the server reads their newest vitals from Home Assistant, judges them as
// Fitness's Vitals tile does (fitness/health.js) and, if even one is off, notifies them through aOS,
// once a day at most. Nothing about anyone's readings comes back here or goes in the log: only how
// many were checked and alerted.
//
// Its key is derived from the one the release already puts on the Pages project (ANNOUNCE_KEY,
// itself derived from the Cloudflare token: aOS/scripts/announce.mjs), so there is nothing to set
// up. Without the Cloudflare token it does nothing. If the site is behind a Cloudflare Access
// policy that stops the call, the repository secrets ACCESS_CLIENT_ID and ACCESS_CLIENT_SECRET (an
// Access service token) are sent, as announce.mjs sends them. It never fails: a warning instead.
import { createHmac } from 'crypto';
import { pathToFileURL } from 'url';
import { announceKey } from '../../aOS/scripts/announce.mjs';

// HMAC-SHA256(ANNOUNCE_KEY, 'fitness-vitals'), as the server works it out (alertsKey).
export const vitalsKey = token => createHmac('sha256', announceKey(token)).update('fitness-vitals').digest('hex');

// -> a sentence for the log
export async function checkVitals(base, key, { fetchImpl = fetch, extra = {} } = {}) {
  const post = async (step, body) => {
    const res = await fetchImpl(`${base}/fitness/api/alerts/${step}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...extra }, body: JSON.stringify(body) });
    let j = null; try { j = await res.json(); } catch {}
    if (!res.ok || !j) throw new Error(`${step}: ${res.status}${j && j.error ? ' ' + j.error : ' (not the accounts server: is the site behind Cloudflare Access?)'}`);
    return j;
  };
  const { people = [] } = await post('begin', {});
  let alerted = 0, errors = 0;
  for (const id of people) {
    try { const r = await post('check', { to: id }); if (r.alerted) alerted++; if (r.error) errors++; }
    catch { errors++; }
  }
  // Only whether it ran: the workflow's log is public, so no counts of who was alerted.
  return errors ? `Done, but ${errors} couldn't be checked` : 'Done';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.CLOUDFLARE_API_TOKEN || '', base = (process.argv[2] || '').replace(/\/+$/, '');
  const extra = process.env.ACCESS_CLIENT_ID && process.env.ACCESS_CLIENT_SECRET ? { 'CF-Access-Client-Id': process.env.ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.ACCESS_CLIENT_SECRET } : {};
  if (!token || !base) { console.log('Vitals alerts: nothing to do without the CLOUDFLARE_API_TOKEN secret and the site address.'); process.exit(0); }
  try { console.log(await checkVitals(base, vitalsKey(token), { extra })); }
  catch (e) { console.log(`::warning::Couldn't check vitals: ${e.message}`); }
}
