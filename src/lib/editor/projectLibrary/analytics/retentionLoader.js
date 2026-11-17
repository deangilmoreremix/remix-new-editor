/**
 * Loads retention curves for many published videos.
 *
 * Fast path: ONE request (`video_retention_curves`) for every video. If that
 * function is not available (not deployed yet, or any error), it falls back to
 * one `video_retention_curve` request per video, a few at a time, so callers
 * work either way.
 *
 * A curve is only returned for a video that has data (`base > 0`): no data, a
 * failed request, or a video the caller does not own all mean "no entry".
 */
import { periodRange, retentionPoints } from './analyticsData.js';

const BATCH_SIZE = 10;        // 100 rows per video x 10 = 1,000, the API's default max rows per response (the database function itself accepts up to 200 ids)
const DEFAULT_CONCURRENCY = 4;

// Once the batch function is known to be missing, skip it for the rest of the page's life.
let batchMissing = false;
export const resetRetentionLoader = () => { batchMissing = false; };

const isMissingFunction = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  return code === '42883' || code === 'PGRST202' || /could not find the function|function .* does not exist/i.test(msg);
};

/**
 * @param {{rpc: Function}} client  signed-in database client
 * @param {string[]} videoIds
 * @param {{period?: string, concurrency?: number, onCurve?: (id: string, points: object[]) => void, isCancelled?: () => boolean}} [opts]
 * @returns {Promise<Record<string, {positionPercent: number, retentionPercent: number}[]>>}
 */
export async function loadRetentionCurves(client, videoIds, { period = '30d', concurrency = DEFAULT_CONCURRENCY, onCurve, isCancelled } = {}) {
  const ids = [...new Set((videoIds || []).filter((id) => typeof id === 'string' && id))];
  const out = {};
  if (!ids.length) return out;
  const { from, to } = periodRange(period);
  const cancelled = () => !!isCancelled?.();
  const accept = (id, rows) => {
    const points = retentionPoints(rows);
    if (!points.length) return;
    out[id] = points;
    // A consumer's error must never be mistaken for a failed request (that would refetch everything).
    try { onCurve?.(id, points); } catch { /* ignore consumer errors */ }
  };

  if (!batchMissing) {
    try {
      const grouped = {};
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        if (cancelled()) return out;
        const { data, error } = await client.rpc('video_retention_curves', { p_video_ids: ids.slice(i, i + BATCH_SIZE), p_from: from, p_to: to });
        if (error) throw error;
        for (const row of data || []) (grouped[row.video_id] ||= []).push(row);
      }
      if (cancelled()) return out;
      Object.entries(grouped).forEach(([id, rows]) => accept(id, rows));
      return out;
    } catch (error) {
      if (isMissingFunction(error)) batchMissing = true;
      // Any batch failure falls through to the per-video requests below.
    }
  }

  let next = 0;
  async function worker() {
    while (next < ids.length && !cancelled()) {
      const id = ids[next++];
      try {
        const { data, error } = await client.rpc('video_retention_curve', { p_video_id: id, p_from: from, p_to: to });
        if (error) throw error;
        if (!cancelled()) accept(id, data);
      } catch { /* this video simply has no curve */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), ids.length) }, worker));
  return out;
}
