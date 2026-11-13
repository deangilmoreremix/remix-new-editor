// [remix] Bridges CineGen clips to the OpenChatCut GL engine (src/openchatcut/gl): builds the pass chain for a clip's
// fx stack + LUT, and kicks off .cube loading. Pure (no DOM) so it is shared by preview and export.
import { ALL_FX, type FxDef } from '../../../openchatcut/gl/fx/effects';
import { fxPasses } from '../../../openchatcut/gl/fx/uniforms';
import { ensureCube } from '../../../openchatcut/gl/fx/cube';
import type { FxPass } from '../../../openchatcut/gl/runtimeTypes';
import type { Clip, ClipFx } from '@cinegen/types/timeline';
import { registerSnapshot } from './plugins';
import { sampleKeyframes } from '../../../openchatcut/editor/keyframes';
import { animFxKeys } from '../editor/stage2/anim';

export const FX_KEY_FPS = 30;
/** Effect property values for this moment: static sliders overridden by any keyframed property (OpenChatCut sampleKeyframes). */
export function sampledFxProps(props: Record<string, number | number[]>, keys: ClipFx['keys'] | undefined, clipTimeSec: number): Record<string, number | number[]> {
  if (!keys) return props;
  const out = { ...props };
  for (const [k, list] of Object.entries(keys)) if (list?.length) out[k] = sampleKeyframes(list, clipTimeSec * FX_KEY_FPS);
  return out;
}

type Overrides = Record<string, number | number[]>;

/** Effect instances for a clip, in render order (fx stack first, then the LUT / look). */
export function clipFxInstances(clip: Pick<Clip, 'fx' | 'lut'> & { anim?: Clip['anim'] }, clipTimeSec = 0): Array<{ def: FxDef; overrides: Overrides; keys?: ClipFx['keys'] }> {
  const list: Array<{ def: FxDef; overrides: Overrides; keys?: ClipFx['keys'] }> = [];
  (clip.fx ?? []).forEach((fx, index) => {
    if (fx.def) registerSnapshot(fx.def);
    const def = ALL_FX[fx.id];
    if (!def || fx.enabled === false) return;
    // [remix] Stage 2: unified anim keys of this effect (fx:<index>:<param>) win over the older per-effect keys
    const a = animFxKeys(clip.anim, index);
    const keys = a ? { ...(fx.keys ?? {}), ...a } : fx.keys;
    list.push({ def, overrides: sampledFxProps(fx.props ?? {}, keys, clipTimeSec), ...(keys ? { keys } : {}) });
  });
  if (clip.lut) {
    if (clip.lut.def) registerSnapshot(clip.lut.def);
    const def = ALL_FX[clip.lut.id];
    if (def) list.push({ def, overrides: { intensity: clip.lut.intensity } });
  }
  return list;
}

export function clipHasFx(clip: Pick<Clip, 'fx' | 'lut'> | null | undefined): boolean {
  return !!clip && clipFxInstances(clip).length > 0;
}

/** Start loading every .cube the clip needs. Resolves once all are settled (loaded or failed). */
export async function primeClipLuts(clip: Pick<Clip, 'fx' | 'lut'>): Promise<void> {
  await Promise.all(clipFxInstances(clip).map(({ def }) => (def.cube ? ensureCube(def.cube) : null)));
}

/** GL pass chain for a clip at `timeSec` (seconds on the clip; drives animated effects such as grain). */
export function clipFxPasses(clip: Pick<Clip, 'fx' | 'lut'> & { anim?: Clip['anim'] }, timeSec: number, clipTimeSec = 0): FxPass[] {
  return fxPasses(clipFxInstances(clip, clipTimeSec), timeSec);
}
