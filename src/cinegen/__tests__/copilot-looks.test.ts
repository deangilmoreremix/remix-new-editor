// [remix] Assistant access to the OpenChatCut tools (effects, LUTs, zoom, transitions, scene split, captions).
import { describe, it, expect } from 'vitest';
import { applyTimelineEditOps } from '@cinegen/lib/llm/copilot-timeline-ops';
import { parseSkillActionFromContent } from '@cinegen/lib/llm/skill-actions';
import { COPILOT_ACTIONS_GUIDE } from '@cinegen/lib/llm/copilot-actions-guide';
import { resolveEffect, resolveLut, resolveTransition, resolveZoomShape, resolveCaptionTemplate, resolveBlend } from '@cinegen/lib/llm/copilot-look-ops';
import { splitAtSceneChanges } from '@cinegen/lib/llm/copilot-analyze';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const clip = (o: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'a', trackId: 't', name: 'c', startTime: 0, duration: 6, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...o });
const tl = (clips: Clip[]): Timeline => ({ id: 'tl', name: 'T', tracks: [{ id: 't', name: 'V', kind: 'video', color: '', muted: false, solo: false, locked: false, visible: true, volume: 1 }], clips, duration: 12, transitions: [], markers: [] });

describe('plain words → catalog ids', () => {
  it('finds looks, effects, transitions, zoom, captions and blend by name', () => {
    expect(resolveLut('teal and orange')).toBe('builtin:look-teal-orange');
    expect(resolveLut('Teal & Orange')).toBe('builtin:look-teal-orange');
    expect(resolveLut('black and white film')).toBe('builtin:look-mono');
    expect(resolveEffect('vignette')).toBe('builtin:fx-vignette');
    expect(resolveEffect('film grain')).toBe('builtin:fx-film-grain');
    expect(resolveTransition('page curl')).toBe('page-curl');
    expect(resolveTransition('Circle Wipe')).toBe('circle-wipe');
    expect(resolveZoomShape('slow push')).toBe('slow-push');
    expect(resolveCaptionTemplate('TikTok Pop')).toBe('tiktok');
    expect(resolveBlend('Screen')).toBe('screen');
    expect(resolveLut('nonsense')).toBeNull();
  });
});

describe('edit_timeline look ops', () => {
  it('"add a teal and orange look" sets the LUT; effects stack; clear removes', () => {
    let t = applyTimelineEditOps(tl([clip()]), [{ op: 'set_look', clipId: 'c1', lut: 'teal and orange', lutIntensity: 0.7, effects: [{ effect: 'vignette' }], blendMode: 'screen' }]);
    expect(t.clips[0]).toMatchObject({ lut: { id: 'builtin:look-teal-orange', intensity: 0.7 }, fx: [{ id: 'builtin:fx-vignette' }], blendMode: 'screen' });
    t = applyTimelineEditOps(t, [{ op: 'set_look', clipId: 'c1', clear: true }]);
    expect(t.clips[0].lut).toBeUndefined(); expect(t.clips[0].fx).toBeUndefined(); expect(t.clips[0].blendMode).toBeUndefined();
  });
  it('set_zoom applies a shape and clamps values', () => {
    const t = applyTimelineEditOps(tl([clip()]), [{ op: 'set_zoom', clipId: 'c1', shape: 'slow push', magnification: 99, focalX: 0.2 }]);
    expect(t.clips[0].zoom).toMatchObject({ shape: 'slow-push', magnification: 16, focalPointX: 0.2 });
    expect(applyTimelineEditOps(t, [{ op: 'set_zoom', clipId: 'c1', clear: true }]).clips[0].zoom).toBeUndefined();
  });
  it('add_transition needs spare footage; with it, a GL transition is added and can be removed', () => {
    const a = clip({ id: 'a1', startTime: 0, duration: 5, trimEnd: 1.5 }); const b = clip({ id: 'b1', startTime: 3.5, duration: 5, trimStart: 1.5 });
    const none = applyTimelineEditOps(tl([clip({ id: 'a1', startTime: 0, duration: 3 }), clip({ id: 'b1', startTime: 3, duration: 3 })]), [{ op: 'add_transition', fromClipId: 'a1', type: 'page curl' }]);
    expect(none.transitions).toHaveLength(0);
    const t = applyTimelineEditOps(tl([a, b]), [{ op: 'add_transition', fromClipId: 'a1', type: 'circle wipe', duration: 0.5 }]);
    expect(t.transitions).toHaveLength(1); expect(t.transitions[0]).toMatchObject({ type: 'dissolve', glType: 'circle-wipe' });
    expect(applyTimelineEditOps(t, [{ op: 'remove_transition', fromClipId: 'a1' }]).transitions).toHaveLength(0);
  });
  it('unknown clip ids and names leave the timeline unchanged', () => {
    const base = tl([clip()]);
    expect(applyTimelineEditOps(base, [{ op: 'set_look', clipId: 'nope', lut: 'teal' }])).toEqual(base);
    expect(applyTimelineEditOps(base, [{ op: 'set_look', clipId: 'c1', lut: 'zzz' }]).clips[0].lut).toBeUndefined();
  });
});

describe('assistant action blocks', () => {
  const block = (json: unknown) => '```cinegen-skill-action\n' + JSON.stringify(json) + '\n```';
  it('parses look ops and analysis steps from the model reply', () => {
    const a = parseSkillActionFromContent(block({ label: 'Teal look', steps: [
      { type: 'edit_timeline', ops: [{ op: 'set_look', clipId: 'c1', lut: 'Teal & Orange' }, { op: 'set_zoom', clipId: 'c1', shape: 'Slow Push' }, { op: 'add_transition', fromClipId: 'c1', type: 'Page Curl' }] },
      { type: 'analyze_clip', task: 'captions', clipId: 'c1', template: 'TikTok Pop', translateTo: 'Spanish' },
      { type: 'analyze_clip', task: 'split_scenes', clipId: 'c1' },
      { type: 'analyze_clip', task: 'bogus', clipId: 'c1' },
    ] }))!;
    expect(a.steps).toHaveLength(3);
    expect(a.steps[0]).toMatchObject({ type: 'edit_timeline', ops: [{ op: 'set_look' }, { op: 'set_zoom' }, { op: 'add_transition' }] });
    expect(a.steps[1]).toMatchObject({ type: 'analyze_clip', task: 'captions', translateTo: 'Spanish' });
  });
  it('the guide teaches the new tools and lists valid names', () => {
    expect(COPILOT_ACTIONS_GUIDE).toContain('set_look'); expect(COPILOT_ACTIONS_GUIDE).toContain('analyze_clip');
    expect(COPILOT_ACTIONS_GUIDE).toContain('Teal & Orange'); expect(COPILOT_ACTIONS_GUIDE).toContain('Page Curl'); expect(COPILOT_ACTIONS_GUIDE).toContain('TikTok Pop');
  });
});

describe('scene split', () => {
  it('splits a clip at the detected scene changes', () => {
    const t = splitAtSceneChanges(tl([clip({ id: 'v', duration: 6 })]), 'v', [2200, 4000]);
    expect(t.clips).toHaveLength(3);
    expect(t.clips.map((c) => Math.round(c.startTime * 10) / 10).sort()).toEqual([0, 2.2, 4]);
  });
});
