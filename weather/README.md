# Weather

The Signal dashboard's W3 "Vivid" weather card (ha-config,
`views_signal/favorites.yaml`) as a standalone home-screen web app.

- Data: National Weather Service (api.weather.gov): forecast, current station
  observations and active alerts. Open-Meteo is the fallback outside the US or
  when NWS is down. Place names outside the US: BigDataCloud. No API keys.
- No build step. `index.html` is the whole app; `sw.js` keeps it working
  offline, and the last forecast is kept in `localStorage`.
- Needs HTTPS for location (GitHub Pages is fine). On iPhone: open the page
  in Safari → Share → Add to Home Screen.
