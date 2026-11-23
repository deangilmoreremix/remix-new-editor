import { describe, it, expect } from 'vitest';
import appsMap from '../data/muapiStudioAppsMap.json';
import prompts from '../data/muapiAppPrompts.json';
import { MUAPI_APP_TEMPLATES, MUAPI_APP_CATEGORIES, buildMuapiAppTemplate } from '../lib/muapiAppTemplates.js';
import { allTemplates, TEMPLATE_CATEGORIES, getTemplateById } from '../lib/templates.js';
import { normalizeTemplate } from '../lib/templateAdapter.js';
import { t2iModels, i2iModels, t2vModels, i2vModels, v2vModels } from '../lib/models.js';
import { composeTemplatePrompt } from '../lib/templatePromptComposer.js';

const catalogIds = new Set([t2iModels, i2iModels, t2vModels, i2vModels, v2vModels].flat().map((m) => m.id));

describe('muapi Studio app templates', () => {
  it('has one template per mapped app (78)', () => {
    expect(appsMap.apps).toHaveLength(78);
    expect(MUAPI_APP_TEMPLATES).toHaveLength(78);
  });

  it('uses unique muapi- ids that never collide with other templates', () => {
    const ids = MUAPI_APP_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id.startsWith('muapi-')).toBe(true));
    const others = allTemplates.filter((t) => !t.id.startsWith('muapi-')).map((t) => t.id);
    ids.forEach((id) => expect(others).not.toContain(id));
  });

  it('is registered in allTemplates and the category list', () => {
    expect(getTemplateById('muapi-angles')?.name).toBe('Angles');
    Object.values(MUAPI_APP_CATEGORIES).forEach((c) => expect(Object.values(TEMPLATE_CATEGORIES)).toContain(c));
  });

  it('every template points at a real catalog model and a valid route', () => {
    for (const t of MUAPI_APP_TEMPLATES) {
      expect(catalogIds.has(t.model), `${t.id} -> ${t.model}`).toBe(true);
      expect(['i2i', 'i2v', 'v2v']).toContain(t.modelType);
      expect(['image', 'video']).toContain(t.outputType);
    }
  });

  it('covers every required media field from the map and sets no niche', () => {
    for (const app of appsMap.apps) {
      const t = MUAPI_APP_TEMPLATES.find((x) => x.id === `muapi-${app.id}`);
      expect(t.niche).toBeUndefined();
      const media = t.inputs.filter((i) => ['image', 'frame', 'video'].includes(i.type));
      expect(media.length, app.id).toBe(app.studio.mediaInputs.length);
      app.studio.mediaInputs.filter((m) => m.required).forEach((m) => {
        expect(media.some((i) => i.required), `${app.id} ${m.key}`).toBe(true);
      });
    }
  });

  it('select inputs list a default first and have no duplicates', () => {
    for (const t of MUAPI_APP_TEMPLATES) {
      for (const i of t.inputs.filter((x) => x.type === 'select')) {
        expect(i.options.length, `${t.id}.${i.name}`).toBeGreaterThan(0);
        expect(new Set(i.options).size).toBe(i.options.length);
      }
    }
  });

  it('every preset app has an original prompt and prompts contain {prompt}', () => {
    for (const app of appsMap.apps.filter((a) => a.status === 'preset')) {
      expect(prompts.apps[app.id], app.id).toBeTruthy();
      expect(prompts.apps[app.id]).toContain('{prompt}');
    }
    for (const app of appsMap.apps.filter((a) => a.studio.presets.length)) {
      app.studio.presets.forEach((p) => expect(prompts.presets[app.id]?.[p.label], `${app.id}/${p.label}`).toBeTruthy());
    }
  });

  it('does not reuse muapi prompt text (no copied phrases from the studio config)', () => {
    const json = JSON.stringify(prompts).toLowerCase();
    expect(json).not.toContain('industry-leading');
    expect(prompts._note).toMatch(/NOT muapi/);
  });

  it('never borrows unrelated stock thumbnails; only its own file is tried', async () => {
    const { getTemplateThumbnailCandidates } = await import('../lib/thumbnails.js');
    for (const t of MUAPI_APP_TEMPLATES) {
      // Both the raw template and the normalized copy the studio passes in.
      for (const shape of [t, normalizeTemplate(t), t.id]) {
        const c = getTemplateThumbnailCandidates(shape);
        expect(c.every((p) => p.includes(`/thumbnails/templates/${t.id}.webp`)), t.id).toBe(true);
      }
    }
    // Other templates keep the old fallback chain.
    expect(getTemplateThumbnailCandidates(getTemplateById('face-swap')).length).toBeGreaterThan(2);
  });

  it('keeps the Skin Enhancer with its note', () => {
    const t = MUAPI_APP_TEMPLATES.find((x) => x.id === 'muapi-skin-enhancer');
    expect(t).toBeTruthy();
    expect(t.muapiApp.notes).toMatch(/retoucher/);
    expect(t.muapiApp.warning).toMatch(/temporarily unavailable/);
    // Only the known-issue app carries a warning.
    expect(MUAPI_APP_TEMPLATES.filter((x) => x.muapiApp.warning).map((x) => x.id)).toEqual(['muapi-skin-enhancer']);
  });

  it('normalizes and composes a prompt for a preset app', () => {
    const t = getTemplateById('muapi-angles');
    const n = normalizeTemplate(t);
    expect(n.model).toBe(t.model);
    const { prompt } = composeTemplatePrompt({ template: n, userPrompt: 'a red sports car', templateInputs: n.inputs, fields: { adj_rotation: 'camera rotated 45 degrees around the subject' } });
    expect(prompt).toMatch(/red sports car/);
    expect(prompt).toMatch(/rotated 45 degrees/);
  });

  it('builds a template from a minimal app entry', () => {
    const app = appsMap.apps.find((a) => a.id === 'mukbang');
    const t = buildMuapiAppTemplate(app);
    expect(t.outputType).toBe('video');
    expect(t.muapiApp.defaultCostUsd).toBe(app.studio.defaultCostUsd);
  });
});
