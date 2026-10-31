# School

Your child's school in one place, as a home-screen web app in the four aOS designs (Vintage, the
default; Standard, in Sea glass; Layers and Tron). Schools that use **ParentSquare** send everything
by email: daily digests that mix the class's news with the whole school's, newsletters, event
reminders, sign-ups, messages from the teacher, receipts and report cards. School reads those emails
and puts them on one page, most urgent first.

## What it shows

One page, top to bottom:

1. **Today** (until school is out, 3:15 pm by default), then **Tomorrow** or the next school day:
   what to wear or bring, events, any days off on the way to it ("No school Fri, Oct 30 · Relief
   Friday"), and pickup: the usual carpool ("Pickup 3:15 pm–3:40 pm, Lane 1") or, on a weekday with a
   club, the club and its pickup time.
2. **Needs you**: sign-ups, RSVPs, forms, surveys and payment requests for her, soonest due first.
   **Mark done** (the circle, with Undo) takes one away. An RSVP you've answered (ParentSquare's
   "You RSVP'd YES" email) leaves by itself; one with no date goes after three weeks, and one whose
   date has passed goes too.
3. **Coming up**: the next two weeks, from the posts' own dates ("Friday, Oct 30", "November 16–20",
   "tomorrow") and the newsletters' date lists. **See the rest of the year** opens the rest.
4. **From the class**: her homeroom's posts, her grade's, her clubs' and messages to you, newest
   first, with **New** on what you haven't opened this week.
5. **Everything else**: the rest (the whole school, other grades), newest first, searchable.
6. **Links**: the school's other sites, found in its emails (Infinite Campus, the lunch menu,
   Beanstack, Clever, the academic calendar, the carpool plan, ParentSquare), report cards and
   progress reports (their subject and date; the document stays in ParentSquare), and **Payments**.

A post opens in a sheet: what it says, its picture, the dates found in it, **Open in ParentSquare**
(to reply, RSVP, sign up or pay), **Open in Gmail**, **Mark done**, and **Move to From the class** /
**Move to Everything else** when School put it in the wrong place.

## Whose a post is

ParentSquare only emails a family the posts of the groups it's in, so `sort.js` works it out from
the post's groups and words (`audience`):

- her **class**: her homeroom's group, her grade's group on its own, a club's group, a message to you;
- her **grade**: posted to several grades including hers, or naming hers ("K–3", "Kindergarten");
- the **school**: the school-wide group, naming no grade;
- **another grade**: posted to other grades only, or naming only others ("4th and 5th grade
  Basketball"). These go to Everything else, never away.

**Settings > Your child** starts from what the emails say (`detect`: the homeroom group, the grade
group that comes on its own, the homeroom's teacher, the school); anything set there wins. Nothing
about a school, a teacher or a child is written in this code (the repository is public).

**Settings > After school**: when school ends and pickup closes, the carpool lane, and a club for
each weekday (its name), with the time clubs end. A club changes that weekday's pickup line.

## Where the data lives

Everything is on the phone, in this app's storage (`allison-school-v1-*`): the posts read from the
emails (about a year, oldest dropped first if the phone runs short of room), which emails were read,
what you marked done, moved or opened, and your settings. **Back up everything** saves it all as a
file; **Import a backup** brings one back.

**Calendar's School layer**: signed in to your family account, School sends Calendar a short list:
days off, events (with their time when the post gave one) and what's due, with no links (ParentSquare's
links carry a sign-in token). It goes to your own account (`AllisonOS.layer.share('school', …)`,
`POST /aOS/api/layer`), only when it changed, and only you can read it.

## Gmail

School reads Gmail **on the phone, read-only** (`gmail.readonly`), as Orders does: `from:parentsquare.com`,
a year back the first time, then anything new each time it opens (at most every 30 minutes), 250
emails a batch. Each email is read once; **Read the last year again** in Settings starts over (what
you marked done or moved stays). Opened inside aOS, Mail's or Orders' Gmail sign-in is used if
there's one.

It signs in with **Mail's own Google client**, so it needs School's address added to that client once:

1. [console.cloud.google.com](https://console.cloud.google.com) → the project Mail uses →
   **APIs & Services → Credentials** → the Mail **Web application** client.
2. **Authorised redirect URIs** → add, exactly (trailing slash included):
   `https://tomallison24-news.pages.dev/school/`
3. **Save**. Google can take a few minutes to pick it up.

## How an email is read

`sort.js` (no page, so it's tested in Node) turns each email into items: a digest into one item a
post ("N. Title / Posted by … on … in … / text / link"), and each of ParentSquare's other emails
(events, RSVP reminders, sign-ups, messages, receipts, report cards, newsletters) into one. It reads
the email's text part, or its HTML when there's none. Then, when the page draws:

- **what it is** (`kindOf`): no school, wear or bring, sign-up or form, survey, payment, event,
  newsletter, club cancelled, or a plain post;
- **its dates** (`parseDates`): "Friday, Oct 30", "October 29th at 6:00 PM", "November 16–20",
  "December 21 - January 1", "10/30/2026", and "tomorrow" or "today" from the day it was posted,
  with the year from when it was sent;
- **days off** (`daysOff`): no-school posts and newsletter lines saying No School, Break, Relief Friday
  or Closed;
- **the next school day** (`focusDay`): a weekday that isn't a day off.

## Working with the other apps

- **Calendar**: the School layer (above).
- **Mail**: every post has **Open in Mail** (its email's thread in Mail) beside **Open in Gmail**.
- **aOS Home**: the morning brief has School's line when the school day is today or tomorrow ("Tomorrow
  at school: Wear Pink on THURSDAY and 2 more"), a day off, and what's due by tomorrow; the Ipsy bar's
  "In your apps" finds School's posts (`aOS/home-find.js`, which loads `sort.js` and asks
  `SchoolSort.child` who the child is, as School does).
- **Notes**: **Remind me in Notes** on a post puts a dated reminder in the family's Notes (the Family
  list), through the Notes Sheet as Orders' return reminder does (`../home/sheet.js`
  `AllisonOS.sheet.notes.addTodos`): the day before it's due or happens (today when that's today or
  tomorrow), once per post. Signed in and with the Notes Sheet set up; otherwise the toast says what's missing.
- **Weather**: the top card has the weather at drop-off and at pickup (or the club's end), from
  Open-Meteo's hourly forecast for Weather's saved place (as Calendar finds it) or this phone's location,
  asked once and kept on the phone. **Settings > After school**: Drop-off, and a switch to turn it off.
- **Ipsy in aOS**: School has no chat of its own (as Weather and Home); its tools run inside it for Ipsy
  in aOS (`ipsy-tools.js`, offered as `AllisonOS.ipsyTools`; `server/ipsy-school.js` describes them):
  the school day, what needs you, what's coming up, finding and reading posts, Mark done (with Undo in
  the chat) and opening a post. Report cards' words and ParentSquare's links (they carry a sign-in
  token) never go to Claude.

## Not in this version

- **Claude** reading what the rules can't: posts the rules can't place, Tiger Times-style newsletters
  summed up, and the dates read out of a teacher's newsletter that is only a picture (through a
  `functions/school/api` route, with what's sent redacted on the phone), and School's own Ipsy chat.
- **Done on both parents' phones**: Mark done is kept on this phone for now; sharing it needs the
  family account (next).
- Notifications.

## Tests

```
node school/scripts/sort-test.mjs      # the reading: digests, kinds, whose, dates, school days, sections, Calendar's layer
node school/scripts/app-test.mjs       # the page at iPhone size: the sections, a post, Mark done and Undo, Remind me, the weather, Ipsy's tools, Settings, both designs
```

Every fixture in `scripts/fixtures.mjs` is made up, shaped like the real emails. Icons:
`node school/scripts/make-icons.mjs` (Vintage and Sea glass), then `node aOS/scripts/make-looks.mjs`
(Layers and Tron).
