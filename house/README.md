# Home (`house/`)

Home Assistant as an AllisonOS app: plain HTML talking to Home Assistant
directly, instead of Lovelace and its community cards. It is called **Home**
on the screen; the folder is `house/` because `home/` is the AllisonOS
launcher, and its `localStorage` keys are `house.*` so the two never clash
when it is opened from the launcher. It has every device on the Signal
dashboard in six views, picked from the drop-down under the title:

- **Favorites** (where it opens): what is on the dashboard's Favorites
- **Climate**: Thermostats, Heaters, Air Purifiers (the Dysons), Dehumidifiers
- **Lights**: every light, by room
- **Media**: Speakers (the Sonos, the Move, the Nest Mini) and TV
- **Security**: the Blink system and cameras, the Nest doorbell
- **Around the house**: Vacuums, Blinds, Nursery (Olivia's Hatch), Printer, Energy

A view with several kinds of device has a small heading over each, with
what that part is doing. Each view says in the drop-down what is running or needs you ("4 running",
"3 playing · TV on", "Toner low"). Every family works the same way: a compact card with
the controls used every day, everything else in its popup (tap the card),
taps shown at once and held until Home Assistant confirms them, and sample
readings in the preview.

The look is the Signal dashboard's DG1 dehumidifier card (ha-config,
`views_signal/all_devices.yaml`, the `dg_*` block): the frosted glass tank
over a water fill at the room humidity, the per-unit skies (Cube sea-glass,
Upstairs mist blue, rose when the tank is full), mist and motes while drying.
Same entities, same colours.

- **The cards** are compact, so both units fit on one screen: the tank, what
  the unit is doing ("Drying to 50%", fan, mode, temperature) and the two
  controls used every day on one row, **Power** and **Target** (35 to 85 in
  5s, as the units' panels do). Target taps add up: tap + three times and
  one `set_humidity` goes 0.6 s after the last tap.
- **Only what needs you shows on a card**: "Empty the tank" and "Replace
  filter" appear when they are true and not otherwise.
- **Everything else is in the unit's popup**: tap a card (or its name). A
  sheet in that unit's own sky, with the big tank, Target, a Power switch,
  **Fan** and **Mode** as sliding glass switches (`home/slide.js`, as in the
  other apps; only the modes the unit lists in `available_modes`),
  **Readings** (temperature, water tank, filter), **Features** (Ion, Pump,
  Beep as switches; Ion and Pump only while available, so the Cube shows Beep
  alone) and **Energy** (the Tapo plug: now, today, this month). The Cube's
  plug still has its old `m_d_dyson_*` ids; it is the Cube's real draw. Close
  it with ✕, a tap above it, Escape, or a swipe down.
- **Live**: a tap blinks softly until Home Assistant reports the change, so
  you can see when the unit has actually done it. A change made anywhere else
  (the unit's panel, an automation) shows straight away, on the card and in
  an open popup. If Home Assistant turns a call down, a note says why.
- **Preview**: with no Home Assistant set up, the app runs on sample readings
  and the controls change those, so the design can be tried first.

## Thermostats

The three thermostats are the Signal dashboard's TF1 "Frost" card (ha-config,
`views_signal/signal_templates.yaml`, `tf_card`) in this app's layout, with
the same rules:

- **Living Room** (`climate.living_room_living_room`) and **Office**
  (`climate.office_office`), both Nests: Heat / Cool / Auto / Off. In Auto,
  Heat and Cool each have a stepper, are kept 3° apart, and are always sent
  together (the Nest needs both). Fan is a switch (on / auto).
- **Nest Eco** is a preset, not a mode: the mode stays Heat / Cool / Auto and
  Home Assistant reports the Eco temperatures (set in the Nest app) as the
  targets. The card says "Eco · 62–82°" (or "Heating to 62°" while it heats)
  and swaps the steppers for the Eco temperatures and **Exit Eco** - a single
  target can't be changed in Eco (Home Assistant only takes a Heat + Cool
  pair then, and quietly ignores one on its own). The popup has an **Eco**
  switch to turn it back on. Only shown on a Nest that lists `eco` in its
  `preset_modes`; the Windmill's Eco is its own mode, above.
- **Windmill AC** (`climate.windmill_ac`): Cool / Eco / Fan / Off - its Eco
  is Home Assistant's `auto`. It never says what it's doing, so in Cool or
  Eco with the room above the target it counts as cooling. Fan is Auto / Low /
  Medium / High. **Follow the Office** switches the sync automation
  (`automation.hvac_sync_window_ac_with_main_thermostat` - the id says
  window/main, the registry's, not a typo): it keeps the AC 3° under the
  Office (2° at 80° and up) and turns it off with the Office.
- **The card** says as little as it can: the orb with the room temperature
  (the 50–90° arc on its edge, the target(s) as beads), one word for what it
  is doing (Heating, Cooling, Idle, Eco, Off), the temperature outside, the
  next schedule change, then Power and the target. Power remembers the mode
  it was in. The popup has the rest (mode, fan, humidity, runtime).
- **The sky** is what the unit is doing: embers while heating, frost while
  cooling, airflow with the fan, graphite when off. Idle, each room has its
  own palette (Living Room lounge, Office focus, Windmill breeze), a touch
  brighter as the sun climbs and darker after sunset (`sun.sun`). The orb
  pulses red or blue while it heats or cools.
- **The popup** (tap a card): the big orb with Outside
  (`weather.forecast_home`), the target, Power, Mode, Fan, the Windmill's
  sync, and Readings (humidity or the compressor, running today from
  `sensor.*_ac_runtime_today`, outside).
- **Taps show at once and stay** until the unit reports them, or 20 s - the
  Windmill goes through a slow cloud and would otherwise flick back. Target
  taps add up into one call 0.6 s after the last. A change the unit turns
  down lets go at once, with a note saying why.

## Favorites

The dashboard's landing view (`views_signal/favorites.yaml`), in its order:

- **Now Playing**: a Sonos that is playing, one card per group.
- **Running Now**: every device that is doing something (heating, cooling,
  a fan, drying, cleaning), as chips; tap one to go to it with its popup open.
- **Automations** (AG1 "Frosted"): Goodnight, Evening Lights, Mom's Awake,
  Report a Bug, Babysitter, Hatch Green. A routine's pill runs its script
  (`script.turn_on`, so it returns at once) and is lit while the script holds
  its acknowledgement helper on (3 s). Babysitter is a mode: lit, "Sitter
  armed", while it is on. Hatch Green is the bedtime script with the green
  light, lit while it runs. Report a Bug fills the dashboard's form helpers
  and runs `script.log_bug`, which adds it to `bug_log.md`.
- **Thermostats** (Living Room and Office; the Windmill is left out, as on
  the dashboard), **Cameras** (the living room Blink and the doorbell),
  **Lights** (All on / All off, Tom's and Elena's lamps).

These are the same cards as in their own views and change together.
Weather, Activity, Updates and the changelog, also on the dashboard's
Favorites, are not devices and are not here.

## The other families

Each is the Signal dashboard's own card for it (ha-config, `views_signal/`),
with the same entities, colours and rules, in this app's layout. Where the
dashboard's comments record a quirk, the app keeps it:

- **Heaters** (HT1 "Ember", `climate.yaml`): seven glass fins behind the
  target. They have no thermometer, so the target is the hero; heating means
  drawing over 20 W. Power, target (50-86), Level Low / High, Child lock,
  Backlight, today's power, hours and kWh.
- **Air Purifiers** (DY1 rotor, `climate.yaml`): ten blades lit to the speed
  (1-10), turning faster with it, the room temperature in the hub. Speed,
  Mode Off / Cool / Heat and the heat target, Auto / Manual, Airflow (Focus /
  Diffuse on the girls' units, Front / Back on M&D), Swing, Night, Sensing, air
  sensitivity, air quality (the worst sensor's band), filter (reset takes two
  taps), running and heating today.
- **Lights** (LP1 "Halo", `lights.yaml`): each light a faint pane (the same
  card as every AllisonOS app) with its colour glowing behind it; rooms you can fold, a disc that
  turns a whole room off (or on), All on / All off (the dashboard's list:
  not outdoors, the garage or the heaters' backlights). Each light: its
  colour mixed with warm grey, a halo by brightness, a slider; its popup has
  1 / 25 / 50 / 75 / 100 and the lamps in its group. The TV strip has the
  dashboard's swatches and Custom.
- **Speakers and TV** (SN3, `media.yaml`): a glass record with the album art,
  turning while playing, the art tinting the sky. Play / pause, skip, volume
  on the card; seek, ±15 s, mute, volume presets, shuffle, repeat,
  crossfade, loudness, favourites (`sensor.sonos_favorites` ships disabled:
  empty until it is turned on), the sleep timer, tone, grouping, House party
  and Hand off (two taps) in the popup; the Arc's home theatre settings; the
  Apple TV's apps; the LG's power and sources. What each player can do is
  what it reports to Home Assistant.
- **Cameras** (`security.yaml`): Arm / Disarm (one tap, as on the dashboard),
  the indoor motion alert (tap to silence), the Blink cameras' latest
  stills with ACTIVE / STANDBY / OFF, how old each still is, Snapshot (Blink
  sends stills, not video; a new one takes ~8 s), motion detection, and
  pausing it for 30 min to 4 h - on the Yard's card itself, as it is used
  often, and in every camera's popup.
- **The doorbell's live view**: Home Assistant's own way - it asks what the
  camera offers, then WebRTC (with the data channel a Nest asks for) or HLS.
  Checked against Home Assistant 2026.7.4's camera code and a stand-in in
  the tests, **not yet against the real doorbell**: if it fails, the popup
  says what Home Assistant answered.
- **Vacuums** (SG2, `all_devices.yaml`): the battery arc, Start / Pause,
  Dock, Stop, Find, suction (deliberately crossed: the Shark's `eco` runs
  harder, so Eco sends `normal`), Normal / Matrix, the three room buttons
  (which room is which is not known). The Ecovacs is shown, but its
  integration is not signing in, so it is unavailable.
- **Blinds** (`all_devices.yaml`): taps set the blinds' target helpers, not
  the covers, as the dashboard does (the VELUX cloud is slow; automations
  move the blinds). Both, or each; Guest mode; the departure-mode warning.
- **Nursery** (HG1, `all_devices.yaml`): the Hatch's lamp under glass. Light,
  Sound (select_sound_mode; never media_play), volume in 5s, sounds,
  Bedtime, Morning (script.hatch_bedtime with the green light), brightness,
  colours, the clock, Toddler lock. The clock's Off is only sent while the
  clock is on: on this model it is a toggle. (The dashboard's own Off button
  does not check this.)
- **Printer**: status and the four toners (20% and under is low).
- **Energy**: the estimate tiles from every view and the two Tapo plugs.
  Only the plugs and heaters are metered; Total is lighting, climate, and
  fans & dehumidifiers, not the whole house.

Scripts that wait (Snapshot, the motion pause, Hand off) are started with
`script.turn_on`, so the app is not left waiting on them.

## Energy

Each view with estimated devices starts with a strip: their power **now**,
**today** and **this month** (with the month's cost at $0.13/kWh), from Home
Assistant's own totals - the house on Favorites, climate plus fans &
dehumidifiers on Climate, lighting on Lights, the TV on Media. Tap it for
each device's power now. Each device's popup has an **Energy** section.

- **Metered**: the two heaters (now, today) and the two dehumidifiers (now,
  today, month), from their own power sensors and plugs.
- **Estimated**, with Home Assistant's formulas: lights 10 W a bulb (12 W the
  TV strip) by brightness; the ACs while cooling (2,710 / 2,060 / 730 W;
  heating isn't counted, the Living Room's is gas); a Dyson 1,500 W while its
  element heats, 6 W while the fan runs (today from its heating and running
  hours); the TV 120 W on, 0.5 W off (today and month: it is the whole TV
  total).
- Nothing is shown for a device Home Assistant doesn't estimate: speakers,
  Apple TV, cameras, vacuums, the Hatch, the printer, outdoor lights.
- **Today per device**: Home Assistant keeps a daily meter for each estimated
  device (ha-config's `sensor.est_<device>_daily_energy`: the lights, ACs and
  Dysons; daily only), shown once that sensor exists - they count from Home
  Assistant's restart after that change. Month stays per category.
- The Windmill counts while it is inferred to be cooling, here and in Home
  Assistant's climate total (it never reports cooling itself).

## Thermostat schedules

Each thermostat shows where it is in its schedule, as Home Assistant's
scheduler card does. The schedules are the **Scheduler** integration's
(`custom_components/scheduler`), kept inside Home Assistant rather than in
ha-config, so the app finds each `switch.schedule_…` that lists the
thermostat in its `entities`.

- **The card** says the next change and what it sets ("10 PM → 64–78°"),
  from the schedule that changes next.
- **The popup** has a Schedule section: each schedule, the days it runs, every
  step with its time and what it sets, the step under way lit as **Now**, the
  next one with when it starts, and a switch to pause or resume the schedule.
- The step under way is Scheduler's `current_slot`; a schedule of start times
  only leaves that empty, so it is then the step before `next_slot`.
- A thermostat with no schedule says so (a schedule kept in the Nest app
  isn't visible to Home Assistant).

## Labs

The last view, **Labs**, is for trying ideas live before they replace
anything (`labs.js`). Each idea is wired to the real device.

Today: the **Living Room thermostat without the orb**, seven ways, all ultra
clean Liquid Glass (a frosted pane with the mood's light behind it: heating
amber, cooling blue, idle lavender, off grey):

- **A · Numeral**: the room as one thin number; the targets as glass capsules.
- **B · Track**: a glass tube from 50° to 90° with the comfort band, the room
  as a mark and the targets as beads; capsules below.
- **C · Control**: Control Center capsules filled to each target, the room
  as a hairline in from the left at its own height; tap the top half to
  raise it, the bottom half to lower it.
- **D · Drum**: picker wheels, the target in a glass lens; tap a number above
  or below to go to it.
- **E · Split**: two glass halves, warm and cool, the room at the seam; the
  half at work glows.
- **F · Ruler**: the camera's exposure dial; the ruler slides under a fixed
  lens; tap left or right of it.
- **G · Dual**: F with Heat and Cool on one ruler, a lens each and the
  comfort band between them, the room a dot; drag a lens along the ruler,
  or tap beside it to move it that way (between the two, the space is split
  at the middle). A drag sends one change when you let go.

They follow the card's rules (Auto sends Heat and Cool together, 3° apart;
taps add up; Power remembers the mode).

## Connecting to Home Assistant

The gear (top right) opens the Home Assistant sheet: an **address** and a
**long-lived access token**. Both are kept in `localStorage` on that phone
and go nowhere except to that address.

- **Address**: it has to be **https** and reachable from the phone, such as
  your **Nabu Casa** address (`https://….ui.nabu.casa`; in Home Assistant,
  Settings → Home Assistant Cloud, under Remote Access). A local
  `http://homeassistant.local:8123` address does not work: the app is served
  over https, and browsers block an https page from opening an http
  connection. A pasted dashboard link is fine; only its origin is kept.
- **Token**: in Home Assistant, your profile (bottom left) → **Security** →
  **Long-lived access tokens** → **Create token**. The token can do anything
  your user can, so it is worth making one just for this app, which you can
  delete there at any time to cut it off.

Once saved, the sheet opens **locked**: it shows the address and "Saved"
for the token, never the token itself, and nothing is put back in a text box.
When editing, leave the token box blank to keep the saved one.

### Settings PIN

**Change** and **Disconnect** need a 4-digit PIN, so the address and token
cannot be changed or wiped by accident. You choose it once the first
connection works (or the first time you change or disconnect, if you
connected before PINs existed). Five wrong tries in a row and the pad rests
for 30 s. **Forgot PIN?** (two taps) erases the address, token and PIN
together, so it cannot be used to get round the PIN; paste them again to
reconnect. The PIN is kept as a salted SHA-256, not as the digits.

The PIN guards against accidents, not against someone with your unlocked
phone and the know-how to read browser storage: it does not encrypt the
token, because the app needs the token to connect without asking each time.

### Security

- **Nothing secret is in this repository.** The address and token exist
  only in the phone's browser storage. Anyone copying the code gets an app
  that asks for *their* Home Assistant; the entity ids in it are names, not
  keys.
- **Camera stills and album art** load from your Home Assistant address with
  the short-lived token Home Assistant puts in each picture's address (it
  changes every few minutes); nothing else is loaded from anywhere.
- **The token can do anything your Home Assistant user can**, not only the
  devices here. If it might have leaked, delete it in your Home Assistant
  profile (Security → Long-lived access tokens) and it stops working at once.
- **Every app on the same site shares that storage**, so a bug in one
  AllisonOS app that ran someone else's script could read it. Keep that in
  mind when an app shows outside content.
- **Prefer the Cloudflare copy** of the site: it sits behind Cloudflare
  Access, so only signed-in people can load it at all. The GitHub Pages copy
  is public and shares `tomallison24.github.io` with any other Pages site on
  the account.

On iPhone, this app opened from the launcher and the same app installed on
its own keep separate storage (see `home/README.md`), so each needs the token once.

### How it talks to Home Assistant

One WebSocket to `<address>/api/websocket`, with the same messages Home
Assistant's own JavaScript client (home-assistant-js-websocket) uses:
`auth` with the token, `subscribe_entities` for the states and their
compressed changes, `call_service` for every control. WebSockets are not
subject to the browser's CORS rules, so nothing needs adding to
`configuration.yaml`. It pings every 30 s and on waking, and reconnects on
its own (1, 2, 5, 10, then every 30 s).

Signing in with your Home Assistant password (its OAuth flow) instead of a
token is possible later. It was left out of this first round because it makes
cross-origin `fetch` calls to `/auth/token` that may need CORS set up, and
because the redirect away and back is unreliable in an iPhone home-screen app.

## Adding devices

The dehumidifiers are `UNITS` and the thermostats `THERMOS` in `index.html`.
Every other family is its own file - `heaters.js`, `dysons.js`, `lights.js`,
`media.js`, `security.js`, `around.js`, `favorites.js` - with its devices in
a list at the top (entity ids, colours). `devices.js` has what they share:
`family()` adds a section to one of the six views, and the cards, popup,
sample states and preview are the family's own.

## Icons

`node house/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`:
a white house with one window lit warm, on a dusk sky (lavender to indigo),
in the style of the other AllisonOS icons.
