// [remix] Studio designs can be added from the Elements / Add window and start with a design already chosen.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../features/personalization/shared/personalization/templates/index', () => ({
  getRemotionDesignTemplate: (id: string) => (id === 'promo-cta'
    ? { id, name: 'Promo CTA', textSlots: [{ key: 'headline', field: 'headline', primary: true }, { key: 'cta', field: 'cta' }], placement: 'overlay' }
    : undefined),
}));

import { OVERLAY_KINDS, createStudioDesignOverlay, normalizeOverlays, isRegistryOverlay } from '@cinegen/lib/overlays/overlays';

describe('Studio Design overlay in the CineGen editor', () => {
  it('is offered with the other overlays and survives saving and loading', () => {
    expect(OVERLAY_KINDS.map((k) => k.kind)).toContain('overlay-studio-design');
    expect(isRegistryOverlay('overlay-studio-design')).toBe(true);
    const made = [{ id: 'o1', type: 'overlay-studio-design', name: 'x', start: 1, end: 4 }];
    expect(normalizeOverlays(made)).toHaveLength(1);
  });

  it('starts with a design chosen and its text and colours set to the contact\'s details', async () => {
    const o = await createStudioDesignOverlay(2, 20) as unknown as { type: string; name: string; start: number; addon: { designId: string; slots: Record<string, string>; colors: Record<string, string> } };
    expect(o.type).toBe('overlay-studio-design');
    expect(o.name).toBe('Promo CTA');
    expect(o.start).toBe(2);
    expect(o.addon.designId).toBe('promo-cta');
    expect(o.addon.slots.headline).toBe('{{ctaHeadline}}');
    expect(o.addon.slots.cta).toBe('{{callToAction}}');
    expect(o.addon.colors.primary).toBe('{{brandColor}}');
  });

  it('still adds a usable clip when the design catalogue is not available', async () => {
    const o = await createStudioDesignOverlay(0, 10, 'does-not-exist') as unknown as { type: string; addon: { designId: string } };
    expect(o.type).toBe('overlay-studio-design');
    expect(o.addon.designId).toBe('');
  });
});
