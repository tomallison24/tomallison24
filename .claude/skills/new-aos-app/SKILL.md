---
name: new-aos-app
description: Add a new app to AllisonOS (aOS), or bring an existing web app into it, so it is wired into aOS completely and follows the ground rules every aOS app shares. Use whenever a new app folder is created in this repo, an outside app (an HTML file, another repo) is being moved in, or an app's registration, walkthrough, icon, offline shell or look is being changed. Also use to review an app against aOS's design rules.
---

# Adding an app to aOS

Every app lives in its own folder at the site root, is added to the Home
Screen on its own, and is offered by aOS (the app store, `aOS/`). An app
that's only half wired in looks fine in a browser but is missing from aOS,
never gets published, or breaks "Installed". Follow these steps in order, then
run the check at the end: it fails on anything missed.

Read `CLAUDE.md` first (releases, the release log, the layout). Drinks
(`drinks/`) is the most recent complete example, and Fitness (`fitness/`) is
the one most apps are modelled on: copy from them rather than from memory.

## 1. The folder `<id>/`

The id is short, lowercase, one word (`drinks`); its display name goes in
`NAMES` (step 2). Files:

- `index.html`: the page, with Fitness's `<head>` as the pattern:
  - `viewport-fit=cover`, `apple-mobile-web-app-capable`,
    `apple-mobile-web-app-status-bar-style` `black-translucent`,
    `apple-mobile-web-app-title`, `apple-touch-icon` (`icon-180.png`), two
    `theme-color` metas (light `#F2F2F7`, dark `#08080B`), the manifest link.
  - A strict Content-Security-Policy meta (`script-src 'self'`, `connect-src`
    only what it calls).
  - Last before `</body>`:
    `<script src="../home/welcome.js" data-app="<id>" data-auto defer></script>`.
    Before it, `../home/slide.js` if it has switches, and `../home/account.js`
    if it calls a family-only server route.
  - Never `../home/back.js` (retired).
- `app.js` (and any pure-logic file, like `calc.js` or `analysis.js`, kept free
  of the page so it can be tested in Node).
- `sw.js`: Fitness's, with `CACHE = '<id>-v1'` and a `SHELL` list in which
  every file exists (a missing one breaks the install). Network-first; leave
  `/api/` alone. Bump the version when the shell changes.
- `manifest.webmanifest`: name, short_name, description, `start_url` and
  `scope` `"./"`, `display` `standalone`, colours `#08080B`, a 180 and a
  512 (`any maskable`) icon.
- `icon.svg`, rendered to `icon-180.png` and `icon-512.png` by
  `scripts/make-icons.mjs` (copy Fitness's). The look: a full-bleed diagonal
  gradient in a hue no other app uses, a soft glow top left, one white glyph.
- `README.md`: what it does, the data and where it lives, how it syncs, tests.
- `scripts/`: tests (`*-test.mjs`): Node for the logic, and a Playwright
  `app-test.mjs` at iPhone size (390 × 844) that seeds
  `localStorage['aos.seen']` so the walkthrough doesn't cover the page.

## 2. Wire it into aOS

| Where | What |
|---|---|
| `home/welcome.js` `APPS` | the id, where it should sit in aOS's list |
| `home/welcome.js` `NAMES` | its display name |
| `home/welcome.js` `TOURS` | `{ tag, cards }`: a one-line tag and 3 to 6 cards, written from its README; each card's `i` must be a key of `LINE` |
| `home/welcome.js` `OS_TOUR` | the sentence listing every app by name |
| `home/welcome.js` `DARK_ONLY` | only if it is drawn for dark only |
| `home/welcome.js` `RELEASES` | a line in the top entry (see `CLAUDE.md`, "The release log") |
| `aOS/index.html` | `HUE` (its glow, an RGB triple), `CAT` (category), `NEEDS` (what a new person must do: `ok` or `once`), and `SHARED` only if it shares with the family |
| `functions/aOS/api/[[route]].js` `APPS` | the same list, same order, as welcome.js (else "Installed" returns 400) |
| `.github/workflows/news.yml` | `'<id>/**'` in the push paths, and the folder in the `cp -r … _site/` line (else it is never published) |

Server side, if it needs one: `functions/<id>/api/[[route]].js`, guarded by an
`X-<Name>: 1` header, answering with `reply()` from `server/auth.js`. Lock it to
the family with `functions/<id>/api/_middleware.js` (`lock`), or, for one
person's own data, check `sessionUser()` in the route (as Drinks does). Data in
the accounts KV gets a key prefix documented in `server/auth.js`, and anything
per person is deleted in `functions/aOS/api` `remove`.

## 3. The ground rules

- **Look**: Fitness's tokens, the faint tiles every app shares (`--tile`,
  `--tile-edge`, no shadow), Liquid Glass sheets and buttons, the system font
  (`-apple-system…`), no web fonts or anything loaded from another site. Sea
  glass (`--w-pastel` / `--pastel`) for AllisonOS's own highlights only: no new
  pastel gradients.
- **Light and dark**: tokens under `@media (prefers-color-scheme: dark)` with
  `:root:not([data-theme="light"])`, repeated for `:root[data-theme="dark"]`;
  welcome.js applies the person's choice. Don't build your own theme switch.
- **Motion**: honour `prefers-reduced-motion` (and
  `prefers-reduced-transparency` for glass).
- **Simple**: one main screen where possible; a sheet for each thing you open;
  the fewest controls that do the job. Tap targets 44 px. Real `<button>`s and
  labels; colour never the only signal.
- **Words**: plain, second person, British spelling (`lang="en-GB"`), short
  sentences. "aOS" always with a lowercase a, never uppercased by CSS.
- **Safe**: escape everything put into `innerHTML`; refuse to run in a frame.
- **Free plan** (Cloudflare): KV writes are 1,000 a day for the whole account
  and a request gets 10 ms of CPU. Write only when something changed, send
  only what changed, and keep requests small.
- **Public repo**: no secrets, and no one's real data, in code, tests or
  fixtures. Made-up data only.

## 4. Check, test, and tell the owner

```
node aOS/scripts/check-apps.mjs        # wired in, and the ground rules; must end with 0 errors
node <id>/scripts/<tests>.mjs          # the app's own tests
```

`.github/workflows/apps-check.yml` runs the check on every push and pull
request too. Fix every error; say in the PR which warnings remain and why.

Then open a PR. Merging publishes nothing: the owner releases (`CLAUDE.md`,
`aOS/RELEASING.md`). Never release unless the owner asks.
