// Cloudflare Pages Function for the Travel app (travel/): live flight status.
//
//   /travel/api/flight?no=UA1234&date=2026-10-16   status, times, gates for that flight
//   /travel/api/ping                                 {ok, status: true|false} - is it set up?
//
// It asks AeroDataBox (through RapidAPI) and keeps the key here, as a Pages
// secret, so it never reaches a phone. Set it once (travel/README.md, "Live
// flight status"): the AERODATABOX_KEY repository secret, which the News
// workflow copies to the Pages project on each deploy. Without it every
// lookup answers {error: 'no-key'} and the app says so.
//
// Like the Podcasts function, it runs only where the site is on Cloudflare
// Pages (behind Cloudflare Access). To keep it from being used for anything
// else:
// - requests must carry the X-Travel header, which a link or a form can't
//   add, so nothing can be opened here by visiting an address;
// - it only ever calls one fixed address, with a flight number and a date
//   checked against strict patterns - nothing from the request is used as a
//   host or path of its own;
// - answers are JSON with nosniff and a sandbox CSP;
// - each flight's answer is kept for 10 minutes, so two phones watching the
//   same flight, or quick re-opens, don't spend the monthly allowance twice.
//
// Sent to AeroDataBox: the flight number and the date. Nothing about who is
// travelling.

const HOST = 'aerodatabox.p.rapidapi.com';
const TIMEOUT_MS = 15000;
const CACHE_S = 600;

export async function onRequestGet({ request, params, env, waitUntil }) {
  if (request.headers.get('X-Travel') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const q = new URL(request.url).searchParams;
  const key = String(env.AERODATABOX_KEY || '').trim();

  if (route === 'ping') return reply({ ok: true, status: !!key });
  if (route !== 'flight') return reply({ error: 'not-found' }, 404);
  if (!key) return reply({ error: 'no-key' }, 503);

  const no = String(q.get('no') || '').toUpperCase().replace(/\s+/g, '');
  const date = String(q.get('date') || '');
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(no) || !/^20\d\d-\d\d-\d\d$/.test(date)) return reply({ error: 'bad-request' }, 400);

  const cache = caches.default;
  const cacheKey = new Request('https://travel-status.cache/' + no + '/' + date);
  const hit = await cache.match(cacheKey);
  if (hit) return reply(await hit.json());

  const url = 'https://' + HOST + '/flights/number/' + encodeURIComponent(no) + '/' + date + '?withAircraftImage=false&withLocation=false&dateLocalRole=Departure';
  let res;
  try {
    res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return reply({ error: 'unreachable' }, 502);
  }
  if (res.status === 204 || res.status === 404) return keep({ ok: true, found: false });
  if (res.status === 429) return reply({ error: 'limit' }, 429);
  if (res.status === 401 || res.status === 403) return reply({ error: 'key-refused' }, 502);
  if (!res.ok) return reply({ error: 'upstream-' + res.status }, 502);
  let data;
  try { data = await res.json(); } catch { return reply({ error: 'bad-upstream' }, 502); }
  const legs = (Array.isArray(data) ? data : [data]).filter(x => x && typeof x === 'object').map(trim);
  return keep({ ok: true, found: legs.length > 0, legs, at: Date.now() });

  function keep(body) {
    const r = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_S } });
    waitUntil(cache.put(cacheKey, r));
    return reply(body);
  }
}

// Only the parts the app shows. AeroDataBox's times look like
// {utc: "2026-10-16 13:05Z", local: "2026-10-16 07:05-06:00"}.
function trim(f) {
  const end = e => {
    e = e || {};
    const a = e.airport || {};
    const t = x => x && typeof x === 'object' ? { utc: s(x.utc), local: s(x.local) } : null;
    return {
      iata: s(a.iata), name: s(a.municipalityName || a.name), tz: s(a.timeZone),
      scheduled: t(e.scheduledTime), revised: t(e.revisedTime), predicted: t(e.predictedTime), runway: t(e.runwayTime),
      terminal: s(e.terminal), gate: s(e.gate), belt: s(e.baggageBelt), checkIn: s(e.checkInDesk),
    };
  };
  return {
    number: s(f.number), status: s(f.status), codeshare: s(f.codeshareStatus), cargo: !!f.isCargo,
    airline: s(f.airline && f.airline.name), aircraft: s(f.aircraft && f.aircraft.model),
    departure: end(f.departure), arrival: end(f.arrival), updated: s(f.lastUpdatedUtc),
  };
}
const s = v => v == null ? '' : String(v).slice(0, 120);

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
