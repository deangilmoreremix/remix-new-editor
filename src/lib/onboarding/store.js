// src/lib/onboarding/store.js
//
// The app-wide SmartVideo onboarding (6 steps, shown right after sign-up):
//   1 what to do first   2 team size   3 videos per month   4 where you work   5 how you heard about us
//   6 what to make first: a video type, then the tools (thumbnails, grouped like the side menu)
// Answers are kept in this browser at once and saved to Supabase (public.app_onboarding, one row per signed-in
// user, readable only by them). If the table is missing or the user is offline, the browser copy is kept.
// Team size, volume, company and source are the same questions Video Outreach asks, so a finished onboarding
// pre-fills that welcome (seedOutreach) instead of asking twice.
import {
  TEAM_SIZES, VOLUMES, SOURCES, normalizeWebsite, workReady,
  loadLocalOnboarding as loadOutreachLocal, saveLocalOnboarding as saveOutreachLocal, cleanOnboarding as cleanOutreach, blankOnboarding as blankOutreach,
} from '../outreach/onboarding.js';
import { GOAL_CARDS, VIDEO_TYPES, toolIds } from './toolCatalog.js';

export const APP_ONBOARDING_KEY = 'smartvideo-app-onboarding-v1';
export const APP_ONBOARDING_STEPS = 6;
export { workReady, normalizeWebsite };

const pick = (list, v) => (list.some((o) => o.id === v) ? v : '');
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const ids = (list, v, max) => [...new Set((Array.isArray(v) ? v : []).filter((x) => list.includes(x)))].slice(0, max);
const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

export function blankAppOnboarding() {
  return {
    step: 1, goal: '', team: '', volume: '', company: '', website: '', jobTitle: '', heard: '', heardOther: '',
    videoTypes: [], tools: [], primaryTool: '', completedAt: null, skippedAt: null, updatedAt: null,
  };
}

/** Only known answers, trimmed and capped (it is stored and shown again). */
export function cleanAppOnboarding(x = {}) {
  const o = x && typeof x === 'object' ? x : {};
  const tools = ids(toolIds(), o.tools, 40);
  return {
    step: Math.min(APP_ONBOARDING_STEPS, Math.max(1, Math.round(Number(o.step) || 1))),
    goal: pick(GOAL_CARDS, o.goal),
    team: pick(TEAM_SIZES, o.team),
    volume: pick(VOLUMES, o.volume),
    company: text(o.company, 120),
    website: text(o.website, 200),
    jobTitle: text(o.jobTitle, 120),
    heard: o.heard === 'other' ? 'other' : pick(SOURCES, o.heard),
    heardOther: text(o.heardOther, 120),
    videoTypes: ids(VIDEO_TYPES.map((t) => t.id), o.videoTypes, 8),
    tools,
    primaryTool: tools.includes(o.primaryTool) ? o.primaryTool : (tools[0] || ''),
    completedAt: iso(o.completedAt),
    skippedAt: iso(o.skippedAt),
    updatedAt: iso(o.updatedAt),
  };
}

export const isAppDone = (o) => !!o?.completedAt;
export const isAppSkipped = (o) => !!o?.skippedAt && !o?.completedAt;

// One browser copy per signed-in user, so people sharing a browser each get their own onboarding.
const localKey = (userId) => `${APP_ONBOARDING_KEY}:${String(userId || 'guest').slice(0, 80)}`;
export function loadLocalAppOnboarding(userId, storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(localKey(userId)) || 'null'); return v ? cleanAppOnboarding(v) : null; } catch { return null; }
}
export function saveLocalAppOnboarding(userId, o, storage = globalThis.localStorage) {
  try { storage?.setItem(localKey(userId), JSON.stringify(cleanAppOnboarding(o))); } catch { /* storage blocked: kept in memory */ }
}

// ---- Supabase (public.app_onboarding) -------------------------------------------------------
export const toAppRow = (o) => {
  const c = cleanAppOnboarding(o);
  return {
    step: c.step, goal: c.goal || null, team_size: c.team || null, videos_per_month: c.volume || null,
    company: c.company || null, website: normalizeWebsite(c.website) || c.website || null, job_title: c.jobTitle || null,
    heard_from: c.heard || null, heard_other: c.heard === 'other' ? c.heardOther || null : null,
    video_types: c.videoTypes, tools: c.tools, primary_tool: c.primaryTool || null,
    completed_at: c.completedAt, skipped_at: c.skippedAt,
  };
};
export const fromAppRow = (r) => cleanAppOnboarding({
  step: r?.step, goal: r?.goal, team: r?.team_size, volume: r?.videos_per_month, company: r?.company, website: r?.website,
  jobTitle: r?.job_title, heard: r?.heard_from, heardOther: r?.heard_other, videoTypes: r?.video_types, tools: r?.tools,
  primaryTool: r?.primary_tool, completedAt: r?.completed_at, skippedAt: r?.skipped_at, updatedAt: r?.updated_at,
});

/** The saved answers, or null (none yet, signed out, or the table is not there). */
export async function fetchAppOnboarding(client) {
  if (!client?.from) return null;
  try {
    const { data, error } = await client.from('app_onboarding').select('*').maybeSingle();
    return error || !data ? null : fromAppRow(data);
  } catch { return null; }
}

/** Saves the answers for the signed-in user; true when stored. */
export async function saveAppOnboarding(client, o, userId) {
  if (!client?.from || !userId) return false;
  try {
    const { error } = await client.from('app_onboarding').upsert({ clerk_user_id: userId, ...toAppRow(o) }, { onConflict: 'clerk_user_id' });
    return !error;
  } catch { return false; }
}

/** The newer of two copies: finished beats skipped beats in progress; on a tie the later edit, then the one further along. */
export function newerAppOnboarding(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const rank = (o) => (isAppDone(o) ? 2 : isAppSkipped(o) ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? a : b;
  const ta = Date.parse(a.updatedAt || '') || 0;
  const tb = Date.parse(b.updatedAt || '') || 0;
  if (ta && tb && ta !== tb) return tb > ta ? b : a;
  return (b.step || 0) > (a.step || 0) ? b : a;
}

/** Whether to send this person to the onboarding: never finished, never skipped, not already open. */
export const shouldPromptOnboarding = (best) => !isAppDone(best) && !isAppSkipped(best);

/**
 * Pre-fills the Video Outreach welcome with what was already answered (never overwrites its own answers and
 * leaves it unfinished, so its goal and first-video steps still run). Returns the saved Outreach record.
 */
export function seedOutreach(userId, a, storage = globalThis.localStorage) {
  const c = cleanAppOnboarding(a);
  const cur = loadOutreachLocal(userId, storage) || blankOutreach();
  const next = cleanOutreach({
    ...cur,
    team: cur.team || c.team,
    volume: cur.volume || c.volume,
    company: cur.company || c.company,
    website: cur.website || c.website,
    jobTitle: cur.jobTitle || c.jobTitle,
    heard: cur.heard || c.heard,
    heardOther: cur.heardOther || c.heardOther,
  });
  saveOutreachLocal(userId, next, storage);
  return next;
}

/** Loads the best copy for a signed-in user (browser + Supabase), keeping the browser copy current. */
export async function loadBestAppOnboarding(userId) {
  const local = loadLocalAppOnboarding(userId);
  let remote = null;
  if (userId) {
    try {
      const { supabase } = await import('../hybrid-supabase.js');
      await supabase.refreshUserHeader?.();
      remote = await fetchAppOnboarding(supabase.supabase);
    } catch { /* offline or signed out */ }
  }
  const best = newerAppOnboarding(local, remote);
  if (best) saveLocalAppOnboarding(userId, best);
  return best;
}

/** Saves to the browser at once and to Supabase when signed in (failures are kept for next time). */
export async function persistAppOnboarding(userId, a) {
  saveLocalAppOnboarding(userId, a);
  if (!userId) return false;
  try {
    const { supabase } = await import('../hybrid-supabase.js');
    await supabase.refreshUserHeader?.();
    return await saveAppOnboarding(supabase.supabase, a, userId);
  } catch { return false; }
}

/** True when this signed-in user has neither finished nor skipped the onboarding (checks the browser copy first). */
export async function needsOnboarding(userId) {
  if (!userId) return false;
  const local = loadLocalAppOnboarding(userId);
  if (local && !shouldPromptOnboarding(local)) return false;
  return shouldPromptOnboarding(await loadBestAppOnboarding(userId));
}

// ---- favorites: the studios picked in step 6 double as "Your studios" (Apps page, side menu) ------------------
export const FAVORITES_EVENT = 'smartvideo:favorites-changed';
const MAX_FAVORITES = 40;

/** Favorite studio ids for this user (the primary one first), from the browser copy. */
export function getFavorites(userId, storage = globalThis.localStorage) {
  const c = loadLocalAppOnboarding(userId, storage);
  if (!c) return [];
  return c.primaryTool ? [c.primaryTool, ...c.tools.filter((t) => t !== c.primaryTool)] : [...c.tools];
}

/** Replaces the favorites (keeps every other answer), saves everywhere and tells the page. Returns the clean list. */
export function setFavorites(userId, list, { persist = true, storage = globalThis.localStorage } = {}) {
  const cur = loadLocalAppOnboarding(userId, storage) || blankAppOnboarding();
  const tools = ids(toolIds(), list, MAX_FAVORITES);
  const next = cleanAppOnboarding({
    ...cur, tools, primaryTool: tools.includes(cur.primaryTool) ? cur.primaryTool : tools[0] || '', updatedAt: new Date().toISOString(),
  });
  saveLocalAppOnboarding(userId, next, storage);
  if (persist && userId) void persistAppOnboarding(userId, next);
  try { globalThis.window?.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { tools: next.tools, primaryTool: next.primaryTool } })); } catch { /* no window */ }
  return next.tools;
}

/** Adds or removes one studio; returns true when it is now a favorite. */
export function toggleFavorite(userId, id, opts) {
  const cur = getFavorites(userId, opts?.storage);
  const on = !cur.includes(id);
  setFavorites(userId, on ? [...cur, id] : cur.filter((x) => x !== id), opts);
  return on;
}
