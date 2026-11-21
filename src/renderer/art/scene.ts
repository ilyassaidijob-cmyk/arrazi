// The night scene: a side view with parallax hills, a huge moon that doubles as the EXP bar,
// twisted trees with a crow, low fog, swaying grass, fireflies, bats, monthly weather and the
// buildings the player has earned. Everything is drawn small and scaled up with sharp pixels.
import type { Look } from '../core/types';
import { hash, rng } from '../core/util';
import { buildingBuf, roofAnchor, type BuildingSpec } from './buildings';
import { CHAR_GROUND, characterCanvas, type PoseName } from './character';
import { PALETTE, PixBuf, T } from './pixels';
import { LANTERN, LOG_SEAT, PROPS, ZZZ, bat, crowPerch } from './sprites';

export type Mood = 'idle' | 'study' | 'break' | 'celebrate' | 'sleepy' | 'fight';
export type Weather = 'snow' | 'rain' | 'petals' | 'fireflies' | 'leaves' | 'none';

export interface SceneState {
  look?: Look;
  mood: Mood;
  setAnim?: 'lift' | 'guitar' | 'type' | null;
  moonPhase: number;
  bloodMoon: boolean;
  weather: Weather;
  buildings: BuildingSpec[];
  background: string;
  animations: boolean;
  charX: number;
  prop?: string;
  targetHeight?: number; // preferred internal height in pixels
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number;
  p: number;
}

export class Scene {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  W = 320;
  H = 180;
  scale = 3;
  private state: SceneState;
  private raf = 0;
  private running = false;
  private lastFrame = 0;
  private t0 = performance.now();
  private t = 0;
  private moodSince = 0;
  private mx = 0;
  private tmx = 0;
  private seed: number;
  private layers: Record<string, HTMLCanvasElement | undefined> = {};
  private layerKey: Record<string, string> = {};
  private particles: Particle[] = [];
  private fireflies: Particle[] = [];
  private bats: { x: number; y: number; v: number; ph: number }[] = [];
  private nextBat = 6;
  private walkX = 0;
  private walkDir = 1;
  private groundY = 160;
  private moon = { x: 0, y: 0, r: 20 };
  private crowSpot: [number, number] = [0, 0];
  private extraCrowSpots: [number, number][] = [];
  private starList: { x: number; y: number; big: boolean; ph: number }[] = [];
  private starGeo = '';
  private leds: [number, number, number][] = [];
  private onMove = (e: MouseEvent) => {
    this.tmx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
  };

  constructor(canvas: HTMLCanvasElement, state: SceneState, seed = 7) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.state = state;
    this.seed = seed;
    window.addEventListener('mousemove', this.onMove);
  }

  destroy() {
    this.stop();
    window.removeEventListener('mousemove', this.onMove);
  }

  setState(next: Partial<SceneState>) {
    const prev = this.state;
    this.state = { ...prev, ...next };
    if (next.mood && next.mood !== prev.mood) {
      this.moodSince = this.t;
      this.walkX = 0;
    }
    if (next.weather && next.weather !== prev.weather) this.particles = [];
    if (!this.running) this.draw();
  }

  /** Size the canvas to its container with an integer pixel scale. */
  resize(cssW: number, cssH: number) {
    const target = this.state.targetHeight ?? 180;
    const scale = Math.max(1, Math.round(cssH / target));
    const W = Math.max(64, Math.ceil(cssW / scale));
    const H = Math.max(48, Math.ceil(cssH / scale));
    if (W === this.W && H === this.H && scale === this.scale) return;
    this.W = W;
    this.H = H;
    this.scale = scale;
    this.cv.width = W;
    this.cv.height = H;
    this.cv.style.width = `${W * scale}px`;
    this.cv.style.height = `${H * scale}px`;
    this.layers = {};
    this.layerKey = {};
    this.particles = [];
    this.fireflies = [];
    this.draw();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (!this.state.animations) return;
      if (now - this.lastFrame < 1000 / 30) return;
      this.lastFrame = now;
      this.t = (now - this.t0) / 1000;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
    this.draw();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Moon position in CSS pixels, for the EXP tooltip */
  moonCss() {
    return { x: this.moon.x * this.scale, y: this.moon.y * this.scale, r: this.moon.r * this.scale };
  }

  // ---------------------------------------------------------------- helpers

  private px(x: number, y: number, c: number) {
    this.ctx.fillStyle = PALETTE[c];
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  private layer(name: string, key: string, make: () => HTMLCanvasElement) {
    if (this.layerKey[name] !== key || !this.layers[name]) {
      this.layers[name] = make();
      this.layerKey[name] = key;
    }
    return this.layers[name]!;
  }

  private get bg() {
    return this.state.background || 'bg_night';
  }

  // ---------------------------------------------------------------- static layers

  private makeSky(): HTMLCanvasElement {
    const { W, H } = this;
    const b = new PixBuf(W, H);
    const r = rng(this.seed);
    const horizon = this.groundY - 8;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = 1 - y / Math.max(1, H * 0.34);
        b.set(x, y, k > 0 && bayer(x, y) < k * 0.5 ? 0 : 1);
      }
    // faint fixed stars
    const n = Math.round((W * horizon) / 300);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * horizon * 0.85);
      b.set(x, y, 2);
    }
    if (this.bg === 'bg_server') {
      // dark wall with a round window around the moon
      const { x: mx, y: my, r: mr } = this.moon;
      const wr = mr + 8;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - mx, y - my);
          if (d > wr) b.set(x, y, (x % 24 === 0 || y % 18 === 0) && d > wr + 1 ? 1 : 0);
          else if (d > wr - 2) b.set(x, y, 2);
        }
    }
    return b.toCanvas();
  }

  private stars() {
    const r = rng(this.seed + 11);
    const horizon = this.groundY - 14;
    const n = Math.round((this.W * horizon) / 900);
    const out: { x: number; y: number; big: boolean; ph: number }[] = [];
    for (let i = 0; i < n; i++)
      out.push({ x: Math.floor(r() * this.W), y: Math.floor(r() * horizon * 0.8), big: r() < 0.12, ph: r() * 10 });
    return out;
  }

  private makeMoon(phase: number, blood: boolean): HTMLCanvasElement {
    const R = this.moon.r;
    const S = R * 2 + 12;
    const b = new PixBuf(S, S);
    const c = S / 2;
    const r = rng(77);
    const craters: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) craters.push([(r() * 2 - 1) * R * 0.7, (r() * 2 - 1) * R * 0.7, 1 + r() * R * 0.28]);
    const lit = blood ? 2 : 4;
    const crater = blood ? 1 : 3;
    // halo
    if (phase > 0.05)
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
          if (d > R + 1.5 && d < R + 5 && bayer(x, y) < 0.16 * phase) b.set(x, y, blood ? 0 : 2);
        }
    for (let y = -R; y <= R; y++) {
      const w = Math.sqrt(Math.max(0, R * R - y * y));
      for (let x = -R; x <= R; x++) {
        const d = Math.hypot(x, y);
        if (d > R + 0.3) continue;
        const isLit = x + 0.5 > (1 - 2 * phase) * w;
        let col = isLit ? lit : 0;
        if (isLit && craters.some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr)) col = crater;
        if (isLit && !blood && d > R - 1.2 && x < 0) col = 3;
        if (!isLit && d > R - 1.2) col = 2;
        b.set(c + x, c + y, col);
      }
    }
    return b.toCanvas();
  }

  private hill(x: number, base: number, amp: number, s: number) {
    return (
      base -
      amp * (0.55 * Math.sin(x * 0.021 + s) + 0.3 * Math.sin(x * 0.053 + s * 2.1) + 0.15 * Math.sin(x * 0.11 + s * 3.7))
    );
  }

  private makeFar(): HTMLCanvasElement {
    const W = this.W + 24;
    const { H } = this;
    const b = new PixBuf(W, H);
    const s = (this.seed % 97) / 7;
    const bg = this.bg;
    if (bg === 'bg_server') return b.toCanvas();
    if (bg === 'bg_rooftop') {
      // city skyline
      const r = rng(this.seed + 5);
      let x = 0;
      while (x < W) {
        const w = 8 + Math.floor(r() * 18);
        const h = 18 + Math.floor(r() * (H * 0.35));
        const top = this.groundY - 6 - h;
        b.rect(x, top, w - 1, h + 6, 0);
        for (let yy = top + 3; yy < this.groundY - 8; yy += 4)
          for (let xx = x + 2; xx < x + w - 3; xx += 3) if (r() < 0.22) b.set(xx, yy, r() < 0.3 ? 3 : 2);
        if (r() < 0.3) b.vline(x + Math.floor(w / 2), top - 6, top, 0);
        x += w;
      }
      return b.toCanvas();
    }
    const base = this.groundY - Math.round(this.H * 0.16);
    const amp = this.H * 0.07;
    for (let x = 0; x < W; x++) {
      const top = Math.round(this.hill(x, base, amp, s));
      for (let y = top; y < this.groundY; y++) b.set(x, y, (x + y) % 2 === 0 || y > top + 6 ? 0 : 1);
      if (bg === 'moon_wolf') {
        b.set(x, top, 3);
        if (x % 2 === 0) b.set(x, top + 1, 2);
      } else if (x % 3 !== 0) b.set(x, top, 2);
    }
    if (bg === 'bg_forest') {
      const r = rng(this.seed + 9);
      for (let i = 0; i < W / 7; i++) {
        const x = Math.floor(r() * W);
        const h = 10 + Math.floor(r() * 22);
        const top = Math.round(this.hill(x, base, amp, s)) - h;
        b.vline(x, top, top + h, 0);
        for (let j = 0; j < h; j += 3) {
          const len = Math.floor((j / h) * 4);
          b.hline(x - len, x + len, top + j, 0);
        }
      }
    }
    return b.toCanvas();
  }

  private branch(b: PixBuf, r: () => number, x: number, y: number, ang: number, len: number, th: number, depth: number, tips: [number, number][]) {
    const segs = Math.max(2, Math.round(len / 4));
    let cx = x;
    let cy = y;
    let a = ang;
    for (let i = 0; i < segs; i++) {
      a += (r() - 0.5) * 0.5;
      const nx = cx + Math.cos(a) * (len / segs);
      const ny = cy - Math.sin(a) * (len / segs);
      const t = Math.max(1, Math.round(th * (1 - i / segs / 1.6)));
      for (let k = 0; k < t; k++) {
        b.line(Math.round(cx) + k - Math.floor(t / 2), Math.round(cy), Math.round(nx) + k - Math.floor(t / 2), Math.round(ny), 0);
      }
      cx = nx;
      cy = ny;
    }
    if (depth <= 0 || len < 5) {
      tips.push([Math.round(cx), Math.round(cy)]);
      return;
    }
    const n = depth > 2 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * (0.7 + r() * 0.4);
      this.branch(b, r, cx, cy, a + spread, len * (0.62 + r() * 0.15), Math.max(1, th - 1), depth - 1, tips);
    }
  }

  private makeMid(): HTMLCanvasElement {
    const W = this.W + 24;
    const { H } = this;
    const b = new PixBuf(W, H);
    const s = (this.seed % 89) / 5 + 3;
    const bg = this.bg;
    const gy = this.groundY;
    this.extraCrowSpots = [];
    if (bg === 'bg_server') {
      // racks
      this.leds = [];
      const r = rng(this.seed + 3);
      for (let x = 6; x < W - 10; x += 26) {
        if (Math.abs(x + 9 - this.W * this.state.charX) < 20) continue;
        const h = Math.round(H * 0.42);
        b.rect(x, gy - h, 18, h, 2);
        b.rect(x + 1, gy - h + 1, 16, h - 2, 1);
        for (let yy = gy - h + 3; yy < gy - 3; yy += 3) {
          b.hline(x + 2, x + 15, yy, 0);
          if (r() < 0.8) b.set(x + 3 + Math.floor(r() * 4), yy + 1, 2);
          if (r() < 0.7) this.leds.push([x + 10 + Math.floor(r() * 5), yy + 1, 1 + r() * 5]);
        }
      }
      b.hline(0, W, gy - Math.round(H * 0.5), 0);
      return b.toCanvas();
    }
    if (bg !== 'bg_rooftop') {
      const base = gy - Math.round(H * 0.07);
      for (let x = 0; x < W; x++) {
        const top = Math.round(this.hill(x, base, H * 0.035, s));
        for (let y = top; y < gy; y++) b.set(x, y, 0);
        if (x % 4 === 1) b.set(x, top, 2);
      }
    }
    if (bg === 'bg_gym') {
      // gym building with big lit windows, a weight rack and a punching bag
      const gx = Math.round(this.W * 0.06);
      const gw = Math.round(this.W * 0.3);
      const gh = Math.round(H * 0.32);
      b.rect(gx, gy - gh, gw, gh, 0);
      b.hline(gx - 2, gx + gw + 1, gy - gh, 2);
      for (let wx = gx + 4; wx < gx + gw - 8; wx += 12) {
        b.rect(wx, gy - gh + 5, 8, 7, 3);
        b.hline(wx, wx + 7, gy - gh + 9, 2);
        b.rect(wx + 2, gy - gh + 7, 4, 1, 1);
      }
      const rx = Math.round(this.W * 0.66);
      b.hline(rx, rx + 16, gy - 10, 2);
      b.vline(rx, gy - 12, gy - 1, 2);
      b.vline(rx + 16, gy - 12, gy - 1, 2);
      b.rect(rx + 3, gy - 13, 2, 6, 0);
      b.rect(rx + 12, gy - 13, 2, 6, 0);
      const px = Math.round(this.W * 0.86);
      b.hline(px - 4, px + 4, gy - 30, 2);
      b.vline(px - 4, gy - 30, gy - 1, 2);
      b.vline(px + 2, gy - 29, gy - 26, 2);
      b.rect(px, gy - 26, 5, 12, 1);
      b.hline(px, px + 4, gy - 20, 2);
    } else if (bg === 'bg_rooftop') {
      // stage truss with speakers on a rooftop
      const sx = Math.round(this.W * 0.18);
      const sw = Math.round(this.W * 0.58);
      const top = gy - Math.round(H * 0.4);
      for (let x = sx; x <= sx + sw; x++) {
        b.set(x, top, 2);
        if (x % 2 === 0) b.set(x, top + 1, 1);
      }
      for (let y = top; y < gy; y++) {
        b.set(sx, y, y % 2 ? 2 : 1);
        b.set(sx + sw, y, y % 2 ? 2 : 1);
      }
      b.rect(sx + 3, gy - 14, 7, 14, 0);
      b.rect(sx + sw - 9, gy - 14, 7, 14, 0);
      b.disc(sx + 6, gy - 9, 2, 1);
      b.disc(sx + sw - 6, gy - 9, 2, 1);
      b.rect(0, gy - 4, W, 4, 0);
      b.hline(0, W, gy - 4, 2);
    } else {
      // twisted trees: a big one reaching across the moon, a smaller one on the left
      const r = rng(this.seed + 21);
      const tips: [number, number][] = [];
      const bigX = Math.round(Math.min(this.W - 20, this.moon.x + this.moon.r * 0.9));
      this.branch(b, r, bigX, gy, Math.PI / 2 + 0.15, H * 0.34, 6, 3, tips);
      // a long low branch in front of the moon for the crow
      const by = Math.round(this.moon.y + this.moon.r * 0.55);
      const bx0 = bigX - 2;
      const ty = Math.round(gy - H * 0.3);
      b.line(bigX, ty, bx0 - Math.round(this.moon.r * 1.1), by, 0);
      b.line(bigX, ty + 1, bx0 - Math.round(this.moon.r * 1.1), by + 1, 0);
      b.line(bx0 - Math.round(this.moon.r * 1.1), by, bx0 - Math.round(this.moon.r * 1.6), by - 4, 0);
      this.crowSpot = [bx0 - Math.round(this.moon.r * 0.75), Math.round(by + (ty - by) * 0.24)];
      const smallX = Math.round(this.W * 0.07);
      this.branch(b, r, smallX, gy, Math.PI / 2 - 0.2, H * 0.22, 4, 3, tips);
      if (bg === 'bg_forest') {
        for (let i = 0; i < 6; i++) {
          const x = Math.round(((i + 0.5) / 6) * this.W + (r() - 0.5) * 20);
          if (Math.abs(x - this.W * this.state.charX) < 16) continue;
          this.branch(b, r, x, gy, Math.PI / 2 + (r() - 0.5) * 0.5, H * (0.18 + r() * 0.14), 3, 2, tips);
        }
      }
      tips.sort((a, c) => a[1] - c[1]);
      this.extraCrowSpots = tips.filter(([x, y]) => y < gy - 20 && x > 4 && x < this.W - 8).slice(0, 5);
      // trunk highlights on the moon side
      for (let y = 0; y < H; y++)
        for (let x = 1; x < W; x++)
          if (b.get(x, y) === 0 && b.get(x + 1, y) === T && y < gy - 2 && (x + y) % 2 === 0) b.set(x, y, 2);
      if (bg === 'moon_wolf') {
        const wx = Math.round(this.W * 0.22);
        const top = gy - 20;
        for (let x = wx - 18; x < wx + 18; x++) {
          const h = Math.round(20 - Math.abs(x - wx) * 0.9);
          for (let y = gy - h; y < gy; y++) b.set(x, y, 0);
          b.set(x, gy - h, 1);
        }
        b.ascii(wx - 7, top - 11, [
          '.........0...',
          '........00...',
          '.......000...',
          '......0000...',
          '.....00000...',
          '..0000000....',
          '.00000000....',
          '000000000....',
          '0000.00.0....',
          '0.0..0..0....',
          '0.0..0..0....',
        ]);
      }
    }
    // the player's buildings
    const blds = this.state.buildings.slice(0, 8);
    if (blds.length && bg !== 'bg_server') {
      const slot = Math.max(30, Math.floor((this.W * 0.78) / Math.max(4, blds.length)));
      blds.forEach((spec, i) => {
        const bb = buildingBuf(spec, 0);
        let x = Math.round(this.W * 0.04 + i * slot);
        const cx = this.W * this.state.charX;
        if (x < cx + 14 && x + bb.w > cx - 14) x = Math.round(x < cx ? cx - 16 - bb.w : cx + 16);
        b.blit(bb, x, gy - bb.h + 1);
        if (spec.done) {
          const [ax, ay] = roofAnchor(spec.type);
          this.extraCrowSpots.push([x + ax, gy - bb.h + 1 + ay]);
        }
      });
    }
    return b.toCanvas();
  }

  private makeGround(phase: number): HTMLCanvasElement {
    const { W, H } = this;
    const gy = this.groundY;
    const b = new PixBuf(W, H - gy + 10);
    const bg = this.bg;
    const r = rng(this.seed + 31);
    const oy = 10;
    for (let y = 0; y < H - gy; y++)
      for (let x = 0; x < W; x++) {
        let c = 0;
        if (bg === 'bg_server') c = x % 12 === 0 || y % 6 === 0 ? 0 : 1;
        else if (y < 6 && bayer(x, y) < 0.35 - y * 0.05) c = 1;
        b.set(x, y + oy, c);
      }
    if (bg === 'bg_server' || bg === 'bg_rooftop') {
      b.hline(0, W, oy, 2);
      return b.toCanvas();
    }
    const snowy = this.state.weather === 'snow' || bg === 'moon_wolf';
    for (let x = 0; x < W; x++) {
      b.set(x, oy, snowy ? 3 : 2);
      if (snowy && x % 2) b.set(x, oy + 1, 2);
    }
    // grass blades that sway in 4 phases
    for (let x = 0; x < W; x++) {
      if (r() < 0.35) {
        const h = 1 + Math.floor(r() * (bg === 'bg_forest' ? 7 : 5));
        const sway = Math.round(Math.sin(x * 0.35 + phase * Math.PI * 0.5) * (h > 3 ? 1 : 0));
        for (let j = 1; j <= h; j++) {
          const xx = x + (j > h / 2 ? sway : 0);
          b.set(xx, oy - j, j === h && h > 3 ? 3 : 2);
        }
      }
    }
    return b.toCanvas();
  }

  private makeFog(seed: number, density: number): HTMLCanvasElement {
    const W = this.W * 2;
    const h = Math.round(this.H * 0.09) + 4;
    const b = new PixBuf(W, h);
    const r = rng(seed);
    const waves = [r() * 6, r() * 6, r() * 6];
    for (let x = 0; x < W; x++) {
      const k =
        0.5 +
        0.3 * Math.sin((x / W) * Math.PI * 2 * 3 + waves[0]) +
        0.2 * Math.sin((x / W) * Math.PI * 2 * 7 + waves[1]);
      for (let y = 0; y < h; y++) {
        const v = (y / h) * k * density;
        if (bayer(x, y) < v * 0.5) b.set(x, y, 2);
      }
    }
    return b.toCanvas();
  }

  // ---------------------------------------------------------------- frame

  draw() {
    const { W, H, ctx } = this;
    const st = this.state;
    const t = st.animations ? this.t : 0;
    this.groundY = H - Math.max(10, Math.round(H * 0.13));
    this.moon = { x: Math.round(W * 0.73), y: Math.round(H * 0.3), r: Math.max(8, Math.round(H * 0.17)) };
    this.mx += (this.tmx - this.mx) * 0.08;
    const pFar = st.animations ? Math.round(this.mx * -3) : 0;
    const pMid = st.animations ? Math.round(this.mx * -6) : 0;
    const bg = this.bg;
    const geo = `${W}x${H}:${bg}`;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.layer('sky', geo, () => this.makeSky()), 0, 0);

    // twinkling stars
    if (this.starGeo !== geo) {
      this.starList = this.stars();
      this.starGeo = geo;
    }
    for (const s of this.starList) {
      if (bg === 'bg_server' && Math.hypot(s.x - this.moon.x, s.y - this.moon.y) > this.moon.r + 6) continue;
      const tw = Math.sin(t * 1.7 + s.ph * 3);
      if (s.big) {
        const c = tw > 0.6 ? 4 : 3;
        this.px(s.x, s.y, c);
        if (tw > -0.2) {
          this.px(s.x - 1, s.y, 2);
          this.px(s.x + 1, s.y, 2);
          this.px(s.x, s.y - 1, 2);
          this.px(s.x, s.y + 1, 2);
        }
        if (tw > 0.8) {
          this.px(s.x - 2, s.y, 2);
          this.px(s.x + 2, s.y, 2);
          this.px(s.x, s.y - 2, 2);
          this.px(s.x, s.y + 2, 2);
        }
      } else this.px(s.x, s.y, tw > 0.3 ? 3 : 2);
    }

    // moon (the EXP bar)
    const phaseQ = Math.round(st.moonPhase * 48) / 48;
    const moonCv = this.layer('moon', `${geo}:${phaseQ}:${st.bloodMoon}:${this.moon.r}`, () => this.makeMoon(phaseQ, st.bloodMoon));
    ctx.drawImage(moonCv, this.moon.x - moonCv.width / 2 + pFar / 2, this.moon.y - moonCv.height / 2);

    // thin clouds drifting past the moon
    if (bg !== 'bg_server') {
      const cloudW = W * 2;
      const clouds = this.layer('clouds', geo, () => {
        const b = new PixBuf(cloudW, Math.round(H * 0.5));
        const r = rng(this.seed + 41);
        for (let i = 0; i < 5; i++) {
          const cy = Math.floor(r() * H * 0.45);
          const cx = Math.floor(r() * cloudW);
          const len = 30 + Math.floor(r() * 60);
          for (let j = 0; j < len; j++) {
            const th = Math.round(Math.sin((j / len) * Math.PI) * 2);
            for (let k = 0; k <= th; k++) if ((j + k) % 2 === 0 || k === 0) b.set((cx + j) % cloudW, cy + k, 0);
          }
        }
        return b.toCanvas();
      });
      const off = Math.floor((t * 2) % cloudW);
      ctx.drawImage(clouds, -off, 0);
      ctx.drawImage(clouds, cloudW - off, 0);
    }

    // bats
    if (st.animations && bg !== 'bg_server') this.drawBats(t);

    ctx.drawImage(this.layer('far', geo, () => this.makeFar()), -12 + pFar, 0);
    const midKey = `${geo}:${JSON.stringify(st.buildings)}:${st.charX}`;
    ctx.drawImage(this.layer('mid', midKey, () => this.makeMid()), pMid, 0);

    // eyes glowing in the haunted forest
    if (bg === 'bg_forest') {
      const r = rng(this.seed + 77);
      for (let i = 0; i < 5; i++) {
        const ex = Math.floor(r() * (W - 10)) + 5;
        const ey = this.groundY - 8 - Math.floor(r() * H * 0.25);
        const open = Math.sin(t * 0.8 + i * 2.3) > 0.2;
        if (open) {
          this.px(ex + pMid, ey, 3);
          this.px(ex + 3 + pMid, ey, 3);
        }
      }
    }
    // server LEDs
    if (bg === 'bg_server') {
      for (const [x, y, sp] of this.leds) {
        const v = Math.sin(t * sp + x * 0.7 + y);
        if (v > 0) this.px(x + pMid, y, v > 0.7 ? 4 : 3);
      }
    }
    // stage lights
    if (bg === 'bg_rooftop') this.drawStageLights(t);

    // crow on the branch (and friends on a Blood Moon)
    if (bg !== 'bg_server' && bg !== 'bg_rooftop' && bg !== 'bg_gym') {
      const cycle = t % 11;
      const frame = cycle > 9.9 ? 2 : cycle > 6 && cycle < 7.4 ? 1 : 0;
      const crow = this.layer(`crow${frame}`, `c${frame}`, () => crowPerch(frame).toCanvas());
      ctx.drawImage(crow, this.crowSpot[0] - 6 + pMid, this.crowSpot[1] - crow.height + 2);
      if (st.bloodMoon) {
        this.extraCrowSpots.slice(0, 5).forEach(([x, y], i) => {
          const f = Math.floor((t + i * 1.7) % 9) === 0 ? 1 : 0;
          const c2 = this.layer(`crow${f}`, `c${f}`, () => crowPerch(f).toCanvas());
          ctx.drawImage(c2, x - 6 + pMid, y - c2.height + 2);
        });
      }
    }
    if (st.buildings.some((b) => b.done)) {
      // crows sit on finished buildings
      const spots = this.extraCrowSpots.slice(st.bloodMoon ? 5 : 0);
      const doneCount = st.buildings.filter((b) => b.done).length;
      spots.slice(-doneCount).forEach(([x, y]) => {
        const c2 = this.layer('crow0', 'c0', () => crowPerch(0).toCanvas());
        ctx.drawImage(c2, x - 6 + pMid, y - c2.height + 1);
      });
    }

    // low fog
    if (bg !== 'bg_server') {
      const dens = bg === 'bg_forest' ? 1.4 : 1;
      const fogA = this.layer('fogA', geo, () => this.makeFog(this.seed + 51, dens));
      const fogB = this.layer('fogB', geo, () => this.makeFog(this.seed + 52, dens * 0.8));
      const fw = fogA.width;
      const oA = Math.floor((t * 3) % fw);
      const oB = Math.floor((t * 5.5) % fw);
      const fy = this.groundY - fogA.height + 3;
      ctx.drawImage(fogA, -oA, fy - 3);
      ctx.drawImage(fogA, fw - oA, fy - 3);
      ctx.drawImage(fogB, oB - fw, fy);
      ctx.drawImage(fogB, oB, fy);
    }

    // ground + grass
    const gPhase = st.animations ? Math.floor(t * 2.2) % 4 : 0;
    const ground = this.layer(`ground${gPhase}`, `${geo}:${st.weather}`, () => this.makeGround(gPhase));
    ctx.drawImage(ground, 0, this.groundY - 10);

    this.drawCharacter(t);
    this.drawFireflies(t);
    this.drawWeather(t);
  }

  private drawBats(t: number) {
    if (t > this.nextBat && this.bats.length < 2) {
      const r = rng(hash(String(Math.floor(t))));
      this.bats.push({ x: this.W + 10, y: 10 + r() * this.H * 0.35, v: 18 + r() * 14, ph: r() * 6 });
      this.nextBat = t + 9 + r() * 12;
    }
    this.bats = this.bats.filter((b) => b.x > -20);
    for (const b of this.bats) {
      b.x -= b.v / 30;
      const y = b.y + Math.sin(t * 3 + b.ph) * 4;
      const f = Math.floor(t * 8) % 2;
      const cv = this.layer(`bat${f}`, `b${f}`, () => bat(f).toCanvas());
      this.ctx.drawImage(cv, Math.round(b.x), Math.round(y));
    }
  }

  private drawStageLights(t: number) {
    const { ctx } = this;
    const sx = Math.round(this.W * 0.18);
    const sw = Math.round(this.W * 0.58);
    const top = this.groundY - Math.round(this.H * 0.4);
    ctx.fillStyle = PALETTE[2];
    for (let i = 0; i < 3; i++) {
      const lx = sx + Math.round(((i + 1) / 4) * sw);
      const swing = Math.sin(t * 0.7 + i * 2) * 0.35;
      for (let y = top + 2; y < this.groundY; y += 1) {
        const d = y - top;
        const cx = lx + Math.round(swing * d);
        const half = Math.floor(d * 0.18);
        for (let x = cx - half; x <= cx + half; x++) if (bayer(x, y) < 0.12) ctx.fillRect(x, y, 1, 1);
      }
      this.px(lx, top + 1, 4);
    }
  }

  private drawFireflies(t: number) {
    const st = this.state;
    if (!st.animations || this.bg === 'bg_server') return;
    const want = st.weather === 'fireflies' ? 14 : this.bg === 'bg_forest' ? 9 : 5;
    const r = rng(this.seed + 61);
    while (this.fireflies.length < want)
      this.fireflies.push({ x: r() * this.W, y: this.groundY - 4 - r() * this.H * 0.25, vx: 0, vy: 0, c: 4, p: r() * 10 });
    for (const f of this.fireflies) {
      const x = f.x + Math.sin(t * 0.5 + f.p) * 8;
      const y = f.y + Math.sin(t * 0.8 + f.p * 2) * 4;
      const on = Math.sin(t * 2 + f.p * 5) > -0.1;
      if (on) this.px(x, y, Math.sin(t * 2 + f.p * 5) > 0.6 ? 4 : 3);
    }
  }

  private drawWeather(t: number) {
    const st = this.state;
    if (!st.animations || this.bg === 'bg_server') return;
    const kind = this.bg === 'moon_wolf' ? 'snow' : st.weather;
    if (kind === 'none' || kind === 'fireflies') return;
    const counts = { snow: 70, rain: 90, petals: 22, leaves: 18 } as const;
    const n = counts[kind];
    const r = Math.random;
    const spawn = (anywhere: boolean): Particle => {
      const base = { x: r() * (this.W + 40) - 20, y: anywhere ? r() * this.H : -4, p: r() * 10, c: 3 };
      if (kind === 'snow') return { ...base, vx: -2 - r() * 3, vy: 6 + r() * 8, c: r() < 0.5 ? 4 : 3 };
      if (kind === 'rain') return { ...base, vx: -14, vy: 110 + r() * 40, c: 2 };
      if (kind === 'petals') return { ...base, vx: -10 - r() * 8, vy: 6 + r() * 6, c: r() < 0.5 ? 4 : 3 };
      return { ...base, vx: -8 - r() * 8, vy: 8 + r() * 8, c: r() < 0.5 ? 2 : 3 };
    };
    if (this.particles.length === 0) for (let i = 0; i < n; i++) this.particles.push(spawn(true));
    const dt = 1 / 30;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += (p.vx + Math.sin(t + p.p) * (kind === 'rain' ? 0 : 4)) * dt;
      p.y += p.vy * dt;
      if (p.y > this.groundY + 2 || p.x < -10) {
        this.particles[i] = spawn(false);
        continue;
      }
      if (kind === 'rain') {
        this.px(p.x, p.y, 2);
        this.px(p.x - 1, p.y - 2, 2);
      } else if (kind === 'leaves') {
        this.px(p.x, p.y, p.c);
        this.px(p.x + (Math.floor(t * 4 + p.p) % 2), p.y + 1, p.c);
      } else this.px(p.x, p.y, p.c);
    }
  }

  private drawCharacter(t: number) {
    const st = this.state;
    if (!st.look) return;
    const { ctx } = this;
    const since = t - this.moodSince;
    let pose: PoseName = 'stand';
    let frame = 0;
    let blink = false;
    let flip = false;
    let dx = 0;
    switch (st.mood) {
      case 'study':
        pose = 'sit';
        frame = since % 9 > 8.4 ? 2 : since % 3 > 2.4 ? 1 : 0;
        break;
      case 'break':
        if (since < 3.2) {
          pose = 'stretch';
          frame = Math.floor(since / 0.8) % 2;
        } else {
          pose = 'walk';
          frame = Math.floor(t / 0.16) % 4;
          this.walkX += this.walkDir * 0.5;
          if (Math.abs(this.walkX) > Math.min(40, this.W * 0.12)) this.walkDir *= -1;
          dx = Math.round(this.walkX);
          flip = this.walkDir < 0;
        }
        break;
      case 'celebrate':
        if (since < 3) {
          pose = 'jump';
          frame = Math.floor(since / 0.22) % 3;
        } else {
          pose = 'stand';
          frame = Math.floor(t / 0.7) % 2;
        }
        break;
      case 'sleepy':
        pose = 'sleepy';
        frame = Math.floor(t / 1.3) % 2;
        break;
      case 'fight':
        pose = 'attack';
        frame = Math.floor(t / 0.35) % 2;
        break;
      default: {
        const cyc = t % 14;
        if (st.setAnim && cyc > 9.5) {
          pose = st.setAnim;
          frame = Math.floor(t / 0.4) % 2;
        } else {
          pose = 'stand';
          frame = Math.floor(t / 0.75) % 2;
          blink = t % 4.3 < 0.14;
        }
      }
    }
    const cx = Math.round(this.W * st.charX) + dx;
    const top = this.groundY - CHAR_GROUND;
    const left = cx - 16;
    // prop beside the character
    if (st.prop && PROPS[st.prop] && st.mood !== 'break') {
      const f = Math.floor(t * 2);
      const pb = this.layer(`prop:${st.prop}:${f % 6}`, `${st.prop}${f % 6}`, () => PROPS[st.prop!](f).toCanvas());
      ctx.drawImage(pb, left - pb.width + 8, this.groundY - pb.height + 1);
    }
    if (pose === 'sit' || (pose === 'type' && st.mood === 'idle')) {
      const seat = this.layer('seat', 'seat', () => LOG_SEAT.toCanvas());
      ctx.drawImage(seat, left + 10, this.groundY - seat.height + 1);
    }
    if (st.mood === 'study') {
      // lantern with a flickering glow
      const lx = left + 27;
      const ly = this.groundY - LANTERN.h + 1;
      const fl = Math.sin(t * 9) + Math.sin(t * 13.7) > 0.3 ? 1 : 0;
      const rad = 9 + fl;
      ctx.fillStyle = PALETTE[2];
      for (let y = -rad; y <= rad; y++)
        for (let x = -rad; x <= rad; x++) {
          const d = Math.hypot(x, y);
          const gx = lx + 2 + x;
          const gy = ly + 3 + y;
          if (gy >= this.groundY) continue;
          if (d < rad && bayer(gx, gy) < (1 - d / rad) * 0.45) ctx.fillRect(gx, gy, 1, 1);
        }
      ctx.drawImage(this.layer('lantern', 'l', () => LANTERN.toCanvas()), lx, ly);
    }
    const cv = characterCanvas(st.look, pose, frame, blink);
    if (flip) {
      ctx.save();
      ctx.translate(left + 32, top);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0);
      ctx.restore();
    } else ctx.drawImage(cv, left, top);
    if (st.mood === 'sleepy') {
      const k = (t * 0.6) % 2;
      const zi = k > 1 ? 1 : 0;
      const z = this.layer(`z${zi}`, `z${zi}`, () => ZZZ[zi].toCanvas());
      ctx.drawImage(z, left + 22 + Math.round(k * 3), top + 6 - Math.round(k * 5));
    }
  }
}
