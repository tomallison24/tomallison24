# Podcasts Vintage

[Podcasts](../podcasts/README.md) in a mid-century modern look, as its own app.
It does everything Podcasts does - Listen Now (Up Next and new episodes),
Library (shows, Saved, History), Search and Top shows, a show's page, episode
notes with times that play from there, the mini player, Now Playing with its
scrubber, speed, sleep timer, AirPlay, Picture in Picture and full screen,
Settings, OPML import and export, and the optional Google Sheet backup. The
features and how the app is built are described in `podcasts/README.md`; this
page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the tabs and the filter chips have a
  mustard thumb, the play buttons are outlined teal (with a teal bar for how
  far you got), the big play buttons and Done are solid orange, a followed
  show's button is outlined teal, and an artwork that hasn't loaded is a flat
  mustard tile;
- three atomic shapes (a mustard sun, a teal dot, an orange pill) behind each
  page's title that scroll away with the page, and three little bars under it;
- the mini player is a flat cream pill with a solid orange play button; Now
  Playing is on the ground colour with a mustard sun in the corner (the blurred
  artwork glow is gone), flat artwork, a big orange play button, and a
  scrubber with a teal fill and a mustard knob that turns orange while you drag
  it; Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Podcasts Vintage is drawn this way for everyone:
the style picker in the design canvas is not built.

## What is separate from Podcasts

It is a second copy of Podcasts' page and script, not a setting, so the two can
change independently and Podcasts is never touched.

- **Own storage.** The shows you follow, progress, Up Next, Saved, History and
  settings are in `localStorage` under `allison-podcastsv-v1` (Podcasts' is
  `allison-podcasts-v1`), the episode lists in the IndexedDB `allison-podcastsv`,
  and the Sheet link, code and phone id in `allison-podcastsv-sheet`. The
  offline cache is `podcastsvintage-v1`. **It starts empty**: Podcasts keeps its
  state per app, so nothing carries over by itself. To bring your shows over,
  **Settings → Export shows** in Podcasts, then **Settings → Import shows** here
  (the OPML file; where you got to and what you saved don't come with it).
- **Feeds and search go through Podcasts' route.** There is no server function of
  its own: the app asks `../podcasts/api/` (`functions/podcasts/api/[[route]].js`:
  `/feed`, `/search`, `/top`), which only fetches public feeds and Apple's
  directory for the page and stores nothing, so there is nothing per person to
  share or keep apart. (When Podcasts' route changes behaviour, this app
  changes with it.)
- **The same Google Sheet script, if you like.** Podcasts Vintage backs up with
  the same script as Podcasts (`podcasts/google-sheet-sync.gs`; steps in
  `podcasts/README.md`, "Google Sheet backup"), and the owner's Sheet link is
  already filled in (`SHEET_URL` in `app.js`), so only the secret phrase is
  typed. Each app has its own phone id, and the Sheet adds phones together: with
  one Sheet, a show reads Following = Yes while either app still follows it, and
  the Shows, Saved and History tabs are the two apps' lists combined. Or give
  this app a Sheet of its own. **Copy setup link** sets up your other phone (the
  link opens this app's address).
- **No sign-in and no redirect address.** Podcasts needs no account, so Podcasts
  Vintage needs nothing set up with Google, Apple or the owner except, for the
  Sheet, the secret phrase.
- **Links to other apps.** None: Podcasts doesn't link to any.
- **The icon** (`icon.svg`, drawn as `icon-512.png` and `icon-180.png`) is a cream
  broadcast signal on aubergine, with a mustard sun and a burnt-orange pill.
- **The status bar is `default`, not `black-translucent`**, as in the other
  Vintage apps: `black-translucent` always draws the clock white, which vanishes
  on the cream theme. The Home Screen name is "Podcasts" in both apps.

## Tests

`node podcastsvintage/scripts/app-test.mjs` is Podcasts' browser test, run on this
app (feeds and the Google Sheet script stubbed), plus checks that it is drawn in
the Retro look in light and dark (Futura, flat cream or walnut cards, a mustard
thumb on the tabs and chips, orange primary buttons, the shapes behind the title,
the mini player, Now Playing and its scrubber), and that its keys, databases and
cache are its own and its feed requests go to `/podcasts/api/` (CI:
`apps-check.yml`). `node podcastsvintage/scripts/make-icons.mjs` redraws the icons
from `icon.svg`. Podcasts has no logic file apart from `app.js` (the feed reader
is inside it), so there is no same-reader test; the Sheet script's own test
(`podcasts/scripts/sheet-test.mjs`) belongs to Podcasts, as the script does.
