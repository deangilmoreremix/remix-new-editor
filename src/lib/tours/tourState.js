// src/lib/tours/tourState.js
//
// Which guided tours a person has seen. Kept in this browser at once (localStorage, one copy per signed-in user)
// and saved to Supabase (public.app_tour_progress, one row per user and tour) so it follows them across devices.
// "Seen" only ever grows, so two copies are merged as a union (the later seenAt wins per tour). A tour is seen
// when the saved version is at least the tour's version, so bumping a tour's version shows it again.
// The special id '__disabled__' records "turn off guided tours".

export const TOURS_KEY = 'smartvideo-tours-v1';
export const DISABLED_ID = '__disabled__';

const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/** { tourId: { version, seenAt } } with only valid entries. */
export function cleanTours(x = {}) {
  const out = {};
  if (!x || typeof x !== 'object') return out;
  for (const [id, v] of Object.entries(x)) {
    if (!id || id.length > 60 || !v || typeof v !== 'object') continue;
    const version = Math.round(Number(v.version));
    const seenAt = iso(v.seenAt);
    if (version >= 1 && version <= 1000 && seenAt) out[id] = { version, seenAt };
  }
  return out;
}

/** Union of two copies: per tour the higher version, then the later seenAt. */
export function mergeTours(a, b) {
  const out = { ...cleanTours(a) };
  for (const [id, v] of Object.entries(cleanTours(b))) {
    const cur = out[id];
    if (!cur || v.version > cur.version || (v.version === cur.version && v.seenAt > cur.seenAt)) out[id] = v;
  }
  return out;
}

export const hasSeen = (tours, id, version = 1) => (tours?.[id]?.version || 0) >= version;
export const toursDisabled = (tours) => !!tours?.[DISABLED_ID];

const localKey = (userId) => `${TOURS_KEY}:${String(userId || 'guest').slice(0, 80)}`;
export function loadLocalTours(userId, storage = globalThis.localStorage) {
  try { return cleanTours(JSON.parse(storage?.getItem(localKey(userId)) || '{}')); } catch { return {}; }
}
export function saveLocalTours(userId, tours, storage = globalThis.localStorage) {
  try { storage?.setItem(localKey(userId), JSON.stringify(cleanTours(tours))); } catch { /* storage blocked: kept in memory */ }
}

// ---- Supabase (public.app_tour_progress) -------------------------------------------------------
export const toToursRows = (tours, userId) => Object.entries(cleanTours(tours)).map(([tour_id, v]) => ({ clerk_user_id: userId, tour_id, version: v.version, seen_at: v.seenAt }));
export const fromToursRows = (rows) => cleanTours(Object.fromEntries((Array.isArray(rows) ? rows : []).map((r) => [r?.tour_id, { version: r?.version, seenAt: r?.seen_at }])));

/** The saved tours, or null (signed out, offline, or the table is not there). */
export async function fetchTours(client) {
  if (!client?.from) return null;
  try {
    const { data, error } = await client.from('app_tour_progress').select('tour_id, version, seen_at');
    return error || !Array.isArray(data) ? null : fromToursRows(data);
  } catch { return null; }
}

/** Saves tour rows for the signed-in user; true when stored. */
export async function saveTours(client, tours, userId) {
  const rows = toToursRows(tours, userId);
  if (!client?.from || !userId || !rows.length) return false;
  try {
    const { error } = await client.from('app_tour_progress').upsert(rows, { onConflict: 'clerk_user_id,tour_id' });
    return !error;
  } catch { return false; }
}

/** Deletes the signed-in user's tour rows (Reset all tours). */
export async function deleteTours(client) {
  if (!client?.from) return false;
  try {
    const { error } = await client.from('app_tour_progress').delete().neq('tour_id', '');
    return !error;
  } catch { return false; }
}

async function ownerClient() {
  const { supabase } = await import('../hybrid-supabase.js');
  await supabase.refreshUserHeader?.();
  return supabase.supabase;
}

/** Best copy for a person (browser + Supabase), keeping the browser copy current. */
export async function loadBestTours(userId) {
  const local = loadLocalTours(userId);
  let remote = null;
  if (userId) { try { remote = await fetchTours(await ownerClient()); } catch { /* offline */ } }
  const best = mergeTours(local, remote);
  saveLocalTours(userId, best);
  return best;
}

/** Records that a tour was seen (browser at once, Supabase when signed in). Returns the new map. */
export async function markTourSeen(userId, tourId, version = 1, current = null, now = new Date().toISOString()) {
  const next = mergeTours(current || loadLocalTours(userId), { [tourId]: { version, seenAt: now } });
  saveLocalTours(userId, next);
  if (userId) { try { await saveTours(await ownerClient(), { [tourId]: next[tourId] }, userId); } catch { /* saved next time */ } }
  return next;
}

/** Turn guided tours off or on (a '__disabled__' marker). */
export async function setToursDisabled(userId, disabled, current = null) {
  if (disabled) return markTourSeen(userId, DISABLED_ID, 1, current);
  const next = { ...(current || loadLocalTours(userId)) };
  delete next[DISABLED_ID];
  saveLocalTours(userId, next);
  if (userId) { try { await (await ownerClient()).from('app_tour_progress').delete().eq('tour_id', DISABLED_ID); } catch { /* ignore */ } }
  return next;
}

/** Forget every tour (they all show again), in this browser and in Supabase. */
export async function resetTours(userId) {
  saveLocalTours(userId, {});
  if (userId) { try { await deleteTours(await ownerClient()); } catch { /* ignore */ } }
  return {};
}
