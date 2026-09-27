"use strict";

// Refuse to run inside another page's frame. A hostile site could otherwise
// lay the app, invisible, under its own buttons and steer your taps onto Trash
// or Block (clickjacking). The proper guard is a frame-ancestors header, which
// GitHub Pages can't send; this does the same job from inside the page. The
// home-screen app is never framed, so it never sees this.
if (window.top !== window.self) {
  document.body.textContent = 'Mail can’t be opened inside another page.';
  throw new Error('Mail refuses to run inside a frame');
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// The app's OAuth client (Google Cloud -> Credentials -> Web application).
// Not a secret: it appears in every sign-in URL, and Google only hands tokens
// to the redirect URIs registered against it. Built in, it wins over anything
// a device has saved, so every device signs in with no setup and a bad copy
// pasted on one phone can't lock it out. Empty it to go back to per-device
// setup (e.g. to run a fork against your own client).
const BUILT_IN_CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',          // label, move, trash
  'https://www.googleapis.com/auth/gmail.settings.basic',  // the domain filters
];
const K = {
  clientId: 'mail.clientId', token: 'mail.token', state: 'mail.state',
  lastAuth: 'mail.lastAuth', days: 'mail.days', label: 'mail.label', swept: 'mail.swept',
  hint: 'mail.hint', silent: 'mail.silent', chips: 'mail.chips', swipeHint: 'mail.swipeHint', pending: 'mail.pending', unsubbed: 'mail.unsubbed', badge: 'mail.badge',
};
const SWEEP_EVERY = 6 * 3600e3;   // don't re-sweep on every open
const PAGE = 40;                  // conversations shown per list

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.round(s / 60) + 'm';
  if (s < 86400) return Math.round(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.round(s / 86400) + 'd';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const settings = {
  get days() { const n = parseInt(ls.get(K.days, '3'), 10); return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 3; },
  set days(v) { ls.set(K.days, String(v)); },
  get label() { return ls.get(K.label, 'Marketing') || 'Marketing'; },
  set label(v) { ls.set(K.label, v); },
};

// A client ID is only letters, digits, dots and dashes. Copying one through
// Messages, Notes or an email can add characters that can't be seen - a
// zero-width or non-breaking space - and Google then answers "invalid_client:
// the OAuth client was not found". Keeping only the legal characters also
// repairs a bad copy already saved on a device.
const cleanClientId = raw => String(raw || '').replace(/[^A-Za-z0-9.\-]/g, '');
const clientId = () => cleanClientId(BUILT_IN_CLIENT_ID || ls.get(K.clientId, ''));

// Says what is wrong with a pasted value, or nothing when it looks right.
function clientIdProblem(id) {
  if (!id) return 'Paste the client ID first.';
  if (/^GOCSPX/i.test(id)) return 'That is the client secret. Paste the Client ID from the same page - it ends in .apps.googleusercontent.com.';
  if (!/\.apps\.googleusercontent\.com$/.test(id)) return 'A client ID ends in .apps.googleusercontent.com. This one does not, so it was probably cut short while copying.';
  return null;
}

// ---------------------------------------------------------------------------
// Sign-in: OAuth 2.0 implicit flow, by full-page redirect
// ---------------------------------------------------------------------------
class AuthError extends Error {}
// Gmail allows each user so many "quota units" a minute. Past that it answers
// 429 (or 403 rateLimitExceeded) until the minute rolls over, so hammering it
// with quick retries only digs deeper. One short retry, then a pause.
class QuotaError extends Error {}
const COOLDOWN = Number(localStorage.getItem('mail.cooldown')) || 60000;   // (the tests shorten this)
let slowUntil = 0;
const slowed = () => Date.now() < slowUntil;

function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function getToken() {
  try {
    const o = JSON.parse(ls.get(K.token, 'null'));
    if (o && o.exp > Date.now()) return o;
  } catch {}
  return null;
}

const canFilter = () => (getToken()?.scope || '').includes('gmail.settings.basic');

// Google gives a browser-only app an access token for an hour and no way to
// renew it in the background. So when it runs out the app goes back through
// Google - silently: prompt=none makes Google answer at once with a token, or
// with interaction_required if it can't, and never shows a screen. login_hint
// names the account, so having several signed in doesn't bring up a chooser.
function signIn(opts = {}) {
  const id = clientId();
  if (!id) return;
  const hint = ls.get(K.hint, '');
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  // localStorage, not sessionStorage: on iOS the trip through Google can come
  // back in a fresh page context and a lost nonce would look like tampering.
  ls.set(K.state, nonce);
  ls.set(K.lastAuth, String(Date.now()));
  const u = new URL(AUTH);
  u.search = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
    state: nonce,
    ...(opts.chooseAccount ? { prompt: 'select_account' } : hint ? { login_hint: hint } : {}),
    ...(opts.silent && !opts.chooseAccount ? { prompt: 'none' } : {}),
  });
  if (opts.silent) ls.set(K.silent, '1'); else ls.del(K.silent);
  location.href = u.toString();
}

// Sign Out means signed out: Google cancels the token now rather than at the
// end of its hour, and the phone forgets the account. Clearing "ever" matters
// most - while it was set, the next open quietly signed straight back in.
// Google's answer can't be read from here (no-cors), so Sign Out goes ahead
// whether or not it arrives; the token still dies within the hour.
function signOut() {
  const tok = getToken()?.t;
  if (tok) fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    body: new URLSearchParams({ token: tok }),
  }).catch(() => {});
  for (const k of [K.token, K.token + '.ever', K.state, K.lastAuth, K.silent, K.hint, K.pending, K.unsubbed]) ls.del(k);
  rowCache.clear();
  try { navigator.clearAppBadge?.().catch(() => {}); } catch {}
  state.me = null;
  render();
}

// Reads #access_token=... off the URL, then puts the URL back how it was.
function consumeRedirect() {
  const raw = location.hash.slice(1);
  if (!raw || !/(^|&)(access_token|error)=/.test(raw)) return null;
  const p = new URLSearchParams(raw);
  history.replaceState(null, '', redirectUri() + location.search);
  const want = ls.get(K.state, '');
  const silent = ls.get(K.silent, '') === '1';
  ls.del(K.state); ls.del(K.silent);
  if (p.get('error')) return { error: p.get('error'), silent };
  if (!want || p.get('state') !== want) return { error: 'state_mismatch' };
  const life = parseInt(p.get('expires_in') || '3600', 10);
  ls.set(K.token, JSON.stringify({
    t: p.get('access_token'),
    exp: Date.now() + life * 1000 - 60e3,
    scope: p.get('scope') || '',
  }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------
// No request may wait forever. On a phone a reply can simply never arrive -
// the network drops, the app is backgrounded - and a fetch left waiting keeps
// whatever is watching it spinning for good. (mail.timeout only shortens this
// for the tests.)
const TIMEOUT = Number(ls.get('mail.timeout', '')) || 20000;

// once: for requests that create something. If the answer is lost the thing
// may have been made anyway, so they are never sent twice blindly; the caller
// looks for it instead.
async function api(path, { method = 'GET', body, params, tries = 0, once = false } = {}) {
  const tok = getToken();
  if (!tok) throw new AuthError('signed out');
  if (slowed()) throw new QuotaError('Gmail asked the app to slow down for a minute');   // nothing more until the pause is over
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null) continue;
    for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
  }
  const again = () => api(path, { method, body, params, tries: tries + 1, once });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  let res, text;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + tok.t, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    text = await res.text();
    clearTimeout(timer);
  } catch (e) {
    clearTimeout(timer);
    if (!once && tries < 3) { await sleep(500 * 2 ** tries); return again(); }
    throw new Error(ctl.signal.aborted ? 'Gmail took too long to answer' : 'No connection to Gmail');
  }
  if (res.status === 401) { ls.del(K.token); throw new AuthError('token expired'); }
  if (!res.ok) {
    const quota = res.status === 429 || (res.status === 403 && /rate ?limit|quota/i.test(text));
    if (quota) {
      if (tries < 1) { await sleep(1500 + Math.random() * 1000); return again(); }
      slowUntil = Date.now() + COOLDOWN;
      throw new QuotaError('Gmail asked the app to slow down for a minute');
    }
    if (res.status >= 500 && tries < 3) { await sleep(600 * 2 ** tries + Math.random() * 300); return again(); }
    let msg = text.slice(0, 200);
    try { msg = JSON.parse(text).error.message; } catch {}
    const err = new Error(msg || ('Gmail returned ' + res.status));
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
// Every label in the mailbox, fetched once and refreshed whenever one is made.
// Rows, chips and rules read this copy, so drawing them never waits on Gmail.
let labelsPromise = null;
const labelsById = new Map();

async function refreshLabels(force) {
  if (force || !labelsPromise) {
    labelsPromise = api('/labels').then(r => r.labels || []).catch(e => { labelsPromise = null; throw e; });
  }
  const all = await labelsPromise;
  labelsById.clear();
  for (const l of all) labelsById.set(l.id, l);
  return all;
}

async function labelNamed(name, { create = false } = {}) {
  const want = name.trim().toLowerCase();
  const found = (await refreshLabels()).find(l => l.name.toLowerCase() === want);
  if (found || !create) return found || null;
  try {
    const made = await api('/labels', {
      method: 'POST', once: true,
      body: { name: name.trim(), labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    await refreshLabels(true);
    return made;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    // Made after all, with the answer lost - or made meanwhile (409).
    const now = (await refreshLabels(true)).find(l => l.name.toLowerCase() === want);
    if (now) return now;
    throw e;
  }
}

const bucketLabel = () => labelNamed(settings.label, { create: true });
const bucketId = () => [...labelsById.values()].find(l => l.name.toLowerCase() === settings.label.toLowerCase())?.id || null;

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// Every label you (or an app) made, apart from the Marketing bucket.
function userLabels() {
  const bucket = settings.label.toLowerCase();
  return [...labelsById.values()].filter(l => l.type === 'user' && l.name.toLowerCase() !== bucket && !isReminderLabel(l)).sort(byName);
}

// Labels other mail apps and services leave in Gmail. They are never offered
// as tags. Two are kept even from the one-tap clean-up, because something
// still reads them.
const LEFTOVERS = [
  [/^\[imap\]/i, 'an old IMAP mail app'],
  [/^\[mailbox\]/i, 'Dropbox’s Mailbox app, closed in 2016'],
  [/^\[gmail\]/i, 'a mail app that mis-named a folder'],
  [/^(deleted|sent) messages$/i, 'a mail app that mis-named a folder'],
  [/^notes$/i, 'iPhone Notes', 'Kept: iPhone Notes stores your notes here when it syncs with Gmail.'],
  [/^unroll\.me/i, 'Unroll.me', 'Kept: Unroll.me files the mail it unsubscribed you from here.'],
];
function leftover(l) {
  for (const [re, who, keep] of LEFTOVERS) if (re.test(l.name)) return { who, keep: keep || null };
  return null;
}

// Labels that can be tags: yours, not another app's.
const tags = () => userLabels().filter(l => !leftover(l));

// Filters, kept alongside the labels: a label with a rule is a tag in use.
let filtersCache = null;
async function refreshFilters(force) {
  if (!canFilter()) return (filtersCache = []);
  if (force || !filtersCache) filtersCache = (await api('/settings/filters')).filter || [];
  return filtersCache;
}

// Your choice, per device, to show or hide a label in the mailbox menu.
function chipPrefs() { try { return JSON.parse(ls.get(K.chips, '{}')) || {}; } catch { return {}; } }
function setChipPref(id, show) {
  const p = chipPrefs();
  if (show == null) delete p[id]; else p[id] = show;
  ls.set(K.chips, JSON.stringify(p));
}

// The menu's tags: those that have a rule, plus any label you switched on - never,
// unless you ask, a leftover from another app.
// Flagged is Gmail's STARRED, always offered first, the way Mail lists Flagged.
const FLAGGED = { id: 'STARRED', name: 'Flagged', type: 'flag' };
function chipTags() {
  const p = chipPrefs();
  const ruled = new Set((filtersCache || []).flatMap(f => f.action?.addLabelIds || []));
  return userLabels().filter(l => p[l.id] ?? (!leftover(l) && ruled.has(l.id)));
}

// A tag keeps one colour everywhere, picked from its name.
const HUES = [211, 187, 145, 48, 28, 340, 280, 250];
function hue(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
// A label is matched by id, never by name inside the search: a name such as
// "Sofia's school" needs quoting that Gmail's search is fussy about, while an
// id is exact.
async function page(q, { labelIds, pageToken, max = PAGE } = {}) {
  const r = await api('/messages', { params: { q: q || undefined, labelIds, maxResults: max, pageToken } });
  return { ids: (r.messages || []).map(m => m.id), next: r.nextPageToken || null };
}

async function allIds(q, { labelIds, cap = 500 } = {}) {
  const ids = [];
  let pageToken;
  do {
    const r = await page(q, { labelIds, pageToken, max: Math.min(500, cap - ids.length) });
    ids.push(...r.ids);
    pageToken = r.next;
  } while (pageToken && ids.length < cap);
  return ids;
}

function parseFrom(header) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<?([^\s<>]+@[^\s<>]+?)>?\s*$/.exec(header || '');
  const email = (m ? m[2] : '').toLowerCase();
  const name = (m && m[1] ? m[1] : '').trim() || email.split('@')[0] || 'Unknown';
  return { name, email, host: email.split('@')[1] || '' };
}

// Gmail sends snippets HTML-escaped ("don&#39;t"); DOMParser turns them back
// into plain text without running or loading anything.
const unescapeHtml = s => new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html').body.textContent || '';

const hdr = (m, name) => headerOf(m?.payload, name);
const hdrAll = (m, name) => (m?.payload?.headers || []).filter(h => h.name.toLowerCase() === name).map(h => h.value || '');

// A page of conversations - Gmail's threads - newest first.
async function threadPage(q, { labelIds, pageToken, max = PAGE } = {}) {
  const r = await api('/threads', { params: { q: q || undefined, labelIds, maxResults: max, pageToken } });
  const threads = r.threads || [];
  return { ids: threads.map(t => t.id), hist: new Map(threads.map(t => [t.id, t.historyId])), next: r.nextPageToken || null };
}

// Rows already built, by conversation, with the historyId they were built at.
// A list reload asks Gmail only for conversations whose historyId has moved on:
// a refresh with nothing new costs one list call instead of forty. Kept in
// memory for this visit only - nothing about your mail is stored on the phone.
const rowCache = new Map();
const ROW_CACHE_MAX = 1500;

// One row per conversation, as Mail shows it: the newest message's time and
// text, the other person's name (not yours, when you replied last), how many
// messages it holds, and every label any of them carries. Messages in the
// Trash don't count.
async function hydrate(ids, hist) {
  const known = new Map(), need = [];
  for (const id of ids) {
    const c = rowCache.get(id);
    if (c && hist?.get(id) && c.historyId === hist.get(id)) known.set(id, c.item);
    else need.push(id);
  }
  let stop = null;
  const got = await pool(need, 4, id => api('/threads/' + id, {
    params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'Content-Type'] },
  }).catch(e => { if (e instanceof QuotaError || e instanceof AuthError) stop = e; return null; }));
  if (stop) throw stop;                             // a half-drawn list would look like mail had gone
  for (const t of got) {
    const item = t && buildRow(t);
    if (!item) continue;
    rowCache.delete(t.id);
    rowCache.set(t.id, { historyId: t.historyId || hist?.get(t.id), item });
    if (rowCache.size > ROW_CACHE_MAX) rowCache.delete(rowCache.keys().next().value);
    known.set(t.id, item);
  }
  return ids.map(id => known.get(id)).filter(Boolean);
}

function buildRow(t) {
  const live = (t.messages || []).filter(m => !(m.labelIds || []).includes('TRASH'));
  const msgs = live.length ? live : t.messages || [];
  if (!msgs.length) return null;
  const last = msgs[msgs.length - 1];
  const them = [...msgs].reverse().find(m => !(m.labelIds || []).includes('SENT')) || last;
  return {
    id: t.id, threadId: t.id, msgId: last.id, count: msgs.length,
    snippet: unescapeHtml(last.snippet || ''),
    subject: hdr(msgs[0], 'subject') || hdr(last, 'subject') || '(no subject)',
    date: Number(last.internalDate) || Date.parse(hdr(last, 'date')) || Date.now(),
    labelIds: [...new Set(msgs.flatMap(m => m.labelIds || []))],
    attach: msgs.some(m => /multipart\/mixed/i.test(hdr(m, 'content-type'))),
    get unread() { return this.labelIds.includes('UNREAD'); },
    ...parseFrom(hdr(them, 'from')),
  };
}

// ---------------------------------------------------------------------------
// Reading a message
// ---------------------------------------------------------------------------
function findPart(node, type) {
  if (!node) return null;
  if (node.mimeType === type && (node.body?.data || node.body?.attachmentId)) return node;
  for (const part of node.parts || []) {
    const hit = findPart(part, type);
    if (hit) return hit;
  }
  return null;
}

const headerOf = (node, name) => (node?.headers || []).find(h => h.name.toLowerCase() === name)?.value || '';

// A body part as text, in the character set the part says it is in. Large
// parts come as an attachment id rather than inline.
async function partText(msgId, part) {
  let data = part.body.data;
  if (!data) data = (await api('/messages/' + msgId + '/attachments/' + part.body.attachmentId)).data || '';
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const charset = (/charset="?([^";\s]+)/i.exec(headerOf(part, 'content-type')) || [])[1] || 'utf-8';
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}

// Every message in a conversation, oldest first: who, when, the text in
// both forms, and the files attached.
async function fetchThread(item) {
  const t = await api('/threads/' + item.threadId, { params: { format: 'full' } });
  const live = (t.messages || []).filter(m => !(m.labelIds || []).includes('TRASH'));
  return Promise.all((live.length ? live : t.messages || []).map(async m => {
    const html = findPart(m.payload, 'text/html'), text = findPart(m.payload, 'text/plain');
    return {
      id: m.id, labelIds: m.labelIds || [],
      date: Number(m.internalDate) || Date.parse(hdr(m, 'date')) || 0,
      from: parseFrom(hdr(m, 'from')), to: hdr(m, 'to'), cc: hdr(m, 'cc'), replyTo: hdr(m, 'reply-to'),
      subject: hdr(m, 'subject'), messageId: hdr(m, 'message-id'), references: hdr(m, 'references'),
      snippet: unescapeHtml(m.snippet || ''),
      html: html ? await partText(m.id, html) : null,
      text: text ? await partText(m.id, text) : null,
      files: attachmentsOf(m.payload),
      unsub: unsubOf(m),
    };
  }));
}

// A mailing list's way out (List-Unsubscribe): a one-click web address
// (List-Unsubscribe-Post), an email address, or a page to finish on.
function unsubOf(m) {
  const raw = hdr(m, 'list-unsubscribe');
  if (!raw) return null;
  const uris = [...raw.matchAll(/<\s*([^>]+?)\s*>/g)].map(x => x[1].trim());
  const https = uris.find(u => /^https:\/\/[^\s]+$/i.test(u)) || null;
  const mailto = uris.find(u => /^mailto:[^\s]+$/i.test(u)) || null;
  if (!https && !mailto) return null;
  const from = parseFrom(hdr(m, 'from'));
  return {
    https, mailto, email: from.email,
    oneClick: !!https && /list-unsubscribe\s*=\s*one-click/i.test(hdr(m, 'list-unsubscribe-post')),
    trusted: !(m.labelIds || []).includes('SPAM') && authentic(m, from),
  };
}

// Whether Gmail itself vouched that the mail is from the domain it names:
// DMARC, or a DKIM signature, passing for the From domain. Only Gmail's own
// verdict counts - the topmost Authentication-Results, from mx.google.com - as
// a sender can write one of its own further down. Unsubscribing from a sender
// that fails this would only tell a spammer the address works.
function authentic(m, from) {
  const dom = baseDomain(from.host);
  const ar = hdrAll(m, 'authentication-results')[0] || '';
  if (!dom || !/^\s*mx\.google\.com\s*;/i.test(ar)) return false;
  for (const part of ar.split(';')) {
    const dmarc = /\bdmarc=pass\b[\s\S]*?\bheader\.from=([^\s;]+)/i.exec(part);
    if (dmarc && baseDomain(dmarc[1]) === dom) return true;
    const dkim = /\bdkim=pass\b[\s\S]*?\bheader\.(?:i|d)=@?([^\s;]+)/i.exec(part);
    if (dkim && baseDomain(dkim[1].replace(/^.*@/, '')) === dom) return true;
  }
  return false;
}

// Files attached to a message, wherever they sit in its MIME tree.
function attachmentsOf(node, out = []) {
  if (!node) return out;
  if (node.filename && node.body?.attachmentId) {
    out.push({ name: node.filename, type: node.mimeType || 'application/octet-stream', size: node.body.size || 0, attId: node.body.attachmentId });
  }
  for (const part of node.parts || []) attachmentsOf(part, out);
  return out;
}

// The message as a page of its own, inside a sandboxed frame. The sandbox has
// no allow-scripts, so nothing in the mail can run, and the frame's policy lets
// it load nothing from the network - so images, and the tracking pixels among
// them, stay dark until "Show" is tapped. allow-same-origin without scripts
// only lets this page measure the frame to size it.
function emailDoc(html, images) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const n of doc.querySelectorAll('script, noscript, meta, link, base, title, iframe, frame, frameset, object, embed, applet, form')) n.remove();
  for (const el of doc.querySelectorAll('*')) {
    for (const a of [...el.attributes]) if (/^on|^ping$/i.test(a.name)) el.removeAttribute(a.name);
  }
  // Links keep to the web, email and phone numbers. Anything else - javascript:,
  // data:, an address relative to nothing - loses its link and stays as text.
  // The address is read as a browser would read it, so tricks like
  // "java\tscript:" or leading spaces don't get past.
  for (const a of doc.querySelectorAll('a, area')) {
    for (const name of ['href', 'xlink:href']) {
      const v = a.getAttribute(name);
      if (v == null) continue;
      let ok = false;
      try { ok = /^(?:https?|mailto|tel):$/.test(new URL(v).protocol); } catch {}
      if (!ok) a.removeAttribute(name);
    }
    if (a.hasAttribute('href')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
  }
  const policy = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:" + (images ? ' https: http:' : '');
  const bodyAttrs = [...(doc.body?.attributes || [])].map(a => ' ' + a.name + '="' + esc(a.value) + '"').join('');
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="' + policy + '">' +
    '<meta http-equiv="x-dns-prefetch-control" content="off">' +
    '<meta name="referrer" content="no-referrer">' +
    '<style>html{-webkit-text-size-adjust:100%;overflow:hidden}body{margin:0;padding:14px;background:#fff;color:#1c1c1e;' +
    'font:15px/1.5 -apple-system,system-ui,sans-serif;overflow-wrap:break-word}img{max-width:100%;height:auto}a{color:#0a63d8}</style>' +
    (doc.head?.innerHTML || '') + '</head><body' + bodyAttrs + '>' + (doc.body?.innerHTML || '') + '</body></html>';
}

// Whether the mail asks for anything from the network - worth offering "Show".
const wantsImages = html => /(?:src|background|srcset)\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:/i.test(html);

function tidy(text) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t ​]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Plain text with its web addresses made tappable. Matched on the raw text and
// escaped piece by piece, so an address can never break out of its tag.
function linkify(text) {
  const re = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index)) + '<a href="' + esc(m[0]) + '" target="_blank" rel="noopener noreferrer">' + esc(m[0]) + '</a>';
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

// Emails are laid out for a column about 600px wide. One wider than the screen
// is scaled down to fit, the way Mail does, and the frame is made as tall as
// the message so the page scrolls rather than the frame.
function fitFrame(frame) {
  const doc = frame.contentDocument, root = doc?.documentElement, body = doc?.body;
  if (!root || !body || !frame.isConnected || !frame.clientWidth) return;
  body.style.transform = '';
  const scale = Math.min(1, frame.clientWidth / Math.max(1, root.scrollWidth));
  if (scale < 1) { body.style.transformOrigin = '0 0'; body.style.transform = 'scale(' + scale + ')'; }
  frame.style.height = Math.ceil(root.scrollHeight * scale) + 'px';
}

const fullDate = ms => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// ---------------------------------------------------------------------------
// Which senders a rule may cover
// ---------------------------------------------------------------------------
// Two-part public suffixes, so a rule on bbc.co.uk is not written as co.uk.
const SUFFIX2 = new Set(('co.uk org.uk ac.uk gov.uk me.uk net.uk sch.uk ltd.uk plc.uk com.au net.au org.au edu.au gov.au ' +
  'co.nz net.nz org.nz co.za org.za com.br com.mx com.ar com.co co.jp ne.jp or.jp co.in net.in org.in com.sg com.hk ' +
  'com.tw com.tr com.ua com.pl com.vn com.my com.ph co.kr co.th co.id co.il com.cn net.cn org.cn com.es com.pt').split(' '));

// Shared mailbox providers: a rule on these would swallow personal mail, so
// those senders get a rule on the exact address instead.
const SHARED = new Set(('gmail.com googlemail.com outlook.com hotmail.com live.com msn.com yahoo.com ymail.com rocketmail.com ' +
  'aol.com icloud.com me.com mac.com protonmail.com proton.me pm.me gmx.com gmx.net gmx.de mail.com zoho.com fastmail.com ' +
  'hey.com duck.com qq.com 163.com 126.com naver.com daum.net yandex.com yandex.ru mail.ru tutanota.com hushmail.com ' +
  'web.de t-online.de free.fr orange.fr laposte.net sky.com btinternet.com virginmedia.com talktalk.net ntlworld.com ' +
  'blueyonder.co.uk comcast.net verizon.net att.net sbcglobal.net cox.net charter.net shaw.ca rogers.com bell.net ' +
  'bigpond.com optusnet.com.au xtra.co.nz').split(' '));

function baseDomain(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return SUFFIX2.has(parts.slice(-2).join('.')) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

function isShared(domain) {
  return SHARED.has(domain) || /^(yahoo|gmx|yandex|outlook|hotmail|live|aol)\./.test(domain);
}

// What one tap should cover: the whole domain, or just this sender.
function ruleFor(item) {
  const domain = baseDomain(item.host);
  if (!domain || isShared(domain)) return { kind: 'sender', match: item.email, label: item.email };
  return { kind: 'domain', match: domain, label: domain };
}

// A rule typed into the Rules tab: a domain such as tmsa.org, or one address.
function ruleFromText(raw) {
  const t = String(raw || '').trim().toLowerCase().replace(/^mailto:/, '').replace(/^@/, '');
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(t)) return { kind: 'sender', match: t, label: t };
  if (/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(t)) {
    const d = baseDomain(t);
    if (isShared(d)) return { error: d + ' is shared by millions of people, so a rule on it would catch everyone. Enter the full address instead, like name@' + d + '.' };
    return { kind: 'domain', match: d, label: d };
  }
  return { error: 'Enter a domain like tmsa.org, or an address like office@tmsa.org.' };
}

// Whether a message is one a rule covers - used to update rows already on
// screen without asking Gmail again.
function covers(rule, it) {
  return rule.kind === 'sender' ? it.email === rule.match : it.host === rule.match || it.host.endsWith('.' + rule.match);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function relabel(ids, add = [], remove = []) {
  if (!ids.length || (!add.length && !remove.length)) return;
  for (const part of chunks(ids, 500)) {
    await api('/messages/batchModify', {
      method: 'POST',
      body: { ids: part, ...(add.length && { addLabelIds: add }), ...(remove.length && { removeLabelIds: remove }) },
    });
  }
}

async function relabelThread(threadId, add = [], remove = []) {
  if (!add.length && !remove.length) return;
  await api('/threads/' + threadId + '/modify', {
    method: 'POST',
    body: { ...(add.length && { addLabelIds: add }), ...(remove.length && { removeLabelIds: remove }) },
  });
}

// Puts everything from one sender or domain under a label: this conversation
// now, all new mail through a Gmail filter, and the mail already here. With
// skipInbox it also leaves the inbox - that is the Marketing bucket - while a
// tag leaves mail where it is. Returns what Undo needs to put it all back.
async function applyRule(rule, labelName, { skipInbox = false, item = null } = {}) {
  const label = await labelNamed(labelName, { create: true });
  const add = [label.id], remove = skipInbox ? ['INBOX'] : [];
  const back = {
    rule, skipInbox, label: label.id, labelName: label.name, filterId: null,
    threadId: item?.threadId || null,
    threadInInbox: !!item?.labelIds.includes('INBOX'),
    threadHadLabel: !!item?.labelIds.includes(label.id),
    added: [], leftInbox: [],
  };

  if (item) await relabelThread(item.threadId, add, remove);

  if (canFilter()) {
    try {
      const isSame = f => (f.criteria?.from || '').toLowerCase() === rule.match && (f.action?.addLabelIds || []).includes(label.id);
      if (!(await refreshFilters(true)).some(isSame)) {
        try {
          const made = await api('/settings/filters', {
            method: 'POST', once: true,
            body: { criteria: { from: rule.match }, action: { addLabelIds: add, ...(remove.length && { removeLabelIds: remove }) } },
          });
          back.filterId = made.id;
          filtersCache.push(made);
        } catch (e) {
          if (e instanceof AuthError) throw e;
          const now = (await refreshFilters(true)).find(isSame);   // made after all?
          if (!now) throw e;
          back.filterId = now.id;
        }
      }
    } catch (e) {
      toast('Done, but the rule for new mail failed: ' + e.message, { bad: true });
    }
  }

  // The mail already here is done in the background, so what's on screen
  // never waits on a whole mailbox's worth of it. back.done settles when it's
  // finished; Undo waits for it.
  back.done = backfill(back, rule, add, remove);
  back.done.catch(() => {});        // reported by whoever watches it
  state.rules = null;
  return back;
}

// What had the label before is left alone, so Undo only takes off what this added.
async function backfill(back, rule, add, remove) {
  const q = 'from:(' + rule.match + ') -in:sent -in:chats';
  const [all, had, inInbox] = await Promise.all([
    allIds(q, { cap: 800 }),
    allIds(q, { labelIds: [back.label], cap: 800 }),
    back.skipInbox ? allIds(q + ' in:inbox', { cap: 800 }) : [],
  ]);
  const hadSet = new Set(had);
  back.added = all.filter(id => !hadSet.has(id));
  back.leftInbox = inInbox;
  await relabel(back.added, add, remove);
  await relabel(inInbox.filter(id => hadSet.has(id)), [], remove);
  state.rules = null;
  return back;
}

// When the older mail is done, the toast says how much and offers Undo. If it
// fails part-way, say so and show what Gmail really has.
function finish(back, say, then) {
  back.done
    .then(() => { toast(say(back.added.length + (back.threadId ? 1 : 0)), { label: 'Undo', action: () => undo(back) }); if (then) then(); })
    .catch(err => { failed(err); state.lists = {}; go({ force: true }); });
}

async function undoRule(back) {
  if (back.threadId) {
    await relabelThread(back.threadId,
      back.skipInbox && back.threadInInbox ? ['INBOX'] : [],
      back.threadHadLabel ? [] : [back.label]);
  }
  await relabel(back.leftInbox, ['INBOX']);
  await relabel(back.added, [], [back.label]);
  if (back.filterId) {
    try { await api('/settings/filters/' + back.filterId, { method: 'DELETE' }); } catch {}
    if (filtersCache) filtersCache = filtersCache.filter(f => f.id !== back.filterId);
  }
  state.rules = null;
}

// Deletes labels from Gmail - rules first, so no filter points at nothing.
// The emails keep everything else; only the label comes off them.
async function removeLabels(list) {
  const filters = await refreshFilters(true);
  for (const l of list) {
    for (const f of filters.filter(f => (f.action?.addLabelIds || []).includes(l.id))) {
      await api('/settings/filters/' + f.id, { method: 'DELETE' });
    }
    await api('/labels/' + l.id, { method: 'DELETE' });
    setChipPref(l.id, null);
  }
  filtersCache = null;
  labelsPromise = null;
  state.lists = {};
  if (state.tag && list.some(l => l.id === state.tag)) state.tag = null;
  await Promise.all([refreshLabels(true), refreshFilters(true)]);
}

const bucket = item => applyRule(ruleFor(item), settings.label, { skipInbox: true, item });
const tagSender = (item, name) => applyRule(ruleFor(item), name, { item });

// One conversation back to the inbox, leaving the rule alone.
async function unbucket(item) {
  const label = await bucketLabel();
  await relabelThread(item.threadId, ['INBOX'], [label.id]);
  return label.id;
}

// Opening a message is reading it: Gmail marks it read, and so does the list.
async function markRead(item) {
  if (!item.unread) return false;
  try {
    await relabelThread(item.threadId, [], ['UNREAD']);
    patch(it => it.threadId === item.threadId, [], ['UNREAD']);
    for (const list of Object.values(state.lists)) for (const it of list.items || []) if (it.threadId === item.threadId) it.fading = true;
    item.fading = true;
    updateBadge();
    if (!item.labelIds.includes('UNREAD')) return true;
    item.labelIds = item.labelIds.filter(l => l !== 'UNREAD');
    return true;
  } catch { return false; }
}

// Everything in the bucket older than the cut-off goes to the Trash, which
// Gmail empties for good after 30 days.
async function sweep() {
  const label = await labelNamed(settings.label);
  let done = 0;
  if (label) {
    const ids = await allIds('older_than:' + settings.days + 'd', { labelIds: [label.id], cap: 1000 });
    await pool(ids, 5, async id => {
      try { await api('/messages/' + id + '/trash', { method: 'POST' }); done++; } catch {}
    });
  }
  ls.set(K.swept, String(Date.now()));
  return done;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
const state = {
  view: 'inbox',   // inbox | marketing | rules | settings
  tag: null,       // the tag (or category, or Flagged) chosen in the mailbox menu
  search: '',      // while set, search results take the list's place
  lists: {},       // key -> { items, next, error, q, labelIds }
  rules: null, rulesError: null,
  me: null, error: null, notice: false, busy: false,
  select: null,    // Set of selected message ids while selecting
  reading: null,   // { item, data, images, error } while a message is open
  sheet: null,     // { item, rule } while the tag sheet is up
};
const screen = $('#screen');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Gmail's own sorting of the inbox (its category tabs), offered in the menu.
const CATEGORIES = [
  { id: 'cat:primary', name: 'Primary', label: 'CATEGORY_PERSONAL' },
  { id: 'cat:promotions', name: 'Promotions', label: 'CATEGORY_PROMOTIONS' },
  { id: 'cat:updates', name: 'Updates', label: 'CATEGORY_UPDATES' },
];
const catOf = key => CATEGORIES.find(c => c.id === key);

// The list on screen, and how to ask Gmail for it.
function currentList() {
  if (state.search) return { key: 'q:' + state.search, q: state.search };
  if (state.view === 'marketing') return { key: 'mkt', bucket: true };
  if (catOf(state.tag)) return { key: state.tag, q: 'in:inbox category:' + state.tag.slice(4) + ' -in:chats' };
  if (state.tag) return { key: 'tag:' + state.tag, labelIds: [state.tag] };
  return { key: 'inbox', q: 'in:inbox -in:chats' };
}

// Whether a message still belongs in a list once its labels change.
function belongs(key, it) {
  if (it.labelIds.includes('TRASH')) return false;
  if (key === 'inbox') return it.labelIds.includes('INBOX');
  if (key === 'mkt') return it.labelIds.includes(bucketId());
  if (key.startsWith('tag:')) return it.labelIds.includes(key.slice(4));
  if (catOf(key)) return it.labelIds.includes('INBOX') && it.labelIds.includes(catOf(key).label);
  return true;
}

// Changes labels on every copy of the matching messages held in lists.
function patch(test, add, remove) {
  for (const list of Object.values(state.lists)) {
    for (const it of list.items || []) {
      if (test(it)) it.labelIds = [...new Set(it.labelIds.filter(l => !remove.includes(l)).concat(add))];
    }
  }
}

// After a change: rows that no longer belong on screen leave with their
// animation, and other lists - which may have gained mail - are fetched afresh
// when next shown.
async function settle(dir) {
  const key = currentList().key, list = state.lists[key];
  const gone = (list?.items || []).filter(it => !belongs(key, it));
  await Promise.all(gone.map(it => vanish(screen.querySelector('li[data-id="' + CSS.escape(it.id) + '"]'), dir)));
  for (const k of Object.keys(state.lists)) if (k !== key) delete state.lists[k];
  if (list?.items) list.items = list.items.filter(it => belongs(key, it));
  quietOnce = true;
  render();
}

let toastTimer = null;
function toast(msg, { action, label, bad, ms } = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.className = bad ? 'bad' : '';
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';   // replay the rise
  el.innerHTML = '<span class="msg">' + esc(msg) + '</span>' + (action ? '<button id="toast-act">' + esc(label || 'Undo') + '</button>' : '');
  if (action) $('#toast-act').onclick = () => { el.classList.add('hide'); action(); };
  toastTimer = setTimeout(() => el.classList.add('hide'), ms || (action ? 7000 : bad ? 6000 : 3000));
}

function failed(err) {
  toast(err instanceof AuthError ? 'Session expired — reconnect' : err.message, { bad: true });
  if (err instanceof AuthError) { closeSheet(); closeReader(); render(); }
}

const ICON = {
  bell: '<svg class="i s" width="12" height="12" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  more: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg>',
  block: '<svg class="i s" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  tag: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M3.5 12.1V4.6a1 1 0 0 1 1-1h7.5a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.3-.7z"/><circle cx="8" cy="8" r="1.4"/></svg>',
  mkt: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M3.5 10.5v3a1 1 0 0 0 1 1H7l8.5 4.5v-14L7 9.5H4.5a1 1 0 0 0-1 1z"/><path d="M7 14.5l1.3 4.4a.9.9 0 0 0 .9.6h1.3"/><path d="M19 10v4"/></svg>',
  eye: '<svg class="i s" width="15" height="15" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  label: '<svg class="i s" width="17" height="17" viewBox="0 0 24 24"><path d="M3.5 12.1V4.6a1 1 0 0 1 1-1h7.5a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.3-.7z"/><circle cx="8" cy="8" r="1.4"/></svg>',
  back: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg>',
  chev: '<svg class="i s bold" width="22" height="22" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  bin: '<svg class="i s" width="17" height="17" viewBox="0 0 24 24"><path d="M4 6.5h16"/><path d="M9 6.5V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.7"/><path d="M6 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 6.5"/><path d="M10 10.5v6M14 10.5v6"/></svg>',
  reply: '<svg class="i s" width="22" height="22" viewBox="0 0 24 24"><path d="M9.5 6L4 11.5 9.5 17"/><path d="M4.5 11.5H14a6 6 0 0 1 6 6v1"/></svg>',
  compose: '<svg class="i s" width="21" height="21" viewBox="0 0 24 24"><path d="M11 4.5H6a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h11.5a2 2 0 0 0 2-2v-5"/><path d="M17.8 3.7a1.9 1.9 0 0 1 2.7 2.7l-8.1 8.1-3.4 1 1-3.4z"/></svg>',
  up: '<svg class="i s bold" width="20" height="20" viewBox="0 0 24 24"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
  flag: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M5.5 21V4"/><path d="M5.5 4.5h11.2a.6.6 0 0 1 .5.9L15.5 9l1.7 3.6a.6.6 0 0 1-.5.9H5.5z"/></svg>',
  archive: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5"/><path d="M10 12.5h4"/></svg>',
  trash: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M4 6.5h16"/><path d="M9 6.5V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.7"/><path d="M6 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 6.5"/><path d="M10 10.5v6M14 10.5v6"/></svg>',
  clip: '<svg class="i s clip" width="13" height="13" viewBox="0 0 24 24"><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/></svg>',
  img: '<svg class="i s" width="18" height="18" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/></svg>',
  spin: '<svg class="i s spin" width="18" height="18" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
  out: '<svg class="i s" width="13" height="13" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
};

function listSkeleton(n = 6) {
  return '<div class="card">' + Array.from({ length: n }, (_, i) => '<div class="skel" style="--i:' + i + '"></div>').join('') + '</div>';
}

// The coloured chips for a message's own labels. The bucket keeps its orange.
function tagChips(labelIds, skip) {
  const bid = bucketId(), shown = new Set(chipTags().map(l => l.id));
  return labelIds.map(id => labelsById.get(id))
    .filter(l => l && l.id !== skip && (l.id === bid || shown.has(l.id)))
    .map(l => '<span class="tchip" style="--h:' + (l.id === bid ? 36 : hue(l.name)) + '">' + esc(l.name) + '</span>')
    .join('');
}

let freshFrom = Infinity;   // rows from here on animate in even on a quiet repaint
function rowHTML(item, i, key) {
  const inBucket = item.labelIds.includes(bucketId());
  let meta;
  if (key === 'mkt') {
    const left = settings.days - (Date.now() - item.date) / 86400e3;
    meta = '<span class="chip ' + (left <= 0 ? 'due' : '') + '">' + ICON.bin + (left <= 0 ? 'due now' : 'in ' + Math.ceil(left) + 'd') + '</span>' +
      tagChips(item.labelIds, bucketId());
  } else {
    const rl = reminderId();
    meta = (rl && item.labelIds.includes(rl) ? '<span class="tchip rem" style="--h:280">' + ICON.bell + 'Reminder</span>' : '') +
      tagChips(item.labelIds);                    // only your own tags; the sender is already on the row
  }
  const fresh = i >= freshFrom, sel = state.select?.has(item.id);
  return '<li class="' + (fresh ? 'fresh' : '') + (sel ? ' sel' : '') + '" style="--i:' + (fresh ? i - freshFrom : i) + '" data-id="' + esc(item.id) + '">' +
    '<span class="check"></span>' +
    '<span class="swipe">' +
      '<button class="sa tagx" data-act="swipe-tag"><span class="gi">' + ICON.label + '</span>Tag</button>' +
      (inBucket
        ? '<button class="sa inbx" data-act="restore" aria-label="Back to inbox"><span class="gi">' + ICON.back + '</span>Inbox</button>'
        : '<button class="sa mktx" data-act="bucket" aria-label="Move ' + esc(ruleFor(item).label) + ' to ' + esc(settings.label) + '"><span class="gi">' + ICON.mkt + '</span>' + esc(settings.label) + '</button>') +
    '</span>' +
    '<span class="swipe-r">' +
      '<button class="sa flag" data-act="row-flag"><span class="gi">' + ICON.flag + '</span>' + (item.labelIds.includes('STARRED') ? 'Unflag' : 'Flag') + '</button>' +
      '<button class="sa arch" data-act="row-archive"><span class="gi">' + ICON.archive + '</span>Archive</button>' +
      '<button class="sa bin" data-act="row-trash"><span class="gi">' + ICON.trash + '</span>Trash</button>' +
    '</span>' +
    '<div class="rowtop">' +
      '<button class="open" data-act="read">' +
        '<span class="who">' + (item.unread ? '<span class="dot"></span>' : item.fading ? '<span class="dot fade"></span>' : '') +
          '<span class="name">' + esc(item.name) + '</span>' +
          (item.count > 1 ? '<span class="cnt">' + item.count + '</span>' : '') +
          '<span class="when">' + (item.labelIds.includes('STARRED') ? '<span class="flagged">' + ICON.flag + '</span>' : '') +
            (item.attach ? ICON.clip : '') + esc(ago(item.date)) + '</span></span>' +
        '<span class="subj">' + esc(item.subject) + '</span>' +
        '<span class="snip">' + esc(item.snippet.slice(0, 90)) + '</span>' +
        (meta ? '<span class="meta">' + meta + '</span>' : '') +
      '</button>' +
    '</div>' +
  '</li>';
}

// The mailbox menu: tap the big title, as in Mail. Inbox and Flagged, Gmail's
// categories, your tags, then Marketing and the Tags page - one list in place
// of a row of chips that ran off the side of the screen.
const MENU_ICON = {
  inbox: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M3.5 13.5l2.2-7.4a1.5 1.5 0 0 1 1.4-1.1h9.8a1.5 1.5 0 0 1 1.4 1.1l2.2 7.4V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/><path d="M3.5 13.5h4.8l1.2 2.2h5l1.2-2.2h4.8"/></svg>',
  'cat:primary': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/></svg>',
  'cat:promotions': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/></svg>',
  'cat:updates': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.7v.1"/></svg>',
  tick: '<svg class="i s bold" width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

// What the title says: the mailbox or tag on screen.
function viewName() {
  if (state.view === 'settings') return 'Settings';
  if (state.view === 'rules') return 'Tags';
  if (state.view === 'marketing') return settings.label;
  return catOf(state.tag)?.name || (state.tag === 'STARRED' ? 'Flagged' : labelsById.get(state.tag)?.name) || 'Inbox';
}

function boxMenuHTML() {
  const inbox = state.view === 'inbox';
  const row = (act, attrs, name, on, right) => '<button role="menuitemradio" aria-checked="' + on + '" data-act="' + act + '" ' + attrs + '>' +
    '<span class="tick">' + MENU_ICON.tick + '</span><span class="name">' + esc(name) + '</span>' + right + '</button>';
  const count = n => n ? '<span class="cnt">' + n + '</span>' : '';
  const ico = svg => '<span class="ico">' + svg + '</span>';
  const tags = chipTags();
  return '<div class="catch" data-act="box-close"></div><div class="menu" role="menu" aria-label="Mailboxes">' +
    row('chip', 'data-id=""', 'Inbox', inbox && !state.tag, count(state.lists.inbox?.items?.length) + ico(MENU_ICON.inbox)) +
    row('chip', 'data-id="STARRED"', 'Flagged', inbox && state.tag === 'STARRED', ico(ICON.flag)) +
    '<hr>' +
    CATEGORIES.map(c => row('chip', 'data-id="' + c.id + '"', c.name, inbox && state.tag === c.id, ico(MENU_ICON[c.id]))).join('') +
    (tags.length ? '<hr><div class="mhead">Tags</div>' + tags.map(l => row('chip', 'data-id="' + esc(l.id) + '" style="--h:' + hue(l.name) + '"',
      l.name, inbox && state.tag === l.id, ico('<i class="dot"></i>'))).join('') : '') +
    '<hr>' +
    row('box-view', 'data-view="marketing"', settings.label, state.view === 'marketing', count(state.lists.mkt?.items?.length) + ico(ICON.mkt)) +
    row('box-view', 'data-view="rules"', 'Manage Tags', state.view === 'rules', ico(ICON.label)) +
  '</div>';
}

function openBoxMenu() {
  const el = $('#boxmenu'), btn = $('#boxbtn');
  if (btn.disabled) return;
  el.innerHTML = boxMenuHTML();
  el.classList.remove('hide', 'leaving');
  // Just under the header, so the title and account line stay in view.
  const r = btn.getBoundingClientRect(), top = Math.round($('header').getBoundingClientRect().bottom + 6);
  const menu = el.querySelector('.menu');
  menu.style.left = Math.max(16, r.left - 4) + 'px';
  menu.style.top = top + 'px';
  menu.style.maxHeight = 'calc(100dvh - ' + (top + 16) + 'px - env(safe-area-inset-bottom))';
  btn.setAttribute('aria-expanded', 'true');
  menu.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
}

function closeBoxMenu(instant) {
  const el = $('#boxmenu');
  if (el.classList.contains('hide')) return;
  $('#boxbtn').setAttribute('aria-expanded', 'false');
  const finish = () => { el.classList.add('hide'); el.classList.remove('leaving'); el.innerHTML = ''; };
  if (instant || reduced) return finish();
  el.classList.add('leaving');
  setTimeout(finish, 180);
}
const boxMenuOpen = () => !$('#boxmenu').classList.contains('hide');

// Everything around the list: the header, its title menu, and the select bar.
function renderChrome() {
  const signedIn = !!getToken() && !!clientId();
  const main = signedIn && state.view !== 'settings';
  const listView = main && state.view !== 'rules';
  const items = listView ? state.lists[currentList().key]?.items || [] : [];
  if (state.select && !listView) state.select = null;
  const sel = state.select;
  if (sel) for (const id of [...sel]) if (!items.some(it => it.id === id)) sel.delete(id);   // rows that went away

  const searching = !!(state.showSearch || state.search);
  $('#search').classList.toggle('hide', !main || !!sel || !searching);
  $('#find').classList.toggle('hide', !main || !!sel || searching || state.view === 'rules');
  $('#gear').classList.toggle('hide', !signedIn || !!sel);
  $('#gear').setAttribute('aria-label', state.view === 'settings' ? 'Close settings' : 'Settings');
  $('#edit').classList.toggle('hide', !listView || (!items.length && !sel));
  $('#edit').textContent = sel ? 'Done' : 'Edit';
  $('#selall').classList.toggle('hide', !sel);
  const all = sel && items.length && items.every(it => sel.has(it.id));
  $('#selall').textContent = all ? 'Deselect All' : 'Select All';
  $('#title').textContent = sel ? (sel.size ? sel.size + ' Selected' : 'Select') : signedIn ? viewName() : 'Mail';
  $('#boxbtn').disabled = !main || !!sel;
  if ($('#boxbtn').disabled) closeBoxMenu(true);
  $('#sub').textContent = sel ? 'Tap, or drag down the circles' : (state.me || (signedIn ? 'Connecting…' : 'Not connected'));

  $('#fab').classList.toggle('hide', !listView || !!sel);
  screen.classList.toggle('selecting', !!sel);
  document.body.classList.toggle('selecting', !!sel);
  $('#selbar').classList.toggle('hide', !sel);
  $('#foot').classList.toggle('hide', !!sel);
  if (sel) {
    const chosen = items.filter(it => sel.has(it.id));
    $('#sel-mark').textContent = chosen.some(it => it.unread) || !chosen.length ? 'Mark as Read' : 'Mark as Unread';
    $('#sel-mark').disabled = $('#sel-trash').disabled = $('#sel-archive').disabled = !chosen.length;
    $('#sel-count').textContent = chosen.length ? chosen.length + ' of ' + items.length : '';
  }
}

function render() {
  renderChrome();
  if (!clientId()) return paint(viewSetup());
  if (!getToken()) return paint(viewSignIn());
  if (state.view === 'settings') return paint(viewSettings());
  if (state.view === 'rules') return paint(viewRules());
  return paint(viewList());
}

let quietOnce = false;              // set by an action: repaint without the entrance stagger
function paint(html) {
  screen.classList.toggle('quiet', quietOnce);
  quietOnce = false;
  screen.innerHTML = html;
  openRow = null;
  freshFrom = Infinity;
  $('#foot').innerHTML = footHTML();
}

function footHTML() {
  if (!getToken() || state.view === 'settings') return '';
  const last = Number(ls.get(K.swept, 0));
  const when = !last ? 'Not cleaned yet' : ago(last) === 'now' ? 'Cleaned just now' : 'Cleaned ' + ago(last) + ' ago';
  return '<span>' + when + '</span><button data-act="sweep">Clean up now</button>';
}

function viewSetup() {
  return '<div class="card panel">' +
    '<p><strong>One-time setup.</strong> This app talks to Gmail straight from your phone, so it needs an OAuth client ID of your own. It takes about three minutes.</p>' +
    '<ol>' +
      '<li>Open <code>console.cloud.google.com</code> and create a project.</li>' +
      '<li>APIs &amp; Services → Library → enable <strong>Gmail API</strong>.</li>' +
      '<li>OAuth consent screen: External, add yourself as a test user.</li>' +
      '<li>Credentials → Create credentials → <strong>OAuth client ID</strong> → Web application.</li>' +
      '<li>Add this exact <strong>Authorised JavaScript origin</strong>:<br><code class="url">' + esc(location.origin) + '</code></li>' +
      '<li>Add this exact <strong>Authorised redirect URI</strong>:<br><code class="url">' + esc(redirectUri()) + '</code></li>' +
      '<li>Copy the client ID and paste it here.</li>' +
    '</ol>' +
    '<input type="text" id="cid" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="1234…apps.googleusercontent.com" value="' + esc(ls.get(K.clientId, '')) + '">' +
    '<button class="btn" data-act="save-cid">Save and connect</button>' +
    '<p class="note">The client ID is not a secret and stays on this device. Nothing is sent anywhere but Google.</p>' +
  '</div>';
}

function viewSignIn() {
  return '<div class="card panel signin">' +
    '<div class="hero">' + ICON.tag + '</div>' +
    (state.error ? '<p class="note bad">' + esc(state.error) + '</p>' : '') +
    (state.notice ? '<p class="note">Google couldn’t renew your sign-in on its own this time — one tap and you’re back.</p>' : '') +
    '<button class="btn" data-act="signin">Connect Gmail</button>' +
    '<button class="btn ghost" data-act="signin-pick">Use a different account</button>' +
    (BUILT_IN_CLIENT_ID ? '' : '<button class="btn ghost" data-act="forget-cid">Change client ID</button>') +
  '</div>';
}

function viewList() {
  const spec = currentList(), list = state.lists[spec.key];
  if (list?.error) return '<div class="card"><div class="empty">' + esc(list.error) + '</div></div>';
  if (!list?.items) return listSkeleton();
  const items = list.items;
  const tagName = state.tag === 'STARRED' ? 'Flagged' : catOf(state.tag)?.name || (state.tag ? labelsById.get(state.tag)?.name || 'Tag' : '');
  let head = '';
  if (state.search) head = '<h2 class="gh">' + items.length + (list.next ? '+' : '') + ' result' + (items.length === 1 && !list.next ? '' : 's') + ' for “' + esc(state.search) + '”</h2>';
  else if (spec.key === 'mkt') head = '<h2>' + esc(settings.label) + ' · deleted after ' + settings.days + ' days</h2>';
  else if (state.tag && !catOf(state.tag)) head = '<h2 class="gh"><span class="tchip" style="--h:' + (state.tag === 'STARRED' ? 36 : hue(tagName)) + '">' + esc(tagName) + '</span></h2>';
  if (!items.length) {
    const empty = state.search ? 'Nothing matches “' + esc(state.search) + '”.'
      : spec.key === 'mkt' ? 'Nothing in ' + esc(settings.label) + ' yet.<br>Tap the tag on a message to start.'
      : state.tag === 'STARRED' ? 'Nothing flagged.<br>Swipe an email left and tap Flag.'
      : catOf(state.tag) ? 'Nothing in ' + esc(tagName) + '.'
      : state.tag ? 'Nothing tagged ' + esc(tagName) + ' yet.'
      : 'Inbox zero. Nothing left to file.';
    return '<div class="card">' + head + '<div class="empty">' + empty + '</div></div>';
  }
  return '<div class="card">' + head + '<ul class="list">' + items.map((it, i) => rowHTML(it, i, spec.key)).join('') + '</ul>' +
    (list.next ? '<div class="more"><button data-act="more">Show more</button></div>' : '') + '</div>';
}

function viewRules() {
  if (!canFilter()) {
    return '<div class="card"><div class="empty">Filter permission was not granted, so tags can\'t be set up.<br>Reconnect and allow "manage your filters".</div></div>';
  }
  if (state.rulesError) return '<div class="card"><div class="empty">' + esc(state.rulesError) + '</div></div>';
  if (state.rules === null) return listSkeleton(4);
  const bid = bucketId(), counts = state.labelCounts || {};
  const size = id => counts[id] == null ? '' : counts[id] ? counts[id].toLocaleString() + ' email' + (counts[id] === 1 ? '' : 's') : 'empty';
  const names = [settings.label, ...tags().map(l => l.name)];

  const form = '<div class="card panel">' +
    '<div class="ptitle">New tag</div>' +
    '<input type="text" id="rule-from" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="From — a domain like tmsa.org, or an address">' +
    '<input type="text" id="rule-tag" list="tag-names" autocomplete="off" autocapitalize="sentences" placeholder="Tag — e.g. Sofia’s school">' +
    '<datalist id="tag-names">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>' +
    '<button class="btn" data-act="add-rule">Add tag</button>' +
    '<p class="note">Or swipe right on any email. Mail already in your mailbox is tagged too, and it all stays in your inbox. Choose “' + esc(settings.label) + '” to send it to the bucket instead.</p>' +
  '</div>';

  const groups = new Map();
  for (const f of state.rules) {
    for (const id of f.action?.addLabelIds || []) {
      if (labelsById.get(id)?.type !== 'user') continue;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(f);
    }
  }
  const shown = new Set(chipTags().map(l => l.id));
  const yours = [...new Set([...groups.keys(), ...shown])].map(id => labelsById.get(id)).filter(Boolean)
    .sort((a, b) => a.id === bid ? -1 : b.id === bid ? 1 : byName(a, b));

  const chipBtn = l => {
    const on = shown.has(l.id);
    return '<button class="mini' + (on ? ' on' : '') + '" data-act="chip-pref" data-id="' + esc(l.id) + '" aria-pressed="' + on + '">' +
      ICON.eye + (on ? 'In menu' : 'Not in menu') + '</button>';
  };
  const delBtn = (l, what) => '<button class="act warn" data-act="del-label" data-id="' + esc(l.id) + '" aria-label="Delete ' + what + ' ' + esc(l.name) + '">' + ICON.bin + '</button>';

  const tagCard = l => {
    const rules = groups.get(l.id) || [], isBucket = l.id === bid;
    const meta = [rules.length ? rules.length + ' rule' + (rules.length === 1 ? '' : 's') : 'no rules', size(l.id)].filter(Boolean).join(' · ');
    return '<div class="card"><h2 class="gh"><span class="tchip" style="--h:' + (isBucket ? 36 : hue(l.name)) + '">' + esc(l.name) + '</span>' +
      '<span class="gcount">' + meta + '</span>' +
      (isBucket ? '' : '<span class="gtools">' + chipBtn(l) + delBtn(l, 'tag') + '</span>') + '</h2>' +
      (rules.length ? '<ul class="list">' + rules.map((f, i) => '<li style="--i:' + i + '" data-filter="' + esc(f.id) + '"><div class="rowtop">' +
        '<span class="open"><span class="who"><span class="name">' + esc(f.criteria?.from || f.criteria?.query || '(no sender)') + '</span></span>' +
        '<span class="snip">' + ((f.action?.removeLabelIds || []).includes('INBOX') ? 'Skips the inbox' : 'Stays in the inbox') + '</span></span>' +
        '<button class="act warn" data-act="del-rule" aria-label="Delete rule">' + ICON.bin + '</button></div></li>').join('') + '</ul>' : '') +
      '</div>';
  };

  const labelRow = (l, line, tools) => '<li data-label="' + esc(l.id) + '"><div class="rowtop">' +
    '<span class="open"><span class="who"><span class="name">' + esc(l.name) + '</span></span><span class="snip">' + line + '</span></span>' +
    tools + '</div></li>';

  const others = tags().filter(l => !yours.includes(l));
  const otherCard = others.length ? '<div class="card"><h2>Other labels in Gmail</h2>' +
    '<p class="cnote">Not used as tags, so not in the mailbox menu. Switch one on to filter by it.</p><ul class="list">' +
    others.map(l => labelRow(l, esc(size(l.id) || '&nbsp;'), '<span class="gtools">' + chipBtn(l) + delBtn(l, 'label') + '</span>')).join('') +
    '</ul></div>' : '';

  const left = userLabels().filter(l => leftover(l) && !shown.has(l.id));
  const clearable = left.filter(l => !leftover(l).keep);
  const leftCard = left.length ? '<div class="card"><h2>Left by other apps</h2>' +
    '<p class="cnote">Old folders other mail apps and services made in your Gmail. Hidden here. Deleting one takes the label off; the emails stay.</p><ul class="list">' +
    left.map(l => {
      const o = leftover(l);
      const line = esc(o.keep || 'From ' + o.who) + (size(l.id) ? ' · ' + esc(size(l.id)) : '');
      return labelRow(l, line, o.keep ? '<span class="kept">Kept</span>' : delBtn(l, 'label'));
    }).join('') + '</ul>' +
    (clearable.length ? '<div class="more"><button class="danger" data-act="del-leftovers">' + ICON.bin + 'Delete all ' + clearable.length + ' unused</button></div>' : '') +
    '</div>' : '';

  const none = yours.length ? '' : '<div class="card"><div class="empty">No tags yet.<br>Swipe right on an email from the school — or anyone — to tag everything they send.</div></div>';
  return form + none + yours.map(tagCard).join('') + otherCard + leftCard;
}

function viewSettings() {
  return '<div class="card panel">' +
    '<div class="field"><label for="days">Delete after</label>' +
      '<span><input type="number" id="days" min="1" max="30" value="' + settings.days + '"> days</span></div>' +
    '<div class="field"><label for="lab">Bucket label</label>' +
      '<input type="text" id="lab" style="width:150px" value="' + esc(settings.label) + '"></div>' +
    '<button class="btn ghost" data-act="save-settings">Save</button>' +
    '<p class="note">Mail is moved to the Trash, where Gmail deletes it for good after 30 days — so there is always a way back.</p>' +
    '<hr style="border:0;border-top:1px solid var(--hair);margin:2px 0">' +
    '<div class="field"><span>Signed in</span><span>' + esc(state.me || '—') + '</span></div>' +
    '<div class="field"><span>Filter permission</span><span>' + (canFilter() ? 'granted' : 'not granted') + '</span></div>' +
    '<div class="field"><span>Unread count on the app icon</span><button class="textbtn" data-act="badge" aria-pressed="' + badgeOn() + '">' + (badgeOn() ? 'On' : 'Off') + '</button></div>' +
    blockedHTML() +
    '<button class="btn ghost" data-act="signin-pick">Switch account</button>' +
    '<button class="btn warn" data-act="signout">Sign out</button>' +
    '<p class="note">Redirect URI registered for this build:<br><code class="url">' + esc(redirectUri()) + '</code></p>' +
  '</div>';
}

// Blocked senders, each with Unblock. The list is Gmail's own filters.
function blockedHTML() {
  if (!canFilter()) return '';
  if (!filtersCache) {
    refreshFilters().then(() => { if (state.view === 'settings') render(); }).catch(() => {});
    return '';
  }
  const list = blockedList();
  return '<hr style="border:0;border-top:1px solid var(--hair);margin:2px 0">' +
    '<div class="field"><span>Blocked senders</span><span>' + (list.length || 'none') + '</span></div>' +
    list.map(b => '<div class="blocked"><span>' + esc(b.email) + '</span><button class="textbtn" data-act="unblock" data-id="' + esc(b.id) + '">Unblock</button></div>').join('') +
    (list.length ? '<p class="note">Unblocking lets their new mail in. Anything already in the Trash stays there until Gmail empties it after 30 days.</p>' : '');
}


// ---------------------------------------------------------------------------
// The message page
// ---------------------------------------------------------------------------
let skipPop = false;

const canMorph = () => !reduced && typeof document.startViewTransition === 'function';
const named = (el, name) => { if (el) el.style.viewTransitionName = name || ''; };

function openReader(item) {
  state.reading = { item, msgs: null, open: new Set(), images: false, error: null };
  try { history.pushState({ mailReader: item.id }, ''); } catch {}
  const el = $('#reader'), li = rowsFor([item.id])[0];
  const show = () => {
    el.classList.remove('hide', 'leaving');
    el.scrollTop = 0;
    renderReader();
    named(li);
    named(el.querySelector('.rhead'), el.classList.contains('vt') ? 'msg' : '');
  };
  if (canMorph() && li) {
    el.classList.add('vt');
    named(li, 'msg');
    document.startViewTransition(show).finished.finally(() => { named(el.querySelector('.rhead')); el.classList.remove('vt'); });
  } else show();
  fetchThread(item)
    .then(msgs => {
      const r = state.reading;
      if (r?.item !== item) return;
      r.msgs = msgs;
      // As in Mail: the newest message open, and any you haven't read.
      r.open = new Set([msgs[msgs.length - 1]?.id, ...msgs.filter(m => m.labelIds.includes('UNREAD')).map(m => m.id)]);
      renderReaderBody();
    })
    .catch(err => {
      if (state.reading?.item !== item) return;
      state.reading.error = err instanceof AuthError ? 'Session expired — go back and reconnect.' : err.message;
      renderReaderBody();
    })
    .finally(() => markRead(item).then(changed => { if (changed) { quietOnce = true; render(); } }).then(() => settleReminder(item)));
}

function closeReader(fromHistory) {
  if (!state.reading) return Promise.resolve();
  const item = state.reading.item;
  state.reading = null;
  closeSheet();
  if (!fromHistory && history.state?.mailReader) { skipPop = true; history.back(); }
  const el = $('#reader');
  return new Promise(done => {
    const finish = () => { el.classList.add('hide'); el.classList.remove('leaving', 'vt'); el.innerHTML = ''; };
    const after = () => { fadeReadDots(); done(); };
    const li = rowsFor([item.id])[0];
    if (canMorph() && li && !el.classList.contains('hide')) {        // the message shrinks back into its row
      named(el.querySelector('.rhead'), 'msg');
      el.classList.add('vt');
      const t = document.startViewTransition(() => { finish(); named(li, 'msg'); fadeReadDots(); });   // the dot fades as it lands
      t.finished.finally(() => { named(li); done(); });
      return;
    }
    if (reduced) { finish(); return after(); }
    el.classList.add('leaving');
    setTimeout(() => { finish(); after(); }, 280);
  });
}

// Messages read while open lose their dot with a little fade on the way back.
function fadeReadDots() {
  for (const d of screen.querySelectorAll('.who .dot.fade')) {
    d.classList.add('go');
    const gone = () => d.remove();
    d.addEventListener('animationend', gone, { once: true });
    setTimeout(gone, reduced ? 0 : 800);
  }
  for (const list of Object.values(state.lists)) for (const it of list.items || []) it.fading = false;
}

function renderReader() {
  const r = state.reading;
  if (!r) return;
  const it = r.item, inBucket = it.labelIds.includes(bucketId());
  $('#reader').innerHTML = '<div class="wrap">' +
    '<div class="rtop">' +
      '<button class="iconbtn" data-act="close-reader" aria-label="Back">' + ICON.chev + '</button>' +
      '<span class="rspace"></span>' +
      '<button class="pillbtn" data-act="tag-open">' + ICON.label + 'Tag</button>' +
      '<button class="iconbtn" data-act="reader-more" aria-label="More">' + ICON.more + '</button>' +
      (inBucket
        ? '<button class="pillbtn bluec" data-act="restore-reader">' + ICON.back + 'Inbox</button>'
        : '<button class="pillbtn tagc" data-act="bucket-reader">' + ICON.mkt + esc(settings.label) + '</button>') +
    '</div>' +
    '<div class="card rhead">' +
      '<div class="rsubj">' + esc(it.subject) + '</div>' +
      (it.count > 1 ? '<div class="rcount">' + it.count + ' messages</div>' : '') +
      '<div class="rtags" id="rtags">' + tagChips(it.labelIds) + '</div>' +
    '</div>' +
    '<div id="rbody"></div>' +
    '<div class="rfoot"><button class="plink" data-act="open" data-thread="' + esc(it.threadId) + '">Open in Gmail ' + ICON.out + '</button></div>' +
    '<div class="rbar" id="rbar"></div>' +
  '</div>';
  renderReaderBar();
  renderReaderBody();
}

function renderReaderBar() {
  const bar = $('#rbar'), it = state.reading?.item;
  if (!bar || !it) return;
  const flagged = it.labelIds.includes('STARRED');
  bar.innerHTML =
    '<span class="rgroup">' +
      '<button class="rb bin" data-act="reader-trash" aria-label="Trash">' + ICON.trash + '</button>' +
      '<button class="rb" data-act="reader-archive" aria-label="Archive">' + ICON.archive + '</button>' +
      '<button class="rb' + (flagged ? ' on' : '') + '" data-act="reader-flag" aria-label="' + (flagged ? 'Remove flag' : 'Flag') + '" aria-pressed="' + flagged + '">' + ICON.flag + '</button>' +
    '</span>' +
    '<span class="rgroup">' + replyButtons() + '</span>';
}

// One message of the conversation: a header you tap to open or fold it, and
// when open, the message itself.
function msgCard(m, open) {
  const initial = ([...m.from.name.trim()][0] || '?').toUpperCase();
  const who = '<span class="avatar" style="--h:' + hue(m.from.host || m.from.email) + '">' + esc(initial) + '</span>' +
    '<span class="rwho"><strong>' + esc(m.from.name) + '</strong><span class="rmail">' +
      (open ? esc(m.from.email) + (m.to ? ' → ' + esc(m.to.replace(/\s*<[^>]*>/g, '').slice(0, 80)) : '') : esc(m.snippet.slice(0, 90))) +
    '</span></span>' +
    '<span class="rwhen">' + esc(open ? fullDate(m.date) : ago(m.date)) + '</span>';
  const head = '<button class="mhead" data-act="toggle-msg" data-msg="' + esc(m.id) + '" aria-expanded="' + open + '">' + who + '</button>';
  if (!open) return '<div class="card msg folded" data-card="' + esc(m.id) + '">' + head + '</div>';
  const body = m.html
    ? '<div class="mbody html"><iframe class="rframe" data-msg="' + esc(m.id) + '" title="Message from ' + esc(m.from.name) + '" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe></div>'
    : '<div class="mbody rtext">' + (m.text ? linkify(tidy(m.text)) : esc(m.snippet || 'This message has no text.')) + '</div>';
  return '<div class="card msg" data-card="' + esc(m.id) + '">' + head + unsubHTML(m) + body + filesHTML(m) + '</div>';
}

// As in Mail: "This message is from a mailing list", with the way out.
function unsubHTML(m) {
  if (!m.unsub) return '';
  const when = unsubbed()[m.unsub.email];
  if (when) {
    return '<div class="unsub"><span>You unsubscribed on ' + esc(shortDay(when)) + '. Still getting it?</span>' +
      '<button class="textbtn" data-act="block-sender" data-email="' + esc(m.unsub.email) + '">Block</button></div>';
  }
  return '<div class="unsub"><span>This message is from a mailing list.</span>' +
    '<button class="textbtn" data-act="unsub" data-msg="' + esc(m.id) + '">Unsubscribe</button></div>';
}
function unsubbed() { try { return JSON.parse(ls.get(K.unsubbed, '{}')) || {}; } catch { return {}; } }
function markUnsubbed(email) { const u = unsubbed(); u[email] = Date.now(); ls.set(K.unsubbed, JSON.stringify(u)); }
const shortDay = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Files on a message: one tappable row each, as in Mail.
function filesHTML(m) {
  if (!m.files?.length) return '';
  return '<div class="mfiles">' + m.files.map((f, i) =>
    '<button class="fchip" data-act="open-file" data-msg="' + esc(m.id) + '" data-i="' + i + '" aria-label="Open ' + esc(f.name) + '">' +
      fileRow(f, '<span class="fsize">' + esc(fmtSize(f.size)) + '</span>') + '</button>').join('') + '</div>';
}

// The coloured badge (PDF, JPG…), the name and the size.
const FILE_HUE = [[/pdf/, 2], [/^image\//, 145], [/word|document|rtf|text\//, 214], [/sheet|excel|csv/, 130], [/presentation|powerpoint|keynote/, 28], [/zip|compressed|tar/, 45]];
function fileRow(f, extra = '') {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(f.name || '') || [, 'file'])[1].toUpperCase().slice(0, 4);
  const h = (FILE_HUE.find(([re]) => re.test((f.type || '').toLowerCase())) || [, 230])[1];
  return '<span class="fext" style="--h:' + h + '" aria-hidden="true">' + esc(ext) + '</span>' +
    '<span class="fmeta"><span class="fname">' + esc(f.name || 'Attachment') + '</span>' + extra + '</span>';
}
function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return n + ' bytes';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0) + ' MB';
}

// Gmail sends base64url; MIME and atob want plain base64.
const b64std = s => { s = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''); return s + '='.repeat((4 - s.length % 4) % 4); };
function bytesOf(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function fetchFile(msgId, f) {
  const r = await api('/messages/' + encodeURIComponent(msgId) + '/attachments/' + encodeURIComponent(f.attId));
  return b64std(r.data || '');
}

// Which files may be opened as a page of their own. A file opened from here (a
// blob: URL) belongs to the app's own site, so an HTML or SVG attachment opened
// that way could run the sender's script as the app and read the Gmail token.
// Only pictures and PDFs open; anything else is Share or Save only, and is held
// as plain bytes so no browser can show it as a page. The type is the sender's
// word, so it is tidied and checked against the list, never used as given.
const OPENABLE = /^(?:image\/(?:png|jpeg|gif|webp|heic|heif|bmp|avif)|application\/pdf)$/;
const mimeOf = f => String(f?.type || '').split(';')[0].trim().toLowerCase();
const openable = f => OPENABLE.test(mimeOf(f));

// Opens a file in a sheet: a preview for pictures, and Share / Open. The
// download happens first, so the Share tap is its own gesture (iOS needs one).
async function openFile(msgId, i) {
  const m = state.reading?.msgs?.find(x => x.id === msgId), f = m?.files?.[i];
  if (!f) return;
  closeSheet();
  const s = state.sheet = { file: f };
  const el = $('#sheet');
  el.innerHTML = '<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(f.name) + '"></div>';
  el.classList.remove('hide', 'leaving');
  renderFileSheet();
  try {
    const data = await fetchFile(msgId, f);
    if (state.sheet !== s) return;
    s.blob = new Blob([bytesOf(data)], { type: openable(f) ? mimeOf(f) : 'application/octet-stream' });
    s.url = URL.createObjectURL(s.blob);
  } catch (err) {
    if (state.sheet !== s) return;
    if (err instanceof AuthError) { closeSheet(); return failed(err); }
    s.error = err.message;
  }
  renderFileSheet();
}

function renderFileSheet() {
  const s = state.sheet, box = $('#sheet .sheet');
  if (!s?.file || !box) return;
  const f = s.file, ok = openable(f), img = ok && /^image\//.test(mimeOf(f)) && s.url;
  box.innerHTML = '<div class="grab"></div>' +
    '<div class="fchip">' + fileRow(f, '<span class="fsize">' + esc(fmtSize(f.size)) + '</span>') + '</div>' +
    (img ? '<img class="fprev" src="' + s.url + '" alt="' + esc(f.name) + '">' : '') +
    (s.error ? '<p class="note cnote-bad">Couldn’t download it: ' + esc(s.error) + '</p>'
      : !s.url ? '<p class="fwait">Downloading…</p>'
      : '<button class="btn" data-act="file-share">Share or Save…</button>' +
        (ok ? '<a class="btn ghost" href="' + s.url + '" target="_blank" rel="noopener">Open</a>' : '')) +
    '<button class="btn ghost" data-act="sheet-close">Done</button>';
}

// The share sheet (Save to Files, Photos, AirDrop…); a plain download where
// the browser can't share files.
async function shareFile() {
  const s = state.sheet;
  if (!s?.blob) return;
  // The share sheet gets the file's real type, so iOS offers the right apps;
  // it leaves the app there, so the type can't make it run as the app.
  const file = new File([s.blob], s.file.name || 'attachment', { type: mimeOf(s.file) || s.blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); }
    catch (e) { if (e.name !== 'AbortError') toast('Couldn’t share it: ' + e.message, { bad: true }); }
    return;
  }
  const a = document.createElement('a');
  a.href = s.url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
}

// Puts each open message's HTML into its sandboxed frame and sizes it.
function mountFrames(root) {
  const r = state.reading;
  for (const frame of root.querySelectorAll('iframe[data-msg]')) {
    const m = r.msgs.find(x => x.id === frame.dataset.msg);
    if (!m) continue;
    frame.addEventListener('load', () => fitFrame(frame));
    frame.srcdoc = emailDoc(m.html, r.images);
    for (const ms of r.images ? [300, 1000, 2500, 6000] : [250, 900]) setTimeout(() => fitFrame(frame), ms);
  }
}

function renderReaderBody() {
  const r = state.reading, box = $('#rbody');
  if (!r || !box) return;
  if (r.error) { box.innerHTML = '<div class="card"><div class="empty">' + esc(r.error) + '</div></div>'; return; }
  if (!r.msgs) { box.innerHTML = '<div class="card">' + '<div class="skel" style="--i:0"></div><div class="skel" style="--i:1"></div><div class="skel" style="--i:2"></div>' + '</div>'; return; }
  const remote = r.msgs.some(m => m.html && wantsImages(m.html));
  box.innerHTML = (!r.images && remote
    ? '<div class="card imgnote">' + ICON.img + '<span>Images are off, so the sender can’t tell you opened this.</span><button data-act="show-images">Show</button></div>'
    : '') + r.msgs.map(m => msgCard(m, r.open.has(m.id))).join('');
  mountFrames(box);
}

// Opens or folds one message without redrawing the rest.
function toggleMsg(id) {
  const r = state.reading, card = $('#rbody')?.querySelector('[data-card="' + CSS.escape(id) + '"]');
  const m = r?.msgs?.find(x => x.id === id);
  if (!card || !m) return;
  if (r.open.has(id)) r.open.delete(id); else r.open.add(id);
  const tmp = document.createElement('div');
  tmp.innerHTML = msgCard(m, r.open.has(id));
  const fresh = tmp.firstChild;
  card.replaceWith(fresh);
  fresh.classList.add('unfold');
  mountFrames(fresh);
}

// ---------------------------------------------------------------------------
// Writing: new messages, replies, forwards
// ---------------------------------------------------------------------------
const UPLOAD = 'https://gmail.googleapis.com/upload/gmail/v1/users/me';
const UNDO_SEND = Number(ls.get('mail.undoSend', '')) || 5000;   // (the tests shorten this)

function b64utf8(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}
// Headers are ASCII: anything else goes in an RFC 2047 encoded word.
const encWord = str => /^[\x20-\x7e]*$/.test(str) ? str : '=?UTF-8?B?' + b64utf8(str) + '?=';
// A header value is one line. Nothing typed can split it and add a header -
// no sneaking a Bcc in through the subject.
const oneLine = str => String(str || '').replace(/[\r\n]+/g, ' ').trim();
const wrap76 = str => str.replace(/.{76}/g, '$&\r\n');

// "Name <a@b.com>, c@d.org" -> [{ name, email, ok }]
function parseAddresses(text) {
  const out = [];
  for (const piece of String(text || '').split(/[,;]/)) {
    const t = piece.trim();
    if (!t) continue;
    const m = /^(.*?)<\s*([^<>\s]+)\s*>$/.exec(t);
    const email = (m ? m[2] : t).trim().toLowerCase(), name = m ? m[1].trim().replace(/^"|"$/g, '') : '';
    out.push({ name, email, ok: /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[a-z]{2,}$/i.test(email) });
  }
  return out;
}
const formatAddresses = list => list.map(a => a.name ? encWord(oneLine(a.name).replace(/"/g, '')) + ' <' + a.email + '>' : a.email).join(', ');

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const n of doc.querySelectorAll('script, style, head, noscript')) n.remove();
  for (const n of doc.querySelectorAll('br')) n.replaceWith('\n');
  for (const n of doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, table, blockquote')) n.append('\n');
  return doc.body?.textContent || '';
}
const plainOf = m => m.text ? tidy(m.text) : m.html ? tidy(htmlToText(m.html)) : m.snippet || '';
const longDate = ms => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// The whole message, as Gmail's upload endpoint takes it. Text is UTF-8 in
// base64; files (when there are any) make it multipart/mixed.
function buildMime(job) {
  const h = [];
  if (state.me) h.push('From: ' + state.me);
  h.push('To: ' + formatAddresses(job.to));
  if (job.cc.length) h.push('Cc: ' + formatAddresses(job.cc));
  h.push('Subject: ' + encWord(oneLine(job.subject)));
  h.push('Date: ' + new Date().toUTCString());
  h.push('Message-ID: <' + crypto.randomUUID() + '@mail.tomallison24.github.io>');
  if (job.inReplyTo) h.push('In-Reply-To: ' + oneLine(job.inReplyTo));
  if (job.references) h.push('References: ' + oneLine(job.references));
  h.push('MIME-Version: 1.0');
  const textPart = 'Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(b64utf8(job.body.replace(/\r?\n/g, '\r\n')));
  const files = (job.files || []).filter(f => f.data);
  if (!files.length) return h.join('\r\n') + '\r\n' + textPart + '\r\n';
  const bnd = 'mix_' + crypto.randomUUID().replace(/-/g, '');
  const parts = [textPart].concat(files.map(f =>
    'Content-Type: ' + oneLine(f.type || 'application/octet-stream') + '; name="' + encWord(oneLine(f.name).replace(/"/g, '')) + '"\r\n' +
    'Content-Disposition: attachment; filename="' + encWord(oneLine(f.name).replace(/"/g, '')) + '"\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' + wrap76(f.data)));
  return h.join('\r\n') + '\r\nContent-Type: multipart/mixed; boundary="' + bnd + '"\r\n\r\n' +
    parts.map(p => '--' + bnd + '\r\n' + p + '\r\n').join('') + '--' + bnd + '--\r\n';
}

// Sends (or saves) through Gmail's upload endpoint, which takes the thread to
// join alongside the message. Never retried: if the answer is lost the message
// may already have gone, and a second try would send it twice.
async function uploadMime(what, raw, meta) {
  const tok = getToken();
  if (!tok) throw new AuthError('signed out');
  const bnd = 'rel_' + crypto.randomUUID().replace(/-/g, '');
  const body = '--' + bnd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + bnd + '\r\nContent-Type: message/rfc822\r\n\r\n' + raw + '\r\n--' + bnd + '--';
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT * 3);
  let res, text;
  try {
    res = await fetch(UPLOAD + '/' + what + '?uploadType=multipart', {
      method: 'POST', body, signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + tok.t, 'Content-Type': 'multipart/related; boundary=' + bnd },
    });
    text = await res.text();
  } catch (e) {
    const err = new Error(ctl.signal.aborted ? 'Gmail took too long to answer' : 'No connection to Gmail');
    err.unsure = true;
    throw err;
  } finally { clearTimeout(timer); }
  if (res.status === 401) { ls.del(K.token); throw new AuthError('token expired'); }
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try { msg = JSON.parse(text).error.message; } catch {}
    throw new Error(msg || 'Gmail returned ' + res.status);
  }
  return text ? JSON.parse(text) : null;
}

// What a reply, reply-all or forward starts with, from the message it answers:
// the newest in the conversation.
function draftFrom(mode, r) {
  const m = r.msgs[r.msgs.length - 1], me = (state.me || '').toLowerCase();
  const mine = m.from.email === me;
  const bare = list => parseAddresses(list).filter(a => a.ok).map(a => a.email);
  const subj = m.subject || r.item.subject || '';
  if (mode === 'fwd') {
    return {
      mode, to: '', cc: '', subject: /^fwd?:/i.test(subj) ? subj : 'Fwd: ' + subj,
      body: '\n\n---------- Forwarded message ---------\nFrom: ' + m.from.name + ' <' + m.from.email + '>\nDate: ' + longDate(m.date) +
        '\nSubject: ' + subj + '\nTo: ' + (m.to || '') + '\n\n' + plainOf(m),
      files: m.files.map(f => ({ ...f, msgId: m.id })),
    };
  }
  let to = mine ? bare(m.to) : bare(m.replyTo || '').length ? bare(m.replyTo) : [m.from.email];
  let cc = [];
  if (mode === 'all') {
    to = to.concat(bare(m.to));
    cc = bare(m.cc);
  }
  const uniq = list => [...new Set(list)].filter(e => e && e !== me);
  to = uniq(to);
  cc = uniq(cc).filter(e => !to.includes(e));
  return {
    mode, to: to.join(', '), cc: cc.join(', '), subject: /^re:/i.test(subj) ? subj : 'Re: ' + subj,
    body: '\n\nOn ' + longDate(m.date) + ', ' + m.from.name + ' <' + m.from.email + '> wrote:\n' + plainOf(m).split('\n').map(l => '> ' + l).join('\n'),
    threadId: r.item.threadId, inReplyTo: m.messageId, references: [m.references, m.messageId].filter(Boolean).join(' '),
  };
}

const COMPOSE_TITLE = { new: 'New Message', reply: 'Reply', all: 'Reply All', fwd: 'Forward' };

function openCompose(job, { note } = {}) {
  state.compose = { mode: 'new', to: '', cc: '', subject: '', body: '', files: [], ...job, start: job.body || '' };
  state.compose.files = [...(state.compose.files || [])];
  state.compose.startFiles = state.compose.files.length;
  const c = state.compose, el = $('#compose');
  el.innerHTML = '<div class="cwrap">' +
    '<div class="ctop">' +
      '<button class="textbtn" data-act="compose-cancel">Cancel</button>' +
      '<span class="ctitle">' + esc(COMPOSE_TITLE[c.mode] || 'New Message') + '</span>' +
      '<button class="send" data-act="compose-send" aria-label="Send">' + ICON.up + '</button>' +
    '</div>' +
    (note ? '<div class="card cnote-bad">' + esc(note) + '</div>' : '') +
    '<div class="card cform">' +
      '<label class="cf"><span>To:</span><input id="c-to" type="text" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + esc(c.to) + '"></label>' +
      '<label class="cf"><span>Cc:</span><input id="c-cc" type="text" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + esc(c.cc) + '"></label>' +
      '<label class="cf"><span>Subject:</span><input id="c-subj" type="text" value="' + esc(c.subject) + '"></label>' +
      '<textarea id="c-body" aria-label="Message">' + esc(c.body) + '</textarea>' +
      '<div class="cfiles" id="c-files"></div>' +
      '<button class="cattach" data-act="compose-attach">' + ICON.clip + 'Add Attachment</button>' +
      '<input id="c-pick" type="file" multiple hidden>' +
    '</div>' +
  '</div>';
  el.classList.remove('hide', 'leaving');
  renderComposeFiles();
  const body = $('#c-body');
  body.setSelectionRange(0, 0);
  setTimeout(() => (c.to ? body : $('#c-to')).focus(), 350);
}

// Gmail's limit on attachments (the message itself, base64 and all, must fit
// under the upload endpoint's 35 MB).
const MAX_FILES = 25 * 1048576;
const filesTotal = files => (files || []).reduce((n, f) => n + (f.size || 0), 0);
// A file you added from the phone survives Undo, but not the app closing: only
// forwarded ones (still in Gmail) can be fetched again.
const lostFile = f => !f.data && !f.attId && !f.reading;

// Files on the message being written, each with a remove button.
function renderComposeFiles() {
  const c = state.compose, el = $('#c-files');
  if (!c || !el) return;
  el.innerHTML = c.files.map((f, i) => '<div class="fchip">' +
    fileRow(f, lostFile(f) ? '<span class="fsize lost">Not kept — add it again</span>' : '<span class="fsize">' + esc(f.reading ? 'Adding…' : fmtSize(f.size)) + '</span>') +
    '<button class="fx" data-act="compose-unfile" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">×</button></div>').join('');
}

const readB64 = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error || new Error('Couldn’t read the file'));
  r.readAsDataURL(file);
});

async function addComposeFiles(input) {
  const c = state.compose;
  const picked = [...(input.files || [])];
  input.value = '';
  if (!c) return;
  for (const file of picked) {
    if (filesTotal(c.files) + file.size > MAX_FILES) {
      toast('“' + file.name + '” is too big — attachments can come to 25 MB in all', { bad: true, ms: 6000 });
      continue;
    }
    const f = { name: file.name || 'attachment', type: file.type || 'application/octet-stream', size: file.size, data: null, reading: true };
    c.files.push(f);                                   // counts toward the limit while it reads
    renderComposeFiles();
    try { f.data = await readB64(file); }
    catch (err) { c.files.splice(c.files.indexOf(f), 1); toast('Couldn’t add “' + file.name + '”: ' + err.message, { bad: true }); }
    delete f.reading;
    if (state.compose === c) renderComposeFiles();
  }
}

function readCompose() {
  return { to: $('#c-to').value, cc: $('#c-cc').value, subject: $('#c-subj').value, body: $('#c-body').value };
}

function closeCompose() {
  const el = $('#compose');
  state.compose = null;
  if (el.classList.contains('hide')) return;
  const finish = () => { el.classList.add('hide'); el.classList.remove('leaving'); el.innerHTML = ''; };
  if (reduced) return finish();
  el.classList.add('leaving');
  setTimeout(finish, 280);
}

// A choice of several, in the same sheet as the confirmations.
function choiceSheet({ title, body, options }) {
  closeSheet();
  return new Promise(resolve => {
    confirmDone = resolve;
    state.sheet = { confirm: true };
    const el = $('#sheet');
    el.innerHTML = '<div class="scrim" data-act="sheet-close"></div>' +
      '<div class="sheet" role="alertdialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="grab"></div><h3>' + esc(title) + '</h3>' + (body ? '<p class="note">' + body + '</p>' : '') +
        options.map(o => '<button class="btn ' + (o.danger ? 'warn' : o.primary ? '' : 'ghost') + '" data-act="choice" data-id="' + esc(o.id) + '">' + esc(o.label) + '</button>').join('') +
        '<button class="btn ghost" data-act="sheet-close">Cancel</button>' +
      '</div>';
    el.classList.remove('hide', 'leaving');
  });
}

async function sendCompose() {
  const c = state.compose;
  if (!c) return;
  const f = readCompose();
  const to = parseAddresses(f.to), cc = parseAddresses(f.cc);
  const bad = to.concat(cc).find(a => !a.ok);
  if (!to.length) return toast('Add someone to send it to', { bad: true });
  if (bad) return toast('That address doesn’t look right: ' + bad.email, { bad: true, ms: 6000 });
  const busy = c.files.find(f => f.reading);
  if (busy) return toast('Still adding “' + busy.name + '”…', { ms: 3000 });
  const lost = c.files.find(lostFile);
  if (lost) return toast('Add “' + lost.name + '” again, or remove it', { bad: true, ms: 6000 });
  if (filesTotal(c.files) > MAX_FILES) return toast('Attachments come to ' + fmtSize(filesTotal(c.files)) + ' — the limit is 25 MB', { bad: true, ms: 6000 });
  const job = { ...c, ...f, to, cc };
  // Held for a few seconds so Undo can take it back - and on disk meanwhile,
  // so closing the app can't lose it.
  const keep = { ...job, to: f.to, cc: f.cc, files: (job.files || []).map(({ data, ...rest }) => rest) };
  ls.set(K.pending, JSON.stringify(keep));
  closeCompose();
  let undone = false;
  toast('Sending…', { label: 'Undo', ms: UNDO_SEND + 600, action: () => { undone = true; ls.del(K.pending); openCompose({ ...keep, files: job.files }); } });
  await sleep(UNDO_SEND);
  if (undone) return;
  toast('Sending…', { ms: 60000 });
  try {
    await ensureFileData(job);
    await uploadMime('messages/send', buildMime(job), job.threadId ? { threadId: job.threadId } : {});
    ls.del(K.pending);
    toast('Sent');
    if (state.reading && job.threadId === state.reading.item.threadId) refreshReader();
    // Refresh the list on screen in place (its rows must stay findable while
    // the reader is open); other lists reload when next shown.
    const key = currentList().key;
    for (const k of Object.keys(state.lists)) if (k !== key) delete state.lists[k];
    loadList({ force: true, quiet: true });
  } catch (err) {
    ls.del(K.pending);
    if (err instanceof AuthError) { ls.set(K.pending, JSON.stringify(keep)); return failed(err); }
    if (err.unsure) {
      openCompose({ ...keep, files: job.files }, { note: 'Gmail didn’t answer, so this may already have been sent. Check your Sent mail before sending again.' });
    } else {
      openCompose({ ...keep, files: job.files }, { note: 'Not sent: ' + err.message });
    }
  }
}

// Forwarded files are fetched from Gmail only when the message goes. Files
// that can't be (added on the phone, then the app closed) are left off a
// draft, and stop a send before it starts (above).
async function ensureFileData(job) {
  job.files = (job.files || []).filter(f => f.data || f.attId);
  for (const f of job.files) if (!f.data) f.data = await fetchFile(f.msgId, f);
}

async function cancelCompose() {
  const c = state.compose;
  if (!c) return;
  const f = readCompose();
  const typed = f.body.trim() !== (c.start || '').trim() || (c.mode === 'new' && (f.to.trim() || f.subject.trim())) || c.files.length !== c.startFiles;
  if (!typed) return closeCompose();
  const pick = await choiceSheet({
    title: 'Keep this message?',
    options: [{ id: 'save', label: 'Save Draft', primary: true }, { id: 'delete', label: 'Delete Draft', danger: true }],
  });
  if (!pick) return;                                   // Cancel: back to writing
  if (pick === 'delete') return closeCompose();
  const job = { ...c, ...f, to: parseAddresses(f.to).filter(a => a.ok), cc: parseAddresses(f.cc).filter(a => a.ok) };
  closeCompose();
  toast('Saving draft…', { ms: 60000 });
  try {
    await ensureFileData(job);
    await uploadMime('drafts', buildMime(job), { message: job.threadId ? { threadId: job.threadId } : {} });
    toast('Draft saved in Gmail');
  } catch (err) {
    if (err instanceof AuthError) return failed(err);
    openCompose({ ...c, ...f }, { note: (err.unsure ? 'Gmail didn’t answer, so the draft may have been saved. ' : 'Draft not saved: ') + err.message });
  }
}

// Shows your reply in the open conversation once it's sent.
async function refreshReader() {
  const r = state.reading;
  if (!r) return;
  try {
    const msgs = await fetchThread(r.item);
    if (state.reading !== r) return;
    r.msgs = msgs;
    r.open.add(msgs[msgs.length - 1]?.id);
    r.item.count = msgs.length;
    renderReader();
  } catch {}
}

function replyButtons() {
  return '<button class="rb" data-act="reader-reply" aria-label="Reply">' + ICON.reply + '</button>' +
    '<button class="rb" data-act="compose-new" aria-label="New message">' + ICON.compose + '</button>';
}

// ---------------------------------------------------------------------------
// Blocking and unsubscribing
// ---------------------------------------------------------------------------
// A block is a Gmail filter - from this address, straight to the Trash - so it
// works whether or not the app is open, as Gmail's own "Delete it" rule does.
const isBlock = f => (f.action?.addLabelIds || []).includes('TRASH') && /^[^\s@()]+@[^\s@()]+$/.test(f.criteria?.from || '');
const blockedList = () => (filtersCache || []).filter(isBlock).map(f => ({ id: f.id, email: f.criteria.from.toLowerCase() }));

// Who a conversation's "Block" means: the newest message not from you.
function senderOf(r) {
  const me = (state.me || '').toLowerCase();
  const m = [...(r.msgs || [])].reverse().find(x => x.from.email && x.from.email !== me);
  return m ? { email: m.from.email, name: m.from.name } : { email: r.item.email, name: r.item.name };
}

async function blockSender(email) {
  const back = { email, filterId: null, trashed: [], inboxMsgs: [], missed: 0 };
  if (!canFilter()) throw new Error('Blocking needs the filter permission — use Switch account in Settings to grant it');
  const same = f => isBlock(f) && f.criteria.from.toLowerCase() === email;
  if (!(await refreshFilters(true)).some(same)) {
    try {
      const made = await api('/settings/filters', { method: 'POST', once: true, body: { criteria: { from: email }, action: { addLabelIds: ['TRASH'] } } });
      back.filterId = made.id;
      filtersCache.push(made);
    } catch (e) {
      if (e instanceof AuthError) throw e;
      const now = (await refreshFilters(true)).find(same);   // made after all?
      if (!now) throw e;
      back.filterId = now.id;
    }
  }
  // Their mail already here goes too; what was in the inbox is noted for Undo.
  const q = 'from:(' + email + ') -in:sent -in:chats';
  const [ids, inbox] = await Promise.all([allIds(q, { cap: 800 }), allIds(q + ' in:inbox', { cap: 800 })]);
  back.inboxMsgs = inbox;
  await pool(ids, 6, async id => {
    try { await api('/messages/' + id + '/trash', { method: 'POST' }); back.trashed.push(id); }
    catch (e) { if (e instanceof AuthError) throw e; back.missed++; }
  });
  return back;
}

async function undoBlock(back) {
  try {
    toast('Unblocking…', { ms: 60000 });
    if (back.filterId) {
      await api('/settings/filters/' + back.filterId, { method: 'DELETE' });
      if (filtersCache) filtersCache = filtersCache.filter(f => f.id !== back.filterId);
    }
    await pool(back.trashed, 6, id => api('/messages/' + id + '/untrash', { method: 'POST' }));
    const put = new Set(back.trashed);
    await relabel(back.inboxMsgs.filter(id => put.has(id)), ['INBOX']);
    toast('Unblocked ' + back.email);
    state.lists = {};
    go({ force: true });
  } catch (err) { failed(err); }
}

async function doBlock(email, name) {
  email = (email || '').toLowerCase();
  if (!email) return;
  if (email === (state.me || '').toLowerCase()) return toast('That’s you — you can’t block yourself', { bad: true });
  const ok = await confirmSheet({
    title: 'Block ' + (name && name !== email ? name : email) + '?',
    body: 'New mail from <b>' + esc(email) + '</b> will go straight to the Trash, and their mail already here goes there too. ' +
      'Nothing is sent to them. Unblock any time in Settings.',
    yes: 'Block',
  });
  if (!ok) return;
  await closeReader();
  const rows = (state.lists[currentList().key]?.items || []).filter(it => it.email === email);
  await Promise.all(rowsFor(rows.map(it => it.id)).map(li => vanish(li, 'left')));
  patch(it => it.email === email, ['TRASH'], ['INBOX']);
  for (const [k, l] of Object.entries(state.lists)) if (l.items) l.items = l.items.filter(it => belongs(k, it));
  quietOnce = true;
  render();
  toast('Blocking ' + email + '…', { ms: 60000 });
  try {
    const back = await blockSender(email);
    const n = back.trashed.length;
    const said = 'Blocked ' + email + (n ? ' · ' + n + (n === 1 ? ' message' : ' messages') + ' to the Trash' : '');
    if (back.missed) toast(said + '; ' + back.missed + ' couldn’t be moved', { bad: true, label: 'Undo', action: () => undoBlock(back) });
    else toast(said, { label: 'Undo', action: () => undoBlock(back) });
    for (const k of Object.keys(state.lists)) if (k !== currentList().key) delete state.lists[k];
  } catch (err) { failed(err); state.lists = {}; go({ force: true }); }
}

async function unblock(id) {
  const b = blockedList().find(x => x.id === id);
  if (!b) return;
  try {
    await api('/settings/filters/' + id, { method: 'DELETE' });
    filtersCache = filtersCache.filter(f => f.id !== id);
    toast('Unblocked ' + b.email + '. Their mail already in the Trash stays there for 30 days.', { ms: 6000 });
    render();
  } catch (err) { failed(err); }
}

// The sheet behind "Unsubscribe": says exactly what will happen, then does it.
function unsubSheet(m) {
  const u = m.unsub, who = m.from.name || u.email;
  closeSheet();
  state.sheet = { unsub: m };
  const el = $('#sheet');
  let body, go;
  if (!u.trusted) {
    body = 'Gmail couldn’t confirm this really comes from <b>' + esc(m.from.host) + '</b>. Unsubscribing from a sender like that can tell a spammer your address works. ' +
      'Block them instead — nothing is sent to them.';
    go = '<button class="btn danger" data-act="block-sender" data-email="' + esc(u.email) + '">' + ICON.block + ' Block ' + esc(u.email) + '</button>';
  } else if (u.oneClick) {
    body = 'Sends ' + esc(who) + ' a one-click unsubscribe request, the same way Gmail’s own Unsubscribe does. It can take a few days for their mail to stop.';
    go = '<button class="btn" data-act="unsub-go">Unsubscribe</button>';
  } else if (u.mailto) {
    body = 'Sends an unsubscribe email from your Gmail to <b>' + esc(mailtoOf(u.mailto)?.to || '') + '</b>. It will show in your Sent mail. It can take a few days for their mail to stop.';
    go = '<button class="btn" data-act="unsub-go">Send Unsubscribe Email</button>';
  } else {
    body = esc(who) + ' only offers an unsubscribe page. It opens in Safari, and you finish there.';
    go = '<a class="btn" data-act="unsub-web" href="' + esc(u.https) + '" target="_blank" rel="noopener noreferrer">Open Unsubscribe Page</a>';
  }
  el.innerHTML = '<div class="scrim" data-act="sheet-close"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="Unsubscribe">' +
      '<div class="grab"></div><h3>' + esc(u.trusted ? 'Unsubscribe from ' + who + '?' : 'Can’t verify this sender') + '</h3>' +
      '<p class="note">' + body + '</p>' + go +
      '<button class="btn ghost" data-act="sheet-close">Cancel</button>' +
    '</div>';
  el.classList.remove('hide', 'leaving');
}

// mailto:address?subject=...&body=... as the sender wrote it.
function mailtoOf(uri) {
  try {
    const u = new URL(uri);
    const to = decodeURIComponent(u.pathname).trim();
    if (!parseAddresses(to).every(a => a.ok) || !to) return null;
    return { to, subject: u.searchParams.get('subject') || 'unsubscribe', body: u.searchParams.get('body') || 'unsubscribe' };
  } catch { return null; }
}

// One-click (RFC 8058): a plain form POST of "List-Unsubscribe=One-Click" to
// the sender's address. The browser sends it without cookies or referrer; it
// can't read the answer (the sender's server isn't this app's), so "sent" is
// as sure as it gets - the same as for Gmail.
async function unsubscribe(m) {
  const u = m.unsub;
  if (!u?.trusted) return;
  closeSheet();
  toast('Unsubscribing…', { ms: 60000 });
  try {
    if (u.oneClick) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
      try {
        await fetch(u.https, { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
          body: new URLSearchParams({ 'List-Unsubscribe': 'One-Click' }), signal: ctl.signal });
      } catch {
        throw new Error(ctl.signal.aborted ? 'their server didn’t answer' : 'couldn’t reach their server');
      } finally { clearTimeout(timer); }
    } else {
      const mt = mailtoOf(u.mailto);
      if (!mt) throw new Error('their unsubscribe address isn’t valid');
      await uploadMime('messages/send', buildMime({ to: parseAddresses(mt.to), cc: [], subject: mt.subject, body: mt.body }), {});
    }
    markUnsubbed(u.email);
    toast('Unsubscribed from ' + (m.from.name || u.email) + '. If their mail keeps coming, Block them.', { ms: 6000 });
    if (state.reading) renderReaderBody();
  } catch (err) {
    if (err instanceof AuthError) return failed(err);
    toast('Couldn’t unsubscribe: ' + err.message + (err.unsure ? ' — check your Sent mail' : ''), { bad: true, ms: 7000 });
  }
}

// The "…" on a message page: Mail's Block Sender, and Unsubscribe.
async function readerMore() {
  const r = state.reading;
  if (!r) return;
  const who = senderOf(r), last = [...(r.msgs || [])].reverse().find(m => m.unsub);
  const pick = await choiceSheet({ title: who.name || who.email, body: esc(who.email), options: [
    { id: 'remind', label: 'Remind Me', primary: true },
    ...(last ? [{ id: 'unsub', label: 'Unsubscribe' }] : []),
    { id: 'block', label: 'Block Sender', danger: true },
  ] });
  if (pick === 'remind') {
    const item = r.item, opts = remindChoices();
    const when = await choiceSheet({ title: 'Remind Me', body: 'It leaves the inbox now and comes back to the top of it, unread, on the day.',
      options: opts.map((o, i) => ({ id: String(i), label: o.label + ' · ' + shortDate(o.date), primary: i === 0 })) });
    if (when != null) remindMe(item, opts[Number(when)].date);
  }
  if (pick === 'unsub') unsubSheet(last);
  if (pick === 'block') doBlock(who.email, who.name);
}

// ---------------------------------------------------------------------------
// Remind Me
// ---------------------------------------------------------------------------
// Gmail's API has no snooze, so a reminder is a label named for its day,
// "Remind 2026-09-28". On that day the app (when it opens) and the daily
// GitHub job put the mail back in the inbox, unread, labelled "Reminded" so it
// sits at the top until you read it.
const REMIND = /^Remind (\d{4}-\d{2}-\d{2})$/i, REMINDED = 'Reminded';
const isReminderLabel = l => REMIND.test(l.name) || l.name.toLowerCase() === REMINDED.toLowerCase();
const reminderId = () => [...labelsById.values()].find(l => l.name.toLowerCase() === REMINDED.toLowerCase())?.id || null;
const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shortDate = d => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function remindChoices(now = new Date()) {
  const at = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const dow = now.getDay();                                   // 0 Sunday … 6 Saturday
  const days = [1, (6 - dow + 7) % 7 || 7, (8 - dow) % 7 || 7];
  const labels = ['Tomorrow', dow === 6 || dow === 0 ? 'Next Weekend' : 'This Weekend', 'Next Week'];
  // On a Friday the weekend is tomorrow, on a Sunday next week is: offer the one after instead
  for (let i = 1; i < days.length; i++) {
    while (days.slice(0, i).includes(days[i])) { days[i] += 7; if (i === 1) labels[1] = 'Next Weekend'; }
  }
  return days.map((n, i) => ({ label: labels[i], date: at(n) }));
}

async function remindMe(item, date) {
  const tid = item.threadId;
  await closeReader();
  await Promise.all(rowsFor([item.id]).map(li => vanish(li, 'left')));
  patch(it => it.threadId === tid, [], ['INBOX']);
  for (const [k, l] of Object.entries(state.lists)) if (l.items) l.items = l.items.filter(it => belongs(k, it));
  quietOnce = true;
  render();
  try {
    const snap = await api('/threads/' + tid, { params: { format: 'minimal' } });
    const inboxMsgs = (snap.messages || []).filter(m => (m.labelIds || []).includes('INBOX')).map(m => m.id);
    const label = await labelNamed('Remind ' + dayStr(date), { create: true });
    await relabelThread(tid, [label.id], ['INBOX']);
    toast('I’ll remind you ' + date.toLocaleDateString(undefined, { weekday: 'long' }), { label: 'Undo', action: async () => {
      try {
        await relabelThread(tid, [], [label.id]);
        await relabel(inboxMsgs, ['INBOX']);
        toast('Put back');
        state.lists = {};
        go({ force: true });
      } catch (err) { failed(err); }
    } });
    updateBadge();
  } catch (err) { failed(err); state.lists = {}; go({ force: true }); }
}

// Due reminders back to the inbox: unread, marked Reminded, the day label gone.
// Your own replies in the conversation stay in Sent.
async function dueReminders() {
  const today = dayStr(new Date());
  const due = (await refreshLabels()).filter(l => { const m = REMIND.exec(l.name); return m && m[1] <= today; });
  if (!due.length) return 0;
  const reminded = await labelNamed(REMINDED, { create: true });
  let n = 0;
  for (const l of due) {
    const ids = await allIds('-in:sent', { labelIds: [l.id], cap: 500 });
    if (ids.length) await relabel(ids, ['INBOX', 'UNREAD', reminded.id]);
    n += ids.length;
    await api('/labels/' + l.id, { method: 'DELETE' });      // takes the day label off everything
  }
  await refreshLabels(true);
  return n;
}
function bringBackReminders() {
  return dueReminders().then(n => {
    if (!n) return;
    toast(n === 1 ? 'A reminder is back in your inbox' : 'Your reminders are back in your inbox');
    delete state.lists.inbox;
    if (state.view === 'inbox' && !state.tag && !state.search) loadList({ force: true, quiet: true });
  }).catch(() => {});
}

// Opening a reminder settles it: it is an ordinary inbox message again.
async function settleReminder(item) {
  const rl = reminderId();
  if (!rl || !item.labelIds.includes(rl)) return;
  try {
    await relabelThread(item.threadId, [], [rl]);
    patch(it => it.threadId === item.threadId, [], [rl]);
    quietOnce = true;
    render();
  } catch {}
}

// ---------------------------------------------------------------------------
// The unread count on the Home Screen icon
// ---------------------------------------------------------------------------
// iOS 16.4+ lets a web app on the Home Screen show a badge (setAppBadge). The
// count is Gmail's own: unread conversations in the inbox.
const canBadge = () => 'setAppBadge' in navigator;
const badgeOn = () => ls.get(K.badge, '') === '1';
let badgeTimer = null;
function updateBadge() {
  if (!canBadge() || !badgeOn() || !getToken() || slowed()) return;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(async () => {
    try {
      const n = (await api('/labels/INBOX')).threadsUnread || 0;
      if (n) await navigator.setAppBadge(n); else await navigator.clearAppBadge();
    } catch {}
  }, 400);
}
async function toggleBadge() {
  if (badgeOn()) {
    ls.del(K.badge);
    try { await navigator.clearAppBadge?.(); } catch {}
    toast('Unread count taken off the icon');
    return render();
  }
  if (!canBadge()) return toast('Only the Home Screen app can show a count on its icon — open Mail from your Home Screen', { bad: true, ms: 7000 });
  // iOS asks for notification permission before it shows a web app's badge.
  if ('Notification' in window && Notification.permission !== 'granted') {
    let p = 'default';
    try { p = await Notification.requestPermission(); } catch {}
    if (p !== 'granted') return toast('Allow notifications for Mail and the icon can show your unread count', { bad: true, ms: 7000 });
  }
  ls.set(K.badge, '1');
  updateBadge();
  toast('The icon now shows how many conversations are unread');
  render();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') updateBadge(); });

// ---------------------------------------------------------------------------
// The tag sheet
// ---------------------------------------------------------------------------
function openSheet(item) {
  const rule = ruleFor(item);
  state.sheet = { item, rule };
  const list = chipTags();
  const who = '<span class="chip">' + esc(rule.label) + '</span>';
  const el = $('#sheet');
  el.innerHTML = '<div class="scrim" data-act="sheet-close"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="Tag sender">' +
      '<div class="grab"></div>' +
      '<h3>Tag ' + (rule.kind === 'domain' ? 'everything from ' : 'mail from ') + who + '</h3>' +
      '<p class="note">This message, what’s already in your mailbox, and all new mail ' +
        (rule.kind === 'domain' ? 'from anyone at ' + esc(rule.label) : 'from this address') + '. It stays in your inbox.</p>' +
      (list.length ? '<div class="tagpick">' + list.map(l => '<button class="chip2' + (item.labelIds.includes(l.id) ? ' has' : '') + '" style="--h:' + hue(l.name) + '" data-act="pick-tag" data-name="' + esc(l.name) + '"><i></i>' + esc(l.name) + '</button>').join('') + '</div>' : '') +
      '<input type="text" id="newtag" maxlength="80" autocomplete="off" autocapitalize="sentences" placeholder="' + (list.length ? 'Or a new tag' : 'New tag') + ' — e.g. Sofia’s school">' +
      '<button class="btn" data-act="apply-tag">' + ICON.label + 'Tag</button>' +
    '</div>';
  el.classList.remove('hide', 'leaving');
  if (!list.length) setTimeout(() => $('#newtag')?.focus(), 350);
}

// A yes/no question in the same sheet, for anything that can't be undone.
let confirmDone = null;
function confirmSheet({ title, body, yes }) {
  closeSheet();
  return new Promise(resolve => {
    confirmDone = resolve;
    state.sheet = { confirm: true };
    const el = $('#sheet');
    el.innerHTML = '<div class="scrim" data-act="sheet-close"></div>' +
      '<div class="sheet" role="alertdialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="grab"></div><h3>' + esc(title) + '</h3><p class="note">' + body + '</p>' +
        '<button class="btn danger" data-act="confirm-yes">' + esc(yes) + '</button>' +
        '<button class="btn ghost" data-act="sheet-close">Cancel</button>' +
      '</div>';
    el.classList.remove('hide', 'leaving');
  });
}

function closeSheet(instant) {
  const el = $('#sheet');
  if (confirmDone) { const done = confirmDone; confirmDone = null; done(null); }
  if (state.sheet?.url) { const u = state.sheet.url; state.sheet.url = null; setTimeout(() => URL.revokeObjectURL(u), 60000); }
  if (el.classList.contains('hide')) return;
  state.sheet = null;
  const finish = () => { if (state.sheet) return; el.classList.add('hide'); el.classList.remove('leaving'); el.innerHTML = ''; };
  if (reduced || instant === true) return finish();
  el.classList.add('leaving');
  setTimeout(finish, 280);
}

// A sheet follows a downward drag; let go far enough (or with a flick) and it
// closes, otherwise it springs back - as sheets do on iOS.
let sheetDrag = null;
document.addEventListener('pointerdown', e => {
  const sh = e.target.closest('#sheet .sheet');
  if (!sh || e.button > 0 || e.target.closest('button, input, textarea, a, select, label')) return;
  sheetDrag = { sh, id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
});
document.addEventListener('pointermove', e => {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  const raw = e.clientY - d.y0;
  d.dy = raw > 0 ? raw : raw / 6;                      // a little give upwards, then stops
  if (Math.abs(raw) < 4) return;
  d.sh.style.animation = 'none';
  d.sh.style.transition = 'none';
  d.sh.style.transform = 'translateY(' + d.dy + 'px)';
});
const endSheetDrag = e => {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  sheetDrag = null;
  const speed = d.dy / Math.max(1, performance.now() - d.t0);          // px per ms
  if (d.dy > 110 || (d.dy > 36 && speed > 0.55)) {
    d.sh.style.transition = 'transform .24s cubic-bezier(.4,0,1,1)';
    d.sh.style.transform = 'translateY(105%)';
    $('#sheet .scrim')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
    setTimeout(() => closeSheet(true), 240);
  } else if (d.dy) {
    d.sh.style.transition = 'transform .5s cubic-bezier(.2,1.3,.3,1)';   // springs back with a little overshoot
    d.sh.style.transform = '';
  }
};
document.addEventListener('pointerup', endSheetDrag);
document.addEventListener('pointercancel', endSheetDrag);

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
// quiet: keep the rows on screen while fetching, and swap them in when ready.
async function loadList({ force, quiet } = {}) {
  const spec = currentList(), have = state.lists[spec.key];
  if (have?.items && !force) return render();
  if (!(quiet && have?.items)) { state.lists[spec.key] = { items: null }; render(); }
  try {
    let labelIds = spec.labelIds;
    if (spec.bucket) {
      const l = await labelNamed(settings.label);
      if (!l) { state.lists[spec.key] = { items: [], next: null }; return render(); }
      labelIds = [l.id];
    }
    const r = await threadPage(spec.q, { labelIds });
    let items = (await hydrate(r.ids, r.hist)).sort((a, b) => b.date - a.date);
    if (spec.key === 'inbox') {                     // reminders that came back go first, as in Mail
      const rl = await labelNamed(REMINDED);
      if (rl) {
        const pr = await threadPage('', { labelIds: ['INBOX', rl.id] });
        const pinned = await hydrate(pr.ids, pr.hist);
        items = pinned.concat(items.filter(it => !pinned.some(p => p.id === it.id)));
      }
    }
    state.lists[spec.key] = { items, next: r.next, q: spec.q, labelIds, at: Date.now() };
  } catch (e) {
    if (e instanceof AuthError) return render();
    if (e instanceof QuotaError) {
      if (have?.items) state.lists[spec.key] = have;
      else state.lists[spec.key] = { items: null, error: 'Gmail asked the app to slow down. It will try again in a minute.' };
      toast('Gmail asked the app to slow down — trying again in a minute', { ms: 6000 });
      retryLater();
      if (quiet) quietOnce = true;
      return render();
    }
    state.lists[spec.key] = { items: null, error: e.message };
  }
  if (quiet) quietOnce = true;
  render();
  if (spec.key === 'inbox' && state.lists.inbox?.items?.length) hintSwipe();
  updateBadge();
}

// One retry once the pause is over, for whatever list is on screen then.
let retryTimer = null;
function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (!state.reading && state.view !== 'settings' && state.view !== 'rules') loadList({ force: true, quiet: true });
  }, Math.max(1000, slowUntil - Date.now()));
}

async function loadMore(btn) {
  const key = currentList().key, list = state.lists[key];
  if (!list?.next) return;
  btn.disabled = true;
  btn.innerHTML = ICON.spin;
  try {
    const r = await threadPage(list.q, { labelIds: list.labelIds, pageToken: list.next });
    const more = (await hydrate(r.ids, r.hist)).sort((a, b) => b.date - a.date);
    const seen = new Set(list.items.map(it => it.id));
    freshFrom = list.items.length;
    list.items.push(...more.filter(it => !seen.has(it.id)));
    list.next = r.next;
    quietOnce = true;
    render();
  } catch (e) {
    if (e instanceof QuotaError) toast('Gmail asked the app to slow down — try again in a minute', { ms: 6000 });
    else failed(e);
    btn.disabled = false; btn.textContent = 'Show more';
  }
}

async function loadRules({ force } = {}) {
  if (state.rules && !force) return render();
  state.rules = null; state.rulesError = null; render();
  if (!canFilter()) { state.rules = []; return render(); }
  try {
    const [labels, all] = await Promise.all([refreshLabels(true), refreshFilters(true)]);
    const got = await pool(labels.filter(l => l.type === 'user'), 5, l => api('/labels/' + l.id).catch(() => null));
    state.labelCounts = Object.fromEntries(got.filter(Boolean).map(l => [l.id, l.messagesTotal ?? null]));
    state.rules = all.filter(f => (f.action?.addLabelIds || []).some(id => labelsById.get(id)?.type === 'user'));
  } catch (e) {
    if (e instanceof AuthError) return render();
    state.rulesError = e.message;
  }
  render();
}

async function loadProfile() {
  try {
    const p = await api('/profile');
    state.me = p.emailAddress;
    ls.set(K.hint, p.emailAddress);          // names the account for silent renewal
    if (state.view !== 'settings') $('#sub').textContent = state.me;
  } catch {}
}

// Shows whatever the mailbox menu and search now point at.
function go({ force } = {}) {
  render();
  if (state.view === 'rules') loadRules({ force });
  else if (state.view !== 'settings') loadList({ force });
}

// ---------------------------------------------------------------------------
// Selecting
// ---------------------------------------------------------------------------
function rowsFor(ids) {
  return ids.map(id => screen.querySelector('li[data-id="' + CSS.escape(id) + '"]'));
}

function enterSelect(firstId) {
  closeRow();
  state.select = new Set(firstId ? [firstId] : []);
  if (firstId) rowsFor([firstId])[0]?.classList.add('sel');
  renderChrome();
}

function exitSelect() {
  if (!state.select) return;
  state.select = null;
  for (const li of screen.querySelectorAll('li.sel')) li.classList.remove('sel');
  renderChrome();
}

function toggleSelect(li) {
  const id = li.dataset.id, sel = state.select;
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  li.classList.toggle('sel', sel.has(id));
  renderChrome();
}

// Drag down (or up) the circles and every row the finger passes takes the
// first row's new state - all selected, or all cleared - as in Mail. Near the
// top or bottom of the screen the list scrolls on by itself.
let brush = null;
function rowAt(y) {
  const list = screen.querySelector('ul.list');
  if (!list) return null;
  const r = list.getBoundingClientRect();
  const bar = $('#selbar').getBoundingClientRect();         // over the bar at the bottom: the row just above it
  const el = document.elementFromPoint(r.left + 60, Math.max(4, Math.min((bar.top || innerHeight) - 4, y)));
  return el?.closest('#screen ul.list > li[data-id]') || null;
}
function paintTo(y) {
  const p = brush, li = rowAt(y);
  if (!p || !li) return;
  const all = [...screen.querySelectorAll('ul.list > li[data-id]')];
  const a = all.indexOf(p.last), b = all.indexOf(li);
  if (a < 0 || b < 0) return;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
    const row = all[i], id = row.dataset.id;
    if (p.on) state.select.add(id); else state.select.delete(id);
    row.classList.toggle('sel', p.on);
  }
  p.last = li;
  if (!p.frame) p.frame = requestAnimationFrame(() => { p.frame = 0; renderChrome(); });
}
function autoScroll() {
  const p = brush;
  if (!p || !p.started) return;
  const edge = 90, bottom = innerHeight - 110;          // the select bar sits at the bottom
  const v = p.y < edge ? -(edge - p.y) / 4 : p.y > bottom ? (p.y - bottom) / 4 : 0;
  if (v) { scrollBy(0, Math.max(-24, Math.min(24, v))); paintTo(p.y); }
  p.raf = requestAnimationFrame(autoScroll);
}
screen.addEventListener('pointerdown', e => {
  if (!state.select || e.button > 0) return;
  const check = e.target.closest('.check'), li = check?.closest('ul.list > li[data-id]');
  if (!li) return;
  brush = { id: e.pointerId, y0: e.clientY, y: e.clientY, first: li, last: li, started: false, on: true, raf: 0, frame: 0 };
  try { check.setPointerCapture(e.pointerId); } catch {}
});
screen.addEventListener('pointermove', e => {
  const p = brush;
  if (!p || e.pointerId !== p.id) return;
  p.y = e.clientY;
  if (!p.started) {
    if (Math.abs(e.clientY - p.y0) < 6) return;
    p.started = true;
    p.on = !state.select.has(p.first.dataset.id);        // the first row decides: select, or clear
    paintTo(p.y0);
    p.raf = requestAnimationFrame(autoScroll);
  }
  paintTo(e.clientY);
});
const endPaint = e => {
  const p = brush;
  if (!p || e.pointerId !== p.id) return;
  brush = null;
  cancelAnimationFrame(p.raf);
  if (p.started) {
    swallowClick = true;                                  // the lift is not a tap on the last row
    setTimeout(() => { swallowClick = false; }, 350);
    renderChrome();
  }
};
screen.addEventListener('pointerup', endPaint);
screen.addEventListener('pointercancel', endPaint);

function selectedItems() {
  const items = state.lists[currentList().key]?.items || [];
  return items.filter(it => state.select?.has(it.id));
}

// Conversations to the Trash, or archived (out of the inbox, kept in All
// Mail). The rows go at once and Gmail is told after. Undo brings each back,
// and returns to the inbox exactly the messages that were in it - not your own
// replies, which never were.
async function throwAway(items, how) {
  if (!items.length) return;
  const tids = [...new Set(items.map(it => it.threadId))];
  const rows = rowsFor(items.map(it => it.id));
  closeRow();
  if (state.select) exitSelect();
  await closeReader();
  await Promise.all(rows.map(li => vanish(li, 'left')));
  patch(it => tids.includes(it.threadId), how === 'trash' ? ['TRASH'] : [], ['INBOX']);
  for (const [k, l] of Object.entries(state.lists)) if (l.items) l.items = l.items.filter(it => belongs(k, it));
  quietOnce = true;
  render();
  const back = { tids, how, inboxMsgs: [] };
  let missed = 0;
  try {
    const snaps = await pool(tids, 6, id => api('/threads/' + id, { params: { format: 'minimal' } }).catch(() => null));
    back.inboxMsgs = snaps.filter(Boolean).flatMap(t => (t.messages || []).filter(m => (m.labelIds || []).includes('INBOX')).map(m => m.id));
    await pool(tids, 6, async id => {
      try {
        if (how === 'trash') await api('/threads/' + id + '/trash', { method: 'POST' });
        else await relabelThread(id, [], ['INBOX']);
      } catch (e) { if (e instanceof AuthError) throw e; missed++; }
    });
  } catch (err) { failed(err); state.lists = {}; return go({ force: true }); }
  const n = tids.length - missed, what = n === 1 ? '1 conversation' : n + ' conversations';
  if (missed) { toast(what + (how === 'trash' ? ' moved to the Trash' : ' archived') + '; ' + missed + ' couldn’t be', { bad: true }); state.lists = {}; return go({ force: true }); }
  for (const k of Object.keys(state.lists)) if (k !== currentList().key) delete state.lists[k];
  toast(how === 'trash' ? what + ' moved to the Trash' : what + ' archived', { label: 'Undo', action: () => bringBack(back) });
}

async function bringBack(back) {
  try {
    if (back.how === 'trash') await pool(back.tids, 6, id => api('/threads/' + id + '/untrash', { method: 'POST' }));
    await relabel(back.inboxMsgs, ['INBOX']);
    toast('Put back');
    state.lists = {};
    go({ force: true });
  } catch (err) { failed(err); }
}

const trashSelected = () => throwAway(selectedItems(), 'trash');
const archiveSelected = () => throwAway(selectedItems(), 'archive');

// Flag: Gmail's star. Toggles, like Mail's flag.
async function toggleFlag(item) {
  const on = !item.labelIds.includes('STARRED');
  try {
    await relabelThread(item.threadId, on ? ['STARRED'] : [], on ? [] : ['STARRED']);
    patch(it => it.threadId === item.threadId, on ? ['STARRED'] : [], on ? [] : ['STARRED']);
    if (!item.labelIds.includes('STARRED') === on) item.labelIds = on ? item.labelIds.concat('STARRED') : item.labelIds.filter(l => l !== 'STARRED');
    delete state.lists['tag:STARRED'];
    if (state.tag === 'STARRED' && !on) { await settle('left'); }
    else { quietOnce = true; render(); }
    if (state.reading) renderReaderBar();
    toast(on ? 'Flagged' : 'Flag removed');
  } catch (err) { failed(err); }
}

async function markSelected() {
  const items = selectedItems();
  if (!items.length) return;
  const read = items.some(it => it.unread);            // any unread: mark them all read
  const ids = items.map(it => it.threadId), set = new Set(ids);
  exitSelect();
  try {
    await pool(ids, 6, id => relabelThread(id, read ? [] : ['UNREAD'], read ? ['UNREAD'] : []));
    patch(it => set.has(it.threadId), read ? [] : ['UNREAD'], read ? ['UNREAD'] : []);
    quietOnce = true;
    render();
    toast(ids.length + ' marked as ' + (read ? 'read' : 'unread'));
  } catch (err) { failed(err); }
}

$('#edit').addEventListener('click', () => (state.select ? exitSelect() : enterSelect()));
$('#selall').addEventListener('click', () => {
  const items = state.lists[currentList().key]?.items || [];
  const all = items.every(it => state.select.has(it.id));
  state.select = new Set(all ? [] : items.map(it => it.id));
  for (const li of screen.querySelectorAll('ul.list > li[data-id]')) li.classList.toggle('sel', state.select.has(li.dataset.id));
  renderChrome();
});
$('#sel-trash').addEventListener('click', trashSelected);
$('#sel-archive').addEventListener('click', archiveSelected);
$('#sel-mark').addEventListener('click', markSelected);

// Press and hold a row to start selecting with it, as in Mail.
let press = null, swallowClick = false;
screen.addEventListener('pointerdown', e => {
  if (state.select || e.button > 0 || e.target.closest('.act')) return;
  const li = e.target.closest('ul.list > li[data-id]');
  if (!li) return;
  press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press = null; swallowClick = true; enterSelect(li.dataset.id); }, 480) };
});
const cancelPress = () => { if (press) { clearTimeout(press.t); press = null; } };
screen.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) screen.addEventListener(ev, () => {
  cancelPress();
  if (swallowClick) setTimeout(() => { swallowClick = false; }, 400);
});
addEventListener('scroll', cancelPress, { passive: true });
screen.addEventListener('contextmenu', e => { if (e.target.closest('ul.list > li')) e.preventDefault(); });

// ---------------------------------------------------------------------------
// Swipe right to tag
// ---------------------------------------------------------------------------
// As in Mail: drag a row right and Tag and Marketing show underneath. Let go
// part-way and the row stays open on them; drag past half-way and it tags at once.
// Rows scroll up and down as normal - touch-action: pan-y leaves vertical
// moves to the browser, and a mostly-vertical start is never taken as a swipe.
const SWIPE_OPEN = 160;         // right: room for Tag and Marketing
const SWIPE_OPEN_L = -228;      // left: room for Flag, Archive and Trash
let swipe = null, openRow = null;

function setSwipe(li, dx, animate) {
  const top = li.querySelector('.rowtop'), under = li.querySelector('.swipe'), right = li.querySelector('.swipe-r');
  if (!top || !under || !right) return;
  top.style.transition = under.style.transition = right.style.transition = animate ? '' : 'none';
  top.style.transform = dx ? 'translateX(' + dx + 'px)' : '';
  under.style.width = dx > 0 ? dx + 12 + 'px' : '';
  right.style.width = dx < 0 ? -dx + 12 + 'px' : '';
}

function closeRow(li = openRow) {
  if (!li) return;
  setSwipe(li, 0, true);
  li.classList.remove('swiped', 'swiped-l', 'armed', 'armed-l');
  if (openRow === li) openRow = null;
}

screen.addEventListener('pointerdown', e => {
  if (state.select || e.button > 0 || e.target.closest('.act, .swipe, .swipe-r')) return;
  const li = e.target.closest('ul.list > li[data-id]');
  if (!li) return;
  if (openRow && openRow !== li) closeRow();
  const base = li !== openRow ? 0 : li.classList.contains('swiped-l') ? SWIPE_OPEN_L : SWIPE_OPEN;
  swipe = { li, id: e.pointerId, x: e.clientX, y: e.clientY, base, dx: 0, lock: false };
});

screen.addEventListener('pointermove', e => {
  const sw = swipe;
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.lock) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }   // a scroll
    if (Math.abs(dx) < 8) return;
    sw.lock = true;
    cancelPress();                                                                // not a long press either
    try { sw.li.setPointerCapture(e.pointerId); } catch {}
  }
  const w = sw.li.offsetWidth, edge = w * 0.8;
  let x = sw.base + dx;
  if (x > edge) x = edge + (x - edge) * 0.25;                                   // resist near either edge
  if (x < -edge) x = -edge + (x + edge) * 0.25;
  sw.dx = x;
  setSwipe(sw.li, x, false);
  sw.li.classList.toggle('armed', x > w * 0.5);
  sw.li.classList.toggle('armed-l', x < -w * 0.55);                              // Trash fills the row, as in Mail
});

screen.addEventListener('pointerup', e => {
  const sw = swipe;
  if (!sw || e.pointerId !== sw.id) return;
  swipe = null;
  if (!sw.lock) return;
  swallowClick = true;                           // the release is not a tap
  setTimeout(() => { swallowClick = false; }, 350);
  const w = sw.li.offsetWidth;
  if (sw.dx > w * 0.5) {                         // right, all the way: tag now
    closeRow(sw.li);
    const it = findItem(sw.li.dataset.id);
    if (it) openSheet(it);
  } else if (sw.dx > 56) {                       // right, part way: stay open on Tag
    setSwipe(sw.li, SWIPE_OPEN, true);
    sw.li.classList.remove('armed');
    sw.li.classList.add('swiped');
    openRow = sw.li;
  } else if (sw.dx < -w * 0.55) {                // left, all the way: to the Trash
    const it = findItem(sw.li.dataset.id);
    if (it) throwAway([it], 'trash');
  } else if (sw.dx < -56) {                      // left, part way: stay open on Flag / Archive / Trash
    setSwipe(sw.li, SWIPE_OPEN_L, true);
    sw.li.classList.remove('armed-l');
    sw.li.classList.add('swiped-l');
    openRow = sw.li;
  } else closeRow(sw.li);
});

screen.addEventListener('pointercancel', e => {
  const sw = swipe;
  if (sw && e.pointerId === sw.id) { swipe = null; if (sw.lock) closeRow(sw.li); }
});
addEventListener('scroll', () => { if (openRow && !swipe) closeRow(); }, { passive: true });

// Shown once: the first row slides open by itself to show the gesture.
function hintSwipe() {
  if (ls.get(K.swipeHint, '') || state.view !== 'inbox' || state.search || state.select) return;
  const li = screen.querySelector('ul.list > li[data-id]');
  if (!li) return;
  ls.set(K.swipeHint, '1');
  if (!reduced) { li.classList.add('peek'); setTimeout(() => li.classList.remove('peek'), 2600); }
  setTimeout(() => toast('Tip: swipe an email right to tag it or send it to ' + settings.label, { ms: 5000 }), reduced ? 0 : 900);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

$('#search').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  $('#q').blur();
  if (!q) return clearSearch();
  state.search = q;
  screen.classList.remove('back');
  go({ force: true });
});
$('#q').addEventListener('input', () => $('#q-clear').classList.toggle('hide', !$('#q').value));
document.addEventListener('change', e => { if (e.target.id === 'c-pick') addComposeFiles(e.target); });
$('#q-clear').addEventListener('click', () => { clearSearch(); $('#q').focus(); });

function clearSearch(reload = true) {
  $('#q').value = '';
  $('#q-clear').classList.add('hide');
  if (!state.search) return;
  state.search = '';
  if (reload) go();
}

// Fetches what's on screen afresh (pull to refresh).
async function refresh() {
  await dueReminders().catch(() => 0);
  labelsPromise = null;
  refreshLabels().then(() => render()).catch(() => {});
  if (state.view === 'rules') await loadRules({ force: true });
  else await loadList({ force: true, quiet: true });
}

// Search stays out of the way until you want it: the magnifier, or a pull down.
$('#find').addEventListener('click', () => { state.showSearch = true; renderChrome(); $('#q').focus(); });
$('#q').addEventListener('blur', () => setTimeout(() => {
  if (!$('#q').value && !state.search && document.activeElement !== $('#q')) { state.showSearch = false; renderChrome(); }
}, 200));

// The header stays at the top; once the list moves under it, it turns compact.
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 8), { passive: true });

// Pull to refresh, as in Mail: pull the list down from the top and let go. A
// short pull shows the search bar; a longer one also fetches the list afresh.
const PULL_SEARCH = 28, PULL_REFRESH = 70;
let pull = null;
const pullable = t => !state.select && !state.reading && !state.compose && !state.sheet && getToken() &&
  state.view !== 'settings' && !boxMenuOpen() && !t.closest('#boxmenu, input, textarea, #sheet, #reader, #compose, #selbar, #toast');
function pullStart(y, t) {
  if (scrollY > 0 || !pullable(t)) return;
  pull = { y0: y, d: 0, on: false };
}
function pullMove(y, e) {
  if (!pull) return;
  if (swipe?.lock) { pull = null; return; }                   // a row is being swiped sideways
  const dy = y - pull.y0;
  if (!pull.on) {
    if (dy < -4) { pull = null; return; }
    if (dy < 10) return;
    pull.on = true;
    if (typeof cancelPress === 'function') cancelPress();
    document.querySelector('main').classList.add('pulling');
  }
  if (e?.cancelable) e.preventDefault();                      // the page doesn't bounce as well
  pull.d = Math.min(130, (dy - 10) * 0.5);                    // rubber band
  document.querySelector('main').style.transform = 'translateY(' + pull.d + 'px)';
  const k = Math.min(1, pull.d / PULL_REFRESH), ptr = $('#ptr');
  ptr.style.opacity = k;
  ptr.style.transform = 'scale(' + (0.6 + 0.4 * k) + ') rotate(' + Math.round(k * 300) + 'deg)';
  ptr.classList.toggle('ready', pull.d >= PULL_REFRESH);
}
async function pullEnd() {
  const p = pull;
  pull = null;
  if (!p?.on) return;
  swallowClick = true;                                        // letting go is not a tap
  setTimeout(() => { swallowClick = false; }, 350);
  const m = document.querySelector('main'), ptr = $('#ptr');
  m.classList.remove('pulling');
  if (p.d >= PULL_SEARCH && !state.showSearch) { state.showSearch = true; renderChrome(); }
  if (p.d >= PULL_REFRESH) {
    m.style.transform = 'translateY(56px)';
    ptr.classList.add('spin'); ptr.style.opacity = 1; ptr.style.transform = 'scale(1)';
    try { await refresh(); } catch {}
    ptr.classList.remove('spin', 'ready');
  }
  m.style.transform = ''; ptr.style.opacity = ''; ptr.style.transform = '';
}
addEventListener('touchstart', e => { if (e.touches.length === 1) pullStart(e.touches[0].clientY, e.target); }, { passive: true });
addEventListener('touchmove', e => { if (pull && e.touches.length === 1) pullMove(e.touches[0].clientY, e); }, { passive: false });
addEventListener('touchend', pullEnd);
addEventListener('touchcancel', pullEnd);
// the same by mouse, for a desktop browser (and the tests)
addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) pullStart(e.clientY, e.target); });
addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && pull) pullMove(e.clientY, null); });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') pullEnd(); });

$('#gear').addEventListener('click', () => {
  state.view = state.view === 'settings' ? 'inbox' : 'settings';
  go();
});

function findItem(id) {
  if (state.reading?.item.id === id) return state.reading.item;
  for (const list of Object.values(state.lists)) {
    const it = (list.items || []).find(x => x.id === id);
    if (it) return it;
  }
  return null;
}

async function doBucket(item, btn, li) {
  if (btn) { btn.disabled = true; confirmTap(btn, li, 'tag'); btn.innerHTML = ICON.spin; }
  try {
    const back = await bucket(item);
    await closeReader();
    patch(it => it.threadId === back.threadId || covers(back.rule, it), [back.label], ['INBOX']);
    await settle('right');
    const who = back.rule.kind === 'domain' ? 'Everything from ' + back.rule.label : back.rule.label;
    toast(who + ' → ' + settings.label + ' · filing their older mail…', { ms: 60000 });
    finish(back, n => who + ' → ' + settings.label + (n > 1 ? ' · ' + n + ' messages' : ''));
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = ICON.mkt; }
    if (state.reading) renderReader();
    failed(err);
  }
}

async function doRestore(item, btn, li) {
  if (btn) { btn.disabled = true; confirmTap(btn, li, 'blue'); btn.innerHTML = ICON.spin; }
  try {
    const labelId = await unbucket(item);
    await closeReader();
    patch(it => it.threadId === item.threadId, ['INBOX'], [labelId]);
    await settle('left');
    toast('Back in the inbox. The rule is still on — remove it under Rules.');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = ICON.back; }
    if (state.reading) renderReader();
    failed(err);
  }
}

async function undo(back) {
  try {
    toast('Putting it back…', { ms: 60000 });
    await back.done?.catch(() => {});
    await undoRule(back);
    toast('Put back');
    state.lists = {};
    go({ force: true });
    // An open message shows its tags: read them back from Gmail.
    const r = state.reading;
    if (r) {
      const t = await api('/threads/' + r.item.threadId, { params: { format: 'minimal' } });
      r.item.labelIds = [...new Set((t.messages || []).filter(m => !(m.labelIds || []).includes('TRASH')).flatMap(m => m.labelIds || []))];
      const box = $('#rtags');
      if (box && state.reading === r) box.innerHTML = tagChips(r.item.labelIds);
    }
  } catch (err) { failed(err); }
}

document.addEventListener('click', async e => {
  if (swallowClick) { swallowClick = false; e.preventDefault(); return; }   // the release after a long press or swipe
  // A row left open on Tag closes on any tap outside its button, as in Mail.
  if (openRow && !e.target.closest('.swipe, .swipe-r')) { closeRow(); e.preventDefault(); return; }
  if (state.select) {
    const row = e.target.closest('#screen ul.list > li[data-id]');
    if (row) { e.preventDefault(); return toggleSelect(row); }
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const li = el.closest('li');
  if (act !== 'box-menu' && el.closest('#boxmenu')) closeBoxMenu();

  switch (act) {
    case 'save-cid': {
      const v = cleanClientId($('#cid').value);
      const problem = clientIdProblem(v);
      if (problem) return toast(problem, { bad: true, ms: 9000 });
      ls.set(K.clientId, v);
      return signIn();
    }
    case 'forget-cid': ls.del(K.clientId); return render();
    case 'signin': return signIn();
    case 'signin-pick': return signIn({ chooseAccount: true });
    case 'signout': state.view = 'inbox'; state.lists = {}; return signOut();

    case 'save-settings': {
      const d = Math.max(1, Math.min(30, parseInt($('#days').value, 10) || 3));
      const name = ($('#lab').value || 'Marketing').trim();
      const changed = name !== settings.label;
      settings.days = d; settings.label = name;
      if (changed) { labelsPromise = null; state.lists = {}; state.rules = null; }
      toast('Saved');
      state.view = 'inbox';
      return go({ force: changed });
    }

    case 'open': {
      e.stopPropagation();
      const box = state.me ? encodeURIComponent(state.me) : '0';
      return window.open('https://mail.google.com/mail/u/' + box + '/#all/' + el.dataset.thread, '_blank', 'noopener');
    }

    case 'read': { const it = findItem(li.dataset.id); if (it) openReader(it); return; }
    case 'close-reader': return closeReader();
    case 'show-images': if (state.reading) { state.reading.images = true; renderReaderBody(); } return;
    case 'toggle-msg': return toggleMsg(el.dataset.msg);

    case 'bucket': { const it = findItem(li.dataset.id); if (it) doBucket(it, el, li); return; }
    case 'restore': { const it = findItem(li.dataset.id); if (it) doRestore(it, el, li); return; }
    case 'bucket-reader': if (state.reading) { el.disabled = true; el.innerHTML = ICON.spin + esc(settings.label); doBucket(state.reading.item); } return;
    case 'restore-reader': if (state.reading) { el.disabled = true; el.innerHTML = ICON.spin + 'Inbox'; doRestore(state.reading.item); } return;

    case 'tag-open': if (state.reading) openSheet(state.reading.item); return;
    case 'row-flag': case 'row-archive': case 'row-trash': {
      const it = findItem(li.dataset.id);
      if (!it) return;
      if (act === 'row-flag') { closeRow(li); return toggleFlag(it); }
      return throwAway([it], act === 'row-trash' ? 'trash' : 'archive');
    }
    case 'reader-trash': if (state.reading) throwAway([state.reading.item], 'trash'); return;
    case 'reader-reply': {
      const r = state.reading;
      if (!r?.msgs?.length) return;
      const pick = await choiceSheet({ title: r.item.subject, options: [
        { id: 'reply', label: 'Reply', primary: true }, { id: 'all', label: 'Reply All' }, { id: 'fwd', label: 'Forward' }] });
      if (pick) openCompose(draftFrom(pick, r));
      return;
    }
    case 'compose-new': return openCompose({ mode: 'new' });
    case 'compose-send': return sendCompose();
    case 'compose-attach': return $('#c-pick')?.click();
    case 'compose-unfile': {
      const c = state.compose;
      if (c) { c.files.splice(Number(el.dataset.i), 1); renderComposeFiles(); }
      return;
    }
    case 'open-file': return openFile(el.dataset.msg, Number(el.dataset.i));
    case 'reader-more': return readerMore();
    case 'block-sender': closeSheet(); return doBlock(el.dataset.email);
    case 'unblock': return unblock(el.dataset.id);
    case 'unsub': { const m = state.reading?.msgs?.find(x => x.id === el.dataset.msg); if (m?.unsub) unsubSheet(m); return; }
    case 'unsub-go': { const m = state.sheet?.unsub; if (m) unsubscribe(m); return; }
    case 'unsub-web': {           // the link itself opens the page; this just remembers
      const m = state.sheet?.unsub;
      if (m) { markUnsubbed(m.unsub.email); closeSheet(); if (state.reading) renderReaderBody(); }
      return;
    }
    case 'file-share': return shareFile();
    case 'compose-cancel': return cancelCompose();
    case 'choice': {
      const done = confirmDone;
      confirmDone = null;
      closeSheet();
      if (done) done(el.dataset.id);
      return;
    }
    case 'reader-archive': if (state.reading) throwAway([state.reading.item], 'archive'); return;
    case 'reader-flag': if (state.reading) toggleFlag(state.reading.item); return;
    case 'swipe-tag': {
      const it = findItem(li.dataset.id);
      closeRow(li);
      if (it) openSheet(it);
      return;
    }
    case 'confirm-yes': {
      const done = confirmDone;
      confirmDone = null;
      closeSheet();
      if (done) done(true);
      return;
    }

    case 'chip-pref': {
      const id = el.dataset.id, on = chipTags().some(l => l.id === id);
      setChipPref(id, !on);
          quietOnce = true;
      render();
      toast(on ? 'Hidden from the mailbox menu' : 'Shown in the mailbox menu');
      return;
    }
    case 'del-label': {
      const l = labelsById.get(el.dataset.id);
      if (!l) return;
      const n = state.labelCounts?.[l.id];
      const yes = await confirmSheet({
        title: 'Delete “' + l.name + '”?',
        body: (n ? 'The label comes off ' + n.toLocaleString() + ' email' + (n === 1 ? '' : 's') : 'No emails have this label') +
          ', and any rules for it stop. The emails themselves stay in your mailbox. This can’t be undone.',
        yes: 'Delete',
      });
      if (!yes) return;
      try {
        if (li) await vanish(li, 'crumble');
        await removeLabels([l]);
        toast('“' + l.name + '” deleted');
        await loadRules({ force: true });
      } catch (err) { failed(err); loadRules({ force: true }); }
      return;
    }
    case 'del-leftovers': {
      const list = userLabels().filter(l => leftover(l) && !leftover(l).keep && !chipTags().some(c => c.id === l.id));
      if (!list.length) return;
      const yes = await confirmSheet({
        title: 'Delete ' + list.length + ' old labels?',
        body: list.map(l => '<span class="chip">' + esc(l.name) + '</span>').join(' ') +
          '<br><br>They come off any emails that have them; the emails stay. Notes and Unroll.me are left alone. This can’t be undone.',
        yes: 'Delete ' + list.length + ' labels',
      });
      if (!yes) return;
      try {
        const rows = list.map(l => screen.querySelector('li[data-label="' + CSS.escape(l.id) + '"]'));
        await Promise.all(rows.map((r, i) => new Promise(ok => setTimeout(() => vanish(r, 'crumble').then(ok), i * 60))));
        await removeLabels(list);
        toast(list.length + ' old labels deleted');
        await loadRules({ force: true });
      } catch (err) { failed(err); loadRules({ force: true }); }
      return;
    }
    case 'sheet-close': return closeSheet();
    case 'pick-tag':
      $('#newtag').value = el.dataset.name;
      for (const b of $('#sheet').querySelectorAll('.chip2')) b.classList.toggle('on', b === el);
      return;
    case 'apply-tag': {
      const sheet = state.sheet;
      if (!sheet) return;
      const name = $('#newtag').value.trim();
      if (!name) return toast('Pick a tag, or type a new one', { bad: true });
      if (name.toLowerCase() === settings.label.toLowerCase()) { closeSheet(); return doBucket(sheet.item); }
      el.disabled = true;
      el.innerHTML = ICON.spin + 'Tagging…';
      const slow = setTimeout(() => { if (el.isConnected) el.innerHTML = ICON.spin + 'Still working — slow connection…'; }, 8000);
      try {
        const back = await tagSender(sheet.item, name);
        clearTimeout(slow);
        closeSheet();
        patch(it => it.threadId === back.threadId || covers(back.rule, it), [back.label], []);
        if (state.reading) {
          const it = state.reading.item;
          it.labelIds = [...new Set(it.labelIds.concat(back.label))];
          const box = $('#rtags');
          if (box) { box.innerHTML = tagChips(it.labelIds); box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
        }
        await settle('right');
        const who = back.rule.kind === 'domain' ? 'Everything from ' + back.rule.label : back.rule.label;
        toast('Tagged “' + back.labelName + '” · adding it to their older mail…', { ms: 60000 });
        finish(back, n => who + ' tagged “' + back.labelName + '”' + (n > 1 ? ' · ' + n + ' messages' : ''));
      } catch (err) {
        clearTimeout(slow);
        el.disabled = false;
        el.innerHTML = ICON.label + 'Tag';
        failed(err);
      }
      return;
    }

    case 'badge': return toggleBadge();
    case 'box-menu': return boxMenuOpen() ? closeBoxMenu() : openBoxMenu();
    case 'box-close': return closeBoxMenu();
    case 'box-view': {
      const order = ['inbox', 'marketing', 'rules'];
      screen.classList.toggle('back', order.indexOf(el.dataset.view) < order.indexOf(state.view));
      state.tag = null;
      state.view = el.dataset.view;
      clearSearch(false);
      return go();
    }
    case 'chip':
      state.tag = el.dataset.id || null;
      state.view = 'inbox';
      clearSearch(false);
      screen.classList.remove('back');
      return go();
    case 'more': return loadMore(el);

    case 'sweep': {
      if (state.busy) return;
      state.busy = true;
      const card = screen.querySelector('.card');
      if (card && !reduced) { card.classList.add('flushing'); setTimeout(() => card.classList.remove('flushing'), 1100); }
      toast('Cleaning up…');
      try {
        const n = await sweep();
        toast(n ? n + ' moved to the Trash' : 'Nothing old enough yet');
        delete state.lists.mkt;
        if (state.view === 'marketing') loadList({ force: true });
        $('#foot').innerHTML = footHTML();
      } catch (err) { failed(err); }
      state.busy = false;
      return;
    }

    case 'del-rule': {
      const id = li.dataset.filter;
      el.disabled = true;
      confirmTap(el, li, 'tag');
      try {
        await api('/settings/filters/' + id, { method: 'DELETE' });
        if (filtersCache) filtersCache = filtersCache.filter(f => f.id !== id);
        await vanish(li, 'crumble');
        state.rules = state.rules.filter(f => f.id !== id);
        quietOnce = true;
        render();
              toast('Rule deleted. Mail already tagged keeps its tag.');
      } catch (err) { el.disabled = false; failed(err); }
      return;
    }

    case 'add-rule': {
      const rule = ruleFromText($('#rule-from').value);
      const name = $('#rule-tag').value.trim();
      if (rule.error) return toast(rule.error, { bad: true, ms: 9000 });
      if (!name) return toast('Name the tag — e.g. Sofia’s school', { bad: true });
      el.disabled = true;
      el.innerHTML = ICON.spin;
      try {
        const bucketing = name.toLowerCase() === settings.label.toLowerCase();
        const back = await applyRule(rule, name, { skipInbox: bucketing });
        state.lists = {};
              toast('Tag added: ' + rule.label + ' → ' + back.labelName + ' · tagging their older mail…', { ms: 60000 });
        await loadRules({ force: true });
        finish(back, () => 'Tag added: ' + rule.label + ' → ' + back.labelName + (back.added.length ? ' · ' + back.added.length + ' messages' : ''),
          () => { if (state.view === 'rules') loadRules({ force: true }); });
      } catch (err) {
        el.disabled = false;
        el.textContent = 'Add rule';
        failed(err);
      }
      return;
    }
  }
});

// Sends a row off the way its action points: filed mail leaves to the right,
// mail coming back to the inbox to the left, a deleted rule crumbles in place.
function vanish(li, dir = 'right') {
  if (!li || reduced) return Promise.resolve();
  li.style.height = li.offsetHeight + 'px';
  void li.offsetHeight;                       // commit the height, then collapse
  li.classList.add('going', dir);
  return new Promise(r => setTimeout(r, 300));
}

// A tap is answered before the network is: the button stamps and a light
// runs across the row while Gmail is still being asked.
function confirmTap(btn, li, tone) {
  if (reduced || !btn || !li) return;
  btn.classList.add('stamping');
  li.classList.add('confirm');
  if (tone === 'blue') li.classList.add('blue');
  setTimeout(() => { btn.classList.remove('stamping'); li.classList.remove('confirm', 'blue'); }, 820);
}

// The iPhone's back swipe (and Safari's back button) closes the message page.
addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  closeSheet();
  if (state.reading) closeReader(true);
});

addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (boxMenuOpen()) closeBoxMenu();
  else if (state.compose && !state.sheet) cancelCompose();
  else if (state.select) exitSelect();
  else if (state.sheet) closeSheet();
  else if (state.reading) closeReader();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
// Renews an expired sign-in without a screen, once a grant exists. Only one
// automatic attempt a minute, so an answer of "can't" never turns into a loop.
function renew() {
  const sinceTry = Date.now() - Number(ls.get(K.lastAuth, 0));
  if (!state.error && !state.notice && sinceTry > 60e3 && ls.get(K.token + '.ever', '')) signIn({ silent: true });
}

(function boot() {
  const back = consumeRedirect();
  if (back?.error) {
    // A silent renewal Google couldn't finish just needs one tap, not a warning.
    if (back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error)) state.notice = true;
    else state.error = back.error === 'access_denied' ? 'Access was declined.'
      : back.error === 'state_mismatch' ? 'Sign-in could not be verified. Try again.'
      : 'Google said: ' + back.error;
  }
  render();

  if (clientId() && !getToken()) { renew(); return; }
  if (!getToken()) return;
  ls.set(K.token + '.ever', '1');

  loadProfile();
  try {
    const waiting = JSON.parse(ls.get(K.pending, 'null'));
    if (waiting) { ls.del(K.pending); openCompose(waiting, { note: 'This message wasn’t sent — the app closed while it was waiting. Check it and send again.' }); }
  } catch { ls.del(K.pending); }
  Promise.all([refreshLabels(), refreshFilters()]).then(() => { render(); bringBackReminders(); }).catch(() => {});
  loadList();
  if (Date.now() - Number(ls.get(K.swept, 0)) > SWEEP_EVERY) {
    sweep().then(n => {
      if (!n) return;
      toast(n + ' old ' + settings.label + ' messages moved to the Trash');
      delete state.lists.mkt;
      $('#foot').innerHTML = footHTML();
    }).catch(() => {});
  }
})();

// The glow under a pressed button starts where the finger landed.
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn');
  if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--x', (e.clientX - r.left) + 'px');
  b.style.setProperty('--y', (e.clientY - r.top) + 'px');
}, { passive: true });

addEventListener('resize', () => closeBoxMenu(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (clientId() && !getToken()) return renew();         // back after the hour ran out
  if (state.reading || state.select || slowed()) return;
  const list = state.lists[currentList().key];
  if (list?.at && Date.now() - list.at < 30000) return;                 // loaded moments ago
  if (state.view === 'inbox' || state.view === 'marketing') loadList({ force: true, quiet: true });
});

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
