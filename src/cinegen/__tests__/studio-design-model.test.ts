// [remix] The editor preview draws Studio Design clips from the same composition model the published video and MP4 use.
import { describe, it, expect } from 'vitest';
import { studioDesignModel, hasStudioDesign } from '@cinegen/lib/overlays/studio-design-model';

const design = (id: string, start: number, end: number, slots: Record<string, string>) => ({
  id, type: 'overlay-studio-design', name: 'Promo', start, end,
  addon: { designId: 'promo-cta', slots, colors: { primary: '{{brandColor}}' }, media: {}, geometry: { left: 10, top: 10, width: 80, height: 40 } },
});
const text = { id: 't1', type: 'overlay-text', name: 'Hi', start: 0, end: 3, addon: { text: 'Hello' } };

describe('studio design preview model', () => {
  it('is null without a Studio Design clip and ignores other overlays', () => {
    expect(hasStudioDesign([text])).toBe(false);
    expect(studioDesignModel([text as never], null, 20)).toBeNull();
  });

  it('draws only the design clips, filled with the previewed contact', () => {
    const d = design('d1', 2, 6, { headline: 'Hi {{firstName}}' });
    const ann = studioDesignModel([text, d] as never, { id: 'a', variables: { firstName: 'Ann' } }, 20)!;
    const raj = studioDesignModel([d] as never, { id: 'r', variables: { firstName: 'Raj' } }, 20)!;
    expect(ann.layers).toHaveLength(1);
    expect(JSON.stringify(ann.layers)).toContain('Hi Ann');
    expect(JSON.stringify(raj.layers)).toContain('Hi Raj');
    expect(JSON.stringify(raj.layers)).not.toContain('Hi Ann');
    expect(ann.durationInFrames).toBeGreaterThanOrEqual(6 * 30);
  });
});
