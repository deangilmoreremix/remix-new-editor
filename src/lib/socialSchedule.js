// Client for scheduled social posts (see supabase/functions/social-schedule and
// social-schedule-worker). Muapi's publish endpoints are immediate-only, so a
// scheduled post is stored server-side and published at run_at by a worker.
//
// Creating and cancelling go through the Clerk-gated social-schedule function.
// Listing reads the owner's rows directly (RLS on scheduled_posts).

import { supabase, primeSupabaseIdentity, getClerkSessionToken, getSupabaseAnonKey, getSupabaseUrl } from './supabase.js';
import { apiKeyManager } from './apiKeyManager.js';

export const SCHEDULE_PRESETS = [
  { id: 'now', label: 'Publish now' },
  { id: '1h', label: 'In 1 hour' },
  { id: '3h', label: 'In 3 hours' },
  { id: 'tomorrow', label: 'Tomorrow 9 AM' },
  { id: 'custom', label: 'Pick date & time' },
];

// Must stay in step with MIN_LEAD_SECONDS in supabase/functions/_shared/scheduledPosts.ts.
export const MIN_LEAD_MS = 60 * 1000;

/**
 * Resolve a preset (or a `datetime-local` value for 'custom') to a Date.
 * Returns null for 'now' (publish immediately) and for unusable input.
 */
export function resolveScheduleTime(presetId, customValue, now = new Date()) {
  switch (presetId) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '3h':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000);
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case 'custom': {
      if (!customValue) return null;
      const d = new Date(customValue); // datetime-local is parsed in local time
      return Number.isNaN(d.getTime()) ? null : d;
    }
    default:
      return null;
  }
}

/** Null when the time is acceptable, otherwise a message to show the user. */
export function validateScheduleTime(date, now = new Date()) {
  if (!date) return 'Choose a date and time.';
  if (date.getTime() - now.getTime() < MIN_LEAD_MS) return 'Pick a time at least a minute from now.';
  if (date.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) return 'Posts can be scheduled up to 90 days ahead.';
  return null;
}

async function callScheduleFunction(body) {
  const anon = getSupabaseAnonKey();
  const clerkToken = await getClerkSessionToken();
  const res = await fetch(`${getSupabaseUrl()}/functions/v1/social-schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clerkToken || anon}`,
      ...(anon ? { apikey: anon } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Please sign in to schedule posts.');
  if (res.status === 403) throw new Error('Scheduling is part of SmartVideo AI. Upgrade your plan to schedule posts.');
  if (!res.ok) throw new Error(data?.error || `Could not complete the request (${res.status}).`);
  return data;
}

/**
 * Schedule a post. `payload` is what buildPayload() in SocialPublishModal sends
 * to `${platform}-publish` minus account_id/media_url (those are top-level).
 */
export async function createScheduledPost({ platform, accountId, mediaUrl, thumbnailUrl, runAt, payload }) {
  const muapiKey = apiKeyManager.getMuapiKey();
  if (!muapiKey) throw new Error('Add your Muapi key in Settings so the post can be published at the scheduled time.');
  const { post } = await callScheduleFunction({
    action: 'create',
    platform,
    account_id: Number(accountId),
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl || null,
    run_at: runAt.toISOString(),
    payload,
    muapi_api_key: muapiKey,
  });
  return post;
}

export async function cancelScheduledPost(id) {
  const { post } = await callScheduleFunction({ action: 'cancel', id });
  return post;
}

export async function revokeScheduleKey() {
  return callScheduleFunction({ action: 'revoke_key' });
}

export async function listScheduledPosts({ limit = 200 } = {}) {
  await primeSupabaseIdentity(supabase);
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('id, platform, account_id, media_url, thumbnail_url, payload, run_at, status, error, result, created_at')
    .order('run_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message || 'Could not load scheduled posts.');
  return data || [];
}

export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  publishing: 'Publishing…',
  processing: 'Publishing…',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
