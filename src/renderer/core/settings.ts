import { defaultPomodoro, sanitizeConfig } from './timer';
import type { AppData, Settings } from './types';
import { clamp } from './util';

export function defaultSettings(): Settings {
  return {
    animations: true,
    language: 'en',
    soundsOn: true,
    timerSound: 'bell',
    volume: 70,
    ambience: false,
    systemNotifications: true,
    popUp: true,
    pomodoro: defaultPomodoro(),
    presets: [],
    dayStartMinutes: 0,
    startWithWindows: false,
    minimizeToTray: false,
    rankedMode: false,
    weeklyBossHp: 600,
    miniTimer: false,
  };
}

export function defaultApp(): AppData {
  return { version: 1, settings: defaultSettings(), playerOrder: [], leaderWeeksDone: [] };
}

export function migrateApp(raw: Partial<AppData> | null | undefined): AppData {
  const d = defaultApp();
  if (!raw || typeof raw !== 'object') return d;
  const s = { ...d.settings, ...(raw.settings ?? {}) };
  s.pomodoro = sanitizeConfig(s.pomodoro ?? {}, d.settings.pomodoro);
  s.volume = clamp(Number(s.volume) || 0, 0, 100);
  s.dayStartMinutes = clamp(Math.round(Number(s.dayStartMinutes) || 0), 0, 360);
  s.weeklyBossHp = clamp(Math.round(Number(s.weeklyBossHp) || 600), 60, 6000);
  return {
    ...d,
    ...raw,
    version: 1,
    settings: s,
    playerOrder: Array.isArray(raw.playerOrder) ? raw.playerOrder : [],
    leaderWeeksDone: Array.isArray(raw.leaderWeeksDone) ? raw.leaderWeeksDone : [],
  };
}
