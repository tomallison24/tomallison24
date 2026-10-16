# News

Latest headlines by topic (AI, Business, Science, Sport, Stem cells, Tech, UK, US, World) as a
home-screen web app, light and dark, in two designs: Vintage (mid-century modern, the default)
or Standard (Sea glass, frosted glass), picked in Settings (below).

- **Data:** the RSS and Atom feeds listed in `feeds.json`.
  `scripts/fetch-news.mjs` reads them into `data/news.json`, the only file of
  headlines the app loads (as `../news/data/news.json`, so it is the same file
  from the old News Vintage address). News sites don't allow browsers on other sites to read
  their feeds (CORS), so the feeds are fetched ahead of time instead. No API
  keys needed.
- **Updates:** `.github/workflows/news.yml` re-fetches the feeds and
  publishes the site to Cloudflare Pages: on every merge, and every 30 minutes
  once the News tick is set up (below; GitHub's own schedule manages only every
  few hours). `data/` is generated, not committed. If every feed fails, the
  last run's headlines are published unchanged.
- **No build step** for the app itself: `index.html` and `app.js` are the whole app (the script in a file of its own, so the page's Content-Security-Policy allows only this site's scripts);
  `sw.js` keeps it working offline, and the last headlines are kept in
  `localStorage`.
- **Tapping a story** opens the full article on the publisher's site.
- **Liquid Glass** (the Standard design), as in iOS 26 and the Calendar app: the Sport filters and
  Sources panels float as clear glass sheets, the My teams and league pills and
  News | Scores are frosted glass with a lit rim, and every switch (News | Scores,
  the time range) has a bright
  glass thumb that slides to what you pick, its label in the accent colour
  (`../home/slide.js`, shared by the apps). The Undo toast is the same clear
  glass as the sheets, and Try again is tinted slate-teal glass.
- **Topic picker:** a glass pill at the bottom of the screen, the same as
  Home's view picker: the chosen topic's icon and name with a chevron. Tap it
  and the topics open upwards as a menu; swiping the stories sideways moves
  between them too.
- **Newest first** on every tab. The top story is shown large when it has
  a picture; an older story with a picture never jumps ahead of it.

## The two designs

One app, one set of headlines and scores: the design changes only how News
looks, at once, and is kept on this phone (**Settings → Design**: the gear by
Refresh, the first and only section of its sheet), as in Clock.
`../home/design.js`, loaded in `<head>`, applies it before the page is drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Meals and Clock:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass and the drifting colour fields;
  - mustard, teal, burnt orange and olive: News | Scores and the time range
    have a mustard thumb, the topic picker has a mustard disc round its icon,
    a game's home side is teal and the away side orange, the shot map's pitch
    is olive, and each topic has its own dot (brick, teal, denim, mustard,
    walnut, plum, olive, pumpkin and rose, each lighter in dark mode: the
    `--tc-*` colours, which `app.js` falls back from to Standard's own);
  - three atomic shapes behind the title (a mustard sun, a teal dot and an
    orange pill) that scroll away with the page, and three little bars under
    it; the Vintage icon (`icon.svg`) beside the title;
  - solid burnt-orange buttons (Show N stories, Try again, the send arrow);
    outlined teal ones (Reset, the sparkle on a story); Futura, which iOS has
    built in, so no font is downloaded.

  Football's yellow and red cards, and the colours ESPN gives a table's zones
  (Champions League, relegation), stay as they are: they say something.

  **The sky.** Behind the title is the shared Vintage sky (`../home/sky.js`,
  as in every Vintage design): by day a ground washed with mustard, the sun
  and rays that turn very slowly; after sunset deep teal, the moon and
  twinkling stars; each over cream (Light) or walnut (Dark). Sunrise and
  sunset are for the phone's place (only if the app already has location
  permission: it never asks), else its time zone. It holds still with reduced
  motion. This app only gives its disc its colour (`--sky-disc`) and keeps its
  own sizes and places for the shapes, tuned to its header.
- **Standard**: Sea glass: the frosted glass, Liquid Glass sheets and
  drifting colour fields described above, the Sea glass icon
  (`icon-glass.svg`) beside the title, no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. The choice is `localStorage` `design.news`. What iOS reads when News is
added to the Home Screen follows it: the icon (`icon-180.png`, Vintage: a cream
front page on olive with a mustard sun and a burnt-orange pill;
`icon-glass-180.png`, Standard), the status bar style (`default` in Vintage,
where `black-translucent`'s white clock would vanish on the cream) and the bar
colours. Only colours, shapes and type change: every tap, sheet and swipe
works the same in both.

**The old News Vintage app.** News Vintage used to be an app of its own
(`newsvintage/`, with its own storage). Its address now opens this same app
(the deploy copies `news/` there, `.github/workflows/news.yml`), so a phone
that added it keeps it. The first time it opens there, `design.js` moves that
app's data on the phone over to News' names (`newsv.…` → `news.…`: the last
headlines and scores, the topic, the Sport filters and your teams, the
leagues, the tables and the Stem cells filters; and what it had seen, so no
walkthrough again), unless News already has data on that phone; nothing old is
deleted. It had no IndexedDB, sessionStorage or cookies of its own. Its files
and calls are named from News' side (`../news/data/`, `../news/sport-catalog.json`,
`../news/leagues.json`, `../news/api/`), so from either address it reads the
one copy of the headlines and reaches the family's summaries route.

## Summaries

Tap the sparkle at the end of a story's source line for **Claude's summary of
that story**: two sentences, three to five bullet points of key takeaways, a
link to the full article, and a box to **ask questions about it** (three
one-tap questions to start: why it matters, what happens next, who is
affected). Follow-ups remember what was asked before.

- **How:** `functions/news/api` (`/news/api/summarize` and `/news/api/ask`)
  reads the story's own page, finds its text among the menus and scripts, and
  asks Claude to summarise it or answer from it, through Anthropic's API. The
  app sends only the story's address, and the server only reads an address that
  is in the published headlines, so it can't be pointed anywhere else.
- **Paywalls and pages that need scripts:** if the page won't load, the summary
  is made from the headline and the feed's short description, and says so. A very
  long article is read up to about 60,000 characters, and says so.
- **Who:** signed-in family only (Face ID, like Meals), as every call costs a little.
  Each person gets at most 60 summaries and questions a day, and a story's summary is kept
  for a week for the whole family, so a second reader of the same story is free.
- **The key:** the same `ANTHROPIC_API_KEY` repository secret as Meals (`meals/README.md`,
  "The AI key"); until it is there the sheet says so. The model is Claude Opus 5.5 at low
  effort. To use another (`claude-haiku-5-5` is the cheapest), add a repository secret
  `NEWS_AI_MODEL`. Science stories (Stem cells) can set off Claude's safety classifiers, so
  the request asks Anthropic for its server-side fallbacks, and a story Claude still
  won't read says so.
- **Tested** with stand-ins for Anthropic's API and the publisher's page
  (`scripts/ai-test.mjs`), not against the live API: the first real summary is the
  real check.

## Ipsy

**Ipsy** is the little stem cell in the bottom left corner: a helper you chat
with about the news and sport, in the design picked in Settings (mustard, teal
and cream in Vintage, pastel glass in Standard; it changes with the design at
once). It sits clear of the topic picker, Refresh, Settings and the Undo toast,
and the end of every list scrolls above it. Ask in your own words, e.g. *What
are the top stories today?*, *What does the BBC say about the budget?*, *Sum up
the library story*, *How did Liverpool get on?*, *Show me the Premier League
table*, *Follow Arsenal*, *Only Nature on Stem cells this week*. It sits beside
the sparkle on each story (Summaries, above), not instead of it.

- **What it can do** (`ipsy-tools.js`, on the phone): find stories in the
  published headlines by words, topic, source or day, and read their details;
  summarize one through the same summaries route the sparkle uses (so only a
  story in the published headlines is read, and a summary the family already
  made is free); today's scores, the fixtures coming up and a league's table,
  from ESPN as the Sport tab reads them (a team, a league, or the teams you
  follow); show a story (its tab, scrolled to it and marked, or its summary) or
  a Sport view, league or match page on screen behind the chat. For anything
  newer, or not in News, it searches the web and reads pages, and says that it did.
- **What it changes**, only on this phone and only what you could change
  yourself: the sports, teams and keywords you follow (Sport filters), the
  one-tap team, and Stem cells' source and time filters. It does what you ask
  without asking first; **each change shows in the chat with Undo**, for as long
  as the app stays open. Everything else it only reads.
- **Where its answers come from.** It answers from News' own headlines first
  and says which source a story is from; scores and tables are ESPN's, with how
  fresh they are (and when they're the saved copy). It reports what stories say,
  neutrally, and doesn't add its own view.
- **How it works.** The chat lives on the phone (`../home/ipsy.js`, shared by
  every app with Ipsy). Each step sends the whole conversation to the family
  server (`functions/news/api`, `POST ipsy`, `server/ipsy.js`), which adds
  Ipsy's instructions and tools and asks **Claude Sonnet 5.5** (medium effort,
  prompt caching on, Anthropic's server-side fallback if it declines). When
  Claude asks for one of News' tools, it runs on the phone, against the same
  headlines, scores and tables the app shows, and the result goes back with the
  next step. Web search and web pages run at Anthropic. `NEWS_IPSY_MODEL`
  (optional repository secret) names another model; `NEWS_AI_MODEL` still sets
  the summaries' model on its own.
- **Asked first, once.** Before the first question, Ipsy says what is sent
  where: your question and whatever it looks at to answer it (the headlines,
  scores and tables, and the teams you follow) go to Claude through the family
  server. The server keeps only a count of questions (80 a person a day, counted
  apart from the 60 summaries; the steps a question takes aren't counted). A
  summary Ipsy asks for counts toward the summaries' 60, like a tap on the sparkle.
- **For signed-in family** (Face ID), like the summaries. Without the key it
  says Ipsy isn't set up.
- **Web pages and stories are read, never obeyed**: Ipsy is told they are
  material, not instructions, and to say so when one asks it to do something.
- **New chat** (top of the chat) starts over; a chat is kept on the phone until
  then (a very long one stops at about 1 MB and asks for a new chat).
- **Limits.** It can't open a publisher's page for you (a page can only be
  opened by a tap): it shows the story in its list or its summary, which has the
  link. Only football and rugby games have a match page. It knows only the
  leagues in `leagues.json` and the stories in today's headlines; for anything
  else it goes to the web.
- **Not tried against the real API or on a phone**: the tests use a stand-in
  for Claude, ESPN and the summaries route (`node news/scripts/ipsy-test.mjs`,
  and the `ipsy:` tests in `node news/scripts/ai-test.mjs`), so the first real
  questions are the real test of the instructions.

## Refreshing every 30 minutes

`news.yml` has a schedule (:15 and :45 past each hour), but GitHub runs
scheduled workflows when it has room: in practice every few hours. The News
tick, a small Cloudflare Worker (`tick/worker.js`), fires on time at :15 and
:45 and starts the News workflow itself (as Run workflow in the Actions tab
would), unless a News run already started in the last 20 minutes.
`.github/workflows/news-tick.yml` deploys it; it needs a GitHub token:

1. GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token. Repository access: only
   `tomallison24/tomallison24`. Permissions: **Actions: Read and write**
   (Metadata: Read-only comes with it). Pick the longest expiry offered, and
   note the date: News falls back to GitHub's schedule when it runs out.
2. This repository → Settings → Secrets and variables → Actions → New
   repository secret: `NEWS_TICK_TOKEN`, the token.
3. Actions → News tick → Run workflow. It uses the Cloudflare token the site
   already has (allowed to edit Workers, as for Notes' reminders).

To renew the token, update the secret and run News tick again. Test the
Worker with `node news/scripts/tick-test.mjs`.

## Sources

Only sources that are free to read are included, and only through their own
public feeds, with one exception: on Stem cells, the journals (Nature, Cell,
Science and their sister journals) are there by request, and many of their
papers need a subscription (Stem Cell Reports, npj Regenerative Medicine and
the Europe PMC papers are open access):

| Topic    | Sources |
|----------|---------|
| UK       | BBC News, The Guardian, Sky News |
| World    | BBC News, The Guardian, Sky News, Al Jazeera, NPR, ABC News, CBS News |
| US       | BBC News, The Guardian, Sky News, NPR (news and politics), PBS News (headlines and politics), ABC News (US and politics), CBS News (US and politics), The Hill |
| Business | BBC News, The Guardian, Sky News, NPR, ABC News, CBS News MoneyWatch |
| Tech     | BBC News, The Guardian, Sky News, NPR, Ars Technica, ABC News, CBS News, Engadget |
| AI       | The Guardian, Ars Technica, TechCrunch, plus any story from the other feeds with AI in its headline (AI stories are taken out of Tech) |
| Science  | BBC News, The Guardian, NPR, ScienceDaily, The Conversation, CBS News, NASA |
| Stem cells | Journals: Nature, Nature Neuroscience, Nature Cell Biology, Nature Biotechnology, Nature Medicine, npj Regenerative Medicine, Nature Portfolio's stem cell subject feeds, Cell, Cell Stem Cell, Stem Cell Reports, Developmental Cell, Science, Development. News: STEMCELL Science News (its ESC & iPSC, Organoid, Mesenchymal, Hematopoiesis, Cancer Stem Cell, Neural, Intestinal, Cell Therapy and Muscle newsletters), The Niche, ScienceDaily. Open-access papers and preprints (bioRxiv, medRxiv) via Europe PMC, plus matching stories from the other topics. Only stem cell stories are kept (pluripotent/iPSC/hESC, organoids, embryo models, mesenchymal and haematopoietic stem cells and any other "stem cell" mention), for up to 30 days; journals and newsletters that only cover stem cells (Cell Stem Cell, Stem Cell Reports, the subject feeds, ESC & iPSC, Organoid, Mesenchymal) are kept whole. Correction and retraction notices are left out. Up to 100 stories, newest first. Stories published today have a **New** tag, which goes once the day is over (at midnight if the app is open). Journals give papers a date but no time, so those show as Today, Yesterday or a date, and count as new on that date. See "Duplicates" below |
| Sport    | BBC Sport, The Guardian, Sky Sports (general feeds plus one per sport), CBS Sports, Yahoo Sports |

Not included:

- **Reuters** has had a paywall since October 2024 and stopped publishing RSS
  feeds in 2020.
- **Associated Press** is free to read but has no official RSS feed.
- **CNN** has had a metered paywall since October 2024.
- **NBC News** and **CNBC** were reported in 2026 to have put much of their
  reporting behind a paywall.
- **Politico** asks for sign-up after 10 articles, and **Axios** needs an
  account to read.
- **Space.com**'s feed returned no stories when tested.
- **BBC News** is free in the UK. Since mid-2025, readers in the US hit a
  paywall after reading a certain amount. Remove the BBC lines from
  `feeds.json` if that matters where you read.

## Duplicates

Every topic shows each story once, however many feeds carry it. Two
stories count as the same when they have:

- the same link (BBC's UK and World feeds, a paper moving from a journal's
  "in press" list to its current issue),
- the same DOI (a Cell Stem Cell paper from the journal's feed and from
  Europe PMC), or
- the same headline, ignoring case, punctuation and accents (a STEMCELL
  Science News item that reuses the paper's title). Headlines under 4 words
  only match by link, so each "Tech Life" episode still shows.

Stem cells (`"fuzzyDedupe"` in `feeds.json`) also merges near-identical
headlines, which catches most preprints once they're published: 75% of their
words the same, headlines of 6 or more words only. It is strict on purpose;
news write-ups of a paper under a different headline still show separately.

The copy kept is the publisher's own: a journal or news site beats Nature's
subject feeds and Europe PMC, which beat STEMCELL Science News (a summary
that links on to the paper), which beats a preprint (each feed's `"rank"` in
`feeds.json`; lower wins). It picks up the other
copy's picture or summary if it has none. The job log says how many
duplicates each topic lost and why.

## Stem cells: sources and time

Stories are newest first. The bar at the top of Stem cells narrows them:

- **All · Today · 7 days · 30 days**: stories from today, or from today and
  the days before it (by date; a journal's day-only date counts as that day).
- **Sources**: a list of every source on the tab, with how many stories each
  has in the chosen time range, most first, and a search box. Tick any to see
  only those; Europe PMC's "Stem cell reports" and the journal's own "Stem
  Cell Reports" count as one. The × next to the button shows all sources again.

Both are saved on each device. To give another tab the same bar, add
`"filters": true` to its topic in `feeds.json`.

## Sport filters

On the Sport tab, **Filter** opens a panel with a search box and three lists:
Sports, Competitions and Teams (from `sport-catalog.json`). Tick anything you
follow, or search for a player, driver or event and follow it as a keyword.
**Show N stories** closes the panel. The Sport tab then only shows stories
about your filters. (Sport stories aren't in Latest at all; they have their
own tab.)

The bar at the top shows how many filters are on and what they are.
**Reset** clears them all, with a few seconds to undo.

- A sport is recognised from the story's web address (`/football/`, `/f1/`),
  the publisher's own tags (the Guardian tags every sport story with its
  sport, competition and teams) or the sport's name in the headline.
- Teams and competitions only count when their sport matches too, so
  "Rangers" in football never picks up the Texas Rangers.
- Filters are saved on each device (your iPhone and PC keep their own).
- To add teams or competitions to the lists, edit `sport-catalog.json`.

## Sport: my teams

The Sport tab's bar is one line: the News | Scores switch and a **My teams**
pill. Tap the pill for a menu:

- **All sport** (or **My filters**, with how many, once you've picked some in
  the filter panel),
- the one-tap teams: Liverpool, England ⚽ (football), England 🏉 (rugby union)
  and Northampton (Saints). Pick one to see only that team's news and games;
  pick **All sport** (or the team again) to go back to your filters. The pill
  then shows the team's name,
- **Choose sports and teams…**, which opens the filter panel above, and
  **Reset filters** while any are on.

The one-tap teams are the `quick` list in `sport-catalog.json`: a label and the
team ids it covers. All four are men's teams only (`menOnly`): women's leagues
are left out, and so is any story mentioning a word in `womenTerms` (women's,
Lionesses, Red Roses, WSL...). They only change the Sport tab.

## Sport: live scores and fixtures

The Sport tab has a **News | Scores | Table** switch (Table is below). Scores reads ESPN's public
scoreboard feed directly from your phone while the view is open: every
minute when a game is live, every 5 minutes otherwise. It covers the
leagues in `leagues.json`: Premier League, Championship, Scottish
Premiership, Champions/Europa/Conference League, FA Cup, League Cup, WSL,
La Liga, Serie A, Bundesliga, Ligue 1, MLS, NFL, NBA, MLB, NHL and rugby
(Premiership Rugby, URC, Champions Cup, Top 14, Six Nations, Rugby
Championship, Super Rugby Pacific, Rugby World Cup, internationals and
rugby league). Your
Sport filters apply to scores too. Tap a football or rugby game for its own page (see Match below); the other sports go to ESPN's match page.
Games show where to watch in the US (TV or streaming, e.g. FOX, FS2,
Paramount+) when ESPN lists it; many games get their listing only a few
days before.

Scores has two blocks, **Scores** (live, finished and today's games) and
**Coming up** (the next fixtures), and each has its own **league pill** on
its right:

- Each shows the **Premier League** to start with. The pill's menu lists the
  leagues that have games in that block, with how many (live ones have a red
  dot), and **All leagues**, which gives every league its own heading as
  before. The **Premier League and Premiership Rugby** are pinned: they come
  first under All leagues, above a line, whenever they have games (`"pin": true`
  in `leagues.json`); the other leagues follow, ones in play first. If there's only one league with games, it's named without a menu.
- Your pick is kept on this device (`news.scores.league` and
  `news.scores.next` in `localStorage`) for as long as that league has games.
  If it has none, the pill falls back to the Premier League.
- With a team filter on (a one-tap team or your own picks) it starts on **All
  leagues** instead, since a team plays in several (Liverpool: the Premier
  League and the Champions League). If the Premier League is quiet, it also
  starts on All leagues.
- Coming up shows 5 games of one league, with **Show N more** for the rest the
  saved copy holds (up to 10), or 3 a league (5 when filtered) under All
  leagues.

- Each refresh also saves a copy (`data/scores.json`), shown when ESPN
  can't be reached.
- **Coming up**: each refresh looks up to 14 days ahead, a day at a time (ESPN
  refuses date ranges), and saves up to 10 per league in the same copy, plus
  every fixture for the one-tap teams, however busy the league (looking 21 days
  ahead in their leagues, to get past international breaks). Fixtures are
  only as fresh as the last refresh; games that have already started drop
  off.
- ESPN's feed is public but undocumented, so it may change or stop
  without notice.

Test: `node news/scripts/app-test.mjs` drives Scores in Chromium at iPhone size
on made-up ESPN data (`scripts/scores-fixture.mjs`), in both designs: the
Vintage look (light and dark), Standard, Settings → Design both ways and kept
across a reload, and the old News Vintage address (its data moved over once,
the files read from `/news/`). `node news/scripts/make-icons.mjs` draws
`icon-*.png` from `icon.svg` (Vintage) and `icon-glass-*.png` from
`icon-glass.svg` (Standard).


### Table: standings

**Table** shows one league's standings at a time, with a pill to pick the league
(the same leagues as Scores, narrowed by your Sport filters; it opens on the
Premier League). It reads ESPN's standings feed
(`site.web.api.espn.com/apis/v2/sports/<path>/standings`) and refreshes on the Scores timer: every minute while a game in
that league is in play, every 5 minutes otherwise, so a result moves its teams
as ESPN counts it. The table has a rank, the team and up to six stats, labelled
with ESPN's own abbreviations (played, won, drawn, lost, goal difference and
points for football; wins, losses, percentage and games behind for the US
leagues); leagues in conferences or groups show one table each. ESPN's own
zones (Champions League, relegation) are a coloured bar down the row's edge, with
a key; teams in play have a live dot; the teams you follow (My teams) are tinted.
The last table seen is kept on the phone for when ESPN can't be reached. A
competition ESPN publishes no table for (many cups and rugby competitions)
says so. ESPN's feed is public but undocumented, so every part is read
defensively and nothing is assumed beyond a team and its stats.
It was checked against ESPN's live Premier League answer on 11 October 2026, and
`scripts/table-test.mjs` plays that real answer (trimmed, in `scripts/fixtures/`) with
a stand-in ESPN. The standings are asked of `site.web.api.espn.com` first (answers
any page, CORS open) and then `site.api.espn.com`. ESPN sent one zone colour as
`##B5E7CE`, which is read as `#B5E7CE`.


### Match: a game's own page

Tapping a football or rugby game under Scores or Coming up opens its own page instead of
ESPN's (the other sports still go to ESPN). It reads ESPN's match details
(`site.web.api.espn.com/apis/site/v2/sports/<path>/summary?event=<game id>`, then
`site.api.espn.com` if that fails; about 35 KB over the wire). The header is the same for
both: both crests, the score and the clock (a live dot while it is on) or the kick-off
time, and the league as the title. Below the tabs: the ground and city, the crowd when
ESPN gives one, where to watch in the US until the game is over, and **Open on ESPN**.
While a game is on it refreshes every 45 seconds, keeping the last answer (with a note)
if ESPN doesn't reply. A game ESPN has no details for says so and keeps the score from
the game row.

**Football** (every league in `leagues.json` with sport `football`): Events | Stats | Shots | Players.

- **Events:** goals (with the assist), cards and substitutions ("X for Y"), between
  Kick-off, Half time and Full time; latest first while the game is on, otherwise in
  order. Delays and the like are left out.
- **Stats:** possession, shots, shots on target, corners, fouls, offsides, yellow and red
  cards, saves, passes and pass accuracy (worked out from accurate passes over passes,
  as ESPN rounds its own to a tenth), the home side in the accent colour.
- **Shots:** a pitch with every shot ESPN placed (its commentary gives each one an x/y
  position): the home side attacks to the right, the away side to the left. Goals are
  solid, on target shaded, off target hollow, woodwork thick, blocked a cross. Tap one
  for who, when and how.
- **Players:** each side's formation and eleven in shape order with positions (a red
  mark for who went off, yellow and red cards), then the substitutes (green for who came
  on); once the game is under way, goals, assists, shots and shots on target for each
  player, and saves and goals conceded for the keeper (ESPN's roster stats). Before
  kick-off the page opens on the players when ESPN has them.

**Rugby** (union and league, every rugby league in `leagues.json`): Scoring | Summary | Line-ups.
ESPN gives rugby no key events or commentary, so the page is built from the scoring list.

- **Scoring:** tries, conversions, penalty goals, drop goals and cards in order, each with
  the points and the running score, between Kick-off, Half time and Full time.
- **Summary:** tries, conversions, penalty goals, drop goals and cards counted from the
  scoring list (ESPN has no team stats for most games).
- **Line-ups:** the starting side by shirt number (15, or 13 in league), the captain,
  then the bench; who came off and on is read from the substitutions.

`scripts/match-test.mjs` plays real answers from 11 October 2026 (two football games,
one finished and one in play; two rugby finals, Sale v Harlequins in the Premiership
and a rugby league game; trimmed, in `scripts/fixtures/`). Not yet seen on a live rugby
game (the shape of the scoring list while it is on is unconfirmed) or for own goals,
penalties and VAR in football. The other sports can follow, each with its own box score.

## Add or change sources

Edit `feeds.json`. Each feed needs a `topic` (one of the ids in `topics`), a
`source` name and an RSS `url`. Optional: `"trusted": true` keeps every
story from it even when its topic has a `filter`; `"max"` reads more than
25 items (for a whole-journal feed that's filtered down to one topic);
`"rank"` (see Duplicates). Topics show up in the topic picker in A to Z order after Latest.
A feed that fails is skipped for that run and counted in the app's footer;
the job logs list each feed's result.

## Run locally

```sh
node news/scripts/fetch-news.mjs   # writes news/data/news.json (Node 20+)
npx http-server . -p 8080          # then open http://localhost:8080/news/
```

## Put it on your iPhone

1. On GitHub: Settings → Pages → Source: **GitHub Actions**.
2. Once the workflow has run on the default branch, open
   `https://tomallison24-news.pages.dev/news/` in Safari.
3. Share → **Add to Home Screen**.

The topic picker sits at the bottom of the screen, in Safari and from the
Home Screen. Since iOS 26, iOS blurs the top of home-screen web
apps and nothing a page does turns that off, so nothing you tap stays up
there. The date and title start just below that band, and on Sport the
News | Scores switch and team buttons sit at the top of the page.

GitHub pauses scheduled workflows in public repositories after 60 days with no
repository activity. If headlines stop updating, re-enable the workflow in the
Actions tab.
