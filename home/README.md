# home/

The AllisonOS launcher lived here. It has retired: **aOS** (`../aOS/`) is now
the home of every app, and each app goes on the Home Screen on its own.

What stays in this folder:

- **`welcome.js`**: aOS's welcome, walkthroughs, update screens and release
  log, and the animated Safari steps for adding an app. Every app loads it
  with its own name (`data-app`). See `../aOS/README.md`.
- **`slide.js`**: the sliding glass thumb of every app's switches.
- **`sky.js`**: the Vintage sky, shared by every Vintage design and aOS in its
  Vintage look: Weather Vintage's backgrounds with the real sun. By day a ground
  washed with mustard, the sun and slowly turning rays; after sunset a ground
  washed with teal, the moon and twinkling stars; each over cream (Light) or
  walnut (Dark). Sunrise and sunset use Weather Vintage's equation, for the place
  the phone gives if the app already has location permission (kept as
  `aos.sky.loc`, to a tenth of a degree, on the phone only; never asked for), else
  the time zone's. A Vintage design loads it in `<head>`
  (`<script src="../home/sky.js">`, also in its `sw.js` SHELL); it sets
  `data-sky="day"|"night"` and `data-sky-tone="light"|"dark"` on `<html>`, moves on
  at sunrise and sunset, re-colours `--bg` and the faint text, gives the app's disc
  (the first shape in its `.ambient`, `.aurora` or `.atoms` box, coloured
  `var(--sky-disc, var(--mc-mustard))`) its rays by day, and adds the stars to that
  box by night. It holds still with reduced motion; `localStorage['aos.sky']`
  (`day` or `night`) holds the sky still (the tests do, so they work at any hour).
  `window.aosSky.mode()`, `.tone()` and `.ground()` tell a page which sky it is, and
  `aos:sky` fires when it changes. Weather Vintage doesn't load it: it draws its
  own sky from the forecast. `aOS/scripts/sky-test.mjs` checks it.
- **`ipsy.js`**: Ipsy, the helper you chat with: the character each person picks
  and names (Mia, the family's Australian Shepherd, a fox, an owl, a hedgehog or
  Nova, flying code; `aos.helper`, synced with your settings), acting
  out each job (reading, glasses on to search, writing, showing, a hop when a change
  is saved; `jobOf` reads it from the tool's name), crossing aOS Home's bar in its
  own way (`cross`), its chat sheet, and the loop that asks Claude through the
  app's own server route and runs the app's tools on the phone. It takes the app's
  look (Sea glass, or Vintage with `data-look="vintage"`) and its light or dark
  tokens. An app loads it before its own script, lists it in its `sw.js` SHELL and
  calls `AllisonOS.ipsy.mount({...})` with its tools (see the top of the file).
  Orders is the first (`../orders/README.md`, "Ipsy").
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
