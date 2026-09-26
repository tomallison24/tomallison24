# Mail

Gmail triage as a home-screen web app: frosted glass over a slow aurora, one
tag button next to every message, a Marketing bucket that empties itself, tags
that sort mail by who sent it, a page for each message, and search.

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

The client ID is built into `index.html` (`BUILT_IN_CLIENT_ID`), so any
device goes straight to **Connect Gmail** with no setup. It is not a secret:
it appears in every sign-in URL, and Google only returns tokens to the
redirect URIs registered against it. The built-in ID wins over anything a
device has saved, so a bad copy pasted on one phone can't lock it out. Empty
it to go back to pasting a client ID per device.

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

## Tags

Tags sort mail by who sent it, and keep doing so. **Swipe an email to the
right** — a short swipe shows **Tag**, a long one opens it straight away — and
type a name, say *Sofia's school*:

- that email, everything **already** in the mailbox from the same domain
  (archived mail included), and **all new mail** from it gets the tag — the
  last by a Gmail filter, so it happens whether or not the app is open;
- tagged mail **stays in the inbox** (only Marketing skips it);
- a chip for the tag appears under the tabs; tap it to see just that tag, and
  **Inbox** to go back.

**Tag** is also on each email's own page. The same domain rules apply as for
Marketing: `news@mail.tmsa.org` tags all of `tmsa.org`, while a Gmail or
Outlook sender is tagged by exact address only. The orange button on each row
is **Marketing** (a megaphone), not tagging.

### The Tags tab

Tags are ordinary Gmail labels, so they show up in Gmail too. The **Tags** tab
sorts every label in the mailbox into three groups:

- **Your tags** — those with a rule, or that you switched on. Only these are
  chips. Each lists its rules and lets you hide its chip or delete it.
- **Other labels in Gmail** — your own labels that aren't used as tags. Switch
  a chip on to filter by one.
- **Left by other apps** — folders old mail apps made: `[Imap]/…`,
  `[Mailbox]/…` (Dropbox's Mailbox app), `Deleted Messages` and the like.
  Hidden from the app; **Delete all unused** removes them in one go, after
  asking. `Notes` (iPhone Notes keeps notes there) and `Unroll.me/…` are
  **kept**, as something still reads them.

Deleting a label takes it off the emails that have it and stops its rules; the
emails themselves stay. It can't be undone, which is why the app asks first.

There's also a **New tag** form for when you know the domain but have no email
to hand (`tmsa.org` → *Sofia's school*).

## Tapping a message

Opens it as a page of its own, sliding in over the list; the back chevron or
the iPhone's back swipe returns to exactly where you were. Opening a message
marks it read in Gmail, the same as Gmail does.

HTML mail is shown as designed, in a sandboxed frame that **can't run
anything and can't load anything**: images, and the tracking pixels among
them, stay off until you tap **Show** — at which point the sender can tell you
opened it, and the note says so. Wide newsletters are scaled to fit the screen,
the way Mail does. Plain-text mail is shown as text with its links tappable.

**Tag**, **Marketing** (or **Inbox**, for mail already in the bucket) and
**Open in Gmail** are on the page.

## Selecting and deleting

Like Mail: tap **Select** (or press and hold any message), tick what you want,
then **Trash** or **Mark as Read / Unread** from the bar at the bottom.
**Select All** takes the whole list as loaded. Works in the inbox, a tag,
Marketing and search results.

Trash is Gmail's Trash — 30 days to change your mind — and the toast has an
**Undo** that brings each message back, into the inbox if that's where it was.

## Search

The bar at the top searches all of your mail, not just the inbox, and takes
Gmail's own search syntax: `invoice`, `from:tmsa.org`, `has:attachment`,
`after:2026/09/01`, `is:unread` and so on. **Show more** at the bottom of any
list fetches the next page.

Filing a message never marks it read, and neither does the filter — mail lands
in the bucket unread and stays that way until you read it.

## Staying signed in

Google gives a browser-only app like this one an access token that lasts **an
hour**, and — with no server to hold a secret — no way to renew it quietly in
the background. So when the hour is up the app goes back through Google by
itself, asking it not to show anything (`prompt=none`) and naming your account
(`login_hint`) so there's no account chooser. If Google still knows you — it
usually does — it answers straight away with a fresh token. If it can't, the
app asks for one tap rather than showing an error, and never retries in a loop.

On an iPhone home-screen app you may see a browser sheet flash for a moment
during that hop; that's iOS showing the trip to Google. Staying signed in for
weeks with no hop at all needs a small server — for example a Cloudflare Worker
— holding the OAuth client secret and using refresh tokens. Google expires
those after 7 days while the consent screen is in *Testing*, so the consent
screen would need publishing too.

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
