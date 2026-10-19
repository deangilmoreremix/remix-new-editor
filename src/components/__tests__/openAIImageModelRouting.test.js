import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'path';
import { openaiConfig, isOpenAIImageModelId } from '../../lib/config/openaiConfig.js';

/**
 * Regression guard for the OpenAI image-model routing allowlist.
 *
 * `isOpenAIImageModel()` used to enumerate only `gpt-image-2` plus the legacy
 * 1.x IDs. The Phase 2 catalog then made `gpt-image-2.5-sunburst` /
 * `-flare`
 * selectable, and every generation with them fell through to the muapi proxy
 * because the router did not recognise them as OpenAI-family.
 */
describe('openaiConfig.isOpenAIImageModel — current catalog', () => {
  it('recognises every currently selectable gpt-image model', () => {
    for (const model of ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare']) {
      expect(openaiConfig.isOpenAIImageModel(model), model).toBe(true);
      expect(isOpenAIImageModelId(model), model).toBe(true);
    }
  });

  it('stays in sync with the selectable catalog in supportedImageModels', () => {
    const selectable = openaiConfig.getConfig().supportedImageModels;
    expect(selectable).toContain('gpt-image-2');
    expect(selectable).toContain('gpt-image-2.5-sunburst');
    expect(selectable).toContain('gpt-image-2.5-flare');
    // A selectable OpenAI model must never be routed to muapi.
    for (const model of selectable) {
      expect(openaiConfig.isOpenAIImageModel(model), model).toBe(true);
    }
  });

  it('does not re-add the deprecated gpt-image-1.x IDs to the selectable catalog', () => {
    const selectable = openaiConfig.getConfig().supportedImageModels;
    for (const deprecated of ['gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini']) {
      expect(selectable).not.toContain(deprecated);
    }
  });

  it('recognises a future gpt-image release without a code change', () => {
    expect(openaiConfig.isOpenAIImageModel('gpt-image-3')).toBe(true);
    expect(openaiConfig.isOpenAIImageModel('gpt-image-3-pro')).toBe(true);
    expect(openaiConfig.isOpenAIImageModel('gpt-image-2.5-eclipse')).toBe(true);
  });

  it('rejects muapi-routed and unknown models', () => {
    for (const model of ['blackforest', 'midjourney', 'google', 'unknown-model', 'dall-e-3', 'gpt-5.6-sol']) {
      expect(openaiConfig.isOpenAIImageModel(model), model).toBe(false);
    }
  });

  it('rejects non-string input instead of throwing', () => {
    for (const model of [undefined, null, 42, {}, []]) {
      expect(openaiConfig.isOpenAIImageModel(model)).toBe(false);
    }
  });

  it('does NOT reclassify the muapi catalog\'s gpt-image endpoint IDs', () => {
    // src/lib/models.js reuses the family name for its own endpoints
    // (t2iModels: gpt-image-2-text-to-image, gpt-image-1.5;
    //  i2iModels: gpt-image-1.5-edit, gpt-image-2-image-to-image).
    // Routing those to OpenAI would call a model OpenAI does not serve.
    for (const model of [
      'gpt-image-2-text-to-image',
      'gpt-image-2-image-to-image',
      'gpt-image-1.5-edit',
    ]) {
      expect(openaiConfig.isOpenAIImageModel(model), model).toBe(false);
    }
  });
});

describe('netlify/functions/timeline-image-generate.js — OPENAI_IMAGE_MODELS', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'netlify/functions/timeline-image-generate.js'),
    'utf-8',
  );

  it('declares a server-side allowlist covering the current catalog', () => {
    expect(source).toContain('OPENAI_IMAGE_MODELS');
    for (const model of ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare']) {
      expect(source).toContain(`'${model}'`);
    }
  });

  it('does not list any deprecated gpt-image-1.x ID', () => {
    for (const deprecated of ['gpt-image-1\'', 'gpt-image-1.5\'', 'gpt-image-1-mini\'']) {
      expect(source).not.toContain(deprecated);
    }
  });

  it('rejects a request pinned to an unsupported model instead of silently substituting', () => {
    expect(source).toContain('Unsupported image model:');
    expect(source).toContain('isSupportedImageModel(model)');
  });

  it('stays in sync with the client-side selectable catalog', () => {
    const selectable = openaiConfig.getConfig().supportedImageModels;
    for (const model of selectable) {
      expect(source, `${model} is selectable in the client but absent from the server allowlist`).toContain(`'${model}'`);
    }
  });
});
