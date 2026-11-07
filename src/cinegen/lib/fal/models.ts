// [remix] CineGen's model registry, re-pointed from fal/Kie/Topview/Higgsfield/RunPod to the models this
// editor can actually run: MuAPI (user's own key) + OpenAI Images 2.6 (user's own key). Same exports as
// CineGen's lib/fal/models.ts so the Spaces canvas, Studio, Director and Elements code runs unchanged.
import type { ModelDefinition } from '@cinegen/types/workflow';
import { buildMuapiRegistry } from '@cinegen/lib/muapi/model-catalog';

export {
  isKlingV3NodeType,
  resolveKlingV3ModelId,
  resolveVideoModelEndpoint,
  sanitizeVideoInputsForEndpoint,
  usesEndpointQualityRouting,
} from '@cinegen/lib/fal/video-model-routing';
export type { KlingV3Mode, KlingV3Quality } from '@cinegen/lib/fal/video-model-routing';
export { KLING_V3_QUALITY_OPTS, LTX23_QUALITY_OPTS, SORA2_QUALITY_OPTS } from '@cinegen/lib/fal/video-model-routing';

export const MODEL_REGISTRY: Record<string, ModelDefinition> = buildMuapiRegistry();
export const ALL_MODELS: Record<string, ModelDefinition> = MODEL_REGISTRY;

/** Kept for API compatibility: there is no Topview catalog in the web editor. */
export function installTopviewModelCatalog(_catalog: unknown): void { /* not used */ }

export function getModelDefinition(nodeType: string): ModelDefinition | undefined {
  return ALL_MODELS[nodeType];
}

export function getAllModelNodeTypes(): string[] {
  return Object.keys(ALL_MODELS);
}

export function getModelsByProvider(provider: 'fal' | 'kie'): Record<string, ModelDefinition> {
  void provider;
  return {};
}
