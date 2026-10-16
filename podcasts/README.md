# Podcasts

Podcasts as a home-screen web app, laid out like the iPhone's Podcasts app,
in a mid-century Vintage design or the same frosted glass as Mail, Notes and News.

- **Home**: **Up Next** (what's playing, your queue, episodes you're part way
  through, then the newest unplayed episode of each show you follow) and
  **New Episodes** from your shows, with All / Unplayed / Video.
- **Library**: your **Shows** as a grid of artwork, **Saved** episodes and
  **History**. The gear opens Settings.
- **Search** (the round button next to the tabs, as on iOS 26): Apple's
  **Top shows** chart for your country (the US unless changed in Settings), search by name, or paste a show's
  RSS feed link. Private and premium feeds (Patreon, Supercast and the like)
  work too.
- **A show**: artwork, Follow, the description, and its episodes, with
  Unplayed, Video / Audio (when a show has both) and Newest / Oldest first.
  The **⋯** button: Mark All as Played, Share Show (a link that opens it in
  this app), Copy Feed Link, Check for New Episodes, Unfollow. Swipe in from
  the left edge to go back.
- **An episode**: tap it for its notes. Times in the notes (`12:34`) play
  from there. **⋯**: Play Next, Play Later, Save, Mark as Played, Share.
- **Mini player** above the tabs; tap it for **Now Playing**: artwork (or
  the video), a scrubber (a clear track and a white knob that turns into a
  clear lens while you drag it, as in iOS 26), skip back / forward,
  **speed** (0.5× to 3×), a **sleep timer** (minutes, or the end of the
  episode), **AirPlay** when Safari finds a speaker or TV, **Up Next** and
  the episode notes. Drag it down to close.
- **Video podcasts** play in Now Playing, with **Picture in Picture** and
  **full screen**. On iPhone a video stops when you leave the app; use
  Picture in Picture to keep watching. Audio keeps playing with the screen
  locked, with the lock screen's controls.
- **Picks up where you left off**, episode by episode. The last 15 seconds
  count as played. When an episode ends, the next one in Up Next plays
  (Settings can switch that off).
- **Settings**: the design (Vintage or Standard, below), skip back
  (10/15/30 s) and forward (15/30/45/60 s), what happens when an episode ends, the country for Top shows, **Import /
  Export** your shows as OPML (the file other podcast apps use), and an
  optional **Google Sheet backup** (below).

It has two designs, Vintage (mid-century modern, the default) and Standard
(Sea glass), picked in **Settings → Design** ("The two designs", below).

Episodes stream from each podcast's own servers; nothing is downloaded, so
they need a connection.

## How it's built

- **No build step.** `index.html` and `app.js` are the whole app (the script in a file of its own, so the page's Content-Security-Policy allows only this site's scripts); `sw.js` keeps it working
  offline; `manifest.webmanifest` and the icons make it installable.
- **Data**: what you follow, where you got to, Up Next, Saved and History
  are in the browser's `localStorage`; each show's episode list (the newest
  250) is in IndexedDB, so the app opens with it. Nothing leaves the phone
  unless you connect the optional Google Sheet backup (below), which gets only
  your shows, saved episodes and history.
  Each place the app opens (its own Home Screen icon, aOS,
  Safari) keeps its own copy on an iPhone; Export and Import move your shows
  between them.
- **Feeds**: podcast feeds, and Apple's search, don't let a page on another
  site read them (CORS). So the app asks `functions/podcasts/api/[[route]].js`,
  a Cloudflare Pages Function on the same site, to fetch them:
  `/podcasts/api/feed`, `/search` and `/top`. It fetches and passes back;
  it stores nothing and needs no keys. It is locked down: it answers only
  the app (a header a link can't send), only ever as plain text or JSON (so
  nothing it fetches can run on the site), and only for ordinary public web
  addresses (no IP addresses, local names or odd ports, checked again at each
  redirect) that turn out to be feeds, up to 25 MB.
- **Where it runs**: `.github/workflows/news.yml` copies `podcasts/` into
  the site with the other apps and deploys `functions/` with it to
  Cloudflare Pages. On GitHub Pages there is no function: the app then reads
  a feed directly, which works only for feeds that allow it, and says
  "This show's feed can't be read from here" for the rest. Search and Top
  shows may not work there either.
- **Show notes** are the publisher's HTML. The app rebuilds them from plain
  text, paragraphs, lists and web links only: nothing in them runs, and their
  pictures (often trackers) aren't loaded.
- **Artwork** comes from Apple's directory (600 px) where there is one, as
  feeds' own pictures can be several megabytes.

## Google Sheet backup

Optional. **Settings → Google Sheet backup** keeps a **readable backup** of
your shows, saved episodes and listening history in a Google Sheet of your
own. It is one way: the phone writes, nothing is read back, so edit nothing in
the Sheet. Only the three lists are sent (never episode lists, progress, Up
Next or settings), the whole list each time, at most a few seconds after a
change and only when something changed, off the player's path: it never slows
playback. Several phones can back up to one Sheet; each says who it is (a
random id made once per install), and the Sheet adds them together.

1. [sheets.new](https://sheets.new) → name it, e.g. **AllisonOS - Podcasts**.
2. **Extensions → Apps Script**, replace `Code.gs` with the whole of
   [`google-sheet-sync.gs`](google-sheet-sync.gs), and change
   `const SECRET = 'CHANGE-ME';` to a long phrase of your own (you make it
   up: there is nothing to look up).
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access:
   Anyone* → **Deploy** → authorise → copy the **Web app URL**.
4. Podcasts → **Settings → Google Sheet backup** → the link is already filled
   in (`SHEET_URL` in `app.js`: the owner's Sheet; to use another, paste its
   URL over it) → type the phrase → **Connect and back up**. The phrase is
   never in the code. **Copy setup link** sets up your other phone.

**The Sheet** has three readable tabs (and hidden `_shows`, `_saved`,
`_history` ones they are built from; a **Podcasts → Rebuild tabs** menu
rebuilds them by hand):
- **Shows**: every show ever followed, its author, genre, feed link, when it
  was first followed, and **Following** (Yes/No).
- **Saved**: every episode ever saved, with its show, length, links and
  **Saved** (Yes/No).
- **History**: every episode you played, newest first. The app keeps only its
  last 100; the Sheet keeps them all, forever.

Nothing is ever deleted from the Sheet: an unfollowed show or a removed saved
episode reads **No**, and stays listed. With two phones, a show reads Yes while
any phone still follows it. **When it backs up**: when you connect, a few
seconds after a change to what you follow, save or play, when the app opens or
comes back after a while, and when the phone is back online. A playing
episode's progress alone doesn't send anything; pausing does.

The link and code are also kept in a small database of their own
(`allison-podcasts-sheet`), with the phone's id, so they survive a full or
cleared `localStorage`. It uses the same design as Drinks' (read
`drinks/README.md`, "Google Sheet sync"), but one way and for these three
lists only; the script's logic is tested on an in-memory Sheet
(`scripts/sheet-test.mjs`).

## The two designs

One app, one library: the design changes only how Podcasts looks, at once, and
is kept on this phone (**Settings → Design**, the first section), as in Clock.
`../home/design.js`, loaded in `<head>`, applies it before the page is drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home and Orders. A cream ground and
  cards (walnut in dark mode), flat and round-cornered, in place of glass;
  mustard, teal, burnt orange and olive: the tabs and the filter chips have a
  mustard thumb, the play buttons are outlined teal (with a teal bar for how
  far you got), the big play buttons and Done are solid orange, a followed
  show's button is outlined teal, and an artwork that hasn't loaded is a flat
  mustard tile; three atomic shapes (a mustard sun, a teal dot, an orange pill)
  behind each page's title that scroll away with the page, and three little
  bars under it; the mini player is a flat cream pill with a solid orange play
  button; Now Playing is on the ground colour with a mustard sun in the corner
  (no blurred artwork glow), flat artwork, a big orange play button, and a
  scrubber with a teal fill and a mustard knob that turns orange while you drag
  it; Futura, which iOS has built in, so no font is downloaded.
- **Standard**: Sea glass, everything under "Look" below, no sky.

**The sky.** In Vintage, the page behind the title is the shared Vintage sky
(`../home/sky.js`, as in every Vintage design), with the real sun: by day a
ground washed with mustard, the sun and rays that turn very slowly; after
sunset a ground washed with deep teal, the moon and twinkling stars; each over
cream (Light) or walnut (Dark). Sunrise and sunset are for the phone's place
(kept on the phone, to a tenth of a degree, and only if the app already has
location permission: it never asks), else the time zone, and the sky changes by
itself while the app is open. It holds still with reduced motion. This app only
gives its disc its colour (`--sky-disc`) and keeps its own sizes and places for
the shapes, tuned to its header; the sun in Now Playing's corner is the moon at
night too. Checked by `aOS/scripts/sky-test.mjs`.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. Nothing else differs: no colour is drawn in `app.js` (the player and the
artwork tiles take theirs from the style sheet), so every button, sheet, player
and swipe works the same in both; only the sliding thumbs are measured again on
a switch, as Futura and the system font are different widths. The choice is
`localStorage` `design.podcasts`, set at once and not part of the other
settings. What iOS reads when Podcasts is added to the Home Screen follows it:
the icon (`icon-180.png`, Vintage: a cream broadcast signal on aubergine with a
mustard sun and a burnt-orange pill; `icon-glass-180.png`, Standard: a white
signal on a pink-to-violet gradient), the status bar style (`default` in
Vintage, where `black-translucent`'s white clock would vanish on the cream) and
the bar colours.

**The old Podcasts Vintage app.** Podcasts Vintage used to be an app of its own
(`podcastsvintage/`, with its own storage). Its address now opens this same app
(the deploy copies `podcasts/` there, `.github/workflows/news.yml`), so a phone
that added it keeps it. The first time it opens there, `design.js` moves that
app's data on the phone over to Podcasts' names (`allison-podcastsv-…` →
`allison-podcasts-…` in `localStorage`; the IndexedDB episode lists
`allison-podcastsv` → `allison-podcasts` and the Sheet backup copy
`allison-podcastsv-sheet` → `allison-podcasts-sheet`, which the app opens only
after the move; and what it had seen, so no walkthrough again), unless Podcasts
already has data on that phone; nothing old is deleted. Its feed requests go
to `../podcasts/api/` (not `api/`), so they reach the route from either
address. A Sheet backup set up there keeps its phone id, so the Sheet sees the
same phone.

## Look

The Standard (Sea glass) design: everything from Notes: the same colours for light and dark, the drifting
aurora, the Liquid Glass buttons (`--lg-bg`, `--lg-filter`, `--lg-rim`), line
icons in slate-teal on a 24px grid, the sheets you drag down, the toast with
Undo and the "Updated" pill. Now Playing takes its glow from the episode's
artwork, and the artwork shrinks a little while paused, as on the iPhone.
The sheets (an episode, Settings, the choices and Now Playing) are iOS 26's
Liquid Glass, as in Calendar: clear glass floating inside the screen's
edges, with round ✕ and ✓ buttons. The tabs, the filter chips and Settings'
choices have one glass thumb that slides to the chosen option
(`home/slide.js`, shared with the other apps). The toast is the same clear
glass as the sheets, and "Show more" and "Clear history" are small glass
pills like the other buttons.

The icons: `icon.svg` (Vintage) is drawn as `icon-512.png` and `icon-180.png`,
`icon-glass.svg` (Standard) as `icon-glass-512.png` and `icon-glass-180.png`
(`scripts/make-icons.mjs`).

## Tests

```
node podcasts/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (drinks/scripts/fake-sheet.mjs)
node podcasts/scripts/app-test.mjs     # the app in Chromium at iPhone size (needs Playwright): the library,
                                       # the Sheet backup end to end, on the real script, both designs,
                                       # Settings > Design, the old Podcasts Vintage address
node podcasts/scripts/make-icons.mjs   # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```

## Keep in mind

- Apple's search and charts are public but undocumented for this use, and
  may change. Shows that are only on Apple Podcasts have no public feed and
  can't be followed.
- A podcast host may refuse requests from cloud servers; such a show says
  "The server answered 403" (or similar) instead of loading.
- There are no downloads for offline listening yet: episodes always
  stream.
