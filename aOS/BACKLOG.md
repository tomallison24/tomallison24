# aOS backlog

What the pre-launch review (October 2026) found that isn't done yet, and why.
The owner asked for the Medium items to be logged for future updates; the rest
are items that weren't quick, or need the owner. Newest decisions first; strike
an item through (or delete it) when it ships, and say which release.

## Medium (logged for future updates, at the owner's request)

1. **Anyone can use up the daily KV write allowance without signing in.**
   `POST /aOS/api/signin/begin` writes a challenge to KV for every call (free
   plan: about 1,000 writes a day across the account). About 1,000 calls a day
   would stop sign-in, Drinks sync, Calendar's layers and Installed reporting
   until the next day. Fix: stateless challenges (an HMAC-signed `{nonce,
   expiry}` checked at finish, no KV write) and a Cloudflare rate-limiting
   rule on `/aOS/api/*`. `functions/aOS/api/[[route]].js`.
2. **The GitHub Pages copy shares its address with every other GitHub Pages
   site on the account** (`tomallison24.github.io`). Gmail, Home Assistant and
   Notes Sheet tokens saved by the apps there can be read by script on any
   other Pages site of the account. Fix: drop the mirror (the deploy job in
   `.github/workflows/news.yml`), or give it its own domain.
3. **Offline caches keep family-account replies.** aOS, Mail, News, Weather,
   Notes, Places and Home cache `/aOS/api/*` answers (the family list, the Home
   Assistant address, signed-in state) and keep them after signing out; aOS
   offline can show the owner's tools after sign-out. Fix: each `sw.js` leaves
   `/api/` alone (as Calendar, Drinks, Travel and Podcasts do), and bump CACHE.
4. **No security headers.** No `_headers` file: pages can be framed by other
   sites, and there is no HSTS, `nosniff`, Referrer-Policy or
   Permissions-Policy. Fix: a `_headers` file at the site root with
   `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`,
   `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer` and a `Permissions-Policy` (check each app's
   needs: location for Weather/Places/Calendar, camera for Travel's scanner).
5. **Notes reminder notifications can't deploy.** `notes/scripts/push-test.mjs`
   fails (its fixtures are fixed dates, and `pull()` drops reminders over 2 days
   old by the real clock), and `.github/workflows/notes-push.yml` runs it before
   deploying. The only default-branch run (2026-09-30) also failed at "Deploy the
   Worker", probably the Cloudflare token missing **Workers Scripts · Edit**.
   Fix: pass `now` through `refresh`/`pull` into `slim`, or date the fixtures
   from today; then check the token and re-run Notes push.
6. **News headlines refresh every 4 to 6 hours, not every 30 minutes.** GitHub
   throttles the `schedule` in `news.yml`. Fix: trigger the workflow from an
   outside cron (a Cloudflare cron Worker calling `workflow_dispatch`), or
   fetch feeds at the edge; at least correct `news/README.md` and
   `aOS/RELEASING.md`, which promise 30 minutes.
7. **A release can fail to publish.** If every news feed fails,
   `news/scripts/fetch-news.mjs` exits 1, the build fails, and a release whose
   tag already moved never reaches Cloudflare or GitHub Pages. Fix: on a
   release, publish with the previous `news.json` instead.
8. **Fitness never shows Drinks after "Not now".** Declining the one-time
   sign-in (`home/welcome.js`, `aos.signin.asked`) is final, and Fitness only
   uses a session already in its own storage. Fix: a "Sign in to show Drinks"
   row in Fitness Analysis when accounts are on and it isn't signed in. (The
   same applies to Calendar's layers: an app that was never signed in can't
   send its copy; Calendar says so.)
9. **Text contrast.** Faint labels, aOS's light grey and green text, and the
   walkthrough button were under 4.5:1. The Sea glass change addresses the
   tokens; re-measure after it ships.
10. **Buttons under 44 points.** Header icon buttons are 36 (Fitness, Calendar,
    Notes, Travel, Podcasts; 38 in Places and News), the week arrows 32, chips
    and News's topic tabs 34-36, aOS's Get 32 tall. Fix: 44-point hit areas
    (an invisible padded area around the 36-point glass keeps the look).
11. **Podcasts and Weather's server routes have no account lock.** Without
    Cloudflare Access in front, Podcasts' feed fetcher can be used by anyone
    as a proxy (it blocks internal addresses). Fix: confirm Access (the Access
    secrets and every hostname, see `calendar/README.md`, "Locking the server
    functions"), or put Podcasts behind `lock` too.

## Lower priority, not quick

- **Sign-ins last 400 days and can't be cut off one phone at a time.** Only
  removing the person (or rotating the KV `secret`, which signs everyone out)
  ends a session. Fix: a per-person session list or epoch, checked in
  `sessionUser`, with "Sign out everywhere"; shorter sessions that renew.
- **Labs passkeys use the real site.** `labs/two/passkey.js` makes passkeys on
  the production address, which then sit beside the AllisonOS one in the
  passkey picker (picking one gives "unknown"). Labs are the owner's test pages,
  so whether to remove or change that page is the owner's call.
- **The accounts API returns `detail: e.message` on unexpected errors**
  (`functions/aOS/api/[[route]].js`, the last catch). Not sensitive today, but
  better as a fixed message.
- **Week start.** Drinks and Fitness try to follow Calendar's "Week starts on",
  read from their own storage, so on an iPhone they keep their own default. Fix:
  share it through the account like the layers, or give each its own setting.
- **iOS limits, not code:** "Open in Drinks/Fitness/…" from Calendar, and the
  off screen's **Open aOS**, open a Safari view with its own storage (signed
  out) rather than the Home Screen app; and an app's "off" screen covers the
  `?via=aos` install steps. Worth a sentence in the walkthroughs.
- **Notes push: moving to a new Sheet** now needs the old script's secret
  changed first (a deliberate trade-off: an odd answer from Google no longer
  lets another Sheet take over).
- **"Places from Calendar" shows green when it isn't set up.**
  `places/scripts/from-calendar.mjs` exits 0 with "Not set up yet"; emit a
  `::notice::` so it's visible in Actions.
- **Week starts on Monday by default.** US calendars usually start on Sunday;
  changing the default changes everyone's week layout in Calendar, Fitness and
  Drinks, so it's the owner's call (Calendar → Settings → Week starts on).
- **"Car hire" in Travel** is the British term (US: "rental car"). It's wording,
  not spelling, and it runs through Travel and Calendar's layer; change it all
  at once if wanted.
- **Some apps show dates in the phone's own format** (Mail, Travel, Notes,
  Podcasts, Places, Weather, Home). On a US phone that's US; only the apps that
  forced British dates were moved to US.
- **Labs pages** got `lang="en-US"` but not the Sea glass colors (test pages).
- **New icons on phones** appear only after an app is removed from the Home
  Screen and added again (iOS keeps the icon it was added with).
- **Brute-force limits on sign-up and sign-in.** No per-address rate limit on
  `/aOS/api/*` (see Medium 1).
