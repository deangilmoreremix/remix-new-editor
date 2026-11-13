// [remix] Auto-reframe: OpenChatCut's browser-native detector (reframe/detect.ts — energy saliency, optional FaceDetector) → the
// ReframeCurveV1 their zoom already renders (`ZoomEffect.reframeCurve`), so the zoom follows the detected subject in preview and export.
import { detectFocalPoints, type DetectedKeyframe, type FrameSampler } from '../../../openchatcut/reframe/detect';
import type { ZoomEffect } from '../../../openchatcut/editor/types';
import { ZOOM_BASIS_FPS } from './follow-zoom';

export function reframeZoomFromKeyframes(kfs: DetectedKeyframe[], magnification: number): ZoomEffect | null {
  if (kfs.length < 2) return null;
  const mag = Math.min(16, Math.max(1, magnification));
  return {
    magnification: mag, focalPointX: kfs[0].focalPointX, focalPointY: kfs[0].focalPointY,
    reframeCurve: { version: 1, timebase: 'effect-frame', coordinateSpace: 'composition-normalized', keyframes: kfs.map((k) => ({ frame: k.frame, focalPointX: k.focalPointX, focalPointY: k.focalPointY, magnification: mag })) },
  };
}

export interface ReframeSource { video?: HTMLVideoElement; sampler?: FrameSampler; width?: number; height?: number }
export async function autoReframe(src: ReframeSource, clip: { duration: number; trimStart: number; trimEnd: number; speed: number }, magnification: number): Promise<ZoomEffect | null> {
  const speed = clip.speed || 1;
  const durationInFrames = Math.max(1, Math.round(((clip.duration - clip.trimStart - clip.trimEnd) / speed) * ZOOM_BASIS_FPS));
  const w = src.width ?? src.video?.videoWidth ?? 16; const h = src.height ?? src.video?.videoHeight ?? 9;
  const kfs = await detectFocalPoints((src.video ?? src.sampler)!, { durationInFrames, fps: ZOOM_BASIS_FPS, dstAspect: w / h, srcInFrame: Math.round(clip.trimStart * ZOOM_BASIS_FPS), playbackRate: speed, srcWidth: w, srcHeight: h });
  return reframeZoomFromKeyframes(kfs, magnification);
}
