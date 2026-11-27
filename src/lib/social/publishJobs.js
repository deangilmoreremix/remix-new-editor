// src/lib/social/publishJobs.js
//
// Browser side of automatic ("publish while I'm away") scheduling. A job is a scheduled_posts row with
// auto_publish = true that the `scheduled-publish` Netlify function sends to MuAPI at its time with the
// owner's server-side encrypted key. Unlike the reminder queue (scheduledPosts.js) there is NO browser-only
// fallback here: a job that only exists in this browser can never publish, so when the cloud is unavailable
// these functions throw and the UI says so. The MuAPI key is sent once over HTTPS to social-publish-key and
// is never stored or read back in the browser.
import { supabase, primeSupabaseIdentity, getClerkUserId, isSupabaseConfigured, getClerkSessionToken } from '../supabase.js';

export const KEY_ENDPOINT = '/.netlify/functions/social-publish-key';
const MAX_JOBS_SHOWN = 100;

export const cloudReady = () => { try { return Boolean(isSupabaseConfigured() && getClerkUserId()); } catch { return false; } };

async function keyCall(method, body, fetchImpl = fetch) {
  const token = await getClerkSessionToken();
  if (!token) throw new Error('Sign in to use automatic publishing.');
  const res = await fetchImpl(KEY_ENDPOINT, { signal: AbortSignal.timeout(15000), method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data.error || `Automatic publishing is unavailable right now (${res.status}).`);
  return data;
}

/** { enabled, available } — `available: false` means the server has no encryption secret configured yet. */
export const autoPublishStatus = (fetchImpl) => keyCall('GET', undefined, fetchImpl);
export const enableAutoPublish = (apiKey, fetchImpl) => keyCall('PUT', { apiKey, consent: true }, fetchImpl);
export const disableAutoPublish = (fetchImpl) => keyCall('DELETE', undefined, fetchImpl);

/** Pure: why a job cannot be scheduled ('' when fine). `now` is injectable for tests. */
export function jobProblem({ jobs, mediaUrl, scheduledFor }, now = new Date()) {
  if (!Array.isArray(jobs) || !jobs.length) return 'Choose at least one connected account.';
  if (!mediaUrl || !/^https:\/\//i.test(mediaUrl)) return 'The media needs a public https link before it can be scheduled.';
  if (!(scheduledFor instanceof Date) || Number.isNaN(scheduledFor.getTime())) return 'Pick a date and time.';
  if (scheduledFor.getTime() <= now.getTime() + 60_000) return 'Pick a time at least a minute in the future.';
  return '';
}

/** The row stored for one automatic job (UTC time; the zone is only for display). */
export function toJobRow({ jobs, mediaUrl, mediaType, caption, hashtags = [], studio = '', scheduledFor, timeZone }) {
  return {
    media_url: mediaUrl,
    media_type: mediaType === 'video' ? 'video' : 'image',
    studio: String(studio).slice(0, 80),
    platforms: [...new Set(jobs.map((j) => j.platform))],
    caption: String(caption || '').slice(0, 5000),
    hashtags: hashtags.slice(0, 30),
    scheduled_for: scheduledFor.toISOString(),
    time_zone: timeZone || null,
    status: 'scheduled',
    auto_publish: true,
    jobs: jobs.map((j) => ({ platform: j.platform, account_id: Number(j.account_id), payload: j.payload })),
  };
}

/** Saves an automatic job. Throws (never falls back to this browser) when it cannot be stored in the cloud. */
export async function scheduleJob(input, now = new Date()) {
  const problem = jobProblem(input, now);
  if (problem) throw new Error(problem);
  if (!cloudReady()) throw new Error('Sign in so the job can be saved to your account. Automatic publishing never stays only in this browser.');
  await primeSupabaseIdentity();
  const { data, error } = await supabase.from('scheduled_posts').insert(toJobRow(input)).select('id, job_key').single();
  if (error) throw new Error(/automatic publishing/i.test(error.message) ? error.message : 'Could not save the job. Nothing was scheduled.');
  return data;
}

const COLUMNS = 'id, job_key, status, scheduled_for, time_zone, platforms, caption, media_url, media_type, results, attempts, max_attempts, last_error, published_at, auto_publish, created_at';

/** The signed-in owner's automatic jobs (newest first): scheduled, publishing, posted, failed, cancelled. */
export async function listJobs() {
  if (!cloudReady()) return [];
  await primeSupabaseIdentity();
  const { data, error } = await supabase.from('scheduled_posts').select(COLUMNS).eq('auto_publish', true).order('scheduled_for', { ascending: false }).limit(MAX_JOBS_SHOWN);
  if (error) throw new Error('Could not load your scheduled posts.');
  return data || [];
}

async function patch(id, fields) {
  await primeSupabaseIdentity();
  const { data, error } = await supabase.from('scheduled_posts').update(fields).eq('id', id).select('id').maybeSingle();
  if (error) throw new Error(error.message?.includes('cannot be changed') ? 'This post is already being published or is published, so it cannot be changed.' : 'That change was not allowed.');
  if (!data) throw new Error('That post was not found.');
}

export const cancelJob = (id) => patch(id, { status: 'cancelled' });
/** Moves a job that has not started. A failed job moved to a new time is retried at that time. */
export const rescheduleJob = (id, date, timeZone, status = 'scheduled') => patch(id, { scheduled_for: date.toISOString(), time_zone: timeZone || null, status });
/** Manual retry: only destinations that did not publish are sent again (the server never re-sends a published one). */
export const retryJob = (id) => patch(id, { status: 'scheduled' });

/** Plain text for a job's per-destination outcome (for history). */
export function describeResult(r) {
  if (r.status === 'published') return r.url ? `Published · ${r.url}` : 'Published';
  if (r.status === 'failed') return r.error || 'Failed';
  if (r.status === 'processing' || r.status === 'submitting') return 'Publishing…';
  return 'Waiting';
}
