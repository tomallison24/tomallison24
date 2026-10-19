# Ipsy Warrior Town: development prototype

The living-town update is on feature/ipsy-living-town, based on feature/ipsy-warrior-mvp. This is isolated development work, not a registered or released aOS app. Do not merge it as a finished release.

## Run locally

Serve the repository root with a static HTTP server, for example:

    python3 -m http.server 8000

Open http://localhost:8000/labs/ipsy-warrior/. JavaScript modules require HTTP; do not open index.html directly.

Enter a local player name to create or reopen that save. Names are case-insensitive and trimmed. Playtest pace is the default for new pets and runs elapsed game time at 60x. Standard pace uses real time. An existing save retains its original pace.

## Explore the living town

Walk with arrow keys or WASD, tap a destination, or drag the on-screen joystick. The camera follows Ipsy. Tap a building to walk to its entrance, then open its existing activity; press E or the nearby-action button to enter or speak to a resident. “Go somewhere” provides accessible direct buttons for every location.

Ten residents have local autonomous routines: they walk between the square, shops, park, gym and arena, pause, and greet Ipsy and each other. They use authored dialogue and deterministic behavior, not an external generative-AI service. Their appearance varies. The world includes a fountain, pond, flags, smoke, flowers and insects; lamps glow after dark. NPC movement and town position are presentation state, not saved game progress. They restart on reopening the game.

Ipsy walks, blinks and breathes, shows equipped gear, and reacts to care. Feed opens four food choices (berries, apple, soup, carrot); choosing one applies the existing feeding rule once and plays its eating sequence. All foods restore the same fullness. Canceling the tray changes nothing. Petting, washing, resting, training, equipping, reading clues, booking, combat and practice have distinct visual reactions. Animation completion never changes saved rewards or stats. Reduced-motion preferences keep controls and outcomes functional while disabling decorative animation.

This is an illustrated, explorable 2D town alpha, not a finished 3D open-world game. Town movement pauses while an activity sheet is open. Care and battles remain in activity sheets; seamless interiors and real-time combat are future work.

## Playable loop

Hatch Ipsy at home, then feed, pet and wash him. Three bonding moments plus five game minutes unlock young-warrior growth. Visit the park for ten-target coin practice, the store for equipment, and the gym for permanent training. Find clues in the park, gym and noticeboard. Book a preparation window, then enter the arena when the city is ready. Late players do not forfeit.

The three authored opponents have weaknesses, resistances, attack tells and different patterns. Defending a heavy attack creates a counterattack opening. Defeat never removes coins or equipment. Care is free; needs have a floor and Ipsy cannot die. Adult growth requires two game days, bond 20 and an arena victory.

## Saves and limitations

Saves are localStorage entries under ipsy.warrior.lab.v1.*. A name is a local save slot, not a verified identity or private account. These saves do not sync between devices. Settings can export a JSON backup; in-app restoration is not implemented yet. Basic revision checks detect conflicting tabs before an action saves. Client-side state is editable; no competitive anti-cheat is claimed.

The town uses its own prototype design picker, not the final shared aOS integration. Vintage and Sea glass include device light/dark styling and reduced-motion handling. Opponents use authored computer-controlled rules, not generative AI. Artwork and equipment presentation are placeholders.

## Checks

    node --test labs/ipsy-warrior/engine.test.mjs labs/ipsy-warrior/world.test.mjs labs/ipsy-warrior/cloud/cloud.test.mjs labs/ipsy-warrior/cloud/client.test.mjs
    node --check labs/ipsy-warrior/town.mjs
    NODE_PATH="$(npm root -g)" node labs/ipsy-warrior/town.browser.mjs
    NODE_PATH="$(npm root -g)" node labs/ipsy-warrior/world.browser.mjs
    NODE_PATH="$(npm root -g)" node labs/ipsy-warrior/cloud/client.browser.mjs

The browser script requires Playwright 1.56.1 and its Chromium browser. CI installs them. It covers four 390x844 scenarios: both designs in light/dark, hatching, care, clues, mini-game rewards, equipment, booking, arena victory, profile separation and page errors. Test fixtures advance pet age and booking time to avoid real waits. The living-town update passed 85 Node tests and the four town Chromium scenarios. The additional world browser suite covers food choices, cancellation without save changes, animation preferences, walking to a location, keeping the world mounted across actions, touch-control release, mobile width and cleanup when switching players. It is not physical iPhone or WebKit certification.

## Before release

Connect verified aOS identity, one private pet per person, server saves, synchronization and deletion cleanup. Register Games using the full new-app checklist, shared scripts, PWA assets, release wiring and CI. Run all platform and browser checks, test actual iPhones, and review balance and art. No merge or deployment is authorized by this development commit.
