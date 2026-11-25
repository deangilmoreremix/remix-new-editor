// Template favorites that follow the account, and "trending" from real usage.
//
//   - Favorites: kept in localStorage (templateUx.js) and, for signed-in people, mirrored to the
//     template_favorites table so they appear on every device. Signing in merges both lists.
//   - Trending: template_popularity() ranks templates by how many different signed-in people opened
//     (1 point) or favorited (3 points) them in the last 30 days.
//
// Everything degrades to the browser-only behaviour when Supabase is not configured, the person is
// signed out, or the tables from 20261120090000_template_favorites_and_popularity.sql do not exist yet.
import { supabase, primeSupabaseIdentity, getClerkUserId, isSupabaseConfigured } from './supabase.js';
import { getFavoriteTemplateIds, setFavoriteTemplateIds } from './templateUx.js';

export const TRENDING_WINDOW_DAYS = 30;

export const isCloudReady = () => {
  try { return Boolean(isSupabaseConfigured() && getClerkUserId()); } catch { return false; }
};

async function client() {
  await primeSupabaseIdentity();
  return supabase;
}

let syncing = null;

/**
 * Merge the account's favorites with this browser's, save the union to both, and return it
 * (newest local picks first). Never throws; returns the local list when the cloud is unavailable.
 */
export function syncFavorites() {
  if (!isCloudReady()) return Promise.resolve(getFavoriteTemplateIds());
  if (syncing) return syncing;
  syncing = (async () => {
    const local = getFavoriteTemplateIds();
    try {
      const db = await client();
      const { data, error } = await db.from('template_favorites').select('template_id').order('created_at', { ascending: false });
      if (error) throw error;
      const cloud = (data || []).map((r) => r.template_id);
      const merged = [...local, ...cloud.filter((id) => !local.includes(id))];
      const localOnly = local.filter((id) => !cloud.includes(id));
      if (localOnly.length) {
        await db.from('template_favorites').upsert(localOnly.map((template_id) => ({ template_id })), { onConflict: 'clerk_user_id,template_id', ignoreDuplicates: true });
      }
      if (merged.length !== local.length || merged.some((id, i) => id !== local[i])) setFavoriteTemplateIds(merged);
      return merged;
    } catch {
      return local;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function recordEvent(templateId, kind) {
  if (!isCloudReady() || !templateId) return;
  try { await (await client()).rpc('record_template_event', { p_template_id: templateId, p_kind: kind }); } catch { /* ranking is optional */ }
}

async function saveFavorite(templateId, on) {
  if (!isCloudReady() || !templateId) return;
  try {
    const db = await client();
    if (on) {
      await db.from('template_favorites').upsert([{ template_id: templateId }], { onConflict: 'clerk_user_id,template_id', ignoreDuplicates: true });
      await recordEvent(templateId, 'favorite');
    } else {
      await db.from('template_favorites').delete().eq('template_id', templateId);
    }
  } catch { /* the browser copy still has it; the next sync pushes it */ }
}

/** Template ids ranked by recent usage, best first. Empty when there is no usage data (or no backend). */
export async function fetchTrendingTemplateIds(limit = 8, days = TRENDING_WINDOW_DAYS) {
  if (!isSupabaseConfigured()) return [];
  try {
    const db = await client();
    const { data, error } = await db.rpc('template_popularity', { p_days: days, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data.filter((r) => r && r.template_id && Number(r.score) > 0).map((r) => r.template_id);
  } catch {
    return [];
  }
}

let installed = false;
/** Start mirroring favorite toggles and template opens to the account. Safe to call many times. */
export function installTemplateSync() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('template-favorite-toggled', (e) => { saveFavorite(e.detail?.id, Boolean(e.detail?.on)); });
  window.addEventListener('template-opened', (e) => { recordEvent(e.detail?.id, 'open'); });
}

installTemplateSync();
