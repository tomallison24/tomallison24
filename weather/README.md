# Weather

The Signal dashboard's W3 "Vivid" weather card (ha-config,
`views_signal/favorites.yaml`) as a standalone home-screen web app.

- Data: National Weather Service (api.weather.gov): forecast, current station
  observations and active alerts. Open-Meteo is the fallback outside the US or
  when NWS is down. Place names outside the US: BigDataCloud. No API keys.
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
  **Hourly** (temperature, with rain bars), **Feels like** (each hour's
  heat index or wind chill, with the rain chance underneath as on Hourly;
  how far it is from the air temperature is in the hour popup),
  **Humidity** (with Dry / Comfy / Humid / Muggy), **Wind** (an arrow
  pointing where it blows to, the speed, and the compass direction), and
  **Radar**. Feels like uses the NWS heat-index and wind-chill formulas on the
  hourly forecast (Open-Meteo supplies its own apparent temperature).
- **Radar**: the last 50 minutes of NWS NEXRAD reflectivity over a dark map,
  looping (play/pause and a scrubber; "Now" is the latest image), with zoom
  buttons and a dot for the place. Radar tiles come from the Iowa
  Environmental Mesonet's cache of the NEXRAD national mosaic; the map is
  CARTO's dark tiles (OpenStreetMap data), and both are credited on the map.
  It covers the continental US; elsewhere it says so. If no tiles arrive it
  says that, with a link to the NWS radar, rather than show a blank map.
  CARTO's map tiles need a free key (since late August 2026; without one they
  are stamped "API KEY REQUIRED"): it is `CARTO_KEY` in `index.html`. The
  radar URL template is `radarTile` and the map's is `baseTile`.
- **One card**: the current weather, the hourly timeline (about six and a half
  hours across, scroll for the rest of the 24), and the 7-day forecast all sit
  on the main card; there is no chevron or drawer to open. Type is sized to
  read at a glance without crowding: a 76px temperature, 18-19px place and
  conditions, 14px chips, 16px day rows, 12-17px in the hourly columns.
- **Hourly tray**: the next 24 hours, scrolling sideways. Each hour has its
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
