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
        'aOS shows two collections: the core apps (Weather, Notes, News, Mail and Calendar) and the Allison family apps',
        'Small buttons are easier to tap: header buttons, arrows, chips and Get take a tap a little way round them, looking just as before',
        'News keeps its last headlines up if the news sources can\'t be reached for a while',
        'Meals: a new app for the family\'s dinners: this week\'s Whole Foods deals sorted like a grocery list, a few nights of different dinners around one meat, and the shopping list'],
      cards: [
        { i: 'grid', t: 'Meet aOS', d: 'aOS is the home for every app: open it to add the ones you want, and to see what\'s new.' },
        { i: 'sparkle', t: 'A tour in every app', d: 'The first time you open an app, it shows you around. When it gets something new, it tells you.' },
        { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep aOS always light or always dark.' },
      ],
      apps: {
        meals: { highlights: ['New: a few nights of different dinners, built around one meat', 'This week\'s Whole Foods deals, sorted like a grocery list', 'One shopping list, checked against the family\'s allergies'] },
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
  const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'house'];
  // Two collections: the core apps everyone gets, and the Allison family's own. aOS shows them
  // apart, core first, in this order (APPS keeps its order: the accounts server lists the same).
  const CORE = ['weather', 'notes', 'news', 'mail', 'calendar'];
  const FAMILY_APPS = APPS.filter(id => !CORE.includes(id));
  const BY_GROUP = [...CORE, ...FAMILY_APPS];
  const NAMES = { aos: 'aOS', home: 'AllisonOS', mail: 'Mail', calendar: 'Calendar', news: 'News', weather: 'Weather', notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel', places: 'Places', fitness: 'Fitness', drinks: 'Drinks', meals: 'Meals', house: 'Home' };
  // Each app's walkthrough (written from its README): a tagline and its cards.
  const TOURS = {
    "mail": {
      "tag": "A calmer Gmail inbox",
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
          "i": "star",
          "t": "Follow your teams",
          "d": "On Sport, pick the sports, competitions and teams you follow, or tap a team button to see just their news."
        },
        {
          "i": "bolt",
          "t": "Live scores",
          "d": "Switch Sport to Scores for live results, upcoming fixtures and where to watch on US TV."
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
          "d": "Pins show blue for Want to go and gold for Been. Touch and hold anywhere on the map to add a spot."
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
          "d": "Tap the week's number to compare this week or month with the one before, with your alcohol-free streak."
        },
        {
          "i": "lock",
          "t": "Private to you",
          "d": "Signed in, your log is kept in your family account where only you can see it, and follows you to another phone."
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
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
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
    { noart: true, t: 'Everything in one place', d: 'The core apps, Weather, Notes, News, Mail and Calendar, and the Allison family\'s own, Podcasts, Travel, Places, Fitness, Drinks, Meals and Home, all in aOS. And they work together for continuity: your trips, reminders and notes show up in Calendar, a booking opens its email, and Home knows the weather.' },
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
}`;

  // ---- the overlay ----
  let open = null;
  function mount(label, inner, resolve, onClose) {
    if (!document.getElementById('aos-welcome-css')) {
      const st = document.createElement('style'); st.id = 'aos-welcome-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.id = 'aos-welcome'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
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
  // The apps burst out of the mark into a 5 x 2 grid at the top; the mark settles
  // between them and the panel.
  async function sceneBurst(o) {
    const { el, q } = o, fly = q('.c-fly'), box = el.getBoundingClientRect(), m = o.mark.word.getBoundingClientRect();
    const imgs = BY_GROUP.map(id => { const im = new Image(); im.src = icon(id); im.alt = ''; fly.appendChild(im); return im; });
    const at = (im, x, y, size) => { im.style.width = im.style.height = size + 'px'; im.style.left = (x - size / 2 - box.left) + 'px'; im.style.top = (y - size / 2 - box.top) + 'px'; };
    imgs.forEach(im => at(im, m.left + m.width / 2, m.top + m.height / 2, 20));
    const S = Math.min(56, (box.width - 32 - 4 * 14) / 5), G = 14, gy = box.top + Math.max(110, box.height * 0.2) + 20;
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
  // ('theme' | 'install' | 'store' | 'notes'), name (install), notes (notes) }.
  async function tour(o, cards, last = 'Get started') {
    const { el, q, close } = o, body = q('.c-body');
    let i = 0;
    q('.w-dots').innerHTML = cards.length > 1 ? cards.map((_, j) => `<i class="${j ? '' : 'on'}"></i>`).join('') : '';
    const draw = () => {
      const c = cards[i];
      el.classList.toggle('tall', c.x === 'install' || !!c.tall);
      const extra = c.x === 'theme' ? `<div class="c-seg" role="group" aria-label="Appearance">${THEMES.map(([v, n]) => `<button type="button" data-t="${v}" aria-pressed="${v === readTheme()}">${n}</button>`).join('')}</div>`
        : c.x === 'store' ? `<a class="c-link" href="${url('../aOS/')}">Open aOS</a>`
        : c.x === 'notes' ? `<ul class="c-notes">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>${c.more ? `<a class="c-link" href="${url('../aOS/#whats-new')}">${c.more}</a>` : ''}` : '';
      body.innerHTML = `${c.noart ? '' : `<div class="c-art">${lineSvg(c.i)}</div>`}<h2>${c.h || esc(c.t)}</h2>${c.x === 'install' ? steps(c.name) : c.dh ? `<p>${c.dh}</p>` : c.d ? `<p>${esc(c.d)}</p>` : ''}${extra}`;
      for (const b of body.querySelectorAll('.c-seg button')) b.onclick = () => { setTheme(b.dataset.t); body.querySelectorAll('.c-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
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
      if (i + d >= cards.length) return close();
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
    { sel: '#tabs', t: 'News by topic', d: 'Browse the latest headlines from free sources across World, UK, US, Business, Tech, AI, Science and more.', g: 'swipe-left' },
    { sel: ['#feed > .lead', '#feed .list > .row'], t: 'Tap to read', d: 'Stories are newest first and each shows only once. Tap one to read the full article on the publisher’s site.', g: 'tap' },
    { sel: '#tabs [data-topic="sport"]', t: 'Follow your teams', d: 'On Sport, pick the sports, competitions and teams you follow, or tap a team button to see just their news.', g: 'tap' },
    { sel: '#tabs [data-topic="sport"]', t: 'Live scores', d: 'Switch Sport to Scores for live results, upcoming fixtures and where to watch on US TV.' },
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
  SPOTS.places = { stops: [
    { sel: '#seg', t: 'Want to go and Been', d: 'Keep two lists: places you want to try and places you’ve been. Tap Been to move a place across.', g: 'tap' },
    { sel: '#map', focus: [.5, .58, 190, 190], r: 95, t: 'Your places on a map', d: 'Pins show blue for Want to go and gold for Been. Touch and hold anywhere on the map to add a spot.', g: 'hold' },
    { sel: '#filterWrap', t: 'Find somewhere new', d: 'Search "tacos" or a name to find nearby businesses, or zoom in to see food, things to do and shops.', g: 'tap' },
    { sel: '#fab', t: 'Rate and remember', d: 'Add stars, price and notes with #tags, and Places keeps track of every visit.', g: 'tap' },
  ] };
  SPOTS.fitness = { stops: [
    { sel: ['#main .week', '#main .navrow'], t: 'Your week at a glance', d: 'Each day shows the muscle groups you worked and how many sets. Swipe sideways to move a week at a time.', g: 'swipe-left' },
    { sel: '#fab', t: 'Log in seconds', d: 'Search an exercise, like "db curl", and last time’s weight, reps and sets fill in for you.', g: 'tap' },
    { sel: ['#main .drow.today', '#fab'], t: 'Cardio counts too', d: 'Log time and distance on the treadmill, bikes, rower, track or pool alongside your lifting.', g: 'tap' },
    { sel: ['#viewBtn', '#vbar'], t: 'See your progress', d: 'Analysis compares this week or month with the one before, showing what’s improving and what needs work.', g: 'tap' },
  ] };
  SPOTS.drinks = { stops: [
    { sel: ['#main .rgroup.week', '#main .week'], t: 'Your week', d: 'Each day shows its standard drinks or alcohol-free. Swipe sideways to move a week at a time.', g: 'swipe-left' },
    { sel: '#sumBtn', t: 'Your week in one number', d: 'The week adds up here against the limit you set.' },
    { sel: '#fab', t: 'One tap to log', d: 'Your usual drinks sit in each day as tiles. Tap one to log it, or Something else for anything new.', g: 'tap' },
    { sel: '#sumBtn', t: 'How it’s going', d: 'Tap the week’s number to compare this week or month with the one before, with your alcohol-free streak.', g: 'tap' },
    { sel: '#moreBtn', t: 'Private to you', d: 'Signed in, your log is kept in your family account where only you can see it, and follows you to another phone. Sign in and set your goals here.', g: 'tap' },
  ] };
  SPOTS.meals = { stops: [
    { sel: ['#main .card', '#tabs'], t: 'Shared with the family', d: 'Your family’s dinners: everyone signed in sees the same plan and deals.' },
    { sel: '#fab', t: 'A week of dinners', d: 'Tap + and pick a meat, and Meals plans a few nights of different dinners for the family, each a different cuisine. Tap a night for its recipe.', g: 'tap' },
    { sel: '#tabs [data-tab="deals"]', t: 'This week’s deals', d: 'Your Whole Foods’ sales, found for you or pasted from its app, sorted like a grocery list.', g: 'tap' },
    { sel: '#tabs [data-tab="list"]', t: 'One shopping list', d: 'Everything the dinners need in one list, sorted by aisle, with what’s on sale. Tick it off in the store.', g: 'tap' },
    { sel: '#setBtn', t: 'Safe for the family', d: 'Every plan is checked against your family’s allergies before it’s kept. Set them, and your store, here.', g: 'tap' },
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

  function spotTour(o, id) {
    const { el, q, close } = o, S = SPOTS[id], name = NAMES[id];
    const list = [...S.stops, ...(DARK_ONLY.includes(id) ? [] : [{ theme: true, t: 'Light or dark', d: `Follow your ${ios ? 'iPhone' : 'device'}, or keep ${name} always light or always dark. Try it: ${name} changes behind this.` }])];
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
      q('.s-next').textContent = i === list.length - 1 ? 'Get started' : 'Next';
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
    const base = big ? '' : String(major(v)), newT = String(v).slice(base.length), oldT = big ? String(from) : String(from).slice(base.length);
    const ver = `<sup class="v-ver"><span class="v-ink">${esc(base)}</span><span class="v-tail"><span class="v-old v-ink">${esc(oldT)}</span><span class="v-new"><i class="v-halo"></i>${[...newT].map(ch => `<i>${esc(ch)}</i>`).join('')}</span></span></sup>`;
    const deco = `<i class="v-ring"></i><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span>`;
    const head = `<div class="w-stage" style="justify-content:flex-start;padding-top:16vh"><div class="a-head"><img class="a-icon on" src="${icon(id)}" alt="">
        <div class="v-mark minor on drop v-app"><span class="v-ink">aOS</span>${ver}${deco}</div></div></div>`;
    const lit = `aOS<sup>${esc(base)}<span class="h-new">${esc(newT)}</span></sup>`, name = esc(NAMES[id]);
    const first = big
      ? { x: 'notes', noart: true, h: `${name} is on ${lit}`, notes, more: 'Open aOS for everything new' }
      : { x: 'notes', noart: true, h: `What's new in ${name}`, dh: `${lit} · More power in your palm.`, notes, more: `Everything in aOS${esc(v)}` };
    return run(first.h.replace(/<[^>]+>/g, ''), head, () => markSeen(id, to), async o => {
      const m = o.el.querySelector('.v-mark.minor');
      const nw = m.querySelector('.v-new'), ow = m.querySelector('.v-old'), sup = m.querySelector('.v-ver');
      ow.style.width = ow.scrollWidth + 'px'; const w = [...nw.querySelectorAll('i:not(.v-halo)')].reduce((a, i) => a + i.offsetWidth, 0);
      await wait(still() ? 0 : 650);
      m.style.setProperty('--rx', (sup.offsetLeft + sup.offsetWidth - ow.offsetWidth + w - nw.offsetWidth) + 'px');
      nw.style.width = w + 'px'; ow.style.width = '0px'; m.classList.add('grow');
      await wait(still() ? 0 : 1300); m.classList.add('lit');
      await tour(o, [first], 'Done');
    });
  }
  // An app opened in Safari on iPhone, not from its Home Screen icon: how to add it.
  // "Not now" lets it be used in the browser; it asks again in a new tab.
  // Opened from aOS (the in-app Safari view an app tile opens), the steps stay, with
  // no Not now: the only way out is the view's ✕, back to aOS's tiles. So that view
  // never shows the app itself, and coming back to aOS later lands on aOS.
  function playInstall(id = APP) {
    const k = 'aos.later.' + id, stay = ios && viaAOS() && id !== 'aos';   // Chrome has no in-app view to close: Not now
    try { if (!stay && sessionStorage.getItem(k)) return Promise.resolve(); } catch {}
    const name = NAMES[id] || 'aOS';
    return run(`Add ${name} to your Home Screen`, '', () => { try { sessionStorage.setItem(k, '1'); } catch {} }, async o => {
      o.q('.w-skip').hidden = true;
      await tour(o, [{ x: 'install', noart: true, stay, t: `Add ${name} to your Home Screen`, name, icon: icon(id) }], 'Not now');
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

  AOS.welcome = { play, playMajor, playApp, playUpdate, playInstall, theme: { read: readTheme, set: setTheme, list: THEMES }, lines: LINE, safariDemo, data: { RELEASES, TOURS, APPS, CORE, FAMILY: FAMILY_APPS, NAMES, latest, shown, cmp, major, dir: DIR, entry }, seen: () => !!(seenAll() || {}).aos };

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
  const loadAccount = () => AOS.account ? Promise.resolve(AOS.account) : new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = url('account.js'); s.onload = () => ok(AOS.account); s.onerror = no; document.head.appendChild(s);
  });
  async function onPhone() {
    if (!APP || !APPS.includes(APP) || !standalone() || viaAOS()) return;
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
      const r = await fetch(api('state'), { cache: 'no-store' }); if (!r.ok) return;
      p = (await r.json()).plan || null;
      try { p ? localStorage.setItem(PLAN, JSON.stringify(p)) : localStorage.removeItem(PLAN); } catch {}
      showPlan(p);
    } catch {}   // offline: the last plan seen stands
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
      if (cmp(v, s) > 0) markSeen('aos', v);   // a minor one: aOS says nothing, the apps do
      return;
    }
    if (!TOURS[APP]) return;
    if (!s) return playApp(APP);
    if (cmp(v, s) > 0) return playUpdate(APP, s, v);
  }
  if (me && me.hasAttribute('data-auto')) {
    const go = () => { checkPlan(); Promise.resolve(auto()).catch(() => {}).then(onPhone).catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPlan(); });   // back from aOS, or a day later
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  }
})();
