// Small sprites shared by the scene and the UI: crow, bat, lantern, props, glyphs.
import { PixBuf, dataUrl } from './pixels';

const buf = (rows: string[], map: Record<string, number> = {}, outline = true, outlineColor = 0) => {
  const w = Math.max(...rows.map((r) => r.length));
  const b = new PixBuf(w + 2, rows.length + 2);
  b.ascii(1, 1, rows, map);
  if (outline) b.outline(outlineColor);
  return b;
};

// Crow perched, facing left. Frames: idle, head turned, caw (beak open)
const CROW_PERCH = [
  [
    '...111......',
    '..11131.....',
    '22111111....',
    '...1111111..',
    '...11111111.',
    '....111111111',
    '.....11..1.11',
    '.....1.1.....',
  ],
  [
    '...111......',
    '..11111.....',
    '..1131112...',
    '...1111111..',
    '...11111111.',
    '....111111111',
    '.....11..1.11',
    '.....1.1.....',
  ],
  [
    '2..111......',
    '.2111131....',
    '22111111....',
    '...1111111..',
    '...11111111.',
    '....111111111',
    '.....11..1.11',
    '.....1.1.....',
  ],
];

// Crow flying, facing left. Frames: wings up, wings level, wings down
const CROW_FLY = [
  [
    '......1.......',
    '.....11.......',
    '....111.......',
    '.1311111111...',
    '221111111111..',
    '....11111..11.',
  ],
  [
    '..............',
    '..............',
    '.131111.......',
    '22111111111111',
    '...1111111111.',
    '....111.......',
  ],
  [
    '..............',
    '..............',
    '.13111111111..',
    '221111111111..',
    '....111.......',
    '....11........',
    '.....1........',
  ],
];

const BAT = [
  ['0.......0', '00.020.00', '.0000000.', '...000...'],
  ['...020...', '.0000000.', '00.000.00', '0.......0'],
];

export const crowPerch = (frame: number) => buf(CROW_PERCH[frame % 3]);
export const crowFly = (frame: number) => buf(CROW_FLY[frame % 3]);
export const bat = (frame: number) => buf(BAT[frame % 2], {}, false);

/** UI crows get a light rim so they read on dark panels */
export function crowFlyUrl(frame: number) {
  return dataUrl(`crowfly${frame % 3}`, () => {
    const b = buf(CROW_FLY[frame % 3]);
    const out = new PixBuf(b.w + 2, b.h + 2);
    out.blit(b, 1, 1);
    out.outline(2);
    return out;
  });
}
export function crowPerchUrl(frame: number) {
  return dataUrl(`crowperch${frame % 3}`, () => {
    const b = buf(CROW_PERCH[frame % 3]);
    const out = new PixBuf(b.w + 2, b.h + 2);
    out.blit(b, 1, 1);
    out.outline(2);
    return out;
  });
}

export const LANTERN = buf(['.1.', '111', '444', '434', '444', '111']);
export const LANTERN_DIM = buf(['.1.', '111', '333', '323', '333', '111']);

export const LOG_SEAT = buf(['.11111111.', '1212121212', '1111111111', '.1.....1..']);

export const ZZZ = [buf(['333', '.3.', '333'], {}, false), buf(['3333', '..3.', '.3..', '3333'], {}, false)];

export const PROPS: Record<string, (frame: number) => PixBuf> = {
  gym_kettlebell: () => buf(['.111.', '1...1', '.111.', '22222', '22222', '.222.']),
  music_keyboard: () =>
    buf(['1111111111111', '4141441414144', '4444444444444', '1111111111111', '.1.........1.', '.1.........1.', '1.1.......1.1']),
  music_vinyl: (f) =>
    buf([
      '...........',
      f % 2 ? '..00000....' : '..00000....',
      f % 2 ? '.0003000.1.' : '.0000300.1.',
      '..00000..1.',
      '22222222222',
      '21212121212',
      '22222222222',
    ]),
  cyber_terminal: (f) => {
    const lines = ['433.3..', '3.433..', '43.33..', '3343...', '43.3...', '3.43...'];
    const rows = ['111111111', ...[0, 1, 2, 3].map((i) => `1${lines[(i + f) % lines.length]}1`), '111111111', '...111...', '..11111..'];
    return buf(rows.map((r) => r.replace(/\./g, '1')));
  },
};

// Big pixel letters for "z z" and small numbers are done with CSS; these are scene-only.
export const SPARK = buf(['.4.', '444', '.4.'], {}, false);
export const STAR_BIG = buf(['..4..', '..4..', '44444', '..4..', '..4..'], {}, false);
export const STAR_MID = buf(['.3.', '343', '.3.'], {}, false);
