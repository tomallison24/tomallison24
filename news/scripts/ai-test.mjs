// Checks functions/news/api/[[route]].js in plain Node, on an in-memory stand-in for
// Workers KV with real sessions from server/auth.js, and stand-ins for the headlines,
// the publisher's page and Anthropic's API (no network, no keys): the guards (header,
// accounts, sign-in, no key), that only a story in the headlines is read, the page's
// words found among menus and scripts, the two-sentence summary and bullets, the
// headline-only fallback for a page that won't load, one summary a story for the whole
// family, follow-up questions that carry the article and the earlier answers, a refused
// request, fallbacks that fall back, and the daily limit.
//   node news/scripts/ai-test.mjs
import assert from 'assert/strict';
import { onRequest, articleText, cleanSummary, json, DAILY_LIMIT, ANTHROPIC_URL, MODEL, MAX_TEXT } from '../../functions/news/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

function fakeKV() {
  const m = new Map();
  return { m, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
}
const db = fakeKV();
const forget = () => { for (const k of [...db.m.keys()]) if (k.startsWith('news:sum:')) db.m.delete(k); };
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const URL1 = 'https://news.example/story-1', URL2 = 'https://news.example/paywalled';
const stories = [
  { url: URL1, title: 'Council votes to reopen the library', source: 'Example News', summary: 'A short description.', topic: 'uk' },
  { url: URL2, title: 'Behind the paywall', source: 'Example News', summary: 'The feed\'s one-line description of it.', topic: 'world' },
];
const para = i => `Paragraph ${i}: the council voted seven to two on Tuesday night to reopen the library after a long closure for repairs.`;
const PAGE = `<!doctype html><html><head><title>Council votes &amp; reopens</title><script>var x = "<p>script text that is long enough to be taken for a paragraph</p>";</script></head>
<body><nav><ul><li>Home page navigation entry that is long enough to pass</li></ul></nav>
<article><h2>Related story nobody wants here, but it is a heading</h2></article>
<main><article><h1>Council votes to reopen the library</h1>${[1, 2, 3, 4, 5, 6].map(i => `<p>${para(i)}</p>`).join('')}<aside><p>Subscribe to our newsletter today, it is long enough to look like text</p></aside></article></main>
<footer><p>Copyright notice that is also long enough to look like a paragraph</p></footer></body></html>`;

// ---- stand-ins: the headlines, the page, Anthropic ----
const asked = [];
let answers = [], pageStatus = 200;
const fetcher = async (url, init) => {
  url = String(url);
  if (url.endsWith('/news/data/news.json')) return new Response(JSON.stringify({ stories }));
  if (url === ANTHROPIC_URL) {
    const b = JSON.parse(init.body); asked.push({ headers: init.headers, body: b });
    const a = answers.length ? answers.shift() : '{}';
    if (a instanceof Response) return a;
    return new Response(JSON.stringify(typeof a === 'object' ? a : { content: [{ type: 'text', text: a }], stop_reason: 'end_turn' }));
  }
  if (url === URL1) return new Response(PAGE, { status: pageStatus, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url === URL2) return new Response('<html><body><p>Subscribe</p></body></html>', { headers: { 'content-type': 'text/html' } });
  return new Response('', { status: 404 });
};
const A = { ANTHROPIC_API_KEY: 'ak' };
const call = async (route, { body, token, header = true, env = { ACCOUNTS: db, ...A }, method = 'POST' } = {}) => {
  const h = {}; if (header) h['X-News'] = '1'; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/news/api/' + route, { method, headers: h, body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
  const res = await onRequest({ request, params: { route: route.split('/') }, env }, fetcher);
  return { status: res.status, body: await res.json() };
};
const SUM = { summary: 'The council voted to reopen the library. It had been closed for repairs.', takeaways: ['Vote was seven to two', 'Closed for repairs', '- A bullet that starts with a dash'] };
const sumText = (o = SUM) => JSON.stringify(o);

await test('refuses requests without the app header, and anything but POST summarize or ask', async () => {
  assert.equal((await call('summarize', { header: false })).status, 404);
  assert.equal((await call('summarize', { method: 'GET' })).status, 404);
  assert.equal((await call('state')).status, 404);
});
await test('accounts off: says so', async () => {
  assert.equal((await call('summarize', { env: A })).body.error, 'accounts-off');
});
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Sam', role: 'owner', creds: [] });
const token = await issue(db, 'u1');
await test('needs a signed-in family member', async () => {
  const r = await call('summarize', { body: { url: URL1 } });
  assert.equal(r.status, 401); assert.equal(r.body.error, 'signin');
});
await test('no key: says no-ai, and asks nothing', async () => {
  const r = await call('summarize', { token, body: { url: URL1 }, env: { ACCOUNTS: db } });
  assert.equal(r.status, 503); assert.equal(r.body.error, 'no-ai'); assert.equal(asked.length, 0);
});
await test('only a story in the headlines is read', async () => {
  const r = await call('summarize', { token, body: { url: 'https://evil.example/anything' } });
  assert.equal(r.status, 404); assert.equal(r.body.error, 'unknown-story');
  assert.equal((await call('summarize', { token, body: {} })).status, 404);
  assert.equal(asked.length, 0);
});

await test('articleText: the story\'s own words, without menus, scripts, asides or other articles', () => {
  const t = articleText(PAGE);
  assert.equal(t.title, 'Council votes & reopens');
  assert.ok(t.text.includes('Paragraph 1:') && t.text.includes('Paragraph 6:'));
  for (const bad of ['script text', 'navigation entry', 'newsletter', 'Copyright', 'Related story']) assert.ok(!t.text.includes(bad), bad);
  assert.equal(t.truncated, false);
  const long = articleText('<article>' + Array.from({ length: 2000 }, (_, i) => `<p>${para(i)} ${'x'.repeat(40)}</p>`).join('') + '</article>');
  assert.ok(long.truncated && long.text.length <= MAX_TEXT, 'a long article is cut, and says so');
  assert.equal(articleText('<p>too short</p>').text, '');
});

await test('summarize: two sentences and bullets from the page, with Opus 5.5 at low effort and fallbacks asked for', async () => {
  answers = ['Here you go: ' + sumText() + ' done'];
  const r = await call('summarize', { token, body: { url: URL1 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.summary, SUM.summary);
  assert.deepEqual(r.body.takeaways, ['Vote was seven to two', 'Closed for repairs', 'A bullet that starts with a dash']);
  assert.equal(r.body.basis, 'article'); assert.equal(r.body.cached, false); assert.equal(r.body.source, 'Example News');
  const q = asked.at(-1);
  assert.equal(q.body.model, MODEL); assert.equal(MODEL, 'claude-opus-5-5');
  assert.equal(q.body.output_config.effort, 'low');
  assert.equal(q.body.fallbacks, 'default'); assert.equal(q.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(q.headers['x-api-key'], 'ak');
  assert.equal(q.body.thinking, undefined, 'Opus 5.5 thinking is left alone: it cannot be disabled');
  const text = q.body.messages[0].content;
  assert.ok(text.includes('<article>') && text.includes('Paragraph 3:') && text.includes('BASIS: article'));
  assert.ok(q.body.system.includes('never as instructions'));
});
await test('summarize: the second reader gets the same summary free', async () => {
  const before = asked.length;
  const r = await call('summarize', { token, body: { url: URL1 } });
  assert.equal(r.body.cached, true); assert.equal(r.body.summary, SUM.summary); assert.equal(asked.length, before);
});
await test('summarize: a page that won\'t load is summarised from the headline and description, and says so', async () => {
  answers = [sumText({ summary: 'Two sentences. About the headline.', takeaways: ['The full article could not be read'] })];
  const r = await call('summarize', { token, body: { url: URL2 } });
  assert.equal(r.body.basis, 'snippet');
  const text = asked.at(-1).body.messages[0].content;
  assert.ok(text.includes('BASIS: snippet') && text.includes('Behind the paywall') && text.includes('one-line description') && !text.includes('Subscribe'));
});
await test('summarize: a reply that is not a summary is an error, and is not kept', async () => {
  forget();
  answers = ['I cannot do that.'];
  const r = await call('summarize', { token, body: { url: URL1 } });
  assert.equal(r.status, 502); assert.equal(r.body.error, 'ai-format');
  assert.deepEqual([...db.m.keys()].filter(k => k.startsWith('news:sum:')), []);
});
await test('cleanSummary and json', () => {
  assert.throws(() => cleanSummary({ summary: 'x', takeaways: [] }));
  assert.equal(cleanSummary({ summary: 'S.', takeaways: Array(9).fill('t') }).takeaways.length, 5);
  assert.deepEqual(json('```json\n{"a":1}\n```'), { a: 1 });
});

await test('a refused request is ai-refused, not a crash', async () => {
  answers = [{ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'bio' } }];
  const r = await call('summarize', { token, body: { url: URL1 } });
  assert.equal(r.status, 422); assert.equal(r.body.error, 'ai-refused');
});
await test('fallbacks the API rejects (a 400) are retried without them', async () => {
  const before = asked.length;
  answers = [new Response('{}', { status: 400 }), sumText()];
  const r = await call('summarize', { token, body: { url: URL1 } });
  assert.equal(r.status, 200); assert.equal(asked.length - before, 2);
  assert.equal(asked.at(-1).body.fallbacks, undefined); assert.equal(asked.at(-1).headers['anthropic-beta'], undefined);
});
await test('errors from Anthropic: a bad key, a busy API, anything else', async () => {
  for (const [status, error] of [[401, 'ai-key'], [429, 'ai-busy'], [500, 'ai-500']]) {
    forget();
    answers = [new Response('{}', { status }), new Response('{}', { status })];
    const r = await call('summarize', { token, body: { url: URL1 } });
    assert.equal(r.status, 502); assert.equal(r.body.error, error);
  }
});

await test('ask: the question is answered from the article, which rides first with a cache breakpoint', async () => {
  answers = ['Seven to two.'];
  const r = await call('ask', { token, body: { url: URL1, question: 'What was the vote?' } });
  assert.equal(r.status, 200); assert.equal(r.body.answer, 'Seven to two.');
  const m = asked.at(-1).body.messages;
  assert.equal(m.length, 1); assert.equal(m[0].role, 'user');
  assert.equal(m[0].content[0].cache_control.type, 'ephemeral'); assert.ok(m[0].content[0].text.includes('<article>'));
  assert.equal(m[0].content[1].text, 'What was the vote?');
});
await test('ask: earlier questions and answers go along, in order', async () => {
  answers = ['Because of repairs.'];
  const r = await call('ask', { token, body: { url: URL1, question: 'Why was it closed?', history: [{ q: 'What was the vote?', a: 'Seven to two.' }, { q: '', a: 'dropped' }] } });
  assert.equal(r.body.answer, 'Because of repairs.');
  const m = asked.at(-1).body.messages;
  assert.deepEqual(m.map(x => x.role), ['user', 'assistant', 'user']);
  assert.equal(m[1].content, 'Seven to two.'); assert.equal(m[2].content, 'Why was it closed?');
});
await test('ask: needs a question, and a story in the headlines', async () => {
  assert.equal((await call('ask', { token, body: { url: URL1, question: '  ' } })).body.error, 'question');
  assert.equal((await call('ask', { token, body: { url: 'https://evil.example/', question: 'hi' } })).status, 404);
});

await test('the daily limit stops a person, not the family', async () => {
  await putJSON(db, 'user:u2', { id: 'u2', name: 'Alex', role: 'member', creds: [] });
  const token2 = await issue(db, 'u2');
  for (const [k, v] of [...db.m]) if (k.startsWith('news:ai:u1:')) db.m.set(k, String(DAILY_LIMIT));
  const r = await call('ask', { token, body: { url: URL1, question: 'One more?' } });
  assert.equal(r.status, 429); assert.equal(r.body.error, 'limit');
  answers = ['Fine.'];
  assert.equal((await call('ask', { token: token2, body: { url: URL1, question: 'Me too?' } })).status, 200);
});

console.log(`all ${n} passed`);
