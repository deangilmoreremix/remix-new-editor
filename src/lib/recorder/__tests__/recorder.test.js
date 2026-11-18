// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { findGoodSupportedCodec, getExtension } from '../codec.js';
import { createFileStorage } from '../fileStorage.js';
import { startMediaRecorder, SAVE_EVERY_MS, MEDIA_RECORDER_OPTIONS } from '../startRecorder.js';
import { startSession, takeBlobs, releaseTakes, FPS } from '../session.js';
import { getAudioStreamConstraints, getCameraStreamConstraints, getDisplayStreamWithMic } from '../streams.js';
import { FakeTrack, FakeStream, FakeRecorder, fakeOpfs, blobText } from './fakes.js';

beforeEach(() => { FakeRecorder.all = []; FakeTrack.all = []; });

describe('codec choice (Recorder: MP4 first, then WebM)', () => {
  it('prefers MP4 and falls back to WebM', () => {
    expect(findGoodSupportedCodec(true, { Recorder: FakeRecorder })).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    const WebmOnly = { isTypeSupported: (t) => t.startsWith('video/webm') };
    expect(findGoodSupportedCodec(true, { Recorder: WebmOnly })).toBe('video/webm;codecs=vp8,opus');
    expect(findGoodSupportedCodec(false, { Recorder: WebmOnly })).toBe('video/webm;codecs=vp8');
    expect(() => findGoodSupportedCodec(true, { Recorder: { isTypeSupported: () => false } })).toThrow(/No supported codec/);
    expect(findGoodSupportedCodec(true, { audioOnly: true, Recorder: FakeRecorder })).toBe('audio/webm;codecs=opus');
    expect(getExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(getExtension('video/webm;codecs=vp8')).toBe('webm');
  });
});

describe('stream constraints (exact device ids)', () => {
  it('pins the chosen camera and microphone', () => {
    expect(getAudioStreamConstraints({ recordAudio: true, selectedAudioSource: 'mic-2' })).toEqual({ deviceId: { exact: 'mic-2' } });
    expect(getAudioStreamConstraints({ recordAudio: true, selectedAudioSource: 'default' })).toBe(true);
    expect(getAudioStreamConstraints({ recordAudio: false, selectedAudioSource: 'mic-2' })).toBeUndefined();
    expect(getCameraStreamConstraints({ deviceId: 'cam-1', maxWidth: 1920 })).toMatchObject({ deviceId: { exact: 'cam-1' }, width: { ideal: 1920 }, frameRate: { ideal: 30 } });
    expect(getCameraStreamConstraints({ deviceId: 'default' })).not.toHaveProperty('deviceId');
  });

  it('adds the microphone to a screen stream that has none', async () => {
    const md = {
      getDisplayMedia: async () => new FakeStream([new FakeTrack('video')]),
      getUserMedia: async (c) => { expect(c).toEqual({ audio: { deviceId: { exact: 'mic-2' } } }); return new FakeStream([new FakeTrack('audio')]); },
    };
    const s = await getDisplayStreamWithMic({ recordAudio: true, selectedAudioSource: 'mic-2' }, md, FakeStream);
    expect(s.getVideoTracks()).toHaveLength(1);
    expect(s.getAudioTracks()).toHaveLength(1);
  });
});

describe('file storage', () => {
  it('writes to OPFS and removes the file on release', async () => {
    const { storage, files } = fakeOpfs();
    const w = await createFileStorage('webcam1.mp4', 'video/mp4', { storage });
    expect(w.kind).toBe('opfs');
    await w.write(new Blob(['ab']));
    await w.write(new Blob(['cd']));
    const blob = await w.save();
    expect(blob.type).toBe('video/mp4');
    expect(await blobText(blob)).toBe('abcd');
    await w.release();
    expect(files.has('webcam1.mp4')).toBe(false);
  });

  it('falls back to memory without OPFS', async () => {
    const w = await createFileStorage('x.webm', 'video/webm', { storage: undefined });
    expect(w.kind).toBe('memory');
    await w.write(new Blob(['hi']));
    expect(await blobText(await w.save())).toBe('hi');
    expect(w.getBytesWritten()).toBe(2);
  });
});

describe('per-source recorder (start-media-recorder)', () => {
  it('uses Recorder\'s settings, saves as it goes, and keeps the last chunk', async () => {
    const stream = new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]);
    const r = await startMediaRecorder({ prefix: 'webcam', timestamp: 1, stream, Recorder: FakeRecorder, storage: undefined });
    const rec = FakeRecorder.all[0];
    expect(rec.timeslice).toBe(SAVE_EVERY_MS);
    expect(rec.options).toMatchObject({ ...MEDIA_RECORDER_OPTIONS, mimeType: 'video/mp4;codecs=avc1,mp4a.40.2' });
    rec.flush('a');
    const take = await r.stopAndWaitUntilDone();
    expect(take.prefix).toBe('webcam');
    expect(await blobText(await take.data())).toBe('aend');
    expect(r.stopAndWaitUntilDone()).toBe(r.stopAndWaitUntilDone()); // stopping twice is safe
  });

  it('stops by itself when a track ends', async () => {
    const video = new FakeTrack('video');
    await startMediaRecorder({ prefix: 'display', timestamp: 1, stream: new FakeStream([video]), Recorder: FakeRecorder });
    video.end();
    expect(FakeRecorder.all[0].state).toBe('inactive');
  });
});

describe('session (record-button start/stop)', () => {
  it('records each source to its own file and stops them together', async () => {
    let t = 1000;
    const s = await startSession([
      { prefix: 'webcam', stream: new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]) },
      { prefix: 'display', stream: new FakeStream([new FakeTrack('video')]) },
    ], { Recorder: FakeRecorder, now: () => t });
    expect(FakeRecorder.all).toHaveLength(2);
    expect(FakeRecorder.all[1].options.mimeType).toBe('video/mp4;codecs=avc1'); // screen without sound
    s.pause();
    expect(FakeRecorder.all.every(r => r.state === 'paused')).toBe(true);
    s.resume();
    t = 3000;
    const result = await s.stop();
    expect(result.expectedFrames).toBe(2 * FPS);
    const blobs = await takeBlobs(result);
    expect(Object.keys(blobs).sort()).toEqual(['display', 'webcam']);
    await releaseTakes(result);
    expect(s.stop()).toBe(s.stop());
  });
});
