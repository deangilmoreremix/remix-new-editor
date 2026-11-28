import { describe, it, expect } from 'vitest';
import {
  blankEdit, normalizeEdit, hasRenderableEdits, silencesToCuts, toOutputTime, remapLines, linesToWords, chaptersFromLines,
  newOverlay, newBroll, overlayClip, editProject, personalTracks, isPersonal, lookTransform, STICKERS,
  placeItem, overlapsOf, boxOf, resolveAspect, recipeKey, backgroundKey,
} from '../editTools.js';
import { buildSegments } from '../videoEdit.jsx';
import { contactProfile } from '../draft.js';
import { timelineToComposition } from '../../editor/remotion/timelineToComposition.js';
import fs from 'node:fs';
import path from 'node:path';

const main = { src: 'https://cdn.x/rec.mp4', duration: 20 };
const lines = [
  { startMs: 2000, endMs: 4000, text: 'I made this short video for you.' },
  { startMs: 6000, endMs: 8000, text: 'Here is how it works.' },
  { startMs: 12000, endMs: 14000, text: 'Book a call below.' },
];

describe('the Video Outreach edit recipe', () => {
  it('fills in older drafts and rejects bad values', () => {
    const e = normalizeEdit({ trimStart: 1, cuts: [[2, 3]], look: { rotate: 45, zoom: 9, contrast: 'x' }, transition: 'spin', audio: { music: { src: 'javascript:alert(1)' } } });
    expect(e.trimStart).toBe(1);
    expect(e.cuts).toEqual([[2, 3]]);
    expect(e.look).toMatchObject({ rotate: 0, zoom: 3, contrast: 1, aspect: 'auto' });
    // A recipe saved before "Same as recording" had 16:9 as the default; a new one keeps a chosen 16:9.
    expect(normalizeEdit({ look: { aspect: '9:16' } }).look.aspect).toBe('9:16');
    expect(normalizeEdit({ v: 2, look: { aspect: '16:9' } }).look.aspect).toBe('16:9');
    expect(e.transition).toBe('none');
    expect(e.audio.music).toBeNull();
    expect(hasRenderableEdits(blankEdit(), main)).toBe(false);
    expect(hasRenderableEdits({ ...blankEdit(), look: { ...blankEdit().look, saturation: 1.3 } }, main)).toBe(true);
    // A personal text alone is not burned in, so there is nothing to render.
    expect(hasRenderableEdits({ ...blankEdit(), overlays: [newOverlay('text', { text: 'Hi {{firstname}}' })] }, main)).toBe(false);
  });

  it('remove silences: cuts the long pauses, keeps air around speech and the greeting pause at the start', () => {
    const silences = [{ start: 0, end: 1.8 }, { start: 5, end: 5.4 }, { start: 9, end: 11.5 }, { start: 18.5, end: 20 }];
    expect(silencesToCuts(silences, { keepStart: 2, duration: 20 })).toEqual([[9.15, 11.35], [18.65, 19.85]]);
    expect(silencesToCuts(silences, { duration: 20 })[0]).toEqual([0.15, 1.65]);
  });

  it('maps times through the cuts, so captions and chapters stay in sync', () => {
    const segs = buildSegments({ main, edits: { cuts: [[4.5, 6]] } });
    expect(toOutputTime(3, segs, main.src)).toBe(3);
    expect(toOutputTime(5, segs, main.src)).toBeNull();
    expect(toOutputTime(7, segs, main.src)).toBe(5.5);
    const moved = remapLines(lines, segs, main.src);
    expect(moved.map((l) => [l.startMs, l.endMs])).toEqual([[2000, 4000], [4500, 6500], [10500, 12500]]);
    const words = linesToWords([lines[0]]);
    expect(words.map((w) => w.text.trim())).toEqual(['I', 'made', 'this', 'short', 'video', 'for', 'you.']);
    expect(words[0].startMs).toBe(2000);
    expect(words[words.length - 1].endMs).toBe(4000);
  });

  it('chapters start after a pause once a chapter is long enough', () => {
    const long = [
      { startMs: 0, endMs: 5000, text: 'Hi there, quick intro' },
      { startMs: 5200, endMs: 16000, text: 'more intro' },
      { startMs: 18000, endMs: 30000, text: 'Here is the demo of the product' },
      { startMs: 36000, endMs: 50000, text: 'Pricing and next steps.' },
    ];
    expect(chaptersFromLines(long)).toEqual([
      { startMs: 0, title: 'Hi there, quick intro' },
      { startMs: 18000, title: 'Here is the demo of the' },
      { startMs: 36000, title: 'Pricing and next steps' },
    ]);
    expect(chaptersFromLines(lines.slice(0, 1))).toEqual([]);
  });

  it('builds a project the timeline renderer draws: cuts, colour, rotation, transitions, B-roll, text, logo, sticker, captions, music', () => {
    const edit = {
      ...blankEdit(),
      cuts: [[4.5, 6]],
      look: { ...blankEdit().look, brightness: 0.2, saturation: 1.2, vignette: 0.3, rotate: 90, flipH: true },
      transition: 'fade',
      audio: { volume: 0.8, louder: false, music: { src: 'https://cdn.x/music.mp3', name: 'Upbeat', volume: 0.2, duration: 60 } },
      captions: { burn: true, preset: 'tiktok', position: 'bottom', color: '#FFFFFF', size: 6 },
      overlays: [
        newOverlay('text', { text: 'Save 2 hours a week', start: 1, end: 4 }),
        newOverlay('logo', { src: 'https://cdn.x/logo.png' }),
        newOverlay('sticker', { start: 10, end: 13 }),
        newOverlay('lower', { text: 'Alex Morgan', title: 'Head of Growth' }),
        newOverlay('text', { text: 'Made for {{company}}' }),
      ],
      broll: [newBroll('image', { src: 'https://cdn.x/chart.png', start: 7, end: 9, mode: 'pip' }), newBroll('website', { start: 0, end: 3 })],
    };
    const { project, seconds, aspect } = editProject({ main, edit, lines });
    expect(seconds).toBe(18.5);
    expect(aspect).toBe('16:9'); // no size known for the recording
    const model = timelineToComposition(project, { quality: '720p' });
    const kinds = model.layers.map((l) => l.type || l.kind);
    expect(kinds.filter((k) => k === 'video')).toHaveLength(2);
    expect(kinds).toEqual(expect.arrayContaining(['image', 'overlay-text', 'overlay-image', 'overlay-sticker', 'overlay-lower-third', 'captions']));
    // The personal text is not burned in.
    expect(model.layers.filter((l) => l.type === 'overlay-text')).toHaveLength(1);
    const v = model.layers.find((l) => l.kind === 'video');
    expect(v.effects.map((f) => f.id)).toEqual(['color-correction', 'vignette']);
    expect(v.flip).toEqual({ h: true, v: false });
        expect(v.volume).toBe(0.8);
    expect(v.fit).toBe('contain');
    expect(v.clipTransform).toMatchObject({ rotation: 90 });
    expect(model.transitions).toHaveLength(1);
    expect(model.transitions[0]).toMatchObject({ presentation: 'fade', outgoingId: 'seg-0', incomingId: 'seg-1' });
    expect(model.audio).toEqual([expect.objectContaining({ src: 'https://cdn.x/music.mp3', volume: 0.2 })]);
    const caps = model.layers.find((l) => l.kind === 'captions');
    expect(caps.style).toMatchObject({ preset: 'tiktok', fontSize: 6 });
    expect(caps.captions[0]).toMatchObject({ text: 'I', startMs: 2000 });
    expect(model.layers.find((l) => l.type === 'overlay-sticker').options).toMatchObject({ kind: 'lottie', resolvedSrc: '/assets/sticker/animated-emoji/wave.json' });
    expect(model.layers.find((l) => l.kind === 'image').clipTransform).toMatchObject({ scale: 0.34, x: -30, y: -30 });
    expect(model.durationInSeconds).toBe(18.5);
  });

  it('vertical crops to 9:16 and every built-in sticker exists', () => {
    const { project, aspect } = editProject({ main, edit: { ...blankEdit(), look: { ...blankEdit().look, aspect: '9:16' } } });
    expect(timelineToComposition(project, { quality: '1080p', aspect })).toMatchObject({ width: 1080, height: 1920 });
    expect(timelineToComposition(project, { aspect }).layers[0].fit).toBe('cover');
    expect(lookTransform({ ...blankEdit().look, zoom: 1.5 })).toEqual({ x: 0, y: 0, rotation: 0, scale: 1.5 });
    STICKERS.forEach((s) => expect(fs.existsSync(path.join(process.cwd(), 'public', s.src))).toBe(true));
  });

  it('personal text and their website ride on the campaign, filled in for each prospect', () => {
    const edit = { ...blankEdit(), overlays: [newOverlay('text', { text: 'Made for {{company}}', start: 1, end: 5 }), newOverlay('text', { text: 'Plain' })], broll: [newBroll('website', { start: 2, end: 6, mode: 'pip' })] };
    expect(isPersonal(edit.overlays[0])).toBe(true);
    expect(isPersonal(edit.overlays[1])).toBe(false);
    const tracks = personalTracks(edit, 20, { fallbackShot: 'https://cdn.x/fallback.jpg' });
    expect(tracks.map((t) => t.name)).toEqual(['Their website', 'Personal text']);
    expect(tracks[0].items[0]).toMatchObject({ type: 'image', src: '{{websiteShotUrl}}', fallbackSrc: 'https://cdn.x/fallback.jpg', left: 10, width: 20 });
    const model = timelineToComposition({ timelineSeconds: 20, tracks }, { profile: contactProfile({ id: 'c1', firstName: 'Mike', company: 'Linear', website: 'https://linear.app' }, { 'https://linear.app/': 'https://cdn.x/linear.jpg' }) });
    expect(model.layers.find((l) => l.type === 'overlay-text').options.text).toBe('Made for Linear');
    expect(model.layers.find((l) => l.kind === 'image').src).toBe('https://cdn.x/linear.jpg');
  });

  it('the shape follows the recording: a square recording makes a square video, with the picture filling it', () => {
    expect(resolveAspect('auto', { width: 720, height: 720 })).toBe('1:1');
    expect(resolveAspect('auto', { width: 1920, height: 1080 })).toBe('16:9');
    expect(resolveAspect('auto', {})).toBe('16:9');
    expect(resolveAspect('9:16', { width: 720, height: 720 })).toBe('9:16');
    const { project, aspect } = editProject({ main: { ...main, width: 720, height: 720 }, edit: { ...blankEdit(), look: { ...blankEdit().look, saturation: 1.2 } } });
    expect(aspect).toBe('1:1');
    const model = timelineToComposition(project, { quality: '1080p', aspect });
    expect(model).toMatchObject({ width: 1080, height: 1080 });
    expect(model.layers[0].fit).toBe('contain');
  });

  it('new items go where nothing else is: other text, the website corner, the captions, the player label', () => {
    let edit = { ...blankEdit(), captions: { ...blankEdit().captions, burn: true } };
    const t1 = placeItem(newOverlay('text', { text: 'Save 2 hours a week', start: 0, end: 5 }), edit);
    edit = { ...edit, overlays: [t1] };
    const t2 = placeItem(newOverlay('text', { text: 'Made for {{company}}', start: 1, end: 4 }), edit);
    expect(t2.top).not.toBe(t1.top);
    expect(overlapsOf(t2, { ...edit, overlays: [t1, t2] })).toEqual([]);
    // A text shown at another time can use the same place.
    expect(placeItem(newOverlay('text', { start: 10, end: 12 }), edit).top).toBe(t1.top);
    edit = { ...edit, overlays: [t1, t2] };
    const site = placeItem(newBroll('website', { start: 0, end: 6, mode: 'pip' }), edit);
    edit = { ...edit, broll: [site] };
    const rocket = placeItem(newOverlay('sticker', { start: 0, end: 3 }), edit);
    const all = { ...edit, overlays: [t1, t2, rocket] };
    expect(overlapsOf(site, all)).toEqual([]);
    expect(overlapsOf(rocket, all)).toEqual([]);
    // Nothing sits in the captions band or under the player's label.
    [t1, t2, rocket].forEach((o) => expect(boxOf(o).top + boxOf(o).height).toBeLessThanOrEqual(72));
    // The warning names what an item covers.
    const moved = { ...t2, top: t1.top };
    expect(overlapsOf(moved, { ...all, overlays: [t1, moved] })[0]).toMatch(/the text “Save 2 hours a week”/);
  });

  it('a re-apply renders from the original with the whole recipe; the background pass is reused while it matches', () => {
    const e = { ...blankEdit(), overlays: [newOverlay('text', { text: 'Hi' })] };
    const k1 = recipeKey(e, 'https://cdn.x/rec.mp4');
    expect(recipeKey({ ...e }, 'https://cdn.x/rec.mp4')).toBe(k1);
    expect(recipeKey({ ...e, overlays: [{ ...e.overlays[0], text: 'Hello' }] }, 'https://cdn.x/rec.mp4')).not.toBe(k1);
    // Personal text is not part of the render.
    expect(recipeKey({ ...e, overlays: [...e.overlays, newOverlay('text', { text: '{{company}}' })] }, 'https://cdn.x/rec.mp4')).toBe(k1);
    expect(backgroundKey('u', { mode: 'none' })).toBe('');
    expect(backgroundKey('u', { mode: 'blur', blur: 0.6 })).toBe(backgroundKey('u', { mode: 'blur', blur: 0.6 }));
    expect(hasRenderableEdits({ ...blankEdit(), background: { mode: 'blur' } }, main)).toBe(true);
  });

  it('text starts small and inside a box that fits it', () => {
    const t = newOverlay('text');
    expect(t).toMatchObject({ size: 5, width: 70 });
    expect(overlayClip(t).addon).toMatchObject({ fontSize: 5, fontDecorations: { responsive: true } });
    expect(newOverlay('lower')).toMatchObject({ width: 40, height: 17.8 });
  });
});

describe('portrait 4:5', () => {
  it('is a valid shape that fills a 1080 x 1350 frame', async () => {
    const { normalizeEdit: norm, resolveAspect: res } = await import('../editTools.js');
    const { frameForAspect } = await import('../../editor/remotion/timelineToComposition.js');
    expect(norm({ v: 2, look: { aspect: '4:5' } }).look.aspect).toBe('4:5');
    expect(res('4:5', { width: 1920, height: 1080 })).toBe('4:5');
    expect(frameForAspect('1080p', '4:5')).toEqual({ width: 1080, height: 1350 });
  });
});
