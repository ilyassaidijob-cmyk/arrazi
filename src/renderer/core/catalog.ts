import type { Preset, ProjectIcon, Slot } from './types';

export type Unlock =
  | { kind: 'free' }
  | { kind: 'shop'; price: number }
  | { kind: 'rank'; rank: number }
  | { kind: 'prestige'; star: number }
  | { kind: 'season'; month: number }
  | { kind: 'boss'; bossId: string };

export type Collection =
  | 'starter'
  | 'gym'
  | 'music'
  | 'cyber'
  | 'hair'
  | 'background'
  | 'set'
  | 'freeze'
  | 'rank'
  | 'prestige'
  | 'season'
  | 'boss';

export interface Item {
  id: string;
  name: string;
  slot: Slot | 'set' | 'consumable';
  collection: Collection;
  unlock: Unlock;
  desc?: string;
  shade?: number; // hair shade index into the palette
}

const shop = (price: number): Unlock => ({ kind: 'shop', price });
const free: Unlock = { kind: 'free' };

export const ITEMS: Item[] = [
  // Starter kit
  { id: 'hair_messy', name: 'Messy', slot: 'hair', collection: 'hair', unlock: free },
  { id: 'hair_sidepart', name: 'Side part', slot: 'hair', collection: 'hair', unlock: free },
  { id: 'hair_bob', name: 'Bob', slot: 'hair', collection: 'hair', unlock: free },
  { id: 'shade_ash', name: 'Ash', slot: 'hairShade', collection: 'hair', unlock: free, shade: 2 },
  { id: 'top_tunic', name: 'Wanderer tunic', slot: 'top', collection: 'starter', unlock: free },
  { id: 'bottom_trousers', name: 'Wanderer trousers', slot: 'bottom', collection: 'starter', unlock: free },
  { id: 'shoes_boots', name: 'Wanderer boots', slot: 'shoes', collection: 'starter', unlock: free },
  { id: 'bg_night', name: 'Plain night', slot: 'background', collection: 'background', unlock: free },

  // Hairstyles and hair shades
  { id: 'hair_short', name: 'Short', slot: 'hair', collection: 'hair', unlock: shop(100) },
  { id: 'hair_buzz', name: 'Buzz cut', slot: 'hair', collection: 'hair', unlock: shop(100) },
  { id: 'hair_long', name: 'Long', slot: 'hair', collection: 'hair', unlock: shop(150) },
  { id: 'hair_curly', name: 'Curly', slot: 'hair', collection: 'hair', unlock: shop(200) },
  { id: 'hair_tied', name: 'Tied back', slot: 'hair', collection: 'hair', unlock: shop(250) },
  { id: 'shade_ink', name: 'Ink', slot: 'hairShade', collection: 'hair', unlock: shop(50), shade: 1 },
  { id: 'shade_raven', name: 'Raven', slot: 'hairShade', collection: 'hair', unlock: shop(100), shade: 0 },
  { id: 'shade_silver', name: 'Silver', slot: 'hairShade', collection: 'hair', unlock: shop(200), shade: 3 },
  { id: 'shade_moon', name: 'Moonlight', slot: 'hairShade', collection: 'hair', unlock: shop(300), shade: 4 },

  // Gym collection
  { id: 'gym_headband', name: 'Headband', slot: 'head', collection: 'gym', unlock: shop(100) },
  { id: 'gym_tank', name: 'Tank top', slot: 'top', collection: 'gym', unlock: shop(120) },
  { id: 'gym_wraps', name: 'Wrist wraps', slot: 'wrist', collection: 'gym', unlock: shop(120) },
  { id: 'gym_shoes', name: 'Training shoes', slot: 'shoes', collection: 'gym', unlock: shop(160) },
  { id: 'gym_joggers', name: 'Joggers', slot: 'bottom', collection: 'gym', unlock: shop(180) },
  { id: 'gym_hoodie', name: 'Gym hoodie', slot: 'top', collection: 'gym', unlock: shop(250) },
  { id: 'gym_dumbbell', name: 'Dumbbell', slot: 'held', collection: 'gym', unlock: shop(300), desc: 'Held in hand' },
  { id: 'gym_kettlebell', name: 'Kettlebell', slot: 'prop', collection: 'gym', unlock: shop(400), desc: 'Sits beside you' },

  // Music collection
  { id: 'music_beanie', name: 'Beanie', slot: 'head', collection: 'music', unlock: shop(100) },
  { id: 'music_tee', name: 'Band T-shirt', slot: 'top', collection: 'music', unlock: shop(120) },
  { id: 'music_headphones', name: 'Headphones', slot: 'head', collection: 'music', unlock: shop(150) },
  { id: 'music_jacket', name: 'Leather jacket', slot: 'top', collection: 'music', unlock: shop(350) },
  { id: 'music_vinyl', name: 'Vinyl player', slot: 'prop', collection: 'music', unlock: shop(400), desc: 'Spins by the lantern' },
  { id: 'music_guitar', name: 'Guitar', slot: 'back', collection: 'music', unlock: shop(450), desc: 'Worn on the back' },
  { id: 'music_keyboard', name: 'Keyboard', slot: 'prop', collection: 'music', unlock: shop(500), desc: 'Stands by the lantern' },

  // Cybersecurity collection
  { id: 'cyber_usb', name: 'USB key necklace', slot: 'neck', collection: 'cyber', unlock: shop(150) },
  { id: 'cyber_mask', name: 'Mask', slot: 'face', collection: 'cyber', unlock: shop(200) },
  { id: 'cyber_hoodie', name: 'Black hoodie', slot: 'top', collection: 'cyber', unlock: shop(250) },
  { id: 'cyber_glasses', name: 'Hacker glasses', slot: 'face', collection: 'cyber', unlock: shop(300), desc: 'Code reflects in the lenses' },
  { id: 'cyber_laptop', name: 'Laptop', slot: 'held', collection: 'cyber', unlock: shop(450) },
  { id: 'cyber_terminal', name: 'Terminal screen', slot: 'prop', collection: 'cyber', unlock: shop(600), desc: 'Glows in the scene' },

  // Backgrounds
  { id: 'bg_gym', name: 'Gym at night', slot: 'background', collection: 'background', unlock: shop(300) },
  { id: 'bg_rooftop', name: 'Rooftop concert', slot: 'background', collection: 'background', unlock: shop(300) },
  { id: 'bg_server', name: 'Server room', slot: 'background', collection: 'background', unlock: shop(300) },
  { id: 'bg_forest', name: 'Haunted forest', slot: 'background', collection: 'background', unlock: shop(300) },

  // Full outfit sets (all pieces + a bonus animation)
  { id: 'set_gym', name: 'Full gym set', slot: 'set', collection: 'set', unlock: shop(1000), desc: 'Every gym piece + lifting animation' },
  { id: 'set_music', name: 'Full music set', slot: 'set', collection: 'set', unlock: shop(1200), desc: 'Every music piece + guitar animation' },
  { id: 'set_cyber', name: 'Full cybersecurity set', slot: 'set', collection: 'set', unlock: shop(1400), desc: 'Every cyber piece + typing animation' },

  // Streak freeze
  { id: 'freeze', name: 'Streak freeze', slot: 'consumable', collection: 'freeze', unlock: shop(150), desc: 'Saves your streak for one missed day. Hold up to 2.' },

  // Rank rewards: one exclusive piece per rank, never sold
  { id: 'rank_scarf', name: 'Apprentice scarf', slot: 'neck', collection: 'rank', unlock: { kind: 'rank', rank: 2 } },
  { id: 'rank_satchel', name: 'Adventurer satchel', slot: 'back', collection: 'rank', unlock: { kind: 'rank', rank: 3 } },
  { id: 'rank_bracers', name: 'Warrior bracers', slot: 'wrist', collection: 'rank', unlock: { kind: 'rank', rank: 4 } },
  { id: 'rank_circlet', name: 'Knight circlet', slot: 'head', collection: 'rank', unlock: { kind: 'rank', rank: 5 } },
  { id: 'rank_coat', name: "Captain's coat", slot: 'top', collection: 'rank', unlock: { kind: 'rank', rank: 6 } },
  { id: 'rank_cape', name: 'Champion cape', slot: 'back', collection: 'rank', unlock: { kind: 'rank', rank: 7 } },
  { id: 'rank_boots', name: 'Hero boots', slot: 'shoes', collection: 'rank', unlock: { kind: 'rank', rank: 8 } },
  { id: 'rank_robe', name: "Master's robe", slot: 'top', collection: 'rank', unlock: { kind: 'rank', rank: 9 } },
  { id: 'rank_crown', name: 'Legend crown', slot: 'head', collection: 'rank', unlock: { kind: 'rank', rank: 10 } },

  // Prestige outfits
  { id: 'prestige_cloak', name: 'Starlit cloak', slot: 'back', collection: 'prestige', unlock: { kind: 'prestige', star: 1 } },
  { id: 'prestige_mantle', name: 'Comet mantle', slot: 'top', collection: 'prestige', unlock: { kind: 'prestige', star: 2 } },
  { id: 'prestige_halo', name: 'Nebula halo', slot: 'head', collection: 'prestige', unlock: { kind: 'prestige', star: 3 } },
  { id: 'prestige_visor', name: 'Eclipse visor', slot: 'face', collection: 'prestige', unlock: { kind: 'prestige', star: 4 } },
  { id: 'prestige_armor', name: 'Moonsilver armor', slot: 'top', collection: 'prestige', unlock: { kind: 'prestige', star: 5 } },

  // Moon season items, one per month
  { id: 'moon_wolf', name: 'Howling wolf', slot: 'background', collection: 'season', unlock: { kind: 'season', month: 0 } },
  { id: 'moon_snow', name: 'Snow scarf', slot: 'neck', collection: 'season', unlock: { kind: 'season', month: 1 } },
  { id: 'moon_worm', name: 'Thaw boots', slot: 'shoes', collection: 'season', unlock: { kind: 'season', month: 2 } },
  { id: 'moon_pink', name: 'Petal crown', slot: 'head', collection: 'season', unlock: { kind: 'season', month: 3 } },
  { id: 'moon_flower', name: 'Flower cloak', slot: 'back', collection: 'season', unlock: { kind: 'season', month: 4 } },
  { id: 'moon_berry', name: 'Berry basket', slot: 'held', collection: 'season', unlock: { kind: 'season', month: 5 } },
  { id: 'moon_buck', name: 'Antler crown', slot: 'head', collection: 'season', unlock: { kind: 'season', month: 6 } },
  { id: 'moon_sturgeon', name: 'Fishing rod', slot: 'back', collection: 'season', unlock: { kind: 'season', month: 7 } },
  { id: 'moon_harvest', name: 'Straw hat', slot: 'head', collection: 'season', unlock: { kind: 'season', month: 8 } },
  { id: 'moon_hunter', name: 'Hooded hunter cloak', slot: 'top', collection: 'season', unlock: { kind: 'season', month: 9 } },
  { id: 'moon_beaver', name: 'Trapper hat', slot: 'head', collection: 'season', unlock: { kind: 'season', month: 10 } },
  { id: 'moon_cold', name: 'Frost mantle', slot: 'top', collection: 'season', unlock: { kind: 'season', month: 11 } },

  // Weekly boss trophies
  { id: 'boss_shadow', name: 'Shadow cape', slot: 'back', collection: 'boss', unlock: { kind: 'boss', bossId: 'shadow' } },
  { id: 'boss_crow', name: "Crow King's crown", slot: 'head', collection: 'boss', unlock: { kind: 'boss', bossId: 'crowking' } },
  { id: 'boss_fog', name: 'Fog lantern', slot: 'held', collection: 'boss', unlock: { kind: 'boss', bossId: 'fog' } },
  { id: 'boss_scarecrow', name: 'Scarecrow hat', slot: 'head', collection: 'boss', unlock: { kind: 'boss', bossId: 'scarecrow' } },
  { id: 'boss_owl', name: 'Owl feather cloak', slot: 'top', collection: 'boss', unlock: { kind: 'boss', bossId: 'owl' } },
  { id: 'boss_willow', name: 'Willow staff', slot: 'held', collection: 'boss', unlock: { kind: 'boss', bossId: 'willow' } },
  { id: 'boss_thief', name: "Thief's mask", slot: 'face', collection: 'boss', unlock: { kind: 'boss', bossId: 'thief' } },
  { id: 'boss_moth', name: 'Moth wings', slot: 'back', collection: 'boss', unlock: { kind: 'boss', bossId: 'moth' } },
];

export const ITEM: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const STARTER_ITEMS = ITEMS.filter((i) => i.unlock.kind === 'free').map((i) => i.id);
export const FREE_HAIRSTYLES = ['hair_messy', 'hair_sidepart', 'hair_bob'];
export const SHOP_BACKGROUNDS = ['bg_gym', 'bg_rooftop', 'bg_server', 'bg_forest'];
export const MAX_FREEZES = 2;

export const SET_PIECES: Record<string, string[]> = {
  set_gym: ITEMS.filter((i) => i.collection === 'gym').map((i) => i.id),
  set_music: ITEMS.filter((i) => i.collection === 'music').map((i) => i.id),
  set_cyber: ITEMS.filter((i) => i.collection === 'cyber').map((i) => i.id),
};
export const SET_ANIMATION: Record<string, 'lift' | 'guitar' | 'type'> = {
  set_gym: 'lift',
  set_music: 'guitar',
  set_cyber: 'type',
};

export function itemPrice(id: string): number | undefined {
  const it = ITEM[id];
  return it && it.unlock.kind === 'shop' ? it.unlock.price : undefined;
}

export const SHADES = [
  { id: 'shade_raven', idx: 0 },
  { id: 'shade_ink', idx: 1 },
  { id: 'shade_ash', idx: 2 },
  { id: 'shade_silver', idx: 3 },
  { id: 'shade_moon', idx: 4 },
];

export interface Moon {
  name: string;
  item: string;
  weather: 'snow' | 'rain' | 'petals' | 'fireflies' | 'leaves';
  blurb: string;
}

export const MOONS: Moon[] = [
  { name: 'Wolf Moon', item: 'moon_wolf', weather: 'snow', blurb: 'Wolves howl across the frozen hills.' },
  { name: 'Snow Moon', item: 'moon_snow', weather: 'snow', blurb: 'Deep snow muffles every sound.' },
  { name: 'Worm Moon', item: 'moon_worm', weather: 'rain', blurb: 'The ground thaws under a soft rain.' },
  { name: 'Pink Moon', item: 'moon_pink', weather: 'petals', blurb: 'The first blossoms drift on the wind.' },
  { name: 'Flower Moon', item: 'moon_flower', weather: 'petals', blurb: 'Night flowers open in the tall grass.' },
  { name: 'Strawberry Moon', item: 'moon_berry', weather: 'fireflies', blurb: 'Warm nights, berries ripen in the dark.' },
  { name: 'Buck Moon', item: 'moon_buck', weather: 'fireflies', blurb: 'A stag watches from the ridge.' },
  { name: 'Sturgeon Moon', item: 'moon_sturgeon', weather: 'fireflies', blurb: 'The river runs full under the moon.' },
  { name: 'Harvest Moon', item: 'moon_harvest', weather: 'leaves', blurb: 'Late light over the gathered fields.' },
  { name: "Hunter's Moon", item: 'moon_hunter', weather: 'leaves', blurb: 'A hooded hunter walks the bare woods.' },
  { name: 'Beaver Moon', item: 'moon_beaver', weather: 'leaves', blurb: 'The last leaves fall into still water.' },
  { name: 'Cold Moon', item: 'moon_cold', weather: 'snow', blurb: 'The longest nights of the year.' },
];

/** Season item is earned by reaching this rank during the month. */
export const SEASON_ITEM_RANK = 3; // Adventurer

export interface Boss {
  id: string;
  name: string;
  item: string;
  taunt: string;
  laugh: string;
}

export const BOSSES: Boss[] = [
  { id: 'shadow', name: 'The Shadow of Procrastination', item: 'boss_shadow', taunt: 'Tomorrow... always tomorrow...', laugh: 'See? You can always start next week.' },
  { id: 'crowking', name: 'The Crow King', item: 'boss_crow', taunt: 'My crows have counted your idle hours.', laugh: 'Caw! The crown stays with me.' },
  { id: 'fog', name: 'The Fog of Distraction', item: 'boss_fog', taunt: 'Just one more tab... just one more video...', laugh: 'You lost your way in the fog.' },
  { id: 'scarecrow', name: 'The Hollow Scarecrow', item: 'boss_scarecrow', taunt: 'Nothing inside... just like your notes.', laugh: 'Straw lasts longer than resolve.' },
  { id: 'owl', name: 'The Sleepless Owl', item: 'boss_owl', taunt: 'Whooo studies at this hour? Not you.', laugh: 'Whoo-hoo-hoo! Sleep well, then.' },
  { id: 'willow', name: 'The Wailing Willow', item: 'boss_willow', taunt: 'Weep with me... it is all too hard...', laugh: 'My branches grow while you rest.' },
  { id: 'thief', name: 'The Lantern Thief', item: 'boss_thief', taunt: 'I steal the light of unfinished chapters.', laugh: 'Your lantern is mine for another week.' },
  { id: 'moth', name: 'The Moth Swarm', item: 'boss_moth', taunt: 'We eat the hours you leave lying around.', laugh: 'Flutter, flutter... we feast again.' },
];

export const BOSS: Record<string, Boss> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
export const BOSS_REWARD = { coins: 300, exp: 100, duplicateCoins: 150 };

export type ChallengeMetric =
  | 'focusMin'
  | 'focusDays'
  | 'sets'
  | 'chapters'
  | 'notes'
  | 'missions'
  | 'sidequests'
  | 'bosses'
  | 'streak';

export interface ChallengeDef {
  id: string;
  label: string;
  metric: ChallengeMetric;
  target: number;
  coins: number;
  group: 0 | 1 | 2;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'focus30', label: 'Focus 30 hours', metric: 'focusMin', target: 1800, coins: 300, group: 0 },
  { id: 'focus20', label: 'Focus 20 hours', metric: 'focusMin', target: 1200, coins: 200, group: 0 },
  { id: 'days20', label: 'Focus on 20 different days', metric: 'focusDays', target: 20, coins: 300, group: 0 },
  { id: 'sets10', label: 'Complete 10 full Pomodoro sets', metric: 'sets', target: 10, coins: 250, group: 0 },
  { id: 'chapters15', label: 'Finish 15 chapters', metric: 'chapters', target: 15, coins: 250, group: 1 },
  { id: 'chapters25', label: 'Finish 25 chapters', metric: 'chapters', target: 25, coins: 400, group: 1 },
  { id: 'notes10', label: 'Write 10 "What I learned" notes', metric: 'notes', target: 10, coins: 200, group: 1 },
  { id: 'missions2', label: 'Complete 2 missions', metric: 'missions', target: 2, coins: 200, group: 1 },
  { id: 'quests5', label: 'Finish 5 side quests', metric: 'sidequests', target: 5, coins: 150, group: 1 },
  { id: 'bosses3', label: 'Beat 3 bosses', metric: 'bosses', target: 3, coins: 300, group: 2 },
  { id: 'bosses2', label: 'Beat 2 bosses', metric: 'bosses', target: 2, coins: 200, group: 2 },
  { id: 'streak14', label: 'Reach a 14-day streak', metric: 'streak', target: 14, coins: 250, group: 2 },
];

export const CHALLENGE: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export const BUILT_IN_PRESETS: Preset[] = [
  { id: 'classic', name: 'Classic', work: 25, short: 5, long: 25, sessions: 4, builtIn: true },
  { id: 'deep', name: 'Deep work', work: 50, short: 10, long: 30, sessions: 4, builtIn: true },
  { id: 'quick', name: 'Quick', work: 15, short: 3, long: 15, sessions: 4, builtIn: true },
];

export const POMODORO_LIMITS = {
  work: [1, 180],
  short: [1, 60],
  long: [1, 90],
  sessions: [1, 10],
} as const;

export interface ProjectIconDef {
  id: ProjectIcon;
  label: string;
  building: string;
  buildingName: string;
}

export const PROJECT_ICONS: ProjectIconDef[] = [
  { id: 'shield', label: 'Security', building: 'tower', buildingName: 'Server tower' },
  { id: 'code', label: 'Code', building: 'workshop', buildingName: 'Workshop' },
  { id: 'note', label: 'Music', building: 'stage', buildingName: 'Stage' },
  { id: 'dumbbell', label: 'Fitness', building: 'yard', buildingName: 'Training yard' },
  { id: 'book', label: 'Reading', building: 'library', buildingName: 'Library' },
  { id: 'globe', label: 'Languages', building: 'observatory', buildingName: 'Observatory' },
  { id: 'brush', label: 'Art', building: 'atelier', buildingName: 'Atelier' },
  { id: 'flask', label: 'Science', building: 'alchemy', buildingName: 'Alchemist tower' },
  { id: 'abacus', label: 'Math', building: 'clocktower', buildingName: 'Clock tower' },
  { id: 'leaf', label: 'Nature', building: 'greenhouse', buildingName: 'Greenhouse' },
];

export const PROJECT_ICON: Record<string, ProjectIconDef> = Object.fromEntries(PROJECT_ICONS.map((p) => [p.id, p]));

export const SLOT_LABEL: Record<Slot, string> = {
  hair: 'Hairstyle',
  hairShade: 'Hair shade',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  head: 'Head',
  face: 'Face',
  neck: 'Neck',
  wrist: 'Wrists',
  held: 'In hand',
  back: 'On the back',
  prop: 'Beside you',
  background: 'Background',
};

/** Slots that can be left empty */
export const OPTIONAL_SLOTS: Slot[] = ['head', 'face', 'neck', 'wrist', 'held', 'back', 'prop'];
