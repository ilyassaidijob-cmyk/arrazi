import { roman } from './util';

export const RANK_NAMES = [
  'Recruit',
  'Apprentice',
  'Adventurer',
  'Warrior',
  'Knight',
  'Captain',
  'Champion',
  'Hero',
  'Master',
  'Legend',
] as const;

export const MAX_LEVEL = 30; // Legend III

/** EXP needed to go from level k to k + 1 (k = 1 is Recruit I, k = 29 is Legend II). */
export function expForStep(k: number): number {
  return Math.round((50 + 30 * Math.pow(k, 1.5)) / 10) * 10;
}

/** CUM[L] = total season EXP needed to reach level L. CUM[1] = 0. */
export const CUM: number[] = (() => {
  const c = [0, 0];
  for (let L = 2; L <= MAX_LEVEL; L++) c[L] = c[L - 1] + expForStep(L - 1);
  return c;
})();

export function levelFromExp(exp: number): number {
  let L = 1;
  while (L < MAX_LEVEL && exp >= CUM[L + 1]) L++;
  return L;
}

export interface RankInfo {
  level: number;
  rank: number; // 1..10
  tier: number; // 1..3
  name: string; // "Knight"
  full: string; // "Knight II"
}

export function rankInfo(level: number): RankInfo {
  const L = Math.min(MAX_LEVEL, Math.max(1, level));
  const rank = Math.floor((L - 1) / 3) + 1;
  const tier = ((L - 1) % 3) + 1;
  const name = RANK_NAMES[rank - 1];
  return { level: L, rank, tier, name, full: `${name} ${roman(tier)}` };
}

export function levelOf(rank: number, tier: number): number {
  return (rank - 1) * 3 + tier;
}

export interface ExpProgress {
  level: number;
  into: number; // EXP earned inside the current level
  need: number; // EXP the current level needs (0 at Legend III)
  ratio: number; // 0..1
  next?: RankInfo;
}

export function expProgress(seasonExp: number): ExpProgress {
  const level = levelFromExp(seasonExp);
  if (level >= MAX_LEVEL) {
    return { level, into: seasonExp - CUM[MAX_LEVEL], need: 0, ratio: 1 };
  }
  const need = expForStep(level);
  const into = seasonExp - CUM[level];
  return { level, into, need, ratio: Math.min(1, into / need), next: rankInfo(level + 1) };
}

/** Coins paid when a level is reached: a new rank pays rank x 100, a new tier inside a rank pays rank x 50. */
export function coinsForLevel(level: number): number {
  if (level <= 1) return 0;
  const { rank, tier } = rankInfo(level);
  return tier === 1 ? rank * 100 : rank * 50;
}

/** Lifetime level: every 1,000 EXP ever earned is one level, no maximum. */
export function lifetimeLevel(lifetimeExp: number): number {
  return Math.floor(Math.max(0, lifetimeExp) / 1000) + 1;
}

export function streakMultiplier(streak: number): number {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1;
}

export const DIFF_EXP = { easy: 10, medium: 25, hard: 50 } as const;
export const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

export const EXP = {
  note: 5,
  mission: 50,
  project: 200,
  set: 20,
  boss: 100,
  halfAfterPerDay: 10,
  setMinWorkMinutes: 15,
} as const;
