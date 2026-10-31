// School's part of Ipsy in aOS (functions/aOS/api/ipsy.js). Not a route: School has no chat of its own,
// only tools that aOS runs inside it (school/ipsy-tools.js, offered as AllisonOS.ipsyTools), on what School
// read from the school's ParentSquare emails on the phone. The same two exports as an app with Ipsy: the
// tools Claude may ask for, and how Ipsy works there.
import { T, persona, DAY } from './ipsy.js';

const ID = { type: 'string', description: 'A post\'s id, from get_needs, get_coming_up, find_posts or get_school_day' };

export const IPSY_CLIENT_TOOLS = [
  T('get_school_day', 'The school day School\'s top card is about (today until school is out, then the next school day), or any date: whether there is school (and why not), what is on (what to wear or bring, events, a club cancelled), days off before it, pickup (the usual carpool or that weekday\'s club), the weather at drop-off and pickup, and who the child is (name, grade, teacher).', {
    date: { ...DAY, description: 'YYYY-MM-DD; leave out for the day School shows' },
  }),
  T('get_needs', 'What needs a parent: sign-ups, RSVPs, forms, surveys and payments for the child, not marked done yet, soonest due first, each with its id and due date.', {}),
  T('get_coming_up', 'School dates between two days (the next two weeks by default): days off, events, what to wear or bring, and the dates from the school newsletters, each with its post\'s id.', {
    from: { ...DAY, description: 'First day (YYYY-MM-DD), default today' },
    to: { ...DAY, description: 'Last day (YYYY-MM-DD), default two weeks after from' },
  }),
  T('find_posts', 'Look through the school\'s posts and messages for a word or name, newest first: each with its id, title, kind, who posted it, when, whose it is (her class, her grade, the whole school, another grade) and a few lines.', {
    query: { type: 'string', description: 'A word or two, e.g. "field trip", "picture day", "Ms. Rivera"' },
    limit: { type: 'integer', minimum: 1, maximum: 25 },
  }, ['query']),
  T('read_post', 'One post in full: its words, its groups, the dates in it, and a newsletter\'s list of dates.', { id: ID }, ['id']),
  T('mark_done', 'Mark an ask (a sign-up, RSVP, form, survey or payment) done, or not done again (done: false), once the person says they did it. The change shows with Undo.', {
    id: ID, done: { type: 'boolean', description: 'false to mark it not done again; default true' },
  }, ['id']),
  T('open_post', 'Open a post in School on the person\'s screen, behind the chat: for replying, RSVPing, signing up or paying, which happen in ParentSquare.', { id: ID }, ['id']),
];

export const IPSY_SYSTEM = persona({
  app: 'School',
  about: 'an iPhone app with the family\'s child\'s school in one place, read from the school\'s ParentSquare emails on the phone: the next school day, what needs a parent, what\'s coming up, and the class\'s posts',
  can: [
    'See the next school day or any day (get_school_day): school or not, what to wear or bring, events, pickup and the weather then.',
    'See what needs a parent (get_needs) and the dates coming up (get_coming_up).',
    'Look through the school\'s posts (find_posts) and read one (read_post).',
    'Mark an ask done or not done (mark_done), and open a post in School (open_post).',
  ],
  rules: [
    'School only knows what the school emailed: say so if something isn\'t there, rather than guessing. Dates and times come from the posts, as they are.',
    'Replying, RSVPing, signing up and paying happen in ParentSquare: open_post shows the post with its button. Never say you did one of them.',
    'Mark something done only when the person says it is done.',
    'A post for another grade isn\'t hers: say whose it is when it matters.',
    'Report cards stay in ParentSquare: School has only their subject and date.',
  ],
  bold: 'a post\'s title',
  privacy: false,
});
