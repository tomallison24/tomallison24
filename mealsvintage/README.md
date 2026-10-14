# Meals Vintage

[Meals](../meals/README.md) in a mid-century modern look, as its own app. It
does everything Meals does - Dinners (plan a few nights of different dinners
around one meat, accept the plan, past plans, a recipe for each night), Deals
(this week's sales at the family's stores, sorted like a grocery list), List
(the shopping list, ticked off in the store), the gear (stores, member cards,
what the family never eats, your account) and the optional Google Sheet copy -
and it is the same family plan, deals and settings. The features, the AI, the
allergy check and the costs are described in `meals/README.md`; this page covers
what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage, Orders Vintage and Drinks Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the Dinners / Deals / List tabs have a
  mustard thumb, the chosen meat, store, card and allergy chips are mustard, a
  ticked item is a teal disc, what is on sale is olive, a new plan waiting to be
  accepted is a mustard-outlined card;
- three atomic shapes (a mustard sun, a teal dot, an orange pill) behind the
  title that scroll away with the page, and three little bars under it;
- solid burnt-orange primary buttons (+, Plan dinners, Accept plan, Save,
  Done, Connect and sync, Sign in); outlined teal for the others (Try again,
  Look again, Copy the list); outlined in the edge colour for Discard and
  Paste deals; Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Meals Vintage is drawn this way for everyone: the
style picker in the design canvas is not built. It follows the phone's Light or
Dark, or aOS's own choice, like every app.

**The sky.** The page behind the title is Weather Vintage's, with the real sun: by
day a ground washed with mustard, the sun and rays that turn very slowly; after
sunset a ground washed with deep teal, the moon and twinkling stars; each over
cream (Light) or walnut (Dark). Sunrise and sunset come from the same equation as
Weather Vintage's, for the phone's place (kept on the phone, to a tenth of a degree,
and only if the app already has location permission: it never asks), else from the
time zone, and the sky changes by itself while the app is open. It holds still with
reduced motion. `../home/sky.js` does it for every Vintage design and aOS (loaded in
`<head>`, listed in `sw.js`); this app only gives its disc its colour
(`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to its
header. Checked by `aOS/scripts/sky-test.mjs`.

## What is separate from Meals

It is a second copy of Meals' page and script, not a setting, so the two can
change independently and Meals is never touched.

- **Own storage.** Every key is `allison-mealsv-…` (Meals' is `allison-meals-…`:
  the last plan and deals `allison-mealsv-v2`, ticks, the tab, the store, and the
  Google Sheet link and what was sent to it), the Dinners / Deals / List tab
  slide is `mealsv:tab`, the IndexedDB backup of the Sheet link is
  `allison-mealsv`, and the offline cache is `mealsvintage-v2`. So each app has
  its own copy of the last plan on the phone, and its own ticks. Each Home
  Screen app on iOS has its own storage anyway.
- **The same family plan, deals and settings.** Its calls go to Meals' route
  (`../meals/api/…`, which is `/meals/api/…`), so signed in it reads and writes
  the very same `meals:*` data in the family's account: a plan made, accepted or
  discarded in either shows in the other, and so do the deals found and the
  settings saved. Nothing new is needed on the server: the route checks the
  family session and its `X-Meals: 1` header, neither of which depends on which
  page called it (`functions/meals/api/_middleware.js` only asks for a
  signed-in family member). The AI is called once per plan or store either way
  (a week's deals already found are handed back, whichever app asked).
- **Nothing to register for sign-in.** Sign-in is the family account's passkey
  (Face ID), which belongs to the site, not to an app, so there is no redirect
  address to add (unlike Orders Vintage). Each Home Screen app keeps its own
  session, so the first time it is opened from the Home Screen, it offers
  **Sign in with Face ID**, as Meals does.
- **The same Google Sheet script, its own link on the phone.** It has the same
  **Gear → Google Sheet** as Meals, with the same script
  (`meals/google-sheet-sync.gs`: paste that file into your Sheet, no second
  copy here), and the link is already filled in (`SHEET_URL` in `app.js`: the
  owner's Meals Sheet), so only the secret phrase is typed. Each app keeps its
  own link and code (`allison-mealsv-v1-sheet`), so connect each; if both
  connect to the same Sheet, Plans lists each plan once (a plan is keyed by its
  id), and the Shopping list, Deals and Settings tabs show the latest copy from
  either app (they are the same family data). The copy is one way, as in Meals.
- **Tabs of other apps.** Meals has no links to other apps (the List can be
  copied into a Notes grocery list, by pasting).
- **The same sums.** `logic.js` is the same file as Meals' (checked by
  `scripts/same-reader-test.mjs`), so the shopping list, the matching of sales
  and the week come out the same in both. When `meals/logic.js` changes, copy it
  over: `cp meals/logic.js mealsvintage/logic.js`.
- **The server route has no copy and no test here** (`functions/meals/api`,
  tested by `meals/scripts/api-test.mjs`); neither has the Sheet script
  (`meals/scripts/sheet-test.mjs`).
- **Status bar.** `default`, not `black-translucent`: that one always draws the
  clock white, which vanishes on the cream theme.

## Files

- `index.html`: Meals' page and style sheet, with the Retro look as the last
  block. `app.js`: Meals' script with the storage keys and the route changed
  and nothing else. `logic.js`: the sums, as Meals'.
- `sw.js`: the offline shell (`mealsvintage-v2`; network-first; `api/` is left
  alone, including `../meals/api/`).
- `icon.svg` → `icon-180.png`, `icon-512.png`: a cream bowl with steam rising,
  a band cut out of it, on paprika red with a mustard sun and a teal pill,
  drawn by `scripts/make-icons.mjs`.

## Tests

```
node mealsvintage/scripts/app-test.mjs          # Meals' browser test, run on this app, plus the Retro look and the shared plan (needs Playwright)
node mealsvintage/scripts/same-reader-test.mjs  # logic.js is Meals' logic.js
node mealsvintage/scripts/make-icons.mjs        # redraws the icons from icon.svg
```

`app-test.mjs` is Meals' own browser test (the real server route behind the
page, a stand-in AI, deals, a plan, the list, a recipe, past plans, coconut
refused, settings, the Google Sheet copy on a fake Sheet) run on this app,
plus: it is drawn in the Retro look in light and dark (Futura, the ground, flat
cream or walnut cards and sheets, the mustard sun, teal dot and orange pill,
orange buttons, a mustard thumb on the tabs, mustard chosen chips, teal ticks);
every key it stores is its own; its calls go to Meals' route; and Meals, opened
on the same account, has the same plan (CI: `apps-check.yml`).
