// aOS: AllisonOS's welcome, walkthroughs and update screens, shared by every app.
//
// Every app loads it from home/ (the retired launcher's folder, kept for the
// shared scripts) and says which app it is:
//   <script src="../home/welcome.js" data-app="weather" data-auto defer></script>
// With data-auto it decides by itself what (if anything) to show, from the
// release log below and what this install has seen (localStorage aos.seen,
// { app: the aOS version it last showed }).
//
// The flow: the aOS link opens in Safari -> how to add aOS -> opened from the
// Home Screen, the AllisonOS welcome and tour -> an app tapped in aOS opens in
// Safari -> how to add that app -> opened from the Home Screen, its walkthrough.
//
//   on iPhone, in Safari (display-mode is not standalone): for aOS and every
//     app alike, Safari's steps for adding it, animated; "Not now" until a new tab
//   aOS (data-app "aos"), from the Home Screen
//     first time      the AllisonOS welcome: the name, then the version mark
//                     (aOS with a superscript 1 that drops in and shines) and
//                     "The Power of aOS1", the apps bursting out of it, and the tour
//     major update    (aOS1 -> aOS2) the name and the new version mark, then
//                     that release's cards
//     minor update    nothing (the apps announce their own)
//   any other app (data-app "weather", "fitness", ...), from the Home Screen
//     first time      its walkthrough: its icon and name with aOS1 under it, then
//                     the live tour (SPOTS): the welcome clears to the app and a
//                     spotlight goes from control to control, then Light or dark.
//                     An app whose controls aren't on screen gets its cards instead.
//     minor update    (aOS1 -> aOS1.1) aOS with the new .1 rising in under its
//                     icon, then what's new in it; nothing, if nothing is
//     major update    (aOS1 -> aOS2) the new number rising in, then "Visit aOS"
//
// Without data-auto (welcome-lab.html) nothing plays until asked:
//   AllisonOS.welcome.play()                  the AllisonOS welcome
//   AllisonOS.welcome.playApp('weather')      an app's walkthrough
//   AllisonOS.welcome.playUpdate(app, from, to)
//   AllisonOS.welcome.playInstall(app)        how to add it, as in Safari
//   AllisonOS.welcome.data                    releases, tours, names (aOS reads it)
//
// The look is Quiet type (design C, picked in the Welcome Lab): pastel ink on a
// plain page, a hairline, one glass panel for the words. It follows light and
// dark, and the Appearance chosen in it (System / Light / Dark, kept as
// home.settings.theme and applied by every app that loads this). With Reduce
// Motion it is plain fades. Skip ends it at any point; all its styles are
// scoped to #aos-welcome. "aOS" is never set in capitals: its a stays lowercase.
//
// iPhone: an app on the Home Screen keeps its own storage, apart from Safari and
// the other apps, so "first time" and Light or dark count per install.
// Android: an installed app shares Chrome's storage, so installing it again
// (Chrome's appinstalled) forgets that its walkthrough was seen. In Chrome an app
// shows how to install it; its walkthrough waits until it's opened installed.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  const me = document.currentScript;
  const BASE = (me && me.src) || location.href;
  const APP = (me && me.dataset.app) || null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 250) : ms));
  const PACE = 1.25;                       // the aOS intro runs a touch slower than the app intros
  const slow = ms => wait(ms * PACE);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ===========================================================================
  // THE RELEASE LOG: aOS's versions, newest first. One number for everything.
  // Nothing here reaches anyone until the version is released (aOS/RELEASING.md):
  // the site only publishes released versions.
  //   v           '1.1' (minor) or '2' (major)
  //   highlights  the most important changes: these are what the update screens show
  //   notes       everything else, for the full log in aOS ("What's new in aOS")
  //   apps        { weather: { highlights: [...], notes: [...] } } - what changed in
  //               each app; a plain list is all notes
  //   cards       (major only) aOS's own setup cards after the new mark
  //   added       ['clock', ...] the apps this version brings to aOS: Today in aOS leads
  //               with them for 30 days after its date, until a newer version comes
  //   intro       'ipsy': while the release is fresh, aOS's Today leads with Meet Ipsy (aOS/app.js)
  //   silent      true: logged here only, shown nowhere - not in aOS's What's new;
  //               the apps keep showing the last version that wasn't silent, and
  //               no update screen plays for it
  // What shows where:
  //   major (aOS2)   aOS: the name, the new mark, then its cards (or highlights).
  //                  Every app: the new number rising in, the release's highlights
  //                  and "Open aOS" for the rest.
  //   minor (aOS1.1) aOS: nothing. An app the release mentions: the new .1 rising in,
  //                  that app's highlights (or its first notes) and a link to the full
  //                  log in aOS. An app it doesn't mention: nothing.
  // ===========================================================================
  const RELEASES = [
    { v: '2', date: '2026-10-22', title: 'Every app, one home', look: 'vintage',
      highlights: ['Every app now opens inside aOS', 'Ask Ipsy across all your apps', 'aOS in your design, Vintage or Sea glass'],
      notes: ['aOS: Home is where it opens (in place of Apps): Ipsy at the top, your Favorites, then every app in four groups (Family, Every day, Out and about, You). A row\'s i opens the app\'s page, with What\'s New, Open and Get',
        'No dock: four everyday apps float at the bottom of aOS for a quick open, always the same ones: Mail, Home, Calendar and Fitness (with Home, on Today and Search); Today and Search sit beside your account on Home',
        'The apps at the bottom of aOS stay at the bottom as you scroll (on iOS 26 they could drift up to the middle of the screen), with more room around each icon',
        'Mail\'s unread count shows on Mail\'s icon at the bottom of aOS, not on aOS\'s own Home Screen icon (Mail, Settings > Unread count on the app icon)',
        'Ipsy\'s chat on Home opens below Ask Ipsy, with fewer words in it. Under your account, Owner tools (notifications, the Home Assistant address, invites) fold away until tapped',
        'The top of every Vintage page fades into the status bar, rather than stopping in a band under it',
        'Moving to another aOS icon (one you added before, a new one to rename it, or a new phone): Get ready to move, under your account, leaves everything aOS keeps for two days in your family account; the next aOS icon of yours to open, signed in, takes it all',
        'Every app opens inside aOS: it slides in over Home and fills the screen, its own design and background up to the top, with ‹ aOS in its corner. Tap ‹ aOS, or swipe in from the left edge, to go back; hold it to jump to another open app. Up to four stay open, each where you left it',
        'Favorites, mixed: pin up to four (Edit, then the stars); the rest fill in with the apps you open most, over the last two weeks, on this phone',
        'Ipsy on aOS\'s Home works across Calendar, Notes, Meals, Orders, Travel and News at once, with each app\'s own tools, rules and Undo, on Claude Sonnet 5.5. Fitness stays out: aOS\'s Ipsy can search the web, and your health data never goes near a web search (ask Ipsy in Fitness)',
        'Inside aOS every app shares one sign-in: Face ID once, for all of them. One Gmail sign-in in Mail covers Travel and Orders too; Google\'s sign-in page opens over aOS and brings you back',
        'Moving in: open each app from its old icon once more, and what it kept only on your phone (Clock\'s alarms, Weather\'s cities, Home\'s Home Assistant sign-in, settings) moves into aOS, in whichever order you open them; not signed in there, Move my data with Face ID does it. What came from the old icon wins over what aOS had for the app. It waits in your family account two weeks at most, and is deleted once aOS has it',
        'The old app icons still work, and say the app lives in aOS now; remove them when you\'re ready (press and hold, Remove App). Get on an app\'s page in aOS still adds one',
        'aOS\'s update screens and welcome are mid-century now: cream, mustard, teal and orange',
        'Orders: returns. Return and refund emails (Amazon\'s and other stores\') are read into the order: a Returns tab with what to send back (and by when, and where), what\'s on its way back and what\'s been refunded; a return due within the week leads On the way. An order\'s page shows the return\'s steps, the drop-off day and place, the reason and the refund, with Mark as sent back and Mark as refunded; Start a return on any delivered order. Ipsy can find, start and update returns too',
        'Orders: Hidden, for gifts: an order\'s page has a Hidden switch that takes it off every list, search and count, and away from Ipsy; Settings > Show hidden orders brings them back after Face ID, until you leave Orders',
        'Home: Automations has a switch on each one, to turn it on or off (on its row, and in its popup); one that is off says so under its name',
        'Every app: a popup\'s way out (Back, Close, or Done) floats at the bottom left too, within reach of your thumb',
        'Travel: Have Ipsy check this trip, on a trip\'s page: Ipsy reads the newest email for each booking still to come (a schedule change too) and updates what changed, or marks it cancelled; each change is marked Check, with Undo. Bookings you edited stay as you typed them'],
      cards: [
        { i: 'house', t: 'The new aOS', d: 'Every app now opens inside aOS. Tap one on Home; ‹ aOS, or a swipe from the left edge, brings you back, and it stays where you left it.' },
        { i: 'sparkle', t: 'Ask Ipsy, across your apps', d: 'Ipsy sits at the top of Home and works across Calendar, Notes, Meals, Orders, Travel and News at once.' },
        { i: 'star', t: 'Favorites that learn', d: 'Pin up to four. The rest fill in with the apps you use most.' },
        { i: 'swipe', t: 'Moving in', d: 'Open each app from its old icon once more: what it kept on your phone moves into aOS. Then you can remove the old icons.' },
        { i: 'sliders', t: 'Your design', d: 'Vintage or Sea glass, for aOS in Account, and for each app in its own Settings.' },
        { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep aOS always light or always dark.' },
      ],
      apps: {
        orders: { notes: ['Orders: returns. Return and refund emails (Amazon\'s and other stores\') are read into the order: a Returns tab with what to send back (and by when, and where), what\'s on its way back and what\'s been refunded; a return due within the week leads On the way. An order\'s page shows the return\'s steps, the drop-off day and place, the reason and the refund, with Mark as sent back and Mark as refunded; Start a return on any delivered order. Ipsy can find, start and update returns too', 'Orders: Hidden, for gifts: an order\'s page has a Hidden switch that takes it off every list, search and count, and away from Ipsy; Settings > Show hidden orders brings them back after Face ID, until you leave Orders'] },
        mail: { notes: ['Inside aOS, Connect Gmail opens Google\'s sign-in over aOS and comes straight back; Travel and Orders use the same sign-in',
          'Inside aOS, the unread count goes on Mail\'s icon at the bottom of aOS rather than on aOS\'s Home Screen icon'] },
        travel: { notes: ['Have Ipsy check this trip, on a trip\'s page: Ipsy reads the newest email for each booking still to come (a schedule change too) and updates what changed, or marks it cancelled; each change is marked Check, with Undo. Bookings you edited stay as you typed them'] },
        house: { notes: ['Automations has a switch on each one, to turn it on or off (on its row, and in its popup); one that is off says so under its name'] },
      } },
    { v: '1.8', date: '2026-10-21', title: 'Health, with Ipsy',
      highlights: ['Fitness: your Apple Health stats, every day',
        'Activity, heart, sleep and vitals, from your own iPhone',
        'Ask Ipsy how your sleep, workouts and meds line up'],
      notes: ['Fitness: a Health page (the view picker: Week, Analysis, Meds, Health) shows each day\'s Activity (Health steps, active and resting energy, distance, exercise time, flights), Heart (heart rate, resting heart rate, heart rate variability, walking heart rate), Sleep (sleep, in bed, awake, core, deep, REM) and Vitals (blood oxygen, respiratory rate, body and basal temperature, blood pressure, glucose, VO2 max). It reads the Apple Health sensors of the Home Assistant app on your own iPhone (turn them on in the Home Assistant app, and give it Health access), through the iPhone you linked for steps; each person sees only their own',
        'Fitness: daily steps come from Apple Health when your iPhone shares them (they include your Apple Watch); the phone\'s own count stays the fallback, and steps you type in still win',
        'Fitness: each day\'s health stats are kept in the family\'s Fitness Sheet (a Health tab), so they last beyond Home Assistant\'s 10 days; Analysis has a Health section',
        'Fitness: Ipsy, off until you turn it on in Settings, finds patterns across your workouts, steps, meds and health: it quotes the numbers and how many days they rest on, never claims a cause, and gives no medical advice. It only reads; it can\'t change your log. Only the days and stats a question needs go to Claude, through aOS, and Anthropic doesn\'t train on them; Ipsy doesn\'t search the web in Fitness',
        'Every app: the explanations under settings are gone, and each switch says what it does in one short line',
        'Fitness: Health fetches fresh readings each time you open it',
        'Fitness: Health at a glance: a tile each for Activity (Move and Exercise rings), Heart, Sleep (a Sleep score of Fitness\'s own, not Apple\'s) and Vitals, with a dot for Good, Check or Off against healthy ranges (CDC, AHA, FDA) or your own usual. Tap a tile for its charts over 7, 30 or 90 days, sleep stages and trends. A Move goal in Settings > Steps',
        'Fitness: vitals alerts: if even one of your vitals is off (outside the healthy range or your usual, as the Vitals tile counts them), aOS notifies you, once a day at most; tap it to open Health on that day. The notification says only "A vital is off your usual". Turn it off in Fitness Settings > Health; it needs aOS notifications on'],
      apps: {
        fitness: { highlights: ['Health: activity, heart, sleep and vitals from your iPhone', 'Steps from Apple Health, Apple Watch included', 'Turn on Ipsy in Settings to find patterns'],
          tour: [
            { sel: '#viewBtn', t: 'Health', d: 'Pick Health here: activity, heart, sleep and vitals at a glance, from your own iPhone. Tap one for its charts. Only you see yours.', g: 'tap' },
            { sel: '#setBtn', t: 'Ipsy', d: 'Turn on Ipsy in Settings, then ask how your sleep, workouts and meds line up. It only reads, and never searches the web here.', g: 'tap' },
          ] },
      } },
    { v: '1.7.1', date: '2026-10-20', title: 'One Sheet for the family',
      highlights: ['Each app\'s Google Sheet is now its record, one for the whole family',
        'In Fitness, Drinks, Podcasts and Orders you only ever see your own',
        'Mark a note or a trip Just me, and only you see it'],
      notes: ['Fitness, Drinks, Podcasts, Orders, Notes (with Places), Travel and Meals each keep their records in one Google Sheet for the whole family: what you change in the app goes to the Sheet, the Sheet is what the app reads back, and every row says whose it is (a Who column in the readable tabs). Edits made in the Sheet itself are overwritten',
        'Fitness, Drinks, Podcasts and Orders are personal: each person only ever gets their own rows, on any phone they sign in on. Notes, Places, Travel and Meals are shared by the family, except a note, booking or trip marked Just me',
        'No phone keeps a Sheet\'s link or secret phrase any more: every sync goes through aOS, signed in with Face ID, and aOS tells the Sheet who is asking. A lost phone, or another family member, can\'t ask for anyone else\'s rows',
        'Each phone keeps everything undated, and the last 90 days of anything dated (workouts, doses, steps, drinks, plays, orders, plans); older days come back from the Sheet when you look back. Fitness kept 30 days before',
        'The owner sets up each app\'s Sheet once, in aOS: Account > Google Sheets (paste the app\'s new script into its Sheet, deploy a new version, then give aOS the phrase). The owner\'s phone hands over the link and phrase it already had by itself. Nobody else has to do anything',
        'Each app syncs with its Sheet by itself, signed in: the apps\' own Google Sheet settings are gone, and aOS (Account > Google Sheets) is the one place a Sheet is set up',
        'Fitness: two people\'s steps on the same day are each kept as their own',
        'Drinks: your log is kept in the family\'s Google Sheet in place of the family account (it moves over at your first sync); going back past 90 days, or opening an older day from Calendar, fetches that week from the Sheet; Export and Delete all data take in what the Sheet has',
        'Podcasts: the Sheet is two-way now: what you follow, save, play and how far you got follow you to all your phones. Library > History keeps 90 days here, and Show older brings earlier plays back. Clear history clears them from the Sheet too',
        'Orders: Show older orders from the Sheet, at the end of Delivered and of a search, a year further back each time; Ipsy finds older orders in the Sheet too',
        'Orders: Ipsy keeps your orders up to date by itself: when a new email arrives about an order on its way, Ipsy reads it again and moves the order on, as it already did for To check, so there\'s no need to ask it order by order (Settings > Ipsy > Ipsy keeps orders up to date)',
        'Notes: Just me on a note, a reminder or a whole list: nobody else in the family gets it (Private still only hides a note from Ipsy). Finished reminders are kept on the phone for 90 days; Show completed before brings older ones back. Nudges for a Just me reminder only reach your own phones',
        'Places: on Notes\' Sheet, shared with the family, synced through aOS like the rest',
        'Travel: Just me on a booking, and on a trip; Show older trips from the Sheet brings back past trips',
        'Meals: every plan the family accepts is kept in the Sheet with who planned it; Past plans shows the ones the family server no longer keeps, and Older plans reads them back a year at a time',
        'Home: an Automations page (the view picker at the bottom) with every Home Assistant automation by name, in groups. Tap one to see whether it is on and when it last ran, the devices it works with their state now, what it does and when it runs',
        'News: story summaries and questions now use Claude Sonnet 5.5 (was Claude Opus 5.5): quicker and cheaper, still at low effort'],
      apps: {
        aos: { highlights: ['Each app\'s Google Sheet is now the family\'s record', 'The owner sets them up once, in Account > Google Sheets'],
          tour: [{ sel: '[data-acct]', t: 'Google Sheets', d: 'The owner sets up each app\'s Sheet once, in Account > Google Sheets, for the whole family. Nobody else has to do anything.', g: 'tap' }] },
        fitness: { highlights: ['Your workouts, meds and steps are kept in the family\'s Google Sheet', 'Only you see yours, on any phone you sign in on', 'This phone keeps 90 days; older days come from the Sheet'] },
        drinks: { highlights: ['Your log is kept in the family\'s Google Sheet', 'Only you see yours, on any phone you sign in on', 'Older weeks come back from the Sheet'] },
        podcasts: { highlights: ['What you follow, save and play follows you to all your phones', 'Kept in the family\'s Google Sheet, where only you see yours', 'Show older in History brings back earlier plays'],
          tour: [{ sel: '.tabs .tab[data-tab="lib"]', t: 'Older plays', d: 'Library > History keeps 90 days on this phone. Show older brings earlier plays back from the Sheet.', g: 'tap' }] },
        orders: { highlights: ['Your orders are kept in the family\'s Google Sheet', 'Only you see yours', 'Show older orders brings back past years'],
          notes: ['Ipsy keeps your orders up to date by itself: each new email about an order on its way is read again, as well as To check (Settings > Ipsy)'] },
        notes: { highlights: ['Notes are kept in the family\'s Google Sheet', 'Mark a note, reminder or list Just me, and only you see it', 'Private still only hides a note from Ipsy'],
          tour: [{ sel: ['#list .grid .card', '#list .card', '#list .nrow', '#fab'], t: 'Just me', d: 'Open a note, reminder or list and switch on Just me: nobody else in the family gets it. Private only hides a note from Ipsy.', g: 'tap' }] },
        places: { highlights: ['Places are kept in the family\'s Google Sheet, shared with the family', 'Signed in, it syncs by itself'] },
        travel: { highlights: ['Trips are kept in the family\'s Google Sheet', 'Mark a booking or a trip Just me, and only you see it', 'Show older trips brings back past ones'],
          tour: [{ sel: ['#list .hero', '#list .trip', '#fab'], t: 'Just me', d: 'Open a booking for Just me, or a trip for Just me trip: the family sees everything else in the Sheet, but not that.', g: 'tap' }] },
        meals: { highlights: ['Every plan is kept in the family\'s Google Sheet, with who planned it', 'Older plans come back from it under Past plans'] },
      } },
    { v: '1.7', date: '2026-10-20', title: 'Meds, steps and yours to keep',
      highlights: ['Fitness: Meds and your steps, every day',
        'Mark a note, order, trip or event Private and Ipsy can\'t see it',
        'Lost a phone? aOS can sign you out and erase it'],
      notes: ['Fitness: Meds is a page of its own (the view picker at the bottom: Week, Analysis, Meds), never on the week. Add each medication or supplement once, with its dose, Morning, Midday, Evening or Bedtime (or once a day, or as needed) and the days you take it; then tick each off as you take it, with the time. Each shows how often you took it over 7 and 30 days, and how many days in a row. Pause one to stop it for a while. Signed in only, so a lost phone can be erased',
        'Fitness: steps on each day of the week, in the week\'s totals (steps a day) and in Analysis (steps a day, and days at your goal), with a daily goal in Settings. Type a day\'s steps in, or link your own iPhone in Settings > Steps: the Home Assistant app\'s Steps sensor counts the phone\'s own steps (not an Apple Watch\'s), read through aOS so no phone holds a Home Assistant token. Each person sees only their own phone',
        'Fitness: the Google Sheet backs up Meds and Steps too, in Meds, Med list and Steps tabs (paste the new script into the Sheet and deploy a new version). Once it does, the phone keeps only the last 30 days of doses and steps; the Sheet keeps them all',
        'aOS: Account > Erase aOS from a lost phone, step by step: Find My first, then Sign out and erase my other devices. Every other aOS app of yours erases what it keeps on its phone the next time it opens online. The owner can do it for someone who lost their only phone. Fitness: Settings > Sign out and erase',
        'Calendar: connect Gmail in Settings so Ipsy can search appointment emails, read-only, with separate email-sharing consent; every calendar change still asks first',
        'Ipsy: larger across all six apps, with quiet breathing, occasional glances and softer idle movement; Reduce Motion is respected',
        'Notes and Places: the Google Sheet connection form uses the new shared sync link; the shared Apps Script initializes Places data correctly',
        'Home: the Office and M&D heaters no longer say Unavailable while they are on (Home Assistant now reports an on heater as unknown); Power and the target work again',
        'Home: the heaters show their wattage (750 W or 1500 W) and mode (Eco, Comfort or Boost - all three, even when Home Assistant lists only Eco) to pick from, as in the Tuya app, and a countdown: 1, 2, 4 or 8 hours and the heater turns itself off',
        'Private, in Notes, Orders, Travel and Calendar: a private item is left out of everything Ipsy reads (it is told only how many there are), Ipsy can\'t change it, and Ipsy doesn\'t check it by itself. It still syncs and shows as usual: Private only hides it from Ipsy',
        'The emails behind a private order or booking are hidden from Ipsy too: the email it came from, that email\'s thread, and any email naming its order, tracking or confirmation number',
        'Orders, Travel and Calendar: Ipsy can search Gmail is a setting now (Settings), on this phone; off, Ipsy can\'t search or read any email',
        'Notes: a private note now syncs to the Google Sheet and the other phones like any other note, and its nudge notifies; before, private notes stayed on the phone. The first sync since sends them',
        'Orders: the Private switch is on an order\'s page, and a lock shows on its card',
        'Travel: the Private pill is on a booking, and Private trip on a trip\'s page; a trip with some private bookings is shown to Ipsy with the others only, named and dated by them, and its Family calendar events are marked private',
        'Calendar: the Private switch is in an event, kept in iCloud so every phone knows (an event marked private by another calendar app counts too); looking for free time, Ipsy only knows that time is taken. Private notes and bookings in the layers are hidden from Ipsy, and so are the emails behind private bookings',
        'Fitness: the Google Sheet link is the new deployment of the script with Meds and Steps; a phone on an earlier link moves to it by itself, keeping its phrase'],
      // Every app this release changed shows What's new; each one whose controls are new or changed then
      // walks through them (tour: stops as in SPOTS, played by "Show me"; one not on screen is passed over).
      apps: {
        aos: { highlights: ['Lost a phone? Your account has the steps to erase aOS from it', 'Sign out and erase your other devices in one tap', 'The owner can erase a family member\'s lost phone'],
          tour: [{ sel: '[data-acct]', t: 'Lost a phone?', d: 'Tap your account, then Erase aOS from a lost phone: the steps, and a button that erases aOS from your other devices.', g: 'tap' }] },
        fitness: { highlights: ['Meds: list what you take once, then tick it off each day', 'Your steps on every day, from your iPhone or typed in', 'Meds and Steps back up to your Google Sheet'],
          tour: [
            { sel: '#viewBtn', t: 'Meds', d: 'Pick Meds here: list your medications and supplements once, then tick them off each day. It\'s private to you.', g: 'tap' },
            { sel: ['#main .drow.today', '#main .week'], t: 'Steps on every day', d: 'Each day shows its steps. Tap a day to type them in at the top, with a bar to your goal.', g: 'tap' },
            { sel: '#setBtn', t: 'Steps and Sign out', d: 'Settings has your daily step goal, linking your own iPhone\'s steps, and Sign out and erase.', g: 'tap' },
            { sel: '#syncBtn', t: 'Backed up to your Sheet', d: 'Your Google Sheet keeps Meds and Steps too, once you paste in its new script.', g: 'tap' },
          ] },
        house: { highlights: ['Heaters show their wattage and mode, as in the Tuya app', 'Set a heater to turn itself off in 1 to 8 hours', 'An on heater no longer says Unavailable'],
          notes: ['Air Purifiers: in Auto the speed says Auto and is greyed out (a Dyson reports no speed of its own then), instead of showing an old speed'],
          tour: [{ sel: ['[data-dv^="heat:"]', '#viewBtn'], t: 'Heaters, like the Tuya app', d: 'On Climate (pick it here), each heater has its wattage, Eco, Comfort or Boost, and a timer that turns it off in 1, 2, 4 or 8 hours.', g: 'tap' }] },
        calendar: { highlights: ['Mark an event Private to hide it from Ipsy', 'Connect Gmail so Ipsy can find appointment emails', 'Turn Ipsy\'s Gmail off any time in Settings'],
          tour: [{ sel: '#fab', t: 'Private events', d: 'Open or add an event and switch on Private: Ipsy can\'t see it, and when it looks for free time it only knows the time is taken.', g: 'tap' },
            { sel: '#setBtn', t: 'Gmail for Ipsy', d: 'In Settings, connect Gmail so Ipsy can search appointment emails (read-only), or turn it off any time.', g: 'tap' }, { sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
        notes: { highlights: ['Private notes now sync like any other note', 'Private only hides a note from Ipsy', 'Their nudges notify now, too'],
          tour: [{ sel: ['#list .grid .card', '#list .card', '#list .nrow', '#fab'], t: 'Private notes', d: 'Private in a note now only hides it from Ipsy: it syncs to your Sheet and other phones, and its nudges notify.', g: 'tap' },
            { sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
        places: { highlights: ['A new Sheet sets itself up properly for your places'] },
        orders: { highlights: ['Mark an order Private to hide it from Ipsy', 'Ipsy can\'t read its emails either', 'Turn off Ipsy\'s Gmail in Settings'],
          tour: [{ sel: ['#list .ocard', '#fab'], t: 'Private orders', d: 'Open an order: its Private switch hides it, and its emails, from Ipsy. A lock shows on its card.', g: 'tap' }, { sel: '#setBtn', t: 'Ipsy\'s Gmail', d: 'In Settings, Ipsy can search Gmail is a switch now, on this phone. Off, Ipsy can\'t search or read any email.', g: 'tap' }, { sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
        travel: { highlights: ['Mark a booking or a whole trip Private', 'Ipsy can\'t see it, or its emails', 'Turn off Ipsy\'s Gmail in Settings'],
          tour: [{ sel: ['#list .hero', '#list .trip', '#fab'], t: 'Private trips', d: 'Open a booking for its Private pill, or a trip for Private trip: Ipsy can\'t see them, or their emails.', g: 'tap' }, { sel: '#setBtn', t: 'Ipsy\'s Gmail', d: 'In Settings, Ipsy can search Gmail is a switch now, on this phone. Off, Ipsy can\'t search or read any email.', g: 'tap' }, { sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
        meals: { highlights: ['Ipsy is bigger, and breathes and glances while it waits'], tour: [{ sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
        news: { highlights: ['Ipsy is bigger, and breathes and glances while it waits'], tour: [{ sel: '.ipsy-btn', t: 'Ipsy, bigger', d: 'Tap Ipsy to chat. It breathes and glances now while it waits for you.', g: 'tap' }] },
      } },
    { v: '1.6', date: '2026-10-16', title: 'Ipsy, everywhere', intro: 'ipsy',
      highlights: ['Ipsy is now in Travel, Meals, Calendar, Notes and News',
        'Ipsy checks flights live and searches the web for you',
        'In Orders and Travel, Ipsy fixes what\'s in To check by itself, with Undo'],
      notes: ['Ipsy, the little stem cell you chat with, is in six apps now: Orders, Travel, Meals, Calendar, Notes and News. In each it works on that app\'s own things, every change shows in its chat with Undo, it can search the web, and it is for signed-in family. It runs on Claude Sonnet 5.5',
        'Travel: Ipsy takes the place of the Ask AI bar. Ask about your trips, fix, add, move or delete a booking (it asks before deleting a whole trip), check any flight live by its number (delays, gates, where it is), find a flight number from the airport\'s board, and look through your Gmail',
        'Travel: Check with AI is now Have Ipsy check. Say yes once and Ipsy fills in what your upcoming bookings are missing by itself, after each read of Gmail; what it fills in is marked Check, with Undo (Settings, Smart help)',
        'Orders: say yes once and Ipsy checks the orders in To check by itself after each read of Gmail, fixing what it can, with Undo; Fix details with Claude is now Have Ipsy check this order (Settings, Ipsy)',
        'Meals: Ipsy swaps a night\'s dinner, plans a new week around the deals, finds what\'s on sale and says what you can make with what you have, always keeping to what the family never eats',
        'Calendar: Ipsy finds what\'s on and free time, and adds, moves or deletes an event in the Family calendar. It asks you first before every change, one event at a time, never touches a repeating event, and only reads the other layers',
        'Notes: Ipsy finds and writes notes, adds to lists, checks things off, sorts groceries into store sections and sets reminders. It never sees private notes, and asks before deleting one',
        'News: Ipsy finds and sums up stories in today\'s headlines, checks scores, fixtures and tables, changes the teams you follow, and looks up anything newer on the web',
        'aOS: Meet Ipsy on Today now tells what Ipsy does in all six apps'],
      apps: {
        travel: { highlights: ['Meet Ipsy: tap the little stem cell and chat about your trips', 'Ipsy checks any flight live and finds flight numbers', 'Ipsy fills in what your bookings are missing, with Undo'] },
        meals: { highlights: ['Meet Ipsy: tap the little stem cell and chat about dinner', 'Ipsy swaps a night or plans a week around the deals', 'It always keeps to what the family never eats'] },
        calendar: { highlights: ['Meet Ipsy: tap the little stem cell and ask what\'s on', 'Ipsy finds free time and adds, moves or deletes events', 'It always asks you first before changing anything'] },
        notes: { highlights: ['Meet Ipsy: tap the little stem cell and chat about your notes', 'Ipsy writes notes, adds to lists and sets reminders, with Undo', 'Private notes stay private: Ipsy never sees them'] },
        news: { highlights: ['Meet Ipsy: tap the little stem cell and ask about the news', 'Ipsy sums up stories and checks scores and tables', 'Ipsy can change the teams you follow'] },
        orders: { highlights: ['Ipsy now checks To check by itself and fixes what it can', 'Each fix shows in Ipsy\'s chat with Undo', 'Turn it on or off in Settings, Ipsy'] },
      } },
    { v: '1.5', date: '2026-10-16', title: 'Meet Ipsy', intro: 'ipsy',
      highlights: ['Meet Ipsy: a little stem cell you can chat with, in Orders',
        'Ask about your orders and Ipsy finds, fixes, merges and deletes them, with Undo',
        'Ipsy checks your Gmail and searches the web for you'],
      notes: ['Orders: Ipsy, the little stem cell in the bottom left corner, is a helper you chat with, running on Claude Sonnet 5.5. Ask in your own words and it looks through your orders, fixes details, marks them delivered, adds, deletes and merges duplicates (each change shows in the chat with Undo, and is kept like your own edit), reads your Gmail (read-only) to check an order or find one that was missed, and searches the web. It asks once before your first question, and is for signed-in family',
        'Ipsy changes shape as it works: a stem cell at rest, a nerve cell while it thinks, a white blood cell while it looks through your orders',
        'Ipsy\'s chat pops out of Ipsy as a speech bubble, its tail pointing back at it, instead of a sheet that covers the app; it grows with the conversation and shrinks back into Ipsy when you put it away (tap Ipsy, the ×, or outside it)',
        'aOS: Today leads with Meet Ipsy, Ipsy itself telling what it can do as it turns from one cell into the next; tap it for the whole story'],
      apps: {
        orders: { highlights: ['Meet Ipsy: tap the little stem cell, bottom left, and chat about your orders', 'Ipsy finds, fixes, merges and deletes orders for you, each with Undo', 'Ipsy checks your Gmail and searches the web too'] },
      } },
    { v: '1.4', date: '2026-10-16', title: 'Your look, in Settings',
      highlights: ['Every app opens in Vintage. Prefer Sea glass? Pick it in the app\'s Settings',
        'Each app is one app now, with both looks inside',
        'Added a Vintage app before? It keeps working, with your data'],
      notes: ['Every app carries both its designs, as Clock does: Vintage (mid-century modern, now the default) and Standard (Sea glass), picked in the app\'s own Settings > Design, the first section. The choice changes the app at once, is kept on this phone, and the Home Screen icon, status bar and bar colours follow it when you add the app',
        'The Vintage apps (Mail Vintage, Notes Vintage and the rest) are no longer apps of their own: aOS shows one app for each, with no Design menu. A Vintage app already on your Home Screen still opens, now as the app itself, in Vintage, with its notes, settings, sign-ins and history moved over on the phone the first time (nothing is deleted)'],
      apps: {
        mail: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        calendar: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        news: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        weather: { highlights: ['Vintage and Sea glass are now one app: pick your look in Places > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Places'] },
        notes: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        podcasts: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        travel: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        places: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        fitness: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        drinks: { highlights: ['Vintage and Sea glass are now one app: pick your look in More > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in More'] },
        meals: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        orders: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
        house: { highlights: ['Vintage and Sea glass are now one app: pick your look in Settings > Design', 'It opens in Vintage. Prefer Sea glass? Pick Standard in Settings'] },
      } },
    { v: '1.3', date: '2026-10-13', title: 'A look for every app', added: ['clock', 'orders'],
      highlights: ['Every app has a Vintage design: pick your look in aOS',
        'Clock is new: world time, alarms, a stopwatch and timers',
        'Settings looks the same in every app',
        'Orders is new: everything you\'ve bought, and where it is',
        'Vintage apps have Weather\'s day and night sky: the sun by day, the moon and stars after sunset'],
      notes: ['Travel and Travel Vintage: an email with no date in it (Frontier\'s sometimes) is no longer dropped; it waits in To check until your calendar, a later email or you give it its day, and To check only lists what is still to come. The Family calendar now works both ways: flights, hotels and rental cars in it show up in Travel, and confirmed bookings are added to it, never twice. Where a booking is missing something, the airport\'s flight board can find a missing flight number, and a Check with AI button on the trip card (only when something is missing, and only when you press it) has Claude read that one email for it; anything filled in this way is marked Check. An Ask AI bar on Trips answers questions about your current, past and to-check trips (only when you ask). The calendar and the AI can be switched off in Settings, under Smart help',
        'Travel and Travel Vintage: one booking is one trip (the flights out and home of a reservation are no longer split into two trips), and a hotel confirmation from a booking site such as Hilton\'s is named and placed from the email, with its "pending" and confirmed emails read as one stay. Emails whose plain-text part is only tracking links (Hilton\'s, sent through Cvent) are now read from their html, so those hotel stays are no longer missed. The Ask AI bar has a Change switch: tell Travel what to change (edit or clear any detail, add a booking, cancel or delete one, put a booking in a trip or take it out, rename a trip), look over the changes it proposes, and tap Apply; nothing changes before that, and Undo puts it all back. Settings says which AI models answer, and which one gave the last answer. Travel now reads your mail again once after this update (so Hilton\'s emails and other stays missed before show up), searches for more airlines, hotel groups, car rental companies and booking sites, and no longer mixes up two trips on the same flight number (like a September and a November Cleveland trip). Settings has a new What Travel read list: every email the last look went through and what it made of it, so a missing booking can be tracked down; the re-reading after an update can no longer leave holes if it is interrupted; and West Palm Beach\'s new airport code (DJT) is recognised',
        'New: Clock, one of the core apps, with two designs picked in its Settings, Vintage (starburst clock faces, the default) and Standard (Sea glass): World Clock with the cities you add; Alarms with Sleep | Wake Up, repeat days, a label, six sounds made in the app and snooze from 1 to 15 minutes; a Stopwatch, digital or analog, with laps; as many Timers at once as you like, with Recents; and Nightstand, a bedside clock that keeps the screen on so alarms ring. A web app can only ring while it is open, so Clock says so, and lists anything that came due while it was closed',
        'Clock: pick the main clock\'s city in Settings (alarms and Nightstand keep your phone\'s time)',
        'New: a Vintage design for Notes, Podcasts, Places and Meals, so every app has one (pick it on the app\'s page in aOS)',
        'Meals and Podcasts can keep a readable copy in a Google Sheet of your own (Meals: every plan, the list, deals; Podcasts: shows, saved episodes and history); Orders\' Sheet gets a Log tab of every order, status change and deletion',
        'aOS: notifications. Under your account, from the Home Screen app, turn them on; the owner can then write a notification and send it to everyone in the family who has them on (iPhone: iOS 16.4 or later)',
        'News: the Scores button no longer shows a number of live games (the red dot still shows when one is on)',
        'News: Sport > Table shows a league\'s standings from ESPN, with a pill to pick the league, kept up to date as games finish (every minute while a game is on), the teams in play marked and the teams you follow tinted',
        'News: tap a football or rugby game in Sport > Scores for its own page instead of ESPN\'s: the score and clock, key events (goals, cards, substitutions), stats side by side, a shot map and each player\'s goals, assists and shots for football, the scoring and line-ups for rugby, refreshed every 45 seconds while the game is on, with Open on ESPN at the bottom',
        'Home: the thermostats and the Windmill AC show a few small snowflakes falling while they cool and a small flickering flame while they heat, all faint and animated',
        'aOS: Today leads with what\'s new - a new app, big, with What\'s new in aOS beside it - and below it shows a different mix of apps every day',
        'aOS on Android: an app you removed from the tablet shows Get again once you tap it in aOS (Chrome tells the app it is no longer installed). iPhone can\'t tell, so there it is still the "Removed it from your Home Screen?" button',
        'Orders is new, one of the Allison family apps: everything you\'ve bought and where it is, read from the order, shipping and store-pickup emails in your Gmail, with the courier, the tracking number and a link to track it. Packages and store pickups show; food, subscriptions and tickets can be switched on in Settings',
        'Mail has a Vintage design: the same Mail in a mid-century modern look in the Retro colors - cream (walnut in dark mode), mustard, teal and burnt orange, flat round-cornered cards and buttons instead of glass, atomic shapes behind the title and Futura type. Pick it from the Design menu on Mail\'s page in aOS. It is its own app on your Home Screen, with its own sign-in and settings, so Mail stays as it is',
        'Home has a Vintage design too, in the same look: cream and walnut cards instead of glass and skies, a sun behind the title, and Futura. Pick it from the Design menu on Home\'s page in aOS. It is its own app, with its own Home Assistant connection and settings, so Home stays as it is',
        'Orders has a Vintage design too, in the same look: cream and walnut cards instead of glass, atomic shapes behind the title and Futura. Pick it from the Design menu on Orders\' page in aOS. It is its own app, with its own orders and settings (it can share Orders\' Google Sheet), so Orders stays as it is',
        'Orders: Whole Foods orders show as Whole Foods Market, not Amazon, and a booked pickup shows its day; an order that was only received is no longer shown as ready or out for delivery; Orders Vintage opens an order\'s email in Mail Vintage',
        'Orders: Fix details with Claude, on an order\'s page, sends that one email\'s text (links removed) to Claude to read again when the details look wrong; nothing is kept, and it is for signed-in family',
        'Orders: a one-off clean-up marks open orders nothing had been heard about for over 5 days as received (Undo in the toast)',
        'aOS has the mid-century modern look too, the same as the Vintage designs of Mail, Home and Orders: cream (walnut in dark mode) instead of glass, mustard, teal and burnt orange, atomic shapes behind each title, flat round-cornered cards and buttons, a walnut pill for the tabs, Futura type, and a new aOS icon. The original Sea glass look is still there: choose Vintage or Sea glass before you add aOS to your Home Screen (its icon goes with it), or later under your account, in Look',
        'Calendar, Drinks, Fitness, News, Weather and Travel have a Vintage design too, in the same look: cream and walnut cards instead of glass, mustard, teal and burnt orange, atomic shapes behind the title, Futura, and a new geometric icon for each. Pick it from the Design menu on the app\'s page in aOS. Each is its own app, with its own settings and storage (the Vintage designs of Fitness and Travel can share the original\'s Google Sheet; Travel\'s needs its own Google sign-in address added once), so the originals stay as they are. In the Vintage look, aOS shows every app with a mid-century icon, including new ones for Notes, Podcasts, Places and Meals; Sea glass keeps the original icons',
        'Drinks (and its Vintage design) can back up to a Google Sheet of your own: More > Google Sheet sync. Its Log tab has the ABV Tracker\'s columns and goes both ways: change a row or add one in the Sheet and it comes back to the app, and a Qty of 0 removes a drink. Private to you; each person uses a Sheet of their own',
        'Settings looks the same in Calendar, Podcasts, Travel, Orders, Meals, Mail and Home (and their Vintage designs): a sheet titled Settings with a Done tick, the same section headings and notes, left-aligned, with Backup Log and Backup last. Mail\'s Settings is now a sheet over the mailbox, not a page, and Home\'s Home Assistant sheet is Settings. In Meals, Mail and Home the tick saves what you changed',
        'Every Vintage design, and aOS in its Vintage look, has Weather Vintage\'s backgrounds, with the real sun: by day a ground washed with mustard, with the sun and rays that turn very slowly; after sunset a ground washed with deep teal, with the moon and twinkling stars; each over cream (Light) or walnut (Dark). Sunrise and sunset are for where you are (from the place the app already has permission to know, else your time zone), and it changes by itself while the app is open. It holds still with Reduce Motion. Weather Vintage keeps drawing its own sky from the forecast'],
      apps: {
        mail: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Settings is a sheet, laid out like every other app\'s', 'New in aOS: Orders, everything you\'ve bought. Get it in aOS'] },
        house: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'An "Away from the house" pill, and the room\'s temperature up front', 'Settings is laid out like every other app\'s'],
          notes: ['Small snowflakes fall while the thermostats cool, and a flame flickers while they heat'] },
        orders: { highlights: ['Orders is new: everything you\'ve bought and where it is, read from the emails in your Gmail', 'A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Settings is laid out like every other app\'s'],
          notes: ['Fix details with Claude, on an order\'s page', 'Whole Foods orders show as Whole Foods Market, and a booked pickup shows its day'] },
        calendar: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS'], notes: ['The notes in Settings are left-aligned, like every other app\'s'] },
        drinks: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Back up your log to a Google Sheet of your own: More > Google Sheet sync'] },
        fitness: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS'] },
        news: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Sport > Table shows league standings, kept up to date as games finish', 'Tap a game in Sport > Scores for its own page: the score, key events and stats'],
          notes: ['The Scores button no longer shows a number of live games'] },
        weather: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS'] },
        travel: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Settings is laid out like every other app\'s'] },
        notes: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS'] },
        podcasts: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Back up your shows, saved episodes and history to a Google Sheet of your own', 'Settings is laid out like every other app\'s'] },
        places: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS'] },
        meals: { highlights: ['A Vintage design: the same app in a mid-century modern look. Pick it on the app\'s page in aOS', 'Keep a readable copy of your plans, list and deals in a Google Sheet of your own', 'Settings: the tick saves your changes'] },
      } },
    { v: '1.2', date: '2026-10-11', title: 'The news, in a nutshell',
      highlights: ['News: tap the sparkle on a story for a quick summary',
        'Meals: deals from eight stores near Apex, and plans built from them',
        'Drinks: a new Analysis page'],
      notes: ['News: tap the sparkle on a story for Claude\'s two-sentence summary and key takeaways, then ask questions about the article (signed-in family; a summary is kept for a week for everyone, and each person gets 60 a day)',
        'News: the topics (UK, US, AI and the rest) are a drop-down pill at the bottom, the same as Home\'s, each with its own icon',
        'News: Sport > Scores shows the Premier League first, with a pill to pick another league (or all of them), for scores and for Coming up; Liverpool, England and the other team buttons are tucked into one My teams pill',
        'News: in the Scores league pills, the Premier League and Premiership Rugby are pinned to the top',
        'Meals: deals from the family\'s stores near Apex - Whole Foods, Harris Teeter, Publix, Lidl, Lowes Foods, Aldi, Walmart and Target - one at a time or all together, with Prime and VIC prices',
        'Meals: plan at one store, or with the best deals across all of them; the list says where each sale item is',
        'Meals: a new plan waits for you to accept it, try again or discard it; accepted plans are saved with their dates and shopping list under Past plans',
        'Home: connects to Home Assistant faster when the network is slow to answer: a second and third try open beside a stalled one, and the first answered is kept (before, each try was given up on after 12 seconds and started again from nothing)',
        'Home: the 1% light button is a moon on midnight blue, the night setting',
        'Home: the 100% light button is a sun, glowing gold at full brightness',
        'Drinks: Analysis is one page, opened from the week\'s number (it now says Analysis), with a pill at the bottom to pick a view - this week or month against the one before, weekly drinks against your limit, weeks over it, your top drinks, days of the week, alcohol-free days, days over your daily limit, and strength and size',
        'Mail\'s new tagline in aOS: Mail.Controlled.'],
      apps: {
        news: { highlights: ['Tap the sparkle on a story for a two-sentence summary and the key takeaways, then ask questions about it', 'The topics (UK, US, AI and the rest) are a drop-down pill at the bottom, like Home\'s', 'Sport scores are tidier: the Premier League first, a pill to pick another league, and your teams in one pill'],
          notes: ['Summaries are for signed-in family: Face ID asks the first time', 'Each topic has its own icon in the pill', 'In the Scores league pills, the Premier League and Premiership Rugby are pinned to the top'] },
        meals: { highlights: ['Deals from eight stores near Apex: pick one, or see them all together', 'Plan at one store, or with the best deals across them', 'Accept a plan to save it with its dates and shopping list; past plans stay to look back on'],
          notes: ['Prime and VIC member prices'] },
        house: { highlights: ['Connects to Home Assistant faster when the network is slow to answer: a stalled try no longer holds it up', 'The 1% light button is a moon on midnight blue, the night setting', 'The 100% light button is a sun, glowing gold at full brightness'] },
        mail: { highlights: ['Mail has a new tagline: Mail.Controlled.'] },
        drinks: { highlights: ['Analysis is one page, opened from the week\'s number, with a pill at the bottom to pick a view', 'Pick a view from the pill: this week or month against the one before, your top drinks, days of the week, and more'] },
      } },
    { v: '1.1', date: '2026-10-10', title: 'Dinner is served', added: ['meals'],
      highlights: ['Meals: a few nights of different dinners around one meat, this week\'s Whole Foods deals, and one shopping list', 'Easier to tap: small buttons, arrows and chips take a tap a little way round them'],
      notes: ['Meals is one of the Allison family apps, in aOS: the family\'s plan, deals and list are shared, and every plan is checked against the family\'s allergies',
        'News keeps its last headlines up if the news sources can\'t be reached for a while',
        'The welcome link for new family shows Meals with the other Allison family apps'],
      apps: {
        meals: { highlights: ['New: a few nights of different dinners, built around one meat', 'This week\'s Whole Foods deals, sorted like a grocery list', 'One shopping list, checked against the family\'s allergies'] },
        news: { highlights: ['Your headlines stay up, even when the news sources can\'t be reached', 'Buttons, arrows and chips are easier to tap, and look just the same', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        notes: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same', 'Meals\' shopping list sorts into the same grocery sections as your lists here: copy it into one', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        calendar: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same: the month arrows, Today, Search and Settings', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        podcasts: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        travel: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same: the header buttons and the Upcoming and Past chips', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        places: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same: the header and map buttons, the tabs and the chips', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        fitness: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same: the week arrows and the sync button', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
        house: { highlights: ['Buttons, arrows and chips are easier to tap, and look just the same: Settings, Connect and the player\'s small buttons', 'New in aOS: Meals, the family\'s dinners. Get it in aOS'] },
      } },
    { v: '1', date: '2026-10-07', title: 'The Power of aOS1',
      highlights: ['aOS: one place to get every AllisonOS app', 'A live tour in every app: the first time you open it, a spotlight shows you around the app itself', 'Family accounts: Face ID signs you in to every app'],
      notes: ['Light or dark in every app', 'Sea glass, the AllisonOS colors, in every app: one look, and one family of icons',
        'US English and US dates everywhere (Friday, October 9)', 'Home and Places follow the Light or Dark you pick, even when your iPhone is set the other way', 'Podcasts: the first tab is Listen Now',
        'Calendar and Travel only answer your family',
        'The owner invites family from aOS, with a link good once for 24 hours; removing someone signs them out of every app, and Invite back brings them back with everything they had',
        'Lost a phone? Sign out everywhere else, in your aOS account, ends every other sign-in at once',
        'Every app works on its own: add only the ones you want; what they share with each other is extra',
        'AllisonOS lives at tomallison24-news.pages.dev; the old GitHub Pages address sends you there',
        'Weeks start on Sunday in Calendar, Fitness and Drinks (Calendar → Settings to pick Monday); Travel says rental car',
        'Home fills in your family\'s Home Assistant address, and shows how to make your token',
        'An app opened from aOS shows only how to add it: tap ✕ to go back to aOS',
        'Removed an app from your Home Screen? Tell aOS on the app\'s page and it shows Get again',
        'aOS is an app store: Today, Apps, Search, a page for every app, and your account',
        'aOS shows ✓ Installed for the apps on your phone: each app, signed in once, tells it',
        'The aOS icon is just aOS, without a version number',
        'Home: tone and home theater sliders sit one to a row, full width, with the level beside the name',
        'Home: the Dysons\' Heat to stepper is back to its normal size, like the heaters\' Target',
        'aOS is the Allison family\'s: a family card on Today, and every app curated for the family',
        'aOS shows ✓ Installed as soon as a new app has been opened, without reopening aOS',
        'Drinks: a new app, a simple log of what you drink, private to you in your family account',
        'Calendar: a Drinks layer, off until you turn it on, showing only your own log',
        'Calendar: the Notes, Travel, Fitness and Mail layers come through your own family account, so they show on an iPhone, where every app keeps its own storage',
        'Fitness: your drinks from Drinks in Analysis, beside your training',
        'aOS: a Subscription section in your account, just for fun: Pro+, Pro or a 7-day Trial, for the whole family, changed by the owner',
        'Canceling a plan keeps it until the end of its month; then, or when a trial ends, every app but aOS is off until a plan is chosen. Nothing is deleted meanwhile',
        'The 7-day trial is once per family',
        'Each app\'s tour plays once per install, and again if you remove the app and add it back (on Android too)',
        'Android: an app opened in Chrome shows how to install it, and its tour waits until it\'s installed',
        'An invite opened on Android works like on iPhone: your account first, then how to add aOS (in Chrome)',
        'aOS shows two collections: the core apps (Weather, Notes, News, Mail and Calendar) and the Allison family apps'],
      cards: [
        { i: 'grid', t: 'Meet aOS', d: 'aOS is the home for every app: open it to add the ones you want, and to see what\'s new.' },
        { i: 'sparkle', t: 'A tour in every app', d: 'The first time you open an app, it shows you around. When it gets something new, it tells you.' },
        { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep aOS always light or always dark.' },
      ],
      apps: {
        drinks: { highlights: ['New: a simple log of what you drink', 'Your usual drinks are one tap', 'Private to you, in your family account'],
          notes: ['Bring in your ABV Tracker history from its backup or its Google Sheet', 'Tap the week\'s number for Analysis: this week or month against the one before, and your alcohol-free streak'] },
        calendar: ['A Drinks layer, off until you turn it on: your own standard drinks and alcohol-free days'],
        fitness: ['A small glass and the day\'s standard drinks on the week, from Drinks', 'Analysis shows your drinks from Drinks beside your training: standard drinks and alcohol-free days, this window and the one before'],
      } },
  ];
  // A release's (or an app's) highlights and notes; a plain list is all notes.
  const entry = x => Array.isArray(x) ? { highlights: [], notes: x } : { highlights: (x && x.highlights) || [], notes: (x && x.notes) || [] };
  // What an update screen shows: the highlights, or else the first few notes.
  const top = (list, n = 3) => { const h = list.flatMap(x => entry(x).highlights); return (h.length ? h : list.flatMap(x => entry(x).notes)).slice(0, n); };
  // The apps, in aOS's order; house is shown as Home.
  const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'house'];
  // Two collections: the core apps everyone gets, and the Allison family's own. aOS shows them
  // apart, core first, in this order (APPS keeps its order: the accounts server lists the same).
  const CORE = ['weather', 'notes', 'news', 'mail', 'calendar', 'clock'];
  // Apps that come in more than one design, each design its own app folder: aOS would show one row for
  // the app and a Design menu on its page. None now: every app carries both its designs itself, Vintage
  // (the default) and Standard (Sea glass), picked in its own Settings (../home/design.js). The old
  // Vintage apps' addresses (mealsvintage/ and the rest) open the same app (news.yml copies it there).
  const DESIGNS = {};
  const VARIANTS = new Set(Object.values(DESIGNS).flatMap(d => d.slice(1).map(x => x.app)));
  const FAMILY_APPS = APPS.filter(id => !CORE.includes(id) && !VARIANTS.has(id));
  const BY_GROUP = [...CORE, ...FAMILY_APPS];
  const NAMES = { aos: 'aOS', home: 'AllisonOS', mail: 'Mail', clock: 'Clock', calendar: 'Calendar', news: 'News', weather: 'Weather', notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel', places: 'Places', fitness: 'Fitness', drinks: 'Drinks', meals: 'Meals', orders: 'Orders', house: 'Home' };
  // Each app's walkthrough (written from its README): a tagline and its cards.
  const TOURS = {
    "clock": {
      "tag": "World time, alarms, a stopwatch and timers",
      "cards": [
        {
          "i": "globe",
          "t": "World Clock",
          "d": "See your own time and the cities you add, each with its time, its day and how far ahead or behind it is."
        },
        {
          "i": "bell",
          "t": "Alarms",
          "d": "Set alarms that repeat on the days you pick, each with a label, a sound and snooze. Sleep | Wake Up keeps your bedtime and wake-up time."
        },
        {
          "i": "clock",
          "t": "Stopwatch and timers",
          "d": "A stopwatch with laps, the fastest and slowest marked, and as many timers as you like at once. Recent timers are one tap."
        },
        {
          "i": "moon",
          "t": "Nightstand",
          "d": "A dark bedside clock that keeps the screen on, so your alarm rings in the morning. Alarms ring only while Clock is open."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century with starburst clock faces, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "mail": {
      "tag": "Mail.Controlled.",
      "cards": [
        {
          "i": "swipe",
          "t": "Swipe to sort",
          "d": "Swipe right to tag or move to Marketing; swipe left to flag, archive or trash. Every swipe has Undo."
        },
        {
          "i": "inbox",
          "t": "Marketing empties itself",
          "d": "Promotions move out of your inbox into Marketing, and anything there over 30 days old goes to the Trash."
        },
        {
          "i": "tag",
          "t": "Tags that stick",
          "d": "Tag one email and everything from that sender gets the tag too, now and in future, even with the app closed."
        },
        {
          "i": "bell",
          "t": "Remind Me",
          "d": "Put a conversation away until Tomorrow, This Weekend or Next Week. It comes back unread at the top."
        },
        {
          "i": "share",
          "t": "Send with Undo",
          "d": "Reply, Reply All or Forward with attachments. Every send waits 5 seconds so you can take it back."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "calendar": {
      "tag": "The Family calendar, everywhere",
      "cards": [
        {
          "i": "people",
          "t": "One shared calendar",
          "d": "This is your iCloud Family calendar, so changes here show up in everyone's iPhone Calendar too."
        },
        {
          "i": "calendar",
          "t": "Day to Year views",
          "d": "Pick Day, Week, Month, Year or List from the bottom bar, swipe to move through time, and tap Today to come back."
        },
        {
          "i": "clock",
          "t": "Add events fast",
          "d": "Tap + or an empty time to add an event, with repeats, alerts, travel time and notes."
        },
        {
          "i": "swipe",
          "t": "Drag to reschedule",
          "d": "In Day or Week, press and hold an event to drag it to a new time, or drag its bottom edge to change its length."
        },
        {
          "i": "grid",
          "t": "Everything in one place",
          "d": "Turn on layers for holidays, Notes reminders, trips, Mail reminders, workouts and the weather forecast."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "news": {
      "tag": "Headlines, scores and your teams",
      "cards": [
        {
          "i": "globe",
          "t": "News by topic",
          "d": "Browse the latest headlines from free sources across World, UK, US, Business, Tech, AI, Science and more."
        },
        {
          "i": "list",
          "t": "Tap to read",
          "d": "Stories are newest first and each shows only once. Tap one to read the full article on the publisher's site."
        },
        {
          "i": "sparkle",
          "t": "Summarize a story",
          "d": "Tap the sparkle on a story for a two-sentence summary and the key takeaways, then ask questions about the article. Summaries are for signed-in family."
        },
        {
          "i": "star",
          "t": "Follow your teams",
          "d": "On Sport, the My teams pill holds Liverpool, England and the rest: pick one to see just their news and games, or choose your own sports and teams."
        },
        {
          "i": "bolt",
          "t": "Scores and tables",
          "d": "Switch Sport to Scores for live results, upcoming fixtures and where to watch on US TV, or to Table for a league's standings, kept up to date as games finish. Tap a football or rugby game for its own page: events, stats, shots and players."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "weather": {
      "tag": "The forecast, radar and alerts",
      "cards": [
        {
          "i": "rain",
          "t": "Know when rain starts",
          "d": "A chip under the temperature says when rain is due to start or stop, like \"Rain at 3:45PM\" (continental US)."
        },
        {
          "i": "radar",
          "t": "Radar that looks ahead",
          "d": "Watch the latest radar, then up to four hours of forecast rain, looping on a map. Continental US only."
        },
        {
          "i": "alert",
          "t": "Weather alerts",
          "d": "Active National Weather Service alerts show at the top, most severe first. Tap one to read it."
        },
        {
          "i": "pin",
          "t": "Your places",
          "d": "It opens to where you are. Save up to 12 cities and swipe the forecast sideways to move between them."
        },
        {
          "i": "chart",
          "t": "Every hour and day",
          "d": "Tap an hour or a day for the details: feels like, wind, humidity, chance of rain, sunrise and sunset."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "notes": {
      "tag": "Notes, reminders and lists",
      "cards": [
        {
          "i": "note",
          "t": "Notes with #tags",
          "d": "Type a #tag anywhere to file a note into a collection. Pin, color and search your notes too."
        },
        {
          "i": "check",
          "t": "Quick reminders",
          "d": "Type \"Call mom tomorrow #family\" and it's set. See Today, Upcoming and Flagged at a glance."
        },
        {
          "i": "list",
          "t": "Smart grocery lists",
          "d": "Grocery items sort into store sections in aisle order, and it learns where you like things to go."
        },
        {
          "i": "sparkle",
          "t": "Paste from anywhere",
          "d": "Copy a reply from Claude or anywhere, tap the clipboard button, and it becomes a note or a list of reminders."
        },
        {
          "i": "swipe",
          "t": "Swipe to tidy",
          "d": "Swipe a note left to archive or delete it, or right to pin or tag it. Deleted notes wait 30 days in Trash."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "podcasts": {
      "tag": "Your shows, ready to play",
      "cards": [
        {
          "i": "play",
          "t": "Up Next",
          "d": "Listen Now shows what's playing, your queue, episodes you're part way through, and new episodes from your shows."
        },
        {
          "i": "search",
          "t": "Find new shows",
          "d": "Browse Apple's Top shows, search by name, or paste a show's feed link. Private and premium feeds work too."
        },
        {
          "i": "clock",
          "t": "Listen your way",
          "d": "Play at 0.5× to 3×, skip back or forward, set a sleep timer, and AirPlay to a speaker or TV."
        },
        {
          "i": "refresh",
          "t": "Resume where you left off",
          "d": "Each episode resumes right where you stopped, and the next one in Up Next plays when it ends."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "travel": {
      "tag": "Every trip, all in one place",
      "cards": [
        {
          "i": "inbox",
          "t": "Fills itself from Gmail",
          "d": "Connect Gmail and your flight, hotel and rental car confirmations become trips on their own."
        },
        {
          "i": "plane",
          "t": "What's next",
          "d": "See your next flight, check-in or pick-up at the top, with live flight status and gates as take-off nears."
        },
        {
          "i": "calendar",
          "t": "Trips day by day",
          "d": "Each trip is a day-by-day timeline. Add the whole trip to the Family calendar in one tap."
        },
        {
          "i": "search",
          "t": "Plan the next one",
          "d": "Explore opens Google Flights, Google Hotels, Marriott, Kayak or National with your places and dates filled in."
        },
        {
          "i": "note",
          "t": "Add by hand",
          "d": "Tap + to add a flight, hotel or car yourself, or paste a confirmation email from any inbox."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "orders": {
      "tag": "Everything you've bought, and where it is",
      "cards": [
        {
          "i": "inbox",
          "t": "Fills itself from Gmail",
          "d": "Connect Gmail and your order, shipping and pickup emails become orders on their own."
        },
        {
          "i": "truck",
          "t": "See where it is",
          "d": "On the way, ordered, ready for pickup or delivered, each with its courier and tracking number."
        },
        {
          "i": "box",
          "t": "Tracking in one tap",
          "d": "Tap Track to open UPS, USPS, FedEx or DHL with your package already looked up."
        },
        {
          "i": "check",
          "t": "A quick check when it's unsure",
          "d": "An order read from the words of an email, or one that has gone quiet, waits under To check."
        },
        {
          "i": "sliders",
          "t": "Choose what counts",
          "d": "Packages and store pickups show. Turn on food, subscriptions or tickets in Settings."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "places": {
      "tag": "Where to go, and where you've been",
      "cards": [
        {
          "i": "list",
          "t": "Want to go and Been",
          "d": "Keep two lists: places you want to try and places you've been. Tap Been to move a place across."
        },
        {
          "i": "map",
          "t": "Your places on a map",
          "d": "Pins show which places you want to go to and which you’ve been to, each in its own color. Touch and hold anywhere on the map to add a spot."
        },
        {
          "i": "search",
          "t": "Find somewhere new",
          "d": "Search \"tacos\" or a name to find nearby businesses, or zoom in to see food, things to do and shops."
        },
        {
          "i": "star",
          "t": "Rate and remember",
          "d": "Add stars, price and notes with #tags, and Places keeps track of every visit."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "fitness": {
      "tag": "A simple workout log",
      "cards": [
        {
          "i": "calendar",
          "t": "Your week at a glance",
          "d": "Each day shows the muscle groups you worked and how many sets. Swipe sideways to move a week at a time."
        },
        {
          "i": "dumbbell",
          "t": "Log in seconds",
          "d": "Search an exercise, like \"db curl\", and last time's weight, reps and sets fill in for you."
        },
        {
          "i": "heart",
          "t": "Cardio counts too",
          "d": "Log time and distance on the treadmill, bikes, rower, track or pool alongside your lifting."
        },
        {
          "i": "chart",
          "t": "See your progress",
          "d": "Analysis compares this week or month with the one before, showing what's improving and what needs work."
        },
        {
          "i": "check",
          "t": "Meds and steps",
          "d": "Tick off your medications and supplements on Meds, a private page, and see each day's steps, from your iPhone or typed in."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "drinks": {
      "tag": "A simple log of what you drink",
      "cards": [
        {
          "i": "calendar",
          "t": "Your week in one number",
          "d": "Each day shows its standard drinks or alcohol-free, and the week adds up against the limit you set."
        },
        {
          "i": "plus",
          "t": "One tap to log",
          "d": "Your usual drinks sit in each day as tiles. Tap one to log it, or Something else for anything new."
        },
        {
          "i": "chart",
          "t": "How it's going",
          "d": "Tap the week's number for Analysis: this week or month against the one before, then 12 weeks of charts. The pill at the bottom picks which."
        },
        {
          "i": "lock",
          "t": "Private to you",
          "d": "Signed in, your log is kept in the family's Google Sheet, where only you can see yours, and follows you to another phone."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "meals": {
      "tag": "Dinner for the family, for less",
      "cards": [
        {
          "i": "calendar",
          "t": "A week of dinners",
          "d": "Pick a meat, and Meals plans a few nights of different dinners for the family, each a different cuisine."
        },
        {
          "i": "tag",
          "t": "This week's deals",
          "d": "Your Whole Foods' sales, found for you or pasted from its app, sorted like a grocery list."
        },
        {
          "i": "list",
          "t": "One shopping list",
          "d": "Everything the dinners need in one list, sorted by aisle, with what's on sale. Tick it off in the store."
        },
        {
          "i": "shield",
          "t": "Safe for the family",
          "d": "Every plan is checked against your family's allergies before it's kept."
        },
        {
          "i": "people",
          "t": "Shared with the family",
          "d": "Everyone signed in sees the same plan and deals."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    },
    "house": {
      "tag": "Your whole house in one place",
      "cards": [
        {
          "i": "star",
          "t": "Favorites first",
          "d": "It opens on what you use most: what's playing, what's running now, the weather, thermostats, cameras and lamps."
        },
        {
          "i": "thermo",
          "t": "Heat and cool",
          "d": "Set thermostats, heaters, air purifiers and dehumidifiers. Tap any card for all of its controls."
        },
        {
          "i": "bulb",
          "t": "Lights by room",
          "d": "Switch a whole room on or off, dim each light with a slider, or use All on and All off."
        },
        {
          "i": "shield",
          "t": "Cameras and security",
          "d": "Arm or disarm Blink, see each camera's latest still, take a snapshot or pause motion detection."
        },
        {
          "i": "moon",
          "t": "Routines in one tap",
          "d": "Run Goodnight, Evening Lights and your other routines straight from Favorites."
        },
        {
          "i": "star",
          "t": "Two designs",
          "d": "Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time."
        }
      ]
    }
  };

  // ---- versions ----
  const parts = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
  const cmp = (a, b) => { const A = parts(a), B = parts(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; };
  const major = v => parts(v)[0];
  const latest = () => RELEASES[0].v;   // one number for everything
  const shown = () => (RELEASES.find(r => !r.silent) || RELEASES[0]).v;   // what the apps show: the newest that isn't silent
  const supV = v => `aOS<sup>${esc(v)}</sup>`;
  // What this device has seen: { app: the aOS version it last showed }. An app
  // on the Home Screen keeps its own storage, so each install counts for itself.
  const SEEN = 'aos.seen';
  const seenAll = () => { try { return JSON.parse(localStorage.getItem(SEEN)) || {}; } catch { return null; } };   // null: no storage, never nag
  const markSeen = (id, v) => { try { const s = seenAll() || {}; s[id] = v; localStorage.setItem(SEEN, JSON.stringify(s)); } catch {} };

  // ---- Appearance: System, Light or Dark (home.settings.theme), applied by every app ----
  const THEMES = [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  const readTheme = () => { try { const t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; return ['light', 'dark'].includes(t) ? t : 'auto'; } catch { return 'auto'; } };
  const applyTheme = t => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); forceScheme(t); };
  // Some apps' CSS follows only the iPhone's setting (@media (prefers-color-scheme: ...)).
  // A chosen Light or Dark switches those rules on or off to match, so every app follows
  // it; System puts them back. The theme-color metas are matched the same way.
  const SCHEME = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i, orig = new WeakMap();
  function forceScheme(t) {
    const pick = o => { const m = o.match(SCHEME); return !m || t === 'auto' ? o : m[1].toLowerCase() === t ? o.replace(SCHEME, '(min-width: 0px)') : 'not all'; };
    const walk = rules => { for (const r of rules) {
      if (r.media && r.cssRules) { if (!orig.has(r)) orig.set(r, r.media.mediaText); const o = orig.get(r); if (SCHEME.test(o)) r.media.mediaText = pick(o); }
      if (r.cssRules) walk(r.cssRules);
    } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }   // another site's sheet can't be read; it's left alone
    for (const m of document.querySelectorAll('meta[name="theme-color"][media]')) { if (!m.dataset.media) m.dataset.media = m.media; m.media = pick(m.dataset.media); }
  }
  function setTheme(t) {
    try { const s = JSON.parse(localStorage.getItem('home.settings')) || {}; s.theme = t; localStorage.setItem('home.settings', JSON.stringify(s)); } catch {}
    applyTheme(t);
    dispatchEvent(new CustomEvent('aos:theme', { detail: t }));   // for any page showing its own switch
  }
  applyTheme(readTheme());   // every app, every time

  // ---- installing ----
  // Opened inside aOS's all-in-one test (labs/home: the apps framed in one window, on this
  // same site), an app counts as on the Home Screen, but isn't reported as added on its own.
  const inHome = (() => { try { return window.top !== window && !!window.top.aosHome; } catch { return false; } })();
  const standalone = () => inHome || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  // In there the app fills aOS's window, under aOS's own controls (the status bar, "‹ aOS"): aOS
  // says how much of the top and bottom they cover (AllisonOS.inset(top, bottom), or
  // aosHome.insets() at the start), and the app's safe-area spacing (env(safe-area-inset-top /
  // -bottom), 0 in a frame) is set to that, in its styles and in any style="" that uses it. Its
  // content clears aOS's controls and its own background runs under them, as on the Home Screen.
  const INSET = /env\(\s*safe-area-inset-(top|bottom)\s*(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g, insetOrig = new WeakMap();
  let insetNow = null;
  function setInset(top, bottom) {
    insetNow = { top, bottom };
    const put = (key, o, apply) => { if (!insetOrig.has(key)) insetOrig.set(key, o); const t = insetOrig.get(key); if (t.includes('safe-area-inset')) apply(t.replace(INSET, (m, side) => `${side === 'top' ? top : bottom}px`)); };
    const walk = rules => { for (const r of rules) {
      if (r.style) put(r, r.style.cssText, t => { r.style.cssText = t; });
      if (r.cssRules) walk(r.cssRules);
    } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
    // a style="" is set once (an app may change the rest of it later; a later inset doesn't undo that)
    for (const el of document.querySelectorAll('[style*="safe-area-inset"]')) el.setAttribute('style', el.getAttribute('style').replace(INSET, (m, side) => `${side === 'top' ? top : bottom}px`));
  }
  if (inHome) {
    AOS.inset = setInset;
    try { const v = window.top.aosHome.insets(); setInset(v.top, v.bottom); } catch {}
    // styles an app (or this script) adds later, and elements placed with the inset
    new MutationObserver(ms => {
      if (!insetNow) return;
      let again = false;
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'LINK') n.addEventListener('load', () => setInset(insetNow.top, insetNow.bottom), { once: true });
        if (n.tagName === 'STYLE' || (n.getAttribute('style') || '').includes('safe-area-inset') || (n.querySelector && n.querySelector('[style*="safe-area-inset"]'))) again = true;
      }
      if (again) setInset(insetNow.top, insetNow.bottom);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  // Under an iPhone's solid status bar (aOS's: data-bar="solid" on it, ../home/sky.js), aOS colours
  // the bar with this app's own background (#barcap, aOS/home-tab.js). The top of the app, where
  // "‹ aOS" floats over nothing of the app's own, fades into that same colour, so the bar and the
  // app run together, whatever the app draws up there (a sky, Sea glass's blobs).
  if (inHome) {
    const see = el => { const b = el && getComputedStyle(el).backgroundColor; return b && b !== 'transparent' && !/,\s*0\)$/.test(b) ? b : ''; };
    const topColor = () => see(document.body) || see(document.documentElement);
    let fade = null;
    const paintFade = () => {
      let solid = false; try { solid = window.top.document.documentElement.dataset.bar === 'solid'; } catch {}
      const c = solid && document.body ? topColor() : '';
      if (!c) { if (fade) fade.hidden = true; return; }
      if (!fade) {
        fade = document.createElement('div'); fade.id = 'aos-topfade'; fade.setAttribute('aria-hidden', 'true');
        fade.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:2147480000;pointer-events:none';
        document.body.appendChild(fade);
      }
      fade.hidden = false; fade.style.background = `linear-gradient(${c}, transparent)`;
    };
    AOS.topColor = () => { paintFade(); return topColor(); };   // aOS asks, for the bar
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintFade); else paintFade();
    addEventListener('aos:sky', paintFade);
    new MutationObserver(paintFade).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-look', 'data-sky', 'data-sky-tone'] });
  }
  // An app tapped in aOS opens as ?via=aos, in the in-app Safari view an installed aOS
  // opens links in - which may report itself as standalone. Remember it for this view
  // (a Home Screen app keeps its own storage, so its own launches never carry it) and
  // take it off the address at once, so the address added to the Home Screen is clean.
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('via') === 'aos') { sessionStorage.setItem('aos.via', '1'); q.delete('via'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
  } catch {}
  const viaAOS = () => { try { return !!sessionStorage.getItem('aos.via'); } catch { return false; } };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  let installEvt = null;   // Chrome and Edge's own prompt, kept for the Install button
  // Chrome may offer it after the card is up: then the card swaps its menu steps for the button.
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('#aos-welcome .c-inst').forEach(fillInstall); });
  function fillInstall(box) {
    const name = box.dataset.name;
    box.innerHTML = installEvt ? `<p>Add ${esc(name)} to this device, so it opens on its own like any other app.</p><button class="w-btn c-install" type="button">Install</button>`
      : `<p>Use your browser's <b>Install</b> or <b>Add to Home Screen</b> option, in its menu (⋮), to keep ${esc(name)} on this device like an app.</p>`;
    const b = box.querySelector('.c-install');
    if (b) b.onclick = async () => { const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch {} fillInstall(box); };
  }
  // Installed (Chrome tells the page it was installed from): a new install, so its walkthrough
  // plays again the first time it's opened. On Android the app shares the browser's storage, and
  // removing it keeps what it had seen; on iPhone a new install starts with empty storage anyway.
  addEventListener('appinstalled', () => { const s = seenAll(); if (!APP || !s || !(APP in s)) return; delete s[APP]; try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch {} });
  function steps(name) {
    if (installEvt || !ios) return `<div class="c-inst" data-name="${esc(name)}"></div>`;   // filled by fillInstall() once drawn
    return `<div class="c-sd"></div>${viaAOS() ? `<p class="c-via">Use the <b>Share</b> button in this view, then <b>Add to Home Screen</b>. Then tap <b>✕</b> at the top to go back to aOS.</p>` : ''}`;   // filled by safariDemo() once drawn
  }

  // ===========================================================================
  // ADD TO HOME SCREEN, SHOWN: a small iPhone running Safari, looping through the
  // real steps with a finger: ••• by the address bar -> Share -> scroll down the
  // share sheet to Add to Home Screen -> Open as Web App (on) -> Add -> the icon
  // lands on the Home Screen. Drawn after iOS 26's Safari (compact tab bar, glass
  // menus and sheets); a likeness, not a screenshot. Light and dark follow the page.
  //   AllisonOS.welcome.safariDemo(host, name, iconUrl, { onDone })  - fills host, loops while it's on the page; onDone after the first run
  // ===========================================================================
  const SD_CSS = `
.aos-sd { --s-bg: #F2F2F7; --s-group: #fff; --s-text: #000; --s-sub: rgba(60,60,67,.6); --s-sep: rgba(60,60,67,.18); --s-glass: rgba(255,255,255,.72); --s-page: #fff; --s-frame: #1C1C1E;
  --s-blue: #007AFF; --s-green: #34C759; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased; color: var(--s-text); user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .aos-sd { --s-bg: #000; --s-group: #1C1C1E; --s-text: #fff; --s-sub: rgba(235,235,245,.6); --s-sep: rgba(84,84,88,.6); --s-glass: rgba(44,44,48,.78); --s-page: #121214; --s-frame: #3A3A3C; --s-blue: #0A84FF; --s-green: #30D158; } }
html[data-theme="dark"] .aos-sd { --s-bg: #000; --s-group: #1C1C1E; --s-text: #fff; --s-sub: rgba(235,235,245,.6); --s-sep: rgba(84,84,88,.6); --s-glass: rgba(44,44,48,.78); --s-page: #121214; --s-frame: #3A3A3C; --s-blue: #0A84FF; --s-green: #30D158; }
.aos-sd * { box-sizing: border-box; }
.aos-sd .sd-phone { position: relative; width: 200px; height: min(372px, 46vh); margin: 0 auto; border-radius: 34px; padding: 5px; background: var(--s-frame); box-shadow: 0 18px 40px -16px rgba(0,0,0,.45); }
.aos-sd .sd-screen { position: relative; width: 100%; height: 100%; border-radius: 29px; overflow: hidden; background: var(--s-page); font-size: 10px; }
.aos-sd .sd-island { position: absolute; left: 50%; top: 6px; width: 54px; height: 15px; margin-left: -27px; border-radius: 10px; background: #000; z-index: 9; }
/* the web page: the app's own */
.aos-sd .sd-page { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 44px; }
.aos-sd .sd-page img { width: 54px; height: 54px; border-radius: 13px; box-shadow: 0 6px 14px rgba(0,0,0,.18); }
.aos-sd .sd-page b { margin-top: 8px; font-size: 14px; }
.aos-sd .sd-page i { display: block; width: 70%; height: 7px; border-radius: 4px; background: var(--s-sep); margin-top: 9px; }
.aos-sd .sd-page i:nth-of-type(2) { width: 54%; } .aos-sd .sd-page i:nth-of-type(3) { width: 62%; }
/* Safari's compact tab bar: back, the address, ••• - floating glass at the bottom */
.aos-sd .sd-bar { position: absolute; left: 7px; right: 7px; bottom: 9px; display: flex; align-items: center; gap: 5px; transition: opacity .3s; }
.aos-sd .sd-round { flex: none; width: 27px; height: 27px; border-radius: 50%; background: var(--s-glass); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.5), 0 2px 8px rgba(0,0,0,.15); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
.aos-sd .sd-addr { flex: 1; height: 27px; border-radius: 14px; background: var(--s-glass); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.5), 0 2px 8px rgba(0,0,0,.15); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 500; white-space: nowrap; overflow: hidden; }
.aos-sd .sd-more { letter-spacing: -1px; font-size: 11px; }
/* the ••• menu, opening from its button */
.aos-sd .sd-menu { position: absolute; right: 7px; bottom: 42px; width: 132px; border-radius: 14px; overflow: hidden; background: var(--s-glass); -webkit-backdrop-filter: blur(18px) saturate(180%); backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 10px 30px rgba(0,0,0,.25), inset 0 0 0 .5px rgba(255,255,255,.4); transform-origin: 90% 100%; transform: scale(.4); opacity: 0; transition: transform .35s cubic-bezier(.3,1.4,.5,1), opacity .25s; }
.aos-sd .sd-menu.on { transform: none; opacity: 1; }
.aos-sd .sd-row { display: flex; align-items: center; justify-content: space-between; padding: 0 9px; height: 23px; font-size: 9.5px; border-top: .5px solid var(--s-sep); }
.aos-sd .sd-row:first-child { border-top: 0; }
.aos-sd .sd-row svg { width: 11px; height: 11px; flex: none; }
.aos-sd .sd-hit { background: var(--s-sep); }
/* the share sheet */
.aos-sd .sd-share, .aos-sd .sd-add { position: absolute; left: 0; right: 0; bottom: 0; height: 84%; border-radius: 16px 16px 0 0; background: var(--s-bg); overflow: hidden;
  transform: translateY(102%); transition: transform .45s cubic-bezier(.2,.8,.2,1); box-shadow: 0 -6px 24px rgba(0,0,0,.18); z-index: 3; }
.aos-sd .sd-share.on, .aos-sd .sd-add.on { transform: none; }
.aos-sd .sd-grab { width: 26px; height: 3px; border-radius: 2px; background: var(--s-sep); margin: 5px auto 6px; }
.aos-sd .sd-scroll { transition: transform .9s cubic-bezier(.4,0,.2,1); }
.aos-sd .sd-head { display: flex; align-items: center; gap: 6px; padding: 2px 10px 8px; }
.aos-sd .sd-head img { width: 24px; height: 24px; border-radius: 6px; }
.aos-sd .sd-head b { display: block; font-size: 9.5px; } .aos-sd .sd-head small { display: block; font-size: 8px; color: var(--s-sub); }
.aos-sd .sd-x { margin-left: auto; width: 16px; height: 16px; border-radius: 50%; background: var(--s-sep); font-size: 8px; display: flex; align-items: center; justify-content: center; color: var(--s-sub); }
.aos-sd .sd-apps { display: flex; gap: 8px; padding: 2px 10px 9px; border-bottom: .5px solid var(--s-sep); }
.aos-sd .sd-apps span { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 7px; color: var(--s-sub); }
.aos-sd .sd-apps i { width: 30px; height: 30px; border-radius: 8px; display: block; }
.aos-sd .sd-group { margin: 7px 8px 0; border-radius: 10px; background: var(--s-group); overflow: hidden; }
.aos-sd .sd-group .sd-row { height: 25px; font-size: 9.5px; }
/* Add to Home Screen */
.aos-sd .sd-nav { display: flex; align-items: center; justify-content: space-between; padding: 0 10px; height: 26px; font-size: 9.5px; }
.aos-sd .sd-nav b { font-size: 9.5px; } .aos-sd .sd-nav span { color: var(--s-blue); } .aos-sd .sd-nav .sd-addbtn { font-weight: 700; }
.aos-sd .sd-card { display: flex; gap: 8px; align-items: center; margin: 6px 8px 0; padding: 8px; border-radius: 10px; background: var(--s-group); }
.aos-sd .sd-card img { width: 38px; height: 38px; border-radius: 9px; }
.aos-sd .sd-card b { display: block; font-size: 10px; font-weight: 500; border-bottom: .5px solid var(--s-sep); padding-bottom: 4px; }
.aos-sd .sd-card small { display: block; font-size: 8px; color: var(--s-sub); padding-top: 4px; }
.aos-sd .sd-tog { margin-left: auto; width: 26px; height: 16px; border-radius: 8px; background: var(--s-green); position: relative; flex: none; }
.aos-sd .sd-tog::after { content: ''; position: absolute; right: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.aos-sd .sd-glow { animation: sd-glow 1s ease-in-out 2; }
@keyframes sd-glow { 50% { box-shadow: 0 0 0 4px rgba(52,199,89,.35); } }
.aos-sd .sd-note { font-size: 7.5px; color: var(--s-sub); padding: 4px 12px 0; line-height: 1.3; }
/* the Home Screen */
.aos-sd .sd-home { position: absolute; inset: 0; z-index: 4; padding: 34px 12px 0; background: linear-gradient(160deg, #8DBDB0, #A3B2D4 45%, #D3ABA8 78%, #DCC19A); opacity: 0; transition: opacity .45s; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 8px; align-content: start; }
.aos-sd .sd-home.on { opacity: 1; }
.aos-sd .sd-home span { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 7px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.aos-sd .sd-home i { width: 36px; height: 36px; border-radius: 9px; background: rgba(255,255,255,.35); display: block; }
.aos-sd .sd-home img { width: 36px; height: 36px; border-radius: 9px; transform: scale(0); transition: transform .55s cubic-bezier(.34,1.56,.64,1); box-shadow: 0 3px 8px rgba(0,0,0,.2); }
.aos-sd .sd-home .sd-new img { transform: scale(1); }
.aos-sd .sd-home .sd-lbl { opacity: 0; transition: opacity .3s .3s; } .aos-sd .sd-home .sd-new .sd-lbl { opacity: 1; }
/* the finger */
.aos-sd .sd-finger { position: absolute; z-index: 10; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: rgba(255,255,255,.55); border: 1.5px solid rgba(0,0,0,.25);
  box-shadow: 0 2px 8px rgba(0,0,0,.3); opacity: 0; left: 50%; top: 95%; transition: left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1), opacity .3s, transform .15s; pointer-events: none; }
.aos-sd .sd-finger.on { opacity: 1; }
.aos-sd .sd-finger.press { transform: scale(.78); }
.aos-sd .sd-finger::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(255,255,255,.9); opacity: 0; }
.aos-sd .sd-finger.press::after { animation: sd-ripple .5s ease-out; }
@keyframes sd-ripple { from { opacity: .9; transform: scale(.6); } to { opacity: 0; transform: scale(2); } }
/* the caption under the phone */
.aos-sd .sd-cap { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; min-height: 36px; font-size: 15px; font-weight: 600; text-align: left; line-height: 1.25; transition: opacity .25s; }
.aos-sd .sd-cap.fade { opacity: 0; }
.aos-sd .sd-n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--s-blue); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; }
.aos-sd .sd-dots { display: flex; justify-content: center; gap: 5px; margin-top: 6px; }
.aos-sd .sd-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--s-sep); transition: background .3s, width .3s; }
.aos-sd .sd-dots i.on { background: var(--s-blue); width: 12px; border-radius: 3px; }
.aos-sd .sd-old { margin-top: 6px; font-size: 12px; color: var(--s-sub); text-align: center; }
@media (prefers-reduced-motion: reduce) { .aos-sd * { transition-duration: .15s !important; animation: none !important; } }`;
  const SD_ICON = {
    share: '<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7H3.5v9.5h9V7H11M8 11.5V1.5M5 4.5l3-3 3 3"/></svg>',
    book: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H2zM14 3H9v11a2 2 0 0 1 2-2h3z"/></svg>',
    star: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5l2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.6 3.8 14l1-4.6L1.4 6.3 6 5.8z"/></svg>',
    find: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="9" height="9" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
    glasses: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4.5" cy="10" r="2.5"/><circle cx="11.5" cy="10" r="2.5"/><path d="M7 10h2M2 9l1.5-5M14 9l-1.5-5"/></svg>',
    add: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="3"/><path d="M8 5v6M5 8h6"/></svg>',
    note: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2" width="11" height="12" rx="2"/><path d="M5 6h6M5 9h4"/></svg>',
  };
  const SD_STEPS = ['Tap <b>•••</b>, then <b>Share</b>', 'Scroll down, tap <b>Add to Home Screen</b>', 'Keep <b>Open as Web App</b> on, tap <b>Add</b>', 'It\'s on your Home Screen'];
  function safariDemo(host, name, iconUrl, opts = {}) {   // opts.onDone: once, after the first play-through
    if (!document.getElementById('aos-sd-css')) { const st = document.createElement('style'); st.id = 'aos-sd-css'; st.textContent = SD_CSS; document.head.appendChild(st); }
    const row = (t, k, cls = '') => `<div class="sd-row ${cls}"><span>${t}</span>${SD_ICON[k]}</div>`;
    const dom = location.host || 'tomallison24-news.pages.dev';
    host.innerHTML = `<div class="aos-sd"><div class="sd-phone"><div class="sd-screen"><i class="sd-island"></i>
      <div class="sd-page"><img src="${iconUrl}" alt=""><b>${esc(name)}</b><i></i><i></i><i></i></div>
      <div class="sd-bar"><span class="sd-round">‹</span><span class="sd-addr">${esc(dom)}</span><span class="sd-round sd-more">•••</span></div>
      <div class="sd-menu">${row('Share', 'share', 'sd-t-share')}${row('Add to Bookmarks', 'book')}${row('Add to Favorites', 'star')}${row('Find on Page', 'find')}${row('Reader', 'glasses')}</div>
      <div class="sd-share"><div class="sd-grab"></div><div class="sd-scroll">
        <div class="sd-head"><img src="${iconUrl}" alt=""><span><b>${esc(name)}</b><small>${esc(dom)}</small></span><span class="sd-x">✕</span></div>
        <div class="sd-apps"><span><i style="background:linear-gradient(#5AC8FA,#007AFF)"></i>AirDrop</span><span><i style="background:linear-gradient(#5CE27E,#30B94D)"></i>Messages</span><span><i style="background:linear-gradient(#4FB6FF,#1F7BF2)"></i>Mail</span><span><i style="background:linear-gradient(#FFE16B,#FFC800)"></i>Notes</span></div>
        <div class="sd-group">${row('Copy', 'copy')}${row('Add to Reading List', 'glasses')}${row('Add Bookmark', 'book')}${row('Add to Favorites', 'star')}${row('Add to Quick Note', 'note')}${row('Find on Page', 'find')}${row('Add to Home Screen', 'add', 'sd-t-add')}</div>
      </div></div>
      <div class="sd-add"><div class="sd-grab"></div><div class="sd-nav"><span>Cancel</span><b>Add to Home Screen</b><span class="sd-addbtn">Add</span></div>
        <div class="sd-card"><img src="${iconUrl}" alt=""><span style="flex:1;min-width:0"><b>${esc(name)}</b><small>${esc(dom)}</small></span></div>
        <div class="sd-card" style="padding:7px 9px"><span style="font-size:9.5px">Open as Web App</span><span class="sd-tog"></span></div>
        <div class="sd-note">An icon will be added to your Home Screen so you can quickly access this website.</div></div>
      <div class="sd-home">${'<span><i></i>&nbsp;</span>'.repeat(6)}<span class="sd-slot"><img src="${iconUrl}" alt=""><span class="sd-lbl">${esc(name)}</span></span></div>
      <div class="sd-finger"></div>
    </div></div>
    <div class="sd-cap"><span class="sd-n">1</span><span class="sd-t"></span></div>
    <div class="sd-dots"><i></i><i></i><i></i><i></i></div>
    <div class="sd-old">On older iOS, tap Share in the toolbar first.</div></div>`;
    const R = host.querySelector('.aos-sd'), q = s => R.querySelector(s), scr = q('.sd-screen'), fin = q('.sd-finger');
    const T = [];   // pending timers, cleared when it leaves the page
    const at = (ms, fn) => T.push(setTimeout(() => { if (!R.isConnected) return T.forEach(clearTimeout); fn(); }, still() ? ms * 0.6 : ms));
    const to = sel => { const e = q(sel), a = e.getBoundingClientRect(), s = scr.getBoundingClientRect(); fin.style.left = (a.left - s.left + a.width / 2) + 'px'; fin.style.top = (a.top - s.top + a.height / 2) + 'px'; fin.classList.add('on'); };
    const tap = sel => { const e = q(sel); fin.classList.add('press'); e.classList.add('sd-hit'); setTimeout(() => { fin.classList.remove('press'); e.classList.remove('sd-hit'); }, 260); };
    const cap = n => { const c = q('.sd-cap'); c.classList.add('fade'); setTimeout(() => { q('.sd-n').textContent = n + 1; q('.sd-t').innerHTML = SD_STEPS[n]; c.classList.remove('fade'); }, 200); R.querySelectorAll('.sd-dots i').forEach((d, k) => d.classList.toggle('on', k === n)); };
    function loop() {
      if (!R.isConnected) return;
      for (const s of ['.sd-menu', '.sd-share', '.sd-add', '.sd-home', '.sd-slot']) q(s).classList.remove('on', 'sd-new');
      q('.sd-scroll').style.transform = ''; q('.sd-tog').classList.remove('sd-glow');
      fin.classList.remove('on'); fin.style.left = '50%'; fin.style.top = '96%';
      cap(0);
      at(500, () => to('.sd-more')); at(1200, () => tap('.sd-more')); at(1350, () => q('.sd-menu').classList.add('on'));
      at(2100, () => to('.sd-t-share')); at(2700, () => tap('.sd-t-share'));
      at(2900, () => { q('.sd-menu').classList.remove('on'); q('.sd-share').classList.add('on'); fin.classList.remove('on'); cap(1); });
      at(3800, () => { const g = q('.sd-share'), add = q('.sd-t-add'); const over = add.getBoundingClientRect().bottom - g.getBoundingClientRect().bottom + 30; if (over > 0) q('.sd-scroll').style.transform = `translateY(${-over}px)`; });
      at(4900, () => to('.sd-t-add')); at(5500, () => tap('.sd-t-add'));
      at(5700, () => { q('.sd-share').classList.remove('on'); q('.sd-add').classList.add('on'); fin.classList.remove('on'); cap(2); });
      at(6500, () => { to('.sd-tog'); q('.sd-tog').classList.add('sd-glow'); });
      at(7600, () => to('.sd-addbtn')); at(8200, () => tap('.sd-addbtn'));
      at(8400, () => { q('.sd-add').classList.remove('on'); q('.sd-home').classList.add('on'); fin.classList.remove('on'); cap(3); });
      at(8900, () => q('.sd-slot').classList.add('sd-new'));
      at(10000, () => { if (!played++ && opts.onDone) opts.onDone(); });
      at(11500, loop);
    }
    let played = 0;
    loop();
  }

  // ---- the AllisonOS tour ----
  const OS_TOUR = () => [
    { noart: true, t: 'Everything in one place', d: 'The core apps, Weather, Notes, News, Mail, Calendar and Clock, and the Allison family\'s own, Podcasts, Travel, Places, Fitness, Drinks, Meals, Orders and Home, all in aOS. And they work together for continuity: your trips, reminders and notes show up in Calendar, a booking opens its email, and Home knows the weather.' },
    { i: 'refresh', t: 'Always up to date', d: 'Updates are pushed automatically, so you always have the latest of everything at your fingertips.' },
    { i: 'sliders', t: 'Made to work for you', d: 'Absolute personalization: add just the apps you want, choose light or dark in each, and set every app up your way, from your places to your favorites.' },
    { x: 'theme', noart: true, t: 'Light or dark', d: 'Follow your iPhone, or keep aOS always light or always dark. Each app asks too, the first time it opens.' },
    { i: 'lock', t: 'Yours alone', d: 'What you set up stays on this phone.' },
    ...(!ios && !standalone() ? [{ x: 'install', noart: true, t: 'Add aOS to this device', name: 'aOS', icon: icon('aos') }] : []),   // iPhone: Safari showed how already
    { i: 'grid', t: 'Choose your apps', d: 'Every AllisonOS app is here. Tap one: it opens in Safari, ready to add to your Home Screen, and shows you around once it is there.' },
  ];

  // ---- line drawings, 64 x 64 ----
  const LINE = {
    sun: '<circle cx="32" cy="32" r="11"/><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/>',
    cloud: '<path d="M20 46h26a10 10 0 0 0 0-20 14 14 0 0 0-27-2 11 11 0 0 0 1 22z"/>',
    rain: '<path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-2 11 11 0 0 0 1 22z"/><path d="M24 46l-3 8M34 46l-3 8M44 46l-3 8"/>',
    radar: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="14"/><path d="M32 32l17-17"/><circle cx="40" cy="26" r="2.5" fill="currentColor"/>',
    alert: '<path d="M32 8l26 46H6z"/><path d="M32 26v13"/><circle cx="32" cy="46" r="1.8" fill="currentColor"/>',
    bell: '<path d="M18 44V30a14 14 0 0 1 28 0v14l4 4H14z"/><path d="M27 52a5 5 0 0 0 10 0"/>',
    calendar: '<rect x="8" y="12" width="48" height="44" rx="8"/><path d="M8 24h48M20 6v12M44 6v12"/><circle cx="22" cy="36" r="2" fill="currentColor"/><circle cx="32" cy="36" r="2" fill="currentColor"/><circle cx="42" cy="36" r="2" fill="currentColor"/>',
    clock: '<circle cx="32" cy="32" r="24"/><path d="M32 18v15l10 6"/>',
    tag: '<path d="M8 12v18l26 26 22-22L30 8H12a4 4 0 0 0-4 4z"/><circle cx="21" cy="21" r="4"/>',
    search: '<circle cx="28" cy="28" r="17"/><path d="M41 41l15 15"/>',
    pin: '<path d="M32 58s18-18 18-32a18 18 0 0 0-36 0c0 14 18 32 18 32z"/><circle cx="32" cy="26" r="6"/>',
    map: '<path d="M6 14l16-6 20 8 16-6v40l-16 6-20-8-16 6z"/><path d="M22 8v40M42 16v40"/>',
    plane: '<path d="M30 8c2-2 6 0 6 4v14l20 12v6l-20-6v12l6 5v4l-10-3-10 3v-4l6-5V38L8 44v-6l20-12V12c0-2 1-3 2-4z"/>',
    bed: '<path d="M6 48V16M6 38h52v10M58 38V30a8 8 0 0 0-8-8H28v16"/><circle cx="16" cy="30" r="5"/>',
    car: '<path d="M10 40l5-16a6 6 0 0 1 6-4h22a6 6 0 0 1 6 4l5 16v10H10z"/><circle cx="20" cy="42" r="3"/><circle cx="44" cy="42" r="3"/><path d="M10 50v5M54 50v5"/>',
    dumbbell: '<path d="M18 22v20M46 22v20M10 27v10M54 27v10M18 32h28"/>',
    list: '<path d="M22 16h32M22 32h32M22 48h32"/><circle cx="11" cy="16" r="2.5" fill="currentColor"/><circle cx="11" cy="32" r="2.5" fill="currentColor"/><circle cx="11" cy="48" r="2.5" fill="currentColor"/>',
    check: '<circle cx="32" cy="32" r="24"/><path d="M21 33l8 8 15-17"/>',
    mic: '<rect x="23" y="6" width="18" height="32" rx="9"/><path d="M14 30a18 18 0 0 0 36 0M32 48v10M24 58h16"/>',
    play: '<circle cx="32" cy="32" r="24"/><path d="M27 21l16 11-16 11z"/>',
    inbox: '<path d="M8 36l8-24h32l8 24v16a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"/><path d="M8 36h14l4 7h12l4-7h14"/>',
    box: '<path d="M8 20L32 8l24 12v24L32 56 8 44z"/><path d="M8 20l24 12 24-12M32 32v24"/>',
    truck: '<path d="M6 16h30v28H6z"/><path d="M36 26h12l10 10v8H36z"/><circle cx="18" cy="48" r="5"/><circle cx="46" cy="48" r="5"/>',
    star: '<path d="M32 7l7.5 16 17.5 2-13 12 3.5 17L32 45.5 16.5 54 20 37 7 25l17.5-2z"/>',
    house: '<path d="M8 30L32 10l24 20"/><path d="M14 26v30h36V26"/><path d="M27 56V40h10v16"/>',
    bulb: '<path d="M24 44c0-6-8-10-8-20a16 16 0 0 1 32 0c0 10-8 14-8 20z"/><path d="M24 50h16M27 56h10"/>',
    thermo: '<path d="M26 38V12a6 6 0 0 1 12 0v26a11 11 0 1 1-12 0z"/><path d="M32 22v24"/>',
    shield: '<path d="M32 6l22 8v16c0 14-10 24-22 28C20 54 10 44 10 30V14z"/><path d="M23 32l7 7 12-13"/>',
    camera: '<rect x="6" y="18" width="38" height="30" rx="7"/><path d="M44 28l14-8v26l-14-8"/>',
    bolt: '<path d="M36 6L14 36h16l-4 22 24-32H34z"/>',
    chart: '<path d="M8 56h48"/><path d="M16 46V32M28 46V20M40 46V28M52 46V12"/>',
    note: '<path d="M14 6h28l10 10v42H14z"/><path d="M42 6v10h10M22 28h22M22 38h22M22 48h14"/>',
    sparkle: '<path d="M32 6l5 17 17 5-17 5-5 17-5-17-17-5 17-5z"/><path d="M52 44l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    people: '<circle cx="22" cy="22" r="9"/><circle cx="44" cy="24" r="7"/><path d="M6 54a16 16 0 0 1 32 0M36 54a12 12 0 0 1 22-7"/>',
    globe: '<circle cx="32" cy="32" r="24"/><path d="M8 32h48M32 8c-8 8-8 40 0 48M32 8c8 8 8 40 0 48"/>',
    heart: '<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/>',
    lock: '<rect x="14" y="28" width="36" height="28" rx="6"/><path d="M22 28v-8a10 10 0 0 1 20 0v8"/><circle cx="32" cy="42" r="3" fill="currentColor"/>',
    swipe: '<rect x="18" y="4" width="28" height="56" rx="7"/><path d="M26 52h12"/><path d="M32 40V18M24 26l8-8 8 8"/>',
    grid: '<rect x="8" y="8" width="18" height="18" rx="5"/><rect x="38" y="8" width="18" height="18" rx="5"/><rect x="8" y="38" width="18" height="18" rx="5"/><rect x="38" y="38" width="18" height="18" rx="5"/>',
    refresh: '<path d="M50 30a18 18 0 0 1-31 13"/><path d="M14 34a18 18 0 0 1 31-13"/><path d="M45 11v10H35"/><path d="M19 53V43h10"/>',
    sliders: '<path d="M10 18h7M27 18h27M10 32h27M47 32h7M10 46h13M33 46h21"/><circle cx="22" cy="18" r="5"/><circle cx="42" cy="32" r="5"/><circle cx="28" cy="46" r="5"/>',
    moon: '<circle cx="32" cy="32" r="22"/><path d="M32 10a22 22 0 0 1 0 44z" fill="currentColor"/>',
    share: '<path d="M22 22h-8v34h36V22h-8"/><path d="M32 40V6M23 15l9-9 9 9"/>',
    plus: '<rect x="12" y="12" width="40" height="40" rx="11"/><path d="M32 23v18M23 32h18"/>',
  };
  const lineSvg = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k] || LINE.sparkle}</svg>`;
  const url = p => new URL(p, BASE).href;
  const DIR = id => id === 'aos' ? 'aOS' : id;   // aOS lives at /aOS/
  const icon = id => url(`../${DIR(id)}/icon-512.png`);
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor"/></svg>';

  const CSS = `
#aos-welcome { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  --w-bg: #0D1213; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  --w-pastel: linear-gradient(100deg, #A9D3C7 0%, #B9C6E0 34%, #E3C5C3 67%, #E9D6B4 100%); --w-glow: rgba(185,198,224,.5);
  --w-hot: linear-gradient(120deg, #86CBB8 0%, #A3B4E4 55%, #E2B0AB 100%); --w-hot-glow: rgba(163,180,228,.75); --w-hot-glow2: rgba(226,176,171,.8);
  background: var(--w-bg); color: var(--w-text); opacity: 0; transition: opacity .5s; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) #aos-welcome { --w-bg: #EEF2F0; --w-text: #0B0B0F; --w-muted: rgba(16,24,26,.64); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6FA597 0%, #8193BC 34%, #BE918F 67%, #BC9C68 100%); --w-glow: rgba(129,147,188,.32);
  --w-hot: linear-gradient(120deg, #4F9583 0%, #6A80BC 55%, #B17C78 100%); --w-hot-glow: rgba(106,128,188,.5); --w-hot-glow2: rgba(177,124,120,.55); } }
html[data-theme="light"] #aos-welcome { --w-bg: #EEF2F0; --w-text: #0B0B0F; --w-muted: rgba(16,24,26,.64); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6FA597 0%, #8193BC 34%, #BE918F 67%, #BC9C68 100%); --w-glow: rgba(129,147,188,.32);
  --w-hot: linear-gradient(120deg, #4F9583 0%, #6A80BC 55%, #B17C78 100%); --w-hot-glow: rgba(106,128,188,.5); --w-hot-glow2: rgba(177,124,120,.55); }
html[data-theme="dark"] #aos-welcome { --w-bg: #0D1213; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  --w-pastel: linear-gradient(100deg, #A9D3C7 0%, #B9C6E0 34%, #E3C5C3 67%, #E9D6B4 100%); --w-glow: rgba(185,198,224,.5);
  --w-hot: linear-gradient(120deg, #86CBB8 0%, #A3B4E4 55%, #E2B0AB 100%); --w-hot-glow: rgba(163,180,228,.75); --w-hot-glow2: rgba(226,176,171,.8); }
#aos-welcome.in { opacity: 1; }
#aos-welcome.out { opacity: 0; transition: opacity .6s; }
#aos-welcome * { box-sizing: border-box; }
#aos-welcome button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
#aos-welcome .w-skip { position: absolute; top: calc(env(safe-area-inset-top) + 14px); right: 18px; z-index: 5; font-size: 15px; font-weight: 600; color: var(--w-muted); padding: 8px 10px; }
#aos-welcome .w-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
#aos-welcome .c-brand { display: flex; flex-direction: column; align-items: center; transition: transform .9s cubic-bezier(.2,.8,.2,1), opacity .5s; }
/* the name: pastel ink drawn on left to right; each letter carries its slice of one gradient */
#aos-welcome .c-word { display: flex; font-size: 46px; font-weight: 700; letter-spacing: -1px; line-height: 1.15; padding: 0 2px; perspective: 600px;
  clip-path: inset(0 100% 0 0); transition: clip-path 1.6s cubic-bezier(.65,0,.35,1); }
#aos-welcome .c-word.on { clip-path: inset(-20px -20px -20px -20px); }
#aos-welcome .c-word { position: relative; transform-origin: 50% 50%; transition: clip-path 1.6s cubic-bezier(.65,0,.35,1), transform .95s cubic-bezier(.4,0,.2,1); }
#aos-welcome .c-word > span, #aos-welcome .c-word .g { display: inline-block; background: var(--w-pastel); background-size: var(--sw, 100%) 100%; background-position: var(--sx, 0) 0;
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  transition: transform .5s cubic-bezier(.5,0,.75,0), opacity .5s, max-width .9s cubic-bezier(.45,0,.25,1), background-size .9s cubic-bezier(.45,0,.25,1), background-position .9s cubic-bezier(.45,0,.25,1); }
#aos-welcome .c-word > span { overflow: hidden; }
/* the A of AllisonOS holds an A and an a; as the letters fold away it melts from one into the other */
#aos-welcome .c-word > span.L-A { position: relative; background: none; overflow: visible; }
#aos-welcome .c-word .g-a { position: absolute; left: 0; bottom: 0; opacity: 0; transform-origin: 50% 100%; transform: scale(1, 1.38); filter: blur(3px); }
#aos-welcome .c-word .g-A { transform-origin: 50% 100%; }
#aos-welcome .c-word .g-A, #aos-welcome .c-word .g-a { transition: opacity .8s cubic-bezier(.45,0,.25,1), transform .9s cubic-bezier(.45,0,.25,1), filter .8s, background-size .9s cubic-bezier(.45,0,.25,1), background-position .9s cubic-bezier(.45,0,.25,1); }
#aos-welcome .c-word .L-A.to-a .g-A { opacity: 0; transform: scale(.82, .72); filter: blur(3px); }
#aos-welcome .c-word .L-A.to-a .g-a { opacity: 1; transform: none; filter: none; }
#aos-welcome .c-word > span.fold { transform: scale(.55); transition: opacity .9s cubic-bezier(.6,0,.9,.4), transform .9s cubic-bezier(.45,0,.25,1), max-width .9s cubic-bezier(.45,0,.25,1); }   /* still faintly there as it narrows, so no gap opens */
/* the version, hung on the word once it is aOS: drops in, rings, twinkles; then a shine runs across */
#aos-welcome .w-sup { position: absolute; left: 100%; top: -.12em; margin-left: .04em; font-size: .5em; letter-spacing: 0; background: var(--w-pastel); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px var(--w-glow)); opacity: 0; transform: translateY(-1.1em) scale(1.7); transition: opacity .25s, transform .75s cubic-bezier(.34,1.56,.64,1); }
#aos-welcome .c-word.marked .w-sup { opacity: 1; transform: none; }
#aos-welcome .w-ring { position: absolute; left: calc(100% - .2em); top: -.42em; width: .95em; height: .95em; border-radius: 50%; border: 1.5px solid var(--w-glow); opacity: 0; transform: scale(.3); }
#aos-welcome .c-word.marked .w-ring { animation: v-ring 1.1s cubic-bezier(.2,.8,.2,1) .45s forwards; }
#aos-welcome .w-star { position: absolute; width: .18em; height: .18em; color: var(--w-text); opacity: 0; }
#aos-welcome .w-star svg { width: 100%; height: 100%; display: block; }
#aos-welcome .c-word.marked .w-star { animation: v-twinkle 2.6s ease-in-out infinite; }
#aos-welcome .w-star:nth-of-type(1) { left: calc(100% + .42em); top: -.5em; animation-delay: .7s !important; }
#aos-welcome .w-star:nth-of-type(2) { left: calc(100% - .02em); top: -.72em; width: .12em; height: .12em; animation-delay: 1.3s !important; }
#aos-welcome .w-star:nth-of-type(3) { left: calc(100% + .6em); top: .02em; width: .13em; height: .13em; animation-delay: 1.9s !important; }
#aos-welcome .w-star:nth-of-type(4) { left: -.3em; bottom: -.06em; width: .1em; height: .1em; animation-delay: 2.4s !important; }
#aos-welcome .c-word.shine > span:not(.fold):not(.L-A), #aos-welcome .c-word.shine .g-a { background-image: linear-gradient(110deg, transparent 0 38%, rgba(255,255,255,.95) 48%, transparent 58% 100%), var(--w-pastel);
  background-size: var(--bw) 100%, var(--sw) 100%; background-position: var(--b0) 0, var(--sx) 0; animation: w-shine 3.2s cubic-bezier(.45,0,.2,1) .2s infinite; }
@keyframes w-shine { 0% { background-position: var(--b0) 0, var(--sx) 0; } 45%, 100% { background-position: var(--b1) 0, var(--sx) 0; } }
#aos-welcome .m-power { position: absolute; left: 0; right: 0; text-align: center; font-size: 15px; font-weight: 600; letter-spacing: .06em; color: var(--w-muted);
  opacity: 0; transition: opacity .8s, top .9s cubic-bezier(.2,.8,.2,1), transform .9s cubic-bezier(.2,.8,.2,1); pointer-events: none; }
#aos-welcome .m-power.on { opacity: 1; }
/* the aOS intro, a touch slower (PACE in the script): its drawing, folding, growing and dropping */
#aos-welcome.slow .c-word { transition: clip-path 2s cubic-bezier(.65,0,.35,1), transform 1.2s cubic-bezier(.4,0,.2,1); }
#aos-welcome.slow .c-rule { transition-duration: 1.75s; transition-delay: .6s; }
#aos-welcome.slow .c-sub, #aos-welcome.slow .c-corp { transition-duration: 1s; }
#aos-welcome.slow .c-word > span, #aos-welcome.slow .c-word .g { transition-duration: .62s, .62s, 1.12s, 1.12s, 1.12s; }
#aos-welcome.slow .c-word > span.fold { transition-duration: 1.12s, 1.12s, 1.12s; }
#aos-welcome.slow .c-word .g-A, #aos-welcome.slow .c-word .g-a { transition-duration: 1s, 1.12s, 1s, 1.12s, 1.12s; }
#aos-welcome.slow .w-sup { transition-duration: .3s, .95s; }
#aos-welcome.slow .m-power { transition-duration: 1s, 1.12s, 1.12s; }
#aos-welcome.slow .c-fly img { transition-duration: .7s, .5s, 1.12s, 1.12s, 1.12s, 1.12s; }
#aos-welcome .m-power sup { font-size: .75em; letter-spacing: 0; }
#aos-welcome .c-word span.flip { transform: rotateY(90deg) scale(.7); opacity: 0; }
#aos-welcome .c-word span.fold { max-width: 0 !important; opacity: 0; }
#aos-welcome .c-rule { height: 1.5px; width: 0; border-radius: 1px; background: var(--w-pastel); opacity: .8; margin-top: 14px; transition: width 1.4s cubic-bezier(.65,0,.35,1) .5s; }
#aos-welcome .c-rule.on { width: 220px; }
#aos-welcome .c-sub { margin-top: 14px; font-size: 17px; font-weight: 500; opacity: 0; transition: opacity .8s; }
#aos-welcome .c-corp { margin-top: 6px; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--w-muted); opacity: 0; transition: opacity .8s .35s; }
#aos-welcome .c-sub.on, #aos-welcome .c-corp.on { opacity: 1; }
#aos-welcome .c-fade { transition: opacity .45s !important; transition-delay: 0s !important; opacity: 0 !important; }
/* the version mark: aOS and a superscript version that drops in, glows and shines */
#aos-welcome .v-wrap { position: absolute; left: 0; right: 0; top: 50%; display: flex; flex-direction: column; align-items: center; transform: translateY(-50%); pointer-events: none;
  transition: top .9s cubic-bezier(.2,.8,.2,1), transform .9s cubic-bezier(.2,.8,.2,1), opacity .5s; }
#aos-welcome .v-mark { position: relative; font-size: 78px; font-weight: 800; letter-spacing: -2.5px; line-height: 1; opacity: 0; transform: scale(.86); transition: opacity .5s, transform .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .v-mark.on { opacity: 1; transform: none; }
#aos-welcome .v-ink { background: linear-gradient(110deg, transparent 0 38%, rgba(255,255,255,.95) 48%, transparent 58% 100%), var(--w-pastel); background-size: 260% 100%, 100% 100%; background-position: 130% 0, 0 0;
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; animation: v-shine 3.2s cubic-bezier(.45,0,.2,1) 1.4s infinite; }
@keyframes v-shine { 0% { background-position: 130% 0, 0 0; } 45%, 100% { background-position: -30% 0, 0 0; } }
#aos-welcome .v-mark sup { position: relative; display: inline-block; font-size: .5em; letter-spacing: 0; margin-left: 2px; vertical-align: 0; top: -.78em; filter: drop-shadow(0 0 14px var(--w-glow));
  opacity: 0; transform: translateY(-46px) scale(1.7); transition: opacity .25s, transform .75s cubic-bezier(.34,1.56,.64,1); }
#aos-welcome .v-mark.drop sup { opacity: 1; transform: none; }
#aos-welcome .v-ring { position: absolute; width: 70px; height: 70px; right: -26px; top: -30px; border-radius: 50%; border: 2px solid var(--w-glow); opacity: 0; transform: scale(.3); }
#aos-welcome .v-mark.drop .v-ring { animation: v-ring 1.1s cubic-bezier(.2,.8,.2,1) .45s forwards; }
@keyframes v-ring { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(1.9); } }
#aos-welcome .v-star { position: absolute; width: 14px; height: 14px; color: var(--w-text); opacity: 0; }
#aos-welcome .v-star svg { width: 100%; height: 100%; display: block; }
#aos-welcome .v-mark.drop .v-star { animation: v-twinkle 2.6s ease-in-out infinite; }
#aos-welcome .v-star:nth-of-type(1) { right: -30px; top: -34px; animation-delay: .7s !important; }
#aos-welcome .v-star:nth-of-type(2) { right: 4px; top: -52px; width: 9px; height: 9px; animation-delay: 1.3s !important; }
#aos-welcome .v-star:nth-of-type(3) { right: -44px; top: 2px; width: 10px; height: 10px; animation-delay: 1.9s !important; }
#aos-welcome .v-star:nth-of-type(4) { left: -18px; bottom: -6px; width: 8px; height: 8px; animation-delay: 2.4s !important; }
@keyframes v-twinkle { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 18% { opacity: .95; transform: scale(1) rotate(45deg); } 40% { opacity: 0; transform: scale(.4) rotate(90deg); } }
/* a minor update: the new .x rises in after the major number and lights up */
#aos-welcome .v-mark.minor .v-ring { animation: none; right: auto; left: calc(var(--rx, 100%) - 35px); }
#aos-welcome .v-mark.minor.grow .v-ring { animation: v-ring 1.1s cubic-bezier(.2,.8,.2,1) .75s forwards; }
#aos-welcome .v-app { margin-top: 30px; font-size: 64px; }   /* an app's update: aOS and the new number under its icon */
#aos-welcome .v-app .v-ring { top: -22px; }
#aos-welcome .v-tail { display: inline-block; position: relative; white-space: nowrap; }
#aos-welcome .v-old, #aos-welcome .v-new { display: inline-block; vertical-align: baseline; transition: width .55s cubic-bezier(.2,.8,.2,1), opacity .3s, transform .45s cubic-bezier(.4,0,.2,1); }
#aos-welcome .v-new { position: relative; width: 0; }
#aos-welcome .v-new::after { content: ''; position: absolute; left: .08em; right: -.02em; bottom: -.12em; height: .12em; border-radius: 999px; transform: scaleX(0); transform-origin: left;
  background: var(--w-hot); box-shadow: 0 0 10px var(--w-hot-glow); transition: transform .6s cubic-bezier(.2,.8,.2,1) .95s; }
#aos-welcome .v-mark.grow .v-new::after { transform: none; }
#aos-welcome .v-mark.grow .v-old { opacity: 0; transform: translateY(-.55em) scale(.7); }
#aos-welcome .v-new i { display: inline-block; font-style: normal; opacity: 0; transform: translateY(.75em) scale(.35); filter: blur(5px);
  background: var(--w-hot); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  transition: opacity .3s, transform .7s cubic-bezier(.34,1.7,.5,1), filter .5s; }
#aos-welcome .v-mark.grow .v-new i { opacity: 1; transform: none; filter: drop-shadow(0 0 10px var(--w-hot-glow)); }
#aos-welcome .v-mark.grow .v-new i:nth-child(1) { transition-delay: .3s; }
#aos-welcome .v-mark.grow .v-new i:nth-child(2) { transition-delay: .42s; }
#aos-welcome .v-mark.grow .v-new i:nth-child(3) { transition-delay: .54s; }
#aos-welcome .v-mark.lit .v-new i { animation: v-hot 2.4s ease-in-out infinite; }
@keyframes v-hot { 0%, 100% { filter: drop-shadow(0 0 5px var(--w-hot-glow)); } 50% { filter: drop-shadow(0 0 13px var(--w-hot-glow2)); } }
#aos-welcome .v-halo { position: absolute; left: 50%; top: 55%; width: 2.6em; height: 1.6em; margin: -.8em 0 0 -1.3em; border-radius: 50%; z-index: -1; pointer-events: none;
  background: radial-gradient(closest-side, var(--w-hot-glow), var(--w-hot-glow2) 55%, transparent); filter: blur(6px); opacity: 0; transform: scale(.2); }
#aos-welcome .v-mark.grow .v-halo { animation: v-halo 1.6s cubic-bezier(.2,.8,.2,1) .45s forwards; }
@keyframes v-halo { 0% { opacity: 0; transform: scale(.2); } 35% { opacity: 1; transform: scale(1.35); } 100% { opacity: .55; transform: scale(1); } }
#aos-welcome .c-body h2 sup { white-space: nowrap; }
#aos-welcome .h-new { display: inline-block; background: var(--w-hot); -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent; animation: h-new .8s cubic-bezier(.34,1.7,.5,1) .35s both; }
@keyframes h-new { 0% { opacity: 0; transform: translateY(.5em) scale(.4); } 100% { opacity: 1; transform: none; } }
#aos-welcome .v-power { margin-top: 18px; font-size: 15px; font-weight: 600; letter-spacing: .06em; color: var(--w-muted); opacity: 0; transition: opacity .8s; }
#aos-welcome .v-power.on { opacity: 1; }
#aos-welcome .v-power sup { font-size: .75em; letter-spacing: 0; }
#aos-welcome.parked .v-wrap { transform: translateY(-50%) scale(.56); }
/* the app icons: bursting out of the mark (aOS) or the letters (the name), into a grid */
#aos-welcome .c-fly { position: absolute; inset: 0; pointer-events: none; perspective: 700px; transition: opacity .4s; }
#aos-welcome .c-fly img { position: absolute; border-radius: 24%; box-shadow: 0 6px 18px rgba(0,0,0,.22); opacity: 0; transform: rotateY(-90deg) scale(.7);
  transition: transform .55s cubic-bezier(.25,1,.5,1), opacity .4s, left .9s cubic-bezier(.2,.8,.2,1), top .9s cubic-bezier(.2,.8,.2,1), width .9s cubic-bezier(.2,.8,.2,1), height .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-fly img.on { opacity: 1; transform: none; }
#aos-welcome.tall .c-fly, #aos-welcome.tall .v-wrap, #aos-welcome.tall .a-head, #aos-welcome.tall .c-brand, #aos-welcome.tall .m-power { opacity: 0; }   /* tall cards need the room */
/* an app's own walkthrough: its icon and name */
#aos-welcome .a-head { display: flex; flex-direction: column; align-items: center; transition: transform .9s cubic-bezier(.2,.8,.2,1), opacity .5s; }
#aos-welcome .a-icon { width: 96px; height: 96px; border-radius: 24%; box-shadow: 0 18px 40px -12px rgba(0,0,0,.4); opacity: 0; transform: scale(.6); filter: blur(10px);
  transition: opacity .8s, transform 1s cubic-bezier(.2,.8,.2,1), filter 1s; margin-bottom: 20px; }
#aos-welcome .a-icon.on { opacity: 1; transform: none; filter: none; }
#aos-welcome .a-by { margin-top: 10px; font-size: 15px; font-weight: 700; letter-spacing: .02em; color: var(--w-muted); opacity: 0; transition: opacity .8s; }
#aos-welcome .a-by.on { opacity: 1; }
#aos-welcome .a-by sup { font-size: .75em; letter-spacing: 0; }
#aos-welcome .a-tag { margin-top: 8px; font-size: 16px; opacity: 0; transition: opacity .8s .2s; }
#aos-welcome .a-tag.on { opacity: 1; }
#aos-welcome.parked .a-head { transform: translateY(-28vh) scale(.82); }
/* the glass panel */
#aos-welcome .c-panel { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom) + 16px); max-width: 520px; margin: 0 auto; border-radius: 34px; padding: 28px 24px 22px; text-align: center;
  background: var(--w-glass); -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
  box-shadow: inset 0 0 0 .5px var(--w-edge), 0 24px 60px -16px rgba(0,0,0,.3); opacity: 0; transform: translateY(24px); transition: opacity .6s, transform .7s cubic-bezier(.2,.8,.2,1); touch-action: pan-y; }
#aos-welcome .c-panel.on { opacity: 1; transform: none; }
#aos-welcome .c-body { transition: opacity .3s; }
#aos-welcome .c-body.fade { opacity: 0; }
#aos-welcome .c-art svg { width: 64px; height: 64px; display: block; margin: 0 auto 16px; }
#aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dasharray: 260; stroke-dashoffset: 260; animation: c-draw 1.4s cubic-bezier(.65,0,.35,1) forwards; }
@keyframes c-draw { to { stroke-dashoffset: 0; } }
#aos-welcome h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
#aos-welcome h2 sup { font-size: .55em; }
#aos-welcome p { margin: 8px 0 0; font-size: 16px; line-height: 1.4; color: var(--w-muted); }
#aos-welcome .c-steps { text-align: left; margin: 14px 0 0; padding: 0; list-style: none; counter-reset: s; }
#aos-welcome .c-steps li { position: relative; padding: 0 0 10px 36px; font-size: 15px; line-height: 1.35; counter-increment: s; }
#aos-welcome .c-steps li::before { content: counter(s); position: absolute; left: 0; top: -1px; width: 24px; height: 24px; border-radius: 50%; background: var(--w-dot); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
#aos-welcome .c-steps small { color: var(--w-muted); font-size: 13px; }
#aos-welcome .c-share { display: inline-block; width: 12px; height: 14px; vertical-align: -2px; }
#aos-welcome .c-tip { font-size: 13px !important; margin-top: 4px !important; }
#aos-welcome .c-seg { display: flex; margin: 16px auto 0; max-width: 300px; padding: 3px; border-radius: 999px; background: var(--w-dot); }
#aos-welcome .c-seg button { flex: 1; height: 36px; border-radius: 999px; font-size: 15px; font-weight: 600; transition: background .25s, box-shadow .25s; }
#aos-welcome .c-looks { display: grid; gap: 10px; margin: 16px auto 0; max-width: 320px; }
#aos-welcome .c-look { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px 10px 10px; border-radius: 18px; text-align: left; background: var(--w-dot); box-shadow: inset 0 0 0 2px transparent; transition: box-shadow .25s; }
#aos-welcome .c-look[aria-selected="true"] { box-shadow: inset 0 0 0 2px var(--w-text); }
#aos-welcome .c-look b { display: block; font-size: 17px; font-weight: 700; } #aos-welcome .c-look small { display: block; font-size: 13.5px; color: var(--w-muted); }
#aos-welcome .c-sw { position: relative; flex: 0 0 44px; height: 56px; border-radius: 12px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--w-edge); }
#aos-welcome .c-sw.vintage { background: #F4ECDD; } #aos-welcome .c-sw.vintage::after { content: ''; position: absolute; right: -12px; top: -12px; width: 30px; height: 30px; border-radius: 50%; background: #E3A72F; }
#aos-welcome .c-sw.glass { background: radial-gradient(60% 40% at 20% 10%, rgba(169,211,199,.95), transparent 70%), radial-gradient(60% 40% at 90% 60%, rgba(185,198,224,.95), transparent 70%), #EEF2F0; }
#aos-welcome .c-seg button[aria-pressed="true"] { background: var(--w-bg); box-shadow: 0 2px 8px rgba(0,0,0,.18), inset 0 0 0 .5px var(--w-edge); }
#aos-welcome .c-via { margin: 10px 0 8px; font-size: 13px; line-height: 1.4; color: var(--w-muted); }
#aos-welcome .c-link { display: block; margin-top: 16px; height: 48px; line-height: 48px; border-radius: 999px; font-size: 16px; font-weight: 600; text-decoration: none; color: var(--w-text); background: var(--w-dot); }
#aos-welcome .c-notes { text-align: left; margin: 14px 0 0; padding: 0; list-style: none; }
#aos-welcome .c-notes li { position: relative; padding: 0 0 9px 22px; font-size: 15px; line-height: 1.35; }
#aos-welcome .c-notes li::before { content: ''; position: absolute; left: 4px; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--w-pastel); }
#aos-welcome .c-sd { margin-top: 12px; }
#aos-welcome .c-install { display: block; width: 100%; margin-top: 16px; }
#aos-welcome .w-dots { display: flex; justify-content: center; gap: 7px; margin: 18px 0; }
#aos-welcome .w-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--w-dot); transition: background .3s, width .3s; }
#aos-welcome .w-dots i.on { background: var(--w-text); width: 18px; border-radius: 4px; }
#aos-welcome .w-dots:empty { display: none; }
#aos-welcome .c-btns { display: flex; gap: 10px; }
#aos-welcome .w-btn { flex: 1; height: 52px; border-radius: 17px; font-size: 17px; font-weight: 700; color: #10181A !important; background: var(--w-pastel) !important; box-shadow: inset 0 1px 1px rgba(255,255,255,.45); }
#aos-welcome .w-btn:active { filter: brightness(.94); }
#aos-welcome .c-back { flex: 0 0 52px; height: 52px; border-radius: 17px; background: var(--w-dot) !important; font-size: 22px; }
#aos-welcome .c-back[hidden], #aos-welcome .w-btn[hidden] { display: none; }
/* the live tour: the welcome clears to the app itself, and a spotlight moves from control to control */
#aos-welcome { --s-dim: rgba(5,9,10,.7); --s-card: rgba(24,30,32,.86); --s-ease: cubic-bezier(.2,.8,.2,1); }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) #aos-welcome { --s-dim: rgba(14,22,24,.56); --s-card: rgba(255,255,255,.9); } }
html[data-theme="light"] #aos-welcome { --s-dim: rgba(14,22,24,.56); --s-card: rgba(255,255,255,.9); }
html[data-theme="dark"] #aos-welcome { --s-dim: rgba(5,9,10,.7); --s-card: rgba(24,30,32,.86); }
#aos-welcome.spot { background: transparent; transition: opacity .5s, background-color .8s; }
#aos-welcome.spot .w-skip { color: var(--w-text); padding: 9px 15px; border-radius: 999px; background: var(--s-card); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); box-shadow: inset 0 0 0 .5px var(--w-edge), 0 6px 18px -6px rgba(0,0,0,.35); }
#aos-welcome.spot .w-stage, #aos-welcome.spot .c-panel, #aos-welcome.spot .c-fly { opacity: 0 !important; pointer-events: none; transition: opacity .5s; }
#aos-welcome .s-hole { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 0; pointer-events: none; opacity: 0;
  box-shadow: 0 0 0 200vmax var(--s-dim); transition: left .6s var(--s-ease), top .6s var(--s-ease), width .6s var(--s-ease), height .6s var(--s-ease), border-radius .6s var(--s-ease), opacity .5s, box-shadow .6s; }
#aos-welcome .s-hole.on { opacity: 1; }
#aos-welcome .s-hole.calm { box-shadow: 0 0 0 200vmax rgba(0,0,0,.18); }
#aos-welcome .s-hole::before { content: ''; position: absolute; inset: -3px; border-radius: inherit; padding: 2.5px; background: var(--w-pastel); opacity: 0; transition: opacity .4s;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
#aos-welcome .s-hole::after { content: ''; position: absolute; inset: -3px; border-radius: inherit; opacity: 0; box-shadow: 0 0 0 0 var(--w-glow); }
#aos-welcome .s-hole.ring::before { opacity: 1; }
#aos-welcome .s-hole.ring::after { opacity: 1; animation: s-pulse 2.2s ease-out infinite; }
@keyframes s-pulse { 0% { box-shadow: 0 0 0 0 var(--w-glow); } 70%, 100% { box-shadow: 0 0 0 16px transparent; } }
#aos-welcome .s-card { position: absolute; left: 16px; right: 16px; top: 50%; max-width: 420px; margin: 0 auto; padding: 18px 20px 14px; border-radius: 26px; z-index: 3;
  background: var(--s-card); -webkit-backdrop-filter: blur(24px) saturate(170%); backdrop-filter: blur(24px) saturate(170%); box-shadow: inset 0 0 0 .5px var(--w-edge), 0 22px 50px -14px rgba(0,0,0,.45);
  opacity: 0; transform: translateY(10px) scale(.98); transition: top .6s var(--s-ease), opacity .3s, transform .5s var(--s-ease); }
#aos-welcome .s-card.on { opacity: 1; transform: none; }
#aos-welcome .s-card h3 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.3px; }
#aos-welcome .s-card p { margin: 6px 0 0; font-size: 15px; line-height: 1.4; }
#aos-welcome .s-card .c-seg { margin-top: 14px; }
#aos-welcome .s-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
#aos-welcome .s-row .w-dots { flex: 1; justify-content: flex-start; margin: 0; }
#aos-welcome .s-back { flex: 0 0 44px; height: 44px; border-radius: 14px; background: var(--w-dot) !important; font-size: 20px; }
#aos-welcome .s-back[hidden] { display: none; }
#aos-welcome .s-next { height: 44px; min-width: 96px; padding: 0 20px; border-radius: 14px; font-size: 16px; font-weight: 700; color: #10181A !important; background: var(--w-pastel) !important; box-shadow: inset 0 1px 1px rgba(255,255,255,.45); }
#aos-welcome .s-hand, #aos-welcome .s-ripple { position: absolute; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; pointer-events: none; opacity: 0; z-index: 2; }
#aos-welcome .s-hand { background: rgba(255,255,255,.88); box-shadow: 0 6px 18px rgba(0,0,0,.32), inset 0 0 0 1px rgba(0,0,0,.08); }
#aos-welcome .s-ripple { border: 2px solid rgba(255,255,255,.95); }
@media (prefers-reduced-motion: reduce) {
  #aos-welcome .s-hole.ring::after { animation: none !important; }
  #aos-welcome *, #aos-welcome *::before, #aos-welcome *::after { animation: none !important; transition-duration: .2s !important; transition-delay: 0s !important; }
  #aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dashoffset: 0; }
  #aos-welcome .v-new i { opacity: 1; transform: none; filter: none; }
}
/* Mid-century (a release with look: 'vintage', aOS2): the update screens and the welcome in the
   apps' Vintage colours - cream (walnut in the dark), mustard, teal, burnt orange - in Futura, the
   ink solid, with the atomic shapes in the corners. Doubled class: wins over the Sea glass above. */
:root #aos-welcome.mc.mc { --w-bg: #F4ECDD; --w-text: #2B2522; --w-muted: #5B4A3F; --w-glass: #FBF5E9; --w-edge: rgba(43,37,34,.14); --w-dot: rgba(43,37,34,.2);
  --w-pastel: linear-gradient(100deg, #D8572A, #D8572A); --w-glow: rgba(227,167,47,.45);
  --w-hot: linear-gradient(120deg, #1F6F6B 0%, #1F6F6B 45%, #D8572A 100%); --w-hot-glow: rgba(227,167,47,.7); --w-hot-glow2: rgba(216,87,42,.55);
  font-family: "Futura", "Futura-Medium", "Avenir Next", "Jost", system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) #aos-welcome.mc.mc { --w-bg: #241E1A; --w-text: #F4ECDD; --w-muted: #CFC1AC; --w-glass: #322A25; --w-edge: rgba(244,236,221,.14); --w-dot: rgba(244,236,221,.24);
  --w-pastel: linear-gradient(100deg, #F0C766, #F0C766); --w-hot: linear-gradient(120deg, #4FB3AB 0%, #4FB3AB 45%, #F0C766 100%); } }
html[data-theme="dark"] #aos-welcome.mc.mc { --w-bg: #241E1A; --w-text: #F4ECDD; --w-muted: #CFC1AC; --w-glass: #322A25; --w-edge: rgba(244,236,221,.14); --w-dot: rgba(244,236,221,.24);
  --w-pastel: linear-gradient(100deg, #F0C766, #F0C766); --w-hot: linear-gradient(120deg, #4FB3AB 0%, #4FB3AB 45%, #F0C766 100%); }
#aos-welcome.mc::before, #aos-welcome.mc::after { content: ''; position: absolute; pointer-events: none; z-index: -1; }   /* under everything on the screen */
#aos-welcome.mc::before { right: -70px; top: -70px; width: 200px; height: 200px; border-radius: 50%; background: #E3A72F; opacity: .9; }
#aos-welcome.mc::after { left: -30px; bottom: 90px; width: 130px; height: 36px; border-radius: 18px; background: #D8572A; transform: rotate(-18deg); opacity: .85; }
#aos-welcome.mc .c-panel { box-shadow: inset 0 0 0 1.5px var(--w-edge); -webkit-backdrop-filter: none; backdrop-filter: none; }
#aos-welcome.mc .w-btn { background: #D8572A !important; color: #FFF8EC !important; box-shadow: none; }
`;

  // ---- the overlay ----
  let open = null;
  function mount(label, inner, resolve, onClose) {
    if (!document.getElementById('aos-welcome-css')) {
      const st = document.createElement('style'); st.id = 'aos-welcome-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.id = 'aos-welcome'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
    if ((RELEASES.find(r => !r.silent) || {}).look === 'vintage') el.classList.add('mc');   // aOS2's screens: mid-century
    el.innerHTML = `<button class="w-skip" type="button">Skip</button>${inner}
      <div class="c-fly"></div>
      <div class="c-panel"><div class="c-body"></div><div class="w-dots"></div>
        <div class="c-btns"><button class="c-back" type="button" aria-label="Back" hidden>‹</button><button class="w-btn" type="button">Continue</button></div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    let done = false;
    const close = () => {
      if (done) return; done = true;
      if (onClose) onClose();
      el.classList.add('out');
      setTimeout(() => { el.remove(); open = null; resolve(); }, 650);
    };
    el.querySelector('.w-skip').onclick = close;
    return { el, q: s => el.querySelector(s), close };
  }
  const run = (label, inner, onClose, body) => {
    if (open) return open;
    open = new Promise(resolve => { const o = mount(label, inner, resolve, onClose); body(o).catch(() => o.close()); });
    return open;
  };

  // Give each letter its slice of the one gradient, so the word reads as one sweep.
  // (--sw the gradient's width, --sx this letter's offset into it; the A's two glyphs carry it themselves.)
  function paintLetters(word) {
    const W = word.getBoundingClientRect();
    for (const sp of word.querySelectorAll(':scope > span')) {
      const b = sp.getBoundingClientRect();
      for (const g of sp.classList.contains('L-A') ? sp.querySelectorAll('.g') : [sp]) { g.style.setProperty('--sw', W.width + 'px'); g.style.setProperty('--sx', -(b.left - W.left) + 'px'); }
      sp.style.maxWidth = (b.width + 2) + 'px';
    }
  }
  const letters = s => [...s].map(c => `<span>${esc(c)}</span>`).join('');
  const BRAND = `<div class="w-stage"><div class="c-brand">
      <div class="c-word"><span class="L-A"><b class="g g-A">A</b><b class="g g-a">a</b></span>${letters('llisonOS')}</div><div class="c-rule"></div>
      <div class="c-sub">Welcome</div><div class="c-corp">Part of the Allison Corporation</div></div></div>`;
  const MARK = v => `<div class="v-wrap"><div class="v-mark"><span class="v-ink">aOS</span><sup class="v-ink">${esc(v)}</sup><i class="v-ring"></i>
      <span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span></div>
      <div class="v-power">The Power of aOS<sup>${esc(v)}</sup></div></div>`;

  // "AllisonOS", drawn on, with Welcome and the corporation under it.
  async function sceneName(o) {
    paintLetters(o.q('.c-word'));
    APPS.forEach(id => { new Image().src = icon(id); });   // warm the icons up for what follows
    await slow(300); o.q('.c-word').classList.add('on'); o.q('.c-rule').classList.add('on');
    await slow(1700); o.q('.c-sub').classList.add('on'); o.q('.c-corp').classList.add('on');
    await slow(1800);
  }
  // AllisonOS folds into aOS, which hands over to the version mark: the number drops
  // in as a superscript, a ring pulses out, stars twinkle and a shine runs across.
  // One motion, on the word itself: "llison" folds away while the A melts into an a and
  // slides along to meet "OS", the colours spreading back across what is left; then aOS
  // grows to the middle, the version drops in beside it, and a shine runs across.
  async function sceneMark(o, v) {
    const { el, q } = o, word = q('.c-word'), sp = [...word.querySelectorAll(':scope > span')], A = sp[0], O = sp[7], S = sp[8];
    for (const c of ['.c-rule', '.c-sub', '.c-corp']) q(c).classList.add('c-fade');
    word.style.clipPath = 'none';                                   // drawn on; the version and its stars hang outside it
    const wa = A.querySelector('.g-a').getBoundingClientRect().width, wO = O.getBoundingClientRect().width, wS = S.getBoundingClientRect().width, W = wa + wO + wS;
    const slice = (g, left) => { g.style.setProperty('--sw', W + 'px'); g.style.setProperty('--sx', -left + 'px'); };
    for (const g of A.querySelectorAll('.g')) slice(g, 0);
    slice(O, wa); slice(S, wa + wO);
    // (the word stays centred in its row as it narrows, so where it ends up is known now)
    const box = el.getBoundingClientRect(), r0 = word.getBoundingClientRect(), s = 78 / 46;
    const cx0 = r0.left + r0.width / 2, cy0 = r0.top + r0.height / 2, cy = box.top + box.height * 0.47;
    A.style.maxWidth = wa + 'px';
    A.classList.add('to-a');
    sp.slice(1, 7).forEach((s, k) => { s.style.transitionDelay = ((5 - k) * 0.035).toFixed(3) + 's'; s.classList.add('fold'); });   // l l i s o n, nearest the OS first
    await slow(450);   // halfway through the fold, aOS starts to grow towards the middle
    word.insertAdjacentHTML('beforeend', `<span class="w-sup">${esc(v)}</span><i class="w-ring"></i>${`<span class="w-star">${STAR}</span>`.repeat(4)}`);
    q('.w-sup').style.setProperty('--sw', W * 0.5 + 'px');
    word.style.transform = `translate(${box.left + box.width / 2 - cx0 - 6}px, ${cy - cy0}px) scale(${s})`;
    o.mark = { word, cx0, cy0, s, W };
    const pw = document.createElement('div'); pw.className = 'm-power'; pw.innerHTML = `The Power of aOS<sup>${esc(v)}</sup>`;
    el.appendChild(pw); pw.style.top = (cy - box.top + r0.height * s / 2 + 18) + 'px';
    await slow(1150);
    word.classList.add('marked');
    // the shine: one band across aOS, each letter showing its part of it
    const parts = [[A.querySelector('.g-a'), 0], [O, wa], [S, wa + wO]];
    for (const [g, left] of parts) { g.style.setProperty('--bw', 2.6 * W + 'px'); g.style.setProperty('--b0', -left + 'px'); g.style.setProperty('--b1', (-1.5 * W - left) + 'px'); }
    await slow(900); pw.classList.add('on'); word.classList.add('shine');
    await slow(1900);
  }
  // The apps burst out of the mark into two rows at the top (the core apps, then the family's); the mark settles
  // between them and the panel.
  async function sceneBurst(o) {
    const { el, q } = o, fly = q('.c-fly'), box = el.getBoundingClientRect(), m = o.mark.word.getBoundingClientRect();
    const imgs = BY_GROUP.map(id => { const im = new Image(); im.src = icon(id); im.alt = ''; fly.appendChild(im); return im; });
    const at = (im, x, y, size) => { im.style.width = im.style.height = size + 'px'; im.style.left = (x - size / 2 - box.left) + 'px'; im.style.top = (y - size / 2 - box.top) + 'px'; };
    imgs.forEach(im => at(im, m.left + m.width / 2, m.top + m.height / 2, 20));
    const S = Math.min(56, (box.width - 32 - (CORE.length - 1) * 14) / CORE.length), G = 14, gy = box.top + Math.max(110, box.height * 0.2) + 20;
    await slow(60);
    // the core apps in the first row, the family's own in the second (a touch smaller, to fit six)
    const n = FAMILY_APPS.length, S2 = Math.min(S, (box.width - 32 - (n - 1) * G) / n);
    imgs.forEach((im, k) => setTimeout(() => {
      im.classList.add('on');
      const core = k < CORE.length, col = core ? k - (CORE.length - 1) / 2 : (k - CORE.length) - (n - 1) / 2, sz = core ? S : S2;
      at(im, box.left + box.width / 2 + col * (sz + G), gy + (core ? -0.5 : 0.5) * (S + G), sz);
    }, still() ? 0 : k * 70 * PACE));
    // the mark settles below the grid, smaller, its line under it
    const gridBottom = gy + S + G, panelTop = box.height - 400, my = Math.max(gridBottom + 50, (gridBottom + panelTop) / 2), M = o.mark, k = 0.56;
    M.word.style.transform = `translate(${box.left + box.width / 2 - M.cx0 - 6 * k}px, ${my - M.cy0}px) scale(${M.s * k})`;
    const pw = q('.m-power'); pw.style.top = (my - box.top + 46 * M.s * k / 2 + 10) + 'px'; pw.style.transform = 'scale(.8)';
    el.classList.add('parked');
    await slow(1300);
  }
  // An app's own opening: its icon blooms in, its name is drawn on, then it moves up.
  async function sceneApp(o, id) {
    const w = o.q('.c-word'); paintLetters(w);
    await wait(250); o.q('.a-icon').classList.add('on');
    await wait(700); w.classList.add('on');
    await wait(1300); o.q('.a-by').classList.add('on'); o.q('.a-tag').classList.add('on');
    await wait(1700); o.el.classList.add('parked');
    await wait(500);
  }

  // A drag sideways on the panel turns the page: past a fifth of its width, or a quick flick.
  function swiper(area, go) {
    let x0 = null, y0 = 0, t0 = 0;
    area.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
    area.addEventListener('pointerup', e => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0, fast = Date.now() - t0 < 300;
      x0 = null;
      if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > area.clientWidth / 5 || (fast && Math.abs(dx) > 30))) go(dx < 0 ? 1 : -1);
    });
  }
  // The glass panel and its cards. A card: { t, d, i (drawing) | noart, x: special
  // ('theme' | 'install' | 'look' | 'store' | 'notes'), name (install), notes (notes) }.
  async function tour(o, cards, last = 'Get started', next = null) {
    const { el, q, close } = o, body = q('.c-body');
    let i = 0;
    q('.w-dots').innerHTML = cards.length > 1 ? cards.map((_, j) => `<i class="${j ? '' : 'on'}"></i>`).join('') : '';
    const draw = () => {
      const c = cards[i];
      el.classList.toggle('tall', c.x === 'install' || !!c.tall);
      const extra = c.x === 'theme' ? `<div class="c-seg" role="group" aria-label="Appearance">${THEMES.map(([v, n]) => `<button type="button" data-t="${v}" aria-pressed="${v === readTheme()}">${n}</button>`).join('')}</div>`
        : c.x === 'look' ? `<div class="c-looks" role="listbox" aria-label="Look">${LOOKS.map(([v, n, d]) => `<button type="button" role="option" class="c-look" data-look="${v}" aria-selected="${v === window.aosLook.get()}"><i class="c-sw ${v}" aria-hidden="true"></i><span><b>${n}</b><small>${d}</small></span></button>`).join('')}</div>`
        : c.x === 'store' ? `<a class="c-link" href="${url('../aOS/')}">Open aOS</a>`
        : c.x === 'notes' ? `<ul class="c-notes">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>${c.more ? `<a class="c-link" href="${url('../aOS/#whats-new')}">${c.more}</a>` : ''}` : '';
      body.innerHTML = `${c.noart ? '' : `<div class="c-art">${lineSvg(c.i)}</div>`}<h2>${c.h || esc(c.t)}</h2>${c.x === 'install' ? steps(c.name) : c.dh ? `<p>${c.dh}</p>` : c.d ? `<p>${esc(c.d)}</p>` : ''}${extra}`;
      for (const b of body.querySelectorAll('.c-seg button')) b.onclick = () => { setTheme(b.dataset.t); body.querySelectorAll('.c-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      for (const b of body.querySelectorAll('.c-look')) b.onclick = () => {   // aOS's look, before it is added: its icon follows
        window.aosLook.set(b.dataset.look); if (c.onLook) c.onLook(b.dataset.look);
        body.querySelectorAll('.c-look').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      };
      const sd = body.querySelector('.c-sd'); if (sd) safariDemo(sd, c.name, c.icon || icon('aos'));
      body.querySelectorAll('.c-inst').forEach(fillInstall);
      el.querySelectorAll('.w-dots i').forEach((x, j) => x.classList.toggle('on', j === i));
      q('.c-back').hidden = i === 0;
      q('.c-btns .w-btn').textContent = i === cards.length - 1 ? last : 'Continue';
      q('.c-btns .w-btn').hidden = !!c.stay;   // stays until the view is closed (opened from aOS)
      fit();
    };
    // On a short screen (Safari with its bars) a card can reach up over the mark and
    // "The Power of aOS1": then fade them, as tall cards do, rather than cover them.
    const fit = () => {
      if (!el.isConnected) return removeEventListener('resize', fit);
      const p = q('.c-panel'), top = el.getBoundingClientRect().top + p.offsetTop;
      const over = [...el.querySelectorAll('.m-power.on, .v-mark.on, .a-head, .c-word.on')].some(x => { const r = x.getBoundingClientRect(); return r.height && r.bottom > top - 6; });
      el.classList.toggle('tall', cards[i].x === 'install' || !!cards[i].tall || over);
    };
    addEventListener('resize', fit);
    const go = async d => {
      if (cards[i].stay && i + d >= cards.length) return;
      if (i + d >= cards.length) return next ? next() : close();
      if (i + d < 0) return;
      body.classList.add('fade'); await wait(260);
      i += d; draw(); body.classList.remove('fade');
    };
    draw();
    await wait(200); q('.c-panel').classList.add('on');
    q('.c-btns .w-btn').onclick = () => go(1);
    q('.c-back').onclick = () => go(-1);
    swiper(q('.c-panel'), go);
  }

  // ===========================================================================
  // THE LIVE TOUR: after an app's opening, the welcome clears to the app itself and a
  // spotlight moves from one of its real controls to the next, a glass card beside it
  // saying what it does and a fingertip showing the gesture. It ends on Light or dark,
  // with the app behind it changing as you pick. A control that isn't on screen is
  // passed over; with fewer than two to show, the app gets its cards instead.
  //   SPOTS[app] = { stops: [stop, ...], done(): put the app back as the tour found it }
  //   a stop: { sel: selector (or a list, the first one shown wins), t: title, d: what it does,
  //     g: 'tap' | 'swipe-left' | 'swipe-right' | 'swipe-up' | 'hold', pad, r: corner radius,
  //     focus: [x, y, w, h] - only part of a big control (a map): its middle as fractions, its size in px,
  //     pre(): get the app ready first (open a tab), demo: { into, html, where, hide } }
  // A demo stands in where a new install has nothing yet (an email to swipe): its html is
  // put into the app (marked data-aos-demo, hidden from screen readers) and taken out
  // again when the tour ends, however it ends.
  // ===========================================================================
  const SPOTS = {};
  const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const usDay = (d, o) => d.toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' });

  // ---- the stops, app by app (written from each app's own screen on a new install) ----
  const MAIL_ROW = { key: 'mail-row', into: '#screen', html: `<div class="stack"><ul class="list pills"><li class="unread" style="--i:0;pointer-events:none" data-id="aos-demo">
    <span class="check"></span>
    <span class="swipe"><button class="sa tagx" type="button" tabindex="-1">Tag</button><button class="sa mktx" type="button" tabindex="-1">Marketing</button></span>
    <span class="swipe-r"><button class="sa flag" type="button" tabindex="-1">Flag</button><button class="sa arch" type="button" tabindex="-1">Archive</button><button class="sa bin" type="button" tabindex="-1">Trash</button></span>
    <div class="rowtop"><button class="open" type="button" tabindex="-1"><span class="who"><span class="dot"></span><span class="name">Lincoln Elementary</span><span class="when">9m</span></span>
      <span class="subj">Field trip forms due Friday</span><span class="snip">Please return the signed permission slip by Friday so…</span>
      <span class="meta"><span class="tchip rem" style="--h:280">Reminder</span><span class="tchip" style="--h:150">School</span></span></button></div></li></ul></div>` };
  const mailRow = () => document.querySelector('[data-aos-demo="mail-row"] li');
  // Each tour says everything its walkthrough cards said (TOURS): the cards' words, at the controls.
  SPOTS.mail = { stops: [
    { sel: '[data-aos-demo="mail-row"] li', demo: MAIL_ROW, pad: 4, t: 'Swipe to sort', d: 'Swipe right to tag an email or move it to Marketing.', g: 'swipe-right',
      pre: () => { const li = mailRow(); if (li) { li.classList.remove('peek'); void li.offsetWidth; li.classList.add('peek'); } } },
    { sel: '[data-aos-demo="mail-row"] li', demo: MAIL_ROW, pad: 4, t: 'Flag, archive, trash', d: 'Swipe left to flag, archive or trash it. Every swipe has Undo.', g: 'swipe-left' },
    { sel: '[data-aos-demo="mail-row"] li', demo: MAIL_ROW, pad: 4, t: 'Marketing empties itself', d: 'Promotions move out of your inbox into Marketing, and anything there over 30 days old goes to the Trash.' },
    { sel: '[data-aos-demo="mail-row"] .tchip:not(.rem)', demo: MAIL_ROW, pad: 6, t: 'Tags that stick', d: 'Tag one email and everything from that sender gets the tag too, now and in future, even with the app closed.' },
    { sel: '[data-aos-demo="mail-row"] .tchip.rem', demo: MAIL_ROW, pad: 6, t: 'Remind Me', d: 'Put a conversation away until Tomorrow, This Weekend or Next Week. It comes back unread at the top.' },
    // the compose button only shows once Gmail is connected: shown for this stop, hidden again after
    { sel: '#fab', t: 'Send with Undo', d: 'Reply, Reply All or Forward with attachments. Every send waits 5 seconds so you can take it back.', g: 'tap',
      pre: () => { const f = document.getElementById('fab'); if (f && f.classList.contains('hide')) { f.classList.remove('hide'); f.dataset.aosShown = '1'; } } },
    { sel: '#screen .signin [data-act="signin"]', t: 'Connect Gmail', d: 'Connect your Gmail to start. Mail is a calmer view of your own inbox.', g: 'tap',
      pre: () => mailFab() },
  ], done: () => mailFab() };
  function mailFab() { const f = document.getElementById('fab'); if (f && f.dataset.aosShown) { f.classList.add('hide'); delete f.dataset.aosShown; } }
  SPOTS.calendar = { stops: [
    { sel: ['#mgrid', '#main .mgrid'], t: 'One shared calendar', d: 'This is your iCloud Family calendar, so changes here show up in everyone’s iPhone Calendar too.' },
    { sel: '.dock .tabs', t: 'Day to Year views', d: 'Pick Day, Week, Month, Year or List from the bottom bar, swipe to move through time, and tap Today to come back.', g: 'tap' },
    { sel: '#fab', t: 'Add events fast', d: 'Tap + or an empty time to add an event, with repeats, alerts, travel time and notes.', g: 'tap' },
    { sel: '.dock .tabs .tab[data-view="week"]', t: 'Drag to reschedule', d: 'In Day or Week, press and hold an event to drag it to a new time, or drag its bottom edge to change its length.', g: 'hold' },
    { sel: '#setBtn', t: 'Everything in one place', d: 'Turn on layers for holidays, Notes reminders, trips, Mail reminders, workouts and the weather forecast.', g: 'tap' },
  ] };
  SPOTS.news = { stops: [
    { sel: '#viewBtn', t: 'News by topic', d: 'Browse the latest headlines from free sources across World, UK, US, Business, Tech, AI, Science and more. Tap the pill to pick a topic.', g: 'tap' },
    { sel: ['#feed > .lead', '#feed .list > .row'], t: 'Tap to read', d: 'Stories are newest first and each shows only once. Tap one to read the full article on the publisher’s site.', g: 'tap' },
    { sel: ['#feed .sum-btn', '#feed'], t: 'Summarize a story', d: 'Tap the sparkle on a story for a two-sentence summary and the key takeaways, then ask questions about the article. Summaries are for signed-in family.', g: 'tap' },
    { sel: '#viewBtn', t: 'Follow your teams', d: 'On Sport, the My teams pill holds Liverpool, England and the rest: pick one to see just their news and games, or choose your own sports and teams.', g: 'tap' },
    { sel: '#viewBtn', t: 'League tables', d: 'Switch Sport to Table for a league\'s standings, kept up to date as games finish, with the teams in play marked and the ones you follow tinted.' },
    { sel: '#viewBtn', t: 'Scores and tables', d: 'Switch Sport to Scores for live results, upcoming fixtures and where to watch on US TV. The Premier League shows first; a pill picks another league. Tap a football or rugby game for its own page: events, stats, shots and players.' },
    { sel: '#refresh', t: 'Always fresh', d: 'News checks for new stories on its own. Tap here to check now.', g: 'tap' },
  ] };
  SPOTS.weather = { ready: '#card', wait: 6000, stops: [
    { sel: '#hero .w3-place', t: 'Your places', d: 'It opens to where you are. Save up to 12 cities and swipe the forecast sideways to move between them. Tap the name to add one.', g: 'tap' },
    { sel: ['#hero .w3-in > div:nth-child(2) > div:last-child', '#hero .w3-in > div:nth-child(2)'], t: 'Know when rain starts', d: 'A chip under the temperature says when rain is due to start or stop, like "Rain at 3:45PM" (continental US).' },
    { sel: '#alerts [data-aos-demo]', t: 'Weather alerts', d: 'Active National Weather Service alerts show at the top, most severe first. Tap one to read it.', g: 'tap', pad: 4,
      demo: { into: '#alerts', html: `<div class="alert"><button type="button" tabindex="-1"><span class="dot" style="background:#FF9F0A22;color:#FF9F0A;font-weight:700">!</span>
        <span class="t"><b>Wind Advisory</b><small>An example: real alerts show here</small></span></button></div>` } },
    { sel: ['#hxTray .hx-col.hx-now', '#days .dc[data-day="0"]'], t: 'Every hour and day', d: 'Tap an hour or a day for the details: feels like, wind, humidity, chance of rain, sunrise and sunset.', g: 'tap' },
    { sel: ['#vsw [data-view="radar"]', '#vsw'], t: 'Radar that looks ahead', d: 'Watch the latest radar, then up to four hours of forecast rain, looping on a map. Continental US only.', g: 'tap' },
  ] };
  SPOTS.notes = { stops: [
    { sel: ['#list .ctile', '#list .ctiles'], t: 'Notes with #tags', d: 'Type a #tag anywhere to file a note into a collection. Pin, color and search your notes too.', g: 'tap' },
    { sel: ['#list .grid .card', '#list .card', '#list .nrow'], t: 'Swipe to tidy', d: 'Swipe a note left to archive or delete it, or right to pin or tag it. Deleted notes wait 30 days in Trash.', g: 'swipe-left' },
    { sel: '#pasteBtn', t: 'Paste from anywhere', d: 'Copy a reply from Claude or anywhere, tap the clipboard button, and it becomes a note or a list of reminders.', g: 'tap' },
    { sel: '.tabs .tab[data-tab="rem"]', t: 'Quick reminders', d: 'Type "Call mom tomorrow #family" and it’s set. See Today, Upcoming and Flagged at a glance.', g: 'tap' },
    { sel: '.tabs .tab[data-tab="rem"]', t: 'Smart grocery lists', d: 'Grocery items sort into store sections in aisle order, and it learns where you like things to go.' },
    { sel: '#fab', t: 'Write it down', d: 'Tap the pencil for a new note. Notes and lists can be shared with the family.', g: 'tap' },
  ] };
  const UP_NEXT = { key: 'pod-up', into: '#homeBody', html: `<section><p class="sechead">Up Next</p><div class="shelf"><article class="upcard glass" style="--i:0">
        <button class="uptop" type="button" tabindex="-1"><span class="art" style="--s:64px"></span><span class="uptx"><span class="upm">Your favorite show</span><span class="upt">The newest episode</span></span></button>
        <div class="upbar"><button class="playpill" type="button" tabindex="-1"><span class="pbar"><i style="width:40%"></i></span><span>18 min left</span></button><span class="upd">Today</span></div></article></div></section>` };
  SPOTS.podcasts = { stops: [
    { sel: '#homeBody [data-aos-demo="pod-up"] .upcard', demo: UP_NEXT, pad: 4, t: 'Up Next', d: 'Listen Now shows what’s playing, your queue, episodes you’re part way through, and new episodes from your shows.' },
    { sel: '#homeBody [data-aos-demo="pod-up"] .playpill', demo: UP_NEXT, pad: 6, t: 'Resume where you left off', d: 'Each episode resumes right where you stopped, and the next one in Up Next plays when it ends.', g: 'tap' },
    { sel: '#homeBody [data-aos-demo="pod-up"] .upcard', demo: UP_NEXT, pad: 4, t: 'Listen your way', d: 'Play at 0.5× to 3×, skip back or forward, set a sleep timer, and AirPlay to a speaker or TV.', g: 'tap' },
    { sel: '#searchTab', t: 'Find new shows', d: 'Browse Apple’s Top shows, search by name, or paste a show’s feed link. Private and premium feeds work too.', g: 'tap' },
    { sel: '.tabs .tab[data-tab="lib"]', t: 'Your library', d: 'Every show you follow, with new episodes downloaded and ready.', g: 'tap' },
  ] };
  SPOTS.travel = { stops: [
    { sel: '#scanBtn', t: 'Fills itself from Gmail', d: 'Connect Gmail and your flight, hotel and rental car confirmations become trips on their own.', g: 'tap' },
    { sel: '#list [data-aos-demo].hero', t: 'What’s next', d: 'See your next flight, check-in or pick-up at the top, with live flight status and gates as take-off nears.', pad: 4,
      demo: { into: '#list', hide: '#list .empty', html: () => `<button class="hero glass" type="button" tabindex="-1" style="--tint:var(--fl)"><p class="k">Next · in 6 days</p>
        <div class="route"><div class="ap"><b>RDU</b><span>Raleigh-Durham</span></div><div class="line"></div><div class="ap r"><b>BOS</b><span>Boston</span></div></div>
        <div class="when">B6 1234 · ${usDay(inDays(6))} · 7:05 AM</div><div class="sub">Terminal 2 · Gate C7 · Seat 14A</div><div class="meta"><span class="st ok">On time</span></div></button>` } },
    { sel: '#list [data-aos-demo].trip', t: 'Trips day by day', d: 'Each trip is a day-by-day timeline. Add the whole trip to the Family calendar in one tap.', g: 'tap', pad: 4,
      demo: { into: '#list', where: 'beforeend', hide: '#list .empty', html: () => `<button class="trip glass" type="button" tabindex="-1" style="--i:0"><div class="tt"><h3>Boston</h3><span class="soon">in 6 days</span></div>
        <div class="dates">${usDay(inDays(6), { month: 'short', day: 'numeric' })} – ${usDay(inDays(9), { month: 'short', day: 'numeric' })}</div><div class="icons"><span class="count">2 flights</span><span class="count">1 hotel</span><span class="count">1 car</span></div></button>` } },
    { sel: ['.dock .dockr', '#fab'], t: 'Add by hand', d: 'Tap + to add a flight, hotel or car yourself, or paste a confirmation email from any inbox.', g: 'tap' },
    { sel: '.tabs .tab[data-tab="explore"]', t: 'Plan the next one', d: 'Explore opens Google Flights, Google Hotels, Marriott, Kayak or National with your places and dates filled in.', g: 'tap' },
  ] };
  // Orders' demo card.
  const ORDER_CARD = { into: '#list', hide: '#list .empty, #list .btn', html: () => `<button class="ocard" type="button" tabindex="-1" style="--i:0"><div class="otop"><span class="mono m1">N</span><div class="omid"><div class="ostore">Northfield Hardware</div><div class="owhat">Oak flooring and underlayment</div></div><span class="oprice">$987.21</span></div>
        <div class="ostate"><b class="s-now">Out for delivery</b><span class="when">Today</span></div><div class="osteps" style="grid-template-columns:repeat(4,1fr)"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>
        <div class="ocarrier"><span class="cpill">UPS</span><span class="t">1Z 000 000 00 0000 0000</span></div></button>` };
  SPOTS.orders = { stops: [
    { sel: '#scanBtn', t: 'Fills itself from Gmail', d: 'Connect Gmail and your order, shipping and pickup emails become orders on their own.', g: 'tap' },
    { sel: '#list [data-aos-demo].ocard', t: 'See where it is', d: 'On the way, ordered, ready for pickup or delivered, each with its courier and tracking number.', pad: 4, g: 'tap',
      demo: ORDER_CARD },
    { sel: '#list [data-aos-demo] .ocarrier', t: 'Tracking in one tap', d: 'Tap Track to open UPS, USPS, FedEx or DHL with your package already looked up.', g: 'tap' },
    { sel: '#whenChips', t: 'A quick check when it’s unsure', d: 'An order read from the words of an email, or one that has gone quiet, waits under To check.', g: 'tap' },
    { sel: '#setBtn', t: 'Choose what counts', d: 'Packages and store pickups show. Turn on food, subscriptions or tickets in Settings.', g: 'tap' },
    { sel: ['.dock .dockr', '#fab'], t: 'Add by hand', d: 'Tap + to add an order yourself, or paste an order email from any inbox.', g: 'tap' },
  ] };
  SPOTS.places = { stops: [
    { sel: '#seg', t: 'Want to go and Been', d: 'Keep two lists: places you want to try and places you’ve been. Tap Been to move a place across.', g: 'tap' },
    { sel: '#map', focus: [.5, .58, 190, 190], r: 95, t: 'Your places on a map', d: 'Pins show which places you want to go to and which you’ve been to, each in its own color. Touch and hold anywhere on the map to add a spot.', g: 'hold' },
    { sel: '#filterWrap', t: 'Find somewhere new', d: 'Search "tacos" or a name to find nearby businesses, or zoom in to see food, things to do and shops.', g: 'tap' },
    { sel: '#fab', t: 'Rate and remember', d: 'Add stars, price and notes with #tags, and Places keeps track of every visit.', g: 'tap' },
  ] };
  SPOTS.fitness = { stops: [
    { sel: ['#main .week', '#main .navrow'], t: 'Your week at a glance', d: 'Each day shows the muscle groups you worked and how many sets. Swipe sideways to move a week at a time.', g: 'swipe-left' },
    { sel: '#fab', t: 'Log in seconds', d: 'Search an exercise, like "db curl", and last time’s weight, reps and sets fill in for you.', g: 'tap' },
    { sel: ['#main .drow.today', '#fab'], t: 'Cardio counts too', d: 'Log time and distance on the treadmill, bikes, rower, track or pool alongside your lifting.', g: 'tap' },
    { sel: ['#viewBtn', '#vbar'], t: 'See your progress', d: 'Analysis compares this week or month with the one before, showing what’s improving and what needs work.', g: 'tap' },
    { sel: ['#viewBtn', '#vbar'], t: 'Meds and steps', d: 'Pick Meds here to tick off your medications and supplements, on a private page of its own. The week shows each day’s steps, from your iPhone or typed in.', g: 'tap' },
  ] };
  SPOTS.drinks = { stops: [
    { sel: ['#main .rgroup.week', '#main .week'], t: 'Your week', d: 'Each day shows its standard drinks or alcohol-free. Swipe sideways to move a week at a time.', g: 'swipe-left' },
    { sel: '#sumBtn', t: 'Your week in one number', d: 'The week adds up here against the limit you set.' },
    { sel: '#fab', t: 'One tap to log', d: 'Your usual drinks sit in each day as tiles. Tap one to log it, or Something else for anything new.', g: 'tap' },
    { sel: '#sumBtn', t: 'How it’s going', d: 'Tap the week’s number for Analysis: this week or month against the one before, then 12 weeks of charts. The pill at the bottom picks which.', g: 'tap' },
    { sel: '#moreBtn', t: 'Private to you', d: 'Signed in, your log is kept in the family\'s Google Sheet, where only you can see yours, and follows you to another phone. Sign in and set your goals here.', g: 'tap' },
  ] };
  SPOTS.meals = { stops: [
    { sel: ['#main .card', '#tabs'], t: 'Shared with the family', d: 'Your family’s dinners: everyone signed in sees the same plan and deals.' },
    { sel: '#fab', t: 'A week of dinners', d: 'Tap + and pick a meat, and Meals plans a few nights of different dinners for the family, each a different cuisine. Tap a night for its recipe.', g: 'tap' },
    { sel: '#tabs [data-tab="deals"]', t: 'This week’s deals', d: 'Your Whole Foods’ sales, found for you or pasted from its app, sorted like a grocery list.', g: 'tap' },
    { sel: '#tabs [data-tab="list"]', t: 'One shopping list', d: 'Everything the dinners need in one list, sorted by aisle, with what’s on sale. Tick it off in the store.', g: 'tap' },
    { sel: '#setBtn', t: 'Safe for the family', d: 'Every plan is checked against your family’s allergies before it’s kept. Set them, and your store, here.', g: 'tap' },
  ] };
  SPOTS.clock = { stops: [
    { sel: ['#hero', '#tabs [data-tab="world"]'], t: 'World Clock', d: 'See your own time and the cities you add, each with its time, its day and how far ahead or behind it is. Tap + to add a city.' },
    { sel: '#tabs [data-tab="alarms"]', t: 'Alarms', d: 'Set alarms that repeat on the days you pick, each with a label, a sound and snooze. Sleep | Wake Up keeps your bedtime and wake-up time.', g: 'tap' },
    { sel: ['#tabs [data-tab="stopwatch"]', '#tabs [data-tab="timers"]'], t: 'Stopwatch and timers', d: 'A stopwatch with laps, the fastest and slowest marked, and as many timers as you like at once. Recent timers are one tap.', g: 'tap' },
    { sel: '#nightBtn', t: 'Nightstand', d: 'A dark bedside clock that keeps the screen on, so your alarm rings in the morning. Alarms ring only while Clock is open.', g: 'tap' },
    { sel: '#setBtn', t: 'Two designs', d: 'Vintage, mid-century with starburst clock faces, or Standard, in Sea glass. Pick one in Settings, and change it any time.', g: 'tap' },
  ] };
  SPOTS.house = { stops: [
    { sel: ['#v-fav .runpanel', '#v-fav .fnp', '#v-fav'], t: 'Favorites first', d: 'It opens on what you use most: what’s playing, what’s running now, the weather, thermostats, cameras and lamps.' },
    { sel: ['#v-fav .autos', '#v-fav .ag'], t: 'Routines in one tap', d: 'Run Goodnight, Evening Lights and your other routines straight from Favorites.', g: 'tap' },
    { sel: '#v-fav .dg.tc', t: 'Heat and cool', d: 'Set thermostats, heaters, air purifiers and dehumidifiers. Tap any card for all of its controls.', g: 'tap' },
    { sel: ['#v-fav [data-dv="lights:house"]', '#v-fav .lp'], t: 'Lights by room', d: 'Switch a whole room on or off, dim each light with a slider, or use All on and All off.', g: 'tap' },
    { sel: ['#v-fav [data-dv^="cams:"]', '#viewBtn'], t: 'Cameras and security', d: 'Arm or disarm Blink, see each camera’s latest still, take a snapshot or pause motion detection.', g: 'tap' },
    { sel: '#viewBtn', t: 'Every room and system', d: 'Tap here for Climate, Lights, Media and Security, each on its own page.', g: 'tap' },
    { sel: '#bannerBtn', t: 'Connect your house', d: 'This is a preview on sample readings. Tap Connect to link your Home Assistant: Home shows you how, next.', g: 'tap' },
  ] };
  // Every app carries both designs (../home/design.js): its tour ends at the button for its Settings.
  const DESIGN_AT = { mail: ['#gear', '#screen .signin [data-act="signin"]'], house: '#gear', calendar: '#setBtn', orders: '#setBtn', podcasts: ['#setBtn', '.tabs .tab[data-tab="lib"]'], travel: '#setBtn', meals: '#setBtn', drinks: '#moreBtn', fitness: '#setBtn', news: '#setBtn', weather: '#foot [data-action="location"]', notes: ['#setBtn', '#remSetBtn'], places: '#setBtn' };
  for (const [id, sel] of Object.entries(DESIGN_AT)) if (SPOTS[id]) SPOTS[id].stops.push({ sel, t: 'Two designs', d: 'Vintage, mid-century modern, or Standard, in Sea glass. Pick one in Settings, and change it any time.', g: 'tap' });
  let spotEnd = null;
  const onScreen = e => {
    if (!e || !e.isConnected || e.closest('#aos-welcome')) return false;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;   // scrolled away is fine: each stop scrolls to it
    const st = getComputedStyle(e); return st.visibility !== 'hidden' && +st.opacity > .05;
  };
  const spotFind = sel => { for (const s of [].concat(sel || [])) { try { for (const e of document.querySelectorAll(s)) if (onScreen(e)) return e; } catch {} } return null; };
  const spotWait = async (sel, ms) => { const t0 = Date.now(); let e; while (!(e = spotFind(sel)) && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 90)); return e; };
  function addDemo(d, hidden) {
    if (document.querySelector(`[data-aos-demo="${d.key}"]`)) return;
    const host = document.querySelector(d.into); if (!host) return;
    const t = document.createElement('template'); t.innerHTML = (typeof d.html === 'function' ? d.html() : d.html).trim();
    for (const n of t.content.children) { n.setAttribute('data-aos-demo', d.key); n.setAttribute('aria-hidden', 'true'); }
    host.insertAdjacentElement(d.where || 'afterbegin', t.content.firstElementChild);
    for (const h of document.querySelectorAll(d.hide || 'x-none')) { if (hidden.some(([x]) => x === h)) continue; hidden.push([h, h.style.display]); h.style.display = 'none'; }   // each once, so it comes back as it was
  }
  // Enough of the tour on screen to be worth it? (S.ready: wait a little for the app's main screen.)
  async function spotsReady(id) {
    const S = SPOTS[id]; if (!S) return false;
    if (S.ready && !(await spotWait(S.ready, S.wait || 4000))) return false;
    if (document.getElementById('aos-off')) return false;   // switched off: nothing to show around
    return S.stops.filter(s => s.pre || s.demo || spotFind(s.sel)).length >= 2;
  }

  // opts.stops: just these (an update's walkthrough of what changed), with no Light or dark at the end
  function spotTour(o, id, opts = {}) {
    const { el, q, close } = o, S = opts.stops ? {} : SPOTS[id], name = NAMES[id];
    const list = opts.stops ? opts.stops.slice() : [...S.stops, ...(DARK_ONLY.includes(id) ? [] : [{ theme: true, t: 'Light or dark', d: `Follow your ${ios ? 'iPhone' : 'device'}, or keep ${name} always light or always dark. Try it: ${name} changes behind this.` }])];
    el.insertAdjacentHTML('beforeend', `<div class="s-hole"></div><div class="s-ripple"></div><div class="s-hand"></div>
      <div class="s-card" role="group" aria-live="polite"><h3></h3><p></p><div class="s-x"></div>
        <div class="s-row"><div class="w-dots"></div><button class="s-back" type="button" aria-label="Back" hidden>‹</button><button class="s-next" type="button">Next</button></div></div>`);
    const hole = q('.s-hole'), card = q('.s-card'), hand = q('.s-hand'), rip = q('.s-ripple'), hidden = [], sx = scrollX, sy = scrollY;
    let i = -1, busy = false, anims = [], cur = null, last = '', ticker = 0;
    const stopHand = () => { anims.forEach(a => a.cancel()); anims = []; };
    spotEnd = () => {
      spotEnd = null; clearInterval(ticker); stopHand(); removeEventListener('resize', relayout);
      document.querySelectorAll('[data-aos-demo]').forEach(x => x.remove());
      hidden.forEach(([h, v]) => { h.style.display = v; });
      try { if (S.done) S.done(); } catch {}
      try { scrollTo(sx, sy); } catch {}
    };
    const box = () => el.getBoundingClientRect();
    // where the spotlight goes: the control, a little roomier, kept on screen
    const rectOf = s => {
      let r = s.el.getBoundingClientRect(); const B = box(), p = s.pad == null ? 8 : s.pad;
      if (s.focus) { const [fx, fy, fw, fh] = s.focus, x = r.left + r.width * fx, y = r.top + r.height * fy; r = { left: x - fw / 2, top: y - fh / 2, right: x + fw / 2, bottom: y + fh / 2 }; }
      const l = Math.max(6, r.left - B.left - p), t = Math.max(6, r.top - B.top - p);
      const w = Math.min(B.width - 6, r.right - B.left + p) - l, h = Math.min(B.height - 6, r.bottom - B.top + p) - t;
      return { left: l, top: t, width: Math.max(0, w), height: Math.max(0, h) };
    };
    const setHole = (r, s) => {
      if (!r) { const B = box(); Object.assign(hole.style, { left: B.width / 2 + 'px', top: B.height / 2 + 'px', width: '0px', height: '0px', borderRadius: '0px' }); hole.classList.remove('ring'); hole.classList.add('calm'); return; }
      Object.assign(hole.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: (s.r == null ? Math.min(22, r.height / 2) : s.r) + 'px' });
      hole.classList.add('ring'); hole.classList.remove('calm');
    };
    // the card goes below the spotlight if it fits, else above, else at the bottom
    const placeCard = r => {
      const B = box(), ch = card.offsetHeight, topMin = 64, botMax = B.height - 24;
      let top;
      if (!r) top = (B.height - ch) / 2;
      else if (r.top + r.height + 18 + ch <= botMax) top = r.top + r.height + 18;
      else if (r.top - 18 - ch >= topMin) top = r.top - 18 - ch;
      else top = botMax - ch;
      card.style.top = Math.max(topMin, top) + 'px';
    };
    const P = (x, y, k = 1) => `translate(${x}px, ${y}px) scale(${k})`;
    function gesture(g, r) {
      stopHand();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (still()) { anims.push(hand.animate([{ opacity: .9, transform: P(cx, cy) }, { opacity: .9, transform: P(cx, cy) }], { duration: 1000, fill: 'forwards' })); return; }
      const loop = { duration: g === 'tap' ? 2000 : 2600, iterations: Infinity, easing: 'ease-in-out' };
      if (g === 'tap') {
        anims.push(hand.animate([{ opacity: 0, transform: P(cx + 18, cy + 34, 1.1) }, { opacity: 1, transform: P(cx, cy, 1), offset: .3 }, { opacity: 1, transform: P(cx, cy, .8), offset: .42 },
          { opacity: 1, transform: P(cx, cy, 1), offset: .52 }, { opacity: 0, transform: P(cx, cy, 1), offset: .78 }, { opacity: 0, transform: P(cx, cy, 1) }], loop));
        anims.push(rip.animate([{ opacity: 0, transform: P(cx, cy, .5) }, { opacity: 0, transform: P(cx, cy, .5), offset: .42 }, { opacity: .9, transform: P(cx, cy, .6), offset: .44 },
          { opacity: 0, transform: P(cx, cy, 2.3), offset: .8 }, { opacity: 0, transform: P(cx, cy, 2.3) }], loop));
      } else if (g === 'hold') {
        anims.push(hand.animate([{ opacity: 0, transform: P(cx, cy + 30, 1.1) }, { opacity: 1, transform: P(cx, cy, 1), offset: .22 }, { opacity: 1, transform: P(cx, cy, .82), offset: .3 },
          { opacity: 1, transform: P(cx, cy, .82), offset: .72 }, { opacity: 0, transform: P(cx, cy, 1), offset: .86 }, { opacity: 0, transform: P(cx, cy, 1) }], loop));
        anims.push(rip.animate([{ opacity: 0, transform: P(cx, cy, .6) }, { opacity: 0, transform: P(cx, cy, .6), offset: .3 }, { opacity: .9, transform: P(cx, cy, .7), offset: .32 },
          { opacity: .5, transform: P(cx, cy, 1.9), offset: .72 }, { opacity: 0, transform: P(cx, cy, 2.1), offset: .8 }, { opacity: 0, transform: P(cx, cy, 2.1) }], loop));
      } else {
        const up = g === 'swipe-up', left = g === 'swipe-left', span = up ? Math.max(70, r.height * .5) : Math.max(90, r.width * .5);
        const [x0, y0, x1, y1] = up ? [cx, cy + span / 2, cx, cy - span / 2] : left ? [cx + span / 2, cy, cx - span / 2, cy] : [cx - span / 2, cy, cx + span / 2, cy];
        anims.push(hand.animate([{ opacity: 0, transform: P(x0, y0, 1.1) }, { opacity: 1, transform: P(x0, y0, 1), offset: .18 }, { opacity: 1, transform: P(x0, y0, .86), offset: .26 },
          { opacity: 1, transform: P(x1, y1, .86), offset: .68, easing: 'cubic-bezier(.4,0,.2,1)' }, { opacity: 0, transform: P(x1, y1, 1), offset: .82 }, { opacity: 0, transform: P(x1, y1, 1) }], loop));
      }
    }
    const fill = s => {
      card.querySelector('h3').textContent = s.t;
      card.querySelector('p').textContent = s.d;
      card.querySelector('.s-x').innerHTML = s.theme ? `<div class="c-seg" role="group" aria-label="Appearance">${THEMES.map(([v, n]) => `<button type="button" data-t="${v}" aria-pressed="${v === readTheme()}">${n}</button>`).join('')}</div>` : '';
      for (const b of card.querySelectorAll('.c-seg button')) b.onclick = () => { setTheme(b.dataset.t); card.querySelectorAll('.c-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      card.querySelector('.w-dots').innerHTML = list.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
      q('.s-back').hidden = i === 0;
      q('.s-next').textContent = i === list.length - 1 ? (opts.last || 'Get started') : 'Next';
    };
    async function show(s) {
      cur = null; card.classList.remove('on'); stopHand();
      await wait(240);
      let r = null;
      if (!s.theme) {
        s.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: still() ? 'auto' : 'smooth' });
        await wait(420); r = rectOf(s);
      }
      fill(s); setHole(r, s);
      await wait(r ? 450 : 250);
      placeCard(r); card.classList.add('on'); cur = s; last = r ? JSON.stringify(r) : '';
      if (r && s.g) gesture(s.g, r);
    }
    // the app may still be settling (a list arriving, a font): keep the spotlight on its control
    function relayout() {
      if (!cur || cur.theme || !el.isConnected) return;
      if (cur.demo) addDemo(cur.demo, hidden);   // the app redrew its list: the demo goes back in
      if (!onScreen(cur.el)) { const e = spotFind(cur.sel); if (!e) return; cur.el = e; }
      const r = rectOf(cur), k = JSON.stringify(r); if (k === last) return;
      last = k; setHole(r, cur); placeCard(r); if (cur.g) gesture(cur.g, r);
    }
    const go = async d => {
      if (busy) return; busy = true;
      try {
        let k = i + d;
        while (k >= 0 && k < list.length && !list[k].theme) {
          const s = list[k];
          if (s.demo) { s.demo.key = s.demo.key || id + k; addDemo(s.demo, hidden); }
          try { if (s.pre) await s.pre(); } catch {}
          const e = await spotWait(s.sel, s.pre || s.demo ? 1500 : 700);
          if (e) { s.el = e; break; }
          list.splice(k, 1); if (d < 0) k--;   // not on screen: passed over
        }
        if (k >= list.length) return close();
        if (k < 0) return;
        i = k; await show(list[i]);
      } finally { busy = false; }
    };
    q('.s-next').onclick = () => go(1);
    q('.s-back').onclick = () => go(-1);
    swiper(card, go);
    addEventListener('resize', relayout);
    ticker = setInterval(relayout, 300);
    // the welcome clears to the app, the spotlight starts as the whole screen and closes in
    el.classList.add('spot'); hole.classList.add('on');
    return wait(700).then(() => go(1));
  }

  // ===========================================================================
  // THE FLOWS
  // ===========================================================================
  // aOS, the first time: the AllisonOS name, the aOS mark, the apps, the tour.
  const play = () => { const v = shown(); return run('Welcome to AllisonOS', BRAND + MARK(v), () => markSeen('aos', latest()), async o => {
    o.el.classList.add('slow');
    await sceneName(o); await sceneMark(o, v); await sceneBurst(o); await tour(o, OS_TOUR());
  }); };
  // aOS, after a major update: the name and the new mark, then that release's cards.
  const playMajor = () => { const v = shown(), r = RELEASES.find(x => !x.silent) || RELEASES[0]; return run(`aOS${v}`, BRAND + MARK(v), () => markSeen('aos', latest()), async o => {
    o.el.classList.add('slow');
    await sceneName(o); await sceneMark(o, v); await sceneBurst(o);
    await tour(o, r.cards && r.cards.length ? r.cards : [{ x: 'notes', i: 'sparkle', h: esc(r.title || `aOS${v}`), notes: top([r], 5) }], 'Done');
  }); };
  // An app after an update: its icon, then aOS with the new number arriving.
  //   minor (aOS1 -> aOS1.1): the 1 stays and the new .1 rises in, lit (an old .x
  //     lifts away first); then what's new in this app. Nothing new here: nothing.
  //   major (aOS1.3 -> aOS2): the old number lifts away and the 2 rises in; then
  //     "Visit aOS" for what's new.
  function playUpdate(id, from, to = latest()) {
    // shows the newest release that isn't silent (a silent one is only logged); seen up to `to`
    const v = (RELEASES.find(r => !r.silent && cmp(r.v, to) <= 0) || { v: to }).v;
    const big = major(v) > major(from);
    const fresh = RELEASES.filter(r => !r.silent && cmp(r.v, from || '0') > 0 && cmp(r.v, to) <= 0);   // a silent release is only logged here
    const notes = big ? top(fresh) : top(fresh.map(r => (r.apps || {})[id]).filter(Boolean));
    if (!big && !notes.length) { markSeen(id, to); return Promise.resolve(); }   // nothing new to say
    // A walkthrough of what changed: the release's apps.<id>.tour, stops as in SPOTS (sel, t, d, g),
    // each at the control that is new or changed. After What's new, "Show me" plays it; a control
    // that isn't on screen is passed over, and with none on screen it simply ends.
    const stops = big ? [] : fresh.flatMap(r => { const e = (r.apps || {})[id]; return e && Array.isArray(e.tour) ? e.tour : []; }).map(x => Object.assign({}, x));
    const canShow = () => stops.some(x => spotFind(x.sel));
    const base = big ? '' : String(major(v)), newT = String(v).slice(base.length), oldT = big ? String(from) : String(from).slice(base.length);
    const ver = `<sup class="v-ver"><span class="v-ink">${esc(base)}</span><span class="v-tail"><span class="v-old v-ink">${esc(oldT)}</span><span class="v-new"><i class="v-halo"></i>${[...newT].map(ch => `<i>${esc(ch)}</i>`).join('')}</span></span></sup>`;
    const deco = `<i class="v-ring"></i><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span>`;
    const head = `<div class="w-stage" style="justify-content:flex-start;padding-top:16vh"><div class="a-head"><img class="a-icon on" src="${icon(id)}" alt="">
        <div class="v-mark minor on drop v-app"><span class="v-ink">aOS</span>${ver}${deco}</div></div></div>`;
    const lit = `aOS<sup>${esc(base)}<span class="h-new">${esc(newT)}</span></sup>`, name = esc(NAMES[id]);
    const first = big
      ? { x: 'notes', noart: true, h: `${name} is on ${lit}`, notes, more: 'Open aOS for everything new' }
      : { x: 'notes', noart: true, h: `What's new in ${name}`, dh: `${lit} · More power in your palm.`, notes, more: `Everything in aOS${esc(v)}` };
    return run(first.h.replace(/<[^>]+>/g, ''), head, () => { markSeen(id, to); if (spotEnd) spotEnd(); }, async o => {
      const m = o.el.querySelector('.v-mark.minor');
      const nw = m.querySelector('.v-new'), ow = m.querySelector('.v-old'), sup = m.querySelector('.v-ver');
      ow.style.width = ow.scrollWidth + 'px'; const w = [...nw.querySelectorAll('i:not(.v-halo)')].reduce((a, i) => a + i.offsetWidth, 0);
      await wait(still() ? 0 : 650);
      m.style.setProperty('--rx', (sup.offsetLeft + sup.offsetWidth - ow.offsetWidth + w - nw.offsetWidth) + 'px');
      nw.style.width = w + 'px'; ow.style.width = '0px'; m.classList.add('grow');
      await wait(still() ? 0 : 1300); m.classList.add('lit');
      if (!stops.length) return tour(o, [first], 'Done');
      await tour(o, [first], canShow() ? 'Show me' : 'Done', () => canShow() ? spotTour(o, id, { stops, last: 'Done' }) : o.close());
    });
  }
  // An app opened in Safari on iPhone, not from its Home Screen icon: how to add it.
  // "Not now" lets it be used in the browser; it asks again in a new tab.
  // Opened from aOS (the in-app Safari view an app tile opens), the steps stay, with
  // no Not now: the only way out is the view's ✕, back to aOS's tiles. So that view
  // never shows the app itself, and coming back to aOS later lands on aOS.
  // aOS has a choice to make first, since iOS takes its icon, status bar and address when it is
  // added: Vintage or Sea glass (aOS/look.js), and the Home Screen icon shown follows it.
  const LOOKS = [['vintage', 'Vintage', 'Mid-century, Retro colors'], ['glass', 'Sea glass', 'The original look']];
  const lookIcon = look => url(`../aOS/icon-${look === 'glass' ? 'glass-' : ''}512.png`);
  function playInstall(id = APP) {
    const k = 'aos.later.' + id, stay = ios && viaAOS() && id !== 'aos';   // Chrome has no in-app view to close: Not now
    try { if (!stay && sessionStorage.getItem(k)) return Promise.resolve(); } catch {}
    const name = NAMES[id] || 'aOS';
    return run(`Add ${name} to your Home Screen`, '', () => { try { sessionStorage.setItem(k, '1'); } catch {} }, async o => {
      o.q('.w-skip').hidden = true;
      const inst = { x: 'install', noart: true, stay, t: `Add ${name} to your Home Screen`, name, icon: icon(id) };
      if (id === 'aos' && ios && window.aosLook) {   // choose the look, then add it
        inst.icon = lookIcon(window.aosLook.get());
        const pick = { x: 'look', noart: true, t: 'Choose your look', d: 'Pick one before you add aOS: its icon on your Home Screen goes with it. You can change it later under your account.', onLook: l => { inst.icon = lookIcon(l); } };
        return tour(o, [pick, inst], 'Not now');
      }
      await tour(o, [inst], 'Not now');
    });
  }
  // An app's own walkthrough.
  const DARK_ONLY = ['weather'];   // drawn for dark only, like the iPhone's own Weather: no Light or dark card
  function playApp(id) {
    const T = TOURS[id]; if (!T) return Promise.resolve();
    const v = shown(), name = NAMES[id];
    const head = `<div class="w-stage"><div class="a-head"><img class="a-icon" src="${icon(id)}" alt="">
      <div class="c-word">${letters(name)}</div><div class="a-by">aOS<sup>${esc(v)}</sup></div><div class="a-tag">${esc(T.tag || '')}</div></div></div>`;
    // no install card: Safari showed how, and this plays once it's on the Home Screen. Light or dark
    // last: each app on the Home Screen keeps its own settings, so each one asks.
    const cards = [...T.cards, ...(DARK_ONLY.includes(id) ? [] : [{ x: 'theme', noart: true, t: 'Light or dark', d: `Follow your iPhone, or keep ${name} always light or always dark.` }])];
    return run(`Welcome to ${name}`, head, () => { markSeen(id, latest()); if (spotEnd) spotEnd(); }, async o => {
      await sceneApp(o, id);
      if (await spotsReady(id)) await spotTour(o, id); else await tour(o, cards);   // the live tour, or its cards if it can't find its way
    });
  }

  AOS.welcome = { play, playMajor, playApp, playUpdate, playInstall, theme: { read: readTheme, set: setTheme, list: THEMES }, lines: LINE, safariDemo, data: { RELEASES, TOURS, APPS, CORE, DESIGNS, VARIANTS, FAMILY: FAMILY_APPS, NAMES, latest, shown, cmp, major, dir: DIR, entry }, seen: () => !!(seenAll() || {}).aos };

  // ---- on this phone: an app on the Home Screen tells the family account ----
  // aOS shows ✓ Installed for it. The report needs this app's own session (each
  // Home Screen app keeps its own storage), so an app that has never signed in -
  // most don't need to - asks once, after its walkthrough or update, with the
  // family sign-in sheet (../home/account.js, loaded when needed). At most hourly (the
  // server writes it at most twice a day, or at once if aOS was told it was removed);
  // "Not now" isn't asked again.
  const SESSION = 'aos.session', ASKED = 'aos.signin.asked', REPORTED = 'aos.reported';
  const token = () => { try { return (JSON.parse(localStorage.getItem(SESSION) || 'null') || {}).token || null; } catch { return null; } };
  const api = p => url('../aOS/api/' + p);
  async function report() {
    const t = token(); if (!t) return false;
    let last = 0; try { last = +localStorage.getItem(REPORTED) || 0; } catch {}
    if (Date.now() - last < 3600e3) return true;
    try {
      const r = await fetch(api('installed'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app: APP }) });
      if (r.ok) localStorage.setItem(REPORTED, String(Date.now()));
    } catch {}
    return true;
  }
  // ---- moving into aOS 2: what an app keeps only on this phone, carried into aOS ----
  // Inside aOS (aOS/home-tab.js) every app keeps its data in aOS's storage, not its Home Screen
  // copy's, so it would open there without what it never syncs: Clock's alarms, Weather's cities,
  // Home's Home Assistant sign-in, each app's settings. An app opened from its own icon, signed in,
  // hands its keys (CARRY) to your account, at most once a day, until aOS has them (functions/aOS/api,
  // handoff). Not signed in, "lives in aOS now" (movedNote) asks you to, with Face ID. aOS takes
  // them for the app, once (handoff/take: then they're deleted there) and puts them in place
  // (aOS/home-tab.js). Never carried: Gmail's sign-in (an hour long; sign in once inside aOS) and
  // Ipsy's chats. (aos.carry2: the first aOS 2 dropped what came in, so every app sends again.)
  const CARRY = {   // app: [the key prefixes it keeps, the ones never carried]
    mail: [['mail.', 'design.mail'], ['mail.token', 'mail.state', 'mail.lastAuth', 'mail.pending', 'mail.openThread', 'mail.pushSynced']],
    calendar: [['allison-calendar-v1', 'calendar.private', 'design.calendar'], []],
    clock: [['allison-clock-v1'], []],
    news: [['news.', 'design.news'], ['news.data', 'news.table.cache', 'news.sport.catalog', 'news.scores.next']],
    weather: [['wx.', 'design.weather'], ['wx.cache', 'wx.pt']],
    notes: [['allison-notes-v1', 'design.notes'], []],
    podcasts: [['allison-podcasts-v1', 'design.podcasts'], []],
    travel: [['allison-travel-v1', 'design.travel'], []],
    places: [['allison-places-v1', 'design.places'], []],
    fitness: [['allison-fitness-v1', 'design.fitness'], []],
    drinks: [['allison-drinks-v1', 'design.drinks'], []],
    meals: [['allison-meals-v2', 'design.meals'], []],
    orders: [['allison-orders-v1', 'design.orders'], []],
    house: [['house.', 'design.house'], []],
  };
  const CARRY_MAX = 230 * 1024;          // what the account takes for one app (HANDOFF_MAX), with room to spare
  const CARRIED = 'aos.carry2.';         // + app: 'done' (aOS has it), else the day it was last sent
  const dayKey = () => new Date().toISOString().slice(0, 10);
  function carryKeys() {
    const [take, never] = CARRY[APP] || [[], []], out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (take.some(p => k.startsWith(p)) && !never.some(p => k.startsWith(p))) out[k] = localStorage.getItem(k);
      }
    } catch {}
    // too much for one app: leave out the biggest (synced data and caches, which come back anyway)
    let size = JSON.stringify(out).length;
    for (const k of Object.keys(out).sort((a, b) => out[b].length - out[a].length)) { if (size <= CARRY_MAX) break; size -= out[k].length + k.length + 6; delete out[k]; }
    return out;
  }
  // -> 'sent' (or sent today), 'done' (aOS has it), 'none' (nothing to move), 'signin', 'failed'
  let carrying = null;   // one at a time (GET state's and "lives in aOS now"'s)
  const carryOut = () => carrying || (carrying = sendCarry().finally(() => { carrying = null; }));
  async function sendCarry() {   // from the app's own Home Screen icon
    if (inHome || !CARRY[APP] || major(latest()) < 2) return 'none';
    const t = token(); if (!t) return 'signin';
    let st = ''; try { st = localStorage.getItem(CARRIED + APP) || ''; } catch {}
    if (st === 'done') return 'done';
    if (st === dayKey()) return 'sent';
    const data = carryKeys(); if (!Object.keys(data).length) return 'none';
    try {
      const r = await fetch(api('handoff'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app: APP, data }) });
      if (!r.ok) return 'failed';
      const j = await r.json();
      localStorage.setItem(CARRIED + APP, j.taken ? 'done' : dayKey());
      return j.taken ? 'done' : 'sent';
    } catch { return 'failed'; }
  }
  AOS.carry = { keys: carryKeys, out: carryOut };   // for the tests

  // Android Chrome can tell a page whether its own app is installed (getInstalledRelatedApps,
  // from the manifest's related_applications). Tapping an app in aOS that was removed from the
  // tablet opens it in a Chrome tab; there it says so, and aOS shows Get again. Opened in a tab
  // while it is installed, it says that too. Chrome only answers for the page's own app, and
  // at most 3 apps can be asked about per page, so aOS can't check every app itself. iOS has no
  // such call. Checked at most every 20 minutes; needs a sign-in (without one, it stays quiet).
  const IR = 'aos.ir.';
  async function androidCheck() {
    if (!android || !APP || !APPS.includes(APP) || standalone() || !navigator.getInstalledRelatedApps) return;
    const t = token(); if (!t) return;
    let last = 0; try { last = +localStorage.getItem(IR + APP) || 0; } catch {}
    if (Date.now() - last < 1200e3) return;
    let found; try { found = (await navigator.getInstalledRelatedApps()).some(a => a && a.platform === 'webapp'); } catch { return; }
    try { localStorage.setItem(IR + APP, String(Date.now())); } catch {}
    try { await fetch(api('installed'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(found ? { app: APP } : { app: APP, removed: true }) }); } catch {}
    return found;
  }
  const loadAccount = () => AOS.account ? Promise.resolve(AOS.account) : new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = url('account.js'); s.onload = () => ok(AOS.account); s.onerror = no; document.head.appendChild(s);
  });
  async function onPhone() {
    if (!standalone()) return androidCheck();   // a Chrome tab: is the app still on the tablet?
    if (!APP || !APPS.includes(APP) || viaAOS() || inHome) return;
    addEventListener('aos:account', e => { if (e.detail) report(); });   // signed in some other way (a locked route asked)
    if (await report()) return;
    try { if (localStorage.getItem(ASKED)) return; } catch { return; }
    let st; try { const r = await fetch(api('state'), { cache: 'no-store' }); if (!r.ok) return; st = await r.json(); } catch { return; }
    if (!st.storage || !st.setup) return;   // no family accounts yet: nothing to sign in to
    try { localStorage.setItem(ASKED, '1'); } catch {}
    const A = await loadAccount().catch(() => null);
    if (A && !token()) await A.prompt(`Sign in once, so aOS knows ${esc(NAMES[APP])} is on this phone.`);
  }

  // ---- Calendar's layers: what this app shows in your Calendar, kept in your account ----
  // On an iPhone each Home Screen app has its own storage, so Calendar can't read
  // Notes', Travel's, Fitness's or Mail's. Each of those calls AllisonOS.layer.share(app,
  // data) with just what Calendar shows, whenever it changes; this sends it to your own
  // family account (functions/aOS/api, POST layer) once things settle, only if this
  // app is signed in, and only when it differs from what was last sent (aos.layer.<app>
  // keeps a fingerprint: KV writes are scarce). Signed in later, it sends then.
  const LAYER_SENT = 'aos.layer.', layerLast = {}, layerJobs = {};
  const fingerprint = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + str.length; };
  async function sendLayer(app) {
    const t = token(), data = layerLast[app]; if (!t || !data) return;
    const json = JSON.stringify(data), fp = fingerprint(json);
    try { if (localStorage.getItem(LAYER_SENT + app) === fp) return; } catch {}
    try {
      const r = await fetch(api('layer'), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ app, data }) });
      if (r.ok) localStorage.setItem(LAYER_SENT + app, fp);
    } catch {}
  }
  function shareLayer(app, data) {
    layerLast[app] = data;
    clearTimeout(layerJobs[app]); layerJobs[app] = setTimeout(() => sendLayer(app), 3000);
  }
  addEventListener('aos:account', e => { if (e.detail) for (const app of Object.keys(layerLast)) sendLayer(app); });
  addEventListener('pagehide', () => { for (const app of Object.keys(layerJobs)) { clearTimeout(layerJobs[app]); sendLayer(app); } });
  AOS.layer = { share: shareLayer };

  // ---- the family's plan (aOS -> Subscription, just for fun) ----
  // The owner picks it in aOS and it's kept in the family account, since a Home Screen
  // app can't see aOS's storage. A cancelled plan runs to the end of its month, a trial
  // for 7 days (the server works out when: GET /aOS/api/state's plan.ends). After that
  // every app but aOS is switched off: a screen over the whole app, with the way back
  // to aOS, until a plan is chosen. Nothing is deleted: the app's data stays as it was,
  // there again when a plan starts. The last plan seen is kept (aos.plan) for offline.
  const PLAN = 'aos.plan', PLAN_NAMES = { proplus: 'Pro+', pro: 'Pro', trial: 'trial' };
  const planLive = p => !p || !p.ends || Date.now() < p.ends;
  let planTimer = 0;
  function showPlan(p) {
    clearTimeout(planTimer);
    const live = planLive(p), was = document.getElementById('aos-off');
    if (live) {
      if (was) was.remove();
      if (p && p.ends && p.ends - Date.now() < 864e5) planTimer = setTimeout(() => showPlan(p), p.ends - Date.now() + 500);   // ends while open
      return;
    }
    if (was) return;
    if (!document.getElementById('aos-off-css')) { const st = document.createElement('style'); st.id = 'aos-off-css'; st.textContent = OFF_CSS; document.head.appendChild(st); }
    const day = new Date(p.ends).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const el = document.createElement('div');
    el.id = 'aos-off'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `${NAMES[APP]} is off`);
    el.innerHTML = `<div class="o-card"><img src="${icon(APP)}" alt=""><h1>${esc(NAMES[APP])} is off</h1>
      <p>The family's ${esc(PLAN_NAMES[p.id] || 'plan')}${p.id === 'trial' ? '' : ' plan'} ended on ${esc(day)}, so every app but aOS is switched off.</p>
      <p>Choose ${p.id === 'trial' ? 'Pro or Pro+' : 'a plan'} in aOS, in your account under Subscription, to turn them back on. Nothing is deleted: everything is here when it starts again.</p>
      <a class="o-go" href="${url('../aOS/#subscription')}">Open aOS</a><small>Just for fun: nothing is charged.</small></div>`;
    document.body.appendChild(el);
  }
  async function checkPlan() {
    if (!APP || !APPS.includes(APP)) return;
    let p = null; try { p = JSON.parse(localStorage.getItem(PLAN) || 'null'); } catch {}
    showPlan(p);
    try {
      const t = token();   // signed in: the same call says if this app was asked to erase itself
      const r = await fetch(api('state'), { cache: 'no-store', headers: t ? { Authorization: 'Bearer ' + t } : {} }); if (!r.ok) return;
      const j = await r.json();
      if (j.erase && t && t === token()) return eraseHere(true);
      p = j.plan || null;
      try { p ? localStorage.setItem(PLAN, JSON.stringify(p)) : localStorage.removeItem(PLAN); } catch {}
      showPlan(p);
      if (standalone() && !viaAOS()) carryOut();   // aOS 2: hand over what this app keeps only on the phone
    } catch {}   // offline: the last plan seen stands
  }

  // ---- sign out and erase: a lost phone ----
  // aOS -> Account -> Lost a phone? asks the server to erase aOS from every other session of
  // yours (functions/aOS/api signout-others { erase: true }). Each app learns it here, the
  // next time it opens or comes back to the front online (checkPlan's GET state, sent with
  // this app's session, answers erase: true), and erases everything this app keeps on the
  // phone: its storage, its databases, its offline copy. Each Home Screen app has its own
  // storage on an iPhone, so each one erases itself as it is opened; one never opened again
  // keeps its data behind the phone's passcode. "Sign out and erase" in an app's own
  // Settings (Fitness's) and aOS's Lost a phone? page do the same for that app, at once.
  // What's in a Google Sheet or the family account stays: sign in on the new phone to get it back.
  const ERASED = 'aos.erased';
  async function eraseHere(remote) {
    const wipe = () => { try { localStorage.clear(); } catch {} };
    wipe();
    try { sessionStorage.clear(); sessionStorage.setItem(ERASED, remote ? 'remote' : 'here'); } catch {}
    try {
      const dbs = indexedDB.databases ? await indexedDB.databases() : [];
      await Promise.all(dbs.map(d => d && d.name && new Promise(ok => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => ok(); })));
    } catch {}
    try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch {}
    wipe();   // anything the app wrote back while that ran
    location.replace(location.pathname);
  }
  AOS.erase = remote => eraseHere(!!remote);   // remote: the server asked (aOS's own GET state, aOS/app.js)
  // After the reload: once, a card saying so.
  // aOS2: every app lives inside aOS. Opened from its own Home Screen icon (after its aOS2 screen, and
  // with nothing else on screen), an app says so, once a day: aOS is where it opens now, what it kept
  // on this phone moves there (carryOut, above), and how to take this icon off. No link to aOS: from
  // here it would open aOS in this icon's own storage, not the aOS on the Home Screen.
  async function movedNote() {
    if (!APP || !APPS.includes(APP) || inHome || !standalone() || major(latest()) < 2) return;
    if (document.getElementById('aos-welcome') || document.getElementById('aos-moved')) return;
    const KEY = 'aos.moved2.' + APP; let last = ''; try { last = localStorage.getItem(KEY) || ''; } catch {}
    const day = new Date().toISOString().slice(0, 10); if (last === day) return;
    try { localStorage.setItem(KEY, day); } catch {}
    const name = esc(NAMES[APP] || APP), el = document.createElement('div');
    const said = st => st === 'done' ? `aOS has what ${name} kept on this phone: open ${name} there.`
      : st === 'sent' ? `What ${name} keeps on this phone is on its way: open ${name} in aOS and it moves in.`
      : st === 'failed' ? `Couldn't move what ${name} keeps on this phone just now. Open ${name} here again when you're online.`
      : st === 'none' ? `${name} keeps nothing on this phone that needs moving.`
      : `Sign in, and what ${name} keeps on this phone moves into aOS.`;
    const st = await carryOut(), ask = st === 'signin', moving = said(st);
    el.id = 'aos-moved'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', NAMES[APP] + ' lives in aOS now');
    el.innerHTML = `<style>#aos-moved{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:24px;background:rgba(36,30,26,.55);font-family:"Futura","Futura-Medium","Avenir Next","Jost",system-ui,sans-serif}
      #aos-moved .m-card{position:relative;overflow:hidden;width:100%;max-width:380px;padding:26px 22px 20px;border-radius:28px;background:#F4ECDD;color:#2B2522;text-align:left}
      #aos-moved .m-card::before{content:'';position:absolute;right:-50px;top:-50px;width:140px;height:140px;border-radius:50%;background:#E3A72F}
      #aos-moved img{position:relative;width:64px;height:64px;border-radius:16px}
      #aos-moved h2{position:relative;margin:14px 0 4px;font-size:25px;font-weight:600;letter-spacing:-.02em}
      #aos-moved .m-bars{display:flex;gap:5px;margin:0 0 14px}#aos-moved .m-bars i{height:6px;border-radius:3px;background:#1F6F6B;width:28px}#aos-moved .m-bars i+i{width:14px;background:#E3A72F}#aos-moved .m-bars i+i+i{width:6px;background:#D8572A}
      #aos-moved p{margin:0 0 10px;font-size:16px;line-height:1.4;color:#5B4A3F}#aos-moved p b{color:#2B2522}
      #aos-moved button{width:100%;height:50px;margin-top:8px;border:0;border-radius:999px;background:#D8572A;color:#FFF8EC;font:inherit;font-size:17px;font-weight:600}
      #aos-moved .m-go+.m-not{height:40px;margin-top:4px;background:none;color:#5B4A3F;font-size:15px}</style>
      <div class="m-card"><img src="${icon(APP)}" alt=""><h2>${name} lives in aOS now</h2><div class="m-bars"><i></i><i></i><i></i></div>
        <p>Open <b>aOS</b> from your Home Screen: ${name} opens inside it, beside every other app, with Ipsy on Home.</p>
        <p class="m-move">${moving}</p>
        <p>Then you can take this icon off: press and hold it, then <b>Remove App</b>.</p>
        ${ask ? '<button type="button" class="m-go">Move my data with Face ID</button><button type="button" class="m-not">Not now</button>' : '<button type="button" class="m-not">OK</button>'}</div>`;
    el.querySelector('.m-not').onclick = () => el.remove();
    const go = el.querySelector('.m-go');
    if (go) go.onclick = async () => {
      const A = await loadAccount().catch(() => null);
      el.style.display = 'none';
      const ok = A && (token() || await A.prompt(`Sign in, and what ${name} keeps on this phone moves into aOS.`));
      el.style.display = '';
      if (!ok) return;
      const st = await carryOut();
      el.querySelector('.m-move').innerHTML = said(st);
      go.remove(); el.querySelector('.m-not').textContent = 'OK';
    };
    document.body.appendChild(el);
  }
  function erasedNote() {
    let how = null; try { how = sessionStorage.getItem(ERASED); sessionStorage.removeItem(ERASED); } catch {}
    if (!how) return false;
    try { localStorage.clear(); } catch {}
    if (!document.getElementById('aos-off-css')) { const st = document.createElement('style'); st.id = 'aos-off-css'; st.textContent = OFF_CSS; document.head.appendChild(st); }
    const el = document.createElement('div');
    el.id = 'aos-off'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Erased');
    el.innerHTML = `<div class="o-card"><h1>Signed out and erased</h1>
      <p>${how === 'remote' ? 'You asked aOS to erase itself from your other devices, so ' + esc(NAMES[APP] || 'this app') + ' has erased what it kept on this phone.' : esc(NAMES[APP] || 'This app') + ' has erased what it kept on this phone.'}</p>
      <p>Anything backed up to a Google Sheet or your family account is still there. Sign in again to get it back.</p>
      <a class="o-go" href="${esc(location.pathname)}">OK</a></div>`;
    el.querySelector('.o-go').onclick = e => { e.preventDefault(); el.remove(); };
    document.body.appendChild(el);
    return true;
  }
  const OFF_CSS = `
#aos-off { position: fixed; inset: 0; z-index: 2147483600; display: grid; place-items: center; padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-align: center;
  --o-bg: #0D1213; --o-text: #EEF4F2; --o-muted: rgba(238,244,242,.6); --o-card: rgba(255,255,255,.06); --o-edge: rgba(255,255,255,.1);
  --o-pastel: linear-gradient(100deg, #A9D3C7 0%, #B9C6E0 34%, #E3C5C3 67%, #E9D6B4 100%);
  background: var(--o-bg); color: var(--o-text); }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) #aos-off { --o-bg: #EEF2F0; --o-text: #10181A; --o-muted: rgba(16,24,26,.64); --o-card: rgba(255,255,255,.78); --o-edge: rgba(16,24,26,.08); } }
html[data-theme="light"] #aos-off { --o-bg: #EEF2F0; --o-text: #10181A; --o-muted: rgba(16,24,26,.64); --o-card: rgba(255,255,255,.78); --o-edge: rgba(16,24,26,.08); }
#aos-off * { box-sizing: border-box; }
#aos-off .o-card { width: 100%; max-width: 380px; padding: 28px 22px 22px; border-radius: 28px; background: var(--o-card); box-shadow: inset 0 0 0 1px var(--o-edge); }
#aos-off img { width: 76px; height: 76px; border-radius: 20px; filter: grayscale(1); opacity: .55; }
#aos-off h1 { margin: 14px 0 8px; font-size: 26px; letter-spacing: -.4px; }
#aos-off p { margin: 0 0 10px; font-size: 16px; line-height: 1.4; color: var(--o-muted); }
#aos-off .o-go { display: block; margin: 18px 0 12px; height: 50px; line-height: 50px; border-radius: 16px; background: var(--o-pastel); color: #10181A; font-size: 17px; font-weight: 700; text-decoration: none; }
#aos-off small { font-size: 13px; color: var(--o-muted); }`;

  // ---- the way out, within reach: a popup's Back, Close or Done, floating at the bottom ----
  // An app's popups (role="dialog" aria-modal="true": a trip, an order, Settings) keep their way out at the
  // top. While one is open, it floats at the bottom left too (where Ipsy sits on the front page; Ipsy is
  // under the popup): a copy that presses the popup's own button, so the app does what it always does
  // (saves, goes back a step). Back first, then Close, then Done, but only on a popup with no Cancel (a Done
  // beside Cancel saves an edit; it isn't a way out). Hidden while typing (the keyboard is up), under aOS's
  // own screens, Ipsy's chat and sign-in, and on a popup marked data-nofloat.
  const FB_ICON = {
    back: '<path d="M15.2 4.8L8.6 11.3a1 1 0 0 0 0 1.4l6.6 6.5"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    done: '<path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/>',
  };
  const FB_CSS = `
.aos-fback{position:fixed;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:50;
  width:52px;height:52px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;
  color:#1d1d1f;background:rgba(255,255,255,.78);-webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);
  box-shadow:0 6px 20px rgba(0,0,0,.18),inset 0 0 0 .5px rgba(255,255,255,.7);transition:transform .2s,opacity .2s;animation:aos-fb-in .28s cubic-bezier(.3,1.3,.5,1)}
.aos-fback[hidden]{display:none}
.aos-fback:active{transform:scale(.92)}
.aos-fback svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
html[data-theme="dark"] .aos-fback{color:#fff;background:rgba(44,44,48,.8);box-shadow:0 6px 20px rgba(0,0,0,.4),inset 0 0 0 .5px rgba(255,255,255,.18)}
@media (prefers-color-scheme: dark){html:not([data-theme="light"]) .aos-fback{color:#fff;background:rgba(44,44,48,.8);box-shadow:0 6px 20px rgba(0,0,0,.4),inset 0 0 0 .5px rgba(255,255,255,.18)}}
html[data-look="vintage"] .aos-fback{color:var(--text,#2B2522);background:var(--mc-card,#FBF3E2);-webkit-backdrop-filter:none;backdrop-filter:none;
  box-shadow:inset 0 0 0 1.5px var(--mc-edge,rgba(43,37,34,.22)),0 4px 14px rgba(43,37,34,.18)}
@keyframes aos-fb-in{from{transform:scale(.6);opacity:0}}
@media (prefers-reduced-motion: reduce){.aos-fback{animation:none;transition:none}}`;
  function floatBack() {
    const SHARED = '#aos-welcome, #aos-off, #aos-moved, #aos-signin, .ipsy-bubble';
    const RANK = [['back', /^back\b/i], ['close', /^close\b/i], ['done', /^done$/i]];
    let fb = null, src = null, queued = false;
    const label = b => (b.getAttribute('aria-label') || b.textContent || '').trim();
    // on screen: not hidden, and not slid away below or above it
    const onScreen = el => {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.top < innerHeight - 40 && r.bottom > 40 && r.width > 0;
    };
    const typing = () => { const a = document.activeElement; return !!a && (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset)$/i.test(a.type))); };
    // The popup's way out, among the buttons in its head (its top 140 points).
    function wayOut(dlg) {
      const top = dlg.getBoundingClientRect().top + 140;
      const btns = [...dlg.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length && b.getBoundingClientRect().top < top);
      const cancel = btns.some(b => /^cancel\b/i.test(label(b)));
      for (const [kind, re] of RANK) {
        if (kind === 'done' && cancel) continue;
        const b = btns.find(x => re.test(label(x)));
        if (b) return { b, kind };
      }
      return null;
    }
    // room at the bottom of the popup's scrolling part, so the button never sits on its last row
    function makeRoom(dlg) {
      let best = null;
      for (const el of [dlg, ...dlg.querySelectorAll('*')]) {
        if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) || !el.clientHeight) continue;
        if (!best || el.clientHeight > best.clientHeight) best = el;
      }
      if (!best || best.dataset.aosRoom) return;
      best.dataset.aosRoom = '1';
      best.style.paddingBottom = 'calc(' + getComputedStyle(best).paddingBottom + ' + 64px)';
    }
    function update() {
      queued = false;
      const open = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(onScreen);
      const dlg = open[open.length - 1];
      const way = dlg && !dlg.closest(SHARED) && !dlg.closest('[data-nofloat]') && !typing() ? wayOut(dlg) : null;
      if (!way) { if (fb) fb.hidden = true; src = null; return; }
      if (!fb) {
        if (!document.getElementById('aos-fb-css')) { const st = document.createElement('style'); st.id = 'aos-fb-css'; st.textContent = FB_CSS; document.head.appendChild(st); }
        fb = document.createElement('button');
        fb.type = 'button'; fb.className = 'aos-fback';
        fb.addEventListener('click', () => { if (src && document.contains(src)) src.click(); soon(); });
        document.body.appendChild(fb);
      }
      if (fb.dataset.kind !== way.kind) { fb.dataset.kind = way.kind; fb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + FB_ICON[way.kind] + '</svg>'; }
      fb.setAttribute('aria-label', label(way.b));
      src = way.b;
      if (fb.hidden) fb.hidden = false;
      makeRoom(dlg);
    }
    const soon = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    new MutationObserver(muts => { if (muts.some(m => !(fb && fb.contains(m.target)))) soon(); })
      .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'open', 'aria-hidden', 'disabled'] });
    for (const ev of ['transitionend', 'animationend', 'focusin', 'focusout', 'resize']) addEventListener(ev, soon, true);
    soon();
    AOS.floatBack = update;   // for tests
  }

  // ---- deciding what to show, once ----
  function auto() {
    const seen = seenAll(); if (!seen || !APP || APP === 'home') return;   // home: the retired launcher
    // On iPhone, Safari or the Home Screen? (display-mode: standalone, or navigator.standalone)
    // In Safari: how to add it. From the Home Screen: the welcome, walkthrough or update.
    if (ios && (!standalone() || viaAOS())) return playInstall(APP);
    // On Android too, an app's walkthrough waits until it's installed; in Chrome, how to install it.
    if (android && APP !== 'aos' && !standalone()) return playInstall(APP);
    const v = latest(), s = seen[APP];
    // only silent releases since: note them as seen and say nothing
    if (s && cmp(v, s) > 0 && RELEASES.filter(r => cmp(r.v, s) > 0 && cmp(r.v, v) <= 0).every(r => r.silent)) { markSeen(APP, v); return; }
    if (APP === 'aos') {
      // an invite opened in the browser: the account first (aOS's own page), then how to add aOS
      if (!standalone() && /[#&]invite=/.test(location.hash)) return;
      if (!s) return play();
      if (major(v) > major(s)) return playMajor();
      if (cmp(v, s) > 0) return playUpdate('aos', s, v);   // a minor one: nothing, unless the release names aOS in its apps
      return;
    }
    if (!TOURS[APP]) return;
    if (!s) return playApp(APP);
    if (cmp(v, s) > 0) return playUpdate(APP, s, v);
  }
  // Back from Google's sign-in, which took the whole aOS window (each app's toGoogle: Google's page
  // can't open in a frame): the app has its token by now (its own script read it), so back into aOS,
  // where it opens again. Only within ten minutes of leaving, so a sign-in given up on doesn't pull
  // the app's own Home Screen copy into aOS later.
  function backToAOS() {
    if (window.top !== window || !APP) return false;
    let away = ''; try { away = localStorage.getItem('aos.away') || ''; localStorage.removeItem('aos.away'); } catch {}
    const [app, at] = away.split('|');
    if (app !== APP || !(Date.now() - +at < 600e3)) return false;
    location.replace('../aOS/#app=' + APP);
    return true;
  }
  if (me && me.hasAttribute('data-auto')) {
    const go = () => { if (erasedNote() || backToAOS()) return; checkPlan(); if (APP && APP !== 'aos' && APP !== 'home') floatBack(); Promise.resolve(auto()).catch(() => {}).then(onPhone).catch(() => {}).then(movedNote).catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPlan(); });   // back from aOS, or a day later
    addEventListener('online', () => checkPlan());   // a phone kept offline hears of an erase as soon as it's back
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  }
})();
