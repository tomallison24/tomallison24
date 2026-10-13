# Meals

Dinner for the family, for less. One screen, three tabs:

- **Dinners**: this week's plan. Tap **+**, pick a meat (or "Whatever's on
  sale"), how many nights and people, where to shop (one store, or **Best
  deals, any store**: each sale item then says where it is), and whether to use
  this week's deals. The plan comes back **not saved yet**: **Accept plan**
  (from today, or a day you pick) saves it for the family with each night's
  date and the sale prices it was planned with, so its shopping list stays as
  it was; **Try again** makes different dinners; **Discard** drops it. Every
  accepted plan is kept under **Past plans** (the last 52), each opening to its
  dinners, recipes and shopping list - as Fitness keeps every workout.
  Meals plans that many different dinners: every night a different cuisine
  and way of cooking, and different from what the family had lately. Tap a
  night for its recipe: ingredients (with what's on sale) and steps.
- **Deals**: this week's sales at the family's stores near Apex: Whole Foods
  (Waverly Place), Harris Teeter, Publix, Lidl, Lowes Foods, Aldi, Walmart and
  Target. Pick one from the **Store** menu, or **All my stores** to see them
  together (the same item at different stores side by side). Each sorts into
  the same grocery sections as Notes' grocery lists (`../home/aisles.js`).
  **Find this week's deals** asks the AI to search the web for that store's
  weekly ad; **Find deals at the rest** does every store still missing this
  week's; **Paste deals** reads them out of text copied from the store's app or
  website. Member prices show for the cards the family has (Prime at Whole
  Foods, VIC at Harris Teeter). Sales usually run Wednesday to Tuesday.
- **List**: everything the plan needs, in those sections, the same ingredient
  across nights once, with the sale price where it's on sale and staples
  ("You probably have") apart. Tick it off in the store (ticks stay on the
  phone), or copy it into a grocery list in Notes.

The gear: which stores to follow, the family's member cards (Prime, VIC), what
the family never eats (tree nuts and coconut to start; peanuts are fine), your
account, and an optional **Google Sheet** that keeps a readable copy of it all
(below).

**Meals Vintage** is the same app in a mid-century modern look, as its own app
([`mealsvintage/`](../mealsvintage/README.md)). It uses this app's server route
and the same Google Sheet script, so a plan made in either shows in both.

## Data

The family's, not one person's: one plan, one deals list a store and one set
of settings, in the accounts' Workers KV (`meals:settings`,
`meals:deals:<store>`, `meals:draft`, `meals:plan`, `meals:log`, `meals:log:<id>`,
`meals:history`; see `server/auth.js`), through
`functions/meals/api`, which only signed-in family can call
(`functions/meals/api/_middleware.js`). The last plan and deals are kept on
the phone too (`allison-meals-v2`), so the list opens in the store with no
signal. Needs family accounts switched on.

## The AI

Plans and deals are made by Claude Haiku 5.5, Anthropic's cheapest model,
through Anthropic's API (`ANTHROPIC_API_KEY`, a Pages secret), on the server;
the deals search is Anthropic's web search tool, set near Cary. Until the key
is set, Meals opens and shows the last plan, but its buttons are off and it
says so. A repository secret `MEALS_MODEL` (optional) names another model,
`claude-sonnet-5-5` for richer recipes; the gear shows which is in use.

Roughly what it costs (Anthropic's October 2026 prices; my estimate, not a
quote): Haiku 5.5 is $0.10 per million tokens in and $0.50 out, so a 4-night
plan (a few thousand tokens) is well under 1¢. Finding the week's deals is up
to 5 web searches at 1¢ each, plus the pages they read: about 2 to 4¢ a store. Every store's deals each week and a few plans a week is about $1 a month. A week's deals are kept,
so asking again costs nothing; Look again waits 10 minutes. Haiku 5.5 costs
five times as much on a prompt of over 100,000 tokens, which is why the search
is held to 5 searches a store.

### The AI key

1. In the Claude Console (platform.claude.com), add some prepaid credit
   (Billing) and make an API key just for aOS (API keys), so it can be turned
   off on its own. Setting a monthly spend limit there is a good idea.
2. This repository → Settings → Secrets and variables → Actions → New
   repository secret: `ANTHROPIC_API_KEY`, the key.
3. The next release or News run hands it to the site (`news.yml` puts it as a
   Pages secret); Meals' gear then shows the model it uses.

## Safety

- **Allergies are checked by the server, not just asked of the model.** Every
  plan's titles, ingredients and steps are matched word by word against what
  the family avoids ("tree nuts" covers almonds, cashews, pecans, walnuts,
  pistachios, hazelnuts, macadamias, pine nuts, pesto, marzipan and the like;
  "coconut" any coconut). A plan that slips goes back to the model once with
  what it got wrong; if it slips again, nothing is saved and Meals says so.
  It can't see inside packaged foods: recipes remind you to check labels.
- **How the deals are found.** Stores' own weekly-ad pages load their items in a
  way web search can't read, so the search looks for pages that write the week's
  ad out item by item: deal blogs and weekly-ad previews (Southern Savers for
  Harris Teeter, coupon sites for Publix, and so on). Meals never fetches a
  store's own site (Whole Foods' terms, Amazon's Conditions of Use, don't allow
  robots or collecting prices, and others are similar). The first live checks
  (Oct 7–13, 2026): Harris Teeter 21 deals, Publix 10, Whole Foods mostly its
  standing Prime offers - for Whole Foods, **Paste deals** from its app works
  better. Check prices in the store: the pages they come from can be wrong.
- **Meals check** (Actions → Meals check → Run workflow, a store id) runs one
  real search with the key and shows what it found, where, and what it cost
  (`scripts/deals-live.mjs`); it saves nothing.
- Made by AI: check times and temperatures, as the recipe says.

## Google Sheet

Optional. **Gear → Google Sheet** keeps a **readable copy** of Meals in a Google Sheet. It goes **one way**: Meals
writes, nothing is read back, so nothing typed in the Sheet comes back (and anything you change in the Deals, Shopping
list or Settings tabs is replaced the next time the app sends). The family's plans, deals and settings are already
kept in the family account; the Sheet is a copy you can read, filter and keep. It is the family's, like the data: it
stays connected for whoever signs in on that phone, and **Disconnect this phone** only forgets the link on that phone.

The tabs:
- **Plans**: one row per planned night, for **every plan ever accepted**, newest first (date accepted, the plan, night
  number, date, dinner, cuisine, method, minutes, store, people, planned by, why, what's on sale in it, ingredients,
  steps, tip, and the plan's id). Meals itself keeps only the last 52 plans; **Plans never drops one**, so it grows
  for good. A plan is only ever added (a plan the app has dropped stays).
- **Shopping list**: the current plan's list as the List tab shows it, in the same sections, with how much, which nights,
  the sale price, and the staples ("You probably have") at the end. It is a picture of the latest copy.
- **Deals**: each store's deals by week (the last 8 weeks are kept), with the store, price, usual price, member price
  and note.
- **Settings**: the stores, member cards and foods the family avoids, and the AI model. A picture of the latest copy.
- Two hidden tabs (`_plans`, `_deals`) that the readable tabs are rebuilt from, and a **Meals** menu in the Sheet
  (**Rebuild Plans tab**).

1. [sheets.new](https://sheets.new) → name it, e.g. **AllisonOS - Meals**.
2. **Extensions → Apps Script**, replace `Code.gs` with the whole of [`google-sheet-sync.gs`](google-sheet-sync.gs),
   and change `const SECRET = 'CHANGE-ME';` to a long phrase of your own (you make it up: there is nothing to look up).
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone* → **Deploy** → authorise →
   copy the **Web app URL**.
4. Meals → **gear → Google Sheet** → the link is already filled in (`SHEET_URL` in `app.js`: the owner's Sheet; to use
   another, paste its URL over it) → type the phrase → **Connect and sync**. The phrase is never in the code. **Copy
   setup link** sets up your other phone.

**When it syncs**: when you connect, a couple of seconds after the app is opened or comes back to the front, after a
plan is accepted or discarded, after deals are found or pasted, after settings are saved, and when the phone comes back
online (**Sync now** does it by hand). The app sends only when it is connected and something changed since the last
copy. The first time (for a link it has not sent to), it fetches each past plan whole (at most 52, three at a time),
remembers which it has sent (`allison-meals-v1-sheet-sent`), and after that sends only the current plan and any new one.
The link and code are kept in `allison-meals-v1-sheet` and a backup copy in IndexedDB (`allison-meals`), so a phone
that lost its storage reconnects by itself.

**Errors** are named in the form: the secret doesn't match, an old copy of the script, `SECRET` still `CHANGE-ME`, the
Sheet was busy, the Sheet didn't understand the request, couldn't reach the Sheet, the link didn't answer like the Meals
script, and another AllisonOS app's Sheet link. Its test is `meals/scripts/sheet-test.mjs` (the script on a fake Sheet)
and a step in `app-test.mjs` (what the app sends).

## Tests

```
node meals/scripts/api-test.mjs     # the server: sign-in, both AI services (stand-ins), deals, plans, the allergy check
node meals/scripts/logic-test.mjs   # sections, the shopping list, matching sales, the week
node meals/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (drinks/scripts/fake-sheet.mjs)
node meals/scripts/app-test.mjs     # the app at iPhone size, against the real server code and a stand-in AI, and the Google Sheet copy
node meals/scripts/make-icons.mjs   # icon-512.png and icon-180.png from icon.svg
```
