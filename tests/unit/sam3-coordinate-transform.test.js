// tests/unit/sam3-coordinate-transform.test.js
//
// Verifies the preview→source coordinate translation used before sending
// point/box prompts to fal-ai/sam-3/video.

import { describe, it, expect } from 'vitest';
import {
  computePreviewToSourceMap,
  previewPointToSourcePoint,
  previewBoxToSourceBox,
} from '../../src/lib/editor/sam3CoordinateTransform.js';

describe('sam3 coordinate transform', () => {
  it('computes correct map for letterboxed contain fit', () => {
    // Preview 960x540 (16:9), source 1920x1080 (16:9) -> identity scale, no offset
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 960, height: 540 },
      1920,
      1080,
      'contain',
    );
    expect(map.scale).toBe(2);
    expect(map.offsetX).toBe(0);
    expect(map.offsetY).toBe(0);
  });

  it('adds letterbox offsets when preview aspect ratio differs', () => {
    // Preview 1920x540 (very wide, 3.56 AR), source 1920x1080 (16:9, 1.78 AR).
    // contain: renderedW = previewW = 1920, renderedH = 1920 / 1.777 = 1080.
    // The source extends above and below the preview; offsetY is negative.
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 1920, height: 540 },
      1920,
      1080,
      'contain',
    );
    expect(map.renderedW).toBe(1920);
    expect(map.renderedH).toBe(1080);
    expect(map.offsetX).toBe(0);
    expect(map.offsetY).toBeCloseTo(-270, 0);
  });

  it('adds pillarbox offsets when preview is narrower than source', () => {
    // Preview 540x1920 (9:16 portrait), source 1920x1080 (16:9).
    // contain: previewAR = 0.281, sourceAR = 1.777. previewAR < sourceAR,
    // renderedH = previewH = 1920, renderedW = 1920 * 1.777 = 3413.3.
    // Source extends left/right; offsetX negative.
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 540, height: 1920 },
      1920,
      1080,
      'contain',
    );
    expect(map.renderedH).toBe(1920);
    expect(map.renderedW).toBeCloseTo(3413.3, 0);
    expect(map.offsetY).toBe(0);
  });

  it('maps a preview point to a source point', () => {
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 960, height: 540 },
      1920,
      1080,
      'contain',
    );
    const src = previewPointToSourcePoint({ x: 480, y: 270 }, map);
    expect(src.x).toBe(960);
    expect(src.y).toBe(540);
  });

  it('maps a preview box to a source box clamped to source bounds', () => {
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 960, height: 540 },
      1920,
      1080,
      'contain',
    );
    const src = previewBoxToSourceBox({ x: 100, y: 50, width: 200, height: 100 }, map, 1920, 1080);
    expect(src.xMin).toBe(200);
    expect(src.yMin).toBe(100);
    expect(src.xMax).toBe(600);
    expect(src.yMax).toBe(300);
  });

  it('clamps to source dimensions', () => {
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 960, height: 540 },
      1920,
      1080,
      'contain',
    );
    const src = previewBoxToSourceBox({ x: 900, y: 500, width: 200, height: 200 }, map, 1920, 1080);
    expect(src.xMax).toBeLessThanOrEqual(1920);
    expect(src.yMax).toBeLessThanOrEqual(1080);
  });

  it('handles cover fit correctly', () => {
    // Preview 1920x1080 (16:9), source 1080x1920 (9:16 portrait).
    // cover: renderedH = 1080, renderedW = 1080*1080/1920 = 607.5
    // offsetX = (1920 - 607.5) / 2 = 656.25
    const map = computePreviewToSourceMap(
      { x: 0, y: 0, width: 1920, height: 1080 },
      1080,
      1920,
      'cover',
    );
    expect(map.renderedW).toBeCloseTo(607.5, 1);
    expect(map.renderedH).toBe(1080);
    expect(map.offsetX).toBeCloseTo(656.25, 1);
  });
});
