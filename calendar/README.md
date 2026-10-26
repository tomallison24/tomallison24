# Calendar

The iCloud **Family** calendar as a home-screen web app, in a mid-century
Vintage design or the same Sea glass as Mail, Notes, News and Travel (below),
with the everyday parts of iOS Calendar and Google Calendar, and the other
AllisonOS apps' dates alongside.

- **Views**: Day, Week, Month, Year and List, in the bar along the bottom.
  Swipe left or right to move through days, weeks or months; **Today** brings
  you back; tap the big title for the year. In Month, tap a day to see it
  listed underneath, tap it again for the Day view. In Day and Week the
  current time is a red line, and the day opens at 7am (Settings) or at the
  first event. The chosen view sits in a glass thumb that slides across the
  bar to whichever view you tap, stretching on the way; the chosen day in the
  Day view's week strip and the choices in Settings slide the same way.
- **Events**: tap one for its details: when, how it repeats, the place (opens
  in Maps), travel time, alerts, URL, notes, and who was invited. **Edit** and
  **Delete Event** are there for Family events. A repeating event asks whether
  the change is for **this event only**, **all future events** or **all
  events**, as iOS does.
- **New event** (the + button, or tap an empty time in Day or Week): title,
  location, all-day, start and end, time zone, repeat (daily, weekly, every 2
  weeks, monthly, yearly, or custom: every N days/weeks/months/years, on
  chosen weekdays, on a day of the month or the nth weekday; ending never, on
  a date, or after so many times), travel time, two alerts, busy or free,
  URL and notes. New events get a 15-minute alert (Settings changes it).
  The editor, an event's details, Settings and the this-or-all choice are
  Liquid Glass sheets, as in iOS 26: clear glass floating just inside the
  screen's edges with the calendar blurred through it, glass fields and
  switches, and round ✕ (cancel or close) and ✓ (add or done) buttons. The
  rows in them, like every card (the month grid, the lists), are very faint
  flat tiles, the same in every AllisonOS app. The toast (with Undo) is the
  same clear glass as the sheets.
- **Drag** an event in Day or Week to move it (press and hold first on a
  phone), or drag its bottom edge to make it longer or shorter. Times snap to
  15 minutes; in Week you can drag to another day.
- **Search** (the magnifier): titles, places and notes of everything loaded.
- **Layers**, each with an On/Off switch in Settings:
  - **US Holidays**: federal holidays (with the observed day when one falls
    on a weekend) and the usual observances (Valentine's, St Patrick's,
    Easter, Mother's and Father's Day, Halloween, Thanksgiving and Black
    Friday, Christmas Eve, New Year's Eve, the clock changes). Worked out on
    the phone; nothing is fetched.
  - **Notes**: reminders with a date, and notes with a nudge, in their list's
    colour (plum in Vintage), with **Open in Notes**. A reminder's sheet has **Mark
    as done** (or **not done**): shown so here at once, and written to the family's
    Notes through its Sheet (`home/sheet.js` `AllisonOS.sheet.notes`, signed in),
    with Undo in the toast; Notes picks it up on its next open.
  - **Travel**: flights (departure to arrival), hotels (check-in to
    check-out, all-day) and car pick-ups and returns, with **Open in Travel**.
  - **Mail**: Remind Me days, as all-day items; each opens the
    conversation in Mail.
  - **Meals**: the family's plan, each meal an all-day item ("Dinner:
    Lasagna"), with **Open in Meals** (that day's recipe).
  - **Orders**: each open order's day as an all-day item ("Arrives: Target",
    "Delivery window ends", "Pick up by", "Return by"), with **Open in Orders**
    (the order's sheet).
  - **News**: the fixtures of the teams you follow, two hours each, with
    **Open in News** (the match page, or Scores).

  On an iPhone every Home Screen app keeps its own storage, so Notes, Travel,
  Fitness, Mail, Meals, Orders and News each keep a copy of just what Calendar shows in your own
  family account (`AllisonOS.layer` in home/welcome.js, `POST /aOS/api/layer`),
  sent when their data changes and only if it did. Calendar reads yours with
  `GET /aOS/api/layer`; only you can read it. Each app has to be signed in to
  the family account once (it asks after its walkthrough). Where a browser does
  share the apps' storage (a computer), Calendar uses that first.
  - **Fitness**: each day's workout as one all-day item ("Workout ·
    Shoulders, Core"), with the exercises and their sets, reps and weight
    in its details, and **Open in Fitness**, which opens that day.
  - **Drinks** (off until you turn it on): your own standard drinks each day,
    and alcohol-free days, read from your family account
    (functions/drinks/api), so it works from Calendar's own icon too. Only
    you see it: it is kept in memory, not in Calendar's storage, and has no
    **Add to the Family calendar**. **Open in Drinks** opens that day.
  - **Weather**: a forecast line on each day for the next 16 days, from
    Open-Meteo (as the Weather app uses), with the phone's location. °F or
    °C follows the phone's language, or set it.

  Any layer item but Drinks has **Add to the Family calendar**, which opens
  the editor with it filled in.
- **Settings**: the design (below), the iCloud connection and a **Check for changes now** button,
  the layers, week starts on Sunday or Monday (Sunday by default), 12- or
  24-hour time, temperature units, when the Day view opens, and the length
  and alerts of new events.
- **Offline**: the events last seen are kept on the phone, so the calendar
  opens at once and can be read offline; changes need the connection.
- **The other apps write here**: Travel's **Add to calendar** (a trip or a
  booking) and Notes' **Add to calendar** (a reminder) put the event straight
  into the Family calendar where the site is on Cloudflare, instead of
  saving a calendar file. Where it isn't, they save the file as before.

Alerts are the phone's own: an alert saved here is saved into the event in
iCloud, and the iPhone's Calendar does the alerting, as it does for anything
in the Family calendar. Notifications from this app itself are a later step.

## The two designs

One app, one calendar: the design changes only how Calendar looks, at once, and
is kept on this phone (**Settings → Design**, the first section), as in Clock.
`../home/design.js`, loaded in `<head>`, applies it before the page is drawn.
Every view, sheet, drag and swipe works the same in both.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas. A cream ground and cards (walnut in dark mode), flat
  and round-cornered, in place of glass: the month grid, the day and week
  grids, the year's months, the lists and the sheets are all solid cards;
  mustard, teal, burnt orange and olive (the view bar and the week strip have a
  mustard thumb, today is a burnt-orange disc, the new-event button and the
  tick are solid burnt orange, the secondary buttons are outlined teal); three
  atomic shapes behind the title that scroll away with the page, and three
  little bars under it; Futura (built into iOS, nothing downloaded).
  **The calendars keep their meaning and take Retro colours**: the Family
  calendar is mustard, US Holidays olive, Notes plum, Travel teal, Mail denim,
  Fitness burnt orange, Meals walnut, Orders aqua, News sage, Drinks rose (each a lighter shade in dark mode). The
  Family calendar is always mustard here, not the colour iCloud has for it,
  which is not part of this palette; Notes items are plum whatever colour their
  list has in Notes, with the list's name under the title (`app.js` picks these
  by the design and draws again when it changes).
  Behind the title is the shared **Vintage sky** (`../home/sky.js`, as in every
  Vintage design): by day a ground washed with mustard, the sun and rays that
  turn very slowly; after sunset deep teal, the moon and twinkling stars, over
  cream (Light) or walnut (Dark), for the phone's place (to a tenth of a
  degree, and only if the app already has location permission: it never
  asks), else its time zone; it changes by itself while the app is open and
  holds still with reduced motion. This app only gives its disc its colour
  (`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to
  its header (checked by `aOS/scripts/sky-test.mjs`).
- **Standard**: Sea glass: Notes' style block, unchanged, plus Calendar's own
  pieces, frosted glass and Liquid Glass sheets as described above, the Family
  calendar and Notes lists in their own colours, no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The choice is `localStorage` `design.calendar`. What iOS reads when
Calendar is added to the Home Screen follows it: the icon (`icon-180.png`,
Vintage: a cream calendar page on denim blue with a mustard sun and a
burnt-orange pill; `icon-glass-180.png`, Standard), the status bar style
(`default` in Vintage, where `black-translucent`'s white clock would vanish on
the cream) and the bar colours.

**The old Calendar Vintage app.** Calendar Vintage used to be an app of its own
(`calendarvintage/`, with its own storage, `allison-calendarv-v1-…`). Its
address now opens this same app (the deploy copies `calendar/` there,
`.github/workflows/news.yml`), so a phone that added it keeps it. The first time
it opens there, `design.js` moves that app's data on the phone over to
Calendar's names (`allison-calendarv-…` → `allison-calendar-…`: settings,
last-seen events, weather, view; and what it had seen, so no walkthrough
again), unless Calendar already has data on that phone; nothing old is
deleted. It had no IndexedDB. Its calls already went to `../calendar/api/`, as
Calendar's now do from either address, so the iCloud connection is the same
one, with nothing to set up. Its layer items opened the old Vintage apps
(`../travelvintage/` and the rest); they now open Travel, Mail, Fitness and
Drinks, which carry both designs too.

## Ipsy

**Ipsy** is your helper (the one you picked and named) in the dock, beside the + button: a helper you
chat with about the calendar, in the design picked in Settings (it changes with
the design at once). Ask in your own words, e.g. *What's on this week?*, *Find
us a free evening next week*, *When is our next dentist appointment?*, *Add
piano on Saturday at 4*, *Move the dentist to 3:30*, *What can you change
here?*

- **Reading is free.** It reads what the app shows: the Family calendar and the
  layers that are on (US Holidays, Notes, Travel, Mail, Fitness, Meals, Orders, News), and the
  weather (`ipsy-tools.js`: `find_events` for a range of days or words in a
  title, place or notes, `get_event` for one in full, `free_time` for the gaps
  in a day, `show_day` to open a day behind the chat). Not Drinks: that is your
  own health data, which the app keeps out of its own storage, so it isn't
  sent to Claude either. When you ask about days outside the months the app
  has loaded, the calendar moves there to load them.
- **The Family calendar is the whole family's, so changes have rules**, and
  Ipsy explains them if you ask:
  - **Every change asks first.** Adding, changing or deleting an event shows a
    card in the chat with exactly what will happen: the title, the day, start
    and end, all day or not, repeat, the calendar, and for a change what each
    was before (*2:00 PM → 3:30 PM*). Nothing is written until you tap **Yes**;
    on **No** nothing changes and Ipsy is told you said no.
  - **One event at a time.** Each change is one event (there is no way to
    change or delete many at once), and Ipsy asks about at most **5 changes in
    one question**; a sixth is refused without a card, and you ask again for
    the rest.
  - **Repeating events are read only** for Ipsy: it won't change or delete a
    series or one occurrence of it, and tells you to do that in the app (tap
    the event, then Edit or Delete Event), where you choose this event, all
    future events or all events. It can add an event that repeats (every day,
    week, 2 weeks, month or year, with an optional last day), asked first like
    any other.
  - **Only the Family calendar** is changed: holidays, reminders, trips,
    Remind Me days and workouts come from other apps, and Ipsy says where to
    change them.
  - **Never over someone else's change.** Writes go through the app's own
    calls to its server with the event's version (If-Match, as the editor
    does), so if someone changed the event on another phone meanwhile, iCloud
    refuses, the app loads the new version, and Ipsy tells you nothing was
    written over.
  - **Undo** on every change in the chat, through the same calls: an added
    event is deleted (only if nobody changed it since), a changed one is put
    back as it was, a deleted one is written back (only if nothing has taken
    its place). A change made since is never written over: the Undo says so in
    the app's message at the bottom of the screen.
- **Private events are hidden from Ipsy.** The **Private** switch in an event
  marks it in iCloud (`X-AOS-PRIVATE:TRUE`, so every phone knows; an event
  marked private by another calendar app, `CLASS:PRIVATE`, counts too), and
  this phone keeps a copy of the mark in case another app drops it. Ipsy
  doesn't see a private event or change it; looking for free time, it only
  knows that time is taken ("Private"). Private notes and Travel bookings in
  the layers are hidden the same way, and so are the emails behind private
  bookings. **Settings → Gmail for Ipsy → Turn off Gmail for Ipsy** turns
  Ipsy's Gmail off altogether, on this phone.
- **Event text is material, not instructions.** Titles, places and notes are
  written by whoever made the event (or an invitation from outside); Ipsy is
  told never to act on what they say, and to mention it if one asks it to do
  something.
- **How it works.** The chat lives on the phone. Each step sends the whole
  conversation to the family server (`functions/calendar/api`, `POST ipsy`),
  which adds Ipsy's instructions and tools and asks **Claude Sonnet 5.5**
  (medium effort, prompt caching on, Anthropic's server-side fallback if it
  declines). Ipsy's tools run on the phone, on the events the app has loaded;
  the server sees only the conversation and keeps only a count of questions
  (80 a person a day). Web search and web pages run at Anthropic.
  `CALENDAR_IPSY_MODEL` (optional repository secret) names another model.
- **Asked first, once.** Before the first question, Ipsy says what is sent
  where. **For signed-in family** (Face ID); without the key it says Ipsy
  isn't set up.
- **New chat** (top of the chat) starts over; a chat is kept on the phone
  until then.
- **Not tried against the real API, iCloud or on a phone**: the tests use a
  stand-in for Claude and for the iCloud function (`node
  calendar/scripts/ipsy-test.mjs`, `node calendar/scripts/api-test.mjs`), so the
  first real questions are the real test of the instructions. The chat's Undo
  doesn't wait for iCloud's answer: a failed Undo shows in the app's message,
  while the chat already says Undone.

## How it reaches iCloud

A web page can't talk to iCloud's calendar server (CalDAV) itself: Apple's
server refuses pages from other sites, and the password would have to sit on
the phone. So a small **Cloudflare Pages Function** on this site
(`functions/calendar/api/[[route]].js`) does it, holding the Apple ID and an
**app-specific password** as Pages secrets that never reach a phone. It finds
the Family calendar in the account (three CalDAV lookups, remembered for a
day), lists the events in a time range, and writes or deletes one event at a
time, refusing to write over an event that changed in the meantime (the app
then reloads and says so). As with Travel's flight status, this works only on
the **Cloudflare** copy of the site; on the GitHub Pages copy the app says so
and the layers still show.

Both phones use the same connection, so events made in the app show as made
by whichever Apple ID the password belongs to. The calendar itself is the
shared one, so the phone's own Calendar app sees every change within
moments, and changes made there appear here the next time the app checks:
when it opens, when it comes to the front, every three minutes while open,
and after every save.

## Set up (once, about five minutes)

1. **An app-specific password.** Sign in at
   [account.apple.com](https://account.apple.com) with the Apple ID that has
   the Family calendar → **Sign-In and Security → App-Specific Passwords → +**
   → name it "AllisonOS Calendar" → copy the password (`xxxx-xxxx-xxxx-xxxx`).
   Either family member's Apple ID works, as long as the Family calendar is
   in it; the events the app makes will show as made by that person.
2. **The secrets.** In this repository: **Settings → Secrets and variables →
   Actions → New repository secret**, twice:
   - `ICLOUD_APPLE_ID`: the Apple ID's email address
   - `ICLOUD_APP_PASSWORD`: the password from step 1

   If the calendar isn't called "Family", add a third, `ICLOUD_CALENDAR`,
   with its name.
3. **Deploy.** Run the **News** workflow (Actions → News → Run workflow) on
   `main`. It hands the secrets to the Cloudflare Pages project and
   redeploys. Settings in Calendar then says **Connected to the Family
   calendar**.

If Settings says iCloud refused the password, make a new app-specific
password and update the secret (Apple cancels them when the Apple ID's
password changes). If it says no calendar of that name, it lists the names
it found; set `ICLOUD_CALENDAR` to one of them.

## Locking the server functions

Everything under `/…/api/` (this app's iCloud connection, Travel's flight
status, Podcasts' feed fetcher, Weather's radar run time) runs on Cloudflare
with the owner's secrets. Cloudflare Access in front of the site is what keeps
strangers out; `functions/_middleware.js` adds a second lock in the functions
themselves, so they refuse any `/api/` request without a valid Access sign-in
even if Access were ever off for some address (the `….pages.dev` one, a
preview deployment).

It is **off until you give it two values**, then on for every deploy after:

1. Cloudflare dashboard → **Zero Trust → Access → Applications** → the
   application in front of the site → **Overview**: copy the **Application
   Audience (AUD) Tag**.
2. Your team domain is `https://<team>.cloudflareaccess.com`, where
   `<team>` is your Zero Trust team name (shown in Zero Trust's settings; it
   is also the address of the sign-in page Access shows you).
3. GitHub → the repository → **Settings → Secrets and variables → Actions →
   New repository secret**: `ACCESS_AUD` (the tag) and `ACCESS_TEAM_DOMAIN`
   (the team domain, with `https://`).
4. Re-run the News workflow (or wait for the next run). From then on, an
   `/api/` request without a valid sign-in gets `403 {"error":"access"}`.

While you're there, check the Access application covers **both**
`tomallison24-news.pages.dev` and `*.tomallison24-news.pages.dev`, as well as
any custom domain.

The check is Cloudflare's own (as in its Access plugin for Pages): an RS256
token from the `Cf-Access-Jwt-Assertion` header, signed by a key from the
team's `/cdn-cgi/access/certs`, with this team as issuer, this application in
its audience, and not expired. `node calendar/scripts/access-test.mjs` tests
it with a key of its own.

## How it's built

- **No build step.** `index.html` is the page and its two looks (Notes' style
  block, unchanged, plus Calendar's own pieces, then the Vintage block),
  `app.js` the app,
  `ical.js` the iCalendar reading and writing, `sw.js` the offline shell.
- **`ical.js`** reads and writes the `.ics` text iCloud keeps for each event
  (RFC 5545), keeping everything it doesn't understand, so an event made on
  an iPhone survives an edit here with Apple's own fields intact. It works
  out when repeating events happen (DAILY, WEEKLY, MONTHLY and YEARLY rules
  with intervals, counts, end dates, weekdays, days of the month and set
  positions; skipped and changed occurrences), and handles time zones from
  the browser's own tables, writing the VTIMEZONE block iCloud expects.
- **Security as in Mail and Travel**: a Content Security Policy that only
  runs these files, it refuses to run in a frame, and the function only
  answers requests carrying the app's header, only talks to `*.icloud.com`,
  checks every file name, and only writes what looks like a calendar file.
- **Data**: the events last seen (`localStorage`), the settings, the weather
  and the Mail reminders for a while. Nothing about the events is sent
  anywhere but iCloud, except what Ipsy looks at when you ask it something (above).
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node calendar/scripts/ical-test.mjs   # reading, writing, repeats, zones
node calendar/scripts/api-test.mjs    # the CalDAV function, iCloud stubbed; Ipsy's step, Claude stubbed
node calendar/scripts/access-test.mjs # the Access check in front of every function
node calendar/scripts/app-test.mjs    # the app in headless Chromium, iCloud stubbed, both designs, Settings > Design, the old Calendar Vintage address
node calendar/scripts/layers-test.mjs # Notes, Travel, Fitness and Mail through the family account
node calendar/scripts/ipsy-test.mjs   # Ipsy and its rules (asks first, 5 a question, no repeating events, etags, Undo), both designs, light and dark
node calendar/scripts/make-icons.mjs  # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```

The last four need Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

This was built where iCloud could not be reached, so:

- **iCloud's CalDAV replies** were not seen live. The function follows RFC
  4791 and the shape of iCloud's responses as widely documented (the
  redirect from `caldav.icloud.com` to a numbered server, the principal →
  calendar home → calendars lookup, the `calendar-query` report); the tests
  run it against those shapes. The first real connection is the real test:
  if Settings shows an error, its words say which step failed.
- **Whether iCloud returns an ETag on writes.** If it doesn't, the app
  refreshes straight after each save to learn it; the write itself is fine
  either way.
- **Invitations.** Events with invitees show who was invited; the app does
  not send invitations (iCloud's scheduling over CalDAV was left out on
  purpose for now).
- **Safari on an iPhone** was not tested; the app was checked in Chromium at
  iPhone size, light and dark, with touch.

## Gmail in Ipsy

Connect Gmail in Calendar Settings > Gmail for Ipsy. Access is read-only with Gmail search syntax and pagination. Ipsy asks separately before email details go to Claude; results remain in the local chat until New chat. Tokens stay in sessionStorage and expire within about an hour. Disconnect clears this sign-in and Calendar Ipsy chat, not Mail or Orders authorization. Attachments are skipped and links redacted, never opened. Calendar changes retain their confirmations.

The production origin must be in the existing Google OAuth client Authorized JavaScript origins; preview origins require separate authorization. Real Google consent and installed iPhone Safari still need device verification.
