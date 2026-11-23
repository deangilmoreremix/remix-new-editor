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
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 10; // at most 10,000 deferred rows are looked at per run; the rest wait for the next run
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

/**
 * Every deferred row, oldest first, read page by page BEFORE anything is flushed (so deleting rows cannot shift a later page).
 * A single page of the oldest rows is not enough: if those belong to owners still in quiet hours (or whose devices keep failing)
 * they are held again and again and every owner behind them would never be flushed.
 */
async function loadDeferredRows(call) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await call(`owner_push_deferred?select=id,clerk_user_id,type&order=created_at.asc,id.asc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
    if (!Array.isArray(batch)) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  // Every allowed page was full: is there anything beyond them? (exact, so `truncated` can be used to watch the backlog)
  const beyond = await call(`owner_push_deferred?select=id&order=created_at.asc,id.asc&limit=1&offset=${MAX_PAGES * PAGE_SIZE}`);
  return { rows, truncated: Array.isArray(beyond) && beyond.length > 0 };
}

/**
 * Preferences for these owners, read in small chunks: one request for thousands of ids is cut off by the URL length limit, and a
 * single answer is capped at 1,000 rows, so an owner could silently come back "without preferences" and have its rows dropped.
 */
const PREF_CHUNK = 100;
async function loadPreferences(call, ownerIds) {
  const prefs = {};
  for (let i = 0; i < ownerIds.length; i += PREF_CHUNK) {
    const chunk = await call(`retarget_preferences?select=*&clerk_user_id=${inList(ownerIds.slice(i, i + PREF_CHUNK))}`);
    for (const p of Array.isArray(chunk) ? chunk : []) prefs[p.clerk_user_id] = p;
  }
  return prefs;
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
    const { rows, truncated } = await loadDeferredRows(call);
    if (truncated) out.truncated = true;
    if (!rows.length) return out;
    const byOwner = new Map();
    for (const r of rows) { if (!byOwner.has(r.clerk_user_id)) byOwner.set(r.clerk_user_id, []); byOwner.get(r.clerk_user_id).push(r); }
    const prefs = await loadPreferences(call, [...byOwner.keys()]);
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
