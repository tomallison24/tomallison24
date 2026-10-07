# Home

The AllisonOS launcher, laid out like the iPhone's home screen: a grid of app
icons with their names underneath, over the same drifting colour fields that
sit behind the glass in Mail and News.

- **Apps**: four to a row (Mail, Calendar, News, Weather, Notes, Podcasts,
  Travel, Places, Fitness, Home: Home Assistant, in `house/`),
  each with its own icon, plus **Settings**.
- **Dock**: a frosted pill along the bottom with up to four apps and no
  names, as on an iPhone. **Most used** (the default) fills it with the apps
  you open most, counted from taps here; turn it off in Settings to choose
  the four yourself. Apps in the dock leave the grid.
- **Settings** (its icon, or press and hold anywhere on the screen, as on an
  iPhone): the dock, the order, take an app off the screen, and choose Auto,
  Light or Dark. Auto follows the phone. It is an iOS 26 "Liquid Glass"
  sheet: clear glass floating just inside the screen's edges, with its lists
  as faint tiles (the same card look as every AllisonOS app), a round ✕ to close, and a glass thumb that slides between
  Auto, Light and Dark (`slide.js`, which every app loads for its switches).
- **Swipe up to come home**: in an app opened from here, a swipe up from
  the band just above the phone's home indicator returns to this screen, as
  the iPhone's own gesture returns to its home screen. `back.js` does this;
  every app loads it, and it stays quiet in an app opened from its own icon.
  The phone's own swipe, from the very edge, still goes to the phone's home
  screen.
- **Welcome**: the first time anyone opens an AllisonOS app on a device -
  any of them, once overall - `welcome.js` plays the welcome (design C,
  Quiet type, chosen in `welcome-lab.html`): "AllisonOS" drawn on in soft
  pastels over a hairline, then "Welcome" and "Part of the Allison
  Corporation". Each letter then flips into an app's icon (Home rises from
  the hairline), and the row glides up into a 5 x 2 grid above the tour, one
  glass panel: everything in one place, swipe up to come home, always up to
  date (updates arrive by themselves), **Light or dark** (System / Light /
  Dark - the same setting as Appearance here, `home.settings.theme`), yours
  alone, **Install AllisonOS** (only when opened in a browser: Safari's
  Share → Add to Home Screen step by step, as Safari has no install prompt a
  page can call; Chrome and Edge's own prompt as an Install button), and
  **Choose your apps** (every app with a link to open it and add it on its
  own). Skip ends it; it is remembered in `aos.welcomed`, shared by every
  app on the site. Every app loads it as
  `<script src="../home/welcome.js" data-auto defer>`, which also applies the
  chosen appearance (`data-theme`; Calendar, Fitness, News, Notes, Podcasts
  and Travel follow it, the others follow the phone). On iPhone, an app added
  to the Home Screen on its own keeps its own storage, so it plays once
  there too. `welcome-lab.html` replays it.
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
