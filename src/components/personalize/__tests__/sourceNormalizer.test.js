/**
 * sourceNormalizer.test.js
 *
 * Happy-path tests for the four normalizer entry points and the
 * auto-detect dispatcher.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeLandingDemo,
  normalizeGoAiViralPrompt,
  normalizeGoAiViralVideo,
  normalizeImageDemo,
  normalizePersonalizationSource,
  getEligibility,
} from '../sourceNormalizer.js';

describe('normalizeLandingDemo', () => {
  it('maps a landing demo to a PersonalizationSource', () => {
    const out = normalizeLandingDemo({
      id: 7,
      title: 'Sunset Walk',
      videoSrc: 'https://x.com/sunset.mp4',
      posterSrc: 'https://x.com/sunset.jpg',
      prompt: 'walking at sunset',
      model: 'veo-4',
      modelName: 'Veo 4',
      aspectRatio: '16:9',
      duration: 12,
      durationLabel: '12s',
      category: 'lifestyle',
      sourceUrl: 'https://x.com/landing/sunset',
      studioTab: 'video',
      sourceRepo: 'landing',
      tags: ['lifestyle', 'warm'],
    });

    expect(out.sourceType).toBe('landing-demo');
    expect(out.id).toBe('7');
    expect(out.title).toBe('Sunset Walk');
    expect(out.mediaType).toBe('video');
    expect(out.sourceMedia).toBe('https://x.com/sunset.mp4');
    expect(out.poster).toBe('https://x.com/sunset.jpg');
    expect(out.shortPrompt).toBe('walking at sunset');
    expect(out.model).toBe('veo-4');
    expect(out.aspectRatio).toBe('16:9');
    expect(out.duration).toBe(12);
    expect(out.sourceMetadata.studioTab).toBe('video');
    expect(out.sourceMetadata.tags).toEqual(['lifestyle', 'warm']);
  });

  it('returns null sourceMedia when videoSrc is missing', () => {
    const out = normalizeLandingDemo({
      id: 1,
      title: 'X',
      posterSrc: null,
      prompt: 'p',
    });
    expect(out.sourceMedia).toBeNull();
    expect(out.poster).toBeNull();
  });
});

describe('normalizeGoAiViralPrompt', () => {
  it('picks the result-role media as primary', () => {
    const out = normalizeGoAiViralPrompt({
      id: 42,
      title: 'Viral',
      mediaType: 'video',
      prompt: 'a cat on a roof',
      media: [
        { role: 'preview', previewUrl: 'https://x.com/preview.png', posterUrl: null },
        { role: 'result', previewUrl: 'https://x.com/result.mp4', posterUrl: 'https://x.com/result.jpg' },
      ],
      recommendedModel: 'veo-4',
      recommended: { aspectRatio: '9:16', durationSeconds: 8 },
      categories: ['cats'],
      source: { url: 'https://x.com/source', engagement: { views: 1000 }, author: 'Jane' },
      sourceModels: ['veo-4'],
      language: 'en',
      curation: { tags: ['trending'] },
      provenance: { url: 'https://x.com/prov' },
    });

    expect(out.sourceType).toBe('go-ai-viral-prompt');
    expect(out.mediaType).toBe('video');
    expect(out.sourceMedia).toBe('https://x.com/result.mp4');
    expect(out.poster).toBe('https://x.com/result.jpg');
    expect(out.aspectRatio).toBe('9:16');
    expect(out.duration).toBe(8);
    expect(out.durationLabel).toBe('8s');
    expect(out.sourceMetadata.engagement).toEqual({ views: 1000 });
  });
});

describe('normalizeGoAiViralVideo', () => {
  it('maps a SeedancePrompt-like record', () => {
    const out = normalizeGoAiViralVideo({
      slug: 'cool-slug',
      prompt: 'a dancer spins',
      fullPrompt: 'a dancer spins under a spotlight in slow motion',
      outputUrl: 'https://x.com/out.mp4',
      thumbnail: 'https://x.com/thumb.jpg',
      recommendedModel: 'kling-v3',
      categories: ['dance'],
      detailHref: '/v/cool-slug',
      tags: ['dance'],
      language: 'en',
      author: 'DJ',
      publishedAt: '2026-01-01',
      engagement: { likes: 100 },
      sourceLanguage: 'en',
    });

    expect(out.sourceType).toBe('go-ai-viral-video');
    expect(out.id).toBe('cool-slug');
    expect(out.mediaType).toBe('video');
    expect(out.sourceMedia).toBe('https://x.com/out.mp4');
    expect(out.poster).toBe('https://x.com/thumb.jpg');
    expect(out.originalPrompt).toBe('a dancer spins under a spotlight in slow motion');
    expect(out.title.startsWith('a dancer spins')).toBe(true);
  });
});

describe('normalizeImageDemo', () => {
  it('produces an image PersonalizationSource', () => {
    const out = normalizeImageDemo('img-1', 'Cat Poster', 'https://x.com/cat.png', 'a cat poster');
    expect(out.sourceType).toBe('image-demo');
    expect(out.id).toBe('img-1');
    expect(out.mediaType).toBe('image');
    expect(out.sourceMedia).toBe('https://x.com/cat.png');
    expect(out.poster).toBe('https://x.com/cat.png');
    expect(out.sourceMetadata).toEqual({});
  });

  it('honors extra fields when provided', () => {
    const out = normalizeImageDemo('img-2', 'X', 'https://x.com/x.png', 'p', {
      model: 'gpt-image-2-edit',
      aspectRatio: '1:1',
    });
    expect(out.model).toBe('gpt-image-2-edit');
    expect(out.aspectRatio).toBe('1:1');
  });
});

describe('normalizePersonalizationSource (auto-detect)', () => {
  it('returns null for non-objects', () => {
    expect(normalizePersonalizationSource(null)).toBeNull();
    expect(normalizePersonalizationSource('x')).toBeNull();
    expect(normalizePersonalizationSource(42)).toBeNull();
  });

  it('passes through an already-normalized source', () => {
    const src = {
      sourceType: 'image-demo',
      id: 'i1',
      title: 't',
      mediaType: 'image',
      sourceMedia: 'u',
      poster: 'u',
      shortPrompt: 'p',
      fullPrompt: 'p',
      originalPrompt: 'p',
      sourceMetadata: {},
    };
    expect(normalizePersonalizationSource(src)).toBe(src);
  });

  it('detects landing demo shape', () => {
    const out = normalizePersonalizationSource({
      id: 1,
      title: 't',
      slug: 's',
      videoSrc: 'v.mp4',
      posterSrc: 'p.jpg',
      prompt: 'p',
    });
    expect(out?.sourceType).toBe('landing-demo');
  });
});

describe('getEligibility', () => {
  it('returns video eligibility for video sources', () => {
    const e = getEligibility({ mediaType: 'video' });
    expect(e.enabled).toBe(true);
    expect(e.videoModes).toContain('full_body');
    expect(e.recommendedMode).toBe('full_body');
  });

  it('returns image eligibility for image sources', () => {
    const e = getEligibility({ mediaType: 'image' });
    expect(e.imageModes).toContain('recreate');
    expect(e.recommendedMode).toBe('recreate');
  });

  it('returns prompt-only eligibility otherwise', () => {
    const e = getEligibility({ mediaType: 'prompt-only' });
    expect(e.outputs).toEqual(['prompt']);
    expect(e.recommendedMode).toBeUndefined();
  });
});
