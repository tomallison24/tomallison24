# News

Latest headlines by topic (UK, World, US, Business, Tech, Science, Sport) as a
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
| Science  | BBC News, The Guardian, NPR, ScienceDaily, The Conversation |
| Sport    | BBC Sport, The Guardian, Sky Sports |

Not included:

- **Reuters** has had a paywall since October 2024 and stopped publishing RSS
  feeds in 2020.
- **Associated Press** is free to read but has no official RSS feed.
- **BBC News** is free in the UK. Since mid-2025, readers in the US hit a
  paywall after reading a certain amount. Remove the BBC lines from
  `feeds.json` if that matters where you read.

## Add or change sources

Edit `feeds.json`. Each feed needs a `topic` (one of the ids in `topics`), a
`source` name and an RSS `url`. Topics show up as tabs in the order listed.
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
