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

describe('wizard text overlay reaches the exported composition', () => {
  it('renders as an overlay-text layer carrying its text', async () => {
    await import('../../lib/editor/addons/index.js');
    const { timelineToComposition } = await import('../../lib/editor/remotion/timelineToComposition.js');
    const comp = buildCompositionFromState({ media: [m(1, 8)], overlays: [{ type: 'text', kind: 'text', name: 'Text', duration: 4, startTime: 0, text: 'Your text here' }], transitions: [] }) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    const model = timelineToComposition({ timelineSeconds: 20, tracks: [{ id: 'ov', type: 'text', items: r.overlays }] }, { quality: '720p' }) as { layers: Array<{ type?: string; options?: { text?: string }; o?: { text?: string } }> };
    const layer = model.layers.find((l) => l.type === 'overlay-text');
    expect(layer).toBeTruthy();
    expect(JSON.stringify(layer)).toContain('Your text here');
  });
});

describe('wizard media gets a fileRef (so CineGen\'s media backfill can make thumbnails / filmstrips)', () => {
  it('sets fileRef on assets created from the composition', () => {
    const tl = { id: 't', name: 'T', tracks: [{ id: 'v1', name: 'V1', kind: 'video', color: '#000', muted: false, solo: false, locked: false, visible: true, volume: 1 }], clips: [], duration: 0, transitions: [], markers: [] } as never;
    const out = applyComposition(tl, { tracks: [{ type: 'video', clips: [{ type: 'video', duration: 4, asset: { id: 'a1', type: 'video', name: 'Stock', url: 'https://cdn.example/stock.mp4', duration: 4 } }] }] });
    expect(out.assets[0].fileRef).toBe('https://cdn.example/stock.mp4');
  });
});
