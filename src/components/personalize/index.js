/**
 * Personalization core barrel export.
 *
 * Re-exports types, stores, resolvers, normalizer, and router for
 * downstream consumers (UI components, API routes, handoffs).
 *
 * Module-relative: this file lives at
 * `src/components/personalize/index.js` and is the canonical entry
 * for the personalization subsystem.
 */

export * from './types.js';
export {
  clientProfileStore,
  useClientProfileStore,
  useClients,
  useCurrentClientId,
} from './clientProfileStore.js';
export {
  sharedMediaStore,
  useSharedMediaStore,
} from './sharedMediaStore.js';
export {
  assetLibraryStore,
  useAssetLibraryStore,
  useLibrary,
} from './assetLibraryStore.js';
export {
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  DEFAULT_T2V_MODEL,
  DEFAULT_I2I_MODEL,
  resolveModelCapabilities,
  resolveAssetsForModel,
  getGenerationAssetUrl,
} from './modelCapabilityResolver.js';
export {
  normalizeLandingDemo,
  normalizeGoAiViralPrompt,
  normalizeGoAiViralVideo,
  normalizeImageDemo,
  normalizePersonalizationSource,
  getEligibility,
} from './sourceNormalizer.js';
export {
  runGeneration,
  buildImageStudioHandoff,
  buildVideoStudioHandoff,
} from './generationRouter.js';
