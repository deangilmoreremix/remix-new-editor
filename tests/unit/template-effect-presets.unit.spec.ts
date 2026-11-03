import { describe, it, expect } from 'vitest';
import { i2vModels } from '../../src/lib/models.js';
import { templates } from '../../src/lib/templates.js';

// Effect endpoints (generate_wan_ai_effects) reject a request without a valid
// `name` preset, so every effect template must offer one the API accepts.
const EFFECT_MODELS = ['ai-video-effects', 'motion-controls'];

describe('effect templates offer a valid effect preset', () => {
  const effectTemplates = templates.filter(t => EFFECT_MODELS.includes(t.model));

  it('has effect templates to check', () => {
    expect(effectTemplates.length).toBeGreaterThan(0);
  });

  it.each(effectTemplates.map(t => [t.id, t]))('%s', (_id, t: any) => {
    const allowed = new Set(i2vModels.find(m => m.id === t.model)?.inputs?.name?.enum || []);
    const inputs = [...(t.inputs || []), ...(t.quickInputs || []), ...(t.advancedInputs || [])];
    const nameInput = inputs.find(i => i.name === 'name');
    expect(nameInput, 'template needs an effect (`name`) select').toBeDefined();
    expect(nameInput.options.length).toBeGreaterThan(0);
    nameInput.options.forEach(o => expect(allowed.has(o)).toBe(true));
  });
});

describe('template default models skip effect / tool models', () => {
  it('route defaults are general-purpose models', async () => {
    const { defaultModelForRoute, modelForRoute } = await import('../../src/lib/templateMedia.js');
    expect(defaultModelForRoute('i2v')).toBe('kling-v2.6-pro-i2v');
    expect(defaultModelForRoute('t2v')).toBe('kling-v2.6-pro-t2v');
    const i2i = i2vModels && (await import('../../src/lib/models.js')).i2iModels.find(m => m.id === defaultModelForRoute('i2i'));
    expect(['tools', 'effects']).not.toContain(i2i.family);
    // An explicit effect model is kept when it fits the route.
    expect(modelForRoute('i2v', 'ai-video-effects')).toBe('ai-video-effects');
  });

  it('resolveModel falls back to a general model for templates without one', async () => {
    const models = await import('../../src/lib/models.js');
    const { resolveModel } = await import('../../src/lib/templateGenerationOrchestrator.js');
    const lists = { i2i: models.i2iModels, t2i: models.t2iModels, i2v: models.i2vModels, t2v: models.t2vModels, v2v: models.v2vModels };
    expect(resolveModel({ modelType: 'i2v' }, undefined, lists)).toBe('kling-v2.6-pro-i2v');
    expect(resolveModel({ modelType: 'i2v', model: 'ai-video-effects' }, undefined, lists)).toBe('ai-video-effects');
  });
});
