# Weather

The Signal dashboard's W3 "Vivid" weather card (ha-config,
`views_signal/favorites.yaml`) as a standalone home-screen web app.

- Data: National Weather Service (api.weather.gov): forecast, current station
  observations and active alerts. Open-Meteo is the fallback outside the US or
  when NWS is down. Place names outside the US: BigDataCloud. No API keys.
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
- **Six views of the timeline**: six little glass buttons above the hours
  (with a thumb that slides between them) switch what the main card shows:
  **Hourly** (temperature, with rain bars), **Rain** (an umbrella: each
  hour's chance of rain on the curve, or Open-Meteo's amount, with a bar under
  the hours of 20% and up; dry hours' umbrellas fade back), **Feels like** (each hour's
  heat index or wind chill, with the rain chance underneath as on Hourly;
  how far it is from the air temperature is in the hour popup),
  **Humidity** (with Dry / Comfy / Humid / Muggy), **Wind** (an arrow
  pointing where it blows to, the speed, and the compass direction), and
  **Radar**. Feels like uses the NWS heat-index and wind-chill formulas on the
  hourly forecast (Open-Meteo supplies its own apparent temperature).
- **Radar**: "Now" (the latest NWS NEXRAD radar) and then the next four hours,
  every 15 minutes, over a dark map, looping, with play/pause, a scrubber, zoom
  buttons and a dot for the place. The four hours ahead are a forecast, not
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
  are stamped "API KEY REQUIRED"): it is `CARTO_KEY` in `index.html`. The URL
  builders are `radarTile`, `hrrrTile` and `baseTile`.
- **One screen**: the sky (its colours, sun, clouds, rain, snow and lightning)
  fills the whole screen behind everything, and the current weather, the
  hourly timeline (about six and a half hours across, scroll for the rest of
  the 24) and the 7-day forecast sit directly on it, with no card edge. A new
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
- **Hourly tray**: the next 24 hours (of the week kept), scrolling sideways, straight on the sky
  (no panel behind it) in every condition view. Each hour has its
  time (midnight shows the day), its weather icon, the temperature on a
  curve, and a rain
  bar with its chance when it is 20% or more. The only thing that moves in the
  tray is the current hour's icon, which suits the weather (the sun turns, rain
  patters, snow sways, storms flicker, wind and fog drift). Everything else
  holds still: no entrance, no pulse, no nudge. It stops too under Reduce
  Motion, and a repaint keeps your place in the tray.
- No build step. `index.html` is the whole app; `sw.js` keeps it working
  offline, and the last forecast is kept in `localStorage`.
- The Location sheet is iOS 26 "Liquid Glass": clear glass floating just
  inside the screen's edges, the sky blurring through it, with a round ✕ to
  close and a glass thumb that slides between the units (`home/slide.js`,
  shared by every app).
- Needs HTTPS for location (GitHub Pages is fine). On iPhone: open the page
  in Safari → Share → Add to Home Screen.

## Icon

`node weather/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
in the style of the other AllisonOS icons: a diagonal gradient from cyan
through azure to indigo, a warm amber-to-coral sun behind one white cloud
with a soft shadow, and a smaller, faint cloud drifting behind. Pass `night`
(and an output folder) for a moon version on the Home colours; it is not
shipped. An installed Home Screen icon is a fixed picture, so it cannot change
with the time of day. The links carry `?v=3` so phones fetch the new picture;
a Home Screen app added before it keeps the old one until it is removed and
added again.

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
