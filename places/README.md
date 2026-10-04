# Places

Where you want to go and where you've been, as a home-screen web app, in the
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
- **Opens on the map**; the list button (top right) switches to the list
  and back. After you add a place, Places goes back to the map, on the list
  the place went into, with the search cleared and the new pin in the middle.
- **Map**: your places as pins, blue for Want to
  go and gold for Been, each with its emoji. **Touch and hold** anywhere on the
  map to add a place there. Buttons to show where you are and fit every pin.
- **Businesses on the map**: zoomed in to street level, every named business
  OpenStreetMap has in view shows as a small dot: coral for **Food & drink**
  (restaurants, cafés, bars, pubs, bakeries, breweries), violet for **Things
  to do** (museums, galleries, theatres, cinemas, attractions, zoos, bowling,
  stadiums, landmarks), teal for **Shops** (every other shop). The chips at
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
except the Google Sheet sync below.

## From your calendar

Every three hours a GitHub workflow (`.github/workflows/places-calendar.yml`,
`scripts/from-calendar.mjs`) reads the iCloud **Family** calendar, a year
back and a year ahead, and adds outings to Places through the Sheet; the
phones pick them up on their next sync.

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
   in `/exec`) and `NOTES_SHEET_SECRET` (its SECRET).
2. The Sheet's script must be the updated one (below).
3. **Actions → Places from Calendar → Run workflow** to run it now; it then
   runs every three hours by itself. Until the secrets exist it just says it
   isn't set up.

## Two phones: the Notes Google Sheet

Places keeps its lists in **the same Google Sheet as Notes**, with the same
web app link and secret, so there's nothing new to set up in Google:

1. Update the Sheet's script once: paste the new
   [`notes/google-sheet-sync.gs`](../notes/google-sheet-sync.gs) over the old
   one (keep your SECRET line), **Save**, then **Deploy → Manage deployments →
   ✏️ Edit → Version: New version → Deploy**. The link stays the same. Until
   then, Places says the script needs updating.
2. In Notes: the download button → **Google Sheet sync** → **Copy setup
   link**.
3. In Places: the cloud button → **Paste a setup link**. (Where Places and
   Notes share storage, as in Safari or AllisonOS Home, **Use the same Sheet
   as Notes** does it in one tap.)

The Sheet gets a hidden `_places` tab the app reads back from, and readable
**📍 Want to go** and **📍 Been** tabs (rebuilt on every change, so edit in
the app). Changes merge as in Notes: the newest change to each place wins,
and deleted places are remembered so the other phone deletes them too.

## How it's built

- **No build step.** `index.html` (the page and its styles), `app.js`
  (everything it does), `parse.js` (map links, search results and
  OpenStreetMap tags into places, no network), `sw.js` (offline shell),
  `manifest.webmanifest` and the icons (`scripts/make-icons.mjs`: a folded
  paper map with a dashed route and a coral pin holding a star, on lime to
  deep teal).
- **Data** lives in localStorage (`allison-places-v1`) and, once connected,
  the Sheet.
- Published with the other apps by `.github/workflows/news.yml`, and listed
  on Home.

Tests: `node places/scripts/parse-test.mjs` (map links, search results,
tags, hours), `node places/scripts/calendar-test.mjs` (which events count and
what they change), `node places/scripts/from-calendar-test.mjs` (the calendar
workflow end to end, with iCloud, Photon and the Sheet as stand-ins) and
`node places/scripts/app-test.mjs` (the app in headless Chromium against
stand-ins for Photon, Overpass, the map tiles and the Sheet). None of them
talks to the real services or a real iPhone.
