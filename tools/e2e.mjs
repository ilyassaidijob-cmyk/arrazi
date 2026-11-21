// Drives the browser preview build through the main flows and saves screenshots.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.argv[2];
const url = 'file:///home/user/arrazi/preview/arrazi-preview.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${n}.png` }); };
await page.goto(url);
await page.waitForTimeout(1500);
await shot('01-home-empty');
await page.click('text=Add player');
await page.waitForTimeout(300);
await page.fill('input[placeholder="e.g. Yassine"]', 'Yassine');
await page.click('button:has-text("Side part")');
await shot('02-new-player');
await page.click('button:has-text("Create player")');
await page.waitForTimeout(600);
await shot('03-projects-empty');
await page.click('button:has-text("Starter path")');
await page.waitForTimeout(600);
await shot('04-project-detail');
// finish a chapter
await page.locator('.chapter .check').first().click();
await page.waitForTimeout(500);
await shot('05-note-card');
await page.fill('textarea', 'The OSI model splits networking into seven layers.');
await page.click('button:has-text("Save note")');
await page.waitForTimeout(400);
// close any reward cards
for (let i = 0; i < 6; i++) {
  const btn = page.locator('.overlay .actions .btn.primary');
  if (await btn.count()) { await shot(`06-reward-${i}`); await btn.first().click(); await page.waitForTimeout(300); } else break;
}
// start a pomodoro
await page.locator('button:has-text("Start Pomodoro")').first().click();
await page.waitForTimeout(800);
await shot('07-focus');
// stats tab
await page.click('button:has-text("Back to Yassine")');
await page.waitForTimeout(300);
await page.click('.tab:has-text("Stats")');
await page.waitForTimeout(800);
await shot('08-stats');
await page.evaluate(() => document.querySelector('#player-screen').scrollTo(0, 700));
await shot('09-stats-lower');
await page.click('.tab:has-text("Side quests")');
await page.fill('input[placeholder="e.g. Install Wireshark"]', 'Install Wireshark');
await page.click('button:has-text("Add")');
await shot('10-quests');
await page.click('.tab:has-text("Achievements")');
await shot('11-achievements');
await page.click('.tab:has-text("Shop")');
await page.waitForTimeout(500);
await shot('12-shop');
await page.click('.seg button:has-text("Wardrobe")');
await page.waitForTimeout(400);
await shot('13-wardrobe');
// force the work session to end: step-end card with the boss fight
await page.evaluate(() => { const s = window.__arrazi; s.app.timer.endsAt = Date.now() - 500; s.tick(); });
await page.waitForTimeout(1200);
await shot('14-step-end');
for (let i = 0; i < 8; i++) {
  const btn = page.locator('.overlay .actions .btn.primary');
  if (!(await btn.count())) break;
  await shot(`14-card-${i}`);
  await btn.first().click();
  await page.waitForTimeout(350);
}
await page.click('.tab:has-text("Stats")');
await page.waitForTimeout(500);
await shot('15-stats-break');
await page.click('.player-head .btn');
await page.waitForTimeout(400);
await shot('16-players');
await page.click('.btn[title="Back"]');
await page.waitForTimeout(600);
await shot('17-home');
await page.click('.home-icon:has-text("Record")');
await page.waitForTimeout(500);
await shot('18-record');
await page.click('.btn[title="Back"]');
await page.click('.home-icon:has-text("Settings")');
await page.waitForTimeout(500);
await shot('19-settings');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
