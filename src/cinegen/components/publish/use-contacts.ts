// [remix] Loads the three contact sources for the Contacts and Email pages. A source that cannot be reached (signed out, offline) is
// reported on its own, so the others still show.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublished } from '../leads/use-publish';
import { useLeads } from '../leads/use-leads';
import { getClient } from '../leads/use-publish';
// @ts-expect-error plain JS browser contact store
import * as store from '../../../lib/contactStore.js';
// @ts-expect-error plain JS landing pages client
import { listPages, listContacts as listLandingContacts, removeContact as removeLandingContact } from '../../../lib/landingPages/client.js';
import { fromLandingRow, fromLeadRow, fromStored, importFromCsv, mergeContacts, type ContactSource, type PubContact } from '@cinegen/lib/publish/contacts';
import { generateId } from '@cinegen/lib/utils/ids';

const MAX_PAGES = 20;
export interface ContactsData {
  contacts: PubContact[];
  loading: boolean;
  /** One message per source that could not be loaded. */
  problems: Partial<Record<ContactSource, string>>;
  reload: () => Promise<void>;
  importCsv: (text: string) => { added: number; skipped: Array<{ line: number; reason: string }>; hasEmailColumn: boolean };
  remove: (c: PubContact) => void;
}

export function useContacts(): ContactsData {
  const pub = usePublished();
  const leads = useLeads(pub.id, !!pub.info);
  const [stored, setStored] = useState<PubContact[]>(() => (store.listContacts() as never[]).map(fromStored));
  const [landing, setLanding] = useState<PubContact[]>([]);
  const [landingLoading, setLandingLoading] = useState(false);
  const [landingError, setLandingError] = useState('');

  const refreshStored = useCallback(() => setStored((store.listContacts() as never[]).map(fromStored)), []);
  useEffect(() => { const on = () => refreshStored(); window.addEventListener('remix:contact-changed', on); window.addEventListener('storage', on); return () => { window.removeEventListener('remix:contact-changed', on); window.removeEventListener('storage', on); }; }, [refreshStored]);

  const loadLanding = useCallback(async () => {
    setLandingLoading(true); setLandingError('');
    try {
      const client = await getClient();
      // Only the signed-in owner's pages (published pages of other users are readable too, for their public links).
      const ownerId = (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id;
      const pages = ((await listPages(client, ownerId)) as Array<{ id: string; title?: string }>).slice(0, MAX_PAGES);
      const rows = await Promise.all(pages.map(async (p) => ((await listLandingContacts(client, p.id)) as Array<{ id: string; fields?: Record<string, string>; created_at?: string }>).map((r) => fromLandingRow(r, p.title || 'Untitled page'))));
      setLanding(rows.flat());
    } catch (e) { setLanding([]); setLandingError(e instanceof Error ? e.message : 'Could not load landing page contacts'); }
    setLandingLoading(false);
  }, []);
  useEffect(() => { void loadLanding(); }, [loadLanding]);

  const leadContacts = useMemo(() => leads.rows.map(fromLeadRow), [leads.rows]);
  const contacts = useMemo(() => mergeContacts(stored, leadContacts, landing), [stored, leadContacts, landing]);

  const reload = useCallback(async () => { refreshStored(); await Promise.all([leads.reload(), loadLanding()]); }, [refreshStored, leads, loadLanding]);

  const importCsv = useCallback((text: string) => {
    const existing = new Set(contacts.map((c) => c.email).filter(Boolean));
    const r = importFromCsv(text, existing, generateId);
    r.contacts.forEach((c) => store.saveContact(c));
    if (r.contacts.length) refreshStored();
    return { added: r.contacts.length, skipped: r.skipped, hasEmailColumn: r.hasEmailColumn };
  }, [contacts, refreshStored]);

  const remove = useCallback((c: PubContact) => {
    if (c.removableId) { store.deleteContact(c.removableId); refreshStored(); }
  }, [refreshStored]);

  const problems: Partial<Record<ContactSource, string>> = {};
  if (landingError) problems.landing = landingError;
  if (leads.error) problems.leads = leads.error;
  return { contacts, loading: leads.loading || landingLoading, problems, reload, importCsv, remove };
}
// kept so a page can also remove a landing-page contact later without another import
export { removeLandingContact };
