# Clock

The iPhone's Clock app as an aOS app: one of the core apps, with four tabs in a
floating pill at the bottom, and Nightstand. **Clock Vintage** is the same app
in a mid-century modern look, as its own app ([`clockvintage/`](../clockvintage/README.md)).

## What it does

- **World Clock.** Your own time on a big face (with the date), then the
  cities you add with **+**: each shows its time, a small face (dark at night
  there), its day and how far ahead or behind you it is ("Tomorrow, 5 hr
  ahead"). Search by city, country or state (`logic.js` `CITIES`, about 190
  cities), and every other time zone the phone knows is offered by its own
  name. **Edit** removes a city (with Undo) and reorders them: drag the
  handle, or use the arrow keys on it.
- **Alarms.** The subtitle says when the next one rings.
  - **Sleep | Wake Up**: a bedtime, a wake-up time and the wake-up days, the
    hours of sleep between them, a wake-up alarm (its sound, snooze), and an
    optional soft chime at bedtime (on the evening before each wake-up day, or
    that day if bedtime is after midnight). **Skip the next wake-up** passes
    one by. A switch turns the whole schedule off.
  - **Other alarms**: a time (the phone's own time picker), the days it
    repeats (none: it rings once, then turns itself off, as on iPhone), a
    label, a sound, and snooze with its length (1, 3, 5, 9, 10 or 15 minutes;
    9 is iPhone's). A switch turns each one on or off; **Edit** deletes (with
    Undo); tapping one opens it. Saving says "Alarm set for 7 hr 12 min from
    now."
- **Stopwatch.** Digital or analog (tap the face, swipe it, or use the dots).
  Start / Stop, Lap / Reset; the laps list shows the lap in progress, and
  marks the fastest and slowest in color and in words. It keeps counting while
  Clock is closed: only the moment it started is kept.
- **Timers.** Pick a length on three wheels (hours, minutes, seconds) or a
  quick-length chip, give it a label and a sound (**When Timer Ends**), and
  Start. Run as many at once as you like; each shows a ring, the time left and
  when it ends, with pause / resume and cancel. **Recents** start again in one
  tap (Clear empties them, with Undo).
- **Ringing.** The whole screen: the time, the label, **Stop** and
  **Snooze _n_ min** (a timer: **Stop** and **Repeat**). More than one at
  once wait their turn. A sound stops after 15 minutes; the screen stays until
  you tap.
- **Nightstand** (the moon): a dark bedside clock, digits or a face (the
  clock button, or Settings), the date and the next alarm, with its buttons
  fading away after a few seconds (tap to bring them back). It asks the phone
  to keep the screen on (the Screen Wake Lock API); if the phone says no, it
  says so, and how to set Auto-Lock to Never.
- **Settings**: 24-hour time; Nightstand's seconds and face; Test the sound.

## What a web app can't do

An iPhone doesn't let a web app run, or make a sound, once it is closed or the
phone is locked, and a web app can't set the iPhone's own alarms. So:

- Alarms and timers ring **while Clock is open**, on any tab and in
  Nightstand. The Alarms tab and Settings say so plainly.
- **Nightstand** is the way to be sure of a morning alarm: open it at bedtime
  with the phone on charge, and the screen stays on, so Clock stays open.
- Anything that came due while Clock was closed rings when Clock is next
  opened if it is less than ten minutes late; otherwise it is listed under
  Alarms ("Work came due at 6:45 AM while Clock was closed"), with a toast.
- Sound: the first tap anywhere in Clock unlocks its one `<audio>` (iPhone
  only plays sound a person started), and it asks for the `playback` audio
  session where the phone has one. If a ring can't be heard yet, the ringing
  screen says "Tap anywhere to hear it". Clock rings at the phone's media
  volume.

Ringing with Clock closed would need a small server sending notifications (as
Notes' reminders do, `notes/push`); a notification only makes the phone's
notification sound once, so that would be a reminder, not an alarm. It isn't
built.

## Sounds

Six, made by `logic.js` (`samples`, `wav`) as 16-bit mono WAV loops at
22,050 Hz, so nothing is downloaded: Twin Bell (a wind-up alarm clock),
Telephone, Chimes (a quarter chime), Marimba, Beacon (three beeps) and Sunrise
(soft and rising, the wake-up's default). The sound sheet plays each as you
pick it.

## The data

Everything is kept on this phone, in `localStorage` under `allison-clock-v1`
(the page's `aos-store` meta; Clock Vintage's is `allison-clockv-v1`), as the
iPhone's own alarms are: your cities, alarms, sleep schedule, the stopwatch,
timers, recents and settings. Nothing goes to a server, and Clock needs no
account. For each alarm it keeps the moment it next rings (`next`), and the
tick (four times a second) rings what is due; when the phone moves to another
time zone, every alarm is set again for the clock on the wall.

## Files

- `index.html`: the page and its look (Fitness's Sea glass tokens, tiles and
  Liquid Glass sheets).
- `app.js`: the app. `logic.js`: the sums (cities and zones, when an alarm
  next rings and its repeat in words, the sleep schedule, laps, times and
  lengths in words) and the sounds. Both are the same files, byte for byte,
  as Clock Vintage's.
- `sw.js`: the offline shell. `icon.svg`, drawn to the PNGs by
  `scripts/make-icons.mjs` ("Midnight", a Sea glass tint).

## Tests

- `node clock/scripts/logic-test.mjs`: the sums and the sounds, in New York's
  time zone (summer time starting and ending, a time zone half an hour off,
  the end of a month and of a year).
- `node clock/scripts/app-test.mjs [clock|clockvintage]`: each design at
  iPhone size in Chromium, with the clock held at a made-up moment: a city
  added and removed, an alarm set, ringing, snoozed and stopped, a one-time
  alarm turning itself off, a missed one listed, the stopwatch's laps, a
  timer ringing and Repeat, Recents, Sleep | Wake Up, Nightstand, the escaping
  of what you type, each design's own storage and look, and nothing the
  page's Content Security Policy blocks.
- `node clockvintage/scripts/same-reader-test.mjs`: the two designs' scripts
  and markup are the same.
