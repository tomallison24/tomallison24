// Monarch's own MCP connector (https://api.monarch.com/mcp), read-only, for Money (functions/money/api).
// Not a route.
//
// Monarch's connector is the one its help pages give to Claude, ChatGPT and the rest: OAuth 2.1 with
// PKCE, the client registering itself (RFC 7591), then MCP's JSON-RPC over HTTPS. aOS is the client
// here: its server signs Money's reader in once (Settings > Connected accounts > Monarch), keeps the
// tokens in Workers KV, and reads with them. Only the read scope is ever asked for.
//
// Everything is found the way the MCP spec says (2025-06-18, Authorization), so nothing about
// Monarch's own setup is assumed: the protected resource's metadata (RFC 9728) names the
// authorization server, whose metadata (RFC 8414, or OpenID's) gives the endpoints.
//
// Kept in the accounts' Workers KV (server/auth.js lists the keys):
//   money:monarch          { access, refresh, exp, scope, at, by, client, ep } the sign-in
//   money:monarch:client   { id, secret, method, redirect, site, paste, at } aOS's registration with Monarch
//   money:monarch:meta     { auth, token, register, resource, scopes, at } the endpoints, for a day
//   money:monarch:auth:<state>  { verifier, by, redirect } a sign-in under way, for 10 minutes
//   money:monarch:test     the last test's result (counts and field names, no transactions)

import { getJSON, putJSON } from './auth.js';

export const MCP = 'https://api.monarch.com/mcp';
const PROTOCOL = '2025-06-18';
const json = async (r) => { try { return await r.json(); } catch { return null; } };
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const fail = (code, detail) => Object.assign(new Error(code), { status: 502, detail: String(detail || '').slice(0, 300) });

async function getMeta(url, f) {
  try { const r = await f(url, { headers: { Accept: 'application/json' } }); return r.ok ? await json(r) : null; } catch { return null; }
}

// The endpoints: the resource's metadata (its well-known address, else the one its 401 names), then
// the authorization server's.
export async function discover(db, f = fetch) {
  const cached = await getJSON(db, 'money:monarch:meta');
  if (cached && Date.now() - cached.at < 864e5) return cached;
  const u = new URL(MCP);
  let prm = await getMeta(u.origin + '/.well-known/oauth-protected-resource' + u.pathname, f) || await getMeta(u.origin + '/.well-known/oauth-protected-resource', f);
  if (!prm) {
    try {
      const r = await f(MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }) });
      const m = /resource_metadata="([^"]+)"/.exec(r.headers.get('www-authenticate') || '');
      if (m) prm = await getMeta(m[1], f);
    } catch {}
  }
  const as = String((prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers[0]) || u.origin).replace(/\/$/, '');
  const a = new URL(as), path = a.pathname === '/' ? '' : a.pathname;
  let asm = null;
  for (const url of [a.origin + '/.well-known/oauth-authorization-server' + path, a.origin + '/.well-known/openid-configuration' + path, as + '/.well-known/openid-configuration']) {
    asm = await getMeta(url, f);
    if (asm && asm.authorization_endpoint && asm.token_endpoint) break;
    asm = null;
  }
  if (!asm) throw fail('monarch-discovery', 'no authorization server metadata at ' + as);
  const meta = { auth: asm.authorization_endpoint, token: asm.token_endpoint, register: asm.registration_endpoint || '', resource: (prm && prm.resource) || MCP,
    scopes: asm.scopes_supported || (prm && prm.scopes_supported) || [], methods: asm.token_endpoint_auth_methods_supported || [], at: Date.now() };
  await putJSON(db, 'money:monarch:meta', meta);
  return meta;
}

// aOS registers itself once (Monarch shows the name on its consent screen). Monarch takes only the
// return addresses of the AI apps it supports and a computer's own (loopback) address, the one
// desktop apps listen on ("Redirect URI is not supported" for this site's own, Nov 2026). So aOS asks
// with its own address first, then a loopback one: Monarch then sends the browser to a page that
// can't open, and the reader pastes that page's address into Money (paste). The code in it is no use
// to anyone without the PKCE verifier, which never leaves aOS's server.
export const LOOPBACK = ['http://127.0.0.1:53280/callback', 'http://localhost:53280/callback'];
async function client(db, meta, site, f) {
  const have = await getJSON(db, 'money:monarch:client');
  if (have && have.site === site && have.id) return have;
  if (!meta.register) throw fail('monarch-no-registration', 'the authorization server takes no registrations');
  const method = meta.methods.length && !meta.methods.includes('none') ? (meta.methods.includes('client_secret_post') ? 'client_secret_post' : 'client_secret_basic') : 'none';
  let last = '';
  for (const redirect of [site, ...LOOPBACK]) {
    const loop = redirect !== site;
    const r = await f(meta.register, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({
      client_name: 'aOS Money', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: method, scope: 'read',
      application_type: loop ? 'native' : 'web' }) });
    const j = await json(r);
    if (r.ok && j && j.client_id) {
      const c = { id: j.client_id, secret: j.client_secret || '', method: j.token_endpoint_auth_method || method, redirect, site, paste: loop, at: Date.now() };
      await putJSON(db, 'money:monarch:client', c);
      return c;
    }
    last = (j && (j.error_description || j.error)) || 'HTTP ' + r.status;
    if (r.status >= 500) break;   // Monarch itself is down: no use trying another address
  }
  throw fail('monarch-registration', last);
}

// Step 1: where to send the reader to sign in to Monarch, read-only (paste: they'll bring the address back by hand,
// so the sign-in waits 30 minutes, not 10).
export async function start(db, me, site, f = fetch) {
  const meta = await discover(db, f), c = await client(db, meta, site, f), redirect = c.redirect;
  const verifier = rand(48), state = rand(24);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  await putJSON(db, 'money:monarch:auth:' + state, { verifier, by: me.id, redirect }, c.paste ? 1800 : 600);
  const u = new URL(meta.auth);
  u.search = new URLSearchParams({ response_type: 'code', client_id: c.id, redirect_uri: redirect, scope: 'read', state, code_challenge: challenge, code_challenge_method: 'S256', resource: meta.resource }).toString();
  return { url: u.toString(), state, paste: !!c.paste };
}

async function tokenCall(meta, c, params, f) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  const p = new URLSearchParams(Object.assign({ client_id: c.id, resource: meta.resource }, params));
  if (c.secret && c.method === 'client_secret_basic') headers.Authorization = 'Basic ' + btoa(encodeURIComponent(c.id) + ':' + encodeURIComponent(c.secret));
  else if (c.secret) p.set('client_secret', c.secret);
  const r = await f(meta.token, { method: 'POST', headers, body: p.toString() });
  const j = await json(r);
  if (!r.ok || !j || !j.access_token) throw fail('monarch-token', (j && (j.error_description || j.error)) || 'HTTP ' + r.status);
  return j;
}
const keep = (j, prev, extra) => Object.assign({}, prev, extra, { access: j.access_token, refresh: j.refresh_token || (prev && prev.refresh) || '', exp: Date.now() + (+j.expires_in || 3600) * 1000 - 60e3, scope: j.scope || (prev && prev.scope) || 'read' });

// Step 2: Monarch sent the reader back with a code; it becomes the tokens (only for whoever started it).
export async function finish(db, me, code, state, f = fetch) {
  const s = await getJSON(db, 'money:monarch:auth:' + state);
  if (!s || s.by !== me.id) throw Object.assign(new Error('monarch-state'), { status: 400 });
  await db.delete('money:monarch:auth:' + state);
  const meta = await discover(db, f), c = await getJSON(db, 'money:monarch:client');
  if (!c) throw fail('monarch-registration', 'no registration');
  const j = await tokenCall(meta, c, { grant_type: 'authorization_code', code, redirect_uri: s.redirect, code_verifier: s.verifier }, f);
  const t = keep(j, null, { by: me.id, at: Date.now() });
  await putJSON(db, 'money:monarch', t);
  return { ok: true, scope: t.scope };
}

async function access(db, f) {
  const t = await getJSON(db, 'money:monarch');
  if (!t) throw Object.assign(new Error('monarch-signin'), { status: 409 });
  if (t.exp > Date.now()) return t;
  if (!t.refresh) throw Object.assign(new Error('monarch-signin'), { status: 409 });
  const meta = await discover(db, f), c = await getJSON(db, 'money:monarch:client');
  let j;
  try { j = await tokenCall(meta, c, { grant_type: 'refresh_token', refresh_token: t.refresh }, f); }
  catch (e) { await db.delete('money:monarch'); throw Object.assign(new Error('monarch-signin'), { status: 409, detail: e.detail }); }
  const n = keep(j, t);
  await putJSON(db, 'money:monarch', n);
  return n;
}

// One JSON-RPC call to the connector; its answer comes as JSON or as a server-sent event.
async function rpc(ses, method, params, f) {
  const notify = method.startsWith('notifications/');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + ses.token };
  if (ses.id) headers['Mcp-Session-Id'] = ses.id;
  if (ses.ready) headers['MCP-Protocol-Version'] = ses.version || PROTOCOL;
  const id = notify ? undefined : ++ses.n;
  const r = await f(MCP, { method: 'POST', headers, body: JSON.stringify(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }) });
  if (r.status === 401) throw Object.assign(new Error('monarch-signin'), { status: 409 });
  if (r.status === 429) throw Object.assign(new Error('monarch-limit'), { status: 429 });
  const sid = r.headers.get('mcp-session-id'); if (sid) ses.id = sid;
  if (notify) return null;
  const text = await r.text();
  if (!r.ok) throw fail('monarch-mcp', method + ': HTTP ' + r.status + ' ' + text.slice(0, 200));
  let msg = null;
  if (/text\/event-stream/.test(r.headers.get('content-type') || '')) {
    for (const ev of text.split(/\r?\n\r?\n/)) {
      const data = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
      if (!data) continue;
      try { const m = JSON.parse(data); if (m && m.id === id) { msg = m; break; } } catch {}
    }
  } else { try { msg = JSON.parse(text); } catch {} }
  if (!msg) throw fail('monarch-mcp', method + ': no answer');
  if (msg.error) throw fail('monarch-mcp', method + ': ' + (msg.error.message || JSON.stringify(msg.error)));
  return msg.result;
}

export async function session(db, f = fetch) {
  const t = await access(db, f), ses = { token: t.access, n: 0 };
  const init = await rpc(ses, 'initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'aOS Money', version: '1' } }, f);
  ses.version = (init && init.protocolVersion) || PROTOCOL; ses.ready = true; ses.server = (init && init.serverInfo) || {};
  await rpc(ses, 'notifications/initialized', {}, f);
  return ses;
}
export const tools = async (ses, f = fetch) => ((await rpc(ses, 'tools/list', {}, f)) || {}).tools || [];
export async function call(ses, name, args, f = fetch) {
  const r = await rpc(ses, 'tools/call', { name, arguments: args }, f);
  if (r && r.isError) throw fail('monarch-tool', ((r.content || [])[0] || {}).text || name);
  if (r && r.structuredContent) return r.structuredContent;
  const text = ((r && r.content) || []).filter(c => c.type === 'text').map(c => c.text).join('');
  try { return JSON.parse(text); } catch { return text; }
}

// ---- reading transactions, whatever the connector's own names turn out to be ----
// The transactions tool: the one named for transactions, not a summary, split, rule or the like.
export function txTool(list) {
  const ok = list.filter(t => /transactions?$/i.test(String(t.name).replace(/[_-]/g, '')) && !/summary|split|recurring|review|rule|tag|bulk|update|create|delete|categor/i.test(t.name));
  return ok.find(t => /^get_?transactions$/i.test(t.name)) || ok[0] || null;
}
// Its arguments for a range of days, from its own input schema.
export function txArgs(tool, from, to, limit = 100) {
  const props = (tool && tool.inputSchema && tool.inputSchema.properties) || {}, args = {}, names = Object.keys(props);
  const pick = re => names.find(n => re.test(n));
  const s = pick(/^(start|from)(_?date)?$/i) || pick(/start/i), e = pick(/^(end|to)(_?date)?$/i) || pick(/end/i), l = pick(/^(limit|first|count|page_?size)$/i);
  if (s) args[s] = from; if (e) args[e] = to; if (l) args[l] = limit;
  return args;
}
// The longest list of things that look like transactions, anywhere in the answer.
export function findTx(v, depth = 0) {
  if (depth > 5 || !v || typeof v !== 'object') return [];
  if (Array.isArray(v)) {
    if (v.length && v.every(o => o && typeof o === 'object' && !Array.isArray(o)) && v.some(o => 'amount' in o || 'date' in o)) return v;
    return v.reduce((best, x) => { const f = findTx(x, depth + 1); return f.length > best.length ? f : best; }, []);
  }
  return Object.values(v).reduce((best, x) => { const f = findTx(x, depth + 1); return f.length > best.length ? f : best; }, []);
}
const name = v => typeof v === 'string' ? v : v && typeof v === 'object' ? (v.displayName || v.name || v.title || '') : '';
// One transaction in Money's own words: Monarch's amounts are negative for money out.
export function normTx(o) {
  const amt = Number(o.amount);
  return {
    id: String(o.id || o.transactionId || ''),
    date: String(o.date || o.transactionDate || '').slice(0, 10),
    amt: isFinite(amt) ? Math.round(Math.abs(amt) * 100) / 100 : null,
    dir: isFinite(amt) ? (amt < 0 ? 'out' : 'in') : '',
    merchant: name(o.merchant) || o.merchantName || o.plaidName || o.originalName || '',
    account: name(o.account) || o.accountName || o.accountDisplayName || '',
    cat: name(o.category) || o.categoryName || '',
    pending: !!(o.pending || o.isPending),
  };
}
// The keys a transaction has (and those of the things inside it), so a test shows what Monarch gives.
export const shape = o => Object.entries(o || {}).map(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) ? k + '{' + Object.keys(v).slice(0, 8).join(',') + '}' : k).slice(0, 40);
