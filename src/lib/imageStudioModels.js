// Model choices for Image Studio that don't depend on the DOM (unit-testable).
import { i2iModels } from './models.js';
import { imageModelCatalog, getImageReferenceVariant } from './modelFamilies.js';

// Editing models that take a prompt plus reference images, best default first.
export const PREFERRED_I2I = [
  'seedream-5.0-edit',
  'nano-banana-edit',
  'flux-kontext-pro-i2i',
  'nano-banana-pro-edit',
  'bytedance-seedream-edit-v4',
  'flux-kontext-dev-i2i',
];

// The first image-to-image models are one-click utilities (upscaler, background remover, ...):
// they have no prompt, so they are never a sensible default for "I added a reference image".
const usable = (m) => Boolean(m) && m.family !== 'tools' && m.hasPrompt !== false;

/**
 * Which image-to-image model to switch to when the user adds a reference image.
 * Keeps the current model if it already accepts images; else its same-family
 * editing variant (nano-banana -> nano-banana-edit); else a preferred editing model.
 */
export function pickI2IModel(currentId, { models = i2iModels, catalog = imageModelCatalog } = {}) {
  const byId = (id) => models.find((m) => m.id === id);
  const current = byId(currentId);
  if (usable(current)) return current;
  try {
    const family = catalog?.familyByVariantId?.get(currentId);
    if (family) {
      const v = getImageReferenceVariant(catalog, family, currentId);
      const sibling = byId(v?.model?.id || v?.id);
      if (usable(sibling)) return sibling;
    }
  } catch { /* fall through to the preferred list */ }
  for (const id of PREFERRED_I2I) {
    const m = byId(id);
    if (usable(m)) return m;
  }
  return models.find(usable) || models[0];
}
