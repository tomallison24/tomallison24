# Mail

Gmail triage as a home-screen web app: frosted glass over a slow aurora, a
Marketing bucket that empties itself, tags that sort mail by who sent it,
Gmail's own categories, a page for each conversation, search, and the everyday
parts of iOS Mail: swipes, reply and forward with Undo Send, attachments,
Remind Me, and an unread count on the icon.

**Swipe an email right and tap Marketing** — that one tap does three things:

1. moves that conversation to the **Marketing** label and out of the inbox;
2. writes a **Gmail filter** so everything from the same domain does the same
   from now on — server-side, whether or not the app is open;
3. sweeps the mail **already in the mailbox** from that domain into Marketing.

**Marketing also fills itself:** as the app opens, Gmail's Promotions in the
inbox move there (see *Moving marketing out of the inbox* below).

Anything in Marketing older than **30 days** (Settings: 1–30) goes to the
Trash, where Gmail deletes it for good after 30 more days. It was 3 days
before marketing was sorted there automatically; phones that had the old
setting moved to 30 once. Mail with an auto-tag (Travel, Money, Health,
Orders) is never emptied out. The sweep runs when the
app opens (the Marketing list has a **Clean up now** button to run it at once); `.github/workflows/mail.yml` can run it daily too, so it happens on
days you never open the app — but only once its Google credentials are set up
(Setup, step 2). Until then the daily run just logs "No Google credentials set".

## Finding your way around

- **Tap the title** (**Inbox ⌄**) for the mailbox menu, as in Mail:
  **Inbox** and **Flagged**; Gmail's own categories (**Primary**,
  **Promotions**, **Updates** — the inbox as Gmail sorted it); your tags;
  **Marketing**; and **Manage Tags**. The one you're on is ticked, and the
  title changes to match. Tap outside it to close it.
- **Home** (the house, left of the magnifier) is on every page and goes
  straight back to the inbox as the app opens: All mail, no tag, no search,
  at the top. It hides while you're selecting, as search does.
- A **long title** (a long tag name, or Marketing on a smaller phone) steps
  down a size or two to fit beside the buttons before it's cut short.
- **Pull the list down** from the top: a short pull shows the search bar, a
  longer one also fetches the list afresh (the glass spinner turns blue when
  letting go will refresh). The magnifier opens search too.
- The header **stays at the top** as you scroll: the large title shrinks to a
  compact one on a rounded, see-through Liquid Glass bar, with the mailbox menu, Home, search, **Edit** and
  Settings still to hand. (Tapping the iPhone's status bar, at the very top,
  scrolls back up — iOS's own shortcut.)
- **Edit** selects messages, as in Mail.
- **Sheets** (tagging, Unsubscribe, a file, Tidy's preview, every question)
  are Liquid Glass, as in iOS 26: clear glass floating just inside the
  screen's edges with the mail blurred through it, glass buttons and fields,
  and the main action filled blue. A message and New Message stay full pages
  with the same glass (✕ to cancel, a blue ↑ to send), Settings has iOS 26's
  switches, and **All | Unread**, the tag picker and *Notify me about* have a
  glass thumb that slides to your choice. The small buttons in a card
  (**Show more**, *In menu* on the Tags page, a message's **Show** for images)
  are the same clear glass, and the toast is the sheets' glass, with a red rim
  for an error.
- **Cards** — each conversation in the list, a message's parts, files, the
  Settings and Tags panels and Tidy's lists — are very faint tiles: a whisper
  of white with a hairline edge, no shadow and no blur (`--tile`,
  `--tile-edge`), the same in every AllisonOS app.
- Rows show the sender, subject and preview, plus your own tags — no buttons
  and no domain chips; the actions live under the swipes.

- **No build step, no server, no dependencies.** `index.html` is the page
  and `app.js` everything it does; `sw.js` keeps the shell working offline. Gmail is never cached — a
  cached mailbox would be stale *and* a copy of private mail in a cache.
- **Nothing leaves the phone.** The app talks straight to the Gmail API from
  Safari. There is no backend to hold a token.

## Security

What stands between a hostile email and your mailbox:

- **Nothing in an email can run.** Messages show in a sandboxed frame with no
  scripts and no forms; scripts, forms, frames, plugins and `on…` handlers are
  stripped as well, and the frame's own policy loads nothing from the network
  until you tap **Show** (so tracking pixels stay dark). Links open in a new
  tab with no referrer and no way back into the app, and only web, email and
  phone links survive: `javascript:`, `data:` and the like lose their link.
- **Only the app's own code runs on the page.** `index.html` carries a Content
  Security Policy: scripts come from `app.js` and nowhere else — nothing
  inline, nothing from another site. So even text that slipped through
  unescaped couldn't act as the app or read the sign-in. A file opened from
  the app inherits the same policy.
- **Attachments can't pose as the app.** Only pictures and PDFs have
  **Open**; anything else is held as plain bytes and handed to the share sheet
  (see *Attachments*).
- **Sign-in is short-lived.** Google's token lasts an hour and there is no
  refresh token on the phone. Each sign-in carries a random `state` value
  that must come back unchanged, and the token is wiped from the address bar
  at once.
- **It won't run inside another page.** A hostile site could otherwise lay
  the app invisibly under its own buttons and steer taps onto Trash or Block
  (clickjacking). Framed, it shows one line of text and does nothing.
- **Sign Out means signed out.** It asks Google to cancel the token at once
  (rather than leaving it to run out within the hour), and the phone forgets
  the account, any unsent message and the unsubscribe list. The app no longer
  signs itself back in the next time it's opened — before, it did, silently.
  Expect Google to ask for permission again the next time you connect.
- **Nothing about your mail is stored.** The offline cache holds only the
  app's own files; mail is kept in memory for the visit.
- **Unsubscribing can't be turned against you.** It is only offered when
  Gmail confirmed the sender (DMARC or DKIM), and the one-click request goes
  without cookies or referrer.

The policy allows images from any `https:`/`http:` address (emails' images
after **Show**) and requests to any `https:` address (one-click unsubscribe
posts to the sender's own server). Narrowing those wouldn't add much: with
scripts locked to `app.js`, nothing untrusted can make requests in the first
place.

The frame guard is done in script because the proper tool, a
`frame-ancestors` response header, is something GitHub Pages can't send.
Cloudflare Pages can, through a `_headers` file.

The GitHub workflows pin every action to an exact commit, and `wrangler` to an
exact release, since those jobs can read the repository's secrets (the Gmail
refresh token, the Cloudflare token) and a version tag can be moved to new
code.

`node mail/scripts/security-test.mjs` drives all of this in
headless Chromium against a stubbed Gmail: an HTML attachment that read the
token before the fix can't after it; hostile links are stripped; a framed copy
does nothing; Sign Out cancels the token and stays signed out; and the list,
reading, **Show**, attachments, unsubscribe, search, settings and sending were
all checked for anything the policy blocks. Safari on an iPhone was not tested (see *What I
could not verify*).

## Light and dark

The app follows the iPhone's own appearance — Settings → Display &
Brightness — and switches the moment iOS does, including at sunset on
*Automatic*, with no reload. Every colour is a token with a light and a dark
value; text meets WCAG contrast on its real background in both (checked by
the tests, not by eye). Emails themselves always render on white, as their
senders designed them.

The status bar is set to iOS's `default` style rather than
`black-translucent`: that one always draws the clock in white, which would
vanish on the light theme. The bar takes its colour from `theme-color`, set
per theme. If the change doesn't show, remove the app from the home screen
and add it again — iOS reads the status bar style when the app is added.

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
   `DELETE_AFTER_DAYS` (default `30`). If you set that variable to 3 before, change it
   to 30 there too: the variable wins over the default.

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

### 3. Notifications (optional)

New mail on the lock screen, even with the app closed — see
**Notifications** below for what it does. It needs the same Desktop client as
step 2, a free Cloudflare account, and about 20 minutes on a computer.

1. **Google.** Do step 2's first part (consent screen *In production*, a
   Desktop client). Then, in a copy of this repository on your computer:
   ```sh
   node mail/scripts/get-refresh-token.mjs <client-id> <client-secret> --metadata
   node mail/push/make-vapid-keys.mjs
   ```
   The first prints `PUSH_GOOGLE_REFRESH_TOKEN` — a second token that can only
   read headers (senders, subjects, labels), never an email's text. The second
   prints `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, the server's own key pair.
2. **Cloudflare** (dash.cloudflare.com, free plan):
   - **Storage & Databases → KV → Create** a namespace, e.g. `mail-push`, and
     copy its **ID**;
   - **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"**
     template, and copy the token;
   - your **Account ID** (on the Workers & Pages overview).
3. **GitHub → Settings → Secrets and variables → Actions:**
   - *Secrets:* `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
     `PUSH_GOOGLE_REFRESH_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
     (plus `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from step 2);
   - *Variables:* `PUSH_KV_ID` (the KV namespace ID) and
     `PUSH_ALLOWED_EMAIL` (your Gmail address — the only account the server
     will serve).
4. **Actions → Mail push → Run workflow.** The log shows the server's address,
   `https://mail-push.<your-subdomain>.workers.dev`.
5. **On the iPhone,** in Mail opened from the Home Screen: **Settings → New-mail
   notifications**, paste the address, **Save**, pick what to hear about, and
   **Allow**. **Send a test** checks the whole chain.

`node mail/scripts/push-test.mjs` tests the server without any of the above.

## Notifications

A small server (`mail/push`, a Cloudflare Worker) checks your inbox **every
minute** and sends a notification to your phone when mail arrives: the sender
as the title, the subject underneath. Tapping it opens that conversation.
Several at once arrive as one ("3 new emails") rather than a burst. The icon's
unread count comes along with it.

**What you hear about** (Settings): everything except Marketing and Gmail's
Promotions; **Primary only**; or **only mail with one of your tags** (say,
School). Mail you've already read elsewhere, spam and your own sent mail never
notify.

**Privacy.** Until now nothing left your phone; this is the one exception, and
it is kept small:
- the server's Google token has the **gmail.metadata** scope — senders,
  subjects and labels, never what an email says;
- it stores no mail: only your phone's subscription, where it got to in the
  inbox's history, and a short-lived token;
- each notification is **encrypted for your phone** (Web Push, RFC 8291), so
  Apple's push service passes on only ciphertext;
- it only accepts a phone that proves it is signed in as `PUSH_ALLOWED_EMAIL`
  (by showing a Google token Gmail says is yours), and only real push services
  as destinations.

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
right** — a short swipe shows **Tag** (next to Marketing), a long one opens it
straight away — and type a name, say *Sofia's school*:

- that email, everything **already** in the mailbox from the same domain
  (archived mail included), and **all new mail** from it gets the tag — the
  last by a Gmail filter, so it happens whether or not the app is open;
- tagged mail **stays in the inbox** (only Marketing skips it);
- the tag joins the mailbox menu under the title; choose it to see just that
  tag, and **Inbox** to go back.
- **every tag has its own colour**, the same in the menu, the list, the Tags
  page and the tag sheet. Travel is blue, Money green, Health pink and Orders
  purple; Marketing keeps orange. Your other tags each take a free, well-spaced
  colour picked from the name (tags are handled in name order, so every device
  agrees). The first ten stay at least 25° apart on the colour wheel; past
  that, colours get closer but are still never shared. Adding a tag can shift
  the colour of a later-named tag that was sharing a spot.

Tagging answers as soon as that email and the rule are done; the older mail
is tagged in the background, and the toast says how many once it's finished
(with **Undo**). Every request to Gmail has a time limit, so a reply lost to a
patchy phone connection ends in a retry or a clear message — never a spinner
that sits there for good.

Some senders write through a platform rather than their own domain. TMSA's
mail comes from ParentSquare (`donotreply+…@parentsquare.com`), so its rule is
on `parentsquare.com`. That's right while TMSA is the only one using
ParentSquare to reach you; if another school or club starts, their mail will
get the tag too.

**Tag** is also on each email's own page. The same domain rules apply as for
Marketing: `news@mail.tmsa.org` tags all of `tmsa.org`, while a Gmail or
Outlook sender is tagged by exact address only. The orange button on each row
is **Marketing** (a megaphone), not tagging.

### The Tags page

Tags are ordinary Gmail labels, so they show up in Gmail too. The **Tags** page
(**Manage Tags** in the menu) sorts every label in the mailbox into three groups:

- **Your tags** — those with a rule, or that you switched on. Only these are
  in the mailbox menu. Each lists its rules and lets you take it out of the
  menu or delete it.
- **Other labels in Gmail** — your own labels that aren't used as tags. Switch
  one into the menu to filter by it.
- **Left by other apps** — folders old mail apps made: `[Imap]/…`,
  `[Mailbox]/…` (Dropbox's Mailbox app), `Deleted Messages` and the like.
  Hidden from the app; **Delete all unused** removes them in one go, after
  asking. `Notes` (iPhone Notes keeps notes there) and `Unroll.me/…` are
  **kept**, as something still reads them.

Deleting a label takes it off the emails that have it and stops its rules; the
emails themselves stay. It can't be undone, which is why the app asks first.

There's also a **New tag** form for when you know the domain but have no email
to hand (`tmsa.org` → *Sofia's school*).

### Auto-tags

At the top of the Tags page are four ready-made tags, each with an **On/Off**
switch and a **Preview**:

- **Travel**: flight bookings, check-ins, gate, delay and cancellation notices,
  hotel stays, car rentals, Uber and Lyft rides, Hopper, CBP/TSA.
- **Money**: everything from banks, card issuers, lenders and brokers (their
  offers too, so they stay in the inbox rather than going to Marketing), bills
  from the town, utilities and insurers, trade confirmations and Monarch's
  expense alerts.
- **Health**: MyChart messages, visit summaries, lab results, prescriptions,
  MinuteClinic visits, insurance statements and Explanations of Benefits.
- **Orders**: order confirmations, shipping and delivery notices, pickups and
  receipts.

Each one is a **Gmail filter** with a Gmail search behind it: the senders that
send that kind of mail, narrowed by subject where a sender also sends offers
(a Lyft ride receipt is Travel; "20% off your next ride" isn't). Gmail applies
it the moment mail arrives, **even with the app closed**, so another app can
rely on the label. The label is named exactly `Travel`, `Money`, `Health` or
`Orders`. The Travel app reads `label:Travel` alongside its own search, which
is how it gets Uber and Lyft rides.

- **Preview** (while off) runs the search, so you see what it would tag, and
  changes nothing. **Show** (while on) opens the tag.
- **On** creates the label and the filter, then tags the mail already there
  (up to the newest 2,000 matches). Any of it that Tidy had archived goes back
  to the inbox. The toast says how many were tagged and how many came back,
  with **Undo**.
- **Off** removes the filter. Mail already tagged keeps its tag.
- Tagged mail **stays in the inbox**, **Tidy never touches it** (Tidy skips
  anything tagged), and the Marketing clean-up won't delete it.
- When an update **refines a rule** (say, leaving out airline miles promos),
  the app swaps the filter Gmail has for the new one the next time it opens,
  so there's no need to turn a tag off and on. Mail already tagged keeps its
  tag.

The rules were checked against this mailbox's real mail before shipping. Each
one catches what it should, and the offers and newsletters it once caught are
now excluded. A sender it doesn't know yet (a new airline, a new
bank) won't be tagged; tag them by hand, or tell me and I'll add them.

## Tapping a message

Each row is a **conversation**, as in Mail (the number shows how many
messages). Tapping one opens it as a page of its own, sliding in over the list;
the back chevron or the iPhone's back swipe returns to exactly where you were.
The newest message and any unread ones are open; tap a folded one to open it.
Opening a conversation marks it read in Gmail, the same as Gmail does.

HTML mail is shown as designed, in a sandboxed frame that **can't run
anything and can't load anything**: images, and the tracking pixels among
them, stay off until you tap **Show** — at which point the sender can tell you
opened it, and the note says so. Wide newsletters are scaled to fit the screen,
the way Mail does. Plain-text mail is shown as text with its links tappable.

**Tag**, **Marketing** (or **Inbox**, for mail already in the bucket) and
**Open in Gmail** are at the top; the bar at the bottom has **Trash**,
**Archive**, **Flag**, **Reply** and **New Message**.

## Swiping

- **Right** — a short swipe shows **Tag** and **Marketing** (in the Marketing
  list: **Inbox**, to move it back); swipe all the way to tag at once.
- **Left** — a short swipe shows **Flag**, **Archive** and **Trash**; swipe all
  the way to trash it. Every one has **Undo**, which puts back only the
  messages that were in the inbox — your own replies in the conversation stay
  in Sent.

Flagged is Gmail's star, so it matches Gmail on the web. The **Flagged** filter
lists them.

## Remind Me

The **…** on a message page → **Remind Me** → **Tomorrow**, **This Weekend**
(Saturday) or **Next Week** (Monday). The conversation leaves the inbox and, on
the day, comes back **unread at the top** of it with a **Reminder** chip, until
you open it.

Gmail's API has no snooze, so a reminder is a label named for its day
(`Remind 2026-09-28`), and the app brings due ones back **when it opens** (or
on a pull to refresh). The daily GitHub job does the same once it has its
credentials; without them, a reminder waits until you next open the app. The
labels are the app's own bookkeeping and never show up as tags.

## Tidy

**Settings → Inbox clean-up → Tidy old unread mail** has an **On/Off** switch. Turning it on starts the first run straight away, in the background. Unread mail that has sat in the inbox
for **60 days** is archived under a **Tidied** label, but only when both of
these are true:

- **It looks automated.** It is a mailing list (it carries `List-Unsubscribe`,
  `List-Id` or `Precedence: bulk`), or Gmail filed it under Promotions,
  Updates, Social or Forums, or it comes from a no-reply-style address.
- **It comes from a stranger.** You have never written to that address. For a
  business, "that address" means its whole domain, so writing to one person at
  a school counts for all of its staff. Personal addresses (Gmail, iCloud,
  Outlook and so on) are matched one by one.

**Automated mail that is yours always stays.** That covers alerts, receipts,
statements, bills and payments, orders and deliveries, bookings, sign-in codes
and security notices, account and policy changes, and health messages. These
are recognised from the subject ("receipt", "statement", "sign-in", "health"
and so on) or the sender (`alerts@`, `billing@`, `mychart@`, a `care.` or
`ealerts.` domain, and anything from a `.gov` or `.edu` address). Gmail's
Purchases and Reservations mail is left out too. When in doubt, it is kept: a
promotion that happens to mention an "order" stays in the inbox.

**Banks always stay.** Everything from a bank, card issuer, lender or broker is
kept, their offers included. That covers Chase, Citi, American Express, Bank of
America, Pennymac, NatWest, Robinhood (Snacks too), GreenSky, Synchrony and a
few dozen more, plus any sender whose domain names a bank, credit union,
mortgage or lender.

**Always keep a sender.** Tap **Keep** beside a sender in the Preview, choose
**… → Never Tidy This Sender** on an email, or tap **Always Keep** in the toast
after putting a tidied email back with **Inbox**. The list is under Settings →
**Always kept**, where **Remove** undoes it. It is kept on this device.

It never touches Flagged, Important or tagged mail (tags, reminders,
Marketing), anything newer than 60 days, or any conversation you have replied
in.

**Preview Tidy** shows what would go, grouped by sender with the reason, and what is
kept and why. Nothing changes until you tap **Tidy now**, or **Tidy now, and
every day**. When it is on, it runs once a day as the app opens.

Tidied mail is **archived, not deleted**. It stays unread and searchable,
**Undo** puts back a whole run, **See tidied mail** lists it, and an opened
tidied email has an **Inbox** button. Whether you have written to someone is
looked up with a one-result search of your Sent mail, and is only remembered
until the app closes.

## Moving marketing out of the inbox

**Settings → Inbox clean-up → Move marketing out of the inbox** (on). As the app opens, and
when it comes back after 15 minutes or more, Gmail's **Promotions** in the
inbox move to **Marketing**: the whole inbox the first time, then only what
arrived since. It goes a few emails a second in the background, so a big
first run can take a few minutes with the app open; it picks up where it
stopped next time. The toast says how many moved, with **Undo**.

What stays in the inbox follows Tidy's rules:

- a conversation you wrote in, or a sender you've written to (for a business,
  anyone at its domain);
- **banks, card issuers, lenders and brokers** — their offers too. The
  **Money** auto-tag now covers everything they send, so bank promos stay in
  the inbox tagged Money;
- alerts, receipts, statements, orders, bookings, sign-in codes, health
  messages and anything from a `.gov` or `.edu` address;
- **tagged** mail (the auto-tags and your own tags) and **Flagged** mail;
- senders under Settings → **Always kept**.

Gmail's **Important** flag is ignored: it marks plenty of promotions.

Moved mail is in **Marketing**, emptied after 30 days (above). That counts
from each email's own date, so the older marketing moved on the first run goes
on to the Trash at the next clean-up, where Gmail keeps it 30 days before
deleting it: everything moved stays recoverable for at least a month. Open one and tap
**Inbox** to bring it back: it stays in the inbox from then on, and the toast
offers **Always Keep** for that sender. Undo does the same for a whole run.

Only Gmail's Promotions category is looked at, plus a short list of senders
whose "alerts" are really advertising, which are sorted as marketing wherever
Gmail files them and aren't kept for having "Alert" in the subject. For now
that is Cars.com's saved-search mail (`emalert.cars.com`: "Inventory Alert",
"Price drop!"); `MKT_ALWAYS` in `app.js` is the list. Other newsletters Gmail
files under Updates stay where they are (Tidy deals with old unread ones).

**How it fits with Tidy.** The two sit side by side in Settings under **Inbox
clean-up**, with one note on what always stays. The sort handles Promotions of
any age, read or unread, and Marketing is emptied after 30 days. Tidy handles
what the sort doesn't: old (60 days) unread automated mail from other
categories, which it **archives under Tidied and never deletes**. Anything the
sort has already moved is out of the inbox, so Tidy never sees it. This runs in
the app, not as a Gmail filter: a filter can't check whom you've written to or
your Always kept list. So new marketing waits in the inbox until the app next
opens, which moves it within seconds.

All the background jobs (this, Tidy, the clean-up) share one pace, so running
together they stay as gentle on Gmail's limit as one alone.

**What you tap comes first.** The automatic jobs wait while you are tapping
and carry on a couple of seconds after you stop. If Gmail asks a background
job to slow down, only the background jobs pause: tagging, archiving and the
rest still go through. If Gmail refuses something you did, the message shows
above everything (at the top of the screen while a sheet is open) and in the
Tag sheet itself, which stays open so you can try again.

## The unread count on the icon

**Settings → Unread count on the app icon**. The count is Gmail's own —
unread conversations in the inbox — and updates as you read. iOS 16.4+ allows
this for a web app on the Home Screen; the app asks to allow notifications
first, because I understand iOS won't show a web app's badge without that.
Nothing is ever sent as a notification.

## Writing

**Reply** on a conversation's page offers **Reply**, **Reply All** and
**Forward**; the pencil (bottom right of the list, or in the bar) starts a new
message.

- Replies join the conversation in Gmail, quote the message, go to its
  Reply-To if it has one, and leave you off Reply All.
- **Send** waits 5 seconds with **Undo**. Meanwhile the message is kept on the
  phone: if the app is closed before it goes, it comes back unsent with a note
  rather than being lost or sent behind your back.
- A send is **never retried**. If Gmail doesn't answer, the message may already
  have gone, so the app says so and asks you to check Sent instead of risking
  a duplicate.
- **Cancel** after typing asks **Save Draft** (into Gmail's Drafts) or
  **Delete Draft**.

## Attachments

Files show under the message they came with: name, type and size. Tap one to
download it, then **Share or Save…** (the iOS share sheet: Save to Files,
Photos, AirDrop…) or **Open**. Pictures get a preview. Nothing is downloaded
until you tap.

**Open** is there for pictures and PDFs only. A file opened from the app counts
as part of the app's own site, so an HTML or SVG attachment opened that way
could run the sender's code as the app and read your Gmail sign-in. Everything
else — Word, Excel, web pages — goes through **Share or Save…** (Save to Files
opens it from there). The type a file claims is the sender's word, so the app
checks it against that short list rather than trusting it.

**Add Attachment** in a new message picks files from the phone; **Forward**
keeps the original's files (tap × to drop one). Attachments can total
**25 MB**. A file added from the phone survives Undo Send but not the app
closing; if that happens it's marked **add it again**.

## Blocking and unsubscribing

**Block** — the **…** on a message page → **Block Sender**. It writes a Gmail
filter (*from that address → Trash*), so their new mail never reaches the
inbox, whether or not the app is open, and moves their mail already here to
the Trash. **Undo** puts it all back; **Settings → Blocked senders** lists who
is blocked, with **Unblock**. Nothing is sent to the sender. (Gmail's own
Block sends mail to Spam instead; either way Gmail deletes it after 30 days.)

**Unsubscribe** — mail from a mailing list shows *This message is from a
mailing list · Unsubscribe*, as in Mail. The app uses whatever the sender
offers in its `List-Unsubscribe` header, best first:

1. **One-click** (`List-Unsubscribe-Post`): the app sends the sender's server
   the standard one-click request straight from the phone, without cookies or
   a referrer. The sender's server isn't this app's, so the browser can't
   read its answer: "sent" is as sure as it gets, which is also true of Gmail.
2. **Email**: an unsubscribe email from your Gmail to the address they give;
   it shows in Sent.
3. **A web page**: opens in Safari and you finish there.

It only offers this when **Gmail vouched for the sender**: DMARC or DKIM
passed for the From domain in Gmail's own `Authentication-Results` header.
Otherwise it says so and offers **Block** instead, because unsubscribing from a
spammer only tells them your address works. The banner then remembers you
unsubscribed and offers **Block** if their mail keeps coming.

## Selecting and deleting

Like Mail: tap **Edit** (or press and hold any message), tick what you want,
then **Trash**, **Archive** or **Mark as Read / Unread** from the bar at the
bottom. To take a run of messages at once, **drag down the circles**: every row
your finger passes is selected (start on one that's already ticked and the
drag clears them instead), and holding near the top or bottom of the screen
scrolls the list on.
**Select All** takes the whole list as loaded. Works in the inbox, a tag,
Marketing and search results.

Trash is Gmail's Trash — 30 days to change your mind — and the toast has an
**Undo** that brings each message back, into the inbox if that's where it was.

## Search

Search (pull down, or the magnifier) looks through all of your mail, not just the inbox, and takes
Gmail's own search syntax: `invoice`, `from:tmsa.org`, `has:attachment`,
`after:2026/09/01`, `is:unread` and so on. **Show more** at the bottom of any
list fetches the next page.

Filing a message never marks it read, and neither does the filter — mail lands
in the bucket unread and stays that way until you read it.

## Gmail's rate limit

Gmail lets each person's apps spend a set number of "quota units" a minute;
past that it refuses with *Quota exceeded … Units per minute per user* until
the minute rolls over. So the app:

- **fetches a conversation only when it has changed.** Gmail's list says which
  ones have (their `historyId`); the rest are reused from memory for this visit
  (never saved on the phone). A refresh with nothing new is one list call
  instead of forty-one;
- **doesn't reload on every return to the app** — only if the list is more
  than 30 seconds old;
- **when Gmail says slow down,** it retries once, then pauses for a minute
  with the list left on screen, sends nothing in the meantime, and reloads by
  itself afterwards.
- **paces its background work.** Tidy and the Marketing clean-up send at most
  about six requests a second (roughly 60 quota units), however much there is
  to look through. A first Tidy Preview of about 200 old conversations costs
  about 2,400 units, which used to go out in a few seconds (about 240 units a
  second, measured against a fake Gmail with a phone-like 120 ms round trip).
  That was the likely cause of a "slow down" soon after Tidy arrived. It now
  takes about 45 seconds, with progress shown, and you can close it and keep
  using the app; closing it stops it. If Gmail still asks for a pause, Tidy
  waits it out and carries on. The daily Tidy starts 20 seconds after the app
  opens, not on top of opening's own requests.

Tidy also **doesn't repeat work.** It looks at the **oldest** conversations
first, up to 400 per Preview and 100 per daily run. Conversations it has
already kept are remembered on the device, by their ids and Gmail's change
marker only, never their content, and skipped next time unless something in
them changed. A first pass through a big backlog may take a few Previews or
days. After that, each run only checks newly old mail. If Gmail asks for a
pause, the Preview shows a countdown and then carries on more slowly.

Gmail's published per-user limit, and what each call costs, couldn't be
checked from here: Google's page is blocked, and secondary sources disagree.
They give 15,000 or 6,000 units a minute, and 10 or 40 units to fetch a
conversation. The pace above stays well under the lowest of these.

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

`node mail/scripts/make-icons.mjs` redraws the icons ("Sunrise": a white
envelope on a peach-to-purple gradient). iOS keeps the icon it saved when the
app was added, so after an icon change remove the app from the Home Screen and
add it again from Safari.

## What I could not verify

`developers.google.com` is blocked by this environment's network policy, so
the Gmail API details here were taken from Google's machine-readable
[API discovery document](https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest)
(revision 20260921) rather than the prose docs: the endpoints, request bodies
and the exact scope each method needs are confirmed there. Two things rest on
secondary sources and my own testing instead:

- the **7-day refresh token expiry** for consent screens in Testing;
- the **25 MB attachment limit**, which is Gmail's published limit (the API's
  own upload cap, from the discovery document, is 35 MB for the whole encoded
  message, which 25 MB of files fits inside);
- that Gmail accepts a filter whose action is **adding `TRASH`** (Block).
  The discovery document doesn't list which labels a filter may add; the
  tests confirm the app sends exactly `{"addLabelIds":["TRASH"]}` and handles a
  refusal by saying so. If Gmail refuses it, Block reports the error and the
  mail already here is left alone;
- the **one-click unsubscribe standard (RFC 8058)** and Gmail's bulk-sender
  rules. rfc-editor.org and Google's help pages are blocked here, so the
  request format comes from secondary descriptions rather than the RFC
  itself. The `Authentication-Results` format *was* checked against a real
  message in the connected mailbox;
- whether iOS needs **notification permission** before it shows the app-icon
  badge. MDN's compatibility data (browser-compat-data 8.1.3) confirms the
  badge itself on iOS 16.4+ Home Screen apps, but not the permission rule;
  the app asks for permission either way;
- the **grow-from-row** animation on an iPhone. It uses View Transitions,
  which the same data lists for iOS 18+; older iOS gets the plain slide;
- **Notifications on a real iPhone.** The server's encryption is checked
  against an independent implementation (and the published `http_ece`
  library), and the app ↔ server exchange is tested end to end — but not
  through Apple's push service, which isn't reachable from here. MDN's
  compatibility data lists the notification *tap* event as unsupported on
  iOS; if tapping only opens the inbox, that is why (the new mail is at the
  top). Cloudflare's free-plan limits are from memory (developers.cloudflare.com
  is blocked here); the server is built to stay far inside them — it writes to
  storage only when mail arrives;
- that a **Gmail filter matches exactly as Gmail search does**. The API's
  discovery document says a filter's `query` "supports the same query format
  as the Gmail search box", and every auto-tag rule was run as a search on the
  real mailbox; that new mail is tagged the same way is Gmail's promise, not
  something I could watch happen here. Gmail's limit on a filter's length
  isn't in the discovery document; the longest rule is about 900 characters;
- **Gmail's quota numbers.** From Google's usage-limits page as I remember it
  (not re-checked, as developers.google.com is blocked here): 15,000 units per
  user per minute, and 10 units for each conversation fetched — so the old
  forty-conversation reload cost about 410 units;
- how **Share or Save…** and **Open** behave for files in a home-screen app.
  The share sheet is the route iOS supports for handing a file on; **Open**
  opens the file in a new view, which I could not try on an iPhone;
- the **Content Security Policy on Safari**. WebKit supports these
  directives, but I could only run Chromium here — including the part where a
  file opened from the app inherits the policy. The attachment fix doesn't
  rely on that: HTML and SVG files never get **Open** in the first place;
- **Google's token-cancelling endpoint** (`oauth2.googleapis.com/revoke`)
  as called from a browser, and whether cancelling one token also withdraws
  the app's permission (so Google asks again on the next connect). Google's
  developer pages are blocked here. The request is sent without waiting for
  an answer, so if Google ignored it Sign Out would still work — the token
  would just live out its hour;
- how **iOS home-screen apps handle the OAuth redirect**. The app uses a
  full-page redirect rather than Google's popup-based library precisely
  because popups can't hand a token back to a standalone home-screen app, but
  I have no iPhone here to prove the round trip. If connecting misbehaves on
  the phone, that is the first thing to look at.

Everything else — the filter that gets written, the backfill, the sweep, undo,
the shared-provider guard — was driven end to end in a headless browser
against a stubbed Gmail API.
