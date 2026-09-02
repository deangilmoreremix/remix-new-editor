import { describe, it, expect } from 'vitest';
import { openaiConfig } from './openaiConfig.js';

/**
 * Regression guard for the "isOpenAIImageModel is not a function" bug.
 * The method must be reachable on the openaiConfig INSTANCE; declaring it
 * `static` made `openaiConfig.isOpenAIImageModel(...)` throw at runtime.
 */
describe('openaiConfig.isOpenAIImageModel', () => {
  it('is callable on the openaiConfig instance', () => {
    expect(typeof openaiConfig.isOpenAIImageModel).toBe('function');
  });

  it('returns true for OpenAI Images API family models', () => {
    expect(openaiConfig.isOpenAIImageModel('gpt-image-2')).toBe(true);
    expect(openaiConfig.isOpenAIImageModel('gpt-image-1.5')).toBe(true);
    expect(openaiConfig.isOpenAIImageModel('gpt-image-1')).toBe(true);
    expect(openaiConfig.isOpenAIImageModel('gpt-image-1-mini')).toBe(true);
  });

  it('returns false for muapi-routed and unknown models', () => {
    expect(openaiConfig.isOpenAIImageModel('blackforest')).toBe(false);
    expect(openaiConfig.isOpenAIImageModel('midjourney')).toBe(false);
    expect(openaiConfig.isOpenAIImageModel('unknown-model')).toBe(false);
    expect(openaiConfig.isOpenAIImageModel(undefined)).toBe(false);
  });
});
