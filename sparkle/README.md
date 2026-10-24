# Sparkle Kingdom

A princess and unicorn learning game for a 5-year-old, and her brothers and sisters (a player each),
in aOS's Games group. The kingdom has lost its colours to a gentle Grey Fog; she rides her unicorn
across floating islands to bring them back, and every coin she earns is earned by learning. Reading
comes first. The design is in the spec, "Sparkle Kingdom: Game Spec" (a Claude doc the owner has).

- **Who's playing**: a portrait for each child (her princess), so nobody needs to read to pick.
  The first player is made right there; more are added by a grown-up.
- **The kingdom** (`world.js`): one big scrolling picture. She taps where to go and her unicorn
  walks the paths. The paths themselves are practice, at her level:
  - a **signpost** to read on the way to Story Tower,
  - the **rainbow bridge** to mend by counting planks, on the way to the Gem Mine,
  - the **crystal door** that opens to a sparkle pattern, on the way to Star Meadow.
  A gate asks once a session. Hidden stars (2 coins each) and four critters for her treasure book are
  about the islands; the Fairy Garden and the Tiara Workshop are under the fog (a later chapter).
  **Today's quest** is three stops, always starting at Story Tower; finishing it gives a present.
- **A round** (6 to 8 questions) in a land: Story Tower (reading, Professor Hoot), the Gem Mine
  (math, Pebble the dragon), Star Meadow (memory, Bloom the fairy). Every question is spoken, and
  shown in the school letters as it's said; tapping the host says it again. No timers, lives or
  game over: a first miss gets a hint, a second shows the answer kindly.
- **Getting harder by itself** (`engine.js`): each skill is a ladder (reading 12 levels, math 10,
  memory 7). 4 right in a row or 9 of her last 10 moves her up; 2 misses in a row on new items or
  6 or fewer of 10 moves her down (a right answer after a hint counts half). The first visit to a
  skill is a 6-question warm-up that finds her level. Words, letter sounds, sight words and math
  facts she misses (or just learned) come back 1, 3 and 7 days later; after 3 different days right
  they're known. The thresholds are `TUNE` in engine.js.
- **The questions** (`content.js`): reading follows IXL's kindergarten Learn to Read plan, which
  her school uses (syllables, rhymes, first sounds, onset and rime, letter sounds, blending, middle
  and last sounds, short words, sight words once she can sound words out, sentences, little
  stories, digraphs and blends); math follows the kindergarten standards and goes past them
  (tens, within 20, missing numbers); memory is the wand's sparkle sequence, 3 up to 9, backwards
  on one level. Pictures are the phone's emoji, only for words nobody would name differently.
- **Coins and the castle**: 1 coin a right answer (first or second try), 3 for finishing a round,
  never taken away. In her castle she tries on what she has, and in the Royal Boutique the first
  tap says the price and a second buys. Surprise presents (about one round in four, and the quest),
  and the unicorn grows with her stickers (one each time she moves up a level).
- **The Parent corner**: press and hold Grown-ups, then Face ID (the family account), or, where
  there's none, a grown-up's times-table question. Each child's levels and how they moved this
  week, accuracy, words known and learning, words to **practice together** (missed on 2 or more
  days), play time (today, the week, 30 days, by land), starting levels; Favor reading, lands open,
  voice speed, sound effects, the play timer badge, the design, signing in.
- **Letter sounds**: a phone's voice says letter names well and letter sounds poorly, so a grown-up
  records each sound once in the Parent corner (`voice.js`); the game plays those, and otherwise
  the voice's best try.
- **Play time**: a badge shows this session's minutes. The game never stops play: the family is in
  charge of screen time. Time counts only while she's playing (a tap in the last minute); 5 minutes
  without a tap ends the session.

## Art

Everything is drawn in code as SVG (`art.js`, `world.js`): the princess in layers (hair, gown,
tiara, shoes, cape, necklace, wand, each player's skin, hair colour and style), the unicorn in five
growth stages with its mane, saddle and horn, the four friends, the kingdom, the backdrops, the
Boutique's 28 things. Every word she reads is drawn in **school letters** (`letters.js`): ball and
stick print with the single-storey a and g taught in kindergarten, since the phone's font has the
other kind and aOS loads no web fonts.

## Two designs

Vintage (the default) and Standard (Sea glass), in the Parent corner > Design, dress the frame:
the player picker and the Parent corner's sheets. The kingdom and the game are the same storybook
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
A child is never asked to sign in.

## Tests

- `node sparkle/scripts/logic-test.mjs`: the ladder, the warm-up, review, a round's plan, coins,
  merging, and thousands of questions from every level, each well formed.
- `node sparkle/scripts/letters-test.mjs`: the school letters.
- `node sparkle/scripts/api-test.mjs`: the server route on an in-memory KV.
- `node sparkle/scripts/app-test.mjs [repo] [screenshots]`: the whole game in Chromium at iPhone
  size, in both designs, through to a second phone signed in to the same account.
- `node sparkle/scripts/make-icons.mjs`: draws the icons from `icon.svg` (Vintage) and
  `icon-glass.svg` (Sea glass).
