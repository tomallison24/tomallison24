// Places from the Family calendar: which events are outings worth keeping,
// and what they change in your places. No network here; scripts/from-calendar.mjs
// fetches the events (through the Calendar app's own iCloud code) and the
// Sheet, and asks Photon where each event's location is.
//
// An event becomes a place when it:
//   - happens once (repeating events are practices, lessons, clubs), and its
//     title isn't one of those either ("Fearless Foxes training", "Piano lesson",
//     "Dentist appointment", "School pickup");
//   - has a location that OpenStreetMap knows as somewhere you'd go out:
//     a restaurant, café, bar, pub, bakery, ice cream, brewery or winery; a
//     museum, gallery, theatre, cinema, concert hall or arts centre; a zoo,
//     aquarium, theme park, attraction, viewpoint, castle; a stadium, bowling
//     alley, escape room, water park or similar. Homes, offices, schools,
//     churches, sports pitches, parks and gyms are left out.
// Past events count as a visit (Been, with that date); coming ones are plans
// (Want to go, Planned for that date). A place you already have is updated
// rather than added again, and a plan whose date has passed moves to Been by
// itself unless you've changed it since.

import './parse.js';
const P = globalThis.PlacesParse;

// Titles that are never an outing, wherever they happen. (The venue check
// below does most of the work: a training at a park or a sports field never
// matches a restaurant or a museum anyway.)
export const SKIP_TITLE = /\b(train(ing)?|practi[cs]e|rehearsal|lessons?|tutor(ing)?|appointment|appt|dentist|doctor|orthodont\w*|therapy|physio|check-?up|vet|pick-?up|drop-?off|tryouts?|haircut|scouts?)\b/i;

const OUTING = {
  amenity: ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten', 'nightclub', 'food_court', 'theatre', 'cinema', 'arts_centre', 'concert_hall', 'events_venue', 'casino', 'music_venue'],
  tourism: ['museum', 'gallery', 'attraction', 'zoo', 'aquarium', 'theme_park', 'viewpoint', 'artwork'],
  leisure: ['stadium', 'water_park', 'bowling_alley', 'escape_game', 'miniature_golf', 'amusement_arcade', 'ice_rink', 'trampoline_park'],
  shop: ['bakery', 'pastry', 'confectionery', 'chocolate', 'coffee', 'tea', 'wine', 'ice_cream'],
  craft: ['brewery', 'winery', 'distillery'],
  historic: ['castle', 'fort', 'palace', 'monument', 'ruins'],
};
export const isOuting = (key, value) => !!(OUTING[key] && OUTING[key].includes(value));

// One VEVENT, read with the Calendar app's iCal code (calendar/ical.js), as
// what matters here: {uid, title, date (YYYY-MM-DD, the event's own wall date),
// at (ms), recurring, where: {name, address, lat, lon}}.
export function readEvent(I, vcal, ev, fallbackTz) {
  const uid = I.text(ev, 'UID'), title = (I.text(ev, 'SUMMARY') || '').trim();
  const ds = I.dateProp(ev, 'DTSTART');
  if (!uid || !ds) return null;
  const at = I.toMs(ds, vcal, fallbackTz || 'UTC');
  const pad = n => String(n).padStart(2, '0');
  let date;
  if (!ds.utc) date = ds.y + '-' + pad(ds.m) + '-' + pad(ds.d);            // the date as written in the calendar
  else { const w = I.utcToZoned(at, fallbackTz || 'UTC'); date = w.y + '-' + pad(w.m) + '-' + pad(w.d); }
  const loc = (I.text(ev, 'LOCATION') || '').trim();
  const lines = loc.split(/\n/).map(s => s.trim()).filter(Boolean);
  const sl = I.prop(ev, 'X-APPLE-STRUCTURED-LOCATION');
  let lat = null, lon = null, name = '';
  if (sl) {
    const m = /geo:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i.exec(sl.value || '');
    if (m) { lat = +m[1]; lon = +m[2]; }
    const t = sl.params && (sl.params['X-TITLE'] || sl.params['x-title']);
    if (t) name = String(Array.isArray(t) ? t[0] : t).replace(/^"|"$/g, '').split(/\n|\\n/)[0].trim();
  }
  if (!name && lines.length > 1) name = lines[0];
  const address = lines.length > 1 ? lines.slice(1).join(', ') : (lines[0] && lines[0] !== name ? lines[0] : '');
  return { uid, title, date, at, recurring: !!(I.prop(ev, 'RRULE') || I.prop(ev, 'RDATE')), where: { name, address, lat, lon, text: loc } };
}

// Whether an event is even worth looking up.
export const worthLooking = e => !!e && !e.recurring && !SKIP_TITLE.test(e.title) && !!(e.where.text || e.where.lat != null);

// What Photon should be asked for an event's location.
export const searchFor = e => ({ q: e.where.name || e.where.text.split('\n')[0] || e.where.address, lat: e.where.lat, lon: e.where.lon });

// From Photon's results, the outing this event happened at, or null.
export function pickVenue(e, features) {
  for (const f of features || []) {
    const pr = f.properties || {}, p = P.fromPhoton(f);
    if (p.lat == null || !isOuting(pr.osm_key, pr.osm_value)) continue;
    if (e.where.lat != null && P.distance({ lat: e.where.lat, lon: e.where.lon }, p) > 250) continue;
    return p;
  }
  return null;
}

const uniq = a => [...new Set(a.filter(Boolean))].sort().reverse();
const latest = a => uniq(a)[0] || null;

// What the calendar changes in your places: new places to add and existing
// ones to update. `found` is [{event, venue}] for events whose venue was found;
// `places` is everything in the Sheet now; `today` YYYY-MM-DD; `now` ms;
// `idFor(uid)` a stable id for a place made from an event.
export function plan(found, places, today, now, idFor) {
  const byId = new Map(places.map(p => [p.id, JSON.parse(JSON.stringify(p))]));
  const changed = new Set();
  const same = (p, v) => (p.osm && v.osm && p.osm.type === v.osm.type && p.osm.id === v.osm.id)
    || (p.name && v.name && p.name.toLowerCase() === v.name.toLowerCase() && p.lat != null && P.distance(p, v) < 150);
  for (const { event: e, venue: v } of found) {
    const past = e.date < today;
    let p = byId.get(idFor(e.uid)) || [...byId.values()].find(x => same(x, v));
    if (!p) {
      p = { id: idFor(e.uid), name: v.name, lat: v.lat, lon: v.lon, address: v.address, city: v.city, category: v.category, emoji: v.emoji, osm: v.osm,
        status: past ? 'been' : 'want', planned: past ? null : e.date, visited: past ? e.date : null, visits: past ? [e.date] : [],
        rating: 0, price: 0, tags: [], notes: '📅 ' + e.title, cal: { uid: e.uid, at: now }, created: now, updated: now };
      byId.set(p.id, p); changed.add(p.id);
      continue;
    }
    const visits = p.visits || (p.visited ? [p.visited] : []);
    if (past) {
      if (visits.includes(e.date)) continue;                       // already counted
      p.visits = uniq([...visits, e.date]); p.visited = latest(p.visits);
      if (p.status !== 'been') { p.status = 'been'; if (p.planned === e.date) p.planned = null; }
    } else {
      if (p.status === 'been' || (p.planned && p.planned >= today && p.planned <= e.date)) continue;   // nothing new to plan
      p.planned = e.date;
    }
    p.updated = now; if (p.cal) p.cal.at = now;
    changed.add(p.id);
  }
  // Plans from the calendar whose day has come and gone, left as they were: you went.
  for (const p of byId.values()) {
    if (!p.cal || p.status !== 'want' || !p.planned || p.planned >= today || p.updated !== p.cal.at) continue;
    p.status = 'been'; p.visits = uniq([...(p.visits || []), p.planned]); p.visited = latest(p.visits); p.planned = null;
    p.updated = now; p.cal.at = now; changed.add(p.id);
  }
  return [...changed].map(id => byId.get(id));
}
