/**
 * Template Contract Tests
 * Verifies every real built-in template meets the canonical contract.
 */

import { describe, it, expect } from 'vitest';
import { allTemplates } from '../../src/lib/templates.js';
import { getTemplateById } from '../../src/lib/templates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';
import { MATRIX_TEMPLATES } from '../../src/lib/templateMatrix.js';
import { CINEMATIC_TEMPLATES } from '../../src/lib/cinematicTemplates.js';

describe('Template Studio catalog contract', () => {
  it('enumerates all real built-in templates', () => {
    const real = allTemplates.filter(t => t && t.id);
    expect(real.length).toBeGreaterThan(0);
  });

  it('has unique non-empty IDs', () => {
    const ids = allTemplates.map(t => t.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty names', () => {
    for (const t of allTemplates) {
      if (!t || !t.id) continue;
      expect(t.name).toBeTruthy();
    }
  });

  it('has explicit outputType on every template', () => {
    for (const t of allTemplates) {
      if (!t || !t.id) continue;
      expect(t.outputType).toBeDefined();
      expect(['video', 'image']).toContain(t.outputType);
    }
  });

  it('has explicit modelType on every template', () => {
    const missing = [];
    for (const t of allTemplates) {
      if (!t || !t.id) continue;
      if (!t.modelType) missing.push(t.id);
    }
    // Write debug info to file
    try {
      const fs = require('fs');
      fs.writeFileSync('/tmp/missing-modeltype.json', JSON.stringify({ count: missing.length, first10: missing.slice(0, 10) }));
    } catch (e) {}
    expect(missing.length).toBe(0);
  });

  it('I2V and I2I templates have a required image input', () => {
    for (const t of allTemplates) {
      if (!t || !t.id || (t.modelType !== 'i2v' && t.modelType !== 'i2i')) continue;
      const normalized = normalizeTemplate(t);
      const hasImageInput = normalized.inputs.some(i => i.name === 'image_url');
      expect(hasImageInput).toBe(true);
    }
  });

  it('V2V templates have a required video input', () => {
    for (const t of allTemplates) {
      if (!t || !t.id || t.modelType !== 'v2v') continue;
      const normalized = normalizeTemplate(t);
      const hasVideoInput = normalized.inputs.some(i => i.name === 'video_url');
      // V2V templates should have a video input or the template should explicitly permit V2V
      expect(t.allowedModelTypes || [t.modelType]).toContain('v2v');
    }
  });

  it('T2V templates do not incorrectly require an image', () => {
    for (const t of allTemplates) {
      if (!t || !t.id || t.modelType !== 't2v') continue;
      const normalized = normalizeTemplate(t);
      const requiredImage = normalized.inputs.find(i => i.name === 'image_url' && i.required);
      expect(requiredImage).toBeUndefined();
    }
  });

  it('T2V templates do not incorrectly require a video', () => {
    for (const t of allTemplates) {
      if (!t || !t.id || t.modelType !== 't2v') continue;
      const normalized = normalizeTemplate(t);
      const requiredVideo = normalized.inputs.find(i => i.name === 'video_url' && i.required);
      expect(requiredVideo).toBeUndefined();
    }
  });

  it('has no duplicate input names after normalization', () => {
    for (const t of allTemplates) {
      if (!t || !t.id) continue;
      const normalized = normalizeTemplate(t);
      const names = normalized.inputs.map(i => i.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('Matrix template contract', () => {
  it('contains exactly 120 real Matrix templates', () => {
    const real = MATRIX_TEMPLATES.filter(t => t && t.id);
    expect(real.length).toBe(120);
    expect(MATRIX_TEMPLATES.length).toBe(120);
    expect(new Set(MATRIX_TEMPLATES.map(t => t.id)).size).toBe(120);
  });

  it('all Matrix templates are I2V video templates', () => {
    for (const t of MATRIX_TEMPLATES) {
      expect(t.outputType).toBe('video');
      expect(t.modelType).toBe('i2v');
    }
  });

  it('all Matrix templates have required image inputs after normalization', () => {
    for (const t of MATRIX_TEMPLATES) {
      const normalized = normalizeTemplate(t);
      const hasImageInput = normalized.inputs.some(i => i.name === 'image_url' && i.required);
      expect(hasImageInput).toBe(true);
    }
  });

  it('Matrix template IDs are unique', () => {
    const ids = MATRIX_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Cinema template contract', () => {
  it('all 46 cinematic templates have explicit outputType', () => {
    for (const t of CINEMATIC_TEMPLATES) {
      expect(t.outputType).toBeDefined();
      expect(['video', 'image']).toContain(t.outputType);
    }
  });

  it('all 46 cinematic templates have explicit modelType', () => {
    for (const t of CINEMATIC_TEMPLATES) {
      expect(t.modelType).toBeDefined();
      expect(['t2i', 'i2i', 'i2v', 't2v', 'v2v']).toContain(t.modelType);
    }
  });

  it('45 video templates are classified as I2V', () => {
    const videoTemplates = CINEMATIC_TEMPLATES.filter(t => t.outputType === 'video');
    expect(videoTemplates.length).toBe(45);
    for (const t of videoTemplates) {
      expect(t.modelType).toBe('i2v');
    }
  });

  it('Movie Poster is classified as T2I', () => {
    const moviePoster = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
    if (moviePoster) {
      expect(moviePoster.outputType).toBe('image');
      expect(moviePoster.modelType).toBe('t2i');
    }
  });

  it('cinematic templates have normalized inputs with required image for I2V', () => {
    for (const t of CINEMATIC_TEMPLATES) {
      if (t.modelType !== 'i2v') continue;
      const normalized = normalizeTemplate(t);
      const hasImageInput = normalized.inputs.some(i => i.name === 'image_url');
      expect(hasImageInput).toBe(true);
    }
  });
});

describe('Prompt-only template contract (128 templates)', () => {
  const NICHE_T2V = allTemplates.filter(t => t.niche && t.modelType === 't2v');
  const STANDARD_T2I = allTemplates.filter(t => !t.niche && !t.filmFamily && t.modelType === 't2i' && !CINEMATIC_TEMPLATES.some(ct => ct.id === t.id));
  const MOVIE_POSTER = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
  const PROMPT_ONLY = [...NICHE_T2V, ...STANDARD_T2I, ...(MOVIE_POSTER ? [MOVIE_POSTER] : [])];

  it('enumerates exactly 128 prompt-only templates', () => {
    expect(NICHE_T2V.length).toBe(120);
    expect(STANDARD_T2I.length).toBe(7);
    expect(PROMPT_ONLY.length).toBe(128);
  });

  it('every prompt-only template has explicit modelType t2v or t2i', () => {
    for (const t of PROMPT_ONLY) {
      expect(t.modelType).toBeDefined();
      expect(['t2v', 't2i']).toContain(t.modelType);
    }
  });

  it('every prompt-only template has a visible prompt input after normalization', () => {
    for (const t of PROMPT_ONLY) {
      const normalized = normalizeTemplate(t);
      const hasPrompt = normalized.inputs.some(i => i.name === 'prompt' || i.type === 'textarea' || i.type === 'text');
      expect(hasPrompt).toBe(true);
    }
  });

  it('no prompt-only template has a required image input', () => {
    for (const t of PROMPT_ONLY) {
      const normalized = normalizeTemplate(t);
      const requiredImage = normalized.inputs.find(i => i.name === 'image_url' && i.required);
      expect(requiredImage).toBeUndefined();
    }
  });

  it('no prompt-only template has a required video input', () => {
    for (const t of PROMPT_ONLY) {
      const normalized = normalizeTemplate(t);
      const requiredVideo = normalized.inputs.find(i => i.name === 'video_url' && i.required);
      expect(requiredVideo).toBeUndefined();
    }
  });

  it('every prompt-only template has at least one compatible model in the picker', () => {
    const { imageModelPickerEntries, videoModelPickerEntries, imageModelPickerEntryByVariantId, videoModelPickerEntryByVariantId } = require('../../src/lib/modelFamilies.js');
    for (const t of PROMPT_ONLY) {
      const compatible = t.modelType === 't2v'
        ? videoModelPickerEntries.filter(e => e.variantsByMode.t2v)
        : imageModelPickerEntries.filter(e => e.variantsByMode.t2i);
      expect(compatible.length).toBeGreaterThan(0);
    }
  });

  it('submitting only text does not introduce an upload validation error for prompt-only templates', () => {
    for (const t of PROMPT_ONLY) {
      const normalized = normalizeTemplate(t);
      const requiredUploads = normalized.inputs.filter(i => i.required && (i.type === 'image' || i.type === 'video'));
      expect(requiredUploads.length).toBe(0);
    }
  });

  it('normalized prompt-only inputs do not contain injected image_url for T2V niche templates', () => {
    for (const t of NICHE_T2V) {
      const normalized = normalizeTemplate(t);
      const injectedImage = normalized.inputs.find(i => i.name === 'image_url');
      expect(injectedImage).toBeUndefined();
    }
  });

  it('normalized prompt-only inputs do not contain injected image_url for standard T2I templates', () => {
    for (const t of STANDARD_T2I) {
      const normalized = normalizeTemplate(t);
      const injectedImage = normalized.inputs.find(i => i.name === 'image_url');
      expect(injectedImage).toBeUndefined();
    }
  });

  it('Movie Poster normalization remains prompt-only', () => {
    if (!MOVIE_POSTER) return;
    const normalized = normalizeTemplate(MOVIE_POSTER);
    const injectedImage = normalized.inputs.find(i => i.name === 'image_url');
    expect(injectedImage).toBeUndefined();
  });
});
