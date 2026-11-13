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

describe('animations picked in the Template Generator', () => {
  const comp = (animations: unknown[]) => buildCompositionFromState({
    media: [m(1, 8), m(2, 6)], overlays: animations, transitions: [],
  }) as never;

  it('a resolved HyperFrames overlay lands on the overlay lane, re-timed to the cut', () => {
    const overlay = { id: 'hf-old', type: 'hyperframes', name: 'Bar Chart Race', start: 0, end: 12, blockId: 'bar-chart-race', props: { title: 'Q4' } };
    const r = applyComposition(createDefaultTimeline('T'), comp([{ kind: 'animation', type: 'animation', trackName: 'Animations', name: 'Bar Chart Race', startTime: 3, duration: 5, animation: { overlay } }]));
    expect(r.overlays).toHaveLength(1);
    expect(r.overlays[0]).toMatchObject({ type: 'hyperframes', blockId: 'bar-chart-race', start: 3, end: 8, props: { title: 'Q4' } });
    expect(r.overlays[0].id).not.toBe('hf-old'); // a fresh id so the same animation can be added twice
  });

  it('an end-screen template is expanded into its overlays at the end of the cut', async () => {
    const { overlayTemplates, isConnectTemplate } = await import('@cinegen/lib/overlays/overlays');
    const end = overlayTemplates().find((t) => t.library === 'endScreens' && !isConnectTemplate(t.id))!;
    const r = applyComposition(createDefaultTimeline('T'), comp([{ kind: 'animation', type: 'animation', name: end.name, startTime: 9, duration: 5, animation: { templateId: end.id } }]));
    expect(r.overlays.length).toBeGreaterThan(0);
    expect(Math.max(...r.overlays.map((o) => o.end))).toBeGreaterThan(9);
  });

  it('an end screen on a short cut appended after long footage never starts before the new cut', async () => {
    const { overlayTemplates, isConnectTemplate } = await import('@cinegen/lib/overlays/overlays');
    const end = overlayTemplates().find((t) => t.library === 'endScreens' && !isConnectTemplate(t.id))!;
    const existing = { ...createDefaultTimeline('T'), duration: 60 };                      // 60 s already on the timeline
    const short = buildCompositionFromState({ media: [m(1, 3)], overlays: [{ kind: 'animation', type: 'animation', name: end.name, startTime: 0, duration: 3, animation: { templateId: end.id } }], transitions: [] }) as never;
    const r = applyComposition(existing, short);
    expect(r.overlays.length).toBeGreaterThan(0);
    for (const o of r.overlays) expect(o.start, o.name).toBeGreaterThanOrEqual(60);        // not over the existing footage
  });

  it('an animation whose library could not resolve it is skipped, not fatal', () => {
    const r = applyComposition(createDefaultTimeline('T'), comp([{ kind: 'animation', type: 'animation', name: 'Gone', startTime: 0, duration: 4, animation: { ref: { id: 'anim:gone', source: 'animations' } } }]));
    expect(r.overlays).toHaveLength(0);
    expect(r.assets).toHaveLength(2);
  });
});

describe('Template Generator sources in this editor', () => {
  it('offers animations, motion graphics and end screens; pages, filters and resolves them', async () => {
    const { buildGeneratorSources } = await import('@cinegen/lib/occ/template-generator-sources');
    const sources = buildGeneratorSources();
    expect(sources.map((s) => s.id)).toEqual(['animations', 'motion', 'endscreens']);

    const anim = sources[0];
    const first = await anim.search({ query: '', filter: 'all', page: 1 });
    expect(first.items.length).toBeGreaterThan(0);
    expect(first.items.every((i) => i.kind === 'animation' && i.id.startsWith('anim:'))).toBe(true);
    const group = anim.filters[1][0];
    const filtered = await anim.search({ query: '', filter: group, page: 1 });
    expect(filtered.items.every((i) => i.category === group)).toBe(true);
    const found = await anim.search({ query: first.items[0].title, filter: 'all', page: 1 });
    expect(found.items.map((i) => i.id)).toContain(first.items[0].id);
    const { overlay } = await anim.resolve(first.items[0]);
    expect(overlay).toMatchObject({ type: 'hyperframes', blockId: first.items[0].id.replace('anim:', '') });

    const end = sources[2];
    const ends = await end.search({ query: '', filter: 'all', page: 1 });
    expect(ends.items.length).toBeGreaterThan(0);
    expect(ends.items.some((i) => i.placeAt === 'end')).toBe(true);
    expect(await end.resolve(ends.items[0])).toEqual({ templateId: ends.items[0].id.replace('tpl:', '') });
  });
});

describe('wizard media gets a fileRef (so CineGen\'s media backfill can make thumbnails / filmstrips)', () => {
  it('sets fileRef on assets created from the composition', () => {
    const tl = { id: 't', name: 'T', tracks: [{ id: 'v1', name: 'V1', kind: 'video', color: '#000', muted: false, solo: false, locked: false, visible: true, volume: 1 }], clips: [], duration: 0, transitions: [], markers: [] } as never;
    const out = applyComposition(tl, { tracks: [{ type: 'video', clips: [{ type: 'video', duration: 4, asset: { id: 'a1', type: 'video', name: 'Stock', url: 'https://cdn.example/stock.mp4', duration: 4 } }] }] });
    expect(out.assets[0].fileRef).toBe('https://cdn.example/stock.mp4');
  });
});
