import { describe, it, expect } from 'vitest';
import { getContinuationTargetsForEntry } from '../lib/videoToolCapabilities.js';

describe('getContinuationTargetsForEntry', () => {
  it('offers Seedance extends for a Seedance generation', () => {
    const targets = getContinuationTargetsForEntry({ id: '1234567-abc', url: 'https://cdn.example.com/a.mp4', model: 'seedance-v2.0-t2v' });
    expect(targets).toContain('seedance-v2.0-extend');
  });

  it('offers Grok extend for a Grok generation and nothing for unrelated models', () => {
    expect(getContinuationTargetsForEntry({ id: 'req-grok-1', url: 'https://cdn.example.com/g.mp4', model: 'grok-imagine-text-to-video' })).toContain('grok-imagine-extend');
    expect(getContinuationTargetsForEntry({ id: 'req-1', url: 'https://cdn.example.com/x.mp4', model: 'kling-v2.6-pro-t2v' })).toEqual([]);
  });

  it('only offers Veo extend when the source is 720p', () => {
    const base = { id: 'req-veo-1', url: 'https://cdn.example.com/v.mp4', model: 'veo3.1-text-to-video' };
    expect(getContinuationTargetsForEntry({ ...base, resolution: '720p' })).toContain('veo3.1-extend-video');
    expect(getContinuationTargetsForEntry({ ...base, resolution: '1080p' })).not.toContain('veo3.1-extend-video');
    expect(getContinuationTargetsForEntry(base)).toContain('veo3.1-4k-video');
  });
});
