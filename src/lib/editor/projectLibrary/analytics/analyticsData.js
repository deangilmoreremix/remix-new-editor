/**
 * Real analytics for the Projects > Analytics tab.
 *
 * Everything here comes from owner-only Supabase RPCs / tables (row-level
 * security on the Clerk `sub`) through the signed-in client. There is no demo
 * data path: when nothing has been collected the result says so (zeros for known
 * zeros, null -> "—" for values that are undefined or unsupported).
 */
import { projectSections, ctaLabels, projectDuration } from '../../publish/sections.js';
import { canonicalUrl } from '../../publish/publishClient.js';

export const PERIODS = Object.freeze(['today', '7d', '30d', '90d', 'custom']);
const DAY_MS = 86_400_000;
export const isoDay = (d) => d.toISOString().slice(0, 10);
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Reporting period -> inclusive UTC day range used by the date-filtered queries. */
export function periodRange(period, custom, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const back = (n) => isoDay(new Date(today.getTime() - n * DAY_MS));
  if (period === 'today') return { from: isoDay(today), to: isoDay(today) };
  if (period === '7d') return { from: back(6), to: isoDay(today) };
  if (period === '30d') return { from: back(29), to: isoDay(today) };
  if (period === '90d') return { from: back(89), to: isoDay(today) };
  if (period === 'custom' && validDay(custom?.from) && validDay(custom?.to) && custom.from <= custom.to) {
    const days = (Date.parse(custom.to) - Date.parse(custom.from)) / DAY_MS;
    if (days > 399) return { from: isoDay(new Date(Date.parse(`${custom.to}T00:00:00Z`) - 399 * DAY_MS)), to: custom.to }; // timeseries cap
    return { from: custom.from, to: custom.to };
  }
  return { from: back(29), to: isoDay(today) };
}

export function defaultCustomRange(now = new Date()) {
  const r = periodRange('30d', null, now);
  return { from: r.from, to: r.to };
}

const dayLabel = (iso, short) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', short
  ? { weekday: 'short', timeZone: 'UTC' }
  : { month: 'short', day: 'numeric', timeZone: 'UTC' });

const TYPE_LABEL = {
  cta_click: 'CTA click', call_click: 'Click to call', product_select: 'Product selected',
  overlay_click: 'Overlay click', lead_submit: 'Lead form submitted',
};

const OP_ICON = {
  pricing_cta: 'trend', interest_surge: 'trend', milestone: 'trend',
  new_lead: 'lead', contact_cta: 'lead',
  returning_engagement: 'repeat', high_interest: 'repeat', followup_opportunity: 'repeat',
};

/** Retention curve: share of played sessions that watched each position (0..100 step 5). */
export function retentionPoints(rows) {
  const base = Number(rows?.[0]?.base) || 0;
  if (!base) return [];
  const at = new Map(rows.map((r) => [Number(r.bucket), Number(r.viewers) || 0]));
  const pts = [];
  for (let p = 0; p <= 100; p += 5) {
    const v = at.get(Math.min(99, p)) ?? 0;
    pts.push({ positionPercent: p, retentionPercent: Math.min(100, Math.round((v / base) * 1000) / 10) });
  }
  return pts;
}

export function conversionRows(rows, labels = {}) {
  return (rows || []).map((r) => {
    const label = r.label || labels[String(r.clip_id)] || TYPE_LABEL[r.type] || 'Interaction';
    return { label: r.type === 'lead_submit' ? `Lead: ${label}` : r.type === 'call_click' ? `Call: ${label}` : label, clicks: Number(r.sessions) || 0, uniqueSessions: Number(r.sessions) || 0 };
  });
}

export function opportunityRows(notes) {
  return (notes || []).filter((n) => n.type !== 'daily_digest').map((n) => ({
    id: n.id,
    icon: OP_ICON[n.type] || 'trend',
    title: n.title,
    explanation: n.summary,
    suggestion: `Suggested action: ${n.suggestion || 'Review this activity in your Projects.'}`,
    unread: !n.read_at,
  }));
}

const rpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
};

/** The published video (current revision) that belongs to a project, or null. */
export async function getProjectVideo(client, projectId) {
  const { data, error } = await client.from('published_videos')
    .select('id, title, published, project, slug, privacy, revision, updated_at')
    .eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message || 'Could not load the published video');
  if (!data) return null;
  const biz = await client.from('video_owner_profiles').select('business_slug').maybeSingle();
  return { ...data, business: biz?.data?.business_slug || null };
}

/**
 * @returns {{ status:'unpublished'|'ok', data?: ProjectAnalyticsData, hasTracking?: boolean, video? }}
 */
export async function loadAnalytics(client, { projectRow, period = '30d', custom = null, now = new Date(), origin } = {}) {
  const video = await getProjectVideo(client, projectRow.id);
  if (!video) return { status: 'unpublished' };
  const { from, to } = periodRange(period, custom, now);
  const sections = projectSections(video.project);
  const secArg = sections.map((s) => ({ id: s.id, start: s.start, end: s.end }));
  const labels = ctaLabels(video.project);
  const toExclusive = isoDay(new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS));

  const [summary, series, retention, cta, engagement, notes] = await Promise.all([
    rpc(client, 'video_analytics_summary', { p_video_id: video.id, p_from: from, p_to: to }),
    rpc(client, 'video_analytics_timeseries', { p_video_id: video.id, p_from: from, p_to: to }),
    rpc(client, 'video_retention_curve', { p_video_id: video.id, p_from: from, p_to: to }),
    rpc(client, 'video_cta_performance', { p_video_id: video.id, p_from: from, p_to: to }),
    secArg.length ? rpc(client, 'video_section_engagement', { p_video_id: video.id, p_sections: secArg, p_from: from, p_to: to }) : Promise.resolve([]),
    client.from('owner_notifications').select('id, type, title, summary, suggestion, read_at, created_at')
      .eq('video_id', video.id).gte('created_at', `${from}T00:00:00Z`).lt('created_at', `${toExclusive}T00:00:00Z`)
      .order('created_at', { ascending: false }).limit(8).then((r) => { if (r.error) throw new Error(r.error.message); return r.data || []; }),
  ]);

  const s = summary || {};
  const plays = Number(s.plays) || 0;
  const unique = Number(s.unique_viewers) || 0;
  const engagementById = new Map((engagement || []).map((e) => [e.section_id, e.engagement_percent == null ? null : Number(e.engagement_percent)]));
  const short = (series || []).length <= 7;
  const dur = projectDuration(video.project);
  const data = {
    projectId: projectRow.id,
    projectName: projectRow.name || video.title,
    status: video.published ? 'published' : 'unpublished',
    thumbnailUrl: projectRow.thumbnail_url || undefined,
    publishedUrl: video.published ? canonicalUrl(video, origin ?? globalThis.location?.origin ?? '') : undefined,
    durationMs: Math.round(dur * 1000),
    metrics: {
      plays,
      // Unique viewers need a viewer id: unavailable (null) when plays exist but none carried one.
      uniqueViewers: plays > 0 && unique === 0 ? null : unique,
      completionRate: s.completion_rate == null ? null : Number(s.completion_rate) * 100,
      avgWatchSeconds: s.avg_watch_seconds == null ? null : Number(s.avg_watch_seconds),
      ctaClicks: (Number(s.cta_clicks) || 0) + (Number(s.call_clicks) || 0),
      leads: Number(s.leads) || 0,
    },
    playsOverTime: (series || []).map((r) => ({ day: dayLabel(r.day, short), plays: Number(r.plays) || 0 })),
    retention: retentionPoints(retention),
    sections: sections.map((x) => ({ id: x.id, title: x.title, startMs: Math.round(x.start * 1000), endMs: Math.round(x.end * 1000), engagementPercent: engagementById.get(x.id) ?? null })),
    conversions: conversionRows(cta, labels),
    opportunities: opportunityRows(notes),
  };
  return { status: 'ok', data, video, range: { from, to }, hasTracking: Number(s.page_visits) > 0 || plays > 0 };
}
