import { PUBLIC_TOKEN_KEYS } from '../templates.js';
import { describe, it, expect } from 'vitest';
import { normalizeCustomer, mergeCustomer, dedupeCustomers, customerTokens, toContactFields, applyCustomerToEditor, brandForConfig, websiteUrl, httpsUrl, hexColor } from '../customerProfile.js';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';

const CLIENT = { id: 'c1', name: 'Dana Whitfield', businessName: 'Riverside Plumbing', industry: 'Plumbing', location: 'Austin, TX', phone: '(512) 555-0142', website: 'riversideplumbing.com', offer: 'Free quote', callToAction: 'Book now', ctaHeadline: 'Fast fixes', email: 'dana@riversideplumbing.com', brandDescription: 'Family plumbers since 1999' };
const ASSETS = { primaryLogo: { url: 'blob:x', uploadedUrl: 'https://cdn.test/logo.png' } };

describe('normalizeCustomer', () => {
  it('turns a Personalization-modal client into tokens, business facts and brand', () => {
    const c = normalizeCustomer(CLIENT, 'client', { assets: ASSETS, brandColors: { primary: '#ff8a1f' } });
    expect(c.tokens).toMatchObject({ firstname: 'Dana', lastname: 'Whitfield', company: 'Riverside Plumbing', city: 'Austin, TX', companylogo: 'https://cdn.test/logo.png' });
    expect(c.business).toMatchObject({ name: 'Riverside Plumbing', industry: 'Plumbing', website: 'https://riversideplumbing.com', offer: 'Free quote', cta: 'Book now' });
    expect(c.brand).toEqual({ accent: '#ff8a1f', logoUrl: 'https://cdn.test/logo.png' });
    expect(c.email).toBe('dana@riversideplumbing.com');
    expect(c.id).toBe('c1');
  });
  it('reads a contact-store profile (company, title, brand colour, logos)', () => {
    const c = normalizeCustomer({ id: 'p1', contact: { firstName: 'Sam', lastName: 'Lee', company: 'Acme', title: 'Owner', email: 'sam@acme.co', location: 'Denver' }, brand: { colors: { primary: '#123456' } }, assets: { logos: [{ url: 'https://cdn.test/a.png' }] }, personalization: { business: { businessName: 'Acme Roofing', phone: '303-555-0100' } } }, 'profile');
    expect(c.tokens).toMatchObject({ firstname: 'Sam', lastname: 'Lee', company: 'Acme', role: 'Owner', city: 'Denver', companylogo: 'https://cdn.test/a.png' });
    expect(c.business.name).toBe('Acme Roofing');
    expect(c.brand.accent).toBe('#123456');
  });
  it('reads a Lead Finder lead (business snapshot) and a Brand DNA record and website research', () => {
    const lead = normalizeCustomer({ id: 'l9', business: { name: 'Glow Spa', category: 'Spa', city: 'Reno', phone: '775 555 0199', website: 'https://glow.example', email: 'hi@glow.example' } }, 'lead');
    expect(lead).toMatchObject({ id: 'l9', label: 'Glow Spa' });
    expect(lead.tokens).toMatchObject({ company: 'Glow Spa', city: 'Reno' });
    const brand = normalizeCustomer({ id: 'b1', brandName: 'Bright Co', primaryColors: ['#0af'], logoUrl: 'https://cdn.test/b.png', tagline: 'Shine' }, 'brand');
    expect(brand.brand).toEqual({ accent: '#0af', logoUrl: 'https://cdn.test/b.png' });
    const r = normalizeCustomer({ title: 'Peak Gym', logoUrl: 'https://cdn.test/g.png', brandColors: { primary: '#00ff88' }, contactInfo: { phones: ['+1 202 555 0111'], emails: ['info@peak.test'] }, canonicalUrl: 'https://peak.test' }, 'research');
    expect(r).toMatchObject({ label: 'Peak Gym' }); expect(r.business.website).toBe('https://peak.test');
  });
  it('rejects unsafe or invalid values', () => {
    const c = normalizeCustomer({ ...CLIENT, website: 'javascript:alert(1)', phone: 'abc', email: 'not-an-email' }, 'client', { assets: { primaryLogo: { url: 'http://insecure/logo.png' } }, brandColors: { primary: 'red; background:url(x)' } });
    expect(c.business.website).toBe(''); expect(c.business.phone).toBe(''); expect(c.email).toBe('');
    expect(c.brand.logoUrl).toBe(''); expect(c.brand.accent).toBe('');
    expect(httpsUrl('https://a.test/x"y')).toBe(''); expect(hexColor('#12')).toBe(''); expect(websiteUrl('a b.com')).toBe('');
  });
  it('returns null for empty or unknown records', () => {
    expect(normalizeCustomer({}, 'client')).toBeNull(); expect(normalizeCustomer(null, 'lead')).toBeNull(); expect(normalizeCustomer({ name: 'x' }, 'nope')).toBeNull();
  });
});

describe('merge / dedupe', () => {
  it('fills gaps from discovered data without overwriting what the user typed', () => {
    const a = normalizeCustomer({ id: 'c1', businessName: 'Riverside Plumbing' }, 'client');
    const b = normalizeCustomer({ title: 'Riverside Plumbing', logoUrl: 'https://cdn.test/l.png', brandColors: { primary: '#0af' }, contactInfo: { phones: ['512 555 0100'] } }, 'research');
    const m = mergeCustomer(a, b);
    expect(m.business.name).toBe('Riverside Plumbing'); expect(m.brand.logoUrl).toBe('https://cdn.test/l.png'); expect(m.business.phone).toBe('512 555 0100');
  });
  it('merges the same business seen as a client and a lead', () => {
    const list = dedupeCustomers([normalizeCustomer(CLIENT, 'client'), normalizeCustomer({ id: 'l1', business: { name: 'riverside plumbing', website: 'https://other.test' } }, 'lead'), normalizeCustomer({ businessName: 'Other Co' }, 'client')]);
    expect(list.length).toBe(2); expect(list[0].business.website).toBe('https://riversideplumbing.com');
  });
});

describe('dedupe keeps distinct people', () => {
  it('does not merge two people who share a company', () => {
    const ann = normalizeCustomer({ id: 'a', name: 'Ann Lee', businessName: 'Acme', email: 'ann@acme.com' }, 'client');
    const bob = normalizeCustomer({ id: 'b', name: 'Bob Ray', businessName: 'Acme', email: 'bob@acme.com' }, 'client');
    const list = dedupeCustomers([ann, bob]);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.tokens.firstname)).toEqual(['Ann', 'Bob']);
  });
  it('still merges the same person (same email, different id)', () => {
    const a = normalizeCustomer({ id: 'a', name: 'Ann Lee', businessName: 'Acme', email: 'ANN@acme.com' }, 'client');
    const b = normalizeCustomer({ id: 'z', name: 'Ann Lee', businessName: 'Acme', email: 'ann@acme.com', phone: '555 0100' }, 'lead');
    expect(dedupeCustomers([a, b])).toHaveLength(1);
  });
  it('still folds a business-only record into its business', () => {
    const ann = normalizeCustomer({ id: 'a', name: 'Ann Lee', businessName: 'Acme' }, 'client');
    const biz = normalizeCustomer({ id: 'l', business: { name: 'acme', website: 'https://acme.test' } }, 'lead');
    expect(dedupeCustomers([ann, biz])).toHaveLength(1);
  });
});

describe('tokens and contact row', () => {
  const c = normalizeCustomer(CLIENT, 'client', { assets: ASSETS });
  it('customerTokens only returns the public page tokens', () => {
    const keys = Object.keys(customerTokens(c));
    expect(keys.sort()).toEqual(expect.arrayContaining(['city', 'company', 'companylogo', 'custom1', 'custom2', 'firstname', 'lastname'])); // custom1/custom2 = city / the person, for designs that read them
    keys.forEach((k) => expect(PUBLIC_TOKEN_KEYS).toContain(k)); // never anything a viewer may not see (no email)
  });
  it('toContactFields keeps the email (owner only) and skips customers with nothing to personalize', () => {
    expect(toContactFields(c).email).toBe('dana@riversideplumbing.com');
    expect(toContactFields(normalizeCustomer({ id: 'x', email: 'a@b.co' }, 'client'))).toBeNull();
  });
  it('brandForConfig matches what defaultConfig expects', () => {
    expect(brandForConfig(c)).toEqual({ accent: '', logoUrl: 'https://cdn.test/logo.png', name: 'Riverside Plumbing' });
  });
});

describe('applyCustomerToEditor on every design', () => {
  const c = normalizeCustomer(CLIENT, 'client', { assets: ASSETS, brandColors: { primary: '#ff8a1f' } });
  it('writes only brand slots and keeps every section, copy and token', () => {
    EDITABLE_TEMPLATES.forEach((t) => {
      const { data, applied } = applyCustomerToEditor(t.editorData, c);
      expect(data.content.map((x) => x.type)).toEqual(t.editorData.content.map((x) => x.type));
      expect(data.root.props.accent).toBe('#ff8a1f');
      expect(applied).toContain('page colour');
      const nav = data.content.find((x) => /Nav(Bar)?$/.test(x.type));
      if (nav) { expect(nav.props.brand).toBe('Riverside Plumbing'); expect(nav.props.logo).toBe('https://cdn.test/logo.png'); }
      // everything except the brand slots is untouched
      const strip = (d) => JSON.stringify(d.content.map((x) => (/Nav(Bar)?$/.test(x.type) || x.type === 'Footer' ? { type: x.type } : x)));
      expect(strip(data)).toBe(strip(t.editorData));
    });
  });
  it('does not mutate its input and does nothing without a customer', () => {
    const t = EDITABLE_TEMPLATES[1]; const before = JSON.stringify(t.editorData);
    applyCustomerToEditor(t.editorData, c); expect(JSON.stringify(t.editorData)).toBe(before);
    expect(applyCustomerToEditor(t.editorData, null).applied).toEqual([]);
  });
  it('keeps the default footer wording out of a real business footer', () => {
    const t = EDITABLE_TEMPLATES.find((x) => x.editorData.content.some((y) => y.type === 'Footer'));
    const { data } = applyCustomerToEditor(t.editorData, c);
    expect(data.content.find((x) => x.type === 'Footer').props.text).toContain('Riverside Plumbing');
  });
});

describe('contacts imported in the Personalize hub', () => {
  it('become customers with their own name, company, city and title', () => {
    const c = normalizeCustomer({ firstName: 'Ana', lastName: 'Ruiz', email: 'ana@x.co', company: 'Peak Gym', phone: '202 555 0111', title: 'Owner', city: 'Reno' }, 'contact');
    expect(c.tokens).toMatchObject({ firstname: 'Ana', lastname: 'Ruiz', company: 'Peak Gym', role: 'Owner', city: 'Reno' });
    expect(toContactFields(c)).toMatchObject({ firstname: 'Ana', email: 'ana@x.co' });
    expect(normalizeCustomer({ phone: '123' }, 'contact')).toBeNull();
  });
});

import { personalImagesFromProjects, attachPersonalImages } from '../customerProfile.js';

describe('the customer\'s personalized picture', () => {
  const PROJECTS = [
    { updated_at: '2026-11-10T00:00:00Z', client: { id: 'c1', businessName: 'Riverside Plumbing' }, output_type: 'image', generation: { outputUrls: ['https://cdn.test/old.png'] } },
    { updated_at: '2026-11-15T00:00:00Z', client: { id: 'c1', businessName: 'Riverside Plumbing' }, output_type: 'video', generation: { outputUrls: ['https://cdn.test/clip.mp4', 'blob:xyz', 'https://cdn.test/new.webp'] } },
    { updated_at: '2026-11-12T00:00:00Z', client: { businessName: 'Acme Roofing' }, output_type: 'image', generation: { outputUrls: ['https://cdn.test/acme-image'] } },
    { updated_at: '2026-11-12T00:00:00Z', client: { id: 'c9' }, generation: { outputUrls: ['http://insecure/x.png'] } },
  ];
  it('takes the newest https picture per customer (id first, then business name), never videos, blob: or http', () => {
    const { byId, byName } = personalImagesFromProjects(PROJECTS);
    expect(byId.c1).toBe('https://cdn.test/new.webp');
    expect(byName.acmeroofing).toBe('https://cdn.test/acme-image');
    expect(byId.c9).toBeUndefined();
  });
  it('attaches it to the customers and keeps one they already have', () => {
    const list = attachPersonalImages([normalizeCustomer({ id: 'c1', businessName: 'Riverside Plumbing' }, 'client'), normalizeCustomer({ id: 'x', businessName: 'Acme Roofing' }, 'client'), { ...normalizeCustomer({ id: 'y', businessName: 'Mine' }, 'client'), image: 'https://cdn.test/mine.png' }], PROJECTS);
    expect(list.map((c) => c.image)).toEqual(['https://cdn.test/new.webp', 'https://cdn.test/acme-image', 'https://cdn.test/mine.png']);
  });
  it('applyCustomerToEditor puts it in every design\'s video slot when asked, and not when switched off', () => {
    const c = { ...normalizeCustomer(CLIENT, 'client'), image: 'https://cdn.test/personal.png' };
    EDITABLE_TEMPLATES.forEach((t) => {
      const hasSlot = t.editorData.content.some((x) => /Hero|VideoSection/.test(x.type));
      const on = applyCustomerToEditor(t.editorData, c);
      const off = applyCustomerToEditor(t.editorData, c, { useImage: false });
      const slots = (d) => JSON.stringify(d).match(/"slotImage":"https:\/\/cdn\.test\/personal\.png"/g) || [];
      expect(off.data && slots(off.data).length).toBe(0);
      if (hasSlot) { expect(slots(on.data).length).toBeGreaterThan(0); expect(on.applied).toContain('personalized image'); } else expect(slots(on.data).length).toBe(0);
    });
  });
});

describe('personalized picture without the brand option', () => {
  const c = { ...normalizeCustomer(CLIENT, 'client', { assets: ASSETS, brandColors: { primary: '#ff8a1f' } }), image: 'https://cdn.test/me.png' };
  it('fills only the video slot picture when the brand option is off', () => {
    const t = EDITABLE_TEMPLATES.find((x) => x.id === 'editable-pc-roofing');
    const { data, applied } = applyCustomerToEditor(t.editorData, c, { useImage: true, brand: false });
    expect(data.content.find((x) => x.type === 'Hero').props.slotImage).toBe('https://cdn.test/me.png');
    expect(data.root.props.accent).toBe(t.editorData.root.props.accent);
    expect(data.content.find((x) => x.type === 'NavBar').props.brand).toBe(t.editorData.content.find((x) => x.type === 'NavBar').props.brand);
    expect(applied).toEqual(['personalized image']);
  });
});

describe('personal image lookup', () => {
  it('ignores inherited object keys such as "constructor"', async () => {
    const { attachPersonalImages } = await import('../customerProfile.js');
    const out = attachPersonalImages([{ id: 'constructor', business: { name: 'Constructor' }, image: '' }], []);
    expect(out[0].image).toBe('');
  });
});

describe('personal image from a saved project that only has client.clientId', () => {
  it('attaches the picture by the persisted clientId', async () => {
    const { attachPersonalImages } = await import('../customerProfile.js');
    const c = normalizeCustomer(CLIENT, 'client');
    const out = attachPersonalImages([c], [{ client: { clientId: c.id }, generation: { outputUrls: ['https://cdn.test/p.png'] }, output_type: 'image', updated_at: '2026-01-01' }]);
    expect(out[0].image).toBe('https://cdn.test/p.png');
  });
});

describe('personal image ordering', () => {
  const row = (clientId, url, saved, generated) => ({ client: { clientId }, output_type: 'image', updated_at: saved, generation: { outputUrls: [url], ...(generated ? { outputGeneratedAt: generated } : {}) } });
  it('picks the newest generated picture, not the most recently saved project', () => {
    const { byId } = personalImagesFromProjects([
      row('c1', 'https://cdn.test/older-generation.png', '2026-11-16T00:00:00Z', '2026-11-01T00:00:00Z'), // saved again later by an unrelated edit
      row('c1', 'https://cdn.test/newer-generation.png', '2026-11-10T00:00:00Z', '2026-11-09T00:00:00Z'),
    ]);
    expect(byId.c1).toBe('https://cdn.test/newer-generation.png');
  });
  it('still orders older rows (no generation stamp) by when they were saved', () => {
    const { byId } = personalImagesFromProjects([
      row('c2', 'https://cdn.test/a.png', '2026-11-01T00:00:00Z'),
      row('c2', 'https://cdn.test/b.png', '2026-11-05T00:00:00Z'),
    ]);
    expect(byId.c2).toBe('https://cdn.test/b.png');
  });
});
