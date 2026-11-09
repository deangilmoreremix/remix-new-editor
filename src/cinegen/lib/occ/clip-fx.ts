// [remix] Bridges CineGen clips to the OpenChatCut GL engine (src/openchatcut/gl): builds the pass chain for a clip's
// fx stack + LUT, and kicks off .cube loading. Pure (no DOM) so it is shared by preview and export.
import { ALL_FX, type FxDef } from '../../../openchatcut/gl/fx/effects';
import { fxPasses } from '../../../openchatcut/gl/fx/uniforms';
import { ensureCube } from '../../../openchatcut/gl/fx/cube';
import type { FxPass } from '../../../openchatcut/gl/runtimeTypes';
import type { Clip } from '@cinegen/types/timeline';
import { registerSnapshot } from './plugins';

type Overrides = Record<string, number | number[]>;

/** Effect instances for a clip, in render order (fx stack first, then the LUT / look). */
export function clipFxInstances(clip: Pick<Clip, 'fx' | 'lut'>): Array<{ def: FxDef; overrides: Overrides }> {
  const list: Array<{ def: FxDef; overrides: Overrides }> = [];
  for (const fx of clip.fx ?? []) {
    if (fx.def) registerSnapshot(fx.def);
    const def = ALL_FX[fx.id];
    if (def && fx.enabled !== false) list.push({ def, overrides: fx.props ?? {} });
  }
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
export function clipFxPasses(clip: Pick<Clip, 'fx' | 'lut'>, timeSec: number): FxPass[] {
  return fxPasses(clipFxInstances(clip), timeSec);
}
