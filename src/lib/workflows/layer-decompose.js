/**
 * Layer decompose utilities (ported from CineGen).
 * Only the subset needed by model-node is included.
 */

export const LAYER_DECOMPOSE_STAGE_PROGRESS = {
  init: 4,
  ocr: 14,
  segmentation: 42,
  masks: 58,
  extraction: 74,
  inpainting: 88,
  saving: 96,
};

export const LAYER_DECOMPOSE_STAGE_LABELS = {
  init: 'Preparing image',
  ocr: 'Separating text',
  segmentation: 'Finding layers',
  masks: 'Cleaning masks',
  extraction: 'Extracting layers',
  inpainting: 'Rebuilding plate',
  saving: 'Saving layers',
};

export function isLayerDecomposeNodeType(nodeType) {
  return nodeType === 'layer-decompose' || nodeType === 'layer-decompose-cloud';
}

export function getLayerDecomposeStageProgress(stage) {
  if (!stage) return undefined;
  return LAYER_DECOMPOSE_STAGE_PROGRESS[stage];
}

export function getLayerDecomposeStageLabel(stage) {
  if (!stage) return undefined;
  return LAYER_DECOMPOSE_STAGE_LABELS[stage];
}
