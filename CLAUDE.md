# AllisonOS - notes for every Claude session in this repo

## Every merge releases

- The site (Cloudflare Pages, `tomallison24-news.pages.dev`) only serves the newest released
  version: a git tag `aOS<version>` (`aOS1`, `aOS1.1`, `aOS2`). See
  `aOS/RELEASING.md`.
- The owner asked for releases to be automatic: **every merge to the default
  branch releases** the newest version in the release log (below) and
  publishes it (`.github/workflows/news.yml`, the push to the default branch).
  So merging is publishing: only merge what's ready for the family's phones.
- After merging, check the News run finished, then tell the owner it is live
  (phones pick it up the next time they open the app).
- `labs/` holds test pages for the owner (not apps); it publishes with every
  release and every scheduled run.
- GitHub Pages is retired: it only publishes "AllisonOS has moved" pages
  (`.github/pages-moved.html`) that send each old address on to the Cloudflare
  site. Don't publish the apps there again.

## Merging

The owner has asked that Claude's pull requests merge without asking, once
they're ready: every check on the latest commit passed (the News build and the
Apps check), no merge conflict, and no review left unanswered. Merge then (or
turn on GitHub's auto-merge for the PR), with a merge commit. The merge
releases it (above).

## The release log

`RELEASES` at the top of `home/welcome.js`, newest first, one version number
for everything (aOS1, aOS1.1, aOS2). When you ship something a user would
notice, add a line for it:

- By default, add to the top entry (aOS1.1 now): each merge releases it again,
  moving its tag; phones get the change with no update screen. A change worth
  announcing with update screens gets a new entry above it, when the owner
  wants one; the merge that adds it releases it:
  - the next minor version (`1.2` after `1.1`): follow
    `.claude/skills/aos-minor-release/SKILL.md`;
  - the next major version (`2`): follow
    `.claude/skills/aos-major-release/SKILL.md`.
  Either way `node aOS/scripts/release-test.mjs` (CI runs it) plays the new
  entry in aOS and every app, as a phone on the version before would see it.
- `highlights` are the most important changes - the update screens in the
  apps show these; `notes` are everything else, shown in aOS's full log.
- Per app: `apps: { weather: { highlights: [...], notes: [...] } }` (a plain
  list is all notes). An app a minor release doesn't mention shows no update
  screen.
- `silent: true` on an entry: it's only logged in `RELEASES`, shown nowhere
  (not in aOS's What's new); the apps keep showing the last version that wasn't
  silent, with no update screens.

## Adding or changing an app

Follow `.claude/skills/new-aos-app/SKILL.md`: every place an app must be wired
into aOS, and the ground rules every app shares. Then run
`node aOS/scripts/check-apps.mjs` (CI runs it too, `apps-check.yml`); it must
end with 0 errors.

## Layout

- `aOS/` (capital O and S, `/aOS/`) is the app store and home of every app;
  its `data-app` id is `aos`. Each app is added to the Home Screen on its own.
- `home/` was the launcher; it is **retired**. It now holds the scripts every
  app shares - `welcome.js` (welcome, walkthroughs, update screens, install
  steps, release log, theme), `slide.js` and `aisles.js` (grocery sections, for
  Notes and Meals) - plus the Welcome Lab. Its
  `index.html` is a "moved to aOS" notice.
- `home/back.js` (swipe up to the launcher) is **gone**: don't add
  `../home/back.js` back to a page or to a `sw.js` SHELL list (a missing file
  in SHELL breaks the service worker's install).
- Every app loads `<script src="../home/welcome.js" data-app="<id>" data-auto
  defer>`. On iPhone in Safari (or opened from aOS, `?via=aos`) it shows how to
  add the app; from the Home Screen, the app's walkthrough and update screens.
- Family accounts: passkeys (Face ID). `server/auth.js` (not a route) has the
  rules and storage (Workers KV bound as `ACCOUNTS`); `functions/aOS/api` the
  accounts API; `functions/<app>/api/_middleware.js` locks an app's server route
  to signed-in family once the owner exists. Apps that call a locked route load
  `../home/account.js` and use `AllisonOS.account.fetch`, which asks for Face ID
  on a 401. See `aOS/RELEASING.md`, "Family accounts". Every app, opened from
  the Home Screen and signed in, reports itself (`welcome.js`, `POST
  /aOS/api/installed`) so aOS shows it as Installed; one that has never signed
  in asks once.
- Light or dark: `home.settings.theme` (`auto`/`light`/`dark`), applied as
  `data-theme` on `<html>` by `welcome.js`, which also switches an app's
  `@media (prefers-color-scheme)` rules to match.
- The AllisonOS colours are **Sea glass** (sea glass, mist, shell, sand):
  `--w-pastel` / `--w-hot` in `welcome.js`, `--pastel` in `aOS/index.html`.
  Use these rather than new pastel gradients. "aOS" is always written with a
  lowercase a, never uppercased by CSS.
