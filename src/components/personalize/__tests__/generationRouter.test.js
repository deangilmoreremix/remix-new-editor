/**
 * generationRouter.test.js
 *
 * Verifies that `runGeneration` routes to the right MuAPI operation
 * for each personalization mode. Mocks the `muapi` client module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the muapi singleton BEFORE importing the router so the router
// captures the mocked methods at module-load time.
const muapiMock = {
  generateImage: vi.fn(),
  generateI2I: vi.fn(),
  generateVideo: vi.fn(),
  generateI2V: vi.fn(),
  processV2V: vi.fn(),
  processLipSync: vi.fn(),
  uploadFile: vi.fn(),
};

vi.mock('../../../lib/muapi.js', () => ({
  muapi: muapiMock,
}));

// Now import the router.
const { runGeneration } = await import('../generationRouter.js');

const baseSource = {
  sourceType: 'landing-demo',
  id: 'demo-1',
  title: 'Demo',
  mediaType: 'video',
  sourceMedia: 'https://example.com/source.mp4',
  poster: null,
  shortPrompt: 'p',
  fullPrompt: 'p',
  originalPrompt: 'p',
  aspectRatio: '16:9',
  sourceMetadata: {},
};

const baseImageSource = {
  ...baseSource,
  sourceType: 'image-demo',
  mediaType: 'image',
  sourceMedia: 'https://example.com/source.png',
};

const baseAssets = {
  identities: [
    {
      id: 'i1',
      role: 'presenter_identity',
      name: 'presenter',
      url: 'blob:fake',
      uploadedUrl: 'https://example.com/face.png',
      isPrimary: true,
      uploadStatus: 'ready',
    },
  ],
  primaryIdentity: {
    id: 'i1',
    role: 'presenter_identity',
    name: 'presenter',
    url: 'blob:fake',
    uploadedUrl: 'https://example.com/face.png',
    isPrimary: true,
    uploadStatus: 'ready',
  },
  logos: [],
  primaryLogo: null,
  products: [],
  brandReferences: [],
  firstFrame: null,
  lastFrame: null,
  ctaGraphic: null,
  audio: [],
  savedReferences: [],
};

const baseResolved = {
  directInputs: { image_url: 'https://example.com/face.png', video_url: 'https://example.com/source.mp4' },
  promptContext: {},
  preProcessing: {},
  postProcessing: {},
  unusedSavedReferences: [],
};

const imageResolved = {
  directInputs: { image_url: 'https://example.com/face.png' },
  promptContext: {},
  preProcessing: {},
  postProcessing: {},
  unusedSavedReferences: [],
};

const baseOptions = {
  engine: 'smartvideo-recommended',
  preserveAudio: true,
  exactLogoHandling: 'final-overlay',
  exactCtaHandling: 'final-end-card',
  firstFrameMode: 'none',
  lastFrameMode: 'none',
  consentGiven: false,
};

beforeEach(() => {
  Object.values(muapiMock).forEach((fn) => fn.mockReset());
  muapiMock.processV2V.mockResolvedValue({ url: 'https://example.com/out.mp4' });
  muapiMock.generateImage.mockResolvedValue({ url: 'https://example.com/out.png' });
  muapiMock.generateI2I.mockResolvedValue({ url: 'https://example.com/out.png' });
  muapiMock.generateVideo.mockResolvedValue({ url: 'https://example.com/out.mp4' });
  muapiMock.generateI2V.mockResolvedValue({ url: 'https://example.com/out.mp4' });
});

describe('runGeneration — image source', () => {
  it('returns a prompt for prompt-only sources', async () => {
    const r = await runGeneration({
      source: { ...baseSource, mediaType: 'prompt-only' },
      client: {},
      assets: baseAssets,
      resolved: { directInputs: {}, promptContext: {}, preProcessing: {}, postProcessing: {}, unusedSavedReferences: [] },
      prompt: 'hello',
      mode: null,
      options: baseOptions,
      apiKey: 'k',
    });
    expect(r.type).toBe('prompt');
    expect(r.prompt).toBe('hello');
  });

  it('routes keep_design to generateI2I', async () => {
    await runGeneration({
      source: baseImageSource,
      client: {},
      assets: baseAssets,
      resolved: imageResolved,
      prompt: 'a portrait',
      mode: 'keep_design',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateI2I).toHaveBeenCalledTimes(1);
    expect(muapiMock.generateImage).not.toHaveBeenCalled();
    const call = muapiMock.generateI2I.mock.calls[0][0];
    expect(call.model).toBe('gpt-image-2-edit');
    expect(call.image_url).toBe('https://example.com/face.png');
    expect(call.studioType).toBe('personalize-i2i');
  });

  it('routes replace_face to generateI2I', async () => {
    await runGeneration({
      source: baseImageSource,
      client: {},
      assets: baseAssets,
      resolved: imageResolved,
      prompt: 'a portrait',
      mode: 'replace_face',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateI2I).toHaveBeenCalledTimes(1);
  });

  it('routes replace_person to generateI2I', async () => {
    await runGeneration({
      source: baseImageSource,
      client: {},
      assets: baseAssets,
      resolved: imageResolved,
      prompt: 'a portrait',
      mode: 'replace_person',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateI2I).toHaveBeenCalledTimes(1);
  });

  it('routes recreate to generateImage (T2I)', async () => {
    await runGeneration({
      source: baseImageSource,
      client: {},
      assets: baseAssets,
      resolved: imageResolved,
      prompt: 'a portrait',
      mode: 'recreate',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateImage).toHaveBeenCalledTimes(1);
    expect(muapiMock.generateI2I).not.toHaveBeenCalled();
    const call = muapiMock.generateImage.mock.calls[0][0];
    expect(call.studioType).toBe('personalize-t2i');
  });

  it('throws when image source is missing for keep_design', async () => {
    await expect(
      runGeneration({
        source: { ...baseImageSource, sourceMedia: null },
        client: {},
        assets: { ...baseAssets, primaryIdentity: null },
        resolved: { directInputs: {}, promptContext: {}, preProcessing: {}, postProcessing: {}, unusedSavedReferences: [] },
        prompt: 'a portrait',
        mode: 'keep_design',
        options: baseOptions,
        apiKey: 'k',
      }),
    ).rejects.toThrow(/No source image/);
  });
});

describe('runGeneration — video source', () => {
  it('routes face_only to muapi.processV2V (face swap)', async () => {
    await runGeneration({
      source: baseSource,
      client: {},
      assets: baseAssets,
      resolved: baseResolved,
      prompt: 'face',
      mode: 'face_only',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.processV2V).toHaveBeenCalledTimes(1);
    const call = muapiMock.processV2V.mock.calls[0][0];
    expect(call.model).toBe('ai-video-face-swap');
    expect(call.video_url).toBe('https://example.com/source.mp4');
    expect(call.image_url).toBe('https://example.com/face.png');
    expect(call.studioType).toBe('personalize-faceswap');
  });

  it('routes full_body to processRecast (shim → processV2V)', async () => {
    await runGeneration({
      source: baseSource,
      client: {},
      assets: baseAssets,
      resolved: baseResolved,
      prompt: 'replace body',
      mode: 'full_body',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.processV2V).toHaveBeenCalledTimes(1);
    const call = muapiMock.processV2V.mock.calls[0][0];
    expect(call.model).toBe('kling-v3.0-pro-recast');
    expect(call.studioType).toBe('personalize-recast');
  });

  it('routes recreate (no source video) to generateI2V', async () => {
    await runGeneration({
      source: { ...baseSource, sourceMedia: null },
      client: {},
      assets: baseAssets,
      resolved: { directInputs: { image_url: 'https://example.com/face.png' } },
      prompt: 'a video',
      mode: 'recreate',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateI2V).toHaveBeenCalledTimes(1);
    const call = muapiMock.generateI2V.mock.calls[0][0];
    expect(call.model).toBe('veo-4-text-to-video');
    expect(call.image_url).toBe('https://example.com/face.png');
    expect(call.studioType).toBe('personalize-i2v');
  });

  it('routes recreate (with source video) to generateVideo', async () => {
    await runGeneration({
      source: baseSource,
      client: {},
      assets: baseAssets,
      resolved: { directInputs: { video_url: 'https://example.com/source.mp4' } },
      prompt: 'a video',
      mode: 'recreate',
      options: baseOptions,
      apiKey: 'k',
    });
    expect(muapiMock.generateVideo).toHaveBeenCalledTimes(1);
    expect(muapiMock.generateI2V).not.toHaveBeenCalled();
    const call = muapiMock.generateVideo.mock.calls[0][0];
    expect(call.studioType).toBe('personalize-t2v');
  });

  it('throws when face_only has no identity image', async () => {
    await expect(
      runGeneration({
        source: baseSource,
        client: {},
        assets: { ...baseAssets, primaryIdentity: null },
        resolved: { directInputs: { video_url: 'https://example.com/source.mp4' } },
        prompt: 'face',
        mode: 'face_only',
        options: baseOptions,
        apiKey: 'k',
      }),
    ).rejects.toThrow(/No identity image/);
  });
});

describe('runGeneration — progress callback', () => {
  it('invokes onProgress for image generation', async () => {
    const onProgress = vi.fn();
    await runGeneration({
      source: baseImageSource,
      client: {},
      assets: baseAssets,
      resolved: imageResolved,
      prompt: 'a portrait',
      mode: 'recreate',
      options: baseOptions,
      apiKey: 'k',
      onProgress,
    });
    expect(onProgress).toHaveBeenCalled();
    // First call is "Preparing assets..." at 5%
    expect(onProgress.mock.calls[0][0]).toBe(5);
  });
});
