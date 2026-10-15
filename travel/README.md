# Travel

Every flight, hotel and rental car in one place, as a home-screen web app in
the same frosted glass as Mail, Notes and News. It fills itself from the
booking emails in Gmail, shows live status for flights about to leave, and
links out to Google Flights, Google Hotels, Marriott and rental car searches
with the details filled in.

- **Trips**: bookings close together in time become a trip, named after
  where you're going (tap the name to change it). **Next** at the top is the
  next thing to happen: the flight with its gate and live status, the hotel
  check-in or the car pick-up. **Upcoming**, **Past**, and **To check** for
  bookings that need a look (below): an email with no date in it, something
  read from the words of an email, or something filled in by the calendar, the
  flight board or the AI. Only what is still to come is listed there; a
  booking whose date has passed is history, not a to-do.
- **A trip** is a timeline, day by day: flights, check-in and check-out,
  pick-up and return. **Add to calendar** (top) puts the whole trip in the
  iCloud Family calendar (through the Calendar app's function, where the site
  is on Cloudflare; elsewhere it saves a calendar file), so the calendar does
  the reminding. At the bottom,
  **Find more for this trip** opens Google Flights, Google Hotels, Marriott,
  Kayak rental cars and National with the trip's places and dates filled in.
- **A booking**: every detail can be edited (an undated one has a Date field first). A flight shows **live status**
  (on time or delayed, gates, terminals, baggage belt) from 36 hours before
  take-off until it lands. Links to the email (in Mail, or Gmail on the web),
  a map, the calendar, **Mark as cancelled** and **Delete**.
- **Explore**: from, to and dates, then one tap to search Google Flights,
  Google Hotels, Marriott, Kayak rental cars or National. Book there; the
  confirmation email then shows up in Trips by itself.
- **Add by hand** (the + button): a flight, hotel or rental car. The clipboard
  button reads a **pasted confirmation** (from any inbox, e.g. one forwarded
  by someone else) the same way Gmail's are read.
- **Two phones**: a shared Google Sheet, set up like Notes' (below).

**Travel Vintage** is the same app in a mid-century modern look, as its own app
with its own bookings and settings ([`travelvintage/`](../travelvintage/README.md)).
It needs its own redirect address in Google Cloud (below), asks this app's flight
status function, and can share this app's Google Sheet.

## How the emails are read

Travel reads Gmail **on the phone, read-only** (`gmail.readonly`: it can't
send, change or delete anything). The first time, it looks back a year; after
that, every time it opens (at most every 30 minutes) for anything new. It
only opens emails whose subject looks like a booking (confirmation,
itinerary, reservation, e-ticket, cancelled, …), that come from the
airlines, Marriott, National and the other big rental car companies, or that carry
Gmail's **Travel** label. Promotions are skipped. Each email is read once;
**Read the last year again** in Settings starts over,
replacing everything read from email except bookings you edited, checked or
deleted.

The **Travel** label is Mail's auto-tag (Mail → Tags → Auto-tags → Travel).
Gmail puts it on flight, hotel, rental and ride mail as it arrives, so
Travel picks up what its own search doesn't cover (Uber and Lyft rides,
Hopper, some airlines' gate and delay notices). If the auto-tag is off, the
label simply matches nothing. When the search widened to include it, the
next open looked back a year once more; mail already read isn't opened again.

Two ways of reading, best first:

1. **The booking data in the email.** Many airlines, hotels and rental car
   companies hide a small block of structured data (schema.org
   `FlightReservation`, `LodgingReservation`, `RentalCarReservation`) in
   their confirmations; it's what Gmail itself uses for its trip cards.
   When it's there, Travel uses it and the details are exact, time zones
   included.
2. **The words.** Otherwise Travel reads the text: flight numbers of the
   airlines below, the airport codes, dates and times around them; the
   check-in / check-out lines of hotel emails; the pick-up / return lines of
   rental car emails. This works for the common layouts but can't be perfect,
   so these bookings are marked **Check details**. Open one, fix anything
   that's off, and tap **Looks right**.

Airlines it knows by flight number: the major US ones (United, Delta,
American, Southwest, Alaska, JetBlue, Hawaiian, Spirit, Allegiant, Sun
Country), **Frontier (F9)** and **Breeze (MX)**, plus Air Canada, WestJet and
the big European, Middle East and Asian carriers (`AIRLINES` in `parse.js`).
Hotels: any, with Marriott's brands recognised by name. Rental cars: National,
Enterprise, Alamo, Hertz, Avis, Budget, Sixt. Parking (e.g. ParkRDU) shows as
its own entry in the trip.

It works out which way round each email is written: details after the flight
number (most airlines), airports just before it (JetBlue), or everything
before it with the number last (Frontier's check-in emails). A later mention
of the same flight (a seats or traveller list) is ignored.

A terminal or gate written with a flight (JetBlue lists each departure's
terminal) is kept and shown until live status has fresher ones.

Booking data that says a time is UTC ("…Z") isn't trusted, because American
Airlines writes local times that way; only a written offset (`-04:00`) counts.

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

- A flight moved to another day (same booking, same flight number, new
  date): the newest email decides, and the old day disappears.
- The same booking seen twice (two emails, a change of plans, or both
  phones reading their own Gmail) is one booking: flights are matched on
  airline, number, date and airport; hotels and cars on the confirmation
  number.
- **A flight number is not an identity.** Airlines use one number every day
  (Frontier's 3073 is every day's), so a flight with no day in its email is
  taken for an earlier booking of the same number and airports only when
  their confirmation codes do not differ; two codes are two bookings. Trips
  that share a confirmation code (a flight out, a flight home) are one trip
  only when they are within 30 days of each other.
- A later email updates a booking (a new time, a gate); a **cancellation**
  email marks it cancelled.
- **What you typed wins.** A booking you edited is never overwritten by an
  email (a cancellation is still noted).
- **Deleted means deleted.** A booking you delete doesn't come back when the
  email is read again, on this phone or the other.

Nothing about the emails is kept: only the bookings found in them, on the
phone and in your Google Sheet if you connect one. Nothing leaves the phone
either, except what **Smart help** sends when a booking is missing something
(next section).

**An email with no date.** Some confirmations (Frontier's, at times) leave the
day out altogether. The booking is not dropped: it is kept with its airports,
flight number and times, shown in **To check** as *Needs a date*, and it gets
its day from your Family calendar, from a later email about the same booking
(a check-in email has it), or from you (open it, pick the day). The email's own
print stamp ("10/13/26 06:54 PM" in a footer) is never taken for the day you
fly. This is only done for plain reservations (a booking subject, both
airports); airline promotions with a flight number in them are still ignored.

## Smart help

Two things, each switchable in Settings (the AI one only ever runs when you press its button):

**The Family calendar, both ways** (needs the Calendar app's function: the iCloud
secrets in `calendar/README.md`). Each time Travel reads Gmail, opens (every 20
minutes at most) or you change a booking:

- *Calendar into Travel.* Events in the Family calendar that read as a flight
  (a flight number, `RDU → CLE`, "Flight to Cleveland"), a hotel stay (a
  hotel's name, several days) or a car rental are matched with the bookings
  already here, by day plus what they share (flight number, airports, the time
  they leave; a hotel's name; the pick-up day). One match: it is linked, and an
  undated flight takes the event's day. No match: a booking is made from the
  event (*Made from an event in your calendar*, in To check), for events from
  today on. Two bookings fit: it is left alone. When the email about it
  arrives, it takes the booking over, so nothing is listed twice. Events
  Travel wrote itself (their ids end `@allison-travel`), repeating events and
  everything else are ignored.
- *Trips follow the reservation.* Bookings within a day of each other are one
  trip; so are neighbouring trips that share a confirmation code (one Alaska
  booking with a flight out and a flight home), and a flight that leaves from
  where the last one landed, away from home (the most common departure airport),
  within two weeks. Only neighbouring trips are joined. A hotel email from a
  booking site (Hilton's come from Cvent) is named from its subject or its
  "reservation at ..." line, and its city is read from the address; the email that
  says the confirmation number is pending and the one that has it are one stay.
- *Travel into the calendar.* A booking that is plainly right (not a guess, not
  "To check") and still to come (a flight also needs its time and both
  airports) is written to the Family calendar once, under its own id, and
  written again if you change it; a cancelled or deleted one is taken out (only
  events Travel itself wrote are ever removed). Nothing is written for a booking the calendar
  already has an event for (yours or ours), so a trip is never in the calendar
  twice. Calendar's Travel layer leaves out whatever the calendar already has.
  The trip's **Add to calendar** button still works, with the same ids.

**Filling in what is missing.** Nothing is looked up for a booking that has
everything. When something is missing, in this order: another email about the
booking (merged above), the Family calendar (above), the airport's flight
board, and last the AI:

- *Flight board.* A flight with an airline, both airports, the day and the time
  but no number: `functions/travel/api` `find` asks AeroDataBox's departure
  board for that airport in a window around the time. Only a single match is
  used.
- *AI, only when you press it.* A trip card (an upcoming trip with a booking that
  still lacks something) has a **Check with AI** button; nothing is ever sent to
  Claude without a press (not when Travel reads Gmail, not when it opens). A press
  reads the emails behind that trip's incomplete bookings from Gmail, and for each
  asks only about what is missing (a date is asked for only if the email has
  one), with no limit of its own (the cost is a fraction of a cent a check). It then also asks the flight
  board for a missing flight number, and says in a line what it did ("Filled in 2
  details", "The email doesn't say anything more", "didn't come from an email").
  The function (`extract`) scrubs the text (links, addresses, phone and long
  numbers, and the lines about points, payment and prices), sends it with what is
  already known, and asks Claude for the missing fields as structured output with
  the email's own words as a quote for each. An answer whose words are not in the
  excerpt, or whose shape is wrong, is thrown away: it can fill a gap, not invent
  one. It uses the repository's `ANTHROPIC_API_KEY` secret (the same one Meals,
  News and Orders use) and `claude-haiku-5-5` (a narrow reading job whose every
  answer is checked); the optional `TRAVEL_AI_MODEL` secret names another model. Settings has a switch that hides the button.
- *Ask AI.* Under the filters on Trips there is a bar: ask a question about your
  trips ("when is my next flight?", "which hotels did I stay at in September?",
  "what's still to check?") and press Enter. Nothing is sent while you type. The
  question goes to the function (`ask`) with your trip list (current, past and to
  check: dates, places, flight numbers, hotel and rental names, confirmation codes
  and what is unconfirmed; never names, seats, notes, email addresses or subjects),
  and Claude answers from that list alone, in a few sentences, and names the
  bookings it used, which are shown under the answer and open when tapped. If the
  list doesn't say, it says so. At most 300 characters a question, and no other
  limit. The bar shows even before there are any bookings: it then says there is
  nothing to look through, without asking Claude. Same key as above; it uses
  `claude-sonnet-5-5` (it reasons over dates and counts), and the optional
  `TRAVEL_ASK_MODEL` secret names another model. Claude Haiku 5.5 has no
  server-side fallback for a declined request, so none is asked for when either
  model is a Haiku. Each question costs a few cents at most (Sonnet 5.5 is $2 / $10
  per million tokens in / out; Haiku 5.5, $0.10 / $0.50). The Settings switch hides the
  bar along with the buttons.
- *Change by asking.* The bar has an **Ask / Change** switch. In Change, tell Travel
  what to change ("delete the Sheraton", "move my flight home to the 20th", "put the
  hotel in the San Diego trip", "add dinner with Pat on the 16th at 7 in Old Town",
  "cancel the Portland flight", "no seat on that flight", "call this trip December in
  San Diego") and press Enter. The function (`edit`) gets the instruction and the same
  trip list as Ask AI, with each trip's id, and Claude answers with changes from this
  list, at most thirty at a time:
  - **set** any field of a booking that you can edit by hand (flights: airline, number,
    airports, departure and arrival, terminal, gate, confirmation, seat, traveler,
    notes; hotels: name, address, city, confirmation, check-in and check-out with their
    times, phone, notes; cars: company, confirmation, places, pick-up and drop-off, car,
    city, notes; other bookings: title, place, start, end, confirmation, notes), or clear
    it with an empty value (a booking keeps its first date and its identifying names);
  - **add** a booking (flight, hotel, car or other), which needs its first date and what
    identifies it (a flight: airline, number, both airports; a hotel: name and check-out;
    a car: company; other: title);
  - **delete** a booking; **cancel** it or bring a cancelled one back; mark it **checked**
    ("looks right");
  - **join** a booking to another's trip, or **take it out** of its trip (a trip of its own);
  - **rename** a trip.
  Every change is checked in the function (the booking exists, the field belongs to its
  kind, the value has the right shape: airports are three letters, days are real days)
  and again in the app, and the ones that don't check out are left out and counted.
  What is left comes up as a **preview**, a line each, deletes in red, and **nothing
  changes until you tap Apply**. Apply marks what it touched as yours (an email never
  overwrites it again), a deleted booking stays deleted (and comes out of the calendar if
  Travel wrote it there), and **Undo** in the toast puts everything back, adds and
  deletes included. A day on its own keeps the booking's time. If the instruction is
  unclear it asks one short question instead. Joining and separating trips by hand is
  stored as `tripWith` and `tripApart` on the booking; trips also join by themselves when
  they share a confirmation code or the next flight leaves from where the last one
  landed (above). It sees what Ask AI sees, so names, seats, notes and emails are never
  sent from your trips; what you say in the instruction itself is sent, so if you tell
  it a seat or a traveler's name, that goes. Same key, model and cost as Ask AI, no limit
  of its own.
- *Which model answers.* Settings, under Smart help, says which models the function
  is set to use (Check: Haiku 5.5, Ask and Change: Sonnet 5.5, unless the
  `TRAVEL_AI_MODEL` and `TRAVEL_ASK_MODEL` secrets name others; `ping` reports them),
  and what the last answer on this phone said it came from, which is the function's
  own report of the model that answered. If a request was declined and a fallback
  model answered instead, it says so.
- Whatever is filled in this way is marked in the booking (*Filled in … from
  your calendar / by AI / from the airport's flight board. Check these
  details.*) and stays in **To check** until you tap **Looks right** or edit it.
  It is not written to the calendar until then.

## What Travel searches for, and re-reading

Each scan asks Gmail for the last year (then only what is new) of mail that is
not in Promotions and either has the Travel label, or has *confirmation*,
*confirmed*, *itinerary*, *reservation*, *booking*, *e-ticket*, *receipt*,
*your trip / flight / stay*, *check in*, *cancelled* in its subject, or comes
from one of the airlines, hotel groups (Hilton's group blocks come through
Cvent and Passkey), rental car companies, trains and booking sites listed at
the top of `app.js` (`SENDERS`). Travel remembers which emails it has read
(the *seen* list) and does not read one twice, so **when the reader
(`parse.js`) or that search improves, `QUERY_V` in `app.js` is bumped**: the
next scan on each phone then reads the last year again once, and what the old
reader made of those emails is made again by the new one. What you edited,
checked or deleted, what was filled in by AI, and what came from the calendar
stays as it is (the same as Settings, *Read the last year again*, which does it
on demand). The re-reading counts as done when (nearly) all the mail came down;
if the look stops partway, or more than three emails could not be downloaded,
what it had cleared is put back and the whole re-reading is tried again next time,
so an interrupted update never leaves holes.

**Settings > What Travel read** lists the emails the last look went through (up to
200, newest first): the subject, who from, the day, and what Travel made of each
("2 flights", "hotel", "no booking found in it", "couldn't be downloaded"), with a
line on how the look went. It answers "why is this booking missing?": an email
that is in the list but made no booking is a reader problem; an email that is not
in it was not matched by the search (or the look stopped before it); a look that
stopped says why. `travel/scripts/reader-version-test.mjs` fails when
`parse.js` or the search changes and `QUERY_V` does not.

## Gmail

Travel signs in with **Mail's own Google client** (the same client ID), so
there's no new Google Cloud project. It needs Travel's address added to that
client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the
   project Mail uses → **APIs & Services → Credentials** → the Mail **Web
   application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   - `https://tomallison24-news.pages.dev/travel/`
   - and, for Travel Vintage, `https://tomallison24-news.pages.dev/travelvintage/`
     (each app needs its own address: Google matches them exactly)
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
Cloudflare site (the old GitHub Pages copy is retired and only sends people on).

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
flight number and date, nothing about who's flying. The flight board lookup
(Smart help) sends an airline, two airports, a day and a time, is capped at 30
a month on a phone, and each answer is kept for an hour.

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

**"The secret code doesn't match"** when you're sure it does: (1) Apps
Script runs the *deployed* copy, so after changing `SECRET` choose **Deploy →
Manage deployments → ✏️ → Version: New version → Deploy**; (2) make sure the
link is the Travel Sheet's, not Notes'; (3) make sure the iPhone didn't fill
in the Notes code from its saved passwords. Spaces at the ends and the
phone's curly quotes and long dashes don't count against you, and Travel
says so when it can tell the link is Notes' or the script is an old copy.

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
- Kayak rental cars: `kayak.com/cars/<place>/<pick-up date>/<return date>`
- National: its home page (no search address found that could be checked).

None of these formats is published by the sites; they are the addresses the
sites themselves use. If one stops filling in the search, it still opens the
site.

## How it's built

- **No build step.** `index.html` is the page and its look (Notes' style
  block, unchanged, plus Travel's own pieces at the end), `app.js` the app,
  `parse.js` the email reading, `sw.js` the offline shell. As in Calendar,
  the sheets are Liquid Glass floating just inside the screen's edges (the
  trip page stays a whole page, with the same rows and glass buttons), the
  toast is the same clear glass as the sheets, the
  cards and rows (the trips, a trip's timeline, the lists) are very faint
  flat tiles, the same in every AllisonOS app, and the section bar and the
  Trips filter have a glass thumb that slides to the one chosen
  (`home/slide.js`, shared by every app).
- **Security as in Mail**: a Content Security Policy that only runs these
  files, no email is ever shown as a page (the HTML is only read as text),
  it refuses to run in a frame, and the sign-in carries a random `state`.
- **Data** in `localStorage` (bookings, trip names, which emails were read,
  live status), the Sheet link also in IndexedDB, as in Notes.
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node travel/scripts/parse-test.mjs   # the email reader: made-up emails in real emails' layouts
node travel/scripts/api-test.mjs     # the flight status function, AeroDataBox stubbed
node travel/scripts/app-test.mjs     # the app in headless Chromium, Gmail and flight status stubbed
node travel/scripts/smart-test.mjs [travel|travelvintage]   # Smart help in headless Chromium: undated bookings, To check, the calendar both ways, the AI and the flight board, all stubbed
node travel/scripts/make-icons.mjs   # redraws icon-512.png and icon-180.png from icon.svg
```

The last two need Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

- **Smart help was built and tested without the real services.** The AI route
  was never called against the real Claude API, and the flight board lookup
  was never called against AeroDataBox: both are tested with stand-ins that
  follow the documentation (`scripts/api-test.mjs`), and the departure board's
  answer shape (`movement`, `scheduledTime`) is from memory of AeroDataBox's
  documentation, read defensively. The first real use is the real test, and
  the AeroDataBox plan may count a board lookup as more than one unit.
- **The calendar side was never run against iCloud.** It uses Calendar's own
  `events` and `import` routes, which have their own tests; Travel's side is
  tested with a stand-in for them. Whether an event someone wrote by hand is
  recognised depends on its words (a flight number, two airports or "Flight
  to <city>" is enough; "Trip" is not).
- **Whether an email with no date is always like that.** The one real
  Frontier email this was built from had a blank where the date goes in its
  HTML; other airlines' layouts have not been seen.

This was built where Google, RapidAPI, AeroDataBox, Duffel and most travel
sites were blocked by the network, and without a real inbox. So:

- **The email reader was checked against ten real booking emails** (JetBlue,
  Frontier booking, check-in and update emails, American, Marriott, National,
  airport parking), all read correctly after the fixes they prompted. The
  tests copy those layouts with made-up names and codes; no real email is in
  the repository. Other airlines' layouts haven't been seen yet, so expect
  some **Check details** from them.
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
