# aOS

The home of every AllisonOS app, laid out as an app store, in the same
Sea glass as the AllisonOS welcome. Part of the Allison Corporation.
Its address ends in `/aOS/`.

## The flow

1. The aOS link opens in Safari: aOS shows how to add it to the Home Screen
   (Safari's steps, animated) and nothing else.
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

- **Today**: postcards laid out as a bento (one tall, two halves, one wide):
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
- **Search**: by name, tagline, category or what its walkthrough says.
- **An app's page**: centred, a halo of its colour, **Get**; its facts as chips
  (version, category, shared or yours, maker); What's New and Version History;
  Preview (drawn from its walkthrough cards, not screenshots); What it needs;
  About; Information. Swipe from the left edge to go back.
- **Get**: the install steps, animated, in a sheet; **Install** (once they've
  played through) opens the app's own address with `?via=aos`, which shows how
  to add it, and the view's ✕ comes back here.
- **The avatar**: your account (the owner's set-up, an invite's Join, Sign in;
  signed in, the owner's tools: the Home Assistant address, invites, the
  family), Appearance (`home.settings.theme`; each app on the Home Screen keeps
  its own, asked in its walkthrough), Updates (the release log, newest first,
  silent releases left out, highlights starred) and Replay the welcome. An
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

- `index.html`: the whole app. `sw.js`: offline, network-first.
- `icon-512.png`, `icon-180.png`: "aOS" in white on the pastels - no version
  number, since that changes - drawn by `scripts/make-icons.mjs` (headless Chromium).
