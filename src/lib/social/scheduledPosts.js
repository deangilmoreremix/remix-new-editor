// src/lib/social/scheduledPosts.js
//
// The queue behind the "Schedule post" window. Signed-in people save to the scheduled_posts table
// (supabase/migrations/20261125120000_scheduled_posts.sql); signed-out people, or a project where the
// table does not exist yet, keep the post in this browser instead, so nothing the person wrote is lost.
// Nothing here posts to a social network: it only stores what will be posted and when.
import { supabase, primeSupabaseIdentity, getClerkUserId, isSupabaseConfigured } from '../supabase.js';

const LOCAL_KEY = 'sv:scheduledPosts';

/** Pure: the time a schedule choice means, as a Date (null when it cannot be told). `now` is injectable for tests. */
export function whenFor(mode, { date = '', time = '' } = {}, now = new Date()) {
  const at = new Date(now);
  if (mode === '1h') return new Date(at.getTime() + 60 * 60 * 1000);
  if (mode === 'tomorrow') { at.setDate(at.getDate() + 1); at.setHours(9, 0, 0, 0); return at; }
  if (mode === 'custom') {
    if (!date) return null;
    const d = new Date(`${date}T${time || '09:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Pure: what is wrong with a post before saving it ('' when it is fine). */
export function postProblem(post, now = new Date()) {
  if (!post?.mediaUrl || !/^https:\/\//i.test(post.mediaUrl)) return 'This result has no shareable link yet.';
  if (!Array.isArray(post.platforms) || !post.platforms.length) return 'Pick at least one platform.';
  if (!String(post.caption || '').trim()) return 'Write a caption first.';
  if (post.status !== 'draft') {
    if (!(post.scheduledFor instanceof Date) || Number.isNaN(post.scheduledFor.getTime())) return 'Pick a date and time.';
    if (post.scheduledFor.getTime() <= now.getTime()) return 'Pick a time in the future.';
  }
  return '';
}

const readLocal = () => { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeLocal = (rows) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-200))); } catch { /* storage blocked: the cloud copy still counts */ } };

const toRow = (p) => ({
  media_url: p.mediaUrl,
  media_type: p.mediaType === 'video' ? 'video' : 'image',
  studio: String(p.studio || '').slice(0, 80),
  platforms: p.platforms,
  caption: String(p.caption).slice(0, 5000),
  hashtags: p.hashtags || [],
  scheduled_for: p.status === 'draft' ? null : p.scheduledFor.toISOString(),
  status: p.status === 'draft' ? 'draft' : 'scheduled',
});

const cloudReady = () => { try { return Boolean(isSupabaseConfigured() && getClerkUserId()); } catch { return false; } };

/**
 * Save one post. post = { mediaUrl, mediaType, studio, platforms[], caption, hashtags[], scheduledFor: Date, status?: 'draft' }.
 * Resolves { saved: 'cloud' | 'browser' }; throws an Error with a plain message when the post is not valid.
 */
export async function savePost(post, now = new Date()) {
  const problem = postProblem(post, now);
  if (problem) throw new Error(problem);
  const row = toRow(post);
  if (cloudReady()) {
    try {
      await primeSupabaseIdentity();
      const { error } = await supabase.from('scheduled_posts').insert(row);
      if (!error) return { saved: 'cloud' };
    } catch { /* fall through to the browser copy */ }
  }
  writeLocal([...readLocal(), { ...row, id: `local-${Date.now()}`, created_at: now.toISOString() }]);
  return { saved: 'browser' };
}

/** This browser's queue, soonest first (the signed-in queue is read by the Scheduler page). */
export function listLocalPosts() {
  return readLocal().sort((a, b) => String(a.scheduled_for || '9').localeCompare(String(b.scheduled_for || '9')));
}
