// Exposes a small, typed bridge to the renderer. No Node APIs leak into the page.
import { contextBridge, ipcRenderer } from 'electron';

const on = (channel: string, cb: (...args: unknown[]) => void) => {
  const h = (_e: unknown, ...args: unknown[]) => cb(...args);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

declare const __APP_VERSION__: string;
const platform = process.platform;

contextBridge.exposeInMainWorld('arrazi', {
  loadAll: () => ipcRenderer.invoke('store:loadAll'),
  saveApp: (json: string) => ipcRenderer.invoke('store:saveApp', json),
  savePlayer: (id: string, json: string) => ipcRenderer.invoke('store:savePlayer', id, json),
  deletePlayer: (id: string) => ipcRenderer.invoke('store:deletePlayer', id),
  exportBackup: (json: string, name: string) => ipcRenderer.invoke('backup:export', json, name),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  notify: (n: unknown) => ipcRenderer.send('notify', n),
  popUp: () => ipcRenderer.send('window:popup'),
  timerState: (s: unknown) => ipcRenderer.send('timer:state', s),
  setMini: (show: boolean) => ipcRenderer.send('mini:set', show),
  applySettings: (s: unknown) => ipcRenderer.send('settings:apply', s),
  openExternal: (url: string) => ipcRenderer.send('shell:open', url),
  onCommand: (cb: (cmd: string) => void) => {
    const off = on('command', (cmd) => cb(String(cmd)));
    ipcRenderer.send('renderer:ready');
    return off;
  },
  onResume: (cb: () => void) => on('system:resume', () => cb()),
  onFlush: (cb: () => Promise<void>) =>
    on('app:flush', () => {
      void Promise.resolve(cb()).finally(() => ipcRenderer.send('app:flushed'));
    }),
  miniCommand: (cmd: string) => ipcRenderer.send('mini:command', cmd),
  onMiniState: (cb: (s: unknown) => void) => on('mini:state', (s) => cb(s)),
  winControl: (cmd: string) => ipcRenderer.send('win:control', cmd),
  version: __APP_VERSION__,
  platform,
});
