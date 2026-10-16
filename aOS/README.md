# aOS

The home of every AllisonOS app, laid out as an app store, in a mid-century
modern look. Part of the Allison Corporation. Its address ends in `/aOS/`.

## The look

Mid-century modern in the Retro colors, the same as every app's Vintage design
(from the aOS Design Styles canvas):

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and walnut; three atomic shapes behind each
  title that scroll away with the page, and three little bars under it;
- Today's postcards each in a color of their own (teal, mustard, cream, orange,
  walnut), with their own shapes, and the same colors on the story when it opens;
  the preview cards on an app's page cycle through four of them;
- a walnut pill for the tabs, with a mustard pill that slides; solid orange for
  the one main button (Get, Send, Save), outlined teal for the rest;
- Futura, which iOS has built in, so no font is downloaded;
- an icon to match: a geometric cream "aOS" on teal with a mustard sun
  (`icon.svg`, drawn into the PNGs by `scripts/make-icons.mjs`).

It is its own `<style id="vintage">` block in `index.html`, after the Sea glass
styles, which are still there underneath.

**The sky.** In the Vintage look the page behind the title has Weather Vintage's
backgrounds with the real sun, as every app's Vintage design does (`../home/sky.js`): by
day a ground washed with mustard, the sun and rays that turn very slowly; after
sunset a ground washed with deep teal, the moon and twinkling stars; each over
cream (Light) or walnut (Dark), and the app's page for an app has a moon behind its
icon at night. Sea glass has none of it (`sky.js` stands down while
`data-look="glass"`). `scripts/sky-test.mjs` checks it.

**Look picker.** Two places, the same choice. In Safari, the first install step
(**Choose your look**, `home/welcome.js` `playInstall`) comes before the steps for
adding aOS to the Home Screen, since iOS takes the icon, status bar style and
address then. Afterward, under your account (the avatar), Appearance > **Look**.
**Vintage** is the default; **Sea glass** is the original. The choice is kept on
that phone (`localStorage` `aos.look`), not in the family account.

The Home Screen app has storage of its own, apart from Safari's, so the choice made
in Safari travels two ways: `?look=` on the address in Safari (which is what iOS adds)
and an `aos_look` cookie. On its first launch, with nothing stored yet, the app takes
whichever it finds and keeps it; after that its own storage decides. Sea glass also
means the Sea glass icon (`icon-glass-180.png`, `icon-glass-512.png`: the original
icons) and the original status bar style (`black-translucent`; Vintage uses `default`).
On Android, Chrome installs with the manifest's icon (Vintage's), so there the look is
picked under the account after it is installed. `look.js` runs
in `<head>`, after the styles and before the first paint: it sets `data-look` on
`<html>`, switches the Vintage `<style>` off for Sea glass (`media="not all"`), and
sets the two `theme-color` tints, so there is no flash of the other look. The
family icon on Today follows it too. `scripts/look-test.mjs` covers it, `join-test.mjs` the install step.

In either look the apps' own icons in the list keep their look, and the Welcome
and update screens the apps share (`home/welcome.js`) are unchanged. The status
bar is `default`, not `black-translucent`, which always draws the clock white and
would vanish on the cream.

## App icons

They follow the look. Every app carries both its designs (Vintage and Standard, picked in its own Settings,
`home/design.js`), so its folder has both icons: `icon-512.png` (Vintage, mid-century) and `icon-glass-512.png`
(Sea glass). In the **Vintage** look aOS shows each app's Vintage icon; in the **Sea glass** look, its Sea glass
one. `icon()` in `app.js` decides, and the list, the Today stories and the family icon repaint when the look is
changed under the account; the glow behind each (`HUE`) follows too. This changes only what aOS draws: the icon
an app gets on the Home Screen follows the design picked in that app. The 14 mid-century icons each
have a different background colour: teal Mail, mustard Home, orange Orders, olive News, denim Calendar, walnut
Fitness, berry Drinks, sky Weather, indigo Travel, slate Notes, plum Podcasts, green Places, brick Meals,
midnight Clock. (`aOS/icons/` holds the first mid-century icons drawn for Notes, Podcasts, Places and Meals;
aOS no longer shows them.)

## The flow

1. The aOS link opens in Safari: aOS asks for its look first (**Choose your look**:
   Vintage or Sea glass, see "The look" below), because iOS takes the icon, the
   status bar style and the address when it is added; then it shows how to add it
   to the Home Screen (Safari's steps, animated, with the chosen icon) and nothing else.
2. aOS opened from the Home Screen: the AllisonOS welcome and its tour, ending
   on the apps.
3. An app tapped in aOS opens its own address with `?via=aos`. In Safari, or
   the in-app Safari view an installed aOS opens links in, it shows how to add
   that app. The in-app view may call itself standalone, so `?via=aos` is what
   counts there: remembered for that view and taken off the address at once,
   so the address added to the Home Screen is clean. In that view the steps
   stay, with no **Not now**: the view's **✕** is the only way out, back to
   aOS's tiles, so the view never shows the app itself and coming back to aOS
   later lands on aOS.
4. The app opened from the Home Screen: its own walkthrough, ending with
   Light or dark.

Safari or the Home Screen is told apart by `display-mode: standalone` (or
`navigator.standalone`). Every app's manifest asks for `standalone`.

## Family accounts

**Your account** at the top of aOS. The owner sets up once with the owner code,
then invites people: a link good once for 24 hours, opened in Safari, where
they make their account (a passkey, saved to their iCloud Keychain) before
adding aOS to the Home Screen. Every app then signs in with one Face ID tap -
passkeys reach every app on the site even though each keeps its own storage.
Calendar and Travel's server routes only answer signed-in family; removing
someone signs them out of every app. The owner also saves the family's Home
Assistant address there (**Home Assistant address**); Home fills it in for
anyone signed in, so each person only makes their own token. Details and the one Cloudflare step:
`RELEASING.md`, "Family accounts".

## The page

An app store in Sea glass: a mist ground with soft colour fields, a sea-glass
accent, and the Sea glass pastel for the one thing to tap (Get, the selected
tab, Install). Rounded squares rather than circles; small pastel squares mark
headings. A glass dock at the bottom - **Today**, **Apps**, **Search** - with a
pastel stop that slides between them, and your avatar top right.

- **Today**: first the family card - aOS is curated for the Allison family:
  the family icon (two adults, two children and a heart, white on Sea glass),
  "The Allison Family", a greeting by name, and, signed in, everyone in the
  family (`GET /aOS/api/members`, names only). Then postcards laid out as a bento (one tall, two halves, one wide):
  setting up Home, the app of the day, what's new (the aOS mark), meet an app,
  your family account. Each opens full screen. Signed out, a card at the top
  asks you to sign in (or set up, or join).
- **Apps**: each app its own card, glowing in its colour, with its tagline (or
  "New in aOS1.1" when the newest release changed it) and **Get**, or **✓
  Installed** for an app opened from your Home Screen in the last 90 days. Each
  app reports itself (`home/welcome.js`, at most every 12 hours) to your family
  account (`POST /aOS/api/installed`); since each Home Screen app keeps its own
  storage, an app that has never signed in asks once, after its walkthrough, with
  the family sign-in sheet ("Not now" isn't asked again). A tap on Installed
  still offers the install steps, in case it's been removed.
- **Designs**: every app carries both its designs itself, Vintage (the default) and
  Standard (Sea glass), picked in the app's own **Settings → Design**, so aOS shows one
  row per app, with no Design menu, and **Get** always adds the app itself. The old
  Vintage apps (`mailvintage` and the rest) are not offered; their addresses open the
  app itself (the deploy copies each app there). `DESIGNS` in `home/welcome.js` (a
  design that is its own app folder) is empty, and the Design menu code is unused.
  `node aOS/scripts/designs-test.mjs` covers it.
- **Search**: by name, tagline, category, design or what its walkthrough says.
- **An app's page**: centred, a halo of its colour, **Get**; its facts as chips
  (version, category, shared or yours, maker); What's New (the latest version only);
  Preview (drawn from its walkthrough cards, not screenshots); What it needs;
  About; Information. Swipe from the left edge to go back.
- **Get**: opens the app's own address with `?via=aos` straight away (in the
  in-app Safari view an installed aOS opens links in); there the app shows only
  its install steps, animated, and the view's ✕ comes back here.
- **The avatar**: your account (the owner's set-up, an invite's Join, Sign in;
  signed in, the owner's tools: the Home Assistant address, invites, the
  family), Appearance (`home.settings.theme`; each app on the Home Screen keeps
  its own, asked in its walkthrough), Updates (the latest version only,
  silent releases left out, a short line each) and Replay the welcome. An
  invite link or the owner's first set-up opens it by itself, and
  `../aOS/#whats-new` (the apps' update screens link there) opens it at Updates.

## Versions, welcomes and walkthroughs

All of it is in `../home/welcome.js`, which every app loads with its own name
(`data-app="weather"`, here `data-app="aos"`), and which keeps the release log.
There is one version number for everything: aOS1, aOS1.1, aOS2.

- **In Safari on iPhone**, aOS and every app alike: how to add it - Safari's
  steps animated on a phone with its name and icon (••• then Share, scroll to
  Add to Home Screen, Open as Web App on and Add, the icon popping onto the
  Home Screen), and **Not now** (asks again in a new tab). The animation is a
  likeness of iOS 26 Safari drawn in HTML (`AllisonOS.welcome.safariDemo`),
  not a recording.
- **aOS, the first time**: the AllisonOS welcome, a touch slower than the app
  intros - the name drawn on in pastels; then in one motion "llison" folds
  away while the A melts into an a and slides along to meet "OS", the colours
  spreading back across what is left, and aOS grows to the middle; the 1 drops
  in as a superscript, a ring pulses out, stars twinkle and a shine runs
  across; "The Power of aOS1", the apps bursting out of it into a grid, then
  the tour (everything in one place and working together, always up to date,
  made to work for you, Light or dark, yours alone, choose your apps). On a
  short screen a card that would cover the mark fades it instead.
- **aOS, a major update (aOS2)**: the name and the new mark again, then that
  release's cards (or its notes).
- **aOS, a minor update (aOS1.1)**: nothing; the apps announce it.
- **Each app, the first time**: its walkthrough - its icon and name with aOS¹
  under it, four or five cards on what it does (written from its README), then
  Light or dark (not Weather, which is drawn for dark only).
- **Each app, a minor update (aOS1.1)**: its icon, with aOS¹ under it and the
  new .1 rising in after the 1 (an old .x lifting away first) in its own
  brighter gradient, with a glow, a ring, an underline sweep and a soft pulse;
  then "What's new in Weather" with that app's highlights from the release
  (or its first notes) and a link to the full log in aOS. An app the release
  doesn't mention shows nothing.
- **Each app, a major update (aOS2)**: the old number lifts away and the 2
  rises in, then "Weather is on aOS2" with the release's highlights and
  **Open aOS** for the rest.

What an install has seen is `localStorage` `aos.seen` (`{ app: the aOS version
it last showed }`). On iPhone an app on the Home Screen keeps its own storage,
apart from Safari and the other apps, so each install counts for itself.
"aOS" is never set in capitals: its a is always lowercase.

Updates go out only when released: see `RELEASING.md`. Merged changes wait on
the default branch until then.

## Light or dark in every app

A chosen Light or Dark is `data-theme` on the page. Some apps' CSS follows only
the iPhone's setting (`@media (prefers-color-scheme: ...)`); for those,
`welcome.js` switches those rules on or off to match the choice (System puts
them back), and the theme-color metas with them, so every app follows it.

## Files

- `index.html`: the page and its look; `app.js`: its script (a file of its own,
  so the page's Content-Security-Policy allows only this site's scripts).
  `sw.js`: offline, network-first.
- `icon-512.png`, `icon-180.png`: "aOS" in white on the pastels - no version
  number, since that changes - drawn by `scripts/make-icons.mjs` (headless Chromium).
