import { containRect, type Mask } from './maskMath';
import type { CutoutPresenter } from './cutoutSettings';

/**
 * Where the cut-out presenter actually is in the video frame, as a zone the layout check protects, so a logo or text is not
 * placed on their face. Pure: masks in, a normalized rectangle out.
 */
export interface Rect01 {
  x: number
  y: number
  w: number
  h: number
}

/** Tight bounds (0..1 of the mask) of the pixels at or above `threshold`, or null when the mask is empty. */
export function maskBounds(mask: Mask, threshold = 128, minPixels = 6): Rect01 | null {
  let minX = mask.w, minY = mask.h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < mask.h; y++) {
    const row = y * mask.w;
    for (let x = 0; x < mask.w; x++) {
      if (mask.data[row + x] >= threshold) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < minPixels || maxX < 0) return null;
  return { x: minX / mask.w, y: minY / mask.h, w: (maxX + 1 - minX) / mask.w, h: (maxY + 1 - minY) / mask.h };
}

export function unionRects(rects: (Rect01 | null)[]): Rect01 | null {
  const list = rects.filter((r): r is Rect01 => r !== null);
  if (list.length === 0) return null;
  const x0 = Math.min(...list.map((r) => r.x));
  const y0 = Math.min(...list.map((r) => r.y));
  const x1 = Math.max(...list.map((r) => r.x + r.w));
  const y1 = Math.max(...list.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The presenter's union bounds over the sampled masks (every `step`th mask is enough). */
export function presenterBounds(masks: Mask[], step = 3): Rect01 | null {
  const picked = masks.filter((_, i) => i % Math.max(1, step) === 0);
  return unionRects(picked.map((m) => maskBounds(m)));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The presenter's rectangle in the composition (0..1), after the same contain-fit and presenter transform (position, size, tilt)
 * the cut-out is drawn with, plus a margin (head-room above is larger so a logo is kept off the hair line).
 */
export function presenterZone(bounds: Rect01, sourceAspect: number, presenter: CutoutPresenter, compW: number, compH: number, margin = { x: 0.02, top: 0.05, bottom: 0.02 }): Rect01 {
  const rect = containRect(sourceAspect * 1000, 1000, compW, compH);
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.w, bounds.y],
    [bounds.x, bounds.y + bounds.h],
    [bounds.x + bounds.w, bounds.y + bounds.h],
  ].map(([bx, by]) => {
    const px = rect.x + bx * rect.w - compW / 2;
    const py = rect.y + by * rect.h - compH / 2;
    const a = (presenter.rotation * Math.PI) / 180;
    const x = presenter.x * compW + presenter.scale * (px * Math.cos(a) - py * Math.sin(a));
    const y = presenter.y * compH + presenter.scale * (px * Math.sin(a) + py * Math.cos(a));
    return [x / compW, y / compH];
  });
  const x0 = Math.min(...corners.map((c) => c[0])) - margin.x;
  const x1 = Math.max(...corners.map((c) => c[0])) + margin.x;
  const y0 = Math.min(...corners.map((c) => c[1])) - margin.top;
  const y1 = Math.max(...corners.map((c) => c[1])) + margin.bottom;
  const x = clamp01(x0);
  const y = clamp01(y0);
  return { x, y, w: Math.max(0, clamp01(x1) - x), h: Math.max(0, clamp01(y1) - y) };
}
