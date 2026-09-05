// Re-exports the auto-generated, all-tracks catalog as the public Academy
// asset manifest. The catalog (src/data/academy/catalog.ts) is produced by
// scripts/gen-academy-catalog.mjs from the cloned upstream repo and covers
// every track. Keep this thin wrapper so existing imports stay stable.
export type { AcademyAsset, AcademyAssetType } from './academy/catalog.ts';
export {
  ACADEMY_ASSETS,
  getAssetById,
  getAssetsForLesson,
  getAssetsForTemplate,
} from './academy/catalog.ts';
