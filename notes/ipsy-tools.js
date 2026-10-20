"use strict";

// Ipsy's tools in Notes (in both its designs). Claude asks for them by name through
// functions/notes/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// against the same notes, reminders and lists as the app, and what they return goes back to
// Claude. Every change comes back with an undo for the chat's Undo button.
//
//   window.NotesIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (notes/app.js passes them): notes, todos, lists (get and set), save,
//        render, newId, normTag, extractTags, matchQuery, todayStr, COLORS, LIST_COLORS, AISLE
//        (../home/aisles.js), isGrocery, aisleOf, learnAisle, parseRecipe, formatRecipe, countRecipe,
//        alertsOn, release (finishes the note editor or a reminder's sheet if it's open on an item
//        about to change), showNote, showList, screen
//
// Changes follow the app's own rules and go through save(), so they sync to the Google Sheet (and
// the notification server) like any other change: a deleted note goes to Trash (30 days), tags
// typed as #words in a note are kept as its tags, a grocery list sorts its items into store
// sections and learns a section chosen for an item. Private notes are hidden from Ipsy (they still
// sync like any other note): they are left out of everything it reads, and it can't change them.
window.NotesIpsy = function (app) {
  const copy = o => JSON.parse(JSON.stringify(o));
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const text = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, n);
  const fail = msg => { throw new Error(msg); };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const isDay = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(new Date(s + 'T12:00')) && ymd(new Date(s + 'T12:00')) === s;
  const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const isWhen = s => typeof s === 'string' && /^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d$/.test(s) && isDay(s.slice(0, 10));
  // A note's nudge is kept as an ISO time; Claude sees and gives it as the phone's local "YYYY-MM-DDTHH:MM".
  const localWhen = iso => { const d = new Date(iso); return isNaN(d) ? '' : ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const ALERTS = [0, 5, 15, 30, 60, 120, 1440, 2880, 10080, -1];
  const PRIO = ['none', 'low', 'medium', 'high'];
  const quote = s => '“' + clip(s, 40) + '”';

  const visible = n => !n.private;                    // private notes stay out of Ipsy's sight
  const noteById = id => app.notes.find(n => n.id === id && visible(n));
  const todoById = id => app.todos.find(t => t.id === id);
  const listById = id => app.lists.find(l => l.id === id);
  const listOf = t => listById(t.list) || app.lists[0];
  const listNamed = v => { const s = clip(v, 100); return listById(s) || app.lists.find(l => l.name.toLowerCase() === s.toLowerCase()); };
  const firstLine = n => (n.body || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  const noteName = n => quote(n.title || firstLine(n) || 'Untitled');
  const done = () => { app.save(); app.render(); };

  // What some notes, reminders and lists looked like before a change, and how to put them back.
  //   snapshot([['notes', id], ['todos', id], ['lists', id]])
  function snapshot(keys) {
    return keys.map(([kind, id]) => { const arr = app[kind], i = arr.findIndex(x => x.id === id); return { kind, id, i, before: i < 0 ? null : copy(arr[i]) }; });
  }
  function undoTo(snap) {
    return () => {
      snap.forEach(s => { if (s.kind === 'notes') app.release('note', s.id); if (s.kind === 'todos') app.release('todo', s.id); });
      snap.slice().reverse().forEach(({ kind, id, i, before }) => {
        const arr = app[kind].slice(), at = arr.findIndex(x => x.id === id);
        if (!before) { if (at >= 0) arr.splice(at, 1); }
        else if (at >= 0) arr[at] = copy(before);
        else arr.splice(Math.min(i, arr.length), 0, copy(before));
        app[kind] = arr;
      });
      done();
    };
  }

  // ---- how things are shown to Claude ----
  const day = t => t ? ymd(new Date(t)) : '';
  function noteBrief(n) {
    const b = { id: n.id, title: n.title || '' };
    const body = (n.body || '').replace(/\s+/g, ' ').trim();
    if (body) b.start = body.slice(0, 140) + (body.length > 140 ? '…' : '');
    if (n.tags.length) b.tags = n.tags;
    if (n.color && n.color !== 'none') b.color = n.color;
    if (n.pinned) b.pinned = true;
    if (n.reminder) b.nudge = localWhen(n.reminder);
    if (n.archived) b.archived = true;
    if (n.deletedAt) b.inTrash = true;
    b.created = day(n.created); b.changed = day(n.updated);
    return b;
  }
  function noteFull(n) {
    const f = { ...noteBrief(n) }; delete f.start;
    const body = n.body || '';
    f.body = body.slice(0, 20000) + (body.length > 20000 ? '\n[the rest of the note is cut off]' : '');
    if (app.looksLikeRecipe(body, n.tags)) f.looksLikeRecipe = true;
    return f;
  }
  function todoBrief(t) {
    const l = listOf(t), b = { id: t.id, title: t.title, list: l.name };
    if (t.date) b.date = t.date;
    if (t.time) b.time = t.time;
    if (t.date && t.alert != null && +t.alert !== 0) b.alert = +t.alert;
    if (t.done) b.done = true;
    if (t.flagged) b.flagged = true;
    if (t.prio) b.priority = PRIO[t.prio] || 'none';
    if (t.notes) b.notes = clip(t.notes, 300);
    if (t.tags && t.tags.length) b.tags = t.tags;
    if (app.isGrocery(l)) b.section = app.AISLE.NAMES[app.aisleOf(t)];
    return b;
  }
  const listBrief = l => {
    const mine = app.todos.filter(t => t.list === l.id);
    return { id: l.id, name: l.name, open: mine.filter(t => !t.done).length, done: mine.filter(t => t.done).length, ...(app.isGrocery(l) ? { storeSections: true } : {}) };
  };

  // ---- changes, checked as the app's sheets check them ----
  const tagsFrom = v => [...new Set((Array.isArray(v) ? v : []).map(x => app.normTag(String(x))).filter(Boolean))].slice(0, 30);
  // A reminder's fields from Claude, as the reminder's sheet takes them.
  function todoChanges(t, ch, bad) {
    if ('title' in ch) { const s = clip(ch.title, 200); if (s) t.title = s; else bad.push('title'); }
    if ('notes' in ch) t.notes = text(ch.notes, 4000).replace(/\s+$/, '');
    if ('date' in ch) { if (ch.date === '' || ch.date == null) { t.date = null; t.time = null; } else if (isDay(ch.date)) t.date = ch.date; else bad.push('date'); }
    if ('time' in ch) { if (ch.time === '' || ch.time == null) t.time = null; else if (isTime(ch.time) && t.date) t.time = ch.time; else bad.push('time'); }
    if ('alert' in ch) { if (ALERTS.includes(ch.alert)) t.alert = !t.time && ch.alert > 0 ? Math.round(ch.alert / 1440) * 1440 : ch.alert; else bad.push('alert'); }   // no time: on the day, or whole days before (as the sheet offers)
    if ('priority' in ch) { const p = PRIO.indexOf(ch.priority); if (p >= 0) t.prio = p; else bad.push('priority'); }
    if ('flagged' in ch) t.flagged = !!ch.flagged;
    if ('tags' in ch) t.tags = tagsFrom(ch.tags);
    if ('done' in ch) { const d = !!ch.done; if (d !== !!t.done) { t.done = d; t.doneAt = d ? Date.now() : null; } }
  }

  // Lines of a shopping-list note: one thing a line, bullets and headings left out.
  const ITEM = /^\s*(?:[-*+•·▪◦]|\d+[.)]|\[[ xX]\])\s*/;
  function itemsOf(body) {
    return String(body || '').split('\n').map(l => l.replace(ITEM, '').replace(/^\[[ xX]\]\s*/, '').trim())
      .filter(l => l && !/^[A-Z][A-Z &]+:?$/.test(l) && !/[:：]$/.test(l));
  }
  const learned = () => { const g = app.lists.find(l => app.isGrocery(l) && l.learn); return g ? g.learn : undefined; };

  const tools = {
    async find_notes(q) {
      const where = ['notes', 'archive', 'trash', 'all', 'pinned', 'nudges'].includes(q.where) ? q.where : 'notes';
      const query = clip(q.query, 200).toLowerCase(), tag = q.tag ? app.normTag(String(q.tag)) : '';
      const limit = Math.max(1, Math.min(100, Number.isInteger(q.limit) ? q.limit : 30));
      const all = app.notes.filter(visible);
      let list = all.filter(n => {
        if (where === 'trash' ? !n.deletedAt : n.deletedAt) return false;
        if (where === 'archive' && !n.archived) return false;
        if ((where === 'notes' || where === 'pinned' || where === 'nudges') && n.archived) return false;
        if (where === 'pinned' && !n.pinned) return false;
        if (where === 'nudges' && !n.reminder) return false;
        if (tag && !n.tags.includes(tag)) return false;
        if (q.color && (n.color || 'none') !== q.color) return false;
        if (query && !app.matchQuery(query, (n.title + '\n' + n.body + '\n' + n.tags.join(' ')).toLowerCase(), n.tags)) return false;
        return true;
      });
      list = list.sort((a, b) => where === 'nudges' ? new Date(a.reminder) - new Date(b.reminder) : (b.created || 0) - (a.created || 0));
      const hidden = app.notes.filter(n => n.private && !n.deletedAt).length;
      return { content: { found: list.length, shown: Math.min(limit, list.length), notes: list.slice(0, limit).map(noteBrief), ...(hidden ? { privateNotesNotShown: hidden } : {}) } };
    },

    async read_notes(q) {
      const ids = (Array.isArray(q.ids) ? q.ids : []).slice(0, 20);
      return { content: { notes: ids.map(id => { const n = noteById(id); return n ? noteFull(n) : { id, missing: 'No note with this id (private notes can’t be read).' }; }) } };
    },

    async create_note(q) {
      const title = clip(q.title, 200), body = text(q.body, 100000).replace(/\s+$/, '');
      if (!title && !body.trim()) fail('A new note needs a title or some text.');
      const tags = tagsFrom(q.tags); app.extractTags(body, tags);
      const n = { id: app.newId('n'), title, body, tags, color: app.COLORS.includes(q.color) ? q.color : 'none', pinned: !!q.pinned,
        reminder: isWhen(q.nudge) ? new Date(q.nudge).toISOString() : null, created: Date.now(), updated: Date.now(), archived: false, deletedAt: null };
      const snap = [{ kind: 'notes', id: n.id, i: 0, before: null }];
      app.notes = [n, ...app.notes];
      done();
      return { content: { note: noteBrief(n) }, change: { text: 'Wrote the note ' + noteName(n), undo: undoTo(snap) } };
    },

    async edit_note(q) {
      const n = noteById(q.id); if (!n) fail('No note with id ' + q.id + '.');
      const ch = q.changes && typeof q.changes === 'object' ? q.changes : {};
      app.release('note', n.id);
      const snap = snapshot([['notes', n.id]]);
      const m = app.notes.find(x => x.id === n.id), was = copy(m), bad = [];
      if ('title' in ch) m.title = clip(ch.title, 200).replace(/\s*\n+\s*/g, ' ');
      if ('body' in ch) m.body = text(ch.body, 100000).replace(/\s+$/, '');
      if ('append' in ch && clip(ch.append, 1)) { const a = text(ch.append, 20000).replace(/\s+$/, ''); m.body = m.body ? m.body.replace(/\s+$/, '') + '\n' + a : a; }
      if ('tags' in ch) m.tags = tagsFrom(ch.tags);
      if ('add_tags' in ch) tagsFrom(ch.add_tags).forEach(t => { if (!m.tags.includes(t)) m.tags.push(t); });
      if ('remove_tags' in ch) { const r = tagsFrom(ch.remove_tags); m.tags = m.tags.filter(t => !r.includes(t)); }
      if ('body' in ch || 'append' in ch) app.extractTags(m.body, m.tags);          // #words in the text are its tags, as in the editor
      if ('color' in ch) { if (app.COLORS.includes(ch.color)) m.color = ch.color; else bad.push('color'); }
      if ('pinned' in ch) m.pinned = !!ch.pinned;
      if ('nudge' in ch) { if (ch.nudge === '' || ch.nudge == null) m.reminder = null; else if (isWhen(ch.nudge)) m.reminder = new Date(ch.nudge).toISOString(); else bad.push('nudge'); }
      if ('archived' in ch) { m.archived = !!ch.archived; if (m.archived) m.pinned = false; }
      if (ch.restore_from_trash === true && m.deletedAt) { m.deletedAt = null; m.archived = false; }
      // What changed, in words for the chat.
      const said = [], diff = k => JSON.stringify(m[k]) !== JSON.stringify(was[k]);
      if (diff('deletedAt')) said.push('restored it from Trash');
      if (diff('title')) said.push('title');
      if (diff('body')) said.push('text');
      if (diff('tags')) said.push('tags');
      if (diff('color')) said.push('color');
      if (diff('reminder')) said.push(m.reminder ? 'nudge' : 'took off the nudge');
      if (diff('archived')) said.push(m.archived ? 'archived it' : 'moved it out of Archive');
      else if (diff('pinned')) said.push(m.pinned ? 'pinned it' : 'unpinned it');
      if (!said.length) return { content: { note: noteBrief(m), changed: false, message: 'It already says that.' + (bad.length ? ' Not valid: ' + bad.join(', ') : '') } };
      m.updated = Date.now();
      done();
      return { content: { note: noteBrief(m), ...(bad.length ? { skipped: bad } : {}) },
        change: { text: 'Updated ' + noteName(m) + ': ' + said.join(', '), undo: undoTo(snap) } };
    },

    // Like the app's Delete: to Trash, for 30 days. Asked first, in the chat.
    async delete_notes(q, { confirm }) {
      const ids = [...new Set(Array.isArray(q.ids) ? q.ids : [])];
      const found = ids.map(noteById).filter(n => n && !n.deletedAt), missing = ids.filter(id => !found.some(n => n.id === id));
      if (!found.length) fail('None of those notes are here (or they are already in Trash).');
      const names = found.map(noteName);
      const ok = await confirm(found.length === 1 ? 'Move the note ' + names[0] + ' to Trash?' : 'Move these ' + found.length + ' notes to Trash: ' + names.slice(0, 5).join(', ') + (found.length > 5 ? ' and ' + (found.length - 5) + ' more' : '') + '?',
        { yes: 'Move to Trash', no: 'Keep ' + (found.length === 1 ? 'it' : 'them') });
      if (!ok) return { content: { deleted: [], declined: true, note: 'The person said no, so nothing was deleted.' } };
      found.forEach(n => app.release('note', n.id));
      const snap = snapshot(found.map(n => ['notes', n.id]));
      app.notes = app.notes.map(n => found.some(f => f.id === n.id) ? { ...n, deletedAt: Date.now(), pinned: false } : n);
      done();
      return { content: { movedToTrash: found.map(n => n.id), ...(missing.length ? { missing } : {}), note: 'In Trash for 30 days; restore_from_trash brings one back.' },
        change: { text: found.length === 1 ? 'Moved ' + names[0] + ' to Trash' : 'Moved ' + found.length + ' notes to Trash', undo: undoTo(snap) } };
    },

    // The app's own Convert, for a recipe: ingredients and method in their own sections.
    async tidy_recipe(q) {
      const n = noteById(q.id); if (!n) fail('No note with id ' + q.id + '.');
      const r = app.parseRecipe(n.body || ''), c = app.countRecipe(r);
      if (!c.ings && !c.steps) fail('Couldn’t find ingredients or steps in this note.');
      app.release('note', n.id);
      const snap = snapshot([['notes', n.id]]);
      const m = app.notes.find(x => x.id === n.id);
      m.body = app.formatRecipe(r);
      if (!m.tags.includes('recipe')) m.tags = [...m.tags, 'recipe'];
      m.updated = Date.now();
      done();
      return { content: { note: noteFull(m), ingredients: c.ings, steps: c.steps }, change: { text: 'Tidied the recipe ' + noteName(m) + ': ' + c.ings + ' ingredients, ' + c.steps + ' steps', undo: undoTo(snap) } };
    },

    async get_lists() {
      return { content: { lists: app.lists.map(listBrief), alertsOnThisPhone: !!app.alertsOn() } };
    },

    async find_reminders(q) {
      const view = ['today', 'upcoming', 'flagged', 'all', 'overdue'].includes(q.view) ? q.view : 'all';
      const l = q.list ? listNamed(q.list) : null; if (q.list && !l) fail('No list called ' + clip(q.list, 60) + '. get_lists shows them.');
      const query = clip(q.query, 200).toLowerCase(), today = app.todayStr(), limit = Math.max(1, Math.min(200, Number.isInteger(q.limit) ? q.limit : 60));
      let list = app.todos.filter(t => {
        if (l && t.list !== l.id) return false;
        if (t.done && !q.include_done) return false;
        if (view === 'today' && !(t.date && t.date <= today)) return false;
        if (view === 'overdue' && !(t.date && t.date < today && !t.done)) return false;
        if (view === 'upcoming' && !t.date) return false;
        if (view === 'flagged' && !t.flagged) return false;
        if (query && !app.matchQuery(query, (t.title + '\n' + (t.notes || '') + '\n' + (t.tags || []).join(' ')).toLowerCase(), t.tags || [])) return false;
        return true;
      });
      list = list.sort((a, b) => (a.done - b.done) || String(a.date || '9999').localeCompare(String(b.date || '9999')) || String(a.time || '').localeCompare(String(b.time || '')) || (a.created || 0) - (b.created || 0));
      return { content: { found: list.length, shown: Math.min(limit, list.length), reminders: list.slice(0, limit).map(todoBrief) } };
    },

    async add_reminders(q) {
      let l = listNamed(q.list || '') || (!q.list ? app.lists[0] : null);
      const items = (Array.isArray(q.items) ? q.items : []).slice(0, 100);
      if (!items.length) fail('Nothing to add: give at least one item.');
      const snap = [];
      if (!l) {
        const name = clip(q.list, 60); if (!name) fail('Name the list.');
        if (!q.create_list) fail('There is no list called ' + name + '. Set create_list to make it.');
        l = { id: app.newId('l'), name, color: app.LIST_COLORS[app.lists.length % app.LIST_COLORS.length] };
        snap.push({ kind: 'lists', id: l.id, i: app.lists.length, before: null });
        app.lists = [...app.lists, l];
      }
      const added = [], bad = [];
      for (const it of items) {
        const raw = clip(it && it.title, 200); if (!raw) { bad.push('an item without a title'); continue; }
        const tags = tagsFrom(it.tags); app.extractTags(raw, tags);
        const title = raw.replace(/(^|\s)#[a-z0-9][\w\-]*/gi, ' ').replace(/\s+/g, ' ').trim() || raw;
        const t = { id: app.newId('t'), list: l.id, title, notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags, created: Date.now() + added.length };
        const why = [];
        todoChanges(t, { ...it, title, tags }, why);
        if (why.length) bad.push(title + ': ' + why.join(', '));
        added.push(t);
        snap.push({ kind: 'todos', id: t.id, i: app.todos.length + added.length - 1, before: null });
      }
      if (!added.length) fail('Nothing to add: ' + bad.join('; '));
      app.todos = [...app.todos, ...added];
      done();
      return { content: { list: listBrief(l), added: added.map(todoBrief), ...(bad.length ? { skipped: bad } : {}) },
        change: { text: (snap.some(s => s.kind === 'lists') ? 'Made the list ' + l.name + ' and added ' : 'Added ') + (added.length === 1 ? quote(added[0].title) : added.length + ' things') + ' to ' + l.name, undo: undoTo(snap) } };
    },

    async update_reminder(q) {
      const t0 = todoById(q.id); if (!t0) fail('No reminder with id ' + q.id + '.');
      const ch = q.changes && typeof q.changes === 'object' ? q.changes : {};
      app.release('todo', t0.id);
      const to = 'list' in ch ? listNamed(ch.list) : null;
      if ('list' in ch && !to) fail('No list called ' + clip(ch.list, 60) + '.');
      const snap = snapshot([['todos', t0.id], ['lists', t0.list], ...(to && to.id !== t0.list ? [['lists', to.id]] : [])]);
      const t = app.todos.find(x => x.id === t0.id), was = JSON.stringify(t), bad = [];
      todoChanges(t, ch, bad);
      if (to) t.list = to.id;
      let learnt = false;
      if ('section' in ch) {
        const l = listOf(t), s = ch.section;
        if (!app.isGrocery(l)) bad.push('section (' + l.name + ' isn’t sorted into store sections)');
        else if (s === 'auto' || s === '') { delete t.aisle; app.learnAisle(t, null); learnt = true; }
        else if (app.AISLE.NAMES[s]) { t.aisle = s; app.learnAisle(t, s); learnt = true; }
        else bad.push('section');
      }
      if (JSON.stringify(t) === was && !learnt) return { content: { reminder: todoBrief(t), changed: false, note: 'It already says that.' + (bad.length ? ' Not valid: ' + bad.join(', ') : '') } };
      done();
      return { content: { reminder: todoBrief(t), ...(bad.length ? { skipped: bad } : {}) }, change: { text: 'Changed ' + quote(t.title) + ' in ' + listOf(t).name, undo: undoTo(snap) } };
    },

    async set_done(q) {
      const ids = [...new Set(Array.isArray(q.ids) ? q.ids : [])], d = q.done !== false;
      const found = ids.map(todoById).filter(Boolean), missing = ids.filter(id => !todoById(id));
      if (!found.length) fail('None of those reminders are here.');
      found.forEach(t => app.release('todo', t.id));
      const change = found.filter(t => !!t.done !== d);
      if (!change.length) return { content: { changed: [], note: 'They are already ' + (d ? 'done' : 'not done') + '.' } };
      const snap = snapshot(change.map(t => ['todos', t.id]));
      app.todos = app.todos.map(t => change.some(c => c.id === t.id) ? { ...t, done: d, doneAt: d ? Date.now() : null } : t);
      done();
      const names = change.map(t => quote(t.title));
      return { content: { changed: change.map(t => t.id), ...(missing.length ? { missing } : {}) },
        change: { text: (d ? 'Checked off ' : 'Unchecked ') + (names.length <= 3 ? names.join(', ') : names.length + ' things'), undo: undoTo(snap) } };
    },

    async remove_reminders(q) {
      const ids = [...new Set(Array.isArray(q.ids) ? q.ids : [])];
      const found = ids.map(todoById).filter(Boolean), missing = ids.filter(id => !todoById(id));
      if (!found.length) fail('None of those reminders are here.');
      found.forEach(t => app.release('todo', t.id));
      const snap = snapshot(found.map(t => ['todos', t.id])), names = found.map(t => quote(t.title));
      app.todos = app.todos.filter(t => !found.some(f => f.id === t.id));
      done();
      return { content: { removed: found.map(t => t.id), ...(missing.length ? { missing } : {}) },
        change: { text: 'Removed ' + (names.length <= 3 ? names.join(', ') : names.length + ' things'), undo: undoTo(snap) } };
    },

    // The app's grocery sections (../home/aisles.js): a list shows its items under store sections
    // once it's sorted; a shopping-list note is rewritten with a heading for each section.
    async sort_into_aisles(q) {
      const A = app.AISLE;
      if (q.list) {
        const l = listNamed(q.list); if (!l) fail('No list called ' + clip(q.list, 60) + '.');
        const open = app.todos.filter(t => t.list === l.id && !t.done);
        let change;
        if (!app.isGrocery(l)) {
          const snap = snapshot([['lists', l.id]]);
          app.lists = app.lists.map(x => x.id === l.id ? { ...x, grocery: true } : x);
          done();
          change = { text: 'Sorted ' + l.name + ' into store sections', undo: undoTo(snap) };
        }
        const groups = A.SECTIONS.map(s => ({ section: s.name, items: open.filter(t => app.aisleOf(t) === s.id).map(t => ({ id: t.id, title: t.title })) })).filter(g => g.items.length);
        return { content: { list: l.name, sections: groups, note: 'The list now shows its items under these store sections, in supermarket order.' }, ...(change ? { change } : {}) };
      }
      const n = noteById(q.note_id); if (!n) fail('Give a list, or the id of a note.');
      const items = itemsOf(n.body);
      if (!items.length) fail('That note has no lines to sort.');
      const learn = learned();
      const groups = A.SECTIONS.map(s => ({ s, items: items.filter(x => A.sectionOf(x, learn) === s.id) })).filter(g => g.items.length);
      app.release('note', n.id);
      const snap = snapshot([['notes', n.id]]);
      const m = app.notes.find(x => x.id === n.id);
      m.body = groups.map(g => g.s.name.toUpperCase() + '\n' + g.items.map(x => '• ' + x).join('\n')).join('\n\n');
      m.updated = Date.now();
      done();
      return { content: { note: noteBrief(m), sections: groups.map(g => ({ section: g.s.name, items: g.items })) },
        change: { text: 'Sorted ' + noteName(m) + ' into store sections', undo: undoTo(snap) } };
    },

    async show(q) {
      if (q.note_id) { const n = noteById(q.note_id); if (!n) fail('No note with id ' + q.note_id + '.'); app.showNote(n.id); return { content: { shown: n.id, note: 'It is open behind the chat; closing the chat shows it.' } }; }
      if (q.list) { const l = listNamed(q.list); if (!l) fail('No list called ' + clip(q.list, 60) + '.'); app.showList(l.id); return { content: { shown: l.name, note: 'Reminders is showing this list behind the chat.' } }; }
      fail('Give a note_id or a list.');
    },
  };

  const LABELS = {
    find_notes: () => 'Looking through your notes', read_notes: () => 'Reading notes', create_note: () => 'Writing a note', edit_note: () => 'Updating a note',
    delete_notes: i => 'Deleting ' + ((i.ids || []).length === 1 ? 'a note' : 'notes'), tidy_recipe: () => 'Tidying a recipe',
    get_lists: () => 'Looking at your lists', find_reminders: () => 'Looking at your reminders',
    add_reminders: i => 'Adding to ' + (clip(i.list, 40) || 'a list'), update_reminder: () => 'Updating a reminder',
    set_done: i => i.done === false ? 'Unchecking' : 'Checking things off', remove_reminders: () => 'Removing from a list',
    sort_into_aisles: () => 'Sorting into store sections', show: () => 'Opening it',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const live = app.notes.filter(n => !n.deletedAt), seen = live.filter(visible), priv = live.length - seen.length;
      const open = app.todos.filter(t => !t.done).length;
      return 'Notes has ' + seen.filter(n => !n.archived).length + ' notes' + (seen.some(n => n.archived) ? ' (and ' + seen.filter(n => n.archived).length + ' in Archive)' : '')
        + (priv ? ', plus ' + priv + ' private ' + (priv === 1 ? 'one' : 'ones') + ' you can’t see' : '')
        + ', and ' + open + ' open reminders in the lists ' + app.lists.map(l => l.name).join(', ') + '. On screen: ' + app.screen() + '.';
    },
    intro: 'Hi, I’m Ipsy! I can find a note, write or tidy one, add to your lists, check things off, sort the groceries into store sections, set a reminder, or look something up on the web.',
    placeholder: 'Ask Ipsy about your notes',
    suggestions: ['What’s on my grocery list?', 'Sort the groceries by aisle', 'Find my notes about the house', 'Remind me to call Mom tomorrow at 5'],
    consent: 'Ipsy runs on Claude, by Anthropic. When you ask something, your question and the notes, reminders and lists Ipsy reads to answer it go to Claude through the family server, which keeps only a count of questions. Private notes are hidden from Ipsy: it never sees them. Ipsy can write, change and check off things: each change shows here with Undo, and it asks before deleting a note.',
  };
};
