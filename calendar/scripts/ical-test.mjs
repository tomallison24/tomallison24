// Checks calendar/ical.js in plain Node: reading and writing .ics text,
// zones, repeat rules across daylight-saving changes, skipped and changed
// occurrences, VTIMEZONE blocks, and the words for a rule.
//
//   node calendar/scripts/ical-test.mjs
import fs from 'fs';
import assert from 'assert/strict';

const src = fs.readFileSync(new URL('../ical.js', import.meta.url), 'utf8');
await import('data:text/javascript,' + encodeURIComponent(src));
const I = globalThis.AllisonICal;

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const TZ = 'America/Denver';
const ics = (...ev) => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n' + ev.map(e => 'BEGIN:VEVENT\r\n' + e.join('\r\n') + '\r\nEND:VEVENT\r\n').join('') + 'END:VCALENDAR\r\n';
const iso = ms => new Date(ms).toISOString();
const local = (ms, tz = TZ) => { const w = I.utcToZoned(ms, tz); return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')} ${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`; };

await test('parses folded lines, parameters and escapes, and writes them back', () => {
  const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Dinner\\, with friends\\; late\r\nDESCRIPTION:Line one\r\n  continues here\\nSecond line\r\nATTENDEE;CN="Smith, Jo";PARTSTAT=ACCEPTED:mailto:jo@example.com\r\nDTSTART;TZID=America/Denver:20261016T190000\r\nX-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT30M\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const cal = I.parse(text);
  const ev = I.children(cal, 'VEVENT')[0];
  assert.equal(I.text(ev, 'SUMMARY'), 'Dinner, with friends; late');
  assert.equal(I.text(ev, 'DESCRIPTION'), 'Line one continues here\nSecond line');
  const att = I.prop(ev, 'ATTENDEE');
  assert.equal(att.params.CN, 'Smith, Jo'); assert.equal(att.params.PARTSTAT, 'ACCEPTED');
  assert.deepEqual(I.dateProp(ev, 'DTSTART'), { kind: 'datetime', y: 2026, m: 10, d: 16, h: 19, mi: 0, s: 0, utc: false, tzid: 'America/Denver' });
  const out = I.serialize(cal);
  assert.ok(out.includes('ATTENDEE;CN="Smith, Jo";PARTSTAT=ACCEPTED:mailto:jo@example.com'));
  assert.ok(out.includes('SUMMARY:Dinner\\, with friends\\; late'));
  assert.ok(out.includes('X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT30M'), 'unknown properties survive');
  assert.deepEqual(I.parse(out), cal, 'a second read gives the same tree');
  const long = I.serialize(I.component('VEVENT', [['DESCRIPTION', 'x'.repeat(200)]]));
  assert.ok(long.split('\r\n').every(l => l.length <= 75), 'lines are folded at 75');
  assert.equal(I.text(I.parse('BEGIN:VCALENDAR\r\n' + long + 'END:VCALENDAR\r\n').children[0], 'DESCRIPTION'), 'x'.repeat(200));
});

await test('zones: wall time to moment and back, including the spring gap', () => {
  assert.equal(iso(I.zonedToUtc({ y: 2026, m: 10, d: 16, h: 7, mi: 5, s: 0 }, TZ)), '2026-10-16T13:05:00.000Z');
  assert.equal(iso(I.zonedToUtc({ y: 2026, m: 12, d: 16, h: 7, mi: 5, s: 0 }, TZ)), '2026-12-16T14:05:00.000Z');
  assert.equal(iso(I.zonedToUtc({ y: 2026, m: 3, d: 29, h: 12, mi: 0, s: 0 }, 'Europe/London')), '2026-03-29T11:00:00.000Z');
  assert.deepEqual(I.utcToZoned(Date.UTC(2026, 9, 16, 13, 5), TZ), { y: 2026, m: 10, d: 16, h: 7, mi: 5, s: 0 });
  // 02:30 on 8 March 2026 does not exist in Denver; it lands an hour on.
  assert.equal(local(I.zonedToUtc({ y: 2026, m: 3, d: 8, h: 2, mi: 30, s: 0 }, TZ)), '2026-03-08 03:30');
  assert.equal(I.resolveTz('Mountain Standard Time'), 'America/Denver');
  assert.equal(I.resolveTz('/freeassociation.sourceforge.net/Europe/Paris'), 'Europe/Paris');
  assert.equal(I.resolveTz('Nowhere/Land'), null);
  assert.equal(I.validTz('America/Denver'), true); assert.equal(I.validTz('Mars/Olympus'), false);
});

await test('a single timed event and an all-day event', () => {
  const cal = I.parse(ics(['UID:a', 'DTSTART;TZID=America/Denver:20261016T190000', 'DTEND;TZID=America/Denver:20261016T203000', 'SUMMARY:Dinner', 'LOCATION:Home'],
    ['UID:b', 'DTSTART;VALUE=DATE:20261017', 'DTEND;VALUE=DATE:20261019', 'SUMMARY:Away']));
  const from = Date.UTC(2026, 9, 1), to = Date.UTC(2026, 10, 1);
  const occ = I.expand(cal, from, to, TZ);
  assert.equal(occ.length, 2);
  assert.equal(iso(occ[0].start), '2026-10-17T01:00:00.000Z'); assert.equal(iso(occ[0].end), '2026-10-17T02:30:00.000Z');
  assert.equal(occ[0].summary, 'Dinner'); assert.equal(occ[0].startDate, '2026-10-16'); assert.equal(occ[0].allDay, false); assert.equal(occ[0].recurring, false);
  assert.equal(occ[1].allDay, true); assert.equal(occ[1].startDate, '2026-10-17'); assert.equal(occ[1].endDate, '2026-10-19');
  assert.equal(I.expand(cal, Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1), TZ).length, 0, 'nothing outside the range');
  // An all-day event that straddles the range's start is still in
  assert.equal(I.expand(cal, I.zonedToUtc({ y: 2026, m: 10, d: 18 }, TZ), to, TZ).map(o => o.uid).join(), 'b');
});

await test('weekly on Monday and Wednesday, 5 times, across the autumn clock change', () => {
  const cal = I.parse(ics(['UID:w', 'DTSTART;TZID=America/Denver:20261026T090000', 'DTEND;TZID=America/Denver:20261026T100000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5', 'SUMMARY:Standup']));
  const occ = I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2027, 0, 1), TZ);
  assert.deepEqual(occ.map(o => local(o.start)), ['2026-10-26 09:00', '2026-10-28 09:00', '2026-11-02 09:00', '2026-11-04 09:00', '2026-11-09 09:00']);
  assert.equal(iso(occ[0].start), '2026-10-26T15:00:00.000Z'); assert.equal(iso(occ[2].start), '2026-11-02T16:00:00.000Z', 'clocks went back: same wall time, a different moment');
  assert.ok(occ.every(o => o.recurring && o.rid), 'each occurrence knows its RECURRENCE-ID');
  assert.equal(I.dateValue(occ[2].rid).value, '20261102T090000'); assert.equal(I.dateValue(occ[2].rid).params.TZID, 'America/Denver');
});

await test('monthly and yearly rules: nth weekday, last day, BYSETPOS, UNTIL', () => {
  const second = I.parse(ics(['UID:m', 'DTSTART;TZID=America/Denver:20260113T180000', 'DTEND;TZID=America/Denver:20260113T190000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;UNTIL=20260430T000000Z']));
  assert.deepEqual(I.expand(second, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), TZ).map(o => o.startDate), ['2026-01-13', '2026-02-10', '2026-03-10', '2026-04-14']);
  const last = I.parse(ics(['UID:l', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4']));
  assert.deepEqual(I.expand(last, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), TZ).map(o => o.startDate), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  const lastFri = I.parse(ics(['UID:f', 'DTSTART;VALUE=DATE:20260130', 'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3']));
  assert.deepEqual(I.expand(lastFri, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), TZ).map(o => o.startDate), ['2026-01-30', '2026-02-27', '2026-03-31']);
  const bday = I.parse(ics(['UID:y', 'DTSTART;VALUE=DATE:19840229', 'RRULE:FREQ=YEARLY', 'SUMMARY:Leap birthday']));
  assert.deepEqual(I.expand(bday, Date.UTC(2024, 0, 1), Date.UTC(2029, 0, 1), TZ).map(o => o.startDate), ['2024-02-29', '2028-02-29'], 'a 29 February birthday only on leap years');
  const thanks = I.parse(ics(['UID:t', 'DTSTART;VALUE=DATE:20251127', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=4TH']));
  assert.deepEqual(I.expand(thanks, Date.UTC(2026, 0, 1), Date.UTC(2028, 0, 1), TZ).map(o => o.startDate), ['2026-11-26', '2027-11-25']);
  const every31 = I.parse(ics(['UID:e', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;COUNT=3']));
  assert.deepEqual(I.expand(every31, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), TZ).map(o => o.startDate), ['2026-01-31', '2026-03-31', '2026-05-31'], 'months without a 31st are skipped');
});

await test('skipped and changed occurrences, and extra dates', () => {
  const cal = I.parse('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'
    + 'BEGIN:VEVENT\r\nUID:d\r\nDTSTART;TZID=America/Denver:20261005T080000\r\nDTEND;TZID=America/Denver:20261005T083000\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEXDATE;TZID=America/Denver:20261007T080000\r\nRDATE;TZID=America/Denver:20261020T080000\r\nSUMMARY:Run\r\nEND:VEVENT\r\n'
    + 'BEGIN:VEVENT\r\nUID:d\r\nRECURRENCE-ID;TZID=America/Denver:20261008T080000\r\nDTSTART;TZID=America/Denver:20261008T170000\r\nDTEND;TZID=America/Denver:20261008T173000\r\nSUMMARY:Run (moved)\r\nEND:VEVENT\r\n'
    + 'END:VCALENDAR\r\n');
  const occ = I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), TZ);
  assert.deepEqual(occ.map(o => local(o.start) + ' ' + o.summary), ['2026-10-05 08:00 Run', '2026-10-06 08:00 Run', '2026-10-08 17:00 Run (moved)', '2026-10-09 08:00 Run', '2026-10-20 08:00 Run']);
  const moved = occ.find(o => o.summary === 'Run (moved)');
  assert.notEqual(moved.comp, moved.master); assert.equal(I.dateValue(moved.rid).value, '20261008T080000');
  assert.equal(moved.master, occ[0].comp);
});

await test('a daily rule from years ago is found quickly, and matches counting it out', () => {
  const cal = I.parse(ics(['UID:old', 'DTSTART;TZID=America/Denver:20150101T070000', 'DTEND;TZID=America/Denver:20150101T071500', 'RRULE:FREQ=DAILY;INTERVAL=3']));
  const t0 = Date.now();
  const occ = I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 31), TZ);
  assert.ok(Date.now() - t0 < 500, 'fast');
  const daysSince = d => Math.round((Date.UTC(2026, 9, d) - Date.UTC(2015, 0, 1)) / 864e5);
  const expected = []; for (let d = 1; d <= 30; d++) if (daysSince(d) % 3 === 0) expected.push('2026-10-' + String(d).padStart(2, '0'));
  assert.deepEqual(occ.map(o => o.startDate), expected);
  assert.ok(occ.every(o => local(o.start).endsWith('07:00')));
  const weekly = I.parse(ics(['UID:wk', 'DTSTART;TZID=Europe/London:20190904T100000', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;INTERVAL=2']));
  const w = I.expand(weekly, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'Europe/London');
  assert.deepEqual(w.map(o => o.startDate), ['2026-10-07', '2026-10-21']);
  assert.equal(local(w[1].start, 'Europe/London'), '2026-10-21 10:00'); assert.equal(w[1].end - w[1].start, 3600e3);
});

await test('UTC and floating times', () => {
  const cal = I.parse(ics(['UID:u', 'DTSTART:20261016T130500Z', 'DTEND:20261016T175000Z', 'SUMMARY:Flight'], ['UID:f', 'DTSTART:20261016T090000', 'DTEND:20261016T100000', 'SUMMARY:Floating']));
  const occ = I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), TZ);
  assert.equal(iso(occ[0].start), '2026-10-16T13:05:00.000Z'); assert.equal(occ[0].tzid, 'UTC');
  assert.equal(local(occ[1].start), '2026-10-16 09:00', 'floating is read in the phone\'s zone'); assert.equal(occ[1].tzid, null);
  assert.equal(I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'Europe/London').find(o => o.uid === 'u').start, occ[0].start, 'UTC stays put whatever the phone\'s zone');
});

await test('VTIMEZONE blocks come out of the browser\'s own tables', () => {
  const den = I.serialize(I.vtimezone('America/Denver', 2026));
  assert.ok(den.includes('TZID:America/Denver'));
  assert.ok(den.includes('BEGIN:DAYLIGHT\r\nDTSTART:20260308T020000\r\nTZOFFSETFROM:-0700\r\nTZOFFSETTO:-0600\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU'), den);
  assert.ok(den.includes('BEGIN:STANDARD\r\nDTSTART:20261101T020000\r\nTZOFFSETFROM:-0600\r\nTZOFFSETTO:-0700\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU'), den);
  assert.ok(den.includes('TZNAME:MDT') && den.includes('TZNAME:MST'));
  const lon = I.serialize(I.vtimezone('Europe/London', 2026));
  assert.ok(lon.includes('BEGIN:DAYLIGHT\r\nDTSTART:20260329T010000\r\nTZOFFSETFROM:+0000\r\nTZOFFSETTO:+0100\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU'), lon);
  assert.ok(lon.includes('BEGIN:STANDARD\r\nDTSTART:20261025T020000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU'), lon);
  const phx = I.vtimezone('America/Phoenix', 2026);
  assert.equal(phx.children.length, 1); assert.equal(phx.children[0].name, 'STANDARD'); assert.equal(I.text(phx.children[0], 'TZOFFSETTO'), '-0700');
  const cal = I.parse(ics(['UID:z', 'DTSTART;TZID=America/Denver:20261016T190000', 'DTEND;TZID=America/Denver:20261016T200000']));
  I.ensureTimezones(cal, 2026);
  assert.equal(I.children(cal, 'VTIMEZONE').length, 1);
  I.ensureTimezones(cal, 2026);
  assert.equal(I.children(cal, 'VTIMEZONE').length, 1, 'not added twice');
  // A file with its own VTIMEZONE is read by that block's zone name
  const withZone = I.parse(I.serialize(cal));
  assert.equal(I.expand(withZone, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'UTC')[0].start, Date.UTC(2026, 9, 17, 1));
});

await test('rules in words, and back to text', () => {
  const start = { y: 2026, m: 10, d: 16, h: 9, mi: 0, s: 0, wd: 4 };
  assert.equal(I.ruleText('FREQ=DAILY', start), 'Every day');
  assert.equal(I.ruleText('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', start), 'Every 2 weeks on Monday and Wednesday');
  assert.equal(I.ruleText('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', start), 'Every weekday');
  assert.equal(I.ruleText('FREQ=WEEKLY', start), 'Every week on Friday');
  assert.equal(I.ruleText('FREQ=MONTHLY;BYDAY=2TU;COUNT=6', start), 'Every month on the second Tuesday, 6 times');
  assert.equal(I.ruleText('FREQ=MONTHLY;BYMONTHDAY=-1', start), 'Every month on the last day');
  assert.equal(I.ruleText('FREQ=MONTHLY', start), 'Every month on the 16th');
  assert.equal(I.ruleText('FREQ=YEARLY;UNTIL=20301231', start), 'Every year on 16 October, until 31 December 2030');
  assert.equal(I.ruleText('FREQ=YEARLY;BYMONTH=11;BYDAY=4TH', start), 'Every year on the fourth Thursday of November');
  const r = I.parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20270101T000000Z;WKST=SU');
  assert.equal(I.fmtRRule(r), 'FREQ=WEEKLY;INTERVAL=2;UNTIL=20270101T000000Z;BYDAY=MO,WE;WKST=SU');
});

await test('durations and alarms', () => {
  assert.equal(I.parseDuration('-PT15M'), -900e3); assert.equal(I.parseDuration('P1DT2H'), 93600e3); assert.equal(I.parseDuration('-P1W'), -7 * 864e5); assert.equal(I.parseDuration('x'), null);
  assert.equal(I.fmtDuration(-900e3), '-PT15M'); assert.equal(I.fmtDuration(864e5), 'P1D'); assert.equal(I.fmtDuration(-15 * 3600e3), '-PT15H'); assert.equal(I.fmtDuration(0), 'PT0M');
  const cal = I.parse(ics(['UID:al', 'DTSTART;TZID=America/Denver:20261016T190000', 'DTEND;TZID=America/Denver:20261016T200000', 'TRANSP:TRANSPARENT', 'X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT45M',
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM', 'BEGIN:VALARM', 'TRIGGER;VALUE=DATE-TIME:20261016T120000Z', 'ACTION:DISPLAY', 'END:VALARM',
    'ATTENDEE;CN=Elena;PARTSTAT=ACCEPTED:mailto:elena@example.com', 'ORGANIZER;CN=Tom:mailto:tom@example.com']));
  const o = I.expand(cal, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), TZ)[0];
  assert.equal(o.alarms[0].minutes, -30); assert.equal(o.alarms[1].at, Date.UTC(2026, 9, 16, 12));
  assert.equal(o.transp, 'TRANSPARENT'); assert.equal(o.travel, 45);
  assert.deepEqual(o.attendees, [{ email: 'elena@example.com', name: 'Elena', status: 'ACCEPTED', role: '' }]); assert.equal(o.organizer.name, 'Tom');
});

await test('editing a tree: set, delete, dates, and new ids', () => {
  const ev = I.component('VEVENT', [['UID', 'x']]);
  I.setText(ev, 'SUMMARY', 'Tea, biscuits'); I.setDate(ev, 'DTSTART', { kind: 'datetime', y: 2026, m: 1, d: 2, h: 3, mi: 4, s: 0, tzid: 'Europe/London' });
  I.setDate(ev, 'DTEND', { kind: 'date', y: 2026, m: 1, d: 3 });
  const s = I.serialize(ev);
  assert.ok(s.includes('SUMMARY:Tea\\, biscuits')); assert.ok(s.includes('DTSTART;TZID=Europe/London:20260102T030400')); assert.ok(s.includes('DTEND;VALUE=DATE:20260103'));
  I.setText(ev, 'SUMMARY', ''); assert.equal(I.prop(ev, 'SUMMARY'), null);
  assert.match(I.uid(), /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/);
  assert.match(I.stamp(Date.UTC(2026, 0, 2, 3, 4, 5)), /^20260102T030405Z$/);
});

console.log('\n' + n + ' tests passed');
