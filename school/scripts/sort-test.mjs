// School's reading of ParentSquare emails (school/sort.js), in Node: digests split into posts, what each
// post is and whose, the dates in its words, the next school day, and the sections.
//   node school/scripts/sort-test.mjs
// Every name, post and school here is made up (the repository is public).
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const dir = path.dirname(new URL(import.meta.url).pathname);
vm.runInThisContext(fs.readFileSync(path.join(dir, '..', 'sort.js'), 'utf8'));
const S = globalThis.SchoolSort;
const F = await import(path.join(dir, 'fixtures.mjs'));

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const at = (s, hh = 18, mm = 0) => { const d = S.noon(s); d.setHours(hh, mm, 0, 0); return d; };
const read = list => list.flatMap(m => S.readEmail(m));
const ME = { homeroom: 'Homeroom_Rivera', grade: 0, ends: '15:15', pickupBy: '15:40', lane: 'Lane 1', clubs: { 2: { name: 'Calm Kids Club', until: '15:50', room: 'Room 12' } } };

test('a digest becomes one item a post, with its author, groups and link', () => {
  const xs = S.readEmail(F.digest);
  assert.equal(xs.length, 5);
  assert.deepEqual(xs.map(x => x.title), ['Relief Friday - October 30th - No School', 'Lost and Found – One Week to Claim Items!', 'Wear Pink on THURSDAY', 'Character Dress Up', '4th and 5th grade Basketball']);
  assert.equal(xs[3].author, 'Lena Rivera');
  assert.deepEqual(xs[3].groups, ['Homeroom_Rivera']);
  assert.match(xs[0].url, /^https:\/\/www\.parentsquare\.com\/feeds\/1001/);
  assert.ok(!/To see the post/.test(xs[0].body), 'the link line is taken out of the words');
  assert.ok(!/You received this email/.test(xs[4].body), 'and the footer');
  assert.equal(new Set(xs.map(x => x.id)).size, 5);
});

test('what each post is', () => {
  const xs = S.readEmail(F.digest);
  assert.deepEqual(xs.map(x => x.kind), ['noschool', 'post', 'wear', 'wear', 'post']);
  assert.equal(S.readEmail(F.post)[0].kind, 'form');
  assert.equal(S.readEmail(F.event)[0].kind, 'event');
  assert.equal(S.readEmail(F.rsvp)[0].kind, 'rsvp');
  assert.equal(S.readEmail(F.rsvpYes)[0].rsvp, 'yes');
  assert.equal(S.readEmail(F.signup)[0].kind, 'signup');
  assert.equal(S.readEmail(F.signup)[0].needs, 1);
  assert.equal(S.readEmail(F.message)[0].kind, 'message');
  assert.equal(S.readEmail(F.receipt)[0].kind, 'paid');
  assert.equal(S.readEmail(F.receipt)[0].amount, '37.00');
  assert.equal(S.readEmail(F.report)[0].kind, 'report');
  assert.equal(S.readEmail(F.report)[0].child, 'Ava Example');
  assert.equal(S.readEmail(F.clubOff)[0].kind, 'clubOff');
  assert.equal(S.readEmail(F.picture)[0].picture, true);
});

test('the dates in the words, with the year from when it was sent', () => {
  const ref = at('2026-10-28').getTime();
  const ds = s => S.parseDates(s, ref).map(d => d.d + (d.end ? '..' + d.end : '') + (d.time ? '@' + d.time : ''));
  assert.deepEqual(ds('Friday, Oct 30'), ['2026-10-30']);
  assert.deepEqual(ds('on Thursday, October 29th at 6:00 PM'), ['2026-10-29@18:00']);
  assert.deepEqual(ds('November 16–20'), ['2026-11-16..2026-11-20']);
  assert.deepEqual(ds('Winter Break: December 21 - January 1'), ['2026-12-21..2027-01-01']);
  assert.deepEqual(ds('Sept 3 and Sep 14'), ['2026-09-03', '2026-09-14']);
  assert.deepEqual(ds('Pick up by January 8'), ['2027-01-08'], 'early in the next year');
  assert.deepEqual(ds('Students may wear pink tomorrow'), ['2026-10-29'], 'tomorrow, from the day it was posted');
  assert.deepEqual(ds('the 10/30/2026 newsletter'), ['2026-10-30']);
  assert.deepEqual(ds('Week 13 Newsletter, 3:15-3:50'), [], 'times and week numbers are not dates');
  assert.deepEqual(ds('February 30'), [], 'no such day');
});

test('grades named in words', () => {
  const g = s => [...S.gradesIn(s)].sort((a, b) => a - b);
  assert.deepEqual(g('4th and 5th grade Basketball'), [4, 5]);
  assert.deepEqual(g('K-3 Specials'), [0, 1, 2, 3]);
  assert.deepEqual(g('Grades 4–7 Choir'), [4, 5, 6, 7]);
  assert.deepEqual(g('Kindergarten Character Day'), [0]);
  assert.deepEqual(g('our 2nd Annual Trunk or Treat'), []);
  assert.deepEqual(g('99th percentile'), []);
  assert.deepEqual(g('Kinders to the zoo'), [0]);
  assert.deepEqual(g('Kindergartners and 1st graders'), [0, 1]);
  assert.deepEqual(g('Grade K Picnic'), [0]);
  assert.deepEqual(g('K/1 Sing-along'), [0, 1]);
  assert.deepEqual(g('Pre-K Picnic'), [-1], 'Pre-K is not Kindergarten');
  assert.deepEqual(g('Pre-Kindergarten Open House'), [-1]);
  assert.deepEqual(g('TK and Kindergarten families'), [-1, 0]);
  assert.deepEqual(g('Middle School Dance'), [6, 7, 8]);
  assert.deepEqual(g('5K Fun Run'), [], 'a race, not a grade');
});

// A whole-school newsletter: its dates for other grades are left out, its dates for no grade in particular are
// kept, and a heading names the grade for the dates under it.
const NEWS = { id: 'n9', threadId: 'n9', date: at('2026-10-25', 17).getTime(), subject: 'Maple Grove Times 10/25/2026',
  text: '## Upcoming Events\n\n**November**\n\n- **November 3** – Kindergarten Pumpkin Patch Trip\n- **November 4** – 3rd Grade Wax Museum\n- **November 5** – Middle School Dance\n'
    + '- **November 6** – Pre-K Picnic\n- **November 9** – Family Bingo Night\n- **November 10** – K-2 Assembly\n- **November 12** – No School for 5th Grade (Camp)\n\n'
    + '**5th Grade Corner**\n\n- **November 16** – Science Camp Forms Due\n- **November 17** – Camp Packing Night\n\n**Kindergarten Corner**\n\n- **November 18** – Field Trip to the Farm\n\n'
    + '**Everyone**\n\n- **November 19** – Picture Retakes\n' };

test('a newsletter’s dates for other grades are left out; ones for hers, or for no grade, stay', () => {
  const s = S.sections(read([NEWS]), { now: at('2026-11-01', 9), me: ME });
  const titles = s.year.map(e => e.title);
  for (const t of ['Kindergarten Pumpkin Patch Trip', 'Family Bingo Night', 'K-2 Assembly', 'Field Trip to the Farm', 'Picture Retakes']) assert.ok(titles.includes(t), t + ' is kept: ' + titles.join(' | '));
  for (const t of ['3rd Grade Wax Museum', 'Middle School Dance', 'Pre-K Picnic', 'Science Camp Forms Due', 'Camp Packing Night']) assert.ok(!titles.includes(t), t + ' is left out');
  assert.ok(!s.off.has('2026-11-12'), 'no school for 5th grade is a school day for her');
  // with no grade known, nothing is left out
  const all = S.sections(read([NEWS]), { now: at('2026-11-01', 9), me: { ...ME, grade: null } }).year.map(e => e.title);
  assert.ok(all.includes('3rd Grade Wax Museum') && all.includes('Camp Packing Night'), 'no grade: everything');
  // and Calendar's School layer is the same
  const c = S.calendarItems(read([NEWS]), { now: at('2026-11-01', 9), me: ME }).map(e => e.title);
  assert.ok(c.includes('Family Bingo Night') && !c.includes('3rd Grade Wax Museum') && !c.includes('Camp Packing Night'), c.join(' | '));
});

test('a newsletter read before its dates kept their grades is sorted the same', () => {
  const [x] = read([NEWS]); delete x.evv; x.events = x.events.map(({ g, ...e }) => e);
  const titles = S.sections([x], { now: at('2026-11-01', 9), me: ME }).year.map(e => e.title);
  assert.ok(titles.includes('Field Trip to the Farm') && !titles.includes('Camp Packing Night'), titles.join(' | '));
});

test('a school-wide post with a date for each grade keeps hers, and the dates no grade is named for', () => {
  const m = { id: 'pd1', threadId: 'pd1', date: at('2026-10-26', 9).getTime(), subject: 'Picture Day',
    text: 'Sam Ortiz posted in Maple Grove Academy\n\nPicture Day\n\nPicture day is coming! Kindergarten: Tuesday, November 3. 1st grade: Wednesday, November 4. 2nd grade: Thursday, November 5.\nRetakes for everyone on December 1.\n' };
  const s = S.sections(read([m]), { now: at('2026-11-01', 9), me: ME });
  const days = s.year.filter(e => e.title === 'Picture Day').map(e => e.d);
  assert.deepEqual(days, ['2026-11-03', '2026-12-01'], days.join());
});

test('whose a post is: her class, her grade, the school, or another grade', () => {
  const xs = read(F.ALL), by = t => S.audience(xs.find(x => x.title === t), ME);
  assert.equal(by('Character Dress Up'), 'class', 'her homeroom');
  assert.equal(by('Kindergarten Book Buddies'), 'class', 'posted to her grade alone');
  assert.equal(by('Wear Pink on THURSDAY'), 'school');
  assert.equal(by('4th and 5th grade Basketball'), 'other', 'other grades, posted to the whole school');
  assert.equal(by('Hello from Calm Kids Club!'), 'class', 'a club');
  assert.equal(by('Can she wear pink tomorrow? Yes, every Friday this month.'), 'class', 'a message to you');
  assert.equal(by('T1 Report Card'), 'record');
});

test('what the emails say about the child, for Settings', () => {
  const d = S.detect(read(F.ALL));
  assert.equal(d.homeroom, 'Homeroom_Rivera');
  assert.equal(d.grade, 0);
  assert.equal(d.teacher, 'Lena Rivera');
  assert.equal(d.school, 'Maple Grove Academy');
});

test('a newsletter: its list of dates, and days off from it', () => {
  const x = S.readEmail(F.newsletter)[0];
  assert.equal(x.kind, 'newsletter');
  const ev = x.events.map(e => e.d + (e.end ? '..' + e.end : '') + ' ' + e.what);
  assert.ok(ev.includes('2026-10-30 Relief Friday (No School)'), ev.join(' | '));
  assert.ok(ev.includes('2026-11-11 Observance of Veterans Day (No School)'));
  assert.ok(ev.includes('2026-11-18 Autumn Music Showcase at 6:00 PM'));
  assert.ok(ev.includes('2026-11-23..2026-11-27 Fall Break (No School)'));
  assert.ok(ev.includes('2026-12-21..2027-01-01 Winter Break'));
  const off = S.daysOff([x]);
  for (const d of ['2026-10-30', '2026-11-11', '2026-11-23', '2026-11-27', '2026-12-21', '2027-01-01']) assert.ok(off.has(d), d);
  assert.ok(!off.has('2026-11-13'), 'Kindness Day is a school day');
  assert.equal(x.events.find(e => /Showcase/.test(e.what)).time, '18:00');
});

test('the top card: today until school is out, then the next school day, every day of the week', () => {
  const off = S.daysOff(read(F.ALL));
  const f = (d, h, m) => { const r = S.focusDay(at(d, h, m), off, ME); return r.label + ' ' + r.d + (r.gaps.length ? ' (' + r.gaps.map(g => g.d + (g.end !== g.d ? '..' + g.end : '') + ' ' + g.why).join(', ') + ')' : ''); };
  assert.equal(f('2026-10-27', 8, 0), 'Today 2026-10-27');
  assert.equal(f('2026-10-27', 15, 14), 'Today 2026-10-27');
  assert.equal(f('2026-10-27', 15, 15), 'Tomorrow 2026-10-28', 'at 3:15 the card moves on');
  assert.equal(f('2026-10-29', 16, 0), 'Monday 2026-11-02 (2026-10-30 Relief Friday)', 'Thursday afternoon, with Friday off');
  assert.equal(f('2026-10-30', 9, 0), 'Monday 2026-11-02', 'on the day off itself');
  assert.equal(f('2026-10-31', 9, 0), 'Monday 2026-11-02', 'Saturday');
  assert.equal(f('2026-11-01', 20, 0), 'Tomorrow 2026-11-02', 'Sunday evening');
  assert.equal(f('2026-11-10', 16, 0), 'Thursday 2026-11-12 (2026-11-11 Observance of Veterans Day)');
  assert.equal(f('2026-11-20', 16, 0), 'Monday 2026-11-30 (2026-11-23..2026-11-27 Fall Break)', 'a week off, at a month’s end');
  assert.equal(f('2026-12-31', 9, 0), 'Monday 2027-01-04 (2027-01-01 Winter Break)', 'over the new year');
});

test('pickup: the usual carpool, or the club on that weekday', () => {
  assert.equal(S.pickup('2026-10-26', ME).text, 'Pickup 3:15 pm–3:40 pm, Lane 1.');
  assert.equal(S.pickup('2026-10-27', ME).text, 'Calm Kids Club until 3:50 pm, Room 12. Pickup at 3:50 pm.');
  assert.equal(S.clock('08:00'), '8:00 am');
  const care = Object.assign({}, ME, { care: true, careUntil: '18:00' });
  assert.equal(S.pickup('2026-10-26', care).text, 'After-school care until 6:00 pm. Pickup by 6:00 pm.');
  assert.equal(S.pickup('2026-10-27', care).text, 'Calm Kids Club until 3:50 pm, Room 12, then after-school care until 6:00 pm. Pickup by 6:00 pm.');
  assert.equal(S.child([], { care: 'on' }).care, true, 'from Settings');
});

test('the sections, on a Wednesday evening', () => {
  const s = S.sections(read(F.ALL), { now: at('2026-10-28', 19), me: ME });
  assert.equal(s.top.label, 'Tomorrow');
  assert.equal(s.top.d, '2026-10-29');
  const lines = s.top.lines.map(l => l.title);
  assert.ok(lines.includes('Wear Pink on THURSDAY'), lines.join(' | '));
  assert.ok(lines.includes('Character Dress Up'));
  assert.ok(!lines.some(l => /Basketball/.test(l)), 'another grade’s post stays off');
  // Needs you: her sign-up and the RSVP; the RSVP already answered and the other grades' form are not there
  const needs = s.needs.map(x => x.title);
  assert.ok(needs.includes('Week 13 Newsletter_Important Updates (READ)'), needs.join(' | '));
  assert.ok(needs.includes('Kindergarten Book Buddies'));
  assert.ok(!needs.includes('November Movie Night'), 'answered: You RSVP’d YES');
  assert.ok(!needs.some(t => /Basketball/.test(t)));
  // Coming up: the next two weeks, soonest first, including the newsletter's list
  const coming = s.coming.map(e => e.d + ' ' + e.title);
  assert.ok(coming.includes('2026-10-30 Relief Friday - October 30th - No School') || coming.includes('2026-10-30 Relief Friday (No School)'), coming.join(' | '));
  assert.ok(coming.includes('2026-11-06 STEAM Identity Day Events'));
  assert.ok(!coming.some(c => /Showcase/.test(c)), 'Nov 18 is more than two weeks off');
  assert.deepEqual(s.coming.map(e => e.d), [...s.coming.map(e => e.d)].sort());
  // From the class: newest first; the rest; the records
  assert.equal(s.cls[0].at >= s.cls[s.cls.length - 1].at, true);
  assert.ok(s.cls.some(x => x.kind === 'message'));
  assert.ok(s.rest.some(x => /Basketball/.test(x.title)), 'other grades go to Everything else, not away');
  assert.equal(s.records.length, 1);
  assert.equal(s.paid.length, 1);
});

test('done and moved', () => {
  const xs = read(F.ALL), sign = xs.find(x => x.kind === 'signup');
  const s = S.sections(xs, { now: at('2026-10-28', 19), me: ME, done: { [sign.id]: Date.now() } });
  assert.ok(!s.needs.some(x => x.id === sign.id), 'marked done');
  const ball = xs.find(x => /Basketball/.test(x.title));
  const s2 = S.sections(xs, { now: at('2026-10-28', 19), me: ME, moved: { [ball.id]: 'class' } });
  assert.ok(s2.cls.some(x => x.id === ball.id), 'moved into From the class');
});

test('old asks leave Needs you', () => {
  const s = S.sections(read(F.ALL), { now: at('2026-12-15', 9), me: ME });
  assert.ok(!s.needs.some(x => /Book Buddies|Week 13/.test(x.title)), s.needs.map(x => x.title).join(' | '));
});

test('Calendar’s School layer: days off, events and what’s due, without sign-in links', () => {
  const c = S.calendarItems(read(F.ALL), { me: ME });
  assert.ok(c.some(e => e.kind === 'off' && e.date === '2026-10-30'));
  assert.ok(c.some(e => e.kind === 'off' && e.date === '2026-11-25'));
  assert.ok(c.some(e => e.title === 'Autumn Music Showcase at 6:00 PM' && e.time === '18:00'));
  assert.ok(!JSON.stringify(c).includes('parentsquare.com'), 'no links');
  assert.ok(!c.some(e => /Basketball/.test(e.title)));
});

test('an email with only HTML reads the same as its text', () => {
  const html = '<html><body><p>Dear families,</p><table><tr><td><h2>1. Wear Pink on THURSDAY</h2></td></tr><tr><td>Posted by Sam Ortiz on Wednesday, Oct 28 at 3:52 PM in Maple Grove Academy</td></tr>'
    + '<tr><td><p>Students may wear pink tomorrow instead of their uniform.&nbsp;</p><p>To see the post and comment, please visit the following link: <a href="https://www.parentsquare.com/feeds/2001?s=x">https://www.parentsquare.com/feeds/2001?s=x</a></p></td></tr></table><hr>'
    + '<p>You received this email because you are a ParentSquare user in Maple Grove Academy.</p></body></html>';
  const xs = S.readEmail({ id: 'h1', threadId: 'h1', subject: 'Oct 28, 2026 Digest: 1 new message from Maple Grove Academy today', date: at('2026-10-28').getTime(), html });
  assert.equal(xs.length, 1);
  assert.equal(xs[0].title, 'Wear Pink on THURSDAY');
  assert.equal(xs[0].kind, 'wear');
  assert.equal(xs[0].dates[0].d, '2026-10-29');
  assert.equal(xs[0].school, 'Maple Grove Academy');
  assert.equal(xs[0].url, 'https://www.parentsquare.com/feeds/2001?s=x');
});

test('the school’s other sites, from the links in its emails', () => {
  const [x] = S.readEmail({ id: 'l1', threadId: 'l1', date: Date.now(), subject: 'Maple Grove Times 10/25/2026', text: 'Important Links:\n\n[**ACADEMIC CALENDAR**](https://example.org/academic-calendar)\n\n[**INFINITE CAMPUS**](https://example.org/campus/portal/x.jsp)\n\nThe menus are online: [https://madeup.nutrislice.com/menu](https://email-link.example.com/ls/click?upn=1)' });
  const s = S.sites([x]).map(l => l.name + ' ' + l.u);
  assert.deepEqual(s, ['Infinite Campus https://example.org/campus/portal/x.jsp', 'Lunch menu https://madeup.nutrislice.com/menu', 'Academic calendar https://example.org/academic-calendar']);
});

test('the weather at drop-off and pickup, from the hourly forecast', () => {
  const h = { time: ['2026-10-29T07:00', '2026-10-29T15:00'], temperature_2m: [10, 20], precipitation_probability: [5, 60], weather_code: [0, 61] };
  assert.equal(S.wxAt(h, '2026-10-29', '07:45').text, '50°, clear');
  assert.equal(S.wxAt(h, '2026-10-29', '15:15').text, '68°, rain, 60%');
  assert.equal(S.wxAt(h, '2026-10-29', '15:15').wet, true);
  assert.equal(S.wxAt(h, '2026-10-29', '15:15', false).text, '20°, rain, 60%', 'Celsius');
  assert.equal(S.wxAt(h, '2026-10-30', '07:45'), null, 'no forecast for that day');
});

test('the part of a newsletter about one of its dates, not the whole newsletter', () => {
  const x = S.readEmail(F.newsletter)[0];
  const steam = S.excerpt(x.body, 'STEAM Identity Day Events', '2026-11-06');
  assert.ok(steam, 'found');
  assert.match(steam.text, /^🔬Save the Date – 🚀 STEAM Identity Day – November 6!/, 'from its heading');
  assert.match(steam.text, /host a table/, 'and the paragraphs under it');
  assert.ok(!/Autumn Music Showcase/.test(steam.text), 'up to the next heading');
  assert.ok(!/Boo Buddies/.test(steam.text), 'not the list of dates');
  assert.equal(x.body.slice(steam.start, steam.end).trim(), steam.text, 'where it is, to scroll to');
  const show = S.excerpt(x.body, 'Autumn Music Showcase at 6:00 PM', '2026-11-18');
  assert.match(show.text, /^Autumn Music Showcase\n\nJoin us on November 18/);
  assert.equal(S.excerpt(x.body, 'Kindness Day', '2026-11-13').text.split('\n').length, 1, 'only in the list: its own line');
  assert.equal(S.excerpt(x.body, 'Pumpkin Patch Trip', '2026-11-02'), null, 'nothing about it');
  assert.equal(S.excerpt('Short post.', 'Short post', '2026-11-02'), null, 'a short post needs none');
});

test('a newsletter in HTML: its list read as a list, line endings and all', () => {
  const html = '<table><tr><td><h2>Upcoming Events</h2>\r\n<p><b>November</b></p>\r\n<ul>\r\n<li><p>November 9–20 📝 – NC Check-In A Testing Window</p></li>\r\n<li><p>November 30 📊 – Beginning of MAP Testing Window</p></li>\r\n</ul></td></tr>'
    + '<tr><td><h2>📚 NC Check-Ins Prep Made Easy with IXL!</h2><p>The NC Check-Ins are coming November 9–20! A little practice each day can make a difference.</p></td></tr>'
    + '<tr><td><h2>Science Fair</h2><ul><li><p>October 2: Procedure Section due for Grades 5–7</p></li><li><p>November 16–20: Classroom-Level Preliminary Round</p></li></ul></td></tr></table>'
    + '<p>' + 'More news. '.repeat(40) + '</p>';
  const x = S.readEmail({ id: 'h2', threadId: 'h2', subject: 'Maple Grove Times 10/25/2026', date: at('2026-10-25').getTime(), html })[0];
  assert.match(x.body, /^- November 9–20 📝 – NC Check-In A Testing Window\n- November 30/m, 'each item on its own line, under the one before');
  assert.deepEqual(x.events.map(e => e.what), ['NC Check-In A Testing Window', 'Beginning of MAP Testing Window', 'Procedure Section due for Grades 5–7', 'Classroom-Level Preliminary Round'], 'named by the words after the date');
  assert.match(S.excerpt(x.body, 'NC Check-In A Testing Window', '2026-11-09').text, /^📚 NC Check-Ins Prep Made Easy with IXL!\n\nThe NC Check-Ins are coming/, 'its section, not the list');
  assert.equal(S.excerpt(x.body, 'Beginning of MAP Testing Window', '2026-11-30').text, 'November 30 📊 – Beginning of MAP Testing Window', 'only in the list: its own line');
});

console.log(n + ' tests passed');
