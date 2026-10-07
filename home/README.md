# home/

The AllisonOS launcher lived here. It has retired: **aOS** (`../aOS/`) is now
the home of every app, and each app goes on the Home Screen on its own.

What stays in this folder:

- **`welcome.js`**: aOS's welcome, walkthroughs, update screens and release
  log, and the animated Safari steps for adding an app. Every app loads it
  with its own name (`data-app`). See `../aOS/README.md`.
- **`slide.js`**: the sliding glass thumb of every app's switches.
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
