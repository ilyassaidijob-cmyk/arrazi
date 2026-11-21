// Bridge to the Electron main process. In a plain browser (preview / tests) it falls back to
// localStorage and the web Notification API.

export interface MiniState {
  step: string;
  label: string;
  remaining: string;
  status: 'running' | 'paused' | 'waiting';
  progress: number;
  player: string;
}

export interface NotifyAction {
  id: string;
  label: string;
}

export interface ArraziBridge {
  loadAll(): Promise<{ app: string | null; players: string[]; dataDir: string }>;
  saveApp(json: string): Promise<void>;
  savePlayer(id: string, json: string): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  exportBackup(json: string, name: string): Promise<{ ok: boolean; path?: string }>;
  importBackup(): Promise<{ ok: boolean; json?: string; error?: string }>;
  notify(n: { title: string; body: string; actions: NotifyAction[] }): void;
  popUp(): void;
  timerState(s: MiniState | null): void;
  setMini(show: boolean): void;
  applySettings(s: { startWithWindows: boolean; minimizeToTray: boolean }): void;
  openExternal(url: string): void;
  onCommand(cb: (cmd: string) => void): () => void;
  onResume(cb: () => void): () => void;
  onFlush(cb: () => Promise<void>): void;
  miniCommand(cmd: string): void;
  onMiniState(cb: (s: MiniState | null) => void): () => void;
  winControl(cmd: 'minimize' | 'maximize' | 'close'): void;
  version: string;
  platform: string;
}

declare global {
  interface Window {
    arrazi?: ArraziBridge;
  }
  const __APP_VERSION__: string;
  const __PREVIEW__: boolean;
}

const LS_APP = 'arrazi.app';
const LS_PLAYER = 'arrazi.player.';

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function download(json: string, name: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const commandListeners = new Set<(cmd: string) => void>();

const web: ArraziBridge = {
  async loadAll() {
    const s = ls();
    const app = s?.getItem(LS_APP) ?? null;
    const players: string[] = [];
    if (s)
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(LS_PLAYER)) players.push(s.getItem(k)!);
      }
    return { app, players, dataDir: 'this browser' };
  },
  async saveApp(json) {
    try {
      ls()?.setItem(LS_APP, json);
    } catch {
      /* storage full or blocked */
    }
  },
  async savePlayer(id, json) {
    try {
      ls()?.setItem(LS_PLAYER + id, json);
    } catch {
      /* storage full or blocked */
    }
  },
  async deletePlayer(id) {
    try {
      ls()?.removeItem(LS_PLAYER + id);
    } catch {
      /* ignore */
    }
  },
  async exportBackup(json, name) {
    download(json, name);
    return { ok: true, path: name };
  },
  importBackup() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return resolve({ ok: false });
        f.text().then((json) => resolve({ ok: true, json }), () => resolve({ ok: false, error: 'Could not read the file.' }));
      };
      input.click();
    });
  },
  notify({ title, body }) {
    try {
      if (typeof Notification === 'undefined') return;
      const show = () => {
        const n = new Notification(title, { body, silent: true });
        n.onclick = () => window.focus();
      };
      if (Notification.permission === 'granted') show();
      else if (Notification.permission !== 'denied') Notification.requestPermission().then((p) => p === 'granted' && show());
    } catch {
      /* notifications unavailable */
    }
  },
  popUp() {
    window.focus();
  },
  timerState(s) {
    document.title = s ? `${s.remaining} · ${s.step} — Arrazi` : 'Arrazi';
  },
  setMini() {},
  applySettings() {},
  openExternal(url) {
    window.open(url, '_blank', 'noopener');
  },
  onCommand(cb) {
    commandListeners.add(cb);
    return () => commandListeners.delete(cb);
  },
  onResume(cb) {
    const h = () => document.visibilityState === 'visible' && cb();
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  },
  onFlush(cb) {
    window.addEventListener('pagehide', () => void cb());
  },
  miniCommand(cmd) {
    commandListeners.forEach((l) => l(cmd));
  },
  onMiniState() {
    return () => {};
  },
  winControl() {},
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  platform: 'web',
};

export const platform: ArraziBridge = window.arrazi ?? web;
export const isElectron = !!window.arrazi;
