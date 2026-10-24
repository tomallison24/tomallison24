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
    unicorn: '🦄', butterfly: '🦋', banana: '🍌', dinosaur: '🦕', elephant: '🐘', strawberry: '🍓', octopus: '🐙', kangaroo: '🦘', tomato: '🍅', ladybug: '🐞',
    watermelon: '🍉', helicopter: '🚁', alligator: '🐊', avocado: '🥑', television: '📺',
    sock: '🧦', tent: '⛺', duck: '🦆', fish: '🐟', ring: '💍', nose: '👃', gift: '🎁', juice: '🧃', violin: '🎻', zebra: '🦓',
    yoyo: '🪀', ant: '🐜', egg: '🥚', ox: '🐂', umbrella: '☂️', igloo: '🧊', whale: '🐳', horse: '🐴', lion: '🦁', robot: '🤖',
    ship: '🚢', shell: '🐚', chick: '🐥', crab: '🦀', drum: '🥁', flag: '🚩', sled: '🛷', clock: '🕐', truck: '🚚', plum: '🍑',
  };
  // Some pictures are better said one way: an umbrella is "umbrella", an igloo's ice is "ice".
  const SAY = { yoyo: 'yo-yo', igloo: 'ice' };

  // ---- reading banks ----
  // (only words whose picture nobody would call something else: a 🐔 is a chicken to a 5-year-old, not a hen)
  const CVC = ['cat', 'bat', 'hat', 'map', 'can', 'bed', 'web', 'leg', 'gem', 'pen', 'ten', 'pig', 'pin', 'dog', 'fox', 'box', 'log', 'sun', 'bus', 'bug'];
  const RHYMES = [['cat', 'hat', 'bat'], ['pen', 'ten'], ['dog', 'log', 'frog'], ['fox', 'box'], ['star', 'car'], ['cake', 'snake'],
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
    s: ['sun', 'snake', 'sock', 'star'], t: ['tiger', 'tent', 'ten', 'tree'], p: ['pig', 'pen', 'pumpkin', 'pear', 'pin'], m: ['moon', 'map', 'monkey', 'mouse'],
    b: ['bus', 'bat', 'bee', 'banana', 'bear'], d: ['dog', 'dragon', 'duck', 'dinosaur'], c: ['cat', 'cake', 'car', 'cupcake'], f: ['fox', 'fish', 'frog'],
    h: ['hat', 'house', 'horse'], r: ['rainbow', 'rocket', 'ring', 'rabbit'], l: ['lemon', 'log', 'leg', 'lion'], n: ['nose'],
    g: ['goat', 'gift'], w: ['web', 'watermelon', 'whale'], j: ['juice'], v: ['violin'], z: ['zebra'], k: ['key', 'kangaroo'],
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
    ['bus', 'bug', 2, 'g'], ['bug', 'bus', 2, 's'], ['pin', 'pig', 2, 'g'], ['pig', 'pin', 2, 'n']];
  // sight words, a few at a time (high-utility kindergarten words)
  const SIGHT = [['the', 'a', 'I', 'is'], ['it', 'in', 'to', 'and'], ['see', 'can', 'we', 'my'], ['like', 'go', 'you', 'he'], ['she', 'was', 'said', 'of'], ['are', 'look', 'here', 'for', 'have', 'do']];
  const SIGHT_ALL = SIGHT.flat();
  // digraph and blend words
  const BLENDS = ['ship', 'fish', 'shell', 'chick', 'crab', 'drum', 'flag', 'sled', 'clock', 'truck', 'duck', 'sock', 'frog', 'plum'];
  const SENTENCES = ['I see a {w}.', 'Look at the {w}.', 'Here is my {w}.', 'The {w} is big.', 'Can you see the {w}?', 'I like the {w}.', 'We have a {w}.', 'Look! A {w}!'];
  const SAT_ON = { bed: 'bed', box: 'box', log: 'log', hat: 'hat', map: 'map', bus: 'bus' };
  const ANIMALS = ['cat', 'dog', 'pig', 'fox', 'bug', 'bat'];
  const ADJ = ['big', 'red', 'hot', 'wet', 'sad', 'fun'];

  const LADDERS = { read: 12, math: 10, wand: 7 };
  const LEVEL_NAMES = {
    read: ['Syllables', 'Rhymes', 'First sounds', 'Onset and rime', 'Letter sounds', 'Blending', 'Middle and last sounds', 'Reading short words', 'Sight words', 'Sentences', 'Little stories', 'Digraphs and blends'],
    math: ['Count to 10', 'Count to 20, count on', 'More and fewer', 'Add within 5', 'Take away within 5', 'Make 10', 'Within 10', 'Count by tens', 'Within 20', 'Missing numbers'],
    wand: ['Sequences of 3', 'Sequences of 4', 'Sequences of 5', 'Sequences of 6', 'Backwards', 'Sequences of 7 and 8', 'Sequences of 9'],
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
        return { key: 'x:' + from + to, kind: 'pick', say: [`Change the ${at === 0 ? 'first' : 'last'} sound of ${word(from)} to`, snd(l), '. What do you get?'], show: { type: 'pic', w: from, v: PIC[from] },
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

  // One question for a skill at a level. lv: { tries } how many questions she's had at this level (it
  // widens the letter and sight word sets as she goes). A review key brings back that item when it can.
  function make(skill, level, r, lv = {}, review = null) {
    let q;
    if (skill === 'wand') return wand(r, level);
    const list = skill === 'math' ? MATH : READ;
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
    return null;
  }

  // the review keys that come back as themselves (fromKey): words, letter sounds, sight words, facts
  const reviewable = key => /^(w|s|h):/.test(key) || /^f:\d+[+-]\d+$/.test(key);

  root.SparkleContent = { PIC, SAY, CVC, RHYMES, SYLL, FIRST, LETTER_SETS, LETTERS, EXAMPLE, SWAPS, SIGHT, SIGHT_ALL, BLENDS, LADDERS, LEVEL_NAMES, READ, MATH, WAND,
    word, make, fromKey, gate, reviewable };
})(typeof window !== 'undefined' ? window : globalThis);
