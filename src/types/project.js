/**
 * Ported from CineGen: src/types/project.ts
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/types/project.ts
 *
 * Project-level types: Asset, MediaFolder, Project, WorkflowSpaceSnapshot,
 * ProjectSnapshot, ExportSettings, ExportJob.
 */

export const ASSET_TYPES = ['image', 'video', 'audio'];

export function isAssetType(value) {
  return ASSET_TYPES.includes(value);
}
