# Clock Vintage

[Clock](../clock/README.md) in a mid-century modern look, as its own app. It
does everything Clock does - World Clock, Alarms with Sleep | Wake Up, the
Stopwatch, Timers with Recents, Nightstand and Settings - and rings the same
way, only while it is open (see `clock/README.md`, "What a web app can't do").
The features and how they work are described there; this page covers what
differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Drinks Vintage and Home Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- every clock face is a **starburst**, the atomic wall clock: walnut rays with
  mustard tips round a cream dial (walnut after dark there), walnut hands, an
  orange second hand and a mustard hub; the stopwatch's dial too;
- the tab bar is a walnut pill with a mustard thumb, as in Home Vintage;
- solid burnt-orange buttons (Start, Stop on the ringing screen, the play
  buttons, Save); outlined teal for Lap, Reset and Snooze; outlined orange for
  the stopwatch's Stop; mustard for the picked days and snooze lengths and
  the band across the timer wheels; teal switches and timer rings;
- the ringing screen is cream under a big mustard sun with an orange pill;
- Nightstand is walnut-black with mustard digits, or a mustard starburst;
- the atomic shapes behind the title (a mustard sun, a teal dot, an orange
  pill) that scroll away with the page, and three little bars under it;
- Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. It follows the phone's Light or Dark, or aOS's
own choice, like every app.

**The sky.** The page behind the title is Weather Vintage's, with the real sun:
by day a ground washed with mustard, the sun and rays that turn very slowly;
after sunset a ground washed with deep teal, the moon and twinkling stars; each
over cream (Light) or walnut (Dark). `../home/sky.js` does it for every Vintage
design (loaded in `<head>`, listed in `sw.js`); this app only gives its disc its
colour (`--sky-disc`) and keeps its own sizes and places for the shapes. Checked
by `aOS/scripts/sky-test.mjs`.

## What is separate from Clock

It is a second copy of Clock's page, not a setting, so the two can be on the
Home Screen side by side. Its alarms, cities, timers and settings are its own
(`allison-clockv-v1`), and so are its offline cache (`clockvintage-v1`) and
icon. An alarm set in one doesn't ring in the other.

`app.js` and `logic.js` are Clock's, byte for byte, and the page's markup is
the same: `clockvintage/scripts/same-reader-test.mjs` checks it. When they
change in `clock/`, copy them over:

    cp clock/app.js clock/logic.js clockvintage/

Its browser test is Clock's: `node clock/scripts/app-test.mjs clockvintage`.
