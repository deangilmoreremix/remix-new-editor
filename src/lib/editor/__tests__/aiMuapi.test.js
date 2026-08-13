import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiMuAPI } from '../aiMuapi.js';

// Mock supabase
vi.mock('../../supabase.js', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../../supabase.js';

describe('AiMuAPI.applySAM3Segmentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls sam3-segment edge function with text prompt', async () => {
    const mockMaskUrl = 'https://example.com/mask.png';
    supabase.functions.invoke.mockResolvedValue({
      data: { maskUrl: mockMaskUrl },
      error: null,
    });

    const result = await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', {
      type: 'text',
      prompt: 'a cat',
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sam3-segment', {
      body: {
        imageUrl: 'https://example.com/img.png',
        promptType: 'text',
        prompt: 'a cat',
      },
    });
    expect(result).toEqual({ mask: mockMaskUrl });
  });

  it('passes points for click prompt type', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { maskUrl: 'https://example.com/mask.png' },
      error: null,
    });

    await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', {
      type: 'click',
      prompt: 'click',
      points: [10, 20],
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sam3-segment', {
      body: {
        imageUrl: 'https://example.com/img.png',
        promptType: 'click',
        prompt: 'click',
        points: [10, 20],
      },
    });
  });

  it('passes box for box prompt type', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { maskUrl: 'https://example.com/mask.png' },
      error: null,
    });

    await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', {
      type: 'box',
      prompt: 'box',
      box: [0, 0, 100, 100],
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sam3-segment', {
      body: {
        imageUrl: 'https://example.com/img.png',
        promptType: 'box',
        prompt: 'box',
        box: [0, 0, 100, 100],
      },
    });
  });

  it('uses default values when prompts is empty', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { maskUrl: 'https://example.com/mask.png' },
      error: null,
    });

    await AiMuAPI.applySAM3Segmentation('https://example.com/img.png', {});

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sam3-segment', {
      body: {
        imageUrl: 'https://example.com/img.png',
        promptType: 'text',
        prompt: '',
      },
    });
  });

  it('throws on supabase function error', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    await expect(
      AiMuAPI.applySAM3Segmentation('https://example.com/img.png', {
        type: 'text',
        prompt: 'a cat',
      })
    ).rejects.toThrow('Network error');
  });
});
