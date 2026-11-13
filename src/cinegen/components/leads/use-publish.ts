// [remix] Publish state + actions for the Leads tab (React version of the old share panel's logic).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';
import { ensureProjectRow, readInterestMap, isLinkableProjectId } from '@cinegen/lib/leads/project-link';
// @ts-expect-error plain JS
import * as pub from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { supabase, uploadFileToStorage } from '../../../lib/hybrid-supabase.js';

const KEY = 'remix.cinegen.published.v1';
const readIds = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const signedIn = () => !!(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user;

export interface PublishInfo { id: string; title: string; published: boolean; view_count: number; updated_at?: string }

export async function getClient() {
  if (!signedIn()) throw new Error('Sign in to publish videos');
  await supabase.refreshUserHeader?.();
  if (!supabase.supabase) throw new Error('The video service is unavailable — check your connection');
  return supabase.supabase;
}

/** The published id for the active timeline of this project (stored per project + timeline). */
export function usePublished() {
  const { state, projectId } = useWorkspace();
  const tl = state.timelines.find((t) => t.id === state.activeTimelineId) ?? state.timelines[0];
  const key = `${projectId}:${tl?.id ?? ''}`;
  const [info, setInfo] = useState<PublishInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const latest = useRef({ tl, state }); latest.current = { tl, state };
  const id = readIds()[key] || null;

  const reload = useCallback(async () => {
    const vid = readIds()[key];
    if (!vid || !signedIn()) { setInfo(null); setLoaded(true); return; }
    try { setInfo(await pub.getMyVideo(await getClient(), vid)); setError(''); } catch (e) { setError((e as Error).message); }
    setLoaded(true);
  }, [key]);
  useEffect(() => { setLoaded(false); void reload(); }, [reload]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const publish = (title: string) => run(async () => {
    const c = await getClient();
    const { tl: t, state: s } = latest.current;
    const built = buildPublishState(t, s.assets, s.overlays ?? [], title);
    await pub.uploadLocalMedia(built, { getBlob: () => null, upload: uploadFileToStorage });
    // Tie the video to its project (same id) so Analytics / Retarget / Alerts can find it; keep the owner's saved
    // interest mapping on republish. Linking is best-effort: publishing itself must never fail because of it.
    let linked: string | null = null;
    if (isLinkableProjectId(projectId)) {
      try {
        const map = await readInterestMap(c, projectId);
        if (map) (built as { interestMap?: unknown }).interestMap = map;
        await ensureProjectRow(c, { projectId, name: title, built, aspect: t?.aspect ?? null });
        linked = projectId;
      } catch { linked = null; }
    }
    const project = pub.preparePublishProject(built, { title });
    const vid = readIds()[key] || pub.makeSlug();
    const row = await pub.publishVideo(c, { id: vid, project, projectId: linked });
    localStorage.setItem(KEY, JSON.stringify({ ...readIds(), [key]: vid }));
    setInfo({ ...row, published: true });
  });
  const setLive = (on: boolean) => run(async () => { await pub.setPublished(await getClient(), id, on); setInfo((i) => (i ? { ...i, published: on } : i)); });
  return { id, info, busy, error, loaded, publish, setLive, reload, title: tl?.name || 'Untitled video', signedIn: signedIn() };
}
