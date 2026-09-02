import { describe, it, expect, vi } from 'vitest';
import {
  getPlatformSpec,
  getSupportedPlatformKeys,
  resolvePlatformAspectRatio,
  resolvePlatformSize,
  platformRequiresTextOverlay,
  PLATFORM_SPECS,
} from '../src/lib/thumbnailPlatformSpecs.js';

describe('thumbnailPlatformSpecs', () => {
  describe('getPlatformSpec', () => {
    it('returns correct spec for known platform youtube', () => {
      const spec = getPlatformSpec('youtube');
      expect(spec).toBeDefined();
      expect(spec.key).toBe('youtube');
      expect(spec.label).toBe('YouTube');
      expect(spec.aspectRatio).toBe('16:9');
      expect(spec.size).toBe('1792x1024');
    });

    it('returns correct spec for tiktok', () => {
      const spec = getPlatformSpec('tiktok');
      expect(spec).toBeDefined();
      expect(spec.key).toBe('tiktok');
      expect(spec.aspectRatio).toBe('9:16');
      expect(spec.textOverlay).toBe(true);
    });

    it('returns correct spec for instagram-post', () => {
      const spec = getPlatformSpec('instagram-post');
      expect(spec).toBeDefined();
      expect(spec.textOverlay).toBe(false);
    });

    it('returns correct spec for web', () => {
      const spec = getPlatformSpec('web');
      expect(spec).toBeDefined();
      expect(spec.key).toBe('web');
      expect(spec.label).toBe('Web / OG');
    });

    it('returns null for unknown platform', () => {
      expect(getPlatformSpec('nonexistent-platform')).toBeNull();
    });

    it('returns null for empty string key', () => {
      expect(getPlatformSpec('')).toBeNull();
    });
  });

  describe('getSupportedPlatformKeys', () => {
    it('returns all platform keys', () => {
      const keys = getSupportedPlatformKeys();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBe(Object.keys(PLATFORM_SPECS).length);
    });

    it('includes expected platforms', () => {
      const keys = getSupportedPlatformKeys();
      expect(keys).toContain('youtube');
      expect(keys).toContain('tiktok');
      expect(keys).toContain('instagram-post');
      expect(keys).toContain('linkedin');
      expect(keys).toContain('web');
    });
  });

  describe('resolvePlatformAspectRatio', () => {
    it('returns correct ratio for youtube', () => {
      expect(resolvePlatformAspectRatio('youtube')).toBe('16:9');
    });

    it('returns correct ratio for youtube-shorts', () => {
      expect(resolvePlatformAspectRatio('youtube-shorts')).toBe('9:16');
    });

    it('returns fallback for unknown platform', () => {
      expect(resolvePlatformAspectRatio('unknown', '4:3')).toBe('4:3');
    });

    it('uses default fallback when none provided', () => {
      expect(resolvePlatformAspectRatio('unknown')).toBe('16:9');
    });
  });

  describe('resolvePlatformSize', () => {
    it('returns correct size for youtube', () => {
      expect(resolvePlatformSize('youtube')).toBe('1792x1024');
    });

    it('returns correct size for youtube-shorts', () => {
      expect(resolvePlatformSize('youtube-shorts')).toBe('1024x1792');
    });

    it('returns fallback for unknown platform', () => {
      expect(resolvePlatformSize('unknown', '512x512')).toBe('512x512');
    });

    it('uses default fallback when none provided', () => {
      expect(resolvePlatformSize('unknown')).toBe('1792x1024');
    });
  });

  describe('platformRequiresTextOverlay', () => {
    it('returns true for youtube', () => {
      expect(platformRequiresTextOverlay('youtube')).toBe(true);
    });

    it('returns true for tiktok', () => {
      expect(platformRequiresTextOverlay('tiktok')).toBe(true);
    });

    it('returns false for instagram-post', () => {
      expect(platformRequiresTextOverlay('instagram-post')).toBe(false);
    });

    it('returns false for pinterest', () => {
      expect(platformRequiresTextOverlay('pinterest')).toBe(false);
    });

    it('returns false for unknown platform', () => {
      expect(platformRequiresTextOverlay('unknown')).toBe(false);
    });
  });
});
