'use strict';

// Sparkle Kingdom's stables: her unicorn's four needs, like a Tamagotchi. Food, clean, fun and rest go
// from 0 to 100 and fall as real time passes, a little faster while she's away adventuring; she feeds,
// washes, brushes, plays with and puts her unicorn to bed to fill them again. A unicorn left alone gets
// sad (never ill, never gone), and is happy again the moment she's cared for. Pure functions, no page,
// so they can be tested in Node (sparkle/scripts/logic-test.mjs); app.js draws the stables.
//
//   fresh(now)            a new unicorn's needs (all well, 80), her toy ball, an empty pantry
//   tick(pet, now)        brings the needs up to now (asleep: rest fills, the rest fall slowly; she wakes
//                         when rested). Returns the pet. At most 3 days count, so a long holiday isn't worse.
//   mood(pet)             'sleep' | 'sad' (a need under 20) | 'calm' (under 50) | 'happy'
//   want(pet)             the need she wants most ('food' | 'clean' | 'fun' | 'rest'), or null when all are 50+
//   dirt(pet)             how muddy she looks, 0 to 1 (clean under 60)
//   feed(pet, id)         eat a food (FOODS): false when she's full or there's none in the pantry
//   wash(pet, n) / brush(pet) / play(pet, toy) / pat(pet) / sleep(pet) / wake(pet)
//   adventure(pet, land)  after a round in a land: a bit tired, hungry and muddy (the Gem Mine most), and happy
//   buy(pet, id)          puts a bought food in the pantry, or a toy with her toys (the app takes the coins)
//   bake(pet, treat, n)   n treats from the Unicorn Bakery into the pantry
//   newer(a, b)           of two phones' copies, the one cared for last
//
// Coins are never needed to keep her well: oats and apples are always free. Treats from the bakery and
// things from the shop fill more, and make her happier.
(function (root) {
  const HOUR = 36e5;
  // points lost each hour, awake and asleep (asleep: rest goes up instead)
  const TUNE = { awake: { food: 6, clean: 3, fun: 6, rest: 4 }, asleep: { food: 2, clean: 0, fun: 1, rest: -30 }, maxHours: 72, sad: 20, calm: 50 };
  const NEEDS = ['food', 'clean', 'fun', 'rest'];
  // what each food gives; free: always in the trough, else it comes from the pantry
  const FOODS = {
    oats: { food: 25, free: true }, apple: { food: 15, fun: 3, free: true },
    carrot: { food: 20, fun: 4 }, clover: { food: 12, fun: 8 }, sugar: { food: 6, fun: 14 },
    cupcake: { food: 35, fun: 15, treat: true }, cookie: { food: 25, fun: 15, treat: true }, pie: { food: 40, fun: 12, treat: true },
    muffin: { food: 35, fun: 12, treat: true }, donut: { food: 30, fun: 18, treat: true }, cake: { food: 40, fun: 18, treat: true },
    carrotcake: { food: 40, fun: 15, treat: true }, tart: { food: 30, fun: 15, treat: true },
  };
  const TOYS = { ball: { fun: 18, rest: 6, food: 3 }, bubbles: { fun: 20, rest: 4, food: 2 }, ribbon: { fun: 22, rest: 7, food: 3 }, kite: { fun: 26, rest: 9, food: 4 } };
  // the stable shop: foods go in the pantry (one each), toys are hers to keep
  const SHOP = { carrot: 1, clover: 1, sugar: 2, bubbles: 4, ribbon: 6, kite: 7 };
  const clamp = v => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  const add = (pet, d) => { for (const k of NEEDS) if (d[k]) pet[k] = clamp(pet[k] + d[k]); return pet; };

  const fresh = (now = Date.now()) => ({ food: 80, clean: 80, fun: 80, rest: 80, at: now, asleep: false, pantry: {}, toys: ['ball'] });
  function tick(pet, now = Date.now()) {
    let h = Math.min(TUNE.maxHours, Math.max(0, (now - (pet.at || now)) / HOUR));
    if (pet.asleep && h > 0) {
      // asleep until rested, then awake for the rest of the time
      const until = Math.min(h, Math.max(0, (100 - pet.rest) / -TUNE.asleep.rest));
      for (const k of NEEDS) pet[k] = clamp(pet[k] - TUNE.asleep[k] * until);
      h -= until;
      if (pet.rest >= 100) pet.asleep = false;
    }
    if (!pet.asleep) for (const k of NEEDS) pet[k] = clamp(pet[k] - TUNE.awake[k] * h);
    pet.at = now;
    return pet;
  }
  const low = pet => Math.min(...NEEDS.map(k => pet[k]));
  const mood = pet => pet.asleep ? 'sleep' : low(pet) < TUNE.sad ? 'sad' : low(pet) < TUNE.calm ? 'calm' : 'happy';
  const want = pet => { const k = NEEDS.slice().sort((a, b) => pet[a] - pet[b])[0]; return pet[k] < TUNE.calm ? k : null; };
  const dirt = pet => pet.clean < 60 ? Math.min(1, (60 - pet.clean) / 50) : 0;

  function feed(pet, id) {
    const f = FOODS[id]; if (!f || pet.asleep) return false;
    if (pet.food >= 96) return false;   // full
    if (!f.free) { if (!(pet.pantry[id] > 0)) return false; pet.pantry[id]--; if (!pet.pantry[id]) delete pet.pantry[id]; }
    add(pet, { food: f.food, fun: f.fun || 0 });
    return true;
  }
  const wash = (pet, n = 4) => add(pet, { clean: n });
  const brush = pet => add(pet, { clean: 2, fun: 3 });
  function play(pet, toy) { const t = TOYS[toy]; if (!t || pet.asleep || !(pet.toys || []).includes(toy)) return false; add(pet, { fun: t.fun, rest: -t.rest, food: -t.food }); return true; }
  const pat = pet => add(pet, { fun: 3 });
  const sleep = pet => { pet.asleep = true; return pet; };
  const wake = pet => { pet.asleep = false; return pet; };
  const MUD = { math: 14, garden: 9, spell: 6, read: 4, wand: 7 };
  const adventure = (pet, land) => add(pet, { rest: -6, food: -4, clean: -(MUD[land] || 5), fun: 6 });
  function buy(pet, id) {
    if (TOYS[id]) { pet.toys = pet.toys || ['ball']; if (!pet.toys.includes(id)) pet.toys.push(id); return pet; }
    if (FOODS[id]) pet.pantry[id] = (pet.pantry[id] || 0) + 1;
    return pet;
  }
  const bake = (pet, treat, n = 1) => { if (FOODS[treat] && n > 0) pet.pantry[treat] = (pet.pantry[treat] || 0) + n; return pet; };
  const newer = (a, b) => !a ? b : !b ? a : (b.at || 0) > (a.at || 0) ? b : a;

  root.SparkleCare = { TUNE, NEEDS, FOODS, TOYS, SHOP, fresh, tick, mood, want, dirt, feed, wash, brush, play, pat, sleep, wake, adventure, buy, bake, newer };
})(typeof window !== 'undefined' ? window : globalThis);
