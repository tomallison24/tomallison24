# Home

The AllisonOS launcher, laid out like the iPhone's home screen: a grid of app
icons with their names underneath, over the same drifting colour fields that
sit behind the glass in Mail and News.

- **Apps**: four to a row (Mail, News, Weather, Notes, Podcasts, Travel),
  each with its own icon, plus **Settings**.
- **Dock**: a frosted pill along the bottom with up to four apps and no
  names, as on an iPhone. **Most used** (the default) fills it with the apps
  you open most, counted from taps here; turn it off in Settings to choose
  the four yourself. Apps in the dock leave the grid.
- **Settings** (its icon, or press and hold anywhere on the screen, as on an
  iPhone): the dock, the order, take an app off the screen, and choose Auto,
  Light or Dark. Auto follows the phone.
- **Swipe up to come home**: in an app opened from here, a swipe up from
  the band just above the phone's home indicator returns to this screen, as
  the iPhone's own gesture returns to its home screen. `back.js` does this;
  every app loads it, and it stays quiet in an app opened from its own icon.
  The phone's own swipe, from the very edge, still goes to the phone's home
  screen.
- **No build step, no server, no accounts.** `index.html` is the whole app
  and `sw.js` keeps it working offline. The order, dock, use counts and
  theme are kept in `localStorage`.

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
