# Mail

Gmail triage as a home-screen web app: frosted glass over a slow aurora, one
tag button next to every message, and a Marketing bucket that empties itself.

**One tap on the tag does three things:**

1. moves that conversation to the **Marketing** label and out of the inbox;
2. writes a **Gmail filter** so everything from the same domain does the same
   from now on — server-side, whether or not the app is open;
3. sweeps the mail **already in the mailbox** from that domain into Marketing.

Anything in Marketing older than **3 days** (Settings: 1–30) goes to the
Trash, where Gmail deletes it for good after 30 days. The sweep runs when the
app opens, and `.github/workflows/mail.yml` runs the same sweep daily so it
happens on days you never open it.

- **No build step, no server, no dependencies.** `index.html` is the whole
  app; `sw.js` keeps the shell working offline. Gmail is never cached — a
  cached mailbox would be stale *and* a copy of private mail in a cache.
- **Nothing leaves the phone.** The app talks straight to the Gmail API from
  Safari. There is no backend to hold a token.

## Put it on your iPhone

1. **Google Cloud, once** (about three minutes) — see *Setup* below.
2. Open `https://tomallison24.github.io/tomallison24/mail/` in Safari.
3. Share → **Add to Home Screen**.

## Setup

### 1. The app's OAuth client

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **OAuth consent screen** → External → add your own address as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
5. **Authorised JavaScript origins:** `https://tomallison24.github.io`
6. **Authorised redirect URIs:** `https://tomallison24.github.io/tomallison24/mail/`
   — exactly that, trailing slash included. The app's setup screen prints the
   two values for whatever address you actually opened it on; copy from there
   if you serve it somewhere else as well (each origin needs its own entry).
7. Open the app, paste the client ID, tap **Save and connect**.

Scopes asked for: `gmail.modify` (read, label, move, trash) and
`gmail.settings.basic` (the filters). If you untick the filter permission on
Google's consent screen the app still files mail, but each sender has to be
tapped once instead of a rule catching the rest — the Rules tab says so.

The client ID is not a secret, so it can be pasted into `BUILT_IN_CLIENT_ID`
at the top of `index.html` to skip the setup screen on new devices.

### 2. The scheduled cleanup (optional)

The app sweeps whenever it is opened, so this is only needed if you want the
bucket emptied on days you don't open it.

It needs a **second OAuth client** — a *Desktop app* one. The phone app uses
the implicit flow, which never issues a refresh token, and a scheduled job has
nobody to tap "allow".

1. **Credentials → Create credentials → OAuth client ID → Desktop app.**
2. On your own machine:
   ```sh
   node mail/scripts/get-refresh-token.mjs <client-id> <client-secret>
   ```
   Open the URL it prints, allow, and it prints a refresh token.
3. Repository **Settings → Secrets and variables → Actions**, add secrets
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
   Optional *variables*: `MARKETING_LABEL` (default `Marketing`),
   `DELETE_AFTER_DAYS` (default `3`).

Until those secrets exist the workflow runs, finds nothing and exits cleanly.

> **Publish the consent screen first.** While an external OAuth app's
> publishing status is **Testing**, Google expires its refresh tokens after
> **7 days**, and the scheduled sweep stops with `invalid_grant`. Setting the
> consent screen to **In production** avoids that. (Widely reported by
> developers and consistent with Google's OAuth documentation; I could not
> open `developers.google.com` from this environment to quote the page
> directly — see *What I could not verify* below.) An unverified app in
> production shows an "unverified app" warning on the consent screen that you
> click past; that is expected for a personal app used by its author. The
> phone app is unaffected either way — it gets a fresh hour-long token each
> time you connect.

## How a rule is chosen

| Sender | Rule written | Why |
|---|---|---|
| `news@e.asos.com` | `asos.com` | subdomains of the same brand are the same sender |
| `hello@marketing.deliveroo.co.uk` | `deliveroo.co.uk` | `co.uk` and friends are treated as one suffix |
| `mum@gmail.com` | `mum@gmail.com` | shared mailbox providers get the **address**, never the domain |

The third row matters: a rule on `gmail.com` would file everyone you know.
The app keeps a list of shared providers (Gmail, Outlook, Yahoo, iCloud,
Proton, and so on) and falls back to the exact address for those.

Gmail matches a filter's sender field loosely, which is what lets one rule on
`asos.com` catch `e.asos.com` and `email.asos.com` too. The same looseness
means a very short or generic domain could catch more than you meant — every
rule is listed under **Rules** with a delete button, and deleting one leaves
already-filed mail where it is.

## Undo

The toast after a tap has an **Undo** for a few seconds: it puts the
conversation back, returns anything the backfill took *out of the inbox* to
the inbox, removes the label from the rest, and deletes the rule it just
wrote. The arrow button in the Marketing tab moves a single conversation back
without touching the rule.

Nothing is ever erased outright. The sweep moves mail to the Trash, so there
is a 30-day window to change your mind in Gmail itself.

## Run locally

```sh
npx http-server . -p 8080    # then open http://localhost:8080/mail/
```

Add `http://localhost:8080` as an origin and `http://localhost:8080/mail/` as
a redirect URI on the OAuth client first; the app's setup screen prints both.

`node mail/scripts/make-icons.mjs` redraws the icons.

## What I could not verify

`developers.google.com` is blocked by this environment's network policy, so
the Gmail API details here were taken from Google's machine-readable
[API discovery document](https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest)
(revision 20260921) rather than the prose docs: the endpoints, request bodies
and the exact scope each method needs are confirmed there. Two things rest on
secondary sources and my own testing instead:

- the **7-day refresh token expiry** for consent screens in Testing;
- how **iOS home-screen apps handle the OAuth redirect**. The app uses a
  full-page redirect rather than Google's popup-based library precisely
  because popups can't hand a token back to a standalone home-screen app, but
  I have no iPhone here to prove the round trip. If connecting misbehaves on
  the phone, that is the first thing to look at.

Everything else — the filter that gets written, the backfill, the sweep, undo,
the shared-provider guard — was driven end to end in a headless browser
against a stubbed Gmail API.
