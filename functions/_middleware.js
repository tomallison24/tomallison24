// Runs in front of every Pages Function (calendar, travel, podcasts, weather, drinks).
//
// The functions use the owner's secrets (the iCloud password, the flight-status
// key) and until now relied only on Cloudflare Access standing in front of the
// site: their X-… header stops other web pages calling them, but not someone
// calling the address directly. If Access ever missed a hostname that serves
// this project (the *.pages.dev address, a preview deployment), the iCloud
// calendar could be read and changed by anyone.
//
// So every /api/ request must carry Access's own signed proof of who signed in
// (the Cf-Access-Jwt-Assertion header), checked here the way Cloudflare's
// Access plugin for Pages checks it: RS256, signed by a key from the team's
// /cdn-cgi/access/certs, issued by the team, for this Access application (its
// AUD tag), and not expired. Unlike the plugin, iss, aud and exp must be there.
//
// It is switched on by two Pages secrets, set from repository secrets of the
// same names by .github/workflows/news.yml:
//   ACCESS_TEAM_DOMAIN  https://<team>.cloudflareaccess.com
//   ACCESS_AUD          the Access application's Application Audience (AUD) tag
// Until both exist it lets requests through as before, so turning it on is a
// deliberate step (calendar/README.md, "Locking the server functions").

let certs = { url: '', keys: [], at: 0 };
const CERTS_TTL = 3600e3;

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  if (!new URL(request.url).pathname.includes('/api/')) return next();
  const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/+$/, '');
  const aud = String(env.ACCESS_AUD || '').trim();
  if (!team || !aud) return next();
  try {
    await verify(request.headers.get('Cf-Access-Jwt-Assertion'), team, aud);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'access' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store' },
    });
  }
  return next();
}

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const json = s => JSON.parse(new TextDecoder().decode(b64u(s)));

export async function verify(jwt, team, aud, now = Date.now()) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('no-jwt');
  const [h, p, sig] = parts;
  const head = json(h), body = json(p);
  if (head.alg !== 'RS256' || typeof head.kid !== 'string') throw new Error('alg');
  const origin = new URL(team).origin;
  if (body.iss !== origin) throw new Error('iss');
  const auds = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!auds.includes(aud)) throw new Error('aud');
  const t = now / 1000;
  if (typeof body.exp !== 'number' || t >= body.exp) throw new Error('exp');
  if (typeof body.nbf === 'number' && t < body.nbf - 60) throw new Error('nbf');
  const jwk = await keyFor(origin, head.kid, now);
  if (!jwk || jwk.kty !== 'RSA') throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('sig');
  return body;
}

// The team's signing keys, kept for an hour; fetched again early if a token
// names a key we don't have (Access rotates them).
async function keyFor(origin, kid, now) {
  const url = origin + '/cdn-cgi/access/certs';
  const fresh = certs.url === url && now - certs.at < CERTS_TTL;
  let k = fresh ? certs.keys.find(x => x.kid === kid) : null;
  if (k) return k;
  const res = await fetch(url, { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error('certs');
  const { keys } = await res.json();
  certs = { url, keys: Array.isArray(keys) ? keys : [], at: now };
  return certs.keys.find(x => x.kid === kid) || null;
}
