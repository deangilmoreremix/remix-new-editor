// Browser-side harness (bundled by scripts/lib/glt-webgl-check.mjs, run in headless Chromium).
// Renders every vendored shader through the REAL gl/runtime.ts at progress 0 / 0.5 / 1 and reports the
// mean absolute RGB difference to the outgoing / incoming source image.
import { createGlRuntime } from '../../../runtime';
import { GLT_CATALOG, gltFrag, gltUniforms, type GltParams } from '../../index';

const W = 160;
const H = 90;

function source(kind: 'from' | 'to'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const g = kind === 'from' ? x.createLinearGradient(0, 0, W, H) : x.createLinearGradient(W, 0, 0, H);
  if (kind === 'from') { g.addColorStop(0, '#e8602a'); g.addColorStop(1, '#f2d16b'); } else { g.addColorStop(0, '#1b4fd6'); g.addColorStop(1, '#2fd6b0'); }
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = kind === 'from' ? '#2b1a12' : '#f4f6ff';
  for (let i = 0; i < 8; i++) { x.fillRect((i * 23) % W, (i * 37) % H, 18, 12); }
  x.beginPath(); x.arc(kind === 'from' ? 50 : 110, 45, 22, 0, Math.PI * 2); x.fill();
  return c;
}
const pixels = (c: HTMLCanvasElement | OffscreenCanvas | HTMLImageElement): Uint8ClampedArray => {
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const x = t.getContext('2d')!; x.drawImage(c as CanvasImageSource, 0, 0, W, H);
  return x.getImageData(0, 0, W, H).data;
};
const meanDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  let s = 0; let n = 0;
  for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; }
  return s / n;
};

const from = source('from');
const to = source('to');
const fromPx = pixels(from);
const toPx = pixels(to);

const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
let runtime = createGlRuntime(glCanvas);

export interface CheckResult { id: string; ok: boolean; error?: string; d0?: number; d1?: number; mid?: { toFrom: number; toTo: number }; ms?: number }

(window as unknown as { __glt: unknown }).__glt = {
  ids: GLT_CATALOG.map((e) => e.id),
  lost: () => false,
  frame(id: string, progress: number, params?: GltParams): { error?: string; px?: number[] } {
    try {
      const frag = gltFrag(id)!;
      runtime.render(frag, from, to, progress, gltUniforms(id, params));
      return { px: Array.from(pixels(glCanvas)) };
    } catch (e) { return { error: String(e instanceof Error ? e.message : e).slice(0, 600) }; }
  },
  check(id: string): CheckResult {
    const t0 = performance.now();
    try {
      const frag = gltFrag(id)!;
      const u = gltUniforms(id);
      runtime.render(frag, from, to, 0, u); const p0 = pixels(glCanvas);
      runtime.render(frag, from, to, 0.5, u); const pm = pixels(glCanvas);
      runtime.render(frag, from, to, 1, u); const p1 = pixels(glCanvas);
      return { id, ok: true, d0: meanDiff(p0, fromPx), d1: meanDiff(p1, toPx), mid: { toFrom: meanDiff(pm, fromPx), toTo: meanDiff(pm, toPx) }, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { id, ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 600) };
    }
  },
  reset() { runtime.dispose(); runtime = createGlRuntime(glCanvas); },
};
