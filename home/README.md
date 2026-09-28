# Home

The AllisonOS launcher: every app in one place, with the weather and the
latest headlines at a glance, in the same frosted glass as Mail and News.

- **Apps**: a tile for each app (Mail, News, Weather, Notes), with its own
  icon. Settings orders them and can take one off the page.
- **Now**: the weather for the place chosen in the Weather app — temperature,
  conditions, today's high and low. Tap it to open Weather. It reads the
  place Weather saved (`wx.loc` in `localStorage`) and asks Open-Meteo, the
  same source Weather falls back to; until a place is chosen the card says so.
- **Headlines**: the four newest stories from `news/data/news.json`, the file
  the News app itself reads, refreshed every 30 minutes by
  `.github/workflows/news.yml`. Tapping a story opens the article; **Open
  News** opens the app.
- **Greeting**: "Good morning" with your name, if you give one in Settings.
- **Appearance**: Auto follows the phone, or force Light or Dark.
- **No build step, no server, no accounts.** `index.html` is the whole app,
  `sw.js` keeps it working offline, and the last glance is kept in
  `localStorage` so the page is never empty.

## One app, with the others inside it

The manifest's `scope` is the whole site (`../`), not just this folder. That
is the point of the launcher: install **this one app** and a tap on Mail or
News opens inside the same window, with no browser bar, and the phone's back
gesture brings you home. Each app still has its own manifest and can still be
installed on its own, as before.

It also means the apps share one storage when opened from here, which is
what lets the weather glance read the place chosen in Weather. On Android,
installed web apps share storage with Chrome anyway, so it works there
whether the apps are opened from Home or from their own icons. On iPhone each
home-screen app has storage of its own, so the glance only sees a place chosen
in Weather *opened from Home*.

## Install

- **Android (Chrome)**: open `home/` and tap **Install** on the card at the
  top (Chrome offers it once the page has been visited and the service worker
  is in place), or the browser menu → *Add to Home screen*.
- **iPhone (Safari)**: Share → **Add to Home Screen**.

The card can be dismissed with ✕ and does not come back; it never shows once
the app is installed.

## Adding an app

Add a line to `APPS` in `index.html`: an id, a name, the path to its folder
(relative, so the same page works on GitHub Pages under `/tomallison24/` and
on Cloudflare at the root) and a one-line blurb. The tile uses that folder's
`icon-512.png`. Then add the folder to the `paths` and `cp` lines in
`.github/workflows/news.yml` so it is published.

## Icons

`node home/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`:
four white rounded squares on a blue → violet → teal gradient, the colours
that drift behind the glass. `icon.svg` is the same picture for the page's
own logo.
