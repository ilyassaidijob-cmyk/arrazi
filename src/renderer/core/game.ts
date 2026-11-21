// Game rules: EXP, ranks, coins, streaks, seasons, bosses, challenges, achievements and the learning tree.
// Every function mutates the given Player in place; the store saves it afterwards.
import { ACHIEVEMENTS } from './achievements';
import {
  BOSS,
  BOSS_REWARD,
  BOSSES,
  CHALLENGES,
  ITEM,
  ITEMS,
  MAX_FREEZES,
  MOONS,
  SEASON_ITEM_RANK,
  SET_PIECES,
  STARTER_ITEMS,
  type ChallengeDef,
} from './catalog';
import {
  addDays,
  dayKey,
  daysInMonth,
  diffDays,
  monthIndex,
  monthOf,
  nextMonth,
  weekNumber,
  weekOf,
} from './dates';
import {
  CUM,
  DIFF_EXP,
  EXP,
  MAX_LEVEL,
  coinsForLevel,
  expForStep,
  expProgress,
  levelFromExp,
  rankInfo,
  streakMultiplier,
} from './ranks';
import {
  currentStreak,
  derive,
  focusBetween,
  isLive,
  qualifyingDays,
  streakAt,
  streakInfo,
  weekDamage,
} from './stats';
import type {
  AppData,
  BossRecord,
  Chapter,
  Difficulty,
  ExpEntry,
  ExpReason,
  Look,
  Mission,
  Notice,
  Player,
  Project,
  Session,
  Settings,
  SideQuest,
  Slot,
} from './types';
import { hash, rng, uid } from './util';

export type GameEvent =
  | { type: 'exp'; playerId: string; amount: number; label: string; mult: number }
  | { type: 'coins'; playerId: string; amount: number; label: string }
  | { type: 'level'; playerId: string; from: number; to: number; coins: number; rankUp: boolean; items: string[] }
  | { type: 'achievement'; playerId: string; id: string; coins: number }
  | { type: 'challenge'; playerId: string; id: string; month: string; coins: number }
  | { type: 'boss'; playerId: string; bossId: string; coins: number; item?: string }
  | { type: 'mission'; playerId: string; name: string }
  | { type: 'project'; playerId: string; name: string; projectId: string }
  | { type: 'prestige'; playerId: string; stars: number; item?: string }
  | { type: 'celebrate'; playerId: string };

export interface Ctx {
  settings: Settings;
  now: number;
  emit: (e: GameEvent) => void;
}

export const dsOf = (ctx: Ctx) => ctx.settings.dayStartMinutes;
export const todayOf = (ctx: Ctx) => dayKey(ctx.now, ctx.settings.dayStartMinutes);

// ---------------------------------------------------------------- players

export function defaultLook(body: 'boy' | 'girl' = 'boy'): Look {
  return {
    body,
    hair: body === 'girl' ? 'hair_bob' : 'hair_messy',
    hairShade: 'shade_ash',
    top: 'top_tunic',
    bottom: 'bottom_trousers',
    shoes: 'shoes_boots',
    background: 'bg_night',
  };
}

export function createPlayer(ctx: Ctx, name: string, look: Look): Player {
  const now = ctx.now;
  return {
    id: uid('p_'),
    name: name.trim(),
    createdAt: now,
    look,
    owned: [...STARTER_ITEMS],
    coins: 0,
    lifetimeExp: 0,
    seasonExp: 0,
    seasonKey: monthOf(todayOf(ctx)),
    seasonPaidLevel: 1,
    seasonPeakLevel: 1,
    everMaxLevel: 1,
    prestige: 0,
    streakFreezes: 0,
    frozenDays: [],
    projects: [],
    sideQuests: [],
    sessions: [],
    expLog: [],
    coinLog: [],
    sets: [],
    achievements: {},
    challengesDone: [],
    leaderBadges: [],
    bosses: [],
    seasons: [],
    daysAccessed: [],
    purchases: 0,
    lastSeenAt: now,
    notices: [],
  };
}

/** Fill in fields added in later versions so old saves keep working. */
export function migratePlayer(p: Player): Player {
  const d = createPlayer(
    { settings: { dayStartMinutes: 0 } as Settings, now: p.createdAt || Date.now(), emit: () => {} },
    p.name || 'Player',
    p.look || defaultLook(),
  );
  const out = { ...d, ...p } as Player;
  out.look = { ...defaultLook(out.look?.body), ...out.look };
  for (const id of STARTER_ITEMS) if (!out.owned.includes(id)) out.owned.push(id);
  return out;
}

// ---------------------------------------------------------------- EXP & coins

export function isBloodMoon(day: string): boolean {
  return bloodMoonDay(monthOf(day)) === day;
}

export function bloodMoonDay(month: string): string {
  const n = daysInMonth(month);
  const d = 1 + (hash('blood:' + month) % n);
  return `${month}-${String(d).padStart(2, '0')}`;
}

export function currentMultiplier(ctx: Ctx, p: Player): { streak: number; blood: boolean; mult: number } {
  const today = todayOf(ctx);
  const streak = streakInfo(p, today, dsOf(ctx)).current;
  const blood = isBloodMoon(today);
  return { streak, blood, mult: streakMultiplier(streak) * (blood ? 2 : 1) };
}

export function grantCoins(ctx: Ctx, p: Player, base: number, label: string, silent = false): number {
  const amount = Math.round(base * (1 + 0.1 * p.prestige));
  if (amount <= 0) return 0;
  p.coins += amount;
  p.coinLog.push({ id: uid('c'), ts: ctx.now, amount, label });
  if (!silent) ctx.emit({ type: 'coins', playerId: p.id, amount, label });
  return amount;
}

export function unlockItem(p: Player, id: string): boolean {
  if (!ITEM[id] || p.owned.includes(id)) return false;
  p.owned.push(id);
  return true;
}

const RANK_ITEM: Record<number, string> = Object.fromEntries(
  ITEMS.filter((i) => i.unlock.kind === 'rank').map((i) => [(i.unlock as { rank: number }).rank, i.id]),
);
const PRESTIGE_ITEM: Record<number, string> = Object.fromEntries(
  ITEMS.filter((i) => i.unlock.kind === 'prestige').map((i) => [(i.unlock as { star: number }).star, i.id]),
);

function addSeasonExp(ctx: Ctx, p: Player, delta: number) {
  const before = levelFromExp(p.seasonExp);
  p.seasonExp = Math.max(0, p.seasonExp + delta);
  const after = levelFromExp(p.seasonExp);
  p.seasonPeakLevel = Math.max(p.seasonPeakLevel, after);
  p.everMaxLevel = Math.max(p.everMaxLevel, after);
  if (after <= before) return;
  let coins = 0;
  const items: string[] = [];
  for (let L = Math.max(before, p.seasonPaidLevel) + 1; L <= after; L++) {
    coins += coinsForLevel(L);
  }
  for (let L = before + 1; L <= after; L++) {
    const ri = rankInfo(L);
    const item = ri.tier === 1 ? RANK_ITEM[ri.rank] : undefined;
    if (item && unlockItem(p, item)) items.push(item);
  }
  p.seasonPaidLevel = Math.max(p.seasonPaidLevel, after);
  const paid = coins > 0 ? grantCoins(ctx, p, coins, `Reached ${rankInfo(after).full}`, true) : 0;
  ctx.emit({
    type: 'level',
    playerId: p.id,
    from: before,
    to: after,
    coins: paid,
    rankUp: rankInfo(after).rank > rankInfo(before).rank,
    items,
  });
}

export function grantExp(
  ctx: Ctx,
  p: Player,
  base: number,
  reason: ExpReason,
  opts: { ref?: string; label: string; diff?: Difficulty },
): ExpEntry | null {
  if (!(base > 0)) return null;
  const { mult } = currentMultiplier(ctx, p);
  const amount = Math.round(base * mult);
  const e: ExpEntry = {
    id: uid('x'),
    ts: ctx.now,
    amount,
    base,
    mult,
    reason,
    ref: opts.ref,
    label: opts.label,
    diff: opts.diff,
  };
  p.expLog.push(e);
  p.lifetimeExp += amount;
  ctx.emit({ type: 'exp', playerId: p.id, amount, label: opts.label, mult });
  addSeasonExp(ctx, p, amount);
  return e;
}

function reverseEntry(ctx: Ctx, p: Player, e: ExpEntry | undefined) {
  if (!e || e.reversedBy) return;
  const r: ExpEntry = {
    id: uid('x'),
    ts: ctx.now,
    amount: -e.amount,
    base: -e.base,
    mult: e.mult,
    reason: 'reversal',
    ref: e.ref,
    label: `Undo: ${e.label}`,
    reverses: e.id,
  };
  e.reversedBy = r.id;
  p.expLog.push(r);
  p.lifetimeExp -= e.amount;
  addSeasonExp(ctx, p, -e.amount);
  ctx.emit({ type: 'exp', playerId: p.id, amount: -e.amount, label: r.label, mult: 1 });
}

const liveEntry = (p: Player, reason: ExpReason, ref: string) =>
  p.expLog.find((e) => e.reason === reason && e.ref === ref && !e.reversedBy);

function finishedToday(ctx: Ctx, p: Player): number {
  const today = todayOf(ctx);
  const ds = dsOf(ctx);
  return p.expLog.filter(
    (e) => (e.reason === 'chapter' || e.reason === 'sidequest') && isLive(e) && dayKey(e.ts, ds) === today,
  ).length;
}

// ---------------------------------------------------------------- achievements & challenges

export function checkAchievements(ctx: Ctx, p: Player) {
  const d = derive(p, todayOf(ctx), dsOf(ctx));
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    const [cur, target] = a.progress(d);
    if (cur >= target) {
      p.achievements[a.id] = ctx.now;
      const coins = grantCoins(ctx, p, a.coins, `Achievement: ${a.name}`, true);
      ctx.emit({ type: 'achievement', playerId: p.id, id: a.id, coins });
    }
  }
}

export function challengesFor(month: string): ChallengeDef[] {
  const r = rng(hash('challenges:' + month));
  return ([0, 1, 2] as const).map((g) => {
    const pool = CHALLENGES.filter((c) => c.group === g);
    return pool[Math.floor(r() * pool.length)];
  });
}

export function challengeProgress(p: Player, def: ChallengeDef, month: string, today: string, ds: number): number {
  const inMonth = (day: string) => monthOf(day) === month;
  const countLive = (reason: ExpReason) =>
    p.expLog.filter((e) => e.reason === reason && isLive(e) && inMonth(dayKey(e.ts, ds))).length;
  switch (def.metric) {
    case 'focusMin':
      return Math.floor(focusBetween(p, ds, inMonth));
    case 'focusDays': {
      const days = new Set<string>();
      for (const s of p.sessions) if (s.type === 'work' && s.minutes >= 1 && inMonth(dayKey(s.start, ds))) days.add(dayKey(s.start, ds));
      return days.size;
    }
    case 'sets':
      return p.sets.filter((s) => s.valid && inMonth(dayKey(s.ts, ds))).length;
    case 'chapters':
      return countLive('chapter');
    case 'notes':
      return countLive('note');
    case 'missions':
      return countLive('mission');
    case 'sidequests':
      return countLive('sidequest');
    case 'bosses':
      return p.bosses.filter((b) => b.beaten && b.at && inMonth(dayKey(b.at, ds))).length;
    case 'streak':
      return month === monthOf(today) ? streakInfo(p, today, ds).current : 0;
  }
}

export function checkChallenges(ctx: Ctx, p: Player) {
  const today = todayOf(ctx);
  const month = monthOf(today);
  for (const def of challengesFor(month)) {
    const key = `${month}:${def.id}`;
    if (p.challengesDone.includes(key)) continue;
    if (challengeProgress(p, def, month, today, dsOf(ctx)) >= def.target) {
      p.challengesDone.push(key);
      const coins = grantCoins(ctx, p, def.coins, `Moon challenge: ${def.label}`, true);
      ctx.emit({ type: 'challenge', playerId: p.id, id: def.id, month, coins });
    }
  }
}

function afterAction(ctx: Ctx, p: Player) {
  checkAchievements(ctx, p);
  checkChallenges(ctx, p);
}

// ---------------------------------------------------------------- weekly boss

export function bossForWeek(week: string) {
  const n = BOSSES.length;
  return BOSSES[((weekNumber(week) % n) + n) % n];
}

export function ensureBoss(ctx: Ctx, p: Player): BossRecord {
  const week = weekOf(todayOf(ctx));
  let rec = p.bosses.find((b) => b.week === week);
  if (!rec) {
    rec = { week, bossId: bossForWeek(week).id, hp: Math.max(1, ctx.settings.weeklyBossHp), beaten: false };
    p.bosses.push(rec);
  }
  return rec;
}

export function checkBoss(ctx: Ctx, p: Player) {
  const rec = ensureBoss(ctx, p);
  if (rec.beaten) return;
  if (weekDamage(p, rec.week, dsOf(ctx)) < rec.hp) return;
  rec.beaten = true;
  rec.at = ctx.now;
  const boss = BOSS[rec.bossId];
  let base = BOSS_REWARD.coins;
  let item: string | undefined;
  if (unlockItem(p, boss.item)) item = boss.item;
  else base += BOSS_REWARD.duplicateCoins;
  const coins = grantCoins(ctx, p, base, `Defeated ${boss.name}`, true);
  ctx.emit({ type: 'boss', playerId: p.id, bossId: boss.id, coins, item });
  grantExp(ctx, p, BOSS_REWARD.exp, 'boss', { ref: rec.week, label: `Defeated ${boss.name}` });
}

function resolveBossWeeks(ctx: Ctx, p: Player) {
  const week = weekOf(todayOf(ctx));
  for (const rec of p.bosses) {
    if (rec.week >= week || rec.resolved) continue;
    rec.resolved = true;
    if (!rec.beaten) {
      p.notices.push({
        id: uid('n'),
        kind: 'bossEscaped',
        bossId: rec.bossId,
        week: rec.week,
        damage: weekDamage(p, rec.week, dsOf(ctx)),
        hp: rec.hp,
      });
    }
  }
  if (p.bosses.length > 60) p.bosses = p.bosses.slice(-60);
}

// ---------------------------------------------------------------- streak, seasons, rollovers

export function reconcileStreak(ctx: Ctx, p: Player) {
  const ds = dsOf(ctx);
  const yesterday = addDays(todayOf(ctx), -1);
  let d = p.streakCheckedThrough ? addDays(p.streakCheckedThrough, 1) : dayKey(p.createdAt, ds);
  if (d > yesterday) return;
  const qual = qualifyingDays(p, ds);
  const frozen = new Set(p.frozenDays);
  let guard = 0;
  while (d <= yesterday && guard++ < 4000) {
    if (!qual.has(d) && !frozen.has(d)) {
      const prev = streakAt(addDays(d, -1), qual, frozen);
      if (prev > 0 && p.streakFreezes > 0) {
        p.streakFreezes--;
        p.frozenDays.push(d);
        frozen.add(d);
        p.notices.push({ id: uid('n'), kind: 'freeze', day: d, left: p.streakFreezes });
      }
    }
    d = addDays(d, 1);
  }
  p.streakCheckedThrough = yesterday;
}

export function seasonRollover(ctx: Ctx, p: Player) {
  const cur = monthOf(todayOf(ctx));
  const ds = dsOf(ctx);
  let guard = 0;
  while (p.seasonKey < cur && guard++ < 600) {
    const season = p.seasonKey;
    const moon = MOONS[monthIndex(season)];
    const active = p.expLog.some((e) => e.amount > 0 && monthOf(dayKey(e.ts, ds)) === season);
    const peak = p.seasonPeakLevel;
    let coins = 0;
    let item: string | undefined;
    if (active) {
      const r = rankInfo(peak).rank;
      coins = grantCoins(ctx, p, r * 50, `${moon.name} season reward`, true);
      if (r >= SEASON_ITEM_RANK && unlockItem(p, moon.item)) item = moon.item;
    }
    p.seasons.push({ season, peakLevel: peak, coins, item, active });
    const from = levelFromExp(p.seasonExp);
    const to = Math.max(1, from - (ctx.settings.rankedMode ? 6 : 3));
    if (to !== from) {
      const prog = expProgress(p.seasonExp);
      const frac = prog.need > 0 ? prog.into / prog.need : 0;
      p.seasonExp = CUM[to] + Math.floor(frac * expForStep(to));
    }
    p.seasonPaidLevel = to;
    p.seasonPeakLevel = to;
    p.seasonKey = nextMonth(season);
    if (active || from > 1) {
      p.notices = p.notices.filter((n) => n.kind !== 'season');
      p.notices.push({ id: uid('n'), kind: 'season', season, peakLevel: peak, coins, item, from, to, newSeason: p.seasonKey, active });
    }
  }
}

/** Run when the app starts, when a player is opened and when the day changes. */
export function reconcile(ctx: Ctx, p: Player) {
  reconcileStreak(ctx, p);
  seasonRollover(ctx, p);
  resolveBossWeeks(ctx, p);
}

/** The player opened the app today. */
export function recordAccess(ctx: Ctx, p: Player) {
  const t = todayOf(ctx);
  if (!p.daysAccessed.includes(t)) p.daysAccessed.push(t);
  p.lastSeenAt = ctx.now;
  ensureBoss(ctx, p);
  reconcile(ctx, p);
}

export function isSleepy(p: Player, today: string, ds: number): boolean {
  const d = derive(p, today, ds);
  const ref = d.lastQualifyingDay ?? dayKey(p.createdAt, ds);
  return diffDays(ref, today) >= 2;
}

/** Weekly leaderboard badges: "Top focuser" and "Streak keeper" for the week that just ended. */
export function awardLeaderBadges(ctx: Ctx, app: AppData, players: Player[]): boolean {
  const ds = dsOf(ctx);
  const lastWeek = addDays(weekOf(todayOf(ctx)), -7);
  if (app.leaderWeeksDone.includes(lastWeek)) return false;
  app.leaderWeeksDone = [...app.leaderWeeksDone, lastWeek].slice(-30);
  if (players.length < 2) return true;
  const inWeek = (d: string) => weekOf(d) === lastWeek;
  const sunday = addDays(lastWeek, 6);
  const focus = players.map((p) => focusBetween(p, ds, inWeek));
  const streaks = players.map((p) => currentStreak(sunday, qualifyingDays(p, ds), new Set(p.frozenDays)));
  const maxF = Math.max(...focus);
  const maxS = Math.max(...streaks);
  players.forEach((p, i) => {
    const award = (badge: 'focus' | 'streak') => {
      p.leaderBadges.push({ week: lastWeek, kind: badge });
      const coins = grantCoins(ctx, p, 50, badge === 'focus' ? 'Weekly badge: Top focuser' : 'Weekly badge: Streak keeper', true);
      p.notices.push({ id: uid('n'), kind: 'leader', week: lastWeek, badge, coins });
    };
    if (maxF >= 1 && focus[i] === maxF) award('focus');
    if (maxS > 0 && streaks[i] === maxS) award('streak');
  });
  return true;
}

// ---------------------------------------------------------------- prestige

export function canPrestige(p: Player): boolean {
  return levelFromExp(p.seasonExp) >= MAX_LEVEL;
}

export function prestige(ctx: Ctx, p: Player): boolean {
  if (!canPrestige(p)) return false;
  p.prestige += 1;
  p.seasonExp = 0;
  p.seasonPaidLevel = 1;
  const item = PRESTIGE_ITEM[p.prestige];
  const got = item && unlockItem(p, item) ? item : undefined;
  ctx.emit({ type: 'prestige', playerId: p.id, stars: p.prestige, item: got });
  afterAction(ctx, p);
  return true;
}

// ---------------------------------------------------------------- learning tree

export const missionDone = (m: Mission) => m.chapters.length > 0 && m.chapters.every((c) => c.state === 'done');
export const projectDone = (pr: Project) => pr.missions.length > 0 && pr.missions.every(missionDone);

export function missionUnlocked(pr: Project, index: number): boolean {
  if (!pr.lockOrder || index <= 0) return true;
  return missionDone(pr.missions[index - 1]);
}

export function findChapter(p: Player, chapterId: string) {
  for (const project of p.projects)
    for (const mission of project.missions)
      for (const chapter of mission.chapters) if (chapter.id === chapterId) return { project, mission, chapter };
  return undefined;
}

export function findMission(p: Player, missionId: string) {
  for (const project of p.projects)
    for (const mission of project.missions) if (mission.id === missionId) return { project, mission };
  return undefined;
}

export function completeChapter(ctx: Ctx, p: Player, chapterId: string): boolean {
  const f = findChapter(p, chapterId);
  if (!f) return false;
  const { project, mission, chapter } = f;
  if (chapter.state === 'done') return false;
  if (!missionUnlocked(project, project.missions.indexOf(mission))) return false;
  const half = finishedToday(ctx, p) >= EXP.halfAfterPerDay;
  chapter.state = 'done';
  chapter.doneAt = ctx.now;
  grantExp(ctx, p, DIFF_EXP[chapter.difficulty] * (half ? 0.5 : 1), 'chapter', {
    ref: chapter.id,
    label: chapter.name,
    diff: chapter.difficulty,
  });
  if (chapter.note && isSentence(chapter.note) && !liveEntry(p, 'note', chapter.id)) {
    grantExp(ctx, p, EXP.note, 'note', { ref: chapter.id, label: `Note: ${chapter.name}` });
  }
  if (missionDone(mission)) {
    mission.doneAt = ctx.now;
    if (!liveEntry(p, 'mission', mission.id)) {
      grantExp(ctx, p, EXP.mission, 'mission', { ref: mission.id, label: `Mission complete: ${mission.name}` });
      ctx.emit({ type: 'mission', playerId: p.id, name: mission.name });
    }
    if (projectDone(project)) {
      project.doneAt = ctx.now;
      if (!liveEntry(p, 'project', project.id)) {
        grantExp(ctx, p, EXP.project, 'project', { ref: project.id, label: `Project complete: ${project.name}` });
        ctx.emit({ type: 'project', playerId: p.id, name: project.name, projectId: project.id });
      }
    }
  }
  ctx.emit({ type: 'celebrate', playerId: p.id });
  afterAction(ctx, p);
  return true;
}

export function untickChapter(ctx: Ctx, p: Player, chapterId: string): boolean {
  const f = findChapter(p, chapterId);
  if (!f || f.chapter.state !== 'done') return false;
  const { project, mission, chapter } = f;
  const hadMission = missionDone(mission);
  const hadProject = projectDone(project);
  chapter.state = p.sessions.some((s) => s.chapterId === chapter.id) ? 'progress' : 'todo';
  chapter.doneAt = undefined;
  reverseEntry(ctx, p, liveEntry(p, 'chapter', chapter.id));
  reverseEntry(ctx, p, liveEntry(p, 'note', chapter.id));
  if (hadMission) {
    mission.doneAt = undefined;
    reverseEntry(ctx, p, liveEntry(p, 'mission', mission.id));
  }
  if (hadProject) {
    project.doneAt = undefined;
    reverseEntry(ctx, p, liveEntry(p, 'project', project.id));
  }
  return true;
}

/** "At least one sentence": three or more words. */
export function isSentence(text: string): boolean {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length >= 3;
}

/** Saves the "What I learned" note. Returns the EXP granted (0 or more). */
export function saveNote(ctx: Ctx, p: Player, chapterId: string, text: string): number {
  const f = findChapter(p, chapterId);
  if (!f) return 0;
  const { chapter } = f;
  chapter.note = text.trim();
  chapter.noteAt = ctx.now;
  let got = 0;
  if (chapter.state === 'done' && isSentence(chapter.note) && !liveEntry(p, 'note', chapter.id)) {
    got = grantExp(ctx, p, EXP.note, 'note', { ref: chapter.id, label: `Note: ${chapter.name}` })?.amount ?? 0;
  }
  afterAction(ctx, p);
  return got;
}

export function completeSideQuest(ctx: Ctx, p: Player, id: string): boolean {
  const q = p.sideQuests.find((s) => s.id === id);
  if (!q || q.doneAt) return false;
  const half = finishedToday(ctx, p) >= EXP.halfAfterPerDay;
  q.doneAt = ctx.now;
  grantExp(ctx, p, DIFF_EXP[q.difficulty] * (half ? 0.5 : 1), 'sidequest', { ref: q.id, label: q.name, diff: q.difficulty });
  ctx.emit({ type: 'celebrate', playerId: p.id });
  afterAction(ctx, p);
  return true;
}

export function untickSideQuest(ctx: Ctx, p: Player, id: string): boolean {
  const q = p.sideQuests.find((s) => s.id === id);
  if (!q || !q.doneAt) return false;
  q.doneAt = undefined;
  reverseEntry(ctx, p, liveEntry(p, 'sidequest', q.id));
  return true;
}

export function newProject(fields: Partial<Project> & { name: string }): Project {
  return {
    id: uid('pr'),
    goal: '',
    icon: 'book',
    missions: [],
    lockOrder: false,
    createdAt: Date.now(),
    ...fields,
  };
}

export function newMission(fields: Partial<Mission> & { name: string }): Mission {
  return { id: uid('m'), chapters: [], createdAt: Date.now(), ...fields };
}

export function newChapter(fields: Partial<Chapter> & { name: string }): Chapter {
  return {
    id: uid('ch'),
    difficulty: 'medium',
    resources: [],
    estPomodoros: 1,
    state: 'todo',
    createdAt: Date.now(),
    ...fields,
  };
}

export function newSideQuest(fields: Partial<SideQuest> & { name: string }): SideQuest {
  return { id: uid('sq'), difficulty: 'easy', createdAt: Date.now(), ...fields };
}

/** A chapter's difficulty can't be changed after it is finished. */
export function setChapterDifficulty(ch: Chapter, d: Difficulty): boolean {
  if (ch.state === 'done') return false;
  ch.difficulty = d;
  return true;
}

export function moveItem<T>(arr: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= arr.length) return;
  const [x] = arr.splice(from, 1);
  arr.splice(Math.max(0, Math.min(arr.length, to)), 0, x);
}

// ---------------------------------------------------------------- focus sessions (called by the timer)

export function logSession(ctx: Ctx, p: Player, s: Session) {
  p.sessions.push(s);
  if (s.type === 'work') {
    const minutes = Math.floor(s.minutes + 1e-9);
    if (minutes > 0) grantExp(ctx, p, minutes, 'focus', { ref: s.id, label: `Focus: ${s.label}` });
    checkBoss(ctx, p);
  }
  afterAction(ctx, p);
}

/** Records the end of a full set. The +20 bonus needs every work session to be 15 minutes or longer. */
export function logSet(ctx: Ctx, p: Player, setId: string, workMinutes: Record<number, number>, sessions: number) {
  let valid = true;
  for (let i = 1; i <= sessions; i++) if ((workMinutes[i] ?? 0) + 1e-9 < EXP.setMinWorkMinutes) valid = false;
  p.sets.push({ id: setId, ts: ctx.now, valid });
  const e = valid ? grantExp(ctx, p, EXP.set, 'set', { ref: setId, label: 'Full Pomodoro set' }) : null;
  afterAction(ctx, p);
  return { valid, exp: e?.amount ?? 0 };
}

export function markChapterStarted(p: Player, chapterId: string) {
  const f = findChapter(p, chapterId);
  if (f && f.chapter.state === 'todo') f.chapter.state = 'progress';
}

// ---------------------------------------------------------------- shop & wardrobe

export function setPrice(p: Player, setId: string): number {
  const it = ITEM[setId];
  if (!it || it.unlock.kind !== 'shop') return 0;
  const pieces = SET_PIECES[setId] ?? [];
  const value = (id: string) => (ITEM[id].unlock.kind === 'shop' ? (ITEM[id].unlock as { price: number }).price : 0);
  const total = pieces.reduce((a, id) => a + value(id), 0);
  const owned = pieces.filter((id) => p.owned.includes(id)).reduce((a, id) => a + value(id), 0);
  const raw = it.unlock.price * (1 - owned / Math.max(1, total));
  return Math.max(300, Math.round(raw / 10) * 10);
}

export function priceFor(p: Player, id: string): number {
  const it = ITEM[id];
  if (!it || it.unlock.kind !== 'shop') return 0;
  return it.slot === 'set' ? setPrice(p, id) : it.unlock.price;
}

export function buyItem(ctx: Ctx, p: Player, id: string): { ok: boolean; reason?: string } {
  const it = ITEM[id];
  if (!it || it.unlock.kind !== 'shop') return { ok: false, reason: 'This item is not sold in the shop.' };
  if (id === 'freeze') {
    if (p.streakFreezes >= MAX_FREEZES) return { ok: false, reason: `You can hold ${MAX_FREEZES} freezes at once.` };
  } else if (p.owned.includes(id)) return { ok: false, reason: 'You already own this.' };
  const price = priceFor(p, id);
  if (p.coins < price) return { ok: false, reason: `You need ${price - p.coins} more coins.` };
  p.coins -= price;
  p.coinLog.push({ id: uid('c'), ts: ctx.now, amount: -price, label: `Bought ${it.name}` });
  if (id === 'freeze') p.streakFreezes += 1;
  else {
    p.owned.push(id);
    for (const piece of SET_PIECES[id] ?? []) unlockItem(p, piece);
  }
  p.purchases += 1;
  afterAction(ctx, p);
  return { ok: true };
}

export function equip(p: Player, slot: Slot, id: string | undefined): boolean {
  if (id && !p.owned.includes(id)) return false;
  if (id && ITEM[id]?.slot !== slot) return false;
  if (!id) {
    if (slot === 'hair' || slot === 'hairShade' || slot === 'top' || slot === 'bottom' || slot === 'shoes' || slot === 'background')
      return false;
    delete (p.look as unknown as Record<string, string | undefined>)[slot];
    return true;
  }
  (p.look as unknown as Record<string, string>)[slot] = id;
  return true;
}

export function lockedReason(p: Player, id: string): string | null {
  const it = ITEM[id];
  if (!it || p.owned.includes(id)) return null;
  switch (it.unlock.kind) {
    case 'shop':
      return `${priceFor(p, id)} coins`;
    case 'rank':
      return `Reach ${rankInfo((it.unlock.rank - 1) * 3 + 1).name}`;
    case 'prestige':
      return `Prestige ${'★'.repeat(it.unlock.star)}`;
    case 'season':
      return `${MOONS[it.unlock.month].name} season`;
    case 'boss':
      return `Defeat ${BOSS[it.unlock.bossId].name}`;
    default:
      return null;
  }
}

export type { Notice };
