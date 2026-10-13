# News Vintage

[News](../news/README.md) in a mid-century modern look, as its own app. It does
everything News does - the latest headlines by topic (UK, World, US, Business,
Tech, AI, Science, Sport, Stem cells), Sport with live scores, fixtures,
league tables and a page for each football and rugby game, your teams, and
Claude's summary of a story with questions about it - and reads the same
headlines and scores. The features, the sources and how the data is made are
described in `news/README.md`; this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass and the drifting colour fields;
- mustard, teal, burnt orange and olive: News | Scores and the time range have
  a mustard thumb, the topic picker has a mustard disc round its icon, a
  game's home side is teal and the away side orange, the shot map's pitch is
  olive, and each topic has its own dot (brick, teal, denim, mustard, walnut,
  plum, olive, pumpkin and rose, each lighter in dark mode);
- three atomic shapes behind the title (a mustard sun, a teal dot and an orange
  pill) that scroll away with the page, and three little bars under it;
- solid burnt-orange buttons (Show N stories, Try again, the send arrow);
  outlined teal ones (Reset, Edit filters, the sparkle on a story); Futura,
  which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. News Vintage is drawn this way for everyone: the
style picker in the design canvas is not built. Football's yellow and red
cards, and the colours ESPN gives a table's zones (Champions League,
relegation), stay as they are: they say something.

## What is separate from News

It is a second copy of News' page and script, not a setting, so the two can
change independently and News is never touched.

- **The same headlines and scores, made once.** There is no second data
  pipeline. The app reads `../news/data/news.json` and `../news/data/scores.json`
  (written by News' own workflow, `.github/workflows/news.yml`, and refreshed
  every 30 minutes by the News tick), and `../news/sport-catalog.json` and
  `../news/leagues.json` (so the sports, teams and leagues never drift apart).
  `feeds.json` and the fetch scripts stay in `news/`. Nothing is published
  under `/newsvintage/data/`.
- **Summaries and questions use News' route** (`../news/api/summarize` and
  `../news/api/ask`, `functions/news/api`). It is locked to signed-in family and
  asks for Face ID like News does, and keeps nothing per app: a story's summary
  is kept for the whole family for a week, so a story summarized in News is
  already summarized in News Vintage, and the 60-a-day limit is each person's
  across both. The route reads the story from the published headlines, which
  both apps share.
- **Own storage.** Every key is `newsv.…` (News' is `news.…`): the last
  headlines and scores, the chosen topic, the Sport filters and your teams, the
  league you chose, the tables and the Stem cells filters. So each app
  remembers its own, and a team picked in one is not picked in the other. The
  offline cache is `newsvintage-v1`.
- **No sign-in address to add.** It has no Google sign-in, so nothing to
  register: the server route is the family account's, which works on any
  address of the site.
- **No links to other apps.** News opens a story on the publisher's site,
  and so does News Vintage.
- **The same football and rugby pages.** They are read from ESPN's public feed
  by the app itself (as in News), with nothing kept for them.

## Tests

`node newsvintage/scripts/app-test.mjs` is News' Scores browser test, run on
this app (ESPN stubbed with `news/scripts/scores-fixture.mjs`, which it
imports rather than copies), plus checks that the headlines, scores and sport
lists come from `/news/` and nothing from `/newsvintage/data/`, that the keys
are `newsv.…` only, and that it is drawn in the Retro look: Futura, flat cream
(walnut) cards, a mustard thumb, an orange button and the shapes behind the
title, in light and dark (CI: `apps-check.yml`). `node
newsvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg` (a cream
front page on olive, with a mustard sun and a burnt-orange pill).

The tests of how a game's page, a table, the summaries and the data are read
(`match-test.mjs`, `table-test.mjs`, `ai-test.mjs`, `fetch-*.mjs`) belong to
News and are not repeated: the page and script differ only in colours, keys and
where the files are read from.
