# Ipsy Warrior MVP: isolated development

This folder stages the new game without registering an unfinished app or changing any live app. Nothing here should be merged as a finished aOS release yet.

## First commit

The pure JavaScript engine implements hatching, care, time-and-care growth, bond, target-practice rewards, permanent training, equipment, opponent clues, future fight bookings, and turn-based combat against three authored AI monsters. There is no generative-AI dependency.

Needs have a floor; Ipsy cannot die. Defeat never removes coins or equipment. Fights wait for late players. Playtest pace runs elapsed game time at 60x; standard pace uses real time.

The engine has no DOM, network, authentication, or storage dependencies. It returns a new state for each action. Its client-side save validator is a prototype guard, not server-side authorization or anti-cheat.

## Test

From the repository root, with Node 22:

    node --test labs/ipsy-warrior/engine.test.mjs

All 21 tests passed locally before this commit was prepared. CI must independently verify the pushed commit. The full campaign scenario earns coins in mini-games and uses legal purchases, training, clues and combat actions to defeat all three opponents.

## Remaining before release

- Commit and connect the town interface, location sheets and Ipsy artwork.
- Connect verified aOS identity: one pet per person, private server saves, conflict-safe synchronization and deletion cleanup. Local profile names are not authenticated accounts.
- Add Games to aOS using the complete new-app checklist, shared designs and welcome scripts, icons, PWA shell, release wiring and CI.
- Run the platform-wide checks, browser tests and actual iPhone testing.
- Review balance and presentation before requesting merge/deployment approval.

The branch is development-only. This commit does not publish the game or change the release log.
