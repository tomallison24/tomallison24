# Gmail search in Calendar

Open Calendar Settings > Connected accounts > Connect Gmail. Choose the Google account to search, then ask Ipsy to find an appointment, invitation or other email. Calendar has its own sign-in, separate from Mail and Orders.

Access is read-only. Ipsy asks separately before sharing email details with Claude; calendar changes still require their own confirmation. Attachments are skipped and email links are not opened. Search supports Gmail query syntax and pagination; Spam and Trash are excluded unless requested.

The Google token stays in browser session storage and expires within about an hour. Reconnect in Settings when needed. Connecting a different account or disconnecting clears Calendar Ipsy's saved chat. Disconnecting does not revoke Google authorization in other apps.

## Google configuration

The existing OAuth client's Authorized JavaScript origins must include the production site origin. Preview origins require their own authorization. The Google Identity Services token popup does not need a new redirect URI.

## Validation

Run `node calendar/scripts/gmail-test.mjs`, `node calendar/scripts/api-test.mjs`, `node calendar/scripts/ical-test.mjs`, and `node calendar/scripts/ipsy-test.mjs` (Playwright with Chromium required for the last command).

Automated tests use stand-ins. Real Google consent, access to the chosen mailbox and installed iPhone Safari still require device verification.
