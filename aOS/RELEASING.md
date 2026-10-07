# Releasing aOS

Nothing reaches anyone's phone until you release it. Changes merged to the
default branch wait there; the site only ever publishes the newest released
version, `aOS<version>` (a git tag: `aOS1`, `aOS1.1`, `aOS2`). The News
headlines still refresh every 30 minutes, on the live release.

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

Merge it with the changes it describes.

## 2. Release it

On GitHub: **Actions → News → Run workflow**, branch = the default branch,
**release** = the version (`1.1`), **Run**. Or ask Claude to release it.

The run checks that the version is the newest entry in the log and isn't
released already, tags the default branch as `aOS1.1`, and publishes it to
Cloudflare Pages and GitHub Pages. Each phone sees the update the next time it
opens an app (the service workers load network-first).

Run it with **release** blank to republish the live release with fresh
headlines; it never publishes unreleased app changes. The one exception is
`labs/` (test pages for you, not apps), which always comes from the latest
merged code.

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

## The log

`home/welcome.js`'s `RELEASES` is the log, by aOS version. aOS shows all of it
under **What's new in aOS**: each version's highlights (starred), its notes,
then what changed in each app. The update screens in the apps show only the
highlights.
