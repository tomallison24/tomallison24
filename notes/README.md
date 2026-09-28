# Notes

Notes and reminders as a home-screen web app, in the same frosted glass as
Mail and News. Free, no accounts, no server.

- **Notes**: colour, pin, tags (type `#tag` anywhere), search (`#work budget`),
  and a "nudge" date shown on the card.
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
- **Data** lives in the browser's `localStorage` on each device. Clearing the
  browser's data deletes it, which is why backups exist.
- Published with the other apps by `.github/workflows/news.yml`.

Design notes and decisions: `tomallison24/Notes-Allison-OS`, `docs/DESIGN.md`.

## Look

Same icons and buttons as Mail: line icons on a 24px grid with a 1.7 stroke
(2.2 for chevrons, ticks and close), in Mail's slate-teal (`--icon`), with
blue kept for text, dots and switches; every button and bar in the same clear
Liquid Glass (`--lg-bg`, `--lg-filter`, `--lg-rim`). New note uses Mail's
compose (pencil) icon.
