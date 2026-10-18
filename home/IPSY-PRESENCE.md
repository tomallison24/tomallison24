# Ipsy size and motion

The shared chat button is 78 pixels in Orders, Travel, Meals, Notes and News, up from 62. Calendar uses a compact 64-pixel button, up from 50, with responsive toolbar spacing. Notes and Travel have larger slots and extra bottom content space.

Idle movement combines gentle breathing, occasional eye glances, softer floating and less mechanical blinking. The existing listening, thinking, working and talking states remain separate. Only the character moves; the button's hit area stays stationary.

Reduce Motion disables the character animations. When the page becomes hidden, the shared visibility handler pauses CSS animation; returning to the page resumes it.

## Tests

Run `node home/scripts/ipsy-presence-test.mjs` with Playwright 1.56.1 and Chromium installed. It uses each app's real CSS and dock markup, with app scripts removed and the shared helper mounted in isolation. It checks 72 app/width/design/theme combinations, Calendar control clearance, Notes and Travel slot sizing, idle and talking animations, reduced motion, hidden-page pausing and chat character sizing. No AI, mailbox or account data is used.

The existing per-app Ipsy tests exercise real application behavior separately. Tests in Chromium are not a substitute for a visual check on an installed iPhone app.
