// [remix] Fix A: what one side of a GL transition looks like at a frame, from the composition layer of that clip (same functions the normal clip
// layer uses in TimelineComposition: KeyframeWrap -> OccTransform -> OccZoom -> MediaLayer fade -> flip -> OccClipFx), so the transition blends
// the clips as they are composited, not their raw frames. Pure (no DOM, no clock): shared by the export layer and the tests.
import { transformStyleAt } from './keyframes.js';
import { clipPoseCss } from '../../../cinegen/lib/editor/stage2/anim';
import { zoomAt } from '../../../openchatcut/editor/zoom';
import { clipFadeFactor } from '../../../openchatcut/editor/clipFade';
import { sampleKeyframes as sampleFxKey } from '../../../openchatcut/editor/keyframes';

/** The part of a composition layer a transition side needs (see buildGlTransitionLayers / attachGlSideLooks). */
export function glSideLayerFrom(layer) {
  return {
    from: layer.from, durationInFrames: layer.durationInFrames, fit: layer.fit === 'contain' ? 'contain' : 'cover',
    ...(layer.occFx?.length ? { occFx: layer.occFx } : {}), ...(layer.clipTransform ? { clipTransform: layer.clipTransform } : {}),
    ...(layer.clipAnim ? { clipAnim: layer.clipAnim } : {}), ...(layer.clipZoom ? { clipZoom: layer.clipZoom } : {}),
    ...(layer.keyframes ? { keyframes: layer.keyframes } : {}), ...(layer.fadeIn ? { fadeIn: layer.fadeIn } : {}), ...(layer.fadeOut ? { fadeOut: layer.fadeOut } : {}),
    ...(layer.flip ? { flip: layer.flip } : {}),
    ...(layer.clipBlend ? { clipBlend: layer.clipBlend } : {}), // [remix] Fix E: blend mode of the clip, applied to the whole transition window
  };
}

/** `side` = glSideLayerFrom(...); `frame` = composition frame; returns the 2D look and the effect list (key-sampled) at that frame. */
export function resolveSideLook(side, frame, fps) {
  const local = frame - side.from;
  const t = local / fps;
  const kw = side.keyframes ? transformStyleAt(side.keyframes, t) : null;
  const pose = clipPoseCss({ transform: side.clipTransform, anim: side.clipAnim }, t);
  const fade = side.fadeIn || side.fadeOut ? clipFadeFactor(t, side.durationInFrames / fps, side.fadeIn || 0, side.fadeOut || 0) : 1;
  const opacity = (kw?.opacity ?? 1) * fade;
  const z = side.clipZoom ? zoomAt(side.clipZoom, (local * 30) / fps, Math.max(1, (side.durationInFrames * 30) / fps)) : null;
  const cssTransform = [kw?.transform, pose.transform].filter(Boolean).join(' ') || undefined;
  const effects = (side.occFx || []).map((e) => (e.keys
    ? { ...e, overrides: { ...(e.overrides || {}), ...Object.fromEntries(Object.entries(e.keys).filter(([, l]) => l?.length).map(([k, l]) => [k, sampleFxKey(l, t * 30)])) } }
    : e));
  // [remix] Fix E: background fill (transform.fill = strength): moved only by the key transform / key opacity, not by the pose, crop, zoom or fade
  const fill = side.clipTransform?.fill !== undefined ? { strength: side.clipTransform.fill, transform: kw?.transform || undefined, opacity: kw?.opacity ?? 1 } : null;
  return {
    fill,
    look: { cssTransform, clipPath: pose.clipPath, opacity, ...(side.flip ? { flip: side.flip } : {}), ...(z ? { zoom: { magnification: z.magnification, focalX: z.focalX, focalY: z.focalY } } : {}) },
    effects, localFrame: local,
  };
}
