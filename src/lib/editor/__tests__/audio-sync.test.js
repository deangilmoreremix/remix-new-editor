import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeAudioOffset, findLinkedAudioVideoPairs } from '../audioSync.js';

vi.mock('../metadataExtractor.js', () => ({
  extractWaveform: vi.fn(),
}));

import { extractWaveform } from '../metadataExtractor.js';

const samplePeaks = (count, peakIndex, peakValue = 1.0) => {
  const peaks = new Array(count).fill(0.01);
  if (peakIndex >= 0 && peakIndex < count) {
    peaks[peakIndex] = peakValue;
  }
  return peaks;
};

describe('computeAudioOffset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('returns zero offset and zero confidence when audio waveform is empty', async () => {
    extractWaveform.mockResolvedValue({ peaks: [], duration: 0 });
    global.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob() });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(result.offsetSeconds).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns zero offset when audio URL cannot be fetched', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(result.offsetSeconds).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('computes offset using first strong peak when only audio waveform is available', async () => {
    const peaks = samplePeaks(1000, 150, 0.9);
    // First call (video) fails, second call (audio) succeeds
    extractWaveform
      .mockRejectedValueOnce(new Error('video decode failed'))
      .mockResolvedValueOnce({
        peaks,
        duration: 50,
        sampleRate: 44100,
        channels: 1,
      });
    global.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob() });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(result.offsetSeconds).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('computes offset using cross-correlation when both waveforms are available', async () => {
    const videoPeaks = samplePeaks(1000, 500, 1.0);
    const audioPeaks = samplePeaks(1000, 480, 1.0);
    extractWaveform
      .mockResolvedValueOnce({
        peaks: videoPeaks,
        duration: 50,
        sampleRate: 44100,
        channels: 1,
      })
      .mockResolvedValueOnce({
        peaks: audioPeaks,
        duration: 50,
        sampleRate: 44100,
        channels: 1,
      });
    global.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob() });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(typeof result.offsetSeconds).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  it('returns finite number for offsetSeconds', async () => {
    const peaks = samplePeaks(1000, 200, 0.8);
    extractWaveform.mockResolvedValue({
      peaks,
      duration: 40,
      sampleRate: 44100,
      channels: 1,
    });
    global.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob() });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(Number.isFinite(result.offsetSeconds)).toBe(true);
  });

  it('throws when videoUrl or audioUrl is missing', async () => {
    await expect(computeAudioOffset('', 'http://example.com/a.mp3')).rejects.toThrow();
    await expect(computeAudioOffset('http://example.com/v.mp4', '')).rejects.toThrow();
  });

  it('falls back gracefully when video fetch fails', async () => {
    const peaks = samplePeaks(1000, 100, 0.7);
    extractWaveform
      .mockRejectedValueOnce(new Error('video fetch failed'))
      .mockResolvedValue({
        peaks,
        duration: 30,
        sampleRate: 44100,
        channels: 1,
      });
    global.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob() });

    const result = await computeAudioOffset('http://example.com/v.mp4', 'http://example.com/a.mp3');
    expect(result.offsetSeconds).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });
});

describe('findLinkedAudioVideoPairs', () => {
  it('returns pairs for selected linked video+audio clips', () => {
    const clips = [
      { id: 'v1', type: 'video', linkedClipIds: ['a1'] },
      { id: 'a1', type: 'audio', linkedClipIds: ['v1'] },
      { id: 'v2', type: 'video', linkedClipIds: ['a2'] },
      { id: 'a2', type: 'audio', linkedClipIds: ['v2'] },
    ];
    const pairs = findLinkedAudioVideoPairs(['v1', 'a1', 'v2', 'a2'], clips);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ videoClip: clips[0], audioClip: clips[1] });
    expect(pairs[1]).toEqual({ videoClip: clips[2], audioClip: clips[3] });
  });

  it('returns empty array when no linked pairs in selection', () => {
    const clips = [
      { id: 'v1', type: 'video', linkedClipIds: ['a1'] },
      { id: 'a1', type: 'audio', linkedClipIds: ['v1'] },
    ];
    const pairs = findLinkedAudioVideoPairs(['v1'], clips);
    expect(pairs).toHaveLength(0);
  });

  it('returns empty array when selected IDs have no matching links', () => {
    const clips = [
      { id: 'v1', type: 'video', linkedClipIds: ['a1'] },
      { id: 'a1', type: 'audio', linkedClipIds: ['v1'] },
    ];
    const pairs = findLinkedAudioVideoPairs([], clips);
    expect(pairs).toHaveLength(0);
  });

  it('handles clips array without linkedClipIds', () => {
    const clips = [
      { id: 'v1', type: 'video' },
      { id: 'a1', type: 'audio' },
    ];
    const pairs = findLinkedAudioVideoPairs(['v1', 'a1'], clips);
    expect(pairs).toHaveLength(0);
  });

  it('returns mixed pairs and ignores unlinked clips', () => {
    const clips = [
      { id: 'v1', type: 'video', linkedClipIds: ['a1'] },
      { id: 'a1', type: 'audio', linkedClipIds: ['v1'] },
      { id: 'v2', type: 'video' },
      { id: 'a2', type: 'audio' },
    ];
    const pairs = findLinkedAudioVideoPairs(['v1', 'a1', 'v2', 'a2'], clips);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ videoClip: clips[0], audioClip: clips[1] });
  });
});
