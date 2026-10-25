# Money

Where the family's money goes, as a home-screen web app in the five aOS designs (Vintage, the
default; Standard, in Sea glass; Night Drive, Folk and Grid). It reads **Monarch's alert emails**: Monarch
(monarch.com) has no API for its members, but it emails each expense and each deposit over the
amounts set in its notification settings, and tells you when it can no longer sync a bank. Money
turns those emails into something to act on.

## What it shows

One page, and a pill at the bottom to pick the view (as Home's and Drinks' views):

- **This month**: what's been spent, the pace for the month ("At this rate: $X by the end of the
  month", once a week has gone), and the month against the usual (the average of the three months
  before), then **Where you could save** and each category with its usual beside it. Tap a category
  for its transactions. The arrows step back through the months.
  - **Where you could save**: a category well over its usual (30% more and at least $75), a better
    card for a kind of spend (below), where the most went this month, and what repeats, as a year.
  - **Income** and **Left over**, once Monarch's deposit alerts arrive.
- **Transactions**: every one for the month, by day, each with its card, category and cash back;
  search finds any of them, in any month (merchant, card, category or amount). Tap one for its card,
  category, cash back, and **Open in Monarch** (and the email itself, on the phone that read it).
- **Cards and rewards**: what went on each card this month and the cash back it earned, a chart of
  rewards a month for the last six months (stacked by card, with a table), and **Use the better
  card**: spends of the last three months where another of your cards pays more, and how much more.
- **Recurring**: the same merchant at a steady rhythm (weekly, every two weeks, monthly, every three
  months, yearly) at about the same amount, three times or more, with what it costs a year; ones
  that stopped under **Stopped?**; and the recurring merchants Monarch's own emails named.
- **A bank Monarch can't sync** ("Access Expired", "Sign-In Required", "Multi-Factor Authentication
  Required" and the like) shows as a card at the top of This month: the bank, what Monarch said,
  **Fix in Monarch** (its Institutions page) and **Fixed it**. It goes by itself once a transaction
  from an account with that bank's name arrives after it, or after 30 days.

## Monarch's emails

What parse.js reads (the templates as of October 2026):

| Email | What Money takes |
|---|---|
| An alert: "We noticed an expense of $52.10 from Big Box, which was spent from Travel Rewards Visa Signature (...1234) and has been categorized as 🛍 Shopping." | the amount, the merchant, the card and its last four, the category and its emoji, Monarch's id for the transaction (its View Transaction link), and the alert's threshold ("notified about expenses over $200") |
| A deposit alert ("We noticed a deposit of …"): the same, as money in | the same |
| A summary: "✨ You have 2 new updates in Monarch", each "A new expense of $209.68 from Amazon has been categorized as 🛍 Shopping." | each one, with no card (the summary doesn't say) |
| "🛠️ Access Expired" and the other can't-sync emails | the bank and what Monarch said |
| "🗓 New recurring merchant found" | the names and how often |

- **The HTML is read, not the plain text.** Monarch's plain-text part leaves the merchant and the
  card out of an alert ("from , which was spent from and has…"), so parse.js reads the HTML as text,
  and the plain text only when there is no HTML.
- **A summary's card is guessed** from where that merchant's own alerts nearly always went (80% or
  more of them), and shown with a "?". A summary that repeats an alert is dropped (the alert says
  the card); two alerts with the same Monarch id are one.
- **The date** is the day the email came, on the phone's clock: close to the transaction's, since
  Monarch emails as it syncs.
- **What Monarch didn't email isn't here.** Before you lower the alerts, only the big ones were
  emailed. Each alert says its threshold, so Money knows: a month compared with one from before
  counts only what's over that amount on both sides, and says so ("Counting charges over $200
  only, on both sides"). Set **both alerts to $1** in Monarch (Settings > Notifications > Expense
  alert and Deposit alert) so Money sees every transaction.
- Monarch counts transfers (card payments, money between your own accounts) as neither expense nor
  income, and doesn't alert on them, which is what a spending view wants.

## Card rewards

Each card's cash back is in **Settings > Card rewards**, shared with whoever sees Money: a rate on
everything, a rate for online shopping, one for groceries and wholesale clubs, and the quarterly
amount the bonus rates are paid on (0: no limit). They start from what the owner asked for:

- **Robinhood Credit Card**: 3% on everything.
- **Bank of America Customized Cash Rewards**: 6% on online shopping; and Bank of America's 2% at
  grocery stores and wholesale clubs, 1% on everything else, the bonus paid on the first $2,500 a
  quarter (online and grocery together). Those last three are the card's usual terms, not something
  the owner asked for: check them against the card, and change them in Settings if they differ.
- Every other card starts with **Cash back not set**: it earns nothing here until a rate is entered.

**Online shopping** is a merchant on the online stores list (Settings > Online stores: Amazon,
Etsy, eBay, Wayfair, Chewy, Temu, Shein and Zappos to start). **Groceries and wholesale clubs** is
Monarch's Groceries category, or Costco, Sam's Club or BJ's. A card known by its name keeps its
rewards when it's replaced (Robinhood's **1111, then **9876, are one card).

## Ipsy's daily check

Once a day, the first time Money opens on the reader's phone (after it has read Gmail), Ipsy checks
**this calendar month's new transactions** (and the last 3 days, so the last of a month is checked on
the 1st) against the Monarch email each was read from: the amount, money in or out, the merchant, the
card and the category.

- The phone fetches each email from Gmail again and sends its words (up to its footer, at most 1,500
  characters) with what the app read to `functions/money/api` (POST `check`), 20 at a time, which asks
  **Claude Sonnet 5.5** (`MONEY_AI_MODEL`, a Pages secret, names another) with the `ANTHROPIC_API_KEY`
  secret Travel and Orders already use. Links, email addresses and the greeting (your name) are taken
  out first; nothing is kept on the server.
- **Passed**: marked, and never sent again. **A misreading**: corrected from the email, but only with
  words Claude quotes that really are in that email (a value it can't quote is thrown away, as in
  Travel's extract), and marked **Corrected**; the transaction's sheet says what changed, with **Undo
  Ipsy's correction** (the app's reading comes back and stays). **Couldn't confirm**: marked **Check**,
  with Ipsy's note. Nothing corrected or flagged is sent again either.
- This month shows a card when Ipsy corrected something or wants you to look ("Ipsy's check"), and
  the check travels with the transaction to whoever sees Money.
- Settings > Ipsy's daily check (the reader only): **Check each day** (on; kept on this phone), when it
  last checked and what it found, and **Check now**.
- Cost: a call holds only the new emails (about 7 a day, a few thousand tokens), at Sonnet 5.5's
  $2 / $10 per million tokens in / out: well under $1 a month. At most 8 calls a day for the reader
  (`money:check:<id>:<day>`).
- It checks the app's reading of Monarch's email, not Monarch itself: it can't find a transaction
  Monarch never emailed, or a wrong amount on Monarch's side.

## Who sees it

- **One phone reads the emails**: Money's reader. It reads its own Gmail, read-only (below), the
  first time two years back, then what's new each time it opens (at most hourly) or when you tap
  the refresh button. Each email is read once.
- **Signed in to the family account**, the reader's phone sends what it read to aOS
  (`functions/money/api`, in the accounts' Workers KV: `money:share`, `money:meta`,
  `money:tx:<YYYY-MM>`), a month at a time, only the months that changed. The first phone to send
  becomes the reader.
- **The reader picks who else sees it** (Settings > Who sees Money). Nobody else sees any of it, not
  even the family's owner. Their phones get it from aOS each time they open Money, and can change
  the card rewards, the online stores and the alerts marked fixed (shared, the newer change wins);
  they can't read Gmail for it.
- **Signed out**, it all stays on the phone (localStorage `allison-money-v1`).
- **Delete all data** on the reader's phone deletes it from aOS too, for everyone; on anyone else's,
  from that phone. Removing the reader from the family deletes it from aOS; removing someone it was
  shared with takes them off the list.

## Gmail

Money signs in with **Mail's own Google client** (the same client ID as Mail, Travel and Orders), so
there's no new Google Cloud project, but its address must be added to that client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the project Mail uses → **APIs &
   Services → Credentials** → the Mail **Web application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   `https://tomallison24-news.pages.dev/money/`
3. **Save**. Google can take a few minutes to pick it up.

`gmail.readonly` is already on the consent screen for Travel and Orders. Opened from aOS, Money can
use Mail's sign-in while it's fresh (they share storage there). Google gives a browser-only app an
hour-long sign-in; Money goes back through Google quietly when it needs to, and asks for a tap if
Google can't answer quietly.

## Files

- `index.html`: the page (the Sea glass styles, then the Vintage block; Night Drive, Folk and Grid are
  generated from it by `node aOS/scripts/make-looks.mjs`).
- `app.js`: drawing, Gmail, the family's copy, Settings.
- `parse.js`: Monarch's emails → transactions, alerts and recurring merchants.
- `calc.js`: the sums: folding in, cards and rewards, what repeats, a month against the usual, tips,
  which alerts are still open.
- `functions/money/api/[[route]].js`: the family's copy; `_middleware.js` locks it to signed-in family.
- Russian: `home/lang/ru/money.js`.

## Tests

```
node money/scripts/parse-test.mjs    # Monarch's emails (made-up ones in its templates)
node money/scripts/calc-test.mjs     # the sums
node money/scripts/api-test.mjs      # the server: who may send, see, share and delete; Ipsy's check
node money/scripts/app-test.mjs      # the page at iPhone size: every view, a transaction, Settings, Ipsy's check, the designs
```

All made-up data: no one's real transactions are in this repository.

## Not yet

- **Ipsy** can't answer money questions yet ("what did we spend at Costco this month?").
- No notifications: a bank that stops syncing shows when Money is opened, not on the lock screen.
- Monarch's deposit alert wording hasn't been seen yet: parse.js reads "deposit", "income",
  "credit" and "refund" alerts in the expense alert's shape, and its test has made-up ones. Check
  the first real one.
