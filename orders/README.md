# Orders

Everything you've bought and where it is, as a home-screen web app in the same
frosted glass as Mail, Notes and Travel. It fills itself from the order,
shipping, delivery and store-pickup emails in Gmail, shows the courier and the
tracking number, and opens the carrier's own tracking page with one tap.

- **On the way** lists what hasn't arrived: **Arriving today** (out for
  delivery), **Ready for pickup**, **On the way** (shipped) and **Ordered**
  (no shipping email yet). Each order is a card with the store, the item, the
  total, where it is (a four-step bar, three for a pickup), the courier and the
  tracking number.
- **Delivered** keeps what has arrived or been picked up, newest first, by
  week and month.
- **To check** appears when something needs a look (below).
- **An order** opens on its own page: a headline (*Arrives Oct 14 to 16*,
  *Out for delivery today*, *Pick up by Sat, Oct 17*), the steps with their
  dates, the courier, the tracking number (with **Copy**), the order number,
  the items and the total, and a **Track on UPS** (or USPS, FedEx, DHL…)
  button. Links to the email (in Mail, or Gmail on the web), **Edit details**,
  **Mark as delivered** (or **picked up**) and **Delete**.
- **Search** (the magnifier) finds a store, an item, an order number or a
  tracking number across everything.
- **Add by hand** (the + button) takes a store, items, total, dates, courier,
  tracking number and status. The clipboard button reads a **pasted email**
  (from any inbox, e.g. one forwarded by someone else) the same way Gmail's
  are read.
- **Two phones**: a shared Google Sheet, set up like Notes' and Travel's (below).

**Orders Vintage** is the same app in a mid-century modern look, as its own app
with its own orders and settings ([`ordersvintage/`](../ordersvintage/README.md)).
It needs its own redirect address in Google Cloud (below), and can share this
app's Google Sheet.

## What counts as an order

Mail's **Orders** tag also catches things that aren't packages, so Settings
has a switch for each kind:

| Kind | Default | What it is |
|---|---|---|
| Packages | always on | anything that ships to you |
| Store pickups | on | order ahead, collect in store ("ready for pickup", curbside) |
| Food orders | off | delivery apps, restaurants, coffee shops |
| Subscriptions and app receipts | off | App Store, monthly renewals |
| Tickets and other receipts | off | events, library, parking |

Mail read while a kind was off is remembered, not lost: turning it on reads
just those emails (no need to read the whole year again).

## How the emails are read

Orders reads Gmail **on the phone, read-only** (`gmail.readonly`: it can't
send, change or delete anything). The first time, it looks back a year; after
that, every time it opens (at most every 30 minutes) for anything new. It
opens emails that

- carry Gmail's **Orders** label (Mail → Tags → Auto-tags → Orders; Gmail puts
  it on order mail as it arrives, even with the app closed), **even in
  Promotions**, or
- aren't promotions and have a subject like *order*, *shipped*, *delivered*,
  *tracking*, *pickup*, *receipt*, or come from the carriers (UPS, FedEx, USPS,
  DHL…) and the big stores.

Mail with Gmail's **Travel** label is left to Travel. Each email is read once;
**Read the last year again** in Settings starts over, replacing everything read
from email except orders you edited, checked or deleted. A first read of a big
mailbox goes in batches of 500, newest first, one after another.

Two ways of reading, best first:

1. **The data in the email.** Some stores hide a small block of structured data
   (schema.org `Order`, `ParcelDelivery`) in their emails; it's what Gmail
   itself uses for its package cards. When it's there, Orders uses it.
2. **The words.** Otherwise Orders reads the text: where the order is, the
   order number, the total, the items, the courier and the tracking number, the
   estimated delivery date and the pickup deadline. Common layouts work well
   (below); anything unusual is marked **Check details**.

What it picks out:

- **Where it is.** From the subject first, then the top of the email: ordered,
  shipped, out for delivery, delivered, ready for pickup, picked up, canceled.
  *Part of your order has been delivered* isn't delivered yet.
- **The courier and the tracking number**, from a *Carrier* / *Provider* /
  *Tracking number* label, a sentence (*FedEx tracking number …*), the number's
  own shape (UPS `1Z…`, USPS 20 and 22 digits, Amazon `TBA…`), or a link
  (`tracknum=`, `qtc_tLabels1=`, `trknbr=`). A store's own tracking ID (Home
  Depot's) is kept too, with no carrier button.
- **Items.** From structured data, a WooCommerce table, or the line above
  *Qty:* / *Price:* / *SKU #* / *Model #*; failing that, the subject
  (*Shipped: Name…*). Names the store cut short (*Name…*) stay cut.
- **Dates.** The delivery estimate or window (*Fri, Oct 16 – Tue, Oct 20*),
  the day it was delivered, the order date, and how long a pickup is held
  (*until Saturday* is worked out from the day the email came).

**Whole Foods** orders arrive from Amazon's address; they are told apart by the
store's name in the email and shown as **Whole Foods Market**, as their own
order (a pickup, with the booked day as the expected date). Amazon Fresh and
other Amazon-run stores were not seen in a real email and are shown as Amazon.

## How the emails fit together

One order usually sends several emails: confirmation, shipping, out for
delivery, delivered, and a notice from UPS itself. They end up as one order,
whatever order they are read in, matched on the order number, then on the
tracking number. A carrier's notice that names only the shipper (*From: SKIN
TECH*) joins that shipper's newest order that has no tracking number yet; if
there is none it becomes a package of its own.

- **A status never goes backwards**: a late *shipped* email doesn't undo
  *delivered*. A *canceled* email cancels.
- **Steps keep their dates**: *Ordered Oct 6 · Shipped Oct 7 · Delivered Oct 9*.
- **A pickup that began as a plain confirmation** becomes a pickup when the
  *ready for pickup* email arrives.
- **What you typed wins.** Each field you edit is locked: emails still add what
  you left alone (a tracking number, say), but never overwrite what you set.
- **Deleted means deleted.** An order you delete doesn't come back when the
  email is read again, on this phone or the other.
- **Check details.** An order is marked when the store says something is
  unavailable or delayed, when it has no store name, or when nothing has been
  heard about an open order for 45 days. **Looks right** clears it. Delivered
  clears an *unavailable* flag by itself.

Nothing about the emails is kept or sent anywhere: only the orders found in
them, on the phone and in your Google Sheet if you connect one. The one
exception is **Fix details with Claude**, which only runs when you tap it
(below).

## One-off clean-up

Many stores never send a "delivered" email, so orders pile up under *On the way*.
The first time Orders opens after a full read of Gmail, every open order
(ordered, shipped, out for delivery or ready for pickup) that nothing has been
heard about for **more than 5 days** is marked received once: Delivered, or
Picked up for a pickup. The 5 days count from the newest email or step, not the
order date. An order whose expected date is still ahead, a pickup still being
held and an order whose status you set yourself are left alone. A toast says how
many, with **Undo** (which also keeps that order from being marked again). It
is a one-time tidy per phone, **not a rule**: orders that go quiet later stay
where they are until you mark them. The delivered date it gives is the last
news, not the real arrival.

## Fix details with Claude

When the words-only reader gets an order wrong (a *Check details* card, or any
order), open it and tap **Fix details with Claude**. The app fetches that one
email from Gmail again, takes out its links, and sends the text to Claude Haiku
5.5 through the family server (`functions/orders/api`, the same
`ANTHROPIC_API_KEY` as News and Meals). Claude reports the store, where the
order is, the order and tracking numbers, the items, the total and the dates;
they go onto the order, with **Undo**.

- **Asked first, once.** The first tap explains what is sent and asks.
- **Nothing is kept.** The server stores no email text and no answer, only a
  count of calls per person per day (40 a day).
- **Checked before it is believed.** The server drops an order number, tracking
  number, total or item that isn't written in the email, so a made-up one
  doesn't reach a card. The store name, the status and the dates are Claude's
  reading and can still be wrong: look, and edit what is.
- **What you edited stays.** Locked fields are not touched. A status only moves
  forward, unless the order was already marked as a guess.
- **For signed-in family** (Face ID), like News's summaries. Without the key it
  says Claude isn't set up. `ORDERS_AI_MODEL` (optional repository secret)
  names another model.
- Not tried on a phone or against the real API: the tests use a stand-in for
  Anthropic's answers (`node orders/scripts/api-test.mjs`), so the first real
  tap is the real test of the prompt.


## Gmail

Orders signs in with **Mail's own Google client** (the same client ID), so
there's no new Google Cloud project. It needs Orders' address added to that
client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the
   project Mail uses → **APIs & Services → Credentials** → the Mail **Web
   application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   - `https://tomallison24-news.pages.dev/orders/`
   - and, for Orders Vintage, `https://tomallison24-news.pages.dev/ordersvintage/`
     (each app needs its own address: Google matches them exactly)
   - and the Cloudflare address too, if you use that one: `https://<your
     Cloudflare Pages address>/orders/`
3. **Save**. Google can take a few minutes to pick it up.
4. `gmail.readonly` is already listed for Travel; if it isn't, add it under
   **OAuth consent screen → Data access**.

Then open Orders → the gear → **Connect Gmail**. Opened from AllisonOS Home,
Orders can also use Mail's sign-in while it's fresh (they share storage there),
so often there's nothing to tap.

As in Mail and Travel, Google gives a browser-only app an hour-long sign-in and
no background renewal; Orders goes back through Google quietly when it needs
to, and asks for one tap if Google can't answer quietly.

## Tracking

Orders doesn't look packages up itself: **Track on UPS** (USPS, FedEx, DHL,
OnTrac) opens the carrier's own page with the number filled in, so there's no
key, no cost and no server.

- UPS: `ups.com/track?tracknum=<number>`
- USPS: `tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=<number>`
- FedEx: `fedex.com/fedextrack/?trknbr=<number>`
- DHL: `dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=<number>`
- OnTrac: `ontrac.com/tracking?number=<number>`

The UPS and USPS addresses are the ones those carriers put in their own emails
(checked in real ones). The FedEx, DHL and OnTrac addresses are not published
by those sites and weren't checked; if one stops filling in the number, it
still opens the carrier's site.

For packages Amazon delivers itself (`TBA…`) there is no carrier page to open;
the card shows the number and the estimate.

## Amazon

Amazon's emails are read like any store's (order number `111-2223334-5556667`,
*Ordered: “item”*, *Shipped: “item”*, *Delivered: “item”*), but **no Amazon
order email was available while this was built**, so Amazon's layouts are
unchecked. Expect some **Check details** at first. Amazon sends order mail to
the address on the Amazon account: if that isn't the Gmail Orders reads, set up
forwarding from that mailbox (a filter on `from:amazon.com` that forwards to
this Gmail); forwarded mail is read as if it had come straight here.

## Google Sheet sync

The same design as Notes and Travel (read `notes/README.md`, "Google Sheet
sync", for the details), with **its own Sheet and script**:

1. [sheets.new](https://sheets.new) → name it e.g. **AllisonOS - Orders**.
2. **Extensions → Apps Script**, replace `Code.gs` with the whole of
   [`google-sheet-sync.gs`](google-sheet-sync.gs), and change
   `const SECRET = 'CHANGE-ME';` to your own long phrase.
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access:
   Anyone* → **Deploy** → authorise → copy the **Web app URL**.
4. Orders → gear → **Google Sheet sync** → paste the URL and the phrase →
   **Connect and sync**. Then **Copy setup link** and open it on the other
   phone with the clipboard button.

**"The secret code doesn't match"** when you're sure it does: Apps Script runs
the *deployed* copy, so after changing `SECRET` choose **Deploy → Manage
deployments → ✏️ → Version: New version → Deploy**; and make sure the link is
the Orders Sheet's, not Notes' or Travel's (Orders says so when it can tell).

The Sheet's link is already filled in (`SHEET_URL` in `app.js`: the owner's
Sheet; to use another, paste its URL over it), so only the phrase is typed. The
phrase is never in the code.

The Sheet gets a readable **Orders** tab (newest first) and hidden `_orders`
and `_deleted` tabs the app reads back. Newest change wins. Each phone reads
its own Gmail; the same order found by both is still one order. Which kinds are
switched on is per phone.

**The Log tab** is a history that only grows (oldest at the top). One row each
time an order is **Added**, **Status changed** (with "Shipped → Delivered"),
**Updated** (which fields), or **Deleted** (the order as it was), and one row
(**Left out**) for each email whose kind is switched off in Settings, so the Log
has everything that passes through whatever Settings say; only orders, never the
other emails. The first time a Sheet is connected, the orders already in the
app are logged once as **Existing**. Rows are never rebuilt or cleared by the
script; a row can't be written twice (every event has an id, and two phones
that notice the same thing write one row). The phone queues events and sends
them with the next sync; an old copy of the script doesn't acknowledge them, so
they stay queued until the new script is deployed (paste
[`google-sheet-sync.gs`](google-sheet-sync.gs) over `Code.gs`, **Deploy → Manage
deployments → ✏️ → Version: New version → Deploy**). Tracking and order numbers
are kept as text.

## How it's built

- **No build step.** `index.html` is the page and its look (Travel's style
  block plus Orders' own pieces at the end), `app.js` the app, `parse.js` the
  email reading, `sw.js` the offline shell.
- **No server for reading.** Gmail is read from the phone and tracking opens the
  carrier's page. The only Pages Function is Fix with Claude (above).
- **Security as in Mail and Travel**: a Content Security Policy that only runs
  these files, no email is ever shown as a page (the HTML is only read as
  text), it refuses to run in a frame, and the sign-in carries a random `state`.
- **Data** in `localStorage` (orders, which emails were read and which were
  passed over, the kinds switched on), the Sheet link also in IndexedDB, as in
  Notes.
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node orders/scripts/api-test.mjs     # Fix with Claude's server side, with a stand-in for Anthropic
node orders/scripts/parse-test.mjs   # the email reader: made-up emails in real emails' layouts, and how emails fold into orders
node orders/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (the Drinks test's fake-sheet.mjs)
node orders/scripts/app-test.mjs     # the app in headless Chromium, Gmail stubbed
node orders/scripts/make-icons.mjs   # redraws icon-512.png and icon-180.png from icon.svg
```

The last two need Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

- **The reader was checked against real emails** (the owner's, read while this
  was built; none is in the repository, the tests use made-up names, numbers
  and addresses in the same layouts): Home Depot (order, shipped, curbside
  pickup), eBay (order), Walmart (order, shipped, delivered, and an unavailable
  item), Best Buy (out for delivery, ready for pickup), Target (order, ready for
  pickup), a small store's shipping email, and UPS ship and delivery notices.
  Force of Nature's (WooCommerce) and eBay's out-for-delivery email were seen
  only as converted text, not as the HTML. **Not seen at all**: Amazon, Lowe's,
  Costco, Etsy, FedEx's and DHL's own emails, USPS Informed Delivery. Expect
  some **Check details** from them.
- **Gmail's search** (`QUERY` in `app.js`) was run against the owner's mailbox
  through a connector to check its syntax and what it catches; the first real
  read on a phone is the real test of the batches and the speed.
- **FedEx, DHL and OnTrac tracking addresses** (above).
- **A first read of a year of email** was not run end to end on a phone.
- **Safari on an iPhone** was not tested; the app was checked in Chromium at
  iPhone size, light and dark.
