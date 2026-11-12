// [remix] Business asset library for the Leads tab: the selected contact's business, its saved assets, and
// which asset is assigned to which image slot of THIS project. Writes go through businessAssetStore (RLS-owned
// rows); assignments are mirrored into the contact profile so the editor preview shows that business's images.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { slotsForOverlays, businessFromProfile, canAutoAssign, variablesFromAssignments, profilePatch, type LibAsset, type LibAssignment, type SlotInfo } from '@cinegen/lib/leads/personalize-writeback';
// @ts-expect-error plain JS
import * as store from '../../../lib/personalization/businessAssetStore.js';
// @ts-expect-error plain JS
import * as contacts from '../../../lib/contactStore.js';
// @ts-expect-error plain JS
import { uploadFileToStorage } from '../../../lib/hybrid-supabase.js';
import { getClient } from './use-publish';

type Profile = { id: string; variables?: Record<string, string> } & Record<string, unknown>;
export interface BusinessRow { id: string; name: string; website?: string | null; phone?: string | null }

/** Tables/RPCs from the publishing migrations are not installed on this project yet. */
const isMissingSchema = (e: unknown) => /relation .* does not exist|schema cache|could not find the (table|function)|PGRST20\d|42P01/i.test((e as Error)?.message || '');

export interface BusinessLibrary {
  profile: Profile | null; business: BusinessRow | null; slots: SlotInfo[];
  assets: LibAsset[]; assignments: LibAssignment[];
  busy: boolean; error: string; unavailable: boolean; signedIn: boolean; notice: string;
  assign: (slot: string, assetId: string, opts?: { manual?: boolean; force?: boolean }) => Promise<boolean>;
  clear: (slot: string) => Promise<void>;
  remove: (assetId: string) => Promise<void>;
  upload: (file: File, category: string) => Promise<void>;
  findMore: () => Promise<void>;
  /** Save assets the modal added at/after `since` (ms) for the CURRENT business. Older local assets may belong to other businesses and are never saved here. */
  syncFromModal: (since: number) => Promise<number>;
  reload: () => Promise<void>;
}

export function useBusinessLibrary(): BusinessLibrary {
  const { state, projectId } = useWorkspace();
  const [profile, setProfile] = useState<Profile | null>(() => contacts.getActiveProfile?.() ?? null);
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [assets, setAssets] = useState<LibAsset[]>([]);
  const [assignments, setAssignments] = useState<LibAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const signedIn = !!(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user;
  const slots = useMemo(() => slotsForOverlays((state.overlays ?? []) as Array<Record<string, unknown>>), [state.overlays]);

  useEffect(() => {
    const on = () => setProfile(contacts.getActiveProfile?.() ?? null);
    window.addEventListener('remix:contact-changed', on);
    return () => window.removeEventListener('remix:contact-changed', on);
  }, []);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) {
      if (isMissingSchema(e)) setUnavailable(true); else setError((e as Error).message);
      return undefined;
    } finally { setBusy(false); }
  }, []);

  const reload = useCallback(async () => {
    const info = businessFromProfile(profile as never);
    if (!info || !signedIn) { setBusiness(null); setAssets([]); setAssignments([]); return; }
    await guard(async () => {
      const client = await getClient();
      const biz = await store.upsertBusiness(client, { ...info, source: 'business-finder' });
      setBusiness(biz);
      setAssets(await store.listBusinessAssets(client, biz.id));
      setAssignments(await store.listAssignments(client, projectId, biz.id));
      setUnavailable(false);
    });
  }, [profile, signedIn, projectId, guard]);
  useEffect(() => { void reload(); }, [reload]);

  const mirrorToProfile = useCallback((nextAssignments: LibAssignment[], nextAssets: LibAsset[], cleared: string[] = []) => {
    if (!profile?.id) return;
    const vars = variablesFromAssignments(nextAssignments, nextAssets);
    contacts.updateProfile(profile.id, profilePatch(profile, vars, cleared));
  }, [profile]);

  const assign: BusinessLibrary['assign'] = async (slot, assetId, { manual = true, force = false } = {}) => {
    if (!business) return false;
    if (!manual && !force) {
      const d = canAutoAssign(assignments, slot, assetId);
      if (!d.ok) { setNotice(`"${slot}" was chosen by you - not replaced automatically.`); return false; }
    }
    const res = await guard(async () => {
      const r = await store.assignAsset(await getClient(), { projectId, businessId: business.id, slot, assetId, manual });
      if (!r.assigned) return false;
      const nextAssignments = [...assignments.filter((a) => a.slot !== slot), { slot, asset_id: assetId, manual }];
      const nextAssets = assets.map((a) => (a.id === assetId && a.state === 'imported' ? { ...a, state: 'assigned' } : a));
      setAssignments(nextAssignments); setAssets(nextAssets); mirrorToProfile(nextAssignments, nextAssets);
      setNotice('');
      return true;
    });
    return !!res;
  };

  const clear: BusinessLibrary['clear'] = async (slot) => {
    if (!business) return;
    await guard(async () => {
      await store.assignAsset(await getClient(), { projectId, businessId: business.id, slot, assetId: null, manual: true });
      const next = assignments.filter((a) => a.slot !== slot);
      setAssignments(next); mirrorToProfile(next, assets, [slot]);
    });
  };

  const remove: BusinessLibrary['remove'] = async (assetId) => {
    await guard(async () => {
      await store.removeBusinessAsset(await getClient(), assetId);
      const nextAssets = assets.filter((a) => a.id !== assetId);
      // the DB sets asset_id to null on delete; mirror that so the preview never shows a deleted image
      const gone = assignments.filter((a) => a.asset_id === assetId).map((a) => a.slot);
      const nextAssignments = assignments.filter((a) => a.asset_id !== assetId);
      setAssets(nextAssets); setAssignments(nextAssignments); mirrorToProfile(nextAssignments, nextAssets, gone);
    });
  };

  const upload: BusinessLibrary['upload'] = async (file, category) => {
    if (!business) return;
    if (!/^image\//.test(file.type)) { setError('Choose an image file.'); return; }
    await guard(async () => {
      const url = await uploadFileToStorage(file);
      const row = await store.saveBusinessAsset(await getClient(), business.id, { url, role: category, sourceCategory: category, mimeType: file.type, name: file.name }, { origin: 'uploaded' });
      setAssets((a) => [row, ...a.filter((x) => x.id !== row.id)]);
    });
  };

  const syncFromModal: BusinessLibrary['syncFromModal'] = async (since) => {
    const fresh = contacts.getActiveProfile?.() ?? null;
    setProfile(fresh);
    const info = businessFromProfile(fresh);
    if (!info || !signedIn) return 0;
    const n = await guard(async () => {
      const { assetLibraryStore } = await import('../../../components/personalize/assetLibraryStore.js');
      const client = await getClient();
      const biz = await store.upsertBusiness(client, { ...info, source: 'business-finder' });
      let saved = 0;
      for (const a of assetLibraryStore.getAssets() as Array<{ role: string; url: string; uploadedUrl?: string; createdAt?: string; name?: string; mimeType?: string; width?: number; height?: number; sourceUrl?: string }>) {
        // assetLibraryStore is per user, not per business: only what THIS modal session added belongs to this business
        if (!a.createdAt || Date.parse(a.createdAt) < since) continue;
        if (!store.isDurableUrl(a.uploadedUrl || a.url)) continue; // blob/data URLs would break published links
        await store.saveBusinessAsset(client, biz.id, a, { origin: 'discovered' });
        saved += 1;
      }
      setBusiness(biz);
      setAssets(await store.listBusinessAssets(client, biz.id));
      setAssignments(await store.listAssignments(client, projectId, biz.id));
      return saved;
    });
    return n ?? 0;
  };

  const findMore: BusinessLibrary['findMore'] = async () => {
    const since = Date.now();
    const m = await import('../../../features/personalization/mount.jsx');
    m.openPersonalization({ studioId: 'timeline', studioName: 'Timeline Studio', appId: 'ai-video-agent', onComplete: () => { void syncFromModal(since); window.dispatchEvent(new CustomEvent('remix:contact-changed')); } });
  };

  // The overlay-lane "Personalization…" entry opens the same modal; it reports back through this event.
  useEffect(() => {
    const on = (e: Event) => { const since = Number((e as CustomEvent).detail?.since); if (Number.isFinite(since)) void syncFromModal(since); };
    window.addEventListener('remix:personalization-complete', on);
    return () => window.removeEventListener('remix:personalization-complete', on);
  });

  return { profile, business, slots, assets, assignments, busy, error, unavailable, signedIn, notice, assign, clear, remove, upload, findMore, syncFromModal, reload };
}
