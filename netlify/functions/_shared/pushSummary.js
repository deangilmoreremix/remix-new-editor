/**
 * "While you were away": one summary Web Push per owner for the pushes that quiet hours held back
 * (rows in owner_push_deferred, written by dispatchPush). Called every 15 minutes by push-quiet-flush.
 *
 * Rules: an owner is flushed only when quiet hours are not active any more; if push (or the summary) has been
 * switched off in the meantime their rows are dropped without sending; counts only include types that are
 * enabled for push NOW. The summary is sent FIRST and only the rows that were included are deleted afterwards,
 * so an overlapping run may send a duplicate summary but a summary is never lost.
 * Never logs endpoints, keys or payload bodies.
 */
import { inQuietHours } from './emailAdapter.js';
import {
  CATEGORY_BY_TYPE, DEEP_LINK, vapidFrom, prepareWebPush, pushTypeBlock, loadSubscriptions, sendToSubscriptions,
} from './pushAdapter.js';
import { rest, supabaseConfig, inList } from './supabaseRest.js';

export const SUMMARY_TAG = 'quiet-summary';
export const SUMMARY_TITLE = 'While you were away';
export const DEFERRED_TTL_MS = 3 * 24 * 3600_000;
const ROW_LIMIT = 1000;
const DELETE_CHUNK = 50;

const LABELS = [['New lead', 'new lead', 'new leads'], ['Retarget', 'retarget alert', 'retarget alerts'], ['Video', 'video update', 'video updates']];

/** Notification types -> counts per category. */
export function summaryCounts(types) {
  const counts = {};
  for (const t of types) { const c = CATEGORY_BY_TYPE[t]; if (c) counts[c] = (counts[c] || 0) + 1; }
  return counts;
}

/** Payload for the service worker, e.g. "3 new leads, 2 retarget alerts, 1 video update". */
export function buildSummaryPayload(counts) {
  const body = LABELS.filter(([c]) => counts[c] > 0).map(([c, one, many]) => `${counts[c]} ${counts[c] === 1 ? one : many}`).join(', ');
  return { title: SUMMARY_TITLE, body, tag: SUMMARY_TAG, type: 'quiet_summary', url: DEEP_LINK };
}

async function deleteRows(call, ids) {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) await call(`owner_push_deferred?id=${inList(ids.slice(i, i + DELETE_CHUNK))}`, { method: 'DELETE' });
}

/** What to do with one owner's deferred rows: { action: 'hold' | 'drop' | 'send', counts? } */
export function planFlush(prefs, types, now) {
  if (!prefs) return { action: 'drop', why: 'no_preferences' };
  if (inQuietHours(prefs.quiet_hours, now)) return { action: 'hold' };
  if (prefs.push !== true) return { action: 'drop', why: 'push_disabled' };
  if (prefs.quiet_hours?.summary === false) return { action: 'drop', why: 'summary_off' };
  const counts = summaryCounts(types.filter((t) => !pushTypeBlock(prefs, t)));
  return Object.keys(counts).length ? { action: 'send', counts } : { action: 'drop', why: 'no_types' };
}

/** Flush one owner. Returns 'held' | 'dropped' | 'sent' | 'retry'. */
async function flushOwner({ call, rows, prefs, vapid, webpush, now, wpRef }) {
  const ids = rows.map((r) => r.id);
  const plan = planFlush(prefs, rows.map((r) => r.type), now);
  if (plan.action === 'hold') return 'held';
  if (plan.action === 'drop') { await deleteRows(call, ids); return 'dropped'; }
  const subs = await loadSubscriptions(call, rows[0].clerk_user_id);
  if (!subs?.length) { await deleteRows(call, ids); return 'dropped'; }
  wpRef.wp = wpRef.wp || await prepareWebPush(vapid, webpush);
  const res = await sendToSubscriptions({ call, wp: wpRef.wp, subs, payload: buildSummaryPayload(plan.counts), now });
  if (res.sent > 0 || (res.failed === 0 && res.removed > 0)) { await deleteRows(call, ids); return res.sent > 0 ? 'sent' : 'dropped'; }
  return 'retry'; // every device failed this time: keep the rows for the next run (they are pruned after 3 days)
}

export async function flushQuietSummaries({ env = process.env, fetchImpl = fetch, webpush, now = new Date() } = {}) {
  const cfg = supabaseConfig(env);
  if (!cfg.url || !cfg.key) return { ok: false, error: 'not_configured' };
  const vapid = vapidFrom(env);
  if (!vapid) return { ok: true, reason: 'not_configured' }; // nothing is deleted, so nothing is lost once push is configured
  const call = rest(cfg, fetchImpl);
  const out = { ok: true, pruned: 0, owners: 0, sent: 0, held: 0, dropped: 0, retry: 0, errors: 0 };
  try {
    const old = await call(`owner_push_deferred?created_at=lt.${encodeURIComponent(new Date(now.getTime() - DEFERRED_TTL_MS).toISOString())}&select=id`, { method: 'DELETE', prefer: 'return=representation' });
    out.pruned = Array.isArray(old) ? old.length : 0;
    const rows = await call(`owner_push_deferred?select=id,clerk_user_id,type&order=created_at.asc&limit=${ROW_LIMIT}`);
    if (!rows?.length) return out;
    const byOwner = new Map();
    for (const r of rows) byOwner.set(r.clerk_user_id, [...(byOwner.get(r.clerk_user_id) || []), r]);
    const prefRows = await call(`retarget_preferences?select=*&clerk_user_id=${inList([...byOwner.keys()])}`);
    const prefs = Object.fromEntries((prefRows || []).map((p) => [p.clerk_user_id, p]));
    const wpRef = {};
    for (const [owner, ownerRows] of byOwner) {
      out.owners += 1;
      try {
        const status = await flushOwner({ call, rows: ownerRows, prefs: prefs[owner], vapid, webpush, now, wpRef });
        out[status] += 1;
      } catch { out.errors += 1; }
    }
  } catch (err) {
    if (err?.status === 404) return { ...out, reason: 'table_unavailable' }; // migration not applied yet
    return { ...out, ok: false, error: 'flush_failed' };
  }
  return out;
}
