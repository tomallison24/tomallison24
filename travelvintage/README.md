# Travel Vintage

[Travel](../travel/README.md) in a mid-century modern look, as its own app. It
does everything Travel does - every flight, hotel and rental car in one place,
read from the booking emails in Gmail, with live status for flights about to
leave, a timeline for each trip, and links out to Google Flights, Google
Hotels, Marriott and rental car searches - and reads the same Gmail. The
features, how the emails are read and what could not be checked are described
in `travel/README.md`; this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage, Home Vintage and Orders Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the Trips filter and the section bar
  have a mustard thumb, and each kind of booking is a solid round colour - a
  flight teal, a hotel burnt orange, a rental car olive, anything else (a ride)
  mustard - on a trip's timeline and in Add;
- the next flight, hotel check-in or car pick-up at the top is tinted by its
  kind, with a dashed flight path between the two airports; status pills are
  outlined (olive on time, mustard delayed or to check, orange canceled, teal
  scheduled); the live status is two flat tiles with a teal and an orange top
  edge for leaving and landing;
- three atomic shapes behind the title that scroll away with the page (and a
  mustard sun in the corner of a trip's page), and three little bars under the
  title;
- a solid burnt-orange add button and Done button; outlined teal and outlined
  red buttons; Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Travel Vintage is drawn this way for everyone:
the style picker in the design canvas is not built.

## What is separate from Travel

It is a second copy of Travel's page and script, not a setting, so the two can
change independently and Travel is never touched.

- **Own storage.** Every key is `travelv.…` or `allison-travelv-…` (Travel's is
  `travel.…` / `allison-travel-…`), the Sheet link's IndexedDB copy is
  `allison-travelv`, and the offline cache is `travelvintage-v1`, so each app
  has its own bookings, trip names, settings and cache. A booking edited in one
  is not edited in the other. A backup file from one can be imported into the
  other (the file keeps Travel's `allison-travel` marker for that reason).
- **Own sign-in address.** Google's sign-in returns to the page it started
  from, so the OAuth client needs this redirect URI added **once**, next to
  Travel's, Orders' and Mail's (Google Cloud console → Credentials → the web
  client): `https://tomallison24-news.pages.dev/travelvintage/` - exactly that,
  trailing slash included. It is the same client and the same Google Cloud
  project as Mail's; only the address is new. Until it is added, Connect Gmail
  shows Google's `redirect_uri_mismatch`. While a sign-in from Travel, Orders,
  Orders Vintage, Mail or Mail Vintage is fresh (it lasts an hour) and the apps
  are opened from the same Home Screen, Travel Vintage uses it, so there may be
  nothing to tap.
- **Live flight status comes from Travel's function.** There is one flight
  status function, `travel/api/` (`functions/travel/api`), with its one
  AeroDataBox key. Travel Vintage calls it at `../travel/api/`, with the same
  `X-Travel` header and the same family sign-in, so nothing new is needed on the
  server, and the function's 10-minute answers are shared: two phones, or the
  two apps, watching one flight spend the monthly allowance once. Each app
  still counts its own lookups on the phone (250 a month) in its own storage.
- **Its bookings show in Calendar.** Like Travel, it keeps a copy of its bookings in your family account for
  Calendar's Travel layer (`AllisonOS.layer.share`), but under its own name, `travelv`, so it never overwrites
  Travel's copy (a write replaces the whole layer). When Calendar or Calendar Vintage asks for your layers, the
  server shows the two together as Travel (`functions/aOS/api`, `GET layer`; a booking in both shows once, matched by
  its id). Use either Travel or both: the Travel layer in Calendar lists every booking from either. The trip's
  **Add to calendar** button (the Family calendar, or a calendar file) works as in Travel and adds the same events
  (they carry the same ids, so adding a trip from either app never doubles it).
- **The same Google Sheet, if you like.** Travel and Travel Vintage use the same
  Sheet script (`travel/google-sheet-sync.gs`), so pasting one Sheet's link and
  secret into both keeps the two in step: each booking and trip name carries the
  time it was last changed, and the newest wins. Or give each its own Sheet.
- **Opens its email in Mail Vintage**, not Mail (`../mailvintage/?thread=…`).
  Both are separate Home Screen apps; whether iOS opens that address inside the
  installed Mail Vintage or in Safari is up to iOS, which treats a link outside
  an app's own folder as a web page (not checked on a phone).
- **Smart help is the same** as Travel's (`travel/README.md`, "Smart help"): bookings
  with no date wait in To check, the Family calendar is read and written
  without listing a trip twice, and the flight board and the AI fill in what an
  email left out. Each has its own switch in this app's Settings, its own
  record of what was written (`calSig`) and asked, and it uses Travel's
  function. The calendar events carry the same ids as Travel's, so having both
  apps never doubles an event.
- **The same email reader.** `parse.js` is the same file as Travel's (checked by
  `scripts/same-reader-test.mjs`), so an email reads the same in both. When
  `travel/parse.js` changes, copy it over: `cp travel/parse.js
  travelvintage/parse.js`.

## Tests

`node travelvintage/scripts/app-test.mjs` is Travel's browser test, run on this
app (Gmail and the flight status function stubbed), plus checks that it is drawn
in the Retro look: Futura, flat cream (walnut) cards, mustard thumbs under the
section bar and the filter, an orange add button, round teal, orange and olive
kinds on a trip, the shapes behind the title; that it keeps only its own storage
keys; that a fresh sign-in from Orders or Mail is used; and that it leaves
Calendar's Travel layer to Travel (CI: `apps-check.yml`). `node
travelvintage/scripts/same-reader-test.mjs` checks the reader is Travel's.
`node travel/scripts/smart-test.mjs travelvintage` runs Travel's Smart help test on this app.
`node travelvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg` (a
cream jet climbing away on walnut, with a mustard sun and a burnt-orange pill).
The email reader's and the flight status function's tests (`parse-test.mjs`,
`api-test.mjs`) are Travel's own and are not repeated here.

## What I could not verify

- That the new redirect URI is added in Google Cloud: until it is, Connect Gmail
  fails with `redirect_uri_mismatch` (a fresh sign-in from Travel, Orders or
  Mail still works).
- How the Retro look reads on an iPhone in direct sunlight, and Futura on an
  iPhone: it was checked in headless Chromium at 390 x 844 in light and dark
  (where Futura falls back to the next font in the stack), not on a phone.
- Whether iOS opens "Open the email in Mail Vintage" inside the installed Mail
  Vintage app.
