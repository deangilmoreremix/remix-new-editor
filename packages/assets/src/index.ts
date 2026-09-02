// packages/assets/src/index.ts
// Public surface of the assets package.

export * from './types.ts';
export {
  getStorageConfig,
  isStorageConfigured,
  uploadBytes,
  downloadBytes,
  getPublicUrl,
  deleteObject,
  listObjects,
  mirrorToStorage,
  buildContactAssetPath,
} from './storage.ts';
export { detectLogoFromHtml, buildLogoAsset } from './extractors/logo.ts';
export type { LogoDetectionResult } from './extractors/logo.ts';
export { extractColorsFromHtml, mergeIntoBrandColors } from './extractors/colors.ts';
export type { ColorExtraction } from './extractors/colors.ts';
export { extractAvatars } from './extractors/avatar.ts';
export { captureScreenshot } from './extractors/screenshot.ts';
export { discoverAssets, mergeIntoProfileAssets } from './discoverAssets.ts';
export type { DiscoverAssetsInput } from './discoverAssets.ts';
