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
  hint: 'mail.hint', silent: 'mail.silent', chips: 'mail.chips', swipeHint: 'mail.swipeHint', pending: 'mail.pending', unsubbed: 'mail.unsubbed', badge: 'mail.badge', notify: 'mail.notify', pushUrl: 'mail.pushUrl', pushSynced: 'mail.pushSynced', openThread: 'mail.openThread', tidy: 'mail.tidy', tidied: 'mail.tidied', tidyKeep: 'mail.tidyKeep',
  daysMonthly: 'mail.daysMonthly', mktSort: 'mail.mktSort', mktSorted: 'mail.mktSorted',
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
  get days() { const n = parseInt(ls.get(K.days, '30'), 10); return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 30; },
  set days(v) { ls.set(K.days, String(v)); },
  get label() { return ls.get(K.label, 'Marketing') || 'Marketing'; },
  set label(v) { ls.set(K.label, v); },
};
// Marketing used to be emptied after 3 days; it is now a month, since mail is
// sorted into it automatically. Once, on this device: the old setting moves on.
if (!ls.get(K.daysMonthly, '')) { ls.set(K.days, '30'); ls.set(K.daysMonthly, '1'); }

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
  const tid = tidyId();
  if (tid && item.labelIds.includes(tid)) {                 // tidied, not bucketed: just back to the inbox
    await relabelThread(item.threadId, ['INBOX'], [tid]);
    return tid;
  }
  const label = await bucketLabel();
  await relabelThread(item.threadId, ['INBOX'], [label.id]);
  return label.id;
}
const tidied = item => { const tid = tidyId(); return !!tid && item.labelIds.includes(tid) && !item.labelIds.includes('INBOX'); };

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
    const tagged = PRESETS.filter(p => labelByName(p.name)).map(p => ' -label:' + p.name).join('');   // an auto-tag's mail is never cleaned up
    const ids = await allIds('older_than:' + settings.days + 'd' + tagged, { labelIds: [label.id], cap: 1000 });
    const call = pacer({ maxWaits: 1 });          // paced, like Tidy: a big bucket mustn't use up Gmail's allowance
    for (const id of ids) {
      try { await call('/messages/' + id + '/trash', { method: 'POST' }); done++; } catch (e) { if (e instanceof QuotaError || e instanceof AuthError) break; }
    }
  }
  ls.set(K.swept, String(Date.now()));
  return done;
}

// ---------------------------------------------------------------------------
// Auto-tags: ready-made tags that Gmail itself puts on mail the moment it
// arrives, through a filter - so it happens with the app closed too, and other
// apps can rely on it (the Travel app reads the "Travel" label). Each is a Gmail
// search: the senders that send that kind of mail, narrowed by subject where a
// sender also sends offers. Tagged mail stays in the inbox; Tidy never touches
// it (its search skips anything tagged), nor does the Marketing clean-up.
// In a Gmail search {a b} means a OR b, and (a b) means a AND b.
// ---------------------------------------------------------------------------
const any = list => '(' + list.join(' OR ') + ')';
const PRESETS = [
  { name: 'Travel', about: 'Flights, hotels, rentals, rides', query: [
    'from:' + any(['flyfrontier.com', 'aa.com', 'jetblue.com', 'delta.com', 'united.com', 'southwest.com', 'aircanada.com', 'alaskaair.com',
      'spirit.com', 'britishairways.com', 'marriott.com', 'res-marriott.com', 'hilton.com', 'hyatt.com', 'ihg.com', 'airbnb.com', 'booking.com',
      'expedia.com', 'hotels.com', 'vrbo.com', 'hopper.com', 'nationalcar.com', 'enterprise.com', 'hertz.com', 'avis.com', 'alamo.com',
      'uber.com', 'lyftmail.com', 'lyft.com', 'amtrak.com', 'cbp.dhs.gov', 'tsa.gov']),
    'subject:' + any(['confirmation', 'confirmed', 'itinerary', 'booking', 'reservation', '"check in"', '"check-in"', 'boarding', 'gate',
      'delayed', 'canceled', 'cancelled', 'flight', 'trip', 'stay', 'rental', 'ride', 'receipt', 'departure', '"e-ticket"']),
    '-from:' + any(['marketing.lyftmail.com', 'discover@airbnb.com', 'mkt.flyfrontier.com', 'marriott-vacations.com']),
    '-subject:' + any(['deal', 'deals', 'sale', 'save', 'savings', 'offer', 'offers', 'off', 'miles', 'mileageplus']),
  ].join(' ') },
  // Everything from a bank, card issuer, lender or broker is Money, their
  // offers included, so none of it is ever sorted out as marketing. Bills
  // from the town, utilities and insurers only when the subject says so.
  { name: 'Money', about: 'Banks, statements, bills', query: [
    '{from:' + any(['chase.com', 'citi.com', 'citibank.com', 'americanexpress.com', 'aexp.com', 'amex.com', 'bankofamerica.com', 'capitalone.com',
      'discover.com', 'wellsfargo.com', 'usbank.com', 'pnc.com', 'truist.com', 'ally.com', 'sofi.com', 'chime.com', 'synchrony.com',
      'synchronybank.com', 'mysynchrony.com', 'goldmansachs.com', 'marcus.com', 'schwab.com', 'fidelity.com', 'vanguard.com', 'etrade.com',
      'robinhood.com', 'paypal.com', 'venmo.com', 'troweprice.com', 'pennymac.com', 'pnmac.com', 'rocketmortgage.com', 'mrcooper.com',
      'greensky.com', 'greenskycredit.com', 'affirm.com', 'klarna.com', 'afterpay.com', 'navyfederal.org', 'penfed.org', 'usaa.com',
      'email.monarch.com']),
    '(from:' + any(['apexnc.org', 'enbridgegas.com', 'dominionenergy.com', 'duke-energy.com', 'gfiber.com', 'ncfbins.com', 'geico.com',
      'statefarm.com', 'progressive.com', 'allstate.com', 'irs.gov']),
    'subject:' + any(['statement', 'autopay', 'bill', 'payment', 'deposit', '"tax document"', '1099', 'transaction', 'purchase',
      '"account information"']),
    '-subject:' + any(['offer', 'offers', 'deal', 'deals', 'save', 'rebate', 'rebates']) + ')}',
  ].join(' ') },
  { name: 'Health', about: 'Visits, results, prescriptions', query: [
    '{from:' + any(['mychart', 'myuncchart', 'unchealth.unc.edu', 'labcorp.com', 'questdiagnostics.com', 'dukehealth.org', 'wakemed.org',
      'eclinicalmail.com', 'includedhealth.com', 'letsgetchecked.com']),
    '(from:' + any(['uhc.com', 'unitedhealthcare.com', 'cvs.com', 'walgreens.com', 'optum.com', 'bcbsnc.com', 'goodrx.com']),
    'subject:' + any(['prescription', 'pharmacy', 'appointment', 'results', 'claim', '"health statement"', '"explanation of benefits"',
      '"care team"', 'minuteclinic', 'visit', 'refill', 'pickup', 'coverage']) + ')}',
    '-subject:' + any(['sale', 'deals', 'offer', 'off', 'coupon', 'coupons', 'save', 'savings', 'store']),
  ].join(' ') },
  { name: 'Orders', about: 'Orders, receipts, deliveries', query: [
    'subject:' + any(['"your order"', '"order confirmation"', '"order confirmed"', '"order received"', '"order number"', '"order with"',
      '"has shipped"', '"have shipped"', '"out for delivery"', '"was delivered"', '"been delivered"', '"your receipt"', '"your purchase"',
      '"thanks for your order"', '"thank you for your order"', '"ready for pickup"', '"your invoice"']),
    '-from:' + any(['newsletter', 'newsletters', 'parentsquare.com', 'robinhood.com', 'ncfbins.com', 'eclinicalmail.com', 'letsgetchecked.com',
      'includedhealth.com', 'nationalcar.com', 'enterprise.com', 'lyftmail.com']),
    '-subject:' + any(['sale', 'deals', 'offer', 'off']),
  ].join(' ') },
];
const PRESET_CAP = 2000;              // older mail tagged when one is turned on (newest first)
const labelByName = name => [...labelsById.values()].find(l => l.name.toLowerCase() === name.toLowerCase()) || null;

// The filter that is this auto-tag: one that adds its label by a search
// rather than by sender (the app's own tags are all by sender).
function presetFilter(p) {
  const l = labelByName(p.name);
  return (l && (filtersCache || []).find(f => f.criteria?.query && !f.criteria.from && (f.action?.addLabelIds || []).includes(l.id))) || null;
}
const presetOfFilter = f => PRESETS.find(p => presetFilter(p)?.id === f.id) || null;

// Turns one on: the label, the filter for new mail, then the mail already
// here - and anything of it Tidy archived goes back to the inbox. Returns what
// Undo needs.
async function presetOn(p) {
  const label = await labelNamed(p.name, { create: true });
  const back = { name: p.name, label: label.id, filterId: null, added: [], rescued: [], tidy: tidyId() };
  const ours = f => f.criteria?.query && !f.criteria.from && (f.action?.addLabelIds || []).includes(label.id);
  if (!(await refreshFilters(true)).some(ours)) {
    try {
      const made = await api('/settings/filters', {
        method: 'POST', once: true, body: { criteria: { query: p.query }, action: { addLabelIds: [label.id] } },
      });
      filtersCache.push(made);
      back.filterId = made.id;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      const now = (await refreshFilters(true)).find(ours);   // made after all?
      if (!now) throw e;
      back.filterId = now.id;
    }
  }
  Object.assign(back, await presetBackfill(p, label.id));
  state.lists = {};
  return back;
}

// The mail already here that the rule matches gets the tag (newest first, up
// to PRESET_CAP), and any of it Tidy had archived goes back to the inbox.
async function presetBackfill(p, labelId) {
  const tidy = tidyId();
  const [all, had] = await Promise.all([allIds(p.query, { cap: PRESET_CAP }), allIds(p.query, { labelIds: [labelId], cap: PRESET_CAP })]);
  const hadSet = new Set(had);
  const added = all.filter(id => !hadSet.has(id));
  await relabel(added, [labelId]);
  let rescued = [];
  if (tidy) {
    rescued = await allIds(p.query, { labelIds: [tidy], cap: PRESET_CAP });
    await relabel(rescued, ['INBOX'], [tidy]);
  }
  return { added, rescued };
}

async function presetUndo(back) {
  if (back.filterId) {
    await api('/settings/filters/' + back.filterId, { method: 'DELETE' });
    if (filtersCache) filtersCache = filtersCache.filter(f => f.id !== back.filterId);
  }
  await relabel(back.added, [], [back.label]);
  await relabel(back.rescued, [back.tidy], ['INBOX']);
  state.lists = {};
}

// When an update refines a rule, the filter Gmail has is swapped for the new
// one as the app opens, so new mail follows it without turning the tag off and
// on. Mail the new rule matches is tagged too; mail already tagged keeps its tag. If a swap stopped half-way, the next
// run finishes it: one filter with today's rule stays, any others go.
async function upgradePresets() {
  if (!canFilter()) return 0;
  let n = 0;
  for (const p of PRESETS) {
    const l = labelByName(p.name);
    const ours = l ? (filtersCache || []).filter(f => f.criteria?.query && !f.criteria.from && (f.action?.addLabelIds || []).includes(l.id)) : [];
    if (!ours.length || (ours.length === 1 && ours[0].criteria.query === p.query)) continue;
    let keep = ours.find(f => f.criteria.query === p.query);
    if (!keep) {
      keep = await api('/settings/filters', { method: 'POST', once: true, body: { criteria: { query: p.query }, action: { addLabelIds: [l.id] } } });
      filtersCache.push(keep);
    }
    for (const f of ours.filter(f => f !== keep)) {
      await api('/settings/filters/' + f.id, { method: 'DELETE' });
      filtersCache = filtersCache.filter(x => x.id !== f.id);
    }
    await presetBackfill(p, l.id);              // a wider rule: what it now matches is tagged too
    n++;
  }
  return n;
}

// Off stops the tagging of new mail; what is tagged keeps its tag.
async function presetOff(p) {
  const f = presetFilter(p);
  if (!f) return;
  await api('/settings/filters/' + f.id, { method: 'DELETE' });
  filtersCache = filtersCache.filter(x => x.id !== f.id);
}

const presetBusy = new Set();
function autoTagsHTML() {
  const counts = state.labelCounts || {};
  return '<div class="card"><h2>Auto-tags</h2>' +
    '<p class="cnote">Gmail tags these the moment mail arrives, even with the app closed. They stay in your inbox, and Tidy never touches them. Tap one to see what it tags.</p>' +
    '<ul class="list">' + PRESETS.map(p => {
      const on = !!presetFilter(p), busy = presetBusy.has(p.name), n = counts[labelByName(p.name)?.id];
      const line = esc(p.about) + (on && n ? ' · ' + n.toLocaleString() : '');
      return '<li data-preset="' + esc(p.name) + '"><div class="rowtop"><span class="open" data-act="preset-see" role="button" tabindex="0" aria-label="' +
        esc((on ? 'Show ' : 'Preview ') + p.name) + '"><span class="who">' +
        '<span class="tchip" style="--h:' + hue(p.name) + '">' + esc(p.name) + '</span></span><span class="snip">' + line + '</span></span>' +
        '<span class="gtools"><button class="switch' + (busy ? ' busy' : '') + '" role="switch" data-act="preset-toggle" aria-checked="' + on + '" aria-label="' + esc(p.name) + ' auto-tag"' +
          (busy ? ' disabled' : '') + '></button></span></div></li>';
    }).join('') + '</ul></div>';
}

// ---------------------------------------------------------------------------
// Tidy: unread mail that has sat in the inbox for 60 days is archived under
// "Tidied" - but only when it looks automated and comes from nobody you have
// ever written to. Archived, not deleted: it stays searchable, and Undo or its
// Inbox button puts it back.
// ---------------------------------------------------------------------------
const TIDY_DAYS = 60, TIDY_LABEL = 'Tidied', TIDY_EVERY = 24 * 3600e3, TIDY_CAP = 400;
const tidyOn = () => ls.get(K.tidy, '') === 'on';
const tidyId = () => [...labelsById.values()].find(l => l.name.toLowerCase() === TIDY_LABEL.toLowerCase())?.id || null;
// People write from these; a business's own domain is matched as a whole
// (write to anyone at a school, and all its staff count as people you know).
const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'icloud.com', 'me.com', 'mac.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net',
  'btinternet.com', 'sky.com', 'virginmedia.com', 'comcast.net', 'verizon.net', 'att.net']);
const AUTO_FROM = /^(no-?reply|do-?not-?reply|donotreply|newsletters?|notifications?|notify|marketing|mailer|digest|deals|offers|promo(tions)?)\b/i;
const AUTO_CATS = ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS'];
// Automated but yours: alerts, receipts, statements, bills, orders, bookings,
// sign-in and security notices, health messages. These always stay - when in
// doubt, keep. Read from the subject and the sender's address; government and
// university senders (hospitals, libraries, schools, the council) always stay.
const TX_SUBJECT = new RegExp('\\b(' + [
  'receipts?', 'invoices?', 'statements?', 'bills?', 'billing', 'payments?', 'paid', 'refunds?', 'charges?', 'autopay', 'due', 'overdue',
  'orders?', 'shipped', 'shipping', 'dispatched', 'deliver(y|ed|ing)?', 'tracking', 'confirm(ed|ation)?', 'appointments?', 'bookings?',
  'reservations?', 'itinerar(y|ies)', 'tickets?', 'check-?in', 'alerts?', 'security', 'sign-?in', 'log-?in', 'verif(y|ied|ication)',
  'codes?', 'passwords?', 'passcode', 'key', 'accounts?', 'polic(y|ies)', 'claims?', 'coverage', 'prescriptions?', 'pharmacy', 'results?',
  'health', 'medical', 'mychart', 'care team', 'doctor', 'clinic', 'patient', 'tax', 'taxes', '1099', 'w-?2', 'terms', 'renewal', 'renews?',
  'subscription', 'expir(es|ing|ed)', 'library', 'school',
].join('|') + ')\\b', 'i');
const TX_FROM = /(^|[.@+_-])(e?alerts?|billing|invoices?|receipts?|statements?|security|accounts?|myaccount|notices?|orders?|payments?|banking|onlinebanking|mychart|care|health|healthcare|pharmacy|clinic|hospital|medical|patient)([.@+_-]|$)|\.(gov|edu|nhs\.uk|ac\.uk)$/i;
const transactional = item => TX_FROM.test(item.email) || TX_SUBJECT.test(item.subject);
// Banks, card issuers, lenders and brokers: everything from them stays - their
// offers too. By domain (and any subdomain), plus any sender whose domain
// names a bank, credit union, mortgage or lender.
const BANKS = ['chase.com', 'citi.com', 'citibank.com', 'americanexpress.com', 'aexp.com', 'bankofamerica.com', 'bofa.com', 'wellsfargo.com',
  'capitalone.com', 'discover.com', 'usbank.com', 'pnc.com', 'truist.com', 'ally.com', 'sofi.com', 'chime.com', 'synchrony.com',
  'synchronybank.com', 'mysynchrony.com', 'barclays.com', 'barclaycardus.com', 'barclays.co.uk', 'goldmansachs.com', 'marcus.com', 'schwab.com',
  'fidelity.com', 'vanguard.com', 'etrade.com', 'robinhood.com', 'paypal.com', 'venmo.com', 'zellepay.com', 'wise.com', 'revolut.com',
  'monzo.com', 'starlingbank.com', 'natwest.com', 'rbs.co.uk', 'lloydsbank.co.uk', 'lloydsbank.com', 'halifax.co.uk', 'hsbc.com', 'hsbc.co.uk',
  'santander.co.uk', 'santander.com', 'nationwide.co.uk', 'tsb.co.uk', 'firstdirect.com', 'pennymac.com', 'rocketmortgage.com', 'mrcooper.com',
  'greenskycredit.com', 'greensky.com', 'affirm.com', 'klarna.com', 'afterpay.com', 'navyfederal.org', 'penfed.org', 'usaa.com', 'amex.com'];
const BANKISH = /(bank|creditunion|mortgage|lending|loans?)[^.]*\.[a-z.]+$|(^|\.)[a-z0-9-]*fcu\.(org|com)$/;
function isBank(email) {
  const host = (email.split('@')[1] || '').toLowerCase();
  return BANKS.some(d => host === d || host.endsWith('.' + d)) || BANKISH.test(host);
}

// Senders you chose to keep out of Tidy, on this device.
const tidyKeeps = () => { try { return JSON.parse(ls.get(K.tidyKeep, '[]')); } catch { return []; } };
const tidyKept = email => tidyKeeps().includes(String(email).toLowerCase());
function setTidyKeep(email, on) {
  const e = String(email).toLowerCase(), list = tidyKeeps().filter(x => x !== e);
  if (on) list.push(e);
  ls.set(K.tidyKeep, JSON.stringify(list.sort()));
}

// Why a conversation looks automated, or '' when it doesn't.
function automated(t, email) {
  const msgs = t.messages || [];
  const has = n => msgs.some(m => hdr(m, n));
  if (has('list-unsubscribe')) return 'a mailing list';
  if (has('list-id') || msgs.some(m => /^(bulk|list)$/i.test(hdr(m, 'precedence').trim()))) return 'a mailing list';
  const cat = AUTO_CATS.find(c => msgs.some(m => (m.labelIds || []).includes(c)));
  if (cat) return 'in ' + cat.slice(9).toLowerCase().replace(/^./, c => c.toUpperCase());
  if (AUTO_FROM.test(email)) return 'a no-reply sender';
  return '';
}

// Whether you have ever written to this address - or, for a business, to
// anyone at its domain. One tiny search each, remembered for this visit only.
const wroteTo = new Map();
function knownSender(email, call = api) {
  const host = email.split('@')[1] || '';
  const key = FREEMAIL.has(host) || !host ? email : host;
  if (!wroteTo.has(key)) {
    wroteTo.set(key, call('/messages', { params: { q: 'in:sent to:' + key, maxResults: 1 } })
      .then(r => !!(r.messages || []).length)
      .catch(e => { wroteTo.delete(key); throw e; }));
  }
  return wroteTo.get(key);
}

// Tidy's Gmail calls are paced: Gmail allows each person only so many quota
// units a minute, and a first look through a couple of hundred old
// conversations at full speed spent several times what opening the app does,
// in a few seconds - enough for Gmail to say "slow down", which then held up
// the rest of the app too. Paced to a few calls a second, it stays well under
// the limit while you keep using the app; if Gmail asks for a pause anyway,
// Tidy waits it out and carries on rather than failing.
const BG_GAP = Number(localStorage.getItem('mail.tidyPace')) || 160;   // ms between the starts of Tidy's calls (the tests shorten it)
const TIDY_DELAY = Number(localStorage.getItem('mail.tidyDelay')) || 20000;   // the daily run waits this long after opening (the tests shorten it)
const MKT_DELAY = Number(localStorage.getItem('mail.mktDelay')) || 2500;      // the marketing sort starts this long after opening (the tests shorten it)
const TIDY_DAILY = 100;               // the daily run looks at no more than this; the Preview at TIDY_CAP
// One paced run: calls start `gap` ms apart, and each "slow down" doubles the
// gap for the rest of the run, so it doesn't walk straight back into the limit.
// All the background runs (Tidy, the marketing sort, the clean-up) take turns
// from one clock, so two at once share the pace rather than add up.
let bgNext = 0;
function pacer({ onPause, maxWaits = 3 } = {}) {
  let gap = BG_GAP;
  async function turn() {
    for (let waits = 0; slowed(); waits++) {
      if (waits >= maxWaits) throw new QuotaError('Gmail asked the app to slow down for a minute');
      onPause?.(slowUntil);
      await sleep(slowUntil - Date.now() + 500 + Math.random() * 1000);
    }
    const wait = bgNext - Date.now();
    bgNext = Math.max(Date.now(), bgNext) + gap;
    if (wait > 0) await sleep(wait);
  }
  return async function call(path, opts) {
    for (let tries = 0; ; tries++) {
      await turn();
      try { return await api(path, opts); }
      catch (e) {
        if (!(e instanceof QuotaError) || tries >= maxWaits) throw e;
        gap = Math.min(gap * 2, 2000);            // slower from here on
      }
    }
  };
}

// Conversations Tidy has already looked at and kept, by id and Gmail's
// historyId for them - ids only, nothing about the mail. A later run skips
// them unless something in the conversation changed, so each run spends
// Gmail's allowance on mail it hasn't judged yet. "You chose to keep" isn't
// remembered here: that list can change.
const SEEN_KEY = 'mail.tidySeen.v1', SEEN_MAX = 4000;
const tidySeen = () => { try { return new Map(Object.entries(JSON.parse(ls.get(SEEN_KEY, '{}')))); } catch { return new Map(); } };
function saveSeen(map) {
  const all = [...map.entries()];
  ls.set(SEEN_KEY, JSON.stringify(Object.fromEntries(all.slice(Math.max(0, all.length - SEEN_MAX)))));
}

// What Tidy would do now. Nothing is changed. Flagged, Important and tagged
// mail (tags, reminders, Marketing) is left out by the search itself. The
// oldest conversations are looked at first, and those already kept on an
// earlier run are skipped. progress(done, of) reports as it goes; alive()
// false stops it early.
async function tidyPlan({ progress, alive = () => true, onPause, limit = TIDY_CAP, maxWaits = 3 } = {}) {
  const call = pacer({ onPause, maxWaits });
  const cutoff = Date.now() - TIDY_DAYS * 86400e3;
  const all = [];
  let pageToken;
  do {
    const r = await call('/threads', { params: {
      q: 'in:inbox is:unread older_than:' + TIDY_DAYS + 'd -is:starred -is:important -has:userlabels -category:purchases -category:reservations',
      maxResults: 500, pageToken } });
    all.push(...(r.threads || [])); pageToken = r.nextPageToken;
  } while (pageToken && all.length < 5000 && alive());
  const seen = tidySeen();
  for (const id of [...seen.keys()]) if (!all.some(t => t.id === id)) seen.delete(id);   // gone from the inbox, or read
  const fresh = all.filter(t => seen.get(t.id) !== String(t.historyId)).reverse();        // oldest first
  const todo = fresh.slice(0, limit);
  const plan = { tidy: [], keep: [], looked: 0, skipped: all.length - fresh.length, left: fresh.length - todo.length, total: todo.length };
  const me = (state.me || '').toLowerCase();
  const byDate = (a, b) => b.item.date - a.item.date;
  const kept = (t, item, why, remember = true) => { plan.keep.push({ item, why }); if (remember) seen.set(t.id, String(t.historyId)); };
  progress?.(0, todo.length);
  for (const { id } of todo) {
    if (!alive()) break;
    const t = await call('/threads/' + id, {
      params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Id', 'Precedence'] },
    }).catch(e => { if (e instanceof QuotaError || e instanceof AuthError) throw e; return null; });
    const item = t && buildRow(t);
    if (item) {
      const msgs = t.messages || [], ids = msgs.map(m => m.id);
      if (msgs.some(m => (m.labelIds || []).includes('SENT')) || item.email === me) kept(t, item, 'you wrote in it');
      else if (msgs.some(m => Number(m.internalDate) > cutoff)) { /* something newer arrived: not stale */ }
      else if (tidyKept(item.email)) kept(t, item, 'you chose to keep', false);
      else if (isBank(item.email)) kept(t, item, 'a bank');
      else {
        const why = automated(t, item.email);
        if (!why) kept(t, item, 'looks like a person');
        else if (transactional(item)) kept(t, item, 'alert or receipt');
        else if (await knownSender(item.email, call)) kept(t, item, 'you’ve written to them');
        else plan.tidy.push({ item, ids, why });
      }
    }
    plan.looked++;
    if (plan.looked % 10 === 0) saveSeen(seen);
    progress?.(plan.looked, todo.length);
  }
  saveSeen(seen);
  plan.left += todo.length - plan.looked;          // stopped early: those wait for next time
  plan.tidy.sort(byDate); plan.keep.sort(byDate);
  return plan;
}

// Archives what the plan found, under the Tidied label. Returns what Undo needs.
async function tidyApply(plan) {
  const label = await labelNamed(TIDY_LABEL, { create: true });
  const ids = plan.tidy.flatMap(x => x.ids);
  await relabel(ids, [label.id], ['INBOX']);
  ls.set(K.tidied, String(Date.now()));
  const threads = new Set(plan.tidy.map(x => x.item.threadId));
  patch(it => threads.has(it.threadId), [label.id], ['INBOX']);
  return { ids, label: label.id, threads };
}

async function untidy(back) {
  await relabel(back.ids, ['INBOX'], [back.label]);
  patch(it => back.threads.has(it.threadId), ['INBOX'], [back.label]);
}

// Once a day, when Tidy is on, as the app opens.
async function tidyDaily() {
  if (!tidyOn() || Date.now() - Number(ls.get(K.tidied, 0)) < TIDY_EVERY || slowed()) return;
  ls.set(K.tidied, String(Date.now()));          // one try a day, even if it fails part-way
  const plan = await tidyPlan({ limit: TIDY_DAILY, maxWaits: 1 });
  if (!plan.tidy.length) return;
  const back = await tidyApply(plan);
  const n = plan.tidy.length;
  toast('Tidied ' + n + ' old unread ' + (n === 1 ? 'email' : 'emails'), { action: () => undoTidy(back), label: 'Undo', ms: 9000 });
  await settle('right');
}

async function undoTidy(back) {
  try { toast('Putting them back…', { ms: 60000 }); await untidy(back); toast('Back in the inbox'); state.lists = {}; go({ force: true }); }
  catch (err) { failed(err); }
}

// ---------------------------------------------------------------------------
// Marketing sort: Gmail's Promotions in the inbox go to the Marketing bucket
// (out of the inbox; emptied after "Delete after" days) as the app opens -
// the whole inbox the first time, then whatever came in since. Tidy's rules
// decide what stays: a thread you wrote in, a sender you chose to keep, a
// bank, an alert or receipt, someone you have written to. Tagged mail (the
// auto-tags, your tags) and Flagged mail are left out by the search itself;
// Gmail's Important flag is not, as it marks plenty of promotions.
// ---------------------------------------------------------------------------
// Senders whose "alerts" are really advertising (saved-search and price-drop
// mailings): sorted as marketing whatever Gmail's category, and not kept for
// having "Alert" in the subject. Banks, people you've written to and Always
// kept senders still win.
const MKT_ALWAYS = ['emalert.cars.com'];
const MKT_Q = 'in:inbox {category:promotions from:(' + MKT_ALWAYS.join(' OR ') + ')} -is:starred -has:userlabels -in:chats';
const marketingSender = email => { const h = (email.split('@')[1] || '').toLowerCase(); return MKT_ALWAYS.some(d => h === d || h.endsWith('.' + d)); };
const MKT_SEEN = 'mail.mktSeen.v1', MKT_EVERY = 15 * 60e3;
const mktSortOn = () => ls.get(K.mktSort, 'on') === 'on';
// Threads looked at and kept, by id: their historyId; 'k:' + sender + ':' +
// historyId for one kept because you always keep that sender (looked at again
// only if you stop); or 'keep' for one you put back (kept whatever happens).
const mktSeen = () => { try { return new Map(Object.entries(JSON.parse(ls.get(MKT_SEEN, '{}')))); } catch { return new Map(); } };
function saveMktSeen(map) {
  const all = [...map.entries()];
  ls.set(MKT_SEEN, JSON.stringify(Object.fromEntries(all.slice(Math.max(0, all.length - 8000)))));
}
function mktKeepThread(threadId) { const m = mktSeen(); m.set(threadId, 'keep'); saveMktSeen(m); }

// Why a Promotions conversation stays in the inbox, or '' when it can go.
async function mktKeepReason(t, item, call) {
  const me = (state.me || '').toLowerCase();
  if ((t.messages || []).some(m => (m.labelIds || []).includes('SENT')) || item.email === me) return 'you wrote in it';
  if (tidyKept(item.email)) return 'you chose to keep';
  if (isBank(item.email)) return 'a bank';
  if (!marketingSender(item.email) && transactional(item)) return 'alert or receipt';
  if (await knownSender(item.email, call)) return 'you’ve written to them';
  return '';
}

let mktRunning = null;
// One run. progress(moved) as it goes; returns what Undo needs.
async function marketingSort({ progress, alive = () => true } = {}) {
  const call = pacer({ maxWaits: 3 });
  const label = await bucketLabel();
  const all = [];
  let pageToken;
  do {
    const r = await call('/threads', { params: { q: MKT_Q, maxResults: 500, pageToken } });
    all.push(...(r.threads || [])); pageToken = r.nextPageToken;
  } while (pageToken && all.length < 20000 && alive());
  const seen = mktSeen(), here = new Set(all.map(t => t.id));
  for (const id of [...seen.keys()]) if (!here.has(id)) seen.delete(id);       // left the inbox, or tagged since
  const known = (t, v = seen.get(t.id) || '') => v === 'keep' || v === String(t.historyId) ||
    (v.startsWith('k:') && v.endsWith(':' + t.historyId) && tidyKept(v.slice(2, v.lastIndexOf(':'))));
  const todo = all.filter(t => !known(t));                                       // newest first
  const back = { ids: [], threads: new Set(), label: label.id };
  let batch = [], looked = 0;
  const flush = async () => {
    if (!batch.length) return;
    const ids = batch.flatMap(x => x.ids), threads = new Set(batch.map(x => x.threadId));
    batch = [];
    await relabel(ids, [label.id], ['INBOX']);
    back.ids.push(...ids); threads.forEach(t => back.threads.add(t));
    patch(it => threads.has(it.threadId), [label.id], ['INBOX']);
    progress?.(back.threads.size);
  };
  for (const { id } of todo) {
    if (!alive()) break;
    const t = await call('/threads/' + id, {
      params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Id', 'Precedence'] },
    }).catch(e => { if (e instanceof QuotaError || e instanceof AuthError) throw e; return null; });
    const item = t && buildRow(t);
    if (item) {
      const why = await mktKeepReason(t, item, call);
      if (why) seen.set(t.id, (why === 'you chose to keep' ? 'k:' + item.email + ':' : '') + String(t.historyId));
      else batch.push({ ids: (t.messages || []).map(m => m.id), threadId: t.id });
    }
    if (batch.length >= 50) await flush();
    if (++looked % 20 === 0) saveMktSeen(seen);
  }
  await flush();
  saveMktSeen(seen);
  ls.set(K.mktSorted, String(Date.now()));
  return back;
}

// As the app opens, and when it comes back after a while.
async function sortMarketingNow({ force } = {}) {
  if (!mktSortOn() || mktRunning || slowed() || !getToken()) return;
  if (!force && Date.now() - Number(ls.get(K.mktSorted, 0)) < MKT_EVERY) return;
  let shown = false;
  mktRunning = marketingSort({
    progress: n => { if (n >= 50) { shown = true; toast('Moving marketing out of the inbox… ' + n.toLocaleString() + ' so far', { ms: 60000 }); } },
  });
  try {
    const back = await mktRunning;
    const n = back.threads.size;
    if (n) {
      toast('Moved ' + n.toLocaleString() + ' marketing ' + (n === 1 ? 'email' : 'emails') + ' to ' + settings.label,
        { label: 'Undo', action: () => undoMarketing(back), ms: 9000 });
      await settle('right');
    } else if (shown) toast('Marketing sorted');
  } catch (e) { if (shown) failed(e); }
  finally { mktRunning = null; }
}

async function undoMarketing(back) {
  try {
    toast('Putting them back…', { ms: 60000 });
    await relabel(back.ids, ['INBOX'], [back.label]);
    const seen = mktSeen();
    back.threads.forEach(t => seen.set(t, 'keep'));                // and they stay put
    saveMktSeen(seen);
    patch(it => back.threads.has(it.threadId), ['INBOX'], [back.label]);
    toast('Back in the inbox');
    state.lists = {}; go({ force: true });
  } catch (err) { failed(err); }
}

let showKeeps = false;                // Settings: the always-kept list, folded away until asked for
// Settings: Marketing and Tidy are one section, "Inbox clean-up": two
// switches, one note on what always stays, and Tidy's own buttons.
function tidyHTML() {
  const last = Number(ls.get(K.tidied, 0)), keeps = tidyKeeps(), on = tidyOn();
  const mon = mktSortOn(), mlast = Number(ls.get(K.mktSorted, 0));
  const since = t => ' Last run ' + (ago(t) === 'now' ? 'just now' : ago(t) + ' ago') + '.';
  return '<hr style="border:0;border-top:1px solid var(--hair);margin:2px 0">' +
    '<div class="field"><b>Inbox clean-up</b></div>' +
    '<div class="field"><span>Move marketing out of the inbox</span><button class="switch" role="switch" data-act="mkt-toggle" aria-checked="' + mon + '" aria-label="Move marketing out of the inbox"></button></div>' +
    '<p class="note">As the app opens, Gmail’s Promotions (and Cars.com’s saved-search alerts) go to ' + esc(settings.label) + ', which is emptied after ' + settings.days + ' days.' +
      (mon && mlast ? since(mlast) : '') + '</p>' +
    '<div class="field"><span>Tidy old unread mail</span><button class="switch" role="switch" data-act="tidy-toggle" aria-checked="' + on + '" aria-label="Tidy old unread mail"></button></div>' +
    '<p class="note">Once a day, archives unread mail left ' + TIDY_DAYS + ' days that is automated and from a stranger, under “' + TIDY_LABEL + '” (kept, never deleted).' +
      (on && last ? since(last) : '') + '</p>' +
    '<p class="note">Banks, alerts, receipts, tagged mail and people you’ve written to always stay.</p>' +
    '<div class="field"><button class="textbtn" data-act="tidy-preview">Preview Tidy</button><button class="textbtn" data-act="tidy-see">See tidied mail</button></div>' +
    (keeps.length ? '<div class="field"><span>Always kept</span><button class="textbtn" data-act="tidy-keeps">' + keeps.length + (showKeeps ? ' · Hide' : ' · Show') + '</button></div>' +
      (showKeeps ? keeps.map(e => '<div class="blocked"><span>' + esc(e) + '</span><button class="textbtn" data-act="tidy-unkeep" data-email="' + esc(e) + '">Remove</button></div>').join('') : '') : '');
}

// The preview: what would go, grouped by sender, and what is kept and why.
let tidyPreview = null;
async function openTidyPreview() {
  const el = $('#sheet');
  state.sheet = { tidy: true };
  el.innerHTML = '<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Tidy preview">' +
    '<div class="grab"></div><h3>Looking through old unread mail…</h3><p class="note" id="tidy-progress">' + ICON.spin + ' Nothing is changed yet.</p>' +
    '<p class="note">It goes gently, a few emails a second, so Gmail doesn’t ask the app to slow down. You can close this and keep using Mail.</p></div>';
  el.classList.remove('hide', 'leaving');
  const mine = state.sheet, alive = () => state.sheet === mine;
  const say = t => { const p = $('#tidy-progress'); if (p && alive()) p.innerHTML = ICON.spin + ' ' + t; };
  let tick = null;
  const stopTick = () => { clearInterval(tick); tick = null; };
  let plan;
  try {
    plan = await tidyPlan({
      alive, maxWaits: 6,
      progress: (d, n) => { stopTick(); say(n ? 'Looked at ' + d + ' of ' + n + ' · nothing is changed yet' : 'Nothing is changed yet.'); },
      onPause: until => {
        stopTick();
        const show = () => say('Gmail asked for a pause — carrying on in ' + Math.max(1, Math.ceil((until - Date.now()) / 1000)) + ' s, a little slower');
        show(); tick = setInterval(() => (alive() ? show() : stopTick()), 1000);
      },
    });
  }
  catch (err) { stopTick(); if (alive()) closeSheet(); return failed(err instanceof QuotaError ? new Error('Gmail asked the app to slow down — try the preview again in a few minutes') : err); }
  stopTick();
  if (!state.sheet?.tidy) return;                     // closed while looking
  tidyPreview = plan;
  drawTidyPreview();
}

function drawTidyPreview() {
  const plan = tidyPreview, box = $('#sheet .sheet');
  if (!plan || !box) return;
  const groups = new Map();
  for (const x of plan.tidy) {
    const g = groups.get(x.item.email) || { name: x.item.name, email: x.item.email, n: 0, why: x.why };
    g.n++; groups.set(x.item.email, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n).map(g =>
    '<li><span class="tw"><b>' + esc(g.name) + '</b><small>' + esc(g.email) + ' · ' + esc(g.why) + '</small></span><span class="tn">' + g.n + '</span>' +
    '<button class="tkeep" data-act="tidy-keep" data-email="' + esc(g.email) + '" aria-label="Always keep mail from ' + esc(g.email) + '">Keep</button></li>').join('');
  const kept = plan.keep.slice(0, 12).map(k =>
    '<li><span class="tw"><b>' + esc(k.item.name) + '</b><small>' + esc(k.item.subject) + '</small></span><span class="tk">' + esc(k.why) + '</span></li>').join('');
  const n = plan.tidy.length;
  box.innerHTML = '<div class="grab"></div>' +
    '<h3>' + (n ? 'Tidy ' + n + ' old unread ' + (n === 1 ? 'email' : 'emails') + '?' : 'Nothing to tidy') + '</h3>' +
    '<p class="note">Looked at ' + plan.looked + ' unread ' + (plan.looked === 1 ? 'conversation' : 'conversations') + ' older than ' + TIDY_DAYS + ' days, oldest first' +
      (plan.skipped ? ' (' + plan.skipped + ' kept on an earlier look were skipped)' : '') + '. ' +
      (plan.left ? plan.left + ' more wait for the next look. ' : '') +
      (n ? 'These are archived under “' + TIDY_LABEL + '” — not deleted. Tap Keep to leave a sender in the inbox for good.' : 'None of them look automated from a stranger.') + '</p>' +
    (n ? '<ul class="tidylist">' + rows + '</ul>' : '') +
    (kept ? '<h4 class="tidyh">Kept</h4><ul class="tidylist keeps">' + kept + '</ul>' + (plan.keep.length > 12 ? '<p class="note">…and ' + (plan.keep.length - 12) + ' more.</p>' : '') : '') +
    (n ? '<button class="btn" data-act="tidy-now">Tidy ' + n + ' now</button>' : '') +
    (tidyOn() ? '' : '<button class="btn ghost" data-act="tidy-on">' + (n ? 'Tidy now, and every day' : 'Tidy every day from now on') + '</button>') +
    '<button class="btn ghost" data-act="sheet-close">' + (n ? 'Not now' : 'Close') + '</button>';
}

async function runTidy(turnOn) {
  const plan = tidyPreview;
  closeSheet();
  if (turnOn) ls.set(K.tidy, 'on');
  if (!plan?.tidy.length) { if (turnOn) toast('Tidy is on — it runs once a day as the app opens'); return render(); }
  toast('Tidying…', { ms: 60000 });
  try {
    const back = await tidyApply(plan);
    tidyPreview = null;
    const n = plan.tidy.length;
    toast('Tidied ' + n + ' ' + (n === 1 ? 'email' : 'emails') + (turnOn ? ' — and every day from now' : ''), { action: () => undoTidy(back), label: 'Undo', ms: 9000 });
    state.lists = {};
    render();
  } catch (err) { failed(err); }
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
const state = {
  view: 'inbox',   // inbox | marketing | rules | settings
  tag: null,       // the tag (or category, or Flagged) chosen in the mailbox menu
  search: '',      // while set, search results take the list's place
  unread: false,   // the Unread filter: only unread mail, in whichever list is on screen
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

// The list on screen, and how to ask Gmail for it. With the Unread filter on,
// the same list asks Gmail for is:unread and is kept apart (key + '|unread');
// base is the list it filters.
function currentList() {
  const b = baseList();
  if (!state.unread) return { ...b, base: b.key };
  return { ...b, key: b.key + '|unread', base: b.key, q: [b.q, 'is:unread'].filter(Boolean).join(' ') };
}
function baseList() {
  if (state.search) return { key: 'q:' + state.search, q: state.search };
  if (state.view === 'marketing') return { key: 'mkt', bucket: true };
  if (catOf(state.tag)) return { key: state.tag, q: 'in:inbox category:' + state.tag.slice(4) + ' -in:chats' };
  if (state.tag) return { key: 'tag:' + state.tag, labelIds: [state.tag] };
  return { key: 'inbox', q: 'in:inbox -in:chats' };
}

// Whether a message still belongs in a list once its labels change.
// A message read under the Unread filter stays until you leave, as in Mail.
function belongs(key, it) {
  key = key.replace(/\|unread$/, '');
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
  bell: '<svg class="i s" width="12" height="12" viewBox="0 0 24 24"><path d="M6 10.8a6 6 0 0 1 12 0v3.4a3.6 3.6 0 0 0 1.1 2.6l.2.2a1 1 0 0 1-.7 1.7H5.4a1 1 0 0 1-.7-1.7l.2-.2A3.6 3.6 0 0 0 6 14.2z"/><path d="M9.9 20.9a2.4 2.4 0 0 0 4.2 0"/></svg>',
  more: '<svg class="i" width="20" height="20" viewBox="0 0 24 24"><circle cx="5.2" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="18.8" cy="12" r="2.2"/></svg>',
  block: '<svg class="i s" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.8 5.8l12.4 12.4"/></svg>',
  tag: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M3 11.4V5.6A2.6 2.6 0 0 1 5.6 3h5.8a2.6 2.6 0 0 1 1.8.8l7.2 7.2a2.6 2.6 0 0 1 0 3.7l-5.5 5.5a2.6 2.6 0 0 1-3.7 0l-7.2-7.2a2.6 2.6 0 0 1-.8-1.8z"/><circle cx="7.9" cy="7.9" r="1.6"/></svg>',
  mkt: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M3.2 10.3v3.4a2 2 0 0 0 2 2h1.9l7.7 4.1a1.3 1.3 0 0 0 1.9-1.1V5.3a1.3 1.3 0 0 0-1.9-1.1L7.1 8.3H5.2a2 2 0 0 0-2 2z"/><path d="M7.1 15.7l1.1 3.6a1.6 1.6 0 0 0 1.5 1.1h.4a1.3 1.3 0 0 0 1.2-1.7l-.6-1.9"/><path d="M19.4 9.4a3.8 3.8 0 0 1 0 5.2"/></svg>',
  eye: '<svg class="i s" width="15" height="15" viewBox="0 0 24 24"><path d="M2.2 12c1.8-3.9 5.4-6.6 9.8-6.6s8 2.7 9.8 6.6c-1.8 3.9-5.4 6.6-9.8 6.6S4 15.9 2.2 12z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  label: '<svg class="i s" width="17" height="17" viewBox="0 0 24 24"><path d="M3 11.4V5.6A2.6 2.6 0 0 1 5.6 3h5.8a2.6 2.6 0 0 1 1.8.8l7.2 7.2a2.6 2.6 0 0 1 0 3.7l-5.5 5.5a2.6 2.6 0 0 1-3.7 0l-7.2-7.2a2.6 2.6 0 0 1-.8-1.8z"/><circle cx="7.9" cy="7.9" r="1.6"/></svg>',
  back: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M19.8 12H4.6"/><path d="M10.6 5.6L4.8 11.3a1 1 0 0 0 0 1.4l5.8 5.7"/></svg>',
  chev: '<svg class="i s bold" width="22" height="22" viewBox="0 0 24 24"><path d="M15.2 4.8L8.6 11.3a1 1 0 0 0 0 1.4l6.6 6.5"/></svg>',
  bin: '<svg class="i s" width="17" height="17" viewBox="0 0 24 24"><path d="M3.4 6.2h17.2"/><path d="M8.8 6.2V5.1a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.1"/><path d="M5.5 6.2l.8 12.2a2.8 2.8 0 0 0 2.8 2.6h5.8a2.8 2.8 0 0 0 2.8-2.6l.8-12.2"/><path d="M10 10.6v5.8M14 10.6v5.8"/></svg>',
  reply: '<svg class="i s" width="22" height="22" viewBox="0 0 24 24"><path d="M9.6 5.2L4.2 10.6a1.3 1.3 0 0 0 0 1.8l5.4 5.4"/><path d="M4.6 11.5h8.9a6.9 6.9 0 0 1 6.9 6.9v.8"/></svg>',
  compose: '<svg class="i s" width="21" height="21" viewBox="0 0 24 24"><path d="M11.5 3.8H7.6a3.8 3.8 0 0 0-3.8 3.8v8.8a3.8 3.8 0 0 0 3.8 3.8h8.8a3.8 3.8 0 0 0 3.8-3.8v-3.9"/><path d="M17.5 3.6a2.1 2.1 0 0 1 3 3l-7.4 7.4a2.4 2.4 0 0 1-1.1.6l-3 .8.8-3a2.4 2.4 0 0 1 .6-1.1z"/></svg>',
  up: '<svg class="i s bold" width="20" height="20" viewBox="0 0 24 24"><path d="M12 19.4V4.8"/><path d="M5.8 10.6l5.5-5.5a1 1 0 0 1 1.4 0l5.5 5.5"/></svg>',
  flag: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M5.2 21.2V4.6"/><path d="M5.2 4.6c1.9-1.2 3.9-1.4 6.1-.4s4.3 1 6.6-.2a.6.6 0 0 1 .9.5v8.3a1 1 0 0 1-.5.9c-2.1 1.1-4.3 1.1-7 0-2.1-.9-4.1-.7-6.1.4z"/></svg>',
  archive: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><rect x="2.8" y="3.4" width="18.4" height="5.4" rx="2.2"/><path d="M4.6 8.8v8.2a3.2 3.2 0 0 0 3.2 3.2h8.4a3.2 3.2 0 0 0 3.2-3.2V8.8"/><path d="M9.8 12.6h4.4"/></svg>',
  trash: '<svg class="i s" width="20" height="20" viewBox="0 0 24 24"><path d="M3.4 6.2h17.2"/><path d="M8.8 6.2V5.1a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.1"/><path d="M5.5 6.2l.8 12.2a2.8 2.8 0 0 0 2.8 2.6h5.8a2.8 2.8 0 0 0 2.8-2.6l.8-12.2"/><path d="M10 10.6v5.8M14 10.6v5.8"/></svg>',
  clip: '<svg class="i s clip" width="13" height="13" viewBox="0 0 24 24"><path d="M20.2 11.3l-7.7 7.7a5.3 5.3 0 0 1-7.5-7.5l8.1-8.1a3.5 3.5 0 0 1 5 5l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.3-7.3"/></svg>',
  img: '<svg class="i s" width="18" height="18" viewBox="0 0 24 24"><rect x="2.8" y="3.8" width="18.4" height="16.4" rx="4"/><circle cx="8.8" cy="9.4" r="1.8"/><path d="M3.2 17.2l3.6-3.2a1.8 1.8 0 0 1 2.4 0l1.6 1.4"/><path d="M9.2 20l5.9-5.6a1.8 1.8 0 0 1 2.5 0l3.4 3.2"/></svg>',
  spin: '<svg class="i s spin" width="18" height="18" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
  x: '<svg class="i s bold" width="20" height="20" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  out: '<svg class="i s" width="13" height="13" viewBox="0 0 24 24"><path d="M14 3.6h5.4a1 1 0 0 1 1 1V10"/><path d="M20 4l-8.6 8.6"/><path d="M18.4 13.8v3.4a3.2 3.2 0 0 1-3.2 3.2H6.8a3.2 3.2 0 0 1-3.2-3.2V8.8a3.2 3.2 0 0 1 3.2-3.2h3.4"/></svg>',
};

function listSkeleton(n = 6) {
  return '<div class="stack">' + Array.from({ length: n }, (_, i) => '<div class="skel" style="--i:' + i + '"></div>').join('') + '</div>';
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
  const inBucket = item.labelIds.includes(bucketId()) || tidied(item);
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
  return '<li class="' + (fresh ? 'fresh' : '') + (sel ? ' sel' : '') + (item.unread ? ' unread' : '') + '" style="--i:' + (fresh ? i - freshFrom : i) + '" data-id="' + esc(item.id) + '">' +
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
  inbox: '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M3 13.6l2-6.6a2.8 2.8 0 0 1 2.7-2h8.6a2.8 2.8 0 0 1 2.7 2l2 6.6v3.4a3.2 3.2 0 0 1-3.2 3.2H6.2A3.2 3.2 0 0 1 3 17z"/><path d="M3.2 13.4h4.3a1.1 1.1 0 0 1 1 .6l.6 1.2a1.1 1.1 0 0 0 1 .6h3.8a1.1 1.1 0 0 0 1-.6l.6-1.2a1.1 1.1 0 0 1 1-.6h4.3"/></svg>',
  'cat:primary': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="4"/><path d="M4.4 20a7.6 7.6 0 0 1 15.2 0"/></svg>',
  'cat:promotions': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><path d="M5.6 18.4L18.4 5.6"/><circle cx="7.2" cy="7.2" r="2.4"/><circle cx="16.8" cy="16.8" r="2.4"/></svg>',
  'cat:updates': '<svg class="i s" width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.4"/><path d="M12 7.6v.1"/></svg>',
  tick: '<svg class="i s bold" width="16" height="16" viewBox="0 0 24 24"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
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

// Switches with a sliding glass thumb: All | Unread, the tag sheet's tags and
// Settings' "Notify me about" - the shared AllisonOS one (home/slide.js). If
// that file never loaded (offline, before it was saved), the chosen option
// keeps its own fill and nothing slides.
const slide = window.AllisonOS?.slide || (() => {});
let segOn = null;
function slideSeg(jump) {
  const seg = $('#seg'), on = seg.querySelector('[aria-checked="true"]');
  // The bar is never redrawn, so a render that changes nothing leaves it be (placing it again would stop a slide).
  if (!seg.offsetWidth || (!jump && on === segOn && seg.querySelector('.slthumb'))) return;
  segOn = on;
  slide(seg, on, 'unread', { jump });
}
function slideNotify(jump) {
  const g = screen.querySelector('.notify-modes');
  if (g) slide(g, g.querySelector('[aria-checked="true"]'), 'notify', { jump });
}
let tagPicks = 0;                   // each tag sheet starts afresh: its thumb appears where it's picked
function slideTags(jump) {
  const g = $('#sheet .tagpick');
  if (g) slide(g, g.querySelector('.chip2.on'), 'tagpick', { group: String(tagPicks), jump });
}

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
  $('#home').classList.toggle('hide', !signedIn || !!sel);
  $('#gear').classList.toggle('hide', !signedIn || !!sel);
  $('#gear').setAttribute('aria-label', state.view === 'settings' ? 'Close settings' : 'Settings');
  $('#edit').classList.toggle('hide', !listView || (!items.length && !sel));
  $('#edit').textContent = sel ? 'Done' : 'Edit';
  $('#selall').classList.toggle('hide', !sel);
  const all = sel && items.length && items.every(it => sel.has(it.id));
  $('#selall').textContent = all ? 'Deselect All' : 'Select All';
  $('#title').textContent = sel ? (sel.size ? sel.size + ' Selected' : 'Select') : signedIn ? viewName() : 'Mail';
  fitTitle();
  $('#boxbtn').disabled = !main || !!sel;
  if ($('#boxbtn').disabled) closeBoxMenu(true);
  $('#sub').textContent = sel ? 'Tap, or drag down the circles' : (state.me || (signedIn ? 'Connecting…' : 'Not connected'));

  $('#fab').classList.toggle('hide', !listView || !!sel);
  $('#seg').classList.toggle('hide', !listView || !!sel);
  $('#seg').classList.toggle('on', !!state.unread);
  for (const b of $('#seg').querySelectorAll('button')) b.setAttribute('aria-checked', String((b.dataset.on === '1') === !!state.unread));
  slideSeg();
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
  slideNotify();
  openRow = null;
  freshFrom = Infinity;
  $('#foot').innerHTML = footHTML();
}

// The clean-up line belongs to the Marketing bucket, so it shows only there.
function footHTML() {
  if (!getToken() || state.view !== 'marketing' || state.search) return '';
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
  else if (spec.base === 'mkt') head = '<h2>' + esc(settings.label) + ' · deleted after ' + settings.days + ' days</h2>';
  else if (state.tag && !catOf(state.tag)) head = '<h2 class="gh"><span class="tchip" style="--h:' + (state.tag === 'STARRED' ? 36 : hue(tagName)) + '">' + esc(tagName) + '</span></h2>';
  if (!items.length) {
    const empty = state.unread ? 'No unread mail here.<br>Tap All to see everything.'
      : state.search ? 'Nothing matches “' + esc(state.search) + '”.'
      : spec.base === 'mkt' ? 'Nothing in ' + esc(settings.label) + ' yet.<br>Tap the tag on a message to start.'
      : state.tag === 'STARRED' ? 'Nothing flagged.<br>Swipe an email left and tap Flag.'
      : catOf(state.tag) ? 'Nothing in ' + esc(tagName) + '.'
      : state.tag ? 'Nothing tagged ' + esc(tagName) + ' yet.'
      : 'Inbox zero. Nothing left to file.';
    return '<div class="card">' + head + '<div class="empty">' + empty + '</div></div>';
  }
  // Each conversation is its own glass pill, floating over the background.
  return '<div class="stack">' + head + '<ul class="list pills">' + items.map((it, i) => rowHTML(it, i, spec.base)).join('') + '</ul>' +
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
        '<span class="open"><span class="who"><span class="name">' + esc(presetOfFilter(f) ? 'Auto-tag: ' + presetOfFilter(f).about.toLowerCase() : f.criteria?.from || f.criteria?.query || '(no sender)') + '</span></span>' +
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
  return autoTagsHTML() + form + none + yours.map(tagCard).join('') + otherCard + leftCard;
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
    '<div class="field"><span>Unread count on the app icon</span><button class="switch" role="switch" data-act="badge" aria-checked="' + badgeOn() + '" aria-label="Unread count on the app icon"></button></div>' +
    tidyHTML() +
    notifyHTML() +
    blockedHTML() +
    '<button class="btn ghost" data-act="signin-pick">Switch account</button>' +
    '<button class="btn warn" data-act="signout">Sign out</button>' +
    '<p class="note">Redirect URI registered for this build:<br><code class="url">' + esc(redirectUri()) + '</code></p>' +
  '</div>';
}

// ---------------------------------------------------------------------------
// New-mail notifications: the phone subscribes to the small server in
// mail/push, which watches the inbox and sends a Web Push when mail arrives.
// ---------------------------------------------------------------------------
const PUSH_URL = '';                  // the Worker's address, once deployed (Settings can set it too)
const pushUrl = () => (ls.get(K.pushUrl, '') || PUSH_URL).trim().replace(/\/+$/, '');
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const notifyMode = () => ls.get(K.notify, '');
const NOTIFY_MODES = () => [
  ['all', 'Everything but ' + settings.label + ' and Promotions'],
  ['primary', 'Primary only'],
  ['tags', 'Only mail with one of your tags'],
];

function notifyHTML() {
  const on = notifyMode(), url = pushUrl();
  const hr = '<hr style="border:0;border-top:1px solid var(--hair);margin:2px 0">';
  if (!url) {
    return hr + '<div class="field"><span>New-mail notifications</span><span>not set up</span></div>' +
      '<p class="note">These need the small notification server in <code>mail/push</code> (see the README, “Notifications”). Once it is deployed, paste its address:</p>' +
      '<div class="field"><input type="url" id="push-url" placeholder="https://mail-push….workers.dev" style="width:100%" autocapitalize="off" autocorrect="off" spellcheck="false"></div>' +
      '<button class="btn ghost" data-act="push-url-save">Save address</button>';
  }
  return hr + '<div class="field"><span>New-mail notifications</span><span>' + (on ? 'On' : 'Off') + '</span></div>' +
    '<div class="notify-modes" role="radiogroup" aria-label="Notify me about">' +
      NOTIFY_MODES().map(([id, label]) => '<button class="textbtn" role="radio" data-act="notify-mode" data-mode="' + id + '" aria-checked="' + (on === id) + '">' + esc(label) + '</button>').join('') +
    '</div>' +
    (on ? '<div class="field"><button class="textbtn" data-act="notify-test">Send a test</button><button class="textbtn" data-act="notify-off">Turn off</button></div>' : '') +
    '<p class="note">From ' + esc(url.replace(/^https:\/\//, '')) + '. It sees senders and subjects, never what an email says; the notification itself is encrypted for this phone.</p>' +
    '<button class="btn ghost" data-act="push-url-change">Change server</button>';
}

async function pushCall(path, body) {
  const tok = getToken();
  if (!tok) throw new AuthError('signed out');
  const r = await fetch(pushUrl() + path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok.t, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  }).catch(() => { throw new Error('couldn’t reach the notification server'); });
  if (!r.ok) throw new Error(r.status === 403 ? 'the server only answers the Gmail account it was set up for' : 'the server answered ' + r.status);
  return r.json();
}

async function pushSubscription(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!create) return sub;
  const { key } = await (await fetch(pushUrl() + '/key')).json();
  const want = bytesOf(b64std(key));
  const had = sub?.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey);
  if (sub && had && (had.length !== want.length || had.some((b, i) => b !== want[i]))) { await sub.unsubscribe(); sub = null; }   // made for another server
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
}

async function turnOnNotifications(mode) {
  if (!canPush()) return toast('Open Mail from your Home Screen to turn on notifications', { bad: true, ms: 7000 });
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission().catch(() => 'denied');
  if (perm !== 'granted') return toast('Allow notifications for Mail (iPhone Settings → Notifications → Mail) to turn these on', { bad: true, ms: 8000 });
  toast(notifyMode() ? 'Changing notifications…' : 'Turning on notifications…', { ms: 20000 });
  try {
    const sub = await pushSubscription(true);
    await pushCall('/subscribe', { subscription: sub.toJSON(), mode, tags: chipTags().map(l => l.id) });
    ls.set(K.notify, mode);
    ls.set(K.pushSynced, String(Date.now()));
    toast('Notifications on: ' + NOTIFY_MODES().find(m => m[0] === mode)[1].toLowerCase());
    render();
  } catch (err) {
    if (err instanceof AuthError) return failed(err);
    toast('Couldn’t turn on notifications: ' + err.message, { bad: true, ms: 8000 });
  }
}

async function turnOffNotifications() {
  try {
    const sub = await pushSubscription(false);
    if (sub) { await pushCall('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch {}
  ls.del(K.notify);
  toast('Notifications off');
  render();
}

// Twice a day, on opening: tell the server this phone is still here (and which
// tags it follows now). iOS can quietly replace a subscription.
async function syncPush() {
  if (!notifyMode() || !pushUrl() || !canPush() || Notification.permission !== 'granted') return;
  if (Date.now() - Number(ls.get(K.pushSynced, 0)) < 12 * 3600e3) return;
  try {
    const sub = await pushSubscription(true);
    await pushCall('/subscribe', { subscription: sub.toJSON(), mode: notifyMode(), tags: chipTags().map(l => l.id) });
    ls.set(K.pushSynced, String(Date.now()));
  } catch {}
}

// A tapped notification opens its conversation - kept on the phone first, so
// it survives a trip to Google to renew the sign-in.
async function openThreadById(id) {
  ls.del(K.openThread);
  let it = findItem(id);
  if (!it) { try { [it] = await hydrate([id]); } catch {} }
  if (!it) return;
  if (state.reading) await closeReader();
  openReader(it);
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
  const el = $('#reader'), bar = $('#rbar');
  bar.classList.add('leaving');                       // the buttons fade as the page goes
  return new Promise(done => {
    const finish = () => {
      el.classList.add('hide'); el.classList.remove('leaving', 'vt'); el.innerHTML = '';
      if (!state.reading) { bar.classList.add('hide'); bar.classList.remove('leaving'); bar.innerHTML = ''; }
    };
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
  const it = r.item, inBucket = it.labelIds.includes(bucketId()) || tidied(it);
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
  '</div>';
  renderReaderBar();
  renderReaderBody();
}

// The bar lives outside the message page: the page slides in (a transform),
// and anything position: fixed inside a transformed page scrolls away with it.
function renderReaderBar() {
  const bar = $('#rbar'), it = state.reading?.item;
  if (!bar || !it) return;
  const flagged = it.labelIds.includes('STARRED');
  bar.classList.remove('hide', 'leaving');
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
      '<button class="iconbtn" data-act="compose-cancel" aria-label="Cancel">' + ICON.x + '</button>' +
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
    tidyKept(who.email) ? { id: 'tidy-allow', label: 'Let Tidy Tidy This Sender' } : { id: 'tidy-keep', label: 'Never Tidy This Sender' },
    { id: 'block', label: 'Block Sender', danger: true },
  ] });
  if (pick === 'tidy-keep') {
    setTidyKeep(who.email, true);
    if (tidied(r.item)) return doRestore(r.item, null, null, { keep: true });
    toast('Tidy will always keep mail from ' + who.email);
  }
  if (pick === 'tidy-allow') { setTidyKeep(who.email, false); toast('Tidy can tidy ' + who.email + ' again'); }
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
    delete state.lists.inbox; delete state.lists['inbox|unread'];
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
  tagPicks++; slideTags();
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
    if (spec.base === 'inbox') {                    // reminders that came back go first, as in Mail
      const rl = await labelNamed(REMINDED);
      if (rl) {
        const pr = await threadPage(state.unread ? 'is:unread' : '', { labelIds: ['INBOX', rl.id] });
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
  if (spec.base === 'inbox' && state.lists[spec.key]?.items?.length) hintSwipe();
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
  const at = Math.max(4, Math.min((bar.top || innerHeight) - 4, y));
  const el = document.elementFromPoint(r.left + 60, at);
  const hit = el?.closest('#screen ul.list > li[data-id]');
  if (hit || !list.classList.contains('pills') || at < r.top || at > r.bottom) return hit || null;
  let best = null, gap = Infinity;
  for (const li of list.querySelectorAll(':scope > li[data-id]')) {
    const b = li.getBoundingClientRect(), d = at < b.top ? b.top - at : at > b.bottom ? at - b.bottom : 0;
    if (d < gap) { gap = d; best = li; }
  }
  return best;
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

// The large title steps down a size or two when it wouldn't fit beside the
// buttons (a long tag name, Marketing on a small phone), before it is cut off.
function fitTitle() {
  const h1 = $('header h1'), t = $('#title');
  const was = h1.classList.contains('fit2') ? 'fit2' : h1.classList.contains('fit1') ? 'fit1' : '';
  h1.style.transition = 'none';                    // measure the sizes themselves, not a step of the animation
  h1.classList.remove('fit1', 'fit2');
  let fit = '';
  if (!document.body.classList.contains('scrolled')) {
    for (const c of ['fit1', 'fit2']) {
      if (t.scrollWidth <= t.clientWidth + 1) break;
      h1.classList.remove('fit1'); h1.classList.add(c); fit = c;
    }
  }
  h1.classList.remove('fit1', 'fit2');
  if (was) h1.classList.add(was);
  void h1.offsetWidth;
  h1.style.transition = '';
  h1.classList.remove('fit1', 'fit2');
  if (fit) h1.classList.add(fit);
}

// Home: the inbox as the app opens - All, no tag, no search, at the top -
// from any page.
function goHome() {
  const away = state.view !== 'inbox';
  closeBoxMenu(true);
  screen.classList.toggle('back', away);
  state.view = 'inbox'; state.tag = null; state.unread = false; state.showSearch = false;
  clearSearch(false);
  $('#q').blur();
  go();
  window.scrollTo({ top: 0, behavior: reduced || away ? 'auto' : 'smooth' });
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

async function doRestore(item, btn, li, { keep = false } = {}) {
  if (btn) { btn.disabled = true; confirmTap(btn, li, 'blue'); btn.innerHTML = ICON.spin; }
  try {
    const wasTidied = tidied(item);
    const labelId = await unbucket(item);
    mktKeepThread(item.threadId);                     // brought back on purpose: the marketing sort leaves it
    await closeReader();
    patch(it => it.threadId === item.threadId, ['INBOX'], [labelId]);
    await settle('left');
    // Bucketed by a sender rule, or sorted there as marketing (no rule)?
    const match = ruleFor(item).match;
    const ruled = !wasTidied && (filtersCache || []).some(f => (f.action?.addLabelIds || []).includes(labelId) &&
      String(f.criteria?.from || '').toLowerCase() === match);
    if (wasTidied && keep) toast('Back in the inbox — Tidy will always keep mail from ' + item.email);
    else if (ruled) toast('Back in the inbox. The rule is still on — remove it under Rules.');
    else if (!tidyKept(item.email)) toast('Back in the inbox', { action: () => { setTidyKeep(item.email, true); toast('Mail from ' + item.email + ' will always stay in the inbox'); }, label: 'Always Keep', ms: 8000 });
    else toast('Back in the inbox');
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
    case 'unread-filter':
      if ((el.dataset.on === '1') === !!state.unread) return;
      state.unread = !state.unread;
      if (state.unread) delete state.lists[currentList().key];   // always a fresh look at what's unread
      screen.classList.remove('back');
      return go();
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
      slideTags();
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
    case 'tidy-preview': return openTidyPreview();
    case 'tidy-keep': {
      const email = el.dataset.email;
      setTidyKeep(email, true);
      if (tidyPreview) {
        const out = tidyPreview.tidy.filter(x => x.item.email === email);
        tidyPreview.tidy = tidyPreview.tidy.filter(x => x.item.email !== email);
        tidyPreview.keep = out.map(x => ({ item: x.item, why: 'you chose to keep' })).concat(tidyPreview.keep);
        drawTidyPreview();
      }
      return toast('Tidy will always keep mail from ' + email);
    }
    case 'tidy-unkeep': setTidyKeep(el.dataset.email, false); toast('Tidy can tidy ' + el.dataset.email + ' again'); return render();
    case 'tidy-now': return runTidy(false);
    case 'tidy-on': return runTidy(true);
    case 'tidy-off': ls.del(K.tidy); toast('Tidy is off'); return render();
    case 'tidy-toggle':
      if (tidyOn()) { ls.del(K.tidy); toast('Tidy is off'); return render(); }
      ls.set(K.tidy, 'on'); ls.del(K.tidied);     // due now: the first run starts in the background, gently
      toast('Tidy is on — it works through old mail in the background, a little each day', { ms: 5000 });
      render();
      return tidyDaily().catch(() => {});
    case 'tidy-keeps': showKeeps = !showKeeps; return render();
    case 'mkt-toggle':
      if (mktSortOn()) { ls.set(K.mktSort, 'off'); toast('Marketing stays in the inbox'); return render(); }
      ls.set(K.mktSort, 'on');
      toast('Marketing will move out of the inbox — starting now', { ms: 4000 });
      render();
      return sortMarketingNow({ force: true });
    case 'preset-toggle': {
      const p = PRESETS.find(x => x.name === li?.dataset.preset);
      if (!p || presetBusy.has(p.name)) return;
      presetBusy.add(p.name); render();
      try {
        if (presetFilter(p)) {
          await presetOff(p);
          toast(p.name + ' is off. Mail already tagged keeps the tag.');
        } else {
          toast('Turning on ' + p.name + ' · tagging the mail already here…', { ms: 60000 });
          const back = await presetOn(p);
          const n = back.added.length, r = back.rescued.length;
          toast(p.name + ' is on' + (n ? ' · tagged ' + n.toLocaleString() + ' email' + (n === 1 ? '' : 's') : '') +
            (r ? ' · ' + r + ' back from Tidied' : ''), {
            label: 'Undo', ms: 9000,
            action: async () => {
              try { toast('Undoing…', { ms: 60000 }); await presetUndo(back); toast(p.name + ' is off again'); loadRules({ force: true }); }
              catch (err) { failed(err); }
            },
          });
        }
      } catch (err) { failed(err); }
      presetBusy.delete(p.name);
      return loadRules({ force: true });
    }
    case 'preset-see': {
      const p = PRESETS.find(x => x.name === li?.dataset.preset);
      if (!p) return;
      const l = presetFilter(p) && labelByName(p.name);
      state.view = 'inbox';
      clearSearch(false);
      if (l) state.tag = l.id;                    // on: the tag itself
      else {                                      // off: what it would tag, as a search
        state.tag = null;
        state.search = p.query; state.showSearch = true;
        if ($('#q')) $('#q').value = state.search;
        toast('What ' + p.name + ' would tag', { ms: 3000 });
      }
      return go();
    }
    case 'tidy-see':
      state.view = 'inbox'; state.tag = null;
      state.search = 'label:' + TIDY_LABEL; state.showSearch = true;
      if ($('#q')) $('#q').value = state.search;
      return go();
    case 'notify-mode': return turnOnNotifications(el.dataset.mode);
    case 'notify-off': return turnOffNotifications();
    case 'notify-test':
      try { const r = await pushCall('/test'); toast(r.sent ? 'Test sent — it should arrive in a moment' : 'The server has no phone to send to — turn notifications off and on', { ms: 6000 }); }
      catch (err) { if (err instanceof AuthError) failed(err); else toast('Couldn’t send a test: ' + err.message, { bad: true, ms: 7000 }); }
      return;
    case 'push-url-save': {
      const v = ($('#push-url')?.value || '').trim();
      if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(v)) return toast('That doesn’t look like the server’s https:// address', { bad: true });
      ls.set(K.pushUrl, v);
      toast('Saved. Choose what to be notified about.');
      return render();
    }
    case 'push-url-change':
      if (notifyMode()) await turnOffNotifications();
      ls.del(K.pushUrl);
      return render();
    case 'home': return goHome();
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
      const card = screen.querySelector('.stack, .card');
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
  const want = new URLSearchParams(location.search).get('thread');
  if (want) { ls.set(K.openThread, want); history.replaceState(history.state, '', location.pathname); }
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
  Promise.all([refreshLabels(), refreshFilters()]).then(() => { render(); bringBackReminders(); syncPush(); return upgradePresets(); }).catch(() => {});
  loadList().then(() => { const t = ls.get(K.openThread, ''); if (t) openThreadById(t); })
    .then(() => sleep(MKT_DELAY)).then(() => sortMarketingNow({ force: true }))
    .then(() => sleep(TIDY_DELAY)).then(() => tidyDaily()).catch(() => {});   // after opening's own calls, not on top of them
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

addEventListener('resize', () => { closeBoxMenu(true); slideSeg(true); slideNotify(true); slideTags(true); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (clientId() && !getToken()) return renew();         // back after the hour ran out
  if (state.reading || state.select || slowed()) return;
  const list = state.lists[currentList().key];
  if (list?.at && Date.now() - list.at < 30000) return;                 // loaded moments ago
  if (state.view === 'inbox' || state.view === 'marketing') loadList({ force: true, quiet: true });
  sortMarketingNow();                                               // at most every 15 minutes
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  // a notification tapped while the app is already open
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.open && getToken()) openThreadById(String(e.data.open)); });
}
