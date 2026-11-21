// Every statistic is derived from the saved logs (session log, EXP ledger, sets) so nothing can drift.
import { SHOP_BACKGROUNDS, ITEM } from './catalog';
import { addDays, dayKey, diffDays, monthOf, weekOf, yearOf } from './dates';
import type { ExpEntry, Player, Session } from './types';

export const isLive = (e: ExpEntry) => !e.reversedBy && e.reason !== 'reversal';

export function isFullWork(s: Session): boolean {
  return s.type === 'work' && s.completed && !s.extension;
}

/** Days that count toward the streak: a chapter, a side quest or a full work session was finished. */
export function qualifyingDays(p: Player, ds: number): Set<string> {
  const set = new Set<string>();
  for (const s of p.sessions) if (isFullWork(s)) set.add(dayKey(s.end, ds));
  for (const e of p.expLog) {
    if ((e.reason === 'chapter' || e.reason === 'sidequest') && isLive(e)) set.add(dayKey(e.ts, ds));
  }
  return set;
}

/** Streak length counting back from `day` (inclusive). Frozen days bridge the gap but don't add. */
export function streakAt(day: string, qual: Set<string>, frozen: Set<string>): number {
  let n = 0;
  let d = day;
  let guard = 0;
  while ((qual.has(d) || frozen.has(d)) && guard++ < 20000) {
    if (qual.has(d)) n++;
    d = addDays(d, -1);
  }
  return n;
}

export function currentStreak(today: string, qual: Set<string>, frozen: Set<string>): number {
  if (qual.has(today)) return streakAt(today, qual, frozen);
  return streakAt(addDays(today, -1), qual, frozen);
}

export function longestStreak(qual: Set<string>, frozen: Set<string>): number {
  const days = Array.from(new Set([...qual, ...frozen])).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (prev && diffDays(prev, d) === 1) run += qual.has(d) ? 1 : 0;
    else run = qual.has(d) ? 1 : 0;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface StreakInfo {
  current: number;
  longest: number;
  freezes: number;
  todayDone: boolean;
}

export function streakInfo(p: Player, today: string, ds: number): StreakInfo {
  const qual = qualifyingDays(p, ds);
  const frozen = new Set(p.frozenDays);
  return {
    current: currentStreak(today, qual, frozen),
    longest: longestStreak(qual, frozen),
    freezes: p.streakFreezes,
    todayDone: qual.has(today),
  };
}

export interface DayStat {
  focusMin: number;
  chapters: number;
  pomodoros: number;
  exp: number;
  accessed: boolean;
}

const emptyDay = (): DayStat => ({ focusMin: 0, chapters: 0, pomodoros: 0, exp: 0, accessed: false });

export function dayStats(p: Player, ds: number): Map<string, DayStat> {
  const m = new Map<string, DayStat>();
  const get = (k: string) => {
    let v = m.get(k);
    if (!v) m.set(k, (v = emptyDay()));
    return v;
  };
  for (const s of p.sessions) {
    if (s.type !== 'work') continue;
    const st = get(dayKey(s.start, ds));
    st.focusMin += s.minutes;
    if (isFullWork(s)) st.pomodoros++;
  }
  for (const e of p.expLog) {
    const st = get(dayKey(e.ts, ds));
    st.exp += e.amount;
    if (e.reason === 'chapter' && isLive(e)) st.chapters++;
  }
  for (const d of p.daysAccessed) get(d).accessed = true;
  return m;
}

export interface Derived {
  workSessionsCompleted: number;
  validSets: number;
  bestFocusDayMin: number;
  bestFocusDay?: string;
  bestChaptersDay: number;
  totalFocusMin: number;
  nightOwl: boolean;
  earlyCrow: boolean;
  chaptersDone: number;
  hardDone: number;
  notes: number;
  missionsDone: number;
  projectsDone: number;
  sideQuestsDone: number;
  longestStreak: number;
  currentStreak: number;
  purchases: number;
  shopItemsOwned: number;
  backgroundsOwned: number;
  everMaxLevel: number;
  comeback: boolean;
  bestSetRun: number;
  lastQualifyingDay?: string;
}

export function derive(p: Player, today: string, ds: number): Derived {
  let workSessionsCompleted = 0;
  let totalFocusMin = 0;
  let nightOwl = false;
  let earlyCrow = false;
  const focusByDay = new Map<string, number>();
  for (const s of p.sessions) {
    if (s.type !== 'work') continue;
    totalFocusMin += s.minutes;
    const k = dayKey(s.start, ds);
    focusByDay.set(k, (focusByDay.get(k) ?? 0) + s.minutes);
    if (isFullWork(s)) {
      workSessionsCompleted++;
      const hr = new Date(s.end).getHours();
      if (hr < 4) nightOwl = true;
      else if (hr < 7) earlyCrow = true;
    }
  }
  let bestFocusDayMin = 0;
  let bestFocusDay: string | undefined;
  for (const [k, v] of focusByDay) {
    if (v > bestFocusDayMin) {
      bestFocusDayMin = v;
      bestFocusDay = k;
    }
  }
  let chaptersDone = 0;
  let hardDone = 0;
  let notes = 0;
  let missionsDone = 0;
  let projectsDone = 0;
  let sideQuestsDone = 0;
  const chaptersByDay = new Map<string, number>();
  for (const e of p.expLog) {
    if (!isLive(e)) continue;
    if (e.reason === 'chapter') {
      chaptersDone++;
      if (e.diff === 'hard') hardDone++;
      const k = dayKey(e.ts, ds);
      chaptersByDay.set(k, (chaptersByDay.get(k) ?? 0) + 1);
    } else if (e.reason === 'note') notes++;
    else if (e.reason === 'mission') missionsDone++;
    else if (e.reason === 'project') projectsDone++;
    else if (e.reason === 'sidequest') sideQuestsDone++;
  }
  const bestChaptersDay = Math.max(0, ...chaptersByDay.values());

  const qual = qualifyingDays(p, ds);
  const frozen = new Set(p.frozenDays);
  const qualSorted = Array.from(qual).sort();

  // Comeback: a chapter finished 7+ days after the previous finished activity
  const activity: { day: string; chapter: boolean }[] = [];
  for (const s of p.sessions) if (isFullWork(s)) activity.push({ day: dayKey(s.end, ds), chapter: false });
  for (const e of p.expLog)
    if ((e.reason === 'chapter' || e.reason === 'sidequest') && e.amount > 0)
      activity.push({ day: dayKey(e.ts, ds), chapter: e.reason === 'chapter' });
  activity.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  let comeback = false;
  let prevDay: string | null = null;
  for (const a of activity) {
    if (a.chapter && prevDay && diffDays(prevDay, a.day) >= 7) comeback = true;
    prevDay = a.day;
  }

  // Longest run of days with a valid full Pomodoro set
  const setDays = Array.from(new Set(p.sets.filter((s) => s.valid).map((s) => dayKey(s.ts, ds)))).sort();
  let bestSetRun = 0;
  let run = 0;
  for (let i = 0; i < setDays.length; i++) {
    run = i > 0 && diffDays(setDays[i - 1], setDays[i]) === 1 ? run + 1 : 1;
    bestSetRun = Math.max(bestSetRun, run);
  }

  const shopOwned = p.owned.filter((id) => ITEM[id]?.unlock.kind === 'shop' && ITEM[id].slot !== 'set');
  return {
    workSessionsCompleted,
    validSets: p.sets.filter((s) => s.valid).length,
    bestFocusDayMin,
    bestFocusDay,
    bestChaptersDay,
    totalFocusMin,
    nightOwl,
    earlyCrow,
    chaptersDone,
    hardDone,
    notes,
    missionsDone,
    projectsDone,
    sideQuestsDone,
    longestStreak: longestStreak(qual, frozen),
    currentStreak: currentStreak(today, qual, frozen),
    purchases: p.purchases,
    shopItemsOwned: shopOwned.length,
    backgroundsOwned: SHOP_BACKGROUNDS.filter((b) => p.owned.includes(b)).length,
    everMaxLevel: p.everMaxLevel,
    comeback,
    bestSetRun,
    lastQualifyingDay: qualSorted[qualSorted.length - 1],
  };
}

export interface TodayStats {
  chapters: number;
  focusMin: number;
  pomodoros: number;
  exp: number;
}

export function todayStats(p: Player, today: string, ds: number): TodayStats {
  const st = dayStats(p, ds).get(today);
  return st
    ? { chapters: st.chapters, focusMin: st.focusMin, pomodoros: st.pomodoros, exp: st.exp }
    : { chapters: 0, focusMin: 0, pomodoros: 0, exp: 0 };
}

/** Focus minutes per period, for the leaderboard and the boss */
export function focusBetween(p: Player, ds: number, pred: (day: string) => boolean): number {
  let m = 0;
  for (const s of p.sessions) if (s.type === 'work' && pred(dayKey(s.start, ds))) m += s.minutes;
  return m;
}

export function expBetween(p: Player, ds: number, pred: (day: string) => boolean): number {
  let x = 0;
  for (const e of p.expLog) if (pred(dayKey(e.ts, ds))) x += e.amount;
  return x;
}

/** Boss damage: one point per whole focused minute in the week */
export function weekDamage(p: Player, week: string, ds: number): number {
  let d = 0;
  for (const s of p.sessions) if (s.type === 'work' && weekOf(dayKey(s.start, ds)) === week) d += Math.floor(s.minutes);
  return d;
}

export type Period = 'week' | 'month' | 'all';

export function periodPredicate(period: Period, today: string): (day: string) => boolean {
  if (period === 'week') {
    const w = weekOf(today);
    return (d) => weekOf(d) === w;
  }
  if (period === 'month') {
    const m = monthOf(today);
    return (d) => monthOf(d) === m;
  }
  return () => true;
}

export function daysAccessedThisYear(p: Player, today: string): number {
  const y = yearOf(today);
  return p.daysAccessed.filter((d) => yearOf(d) === y).length;
}

/** Focus minutes per chapter / mission / project from the session log */
export function focusByRef(p: Player): { chapter: Map<string, number>; mission: Map<string, number>; project: Map<string, number>; sideQuest: Map<string, number> } {
  const chapter = new Map<string, number>();
  const mission = new Map<string, number>();
  const project = new Map<string, number>();
  const sideQuest = new Map<string, number>();
  const add = (m: Map<string, number>, k: string | undefined, v: number) => {
    if (k) m.set(k, (m.get(k) ?? 0) + v);
  };
  for (const s of p.sessions) {
    if (s.type !== 'work') continue;
    add(chapter, s.chapterId, s.minutes);
    add(mission, s.missionId, s.minutes);
    add(project, s.projectId, s.minutes);
    add(sideQuest, s.sideQuestId, s.minutes);
  }
  return { chapter, mission, project, sideQuest };
}
