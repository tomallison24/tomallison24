# Home (`house/`)

Home Assistant as an AllisonOS app: plain HTML talking to Home Assistant
directly, instead of Lovelace and its community cards. It is called **Home**
on the screen; the folder is `house/` because `home/` is the AllisonOS
launcher, and its `localStorage` keys are `house.*` so the two never clash
when it is opened from the launcher. It starts with the
**dehumidifiers**, the Cube and Upstairs.

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

Each device is an entry in `UNITS` in `index.html`: its entity ids, plus its
sky and accent colours. The card reads everything else from the entities.

## Icons

`node house/scripts/make-icons.mjs` draws `icon-512.png` and `icon-180.png`:
DG1's frosted tank with the water line, on the Cube's sea-glass running to
the Upstairs unit's mist blue.
