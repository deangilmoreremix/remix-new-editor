// [remix] Turns OpenChatCut's tracking result (TrackingPoint[] in source-normalised coordinates) into the
// ReframeCurveV1 their zoom already understands (`ZoomEffect.reframeCurve`), so the zoom follows the tracked subject.
import type { TrackingPoint } from '../../../openchatcut/tracking/types';
import type { ZoomEffect } from '../../../openchatcut/editor/types';

export const ZOOM_BASIS_FPS = 30;

export function followZoomFromTrack(points: TrackingPoint[], magnification: number, maxKeyframes = 60): ZoomEffect {
  const ok = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.frame - b.frame);
  const step = Math.max(1, Math.ceil(ok.length / maxKeyframes));
  const picked = ok.filter((_, i) => i % step === 0 || i === ok.length - 1);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    magnification,
    focalPointX: picked[0] ? clamp(picked[0].x) : 0.5,
    focalPointY: picked[0] ? clamp(picked[0].y) : 0.5,
    reframeCurve: {
      version: 1, timebase: 'effect-frame', coordinateSpace: 'composition-normalized',
      keyframes: picked.map((p) => ({ frame: p.frame, focalPointX: clamp(p.x), focalPointY: clamp(p.y), magnification })),
    },
  };
}
