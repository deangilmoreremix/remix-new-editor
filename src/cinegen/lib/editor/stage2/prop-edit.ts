// [remix] Stage 2: read / edit one animatable clip property (x, y, scale, rotation, opacity, crop edges, effect parameters) at the playhead.
// Used by the Animation section and by the Transform section, so both write the same unified keys (Clip.anim) and obey the same auto-keyframe rule.
// Pure: takes a clip, returns a patch for updateClipProperties.
import type { Clip, ClipFx } from '@cinegen/types/timeline';
import { IDENTITY_TRANSFORM, hasTransform, transformValuesAt, type ClipTransform } from '../../occ/transform';
import { sampleKeyframes } from '../../../../openchatcut/editor/keyframes';
import { applyAutoKey, parseFxPropId, sampleKeys, unifyLegacy, type ClipAnim } from './anim';

export interface ClipPatch { anim?: ClipAnim; transform?: ClipTransform; opacity?: number; fx?: ClipFx[]; keyframes?: Clip['keyframes'] }
const CROP: Record<string, 'left' | 'top' | 'right' | 'bottom'> = { cropLeft: 'left', cropTop: 'top', cropRight: 'right', cropBottom: 'bottom' };
const KEYED_VIA_TRANSFORM = new Set(['x', 'y', 'scale', 'rotation']);
const FX_BASIS_FPS = 30;

type Src = Pick<Clip, 'transform' | 'anim' | 'opacity' | 'keyframes' | 'fx'>;

/** The value of property `id` at clip time t, without motion modifiers (what the slider shows and what a new key records). */
export function readProp(clip: Src, id: string, t: number, fxDefault = 0): number {
  const keys = clip.anim?.keys?.[id];
  const tr = clip.transform ?? IDENTITY_TRANSFORM;
  if (KEYED_VIA_TRANSFORM.has(id)) return keys?.length ? sampleKeys(keys, t, 0) : transformValuesAt(tr, t)[id as 'x'];
  if (id === 'opacity') {
    if (keys?.length) return sampleKeys(keys, t, clip.opacity ?? 1);
    const kfs = (clip.keyframes ?? []).filter((k) => k.property === 'opacity').sort((a, b) => a.time - b.time);
    if (!kfs.length) return clip.opacity ?? 1;
    if (t <= kfs[0].time) return kfs[0].value;
    const last = kfs[kfs.length - 1];
    if (t >= last.time) return last.value;
    const i = kfs.findIndex((k, n) => t >= k.time && t <= (kfs[n + 1]?.time ?? Infinity));
    return kfs[i].value + ((t - kfs[i].time) / (kfs[i + 1].time - kfs[i].time)) * (kfs[i + 1].value - kfs[i].value);
  }
  if (CROP[id]) return keys?.length ? sampleKeys(keys, t, 0) : tr.crop?.[CROP[id]] ?? 0;
  const fx = parseFxPropId(id);
  if (fx) {
    if (keys?.length) return sampleKeys(keys, t, fxDefault);
    const f = clip.fx?.[fx.index];
    const legacy = f?.keys?.[fx.key];
    if (legacy?.length) return sampleKeyframes(legacy, t * FX_BASIS_FPS);
    const v = f?.props?.[fx.key];
    return typeof v === 'number' ? v : fxDefault;
  }
  return 0;
}

/** Edit properties at clip time t. A property with keys (or any property while `auto` is on) gets / updates a key at t; others change the static value. */
export function editProps(clip: Src, patch: Record<string, number>, t: number, auto: boolean): ClipPatch {
  const ids = Object.keys(patch);
  const out: ClipPatch = {};
  let work: Src = clip;
  // older keys of the touched properties move into the unified store first (the evaluation does not change)
  const legacyTransform = !!clip.transform?.keys?.length && ids.some((i) => KEYED_VIA_TRANSFORM.has(i));
  const legacyOpacity = ids.includes('opacity') && (clip.keyframes ?? []).some((k) => k.property === 'opacity');
  if (legacyTransform || legacyOpacity) {
    const u = unifyLegacy({ transform: clip.transform, anim: clip.anim, keyframes: clip.keyframes });
    if (u.anim) out.anim = u.anim;
    if ('transform' in u) out.transform = u.transform;
    if (u.keyframes) out.keyframes = u.keyframes;
    work = { ...clip, anim: u.anim ?? clip.anim, transform: 'transform' in u ? u.transform : clip.transform, keyframes: u.keyframes ?? clip.keyframes };
  }
  const anim = work.anim;
  const keyed = applyAutoKey(anim, patch, t, auto);
  if (keyed.anim !== work.anim) out.anim = keyed.anim;
  let tr = work.transform; let fx = work.fx;
  for (const id of keyed.unkeyed) {
    const v = patch[id];
    if (KEYED_VIA_TRANSFORM.has(id)) tr = { ...(tr ?? IDENTITY_TRANSFORM), [id]: v };
    else if (id === 'opacity') out.opacity = Math.max(0, Math.min(1, v));
    else if (CROP[id]) { const c = { left: 0, top: 0, right: 0, bottom: 0, ...(tr?.crop ?? {}), [CROP[id]]: v }; tr = { ...(tr ?? IDENTITY_TRANSFORM), crop: c.left || c.top || c.right || c.bottom ? c : undefined }; }
    else { const p = parseFxPropId(id); if (p && fx?.[p.index]) fx = fx.map((f, i) => (i === p.index ? { ...f, props: { ...f.props, [p.key]: v } } : f)); }
  }
  if (tr !== work.transform) out.transform = tr && hasTransform(tr) ? tr : undefined;
  if (fx !== work.fx) out.fx = fx;
  return out;
}
