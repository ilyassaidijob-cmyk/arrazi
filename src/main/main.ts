// Arrazi main process: windows, storage, Windows toast notifications with action buttons,
// pop-up to the front, tray icon, mini timer, start with Windows and sleep/wake handling.
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  shell,
  Tray,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Storage } from './storage';

const APP_ID = 'com.arrazi.app';
const PROTOCOL = 'arrazi';
const isWin = process.platform === 'win32';
const assets = path.join(__dirname, 'assets');

let main: BrowserWindow | null = null;
let mini: BrowserWindow | null = null;
let tray: Tray | null = null;
let storage: Storage;
let quitting = false;
let flushed = false;
let rendererReady = false;
let minimizeToTray = false;
let lastTimer: { step: string; label: string; remaining: string; status: string } | null = null;
const pendingCommands: string[] = [];
const liveNotifications = new Set<Notification>();

// ---------------------------------------------------------------- single instance & protocol

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const url = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (url) handleUrl(url);
    else popUp();
  });
}

function exePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function registerProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      // while the app runs, toast buttons reopen this exact executable
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, []);
    }
  } catch {
    /* not fatal: notification buttons fall back to opening the app */
  }
}

/** Windows only shows toasts for apps with a Start menu shortcut that carries their AppUserModelID. */
function ensureStartMenuShortcut() {
  if (!isWin || process.defaultApp) return;
  try {
    const dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const lnk = path.join(dir, 'Arrazi.lnk');
    const target = exePath();
    let current: Electron.ShortcutDetails | null = null;
    try {
      current = shell.readShortcutLink(lnk);
    } catch {
      current = null;
    }
    if (current && current.target === target && current.appUserModelId === APP_ID) return;
    fs.mkdirSync(dir, { recursive: true });
    shell.writeShortcutLink(lnk, current ? 'replace' : 'create', {
      target,
      appUserModelId: APP_ID,
      description: 'Arrazi: learn new skills, played like a game',
      icon: target,
      iconIndex: 0,
    });
  } catch {
    /* toasts may not show; the pop-up still works */
  }
}

function handleUrl(url: string) {
  let cmd = '';
  try {
    const u = new URL(url);
    const route = `${u.hostname}${u.pathname}`.replace(/\/+$/, '');
    cmd =
      {
        'timer/start': 'timer:start',
        'timer/skip': 'timer:skip',
        'timer/extend': 'timer:extend',
        'timer/pause': 'timer:pause',
        'timer/resume': 'timer:resume',
        open: 'open-focus',
      }[route] ?? '';
  } catch {
    cmd = '';
  }
  popUp();
  if (cmd) sendCommand(cmd);
}

function sendCommand(cmd: string) {
  if (main && rendererReady) main.webContents.send('command', cmd);
  else pendingCommands.push(cmd);
}

// ---------------------------------------------------------------- windows

function createMain(hidden: boolean) {
  main = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: 'Arrazi',
    backgroundColor: '#0b0b0b',
    icon: path.join(assets, isWin ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    ...(isWin
      ? { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#0b0b0b', symbolColor: '#a8a8a8', height: 34 } }
      : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  main.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  main.once('ready-to-show', () => {
    if (!hidden) main?.show();
  });
  main.on('minimize', () => {
    if (minimizeToTray) {
      ensureTray();
      main?.hide();
    }
  });
  main.on('close', (e) => {
    if (!quitting && minimizeToTray) {
      e.preventDefault();
      ensureTray();
      main?.hide();
    }
  });
  main.on('closed', () => {
    main = null;
    rendererReady = false;
  });
  main.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  main.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      openExternal(url);
    }
  });
}

function popUp() {
  if (!main) createMain(false);
  const w = main!;
  if (w.isMinimized()) w.restore();
  if (!w.isVisible()) w.show();
  w.setAlwaysOnTop(true, 'screen-saver');
  w.focus();
  w.moveTop();
  if (isWin) w.flashFrame(true);
  setTimeout(() => {
    if (!main) return;
    main.setAlwaysOnTop(false);
    if (isWin) main.flashFrame(false);
  }, 2500);
}

function showMini(show: boolean) {
  if (!show) {
    mini?.close();
    return;
  }
  if (mini) return;
  const area = screen.getPrimaryDisplay().workArea;
  const W = 270;
  const H = 124;
  mini = new BrowserWindow({
    width: W,
    height: H,
    x: area.x + area.width - W - 16,
    y: area.y + area.height - H - 16,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0b0b0b',
    title: 'Arrazi timer',
    icon: path.join(assets, isWin ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mini.setAlwaysOnTop(true, 'floating');
  mini.loadFile(path.join(__dirname, 'renderer', 'mini.html'));
  mini.once('ready-to-show', () => {
    mini?.showInactive();
    mini?.webContents.send('mini:state', lastTimer);
  });
  mini.on('closed', () => {
    mini = null;
  });
}

// ---------------------------------------------------------------- tray

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(assets, isWin ? 'tray.ico' : 'tray.png'));
  return img.isEmpty() ? nativeImage.createFromPath(path.join(assets, 'icon.png')).resize({ width: 16, height: 16 }) : img;
}

function ensureTray() {
  if (tray) return;
  tray = new Tray(trayIcon());
  tray.on('click', () => popUp());
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const t = lastTimer;
  tray.setToolTip(t ? `Arrazi · ${t.step} · ${t.remaining} left\n${t.label}` : 'Arrazi');
  const items: Electron.MenuItemConstructorOptions[] = [{ label: 'Open Arrazi', click: () => popUp() }];
  if (t) {
    items.push({ type: 'separator' }, { label: `${t.step} · ${t.remaining}`, enabled: false });
    if (t.status === 'running') items.push({ label: 'Pause', click: () => sendCommand('timer:pause') });
    else if (t.status === 'paused') items.push({ label: 'Resume', click: () => sendCommand('timer:resume') });
    else items.push({ label: 'Start next step', click: () => sendCommand('timer:start') });
    items.push({ label: 'Skip step', click: () => sendCommand('timer:skip') }, { label: '+5 min', click: () => sendCommand('timer:extend') });
  }
  items.push({ type: 'separator' }, { label: 'Quit Arrazi', click: () => quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---------------------------------------------------------------- notifications

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function notify(n: { title: string; body: string; actions: { id: string; label: string }[] }) {
  if (!Notification.isSupported()) return;
  let note: Notification;
  if (isWin) {
    const route: Record<string, string> = {
      'timer:start': 'timer/start',
      'timer:skip': 'timer/skip',
      'timer:extend': 'timer/extend',
    };
    const actions = n.actions
      .filter((a) => route[a.id])
      .map((a) => `<action content="${xml(a.label)}" arguments="${PROTOCOL}://${route[a.id]}" activationType="protocol"/>`)
      .join('');
    const toastXml =
      `<toast launch="${PROTOCOL}://open" activationType="protocol" scenario="reminder">` +
      `<visual><binding template="ToastGeneric"><text>${xml(n.title)}</text><text>${xml(n.body)}</text></binding></visual>` +
      (actions ? `<actions>${actions}</actions>` : '') +
      `<audio silent="true"/></toast>`;
    note = new Notification({ toastXml });
  } else {
    note = new Notification({ title: n.title, body: n.body, silent: true, icon: path.join(assets, 'icon.png') });
  }
  note.on('click', () => popUp());
  note.on('close', () => liveNotifications.delete(note));
  liveNotifications.add(note);
  note.show();
  setTimeout(() => liveNotifications.delete(note), 10 * 60_000);
}

// ---------------------------------------------------------------- misc

function openExternal(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') void shell.openExternal(url);
    else if (u.protocol === 'file:') void shell.openPath(decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1')));
  } catch {
    /* ignore invalid links */
  }
}

function applySettings(s: { startWithWindows: boolean; minimizeToTray: boolean }) {
  minimizeToTray = !!s.minimizeToTray;
  if (minimizeToTray) ensureTray();
  else if (tray && !lastTimer) {
    tray.destroy();
    tray = null;
  }
  if (isWin || process.platform === 'darwin') {
    try {
      app.setLoginItemSettings({ openAtLogin: !!s.startWithWindows, path: exePath(), args: ['--hidden'] });
    } catch {
      /* not fatal */
    }
  }
}

function quit() {
  quitting = true;
  app.quit();
}

// ---------------------------------------------------------------- IPC

function registerIpc() {
  ipcMain.handle('store:loadAll', () => storage.loadAll());
  ipcMain.handle('store:saveApp', (_e, json: string) => storage.saveApp(json));
  ipcMain.handle('store:savePlayer', (_e, id: string, json: string) => storage.savePlayer(id, json));
  ipcMain.handle('store:deletePlayer', (_e, id: string) => storage.deletePlayer(id));
  ipcMain.handle('backup:export', async (_e, json: string, name: string) => {
    const r = await dialog.showSaveDialog(main!, {
      title: 'Export Arrazi backup',
      defaultPath: path.join(app.getPath('documents'), name),
      filters: [{ name: 'Arrazi backup', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, json, 'utf8');
    return { ok: true, path: r.filePath };
  });
  ipcMain.handle('backup:import', async () => {
    const r = await dialog.showOpenDialog(main!, {
      title: 'Import Arrazi backup',
      properties: ['openFile'],
      filters: [{ name: 'Arrazi backup', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      return { ok: true, json: fs.readFileSync(r.filePaths[0], 'utf8') };
    } catch {
      return { ok: false, error: 'Could not read the file.' };
    }
  });
  ipcMain.on('notify', (_e, n) => notify(n));
  ipcMain.on('window:popup', () => popUp());
  ipcMain.on('timer:state', (_e, s) => {
    lastTimer = s;
    if (s && minimizeToTray) ensureTray();
    updateTray();
    mini?.webContents.send('mini:state', s);
  });
  ipcMain.on('mini:set', (_e, show: boolean) => showMini(!!show));
  ipcMain.on('mini:command', (_e, cmd: string) => {
    if (cmd === 'mini:close') {
      showMini(false);
      return;
    }
    if (cmd === 'open-focus') popUp();
    sendCommand(cmd);
  });
  ipcMain.on('settings:apply', (_e, s) => applySettings(s));
  ipcMain.on('shell:open', (_e, url: string) => openExternal(url));
  ipcMain.on('win:control', (_e, cmd: string) => {
    if (!main) return;
    if (cmd === 'minimize') main.minimize();
    else if (cmd === 'maximize') (main.isMaximized() ? main.unmaximize() : main.maximize());
    else if (cmd === 'close') main.close();
  });
  ipcMain.on('renderer:ready', () => {
    rendererReady = true;
    while (pendingCommands.length) main?.webContents.send('command', pendingCommands.shift());
  });
  ipcMain.on('app:flushed', () => {
    flushed = true;
    if (quitting) app.quit();
  });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
}

// ---------------------------------------------------------------- lifecycle

app.setAppUserModelId(APP_ID);

if (gotLock) app.whenReady().then(() => {
  storage = new Storage(app.getPath('userData'));
  registerIpc();
  registerProtocol();
  ensureStartMenuShortcut();
  const hidden = process.argv.includes('--hidden');
  createMain(hidden);
  if (hidden) ensureTray();
  const url = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (url) handleUrl(url);
  // on wake, check right away whether a step ended while the PC slept
  powerMonitor.on('resume', () => main?.webContents.send('system:resume'));
  powerMonitor.on('unlock-screen', () => main?.webContents.send('system:resume'));
});

app.on('before-quit', (e) => {
  quitting = true;
  if (!flushed && main && rendererReady) {
    e.preventDefault();
    main.webContents.send('app:flush');
    setTimeout(() => {
      flushed = true;
      app.quit();
    }, 1500);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') quit();
});

app.on('activate', () => {
  if (!main) createMain(false);
});
