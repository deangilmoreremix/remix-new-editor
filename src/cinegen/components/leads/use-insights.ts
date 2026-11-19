// [remix] Extra numbers for the Leads tab: per-form views and conversion, and how much of the video each lead watched.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionKeys, type LeadRow, type WatchInfo } from '@cinegen/lib/leads/leads';
import { parseFormStats, statsRange, type FormStats } from '@cinegen/lib/leads/form-stats';
import { getClient } from './use-publish';

export interface Insights { formStats: FormStats | null; watch: Record<string, WatchInfo> }

export function useInsights(publishedId: string | null, enabled: boolean, rows: LeadRow[], clientFactory: () => Promise<any> = getClient): Insights & { reload: () => Promise<void> } {
  const [formStats, setFormStats] = useState<FormStats | null>(null);
  const [watch, setWatch] = useState<Record<string, WatchInfo>>({});
  const keys = sessionKeys(rows);
  const keySig = keys.join(',');
  const run = useRef(0); // each reload gets a number; only the newest one may write state
  const reload = useCallback(async () => {
    const mine = ++run.current;
    const current = () => mine === run.current;
    if (!publishedId || !enabled) { setFormStats(null); setWatch({}); return; }
    try {
      const client = await clientFactory();
      const { from, to } = statsRange(90);
      const stats = await client.rpc('video_heat_cta_stats', { p_video_id: publishedId, p_from: from, p_to: to });
      if (!current()) return;
      setFormStats(stats?.error ? null : parseFormStats(stats?.data));
      if (keySig) {
        const res = await client.from('video_view_sessions').select('session_key, max_progress, completed').eq('video_id', publishedId).in('session_key', keySig.split(','));
        if (!current()) return;
        const next: Record<string, WatchInfo> = {};
        (Array.isArray(res?.data) ? res.data : []).forEach((r: { session_key: string; max_progress: number | string; completed: boolean }) => { next[r.session_key] = { progress: Number(r.max_progress) || 0, completed: !!r.completed }; });
        setWatch(next);
      } else setWatch({});
    } catch { if (current()) { setFormStats(null); setWatch({}); } } // these are extras: the Leads tab works without them
  }, [publishedId, enabled, keySig, clientFactory]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => { run.current += 1; }, []); // a response arriving after unmount is ignored
  return { formStats, watch, reload };
}
