# aOS upgrades, app by app

What the platform audit of October 25, 2026 recommended for each app, beyond the
bugs and security fixes it made (those shipped in aOS2.2, PRs #394 and #395;
`BACKLOG.md` keeps the platform-wide items: one origin's tokens, hand-typed push
servers, the shared sheet module). Each item says what the family would get,
and where the change goes. None is started unless marked. Strike an item
through when it ships, and say which release.

The thread running through them: the apps are meant to work as one. Most
upgrades below are one app telling another what it already knows (a Calendar
layer, a Notes reminder, a synced setting), through the ways that already exist:
`AllisonOS.layer.share` (Mail and Notes use it), `aOS/prefs-sync.js` with the
server's `PREF_ITEM`, `functions/sheet/api`, and Ipsy's tools.

## aOS (the home, `aOS/`, `home/`)

1. **Home's Calendar widget shows reminders and departures.** `aOS/home-find.js`
   `next()` reads only the Family calendar; Notes' dated reminders and Travel's
   next departure are already parsed for search (`SOURCES.notes`, `SOURCES.travel`).
   "Then · Call mom" and "Flight at 6:40" on Home, matching what Calendar's layers show.
2. **"In your apps" search covers Mail, Fitness, Drinks and Money.** A `SOURCES`
   entry each in `home-find.js` (Mail's reminders, Money's recurring charges), plus a
   `?open=` deep link in the app.
3. **A notification tap lands on the right screen.** `aOS/sw.js` and `app.js` only
   route `#whats-new`; `push/send` already carries any same-site `url`. Routing
   `#subscription`, `#lost-phone` and `#app=<id>` through the same `aosGo` message
   lets Fitness's vitals alert (and a future "plan ending" notice) open where it should
   when aOS is already open.
4. ~~**Settings Ipsy can change follow you to your other devices.**~~ Done (aOS2.2): Fitness's step and move goals, Podcasts' settings, Orders' kinds and Weather's view sync
5. ~~**Quiet background calls.**~~ Done (aOS2.2): `account.fetch(url, opts, { quiet: true })`; Podcasts and Travel use it for everything nobody tapped for
6. **Backlog 8 still stands:** a "Sign in to show Drinks / share with Calendar" row in
   an app once `aos.signin.asked` is final (welcome.js can't ask again by design).
7. **Home (the house) on Today.** Home's "Running now" and Away/Eco state, shared as a
   small summary through the family account, would let Today lead with "Away ·
   thermostats in Eco" without opening Home (`aOS/home-tab.js` reads it).
8. **Devices with access in Account.** Home lists this Home Assistant user's tokens
   and can revoke them (`house/app.js` ACCESS); the same list under aOS's Account would
   let a lost phone's token be revoked from any device.
9. Code health: `esc()` is defined in four core files and most apps; `see()`, the
   standalone/iOS/Android checks, `IPSY_APPS` and the LOOKS list are each in two to
   five core files; `~55` lines of dead Design-menu CSS (`.dsel`, `.dbtn`, `.dmenu`,
   `.dtag`, `.dsheet`, `.dgo`, `.dd`) remain in `aOS/index.html`'s Vintage block and
   the generated looks (drop with `make-looks.mjs`).

## Calendar

1. **More layers.** ~~Meals, Orders and News~~ done (aOS2.2); Clock's wake-up time (see
   Clock) still open: Calendar lists a layer in `LAYER`/`rebuild`, `functions/aOS/api` in `LAYERS`.
2. **A reminder ticked off from Calendar.** The Notes layer is one way; an
   `AllisonOS.layer.update('notes', id, { done: true })` that aOS stores and Notes reads
   on sync would let the family finish a reminder from Calendar's day view (and Ipsy).
3. **Weather without asking for your location.** `loadWeather` asks the phone for
   geolocation on every open until answered when Weather left no `wx.*` place;
   `wx.places` is synced by aOS, so read `wx.places[0]` first: a smoother first run on
   a second device. `calendar/app.js` only.
4. **One Drinks summary for Calendar and Fitness.** Both ask `../drinks/api/summary`
   (an Apps Script round trip, the slowest thing either waits on); a short-lived shared
   cache in `home/` (`AllisonOS.drinks.summary(from, to)`) halves it.
5. Code health: the `st.api` error-code expression is repeated three times.

## Clock

1. **Wake-up time on the calendar.** The Sleep schedule's wake-up could be a Calendar
   layer item ("Wake Up 6:30") through `AllisonOS.layer.share('clock', …)`. Low value for
   the effort; listed for completeness.
2. Clock's alarms, cities and settings already follow you (prefs sync); nothing else found.

## Drinks

1. **Week start from the family account.** Drinks (and Fitness) read Calendar's week
   start from `allison-calendar-v1-settings`; inside aOS the apps share storage, but a
   Drinks added from its own page never sees it and falls back to Sunday. Ask the family
   account's prefs when local storage has none.
2. **"See in Calendar" from a day.** Calendar links to `../drinks/?date=`; the day
   sheet could link back to `../calendar/?date=YYYY-MM-DD&view=day` (Calendar accepts it
   already). New words, so Russian too.
3. After a successful sign-in, call `renderMore()` so the account row shows "Syncing…"
   at once.
4. Code health: the IndexedDB "keep" hand-over helper (17 lines) is identical in Drinks
   and Fitness and removable once every phone has handed over.

## Fitness

1. **Week start from the family account** and **"See in Calendar"**: as Drinks, 1 and 2.
2. ~~**Goals that follow you.**~~ Done (aOS2.2): step and move goals sync.
3. ~~`shareCal` re-serialised 400 days of logs on every persist.~~ Done in #395: the
   layer is shared only when the log changed.
4. Health data stays out of web searches by design (Fitness's Ipsy has none); keep it so.

## Home (the house, `house/`)

1. **Home's state on aOS Today** and **Devices with access in Account**: aOS, 7 and 8.
2. The HA token lives in the phone's localStorage, readable by every app's script;
   the strict CSPs are the defence (`BACKLOG.md`, "One origin, many tokens").
3. Code health: `house/app.js:1362` and `heaters.js:111` do string surgery on `svg()`'s
   output; an `extra` parameter on `svg()` removes both.

## Mail

1. **Notifications one tap away.** `PUSH_URL` is empty, so every phone pastes the
   Worker address (and any `*.workers.dev` address is then sent the Gmail token). Fill
   the constant once the Worker is deployed, or serve it from `functions/aOS/api`.
2. **Mail and Money share one Gmail sign-in** (see Money, 1).
3. `fetch(pushUrl() + '/key')` has no timeout or `r.ok` check.
4. Code health: `ICON.tag` and `ICON.label` are identical SVGs.

## Meals

1. ~~**Dinners on the family calendar.**~~ Done (aOS2.2): every meal of the plan, by day; `?date=` opens the day's recipe
2. **The shopping list straight into Notes.** "Copy the list" goes through the
   clipboard; Notes' grocery lists use the same `home/aisles.js` sections, so a direct
   import into a Notes grocery list (a Notes import slot, or `/sheet/api/notes`) would
   skip the paste and keep ticks in step in the store.
3. Confirm aOS validates a Sheet address handed over by Meals' `#sync=` link (the
   `adopt` path) against `script.google.com`.

## Money

1. **One Gmail sign-in with Mail.** Money reads `mail.token` inside aOS but keeps its
   own OAuth flow; when its own token expires it bounces the whole aOS window to Google.
   Prefer Mail's token when present and skip Money's silent renew. Money only.
2. **Ipsy's chat has arrived** (#393); its tools are read-only through the Money route,
   reader/viewer gated. Nothing further from the audit.
3. `s.reader` at `money/app.js:679` is always false there (the server guarantees
   reader ⇒ can): decide the intent, then condense. Input ids with spaces (`cardKey`),
   cosmetic.

## News

1. ~~**Followed teams' fixtures on the calendar.**~~ Done (aOS2.2): the next two weeks, two hours each; `?sport=scores` or a match page opens from Calendar
2. **Ipsy's `find_stories`** could take lists of sources and topics.
3. Code health: double `store.get` per line at `news/app.js:92-97`; the "Updated" pill
   fingerprint (16 lines) is duplicated in Notes and Orders (belongs in `welcome.js`).

## Notes

1. **Two-way with Calendar** (Calendar, 2).
2. **"Add to Places" from a dated reminder.** Places and Notes share one Sheet; a
   Notes Ipsy tool or a `home/` helper writing a place row through `/sheet/api/places`
   (Photon lookup exists in Places).
3. **Alerts for Calendar events too.** The push Worker only knows Notes' Sheet; the same
   Worker (or aOS's push) could alert for Calendar events with a Notes-style `alert`.
4. **Push server pinned** (`BACKLOG.md`): today any `*.workers.dev` address typed by the
   person is sent the 400-day family session.
5. `/refresh` on the Worker is callable by anyone who knows a phone's opaque push
   endpoint; low risk, a per-id rate limit if it matters.
6. Code health: `b64e`/`b64d` use deprecated `escape`/`unescape` (TextEncoder, as
   `server/auth.js`); two `toLocaleTimeString([], …)` remain where `'en-US'` is the rule.

## Orders

1. ~~**Deliveries and pickups on the calendar.**~~ Done (aOS2.2): arrivals, delivery windows, pickup deadlines and return days; `?open=` opens the order
2. **"Start a return" adds a Notes reminder** ("Drop off the Amazon return by Nov 19"),
   which alerts the phone through Notes push: `/sheet/api/notes` with one todo works
   today; a helper in `home/sheet.js` would make it clean.
3. **Pickups as Places.** A store pickup (and a Travel hotel) is a place the family
   went; `places/calendar.mjs` `plan()` is generic enough to feed.
4. Ipsy's `create_order` ignores `kindOn`: a `food` order it adds is hidden when Food is
   off (the result says `hiddenBySettings`); toast it or turn the kind on.
5. Code health: `saneOrder` could also run over the Sheet's `res.orders` (one line).

## Places

1. **From Notes, Travel and Orders** (Notes 2, Orders 3): places the family plans or
   went, without typing them.
2. `places/scripts/from-calendar.mjs` exits 0 with "Not set up yet": a `::notice::`
   would make it visible in Actions (`BACKLOG.md`).

## Podcasts

1. ~~**Quiet feed refresh**~~ Done (aOS2.2).
2. **Adopt the server's `X-Feed-Url`** (the final address after redirects) into the
   follow, as `itunes:new-feed-url` is, so a moved host keeps working after its redirect stops.
3. **Ipsy settings:** `podcasts.cc` (Top shows country) and playback speed in
   `home/ipsy.js` SETTINGS (the skip and auto-play settings are there).
4. `fetchFeed` still tries a direct browser fetch after a real server error (a slower error).
5. Code health: `openShow`/`retryShow` repeat; the FNV `hash()` is in Podcasts, Travel
   and `parse.js`.

## Travel

1. **Live UTC once known.** When `refreshLive` has a leg, `departure.scheduled.utc` is
   the true moment: feed it into `startT`/`endT` and the Calendar layer's `depIso`, so the
   countdown, "Now", the live window and Calendar are right for text-read bookings even
   when the phone is in another zone. `travel/app.js` only.
2. ~~**Quiet live status and calendar fetch**~~ Done (aOS2.2).
3. Offset-less wall times are read as the phone's zone (documented); countdowns are off
   while away until 1 lands.
4. Code health: `parse.js` `tWin` alias and `utc()` readability (any `parse.js` change
   forces a `QUERY_V` bump: a year's Gmail re-read on every phone, so batch them).

## Weather

1. **Weather for where you're going.** aOS holds each person's Travel layer (upcoming
   bookings with `to`, `city`, `checkIn`); a "Trip" place (the destination for the trip's
   days) without saving one of the 12 cities. `weather/app.js` reads the layer through
   `account.fetch`, signed in only; `P.AIRPORTS` city names are in `travel/parse.js`.
2. ~~**`wx.view` follows you**~~ Done (aOS2.2).
3. Dates in Weather, Mail, Travel, Notes, Podcasts, Places and Home show in the phone's
   own format; US on a US phone (`BACKLOG.md`).

## Every app with sheets

The drag-to-close, toast, pill and viewport-fit code is repeated nearly verbatim in
Calendar, Clock, Drinks, Fitness, Meals, Money, Notes, Orders, Places, Podcasts and
Travel (about 60 lines each). One `home/sheets.js` would save some 250 lines and fix
sheet bugs once; its own PR, with every app's browser test.
