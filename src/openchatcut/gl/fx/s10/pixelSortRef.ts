// [remix] Fix G: CPU reference of the Pixel Sort shader (same pair rule, float64 keys). Used by unit tests and by the browser smoke.
export interface Px { r: number; g: number; b: number; a: number } // 0..1
export interface SortParams { low: number; high: number; key: number; axis: number; ascending: number; length: number; invert: number }

export function sortKey(p: Px, key: number): number {
  const mx = Math.max(p.r, p.g, p.b); const mn = Math.min(p.r, p.g, p.b); const d = mx - mn;
  const k = Math.round(key);
  if (k === 0) return 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
  if (k === 3) return mx;
  if (k === 2) return mx > 0 ? d / mx : 0;
  if (d < 1e-6) return 0;
  let h: number;
  if (mx === p.r) { const x = (p.g - p.b) / d; h = x - 6 * Math.floor(x / 6); } else if (mx === p.g) h = (p.b - p.r) / d + 2; else h = (p.r - p.g) / d + 4;
  return h / 6;
}
export function isMasked(p: Px, s: SortParams): boolean {
  const k = sortKey(p, s.key);
  const inside = k >= s.low && k <= s.high;
  return p.a > 0 && (s.invert > 0.5 ? !inside : inside);
}

/** Sort a w*h image (row-major, top-down rows). Returns a new array. */
export function pixelSortCpu(src: Px[], w: number, h: number, s: SortParams): Px[] {
  let cur = src.slice();
  const vert = s.axis > 0.5;
  const steps = Math.max(0, Math.min(64, Math.round(s.length)));
  const lines = vert ? w : h; const len = vert ? h : w;
  const at = (line: number, i: number) => (vert ? i * w + line : line * w + i);
  for (let pass = 0; pass < steps; pass++) {
    const next = cur.slice();
    for (let line = 0; line < lines; line++) {
      for (let i = (pass & 1); i + 1 < len; i += 2) { // pairs (i, i+1) with (i + pass) even
        const a = cur[at(line, i)]; const b = cur[at(line, i + 1)];
        if (!isMasked(a, s) || !isMasked(b, s)) continue;
        const ka = sortKey(a, s.key); const kb = sortKey(b, s.key);
        if (s.ascending > 0.5 ? ka > kb : ka < kb) { next[at(line, i)] = b; next[at(line, i + 1)] = a; }
      }
    }
    cur = next;
  }
  return cur;
}
