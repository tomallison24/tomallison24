---
name: aos-minor-release
description: Release a minor aOS version (aOS1.1 -> aOS1.2) with update screens in the apps it changed. Use when the owner asks for a ".x" release, a point release, or to announce what's new since the last version (e.g. "make this 1.2", "release it as the next minor version", "push this out with the what's new screens"). Not for everyday changes (they go into the top entry and release silently), and not for a new whole number (aos-major-release).
---

# A minor aOS release (1.1 → 1.2)

Every merge to the default branch already releases (`CLAUDE.md`): small
changes go into the top entry of the release log and reach phones with no
update screen. A **minor release** is the owner choosing to *announce* what
has gathered there: a new number, and in each app it changed, the new .x
rising in and "What's new in <app>". aOS itself shows nothing (that's the plan
in `aOS/RELEASING.md`); its What's new log and the "New in aOS1.2" under each
changed app say it there.

Read `aOS/RELEASING.md` first. Then, in order:

## 1. What's in it

- The last released version is the top of `RELEASES` in `home/welcome.js`;
  its tag is `aOS<v>` (`git tag --list 'aOS*' --sort=-v:refname | head -1`).
- What changed since it was **announced**: `git log --oneline aOS<prev>..HEAD`
  isn't enough on its own, because the tag moves with every merge. Read the
  top entry's `notes` and `apps` for lines added after it went out with its
  own update screens, and the merged PRs since then.
- Those lines **move** out of the old entry into the new one (the old entry
  keeps what it announced). Nothing is lost: aOS's What's new shows every entry.

## 2. Write the entry

Above the old one, at the top of `RELEASES`:

```js
{ v: '1.2', date: 'YYYY-MM-DD', title: 'A few words',
  highlights: ['The 1–3 changes that matter most, a line each'],
  notes: ['Everything else, for aOS\'s full log'],
  apps: {
    news: { highlights: ['What changed in News, up to 3'], notes: ['The rest'] },
    weather: ['A plain list is all notes'],
  } },
```

- `v`: the next minor number after the top entry (`1.1` → `1.2`, `1.9` →
  `1.10`). Never skip, never reuse.
- `date`: today, ISO. `title`: short, plain, a little warm ("Dinner is served").
- **`apps` decides who sees an update screen.** Name an app only if something
  in *it* changed. Its screen shows its `highlights` (or, with none, its first
  notes), **at most three**: write them for that app, second person, US
  English, one line each, no jargon ("Buttons are easier to tap", not "44pt
  hit targets"). A fourth highlight is never seen on the screen.
- A **new app** in this release: give it `highlights` too (they're its log
  entry; its first open plays its walkthrough, not an update screen). Saying
  so in the apps people already have is fair: a last highlight like "New in
  aOS: Meals, the family's dinners. Get it in aOS" in the apps you name.
- An app with nothing new: leave it out. It shows nothing and still moves to
  the new number.
- `silent: true` only if the owner wants the number logged but announced
  nowhere.

## 3. Everywhere else the version shows

Most of it follows the log on its own: the walkthroughs ("aOS1.2" under each
app's name), aOS's What's new, "New in aOS1.2" on changed apps, the release tag.
By hand:

- `CLAUDE.md`, "The release log": the sentence naming the version everything
  goes into for now.
- A **new app** in the release: the welcome link (repo `tomallison24/aos-teaser`,
  `welcome/welcome.js` `CORE`/`FAMILY`, `welcome/index.html` aria-labels, an icon
  in `launch/icons/<id>.webp` at 256 px, and `welcome/og.png` re-rendered), so
  new family see it. The launch teaser film is history: leave it.
- Docs that give the current version as an example only need changing if
  they'd now be wrong.

## 4. Check it

```
node aOS/scripts/check-apps.mjs        # 0 errors
node aOS/scripts/release-test.mjs      # every app and aOS, as a phone on the old version: the right screen or none
```

`release-test` plays the newest entry against the one before: aOS shows
nothing, each app in `apps` shows "What's new in <app>" with its highlights,
the rest show nothing, and every one marks the new version seen. If an app
fails, fix the entry (a typo'd app id is simply never shown), not the test.
Look at one screen yourself too if the words are long (they wrap on a phone).

## 5. Release it

- One PR with the entry (and the changes it describes, if they aren't merged
  yet): title `aOS 1.2: <title>`. The body says which apps show a screen and
  what aOS does (nothing).
- When every check passes, merge with a merge commit (`CLAUDE.md`,
  "Merging"). The merge's **News** run tags `aOS1.2` ("Released aOS1.2 at …" in
  its summary) and publishes it.
- Confirm the run went green, then tell the owner: it's live, and each phone
  sees it the next time it opens each app (aOS first is fine; it stays quiet).

## 6. After

The new entry is now the top one: everyday changes go into it, silently, until
the owner asks for the next one.
