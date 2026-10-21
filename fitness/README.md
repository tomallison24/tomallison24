# Fitness

A simple workout log as a home-screen web app, in two designs: mid-century
Vintage (the default) or the same frosted Sea glass as Calendar, Notes and
Travel, picked in **Settings → Design** (below). It is kept deliberately small:
the week, and for each day what you did.

- **The week**: seven rows, one a day, each with coloured chips for the
  muscle groups worked and how many exercises and sets. Today is marked. A day you
  drank on (from Drinks, signed in) also shows a small glass and its
  standard drinks. The
  arrows (or a sideways swipe) move a week at a time, and the calendar button
  comes back to this week. Under it, the week's totals: days trained,
  exercises and sets.
- **A day**: tap it and its sheet opens. At the top is what you logged that
  day. Under that, two ways to add an exercise.
- **Search** (quickest): type in the bar to search every exercise in every
  group, plus your own. Tapping a result (or pressing Enter for the first
  one) picks its muscle group and the exercise, and fills in last time's
  numbers, so you only check the weight, reps and sets.
  - Each word you type must start a word of the name or its group, in any
    order. So "db curl" finds Dumbbell Curl, and "press shoulder" finds
    every shoulder press.
  - Short forms work: db, bb, ez, ohp and rdl.
  - Exercises you've done come first, showing what you did last time.
  - If nothing matches, **Add "…"** makes it one of your own; you then pick
    its muscle group.
- **Step by step**, filling in the form from the top down:
  1. **Muscle group**: Chest, Back, Lower back, Shoulders, Arms, Core, Legs
     or Glutes, or **Cardio**.
  2. **Exercise**: a dropdown of that group's exercises (see below). The
     ones you did lately come first, under **Recent**. **Other…** lets you
     type one in, and it stays in that group's list after that, under
     **Yours**.
  3. **Weight, reps and sets**: three dropdowns. Weight is in pounds, in
     2.5 lb steps to 100 and 5 lb steps to 500, or **Bodyweight**. Reps run
     1–50 and sets 1–10. A hold (Plank, Side Plank) asks for **Time**
     instead, from 10 seconds to 5 minutes.
- **Last time**: choosing an exercise fills in the weight, reps and sets
  from the last time you did it, and shows when that was. Bodyweight
  exercises (push-ups, pull-ups, sit-ups and so on) start at Bodyweight.
- **Change or delete**: tap a logged exercise to change it, or its ✕ to
  delete it. Deleting gives you an **Undo**.
- **+**: logs today's workout from any week.
- **Week, Analysis and Meds**: pick between them from the pill at the
  bottom of the screen (**Week ⌃**), as in Home. The menu opens upwards from
  it, and the app remembers the view you were on. See below.
- **Ipsy**: once you turn it on in Settings, ask it about patterns in your own
  workouts, steps, meds and health stats. See Ipsy, below.
- **Steps**: each day shows its steps beside it (a shoe and the count, in the
  accent once you reach your goal), the week's totals add **steps a day**, and
  a day's sheet starts with its steps and a bar to the goal. See Steps, below.

## Meds

A page of its own (**Meds** in the view picker), never on the week, for the
medications and supplements you take. It's for you alone: it asks you to sign
in to your family account first (Face ID, once), so that if the phone is lost,
aOS can erase it (aOS → Account → **Erase aOS from a lost phone**).

- **What you take**: add each one once with **+** (or **Add a medication or
  supplement**): its name, a dose if you like ("1000 IU", "2 capsules"),
  Medication or Supplement, **when** (Morning, Midday, Evening, Bedtime, any
  of them; none means once a day, any time; or **As needed**) and the **days**
  you take it (every day unless you say otherwise).
- **Each day**: a checklist by the time of day. Tap one to tick it off; it
  keeps the time you did. Tap again to take it back. As needed ones have **+**
  (took one) and **−** (take back the last), and are never "missed". The
  arrows (or a sideways swipe) go back a day, to fill in one you forgot.
- **How it's going**: under the checklist, each one you take shows how often
  you took it over the last **7** and **30 days**, and how many **days in a
  row**. Today only counts once everything due today is ticked, so a morning
  check never reads as a miss; days you don't take it on don't break a run.
- **Pause** stops one for a while (nothing due, left out of the numbers);
  **Delete** takes it off the list (with Undo); the days you took it stay in
  your history and in the Sheet.

The sums are in `meds.js`, separate from the page, so they can be tested on
their own.

## Steps

Each day's steps, typed in or read from your own iPhone.

- **Typed in**: open a day and type its steps at the top. A number you type is
  never replaced by your iPhone's; clear it and your iPhone's fills it in again.
- **From your iPhone**: the Home Assistant app on an iPhone has a **Steps**
  sensor: the phone's own motion chip, steps since midnight (it isn't Apple
  Health, so an Apple Watch's steps aren't in it). Fitness reads it through
  aOS (`../fitness/api/`, `functions/fitness/api`), which holds the Home
  Assistant token, so no phone keeps one that could run the house. Link your
  phone once in **Settings → Steps**: pick it from the list (or type its
  sensor's name, `sensor.<your_phone>_steps`, if the list can't be shown).
  Once it's linked to you, no one else in the family can link it, and you
  only ever see your own; the owner can unlink anyone (a mistake, a new phone).
  Fitness asks for the last 10 days the first time each day (Home Assistant
  keeps 10 days by default) and the last 2 every 10 minutes or so after that;
  each day keeps the highest count it has seen.
- **The goal**: 10,000 a day unless you pick another in Settings (2,000 to
  30,000). A day at or over it shows its count in the accent, and its sheet
  says **Goal met**.
- **Analysis**: two more totals, **Steps a day** (the average over the days
  with a count) and **Days at goal**, each against the window before.

**How the count gets in**: iOS decides when the Home Assistant app updates its
sensors (when it's open, when you move, and in the background now and then),
so the count for a day is the last one it sent before midnight, and can be a
little under what Health shows. Type the day in if it matters.

**Setting it up**: the owner adds the token (`aOS/RELEASING.md`, "Steps"). On
each iPhone, in the Home Assistant app: **Settings → Companion App →
Sensors → Steps** on, and Motion & Fitness allowed. If the sensor reads
`unavailable` in Home Assistant, check those, and that the server's **Sensors
Sent** setting (Settings → Companion App → your server → Privacy) isn't off.

## Ipsy

Ipsy, the AllisonOS helper you chat with (`../home/ipsy.js`), looks for
patterns in your own days: "How did I sleep after leg days?", "Is my resting
heart rate trending down?", "Did I miss meds more on low-sleep days?".

- **Off until you turn it on**: **Settings → Ipsy → Ask Ipsy about your
  patterns**, just on this phone, and signed in only (it goes through your
  family account). Off, there is no Ipsy button; turning it off also clears its
  chat from the phone. On, it sits just above the bottom row on the left.
- **What leaves the phone**: only the days and stats a question needs, as Ipsy
  looks at them, go to Claude (Anthropic) through aOS (`functions/fitness/api`,
  POST `ipsy`, `server/ipsy.js`), which keeps nothing but a count of questions
  (80 a person a day). Anthropic doesn't train on it. The chat asks once before
  the first question, and says so.
- **No web search** in Fitness: the route sends Claude Fitness's own tools only
  (`requestHead({ web: false })`), and Ipsy's instructions don't offer it, so
  nothing about your health can end up in a search query.
- **Read-only**: its tools (`ipsy-tools.js`) run on the phone and never change
  the log. Each reads at most about 120 days (a year of weeks for summary):
  - `days(from, to, include?)`: each day's workouts, volume, steps, meds and
    supplements taken, missed and taken as needed (by your own names for them),
    and health stats;
  - `summary(from, to)`: week by week, days trained, sets by muscle group,
    volume, cardio minutes, average steps, the share of meds taken, and the
    average of each health stat;
  - `compare(metric_a, metric_b, from, to, lag_days?)`: two daily numbers
    (steps, volume, sets, cardio_min, trained, group:legs, meds_taken,
    meds_missed, adherence, med:<name>, or a health stat) side by side, the
    second some days later if asked, with the correlation (Pearson's r) and how
    many days it rests on, worked out on the phone;
  - `meds()`: your list, with how often each was taken over 30 days;
  - `context()`: today, the screen, how far back the phone keeps, the health
    stats there are.
  Days older than the 90 the phone keeps are fetched from the family's Sheet
  first, as the week and Analysis do; if it can't be reached, Ipsy says it used
  only the phone's days. Health stats are named by `health.js`
  (`FitnessHealth`) when it's there.
- **How it answers**: it looks before it answers, quotes the numbers and how
  many days a pattern rests on, says "pattern", never "cause", calls a small
  sample too little to go on, gives no diagnosis or medical advice (it suggests
  a doctor for anything medical), and only ever sees your own data, so it never
  mentions anyone else in the family.
- `FITNESS_IPSY_MODEL` (a Pages secret) names another model than Claude
  Sonnet 5.5.

## Sign out and erase

**Settings → This phone → Sign out and erase** erases everything Fitness keeps
on this phone (the log, Meds, Steps, the Sheet link and its backup copy, the
offline copy) and signs it out, after one last sync to the Sheet. **Lost a
phone?** opens aOS's step-by-step page, where **Sign out and erase my other
devices** makes Fitness (and every other aOS app of yours) erase itself on
those phones the next time it opens online. `../home/welcome.js` does the
erasing for every app.

## The two designs

One app, one log: the design changes only how Fitness looks, at once, and is
kept on this phone (**Settings → Design**, the gear at the top, the first and
only section), as in Clock. `../home/design.js`, loaded in `<head>`, applies it
before the page is drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home and Orders:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass;
  - mustard, teal, burnt orange and olive: the Week / Month switch has a
    mustard thumb, today is a mustard disc, the view picker at the bottom is a
    walnut pill with a mustard chip, the + button and the sheet's Done button
    are solid burnt orange, and secondary buttons are outlined teal;
  - each muscle group keeps one colour, drawn from the Retro colours (chest
    orange, back teal, shoulders mustard, arms olive, plus walnut, denim,
    brick, plum, sky and taupe for lower back, core, legs, glutes, cardio and
    your own). They colour the chips, the dots and the bars in Analysis; the
    name is always written beside the colour;
  - three atomic shapes behind the title that scroll away with the page, and
    three little bars under it; Futura, which iOS has built in, so no font is
    downloaded.

  **The sky.** Behind the title is the shared **Vintage sky**
  (`../home/sky.js`, as in every Vintage design), with the real sun: by day a
  ground washed with mustard, the sun and rays that turn very slowly; after
  sunset a ground washed with deep teal, the moon and twinkling stars; each
  over cream (Light) or walnut (Dark). Sunrise and sunset are for the phone's
  place (kept on the phone, to a tenth of a degree, and only if the app
  already has location permission: it never asks), else the time zone. It
  holds still with reduced motion. This app only gives its disc its colour
  (`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to
  its header. Checked by `aOS/scripts/sky-test.mjs`.
- **Standard**: Sea glass: Notes' style block, unchanged, plus Fitness's own
  pieces; Liquid Glass sheets, no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. Only colours, shapes and type change: every button, sheet and swipe works
the same in both. The choice is `localStorage` `design.fitness`. What iOS reads
when Fitness is added to the Home Screen follows it: the icon (`icon-180.png`,
Vintage: a cream dumbbell on walnut with a mustard sun and a burnt-orange pill;
`icon-glass-180.png`, Standard: a white dumbbell on slate), the status bar
style (`default` in Vintage, where `black-translucent`'s white clock would
vanish on the cream) and the bar colours. The Week / Month thumb is measured
again on a change, since Futura and the system font are different widths.

**The old Fitness Vintage app.** Fitness Vintage used to be an app of its own
(`fitnessvintage/`, with its own log and Sheet settings). Its address now
opens this same app (the deploy copies `fitness/` there,
`.github/workflows/news.yml`), so a phone that added it keeps it. The first
time it opens there, `design.js` moves that app's data on the phone over to
Fitness' names (`allison-fitnessv-v1…` → `allison-fitness-v1…`: the log, the
graves, the Sheet link, the view; the IndexedDB copy of the Sheet link
`allison-fitnessv` → `allison-fitness`, which the app waits for before it opens
it; and what it had seen, so no walkthrough again), unless Fitness already has
data on that phone; nothing old is deleted. Both always used the same Sheet
script, so a Sheet connected to either keeps working. Its **Open Drinks** row
now opens Drinks (`../drinks/`), which carries both designs too.

## Analysis

Analysis compares two windows of the same length, both ending today:

- **Week**: the last 7 days against the 7 before.
- **Month**: the last 4 weeks against the 4 weeks before. Using whole weeks
  means each window has the same weekdays.

The dates of both windows are shown under the switch. The page shows:

- **Totals**: days trained, sets, volume (weight × reps × sets, for
  exercises done with a weight) and cardio minutes, as a 2 × 2 grid. Each has its change against the window
  before, shown as an arrow and a signed number.
- **Improving**: exercises you did better than before, biggest gain first,
  with today's best and what it was before. **New** lists exercises done for
  the first time.
- **Needs work**: exercises that went backwards, plus muscle groups that
  slipped. A group "slipped" if you trained it in the window before but not
  in this one, or did under 70% of its sets (from at least 3).
  **Holding steady** lists the exercises within 1% of before.
- **Sets by muscle group**: a bar per group, with the change against the
  window before.
- **Drinks**: if you log in Drinks and are signed in to your family account,
  your standard drinks and alcohol-free days in this window, with the window
  before under each, and **Open Drinks**. They come from your own Drinks log
  (`drinks/api/summary`, which only you can read), using the session already
  on the phone: Fitness never asks you to sign in for it, and shows nothing of
  it until there is something to show.

**How an exercise is judged.** Its best entry in this window is compared
with its best in the window before. If you didn't do it in the window
before, it is compared with the last time you did it, and that date is
shown.

| Kind of exercise | Measured by |
|---|---|
| With a weight | Estimated one-rep max, weight × (1 + reps ÷ 30) (the Epley formula), so 110 lb × 6 counts as stronger than 100 lb × 8 |
| Bodyweight | Reps |
| A hold | Seconds |

A change of 1% or less either way counts as steady. A bodyweight entry and a
weighted entry of the same exercise aren't compared with each other.

The sums are in `analysis.js`, separate from the page, so they can be tested
on their own.

## Cardio

**Cardio** is a ninth group holding the gym's cardio equipment, from the
GymEquipment tab:

| Section | Equipment |
|---|---|
| Machines | Treadmill, Elliptical, Stair Climber, Rowing Machine, ARC Trainer, Adaptive Motion Trainer, Seated Elliptical |
| Bikes | Upright Bike, Recumbent Bike, Spin Bike |
| Track and pool | Indoor Track, Swimming |

**What you log:** cardio asks for **Time** and an optional **Distance**,
instead of weight, reps and sets.

- Time runs from 1 minute to 3 hours.
- Distance uses the unit the equipment shows: metres on the rower, yards in
  the pool, and miles on everything else.
- Choosing a machine fills in last time's minutes and distance. A first
  time starts at 20 minutes.

**Searching:** search knows the other names, so "run" finds the treadmill
and the track, "cycle" the bikes, "rower" or "erg" the rowing machine, and
"pool" swimming.

**Where cardio shows up:**
- **The week**: each day's line adds its cardio minutes, e.g. "3 exercises
  · 9 sets · 20 min cardio". Cardio adds no sets.
- **Analysis**: a **Cardio (min)** total sits beside the other three.
  - Each machine is compared by speed (distance ÷ time) when you logged a
    distance both times, and by minutes when you didn't.
  - "No cardio in the last 7 days" counts under Needs work.
  - Cardio isn't one of the muscle-group bars.
- **Calendar**: the day's workout lists cardio as "Treadmill: 30 min · 3 mi".
- **The Sheet**: cardio fills the Minutes, Distance and Unit columns.

## The exercises

The list comes from the **Exercises** tab of the old *Fitness Tracker Data*
Sheet (83 exercises), checked against its **GymEquipment** tab:

- **Ab Wheel Rollout** is left out, because the gym lists no ab wheel.
- **Lying and Seated Leg Curl** become one **Leg Curl**. **Standing and
  Seated Calf Raise** become one **Calf Raise**. The gym lists one machine
  for each.
- The gym's **Back Extension Machine** and **Ab Crunch Machine** are added,
  so Lower back and Core have enough to choose from.

That leaves about 75 exercises across the eight groups. To keep each
dropdown short and easy to scan, the bigger groups are split into sections:

| Group | Sections |
|---|---|
| Chest | Presses, Flys, Bodyweight |
| Back | Pulldowns and pull-ups, Rows |
| Shoulders | Presses, Raises, Rear delts and traps |
| Arms | Biceps, Triceps |
| Legs | Quads, Hamstrings, Calves and inner thigh |

Lower back, Core and Glutes are short enough to stay as one list. The
Romanian Deadlift is in both Lower back and Legs. The list is `GROUPS` at
the top of `app.js`.

## With the other apps

- **Home**: Fitness has its own tile on the AllisonOS Home screen.
- **Calendar**: a **Fitness** layer (switch it in Calendar's Settings)
  shows each day's workout as an all-day item, for example "Workout ·
  Shoulders, Core". Its details list the exercises with their sets, reps and
  weight. **Open in Fitness** opens that day here, using
  `../fitness/?date=YYYY-MM-DD`.
- **Week start**: the week starts on Monday, or on Sunday if Calendar's
  Settings say so, so the two apps agree.

Both of these work because the apps share this phone's storage when they are
opened from AllisonOS Home. If you install Fitness from its own icon on an
iPhone, it keeps separate storage, and Calendar can't see its log.

## How it's built

**No build step.** `index.html` is the page and its look: Notes' style block,
unchanged, plus Fitness's own pieces, then the Vintage block (`<style
id="vintage">`, see The two designs). The day sheet is the same
Liquid Glass sheet as Calendar's. `app.js` is the app, `analysis.js` does
Analysis's comparisons, `ipsy-tools.js` is Ipsy's tools, and `sw.js` is the offline shell.

- **Security**: a strict Content Security Policy (no inline script), and the
  app refuses to run inside another page's frame.
- **Data**: the log is kept in `localStorage` under `allison-fitness-v1` as
  `{ v: 2, logs: [{ id, date, group, exercise, weight, reps, sets, timed?,
  updated }], exercises: [{ id, group, name, updated }], meds: [{ id, name,
  dose, kind, slots, days, prn, paused, since, updated }], doses: [{ id, med,
  name, date, slot, at, updated }], steps: [{ id (the date), date, n, src:
  'ha' | 'you', updated }] }`. The second list holds the exercises you typed in
  yourself. The step goal is `allison-fitness-v1-step-goal`. For a hold, `reps` is the
  seconds and `timed` is true. Deletions are kept as "graves" in
  `allison-fitness-v1-graves`, so a sync can pass them on. Nothing leaves
  the phone unless you connect the Google Sheet. There is no server piece
  of its own.

Published with the other apps by `.github/workflows/news.yml`.

## The family's Google Sheet

Fitness syncs by itself through aOS; the owner sets the Sheet up in
**aOS → Account → Google Sheets** (`aOS/SHEETS.md`). Fitness has no Sheet
settings of its own: no button, no status, no Sync now. Signed in, every
phone syncs its own person's workouts, meds and steps with the one Sheet
for the family (each row says whose it is, and each phone only ever gets
its own person's). The script is [`google-sheet-sync.gs`](google-sheet-sync.gs).

**What the Sheet holds**
- **Workouts**: Date, Day, Muscle group, Exercise, Sets, Reps (or Seconds
  for a hold), Weight (lb), Volume (sets × reps × weight), and for cardio
  Minutes, Distance and Unit. Newest is at the top. If you set the Sheet up
  before cardio was added, paste the script in again and deploy a new
  version to get the new columns. The data itself syncs either way.
- **Meds**: every dose ticked off (Date, Day, Time, Name, Dose, Type, When),
  newest first; **Med list**: what you take, when, which days, and whether
  it's paused; **Steps**: each day's steps, and whether they came from your
  iPhone or were typed in. These came with version 2 of the script: a Sheet
  set up before then keeps the workouts only, until the owner pastes the
  script in again and deploys a new version.
- Hidden `_logs`, `_exercises`, `_meds`, `_doses`, `_steps` and `_deleted`
  tabs, which the app reads back.

**Kept on the phone for 90 days**: once it has synced, the phone keeps the
last 90 days of workouts, doses and steps (after each sync; your list of meds
and exercises stays). The older ones stay in the Sheet, and nothing is deleted
from it: the phone leaves no grave for them. Looking back past the 90 days (a
week, a day, Analysis) fetches those days from the Sheet. Before it has
synced, everything stays on the phone, since it's the only copy.

The Workouts tab is rebuilt on every change, so make changes in the app,
not in the Sheet. A **Fitness** menu in the Sheet can rebuild it by hand.

**When it syncs** (signed in)
- When the app is opened, and when it comes back to the front.
- A couple of seconds after any change.
- When the phone comes back online, so a log made offline syncs then.
- Signed out, Fitness keeps everything on the phone until you sign in (Face
  ID, `../home/account.js`); it never nags about the Sheet.

**If it doesn't work**: a quiet sync shows at most one toast a session for a
real error (a wrong phrase, an old script, an unreachable Sheet), and none
while signed out or before the owner has set the Sheet up in aOS.

**How changes merge**: the newest change to an exercise wins. A deletion
reaches the other phone. **Undo** brings a deleted exercise back on both.

## Icons

`node fitness/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
from `icon.svg` (Vintage: a cream dumbbell on walnut, with a mustard sun and a
burnt-orange pill), and `icon-glass-512.png` and `icon-glass-180.png` from
`icon-glass.svg` (Standard: "Slate", a white dumbbell on slate, one of the Sea
glass tints).

## Tests

```sh
node fitness/scripts/analysis-test.mjs                           # Analysis's sums: the windows, totals, stronger / weaker / steady, groups missed
node fitness/scripts/sheet-test.mjs                              # google-sheet-sync.gs on an in-memory Sheet: secret, merge, deletions, the Workouts tab
node fitness/scripts/app-test.mjs [repo root] [screenshot dir]   # the week, a day, the lists, search, a timed hold, editing, deleting, Calendar's layer, Analysis, Sheet sync end to end, dark mode, the CSP, both designs, Settings > Design, the old Fitness Vintage address
node fitness/scripts/meds-test.mjs                               # Meds' sums: what's due, taken over 7 and 30 days, streaks; Analysis's steps windows
node fitness/scripts/steps-api-test.mjs                          # functions/fitness/api: linking your own phone, no one else's, the token kept on the server, the counts
node fitness/scripts/meds-steps-test.mjs [repo root] [screenshot dir]   # Meds and Steps in the page, the Sheet keeping them and the phone keeping 30 days, Sign out and erase, aOS's Lost a phone?
node fitness/scripts/ipsy-api-test.mjs                           # functions/fitness/api POST ipsy: signed in only, Fitness's tools and no web tools, the daily cap
node fitness/scripts/ipsy-test.mjs [repo root] [screenshot dir]  # Ipsy: its tools' numbers on a made-up log, off by default, Settings, where it sits, a chat, read-only, older days
```

`fake-sheet.mjs` is a small in-memory stand-in for the parts of Google Apps
Script the sync script uses. Both tests run the real `google-sheet-sync.gs`
on it. The app test needs Playwright with Chromium
(`npm i -g playwright`).

## What I could not verify

- Safari on an iPhone was not tested. I checked it in Chromium at iPhone
  size, in light and dark.
- **The sync script has not run in real Google Apps Script.** It is
  Travel's script, which is in use, adapted for Fitness. I tested it in
  Node against the in-memory stand-in, not against a real Sheet. The first
  real connect is the first true test.
- **Until the Sheet is connected, there is no backup.** The log lives only
  in this phone's storage.
- **Steps from Home Assistant were tested against a stand-in**, not a real
  Home Assistant: the API calls (`/api/template`, `/api/states/<id>`,
  `/api/history/period`) follow Home Assistant's own source, and the Steps
  sensor's behaviour (the phone's own steps since midnight) its companion app
  docs and code. The first real link is the first true test.
- **Erasing was tested in Chromium.** Safari on an iPhone clears the same
  storage, but `indexedDB.databases()` only exists from iOS 14.
