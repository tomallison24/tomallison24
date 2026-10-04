// Places: reading the outside world. Pasted map links (Apple Maps, Google
// Maps), search results from Photon (OpenStreetMap's search, by Komoot), and
// a place's OpenStreetMap tags (opening hours, phone, website, cuisine).
// No network here: app.js fetches, this turns what came back into a place.
//
//   PlacesParse.mapLink(text)       {name, lat, lon, address} | {short:true} | null
//   PlacesParse.fromPhoton(feature) a place's fields from one Photon result
//   PlacesParse.fromTags(tags)      {hours, phone, website, cuisine} from OSM tags
//   PlacesParse.kindOf(key, value)  {label, emoji} for an OSM key=value
//   PlacesParse.hoursText(raw)      "Mo-Fr 08:00-17:00" -> "Mon–Fri 8 AM–5 PM"
//   PlacesParse.distance(a, b)      metres between two {lat, lon}
//   PlacesParse.overpassQuery(groups, s, w, n, e)  the businesses in a map view, by group
//   PlacesParse.groupOf(tags)       'food' | 'fun' | 'shops' | null for an OSM element's tags
//   PlacesParse.fromElement(el)     a place's fields from one Overpass element
//
// Tested by places/scripts/parse-test.mjs.
(function (root) {
  'use strict';
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const okLatLon = (lat, lon) => lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  const pair = s => { const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(s || ''); return m ? [num(m[1]), num(m[2])] : null; };
  const clean = s => String(s || '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();

  // A map link copied from Apple Maps or Google Maps (Share -> Copy). Long
  // links carry the place's position; short ones (maps.apple/p/…, maps.app.goo.gl/…)
  // only redirect, which a web page can't follow, so they're reported as short.
  function mapLink(text) {
    const m = /https?:\/\/[^\s<>"']+/i.exec(String(text || ''));
    if (!m) return null;
    let u;
    try { u = new URL(m[0]); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '');
    if (/^maps\.apple$/.test(host) || /^(goo\.gl|maps\.app\.goo\.gl)$/.test(host)) return { short: true };
    const q = k => { const v = u.searchParams.get(k); return v == null ? '' : clean(v); };
    if (/(^|\.)maps\.apple\.com$/.test(host)) {
      const ll = pair(q('coordinate')) || pair(q('ll')) || pair(q('daddr')) || pair(q('q')) || pair(q('sll')) || pair(q('center'));
      const name = q('name') || (pair(q('q')) ? '' : q('q'));
      const address = q('address') || (pair(q('daddr')) ? '' : q('daddr'));
      if (!ll && !address && !name) return u.searchParams.has('place-id') || u.searchParams.has('auid') ? { short: true } : null;
      return { name, address, lat: ll && okLatLon(...ll) ? ll[0] : null, lon: ll && okLatLon(...ll) ? ll[1] : null };
    }
    if (/(^|\.)google\.[a-z.]+$/.test(host) && /\/maps|^maps\./.test(u.pathname + ' ' + host)) {
      const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(u.pathname);
      const bang = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(u.pathname + u.search);   // the place's own position, when given
      const place = /\/place\/([^/@]+)/.exec(u.pathname);
      const query = q('query') || q('q') || q('destination') || q('daddr');
      const ll = bang ? [num(bang[1]), num(bang[2])] : pair(query) || (at ? [num(at[1]), num(at[2])] : null);
      const name = place ? clean(decodeURIComponent(place[1])) : pair(query) ? '' : query;
      if (!ll && !name) return null;
      return { name, address: '', lat: ll && okLatLon(...ll) ? ll[0] : null, lon: ll && okLatLon(...ll) ? ll[1] : null };
    }
    return null;
  }

  // What kind of place an OpenStreetMap key=value is, in words, with an emoji for the list.
  const KINDS = {
    restaurant: ['Restaurant', '🍽️'], fast_food: ['Fast food', '🍔'], cafe: ['Café', '☕'], coffee_shop: ['Café', '☕'], bar: ['Bar', '🍸'], pub: ['Pub', '🍺'],
    biergarten: ['Beer garden', '🍺'], ice_cream: ['Ice cream', '🍦'], bakery: ['Bakery', '🥐'], pastry: ['Bakery', '🥐'], food_court: ['Food court', '🍽️'],
    nightclub: ['Nightclub', '🪩'], brewery: ['Brewery', '🍺'], winery: ['Winery', '🍷'], wine: ['Wine shop', '🍷'],
    museum: ['Museum', '🏛️'], gallery: ['Gallery', '🖼️'], arts_centre: ['Arts centre', '🎨'], theatre: ['Theatre', '🎭'], cinema: ['Cinema', '🎬'],
    music_venue: ['Music venue', '🎵'], concert_hall: ['Concert hall', '🎵'], stadium: ['Stadium', '🏟️'], attraction: ['Attraction', '⭐'], viewpoint: ['Viewpoint', '🌄'],
    zoo: ['Zoo', '🦁'], aquarium: ['Aquarium', '🐠'], theme_park: ['Theme park', '🎢'], park: ['Park', '🌳'], garden: ['Garden', '🌷'], nature_reserve: ['Nature reserve', '🌲'],
    beach: ['Beach', '🏖️'], peak: ['Peak', '⛰️'], hiking: ['Trail', '🥾'], camp_site: ['Campsite', '⛺'], playground: ['Playground', '🛝'],
    hotel: ['Hotel', '🏨'], motel: ['Motel', '🏨'], guest_house: ['Guest house', '🏨'], hostel: ['Hostel', '🏨'],
    supermarket: ['Supermarket', '🛒'], mall: ['Mall', '🛍️'], department_store: ['Department store', '🛍️'], clothes: ['Clothes shop', '👗'], books: ['Bookshop', '📚'],
    marketplace: ['Market', '🧺'], spa: ['Spa', '💆'], fitness_centre: ['Gym', '🏋️'], sports_centre: ['Sports centre', '🏅'], golf_course: ['Golf course', '⛳'],
    library: ['Library', '📚'], place_of_worship: ['Place of worship', '⛪'], castle: ['Castle', '🏰'], monument: ['Monument', '🗿'], memorial: ['Memorial', '🗿'],
    historic: ['Historic site', '🏛️'], city: ['City', '🏙️'], town: ['Town', '🏘️'], village: ['Village', '🏡'], island: ['Island', '🏝️'],
  };
  function kindOf(key, value) {
    const v = String(value || ''), k = String(key || '');
    if (KINDS[v]) return { label: KINDS[v][0], emoji: KINDS[v][1] };
    if (k === 'shop') return { label: v && v !== 'yes' ? cap(v.replace(/_/g, ' ')) + ' shop' : 'Shop', emoji: '🛍️' };
    if (k === 'historic') return { label: 'Historic site', emoji: '🏛️' };
    if (k === 'tourism') return { label: cap(v.replace(/_/g, ' ')) || 'Attraction', emoji: '⭐' };
    if (k === 'natural' || k === 'leisure') return { label: cap(v.replace(/_/g, ' ')), emoji: '🌳' };
    if (k === 'place' || k === 'highway' || k === 'building' || !v || v === 'yes') return { label: '', emoji: '📍' };
    return { label: cap(v.replace(/_/g, ' ')), emoji: '📍' };
  }
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // One Photon result (GeoJSON) as a place.
  function fromPhoton(f) {
    const p = (f && f.properties) || {}, c = (f && f.geometry && f.geometry.coordinates) || [];
    const kind = kindOf(p.osm_key, p.osm_value);
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const town = p.city || p.town || p.village || p.locality || p.district || p.county || '';
    const address = [street, town, p.state && p.countrycode && String(p.countrycode).toUpperCase() === 'US' ? p.state : (town ? '' : p.state), town || p.state ? '' : p.country].filter(Boolean).join(', ');
    const type = { N: 'node', W: 'way', R: 'relation' }[p.osm_type] || null;
    const name = p.name || street || town || 'Dropped pin';
    return {
      name, address, city: town, category: kind.label, emoji: kind.emoji,
      lat: num(c[1]), lon: num(c[0]),
      osm: type && p.osm_id ? { type, id: Number(p.osm_id) } : null,
      group: groupOf({ [p.osm_key]: p.osm_value }),
      // A business or attraction, rather than a street, a town or a bare address.
      isPlace: !!p.name && !['place', 'highway', 'boundary', 'landuse', 'railway', 'waterway'].includes(p.osm_key) && !(p.osm_key === 'building' && ['house', 'residential', 'yes', 'apartments'].includes(p.osm_value)),
    };
  }

  // The useful bits of a place's OpenStreetMap tags.
  function fromTags(t) {
    t = t || {};
    const web = t.website || t['contact:website'] || t.url || '';
    return {
      hours: t.opening_hours || '',
      phone: t.phone || t['contact:phone'] || '',
      website: web && !/^https?:\/\//i.test(web) ? 'https://' + web : web,
      cuisine: t.cuisine ? t.cuisine.split(';').map(s => cap(s.trim().replace(/_/g, ' '))).filter(Boolean).join(', ') : '',
    };
  }

  // OpenStreetMap's opening_hours, a little friendlier to read. Anything it
  // can't make sense of is shown as written.
  const DAYS = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', PH: 'Holidays' };
  function hoursText(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s === '24/7') return 'Open 24 hours';
    const clock = (h, m) => { h = +h; const ap = h >= 12 && h < 24 ? 'PM' : 'AM', hh = h % 12 || 12; return hh + (m !== '00' ? ':' + m : '') + ' ' + ap; };
    return s.split(/\s*;\s*/).map(part => part
      .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => DAYS[d])
      .replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => clock(h, m))
      .replace(/\s*-\s*/g, '–').replace(/\boff\b/g, 'closed')).join('\n');
  }

  function distance(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // The businesses shown on the map, in three groups that can be switched on
  // and off: places to eat and drink, things to do, and every other shop.
  const GROUPS = {
    food: { amenity: 'restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten|nightclub|food_court', shop: 'bakery|pastry|coffee|tea|confectionery|chocolate|deli|wine', craft: 'brewery|winery|distillery' },
    fun: { amenity: 'theatre|cinema|arts_centre|concert_hall|events_venue|casino|music_venue|planetarium', tourism: 'museum|gallery|attraction|zoo|aquarium|theme_park|viewpoint',
      leisure: 'stadium|water_park|bowling_alley|escape_game|miniature_golf|amusement_arcade|ice_rink|trampoline_park|sports_centre|golf_course', historic: 'castle|fort|palace|monument|memorial|ruins' },
    shops: { shop: '.+' },
  };
  const ORDER = ['amenity', 'tourism', 'leisure', 'craft', 'historic', 'shop'];
  function groupOf(t) {
    t = t || {};
    for (const g of ['food', 'fun', 'shops']) for (const k of Object.keys(GROUPS[g])) if (t[k] && new RegExp('^(' + GROUPS[g][k] + ')$').test(t[k])) return g;
    return null;
  }
  function overpassQuery(groups, s, w, n, e) {
    const box = [s, w, n, e].map(v => (+v).toFixed(5)).join(',');
    const parts = [];
    for (const g of groups) for (const [k, v] of Object.entries(GROUPS[g] || {})) parts.push('nwr["' + k + '"~"^(' + v + ')$"]["name"](' + box + ');');
    return '[out:json][timeout:20];(' + parts.join('') + ');out center tags 600;';
  }
  function fromElement(el) {
    const t = el.tags || {}, key = ORDER.find(k => t[k]) || '';
    const kind = kindOf(key, t[key]);
    const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    const city = t['addr:city'] || '';
    return {
      name: t.name || '', lat: lat == null ? null : +lat, lon: lon == null ? null : +lon,
      address: [street, city].filter(Boolean).join(', '), city, category: kind.label, emoji: kind.emoji,
      osm: /^(node|way|relation)$/.test(el.type) ? { type: el.type, id: +el.id } : null,
      info: Object.assign(fromTags(t), { at: Date.now() }), group: groupOf(t),
    };
  }

  root.PlacesParse = { mapLink, fromPhoton, fromTags, kindOf, hoursText, distance, overpassQuery, groupOf, fromElement };
})(typeof window !== 'undefined' ? window : globalThis);
