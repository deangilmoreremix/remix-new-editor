/**
 * Heatmap bars for a video: `count` slices across its runtime, each one the
 * retention % of the measured point nearest to that slice. Shared by the
 * Engagement tab and the Projects cards so the two always agree.
 *
 * @param {{positionPercent: number, retentionPercent: number}[]} retention
 * @param {number} [count=34]
 * @returns {number[]} one retention % per slice ([] when there is no data)
 */
export function heatBuckets(retention, count = 34) {
  const points = Array.isArray(retention) ? retention : [];
  if (!points.length || !Number.isInteger(count) || count < 1) return [];
  return Array.from({ length: count }, (_, i) => {
    const position = count === 1 ? 0 : (i / (count - 1)) * 100;
    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.positionPercent - position) < Math.abs(best.positionPercent - position)) best = p;
    }
    return best.retentionPercent;
  });
}

/** Bar height (%) for one slice: clamped, with a floor so a drop to 0% is still visible. */
export const heatBarHeight = (value) => Math.max(7, Math.min(100, Number(value) || 0));
