// src/lib/editor/sam3CoordinateTransform.js
//
// Translate user interactions on the Timeline preview into the source media's
// native pixel coordinate system so fal-ai/sam-3/video receives correct
// x/y/x_min/x_max coordinates regardless of letterboxing, object-fit, scale,
// crop, or preview offset.

/**
 * Compute the mapping from preview-space (CSS pixels of the visible preview
 * element) into source-space (native pixels of the underlying media).
 *
 * previewRect  - bounding rect of the visible preview element in CSS pixels
 * sourceWidth  - native width  of the source media
 * sourceHeight - native height of the source media
 * fitMode      - 'contain' (default, letterbox/pillarbox) | 'cover' | 'fill'
 * offset       - optional {x, y} pixel offset applied after fit (e.g. UI overlays)
 *
 * Returns { scale, offsetX, offsetY, renderedW, renderedH } describing how a
 * preview CSS pixel maps to a source pixel: src = (preview - offset) * scale.
 */
export function computePreviewToSourceMap(previewRect, sourceWidth, sourceHeight, fitMode = 'contain', offset = { x: 0, y: 0 }) {
  if (!previewRect || previewRect.width <= 0 || previewRect.height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0, renderedW: sourceWidth, renderedH: sourceHeight };
  }
  const previewW = previewRect.width;
  const previewH = previewRect.height;
  const previewAR = previewW / previewH;
  const sourceAR = sourceWidth / sourceHeight;

  let renderedW, renderedH;
  if (fitMode === 'cover') {
    if (previewAR > sourceAR) {
      renderedH = previewH;
      renderedW = previewH * sourceAR;
    } else {
      renderedW = previewW;
      renderedH = previewW / sourceAR;
    }
  } else if (fitMode === 'fill') {
    renderedW = previewW;
    renderedH = previewH;
  } else {
    // contain (default)
    if (previewAR > sourceAR) {
      renderedW = previewW;
      renderedH = previewW / sourceAR;
    } else {
      renderedH = previewH;
      renderedW = previewH * sourceAR;
    }
  }
  const offsetX = (previewW - renderedW) / 2 + (offset?.x || 0);
  const offsetY = (previewH - renderedH) / 2 + (offset?.y || 0);
  const scale = sourceWidth / renderedW;
  return { scale, offsetX, offsetY, renderedW, renderedH };
}

/**
 * Convert a single preview point to a source point.
 */
export function previewPointToSourcePoint(previewPoint, map) {
  if (!previewPoint || !map) return null;
  return {
    x: Math.round((previewPoint.x - map.offsetX) * map.scale),
    y: Math.round((previewPoint.y - map.offsetY) * map.scale),
  };
}

/**
 * Convert a preview rectangle (x, y, width, height in CSS pixels) to a source
 * bounding box in source pixels. Clamps to source bounds.
 */
export function previewBoxToSourceBox(previewBox, map, sourceWidth, sourceHeight) {
  if (!previewBox || !map) return null;
  const x1 = (previewBox.x - map.offsetX) * map.scale;
  const y1 = (previewBox.y - map.offsetY) * map.scale;
  const x2 = (previewBox.x + (previewBox.width || 0) - map.offsetX) * map.scale;
  const y2 = (previewBox.y + (previewBox.height || 0) - map.offsetY) * map.scale;
  return {
    xMin: Math.max(0, Math.min(sourceWidth, Math.round(Math.min(x1, x2)))),
    yMin: Math.max(0, Math.min(sourceHeight, Math.round(Math.min(y1, y2)))),
    xMax: Math.max(0, Math.min(sourceWidth, Math.round(Math.max(x1, x2)))),
    yMax: Math.max(0, Math.min(sourceHeight, Math.round(Math.max(y1, y2)))),
  };
}
