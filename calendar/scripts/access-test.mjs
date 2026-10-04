// functions/_middleware.js: the Cloudflare Access check in front of every
// Pages Function. Makes its own RSA key (standing in for the Access team's),
// serves it as /cdn-cgi/access/certs, and checks that only a correctly signed,
// unexpired token for this team and application gets through to /api/.
//
//   node calendar/scripts/access-test.mjs
import { onRequest } from '../../functions/_middleware.js';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

const TEAM = 'https://allison.cloudflareaccess.com', AUD = 'aud-tag-123';
const b64u = b => Buffer.from(b).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256' };

let certFetches = 0;
globalThis.fetch = async url => {
  if (String(url) === TEAM + '/cdn-cgi/access/certs') { certFetches++; return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }); }
  return new Response('no', { status: 404 });
};

const now = Math.floor(Date.now() / 1000);
async function token({ iss = TEAM, aud = [AUD], exp = now + 3600, kid = 'k1', alg = 'RS256', key = privateKey, drop } = {}) {
  const head = { alg, kid, typ: 'JWT' }, body = { iss, aud, exp, iat: now, email: 'tom@example.com' };
  if (drop) delete body[drop];
  const h = b64u(JSON.stringify(head)), p = b64u(JSON.stringify(body));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p));
  return h + '.' + p + '.' + b64u(new Uint8Array(sig));
}
const call = async ({ path = '/calendar/api/events', jwt, env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } } = {}) => {
  let reached = false;
  const headers = jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {};
  const res = await onRequest({ request: new Request('https://tomallison24-news.pages.dev' + path, { headers }), env, next: async () => { reached = true; return new Response('ok'); } });
  return { reached, status: res.status };
};

ok('not set up yet: requests go through as before', (await call({ env: {} })).reached);
ok('not set up yet (only one of the two): still as before', (await call({ env: { ACCESS_TEAM_DOMAIN: TEAM } })).reached);
let r = await call();
ok('set up, no token: refused with 403', !r.reached && r.status === 403);
ok('set up, a page (not /api/): not checked', (await call({ path: '/calendar/' })).reached);
r = await call({ jwt: await token() });
ok('a good token: let through', r.reached, String(r.status));
ok('the team\'s keys were fetched once', certFetches === 1, String(certFetches));
await call({ jwt: await token() });
ok('and kept for the next request', certFetches === 1, String(certFetches));
const refused = async (label, jwt) => { const x = await call({ jwt }); ok(label + ': refused', !x.reached && x.status === 403); };
await refused('another application\'s token (aud)', await token({ aud: ['someone-else'] }));
await refused('another team\'s token (iss)', await token({ iss: 'https://evil.cloudflareaccess.com' }));
await refused('an expired token', await token({ exp: now - 10 }));
await refused('a token with no expiry', await token({ drop: 'exp' }));
await refused('a token with no audience', await token({ drop: 'aud' }));
await refused('signed with a different key', await token({ key: other.privateKey }));
await refused('an unknown key id', await token({ kid: 'nope' }));
await refused('alg none', await token({ alg: 'none' }));
const good = await token(), [h, p, s] = good.split('.');
const p2 = b64u(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), email: 'evil@example.com' }));
await refused('a good token with its payload changed', h + '.' + p2 + '.' + s);
await refused('garbage', 'not.a.jwt');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
