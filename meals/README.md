# Meals

Dinner for the family, for less. One screen, three tabs:

- **Dinners**: this week's plan. Tap **+**, pick a meat (or "Whatever's on
  sale"), how many nights and people, and whether to use this week's deals.
  Meals plans that many different dinners: every night a different cuisine
  and way of cooking, and different from what the family had lately. Tap a
  night for its recipe: ingredients (with what's on sale) and steps.
- **Deals**: this week's sales at the family's Whole Foods (Waverly Place,
  Cary, to start; Prime prices), sorted into the same grocery sections as
  Notes' grocery lists (`../home/aisles.js`). **Find this week's deals** asks
  the AI to search the web for them; **Paste deals** reads them out of text
  copied from the Whole Foods app or website. Sales run Wednesday to Tuesday.
- **List**: everything the plan needs, in those sections, the same ingredient
  across nights once, with the sale price where it's on sale and staples
  ("You probably have") apart. Tick it off in the store (ticks stay on the
  phone), or copy it into a grocery list in Notes.

The gear: the store, Prime or everyone's prices, what the family never eats
(tree nuts and coconut to start; peanuts are fine), and your account.

## Data

The family's, not one person's: one plan, one deals list and one set of
settings, in the accounts' Workers KV (`meals:settings`, `meals:deals`,
`meals:plan`, `meals:history`; see `server/auth.js`), through
`functions/meals/api`, which only signed-in family can call
(`functions/meals/api/_middleware.js`). The last plan and deals are kept on
the phone too (`allison-meals-v1`), so the list opens in the store with no
signal. Needs family accounts switched on.

## The AI

Plans and deals are made by Claude Sonnet 5.5, on the server, through either:

- **Perplexity's Agent API** (`PERPLEXITY_API_KEY`), which offers Claude at
  Anthropic's prices, with its own web search; or
- **Anthropic's API** (`ANTHROPIC_API_KEY`), with Anthropic's web search tool.

If both are set, Perplexity is used. `MEALS_MODEL` (optional) names another
model. Until one is set, Meals opens and shows the last plan, but its buttons
are off and it says so.

Roughly what it costs (October 2026 prices, my estimate, not a quote): a
4-night plan is a few thousand tokens, about $0.04 on Sonnet 5.5; finding the
week's deals adds a few web searches (Perplexity $0.0025 each, Anthropic 1¢
each). A month of weekly deals and a few plans a week is under $1. A week's
deals are kept, so asking again costs nothing; Look again waits 10 minutes.

### The AI key

1. Make an API key just for aOS, so it can be turned off on its own:
   Perplexity (your account's API page) or Anthropic (the Claude Console's
   API keys).
   Setting a monthly spend limit there is a good idea.
2. This repository → Settings → Secrets and variables → Actions → New
   repository secret: `PERPLEXITY_API_KEY` (or `ANTHROPIC_API_KEY`), the key.
3. The next release or News run hands it to the site (`news.yml` puts it as a
   Pages secret); Meals' gear then shows which AI it uses.

## Safety

- **Allergies are checked by the server, not just asked of the model.** Every
  plan's titles, ingredients and steps are matched word by word against what
  the family avoids ("tree nuts" covers almonds, cashews, pecans, walnuts,
  pistachios, hazelnuts, macadamias, pine nuts, pesto, marzipan and the like;
  "coconut" any coconut). A plan that slips goes back to the model once with
  what it got wrong; if it slips again, nothing is saved and Meals says so.
  It can't see inside packaged foods: recipes remind you to check labels.
- **Whole Foods' terms** (Amazon's Conditions of Use) don't allow robots or
  collecting prices from their site, so Meals never fetches it: the deals
  come from the AI's own web search, or from text you paste.
- Made by AI: check times and temperatures, as the recipe says.

## Tests

```
node meals/scripts/api-test.mjs     # the server: sign-in, both AI services (stand-ins), deals, plans, the allergy check
node meals/scripts/logic-test.mjs   # sections, the shopping list, matching sales, the week
node meals/scripts/app-test.mjs     # the app at iPhone size, against the real server code and a stand-in AI
node meals/scripts/make-icons.mjs   # icon-512.png and icon-180.png from icon.svg
```
