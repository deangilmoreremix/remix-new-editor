// [remix] Hosts OpenChatCut's plugin system (openchatcut-plugin@1; src/openchatcut/plugins) in the CineGen editor.
// Installed packs register their fx / LUTs / transitions / zoom presets into OpenChatCut's own registries. A clip or cut that uses a
// plugin item also stores a self-contained snapshot of it (their "state snapshot" rule), so projects keep rendering — in preview and in
// the sandboxed export runner — after the pack is disabled, uninstalled or missing on another machine.
import { ALL_FX, CUSTOM_FX, LUT_FRAG, registerCustomFx } from '../../../openchatcut/gl/fx/effects';
import { parseCube, primeCube } from '../../../openchatcut/gl/fx/cube';
import { customTransitionUniforms, getCustomTransition, listCustomTransitions, registerCustomTransition, type CustomTransitionDef } from '../../../openchatcut/gl/customTransitions';
import { GLSL_TRANSITIONS } from '../../../openchatcut/gl/transitions';
import { listPacks } from '../../../openchatcut/plugins/store';
import { isPluginAssetId, pluginAssetId } from '../../../openchatcut/plugins/types';
import type { GlslTransitionType } from '../../../openchatcut/types';
import { gltFrag, gltUniforms, isGltId, type GltParams } from '../../../openchatcut/gl/glt';

export { hydratePlugins, subscribePlugins, listPacks, removePack, setPackEnabled } from '../../../openchatcut/plugins/store';
export { installFromText, installFromUrl } from '../../../openchatcut/plugins/install';
export { isPluginAssetId };

/** Self-contained copy of a plugin fx / LUT (what their `serializableDefsFor` stores in project state). */
export interface FxSnapshot {
  id: string; name: string; desc: string; frag: string;
  props: Array<{ key: string; label: string; default: number; min: number; max: number; step?: number; kind?: string }>;
  passes?: string[];
  /** .cube text for LUT items (parsed into the cube cache on registration) */
  cubeText?: string;
}

/** Custom (plugin) fx / LUT ids currently registered. */
export const customFxIds = (): string[] => Object.keys(CUSTOM_FX).filter(isPluginAssetId);
export const customTransitionIdsOf = (): string[] => listCustomTransitions().filter((d) => isPluginAssetId(d.id)).map((d) => d.id);

export async function snapshotFor(id: string): Promise<FxSnapshot | undefined> {
  const def = ALL_FX[id];
  if (!def || !isPluginAssetId(id) || def.pipeline) return undefined;
  const snap: FxSnapshot = { id, name: def.name, desc: def.desc, frag: def.frag, props: def.props as FxSnapshot['props'], ...(def.passes ? { passes: def.passes } : {}) };
  if (def.cube) {
    for (const pack of await listPacks()) {
      const item = pack.items.find((it) => pluginAssetId(pack.id, it.id) === id);
      if (item && item.type === 'lut' && item.cube) { snap.cubeText = item.cube; break; }
    }
  }
  return snap;
}

/** Register a snapshot's fx if nothing with that id is registered (reload / pack missing / export runner). */
export function registerSnapshot(s: FxSnapshot): void {
  if (ALL_FX[s.id]) return;
  let cube: string | undefined;
  if (s.cubeText) { cube = `plugin-lut:${s.id}`; primeCube(cube, parseCube(s.cubeText)); }
  registerCustomFx({ id: s.id, name: s.name, desc: s.desc, frag: cube ? LUT_FRAG : s.frag, props: s.props as never, ...(s.passes ? { passes: s.passes } : {}), ...(cube ? { cube } : {}) } as never);
}

export async function transitionSnapshotFor(id: string): Promise<CustomTransitionDef | undefined> {
  const d = getCustomTransition(id);
  return d ? { id: d.id, label: d.label, frag: d.frag, props: d.props } : undefined;
}

/** Fragment + uniforms for a cut's transition: built-in GLSL transition, a registered plugin one, or its stored snapshot. */
export function resolveTransition(glType: string, snap?: CustomTransitionDef, glParams?: GltParams): { frag: string; uniforms: (ctx: { time: number; aspect: number }) => Record<string, number | number[]> } | null {
  const builtin = GLSL_TRANSITIONS[glType as GlslTransitionType];
  if (builtin) return { frag: builtin.frag, uniforms: (c) => builtin.uniforms({ ...c, direction: 'left' }) as Record<string, number> };
  if (isGltId(glType)) return { frag: gltFrag(glType)!, uniforms: () => gltUniforms(glType, glParams) };
  const def = getCustomTransition(glType) ?? (snap && (registerCustomTransition(snap), snap));
  if (!def) return null;
  return { frag: def.frag, uniforms: () => customTransitionUniforms(def) };
}
export const isKnownTransition = (glType?: string, snap?: CustomTransitionDef): boolean => !!glType && (glType in GLSL_TRANSITIONS || isGltId(glType) || !!getCustomTransition(glType) || !!snap);

/** Synchronous snapshot of a registered plugin fx / LUT for the export payload (LUT cube text comes from the clip's stored snapshot). */
export function pluginFxSnapshotSync(id: string): FxSnapshot | undefined {
  const def = ALL_FX[id];
  if (!def || def.pipeline) return undefined;
  return { id, name: def.name, desc: def.desc, frag: def.frag, props: def.props as FxSnapshot['props'], ...(def.passes ? { passes: def.passes } : {}) };
}
export function customTransitionDefSync(glType: string): CustomTransitionDef | undefined {
  if (glType in GLSL_TRANSITIONS) return undefined;
  const d = getCustomTransition(glType);
  return d ? { id: d.id, label: d.label, frag: d.frag, props: d.props } : undefined;
}
