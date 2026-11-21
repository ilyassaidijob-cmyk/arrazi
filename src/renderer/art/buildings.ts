// Buildings that appear in the player's world as projects are learned.
// A project shows a building site once its first mission is done, gains lit windows with every
// finished mission and stands complete (with a crow on the roof) when the whole project is done.
import { PixBuf, T } from './pixels';

export interface BuildingSpec {
  type: string;
  progress: number; // missions done / total (0..1)
  done: boolean;
  label: string;
}

interface Plan {
  w: number;
  h: number;
  draw: (b: PixBuf, win: (x: number, y: number, w?: number, h?: number) => void, frame: number) => void;
  roof: [number, number]; // where the crow lands
}

function body(b: PixBuf, x: number, y: number, w: number, h: number) {
  b.rect(x, y, w, h, 1);
  b.vline(x, y, y + h - 1, 2);
}

function gable(b: PixBuf, x: number, y: number, w: number) {
  // triangle roof sitting on y (bottom row), apex above
  const half = Math.ceil(w / 2);
  for (let i = 0; i < half; i++) {
    b.hline(x + i, x + w - 1 - i, y - i, i === 0 ? 2 : 0);
    b.set(x + i, y - i, 2);
  }
}

function door(b: PixBuf, x: number, y: number) {
  b.rect(x, y, 3, 4, 0);
  b.hline(x - 1, x + 3, y - 1, 2);
}

const PLANS: Record<string, Plan> = {
  tower: {
    w: 14,
    h: 40,
    roof: [7, 6],
    draw: (b, win, f) => {
      b.vline(7, 0, 5, 2);
      b.set(7, 0, f % 2 ? 4 : 3);
      b.hline(6, 8, 3, 2);
      body(b, 3, 6, 8, 6);
      win(5, 8, 4, 2);
      body(b, 2, 12, 10, 28);
      for (let r = 0; r < 6; r++) {
        win(4, 14 + r * 4, 2, 2);
        win(8, 14 + r * 4, 2, 2);
      }
      door(b, 6, 36);
    },
  },
  workshop: {
    w: 22,
    h: 24,
    roof: [11, 2],
    draw: (b, win, f) => {
      b.rect(15, 2, 3, 8, 1);
      b.set(16, 0, f % 3 === 0 ? 2 : T);
      b.set(15, 1, f % 3 === 1 ? 2 : T);
      gable(b, 1, 11, 20);
      body(b, 2, 12, 18, 12);
      win(4, 14, 3, 3);
      win(15, 14, 3, 3);
      door(b, 10, 20);
      // gear sign
      b.ascii(9, 12, ['2.2', '.3.', '2.2']);
    },
  },
  stage: {
    w: 26,
    h: 22,
    roof: [13, 0],
    draw: (b, win) => {
      b.hline(0, 25, 0, 2);
      b.hline(0, 25, 1, 1);
      for (let y = 0; y < 16; y += 2) {
        b.set(0, y, 2);
        b.set(25, y, 2);
      }
      b.vline(1, 0, 15, 1);
      b.vline(24, 0, 15, 1);
      win(6, 2, 2, 1);
      win(18, 2, 2, 1);
      b.rect(3, 9, 4, 7, 1);
      b.rect(19, 9, 4, 7, 1);
      win(4, 10, 2, 2);
      win(20, 10, 2, 2);
      win(4, 13, 2, 2);
      win(20, 13, 2, 2);
      b.rect(0, 16, 26, 3, 1);
      b.hline(0, 25, 16, 2);
      b.rect(1, 19, 24, 3, 0);
      b.vline(3, 19, 21, 1);
      b.vline(22, 19, 21, 1);
    },
  },
  yard: {
    w: 26,
    h: 18,
    roof: [12, 1],
    draw: (b, win) => {
      // training dummy
      b.rect(11, 1, 3, 3, 2);
      b.vline(12, 4, 15, 2);
      b.hline(8, 16, 6, 2);
      b.rect(10, 7, 5, 5, 1);
      // fence
      for (let x = 0; x < 26; x += 4) b.vline(x, 9, 17, 1);
      b.hline(0, 25, 11, 1);
      b.hline(0, 25, 15, 1);
      // weights and lanterns on posts
      b.rect(18, 15, 6, 1, 2);
      b.rect(17, 13, 1, 4, 0);
      b.rect(24, 13, 1, 4, 0);
      win(0, 7, 1, 2);
      win(24, 7, 1, 2);
    },
  },
  library: {
    w: 26,
    h: 24,
    roof: [13, 2],
    draw: (b, win) => {
      gable(b, 0, 9, 26);
      b.hline(1, 24, 10, 2);
      body(b, 1, 11, 24, 13);
      for (let x = 3; x < 24; x += 5) b.vline(x, 12, 22, 2);
      win(5, 13, 2, 4);
      win(10, 13, 2, 4);
      win(15, 13, 2, 4);
      win(20, 13, 2, 4);
      b.hline(0, 25, 23, 2);
    },
  },
  observatory: {
    w: 22,
    h: 22,
    roof: [10, 1],
    draw: (b, win) => {
      for (let y = 0; y < 9; y++) {
        const r = Math.round(Math.sqrt(Math.max(0, 81 - (9 - y) * (9 - y))));
        b.hline(11 - r, 11 + r, y + 1, 1);
        b.set(11 - r, y + 1, 2);
      }
      b.vline(11, 1, 9, 0);
      b.line(12, 4, 18, 0, 3);
      body(b, 2, 10, 18, 12);
      win(5, 13, 2, 3);
      win(15, 13, 2, 3);
      door(b, 10, 18);
    },
  },
  atelier: {
    w: 22,
    h: 24,
    roof: [6, 3],
    draw: (b, win) => {
      gable(b, 1, 11, 20);
      for (let i = 0; i < 6; i++) b.set(12 + i, 6 + i, 3);
      body(b, 2, 12, 18, 12);
      win(4, 14, 4, 4);
      win(13, 14, 4, 4);
      door(b, 9, 20);
      b.line(19, 23, 21, 17, 2);
    },
  },
  alchemy: {
    w: 16,
    h: 38,
    roof: [8, 3],
    draw: (b, win, f) => {
      for (let i = 0; i < 10; i++) b.hline(8 - Math.floor(i / 2) - 1, 8 + Math.floor(i / 2), 2 + i, i % 3 === 0 ? 2 : 0);
      b.set(8, 1, 3);
      b.rect(11, 6, 2, 6, 1);
      b.set(12, 4 - (f % 3), 2);
      b.set(11, 2 - (f % 2), 2);
      body(b, 3, 12, 10, 26);
      win(7, 15, 2, 3);
      win(7, 21, 2, 3);
      win(7, 27, 2, 3);
      door(b, 6, 34);
    },
  },
  clocktower: {
    w: 12,
    h: 44,
    roof: [6, 1],
    draw: (b, win, f) => {
      for (let i = 0; i < 6; i++) b.hline(6 - i, 5 + i, 1 + i, i === 5 ? 2 : 0);
      body(b, 1, 7, 10, 37);
      b.disc(6, 12, 3, 3);
      b.set(6, 12, 0);
      b.set(6 + (f % 2), 11, 0);
      b.set(6, 10, 0);
      win(5, 18, 2, 3);
      win(5, 24, 2, 3);
      win(5, 30, 2, 3);
      door(b, 5, 40);
    },
  },
  greenhouse: {
    w: 26,
    h: 18,
    roof: [13, 1],
    draw: (b, win) => {
      for (let x = 0; x < 26; x++) {
        const top = Math.round(1 + 7 * Math.pow((x - 12.5) / 12.5, 2));
        for (let y = top; y < 18; y++) b.set(x, y, y === top ? 3 : (x + y) % 6 === 0 ? 2 : 1);
      }
      for (let x = 2; x < 25; x += 4) b.vline(x, 4, 17, 2);
      b.hline(0, 25, 10, 2);
      win(5, 12, 2, 2);
      win(13, 12, 2, 2);
      win(20, 12, 2, 2);
      b.ascii(8, 14, ['.3.3.', '33333']);
    },
  },
};

export function buildingPlan(type: string) {
  return PLANS[type] ?? PLANS.workshop;
}

export function buildingBuf(spec: BuildingSpec, frame: number): PixBuf {
  const plan = buildingPlan(spec.type);
  const b = new PixBuf(plan.w + 2, plan.h + 2);
  const inner = new PixBuf(plan.w, plan.h);
  const windows: [number, number, number, number][] = [];
  plan.draw(inner, (x, y, w = 2, h = 2) => windows.push([x, y, w, h]), frame);
  const lit = spec.done ? windows.length : Math.round(windows.length * spec.progress);
  windows.forEach(([x, y, w, h], i) => {
    const on = i < lit;
    inner.rect(x, y, w, h, on ? 4 : 0);
    if (on && h > 1) inner.hline(x, x + w - 1, y + h - 1, 3);
  });
  if (!spec.done) {
    // unbuilt top part is only scaffolding
    const cut = Math.round(plan.h * (1 - Math.max(0.2, spec.progress)));
    for (let y = 0; y < cut; y++)
      for (let x = 0; x < plan.w; x++) {
        if (inner.get(x, y) === T) continue;
        const edge =
          inner.get(x - 1, y) === T || inner.get(x + 1, y) === T || inner.get(x, y - 1) === T || y === cut - 1;
        inner.set(x, y, edge && (x + y) % 2 === 0 ? 2 : T);
      }
  }
  b.blit(inner, 1, 1);
  b.outline(0);
  return b;
}

export function roofAnchor(type: string): [number, number] {
  const p = buildingPlan(type);
  return [p.roof[0] + 1, p.roof[1] + 1];
}
