// [remix] Personalized links for ONE published video: one recipient row per contact, no extra video files.
// Reads the contact store + each contact's business assets, writes only `video_recipients` rows.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { buildBulkRows, summarize, type BulkRow, type Recipient, type BusinessRef } from '@cinegen/lib/leads/bulk-rows';
import { importedToRecords, type ImportResult } from '@cinegen/lib/leads/import-contacts';
// @ts-expect-error plain JS
import * as pubClient from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { rowsToCreate, mergeAssetVariables } from '../../../lib/editor/publish/bulkLinks.js';
// @ts-expect-error plain JS
import * as store from '../../../lib/personalization/businessAssetStore.js';
// @ts-expect-error plain JS
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS
import { listContactProfiles } from '../../../lib/editor/personalize/perContact.js';
import { getClient, type usePublished } from './use-publish';
import type { BusinessLibrary } from './use-business-library';

const isMissingSchema = (e: unknown) => /relation .* does not exist|schema cache|could not find the (table|function)|column .* does not exist|PGRST20\d|42P01/i.test((e as Error)?.message || '');

export function useRecipients(pub: ReturnType<typeof usePublished>, lib: BusinessLibrary) {
  const { projectId } = useWorkspace();
  const [contacts, setContacts] = useState<Array<Record<string, any>>>(() => listContactProfiles(contactStore));
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRef[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const videoId = pub.id && pub.info ? pub.id : null;
  const requiredSlots = useMemo(() => lib.slots.filter((s) => !s.hasFallback).map((s) => s.slot), [lib.slots]);

  const refreshContacts = useCallback(() => setContacts(listContactProfiles(contactStore)), []);
  useEffect(() => { window.addEventListener('remix:contact-changed', refreshContacts); return () => window.removeEventListener('remix:contact-changed', refreshContacts); }, [refreshContacts]);

  // `quiet` (background refreshes) must not wipe the message of the action that triggered them ("Created 2 links").
  const guard = useCallback(async <T,>(fn: () => Promise<T>, { quiet = false }: { quiet?: boolean } = {}): Promise<T | undefined> => {
    setBusy(true);
    if (!quiet) { setError(''); setNotice(''); }
    try { return await fn(); } catch (e) { if (isMissingSchema(e)) setUnavailable(true); else setError((e as Error).message); return undefined; } finally { setBusy(false); }
  }, []);

  const reload = useCallback(async () => {
    if (!videoId || !pub.signedIn) { setRecipients([]); return; }
    await guard(async () => {
      const client = await getClient();
      setRecipients(await pubClient.listRecipients(client, videoId));
      const bs = await store.listBusinesses(client);
      setBusinesses(bs.map((b: any) => ({ id: b.id, business_key: b.business_key, name: b.name })));
      setAssets(await store.listAssetsForBusinesses(client, bs.map((b: any) => b.id)));
      setAssignments(await store.listAssignments(client, projectId));
      setUnavailable(false);
    }, { quiet: true });
  }, [videoId, pub.signedIn, projectId, guard]);
  // re-read when the picker changed assets/assignments, so the table never shows a stale "ready"
  // (assigning an image also rewrites that contact's profile, so re-read the contacts too)
  useEffect(() => { refreshContacts(); void reload(); }, [reload, refreshContacts, lib.assets, lib.assignments]);

  const rows: BulkRow[] = useMemo(() => buildBulkRows({ contacts, businesses, assets, assignments, recipients, requiredSlots }), [contacts, businesses, assets, assignments, recipients, requiredSlots]);
  const summary = useMemo(() => summarize(rows), [rows]);
  // image URLs carried by ACTIVE published links: the only assets that count as "used in a video"
  const usedUrls = useMemo(() => new Set(recipients.filter((r) => r.status === 'active').flatMap((r) => Object.values(r.variables ?? {})).filter((v) => /^https?:\/\//i.test(String(v)))), [recipients]);
  const slug = pub.info?.slug ?? null;
  const business = pub.business ?? null;
  const urlOf = useCallback((r: Recipient) => pubClient.publicUrl({ id: videoId, business, slug, recipient: r.token }), [videoId, business, slug]);

  const create = (contactIds: string[], { allowMissing = false } = {}) => guard(async () => {
    const chosen = new Set(contactIds);
    const planned = rows.filter((r) => chosen.has(r.contactId)).map((r) => ({ contactId: r.contactId, label: r.name, businessId: r.businessId, variables: r.plan.variables, missingSlots: r.plan.missingSlots, status: r.plan.status }));
    const todo = rowsToCreate(planned, { allowMissing });
    if (!todo.length) { setNotice('Nothing to create: the selected contacts are already linked or are missing assets.'); return; }
    await pubClient.createRecipients(await getClient(), videoId, todo);
    setNotice(`Created ${todo.length} link${todo.length === 1 ? '' : 's'}.`);
    await reload();
  });

  const revoke = (id: string) => guard(async () => { await pubClient.revokeRecipient(await getClient(), id); setNotice('Link revoked. It stops working immediately and cannot be re-enabled.'); await reload(); });

  /** Re-sync image slots of existing links from the business library. Text values and other businesses are untouched. */
  const refresh = (contactIds: string[]) => guard(async () => {
    const client = await getClient(); let n = 0;
    for (const r of rows.filter((x) => contactIds.includes(x.contactId) && x.stale && x.recipient)) {
      await pubClient.updateRecipientVariables(client, r.recipient!.id, mergeAssetVariables(r.recipient!.variables ?? {}, r.plan.variables)); n += 1;
    }
    setNotice(n ? `Updated ${n} link${n === 1 ? '' : 's'} with the latest images.` : 'Links are already up to date.');
    await reload();
  });

  const saveSlug = (value: string) => guard(async () => { const c = await getClient(); const sl = await pubClient.setSlug(c, videoId, value); setNotice(`Link name saved: /v/${business}/${sl}. The old link keeps working.`); await pub.reload(); });
  const claimBusiness = (value: string, display?: string) => guard(async () => { const b = await pubClient.claimBusinessSlug(await getClient(), value, display ?? null); setNotice(`Business link name saved: ${b}. Links from your old name keep redirecting.`); await pub.loadBusiness(); });

  const importCsv = async () => {
    const { ContactImporterModal } = await import('../../../components/modals/ContactImporterModal.jsx');
    new ContactImporterModal({
      onComplete: (result: ImportResult) => {
        const have = new Set<string>(contacts.map((c) => String(c.contact?.email || c.variables?.email || '').toLowerCase()).filter(Boolean));
        const { records, skipped, reason } = importedToRecords(result, have);
        records.forEach((r) => { contactStore.saveContact(r.contact); contactStore.saveProfile(r.profile); });
        refreshContacts();
        setNotice(reason || `Added ${records.length} contact${records.length === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped: blank or duplicate)` : ''}. Find their assets next.`);
      },
      onError: (e: unknown) => setError(String(e)),
    }).open();
  };

  const findAssets = async (contactId: string) => { contactStore.selectContact(contactId); window.dispatchEvent(new CustomEvent('remix:contact-changed')); await lib.findMore(); };
  const csv = (contactIds?: string[]) => {
    const list = rows.filter((r) => r.recipient && r.linkStatus === 'active' && (!contactIds || contactIds.includes(r.contactId))).map((r) => ({ ...r.recipient!, label: r.name }));
    return pubClient.recipientsCsv(list, { id: videoId, business, slug });
  };

  return { rows, summary, usedUrls, slug, business, claimBusiness, videoId, busy, error, notice, unavailable, urlOf, create, revoke, refresh, saveSlug, importCsv, findAssets, csv, reload, requiredSlots };
}
