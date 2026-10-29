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
  (10/15/30 s) and forward (15/30/45/60 s), what happens when an episode ends, the country for Top shows, and **Import /
  Export** your shows as OPML (the file other podcast apps use). The family's
  Google Sheet (below) has no settings here: signed in, your shows, Saved,
  History and where you got to are the same on each of your phones.

It has two designs, Vintage (mid-century modern, the default) and Standard
(Sea glass), picked in **Settings → Design** ("The two designs", below).

Episodes stream from each podcast's own servers; nothing is downloaded, so
they need a connection.

## How it's built

- **No build step.** `index.html` and `app.js` are the whole app (the script in a file of its own, so the page's Content-Security-Policy allows only this site's scripts); `sw.js` keeps it working
  offline; `manifest.webmanifest` and the icons make it installable.
- **Data**: what you follow, where you got to, Up Next, Saved and History
  are in the browser's `localStorage` (`allison-podcasts-v1`); each show's
  episode list (the newest 250) is in IndexedDB, so the app opens with it.
  Signed in, the family's Google Sheet (below) is the record of what you
  follow, Saved, History and where you got to, and the phone keeps a working
  copy; Up Next, what's playing, Settings and the episode lists stay on each
  phone. Signed out, everything stays on the phone. Each place the app opens
  (its own Home Screen icon, aOS, Safari) keeps its own copy on an iPhone;
  signed in, each gets yours from the Sheet.
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
- **Search** (and Top shows): see "Search" below.
- **Show notes** are the publisher's HTML. The app rebuilds them from plain
  text, paragraphs, lists and web links only: nothing in them runs, and their
  pictures (often trackers) aren't loaded.
- **Artwork** comes from Apple's directory (600 px) where there is one, as
  feeds' own pictures can be several megabytes.

## Search

Search and Top shows come from Apple's directory, which answers about 20
calls a minute from one address. The feed fetcher runs on Cloudflare, whose
addresses other sites share, so Apple sometimes turns it away ("The server
answered 429") however little the family searches. So:

- **Each search and chart is kept** at Cloudflare: a search for a day, Top
  shows for six hours; an older copy (up to 30 days) when nobody answers.
- **Podcast Index** (podcastindex.org, the open podcast directory) is asked
  when Apple won't answer a search, or finds nothing, once its key is set.
- **The phone** then asks Apple itself, from its own address, where Apple lets
  a page read it.
- If all of them fail, Search says it is busy: try again in a minute, or paste
  the show's RSS link (that never goes through a directory).

**Setting up Podcast Index** (the owner, once; free):

1. Sign up at **api.podcastindex.org** and get an API key and secret by email.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**: `PODCASTINDEX_KEY` (the key) and `PODCASTINDEX_SECRET` (the
   secret).
3. The next release (any merge) hands them to Cloudflare
   (`.github/workflows/news.yml`). They stay on the server; no phone gets them.

Without them Search works as before, with the kept copies and the phone's own
try.

## The family's Google Sheet

One Google Sheet for the whole family is the record of everyone's Podcasts
(`aOS/SHEETS.md`, the same design as Fitness's, kind `personal`): each row
says whose it is, and each phone only ever gets its own person's. Signed in
(Face ID, once), your shows, Saved, History and where you got to are the same
on each of your phones: follow a show on one and it's on the other; unfollow,
unsave or clear History and it goes from them too. Signed out, the app works
on the phone alone.

It syncs by itself through aOS; set up in **aOS → Account → Google Sheets**
(the owner, once). Podcasts has no Sheet controls of its own: no status, Sync
now, form, setup link or Disconnect. No phone holds the Sheet's link or
phrase: syncs go through aOS (`../home/sheet.js` → `functions/sheet/api`),
which adds the phrase and who's asking. A quiet sync never asks for Face ID;
a real error shows one toast a session, and signed out or no Sheet in aOS yet
shows none.

**What syncs** (`SYNC` in `app.js`): four kinds, each item with an id and
`updated`, stamped on any change; anything deleted leaves a grave
(`kind:id → when`, in `S.graves`) so your other phones delete it too, and the
newest change wins.
- `shows`: what you follow (the show's id: a hash of its feed). Its title,
  author, artwork, genre, feed and when you followed it; not its episode list.
- `saved`: your saved episodes (the episode's key, `show id|guid`), with when.
- `hist`: History, each with when you played it (`pl`) and that day. Dated.
- `prog`: where you got to, and what's played. Dated, by when you last
  listened.

Up Next, what's playing, Settings and each show's episode list stay on each
phone.

**The 90 days.** Once a sync has worked, the phone keeps the last 90 days of
History (at most its newest 100); older plays go from the phone with no grave,
as the Sheet keeps them. **Library → History → Show older** fetches them back
from the Sheet, a year at a time (kept until the next tidy-up). What's played
stays on the phone however old (at most 3000, as before), so an old episode
doesn't look new again; only its last 90 days come from the Sheet. The first
sync sends everything the phone has.

**When it syncs**: a couple of seconds after a change, when the app opens,
when it comes back to the front, when the phone is back online, and when you
sign in. A playing episode's progress alone (saved every ten seconds) doesn't
sync; pausing does.

**The Sheet** (`google-sheet-sync.gs`, VERSION 2) has three readable tabs, each
starting with **Who** (and hidden `_shows`, `_saved`, `_history`,
`_progress`, `_deleted` and `_people` tabs they are built from; a **Podcasts
→ Rebuild the tabs** menu rebuilds them by hand). They're rebuilt on every
change, so change things in the app, not there:
- **Shows**: the shows each person follows: author, genre, since when, feed.
- **Saved**: each person's saved episodes, newest first.
- **History**: every episode played, newest first, with **Where you got to**
  (`12:05 of 45:00`, or Finished).

Podcasts' ids are the same for everyone (two people can follow the same
show), so the script keeps each person's rows apart (the hidden tabs' id
column reads `who/id`): a phone only ever changes or deletes its own person's.

**From the one-way backup** (VERSION 1, which added several phones together
by a random phone id): its rows become the owner's, as `aOS/SHEETS.md` says
for rows from before aOS. The shows and saved episodes some phone still had
are kept (an unfollowed one, which read **No**, is dropped), and every History
row. Phones go by person now, not by phone id. On the owner's phone, the link
and phrase it kept (`allison-podcasts-v1-sheet`, and the IndexedDB copy
`allison-podcasts-sheet`) go to aOS once, and then every phone forgets them; a
`#sync=` setup link is only taken off the address. The one-way backup's phone
id is gone.

Setting it up: `aOS/SHEETS.md`, "Setting it up": paste the new
`google-sheet-sync.gs` into the Sheet's Apps Script (keeping your `SECRET`),
deploy a new version, then open Podcasts on your phone, signed in, or give
aOS the phrase in **Account → Google Sheets**.

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
`allison-podcastsv` → `allison-podcasts` and the old Sheet backup's copy of
its link and phrase `allison-podcastsv-sheet` → `allison-podcasts-sheet`,
which the app opens only after the move, to hand over to aOS; and what it had
seen, so no walkthrough again), unless Podcasts already has data on that
phone; nothing old is deleted. Its feed requests go to `../podcasts/api/`
(not `api/`), and its syncs to `../sheet/api/podcasts`, so they reach the
routes from either address.

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
glass as the sheets, and "Show more", "Show older" and "Clear history" are small glass
pills like the other buttons.

The icons: `icon.svg` (Vintage) is drawn as `icon-512.png` and `icon-180.png`,
`icon-glass.svg` (Standard) as `icon-glass-512.png` and `icon-glass-180.png`
(`scripts/make-icons.mjs`).

## Tests

```
node podcasts/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (drinks/scripts/fake-sheet.mjs),
                                       # reached as aOS reaches it: who gets in, each person only theirs (and the
                                       # same show followed by two), your phones kept the same, VERSION 1 rows
                                       # becoming the owner's, the 90 days and older on asking, the Who column
node podcasts/scripts/api-test.mjs     # functions/podcasts/api with Apple, Podcast Index and Cloudflare's cache stubbed:
                                       # Apple's 429 answered from Podcast Index, the kept copies, the busy message
node podcasts/scripts/app-test.mjs     # the app in Chromium at iPhone size (needs Playwright): the library; the
                                       # family's Sheet end to end on the real script, with **/sheet/api/podcasts
                                       # answered here and who's asking from the page's aos.session (signed out,
                                       # no Sheet controls in Settings, two phones of one person, someone else's phone, progress ticks, the 90
                                       # days and Show older, handing the old link and phrase to aOS); both
                                       # designs, Settings > Design, the old Podcasts Vintage address
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
