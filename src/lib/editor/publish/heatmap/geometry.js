/**
 * Pure helpers for heatmap capture (Stage 7). No DOM access, so they are unit-testable.
 * Only normalized geometry and CTA ids ever leave the browser: no text, no selectors, no form values.
 */
export const MOBILE_MAX = 600;   // < 600 px wide  -> mobile
export const TABLET_MAX = 1024;  // < 1024 px wide -> tablet, otherwise desktop
export const PAGE_BUCKET_PX = 400;

export const viewportClass = (width) => (!(width >= MOBILE_MAX) ? 'mobile' : width < TABLET_MAX ? 'tablet' : 'desktop');

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const r4 = (v) => Math.round(v * 10000) / 10000;

/** Viewport point -> 0..1 of the container rect (the watch-page container, scroll-independent). null when unusable. */
export function normalizePoint(clientX, clientY, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return { x: r4(clamp01((clientX - rect.left) / rect.width)), y: r4(clamp01((clientY - rect.top) / rect.height)) };
}

/** Page height in 400 px units (1..40): lets the report group clicks from pages of a similar length. */
export const pageBucket = (heightPx) => Math.min(40, Math.max(1, Math.ceil((Number(heightPx) || 0) / PAGE_BUCKET_PX)));

/**
 * CTA kind from what the player already knows: the link mode (tel:/mailto:/http), a lead form, and the owner's own
 * label wording. Unknown labels stay 'other' (old data without a kind is shown as 'other'; nothing is inferred
 * from viewers).
 */
export function ctaKind({ href = '', label = '', lead = false } = {}) {
  if (lead) return 'lead_capture';
  const h = String(href || '').trim().toLowerCase();
  if (h.startsWith('tel:')) return 'call_now';
  if (h.startsWith('mailto:')) return 'contact';
  const l = String(label || '').toLowerCase();
  if (/\b(book|schedule|appointment|consult|meeting|demo|reserve)/.test(l)) return 'book_call';
  if (/\b(call|phone|ring|dial)\b/.test(l)) return 'call_now';
  if (/\b(offer|deal|discount|coupon|promo|free|save|claim|\d+\s?%)/.test(l)) return 'get_offer';
  if (/\b(contact|email|e-mail|message|reach|enquir|inquir|quote|estimate)/.test(l)) return 'contact';
  if (/\b(visit|website|site|learn|shop|view|see|browse|explore|read|more|details)\b/.test(l)) return 'visit_website';
  if (/^https?:/.test(h)) return 'visit_website';
  return 'other';
}

/** Seconds (ints, one play-through) -> [[first,last],...] ranges, e.g. [3,4,5,9] -> [[3,5],[9,9]]. */
export function toRanges(seconds) {
  const s = [...new Set(seconds.filter((n) => Number.isInteger(n) && n >= 0 && n <= 3599))].sort((a, b) => a - b);
  const out = [];
  for (const n of s) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  }
  return out;
}

/** Scroll depth 0..1 = how far down the page the bottom of the viewport has reached. */
export function scrollDepth({ scrollTop = 0, viewportHeight = 0, pageHeight = 0 } = {}) {
  if (!(pageHeight > 0) || !(viewportHeight > 0)) return 0;
  return clamp01((scrollTop + viewportHeight) / pageHeight);
}
export const SCROLL_MILESTONES = Object.freeze([25, 50, 75, 100]);
/** Milestones newly reached at `depth` (0..1); 100 allows 1 px rounding slack. */
export const milestonesReached = (depth, already = new Set()) =>
  SCROLL_MILESTONES.filter((m) => !already.has(m) && depth * 100 >= (m === 100 ? 99.5 : m));

/**
 * Click gate: per-session cap and duplicate suppression (same ~1% cell within `dedupeMs`, e.g. a double click).
 * The server enforces the same cap, so a tampered client cannot exceed it.
 */
export function createClickGate({ maxClicks = 30, dedupeMs = 400 } = {}) {
  let count = 0;
  let last = null;
  return {
    allow(point, now) {
      if (count >= maxClicks) return false;
      const cell = `${Math.floor(point.x * 100)}:${Math.floor(point.y * 100)}`;
      if (last && last.cell === cell && now - last.at < dedupeMs) return false;
      last = { cell, at: now };
      count += 1;
      return true;
    },
    count: () => count,
  };
}
