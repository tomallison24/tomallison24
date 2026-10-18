# Account client connection: opt-in test milestone

Prepared against the committed backend on feature/ipsy-warrior-mvp. Not committed or deployed by preparing this package.

Serve the repository root, then open /labs/ipsy-warrior/account-test.html. The page loads the existing home/account.js helper and provides explicit sign-in, refresh, account-pet creation, hatching, care, retry and sign-out controls. It is an integration test screen, not the full town. The existing local town and its storage are unchanged. No local pets are automatically imported or overwritten.

The controller captures a session token for each request. It intentionally does not use account.fetch's automatic 401 sign-in/retry behavior for game commands: a pending command must never be resubmitted as another person. Sign-in is explicit. Account or token changes invalidate in-flight responses and clear visible pet state. The server remains the authority for owner selection.

One pending command is journaled per account under ipsy.warrior.account.pending.* before POST. No bearer token or whole pet snapshot is duplicated there. Ambiguous results retain the exact command ID/revision/action for explicit retry. New actions are blocked until resolution. A 409 conflict updates the displayed revision but never auto-replays the rejected action. Storage failures fail closed. The screen shows only acknowledged changes and never fabricates a local fallback pet.

Run unit tests:

    node --test labs/ipsy-warrior/cloud/client.test.mjs

Run browser scenarios with Playwright installed:

    NODE_PATH="$(npm root -g)" node labs/ipsy-warrior/cloud/client.browser.mjs

Local results: 27 unit tests and four Chromium scenarios passed (Vintage/Sea glass, light/dark, 390x844). Browser tests mock the account helper and API; they test the UI/controller contract, not real passkeys or Cloudflare. Locally Node 20.20.1 and Playwright 1.51.1 were available; CI is configured for Node 22 and Playwright 1.56.1, and has not run for this uncommitted batch.

Still required: full-town controls using this controller, private migration policy, offline-play decisions, actual Cloudflare provisioning/binding under separate approval, real sign-in/server integration, account-lifecycle cleanup, Games registration and physical iPhone testing. In the current unprovisioned environment the correct API outcome is unavailable, not working cloud sync.
