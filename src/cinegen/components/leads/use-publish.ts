// [remix] Publish state + actions for the Leads tab (React version of the old share panel's logic).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';
import { captureRowThumbnail } from '@cinegen/lib/leads/thumbnail';
import { ensureProjectRow, readInterestMap, linkedProjectId, rowName } from '@cinegen/lib/leads/project-link';
// @ts-expect-error plain JS
import * as pub from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { supabase, uploadFileToStorage } from '../../../lib/hybrid-supabase.js';
// @ts-expect-error plain JS
import { friendlyPublishError } from '../../../lib/editor/publish/guestMessages.js';
// @ts-expect-error plain JS
import { getSupabaseAccessToken, getTokenExchangeFailure, primeSupabaseIdentity } from '../../../lib/supabase.js';

const KEY = 'remix.cinegen.published.v1';
const readIds = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const signedIn = () => !!(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user;

export interface PublishInfo { id: string; title: string; published: boolean; view_count: number; updated_at?: string }

/**
 * The client that owns the published video: the account's when signed in, otherwise a private guest identity
 * (lib/guestIdentity.js), so publishing, personal links and leads work without an account.
 */
export async function getClient() {
  if (!signedIn()) return (await import('../../../lib/guestIdentity.js')).getGuestOwnerClient();
  await supabase.refreshUserHeader?.();
  // Signed in but no verified database token: every owner-only query would be rejected by row-level security with
  // a generic "sign in" error. Stop here and say what is actually wrong.
  if (!(await getSupabaseAccessToken())) {
    throw new Error(`Could not verify your account with the video service. ${getTokenExchangeFailure() || 'Try again.'}`);
  }
  if (!supabase.supabase) throw new Error('The video service is unavailable — check your connection');
  return supabase.supabase;
}

/** Run a Supabase call; if the token was rejected, fetch a fresh one and try once more. */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (!/jwt|expired|unauthori[sz]ed|401|invalid.*token/i.test((e as Error)?.message || '')) throw e;
    await getSupabaseAccessToken({ forceRefresh: true });
    await primeSupabaseIdentity(supabase.supabase);
    return fn();
  }
}

let guestClaimAsked = false;
/**
 * After signing in: offer to move what this browser published as a guest into the account (asked once per page load).
 * Resolves with how much moved, or null when nothing was asked or the person declined.
 */
export async function offerGuestClaim(): Promise<{ videos: number; links: number; leads: number } | null> {
  const w = window as unknown as { Clerk?: { user?: unknown; session?: { getToken?: () => Promise<string | null> } } };
  if (guestClaimAsked || !w.Clerk?.user) return null;
  try {
    const guest = await import('../../../lib/guestIdentity.js');
    if (!guest.hasGuestIdentity()) return null;
    guestClaimAsked = true;
    if (!window.confirm('Videos and links you published without an account are still in this browser. Move them to your account so you keep them?')) return null;
    const token = await w.Clerk.session?.getToken?.();
    if (!token) throw new Error('Please try again in a moment.');
    return (await guest.claimGuestContent(token)).moved;
  } catch (err) {
    guestClaimAsked = false;
    console.warn('Could not move guest content:', (err as Error)?.message);
    return null;
  }
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
    if (!vid) { setInfo(null); setLoaded(true); return; }
    try { setInfo(await pub.getMyVideo(await getClient(), vid)); setError(''); } catch (e) { setError(friendlyPublishError(e)); }
    setLoaded(true);
  }, [key]);
  useEffect(() => { setLoaded(false); void reload(); }, [reload]);
  useEffect(() => { void offerGuestClaim().then((moved) => { if (moved) void reload(); }); }, [reload]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(friendlyPublishError(e)); } finally { setBusy(false); } };
  const publish = (title: string) => run(async () => {
    const c = await getClient();
    const { tl: t, state: s } = latest.current;
    const built = buildPublishState(t, s.assets, s.overlays ?? [], title);
    await pub.uploadLocalMedia(built, { getBlob: () => null, upload: uploadFileToStorage });
    // Tie the video to its project (same id) so Analytics / Retarget / Alerts can find it; keep the owner's saved
    // interest mapping on republish. Linking is best-effort: publishing itself must never fail because of it.
    let linked: string | null = null;
    let rowId: string | null = null;
    // Cloud project rows (Analytics / Retarget / Alerts) belong to accounts; a guest publishes without one.
    if (projectId && t?.id && signedIn()) {
      rowId = await linkedProjectId(projectId, t.id);
      // The owner's saved audience mapping travels with every republish. If it cannot be read, stop rather than
      // publish a version that silently loses it (a failed read is different from "nothing saved yet").
      const map = await withAuthRetry(() => readInterestMap(c, rowId ?? '')).catch((e: Error) => { throw new Error(`Could not read your saved audience mapping — try publishing again (${e.message || 'unknown error'})`); });
      if (map) (built as { interestMap?: unknown }).interestMap = map;
    }
    // Tie the video to its project row so Analytics / Retarget / Alerts can find it. Best-effort: publishing never
    // fails because the link could not be written (Analytics links it later).
    if (rowId) {
      try { await ensureProjectRow(c, { projectId: rowId, name: await rowName(projectId, title), built, aspect: t?.aspect ?? null, cinegenProjectId: projectId, timelineId: t.id }); linked = rowId; } catch { linked = null; }
    }
    const project = pub.preparePublishProject(built, { title });
    const vid = readIds()[key] || pub.makeSlug();
    const row = await pub.publishVideo(c, { id: vid, project, projectId: linked });
    localStorage.setItem(KEY, JSON.stringify({ ...readIds(), [key]: vid }));
    setInfo({ ...row, published: true });
    // A fresh frame for the video's card; best-effort and not awaited, so publishing never waits on or fails because of it.
    if (linked) void captureRowThumbnail(c, linked, built, { aspect: t?.aspect ?? null, force: true });
  });
  const setLive = (on: boolean) => run(async () => { await pub.setPublished(await getClient(), id, on); setInfo((i) => (i ? { ...i, published: on } : i)); });
  return { id, info, busy, error, loaded, publish, setLive, reload, title: tl?.name || 'Untitled video', signedIn: signedIn(), guest: !signedIn() };
}
