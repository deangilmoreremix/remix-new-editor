import { describe, it, expect } from 'vitest';
import { createDefaultTimeline } from '@cinegen/lib/editor/timeline-operations';
import { applyComposition } from '@cinegen/lib/occ/template-composition';
import { buildCompositionFromState } from '../../lib/editor/templateCompositionBuilder.js';

const m = (n: number, d: number) => ({ id: `m${n}`, url: `https://x/${n}.mp4`, duration: d, type: 'video', name: `V${n}` });

describe('Template Generator composition → CineGen timeline', () => {
  it('places consecutive footage, a text overlay and the cut transitions', () => {
    const comp = buildCompositionFromState({ media: [m(1, 8), m(2, 6)], overlays: [{ type: 'caption', name: 'Title', text: 'Hello', startTime: 1, duration: 3 }], transitions: [{ type: 'dissolve', duration: 1 }] }) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    const vids = new Set(r.timeline.tracks.filter((t) => t.kind === 'video').map((t) => t.id));
    const video = r.timeline.clips.filter((c) => vids.has(c.trackId));
    expect(video.map((c) => c.startTime)).toEqual([0, 8]);
    expect(r.assets).toHaveLength(2);
    expect(r.overlays.map((o) => o.type)).toEqual(['overlay-text']);
    expect((r.overlays[0].addon as { text: string }).text).toBe('Hello');
    expect(r.timeline.transitions).toHaveLength(1);
    expect(r.timeline.transitions[0]).toMatchObject({ type: 'dissolve' });
  });
});

describe('wizard overlay kinds', () => {
  it('maps CTA / lead form / lower third / sticker overlays to overlay-lane kinds', () => {
    const comp = buildCompositionFromState({ media: [m(1, 8)], overlays: ['cta', 'lead-form', 'lower-third', 'sticker'].map((type) => ({ type, name: type, duration: 3, startTime: 1 })), transitions: [] }) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    expect(r.overlays.map((o) => o.type).sort()).toEqual(['click-to-call', 'lead-form', 'overlay-lower-third', 'overlay-sticker']);
  });
});
