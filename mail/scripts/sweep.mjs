// Empties the Marketing bucket on a schedule, so it happens whether or not
// the app is opened, and brings back Remind Me mail that is due. Run by
// .github/workflows/mail.yml; the app does the same when you open it.
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
//   DELETE_AFTER_DAYS     default 30
//
// Exits 0 and does nothing when the secrets are absent, so the workflow is
// harmless until it is set up.

const { GOOGLE_CLIENT_ID: ID, GOOGLE_CLIENT_SECRET: SECRET, GOOGLE_REFRESH_TOKEN: REFRESH } = process.env;
const LABEL = process.env.MARKETING_LABEL || 'Marketing';
const DAYS = Math.max(1, Math.min(365, Number(process.env.DELETE_AFTER_DAYS) || 30));
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
async function api(path, { method = 'GET', params, body, tries = 0 } = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method, headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if ((res.status === 429 || res.status >= 500) && tries < 4) {
    await sleep(800 * 2 ** tries);
    return api(path, { method, params, body, tries: tries + 1 });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

// Remind Me: mail labelled "Remind YYYY-MM-DD" goes back to the inbox on that
// day (UTC here), unread and labelled "Reminded"; then the day label is deleted.
async function reminders(labels) {
  const today = new Date().toISOString().slice(0, 10);
  const due = labels.filter(l => { const m = /^Remind (\d{4}-\d{2}-\d{2})$/i.exec(l.name); return m && m[1] <= today; });
  if (!due.length) return console.log('No reminders due.');
  let reminded = labels.find(l => l.name.toLowerCase() === 'reminded');
  if (!reminded) reminded = await api('/labels', { method: 'POST', body: { name: 'Reminded', labelListVisibility: 'labelShow', messageListVisibility: 'show' } });
  for (const l of due) {
    const ids = [];
    let pageToken;
    do {
      const page = await api('/messages', { params: { q: '-in:sent', labelIds: l.id, maxResults: 500, pageToken } });
      for (const m of page.messages || []) ids.push(m.id);
      pageToken = page.nextPageToken;
    } while (pageToken);
    for (let i = 0; i < ids.length; i += 500) {
      await api('/messages/batchModify', { method: 'POST', body: { ids: ids.slice(i, i + 500), addLabelIds: ['INBOX', 'UNREAD', reminded.id] } });
    }
    await api('/labels/' + l.id, { method: 'DELETE' });
    console.log(`Reminder "${l.name}": ${ids.length} message${ids.length === 1 ? '' : 's'} back in the inbox.`);
  }
}

const run = async () => {
  token = await accessToken();

  const { labels = [] } = await api('/labels');
  await reminders(labels);
  const label = labels.find(l => l.name.toLowerCase() === LABEL.toLowerCase());
  if (!label) {
    console.log(`No "${LABEL}" label in this mailbox yet - nothing to sweep.`);
    return;
  }

  // Matched by label id, not by name in the search: a name with spaces or an
  // apostrophe needs quoting that Gmail's search is fussy about.
  // Mail with one of the app's auto-tags (Travel, Money, Health, Orders) is
  // never emptied out, as in the app.
  const tagged = ['Travel', 'Money', 'Health', 'Orders'].filter(n => labels.some(l => l.name === n)).map(n => ' -label:' + n).join('');
  const q = `older_than:${DAYS}d${tagged}`;
  const ids = [];
  let pageToken;
  do {
    const page = await api('/messages', { params: { q, labelIds: label.id, maxResults: 500, pageToken } });
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
