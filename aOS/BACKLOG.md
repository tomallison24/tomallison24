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
2. ~~**The GitHub Pages copy shares its address with other Pages sites.**~~
   Done: GitHub Pages is retired (the family uses tomallison24-news.pages.dev).
   It now serves only "AllisonOS has moved" pages that send every old address on,
   and forget AllisonOS's saved data there (`.github/pages-moved.html`).
3. ~~**Offline caches keep family-account replies.**~~ Done: every app's
   `sw.js` leaves `/api/` alone.
4. ~~**No security headers.**~~ Done: `_headers` (no framing by other sites,
   nosniff, Referrer-Policy, HSTS, a Permissions-Policy), published by news.yml.
5. ~~**Notes reminder notifications can't deploy.**~~ Done: the test passes
   again, and Notes push deployed on 2026-10-09 (so the Cloudflare token already
   has Workers Scripts · Edit). **Mail's notifications were never set up**: its
   deploy (Actions → Mail push) stops because the repository has no
   `PUSH_KV_ID` and `PUSH_ALLOWED_EMAIL` variables and no `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `PUSH_GOOGLE_REFRESH_TOKEN`, `VAPID_PUBLIC_KEY` and
   `VAPID_PRIVATE_KEY` secrets. Set them up (mail/README.md, "Notifications")
   only if Mail notifications are wanted; Mail works without them.
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

## From the platform audit (October 25, 2026)

A pass over every app, the shared scripts, the server routes and the workflows
(not Sparkle Kingdom, still in development). What it fixed shipped in aOS2.2's
log; what it found and left alone is here, by value. "Needs words" means new
English and its Russian.

### Bugs to fix

Done, all nine, in the follow-up PR (aOS2.2): Travel's extract size (the server
takes 64 KB, the app sends 8,000 characters and says when one couldn't be read);
Money's 1,500-row month (the newest 1,500 go, on the phone and on the server);
Notes' Undo restores only the notes it touched, and an edit to a note deleted
elsewhere is kept as a new note; the offline fallbacks in aOS, home, News, Notes
and Places serve the page only to a page load; Travel's event length with one
offset; Weather's nameless alerts and bad end dates; Calendar's "after" alarms;
prefs-sync's seen-on-failure, the tour's resize listener, the Notes push Worker's
15-minute read, News's source-less feed and Calendar's count-before-check; the
date parameters' round-trip check.

### Security to consider

- **One origin, many tokens.** Home's Home Assistant token, Mail's and Money's
  Gmail tokens and the family session all live in the same origin's
  localStorage, readable by every app's script (Money reads Mail's by design).
  Any script injection in any app would reach the Home Assistant token. The
  strict CSPs are the defence; keep every app's `connect-src` to the hosts it uses
  (Calendar, Fitness and Podcasts were tightened).
- **Push servers typed by hand get the family session.** Notes (and Mail) accept
  any `*.workers.dev` address as their push server and send it the 400-day family
  token (Mail: its Gmail token). Pin the address in the repo, or have aOS publish
  the family's push server as an owner setting that the apps read.
- Done in the follow-up PR: frame refusal in Home, Podcasts and Weather; Orders'
  backup whitelist (`saneOrder`); Money's CSV formula cells; Home's `#join=` link
  shows the address and asks for a second tap; `safariDemo` escapes its icon
  address; erase clears the `aos_look` cookie; own-key lookups in aOS's error
  words and the shared Russian.

### Condensing worth a PR of its own

- **One sheet module.** The drag-to-close, toast, pill and viewport-fit code is
  repeated nearly verbatim in Calendar, Clock, Drinks, Fitness, Meals, Money,
  Notes, Orders, Places, Podcasts and Travel (about 60 lines each): a
  `home/sheets.js` would save some 250 lines and fix sheet bugs once.
- `esc()` is defined in every app and four core files; `see()`, the
  standalone/iOS/Android checks, `IPSY_APPS` and the LOOKS list are each in two
  to five core files; the FNV `hash()` is in Podcasts, Travel and `parse.js`.
- ~~About 55 lines of unused Design-menu machinery in `welcome.js` and
  `aOS/app.js`.~~ Done (87 lines of `aOS/app.js`); its dead CSS (`.dsel`, `.dbtn`,
  `.dmenu`, `.dtag`, `.dsheet`, `.dgo`, `.dd`) still sits in `aOS/index.html`'s
  Vintage block and the generated looks: drop it with `make-looks.mjs`.
- `b64e`/`b64d` in Notes and Orders use deprecated `escape`/`unescape`
  (TextEncoder, as `server/auth.js`).

### Working together: cross-app improvements

1. **More layers in Calendar.** Meals' dinners, Orders' deliveries and pickups
   (`eta`, `pickupBy`), News' followed teams' fixtures and Clock's wake-up time
   could each share a layer (`AllisonOS.layer.share`, as Mail's reminders do);
   Calendar lists each. Ticking a Notes reminder off from Calendar needs a
   `layer.update` that Notes reads on sync (today it is one way).
2. **Meals to Notes directly.** Copy the list puts the shopping list on the
   clipboard; Notes and Meals share the grocery sections, so a direct import into
   a Notes grocery list (a Notes import slot, or `/sheet/api/notes`) would skip the paste.
3. **Orders to Notes and Places.** "Start a return" could add a dated reminder
   (alerts through Notes push); a pickup, a Travel hotel or a dated Notes
   reminder could become a Places entry (`places/calendar.mjs` `plan()` is generic).
4. **Settings that follow you.** Fitness's goals, Podcasts' settings, Orders'
   kinds and Weather's view are changeable by Ipsy but not synced: add them to
   `aOS/prefs-sync.js` ITEMS and the server's `PREF_ITEM`. Fitness and Drinks read
   Calendar's week start only from local storage; a Home Screen copy never sees it.
5. **Quiet background calls.** Podcasts' feed refresh and Travel's live status and
   calendar fetch go through `account.fetch`, which raises the Face ID sheet for
   anyone signed out, on every open. A `quiet` option (Bearer if any, return the
   401, never prompt) for timers and opens, as Travel's `aiPass(quiet)` does.
6. **Weather from Travel.** A "Trip" place from the person's Travel layer (the
   destination for the trip's days) without saving a city; and Calendar's weather
   could read the synced `wx.places` before asking a new phone for its location.
7. **aOS Home.** Its Calendar widget could show Notes reminders and Travel
   departures already parsed by `home-find.js`; "In your apps" search lacks Mail,
   Fitness, Drinks and Money; Home's Away state could show on Today. Ipsy's `look`
   fallback writes 14 apps' designs where aOS has 16 (Money, Sparkle): use `W.data.APPS`.
8. **Fewer round trips.** Calendar and Fitness each ask `../drinks/api/summary`
   (an Apps Script call); a short shared cache in `home/` halves it. Fitness
   ~~re-serialises 400 days of logs on every persist~~ (done: shared only when
   the log changed). Money should prefer Mail's Gmail token over a silent renew
   of its own. Podcasts could adopt the server's `X-Feed-Url` after a redirect.
9. **Ipsy in Money** (read-only tools through the Money route, reader/viewer
   gated), and `podcasts.cc` and playback speed in Ipsy's settings list.

## Lower priority, not quick

(Done since: the labs passkey test page is gone; the API no longer returns error details; weeks start on Sunday
everywhere, with Monday kept only where it was picked in Calendar; Travel says
"rental car".)

- **Sign-ins last 400 days.** "Sign out everywhere else" (aOS → Your account)
  now ends all of a person's other sessions at once; one phone alone still can't
  be picked out (no per-device list), and sessions don't shorten and renew.
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
