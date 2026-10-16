"use strict";

// Ipsy's tools in News (in both its designs). Claude asks for them by name through functions/news/api
// (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone, against the same headlines,
// scores and tables the app shows, and what they return goes back to Claude.
//
//   window.NewsIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (news/app.js passes them): data (the published headlines), load, topics,
//        topicLabel, storiesFor, select, summarize (the summaries route), openAi, leagues, scores,
//        fixtures, fetchBoards, loadSnapshot, getSnapshot, loadTable, setMode, setLeague, openMatch,
//        catalog, picks, setPicks, quick, setQuick, filtersOf, sourceList, setListFilters, screen
//
// Almost everything here only reads. The few changes are the ones you can make in the app yourself,
// kept on this phone only: the sports and teams you follow (Sport filters), the one-tap team, and a
// topic's source and time filters (Stem cells). Each goes through the app's own setter (so the screen
// and what's saved stay right) and comes back with an undo for the chat's Undo button.
window.NewsIpsy = function (app) {
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const low = s => String(s || '').toLowerCase();
  const fail = msg => { throw new Error(msg); };
  const when = iso => {
    const d = new Date(iso || '');
    if (isNaN(d)) return '';
    if (/T00:00:00(\.000)?Z$/.test(iso)) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });   // a journal's date, no time
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const ago = ms => ms ? app.ago(new Date(ms).toISOString()) : '';

  // ---- the headlines ----
  async function headlines() {
    if (!app.data) await app.load();
    if (!app.data || !Array.isArray(app.data.stories)) fail('The headlines haven’t loaded on this phone (no connection?). Try again in a minute.');
    return app.data.stories;
  }
  const topicOf = q => {
    if (!q) return null;
    const t = [app.LATEST, ...app.topics()].find(x => low(x.id) === low(q) || low(x.label) === low(q));
    if (!t) fail('No topic "' + clip(q, 40) + '". The topics: ' + [app.LATEST, ...app.topics()].map(x => x.id + ' (' + x.label + ')').join(', ') + '.');
    return t.id;
  };
  const brief = s => ({ id: s.id, title: s.title, source: s.source, topic: app.topicLabel(s.topic), published: when(s.published),
    ...(s.summary ? { description: clip(s.summary, 220) } : {}) });
  const byId = (list, id) => list.find(s => s.id === id || s.url === id);
  // Is a story in its tab's list as the person has it (Sport's teams, Stem cells' filters)?
  const onTab = s => app.storiesFor(s.topic).includes(s);

  // ---- sport ----
  async function sportReady() { await app.ready(); if (!app.leagues.length) fail('The list of leagues hasn’t loaded on this phone (no connection?).'); }
  const leagueList = () => app.leagues.map(l => l.id + ' (' + l.label + ')').join(', ');
  function leagueOf(q) {
    const s = low(clip(q, 60));
    const l = app.leagues.find(x => low(x.id) === s) || app.leagues.find(x => low(x.label) === s) || app.leagues.find(x => low(x.label).includes(s));
    if (!l) fail('No league "' + clip(q, 60) + '" in News. Its leagues: ' + leagueList() + '.');
    return l;
  }
  // The names to look for when asked about a team: what was asked, plus the sport list's own names for it ("Spurs").
  function teamNames(q) {
    const s = low(clip(q, 60)), names = new Set([s]);
    if (app.catalog) for (const e of app.catalog.entries.values()) if (e.kind === 'team' && [e.label, ...(e.terms || [])].some(t => low(t) === s)) names.add(low(e.label));
    return [...names];
  }
  const playing = (g, names) => [g.home.name, g.home.short, g.away.name, g.away.short].some(n => names.some(t => low(n).includes(t)));
  const STATE = { in: 'live', post: 'finished', pre: 'not started' };
  const game = (g, l) => ({
    id: g.id, state: STATE[g.state] || g.state, ...(g.detail ? { status: g.detail } : {}), kickoff: when(g.start),
    home: g.home.name, away: g.away.name, ...(g.state !== 'pre' && g.home.score != null ? { score: g.home.score + '-' + g.away.score } : {}),
    ...(g.state !== 'post' && g.tv && g.tv.length ? { watch_us: g.tv.join(', ') } : {}), ...(app.hasPage(l) ? { has_match_page: true } : {}),
  });

  // ---- following: the Sport filters and the one-tap team ----
  function optionOf(q) {
    const s = clip(q, 60);
    if (!s) return null;
    if (app.catalog && app.catalog.entries.has(s)) return s;
    if (/^kw:/.test(s)) return 'kw:' + clip(s.slice(3), 40);
    if (/^(sport|comp|team):/.test(s)) fail('No "' + s + '" in the sport lists: find_sport_options gives their ids.');
    const all = app.catalog ? [...app.catalog.entries.values()] : [];
    const e = all.find(x => low(x.label) === low(s)) || all.find(x => (x.terms || []).some(t => low(t) === low(s)));
    return e ? e.id : 'kw:' + s.slice(0, 40);     // not in the lists: followed as a word in headlines, as the panel does
  }
  const labelOf = id => (app.pickEntry(id) || { label: id.replace(/^kw:/, '') }).label;
  const pickBrief = id => { const e = app.pickEntry(id) || { id, kind: 'kw', label: id.replace(/^kw:/, '') }; return { id, kind: { sport: 'sport', comp: 'competition', team: 'team', kw: 'keyword' }[e.kind] || e.kind, name: e.label, ...(e.group ? { group: e.group } : {}) }; };
  const names = ids => ids.map(labelOf).slice(0, 4).join(', ') + (ids.length > 4 ? ' and ' + (ids.length - 4) + ' more' : '');
  function restoreQuick(key) {
    if ((app.quick || null) === (key || null)) return;
    app.setQuick(key || null);            // setQuick(key) turns that team on; setQuick(null) goes back to your filters
  }

  const tools = {
    async find_stories(q) {
      const all = await headlines();
      const words = low(clip(q.query, 200)).split(/\s+/).filter(Boolean);
      const t = topicOf(q.topic), src = low(clip(q.source, 80));
      const days = Number.isInteger(q.days) && q.days > 0 ? Math.min(q.days, 60) : 0;
      const limit = Math.max(1, Math.min(60, Number.isInteger(q.limit) ? q.limit : 20));
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
      const pool = t === app.LATEST.id ? app.storiesFor(t) : all;           // Latest: as the app lists it
      const seen = new Set();
      const list = pool.filter(s => {
        if (seen.has(s.id)) return false; seen.add(s.id);
        if (t && t !== app.LATEST.id && s.topic !== t) return false;
        if (src && !low(s.source).includes(src)) return false;
        if (days && !(s.published && new Date(s.published) >= from)) return false;
        if (words.length) { const hay = low([s.title, s.summary, s.source, ...(s.tags || [])].join(' ')); if (!words.every(w => hay.includes(w))) return false; }
        return true;
      }).sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
      return { content: { headlines_updated: app.data.generatedAt ? app.ago(app.data.generatedAt) : '', found: list.length, shown: Math.min(limit, list.length), stories: list.slice(0, limit).map(brief) } };
    },

    async get_story(q) {
      const all = await headlines();
      const ids = (Array.isArray(q.ids) ? q.ids : [q.id]).filter(Boolean).slice(0, 10);
      if (!ids.length) fail('Give a story id.');
      return { content: { stories: ids.map(id => {
        const s = byId(all, id);
        if (!s) return { id, missing: 'Not in today’s headlines (it may have dropped off since).' };
        return { ...brief(s), url: s.url, ...(s.doi ? { doi: s.doi } : {}), ...(s.tags && s.tags.length ? { tags: s.tags.slice(0, 12) } : {}),
          ...(onTab(s) ? {} : { hidden_on_its_tab: 'The person’s filters hide it on the ' + app.topicLabel(s.topic) + ' tab.' }) };
      }) } };
    },

    // Through the app's own summaries route, which reads only stories in the published headlines.
    async summarize_story(q) {
      const all = await headlines();
      const s = byId(all, clip(q.id, 2000));
      if (!s) fail('Not in today’s headlines, so it can’t be summarized here (the summaries only read published stories). Use web_fetch or web_search instead.');
      try {
        const j = await app.summarize(s.url);
        return { content: { id: s.id, title: j.title || s.title, source: s.source, summary: j.summary, takeaways: j.takeaways,
          read: j.basis === 'snippet' ? 'only the headline and description (the page wouldn’t load: a paywall, perhaps)' : j.truncated ? 'the first part of a very long article' : 'the whole article' } };
      } catch (e) { fail('Couldn’t summarize it: ' + app.aiSay(e && e.code)); }
    },

    async show_story(q) {
      const all = await headlines();
      const s = byId(all, clip(q.id, 2000));
      if (!s) fail('Not in today’s headlines.');
      if (q.summary) { app.openAi(s.url); return { content: { shown: s.id, note: 'Its summary is open behind the chat; closing the chat shows it.' } }; }
      if (app.topic !== s.topic) app.select(s.topic);
      if (s.topic === app.SPORT) app.setMode('news');
      const row = [...document.querySelectorAll('#feed a.row, #feed a.lead')].find(a => a.getAttribute('href') === app.safeUrl(s.url));
      if (!row) return { content: { shown: false, tab: app.topicLabel(s.topic), note: 'It isn’t in the list on the ' + app.topicLabel(s.topic) + ' tab: the person’s filters hide it. show_story with summary: true opens its summary instead.' } };
      row.scrollIntoView({ block: 'center' });
      row.classList.add('ipsy-spot');
      setTimeout(() => row.classList.remove('ipsy-spot'), 4000);
      return { content: { shown: s.id, tab: app.topicLabel(s.topic), note: 'It is marked in the list behind the chat; closing the chat shows it.' } };
    },

    async sport_scores(q) {
      await sportReady();
      const one = q.league ? leagueOf(q.league) : null, team = q.team ? teamNames(q.team) : null;
      const list = one ? [one] : q.mine ? app.relevantLeagues() : app.leagues.filter(l => !l.women || /women/i.test(q.team || ''));
      // Today's games live from ESPN (a minute old at most), the fixtures from the saved copy.
      if (Date.now() - app.scoresAt > 60e3 || list.some(l => !app.scores[l.id])) {
        if (!(await app.fetchBoards(list))) await app.loadSnapshot();
      }
      await app.getSnapshot(15 * 60e3);
      const now = Date.now(), cap = Math.max(1, Math.min(10, Number.isInteger(q.coming_up) ? q.coming_up : one || team ? 5 : 2));
      const keep = (g, l) => (!team || playing(g, team)) && (!q.mine || app.gameMatches(g, l));
      const out = list.map(l => {
        const today = (app.scores[l.id] || []).filter(g => keep(g, l));
        const ids = new Set((app.scores[l.id] || []).map(g => g.id));
        const next = (app.fixtures[l.id] || []).filter(g => !ids.has(g.id) && Date.parse(g.start) > now && keep(g, l));
        return { league: l.id, name: l.label, today: today.map(g => game(g, l)), coming_up: next.slice(0, cap).map(g => game(g, l)), ...(next.length > cap ? { more_coming_up: next.length - cap } : {}) };
      }).filter(x => x.today.length || x.coming_up.length);
      return { content: {
        source: app.scoresSource === 'copy' ? 'the saved copy (ESPN didn’t answer just now), from ' + ago(app.scoresAt) : 'ESPN, ' + (ago(app.scoresAt) || 'just now'),
        fixtures_checked: ago(app.snapAt) || 'unknown', leagues: out,
        ...(out.length ? {} : { note: 'No games' + (team ? ' for ' + q.team : '') + (one ? ' in ' + one.label : '') + ' today or in the next two weeks, in the leagues News follows.' }),
      } };
    },

    async league_table(q) {
      await sportReady();
      const l = leagueOf(q.league || 'eng.1');
      const t = await app.loadTable(l);
      if (!t) fail('Couldn’t reach ESPN for the ' + l.label + ' table, and there’s no saved copy on this phone.');
      if (!t.groups.length) return { content: { league: l.id, name: l.label, note: 'ESPN publishes no table for this competition.' } };
      const live = new Set((t.live || []).map(low));
      return { content: { league: l.id, name: l.label, season: t.season, from: t.source === 'saved' ? 'the copy saved on this phone (ESPN didn’t answer)' : 'ESPN, just now',
        groups: t.groups.map(g => ({ ...(g.name ? { name: g.name } : {}), columns: ['#', 'Team', ...g.cols.map(c => c.label)],
          rows: g.rows.map(r => [r.rank, r.name, ...r.vals].concat(r.zone && r.zone.label ? ['(' + r.zone.label + ')'] : [], live.has(low(r.name)) || live.has(low(r.short)) ? ['(playing now)'] : [], app.followed(r.name, r.short) ? ['(followed)'] : [])) })) } };
    },

    async show_sport(q) {
      await sportReady();
      const view = ['news', 'scores', 'table'].includes(q.view) ? q.view : q.game_id ? 'scores' : 'news';
      const l = q.league ? leagueOf(q.league) : null;
      app.select(app.SPORT);
      app.setMode(view);
      if (l && view === 'scores') { app.setLeague('scores', l.id); app.setLeague('next', l.id); }
      if (l && view === 'table') app.setLeague('table', l.id);
      if (q.game_id) {
        const has = x => [...(app.scores[x.id] || []), ...(app.fixtures[x.id] || [])].some(g => String(g.id) === String(q.game_id));
        const lg = l && has(l) ? l : app.leagues.find(has);
        if (!lg || !app.hasPage(lg)) return { content: { shown: 'Sport, ' + view, note: 'That game has no match page here (only football and rugby do, and only games sport_scores lists).' } };
        app.openMatch(lg.id, String(q.game_id));
        return { content: { shown: 'the match page', note: 'It is open behind the chat; closing the chat shows it.' } };
      }
      return { content: { shown: 'Sport, ' + view + (l ? ', ' + l.label : ''), note: 'It is on screen behind the chat.' } };
    },

    async find_sport_options(q) {
      await app.ready();
      if (!app.catalog) fail('The list of sports and teams hasn’t loaded on this phone.');
      const s = low(clip(q.query, 60));
      const all = [...app.catalog.entries.values()];
      const hits = s ? all.filter(e => low(e.label).includes(s) || (e.terms || []).some(t => low(t).includes(s))).slice(0, 30) : [];
      const quick = app.quickTeam();
      return { content: {
        following: app.picks.map(pickBrief), one_tap_team_on: quick ? quick.label : null,
        one_tap_teams: app.catalog.quick.map(t => ({ key: t.key, name: t.label, ...(t.menOnly ? { mens_only: true } : {}) })),
        ...(s ? { matches: hits.map(e => ({ ...pickBrief(e.id), followed: app.picks.includes(e.id) })), ...(hits.length ? {} : { note: 'Not in the lists: following "' + clip(q.query, 40) + '" shows any sport headline that mentions it.' }) } : {}),
      } };
    },

    async set_sport_filters(q) {
      await app.ready();
      const before = app.picks.slice();
      let next = q.clear ? [] : before.slice();
      const add = (Array.isArray(q.follow) ? q.follow : []).map(optionOf).filter(Boolean);
      const drop = (Array.isArray(q.unfollow) ? q.unfollow : []).map(x => { const s = clip(x, 60); return next.find(id => id === s || low(labelOf(id)) === low(s)) || optionOf(s); }).filter(Boolean);
      next = next.filter(id => !drop.includes(id));
      for (const id of add) if (!next.includes(id)) next.push(id);
      const added = next.filter(id => !before.includes(id)), removed = before.filter(id => !next.includes(id));
      if (!added.length && !removed.length) return { content: { following: next.map(pickBrief), note: 'Nothing changed: it already says that.' } };
      app.setPicks(next);
      const quick = app.quickTeam();
      return { content: { following: next.map(pickBrief), ...(quick ? { note: 'The one-tap team ' + quick.label + ' is on, so the Sport tab shows only them until it’s turned off (set_my_team).' } : {}) },
        change: { text: [added.length ? 'Following ' + names(added) : '', removed.length ? (added.length ? 'stopped following ' : 'Stopped following ') + names(removed) : ''].filter(Boolean).join('; '),
          undo: () => app.setPicks(before) } };
    },

    async set_my_team(q) {
      await app.ready();
      if (!app.catalog) fail('The list of sports and teams hasn’t loaded on this phone.');
      const before = app.quick || null, s = low(clip(q.team, 60));
      const t = s ? app.catalog.quick.find(x => low(x.key) === s || low(x.label) === s || low(x.label).startsWith(s)) : null;
      if (s && !t) fail('Not a one-tap team. They are: ' + app.catalog.quick.map(x => x.label).join(', ') + '. To follow another team, use set_sport_filters.');
      const key = t ? t.key : null;
      if (key === before) return { content: { one_tap_team_on: t ? t.label : null, note: 'It already says that.' } };
      restoreQuick(key);
      return { content: { one_tap_team_on: t ? t.label : null },
        change: { text: t ? 'Sport now shows only ' + t.label : 'Sport shows ' + (app.picks.length ? 'your filters' : 'all sport') + ' again', undo: () => restoreQuick(before) } };
    },

    async set_story_filters(q) {
      await headlines();
      const id = topicOf(q.topic || 'stemcells');
      if (!app.hasFilters(id)) fail('Only ' + app.topics().filter(t => app.hasFilters(t.id)).map(t => t.label).join(', ') + ' has source and time filters.');
      const before = app.filtersOf(id), next = {};
      if (q.days != null) { if (!app.WINDOWS.includes(q.days)) fail('days is 0 (all), 1 (today), 7 or 30.'); next.days = q.days; }
      if (Array.isArray(q.sources)) {
        const known = app.sourceList(id), bad = [];
        next.sources = [...new Set(q.sources.map(x => { const e = known.find(k => k.key === low(clip(x, 80)) || low(k.label) === low(clip(x, 80))) || known.find(k => k.key.includes(low(clip(x, 80)))); if (!e) bad.push(x); return e && e.key; }).filter(Boolean))];
        if (bad.length) fail('No source called ' + bad.map(b => '"' + clip(b, 40) + '"').join(', ') + ' on ' + app.topicLabel(id) + '. Its sources: ' + known.map(k => k.label).join(', ') + '.');
      }
      if (!Object.keys(next).length) fail('Give sources or days.');
      const after = { ...before, ...next };
      if (JSON.stringify(after) === JSON.stringify(before)) return { content: { filters: after, note: 'It already says that.' } };
      app.setListFilters(id, next);
      const label = app.topicLabel(id), range = after.days ? (after.days === 1 ? 'today' : 'last ' + after.days + ' days') : 'any time';
      return { content: { topic: label, sources: after.sources.length ? after.sources : 'all', days: after.days, stories_now: app.filteredStories(id).length },
        change: { text: label + ': ' + (after.sources.length ? after.sources.length + ' source' + (after.sources.length === 1 ? '' : 's') : 'all sources') + ', ' + range, undo: () => app.setListFilters(id, before) } };
    },
  };

  const LABELS = {
    find_stories: i => 'Looking through the headlines' + (i.query ? ': ' + clip(i.query, 50) : ''), get_story: () => 'Reading the story’s details',
    summarize_story: () => 'Summarizing the story', show_story: () => 'Showing the story',
    sport_scores: i => 'Checking the scores' + (i.team ? ' for ' + clip(i.team, 40) : ''), league_table: () => 'Reading the table', show_sport: () => 'Opening Sport',
    find_sport_options: () => 'Looking at the teams you follow', set_sport_filters: () => 'Changing the teams you follow', set_my_team: () => 'Changing the one-tap team',
    set_story_filters: () => 'Changing the filters',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const d = app.data, quick = app.quickTeam();
      return 'News has ' + (d && d.stories ? d.stories.length + ' headlines, updated ' + (d.generatedAt ? app.ago(d.generatedAt).toLowerCase() : 'recently') : 'no headlines loaded') + '. '
        + (quick ? 'One-tap team on: ' + quick.label + '. ' : '')
        + (app.picks.length ? 'Following in Sport: ' + names(app.picks) + '. ' : '')
        + 'On screen: ' + app.screen() + '.';
    },
    intro: 'Hi, I’m Ipsy! I can find a story in today’s headlines, sum one up, check scores, fixtures and tables, change the teams you follow, or look up anything newer on the web.',
    placeholder: 'Ask Ipsy about the news',
    suggestions: ['What are the top stories today?', 'How did Liverpool get on?', 'Show me the Premier League table', 'Anything new on stem cells this week?'],
    consent: 'Ipsy runs on Claude, by Anthropic. When you ask something, your question and whatever Ipsy looks at to answer it (the headlines, scores and tables in News, and the teams you follow) go to Claude through the family server, which keeps only a count of questions. Ipsy can change the teams you follow and the Stem cells filters: each change shows here with Undo.',
  };
};
