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

describe('real transitions and lower-third styles', () => {
  it('keeps a picked GL transition (glType); an unknown one stays a plain dissolve', () => {
    const run = (type: string) => applyComposition(createDefaultTimeline('T'), buildCompositionFromState({ media: [m(1, 8), m(2, 6)], overlays: [], transitions: [{ type, duration: 1 }] }) as never).timeline.transitions[0];
    expect(run('whip-pan')).toMatchObject({ type: 'dissolve', glType: 'whip-pan' });
    expect(run('page-curl')).toMatchObject({ type: 'dissolve', glType: 'page-curl' });
    expect((run('not-a-real-one') as { glType?: string }).glType).toBeUndefined();
  });

  it('places a styled lower third with the chosen template, name and title', () => {
    const comp = buildCompositionFromState({ media: [m(1, 8)], overlays: [{ kind: 'overlay', type: 'lower-third', name: 'Lower third', text: 'Jane Doe | Owner', startTime: 1, duration: 4, lowerThird: { template: 'news', name: 'Jane Doe', title: 'Owner' } }], transitions: [] }) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    expect(r.overlays).toHaveLength(1);
    expect(r.overlays[0].type).toBe('overlay-lower-third');
    expect(r.overlays[0].addon).toMatchObject({ template: 'news', name: 'Jane Doe', title: 'Owner' });
  });

  it('offers every GL transition, in categories, with a real label and a preview', async () => {
    const { generatorTransitions } = await import('@cinegen/lib/occ/template-generator-sources');
    const { GL_TRANSITION_ORDER } = await import('@cinegen/lib/occ/transitions');
    const list = generatorTransitions();
    expect(list.map((t) => t.id)).toEqual([...GL_TRANSITION_ORDER]);
    expect([...new Set(list.map((t) => t.category))].sort()).toEqual(['fade', 'motion', 'wipe']);
    for (const t of list) { expect(t.label, t.id).toBeTruthy(); expect(t.description, t.id).toBeTruthy(); expect(typeof t.mountPreview).toBe('function'); expect(typeof t.thumb).toBe('function'); }
  });
});

describe('text looks reach the timeline', () => {
  it('a styled wizard text becomes a Smart Text overlay with that font, colour, box and entrance', () => {
    const style = { fontFamily: 'Poppins', fontColor: '#22D3EE', stroke: true, geometry: { left: 10, top: 20, width: 70, height: 18 }, animation: { in: 'fadeInUp', idle: null, out: null } };
    const comp = buildCompositionFromState({ media: [m(1, 8)], overlays: [{ kind: 'text', type: 'text', name: 'Title', text: 'Summer Sale', startTime: 0, duration: 3, textStyle: style }], transitions: [] }) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    expect(r.overlays).toHaveLength(1);
    expect(r.overlays[0].addon).toMatchObject({ text: 'Summer Sale', fontFamily: 'Poppins', fontColor: '#22D3EE', stroke: true, geometry: { left: 10, top: 20, width: 70, height: 18 }, animation: { in: 'fadeInUp' } });
  });
});

describe('voice and music reach the timeline with the mix', () => {
  it('music is placed for the cut (not its 113 s file) with the volume curve as editor keyframes; voice keeps its length and volume', () => {
    const comp = buildCompositionFromState({
      media: [], mediaByScene: [{ sceneName: 'A', sceneIndex: 0, media: { id: 'm1', type: 'video', url: 'https://x/1.mp4', duration: 8, name: 'V1' }, mediaType: 'video', status: 'ready' }],
      overlays: [], transitions: [], footageVolume: 0.8,
      voice: { enabled: true, volume: 0.9, generatedAsset: { id: 'voice1', type: 'audio', url: 'https://cdn/v.mp3', duration: 6, name: 'Voice' }, text: 'Hi' },
      music: { url: '/motion-studio/bgmlib/tonight-hiphop.mp3', name: 'Tonight', trackId: 'tonight-hiphop', start: 0, duration: 8, sourceDuration: 113, volume: 0.3, keyframes: [{ t: 0, v: 0 }, { t: 1, v: 0.3 }, { t: 8, v: 0 }] },
    } as never) as never;
    const r = applyComposition(createDefaultTimeline('T'), comp);
    const audioTrackIds = new Set(r.timeline.tracks.filter((t) => t.kind === 'audio').map((t) => t.id));
    const audio = r.timeline.clips.filter((c) => audioTrackIds.has(c.trackId));
    const music = audio.find((c) => (r.assets.find((a) => a.id === c.assetId)?.name ?? '') === 'Tonight')!;
    const voice = audio.find((c) => c.assetId === 'voice1')!;
    expect(music.duration).toBe(8);
    expect(music.keyframes).toEqual([{ time: 0, property: 'volume', value: 0 }, { time: 1, property: 'volume', value: 0.3 }, { time: 8, property: 'volume', value: 0 }]);
    expect(voice.duration).toBe(6); expect(voice.volume).toBe(0.9);
    const video = r.timeline.clips.find((c) => !audioTrackIds.has(c.trackId))!;
    expect(video.volume).toBe(0.8);
    expect(r.timeline.clips.filter((c) => c.assetId === video.assetId).every((c) => c.volume === 0.8)).toBe(true);   // and its linked sound clip
  });
});

describe('export arguments for a template rendered on its own', () => {
  it('builds clips (footage + music with a full address), styled text overlays and GL transitions', async () => {
    const { buildExportArgs } = await import('@cinegen/lib/occ/export-args');
    const comp = buildCompositionFromState({
      media: [], mediaByScene: [1, 2].map((n) => ({ sceneName: `S${n}`, sceneIndex: n - 1, media: { id: `m${n}`, type: 'video', url: `https://x/${n}.mp4`, duration: 6, name: `V${n}` }, mediaType: 'video', status: 'ready' })),
      overlays: [{ kind: 'text', type: 'text', name: 'Title', text: 'Summer Sale', startTime: 0, duration: 3, textStyle: { fontFamily: 'Poppins', fontColor: '#22D3EE' } }],
      transitions: [{ type: 'whip-pan', duration: 1 }],
      music: { url: '/motion-studio/bgmlib/cat-walk.mp3', name: 'Cat Walk', trackId: 'cat-walk', start: 0, duration: 12, sourceDuration: 124, volume: 0.3, keyframes: [{ t: 0, v: 0 }, { t: 1, v: 0.3 }, { t: 12, v: 0 }] },
    } as never) as never;
    const applied = applyComposition(createDefaultTimeline('T'), comp);
    const args = buildExportArgs(applied.timeline, applied.assets, applied.overlays, { preset: 'standard', fps: 30 });
    expect(args.clips.filter((c) => c.type === 'video' && c.trackKind === 'video')).toHaveLength(2);   // each video also has its own sound clip
    const music = args.clips.find((c) => c.type === 'audio')!;
    expect(music.inputPath).toBe(`${location.origin}/motion-studio/bgmlib/cat-walk.mp3`);   // the export frame has no origin of its own
    expect(music.duration).toBe(12);
    expect(music.kf?.length).toBe(3);
    expect(args.totalDuration).toBe(12);
    expect(args.overlays.map((o) => (o.addon as { text?: string; fontFamily?: string })?.text)).toContain('Summer Sale');
    expect((args.overlays[0].addon as { fontFamily: string }).fontFamily).toBe('Poppins');
    expect(args.transitions).toEqual([expect.objectContaining({ glType: 'whip-pan' })]);
    expect(args.mgOverlays).toEqual([]); expect(args.hfOverlays).toEqual([]);
  });
});

describe('Connect forms get the business\'s own number', () => {
  it('a picked Connect form is placed with the number in its call button; without a number the template stays as authored', () => {
    const mk = (call?: { phone: string; country?: string }) => buildCompositionFromState({
      media: [], mediaByScene: [{ sceneName: 'A', sceneIndex: 0, media: { id: 'm1', type: 'video', url: 'https://x/1.mp4', duration: 8, name: 'V1' }, mediaType: 'video', status: 'ready' }],
      overlays: [{ kind: 'animation', type: 'animation', trackName: 'Animations', name: 'Call now', startTime: 1, duration: 6, animation: { templateId: 'cf-call-now', ...(call ? { call } : {}) } }], transitions: [],
    } as never) as never;
    const withNumber = applyComposition(createDefaultTimeline('T'), mk({ phone: '555 010 7777', country: '1' }));
    const calls = withNumber.overlays.filter((o) => o.type === 'click-to-call');
    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(withNumber.overlays)).toContain('555 010 7777');
    expect(JSON.stringify(applyComposition(createDefaultTimeline('T'), mk()).overlays)).not.toContain('555 010 7777');
  });
});

describe('word-timed caption track', () => {
  const track = { template: 'capite-hormozi', motionPreset: 'word-pop', pacing: 'phrase' as const, words: [{ text: 'Hello', start: 0, end: 400 }, { text: 'world', start: 450, end: 900 }] };
  const base = () => ({ ...(buildCompositionFromState({ media: [m(1, 8), m(2, 6)], overlays: [], transitions: [] }) as object), captionTrack: track }) as never;

  it('rides on the first footage clip as the editor\'s own captions (look, motion, words)', () => {
    const r = applyComposition(createDefaultTimeline('T'), base());
    const first = r.timeline.clips.find((c) => r.clipIds[0] === c.id)!;
    expect(first.captions).toMatchObject({ enabled: true, template: 'capite-hormozi', motionPreset: 'word-pop', pacing: 'phrase' });
    expect(first.captions!.words!.map((w) => [w.text, w.start, w.end])).toEqual([['Hello', 0, 400], ['world', 450, 900]]);
    expect(r.timeline.clips.filter((c) => c.captions)).toHaveLength(1);
  });

  it('shifts the words to where the cut starts when the timeline already has content', () => {
    const r1 = applyComposition(createDefaultTimeline('T'), base());
    const r2 = applyComposition(r1.timeline, base());
    const second = r2.timeline.clips.find((c) => c.id === r2.clipIds[0])!;
    expect(second.captions!.words![0].start).toBe(Math.round(r1.timeline.duration * 1000));
  });

  it('adds nothing without a track, or with no words', () => {
    const none = applyComposition(createDefaultTimeline('T'), buildCompositionFromState({ media: [m(1, 8)], overlays: [], transitions: [] }) as never);
    expect(none.timeline.clips.some((c) => c.captions)).toBe(false);
    const empty = applyComposition(createDefaultTimeline('T'), { ...(buildCompositionFromState({ media: [m(1, 8)], overlays: [], transitions: [] }) as object), captionTrack: { ...track, words: [] } } as never);
    expect(empty.timeline.clips.some((c) => c.captions)).toBe(false);
  });
});
