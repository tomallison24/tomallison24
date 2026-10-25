# Orders

Everything you've bought and where it is, as a home-screen web app in a
mid-century Vintage design (the default) or the same frosted glass as Mail,
Notes and Travel (Settings → Design). It fills itself from the order,
shipping, delivery and store-pickup emails in Gmail, shows the courier and the
tracking number, and opens the carrier's own tracking page with one tap.

- **On the way** lists what hasn't arrived: **Arriving today** (out for
  delivery), **Ready for pickup**, **On the way** (shipped) and **Ordered**
  (no shipping email yet). Each order is a card with the store, the item, the
  total, where it is (a four-step bar, three for a pickup), the courier and the
  tracking number.
- **Returns** appears once there's a return (below): **To send back** (with
  the day to drop it off by), **Waiting for the refund** and **Refunded** (for
  30 days). A return due within the week also leads **On the way**, under
  **Returns to send back**.
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
- **The family's Google Sheet** is the record: one Sheet for everyone's orders,
  each person's phone getting only their own, through aOS (below). It syncs by
  itself through aOS; set up in **aOS → Account → Google Sheets**. Settings has
  no Sheet controls.

## The two designs

One app, one set of orders: the design changes only how Orders looks, at once,
and is kept on this phone (**Settings → Design**, the first section), as in
Clock. `../home/design.js`, loaded in `<head>`, applies it before the page is
drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home and Meals. A cream ground and cards
  (walnut in dark mode), flat and round-cornered, in place of glass; mustard,
  teal, burnt orange and olive: the filter has a mustard thumb, the progress
  bars are teal, each store gets a round teal, mustard, orange or olive
  monogram, the strip that asks for a check is mustard-outlined; three atomic
  shapes behind the title that scroll away with the page, and three little bars
  under it; a solid burnt-orange add button, outlined teal and solid-orange
  buttons; Futura (built into iOS, nothing downloaded). Behind the title is the
  shared **Vintage sky** (`../home/sky.js`, as in every Vintage design): by day
  a ground washed with mustard and the sun's slow rays; after sunset deep teal,
  the moon and twinkling stars, for the phone's place (only if it already has
  location permission: it never asks), else its time zone. It holds still with
  reduced motion; this app only gives its disc its colour (`--sky-disc`) and
  keeps its own sizes and places for the shapes, tuned to its header.
- **Standard**: Sea glass: Travel's style block plus Orders' own pieces, the
  slow aurora and frosted glass, no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The choice is `localStorage` `design.orders`. What iOS reads when Orders
is added to the Home Screen follows it: the icon (`icon-180.png`, Vintage: a
cream parcel on burnt orange, with a teal sun and a mustard pill;
`icon-glass-180.png`, Standard), the status bar style (`default` in Vintage,
where `black-translucent`'s white clock would vanish on the cream) and the bar
colours. Only colours, shapes and type change: every button, sheet and swipe
works the same in both.

**The old Orders Vintage app.** Orders Vintage used to be an app of its own
(`ordersvintage/`, a copy of this page and script with its own storage). Its
address now opens this same app (the deploy copies `orders/` there,
`.github/workflows/news.yml`), so a phone that added it keeps it. The first
time it opens there, `design.js` moves that app's data on the phone over to
Orders' names (`ordersv.…` → `orders.…` for the Gmail sign-in,
`allison-ordersv-…` → `allison-orders-…` for the orders, what was read, the
kinds, an old Sheet link and the rest; the IndexedDB copy of an old Sheet link
`allison-ordersv` → `allison-orders`, which Orders opens only once that is
done, and then hands to aOS, below; and what it had seen, so no walkthrough again), unless Orders already has
data on that phone; nothing old is deleted. Ipsy's checks call
`../orders/api/read`, so it reaches the family's route from either address; an
email opens in Mail (`../mail/?thread=…`), which also carries both designs now.
Gmail's sign-in returns to the address it started from, which is why both
addresses stay registered (below).

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
them, on the phone and, once you're signed in, in the family's Google Sheet. The
exceptions are Ipsy's: an order's email read again to fix it (when you tap
**Have Ipsy check this order**, or by itself for To check once you've said
yes), and whatever Ipsy reads to answer you in its chat (below).

**Private** (the switch on an order's page, a lock on its card) hides an order
from Ipsy: it is left out of everything Ipsy reads (Ipsy is told only how many
there are), Ipsy can't change it, and Ipsy doesn't check it, by itself or with
Have Ipsy check. Its emails are hidden too: the email it came from, that
email's thread, and any email that names its order or tracking number are left
out of what Ipsy finds or reads in Gmail. It still syncs and shows as usual:
Private only hides it from Ipsy. **Settings → Ipsy can search Gmail** turns
Ipsy's Gmail off altogether, on this phone (`home/ipsy.js`, `privacy`).

## Returns

Return and refund emails are read like order emails, but onto the order's
**return** (`o.ret`), never its own status: Amazon's *Return request
confirmed*, *Your refund confirmation*, a store's *We received your return*, an
*RMA* approval with a return label. A return has four steps: **Return started**
(a request or a label), **Sent back** (dropped off, posted), **Store has it**
and **Refunded**, each with its date.

- **What's read**: the day to drop it off or send it by (*Drop off by Thu, Nov
  19*), where (*Dropoff location*), the reason, the store's return number (RMA),
  the return parcel's tracking number, the refund (estimated until it's
  refunded) and where it goes (*your Visa ending in 1234*), and the items being
  returned. The newest email wins (Amazon sometimes moves the drop-off day), and
  a step never goes backwards.
- **Which order**: matched on the order number (then the store), so it joins
  the order the app already has, and the order keeps its own email. A return of
  something the app never saw ordered (an order email sent to another inbox)
  becomes an order of its own, already delivered. A return with no order number
  but an RMA (or a store and a refund) is kept on its own too.
- **What it does to the order**: something being returned has arrived, so an
  order still *on its way* is marked delivered (picked up for a pickup). A
  package the carrier sent back (*being returned to us by the carrier*) marks
  the order canceled and clears its *Check details*.
- **On the order's page**: the return's steps, then Drop off by, Drop off at,
  Returning, Reason, Return number, Return tracking (with Copy, and **Track the
  return** when the carrier is known), Refund to, and the refund. **Mark as sent
  back** and **Mark as refunded** move it on; **Open the return email in Mail**.
  **Start a return** on any delivered or picked-up order starts one by hand;
  **Edit details** has a Return section (the step, drop-off day, refund, return
  number, tracking, where, reason): what you change there is locked like any
  edit, though a later email still moves the step forward.
- **Not a return**: tax returns, car rentals, travel refunds and trade-ins. In
  an email's body only plain news counts (*your return request has been
  approved*): every order email's footer offers to *Start a return*.
- **Which emails**: the Gmail search also looks for *return*, *returned*,
  *refund*, *refunded* and *RMA* in the subject (`QUERY_V` 2). Return emails read
  before returns existed (Amazon's came in as orders) are read once more, the
  year's worth, even though they were already seen (`RETURNS_V`).
- **Synced and logged**: the return is part of the order, so it goes to the
  family's Sheet with it; the Log tab gets a **Return** row for each step
  (*Return started → Refunded ($21.50)*).
- **Ipsy** sees each order's return (`find_orders` with `status: returns`
  lists them) and can start, move on or fix one (`update_order`'s `ret`).
- Checked against real emails (the owner's; none in the repository, the tests
  use made-up ones in the same layouts): Amazon's return request (and its
  second email with a later drop-off day) and its refund for a package the
  carrier sent back, a jewellery store's *We received your return*, and a beauty
  store's RMA approval. Not seen: Walmart's, Target's or any other big store's
  return emails, or a *your return is on its way* email. **Have Ipsy check this
  order** still reads the order's own email, not the return's.

## Hidden (gifts)

**Hidden** (the switch under Private on an order's page) is for gifts and
anything else someone picking up your phone shouldn't see: the order leaves
every list (On the way, Returns, Delivered, To check), search, the counts and
the line under the title, and Ipsy (it counts as Private there too, emails
included, and Ipsy's own checks skip it). It stays hidden when its emails are
read again, and the flag goes with the order to the family's Sheet, so it's
hidden on your other phones too.

- **Seeing them again**: Settings > **Show hidden orders** always asks for
  Face ID (the aOS family passkey, `AllisonOS.account.signIn`), whether or not
  Orders has signed in before, and adds a **Hidden** tab; with no passkey, or
  offline, they stay hidden. They hide again as soon as Orders goes to the
  background. Turn Hidden
  off on the order's page to put it back.
- **Where it can still be seen**, outside Orders: its emails in Gmail and in
  Mail; and the family's Google Sheet (the Orders tab and the Log), which the
  owner can open. An email the app can't match to the hidden order (a carrier's
  notice with no order number, say) arrives as an order of its own, not hidden.

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

## Ipsy keeps orders up to date (and checks any order)

**By itself.** After each read of Gmail (and when Orders opens), Ipsy goes
through the orders that came from an email and are either marked *Check
details* or still on their way (ordered, shipped, out for delivery, ready for
pickup), and checks each one whose newest email it hasn't read yet, quietly,
To check first, at most 10 at a time: the same check as below, with no tap. So
when a store's shipping or delivered email arrives, Ipsy reads it too and moves
the order on, without **Have Ipsy check this order** on each one. Each email is
checked once (a new email about the order is checked again). A fix shows in
Ipsy's chat with **Undo**, and Ipsy says in a little bubble by its corner what
it did (*I updated 2 orders; 1 still needs you in To check*). What it can't fix
(an order nothing has been heard about for weeks, an item the store says is
unavailable) stays in To check for you. An order with no new email isn't read
again: re-reading the same email wouldn't tell Ipsy anything new.

- **Offered once.** The first time there's something to check, Ipsy asks from
  its corner; nothing is sent until you say yes. **Settings > Ipsy > Ipsy keeps
  orders up to date** turns it on or off (it was *Ipsy checks To check*; a yes
  given then still counts).
- It never asks for Face ID by itself: signed out, it waits (and says so).
- It stops for the day at the daily limit below, and tries again later.

**On an order's page.** **Have Ipsy check this order** (it was *Fix details with
Claude*) does the same for that one order. Asked once first, in Ipsy's chat.

**How a check works.** When the words-only reader gets an order wrong (a
*Check details* card, or any order), the app fetches that one
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


## Ipsy

**Ipsy** is your helper in the bottom left corner (the one you picked and named): a helper you chat
with about your orders, in the design picked in Settings (mustard, teal and cream
in Vintage, pastel glass in Standard; it changes with the design at once). Ask in your own words, e.g. *What's arriving this week?*,
*Find duplicate orders and merge them*, *The Walmart total should be $49.99*,
*Delete everything from Tandoor House*, *Check Gmail for orders I'm missing*,
*How long does Target hold a pickup?*

- **What it can do.** Look through every order and change them: edit any
  detail, mark one delivered, add one, delete, and merge duplicates into one
  (`ipsy-tools.js`). Search and read your Gmail (read-only, with the app's own
  sign-in), and search the web and read pages (a store's return policy, a
  carrier's tracking page). It changes what you ask without asking first; it
  asks only when it isn't clear which orders you mean, or before deleting or
  merging more than five at once.
- **A speech bubble, not a page.** Tap Ipsy and the chat pops out of it as a
  bubble above it, its tail pointing back at it; it grows with the conversation
  (up to about two thirds of the screen) and shrinks back into Ipsy when you tap
  Ipsy, the ×, or anywhere outside it. With the keyboard up, Ipsy and the bubble
  ride above it.
- **Every change shows in the chat with Undo**, for as long as the app stays
  open. What Ipsy changes is kept like your own edits (a later email won't
  overwrite it), a deleted order doesn't come back from the email, and it all
  goes to the family's Google Sheet and its Log tab like any other change.
  Asked about older orders (or with no dates given, the last year), Ipsy's
  `find_orders` first fetches them from the Sheet (`lookBack` in `app.js`).
- **It acts out its work** (`../home/ipsy.js`): it thinks with a hand on its
  chin while it waits for Claude, reads a book while a tool looks at your orders,
  puts its glasses on to search, writes in a notepad when it changes something,
  and talks while the answer appears. Reduce Motion holds it still.
- **How it works.** The chat lives on the phone. Each step sends the whole
  conversation to the family server (`functions/orders/api`, `POST ipsy`),
  which adds Ipsy's instructions and tools and asks **Claude Sonnet 5.5**
  (medium effort, prompt caching on, Anthropic's server-side fallback if it
  declines). When Claude asks for one of the order or Gmail tools, it runs on
  the phone, where the orders and the Gmail sign-in are, and the result goes
  back with the next step. Web search and web pages run at Anthropic.
  `ORDERS_IPSY_MODEL` (optional repository secret) names another model.
- **Asked first, once.** Before the first question, Ipsy says what is sent
  where: your question and whatever it looks at to answer it (your orders, and
  any email it opens) go to Claude through the family server. The server keeps
  only a count of questions (80 a person a day; the steps a question takes
  aren't counted).
- **For signed-in family** (Face ID), like Ipsy's checks. Without the key it
  says Ipsy isn't set up.
- **Emails and web pages are read, never obeyed**: Ipsy is told they are
  material, not instructions, and to say so when one asks it to do something.
  Gmail access is read-only, so it can't send, change or delete email, and an
  email's links reach Claude as their site only (*[link to ups.com]*), so a
  one-tap link in an email (confirm, cancel, unsubscribe) is never opened.
- **New chat** (top of the chat) starts over; a chat is kept on the phone
  until then (a very long one stops at about 1 MB and asks for a new chat).
- **Not tried against the real API or on a phone**: the tests use a stand-in for
  Claude (`node orders/scripts/ipsy-test.mjs`, `node orders/scripts/api-test.mjs`),
  so the first real questions are the real test of the instructions.

## Gmail

Orders signs in with **Mail's own Google client** (the same client ID), so
there's no new Google Cloud project. It needs Orders' address added to that
client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the
   project Mail uses → **APIs & Services → Credentials** → the Mail **Web
   application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   - `https://tomallison24-news.pages.dev/orders/`
   - and the old Orders Vintage address, `https://tomallison24-news.pages.dev/ordersvintage/`
     (already added; keep it: a phone that added Orders Vintage opens this
     app there, and Google matches addresses exactly)
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

## The family's Google Sheet

One Sheet for the whole family, the record of everyone's orders, the same
design as Fitness' (`aOS/SHEETS.md` has it, with the contract every app's
script and app follow, and the owner's set-up). It syncs by itself through
aOS; set up in **aOS → Account → Google Sheets** (the owner, once). Orders has
no Sheet controls of its own: no status sheet, Sync now, form or setup link in
Settings.

- **Each order is someone's.** Every row carries `by`, the family id of the
  person whose Gmail (or hands) it came from, and each phone only ever gets its
  own person's orders. The readable **Orders** tab and the **Log** tab start
  with a **Who** column. Orders from before aOS kept `by` are the owner's.
- **No link or phrase on a phone.** The owner gives the Sheet's link and phrase
  to aOS once (**aOS → Account → Google Sheets → Orders**). Every sync goes
  through aOS (`../home/sheet.js`, `functions/sheet/api`), signed in with Face
  ID, which passes it on to the script with who's asking. Signed out, Orders
  works on the phone as before, and sends nothing.
- **Quietly.** It syncs on start, a moment after a change, when it comes back
  to the front, when the phone is back online, and on sign-in; a sync never
  asks for Face ID. A real error shows one toast a session; signed out, or no
  Sheet in aOS yet, shows none (the line under the title says "Not synced").
- **Handed over once.** A phone that still has the old link and phrase (in
  `localStorage` or its IndexedDB copy) hands them to aOS on the owner's phone,
  and forgets them on every phone once aOS has them. An old `#sync=` setup link
  is only taken off the address.
- **The last 90 days, and everything still on its way.** Once a phone has synced
  with the family's Sheet, it keeps the orders from the last 90 days (by the day
  each was ordered: its order date, else its first step's, else its email's, the
  same `orderDay` in the script and in `app.js`) and **every order that isn't
  finished yet** (ordered, shipped, out for delivery, ready for pickup),
  however old. Older finished orders (delivered, picked up, canceled) are
  dropped from the phone after a sync with no grave: the Sheet keeps them. The
  Sheet's answer is the same: the last 90 days, every order not finished, and
  whatever the phone sent, as the Sheet now has it.
- **Looking back.** At the end of **Delivered** and of a search, **Show older
  orders from the Sheet** fetches a year further back each tap (`action:
  'range'`); they stay on the phone until Orders next opens. Ipsy does the same
  when asked about older orders.
- **An email read again** (a first read of a year of Gmail on a new phone, or
  **Read the last year again**) can find an order the Sheet already has, edited
  by you (checked, Private, notes, a status you set). Before such orders are
  sent, Orders asks the Sheet for those days first (`lookFirst`) and folds what
  the email says into the Sheet's copy, as a later email would be, so your edits
  stay. The first sync of a session runs before Gmail is read, for the same
  reason.
- **The same order in two people's Gmail** (a family account, a forwarded
  confirmation) makes the same order id. The first to send it keeps it; the
  other's phone is told the id is someone else's (`refused`), keeps its copy to
  itself and stops sending it.
- **Private** (hidden from Ipsy) is just a detail of an order: it syncs like the
  rest and has nothing to do with whose an order is.

Newest change wins; a deletion reaches your other phone and doesn't come back
from the email. Which kinds are switched on is per phone.

**The Log tab** is a history that only grows (oldest at the top), with **Who**
(whose phone sent it) first. One row each time an order is **Added**, **Status
changed** (with "Shipped → Delivered"), **Updated** (which fields), or
**Deleted** (the order as it was), and one row (**Left out**) for each email
whose kind is switched off in Settings, so the Log has everything that passes
through whatever Settings say; only orders, never the other emails. The first
time a phone's orders reach the Log, the orders already in the app are logged
once as **Existing**. Rows are never rebuilt or cleared by the script; a row
can't be written twice (every event has an id, and two phones that notice the
same thing write one row). The phone queues events (once it has synced with the
family's Sheet) and sends them with the next sync. A Log from before VERSION 3
gets its Who column put in front the first time the new script writes to it
(every row moves one column right as it is; its rows are the owner's). Tracking
and order numbers are kept as text.

**Updating the script** (VERSION 3): paste
[`google-sheet-sync.gs`](google-sheet-sync.gs) over `Code.gs`, keeping your
`SECRET` line, then **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**, and give aOS the phrase (`aOS/SHEETS.md`, "Setting it up"). Until then
Orders says (once) the Sheet is still on its old script, and keeps its Log events
queued.

## How it's built

- **No build step.** `index.html` is the page and its two looks (Travel's style
  block plus Orders' own pieces, then the `<style id="vintage">` block; see
  "The two designs"), `app.js` the app, `parse.js` the
  email reading, `sw.js` the offline shell.
- **No server for reading.** Gmail is read from the phone and tracking opens the
  carrier's page. The only Pages Function is Claude's (Ipsy and its checks, above).
- **Ipsy**: `../home/ipsy.js` (the character, the chat and its loop, shared with
  any app that adds Ipsy) and `ipsy-tools.js` (its tools here).
- **Security as in Mail and Travel**: a Content Security Policy that only runs
  these files, no email is ever shown as a page (the HTML is only read as
  text), it refuses to run in a frame, and the sign-in carries a random `state`.
- **Data** in `localStorage` (orders, which emails were read and which were
  passed over, the kinds switched on, the Log events not yet in the Sheet) and
  the family's Google Sheet (above). An old Sheet link, until it's handed to
  aOS, also in IndexedDB.
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node orders/scripts/api-test.mjs     # Ipsy's server side and its checks (read), with a stand-in for Anthropic
node orders/scripts/ipsy-test.mjs    # Ipsy in both designs, in headless Chromium, with a stand-in for Claude and Gmail
node orders/scripts/parse-test.mjs   # the email reader: made-up emails in real emails' layouts, and how emails fold into orders
node orders/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (the Drinks test's fake-sheet.mjs): who gets in, each person's own, the 90 days and range, Who, the Log
node orders/scripts/app-test.mjs     # the app in headless Chromium, Gmail stubbed: both designs, Settings > Design, the old Orders Vintage address, and the family's Sheet through a stand-in for aOS
node orders/scripts/make-icons.mjs   # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
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
- **The VERSION 3 script in a real Sheet.** It runs in the tests on an
  in-memory stand-in for Apps Script; it was not deployed. In particular, a real
  old Log getting its Who column (`insertColumnBefore`, which should carry each
  column's number format with it) is only tested on the stand-in.
