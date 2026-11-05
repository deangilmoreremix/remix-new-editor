// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { BRAND, PITCH, setBrand } from '../demosrc/_fixtures/Brand';
import { brandFor } from '../lib/filmPipeline';
import { siteNameOf } from '../lib/filmChat';
import type { DirectorPlan } from '../lib/directorPlan';
import type { SiteCapture } from '../lib/directorClient';

const plan = { title: 't', summary: '', palette: { background: '#101010', text: '#f5f5f5', accent: '#ff5500' }, scenes: [] } as unknown as DirectorPlan;
const capture = {
  url: 'https://www.connections.com/',
  title: 'Connections | Home',
  page: { url: 'p', width: 1, height: 1 },
  crops: [],
  logo: 'https://img/logo.png',
  brand: { background: null, text: null, accent: null, fontFamily: 'Inter' },
  content: { headline: 'Grow with us', headings: ['One', 'Two'] },
  transient: false,
} as SiteCapture;

describe('brand context', () => {
  afterEach(() => setBrand(null));

  it('speaks as the company, then returns to SmartVideo GO', () => {
    const brand = brandFor(plan, capture);
    expect(brand?.name).toBe('Connections');
    setBrand(brand);
    expect(BRAND.name).toBe('Connections');
    expect(BRAND.accent).toBe('#ff5500');
    expect(BRAND.logo).toBe('https://img/logo.png');
    expect(PITCH.en.motto).toBe('Grow with us');
    setBrand(null);
    expect(BRAND.name).toBe('SmartVideo GO');
    expect(BRAND.logo).toBeNull();
  });

  it('names the company from the domain, not a descriptive title', () => {
    expect(siteNameOf('South Florida’s Premier Managed IT | Connections for Business', 'https://www.connections.com/')).toBe('Connections for Business');
    expect(siteNameOf('Home', 'https://www.acme-bakery.com/')).toBe('Acme-bakery');
  });

  it('gives films without a site no brand', () => {
    expect(brandFor(plan, null)).toBeUndefined();
  });
});
