import { describe, expect, it } from 'vitest';
import {
  applyPersonalizationInputsToParams,
  buildPersonalizationContext,
  resolvePersonalizationForModel,
} from '../lib/personalization/studioContext.js';

const profile = {
  personalization: {
    audience: 'client',
    business: {
      audience: 'client',
      businessName: 'Acme Roofing',
      website: 'https://acme.example',
      phone: '555-0100',
      callToAction: 'Book today',
    },
    assets: {
      identities: [{ id: 'p1', role: 'presenter_identity', url: 'https://cdn/presenter.png' }],
      primaryIdentityId: 'p1',
      logos: [{ id: 'l1', role: 'logo', url: 'https://cdn/logo.png' }],
      primaryLogoId: 'l1',
      products: [{ id: 'pr1', role: 'product_reference', url: 'https://cdn/product.png' }],
      brandReferences: [{ id: 'b1', role: 'brand_reference', url: 'https://cdn/brand.png' }],
      firstFrame: { id: 'f1', role: 'first_frame', url: 'https://cdn/first.png' },
      lastFrame: { id: 'f2', role: 'last_frame', url: 'https://cdn/last.png' },
      ctaGraphic: { id: 'cta', role: 'cta_graphic', url: 'https://cdn/cta.png' },
      audio: [],
      savedReferences: [{ id: 's1', role: 'saved_reference', url: 'https://cdn/ref.png' }],
    },
  },
};

describe('studio personalization context', () => {
  it('builds reusable context and keeps exact overlays separate', () => {
    const context = buildPersonalizationContext(profile);
    expect(context.business.businessName).toBe('Acme Roofing');
    expect(context.presenter.url).toBe('https://cdn/presenter.png');
    expect(context.exactOverlays.logo.url).toBe('https://cdn/logo.png');
    expect(context.exactOverlays.ctaGraphic.url).toBe('https://cdn/cta.png');
    expect(context.exactOverlays.phone).toBe('555-0100');
  });

  it('only passes reference classes supported by the selected model', () => {
    const context = buildPersonalizationContext(profile);
    const model = {
      inputs: {
        first_frame_url: { type: 'string' },
        last_frame_url: { type: 'string' },
        reference_images: { type: 'array', maxItems: 3 },
      },
    };
    const resolved = resolvePersonalizationForModel(context, model);
    expect(resolved.firstFrameUrl).toBe('https://cdn/first.png');
    expect(resolved.lastFrameUrl).toBe('https://cdn/last.png');
    expect(resolved.referenceImages).toHaveLength(3);
    expect(resolved.warnings).toEqual([]);
  });

  it('reports unsupported inputs instead of silently sending them', () => {
    const resolved = resolvePersonalizationForModel(buildPersonalizationContext(profile), { inputs: {} });
    expect(resolved.firstFrameUrl).toBeNull();
    expect(resolved.lastFrameUrl).toBeNull();
    expect(resolved.referenceImages).toEqual([]);
    expect(resolved.warnings).toContain('The selected model does not accept a first-frame image.');
    expect(resolved.warnings).toContain('The selected model does not accept a last-frame image.');
    expect(resolved.warnings).toContain('The selected model does not accept image references.');
  });

  it('maps resolved inputs into generation parameters without CTA/logo fabrication', () => {
    const resolved = resolvePersonalizationForModel(
      buildPersonalizationContext(profile),
      { inputs: { image_url: {}, last_frame_url: {}, reference_images: {} } },
    );
    const params = applyPersonalizationInputsToParams({ model: 'x' }, resolved);
    expect(params.image_url).toBe('https://cdn/first.png');
    expect(params.lastFrameUrl).toBe('https://cdn/last.png');
    expect(params.reference_images).toContain('https://cdn/presenter.png');
    expect(params).not.toHaveProperty('cta_graphic');
    expect(params).not.toHaveProperty('logo');
  });
});
