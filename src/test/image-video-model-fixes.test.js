// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { i2iModels, t2iModels, t2vModels } from '../lib/models.js';
import { pickI2IModel, PREFERRED_I2I } from '../lib/imageStudioModels.js';
import { resolvePrefillModel, takePrefillModelName } from '../lib/prefillModel.js';

describe('Image Studio: adding a reference image picks a sensible model', () => {
  it('never lands on the utility models that open the i2i list', () => {
    expect(i2iModels[0].id).toBe('ai-image-upscaler'); // the model the old code picked
    for (const cur of ['flux-dev', 'nano-banana', 'ai-image-upscaler', 'ai-background-remover', 'nonsense', undefined]) {
      const m = pickI2IModel(cur);
      expect(m.family, `from ${cur}`).not.toBe('tools');
      expect(m.id).not.toBe('ai-image-upscaler');
      expect(i2iModels.some((x) => x.id === m.id)).toBe(true);
    }
  });
  it('uses the same-family editing variant of the current text-to-image model', () => {
    expect(pickI2IModel('nano-banana').id).toBe('nano-banana-edit');
  });
  it('keeps a model that already accepts images', () => {
    expect(pickI2IModel('nano-banana-edit').id).toBe('nano-banana-edit');
    expect(pickI2IModel('seedream-5.0-edit').id).toBe('seedream-5.0-edit');
  });
  it('falls back to the first preferred editing model', () => {
    expect(pickI2IModel('nonsense').id).toBe(PREFERRED_I2I[0]);
    for (const id of PREFERRED_I2I) expect(i2iModels.some((m) => m.id === id), `${id} exists`).toBe(true);
  });
  it('ImageStudio no longer hardcodes the first i2i model', () => {
    const src = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    expect(src).not.toContain('i2iModels[0]');
    expect(src.match(/pickI2IModel\(selectedModel\)/g)).toHaveLength(4);
  });
});

describe('model cards on the Text to Image / Video pages', () => {
  beforeEach(() => localStorage.clear());
  it('resolves by id or name, case-insensitively', () => {
    const flux = t2iModels.find((m) => m.id === 'flux-dev');
    expect(resolvePrefillModel(t2iModels, 'flux-dev')).toBe(flux);
    expect(resolvePrefillModel(t2iModels, flux.name)).toBe(flux);
    expect(resolvePrefillModel(t2iModels, `  ${flux.name.toUpperCase()} `)).toBe(flux);
  });
  it('returns null for unknown names (e.g. video names on the image page) and empty input', () => {
    for (const v of ['Sora', 'Veo 3', '', '   ', null, undefined]) expect(resolvePrefillModel(t2iModels, v)).toBeNull();
  });
  it('takePrefillModelName reads once and always clears the key', () => {
    localStorage.setItem('prefill_model', 'Whatever Model');
    expect(takePrefillModelName()).toBe('Whatever Model');
    expect(localStorage.getItem('prefill_model')).toBeNull();
    expect(takePrefillModelName()).toBeNull();
  });
  it('the studios use the helpers for their default model', () => {
    const img = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const vid = fs.readFileSync('src/components/VideoStudio.js', 'utf8');
    expect(img).toMatch(/resolvePrefillModel\(t2iModels, takePrefillModelName\(\)\)/);
    expect(vid).toMatch(/resolvePrefillModel\(t2vModels, takePrefillModelName\(\)\)/);
  });
  it('a real t2v model name is resolved for Video Studio', () => {
    const m = t2vModels[2];
    expect(resolvePrefillModel(t2vModels, m.name)?.id).toBe(m.id);
  });
});
