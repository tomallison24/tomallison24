# Places

Where you want to go and where you've been, as a home-screen web app, in two
designs (below): Vintage, mid-century modern, the default; and Standard, the
same frosted glass as the other AllisonOS apps.

- **Two lists**: **Want to go** and **Been**, switched at the top. Opening a
  place and tapping **Been** moves it across (with today as the day you went,
  which you can change).
- **Your own details** for each place: a **rating** (1–5 stars, once you've
  been), **price** ($–$$$$), a **date** (Planned for, for an event or a
  booking; Went on, once you've been), and **notes** with `#tags`
  (`#brunch`, `#date-night`), which become filters at the top.
- **Every visit**: a place keeps each day you went. **Went again today** adds
  one (changing Went on corrects the latest instead); the place shows "Been 3
  times. Before that: …", and the list shows **3×**.
- **From your calendar**: dinners, drinks, shows and museum trips in the
  Family calendar are added by themselves (below).
- **Sorting**: Want to go by **Soonest** (dated plans first, grouped into
  Coming up / Someday / Date passed), **Nearest** or **Newest**; Been by
  **Recent**, **Top rated** or **Nearest**.
- **The search box** at the top finds your places by name, type, address,
  notes or `#tag`, and, from three letters on, businesses on OpenStreetMap
  too, listed under **Businesses** after your own (nearest first); tap one to
  add it. On the map it searches around where the map is looking: results
  drop down under the box, and tapping one flies the map there and opens its
  card.
- **Opens on the map**, with **your places listed beside it**: a drawer along
  the bottom with the Want to go or Been list (whichever is picked, with the
  same search and `#tag`): the places on the map first, nearest its middle,
  then **Further away** and **No pin**, redrawn as the map moves. Pull its head
  up or down, or tap it, between a peek (one place), half the screen and
  nearly all of it, kept on the phone; the map's buttons and + sit above it.
  Tapping a place flies the map to its pin (it pulses) and opens it. The list
  button (top right) still switches to the full list, with its sorting, and
  back. After you add a place, Places goes back to the map, on the list
  the place went into, with the search cleared and the new pin in the middle.
- **Map**: your places as pins, blue for Want to
  go and gold for Been (teal and mustard in Vintage), each with its emoji. **Touch and hold** anywhere on the
  map to add a place there. Buttons to show where you are and fit every pin.
- **Businesses on the map**: zoomed in to street level, every named business
  OpenStreetMap has in view shows as a small dot: coral for **Food & drink**
  (restaurants, cafés, bars, pubs, bakeries, breweries), violet for **Things
  to do** (museums, galleries, theatres, cinemas, attractions, zoos, bowling,
  stadiums, landmarks), teal for **Shops** (every other shop); in Vintage
  burnt orange, olive and walnut. The chips at
  the top switch each group on or off (Shops starts off, so the map isn't
  crowded). Tap a dot for its card (type, cuisine, today's hours) with **Want
  to go**, **Been** and **Directions**; once saved, its dot becomes your pin.
  Further out than streets, a note says to zoom in. They come from the
  Overpass API, a box a little larger than the screen at a time, and are kept
  for the visit, so panning back costs nothing.
- **Adding a place** (the + button):
  - **Search** by name, type or address ("tacos", "Denver Art Museum"),
    nearest first once Places knows where you are;
  - **Add where I am**;
  - **Paste a map link**: in Apple Maps or Google Maps, Share → Copy, then
    this. Long links carry the place's position and name. Short links
    (`maps.apple/p/…`, `maps.app.goo.gl/…`) only redirect, which a web app
    can't follow, so Places says so; search by name instead;
  - **Type it in**: just a name and notes, with no pin.
- **From OpenStreetMap** on a place: opening hours, phone, website and cuisine,
  when OpenStreetMap has them (looked up when you open the place, at most once
  a week). It has no ratings, reviews, photos or price levels; your own
  rating and price are what Places shows.
- **Directions** opens Apple Maps with directions there from wherever you are.
  **Open in Apple Maps** shows the place in Apple Maps, for its photos,
  reviews and Look Around.

## The two designs

One app, one set of lists: the design changes only how Places looks, at once,
and is kept on this phone (**Settings → Design**, the gear at the top right,
the first section), as in Clock. `../home/design.js`, loaded in `<head>`,
applies it before the page is drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home, Orders and Drinks:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass; the sheets are flat cream (walnut) panels;
  - mustard, teal, burnt orange and olive: the Want to go / Been switch, the
    sort and layer chips, and the status and price choices in a place's sheet
    have a mustard thumb; Want to go pins are **teal** and Been pins
    **mustard**; you, on the map, are a teal dot; stars are mustard;
  - businesses on the map keep their three groups in the Retro colours:
    **burnt orange** for Food & drink, **olive** for Things to do, **walnut**
    for Shops (the chips and each card say which group in words as well);
  - the business card on the map is a flat cream (walnut) card with a solid
    orange **Want to go** and outlined teal **Been** and **Directions**;
  - three atomic shapes (a mustard sun, a teal dot, an orange pill) behind the
    title, and three little bars under it. They are part of the header, so they
    stay with it: on the map they sit over the map's top corner (the map keeps
    its pins and cards 26px further clear of the header than in Standard,
    because the Vintage header is 26px taller), in the list the header is solid
    ground and the list slides under it;
  - solid burnt-orange buttons (+, Save, Want to go on the card); outlined red
    for Delete;
  - the map keeps CARTO's own tiles, warmed with a light sepia filter
    (`.leaflet-tile-pane`) so they sit better with the cream;
  - Futura, which iOS has built in, so no font is downloaded.

  **The sky.** Behind the title is the shared Vintage sky (`../home/sky.js`,
  as in every Vintage design): by day a ground washed with mustard, the sun
  and rays that turn very slowly; after sunset a ground washed with deep teal,
  the moon and twinkling stars; each over cream (Light) or walnut (Dark). The
  sun is the real one, for the phone's place (only if Places already has
  location permission: it never asks), else its time zone. This app only gives
  its disc its colour (`--sky-disc`) and keeps its own sizes and places for
  the shapes, tuned to its header.
- **Standard**: Sea glass: frosted glass with the same very faint tiles for
  its lists and cards as the other AllisonOS apps (only the search results over
  the map keep a blur; the business cards on the map and the toast are the
  sheets' clear glass), and no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The page has two `.ambient` boxes: the atomic shapes in the header
(Vintage; first, so `sky.js` puts its stars there) and the Sea glass aurora
after the page (Standard); each design hides the other's. What the script
draws follows the design too (`app.js`): the business dots' colours and how
far the map keeps clear of the header, redrawn at once on a change
(`aos:design`). The choice is `localStorage` `design.places`. What iOS reads
when Places is added to the Home Screen follows it: the icon (`icon-180.png`,
Vintage: a cream map pin on pine green with a mustard sun and an orange pill;
`icon-glass-180.png`, Standard: a white map pin on sage), the status bar style
(`default` in Vintage, where `black-translucent`'s white clock would vanish on
the cream) and the bar colours. Only colours, shapes and type change: every
tap, pin, sheet and search works the same in both.

**The old Places Vintage app.** Places Vintage used to be an app of its own
(`placesvintage/`, with its own storage). Its address now opens this same app
(the deploy copies `places/` there, `.github/workflows/news.yml`), so a phone
that added it keeps it. The first time it opens there, `design.js` moves that
app's data on the phone over to Places' names (`allison-placesv-…` →
`allison-places-…`: the places, their deleted marks, the sort, the map's
layers, the last known position, the Sheet link it kept before aOS and the
last sync time, and what it had seen, so no walkthrough again), unless Places
already has data on that phone; nothing old is deleted. Places has no server
route of its own and no IndexedDB, so nothing else moves. That Sheet link is
handed to aOS once signed in, like Places' own (below). Where Places and Notes
share storage (Safari), Places also hands over a link it finds under Notes'
name (`allison-notes-v1-sync`) or the old Notes Vintage app's
(`allison-notesv-v1-sync`, there until Notes is next opened at its old
Vintage address and moves it).

## Where the data comes from

All free, with no account:

- **Search**: [Photon](https://photon.komoot.io) by Komoot, over OpenStreetMap
  data. Searches go to Photon as you type (after three letters, with a short
  pause), with your last known position so nearby places come first.
- **Hours, phone, website, and the businesses on the map**: the
  [Overpass API](https://overpass-api.de), which reads OpenStreetMap's data.
- **Map**: CARTO's tiles (OpenStreetMap data), with the same free key as
  Weather's radar map (`CARTO_KEY` in `app.js`), drawn by
  [Leaflet](https://leafletjs.com) 1.9.4, kept in `vendor/` (BSD-2-Clause,
  `vendor/LEAFLET-LICENSE`) so nothing loads from a CDN.

OpenStreetMap is filled in by volunteers: city centres and chains are usually
well covered; suburbs and small independent places can be missing or out of
date. Anything it doesn't have can still be added by hand or from a pin.

Places sends your searches and, when you add one, your position to Photon,
and a place's OpenStreetMap id, or the area the map is showing, to Overpass. Nothing else leaves the phone
except the family's Google Sheet sync below.

## From your calendar

Every three hours a GitHub workflow (`.github/workflows/places-calendar.yml`,
`scripts/from-calendar.mjs`) reads the iCloud **Family** calendar, a year
back and a year ahead, and adds outings to Places through the family's Sheet;
the phones pick them up on their next sync. It asks the Sheet's script as the
calendar (`who=places-calendar`, with the phrase in the link, as aOS does), so
those places are the family's and their Who column says **Calendar**.

- **What counts** (`calendar.mjs`): an event that happens once, whose
  location OpenStreetMap knows as somewhere you'd go out: a restaurant, café,
  bar, pub, bakery, brewery or winery; a museum, gallery, theatre, cinema or
  concert hall; a zoo, aquarium, theme park, attraction or castle; a stadium,
  bowling alley, escape room and the like. The location Apple Calendar saves
  (its name and pin) is matched to the OpenStreetMap place within 250 m.
- **What doesn't**: repeating events (practices, lessons, clubs), titles like
  training, practice, lesson, appointment, dentist, doctor, pickup or
  drop-off, and locations that are homes, offices, schools, churches, parks,
  sports fields or gyms. So *Fearless Foxes training* never shows up, and
  neither does a one-off training at a park.
- **What it does**: a past event is a visit: the place goes into **Been**
  with that date (or, if you already have it, gets the visit added). A coming
  event goes into **Want to go**, Planned for that date, and moves to Been by
  itself once the day has passed, unless you've changed it since. Places from
  the calendar say "📅 Added from the Family calendar", with the event's title
  in their notes. Nothing is ever deleted or rated for you.
- **Limits**: only the Family calendar (the one the Calendar app shows); a
  weekly dinner at the same place is a repeating event, so it's skipped;
  places OpenStreetMap doesn't know aren't added. The first run looks up at
  most 80 locations, the rest over the next runs; after that only new events
  are looked up.
- **Privacy**: event locations go to Photon to find the place; the workflow's
  log shows only counts, never titles or places (the log can be read by
  anyone who can see the repository).

### Set up (once)

It uses the Apple ID secrets the Calendar app already has (`ICLOUD_APPLE_ID`,
`ICLOUD_APP_PASSWORD`, and `ICLOUD_CALENDAR` if yours isn't called Family;
calendar/README.md, "Set up"), plus the Notes Sheet:

1. GitHub → the repository → **Settings → Secrets and variables → Actions →
   New repository secret**: `NOTES_SHEET_URL` (the Sheet's web app link, ending
   in `/exec`) and `NOTES_SHEET_SECRET` (its SECRET). When you change the
   Sheet's SECRET (aOS/SHEETS.md), change this one too.
2. The Sheet's script must be the family's one (`notes/google-sheet-sync.gs`,
   VERSION 2; an older one still works with this workflow).
3. **Actions → Places from Calendar → Run workflow** to run it now; it then
   runs every three hours by itself. Until the secrets exist it just says it
   isn't set up.

## The family's Google Sheet (Notes')

Places keeps its lists in **the family's Notes Sheet** (aOS/SHEETS.md;
`notes/README.md`, *The family's Google Sheet*): one Sheet for the whole
family, where every place is shared (Places has no Just me), and each row says
who added it.

- **It syncs by itself, through aOS.** Places has no Sheet button or settings
  of its own: the owner sets the Sheet up once in **aOS → Account → Google
  Sheets** (Notes'), and no phone keeps its link or phrase. Every sync goes to `../sheet/api/places` (`functions/sheet/api`, which sends
  Places to Notes' Sheet) with the phone's family session (`../home/account.js`
  and `../home/sheet.js`), as `{ action: 'places', places, graves }`; the
  script sends back every place and Places' deletion marks, nothing of Notes'.
  Signed in, Places syncs on opening, a moment after each change, when it
  comes back to the front and when the phone is back online; the title says
  **Synced** or **Not synced**, and a sync that goes wrong says why once a
  visit (never for a Sheet that isn't set up yet, or a sign-in that has run
  out). Signed out, it works on the phone as before.
- **Handing over the old link.** A phone that kept the Sheet's link and phrase
  (Places' own, `allison-places-v1-sync`, or Notes' where they share storage)
  passes them to aOS once, on the owner's phone and only while aOS has none,
  then Places forgets its own copy.
- **Setting it up** is the Notes Sheet's (aOS/SHEETS.md, "Setting it up"):
  nothing of its own.

The Sheet gets a hidden `_places` tab the app reads back from, and readable
**📍 Want to go** and **📍 Been** tabs, starting with **Who** (rebuilt on every
change, so edit in the app). Changes merge as in Notes: the newest change to
each place wins, and deleted places are remembered so the other phones delete
them too. Places are undated: each phone keeps all of them.

## How it's built

- **No build step.** `index.html` (the page and its styles), `app.js`
  (everything it does), `parse.js` (map links, search results and
  OpenStreetMap tags into places, no network), `sw.js` (offline shell),
  `manifest.webmanifest` and the icons (`icon.svg`, Vintage, and
  `icon-glass.svg`, Standard, rendered by `scripts/make-icons.mjs`).
- **Data** lives in localStorage (`allison-places-v1`) and, signed in, the
  family's Sheet.
- Published with the other apps by `.github/workflows/news.yml`, and listed
  on Home.

Tests: `node places/scripts/parse-test.mjs` (map links, search results,
tags, hours), `node places/scripts/calendar-test.mjs` (which events count and
what they change), `node places/scripts/from-calendar-test.mjs` (the calendar
workflow end to end, with iCloud, Photon and the Sheet as stand-ins) and
`node places/scripts/app-test.mjs` (the app in headless Chromium against
stand-ins for Photon, Overpass, the map tiles and aOS; the family's Sheet with
the real script on an in-memory Sheet: signed out, then in, Who, a deletion,
and the old link handed over from Places, Notes or the old Notes Vintage app;
both designs: Vintage, the
default, in the Retro look in light and dark, and Standard; Settings → Design
switching at once, the business dots recoloured, and kept across a reload; the
old Places Vintage address moving that app's data once). `node
places/scripts/make-icons.mjs` redraws the icons. None of them talks to the
real services or a real iPhone.
