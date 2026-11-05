/**
 * Shared Personalization System — Types
 */

export type PersonalizationSourceType =
  | 'landing-demo'
  | 'go-ai-viral-prompt'
  | 'go-ai-viral-video'
  | 'image-demo'
  | 'future-demo'
  /**
   * A studio-originated project handed to the modal by the shared studio
   * entry point (`src/shared/personalization/studioEntry.ts`). Added as a
   * widening — every pre-existing member keeps its exact meaning.
   */
  | 'studio-project'

export interface PersonalizationSource {
  sourceType: PersonalizationSourceType
  id: string
  title: string
  mediaType: 'image' | 'video' | 'prompt-only'
  sourceMedia: string | null
  poster: string | null
  shortPrompt: string
  fullPrompt: string
  originalPrompt: string
  model?: string
  modelName?: string
  aspectRatio?: string
  duration?: number
  durationLabel?: string
  category?: string
  sourceUrl?: string
  sourceMetadata: Record<string, unknown>
}

export type AudienceType = 'me' | 'my-business' | 'customer'

/**
 * Which Personalization backend the shared modal is allowed to call.
 *
 * `authenticated` — the existing full pipeline: `/api/personalization/
 * research-business` + `/api/personalization/discover-assets` (Clerk session,
 * full crawl depth, vision analysis, persisted jobs, saved clients).
 *
 * `anonymous` — the restricted free pipeline behind `POST /api/demo/discover`:
 * depth 1, ≤12 assets, cross-instance rate limit, shared cache, no paid
 * provider calls and no persisted jobs.
 *
 * This is chosen by the caller that opens the modal (the landing page asks for
 * `anonymous`, the app opens it with the signed-in user's permissions). The
 * modal never infers it, and the server re-checks it on every request.
 */
export type PersonalizationAccessMode = 'anonymous' | 'authenticated'

export interface BusinessDiscoveryRecord {
  id: string
  source: 'OPENSTREETMAP'
  osmType?: 'node' | 'way' | 'relation'
  osmId?: string
  name: string
  category: string
  address?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  website?: string
  facebook?: string
  instagram?: string
  whatsapp?: string
  youtube?: string
  linkedin?: string
  tiktok?: string
  openingHours?: string
  operator?: string
  brand?: string
  network?: string
  activityScore?: number
  leadScore?: number
  contactabilityScore?: number
  videoOpportunityScore?: number
  ownership?: BusinessOwnership
  /** Human-readable evidence for the ownership verdict. */
  ownershipEvidence?: string[]
  scoreBreakdown?: {
    contactability: number
    activity: number
    videoOpportunity: number
    ownership: BusinessOwnership
    rationale: string[]
  }
  videoOpportunity?: { hasPromoVideo: boolean | 'unknown'; signals: string[] }
  websiteStatus: 'confirmed' | 'unknown' | 'not_found_after_research'
  verificationStatus: 'unverified' | 'researching' | 'verified'
  rawSource?: Record<string, unknown>
}

/**
 * Ownership classification for a discovered business. Mirrors the server-side
 * contract in `src/server/businessDiscovery/types.ts` (`OwnershipType`).
 */
export type BusinessOwnership =
  | 'independent'
  | 'local_multi_location'
  | 'franchise_chain'
  | 'national_bigbox'
  | 'unknown'

export type BusinessSearchMode = 'idle' | 'searching' | 'results' | 'selected' | 'error'
export interface BusinessSearchState {
  mode: BusinessSearchMode
  results: BusinessDiscoveryRecord[]
  error: string | null
  query: {
    niche: string
    location: string
    radiusMiles: number
  } | null
  selectedBusiness: BusinessDiscoveryRecord | null
}

export interface ClientProfile {
  id: string
  audience: AudienceType
  name: string
  businessName: string
  industry: string
  location: string
  productService: string
  offer: string
  ctaHeadline: string
  callToAction: string
  phone: string
  website: string
  brandDescription: string
  createdAt: string
  updatedAt: string
}

export const EMPTY_CLIENT: ClientProfile = {
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
}

export type AssetRole =
  | 'presenter_identity'
  | 'face_identity'
  | 'character_identity'
  | 'logo'
  | 'product_reference'
  | 'brand_reference'
  | 'first_frame'
  | 'last_frame'
  | 'cta_graphic'
  | 'background_reference'
  | 'audio_reference'
  | 'saved_reference'

export interface PersonalizationAsset {
  id: string
  role: AssetRole
  name: string
  url: string
  uploadedUrl?: string
  isPrimary: boolean
  mimeType?: string
  width?: number
  height?: number
  createdAt: string
  uploadStatus?: 'local' | 'uploading' | 'ready' | 'error'
  uploadError?: string | null
  file?: File | null
  originalUrl?: string
  edited?: boolean
  editedDataUrl?: string
  videoReady?: boolean
  hasTransparency?: boolean
  editMetadata?: {
    operation?: string
    prompt?: string
    model?: string
    quality?: string
    responseId?: string | null
    imageGenerationCallId?: string | null
    revisedPrompt?: string | null
    outputFormat?: 'png' | 'jpeg' | 'webp'
    outputCompression?: number | null
    inputFidelity?: 'high' | 'low'
  }
  visionAnalysis?: PersonalizationVisionAnalysis
  visionValidation?: PersonalizationVisionValidation
  sourceCategory?: DiscoveredAssetCategory
  sourceType?: SourceType
  sourceDiscoveredAssetId?: string
}

export interface AssetLibrary {
  identities: PersonalizationAsset[]
  primaryIdentity: PersonalizationAsset | null
  logos: PersonalizationAsset[]
  primaryLogo: PersonalizationAsset | null
  products: PersonalizationAsset[]
  brandReferences: PersonalizationAsset[]
  firstFrame: PersonalizationAsset | null
  lastFrame: PersonalizationAsset | null
  ctaGraphic: PersonalizationAsset | null
  audio: PersonalizationAsset[]
  savedReferences: PersonalizationAsset[]
}

export const EMPTY_ASSET_LIBRARY: AssetLibrary = {
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
}

export interface PromptState {
  original: string
  personalized: string
  edited: string
}

export const EMPTY_PROMPT_STATE: PromptState = {
  original: '',
  personalized: '',
  edited: '',
}

export type OutputType = 'prompt' | 'image' | 'video' | 'everything'

export type VideoPersonalizationMode = 'face_only' | 'full_body' | 'recreate' | 'complete'
export type ImagePersonalizationMode = 'keep_design' | 'replace_face' | 'replace_person' | 'recreate' | 'complete'

export interface GenerationOptions {
  engine: string
  preserveAudio: boolean
  resolution?: string
  quality?: string
  characterOrientation?: string
  model?: string
  modelName?: string
  exactLogoHandling: 'ai-reference' | 'final-overlay'
  exactCtaHandling: 'ai-generated' | 'final-end-card'
  firstFrameMode: 'none' | 'uploaded' | 'generated'
  lastFrameMode: 'none' | 'uploaded' | 'generated'
  advancedModel?: string
  consentGiven: boolean
  aspectRatio?: string
  duration?: number
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  engine: 'smartvideo-recommended',
  preserveAudio: true,
  exactLogoHandling: 'final-overlay',
  exactCtaHandling: 'final-end-card',
  firstFrameMode: 'none',
  lastFrameMode: 'none',
  consentGiven: false,
}

export interface GenerationState {
  status: 'idle' | 'personalizing-prompt' | 'generating' | 'processing' | 'complete' | 'error'
  progress: number
  progressMessage: string
  errorMessage: string | null
  failedStage?: 'prompt' | 'generation'
}

export const EMPTY_GENERATION_STATE: GenerationState = {
  status: 'idle',
  progress: 0,
  progressMessage: '',
  errorMessage: null,
}

export interface PersonalizationProject {
  id: string
  source: PersonalizationSource
  client: ClientProfile
  assets: AssetLibrary
  prompt: PromptState
  outputType: OutputType
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  generation: GenerationOptions
  outputs: { prompts: string[]; images: string[]; videos: string[] }
  status: 'idle' | 'personalizing-prompt' | 'generating' | 'processing' | 'complete' | 'error'
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ResolvedAssets {
  directInputs: Record<string, unknown>
  promptContext: Record<string, string>
  preProcessing: Record<string, unknown>
  postProcessing: Record<string, unknown>
  unusedSavedReferences: PersonalizationAsset[]
}

export interface GenerationResult {
  type: 'prompt' | 'image' | 'video'
  url?: string
  urls?: string[]
  prompt?: string
  metadata?: Record<string, unknown>
}

/**
 * The final outcome of a personalization run, handed back to whoever opened
 * the modal (see `StudioPersonalizeOptions.onComplete`).
 *
 * Produced by the provider when a run finishes — through the AI generation
 * path or the in-browser branded render — and delivered at most once per open.
 */
export interface PersonalizationCompletion {
  /** The produced media, grouped by kind. */
  outputs: { prompts: string[]; images: string[]; videos: string[] }
  /** The prompt that produced the outputs. */
  personalizedPrompt: string
  /** The persisted project id, when the run restored or wrote one. */
  projectId?: string
  /** Which studio opened the modal, when the run was a studio hand-off. */
  originStudio?: string
  /** The source id the run was keyed on. */
  sourceId?: string
}

export interface ImageStudioHandoff {
  source: 'demo-personalization'
  sourceType: string
  imageUrl: string
  originalImageUrl?: string
  clientId?: string
  personalizedPrompt?: string
  referenceAssets?: PersonalizationAsset[]
  personalizationMode?: string
  createdAt: string
}

export interface VideoStudioHandoff {
  source: 'demo-personalization'
  sourceType: string
  videoUrl: string
  originalVideoUrl?: string
  clientId?: string
  identityAssetIds: string[]
  personalizationMode?: string
  personalizedPrompt?: string
  model?: string
  createdAt: string
}

export interface PersonalizationEligibility {
  enabled: boolean
  outputs: OutputType[]
  videoModes: VideoPersonalizationMode[]
  imageModes: ImagePersonalizationMode[]
  recommendedMode?: VideoPersonalizationMode | ImagePersonalizationMode
}

export interface SharedMediaEntry {
  id: string
  /**
   * Which surface produced this entry. `demo-personalization` is the original
   * literal (the Personalization demo flow); studio hand-offs record their own
   * studio slug (see `PersonalizationOriginStudio`). Widened from the literal
   * so a studio run can be told apart from a demo run — the only reader
   * (`guided/StepChooseVideo.tsx`) renders it as free text.
   */
  originStudio: string
  sourceType: string
  sourceDemoId?: string
  sourceDemoSlug?: string
  viralRecordId?: string
  sourceMedia: string | null
  sourceUrl: string | null
  personalizationMode: string | null
  model: string | null
  originalPrompt: string
  personalizedPrompt: string
  identityAssetIds: string[]
  logoAssetIds: string[]
  productAssetIds: string[]
  brandReferenceAssetIds: string[]
  firstFrameAssetId: string | null
  lastFrameAssetId: string | null
  outputUrls: string[]
  outputType: string
  clientId?: string
  createdAt: string
}


export interface PersonalizationVisionAnalysis {
  category: DiscoveredAssetCategory
  confidence: number
  qualityScore: number
  relevanceScore: number
  targetRole: string
  preserve: string[]
  issues: string[]
  recommendedOperations: string[]
  transparencyRecommended: boolean
  precisionRecommended: boolean
  textDetected: boolean
  duplicateLikely: boolean
  summary: string
  analyzedAt: string
  model?: string
}

export interface PersonalizationVisionValidation {
  passed: boolean
  confidence: number
  issues: string[]
  preserved: string[]
  changed: string[]
  summary: string
  analyzedAt: string
  model?: string
}

// ── Discovered Assets ──────────────────────────────────────────────────────────
// Temporary review state for website-scraped assets. These are NOT part of the
// permanent AssetLibrary until the user explicitly clicks "Use Selected Assets".

export type SourceType =
  | 'WEBSITE'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'X'
  | 'PINTEREST'
  | 'PUBLIC_SEARCH'
  | 'MANUAL_UPLOAD'
  | 'FIRECRAWL'

export type DiscoveredAssetCategory =
  | 'person'
  | 'logo'
  | 'product'
  | 'service'
  | 'completed_work'
  | 'storefront'
  | 'office'
  | 'branded_vehicle'
  | 'team'
  | 'brand'
  | 'irrelevant'

export type AssignedSection =
  | 'person'
  | 'logo'
  | 'products'
  | 'brand'
  | 'firstFrame'
  | 'lastFrame'
  | 'ctaGraphic'
  | null

export interface BusinessResearchResult {
  canonicalUrl: string
  finalUrl: string
  reachable: boolean
  statusCode?: number
  contentType?: string
  title?: string
  description?: string
  logoUrl?: string
  socialLinks: {
    facebook?: string
    instagram?: string
    linkedin?: string
    youtube?: string
    tiktok?: string
    x?: string
    pinterest?: string
  }
  jsonLd: Record<string, unknown>[]
  openGraph: Record<string, string>
  twitterCard: Record<string, string>
  contactInfo: {
    phones: string[]
    emails: string[]
    addresses: string[]
  }
  // Video-marketing evidence from the research route: a tri-state promo-video
  // verdict plus the raw detection signals (mirrors researchProvider.ts).
  videoMarketing?: {
    hasPromoVideo: boolean | 'unknown'
    signals: string[]
  }
  brandingAssets?: {
    logoUrl?: string
    imageUrls: string[]
  }
}

export interface DiscoveredAsset {
  id: string
  sourceUrl: string
  previewUrl: string
  sourceType: SourceType
  socialProfileUrl?: string
  category: DiscoveredAssetCategory
  confidence?: number
  qualityScore?: number
  relevanceScore?: number
  selected: boolean
  recommended: boolean
  rejected: boolean
  assignedSection: AssignedSection
  autoAssigned: boolean
  originalPreviewUrl?: string
  editedDataUrl?: string
  edited?: boolean
  videoReady?: boolean
  hasTransparency?: boolean
  editMetadata?: {
    operation?: string
    prompt?: string
    model?: string
    quality?: string
  }
  visionAnalysis?: PersonalizationVisionAnalysis
  visionValidation?: PersonalizationVisionValidation
}

// ── AI Assist Types (Phases 15-19) ─────────────────────────────────────────────

export interface AIAssistReadiness {
  canGenerate: boolean
  missing: string[]
  warnings: string[]
  score: number // 0-100
}

export interface AIAssistRecommendation {
  id: string
  type: 'asset' | 'mode' | 'output' | 'client' | 'prompt'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action?: () => void | Promise<void>
}

export interface AIAssistAction {
  id: string
  type: 'read' | 'mutate'
  label: string
  description: string
  requiresConfirmation: boolean
  execute: () => Promise<void>
}

export interface GenerationPlanStep {
  label: string
  description: string
  estimatedDuration: string
}

export interface GenerationPlan {
  steps: GenerationPlanStep[]
  estimatedTotalDuration: string
}

export interface AIAssistStructuredResponse {
  message: string
  recommendations: AIAssistRecommendation[]
  actions: AIAssistAction[]
  missingRequirements: string[]
  warnings: string[]
  readiness: AIAssistReadiness
  generationPlan?: GenerationPlan
}

// ── Guided Simple Mode + free Remotion preview ─────────────────────────────────

export type {
  PreviewLayoutId,
  PreviewLayerKind,
  PreviewAnimationId,
  PreviewPositionId,
  PreviewAspectRatio,
  PreviewLayer,
  PreviewBrandColors,
  PreviewVideoRef,
  PersonalizationPreviewSettings,
} from './preview/types'

// ── Shared Remotion design registry ──────────────────────────────────────────

export type {
  RemotionDesignCategory,
  RemotionDesignColorBinding,
  RemotionDesignColorRole,
  RemotionDesignColors,
  RemotionDesignComponent,
  RemotionDesignComponentProps,
  RemotionDesignMediaBinding,
  RemotionDesignMediaRole,
  RemotionDesignPlacement,
  RemotionDesignAnimation,
  RemotionDesignSource,
  RemotionDesignSupportCheck,
  RemotionDesignTemplate,
  RemotionDesignTemplateRegistry,
  RemotionDesignTextField,
  RemotionDesignTextSlot,
} from './templates/types'

export type GuidedStep = 1 | 2 | 3 | 4

export type PersonalizationViewMode = 'simple' | 'advanced'
