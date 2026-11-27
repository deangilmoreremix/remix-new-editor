// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { AUDIO_DEFAULTS, clipsInSamples, createLevelMeter, levelFromSamples, levelHint, loadAudioSettings, mixAudioTracks, recordMicTest, saveAudioSettings } from '../audio.js';
import { createCountdown } from '../countdown.js';
import { getAudioStreamConstraints, getDisplayStreamWithMic } from '../streams.js';
import { FakeRecorder, FakeStream, FakeTrack } from './fakes.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

// A stand-in Web Audio: an analyser that reports a fixed waveform, and a destination with one track.
function fakeAudioCtx(sample = 128) {
  const made = { sources: [], closed: 0 };
  class Ctx {
    constructor() { made.ctx = this; }
    createMediaStreamSource(stream) { const s = { stream, connect: vi.fn(), disconnect: vi.fn() }; made.sources.push(s); return s; }
    createAnalyser() { return { fftSize: 0, getByteTimeDomainData: (buf) => buf.fill(sample) }; }
    createMediaStreamDestination() { return { stream: new FakeStream([new FakeTrack('audio')]) }; }
    resume() { return Promise.resolve(); }
    close() { made.closed++; return Promise.resolve(); }
  }
  return { Ctx, made };
}

describe('audio settings', () => {
  test('voice clean-up switches are on by default, computer sound off, and are remembered', () => {
    const storage = memoryStorage();
    expect(loadAudioSettings(storage)).toEqual(AUDIO_DEFAULTS);
    saveAudioSettings({ ...AUDIO_DEFAULTS, noiseSuppression: false, systemAudio: true, junk: 1 }, storage);
    expect(loadAudioSettings(storage)).toMatchObject({ noiseSuppression: false, systemAudio: true, echoCancellation: true });
    expect(loadAudioSettings(storage)).not.toHaveProperty('junk');
  });

  test('the switches reach the browser as microphone constraints, with the chosen device', () => {
    const audioSettings = { noiseSuppression: false, echoCancellation: true, autoGainControl: false };
    expect(getAudioStreamConstraints({ recordAudio: true, selectedAudioSource: 'mic-2', audioSettings }))
      .toEqual({ deviceId: { exact: 'mic-2' }, noiseSuppression: false, echoCancellation: true, autoGainControl: false });
    expect(getAudioStreamConstraints({ recordAudio: true, selectedAudioSource: 'default', audioSettings }))
      .toEqual({ noiseSuppression: false, echoCancellation: true, autoGainControl: false });
    expect(getAudioStreamConstraints({ recordAudio: false, audioSettings })).toBeUndefined();
  });

  test('computer sound is asked for with the screen and mixed with the voice into one track', async () => {
    const requests = [];
    const md = {
      getDisplayMedia: (c) => { requests.push(c); return Promise.resolve(new FakeStream([new FakeTrack('video'), new FakeTrack('audio')])); },
      getUserMedia: () => Promise.resolve(new FakeStream([new FakeTrack('audio')])),
    };
    const mixed = new FakeTrack('audio');
    const mix = vi.fn(() => ({ track: mixed, stop: vi.fn() }));
    const s = await getDisplayStreamWithMic({ recordAudio: true, selectedAudioSource: 'default', audioSettings: { ...AUDIO_DEFAULTS, systemAudio: true }, mix }, md, FakeStream);
    expect(requests[0].audio).toBe(true);
    expect(mix).toHaveBeenCalledWith([expect.any(FakeTrack), expect.any(FakeTrack)]);
    expect(s.getAudioTracks()).toEqual([mixed]);
    expect(s.sourceTracks).toHaveLength(2);
  });

  test('without computer sound, the screen is asked for silently and the mic is used as is', async () => {
    const requests = [];
    const md = {
      getDisplayMedia: (c) => { requests.push(c); return Promise.resolve(new FakeStream([new FakeTrack('video')])); },
      getUserMedia: () => Promise.resolve(new FakeStream([new FakeTrack('audio')])),
    };
    const s = await getDisplayStreamWithMic({ recordAudio: true, audioSettings: AUDIO_DEFAULTS, mix: vi.fn() }, md, FakeStream);
    expect(requests[0].audio).toBe(false);
    expect(s.getAudioTracks()).toHaveLength(1);
  });

  test('mixing one track is a no-op; two go through one destination', () => {
    const one = new FakeTrack('audio');
    expect(mixAudioTracks([one, null]).track).toBe(one);
    globalThis.MediaStream = FakeStream;
    const { Ctx, made } = fakeAudioCtx();
    const out = mixAudioTracks([new FakeTrack('audio'), new FakeTrack('audio')], { AudioCtx: Ctx });
    expect(made.sources).toHaveLength(2);
    expect(out.track.kind).toBe('audio');
    out.stop();
    expect(made.closed).toBe(1);
  });
});

describe('level meter', () => {
  test('silence is 0, loud is near 1, and the hint says so', () => {
    expect(levelFromSamples(new Uint8Array(64).fill(128))).toBe(0);
    expect(levelFromSamples(new Uint8Array(64).fill(255))).toBe(1);
    expect(levelHint(0.01)).toMatch(/No sound/);
    expect(levelHint(0.5)).toBe('');
    // Loud but clean speech is fine; only distortion (samples at the limit) is "too loud".
    expect(levelHint(1)).toBe('');
    expect(levelHint(0.6, true)).toMatch(/Too loud/);
    expect(clipsInSamples(new Uint8Array([128, 200, 60]))).toBe(false);
    expect(clipsInSamples(new Uint8Array([128, 255, 60]))).toBe(true);
  });

  test('reports levels from the microphone and closes cleanly', () => {
    vi.useFakeTimers();
    try {
      globalThis.MediaStream = FakeStream;
      const { Ctx, made } = fakeAudioCtx(160);
      const onLevel = vi.fn();
      const stop = createLevelMeter(new FakeStream([new FakeTrack('audio')]), onLevel, { AudioCtx: Ctx });
      vi.advanceTimersByTime(200);
      expect(onLevel).toHaveBeenCalled();
      const [level, peak] = onLevel.mock.calls.at(-1);
      expect(level).toBeGreaterThan(0.5);
      expect(peak).toBeGreaterThanOrEqual(level);
      stop();
      const calls = onLevel.mock.calls.length;
      vi.advanceTimersByTime(200);
      expect(onLevel.mock.calls.length).toBe(calls);
      expect(made.closed).toBe(1);
    } finally { vi.useRealTimers(); }
  });

  test('without audio (no Web Audio or no mic track) it does nothing', () => {
    expect(createLevelMeter(new FakeStream([new FakeTrack('video')]), vi.fn(), { AudioCtx: fakeAudioCtx().Ctx })).toBeTypeOf('function');
    expect(createLevelMeter(new FakeStream([new FakeTrack('audio')]), vi.fn(), { AudioCtx: null })).toBeTypeOf('function');
  });

  test('the mic test records a few seconds and gives back the clip', async () => {
    vi.useFakeTimers();
    try {
      globalThis.MediaStream = FakeStream;
      FakeRecorder.all = [];
      class Rec extends FakeRecorder {
        stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice']) }); this.onstop?.(); }
      }
      const p = recordMicTest(new FakeStream([new FakeTrack('audio')]), 4000, { Recorder: Rec });
      expect(FakeRecorder.all[0].state).toBe('recording');
      vi.advanceTimersByTime(4000);
      const blob = await p;
      expect(blob.size).toBeGreaterThan(0);
    } finally { vi.useRealTimers(); }
  });
});

describe('countdown', () => {
  test('ticks 3, 2, 1 then resolves true', async () => {
    vi.useFakeTimers();
    try {
      const ticks = [];
      const c = createCountdown(3, { onTick: (n) => ticks.push(n) });
      vi.advanceTimersByTime(3000);
      await expect(c.promise).resolves.toBe(true);
      expect(ticks).toEqual([3, 2, 1]);
    } finally { vi.useRealTimers(); }
  });

  test('can be skipped or cancelled', async () => {
    const skipped = createCountdown(5);
    skipped.skip();
    await expect(skipped.promise).resolves.toBe(true);
    const cancelled = createCountdown(5);
    cancelled.cancel();
    cancelled.skip(); // too late: already settled
    await expect(cancelled.promise).resolves.toBe(false);
    await expect(createCountdown(0).promise).resolves.toBe(true);
  });
});
