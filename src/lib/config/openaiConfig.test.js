import { describe, it, expect } from 'vitest';
import { openaiConfig, extractResponsesOutputText } from './openaiConfig.js';

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

describe('extractResponsesOutputText', () => {
  const msg = (...content) => ({ type: 'message', content });
  const text = (t) => ({ type: 'output_text', text: t });

  it('returns a single text part unchanged', () => {
    expect(extractResponsesOutputText({ output: [msg(text('Hello.'))] })).toBe('Hello.');
  });

  it('joins every text part across message items in order, skipping reasoning', () => {
    const json = {
      output: [
        { type: 'reasoning', summary: [] },
        msg(text('First. '), text('Second.')),
        msg(text(' Third.')),
      ],
    };
    expect(extractResponsesOutputText(json)).toBe('First. Second. Third.');
  });

  it('throws on a refusal', () => {
    expect(() => extractResponsesOutputText({ output: [msg({ type: 'refusal', refusal: 'no' })] }))
      .toThrow('Model refused: no');
  });

  it('returns an empty string when there is no text', () => {
    expect(extractResponsesOutputText({ output: [{ type: 'reasoning' }] })).toBe('');
  });
});
