/**
 * Netlify scheduled function: recipient-video-purge (daily). Not an always-on server: Netlify runs it once a day.
 * Deletes private per-recipient videos 90 days after upload: the database rows first (recipient_videos_purge_expired returns the object
 * paths), then the stored files. A file that cannot be deleted is logged and left (private, and nothing can sign it any more).
 */
import { removeObject } from './_storage/signedUrls.js';

export const config = { schedule: '@daily' };

export async function purge({ fetchImpl = fetch, env = process.env } = {}) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''); const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return { ok: false, error: 'not_configured', removed: 0, failed: 0 };
  const cfg = { url, key }; let removed = 0, failed = 0;
  for (let round = 0; round < 10; round++) {
    const res = await fetchImpl(`${url}/rest/v1/rpc/recipient_videos_purge_expired`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_limit: 200 }) });
    if (!res.ok) return { ok: false, error: `rpc_failed_${res.status}`, removed, failed };
    const rows = await res.json(); const paths = (Array.isArray(rows) ? rows : []).map((r) => (typeof r === 'string' ? r : r?.object_path)).filter(Boolean);
    for (const p of paths) { try { (await removeObject(cfg, p, fetchImpl)) ? removed++ : failed++ } catch { failed++ } }
    if (failed) console.error(`[recipient-video-purge] ${failed} file(s) could not be deleted`);
    if (paths.length < 200) break;
  }
  return { ok: true, removed, failed };
}

export default async () => { const r = await purge(); console.log('[recipient-video-purge]', JSON.stringify(r)); return new Response(JSON.stringify(r), { status: r.ok ? 200 : 500 }); };
