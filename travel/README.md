# Travel

Every flight, hotel and rental car in one place, as a home-screen web app in
a mid-century Vintage design or the Sea glass of Mail, Notes and News. It fills itself from the
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
- **Ipsy**, the little stem cell at the bottom left: ask about your trips in your
  own words, change them (each change with Undo), look up any flight live, and
  check your Gmail (below).
- **Private** (the pill on a booking, or **Private trip** on a trip's page)
  hides a booking from Ipsy: it is left out of everything Ipsy reads (Ipsy is
  told only how many there are), Ipsy can't change it and doesn't check it,
  and a trip with some private bookings is shown to Ipsy with the others only,
  named and dated by them. Its emails are hidden too (the email, its thread,
  and any email that names its confirmation or flight number), in Calendar's
  Ipsy as well, and its Family calendar event is marked private. It still syncs
  and shows as usual, and the family still sees it. **Settings → Ipsy can search Gmail** turns Ipsy's Gmail
  off altogether, on this phone.
- **Just me** (on a booking of yours, or **Just me trip** on a trip's page) is
  something else: only you see it. It stays on your phone and in the family's
  Google Sheet, and the Sheet gives it to nobody else; it isn't put in the
  Family calendar (and comes out if Travel put it there). A small **Just me**
  pill marks it on the trip's timeline and on the trip card. Only the booking's
  own person can make it Just me or shared again, so someone else's booking has
  no switch, just whose it is ("Ella's booking, shared with the family"). A
  Just me trip makes every booking of yours in it Just me (someone else's in it
  stay shared), and its name too.
- **The family's Google Sheet**: everyone's trips, through aOS (below).

## The two designs

One app, one set of bookings: the design changes only how Travel looks, at
once, and is kept on this phone (**Settings → Design**, the first section), as
in Clock. `../home/design.js`, loaded in `<head>`, applies it before the page
is drawn.

- **Vintage** (the default): mid-century modern in the Retro colours, from the
  aOS Design Styles canvas, as in Mail, Home and Orders:
  - a cream ground and cards (walnut in dark mode), flat and round-cornered, in
    place of glass;
  - mustard, teal, burnt orange and olive: the Trips filter and the section bar
    have a mustard thumb, and each kind of booking is a solid round colour - a
    flight teal, a hotel burnt orange, a rental car olive, anything else (a
    ride) mustard - on a trip's timeline and in Add;
  - the next flight, hotel check-in or car pick-up at the top is tinted by its
    kind, with a dashed flight path between the two airports; status pills are
    outlined (olive on time, mustard delayed or to check, orange canceled, teal
    scheduled); the live status is two flat tiles with a teal and an orange top
    edge for leaving and landing;
  - three atomic shapes behind the title that scroll away with the page (and a
    mustard sun in the corner of a trip's page), and three little bars under
    the title;
  - a solid burnt-orange add button and Done button; outlined teal and outlined
    red buttons; Futura, which iOS has built in, so no font is downloaded.

  **The sky.** Behind the title is the shared Vintage sky (`../home/sky.js`,
  as in every Vintage design): by day a ground washed with mustard, the sun and
  rays that turn very slowly; after sunset a ground washed with deep teal, the
  moon and twinkling stars; each over cream (Light) or walnut (Dark), for the
  phone's place (only if the app already has location permission: it never
  asks), else its time zone. It holds still with reduced motion. This app only
  gives its disc its colour (`--sky-disc`) and keeps its own sizes and places
  for the shapes; the sun on a trip's page is the moon at night too. Checked by
  `aOS/scripts/sky-test.mjs`.
- **Standard**: Sea glass: Notes' style block, frosted glass over a slow
  aurora, no sky.

How: the Vintage look is the `<style id="vintage">` block after the glass
styles in `index.html`; Standard is that block switched off (`media="not
all"`), with `data-look="glass"` on `<html>`, which `sky.js` reads to draw no
sky. Only colours, shapes and type change: every button, sheet and swipe works
the same in both (the section bar's and the filter's thumbs are measured again
when the design changes, as Futura is wider). The choice is `localStorage`
`design.travel`. What iOS reads when Travel is added to the Home Screen follows
it: the icon (`icon-180.png`, Vintage: a cream jet climbing away on walnut, with
a mustard sun and a burnt-orange pill; `icon-glass-180.png`, Standard), the
status bar style (`default` in Vintage, where `black-translucent`'s white clock
would vanish on the cream) and the bar colours.

**The old Travel Vintage app.** Travel Vintage used to be an app of its own
(`travelvintage/`, with its own storage). Its address now opens this same app
(the deploy copies `travel/` there, `.github/workflows/news.yml`), so a phone
that added it keeps it. The first time it opens there, `design.js` moves that
app's data on the phone over to Travel's names (`allison-travelv-…` →
`allison-travel-…`, `travelv.…` → `travel.…`, so the bookings, settings and
Gmail sign-in; the IndexedDB copy of the Sheet link `allison-travelv` →
`allison-travel`; and what it had seen, so no walkthrough again), unless Travel
already has data on that phone; nothing old is deleted. From there:

- its calls go to `../travel/api/` (not `api/`), so they reach Travel's route
  from either address;
- Google's sign-in returns to the address it started from, which is already
  registered for it (`https://tomallison24-news.pages.dev/travelvintage/`,
  "Gmail" below);
- Calendar's Travel layer is published under the old app's own name,
  `travelv`, as before (Travel's is `travel`): on a phone with both on the
  Home Screen, each keeps its own copy up to date and neither overwrites the
  other's (a write replaces the whole layer); the server shows the two
  together as Travel (`functions/aOS/api`, `GET layer`; a booking in both
  shows once, matched by its id).

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
  email is read again, on this phone or any of the family's.

Nothing about the emails is kept: only the bookings found in them, on the
phone and, once you're signed in, in the family's Google Sheet. Nothing leaves the phone
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

Two things, each switchable in Settings (the AI one runs when you press its button, or by itself once you have told Ipsy yes):

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
- *AI: Have Ipsy check, or Ipsy by itself.* A trip card (an upcoming trip with a booking that
  still lacks something) has a **Have Ipsy check** button (it was Check with AI). Nothing is sent
  to Claude by itself until you say yes to Ipsy: the first time Travel finds an upcoming booking
  from an email that is missing something, Ipsy offers from its corner ("2 bookings are missing
  details. Want me to look?"), and asks in its bubble. Yes turns on **Ipsy checks by itself**
  (Settings, Smart help): after each read of Gmail, when Travel opens and after you change a
  booking (once the calendar and the flight board have had their go), every upcoming booking
  still missing something is checked, once per email, at most 10 at a time, quietly (with the
  family session it has, never a Face ID prompt; signed out, it stops and says so). What it fills in
  is marked **Check** (so it waits in To check for you to look over), with Undo in Ipsy's chat;
  Ipsy says in its corner what it did. Not now, or the switch off, and only the button sends
  anything. A press
  reads the emails behind that trip's incomplete bookings from Gmail, and for each
  asks only about what is missing (a date is asked for only if the email has
  one), with no limit of its own (the cost is a fraction of a cent a check). It then also asks the flight
  board for a missing flight number, and says in a line what it did ("Ipsy filled in 2
  details", with Undo, also in Ipsy's chat, "The email doesn't say anything more", "didn't come from an email").
  The function (`extract`) scrubs the text (links, addresses, phone and long
  numbers, and the lines about points, payment and prices), sends it with what is
  already known, and asks Claude for the missing fields as structured output with
  the email's own words as a quote for each. An answer whose words are not in the
  excerpt, or whose shape is wrong, is thrown away: it can fill a gap, not invent
  one. It uses the repository's `ANTHROPIC_API_KEY` secret (the same one Meals,
  News and Orders use) and `claude-haiku-5-5` (a narrow reading job whose every
  answer is checked); the optional `TRAVEL_AI_MODEL` secret names another model. Settings has a switch that hides the button and stops Ipsy's own check.
- *Questions and changes in your own words* are Ipsy's (below). Ipsy took the place of the
  Ask AI bar that was under the filters on Trips, with its Ask and Change modes.
- *Which model answers.* Settings, under Smart help, says which models the function
  is set to use (Check: Haiku 5.5, unless the `TRAVEL_AI_MODEL` secret names another;
  Ipsy: Sonnet 5.5, unless `TRAVEL_IPSY_MODEL` does; `ping` reports both), and what
  the last Check answer on this phone said it came from, which is the function's own
  report of the model that answered. If a request was declined and a fallback model
  answered instead, it says so.
- Whatever is filled in this way is marked in the booking (*Filled in … from
  your calendar / by AI / from the airport's flight board. Check these
  details.*) and stays in **To check** until you tap **Looks right** or edit it.
  It is not written to the calendar until then.

## Ipsy

**Ipsy** is the little stem cell at the bottom left, just above the Trips and
Explore tabs: a helper you chat with about your trips, in the design picked in
Settings (mustard, teal and cream in Vintage, pastel glass in Standard; it
changes with the design at once). It took the place of the Ask AI bar under the
filters on Trips, and does both of its jobs: answering questions and changing
your trips. Ask in your own words, e.g. *When's my next flight? Is it on time?*,
*Where's the hotel in San Diego?*, *Is UA 1234 tomorrow delayed?*, *What's the
number of the Frontier flight from RDU to Cleveland on Nov 2 at 4 PM?*, *Move my
flight home to the 20th*, *Put the hotel in the San Diego trip*, *Add dinner with
Pat on the 16th at 7 in Old Town*, *Delete the Denver trip*, *Check Gmail for
bookings I'm missing*.

- **What it can do** (`ipsy-tools.js`, its tools in `functions/travel/api`,
  `IPSY_CLIENT_TOOLS`):
  - look through your trips and bookings, every detail of each (seat, traveler,
    terminal, notes, why one is marked Check, the email it came from);
  - change them: edit or clear any detail you can edit by hand (a day on its own
    keeps the booking's time), cancel one or bring it back, mark one checked, add
    one, delete, put a booking in another trip or take it out into one of its own,
    rename a trip, delete a whole trip; and open a trip on screen;
  - **look up any flight live, on its own**: its status, delays, times, gates,
    terminals and baggage belt, through the app's own flight service
    (`travel/api/flight`), whether or not the flight is in the app or in any email;
    and find a flight's number from the airline, the airport, the day and the time
    on the airport's departure board (`travel/api/find`). It is told to use these
    for live status rather than the emails, and when it doesn't know a flight's
    number, to try the board, then search the web (the airline, route, day and
    time), and to confirm what it found with a live look-up;
  - search and read your Gmail (read-only, with the app's own sign-in), and search
    the web and read pages.
- **Every change shows in the chat with Undo**, for as long as the app stays open,
  so it changes what you ask without asking first; the one exception is **deleting a
  whole trip** (or every booking in one), which it asks about in the chat, with
  Delete and Keep it buttons, and nothing goes until you tap Delete. Changes go
  through the same checks and the same save as the rest of the app (`checkEdit`,
  `applyEdits` in `app.js`): what it changes is yours (a later email won't overwrite
  it), a deleted booking doesn't come back from the email and comes out of the Family
  calendar if Travel put it there, and it all goes to the family's Google Sheet. Undo puts back
  just the bookings and trip name that change touched.
- **Live look-ups count** toward the same monthly allowances on the phone as the
  app's own (250 flight look-ups, 30 departure board look-ups; "Live flight status"
  below); past them, Ipsy says so. A look-up of one of your flights close to take-off
  also updates its live status in the app.
- **How it works.** The chat lives on the phone. Each step sends the whole
  conversation to the family server (`functions/travel/api`, `POST ipsy`), which adds
  Ipsy's instructions and tools and asks **Claude Sonnet 5.5** (medium effort, prompt
  caching on, Anthropic's server-side fallback if it declines; `server/ipsy.js`). When
  Claude asks for one of Travel's tools, it runs on the phone, where the bookings and
  the Gmail sign-in are, and the result goes back with the next step. Web search and
  web pages run at Anthropic. `TRAVEL_IPSY_MODEL` (optional repository secret) names
  another model.
- **Asked first, once.** Before the first question, Ipsy says what is sent where: your
  question and whatever it looks at to answer it (your bookings, with any names,
  seats and notes in them, and any email it opens) go to Claude through the family
  server, which keeps only a count of questions (80 a person a day; the steps a
  question takes aren't counted). Flight look-ups send AeroDataBox only the flight
  number and the day. Unlike the Ask AI bar, which sent a trip list without names,
  seats or notes, Ipsy reads what the question needs, so those can be sent.
- **For signed-in family** (Face ID): `/travel/api/` is locked to the family once
  accounts are on, and Ipsy also needs the `ANTHROPIC_API_KEY` secret; without it, it
  says it isn't set up.
- **Emails and web pages are read, never obeyed**: Ipsy is told they are material,
  not instructions. Gmail access is read-only, and an email's links reach Claude as
  their site only (*[link to united.com]*), so a one-tap link in an email (check in,
  cancel, change a seat) is never opened.
- **New chat** (top of the chat) starts over; a chat is kept on the phone until then.
- **Not tried against the real API or on a phone**: the tests use a stand-in for
  Claude and for the flight service (`node travel/scripts/ipsy-test.mjs`,
  `node travel/scripts/api-test.mjs`), so the first real questions are the real test
  of the instructions. Ipsy floats above the tabs (the dock has no room beside them
  on a 390-point-wide phone), so trip cards scroll under it, as they do under the
  dock; the list ends far enough up that nothing is left under it.

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
   - and, for the old Travel Vintage address (it opens this same app, "The two
     designs" above), `https://tomallison24-news.pages.dev/travelvintage/`
     (Google matches each address exactly)
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
a month on a phone, and each answer is kept for an hour. Ipsy's look-ups (above)
count toward the same two caps.

## The family's Google Sheet

One Sheet for the whole family, the record of everyone's trips, through aOS
(the design, and the owner's setup, are in `aOS/SHEETS.md`; Travel is a
`family` Sheet):

- **Whose**: each booking and trip name is its own person's (`by`, written by
  the Sheet), and the family sees it, unless that person made it **Just me**
  (`only: true`). The Sheet gives a Just me booking only to its own person, and
  only they can set or clear it; another phone can't change or delete it, even
  with its id. Rows from before aOS are the owner's.
- **No link or phrase on the phone.** Every sync goes through aOS
  (`../home/sheet.js`, `functions/sheet/api`), signed in with your family
  account, and aOS adds the Sheet's phrase and who's asking. Settings → **The
  family's Google Sheet** shows how it's going and **Sync now** (which signs you
  in if it has to). Signed out, Travel works on the phone as before, and that
  sheet says to sign in. A phone that kept the old link and phrase hands them
  to aOS once (the owner's phone; aOS keeps them from then on) and forgets
  them; an old setup link (`#sync=…`) is only taken off the address, and a
  pasted one says there's nothing to set up.
- **It syncs** when Travel opens, 2 seconds after a change, when it comes back
  to the front, and when the phone is back online, only when you're signed in.
- **90 days on the phone.** Once it has synced, this phone keeps every booking
  still to come (and under way), every one with no date yet, every trip name,
  and the bookings that ended in the last 90 days; older ones are dropped from
  the phone after each sync, with no deletion (the Sheet keeps them all).
  **Past** asks the Sheet for them (`{ action: 'range' }`) the first time it's
  shown in a session (or **Show older trips from the Sheet**, when that didn't
  work, or you were signed out), and they go from the phone again at the next
  tidy-up. An email about one of those old trips, read again, doesn't make it
  over again on the phone (a fresh copy would win over the Sheet's, your edits
  and all).
- **Your Gmail is yours.** Someone else's shared booking came from their
  Gmail: it has no links to its email here, and **Read the last year again**
  (and the re-read after a reader update) only redoes bookings whose emails
  were read on this phone, so it never deletes the family's.
- **Calendar's Travel layer** is what's on this phone: your bookings and the
  family's shared ones still to come and from the last 90 days (plus any older
  ones Past just fetched). Older trips aren't in it any more.
- **The Sheet** has a readable **Bookings** tab (soonest first, with **Who**
  first and **Seen by**, Family or Just me, last) and hidden `_bookings`,
  `_trips`, `_deleted` and `_people` tabs the app reads back. Newest change
  wins. Each phone reads its own Gmail; the same booking found by two is still
  one booking (it stays its first person's).
- The script is [`google-sheet-sync.gs`](google-sheet-sync.gs) (VERSION 2).
  Paste it into the Travel Sheet's Apps Script, keeping your `SECRET` line, and
  deploy a new version; then give aOS the phrase (aOS → Account → Google
  Sheets), or open Travel signed in on the owner's phone. Steps:
  `aOS/SHEETS.md`, "Setting it up".

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
  block, unchanged, plus Travel's own pieces at the end, for Standard; then
  the `<style id="vintage">` block, "The two designs" above), `app.js` the app,
  `parse.js` the email reading, `ipsy-tools.js` Ipsy's tools (Ipsy itself is
  `../home/ipsy.js`, shared by every app with Ipsy), `sw.js` the offline shell. In Standard, as in Calendar,
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
  live status). No Sheet link or phrase: aOS keeps them (an old one, in
  `localStorage` or the IndexedDB copy, is handed over and deleted).
- Published with the other apps by `.github/workflows/news.yml`.

## Tests

```sh
node travel/scripts/parse-test.mjs   # the email reader: made-up emails in real emails' layouts
node travel/scripts/api-test.mjs     # the flight status function, AeroDataBox stubbed; extract; Ipsy's step, Claude stubbed
node travel/scripts/reader-version-test.mjs   # QUERY_V is bumped whenever the reader or the search changes
node travel/scripts/sheet-test.mjs   # the Sheet's script on an in-memory Sheet: who gets in, shared and Just me, the owner's old rows, 90 days and older on asking, Who
node travel/scripts/app-test.mjs     # the app in headless Chromium, Gmail and flight status stubbed; both designs, Settings > Design, the old Travel Vintage address; the family's Sheet through aOS (Just me, Past)
node travel/scripts/smart-test.mjs [travel|travelvintage]   # Smart help in headless Chromium: undated bookings, To check, the calendar both ways, the AI and the flight board, all stubbed (and, signed in, the family's Sheet); at Travel's address or the old Travel Vintage one
node travel/scripts/ipsy-test.mjs    # Ipsy in headless Chromium, both designs, light and dark: its tools, Undo, asking before a whole trip goes; Claude, Gmail and the flight service stubbed
node travel/scripts/make-icons.mjs   # icon-*.png from icon.svg (Vintage) and icon-glass-*.png from icon-glass.svg (Standard)
```

The last four need Playwright with Chromium (`npm i -g playwright`).

## What I could not verify

- **Smart help and Ipsy were built and tested without the real services.** The AI
  routes (extract, ipsy) were never called against the real Claude API, and the flight board lookup
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
  iPhone size, light and dark, in both designs (where Futura falls back to the
  next font in the stack).
