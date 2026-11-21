// Launches the real Electron app (under xvfb), drives a short flow and checks the saved files.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const { _electron } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.argv[2];
const userData = fs.mkdtempSync('/tmp/claude-0/-home-user/1fd5bcc5-1694-5d31-9902-b00b09774146/scratchpad/ud-');
const app = await _electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['dist/main.js', '--no-sandbox', `--user-data-dir=${userData}`],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});
const logs = [];
app.process().stdout.on('data', (d) => logs.push(String(d)));
app.process().stderr.on('data', (d) => logs.push(String(d)));
const win = await app.firstWindow();
win.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await win.waitForTimeout(2500);
const bridge = await win.evaluate(() => ({ hasBridge: !!window.arrazi, platform: window.arrazi?.platform, version: window.arrazi?.version }));
console.log('bridge', JSON.stringify(bridge));
await win.screenshot({ path: `${OUT}/e1-home.png` });
await win.click('text=Add player');
await win.fill('input[placeholder="e.g. Yassine"]', 'Salma');
await win.click('.seg button:has-text("Girl")');
await win.click('button:has-text("Create player")');
await win.waitForTimeout(500);
await win.click('button:has-text("Starter path")');
await win.waitForTimeout(500);
await win.locator('button:has-text("Start Pomodoro")').first().click();
await win.waitForTimeout(1200);
await win.screenshot({ path: `${OUT}/e2-focus.png` });
// mini timer window
await win.click('.focus-top .toggle');
await win.waitForTimeout(1500);
const windows = app.windows();
console.log('windows open:', windows.length, windows.map((w) => w.url().split('/').pop()).join(', '));
const miniWin = windows.find((w) => w.url().endsWith('mini.html'));
if (miniWin) await miniWin.screenshot({ path: `${OUT}/e3-mini.png` });
await win.waitForTimeout(800);
const files = fs.readdirSync(path.join(userData, 'data', 'players'));
const appJson = JSON.parse(fs.readFileSync(path.join(userData, 'data', 'app.json'), 'utf8'));
console.log('player files:', files.join(', '));
console.log('timer saved:', !!appJson.timer, appJson.timer?.status, appJson.timer?.target?.label);
const p = JSON.parse(fs.readFileSync(path.join(userData, 'data', 'players', files.find((f) => f.endsWith('.json'))), 'utf8'));
console.log('player:', p.name, p.look.body, 'projects', p.projects.length, 'chapter state', p.projects[0].missions[0].chapters[0].state);
await app.close();
console.log(logs.filter((l) => !/Fontconfig|dbus|DevTools|gpu|GPU|libva|vaapi|ALSA|Gtk|xdg/i.test(l)).join('').slice(0, 2000) || 'no errors logged');
