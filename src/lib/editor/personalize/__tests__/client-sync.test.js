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

describe('an edited (background-removed) asset replaces the copy synced earlier', () => {
  beforeEach(() => localStorage.clear());

  const lib = (logo) => ({ logos: [logo], primaryLogo: logo });

  it('{{logoUrl}} follows the cutout after the studio re-saves the same asset id', () => {
    const original = { id: 'logo-1', role: 'logo', url: 'https://cdn.test/logo.jpg' };
    seed([ann], { smartvideo_client_assets: { [ann.id]: lib(original) } });
    syncPersonalizeContacts({ store });
    expect(resolveToken(store.getProfile(ann.id), 'logoUrl')).toBe('https://cdn.test/logo.jpg');

    // "Use Edited Asset": same id, url becomes the cutout, old url kept as originalUrl.
    const cutout = { ...original, url: 'https://cdn.test/logo-cutout.png', originalUrl: original.url, edited: true, hasTransparency: true };
    seed([ann], { smartvideo_client_assets: { [ann.id]: lib(cutout) } });
    syncPersonalizeContacts({ store });

    const profile = store.getProfile(ann.id);
    expect(resolveToken(profile, 'logoUrl')).toBe('https://cdn.test/logo-cutout.png');
    expect(profile.personalization.assets.logos[0].hasTransparency).toBe(true);
  });

  it('keeps assets the editor added that the studio does not have', () => {
    const merged = mergeProfile(
      { personalization: { assets: { logos: [{ id: 'editor-only', url: 'https://cdn.test/e.png' }] } } },
      { personalization: { assets: { logos: [{ id: 'logo-1', url: 'https://cdn.test/a.png' }] } } },
    );
    expect(merged.personalization.assets.logos.map((a) => a.id).sort()).toEqual(['editor-only', 'logo-1']);
  });
});

describe('a not-yet-uploaded edit does not leak a blob url into the video', () => {
  beforeEach(() => localStorage.clear());
  it('{{logoUrl}} resolves to the durable uploaded url, not the blob', () => {
    const logo = { id: 'logo-1', role: 'logo', url: 'blob:http://localhost/abc', uploadedUrl: 'https://cdn.test/logo-cutout.png', originalUrl: 'https://cdn.test/logo.jpg', edited: true };
    seed([ann], { smartvideo_client_assets: { [ann.id]: { logos: [logo], primaryLogo: logo } } });
    syncPersonalizeContacts({ store });
    expect(resolveToken(store.getProfile(ann.id), 'logoUrl')).toBe('https://cdn.test/logo-cutout.png');
  });
});

describe('a cutout made on the timeline survives a sync until the studio changes the image', () => {
  beforeEach(() => localStorage.clear());
  const original = { id: 'logo-1', role: 'logo', url: 'https://cdn.test/logo.jpg' };
  const madeHere = { ...original, url: 'data:image/png;base64,Q1VU', originalUrl: original.url, edited: true, hasTransparency: true };

  const syncWith = (studioLogo) => {
    seed([ann], { smartvideo_client_assets: { [ann.id]: { logos: [studioLogo], primaryLogo: studioLogo } } });
    syncPersonalizeContacts({ store });
    return store.getProfile(ann.id).personalization.assets.logos[0];
  };

  it('keeps the local cutout when the studio still has the original it was made from', () => {
    syncWith(original);
    store.saveProfile({ ...store.getProfile(ann.id), personalization: { ...store.getProfile(ann.id).personalization, assets: { ...store.getProfile(ann.id).personalization.assets, logos: [madeHere] } } });
    const after = syncWith(original);
    expect(after).toMatchObject({ url: 'data:image/png;base64,Q1VU', hasTransparency: true, originalUrl: original.url });
    expect(resolveToken(store.getProfile(ann.id), 'logoUrl')).toBe('data:image/png;base64,Q1VU');
  });
  it('lets the studio win when it changed the asset itself', () => {
    syncWith(original);
    store.saveProfile({ ...store.getProfile(ann.id), personalization: { ...store.getProfile(ann.id).personalization, assets: { ...store.getProfile(ann.id).personalization.assets, logos: [madeHere] } } });
    const replaced = { ...original, url: 'https://cdn.test/new-logo.jpg' };
    expect(syncWith(replaced).url).toBe('https://cdn.test/new-logo.jpg');
  });
  it('lets the studio win when it has its own cutout of the asset', () => {
    syncWith(original);
    store.saveProfile({ ...store.getProfile(ann.id), personalization: { ...store.getProfile(ann.id).personalization, assets: { ...store.getProfile(ann.id).personalization.assets, logos: [madeHere] } } });
    const studioCut = { ...original, url: 'https://cdn.test/studio-cut.png', originalUrl: original.url, edited: true, hasTransparency: true };
    expect(syncWith(studioCut).url).toBe('https://cdn.test/studio-cut.png');
  });
});
