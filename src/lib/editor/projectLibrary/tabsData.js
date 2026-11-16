/** Data access for the Audience / Retarget / Notifications tabs (owner-only RPCs + tables, via the signed-in client). */
import { periodRange } from './analytics/analyticsData.js';
import { getProjectVideo } from './analytics/analyticsData.js';
import { projectSections, ctaLabels } from '../publish/sections.js';
import { clipTimeRange } from '../addons/registry.js';

export { getProjectVideo };
const rpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
};

export async function loadAudience(client, videoId, period = '30d', now = new Date()) {
  const { from, to } = periodRange(period, null, now);
  const [segments, interests] = await Promise.all([
    rpc(client, 'video_audience_segments', { p_video_id: videoId, p_from: from, p_to: to }),
    rpc(client, 'video_interest_summary', { p_video_id: videoId, p_from: from, p_to: to }),
  ]);
  return {
    range: { from, to },
    segments: Object.fromEntries((segments || []).map((r) => [r.segment, Number(r.sessions) || 0])),
    interests: (interests || []).map((r) => ({ ...r, sessions: Number(r.sessions) || 0, decayed_score: Number(r.decayed_score) || 0, high_interest_sessions: Number(r.high_interest_sessions) || 0 })),
  };
}

export const INTEREST_TYPES = Object.freeze(['service', 'product', 'offer', 'topic', 'pricing', 'cta']);
export const MAX_MAP_ENTRIES = 20;

/** Seed an interest map from the project's own scenes: no need to rebuild the timeline. */
export function seedInterestMap(projectState, existing = []) {
  const saved = new Map((existing || []).map((e) => [e.id, e]));
  const dur = Number(projectState?.timelineSeconds) || 0;
  const tracks = Array.isArray(projectState?.tracks) ? projectState.tracks : [];
  const cta = [];
  for (const t of tracks) for (const c of (t.items || t.clips || [])) {
    if (c && (c.type === 'click-to-call' || c.type === 'lead-form') && c.id != null) cta.push({ id: String(c.id), ...clipTimeRange(c, dur) });
  }
  return projectSections({ timelineSeconds: dur, tracks }).slice(0, MAX_MAP_ENTRIES).map((s) => {
    const prev = saved.get(s.id);
    return {
      id: s.id, title: s.title, start: s.start, end: s.end,
      interest: prev?.interest || null,
      clipIds: cta.filter((c) => c.start < s.end && c.end > s.start).map((c) => c.id), // CTAs shown during this section
    };
  });
}

/** Validate/normalise what the owner entered before saving it. */
export function cleanInterestMap(entries) {
  return (entries || []).slice(0, MAX_MAP_ENTRIES).map((e) => {
    const label = String(e.interest?.label || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const type = INTEREST_TYPES.includes(e.interest?.type) ? e.interest.type : 'topic';
    return {
      id: String(e.id).slice(0, 80), title: String(e.title || '').slice(0, 60),
      start: Number(e.start), end: Number(e.end),
      interest: label ? { type, label } : null,
      clipIds: (e.clipIds || []).map(String).slice(0, 20),
    };
  }).filter((e) => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start);
}

export async function saveInterestMap(client, projectId, settings, entries) {
  const map = cleanInterestMap(entries).filter((e) => e.interest); // unmapped sections are simply not interests
  const { error } = await client.from('timeline_projects').update({ settings: { ...(settings || {}), interestMap: map } }).eq('id', projectId);
  if (error) throw new Error(error.message || 'Could not save the interest map');
  return map;
}

export async function loadFollowupComparison(client, original, followups, now = new Date()) {
  if (!followups.length) return [];
  const { from, to } = periodRange('90d', null, now);
  const stats = (await rpc(client, 'owner_video_stats', { p_from: from, p_to: to })) || [];
  const byProject = new Map(stats.filter((r) => r.project_id).map((r) => [r.project_id, r]));
  const row = (p, kind) => {
    const s = byProject.get(p.id);
    return { id: p.id, name: p.name, kind, published: !!s, plays: s ? Number(s.plays) : null, completion: s?.completion_pct == null ? null : Number(s.completion_pct), cta: s ? Number(s.cta_clicks) + Number(s.call_clicks) : null, leads: s ? Number(s.leads) : null };
  };
  return [row(original, 'Original'), ...followups.map((f) => row(f, 'Follow-up'))];
}

// ---------------------------------------------------------------- notifications
export const NOTIFICATION_TYPES = Object.freeze([
  ['new_lead', 'New lead captured'], ['high_interest', 'High-interest viewer'], ['pricing_cta', 'Pricing CTA clicked'],
  ['contact_cta', 'Contact CTA clicked'], ['returning_engagement', 'Returning viewer engaged'], ['milestone', 'Performance milestone'],
  ['interest_surge', 'Interest rising'], ['followup_opportunity', 'Follow-up opportunity'], ['daily_digest', 'Analytics summary'],
]);

export const NOTIFICATION_PAGE = 20;

/** One page of a project's alerts, newest first. `hasMore` tells whether another page exists. */
export async function listNotifications(client, projectId, { limit = NOTIFICATION_PAGE, offset = 0 } = {}) {
  const { data, error } = await client.from('owner_notifications')
    .select('id, video_id, project_id, type, title, summary, suggestion, interest, metrics, read_at, created_at')
    .or(`project_id.eq.${projectId},project_id.is.null`).order('created_at', { ascending: false }).range(offset, offset + limit);
  if (error) throw new Error(error.message || 'Could not load notifications');
  const rows = data || [];
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function markRead(client, ids = null) {
  const { data, error } = await client.rpc('mark_notifications_read', { p_ids: ids });
  if (error) throw new Error(error.message || 'Could not mark as read');
  return Number(data) || 0;
}

export async function unreadCount(client) {
  const { data, error } = await client.rpc('owner_unread_notifications');
  if (error) throw new Error(error.message || 'Could not count notifications');
  return Number(data) || 0;
}

export const DEFAULT_PREFERENCES = Object.freeze({
  enabled_types: NOTIFICATION_TYPES.map(([k]) => k), in_app: true, email: false, digest_frequency: 'daily', interest_threshold: 60, quiet_hours: null,
});

export async function loadPreferences(client) {
  const { data, error } = await client.from('retarget_preferences').select('*').maybeSingle();
  if (error) throw new Error(error.message || 'Could not load preferences');
  return { ...DEFAULT_PREFERENCES, ...(data || {}) };
}

export function cleanPreferences(p) {
  const known = new Set(NOTIFICATION_TYPES.map(([k]) => k));
  const q = p.quiet_hours && /^\d\d:\d\d$/.test(p.quiet_hours.start || '') && /^\d\d:\d\d$/.test(p.quiet_hours.end || '') ? { start: p.quiet_hours.start, end: p.quiet_hours.end } : null;
  return {
    enabled_types: (p.enabled_types || []).filter((t) => known.has(t)),
    in_app: !!p.in_app, email: !!p.email,
    digest_frequency: ['off', 'daily', 'weekly'].includes(p.digest_frequency) ? p.digest_frequency : 'daily',
    interest_threshold: Math.min(500, Math.max(10, Math.round(Number(p.interest_threshold) || 60))),
    quiet_hours: q,
  };
}

export async function savePreferences(client, prefs) {
  const row = cleanPreferences(prefs);
  const { error } = await client.from('retarget_preferences').upsert(row, { onConflict: 'clerk_user_id' });
  if (error) throw new Error(error.message || 'Could not save preferences');
  return row;
}
