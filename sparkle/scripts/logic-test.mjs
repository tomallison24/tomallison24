// Sparkle Kingdom's learning logic in Node (sparkle/engine.js and sparkle/content.js): moving up and
// down a skill's ladder, the warm-up, spaced review, a round's plan, coins, merging two phones'
// copies of a player, and every question every level can make (thousands of them, seeded).
//   node sparkle/scripts/logic-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
for (const f of ['engine.js', 'content.js', 'pictures.js', 'chapters.js', 'art.js', 'rooms.js']) vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: f });
const E = globalThis.SparkleEngine, C = globalThis.SparkleContent, Ch = globalThis.SparkleChapters;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('up a level after 4 right in a row', () => {
  const s = E.newSkill(3);
  assert.equal(E.record(s, 1, 10), 0); assert.equal(E.record(s, 1, 10), 0); assert.equal(E.record(s, 1, 10), 0);
  assert.equal(E.record(s, 1, 10), 1); assert.equal(s.level, 4); assert.deepEqual(s.hist, []);
});
test('a half (right after a hint) breaks the streak but not the window', () => {
  const s = E.newSkill(3);
  for (const x of [1, 1, 1, 0.5, 1, 1, 1]) E.record(s, x, 10);
  assert.equal(s.level, 3, 'no 4 in a row yet');
  assert.equal(E.record(s, 1, 10), 1, 'then 4 in a row');
});
test('9 of the last 10 moves up too', () => {
  const s = E.newSkill(2);
  // never 4 in a row, but 9 of 10 once the window is full: 1 1 1 0.5 1 1 1 0.5 ... -> sum 9 at 10
  for (const x of [1, 1, 1, 0.5, 1, 1, 1, 0.5]) assert.equal(E.record(s, x, 10), 0);
  assert.equal(E.record(s, 1, 10), 0); assert.equal(s.level, 2);
  assert.equal(E.record(s, 1, 10), 1, '4 in a row also lands here'); assert.equal(s.level, 3);
});
test('down a level after 2 misses in a row on new items, not on review items', () => {
  const s = E.newSkill(5);
  assert.equal(E.record(s, 0, 10, false), 0); assert.equal(E.record(s, 0, 10, false), 0, 'review misses don\'t move her');
  assert.equal(E.record(s, 0, 10, true), 0); assert.equal(E.record(s, 0, 10, true), -1); assert.equal(s.level, 4);
});
test('6 or fewer of the last 10 moves down; never below 1 or above the top', () => {
  const s = E.newSkill(4);
  for (const x of [1, 0, 1, 0, 1, 0.5, 1, 0, 1]) E.record(s, x, 10);
  assert.equal(E.record(s, 0.5, 10), -1); assert.equal(s.level, 3);
  const lo = E.newSkill(1); E.record(lo, 0, 10); assert.equal(E.record(lo, 0, 10), 0); assert.equal(lo.level, 1);
  const hi = E.newSkill(10); for (let i = 0; i < 4; i++) E.record(hi, 1, 10); assert.equal(hi.level, 10);
});
test('the warm-up climbs until a second miss, then starts a level below it', () => {
  let w = E.warmStart(1);
  for (const r of [true, true, false, true]) E.warmStep(w, r, 10);
  assert.equal(w.done, false); assert.equal(w.level, 6, 'two at a time for the first three on a long ladder');
  E.warmStep(w, false, 10); assert.equal(w.done, true); assert.equal(w.place, 5);
  w = E.warmStart(1); for (let i = 0; i < 6; i++) E.warmStep(w, true, 12);
  assert.equal(w.done, true); assert.equal(w.place, 10, 'all right: as high as the climb went');
  w = E.warmStart(1); for (let i = 0; i < 6; i++) E.warmStep(w, true, 7);
  assert.equal(w.place, 7, 'a short ladder climbs one at a time, to its top');
});
test('review: back after 1, 3 and 7 days; known after 3 separate days right', () => {
  const rv = {}, kn = {}; let d = '2026-10-20';
  E.remember(rv, kn, 'w:cat', false, d, true);
  assert.equal(rv['w:cat'].due, '2026-10-21');
  assert.deepEqual(E.dueFor(rv, d, 'w:'), []); assert.deepEqual(E.dueFor(rv, '2026-10-21', 'w:'), ['w:cat']);
  E.remember(rv, kn, 'w:cat', true, '2026-10-21'); assert.equal(rv['w:cat'].due, '2026-10-24');
  E.remember(rv, kn, 'w:cat', true, '2026-10-21'); assert.equal(rv['w:cat'].days, 1, 'twice in a day counts once');
  E.remember(rv, kn, 'w:cat', true, '2026-10-24'); assert.equal(rv['w:cat'].due, '2026-10-31');
  E.remember(rv, kn, 'w:cat', true, '2026-10-31'); assert.equal(rv['w:cat'], undefined); assert.equal(kn['w:cat'], '2026-10-31');
  E.remember(rv, kn, 'w:cat', false, '2026-11-02'); assert.equal(kn['w:cat'], undefined, 'missed again: learning again'); assert.equal(rv['w:cat'].due, '2026-11-03');
  E.remember(rv, kn, 'w:dog', true, d, true); assert.equal(rv['w:dog'].days, 1, 'a new item learned is reviewed too');
  E.remember(rv, kn, 'w:pig', true, d, false); assert.equal(rv['w:pig'], undefined, 'an old item right: nothing to do');
  assert.equal(E.addDays('2026-12-31', 1), '2027-01-01'); assert.equal(E.addDays('2026-03-01', -1), '2026-02-28');
});
test('a round: 6 to 8 questions, about a quarter review, ending on an easier one', () => {
  for (let seed = 1; seed < 200; seed++) {
    const r = E.rng(seed), s = E.newSkill(5), p = E.plan(s, 12, ['w:cat', 'w:dog', 'w:sun', 'w:pig'], r);
    assert.ok(p.length >= 6 && p.length <= 8, 'length ' + p.length);
    const rev = p.filter(x => x.review).length; assert.ok(rev >= 1 && rev <= 2, 'review ' + rev);
    assert.ok(p.every(x => x.level >= 3 && x.level <= 5)); assert.equal(p[p.length - 1].level, 4); assert.ok(p[p.length - 1].easy);
  }
  const p = E.plan(E.newSkill(1), 12, [], E.rng(3)); assert.ok(p.every(x => x.level === 1 && !x.review));
});
test('coins are kept per phone, can\'t go below zero, and add up across phones', () => {
  const p = E.newPlayer('p1', 'Ava');
  E.earn(p, 'A', 10); E.earn(p, 'B', 5); assert.equal(E.coins(p), 15);
  assert.equal(E.spend(p, 'A', 20), false); assert.equal(E.spend(p, 'B', 12), true); assert.equal(E.coins(p), 3);
});
test('merging two phones: nothing earned, bought or learned is lost or counted twice', () => {
  const base = E.newPlayer('p1', 'Ava'); base.updated = 1;
  E.earn(base, 'A', 10);
  const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base));
  E.earn(a, 'A', 4); E.spend(a, 'A', 6); a.owned.push('gown-rose'); a.skills.read = E.newSkill(4); a.skills.read.answers = 30; a.updated = 5;
  E.earn(b, 'B', 7); b.owned.push('tiara-star'); b.skills.read = E.newSkill(6); b.skills.read.answers = 50; b.skills.math = E.newSkill(8); b.updated = 4;
  E.played(a, 'A', '2026-10-20', 'read', 120); E.played(b, 'B', '2026-10-20', 'math', 60); E.played(b, 'A', '2026-10-20', 'read', 100);
  E.logAnswer(a, 'A', '2026-10-20', 'read', true); E.logAnswer(b, 'B', '2026-10-20', 'read', false);
  a.world.stars = ['s1']; b.world.stars = ['s2'];
  const m = E.mergePlayer(a, b);
  assert.equal(E.coins(m), 10 + 4 - 6 + 7);
  assert.deepEqual(m.owned.sort(), ['gown-rose', 'tiara-star']);
  assert.equal(m.skills.read.level, 6, 'the copy with more answers'); assert.equal(m.skills.math.level, 8);
  assert.equal(E.playedOn(m, '2026-10-20'), 180, 'phone A said 120 then 100 (an older copy): max per phone, then the sum');
  assert.deepEqual(E.accuracy(m, 'read', 7, '2026-10-20'), { right: 1, total: 2, share: 0.5 });
  assert.deepEqual(m.world.stars.sort(), ['s1', 's2']);
  assert.deepEqual(E.mergePlayer(m, m).wallet, m.wallet, 'merging with itself changes nothing');
});
test('merging saves: a player removed on either phone stays removed; settings follow the newer', () => {
  const x = { v: 1, players: { p1: E.newPlayer('p1', 'Ava'), p2: E.newPlayer('p2', 'Mia') }, gone: {}, settings: { rate: 1 }, settingsAt: 1 };
  const y = { v: 1, players: { p1: E.newPlayer('p1', 'Ava') }, gone: { p2: 5 }, settings: { rate: 0.8 }, settingsAt: 2 };
  const m = E.merge(x, y);
  assert.deepEqual(Object.keys(m.players), ['p1']); assert.equal(m.settings.rate, 0.8);
});

// ---- every question every level makes ----
const used = new Set();
for (const skill of ['read', 'math', 'wand', 'spell', 'match', 'missing', 'recall']) {
  for (let level = 1; level <= C.LADDERS[skill]; level++) {
    test(`${skill} ${level} (${C.LEVEL_NAMES[skill][level - 1]}): 300 questions, each well formed`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const r = E.rng(seed * 31 + level), q = C.make(skill, level, r, { tries: seed % 120 });
        assert.equal(q.skill, skill); assert.equal(q.level, level);
        assert.ok(Array.isArray(q.say) && q.say.length, 'says something');
        for (const part of q.say.concat(q.hint || [], q.tell || [])) assert.ok(typeof part === 'string' || (part && (part.snd || part.rime)), 'a part is a string or a sound: ' + JSON.stringify(part));
        for (const part of q.say.concat(q.hint || [], q.tell || [])) if (part && part.snd) assert.ok(C.LETTERS.includes(part.snd), 'a sound is a letter: ' + part.snd);
        if (q.kind === 'build') {
          const need = [...q.word]; const pool = q.tiles.slice();
          for (const l of need) { const k = pool.indexOf(l); assert.ok(k >= 0, `the tiles for ${q.word} lack ${l}: ${q.tiles}`); pool.splice(k, 1); }
          assert.ok(q.word.split('').every(l => C.LETTERS.includes(l)), 'only letters: ' + q.word);
          if (q.show) assert.ok(C.PIC[q.show.w]); continue;
        }
        if (q.kind === 'match') {
          assert.equal(q.cards.length, q.pairs * 2);
          const byPair = {}; for (const c of q.cards) byPair[c.pair] = (byPair[c.pair] || 0) + 1;
          assert.ok(Object.values(byPair).every(n => n === 2), 'every pair twice');
          for (const c of q.cards) if (c.face.kind === 'pic') { assert.ok(C.PIC[c.face.w], c.face.w); used.add(c.face.w); }
          for (const c of q.cards.filter(c => c.face.kind === 'pic' && q.learn)) assert.equal(c.face.w[0] === 'k' ? 'c' : c.face.w[0], c.pair === 'k' ? 'c' : c.pair, 'a learning pair starts with its letter');
          continue;
        }
        if (q.kind === 'missing') {
          assert.equal(q.left.length + q.gone.length, q.items.length);
          for (const g of q.gone) { assert.ok(!q.left.includes(g)); assert.ok(q.choices.some(c => c.id === g)); }
          for (const c of q.choices) { assert.ok(C.PIC[c.id]); used.add(c.id); if (!q.gone.includes(c.id)) assert.ok(!q.items.includes(c.id), 'a wrong choice was never on the tray'); }
          continue;
        }
        if (q.kind === 'wand') { assert.ok(q.seq.length >= 3 && q.seq.length <= 9); assert.ok(q.seq.every(x => x >= 0 && x < q.grid)); assert.ok(q.seq.every((x, i) => x !== q.seq[i - 1]), 'no sparkle twice in a row'); continue; }
        const ids = q.choices.map(c => c.id);
        assert.ok(ids.length >= 2 && ids.length <= 6, 'choices ' + ids.length);
        assert.equal(new Set(ids).size, ids.length, 'no choice twice: ' + ids);
        assert.ok(ids.includes(q.answer), `the answer ${q.answer} is a choice: ${ids}`);
        for (const c of q.choices) { assert.ok(c.label, 'a choice has a label'); if (c.kind === 'pic') { assert.ok(C.PIC[c.id], 'a picture for ' + c.id); used.add(c.id); } }
        if (q.kind === 'pick' && q.choices.every(c => c.kind === 'num')) for (const c of q.choices) assert.ok(+c.v >= 0, 'no negative numbers');
        if (q.show && q.show.w) assert.ok(C.PIC[q.show.w], 'a picture for ' + q.show.w);
        if (q.text) assert.ok(/^[A-Za-z0-9 .,?!'"+\-=_]+$/.test(q.text), 'shown text uses the school letters only: ' + q.text);
        if (q.story) assert.ok(q.say.includes(q.story), 'the story is told');
      }
    });
  }
}
test('rhymes never offer a second rhyme as a wrong answer, and first sounds never a word with the same first sound', () => {
  for (let seed = 1; seed < 800; seed++) {
    const q = C.make('read', 2, E.rng(seed));
    const set = C.RHYMES.find(s => s.includes(q.answer) && s.includes(q.show.w));
    assert.ok(set, 'the answer rhymes'); for (const c of q.choices) if (c.id !== q.answer) assert.ok(!set.includes(c.id), c.id + ' also rhymes');
    const f = C.make('read', 3, E.rng(seed)), same = l => l === 'k' ? 'c' : l;
    for (const c of f.choices) if (c.id !== f.answer) assert.notEqual(same(c.id[0]), same(f.text), c.id + ' starts with ' + f.text + ' too');
  }
});
test('spelling practises the words she has met in reading', () => {
  let met = 0; for (let seed = 1; seed < 200; seed++) { const q = C.make('spell', 3, E.rng(seed), { words: ['wig', 'fan'] }); if (['wig', 'fan'].includes(q.word)) met++; }
  assert.ok(met > 100, 'only ' + met + ' of 199 were her words');
});
test('review items come back as the same item', () => {
  const r = E.rng(9);
  assert.equal(C.make('spell', 4, r, {}, 'p:cat').word, 'cat');
  assert.equal(C.make('read', 8, r, {}, 'w:dog').answer, 'dog');
  assert.equal(C.make('read', 5, r, {}, 's:m').answer, 'm');
  assert.equal(C.make('read', 9, r, {}, 'h:said').answer, 'said');
  assert.equal(C.make('math', 7, r, {}, 'f:4+5').answer, '9');
  assert.equal(C.make('math', 7, r, {}, 'f:9-3').answer, '6');
});
test('every word, sound and fact that goes into review comes back as itself', () => {
  let n = 0;
  for (const skill of ['read', 'math', 'spell']) for (let level = 1; level <= C.LADDERS[skill]; level++) for (let seed = 1; seed <= 120; seed++) {
    const q = C.make(skill, level, E.rng(seed * 7 + level), { tries: seed });
    if (!q.key || !C.reviewable(q.key)) continue;
    const back = C.make(skill, level, E.rng(seed), {}, q.key); n++;
    assert.equal(back.key, q.key, 'came back as ' + back.key); assert.ok(back.kind === 'build' ? back.tiles.length >= back.word.length : back.choices.some(c => c.id === back.answer));
  }
  assert.ok(n > 500, 'only ' + n + ' reviewable items');
});
test('the kingdom\'s gates make quick questions', () => {
  for (let seed = 1; seed < 100; seed++) {
    const f = C.gate('flower', {}, E.rng(seed)); assert.ok(f.signs.includes(f.answer) && C.RHYMES.some(s => s.includes(f.answer) && s.includes(f.show)));
    const t = C.gate('tiara', { spell: seed % 7 + 1 }, E.rng(seed)); assert.equal(t.kind, 'build'); assert.ok(C.CVC.includes(t.word));
    const s = C.gate('sign', { read: seed % 12 + 1 }, E.rng(seed)); assert.equal(s.signs.length, 2); assert.ok(s.signs.includes(s.answer));
    const b = C.gate('bridge', { math: seed % 10 + 1 }, E.rng(seed)); assert.ok(b.n >= 3 && b.n <= 15);
    const d = C.gate('door', { wand: seed % 7 + 1 }, E.rng(seed)); assert.ok(d.seq.length >= 3);
  }
});
test('every word that can be shown has a drawing, and each is well formed', () => {
  const P = globalThis.SparklePics; let k = 0; const uid = p => p + 'x' + (++k);
  for (const w of Object.keys(C.PIC)) {
    assert.equal(typeof P[w], 'function', 'no drawing for ' + w);
    const m = P[w](uid); assert.ok(m.length > 80 && !/<svg|undefined|NaN/.test(m), 'a bad drawing for ' + w);
    const stack = [];
    for (const [, end, tag, self] of m.matchAll(/<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g)) {
      if (self) continue;
      if (!end) stack.push(tag); else assert.equal(stack.pop(), tag, 'a tag closed out of order in ' + w);
    }
    assert.equal(stack.length, 0, 'an unclosed tag in ' + w);
  }
});
test('the story: ten chapters in every land, opened by rounds played there', () => {
  assert.deepEqual(Ch.LANDS, ['read', 'math', 'wand', 'garden', 'spell']);
  for (const l of Ch.LANDS) {
    const cs = Ch.CHAPTERS[l]; assert.equal(cs.length, 10, l);
    cs.forEach((c, i) => { assert.equal(c.n, i + 1); assert.ok(c.title && c.lines.length >= 3, l + ' ' + c.n); for (const t of c.lines) assert.ok(t.length < 160 && !/\{(?!name\})/.test(t), 'a long or odd line in ' + l + ' ' + c.n); });
    assert.deepEqual(cs.filter(c => c.gift).map(c => c.n), [5, 10], 'presents at chapters 5 and 10 in ' + l);
    assert.equal(Ch.next(l, 0, 0), null, 'nothing before a round');
    assert.equal(Ch.next(l, 1, 0).n, 1);
    assert.equal(Ch.next(l, 1, 1), null, 'heard already');
    assert.equal(Ch.next(l, 30, 3).n, 4, 'one at a time, in order');
    assert.equal(Ch.reached(l, 1000), 10);
  }
  assert.equal(new Set(Ch.GIFTS).size, 10, 'ten different presents');
  const A = globalThis.SparkleArt, RM = globalThis.SparkleRooms;
  for (const id of Ch.GIFTS) { const it = A.ITEMS[id] || RM.ITEMS[id]; assert.ok(it, 'no such present: ' + id); assert.ok(it.gift && it.price === 0, id + ' should be a present, never sold'); }
  const gifts = [...Object.entries(A.ITEMS), ...Object.entries(RM.ITEMS)].filter(([, it]) => it.gift).map(([id]) => id).sort();
  assert.deepEqual(gifts, [...Ch.GIFTS].sort(), 'every present in the shop comes from a chapter');
  assert.equal(Ch.line('Hi, {name}!', 'Ava'), 'Hi, Ava!');
});
test("a land's colour comes back with its story", () => {
  assert.equal(Ch.colour(0), 0.3); assert.equal(Ch.colour(undefined), 0.3); assert.equal(Ch.colour(10), 1);
  for (let k = 1; k <= 10; k++) assert.ok(Ch.colour(k) > Ch.colour(k - 1));
});
test('rounds in a land are kept per phone, and a merge loses none; nor the lifted fog or her rank', () => {
  const a = E.newPlayer('p', 'A'), b = JSON.parse(JSON.stringify(a));
  E.finished(a, 'd1', 'read'); E.finished(a, 'd1', 'read'); E.finished(b, 'd2', 'read'); E.finished(b, 'd2', 'math');
  a.world.open = { garden: 5 }; b.world.open = { workshop: 9 }; b.updated = a.updated + 1; a.rank = 2;
  const m = E.mergePlayer(a, b);
  assert.equal(E.roundsIn(m, 'read'), 3); assert.equal(E.roundsIn(m, 'math'), 1); assert.equal(E.roundsIn(m, 'wand'), 0);
  assert.deepEqual(m.world.open, { garden: 5, workshop: 9 }); assert.equal(m.rank, 2);
});
console.log(`${n} passed; ${used.size} pictures used`);
