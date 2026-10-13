# Notes Vintage

[Notes](../notes/README.md) in a mid-century modern look, as its own app. It
does everything Notes does - notes with colours, pins, #tags, search, a nudge
date, collections, Archive, Trash and Tidy up; Reminders with lists, Today /
Upcoming / Flagged / All, priority, flags, alerts and grocery sections; swipe
actions, share a copy, paste from Claude, recipes step by step, backup and the
shared Google Sheet - and nothing about how it works has changed. The
features, the Sheet and the notifications are described in `notes/README.md`;
this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage, Orders Vintage and Travel Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the Notes / Reminders bar, the
  reminder views, the list chips and a reminder's When, Alert, Priority and
  List all have a mustard thumb; Done, the add buttons and Connect are solid
  burnt orange; Cancel-style buttons are outlined teal and Delete is outlined
  orange; a switch that is on is teal;
- **a note's colour** (yellow, green, blue, pink, purple) is mustard, olive,
  teal, terracotta and plum, flat and ringed in the same colour;
- **a list's colour** (the same seven choices, stored exactly as in Notes, so a
  list means the same in both apps and in the Sheet) is drawn as teal,
  mustard, olive, plum, burnt orange, light teal and brick, on the round tick
  beside each reminder, the dot on a list chip and the colour choices;
- **a tag's colour** is one of ten Retro colours (teal, orange, plum, olive,
  rose, mustard, light teal, walnut, denim, brick), picked from the tag's name
  as Notes picks its hue; the name is always written too;
- the swipe actions are flat discs: Pin mustard, Tag teal, Archive olive,
  Delete orange;
- three atomic shapes (a mustard sun, a teal dot, an orange pill) behind each
  title that scroll away with the page, and three little bars under it; the
  note editor and step by step have a mustard sun of their own;
- Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Notes Vintage is drawn this way for everyone:
the style picker in the design canvas is not built. It follows the phone's
Light or Dark, or aOS's own choice, like every app. The status bar is `default`
(dark text), not `black-translucent`, which would draw the clock white on cream.

## What is separate from Notes

It is a second copy of Notes' page and script, not a setting, so the two can
change independently and Notes is never touched.

- **Own storage.** Every key is `allison-notesv-v1…` (Notes' is
  `allison-notes-v1…`: the notes, lists and reminders, the deleted marks, the
  Sheet link and its time, the notification choices, the view and the tab, the
  last backup and the version), the Sheet link and code's second copy is in
  IndexedDB `allison-notesv` (Notes': `allison-notes`), and the offline cache
  is `notesvintage-v1`. So each app has its own notes and settings on the
  phone: a note written in one is not in the other, until both are connected to
  the same Sheet (below). Each Home Screen app on iOS has its own storage anyway.
  A backup file from one can be imported into the other (it is saved as
  `notesvintage-backup-….json`; the format is Notes').
- **Nothing to sign in to.** Notes has no sign-in (the Calendar's "Add to
  calendar" uses the family account the way it does in Notes), so unlike
  Orders Vintage there is no redirect address to add anywhere.
- **The same Google Sheet, if you like.** Notes and Notes Vintage use the same
  Sheet script (`notes/google-sheet-sync.gs`: paste that file into the Sheet,
  nothing is copied into this folder), and the owner's Sheet link is already
  filled in, so only the secret phrase is typed. Each app keeps its own link
  and code, so connect each once. Pasting the same Sheet and phrase into both
  keeps the two in step: every note, reminder and list carries the time it was
  last changed and the newest wins, a deleted one stays deleted in both, and
  Private notes never leave the phone. (Places also uses this Sheet, with its
  own tabs.) Or give each its own Sheet.
- **The same notification server, if you like.** `notes/push` (the Cloudflare
  Worker, `notes-push`) answers this app too: it is on the same site, so the
  browser lets this app call it, and it reads the same Sheet. Each Home Screen
  app is a separate subscription, so turn notifications on in the one you
  use - with both on, a due reminder alerts twice. A notification opens the
  app that was turned on for it. It needs this app connected to the Sheet first,
  as in Notes. Nothing changes on the server.
- **Its Calendar layer is kept apart.** What Calendar shows from Notes (dated
  reminders and notes with a nudge) is sent to the family account under the
  name `notesv`, so it never overwrites Notes' own copy, as Travel Vintage does
  with `travelv`. For Calendar to show it, `functions/aOS/api` has to accept
  `notesv` (and show it together with `notes`): until then the layer simply isn't
  sent from this app (the server answers 400 and nothing breaks).
- **Add to calendar** (a reminder with a date, into the iCloud Family
  calendar) goes to the Calendar app's own route, `../calendar/api/import`,
  as in Notes.
- **Share links and setup links** are the same format: a link made here
  (`…/notesvintage/#add=…` or `#sync=…`) can be pasted into Notes and the other
  way round, since pasting reads the link and not where it points. A share link
  tapped while it opens in Safari offers to copy it for the Home Screen app, as
  in Notes.
- **The same grocery word list.** `../home/aisles.js` is shared with Notes and
  Meals, so a grocery list sorts the same here (Notes' test of it is run on
  this app too).

## Tests

`node notesvintage/scripts/app-test.mjs` drives the app at iPhone size, light
and dark (home, collections, the editor, colours, Trash and Undo, Reminders,
swipe actions, lists, a new list, the Sheet and Backup sheets, step by step),
checks that it is drawn in the Retro look (Futura, flat cream or walnut cards,
a mustard thumb, an orange add button, the shapes behind the title, the note,
list and tag colours), that all of its storage is its own, and that nothing trips
the page's Content-Security-Policy. `push-app-test.mjs`, `aisles-app-test.mjs`
and `security-test.mjs` are Notes' browser tests of the notifications, the
grocery sections and hostile data, run on this app (CI: `apps-check.yml`).
Notes' tests of the notification server (`notes/scripts/push-test.mjs`) and of
the grocery word list (`aisles-test.mjs`) are Notes' to run: the server and
`home/aisles.js` are shared and unchanged. `node
notesvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg` (a cream
note page on pine green, with a mustard sun and an orange pill).
