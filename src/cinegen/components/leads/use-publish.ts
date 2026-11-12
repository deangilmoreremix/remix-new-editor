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

/** A saved draft (not live) and one entry of the live video's history (every change is recorded by the database). */
export interface Draft { id: string; title: string; created_at: string }
export interface HistoryEntry { revision: number; title: string; created_at: string }
export interface PublishInfo { id: string; title: string; published: boolean; view_count: number; updated_at?: string; slug?: string | null; revision?: number; privacy?: string }

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
  // The owner's business link name (first part of /v/<business>/<slug>), if claimed.
  const [business, setBusiness] = useState<string | null>(null);
  const loadBusiness = useCallback(async () => {
    if (!signedIn()) { setBusiness(null); return; }
    try { setBusiness((await pub.getMyBusiness(await getClient()))?.business_slug ?? null); } catch { setBusiness(null); }
  }, []);
  useEffect(() => { void loadBusiness(); }, [loadBusiness]);

  // Drafts: the live link keeps serving the published version until a draft is promoted.
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [draftsUnavailable, setDraftsUnavailable] = useState(false);
  const loadDrafts = useCallback(async () => {
    if (!id || !signedIn()) { setDrafts([]); setHistory([]); return; }
    try {
      const c = await getClient();
      setHistory(await pub.listRevisions(c, id).catch(() => []));
      setDrafts(await pub.listDrafts(c, id)); setDraftsUnavailable(false);
    } catch (e) { if (/relation .* does not exist|schema cache|could not find the table|42P01/i.test((e as Error).message)) setDraftsUnavailable(true); }
  }, [id]);
  useEffect(() => { void loadDrafts(); }, [loadDrafts, info?.updated_at]);
  const saveDraft = (title: string) => run(async () => {
    const draftId = await pub.publishDraft(await getClient(), { id, project: await snapshot(title), title });
    await loadDrafts();
    return draftId as string;
  });
  const promote = (draftId: string) => run(async () => { const rev = await pub.promoteDraft(await getClient(), draftId); await reload(); await loadDrafts(); return rev as number; });
  const discardDraft = (draftId: string) => run(async () => { await pub.deleteDraft(await getClient(), draftId); await loadDrafts(); });
  const draftProject = async (draftId: string) => pub.getDraftProject(await getClient(), draftId);
  const setLive = (on: boolean) => run(async () => { await pub.setPublished(await getClient(), id, on); setInfo((i) => (i ? { ...i, published: on } : i)); });
  return { id, info, busy, error, loaded, publish, setLive, reload, business, drafts, history, draftsUnavailable, saveDraft, promote, discardDraft, draftProject, loadDrafts, loadBusiness, title: tl?.name || 'Untitled video', signedIn: signedIn() };
}
