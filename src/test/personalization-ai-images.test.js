import { describe, expect, it } from 'vitest';
import {
  AI_FILLABLE,
  aiImagePrompt,
  describeUnreviewed,
  markAiGenerated,
  needsReview,
  planAiImages,
  unreviewedAiImages,
} from '../lib/personalization/aiContactImages.js';

const acme = {
  id: 'c_acme', name: 'Ann',
  personalization: {
    business: { businessName: 'Acme Roofing', industry: 'roofing', productService: 'roof repair', location: 'Austin, TX' },
    assets: { logos: [{ id: 'l1', url: 'https://cdn/logo.png' }] },
  },
  variables: {},
};
const bare = { id: 'c_bare', name: 'Bo', personalization: { assets: {} }, variables: {} };
const reviewed = {
  id: 'c_rev', name: 'Cy',
  personalization: {
    business: { businessName: 'Cy Plumbing' },
    assets: { products: [markAiGenerated({ id: 'p1', role: 'product_reference', url: 'https://cdn/p.jpg' }, { prompt: 'x' })] },
  },
  variables: {},
};

describe('what AI may fill', () => {
  it('never generates logos, people or CTA graphics', () => {
    expect(Object.keys(AI_FILLABLE)).toEqual(['productImageUrl', 'brandImageUrl', 'firstFrameUrl', 'lastFrameUrl']);
    expect(aiImagePrompt('logoUrl', acme)).toBeNull();
    expect(aiImagePrompt('avatarUrl', acme)).toBeNull();
    expect(aiImagePrompt('ctaImageUrl', acme)).toBeNull();
  });
});

describe('aiImagePrompt', () => {
  it('builds a prompt from the business details, asking for no text', () => {
    const prompt = aiImagePrompt('productImageUrl', acme);
    expect(prompt).toContain('roof repair');
    expect(prompt).toContain('"Acme Roofing"');
    expect(prompt).toContain('in Austin, TX');
    expect(prompt).toMatch(/No text/);
  });

  it('refuses without enough business detail', () => {
    expect(aiImagePrompt('productImageUrl', bare)).toBeNull();
  });
});

describe('planAiImages', () => {
  it('plans jobs only for missing, fillable images the video uses', () => {
    const { jobs, skipped } = planAiImages(['logoUrl', 'productImageUrl', 'firstFrameUrl'], [acme, bare, reviewed]);
    expect(jobs.map((j) => `${j.contactName}:${j.key}`)).toEqual([
      'Ann:productImageUrl', 'Ann:firstFrameUrl', 'Cy:firstFrameUrl',
    ]);
    expect(jobs[0]).toMatchObject({ role: 'product_reference', aspectRatio: '1:1' });
    expect(skipped.map((s) => `${s.contactName}:${s.label}`)).toEqual(['Bo:product image', 'Bo:opening frame']);
  });
});

describe('review', () => {
  it('flags generated images until approved', () => {
    expect(needsReview(reviewed, 'productImageUrl')).toBe(true);
    expect(needsReview(acme, 'productImageUrl')).toBe(false);
    const list = unreviewedAiImages(['productImageUrl'], [acme, reviewed]);
    expect(list).toEqual([{ contactName: 'Cy', label: 'product image' }]);
    expect(describeUnreviewed(list)[0]).toMatch(/^1 AI-made image hasn't been reviewed \(Cy\)/);
  });

  it('says nothing when everything is reviewed', () => {
    expect(describeUnreviewed([])).toEqual([]);
  });
});
