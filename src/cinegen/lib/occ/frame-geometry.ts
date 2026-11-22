// [remix] One geometry model for the viewer and the export: how a clip sits in the project frame.
// Built from OpenChatCut's own pure modules (editor/visualFrameGeometry, flexCrop, backgroundFill) plus the existing clip transform
// (lib/occ/transform.ts). The DOM preview (playback-engine, GL canvas, still images) and the Remotion composition both resolve their
// fit / position / crop / fill from here, so a clip is framed the same way in both.
import { renderedVisualFrameRect, type VisualFrameRect } from '../../../openchatcut/editor/visualFrameGeometry';
import { backgroundFillAppearance } from '../../../openchatcut/editor/backgroundFill';
import { fillCss, type ClipTransform } from './transform';
import { clipPoseCss, type ClipAnim } from '../editor/stage2/anim';

export type Fit = 'contain' | 'cover';
/** Timelines saved before fit existed (no `Timeline.fit`) keep the Cover framing they always exported — preview and export both use it. */
export const LEGACY_FIT: Fit = 'cover';
/** New timelines store this explicitly. */
export const NEW_TIMELINE_FIT: Fit = 'contain';
export const DEFAULT_ASPECT = '16:9';
export const ASPECTS: Array<[string, string]> = [['16:9', '16:9 landscape'], ['9:16', '9:16 vertical'], ['1:1', '1:1 square'], ['4:5', '4:5 portrait'], ['21:9', '21:9 cinema']];

export function resolveFit(clip?: { transform?: { fit?: Fit } | null } | null, project?: { fit?: Fit } | null): Fit {
  return clip?.transform?.fit ?? project?.fit ?? LEGACY_FIT;
}

export function aspectRatio(aspect?: string): number {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(aspect || DEFAULT_ASPECT));
  const r = m ? Number(m[1]) / Number(m[2]) : 16 / 9;
  return r > 0 ? r : 16 / 9;
}

/** Frame size for an aspect at a short-edge (same rule as the export's frameForAspect). */
export function frameFor(aspect: string | undefined, shortEdge = 720): { width: number; height: number } {
  const a = aspectRatio(aspect);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return a >= 1 ? { width: even(shortEdge * a), height: shortEdge } : { width: shortEdge, height: even(shortEdge / a) };
}

export interface ResolvedGeometry {
  fit: Fit;
  transform?: string;
  clipPath?: string;
  /** where the whole source picture lands in the frame (before the clip transform) */
  rect: VisualFrameRect;
  fill?: { filter: string; transform: string; blurPx: number };
}

export function resolveGeometry(
  clip: { transform?: ClipTransform | null; anim?: ClipAnim | null },
  project: { fit?: Fit } | null | undefined,
  tSeconds: number,
  frame: { width: number; height: number },
  source: { width: number; height: number },
): ResolvedGeometry {
  const fit = resolveFit(clip, project);
  const tr = clip.transform ?? undefined;
  const css = fillCss(tr, frame.width, frame.height);
  return {
    fit,
    ...(({ transform, clipPath }) => ({ transform, clipPath }))(clipPoseCss({ transform: tr, anim: clip.anim }, tSeconds)), // [remix] Stage 2: keys + modifiers
    rect: renderedVisualFrameRect(frame, source, fit),
    fill: css && tr?.fill !== undefined ? { ...css, blurPx: backgroundFillAppearance(frame.width, frame.height, tr.fill).blurPx } : undefined,
  };
}
