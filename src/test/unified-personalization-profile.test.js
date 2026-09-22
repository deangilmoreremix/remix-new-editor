import { describe, expect, it } from 'vitest';
import {
  createPersonalizationAsset,
  ensurePersonalizationProfile,
  getAllPersonalizationAssets,
  normalizeBusinessProfile,
  updatePersonalizationBusiness,
} from '../lib/personalization/personalizationProfile.js';
import { buildVariables, resolveToken } from '../components/personalize/tokenSchema.js';

describe('unified personalization profile', () => {
  it('derives business defaults from the existing RNE contact profile', () => {
    const business = normalizeBusinessProfile({}, {
      contact: { name: 'Dean', company: 'VideoRemix', email: 'd@example.com', location: 'Florida' },
      company: { name: 'VideoRemix', industry: 'Video', summary: 'Video creation' },
      website: { url: 'https://example.com' },
      intelligence: { products: ['SmartVideo'] },
    });

    expect(business.businessName).toBe('VideoRemix');
    expect(business.website).toBe('https://example.com');
    expect(business.productService).toBe('SmartVideo');
  });

  it('adds personalization without mutating legacy profile shapes', () => {
    const base = {
      id: 'p1',
      contact: { name: 'Jane', company: 'Acme' },
      company: { name: 'Acme' },
      intelligence: {},
    };
    const next = ensurePersonalizationProfile(base);
    expect(next.contact).toEqual(base.contact);
    expect(next.company).toEqual(base.company);
    expect(next.personalization.business.businessName).toBe('Acme');
  });

  it('updates business fields and exposes them as tokens', () => {
    const base = ensurePersonalizationProfile({
      id: 'p1',
      contact: { name: 'Jane', company: 'Acme' },
      company: { name: 'Acme' },
      intelligence: {},
    });
    const next = updatePersonalizationBusiness(base, {
      audience: 'client',
      offer: 'Free inspection',
      callToAction: 'Book today',
      phone: '555-0100',
      productService: 'Roofing',
    });
    next.variables = buildVariables(next);

    expect(resolveToken(next, 'offer')).toBe('Free inspection');
    expect(resolveToken(next, 'cta')).toBe('Book today');
    expect(resolveToken(next, 'businessPhone')).toBe('555-0100');
    expect(resolveToken(next, 'productService')).toBe('Roofing');
  });

  it('keeps originals when creating editable assets', () => {
    const asset = createPersonalizationAsset({
      role: 'logo',
      name: 'Primary logo',
      url: 'https://cdn.example.com/logo.png',
    });
    expect(asset.originalUrl).toBe(asset.url);
    expect(asset.edited).toBe(false);
    expect(asset.versions[0].type).toBe('original');
  });

  it('flattens every role-aware asset collection', () => {
    const logo = createPersonalizationAsset({ role: 'logo', url: 'https://x/logo.png' });
    const frame = createPersonalizationAsset({ role: 'first_frame', url: 'https://x/frame.png' });
    const profile = ensurePersonalizationProfile({});
    profile.personalization.assets.logos = [logo];
    profile.personalization.assets.firstFrame = frame;
    expect(getAllPersonalizationAssets(profile)).toHaveLength(2);
  });
});
