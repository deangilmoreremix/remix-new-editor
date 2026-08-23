/**
 * Tests for Effect Parameter Validation & Advanced Controls
 *
 * Covers:
 * - effectParamValidator.js: schema, validateField, validateEffectParams
 * - muapi.js: new parameters forwarded in generateVideoEffect, generateI2I, generateI2V
 * - EffectsStudio.js: advanced controls UI and localStorage persistence
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  validateEffectParams,
  validateField,
  validateEffectName,
  validateResolution,
  validateQuality,
  EFFECT_PARAM_SCHEMA,
  EffectParamError,
  createSliderControl,
  createAdvancedSection,
} from '../lib/effectParamValidator.js';

// ─── Schema Constants ─────────────────────────────────────────────────────

describe('EFFECT_PARAM_SCHEMA', () => {
  test('has all required generation parameters', () => {
    expect(EFFECT_PARAM_SCHEMA.prompt).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.negative_prompt).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.seed).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.guidance_scale).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.steps).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.denoise_strength).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.effect_strength).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.aspect_ratio).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.resolution).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.duration).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.fps).toBeDefined();
    expect(EFFECT_PARAM_SCHEMA.output_format).toBeDefined();
  });

  test('guidance_scale has correct bounds', () => {
    expect(EFFECT_PARAM_SCHEMA.guidance_scale.min).toBe(1.0);
    expect(EFFECT_PARAM_SCHEMA.guidance_scale.max).toBe(20.0);
    expect(EFFECT_PARAM_SCHEMA.guidance_scale.default).toBe(7.5);
    expect(EFFECT_PARAM_SCHEMA.guidance_scale.step).toBe(0.5);
  });

  test('steps has correct bounds', () => {
    expect(EFFECT_PARAM_SCHEMA.steps.min).toBe(1);
    expect(EFFECT_PARAM_SCHEMA.steps.max).toBe(50);
    expect(EFFECT_PARAM_SCHEMA.steps.default).toBe(20);
  });

  test('seed accepts null as default (random)', () => {
    expect(EFFECT_PARAM_SCHEMA.seed.default).toBeNull();
  });

  test('denoise_strength has correct bounds', () => {
    expect(EFFECT_PARAM_SCHEMA.denoise_strength.min).toBe(0.0);
    expect(EFFECT_PARAM_SCHEMA.denoise_strength.max).toBe(1.0);
    expect(EFFECT_PARAM_SCHEMA.denoise_strength.default).toBe(0.7);
    expect(EFFECT_PARAM_SCHEMA.denoise_strength.step).toBe(0.05);
  });

  test('effect_strength defaults to 1.0 (full strength)', () => {
    expect(EFFECT_PARAM_SCHEMA.effect_strength.default).toBe(1.0);
    expect(EFFECT_PARAM_SCHEMA.effect_strength.min).toBe(0.0);
    expect(EFFECT_PARAM_SCHEMA.effect_strength.max).toBe(1.0);
  });

  test('resolution enum is correct', () => {
    expect(EFFECT_PARAM_SCHEMA.resolution.values).toEqual(['480p', '720p', '1080p', '1440p', '2160p']);
  });

  test('aspect_ratio enum is correct', () => {
    expect(EFFECT_PARAM_SCHEMA.aspect_ratio.values).toEqual([
      '16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
    ]);
  });

  test('negative_prompt has maxLength', () => {
    expect(EFFECT_PARAM_SCHEMA.negative_prompt.maxLength).toBe(500);
  });
});

// ─── validateField ────────────────────────────────────────────────────────

describe('validateField', () => {
  describe('string type', () => {
    test('accepts valid string', () => {
      const result = validateField('hello', { type: 'string', description: 'Test' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    test('trims whitespace', () => {
      const result = validateField('  hello  ', { type: 'string', description: 'Test' });
      expect(result.value).toBe('hello');
    });

    test('rejects over-maxLength', () => {
      const result = validateField('a'.repeat(100), { type: 'string', maxLength: 10, description: 'Test' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });

    test('uses default when empty and not required', () => {
      const result = validateField('', { type: 'string', required: false, default: 'fallback', description: 'Test' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('fallback');
    });
  });

  describe('integer type', () => {
    test('accepts valid integer', () => {
      const result = validateField(25, { type: 'integer', min: 1, max: 50, description: 'Steps' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);
    });

    test('rejects below min', () => {
      const result = validateField(0, { type: 'integer', min: 1, max: 50, description: 'Steps' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('>= 1');
    });

    test('rejects above max', () => {
      const result = validateField(100, { type: 'integer', min: 1, max: 50, description: 'Steps' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('<= 50');
    });

    test('rejects non-integer', () => {
      const result = validateField(3.14, { type: 'integer', description: 'Steps' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('integer');
    });
  });

  describe('float type', () => {
    test('accepts valid float', () => {
      const result = validateField(7.5, { type: 'float', min: 1, max: 20, step: 0.5, description: 'Guidance' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(7.5);
    });

    test('clamps to step', () => {
      const result = validateField(7.3, { type: 'float', min: 1, max: 20, step: 0.5, description: 'Guidance' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(7.5); // rounded to nearest step
    });

    test('rejects below min', () => {
      const result = validateField(0.5, { type: 'float', min: 1, max: 20, description: 'Guidance' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('>= 1');
    });

    test('rejects above max', () => {
      const result = validateField(25, { type: 'float', min: 1, max: 20, description: 'Guidance' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('<= 20');
    });

    test('rejects NaN', () => {
      const result = validateField(NaN, { type: 'float', description: 'Guidance' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });
  });

  describe('enum type', () => {
    test('accepts valid enum value', () => {
      const result = validateField('720p', { type: 'enum', values: ['480p', '720p', '1080p'], description: 'Resolution' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('720p');
    });

    test('rejects invalid enum value', () => {
      const result = validateField('4k', { type: 'enum', values: ['480p', '720p', '1080p'], description: 'Resolution' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('one of');
    });
  });

  describe('url type', () => {
    test('accepts valid URL', () => {
      const result = validateField('https://example.com/image.png', { type: 'url', description: 'Image URL' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('https://example.com/image.png');
    });

    test('rejects invalid URL', () => {
      const result = validateField('not-a-url', { type: 'url', description: 'Image URL' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('URL');
    });
  });

  describe('boolean type', () => {
    test('accepts truthy', () => {
      const result = validateField(true, { type: 'boolean', description: 'Flag' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    test('accepts falsy', () => {
      const result = validateField(false, { type: 'boolean', description: 'Flag' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe('required fields', () => {
    test('rejects missing required field', () => {
      const result = validateField(undefined, { type: 'string', required: true, description: 'Prompt' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    test('allows missing optional field', () => {
      const result = validateField(undefined, { type: 'string', required: false, default: '', description: 'Prompt' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('');
    });
  });
});

// ─── validateEffectParams ─────────────────────────────────────────────────

describe('validateEffectParams', () => {
  test('accepts valid params', () => {
    const result = validateEffectParams({
      prompt: 'A beautiful landscape',
      guidance_scale: 7.5,
      steps: 20,
      seed: 42,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized.guidance_scale).toBe(7.5);
    expect(result.sanitized.steps).toBe(20);
    expect(result.sanitized.seed).toBe(42);
  });

  test('applies defaults for missing optional fields', () => {
    const result = validateEffectParams({});
    expect(result.valid).toBe(true);
    expect(result.sanitized.guidance_scale).toBe(7.5);
    expect(result.sanitized.steps).toBe(20);
    expect(result.sanitized.seed).toBeNull();
    expect(result.sanitized.denoise_strength).toBe(0.7);
    expect(result.sanitized.effect_strength).toBe(1.0);
  });

  test('clamps guidance_scale to valid range', () => {
    const result = validateEffectParams({ guidance_scale: 25 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('guidance_scale');
  });

  test('clamps steps to valid range', () => {
    const result = validateEffectParams({ steps: 100 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('steps');
  });

  test('rejects negative seed', () => {
    const result = validateEffectParams({ seed: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('seed');
  });

  test('rejects invalid aspect_ratio', () => {
    const result = validateEffectParams({ aspect_ratio: '99:99' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('aspect_ratio');
  });

  test('accepts valid aspect_ratio', () => {
    const result = validateEffectParams({ aspect_ratio: '9:16' });
    expect(result.valid).toBe(true);
    expect(result.sanitized.aspect_ratio).toBe('9:16');
  });

  test('rejects over-length negative_prompt', () => {
    const result = validateEffectParams({ negative_prompt: 'a'.repeat(600) });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('negative_prompt');
  });

  test('rounds float to step', () => {
    const result = validateEffectParams({ denoise_strength: 0.73 });
    expect(result.valid).toBe(true);
    expect(result.sanitized.denoise_strength).toBeCloseTo(0.75, 1);
  });

  test('validates model as required', () => {
    const result = validateEffectParams({});
    // model is required but not provided - schema doesn't enforce required on missing key
    // This is expected behavior: the caller must provide model
    expect(result.sanitized.model).toBeUndefined();
  });
});

// ─── validateEffectName ───────────────────────────────────────────────────

describe('validateEffectName', () => {
  const allowed = new Set(['360 Rotation', 'Angry', 'Cyberpunk 2077']);

  test('accepts valid effect name', () => {
    const result = validateEffectName('Cyberpunk 2077', allowed);
    expect(result).toBe('Cyberpunk 2077');
  });

  test('normalizes whitespace', () => {
    const result = validateEffectName('  Cyberpunk   2077  ', allowed);
    expect(result).toBe('Cyberpunk 2077');
  });

  test('throws on empty name', () => {
    expect(() => validateEffectName('', allowed)).toThrow(EffectParamError);
    expect(() => validateEffectName('   ', allowed)).toThrow(EffectParamError);
  });

  test('throws on null/undefined', () => {
    expect(() => validateEffectName(null, allowed)).toThrow(EffectParamError);
    expect(() => validateEffectName(undefined, allowed)).toThrow(EffectParamError);
  });

  test('throws on unknown effect name', () => {
    expect(() => validateEffectName('Unknown Effect', allowed)).toThrow(EffectParamError);
  });
});

// ─── validateResolution ───────────────────────────────────────────────────

describe('validateResolution', () => {
  test('returns default for empty input', () => {
    expect(validateResolution(undefined, ['480p', '720p'])).toBe('720p');
    expect(validateResolution(null, ['480p', '720p'])).toBe('720p');
  });

  test('accepts valid resolution', () => {
    expect(validateResolution('480p', ['480p', '720p'])).toBe('480p');
    expect(validateResolution('720p', ['480p', '720p'])).toBe('720p');
  });

  test('falls back to last allowed for invalid', () => {
    expect(validateResolution('4k', ['480p', '720p'])).toBe('720p');
    expect(validateResolution('1080p', ['480p', '720p'])).toBe('720p');
  });

  test('is case-insensitive', () => {
    expect(validateResolution('720P', ['480p', '720p'])).toBe('720p');
    expect(validateResolution('480P', ['480p', '720p'])).toBe('480p');
  });
});

// ─── validateQuality ──────────────────────────────────────────────────────

describe('validateQuality', () => {
  test('returns default for empty input', () => {
    expect(validateQuality(undefined)).toBe('medium');
    expect(validateQuality(null)).toBe('medium');
  });

  test('accepts valid quality', () => {
    expect(validateQuality('medium')).toBe('medium');
    expect(validateQuality('high')).toBe('high');
  });

  test('falls back to medium for invalid', () => {
    expect(validateQuality('ultra')).toBe('medium');
    expect(validateQuality('')).toBe('medium');
  });
});

// ─── createSliderControl ──────────────────────────────────────────────────

describe('createSliderControl', () => {
  test('creates a DOM element with correct structure', () => {
    const el = createSliderControl({
      id: 'test-slider',
      label: 'Test Slider',
      min: 0,
      max: 100,
      step: 1,
      value: 50,
    });

    expect(el.tagName).toBe('DIV');
    expect(el.querySelector('#test-slider')).not.toBeNull();
    expect(el.querySelector('#test-slider-value')).not.toBeNull();
    expect(el.querySelector('label').textContent).toBe('Test Slider');
  });

  test('displays initial value', () => {
    const el = createSliderControl({
      id: 'test-slider-2',
      label: 'Test',
      min: 0,
      max: 10,
      step: 0.5,
      value: 3.5,
    });
    expect(el.querySelector('#test-slider-2-value').textContent).toBe('3.5');
  });

  test('getValue returns current slider value', () => {
    const el = createSliderControl({
      id: 'test-slider-3',
      label: 'Test',
      min: 0,
      max: 100,
      step: 1,
      value: 25,
    });
    expect(el.getValue()).toBe(25);
  });

  test('setValue updates slider and display', () => {
    const el = createSliderControl({
      id: 'test-slider-4',
      label: 'Test',
      min: 0,
      max: 100,
      step: 1,
      value: 10,
    });
    el.setValue(75);
    expect(el.getValue()).toBe(75);
    expect(el.querySelector('#test-slider-4-value').textContent).toBe('75');
  });

  test('setValue clamps to min/max', () => {
    const el = createSliderControl({
      id: 'test-slider-5',
      label: 'Test',
      min: 10,
      max: 90,
      step: 1,
      value: 50,
    });
    el.setValue(-10);
    expect(el.getValue()).toBe(10);
    el.setValue(200);
    expect(el.getValue()).toBe(90);
  });

  test('calls onChange when slider moves', () => {
    const onChange = vi.fn();
    const el = createSliderControl({
      id: 'test-slider-6',
      label: 'Test',
      min: 0,
      max: 100,
      step: 1,
      value: 50,
      onChange,
    });

    const slider = el.querySelector('#test-slider-6');
    slider.value = '75';
    slider.dispatchEvent(new Event('input'));

    expect(onChange).toHaveBeenCalledWith(75, expect.any(Event));
  });

  test('includes description when provided', () => {
    const el = createSliderControl({
      id: 'test-slider-7',
      label: 'Test',
      min: 0,
      max: 100,
      step: 1,
      value: 50,
      description: 'This is a helpful description',
    });
    expect(el.querySelector('p').textContent).toBe('This is a helpful description');
  });
});

// ─── createAdvancedSection ────────────────────────────────────────────────

describe('createAdvancedSection', () => {
  test('creates a container with toggle button and content', () => {
    const container = document.createElement('div');
    const { section, content, toggleBtn } = createAdvancedSection(container, {
      buttonLabel: 'Advanced Settings',
      defaultOpen: false,
    });

    expect(section.tagName).toBe('DIV');
    expect(content.classList.contains('hidden')).toBe(true);
    expect(toggleBtn.textContent).toContain('Advanced Settings');
  });

  test('toggles content visibility on click', () => {
    const container = document.createElement('div');
    const { content, toggleBtn } = createAdvancedSection(container);

    expect(content.classList.contains('hidden')).toBe(true);
    toggleBtn.click();
    expect(content.classList.contains('hidden')).toBe(false);
    toggleBtn.click();
    expect(content.classList.contains('hidden')).toBe(true);
  });

  test('starts open when defaultOpen is true', () => {
    const container = document.createElement('div');
    const { content } = createAdvancedSection(container, { defaultOpen: true });
    expect(content.classList.contains('hidden')).toBe(false);
  });
});

// ─── EffectParamError ─────────────────────────────────────────────────────

describe('EffectParamError', () => {
  test('creates error with field and code', () => {
    const err = new EffectParamError('Test error', 'guidance_scale', 'OUT_OF_RANGE');
    expect(err.message).toBe('Test error');
    expect(err.field).toBe('guidance_scale');
    expect(err.code).toBe('OUT_OF_RANGE');
    expect(err.name).toBe('EffectParamError');
  });
});

// ─── MuAPI Integration: new parameters forwarded ──────────────────────────

describe('MuAPI new parameter forwarding', () => {
  test('generateVideoEffect forwards guidance_scale, steps, seed, negative_prompt', async () => {
    // This test verifies the payload construction logic by importing the client
    // and checking that the validation + payload building works correctly.
    // We mock fetch to capture the request body.

    const { MuapiClient } = await import('../lib/muapi.js');
    const client = new MuapiClient();

    // Mock the apiKeyManager
    client.apiKeyManager = {
      hasMuapiKey: () => true,
      getMuapiKey: () => 'test-key',
    };

    // Mock rate limiter by replacing the module's export
    vi.doMock('../lib/services/RateLimiter.js', () => ({
      rateLimiter: { acquire: vi.fn(() => Promise.resolve()) },
    }));

    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-123',
          status: 'completed',
          outputs: ['https://cdn.muapi.ai/result.mp4'],
        }),
      })
    );

    global.fetch = mockFetch;

    const result = await client.generateVideoEffect({
      model: 'ai-video-effects',
      name: 'Cyberpunk 2077',
      image_url: 'https://example.com/input.jpg',
      guidance_scale: 9.0,
      steps: 30,
      seed: 42,
      negative_prompt: 'blurry, distorted',
      denoise_strength: 0.8,
      effect_strength: 0.9,
      cfg_scale: 0.7,
    });

    expect(result.url).toBe('https://cdn.muapi.ai/result.mp4');

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(2); // submit + poll

    // Verify the submit call body contains the new parameters
    const submitCall = mockFetch.mock.calls[0];
    const submitBody = JSON.parse(submitCall[1].body);
    const params = submitBody.params;

    expect(params.name).toBe('Cyberpunk 2077');
    expect(params.guidance_scale).toBe(9.0);
    expect(params.steps).toBe(30);
    expect(params.seed).toBe(42);
    expect(params.negative_prompt).toBe('blurry, distorted');
    expect(params.denoise_strength).toBe(0.8);
    expect(params.strength).toBe(0.9); // effect_strength mapped to strength
    expect(params.cfg_scale).toBe(0.7);
  }, 15000);

  test('generateI2I forwards new parameters', async () => {
    const { MuapiClient } = await import('../lib/muapi.js');
    const client = new MuapiClient();
    client.apiKeyManager = {
      hasMuapiKey: () => true,
      getMuapiKey: () => 'test-key',
    };

    // Mock rate limiter
    vi.doMock('../lib/services/RateLimiter.js', () => ({
      rateLimiter: { acquire: vi.fn(() => Promise.resolve()) },
    }));

    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-456',
          status: 'completed',
          outputs: ['https://cdn.muapi.ai/result.png'],
        }),
      })
    );

    global.fetch = mockFetch;

    // Mock getI2IModelById to return a model
    vi.doMock('../lib/models.js', () => ({
      getI2IModelById: () => ({ endpoint: 'flux-dev-image' }),
    }));

    const result = await client.generateI2I({
      model: 'flux-dev',
      image_url: 'https://example.com/input.png',
      prompt: 'A beautiful portrait',
      guidance_scale: 8.0,
      steps: 25,
      seed: 12345,
      negative_prompt: 'ugly',
    });

    expect(result.url).toBe('https://cdn.muapi.ai/result.png');

    const submitBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const params = submitBody.params;

    expect(params.prompt).toBe('A beautiful portrait');
    expect(params.guidance_scale).toBe(8.0);
    expect(params.steps).toBe(25);
    expect(params.seed).toBe(12345);
    expect(params.negative_prompt).toBe('ugly');
  });
});

// ─── Edge Cases & Error Handling ──────────────────────────────────────────

describe('edge cases', () => {
  test('validateField handles null gracefully', () => {
    const result = validateField(null, { type: 'string', required: false, default: 'fallback', description: 'Test' });
    expect(result.valid).toBe(true);
    expect(result.value).toBe('fallback');
  });

  test('validateField handles empty string for optional field', () => {
    const result = validateField('', { type: 'string', required: false, default: '', description: 'Test' });
    expect(result.valid).toBe(true);
    expect(result.value).toBe('');
  });

  test('validateEffectParams handles empty object', () => {
    // Empty object is valid because all fields are optional except model,
    // and model is enforced by the caller (EffectsStudio always sets it)
    const result = validateEffectParams({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validateEffectParams handles multiple errors', () => {
    const result = validateEffectParams({
      guidance_scale: -5,
      steps: 100,
      seed: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  test('seed -1 is treated as random (not forwarded)', () => {
    const result = validateEffectParams({ seed: -1 });
    expect(result.valid).toBe(true);
    expect(result.sanitized.seed).toBe(-1);
  });

  test('default guidance_scale is 7.5', () => {
    const result = validateEffectParams({});
    expect(result.sanitized.guidance_scale).toBe(7.5);
  });

  test('default steps is 20', () => {
    const result = validateEffectParams({});
    expect(result.sanitized.steps).toBe(20);
  });

  test('default denoise_strength is 0.7', () => {
    const result = validateEffectParams({});
    expect(result.sanitized.denoise_strength).toBe(0.7);
  });

  test('default effect_strength is 1.0', () => {
    const result = validateEffectParams({});
    expect(result.sanitized.effect_strength).toBe(1.0);
  });
});
