# Calendar

The iCloud **Family** calendar as a home-screen web app, in the same frosted
glass as Mail, Notes, News and Travel, with the everyday parts of iOS Calendar
and Google Calendar, and the other AllisonOS apps' dates alongside.

- **Views**: Day, Week, Month, Year and List, in the bar along the bottom.
  Swipe left or right to move through days, weeks or months; **Today** brings
  you back; tap the big title for the year. In Month, tap a day to see it
  listed underneath, tap it again for the Day view. In Day and Week the
  current time is a red line, and the day opens at 7am (Settings) or at the
  first event. The chosen view sits in a glass thumb that slides across the
  bar to whichever view you tap, stretching on the way.
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
  The editor is a Liquid Glass sheet, as in iOS 26: clear glass floating
  just inside the screen's edges with the calendar blurred through it, glass
  rows and fields, and round ✕ (cancel) and ✓ (add or done) buttons.
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
    colour, with **Open in Notes**.
  - **Travel**: flights (departure to arrival), hotels (check-in to
    check-out, all-day) and car pick-ups and returns, with **Open in Travel**.
  - **Mail**: Remind Me days, as all-day items, using Mail's own Gmail
    sign-in (opened from Home, the apps share it); each opens the
    conversation in Mail.
  - **Weather**: a forecast line on each day for the next 16 days, from
    Open-Meteo (as the Weather app uses), with the phone's location. °F or
    °C follows the phone's language, or set it.

  Any layer item has **Add to the Family calendar**, which opens the editor
  with it filled in.
- **Settings**: the iCloud connection and a **Check for changes now** button,
  the layers, week starts on Monday or Sunday (Monday by default), 12- or
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

## How it's built

- **No build step.** `index.html` is the page and its look (Notes' style
  block, unchanged, plus Calendar's own pieces at the end), `app.js` the app,
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
  anywhere but iCloud.
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node calendar/scripts/ical-test.mjs   # reading, writing, repeats, zones
node calendar/scripts/api-test.mjs    # the CalDAV function, iCloud stubbed
node calendar/scripts/app-test.mjs    # the app in headless Chromium, iCloud stubbed
node calendar/scripts/make-icons.mjs  # redraws icon-512.png and icon-180.png from icon.svg
```

The last two need Playwright with Chromium (`npm i -g playwright`).

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
