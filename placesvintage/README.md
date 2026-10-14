# Places Vintage

[Places](../places/README.md) in a mid-century modern look, as its own app. It
does everything Places does - Want to go and Been, your own rating, price,
dates and `#tags`, every visit, search for places and businesses on
OpenStreetMap, the map with its pins and business dots, adding by search, by
where you are, by a pasted map link or by hand, Apple Maps directions, and the
Google Sheet sync - and can use the same Google Sheet. The features, where the
data comes from and how the Sheet works are described in `places/README.md`;
this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage, Orders Vintage and Drinks Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass; the sheets are flat cream (walnut) panels;
- mustard, teal, burnt orange and olive: the Want to go / Been switch, the sort
  and layer chips, and the status and price choices in a place's sheet have a
  mustard thumb; Want to go pins are **teal** and Been pins **mustard** (Places'
  are blue and gold); you, on the map, are a teal dot; stars are mustard;
- businesses on the map keep their three groups, now in the Retro colours:
  **burnt orange** for Food & drink, **olive** for Things to do, **walnut** for
  Shops (Places' are coral, violet and teal). The chips and each card say which
  group it is in words as well;
- the business card on the map is a flat cream (walnut) card with a solid
  orange **Want to go** and outlined teal **Been** and **Directions**;
- three atomic shapes (a mustard sun, a teal dot, an orange pill) behind the
  title, and three little bars under it. They are part of the header, so they
  stay with it: on the map they sit over the map's top corner (the map keeps its
  pins clear of the header), in the list the header is solid ground and the
  list slides under it;
- solid burnt-orange buttons (+, Save, Connect and sync, Want to go on the
  card); outlined teal for Paste a setup link; outlined red for Delete and
  Disconnect;
- the map itself keeps CARTO's own tiles, warmed with a light sepia filter
  (`.leaflet-tile-pane` in the style sheet) so they sit better with the cream;
- Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Places Vintage is drawn this way for everyone:
the style picker in the design canvas is not built. It follows the phone's
Light or Dark, or aOS's own choice, like every app.

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

## What is separate from Places

It is a second copy of Places' page and script, not a setting, so the two can
change independently and Places is never touched.

- **Own storage.** Every key is `allison-placesv-v1…` (Places' is
  `allison-places-v1…`: the places, their graves, the sort choice, the map's
  layers, the last known position, the Sheet link and the last sync time), and
  the offline cache is `placesvintage-v2`. So each app has its own lists on the
  phone: a place added in one is not in the other, until they share a Sheet
  (below). Each Home Screen app on iOS has its own storage anyway.
- **The same Google Sheet, if you like.** Places and Places Vintage use the
  same Sheet script (`notes/google-sheet-sync.gs`, the Notes Sheet; see
  `places/README.md`, "Two phones"), so putting one Sheet's link and secret into
  both keeps the two in step: each place carries the time it was last changed,
  and the newest wins; deletes are remembered. They share the Sheet's hidden
  `_places` tab and the readable **📍 Want to go** and **📍 Been** tabs. The
  Sheet's link is already filled in (the owner's), so only the secret is typed.
  **Use the same Sheet as Notes** reads the link and secret from either Notes
  (`allison-notes-v1-sync`) or Notes Vintage (`allison-notesv-v1-sync`), when this
  browser has them (Notes and Notes Vintage on the same Home Screen are separate
  storage on iOS, so mostly it is **Paste a setup link**, as in Places).
- **Outings from your calendar come through the Sheet.** The workflow in
  `.github/workflows/places-calendar.yml` (`places/scripts/from-calendar.mjs`)
  writes dinners, shows and museum trips from the Family calendar into the Notes
  Sheet's `_places` tab; any phone connected to that Sheet picks them up on its
  next sync, so Places Vintage gets them with nothing to set up here, once it is
  connected to the Sheet. Nothing in the workflow, its tests or its secrets
  changes (they are Places'; see `places/README.md`, "From your calendar").
- **No server route and nothing to register.** Places has none (the search and
  the businesses go straight to Photon and Overpass, the Sheet straight to
  Google), so there is no `../places/api/…` to point at, no family sign-in and
  no sign-in redirect address to add in Google Cloud (unlike Orders Vintage).
- **The same reader.** `parse.js` is the same file as Places' (checked by
  `scripts/same-reader-test.mjs`, which also checks the Leaflet files in
  `vendor/`), so a map link, a search result or a set of OpenStreetMap tags
  reads the same in both. When `places/parse.js` changes, copy it over: `cp
  places/parse.js placesvintage/parse.js`.
- **The map's top padding** (`fit()` and the business card's pan) is 26px more
  than Places', because the Retro header is 26px taller. It is the only number
  in `app.js` that differs besides the storage key, the Notes Vintage link and the
  business colours.
- **Status bar.** `default`, not `black-translucent`: that one always draws the
  clock white, which vanishes on the cream theme.

## Files

- `index.html`: Places' page and style sheet, with the Retro look as the last
  block. `app.js`: Places' script with the storage key, the Sheet link lookup,
  the business colours and the map padding changed and nothing else. `parse.js`:
  the reader, as Places'. `vendor/`: Leaflet, as Places'.
- `sw.js`: the offline shell (`placesvintage-v2`; network-first; `api/` is left
  alone).
- `icon.svg` → `icon-180.png`, `icon-512.png`: a cream map pin with its dot cut
  out, on pine green, with a mustard sun and an orange pill, drawn by
  `scripts/make-icons.mjs`.

## Tests

```
node placesvintage/scripts/app-test.mjs          # Places' browser test, run on this app, plus the Retro look and its own storage (needs Playwright)
node placesvintage/scripts/same-reader-test.mjs  # parse.js and vendor/ are Places'
node placesvintage/scripts/make-icons.mjs        # redraws the icons from icon.svg
```

`app-test.mjs` is Places' own browser test (adding by search, a pasted link and
where you are; the place sheet; moving to Been; lists, sorting and filters; the
map, its pins and its businesses; delete with undo; the Sheet sync, including an
old script) run on this app, plus: every key it stores is its own and its cache
is `placesvintage-*`; the Sheet link of Notes **and** of Notes Vintage is offered
and connects in one tap; and it is drawn in the Retro look in light and dark
(Futura, the ground, flat cream or walnut cards, sheets and toast, a mustard
thumb on the tabs, chips and choices, the shapes behind the title, orange
buttons, teal and mustard pins, orange and olive business dots, the business
card, no sideways scroll). The calendar tests (`calendar-test.mjs`,
`from-calendar-test.mjs`) test the workflow, which is Places' and writes to the
Sheet, so they have no copy here. None of them talks to the real services or a
real iPhone.
