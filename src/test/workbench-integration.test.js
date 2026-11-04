import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyOps, sanitizeProps } from '../../apps/shotcraft/workbench/src/ai/ops.ts';
import { projectFromAssets, appendAssets, isHostAsset } from '../../apps/shotcraft/workbench/src/host/importAssets.ts';
import {
  isWorkbenchEligible, toWorkbenchAsset, openInWorkbench, consumeWorkbenchHandoff,
} from '../lib/workbench.js';
import { mountGenerationNotifications, notifyGeneration, __resetGenerationNotifications } from '../components/studio/generationNotifications.js';
import { saveGeneration, registerGeneration } from '../lib/generationHistory.js';
import { parseModelAnswer, extractText } from '../../netlify/functions/workbench-chat.js';

// src/test/setup.js replaces sessionStorage with no-op mocks; the handoff needs a real store.
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
};
beforeEach(() => { vi.stubGlobal('sessionStorage', memoryStorage()); });

// Minimal card registry mirroring the real media/text card schemas.
const CARDS = {
  'video-clip': { id: 'video-clip', name: 'Video', category: 'media', kind: 'video', timing: 'realtime', durationInFrames: 150, component: () => null,
    schema: [{ type: 'text', key: 'file', label: 'File', default: '' }, { type: 'select', key: 'fit', label: 'Fit', default: 'contain', options: [{ value: 'contain', label: 'c' }, { value: 'cover', label: 'v' }] }, { type: 'slider', key: 'volume', label: 'Vol', default: 1, min: 0, max: 1, step: 0.01 }] },
  'text-basic': { id: 'text-basic', name: 'Text', category: 'wb', durationInFrames: 90, component: () => null,
    schema: [{ type: 'text', key: 'text', label: 'Text', default: '' }, { type: 'color', key: 'color', label: 'Color', default: '#fff' }] },
};

const baseProject = () => projectFromAssets([
  { url: 'https://cdn.example.com/a.mp4', kind: 'video', name: 'A', durationSec: 4 },
  { url: 'https://cdn.example.com/b.png', kind: 'image', name: 'B' },
  { url: 'https://cdn.example.com/m.mp3', kind: 'audio', name: 'Music', durationSec: 10 },
]);

describe('workbench: asset import', () => {
  it('lays visuals end to end and audio on its own track', () => {
    const p = baseProject();
    const clips = p.tracks.find((t) => t.name === 'Clips').clips;
    expect(clips.map((c) => [c.cardId, c.start, c.duration])).toEqual([['video-clip', 0, 120], ['image-clip', 120, 90]]);
    expect(clips[0].props.file).toBe('https://cdn.example.com/a.mp4');
    expect(p.tracks.find((t) => t.name === 'Audio').clips[0].duration).toBe(300);
    expect(p.fps).toBe(30);
  });

  it('appends after the current end and rejects non-URL assets', () => {
    const next = appendAssets(baseProject(), [{ url: 'https://cdn.example.com/c.mp4', kind: 'video', durationSec: 2 }]);
    const clips = next.tracks.find((t) => t.name === 'Clips').clips;
    expect(clips.at(-1).start).toBe(300);
    expect(isHostAsset({ url: 'javascript:alert(1)', kind: 'video' })).toBe(false);
    expect(isHostAsset({ url: 'https://x/y.png', kind: 'pdf' })).toBe(false);
  });
});

describe('workbench: AI edit ops', () => {
  it('applies valid edits and clamps values', () => {
    const p = baseProject();
    const clip = p.tracks.find((t) => t.name === 'Clips').clips[0];
    const res = applyOps(p, [
      { op: 'update_clip', clipId: clip.id, duration: 60, speed: 10, opacity: 2 },
      { op: 'add_clip', cardId: 'text-basic', start: 0, duration: 45, props: { text: 'Hello', color: '#ff0000' } },
    ], CARDS);
    expect(res.errors).toEqual([]);
    expect(res.applied).toBe(2);
    const updated = res.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.id);
    expect([updated.duration, updated.speed, updated.opacity]).toEqual([60, 4, 1]);
    expect(res.project.tracks[0].clips[0].props).toEqual({ text: 'Hello', color: '#ff0000' });
    // input project is untouched (one undo step is taken by the caller)
    expect(clip.duration).toBe(120);
  });

  it('rejects unknown ops, ids, cards, prop keys and invented media URLs', () => {
    const p = baseProject();
    const clip = p.tracks.find((t) => t.name === 'Clips').clips[0];
    const res = applyOps(p, [
      { op: 'delete_everything' },
      { op: 'remove_clip', clipId: 'nope' },
      { op: 'add_clip', cardId: 'not-a-card', start: 0 },
      { op: 'set_props', clipId: clip.id, props: { file: 'https://evil.example/x.mp4', bogus: 1, fit: 'cover' } },
    ], CARDS);
    expect(res.applied).toBe(0);
    expect(res.errors.length).toBeGreaterThanOrEqual(5);
    const after = res.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.id);
    expect(after.props.file).toBe('https://cdn.example.com/a.mp4');
    expect(after.props.fit).toBe('cover');
  });

  it('splits a clip at an absolute frame', () => {
    const p = baseProject();
    const clip = p.tracks.find((t) => t.name === 'Clips').clips[0];
    const res = applyOps(p, [{ op: 'split_clip', clipId: clip.id, at: 30 }], CARDS);
    const clips = res.project.tracks.find((t) => t.name === 'Clips').clips.filter((c) => c.cardId === 'video-clip');
    expect(clips.map((c) => [c.start, c.duration, c.inOffset])).toEqual([[0, 30, 0], [30, 90, 30]]);
  });

  it('sanitizeProps rejects bad colours and out-of-list selects', () => {
    const errors = [];
    expect(sanitizeProps(CARDS['text-basic'], { color: 'url(javascript:x)' }, new Set(), errors)).toEqual({});
    expect(sanitizeProps(CARDS['video-clip'], { fit: 'stretch', volume: 5 }, new Set(), errors)).toEqual({ volume: 1 });
    expect(errors.length).toBe(2);
  });
});

describe('workbench: SmartVid handoff', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('excludes Director, Timeline and Video Agent', () => {
    for (const s of ['director', 'timeline', 'videoagent', 'video-agent-studio']) expect(isWorkbenchEligible(s)).toBe(false);
    for (const s of ['image', 'video', 'lipsync', 'influencer', 'cinema', 'avatar']) expect(isWorkbenchEligible(s)).toBe(true);
  });

  it('converts generations and hands them to the workbench route once', () => {
    expect(toWorkbenchAsset({ url: 'https://x/v.mp4?sig=1', prompt: 'p' }).kind).toBe('video');
    expect(toWorkbenchAsset({ url: 'javascript:alert(1)' })).toBeNull();
    const navigate = vi.fn();
    expect(openInWorkbench([{ url: 'https://x/a.png', type: 'image', prompt: 'cat' }], { navigate })).toBe(true);
    expect(navigate).toHaveBeenCalledWith('workbench');
    const h = consumeWorkbenchHandoff();
    expect(h.assets).toEqual([{ url: 'https://x/a.png', kind: 'image', name: 'cat' }]);
    expect(consumeWorkbenchHandoff()).toBeNull();
  });
});

describe('workbench: "Edit in Workbench" notification', () => {
  beforeEach(() => { __resetGenerationNotifications(); localStorage.clear(); document.body.innerHTML = ''; });

  it('offers Edit in Workbench after an eligible studio saves, merged with the studio success card', () => {
    const navigate = vi.fn();
    mountGenerationNotifications(navigate);
    saveGeneration({ studio: 'lipsync', type: 'video', url: 'https://x/out.mp4', prompt: 'talking' });
    notifyGeneration({ phase: 'success', id: 'g1', studio: 'lipsync', label: 'Lip Sync', url: 'https://x/out.mp4' });
    const cards = document.querySelectorAll('[data-notification="success"]');
    expect(cards.length).toBe(1);
    const btn = cards[0].querySelector('[data-action="edit-in-workbench"]');
    expect(btn).toBeTruthy();
    btn.click();
    expect(navigate).toHaveBeenCalledWith('workbench');
    expect(consumeWorkbenchHandoff().assets[0]).toMatchObject({ url: 'https://x/out.mp4', kind: 'video' });
  });

  it('does not offer it for Video Agent output', () => {
    mountGenerationNotifications(vi.fn());
    saveGeneration({ studio: 'videoagent', type: 'video', url: 'https://x/agent.mp4' });
    expect(document.querySelector('[data-action="edit-in-workbench"]')).toBeNull();
  });
});

describe('workbench-chat function helpers', () => {
  it('parses fenced JSON and drops malformed ops', () => {
    const r = parseModelAnswer('```json\n{"reply":"ok","ops":[{"op":"remove_clip","clipId":"c1"},5,{"x":1}]}\n```');
    expect(r).toEqual({ reply: 'ok', ops: [{ op: 'remove_clip', clipId: 'c1' }] });
    expect(() => parseModelAnswer('not json')).toThrow();
    expect(extractText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"reply":"a"}' }] }] })).toBe('{"reply":"a"}');
  });
});

describe('registerGeneration: studios that now feed the Workbench', () => {
  beforeEach(() => { __resetGenerationNotifications(); localStorage.clear(); document.body.innerHTML = ''; });

  it('skips blob: and empty URLs', async () => {
    expect(await registerGeneration('videotools', 'video', 'blob:https://x/abc')).toBeNull();
    expect(await registerGeneration('edit', 'image', '')).toBeNull();
  });

  it.each([
    ['cinema', 'video', 'https://cdn.muapi.ai/out/cinema.mp4'],
    ['upscale', 'image', 'https://cdn.muapi.ai/out/up.png'],
    ['audio', 'audio', 'https://cdn.muapi.ai/out/song.mp3'],
    ['storyboard', 'image', 'https://cdn.muapi.ai/out/frame.png'],
    ['edit', 'image', 'https://cdn.muapi.ai/out/edit.png'],
    ['videotools', 'video', 'https://cdn.muapi.ai/out/tool.mp4'],
  ])('%s output gets "Edit in Workbench" and opens as %s', async (studio, type, url) => {
    const navigate = vi.fn();
    mountGenerationNotifications(navigate);
    const entry = await registerGeneration(studio, type, url, { prompt: `${studio} result` });
    expect(entry).toMatchObject({ url, type });
    const btn = document.querySelector('[data-action="edit-in-workbench"]');
    expect(btn).toBeTruthy();
    btn.click();
    expect(navigate).toHaveBeenCalledWith('workbench');
    expect(consumeWorkbenchHandoff().assets[0]).toMatchObject({ url, kind: type });
  });

  it('audio results keep their type in the saved history', async () => {
    await registerGeneration('audio', 'audio', 'https://cdn.muapi.ai/out/a.mp3', { prompt: 'song' });
    const stored = JSON.parse(localStorage.getItem('video_history') || '[]');
    expect(stored[0]).toMatchObject({ url: 'https://cdn.muapi.ai/out/a.mp3', type: 'audio' });
  });
});

describe('studio completion points stay wired to the Workbench', () => {
  it.each([
    ['CinemaStudio.js', "registerGeneration('cinema', 'video'"],
    ['UpscaleStudio.js', "registerGeneration('upscale', 'image'"],
    ['AudioStudio.js', "registerGeneration('audio', 'audio'"],
    ['StoryboardStudio.js', "registerGeneration('storyboard', 'image'"],
    ['EditStudio.js', "registerGeneration('edit', 'image'"],
    ['VideoToolsStudio.js', "registerGeneration('videotools', 'video'"],
  ])('%s registers its output', async (file, call) => {
    const fs = await import('node:fs');
    expect(fs.readFileSync(`src/components/${file}`, 'utf8')).toContain(call);
  });
});
