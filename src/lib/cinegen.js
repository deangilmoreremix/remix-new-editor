/**
 * CineGen Integration Layer
 * Maps CineGen Elements + AI Edit Tools to MuAPI + existing SmartVideo stack
 * Production-ready with error handling
 */
import { muapi } from './muapi.js';
import { resolveForCineGen } from '../components/personalize/studioBridge.js';

/**
 * Merge the personalization slice (persona reference images + CTA copy) into
 * outgoing studio params.
 *
 * STUDIO-SUPPLIED VALUES ALWAYS WIN: the merge only fills keys the studio did
 * not set, so an explicit `image_url` / `images_list` / `prompt` is never
 * clobbered. With no personalization data the personalization resolver
 * returns neutral values and this is a no-op copy of `params`.
 *
 * @param {object} params - the studio's existing params
 * @returns {object} params + personalization gaps filled
 */
function withPersonalization(params = {}) {
  const merged = { ...params };
  const personalization = resolveForCineGen(params);
  if (personalization.image_url && !merged.image_url) {
    merged.image_url = personalization.image_url;
  }
  if (!merged.images_list?.length && personalization.images_list?.length) {
    merged.images_list = personalization.images_list;
  }
  if (
    personalization.promptSuffix &&
    typeof merged.prompt === 'string' &&
    !merged.prompt.includes(personalization.promptSuffix)
  ) {
    merged.prompt = `${merged.prompt}${personalization.promptSuffix}`;
  }
  return merged;
}

export const cinegen = {
  async generateElement(params) {
    try {
      const merged = withPersonalization(params);
      const result = await muapi.generateImage({
        prompt: merged.prompt,
        model: merged.model || 'flux-dev',
        ...merged
      });
      return {
        success: true,
        data: result,
        error: null
      };
    } catch (error) {
      console.error('[CineGen] Element generation failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Element generation failed'
      };
    }
  },

  async applyEditTool(tool, params) {
    try {
      let result;
      switch (tool) {
        case 'gap-fill':
          result = await muapi.generateVideoEffect({ type: 'gap-fill', ...params });
          break;
        case 'extend':
          // The file's video entry point: persona references + CTA copy flow
          // into the existing MuAPI call through the same studio-first merge.
          result = await muapi.generateVideo(withPersonalization({ prompt: params.prompt, duration: params.extendDuration, ...params }));
          break;
        case 'music':
          result = await muapi.generateAudio({ type: 'music', prompt: params.prompt, ...params });
          break;
        default:
          throw new Error(`Unknown CineGen edit tool: ${tool}`);
      }
      return {
        success: true,
        data: result,
        error: null
      };
    } catch (error) {
      console.error(`[CineGen] Edit tool "${tool}" failed:`, error);
      return {
        success: false,
        data: null,
        error: error.message || `Edit tool "${tool}" failed`
      };
    }
  },

  async getElementsForTimeline(projectId) {
    try {
      const elements = await muapi.listAssets({ project: projectId, category: 'element' });
      return {
        success: true,
        data: elements.map(el => ({ ...el, source: 'cinegen', editable: true })),
        error: null
      };
    } catch (error) {
      console.error('[CineGen] Failed to fetch elements:', error);
      return {
        success: false,
        data: [],
        error: error.message || 'Failed to fetch elements'
      };
    }
  }
};

export default cinegen;
