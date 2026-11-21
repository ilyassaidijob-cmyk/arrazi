import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///home/user/arrazi/preview/arrazi-preview.html');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = window.__arrazi;
  const p = s.createPlayer('Nadia', { body: 'girl', hair: 'hair_long', hairShade: 'shade_moon', top: 'cyber_hoodie', bottom: 'bottom_trousers', shoes: 'shoes_boots', face: 'cyber_glasses', background: 'bg_night' });
  s.go({ name: 'player', playerId: p.id, tab: 'stats' });
  s.overlays = [];
  s.pushOverlay({ kind: 'rankUp', playerId: p.id, from: 3, to: 4, coins: 200, items: ['rank_scarf'] });
  s.pushOverlay({ kind: 'notice', playerId: p.id, notice: { id: 'n1', kind: 'season', season: '2026-10', peakLevel: 14, coins: 250, item: 'moon_hunter', from: 14, to: 11, newSeason: '2026-11', active: true } });
  s.pushOverlay({ kind: 'bossBeaten', playerId: p.id, bossId: 'crowking', coins: 300, item: 'boss_crow' });
  s.pushOverlay({ kind: 'notice', playerId: p.id, notice: { id: 'n2', kind: 'bossEscaped', bossId: 'owl', week: '2026-11-09', damage: 410, hp: 600 } });
});
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(i === 0 ? 2800 : 1200);
  await page.screenshot({ path: `${OUT}/card-${i}.png` });
  await page.click('.overlay .actions .btn.primary');
}
console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();
