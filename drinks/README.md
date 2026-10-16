# Drinks

A simple log of what you drink, as a home-screen web app with two designs:
mid-century Vintage (the default) and Sea glass, the same frosted glass as
Fitness (below, "The two designs"). It replaces the ABV Tracker (a single HTML file kept in
Google Drive) and is kept deliberately small: the week, and for each day its
standard drinks or "alcohol-free".

- **One screen, the week**: one number at the top (with **Analysis ›** beside it,
  because tapping it opens the analysis), the week's standard drinks against the
  weekly limit you set (amber once you're over), with how many alcohol-free
  days you've had against your goal. Under it, seven rows, one a day: what you
  had ("Beer ×2, Wine") and its standard drinks (amber over your daily limit),
  or Alcohol-free, or Not logged. Arrows (or a sideways swipe)
  move a week at a time; the calendar button comes back to this week.
- **A day**: tap it (or **+** for today) and its sheet opens.
  - **Your usual drinks** sit there as six tiles: the ones you've had most in
    the last four months, then the ABV Tracker's presets (beer, IPA, wine,
    large wine, a shot, a cocktail). One tap logs one, at the time you tapped
    it, with **Undo**.
  - **Something else…** for anything new: pick the kind (it fills in a
    typical size and strength), then the size in oz or ml, the strength, how
    many, and optionally a time, a name and a note. It shows the standard
    drinks as you go. A cocktail is logged as the spirit in it.
  - Tap a drink to change it, or its ✕ to delete it (with **Undo**).
  - A day with nothing logged has **Alcohol-free day**, one tap (tap again to
    take it back). Logging a drink on an alcohol-free day makes it a drinks day.
- **Analysis** (tap the week's number: it says **Analysis ›**): one page, and a
  glass pill at the bottom (the same pill as Home's view picker) picks what it
  shows. Its menu opens upwards and says in a line what each view holds. The page
  remembers the view you left it on, and it opens on the first the first time.
  Every chart has its numbers as a table too, and over-limit weeks carry a ▲ as
  well as a colour. Tap a week or a day on a chart to read it.
  - **Compared with before**: the last 7 days against the 7 before, or the last 4
    weeks against the 4 before (a Week / Month switch). Standard drinks, days you
    drank, alcohol-free days and a day's average, each with its change (an arrow
    and the number, never colour alone); your alcohol-free streak and your best;
    the most in one day; how many days weren't logged; and the standard drinks by
    kind of drink.
  - **Weekly drinks**: a column of standard drinks a week for the last twelve
    weeks against your weekly limit, with a 4-week average of finished weeks.
  - **Weeks over the limit**: *n* of *m* weeks, a tile and a row for each week,
    how many weeks in a row you're under now, and your best run.
  - **Top drinks**: what you had most often against what adds up to the most
    standard drinks, by the name you gave a drink or by its kind.
  - **Days of the week**: the average on each day, against your daily limit.
  - **Alcohol-free days**: a column a week against your goal.
  - **Days over the limit**: the days a week above your daily limit.
  - **Strength and size**: the average strength (ABV) of what you drank, and the
    standard drinks in an average drink, week by week.

  The twelve weeks run Sunday to Saturday (or Monday, as Calendar), the newest
  being this week so far, drawn lighter; a week counts against the limit once it
  is over, or finished. Days you didn't log are left out of averages, so a week
  with gaps can read low; each view says how many there were. There are no tips
  for cutting down yet.
- **More** (the person button): the design (Vintage or Standard), your
  account, your goals (a week at most, a day at most, alcohol-free days a week), **Bring in ABV Tracker history**,
  **Export** (CSV) and **Delete all data**.

## The two designs

One app, one log: the design changes only how Drinks looks, at once, and is
kept on this phone (**More → Design**, the first section; More is Drinks'
settings), as in Clock. `../home/design.js`, loaded in `<head>`, applies it
before the page is drawn. Every tap, swipe, sheet and chart works the same in
both.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home and Orders:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass;
  - mustard, teal, burnt orange and olive: today in the week is a mustard disc,
    the week's bar and the chart columns are teal, weeks and days over a limit
    are burnt orange (with the ▲ as before), alcohol-free days are olive, and
    the Week / Month, By name / By kind and oz / ml switches have a mustard
    thumb;
  - each kind of drink keeps its own dot and bar colour, from the same palette
    (beer mustard, wine orange, spirits walnut, cocktail teal, seltzer light
    teal, cider olive, other taupe); the name is always written too;
  - three atomic shapes (a mustard sun, a teal dot, an orange pill) behind the
    title that scroll away with the page, and three little bars under it;
  - solid burnt-orange buttons (+, Done, Add, Sign in); outlined teal for
    Cancel, and an outlined olive Alcohol-free day;
  - the Analysis view picker is a walnut pill with a mustard disc, as in Home;
    its menu is a cream panel;
  - Futura, which iOS has built in, so no font is downloaded.

  **The sky.** Behind the title is the shared Vintage sky (`../home/sky.js`,
  as in every Vintage design), with the real sun: by day a ground washed with
  mustard, the sun and rays that turn very slowly; after sunset a ground washed
  with deep teal, the moon and twinkling stars; each over cream (Light) or
  walnut (Dark). Sunrise and sunset are for the phone's place (kept on the
  phone, to a tenth of a degree, and only if the app already has location
  permission: it never asks), else the time zone, and the sky changes by itself
  while the app is open. It holds still with reduced motion. This app only
  gives the sun its colour (`--sky-disc`) and keeps its own sizes and places
  for the shapes, tuned to its header. Checked by `aOS/scripts/sky-test.mjs`.
- **Standard**: Sea glass: Fitness's tokens, faint tiles and Liquid Glass
  sheets, with only the pieces Drinks uses; no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The choice is `localStorage` `design.drinks`; the script draws nothing in
colour itself, so only the Week / Month thumb is measured again on a change
(Futura and the system font are different widths). What iOS reads when Drinks
is added to the Home Screen follows it: the icon (`icon-180.png`, Vintage: a
cream wine glass, the level of the wine cut out of it, on olive with a mustard
sun and an orange pill; `icon-glass-180.png`, Standard: "Plum", a white wine
glass on dusty plum), the status bar style (`default` in Vintage, where
`black-translucent`'s white clock would vanish on the cream) and the bar
colours.

**The old Drinks Vintage app.** Drinks Vintage used to be an app of its own
(`drinksvintage/`, with its own copy of the log on the phone, and its calls
already going to this app's route). Its address now opens this same app (the
deploy copies `drinks/` there, `.github/workflows/news.yml`), so a phone that
added it keeps it. The first time it opens there, `design.js` moves that app's
data on the phone over to Drinks' names (`allison-drinksv-v1…` →
`allison-drinks-v1…`: the log, its graves, the sync marker, the Google Sheet
link and code, the Analysis view and switches; the IndexedDB copy of the Sheet
link `allison-drinksv` → `allison-drinks`; and what it had seen, so no
walkthrough again), unless Drinks already has data on that phone; nothing old
is deleted. Signed in, the log was the same private log in your account in
both, so nothing is lost either way. Its calls go to `../drinks/api/` (not
`api/`), so they reach your account from either address.

## The sums

A standard drink is the US one, 14 g of alcohol: a drink's alcohol is
millilitres × how many × ABV ÷ 100 × 0.789 (the density of ethanol), with a
fluid ounce of 29.5735 ml. So 12 oz of 5% beer, or 1.5 oz of 40% spirits, is
one. These are the ABV Tracker's own figures, so a drink brought in from it
counts the same here.

Averages count the days you logged, drinks or alcohol-free: a day you didn't
log is left out rather than counted as zero. The
alcohol-free streak counts days marked alcohol-free in a row; today doesn't
break it until the day is over (the ABV Tracker's streak read 0 every morning).

`calc.js` has the sums, with no page (the weeks, top drinks and weekdays of
the Analysis charts too), so they're tested in Node (`scripts/calc-test.mjs`).

## Your account: private to you

Each person in the family keeps their own log. Signed in to the family account
(Face ID, as Calendar and Travel), the log is kept in that account too, as
`drinks:<your id>` in the accounts' Workers KV (`functions/drinks/api`,
`server/auth.js`), so it follows you to another phone. Nobody else can read
it: every call needs your own session, and there is no call for anyone else's
log, not even in the owner's tools. When the owner removes someone from the
family, aOS deletes their log.

- **Signed out**, More says so and offers **Sign in with Face ID**; the log is
  kept on the phone meanwhile, and goes to your account once you sign in.
- **Before family accounts are switched on** (aOS/RELEASING.md, "Family
  accounts"), or on GitHub Pages (no server there), the log simply stays on the
  phone.
- If someone else signs in on the same phone, the last person's log is cleared
  from the phone (it's safe in their account) before the new person's comes in.

It is built for Cloudflare's free plan:

- **Writes**: Workers KV allows 1,000 a day across the whole account, and
  Mail's and Notes' push workers use some. Drinks waits 4 seconds after your
  last change before it saves, and the server writes only when something
  changed, so a night's drinks are a few writes, and opening the app writes
  nothing.
- **CPU**: a request gets 10 ms. A phone sends only what changed since it last
  saved, and hears everything back only when another phone has changed the log
  since. Merging into a log of 1,000 drinks took 2–6 ms in Node on the machine it was built on; that is
  a guide, not a measurement on Cloudflare.
- **Reads** (100,000 a day) and **requests** (100,000 a day) are far from the
  limit.

Every item carries when it last changed and anything deleted leaves a grave,
as in Fitness's Google Sheet sync, so the newer copy wins and a phone that
hasn't heard of a delete can't bring the drink back. **Delete all data**
deletes everything that way, so your other phones delete it too.

## Calendar

Calendar has a **Drinks** layer, off until you turn it on in its settings: your
own standard drinks each day and your alcohol-free days, read from your account
(`GET /drinks/api/summary`), so it works even though each Home Screen app keeps
its own storage. Calendar keeps it in memory only, and it has no **Add to the
Family calendar**. **Open in Drinks** opens that day (`?date=YYYY-MM-DD`).

## Bringing in the ABV Tracker

**More → Bring in ABV Tracker history** takes either:

- its **JSON backup** (ABV Tracker → History → Export JSON backup), or
- its Google Sheet's **Log tab**, downloaded as CSV (open the Sheet, the Log
  tab, **File → Download → Comma-separated values**).

Drinks come in with their own ids, so bringing the same file in twice adds
nothing. Alcohol-free days come in as alcohol-free (unless the day has drinks);
"Unknown day" rows are days not logged, so they bring nothing; the
connection-test row is skipped; and from the backup its goals come
too if you haven't set any. Names lose the size and strength the tracker put in
them ("Wine large 8oz 14%" becomes "Wine large"; the size and strength are on
their own line). Its Google Sheet sync link and secret are never read.

After that the ABV Tracker can be retired: in its Sheet, **Extensions → Apps
Script → Deploy → Manage deployments**, archive the web app, so nothing can
write to the Sheet any more.

## Google Sheet sync

Optional. **More → Google Sheet sync** backs your log up to a Google Sheet of your own, and the Sheet's
**Log** tab goes both ways: almost every drink comes from the app, but a row changed or added in the Sheet
comes back. Your log is already kept in your family account; the Sheet is a second copy you can read, filter
and edit. It is private to you like the account: each person uses a Sheet of their own, and another person
who signs in on the same phone is not connected to yours (their log replaces it, and the link is forgotten).
It uses the same design as Fitness's (read `fitness/README.md`, "Google Sheet sync").

1. [sheets.new](https://sheets.new) → name it, e.g. **AllisonOS - Drinks**. Use a new Sheet, not your old ABV
   Tracker's: the Log tab is rebuilt in place (rows it can read are kept, rows it can't are left with a note, and
   the ABV Tracker's own "Unknown day" and connection-test rows are dropped).
2. **Extensions → Apps Script**, replace `Code.gs` with the whole of [`google-sheet-sync.gs`](google-sheet-sync.gs),
   and change `const SECRET = 'CHANGE-ME';` to a long phrase of your own (you make it up: there is nothing to look up).
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone* → **Deploy** → authorise →
   copy the **Web app URL**.
4. Drinks → **More → Google Sheet sync** → the link is already filled in (`SHEET_URL` in `app.js`: the owner's Sheet; to
   use another, paste its URL over it) → type the phrase → **Connect and sync**. The phrase is never in the code. **Copy setup
   link** sets up your other phone.

**The Log tab** has the ABV Tracker's columns, newest first: `Timestamp, Date, Time, Name, Category, Volume, Unit,
ABV, Qty, StandardDrinks, GramsAlcohol, Note, EntryID`, and a `Check` column that only has something in it when a
row you typed needs fixing. An alcohol-free day is a row whose Category is `alcohol-free`. The Sheet also holds
hidden tabs (`_entries`, `_days`, `_prefs`, `_deleted`, `_rows`) that the app reads back.

**What you can do in the Log tab**
- **Change a row**: the app takes the change if it is newer than the app's own copy (the Timestamp fills itself in
  when you edit). StandardDrinks and GramsAlcohol are worked out for you.
- **Add a row**: fill in Date (`2026-10-12` or `10/12/2026`), Name, Category, Volume, Unit (`oz` or `ml`) and ABV;
  Qty is 1 if left empty, Time is optional. The EntryID and sums fill themselves in.
- **Remove a drink**: set its Qty to **0** (an alcohol-free day too). Deleting a row does not remove the drink: the
  app puts it back at the next sync, because a deleted row looks the same as one the Sheet hasn't heard of.
- A row that can't be read (no date, no size, a strength outside 0 to 100) stays where it is with a note in
  `Check`, and is not sent to the app until you fix it.

**When it syncs**: when you connect, a couple of seconds after any change, when the app is opened or comes back to
the front, and when the phone comes back online. A change typed in the Sheet is picked up at the next sync (any
phone's, or **Sync now**), not the moment you type it. How changes merge is as in Fitness: the newest change to a
drink wins, wherever it was made, and a deletion reaches the other phones.

## Files

- `index.html`: the page and its two looks: Standard (Fitness's tokens, tiles
  and Liquid Glass sheets, with only the pieces Drinks uses) and Vintage, the
  `<style id="vintage">` block after it.
- `app.js`: the app, Analysis included (the charts are plain inline SVG).
  `calc.js`: the sums and the ABV Tracker import.
- `sw.js`: the offline shell (network-first; `api/` is left alone).
- `icon.svg` → `icon-180.png`, `icon-512.png` (Vintage: a cream wine glass on
  olive), and `icon-glass.svg` → `icon-glass-180.png`, `icon-glass-512.png`
  (Standard, "Plum": a white wine glass on dusty plum, one of the Sea glass
  tints), drawn by `scripts/make-icons.mjs`.
- `google-sheet-sync.gs`: the Apps Script that goes in your Sheet.
- `../functions/drinks/api/[[route]].js`: your log in your account.

## Tests

```
node drinks/scripts/calc-test.mjs    # the sums and the import
node drinks/scripts/api-test.mjs     # the server route, on Workers KV in memory
node drinks/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (fake-sheet.mjs)
node drinks/scripts/app-test.mjs     # the app in Chromium at iPhone size, both designs, the old Drinks Vintage address (needs Playwright)
node drinks/scripts/make-icons.mjs   # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```

`app-test.mjs` runs the real server route behind the page, so it covers two
phones kept in step, a delete travelling between them, signed out, accounts
not yet on, Calendar's layer, and the Google Sheet (the real script, on a fake Sheet).
It runs in Vintage, the default, and also checks: the Retro look in light and
dark (Futura, the ground, flat cream or walnut cards and sheets, the shapes
behind the title, orange buttons, mustard thumbs, the walnut view pill, teal,
orange and olive columns); Standard (the Vintage block off, no sky, the Sea
glass ground, icon and status bar); More → Design switching both ways at once
and kept across a reload; and the old Drinks Vintage address (served from
`drinks/`, as the deploy does): its data moved over once, what it had seen
carried over, nothing old deleted, a phone with both keeping Drinks' own, and
its sync going to Drinks' route.
