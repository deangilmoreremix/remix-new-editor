import { RECIPES_02 } from './track-02.js';
import { RECIPES_03 } from './track-03.js';
import { RECIPES_04 } from './track-04.js';
import { RECIPES_05 } from './track-05.js';
import { RECIPES_06 } from './track-06.js';
import { RECIPES_07 } from './track-07.js';
import { RECIPES_08 } from './track-08.js';
import { RECIPES_09 } from './track-09.js';
import { RECIPES_10 } from './track-10.js';
import { RECIPES_11 } from './track-11.js';
import { RECIPES_12 } from './track-12.js';
import { RECIPES_13 } from './track-13.js';
import { RECIPES_14 } from './track-14.js';
import { RECIPES_15 } from './track-15.js';

// Recipe Registry — the single source of "Create With AI" recipes for the
// Academy. Template components call executeRecipe() and never duplicate
// generation/execution logic; the executor delegates to SmartVideo's existing
// router + studios.
//
// Recipe ids are referenced from src/data/academy/templates.ts (recipeId field).

const BASE_RECIPES = {
  'create-ugc-ad': {
    id: 'create-ugc-ad',
    title: 'Create UGC Ad',
    description: 'Generate a short UGC-style talking ad from a hook/pitch/proof/CTA script.',
    category: 'ugc',
    target: 'commercial',
    icon: 'Clapperboard',
    buildPrompt(ctx = {}) {
      const s = ctx.script || {};
      const lines = [s.hook?.line, s.problemPitch?.line, s.proofDemo?.line, s.cta?.line].filter(Boolean);
      const product = (s.product || ctx.product || '').toString().trim();
      return [
        `UGC-style short ad for: ${product}`,
        '',
        'Script (hook -> pitch -> proof -> CTA):',
        ...lines.map((l) => `• ${l}`),
        '',
        'Style: casual talking-head, 9:16, burned-in captions, natural lip-sync. Cut b-roll over the pitch/proof section.',
      ].join('\n');
    },
  },

  'create-ugc-campaign': {
    id: 'create-ugc-campaign',
    title: 'Create UGC Campaign',
    description: 'Produce a batch of ad variants from a hook × angle matrix.',
    category: 'ugc',
    target: 'director',
    icon: 'Layers',
    buildPrompt(ctx = {}) {
      const m = ctx.matrix || {};
      const rows = (m.rows || []).filter((r) => r.hook || r.angle);
      const lines = rows.map(
        (r, i) => `Ad ${i + 1}: hook="${r.hook}" | angle=${r.angle}${r.notes ? ` | ${r.notes}` : ''}`
      );
      return [
        `UGC ad batch for: ${m.product || ctx.product || ''}`.trim(),
        `Constants (held across all ads): ${m.constants || 'product, proof point, CTA'}`,
        '',
        ...lines,
        '',
        'Produce each variant with the same consistent character; vary only hook/angle per row. Deliver with a test plan labeling the varied axis.',
      ].join('\n');
    },
  },

  'create-consistent-character': {
    id: 'create-consistent-character',
    title: 'Create Consistent Character',
    description: 'Generate a reusable, reference-conditioned brand character.',
    category: 'ugc',
    target: 'character',
    icon: 'User',
    buildPrompt(ctx = {}) {
      const c = (ctx.character || ctx.product || '').toString().trim();
      return [
        'Create a consistent brand character for UGC ads.',
        `Reference/anchor description: ${c}`,
        '',
        'Use reference-image conditioning for every subsequent generation. Keep face shape, apparent age and distinguishing features identical across all shots. Drift-check before delivery.',
      ].join('\n');
    },
  },

  'ai-campaign-planner': {
    id: 'ai-campaign-planner',
    title: 'AI Campaign Planner',
    description: 'Turn an ad brief, teardown or outreach plan into a production plan.',
    category: 'ugc',
    target: 'director',
    icon: 'Sparkles',
    buildPrompt(ctx = {}) {
      const brief = ctx.brief || {};
      const parts = [];
      if (brief.product) parts.push(`Product: ${brief.product}`);
      if (brief.platforms) parts.push(`Platforms: ${brief.platforms}`);
      if (brief.variants) parts.push(`Variants: ${brief.variants}`);
      if (brief.tone) parts.push(`Tone: ${brief.tone}`);
      if (brief.constraints) parts.push(`Constraints: ${brief.constraints}`);
      if (brief.assets) parts.push(`Assets: ${brief.assets}`);
      if (brief.deadline) parts.push(`Deadline: ${brief.deadline}`);
      if (ctx.teardown) parts.push('Include a teardown-driven creative strategy.');
      if (ctx.outreach) parts.push('Include a client outreach plan.');
      return [
        'AI Campaign Planner — build a production plan from this brief:',
        ...parts.map((p) => `• ${p}`),
        '',
        'Output: script outline, batch matrix, character spec, and a test plan.',
      ].join('\n');
    },
  },
};

export const RECIPES = {
  ...BASE_RECIPES,
  ...RECIPES_02, ...RECIPES_03, ...RECIPES_04, ...RECIPES_05, ...RECIPES_06, ...RECIPES_07,
  ...RECIPES_08, ...RECIPES_09, ...RECIPES_10, ...RECIPES_11, ...RECIPES_12, ...RECIPES_13,
  ...RECIPES_14, ...RECIPES_15,
};

export function getRecipe(id) {
  return RECIPES[id];
}

export function listRecipes() {
  return Object.values(RECIPES);
}

export function getRecipePrompt(id, context = {}) {
  const r = getRecipe(id);
  return r ? r.buildPrompt(context) : '';
}
