// createThisStyle.js
//
// Client entry point for the "Create This Style" action on a Minimax demo.
//
//   1. POST /api/templates/from-demo  → { styleTemplate, draftId, owned }
//   2. hydrate styleTemplateStore
//   3. stageStudioPrefill (existing channel the target studio reads on mount)
//   4. navigate to the studio's ROUTE KEY (the hash-routed SPA expects route
//      keys like 'video'/'cinema', NOT display names like 'VideoStudio').
//
// Local fallback: if the backend is unavailable (e.g. dev without the server),
// we fall back to the curated preset in src/data/minimax/presets.js so the UI
// still works.

import { stageStudioPrefill } from '../studioPrefill.js';
import { styleTemplateStore } from '../../stores/styleTemplateStore.js';
import { MODEL_FOR_TARGET } from '../../data/minimaxH3Demos.js';

// Preset.targetStudio is a display name ("VideoStudio"); the router/prefill
// need the route KEY ("video"). This is the single mapping for that.
const TARGET_STUDIO_TO_ROUTE = {
  VideoStudio: 'video',
  CinemaStudio: 'cinema',
  EditStudio: 'edit',
  ImageStudio: 'image',
  AudioStudio: 'audio',
  AvatarStudio: 'avatar',
  CharacterStudio: 'character',
  TemplateStudio: 'templates',
};

function makeDraftId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Open the studio pre-filled with the style derived from a Minimax demo.
 * @param {string} slug  preset slug (matches minimaxH3Demos + presets.json)
 * @returns {Promise<{styleTemplate:object, draftId:string, owned:boolean, route:string}>}
 */
export async function createThisStyle(slug) {
  if (!slug) throw new Error('createThisStyle requires a slug');

  let styleTemplate;
  let draftId;
  let owned = false;

  try {
    const res = await fetch('/api/templates/from-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) throw new Error(`backend_error_${res.status}`);
    const data = await res.json();
    styleTemplate = data.styleTemplate;
    draftId = data.draftId;
    owned = Boolean(data.owned);
  } catch (err) {
    // No backend (e.g. dev without the server) → use the local preset.
    const { getPreset } = await import('../../data/minimax/presets.js');
    const preset = getPreset(slug);
    if (!preset) throw new Error(`unknown_slug: ${slug}`);
    styleTemplate = { ...preset, derivativeOnly: true, metadata: { derivativeOnly: true } };
    draftId = makeDraftId();
  }

  const route = TARGET_STUDIO_TO_ROUTE[styleTemplate.targetStudio] || 'video';
  const model = MODEL_FOR_TARGET[route] || MODEL_FOR_TARGET.video;

  styleTemplateStore.load(styleTemplate, draftId);

  stageStudioPrefill({
    route,
    model,
    prompt: styleTemplate.prompt,
    params: {
      aspect_ratio: styleTemplate.aspectRatio,
      prompt: styleTemplate.prompt,
      negativePrompt: styleTemplate.negativePrompt,
      motionStrength: styleTemplate.motionProfile?.strength,
      _sourceSlug: slug,
      _sourceTitle: styleTemplate.title,
      // Forward licensing/credit metadata so an export can watermark the source.
      author: styleTemplate.author,
      rightsNote: styleTemplate.rightsNote,
      derivativeOnly: styleTemplate.derivativeOnly || owned === false,
    },
    ref: 'minimax-h3',
  });

  // Reuse the same router.navigate that openDemoInStudio relies on.
  const { navigate } = await import('../router.js');
  navigate(route);

  return { styleTemplate, draftId, owned, route };
}

export default createThisStyle;
