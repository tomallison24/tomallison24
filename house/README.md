# Home (`house/`)

Home Assistant as an AllisonOS app: plain HTML talking to Home Assistant
directly, instead of Lovelace and its community cards. It is called **Home**
on the screen; the folder is `house/` because `home/` was the AllisonOS
launcher (retired; it now holds the scripts every app shares), and its
`localStorage` keys are `house.*`. It has every device on the Signal
dashboard in six views, picked from a floating Liquid Glass pill at the
bottom of the screen, in reach of a thumb (the view's icon and name; the
menu opens upwards). The view's name is the title at the top. Behind it
all, the page is a quiet tone (dark, or pale in light mode) - Slate, a blue-grey as Google Home's,
by default - with something slow moving behind the glass, small faint
Bubbles by default (`bg.js`; both picked in **Settings → Customization →
Background** and kept on the phone). Every card is as clear as the energy
tiles: the faint tile over the background, a hairline edge, and its own
colour only as a light tint.

**Light and dark** follow the phone (Settings → Display & Brightness), and
switch live with it. Light mode is the same designs with the ink flipped:
dark text on a pale twin of the picked colour, frosted white glass instead of
smoked, the card and popup skies in their own hue but light, the moving
backgrounds as faint ink. Camera pictures keep their white labels. Most of
the light rules are generated from the dark ones by `tools/lightgen.py`
(between the `LIGHT-BEGIN`/`LIGHT-END` markers in `index.html` and
`devices.css`; re-run it after changing a colour); the rest are written by
hand just after the block in `index.html`.

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
- **The card** says as little as it can: its name with the room beside it
  ("Living Room › 70° inside"), the next schedule change, Power, and **the
  targets as the hero** (Labs' design B): each a big thin number - Heat
  amber, Cool blue, Auto's two joined by a dash - with a soft chevron above
  to raise it and below to lower it, its name under it, and "Idle · 52°
  outside" beneath. Taps add up into one call; Auto keeps 3° between Heat and
  Cool. Off and Fan only show the word. Power remembers the mode it was in.
  The popup has the rest (mode, fan, humidity, runtime).
- **Eco** (the Living Room and Office Nests) keeps its own view, as before
  design B: a moss-green sky with slow drifting motes and a green glow, and
  a ruler in green and fixed - the Eco range as a band with thin pins at its
  edges, **Eco low** and **Eco high** over them (one of them in Heat or Cool
  mode), the room a dot, and a line saying where the room is ("70° inside ·
  within Eco, resting", or heating / cooling to the edge). The Eco
  temperatures are set in the Nest app, so there is nothing to step; **Exit
  Eco** goes back to your own temperatures. Heating or cooling in Eco shows
  the ember or frost sky as usual.
- **The sky** is what the unit is doing: embers while heating, frost while
  cooling, airflow with the fan, graphite when off. Idle, each room has its
  own palette (Living Room a warm graphite, Office a cool slate, Windmill
  breeze; no pink or purple), a touch brighter as the sun climbs and darker
  after sunset (`sun.sun`). The HEAT / COOL / ECO labels are plain black or
  white (with light or dark mode); the colour stays on the power button and
  the sky.
- **The popup** (tap a card): what it is doing, the room / mode / humidity /
  outside (`weather.forecast_home`), the same targets (larger), Power,
  Mode, Fan, the Windmill's
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
  A green dot with a faint ring easing out from it every 2.4 s marks one that
  is working; a dehumidifier only holding (or with a full tank) has a still
  grey dot. Still with Reduce Motion.
- **Weather**: a full-width glass pill over the automations - the
  condition's icon (the night's after sunset), the temperature outside and
  the condition with today's high and low small and dim beneath it (the
  Weather app's own day, hidden when it isn't today's or when Home
  Assistant's reading stands in), with a glow of its colour - that opens the AllisonOS
  Weather app (`../weather/`). The reading is the Weather app's own, from its
  shared `../weather/data.js` (NWS corrected by the nearest station, or
  Open-Meteo), for home (`zone.home`), so the two agree. It is fetched when
  10 minutes old, checked every minute and on coming back to the app, and
  kept on the phone. Home Assistant's `weather.forecast_home` (Met.no, which
  HA fetches only about hourly) stands in until there is a reading, or when
  the reading is over 3 hours old.
- **Activity**: a pill under it, the same glass, with the latest event
  (what, what happened, how long ago) and a glow of its colour; it opens
  the last 10 from the house's activity log (`sensor.signal_activity_log`,
  the dashboard's own), newest first - each with its icon, the time, and
  **Auto** (an automation or script did it) or **You** (a tap).
- **Automations** (Liquid Glass tiles, three across: each carries a glow of
  its colour behind the glass - Goodnight indigo, Evening Lights amber, Mom's
  Awake gold, Report a Bug grey, Babysitter rose, Hatch Green green - and
  turns white glass when lit): Goodnight, Evening Lights, Mom's Awake,
  Report a Bug, Babysitter, Hatch Green. A routine's pill runs its script
  (`script.turn_on`, so it returns at once) and is lit while the script holds
  its acknowledgement helper on (3 s). Babysitter is a mode: lit, "Sitter
  armed", while it is on. Hatch Green is the bedtime script with the green
  light, lit while it runs. Report a Bug fills the dashboard's form helpers
  and runs `script.log_bug`, which adds it to `bug_log.md`.
- **Thermostats** (Living Room and Office; the Windmill is left out, as on
  the dashboard), **Cameras** (the living room Blink and the doorbell),
  **Lights** (All on / All off, Tom's and Elena's lamps, each with its slider
  and the 1 / 25 / 50 / 75 / 100% presets right on the pill).

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
  card as every AllisonOS app) with one warm amber glowing behind it
  (255,196,128, the same for every light); rooms as drawers - closed when
  the app opens and again whenever you leave Lights, sliding open with
  their lights coming in one after another - and a disc that
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
  often, and in every camera's popup. While a pause runs, the minutes left
  show discreetly, in white, beside "Pause motion detection" (and the length picked is
  lit); another length restarts it. The pause script only says it is
  running, so the minutes are kept on the phone that started it - a pause
  started elsewhere (the dashboard, another phone) just shows "Paused".
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

Each view with estimated devices starts with a round Liquid Glass pill (the
bolt in a gold disc): their power **now**,
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

**Labs** is a view for trying ideas live before they replace anything; it
is left out of the drop-down while it has none - as now. From here so far:
the thermostat cards (design B of the second round, after G of the first),
the automation tiles (design D of four) and the backgrounds.

The backgrounds that were tried here moved to **Settings → Customization →
Background** (`bg.js`): a popup with **Colour** - **Temperature** (the
default: Google Home's grey at 72.5°F outside, eased toward a very faint
blue at 60°F and a faint red at 85°F, held beyond them; the weather pill's
reading, rechecked every 30 s and on every update), or a fixed Slate, Navy,
Sage, Dusk, Sand, Graphite, Black -
and **Movement** - Bubbles (the default: nine small, very faint glass
bubbles drifting and bouncing off the edges), Constellation, Ripples,
Aurora, Beach, None. Each colour has a pale twin for light mode. Kept on the phone; drawn on one canvas at ~30 fps,
paused while the app is hidden, still with reduced motion.

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
  For the family it fills itself in: the owner saves it once in aOS (Your
  account → **Home Assistant address**), and Home, signed in to the family
  account (`../home/account.js`), puts it in the box while the box is empty.
  Signed out, **Use your family's address** asks for Face ID first.
- **Token**: in the Home Assistant app, **☰** → your name (bottom of the
  menu) → **Security** (bottom bar) → **Long-lived access tokens** → **Create
  token**, named **AllisonOS <your name>**, then **Copy** (it's shown only
  once). The token can do anything your user can, so it is worth making one
  just for this app, which you can delete there at any time to cut it off.

**Shown, not just told** (`haguide.js`): while no token is saved, the top of
the sheet plays those steps on a small iPhone running the Home Assistant app
(drawn after its 2026.9 screens, dark; a likeness, with a made-up token),
with a finger and a numbered caption, named after the signed-in person. With
a token saved it's behind **Show me how**. The first time Home opens from the
Home Screen with nothing saved, the sheet opens by itself once its
walkthrough has finished (once only: `house.guided`).

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

### Sharing with another device

Locked sheet → **Share with another device** (asks for the PIN). The token
itself never leaves the phone:

1. Home Assistant makes a **new long-lived token just for this share**
   (`Home share <time>`, good for one day at most).
2. The app shows a random **10-character code** (letters and digits) with a 5-minute countdown, and
   makes a link (`…/house/#join=…`) holding the address, that token and the
   time it runs out, encrypted with the code (AES-GCM, key by PBKDF2-SHA-256,
   310,000 rounds). **Send link** opens the share sheet; **Copy link** copies
   it. Tell the person the code separately (not in the same message).
3. On the other device, opening the link (or pasting it into **Address**)
   shows **Join Home**: the code and a name for the device. It connects with
   the share token, makes **its own** long-lived token
   (`Home · <name> (<date>)`, ten years), deletes the share token, and asks
   for its own settings PIN. On a device already connected, joining needs
   that device's PIN.
4. **The 5 minutes are enforced by Home Assistant**, not only by the app: at
   0:00 the sharing phone deletes the share token if it is still there.
   If the app was closed before then, any device signed in as you deletes
   share tokens over 5 minutes old when it next connects, and Home
   Assistant itself ends them after a day. Joining also refuses a link over
   5 minutes old.

Every joined device **connects as you**, with everything you can do in Home
Assistant. Remove one in Home Assistant: your profile → Security →
Long-lived access tokens → its `Home · …` token. On an iPhone, Safari and a
Home Screen app keep separate storage, so add Home to the Home Screen first,
then paste the link into Address there (the Join screen says so in Safari).
The link points at the copy of the site it was made on (GitHub Pages or the
Cloudflare one).

### Devices with access, and alerts

Locked sheet → **Devices with access** (asks for the PIN) lists everything
that can get into Home Assistant as you (`auth/refresh_tokens`), newest
first: devices that joined by a share link (`Home · <name>`), share links
still in flight, other long-lived tokens, and sign-ins from the Home
Assistant app or a browser. **Remove** (two taps) deletes one and it stops
working at once; this device's own is marked and left to Disconnect.

Alerts come from Home Assistant, not the app (ha-config: `access_watch.py`,
`sensor.home_access`, automation `security_new_access`). Once a minute HA
reads its own login store (`.storage/auth`) - names, ids, kinds and times,
never the token values - and pushes to Tom's and Elena's iPhones and the
Pixel Tablet whenever a new one appears. Because it reads HA's store rather
than anything the app reports, it also catches a token used by hand by
someone who got a link and its code.

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
- **The site is the Cloudflare one** (`tomallison24-news.pages.dev`), behind
  Cloudflare Access. The old GitHub Pages copy is retired: it only sends people
  on, and forgets what AllisonOS kept there (`.github/pages-moved.html`).

On iPhone, the app on the Home Screen keeps its own storage, apart from Safari,
so the token entered in Safari isn't there: enter it (or use a share code) once
in the installed app.

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

The dehumidifiers are `UNITS` and the thermostats `THERMOS` in `app.js`.
Every other family is its own file - `heaters.js`, `dysons.js`, `lights.js`,
`media.js`, `security.js`, `around.js`, `favorites.js` - with its devices in
a list at the top (entity ids, colours). `devices.js` has what they share:
`family()` adds a section to one of the six views, and the cards, popup,
sample states and preview are the family's own.

## Icons

`node house/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`
from `icon.svg`: a white house with its window cut out, on sand (one of the
Sea glass tints), in the style of the other AllisonOS icons.

## Tests

`node house/scripts/app-test.mjs` (CI runs it, `apps-check.yml`) opens Home in
its preview at iPhone size, light and dark: it opens on Favorites, the lamps'
night moon (1%) and sun (100%) chips work, every view in the drop-down opens
with something in it, and nothing errors or trips the page's policy.
