// Photos and files in Ipsy's chat, on the server (server/ipsy.js turnKind, attachOk; through Notes' route, which every
// app's shares): a photo (JPEG, PNG, GIF or WebP), a PDF or a text file goes to Claude only as data inside the
// conversation, passed on exactly as sent; an address Anthropic would fetch (a url source), a file kept at Anthropic
// (a file source), any other kind of file, or more than IPSY_MAX_ATTACH of them is refused before Claude is asked
// (bad-file); a conversation with photos may be up to IPSY_MAX_BODY. Plain Node, no network.
//   node home/scripts/ipsy-files-api-test.mjs
import assert from 'assert/strict';
import { onRequest } from '../../functions/notes/api/[[route]].js';
import { ANTHROPIC_URL, IPSY_MAX_BODY, IPSY_MAX_ATTACH, attachOk } from '../../server/ipsy.js';
import { issue, putJSON } from '../../server/auth.js';

const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Sam', role: 'owner', creds: [] });
const token = await issue(db, 'u1');

const asked = [];
const fetcher = async (url, init) => {
  assert.equal(String(url), ANTHROPIC_URL);
  asked.push(init.body);
  return new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Got it.' }] }));
};
const call = async text => {
  const request = new Request('https://site.example/notes/api/ipsy', { method: 'POST', headers: { 'X-Notes': '1', Authorization: 'Bearer ' + token }, body: text });
  const res = await onRequest({ request, params: { route: ['ipsy'] }, env: { ACCOUNTS: db, ANTHROPIC_API_KEY: 'ak' } }, fetcher);
  return { status: res.status, json: await res.json().catch(() => null) };
};
const NOTE = { type: 'text', text: '[From the app: today is Sunday, November 15, 2026 (2026-11-15). The person attached a photo.]' };
const ask = (...blocks) => JSON.stringify({ messages: [{ role: 'user', content: [NOTE, ...blocks, { type: 'text', text: 'Make a shopping list from this' }] }] });
const img = (data = '/9j/4AAQSkZJRg' + 'A'.repeat(40), media_type = 'image/jpeg', type = 'base64') => ({ type: 'image', source: { type, media_type, data } });
const pdf = { type: 'document', title: 'Lasagna.pdf', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQK' } };
const txt = { type: 'document', title: 'list.txt', source: { type: 'text', media_type: 'text/plain', data: 'flour\neggs' } };
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('a photo, a PDF and a text file go to Claude exactly as the phone sent them', async () => {
  const body = ask(img(), pdf, txt), r = await call(body);
  assert.equal(r.status, 200); assert.equal(r.json.content[0].text, 'Got it.');
  const sent = JSON.parse(asked.at(-1));
  assert.deepEqual(sent.messages, JSON.parse(body).messages);
  for (const t of ['image/png', 'image/gif', 'image/webp']) assert.equal((await call(ask(img(undefined, t)))).status, 200, t);
});

await test('a photo or file from an address, or kept at Anthropic, is refused before Claude is asked', async () => {
  const before = asked.length;
  const bad = [
    { type: 'image', source: { type: 'url', url: 'https://evil.example/x.jpg' } },
    { type: 'document', source: { type: 'url', url: 'https://evil.example/x.pdf' } },
    { type: 'image', source: { type: 'file', file_id: 'file_123' } },
    img(undefined, 'image/svg+xml'),
    img(undefined, 'text/html'),
    { type: 'document', source: { type: 'base64', media_type: 'text/html', data: 'PGh0bWw+' } },
    { type: 'document', source: { type: 'text', media_type: 'text/html', data: '<b>x</b>' } },
    { type: 'document', source: { type: 'content', content: [{ type: 'image', source: { type: 'url', url: 'https://evil.example/' } }] } },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } },
    { type: 'image' },
  ];
  for (const b of bad) {
    const r = await call(ask(b));
    assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.json.error, 'bad-file');
  }
  const inResult = JSON.stringify({ messages: [
    { role: 'user', content: [NOTE, { type: 'text', text: 'hi' }] },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'find_notes', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'image', source: { type: 'url', url: 'https://evil.example/' } }] }] },
  ] });
  assert.equal((await call(inResult)).json.error, 'bad-file', 'not inside a tool result either');
  assert.equal(asked.length, before, 'Claude was never asked');
  assert.equal(attachOk(img()), true);
});

await test('at most IPSY_MAX_ATTACH photos and files in a conversation', async () => {
  assert.equal((await call(ask(...Array.from({ length: IPSY_MAX_ATTACH }, () => img())))).status, 200);
  assert.equal((await call(ask(...Array.from({ length: IPSY_MAX_ATTACH + 1 }, () => img())))).json.error, 'bad-file');
});

await test('a conversation with big photos is taken up to IPSY_MAX_BODY, and refused beyond it', async () => {
  assert.ok(IPSY_MAX_BODY >= 4 * 1024 * 1024);
  const big = ask(img('/9j/' + 'A'.repeat(1500 * 1024)), img('/9j/' + 'B'.repeat(1500 * 1024)));
  assert.equal((await call(big)).status, 200);
  const r = await call(ask(img('/9j/' + 'A'.repeat(IPSY_MAX_BODY))));
  assert.equal(r.status, 413); assert.equal(r.json.error, 'too-long');
});

console.log('\n' + n + ' Ipsy files server tests passed');
