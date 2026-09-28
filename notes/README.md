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
  **Import** restores it, or opens a shared file. A banner appears when the
  last backup is more than 7 days old.
- **Add to calendar**: reminders with a date can be saved as a calendar file,
  so the phone's calendar does the alerting. A web app can't alert on its own
  while closed without a push server, and this app has no server.

## How it's built

- **No build step.** `index.html` is the whole app; `sw.js` keeps it working
  offline; `manifest.webmanifest` and the icons make it installable.
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

## Google Sheet sync

One Google Sheet shared by both phones. Every change is sent a couple of
seconds after you make it (and when the app opens); the newest change to each
note, reminder or list wins. If a phone is wiped, connecting again loads
everything back. Free: it runs as a small Apps Script in your own Google
account (`google-sheet-sync.gs` in this folder).

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

### Keep in mind

- Anyone with both the URL and the secret can read and change the notes, so
  keep them private.
- Free Google accounts have daily Apps Script limits; two people syncing notes
  are far below them. If a limit is ever hit, sync pauses and tries again;
  nothing is charged.
- A single note over about 45,000 characters is split across several cells in
  the hidden `_notes` tab; the `#tag` tab shows the first 45,000.
