// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { cropBox, sharpenPixels, finishArgs, needsFinish, finishVideo, barsFromPcm } from '../mediaTools.js';
import { rmsWindows } from '../../editor/ml/audio.js';

describe('Video Outreach media tools', () => {
  it('crops the middle of a picture', () => {
    expect(cropBox(1600, 900, 'square')).toEqual({ x: 350, y: 0, w: 900, h: 900 });
    expect(cropBox(900, 1600, '16:9')).toEqual({ x: 0, y: 547, w: 900, h: 506 });
    expect(cropBox(10, 10, 'none')).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it('sharpens edges and leaves flat areas and transparency alone', () => {
    const w = 3; const h = 3;
    const data = new Uint8ClampedArray(w * h * 4).fill(100);
    data[4 * 4] = 150; // centre pixel brighter (red)
    const img = sharpenPixels({ width: w, height: h, data }, 1);
    expect(img.data[4 * 4]).toBeGreaterThan(150);
    expect(img.data[4 * 4 + 1]).toBe(100);
    expect(img.data[4 * 4 + 3]).toBe(100);
  });

  it('FFmpeg: loudness and size presets', () => {
    expect(needsFinish({})).toBe(false);
    expect(needsFinish({ louder: true })).toBe(true);
    expect(finishArgs({ louder: true })).toEqual(['-i', 'in.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'out.mp4']);
    expect(finishArgs({ crf: 30 })).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-crf', '30', '-c:a', 'aac']));
  });

  it('runs the finishing pass on FFmpeg and hands back an MP4', async () => {
    const files = {};
    const ffmpeg = { on: vi.fn(), writeFile: vi.fn(async (n, d) => { files[n] = d; }), exec: vi.fn(async () => 0), readFile: vi.fn(async () => new Uint8Array([1, 2, 3])), terminate: vi.fn() };
    const out = await finishVideo(new Blob(['v'], { type: 'video/webm' }), { quality: 'standard', louder: true, deps: { ffmpeg } });
    expect(Object.keys(files)).toEqual(['in.webm']);
    // WebM is re-encoded to H.264 even at the standard size.
    expect(ffmpeg.exec.mock.calls[0][0]).toEqual(expect.arrayContaining(['-i', 'in.webm', '-crf', '23']));
    expect(out.type).toBe('video/mp4');
    const same = new Blob(['v'], { type: 'video/mp4' });
    expect(await finishVideo(same, { deps: { ffmpeg } })).toBe(same);
    ffmpeg.exec.mockResolvedValueOnce(1);
    await expect(finishVideo(same, { quality: 'small', deps: { ffmpeg } })).rejects.toThrow(/FFmpeg/);
  });

  it('waveform bars are scaled to the loudest part', () => {
    const pcm = new Float32Array(800);
    pcm.fill(0.5, 400);
    const bars = barsFromPcm(pcm, 100, 4, rmsWindows);
    expect(bars).toEqual([0, 0, 1, 1]);
  });
});
