import { describe, it, expect } from 'vitest';
import { i2vModels } from '../../src/lib/models.js';
import { allTemplates } from '../../src/lib/templates.js';
import { CINEMATIC_TEMPLATES } from '../../src/lib/cinematicTemplates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';

// Video templates are generated with the Video Studio's video models, not the
// effect / camera-preset endpoints (AI Video Effects, Motion Controls, Video
// Effects, VFX), which need a preset name and ignore most of the prompt.
const EFFECT_FAMILIES = new Set(['effects']);
const effectIds = new Set(i2vModels.filter(m => EFFECT_FAMILIES.has(m.family)).map(m => m.id).concat(['video-effects', 'vfx']));

describe('video templates use general video models', () => {
  const videoTemplates = [...allTemplates, ...CINEMATIC_TEMPLATES].filter(t => t.outputType === 'video');

  it('has video templates to check', () => {
    expect(videoTemplates.length).toBeGreaterThan(100);
  });

  it('no video template defaults to an effect model', () => {
    const offenders = videoTemplates.filter(t => effectIds.has(t.model) || effectIds.has(normalizeTemplate(t)?.model)).map(t => t.id);
    expect(offenders).toEqual([]);
  });

  it('no video template carries an effect preset or effect select', () => {
    const offenders = videoTemplates.filter(t => {
      const n = normalizeTemplate(t);
      return t.defaultParams?.name || (n?.inputs || []).some(i => i && i.name === 'name');
    }).map(t => t.id);
    expect(offenders).toEqual([]);
  });
});

describe('template default models skip effect / tool models', () => {
  it('route defaults are general-purpose models', async () => {
    const { defaultModelForRoute, modelForRoute } = await import('../../src/lib/templateMedia.js');
    expect(defaultModelForRoute('i2v')).toBe('kling-v2.6-pro-i2v');
    expect(defaultModelForRoute('t2v')).toBe('kling-v2.6-pro-t2v');
    const { i2iModels } = await import('../../src/lib/models.js');
    const i2i = i2iModels.find(m => m.id === defaultModelForRoute('i2i'));
    expect(['tools', 'effects']).not.toContain(i2i.family);
    // An explicit pick from the picker is kept when it fits the route.
    expect(modelForRoute('i2v', 'veo3-image-to-video')).toBe('veo3-image-to-video');
  });

  it('switching mode keeps the model family (like the Video Studio)', async () => {
    const media = await import('../../src/lib/templateMedia.js');
    await media.whenModelFamiliesReady();
    const { videoModelPickerEntries } = await import('../../src/lib/modelFamilies.js');
    const fam = videoModelPickerEntries.find(e => e.variantsByMode.t2v && e.variantsByMode.i2v);
    expect(fam).toBeDefined();
    expect(media.modelForRoute('i2v', fam.variantsByMode.t2v.model.id)).toBe(fam.variantsByMode.i2v.model.id);
  });

  it('resolveModel falls back to a general model for templates without one', async () => {
    const models = await import('../../src/lib/models.js');
    const { resolveModel } = await import('../../src/lib/templateGenerationOrchestrator.js');
    const lists = { i2i: models.i2iModels, t2i: models.t2iModels, i2v: models.i2vModels, t2v: models.t2vModels, v2v: models.v2vModels };
    expect(resolveModel({ modelType: 'i2v' }, undefined, lists)).toBe('kling-v2.6-pro-i2v');
  });
});
