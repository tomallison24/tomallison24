---
name: aos-major-release
description: Release a major aOS version (aOS1.x -> aOS2): the new number replayed in aOS with its own cards, and every app showing it is on the new version. Use when the owner asks for "aOS2", "version 2", a new whole number, or a big launch moment. Plans the launch around the platform too (welcome link, teaser, announcement). For a .x release use aos-minor-release.
---

# A major aOS release (aOS1.x → aOS2)

A major release is a moment: aOS plays its welcome again (the name, the new
mark drop, "The Power of aOS2", the burst) and then this release's own cards;
**every** app shows the old number lifting away, the 2 rising in, "<app> is on
aOS2" with the release's highlights and **Open aOS** for the rest. Everyone
sees it, in every app, so plan it with the owner, not as a by-product.

Read `aOS/RELEASING.md` and `.claude/skills/aos-minor-release/SKILL.md` first:
steps 1, 2, 4 and 5 there apply here too. What's different:

## 1. Agree the release with the owner

Before writing anything, settle with the owner: the number (the next whole
one), the title ("The Power of aOS2" is what the mark scene says; the entry's
`title` is the headline), the three highlights every app will show, and
whether there's a launch around it (a teaser, a welcome link, a date). Ask; a
major release is theirs to name.

## 2. Write the entry

```js
{ v: '2', date: 'YYYY-MM-DD', title: 'The headline',
  highlights: ['Exactly the 3 things every app's screen will say'],
  notes: ['Everything else, for aOS\'s full log'],
  cards: [
    { i: 'sparkle', t: 'A card title', d: 'One or two sentences.' },
    { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep aOS always light or always dark.' },
  ],
  apps: { news: { highlights: [...], notes: [...] } } },
```

- `highlights`: **every app** shows the first three, so write them for the
  whole platform, not one app.
- `cards`: aOS's own screens after the mark, 3 to 6, each with an `i` that is a
  key of `LINE` in `home/welcome.js` (or `x: 'theme'` for the Light or dark
  card; keep it last). Without `cards`, aOS shows the highlights instead. Look
  at aOS1's cards for the voice.
- `apps`: per-app detail for aOS's log (and the "New in aOS2" under each app).
  It doesn't change who sees a screen: in a major release everyone does.
- Move lines out of the old top entry as for a minor release; keep every
  earlier entry (the log is history, and a version that leaves the log has its
  tag removed).

## 3. Everywhere else the version shows

As for a minor release (`CLAUDE.md`, the welcome link for any new app), and:

- **The welcome link** (`tomallison24/aos-teaser`, `welcome/`): anything that
  names the version or the launch; re-render `welcome/og.png` (1200 × 630).
- **A teaser**, if the owner wants one: `aos-teaser/launch/` is the pattern
  (a canvas film timed to `make-video/music.py`, rendered to MP4 by
  `make-video/render.mjs`, `og.png`, a "Play with sound" page). Make a new
  folder for it; never change the aOS1 launch teaser.
- **The Welcome Lab** (`home/welcome-lab.html`) previews a major update in an
  app: check it still plays.
- `CLAUDE.md` and `aOS/README.md` examples that say what "now" is.
- The aOS icon has no number on it: nothing to change there.

## 4. Check it

```
node aOS/scripts/check-apps.mjs        # 0 errors
node aOS/scripts/release-test.mjs      # aOS plays its cards; every app says "<app> is on aOS2" and the highlights
node aOS/scripts/tours-test.mjs        # first-time walkthroughs still play, now saying aOS2
```

Then watch it yourself, as a phone on aOS1.x would: aOS first (the whole
replay, every card), then two or three apps, light and dark, iPhone size
(390 × 844). The mark scene is the moment: make sure the new number fits and
the cards don't cover it on a short screen.

## 5. Release it

As for a minor release: one PR, `aOS 2: <title>`, merged with a merge commit
when every check passes; the News run tags `aOS2` and publishes. If there's a
launch date, merge on the day (or hold the PR as a draft until then) and tell
the owner exactly when phones will see it: the next time each app is opened.
