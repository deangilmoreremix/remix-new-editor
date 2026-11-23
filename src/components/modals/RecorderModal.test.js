// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FakeTrack, FakeStream, FakeRecorder } from '../../lib/recorder/__tests__/fakes.js';

// Combining a Both take renders video in the browser (WebCodecs); jsdom can't, so it is faked here
// and checked for real in a browser run.
const composeBoth = vi.fn(async () => ({ blob: new Blob(['combined'], { type: 'video/mp4' }), mimeType: 'video/mp4' }));
vi.mock('../../lib/recorder/composeBoth.jsx', () => ({ composeBoth: (...a) => composeBoth(...a) }));
const { RecorderModal } = await import('./RecorderModal.jsx');

let requests;
function installMedia({ micDenied = false } = {}) {
  requests = [];
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: () => Promise.resolve([]),
      getDisplayMedia: (c) => { requests.push(['display', c]); return Promise.resolve(new FakeStream([new FakeTrack('video')])); },
      getUserMedia: (c) => {
        requests.push(['user', c]);
        if (c.audio && !c.video && micDenied) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
        const tracks = [];
        if (c.video) tracks.push(new FakeTrack('video'));
        if (c.audio) tracks.push(new FakeTrack('audio'));
        return Promise.resolve(new FakeStream(tracks));
      },
    },
  });
}

function makeModal(type) {
  const onComplete = vi.fn();
  const modal = new RecorderModal({ onComplete });
  modal.recordingType = type;
  // Only the capture logic is under test, not the modal chrome.
  modal.updateBody = () => {};
  modal.setupEventListeners = () => {};
  modal.overlay = document.createElement('div');
  modal.close = () => {};
  return { modal, onComplete };
}

beforeEach(() => {
  FakeRecorder.all = [];
  FakeTrack.all = [];
  composeBoth.mockClear();
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.MediaStream = FakeStream;
  installMedia();
});

describe('RecorderModal on the Remotion Recorder engine', () => {
  test('exposes Screen, Camera, Both and Audio modes', () => {
    const { modal } = makeModal('screen');
    const html = modal.renderBody();
    for (const label of ['Screen', 'Camera', 'Both', 'Audio']) expect(html).toContain(`>${label}<`);
  });

  test('camera mode records one file with the microphone, from one getUserMedia call', async () => {
    const { modal, onComplete } = makeModal('camera');
    await modal.startRecording();
    expect(modal.isRecording).toBe(true);
    expect(FakeRecorder.all).toHaveLength(1);
    expect(FakeRecorder.all[0].stream.getAudioTracks()).toHaveLength(1);
    await modal.stopRecording();
    modal.useRecording();
    const result = onComplete.mock.calls[0][0];
    expect(result).toMatchObject({ type: 'camera', hasAudio: true, tracks: {} });
    expect(result.blob).toBeInstanceOf(Blob);
  });

  test('screen mode adds the microphone to the screen stream', async () => {
    const { modal } = makeModal('screen');
    await modal.startRecording();
    expect(requests.map(r => r[0])).toEqual(['display', 'user']);
    expect(FakeRecorder.all[0].stream.getVideoTracks()).toHaveLength(1);
    expect(FakeRecorder.all[0].stream.getAudioTracks()).toHaveLength(1);
  });

  test('both mode records camera and screen as separate files, then combines them', async () => {
    const { modal, onComplete } = makeModal('both');
    modal.camShape = 'rounded';
    await modal.startRecording();
    expect(FakeRecorder.all).toHaveLength(2);
    // The microphone rides on the camera take; the screen take is silent.
    expect(FakeRecorder.all[0].stream.getAudioTracks()).toHaveLength(1);
    expect(FakeRecorder.all[1].stream.getAudioTracks()).toHaveLength(0);
    await modal.stopRecording();
    expect(composeBoth).toHaveBeenCalledWith(expect.objectContaining({ shape: 'rounded', screen: expect.any(Blob), camera: expect.any(Blob) }));
    modal.useRecording();
    const result = onComplete.mock.calls[0][0];
    expect(result.type).toBe('both');
    expect(result.blob.type).toBe('video/mp4');
    expect(Object.keys(result.tracks).sort()).toEqual(['camera', 'screen']);
  });

  test('if combining fails, the camera take (with the voice) is used and the user is told', async () => {
    composeBoth.mockRejectedValueOnce(new Error('This browser cannot combine screen and camera into one video.'));
    const { modal } = makeModal('both');
    await modal.startRecording();
    await modal.stopRecording();
    expect(modal.recordedBlob).toBe(modal.trackBlobs.camera);
    expect(modal.notice).toMatch(/cannot combine/);
  });

  test('microphone off records without audio', async () => {
    const { modal } = makeModal('camera');
    modal.micEnabled = false;
    await modal.startRecording();
    expect(modal.hasAudio).toBe(false);
  });

  test('pause and resume apply to every source', async () => {
    const { modal } = makeModal('both');
    await modal.startRecording();
    modal.pauseRecording();
    expect(FakeRecorder.all.every(r => r.state === 'paused')).toBe(true);
    modal.resumeRecording();
    expect(FakeRecorder.all.every(r => r.state === 'recording')).toBe(true);
  });

  test('a refused permission is reported and leaves nothing running', async () => {
    installMedia({ micDenied: true });
    const { modal } = makeModal('audio');
    await modal.startRecording();
    expect(modal.isRecording).toBe(false);
    expect(modal.notice).toMatch(/Permission was denied/);
  });

  test('a blocked camera says how to allow it, and the screen is kept awake only during the take', async () => {
    installMedia();
    const wake = { release: vi.fn(async () => {}) };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn(async () => wake) } });
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async ({ name }) => ({ state: name === 'camera' ? 'denied' : 'granted', addEventListener() {}, removeEventListener() {} }) } });
    const { modal } = makeModal('camera');
    await modal.startRecording();
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    await modal.stopRecording();
    expect(wake.release).toHaveBeenCalled();
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    const { modal: second } = makeModal('camera');
    await second.startRecording();
    expect(second.notice).toMatch(/^Camera is blocked for .*Click the camera or lock icon/);
    delete navigator.wakeLock; delete navigator.permissions;
  });

  test('closing mid-take stops every camera, screen and mic track', async () => {
    const { modal } = makeModal('both');
    await modal.startRecording();
    modal.destroy();
    expect(FakeTrack.all.length).toBeGreaterThan(0);
    expect(FakeTrack.all.filter(t => !t.stopped)).toEqual([]);
    expect(FakeRecorder.all.every(r => r.state === 'inactive')).toBe(true);
  });

  test('in the real modal, one click starts one take and the mic toggle flips once', async () => {
    const modal = new RecorderModal({ onComplete: vi.fn() });
    modal.open();
    const click = (sel) => modal.overlay.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    click('.type-btn[data-type="camera"]');
    click('[data-action="toggle-mic"]');
    expect(modal.micEnabled).toBe(false);
    click('[data-action="toggle-mic"]');
    expect(modal.micEnabled).toBe(true);
    click('[data-action="start"]');
    await vi.waitFor(() => expect(modal.isRecording).toBe(true));
    expect(FakeRecorder.all).toHaveLength(1);
    modal.destroy();
  });

  test('Delete throws the take away; Restart records again', async () => {
    const { modal, onComplete } = makeModal('camera');
    await modal.startRecording();
    await modal.discardTake();
    expect(modal.isRecording).toBe(false);
    expect(modal.recordedBlob).toBe(null);
    // The recorded camera and mic are released (the live preview comes back on its own).
    expect(FakeRecorder.all[0].stream.getTracks().every((t) => t.stopped)).toBe(true);
    await modal.startRecording();
    const before = FakeRecorder.all.length;
    await modal.discardTake({ restart: true });
    expect(modal.isRecording).toBe(true);
    expect(FakeRecorder.all.length).toBe(before + 1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  test('Spotlight times are passed to the Both combine', async () => {
    const { modal } = makeModal('both');
    await modal.startRecording();
    modal.toggleSpotlight();
    modal.toggleSpotlight();
    expect(modal.spotlights).toHaveLength(1);
    expect(modal.spotlights[0].end).toBeGreaterThanOrEqual(modal.spotlights[0].start);
    modal.toggleSpotlight(); // left on: closed at stop
    await modal.stopRecording();
    const args = composeBoth.mock.calls[0][0];
    expect(args.spotlights).toHaveLength(2);
    expect(args.spotlights[1].end).not.toBeNull();
  });

  test('the teleprompter works in Screen mode too, and can float over other windows', async () => {
    const { modal } = makeModal('screen');
    modal.prompter = { ...modal.prompter, on: true, script: 'Hi there\nThis is the demo' };
    const html = modal.renderBody();
    expect(html).toContain('data-action="toggle-prompter"');
    expect(html).toContain('data-teleprompter');
    const doc = document.implementation.createHTMLDocument('pip');
    const win = { document: doc, addEventListener: vi.fn(), close: vi.fn() };
    window.documentPictureInPicture = { requestWindow: vi.fn(async () => win) };
    try {
      modal.rerender = () => {};
      await modal.openPrompterWindow();
      expect(window.documentPictureInPicture.requestWindow).toHaveBeenCalled();
      expect(doc.querySelector('[data-teleprompter-window] .tp-line').textContent).toBe('Hi there');
      modal.closePrompterWindow();
      expect(win.close).toHaveBeenCalled();
      expect(modal.pipWin).toBeNull();
    } finally { delete window.documentPictureInPicture; }
  });
});
