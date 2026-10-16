# Weather

The Signal dashboard's W3 "Vivid" weather card (ha-config,
`views_signal/favorites.yaml`) as a standalone home-screen web app.

## The two designs

One app, one set of places: the design changes only how Weather looks, at once,
and is kept on this phone (**Settings → Design**, the first section of the
Places sheet: the cog "Places" button under the forecast, or the place name),
as in Clock. `../home/design.js`, loaded in `<head>`, applies it before the
page is drawn. Every number, chart, view, sheet and swipe is the same in both.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in the other Vintage designs:
  - a cream ground (walnut in dark mode) and flat, round-cornered cards in
    place of glass: the hourly timeline, the 7-day forecast, the chips, the
    sheets and the alerts. Light and dark both follow the phone, or the choice
    in aOS (Standard is drawn for dark only, like the iPhone's own);
  - **the sky**: not a gradient. Each kind of weather has a colour group
    (`V.groups` in `app.js`, put on `<html data-c>` and on the hour and day
    heroes): a flat **disc** top right behind the condition (a mustard sun
    with a sunburst, a cream or sand moon with stars, a teal rain cloud, an
    orange storm, a pale snow disc, olive for fog and wind), and a ground
    tinted with the same hue. Clouds are flat pills, rain and snow flat dashes
    and dots, fog olive stripes, wind mustard lines, lightning a flash of
    mustard. A teal dot and a burnt-orange pill sit beside the disc, and they
    scroll away with the page; the disc moves down with the hero when alerts
    push it down (`placeSky()`). The text on the disc is always ink (every
    disc colour is light enough for it, in both modes). Weather draws this sky
    itself, from the forecast for the place on screen, so it does **not** load
    the shared Vintage sky, `../home/sky.js` (whose `sun` and `night` ground
    and disc came from these colour groups);
  - icons in the palette instead of glowing: a burnt-orange sun by day
    (mustard in dark mode), a teal moon (cream in dark mode), teal for rain and
    snow, olive for fog and wind, ink clouds, and a mustard bolt over teal
    drops for storms. The temperature bars run teal, olive, mustard to burnt
    orange; the rain chance is a teal line;
  - a mustard thumb under the chosen timeline view and units; the current
    hour outlined in mustard; the page dots stretch into a burnt-orange pill;
    the radar's dot is orange, its scrubber teal with a mustard thumb (the map
    itself and its dark panel are unchanged); a solid burnt-orange main
    button and outlined teal ones; three little bars under the place name;
    Futura, which iOS has built in, so no font is downloaded.
- **Standard**: Sea glass: the W3 card as described below, its gradient skies
  over the whole screen, glowing icons, glass chips and Liquid Glass sheets.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`. What `app.js` draws in script
follows the design too (`vintage()`): the colour group or the gradient for the
sky, the Retro or glowing icon colours, the temperature ramp, the alert
colours, the day chart's colours; a change of design draws the screen and any
open sheet again (`aos:design`) and measures the sliding thumbs again (Futura
and the system font are different widths). The choice is `localStorage`
`design.weather`. What iOS reads when Weather is added to the Home Screen
follows it: the icon (`icon-180.png`, Vintage: a cream cloud on olive with a
mustard sun and a burnt-orange pill; `icon-glass-180.png`, Standard: a white
cloud and sun on sea glass blue), the status bar style (`default` in Vintage,
where `black-translucent`'s white clock would vanish on the cream) and the bar
colours (cream or walnut in Vintage, `#0D1213` in Standard).

**The old Weather Vintage app.** Weather Vintage used to be an app of its own
(`weathervintage/`, with its own storage, `wxv.…`). Its address now opens this
same app (the deploy copies `weather/` there, `.github/workflows/news.yml`), so
a phone that added it keeps it. The first time it opens there, `design.js`
moves that app's saved cities, last place, forecasts, units and timeline view
over to Weather's names (`wxv.places`, `wxv.here`, `wxv.cache`, `wxv.units`,
`wxv.view` → `wx.…`, named one by one rather than by the `wxv.` prefix: the
NWS grid cache `wx.pts` was already under Weather's name in both apps and in
Home, so it can't tell whether Weather itself was used) and what it had seen,
so no walkthrough again, unless Weather already has its own places or settings
on that phone; nothing old is deleted. The radar helper is asked at
`../weather/api/hrrr` (not `api/hrrr`), so it is reached from either address.

- Data: National Weather Service (api.weather.gov): forecast, current station
  observations and active alerts. Open-Meteo is the fallback outside the US or
  when NWS is down. Place names outside the US: BigDataCloud. No API keys.
  The fetching and normalising is in `data.js` (all on `WXD`), which Home's
  weather pill loads too, so the two always show the same reading.
- **Current temperature**: the NWS forecast for your exact spot at this
  minute (between the hourly values), corrected by the nearest weather
  station: by how far its latest reading is from what NWS forecast at the
  station itself, so a station that simply sits somewhere warmer or cooler
  doesn't shift your reading. The nearest station is found by actual
  distance; it counts only within 25 km and when it reported in the last 90
  minutes, and the correction is held to 8°F either way. Otherwise the
  forecast for your spot stands. Tap Now in the hourly row to see which it
  was, the station, its distance and the adjustment.
- **Rain starting or stopping** (continental US): the rain chip under the
  temperature says exactly when. Dry now: "Rain at 3:45PM" when rain is due
  within two hours. Raining now: "Rain stops at 4:15PM" at the first dry
  quarter hour, or "Rain through 6:15PM" when it doesn't stop in the six hours
  there are ("Snow" when snow makes up at least half of it). "Raining now" is
  the model's own current quarter, or the current conditions (the station, or
  this hour's forecast) showing rain or snow, so when those say rain and the
  model has it dry already, the chip says it stops at the next quarter hour.
  Otherwise the chip says what it always did (Dry today, or the chance). The
  times come from Open-Meteo's 15-minute precipitation, which over North
  America is NOAA's HRRR model (1 km, run every hour), so they fall on the
  quarter hour: each value is what falls in the 15 minutes before its time, and
  the chip gives the start of the first wet (or first dry) quarter. It is a
  forecast model, not radar tracking. The line is worked out again every
  minute, so it moves on with the clock; one more than 90 minutes old is not
  shown, and if that request fails the forecast still loads without it. No key.
- **Opens to where you are.** Every time the app opens it shows your current
  location (the last known place at once, then its fresh forecast), whatever
  you were looking at last. If location is off, it opens your first saved
  city, or asks you to allow location or search.
- **Places**: tap the place name (it has a chevron) for the Places sheet:
  My Location first, then your saved cities with their weather; search "Add a
  city", remove one with its ✕, switch units. Up to 12 cities. Each place's
  forecast is kept for instant switching and topped up quietly in the
  background. (Older versions kept one place; it is carried over as a saved
  city.)
- **Swipe between places**: drag the forecast card sideways and it follows
  your finger. Let go past a quarter of the way, or flick, and it slides off
  while the next place slides in from the other side; let go early and it
  springs back; at the first or last place it only gives a little. The hourly
  row, the radar and the view buttons keep their own gestures. Page dots under
  the card show where you are (tap one to jump).
- **Page dots** under the forecast, one per place (My Location is the arrow);
  the current one stretches into a pill. Tap a dot to go there. They hide
  when you have only one place.
- **Tap an hour** (in any view except Radar) for a Liquid Glass sheet like
  Places: that hour's temperature and weather, feels like, humidity, wind
  (arrow, speed, where from), chance of rain, and the day's sunrise and sunset,
  with arrows to step through the hours. The view you pick is remembered.
- **Five views of the timeline**: five little glass buttons above the hours
  (with a thumb that slides between them) switch what the main card shows:
  **Hourly** (temperature, with the chance of rain on a line of its own
  underneath), **Feels like** (each hour's
  heat index or wind chill, with the rain line underneath as on Hourly;
  how far it is from the air temperature is in the hour popup),
  **Humidity** (with Dry / Comfy / Humid / Muggy), **Wind** (an arrow
  pointing where it blows to, the speed, and the compass direction), and
  **Radar**. Feels like uses the NWS heat-index and wind-chill formulas on the
  hourly forecast (Open-Meteo supplies its own apparent temperature).
- **Radar**: "Now" (the latest NWS NEXRAD radar) and then the next four hours,
  every 15 minutes, over a dark map, looping, with play/pause, a scrubber, zoom
  buttons and a dot for the place. The controls are dark-tinted Liquid Glass; the
  scrubber is a thin track filled in white up to a white capsule thumb, which
  turns into a clear lens while you hold it. The four hours ahead are a forecast, not
  radar: the NWS HRRR model's simulated reflectivity (IEM's `hrrr::REFD-F…`
  tiles), marked FORECAST on the map. Those frames are numbered from the model
  run's start, which only IEM's `refd_1080.json` gives, and IEM doesn't let
  other sites read it, so it comes through this site's own helper,
  `functions/weather/api` (Cloudflare Pages; `/weather/api/hrrr`). Where that
  isn't available (GitHub Pages) the map shows the latest radar with a note,
  rather than forecast frames at guessed times; forecast tiles that never
  arrive are dropped. Radar tiles: the Iowa Environmental Mesonet's cache of
  the NEXRAD national mosaic. The map is CARTO's dark tiles (OpenStreetMap
  data); both are credited on the map. It covers the continental US; elsewhere
  it says so. If no tiles arrive it says that, with a link to the NWS radar.
  CARTO's map tiles need a free key (since late August 2026; without one they
  are stamped "API KEY REQUIRED"): it is `CARTO_KEY` in `app.js`. The URL
  builders are `radarTile`, `hrrrTile` and `baseTile`.
- **One screen**: the sky (its colours, sun, clouds, rain, snow and lightning)
  fills the whole screen behind everything, and the current weather, the
  hourly timeline (about six and a half hours across, scroll for the rest of
  the 24) and the 7-day forecast sit on it with no card edge around the whole.
  Hourly and the 7-day forecast each have their own very faint tile (5% white
  with a hairline edge, rounded, a gap between them), so the sky still shows
  through; the tiles in the hour and day sheets, the messages and the
  Location sheet's lists are the same (`--tile` and `--tile-edge`, the
  same faint tile as every AllisonOS app's cards). A new
  place's sky fades in as its forecast slides in. Type is sized to read at a
  glance without crowding: a 76px temperature, 18-19px place and conditions,
  14px chips, 12-17px in the hourly columns and the 7-day columns.
- **7-day forecast**: a column per day, side by side: the day, its icon, the
  chance of rain (20% and up), then the high over a bar that runs down to the
  low. Every bar is on the same scale (the week's lowest low to its highest
  high), so the week's shape shows at a glance; the bar's colour follows the
  temperature, and a white dot on Today's bar marks the temperature now.
- **Day sheet**: tap a day for the same Liquid Glass sheet as the hour popup,
  with arrows to step through the week. It shows the high and low, then the day
  drawn hour by hour on a midnight-to-midnight chart: the temperature as a
  smooth line (flat at the peak and trough, so it never passes the real high or
  low) in the 7-day bars' colours, rain as bars along the bottom, night shaded
  from that day's sunrise and sunset, and Now marked on today. Under it: chance
  of rain (and the hour it is most likely) or the day's total, the strongest
  wind and when, humidity, the feels-like high and low, sunrise, sunset and
  hours of daylight, and, for US places, the NWS's own written forecast for the
  day and the night. To draw this, the app keeps a week of hourly forecast
  (where the hourly forecast stops short of the last day, that day says its
  hours aren't available yet) and the NWS `detailedForecast` text; the saved data's
  version went to 3, so older saved forecasts are fetched again.
- **Hourly tray**: the next 24 hours (of the week kept), scrolling sideways, on its faint tile
  in every condition view. Each hour has its
  time (midnight shows the day), its weather icon, the temperature on a
  curve, and under it the chance of rain on a thinner blue line of its own
  (0 to 100%, or up to 0.25 in an hour for Open-Meteo amounts), since it has
  nothing to do with the temperature. The figure rides above its point from
  5% (any amount for Open-Meteo), faded below 20%; under 5% the line runs on
  with no figure. Sunrise and sunset columns let the line pass through (their
  "Sunrise"/"Sunset" label stays in the Humidity and Wind views). The only thing that moves in the
  tray is the current hour's icon, which suits the weather (the sun turns, rain
  patters, snow sways, storms flicker, wind and fog drift). Everything else
  holds still: no entrance, no pulse, no nudge. It stops too under Reduce
  Motion, and a repaint keeps your place in the tray.
- No build step. `index.html` and `app.js` are the whole app (the script in a file of its own, so the page's Content-Security-Policy allows only this site's scripts); `sw.js` keeps it working
  offline, and the last forecast is kept in `localStorage`.
- The Location sheet is iOS 26 "Liquid Glass": clear glass floating just
  inside the screen's edges, the sky blurring through it, with a round ✕ to
  close and a glass thumb that slides between the units (`home/slide.js`,
  shared by every app). Its first section is Design (above).
- Needs HTTPS for location (GitHub Pages is fine). On iPhone: open the page
  in Safari → Share → Add to Home Screen.

## Icon

`node weather/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
from `icon.svg` (Vintage: a cream cloud on olive, with a mustard sun and a
burnt-orange pill), and `icon-glass-512.png` and `icon-glass-180.png` from
`icon-glass.svg` (Standard, in the style of the other AllisonOS icons: a white
cloud in front of a white sun on a sea glass sky blue). An installed Home
Screen icon is a fixed picture, so it cannot change with the time of day. The
links carry `?v=5` so phones fetch the new picture; a Home Screen app added
before it keeps the old one until it is removed and added again.

## Tests

`node weather/scripts/app-test.mjs` opens the app in Chromium at iPhone size,
light and dark, against made-up weather (`scripts/fake-weather.mjs` stands in
for the National Weather Service, Open-Meteo, BigDataCloud and the map tiles:
no network) and checks it opens to where you are, the five views, the hour and
day sheets, Places (search, add a city, units, page dots), alerts, the radar
and its helper path, and its storage; both designs: Vintage drawn in the Retro
look (Futura, flat cream or walnut cards, a mustard thumb, an orange main
button, a flat disc and atomic shapes for the sky, text that reads on every
colour it lands on) and Standard in Sea glass (gradient sky, glowing icons, no
Vintage styles, no `sky.js`); Settings → Design switching both ways at once,
drawing an open sheet again and kept across a reload; and the old Weather
Vintage address moving that app's data over once, or keeping Weather's own
(CI: `apps-check.yml`).

## What could not be verified

- **Futura on an iPhone** and **Safari on an iPhone**: the app was checked in
  Chromium at iPhone size, where Futura is not installed and the fallback font
  is drawn.
- **Live data**: the tests use made-up forecasts.

## Robustness

- Every request times out after 15 seconds, so a dead connection cannot leave
  the app waiting; a refresh that has been out for 45 seconds is treated as lost.
- A late answer for a place you have already left (GPS fix, forecast, search)
  is dropped, never shown.
- If location is off, the app keeps the last known place, still refreshes its
  forecast, and says so in the footer and on the My Location row.
- Saved data is checked for the right shape on start, so a damaged entry
  resets instead of leaving a blank screen. A cached NWS grid that stops
  working is looked up again once.
- "Now" is the hour in progress in any time zone (including :30 and :45 ones);
  alerts are sorted most severe first before any are cut; midnight-sun days
  show no sunrise or sunset.
- Sheets take keyboard and screen-reader focus, put the page behind them out of
  reach, and hand focus back when they close.
