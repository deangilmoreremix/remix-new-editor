import { describe, it, expect, vi, beforeEach } from 'vitest';

// Segmentation now runs in the browser (SlimSAM / OWLv2) — no fal, no edge function.
const canvas = { width: 4, height: 2 };
vi.mock('../ml/frameGrab.js', () => ({ grabFrame: vi.fn(async () => canvas) }));
vi.mock('../ml/localAI.js', () => ({
  maskFromText: vi.fn(),
  maskFromPrompt: vi.fn(),
  alphaToMaskPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

import { AiMuAPI } from '../aiMuapi.js';
import * as ai from '../ml/localAI.js';
import { grabFrame } from '../ml/frameGrab.js';

const hit = { alpha: new Uint8Array(8).fill(255), width: 4, height: 2, bbox: [0, 0, 3, 1], score: 0.9 };

describe('AiMuAPI.applySAM3Segmentation (in-browser)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mask');
  });

  it('masks by text prompt with the local OWLv2 → SAM pipeline', async () => {
    ai.maskFromText.mockResolvedValue(hit);
    const result = await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', { type: 'text', prompt: 'a cat' });
    expect(grabFrame).toHaveBeenCalledWith('https://example.com/img.png', 0, expect.objectContaining({ image: true }));
    expect(ai.maskFromText).toHaveBeenCalledWith(canvas, 'a cat');
    expect(result).toEqual({ mask: 'blob:mask' });
  });

  it('passes points for click prompts', async () => {
    ai.maskFromPrompt.mockResolvedValue(hit);
    await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', { type: 'click', points: [[10, 20]] });
    expect(ai.maskFromPrompt).toHaveBeenCalledWith(canvas, { points: [[10, 20]], box: undefined });
  });

  it('passes a box for box prompts', async () => {
    ai.maskFromPrompt.mockResolvedValue(hit);
    await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', { type: 'box', box: [0, 0, 100, 100] });
    expect(ai.maskFromPrompt).toHaveBeenCalledWith(canvas, { points: undefined, box: [0, 0, 100, 100] });
  });

  it('throws when nothing matches', async () => {
    ai.maskFromText.mockResolvedValue({ alpha: null, detections: [] });
    await expect(AiMuAPI.applySAM3Segmentation('https://example.com/img.png', { type: 'text', prompt: 'a unicorn' })).rejects.toThrow('No object found');
  });
});
