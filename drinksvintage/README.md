# Drinks Vintage

[Drinks](../drinks/README.md) in a mid-century modern look, as its own app. It
does everything Drinks does - the week and its one number, a day's sheet with
your usual drinks one tap away, Something else, alcohol-free days, goals, the
eight Analysis views, bringing in the ABV Tracker, export and delete - and its
log is the same private log in your family account. The features, the sums and
how the account sync works are described in `drinks/README.md`; this page
covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: today in the week is a mustard disc,
  the week's bar and the chart columns are teal, weeks and days over a limit are
  burnt orange (with the ▲ as before), alcohol-free days are olive, and the
  Week / Month and By name / By kind switches have a mustard thumb;
- each kind of drink keeps its own dot and bar colour, now from the same
  palette (beer mustard, wine orange, spirits walnut, cocktail teal, seltzer
  light teal, cider olive, other taupe); the name is always written too;
- three atomic shapes (a mustard sun, a teal dot, an orange pill) behind the
  title that scroll away with the page, and three little bars under it;
- solid burnt-orange buttons (+, Done, Add, Sign in); outlined teal for
  Cancel, and an outlined olive Alcohol-free day;
- the Analysis view picker is a walnut pill with a mustard disc, as in Home
  Vintage; its menu is a cream panel;
- Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Drinks Vintage is drawn this way for everyone:
the style picker in the design canvas is not built. It follows the phone's
Light or Dark, or aOS's own choice, like every app.

**The sky.** The page behind the title is Weather Vintage's: by day (Light) a cream
ground washed with mustard, with the sun and rays that turn very slowly; by night
(Dark) a walnut ground washed with deep teal, with the moon and twinkling stars.
It follows Light or Dark (the phone's, or the choice in aOS) and holds still with
reduced motion. `../home/sky.js` does it for every Vintage design and aOS (loaded in
`<head>`, listed in `sw.js`); this app only gives its disc its colour
(`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to its
header. Checked by `aOS/scripts/sky-test.mjs`.

## Google Sheet sync

Drinks Vintage has the same **More → Google Sheet sync** as Drinks, with its Log tab that goes both ways (see
`drinks/README.md`, "Google Sheet sync"), and the same script: paste `drinks/google-sheet-sync.gs` into your Sheet. The
two apps keep their own link and code (`allison-drinksv-v1-sheet`, and an IndexedDB copy, `allison-drinksv`), so
connect each; they can use the same Sheet and phrase, and then each drink is in the Log tab once. Its test is
`drinksvintage/scripts/app-test.mjs`, which runs Drinks' script and fake Sheet (`../../drinks/scripts/fake-sheet.mjs`).

## What is separate from Drinks

It is a second copy of Drinks' page and script, not a setting, so the two can
change independently and Drinks is never touched.

- **Own storage.** Every key is `allison-drinksv-v1…` (Drinks' is
  `allison-drinks-v1…`: the log, its graves, the sync marker, the Analysis
  view, the week/month choice and the by name / by kind choice), and the
  offline cache is `drinksvintage-v2`. So each app has its own copy of the log
  on the phone. Signed in, the two copies are kept in step through the account
  (below); signed out, a drink logged in one is not in the other. Each Home
  Screen app on iOS has its own storage anyway.
- **The same private log in your account.** Its calls go to Drinks' route
  (`../drinks/api/sync`, which is `/drinks/api/sync`), so signed in it reads and
  writes the very same `drinks:<your id>` log as Drinks: only you can see it,
  it follows you to another phone, a drink logged in either app turns up in the
  other (the newer copy of each item wins, and a delete leaves a grave, as
  between two phones), and Calendar's Drinks layer shows it. When the owner
  removes someone from the family, aOS deletes the log, for both. This needs
  nothing new on the server: the route checks your own session and its
  `X-Drinks: 1` header, neither of which depends on which page called it.
  The 4-second wait before saving and the "write only when something changed"
  rule are as in Drinks; two phones each with both apps is four copies keeping
  in step, still a few writes a night.
- **Nothing to register for sign-in.** Sign-in is the family account's passkey
  (Face ID), which belongs to the site, not to an app, so there is no redirect
  address to add (unlike Orders Vintage). Each Home Screen app keeps its own
  session, so the first time it is opened from the Home Screen, More offers
  **Sign in with Face ID**, as in Drinks.
- **Calendar** still opens **Open in Drinks** (Drinks, not Drinks Vintage); the
  `?date=YYYY-MM-DD` link works in both. Calendar's week-start setting is read
  as in Drinks.
- **The same sums.** `calc.js` is the same file as Drinks' (checked by
  `scripts/same-reader-test.mjs`), so a standard drink, a streak and the
  Analysis weeks come out the same in both. When `drinks/calc.js` changes, copy
  it over: `cp drinks/calc.js drinksvintage/calc.js`.
- **The server route has no copy and no test here** (`functions/drinks/api`,
  tested by `drinks/scripts/api-test.mjs`).
- **Status bar.** `default`, not `black-translucent`: that one always draws the
  clock white, which vanishes on the cream theme.

## Files

- `index.html`: Drinks' page and style sheet, with the Retro look as the last
  block. `app.js`: Drinks' script with the storage key and the route changed
  and nothing else. `calc.js`: the sums, as Drinks'.
- `sw.js`: the offline shell (`drinksvintage-v2`; network-first; `api/` is left
  alone, including `../drinks/api/`).
- `icon.svg` → `icon-180.png`, `icon-512.png`: a cream wine glass, the level of
  the wine cut out of it, on olive with a mustard sun and an orange pill, drawn
  by `scripts/make-icons.mjs`.

## Tests

```
node drinksvintage/scripts/app-test.mjs          # Drinks' browser test, run on this app, plus the Retro look and the shared log (needs Playwright)
node drinksvintage/scripts/same-reader-test.mjs  # calc.js is Drinks' calc.js
node drinksvintage/scripts/make-icons.mjs        # redraws the icons from icon.svg
```

`app-test.mjs` is Drinks' own browser test (the real server route behind the
page, two phones in step, signed out, accounts not yet on, every Analysis view,
no sideways scroll) run on this app, without Calendar's layer (that is Drinks'
to check), plus: it is drawn in the Retro look in light and dark (Futura, the
ground, flat cream or walnut cards and sheets, the mustard sun, teal dot and
orange pill, orange buttons, a mustard thumb on Week / Month and oz / ml, the
walnut view pill, teal, orange and olive columns); every key it stores is its
own; its sync goes to Drinks' route; and Drinks, opened on the same account,
has the drink logged here (CI: `apps-check.yml`).
