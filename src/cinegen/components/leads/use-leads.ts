// [remix] Loads / deletes the lead rows of one published video.
import { useCallback, useEffect, useState } from 'react';
import type { LeadRow } from '@cinegen/lib/leads/leads';
// @ts-expect-error plain JS
import { fetchLeadRows } from '../../../lib/editor/addons/leadClient.js';
import { getClient } from './use-publish';

export interface LeadsData { rows: LeadRow[]; loading: boolean; error: string; reload: () => Promise<void>; remove: (id: string) => Promise<void> }

export function useLeads(publishedId: string | null, enabled: boolean, clientFactory: () => Promise<any> = getClient): LeadsData {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!publishedId || !enabled) { setRows([]); return; }
    setLoading(true); setError('');
    try {
      const res = await fetchLeadRows(await clientFactory(), { projectId: publishedId });
      if (res.ok) setRows(res.rows); else setError(res.error);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [publishedId, enabled, clientFactory]);
  useEffect(() => { void reload(); }, [reload]);
  const remove = useCallback(async (id: string) => {
    try {
      const { error: err } = await (await clientFactory()).from('video_leads').delete().eq('id', id);
      if (err) throw new Error(err.message);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) { setError((e as Error).message || 'Could not delete the lead'); }
  }, [clientFactory]);
  return { rows, loading, error, reload, remove };
}
