/**
 * Shared Personalization System — Types
 *
 * Ported from OpenHiggsBolt/src/shared/personalization/types.ts
 * (TypeScript types stripped, JSDoc preserved for IDE help).
 *
 * NOTE: This file intentionally contains NO executable state — just type
 * contracts (via JSDoc typedefs) and shared constants. All TypeScript
 * interfaces become JSDoc @typedef blocks; unions become JSDoc union
 * strings; the runtime constants (EMPTY_CLIENT, EMPTY_ASSET_LIBRARY, etc.)
 * are kept as plain objects.
 *
 * @module components/personalize/types
 */

/**
 * @typedef {'landing-demo' | 'go-ai-viral-prompt' | 'go-ai-viral-video' | 'image-demo' | 'future-demo'} PersonalizationSourceType
 */

/**
 * @typedef {Object} PersonalizationSource
 * @property {PersonalizationSourceType} sourceType
 * @property {string} id
 * @property {string} title
 * @property {'image' | 'video' | 'prompt-only'} mediaType
 * @property {string | null} sourceMedia
 * @property {string | null} poster
 * @property {string} shortPrompt
 * @property {string} fullPrompt
 * @property {string} originalPrompt
 * @property {string} [model]
 * @property {string} [modelName]
 * @property {string} [aspectRatio]
 * @property {number} [duration]
 * @property {string} [durationLabel]
 * @property {string} [category]
 * @property {string} [sourceUrl]
 * @property {Record<string, unknown>} sourceMetadata
 */

/**
 * @typedef {'me' | 'my-business' | 'customer'} AudienceType
 */

/**
 * @typedef {Object} ClientProfile
 * @property {string} id
 * @property {AudienceType} audience
 * @property {string} name
 * @property {string} businessName
 * @property {string} industry
 * @property {string} location
 * @property {string} productService
 * @property {string} offer
 * @property {string} ctaHeadline
 * @property {string} callToAction
 * @property {string} phone
 * @property {string} website
 * @property {string} brandDescription
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @type {ClientProfile} */
export const EMPTY_CLIENT = {
  id: '',
  audience: 'me',
  name: '',
  businessName: '',
  industry: '',
  location: '',
  productService: '',
  offer: '',
  ctaHeadline: '',
  callToAction: '',
  phone: '',
  website: '',
  brandDescription: '',
  createdAt: '',
  updatedAt: '',
};

/**
 * @typedef {'presenter_identity' | 'face_identity' | 'character_identity' | 'logo' | 'product_reference' | 'brand_reference' | 'first_frame' | 'last_frame' | 'cta_graphic' | 'background_reference' | 'audio_reference' | 'saved_reference'} AssetRole
 */

/**
 * @typedef {Object} PersonalizationAsset
 * @property {string} id
 * @property {AssetRole} role
 * @property {string} name
 * @property {string} url
 * @property {string} [uploadedUrl]
 * @property {boolean} isPrimary
 * @property {string} [mimeType]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} createdAt
 * @property {'local' | 'uploading' | 'ready' | 'error'} [uploadStatus]
 * @property {string | null} [uploadError]
 * @property {File | null} [file]
 */

/**
 * @typedef {Object} AssetLibrary
 * @property {PersonalizationAsset[]} identities
 * @property {PersonalizationAsset | null} primaryIdentity
 * @property {PersonalizationAsset[]} logos
 * @property {PersonalizationAsset | null} primaryLogo
 * @property {PersonalizationAsset[]} products
 * @property {PersonalizationAsset[]} brandReferences
 * @property {PersonalizationAsset | null} firstFrame
 * @property {PersonalizationAsset | null} lastFrame
 * @property {PersonalizationAsset | null} ctaGraphic
 * @property {PersonalizationAsset[]} audio
 * @property {PersonalizationAsset[]} savedReferences
 */

/** @type {AssetLibrary} */
export const EMPTY_ASSET_LIBRARY = {
  identities: [],
  primaryIdentity: null,
  logos: [],
  primaryLogo: null,
  products: [],
  brandReferences: [],
  firstFrame: null,
  lastFrame: null,
  ctaGraphic: null,
  audio: [],
  savedReferences: [],
};

/**
 * @typedef {Object} PromptState
 * @property {string} original
 * @property {string} personalized
 * @property {string} edited
 */

/** @type {PromptState} */
export const EMPTY_PROMPT_STATE = {
  original: '',
  personalized: '',
  edited: '',
};

/**
 * @typedef {'prompt' | 'image' | 'video' | 'everything'} OutputType
 */

/**
 * @typedef {'face_only' | 'full_body' | 'recreate' | 'complete'} VideoPersonalizationMode
 */
/**
 * @typedef {'keep_design' | 'replace_face' | 'replace_person' | 'recreate' | 'complete'} ImagePersonalizationMode
 */

/**
 * @typedef {Object} GenerationOptions
 * @property {string} engine
 * @property {boolean} preserveAudio
 * @property {string} [resolution]
 * @property {string} [quality]
 * @property {string} [characterOrientation]
 * @property {string} [model]
 * @property {string} [modelName]
 * @property {'ai-reference' | 'final-overlay'} exactLogoHandling
 * @property {'ai-generated' | 'final-end-card'} exactCtaHandling
 * @property {'none' | 'uploaded' | 'generated'} firstFrameMode
 * @property {'none' | 'uploaded' | 'generated'} lastFrameMode
 * @property {string} [advancedModel]
 * @property {boolean} consentGiven
 * @property {string} [aspectRatio]
 * @property {number} [duration]
 */

/** @type {GenerationOptions} */
export const DEFAULT_GENERATION_OPTIONS = {
  engine: 'smartvideo-recommended',
  preserveAudio: true,
  exactLogoHandling: 'final-overlay',
  exactCtaHandling: 'final-end-card',
  firstFrameMode: 'none',
  lastFrameMode: 'none',
  consentGiven: false,
};

/**
 * @typedef {Object} GenerationState
 * @property {'idle' | 'personalizing-prompt' | 'generating' | 'processing' | 'complete' | 'error'} status
 * @property {number} progress
 * @property {string} progressMessage
 * @property {string | null} errorMessage
 */

/** @type {GenerationState} */
export const EMPTY_GENERATION_STATE = {
  status: 'idle',
  progress: 0,
  progressMessage: '',
  errorMessage: null,
};

/**
 * @typedef {Object} PersonalizationProject
 * @property {string} id
 * @property {PersonalizationSource} source
 * @property {ClientProfile} client
 * @property {AssetLibrary} assets
 * @property {PromptState} prompt
 * @property {OutputType} outputType
 * @property {VideoPersonalizationMode | ImagePersonalizationMode | null} mode
 * @property {GenerationOptions} generation
 * @property {{ prompts: string[]; images: string[]; videos: string[] }} outputs
 * @property {'idle' | 'personalizing-prompt' | 'generating' | 'processing' | 'complete' | 'error'} status
 * @property {string | null} errorMessage
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ResolvedAssets
 * @property {Record<string, unknown>} directInputs
 * @property {Record<string, string>} promptContext
 * @property {Record<string, unknown>} preProcessing
 * @property {Record<string, unknown>} postProcessing
 * @property {PersonalizationAsset[]} unusedSavedReferences
 */

/**
 * @typedef {Object} GenerationResult
 * @property {'prompt' | 'image' | 'video'} type
 * @property {string} [url]
 * @property {string[]} [urls]
 * @property {string} [prompt]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} ImageStudioHandoff
 * @property {'demo-personalization'} source
 * @property {string} sourceType
 * @property {string} imageUrl
 * @property {string} [originalImageUrl]
 * @property {string} [clientId]
 * @property {string} [personalizedPrompt]
 * @property {PersonalizationAsset[]} [referenceAssets]
 * @property {string} [personalizationMode]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} VideoStudioHandoff
 * @property {'demo-personalization'} source
 * @property {string} sourceType
 * @property {string} videoUrl
 * @property {string} [originalVideoUrl]
 * @property {string} [clientId]
 * @property {string[]} identityAssetIds
 * @property {string} [personalizationMode]
 * @property {string} [personalizedPrompt]
 * @property {string} [model]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} PersonalizationEligibility
 * @property {boolean} enabled
 * @property {OutputType[]} outputs
 * @property {VideoPersonalizationMode[]} videoModes
 * @property {ImagePersonalizationMode[]} imageModes
 * @property {VideoPersonalizationMode | ImagePersonalizationMode} [recommendedMode]
 */

/**
 * @typedef {Object} SharedMediaEntry
 * @property {string} id
 * @property {'demo-personalization'} originStudio
 * @property {string} sourceType
 * @property {string} [sourceDemoId]
 * @property {string} [sourceDemoSlug]
 * @property {string} [viralRecordId]
 * @property {string | null} sourceMedia
 * @property {string | null} sourceUrl
 * @property {string | null} personalizationMode
 * @property {string | null} model
 * @property {string} originalPrompt
 * @property {string} personalizedPrompt
 * @property {string[]} identityAssetIds
 * @property {string[]} logoAssetIds
 * @property {string[]} productAssetIds
 * @property {string[]} brandReferenceAssetIds
 * @property {string | null} firstFrameAssetId
 * @property {string | null} lastFrameAssetId
 * @property {string[]} outputUrls
 * @property {string} outputType
 * @property {string} [clientId]
 * @property {string} createdAt
 */

// Frozen copies of mutable constants so accidental runtime mutation does not
// corrupt the shared empty defaults. Consumers that need to edit fields
// should clone the object first.
Object.freeze(EMPTY_CLIENT);
Object.freeze(EMPTY_ASSET_LIBRARY);
Object.freeze(EMPTY_PROMPT_STATE);
Object.freeze(DEFAULT_GENERATION_OPTIONS);
Object.freeze(EMPTY_GENERATION_STATE);
