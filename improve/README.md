# Improve

One list for feedback about the aOS apps: a bug, an improvement or an idea,
jotted down as it comes to you, so the changes can be made in one go rather
than one by one. When there's enough in it, ask Claude to "work through
Improve": Claude reads the open items from the family's Google Sheet and makes
the changes in a batch.

- **One screen.** At the top, a box to type in, with two small pickers under
  it: **Kind** (Bug, Improvement or Idea; Improvement at first) and **App**
  (General, aOS, or any app, from `home/welcome.js` `NAMES`; General at first).
  Tap **Add** (the page's one main button). The kind and app stay as they were
  for the next one (`allison-improve-v1-add`), so a run of items about one app
  is one tap each. ⌘ or Ctrl + Return adds from a keyboard.
- **The list**, newest first, under two capsules, **Open** and **Done**, with
  the shared sliding thumb (`home/slide.js`, as Travel's Upcoming and Past).
  Each item shows what it says, its kind and app as small pills, and when it
  was added ("Nov 2"), or when it was done; someone else's says whose.
- **An item's sheet** (tap it): change what it says (kept as you type), its
  kind (a choice) and its app (a select), the **Done** switch (it moves to
  Done, with Undo), and **Delete** (a danger row that asks again, then Undo).
  Built from `home/settings.js`'s rows. Someone else's item shows what it is,
  and says only they or the family's owner can change it.
- **Settings** (the gear): Design (the four looks), Your data (**Export as a
  spreadsheet**: a CSV of every item, with the Sheet's columns), and Family
  account (how the list stands, and **Sign in with Face ID**).

## The data

On the phone, `localStorage`:

| Key | What |
|---|---|
| `allison-improve-v1` | `{ v: 1, items: [{ id, text, kind, app, status, added, at, doneOn, by, updated }] }` |
| `allison-improve-v1-graves` | `items:<id> → when it was deleted`, so the Sheet and the other phones delete it too |
| `allison-improve-v1-synced-at`, `-who`, `-people` | the last sync, who this phone's person is, the family's first names |
| `allison-improve-v1-add`, `-show` | the add box's kind and app; Open or Done |

`kind` is `bug`, `improvement` or `idea`; `app` is an app's id (`drinks`,
`house`), `aos` or `general`; `status` is `open` or `done`; `added` and
`doneOn` are the phone's days (`2026-11-02`), `at` when it was added (ms).
Every change stamps `updated`; the newest wins.

## The family's Google Sheet

Improve keeps its list in **one Google Sheet for the whole family**
(`aOS/SHEETS.md`, kind `family`), through aOS, as Travel and Meals do:

- **Everyone sees every item**, each marked with whose it is (`by`), so anyone
  in the family can report a bug. Nothing is Just me.
- **Only its own person changes or deletes an item, and the owner** (who works
  through the log and marks items done). The script holds to that whatever a
  phone sends; the app doesn't offer the edits either.
- **Nothing is dated**: every phone keeps every item (no 90-day window); a
  `range` request answers no items.
- **It syncs by itself, signed in**: on start, a couple of seconds after a
  change, when the app comes back to the front, when the phone comes back
  online, and when you sign in. Every sync goes through aOS
  (`../home/sheet.js`, `functions/sheet/api`): the phone holds no link or
  phrase, and Improve has no Sheet settings. Signed out, it works on the phone
  alone, and the list goes to the Sheet once you sign in. A real error shows
  one toast a session; none while signed out or before the owner has set the
  Sheet up.
- **The readable tab, `Improve`**, is rebuilt on every change: **Who, Added,
  Kind, App, Status, Text, Done on**, open items first (newest first), then the
  done ones (last done first). This is the tab Claude reads. Change items in
  the app, not in the tab: it's written over. The hidden tabs `_items`,
  `_deleted` and `_people` are what the app syncs with.

### Setting up the Sheet (the owner, once)

1. Make a new Google Sheet ([sheets.new](https://sheets.new)) and name it, say,
   "aOS Improve".
2. In it, **Extensions → Apps Script**. Delete what's there and paste in all of
   `improve/google-sheet-sync.gs`.
3. Change the `SECRET` line to a long random phrase of your own (at least 16
   characters; aOS refuses a shorter one), for example
   `const SECRET = 'maple-otter-47-lantern-quiet-river';`, and save.
4. **Deploy → New deployment → Select type: Web app**. Execute as: **Me**. Who
   has access: **Anyone**. **Deploy**, and allow it when Google asks (it only
   reads and writes this Sheet). Copy the **Web app URL**
   (`https://script.google.com/macros/s/…/exec`).
5. In aOS, signed in as the owner: **Account → Owner tools → Google Sheets →
   Improve → Set up**. Paste the link and the phrase, and **Save**. aOS checks
   them with the script before it keeps them, and says Connected.

That's all: each phone syncs by itself the next time Improve opens signed in.
To change the phrase later, edit `SECRET`, **Deploy → Manage deployments → ✏️ →
Version: New version → Deploy** (the link stays the same), and give aOS the new
phrase in the same place. After changing the script itself, deploy a new
version the same way.

### Working through it with Claude

Ask Claude to "work through Improve". Claude reads the `Improve` tab with its
Google Sheets connector, makes the open items' changes (a pull request per
batch, following `CLAUDE.md`), and tells you which ones it did; mark those done
in the app (or the owner's phone does, from the list).

## From your helper, in any app

Tell your helper about it wherever you are (Travel, Orders, Notes, aOS Home…): "log a bug: the
flight card is blank" and it adds the item for you, kind and app filled in (the app you're in,
unless you say another), with Undo in the chat. It can also read the list ("what's on Improve?")
and change an item or mark it done when you ask.

- **How:** every helper has three tools (`server/ipsy.js` `IMPROVE_TOOLS`: `log_improvement`,
  `list_improvements`, `update_improvement`), run on the phone by `home/ipsy.js` through
  `home/sheet.js` (`AllisonOS.sheet.improve`), which writes in this app's own sync protocol to
  `/sheet/api/improve`, so what it sends is what Improve would have sent.
- **Before the Sheet is set up, or signed out or offline:** the item waits in aOS's outbox on the
  phone (`localStorage` `aos.improve.outbox`, shared code's key), goes to the Sheet with the next
  write that works, and Improve takes it in when it next opens (and empties the outbox).
- Tests: `improve/scripts/sheet-test.mjs` (what `home/sheet.js` sends, on the real script) and
  `travel/scripts/ipsy-test.mjs` (a bug logged from Travel's chat, kept on the phone, and Undo).

## Files

- `index.html`: the page (Sea glass, then the Vintage block; Layers and Tron
  made from Vintage by `aOS/scripts/make-looks.mjs`).
- `app.js`: everything else: the list, the sheets, Settings and the sync.
- `google-sheet-sync.gs`: the family Sheet's Apps Script.
- `sw.js`, `manifest.webmanifest`; `icon.svg` (Vintage) and `icon-glass.svg`
  (Sea glass) → their pngs by `scripts/make-icons.mjs`; the Layers and Tron
  icons and `icon-pebble.svg` by `make-looks.mjs`.

## Tests

```
node improve/scripts/sheet-test.mjs   # the real script on an in-memory Sheet (drinks/scripts/fake-sheet.mjs)
node improve/scripts/app-test.mjs     # the page at iPhone size, both designs, and the Sheet sync end to end
```

`sheet-test.mjs` checks who gets in, that the family sees every item, that
nobody but its own person (or the owner) can change or delete one, rows with no
`by` becoming the owner's, the Who column, and that nothing is dated.
`app-test.mjs` adds, edits, marks done and deletes items (with Undo), checks
the pickers are remembered, Open and Done, Settings (Design first, Export, the
family account), Vintage and Standard in light and dark, and two phones kept in
step through the fake Sheet, answering `**/sheet/api/improve` itself. Both run
in CI (`.github/workflows/apps-check.yml`).
