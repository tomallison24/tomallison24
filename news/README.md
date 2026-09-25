# News

Latest headlines by topic (UK, World, US, Business, Tech, Science, Sport) as a
home-screen web app: clean, minimal, frosted glass, light and dark.

- **Data:** the RSS feeds listed in `feeds.json` (BBC News and The Guardian to
  start). `scripts/fetch-news.mjs` reads them into `data/news.json`, the only
  file the app loads. News sites don't allow browsers on other sites to read
  their feeds (CORS), so the feeds are fetched ahead of time instead. No API
  keys needed.
- **Updates:** `.github/workflows/news.yml` re-fetches every 30 minutes and
  publishes the site to GitHub Pages. `data/` is generated, not committed.
- **No build step** for the app itself: `index.html` is the whole app;
  `sw.js` keeps it working offline, and the last headlines are kept in
  `localStorage`.
- **Tapping a story** opens the full article on the publisher's site.

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
