import { describe, it, expect } from 'vitest';
import { buildCompositionFromState } from '../templateCompositionBuilder.js';
import { resolveOverlayText } from '../addons/overlayRender.js';

const media = (n, d) => ({ id: `m${n}`, url: `https://x/${n}.mp4`, duration: d, type: 'video', name: `V${n}` });

describe('Template Generator assembly', () => {
  it('places videos back to back and centres a transition overlay on each cut (not after the last clip)', () => {
    const c = buildCompositionFromState({ media: [media(1, 8), media(2, 6), media(3, 5)], overlays: [{ placement: 'boundary', type: 'overlay', name: 'Swoosh', duration: 2 }], transitions: [] });
    const clips = c.tracks.find((t) => t.name === 'User Media').clips;
    expect(clips.map((x) => x.startTime)).toEqual([0, 8, 14]);
    const tr = c.tracks.find((t) => t.name === 'Transitions');
    expect(tr.clips.map((x) => x.startTime)).toEqual([7, 13]);
    expect(tr.clips.every((x) => x.duration === 2)).toBe(true);
  });
});

describe('token modifiers keep the original aliases', () => {
  it('supports up/uppercase and d/default with fallback', () => {
    const profile = { variables: { firstname: 'ann' } };
    expect(resolveOverlayText('Hi {{uppercase firstname}}', profile)).toBe('Hi ANN');
    expect(resolveOverlayText('Hi {{default lastname "Friend"}}', profile)).toBe('Hi Friend');
  });
});
