# News

Latest headlines by topic (AI, Business, Science, Sport, Stem cells, Tech, UK, US, World) as a
home-screen web app: clean, minimal, frosted glass, light and dark.

- **Data:** the RSS and Atom feeds listed in `feeds.json`.
  `scripts/fetch-news.mjs` reads them into `data/news.json`, the only file the
  app loads. News sites don't allow browsers on other sites to read
  their feeds (CORS), so the feeds are fetched ahead of time instead. No API
  keys needed.
- **Updates:** `.github/workflows/news.yml` re-fetches every 30 minutes and
  publishes the site to GitHub Pages. `data/` is generated, not committed.
- **No build step** for the app itself: `index.html` is the whole app;
  `sw.js` keeps it working offline, and the last headlines are kept in
  `localStorage`.
- **Tapping a story** opens the full article on the publisher's site.
- **Liquid Glass**, as in iOS 26 and the Calendar app: the Sport filters and
  Sources panels float as clear glass sheets, and every switch (the topic
  tabs, News | Scores, the time range, the team buttons) has a glass thumb
  that slides to what you pick (`../home/slide.js`, shared by the apps).
- **Newest first** on every tab. The top story is shown large when it has
  a picture; an older story with a picture never jumps ahead of it.

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

Stories are newest first. The bar under the tabs on Stem cells narrows them:

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

The bar under the tabs shows how many filters are on and what they are.
**Reset** clears them all, with a few seconds to undo.

- A sport is recognised from the story's web address (`/football/`, `/f1/`),
  the publisher's own tags (the Guardian tags every sport story with its
  sport, competition and teams) or the sport's name in the headline.
- Teams and competitions only count when their sport matches too, so
  "Rangers" in football never picks up the Texas Rangers.
- Filters are saved on each device (your iPhone and PC keep their own).
- To add teams or competitions to the lists, edit `sport-catalog.json`.

## Sport: my teams

The Sport tab has one-tap buttons for Liverpool, England ⚽ (football),
England 🏉 (rugby union) and Northampton (Saints), on the same line as the
Filter button. Tap one to see only that team's news and games, and tap it again to
go back to your filters. The buttons are the `quick` list in
`sport-catalog.json`: a label and the team ids it covers. All four are men's
teams only (`menOnly`): women's leagues are left out, and so is any story
mentioning a word in `womenTerms` (women's, Lionesses, Red Roses, WSL...). They only change
the Sport tab.

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

- Each refresh also saves a copy (`data/scores.json`), shown when ESPN
  can't be reached.
- **Coming up**: under each league's games, the next fixtures (3 a league,
  or 5 when you've set filters, so your team's next games show). Each
  refresh looks up to 14 days ahead, a day at a time (ESPN refuses date
  ranges), and saves up to 10 per league in the same copy, plus every
  fixture for the one-tap teams, however busy the league (looking 21 days
  ahead in their leagues, to get past international breaks). Fixtures are
  only as fresh as the last refresh; games that have already started drop
  off.
- ESPN's feed is public but undocumented, so it may change or stop
  without notice.

## Add or change sources

Edit `feeds.json`. Each feed needs a `topic` (one of the ids in `topics`), a
`source` name and an RSS `url`. Optional: `"trusted": true` keeps every
story from it even when its topic has a `filter`; `"max"` reads more than
25 items (for a whole-journal feed that's filtered down to one topic);
`"rank"` (see Duplicates). Topics show up as tabs in A to Z order after Latest.
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
   `https://tomallison24.github.io/tomallison24/news/` in Safari.
3. Share → **Add to Home Screen**.

Opened from the Home Screen, the topic tabs sit in a floating bar at the
bottom of the screen. Since iOS 26, iOS blurs the top of home-screen web
apps and nothing a page does turns that off, so nothing you tap stays up
there. The date and title start just below that band, and on Sport the
News | Scores switch and team buttons sit at the top of the page. In Safari
the tabs stay at the top. Add `?bar=bottom` to the address to try the bottom
bar in a browser.

GitHub pauses scheduled workflows in public repositories after 60 days with no
repository activity. If headlines stop updating, re-enable the workflow in the
Actions tab.
