# Podcasts

Podcasts as a home-screen web app, laid out like the iPhone's Podcasts app,
in the same frosted glass as Mail, Notes and News.

- **Home**: **Up Next** (what's playing, your queue, episodes you're part way
  through, then the newest unplayed episode of each show you follow) and
  **New Episodes** from your shows, with All / Unplayed / Video.
- **Library**: your **Shows** as a grid of artwork, **Saved** episodes and
  **History**. The gear opens Settings.
- **Search** (the round button next to the tabs, as on iOS 26): Apple's
  **Top shows** chart for your country, search by name, or paste a show's
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
  the video), a scrubber, skip back / forward, **speed** (0.5× to 3×), a
  **sleep timer** (minutes, or the end of the episode), **AirPlay** when
  Safari finds a speaker or TV, **Up Next** and the episode notes. Drag it
  down to close.
- **Video podcasts** play in Now Playing, with **Picture in Picture** and
  **full screen**. On iPhone a video stops when you leave the app; use
  Picture in Picture to keep watching. Audio keeps playing with the screen
  locked, with the lock screen's controls.
- **Picks up where you left off**, episode by episode. The last 15 seconds
  count as played. When an episode ends, the next one in Up Next plays
  (Settings can switch that off).
- **Settings**: skip back (10/15/30 s) and forward (15/30/45/60 s), what
  happens when an episode ends, the country for Top shows, and **Import /
  Export** your shows as OPML, the file other podcast apps use.

Episodes stream from each podcast's own servers; nothing is downloaded, so
they need a connection.

## How it's built

- **No build step.** `index.html` is the whole app; `sw.js` keeps it working
  offline; `manifest.webmanifest` and the icons make it installable.
- **Data**: what you follow, where you got to, Up Next, Saved and History
  are in the browser's `localStorage`; each show's episode list (the newest
  250) is in IndexedDB, so the app opens with it. Nothing leaves the phone.
  Each place the app opens (its own Home Screen icon, AllisonOS Home,
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

## Look

Everything from Notes: the same colours for light and dark, the drifting
aurora, the Liquid Glass buttons (`--lg-bg`, `--lg-filter`, `--lg-rim`), line
icons in slate-teal on a 24px grid, the sheets you drag down, the toast with
Undo and the "Updated" pill. Now Playing takes its glow from the episode's
artwork, and the artwork shrinks a little while paused, as on the iPhone.
The sheets (an episode, Settings, the choices and Now Playing) are iOS 26's
Liquid Glass, as in Calendar: clear glass floating inside the screen's
edges, with round ✕ and ✓ buttons. The tabs, the filter chips and Settings'
choices have one glass thumb that slides to the chosen option
(`home/slide.js`, shared with the other apps).

The icon (`icon.svg`, drawn as `icon-512.png` and `icon-180.png`) is a white
signal on a pink-to-violet gradient.

## Keep in mind

- Apple's search and charts are public but undocumented for this use, and
  may change. Shows that are only on Apple Podcasts have no public feed and
  can't be followed.
- A podcast host may refuse requests from cloud servers; such a show says
  "The server answered 403" (or similar) instead of loading.
- There are no downloads for offline listening yet: episodes always
  stream.
