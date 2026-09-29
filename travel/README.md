# Travel

Every flight, hotel and car hire in one place, as a home-screen web app in
the same frosted glass as Mail, Notes and News. It fills itself from the
booking emails in Gmail, shows live status for flights about to leave, and
links out to Google Flights, Google Hotels, Marriott and car hire searches
with the details filled in.

- **Trips**: bookings close together in time become a trip, named after
  where you're going (tap the name to change it). **Next** at the top is the
  next thing to happen: the flight with its gate and live status, the hotel
  check-in or the car pick-up. **Upcoming**, **Past**, and **To check** for
  bookings that need a look (below).
- **A trip** is a timeline, day by day: flights, check-in and check-out,
  pick-up and return. **Add to calendar** (top) puts the whole trip in the
  iCloud Family calendar (through the Calendar app's function, where the site
  is on Cloudflare; elsewhere it saves a calendar file), so the calendar does
  the reminding. At the bottom,
  **Find more for this trip** opens Google Flights, Google Hotels, Marriott,
  Kayak car hire and National with the trip's places and dates filled in.
- **A booking**: every detail can be edited. A flight shows **live status**
  (on time or delayed, gates, terminals, baggage belt) from 36 hours before
  take-off until it lands. Links to the email (in Mail, or Gmail on the web),
  a map, the calendar, **Mark as cancelled** and **Delete**.
- **Explore**: from, to and dates, then one tap to search Google Flights,
  Google Hotels, Marriott, Kayak car hire or National. Book there; the
  confirmation email then shows up in Trips by itself.
- **Add by hand** (the + button): a flight, hotel or car hire. The clipboard
  button reads a **pasted confirmation** (from any inbox, e.g. one forwarded
  by someone else) the same way Gmail's are read.
- **Two phones**: a shared Google Sheet, set up like Notes' (below).

## How the emails are read

Travel reads Gmail **on the phone, read-only** (`gmail.readonly`: it can't
send, change or delete anything). The first time, it looks back a year; after
that, every time it opens (at most every 30 minutes) for anything new. It
only opens emails whose subject looks like a booking (confirmation,
itinerary, reservation, e-ticket, cancelled, …), that come from the
airlines, Marriott, National and the other big car hire firms, or that carry
Gmail's **Travel** label. Promotions are skipped. Each email is read once;
**Read the last year again** in Settings starts over.

The **Travel** label is Mail's auto-tag (Mail → Tags → Auto-tags → Travel).
Gmail puts it on flight, hotel, rental and ride mail as it arrives, so
Travel picks up what its own search doesn't cover (Uber and Lyft rides,
Hopper, some airlines' gate and delay notices). If the auto-tag is off, the
label simply matches nothing. When the search widened to include it, the
next open looked back a year once more; mail already read isn't opened again.

Two ways of reading, best first:

1. **The booking data in the email.** Many airlines, hotels and car hire
   firms hide a small block of structured data (schema.org
   `FlightReservation`, `LodgingReservation`, `RentalCarReservation`) in
   their confirmations; it's what Gmail itself uses for its trip cards.
   When it's there, Travel uses it and the details are exact, time zones
   included.
2. **The words.** Otherwise Travel reads the text: flight numbers of the
   airlines below, the airport codes, dates and times around them; the
   check-in / check-out lines of hotel emails; the pick-up / return lines of
   car hire emails. This works for the common layouts but can't be perfect,
   so these bookings are marked **Check details**. Open one, fix anything
   that's off, and tap **Looks right**.

Airlines it knows by flight number: the major US ones (United, Delta,
American, Southwest, Alaska, JetBlue, Hawaiian, Spirit, Allegiant, Sun
Country), **Frontier (F9)** and **Breeze (MX)**, plus Air Canada, WestJet and
the big European, Middle East and Asian carriers (`AIRLINES` in `parse.js`).
Hotels: any, with Marriott's brands recognised by name. Car hire: National,
Enterprise, Alamo, Hertz, Avis, Budget, Sixt.

**Rides.** Uber and Lyft receipts become a ride: pickup to drop-off, the
times and the fare (**Uber ride · $24.96**, *Montreal airport → 340 rue de la
Gauchetière O*), with a car icon. A ride shows on the trip it was taken on,
the day before or after included (the ride to the airport); a ride at home
isn't a trip, so it isn't shown. Uber's charge summary and its receipt for
the same ride are one ride. Nothing else from Uber or Lyft is read as a
booking (Uber Eats, scheduled-pickup notices, offers). Rides are read from
the receipt's layout as it is today, checked against real receipts; if Uber
or Lyft change it, a ride may come out without its addresses.

Rules that keep it tidy:

- The same booking seen twice (two emails, a change of plans, or both
  phones reading their own Gmail) is one booking: flights are matched on
  airline, number, date and airport; hotels and cars on the confirmation
  number.
- A later email updates a booking (a new time, a gate); a **cancellation**
  email marks it cancelled.
- **What you typed wins.** A booking you edited is never overwritten by an
  email (a cancellation is still noted).
- **Deleted means deleted.** A booking you delete doesn't come back when the
  email is read again, on this phone or the other.

Nothing about the emails is kept or sent anywhere: only the bookings found
in them, on the phone and in your Google Sheet if you connect one.

## Gmail

Travel signs in with **Mail's own Google client** (the same client ID), so
there's no new Google Cloud project. It needs Travel's address added to that
client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the
   project Mail uses → **APIs & Services → Credentials** → the Mail **Web
   application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   - `https://tomallison24.github.io/tomallison24/travel/`
   - and the Cloudflare address too, if you use that one: `https://<your
     Cloudflare Pages address>/travel/`
3. **Save**. Google can take a few minutes to pick it up.
4. **OAuth consent screen → Data access** (or **Scopes**): if
   `gmail.readonly` isn't listed, add it. Mail's `gmail.modify` is a
   different scope, and Google asks for each one separately.

Then open Travel → the gear → **Connect Gmail**. Opened from AllisonOS Home,
Travel can also use Mail's sign-in while it's fresh (they share storage there),
so often there's nothing to tap.

As in Mail, Google gives a browser-only app an hour-long sign-in and no
background renewal; Travel goes back through Google quietly when it needs
to, and asks for one tap if Google can't answer quietly.

## Live flight status

Flight status comes from **AeroDataBox**, through RapidAPI, via a small
Cloudflare Pages Function on the site (`functions/travel/api/[[route]].js`)
that holds the key, so the key never reaches a phone. It only runs on the
**Cloudflare** copy of the site; on the GitHub Pages copy Travel says it's
not available there.

Set up (about 5 minutes):

1. Make a free account at [rapidapi.com](https://rapidapi.com), open the
   **AeroDataBox** API and subscribe to the **Basic (free)** plan.
2. Copy your **X-RapidAPI-Key**.
3. In this repository: **Settings → Secrets and variables → Actions → New
   repository secret**, name `AERODATABOX_KEY`, paste the key.
4. Run the **News** workflow (Actions → News → Run workflow) on `main`. It
   hands the key to the Cloudflare Pages project and redeploys.

Settings in Travel then says **Working**.

Keeping it free: each flight is looked up only from 36 hours before take-off
until it lands, at most every 10 minutes in the last 6 hours and hourly
before that; the server keeps each answer for 10 minutes so both phones share
it; and each phone stops at 250 lookups a month. Sent to AeroDataBox: the
flight number and date, nothing about who's flying.

## Google Sheet sync

The same design as Notes (read `notes/README.md`, "Google Sheet sync", for
the details), with **its own Sheet and script**:

1. [sheets.new](https://sheets.new) → name it e.g. **AllisonOS - Travel**.
2. **Extensions → Apps Script**, replace `Code.gs` with the whole of
   [`google-sheet-sync.gs`](google-sheet-sync.gs), and change
   `const SECRET = 'CHANGE-ME';` to your own long phrase.
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access:
   Anyone* → **Deploy** → authorise → copy the **Web app URL**.
4. Travel → gear → **Google Sheet sync** → paste the URL and the phrase →
   **Connect and sync**. Then **Copy setup link** and open it on the other
   phone with the clipboard button.

The Sheet gets a readable **Bookings** tab (soonest first) and hidden
`_bookings`, `_trips` and `_deleted` tabs the app reads back. Newest change
wins. Each phone reads its own Gmail; the same booking found by both is
still one booking.

## Links out

Google Flights and Google Hotels have **no public API**, so Travel can't show
their prices inside the app; it opens them with the search filled in:

- Google Flights: `google.com/travel/flights?q=Flights from DEN to BOS on …`
- Google Hotels: `google.com/travel/search?q=Hotels in Boston …`
- Marriott: `marriott.com/search/findHotels.mi?destinationAddress.destination=…&fromDate=MM/DD/YYYY&toDate=…`
- Kayak car hire: `kayak.com/cars/<place>/<pick-up date>/<return date>`
- National: its home page (no search address found that could be checked).

None of these formats is published by the sites; they are the addresses the
sites themselves use. If one stops filling in the search, it still opens the
site.

## How it's built

- **No build step.** `index.html` is the page and its look (Notes' style
  block, unchanged, plus Travel's own pieces at the end), `app.js` the app,
  `parse.js` the email reading, `sw.js` the offline shell.
- **Security as in Mail**: a Content Security Policy that only runs these
  files, no email is ever shown as a page (the HTML is only read as text),
  it refuses to run in a frame, and the sign-in carries a random `state`.
- **Data** in `localStorage` (bookings, trip names, which emails were read,
  live status), the Sheet link also in IndexedDB, as in Notes.
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node travel/scripts/parse-test.mjs   # the email reader, on made-up emails
node travel/scripts/api-test.mjs     # the flight status function, AeroDataBox stubbed
node travel/scripts/app-test.mjs     # the app in headless Chromium, Gmail and flight status stubbed
node travel/scripts/make-icons.mjs   # redraws icon-512.png and icon-180.png from icon.svg
```

The last two need Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

This was built where Google, RapidAPI, AeroDataBox, Duffel and most travel
sites were blocked by the network, and without a real inbox. So:

- **The email reader was tested on made-up emails** written in the layouts
  airlines, Marriott and National use, not on real ones. Real emails will
  differ; expect some **Check details** at first. Send me a few that come
  out wrong (with personal details removed) and the reader can be taught
  them.
- **AeroDataBox's answer format** was taken from its documentation as quoted
  in search results and in other people's code, not from a live call. The
  function reads it defensively, but the first real lookup is the real test.
- **The free AeroDataBox plan** (600 units a month) is from search results,
  not RapidAPI's own page, and I couldn't confirm how many units one flight
  lookup costs. The 250-a-month cap per phone is a guess to stay inside it;
  RapidAPI's dashboard shows the real use, and `LOOKUPS_A_MONTH` in `app.js`
  changes the cap.
- **The Google Flights / Google Hotels / Marriott / Kayak address formats**
  are not documented by those sites (see *Links out*).
- **Safari on an iPhone** was not tested; the app was checked in Chromium at
  iPhone size, light and dark.
