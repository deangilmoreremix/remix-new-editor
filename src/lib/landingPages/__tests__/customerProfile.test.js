import { describe, it, expect } from 'vitest';
import { normalizeCustomer, mergeCustomer, dedupeCustomers, customerTokens, toContactFields, applyCustomerToPuck, brandForConfig, websiteUrl, httpsUrl, hexColor } from '../customerProfile.js';
import { PUCK_TEMPLATES } from '../puck/designs.js';

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

describe('tokens and contact row', () => {
  const c = normalizeCustomer(CLIENT, 'client', { assets: ASSETS });
  it('customerTokens only returns the public page tokens', () => {
    expect(Object.keys(customerTokens(c)).sort()).toEqual(['city', 'company', 'companylogo', 'firstname', 'lastname']);
  });
  it('toContactFields keeps the email (owner only) and skips customers with nothing to personalize', () => {
    expect(toContactFields(c).email).toBe('dana@riversideplumbing.com');
    expect(toContactFields(normalizeCustomer({ id: 'x', email: 'a@b.co' }, 'client'))).toBeNull();
  });
  it('brandForConfig matches what defaultConfig expects', () => {
    expect(brandForConfig(c)).toEqual({ accent: '', logoUrl: 'https://cdn.test/logo.png', name: 'Riverside Plumbing' });
  });
});

describe('applyCustomerToPuck on every design', () => {
  const c = normalizeCustomer(CLIENT, 'client', { assets: ASSETS, brandColors: { primary: '#ff8a1f' } });
  it('writes only brand slots and keeps every section, copy and token', () => {
    PUCK_TEMPLATES.forEach((t) => {
      const { data, applied } = applyCustomerToPuck(t.puckData, c);
      expect(data.content.map((x) => x.type)).toEqual(t.puckData.content.map((x) => x.type));
      expect(data.root.props.accent).toBe('#ff8a1f');
      expect(applied).toContain('page colour');
      const nav = data.content.find((x) => x.type === 'NavBar');
      if (nav) { expect(nav.props.brand).toBe('Riverside Plumbing'); expect(nav.props.logo).toBe('https://cdn.test/logo.png'); }
      // everything except the brand slots is untouched
      const strip = (d) => JSON.stringify(d.content.map((x) => (x.type === 'NavBar' || x.type === 'Footer' ? { type: x.type } : x)));
      expect(strip(data)).toBe(strip(t.puckData));
    });
  });
  it('does not mutate its input and does nothing without a customer', () => {
    const t = PUCK_TEMPLATES[1]; const before = JSON.stringify(t.puckData);
    applyCustomerToPuck(t.puckData, c); expect(JSON.stringify(t.puckData)).toBe(before);
    expect(applyCustomerToPuck(t.puckData, null).applied).toEqual([]);
  });
  it('keeps the default footer wording out of a real business footer', () => {
    const t = PUCK_TEMPLATES.find((x) => x.puckData.content.some((y) => y.type === 'Footer'));
    const { data } = applyCustomerToPuck(t.puckData, c);
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
