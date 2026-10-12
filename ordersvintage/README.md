# Orders Vintage

[Orders](../orders/README.md) in a mid-century modern look, as its own app. It
does everything Orders does - everything you've bought and where it is, read
from the order, shipping, delivery and store-pickup emails in Gmail, with the
courier, the tracking number and a button that opens the carrier's own page -
and reads the same Gmail. The features, how the emails are read and what could
not be checked are described in `orders/README.md`; this page covers what
differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas, as
in Mail Vintage and Home Vintage:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive: the filter has a mustard thumb, the
  progress bars and tracking buttons are teal and orange, each store gets a
  round teal, mustard, orange or olive monogram;
- three atomic shapes behind the title that scroll away with the page, and
  three little bars under it;
- a solid burnt-orange add button; outlined and solid-orange buttons; Futura,
  which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath. Orders Vintage is drawn this way for everyone:
the style picker in the design canvas is not built.

## What is separate from Orders

It is a second copy of Orders' page and script, not a setting, so the two can
change independently and Orders is never touched.

- **The one-off clean-up** of old open orders works as in Orders (`orders/README.md`), once on this app's own orders.
- **Fix details with Claude** works the same, through the same server route as Orders
  (`/orders/api/read`), and asks its own first-time question.
- **Opens its email in Mail Vintage**, not Mail (`../mailvintage/?thread=…`). Both are
  separate Home Screen apps; whether iOS opens that address inside the installed
  Mail Vintage or in Safari is up to iOS, which treats a link outside an app's
  own folder as a web page (not checked on a phone).
- **Own storage.** Every key is `ordersv.…` or `allison-ordersv-…` (Orders' is
  `orders.…` / `allison-orders-…`), so each app has its own orders, settings
  and offline cache (`ordersvintage-v1`). An order edited in one is not edited
  in the other. A backup file from one can be imported into the other.
- **Own sign-in address.** Google's sign-in returns to the page it started
  from, so the OAuth client needs this redirect URI added **once**, next to
  Orders' and Mail's (Google Cloud console → Credentials → the web client):
  `https://tomallison24-news.pages.dev/ordersvintage/` - exactly that, trailing
  slash included. It is the same client and the same Google Cloud project as
  Mail's and Orders'; only the address is new. Until it is added, Connect Gmail
  shows Google's `redirect_uri_mismatch`. While a sign-in from Orders, Mail or
  Mail Vintage is fresh (it lasts an hour) and the apps are opened from the same
  Home Screen, Orders Vintage uses it, so there may be nothing to tap.
- **The same Google Sheet, if you like.** Orders and Orders Vintage use the same
  Sheet script (`orders/google-sheet-sync.gs`), so pasting one Sheet's link and
  secret into both keeps the two in step: each order carries the time it was
  last changed, and the newest wins. Or give each its own Sheet.
- **The same email reader.** `parse.js` is the same file as Orders' (checked by
  `scripts/same-reader-test.mjs`), so an email reads the same in both. When
  `orders/parse.js` changes, copy it over: `cp orders/parse.js
  ordersvintage/parse.js`.

## Tests

`node ordersvintage/scripts/app-test.mjs` is Orders' browser test, run on this
app (Gmail stubbed), plus checks that it is drawn in the Retro look: Futura,
flat cream (walnut) cards, a mustard thumb, an orange add button and the shapes
behind the title (CI: `apps-check.yml`). `node
ordersvintage/scripts/same-reader-test.mjs` checks the reader is Orders'.
`node ordersvintage/scripts/make-icons.mjs` redraws the icons from `icon.svg` (a
cream parcel on burnt orange, with a teal sun and a mustard pill).
