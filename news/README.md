# News

Latest headlines by topic (AI, Business, Science, Sport, Stem cells, Tech, UK, US, World) as a
home-screen web app: clean, minimal, frosted glass, light and dark.

- **Data:** the RSS and Atom feeds listed in `feeds.json`.
  `scripts/fetch-news.mjs` reads them into `data/news.json`, the only file the
  app loads. News sites don't allow browsers on other sites to read
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
- **Liquid Glass**, as in iOS 26 and the Calendar app: the Sport filters and
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

The Sport tab has a **News | Scores** switch. Scores reads ESPN's public
scoreboard feed directly from your phone while the view is open: every
minute when a game is live, every 5 minutes otherwise. It covers the
leagues in `leagues.json`: Premier League, Championship, Scottish
Premiership, Champions/Europa/Conference League, FA Cup, League Cup, WSL,
La Liga, Serie A, Bundesliga, Ligue 1, MLS, NFL, NBA, MLB, NHL and rugby
(Premiership Rugby, URC, Champions Cup, Top 14, Six Nations, Rugby
Championship, Super Rugby Pacific, Rugby World Cup, internationals and
rugby league). Your
Sport filters apply to scores too. Tap a game for ESPN's match page.
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
on made-up ESPN data (`scripts/scores-fixture.mjs`).

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
