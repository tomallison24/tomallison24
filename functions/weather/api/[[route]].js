// Cloudflare Pages Function for the Weather app (weather/). The forecast radar's
// frames are numbered from the start of the latest HRRR model run, and the only
// place that says when that was is the Iowa Environmental Mesonet's
// refd_1080.json, which doesn't let a page on another site read it (CORS). So
// the app asks this, on its own site, to read it instead:
//
//   /weather/api/hrrr     { "model_init_utc": "…" } for the latest HRRR run
//
// It runs only where the site is on Cloudflare Pages (behind Cloudflare Access,
// like the rest of it); .github/workflows/news.yml deploys this functions/
// folder from the repository root. On GitHub Pages it is just a file, and the
// app goes without the forecast frames rather than guess their times.
//
// It fetches one fixed address and hands back one field, never anything else:
// requests must carry the X-Weather header (a link or a form can't add it), and
// the reply is JSON with nosniff and a sandbox CSP.

const SOURCE = 'https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refd_1080.json';
const UA = 'AllisonOS-Weather/1.0 (personal weather app)';
const TIMEOUT_MS = 15000;

export async function onRequestGet({ request, params }) {
  if (request.headers.get('X-Weather') !== '1') return reply('Not found', 404);
  const route = [].concat(params.route || []).join('/');
  if (route !== 'hrrr') return reply('Not found', 404);
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(SOURCE, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ac.signal, cf: { cacheTtl: 120 } });
    if (!r.ok) throw new Error('IEM answered ' + r.status);
    const j = await r.json();
    if (!j || !j.model_init_utc) throw new Error('No model_init_utc in the IEM file');
    return reply(JSON.stringify({ model_init_utc: String(j.model_init_utc).slice(0, 40) }), 200, 'application/json; charset=utf-8', 120);
  } catch (e) {
    return reply(JSON.stringify({ error: String(e && e.message || e).slice(0, 200) }), 502, 'application/json; charset=utf-8');
  } finally { clearTimeout(timer); }
}

function reply(body, status = 200, type = 'text/plain; charset=utf-8', maxAge = 0) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': maxAge ? `private, max-age=${maxAge}` : 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
