// Empties the Marketing bucket on a schedule, so it happens whether or not
// the app is opened. Run by .github/workflows/mail.yml; the app runs the same
// sweep in the browser when you open it.
//
// Everything older than DELETE_AFTER_DAYS goes to the Trash, which Gmail
// deletes for good after 30 days. Nothing is erased outright, so a mistake is
// always recoverable for a month.
//
// Secrets (repository settings -> Secrets and variables -> Actions):
//   GOOGLE_CLIENT_ID      from a Desktop app OAuth client
//   GOOGLE_CLIENT_SECRET  the same client's secret
//   GOOGLE_REFRESH_TOKEN  from: node mail/scripts/get-refresh-token.mjs
// Variables (optional):
//   MARKETING_LABEL       default "Marketing"
//   DELETE_AFTER_DAYS     default 3
//
// Exits 0 and does nothing when the secrets are absent, so the workflow is
// harmless until it is set up.

const { GOOGLE_CLIENT_ID: ID, GOOGLE_CLIENT_SECRET: SECRET, GOOGLE_REFRESH_TOKEN: REFRESH } = process.env;
const LABEL = process.env.MARKETING_LABEL || 'Marketing';
const DAYS = Math.max(1, Math.min(365, Number(process.env.DELETE_AFTER_DAYS) || 3));
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

if (!ID || !SECRET || !REFRESH) {
  console.log('No Google credentials set - nothing to do.');
  console.log('Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN to enable the sweep.');
  process.exit(0);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ID, client_secret: SECRET, refresh_token: REFRESH, grant_type: 'refresh_token' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = body.error === 'invalid_grant'
      ? '\nThe refresh token is no longer valid. Google expires them after 7 days while the\n' +
        'OAuth consent screen is still in "Testing" - publish the app (In production) and\n' +
        'mint a new token with mail/scripts/get-refresh-token.mjs.'
      : '';
    throw new Error('Token refresh failed: ' + (body.error_description || body.error || res.status) + hint);
  }
  return body.access_token;
}

let token;
async function api(path, { method = 'GET', params, tries = 0 } = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token } });
  if ((res.status === 429 || res.status >= 500) && tries < 4) {
    await sleep(800 * 2 ** tries);
    return api(path, { method, params, tries: tries + 1 });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

const run = async () => {
  token = await accessToken();

  const { labels = [] } = await api('/labels');
  const label = labels.find(l => l.name.toLowerCase() === LABEL.toLowerCase());
  if (!label) {
    console.log(`No "${LABEL}" label in this mailbox yet - nothing to sweep.`);
    return;
  }

  const q = `label:"${LABEL.replace(/"/g, '')}" older_than:${DAYS}d`;
  const ids = [];
  let pageToken;
  do {
    const page = await api('/messages', { params: { q, maxResults: 500, pageToken } });
    for (const m of page.messages || []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken);

  if (!ids.length) {
    console.log(`Nothing in "${LABEL}" older than ${DAYS} days.`);
    return;
  }

  // Five at a time: Gmail's per-user rate limit is generous but not infinite.
  let done = 0, failed = 0;
  const workers = Array.from({ length: 5 }, async () => {
    for (let i = ids.shift(); i; i = ids.shift()) {
      try { await api('/messages/' + i + '/trash', { method: 'POST' }); done++; }
      catch (e) { failed++; if (failed < 4) console.warn('  ' + e.message); }
    }
  });
  await Promise.all(workers);

  console.log(`Moved ${done} message${done === 1 ? '' : 's'} older than ${DAYS} days from "${LABEL}" to the Trash.`);
  if (failed) console.log(`${failed} could not be moved.`);
};

run().catch(e => { console.error(e.message); process.exit(1); });
