# Weather

The Signal dashboard's W3 "Vivid" weather card (ha-config,
`views_signal/favorites.yaml`) as a standalone home-screen web app.

- Data: National Weather Service (api.weather.gov): forecast, current station
  observations and active alerts. Open-Meteo is the fallback outside the US or
  when NWS is down. Place names outside the US: BigDataCloud. No API keys.
- Big type, quick to read: a 92px temperature, 21px place and conditions,
  16px chips, 19px day rows.
- **Hourly tray**: the next 24 hours, scrolling sideways. Each hour has its
  time (midnight shows the day), an icon that moves to suit the weather (the
  sun turns, rain patters, snow sways, storms flicker, wind and fog drift,
  sunrise and sunset rise and sink), the temperature on a curve, and a rain
  bar with its chance when it is 20% or more. "Now" pulses. When the hours
  first appear they slide in, the curve draws itself and the bars grow, then
  the tray nudges sideways once to show it scrolls. All of it stops under
  Reduce Motion, and a repaint keeps your place in the tray.
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
