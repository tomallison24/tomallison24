# Junction

A traffic game in aOS's Games (the Kids room on aOS Home, beside Sparkle Kingdom and School). You run the
lights at a crossroads through a whole day, earn coins for every car that gets through, and spend them on a
better road network. There is no losing: when it jams, traffic stops growing until the jams clear.

## How it plays

- **The roads.** Junction A is a crossroads where traffic keeps right. Every road has three lanes in (left
  only, ahead, right only) and three out. Until you buy turn lanes, the outer two are closed and every car
  shares the middle lane. A car enters a junction's box only when there's room on the far side.
- **The clock.** A day takes 16 real minutes (10 or 24 in Settings). Nights are quiet, then traffic builds
  from about 6:00 to the morning rush (7:00 to 9:30), eases to midday, and builds again to the evening rush
  (16:15 to 19:00) before a slow easing. The bar beside the clock shows the day's traffic, calm green to
  rush-hour red. Surges send a burst of traffic down one road for 25 seconds, in the busy hours.
- **Day and night.** The map is lit by the game's clock: an orange tint at dawn and dusk, then night with
  street lamps, headlights and tail lights. The map looks the same in every design; the designs dress the
  frame (the stats, the junction's panel, the start card and the sheets).
- **Coins.** Each car that leaves the map pays more the higher your level and the more of your junctions it
  passed through, and less the longer it waited (down to a fifth). A bus pays three times. A road that backs
  up off the map costs coins every second, and a driver who gives up costs one. Your level rises while
  traffic flows; it pauses while there are jams.
- **The lights.** Junctions start with stop signs (all-way: stop, then go in the order they came). Bought
  lights run on a timer by themselves (smart sensors make them follow the queues). Tap a phase on the
  junction's panel to take over; they go back to auto 20 seconds after your last tap (Settings: 10, 20, 40
  seconds or until you say), or at once with Back to auto.
- **Upgrades** (the Upgrades button; Undo in the toast for a junction's or the city's):

  | Junction | Coins |
  |---|---|
  | Traffic lights | 100 |
  | Turn arrows | 160 |
  | Smart sensors | 300 |
  | Right turn on red | 90 |
  | Turn lanes, N–S road / E–W road | 220 each |

  New junctions down the main road, in order: B 400, C 700, D 1,100, E 1,600 (each opens with timed
  lights, and asks first, as it can't be closed). City-wide: Traffic radio 500 (surges announced 20 seconds
  ahead, and smaller), Higher speed limit 650, Green wave 950 (auto lights hold green for groups of cars
  coming from the next junction), Congestion charge 1,300 (every car pays 25% more).
- **Vehicles**: saloons, hatchbacks, SUVs, pickups, vans, taxis, box trucks and buses, each drawn once per
  colour on a small canvas at 4× and stamped onto the map, with brake lights and indicators on top.
- **The map**: drag to move around once zoomed in, pinch or scroll to zoom, Show the whole map to go back.
  Tap a junction to choose it; tap the next junction for sale to open Upgrades. Keys: 1 to 4 the phases,
  A back to auto, J the next junction, U Upgrades, P pause, 0 the whole map.

## The data

All on this phone, in localStorage: `junction.save.v4` (coins, the clock and day, your junctions and their
upgrades, the city's upgrades), saved every 5 seconds and when the app is put away, and `junction.view`,
`junction.daylen` and `junction.hold` (Settings). Nothing goes to a server. Opened from its own Home Screen
icon once and then in aOS, the save moves into aOS (`welcome.js`, `CARRY`).

## The code

- `index.html`: the frame (the stats along the top, the junction's panel along the bottom, the start card,
  the Upgrades and Settings sheets, the toast), in Sea glass with the Vintage block after it; Pearl and Tron
  are made from Vintage by `aOS/scripts/make-looks.mjs`.
- `app.js`: the game. The junction's geometry (every movement's path through the box, and which paths cross
  or merge), the road network, the cars (following, the box rule, lane changes between junctions), the
  lights (timed, smart, manual, turn arrows, right turn on red), the economy, the drawing, and the frame's
  controls. Settings is `../home/settings.js` (Design, Game, Your data).

## Tests

`node junction/scripts/app-test.mjs` (CI, a browser group): the page at iPhone size in Vintage and Standard,
light and dark, with no script errors; Settings and Upgrades as sheets; buying with Undo; the lights taking
over and going back to auto; a long run of the game with every upgrade, where no car stays stuck and no two
crossing paths are in a box at once; the save and Continue.
