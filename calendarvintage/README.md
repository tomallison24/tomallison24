# Calendar Vintage

[Calendar](../calendar/README.md) in a mid-century modern look, as its own app.
It does everything Calendar does - the iCloud Family calendar in Day, Week,
Month, Year and List, new and edited events with repeats, alerts and time zones,
drag to move, search, and the layers from Notes, Travel, Mail, Fitness, Drinks,
the weather and US holidays - and talks to the same Family calendar. The
features, how it reaches iCloud, the one-off set-up and what could not be
checked are described in `calendar/README.md`; this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass; the month grid, the day and week grids, the year's months,
  the lists and the sheets are all solid cards;
- mustard, teal, burnt orange and olive: the view bar and the week strip have a
  mustard thumb, today is a burnt-orange disc, the new-event button and the
  tick are solid burnt orange, the secondary buttons are outlined teal;
- three atomic shapes behind the title that scroll away with the page, and
  three little bars under it; Futura, which iOS has built in, so no font is
  downloaded.
- **the calendars keep their meaning and take Retro colours**: the Family
  calendar is mustard, US Holidays olive, Notes plum, Travel teal, Mail denim,
  Fitness burnt orange, Drinks rose (each a lighter shade in dark mode). The
  Family calendar is always mustard here: Calendar draws it in the colour iCloud
  has for it, which is not part of this palette. Notes items are plum whatever
  colour their list has in Notes, with the list's name under the title.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Calendar Vintage is drawn this way for everyone:
the style picker in the design canvas is not built.

**The sky.** The page behind the title is Weather Vintage's, with the real sun: by
day a ground washed with mustard, the sun and rays that turn very slowly; after
sunset a ground washed with deep teal, the moon and twinkling stars; each over
cream (Light) or walnut (Dark). Sunrise and sunset come from the same equation as
Weather Vintage's, for the phone's place (kept on the phone, to a tenth of a degree,
and only if the app already has location permission: it never asks), else from the
time zone, and the sky changes by itself while the app is open. It holds still with
reduced motion. `../home/sky.js` does it for every Vintage design and aOS (loaded in
`<head>`, listed in `sw.js`); this app only gives its disc its colour
(`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to its
header. Checked by `aOS/scripts/sky-test.mjs`.

## What is separate from Calendar, and what is shared

It is a second copy of Calendar's page and script, not a setting, so the two can
change independently and Calendar is never touched.

- **Own storage.** Every key is `allison-calendarv-v1-…` (Calendar's is
  `allison-calendar-v1-…`) and the offline cache is `calendarvintage-v2`, so
  each app has its own settings (layers, week start, clock), last-seen events,
  weather and view. A setting changed in one is not changed in the other.
- **The same iCloud Family calendar, through Calendar's own server route.**
  There is no `functions/calendarvintage`: every call goes to `../calendar/api/`
  (`functions/calendar/api`, locked to the signed-in family like Calendar's), so
  the Apple ID, the app-specific password, the `ICLOUD_*` secrets and the News
  workflow's set-up are Calendar's, **done once, nothing new to add**. That
  route is stateless (it holds only a day's cache of where the calendar lives),
  so two apps using it can't disagree. Opening both is safe: reads change
  nothing; an edit sends the event's own etag, so if the other app (or the
  iPhone's Calendar) changed the event first, iCloud refuses the write, the
  app reloads and says so, as it does today; a new event gets its own new file
  name. Events are written the same way by both apps (`ical.js` is the same
  file, checked by `scripts/same-reader-test.mjs`), so an event made or edited
  in one comes out of the other unchanged, and there are no copies. (If you
  use "Add to the Family calendar" on a layer item in both apps, you get two
  events, as you would tapping it twice.)
- **The same layers.** Notes, Travel, Mail and Fitness keep a copy of what
  Calendar shows in your family account (`GET /aOS/api/layer`); both calendars
  read it. Each reads its own storage first where the browser shares the apps'
  (a computer): Travel Vintage's and Fitness Vintage's (`allison-travelv-v1`,
  `allison-fitnessv-v1`), then Travel's and Fitness's. Mail Remind Me days come
  from Mail Vintage's or Mail's Gmail sign-in (`mailv.token`, `mail.token`), the
  weather's place from Weather Vintage's or Weather's (`wxv.…`, `wx.…`), and
  Drinks from your account (`../drinks/api/`), as in Calendar.
  - The account keeps one copy of each layer, written by whichever of Notes,
    Travel, Mail or Fitness (or their Vintage designs) last sent it. Travel
    Vintage keeps its bookings under its own name (`travelv`) so it never
    overwrites Travel's, and `GET layer` shows the two together as Travel: both
    calendars list the bookings of either app, a booking in both once.
- **Opens its layer items in the Vintage apps**: Travel Vintage, Mail Vintage,
  Fitness Vintage and Drinks Vintage (`../travelvintage/`, `../mailvintage/?thread=…`,
  `../fitnessvintage/?date=…`, `../drinksvintage/?date=…`); Notes has no Vintage.
  Both are separate Home Screen apps; whether iOS opens that address inside the
  installed app or in Safari is up to iOS, which treats a link outside an app's
  own folder as a web page (not checked on a phone).
- **Nothing else to set up.** No sign-in address, no token: it needs the same
  family sign-in as Calendar (Face ID, once) and, for the events, the iCloud
  connection Calendar already has.

## Tests

`node calendarvintage/scripts/app-test.mjs` is Calendar's browser test, run on
this app (iCloud and the weather stubbed), plus checks that it is drawn in the
Retro look in light and dark: Futura, flat cream (walnut) cards, a mustard
thumb, an orange new-event button and today, seven different Retro colours for
the calendars and layers, the shapes behind the title; that it keeps its own
storage and cache and calls only `/calendar/api/` and `/aOS/api/`; and that it
reads Travel's and Fitness's storage under their standard keys too (CI:
`apps-check.yml`). `node calendarvintage/scripts/layers-test.mjs` is Calendar's
layers test (Notes, Travel, Fitness and Mail through the family account), run
on this app. `node calendarvintage/scripts/same-reader-test.mjs` checks the
iCalendar reader and writer is Calendar's. The server route's own tests
(`access-test`, `api-test`, `ical-test`) are Calendar's and are not copied.
`node calendarvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg`
(a cream calendar page on denim blue, with a mustard sun and a burnt-orange pill).
