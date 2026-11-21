import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/renderer/core/achievements';
import { BOSSES, ITEM, MOONS } from '../src/renderer/core/catalog';
import { dayKey, monthOf } from '../src/renderer/core/dates';
import {
  awardLeaderBadges,
  buyItem,
  challengesFor,
  completeChapter,
  completeSideQuest,
  createPlayer,
  defaultLook,
  ensureBoss,
  type GameEvent,
  isBloodMoon,
  newChapter,
  newMission,
  newProject,
  newSideQuest,
  prestige,
  recordAccess,
  reconcile,
  saveNote,
  setPrice,
  untickChapter,
  type Ctx,
} from '../src/renderer/core/game';
import { CUM, coinsForLevel, expForStep, levelFromExp, lifetimeLevel, rankInfo, streakMultiplier } from '../src/renderer/core/ranks';
import { defaultApp, defaultSettings } from '../src/renderer/core/settings';
import { derive, streakInfo } from '../src/renderer/core/stats';
import {
  extendTimer,
  pauseTimer,
  resolveConfig,
  resumeTimer,
  setLength,
  skipStep,
  startNext,
  startSet,
  stopTimer,
  tickTimer,
  type TimerOutcome,
} from '../src/renderer/core/timer';
import type { Player, Settings } from '../src/renderer/core/types';

const MIN = 60_000;
const DAY = 86_400_000;

function mk(now: number, settings: Partial<Settings> = {}) {
  const events: GameEvent[] = [];
  const ctx: Ctx = { settings: { ...defaultSettings(), ...settings }, now, emit: (e) => events.push(e) };
  return { ctx, events };
}

function playerWithChapters(ctx: Ctx, n: number, diff: 'easy' | 'medium' | 'hard' = 'medium') {
  const p = createPlayer(ctx, 'Test', defaultLook());
  const m = newMission({ name: 'Networking' });
  for (let i = 0; i < n; i++) m.chapters.push(newChapter({ name: `Ch ${i}`, difficulty: diff }));
  const pr = newProject({ name: 'Cybersecurity', missions: [m] });
  p.projects.push(pr);
  return { p, pr, m };
}

describe('ranks and EXP formula', () => {
  it('matches the numbers in the spec', () => {
    expect(expForStep(1)).toBe(80);
    expect(expForStep(29)).toBe(4740);
    expect(CUM[30]).toBe(58170);
    const ranks = [0, 420, 1590, 3790, 7230, 12100, 18560, 26760, 36850, 48940];
    ranks.forEach((exp, i) => expect(CUM[i * 3 + 1]).toBe(exp));
    expect(rankInfo(14).full).toBe('Knight II');
    expect(levelFromExp(0)).toBe(1);
    expect(levelFromExp(79)).toBe(1);
    expect(levelFromExp(80)).toBe(2);
    expect(levelFromExp(10 ** 9)).toBe(30);
  });

  it('pays 10,900 coins for a first climb', () => {
    let total = 0;
    for (let L = 2; L <= 30; L++) total += coinsForLevel(L);
    expect(total).toBe(10900);
    expect(coinsForLevel(4)).toBe(200); // Apprentice
    expect(coinsForLevel(14)).toBe(250); // Knight II
    expect(coinsForLevel(15)).toBe(250); // Knight III
    expect(coinsForLevel(2)).toBe(50); // Recruit II
  });

  it('lifetime level and streak multiplier', () => {
    expect(lifetimeLevel(0)).toBe(1);
    expect(lifetimeLevel(999)).toBe(1);
    expect(lifetimeLevel(1000)).toBe(2);
    expect(streakMultiplier(2)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.1);
    expect(streakMultiplier(7)).toBe(1.25);
    expect(streakMultiplier(30)).toBe(1.5);
    expect(streakMultiplier(400)).toBe(1.5);
  });
});

describe('catalog', () => {
  it('has 27 achievements worth 8,210 coins', () => {
    expect(ACHIEVEMENTS.length).toBe(27);
    expect(ACHIEVEMENTS.reduce((a, b) => a + b.coins, 0)).toBe(8210);
  });
  it('every moon and boss item exists', () => {
    for (const m of MOONS) expect(ITEM[m.item]).toBeTruthy();
    for (const b of BOSSES) expect(ITEM[b.item]).toBeTruthy();
    expect(MOONS[0].name).toBe('Wolf Moon');
    expect(MOONS[9].name).toBe("Hunter's Moon");
  });
  it('picks 3 monthly challenges', () => {
    const c = challengesFor('2026-11');
    expect(c.length).toBe(3);
    expect(new Set(c.map((x) => x.group)).size).toBe(3);
  });
});

describe('pomodoro set', () => {
  it('default set lasts 2 h 20 min, sends 8 step ends and earns 120 EXP', () => {
    const start = new Date(2026, 10, 2, 9, 0).getTime(); // a Monday, no blood moon assumed
    const { ctx } = mk(start, { pomodoro: { work: 25, short: 5, long: 25, sessions: 4, autoStart: true } });
    const app = defaultApp();
    app.settings = ctx.settings;
    const { p, pr, m } = playerWithChapters(ctx, 1);
    const ch = m.chapters[0];
    expect(setLength(ctx.settings.pomodoro)).toBe(140);
    startSet(ctx, app, p, { kind: 'chapter', id: ch.id, label: ch.name, projectId: pr.id, missionId: m.id }, ctx.settings.pomodoro);
    expect(ch.state).toBe('progress');
    const outcomes: TimerOutcome[] = [];
    for (let t = start; t <= start + 141 * MIN && app.timer; t += 15_000) {
      ctx.now = t;
      outcomes.push(...tickTimer(ctx, app, p));
    }
    expect(app.timer).toBeUndefined();
    expect(outcomes.length).toBe(8);
    expect(outcomes[7].kind).toBe('setComplete');
    const blood = isBloodMoon(dayKey(start, 0));
    expect(p.lifetimeExp).toBe(blood ? 240 : 120);
    expect(p.sessions.filter((s) => s.type === 'work').length).toBe(4);
    expect(p.sessions.length).toBe(8);
    expect(p.sets[0].valid).toBe(true);
  });

  it('manual steps: wait, +5 min, skip and stop', () => {
    const start = new Date(2026, 10, 3, 9, 0).getTime();
    const { ctx } = mk(start);
    const app = defaultApp();
    const { p, pr, m } = playerWithChapters(ctx, 1);
    const ch = m.chapters[0];
    const cfg = resolveConfig(ctx.settings.pomodoro, { work: 20, short: 4, sessions: 2 });
    startSet(ctx, app, p, { kind: 'chapter', id: ch.id, label: ch.name, projectId: pr.id, missionId: m.id }, cfg);
    // pause 10 minutes in the middle: paused time gives nothing
    ctx.now = start + 5 * MIN;
    pauseTimer(app.timer!, ctx.now);
    ctx.now += 10 * MIN;
    resumeTimer(app.timer!, ctx.now);
    ctx.now = start + 30 * MIN;
    const o = tickTimer(ctx, app, p);
    expect(o[0].kind).toBe('stepEnded');
    expect(app.timer!.status).toBe('waiting');
    expect(app.timer!.next).toBe('short');
    expect(p.sessions[0].minutes).toBe(20);
    // +5 min continues the work session
    extendTimer(ctx, app);
    expect(app.timer!.status).toBe('running');
    ctx.now += 5 * MIN;
    tickTimer(ctx, app, p);
    expect(app.timer!.next).toBe('short');
    // skip the break -> work session 2 starts
    skipStep(ctx, app, p);
    expect(app.timer!.step).toBe('work');
    expect(app.timer!.index).toBe(2);
    // stop after 7 minutes: minutes worked still count
    ctx.now += 7 * MIN;
    const stopped = stopTimer(ctx, app, p);
    expect(stopped.kind).toBe('stopped');
    expect(app.timer).toBeUndefined();
    const focusExp = p.expLog.filter((e) => e.reason === 'focus').reduce((a, e) => a + e.base, 0);
    expect(focusExp).toBe(20 + 5 + 7);
  });

  it('set bonus needs every work session to be 15 minutes or longer', () => {
    const start = new Date(2026, 10, 4, 9, 0).getTime();
    const { ctx } = mk(start);
    const app = defaultApp();
    const { p, m } = playerWithChapters(ctx, 1);
    const cfg = resolveConfig(ctx.settings.pomodoro, { work: 10, short: 1, long: 1, sessions: 2, autoStart: true });
    startSet(ctx, app, p, { kind: 'chapter', id: m.chapters[0].id, label: 'x' }, cfg);
    for (let t = start; app.timer && t < start + 60 * MIN; t += 10_000) {
      ctx.now = t;
      tickTimer(ctx, app, p);
    }
    expect(p.sets.length).toBe(1);
    expect(p.sets[0].valid).toBe(false);
    expect(p.expLog.some((e) => e.reason === 'set')).toBe(false);
  });

  it('a step that ended while the PC slept does not auto-start the next one', () => {
    const start = new Date(2026, 10, 5, 9, 0).getTime();
    const { ctx } = mk(start, { pomodoro: { work: 25, short: 5, long: 25, sessions: 4, autoStart: true } });
    const app = defaultApp();
    const { p, m } = playerWithChapters(ctx, 1);
    startSet(ctx, app, p, { kind: 'chapter', id: m.chapters[0].id, label: 'x' }, ctx.settings.pomodoro);
    ctx.now = start + 3 * 60 * MIN; // woke up 3 hours later
    const o = tickTimer(ctx, app, p);
    expect(o.length).toBe(1);
    expect(o[0].kind === 'stepEnded' && o[0].live).toBe(false);
    expect(app.timer!.status).toBe('waiting');
    startNext(ctx, app);
    expect(app.timer!.step).toBe('short');
  });
});

describe('learning tree and EXP', () => {
  it('chapter, note, mission and project EXP, and undo takes it back', () => {
    const now = new Date(2026, 10, 6, 10).getTime();
    const { ctx, events } = mk(now);
    const { p, m } = playerWithChapters(ctx, 2, 'medium');
    const blood = isBloodMoon(dayKey(now, 0)) ? 2 : 1;
    completeChapter(ctx, p, m.chapters[0].id);
    expect(p.lifetimeExp).toBe(25 * blood);
    expect(saveNote(ctx, p, m.chapters[0].id, 'TCP is connection oriented.')).toBe(5 * blood);
    expect(saveNote(ctx, p, m.chapters[0].id, 'Edited again later on.')).toBe(0);
    completeChapter(ctx, p, m.chapters[1].id);
    // 25 + 5 + 25 + mission 50 + project 200
    expect(p.lifetimeExp).toBe((25 + 5 + 25 + 50 + 200) * blood);
    expect(events.some((e) => e.type === 'mission')).toBe(true);
    expect(events.some((e) => e.type === 'project')).toBe(true);
    untickChapter(ctx, p, m.chapters[0].id);
    expect(p.lifetimeExp).toBe(25 * blood);
    expect(m.chapters[0].note).toBeTruthy(); // the note stays
    completeChapter(ctx, p, m.chapters[0].id); // note already written: +5 again with the chapter
    expect(p.lifetimeExp).toBe((25 + 5 + 25 + 50 + 200) * blood);
  });

  it('after 10 chapters and side quests in a day, each further one gives half EXP', () => {
    const now = new Date(2026, 10, 9, 10).getTime();
    const { ctx } = mk(now);
    const { p, m } = playerWithChapters(ctx, 11, 'hard');
    m.chapters.push(newChapter({ name: 'unfinished' })); // keep the mission open
    for (let i = 0; i < 11; i++) completeChapter(ctx, p, m.chapters[i].id);
    const entries = p.expLog.filter((e) => e.reason === 'chapter');
    expect(entries[9].base).toBe(50);
    expect(entries[10].base).toBe(25);
  });

  it('locked missions cannot be finished before the previous one', () => {
    const now = new Date(2026, 10, 10, 10).getTime();
    const { ctx } = mk(now);
    const p = createPlayer(ctx, 'A', defaultLook());
    const m1 = newMission({ name: 'One', chapters: [newChapter({ name: 'a' })] });
    const m2 = newMission({ name: 'Two', chapters: [newChapter({ name: 'b' })] });
    p.projects.push(newProject({ name: 'P', missions: [m1, m2], lockOrder: true }));
    expect(completeChapter(ctx, p, m2.chapters[0].id)).toBe(false);
    expect(completeChapter(ctx, p, m1.chapters[0].id)).toBe(true);
    expect(completeChapter(ctx, p, m2.chapters[0].id)).toBe(true);
  });

  it('ranking up pays coins and unlocks the rank item', () => {
    const now = new Date(2026, 10, 11, 10).getTime();
    const { ctx, events } = mk(now);
    const p = createPlayer(ctx, 'A', defaultLook());
    for (let i = 0; i < 20; i++) p.sideQuests.push(newSideQuest({ name: `q${i}`, difficulty: 'hard' }));
    for (let i = 0; i < 10; i++) completeSideQuest(ctx, p, p.sideQuests[i].id);
    expect(levelFromExp(p.seasonExp)).toBeGreaterThanOrEqual(4);
    expect(p.owned).toContain('rank_scarf');
    expect(events.some((e) => e.type === 'level' && e.rankUp)).toBe(true);
    expect(p.coins).toBeGreaterThanOrEqual(50 + 50 + 200);
  });
});

describe('streaks', () => {
  it('counts consecutive days and uses a freeze for a missed day', () => {
    const d0 = new Date(2026, 9, 1, 12).getTime();
    const { ctx } = mk(d0);
    const p = createPlayer(ctx, 'S', defaultLook());
    for (let i = 0; i < 30; i++) p.sideQuests.push(newSideQuest({ name: `q${i}` }));
    let q = 0;
    for (let day = 0; day < 5; day++) {
      ctx.now = d0 + day * DAY;
      completeSideQuest(ctx, p, p.sideQuests[q++].id);
    }
    expect(streakInfo(p, dayKey(ctx.now, 0), 0).current).toBe(5);
    p.streakFreezes = 1;
    // skip day 5, come back on day 6
    ctx.now = d0 + 6 * DAY;
    reconcile(ctx, p);
    expect(p.streakFreezes).toBe(0);
    expect(p.notices.some((n) => n.kind === 'freeze')).toBe(true);
    completeSideQuest(ctx, p, p.sideQuests[q++].id);
    expect(streakInfo(p, dayKey(ctx.now, 0), 0).current).toBe(6);
    // miss two days without a freeze: streak resets
    ctx.now = d0 + 9 * DAY;
    reconcile(ctx, p);
    expect(streakInfo(p, dayKey(ctx.now, 0), 0).current).toBe(0);
    expect(streakInfo(p, dayKey(ctx.now, 0), 0).longest).toBe(6);
  });

  it('the day can start at 4:00 for night owls', () => {
    const late = new Date(2026, 10, 12, 2, 30).getTime();
    expect(dayKey(late, 0)).toBe('2026-11-12');
    expect(dayKey(late, 240)).toBe('2026-11-11');
  });
});

describe('seasons and prestige', () => {
  it('drops 3 tiers on the 1st, pays season rewards and re-pays rank coins when climbing back', () => {
    const oct = new Date(2026, 9, 15, 12).getTime();
    const { ctx } = mk(oct);
    const p = createPlayer(ctx, 'K', defaultLook());
    // jump to Knight II via a side quest worth lots of EXP: give EXP directly through the ledger API
    p.seasonExp = 0;
    const target = CUM[14] + 100; // Knight II
    p.sideQuests.push(newSideQuest({ name: 'big', difficulty: 'hard' }));
    completeSideQuest(ctx, p, p.sideQuests[0].id);
    // simulate the rest of the month's EXP
    p.seasonExp = target;
    p.seasonPeakLevel = 14;
    p.seasonPaidLevel = 14;
    const coinsBefore = p.coins;
    ctx.now = new Date(2026, 10, 1, 9).getTime();
    reconcile(ctx, p);
    expect(p.seasonKey).toBe('2026-11');
    expect(rankInfo(levelFromExp(p.seasonExp)).full).toBe('Warrior II');
    expect(p.coins - coinsBefore).toBe(5 * 50); // Knight is rank 5
    expect(p.owned).toContain('moon_hunter'); // reached Adventurer or higher in October
    const n = p.notices.find((x) => x.kind === 'season');
    expect(n && n.kind === 'season' && n.from === 14 && n.to === 11).toBe(true);
    expect(p.seasonPaidLevel).toBe(11);
  });

  it('ranked mode drops 6 tiers', () => {
    const { ctx } = mk(new Date(2026, 9, 15, 12).getTime(), { rankedMode: true });
    const p = createPlayer(ctx, 'R', defaultLook());
    p.seasonExp = CUM[14];
    ctx.now = new Date(2026, 10, 1, 9).getTime();
    reconcile(ctx, p);
    expect(levelFromExp(p.seasonExp)).toBe(8);
  });

  it('prestige at Legend III resets to Recruit I and adds a star', () => {
    const { ctx } = mk(new Date(2026, 10, 15, 12).getTime());
    const p = createPlayer(ctx, 'L', defaultLook());
    p.seasonExp = CUM[30];
    expect(prestige(ctx, p)).toBe(true);
    expect(p.prestige).toBe(1);
    expect(levelFromExp(p.seasonExp)).toBe(1);
    expect(p.owned).toContain('prestige_cloak');
  });
});

describe('boss, shop and leaderboard', () => {
  it('beats the weekly boss with 600 focused minutes', () => {
    const start = new Date(2026, 10, 16, 8).getTime(); // Monday
    const { ctx, events } = mk(start, { pomodoro: { work: 60, short: 5, long: 5, sessions: 10, autoStart: true } });
    const app = defaultApp();
    const { p, m } = playerWithChapters(ctx, 1);
    const boss = ensureBoss(ctx, p);
    expect(boss.hp).toBe(600);
    startSet(ctx, app, p, { kind: 'chapter', id: m.chapters[0].id, label: 'x' }, ctx.settings.pomodoro);
    for (let t = start; app.timer && t < start + 13 * 60 * MIN; t += 30_000) {
      ctx.now = t;
      tickTimer(ctx, app, p);
    }
    expect(boss.beaten).toBe(true);
    expect(events.some((e) => e.type === 'boss')).toBe(true);
    expect(p.owned).toContain(BOSSES.find((b) => b.id === boss.bossId)!.item);
  });

  it('buys items, holds at most 2 freezes and discounts sets for owned pieces', () => {
    const { ctx } = mk(new Date(2026, 10, 17, 12).getTime());
    const p = createPlayer(ctx, 'B', defaultLook());
    p.coins = 5000;
    expect(buyItem(ctx, p, 'freeze').ok).toBe(true);
    expect(buyItem(ctx, p, 'freeze').ok).toBe(true);
    expect(buyItem(ctx, p, 'freeze').ok).toBe(false);
    expect(buyItem(ctx, p, 'gym_tank').ok).toBe(true);
    expect(buyItem(ctx, p, 'gym_tank').ok).toBe(false);
    expect(p.achievements.new_look).toBeTruthy();
    expect(setPrice(p, 'set_gym')).toBeLessThan(1000);
    expect(buyItem(ctx, p, 'rank_crown').ok).toBe(false);
    expect(buyItem(ctx, p, 'set_gym').ok).toBe(true);
    expect(p.owned).toContain('gym_kettlebell');
  });

  it('awards weekly leaderboard badges', () => {
    const mon = new Date(2026, 10, 16, 8).getTime();
    const { ctx } = mk(mon);
    const app = defaultApp();
    const a = createPlayer(ctx, 'A', defaultLook());
    const b = createPlayer(ctx, 'B', defaultLook());
    a.sessions.push({ id: 's1', setId: 'x', type: 'work', label: 'x', start: mon - 3 * DAY, end: mon - 3 * DAY + 25 * MIN, minutes: 25, planned: 25, completed: true, index: 1 });
    expect(awardLeaderBadges(ctx, app, [a, b])).toBe(true);
    expect(a.leaderBadges.some((x) => x.kind === 'focus')).toBe(true);
    expect(b.leaderBadges.length).toBe(0);
    expect(awardLeaderBadges(ctx, app, [a, b])).toBe(false);
  });

  it('derives stats and records access', () => {
    const { ctx } = mk(new Date(2026, 10, 18, 12).getTime());
    const p: Player = createPlayer(ctx, 'D', defaultLook());
    recordAccess(ctx, p);
    recordAccess(ctx, p);
    expect(p.daysAccessed.length).toBe(1);
    expect(p.seasonKey).toBe(monthOf(dayKey(ctx.now, 0)));
    const d = derive(p, dayKey(ctx.now, 0), 0);
    expect(d.chaptersDone).toBe(0);
  });
});
