import { describe, it, expect } from 'vitest';
import { resolveGenerationAspectRatio } from '../CinemaTemplateStudio.js';

/**
 * Regression guard for the aspect-ratio regression in CinemaTemplateStudio.
 *
 * The generation request used to derive `aspect_ratio` ONLY from the template
 * metadata (`normalizeAspectRatio(currentTemplate)`), so a user who changed the
 * aspect-ratio control got the template's default back instead of their own
 * choice — for both image and video templates.
 */
describe('resolveGenerationAspectRatio', () => {
  it('prefers the user-selected value over the template metadata', () => {
    const template = { aspectRatio: '16:9' };

    expect(resolveGenerationAspectRatio({ aspectRatio: '9:16' }, template)).toBe('9:16');
    expect(resolveGenerationAspectRatio({ aspectRatio: '1:1' }, template)).toBe('1:1');
    expect(resolveGenerationAspectRatio({ aspectRatio: '4:5' }, template)).toBe('4:5');
  });

  it('falls back to the template default when the user has not chosen one', () => {
    expect(resolveGenerationAspectRatio({}, { aspectRatio: '9:16' })).toBe('9:16');
    // aspectRatios[] is the template's ordered list of supported ratios — the
    // first entry is its default.
    expect(resolveGenerationAspectRatio({}, { aspectRatios: ['4:5', '16:9'] })).toBe('4:5');
  });

  it('falls back to a safe 16:9 default for a template with no metadata', () => {
    expect(resolveGenerationAspectRatio({}, {})).toBe('16:9');
    expect(resolveGenerationAspectRatio(undefined, undefined)).toBe('16:9');
    expect(resolveGenerationAspectRatio({ aspectRatio: undefined }, null)).toBe('16:9');
  });

  it('treats a blank / whitespace-only selection as "not chosen"', () => {
    expect(resolveGenerationAspectRatio({ aspectRatio: '' }, { aspectRatio: '9:16' })).toBe('9:16');
    expect(resolveGenerationAspectRatio({ aspectRatio: '   ' }, { aspectRatio: '9:16' })).toBe('9:16');
    expect(resolveGenerationAspectRatio({ aspectRatio: '   ' }, {})).toBe('16:9');
  });

  it('ignores a non-string selection rather than stringifying it', () => {
    expect(resolveGenerationAspectRatio({ aspectRatio: 16 }, { aspectRatio: '9:16' })).toBe('9:16');
    expect(resolveGenerationAspectRatio({ aspectRatio: null }, { aspectRatio: '9:16' })).toBe('9:16');
  });

  it('always returns the `W:H` string both muapi endpoints expect', () => {
    const resolved = resolveGenerationAspectRatio({ aspectRatio: '9:16' }, { aspectRatio: '16:9' });
    expect(resolved).toMatch(/^\d+:\d+$/);

    const defaulted = resolveGenerationAspectRatio({}, {});
    expect(defaulted).toMatch(/^\d+:\d+$/);
  });
});
