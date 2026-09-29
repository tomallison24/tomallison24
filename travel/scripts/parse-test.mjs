// Checks travel/parse.js against made-up booking emails written in the
// shapes airlines, Marriott and National use: one with schema.org JSON-LD,
// the rest plain text that has to be read. None of these are real emails;
// the wording of real ones varies, which is why text-read bookings are
// marked "check this" in the app.
//
//   node travel/scripts/parse-test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const P = createRequire(import.meta.url)('../parse.js');
const REF = Date.parse('2026-09-20T12:00:00Z');
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const one = (msg, type) => {
  const r = P.parseEmail({ date: REF, ...msg });
  const list = r.bookings.filter(b => !type || b.type === type);
  return { r, list, b: list[0] };
};

test('JSON-LD flight reservation', () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: 'RXJ34P',
    reservationStatus: 'http://schema.org/ReservationConfirmed', underName: { '@type': 'Person', name: 'Tom Allison' },
    reservationFor: { '@type': 'Flight', flightNumber: '110', airline: { '@type': 'Airline', name: 'United', iataCode: 'UA' },
      departureAirport: { '@type': 'Airport', name: 'San Francisco Airport', iataCode: 'SFO' }, departureTime: '2027-03-04T20:15:00-08:00',
      arrivalAirport: { '@type': 'Airport', name: 'John F. Kennedy International Airport', iataCode: 'JFK' }, arrivalTime: '2027-03-05T06:30:00-05:00' },
  })}</script></head><body>Thanks for flying</body></html>`;
  const { b } = one({ html, subject: 'Your United flight', from: 'United <unitedairlines@united.com>' });
  assert.equal(b.type, 'flight'); assert.equal(b.guess, false);
  assert.equal(b.conf, 'RXJ34P'); assert.equal(b.airlineCode, 'UA'); assert.equal(b.flightNo, '110');
  assert.equal(b.from, 'SFO'); assert.equal(b.to, 'JFK');
  assert.equal(b.dep, '2027-03-04T20:15'); assert.equal(b.depIso, '2027-03-04T20:15:00-08:00');
  assert.equal(b.arr, '2027-03-05T06:30'); assert.equal(b.traveller, 'Tom Allison');
});

test('JSON-LD in @graph with hotel and car', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'LodgingReservation', reservationNumber: '81234567', reservationStatus: 'https://schema.org/ReservationConfirmed',
      reservationFor: { '@type': 'LodgingBusiness', name: 'Courtyard Boston Downtown', address: { streetAddress: '275 Tremont St', addressLocality: 'Boston', addressRegion: 'MA', postalCode: '02116', addressCountry: 'US' }, telephone: '+1 617-426-1400' },
      checkinDate: '2026-10-16T16:00:00-04:00', checkoutDate: '2026-10-19T11:00:00-04:00' },
    { '@type': 'RentalCarReservation', reservationNumber: '1234567890', reservationFor: { '@type': 'Car', name: 'Midsize', rentalCompany: { name: 'National' } },
      pickupLocation: { name: 'Boston Logan (BOS)', address: { addressLocality: 'Boston' } }, pickupTime: '2026-10-16T13:30:00-04:00',
      dropoffLocation: { name: 'Boston Logan (BOS)' }, dropoffTime: '2026-10-19T10:00:00-04:00' },
  ] })}</script>`;
  const r = P.parseEmail({ html, date: REF });
  const h = r.bookings.find(x => x.type === 'hotel'), c = r.bookings.find(x => x.type === 'car');
  assert.equal(h.name, 'Courtyard Boston Downtown'); assert.equal(h.checkIn, '2026-10-16'); assert.equal(h.checkOut, '2026-10-19');
  assert.equal(h.checkInTime, '16:00'); assert.equal(h.city, 'Boston'); assert.match(h.address, /275 Tremont St, Boston, MA/);
  assert.equal(c.company, 'National'); assert.equal(c.pickup, '2026-10-16T13:30'); assert.equal(c.dropoff, '2026-10-19T10:00'); assert.equal(c.carClass, 'Midsize');
});

test('United-style text email', () => {
  const text = `Your trip confirmation
Confirmation number: KQ7T2M
Fri, Oct 16, 2026
UA 1234
Denver, CO, US (DEN) to Boston, MA, US (BOS)
Departs 7:05 AM   Arrives 12:50 PM
Seat 23C
Mon, Oct 19, 2026
UA 987
Boston, MA, US (BOS) to Denver, CO, US (DEN)
Departs 6:15 PM   Arrives 9:02 PM`;
  const { list } = one({ text, subject: 'Your United flight confirmation - KQ7T2M', from: 'United Airlines <unitedairlines@united.com>' }, 'flight');
  assert.equal(list.length, 2);
  assert.deepEqual([list[0].flightNo, list[0].from, list[0].to, list[0].dep, list[0].arr], ['1234', 'DEN', 'BOS', '2026-10-16T07:05', '2026-10-16T12:50']);
  assert.deepEqual([list[1].flightNo, list[1].from, list[1].to, list[1].dep, list[1].arr], ['987', 'BOS', 'DEN', '2026-10-19T18:15', '2026-10-19T21:02']);
  assert.equal(list[0].conf, 'KQ7T2M'); assert.equal(list[0].guess, true);
});

test('Frontier-style email, flight number without the airline code', () => {
  const text = `Your trip confirmation code is TRZ4KD
Flight 2154
Orlando (MCO) → Philadelphia (PHL)
Thursday, November 5
Depart 10:40am  Arrive 1:18pm`;
  const { b } = one({ text, subject: 'Your Frontier Airlines Itinerary', from: 'Frontier Airlines <noreply@emails.flyfrontier.com>' }, 'flight');
  assert.equal(b.airlineCode, 'F9'); assert.equal(b.flightNo, '2154');
  assert.equal(b.from, 'MCO'); assert.equal(b.to, 'PHL');
  assert.equal(b.dep, '2026-11-05T10:40'); assert.equal(b.arr, '2026-11-05T13:18'); assert.equal(b.conf, 'TRZ4KD');
});

test('Breeze-style email', () => {
  const text = `Booking confirmation: BZ8QPA
MX 312  CHS - HPN
Sat 12/05/2026  3:25 PM - 5:20 PM`;
  const { b } = one({ text, subject: 'Breeze Airways booking confirmation', from: 'Breeze Airways <hello@flybreeze.com>' }, 'flight');
  assert.equal(b.airlineCode, 'MX'); assert.equal(b.flightNo, '312'); assert.equal(b.from, 'CHS'); assert.equal(b.to, 'HPN');
  assert.equal(b.dep, '2026-12-05T15:25'); assert.equal(b.arr, '2026-12-05T17:20');
});

test('overnight flight lands the next day', () => {
  const text = `Confirmation: LX9PQR\nDL 404  LAX to JFK\nOct 20, 2026 11:30 PM - 7:55 AM`;
  const { b } = one({ text, from: 'Delta <DeltaAirLines@t.delta.com>' }, 'flight');
  assert.equal(b.dep, '2026-10-20T23:30'); assert.equal(b.arr, '2026-10-21T07:55');
});

test('Marriott-style text email', () => {
  const text = `Thank you for booking with us.
Confirmation Number: 81234567
Courtyard Boston Downtown
275 Tremont Street, Boston, MA 02116
Check-in: Friday, October 16, 2026 4:00 PM
Check-out: Monday, October 19, 2026 11:00 AM
1 Room, 2 Adults`;
  const { b } = one({ text, subject: 'Reservation Confirmation #81234567 for Courtyard Boston Downtown', from: 'Marriott Bonvoy <reservations@res.marriott.com>' }, 'hotel');
  assert.equal(b.name, 'Courtyard Boston Downtown'); assert.equal(b.conf, '81234567');
  assert.equal(b.checkIn, '2026-10-16'); assert.equal(b.checkOut, '2026-10-19'); assert.equal(b.checkInTime, '16:00');
  assert.match(b.address, /275 Tremont Street/);
});

test('National-style text email', () => {
  const text = `Your reservation is confirmed.
Confirmation Number: 1234567890
Pick-Up
Friday, October 16, 2026 1:30 PM
Denver International Airport (DEN)
Return
Monday, October 19, 2026 10:00 AM
Denver International Airport (DEN)
Vehicle Class: Midsize`;
  const { b } = one({ text, subject: 'National Car Rental Reservation Confirmation', from: 'National Car Rental <nationalcar@nationalcar.com>' }, 'car');
  assert.equal(b.company, 'National'); assert.equal(b.conf, '1234567890');
  assert.equal(b.pickup, '2026-10-16T13:30'); assert.equal(b.dropoff, '2026-10-19T10:00');
  assert.equal(b.pickupPlace, 'Denver International Airport (DEN)'); assert.equal(b.carClass, 'Midsize'); assert.equal(b.city, 'Denver');
});

test('cancellation marks the booking cancelled', () => {
  const text = `Your reservation has been cancelled.\nConfirmation number: KQ7T2M\nUA 1234 DEN to BOS\nOct 16, 2026 7:05 AM`;
  const { b, r } = one({ text, subject: 'Your flight has been cancelled', from: 'United <unitedairlines@united.com>' }, 'flight');
  assert.equal(r.cancelled, true); assert.equal(b.status, 'cancelled');
});

test('same flight from two emails gets the same id', () => {
  const a = one({ text: 'UA 1234 DEN to BOS Oct 16, 2026 7:05 AM', from: 'x@united.com' }, 'flight').b;
  const c = one({ text: 'Flight UA1234 Denver (DEN) to Boston (BOS) on Friday, October 16, 2026', from: 'friend@example.com' }, 'flight').b;
  assert.equal(a.id, c.id);
});

test('a newsletter is not a booking', () => {
  const text = `Fall sale! Fly to 100 cities from $49. Book by Oct 1, 2026. Use code FALL49 at checkout. Terms apply. AA 12 is not a flight here.`;
  const { r } = one({ text, subject: 'Fall sale: fares from $49', from: 'Deals <deals@example.com>' });
  assert.equal(r.bookings.length, 0);
});

test('HTML tables become readable lines', () => {
  const t = P.htmlToText('<table><tr><td>Flight</td><td>UA&nbsp;1234</td></tr><tr><td>Depart</td><td>7:05&nbsp;AM</td></tr></table>');
  assert.match(t, /Flight\s+UA 1234\nDepart\s+7:05 AM/);
});

test('dates in many shapes', () => {
  const d = s => P.findDates(s, REF).map(x => x.date);
  assert.deepEqual(d('2026-10-01'), ['2026-10-01']);
  assert.deepEqual(d('Thu, Oct 1, 2026'), ['2026-10-01']);
  assert.deepEqual(d('1st October 2026'), ['2026-10-01']);
  assert.deepEqual(d('10/01/2026'), ['2026-10-01']);
  assert.deepEqual(d('25/12/2026'), ['2026-12-25']);
  assert.deepEqual(d('01OCT26'), ['2026-10-01']);
  assert.deepEqual(d('Jan 5'), ['2027-01-05']);   // no year, after the email -> next January
});

// ---- Layouts seen in real booking emails (2026), with made-up names and codes ----
// Blocks of HTML table cells with Windows line endings, as the airlines send them.
const rows = (...cells) => '<table>\r\n' + cells.map(c => '<tr>\r\n  <td>\r\n    ' + c + '\r\n  </td>\r\n</tr>\r\n\r\n\r\n').join('') + '</table>';

test('JetBlue: airports before "Flight 1184", times after, and a traveller section that repeats the numbers', () => {
  const html = '<html><body>' + rows('Your JetBlue confirmation code is ZXQWER',
    'RDU', 'BOS', 'Flight 1184', 'Wed, Jun 3', '2:59 PM', 'Terminal: 2', '-', 'Wed, Jun 3', '4:59 PM',
    'BOS', 'LHR', 'Flight 1620', 'Wed, Jun 3', '6:30 PM', 'Terminal: C', '-', 'Thu, Jun 4', '6:30 AM',
    'LHR', 'JFK', 'Flight 0020', 'Wed, Jun 10', '11:55 AM', 'Terminal: 2', '-', 'Wed, Jun 10', '3:07 PM',
    'Your Traveler Details', 'Boston', 'BOS', 'London-Heathrow', 'LHR', 'Flight #', '1620', 'Seat:', '22D',
    'New York', 'JFK', 'Raleigh/Durham', 'RDU', 'Flight #', '0020', 'Seat:', '8D') + '</body></html>';
  const { list } = one({ html, subject: 'JetBlue booking confirmation - ZXQWER', from: 'JetBlue <jetblueairways@needtoknow.jetblue.com>', date: Date.parse('2026-03-01') }, 'flight');
  assert.deepEqual(list.map(b => [b.flightNo, b.from, b.to, b.dep, b.arr]), [
    ['1184', 'RDU', 'BOS', '2026-06-03T14:59', '2026-06-03T16:59'],
    ['1620', 'BOS', 'LHR', '2026-06-03T18:30', '2026-06-04T06:30'],
    ['20', 'LHR', 'JFK', '2026-06-10T11:55', '2026-06-10T15:07'],
  ]);
  assert.deepEqual(list.map(b => b.terminal), ['2', 'C', '2'], 'the departure terminal written with each flight');
});

test('Frontier check-in: each flight\'s details come before "Flight Number:"', () => {
  const html = rows('Your Flight Details', 'DEPARTING FLIGHT', 'RDU to CLE', 'Monday, June 15, 2026', 'Trip Time: 1 hrs., 45 min.',
    '3:18 PM', 'Raleigh-Durham, NC (RDU)', '5:03 PM', 'Cleveland, OH (CLE)', 'Flight Number: 3073',
    'RETURN FLIGHT', 'CLE to RDU', 'Friday, June 19, 2026', 'Trip Time: 1 hrs., 31 min.',
    '1:02 PM', 'Cleveland, OH (CLE)', '2:33 PM', 'Raleigh-Durham, NC (RDU)', 'Flight Number: 3074',
    'Book flight', '©2026 Frontier Airlines. 4545 Airport Way | Denver, CO 80239', '06/14/26 01:33 PM');
  const { list } = one({ html, subject: "It's time to check in for your flight to Cleveland", from: 'flights@emails.flyfrontier.com', date: Date.parse('2026-06-14') }, 'flight');
  assert.deepEqual(list.map(b => [b.flightNo, b.from, b.to, b.dep, b.arr]), [
    ['3073', 'RDU', 'CLE', '2026-06-15T15:18', '2026-06-15T17:03'],
    ['3074', 'CLE', 'RDU', '2026-06-19T13:02', '2026-06-19T14:33'],
  ]);
});

test('Frontier booking: "Departs CLE … Arrives RDU", not the seats list below ("RDU-CLE 13F")', () => {
  const html = rows('Booking Confirmation: MNBVCX', 'Departing Flight: September 7, 2026', 'Flight', '#3073', 'Departs', 'RDU', '3:32 PM', 'Raleigh/Durham',
    'Arrives', 'CLE', '5:15 PM', 'Cleveland', 'Return Trip: September 11, 2026', 'Flight', '#3074', 'Departs', 'CLE', '1:34 PM', 'Cleveland',
    'Arrives', 'RDU', '3:09 PM', 'Raleigh/Durham', 'Outbound Seats', 'RDU-CLE 13F', 'Return Seats', 'CLE-RDU 18A');
  const { list } = one({ html, subject: 'Booking Confirmation: MNBVCX. Your Upcoming Trip to CLE', from: 'flights@t.flyfrontier.com', date: Date.parse('2026-08-31') }, 'flight');
  assert.deepEqual(list.map(b => [b.flightNo, b.from, b.to, b.dep, b.arr, b.conf]), [
    ['3073', 'RDU', 'CLE', '2026-09-07T15:32', '2026-09-07T17:15', 'MNBVCX'],
    ['3074', 'CLE', 'RDU', '2026-09-11T13:34', '2026-09-11T15:09', 'MNBVCX'],
  ]);
});

test('booking data with a bare "Z" (American) is read as the local time it really is', () => {
  const ld = [{ '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: 'QWERTY', reservationStatus: 'Confirmed',
    reservationFor: { '@type': 'Flight', flightNumber: 'AA 2379', airline: { name: 'American Airlines', iataCode: 'AA' },
      departureAirport: { name: 'Raleigh-Durham', iataCode: 'RDU' }, departureTime: '2026-06-15T18:25Z',
      arrivalAirport: { name: 'Charlotte', iataCode: 'CLT' }, arrivalTime: '2026-06-15T19:45Z' } }];
  const { b } = one({ html: '<script type="application/ld+json">' + JSON.stringify(ld) + '</script><p>6:25 PM AA 2379</p>' }, 'flight');
  assert.equal(b.flightNo, '2379'); assert.equal(b.dep, '2026-06-15T18:25'); assert.equal(b.depIso, '');
});

test('booking data with a landing time equal to take-off (Frontier) has no landing time', () => {
  const ld = { '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: 'ASDFGH',
    reservationFor: { '@type': 'Flight', flightNumber: '3074', airline: { name: 'Frontier Airlines', iataCode: 'F9' },
      departureAirport: { iataCode: 'CLE' }, departureTime: '2026-06-19T13:02', arrivalAirport: { iataCode: 'RDU' }, arrivalTime: '2026-06-19T13:02' } };
  const { b } = one({ html: '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>' }, 'flight');
  assert.equal(b.dep, '2026-06-19T13:02'); assert.equal(b.arr, '');
});

test('Marriott "Plan for your upcoming stay": an earlier "check in" in the text is not the check-in', () => {
  const html = rows('Humaniti Hotel Montreal, Autograph Collection', '340 de la Gauchetiere O Montreal, Quebec H2Z0C3 Canada',
    'Message your hotel, check in, order food, and more with the Marriott Bonvoy App.', 'Plan Your Activities',
    'Confirmation Number', '12345678', 'Check-In', 'Tue, Jul 07, 2026', '04:00 PM', 'Check-Out', 'Sat, Jul 11, 2026', '12:00 PM');
  const { b } = one({ html, subject: 'Plan for your upcoming stay at Humaniti Hotel Montreal, Autograph Collection on Tuesday, July 7, 2026',
    from: 'reservations@res-marriott.com', date: Date.parse('2026-07-02') }, 'hotel');
  assert.equal(b.name, 'Humaniti Hotel Montreal, Autograph Collection'); assert.equal(b.conf, '12345678');
  assert.equal(b.checkIn, '2026-07-07'); assert.equal(b.checkOut, '2026-07-11'); assert.equal(b.checkInTime, '16:00');
  assert.match(b.address, /Gauchetiere/);
});

test('National: the car class, not the sentence about car classes', () => {
  const html = rows('Confirmation:', '11223344', 'Thanks for choosing National. You reserved a Midsize vehicle on September 7, 2026 at CLEVELAND INTL ARPT .',
    'If one is specifically needed, please reserve the appropriate car class to ensure the location will have one ready.',
    'PICK UP', 'CLEVELAND INTL ARPT ( CLE )', 'Mon, September 7, 2026', '5:30 PM', 'RETURN', 'CLEVELAND INTL ARPT ( CLE )', 'Fri, September 11, 2026', '1:00 PM',
    'Vehicle', 'Midsize', 'Toyota Corolla or similar');
  const { b } = one({ html, subject: 'Confirmed: National Car Rental Reservation at CLEVELAND INTL ARPT on September 7, 2026 (CLE)', from: 'reservations@nationalcar.com', date: Date.parse('2026-08-31') }, 'car');
  assert.equal(b.carClass, 'Midsize'); assert.equal(b.pickup, '2026-09-07T17:30'); assert.equal(b.dropoff, '2026-09-11T13:00'); assert.equal(b.conf, '11223344');
});

test('airport parking is parking, not a hotel ("00:30 AM" included)', () => {
  const html = rows('Thank you for reserving for <strong>ParkRDU Central</strong>. Your confirmation number is <strong>ABCDE</strong>.',
    'Booking Reference&#58;', 'ABCDE', 'Arrival Date &#38; Time&#58;', '02/04/26 06:00 AM', 'Exit Date &#38; Time&#58;', '02/06/26 00:30 AM');
  const { r } = one({ html, subject: 'Booking ABCDE Parking Confirmation', from: 'noreply@parkrdu.com', date: Date.parse('2026-02-02') });
  assert.equal(r.bookings.length, 1);
  const b = r.bookings[0];
  assert.equal(b.type, 'other'); assert.match(b.title, /^Parking/); assert.equal(b.conf, 'ABCDE');
  assert.equal(b.start, '2026-02-04T06:00'); assert.equal(b.end, '2026-02-06T00:30');
});

console.log(n + ' passed');
