/**
 * Cold-start behaviour, which is the whole question on a serverless host.
 *
 * Run in two phases around a real server restart:
 *   node tests/restart.e2e.mjs before   # sign in, make a change, save the session
 *   <restart the server>
 *   node tests/restart.e2e.mjs after    # is the session still valid? is the change still there?
 *
 * In `ephemeral` mode the change is expected to be gone but the session must
 * survive; in `blob` mode both must survive.
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const STATE = 'tests/.restart-state.json';
const MARK = 'tests/.restart-mark.txt';
const MODE = process.env.GROUNDWORK_PERSISTENCE || 'disk';
const phase = process.argv[2];

const failures = [];
const check = (n, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures.push(n);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

if (phase === 'before') {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  // An empty blob store has no demo company in it yet; seed it the way a real
  // first-time visitor would.
  if (await page.locator('button:has-text("Open the demo company")').count()) {
    await page.click('button:has-text("Open the demo company")');
  } else {
    await page.fill('input[name=email]', 'mike@ridgelinelandscape.com');
    await page.fill('input[name=password]', 'ridgeline2026');
    await page.click('button[type=submit]');
  }
  await page.waitForURL('**/dashboard', { timeout: 40000 });
  check('signed in before restart', true);

  const name = `Restart Probe ${Date.now()}`;
  await page.goto(`${BASE}/customers/new`, { waitUntil: 'networkidle' });
  await page.fill('input[name=name]', name);
  await page.fill('input[name=phone]', '(724) 555-0777');
  // Scoped by label: the app shell has its own submit button (Sign out).
  await page.click('button:has-text("Add customer")');
  await page.waitForURL(/\/customers\/cus_/, { timeout: 30000 });
  check('created a customer before restart', true, name);

  fs.writeFileSync(MARK, name);
  await ctx.storageState({ path: STATE });
} else {
  const name = fs.readFileSync(MARK, 'utf8');
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();

  const res = await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const stillIn = page.url().endsWith('/dashboard') && res.status() < 400;
  check('session survives the restart', stillIn, page.url());

  await page.goto(`${BASE}/customers?q=${encodeURIComponent('Restart Probe')}`, {
    waitUntil: 'networkidle',
  });
  const found = (await page.getByText(name).count()) > 0;

  if (MODE === 'ephemeral') {
    check('ephemeral mode forgets the change, as advertised', !found);
    const banner = await page.locator('text=Preview deployment').count();
    check('preview banner is shown', banner > 0);
  } else {
    check('the change survives the restart', found, name);
  }
}

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILURES` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
