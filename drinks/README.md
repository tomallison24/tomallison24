# Drinks

A simple log of what you drink, as a home-screen web app in the same frosted
glass as Fitness. It replaces the ABV Tracker (a single HTML file kept in
Google Drive) and is kept deliberately small: the week, and for each day its
standard drinks or "alcohol-free".

- **The week**: one number at the top, the week's standard drinks against the
  weekly limit you set (amber once you're over), with how many alcohol-free
  days you've had against your goal. Under it, seven rows, one a day: what you
  had ("Beer ×2, Wine") and its standard drinks (amber over your daily limit),
  or Alcohol-free, Don't remember, or Not logged. Arrows (or a sideways swipe)
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
  - A day with nothing logged has **Alcohol-free day** and **Don't remember**,
    one tap each. Logging a drink on an alcohol-free day makes it a drinks day.
- **Analysis** (from the pill at the bottom): the last 7 days against the 7
  before, or the last 4 weeks against the 4 before. Standard drinks, days you
  drank, alcohol-free days and a day's average, each with its change (an
  arrow and the number, never colour alone); your alcohol-free streak and
  your best; the most in one day; how many days weren't logged; and the
  standard drinks by kind of drink.
- **More** (the person button): your account, your goals (a week at most, a
  day at most, alcohol-free days a week), **Bring in ABV Tracker history**,
  **Export** (CSV) and **Delete all data**.

## The sums

A standard drink is the US one, 14 g of alcohol: a drink's alcohol is
millilitres × how many × ABV ÷ 100 × 0.789 (the density of ethanol), with a
fluid ounce of 29.5735 ml. So 12 oz of 5% beer, or 1.5 oz of 40% spirits, is
one. These are the ABV Tracker's own figures, so a drink brought in from it
counts the same here.

Averages count the days you logged, drinks or alcohol-free: a day you didn't
log, or marked Don't remember, is left out rather than counted as zero. The
alcohol-free streak counts days marked alcohol-free in a row; today doesn't
break it until the day is over (the ABV Tracker's streak read 0 every morning).

`calc.js` has the sums, with no page, so they're tested in Node
(`scripts/calc-test.mjs`).

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
nothing. Alcohol-free and unknown days become marked days (unless the day has
drinks), the connection-test row is skipped, and from the backup its goals come
too if you haven't set any. Names lose the size and strength the tracker put in
them ("Wine large 8oz 14%" becomes "Wine large"; the size and strength are on
their own line). Its Google Sheet sync link and secret are never read.

After that the ABV Tracker can be retired: in its Sheet, **Extensions → Apps
Script → Deploy → Manage deployments**, archive the web app, so nothing can
write to the Sheet any more.

## Files

- `index.html`: the page and its look (Fitness's tokens, tiles, Liquid Glass
  sheets and view pill, with only the pieces Drinks uses).
- `app.js`: the app. `calc.js`: the sums and the ABV Tracker import.
- `sw.js`: the offline shell (network-first; `api/` is left alone).
- `icon.svg` → `icon-180.png`, `icon-512.png` ("Cellar": a white wine glass on
  a rosé-to-plum sky), drawn by `scripts/make-icons.mjs`.
- `../functions/drinks/api/[[route]].js`: your log in your account.

## Tests

```
node drinks/scripts/calc-test.mjs    # the sums and the import
node drinks/scripts/api-test.mjs     # the server route, on Workers KV in memory
node drinks/scripts/app-test.mjs     # the app in Chromium at iPhone size (needs Playwright)
```

`app-test.mjs` runs the real server route behind the page, so it covers two
phones kept in step, a delete travelling between them, signed out, accounts
not yet on, and Calendar's layer.
