// One-off helper: turns a Desktop-app OAuth client into the refresh token the
// scheduled sweep needs. Run it on your own machine, not in CI.
//
//   node mail/scripts/get-refresh-token.mjs <client-id> <client-secret>
//
// Why a second OAuth client: the phone app is a Web client using the implicit
// flow, which never issues a refresh token. A scheduled job has nobody to tap
// "allow", so it needs one - and only a Desktop client can mint one against
// the loopback address without a public redirect URI.
//
// Google expires refresh tokens after 7 days while the consent screen is in
// "Testing". Publish the app (OAuth consent screen -> In production) before
// minting the token, or the sweep stops after a week.

import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const [ID, SECRET] = process.argv.slice(2);
const PORT = 8765;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

if (!ID || !SECRET) {
  console.error('Usage: node mail/scripts/get-refresh-token.mjs <client-id> <client-secret>');
  console.error('Both come from a Desktop app OAuth client in the Google Cloud console.');
  process.exit(1);
}

const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash('sha256').update(verifier).digest());
const state = b64url(randomBytes(16));

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({
  client_id: ID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE,
  access_type: 'offline', prompt: 'consent', state,
  code_challenge: challenge, code_challenge_method: 'S256',
});

console.log('\nOpen this in a browser, signed in as the mailbox you want swept:\n');
console.log(url.toString() + '\n');

const server = createServer(async (req, res) => {
  const got = new URL(req.url, REDIRECT);
  const code = got.searchParams.get('code');
  if (!code && !got.searchParams.get('error')) { res.writeHead(404).end(); return; }

  const done = msg => { res.writeHead(200, { 'content-type': 'text/plain' }).end(msg); };
  if (got.searchParams.get('error')) { done('Declined. Nothing was changed.'); server.close(); process.exit(1); }
  if (got.searchParams.get('state') !== state) { done('State mismatch - start again.'); server.close(); process.exit(1); }

  const res2 = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: ID, client_secret: SECRET, redirect_uri: REDIRECT,
      grant_type: 'authorization_code', code_verifier: verifier,
    }),
  });
  const body = await res2.json();
  if (!body.refresh_token) {
    done('No refresh token came back. Check the console for details.');
    console.error('\nGoogle returned:', JSON.stringify(body, null, 2));
    server.close(); process.exit(1);
  }
  done('Done. The refresh token is in your terminal - close this tab.');
  console.log('GOOGLE_REFRESH_TOKEN\n');
  console.log(body.refresh_token + '\n');
  console.log('Add it, the client ID and the client secret as repository secrets:');
  console.log('  Settings -> Secrets and variables -> Actions -> New repository secret\n');
  server.close();
  process.exit(0);
});
server.listen(PORT, '127.0.0.1', () => console.log(`Waiting on ${REDIRECT} …`));
