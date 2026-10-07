// aOS: AllisonOS's welcome, walkthroughs and update screens, shared by every app.
//
// Every app loads it from the launcher's folder, as it does back.js, and says
// which app it is:
//   <script src="../home/welcome.js" data-app="weather" data-auto defer></script>
// With data-auto it decides by itself, once per device, what (if anything) to
// show, from the release log below and what this device has seen (localStorage
// aos.seen, { app: version }, shared by every app on the site):
//
//   aOS itself (data-app "aos", the aOS app; and "home", the launcher)
//     first time      the AllisonOS welcome: the name, then the version mark
//                     (aOS with a superscript 1 that drops in and shines) and
//                     "The Power of aOS1", the apps bursting out of it, and the
//                     tour (setup: Light or dark, how to install, aOS for apps)
//     major update    (aOS1 -> aOS2) the name and the new version mark, then
//                     that release's setup cards, if it has any
//     minor update    (aOS1 -> aOS1.1) one screen: "aOS1 updated to aOS1.1.
//                     More power in your palm." and its notes
//   any other app (data-app "weather", "fitness", ...)
//     first time      that app's own walkthrough: its icon and name, then what
//                     it does, card by card (and how to add it, in a browser)
//     its own update  what's new in that app, if that release has anything to
//                     show; an app with nothing new shows nothing
//
// Without data-auto (welcome-lab.html, the aOS app's buttons) nothing plays
// until asked:
//   AllisonOS.welcome.play()              the AllisonOS welcome
//   AllisonOS.welcome.playApp('weather')  an app's walkthrough
//   AllisonOS.welcome.playUpdate(app, from, to)
//   AllisonOS.welcome.data                releases, tours, names (the aOS app reads it)
//
// The look is Quiet type (design C, picked in the Welcome Lab): pastel ink on a
// plain page, a hairline, one glass panel for the words. It follows light and
// dark, and the Appearance chosen in it (System / Light / Dark, the launcher's
// own setting home.settings.theme, applied by every app that loads this). With
// Reduce Motion it is plain fades. Skip ends it at any point; all its styles are
// scoped to #aos-welcome.
//
// iPhone: an app added to the Home Screen on its own keeps its own storage, so
// "first time" counts per install there; apps opened from the launcher or aOS
// share one.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  const me = document.currentScript;
  const BASE = (me && me.src) || location.href;
  const APP = (me && me.dataset.app) || null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 250) : ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ===========================================================================
  // THE RELEASE LOG. Newest first, per app; "aos" is AllisonOS itself. A major
  // aOS version (1, 2, ...) replays the name and the new mark; a minor one
  // (1.1) is a single screen. For an app, a release with cards shows them as
  // "What's new"; one without shows nothing. Add a release here (and bump the
  // app's sw.js cache) to announce it.
  // ===========================================================================
  const RELEASES = {
    aos: [
      { v: '1', date: '2026-10-07', title: 'The Power of aOS1',
        notes: ['aOS: one place for every AllisonOS app', 'A walkthrough in every app', 'Light, dark or System, chosen once'],
        cards: [
          { i: 'grid', t: 'Meet aOS', d: 'aOS is the new home for every app: open it to add the ones you want, and to see what\'s new.' },
          { i: 'sparkle', t: 'A tour in every app', d: 'The first time you open an app, it shows you around. When it gets something new, it tells you.' },
          { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep AllisonOS always light or always dark.' },
        ] },
    ],
  };
  // The apps, as the launcher orders them; house is shown as Home.
  const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'house'];
  const NAMES = { aos: 'aOS', home: 'AllisonOS', mail: 'Mail', calendar: 'Calendar', news: 'News', weather: 'Weather', notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel', places: 'Places', fitness: 'Fitness', house: 'Home' };
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
          "d": "Type a #tag anywhere to file a note into a collection. Pin, colour and search your notes too."
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
          "d": "Home shows what's playing, your queue, episodes you're part way through, and new episodes from your shows."
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
          "d": "Connect Gmail and your flight, hotel and car hire confirmations become trips on their own."
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
  for (const id of APPS) if (!RELEASES[id]) RELEASES[id] = [{ v: '1', date: '2026-10-07' }];   // every app starts at 1, nothing new to show

  // ---- versions ----
  const parts = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
  const cmp = (a, b) => { const A = parts(a), B = parts(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; };
  const major = v => parts(v)[0];
  const latest = id => (RELEASES[id] && RELEASES[id][0].v) || '1';
  const supV = v => `aOS<sup>${esc(v)}</sup>`;
  // What this device has seen: { app: version }. The old welcome flag counts as having
  // met AllisonOS before aOS had versions.
  const SEEN = 'aos.seen';
  const seenAll = () => { try { return JSON.parse(localStorage.getItem(SEEN)) || {}; } catch { return null; } };   // null: no storage, never nag
  const markSeen = (id, v) => { try { const s = seenAll() || {}; s[id] = v; localStorage.setItem(SEEN, JSON.stringify(s)); localStorage.setItem('aos.welcomed', localStorage.getItem('aos.welcomed') || String(Date.now())); } catch {} };
  const metBefore = () => { try { return !!localStorage.getItem('aos.welcomed'); } catch { return true; } };

  // ---- Appearance: the launcher's own setting, shared by every app on the site ----
  const THEMES = [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  const readTheme = () => { try { const t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; return ['light', 'dark'].includes(t) ? t : 'auto'; } catch { return 'auto'; } };
  const applyTheme = t => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); };
  function setTheme(t) {
    try { const s = JSON.parse(localStorage.getItem('home.settings')) || {}; s.theme = t; localStorage.setItem('home.settings', JSON.stringify(s)); } catch {}
    applyTheme(t);
    dispatchEvent(new CustomEvent('aos:theme', { detail: t }));   // the launcher, if this is it, updates its Settings
  }
  applyTheme(readTheme());   // every app, every time

  // ---- installing ----
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvt = null;   // Chrome and Edge's own prompt, kept for the Install button
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  function steps(name) {
    if (installEvt) return `<p>Add ${esc(name)} to this device, so it opens on its own like any other app.</p><button class="w-btn c-install" type="button">Install</button>`;
    if (!ios) return `<p>Use your browser's <b>Install</b> or <b>Add to Home Screen</b> option, in its menu, to keep ${esc(name)} on this device like an app.</p>`;
    return `<p>Add ${esc(name)} to your Home Screen so it opens like an app, full screen:</p><ol class="c-steps">
      <li>In Safari, tap <b>•••</b> by the address bar, then <b>Share</b> <small>(on older iOS, tap Share <svg class="c-share" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7H3.5v9.5h9V7H11M8 11.5V1.5M5 4.5l3-3 3 3"/></svg> straight away)</small></li>
      <li>Scroll down and tap <b>Add to Home Screen</b></li>
      <li>Leave <b>Open as Web App</b> on</li>
      <li>Tap <b>Add</b></li></ol>
      <p class="c-tip">Chrome, Edge and Firefox have Add to Home Screen in their Share menu too.</p>`;
  }

  // ---- the AllisonOS tour ----
  const OS_TOUR = () => [
    { noart: true, t: 'Everything in one place', d: 'Mail, Calendar, News, Weather, Notes, Podcasts, Travel, Places, Fitness and Home, side by side.' },
    { i: 'swipe', t: 'Swipe up to come home', d: 'In an app opened from the AllisonOS home screen, swipe up from just above the bottom edge to come back to it. Press and hold the home screen for Settings.' },
    { i: 'refresh', t: 'Always up to date', d: 'Updates are pushed automatically, so you always have the latest of everything at your fingertips.' },
    { x: 'theme', i: 'moon', t: 'Light or dark', d: 'Follow your iPhone, or keep AllisonOS always light or always dark. You can change it later in Settings.' },
    { i: 'lock', t: 'Yours alone', d: 'What you set up stays on this phone.' },
    ...(standalone() ? [] : [{ x: 'install', i: 'plus', t: 'Add it to your Home Screen', name: APP === 'aos' ? 'aOS' : 'AllisonOS' }]),
    APP === 'aos'
      ? { i: 'grid', t: 'Your apps live here', d: 'Every AllisonOS app is in aOS. Tap one to open it, then add it to your Home Screen.' }
      : { x: 'store', i: 'grid', t: 'Get your apps in aOS', d: 'aOS is the home for every app: open it to add the ones you want, and to see what\'s new.' },
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
    moon: '<circle cx="32" cy="32" r="22"/><path d="M32 10a22 22 0 0 1 0 44z" fill="currentColor"/>',
    share: '<path d="M22 22h-8v34h36V22h-8"/><path d="M32 40V6M23 15l9-9 9 9"/>',
    plus: '<rect x="12" y="12" width="40" height="40" rx="11"/><path d="M32 23v18M23 32h18"/>',
  };
  const lineSvg = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k] || LINE.sparkle}</svg>`;
  const url = p => new URL(p, BASE).href;
  const icon = id => url(`../${id === 'home' ? 'home' : id}/icon-512.png`);
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor"/></svg>';

  const CSS = `
#aos-welcome { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  --w-pastel: linear-gradient(100deg, #9CC8FF 0%, #C3B1FF 26%, #FFB8CF 50%, #FFD2A8 74%, #A6EAD3 100%); --w-glow: rgba(195,177,255,.55);
  background: var(--w-bg); color: var(--w-text); opacity: 0; transition: opacity .5s; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6EA8F2 0%, #9C86EC 26%, #EC86AA 50%, #EDA766 74%, #5FC6A6 100%); --w-glow: rgba(156,134,236,.4); } }
html[data-theme="light"] #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6EA8F2 0%, #9C86EC 26%, #EC86AA 50%, #EDA766 74%, #5FC6A6 100%); --w-glow: rgba(156,134,236,.4); }
html[data-theme="dark"] #aos-welcome { --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  --w-pastel: linear-gradient(100deg, #9CC8FF 0%, #C3B1FF 26%, #FFB8CF 50%, #FFD2A8 74%, #A6EAD3 100%); --w-glow: rgba(195,177,255,.55); }
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
#aos-welcome .c-word span { display: inline-block; overflow: hidden; background: var(--w-pastel); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  transition: transform .5s cubic-bezier(.5,0,.75,0), opacity .5s, max-width .7s cubic-bezier(.65,0,.35,1); }
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
#aos-welcome .v-power { margin-top: 18px; font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--w-muted); opacity: 0; transition: opacity .8s; }
#aos-welcome .v-power.on { opacity: 1; }
#aos-welcome .v-power sup { font-size: .75em; letter-spacing: 0; }
#aos-welcome.parked .v-wrap { transform: translateY(-50%) scale(.56); }
/* the app icons: bursting out of the mark (aOS) or the letters (the name), into a grid */
#aos-welcome .c-fly { position: absolute; inset: 0; pointer-events: none; perspective: 700px; transition: opacity .4s; }
#aos-welcome .c-fly img { position: absolute; border-radius: 24%; box-shadow: 0 6px 18px rgba(0,0,0,.22); opacity: 0; transform: rotateY(-90deg) scale(.7);
  transition: transform .55s cubic-bezier(.25,1,.5,1), opacity .4s, left .9s cubic-bezier(.2,.8,.2,1), top .9s cubic-bezier(.2,.8,.2,1), width .9s cubic-bezier(.2,.8,.2,1), height .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-fly img.on { opacity: 1; transform: none; }
#aos-welcome.tall .c-fly, #aos-welcome.tall .v-wrap, #aos-welcome.tall .a-head { opacity: 0; }   /* tall cards need the room */
/* an app's own walkthrough: its icon and name */
#aos-welcome .a-head { display: flex; flex-direction: column; align-items: center; transition: transform .9s cubic-bezier(.2,.8,.2,1), opacity .5s; }
#aos-welcome .a-icon { width: 96px; height: 96px; border-radius: 24%; box-shadow: 0 18px 40px -12px rgba(0,0,0,.4); opacity: 0; transform: scale(.6); filter: blur(10px);
  transition: opacity .8s, transform 1s cubic-bezier(.2,.8,.2,1), filter 1s; margin-bottom: 20px; }
#aos-welcome .a-icon.on { opacity: 1; transform: none; filter: none; }
#aos-welcome .a-by { margin-top: 10px; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--w-muted); opacity: 0; transition: opacity .8s; }
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
#aos-welcome .c-link { display: block; margin-top: 16px; height: 48px; line-height: 48px; border-radius: 999px; font-size: 16px; font-weight: 600; text-decoration: none; color: var(--w-text); background: var(--w-dot); }
#aos-welcome .c-notes { text-align: left; margin: 14px 0 0; padding: 0; list-style: none; }
#aos-welcome .c-notes li { position: relative; padding: 0 0 9px 22px; font-size: 15px; line-height: 1.35; }
#aos-welcome .c-notes li::before { content: ''; position: absolute; left: 4px; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--w-pastel); }
#aos-welcome .c-install { display: block; width: 100%; margin-top: 16px; }
#aos-welcome .w-dots { display: flex; justify-content: center; gap: 7px; margin: 18px 0; }
#aos-welcome .w-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--w-dot); transition: background .3s, width .3s; }
#aos-welcome .w-dots i.on { background: var(--w-text); width: 18px; border-radius: 4px; }
#aos-welcome .w-dots:empty { display: none; }
#aos-welcome .c-btns { display: flex; gap: 10px; }
#aos-welcome .w-btn { flex: 1; height: 52px; border-radius: 999px; font-size: 17px; font-weight: 600; color: #fff !important; background: #0A84FF !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), inset 0 1px 1px rgba(255,255,255,.5); }
#aos-welcome .c-back { flex: 0 0 52px; height: 52px; border-radius: 50%; background: var(--w-dot) !important; font-size: 22px; }
#aos-welcome .c-back[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) {
  #aos-welcome *, #aos-welcome *::before, #aos-welcome *::after { animation: none !important; transition-duration: .2s !important; transition-delay: 0s !important; }
  #aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dashoffset: 0; }
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
  function paintLetters(word) {
    const W = word.getBoundingClientRect();
    for (const sp of word.children) {
      const b = sp.getBoundingClientRect();
      sp.style.backgroundSize = `${W.width}px 100%`;
      sp.style.backgroundPosition = `${-(b.left - W.left)}px 0`;
      sp.style.maxWidth = (b.width + 2) + 'px';
    }
  }
  const letters = s => [...s].map(c => `<span>${esc(c)}</span>`).join('');
  const BRAND = `<div class="w-stage"><div class="c-brand">
      <div class="c-word">${letters('AllisonOS')}</div><div class="c-rule"></div>
      <div class="c-sub">Welcome</div><div class="c-corp">Part of the Allison Corporation</div></div></div>`;
  const MARK = v => `<div class="v-wrap"><div class="v-mark"><span class="v-ink">aOS</span><sup class="v-ink">${esc(v)}</sup><i class="v-ring"></i>
      <span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span></div>
      <div class="v-power">The Power of aOS<sup>${esc(v)}</sup></div></div>`;

  // "AllisonOS", drawn on, with Welcome and the corporation under it.
  async function sceneName(o) {
    paintLetters(o.q('.c-word'));
    APPS.forEach(id => { new Image().src = icon(id); });   // warm the icons up for what follows
    await wait(300); o.q('.c-word').classList.add('on'); o.q('.c-rule').classList.add('on');
    await wait(1700); o.q('.c-sub').classList.add('on'); o.q('.c-corp').classList.add('on');
    await wait(1800);
  }
  // AllisonOS folds into aOS, which hands over to the version mark: the number drops
  // in as a superscript, a ring pulses out, stars twinkle and a shine runs across.
  async function sceneMark(o, v) {
    for (const c of ['.c-rule', '.c-sub', '.c-corp']) o.q(c).classList.add('c-fade');
    const sp = [...o.q('.c-word').children];
    sp.forEach((s, k) => { if (k >= 1 && k <= 6) s.classList.add('fold'); });   // l l i s o n
    await wait(800);
    o.q('.c-brand').classList.add('c-fade');
    o.q('.v-mark').classList.add('on');
    await wait(550); o.q('.v-mark').classList.add('drop');
    await wait(900); o.q('.v-power').classList.add('on');
    await wait(1900);
  }
  // The apps burst out of the mark into a 5 x 2 grid at the top; the mark settles
  // between them and the panel.
  async function sceneBurst(o) {
    const { el, q } = o, fly = q('.c-fly'), box = el.getBoundingClientRect(), m = q('.v-mark').getBoundingClientRect();
    const imgs = APPS.map(id => { const im = new Image(); im.src = icon(id); im.alt = ''; fly.appendChild(im); return im; });
    const at = (im, x, y, size) => { im.style.width = im.style.height = size + 'px'; im.style.left = (x - size / 2 - box.left) + 'px'; im.style.top = (y - size / 2 - box.top) + 'px'; };
    imgs.forEach(im => at(im, m.left + m.width / 2, m.top + m.height / 2, 20));
    const S = Math.min(56, (box.width - 32 - 4 * 14) / 5), G = 14, gy = box.top + Math.max(110, box.height * 0.2) + 20;
    await wait(60);
    imgs.forEach((im, k) => setTimeout(() => {
      im.classList.add('on');
      at(im, box.left + box.width / 2 + (k % 5 - 2) * (S + G), gy + (Math.floor(k / 5) - 0.5) * (S + G), S);
    }, still() ? 0 : k * 70));
    // the mark settles below the grid, smaller
    const gridBottom = gy + S + G, panelTop = box.height - 400;
    q('.v-wrap').style.top = Math.max(gridBottom + 50, (gridBottom + panelTop) / 2) + 'px';
    el.classList.add('parked');
    await wait(1300);
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
        : c.x === 'store' ? `<a class="c-link" href="${url('../aos/')}">Open aOS</a>`
        : c.x === 'notes' ? `<ul class="c-notes">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
      body.innerHTML = `${c.noart ? '' : `<div class="c-art">${lineSvg(c.i)}</div>`}<h2>${c.h || esc(c.t)}</h2>${c.x === 'install' ? steps(c.name) : c.d ? `<p>${esc(c.d)}</p>` : ''}${extra}`;
      for (const b of body.querySelectorAll('.c-seg button')) b.onclick = () => { setTheme(b.dataset.t); body.querySelectorAll('.c-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      const ib = body.querySelector('.c-install');
      if (ib) ib.onclick = async () => { const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch {} draw(); };
      el.querySelectorAll('.w-dots i').forEach((x, j) => x.classList.toggle('on', j === i));
      q('.c-back').hidden = i === 0;
      q('.c-btns .w-btn').textContent = i === cards.length - 1 ? last : 'Continue';
    };
    const go = async d => {
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
  // THE FLOWS
  // ===========================================================================
  // The AllisonOS welcome: the name, the aOS mark, the apps, the tour.
  const play = () => { const v = latest('aos'); return run('Welcome to AllisonOS', BRAND + MARK(v), () => markSeen('aos', v), async o => {
    await sceneName(o); await sceneMark(o, v); await sceneBurst(o); await tour(o, OS_TOUR());
  }); };
  // A major aOS update: the name and the new mark, then that release's setup cards.
  const playMajor = () => { const v = latest('aos'), r = RELEASES.aos[0]; return run(`aOS${v}`, BRAND + MARK(v), () => markSeen('aos', v), async o => {
    await sceneName(o); await sceneMark(o, v); await sceneBurst(o);
    await tour(o, r.cards && r.cards.length ? r.cards : [{ x: 'notes', i: 'sparkle', h: esc(r.title || `aOS${v}`), notes: r.notes || [] }], 'Done');
  }); };
  // A minor update, for aOS or an app: one card, "aOS1 updated to aOS1.1".
  function playUpdate(id = 'aos', from, to = latest(id)) {
    const fresh = RELEASES[id].filter(r => cmp(r.v, from || '0') > 0 && cmp(r.v, to) <= 0);
    const notes = fresh.flatMap(r => r.notes || []);
    const cards = id === 'aos' ? [] : fresh.flatMap(r => r.cards || []);
    if (id !== 'aos' && !cards.length && !notes.length) { markSeen(id, to); return Promise.resolve(); }   // nothing new to say
    const head = id === 'aos'
      ? `<div class="v-wrap" style="top:34%"><div class="v-mark on drop"><span class="v-ink">aOS</span><sup class="v-ink">${esc(to)}</sup><i class="v-ring"></i><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span><span class="v-star">${STAR}</span></div></div>`
      : `<div class="w-stage" style="justify-content:flex-start;padding-top:18vh"><div class="a-head"><img class="a-icon on" src="${icon(id)}" alt=""></div></div>`;
    const first = id === 'aos'
      ? { x: 'notes', noart: true, h: `${supV(from || major(to))} updated to ${supV(to)}`, d: 'More power in your palm.', notes }
      : { x: notes.length ? 'notes' : null, noart: true, h: `What's new in ${esc(NAMES[id])}`, d: `${NAMES[id]} ${to}`, notes };
    return run(first.h.replace(/<[^>]+>/g, ''), head, () => markSeen(id, to), async o => { await wait(300); await tour(o, [first, ...cards], 'Done'); });
  }
  // An app's own walkthrough.
  function playApp(id) {
    const T = TOURS[id]; if (!T) return Promise.resolve();
    const v = latest(id), name = NAMES[id];
    const head = `<div class="w-stage"><div class="a-head"><img class="a-icon" src="${icon(id)}" alt="">
      <div class="c-word">${letters(name)}</div><div class="a-by">AllisonOS · aOS<sup>${esc(latest('aos'))}</sup></div><div class="a-tag">${esc(T.tag || '')}</div></div></div>`;
    const cards = [...T.cards, ...(standalone() ? [] : [{ x: 'install', i: 'plus', t: `Add ${name} to your Home Screen`, name }])];
    return run(`Welcome to ${name}`, head, () => markSeen(id, v), async o => { await sceneApp(o, id); await tour(o, cards); });
  }

  AOS.welcome = { play, playMajor, playApp, playUpdate, theme: { read: readTheme, set: setTheme, list: THEMES }, lines: LINE, data: { RELEASES, TOURS, APPS, NAMES, latest, cmp, major }, seen: () => !!(seenAll() || {}).aos || metBefore() };

  // ---- deciding what to show, once ----
  function auto() {
    const seen = seenAll(); if (!seen || !APP) return;
    if (APP === 'aos' || APP === 'home') {
      const v = latest('aos'), s = seen.aos;
      if (!s) return metBefore() ? playMajor() : play();          // met AllisonOS before aOS had versions: show aOS1
      if (cmp(v, s) <= 0) return;
      return major(v) > major(s) ? playMajor() : playUpdate('aos', s, v);
    }
    if (!RELEASES[APP]) return;
    const v = latest(APP), s = seen[APP];
    if (!s) return playApp(APP);
    if (cmp(v, s) > 0) return playUpdate(APP, s, v);
  }
  if (me && me.hasAttribute('data-auto')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto, { once: true }); else auto();
  }
})();
