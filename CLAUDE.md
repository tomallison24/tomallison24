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
releases it (above). Auto-merge works only while the default branch's protection
rule requires checks (the owner sets it in Settings > Branches): every job's name
is its own (`apps`, `changes`, the twelve groups, `tours-0` to `tours-2`,
`calendar-gmail`, `ipsy-clearance`, `ipsy-presence`), and each reports on every
pull request, so any can be required. A new job that might not run on some pull
requests skips its steps rather than itself.

## The release log

`RELEASES` at the top of `home/welcome.js`, newest first, one version number
for everything (aOS1, aOS1.1, aOS2). When you ship something a user would
notice, add a line for it:

- By default, add to the top entry (aOS2.2 now): each merge releases it again,
  moving its tag; phones get the change with no update screen. A change worth
  announcing with update screens gets a new entry above it, when the owner
  wants one; the merge that adds it releases it:
  - the next minor version (`1.2` after `1.1`): follow
    `.claude/skills/aos-minor-release/SKILL.md`;
  - the next major version (`2`): follow
    `.claude/skills/aos-major-release/SKILL.md`.
  Either way `node aOS/scripts/release-test.mjs` (CI runs it) plays the new
  entry in aOS and every app, as a phone on the version before would see it.
- A new app: add its id to the entry's `added: [...]`. aOS's Today then leads with it (and
  What's new beside it) for 30 days after the entry's date; after that, Today is a daily mix.
- `highlights` are the most important changes - the update screens in the
  apps show these; `notes` are everything else, shown in aOS's full log.
- Per app: `apps: { weather: { highlights: [...], notes: [...] } }` (a plain
  list is all notes). An app a minor release doesn't mention shows no update
  screen.
- **A new version notifies the family.** When a merge adds a new non-silent entry (1.3, 2),
  the release also sends "aOS updated to 1.x. Click for update details." to everyone with
  notifications on (`aOS/scripts/announce.mjs`, once per version; see `aOS/RELEASING.md`,
  "Notifications"). So write highlights that read well on the Updates screen: short and
  high level, a line each; the details go in `notes`, which that screen doesn't show.
- `silent: true` on an entry: it's only logged in `RELEASES`, shown nowhere
  (not in aOS's What's new); the apps keep showing the last version that wasn't
  silent, with no update screens.

## Adding or changing an app

Follow `.claude/skills/new-aos-app/SKILL.md`: every place an app must be wired
into aOS, and the ground rules every app shares. Then run
`node aOS/scripts/check-apps.mjs` (CI runs it too, `apps-check.yml`); it must
end with 0 errors.

## Tests

Every test runs in CI (`.github/workflows/apps-check.yml`): plain Node tests
in the `check` job (named `apps`), browser tests in the `browser` groups that run side by side (twelve of them, about three minutes of tests each, three at a time within a group by `.github/scripts/ci-run.mjs`: put a new one in the group that runs shortest), and the tours in nine shards over three jobs, `tours`. On a pull request the browser groups and the tours run only what it needs (`.github/scripts/ci-select.mjs`): everything when it changes shared code (`home/`, `server/`, `aOS/`, `functions/` outside an app's folder, the workflows), an app's own tests and every test that opens that app when it changes only some apps, none when it changes only `labs/` or documentation. A test that opens an app should name its folder (`'/notes/'`), so it runs when that app changes. The merge (a push to the default branch) runs only the quick `check` job, and `warm`, which keeps the browser caches filled for pull requests. `check-apps.mjs` fails on any
`<folder>/scripts/*test*.mjs` that no workflow runs, so a new test goes into
the workflow in the same PR. Browser tests seed `localStorage['aos.seen']`
with `'999'` for every app they open, so no walkthrough or update screen
covers the page after the next release. A test that depends on the date must
work on every day of the week and at the end of a month.

## Home and the Signal dashboard: change both

The Home app (`house/`) is the Signal dashboard (ha-config, `views_signal/`)
rebuilt as an aOS app: it reads the same devices from Home Assistant but draws
its own controls, so a change to one does not reach the other. When the owner
asks to change how a device looks or works (a light's presets, a thermostat,
a card), make it in both: here, and in the `tomallison24/ha-config` repository
(its own PR; its `CLAUDE.md` says how it reaches Home Assistant). If only one
can change, say so. `house/README.md` names the Signal card each part comes
from.

## Layout

- `aOS/` (capital O and S, `/aOS/`) is the home of every app (aOS2): its Home tab
  (`aOS/home-tab.js`) has Ipsy across the apps, Favorites and every app, and each app opens
  inside aOS, in a frame on this site, sharing aOS's storage (`window.aosHome`: `welcome.js` in
  the app takes aOS's insets and skips the install steps; data an app kept only on its own
  Home Screen copy moves in through the family account, `handoff`). It is also the app store;
  its `data-app` id is `aos`. Get on an app's page still adds that app's own Home Screen icon;
  opened from there, the app hands its data to aOS and says it lives in aOS now.
- `home/` was the launcher; it is **retired**. It now holds the scripts every
  app shares - `welcome.js` (welcome, walkthroughs, update screens, install
  steps, release log, theme), `slide.js`, `design.js` (Vintage, Sea glass, Night Drive
  or Tron), `names.js` (your helper's name where the words say Ipsy), `sky.js` (the Vintage designs' day and night sky),
  `aisles.js` (grocery sections, for Notes and Meals) and `ipsy.js` (Ipsy, the AI helper you
  chat with: Orders, Travel, Meals, Calendar, Notes, News, Fitness; its server side is
  `server/ipsy.js`) with `redact.js` before it (personal details stay on the phone: what goes to
  Claude, in Ipsy's chat and in Orders, Travel and Money's email checks, has email addresses,
  phone, card, account and ID numbers as placeholders, put back on the phone) - plus the Welcome Lab. Its `index.html` is a "moved to aOS" notice.
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
- **Four designs in every app**: Vintage (mid-century modern, the default), Standard (Sea
  glass), Night Drive (80s neon) and Tron (light cycles, after the
  Tron: Ares mode in Tesla's cars: red light on black, dark only; its light trail runs around each screen behind
  everything and round each app's icon, and on aOS Home it now and then sends a shot round a section or widget, `aOS/tron-shots.js`, the helper becomes Ares, the Tron: Ares rider (named so in every app), and aOS alone opens with its intro and sound, `aOS/tron-intro.js`; in Vintage aOS opens with Sunrise, `aOS/vintage-intro.js`,
  its sun going up into the disc at the top of aOS; in Sea glass with Tide, `aOS/glass-intro.js`, its "aOS" gliding into the page's), picked for every
  app at once in aOS (Account > Appearance > Look: `aOS/look.js` writes each app's design) or in
  the app's own Settings > Design, and kept on the phone (`design.<app>`; Clock's `set.design`).
  `home/design.js` (Clock: `clock/design.js`) applies it in `<head>`: the page's `<style
  id="vintage">` block on or off, `data-look` on `<html>`, the icon (`icon-*.png` Vintage,
  `icon-glass-*.png` Sea glass, `icon-neon-*.png`, `icon-grid-*.png`), status bar and bar colours.
  A change to how an app looks is made in Vintage and Sea glass; **Night Drive and Tron are
  generated from Vintage** (`<style id="neon">`, `<style id="grid">` and the icons, by
  `node aOS/scripts/make-looks.mjs`, palettes in `aOS/scripts/looks.mjs`): run it after changing a
  Vintage block or an `icon.svg` (check-apps fails until you do), never edit those blocks by hand.
  The Vintage designs used to be apps of their own (`<app>vintage/`): those folders are gone, and the deploy copies each app to its old Vintage address so phones
  that added one keep it (`design.js` moves that app's data over once). Server calls go to
  `../<app>/api/`, never a bare `api/`, so they work from that address too.
- **English only**: aOS and the apps were in Russian too (and had a fifth look, Folk); both are gone.
  A phone that had either picked opens in English and Vintage.
- The AllisonOS colours are **Sea glass** (sea glass, mist, shell, sand):
  `--w-pastel` / `--w-hot` in `welcome.js`, `--pastel` in `aOS/index.html`.
  Use these rather than new pastel gradients. "aOS" is always written with a
  lowercase a, never uppercased by CSS.
