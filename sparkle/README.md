# Sparkle Kingdom

A princess and unicorn learning game for a 5-year-old, and her brothers and sisters (a player each),
in aOS's Games group. The kingdom has lost its colours to a gentle Grey Fog; she rides her unicorn
across floating islands to bring them back, and every coin she earns is earned by learning. Reading
comes first. The design is in the spec, "Sparkle Kingdom: Game Spec" (a Claude doc the owner has).

- **Who's playing**: a portrait for each child (her princess), so nobody needs to read to pick.
  The first player is made right there; more are added by a grown-up.
- **The kingdom** (`world.js`): one big scrolling picture. She taps where to go and her unicorn
  glides along the paths in one smooth trip up to each shut gate (a transform each frame, the view
  easing after her). The storyteller says hello and where to go once, when she picks her princess;
  back from a game the kingdom is quiet. The paths themselves are practice, at her level:
  - a **signpost** to read on the way to Story Tower,
  - the **rainbow bridge** to mend by counting planks, on the way to the Gem Mine,
  - the **crystal door** that opens to a sparkle pattern, on the way to Star Meadow.
  A gate asks once a session. Hidden stars (2 coins each) and four critters for her treasure book are
  about the islands. The Fairy Garden and the Tiara Workshop start under the Grey Fog, which lifts
  after her 2nd round (the garden) and her 4th (the workshop); then steps of cloud lead to each, past
  their own gates: a **flower arch** that opens for a rhyme, and a **gem door** that opens for a word
  spelled. Tapping the fog says it will lift if she keeps learning.
  **Today's quest** is three stops, always starting at Story Tower; finishing it gives a present.
- **A round** (6 to 8 questions) in a land: Story Tower (reading, Professor Hoot), the Tiara Workshop
  (spelling, Gemma the fairy), the Gem Mine (math, Pebble the dragon), Star Meadow (with her own
  unicorn: the wand's sparkle sequences, or **Pattern Parade**, a game a round, the one she's played
  least first) and the Fairy Garden (memory, Bloom the fairy: Flower Match, What's
  Missing and Story Recall, a game a round, the one she's played least first; Flower Match rounds are
  2 games, the others 5 questions). Every question is spoken, and
  shown in the school letters as it's said; tapping the host says it again. No timers, lives or
  game over: a first miss gets a hint, a second shows the answer kindly.
- **How to play**: before a round whose game is new to her (a skill's level she hasn't played: a new
  kind of question, a longer sparkle pattern, more flowers), the land's friend says in a sentence
  what to do, then a hand plays one sample question on the real game while she watches (her taps are
  held back; a grown-up can Skip), then it's her turn. The sample earns nothing and isn't counted.
  It's shown once a level; the **?** button in a round shows it again.
- **Getting harder by itself** (`engine.js`): each skill is a ladder (reading 12 levels, spelling 7,
  math 10, wand 7, Flower Match 7, What's Missing 7, Story Recall 5). 4 right in a row or 9 of her last 10 moves her up; 2 misses in a row on new items or
  6 or fewer of 10 moves her down (a right answer after a hint counts half). The first visit to a
  skill is a 6-question warm-up that finds her level. Words, letter sounds, sight words and math
  facts she misses (or just learned) come back 1, 3 and 7 days later; after 3 different days right
  they're known. The thresholds are `TUNE` in engine.js.
- **The questions** (`content.js`): reading follows IXL's kindergarten Learn to Read plan, which
  her school uses (syllables, rhymes, first sounds, onset and rime, letter sounds, blending, middle
  and last sounds, short words, sight words once she can sound words out, sentences, little
  stories, digraphs and blends); math follows the kindergarten standards and goes past them
  (tens, within 20, missing numbers); memory is the wand's sparkle sequence, 3 up to 9, backwards
  on one level. Spelling (Tiara Workshop) taps letter gems in order, so no handwriting: a sound to its
  gem, a word's first letter, building words (then with extra gems), changing one letter to make a new
  word, sight words, and blends; it practises the words she has met in Story Tower. Flower Match goes
  from 6 pairs to 15, with learning pairs (a letter and a picture that starts with it, a number and its
  dots) and the fairy swapping two cards; What's Missing from 4 things to 10, things that move and two
  gone; Story Recall from "who" to "what came first". Every word picture is drawn
  (`pictures.js`), and only words a 5-year-old would name that one way are used.
- **The story** (`chapters.js`): ten chapters in each land (50 in all), told a page at a time by the
  land's friend, over the land's own backdrop. A chapter opens after rounds played in that land (1, 2,
  4, 6, 9, 12, 16, 20, 25 and 30), never for a score, so every child reaches the end; a book at the
  end of the round says one is ready, and one waiting stays until it's heard. Each land starts grey
  under the fog on the map and gets its colour back a chapter at a time, all of it at chapter 10.
  Chapters 5 and 10 give a present that is never sold (a piece for a castle room, the fairy wings, the
  Rainbow Tiara). The castle's **Stories** shelf plays any chapter heard again.
- **Pattern Parade** (Star Meadow, `content.js` pattern): finish the parade's pattern of floats (AB,
  AAB, ABB, ABC, AABB, a gap in the middle, colour only, then growing patterns), 8 levels.
- **The Unicorn Bakery** (the castle's kitchen, with Pebble, `content.js` bake): tap the right number
  of things into the bowl, tap one to take it out, then Bake: count to 5 and to 10, two ingredients, one
  more or one fewer, put together, take away, make 10, tens and ones (a sack of ten), share cookies
  fairly on plates, within 20; 10 levels, 5 bakes a round. Each thing put in is counted out loud; a
  wrong bake counts the bowl with her, a second says the recipe. Every bake that comes out right is a
  treat for her unicorn's pantry. Not in the story's chapters or the quest; a Settings switch
  (Learning > Bakery) rests it.
- **Her castle** (`stable-art.js` castle): the castle's button on the map opens it cut away like a
  dollhouse: tap the bedroom, the library, the ballroom, the dressing room (the Boutique, the
  stories, the treasures), the kitchen (the bakery) or the stables. The stables glow, and the map's
  castle button shows what's wanted, when her unicorn needs her.
- **The stables** (`care.js`, `stable-art.js`): her unicorn, like a Tamagotchi. Food, clean, fun and
  rest fall as real time passes (food and fun fastest: empty in about 17 hours) and a little after
  each round (the Gem Mine is muddiest); a unicorn left alone looks sad, on the map too (never ill,
  never gone). She feeds it (oats and apples are always free; baked treats and the shop's carrots,
  clover and sugar fill more), rubs it with the sponge until it's foamy and rinses it with the bucket,
  brushes the mane, plays with the ball (and the bubble wand, ribbon and kite from the shop), pats it,
  and puts it to bed with the lantern: asleep, rest fills (faster while she watches) and it wakes when
  rested, or when she rides off. Too tired or hungry, it won't play. Coins only buy extras.
  Left be, it wanders the stable (each leg swinging, a little trot, facing the way it goes; slower
  when sad or tired), nods and nibbles the straw, its tail always swishing; it stands still to be fed,
  washed or played with, and only breathes slowly asleep (none of it with Reduce Motion).
- **Her bedroom** (`bedroom.js`): tap things to play with them: the bed puts her to sleep (night,
  a lullaby, her head on the pillow; a tap wakes her), lamps and fairy lights, curtains, the music
  box, the toy chest, the star nightlight, the plant blooms, plush toys hop, the wardrobe and vanity
  open the dressing room, the bookshelf the stories; tap the floor and she walks there. Decorate
  (the paintbrush): drag anything anywhere (wall things on the wall, the rest on the floor), turn it
  around or put it away; add her things, buy more in the shop, change the wallpaper and the floor.
  Her old bedroom pieces and the story's presents carry over.
- **Castle rooms** (`rooms.js`): a library and a ballroom to decorate, in the dressing room's
  Rooms tab. Each has four places (the wallpaper, a big piece, a rug or dance floor, a small piece),
  each with a free piece to start, two to buy (20 to 75 coins) and a present from the story. The
  first tap says the price and a second buys, as in the Boutique; she can move any piece she has
  back in. Pieces to buy can come as a surprise present too.
- **Her rank**: Little Princess, Princess (20), Royal Princess (32), Princess of Sparkle Kingdom (45):
  the first seven skills' highest levels added up (7 to 55; Pattern Parade and the bakery don't count), never going back down. It shows in the castle, the
  end of the round that earns it, and Settings.
- **Coins and the castle**: 1 coin a right answer (first or second try), 3 for finishing a round,
  never taken away. In her castle she tries on what she has, and in the Royal Boutique the first
  tap says the price and a second buys. Surprise presents (about one round in four, and the quest),
  and the unicorn grows with her stickers (one each time she moves up a level).
- **Settings** (for grown-ups; the shared rows of `../home/settings.js`): press and hold Grown-ups, then Face ID (the family account), or, where
  there's none, a grown-up's times-table question. Each child's levels and how they moved this
  week, accuracy, words known and learning, words to **practice together** (missed on 2 or more
  days), play time (today, the week, 30 days, by land), her rank and chapters by land, starting levels (a player's report);
  the design, players, Favor reading, lands open, voice speed, sound effects, the play timer badge, natural voices, letter
  sounds, signing in.
- **Natural voices**: each friend speaks in a voice of their own (the storyteller Sulafat, Professor
  Hoot Charon, Pebble Puck, Gemma Leda, Bloom Vindemiatrix: Google Cloud Text-to-Speech's Chirp 3: HD
  voices), made by the family's server (`functions/sparkle/api` speak, with the `GOOGLE_TTS_KEY` secret: a GitHub repository secret, a Google Cloud API key limited to
  Text-to-Speech, that each release copies to Cloudflare like the others in `.github/workflows/news.yml`)
  for a phone signed in to the family account. Each sentence is made once: kept in Cloudflare's cache and
  on the phone that heard it (Cache Storage `sparkle-voice-v1`), and a chapter's pages are fetched when it
  opens. A letter's sound ("sss") goes with how to say it (IPA, `SOUNDS` in the route; read as text it
  came out as "s, s, s"), and a part that's only punctuation ('?', '...') is a pause, never read out.
  Signed out, without the key, offline, or switched off in Settings, the phone's own
  voice speaks instead. Google's first million characters a month are free; a family's play is a small
  part of that.
- **Letter sounds**: a phone's voice says letter names well and letter sounds poorly, so a grown-up
  records each sound once in Settings (`voice.js`); the game plays those, and otherwise
  the voice's best try.
- **Play time**: a badge shows this session's minutes. The game never stops play: the family is in
  charge of screen time. Time counts only while she's playing (a tap in the last minute); 5 minutes
  without a tap ends the session.

## Art

Everything is drawn in code as SVG (`art.js`, `world.js`): the princess in layers (hair, gown,
tiara, shoes, cape, necklace, wand, each player's skin, hair colour and style), the unicorn in five
growth stages with its mane, saddle and horn, the four friends, the kingdom, the backdrops, the
Boutique's 30 things, three castle rooms and their 44 pieces (`rooms.js`), and about 100 word pictures (`pictures.js`). Every word she reads is drawn in **school letters** (`letters.js`): ball and
stick print with the single-storey a and g taught in kindergarten, since the phone's font has the
other kind and aOS loads no web fonts.

## iPad

The layout follows the screen's size, not the device: on a big screen (700 by 600 points or more;
an iPhone, even sideways, is never that tall) everything is drawn bigger, and sideways a round puts
the question across the top, what to look at on the left and the answers on the right; Flower Match
and the wand take the whole stage, the kingdom fills the width, and the castle's room or princess
sits beside its shelf. An iPad in Split View gets whichever layout its half fits.

## Two designs

Vintage (the default) and Standard (Sea glass), in Settings > Design, dress the frame:
the player picker and Settings and its sheets. The kingdom and the game are the same storybook
art in both.

## Data

On the phone: `localStorage` `sparkle.v1` (`{ v, players, gone, settings, settingsAt }`),
`sparkle.device` (this phone's id), `sparkle.clips` (the recorded sounds). Signed in, a copy is kept
in the family account of the grown-up signed in on the phone (`functions/sparkle/api`: KV
`sparkle:<user id>` and `sparkle:clips:<user id>`), so players follow them to any family phone. It
syncs at the end of a round, when the game is put away and when a grown-up signs in; never once per
answer (the free plan's writes are scarce). Two phones' copies merge without losing anything: coins
and play time are kept per phone and added up, things bought and found are joined, each skill takes
the copy with more answers (`engine.js` merge; a stale save is answered 409 with the newer copy).
Her unicorn (`pet`: the needs, when they were last brought up to date, its pantry and toys) is the
copy cared for last; her bedroom (`bedroom`: the wallpaper, the floor, each thing and where it is)
comes with the newer copy of her.
A child is never asked to sign in.

## Tests

- `node sparkle/scripts/logic-test.mjs`: the ladder, the warm-up, review, a round's plan, coins,
  merging, the story's chapters and colour, and thousands of questions from every level, each well formed;
  every parade's answer follows its pattern, every bake can be made, and the stables' needs over time.
- `node sparkle/scripts/letters-test.mjs`: the school letters.
- `node sparkle/scripts/api-test.mjs`: the server route on an in-memory KV, and the natural voices
  against a stand-in for Google.
- `node sparkle/scripts/app-test.mjs [repo] [screenshots]`: the whole game in Chromium at iPhone
  size, in both designs, through to a second phone signed in to the same account.
- `node sparkle/scripts/make-icons.mjs`: draws the icons from `icon.svg` (Vintage) and
  `icon-glass.svg` (Sea glass).
