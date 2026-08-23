import { supabase } from './supabase.js';
import { apiKeyManager } from './apiKeyManager.js';
import {
  THUMBNAIL_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
} from './thumbnailTemplateRegistry.js';
import { getPresetForTemplate } from './thumbnailPresets.js';

const EDGE_FUNCTION = 'ai-thumbnail-generator';

function resolveUserOpenAIKey(optsApiKey) {
  if (optsApiKey) return optsApiKey;
  try {
    if (apiKeyManager && typeof apiKeyManager.getOpenAIKey === 'function') {
      return apiKeyManager.getOpenAIKey() || '';
    }
  } catch {
    // apiKeyManager not available in this context.
  }
  return '';
}

const CURATED_RECOMMENDATIONS = [
  { templateId: 'bold-headline', reason: 'Versatile high-performing template for most content types' },
  { templateId: 'creator-reaction', reason: 'Great for creator and personality-driven content' },
  { templateId: 'product-hero', reason: 'Clean, professional look for product and e-commerce content' },
  { templateId: 'listicle', reason: 'Drives curiosity with numbered content format' },
  { templateId: 'stat-number', reason: 'Quick-hitting data and metric emphasis' },
];

const SURPRISE_CONCEPTS = [
  { name: 'Neon Noir', concept: 'High-contrast noir thumbnail with neon accent lighting', headline: 'THE TRUTH THEY HIDE', requiresReference: false, referenceType: 'none' },
  { name: 'Chibi Explosion', concept: 'Cute chibi character amid cartoon explosion effects', headline: 'THIS CHANGED EVERYTHING', requiresReference: true, referenceType: 'face' },
  { name: 'Data Storm', concept: 'Abstract data visualization with particle effects and bold stat', headline: '300% GROWTH', requiresReference: false, referenceType: 'none' },
  { name: 'Product Launch Countdown', concept: 'Dramatic product reveal with countdown energy', headline: 'LAUNCHING SOON', requiresReference: true, referenceType: 'product' },
  { name: 'Blueprint Schematic', concept: 'Technical blueprint aesthetic with glowing lines', headline: 'HOW IT WORKS', requiresReference: false, referenceType: 'none' },
  { name: 'Retro VHS Glitch', concept: 'VHS tape aesthetic with scan lines and chromatic aberration', headline: 'RETRO VIBES ONLY', requiresReference: false, referenceType: 'none' },
];

/**
 * ThumbnailRecommendationService
 *
 * Client-side service that calls the Supabase edge function for
 * AI-powered template recommendations and "surprise me" concepts.
 */
export class ThumbnailRecommendationService {
  /**
   * @param {Object} [options]
   * @param {string} [options.edgeFunctionUrl]
   * @param {string} [options.userApiKey]
   */
  constructor(options = {}) {
    this.edgeFunctionUrl = options.edgeFunctionUrl || '/functions/v1/ai-thumbnail-generator';
    this.userApiKey = options.userApiKey || null;
  }

  /**
   * Request template recommendations from the edge function.
   * Validates returned templateIds against the local registry and falls
   * back to a curated list on failure.
   *
   * @param {Object} context
   * @param {string} [context.brief]
   * @param {string[]} [context.platforms]
   * @param {string} [context.aspectRatio]
   * @param {string} [context.category]
   * @param {string} [context.query]
   * @returns {Promise<{ recommended: Array<{ templateId: string; score: number; reason: string }> }>}
   */
  async getRecommendations(context = {}) {
    const { brief = '', platforms = [], aspectRatio, category, query } = context;

    try {
      const body = {
        action: 'recommend-templates',
        brief,
        platforms,
        aspectRatio,
        category,
        query,
        availableTemplateIds: Object.keys(THUMBNAIL_TEMPLATES),
      };

      const userKey = resolveUserOpenAIKey(this.userApiKey);
      if (userKey) body.apiKey = userKey;

      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });

      if (error || !data?.recommendations) {
        return this._curatedFallback(brief, platforms, category);
      }

      const validated = (data.recommendations || [])
        .filter((r) => typeof r?.templateId === 'string' && getTemplateById(r.templateId))
        .map((r) => ({
          templateId: r.templateId,
          score: typeof r.score === 'number' ? r.score : 50,
          reason: r.reason || getTemplateById(r.templateId)?.description || '',
        }));

      if (validated.length === 0) {
        return this._curatedFallback(brief, platforms, category);
      }

      return { recommended: validated };
    } catch {
      return this._curatedFallback(brief, platforms, category);
    }
  }

  /**
   * Request a "surprise me" concept from the edge function.
   * Falls back to a local curated concept list on failure.
   *
   * @param {Object} [context]
   * @param {string} [context.brief]
   * @param {string[]} [context.platforms]
   * @param {string} [context.category]
   * @returns {Promise<{ concept: { name: string; concept: string; headline: string; requiresReference: boolean; referenceType: string } }>}
   */
  async getSurpriseMe(context = {}) {
    const { brief = '', platforms = [], category } = context;

    try {
      const body = {
        action: 'surprise-me',
        brief,
        platforms,
        category,
      };

      const userKey = resolveUserOpenAIKey(this.userApiKey);
      if (userKey) body.apiKey = userKey;

      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });

      if (error || !data?.concept) {
        return { concept: this._localSurpriseConcept() };
      }

      const concept = data.concept;
      return {
        concept: {
          name: concept.name || 'Surprise Concept',
          concept: concept.concept || concept.description || '',
          headline: concept.headline || '',
          requiresReference: Boolean(concept.requiresReference),
          referenceType: concept.referenceType || 'none',
        },
      };
    } catch {
      return { concept: this._localSurpriseConcept() };
    }
  }

  _curatedFallback(brief, platforms, category) {
    let pool = [...CURATED_RECOMMENDATIONS];

    if (category) {
      const catTemplates = getTemplatesByCategory(category).map((t) => t.id);
      const catRecs = catTemplates.map((id) => ({
        templateId: id,
        score: 90,
        reason: `Matches ${category} category`,
      }));
      pool = [...catRecs, ...pool];
    }

    if (brief || platforms.length > 0) {
      const keywords = [brief, ...platforms].join(' ').toLowerCase();
      const scored = pool
        .map((r) => {
          const tpl = getTemplateById(r.templateId);
          if (!tpl) return null;
          const tagMatch = tpl.tags.some((tag) => keywords.includes(tag.toLowerCase()));
          const platMatch = platforms.some((p) => tpl.supportedPlatforms.includes(p));
          const score = r.score + (tagMatch ? 10 : 0) + (platMatch ? 5 : 0);
          return { ...r, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
      return { recommended: scored };
    }

    return { recommended: pool };
  }

  _localSurpriseConcept() {
    const idx = Math.floor(Math.random() * SURPRISE_CONCEPTS.length);
    return SURPRISE_CONCEPTS[idx];
  }

  /**
   * Resolve a recommendation to a full template object + preset.
   *
   * @param {{ templateId: string; score: number; reason: string }} rec
   * @returns {{ template: ReturnType<typeof getTemplateById>; preset: ReturnType<typeof getPresetForTemplate> }}
   */
  static resolveRecommendation(rec) {
    const template = getTemplateById(rec.templateId);
    const preset = template ? getPresetForTemplate(template) : undefined;
    return { template, preset };
  }
}

export default ThumbnailRecommendationService;
