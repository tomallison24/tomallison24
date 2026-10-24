'use strict';

// Sparkle Kingdom's story: ten chapters in each land, told by the land's friend. A chapter opens after
// rounds played in that land (AT), never for a score, so every child reaches the end by playing. Each
// chapter brings a little more colour back to its land on the map (colour()), and the 5th and 10th
// give a present for her castle that is never sold (gift: a room piece in rooms.js, or an item in art.js).
// {name} is the player's name.
(function (root) {
  const AT = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30];
  const WHO = { read: 'owl', math: 'dragon', wand: 'narrator', garden: 'fairy', spell: 'fairy' };
  const FRIEND = { read: 'Professor Hoot', math: 'Pebble', wand: 'your unicorn', garden: 'Bloom', spell: 'Gemma' };
  const LAND = { read: 'Story Tower', math: 'the Gem Mine', wand: 'Star Meadow', garden: 'the Fairy Garden', spell: 'the Tiara Workshop' };

  const STORY = {
    read: [
      ['The sleepy books', ['Hoo hoo! Welcome to Story Tower, {name}.', 'The Grey Fog blew in through my window, and all the words in my books fell fast asleep.', 'But when you read a word, it wakes right up. Shall we wake them together?']],
      ['The first word wakes', ['Look! A little blue book is wiggling.', 'Out jumps the word cat. It stretches, and purrs, and runs back onto its page.', 'You did that, {name}. Your reading woke it up!']],
      ['The flying books', ['Flap, flap, flap! The books on the top shelf can fly again.', 'They swoop around the tower like happy birds.', 'One of them lands right on your head. It tickles!']],
      ['The lost letters', ['Oh dear. Some letters rolled under the rug when the fog came.', 'You found a b, a d and a p, all hiding together.', 'They look a lot alike, but you know just which one is which.']],
      ['A lamp for reading', ['Hoot has a present for you, {name}.', 'It is a lamp shaped just like him, with big round glowing eyes.', 'Put it in your castle library, for reading at bedtime.'], 'library-owl-lamp'],
      ['The rhyming stairs', ['The stairs in Story Tower only move when you say a rhyme.', 'Cat, hat. Up one step. Bug, rug. Up another!', 'Now we can climb all the way to the round window at the top.']],
      ['The story window', ['From the round window, you can see the whole kingdom.', 'Some of it is still grey, but Story Tower is pink and purple again.', 'Every word you read paints a little more colour.']],
      ['The big storybook', ['At the top of the tower sits the biggest book in the kingdom.', 'Its pages are blank. The fog took every story.', 'Hoot says only a real reader can write them back. That means you!']],
      ['The stories come home', ['You read, and read, and the stories pour back into the big book.', 'Dragons and fairies and princesses dance across the pages.', 'Hoot is so happy that he does a little owl dance. Hoo hoo hoo!']],
      ['Story Tower shines', ['Every book is awake, and every page has its words.', 'Story Tower shines with all its colours, from the floor to the very top.', 'Hoot gives you a golden bookshelf for your castle. Thank you, reader {name}!'], 'library-shelf-golden'],
    ],
    math: [
      ['Pebble lost count', ['Hi, {name}! I am Pebble. I live in the Gem Mine.', 'The Grey Fog made all my gems go grey, and now I keep losing count of them.', 'Can you help me count? Counted gems start to sparkle again!']],
      ['The first sparkle', ['One, two, three! Three red gems, counted just right.', 'Look, they glow pink and red again!', 'Pebble is so happy that a little puff of glitter comes out of his nose.']],
      ['The gem cart', ['Pebble has a cart that rolls along the mine tracks.', 'It only rolls when it has just the right number of gems.', 'You counted them all, so off we go! Wheee!']],
      ['The cave of tens', ['Deep in the mine is a cave where gems grow in bunches of ten.', 'Ten, twenty, thirty! Counting by tens is so much faster.', 'Pebble writes it on the cave wall with his tail, so he won\'t forget.']],
      ['A cuddly friend', ['Pebble has a present for you.', 'It is a little dragon, soft and cuddly, just like him.', 'Put it in your castle ballroom, so it can watch you dance.'], 'ballroom-dragon-plush'],
      ['The missing gems', ['Oh no! Some gems rolled away in the dark.', 'There were seven, and now there are four. How many are missing?', 'Three! You found them hiding behind a rock. Clever princess!']],
      ['The crystal lake', ['Under the mine there is a lake as clear as glass.', 'Gems shine at the bottom like stars in the sky.', 'When you add them up, the lake begins to glow blue.']],
      ['Pebble\'s hoard', ['Every dragon has a pile of treasure. Pebble\'s pile was all grey.', 'You counted it, one gem at a time, and now it glitters in every colour.', 'Pebble rolls in it and giggles. Dragons love sparkly things.']],
      ['The great gem', ['At the very bottom of the mine sleeps the biggest gem of all.', 'It is so big that you have to count all the way to twenty to go around it.', 'Nineteen, twenty! The great gem opens one sparkly eye.']],
      ['The Gem Mine shines', ['Every gem in the mine is counted, and every gem shines.', 'The Gem Mine glows with every colour of the rainbow.', 'Pebble gives you a gem chandelier for your ballroom. You are the best counter in the kingdom, {name}!'], 'ballroom-chandelier-gems'],
    ],
    wand: [
      ['The sleepy stars', ['Your unicorn nuzzles you and looks up at the sky.', 'The stars of Star Meadow have gone dim. The Grey Fog made them sleepy.', 'When your wand remembers their sparkles, the stars wake up.']],
      ['The first star', ['Twinkle, twinkle! One little star is shining again.', 'It floats down and sits right on the tip of your unicorn\'s horn.', 'Your unicorn sparkles all over and does a happy little hop.']],
      ['The star song', ['The stars of Star Meadow sing when they shine.', 'Each sparkle is a note, and you remembered them all in order.', 'The meadow hums along. La, la, la!']],
      ['Moonbeam pond', ['In the middle of the meadow is a pond that holds the moon.', 'The fog had hidden it, but your sparkles made it bright again.', 'Your unicorn takes a sip, and its mane glows silver.']],
      ['A moon for your room', ['The moon has a present for you, {name}.', 'It is a little moon lamp that glows softly all night long.', 'Put it in your bedroom, so you always have sweet dreams.'], 'bedroom-moon-lamp'],
      ['The backwards star', ['One star is a little silly. It only wakes up backwards!', 'You remembered its sparkles from the end to the start.', 'The silly star laughs so hard that it spins around and around.']],
      ['Shooting stars', ['Whoosh! Shooting stars race across the sky.', 'They are playing a game of chase, and your unicorn wants to play too.', 'Up you fly, over the meadow, faster than the wind!']],
      ['The star map', ['The stars line up to make a picture in the sky.', 'It is a map of the whole kingdom, drawn in sparkles.', 'You can see your castle, and Story Tower, and the Gem Mine.']],
      ['The brightest star', ['Far away, one star is still asleep. It is the brightest star of all.', 'You wave your wand and remember the longest sparkle pattern yet.', 'The brightest star opens its eyes and smiles at you.']],
      ['Star Meadow shines', ['Every star in the sky is awake and shining.', 'Star Meadow glows gold and purple, and the flowers twinkle too.', 'The stars give you a bed of stars for your bedroom. Goodnight, star princess {name}!'], 'bedroom-bed-stars'],
    ],
    garden: [
      ['The closed flowers', ['Hello, {name}! I am Bloom, a garden fairy.', 'When the Grey Fog came, every flower in my garden closed up tight.', 'They open for good memories. Will you help me remember?']],
      ['The first bloom', ['Pop! A pink flower opens wide.', 'Inside, a tiny ladybug was sleeping. She waves hello.', 'You remembered just right, and the flower remembered how to bloom!']],
      ['The fairy ring', ['A ring of mushrooms grows in the middle of the garden.', 'Fairies dance here when the moon is up.', 'Tonight, they ask you to dance with them. Twirl, princess, twirl!']],
      ['The busy bees', ['Buzz, buzz! The bees are back, and they are very busy.', 'They visit every flower you opened, one after another.', 'They make honey that tastes like sunshine.']],
      ['A rug of flowers', ['Bloom has a present for you.', 'It is a soft rug, covered in flowers from the garden.', 'Put it in your bedroom, so your feet feel like they are walking on petals.'], 'bedroom-rug-garden'],
      ['The hiding game', ['The garden fairies love to play hide and seek.', 'They hid behind the leaves, but you remembered where every one went.', 'Found you! The fairies giggle and sprinkle you with petals.']],
      ['The rainbow rain', ['A little cloud floats over the garden and starts to rain.', 'But it is not grey rain. It is rainbow rain!', 'Every drop that lands turns a leaf green or a petal pink.']],
      ['The talking tree', ['In the oldest part of the garden stands a very old tree.', 'It tells you a story about the kingdom, long ago, before the fog.', 'You listened so well that the tree grew a brand new flower, just for you.']],
      ['The fairy queen', ['The Fairy Queen comes to visit the garden.', 'She has heard about the princess with the wonderful memory.', 'She bows to you, {name}, and you curtsy right back.']],
      ['The Fairy Garden shines', ['Every flower in the garden is open, and the fairies are dancing.', 'The Fairy Garden glows pink and green and gold.', 'Bloom gives you a pair of real fairy wings. Now you can fly like a fairy!'], 'cape-wings'],
    ],
    spell: [
      ['The tiara with no gems', ['Welcome to the Tiara Workshop, {name}! I am Gemma.', 'I was making the Rainbow Tiara when the Grey Fog took all my letter gems.', 'Every word you spell gives a gem back. Shall we make the tiara together?']],
      ['The first gem', ['You spelled a word, and a letter gem dropped into my hand!', 'It is a sparkly a. Its colour is coming back already.', 'Clink! It fits on the tiara just right.']],
      ['The gem sorting', ['My gems got all jumbled up in the fog.', 'You listen for each sound, and find the gem that makes it.', 'Now they are all in neat little rows. Thank you!']],
      ['The magic hammer', ['This is my tiny hammer. Tap, tap, tap.', 'It only works when the word is spelled just right.', 'You spelled it, and the hammer made a new tiara band. Shiny!']],
      ['A floor that sparkles', ['Gemma has a present for you.', 'It is a crystal floor that sparkles when you dance on it.', 'Put it in your castle ballroom, and dance, dance, dance!'], 'ballroom-floor-crystal'],
      ['The word swap', ['Gemma takes one gem out of a word and puts a new one in.', 'Cat turns into hat! Hat turns into hot!', 'One little letter makes a whole new word. That is word magic.']],
      ['The gem window', ['The workshop window is made of letter gems.', 'When the sun shines through, it paints words on the floor.', 'Can you read them? Of course you can!']],
      ['The tricky words', ['Some words are tricky. They don\'t sound the way they look.', 'The, said, was. But you learned them anyway!', 'Gemma puts a gold star next to each one.']],
      ['Almost ready', ['The Rainbow Tiara is almost ready.', 'It needs just a few more gems, for the hardest words of all.', 'You spell them carefully, one sound at a time.']],
      ['The Rainbow Tiara', ['The last gem clicks into place, and the tiara shines in every colour.', 'The Tiara Workshop glows like a rainbow.', 'Gemma puts the Rainbow Tiara on your head. It is yours, princess {name}!'], 'tiara-rainbow'],
    ],
  };

  const LANDS = Object.keys(STORY);
  const CHAPTERS = Object.fromEntries(LANDS.map(l => [l, STORY[l].map(([title, lines, gift], i) => ({ land: l, n: i + 1, at: AT[i], title, lines, gift: gift || null }))]));
  const GIFTS = LANDS.flatMap(l => CHAPTERS[l].filter(c => c.gift).map(c => c.gift));

  // the chapters she has reached in a land: rounds played there
  const reached = (land, rounds) => CHAPTERS[land].filter(c => rounds >= c.at).length;
  // the next chapter to tell: seen = how many she has heard there
  const next = (land, rounds, seen) => { const n = reached(land, rounds); return seen < n ? CHAPTERS[land][seen] : null; };
  // how much colour a land has back: 0.3 under the fog's grey, 1 when its story is done
  const colour = seen => Math.min(1, 0.3 + 0.07 * Math.max(0, Math.min(10, seen || 0)));
  const line = (text, name) => text.replace(/\{name\}/g, name || 'princess');

  root.SparkleChapters = { AT, WHO, FRIEND, LAND, LANDS, CHAPTERS, GIFTS, reached, next, colour, line };
})(typeof window !== 'undefined' ? window : globalThis);
