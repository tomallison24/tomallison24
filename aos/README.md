# aOS

The home of every AllisonOS app, laid out like an app store, in the same
glass and pastels as the AllisonOS welcome. Part of the Allison Corporation.

- **The aOS mark**: aOS with the version as a superscript, shining, and "The
  Power of aOS1". **Replay the welcome** plays the AllisonOS welcome again.
- **Apps**: every AllisonOS app with its tagline and version. **Get** opens
  the app in a new tab (a browser's own, where Share → Add to Home Screen adds
  it as its own icon). Tap the row for the app's page: what it does (its
  walkthrough's cards), how to add it to the Home Screen, **Show the
  walkthrough**, and what's new in each version.
- **What's new in aOS**: the release log, newest first.
- **Appearance**: System, Light or Dark for every app (the launcher's own
  setting, `home.settings.theme`).

## Versions, welcomes and walkthroughs

All of it is in `../home/welcome.js`, which every app loads with its own name
(`data-app="weather"`, here `data-app="aos"`), and which keeps the release log:

- **aOS** (here and on the launcher): the first time on a device, the AllisonOS
  welcome - the name drawn on in pastels, folding into **aOS¹** (the 1 drops
  in as a superscript, a ring pulses out, stars twinkle and a shine runs
  across), "The Power of aOS1", the apps bursting out of it into a grid, then
  the tour (Light or dark, how to add it, aOS for apps). A major version
  (aOS2) replays the name and the new mark, then that release's setup cards.
  A minor one (aOS1.1) is one screen: "aOS1 updated to aOS1.1. More power in
  your palm." and its notes.
- **Each app**: the first time it is opened, its own walkthrough - its icon
  and name, then four or five cards on what it does (written from its
  README), and how to add it in a browser. After that app's own update, what's
  new in it, if that release has anything to show; an app with nothing new
  shows nothing.

What a device has seen is `localStorage` `aos.seen` (`{ app: version }`),
shared by every app on the site. On iPhone an app added to the Home Screen on
its own keeps its own storage, so "first time" counts per install there.

To announce an update, add a release to `RELEASES` in `../home/welcome.js` (for
`aos` or an app, newest first) and bump that app's `sw.js` cache.

## Files

- `index.html`: the whole app. `sw.js`: offline, network-first.
- `icon-512.png`, `icon-180.png`: "aOS¹" in white on the pastels, drawn by
  `scripts/make-icons.mjs` (headless Chromium).
