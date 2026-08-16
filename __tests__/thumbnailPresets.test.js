import { describe, it, expect, vi } from 'vitest';
import {
  getPresetForTemplate,
  applyPresetToControls,
  applyPresetToBrief,
  THUMBNAIL_PRESETS,
  DEFAULT_PRESET_KEY,
  PRESET_LIST,
} from '../src/lib/thumbnailPresets.js';

describe('thumbnailPresets', () => {
  const DEFAULT_PRESET = THUMBNAIL_PRESETS[DEFAULT_PRESET_KEY];

  describe('getPresetForTemplate', () => {
    it('matches by niche', () => {
      const template = { niche: 'cinema', category: 'other' };
      const preset = getPresetForTemplate(template);
      expect(preset.key).toBe('cinematic');
    });

    it('matches by category', () => {
      const template = { niche: '', category: 'cinema-template-studio' };
      const preset = getPresetForTemplate(template);
      expect(preset.key).toBe('cinematic');
    });

    it('matches niche case-insensitively', () => {
      const template = { niche: 'CINEMA', category: 'other' };
      const preset = getPresetForTemplate(template);
      expect(preset.key).toBe('cinematic');
    });

    it('returns undefined for no match when null template is provided', () => {
      const preset = getPresetForTemplate(null);
      expect(preset).toBe(DEFAULT_PRESET);
    });

    it('returns undefined for no match when template has no niche/category', () => {
      const template = { niche: '', category: '' };
      const preset = getPresetForTemplate(template);
      expect(preset).toBe(DEFAULT_PRESET);
    });

    it('returns the cinematic preset for a cinema niche', () => {
      const preset = getPresetForTemplate({ niche: 'cinema' });
      expect(preset.key).toBe('cinematic');
    });

    it('matches productCutout for product niche', () => {
      const preset = getPresetForTemplate({ niche: 'product' });
      expect(preset.key).toBe('productCutout');
    });
  });

  describe('applyPresetToControls', () => {
    it('merges preset controls correctly', () => {
      const preset = THUMBNAIL_PRESETS.cinematic;
      const current = { quality: 'low', size: '512x512' };
      const merged = applyPresetToControls(preset, current);
      expect(merged.quality).toBe('high');
      expect(merged.style).toBe('vivid');
      expect(merged.size).toBe('512x512');
    });

    it('normalizes format to outputFormat', () => {
      const preset = THUMBNAIL_PRESETS.cinematic;
      const merged = applyPresetToControls(preset, {});
      expect(merged.outputFormat).toBe('webp');
      expect(merged.format).toBeUndefined();
    });

    it('normalizes compression to outputCompression', () => {
      const preset = THUMBNAIL_PRESETS.cinematic;
      const merged = applyPresetToControls(preset, {});
      expect(merged.outputCompression).toBe(80);
      expect(merged.compression).toBeUndefined();
    });

    it('handles null preset gracefully', () => {
      const current = { quality: 'high' };
      const merged = applyPresetToControls(null, current);
      expect(merged.quality).toBe('high');
    });

    it('returns current controls when preset has no controls', () => {
      const current = { quality: 'medium' };
      const merged = applyPresetToControls({}, current);
      expect(merged.quality).toBe('medium');
    });

    it('overrides existing controls with preset values', () => {
      const preset = THUMBNAIL_PRESETS.lifestyle;
      const current = { quality: 'low', background: 'opaque' };
      const merged = applyPresetToControls(preset, current);
      expect(merged.quality).toBe('high');
      expect(merged.background).toBe('auto');
    });
  });

  describe('applyPresetToBrief', () => {
    it('appends style direction to brief', () => {
      const preset = THUMBNAIL_PRESETS.cinematic;
      const result = applyPresetToBrief(preset, 'My base brief');
      expect(result).toContain('My base brief');
      expect(result).toContain('Style direction:');
      expect(result).toContain('widescreen cinematic composition');
    });

    it('returns baseBrief when preset has no briefModifier', () => {
      const result = applyPresetToBrief({ briefModifier: '' }, 'Base brief');
      expect(result).toBe('Base brief');
    });

    it('returns baseBrief when preset is null', () => {
      const result = applyPresetToBrief(null, 'Base brief');
      expect(result).toBe('Base brief');
    });

    it('returns baseBrief when preset is undefined', () => {
      const result = applyPresetToBrief(undefined, 'Base brief');
      expect(result).toBe('Base brief');
    });
  });

  describe('preset definitions', () => {
    it('all presets have required fields', () => {
      const requiredKeys = ['key', 'name', 'briefModifier', 'controls'];
      PRESET_LIST.forEach(preset => {
        requiredKeys.forEach(key => {
          expect(preset).toHaveProperty(key);
        });
      });
    });

    it('cinematic preset has 16:9 aspect ratio', () => {
      expect(THUMBNAIL_PRESETS.cinematic.controls.aspectRatio).toBe('16:9');
    });

    it('vertical preset has 9:16 aspect ratio', () => {
      expect(THUMBNAIL_PRESETS.vertical.controls.aspectRatio).toBe('9:16');
    });
  });
});
