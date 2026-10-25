'use strict';

// Sparkle Kingdom's questions: the word banks and, for each skill and level, a maker that builds one
// question. Pure functions (a seeded random comes in), so they can be tested in Node
// (sparkle/scripts/logic-test.mjs); app.js shows a question and voice.js says it.
//
// The reading ladder follows IXL's kindergarten Learn to Read plan, which her school uses:
// syllables, rhymes, first sounds, onset and rime, letter sounds, blending, middle and last sounds
// (and swapping one), then reading short-vowel words, sight words (only once she can sound out
// 3-letter words), sentences, little stories, and last digraphs and blends.
// The math ladder follows the kindergarten standards (count, compare, add and take away within 5,
// make 10, within 10) and goes on past them (tens, within 20, missing numbers), since she's strong.
// Pictures are the phone's emoji: clear and familiar for a 5-year-old, so a picture never stands
// between her and the word. Words are only ones with a picture nobody would name differently.
//
// A question:
//   { key        what review remembers it by ('w:cat', 's:t', 'f:3+4'), or null
//     skill, level, kind
//     say        what's said, in parts: a string is spoken, { snd: 't' } plays the letter's sound
//                (the clip a grown-up recorded, else the voice's best try: voice.js)
//     text       what's shown big in the school letters (letters.js), if anything
//     show       a picture to draw: { type: 'gems'|'frame'|'carts'|'pic'|'syll'|'take', ... }
//     choices    [{ id, kind: 'pic'|'word'|'num'|'letter'|'cart', v, label }]
//     answer     the right choice's id
//     hint       [parts] said after a first miss, and hintShow: what to light up
//     tell       [parts] said when the answer is shown after a second miss }
(function (root) {
  // ---- pictures ----
  const PIC = {
    cat: '🐱', bat: '🦇', hat: '🎩', map: '🗺️', can: '🥫',
    bed: '🛏️', web: '🕸️', leg: '🦵', gem: '💎', pen: '🖊️', ten: '🔟',
    pig: '🐷', pin: '📌',
    dog: '🐶', fox: '🦊', box: '📦', log: '🪵',
    sun: '☀️', bus: '🚌', bug: '🐞',
    frog: '🐸', star: '⭐', car: '🚗', cake: '🎂', snake: '🐍', moon: '🌙', spoon: '🥄', goat: '🐐', boat: '⛵',
    bear: '🐻', pear: '🍐', chair: '🪑', mouse: '🐭', house: '🏠', crown: '👑', clown: '🤡', bee: '🐝', tree: '🌳', key: '🔑',
    rabbit: '🐰', apple: '🍎', pencil: '✏️', tiger: '🐯', monkey: '🐵', rocket: '🚀', dragon: '🐉', rainbow: '🌈', pumpkin: '🎃', cupcake: '🧁', lemon: '🍋',
    unicorn: '🦄', butterfly: '🦋', banana: '🍌', dinosaur: '🦕', elephant: '🐘', strawberry: '🍓', octopus: '🐙', kangaroo: '🦘', tomato: '🍅',
    watermelon: '🍉', helicopter: '🚁', alligator: '🐊', avocado: '🥑', television: '📺',
    sock: '🧦', tent: '⛺', duck: '🦆', fish: '🐟', ring: '💍', nose: '👃', gift: '🎁', juice: '🧃', violin: '🎻', zebra: '🦓',
    yoyo: '🪀', ant: '🐜', egg: '🥚', ox: '🐂', umbrella: '☂️', igloo: '🧊', whale: '🐳', horse: '🐴', lion: '🦁', robot: '🤖',
    ship: '🚢', shell: '🐚', chick: '🐥', crab: '🦀', drum: '🥁', flag: '🚩', sled: '🛷', clock: '🕐', truck: '🚚', plum: '🍑',
    cup: '☕', fan: '🪭', van: '🚐', net: '🥅', mop: '🧹', pot: '🍲', jet: '✈️', mug: '☕', six: '🎲', wig: '💇',
  };
  // Some words are better said one way.
  const SAY = { yoyo: 'yo-yo' };

  // ---- reading banks ----
  // (only words whose picture nobody would call something else: a hen is a chicken to a 5-year-old)
  const CVC = ['cat', 'bat', 'hat', 'map', 'can', 'fan', 'van', 'bed', 'web', 'leg', 'gem', 'pen', 'ten', 'net', 'jet', 'pig', 'pin', 'wig',
    'dog', 'fox', 'box', 'log', 'mop', 'pot', 'sun', 'bus', 'bug', 'cup', 'mug'];
  const RHYMES = [['cat', 'hat', 'bat'], ['can', 'fan', 'van'], ['pen', 'ten'], ['net', 'jet'], ['dog', 'log', 'frog'], ['fox', 'box'], ['bug', 'mug'], ['star', 'car'], ['cake', 'snake'],
    ['moon', 'spoon'], ['goat', 'boat'], ['bear', 'pear', 'chair'], ['mouse', 'house'], ['crown', 'clown'], ['bee', 'tree', 'key']];
  // syllables: the word, how many, and the parts as the voice says them clearly
  const SYLL = [
    ['cat', ['cat']], ['sun', ['sun']], ['dog', ['dog']], ['star', ['star']], ['frog', ['frog']], ['cake', ['cake']],
    ['rabbit', ['rab', 'bit']], ['apple', ['ap', 'pull']], ['pencil', ['pen', 'sill']], ['tiger', ['tie', 'ger']], ['monkey', ['monk', 'key']],
    ['rocket', ['rock', 'it']], ['dragon', ['drag', 'gun']], ['rainbow', ['rain', 'bow']], ['pumpkin', ['pump', 'kin']], ['cupcake', ['cup', 'cake']], ['lemon', ['lem', 'un']],
    ['unicorn', ['you', 'nee', 'corn']], ['butterfly', ['but', 'ter', 'fly']], ['banana', ['buh', 'nan', 'uh']], ['dinosaur', ['die', 'no', 'sore']],
    ['elephant', ['el', 'uh', 'fant']], ['strawberry', ['straw', 'bear', 'ee']], ['octopus', ['ock', 'toe', 'puss']], ['kangaroo', ['kang', 'guh', 'roo']],
    ['tomato', ['tuh', 'may', 'toe']],
    ['watermelon', ['wah', 'ter', 'mel', 'un']], ['helicopter', ['hel', 'ee', 'cop', 'ter']], ['alligator', ['al', 'lih', 'gay', 'ter']], ['avocado', ['ah', 'vuh', 'cah', 'doe']], ['television', ['tel', 'uh', 'vih', 'zhun']],
  ];
  // first sounds: words whose first sound is the letter's usual one (no gem, no giraffe)
  const FIRST = {
    s: ['sun', 'snake', 'sock', 'star'], t: ['tiger', 'tent', 'ten', 'tree'], p: ['pig', 'pen', 'pumpkin', 'pear', 'pin', 'pot'], m: ['moon', 'map', 'monkey', 'mouse', 'mop', 'mug'],
    b: ['bus', 'bat', 'bee', 'banana', 'bear'], d: ['dog', 'dragon', 'duck', 'dinosaur'], c: ['cat', 'cake', 'car', 'cupcake', 'cup'], f: ['fox', 'fish', 'frog', 'fan'],
    h: ['hat', 'house', 'horse'], r: ['rainbow', 'rocket', 'ring', 'rabbit'], l: ['lemon', 'log', 'leg', 'lion'], n: ['nose', 'net'],
    g: ['goat', 'gift'], w: ['web', 'watermelon', 'whale', 'wig'], j: ['juice', 'jet'], v: ['violin', 'van'], z: ['zebra'], k: ['key', 'kangaroo'],
    a: ['apple', 'ant', 'alligator'], e: ['egg', 'elephant'], i: ['igloo'], o: ['octopus', 'ox'], u: ['umbrella'],
  };
  // letters in teaching order, in small sets (a common order, s a t p i n first)
  const LETTER_SETS = [['s', 'a', 't', 'p', 'i', 'n'], ['m', 'd', 'g', 'o', 'c', 'k'], ['e', 'u', 'r', 'h', 'b', 'f'], ['l', 'j', 'v', 'w', 'y', 'z', 'x', 'q']];
  const LETTERS = LETTER_SETS.flat();
  // an example word for each sound, said with it ("t, as in tent") when there's no recorded sound
  const EXAMPLE = { s: 'sock', a: 'apple', t: 'tent', p: 'pig', i: 'igloo', n: 'nose', m: 'moon', d: 'dog', g: 'goat', o: 'octopus', c: 'cat', k: 'key',
    e: 'egg', u: 'umbrella', r: 'ring', h: 'hat', b: 'bus', f: 'fish', l: 'lion', j: 'juice', v: 'violin', w: 'whale', y: 'yoyo', z: 'zebra', x: 'fox', q: 'queen' };
  // swaps: change one sound of a word to make another word in the bank
  const SWAPS = [['cat', 'hat', 0, 'h'], ['cat', 'bat', 0, 'b'], ['hat', 'cat', 0, 'c'], ['bat', 'hat', 0, 'h'], ['pen', 'ten', 0, 't'], ['ten', 'pen', 0, 'p'],
    ['dog', 'log', 0, 'l'], ['log', 'dog', 0, 'd'], ['fox', 'box', 0, 'b'], ['box', 'fox', 0, 'f'],
    ['bus', 'bug', 2, 'g'], ['bug', 'bus', 2, 's'], ['pin', 'pig', 2, 'g'], ['pig', 'pin', 2, 'n'],
    ['can', 'fan', 0, 'f'], ['fan', 'van', 0, 'v'], ['van', 'can', 0, 'c'], ['net', 'jet', 0, 'j'], ['jet', 'net', 0, 'n'], ['bug', 'mug', 0, 'm'], ['mug', 'bug', 0, 'b'],
    ['pig', 'wig', 0, 'w'], ['wig', 'pig', 0, 'p'], ['mop', 'map', 1, 'a'], ['map', 'mop', 1, 'o']];
  // sight words, a few at a time (high-utility kindergarten words)
  const SIGHT = [['the', 'a', 'I', 'is'], ['it', 'in', 'to', 'and'], ['see', 'can', 'we', 'my'], ['like', 'go', 'you', 'he'], ['she', 'was', 'said', 'of'], ['are', 'look', 'here', 'for', 'have', 'do']];
  const SIGHT_ALL = SIGHT.flat();
  // digraph and blend words
  const BLENDS = ['ship', 'fish', 'shell', 'chick', 'crab', 'drum', 'flag', 'sled', 'clock', 'truck', 'duck', 'sock', 'frog', 'plum'];
  const SENTENCES = ['I see a {w}.', 'Look at the {w}.', 'Here is my {w}.', 'The {w} is big.', 'Can you see the {w}?', 'I like the {w}.', 'We have a {w}.', 'Look! A {w}!'];
  const SAT_ON = { bed: 'bed', box: 'box', log: 'log', hat: 'hat', map: 'map', bus: 'bus' };
  const ANIMALS = ['cat', 'dog', 'pig', 'fox', 'bug', 'bat'];
  const ADJ = ['big', 'red', 'hot', 'wet', 'sad', 'fun'];

  const LADDERS = { read: 12, math: 10, wand: 7, spell: 7, match: 7, missing: 7, recall: 5, pattern: 8, bake: 10 };
  const LEVEL_NAMES = {
    read: ['Syllables', 'Rhymes', 'First sounds', 'Onset and rime', 'Letter sounds', 'Blending', 'Middle and last sounds', 'Reading short words', 'Sight words', 'Sentences', 'Little stories', 'Digraphs and blends'],
    math: ['Count to 10', 'Count to 20, count on', 'More and fewer', 'Add within 5', 'Take away within 5', 'Make 10', 'Within 10', 'Count by tens', 'Within 20', 'Missing numbers'],
    wand: ['Sequences of 3', 'Sequences of 4', 'Sequences of 5', 'Sequences of 6', 'Backwards', 'Sequences of 7 and 8', 'Sequences of 9'],
    spell: ['Sound to letter', 'First letter', 'Build a word', 'Build with extra letters', 'Change one letter', 'Spell sight words', 'Blends and digraphs'],
    match: ['6 pairs', '8 pairs', 'Learning pairs', '10 pairs', '8 pairs, a fairy swap', '12 pairs', '15 pairs, a fairy swap'],
    missing: ['4 things', '5 things', '6 things', '7 things that move', '8 things that move', '9 things, two missing', '10 things, two missing'],
    recall: ['Who', 'What', 'Three sentences', 'Four sentences', 'What came first'],
    pattern: ['AB patterns', 'AAB patterns', 'ABB patterns', 'ABC patterns', 'AABB patterns', 'Missing in the middle', 'Colour patterns', 'Growing patterns'],
    bake: ['Count to 5', 'Count to 10', 'Two ingredients', 'One more, one fewer', 'Put together', 'Take away', 'Make 10', 'Tens and ones', 'Share fairly', 'Within 20'],
  };

  const word = w => SAY[w] || w;
  const pic = w => ({ id: w, kind: 'pic', v: PIC[w], label: word(w) });
  // n different items from a list, never `but`
  const others = (r, list, n, but = []) => r.shuffle(list.filter(x => !but.includes(x))).slice(0, n);
  const snd = l => ({ snd: l });
  const sound = l => l === 'k' ? 'c' : l;   // c and k start cat and key with the same sound

  // ---- reading ----
  const READ = [
    // 1 syllables: tap the drum once per part
    r => { const [w, parts] = r.pick(SYLL); const n = parts.length;
      return { key: 'y:' + w, kind: 'syll', say: [`How many parts in ${word(w)}? Tap the drum for each part.`], text: null, show: { type: 'pic', w, v: PIC[w] },
        choices: [1, 2, 3, 4].map(k => ({ id: String(k), kind: 'num', v: String(k), label: String(k) })), answer: String(n), parts,
        hint: ['Clap it with me.', ...parts.map(p => p)], tell: [`${word(w)} has ${n} part${n > 1 ? 's' : ''}.`, ...parts] }; },
    // 2 rhymes
    r => { const set = r.pick(RHYMES), [a, b] = r.shuffle(set);
      const wrong = others(r, Object.keys(PIC).filter(w => !RHYMES.some(s => s.includes(w) && s.includes(a)) && w.length <= 6), 2, set);
      return { key: 'r:' + a, kind: 'pick', say: [`Which one rhymes with ${word(a)}?`], show: { type: 'pic', w: a, v: PIC[a] },
        choices: r.shuffle([b, ...wrong]).map(pic), answer: b, hint: [`Listen for the end. ${word(a)}... ${word(b)}...`], hintShow: b, tell: [`${word(a)} and ${word(b)} rhyme!`] }; },
    // 3 first sounds, the letter shown
    r => { const l = r.pick(Object.keys(FIRST).filter(k => FIRST[k].length >= 1)); const w = r.pick(FIRST[l]);
      const wrong = others(r, Object.values(FIRST).flat().filter(x => sound(x[0]) !== sound(l)), 2);
      return { key: 's:' + l, kind: 'pick', say: ['Which picture starts with', snd(l), '?'], text: l,
        choices: r.shuffle([w, ...wrong]).map(pic), answer: w, hint: ['Say each one. Listen for', snd(l), 'at the start.'], hintShow: w, tell: [`${word(w)} starts with`, snd(l), '.'] }; },
    // 4 onset and rime: hear "c ... at", tap the picture
    r => { const w = r.pick(CVC); const wrong = others(r, CVC, 2, [w]);
      return { key: 'o:' + w, kind: 'pick', say: ['Put it together:', snd(w[0]), '...', { rime: w.slice(1) }], text: null,
        choices: r.shuffle([w, ...wrong]).map(pic), answer: w, hint: ['Say it faster:', snd(w[0]), { rime: w.slice(1) }], tell: [snd(w[0]), { rime: w.slice(1) }, '...', word(w), '!'] }; },
    // 5 letter sounds: hear a sound, tap its letter (3 to 6 letters from the sets she's met)
    (r, lv) => { const upto = LETTER_SETS.slice(0, 1 + Math.min(3, Math.floor((lv.tries || 0) / 30))).flat(); const l = r.pick(upto);
      const n = Math.min(6, 3 + Math.floor((lv.tries || 0) / 20)); const wrong = others(r, LETTERS, n - 1, [l]);
      return { key: 's:' + l, kind: 'pick', say: ['Which letter makes the sound', snd(l), '?'], choices: r.shuffle([l, ...wrong]).map(x => ({ id: x, kind: 'letter', v: x, label: x })), answer: l,
        hint: [snd(l), ', as in', word(EXAMPLE[l]), '.'], tell: [`This letter, ${l}, says`, snd(l), '.'] }; },
    // 6 blending: every sound, then the picture
    r => { const w = r.pick(CVC); const wrong = others(r, CVC, 2, [w]);
      return { key: 'b:' + w, kind: 'pick', say: ['Blend the sounds:', snd(w[0]), snd(w[1]), snd(w[2])], choices: r.shuffle([w, ...wrong]).map(pic), answer: w,
        hint: ['Again, faster:', snd(w[0]), snd(w[1]), snd(w[2])], tell: [snd(w[0]), snd(w[1]), snd(w[2]), '...', word(w), '!'] }; },
    // 7 middle and last sounds, or swap one sound
    r => { const x = r();
      if (x < 0.5) { const [from, to, at, l] = r.pick(SWAPS); const wrong = others(r, CVC, 2, [from, to]);
        return { key: 'x:' + from + to, kind: 'pick', say: [`Change the ${['first', 'middle', 'last'][at]} sound of ${word(from)} to`, snd(l), '. What do you get?'], show: { type: 'pic', w: from, v: PIC[from] },
          choices: r.shuffle([to, ...wrong]).map(pic), answer: to, hint: [word(from), '... take away', snd(from[at]), ', put in', snd(l)], tell: [`${word(from)} becomes ${word(to)}!`] }; }
      const w = r.pick(CVC), pos = x < 0.75 ? 1 : 2, l = w[pos], wrong = others(r, pos === 1 ? ['a', 'e', 'i', 'o', 'u'] : LETTERS, 2, [l]);
      return { key: (pos === 1 ? 'm:' : 'l:') + w, kind: 'pick', say: [`What's the ${pos === 1 ? 'middle' : 'last'} sound in ${word(w)}?`], show: { type: 'pic', w, v: PIC[w] },
        choices: r.shuffle([l, ...wrong]).map(c => ({ id: c, kind: 'letter', v: c, label: c })), answer: l,
        hint: ['Say it slowly:', snd(w[0]), snd(w[1]), snd(w[2])], tell: [`The ${pos === 1 ? 'middle' : 'last'} sound in ${word(w)} is`, snd(l), '.'] }; },
    // 8 read a short-vowel word, tap its picture
    r => { const w = r.pick(CVC); const wrong = others(r, CVC, 2, [w]);
      return { key: 'w:' + w, kind: 'pick', say: ['Read the word. Which picture is it?'], text: w, choices: r.shuffle([w, ...wrong]).map(pic), answer: w,
        hint: ['Sound it out:', snd(w[0]), snd(w[1]), snd(w[2])], tell: ['It says', word(w), '.'] }; },
    // 9 sight words: hear it, find it (a few at a time)
    (r, lv) => { const upto = SIGHT.slice(0, 1 + Math.min(SIGHT.length - 1, Math.floor((lv.tries || 0) / 16))).flat(); const w = r.pick(upto);
      const wrong = others(r, SIGHT_ALL.filter(x => x.length <= w.length + 2), 2, [w]);
      return { key: 'h:' + w, kind: 'pick', say: [`Find the word "${w}".`], choices: r.shuffle([w, ...wrong]).map(x => ({ id: x, kind: 'word', v: x, label: x })), answer: w,
        hint: [`"${w}" starts with ${w[0]}.`], hintShow: w, tell: [`This word is "${w}".`] }; },
    // 10 a sentence: read it, tap what it's about
    r => { const w = r.pick(CVC.filter(x => !['ten', 'leg'].includes(x))), s = r.pick(SENTENCES).replace('{w}', w); const wrong = others(r, CVC, 2, [w]);
      return { key: 'w:' + w, kind: 'pick', say: ['Read it. Tap the picture.'], text: s, choices: r.shuffle([w, ...wrong]).map(pic), answer: w,
        hint: ['Find the word you can sound out.'], tell: [s] }; },
    // 11 a little story, then a question
    r => { const a = r.pick(ANIMALS), b = r.pick(Object.keys(SAT_ON).filter(x => x !== a)), adj = r.pick(ADJ);
      const text = `The ${a} sat on the ${b}. The ${a} is ${adj}.`, wrong = others(r, Object.keys(SAT_ON), 2, [b]);
      return { key: 't:' + a + b, kind: 'pick', say: ['Read the story.', 'What did the ' + word(a) + ' sit on?'], text, choices: r.shuffle([b, ...wrong]).map(pic), answer: b,
        hint: ['Look for the word after "on the".'], tell: [text] }; },
    // 12 digraphs and blends
    r => { const w = r.pick(BLENDS); const wrong = others(r, BLENDS, 2, [w]);
      return { key: 'w:' + w, kind: 'pick', say: ['Read the word. Which picture is it?'], text: w, choices: r.shuffle([w, ...wrong]).map(pic), answer: w,
        hint: [w.startsWith('sh') ? '"s h" together says shh.' : w.startsWith('ch') ? '"c h" together says ch.' : w.endsWith('ck') ? '"c k" together says k.' : `Blend the first two sounds: ${w.slice(0, 2)}.`], tell: ['It says', word(w), '.'] }; },
  ];

  // ---- math ----
  const num = (n, r) => ({ id: String(n), kind: 'num', v: String(n), label: String(n) });
  // three or four number choices around the answer, all in range
  const nums = (r, ans, lo, hi, n = 3) => { const set = new Set([ans]); let guard = 0;
    while (set.size < n && guard++ < 50) { const d = r.int(1, 3) * (r() < 0.5 ? -1 : 1), v = ans + d; if (v >= lo && v <= hi) set.add(v); }
    while (set.size < n) set.add(Math.max(...set) + 1);
    return r.shuffle([...set]).map(x => num(x)); };
  const MATH = [
    // 1 count to 10
    r => { const n = r.int(3, 10); return { key: 'c:' + n, kind: 'pick', say: ['How many gems?'], show: { type: 'gems', n }, choices: nums(r, n, 1, 12), answer: String(n),
      hint: ['Touch each gem as you count.'], hintShow: 'count', tell: [`There are ${n} gems.`] }; },
    // 2 count to 20, or count on
    r => { if (r() < 0.5) { const n = r.int(11, 20); return { key: 'c:' + n, kind: 'pick', say: ['How many gems? Count the rows of five.'], show: { type: 'gems', n, rows: 5 }, choices: nums(r, n, 8, 22), answer: String(n), hint: ['Each row has five.'], hintShow: 'count', tell: [`There are ${n} gems.`] }; }
      const a = r.int(5, 12), b = r.int(1, 4); return { key: 'o:' + a + '+' + b, kind: 'pick', say: [`Start at ${a}. Count on ${b} more.`], show: { type: 'on', a, b }, choices: nums(r, a + b, 1, 20), answer: String(a + b),
        hint: [`${a}... then count: ${Array.from({ length: b }, (_, i) => a + i + 1).join('... ')}`], tell: [`${a} and ${b} more is ${a + b}.`] }; },
    // 3 more or fewer
    r => { let a = r.int(1, 10), b = r.int(1, 10); while (a === b) b = r.int(1, 10); const more = r() < 0.6;
      const ans = (more ? a > b : a < b) ? 'L' : 'R';
      return { key: null, kind: 'pick', say: [`Which cart has ${more ? 'more' : 'fewer'} gems?`], show: { type: 'carts', a, b },
        choices: [{ id: 'L', kind: 'cart', v: a, label: 'this cart' }, { id: 'R', kind: 'cart', v: b, label: 'that cart' }], answer: ans,
        hint: ['Count each cart.'], tell: [`This cart has ${Math.max(a, b) === (ans === 'L' ? a : b) ? 'more' : 'fewer'}: ${ans === 'L' ? a : b}.`] }; },
    // 4 add within 5
    r => { const a = r.int(1, 4), b = r.int(1, 5 - a); return { key: 'f:' + a + '+' + b, kind: 'pick', say: [`${a} gems and ${b} more. How many altogether?`], text: `${a} + ${b} = ?`, show: { type: 'add', a, b },
      choices: nums(r, a + b, 0, 7), answer: String(a + b), hint: ['Count them all.'], hintShow: 'count', tell: [`${a} plus ${b} is ${a + b}.`] }; },
    // 5 take away within 5
    r => { const a = r.int(2, 5), b = r.int(1, a); return { key: 'f:' + a + '-' + b, kind: 'pick', say: [`${a} gems. ${b} roll away. How many are left?`], text: `${a} - ${b} = ?`, show: { type: 'take', a, b },
      choices: nums(r, a - b, 0, 6), answer: String(a - b), hint: ['Count the ones that stayed.'], hintShow: 'count', tell: [`${a} take away ${b} is ${a - b}.`] }; },
    // 6 make 10
    r => { const a = r.int(1, 9); return { key: 'f:' + a + '+?=10', kind: 'pick', say: [`${a} gems in the frame. How many more make 10?`], show: { type: 'frame', n: a }, choices: nums(r, 10 - a, 0, 10), answer: String(10 - a),
      hint: ['Count the empty spots.'], hintShow: 'empty', tell: [`${a} and ${10 - a} make 10.`] }; },
    // 7 within 10, a story
    r => { const add = r() < 0.55; const a = add ? r.int(2, 7) : r.int(5, 10), b = add ? r.int(1, 10 - a) : r.int(1, a - 1), ans = add ? a + b : a - b;
      const say = add ? `Pebble had ${a} gems and found ${b} more. How many now?` : `Pebble had ${a} gems and gave ${b} away. How many are left?`;
      return { key: 'f:' + a + (add ? '+' : '-') + b, kind: 'pick', say: [say], text: `${a} ${add ? '+' : '-'} ${b} = ?`, show: { type: add ? 'add' : 'take', a, b, hidden: true },
        choices: nums(r, ans, 0, 10), answer: String(ans), hint: ['Here are the gems. Count them.'], hintShow: 'reveal', tell: [`${a} ${add ? 'plus' : 'take away'} ${b} is ${ans}.`] }; },
    // 8 count by tens
    r => { if (r() < 0.6) { const s = r.int(1, 6) * 10; const seq = [s, s + 10, s + 20]; const ans = s + 30;
        return { key: 'c:' + ans + 't', kind: 'pick', say: [`Count by tens: ${seq.join(', ')}, what comes next?`], text: `${seq.join(', ')}, ?`, choices: nums(r, ans, 10, 100).map(c => c),
          answer: String(ans), hint: ['Add one more ten.'], tell: [`${seq.join(', ')}, ${ans}!`] }; }
      const t = r.int(2, 9); return { key: 'c:' + t * 10 + 'r', kind: 'pick', say: ['Each bag holds ten gems. How many gems?'], show: { type: 'tens', t },
        choices: [t - 1, t, t + 1].filter(x => x > 0).map(x => num(x * 10)), answer: String(t * 10), hint: ['Count the bags by tens: 10, 20, 30...'], tell: [`${t} tens is ${t * 10}.`] }; },
    // 9 within 20
    r => { const add = r() < 0.5; const a = add ? r.int(6, 15) : r.int(11, 20), b = add ? r.int(2, 20 - a) : r.int(2, 9), ans = add ? a + b : a - b;
      return { key: 'f:' + a + (add ? '+' : '-') + b, kind: 'pick', say: [`What is ${a} ${add ? 'plus' : 'take away'} ${b}?`], text: `${a} ${add ? '+' : '-'} ${b} = ?`,
        choices: nums(r, ans, 0, 20), answer: String(ans), hint: [add ? `Start at ${a} and count on ${b}.` : `Start at ${a} and count back ${b}.`], tell: [`${a} ${add ? 'plus' : 'take away'} ${b} is ${ans}.`] }; },
    // 10 missing numbers
    r => { const sum = r.int(4, 12), a = r.int(1, sum - 1), b = sum - a;
      return { key: 'f:' + a + '+?=' + sum, kind: 'pick', say: [`${a} plus what makes ${sum}?`], text: `${a} + ? = ${sum}`, choices: nums(r, b, 0, 12), answer: String(b),
        hint: [`Start at ${a} and count up to ${sum}.`], tell: [`${a} plus ${b} makes ${sum}.`] }; },
  ];

  // ---- memory: the wand's sparkle sequence ----
  const WAND = [3, 4, 5, 6, 4, 7, 9];
  const wand = (r, level) => { const n = WAND[level - 1] + (level === 6 && r() < 0.5 ? 1 : 0), back = level === 5, grid = level >= 6 ? 9 : 6;
    const seq = []; while (seq.length < n) { const s = r.int(0, grid - 1); if (seq[seq.length - 1] !== s) seq.push(s); }
    return { key: null, skill: 'wand', level, kind: 'wand', grid, seq, back, say: [back ? 'Watch the sparkles. Then tap them backwards, last one first!' : 'Watch the sparkles, then tap them in the same order.'],
      hint: ['Watch again.'], tell: ['Here it was.'] }; };

  // ---- spelling (the Tiara Workshop): letters are gem tiles, so no handwriting ----
  // A build: { kind: 'build', word, tiles: [letters, shuffled, with any decoys] }: she taps the tiles in order.
  const letterChoice = x => ({ id: x, kind: 'letter', v: x, label: x });
  const decoys = (r, w, n) => others(r, LETTERS.filter(l => !w.includes(l)), n);
  const build = (r, w, extra, say, pictured = true) => ({ key: 'p:' + w, kind: 'build', word: w, tiles: r.shuffle([...w, ...decoys(r, w, extra)]),
    say, show: pictured && PIC[w] ? { type: 'pic', w, v: PIC[w] } : null, hint: ['Listen:', ...[...w].map(snd)], tell: [`${word(w)}:`, ...[...w].map(snd)] });
  // the words she's met in reading (lv.words), else the bank: spelling practises what Story Tower taught
  const spellWord = (r, lv, list) => { const met = (lv.words || []).filter(w => list.includes(w)); return met.length && r() < 0.7 ? r.pick(met) : r.pick(list); };
  const SPELL = [
    // 1 hear a sound, find its gem
    (r, lv) => { const upto = LETTER_SETS.slice(0, 1 + Math.min(3, Math.floor((lv.tries || 0) / 25))).flat(), l = r.pick(upto);
      return { key: 's:' + l, kind: 'pick', say: ['Which gem says', snd(l), '?'], choices: r.shuffle([l, ...others(r, LETTERS, 2, [l])]).map(letterChoice), answer: l,
        hint: [snd(l), ', as in', word(EXAMPLE[l]), '.'], tell: [`This gem, ${l}, says`, snd(l), '.'] }; },
    // 2 the first letter under a picture: _at
    (r, lv) => { const w = spellWord(r, lv, CVC), l = w[0];
      return { key: null, kind: 'pick', say: [`What letter does ${word(w)} start with?`], text: '_' + w.slice(1), show: { type: 'pic', w, v: PIC[w] },
        choices: r.shuffle([l, ...others(r, LETTERS.filter(x => sound(x) !== sound(l)), 2)]).map(letterChoice), answer: l, hint: ['Say it slowly:', snd(l), { rime: w.slice(1) }], tell: [`${word(w)} starts with ${l}.`] }; },
    // 3 build a word from exactly its letters
    (r, lv) => { const w = spellWord(r, lv, CVC); return build(r, w, 0, [`Spell ${word(w)}. Tap the letters in order.`]); },
    // 4 the same, with extra gems
    (r, lv) => { const w = spellWord(r, lv, CVC); return build(r, w, 2 + Math.min(2, Math.floor((lv.tries || 0) / 15)), [`Spell ${word(w)}. Some gems don't belong!`]); },
    // 5 change one letter to make the next word
    r => { const [from, to, at, l] = r.pick(SWAPS);
      return { key: null, kind: 'pick', say: [`This says ${word(from)}. Change one gem to make ${word(to)}.`], text: from, show: { type: 'pic', w: to, v: PIC[to] },
        choices: r.shuffle([l, ...others(r, LETTERS, 2, [l, ...from])]).map(letterChoice), answer: l, hint: [`Which sound is different? ${word(from)}... ${word(to)}...`], tell: [`Change ${from[at]} to ${l}: ${word(to)}!`] }; },
    // 6 spell a sight word
    (r, lv) => { const upto = SIGHT.slice(0, 1 + Math.min(SIGHT.length - 1, Math.floor((lv.tries || 0) / 12))).flat().filter(w => w.length >= 2 && w === w.toLowerCase()), w = r.pick(upto);
      return build(r, w, 1, [`Spell the word "${w}".`], false); },
    // 7 blends and digraphs
    (r, lv) => { const w = spellWord(r, lv, BLENDS.filter(x => x.length <= 5)); return build(r, w, 1, [`Spell ${word(w)}.`]); },
  ];

  // ---- memory games (the Fairy Garden) ----
  // Flower Match: pairs face down. A learning level pairs a letter with a picture that starts with it, or a
  // number with that many dots; a swap level has the fairy swap two face-down cards (she sees it happen).
  const MATCH = [[6], [8], [6, 'learn'], [10], [8, 'swap'], [12], [15, 'swap']];
  const MATCH_PICS = ['cat', 'dog', 'pig', 'fox', 'frog', 'bee', 'duck', 'fish', 'sun', 'moon', 'star', 'tree', 'apple', 'cake', 'gift', 'crown', 'ring', 'boat', 'car', 'house', 'rainbow', 'unicorn', 'butterfly', 'strawberry'];
  function match(r, level) {
    const [pairs, twist] = MATCH[level - 1];
    let cards;
    if (twist === 'learn') {
      const ls = others(r, Object.keys(FIRST).filter(l => l.length === 1 && FIRST[l].length && !'aeiou'.includes(l)), pairs);
      cards = ls.flatMap((l, i) => i % 2 ? [{ pair: l, face: { kind: 'num', v: String(i + 1) } }, { pair: l, face: { kind: 'dots', n: i + 1 } }]
        : [{ pair: l, face: { kind: 'letter', v: l } }, { pair: l, face: { kind: 'pic', w: r.pick(FIRST[l]) } }]);
    } else cards = others(r, MATCH_PICS, pairs).flatMap(w => [{ pair: w, face: { kind: 'pic', w } }, { pair: w, face: { kind: 'pic', w } }]);
    return { key: null, kind: 'match', pairs, swap: twist === 'swap', learn: twist === 'learn', cols: pairs <= 6 ? 3 : pairs <= 12 ? 4 : 5, cards: r.shuffle(cards),
      say: [twist === 'learn' ? 'Find the pairs that go together: a letter and a picture that starts with it, or a number and its dots.' : twist === 'swap' ? 'Find the pairs! Watch out: Bloom likes to swap two cards.' : 'Find the pairs! Tap two flowers.'],
      hint: ['Try to remember where you saw it.'], tell: ['You found them all!'] };
  }
  // What's Missing: things on a tray, a cloud covers them, then one (or two) is gone; some levels move them
  const MISSING = [[4, 1, false], [5, 1, false], [6, 1, false], [7, 1, true], [8, 1, true], [9, 2, true], [10, 2, true]];
  const TRAY = ['apple', 'cake', 'gift', 'crown', 'ring', 'star', 'moon', 'key', 'hat', 'cup', 'drum', 'clock', 'shell', 'sock', 'egg', 'pear', 'lemon', 'spoon', 'yoyo', 'flag', 'pencil', 'umbrella', 'robot', 'boat'];
  function missing(r, level) {
    const [n, gone, move] = MISSING[level - 1], items = others(r, TRAY, n), lost = items.slice(0, gone), left = items.filter(x => !lost.includes(x));
    const shown = move ? r.shuffle(left) : items.filter(x => !lost.includes(x)), wrong = others(r, TRAY.filter(x => !items.includes(x)), gone === 2 ? 2 : 2);
    return { key: null, kind: 'missing', items: r.shuffle(items), left: shown, gone: lost, look: 2500 + n * 450,
      choices: r.shuffle([...lost, ...wrong]).map(pic), answer: lost[0], answers: lost,
      say: ['Look carefully at everything on the tray!'], ask: [gone === 2 ? 'Two things are missing! Find them both.' : "What's missing?"],
      hint: ['Think about what was there before.'], tell: [`The ${lost.map(word).join(' and the ')} ${gone === 2 ? 'were' : 'was'} missing.`] };
  }
  // Story Recall: Bloom tells a little story, then asks about it
  const HEROES = ['cat', 'dog', 'pig', 'fox', 'bear', 'frog', 'duck', 'rabbit', 'mouse', 'lion', 'monkey', 'unicorn'];
  const SPOTS = ['house', 'tree', 'boat', 'bus', 'tent', 'bed', 'ship', 'igloo'];
  const FINDS = ['hat', 'key', 'cake', 'apple', 'gift', 'star', 'ring', 'crown', 'drum', 'egg', 'shell', 'cupcake', 'banana', 'sock'];
  const the = w => 'the ' + word(w);
  function recall(r, level) {
    const [a, b] = others(r, HEROES, 2), [p, q] = others(r, SPOTS, 2), [t, u, v] = others(r, FINDS, 3), pick3 = (ans, pool) => r.shuffle([ans, ...others(r, pool, 2, [ans])]).map(pic);
    const Cap = x => x[0].toUpperCase() + x.slice(1);
    if (level === 1) { const story = `${Cap(the(a))} sat in ${the(p)}.`;
      return { key: null, kind: 'pick', story, say: ['Listen to the story.', story, `Who sat in ${the(p)}?`], choices: pick3(a, HEROES), answer: a, hint: ['Listen again.', story], tell: [story] }; }
    if (level === 2) { const story = `${Cap(the(a))} went to ${the(p)}. It found a ${word(t)}.`;
      return { key: null, kind: 'pick', story, say: ['Listen to the story.', story, `What did ${the(a)} find?`], choices: pick3(t, FINDS), answer: t, hint: ['Listen again.', story], tell: [story] }; }
    if (level === 3) { const story = `${Cap(the(a))} and ${the(b)} went to ${the(p)}. ${Cap(the(b))} had a ${word(t)}. ${Cap(the(a))} had a ${word(u)}.`;
      return { key: null, kind: 'pick', story, say: ['Listen to the story.', story, `What did ${the(a)} have?`], choices: r.shuffle([u, t, ...others(r, FINDS, 1, [t, u])]).map(pic), answer: u, hint: ['Listen again.', story], tell: [story] }; }
    if (level === 4) { const story = `${Cap(the(a))} went to ${the(p)}. It found a ${word(t)}. Then it went to ${the(q)}. It found a ${word(u)}.`, first = r() < 0.5;
      return { key: null, kind: 'pick', story, say: ['Listen to the story.', story, `What did ${the(a)} find at ${the(first ? p : q)}?`], choices: r.shuffle([t, u, ...others(r, FINDS, 1, [t, u])]).map(pic), answer: first ? t : u, hint: ['Listen again.', story], tell: [story] }; }
    const story = `First, ${the(a)} found a ${word(t)}. Then it found a ${word(u)}. Last, it found a ${word(v)}.`, ask = r.pick(['first', 'last']);
    return { key: null, kind: 'pick', story, say: ['Listen to the story.', story, `What did ${the(a)} find ${ask}?`], choices: r.shuffle([t, u, v]).map(pic), answer: ask === 'first' ? t : v, hint: ['Listen again.', story], tell: [story] };
  }

  // ---- Pattern Parade (Star Meadow): finish the parade's pattern ----
  // A piece is 'shape.hue' (kitchen.js draws it). Each pattern's pieces differ in shape and colour both,
  // except the colour level, where every piece is the same shape and only the colour repeats.
  const SHAPES = ['star', 'heart', 'moon', 'flower', 'gem', 'cloud', 'circle', 'square', 'triangle', 'crown', 'drop', 'leaf'];
  const HUES = ['pink', 'lilac', 'mint', 'gold', 'sky', 'coral'];
  const HUE_SAY = { pink: 'pink', lilac: 'purple', mint: 'green', gold: 'yellow', sky: 'blue', coral: 'orange' };
  const pieceName = id => { const [sh, hu] = id.split('.'); return `${HUE_SAY[hu]} ${sh}`; };
  const PATTERNS = ['AB', 'AAB', 'ABB', 'ABC', 'AABB', 'mid', 'hue', 'grow'];
  const shapeChoice = id => ({ id, kind: 'shape', v: id, label: pieceName(id) });
  function pattern(r, level) {
    const kind = PATTERNS[level - 1];
    if (kind === 'grow') {
      const sh = r.pick(SHAPES.slice(0, 6)) + '.' + r.pick(HUES), from = r.int(1, 2), step = level >= 8 && r() < 0.4 ? 2 : 1;
      const counts = [0, 1, 2].map(i => from + i * step), ans = from + 3 * step;
      const opts = r.shuffle([ans, ans - step, ans + 1].filter((x, i, a) => x >= 1 && a.indexOf(x) === i));
      return { key: null, kind: 'pick', show: { type: 'grow', piece: sh, counts }, choices: opts.map(n => ({ id: String(n), kind: 'many', v: sh, n, label: `${n} ${pieceName(sh)}s` })), answer: String(ans),
        say: ['The parade grows! How many come next?'], hint: [`Count each group: ${counts.join(', ')}...`], tell: [`Each group has ${step === 1 ? 'one' : 'two'} more. So next comes ${ans}.`] };
    }
    const unit = kind === 'mid' ? r.pick(['AB', 'AAB', 'ABB', 'ABC']) : kind === 'hue' ? r.pick(['AB', 'ABC', 'AAB']) : kind;
    const keys = [...new Set(unit)], hues = r.shuffle(HUES), shapes = r.shuffle(SHAPES), one = shapes[0];
    const piece = Object.fromEntries(keys.map((k, i) => [k, (kind === 'hue' ? one : shapes[i]) + '.' + hues[i]]));
    const reps = unit.length <= 2 ? 3 : 2, seq = [];
    for (let i = 0; i < reps * unit.length + unit.length; i++) seq.push(piece[unit[i % unit.length]]);
    let at, shown;
    if (kind === 'mid') { at = r.int(unit.length, reps * unit.length - 1); shown = seq.slice(0, reps * unit.length + 1); }
    else { at = reps * unit.length + (unit.length > 2 ? r.int(0, 1) : 0); shown = seq.slice(0, at + 1); }
    const answer = seq[at];
    // the wrong ones: the pattern's other pieces, and one that's nearly right (the right shape in another colour, or the colour on another shape)
    const near = kind === 'hue' ? one + '.' + hues[keys.length] : r() < 0.5 ? answer.split('.')[0] + '.' + hues[keys.length] : shapes[keys.length] + '.' + answer.split('.')[1];
    const wrong = [...new Set([...keys.map(k => piece[k]).filter(x => x !== answer), near])].slice(0, 2);
    const unitSaid = [...unit].map(k => kind === 'hue' ? HUE_SAY[piece[k].split('.')[1]] : pieceName(piece[k]).split(' ')[1]).join(', ');
    return { key: null, kind: 'pick', show: { type: 'parade', seq: shown.map((x, i) => i === at ? null : x) },
      choices: r.shuffle([answer, ...wrong]).map(shapeChoice), answer,
      say: [kind === 'mid' ? "What's missing from the parade?" : 'What comes next in the parade?'],
      hint: ['Say the pattern with me:', `${unitSaid}, ${unitSaid}...`], tell: [`The pattern goes ${unitSaid}. So it's the ${pieceName(answer)}.`] };
  }

  // ---- the Unicorn Bakery (the castle kitchen, with Pebble): the right number of things in the bowl ----
  // A bake: { kind: 'bake', mode: 'put' | 'share', need: { ingredient: n }, start: { ingredient: n } already in
  // the bowl, pantry: [ingredients she can add], sack: a sack of ten to add too, plates, treat: what it bakes }.
  // She adds (and taps out) things, then taps Bake; the app checks the bowl against need.
  const ING = ['strawberry', 'blueberry', 'cherry', 'egg', 'sugar', 'chocolate', 'banana', 'lemon', 'marshmallow', 'apple', 'carrot'];
  const ING_SAY = { strawberry: ['strawberry', 'strawberries'], blueberry: ['blueberry', 'blueberries'], cherry: ['cherry', 'cherries'], egg: ['egg', 'eggs'], sugar: ['sugar cube', 'sugar cubes'],
    chocolate: ['chocolate square', 'chocolate squares'], banana: ['banana slice', 'banana slices'], lemon: ['lemon slice', 'lemon slices'], marshmallow: ['marshmallow', 'marshmallows'], apple: ['apple', 'apples'], carrot: ['carrot', 'carrots'] };
  const TREAT_OF = { strawberry: 'cake', blueberry: 'muffin', cherry: 'pie', egg: 'cupcake', sugar: 'cookie', chocolate: 'cookie', banana: 'muffin', lemon: 'tart', marshmallow: 'donut', apple: 'pie', carrot: 'carrotcake' };
  const TREAT_SAY = { cake: 'a little cake', muffin: 'a muffin', pie: 'a pie', cupcake: 'a cupcake', cookie: 'star cookies', tart: 'a lemon tart', donut: 'a donut', carrotcake: 'a carrot cake' };
  const many = (n, id) => `${n} ${ING_SAY[id][n === 1 ? 0 : 1]}`;
  function bake(r, level) {
    const [a, b] = others(r, ING, 2), treat = TREAT_OF[a];
    const base = { key: null, kind: 'bake', mode: 'put', start: {}, pantry: [a], sack: false, treat };
    const done = need => Object.entries(need).map(([k, n]) => many(n, k)).join(' and ');
    const q = need => Object.assign(base, { need, tell: [`The recipe needs ${done(need)}.`] });
    if (level === 1 || level === 2) { const n = level === 1 ? r.int(1, 5) : r.int(6, 10);
      return Object.assign(q({ [a]: n }), { say: [`Let's bake ${TREAT_SAY[treat]}! Put ${many(n, a)} in the bowl, then tap Bake.`] }); }
    if (level === 3) { const x = r.int(1, 5), y = r.int(1, 5);
      return Object.assign(q({ [a]: x, [b]: y }), { pantry: [a, b], say: [`Put in ${many(x, a)} and ${many(y, b)}.`] }); }
    if (level === 4) { const n = r.int(2, 6), up = r() < 0.6, m = up ? n + 1 : n - 1;
      return Object.assign(q({ [a]: n, [b]: m }), { start: { [a]: n }, pantry: [b], show: 'start',
        say: [`There are ${many(n, a)} in the bowl. Put in ${ING_SAY[b][1]}: ${up ? 'one more' : 'one fewer'} than the ${ING_SAY[a][1]}.`] }); }
    if (level === 5) { const x = r.int(1, 5), y = r.int(1, Math.min(5, 10 - x));
      return Object.assign(q({ [a]: x + y }), { groups: [x, y], say: [`The recipe says ${many(x, a)}, and ${y} more. Put them all in!`] }); }
    if (level === 6) { const n = r.int(5, 10), k = r.int(1, Math.min(4, n - 1));
      return Object.assign(q({ [a]: n - k }), { start: { [a]: n }, pantry: [], say: [`Oops! There are ${many(n, a)}. That's too many. Tap ${k} to take ${k === 1 ? 'it' : 'them'} out.`] }); }
    if (level === 7) { const n = r.int(2, 8);
      return Object.assign(q({ [a]: 10 }), { start: { [a]: n }, frame: true, say: [`Fill the bowl up to 10 ${ING_SAY[a][1]}.`] }); }
    if (level === 8) { const k = r.int(1, 9), m = 'marshmallow';
      return Object.assign(base, { need: { [m]: 10 + k }, pantry: [m], sack: true, treat: 'donut', tell: [`${10 + k} is a sack of ten and ${k} more.`],
        say: [`We need ${10 + k} marshmallows. A sack holds ten!`] }); }
    if (level === 9) { const plates = r() < 0.6 ? 2 : 3, each = r.int(2, plates === 2 ? 5 : 3), n = plates * each;
      return { key: null, kind: 'bake', mode: 'share', n, plates, treat: 'cookie', need: { each },
        say: [`Share ${n} cookies on ${plates} plates, the same on each. Tap a plate to put a cookie on it.`], tell: [`${n} cookies on ${plates} plates is ${each} on each plate.`] }; }
    const x = r.int(5, 10), y = r.int(5, 10);
    return Object.assign(q({ [a]: x, [b]: y }), { pantry: [a, b], say: [`A big bake! Put in ${many(x, a)} and ${many(y, b)}.`] });
  }

  // One question for a skill at a level. lv: { tries } how many questions she's had at this level (it
  // widens the letter and sight word sets as she goes). A review key brings back that item when it can.
  function make(skill, level, r, lv = {}, review = null) {
    let q;
    level = Math.max(1, Math.min(LADDERS[skill] || 1, level));
    if (skill === 'wand') return wand(r, level);
    if (skill === 'pattern') return Object.assign({ skill, level, text: null, hintShow: null }, pattern(r, level));
    if (skill === 'bake') return Object.assign({ skill, level, text: null, show: null }, bake(r, level));
    if (skill === 'match') return Object.assign({ skill, level }, match(r, level));
    if (skill === 'missing') return Object.assign({ skill, level, text: null, show: null }, missing(r, level));
    if (skill === 'recall') return Object.assign({ skill, level, text: null, show: null }, recall(r, level));
    const list = skill === 'math' ? MATH : skill === 'spell' ? SPELL : READ;
    level = Math.max(1, Math.min(list.length, level));
    if (review) q = fromKey(skill, review, r);
    if (!q) q = list[level - 1](r, lv);
    return Object.assign({ skill, level, text: null, show: null, hintShow: null }, q);
  }
  // A review item rebuilt from its key, for the kinds where the key says it all.
  function fromKey(skill, key, r) {
    const [k, v] = [key.slice(0, 1), key.slice(2)];
    if (skill === 'read' && k === 'w' && PIC[v]) { const wrong = others(r, (BLENDS.includes(v) ? BLENDS : CVC), 2, [v]);
      return { key, kind: 'pick', say: ['Read the word. Which picture is it?'], text: v, choices: r.shuffle([v, ...wrong]).map(pic), answer: v, hint: ['Sound it out:', ...[...v].map(snd)], tell: ['It says', word(v), '.'] }; }
    if (skill === 'read' && k === 's' && LETTERS.includes(v)) { const wrong = others(r, LETTERS, 3, [v]);
      return { key, kind: 'pick', say: ['Which letter makes the sound', snd(v), '?'], choices: r.shuffle([v, ...wrong]).map(x => ({ id: x, kind: 'letter', v: x, label: x })), answer: v, hint: [snd(v), ', as in', word(EXAMPLE[v]), '.'], tell: [`This letter, ${v}, says`, snd(v), '.'] }; }
    if (skill === 'read' && k === 'h' && SIGHT_ALL.includes(v)) { const wrong = others(r, SIGHT_ALL, 2, [v]);
      return { key, kind: 'pick', say: [`Find the word "${v}".`], choices: r.shuffle([v, ...wrong]).map(x => ({ id: x, kind: 'word', v: x, label: x })), answer: v, hint: [`"${v}" starts with ${v[0]}.`], hintShow: v, tell: [`This word is "${v}".`] }; }
    if (skill === 'spell' && k === 'p' && /^[a-z]{2,5}$/.test(v)) return build(r, v, CVC.includes(v) ? 2 : 1, [`Spell ${word(v)}.`], !!PIC[v]);
    if (skill === 'spell' && k === 's' && LETTERS.includes(v)) return Object.assign(SPELL[0](r, {}), { key }, { say: ['Which gem says', snd(v), '?'], choices: r.shuffle([v, ...others(r, LETTERS, 2, [v])]).map(letterChoice), answer: v, hint: [snd(v), ', as in', word(EXAMPLE[v]), '.'], tell: [`This gem, ${v}, says`, snd(v), '.'] });
    if (skill === 'math' && k === 'f') { const m = /^(\d+)([+-])(\d+)$/.exec(v); if (!m) return null; const a = +m[1], b = +m[3], add = m[2] === '+', ans = add ? a + b : a - b;
      return { key, kind: 'pick', say: [`What is ${a} ${add ? 'plus' : 'take away'} ${b}?`], text: `${a} ${m[2]} ${b} = ?`, show: a + b <= 10 ? { type: add ? 'add' : 'take', a, b, hidden: true } : null,
        choices: nums(r, ans, 0, 20), answer: String(ans), hint: [add ? `Start at ${a} and count on ${b}.` : `Start at ${a} and count back ${b}.`], hintShow: a + b <= 10 ? 'reveal' : null, tell: [`${a} ${add ? 'plus' : 'take away'} ${b} is ${ans}.`] }; }
    return null;
  }

  // A quick question for a path in the kingdom (a signpost, a bridge): one she's very likely to get.
  function gate(kind, levels, r) {
    if (kind === 'sign') { const lv = Math.max(1, Math.min(LADDERS.read, (levels.read || 1) - 1));
      if (lv >= 8) { const a = r.pick(CVC), b = r.pick(CVC.filter(x => x !== a));
        return { kind: 'sign', say: ['Read the signs. Which way to the ' + word(a) + '?'], signs: r.shuffle([a, b]), answer: a, hint: ['Sound out each sign.'], tell: [`This sign says ${word(a)}.`] }; }
      const l = r.pick(LETTER_SETS[0]), m = r.pick(LETTERS.filter(x => x !== l));
      return { kind: 'sign', say: ['Which sign has the letter that says', snd(l), '?'], signs: r.shuffle([l, m]), answer: l, hint: [snd(l), ', as in', word(EXAMPLE[l])], tell: [`This one: ${l}.`] }; }
    if (kind === 'bridge') { const lv = Math.max(1, (levels.math || 1) - 1);
      const n = lv <= 2 ? r.int(3, 8) : lv <= 5 ? r.int(4, 10) : r.int(8, 15);
      return { kind: 'bridge', say: [`The bridge needs ${n} planks. Tap ${n} planks to fix it.`], n, tell: [`${n} planks. The bridge is fixed!`] }; }
    if (kind === 'door') { const lv = Math.max(1, (levels.wand || 1) - 1); return Object.assign(wand(r, lv), { kind: 'wand', gate: true }); }
    if (kind === 'flower') { const set = r.pick(RHYMES), [a, b] = r.shuffle(set), c = r.pick(Object.keys(PIC).filter(w => !set.includes(w) && w.length <= 5));
      return { kind: 'sign', pics: true, say: [`The flower gate opens for a rhyme. Which one rhymes with ${word(a)}?`], show: a, signs: r.shuffle([b, c]), answer: b, hint: [`Listen to the end: ${word(a)}... ${word(b)}...`], tell: [`${word(a)} and ${word(b)} rhyme!`] }; }
    if (kind === 'tiara') { const w = r.pick(CVC); return Object.assign(build(r, w, (levels.spell || 1) >= 4 ? 1 : 0, [`The workshop door needs a password. Spell ${word(w)}!`]), { gate: true }); }
    return null;
  }

  // the review keys that come back as themselves (fromKey): words, letter sounds, sight words, facts
  const reviewable = key => /^(w|s|h|p):/.test(key) || /^f:\d+[+-]\d+$/.test(key);

  root.SparkleContent = { MATCH, MISSING, TRAY, HEROES, FINDS, SPOTS, SPELL, PIC, SAY, CVC, RHYMES, SYLL, FIRST, LETTER_SETS, LETTERS, EXAMPLE, SWAPS, SIGHT, SIGHT_ALL, BLENDS, LADDERS, LEVEL_NAMES, READ, MATH, WAND,
    SHAPES, HUES, HUE_SAY, PATTERNS, ING, ING_SAY, TREAT_OF, pieceName, many, word, make, fromKey, gate, reviewable };
})(typeof window !== 'undefined' ? window : globalThis);
