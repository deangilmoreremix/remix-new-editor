// [remix] fal endpoint routing is gone: MuAPI models are addressed by their own id. API kept so callers compile.
import type { ModelDefinition } from '@cinegen/types/workflow';

export const KLING_V3_QUALITY_OPTS: { value: string; label: string }[] = [];
export const SORA2_QUALITY_OPTS: { value: string; label: string }[] = [];
export const LTX23_QUALITY_OPTS: { value: string; label: string }[] = [];

export type KlingV3Quality = 'standard' | 'pro' | '4k';
export type KlingV3Mode = 'text-to-video' | 'image-to-video';

export function isKlingV3NodeType(_nodeType: string): boolean { return false; }
export function resolveKlingV3ModelId(mode: KlingV3Mode, _quality?: string | null): string { return mode; }
export function usesEndpointQualityRouting(_nodeType: string): boolean { return false; }

export function resolveVideoModelEndpoint(
  _nodeType: string,
  modelDef: Pick<ModelDefinition, 'id' | 'altId'>,
  _opts: { hasImageInputs: boolean; quality?: string | null },
): string {
  return modelDef.id;
}

export function sanitizeVideoInputsForEndpoint(_nodeType: string, _effectiveModelId: string, _inputs: Record<string, unknown>): void { /* nothing to clamp */ }
