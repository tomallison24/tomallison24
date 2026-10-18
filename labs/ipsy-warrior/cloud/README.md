# Account-save backend: development only

The town UI is not connected to this backend yet. Nothing here authorizes deployment.

The Pages route /games/api/pet reuses server/auth.js sessionUser. Only the verified session ID chooses the GAMES_SAVES Durable Object. Client-supplied owner IDs cannot select a pet. Missing account setup or binding fails closed.

Each object stores one pet. POST accepts {id, revision, action}, not arbitrary snapshots. The server applies the existing engine using server time and standard pace. Create/delete are explicit actions. Atomic transactions compare revisions, reject stale commands, and retain 128 retry receipts. Deletion keeps revision/receipts so old retries cannot resurrect a pet. GET does not write. Responses disable caching.

Local test command:

    node --test labs/ipsy-warrior/cloud/cloud.test.mjs

All 32 tests passed locally on Node 20.20.1. Most use an atomic in-memory adapter and injected session results; four integrate the real engine/worker. They do not establish Cloudflare-runtime, real-passkey, physical-device, or production-binding compatibility. CI uses Node 22 and must verify independently. Existing engine/browser suites remain unchanged.

Deployment, requiring separate approval: deploy the separate Worker using this folder's wrangler.jsonc, then bind its IpsySave namespace to Pages as GAMES_SAVES and redeploy Pages. SQLite-backed Durable Objects are specified; do not substitute Workers KV for the transactional adapter. No deployment workflow or live Cloudflare configuration is changed here.

Before release: connect and test the signed-in client, explicit local-save migration, offline behavior, actual Cloudflare transactions, account-lifecycle cleanup, Games registration and device testing. Existing account revocation inherits auth.js/KV propagation behavior; it is not claimed instantaneous. Pet deletion clears game state but retains owner ID and bounded command receipts. Account-removal/purge integration is not implemented. Mini-game hit reports remain client-provided: this is not competitive anti-cheat.
