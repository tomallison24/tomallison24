# Fitness

A simple workout log as a home-screen web app, in the same frosted glass as
Calendar, Notes and Travel. It is kept deliberately small: the week, and for
each day what you did.

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
- **Week and Analysis**: pick between them from the Liquid Glass pill at the
  bottom of the screen (**Week ⌃**), as in Home. The menu opens upwards from
  it, and the app remembers the view you were on. See below.

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
unchanged, plus Fitness's own pieces at the end. The day sheet is the same
Liquid Glass sheet as Calendar's. `app.js` is the app, `analysis.js` does
Analysis's comparisons, and `sw.js` is the offline shell.

- **Security**: a strict Content Security Policy (no inline script), and the
  app refuses to run inside another page's frame.
- **Data**: the log is kept in `localStorage` under `allison-fitness-v1` as
  `{ v: 2, logs: [{ id, date, group, exercise, weight, reps, sets, timed?,
  updated }], exercises: [{ id, group, name, updated }] }`. The second list
  holds the exercises you typed in yourself. For a hold, `reps` is the
  seconds and `timed` is true. Deletions are kept as "graves" in
  `allison-fitness-v1-graves`, so a sync can pass them on. Nothing leaves
  the phone unless you connect the Google Sheet. There is no server piece
  of its own.

Published with the other apps by `.github/workflows/news.yml`.

## Google Sheet sync

This is optional. It backs the log up to a Google Sheet you own, gives you
a readable **Workouts** tab, and keeps a second phone in step. It uses the
same design as Travel, with **its own Sheet and script**:

1. Go to [sheets.new](https://sheets.new) and name the Sheet, for example
   **AllisonOS - Fitness**.
2. Open **Extensions → Apps Script**. Replace `Code.gs` with the whole of
   [`google-sheet-sync.gs`](google-sheet-sync.gs), and change
   `const SECRET = 'CHANGE-ME';` to a long phrase of your own.
3. Choose **Deploy → New deployment → Web app**, with *Execute as: Me* and
   *Who has access: Anyone*. Tap **Deploy**, authorise it, and copy the
   **Web app URL**.
4. In Fitness, tap the cloud button at the top, paste the URL and the
   phrase, and tap **Connect and sync**.
5. For a second phone, tap **Copy setup link** on the first one and open
   that link on the other.

**What the Sheet holds**
- **Workouts**: Date, Day, Muscle group, Exercise, Sets, Reps (or Seconds
  for a hold), Weight (lb), Volume (sets × reps × weight), and for cardio
  Minutes, Distance and Unit. Newest is at the top. If you set the Sheet up
  before cardio was added, paste the script in again and deploy a new
  version to get the new columns. The data itself syncs either way.
- Hidden `_logs`, `_exercises` and `_deleted` tabs, which the app reads
  back.

The Workouts tab is rebuilt on every change, so make changes in the app,
not in the Sheet. A **Fitness** menu in the Sheet can rebuild it by hand.

**When it syncs**
- When you connect.
- A couple of seconds after any change.
- When the app is opened, and when the phone comes back online.
- If you log while offline, it syncs when you're back online.

**How changes merge**: the newest change to an exercise wins. A deletion
reaches the other phone. **Undo** brings a deleted exercise back on both.

**If the secret code "doesn't match"** when you're sure it does: Apps Script
runs the *deployed* copy. After changing `SECRET`, choose **Deploy → Manage
deployments → ✏️ → Version: New version → Deploy**. Also check that the
iPhone didn't fill in another app's saved code.

## Icons

`node fitness/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
from `icon.svg`: "Slate", a white dumbbell on slate, one of the Sea glass
tints.

## Tests

```sh
node fitness/scripts/analysis-test.mjs                           # Analysis's sums: the windows, totals, stronger / weaker / steady, groups missed
node fitness/scripts/sheet-test.mjs                              # google-sheet-sync.gs on an in-memory Sheet: secret, merge, deletions, the Workouts tab
node fitness/scripts/app-test.mjs [repo root] [screenshot dir]   # the week, a day, the lists, search, a timed hold, editing, deleting, Calendar's layer, Analysis, Sheet sync end to end, dark mode, the CSP
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
