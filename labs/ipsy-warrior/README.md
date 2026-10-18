# Ipsy Warrior Town: development prototype

This is isolated work on feature/ipsy-warrior-mvp, not a registered or released aOS app. Do not merge it as a finished release.

## Run locally

Serve the repository root with a static HTTP server, for example:

    python3 -m http.server 8000

Open http://localhost:8000/labs/ipsy-warrior/. JavaScript modules require HTTP; do not open index.html directly.

Enter a local player name to create or reopen that save. Names are case-insensitive and trimmed. Playtest pace is the default for new pets and runs elapsed game time at 60x. Standard pace uses real time. An existing save retains its original pace.

## Playable loop

Hatch Ipsy at home, then feed, pet and wash him. Three bonding moments plus five game minutes unlock young-warrior growth. Visit the park for ten-target coin practice, the store for equipment, and the gym for permanent training. Find clues in the park, gym and noticeboard. Book a preparation window, then enter the arena when the city is ready. Late players do not forfeit.

The three authored opponents have weaknesses, resistances, attack tells and different patterns. Defending a heavy attack creates a counterattack opening. Defeat never removes coins or equipment. Care is free; needs have a floor and Ipsy cannot die. Adult growth requires two game days, bond 20 and an arena victory.

## Saves and limitations

Saves are localStorage entries under ipsy.warrior.lab.v1.*. A name is a local save slot, not a verified identity or private account. These saves do not sync between devices. Settings can export a JSON backup; in-app restoration is not implemented yet. Basic revision checks detect conflicting tabs before an action saves. Client-side state is editable; no competitive anti-cheat is claimed.

The town uses its own prototype design picker, not the final shared aOS integration. Vintage and Sea glass include device light/dark styling and reduced-motion handling. Opponents use authored computer-controlled rules, not generative AI. Artwork and equipment presentation are placeholders.

## Checks

    node --test labs/ipsy-warrior/engine.test.mjs
    node --check labs/ipsy-warrior/town.mjs
    NODE_PATH="$(npm root -g)" node labs/ipsy-warrior/town.browser.mjs

The browser script requires Playwright 1.56.1 and its Chromium browser. CI installs them. It covers four 390x844 scenarios: both designs in light/dark, hatching, care, clues, mini-game rewards, equipment, booking, arena victory, profile separation and page errors. Test fixtures advance pet age and booking time to avoid real waits. UI syntax was checked locally while preparing this commit; this new browser suite has not yet been executed or verified. It is not physical iPhone or WebKit certification.

## Before release

Connect verified aOS identity, one private pet per person, server saves, synchronization and deletion cleanup. Register Games using the full new-app checklist, shared scripts, PWA assets, release wiring and CI. Run all platform and browser checks, test actual iPhones, and review balance and art. No merge or deployment is authorized by this development commit.
