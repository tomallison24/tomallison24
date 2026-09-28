# Home

The AllisonOS launcher, laid out like the iPhone's home screen: a grid of app
icons with their names underneath, over the same drifting colour fields that
sit behind the glass in Mail and News.

- **Apps**: four to a row (Mail, News, Weather, Notes), each with its own
  icon, plus **Settings**.
- **Settings** (its icon, or press and hold anywhere on the screen, as on an
  iPhone): set the order, take an app off the screen, and choose Auto, Light
  or Dark. Auto follows the phone.
- **No build step, no server, no accounts.** `index.html` is the whole app
  and `sw.js` keeps it working offline. The order and theme are kept in
  `localStorage`.

## One app, with the others inside it

The manifest's `scope` is the whole site (`../`), not just this folder. That
is the point of the launcher: install **this one app** and a tap on Mail or
News opens inside the same window, with no browser bar, and the phone's back
gesture brings you home. Each app still has its own manifest and can still be
installed on its own, as before.

It also means the apps share one storage when opened from here. On Android,
installed web apps share storage with Chrome anyway. On iPhone each
home-screen app has storage of its own, so an app opened from Home and the
same app installed on its own keep separate notes, settings and sign-ins.

## Install

- **Android (Chrome)**: open `home/` and tap **Install** on the card at the
  top (Chrome offers it once the page has been visited and the service worker
  is in place), or the browser menu → *Add to Home screen*.
- **iPhone (Safari)**: Share → **Add to Home Screen**.

The card can be dismissed with ✕ and does not come back; it never shows once
the app is installed.

## Adding an app

Add a line to `APPS` in `index.html`: an id, a name and the path to its
folder (relative, so the same page works on GitHub Pages under
`/tomallison24/` and on Cloudflare at the root). The icon is that folder's
`icon-512.png`. Then add the folder to the `paths` and `cp` lines in
`.github/workflows/news.yml` so it is published.

## Icons

`node home/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`:
four white rounded squares on a blue → violet → teal gradient, the colours
that drift behind the icons. `icon.svg` is the same picture as a vector.
