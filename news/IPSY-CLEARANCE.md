# Ipsy notification clearance

News positions its Undo notification 108 pixels above the bottom safe-area inset so it clears the enlarged Ipsy button. This preserves Ipsy's larger size, subtle animations and existing behavior.

Keep the existing News assertions that the Undo notification remains clear of Ipsy in Vintage and Sea glass, in light and dark mode. Do not weaken those assertions or shrink Ipsy to hide an overlap.

## Validation

Run `node news/scripts/ipsy-test.mjs` and `node home/scripts/ipsy-presence-test.mjs` with Playwright 1.56.1 and Chromium installed. The full pull request checks must also pass before merging.

These automated checks use test data and Chromium; a visual check on an installed iPhone app remains useful.
