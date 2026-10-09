# aOS backlog

What the pre-launch review (October 2026) found that isn't done yet, and why.
The owner asked for the Medium items to be logged for future updates; the rest
are items that weren't quick, or need the owner. Newest decisions first; strike
an item through (or delete it) when it ships, and say which release.

## Medium (logged for future updates, at the owner's request)

1. ~~**Anyone can use up the daily KV write allowance without signing in.**~~
   Done: asking to sign in now hands out a signed challenge and writes nothing;
   only a real passkey's sign-in writes (once). A Cloudflare rate-limiting rule
   on `/aOS/api/*` would still be a good extra (dashboard, not code).
2. **The GitHub Pages copy shares its address with every other GitHub Pages
   site on the account** (`tomallison24.github.io`). Gmail, Home Assistant and
   Notes Sheet tokens saved by the apps there can be read by script on any
   other Pages site of the account. Fix: drop the mirror (the deploy job in
   `.github/workflows/news.yml`), or give it its own domain.
3. ~~**Offline caches keep family-account replies.**~~ Done: every app's
   `sw.js` leaves `/api/` alone.
4. ~~**No security headers.**~~ Done: `_headers` (no framing by other sites,
   nosniff, Referrer-Policy, HSTS, a Permissions-Policy), published by news.yml.
5. **Notes reminder notifications: the test is fixed; the deploy needs a
   permission.** `notes/scripts/push-test.mjs` passes again (the Worker now uses
   the clock it's given, and the test pins its own) and runs in CI. The last
   default-branch deploy failed at "Deploy the Worker", most likely because the
   Cloudflare token lacks **Account · Workers Scripts · Edit**: add it
   (`aOS/RELEASING.md`, "Family accounts") and re-run Notes push.
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
9. ~~**Text contrast.**~~ Done with the Sea glass change (#243): every app's
   text, muted, faint and accent colors now measure 4.57:1 or more in both
   themes. Kept here as a reminder to measure any new tokens.
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

(Done since: the API no longer returns error details; weeks start on Sunday
everywhere, with Monday kept only where it was picked in Calendar; Travel says
"rental car".)

- **Sign-ins last 400 days.** "Sign out everywhere else" (aOS → Your account)
  now ends all of a person's other sessions at once; one phone alone still can't
  be picked out (no per-device list), and sessions don't shorten and renew.
- **Labs passkeys use the real site.** `labs/two/passkey.js` makes passkeys on
  the production address, which then sit beside the AllisonOS one in the
  passkey picker (picking one gives "unknown"). Labs are the owner's test pages,
  so whether to remove or change that page is the owner's call.
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
- **Some apps show dates in the phone's own format** (Mail, Travel, Notes,
  Podcasts, Places, Weather, Home). On a US phone that's US; only the apps that
  forced British dates were moved to US.
- **Labs pages** got `lang="en-US"` but not the Sea glass colors (test pages).
- **New icons on phones** appear only after an app is removed from the Home
  Screen and added again (iOS keeps the icon it was added with).
- **Brute-force limits on sign-up and sign-in.** No per-address rate limit on
  `/aOS/api/*` (see Medium 1).
