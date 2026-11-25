// Scrolling website backgrounds (TimelineComposition.jsx MediaLayerBody).

/**
 * How far down a scrolling page is (0 = top, 1 = bottom) at `p` (0..1) through the clip. With `back`, the page
 * scrolls down for the first 70% and back up to the top after (Video Outreach "Scroll back up").
 */
export function scrollAt(p, back = false) {
  const x = Math.max(0, Math.min(1, Number(p) || 0));
  if (!back) return x;
  return x < 0.7 ? x / 0.7 : Math.max(0, 1 - (x - 0.7) / 0.3);
}
