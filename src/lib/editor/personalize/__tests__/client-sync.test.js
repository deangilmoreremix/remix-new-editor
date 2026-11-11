import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as store from '../../../contactStore.js';
import { resolveToken } from '../../../../components/personalize/tokenSchema.js';
import { clientToProfile, leadToProfile, mergeProfile, syncPersonalizeContacts, createContactSync, fetchSavedLeads, splitName } from '../clientSync.js';
import { listContactProfiles, contactName } from '../perContact.js';

// As the Personalize window (OpenHiggsBolt) saves them.
const ann = { id: 'client-1-aaa', audience: 'client', name: 'Ann Lee', businessName: 'Acme Plumbing', industry: 'Plumbing', location: 'Austin, TX', productService: 'Water heaters', offer: '10% off', ctaHeadline: 'Hot water today', callToAction: 'Call now', phone: '555 0100', website: 'https://acme.test', brandDescription: 'Family plumbers since 1999', createdAt: '', updatedAt: '' };
const raj = { id: 'client-2-bbb', audience: 'me', name: 'Raj Patel', businessName: 'Bright Dental', industry: '', location: '', productService: '', offer: '', ctaHeadline: '', callToAction: '', phone: '', website: '', brandDescription: '', createdAt: '', updatedAt: '' };
const lead = { id: 'f3a1', stage: 'New', niche: 'Dentist', location: 'Dallas', business: { name: 'Smile Dental', category: 'dentist', city: 'Dallas', region: 'TX', phone: '555 0222', email: 'hi@smile.test', website: 'https://smile.test' } };

const seed = (clients, extra = {}) => {
  localStorage.setItem('smartvideo_clients', JSON.stringify(Object.fromEntries(clients.map((c) => [c.id, c]))));
  Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
};

describe('Personalize window (OpenHiggsBolt) contacts reach the editor', () => {
  beforeEach(() => localStorage.clear());

  it('splits names and maps a client onto the studio tokens, business details included', () => {
    expect(splitName('Ann van Lee')).toEqual({ firstName: 'Ann', lastName: 'van Lee' });
    const p = clientToProfile(ann);
    expect(p.id).toBe('client-1-aaa');
    const r = (k) => resolveToken(p, k);
    expect([r('firstName'), r('lastName'), r('fullName'), r('company')]).toEqual(['Ann', 'Lee', 'Ann Lee', 'Acme Plumbing']);
    expect([r('businessName'), r('businessPhone'), r('productService'), r('offer'), r('ctaHeadline'), r('callToAction'), r('industry'), r('location')])
      .toEqual(['Acme Plumbing', '555 0100', 'Water heaters', '10% off', 'Hot water today', 'Call now', 'Plumbing', 'Austin, TX']);
  });

  it('maps a saved Lead Finder lead and skips Not Interested', () => {
    const p = leadToProfile(lead);
    expect(p.id).toBe('lead-f3a1');
    expect(resolveToken(p, 'businessName')).toBe('Smile Dental');
    expect(resolveToken(p, 'location')).toBe('Dallas, TX');
    expect(resolveToken(p, 'email')).toBe('hi@smile.test');
    seed([]);
    syncPersonalizeContacts({ store, leads: [lead, { ...lead, id: 'x9', stage: 'Not Interested' }] });
    expect(listContactProfiles(store).map((c) => c.id)).toEqual(['lead-f3a1']);
  });

  it('syncs clients into the contact store the editor reads, once and idempotently', () => {
    seed([ann, raj]);
    expect(syncPersonalizeContacts({ store }).changed).toBe(2);
    expect(listContactProfiles(store).map(contactName).sort()).toEqual(['Ann Lee', 'Raj Patel']);
    expect(store.listContacts().map((c) => c.id).sort()).toEqual(['client-1-aaa', 'client-2-bbb']);
    expect(syncPersonalizeContacts({ store }).changed).toBe(0);
  });

  it('merges instead of replacing: images the editor added stay, empty studio fields do not wipe values', () => {
    seed([ann]);
    syncPersonalizeContacts({ store });
    const p = store.getProfile('client-1-aaa');
    store.saveProfile({ ...p, personalization: { ...p.personalization, assets: { logos: [{ id: 'ai-logo', url: 'https://img/ai.png', aiGenerated: true }], primaryLogoId: 'ai-logo' } } });
    // The studio now has the same client with the phone cleared.
    seed([{ ...ann, phone: '', offer: '20% off' }]);
    expect(syncPersonalizeContacts({ store }).changed).toBe(1);
    const after = store.getProfile('client-1-aaa');
    expect(after.personalization.assets.logos[0].id).toBe('ai-logo');
    expect(resolveToken(after, 'logoUrl')).toBe('https://img/ai.png');
    expect(resolveToken(after, 'offer')).toBe('20% off');
    expect(resolveToken(after, 'businessPhone')).toBe('555 0100');
  });

  it('brings the client images across and keeps the primary ones', () => {
    seed([ann], { smartvideo_client_assets: { 'client-1-aaa': { logos: [{ id: 'l1', url: 'https://img/logo.png' }], primaryLogo: { id: 'l1', url: 'https://img/logo.png' }, identities: [{ id: 'i1', url: 'https://img/ann.png' }], primaryIdentity: { id: 'i1' }, products: [], brandReferences: [] } } });
    syncPersonalizeContacts({ store });
    const p = store.getProfile('client-1-aaa');
    expect(resolveToken(p, 'logoUrl')).toBe('https://img/logo.png');
    expect(resolveToken(p, 'avatarUrl')).toBe('https://img/ann.png');
  });

  it('selects the studio\'s current client once, then leaves the editor\'s own choice alone', () => {
    seed([ann, raj], { smartvideo_current_client_id: 'client-1-aaa' });
    expect(syncPersonalizeContacts({ store }).selected).toBe('client-1-aaa');
    expect(store.getSelectedContactId()).toBe('client-1-aaa');
    store.selectContact('client-2-bbb'); // "Preview as" in the editor
    expect(syncPersonalizeContacts({ store }).selected).toBeNull();
    expect(store.getSelectedContactId()).toBe('client-2-bbb');
    localStorage.setItem('smartvideo_current_client_id', 'client-1-aaa'); // unchanged id: still no override
    syncPersonalizeContacts({ store });
    expect(store.getSelectedContactId()).toBe('client-2-bbb');
    localStorage.setItem('smartvideo_current_client_id', 'client-2-bbb'); // the studio picks another: now it switches
    expect(syncPersonalizeContacts({ store }).selected).toBe('client-2-bbb');
  });

  it('the controller syncs on change, fetches leads with the session, and survives 401 / offline', async () => {
    seed([ann]);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ leads: [lead] }), { status: 200 }));
    const onChange = vi.fn();
    const sync = createContactSync({ store, fetchImpl, onChange });
    await sync.run();
    expect(fetchImpl).toHaveBeenCalledWith('/api/personalization/leads', { credentials: 'same-origin' });
    expect(listContactProfiles(store).map((c) => c.id).sort()).toEqual(['client-1-aaa', 'lead-f3a1']);
    expect(onChange).toHaveBeenCalled();
    const calls = fetchImpl.mock.calls.length;
    sync.check(); // storage unchanged: nothing to do
    expect(fetchImpl.mock.calls.length).toBe(calls);
    seed([ann, raj]); // the studio saved another client
    sync.check();
    expect(listContactProfiles(store).length).toBe(3);
    expect(await fetchSavedLeads(async () => new Response('{}', { status: 401 }))).toEqual([]);
    expect(await fetchSavedLeads(async () => { throw new Error('offline'); })).toEqual([]);
  });

  it('mergeProfile never drops existing fields', () => {
    const merged = mergeProfile({ id: 'a', intelligence: { summary: 'S' }, contact: { title: 'CEO' } }, { id: 'a', contact: { name: 'Ann' }, personalization: { business: { businessName: 'Acme' } } });
    expect(merged.intelligence.summary).toBe('S');
    expect(merged.contact).toEqual({ title: 'CEO', name: 'Ann' });
  });
});
