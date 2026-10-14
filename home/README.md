# home/

The AllisonOS launcher lived here. It has retired: **aOS** (`../aOS/`) is now
the home of every app, and each app goes on the Home Screen on its own.

What stays in this folder:

- **`welcome.js`**: aOS's welcome, walkthroughs, update screens and release
  log, and the animated Safari steps for adding an app. Every app loads it
  with its own name (`data-app`). See `../aOS/README.md`.
- **`slide.js`**: the sliding glass thumb of every app's switches.
- **`sky.js`**: the Vintage sky, shared by every Vintage design and aOS in its
  Vintage look: Weather Vintage's backgrounds, by day (Light) a cream ground
  washed with mustard, the sun and slowly turning rays, by night (Dark) a walnut
  ground washed with teal, the moon and twinkling stars. A Vintage design loads it
  in `<head>` (`<script src="../home/sky.js">`, also in its `sw.js` SHELL); it sets
  `data-sky="day"|"night"` on `<html>`, re-colours `--bg` and the faint text, gives
  the app's disc (the first shape in its `.ambient`, `.aurora` or `.atoms` box,
  coloured `var(--sky-disc, var(--mc-mustard))`) its rays by day, and adds the
  stars to that box by night. It follows Light or Dark (the phone's, or the choice
  in aOS) and holds still with reduced motion. `window.aosSky.mode()` and
  `.ground()` tell a page which it is, and `aos:sky` fires when it changes. Weather
  Vintage doesn't load it: it draws its own sky from the forecast.
  `aOS/scripts/sky-test.mjs` checks it.
- **`welcome-lab.html`**: plays the welcome, a walkthrough, an update or the
  Safari steps on demand.
- **`index.html`**: the retirement notice. In a browser it goes straight on to
  aOS. Opened from an old launcher icon on the Home Screen it shows aOS's
  address to open in Safari (a link from here would stay inside the old
  icon's window, whose manifest scope was the whole site, so Safari's Add to
  Home Screen isn't offered there), and how to remove the old icon.
- `sw.js`, `manifest.webmanifest` and the icons, so an old install still opens
  to the notice. `scripts/make-icons.mjs` draws the icons.

The swipe up to come home (`back.js`) went with the launcher: an app added on
its own returns to the iPhone's Home Screen with the phone's own swipe.
