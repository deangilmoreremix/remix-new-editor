/**
 * Catalog health for every Template Studio + Cinema Template Studio template:
 * anything listed here would stop or silently degrade a generation.
 * Durations a model rejects are not listed: the studios' duration control
 * snaps them to a supported value. Effect models without an effect input or
 * preset are not listed either: the studios offer an effect picker.
 */
import { it, expect } from 'vitest';
import * as models from '../../src/lib/models.js';
import { allTemplates } from '../../src/lib/templates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';
import { CINEMATIC_TEMPLATES } from '../../src/lib/cinematicTemplates.js';
import { resolveModel } from '../../src/lib/templateGenerationOrchestrator.js';

const LISTS = { t2i: models.t2iModels, i2i: models.i2iModels, i2v: models.i2vModels, t2v: models.t2vModels, v2v: models.v2vModels };
const find = (type, id) => (LISTS[type] || []).find(m => m.id === id);

it('every template resolves to a working model, inputs and options', () => {
  const issues = {};
  const add = (k, v) => { (issues[k] = issues[k] || []).push(v); };
  const seen = new Set();

  const all = [...allTemplates, ...CINEMATIC_TEMPLATES.filter(t => !allTemplates.some(a => a.id === t.id))];
  for (const raw of all) {
    if (seen.has(raw.id)) { add('duplicate id', raw.id); continue; }
    seen.add(raw.id);
    const t = normalizeTemplate(raw);
    if (!t) { add('normalize returned null', raw.id); continue; }
    const type = t.modelType;
    if (!LISTS[type]) { add('unknown modelType', `${raw.id}:${type}`); continue; }
    const out = t.outputType;
    if ((out === 'video') !== ['t2v', 'i2v', 'v2v'].includes(type)) add('outputType/modelType mismatch', `${raw.id}:${out}/${type}`);

    if (raw.model && !Object.values(LISTS).some(l => l.some(m => m.id === raw.model))) add('template model not in catalog', `${raw.id}:${raw.model}`);
    const resolved = resolveModel(t, undefined, LISTS);
    const m = find(type, resolved);
    if (!m && !(type === 't2v' && find('v2v', resolved))) add('resolved model not valid for type', `${raw.id}:${type}:${resolved}`);

    const inputs = [...(t.inputs || [])];
    const names = inputs.map(i => i && i.name);
    for (const i of inputs) {
      if (!i || !i.name || !i.type) { add('malformed input', `${raw.id}:${JSON.stringify(i)}`); continue; }
      if (i.type === 'select' && (!Array.isArray(i.options) || i.options.length === 0)) add('select without options', `${raw.id}:${i.name}`);
    }
    const hasPromptish = inputs.some(i => ['text', 'textarea'].includes(i.type)) || !!t.basePrompt;
    if (!hasPromptish) add('no prompt source', raw.id);

    const fxEnum = m?.inputs?.name?.enum;
    if (fxEnum) {
      const nameInput = inputs.find(i => i.name === 'name');
      const preset = t.defaultParams?.name ?? raw.defaultParams?.name;
      if (preset && !fxEnum.includes(preset)) add('effect preset not accepted by model', `${raw.id}:${resolved}:${preset}`);
      if (nameInput) { const bad = (nameInput.options || []).filter(o => !fxEnum.includes(o)); if (bad.length) add('effect options not accepted', `${raw.id}:${bad.join('/')}`); }
    }

    // aspect ratio options vs model support
    const arInput = inputs.find(i => i.name === 'aspect_ratio');
    const modelAR = m?.inputs?.aspect_ratio?.enum;
    if (arInput && modelAR && arInput.options) {
      const bad = arInput.options.filter(o => !modelAR.includes(o));
      if (bad.length) add('aspect ratio options model rejects', `${raw.id}:${resolved}:${bad.join('/')}`);
    }
    if (!arInput && modelAR && t.aspectRatio && !modelAR.includes(t.aspectRatio)) add('template aspectRatio model rejects', `${raw.id}:${resolved}:${t.aspectRatio}`);
  }
  const summary = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, { count: v.length, sample: v.slice(0, 6) }]));
  expect(seen.size).toBeGreaterThanOrEqual(338);
  expect(summary).toEqual({});
});
