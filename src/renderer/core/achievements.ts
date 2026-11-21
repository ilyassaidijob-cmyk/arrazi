import type { Derived } from './stats';

export type AchType = 'Focus' | 'Learning' | 'Streak' | 'Character' | 'Special';

export interface AchievementDef {
  id: string;
  name: string;
  type: AchType;
  hidden?: boolean;
  how: string;
  coins: number;
  /** current / target progress for the badge grid */
  progress: (d: Derived) => [number, number];
}

const h = (min: number) => Math.floor(min / 60);

export const ACHIEVEMENTS: AchievementDef[] = [
  // Focus
  { id: 'first_spark', name: 'First Spark', type: 'Focus', how: 'Finish your first work session', coins: 20, progress: (d) => [d.workSessionsCompleted, 1] },
  { id: 'full_moon', name: 'Full Moon', type: 'Focus', how: 'Finish your first full Pomodoro set', coins: 50, progress: (d) => [d.validSets, 1] },
  { id: 'deep_night', name: 'Deep Night', type: 'Focus', how: 'Focus 4 hours in one day', coins: 100, progress: (d) => [h(d.bestFocusDayMin), 4] },
  { id: 'candle_burner', name: 'Candle Burner', type: 'Focus', how: 'Focus 10 hours in total', coins: 100, progress: (d) => [h(d.totalFocusMin), 10] },
  { id: 'lantern_keeper', name: 'Lantern Keeper', type: 'Focus', how: 'Focus 50 hours in total', coins: 200, progress: (d) => [h(d.totalFocusMin), 50] },
  { id: 'night_scholar', name: 'Night Scholar', type: 'Focus', how: 'Focus 100 hours in total', coins: 300, progress: (d) => [h(d.totalFocusMin), 100] },
  { id: 'keeper_hours', name: 'Keeper of the Hours', type: 'Focus', how: 'Focus 500 hours in total', coins: 1000, progress: (d) => [h(d.totalFocusMin), 500] },
  { id: 'night_owl', name: 'Night Owl', type: 'Focus', hidden: true, how: 'Finish a work session between midnight and 4:00', coins: 50, progress: (d) => [d.nightOwl ? 1 : 0, 1] },
  { id: 'early_crow', name: 'Early Crow', type: 'Focus', hidden: true, how: 'Finish a work session before 7:00 in the morning', coins: 50, progress: (d) => [d.earlyCrow ? 1 : 0, 1] },
  // Learning
  { id: 'first_page', name: 'First Page', type: 'Learning', how: 'Finish your first chapter', coins: 20, progress: (d) => [d.chaptersDone, 1] },
  { id: 'mission_accomplished', name: 'Mission Accomplished', type: 'Learning', how: 'Finish your first mission', coins: 100, progress: (d) => [d.missionsDone, 1] },
  { id: 'project_complete', name: 'Project Complete', type: 'Learning', how: 'Finish your first project', coins: 300, progress: (d) => [d.projectsDone, 1] },
  { id: 'chapter_hunter', name: 'Chapter Hunter', type: 'Learning', how: 'Finish 50 chapters', coins: 200, progress: (d) => [d.chaptersDone, 50] },
  { id: 'library_night', name: 'Library of Night', type: 'Learning', how: 'Finish 200 chapters', coins: 500, progress: (d) => [d.chaptersDone, 200] },
  { id: 'hard_mode', name: 'Hard Mode', type: 'Learning', how: 'Finish 10 Hard chapters', coins: 150, progress: (d) => [d.hardDone, 10] },
  { id: 'scholars_notes', name: "Scholar's Notes", type: 'Learning', how: 'Write 25 "What I learned" notes', coins: 150, progress: (d) => [d.notes, 25] },
  { id: 'polymath', name: 'Polymath', type: 'Learning', how: 'Finish 3 projects', coins: 500, progress: (d) => [d.projectsDone, 3] },
  // Streak
  { id: 'week_nights', name: 'Week of Nights', type: 'Streak', how: 'Reach a 7-day streak', coins: 50, progress: (d) => [d.longestStreak, 7] },
  { id: 'moon_cycle', name: 'Moon Cycle', type: 'Streak', how: 'Reach a 30-day streak', coins: 200, progress: (d) => [d.longestStreak, 30] },
  { id: 'hundred_nights', name: 'Hundred Nights', type: 'Streak', how: 'Reach a 100-day streak', coins: 500, progress: (d) => [d.longestStreak, 100] },
  { id: 'full_year', name: 'Full Year', type: 'Streak', how: 'Reach a 365-day streak', coins: 2000, progress: (d) => [d.longestStreak, 365] },
  // Character
  { id: 'new_look', name: 'New Look', type: 'Character', how: 'Buy your first shop item', coins: 20, progress: (d) => [d.purchases, 1] },
  { id: 'wardrobe', name: 'Wardrobe', type: 'Character', how: 'Own 10 shop items', coins: 150, progress: (d) => [d.shopItemsOwned, 10] },
  { id: 'night_gallery', name: 'Night Gallery', type: 'Character', how: 'Own every background', coins: 300, progress: (d) => [d.backgroundsOwned, 4] },
  // Special
  { id: 'top_tree', name: 'Top of the Tree', type: 'Special', how: 'Reach Legend III', coins: 1000, progress: (d) => [d.everMaxLevel, 30] },
  { id: 'comeback', name: 'Comeback', type: 'Special', hidden: true, how: 'Finish a chapter after 7 or more days away', coins: 50, progress: (d) => [d.comeback ? 1 : 0, 1] },
  { id: 'perfect_week', name: 'Perfect Week', type: 'Special', how: 'Finish a full Pomodoro set every day for 7 days in a row', coins: 150, progress: (d) => [d.bestSetRun, 7] },
];

export const ACHIEVEMENT: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const ACH_TYPES: AchType[] = ['Focus', 'Learning', 'Streak', 'Character', 'Special'];
