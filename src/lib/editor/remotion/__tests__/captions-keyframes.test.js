import { describe, it, expect, vi } from 'vitest';
import {
  chunksToCaptions, captionsFromFile, captionsToSrt, captionsToVtt, splitCaption, mergeCaptions, shiftCaptions,
  captionPages, pageAt, defaultCaptionStyle, sortCaptions,
} from '../captions.js';
import {
  valueAt, setKeyframe, removeKeyframe, updateKeyframe, transformStyleAt, effectOverridesAt, keyframeTimes, canonicalProperty,
} from '../keyframes.js';
import { keyframeTargets, renderKeyframesPanel } from '../keyframesPanel.js';
import { renderCaptionsPanel } from '../captionsPanel.js';
import { timelineToComposition } from '../timelineToComposition.js';
import { buildEffectDescriptors, loadEffects, createEffect } from '../effects.js';

const SRT = `1
00:00:00,500 --> 00:00:02,000
Hello there

2
00:00:02,500 --> 00:00:04,000
General Kenobi
`;

describe('captions', () => {
  it('turns word chunks into Remotion captions with leading spaces', () => {
    const caps = chunksToCaptions([{ text: ' Hello', timestamp: [1, 1.4] }, { text: 'world', timestamp: [1.5, 2] }, { text: '', timestamp: [2, 3] }], { offsetSec: 1 });
    expect(caps).toEqual([
      expect.objectContaining({ text: 'Hello', startMs: 0, endMs: 400 }),
      expect.objectContaining({ text: ' world', startMs: 500, endMs: 1000 }),
    ]);
  });

  it('round-trips SRT and writes VTT', () => {
    const caps = captionsFromFile(SRT, 'a.srt');
    expect(caps.map((c) => [c.text, c.startMs, c.endMs])).toEqual([['Hello there', 500, 2000], ['General Kenobi', 2500, 4000]]);
    const again = captionsFromFile(captionsToSrt(caps), 'b.srt');
    expect(again.map((c) => [c.text.trim(), c.startMs, c.endMs])).toEqual([['Hello there', 500, 2000], ['General Kenobi', 2500, 4000]]);
    const vtt = captionsToVtt(caps);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.500 --> 00:00:02.000\nHello there');
    expect(captionsFromFile(vtt, 'c.vtt').map((c) => c.text.trim())).toEqual(['Hello there', 'General Kenobi']);
  });

  it('splits, merges and shifts', () => {
    const caps = captionsFromFile(SRT, 'a.srt');
    const split = splitCaption(caps, 0);
    expect(split.map((c) => c.text.trim())).toEqual(['Hello', 'there', 'General Kenobi']);
    expect(split[0].endMs).toBe(split[1].startMs);
    const merged = mergeCaptions(split, 0);
    expect(merged[0].text.trim()).toBe('Hello there');
    expect(shiftCaptions(caps, -1000).map((c) => c.startMs)).toEqual([0, 1500]);
  });

  it('pages: sentence captions one page each, words grouped', () => {
    const sentences = captionPages(captionsFromFile(SRT, 'a.srt'), defaultCaptionStyle('classic'));
    expect(sentences.map((p) => p.text)).toEqual(['Hello there', 'General Kenobi']);
    expect(pageAt(sentences, 1000).text).toBe('Hello there');
    expect(pageAt(sentences, 100)).toBeNull();
    const words = chunksToCaptions([{ text: 'one', timestamp: [0, 0.3] }, { text: 'two', timestamp: [0.3, 0.6] }, { text: 'three', timestamp: [2, 2.3] }]);
    const pages = captionPages(words, { combineMs: 800 });
    expect(pages[0].tokens.length).toBeGreaterThanOrEqual(2);
    expect(pageAt(pages, 5000)).toBeNull(); // hidden after the last word
  });

  it('feeds captions into the composition with style defaults and fonts', () => {
    const state = { timelineSeconds: 10, tracks: [{ id: 't', type: 'text', items: [{ id: 'c1', type: 'captions', left: 10, width: 50, captions: sortCaptions(captionsFromFile(SRT, 'a.srt')), captionStyle: { preset: 'box', fontFamily: 'Poppins' } }] }] };
    const m = timelineToComposition(state, { fps: 30, quality: '720p' });
    expect(m.layers[0]).toMatchObject({ kind: 'captions', from: 30, durationInFrames: 150, style: { preset: 'box', fontFamily: 'Poppins', combineMs: 1200 } });
    expect(m.fonts).toContain('Poppins');
  });
});

describe('keyframes', () => {
  it('interpolates with easing and holds outside the range', () => {
    let kf = setKeyframe({}, 'x', 0, 0, 'linear');
    kf = setKeyframe(kf, 'x', 2, 50);
    expect(valueAt(kf.x, -1, 9)).toBe(0);
    expect(valueAt(kf.x, 1, 9)).toBeCloseTo(25);
    expect(valueAt(kf.x, 5, 9)).toBe(50);
    expect(valueAt(undefined, 1, 9)).toBe(9);
    kf = updateKeyframe(kf, 'x', 0, { easing: 'hold' });
    expect(valueAt(kf.x, 1.9, 0)).toBe(0);
    kf = setKeyframe(kf, 'x', 2, 80); // replaces at the same time
    expect(kf.x).toHaveLength(2);
    expect(removeKeyframe(kf, 'x', 0).x).toHaveLength(1);
    expect(removeKeyframe(removeKeyframe(kf, 'x', 0), 'x', 0).x).toBeUndefined();
    expect(canonicalProperty('position-x')).toBe('x');
  });

  it('builds a transform and effect overrides', () => {
    let kf = setKeyframe({}, 'scale', 0, 1);
    kf = setKeyframe(kf, 'scale', 1, 2);
    kf = setKeyframe(kf, 'opacity', 0, 0.5);
    kf = setKeyframe(kf, 'fx:fx-1:radius', 0, 0);
    kf = setKeyframe(kf, 'fx:fx-1:radius', 1, 20);
    const st = transformStyleAt(kf, 0.5, '10% 20%');
    expect(st.transform).toBe('scale(1.5)');
    expect(st).toMatchObject({ opacity: 0.5, transformOrigin: '10% 20%' });
    expect(effectOverridesAt(kf, 0.5)).toEqual({ 'fx-1:radius': 10 });
    expect(keyframeTimes(kf)).toEqual([0, 1]);
    expect(transformStyleAt({}, 1)).toBeNull();
  });

  it('applies keyframed effect params to descriptors', async () => {
    await loadEffects(['blur']);
    const fx = createEffect('blur', { radius: 4 });
    expect(buildEffectDescriptors([fx], { [`${fx.uid}:radius`]: 30 })).toHaveLength(1);
  });

  it('keyframes panel adds a keyframe at the playhead and lists effect params', () => {
    const fx = createEffect('blur');
    const clip = { type: 'video', effects: [fx] };
    expect(keyframeTargets(clip).map((t) => t.key)).toEqual(expect.arrayContaining(['x', 'volume', `fx:${fx.uid}:radius`]));
    expect(keyframeTargets({ type: 'image' }).some((t) => t.key === 'volume')).toBe(false);
    const box = document.createElement('div');
    const onChange = vi.fn();
    renderKeyframesPanel(box, { clip, getTime: () => 1.5, duration: 5, onChange });
    const prop = box.querySelector('[data-kf-prop]');
    prop.value = 'opacity';
    prop.dispatchEvent(new Event('change', { bubbles: true }));
    const num = box.querySelector('[data-kf-num]');
    num.value = '0.25';
    num.dispatchEvent(new Event('input', { bubbles: true }));
    box.querySelector('[data-kf-add]').click();
    expect(onChange.mock.calls.at(-1)[0]).toEqual({ opacity: [{ t: 1.5, v: 0.25, easing: 'ease-in-out' }] });
    box.querySelector('[data-kf-del="opacity|0"]').click();
    expect(onChange.mock.calls.at(-1)[0]).toEqual({});
  });
});

describe('captions panel', () => {
  it('imports, edits, splits and transcribes', async () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    const onTranscribe = vi.fn(async () => chunksToCaptions([{ text: 'Hi', timestamp: [0, 0.5] }]));
    const p = renderCaptionsPanel(box, { captions: captionsFromFile(SRT, 'a.srt'), sources: [{ id: 'v1', label: 'Clip' }], onChange, onTranscribe, currentMs: () => 6000 });
    const text = box.querySelector('[data-cap-text="1"]');
    text.value = 'Hello Kenobi';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].captions[1].text).toBe(' Hello Kenobi');
    box.querySelector('[data-cap-split="0"]').click();
    expect(p.captions).toHaveLength(3);
    box.querySelector('[data-cap-add]').click();
    expect(p.captions.at(-1)).toMatchObject({ startMs: 6000, endMs: 8000 });
    box.querySelector('[data-cap-preset="karaoke"]').click();
    expect(onChange.mock.calls.at(-1)[0].captionStyle).toMatchObject({ preset: 'karaoke', fontFamily: 'Anton' });
    box.querySelector('[data-cap-transcribe]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(onTranscribe).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'v1', language: 'auto' }));
    expect(p.captions).toEqual([expect.objectContaining({ text: 'Hi', startMs: 0, endMs: 500 })]);
  });
});
