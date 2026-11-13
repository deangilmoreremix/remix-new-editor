// [remix] CineGen's SAM 3 nodes (segment, track, local segment) are in the Spaces registry; they run on this device and are interactive-only.
import { describe, it, expect } from 'vitest';
import { getModelDefinition, ALL_MODELS } from '../lib/fal/models';

describe('SAM 3 nodes in the Spaces registry', () => {
  it('has the three CineGen nodes with their ports', () => {
    const seg = getModelDefinition('sam3-segment-cloud');
    expect(seg?.name).toBe('SAM 3 Segment (Cloud)');
    expect(seg?.inputs.map((i) => i.id)).toEqual(['image_url', 'prompt', 'apply_mask', 'return_multiple_masks', 'max_masks']);
    expect(getModelDefinition('sam3-track-cloud')?.outputType).toBe('video');
    expect(getModelDefinition('sam3-segment')?.inputs[0].id).toBe('image_url');
  });
  it('runs locally (no key) and keeps the MuAPI models', () => {
    expect(getModelDefinition('sam3-segment-cloud')?.provider).toBe('local');
    expect(Object.keys(ALL_MODELS).length).toBeGreaterThan(500);
  });
});
