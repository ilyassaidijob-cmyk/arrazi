export type ID = string;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type StepType = 'work' | 'short' | 'long';

export interface PomodoroConfig {
  work: number; // minutes, 1..180
  short: number; // 1..60
  long: number; // 1..90
  sessions: number; // work sessions before the long break, 1..10
  autoStart: boolean;
}
export type PomodoroOverride = Partial<PomodoroConfig>;

export interface Preset {
  id: ID;
  name: string;
  work: number;
  short: number;
  long: number;
  sessions?: number;
  builtIn?: boolean;
}

export interface Resource {
  id: ID;
  label: string;
  url: string;
}

export type ChapterState = 'todo' | 'progress' | 'done';

export interface Chapter {
  id: ID;
  name: string;
  difficulty: Difficulty;
  resources: Resource[];
  estPomodoros: number;
  pomodoro?: PomodoroOverride;
  state: ChapterState;
  doneAt?: number;
  note?: string;
  noteAt?: number;
  createdAt: number;
}

export interface Mission {
  id: ID;
  name: string;
  targetDate?: string; // YYYY-MM-DD
  chapters: Chapter[];
  pomodoro?: PomodoroOverride;
  doneAt?: number;
  createdAt: number;
}

export type ProjectIcon =
  | 'shield'
  | 'note'
  | 'dumbbell'
  | 'book'
  | 'code'
  | 'globe'
  | 'brush'
  | 'flask'
  | 'abacus'
  | 'leaf';

export interface Project {
  id: ID;
  name: string;
  goal: string;
  targetDate?: string;
  icon: ProjectIcon;
  missions: Mission[];
  lockOrder: boolean;
  pomodoro?: PomodoroOverride;
  doneAt?: number;
  createdAt: number;
}

export interface SideQuest {
  id: ID;
  name: string;
  difficulty: Difficulty;
  projectId?: ID;
  dueDate?: string;
  doneAt?: number;
  createdAt: number;
}

/** One entry of the session log. Every focus statistic is computed from this log. */
export interface Session {
  id: ID;
  setId: ID;
  type: StepType;
  projectId?: ID;
  missionId?: ID;
  chapterId?: ID;
  sideQuestId?: ID;
  label: string;
  start: number; // ms epoch
  end: number; // ms epoch
  minutes: number; // minutes the timer was actually running (pauses excluded)
  planned: number; // planned minutes of this segment
  completed: boolean; // ran until its planned end
  index: number; // work session number inside the set (1-based)
  extension?: boolean; // a "+5 min" continuation of the step that just ended
}

export type ExpReason =
  | 'focus'
  | 'set'
  | 'chapter'
  | 'note'
  | 'mission'
  | 'project'
  | 'sidequest'
  | 'boss'
  | 'reversal';

export interface ExpEntry {
  id: ID;
  ts: number;
  amount: number; // EXP actually added (after multipliers); negative for reversals
  base: number;
  mult: number;
  reason: ExpReason;
  ref?: ID;
  label: string;
  diff?: Difficulty;
  reversedBy?: ID;
  reverses?: ID;
}

export interface CoinEntry {
  id: ID;
  ts: number;
  amount: number;
  label: string;
}

export type Slot =
  | 'hair'
  | 'hairShade'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'head'
  | 'face'
  | 'neck'
  | 'wrist'
  | 'held'
  | 'back'
  | 'prop'
  | 'background';

export interface Look {
  body: 'boy' | 'girl';
  hair: string;
  hairShade: string;
  top: string;
  bottom: string;
  shoes: string;
  head?: string;
  face?: string;
  neck?: string;
  wrist?: string;
  held?: string;
  back?: string;
  prop?: string;
  background: string;
}

export interface SetRecord {
  id: ID;
  ts: number;
  valid: boolean; // every work session was 15 minutes or longer
}

export interface BossRecord {
  week: string; // Monday day key
  bossId: string;
  hp: number;
  beaten: boolean;
  at?: number;
  resolved?: boolean; // the week is over and the result has been shown
}

export interface SeasonRecord {
  season: string; // YYYY-MM
  peakLevel: number;
  coins: number;
  item?: string;
  active: boolean;
}

export interface Player {
  id: ID;
  name: string;
  createdAt: number;
  pinHash?: string;
  look: Look;
  owned: string[];
  coins: number;
  lifetimeExp: number;
  seasonExp: number;
  seasonKey: string; // YYYY-MM of the season the player is in
  seasonPaidLevel: number; // highest level whose coins were paid this season
  seasonPeakLevel: number; // highest level reached this season
  everMaxLevel: number; // highest season level ever reached (for Top of the Tree)
  prestige: number;
  streakFreezes: number;
  frozenDays: string[];
  streakCheckedThrough?: string;
  projects: Project[];
  sideQuests: SideQuest[];
  sessions: Session[];
  expLog: ExpEntry[];
  coinLog: CoinEntry[];
  sets: SetRecord[];
  achievements: Record<string, number>;
  challengesDone: string[]; // `${month}:${challengeId}`
  leaderBadges: { week: string; kind: 'focus' | 'streak' }[];
  bosses: BossRecord[];
  seasons: SeasonRecord[];
  daysAccessed: string[];
  purchases: number; // shop purchases made (for New Look)
  lastSeenAt: number;
  notices: Notice[]; // messages waiting to be shown the next time this player is opened
}

export type Notice =
  | {
      id: ID;
      kind: 'season';
      season: string;
      peakLevel: number;
      coins: number;
      item?: string;
      from: number;
      to: number;
      newSeason: string;
      active: boolean;
    }
  | { id: ID; kind: 'bossEscaped'; bossId: string; week: string; damage: number; hp: number }
  | { id: ID; kind: 'freeze'; day: string; left: number }
  | { id: ID; kind: 'leader'; week: string; badge: 'focus' | 'streak'; coins: number };

export interface TimerSnapshot {
  playerId: ID;
  setId: ID;
  target: TimerTarget;
  config: PomodoroConfig;
  step: StepType;
  index: number; // current work session number (for breaks: the one just finished)
  status: 'running' | 'paused' | 'waiting';
  stepStart: number; // wall time this segment started
  endsAt: number; // when running: wall time the segment ends
  remainingMs: number; // when paused: time left
  runMs: number; // running ms accumulated before lastResume
  lastResume: number; // wall time of the last start/resume
  plannedMs: number;
  extension: boolean;
  workMinutes: Record<number, number>; // minutes run per work session index in this set
  next?: StepType; // when waiting: the step that will start next
  nextIndex?: number;
}

export interface TimerTarget {
  kind: 'chapter' | 'sidequest';
  id: ID;
  label: string;
  projectId?: ID;
  missionId?: ID;
}

export type SoundId = 'bell' | 'chime' | 'gong' | 'crow' | 'wood';

export interface Settings {
  animations: boolean;
  language: 'en';
  soundsOn: boolean;
  timerSound: SoundId;
  volume: number; // 0..100
  ambience: boolean;
  systemNotifications: boolean;
  popUp: boolean;
  pomodoro: PomodoroConfig;
  presets: Preset[]; // custom presets ("Save my own preset")
  dayStartMinutes: number; // 0 = midnight, 240 = 4:00
  startWithWindows: boolean;
  minimizeToTray: boolean;
  rankedMode: boolean;
  weeklyBossHp: number;
  miniTimer: boolean;
}

export interface AppData {
  version: 1;
  settings: Settings;
  playerOrder: ID[];
  lastPlayerId?: ID;
  leaderWeeksDone: string[];
  timer?: TimerSnapshot;
}
