import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = process.env.SHOT_DIR || 'tests/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('·', ...a);
const fails = [];
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) fails.push(name);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => fails.push(`pageerror: ${e.message}`));

// ---------------------------------------------------------------- 1. intake
log('customer submits the intake form');
await page.goto(`${BASE}/book/ridgeline`, { waitUntil: 'networkidle' });
const stamp = Date.now();
// A distinct phone per run: the intake form matches existing customers by phone
// on purpose, so reusing one number would (correctly) reuse that customer.
const phone = `(724) 999-${String(stamp).slice(-4)}`;
await page.fill('input[name=name]', `E2E Tester ${stamp}`);
await page.fill('input[name=phone]', phone);
await page.fill('input[name=address]', '77 End To End Ln');
await page.fill('input[name=city]', 'Wexford');
await page.fill('input[name=zip]', '15090');
await page.fill('textarea[name=description]',
  'Backyard is completely overgrown after two years, about 3000 sq ft. Need it cleaned up, all the brush hauled away, and fresh mulch in the beds along the fence.');
await page.click('button[type=submit]');
await page.waitForURL('**/book/ridgeline/thanks**', { timeout: 20000 });
const range = await page.textContent('.figure-hero');
check('intake returns an estimate range', /\$\d/.test(range ?? ''), range?.trim());
await page.screenshot({ path: `${OUT}/public-thanks.png`, fullPage: true });

// ------------------------------------------------------------------ 2. login
log('owner signs in');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[name=email]', 'mike@ridgelinelandscape.com');
await page.fill('input[name=password]', 'ridgeline2026');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 30000 });
check('owner reaches the command center', page.url().endsWith('/dashboard'));

// ------------------------------------------------------- 3. lead in the inbox
log('lead arrives in the inbox');
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
const leadVisible = await page.getByText(`E2E Tester ${stamp}`).first().isVisible();
check('new lead shows in the inbox', leadVisible);

// --------------------------------------------------------------- 4. build quote
log('owner builds a quote from the lead');
await page.getByText(`E2E Tester ${stamp}`).first().click();
await page.waitForURL('**/leads/**', { timeout: 20000 });
await page.click('a:has-text("Build quote")');
await page.waitForURL('**/quotes/new**', { timeout: 20000 });
const lineCount = await page.locator('input[name=itemDescription]').count();
check('quote is pre-filled from the rate card', lineCount >= 2, `${lineCount} lines`);
await page.screenshot({ path: `${OUT}/quote-builder.png`, fullPage: true });

await page.click('button:has-text("Save and send")');
await page.waitForURL(/\/quotes\/qte_/, { timeout: 25000 });
const quoteUrl = page.url();
check('quote saved and sent', /\/quotes\/qte_/.test(quoteUrl));
const sentBadge = await page.locator('.badge').filter({ hasText: /sent|viewed/i }).count();
check('quote status is sent', sentBadge > 0);

// pull the public link off the page
const publicLink = await page.inputValue('input[readonly]');
check('quote has a customer link', publicLink.includes('/q/'), publicLink);
await page.screenshot({ path: `${OUT}/quote-detail.png`, fullPage: true });

// follow-ups queued?
const queued = await page.locator('text=Queued follow-ups').count();
check('follow-up sequence queued on send', queued > 0);

// ------------------------------------------------- 5. customer accepts + books
log('customer opens the quote and accepts');
const cust = await ctx.newPage();
await cust.goto(publicLink.replace('http://localhost:3000', BASE), { waitUntil: 'networkidle' });
await cust.screenshot({ path: `${OUT}/public-quote.png`, fullPage: true });
await cust.click('button:has-text("Accept quote")');
await cust.waitForURL('**/schedule**', { timeout: 25000 });
const slots = await cust.locator('button.btn-secondary.tap').count();
check('availability offered after acceptance', slots > 0, `${slots} slots`);
await cust.screenshot({ path: `${OUT}/public-schedule.png`, fullPage: true });

await cust.locator('button.btn-secondary.tap').first().click();
await cust.waitForURL('**/schedule?booked=**', { timeout: 25000 });
const booked = await cust.locator('.h-display').textContent();
check('customer booked a time', Boolean(booked), booked?.trim());

// ---------------------------------------------- 6. job exists and is scheduled
log('job appears on the schedule');
await page.goto(`${BASE}/jobs?status=active`, { waitUntil: 'networkidle' });
const jobRow = page.locator('tr', { hasText: `E2E Tester ${stamp}` }).first();
check('job created from the accepted quote', await jobRow.isVisible());
await jobRow.locator('a').first().click();
await page.waitForURL(/\/jobs\/job_/, { timeout: 20000 });
const jobUrl = page.url();
await page.screenshot({ path: `${OUT}/job-detail.png`, fullPage: true });

// ------------------------------------------------- 7. run the job to complete
log('crew works the job');
await page.click('button:has-text("Start this job")');
await page.waitForTimeout(1500);
// tick the whole checklist
for (let i = 0; i < 6; i++) {
  const box = page.locator('form button.tap').nth(i);
  if (await box.count()) { await box.click(); await page.waitForTimeout(350); }
}
await page.goto(jobUrl, { waitUntil: 'networkidle' });
await page.click('button:has-text("Mark complete")');
await page.waitForTimeout(2000);
await page.goto(jobUrl, { waitUntil: 'networkidle' });
const invoiceCard = await page.locator('a:has-text("Open invoice")').count();
check('completing the job raised an invoice', invoiceCard > 0);

// ---------------------------------------------------------------- 8. payment
log('invoice is payable');
await page.goto(`${BASE}/payments?status=outstanding`, { waitUntil: 'networkidle' });
const invRow = page.locator('tr', { hasText: `E2E Tester ${stamp}` }).first();
check('invoice is outstanding', await invRow.isVisible());
await invRow.locator('a').first().click();
await page.waitForURL(/\/payments\/inv_/, { timeout: 20000 });
await page.screenshot({ path: `${OUT}/invoice.png`, fullPage: true });

const payLink = await page.locator('input[readonly]').last().inputValue();
const payPage = await ctx.newPage();
await payPage.goto(payLink.replace('http://localhost:3000', BASE), { waitUntil: 'networkidle' });
check('customer payment page renders', (await payPage.locator('text=Amount due').count()) > 0);
await payPage.screenshot({ path: `${OUT}/public-pay.png`, fullPage: true });

log('owner records the payment');
await page.click('button:has-text("Record payment")');
await page.waitForTimeout(2000);
const paidBadge = await page.locator('.badge', { hasText: 'paid' }).count();
check('invoice settles when payment recorded', paidBadge > 0);

await page.goto(jobUrl, { waitUntil: 'networkidle' });
const jobPaid = await page.locator('.badge', { hasText: 'paid' }).count();
check('job moves to paid', jobPaid > 0);

// ----------------------------------------------------------------- 9. review
log('customer leaves a review');
const reviewLink = await page.locator('input[readonly]').first().inputValue();
const rev = await ctx.newPage();
await rev.goto(reviewLink.replace('http://localhost:3000', BASE), { waitUntil: 'networkidle' });
await rev.locator('button[aria-label="5 stars"]').click();
await rev.fill('textarea[name=comment]', 'Crew showed up on time and the yard looks great.');
await rev.click('button[type=submit]');
await rev.waitForURL('**/review/**done=5**', { timeout: 20000 });
check('review recorded and routed', (await rev.locator('text=Leave a Google review').count()) > 0);
await rev.screenshot({ path: `${OUT}/public-review.png`, fullPage: true });

// ------------------------------------------------------------ 10. every page
log('sweeping every page for errors');
const routes = ['/dashboard','/leads','/quotes','/schedule','/jobs','/customers','/payments','/analytics','/automations','/reviews','/settings','/crew'];
for (const route of routes) {
  const res = await page.goto(BASE + route, { waitUntil: 'networkidle' });
  const ok = res && res.status() < 400;
  const hasError = (await page.locator('text=Application error').count()) > 0;
  check(`page ${route}`, Boolean(ok) && !hasError, `HTTP ${res?.status()}`);
}

console.log(fails.length ? `\n${fails.length} FAILURES:\n  ${fails.join('\n  ')}` : '\nAll checks passed.');
await browser.close();
process.exit(fails.length ? 1 : 0);
