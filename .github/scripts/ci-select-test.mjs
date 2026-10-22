// The test picker (.github/scripts/ci-select.mjs): which browser tests a pull request needs.
//   node .github/scripts/ci-select-test.mjs
import path from 'path';
const { pick, needsTours } = await import(path.resolve(new URL('.', import.meta.url).pathname, 'ci-select.mjs'));
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const SRC = {
  'notes/scripts/app-test.mjs': '', 'orders/scripts/app-test.mjs': '',
  'aOS/scripts/apps-smoke-test.mjs': '', 'aOS/scripts/release-test.mjs': '',
  'home/scripts/ipsy-private-test.mjs': "await page.goto(BASE + '/orders/'); await page.goto(BASE + '/travel/')",
  'travel/scripts/smart-test.mjs': '',
};
const tests = ['notes/scripts/app-test.mjs', 'orders/scripts/app-test.mjs', 'aOS/scripts/apps-smoke-test.mjs', 'aOS/scripts/release-test.mjs', 'home/scripts/ipsy-private-test.mjs', 'travel/scripts/smart-test.mjs travelvintage'];
const read = f => { if (!(f in SRC)) throw new Error('none'); return SRC[f]; };
const run = changed => pick(tests, changed, read);

check(run(['home/welcome.js']).length === tests.length, 'shared code (home/): every test');
check(run(['functions/aOS/api/[[route]].js', 'aOS/app.js']).length === tests.length, 'aOS and its server: every test');
check(run(['.github/workflows/apps-check.yml']).length === tests.length, 'the workflow itself: every test');
check(run([]).length === tests.length, 'nothing known changed: every test');
check(run(['notes/app.js']).join() === 'notes/scripts/app-test.mjs,aOS/scripts/apps-smoke-test.mjs', 'Notes only: its own tests, and the one that opens every app');
check(run(['orders/app.js', 'functions/orders/api/[[route]].js']).join() === 'orders/scripts/app-test.mjs,aOS/scripts/apps-smoke-test.mjs,home/scripts/ipsy-private-test.mjs', 'Orders and its server: its tests, and every test that opens Orders');
check(run(['travel/parse.js']).includes('travel/scripts/smart-test.mjs travelvintage'), 'a test with arguments is kept whole');
check(run(['labs/home/index.html', 'README.md']).length === 0 && !needsTours(['labs/home/index.html']), 'labs/ and documentation only: no browser tests, no walkthroughs');
check(needsTours(['weather/app.js']) && needsTours(['home/design.js']), 'an app or shared code: the walkthroughs run');
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
