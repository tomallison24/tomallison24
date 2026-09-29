"use strict";
// Travel: turns a booking email into bookings.
//
// Two ways in, best first:
// 1. Structured data. Many airlines, hotels and car hire firms put a hidden
//    schema.org block in their confirmation emails (FlightReservation,
//    LodgingReservation, RentalCarReservation) - the same data Gmail uses for
//    its own trip cards. As JSON-LD it is read straight from the HTML; as
//    microdata it is read from the parsed page (browser only).
// 2. Reading the words. For emails without that block: flight numbers from
//    the airlines below, airport codes, dates and times near them, and the
//    check-in / check-out and pick-up / return lines of hotel and car emails.
//    This is a best guess, so every booking found this way is marked
//    guess: true and the app asks for a quick check.
//
// No network, no DOM needed for the core, so the same file runs in the app
// and under Node for the tests (travel/scripts/parse-test.mjs).
(function (root) {
  // ---------------------------------------------------------------------
  // Reference tables
  // ---------------------------------------------------------------------
  const AIRLINES = {
    UA: 'United', DL: 'Delta', AA: 'American', WN: 'Southwest', AS: 'Alaska', B6: 'JetBlue',
    F9: 'Frontier', MX: 'Breeze', NK: 'Spirit', HA: 'Hawaiian', G4: 'Allegiant', SY: 'Sun Country',
    AC: 'Air Canada', WS: 'WestJet', BA: 'British Airways', VS: 'Virgin Atlantic', AF: 'Air France',
    KL: 'KLM', LH: 'Lufthansa', EI: 'Aer Lingus', IB: 'Iberia', EK: 'Emirates', QR: 'Qatar Airways',
    EY: 'Etihad', TK: 'Turkish Airlines', LX: 'Swiss', AY: 'Finnair', TP: 'TAP', U2: 'easyJet',
    FR: 'Ryanair', QF: 'Qantas', NZ: 'Air New Zealand', SQ: 'Singapore Airlines', CX: 'Cathay Pacific',
    JL: 'Japan Airlines', NH: 'ANA', AM: 'Aeromexico', LA: 'LATAM', AV: 'Avianca', CM: 'Copa',
    VX: 'Virgin America', Y4: 'Volaris', SK: 'SAS',
  };
  // Sender domains that mean "this is from that airline".
  const AIRLINE_DOMAINS = [
    [/united\.com$/, 'UA'], [/delta\.com$/, 'DL'], [/(^|\.)aa\.com$|americanairlines/, 'AA'],
    [/southwest\.com$/, 'WN'], [/alaskaair\.com$/, 'AS'], [/jetblue\.com$/, 'B6'],
    [/flyfrontier\.com$|frontierairlines/, 'F9'], [/flybreeze\.com$|breezeairways/, 'MX'],
    [/spirit\.com$|spiritairlines/, 'NK'], [/hawaiianairlines\.com$/, 'HA'], [/allegiantair\.com$/, 'G4'],
    [/suncountry\.com$/, 'SY'], [/aircanada\.(com|ca)$/, 'AC'], [/westjet\.com$/, 'WS'],
    [/britishairways\.com$|(^|\.)ba\.com$/, 'BA'], [/virginatlantic\.com$/, 'VS'], [/airfrance\./, 'AF'],
    [/klm\.com$/, 'KL'], [/lufthansa\.com$/, 'LH'], [/aerlingus\.com$/, 'EI'], [/emirates\.com$/, 'EK'],
    [/qatarairways\.com$/, 'QR'],
  ];
  // Airports: code -> city, for names on cards. Anything else shows its code.
  const AIRPORTS = {
    ATL: 'Atlanta', AUS: 'Austin', BDL: 'Hartford', BNA: 'Nashville', BOS: 'Boston', BUF: 'Buffalo',
    BUR: 'Burbank', BWI: 'Baltimore', CHS: 'Charleston', CLE: 'Cleveland', CLT: 'Charlotte', CMH: 'Columbus',
    CVG: 'Cincinnati', DAL: 'Dallas Love Field', DCA: 'Washington National', DEN: 'Denver', DFW: 'Dallas/Fort Worth',
    DTW: 'Detroit', EWR: 'Newark', FLL: 'Fort Lauderdale', HNL: 'Honolulu', HOU: 'Houston Hobby',
    IAD: 'Washington Dulles', IAH: 'Houston', IND: 'Indianapolis', ISP: 'Long Island', JAX: 'Jacksonville',
    JFK: 'New York JFK', LAS: 'Las Vegas', LAX: 'Los Angeles', LGA: 'New York LaGuardia', MCI: 'Kansas City',
    MCO: 'Orlando', MDW: 'Chicago Midway', MEM: 'Memphis', MIA: 'Miami', MKE: 'Milwaukee', MSP: 'Minneapolis',
    MSY: 'New Orleans', OAK: 'Oakland', OGG: 'Maui', OKC: 'Oklahoma City', OMA: 'Omaha', ONT: 'Ontario',
    ORD: "Chicago O'Hare", ORF: 'Norfolk', PBI: 'West Palm Beach', PDX: 'Portland', PHL: 'Philadelphia',
    PHX: 'Phoenix', PIT: 'Pittsburgh', PVD: 'Providence', RDU: 'Raleigh-Durham', RIC: 'Richmond', RSW: 'Fort Myers',
    SAN: 'San Diego', SAT: 'San Antonio', SAV: 'Savannah', SDF: 'Louisville', SEA: 'Seattle', SFO: 'San Francisco',
    SJC: 'San Jose', SJU: 'San Juan', SLC: 'Salt Lake City', SMF: 'Sacramento', SNA: 'Orange County',
    SRQ: 'Sarasota', STL: 'St. Louis', TPA: 'Tampa', TUS: 'Tucson', HPN: 'White Plains', PWM: 'Portland, Maine',
    SYR: 'Syracuse', ROC: 'Rochester', ALB: 'Albany', GSP: 'Greenville', TYS: 'Knoxville', CAK: 'Akron',
    ILM: 'Wilmington', MYR: 'Myrtle Beach', VPS: 'Destin', PNS: 'Pensacola', ELP: 'El Paso', ABQ: 'Albuquerque',
    BOI: 'Boise', RNO: 'Reno', PSP: 'Palm Springs', ANC: 'Anchorage', LIT: 'Little Rock', BHM: 'Birmingham',
    YYZ: 'Toronto', YUL: 'Montreal', YVR: 'Vancouver', YYC: 'Calgary', CUN: 'Cancún', MEX: 'Mexico City',
    SJD: 'Los Cabos', PVR: 'Puerto Vallarta', NAS: 'Nassau', MBJ: 'Montego Bay', PUJ: 'Punta Cana',
    AUA: 'Aruba', LHR: 'London Heathrow', LGW: 'London Gatwick', STN: 'London Stansted', LTN: 'London Luton',
    MAN: 'Manchester', EDI: 'Edinburgh', GLA: 'Glasgow', DUB: 'Dublin', CDG: 'Paris', ORY: 'Paris Orly',
    AMS: 'Amsterdam', FRA: 'Frankfurt', MUC: 'Munich', ZRH: 'Zurich', MAD: 'Madrid', BCN: 'Barcelona',
    LIS: 'Lisbon', FCO: 'Rome', MXP: 'Milan', ATH: 'Athens', IST: 'Istanbul', DXB: 'Dubai', DOH: 'Doha',
    HND: 'Tokyo Haneda', NRT: 'Tokyo Narita', SIN: 'Singapore', HKG: 'Hong Kong', SYD: 'Sydney',
    AKL: 'Auckland', KEF: 'Reykjavík', CPH: 'Copenhagen', OSL: 'Oslo', ARN: 'Stockholm', VIE: 'Vienna',
    PRG: 'Prague', BRU: 'Brussels', NCE: 'Nice', BER: 'Berlin', WAW: 'Warsaw', BUD: 'Budapest',
  };
  // Three capital letters that are not airports, so they are never read as one.
  const NOT_AIRPORT = new Set(('THE AND FOR YOU ARE NOT BUT ALL ANY CAN HAS HER WAS ONE OUR OUT DAY GET HIM HIS HOW MAN NEW NOW OLD ' +
    'SEE TWO WAY WHO BOY DID ITS LET PUT SAY SHE TOO USE USD EUR GBP CAD MXN AUD TAX FEE PNR REF ETA ETD UTC GMT EST EDT CST CDT ' +
    'MST MDT PST PDT AKT HST BST CET AST MON TUE WED THU FRI SAT SUN JAN FEB MAR APR MAY JUN JUL AUG SEP SEPT OCT NOV DEC AM PM ' +
    'VIA MRS MISS DOB NON APP FAQ TSA DOT CEO VIP SMS URL WWW COM NET ORG USA GST HST VAT TOTAL SEAT GATE ROW BAG CAR INN SPA ' +
    'KIDS ADT CHD INF MIN MAX NUM QTY ADD PER OFF WIFI PRE ECO BAS STD FLT DEP ARR TRM TER NUM ETC').split(' '));
  const MARRIOTT_BRANDS = ['JW Marriott', 'Marriott', 'Courtyard', 'Residence Inn', 'Fairfield', 'SpringHill Suites',
    'TownePlace Suites', 'Sheraton', 'Westin', 'W Hotel', 'Renaissance', 'Ritz-Carlton', 'AC Hotel', 'Moxy',
    'Aloft', 'Element', 'Four Points', 'Le Méridien', 'Le Meridien', 'St. Regis', 'Delta Hotels',
    'Autograph Collection', 'Tribute Portfolio', 'Gaylord', 'Westin', 'EDITION', 'Luxury Collection', 'Design Hotels'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // ---------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rarr: '→',
    middot: '·', bull: '•', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é', copy: '©', reg: '®', trade: '™' };
  const decodeEntities = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });

  // HTML to plain text with the line breaks a reader would see: block ends
  // and <br> become new lines, table cells become spaced columns.
  function htmlToText(html) {
    return decodeEntities(String(html || '').replace(/\r\n?/g, '\n')
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer|blockquote)\s*>/gi, '\n')
      .replace(/<\/t[dh]\s*>/gi, '  ')
      .replace(/<[^>]+>/g, ' '))
      .replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[\u200b-\u200d\ufeff\u034f\u00ad]/g, '')
      .replace(/[ \t\f\v\r]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Every JSON-LD block in the HTML, parsed. Broken blocks are skipped.
  function jsonLdBlocks(html) {
    const out = [];
    const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
    let m;
    while ((m = re.exec(String(html || '')))) {
      const raw = m[1].trim().replace(/^<!--|-->$/g, '');
      try { out.push(JSON.parse(raw)); } catch { try { out.push(JSON.parse(decodeEntities(raw))); } catch {} }
    }
    return out;
  }

  // Microdata (itemscope/itemprop) turned into the same shape as JSON-LD.
  // Needs a parsed document, so only runs in the browser.
  function microdata(doc) {
    if (!doc || !doc.querySelectorAll) return [];
    const read = scope => {
      const o = { '@type': String(scope.getAttribute('itemtype') || '').split('/').pop() };
      const walk = el => {
        for (const c of el.children) {
          const prop = c.getAttribute('itemprop');
          if (prop) {
            const v = c.hasAttribute('itemscope') ? read(c)
              : c.getAttribute('content') ?? c.getAttribute('datetime') ?? c.getAttribute('href') ?? c.getAttribute('src') ?? c.textContent.trim();
            for (const p of prop.split(/\s+/)) o[p] = o[p] === undefined ? v : [].concat(o[p], v);
          }
          if (!c.hasAttribute('itemscope')) walk(c);
        }
      };
      walk(scope);
      return o;
    };
    return [...doc.querySelectorAll('[itemscope][itemtype]')].filter(el => !el.hasAttribute('itemprop')).map(read);
  }

  // ---------------------------------------------------------------------
  // Dates and times
  // ---------------------------------------------------------------------
  const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  const validDay = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100 && new Date(y, m - 1, d).getDate() === d;
  // A date with no year: the one on or after the email (a little before is
  // allowed, for a trip that started the day the email came).
  function guessYear(m, d, ref) {
    const r = ref ? new Date(ref) : new Date();
    let y = r.getFullYear();
    if (new Date(y, m - 1, d) < new Date(r.getTime() - 45 * 864e5)) y++;
    return y;
  }
  const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
  const DATE_RES = [
    // 2026-10-01
    [/\b(20\d\d)-(\d\d)-(\d\d)\b/g, m => [+m[1], +m[2], +m[3]]],
    // Oct 1, 2026 / October 1st 2026 / Thu, Oct 1
    [new RegExp('\\b' + MON + '\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?\\b', 'gi'), m => [m[3] ? +m[3] : null, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]]],
    // 1 Oct 2026 / 01 October / 1st October 2026
    [new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + '(?:,?\\s+(20\\d\\d))?\\b', 'gi'), m => [m[3] ? +m[3] : null, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]]],
    // 10/01/2026 or 10/01/26 (US order unless the first number can't be a month)
    [/\b(\d{1,2})\/(\d{1,2})\/(20\d\d|\d\d)\b/g, m => { let a = +m[1], b = +m[2]; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; if (a > 12 && b <= 12) [a, b] = [b, a]; return [y, a, b]; }],
    // 01OCT26 / 1OCT (airline style)
    [/\b(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d\d)?\b/g, m => [m[3] ? 2000 + +m[3] : null, MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]]],
  ];
  // Every date in the text, in order, as {i, end, date:'YYYY-MM-DD'}.
  function findDates(text, ref) {
    const out = [];
    for (const [re, fn] of DATE_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        let [y, mo, d] = fn(m);
        if (!mo) continue;
        if (y == null) y = guessYear(mo, d, ref);
        if (!validDay(y, mo, d)) continue;
        if (out.some(o => m.index < o.end && m.index + m[0].length > o.i)) continue;   // overlaps one found already
        out.push({ i: m.index, end: m.index + m[0].length, date: ymd(y, mo, d) });
      }
    }
    return out.sort((a, b) => a.i - b.i);
  }
  const TIME_RE = /\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*([ap])\.?\s?m\.?(?![a-z])|\b([01]?\d|2[0-3]):([0-5]\d)(?!\s*[ap]\.?\s?m)(?![\d:])/gi;
  function findTimes(text) {
    const out = [];
    TIME_RE.lastIndex = 0;
    let m;
    while ((m = TIME_RE.exec(text))) {
      let h, mi;
      if (m[1] !== undefined) { if (+m[1] > 12) continue; h = +m[1] % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0); mi = +(m[2] || 0); }
      else { h = +m[4]; mi = +m[5]; }
      out.push({ i: m.index, end: m.index + m[0].length, time: pad(h) + ':' + pad(mi) });
    }
    return out;
  }
  // "2027-03-04T20:15:00-08:00" -> local wall time "2027-03-04T20:15", keeping the full value too.
  function wall(v) {
    if (!v) return { at: '', iso: '' };
    const s = String(v).trim();
    const m = /^(\d{4}-\d\d-\d\d)(?:[T ](\d\d:\d\d))?/.exec(s);
    if (!m) {
      const d = findDates(s)[0], t = findTimes(s)[0];
      return { at: d ? d.date + (t ? 'T' + t.time : '') : '', iso: '' };
    }
    // Only a written offset (-04:00) counts as a time zone. A bare "Z" isn't
    // trusted: American Airlines, for one, writes local times and adds a Z.
    return { at: m[1] + (m[2] ? 'T' + m[2] : ''), iso: /[T ]\d\d:\d\d(:\d\d(\.\d+)?)?[+-]\d\d:?\d\d$/.test(s) ? s.replace(' ', 'T') : '' };
  }
  const addDays = (date, n) => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

  // ---------------------------------------------------------------------
  // Identity: the same booking seen twice (two emails, or two phones) gets
  // the same id, so it is never listed twice.
  // ---------------------------------------------------------------------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function bookingKey(b) {
    if (b.type === 'flight') return 'f|' + (b.airlineCode || b.airline || '').toUpperCase() + (b.flightNo || '') + '|' + String(b.dep || '').slice(0, 10) + '|' + (b.from || '');
    if (b.type === 'hotel') return 'h|' + (b.conf || (String(b.name || '').toLowerCase() + '|' + (b.checkIn || '')));
    if (b.type === 'car') return 'c|' + (b.conf || (String(b.company || '').toLowerCase() + '|' + String(b.pickup || '').slice(0, 10)));
    return 'o|' + (b.conf || '') + '|' + (b.title || '') + '|' + (b.start || '');
  }
  const idFor = b => b.type[0] + '-' + hash(bookingKey(b));

  // ---------------------------------------------------------------------
  // 1. schema.org reservations
  // ---------------------------------------------------------------------
  const typeOf = o => String(o && o['@type'] || '').replace(/^.*[/#]/, '');
  const str = v => v == null ? '' : typeof v === 'object' ? String(v.name || v['@id'] || '') : String(v).trim();
  const cancelledStatus = s => /cancel/i.test(str(s));
  function flatten(x, out = []) {
    if (Array.isArray(x)) x.forEach(y => flatten(y, out));
    else if (x && typeof x === 'object') { if (x['@graph']) flatten(x['@graph'], out); if (x['@type']) out.push(x); }
    return out;
  }
  function addressText(a) {
    if (!a) return '';
    if (typeof a === 'string') return a.trim();
    return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, str(a.addressCountry)].filter(Boolean).map(String).join(', ');
  }
  const cityOf = a => a && typeof a === 'object' ? String(a.addressLocality || '') : '';

  function fromSchema(objs) {
    const out = [];
    for (const o of flatten(objs)) {
      const t = typeOf(o), f = o.reservationFor || {}, status = cancelledStatus(o.reservationStatus) ? 'cancelled' : 'confirmed';
      const conf = str(o.reservationNumber || o.confirmationNumber);
      const who = [].concat(o.underName || []).map(str).filter(Boolean).join(', ');
      if (t === 'FlightReservation') {
        const al = f.airline || {}, code = String(al.iataCode || '').toUpperCase();
        let no = String(f.flightNumber || '').replace(/\s+/g, '');
        const pre = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/i.exec(no);
        const airlineCode = code || (pre && AIRLINES[pre[1].toUpperCase()] ? pre[1].toUpperCase() : '');
        if (pre && (!code || pre[1].toUpperCase() === code)) no = pre[2];
        no = no.replace(/^0+(?=\d)/, '');
        const da = f.departureAirport || {}, aa = f.arrivalAirport || {};
        const dep = wall(f.departureTime);
        let arr = wall(f.arrivalTime);
        if (arr.at === dep.at) arr = { at: '', iso: '' };   // Frontier repeats the take-off time
        out.push({
          type: 'flight', status, conf, traveller: who,
          airline: str(al) || AIRLINES[airlineCode] || '', airlineCode, flightNo: no,
          from: String(da.iataCode || '').toUpperCase(), fromName: str(da) || AIRPORTS[String(da.iataCode || '').toUpperCase()] || '',
          to: String(aa.iataCode || '').toUpperCase(), toName: str(aa) || AIRPORTS[String(aa.iataCode || '').toUpperCase()] || '',
          dep: dep.at, depIso: dep.iso, arr: arr.at, arrIso: arr.iso,
          terminal: str(f.departureTerminal), gate: str(f.departureGate),
          seat: str(o.airplaneSeat || (o.reservedTicket && o.reservedTicket.ticketedSeat && o.reservedTicket.ticketedSeat.seatNumber)),
          guess: false,
        });
      } else if (t === 'LodgingReservation') {
        const ci = wall(o.checkinDate || o.checkinTime), co = wall(o.checkoutDate || o.checkoutTime);
        out.push({
          type: 'hotel', status, conf, traveller: who, name: str(f), address: addressText(f.address), city: cityOf(f.address),
          phone: str(f.telephone), checkIn: ci.at.slice(0, 10), checkInTime: ci.at.slice(11, 16), checkOut: co.at.slice(0, 10), checkOutTime: co.at.slice(11, 16),
          guess: false,
        });
      } else if (t === 'RentalCarReservation') {
        const pl = o.pickupLocation || {}, dl = o.dropoffLocation || {};
        const pu = wall(o.pickupTime), dr = wall(o.dropoffTime);
        const company = str(f.rentalCompany) || str(o.provider) || str(o.broker) || str(f.brand) || '';
        out.push({
          type: 'car', status, conf, traveller: who, company, carClass: str(f.name || f.model),
          pickupPlace: [str(pl), addressText(pl.address)].filter(Boolean).join(', '), city: cityOf(pl.address),
          pickup: pu.at, pickupIso: pu.iso,
          dropPlace: [str(dl), addressText(dl.address)].filter(Boolean).join(', '),
          dropoff: dr.at, dropoffIso: dr.iso, guess: false,
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // 2. Reading the words
  // ---------------------------------------------------------------------
  function airlineFromSender(from) {
    const dom = (/@([^>\s]+)/.exec(String(from || '')) || [])[1] || '';
    for (const [re, code] of AIRLINE_DOMAINS) if (re.test(dom.toLowerCase())) return code;
    const name = String(from || '').toLowerCase();
    for (const [code, n] of Object.entries(AIRLINES)) if (name.includes(n.toLowerCase() + ' ') || name.startsWith(n.toLowerCase())) return code;
    return '';
  }
  const CONF_RE = /\b(?:confirmation|record\s+locator|booking\s+(?:reference|ref\.?|code|number)|reservation|trip\s+locator|PNR)(?:\s+(?:code|number|no\.?|#))?\s*(?:is|number)?\s*[:#]?\s*([A-Z0-9]{5,12})\b/gi;
  function findConf(text) {
    CONF_RE.lastIndex = 0;
    let m;
    while ((m = CONF_RE.exec(text))) {
      const c = m[1];
      if (/^[A-Z0-9]+$/.test(c) && /\d|^[A-Z]{6}$/.test(c) && !/^(NUMBER|DETAILS|STATUS|SUMMARY)$/i.test(c)) return c;
      CONF_RE.lastIndex = m.index + 1;   // "Your trip confirmation\nConfirmation number: …" - try the next label
    }
    return '';
  }

  // Flights: every flight number from a known airline, then the airports,
  // date and times written near it.
  function flightsFromText(text, subject, from, ref) {
    const out = [];
    const sender = airlineFromSender(from);
    const hits = [];
    const codes = Object.keys(AIRLINES).join('|');
    const re = new RegExp('\\b(' + codes + ')\\s?(\\d{1,4})\\b(?![/:.-]?\\d)', 'g');
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 14), m.index);
      const tight = !/\s/.test(m[0]);
      if (!tight && !/flight|flt/i.test(before) && m[1] !== sender) continue;
      hits.push({ i: m.index, end: m.index + m[0].length, code: m[1], no: m[2] });
    }
    if (sender) {
      const re2 = /\bflight\s*(?:number|no\.?|#)?\s*:?\s*(\d{1,4})\b/gi;
      while ((m = re2.exec(text))) if (!hits.some(h => Math.abs(h.i - m.index) < 20)) hits.push({ i: m.index, end: m.index + m[0].length, code: sender, no: m[1] });
    }
    hits.sort((a, b) => a.i - b.i);
    // The first mention of a flight is the itinerary; later ones (a
    // traveller or seats section) repeat it with the wrong things nearby.
    const seenNo = new Set();
    for (let k = hits.length - 1; k >= 0; k--) hits[k].key = hits[k].code + hits[k].no.replace(/^0+(?=\d)/, '');
    const firsts = hits.filter(h => !seenNo.has(h.key) && seenNo.add(h.key));
    const conf = findConf(text);
    const dates = findDates(text, ref);
    const inDate = i => dates.some(d => i >= d.i && i < d.end);
    const timesIn = (a, b) => findTimes(text.slice(a, b)).map(t => ({ ...t, i: a + t.i, end: a + t.end })).filter(t => !inDate(t.i));
    // Which way round the email is written: details after each flight number
    // (most), or before it, with the number last (Frontier's check-in mails).
    const first = firsts[0];
    const detailsBefore = !!first && timesIn(Math.max(0, first.i - 400), first.i).length >= 2;
    // Pairs of airports in a stretch of text, each with where it starts.
    const pairsIn = (a, b) => {
      const w = text.slice(a, b), out = [];
      const ok = (x, y) => x !== y && !NOT_AIRPORT.has(x) && !NOT_AIRPORT.has(y);
      for (const m of w.matchAll(/\b([A-Z]{3})\b\)?\s*(?:to|-|–|—|→|›|>|=>|✈)\s*(?:[A-Za-z ,.'’]{0,40}\()?\b([A-Z]{3})\b/g)) if (ok(m[1], m[2])) out.push({ i: a + m.index, end: a + m.index + m[0].length, from: m[1], to: m[2] });
      const codes = [...w.matchAll(/\(\s*([A-Z]{3})\s*\)|\b([A-Z]{3})\b/g)].map(m => ({ c: m[1] || m[2], i: a + m.index, end: a + m.index + m[0].length, par: !!m[1] }))
        .filter(x => !NOT_AIRPORT.has(x.c) && (x.par || AIRPORTS[x.c] || /^[A-Z]{3}$/.test(x.c)));
      for (let k = 0; k + 1 < codes.length; k++) {
        const x = codes[k], y = codes[k + 1];
        if (ok(x.c, y.c) && y.i - x.end <= 80 && (x.par === y.par || AIRPORTS[x.c] || AIRPORTS[y.c])) out.push({ i: x.i, end: y.end, from: x.c, to: y.c });
      }
      return out.sort((p, q) => p.i - q.i);
    };
    const clean = (a, b) => !findTimes(text.slice(a, b)).length && !dates.some(d => d.i >= a && d.i < b);
    firsts.forEach((h, k) => {
      const prevEnd = k ? firsts[k - 1].end : 0, nextStart = firsts[k + 1] ? firsts[k + 1].i : text.length;
      let segA, segB, fromA = '', toA = '', date = '', times;
      if (detailsBefore) {
        segA = Math.max(prevEnd, h.i - 600); segB = h.i;
        const pr = pairsIn(segA, segB)[0];
        if (pr) { fromA = pr.from; toA = pr.to; }
        const ds = dates.filter(d => d.i >= segA && d.i < segB);
        date = (ds[0] || {}).date || '';
        times = timesIn(ds[0] ? ds[0].i : segA, segB);
      } else {
        segA = h.end; segB = Math.min(nextStart, h.end + 500);
        // Airports written just before the number (JetBlue) count when nothing
        // but the airports sits between them and it; else the first pair after.
        const near = pairsIn(Math.max(prevEnd, h.i - 120), h.i).filter(p => clean(p.end, h.i)).pop();
        const pr = near || pairsIn(segA, segB)[0];
        if (pr) { fromA = pr.from; toA = pr.to; }
        const before = dates.filter(d => d.i >= Math.max(prevEnd, h.i - 160) && d.i < h.i).pop();
        const after = dates.find(d => d.i >= segA && d.i < segB);
        const pick = after && (!before || after.i - h.end < h.i - before.end + 40) ? after : before || after;
        date = pick ? pick.date : '';
        times = timesIn(segA, segB);
      }
      const tWin = text;
      // A terminal or gate written with the flight (JetBlue: "2:59 PM Terminal: 2"):
      // the first one in its part of the email is the departure's.
      const seg = text.slice(segA, segB);
      const term = /\bterminal\s*[:#]?\s*([A-Z]?\d{1,2}[A-Z]?|[A-Z]|North|South|East|West|Main|International|Domestic)\b/i.exec(seg);
      const gate = /\bgate\s*[:#]?\s*([A-Z]{0,2}\d{1,3}[A-Z]?)\b/i.exec(seg);
      const depT = (times[0] || {}).time || '', arrT = (times[1] || {}).time || '';
      let arrDate = date;
      if (date && depT && arrT) {
        const plus = /^\s*\+\s?(\d)/.exec(tWin.slice(times[1].end, times[1].end + 8));
        if (plus) arrDate = addDays(date, +plus[1]);
        else if (arrT < depT) arrDate = addDays(date, 1);
      }
      const b = {
        type: 'flight', status: 'confirmed', conf, traveller: '',
        airline: AIRLINES[h.code] || '', airlineCode: h.code, flightNo: h.no.replace(/^0+(?=\d)/, ''),
        from: fromA, fromName: AIRPORTS[fromA] || '', to: toA, toName: AIRPORTS[toA] || '',
        dep: date ? date + (depT ? 'T' + depT : '') : '', depIso: '', arr: date && arrT ? arrDate + 'T' + arrT : '', arrIso: '',
        terminal: term ? term[1] : '', gate: gate ? gate[1].toUpperCase() : '', seat: '', guess: true,
      };
      if (!b.dep) return;                                   // no date: not enough to be useful
      if (out.some(o => o.airlineCode === b.airlineCode && o.flightNo === b.flightNo && o.dep.slice(0, 10) === b.dep.slice(0, 10))) return;
      out.push(b);
    });
    return out;
  }

  // Finds the date (and time) written just after a label such as "Check-in".
  function dateAfter(text, labelRe, ref, span = 120) {
    const re = new RegExp(labelRe.source, labelRe.flags.includes('g') ? labelRe.flags : labelRe.flags + 'g');
    let m;
    while ((m = re.exec(text))) {
      const seg = text.slice(m.index + m[0].length, m.index + m[0].length + span);
      const d = findDates(seg, ref)[0];
      if (!d || d.i > 60) continue;              // the label's own date follows it closely
      const t = findTimes(seg).find(x => x.i > d.i - 30);
      return { date: d.date, time: t ? t.time : '', rest: seg, at: m.index };
    }
    return null;
  }
  function lineAfter(text, labelRe) {
    const m = labelRe.exec(text);
    if (!m) return '';
    const lines = text.slice(m.index + m[0].length).split('\n').map(s => s.replace(/^[\s:–-]+/, '').trim()).filter(Boolean);
    for (const l of lines.slice(0, 4)) if (!findDates(l).length && !findTimes(l).length && l.length > 3 && l.length < 120) return l;
    return '';
  }

  function hotelFromText(text, subject, from, ref) {
    const hotelish = /marriott|bonvoy|hotel|resort|suites|inn\b|lodge|stay|booking\.com|expedia|hotels\.com|airbnb|hilton|hyatt|ihg/i;
    if (!hotelish.test(from + ' ' + subject + ' ' + text.slice(0, 2000))) return [];
    const ci = dateAfter(text, /check[- ]?in(?:\s+date)?\s*[:\-]?/i, ref), co = dateAfter(text, /check[- ]?out(?:\s+date)?\s*[:\-]?/i, ref);
    let checkIn = ci && ci.date, checkOut = co && co.date;
    if (!checkIn) {   // "Oct 2 - Oct 5, 2026" / "arriving … departing"
      const a = dateAfter(text, /arriv(?:al|ing)(?:\s+date)?\s*[:\-]?/i, ref), d = dateAfter(text, /depart(?:ure|ing)(?:\s+date)?\s*[:\-]?/i, ref);
      checkIn = a && a.date; checkOut = d && d.date;
    }
    if (!checkIn) return [];
    if (!checkOut || checkOut <= checkIn) {
      const n = /(\d{1,2})\s+nights?/i.exec(text);
      checkOut = n ? addDays(checkIn, +n[1]) : checkOut || addDays(checkIn, 1);
    }
    // Name: a brand name in the subject or the first lines, else the subject after "at"/"for".
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const brand = new RegExp('(' + MARRIOTT_BRANDS.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i');
    let name = '';
    const subj = String(subject || '').replace(/\s+on\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b.*$/i, '');
    const subjAt = /\bstay\s+at\s+(?:the\s+)?(.{4,90})$/i.exec(subj) || /\b(?:at|for)\s+(?!your\b)(?:the\s+)?(.{4,90}?)(?:\s*[|(–]|$)/i.exec(subj);
    if (subjAt && !/\d{5,}|\byour\b|reservation|\bstay\b|\btrip\b/i.test(subjAt[1])) name = subjAt[1].trim();
    if (!name) name = (lines.slice(0, 40).find(l => brand.test(l) && l.length < 90 && !/reward|bonvoy account|member|points|app/i.test(l)) || '').trim();
    if (!name) name = /marriott/i.test(from) ? 'Marriott' : ((/^"?([^"<]+?)"?\s*</.exec(from || '') || [])[1] || 'Hotel').trim();
    const nameAt = lines.findIndex(l => l === name || l.includes(name));
    let address = '';
    if (nameAt >= 0) { const next = lines.slice(nameAt + 1, nameAt + 4).find(l => /\d/.test(l) && /,|\b(st|street|ave|avenue|rd|road|blvd|boulevard|way|drive|dr|lane|ln)\b/i.test(l) && !findDates(l).length); if (next) address = next; }
    const conf = findConf(text) || ((/confirmation\s*(?:number|#|no\.?)?\s*[:#]?\s*(\d{6,12})/i.exec(text) || [])[1] || '');
    return [{
      type: 'hotel', status: 'confirmed', conf, traveller: '', name, address, city: '', phone: '',
      checkIn, checkInTime: ci && ci.time || '', checkOut, checkOutTime: co && co.time || '', guess: true,
    }];
  }

  const CAR_CLASSES = 'economy|compact|intermediate|mid-?size|standard|full-?size|premium|luxury|(?:small |mid-?size |standard |full-?size |large |premium )?suv|minivan|pickup|truck|convertible|electric';
  function carClassIn(text) {
    const m = new RegExp('reserved an? (' + CAR_CLASSES + ')\\b', 'i').exec(text)
      || new RegExp('(?:vehicle|car)(?:\\s+(?:class|type))?\\s*[:\\-]?\\s*(' + CAR_CLASSES + ')\\b', 'i').exec(text);
    return m ? m[1].replace(/\b\w/g, c => c.toUpperCase()) : '';
  }
  // Airport and other parking: "Arrival Date & Time … Exit Date & Time".
  function parkingFromText(text, subject, from, ref) {
    if (!/\bpark(?:ing)?\b/i.test(from + ' ' + subject)) return [];
    const a = dateAfter(text, /(?:arrival|entry|drop[- ]?off|check[- ]?in|start)(?:\s+date)?(?:\s*(?:&|and)\s*time)?\s*[:\-]?/i, ref, 80);
    const e = dateAfter(text, /(?:exit|departure|pick[- ]?up|check[- ]?out|end|return)(?:\s+date)?(?:\s*(?:&|and)\s*time)?\s*[:\-]?/i, ref, 80);
    if (!a) return [];
    const lot = (/(?:reserving for|reserved|lot|facility|airport)\s*[:\-]?\s*(?:<[^>]*>)?\s*([A-Z][\w&' .-]{2,40}?)(?:\s*[.\n]|$)/.exec(text) || [])[1] || '';
    return [{
      type: 'other', status: 'confirmed', conf: findConf(text) || ((/booking\s+([A-Z0-9]{5,8})\b/i.exec(subject) || [])[1] || ''), traveller: '',
      title: 'Parking' + (lot ? ' · ' + lot.trim() : ''), place: lot.trim(),
      start: a.date + (a.time ? 'T' + a.time : ''), end: e ? e.date + (e.time ? 'T' + e.time : '') : '', guess: true,
    }];
  }

  function carFromText(text, subject, from, ref) {
    const carish = /national|enterprise|hertz|avis|alamo|budget|sixt|thrifty|dollar|car rental|rental car|vehicle|emerald aisle|car hire/i;
    if (!carish.test(from + ' ' + subject + ' ' + text.slice(0, 1500))) return [];
    const pu = dateAfter(text, /pick[- ]?up(?:\s+(?:date|time|date\s*&\s*time|details))?\s*[:\-]?/i, ref, 200);
    const dr = dateAfter(text, /(?:return|drop[- ]?off)(?:\s+(?:date|time|date\s*&\s*time|details))?\s*[:\-]?/i, ref, 200);
    if (!pu) return [];
    const company = /national/i.test(from + subject) ? 'National' : /enterprise/i.test(from + subject) ? 'Enterprise' : /alamo/i.test(from + subject) ? 'Alamo'
      : /hertz/i.test(from + subject) ? 'Hertz' : /avis/i.test(from + subject) ? 'Avis' : /budget/i.test(from + subject) ? 'Budget' : /sixt/i.test(from + subject) ? 'Sixt'
      : ((/^"?([^"<]+?)"?\s*</.exec(from || '') || [])[1] || 'Car hire').trim();
    const place = s => {
      if (!s) return '';
      const l = s.split('\n').map(x => x.replace(/^[\s:–-]+/, '').trim()).filter(x => x && !findDates(x).length && !findTimes(x).length && x.length > 3 && x.length < 120);
      return l[0] || '';
    };
    const airport = /\(([A-Z]{3})\)|\b([A-Z]{3})\s+airport/i.exec(pu.rest || '');
    return [{
      type: 'car', status: 'confirmed', conf: findConf(text) || ((/(?:confirmation|reservation)\s*(?:number|#|no\.?)?\s*[:#]?\s*(\d{6,12}|[A-Z0-9]{8,12})/i.exec(text) || [])[1] || ''),
      traveller: '', company, carClass: carClassIn(text),
      pickupPlace: place(pu.rest) || lineAfter(text, /pick[- ]?up\s+location\s*[:\-]?/i), city: airport ? (AIRPORTS[(airport[1] || airport[2]).toUpperCase()] || '') : '',
      pickup: pu.date + (pu.time ? 'T' + pu.time : ''), pickupIso: '',
      dropPlace: dr ? place(dr.rest) : '', dropoff: dr ? dr.date + (dr.time ? 'T' + dr.time : '') : '', dropoffIso: '', guess: true,
    }];
  }

  // ---------------------------------------------------------------------
  // Everything together
  // ---------------------------------------------------------------------
  // msg: {html, text, subject, from, date (ms), id, threadId, doc?}
  // Returns {bookings, cancelled: bool}
  function parseEmail(msg) {
    const subject = String(msg.subject || ''), from = String(msg.from || '');
    const html = String(msg.html || '');
    const text = (msg.text && msg.text.trim()) ? String(msg.text) : htmlToText(html);
    const full = (html ? htmlToText(html) : '') || text;
    const ref = msg.date || Date.now();
    const cancelled = /\bcancel(?:l?ed|lation)\b/i.test(subject) || /your (?:reservation|booking|flight|trip) (?:has been|is|was) cancel/i.test(full.slice(0, 1500));
    let found = fromSchema([...jsonLdBlocks(html), ...(msg.doc ? microdata(msg.doc) : [])]);
    if (!found.length) {
      const body = full.length > text.length ? full : text;
      const parking = parkingFromText(body, subject, from, ref);
      found = parking.length ? parking : [...flightsFromText(body, subject, from, ref), ...hotelFromText(body, subject, from, ref), ...carFromText(body, subject, from, ref)];
      // A hotel or car email that mentions a flight number (e.g. "for your
      // arrival on UA123") shouldn't also make a flight, and vice versa.
      const sender = airlineFromSender(from);
      if (found.some(b => b.type !== 'flight') && !sender) found = found.filter(b => b.type !== 'flight');
      if (sender) found = found.filter(b => b.type === 'flight');
    }
    const source = { msgId: msg.id || '', threadId: msg.threadId || '', subject: subject.slice(0, 200), from: from.slice(0, 200), date: ref };
    for (const b of found) {
      if (cancelled) b.status = 'cancelled';
      b.source = source;
      b.id = idFor(b);
    }
    return { bookings: found, cancelled };
  }

  // Parses text pasted by hand (a forwarded confirmation, say).
  const parseText = (text, ref) => parseEmail({ text, subject: '', from: '', date: ref || Date.now() });

  const api = { parseEmail, parseText, htmlToText, jsonLdBlocks, fromSchema, microdata, findDates, findTimes, findConf, idFor, bookingKey, airlineFromSender, AIRLINES, AIRPORTS, addDays, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TravelParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
