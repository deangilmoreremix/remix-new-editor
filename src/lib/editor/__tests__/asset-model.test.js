import {
  normalizeAsset,
  isAssetValid,
  createGeneratedAsset,
  createTextAsset,
  createCaptionAsset,
  createOverlayAsset,
  createInteractiveAsset,
  createRecordingAsset,
  fromLegacyAsset,
  ASSET_TYPES,
  ASSET_LIFECYCLE,
} from '../assetModel.js';

describe('Unified Asset Model (Phase 3)', () => {
  test('normalizeAsset fills the full required metadata schema', () => {
    const a = normalizeAsset({ type: 'video', name: 'Clip', duration: 10, url: 'https://x/v.mp4' });
    expect(a.id).toBeTruthy();
    expect(a.type).toBe('video');
    expect(a.name).toBe('Clip');
    expect(a.source).toBe('upload');
    expect(a.url).toBe('https://x/v.mp4');
    expect(a.duration).toBe(10);
    expect(a.width).toBeNull();
    expect(a.height).toBeNull();
    expect(a.fps).toBeNull();
    expect(a.codec).toBeNull();
    expect(a.mimeType).toBeNull();
    expect(a.provider).toBeNull();
    expect(a.model).toBeNull();
    expect(a.prompt).toBeNull();
    expect(a.generationJobId).toBeNull();
    expect(a.createdAt).toBeTruthy();
    expect(a.metadata).toBeDefined();
  });

  test('unknown type falls back to video rather than crashing', () => {
    const a = normalizeAsset({ type: 'bogus' });
    expect(ASSET_TYPES).not.toContain('bogus');
    expect(a.type).toBe('video');
  });

  test('isAssetValid enforces type + id', () => {
    expect(isAssetValid(normalizeAsset({ type: 'image', name: 'i' }))).toBe(true);
    expect(isAssetValid({ type: 'video' })).toBe(false);
    expect(isAssetValid({ id: 'x', type: 'nope' })).toBe(false);
  });

  test('createGeneratedAsset captures provider/model/prompt and negative seed', () => {
    const a = createGeneratedAsset({
      provider: 'seedance',
      model: 'seedance-1.0',
      prompt: 'a cat on a roof',
      type: 'generated-video',
      url: 'https://x/g.mp4',
      duration: 6,
      negativePrompt: 'blurry',
      seed: 42,
      aspectRatio: '16:9',
    });
    expect(a.type).toBe('generated-video');
    expect(a.source).toBe('ai-generation');
    expect(a.provider).toBe('seedance');
    expect(a.model).toBe('seedance-1.0');
    expect(a.prompt).toBe('a cat on a roof');
    expect(a.metadata.negativePrompt).toBe('blurry');
    expect(a.metadata.seed).toBe(42);
    expect(a.metadata.aspectRatio).toBe('16:9');
  });

  test('createTextAsset / createCaptionAsset keep content in metadata', () => {
    expect(createTextAsset({ text: 'Hello' }).metadata.text).toBe('Hello');
    expect(createCaptionAsset({ text: 'Sub' }).type).toBe('caption');
  });

  test('createOverlayAsset / createInteractiveAsset set proper types', () => {
    expect(createOverlayAsset({ kind: 'lower-third' }).type).toBe('lower-third');
    expect(createInteractiveAsset({ formConfig: { fields: ['email'] } }).type).toBe('interactive');
  });

  test('createRecordingAsset infers type from mode', () => {
    expect(createRecordingAsset({ mode: 'screen' }).type).toBe('screen-recording');
    expect(createRecordingAsset({ mode: 'audio' }).type).toBe('audio');
    expect(createRecordingAsset({ mode: 'camera' }).type).toBe('recording');
  });

  test('fromLegacyAsset maps the legacy editor asset shape', () => {
    const a = fromLegacyAsset({ id: 'legacy-1', type: 'image', name: 'Pic', url: 'p.png', duration: 3 });
    expect(a.id).toBe('legacy-1');
    expect(a.type).toBe('image');
    expect(a.url).toBe('p.png');
    expect(a.source).toBe('media-library');
  });

  test('ASSET_LIFECYCLE exposes every required lifecycle action', () => {
    expect(Object.values(ASSET_LIFECYCLE)).toEqual(
      expect.arrayContaining(['preview', 'addToMediaLibrary', 'addToTimeline', 'save', 'reload', 'reuse']),
    );
  });
});
