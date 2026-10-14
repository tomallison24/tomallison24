# Mail Vintage

[Mail](../mail/README.md) in a mid-century modern look, as its own app. It does
everything Mail does - the Marketing bucket that empties itself, tags that sort
mail by sender, swipes, search, reply and forward with Undo Send, attachments,
Remind Me, Tidy, the unread count on the icon - and reads the same Gmail. The
features are described in `mail/README.md`; this page covers what differs.

## The look

Mid-century modern in the Retro colours, from the aOS Design Styles canvas:

- a cream ground and cards (walnut in dark mode), flat and round-cornered, in
  place of glass;
- mustard, teal, burnt orange and olive; three atomic shapes behind the title
  that scroll away with the page, and three little bars under it;
- a walnut pill at the bottom for the mailbox menu, with a mustard icon; a
  solid orange compose button; outlined teal buttons;
- Futura, which iOS has built in, so no font is downloaded.

It is the last block of the style sheet in `index.html`; the glass styles above
it are still there underneath, so where `mail/README.md` says "glass" it means
the place and shape of a control, not its surface. Mail Vintage is drawn this
way for everyone: the style picker in the design canvas is not built.

**The sky.** The page behind the title is Weather Vintage's: by day (Light) a cream
ground washed with mustard, with the sun and rays that turn very slowly; by night
(Dark) a walnut ground washed with deep teal, with the moon and twinkling stars.
It follows Light or Dark (the phone's, or the choice in aOS) and holds still with
reduced motion. `../home/sky.js` does it for every Vintage design and aOS (loaded in
`<head>`, listed in `sw.js`); this app only gives its disc its colour
(`--sky-disc`) and keeps its own sizes and places for the shapes, tuned to its
header. Checked by `aOS/scripts/sky-test.mjs`.

## What is separate from Mail

It is a second copy of Mail's page and script, not a setting, so the two can
change independently and Mail is never touched.

- **Own storage.** Every key is `mailv.…` (Mail's is `mail.…`), so each app
  has its own sign-in, settings, tags, Tidy and Marketing state, and offline
  cache (`mailvintage-v2`). Signing in to one does not sign in the other.
- **Own sign-in address.** Google's sign-in returns to the page it started
  from, so the OAuth client needs this redirect URI added **once**, next to
  Mail's (Google Cloud console → Credentials → the web client):
  `https://tomallison24-news.pages.dev/mailvintage/` - exactly that, trailing
  slash included. Until it is added, Connect Gmail shows Google's
  `redirect_uri_mismatch`. The client ID is the same as Mail's
  (`BUILT_IN_CLIENT_ID`; it is not a secret).
- **No daily cleanup or notifications.** Mail's scheduled sweep
  (`.github/workflows/mail.yml`) and its push Worker are tied to one Gmail
  refresh token and are not copied. The app still sweeps Marketing whenever it
  is opened, and the unread count on the icon works. Notifications are off
  (`PUSH_URL` is empty); use Mail for those.
- Everything else (the rate-limit handling, Undo, Tidy, the content security
  policy that keeps email from running code) is Mail's, unchanged.

## Tests

`node mailvintage/scripts/security-test.mjs` loads the app against a fake
Gmail and checks the content security policy, attachments, links, framing and
Sign Out (CI: `apps-check.yml`). `node mailvintage/scripts/make-icons.mjs`
redraws the icons from `icon.svg` (a cream envelope on teal, with a mustard sun
and a burnt-orange pill).
