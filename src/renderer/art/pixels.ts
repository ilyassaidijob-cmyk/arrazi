// Tiny palette-indexed pixel buffers. All Arrazi art is drawn into these and only ever
// uses the five grays of the reference picture.

export const PALETTE = ['#0b0b0b', '#1e1e1e', '#6c6c6c', '#a8a8a8', '#e6e6e6'] as const;
export const RGB: [number, number, number][] = [
  [11, 11, 11],
  [30, 30, 30],
  [108, 108, 108],
  [168, 168, 168],
  [230, 230, 230],
];
export const T = 255; // transparent

export class PixBuf {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h).fill(T);
  }
  set(x: number, y: number, c: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T;
    return this.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  hline(x0: number, x1: number, y: number, c: number) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
  }
  vline(x: number, y0: number, y1: number, c: number) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: number) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) this.set(cx + x, cy + y, c);
  }
  /**
   * Draws ASCII art. Digits 0-4 are palette shades, '.' and ' ' are transparent.
   * `map` can remap letters to shades (e.g. { H: hairShade }).
   */
  ascii(x: number, y: number, rows: string[], map: Record<string, number> = {}, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        let c: number | undefined;
        if (ch >= '0' && ch <= '4') c = ch.charCodeAt(0) - 48;
        else if (ch in map) c = map[ch];
        if (c === undefined || c === T) continue;
        this.set(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }
    }
  }
  /** Adds a 1px outline around every opaque shape (4-neighbourhood). */
  outline(c = 0, diagonal = false) {
    const src = this.data.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? T : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== T) continue;
        let near = at(x - 1, y) !== T || at(x + 1, y) !== T || at(x, y - 1) !== T || at(x, y + 1) !== T;
        if (!near && diagonal)
          near = at(x - 1, y - 1) !== T || at(x + 1, y - 1) !== T || at(x - 1, y + 1) !== T || at(x + 1, y + 1) !== T;
        if (near) this.data[y * this.w + x] = c;
      }
    return this;
  }
  /** Replace a shade everywhere (e.g. darken for "locked" states) */
  map(fn: (c: number) => number) {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== T) this.data[i] = fn(this.data[i]);
    return this;
  }
  blit(src: PixBuf, x: number, y: number, flip = false) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const c = src.data[j * src.w + i];
        if (c !== T) this.set(flip ? x + src.w - 1 - i : x + i, y + j, c);
      }
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === T) continue;
      const [r, g, b] = RGB[c];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

/** Ordered 2x2 dither test: true for half of the pixels in a checker pattern */
export const checker = (x: number, y: number) => ((x + y) & 1) === 0;
/** Sparse dither: one pixel in four */
export const sparse = (x: number, y: number) => (x & 1) === 0 && (y & 1) === 0;

const urlCache = new Map<string, string>();
const sizes = new Map<string, [number, number]>();
/** Cached data URL for a buffer factory, for use in <img> tags */
export function dataUrl(key: string, make: () => PixBuf): string {
  let u = urlCache.get(key);
  if (!u) {
    const b = make();
    u = b.toCanvas().toDataURL('image/png');
    urlCache.set(key, u);
    sizes.set(u, [b.w, b.h]);
    if (urlCache.size > 900) {
      const k = urlCache.keys().next().value as string;
      sizes.delete(urlCache.get(k)!);
      urlCache.delete(k);
    }
  }
  return u;
}

/** Pixel size of an image made by dataUrl() */
export function urlSize(url: string): [number, number] {
  return sizes.get(url) ?? [16, 16];
}
