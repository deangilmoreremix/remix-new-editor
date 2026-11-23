// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Live captions need a microphone and the Web Speech API: replaced by a controllable fake. Everything else in live.js stays real.
const live = vi.hoisted(() => ({ start: null }));
vi.mock('../live.js', async (orig) => ({ ...(await orig()), liveSpeechSupported: () => true, startLiveCaptions: (...a) => live.start(...a) }));

import { CaptionStudioModal } from '../modal.js';
import { burnWithRecorder } from '../burn.js';

const words = (...t) => t.map((text, i) => ({ text: (i ? ' ' : '') + text, startMs: i * 400, endMs: i * 400 + 400, timestampMs: i * 400 + 200, confidence: null }));
let modal;

beforeEach(() => {
  localStorage.clear();
  // jsdom has no canvas and no object URLs: the studio only needs them not to throw.
  const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (t) => ({ width: String(t).length * 10 }) : () => {}), set: () => true });
  HTMLCanvasElement.prototype.getContext = () => ctx;
  URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});
afterEach(() => { modal?.destroy(); modal = null; vi.useRealTimers(); document.body.innerHTML = ''; });

const open = (opts = {}) => { modal = new CaptionStudioModal(opts); modal.open(); return modal; };
const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };

describe('editing a line’s time', () => {
  it('applies a new start and end typed into the line editor (the row is .csm-lineedit)', () => {
    const m = open({ videoUrl: 'https://x/v.mp4', captions: words('hello', 'brave', 'new', 'world'), style: { combineMs: 5000 } });
    m.tab = 'edit'; m.editingLine = 0; m.refresh();
    const start = m.overlay.querySelector('[data-line-start="0"]');
    expect(start).not.toBeNull();
    change(start, '1.2');
    expect(m.captions[0].startMs).toBe(1200);
    expect(m.errMsg).toBe('');
    change(m.overlay.querySelector('[data-line-end="0"]'), '3.0');
    expect(m.captions.at(-1).endMs).toBe(3000);
  });
});

describe('a saved look and the host’s font list', () => {
  it('does not bring back a font the host does not allow', () => {
    localStorage.setItem('captionStudio:v1:https://x/v.mp4', JSON.stringify({ captions: words('hi', 'there'), style: { fontFamily: 'Anton', preset: 'capite-hormozi' } }));
    const m = new CaptionStudioModal({ videoUrl: 'https://x/v.mp4', fonts: ['Inter'] });
    expect(m.captions).toHaveLength(2); // it was restored
    expect(m.style.fontFamily).toBe('Inter'); // but not in the old font
  });
  it('still restores the saved font when the host gives no list', () => {
    localStorage.setItem('captionStudio:v1:https://x/v.mp4', JSON.stringify({ captions: words('hi'), style: { fontFamily: 'Anton' } }));
    expect(new CaptionStudioModal({ videoUrl: 'https://x/v.mp4' }).style.fontFamily).toBe('Anton');
  });
});

describe('cancelling and declining', () => {
  it('a cancel ends the busy state without an error', () => {
    const m = open();
    m.busy = { text: 'Reading audio…', progress: 0, kind: 'transcribe' };
    m.fail(Object.assign(new Error('Transcription cancelled'), { name: 'AbortError' }));
    expect(m.busy).toBeNull();
    expect(m.errMsg).toBe('');
    expect(m.note).toBe('');
  });
  it('a declined speech-model download ends the busy state and says what happened', () => {
    const m = open();
    m.busy = { text: 'Reading audio…', progress: 0, kind: 'transcribe' };
    m.fail(Object.assign(new Error('Model download declined'), { name: 'AbortError' }));
    expect(m.busy).toBeNull();
    expect(m.note).toMatch(/model was not downloaded/i);
    expect(m.overlay.querySelector('.csm-bar')).toBeNull(); // no stuck progress bar
  });
  it('a real error still shows', () => {
    const m = open();
    m.fail(new Error('boom'));
    expect(m.errMsg).toBe('boom');
  });
});

describe('live captions: pressing Stop while the recogniser is still starting', () => {
  it('stops cleanly, with no error and no recogniser left running', async () => {
    const tracks = [{ stop: vi.fn() }];
    navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) };
    globalThis.MediaRecorder = class { constructor() { this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.onstop?.(); } };
    let release; const handle = { stop: vi.fn() };
    live.start = () => new Promise((res) => { release = () => res(handle); });
    const m = open();
    const started = m.liveStart();
    await vi.waitFor(() => expect(m.live).not.toBeNull());
    m.liveStop(); // the recogniser has not come back yet
    expect(m.live).toBeNull();
    release();
    await started;
    expect(m.errMsg).toBe(''); // previously: TypeError "Cannot set properties of null"
    expect(handle.stop).toHaveBeenCalledTimes(1); // the late recogniser is stopped, not left listening
    expect(tracks[0].stop).toHaveBeenCalled();
  });
});

describe('rendering by recording: the wait for the video to open', () => {
  const setup = () => {
    globalThis.MediaRecorder = class { static isTypeSupported() { return false; } };
    HTMLCanvasElement.prototype.captureStream = vi.fn();
  };
  it('can be cancelled, and frees the temporary video URL', async () => {
    setup();
    const ctl = new AbortController();
    const run = burnWithRecorder({ src: new Blob(['x']), captions: [], style: {}, signal: ctl.signal });
    setTimeout(() => ctl.abort(), 20);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
  it('gives up instead of hanging when the video never opens', async () => {
    setup();
    vi.useFakeTimers();
    const run = burnWithRecorder({ src: new Blob(['x']), captions: [], style: {} });
    const assertion = expect(run).rejects.toThrow(/Timed out opening this video/);
    await vi.advanceTimersByTimeAsync(20001);
    await assertion;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
