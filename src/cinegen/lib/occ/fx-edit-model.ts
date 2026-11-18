// [remix] Fix C: pure helpers shared by the inspector controls and the preview handles of the path mask / corner pin / curves effects.
// Reading = the same sampling the renderer uses (fx keys + Clip.anim keys); writing = patches for updateClipProperties. No DOM, no clock.
import type { Clip, ClipFx } from '@cinegen/types/timeline';
import { sampledFxProps, FX_KEY_FPS } from './clip-fx';
import { animFxKeys, clearProp, fxPropId } from '../editor/stage2/anim';
import { editProps, type ClipPatch } from '../editor/stage2/prop-edit';
import { upsertKeyframe } from '../../../openchatcut/editor/keyframes';
import { pathAt, pathToFlat, vertexKey, type PathVertex } from '../../../openchatcut/gl/fx/s9/pathMask';

export type SampledProps = Record<string, number | number[]>;
type ClipLike = Pick<Clip, 'fx' | 'anim' | 'transform' | 'opacity' | 'keyframes'>;

/** Effect #index's props at clip time t, exactly as the renderer resolves them (anim keys win over the older per-effect keys). */
export function sampledFxAt(clip: Pick<Clip, 'fx' | 'anim'>, index: number, t: number): SampledProps {
  const fx = clip.fx?.[index];
  if (!fx) return {};
  const a = animFxKeys(clip.anim, index);
  return sampledFxProps(fx.props ?? {}, a ? { ...(fx.keys ?? {}), ...a } : fx.keys, t);
}

/** True when `key` of effect #index has keys in either store. */
export function isFxKeyed(clip: Pick<Clip, 'fx' | 'anim'>, index: number, key: string): boolean {
  return !!clip.fx?.[index]?.keys?.[key]?.length || !!clip.anim?.keys?.[fxPropId(index, key)]?.length;
}

/**
 * Patch that sets scalar props of effect #index at clip time t. A prop with older per-effect keys gets a key at t there; otherwise the
 * unified rules of Stage 2 apply (a prop with Clip.anim keys, or any prop while `auto` is on, gets a key; else the static value changes).
 */
export function scalarPatch(clip: ClipLike, index: number, values: Record<string, number>, t: number, auto: boolean): ClipPatch {
  let fx = clip.fx;
  const rest: Record<string, number> = {};
  const frame = Math.round(t * FX_KEY_FPS);
  for (const [k, v] of Object.entries(values)) {
    const legacy = fx?.[index]?.keys?.[k];
    if (legacy?.length && !clip.anim?.keys?.[fxPropId(index, k)]?.length) fx = fx!.map((f, i) => (i === index ? { ...f, keys: { ...f.keys, [k]: upsertKeyframe(legacy, frame, v) } } : f));
    else rest[fxPropId(index, k)] = v;
  }
  const out = Object.keys(rest).length ? editProps({ ...clip, fx }, rest, t, auto) : {};
  const finalFx = out.fx ?? fx;
  return { ...out, ...(finalFx !== clip.fx ? { fx: finalFx } : {}) };
}

/** Patch that stores array data (mask path, curve points) in the effect's static props. */
export function dataPatch(clip: Pick<Clip, 'fx'>, index: number, values: Record<string, number[]>): { fx: ClipFx[] } {
  return { fx: (clip.fx ?? []).map((f, i) => (i === index ? { ...f, props: { ...f.props, ...values } } : f)) };
}

const isVertexKey = (k: string) => /^v\d+[xy]$/.test(k);

/** Does the mask have animated anchors? */
export function hasVertexKeys(clip: Pick<Clip, 'fx' | 'anim'>, index: number): boolean {
  const f = clip.fx?.[index];
  return Object.keys(f?.keys ?? {}).some((k) => isVertexKey(k) && f?.keys?.[k]?.length)
    || Object.keys(clip.anim?.keys ?? {}).some((id) => id.startsWith(`fx:${index}:`) && isVertexKey(id.split(':')[2] ?? '') && clip.anim?.keys?.[id]?.length);
}

/** Drop every animated-anchor key of the mask (what the path looked like at time `t` becomes the static path). */
export function bakeVertexKeys(clip: ClipLike, index: number, t: number): ClipPatch {
  const path = pathAt(sampledFxAt(clip, index, t));
  let anim = clip.anim;
  for (const id of Object.keys(anim?.keys ?? {})) if (id.startsWith(`fx:${index}:`) && isVertexKey(id.split(':')[2] ?? '')) anim = clearProp(anim, id);
  const fx = (clip.fx ?? []).map((f, i) => {
    if (i !== index) return f;
    const keys = Object.fromEntries(Object.entries(f.keys ?? {}).filter(([k]) => !isVertexKey(k)));
    return { ...f, props: { ...f.props, path: pathToFlat(path) }, keys: Object.keys(keys).length ? keys : undefined };
  });
  return { fx, anim };
}

/**
 * Patch for moving anchor i to (x, y) in path space at time t. An animated anchor (or any anchor while auto-key is on) gets a key at t;
 * otherwise the stored path changes.
 */
export function moveAnchorPatch(clip: ClipLike, index: number, i: number, x: number, y: number, t: number, auto: boolean): ClipPatch {
  if (auto || isFxKeyed(clip, index, vertexKey(i, 'x')) || isFxKeyed(clip, index, vertexKey(i, 'y'))) return scalarPatch(clip, index, { [vertexKey(i, 'x')]: x, [vertexKey(i, 'y')]: y }, t, true);
  const path = pathAt(sampledFxAt(clip, index, t)).map((v, j) => (j === i ? { ...v, x, y } : v));
  return dataPatch(clip, index, { path: pathToFlat(path) });
}

/** Replace the path structure (add / delete / handle edit). Animated anchors are baked to the values at t first, since indices change. */
export function setPathPatch(clip: ClipLike, index: number, next: PathVertex[], t: number, structural: boolean): ClipPatch {
  if (!structural) return dataPatch(clip, index, { path: pathToFlat(next) });
  const baked = bakeVertexKeys(clip, index, t);
  return { ...baked, ...dataPatch({ fx: baked.fx }, index, { path: pathToFlat(next) }) };
}

/** Key all anchors at time t (current positions), so they can be moved to different places at other times. */
export function keyAllAnchorsPatch(clip: ClipLike, index: number, t: number): ClipPatch {
  const path = pathAt(sampledFxAt(clip, index, t));
  const values: Record<string, number> = {};
  path.forEach((v, i) => { values[vertexKey(i, 'x')] = v.x; values[vertexKey(i, 'y')] = v.y; });
  return scalarPatch(clip, index, values, t, true);
}
