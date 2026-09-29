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

// Rides: the shapes of real Uber and Lyft receipts (cells and rows as the
// app's HTML reader leaves them), which reach the app through the Travel label.
const UBER = 'Jul 7, 2026 12:58 PM\nThanks for riding, Tom  We hope you enjoyed your ride this afternoon.\nTotal  $24.96\nTrip fare  CA$23.90\n' +
  'Trip details\nUberX PIN\n19.20 kilometers, 20 minutes\n1:40 PM\nAéroport international Pierre-Elliott-Trudeau de Montréal (YUL), Dorval, QC H4Y 1G7, CA\n' +
  '2:01 PM\n340 rue de la Gauchetière O, Montréal, QC H2Z 0C3, CA\n1:40 PM\nAéroport international (YUL), Dorval, QC\n2:01 PM\n340 rue de la Gauchetière O, Montréal';
test('Uber ride receipt -> a ride, pickup to drop-off', () => {
  const { b, r } = one({ text: UBER, subject: '[Personal] Your Tuesday afternoon trip with Uber', from: 'Uber Receipts <noreply@uber.com>' });
  assert.equal(r.bookings.length, 1);
  assert.equal(b.type, 'other'); assert.equal(b.ride, true); assert.equal(b.guess, false);
  assert.equal(b.title, 'Uber ride · $24.96');
  assert.equal(b.place, 'Montreal airport → 340 rue de la Gauchetière O');
  assert.equal(b.start, '2026-07-07T13:40'); assert.equal(b.end, '2026-07-07T14:01');
});
test('the charge summary and the receipt for one Uber ride are one booking', () => {
  const a = one({ text: UBER, subject: '[Personal] Your Tuesday afternoon trip with Uber', from: 'noreply@uber.com' }).b;
  const c = one({ text: UBER.replace('Thanks for riding', 'This is your charge summary'), subject: '[Personal] Your Tuesday afternoon trip with Uber', from: 'noreply@uber.com' }).b;
  assert.equal(a.id, c.id);
});
test('Lyft ride receipt -> a ride', () => {
  const text = 'Lyft\nThanks for riding with Ahmad Jawad!\nYOUR RIDE TO 975 BOULEVARD ROMÉO-VACHON N ON JULY 11, 2026 AT 10:36 AM\nApple Pay (Visa)  CA$28.96\n' +
    'Standard fare (19.40km, 23m 17s)  CA$24.29\nYour trip\nPickup 10:36 AM\n345 Rue de la Gauchetière O, Montréal, QC H2Z, Canada\n' +
    'Drop-off 10:59 AM\n975 Boulevard Roméo-Vachon N, Dorval, QC H4Y, Canada\nReceipt #2239722285473282210';
  const { b } = one({ text, subject: 'Your ride with Ahmad Jawad on July 11', from: 'Lyft <no-reply@lyftmail.com>' });
  assert.equal(b.title, 'Lyft ride · CA$28.96');
  assert.equal(b.place, '345 Rue de la Gauchetière O → 975 Boulevard Roméo-Vachon N');
  assert.equal(b.start, '2026-07-11T10:36'); assert.equal(b.end, '2026-07-11T10:59');
});
test('other Uber and Lyft mail is never a booking', () => {
  for (const [subject, from, text] of [
    ['Your Tuesday evening order with Uber Eats', 'Uber Eats <noreply@uber.com>', 'Pickup 7:10 PM\n12 Main St, Apex, NC 27502\nTotal $31.00'],
    ['Reservation confirmed for Wednesday, June 3', 'Uber <no-reply@uber.com>', 'Pickup is at 1:20pm from 503 Samara St, Raleigh, NC\nVehicle: Toyota Camry'],
    ['20% off your next ride', 'Lyft <no-reply@marketing.lyftmail.com>', 'Rental car deals, pick up Oct 3, 2026 10:00 AM'],
  ]) assert.equal(one({ subject, from, text }).r.bookings.length, 0, subject);
});

console.log(n + ' passed');
