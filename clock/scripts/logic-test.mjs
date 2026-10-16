// Clock's sums and sounds (clock/logic.js), in plain
// Node, in New York's time zone: when an alarm next rings (once, on its days, skipping one,
// across summer time starting and ending, the end of a month and of a year), the repeat in
// words, the sleep schedule, how a city stands against here (a zone half an hour off too),
// the city search, the stopwatch's laps, times and lengths in words, and that every sound is
// a real WAV that ends in silence.
//
//   node clock/scripts/logic-test.mjs
process.env.TZ = 'America/New_York';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../logic.js');
const L = globalThis.ClockLogic;
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const show = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

ok('repeat in words, as iPhone says it', () => {
  assert.equal(L.repeatText([]), 'Never');
  assert.equal(L.repeatText([0, 1, 2, 3, 4, 5, 6]), 'Every day');
  assert.equal(L.repeatText([5, 1, 2, 3, 4]), 'Weekdays');
  assert.equal(L.repeatText([6, 0]), 'Weekends');
  assert.equal(L.repeatText([1]), 'Every Monday');
  assert.equal(L.repeatText([5, 1, 3, 3]), 'Mon Wed Fri');
  assert.deepEqual(L.cleanDays([7, -1, 2.5, 3, 3, 0]), [0, 3]);
});

ok('a one-time alarm rings next at that time: later today, or else tomorrow', () => {
  const now = at(2026, 3, 11, 8, 0);   // a Wednesday
  assert.equal(show(L.nextRing({ h: 9, m: 30, days: [] }, now)), '2026-3-11 9:30');
  assert.equal(show(L.nextRing({ h: 7, m: 0, days: [] }, now)), '2026-3-12 7:00');
  assert.equal(show(L.nextRing({ h: 8, m: 0, days: [] }, now)), '2026-3-12 8:00', 'the very minute it is now has already gone');
});

ok('a repeating alarm rings on its next day, past the end of a month and a year', () => {
  assert.equal(show(L.nextRing({ h: 6, m: 45, days: [1, 2, 3, 4, 5] }, at(2026, 3, 13, 7, 0))), '2026-3-16 6:45', 'Friday after it rang: Monday');
  assert.equal(show(L.nextRing({ h: 9, m: 0, days: [0, 6] }, at(2026, 3, 11, 8, 0))), '2026-3-14 9:00', 'weekends from a Wednesday: Saturday');
  assert.equal(show(L.nextRing({ h: 6, m: 0, days: [1] }, at(2026, 8, 31, 7, 0))), '2026-9-7 6:00', 'end of a month');
  assert.equal(show(L.nextRing({ h: 0, m: 5, days: [] }, at(2026, 12, 31, 23, 50))), '2027-1-1 0:05', 'end of a year');
  for (let d = 0; d < 7; d++) {   // from every day of the week, an every-day alarm is never more than a day away
    const t = L.nextRing({ h: 7, m: 0, days: [0, 1, 2, 3, 4, 5, 6] }, at(2026, 3, 15 + d, 12, 0));
    assert.equal(show(t), `2026-3-${16 + d} 7:00`);
  }
});

ok('a skipped ring is passed over', () => {
  const a = { h: 6, m: 30, days: [1, 2, 3, 4, 5] }, now = at(2026, 3, 11, 22, 0);
  const first = L.nextRing(a, now);
  assert.equal(show(first), '2026-3-12 6:30');
  assert.equal(show(L.nextRing({ ...a, skip: first }, now)), '2026-3-13 6:30');
});

ok('summer time: a time that doesn\'t exist rings when the clocks have moved; one that happens twice rings once', () => {
  // Sunday 8 March 2026, 2:00 -> 3:00 in New York
  const t = L.nextRing({ h: 2, m: 30, days: [] }, at(2026, 3, 8, 0, 0));
  assert.equal(new Date(t).getDate(), 8); assert.equal(new Date(t).getHours(), 3);
  // Sunday 1 November 2026, 2:00 -> 1:00: 1:30 happens twice
  const u = L.nextRing({ h: 1, m: 30, days: [] }, at(2026, 11, 1, 0, 0));
  assert.equal(show(u), '2026-11-1 1:30');
  const v = L.nextRing({ h: 1, m: 30, days: [] }, u);
  assert.equal(show(v), '2026-11-2 1:30', 'after the first 1:30 it rings again the next day, not an hour later');
  assert.equal(show(L.nextRing({ h: 7, m: 0, days: [0, 1, 2, 3, 4, 5, 6] }, at(2026, 3, 7, 8, 0))), '2026-3-8 7:00');
});

ok('time until it rings, in words', () => {
  assert.equal(L.untilText(7 * 3600e3 + 12 * 60e3), '7 hr 12 min');
  assert.equal(L.untilText(45 * 60e3), '45 min');
  assert.equal(L.untilText(3600e3), '1 hr');
  assert.equal(L.untilText(26 * 3600e3), '1 day 2 hr');
  assert.equal(L.untilText(30e3), '1 min');
  assert.equal(L.untilText(0), 'less than a minute');
});

ok('the sleep schedule: hours of sleep and the evenings bedtime falls on', () => {
  const s = { bed: { h: 22, m: 30 }, wake: { h: 6, m: 30 }, days: [1, 2, 3, 4, 5] };
  assert.equal(L.sleepMinutes(s), 480);
  assert.equal(L.hoursText(L.sleepMinutes(s)), '8 hr');
  assert.deepEqual(L.bedDays(s), [0, 1, 2, 3, 4], 'Sunday to Thursday evenings, before Monday to Friday mornings');
  const late = { bed: { h: 0, m: 45 }, wake: { h: 8, m: 0 }, days: [6] };
  assert.equal(L.hoursText(L.sleepMinutes(late)), '7 hr 15 min');
  assert.deepEqual(L.bedDays(late), [6], 'bedtime after midnight: the same day');
  assert.equal(L.sleepMinutes({ bed: { h: 7, m: 0 }, wake: { h: 7, m: 0 } }), 1440);
});

ok('a city against here: its day, and how far ahead or behind', () => {
  const winter = at(2026, 1, 15, 20, 0), summer = at(2026, 7, 15, 20, 0);
  assert.equal(L.zoneVs('Asia/Tokyo', winter).text, 'Tomorrow, 14 hr ahead');
  assert.equal(L.zoneVs('Asia/Tokyo', summer).text, 'Tomorrow, 13 hr ahead');
  assert.equal(L.zoneVs('Europe/London', winter).text, 'Tomorrow, 5 hr ahead');
  assert.equal(L.zoneVs('America/Los_Angeles', winter).text, 'Today, 3 hr behind');
  assert.equal(L.zoneVs('America/Toronto', winter).text, 'Today, same time');
  assert.equal(L.zoneVs('Asia/Kolkata', at(2026, 1, 15, 9, 0)).text, 'Today, 10½ hr ahead');
  assert.equal(L.zoneVs('Asia/Kathmandu', at(2026, 1, 15, 9, 0)).text, 'Today, 10¾ hr ahead');
  assert.equal(L.zoneVs('Pacific/Honolulu', at(2026, 1, 15, 2, 0)).text, 'Yesterday, 5 hr behind');
  assert.equal(L.diffText(30), '½ hr ahead');
  assert.equal(L.diffText(-200), '3 hr 20 min behind');
  const z = L.zoneParts('Asia/Tokyo', winter);
  assert.deepEqual([z.mo, z.d, z.h, z.mi, z.dow], [1, 16, 10, 0, 5]);
});

ok('the clock in digits and hands', () => {
  assert.deepEqual(L.clockText(0, 5, false), { time: '12:05', ap: 'AM' });
  assert.deepEqual(L.clockText(13, 0, false), { time: '1:00', ap: 'PM' });
  assert.deepEqual(L.clockText(13, 0, true), { time: '13:00', ap: '' });
  assert.equal(L.clockLine(7, 0, false), '7:00 AM');
  assert.deepEqual(L.hands(3, 0, 0), { h: 90, m: 0, s: 0 });
  assert.deepEqual(L.hands(15, 30, 30), { h: 105.25, m: 183, s: 180 });
});

ok('the city search: names first, then any word, then the country or state', () => {
  const r = L.searchCities('san');
  assert.ok(r.length >= 5);
  assert.equal(r[0].name, 'San Antonio');
  assert.ok(r.slice(0, 8).every(c => /^san/i.test(L.fold(c.name))));
  assert.ok(L.searchCities('sao paulo').some(c => c.name === 'São Paulo'), 'accents don\'t matter');
  assert.ok(L.searchCities('st johns').some(c => c.name === 'St. John’s'), 'nor do apostrophes and dots');
  assert.ok(L.searchCities('japan').some(c => c.name === 'Tokyo'), 'by country');
  assert.ok(L.searchCities('texas').some(c => c.name === 'Houston'), 'by state');
  assert.deepEqual(L.searchCities('   '), []);
  assert.ok(L.searchCities('cordoba').some(c => c.tz.includes('Cordoba')), 'a zone the phone knows that isn\'t in the list, by its own name');
  for (const c of L.CITIES) assert.ok(L.validZone(c.tz), c.name + ': ' + c.tz);
  assert.equal(L.zoneCity('Etc/GMT+5'), null);
});

ok('the stopwatch: hundredths, and the fastest and slowest laps', () => {
  assert.equal(L.swText(0), '00:00.00');
  assert.equal(L.swText(65432), '01:05.43');
  assert.equal(L.swText(3723456), '1:02:03.45');
  assert.deepEqual(L.lapMarks([20000, 25100, 18356, 20000]), { best: 2, worst: 1 });
  assert.deepEqual(L.lapMarks([20000]), { best: -1, worst: -1 }, 'one lap: nothing to compare');
  assert.deepEqual(L.lapMarks([5000, 5000]), { best: -1, worst: -1 }, 'all the same: none marked');
});

ok('timers: time left rounded up, and lengths in words', () => {
  assert.equal(L.leftText(299001), '5:00');
  assert.equal(L.leftText(299000), '4:59');
  assert.equal(L.leftText(1), '0:01');
  assert.equal(L.leftText(0), '0:00');
  assert.equal(L.leftText(3600000), '1:00:00');
  assert.equal(L.durText(5400), '1 hr 30 min');
  assert.equal(L.durText(150), '2 min 30 sec');
  assert.equal(L.durText(45), '45 sec');
  assert.equal(L.durText(3600), '1 hr');
});

ok('every sound is a WAV loop that stays under full scale and ends in silence', () => {
  assert.equal(L.SOUNDS.length, 6);
  for (const s of L.SOUNDS) {
    const w = L.wav(s.id), dv = new DataView(w.buffer);
    const str = (o, k) => String.fromCharCode(...w.slice(o, o + k));
    assert.equal(str(0, 4), 'RIFF'); assert.equal(str(8, 8), 'WAVEfmt '); assert.equal(str(36, 4), 'data');
    assert.equal(dv.getUint32(4, true), w.length - 8);
    assert.equal(dv.getUint32(24, true), L.RATE); assert.equal(dv.getUint16(34, true), 16);
    const n = dv.getUint32(40, true) / 2;
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(dv.getInt16(44 + i * 2, true)));
    assert.ok(peak > 8000, s.id + ' is loud enough to hear (' + peak + ')');
    assert.ok(peak <= 0.9 * 32767 + 1, s.id + ' stays under full scale');
    assert.equal(dv.getInt16(44 + (n - 1) * 2, true), 0, s.id + ' ends in silence, so its loop doesn\'t click');
    assert.ok(n / L.RATE >= 1 && n / L.RATE <= 5, s.id + ' is a short loop');
  }
  assert.equal(L.soundName('nope'), 'Twin Bell');
  const quiet = L.wav('silence', .2);
  assert.equal(new DataView(quiet.buffer).getUint32(40, true), Math.round(.2 * L.RATE) * 2);
});

console.log(n + ' passed');
