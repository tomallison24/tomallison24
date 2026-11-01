# Money

Where the family's money goes, as a home-screen web app in the five aOS designs (Vintage, the
default; Standard, in Sea glass; Layers and Tron). It reads **Monarch's alert emails**: Monarch
(monarch.com) has no API for its members, but it emails each expense and each deposit over the
amounts set in its notification settings, and tells you when it can no longer sync a bank. Money
turns those emails into something to act on.

## What it shows

One page, and a pill at the bottom to pick the view (as Home's and Drinks' views):

- **This month**: what's been spent and the month against the usual (the average of the three months
  before), with a meter under it: spent so far, the usual as a mark, and where this pace ends the
  month (once a week has gone) as a paler run. Then **Where you could save**, **By category** and
  Ipsy's ideas, each folded until you open it (and kept open or shut on the phone): By category shows
  each category's share of the month as a strip while folded, and opened, each category's bar with
  its usual marked on it. Tap a category for its transactions. The arrows step back through the months.
  - **Trends** (tap the number): spent, the usual, at this rate and what's left over (or a usual
    week); **Week by week**, the last eight weeks against a usual week (tap one for its categories
    and its charges; weeks start on Sunday, or Monday if Calendar says so); and **Through the
    month**, what had gone by each day against the usual month by then, with the pace to the end
    (tap or drag along it to read off a day).
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
| A deposit alert ("We noticed a deposit of …", or "You've received $2,400.00 from Acme Payroll, which was deposited into … and has been categorized as 💵 Paychecks."): the same, as money in | the same |
| A deposit in a summary (seen October 2026): "You've received $313.60 from Robinhood, which has been categorized as 💸 Interest." | as money in, with no card; numbered on its own (`:in0`), so the summary's expenses keep their ids |
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

## Fixing a transaction's merchant, amount, date and card

A transaction's page has its **Merchant**, **Amount**, **Date** and **Card** (**Into**, for money in) at the top, each
changed in place: type the merchant's name or the amount, pick the day, or pick the card from those your transactions use
(each with its usual last 4 digits), or **Another card…** to type one. It saves when you leave the
field, with **Undo**. Under them, **Monarch said:** what the email had, and **Put back Monarch's**.

It's kept as the categories are: what Monarch's email said stays on the transaction, and the fix sits on
top of it in the family's shared settings (`edits: { txId: { merch, amt, date, acct, l4, at } }`, `calc.js`
`edited`), so every phone that sees Money shows it, reading the emails again doesn't undo it, and the
newer of two phones' fixes wins (an entry with no fields left is one put back). Everything (the month,
the usual, Trends, cards and rewards, Recurring, search, Export) reads the fixed copy; a new date moves
it to that day and month, and a new merchant takes that merchant's own category if the family gave it one. Ipsy's daily check still compares the email with what Money read, not with
your fix. aOS keeps the newest 400 fixes (`functions/money/api`, `cleanEdits`).

## Monarch's own connector (a test)

Monarch has its own MCP connector (`https://api.monarch.com/mcp`), the one its help pages give to Claude,
ChatGPT and the rest. Money is testing it as a better source than the emails: Monarch's own record of
every transaction, with its card, not just those over the alert amount.

**Settings > Connected accounts > Connect Monarch** (the reader only) sends you to Monarch to sign in and
say yes, read-only; Monarch sends you back to Money (`/money/`), and aOS's server keeps the sign-in
(`server/monarch.js`: found the way the MCP spec says, aOS registering itself with Monarch as "aOS
Money", OAuth with PKCE, the tokens refreshed as they run out; in Workers KV, deleted with the rest of
Money). Monarch takes only the return addresses of the AI apps it supports and a computer's
own (loopback) address, so when it turns down this site's (`Redirect URI is not supported`), aOS
registers `http://127.0.0.1:53280/callback` instead: Money explains first, Monarch opens in Safari,
and after you say yes it lands on a page that won't load; copy that page's whole address (touch and hold
Safari's address bar, then Copy: the bar itself shows only 127.0.0.1) and paste it under Connected accounts
(**Finish connecting Monarch**, for 30 minutes). Its code and state are found after a ? or a #, or in an
address encoded once; anything else says which site the pasted address is. The code in it is no use
without the PKCE verifier, which stays on aOS's server. **Test reading Monarch** reads the last 14 days through the connector and puts them beside what
Money read from the emails: how many match (by Monarch's own id, which each alert's link carries, or by
amount and day), how many differ and in what, what's only in Monarch or only in Money, and the fields
Monarch gives. Nothing in Money changes yet, and nothing changes in Monarch; aOS keeps only the counts.
**Disconnect Monarch** deletes the sign-in (Monarch's Settings > MCP Connector lists it too).

Routes: `functions/money/api` `monarch/status`, `start`, `finish`, `test`, `disconnect`.

## Your own categories, and Ipsy's ideas

Categories are Monarch's, as its emails say, until someone changes one. Monarch's own stays on each
transaction underneath (the transaction's sheet says "Monarch said", and the export has both).

- **Change one**: tap a transaction, then Change: pick a category in use or type a new one. **Always
  for** its merchant is on (its other transactions too, and those to come); turn it off for just this
  one. Picking Monarch's own (marked "Monarch's") puts it back.
- **Ipsy's ideas**: Settings > Categories > Ask Ipsy for ideas, and once a month on its own (the first
  phone to open Money that month, with 20 or more transactions). Ipsy (Claude Sonnet 5.5) sees the
  last 12 months' spending by category with the biggest merchants in each, the changes you made (it
  follows your taste) and the ideas you said no to, and suggests merging a category into another or
  moving a merchant to another (or a new) category, with a line saying why. They show on This month:
  **Accept** makes it a rule, as if made by hand; **No thanks** and it's never suggested again.
  Nothing changes until someone accepts. Sent to Anthropic: category and merchant names with counts
  and totals; no cards, dates or emails. A few a day at most per person (`money:ideas:<id>:<day>`);
  under a cent each.
- **Shared**: the changes and ideas are in the shared settings (`recat`, `ideas` in `money:meta`), so
  whoever sees Money sees them and may change them. Two phones' changes both stay: each change has its
  own time and the newer wins (`calc.js` and the server, `mergeSettings`). Settings > Categories lists
  the rules, each with Remove.
- **Where they count**: This month, the categories, the tips, search, the lists and the export. Card
  rewards keep Monarch's category (a card's bonus goes by how the store charges, not by your name for
  it), and so does Ipsy's daily check (it checks the app read the email right).

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
- Settings > AI helper's daily check (the reader only): **Check each day** (on; kept on this phone), when it
  last checked and what it found, and **Check now**.
- Cost: a call holds only the new emails (about 7 a day, a few thousand tokens), at Sonnet 5.5's
  $2 / $10 per million tokens in / out: well under $1 a month. At most 8 calls a day for the reader
  (`money:check:<id>:<day>`).
- It checks the app's reading of Monarch's email, not Monarch itself: it can't find a transaction
  Monarch never emailed, or a wrong amount on Monarch's side.

## Who sees it

- **One phone reads the emails**: Money's reader. It reads its own Gmail, read-only (below), the
  first time five years back, then what's new each time it opens (at most hourly) or when you tap
  the refresh button. Each email is read once; one that can't be fetched just then (gone, or the
  connection dropped) is tried again next time, and the rest are kept as they're read.
- **Signed in to the family account**, the reader's phone sends what it read to aOS
  (`functions/money/api`, in the accounts' Workers KV: `money:share`, `money:meta`,
  `money:tx:<YYYY-MM>`), a month at a time, only the months that changed. The first phone to send
  becomes the reader.
- **The reader picks who else sees it** (Settings > Who sees Money). Nobody else sees any of it, not
  even the family's owner. Their phones get it from aOS each time they open Money, and can change
  the card rewards, the online stores and the alerts marked fixed (shared, the newer change wins);
  they can't read Gmail for it.
- **Signed out**, it all stays on the phone.
- **Five years are kept**, on the phones and in aOS: this month and the 59 before it
  (`money/calc.js`, `KEEP_MONTHS`; the server's `KEEP_MONTHS`). Anything older is let go: the
  phone drops it when it saves, and aOS deletes those months with the reader's next send. On the
  phone it's in IndexedDB (`allison-money`), not localStorage, whose 5 MB or so every aOS app
  shares: five years is about 2 to 6 MB (100 to 300 transactions a month). A phone that had it in
  localStorage (`allison-money-v1`) moves it over the first time it opens.
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

`gmail.readonly` is already on the consent screen for Travel and Orders. Opened from aOS, Money uses
Mail's sign-in first while it's fresh (they share storage there; same Google account, by the address
each kept), so it never goes back through Google while Mail is signed in; Mail's token is Mail's to
renew or drop, Money only reads it, and skips one Gmail refused. On its own (or when Mail has none),
Google gives a browser-only app an hour-long sign-in; Money goes back through Google quietly when it
needs to, and asks for a tap if Google can't answer quietly.

## Files

- `index.html`: the page (the Sea glass styles, then the Vintage block; Layers and Tron are
  generated from it by `node aOS/scripts/make-looks.mjs`).
- `app.js`: drawing, Gmail, the family's copy, Settings.
- `parse.js`: Monarch's emails → transactions, alerts and recurring merchants.
- `calc.js`: the sums: folding in, cards and rewards, what repeats, a month against the usual, tips,
  which alerts are still open, five years kept, your own categories (`recat`, `mergeSettings`, `ideasInput`).
- `functions/money/api/[[route]].js`: the family's copy; `_middleware.js` locks it to signed-in family.

## Tests

```
node money/scripts/parse-test.mjs    # Monarch's emails (made-up ones in its templates)
node money/scripts/calc-test.mjs     # the sums
node money/scripts/api-test.mjs      # the server: who may send, see, share and delete; Ipsy's check; categories and ideas
node money/scripts/app-test.mjs      # the page at iPhone size: every view, a transaction, Settings, Ipsy's check, categories and ideas, the designs
```

All made-up data: no one's real transactions are in this repository.

## Ipsy, the helper you chat with

For whoever is signed in and sees Money: the helper sits above the view pill, on the left (as in the
other apps). Ask it where the money goes ("what did we spend at Costco this month?", "which
subscriptions could we cut?"). Its tools (`ipsy-tools.js`) only read, on the phone, the transactions as
the family sees them (their own categories included): `transactions`, `totals` (by category,
merchant, card, month or week), `recurring`, `cards` (spending, cash back, a better card) and
`context`. Claude answers through `functions/money/api` (POST ipsy, `server/ipsy.js`), with **no web
search**, so nothing about the family's money can end up in a search query; only what a question needs
leaves the phone, and nothing is kept (questions a day are counted, `money:ipsy:<id>:<day>`). It isn't
a financial adviser, and says when Monarch's alert threshold or a bank it can't sync could change an
answer.

### A charge Monarch missed

Some charges never get a Monarch alert (a flight or hotel booking, where the confirmation is the only
email). Asked to find one ("the Frontier flight I booked last week isn't here"), Ipsy can search the
reader's Gmail and add it, with these safety nets (`ipsy-tools.js`: `search_gmail`, `read_email`,
`add_transaction`):

- **Only when asked, only on the reader's phone**: it searches Gmail only when the person asks, and
  only where Money reads Monarch's emails (that phone's Gmail sign-in, read only). On anyone else's
  phone it says so.
- **Only from an email it read, only its own amount**: an addition must come from an email read in
  that chat, and its amount must be written in that email (`$1,052.10`, `1052.10 USD`); a card's last
  four digits are kept only if the email has them too.
- **Only on Yes**: the chat shows exactly what would be added (merchant, amount, date, card, and the
  email it came from) with Yes and No; nothing is added on No. Each addition has Undo, and the reader
  can Remove one later from its transaction sheet.
- **Never twice**: one Money already has (the same amount, in or out, within three days, on the same
  card if both say) isn't added; and if Monarch emails it after all, Monarch's copy stays and the
  found one goes (`calc.js` merge, `sameCharge`).
- Once added it is a transaction like the rest (`src: 'email'`): in every total, and shared with the
  family with the next sync. It isn't sent to Ipsy's daily check (that compares Monarch's emails).
- Emails are material, never instructions: an email that asks for something is ignored. One that
  names an amount still can't be added without the person's Yes on the card showing it.

## Not yet

- No notifications: a bank that stops syncing shows when Money is opened, not on the lock screen.
- Monarch's deposits so far came only inside summaries ("You've received …"); a deposit alert of
  its own hasn't been seen yet: parse.js reads one in the expense alert's shape or the summary's
  words, and its test has made-up ones. Check the first real one.
- When parse.js learns Monarch's words for something new, `READS` in app.js goes up by one: every
  email is then read again once (the merge keeps what's there), so what it missed comes in.
