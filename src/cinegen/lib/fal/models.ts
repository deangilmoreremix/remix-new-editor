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

// [remix] CineGen's SAM 3 nodes (same definitions as CineGen's registry). Their modals are CineGen's own; segmentation runs free on your
// device (SlimSAM + Florence-2 in the browser) instead of fal's cloud SAM 3, so no key is needed. They are interactive-only (open the modal).
const SAM3_NODES: Record<string, ModelDefinition> = {
  'sam3-segment-cloud': {
    id: 'sam3-segment-cloud', nodeType: 'sam3-segment-cloud', name: 'SAM 3 Segment (Cloud)',
    category: 'image-edit', description: 'Interactive segmentation with prompt, click, and box tools plus edge cleanup. Runs on your device.', outputType: 'image',
    provider: 'local',
    responseMapping: { path: 'masks.0.url' },
    inputs: [
      { id: 'image_url', portType: 'image', label: 'Image', required: true, falParam: 'image_url', fieldType: 'port' },
      { id: 'prompt', portType: 'text', label: 'Prompt', required: false, falParam: 'prompt', fieldType: 'port' },
      { id: 'apply_mask', portType: 'number', label: 'Apply Mask', required: false, falParam: 'apply_mask', fieldType: 'toggle', default: true },
      { id: 'return_multiple_masks', portType: 'number', label: 'Multiple Masks', required: false, falParam: 'return_multiple_masks', fieldType: 'toggle', default: false },
      { id: 'max_masks', portType: 'number', label: 'Max Masks', required: false, falParam: 'max_masks', fieldType: 'range', default: 3, min: 1, max: 32, step: 1 },
    ],
  },
  'sam3-track-cloud': {
    id: 'sam3-track-cloud', nodeType: 'sam3-track-cloud', name: 'SAM 3 Track (Cloud)',
    category: 'video', description: 'Interactive video segmentation with prompt, click, and box tracking. Runs on your device.', outputType: 'video',
    provider: 'local',
    responseMapping: { path: 'video.url' },
    inputs: [
      { id: 'video_url', portType: 'video', label: 'Video', required: true, falParam: 'video_url', fieldType: 'port' },
      { id: 'prompt', portType: 'text', label: 'Prompt', required: false, falParam: 'prompt', fieldType: 'port' },
      { id: 'apply_mask', portType: 'number', label: 'Apply Mask', required: false, falParam: 'apply_mask', fieldType: 'toggle', default: true },
      { id: 'detection_threshold', portType: 'number', label: 'Detection Threshold', required: false, falParam: 'detection_threshold', fieldType: 'range', default: 0.3, min: 0, max: 1, step: 0.05 },
    ],
  },
  'sam3-segment': {
    id: 'sam3-segment', nodeType: 'sam3-segment', name: 'SAM 3 Segment',
    category: 'image-edit', description: 'Interactive segmentation: click, draw, or describe to select elements', outputType: 'image',
    provider: 'local',
    responseMapping: { path: 'output_path' },
    inputs: [
      { id: 'image_url', portType: 'image', label: 'Image', required: true, falParam: 'image_url', fieldType: 'port' },
    ],
  },
};

export const MODEL_REGISTRY: Record<string, ModelDefinition> = { ...buildMuapiRegistry(), ...SAM3_NODES };
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
