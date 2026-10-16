// Travel remembers which emails it has read (the "seen" list) and never reads one twice, so when the reader (parse.js) or the
// search (the senders and subjects in app.js) improves, the phones only benefit if QUERY_V is bumped: the next scan then reads the
// last year again once and rebuilds what the old reader made of it. This test fails when parse.js or the search changes and
// QUERY_V does not, so that cannot be forgotten again (Hilton's emails were read by an old reader, marked seen, and never read again).
//
// When it fails: bump QUERY_V in travel/app.js, then update travel/scripts/reader-version.json
// (`node travel/scripts/reader-version-test.mjs --update` prints the new values).
import fs from 'fs';
import crypto from 'crypto';
import assert from 'assert/strict';

const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const search = app => { const i = app.indexOf('const SENDERS = ['), j = app.indexOf('const QUERY = ', i); return app.slice(i, app.indexOf('\n', j)); };
const queryV = app => (/const QUERY_V = '([^']+)'/.exec(app) || [])[1];

const now = { parse: sha(read('travel/parse.js')), search: sha(search(read('travel/app.js'))), queryV: queryV(read('travel/app.js')) };
if (process.argv.includes('--update')) { console.log(JSON.stringify({ queryV: now.queryV, parse: now.parse, search: now.search }, null, 2)); process.exit(0); }
const rec = JSON.parse(read('travel/scripts/reader-version.json'));
const how = ' - bump QUERY_V in travel/app.js, then update travel/scripts/reader-version.json (--update prints it)';
assert.equal(now.parse, rec.parse, 'parse.js changed' + how);
assert.equal(now.search, rec.search, 'the senders or subjects Travel searches for changed' + how);
assert.equal(now.queryV, rec.queryV, 'QUERY_V is not the one recorded in reader-version.json (update the file after bumping it)');
console.log('ok - the reader and the search are at version ' + now.queryV);
