// Cloudflare Pages Function for the Calendar app (calendar/): the iCloud
// Family calendar over CalDAV.
//
//   GET    /calendar/api/ping                       {ok, configured, calendar:{name,color}} or {error}
//   GET    /calendar/api/events?start=…Z&end=…Z     every event touching that time (UTC, YYYYMMDDTHHMMSSZ):
//                                                   {ok, items:[{name, etag, ics}]}
//   PUT    /calendar/api/event?name=<file>.ics      write one event's .ics text (body). If-Match: <etag>
//                                                   to update what was read; overwrite=1 to write
//                                                   regardless; otherwise only a new file is allowed.
//   DELETE /calendar/api/event?name=<file>.ics      If-Match optional.
//   POST   /calendar/api/import                     .ics text with one or more VEVENTs (Travel, Notes):
//                                                   each becomes its own file named after its UID.
//   POST   /calendar/api/forget                     forget where the calendar is, look it up again.
//   GET    /calendar/api/diagnose                   the three lookups, step by step, with numbers and
//                                                   long ids masked, for when the calendar isn't found.
//
// A browser can't talk to iCloud's CalDAV server itself (it refuses pages
// from other sites, and the password would have to live on the phone), so
// this does, with the Apple ID and an app-specific password kept here as
// Pages secrets (calendar/README.md, "Set up"): ICLOUD_APPLE_ID,
// ICLOUD_APP_PASSWORD, and optionally ICLOUD_CALENDAR (default "Family").
// The News workflow copies them to the Pages project on each deploy.
//
// Finding the calendar takes three PROPFINDs (the account's principal, its
// calendar home, the list of calendars); the answer is kept for a day.
//
// Like the Travel and Podcasts functions it runs only where the site is on
// Cloudflare Pages (behind Cloudflare Access). To keep it from being used for
// anything else:
// - requests must carry the X-Calendar header, which a link or a form can't
//   add, so nothing can be opened here by visiting an address;
// - it only ever talks to *.icloud.com, following iCloud's own redirects and
//   nothing else, and file names are checked against a strict pattern, so
//   nothing from a request becomes a host or a path of its own;
// - what is written must look like an iCalendar file and stay under 512 KB;
// - answers are JSON with nosniff and a sandbox CSP.

const ROOT = 'https://caldav.icloud.com/';
const HOST_OK = /^([a-z0-9-]+\.)*icloud\.com$/i;
const NAME_OK = /^[A-Za-z0-9._%@+~-]{1,255}$/;
const TIME_OK = /^\d{8}T\d{6}Z$/;
const TIMEOUT_MS = 20000;
const MAX_BODY = 512 * 1024;
const DISCOVERY_S = 86400;

export async function onRequest(ctx) {
  const { request, params, env } = ctx;
  if (request.headers.get('X-Calendar') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const q = new URL(request.url).searchParams;
  const method = request.method.toUpperCase();
  const acct = { id: String(env.ICLOUD_APPLE_ID || '').trim(), pw: String(env.ICLOUD_APP_PASSWORD || '').trim(), name: String(env.ICLOUD_CALENDAR || '').trim() || 'Family' };
  const configured = !!(acct.id && acct.pw);

  if (route === 'ping' && method === 'GET') {
    if (!configured) return reply({ ok: true, configured: false });
    try { const cal = await discover(acct); return reply({ ok: true, configured: true, calendar: { name: cal.name, color: cal.color } }); }
    catch (e) { return reply({ ok: true, configured: true, error: code(e), calendars: e.calendars || undefined }); }
  }
  if (!configured) return reply({ error: 'no-account' }, 503);
  try {
    if (route === 'forget' && method === 'POST') { await caches.default.delete(discoveryKey(acct)); return reply({ ok: true }); }
    if (route === 'diagnose' && method === 'GET') {
      const trace = [];
      let found = null, failed = null;
      try { found = await findCalendar(acct, trace); } catch (e) { failed = code(e); }
      return reply({ ok: true, found: found ? { name: found.name, color: found.color } : null, failed, trace });
    }
    const cal = await discover(acct);
    if (route === 'events' && method === 'GET') return reply(await listEvents(cal, acct, q.get('start'), q.get('end')));
    if (route === 'event' && method === 'PUT') return reply(await putEvent(cal, acct, q.get('name'), await readBody(request), request.headers.get('If-Match'), q.get('overwrite') === '1'));
    if (route === 'event' && method === 'DELETE') return reply(await deleteEvent(cal, acct, q.get('name'), request.headers.get('If-Match')));
    if (route === 'import' && method === 'POST') return reply(await importEvents(cal, acct, await readBody(request)));
  } catch (e) {
    return reply({ error: code(e), calendars: e.calendars || undefined }, e.status || 502);
  }
  return reply({ error: 'not-found' }, 404);
}

// ---- talking to iCloud ----
const err = (c, status, extra) => Object.assign(new Error(c), { code: c, status: status || 502 }, extra || {});
const code = e => e && e.code ? e.code : e && e.name === 'TimeoutError' ? 'unreachable' : 'unreachable';

// One CalDAV request, with iCloud's redirects followed (only to icloud.com)
// and the address it ended up at, so relative hrefs resolve against it.
async function dav(url, acct, init, hops = 0) {
  let u;
  try { u = new URL(url); } catch { throw err('bad-upstream'); }
  if (u.protocol !== 'https:' || !HOST_OK.test(u.hostname)) throw err('bad-host');
  let res;
  try {
    res = await fetch(u.href, {
      method: init.method, body: init.body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: Object.assign({ Authorization: 'Basic ' + btoa(acct.id + ':' + acct.pw), 'User-Agent': 'AllisonOS-Calendar/1.0' }, init.headers || {}),
    });
  } catch { throw err('unreachable'); }
  if ([301, 302, 307, 308].includes(res.status)) {
    const loc = res.headers.get('Location');
    if (!loc || hops >= 5) throw err('bad-upstream');
    return dav(new URL(loc, u.href).href, acct, init, hops + 1);
  }
  if (res.status === 401 || res.status === 403) throw err('auth');
  return { res, url: u.href };
}

const XML = '<?xml version="1.0" encoding="utf-8"?>';
const NS = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:a="http://apple.com/ns/ical/"';
const propfind = (url, acct, depth, props) => dav(url, acct, { method: 'PROPFIND', headers: { Depth: String(depth), 'Content-Type': 'application/xml; charset=utf-8' }, body: XML + '<d:propfind ' + NS + '><d:prop>' + props + '</d:prop></d:propfind>' });

// A tag's inner text, whatever its namespace prefix; null when absent or empty.
function tag(s, name) {
  const m = new RegExp('<(?:[\\w.-]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?' + name + '>', 'i').exec(s || '');
  return m ? m[1] : null;
}
const hasTag = (s, name) => new RegExp('<(?:[\\w.-]+:)?' + name + '(?:\\s[^>]*)?\\/?>', 'i').test(s || '');
const unxml = s => String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function responses(xml) {
  const out = [];
  const re = /<(?:[\w.-]+:)?response(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?response>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    // Only the propstat that succeeded holds values; a 404 one lists what the server lacks.
    const ok = [...block.matchAll(/<(?:[\w.-]+:)?propstat(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?propstat>/gi)].map(x => x[1]).filter(p => /HTTP\/1\.[01] 2\d\d/.test(tag(p, 'status') || 'HTTP/1.1 200')).join('');
    out.push({ href: unxml(tag(block, 'href')).trim(), props: ok || block });
  }
  return out;
}
const lastSegment = href => { const parts = href.replace(/\/+$/, '').split('/'); return parts[parts.length - 1]; };

// Where the calendar lives: {url, name, color}. Kept for a day.
const discoveryKey = acct => new Request('https://calendar-discovery.cache/' + encodeURIComponent(acct.id) + '/' + encodeURIComponent(acct.name));
async function discover(acct) {
  const cache = caches.default, key = discoveryKey(acct);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const cal = await findCalendar(acct);
  await cache.put(key, new Response(JSON.stringify(cal), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + DISCOVERY_S } }));
  return cal;
}
// Numbers and long ids replaced, so a trace can be read without giving
// away the account's ids.
const mask = s => String(s == null ? '' : s).replace(/[0-9A-Fa-f]{8,}/g, '…').replace(/\d{3,}/g, '#').slice(0, 2500);
async function findCalendar(acct, trace) {
  const note = (step, r, text, extra) => { if (trace) trace.push(Object.assign({ step, host: new URL(r.url).host, status: r.res.status, responses: responses(text).length, sample: mask(text) }, extra || {})); };
  const r1 = await propfind(ROOT, acct, 0, '<d:current-user-principal/>');
  const t1 = await r1.res.text();
  const principal = unxml(tag(tag(t1, 'current-user-principal') || '', 'href') || '').trim();
  note('principal', r1, t1, { principal: mask(principal) });
  if (!principal) throw err('bad-upstream');
  const r2 = await propfind(new URL(principal, r1.url).href, acct, 0, '<c:calendar-home-set/>');
  const t2 = await r2.res.text();
  const home = unxml(tag(tag(t2, 'calendar-home-set') || '', 'href') || '').trim();
  note('home', r2, t2, { home: mask(home) });
  if (!home) throw err('bad-upstream');
  const r3 = await propfind(new URL(home, r2.url).href, acct, 1, '<d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><a:calendar-color/><cs:getctag/>');
  const t3 = await r3.res.text();
  note('calendars', r3, t3);
  const cals = [];
  for (const r of responses(t3)) {
    if (!hasTag(r.props, 'calendar') || !r.href) continue;
    const comps = tag(r.props, 'supported-calendar-component-set');
    if (comps && !/name="VEVENT"/i.test(comps)) continue;
    const name = unxml(tag(r.props, 'displayname') || '').trim();
    const color = unxml(tag(r.props, 'calendar-color') || '').trim().slice(0, 9);
    cals.push({ url: new URL(r.href, r3.url).href.replace(/\/?$/, '/'), name, color: /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color) ? color.slice(0, 7) : '' });
  }
  const want = acct.name.toLowerCase();
  const cal = cals.find(c => c.name.toLowerCase() === want) || cals.find(c => c.name.toLowerCase().includes(want));
  if (!cal) throw err('no-calendar', 502, { calendars: cals.map(c => c.name).filter(Boolean) });
  return cal;
}

// ---- events ----
async function listEvents(cal, acct, start, end) {
  if (!TIME_OK.test(start || '') || !TIME_OK.test(end || '') || start >= end) throw err('bad-request', 400);
  const body = XML + '<c:calendar-query ' + NS + '><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="' + start + '" end="' + end + '"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>';
  const { res } = await dav(cal.url, acct, { method: 'REPORT', headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }, body });
  if (res.status === 404) { await caches.default.delete(discoveryKey(acct)); throw err('no-calendar'); }
  if (res.status < 200 || res.status >= 300) throw err('upstream-' + res.status);
  const items = [];
  for (const r of responses(await res.text())) {
    const ics = unxml(tag(r.props, 'calendar-data') || '');
    if (!/BEGIN:VCALENDAR/i.test(ics)) continue;
    const name = lastSegment(r.href);
    if (!NAME_OK.test(name)) continue;
    items.push({ name, etag: unxml(tag(r.props, 'getetag') || '').trim(), ics });
  }
  return { ok: true, items, calendar: { name: cal.name, color: cal.color } };
}

async function readBody(request) {
  const len = +request.headers.get('Content-Length');
  if (len > MAX_BODY) throw err('too-big', 413);
  const text = await request.text();
  if (text.length > MAX_BODY) throw err('too-big', 413);
  return text;
}
const looksLikeCalendar = ics => /^\s*BEGIN:VCALENDAR/i.test(ics) && /BEGIN:VEVENT/i.test(ics) && /END:VCALENDAR\s*$/i.test(ics);

async function putEvent(cal, acct, name, ics, ifMatch, overwrite) {
  if (!name || !NAME_OK.test(name) || !/\.ics$/i.test(name)) throw err('bad-request', 400);
  if (!looksLikeCalendar(ics)) throw err('bad-request', 400);
  const headers = { 'Content-Type': 'text/calendar; charset=utf-8' };
  if (ifMatch) headers['If-Match'] = ifMatch;
  else if (!overwrite) headers['If-None-Match'] = '*';
  const { res } = await dav(cal.url + name, acct, { method: 'PUT', headers, body: ics });
  if (res.status === 412) throw err('changed', 412);
  if (res.status < 200 || res.status >= 300) throw err('upstream-' + res.status);
  return { ok: true, name, etag: res.headers.get('ETag') || '' };
}

async function deleteEvent(cal, acct, name, ifMatch) {
  if (!name || !NAME_OK.test(name) || !/\.ics$/i.test(name)) throw err('bad-request', 400);
  const headers = {};
  if (ifMatch) headers['If-Match'] = ifMatch;
  const { res } = await dav(cal.url + name, acct, { method: 'DELETE', headers });
  if (res.status === 412) throw err('changed', 412);
  if (res.status === 404) return { ok: true, name, gone: true };
  if (res.status < 200 || res.status >= 300) throw err('upstream-' + res.status);
  return { ok: true, name };
}

// Each VEVENT in the text becomes its own file, named after its UID, with
// the file's own header lines and time zones; the same UID written again
// replaces the event (so Travel can re-send a changed booking).
async function importEvents(cal, acct, ics) {
  if (!looksLikeCalendar(ics)) throw err('bad-request', 400);
  const text = ics.replace(/\r?\n/g, '\r\n');
  const events = [...text.matchAll(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g)].map(m => m[0]);
  const zones = [...text.matchAll(/BEGIN:VTIMEZONE\r\n[\s\S]*?END:VTIMEZONE\r\n/g)].map(m => m[0]).join('');
  const head = text.split('\r\n').filter(l => /^(VERSION|PRODID|CALSCALE|METHOD):/i.test(l)).join('\r\n');
  if (!events.length || events.length > 50) throw err('bad-request', 400);
  const names = [];
  for (const ev of events) {
    const uid = (/^UID:(.+)$/m.exec(ev) || [])[1];
    if (!uid) throw err('bad-request', 400);
    const name = uid.trim().replace(/[^A-Za-z0-9._@-]+/g, '-').slice(0, 200) + '.ics';
    const file = 'BEGIN:VCALENDAR\r\n' + (head || 'VERSION:2.0\r\nPRODID:-//Allison OS//Calendar//EN') + '\r\n' + zones + ev + 'END:VCALENDAR\r\n';
    await putEvent(cal, acct, name, file, null, true);
    names.push(name);
  }
  return { ok: true, names, calendar: { name: cal.name, color: cal.color } };
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
