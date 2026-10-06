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
  2. **Exercise**: a dropdown of that group's usual exercises. **Other…**
     lets you type one in, and it stays in that group's list after that.
  3. **Weight, reps and sets**: three dropdowns. Weight is in pounds, in
     2.5 lb steps to 100 and 5 lb steps to 500, or **Bodyweight**. Reps run
     1–50 and sets 1–10.
- **Last time**: choosing an exercise fills in the weight, reps and sets
  from the last time you did it, and shows when that was. Bodyweight
  exercises (push-ups, pull-ups, crunches and so on) start at Bodyweight.
- **Change or delete**: tap a logged exercise to change it, or its ✕ to
  delete it. Deleting gives you an **Undo**.
- **+**: logs today's workout from any week.

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
  `{ v, logs: [{ id, date, group, exercise, weight, reps, sets, updated }],
  custom: { group: [names] } }`. Nothing leaves the phone, and there is no
  server piece.

Published with the other apps by `.github/workflows/news.yml`.

## Icons

`node fitness/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
from `icon.svg`: "Iron", a white dumbbell on a sky that runs from steel blue
through slate to ink.

## Tests

```sh
node fitness/scripts/app-test.mjs [repo root] [screenshot dir]   # the week, a day, adding, editing, deleting, Calendar's layer, dark mode, the CSP
```

It needs Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

- Safari on an iPhone was not tested. I checked it in Chromium at iPhone
  size, in light and dark.
- **No backup.** The log lives only in this phone's storage. Clearing
  Safari's website data, or losing the phone, loses it. Notes, Travel and
  Places sync to a Google Sheet; Fitness does not yet.
