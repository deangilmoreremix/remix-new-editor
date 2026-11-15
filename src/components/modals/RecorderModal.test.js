// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RecorderModal } from './RecorderModal.jsx';

// Minimal fakes for the browser capture APIs, which jsdom does not provide.
class FakeTrack {
  constructor(kind) { this.kind = kind; this.stopped = false; this.onended = null; FakeTrack.all.push(this); }
  stop() { this.stopped = true; }
  clone() { return new FakeTrack(this.kind); }
}
FakeTrack.all = [];
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
}
class FakeRecorder {
  static isTypeSupported() { return true; }
  constructor(stream, opts) { this.stream = stream; this.opts = opts; this.state = 'inactive'; FakeRecorder.all.push(this); }
  start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob(['x']) }); }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.onstop?.(); }
}
FakeRecorder.all = [];

let streams;
function installMedia({ micDenied = false } = {}) {
  streams = [];
  const get = (stream) => { streams.push(stream); return Promise.resolve(stream); };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: () => Promise.resolve([]),
      getDisplayMedia: () => get(new FakeStream([new FakeTrack('video')])),
      getUserMedia: (c) => {
        if (c.audio && !c.video && micDenied) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
        const tracks = [];
        if (c.video) tracks.push(new FakeTrack('video'));
        if (c.audio) tracks.push(new FakeTrack('audio'));
        return get(new FakeStream(tracks));
      },
    },
  });
}

function makeModal(type) {
  const onComplete = vi.fn();
  const modal = new RecorderModal({ onComplete });
  modal.recordingType = type;
  // Skip the real overlay and the canvas draw loop; only the capture logic is under test.
  modal.updateBody = () => {};
  modal.setupEventListeners = () => {};
  modal.overlay = document.createElement('div');
  modal.composeScreenAndCam = (screen, cam) => new FakeStream([new FakeTrack('video')]);
  modal.close = () => {};
  return { modal, onComplete };
}

beforeEach(() => {
  FakeRecorder.all = [];
  FakeTrack.all = [];
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.MediaStream = FakeStream;
  installMedia();
});

describe('RecorderModal Camera / Screen / Both', () => {
  test('exposes Screen, Camera, Both and Audio modes', () => {
    const { modal } = makeModal('screen');
    const html = modal.renderBody();
    for (const label of ['Screen', 'Camera', 'Both', 'Audio']) expect(html).toContain(`>${label}<`);
  });

  test.each(['screen', 'camera'])('%s mode records one file with microphone audio', async (type) => {
    const { modal } = makeModal(type);
    await modal.startRecording();
    expect(modal.isRecording).toBe(true);
    expect(FakeRecorder.all).toHaveLength(1);
    expect(modal.mediaRecorder.stream.getAudioTracks()).toHaveLength(1);
    expect(modal.hasAudio).toBe(true);
    modal.stopRecording();
    modal.useRecording();
  });

  test('both mode composites one video and also keeps separate screen and camera files', async () => {
    const { modal, onComplete } = makeModal('both');
    await modal.startRecording();
    // main composite + screen + camera
    expect(FakeRecorder.all).toHaveLength(3);
    modal.stopRecording();
    modal.useRecording();
    const result = onComplete.mock.calls[0][0];
    expect(result.type).toBe('both');
    expect(result.hasAudio).toBe(true);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(Object.keys(result.tracks).sort()).toEqual(['camera', 'screen']);
  });

  test('microphone off records without audio', async () => {
    const { modal } = makeModal('camera');
    modal.micEnabled = false;
    await modal.startRecording();
    expect(modal.hasAudio).toBe(false);
  });

  test('a refused microphone still records and tells the user', async () => {
    installMedia({ micDenied: true });
    const { modal } = makeModal('screen');
    await modal.startRecording();
    expect(modal.isRecording).toBe(true);
    expect(modal.hasAudio).toBe(false);
    expect(modal.notice).toMatch(/Microphone/);
  });

  test('pause and resume apply to every recorder', async () => {
    const { modal } = makeModal('both');
    await modal.startRecording();
    modal.pauseRecording();
    expect(FakeRecorder.all.every(r => r.state === 'paused')).toBe(true);
    modal.resumeRecording();
    expect(FakeRecorder.all.every(r => r.state === 'recording')).toBe(true);
  });

  test('closing mid-take releases every camera, screen and mic track', async () => {
    const { modal } = makeModal('both');
    await modal.startRecording();
    modal.destroy();
    // Every track ever created, including the clones handed to MediaRecorder.
    expect(FakeTrack.all.length).toBeGreaterThan(0);
    expect(FakeTrack.all.filter(t => !t.stopped)).toEqual([]);
    expect(FakeRecorder.all.every(r => r.state === 'inactive')).toBe(true);
  });
});
