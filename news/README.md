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

## Sources

Only sources that are free to read are included, and only through their own
public feeds:

| Topic    | Sources |
|----------|---------|
| UK       | BBC News, The Guardian, Sky News |
| World    | BBC News, The Guardian, Sky News, Al Jazeera, NPR |
| US       | BBC News, The Guardian, Sky News, NPR, PBS News |
| Business | BBC News, The Guardian, Sky News, NPR |
| Tech     | BBC News, The Guardian, Sky News, NPR, Ars Technica |
| AI       | The Guardian, Ars Technica, TechCrunch, plus any story from the other feeds with AI in its headline (AI stories are taken out of Tech) |
| Science  | BBC News, The Guardian, NPR, ScienceDaily, The Conversation |
| Stem cells | The Niche, ScienceDaily, Stem Cell Reports, open-access papers and preprints (bioRxiv, medRxiv) via Europe PMC, plus matching stories from the other topics. Only stem cell stories are kept (pluripotent/iPSC/hESC, organoids, embryo models, mesenchymal and haematopoietic stem cells and any other "stem cell" mention), for up to 30 days |
| Sport    | BBC Sport, The Guardian, Sky Sports (general feeds plus one per sport) |

Not included:

- **Reuters** has had a paywall since October 2024 and stopped publishing RSS
  feeds in 2020.
- **Associated Press** is free to read but has no official RSS feed.
- **BBC News** is free in the UK. Since mid-2025, readers in the US hit a
  paywall after reading a certain amount. Remove the BBC lines from
  `feeds.json` if that matters where you read.

## Sport filters

On the Sport tab, **Filter** opens a panel with a search box and three lists:
Sports, Competitions and Teams (from `sport-catalog.json`). Tick anything you
follow, or search for a player, driver or event and follow it as a keyword.
**Show N stories** closes the panel. The Sport tab and the sport stories in
Latest then only show stories about your filters.

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

The Sport tab has one-tap buttons for Liverpool, England (football) and
Northampton (Saints). Tap one to see only that team's news and games, and
tap it again to go back to your filters. The buttons are the `quick` list in
`sport-catalog.json`; any team in that file can go there. They only change
the Sport tab: Latest keeps using your saved filters.

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

- Each refresh also saves a copy (`data/scores.json`), shown when ESPN
  can't be reached.
- **Coming up**: under each league's games, the next fixtures (3 a league,
  or 5 when you've set filters, so your team's next games show). Each
  refresh looks up to 14 days ahead, a day at a time (ESPN refuses date
  ranges), and saves up to 10 per league in the same copy. Fixtures are
  only as fresh as the last refresh; games that have already started drop
  off.
- ESPN's feed is public but undocumented, so it may change or stop
  without notice.

## Add or change sources

Edit `feeds.json`. Each feed needs a `topic` (one of the ids in `topics`), a
`source` name and an RSS `url`. Topics show up as tabs in A to Z order after Latest.
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

GitHub pauses scheduled workflows in public repositories after 60 days with no
repository activity. If headlines stop updating, re-enable the workflow in the
Actions tab.
