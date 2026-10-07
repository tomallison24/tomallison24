# aOS

The home of every AllisonOS app, laid out like an app store, in the same
glass and pastels as the AllisonOS welcome. Part of the Allison Corporation.

- **The aOS mark**: aOS with the version as a superscript, shining, and "The
  Power of aOS1". **Replay the welcome** plays the AllisonOS welcome again.
- **Apps**: every AllisonOS app as a tile, in the Home app's automation design
  (square Liquid Glass, three across, a soft glow of the app's own colour
  behind it), with its version. A tap opens a sheet, "Add Weather to your Home
  Screen", with Safari's steps animated on a phone with that app's name and
  icon, looping - ••• then Share, scroll to Add to Home Screen, Open as Web App
  on and Add, and the icon popping onto the Home Screen. Once they have played
  through, **Install** appears: it opens the app's address in a new tab, ready
  to add. The animation is a likeness of iOS 26 Safari drawn in HTML
  (`AllisonOS.welcome.safariDemo`), not a recording; the install card in the
  AllisonOS welcome uses it too.
- **What's new in aOS**: the release log, newest first.
- **Appearance**: System, Light or Dark for every app (the launcher's own
  setting, `home.settings.theme`).

## Versions, welcomes and walkthroughs

All of it is in `../home/welcome.js`, which every app loads with its own name
(`data-app="weather"`, here `data-app="aos"`), and which keeps the release log:

- **aOS** (here and on the launcher): the first time on a device, the AllisonOS
  welcome, a touch slower than the app intros - the name drawn on in
  pastels; then in one motion "llison" folds away while the A melts into an
  a and slides along to meet "OS", the colours spreading back across what is
  left, and aOS grows to the middle; the 1 drops in as a superscript, a ring
  pulses out, stars twinkle and a shine runs across; "The Power of aOS1", the apps bursting out of it into a grid, then
  the tour (everything in one place and working together, swipe up, always
  up to date, made to work for you, Light or dark, how to add it, aOS for
  apps). On a short screen a card that would cover the mark fades it instead. A major version
  (aOS2) replays the name and the new mark, then that release's setup cards.
  A minor one (aOS1.1) is one screen: aOS¹ on its own, then the new .1 rises
  in after the 1 (the old .x lifting away, for 1.1 -> 1.2) in its own brighter
  gradient, with a glow, a ring, an underline sweep and a soft pulse; then
  "aOS1 updated to aOS1.1. More power in your palm." with the .1 lit the same
  way, and its notes. An app's update does the same under its icon: "Weather
  1.1" with the .1 rising in and lit, then what's new (an app going to a new
  major, 1.3 -> 2, has the whole number rise in).
- **Each app**: the first time it is opened (on iPhone, from the Home Screen), its own walkthrough - its icon
  and name with aOS¹ under it, then four or five cards on what it does (written from its
  README). After that app's own update, what's
  new in it, if that release has anything to show; an app with nothing new
  shows nothing.

What a device has seen is `localStorage` `aos.seen` (`{ app: version }`),
shared by every app on the site. "aOS" is never set in capitals: its a is always lowercase. On iPhone an app added to the Home Screen on
its own keeps its own storage, so "first time" counts per install there.

To announce an update, add a release to `RELEASES` in `../home/welcome.js` (for
`aos` or an app, newest first) and bump that app's `sw.js` cache.

## Files

- `index.html`: the whole app. `sw.js`: offline, network-first.
- `icon-512.png`, `icon-180.png`: "aOS¹" in white on the pastels, drawn by
  `scripts/make-icons.mjs` (headless Chromium).
