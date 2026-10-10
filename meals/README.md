# Meals

Dinner for the family, for less. One screen, three tabs:

- **Dinners**: this week's plan. Tap **+**, pick a meat (or "Whatever's on
  sale"), how many nights and people, where to shop (one store, or **Best
  deals, any store**: each sale item then says where it is), and whether to use
  this week's deals.
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
the family never eats (tree nuts and coconut to start; peanuts are fine), and
your account.

## Data

The family's, not one person's: one plan, one deals list a store and one set
of settings, in the accounts' Workers KV (`meals:settings`,
`meals:deals:<store>`, `meals:plan`, `meals:history`; see `server/auth.js`), through
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

## Tests

```
node meals/scripts/api-test.mjs     # the server: sign-in, both AI services (stand-ins), deals, plans, the allergy check
node meals/scripts/logic-test.mjs   # sections, the shopping list, matching sales, the week
node meals/scripts/app-test.mjs     # the app at iPhone size, against the real server code and a stand-in AI
node meals/scripts/make-icons.mjs   # icon-512.png and icon-180.png from icon.svg
```
