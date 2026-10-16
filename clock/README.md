# Clock

The iPhone's Clock app as an aOS app: one of the core apps, with four tabs in a
floating pill at the bottom, and Nightstand. It comes in two designs, picked in
its own **Settings → Design**: **Vintage** (mid-century modern, the default) and
**Standard** (Sea glass). See "The two designs" below.

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
- **Settings**: the design; 24-hour time; Nightstand's seconds and face; Test
  the sound.

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
(the page's `aos-store` meta), as the iPhone's own alarms are: your cities,
alarms, sleep schedule, the stopwatch, timers, recents and settings (the design
too, `set.design`). Nothing goes to a server, and Clock needs no
account. For each alarm it keeps the moment it next rings (`next`), and the
tick (four times a second) rings what is due; when the phone moves to another
time zone, every alarm is set again for the clock on the wall.

## The two designs

One app, one set of alarms: the design changes only how Clock looks, at once,
and is kept (Settings → Design). `design.js`, loaded in `<head>`, applies it
before the page is drawn, as aOS's own `look.js` does for aOS.

- **Vintage** (the default): mid-century modern in the Retro colours, as in the
  other Vintage apps. A cream ground and cards (walnut in dark mode), flat and
  round-cornered; every clock face a **starburst**, the atomic wall clock
  (walnut rays with mustard tips round a cream dial, walnut after dark there,
  walnut hands, an orange second hand, a mustard hub), the stopwatch's dial
  too; the tab bar a walnut pill with a mustard thumb; solid burnt-orange main
  buttons, outlined teal for Lap, Reset and Snooze, mustard for picked days,
  snooze lengths and the band across the timer wheels; the ringing screen
  cream under a big mustard sun; Nightstand walnut-black with mustard digits;
  the atomic shapes behind the title and three little bars under it; Futura
  (built into iOS, nothing downloaded). Behind the title is the shared
  **Vintage sky** (`../home/sky.js`): by day a ground washed with mustard and
  the sun's slow rays; after sunset deep teal, the moon and twinkling stars.
- **Standard**: Sea glass, as the other aOS apps: Fitness's tokens, faint tiles
  and Liquid Glass sheets, plain faces, no sky.

How: the Vintage look is the `<style id="vintage">` block at the end of
`index.html`; Standard is that block switched off (`media="not all"`), with
`data-look="glass"` on `<html>`, which `sky.js` reads to draw no sky. What iOS
reads when Clock is added to the Home Screen follows the design picked: the
icon (`icon-180.png`, Vintage; `icon-glass-180.png`, Standard), the status bar
style and the bar colours. aOS shows the Vintage icon in its Vintage look and
the Standard one in Sea glass (`aOS/app.js` `BOTH`). Both follow the phone's
Light or Dark, or aOS's own choice.

## Files

- `index.html`: the page, its Standard look, and the Vintage block last.
- `design.js`: applies the design before the page is drawn.
- `app.js`: the app. `logic.js`: the sums (cities and zones, when an alarm
  next rings and its repeat in words, the sleep schedule, laps, times and
  lengths in words) and the sounds.
- `sw.js`: the offline shell. `icon.svg` (Vintage: a cream starburst clock on
  midnight) and `icon-glass.svg` (Standard: "Midnight", a Sea glass tint),
  drawn to the PNGs by `scripts/make-icons.mjs`.

## Tests

- `node clock/scripts/logic-test.mjs`: the sums and the sounds, in New York's
  time zone (summer time starting and ending, a time zone half an hour off,
  the end of a month and of a year).
- `node clock/scripts/app-test.mjs`: at iPhone size in Chromium, in Vintage
  (Light) and in Standard (Dark), with the clock held at a made-up moment: a city
  added and removed, an alarm set, ringing, snoozed and stopped, a one-time
  alarm turning itself off, a missed one listed, the stopwatch's laps, a
  timer ringing and Repeat, Recents, Sleep | Wake Up, Nightstand, the escaping
  of what you type, each design's look, Settings → Design switching and
  keeping it (with the icon and status bar iOS would take), and nothing the
  page's Content Security Policy blocks.
- `node aOS/scripts/sky-test.mjs` checks the Vintage sky.
