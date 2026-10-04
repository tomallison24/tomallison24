// Adds outings from the iCloud Family calendar to Places, through the Notes
// Google Sheet that Places syncs with. Run by .github/workflows/places-calendar.yml
// every few hours; which events count, and what they change, is places/calendar.mjs.
//
// It reads the calendar with the Calendar app's own code (functions/calendar/api,
// the same Apple ID and app-specific password), asks Photon (OpenStreetMap) where
// each new event's location is, and sends the Sheet only the places it adds or
// changes. The phones pick them up on their next sync.
//
// Environment (repository secrets):
//   ICLOUD_APPLE_ID, ICLOUD_APP_PASSWORD, ICLOUD_CALENDAR (optional, default Family)
//   NOTES_SHEET_URL, NOTES_SHEET_SECRET   the Notes Sheet's web app link and secret
//   PLACES_TZ (optional)                   for the rare event written in UTC
// State: .cache-places/seen.json (kept by the workflow's cache), so an event is
// looked up once rather than every run. The log shows counts only, never event
// titles or places, since workflow logs can be read by anyone who can see the repo.
//
//   node places/scripts/from-calendar.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readEvent, worthLooking, searchFor, pickVenue, plan } from '../calendar.mjs';

const env = process.env;
const need = ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORD', 'NOTES_SHEET_URL', 'NOTES_SHEET_SECRET'].filter(k => !env[k]);
if (need.length) { console.log('Not set up yet (missing ' + need.join(', ') + '). See places/README.md, "From your calendar".'); process.exit(0); }

const icalSrc = fs.readFileSync(new URL('../../calendar/ical.js', import.meta.url), 'utf8');
await import('data:text/javascript,' + encodeURIComponent(icalSrc));
const I = globalThis.AllisonICal;
// The Calendar function keeps where the calendar lives in Cloudflare's cache; here, just forget it.
globalThis.caches = globalThis.caches || { default: { match: async () => undefined, put: async () => {}, delete: async () => true } };
const { onRequest } = await import(new URL('../../functions/calendar/api/%5B%5Broute%5D%5D.js', import.meta.url));

const DAY = 864e5, now = Date.now();
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const STATE = '.cache-places/seen.json';
const seen = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = s => crypto.createHash('sha1').update(s).digest('hex');

// ---- the calendar: a year back and a year ahead ----
const res = await onRequest({
  request: new Request(`https://local/calendar/api/events?start=${stamp(now - 365 * DAY)}&end=${stamp(now + 365 * DAY)}`, { headers: { 'X-Calendar': '1' } }),
  params: { route: ['events'] },
  env: { ICLOUD_APPLE_ID: env.ICLOUD_APPLE_ID, ICLOUD_APP_PASSWORD: env.ICLOUD_APP_PASSWORD, ICLOUD_CALENDAR: env.ICLOUD_CALENDAR || '' },
});
const cal = await res.json();
if (!cal.ok) { console.error('::error::Couldn’t read the calendar: ' + (cal.error || res.status)); process.exit(1); }
const vcals = cal.items.flatMap(it => I.parseAll(it.ics).filter(c => c.name === 'VCALENDAR'));
const tzCount = {};
for (const v of vcals) for (const e of I.children(v, 'VEVENT')) { const t = I.dateProp(e, 'DTSTART'); if (t && t.tzid) tzCount[t.tzid] = (tzCount[t.tzid] || 0) + 1; }
const tz = env.PLACES_TZ || Object.entries(tzCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UTC';
const events = [];
for (const v of vcals) for (const ev of I.children(v, 'VEVENT')) if (!I.prop(ev, 'RECURRENCE-ID')) { const e = readEvent(I, v, ev, tz); if (e) events.push(e); }
const candidates = events.filter(worthLooking);
console.log(`${events.length} events in the calendar; ${candidates.length} one-off events with a location and a title that could be an outing.`);

// ---- where each one happened (Photon), once per event ----
let looked = 0;
for (const e of candidates) {
  const key = hash(e.uid + '|' + e.where.text + '|' + e.where.lat + ',' + e.where.lon);
  e.key = key;
  if (seen[key]) continue;
  if (looked >= 80) break;                            // the rest next run (Photon asks for fair use)
  const s = searchFor(e);
  if (!s.q) { seen[key] = { venue: null, at: now }; continue; }
  const u = 'https://photon.komoot.io/api/?limit=8&lang=en&q=' + encodeURIComponent(s.q) + (s.lat != null ? `&lat=${s.lat}&lon=${s.lon}` : '');
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'AllisonOS-Places/1.0 (personal app)' } });
    if (!r.ok) throw new Error('Photon ' + r.status);
    seen[key] = { venue: pickVenue(e, (await r.json()).features), at: now };
  } catch (err) { console.log('Photon: ' + err.message + ' (will retry next run)'); }
  looked++;
  await sleep(1100);
}
const found = candidates.filter(e => seen[e.key] && seen[e.key].venue).map(e => ({ event: e, venue: seen[e.key].venue }));
console.log(`Looked up ${looked} new locations; ${found.length} events were at restaurants, bars, museums and the like.`);
fs.mkdirSync('.cache-places', { recursive: true });
fs.writeFileSync(STATE, JSON.stringify(seen));

// ---- the Sheet ----
async function sheet(body) {
  const r = await fetch(env.NOTES_SHEET_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ secret: env.NOTES_SHEET_SECRET, action: 'places', v: 1, graves: {} }, body)) });
  let j; try { j = await r.json(); } catch { throw new Error('the Sheet didn’t answer like the Notes script (check NOTES_SHEET_URL ends in /exec)'); }
  if (!j.ok) throw new Error(j.error || 'the Sheet refused');
  if (!Array.isArray(j.places)) throw new Error('the Sheet’s script needs updating for Places (Notes README, “Changing the script later”)');
  return j.places;
}
try {
  const places = await sheet({ places: [] });
  const w = I.utcToZoned(now, tz), today = `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
  const changes = plan(found, places, today, now, uid => 'pc' + hash(uid).slice(0, 14));
  if (changes.length) await sheet({ places: changes });
  const added = changes.filter(p => !places.some(x => x.id === p.id)).length;
  console.log(`Places: ${added} added, ${changes.length - added} updated.`);
} catch (err) { console.error('::error::' + err.message); process.exit(1); }
