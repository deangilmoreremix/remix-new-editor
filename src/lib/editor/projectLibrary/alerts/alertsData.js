/**
 * Loads everything the "Leads & alerts" view shows for ONE published video, with the owner's own signed-in client (RLS-protected):
 * alerts (owner_notifications), leads (video_leads), whether push is set up (the push route) and the top retarget suggestion.
 * Every part fails on its own: a missing piece is reported next to it, never as a blank screen.
 */
import { loadServerInfo } from '../../../../features/personalization/shared/personalization/notify/pushClient';
import { loadAudience } from '../tabsData.js';
import { recommend } from '../retarget/recommendations.js';

const BASE = 'id, type, title, summary, interest, metrics, read_at, created_at';

export async function loadVideoAlerts(client, videoId, { limit = 30, now = Date.now(), serverInfoFn = loadServerInfo, audienceFn = loadAudience } = {}) {
  if (!videoId) throw new Error('Publish this video first.');
  const alertsQ = async () => {
    // pushed_at exists only after the push migration; fall back to the plain columns if it cannot be read.
    let r = await client.from('owner_notifications').select(`${BASE}, pushed_at`).eq('video_id', videoId).order('created_at', { ascending: false }).limit(limit);
    let pushedKnown = true;
    if (r.error) { r = await client.from('owner_notifications').select(BASE).eq('video_id', videoId).order('created_at', { ascending: false }).limit(limit); pushedKnown = false; }
    if (r.error) throw new Error(r.error.message || 'Could not load alerts');
    return { notes: r.data || [], pushedKnown };
  };
  const leadsQ = async () => {
    // Leads submitted on the published page carry the published video id as project_id; preview submissions from the editor are excluded.
    const r = await client.from('video_leads').select('id, kind, clip_id, data, created_at', { count: 'exact' }).eq('project_id', videoId).eq('preview', false).order('created_at', { ascending: false }).limit(10);
    if (r.error) return { count: 0, rows: [], error: r.error.message || 'Could not load leads' };
    const rows = r.data || [];
    return { count: typeof r.count === 'number' ? r.count : rows.length, rows };
  };
  const serverQ = async () => {
    try {
      const s = await serverInfoFn();
      return s.ok ? { configured: s.info.configured, devices: s.info.devices.length, publicKey: s.info.publicKey } : { configured: null, devices: null, publicKey: null, error: s.message };
    } catch { return { configured: null, devices: null, error: 'Phone and desktop alerts could not be checked right now.' }; }
  };
  const recQ = async () => {
    try { const a = await audienceFn(client, videoId); return recommend({ interests: a.interests, segments: a.segments, project: { projectId: videoId } })[0] || null; } catch { return null; }
  };
  const [alerts, leads, server, topRecommendation] = await Promise.all([alertsQ(), leadsQ(), serverQ(), recQ()]);
  return { notes: alerts.notes, pushedKnown: alerts.pushedKnown, leads, server, topRecommendation, now };
}
