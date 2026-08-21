// Unified template resolver for all 3 showcase repos.
//
// Replaces the old minimaxTemplates.js which only covered the 30-demo
// Anil-matcha minimaxH3Demos.js. This resolver handles:
//   - minimax-h3-*  → beatapiMinimaxH3Demos.js (253 demos)
//   - seedance-2.5-* → beatapiSeedance25Demos.js (242 demos)
//   - seedance-2.0-* → zeroLuDemos.js (17 demos)
//
// Studios import this single resolver instead of getMinimaxTemplateById().

import { minimaxH3Demos, MINIMAX_MODEL } from '../data/beatapiMinimaxH3Demos.js';
import { seedance25Demos, SEEDANCE_MODEL } from '../data/beatapiSeedance25Demos.js';
import { zeroLuDemos, ZERO_LU_MODEL } from '../data/zeroLuDemos.js';

/** Fast lookup: templateId → demo object with source/model metadata. */
const TEMPLATE_MAP = new Map();

minimaxH3Demos.forEach((demo) => {
  TEMPLATE_MAP.set(`minimax-h3-${demo.slug}`, {
    ...demo,
    source: 'minimaxh3',
    model: MINIMAX_MODEL,
    templateId: `minimax-h3-${demo.slug}`,
  });
});

seedance25Demos.forEach((demo) => {
  TEMPLATE_MAP.set(`seedance-2.5-${demo.slug}`, {
    ...demo,
    source: 'seedance25',
    model: SEEDANCE_MODEL,
    templateId: `seedance-2.5-${demo.slug}`,
  });
});

zeroLuDemos.filter((demo) => demo.videoSrc).forEach((demo) => {
  TEMPLATE_MAP.set(`seedance-2.0-${demo.slug}`, {
    ...demo,
    source: 'zeroLu',
    model: ZERO_LU_MODEL,
    templateId: `seedance-2.0-${demo.slug}`,
  });
});

/**
 * Resolve a template ID (from the `template` URL param) to a studio-ready
 * template object.
 *
 * @param {string} templateId - e.g. "minimax-h3-cinematic-wide-shot", "seedance-2.5-action-sequence"
 * @returns {{ id, name, model, aspectRatio, duration, prompt, category, useCase, posterSrc, videoSrc, source }} | null
 */
export function resolveTemplate(templateId) {
  if (!templateId || typeof templateId !== 'string') return null;
  return TEMPLATE_MAP.get(templateId) || null;
}

/**
 * Returns true if the given templateId can be resolved.
 * Useful for feature flags or conditional UI.
 */
export function hasTemplate(templateId) {
  return TEMPLATE_MAP.has(templateId);
}

/**
 * Total number of resolvable templates across all 3 sources.
 */
export function getTemplateCount() {
  return TEMPLATE_MAP.size;
}
