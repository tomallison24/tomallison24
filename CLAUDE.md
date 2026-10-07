# AllisonOS - notes for every Claude session in this repo

## Updates go out only when the owner releases them

- Merging to the default branch publishes **nothing**. The site (Cloudflare
  Pages and GitHub Pages) only serves the newest released version: a git tag
  `aOS<version>` (`aOS1`, `aOS1.1`, `aOS2`). See `aOS/RELEASING.md`.
- **Never release on your own.** Releasing is running the News workflow by
  hand with a version (`.github/workflows/news.yml`, input `release`); do it
  only when the owner asks for that release.
- After merging, tell the owner the change is merged and waits for the next
  release - not that it is live.
- The one exception: `labs/` holds test pages for the owner (not apps). It
  publishes from the latest merged code on the next scheduled or hand-run
  publish (a hand run with **release** blank republishes the live release
  and refreshes labs - that is not a release).

## The release log

`RELEASES` at the top of `home/welcome.js`, newest first, one version number
for everything (aOS1, aOS1.1, aOS2). When you ship something a user would
notice, add a line for it:

- If the top entry isn't released yet (no `aOS<v>` tag: `git ls-remote --tags
  origin 'aOS*'`), add to it. Otherwise add a new entry above it with the next
  minor version (`1.1` after `1`); the owner picks the final number when
  releasing.
- `highlights` are the most important changes - the update screens in the
  apps show these; `notes` are everything else, shown in aOS's full log.
- Per app: `apps: { weather: { highlights: [...], notes: [...] } }` (a plain
  list is all notes). An app a minor release doesn't mention shows no update
  screen.

## Layout

- `aOS/` (capital O and S, `/aOS/`) is the app store and home of every app;
  its `data-app` id is `aos`. Each app is added to the Home Screen on its own.
- `home/` was the launcher; it is **retired**. It now holds the scripts every
  app shares - `welcome.js` (welcome, walkthroughs, update screens, install
  steps, release log, theme) and `slide.js` - plus the Welcome Lab. Its
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
  on a 401. See `aOS/RELEASING.md`, "Family accounts".
- Light or dark: `home.settings.theme` (`auto`/`light`/`dark`), applied as
  `data-theme` on `<html>` by `welcome.js`, which also switches an app's
  `@media (prefers-color-scheme)` rules to match.
- The AllisonOS colours are **Sea glass** (sea glass, mist, shell, sand):
  `--w-pastel` / `--w-hot` in `welcome.js`, `--pastel` in `aOS/index.html`.
  Use these rather than new pastel gradients. "aOS" is always written with a
  lowercase a, never uppercased by CSS.
