# Releasing aOS

The site only ever publishes the newest released version, `aOS<version>` (a
git tag: `aOS1`, `aOS1.1`, `aOS2`), and **every merge to the default branch
releases on its own**: the newest version in the release log is tagged on the
merged code and published within a few minutes. The News headlines still
refresh every 30 minutes, on the live release.

## 1. Write the release's entry

At the top of `RELEASES` in `home/welcome.js` (newest first):

```js
{ v: '1.1', date: '2026-11-01', title: 'Smoother everywhere',
  highlights: ['The most important change, for the update screens'],
  notes: ['Everything else, for the full log in aOS'],
  apps: {
    weather: { highlights: ['Radar loads faster'], notes: ['Hourly rain chance'] },
    mail: ['A plain list is all notes'],
  } },
```

- **Minor** (`1.1`): aOS shows nothing. Each app named in `apps` shows aOS with
  the new .1 rising in, its highlights (or its first three notes) and a link
  to the full log. An app not named shows nothing.
- **Major** (`2`): aOS replays the name and the new mark, then the release's
  `cards` (or its highlights). Every app shows the new number rising in, the
  release's highlights and **Open aOS** for the rest.
- A patch with nothing to announce (`1.0.1`, no `apps`) shows nothing anywhere.
- `silent: true`: released and logged here (`RELEASES`), but shown nowhere: not
  in aOS's **What's new**, and the apps keep showing the last version that
  wasn't silent (aOS1.1 silent: they still say aOS1), with no update screen.

Merge it with the changes it describes: the merge releases it.

## 2. How it's released

Merging to the default branch runs **Actions → News**, which tags the merged
code as the newest version in the log (`aOS1.1`) and publishes it to
Cloudflare Pages and GitHub Pages. To release by hand anyway (to re-release
without a merge): **Actions → News → Run workflow**, branch = the default
branch, **release** = the version, **Run**.

The run checks that the version is the newest entry in the log, tags the
default branch, and publishes it.

**Adding to a released version** (everything going out as aOS1 again): keep
adding to its entry at the top of the log; each merge releases it again. Its
tag moves to the latest code, and the tag of any version that's no longer in
the log (an aOS1.1 folded into aOS1) is removed, so it's the live one. Phones
see the changes but no new version number and no update screen. Each phone sees the update the next time it
opens an app (the service workers load network-first).

Run it with **release** blank to republish the live release with fresh
headlines. `labs/` (test pages for you, not apps) always comes from the
latest merged code.

## Family accounts

Everyone signs in with a passkey (Face ID): the owner once with the owner code,
everyone else with an invite from aOS (**Your account → Invite someone**). Calendar
and Travel's server routes then only answer signed-in family. The server side is
`server/auth.js` and `functions/aOS/api`; the apps' side is `home/account.js`.

They need storage on Cloudflare, which the publish makes and attaches by itself
once the Cloudflare token is allowed to:

1. dash.cloudflare.com → **My Profile → API Tokens** → the token the GitHub
   workflows use → **Edit**.
2. Add **Account · Workers KV Storage · Edit** (and, for Notes' reminder
   notifications too, **Account · Workers Scripts · Edit**). Keep what's there.
3. **Continue to summary → Update token.** The token's value doesn't change.

Until then accounts stay off and everything works as before. After a release,
the owner opens aOS, enters the owner code and their name, and makes their
passkey; from that moment the lock is on.

The owner can then save the family's Home Assistant address (aOS → Your account
→ **Home Assistant address**, the Nabu Casa one). It's kept in that storage, not
in the repository, and only signed-in family can read it: Home fills it in for
them, so each person only makes their own token.

The family's plan (aOS → Your account → **Subscription**, just for fun: nothing
is charged) is kept there too, as `config:plan`. It's Pro+ from when the owner
joined until the owner changes it. Cancelling keeps a plan until the end of its
month, and a trial lasts 7 days; after that every app but aOS shows that it's off,
with the way back to aOS, until the owner picks a plan. With accounts off there
is no plan, and nothing is switched off. Tests: `node aOS/scripts/plan-api-test.mjs`.

## The log

`home/welcome.js`'s `RELEASES` is the log, by aOS version. aOS shows all of it
under **What's new in aOS**: each version's highlights (starred), its notes,
then what changed in each app. The update screens in the apps show only the
highlights.
