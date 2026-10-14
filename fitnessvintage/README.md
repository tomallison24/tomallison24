# Fitness Vintage

[Fitness](../fitness/README.md) in a mid-century modern look, as its own app.
It does everything Fitness does - the week as seven days, a sheet for each day
with the muscle group, exercise, weight, reps and sets (or time and distance
for cardio), search over every exercise, Analysis against the week or month
before, your drinks beside your training, and the optional Google Sheet backup
- with the same layouts. The features, the exercise list, how Analysis judges
a lift and what could not be checked are described in `fitness/README.md`;
this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the Week / Month switch has a mustard
  thumb, today is a mustard disc, the view picker at the bottom is a walnut
  pill with a mustard chip, the + button and the sheet's Done button are solid
  burnt orange, and secondary buttons are outlined teal;
- each muscle group keeps one colour, now drawn from the Retro colours (chest
  orange, back teal, shoulders mustard, arms olive, plus walnut, denim, brick,
  plum, sky and taupe for lower back, core, legs, glutes, cardio and your own).
  They colour the chips, the dots and the bars in Analysis; the name is always
  written beside the colour;
- three atomic shapes behind the title that scroll away with the page, and
  three little bars under it; Futura, which iOS has built in, so no font is
  downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Fitness Vintage is drawn this way for everyone:
the style picker in the design canvas is not built.

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

## What is separate from Fitness

It is a second copy of Fitness' page and script, not a setting, so the two can
change independently and Fitness is never touched.

- **Own storage.** Every key is `allison-fitnessv-v1…` (Fitness' is
  `allison-fitness-v1…`) and the backup copy of the Sheet link is in the
  IndexedDB database `allison-fitnessv`; the offline cache is
  `fitnessvintage-v2`. So each app has its own log and its own Sheet settings.
  A workout logged in one is not in the other, unless both are connected to the
  same Sheet (below).
- **The same Google Sheet, if you like.** Fitness and Fitness Vintage use the
  same Sheet script (`fitness/google-sheet-sync.gs`; there is no copy of it
  here), so pasting one Sheet's link and secret into both keeps the two in
  step: every workout carries the time it was last changed, and the newest wins.
  Or give each its own Sheet. Nothing new is needed in Google: there is no
  sign-in, so no redirect address to add.
- **Drinks.** Analysis reads your own Drinks log through the same server route
  as Fitness (`/drinks/api/summary`, from `../drinks/api/summary`, with your
  family sign-in; only you can read it), so it shows the same numbers. Its
  **Open Drinks Vintage** row opens Drinks Vintage (`../drinksvintage/`), not
  Drinks. Both are separate Home Screen apps; whether iOS opens that address
  inside the installed Drinks Vintage or in Safari is up to iOS (not checked on a
  phone).
- **Calendar.** Calendar's Fitness layer is one layer per person in the family
  account, so Fitness Vintage fills the same layer (`fitness`) as Fitness does;
  the last one to be opened wins until both hold the same log, which they do
  when they share a Sheet. Calendar's **Open in Fitness** link opens Fitness
  (`../fitness/?date=…`), since Calendar doesn't know about the design. Fitness
  Vintage also opens a day from `?date=YYYY-MM-DD`, as Fitness does, and starts
  its week on the day Calendar's setting says.
- **The same Analysis.** `analysis.js` is the same file as Fitness' (checked by
  `scripts/same-reader-test.mjs`), so a lift is judged the same in both. When
  `fitness/analysis.js` changes, copy it over: `cp fitness/analysis.js
  fitnessvintage/analysis.js`.

## Tests

`node fitnessvintage/scripts/app-test.mjs` is Fitness' browser test, run on this
app (with the real Sheet script on an in-memory Sheet), plus checks that it is
drawn in the Retro look: Futura, flat cream (walnut) cards, a mustard thumb, a
mustard today, an orange + button and the shapes behind the title, in light and
dark (CI: `apps-check.yml`). `node fitnessvintage/scripts/same-reader-test.mjs`
checks Analysis is Fitness'. Fitness' own tests of the sums and the Sheet script
(`fitness/scripts/analysis-test.mjs`, `sheet-test.mjs`) cover the shared files.
`node fitnessvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg`
(a cream dumbbell on walnut, with a mustard sun and a burnt-orange pill).
