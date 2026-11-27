// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { effectsSettings, effectsActive, needsSegmentation, backgroundSrc, compositeFrame, maskToImageData, loadEffects, saveEffects, applyCameraEffects, BUILTIN_BACKGROUNDS } from '../effects.js';
import { FakeStream, FakeTrack } from './fakes.js';

const fakeCtx = () => {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])),
    set: (t, k, v) => { calls.push([`set:${String(k)}`, v]); t[k] = v; return true; },
  });
  return { ctx, calls };
};
const frame = { videoWidth: 640, videoHeight: 360 };
const person = { width: 640, height: 360, id: 'person' };

describe('camera effects', () => {
  it('settings default to off and clamp values', () => {
    expect(effectsSettings()).toEqual({ mode: 'none', background: 'office', blur: 0.6, touchUp: 0, mirror: false });
    expect(effectsSettings({ mode: 'laser', touchUp: 9, blur: -1 })).toMatchObject({ mode: 'none', touchUp: 1, blur: 0 });
    expect(effectsActive(effectsSettings())).toBe(false);
    expect(effectsActive(effectsSettings({ mirror: true }))).toBe(true);
    expect(needsSegmentation(effectsSettings({ touchUp: 0.5 }))).toBe(false);
    expect(needsSegmentation(effectsSettings({ mode: 'blur' }))).toBe(true);
  });

  it('backgrounds: built-ins by id, uploaded images by data URL, anything else falls back', () => {
    expect(backgroundSrc('studio')).toBe('/recorder/backgrounds/studio.jpg');
    expect(backgroundSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(backgroundSrc('javascript:alert(1)')).toBe(BUILTIN_BACKGROUNDS[0].src);
  });

  it('blur draws a blurred frame under the person', () => {
    const { ctx, calls } = fakeCtx();
    compositeFrame(ctx, { frame, person, settings: effectsSettings({ mode: 'blur', blur: 1 }), width: 640, height: 360 });
    const filterAt = calls.findIndex(([k, v]) => k === 'set:filter' && /blur\(24px\)/.test(v));
    const frameAt = calls.findIndex(([k, img]) => k === 'drawImage' && img === frame);
    const personAt = calls.findIndex(([k, img]) => k === 'drawImage' && img === person);
    expect(filterAt).toBeGreaterThan(-1);
    expect(frameAt).toBeGreaterThan(filterAt);
    expect(personAt).toBeGreaterThan(frameAt);
  });

  it('a virtual background goes under the person; touch-up blends a softened copy; mirror flips', () => {
    const { ctx, calls } = fakeCtx();
    const bg = { naturalWidth: 1920, naturalHeight: 1080, id: 'bg' };
    compositeFrame(ctx, { frame, person, settings: effectsSettings({ mode: 'background', touchUp: 0.5, mirror: true }), backgroundImage: bg, width: 640, height: 360 });
    const draws = calls.filter(([k]) => k === 'drawImage').map(([, img]) => img.id || 'frame');
    expect(draws).toEqual(['bg', 'person', 'person']);
    expect(calls.some(([k, v]) => k === 'set:globalAlpha' && v > 0.25)).toBe(true);
    expect(calls.some(([k, a, b, c, d, e]) => k === 'setTransform' && a === -1 && e === 640)).toBe(true);
  });

  it('turns person confidence into a soft alpha mask', () => {
    class ID { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } }
    const m = maskToImageData(new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.9]), 3, 2, ID);
    expect(Array.from({ length: 6 }, (_, i) => m.data[i * 4 + 3])).toEqual([0, 0, 128, 255, 255, 255]);
  });

  it('remembers settings, but not a huge uploaded image', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    saveEffects(effectsSettings({ mode: 'blur', touchUp: 0.3 }), storage);
    expect(loadEffects(storage)).toMatchObject({ mode: 'blur', touchUp: 0.3 });
    saveEffects(effectsSettings({ mode: 'background', background: `data:image/png;base64,${'A'.repeat(2_000_000)}` }), storage);
    expect(loadEffects(storage).background).toBe('office');
  });

  it('with no effect on, the camera stream passes through untouched', async () => {
    const cam = new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]);
    const fx = await applyCameraEffects(cam, effectsSettings());
    expect(fx.stream).toBe(cam);
    expect(fx.passthrough).toBe(true);
    fx.stop();
    expect(cam.getTracks().every((t) => t.stopped)).toBe(true);
    const kept = new FakeStream([new FakeTrack('video')]);
    (await applyCameraEffects(kept, effectsSettings(), { keepSource: true })).stop();
    expect(kept.getTracks()[0].stopped).toBe(false);
  });
});
