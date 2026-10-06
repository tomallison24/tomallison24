# Fitness

A simple workout log as a home-screen web app, in the same frosted glass as
Calendar, Notes and Travel. It is kept deliberately small: the week, and for
each day what you did.

- **The week**: seven rows, one a day, each with coloured chips for the
  muscle groups worked and how many exercises and sets. Today is marked. The
  arrows (or a sideways swipe) move a week at a time, and the calendar button
  comes back to this week. Under it, the week's totals: days trained,
  exercises and sets.
- **A day**: tap it and its sheet opens. At the top is what you logged that
  day. Under that is the form, which you fill in from the top down:
  1. **Muscle group**: Chest, Back, Lower back, Shoulders, Arms, Core, Legs
     or Glutes.
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
Liquid Glass sheet as Calendar's. `app.js` is the app, and `sw.js` is the
offline shell.

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
  for a hold), Weight (lb) and Volume (sets × reps × weight). Newest is at
  the top.
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
from `icon.svg`: "Iron", a white dumbbell on a sky that runs from steel blue
through slate to ink.

## Tests

```sh
node fitness/scripts/sheet-test.mjs                              # google-sheet-sync.gs on an in-memory Sheet: secret, merge, deletions, the Workouts tab
node fitness/scripts/app-test.mjs [repo root] [screenshot dir]   # the week, a day, the lists, a timed hold, editing, deleting, Calendar's layer, Sheet sync end to end, dark mode, the CSP
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
