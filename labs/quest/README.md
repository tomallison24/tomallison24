# Quest owner test page

Original mouse knight, shared-device nickname profiles, five-question math/reading/spelling rounds, four stages per subject, spoken prompts, sound effects, hints, retries, and coins. Earn 3 coins independently on the first try, 1 after help/retries, and 2 for completing a round. Subjects advance after 11 of the last 12 answers are independent across six different questions. These are prototype rules, not validated educational assessments.

## Scope and hosting
Only labs/quest/ is added. No app catalog, release log, shared scripts, workflow, account, or existing page changes. This is not a registered aOS app. The existing workflow publishes labs/ after a default-branch merge; that merge also triggers the aOS release workflow. Branch pushes do not create a hosted preview. Do not merge/publish without owner approval. /labs/quest/ is a proposed deployment path, not an already-live link.

No secrets or real personal data are included. Profiles use only quest.lab.v1 in localStorage. Clearing browser data can lose progress. Export backup is available, but there is no restore UI yet. No server sync, service worker, offline guarantee, analytics, microphone, or child account. Device speech availability varies. An unfinished round is not resumed after reload; earned coins remain saved. Controls include audio toggles and all-stage question previews with no progress changes, but no child-proof parent gate. Only a preliminary Vintage-style light/dark design is included; the second design and full aOS onboarding are deferred.

## Validation and acceptance
Preparation: Node syntax checks passed; seeded tests passed for 3,000 questions, arithmetic/choices, spelling tiles, rewards, profile isolation, progression, duplicate payment protection, and backup-data validation. No browser tests, physical-iPhone tests, repository CI, or full aOS checks have run locally.

After an approved deployment, open directly in Safari. Test nickname entry, all three games, audio activation/mute, help and retry, repeated taps, spelling undo/clear, round rewards, persisted balances after reload, profile isolation, parent previews, backup export, portrait/landscape, text scaling, light/dark, and VoiceOver.

Deferred: shop/equipment, adventure map, adaptive downshift, more learning content, backup restore UI, two production designs, aOS integration, and automated browser/CI coverage.
