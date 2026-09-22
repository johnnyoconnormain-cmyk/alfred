import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = 'http://localhost:3000';
const OUT = process.env.SHOT_DIR || 'tests/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (n, ok, extra='') => { console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?` — ${extra}`:''}`); if(!ok) fails.push(n); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

// --- crew member -----------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.fill('input[name=email]', 'luis@ridgelinelandscape.com');
  await p.fill('input[name=password]', 'ridgeline2026');
  await p.click('button[type=submit]');
  await p.waitForURL('**/crew', { timeout: 30000 });
  check('crew member lands on the field app', p.url().endsWith('/crew'));

  await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check('crew member is kept out of the office view', p.url().endsWith('/crew'), p.url());
  await p.screenshot({ path: `${OUT}/crew-luis.png`, fullPage: true });
  await ctx.close();
}

// --- signed out ------------------------------------------------------------
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check('signed-out visitor is sent to login', p.url().includes('/login'), p.url());
  await ctx.close();
}

// --- brand-new business ----------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const stamp = Date.now();
  await p.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
  await p.fill('input[name=businessName]', `Cedar Hollow Grounds ${stamp}`);
  await p.fill('input[name=ownerName]', 'Dana Ruiz');
  await p.fill('input[name=city]', 'Mars');
  await p.fill('input[name=state]', 'PA');
  await p.fill('input[name=email]', `dana${stamp}@example.com`);
  await p.fill('input[name=password]', 'hunter2hunter2');
  await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard', { timeout: 30000 });
  check('new business reaches its dashboard', p.url().endsWith('/dashboard'));

  const zeroState = await p.locator('text=Nothing is waiting on you').count();
  check('empty tenant shows a real empty state', zeroState > 0);
  await p.screenshot({ path: `${OUT}/new-tenant-dashboard.png`, fullPage: true });

  // a fresh tenant must have its own rate card and automations ready
  await p.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  const rateRows = await p.locator('input[name=label]').count();
  check('new business starts with a rate card', rateRows >= 5, `${rateRows} services`);

  await p.goto(`${BASE}/automations`, { waitUntil: 'networkidle' });
  const running = await p.locator('.badge', { hasText: 'Running' }).count();
  check('new business starts with automations on', running >= 4, `${running} running`);

  // tenant isolation: the new owner must not see Ridgeline's customers
  await p.goto(`${BASE}/customers`, { waitUntil: 'networkidle' });
  const leaked = await p.locator('text=Sarah Miller').count();
  check('tenant data is isolated', leaked === 0);
  await ctx.close();
}

console.log(fails.length ? `\n${fails.length} FAILURES:\n  ${fails.join('\n  ')}` : '\nAll checks passed.');
await browser.close();
process.exit(fails.length ? 1 : 0);
