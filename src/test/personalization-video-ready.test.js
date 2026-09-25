import { describe, expect, it } from 'vitest';
import { selectVideoReadySteps } from '../lib/personalization/videoReady.js';

describe('Video Ready operation selection', () => {
  it('combines safe Vision recommendations with the asset recipe', () => {
    const steps = selectVideoReadySteps({
      category: 'product',
      role: 'product_reference',
      visionAnalysis: {
        recommendedOperations: ['cleanup', 'product_lifestyle', 'enhance'],
      },
    });

    expect(steps).toContain('cleanup');
    expect(steps).toContain('enhance');
    expect(steps).toContain('product_isolate');
    expect(steps).not.toContain('product_lifestyle');
    expect(steps.length).toBeLessThanOrEqual(4);
  });

  it('removes destructive creative Vision operations', () => {
    const steps = selectVideoReadySteps({
      category: 'person',
      role: 'presenter_identity',
      visionAnalysis: {
        recommendedOperations: ['change_clothing', 'change_environment', 'portrait_enhance'],
      },
    });

    expect(steps).toContain('portrait_enhance');
    expect(steps).not.toContain('change_clothing');
    expect(steps).not.toContain('change_environment');
  });

  it('uses destination roles for first/last/CTA recipes', () => {
    const first = selectVideoReadySteps({ category: 'storefront', role: 'first_frame' });
    const last = selectVideoReadySteps({ category: 'brand', role: 'last_frame' });
    const cta = selectVideoReadySteps({ category: 'brand', role: 'cta_graphic' });

    expect(first).toContain('opening_frame');
    expect(last).toContain('end_card');
    expect(cta).toContain('cta_prep');
  });
});
