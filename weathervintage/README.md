# Weather Vintage

[Weather](../weather/README.md) in a mid-century modern look, as its own app. It
does everything Weather does - it opens to where you are, with the hourly
timeline in five views (hourly, feels like, humidity, wind and radar), the
7-day forecast, an hour sheet and a day sheet, saved cities you swipe between,
rain-starting and rain-stopping times, active National Weather Service alerts,
and a radar that looks four hours ahead - from the same data, so every number
is the same. The features, where the data comes from and how it is worked out
are described in `weather/README.md`; this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground (walnut in dark mode) and flat, round-cornered cards in place
  of glass: the hourly timeline, the 7-day forecast, the chips, the sheets and
  the alerts. Light and dark both follow the phone, or the choice in aOS (the
  original Weather is drawn for dark only, like the iPhone's own; this one is
  drawn for both);
- the sky is no longer a gradient. Each kind of weather has a colour group
  (`V.vivid` in `app.js`): a flat **disc** top right behind the condition (a
  mustard sun with a sunburst, a cream or sand moon with stars, a teal rain
  cloud, an orange storm, a pale snow disc, olive for fog and wind), and a
  ground tinted with the same hue. Clouds are flat pills, rain and snow are
  flat dashes and dots, fog is olive stripes, wind is mustard lines, lightning
  is a flash of mustard. A teal dot and a burnt-orange pill sit beside the
  disc, and they scroll away with the page. The disc moves down with the hero
  when alerts push it down (`placeSky()` in `app.js`);
- the text on the disc is always ink (every disc colour is light enough for
  it, in both modes), so the condition, its icon and the high and low read the
  same by day, night and in a storm;
- icons are drawn in the palette instead of glowing: a burnt-orange sun by
  day (mustard in dark mode), a teal moon (cream in dark mode), teal for rain
  and snow, olive for fog and wind, ink clouds, and a mustard bolt over teal
  drops for storms. The temperature bars run teal, olive, mustard to burnt
  orange; the rain chance is a teal line;
- a mustard thumb slides under the chosen timeline view and the chosen units;
  the current hour is outlined in mustard; the page dots stretch into a burnt
  orange pill; the radar's dot is orange, its scrubber teal with a mustard
  thumb. The map itself (CARTO's dark tiles and the radar) is unchanged, and so
  is its dark panel: only the controls around it are Retro;
- a solid burnt-orange main button and outlined teal ones; three little bars
  under the place name; Futura, which iOS has built in, so no font is
  downloaded.

These colour groups are where the day and night backgrounds of the other Vintage
designs and aOS come from: `../home/sky.js` gives them the `sun` and `night` ground
and disc, the same colours, with the same slowly turning rays and twinkling stars,
for the real sunrise and sunset where the phone is (the same equation). Weather
Vintage doesn't load it: it chooses its sky from the forecast for the place on screen.

It is the last block of the style sheet in `index.html`, and `app.js` puts the
colour groups and palette colours where Weather has gradients and white; the
glass styles above it in the sheet are still there underneath. Weather Vintage
is drawn this way for everyone: the style picker in the design canvas is not
built.

## What is separate from Weather

It is a second copy of Weather's page and script, not a setting, so the two
can change independently and Weather is never touched.

- **Own storage.** Every key is `wxv.…` (Weather's is `wx.…`): saved cities,
  the last place, each place's forecast, units and the timeline view. A city
  added in one is not in the other, and neither reads the other's keys. One
  exception: `wx.pts` is the National Weather Service's grid-point lookup
  (which office and grid a spot belongs to), cached by `data.js`, which is the
  same file in both apps and in Home. It holds nothing personal and only saves
  a request, so Weather, Weather Vintage and Home share it. Offline cache:
  `weathervintage-v1`.
- **The same forecast reader.** `data.js` is the same file as Weather's
  (checked by `scripts/same-reader-test.mjs`), so a forecast reads the same in
  both, and in Home's weather pill. When `weather/data.js` changes, copy it
  over: `cp weather/data.js weathervintage/data.js`.
- **No account, no sign-in, no server data of its own.** Like Weather, it needs
  nothing but a place. There is no redirect address to add anywhere.
- **The radar helper is Weather's.** The forecast frames need the HRRR model
  run's time, which only IEM gives and which IEM won't let another site read,
  so Weather asks its own site's helper, `functions/weather/api` (`/hrrr`).
  Weather Vintage asks the same one, at `../weather/api/hrrr` (it has no
  `api/` folder of its own, and the helper needs no change). It returns one
  fixed public field from one fixed address and keeps nothing, so there is no
  data to separate; sharing it just saves a second copy of the code.
- **Home's weather pill opens Weather**, not this app (`../weather/`, a plain
  link in `house/`), and reads Weather's `wx.here` and `wx.units`; Calendar's
  weather layer borrows Weather's saved place from `wx.*` when it has none of
  its own. Neither knows about `wxv.*`, so Weather Vintage's places and units
  don't reach them. (Not changed here: those are other apps' files.)
- **No links to other apps.** Weather has none, so there are no Vintage
  siblings to point to.

## Tests

`node weathervintage/scripts/app-test.mjs` opens the app in Chromium at iPhone
size, light and dark, against made-up weather (`scripts/fake-weather.mjs`
stands in for the National Weather Service, Open-Meteo, BigDataCloud and the
map tiles: no network) and checks it opens to where you are, the five views,
the hour and day sheets, Places (search, add a city, units, page dots), alerts,
the radar and its helper path, that its storage is its own and Weather's is
never read, and that it is drawn in the Retro look: Futura, flat cream
(walnut) cards, a mustard thumb, an orange main button, a flat disc and
atomic shapes for the sky, and text that reads on every colour it lands on
(CI: `apps-check.yml`). `node weathervintage/scripts/same-reader-test.mjs`
checks the forecast reader is Weather's. `node
weathervintage/scripts/make-icons.mjs` redraws the icons from `icon.svg` (a
cream cloud on olive, with a mustard sun and a burnt-orange pill).

## What I could not verify

- **Futura on an iPhone.** The app was checked in Chromium on Linux, where
  Futura is not installed and the fallback font (Jost, then the system font)
  is drawn. iOS has Futura built in; its letters are narrower than the
  fallback's, so nothing should be tighter on the phone, but it was not seen.
- **Safari on an iPhone** was not tested; the app was checked in Chromium at
  iPhone size, light and dark, in every kind of weather, by day and night.
- **Live data.** The tests use made-up forecasts. The first real open on a
  phone is the real test of the National Weather Service and radar requests.
