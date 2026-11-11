import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({ muapi: { generateImage: vi.fn(async () => ({ url: 'https://img/x.png' })) } }));
vi.mock('../lib/openaiService.js', () => ({
  openaiService: { generateText: vi.fn(), generateImageResponses: vi.fn() },
}));
vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: { hasOpenAIKey: vi.fn(() => false), hasMuapiKey: vi.fn(() => true) },
}));

import {
  generateStoryboardFromIntent,
  generateFrameImage,
  parseStoryboardResponse,
  distributeDurations,
  clampFrameCount,
  renumberFrames,
  createFrame,
  buildFramePrompt,
  SHOT_TYPES,
} from '../lib/storyboardEngine.js';
import { openaiService } from '../lib/openaiService.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { muapi } from '../lib/muapi.js';

const intent = { subject: 'Trail shoe', premise: 'Run further', duration: 30, frameCount: 5, cta: 'Shop now', targetAudience: 'runners' };

beforeEach(() => {
  vi.clearAllMocks();
  apiKeyManager.hasOpenAIKey.mockReturnValue(false);
  apiKeyManager.hasMuapiKey.mockReturnValue(true);
});

describe('storyboard engine helpers', () => {
  it('clamps frame counts to 3-12', () => {
    expect(clampFrameCount(1)).toBe(3);
    expect(clampFrameCount(99)).toBe(12);
    expect(clampFrameCount('abc', 6)).toBe(6);
  });

  it('splits a duration into whole seconds that add up', () => {
    const d = distributeDurations(32, 5);
    expect(d).toHaveLength(5);
    expect(d.reduce((a, b) => a + b, 0)).toBe(32);
  });

  it('renumbers scenes and shots after reordering', () => {
    const frames = [createFrame({ sceneNumber: 4 }), createFrame({ sceneNumber: 4 }), createFrame({ sceneNumber: 9 })];
    renumberFrames(frames);
    expect(frames.map((f) => `${f.sceneNumber}.${f.shotNumber}`)).toEqual(['1.1', '1.2', '2.1']);
  });

  it('keeps the template-facing aliases on every frame', () => {
    const f = createFrame({ shot: 'POV', prompt: 'hello' });
    expect(f.shotType).toBe('POV');
    expect(f.description).toBe('hello');
  });

  it('puts the story bible and camera move in the frame prompt', () => {
    const p = buildFramePrompt(createFrame({ shot: 'Wide Shot', prompt: 'A street', cameraMovement: 'Dolly In' }), { storyBible: 'Mara in a red jacket' });
    expect(p).toContain('Wide Shot');
    expect(p).toContain('dolly in camera');
    expect(p).toContain('Mara in a red jacket');
  });
});

describe('parseStoryboardResponse', () => {
  it('parses JSON (also inside a code fence) and rescales durations to the total', () => {
    const text = '```json\n' + JSON.stringify({ frames: [
      { scene: 1, shot: 'wide shot', camera: 'dolly in', duration: 5, visual: 'A', narration: 'n1' },
      { scene: 1, shot: 'Close-Up', camera: 'Static', duration: 5, visual: 'B' },
    ] }) + '\n```';
    const frames = parseStoryboardResponse(text, { duration: 20 }, 2);
    expect(frames).toHaveLength(2);
    expect(frames[0].shot).toBe('Wide Shot');
    expect(frames[0].cameraMovement).toBe('Dolly In');
    expect(frames.reduce((a, f) => a + f.duration, 0)).toBe(20);
  });

  it('returns null for unusable answers so the caller can fall back', () => {
    expect(parseStoryboardResponse('sorry, no', intent, 5)).toBeNull();
    expect(parseStoryboardResponse('{"frames":[]}', intent, 5)).toBeNull();
  });
});

describe('generateStoryboardFromIntent', () => {
  it('requires a subject or premise', async () => {
    await expect(generateStoryboardFromIntent({ subject: '', premise: '' })).rejects.toThrow(/subject or premise/);
  });

  it('falls back to a varied template storyboard with the requested count and duration', async () => {
    const { frames, source } = await generateStoryboardFromIntent(intent);
    expect(source).toBe('template');
    expect(frames).toHaveLength(5);
    expect(frames.reduce((a, f) => a + f.duration, 0)).toBe(30);
    expect(new Set(frames.map((f) => f.prompt)).size).toBe(5);
    expect(frames.every((f) => SHOT_TYPES.includes(f.shot))).toBe(true);
    expect(frames[frames.length - 1].prompt).toContain('Shop now');
    expect(muapi.generateImage).not.toHaveBeenCalled(); // no images unless asked
  });

  it('uses the AI plan when an OpenAI key is set', async () => {
    apiKeyManager.hasOpenAIKey.mockReturnValue(true);
    openaiService.generateText.mockResolvedValue(JSON.stringify({ frames: [
      { shot: 'Wide Shot', duration: 15, visual: 'Opening' },
      { shot: 'Close-Up', duration: 15, visual: 'Closing' },
    ] }));
    const { frames, source } = await generateStoryboardFromIntent({ ...intent, frameCount: 3 });
    expect(source).toBe('ai');
    expect(frames).toHaveLength(2);
  });

  it('falls back to the template when the AI call fails', async () => {
    apiKeyManager.hasOpenAIKey.mockReturnValue(true);
    openaiService.generateText.mockRejectedValue(new Error('boom'));
    const { frames, source } = await generateStoryboardFromIntent(intent);
    expect(source).toBe('template');
    expect(frames).toHaveLength(5);
  });
});

describe('generateFrameImage', () => {
  it('passes negative prompt, seed, guidance, steps and references to MuAPI', async () => {
    await generateFrameImage('a street', '16:9', 'nano-banana', 'Noir', 'None', 'None', undefined, {
      negativePrompt: 'blurry', seed: 42, guidanceScale: 8, steps: 25, referenceImages: [{ url: 'https://ref/1.png' }],
    });
    const params = muapi.generateImage.mock.calls[0][0];
    expect(params.prompt).toContain('noir style');
    expect(params.negative_prompt).toBe('blurry');
    expect(params.seed).toBe(42);
    expect(params.guidance_scale).toBe(8);
    expect(params.steps).toBe(25);
    expect(params.reference_images).toEqual(['https://ref/1.png']);
  });

  it('leaves seed out when it is -1 (random)', async () => {
    await generateFrameImage('a street', '16:9', 'm', 'None', 'None', 'None', undefined, { seed: -1 });
    expect(muapi.generateImage.mock.calls[0][0].seed).toBeUndefined();
  });
});
