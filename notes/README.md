# Notes

Notes and reminders as a home-screen web app, in the same frosted glass as
Mail and News. Free, no accounts, no server.

- **Notes**: colour, pin, tags (type `#tag` anywhere), search (`#work budget`),
  and a "nudge" date shown on the card.
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
  - Worked out on the phone from a word list (`aisles.js`): the last word
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
- **Backup**: the download button makes one `.json` file with everything.
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
  below; it needs the Google Sheet sync and a small free server.

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
  do, and the "no time" time. Your wife's phone makes its own choices.
- **Several at once**: up to three arrive separately; more arrive as one
  ("4 reminders").
- Done reminders never alert. A reminder already overdue by more than 10
  minutes when it is added doesn't alert either.
- **Private notes** never leave the phone, so their nudges can't notify.

**How it knows**: it reads the Google Sheet the phones sync with. After a
phone syncs a change it pings the server, which reads the Sheet again within
seconds; it also reads it every 15 minutes anyway. It keeps only what it needs
to alert: each open reminder's title, list, date, time and alert, and each
nudge's title and time. It never keeps note text. Each notification is
encrypted for the phone it's going to (the same code as Mail's), so Apple's
push service carries only ciphertext.

**Who can use it**: only a phone that has the Sheet's web app link and secret
code. The first phone's pair is kept; after that the server refuses any other
Sheet, so nobody can point it at their own. If you change the secret in the
script, the old pair stops working and the next phone to turn notifications
on with the new one takes over.

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
4. **Optional: update the Sheet's script.** Paste the new
   `google-sheet-sync.gs` over the old one and deploy a new version (steps in
   *Changing the script later*). The server then gets just the titles and
   dates it needs instead of everything. It works without this step.

### Turn it on (each phone)

1. Open Notes **from its Home Screen icon** (iPhone only allows
   notifications for Home Screen apps, on iOS 16.4 or later). The Google Sheet
   must be connected.
2. **Reminders → bell**. Paste the server address, tap **Turn on
   notifications**, then **Allow**.
3. Tap **Send a test**.
4. For your wife's phone: **Copy setup link** (download button → Google Sheet
   sync) now includes the server address. Set up her phone with it as before,
   then on her phone go to **Reminders → bell → Turn on notifications**.

Each place Notes opens (its own icon, AllisonOS Home, Safari) is separate on
an iPhone, so notifications are turned on in each one you want them in.

### Keep in mind

- Alerts can be up to a minute late (the server checks once a minute), and
  Apple may hold them back a little in Low Power Mode or Focus.
- Cloudflare's free plan covers this comfortably: about 1,500 runs a day of a
  few milliseconds each, a handful of reads of the Sheet an hour.
- Turning notifications off on the phone (Settings → Notifications → Notes,
  or **Turn off on this phone**) makes the server forget that phone.
- `node notes/scripts/push-test.mjs` tests the server (time zones and clock
  changes, who may subscribe, what's sent, and that only the phone can
  read it). `node notes/scripts/push-app-test.mjs` drives the app's side in
  headless Chromium. Neither can test a real iPhone.

## How it's built

- **No build step.** `index.html` is the whole app (with `aisles.js`, the
  grocery sections' word list); `sw.js` keeps it working
  offline and shows notifications; `manifest.webmanifest` and the icons make
  it installable. `push/` is the notification server (a Cloudflare Worker),
  deployed by `.github/workflows/notes-push.yml`.
- **Data** lives in the browser's `localStorage` on each device, and, once
  connected, in a Google Sheet you both share (below).
- Published with the other apps by `.github/workflows/news.yml`.

Design notes and decisions: `tomallison24/Notes-Allison-OS`, `docs/DESIGN.md`.

## Look

Same icons and buttons as Mail: line icons on a 24px grid with a 1.7 stroke
(2.2 for chevrons, ticks and close), in Mail's slate-teal (`--icon`), with
blue kept for text, dots and switches; every button and bar in the same clear
Liquid Glass (`--lg-bg`, `--lg-filter`, `--lg-rim`). New note uses Mail's
compose (pencil) icon.

Sheets are iOS 26 Liquid Glass, as in the Calendar: each floats just inside
the screen's edges with a lit rim, rows and fields are lighter glass on top,
✕ closes and a blue ✓ saves, and Private and Flag are iOS 26 switches (the
note editor stays a full page, with the same rows and buttons). Every
one-choice switch (the Notes / Reminders bar, the reminder views, the list
chips, a reminder's When, Priority and List) has one glass thumb that slides
to the chosen option, from the shared `home/slide.js`.

## Google Sheet sync

One Google Sheet shared by both phones. Every change is sent a couple of
seconds after you make it (and when the app opens); the newest change to each
note, reminder or list wins. If a phone is wiped, connecting again loads
everything back. Free: it runs as a small Apps Script in your own Google
account (`google-sheet-sync.gs` in this folder).

The Places app (`places/`) keeps its lists in this same Sheet, with the same
link and secret (its README says how); they show up as **📍 Want to go** and
**📍 Been** tabs.

The Sheet gets one tab per tag (`#recipe`, `#home`, ... and `No tag`, newest
note first), one per reminder list (`✓ Groceries`, ...), and hidden `_notes`,
`_reminders`, `_lists` and `_deleted` tabs that the app reads back from. The
tag and list tabs are rebuilt on every change, so make edits in the app.

### Set up (once, on a computer)

1. Go to [sheets.new](https://sheets.new) (signed in to the Google account you
   want to use) and name the Sheet, e.g. **AllisonOS - Notes**.
2. In the Sheet: **Extensions → Apps Script**.
3. Delete everything in `Code.gs`, then paste the whole of
   [`google-sheet-sync.gs`](google-sheet-sync.gs).
4. On the line `const SECRET = 'CHANGE-ME';` replace `CHANGE-ME` with your own
   long phrase, e.g. `maple-otter-47-lantern-quiet`. Keep the quotes.
5. Click **Save** (the disk icon).
6. **Deploy → New deployment**. Click the gear next to "Select type" and
   choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**,
   then **Deploy**.
7. Google asks you to authorise: **Authorize access**, pick your account. If
   it says "Google hasn't verified this app", click **Advanced → Go to …
   (unsafe)** (it is your own script) and **Allow**.
8. Copy the **Web app URL** (it ends in `/exec`).

### Connect the phones

1. On your phone, open Notes → the **download** button (top right) → **Google
   Sheet sync**. Paste the Web app URL and type the secret phrase, then
   **Connect and sync**. If the iPhone offers to save them as a password, say
   yes: next time, tap the link box and pick it.
2. Still there, tap **Copy setup link**. It copies a link with the URL and
   secret in it. Send it to your wife (only her).
3. On her phone: copy the link, open Notes from the Home Screen, tap the
   **clipboard** button next to the pencil, then **Connect and sync**.

Each place Notes opens keeps its own copy on an iPhone: its own Home Screen
icon, AllisonOS Home, and Safari. Connect each one you use once; after that
the connection stays (it's kept twice on the phone, in localStorage and
IndexedDB). Removing and re-adding the Home Screen icon starts it fresh, so
connect again with the setup link or the saved password.

### Changing the script later

Edit it, **Save**, then **Deploy → Manage deployments → ✏️ Edit → Version:
New version → Deploy**. The URL stays the same.

**2026-10 update, worth doing once:** the script now keeps any text that
starts with `=`, `+`, `-` or `@` as text, so a note titled like a formula
(`=IMPORTXML(…)`) can never run as one in the Sheet. Paste the new
`google-sheet-sync.gs` over the old one and deploy a new version as above.

### Keep in mind

- **Setup links**: a link opens the sync sheet already filled in and says
  which Sheet it points to (`script.google.com/macros/s/AKfy…/exec`), and
  warns if it isn't the one this phone already uses. Only tap Connect for a
  link that came from your own Notes. A link's notification server is only
  taken once Connect works.
- **Anything that comes from the Sheet or a backup file is checked** before
  Notes keeps it, and ids and colours are escaped wherever they are drawn, so
  nothing in them can become part of the page
  (`node notes/scripts/security-test.mjs` tries).
- Anyone with both the URL and the secret can read and change the notes, so
  keep them private.
- Free Google accounts have daily Apps Script limits; two people syncing notes
  are far below them. If a limit is ever hit, sync pauses and tries again;
  nothing is charged.
- A single note over about 45,000 characters is split across several cells in
  the hidden `_notes` tab; the `#tag` tab shows the first 45,000.
