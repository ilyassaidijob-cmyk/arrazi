// Pomodoro engine. The timer never counts seconds: it stores when the current step ends and
// reads the clock, so it can't drift and it survives sleep, restarts and a hidden window.
import { BUILT_IN_PRESETS, POMODORO_LIMITS } from './catalog';
import { type Ctx, findChapter, logSession, logSet, markChapterStarted } from './game';
import type { AppData, Player, PomodoroConfig, PomodoroOverride, Session, StepType, TimerSnapshot, TimerTarget } from './types';
import { clamp, uid } from './util';

export const EXTEND_MIN = 5;
/** Steps that ended more than this long ago (PC asleep, app closed) never auto-start the next one. */
const LIVE_WINDOW_MS = 90_000;

export function defaultPomodoro(): PomodoroConfig {
  const c = BUILT_IN_PRESETS[0];
  return { work: c.work, short: c.short, long: c.long, sessions: c.sessions ?? 4, autoStart: false };
}

export function sanitizeConfig(c: Partial<PomodoroConfig>, base: PomodoroConfig = defaultPomodoro()): PomodoroConfig {
  const num = (v: unknown, d: number, [lo, hi]: readonly [number, number]) =>
    clamp(Math.round(Number.isFinite(Number(v)) ? Number(v) : d), lo, hi);
  return {
    work: num(c.work, base.work, POMODORO_LIMITS.work),
    short: num(c.short, base.short, POMODORO_LIMITS.short),
    long: num(c.long, base.long, POMODORO_LIMITS.long),
    sessions: num(c.sessions, base.sessions, POMODORO_LIMITS.sessions),
    autoStart: typeof c.autoStart === 'boolean' ? c.autoStart : base.autoStart,
  };
}

/** Global default, then project, mission and chapter overrides (most specific wins). */
export function resolveConfig(global: PomodoroConfig, ...overrides: (PomodoroOverride | undefined)[]): PomodoroConfig {
  let c = { ...global };
  for (const o of overrides) {
    if (!o) continue;
    const clean = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
    c = sanitizeConfig({ ...c, ...clean }, c);
  }
  return c;
}

export function configForTarget(global: PomodoroConfig, p: Player, target: TimerTarget): PomodoroConfig {
  if (target.kind === 'chapter') {
    const f = findChapter(p, target.id);
    if (f) return resolveConfig(global, f.project.pomodoro, f.mission.pomodoro, f.chapter.pomodoro);
  } else {
    const q = p.sideQuests.find((s) => s.id === target.id);
    const pr = q?.projectId ? p.projects.find((x) => x.id === q.projectId) : undefined;
    return resolveConfig(global, pr?.pomodoro);
  }
  return { ...global };
}

export function stepMinutes(c: PomodoroConfig, step: StepType): number {
  return step === 'work' ? c.work : step === 'short' ? c.short : c.long;
}

/** Total length of one set, e.g. 140 min for 25/5/25 x4 */
export function setLength(c: PomodoroConfig): number {
  return c.work * c.sessions + c.short * (c.sessions - 1) + c.long;
}

function beginStep(t: TimerSnapshot, step: StepType, index: number, at: number, extension = false) {
  t.step = step;
  t.index = index;
  t.extension = extension;
  t.status = 'running';
  t.stepStart = at;
  t.plannedMs = (extension ? EXTEND_MIN : stepMinutes(t.config, step)) * 60000;
  t.runMs = 0;
  t.lastResume = at;
  t.endsAt = at + t.plannedMs;
  t.remainingMs = t.plannedMs;
  t.next = undefined;
  t.nextIndex = undefined;
}

export function startSet(ctx: Ctx, app: AppData, p: Player, target: TimerTarget, config: PomodoroConfig): TimerSnapshot {
  const t: TimerSnapshot = {
    playerId: p.id,
    setId: uid('set'),
    target,
    config: { ...config },
    step: 'work',
    index: 1,
    status: 'running',
    stepStart: ctx.now,
    endsAt: ctx.now,
    remainingMs: 0,
    runMs: 0,
    lastResume: ctx.now,
    plannedMs: 0,
    extension: false,
    workMinutes: {},
  };
  beginStep(t, 'work', 1, ctx.now);
  if (target.kind === 'chapter') markChapterStarted(p, target.id);
  app.timer = t;
  return t;
}

export function runMsAt(t: TimerSnapshot, now: number): number {
  return t.runMs + (t.status === 'running' ? Math.max(0, now - t.lastResume) : 0);
}

export function remainingAt(t: TimerSnapshot, now: number): number {
  if (t.status === 'running') return Math.max(0, t.endsAt - now);
  if (t.status === 'paused') return t.remainingMs;
  return 0;
}

export function pauseTimer(t: TimerSnapshot, now: number) {
  if (t.status !== 'running') return;
  t.runMs += Math.max(0, now - t.lastResume);
  t.remainingMs = Math.max(0, t.endsAt - now);
  t.status = 'paused';
}

export function resumeTimer(t: TimerSnapshot, now: number) {
  if (t.status !== 'paused') return;
  t.status = 'running';
  t.lastResume = now;
  t.endsAt = now + t.remainingMs;
}

export type TimerOutcome =
  | {
      kind: 'stepEnded';
      finished: StepType;
      index: number;
      next: StepType;
      nextIndex: number;
      autoStarted: boolean;
      minutes: number;
      exp: number;
      live: boolean;
      extension: boolean;
      playerId: string;
      target: TimerTarget;
      config: PomodoroConfig;
    }
  | { kind: 'setComplete'; valid: boolean; exp: number; playerId: string; target: TimerTarget; sessions: number }
  | { kind: 'stopped'; minutes: number; exp: number; playerId: string; target: TimerTarget };

interface Finished {
  step: StepType;
  index: number;
  minutes: number;
  exp: number;
  extension: boolean;
}

function finishSegment(ctx: Ctx, t: TimerSnapshot, p: Player, endTs: number, completed: boolean): Finished {
  const runMs = runMsAt(t, endTs);
  const minutes = Math.round(runMs / 600) / 100;
  const s: Session = {
    id: uid('s'),
    setId: t.setId,
    type: t.step,
    label: t.target.label,
    start: t.stepStart,
    end: endTs,
    minutes,
    planned: Math.round(t.plannedMs / 600) / 100,
    completed,
    index: t.index,
  };
  if (t.extension) s.extension = true;
  if (t.target.kind === 'chapter') {
    s.chapterId = t.target.id;
    s.missionId = t.target.missionId;
    s.projectId = t.target.projectId;
  } else {
    s.sideQuestId = t.target.id;
    s.projectId = t.target.projectId;
  }
  if (t.step === 'work') t.workMinutes[t.index] = (t.workMinutes[t.index] ?? 0) + minutes;
  logSession(ctx, p, s);
  const exp = p.expLog.find((e) => e.ref === s.id && e.reason === 'focus')?.amount ?? 0;
  // keep the timer in a consistent state until the caller decides what comes next
  t.runMs = 0;
  t.lastResume = endTs;
  t.status = 'waiting';
  return { step: t.step, index: t.index, minutes, exp, extension: t.extension };
}

function nextAfter(t: TimerSnapshot, step: StepType, index: number): { next: StepType; nextIndex: number } | null {
  if (step === 'work') return { next: index >= t.config.sessions ? 'long' : 'short', nextIndex: index };
  if (step === 'short') return { next: 'work', nextIndex: index + 1 };
  return null; // the long break ends the set
}

function completeSet(ctx: Ctx, app: AppData, p: Player, t: TimerSnapshot): TimerOutcome {
  const r = logSet(ctx, p, t.setId, t.workMinutes, t.config.sessions);
  app.timer = undefined;
  return { kind: 'setComplete', valid: r.valid, exp: r.exp, playerId: p.id, target: t.target, sessions: t.config.sessions };
}

function waitFor(t: TimerSnapshot, next: StepType, nextIndex: number) {
  t.status = 'waiting';
  t.next = next;
  t.nextIndex = nextIndex;
  t.remainingMs = 0;
}

/** Processes every step whose end time has passed. */
export function tickTimer(ctx: Ctx, app: AppData, p: Player): TimerOutcome[] {
  const out: TimerOutcome[] = [];
  let guard = 0;
  while (app.timer && app.timer.status === 'running' && ctx.now >= app.timer.endsAt && guard++ < 64) {
    const t = app.timer;
    const endTs = t.endsAt;
    const live = ctx.now - endTs < LIVE_WINDOW_MS;
    const fin = finishSegment(ctx, t, p, endTs, true);
    const n = nextAfter(t, fin.step, fin.index);
    if (!n) {
      out.push(completeSet(ctx, app, p, t));
      break;
    }
    const auto = t.config.autoStart && live;
    if (auto) beginStep(t, n.next, n.nextIndex, endTs);
    else waitFor(t, n.next, n.nextIndex);
    out.push({
      kind: 'stepEnded',
      finished: fin.step,
      index: fin.index,
      next: n.next,
      nextIndex: n.nextIndex,
      autoStarted: auto,
      minutes: fin.minutes,
      exp: fin.exp,
      live,
      extension: fin.extension,
      playerId: p.id,
      target: t.target,
      config: t.config,
    });
  }
  return out;
}

/** Waiting card: start the step that comes next. */
export function startNext(ctx: Ctx, app: AppData) {
  const t = app.timer;
  if (!t || t.status !== 'waiting' || !t.next) return;
  beginStep(t, t.next, t.nextIndex ?? t.index, ctx.now);
}

/** +5 min: lengthens the running step, or continues the step that just ended. */
export function extendTimer(ctx: Ctx, app: AppData, minutes = EXTEND_MIN) {
  const t = app.timer;
  if (!t) return;
  const ms = minutes * 60000;
  if (t.status === 'running') {
    t.endsAt += ms;
    t.plannedMs += ms;
  } else if (t.status === 'paused') {
    t.remainingMs += ms;
    t.plannedMs += ms;
  } else {
    beginStep(t, t.step, t.index, ctx.now, true);
  }
}

/**
 * Skip. While a step runs it ends now (the minutes worked still count) and the next step starts.
 * On the waiting card it skips the step that was about to start and starts the one after it.
 */
export function skipStep(ctx: Ctx, app: AppData, p: Player): TimerOutcome[] {
  const t = app.timer;
  if (!t) return [];
  if (t.status === 'waiting') {
    if (!t.next) return [];
    if (t.next === 'long') return [completeSet(ctx, app, p, t)];
    if (t.next === 'short') {
      beginStep(t, 'work', (t.nextIndex ?? t.index) + 1, ctx.now);
      return [];
    }
    const skipped = t.nextIndex ?? t.index + 1;
    const n = nextAfter(t, 'work', skipped)!;
    beginStep(t, n.next, n.nextIndex, ctx.now);
    return [];
  }
  const fin = finishSegment(ctx, t, p, ctx.now, false);
  const n = nextAfter(t, fin.step, fin.index);
  if (!n) return [completeSet(ctx, app, p, t)];
  beginStep(t, n.next, n.nextIndex, ctx.now);
  return [];
}

/** Stop the set. Minutes already worked still give EXP. Stopping during the long break completes the set. */
export function stopTimer(ctx: Ctx, app: AppData, p: Player): TimerOutcome {
  const t = app.timer!;
  if (t.status === 'waiting') {
    if (t.next === 'long') return completeSet(ctx, app, p, t);
    app.timer = undefined;
    return { kind: 'stopped', minutes: 0, exp: 0, playerId: p.id, target: t.target };
  }
  const fin = finishSegment(ctx, t, p, ctx.now, false);
  if (fin.step === 'long') return completeSet(ctx, app, p, t);
  app.timer = undefined;
  return { kind: 'stopped', minutes: fin.step === 'work' ? fin.minutes : 0, exp: fin.exp, playerId: p.id, target: t.target };
}

export function stepLabel(step: StepType): string {
  return step === 'work' ? 'Work' : step === 'short' ? 'Short break' : 'Long break';
}
