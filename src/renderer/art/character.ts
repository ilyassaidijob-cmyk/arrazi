// The player's character: a small Terraria-style paper doll (about 2 tiles wide, 3 tall)
// with separate layers for body, hair, top, bottom, shoes and accessories.
import { ITEM } from '../core/catalog';
import type { Look } from '../core/types';
import { PixBuf } from './pixels';

export type PoseName = 'stand' | 'walk' | 'sit' | 'stretch' | 'jump' | 'sleepy' | 'attack' | 'lift' | 'guitar' | 'type';

export const POSE_FRAMES: Record<PoseName, number> = {
  stand: 2,
  walk: 4,
  sit: 3,
  stretch: 2,
  jump: 3,
  sleepy: 2,
  attack: 2,
  lift: 2,
  guitar: 2,
  type: 2,
};

export const CHAR_W = 32;
export const CHAR_H = 32;
/** y of the ground line inside the character canvas (the row under the shoes) */
export const CHAR_GROUND = 30;

type R = [number, number, number, number];
interface Limb {
  upper: R;
  lower: R;
  end: R;
}
interface Geom {
  hx: number;
  hy: number;
  eyes: 'open' | 'closed' | 'down' | 'happy';
  torso: R;
  armB: Limb | null;
  armF: Limb;
  legB: Limb;
  legF: Limb;
  toeB: [number, number] | null;
  toeF: [number, number];
  hand: [number, number];
  held: 'hang' | 'lap' | 'up' | 'none';
  extra?: 'book' | 'sword-up' | 'sword' | 'dumbbell-chest' | 'dumbbell-up' | 'guitar' | 'laptop';
  frame: number;
}

const shiftR = (r: R, dx: number, dy: number): R => [r[0] + dx, r[1] + dy, r[2], r[3]];
const shiftL = (l: Limb, dx: number, dy: number): Limb => ({
  upper: shiftR(l.upper, dx, dy),
  lower: shiftR(l.lower, dx, dy),
  end: shiftR(l.end, dx, dy),
});

function base(): Geom {
  return {
    hx: 12,
    hy: 8,
    eyes: 'open',
    torso: [13, 15, 6, 6],
    armB: { upper: [11, 15, 2, 2], lower: [11, 17, 2, 3], end: [11, 20, 2, 1] },
    armF: { upper: [19, 15, 2, 2], lower: [19, 17, 2, 3], end: [19, 20, 2, 1] },
    legB: { upper: [13, 21, 3, 3], lower: [13, 24, 3, 4], end: [13, 28, 3, 2] },
    legF: { upper: [16, 21, 3, 3], lower: [16, 24, 3, 4], end: [16, 28, 3, 2] },
    toeB: [16, 29],
    toeF: [19, 29],
    hand: [20, 20],
    held: 'hang',
    frame: 0,
  };
}

function sitBase(): Geom {
  const g = base();
  g.hy = 11;
  g.eyes = 'down';
  g.torso = [13, 18, 6, 6];
  g.armB = { upper: [11, 18, 2, 2], lower: [11, 20, 2, 3], end: [11, 23, 2, 1] };
  g.armF = { upper: [19, 18, 2, 2], lower: [19, 20, 2, 2], end: [19, 21, 2, 1] };
  g.legF = { upper: [14, 24, 7, 2], lower: [19, 26, 3, 2], end: [19, 28, 3, 2] };
  g.legB = shiftL(g.legF, -1, 0);
  g.toeF = [22, 29];
  g.toeB = null;
  g.hand = [22, 20];
  g.held = 'lap';
  return g;
}

function geom(pose: PoseName, frame: number): Geom {
  const f = frame % POSE_FRAMES[pose];
  let g = base();
  g.frame = f;
  switch (pose) {
    case 'stand':
      if (f === 1) g.hy = 9;
      break;
    case 'walk':
      if (f === 0 || f === 2) {
        const fwd = f === 0 ? g.legF : g.legB;
        const back = f === 0 ? g.legB : g.legF;
        back.lower = shiftR(back.lower, -1, 0);
        back.end = shiftR(back.end, -1, 0);
        fwd.lower = shiftR(fwd.lower, 1, 0);
        fwd.end = shiftR(fwd.end, 1, 0);
        g.toeB = [g.legB.end[0] + 3, 29];
        g.toeF = [g.legF.end[0] + 3, 29];
        const swing = f === 0 ? -1 : 1;
        g.armF.lower = shiftR(g.armF.lower, swing, 0);
        g.armF.end = shiftR(g.armF.end, swing, 0);
        g.hand = [20 + swing, 20];
      } else g.hy = 7;
      break;
    case 'sit':
      g = sitBase();
      g.frame = f;
      g.extra = 'book';
      if (f === 1) g.hy = 12;
      break;
    case 'type':
      g = sitBase();
      g.frame = f;
      g.extra = 'laptop';
      g.armF = { upper: [19, 18, 2, 2], lower: [19, 20, 2, 2], end: [19 + (f ? 1 : 0), 22, 2, 1] };
      g.hand = [20, 22];
      g.held = 'none';
      break;
    case 'stretch':
      g.eyes = 'closed';
      if (f === 0) {
        g.armB = { upper: [10, 13, 2, 3], lower: [9, 8, 2, 5], end: [9, 7, 2, 1] };
        g.armF = { upper: [20, 13, 2, 3], lower: [21, 8, 2, 5], end: [21, 7, 2, 1] };
        g.hand = [22, 7];
      } else {
        g.armB = { upper: [9, 15, 3, 2], lower: [6, 15, 3, 2], end: [5, 15, 1, 2] };
        g.armF = { upper: [19, 15, 3, 2], lower: [22, 15, 3, 2], end: [25, 15, 1, 2] };
        g.hand = [25, 16];
      }
      g.held = 'none';
      break;
    case 'jump':
      g.eyes = 'happy';
      if (f === 0) {
        g.hy = 9;
        g.torso = [13, 16, 6, 6];
        g.armB = shiftL(g.armB!, 0, 1);
        g.armF = shiftL(g.armF, 0, 1);
        g.legB = { upper: [13, 22, 3, 2], lower: [13, 24, 3, 4], end: [13, 28, 3, 2] };
        g.legF = { upper: [16, 22, 3, 2], lower: [16, 24, 3, 4], end: [16, 28, 3, 2] };
        g.hand = [20, 21];
      } else if (f === 1) {
        g.hy = 5;
        g.torso = [13, 12, 6, 6];
        g.armB = { upper: [10, 10, 2, 3], lower: [9, 7, 2, 3], end: [9, 6, 2, 1] };
        g.armF = { upper: [20, 10, 2, 3], lower: [21, 7, 2, 3], end: [21, 6, 2, 1] };
        g.legB = { upper: [13, 18, 3, 3], lower: [12, 21, 3, 3], end: [12, 24, 3, 2] };
        g.legF = { upper: [16, 18, 3, 3], lower: [17, 21, 3, 3], end: [17, 24, 3, 2] };
        g.toeB = [15, 25];
        g.toeF = [20, 25];
        g.hand = [22, 6];
        g.held = 'none';
      }
      break;
    case 'sleepy':
      g.eyes = 'closed';
      g.hy = f === 0 ? 9 : 10;
      break;
    case 'attack':
      g.held = 'none';
      g.eyes = 'open';
      if (f === 0) {
        g.armF = { upper: [19, 13, 2, 3], lower: [19, 10, 2, 3], end: [19, 9, 2, 1] };
        g.extra = 'sword-up';
      } else {
        g.armF = { upper: [19, 15, 3, 2], lower: [22, 15, 3, 2], end: [25, 15, 1, 2] };
        g.legF.lower = shiftR(g.legF.lower, 1, 0);
        g.legF.end = shiftR(g.legF.end, 1, 0);
        g.toeF = [20, 29];
        g.legB.lower = shiftR(g.legB.lower, -1, 0);
        g.legB.end = shiftR(g.legB.end, -1, 0);
        g.toeB = [15, 29];
        g.extra = 'sword';
      }
      break;
    case 'lift':
      g.held = 'none';
      if (f === 0) {
        g.armB = { upper: [11, 15, 2, 2], lower: [11, 13, 2, 2], end: [11, 12, 2, 1] };
        g.armF = { upper: [19, 15, 2, 2], lower: [19, 13, 2, 2], end: [19, 12, 2, 1] };
        g.extra = 'dumbbell-chest';
      } else {
        g.eyes = 'closed';
        g.armB = { upper: [10, 13, 2, 3], lower: [9, 8, 2, 5], end: [9, 7, 2, 1] };
        g.armF = { upper: [20, 13, 2, 3], lower: [21, 8, 2, 5], end: [21, 7, 2, 1] };
        g.extra = 'dumbbell-up';
      }
      break;
    case 'guitar':
      g.held = 'none';
      g.extra = 'guitar';
      g.armB = null;
      g.armF = { upper: [19, 15, 2, 2], lower: [17, 17, 2, 2], end: [16, 19 + (f ? 1 : 0), 2, 1] };
      break;
  }
  return g;
}

// ------------------------------------------------------------------ clothing definitions

interface TopDef {
  c: number; // main shade
  s: 'none' | 'short' | 'long';
  sc?: number; // sleeve shade if different
  rows?: number; // extends over the legs (coats, robes)
  hood?: boolean; // hood down, behind the neck
  hoodUp?: boolean; // hood over the hair
  detail?: (b: PixBuf, g: Geom) => void;
}

const TOPS: Record<string, TopDef> = {
  top_tunic: {
    c: 2,
    s: 'short',
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      b.hline(x, x + w - 1, y + h - 2, 1);
      b.set(x + 3, y + h - 2, 3);
      b.set(x + 2, y, 1);
      b.set(x + 3, y + 1, 1);
      b.set(x + 4, y, 1);
    },
  },
  gym_tank: {
    c: 1,
    s: 'none',
    detail: (b, g) => {
      const [x, y, w] = g.torso;
      b.set(x, y, 3);
      b.set(x + w - 1, y, 3);
      b.hline(x + 1, x + w - 2, y + 2, 2);
    },
  },
  gym_hoodie: {
    c: 2,
    s: 'long',
    hood: true,
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      b.set(x + 2, y + 1, 4);
      b.set(x + 3, y + 1, 4);
      b.set(x + 2, y + 2, 3);
      b.set(x + 3, y + 2, 3);
      b.hline(x + 1, x + w - 2, y + h - 2, 1);
      b.hline(x, x + w - 1, y + h - 1, 1);
    },
  },
  music_tee: {
    c: 1,
    s: 'short',
    detail: (b, g) => {
      const [x, y] = g.torso;
      // band logo: a small lightning bolt
      b.set(x + 3, y + 1, 4);
      b.set(x + 2, y + 2, 4);
      b.set(x + 3, y + 2, 4);
      b.set(x + 3, y + 3, 4);
      b.set(x + 2, y + 4, 3);
    },
  },
  music_jacket: {
    c: 1,
    s: 'long',
    detail: (b, g) => {
      const [x, y, , h] = g.torso;
      b.vline(x + 3, y, y + h - 1, 3);
      b.vline(x + 2, y + 1, y + h - 1, 0);
      b.set(x + 2, y, 2);
      b.set(x + 4, y, 2);
      b.set(x + 4, y + 1, 2);
      b.set(x + 5, y + 3, 2);
    },
  },
  cyber_hoodie: {
    c: 1,
    s: 'long',
    hood: true,
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      b.set(x + 2, y + 1, 2);
      b.set(x + 2, y + 2, 2);
      b.set(x + 4, y + 1, 2);
      b.set(x + 4, y + 2, 2);
      b.hline(x + 1, x + w - 2, y + h - 2, 0);
    },
  },
  rank_coat: {
    c: 1,
    s: 'long',
    rows: 3,
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      for (let j = 1; j < h + 3; j += 2) b.set(x + 3, y + j, 4);
      b.hline(x, x + w - 1, y + h - 2, 2);
      b.hline(g.armF.upper[0], g.armF.upper[0] + 1, g.armF.upper[1], 4);
      if (g.armB) b.hline(g.armB.upper[0], g.armB.upper[0] + 1, g.armB.upper[1], 4);
    },
  },
  rank_robe: {
    c: 2,
    s: 'long',
    rows: 7,
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      for (let j = 0; j < h; j++) b.set(x + Math.min(w - 1, j), y + j, 4);
      b.hline(x - 1, x + w, y + h + 6, 3);
    },
  },
  prestige_mantle: {
    c: 3,
    s: 'long',
    detail: (b, g) => {
      const [x, y, w] = g.torso;
      b.hline(x - 1, x + w, y, 4);
      b.hline(x - 1, x + w, y + 1, 4);
      b.set(x + 1, y + 1, 2);
      b.set(x + 4, y, 2);
      b.set(x + 2, y + 3, 4);
      b.set(x + 4, y + 4, 4);
    },
  },
  prestige_armor: {
    c: 4,
    s: 'long',
    sc: 3,
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      b.hline(x + 1, x + w - 2, y + 2, 3);
      b.vline(x + 3, y + 3, y + h - 1, 3);
      b.hline(x, x + w - 1, y + h - 1, 2);
      b.rect(g.armF.upper[0], g.armF.upper[1], 2, 1, 4);
      if (g.armB) b.rect(g.armB.upper[0], g.armB.upper[1], 2, 1, 4);
    },
  },
  moon_hunter: {
    c: 1,
    s: 'long',
    rows: 5,
    hoodUp: true,
    detail: (b, g) => {
      const [x, y] = g.torso;
      b.set(x + 3, y, 3);
      b.vline(x + 3, y + 1, y + 9, 0);
    },
  },
  moon_cold: {
    c: 3,
    s: 'long',
    detail: (b, g) => {
      const [x, y, w, h] = g.torso;
      for (let i = -1; i <= w; i++) {
        b.set(x + i, y, 4);
        if (i % 2 === 0) b.set(x + i, y + 1, 4);
      }
      b.hline(x, x + w - 1, y + h - 1, 4);
      b.vline(x + 3, y + 2, y + h - 2, 2);
    },
  },
  boss_owl: {
    c: 2,
    s: 'long',
    rows: 2,
    detail: (b, g) => {
      const [x, y, , h] = g.torso;
      for (let j = 1; j < h + 2; j += 2) {
        b.set(x + 1, y + j, 3);
        b.set(x + 2, y + j + 1, 3);
        b.set(x + 4, y + j, 3);
        b.set(x + 3, y + j + 1, 3);
      }
    },
  },
};

interface BottomDef {
  c: number;
  stripe?: number;
  cuff?: number;
}
const BOTTOMS: Record<string, BottomDef> = {
  bottom_trousers: { c: 1 },
  gym_joggers: { c: 2, stripe: 3, cuff: 1 },
};

interface ShoeDef {
  c: number;
  sole: number;
  tall?: number;
  mark?: number;
}
const SHOES: Record<string, ShoeDef> = {
  shoes_boots: { c: 2, sole: 1 },
  gym_shoes: { c: 4, sole: 2, mark: 2 },
  rank_boots: { c: 2, sole: 1, tall: 2, mark: 4 },
  moon_worm: { c: 3, sole: 2, tall: 2 },
};

const SKIN = 3;

// Hair masks: 12 x 14 grid starting at (hx - 2, hy - 4). B = behind the head, F = front, D = darker front.
const HAIR: Record<string, string[]> = {
  hair_messy: [
    '............',
    '....F.F..F..',
    '...FFFFFFFF.',
    '..FFFFFFFFFF',
    '.FFFFFFFFFFF',
    '.FFFFFFFFFF.',
    '.FFFDFF.FDF.',
    '.FF.........',
    '.FF.........',
    '..F.........',
  ],
  hair_sidepart: [
    '............',
    '............',
    '....FFFFFF..',
    '..FFFFFFFFF.',
    '.FFFFFFFFFFF',
    '.FFFFFFDDFFF',
    '.FFF.....FF.',
    '.FF.........',
    '.FF.........',
  ],
  hair_bob: [
    '............',
    '............',
    '....FFFF....',
    '..FFFFFFFF..',
    '.FFFFFFFFFF.',
    '.FFFFFFFFFFF',
    '.FFFDDDDDFFF',
    '.FF......FF.',
    '.FF......F..',
    '.FF.........',
    '.BB.........',
  ],
  hair_short: [
    '............',
    '............',
    '............',
    '...FFFFFF...',
    '..FFFFFFFF..',
    '..FFFFFFFFF.',
    '..FFD...FF..',
    '..F.........',
  ],
  hair_buzz: [
    '............',
    '............',
    '............',
    '............',
    '...DDDDDD...',
    '..DDDDDDDD..',
    '..DD........',
  ],
  hair_long: [
    '............',
    '............',
    '....FFFF....',
    '..FFFFFFFF..',
    '.FFFFFFFFFF.',
    '.FFFFFFFFFFF',
    '.FFFDFFDDFF.',
    '.FF......F..',
    '.FF.........',
    '.BB.........',
    '.BB.........',
    'BBB.........',
    'BBB.........',
    'BB..........',
  ],
  hair_curly: [
    '............',
    '...F.FF.F...',
    '..FFDFFDFF..',
    '.FDFFDFFDFF.',
    'FFFFDFFDFFFF',
    'FDFFFFDFFDFF',
    '.FFDF.FD.FF.',
    'FFD.........',
    'FF..........',
    '.F..........',
  ],
  hair_tied: [
    '............',
    '............',
    '............',
    '...FFFFFF...',
    '..FFFFFFFF..',
    'BFFFFFFFFFF.',
    'BBFDF..FDF..',
    'BBF.........',
    '.B..........',
    '.B..........',
  ],
};

// ------------------------------------------------------------------ accessories

type Draw = (b: PixBuf, g: Geom, look: Look) => void;

const HEAD_ITEMS: Record<string, Draw> = {
  gym_headband: (b, g) => {
    b.hline(g.hx - 1, g.hx + 8, g.hy + 1, 4);
    b.set(g.hx - 2, g.hy + 2, 4);
    b.set(g.hx - 2, g.hy + 3, 4);
  },
  music_headphones: (b, g) => {
    b.hline(g.hx + 1, g.hx + 6, g.hy - 2, 1);
    b.set(g.hx, g.hy - 1, 1);
    b.set(g.hx + 7, g.hy - 1, 1);
    b.rect(g.hx - 1, g.hy, 1, 4, 1);
    b.rect(g.hx - 1, g.hy + 2, 2, 3, 2);
    b.set(g.hx + 8, g.hy + 1, 1);
  },
  music_beanie: (b, g) => {
    b.rect(g.hx, g.hy - 2, 8, 3, 2);
    b.rect(g.hx + 1, g.hy - 3, 6, 1, 2);
    b.hline(g.hx - 1, g.hx + 8, g.hy + 1, 1);
    b.set(g.hx + 3, g.hy - 4, 3);
    b.set(g.hx + 4, g.hy - 4, 3);
    b.set(g.hx + 2, g.hy - 1, 1);
    b.set(g.hx + 5, g.hy - 1, 1);
  },
  rank_circlet: (b, g) => {
    b.hline(g.hx, g.hx + 7, g.hy + 1, 3);
    b.set(g.hx + 6, g.hy, 4);
    b.set(g.hx + 6, g.hy + 1, 4);
  },
  rank_crown: (b, g) => {
    b.ascii(g.hx, g.hy - 4, ['.4..4..4', '.44.44.4', '44444444', '43434343'], {});
  },
  prestige_halo: (b, g) => {
    b.hline(g.hx + 1, g.hx + 6, g.hy - 6, 4);
    b.set(g.hx, g.hy - 5, 4);
    b.set(g.hx + 7, g.hy - 5, 4);
    b.hline(g.hx + 1, g.hx + 6, g.hy - 4, 3);
  },
  moon_pink: (b, g) => {
    b.ascii(g.hx - 1, g.hy - 2, ['.4.3.4.3.4', '4343434343']);
  },
  moon_buck: (b, g) => {
    b.ascii(g.hx - 2, g.hy - 6, ['3.3.....3.3.', '.33.....33..', '..3.3.3.3...', '..33...33...', '...3...3....']);
  },
  moon_harvest: (b, g) => {
    b.rect(g.hx + 1, g.hy - 3, 6, 3, 3);
    b.hline(g.hx + 1, g.hx + 6, g.hy - 1, 2);
    b.hline(g.hx - 2, g.hx + 9, g.hy, 3);
    b.set(g.hx - 3, g.hy + 1, 3);
    b.set(g.hx + 10, g.hy + 1, 3);
  },
  moon_beaver: (b, g) => {
    b.rect(g.hx, g.hy - 3, 8, 4, 2);
    b.hline(g.hx - 1, g.hx + 8, g.hy, 3);
    b.rect(g.hx - 1, g.hy + 1, 2, 4, 3);
    for (let i = 0; i < 8; i += 2) b.set(g.hx + i, g.hy - 3, 3);
  },
  boss_crow: (b, g) => {
    b.ascii(g.hx, g.hy - 4, ['1..1..1.', '11.11.11', '11141111', '11111111']);
    b.set(g.hx - 1, g.hy - 5, 1);
    b.set(g.hx - 1, g.hy - 4, 1);
  },
  boss_scarecrow: (b, g) => {
    b.ascii(g.hx - 2, g.hy - 7, [
      '.......22...',
      '......222...',
      '.....2222...',
      '....22322...',
      '...222222...',
      '..22222222..',
      '222222222222',
    ]);
  },
};

const FACE_ITEMS: Record<string, Draw> = {
  cyber_mask: (b, g) => {
    b.rect(g.hx + 2, g.hy + 4, 6, 3, 1);
    b.set(g.hx + 1, g.hy + 4, 1);
    b.hline(g.hx + 3, g.hx + 6, g.hy + 5, 0);
  },
  cyber_glasses: (b, g) => {
    b.hline(g.hx + 1, g.hx + 8, g.hy + 3, 0);
    b.rect(g.hx + 2, g.hy + 3, 3, 2, 2);
    b.rect(g.hx + 5, g.hy + 3, 3, 2, 2);
    b.set(g.hx + 3, g.hy + 3, 4);
    b.set(g.hx + 6, g.hy + 4, 3);
    b.set(g.hx + 7, g.hy + 3, 3);
    b.set(g.hx + 2, g.hy + 4, 3);
  },
  prestige_visor: (b, g) => {
    b.rect(g.hx + 1, g.hy + 3, 8, 2, 1);
    b.hline(g.hx + 3, g.hx + 7, g.hy + 3, 4);
  },
  boss_thief: (b, g) => {
    b.rect(g.hx + 1, g.hy + 2, 8, 3, 0);
    b.set(g.hx + 3, g.hy + 3, 3);
    b.set(g.hx + 6, g.hy + 3, 3);
    b.set(g.hx - 1, g.hy + 3, 0);
    b.set(g.hx - 2, g.hy + 4, 0);
  },
};

const NECK_ITEMS: Record<string, Draw> = {
  cyber_usb: (b, g) => {
    const [x, y] = g.torso;
    b.set(x + 1, y, 2);
    b.set(x + 2, y + 1, 2);
    b.set(x + 4, y, 2);
    b.set(x + 3, y + 1, 2);
    b.rect(x + 2, y + 2, 2, 2, 4);
    b.set(x + 2, y + 3, 2);
  },
  rank_scarf: (b, g) => {
    const [x, y, w] = g.torso;
    b.hline(x - 1, x + w, y, 3);
    b.set(x, y + 1, 3);
    b.set(x, y + 2, 3);
    b.set(x + 1, y + 1, 2);
  },
  moon_snow: (b, g) => {
    const [x, y, w] = g.torso;
    b.hline(x - 1, x + w, y, 4);
    b.hline(x - 1, x + w, y + 1, 4);
    b.set(x + 1, y + 1, 3);
    b.set(x + 3, y + 1, 3);
    b.vline(x - 1, y + 2, y + 4, 4);
    b.set(x - 1, y + 3, 3);
  },
};

const WRIST_ITEMS: Record<string, Draw> = {
  gym_wraps: (b, g) => {
    const w = (l: Limb | null) => l && b.rect(l.lower[0], l.lower[1] + l.lower[3] - 1, l.lower[2], 1, 4);
    w(g.armB);
    w(g.armF);
  },
  rank_bracers: (b, g) => {
    const w = (l: Limb | null) => {
      if (!l) return;
      b.rect(l.lower[0], l.lower[1], l.lower[2], l.lower[3], 2);
      b.set(l.lower[0], l.lower[1] + 1, 4);
    };
    w(g.armB);
    w(g.armF);
  },
};

const HELD_ITEMS: Record<string, Draw> = {
  gym_dumbbell: (b, g) => {
    const [x, y] = g.hand;
    if (g.held === 'lap') return;
    b.hline(x - 2, x + 2, y + 1, 2);
    b.rect(x - 3, y, 1, 3, 1);
    b.rect(x + 3, y, 1, 3, 1);
  },
  cyber_laptop: (b, g) => {
    const [x, y] = g.hand;
    if (g.held === 'lap') return;
    b.rect(x - 1, y, 6, 1, 2);
    b.rect(x, y - 4, 1, 4, 2);
    b.set(x, y - 2, 4);
  },
  moon_berry: (b, g) => {
    const [x, y] = g.hand;
    if (g.held === 'lap') return;
    b.ascii(x - 1, y - 1, ['.2222.', '242424', '.2222.']);
  },
  boss_fog: (b, g) => {
    const [x, y] = g.hand;
    if (g.held === 'lap') return;
    b.ascii(x - 1, y, ['.1.', '141', '343', '.1.']);
  },
  boss_willow: (b, g) => {
    const [x, y] = g.hand;
    if (g.held === 'lap') return;
    b.vline(x + 1, y - 12, y + 7, 2);
    b.ascii(x - 1, y - 15, ['.3.3.', '33333', '.333.']);
  },
};

const BACK_ITEMS: Record<string, Draw> = {
  music_guitar: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 4, y - 7, ['.......11', '......1..', '.....1...', '....1....', '...1.....']);
    b.ascii(x - 5, y - 2, ['..222...', '.22222..', '2222222.', '2221222.', '.22222..', '..222...']);
  },
  rank_satchel: (b, g) => {
    const [x, y, w] = g.torso;
    b.rect(x - 3, y + 2, 3, 4, 2);
    b.set(x - 2, y + 3, 3);
    for (let i = 0; i < w; i++) b.set(x + i, y + Math.min(4, i), 1);
  },
  rank_cape: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 3, y, ['.2222222', '22222222', '22222222', '22222222', '22222222', '2222222.', '2222222.', '222222..', '22.22...', '2...2...']);
  },
  prestige_cloak: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 3, y, ['.1111111', '11141111', '11111111', '14111141', '11111111', '1111411.', '1111111.', '141111..', '11.11...', '1...1...']);
  },
  moon_flower: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 3, y, ['.3333333', '33433333', '33333343', '34333333', '33334333', '3333333.', '3433333.', '333343..', '33.33...', '3...3...']);
  },
  moon_sturgeon: (b, g) => {
    const [x, y] = g.torso;
    b.line(x - 2, y + 7, x + 9, y - 9, 2);
    b.set(x + 10, y - 9, 3);
    b.vline(x + 10, y - 8, y - 4, 3);
  },
  boss_shadow: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 4, y - 1, ['..00000000', '.000000000', '0000000000', '0000000000', '000000000.', '000000000.', '00000000..', '0000000...', '00.000....', '0...0.....', '0.........']);
  },
  boss_moth: (b, g) => {
    const [x, y] = g.torso;
    b.ascii(x - 6, y - 4, ['33.......', '333......', '3233.....', '33223....', '.3333....', '..333....', '.3323....', '..33.....']);
    b.ascii(x + 6, y - 4, ['......33', '.....333', '....3323', '...32233', '....3333', '....333.', '....3233', '.....33.']);
  },
};

// ------------------------------------------------------------------ renderer

const darker = (c: number) => Math.max(0, c - 1);

function fill(b: PixBuf, r: R, c: number) {
  b.rect(r[0], r[1], r[2], r[3], c);
}

function drawArm(b: PixBuf, l: Limb, top: TopDef, back: boolean) {
  const sleeve = top.sc ?? top.c;
  const c = back ? darker(sleeve) : sleeve;
  const skin = back ? 2 : SKIN;
  fill(b, l.upper, top.s === 'none' ? skin : c);
  fill(b, l.lower, top.s === 'long' ? c : skin);
  fill(b, l.end, skin);
}

function drawLeg(b: PixBuf, l: Limb, bottom: BottomDef, shoe: ShoeDef, toe: [number, number] | null, back: boolean) {
  const bc = back ? darker(bottom.c) : bottom.c;
  fill(b, l.upper, bc);
  fill(b, l.lower, bc);
  if (bottom.stripe !== undefined && !back) {
    b.vline(l.upper[0], l.upper[1], l.upper[1] + l.upper[3] - 1, bottom.stripe);
    b.vline(l.lower[0], l.lower[1], l.lower[1] + l.lower[3] - 1, bottom.stripe);
  }
  if (bottom.cuff !== undefined) b.hline(l.lower[0], l.lower[0] + l.lower[2] - 1, l.lower[1] + l.lower[3] - 1, bottom.cuff);
  const sc = back ? darker(shoe.c) : shoe.c;
  if (shoe.tall) b.rect(l.lower[0], l.lower[1] + l.lower[3] - shoe.tall, l.lower[2], shoe.tall, sc);
  fill(b, l.end, sc);
  b.hline(l.end[0], l.end[0] + l.end[2] - 1, l.end[1] + l.end[3] - 1, back ? darker(shoe.sole) : shoe.sole);
  if (toe) b.set(toe[0], toe[1], back ? darker(shoe.sole) : shoe.sole);
  if (shoe.mark !== undefined && !back) b.set(l.end[0] + 1, l.end[1], shoe.mark);
}

function drawHead(b: PixBuf, g: Geom, look: Look) {
  const { hx, hy } = g;
  b.rect(hx + 1, hy, 6, 7, SKIN);
  b.rect(hx, hy + 1, 8, 5, SKIN);
  const e1 = hx + 3;
  const e2 = hx + 6;
  switch (g.eyes) {
    case 'open':
      b.vline(e1, hy + 3, hy + 4, 0);
      b.vline(e2, hy + 3, hy + 4, 0);
      if (look.body === 'girl') {
        b.set(e1 - 1, hy + 3, 0);
        b.set(e2 + 1, hy + 3, 0);
      }
      break;
    case 'down':
      b.set(e1, hy + 4, 0);
      b.set(e2, hy + 4, 0);
      if (look.body === 'girl') {
        b.set(e1 - 1, hy + 4, 0);
        b.set(e2 + 1, hy + 4, 0);
      }
      break;
    case 'closed':
      b.set(e1, hy + 4, 1);
      b.set(e2, hy + 4, 1);
      b.set(e1 - 1, hy + 4, 2);
      b.set(e2 + 1, hy + 4, 2);
      break;
    case 'happy':
      b.set(e1 - 1, hy + 4, 1);
      b.set(e1, hy + 3, 0);
      b.set(e2, hy + 3, 0);
      b.set(e2 + 1, hy + 4, 1);
      b.set(hx + 4, hy + 5, 0);
      b.set(hx + 5, hy + 5, 0);
      b.set(hx + 4, hy + 6, 2);
      break;
  }
  if (look.body === 'girl' && g.eyes !== 'happy') b.set(hx + 7, hy + 5, 2);
}

function drawHair(b: PixBuf, g: Geom, look: Look, layer: 'back' | 'front') {
  const rows = HAIR[look.hair] ?? HAIR.hair_messy;
  const shade = ITEM[look.hairShade]?.shade ?? 2;
  const dark = shade === SKIN ? 2 : darker(shade);
  const map: Record<string, number> = layer === 'back' ? { B: darker(shade) } : { F: shade, D: dark };
  b.ascii(g.hx - 2, g.hy - 4, rows, map);
  if (layer === 'front' && shade === SKIN) {
    // keep silver hair readable on skin: shadow line along the hairline
    for (let x = g.hx; x < g.hx + 8; x++) {
      if (b.get(x, g.hy + 2) === SKIN && b.get(x, g.hy + 1) === shade) b.set(x, g.hy + 1, 2);
    }
  }
}

function drawHood(b: PixBuf, g: Geom, top: TopDef, up: boolean) {
  const { hx, hy } = g;
  if (up) {
    b.rect(hx - 1, hy - 2, 10, 2, top.c);
    b.rect(hx - 1, hy, 3, 7, top.c);
    b.rect(hx, hy - 3, 7, 1, top.c);
    b.rect(hx + 2, hy, 6, 1, top.c);
    b.set(hx + 8, hy, top.c);
    b.set(hx + 8, hy + 1, top.c);
    b.set(hx + 2, hy + 1, darker(top.c));
  } else {
    b.rect(hx - 1, hy + 5, 4, 3, darker(top.c));
  }
}

function drawExtra(b: PixBuf, g: Geom, look: Look) {
  const [hx, hy] = g.hand;
  switch (g.extra) {
    case 'book': {
      const bx = 18;
      const by = g.hy + 8;
      const flip = g.frame === 2;
      b.ascii(bx, by, [
        flip ? '.444..44.' : '.444.444.',
        flip ? '433343.4.' : '433343334',
        '444424444',
        '.2222222.',
      ]);
      if (flip) b.ascii(bx + 5, by - 2, ['.4', '44', '4.']);
      b.set(bx - 1, by + 2, SKIN);
      b.set(bx + 9, by + 2, SKIN);
      break;
    }
    case 'laptop':
      b.rect(18, 17, 6, 5, 2);
      b.rect(19, 18, 4, 3, 1);
      b.set(20, 19, 3);
      b.hline(15, 23, 22, 1);
      b.hline(15, 23, 23, 2);
      break;
    case 'sword-up':
      b.rect(hx - 1, hy - 2, 2, 2, 1);
      b.vline(hx, hy - 9, hy - 3, 4);
      b.vline(hx - 1, hy - 8, hy - 3, 3);
      b.hline(hx - 2, hx + 1, hy - 2, 2);
      break;
    case 'sword':
      b.rect(hx, hy - 1, 2, 2, 1);
      b.hline(hx + 2, hx + 7, hy - 1, 4);
      b.hline(hx + 2, hx + 6, hy, 3);
      b.vline(hx + 1, hy - 3, hy + 1, 2);
      break;
    case 'dumbbell-chest':
      b.hline(10, 21, 13, 2);
      b.rect(9, 11, 2, 5, 1);
      b.rect(21, 11, 2, 5, 1);
      break;
    case 'dumbbell-up':
      b.hline(7, 24, 6, 2);
      b.rect(6, 4, 2, 5, 1);
      b.rect(24, 4, 2, 5, 1);
      break;
    case 'guitar':
      b.ascii(10, 17, [
        '..222.........',
        '.22222........',
        '2221222.....11',
        '22222221111111',
        '.22222........',
        '..222.........',
      ]);
      b.set(23, 19, SKIN);
      b.set(23, 20, SKIN);
      break;
  }
  void look;
}

export interface CharacterOptions {
  outline?: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();

export function lookKey(look: Look): string {
  return [
    look.body,
    look.hair,
    look.hairShade,
    look.top,
    look.bottom,
    look.shoes,
    look.head ?? '',
    look.face ?? '',
    look.neck ?? '',
    look.wrist ?? '',
    look.held ?? '',
    look.back ?? '',
  ].join('|');
}

export function characterBuf(look: Look, pose: PoseName, frame: number, blink = false): PixBuf {
  const g = geom(pose, frame);
  if (blink && g.eyes === 'open') g.eyes = 'closed';
  const b = new PixBuf(CHAR_W, CHAR_H);
  const top = TOPS[look.top] ?? TOPS.top_tunic;
  const bottom = BOTTOMS[look.bottom] ?? BOTTOMS.bottom_trousers;
  const shoe = SHOES[look.shoes] ?? SHOES.shoes_boots;

  if (look.back && BACK_ITEMS[look.back]) BACK_ITEMS[look.back](b, g, look);
  if (!top.hoodUp) drawHair(b, g, look, 'back');
  if (top.hood) drawHood(b, g, top, false);
  if (g.armB) drawArm(b, g.armB, top, true);
  drawLeg(b, g.legB, bottom, shoe, g.toeB, true);
  drawLeg(b, g.legF, bottom, shoe, g.toeF, false);
  // torso, plus coats and robes that fall over the legs
  fill(b, g.torso, top.c);
  if (top.rows) {
    const [x, y, w, h] = g.torso;
    const sit = g.held === 'lap' || g.extra === 'laptop';
    const rows = sit ? Math.min(2, top.rows) : top.rows;
    for (let j = 0; j < rows; j++) {
      const widen = top.rows >= 5 && j >= 3 ? 1 : 0;
      b.hline(x - widen, x + w - 1 + widen, y + h + j, top.c);
    }
  }
  top.detail?.(b, g);
  drawHead(b, g, look);
  if (top.hoodUp) drawHood(b, g, top, true);
  else drawHair(b, g, look, 'front');
  if (look.head && HEAD_ITEMS[look.head] && !top.hoodUp) HEAD_ITEMS[look.head](b, g, look);
  if (look.face && FACE_ITEMS[look.face]) FACE_ITEMS[look.face](b, g, look);
  if (look.neck && NECK_ITEMS[look.neck]) NECK_ITEMS[look.neck](b, g, look);
  drawArm(b, g.armF, top, false);
  if (look.wrist && WRIST_ITEMS[look.wrist]) WRIST_ITEMS[look.wrist](b, g, look);
  if (g.extra) drawExtra(b, g, look);
  else if (look.held && g.held !== 'none' && HELD_ITEMS[look.held]) HELD_ITEMS[look.held](b, g, look);
  b.outline(0);
  return b;
}

export function characterCanvas(look: Look, pose: PoseName, frame: number, blink = false): HTMLCanvasElement {
  const key = `${lookKey(look)}#${pose}#${frame % POSE_FRAMES[pose]}#${blink ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = characterBuf(look, pose, frame, blink).toCanvas();
    cache.set(key, cv);
    if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  }
  return cv;
}
