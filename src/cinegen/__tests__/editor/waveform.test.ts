import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWaveformPeaks } from '@cinegen/lib/editor/waveform';

describe('extractWaveformPeaks', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('fails on an HTTP error instead of handing the error body to the audio decoder', async () => {
    const decodeAudioData = vi.fn();
    vi.stubGlobal('AudioContext', class { decodeAudioData = decodeAudioData; close = vi.fn(); });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(8) }));
    await expect(extractWaveformPeaks('https://example.com/missing.mp4')).rejects.toThrow(/HTTP 404/);
    expect(decodeAudioData).not.toHaveBeenCalled();
  });
});
