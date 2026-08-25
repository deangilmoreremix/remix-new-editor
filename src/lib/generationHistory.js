/**
 * Generation History — Unified save/load for AI-generated content.
 *
 * Saves completed generations to BOTH localStorage (immediate, offline-first)
 * and Supabase `generation_history` table (persistence, cross-device, Library Studio).
 *
 * The Supabase write is fire-and-forget: if it fails or the user is offline,
 * the localStorage copy ensures no content is lost.
 */

import { isSupabaseConfigured, getSupabaseUrl } from './supabase.js';
import { getUserKey } from './userKey.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 100;

// Map studio component names to the DB CHECK-constraint values
const STUDIO_TYPE_MAP = {
  image: 'image',
  video: 'video',
  cinema: 'cinema',
  template: 'image',    // templates produce images
  effects: 'effects',
  character: 'character',
  edit: 'edit',
  upscale: 'upscale',
  storyboard: 'storyboard',
  commercial: 'commercial',
};

/** @param {string} studio */
function normalizeStudioType(studio) {
  return STUDIO_TYPE_MAP[studio] || 'image';
}

function getStorageKey(type) {
  return (type === 'video' || type === 'audio') ? 'video_history' : 'muapi_history';
}

// ---------------------------------------------------------------------------
// Internal: Supabase persistence via Edge Function
// ---------------------------------------------------------------------------

/** Resolve the Edge Function base URL. */
function getFunctionUrl() {
  const baseUrl = getSupabaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/functions/v1/generation-history`;
}

/**
 * Fire-and-forget save to Supabase `generation_history` table.
 * Uses the service-role-backed Edge Function so user_profiles/tenants
 * are auto-created and RLS is bypassed server-side.
 *
 * @param {Object} entry  Normalized generation entry
 * @returns {Promise<boolean>}  true on success
 */
async function saveToSupabase(entry) {
  const fnUrl = getFunctionUrl();
  if (!fnUrl) return false;

  try {
    const userKey = getUserKey();
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-key': userKey,
      },
      body: JSON.stringify({
        studio: entry.studio,
        type: entry.type,
        url: entry.url,
        prompt: entry.prompt,
        model: entry.model,
        parameters: {
          ...entry.parameters,
          ...(entry.request_id ? { muapi_request_id: entry.request_id } : {}),
        },
        thumbnail_url: entry.thumbnail_url,
      }),
    });

    if (!response.ok) {
      console.debug(
        `[generationHistory] Supabase save failed (${response.status})`
      );
      return false;
    }

    return true;
  } catch (e) {
    console.debug('[generationHistory] Supabase save skipped:', e.message);
    return false;
  }
}

/**
 * Load generations from the Edge Function (cloud).
 *
 * @returns {Promise<Array>}  Array of normalized generation entries
 */
async function loadFromSupabase() {
  const fnUrl = getFunctionUrl();
  if (!fnUrl) return [];

  try {
    const userKey = encodeURIComponent(getUserKey());
    const response = await fetch(
      `${fnUrl}?action=list&user_key=${userKey}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) return [];

    const json = await response.json();
    const rows = Array.isArray(json.data) ? json.data : [];

    // Map DB row → client entry shape
    return rows.map((row) => ({
      id: row.id,
      url: row.output_url,
      prompt: row.prompt,
      model: row.model_name,
      studio: row.studio_type,
      type: row.generation_type === 'video' ? 'video' :
            row.generation_type === 'audio' ? 'audio' : 'image',
      timestamp: row.created_at,
      parameters: row.parameters || {},
      thumbnail_url: row.thumbnail_url || row.output_url,
      source: 'cloud',
    }));
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a completed generation to localStorage + Supabase.
 *
 * Writes to localStorage synchronously (so in-studio UI is immediate)
 * and fires the Supabase save asynchronously (fire-and-forget).
 *
 * @param {Object} data
 * @param {string} [data.studio]        Studio identifier ('image','video','cinema','effects','template')
 * @param {string} [data.type]          Content type ('image' | 'video')
 * @param {string} data.url             Output URL of the generated media
 * @param {string} [data.prompt]        Prompt used
 * @param {string} [data.model]         Model name
 * @param {Object} [data.parameters]    Extra generation params
 * @param {string} [data.timestamp]     ISO timestamp (defaults to now)
 * @param {string} [data.id]            Generation ID (defaults to timestamp-based)
 * @param {string} [data.request_id]    muapi.ai request ID (for webhook correlation)
 * @param {string} [data.thumbnail_url] Thumbnail URL (defaults to url)
 * @returns {Object}  The normalized entry that was saved
 */
export function saveGeneration(data) {
  if (!data || !data.url) {
    console.warn('[generationHistory] saveGeneration called without url — skipping');
    return null;
  }

  const {
    studio = 'image',
    type = normalizeStudioType(studio) === 'video' ? 'video' : 'image',
    url,
    prompt = '',
    model = '',
    parameters = {},
    timestamp = new Date().toISOString(),
    id,
    request_id,
    thumbnail_url,
    ...extra
  } = data;

  const entry = {
    id: id || Date.now().toString(),
    url,
    prompt,
    model,
    studio: normalizeStudioType(studio),
    type,
    timestamp,
    parameters,
    thumbnail_url: thumbnail_url || url,
    ...(request_id ? { request_id } : {}),
    ...extra,
  };

  // 1. localStorage — synchronous, immediate, offline-safe
  const storageKey = getStorageKey(type);
  try {
    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');
    history.unshift(entry);
    localStorage.setItem(storageKey, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (e) {
    // Ignore storage errors (private mode, quota exceeded, etc.)
  }

  // 2. Supabase — fire-and-forget (cloud persistence for Library Studio)
  saveToSupabase(entry).catch(() => {});

  return entry;
}

/**
 * Delete a generation from localStorage (Supabase deletion is deferred
 * to a future cleanup pass; the Edge Function doesn't currently expose DELETE).
 *
 * @param {string} url  The output_url to delete
 * @param {string} [type]  'image' or 'video' (determines localStorage key)
 */
export function deleteGeneration(url, type) {
  const storageKey = getStorageKey(type);
  try {
    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const filtered = history.filter((item) => item.url !== url);
    localStorage.setItem(storageKey, JSON.stringify(filtered));
  } catch (e) {
    // ignore
  }
}

/**
 * Load all generation history from Supabase + localStorage, merged and
 * deduplicated. Cloud results take priority (they have richer metadata);
 * localStorage entries that don't exist in the cloud are appended as fallback.
 *
 * @returns {Promise<Array>}  Merged entries sorted by timestamp desc
 */
export async function loadGenerationHistory() {
  // 1. Load from localStorage (immediate, offline-capable)
  let localResults = [];
  try {
    const imageHistory = JSON.parse(localStorage.getItem('muapi_history') || '[]');
    const videoHistory = JSON.parse(localStorage.getItem('video_history') || '[]');
    localResults = [
      ...imageHistory.map((h) => ({ ...h, type: h.type || 'image', source: 'local' })),
      ...videoHistory.map((h) => ({ ...h, type: 'video', source: 'local' })),
    ];
  } catch (e) {
    // Ignore parse errors
  }

  // 2. Load from Supabase (cloud persistence)
  let cloudResults = [];
  if (isSupabaseConfigured()) {
    try {
      cloudResults = await loadFromSupabase();
    } catch (e) {
      // Silently fall back to localStorage only
    }
  }

  // 3. Merge: deduplicate by URL, prefer cloud entries
  const seenUrls = new Set();
  const merged = [];

  // Cloud first (richer data, authoritative)
  for (const item of cloudResults) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    merged.push(item);
  }

  // Local fallback (entries not yet persisted to cloud)
  for (const item of localResults) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    merged.push(item);
  }

  // 4. Sort by timestamp desc
  merged.sort((a, b) => {
    const ta = new Date(a.timestamp || a.created_at || 0);
    const tb = new Date(b.timestamp || b.created_at || 0);
    return tb.getTime() - ta.getTime();
  });

  return merged;
}
