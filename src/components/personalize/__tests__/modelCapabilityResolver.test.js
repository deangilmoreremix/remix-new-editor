/**
 * modelCapabilityResolver.test.js
 *
 * Tests for `resolveModelCapabilities` and `resolveAssetsForModel`
 * across the three primary routes:
 *   - face swap (FACE_SWAP_MODEL)
 *   - recast (FULL_BODY_MODEL)
 *   - i2i (DEFAULT_I2I_MODEL)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveModelCapabilities,
  resolveAssetsForModel,
  getGenerationAssetUrl,
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  DEFAULT_T2V_MODEL,
  DEFAULT_I2I_MODEL,
} from '../modelCapabilityResolver.js';
import { DEFAULT_GENERATION_OPTIONS } from '../types.js';

const READY = (over = {}) => ({
  uploadStatus: 'ready',
  uploadedUrl: 'https://example.com/asset.png',
  url: 'blob:fake',
  ...over,
});

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
  sourceMetadata: {},
};

const baseImageSource = {
  ...baseSource,
  sourceType: 'image-demo',
  mediaType: 'image',
  sourceMedia: 'https://example.com/source.png',
};

describe('modelCapabilityResolver — face_swap', () => {
  it('resolves face-swap capabilities for FACE_SWAP_MODEL', () => {
    const caps = resolveModelCapabilities(baseSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: FACE_SWAP_MODEL,
    });

    expect(caps.supportsFaceSwap).toBe(true);
    expect(caps.supportsV2V).toBe(true);
    expect(caps.modelId).toBe(FACE_SWAP_MODEL);
  });

  it('routes identity image to directInputs.image_url in face_only mode', () => {
    const caps = resolveModelCapabilities(baseSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: FACE_SWAP_MODEL,
    });
    const assets = {
      identities: [READY({ id: 'i1', name: 'face' })],
      primaryIdentity: READY({ id: 'i1', name: 'face' }),
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

    const resolved = resolveAssetsForModel(baseSource, assets, 'face_only', DEFAULT_GENERATION_OPTIONS, caps);
    expect(resolved.directInputs.image_url).toBe('https://example.com/asset.png');
    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4');
  });
});

describe('modelCapabilityResolver — recast', () => {
  it('resolves recast capabilities for FULL_BODY_MODEL', () => {
    const caps = resolveModelCapabilities(baseSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: FULL_BODY_MODEL,
    });

    expect(caps.supportsRecast).toBe(true);
    expect(caps.supportsPersonReplacement).toBe(true);
    expect(caps.modelId).toBe(FULL_BODY_MODEL);
  });

  it('routes identity image to directInputs.image_url in full_body mode', () => {
    const caps = resolveModelCapabilities(baseSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: FULL_BODY_MODEL,
    });
    const assets = {
      identities: [READY({ id: 'i1', name: 'presenter' })],
      primaryIdentity: READY({ id: 'i1', name: 'presenter' }),
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

    const resolved = resolveAssetsForModel(baseSource, assets, 'full_body', DEFAULT_GENERATION_OPTIONS, caps);
    expect(resolved.directInputs.image_url).toBe('https://example.com/asset.png');
    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4');
  });
});

describe('modelCapabilityResolver — i2i (image source)', () => {
  it('resolves I2I capabilities for DEFAULT_I2I_MODEL on an image source', () => {
    const caps = resolveModelCapabilities(baseImageSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: DEFAULT_I2I_MODEL,
    });
    expect(caps.supportsI2I).toBe(true);
    expect(caps.modelId).toBe(DEFAULT_I2I_MODEL);
  });

  it('routes identity image in keep_design mode from sourceMedia', () => {
    const caps = resolveModelCapabilities(baseImageSource, {
      ...DEFAULT_GENERATION_OPTIONS,
      advancedModel: DEFAULT_I2I_MODEL,
    });
    const assets = {
      identities: [],
      primaryIdentity: null,
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

    const resolved = resolveAssetsForModel(baseImageSource, assets, 'keep_design', DEFAULT_GENERATION_OPTIONS, caps);
    expect(resolved.directInputs.image_url).toBe('https://example.com/source.png');
  });
});

describe('modelCapabilityResolver — constants and defaults', () => {
  it('exposes the expected model constants', () => {
    expect(FACE_SWAP_MODEL).toBe('ai-video-face-swap');
    expect(FULL_BODY_MODEL).toBe('kling-v3.0-pro-motion-control');
    expect(DEFAULT_T2V_MODEL).toBe('veo-4-text-to-video');
    expect(DEFAULT_I2I_MODEL).toBe('gpt-image-2-image-to-image');
  });

  it('falls back to DEFAULT_T2V_MODEL when no model is set on source or options', () => {
    const caps = resolveModelCapabilities(baseSource, {
      ...DEFAULT_GENERATION_OPTIONS,
    });
    expect(caps.modelId).toBe(DEFAULT_T2V_MODEL);
  });
});

describe('getGenerationAssetUrl', () => {
  it('returns undefined for null/undefined asset', () => {
    expect(getGenerationAssetUrl(null)).toBeUndefined();
    expect(getGenerationAssetUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for assets not in ready upload state', () => {
    expect(
      getGenerationAssetUrl({ uploadStatus: 'local', url: 'https://x.com/a.png' }),
    ).toBeUndefined();
  });

  it('returns uploadedUrl when ready, ignoring blob: urls', () => {
    expect(
      getGenerationAssetUrl({ uploadStatus: 'ready', url: 'blob:fake', uploadedUrl: 'https://x.com/up.png' }),
    ).toBe('https://x.com/up.png');
  });

  it('returns url when ready and no uploadedUrl and url is not blob:', () => {
    expect(
      getGenerationAssetUrl({ uploadStatus: 'ready', url: 'https://x.com/a.png' }),
    ).toBe('https://x.com/a.png');
  });
});
