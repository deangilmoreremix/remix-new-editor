import { describe, it, expect } from 'vitest';
import { composeNegativePrompt } from '../lib/templateEngine.js';

describe('composeNegativePrompt integration', () => {
  it('returns automotive negative containing "rusty"', () => {
    const result = composeNegativePrompt('cinematic-commercial', 'automotive', 'commercial');
    expect(typeof result).toBe('string');
    expect(result).toContain('rusty');
  });

  it('returns restaurant negative containing "chain restaurant"', () => {
    const result = composeNegativePrompt('cinematic-commercial', 'restaurant', 'commercial');
    expect(typeof result).toBe('string');
    expect(result).toContain('chain restaurant');
  });

  it('returns a non-empty string for general-business', () => {
    const result = composeNegativePrompt('cinematic-commercial', 'general-business', 'commercial');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
