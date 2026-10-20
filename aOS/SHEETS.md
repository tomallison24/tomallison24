# The family's Google Sheets

Seven apps keep their records in a Google Sheet: **Fitness, Drinks, Podcasts, Orders, Notes (with
Places), Travel and Meals**. Each app has **one Sheet for the whole family**, and that Sheet is the
record:

- Every row is marked with whose it is.
- Each phone only ever gets its own person's rows, plus the family's shared ones.
- You change things in the app; the readable tabs are rebuilt from it, so edits made in the Sheet
  itself are overwritten.
- Each phone keeps a working copy, so taps are instant and the app works offline: everything
  undated, and the **last 90 days** of anything dated. Older days come from the Sheet when you look
  back.

| App | Kind | What that means |
|---|---|---|
| Fitness, Drinks, Podcasts, Orders | `personal` | Each person sees only their own rows |
| Notes (and Places, on Notes' Sheet), Travel, Meals | `family` | Rows are shared by the family, except an item marked **Just me** (`only: true`), which only its own person sees |

## How a sync gets to a Sheet

No phone holds a Sheet's link or secret phrase. The owner gives them to aOS once (**aOS → Account →
Google Sheets**), and aOS keeps them in the accounts' Workers KV (`config:sheet:<sheet>`).

Every sync is a POST to `../sheet/api/<app>` (`functions/sheet/api`), sent with the phone's family
session (Face ID) and the `X-Sheet: 1` header. aOS checks who you are and passes the request on, as
it is, to the app's Apps Script with:

```
?key=<the Sheet's SECRET>&who=<your family user id>&name=<your first name>&owner=1 (the owner only)&app=<sheet>
```

The script trusts `who` only together with the right `key`. So a phone, or one family member, can
never ask for someone else's rows. A request with the phrase in its body, the way phones used to
send it, gets nothing.

On the phone, `../home/sheet.js` does the calling (load it after `../home/account.js`, and add both
to the app's `sw.js` SHELL):

- `AllisonOS.sheet.sync(app, body, { ask })`: the script's answer, or `Error(code)`.
  - `ask: true` (the person tapped Sync) shows Face ID if they're signed out. A quiet background sync
    never asks.
  - The codes: `signin`, `no-sheet` (the owner hasn't set it up yet), `offline`,
    `sheet-unreachable`, `not-json`, or the script's own error (`busy`, `wrong-secret`).
- `AllisonOS.sheet.adopt(app, { url, secret })`:
  - On the owner's phone, it hands a link and phrase the app still keeps over to aOS, once, and only
    while aOS has none.
  - On any phone, it answers whether aOS has one now. When it says yes, the app deletes its own
    copies: the localStorage key, the IndexedDB copy, and any `#sync=` setup link.

## The script's side (every `google-sheet-sync.gs`)

Fitness's is the reference: `fitness/google-sheet-sync.gs` (VERSION 3).

- **`doGet`** answers `{ ok, app, v, aos: true }`.
- **`caller(e)`** reads `e.parameter`, checks `key` against `SECRET` with `same()`, and `who` against
  `/^[A-Za-z0-9_-]{1,40}$/`.
  - It returns `{ who, name, owner }`, or `{ error }`. The error comes back as
    `{ ok: false, app, aos: true, error }`, and `aos: true` is how aOS tells a wrong phrase from a
    script that hasn't been updated.
  - `{ action: 'ping' }` answers `{ ok: true, app, v, aos: true }`. aOS uses it to check a link and
    phrase before keeping them.
- **Whose an item is:**
  - Every item carries `by`, the person's id.
  - `ownerOf(it)` is `it.by`, or for a row from before aOS kept `by`, the owner.
  - `canSee(it, c)`: in `personal` mode, `ownerOf(it) === c.who`. In `family` mode,
    `!it.only || ownerOf(it) === c.who`.
- **`meet(db, c)`** keeps `_people` up to date (a hidden tab of `[id, name]` rows, plus
  `['(owner)', id]`). The first time the owner syncs, it writes the owner's id on every row that has
  no `by`.
- **`merge(db, req, c)`:**
  - An item the caller can't see is never changed, however the phone sends it.
  - A new item gets `by: c.who`. A changed one keeps its `by`.
  - In `family` mode, only an item's own person can set `only`.
  - Graves are stored as `{ t, by }` (a third column `by` in `_deleted`). A grave for someone else's
    item is ignored. Newest `updated` wins, as before.
- **The answer:**
  - Everything the caller can see.
  - For dated kinds (`DATED = { kind: 'date field' }`), only the last `window` days counted back from
    `today`, when the request gives them (phones send `window: 90, today`).
  - Graves: the caller's own (all of them, in `family` mode).
  - `{ action: 'range', from, to }` answers just the dated kinds' rows from those days (no graves, no
    merge), for looking back.
- **Readable tabs** start with a **Who** column (`db.people[ownerOf(it)]`).
- **An id two people can share** (a day's steps in Fitness, whose id is the day; an alcohol-free day
  or the goals in Drinks; a show or an episode in Podcasts, whose id comes from its feed) is kept
  per person: the script stores it under `<who>~<id>` (Podcasts: `<who>/<id>`), graves too, and sends
  each phone its own by the plain id. Otherwise the second person's would be refused as someone else's.

## The app's side

Fitness's is the reference: the sync section of `fitness/app.js`.

1. **No link, phrase or Sheet settings on the phone.**
   - aOS (Account → Google Sheets) is the one place a Sheet is set up; the apps have no Sheet row or
     sheet of their own, and sync by themselves.
   - A real sync error shows one toast an app session; none for `signin` or `no-sheet` (the owner
     sets it up in aOS, so nobody else is nagged).
   - The owner's links are in aOS (`USUAL` in `functions/sheet/api`).
2. **Hand over, once.** On start and on sign-in, `handOver()` passes what the phone kept (its
   `-sync`/`-sheet` key, or the IndexedDB copy) to `AllisonOS.sheet.adopt`, and deletes it when that
   says yes.
3. **Sync when signed in:**
   - On start, after a change, when the app comes back to the front, and when the phone comes back
     online.
   - The request: `{ action: 'sync', v, window: 90, today, <kinds>, graves }`. Never a `secret`.
   - Signed out, the app keeps working on the phone; welcome.js and the app's own sign-in ask for Face ID.
4. **Keep 90 days.**
   - Once a sync has worked, drop dated items older than 90 days from the phone after each sync,
     **with no grave** (the Sheet keeps them).
   - Filter them out of the merge, so they don't come back as "local is newer".
   - Undated items (a list, a note, a med, a show) stay.
5. **Look back.** When a view reaches past the 90 days, ask `{ action: 'range', from, to }`. Add what
   comes back to the working copy (it goes again at the next tidy-up), once a range a session.
6. **Words.** "the family's Google Sheet". No link or phrase is ever mentioned to anyone but the owner.

## Tests

- Each app's `scripts/sheet-test.mjs` runs its real script on `fake-sheet.mjs`. `fakeSheet(path,
  SECRET, asAos)` takes the link parameters a test sends by default, and `post(body, params)` sends
  others.
- Each test checks: who gets in; each person gets only theirs (or the family's); another phone can't
  change or delete someone else's; rows from before aOS become the owner's; the 90-day window and
  `range`; the Who column.
- App tests answer `**/sheet/api/<app>` themselves: the fake Sheet, with `who` from the session token
  the page sends.

## Setting it up (the owner, once)

For each of the seven Sheets (Notes' is Places' too):

1. Open the Sheet → **Extensions → Apps Script**.
2. Paste in the app's new `google-sheet-sync.gs`, keeping your `SECRET` line, and save.
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The link stays the same.
4. Then either:
   - open that app on your phone, signed in: it hands the link and phrase it already has over to aOS
     by itself; or
   - in **aOS → Account → Google Sheets**, tap the app and give it the phrase (the link is filled in).

Afterwards, change each Sheet's `SECRET` to a new phrase:

1. Edit `SECRET` in the script.
2. Deploy a new version again.
3. Give aOS the new phrase in **Account → Google Sheets**.

For Notes, two other things read its Sheet with the phrase, so give them the new one too
(`notes/README.md`): the notification server (Cloudflare → its Worker → **Settings → Variables and
Secrets**: `NOTES_SHEET_SECRET`, and `NOTES_SHEET_URL` the first time), and Places' calendar workflow
(GitHub → **Settings → Secrets and variables → Actions**: `NOTES_SHEET_SECRET`). Until then, Notes'
notifications stop.

The old phrase has been on every phone that synced, and this way it opens nothing any more. Nobody
else has to do anything: each phone syncs through aOS once its app is signed in.
