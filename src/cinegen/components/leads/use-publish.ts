// [remix] Publish state + actions for the Leads tab (React version of the old share panel's logic).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';
// @ts-expect-error plain JS
import * as pub from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { supabase, uploadFileToStorage } from '../../../lib/hybrid-supabase.js';

const KEY = 'remix.cinegen.published.v1';
const readIds = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const signedIn = () => !!(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user;

export interface Revision { revision: number; kind: 'draft' | 'live' | 'superseded'; created_at: string }
export interface PublishInfo { id: string; title: string; published: boolean; view_count: number; updated_at?: string; slug?: string | null; live_revision?: number }

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

  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => { setBusy(true); setError(''); try { return await fn(); } catch (e) { setError((e as Error).message); return undefined; } finally { setBusy(false); } };
  /** The snapshot that gets published or saved as a draft: same build, same media upload, same cleaning. */
  const snapshot = async (title: string) => {
    const { tl: t, state: s } = latest.current;
    const built = buildPublishState(t, s.assets, s.overlays ?? [], title);
    await pub.uploadLocalMedia(built, { getBlob: () => null, upload: uploadFileToStorage });
    return pub.preparePublishProject(built, { title });
  };
  const publish = (title: string) => run(async () => {
    const c = await getClient();
    const project = await snapshot(title);
    const vid = readIds()[key] || pub.makeSlug();
    const row = await pub.publishVideo(c, { id: vid, project });
    localStorage.setItem(KEY, JSON.stringify({ ...readIds(), [key]: vid }));
    setInfo({ ...row, published: true });
  });
  // Drafts: the live link keeps serving the current version until a draft is promoted.
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [draftsUnavailable, setDraftsUnavailable] = useState(false);
  const loadRevisions = useCallback(async () => {
    if (!id || !signedIn()) { setRevisions([]); return; }
    try { setRevisions(await pub.listRevisions(await getClient(), id)); setDraftsUnavailable(false); }
    catch (e) { if (/relation .* does not exist|schema cache|could not find the table|42P01/i.test((e as Error).message)) setDraftsUnavailable(true); }
  }, [id]);
  useEffect(() => { void loadRevisions(); }, [loadRevisions, info?.updated_at]);
  const saveDraft = (title: string) => run(async () => {
    const rev = await pub.publishDraft(await getClient(), { id, project: await snapshot(title) });
    await loadRevisions();
    return rev;
  });
  const promote = (revision: number) => run(async () => { await pub.promoteRevision(await getClient(), id, revision); await reload(); await loadRevisions(); });
  const draftProject = async (revision: number) => pub.getRevisionProject(await getClient(), id, revision);
  const setLive = (on: boolean) => run(async () => { await pub.setPublished(await getClient(), id, on); setInfo((i) => (i ? { ...i, published: on } : i)); });
  return { id, info, busy, error, loaded, publish, setLive, reload, revisions, draftsUnavailable, saveDraft, promote, draftProject, loadRevisions, title: tl?.name || 'Untitled video', signedIn: signedIn() };
}
