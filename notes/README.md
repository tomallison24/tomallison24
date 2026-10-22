# Notes

Notes and reminders as a home-screen web app, in two designs: Vintage
(mid-century modern, the default) or Standard (the same frosted glass as Mail
and News), picked in Settings. Free. Everything works on the phone; signed in
to the family account, it syncs with **the family's Google Sheet**, through aOS
(below). Ipsy, the helper you chat with, asks Claude through the family server.

- **Notes**: colour, pin, tags (type `#tag` anywhere), search (`#work budget`),
  and a "nudge" date shown on the card.
- **Shared with the family, or Just me**: notes, reminders and lists are the
  family's, in the family's Google Sheet. **Just me** (a switch in a note, a
  list and a reminder) keeps one to you: nobody else in the family gets it
  (below, *The family's Google Sheet*). A Just-me list keeps its reminders to you
  too. Just-me items are marked with a small person: on a note's card ("Just
  me") and in Recent, on a list's chip, on a reminder's row. Not the same as
  **Private**, which only hides a note from Ipsy (the family still sees it).
- **Home**: pinned notes, then **Collections** (one tile per tag, plus
  "No tag"), a short **Recent** list, and links to All notes, Nudges,
  Archive, Trash and Tidy up. Inside a collection, notes are newest-created
  first, grouped by month.
- **Swipe a note** as in Mail: left shows Archive and Delete (all the way
  left moves it to Trash); right shows Pin and Tag (all the way right opens
  Tag). Undo in the message at the bottom.
- **Trash** keeps deleted notes for 30 days, with Restore and Empty Trash.
- **Tidy up** finds duplicates, empty notes, notes without a title, recipes
  without the recipe tag, tags that are the same word (recipe / recipes),
  notes untouched for 6 months, and untagged notes; one tap each, with Undo.
- **Reminders**: lists, Today / Upcoming / Flagged / All, priority, flag, tags.
  Quick add understands `today`, `tomorrow` and `#tags`
  (`Call mom tomorrow #family`).
- **Grocery sections**: a grocery list shows its items under store sections
  in supermarket order: Produce, Bakery, Deli, Meat, Seafood, Dairy & Eggs,
  Frozen, Pantry, Snacks & Sweets, Drinks, Household, Personal Care, Baby,
  Pets, then Other. Type `Milk` and it lands under Dairy & Eggs. It's on by
  itself for a list called Groceries or Shopping (or a store's name); any
  list can turn it on or off with **Sort into store sections** (tap the
  list's chip again to edit it). Choosing the list shows all of it, not just
  today's.
  - Worked out on the phone from a word list (`../home/aisles.js`, shared with Meals): the last word
    usually names the thing (`chocolate milk` is milk, `chicken soup` is
    soup), with two-word names such as `peanut butter` and `ice cream` known
    as phrases. Quantities and notes are ignored (`2 lbs carrots (organic)`).
    Nothing is sent anywhere.
  - **It learns.** If something lands in the wrong place, open it and pick
    its **Section**. That item moves, and the list remembers the name, so
    next time it goes there by itself, however it's typed. What a list has
    learned travels with it in the Google Sheet, so both phones sort alike.
    **Auto** puts it back and forgets.
  - Things it doesn't know go under **Other** until you place them once.
- **Paste from Claude (or anywhere)**: copy a reply, tap the clipboard button
  next to the pencil. On Notes it becomes a note (the heading or first line is the
  title, markdown is tidied, `#tags` kept, recipes tagged `recipe`). On
  Reminders each line becomes a reminder in the chosen list. If the clipboard
  can't be read, a box opens to paste into. Pasting a share link imports it.
- **Share a copy**: a link with the note packed into the part after the `#`
  (browsers never send that part to a server), or a small `.json` file to
  save to iCloud Drive or Google Drive. The other person's app asks
  "Add this note?" and keeps its own copy; later edits don't sync.
  On iPhone a Home Screen app keeps separate storage from Safari, so a link
  opened in Safari offers to copy it for pasting into the Home Screen app.
- **Settings** (the gear at the top of Notes and of Reminders): **Design**
  first (below), then **Backup and sync** (the backup file; the Sheet syncs by
  itself, below).
- **Backup**: Settings → **Back up everything** makes one `.json` file with everything.
  **Import** restores it, or opens a shared file. Restoring asks first ("Add
  3 notes, 2 reminders and 1 list from this file?"), and only restore files
  you made yourself. A banner appears when the last backup is more than 7
  days old.
- **Add to calendar**: a reminder with a date goes straight into the iCloud
  Family calendar where the site is on Cloudflare (through the Calendar app's
  function, see `calendar/README.md`), so the phone's calendar does the
  alerting; elsewhere it is saved as a calendar file to open.
- **Notifications**: the bell at the top of Reminders. Once on, a reminder
  alerts the phone at its **Alert** time even with Notes closed, and so does a
  note's nudge. Each phone picks which lists alert it. See *Notifications*
  below; it needs the family sign-in, the family's Google Sheet and a small
  free server.

## Ipsy

**Ipsy** is the little stem cell just above the Notes / Reminders bar, on the
left: a helper you chat with about your notes, reminders and lists, in the
design picked in Settings (it changes with the design at once). The bar fills
the dock's row, so Ipsy sits above it, and the pages have room at the end to
scroll clear of it. Ask in your own words, e.g. *What's on my grocery list?*,
*Sort the groceries by aisle*, *Find my notes about the house*, *Add the
gutters to my house note*, *Remind me to call Mom tomorrow at 5*, *Tidy up my
pancake recipe*, *Turn my packing note into a list*.

- **What it can do** (`ipsy-tools.js`). Find notes by words, `#tags`, color
  or where they are (Archive, Trash, pinned, nudges) and read them; write a
  note; change one (title, text, adding to the end, tags, color, pin, nudge,
  archive, back from Trash); move notes to Trash; tidy a recipe with the app's
  own Convert. On the lists: see them and their items, add items (making a
  list if asked), change one (its words, date, time, alert, priority, flag,
  list, or its store section on a grocery list), check items off or uncheck
  them, and remove them. Sort a grocery list into store sections, or rewrite a
  shopping-list note with a heading for each section, with the same word list
  as the app (`../home/aisles.js`). Open a note or a list on the screen behind
  the chat. And search the web and read pages.
- **Reminders that alert.** A reminder Ipsy gives a date, time and alert is
  the same as one you set in its sheet: once the Sheet syncs, the notification
  server alerts the phones that have notifications on (*Notifications*, below).
- **Just me**: Ipsy works on what this phone has, which is the family's items
  and your own Just-me ones (never anyone else's). It doesn't switch Just me.
- **Every change shows in the chat with Undo**, for as long as the app stays
  open, and goes through the app's own save, so it reaches the Google Sheet
  (and the other phone) like any other change; an Undo does too. It follows
  the app's rules: `#words` in a note's text become its tags, a deleted note
  goes to Trash for 30 days, and a section picked for a grocery item is learned
  by its list. If Ipsy opened a note and then changes it, the note's editor is
  finished first, so it can't write over the change.
- **Deleting a note asks first**, with Yes and No in the chat; nothing happens
  until you tap one. Everything else just happens, with Undo.
- **Private notes are hidden from Ipsy**: it never sees them. They are left out
  of everything it reads (it is told only how many there are) and it can't
  change them. Private only hides a note from Ipsy: it still syncs to the
  family's Sheet and the family's phones, and its nudge notifies, like any
  other note (Just me is what keeps a note to you). (Until aOS1.7 private notes
  stayed on the phone; the first sync since sends them.) The same Private is in
  Orders, Travel and Calendar.
- **How it works.** The chat lives on the phone. Each step sends the whole
  conversation to the family server (`functions/notes/api`, `POST ipsy`; the
  shared part is `server/ipsy.js`), which adds Ipsy's instructions and tools
  and asks **Claude Sonnet 5.5** (medium effort, prompt caching on,
  Anthropic's server-side fallback if it declines). When Claude asks for one of
  Notes' tools, it runs on the phone, where the notes are, and the result goes
  back with the next step. Web search and web pages run at Anthropic.
  `NOTES_IPSY_MODEL` (optional repository secret) names another model.
- **Asked first, once.** Before the first question, Ipsy says what is sent
  where: your question and the notes, reminders and lists it reads to answer
  it go to Claude through the family server, which keeps only a count of
  questions (80 a person a day; the steps a question takes aren't counted).
  Nothing about the notes is kept there.
- **For signed-in family** (Face ID, `../home/account.js`): the route is locked
  like the other apps' (`functions/notes/api/_middleware.js`). Without the
  Anthropic key it says Ipsy isn't set up.
- **Text in a note is read, never obeyed**: a pasted email or web page in a
  note is material, like the web pages Ipsy reads.
- **New chat** (top of the chat) starts over; a chat is kept on the phone
  until then (a very long one stops at about 1 MB and asks for a new chat).
- **Not tried against the real API or on a phone**: the tests use a stand-in
  for Claude and for the Sheet (`node notes/scripts/ipsy-test.mjs`,
  `node notes/scripts/ipsy-api-test.mjs`), so the first real questions are the
  real test of the instructions. Ipsy floats over the page as it scrolls, like
  the bar does.

## The two designs

One app, one set of notes: the design changes only how Notes looks, at once,
and is kept on this phone (**Settings → Design**, the first section), as in
Clock. `../home/design.js`, loaded in `<head>`, applies it before the page is
drawn. Every tap, swipe, sheet and step works the same in both.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in every Vintage design:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass;
  - mustard, teal, burnt orange and olive: the Notes / Reminders bar, the
    reminder views, the list chips and a reminder's When, Alert, Priority and
    List all have a mustard thumb; Done and the add buttons are solid burnt
    orange; Cancel-style buttons are outlined teal and Delete is outlined
    orange; a switch that is on is teal (Just me, Private, Flag), and one that
    isn't yours to switch is faded;
  - **a note's colour** (yellow, green, blue, pink, purple) is mustard, olive,
    teal, terracotta and plum, flat and ringed in the same colour;
  - **a list's colour** (the same seven choices, stored as the same hex values
    in both designs, so a list means the same everywhere and in the Sheet) is
    drawn as teal, mustard, olive, plum, burnt orange, light teal and brick, on
    the round tick beside each reminder, the dot on a list chip and the colour
    choices;
  - **a tag's colour** is one of ten Retro colours (teal, orange, plum, olive,
    rose, mustard, light teal, walnut, denim, brick), picked from the tag's
    name as Standard picks its hue; the name is always written too;
  - the swipe actions are flat discs: Pin mustard, Tag teal, Archive olive,
    Delete orange;
  - three atomic shapes (a mustard sun, a teal dot, an orange pill) behind each
    title that scroll away with the page, and three little bars under it; the
    note editor and step by step have a mustard sun of their own;
  - Futura, which iOS has built in, so no font is downloaded.

  **The sky.** Behind the title is the shared **Vintage sky**
  (`../home/sky.js`, as in every Vintage design): by day a ground washed with
  mustard, the sun and rays that turn very slowly; after sunset a ground
  washed with deep teal, the moon and twinkling stars; each over cream (Light)
  or walnut (Dark), for the phone's place (only if the app already has
  location permission: it never asks), else its time zone. It holds still
  with reduced motion. This app only gives its disc its colour (`--sky-disc`)
  and keeps its own sizes and places for the shapes; the sun on the note
  editor and step by step is the moon at night too. Checked by
  `aOS/scripts/sky-test.mjs`.
- **Standard**: Sea glass: the frosted glass over a drifting aurora (*Look*,
  below), no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The list and tag colours drawn in script follow it too (`app.js`: a tag
carries both its hue and its Retro token; a list's Retro token is used only in
Vintage, and the page is redrawn when the design changes). The choice is
`localStorage` `design.notes`. What iOS reads when Notes is added to the Home
Screen follows it: the icon (`icon-180.png`, Vintage: a cream note page on
pine green with a mustard sun and an orange pill; `icon-glass-180.png`,
Standard), the status bar style (`default` in Vintage, where
`black-translucent`'s white clock would vanish on the cream) and the bar
colours.

**The old Notes Vintage app.** Notes Vintage used to be an app of its own
(`notesvintage/`, with its own storage). Its address now opens this same app
(the deploy copies `notes/` there, `.github/workflows/news.yml`), so a phone
that added it keeps it. The first time it opens, `design.js` moves that app's
data on the phone over to Notes' names (`allison-notesv-…` → `allison-notes-…`:
the notes, lists and reminders, the deleted marks, the Sheet link it kept
before aOS and its time, the notification choices, the view and tab, the last
backup; the IndexedDB copy of the Sheet link `allison-notesv` → `allison-notes`,
which the app opens only after that; and what it had seen, so no walkthrough
again), unless Notes already has data on that phone; nothing old is deleted.
The Sheet link is then handed to aOS once signed in and forgotten, as Notes'
own is (below). Its notification choices move with it, so a notification still
opens the address it was turned on at. What it shows in Calendar is still sent under its own name,
`notesv`, when the app runs at that address (`notes` everywhere else;
`functions/aOS/api` shows the two together as Notes), so a phone with both Home
Screen apps keeps two copies that never overwrite each other.
Places hands over a Sheet link it finds under Notes' name
(`allison-notes-v1-sync`) too. Its old offline cache (`notesvintage-…`) is
cleared by `sw.js`.

## Notifications

A web app can't wake itself up on a timer, so a small server does it:
`notes/push`, a Cloudflare Worker (free). Every minute it checks what is due
and sends a notification to each phone that turned them on. Tapping one opens
that reminder or note.

- **Per reminder**: in a reminder's details, **Alert** is *At time*, 5, 15 or
  30 minutes, 1 or 2 hours, 1 or 2 days or 1 week before, or *None*. A
  reminder with a date but no time alerts *On the day* (or 1, 2 or 7 days
  before) at 9:00 AM; the bell's sheet changes that time. New and existing
  reminders alert *At time* until you choose otherwise. In the list, a bell
  instead of a clock marks the reminders that will alert this phone.
- **Per phone** (the bell): which lists alert this phone, whether note nudges
  do, and the "no time" time. Each phone in the family makes its own choices.
- **Several at once**: up to three arrive separately; more arrive as one
  ("4 reminders").
- Done reminders never alert. A reminder already overdue by more than 10
  minutes when it is added doesn't alert either.

**How it knows**: it reads the family's Google Sheet, the one the phones sync
with, with its own copy of the Sheet's link and phrase (the phones don't have
them any more: aOS does). After a phone syncs a change it pings the server,
which reads the Sheet again within seconds; it also reads it every 15 minutes
anyway. It keeps only what it needs to alert: each open reminder's title,
list, date, time and alert, and each nudge's title and time, and whose a
Just-me one is. It never keeps note text. Each notification is encrypted for
the phone it's going to (the same code as Mail's), so Apple's push service
carries only ciphertext.

**Who can use it**: someone signed in to the family. Turning notifications on
sends the phone's family session; the server checks it with aOS once
(`/aOS/api/state`) and keeps only whose phone it is, never the session. So a
Just-me reminder or nudge alerts only its own person's phones; a shared one
alerts every phone that has its list on.

**Its copy of the Sheet's link and phrase**: the Worker secrets
`NOTES_SHEET_SECRET` and `NOTES_SHEET_URL`; or, from before aOS kept the Sheet,
the pair a phone brought then, still in its storage (the secrets win, and no
phone can bring a pair any more: that let anyone try phrases against the Sheet
through the server). When you change the Notes Sheet's `SECRET`
(aOS/SHEETS.md, "Setting it up"), give the server the new phrase too, or
notifications stop: in Cloudflare, **Workers & Pages → notes-push → Settings →
Variables and Secrets → Add**, type *Secret*, name `NOTES_SHEET_SECRET`, the
new phrase (and `NOTES_SHEET_URL`, the Sheet's web app link, the first time).
Until then, turning notifications on says the phrase doesn't match.

### Set up (once)

1. **Cloudflare token.** The repo's `CLOUDFLARE_API_TOKEN` secret (the one the
   site and Travel already use) also needs to deploy Workers. In Cloudflare:
   **My Profile → API Tokens**, edit that token, and add **Account → Workers
   Scripts → Edit** and **Account → Workers KV Storage → Edit**. If
   Cloudflare gives you a new token value, paste it into the GitHub secret
   `CLOUDFLARE_API_TOKEN`.
2. **A workers.dev address.** If you've never used Workers, open **Workers &
   Pages** in the Cloudflare dashboard once. It asks you to pick a
   `workers.dev` subdomain.
3. **Deploy.** In GitHub: **Actions → Notes push → Run workflow**. It runs the
   tests, makes the storage it needs (a KV namespace called `notes-push`), and
   deploys. The end of the log shows the address:
   `https://notes-push.<your-subdomain>.workers.dev`. It deploys again by
   itself whenever `notes/push` changes on the default branch.
4. **The Sheet.** The Sheet's script must be the one for the family's Sheet
   (aOS/SHEETS.md), and the server needs its link and phrase: give them as the
   Worker secrets above (`NOTES_SHEET_URL`, `NOTES_SHEET_SECRET`). A server
   that already alerted keeps the pair it had until the phrase changes.

### Turn it on (each phone)

1. Open Notes **from its Home Screen icon** (iPhone only allows
   notifications for Home Screen apps, on iOS 16.4 or later), signed in to the
   family (it asks, with Face ID).
2. **Reminders → bell**. Paste the server address, tap **Turn on
   notifications**, then **Allow**.
3. Tap **Send a test**.
4. On each family phone, the same: signed in, the bell, the server address.

Each place Notes opens (its own icon, aOS, Safari) is separate on
an iPhone, so notifications are turned on in each one you want them in.

### Keep in mind

- Alerts can be up to a minute late (the server checks once a minute), and
  Apple may hold them back a little in Low Power Mode or Focus.
- Cloudflare's free plan covers this comfortably: about 1,500 runs a day of a
  few milliseconds each, a handful of reads of the Sheet an hour.
- Turning notifications off on the phone (Settings → Notifications → Notes,
  or **Turn off on this phone**) makes the server forget that phone.
- `node notes/scripts/push-test.mjs` tests the server (time zones and clock
  changes, who may subscribe, the family session checked with aOS, Just-me
  reminders alerting only their person, the Sheet's phrase in its link, what's
  sent, and that only the phone can read it). `node
  notes/scripts/push-app-test.mjs` drives the app's side in headless Chromium.
  Neither can test a real iPhone, aOS or Apple.

## How it's built

- **No build step.** `index.html` and `app.js` are the whole app (the script in a file of its own, for the page's Content-Security-Policy; with `../home/aisles.js`, the
  grocery sections' word list, and `ipsy-tools.js` with `../home/ipsy.js`, Ipsy); `sw.js` keeps it working
  offline and shows notifications; `manifest.webmanifest` and the icons make
  it installable. `push/` is the notification server (a Cloudflare Worker),
  deployed by `.github/workflows/notes-push.yml`.
- **Data** lives in the browser's `localStorage` on each device, and, signed
  in, in the family's Google Sheet (below).
- **Two designs**: `../home/design.js` and `../home/sky.js` in `<head>` (*The
  two designs*, above).
- Published with the other apps by `.github/workflows/news.yml` (also at the
  old Notes Vintage address, `/notesvintage/`).

## Tests

```sh
node notes/scripts/app-test.mjs         # the app at iPhone size, light and dark, both designs: home, collections, the editor, colours, Trash and Undo, Reminders, swipes, lists, the Settings sheet (no Sheet settings), step by step, its storage, Settings > Design, the old Notes Vintage address; the family's Google Sheet through aOS (the real script): two phones, Just me on a note, a list and a reminder, the old link handed over, finished reminders past 90 days
node notes/scripts/sheet-test.mjs       # the Sheet's script (shared with Places): who gets in, shared and Just-me items, rows from before aOS, the 90 days and looking back, Who, what the notification server gets
node notes/scripts/push-app-test.mjs    # the notifications, the app's side (a stubbed Sheet and server; signed out, then in)
node notes/scripts/aisles-app-test.mjs  # the grocery sections in the app
node notes/scripts/security-test.mjs    # hostile data from a backup or the Sheet, and an old setup link (both designs)
node notes/scripts/ipsy-test.mjs        # Ipsy in the app: its place, its tools, Undo, asking before deleting, private notes (a stand-in Claude and Sheet)
node notes/scripts/ipsy-api-test.mjs    # Ipsy's server route, functions/notes/api (POST ipsy)
node notes/scripts/push-test.mjs        # the notification server (notes/push)
node notes/scripts/aisles-test.mjs      # the grocery word list (../home/aisles.js)
node notes/scripts/make-icons.mjs       # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```

Design notes and decisions: `tomallison24/Notes-Allison-OS`, `docs/DESIGN.md`.

## Look

This is Standard (Sea glass); Vintage is above (*The two designs*).

Same icons and buttons as Mail: line icons on a 24px grid with a 1.7 stroke
(2.2 for chevrons, ticks and close), in Mail's slate-teal (`--icon`), with
blue kept for text, dots and switches; every button and bar in the same clear
Liquid Glass (`--lg-bg`, `--lg-filter`, `--lg-rim`). New note uses Mail's
compose (pencil) icon.

Cards — notes, collection tiles, groups of rows, boxes, notices and empty
states, on the page and in sheets — are very faint tiles: a whisper of white
with a hairline edge, no shadow and no blur (`--tile`, `--tile-edge`), the
same in every AllisonOS app. A coloured note keeps its tint.

Sheets are iOS 26 Liquid Glass, as in the Calendar: each floats just inside
the screen's edges with a lit rim, its rows sit on those faint tiles, fields
are lighter glass on top, ✕ closes and a blue ✓ saves, and Just me, Private and Flag
are iOS 26 switches (the note editor stays a full page, with the same tiles
and buttons). The toast is the same sheet glass, and **Show N completed** the
same clear glass as every button. Every
one-choice switch (the Notes / Reminders bar, the reminder views, the list
chips, a reminder's When, Priority and List) has one glass thumb that slides
to the chosen option, from the shared `home/slide.js`.

## The family's Google Sheet

One Google Sheet for the whole family, the record of everyone's notes,
reminders and lists (aOS/SHEETS.md, the design every app's Sheet follows).
Signed in to the family account, Notes sends every change a couple of seconds
after you make it (and when the app opens, comes back to the front or back
online); the newest change to each note, reminder or list wins. If a phone is
wiped, signing in again loads everything back. Free: it runs as a small Apps
Script in the owner's Google account (`google-sheet-sync.gs` in this folder,
VERSION 2).

- **It syncs by itself, through aOS.** Notes has no Sheet settings of its own:
  the owner sets the Sheet up once in **aOS → Account → Google Sheets**
  (Notes), and no phone keeps its link or phrase. Signed in, every sync goes to
  `../sheet/api/notes` (`functions/sheet/api`) with the phone's family session;
  aOS passes it on to the script with who's asking. `../home/sheet.js` does the
  calling. The title says **Synced** or **Not synced**, and a sync that goes
  wrong says why once a visit (never for a Sheet that isn't set up yet, or a
  sign-in that has run out: nobody is nagged). Signed out, Notes works on the
  phone as before.
- **Shared, except Just me.** Everything is the family's: each person's phone
  gets every note, list and reminder, and anyone can change or delete them.
  An item marked **Just me** (`only: true`) only ever goes to its own person's
  phones, and a reminder in a Just-me list does too. The script enforces it:
  only the person who made an item (`by`, which the script writes on every
  row) can make it Just me or shared again, and nobody else's phone can change
  or delete it, even by sending its id. On the phone, the switch is faded on
  someone else's item, and on a reminder in a Just-me list (it's Just me with
  its list). When an item becomes Just me, it leaves the other phones at their
  next sync, without a deletion mark.
- **Rows from before aOS** are the owner's, written down as theirs the first
  time the owner syncs; they stay shared.
- **What the phone keeps.** Every note, list and open reminder, and the
  reminders finished in the last 90 days (by the day they were ticked off).
  Older finished ones stay in the Sheet only: they leave the phone after a
  sync, with no deletion mark. **Show completed** in Reminders (on a list, or
  All) offers **Show completed before …**, which fetches them from the Sheet,
  once a visit; they stay until the app is next opened. Search and Ipsy only
  see what's on the phone.
- **Handing over the old link.** A phone that kept the Sheet's link and phrase
  (Notes used to: `allison-notes-v1-sync`, and a copy in IndexedDB
  `allison-notes`) passes them to aOS once, on the owner's phone and only while
  aOS has none (`AllisonOS.sheet.adopt`), then deletes both copies. An old
  setup link (`#sync=…`) is refused with a note that it isn't needed any more.
- **Readable tabs** are rebuilt on every change, so make edits in the app: one
  tab per tag (`#recipe`, `#home`, … and `No tag`, newest note first), one per
  reminder list (`✓ Groceries`, …), each starting with a **Who** column. They
  leave out Just-me items; those are in the hidden data tabs (`_notes`,
  `_reminders`, `_lists`, with `_deleted` and `_people`), as everything is:
  the Sheet is the record, in the owner's Google account.

The Places app (`places/`) keeps its lists in this same Sheet
(`../sheet/api/places`, which aOS sends to Notes' Sheet); they show up as **📍
Want to go** and **📍 Been** tabs. The notification server (`push/`) reads it
too, with its own copy of the link and phrase (*Notifications*, above).

### Set up (the owner, once)

aOS/SHEETS.md, "Setting it up", has the steps every app's Sheet shares: paste
the new `google-sheet-sync.gs` into the Notes Sheet's Apps Script (keep your
`SECRET` line), **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy** (the link stays the same), then open Notes on your phone signed in
(it hands over the link and phrase it has), or give aOS the phrase in
**Account → Google Sheets**. Then change the Sheet's `SECRET`, deploy again,
and give the new phrase to aOS, to the notification server (*Notifications*)
and to the `NOTES_SHEET_SECRET` repository secret Places' calendar workflow
uses (`places/README.md`).

A new Sheet, from nothing: [sheets.new](https://sheets.new) → **Extensions →
Apps Script** → paste `google-sheet-sync.gs`, set `SECRET`, **Deploy → New
deployment → Web app** (Execute as: Me, Who has access: Anyone), authorise it,
and give aOS its web app link and phrase.

### Keep in mind

- **Anything that comes from the Sheet or a backup file is checked** before
  Notes keeps it, and ids and colours are escaped wherever they are drawn, so
  nothing in them can become part of the page
  (`node notes/scripts/security-test.mjs` tries).
- Anyone with both the Sheet's link and phrase can read and change it, so only
  aOS (and the notification server, and the calendar workflow) has them.
- Free Google accounts have daily Apps Script limits; a family syncing notes is
  far below them. If a limit is ever hit, sync pauses and tries again; nothing
  is charged.
- A single note over about 45,000 characters is split across several cells in
  the hidden `_notes` tab; the `#tag` tab shows the first 45,000.
- Not tried against the real Google Apps Script or a real aOS: the tests run
  the real script on an in-memory Sheet (`drinks/scripts/fake-sheet.mjs`), with
  aOS stood in for.
