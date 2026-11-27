import { describe, it, expect } from 'vitest';
import { loadLocalCustomers, loadCustomers } from '../customerSources.js';

const mem = (obj) => ({ getItem: (k) => (k in obj ? obj[k] : null) });
const CLIENTS = { a: { id: 'a', name: 'Dana Whitfield', businessName: 'Riverside Plumbing', location: 'Austin', email: 'dana@rp.test' }, b: { id: 'b', name: 'Sam Lee', businessName: 'Acme Roofing' } };
const storage = mem({ smartvideo_clients: JSON.stringify(CLIENTS), smartvideo_current_client_id: 'b', smartvideo_client_assets: JSON.stringify({ a: { primaryLogo: { uploadedUrl: 'https://cdn.test/a.png' } } }) });
const store = { getSelectedContactId: () => 'p1', listProfiles: () => [{ id: 'p1', contact: { firstName: 'Pat', company: 'Peak Gym' } }, { id: 'a', contact: { firstName: 'Dana', lastName: 'Whitfield', title: 'Owner' } }] };
const brands = () => [{ id: 'z', brandName: 'Bright Co', primaryColors: ['#0af'], logoUrl: 'https://cdn.test/b.png' }];

describe('loadLocalCustomers', () => {
  it('lists clients, contact profiles and Brand DNA, the current client first', () => {
    const { customers, activeId } = loadLocalCustomers({ store, storage, brands });
    expect(activeId).toBe('b');
    expect(customers.map((c) => c.label)).toEqual(['Acme Roofing', 'Peak Gym', 'Riverside Plumbing', 'Bright Co']);
  });
  it('merges the same customer from the client list and the contact store (role from the profile, logo from the assets)', () => {
    const a = loadLocalCustomers({ store, storage, brands }).customers.find((c) => c.id === 'a');
    expect(a.tokens.role).toBe('Owner'); expect(a.tokens.companylogo).toBe('https://cdn.test/a.png'); expect(a.email).toBe('dana@rp.test');
  });
  it('survives empty or broken storage', () => {
    expect(loadLocalCustomers({ store: {}, storage: mem({ smartvideo_clients: '{oops' }), brands: () => { throw new Error('x'); } }).customers).toEqual([]);
  });
});

describe('loadCustomers', () => {
  it('adds saved leads and merges a lead that is already a customer', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ leads: [{ id: 'l1', business: { name: 'Glow Spa', city: 'Reno' } }, { id: 'l2', business: { name: 'riverside plumbing', website: 'https://rp.test' } }] }) });
    const { customers } = await loadCustomers({ store, storage, brands, fetchImpl });
    expect(customers.map((c) => c.label)).toContain('Glow Spa');
    expect(customers.filter((c) => /riverside/i.test(c.label)).length).toBe(1);
    expect(customers.find((c) => /riverside/i.test(c.label)).business.website).toBe('https://rp.test');
  });
  it('still returns the local customers when the leads request fails', async () => {
    const { customers } = await loadCustomers({ store, storage, brands, fetchImpl: async () => { throw new Error('offline'); } });
    expect(customers.length).toBe(4);
  });
});

describe('saved Personalization projects request', () => {
  it('asks the listing endpoint (?list=true), which would otherwise answer 400', async () => {
    const { fetchSavedProjects } = await import('../customerSources.js');
    const calls = [];
    const out = await fetchSavedProjects(async (url) => { calls.push(url); return { ok: true, json: async () => ({ projects: [{ client: { clientId: 'c1' } }] }) }; });
    expect(calls[0]).toBe('/api/personalization/project?list=true');
    expect(out).toHaveLength(1);
  });
});
