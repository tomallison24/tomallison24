# Meals

AI first: tell Ipsy what you fancy, and it plans the family's meals. One screen, three tabs:

- **Ipsy** (where it opens): the chat is the app. Ipsy asks what to plan:
  **Breakfast**, **Lunch** and **Dinner** (any of them; Dinner to start) and the
  foods you'd like (chicken, beef, pork, turkey, lamb, fish, shrimp, vegetarian;
  none picked is a mix), with an optional **What's in the fridge?** line. The
  family's rules show under it (**Edit** opens Settings). **Plan it**, and Ipsy
  asks the rest, one question at a time: how many days (1, 3 or a week), how many
  you're cooking for (it remembers the last answer), lunches from the night
  before's leftovers or fresh (only when both lunch and dinner are picked), then
  anything else (a note, e.g. *quick on Tuesday*). **Make it** writes the plan.
  **Or just tell Ipsy** under the questions, and **Change anything…** once a plan
  is waiting, go to the full Ipsy chat, in your own words.
- **Plan**: the plan, a card a day, a row a meal, each with its vegetables,
  protein and minutes, and "From the fridge" or "Leftovers" when it is. A new plan
  comes back **not saved yet**: **Accept plan** (from today, or a day you pick)
  saves it for the family with each day's date; **Try again** makes different
  meals with the same answers; **Discard** drops it. Every accepted plan is kept
  under **Past plans**: the last 52 from the family server, and older ones from
  the family's Google Sheet (**Older plans**, below). Tap a meal for its recipe:
  ingredients and steps, **Loved it** / **Not again** (Ipsy learns from it),
  **Swap** (asks Ipsy for something else) and **Ask Ipsy**. A leftover lunch
  points to the dinner it comes from.
- **List**: everything the plan needs, in the same grocery sections as Notes'
  lists (`../home/aisles.js`), the same ingredient across meals once, staples
  ("You probably have") apart. Tick it off in the store (ticks stay on the
  phone), or copy it into a grocery list in Notes.

**The family's rules** (the gear, Settings), kept for the family: **vegetables**
in every meal (0 to 5, 2 to start), **protein** (Some, 20 g a serving; Good, 30 g;
High, 40 g), how many you usually cook for, and how long a **weeknight** dinner
may take (20 to 60 minutes, or no limit). The owner also sets what the family
never eats (tree nuts and coconut to start; peanuts are fine). **Learned** lists
the recipes rated, to forget one. Then the design, your account, and the
family's **Google Sheet**, the record of every plan (below). The tick (Done)
saves what changed; with nothing changed it just closes.

**Every meal is different**: each gets its own cuisine (and breakfast its own
style), the foods picked take turns, and it stays away from what the family had
lately and what it didn't like. Leftover lunches are made on the server from the
dinner the night before, which is cooked double for them.

**Deals are gone** (aOS2.1): the store sales didn't work well enough, so the
Deals tab, the stores, member cards and sale prices are removed. Plans from before
keep their recipes; the Sheet keeps the deals it had.

## The designs

One app, one plan: the design changes only how Meals looks, at once, and is
kept on this phone (**Settings → Design**, or for every app in aOS, Account →
Appearance → Look). `../home/design.js`, loaded in `<head>`, applies it before
the page is drawn.

- **Vintage** (the default): mid-century modern: a cream ground and cards
  (walnut in dark mode), flat and round-cornered; mustard, teal, burnt orange and
  olive (the tabs have a mustard thumb, the picked chips are mustard, a ticked
  item is a teal disc, a new plan waiting is a mustard-outlined card, Ipsy's
  bubbles are cream); solid burnt-orange main buttons; Futura. Behind the title is
  the shared **Vintage sky** (`../home/sky.js`).
- **Standard**: Sea glass: faint tiles and Liquid Glass sheets, no sky.
- **Night Drive**, **Folk** and **Grid**: made from the Vintage block by
  `node aOS/scripts/make-looks.mjs` (never edited by hand).

How: the Vintage look is the `<style id="vintage">` block after the glass styles
in `index.html`; Standard is that block switched off, with `data-look="glass"` on
`<html>`. The choice is `localStorage` `design.meals`; the Home Screen icon,
status bar and bar colours follow it.

**The old Meals Vintage app** (`mealsvintage/`): its address now opens this same
app (the deploy copies `meals/` there, `.github/workflows/news.yml`), and
`design.js` moves its data on the phone over once. Calls go to `../meals/api/`
(not `api/`), so they work from either address.

## Data

The family's, not one person's: one plan, one set of rules, in the accounts'
Workers KV (`meals:settings`, `meals:taste`, `meals:draft`, `meals:plan`,
`meals:log`, `meals:log:<id>`, `meals:history`; see `server/auth.js`), through
`functions/meals/api`, which only signed-in family can call
(`functions/meals/api/_middleware.js`). The last plan is kept on the phone too
(`allison-meals-v2`), so the list opens in the store with no signal. Needs family
accounts switched on. **Taste** (`meals:taste`): the titles rated Loved it or Not
again (the last 20 of each), fed to the model with every plan. Ipsy keeps only a
count of questions (`meals:ipsy:<user id>:<day>`, gone after two days), and plans a
count a day too. The family's Google Sheet is the record of every plan (below).

Routes: `state`, `settings` (the rules; the foods to avoid only from the owner),
`rate`, `plan`, `accept`, `discard`, `clear`, `current`, and for Ipsy `night`,
`draft`, `unaccept`, plus `log/<id>` and `ipsy`.

## The AI

Plans are written by **Claude Haiku 5.5**, Anthropic's cheapest model, through
Anthropic's API (`ANTHROPIC_API_KEY`, a Pages secret), on the server. A plan is
written in parts of up to 6 meals at once, side by side, so a week of three meals
a day (21) takes about as long as 6. Each part is checked (below) and, if it slips,
sent back once with what was wrong. Until the key is set, Meals opens and shows
the last plan, but it can't plan and says so. `MEALS_MODEL` (optional repository
secret) names another model, `claude-sonnet-5-5` for richer recipes; Settings shows
which is in use.

Roughly what it costs (my estimate from Anthropic's prices of $0.10 per million
tokens in and $0.50 out for Haiku 5.5, not a quote): a meal is a few hundred tokens
out, so a week of dinners is well under 1¢ and a week of three meals a day about
1¢, a little more when a part is sent back. Ipsy's chat uses Sonnet 5.5 and costs
more a question (below).

### The AI key

1. In the Claude Console (platform.claude.com), add some prepaid credit
   (Billing) and make an API key just for aOS, so it can be turned off on its own.
   A monthly spend limit there is a good idea.
2. This repository → Settings → Secrets and variables → Actions → New repository
   secret: `ANTHROPIC_API_KEY`, the key.
3. The next release or News run hands it to the site (`news.yml` puts it as a
   Pages secret); Meals' Settings then shows the model it uses.

## Healthy, and safe

- **Allergies are checked by the server, not just asked of the model.** Every
  meal's title, ingredients and steps are matched word by word against what the
  family avoids ("tree nuts" covers almonds, cashews, pecans, walnuts, pistachios,
  hazelnuts, macadamias, pine nuts, pesto, marzipan and the like; "coconut" any
  coconut). A part that slips goes back to the model once with what it got wrong;
  if it slips again, nothing is saved and Meals says so. It can't see inside
  packaged foods: recipes remind you to check labels.
- **The rules are checked too.** The model gives each meal its vegetables and its
  protein a serving; a meal with fewer vegetables than the rule, or under 85% of
  the protein, goes back once with what was short. These are the model's own
  counts, not a nutrition label: treat the grams as a guide.
- Made by AI: check times and temperatures, as the recipe says.

## Ipsy

**Ipsy** is your helper (the one you picked and named) in the bottom left corner: the full chat about
the family's meals, in the design picked in Settings. The Ipsy tab's questions are
the quick way in; the chat takes anything in your own words, e.g. *What's for
dinner tonight?*, *Swap Thursday's dinner for something quicker*, *A week of
vegetarian dinners for 3*, *What can I make with ground beef?*, *Tick off the
broccoli*.

- **What it can do** (`ipsy-tools.js`): read the family's plan and its recipes,
  the new plan waiting, past plans, the shopping list and the rules; change one
  meal (any day, breakfast, lunch or dinner, on the plan or the plan waiting: it
  writes the whole meal); make a new plan as the Ipsy tab does (meals, foods, days,
  people, lunches, the fridge, a note), accept it or discard it; tick items off the
  list; open a recipe on the screen. It also searches the web and reads pages.
- **The allergy rules come first.** Its instructions say to check what the family
  never eats before it suggests or writes any dish. That doesn't rely on Ipsy:
  **every meal it saves goes through the server's own check**, the one every plan
  goes through. The family's allergies and rules are read-only to Ipsy (Settings).
- **The family's, so everyone sees it**: what Ipsy changes, everyone signed in
  sees, and it goes to the family's Google Sheet like any other change.
- **Asked first for a whole plan.** One meal changes without asking (it shows with
  Undo). Making a new plan in place of one waiting, accepting and discarding ask
  first, with a Yes / No card in the chat.
- **Every change shows in the chat with Undo**, for as long as the app stays open;
  Undo puts it back on the family server, unless someone in the family changed it
  since (then it says so).
- **Only through the app's own server routes**: `plan`, `accept`, `discard`, plus
  `night` (one meal, checked like a plan; a changed dinner also changes the
  leftover lunch after it), `draft` (a plan put back as it was, for Undo) and
  `unaccept` (Undo of an accept).
- **How it works.** The chat lives on the phone. Each step sends the conversation
  to the family server (`POST ipsy`), which adds Ipsy's instructions and tools and
  asks **Claude Sonnet 5.5**; Meals' tools run on the phone. Plans Ipsy asks for
  are still written by Meals' own model. `MEALS_IPSY_MODEL` (optional) names
  another model for Ipsy. Before the first question, Ipsy says what is sent where;
  the server keeps only a count of questions (80 a person a day).
- **Web pages are read, never obeyed**, and a recipe it finds still has to pass
  the allergy check.
- **Limits.** Ipsy can't add things to the shopping list (it comes from the plan;
  **Copy the list** puts it in Notes) or change Past plans other than the current
  one.
- **Not tried against the real API**: the tests use a stand-in for Claude, so the
  first real plans are the real test of the instructions.

## The family's Google Sheet

One Sheet for the family, the **record of the family's dinners**: every plan ever accepted (and who planned it), the
shopping list and the family's rules (and the deals of the weeks before they were removed). It works the way every aOS app's Sheet does
(`aOS/SHEETS.md`), in `family` mode: the dinners are the family's, so everyone signed in sees all of it (Meals has no
"Just me" items).

**Two copies, one record.** The family server (Data, above) stays the working copy: Claude plans against it, and the
phones use it for this week's plan and the list. Meals copies all of it to the Sheet, which keeps every plan
for good; the server keeps only the last 52. So Meals also **reads from the Sheet** what the server no longer has:

- **Past plans** shows the server's 52, then any plan the Sheet holds that the server doesn't: the last 90 days of
  plans come back with every sync.
- **Past plans → Older plans** asks the Sheet for the year before (a `range` of days; if a year has none, everything
  before it at once), until there are no older ones. Each opens with its dinners, recipes and shopping list, as any past
  plan does.

**It syncs by itself, through aOS, signed in.** The owner sets the Sheet up in **aOS → Account → Google Sheets** (the
link and phrase, once), so Meals' Settings have nothing about it: no status, no Sync now, no form, setup link or
Disconnect. No phone holds the Sheet's link or phrase; every sync goes through aOS's `/sheet/api/meals`
(`../home/sheet.js`) with your family session, which adds who's asking. Signed out, Meals still shows what the family
server has, and sends nothing. A phone that kept the old link and phrase (`allison-meals-v1-sheet`, its IndexedDB copy in `allison-meals`,
or a `#sync=` setup link opened in Meals) hands them to aOS once on the owner's phone, and forgets them on every phone
once aOS has one.

**When it syncs**: a couple of seconds after the app opens or comes back to the front, after a plan is accepted or
discarded, after settings are saved, after Ipsy changes something, and when the phone
comes back online. A sync goes only when something changed since the last one. It sends the current plan,
the shopping list, the settings and any plan taken back (below); the Sheet answers with the plans of the last 90 days
and the ids of every plan it holds, and the phone then sends any of the server's 52 the Sheet lacks, each fetched whole
once.

**How copies merge.** Each plan is a picture of the family server, stamped with when the
phone read it from there, so the newest picture wins, and the same picture again changes nothing. A plan **taken back**
(Ipsy's Undo of an accept) goes to the Sheet as a short record in `_deleted`, so it leaves Plans and a phone that still
has it doesn't bring it back. Edits made in the Sheet itself are overwritten: change things in Meals.

The tabs:
- **Plans**: one row per planned night, for **every plan ever accepted**, newest first. **Planned by** comes first (who
  accepted it, as the family server recorded it from their sign-in; for a plan without that, whose row it is), then the
  date accepted, the plan, night number, date, dinner, cuisine, method, minutes, store, people, why, what's on sale in
  it, ingredients, steps, tip, and the plan's id. Since aOS2.1 a breakfast or lunch is its own row, its dinner column
  starting "Breakfast: " or "Lunch: "; leftover lunches aren't sent (the dinner before has the recipe). The Sheet's
  script keeps 14 rows a plan; paste the updated [`google-sheet-sync.gs`](google-sheet-sync.gs) to keep 21 (a week of
  three meals a day).
- **Shopping list**: the current plan's list as the List tab shows it, in the same sections, with how much, which
  nights, the sale price, and the staples ("You probably have") at the end. A picture of the latest copy.
- **Deals**: from before deals were removed: each store's deals by week (the last 8 weeks are kept), with **Who** (whose phone first sent that week),
  the store, price, usual price, member price and note.
- **Settings**: the family's rules (in the Stores row: vegetables and protein, how many you cook for, the weeknight limit), the foods the family avoids, and the AI model. A picture of the latest copy.
- Hidden tabs the readable ones are rebuilt from: `_plans` and `_deals` (one row per item, as JSON, each with `by`,
  whose it is), `_deleted` and `_people` (each person's first name, for the Who columns, and the owner). A **Meals**
  menu in the Sheet rebuilds the tabs.

Rows from before aOS (the old one-way script) become the owner's the first time the owner syncs; their Planned by stays
whoever accepted them.

**Setting it up** (the owner, once): paste the new [`google-sheet-sync.gs`](google-sheet-sync.gs) into the Meals Sheet's
Apps Script (keeping your `SECRET` line), deploy a new version, then open Meals signed in (it hands over the link and
phrase it had) or give aOS the phrase in **Account → Google Sheets**. Then change the phrase. Full steps:
`aOS/SHEETS.md`, "Setting it up".

**Errors** say what to do, in one toast a session at most, and none while you're signed out or the Sheet isn't set up in
aOS yet (the owner sets it up there; nobody else is asked): aOS's phrase no longer matches the script, the Sheet still has its old script, `SECRET` still `CHANGE-ME`,
the Sheet was busy, couldn't reach it, or it didn't answer as expected. Tests: `meals/scripts/sheet-test.mjs` (the
script on a fake Sheet), and steps in `app-test.mjs` and `ipsy-test.mjs` (what the app sends, reads back and shows).

## Tests

```
node meals/scripts/api-test.mjs     # the server: sign-in, the rules, what each meal is asked for, parts side by side, leftover lunches, the rules and the allergy check sent back once, taste, and Ipsy's step and routes
node meals/scripts/logic-test.mjs   # sections, the shopping list, amounts
node meals/scripts/sheet-test.mjs   # google-sheet-sync.gs on an in-memory Sheet (drinks/scripts/fake-sheet.mjs): who gets in, whose rows, Planned by and Who, rows from before aOS, the 90 days and range, newest copy, a plan taken back
node meals/scripts/app-test.mjs     # the app at iPhone size, against the real server code and a stand-in AI: the Ipsy tab's questions, a plan, a recipe, the list, the rules, the family's Google Sheet through a stand-in for aOS, both designs, Settings > Design, the old Meals Vintage address
node meals/scripts/ipsy-test.mjs    # Ipsy in both designs, light and dark, on the real server code with a stand-in Claude: every tool, the allergy check, ask-first, Undo, its changes reaching the Sheet
node meals/scripts/make-icons.mjs   # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```
