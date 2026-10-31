// Which of a CI group's tests a pull request needs (.github/workflows/apps-check.yml).
//
// Every test still runs whenever shared code changes (home/, server/, aOS/, functions/ outside an
// app's own folder, the workflows, _headers: anything every app uses). A pull request that changes
// only some apps runs those apps' tests, every test that opens one of them (it names the app's folder,
// as "/notes/" or "notes/"), and the ones that open every app (ALWAYS). One that changes only labs/
// (test pages, not apps) or documentation runs no browser tests at all. A push to the default branch
// (the merge) never gets here: it runs the quick checks only, as the pull request already passed.
//
//   node .github/scripts/ci-select.mjs changed <base sha>     the files the pull request changes, a line each
//   node .github/scripts/ci-select.mjs pick                    of $TESTS (a test a line, as in the workflow),
//                                                              the ones $CHANGED (the lines above) needs
//   node .github/scripts/ci-select.mjs tours                   prints yes if $CHANGED needs the walkthroughs
import { execSync } from 'child_process';
import fs from 'fs';

const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'school', 'money', 'house', 'sparkle'];
// tests that open every app: any app's change needs them
const ALWAYS = ['aOS/scripts/apps-smoke-test.mjs', 'aOS/scripts/standalone-test.mjs', 'aOS/scripts/design-check.mjs'];   // design-check: DESIGN.md, in every app
// changes no browser test can see
const QUIET = [/^labs\//, /\.md$/i, /^LICENSE/, /^\.claude\//, /^docs\//];   // docs/design: DESIGN.md's pictures

// the app a file belongs to, or null for shared code
function appOf(f) {
  const p = f.split('/');
  if (APPS.includes(p[0])) return p[0];
  if (p[0] === 'functions' && APPS.includes(p[1])) return p[1];
  return null;
}
export function plan(changed) {
  const files = changed.map(s => s.trim()).filter(Boolean);
  if (!files.length) return { all: true, apps: new Set() };   // nothing known: run everything
  const apps = new Set();
  let all = false;
  for (const f of files) {
    if (QUIET.some(r => r.test(f))) continue;
    const a = appOf(f);
    if (a) apps.add(a); else all = true;
  }
  return { all, apps };
}
const mentions = (src, app) => new RegExp(`['"/(]${app}/`).test(src) || new RegExp(`['"]${app}['"]`).test(src);
export function pick(tests, changed, read = f => fs.readFileSync(f, 'utf8')) {
  const { all, apps } = plan(changed);
  if (all) return tests;
  if (!apps.size) return [];
  return tests.filter(line => {
    const file = line.split(/\s+/)[0];
    if (ALWAYS.includes(file)) return true;
    if (apps.has(file.split('/')[0])) return true;
    let src = ''; try { src = read(file); } catch { return true; }   // can't tell: run it
    return [...apps].some(a => mentions(src, a));
  });
}
export const needsTours = changed => { const { all, apps } = plan(changed); return all || apps.size > 0; };

const [cmd, arg] = process.argv.slice(2);
const changedEnv = () => String(process.env.CHANGED || '').split('\n');
if (cmd === 'changed') {
  try { process.stdout.write(execSync(`git diff --name-only ${arg}...HEAD`, { encoding: 'utf8' })); }
  catch { process.stdout.write(''); }   // no history to compare: an empty list runs everything
} else if (cmd === 'pick') {
  const tests = String(process.env.TESTS || '').split('\n').map(s => s.trim()).filter(Boolean);
  process.stdout.write(pick(tests, changedEnv()).join('\n'));
} else if (cmd === 'tours') {
  process.stdout.write(needsTours(changedEnv()) ? 'yes' : 'no');
}
