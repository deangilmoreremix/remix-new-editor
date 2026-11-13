/**
 * DemoPersonalizeProvider + useDemoPersonalize
 *
 * Complete workflow state layer for the SmartVideo Personalization system.
 */

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import { useRouter } from '@ohb/lib/navigation'
import PersonalizationModal from './PersonalizationModal'
import { readHandoff, writeHandoff, TARGET_SLUG, type StudioTarget } from '@ohb/shared/crossStudio'
import { SocialPublishContext } from '@ohb/components/SocialPublishProvider'
import { useAuthConfig } from '@ohb/lib/authConfig'
import { getMotionTemplate, motionTemplateTitle, type MotionTemplate } from '@ohb/data/motionRecipeCatalog'

/** Safe accessor for SocialPublishContext — returns null when not wrapped in a provider. */
function useOptionalSocialPublish(): null | { openPublish: (opts: { mediaUrl: string; mediaType?: 'image' | 'video'; title?: string; caption?: string }) => void; closePublish: () => void; openSocialPublisher: (opts: { asset: unknown }) => void } {
  return useContext(SocialPublishContext)
}
import type {
  PersonalizationSource,
  ClientProfile,
  AssetLibrary,
  PersonalizationAsset,
  PromptState,
  OutputType,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  GenerationOptions,
  GenerationState,
  GenerationResult,
  SharedMediaEntry,
  PersonalizationEligibility,
  DiscoveredAsset,
  DiscoveredAssetCategory,
  AssignedSection,
  PersonalizationVisionAnalysis,
  PersonalizationVisionValidation,
  BusinessResearchResult,
  PersonalizationAccessMode,
  PersonalizationCompletion,
  GuidedStep,
  PersonalizationViewMode,
  AdvancedEditingTab,
  AdvancedEditingSections,
  PersonalizationPreviewSettings,
  PreviewLayer,
  PreviewVideoRef,
  PreviewLayoutId,
  PreviewBrandColors,
  PreviewAspectRatio,
} from './types'
import { EMPTY_GENERATION_STATE } from './types'
import type { ProtectedZone } from './preview/types'
import { measureImageHints } from './preview/imageHintsLoader'
import { normalizePersonalizationSource, getEligibility } from './sourceNormalizer'
import {
  loadClients,
  saveClient as saveClientRecord,
  createClient,
  deleteClient as deleteClientRecord,
  getCurrentClientId,
  setCurrentClientId,
} from './clientProfile'
import {
  loadClientAssets,
  saveClientAssets,
  deleteClientAssets,
  removeAssetFromClientLibrary,
  setPrimaryInClientLibrary,
  updateAssetInClientLibrary,
  type ClientAssetLibrary,
  EMPTY_CLIENT_ASSET_LIBRARY,
} from './clientAssets'
import {
  getSharedMedia,
  registerSharedMedia,
} from './sharedMedia'
import { registerSupabaseSharedMedia } from './supabaseSharedMedia'
import { personalizePrompt } from './promptPersonalizer'
import { runGeneration } from './generationRouter'
import { fitToModel, optionsForGeneration, resolveModelCapabilities, resolveAssetsForModel } from './modelCapabilityResolver'
import { applyPostProcessing, generateEndCardImage } from './postProcessor'
import type { BusinessDiscoveryRecord } from './types'
import { isOwnedWebsite, nonOwnedWebsiteMessage } from './websiteClassification'
import { uploadPersonalizationAsset } from './assetUploadService'
import { cancelActiveExport } from './webExport'
import { persistEditedPersonalizationAsset } from './editedAssetPersistence'

import { normalizeUrl, TRACKING_PARAMS } from './urlNormalizer'
import { createProjectPersistence, durableAssetUrls, loadProject, resolveRestoredAssetUrl, type LoadProjectResult, type PersonalizationProjectState } from './supabaseProjectPersistence'
import { imageLoadsInBrowser } from './imageLoadProbe'
import { prefetchBackgroundRemovalModel, cancelBackgroundRemovalPrefetch } from './backgroundRemoval/backgroundRemovalClient'
import { useAutoCutout, shouldHoldAutoImport, AUTO_IMPORT_CUTOUT_WAIT_MS, type AutoCutoutControls } from './backgroundRemoval/useAutoCutout'
import { buildPreviewInput } from './guided/buildPreviewInput'
import { fitSettingsToClip, readClipMetadata } from './preview/fitSettingsToClip'
import { chooseFinalOutputPath } from './finalOutput'
import {
  createDefaultPreviewSettings,
  applyLayoutPreset,
  applyDesignTemplate,
  addDesignTemplate,
  removeDesignLayer,
  resetLayoutToDefaults,
  resetPreviewDesign,
  normalizePreviewSettings,
  getCompositionDimensions,
  reflowLayersForAspect,
} from './preview/presets'
import {
  applyResearchedBrandColors,
  firstParagraphOf,
  researchBrandColors,
  type BrandColorPair,
} from './researchHelpers'
import {
  getRemotionDesignTemplate,
  listRemotionDesignTemplates,
  subscribeRemotionDesignRegistry,
} from './templates/registry'
import type { RemotionDesignTemplate } from './templates/types'
import { RECAST_MODEL, clampRecastDuration, loadRecastVideos, recastOwnerKey, saveRecastVideos, type RecastJob, type StartRecastInput } from './recast/recastJob'
import { useRecastJob } from './recast/useRecastJob'
import { registerGeneratedVideo } from './supabaseGeneratedVideos'
import {
  autoFilledKeysOf,
  businessContentFromResearch,
  clearAutoFilledContent,
  mergeAutoFilledContent,
  type AutoFillKey,
  type AutoFilledValues,
} from './businessContentFromResearch'

/**
 * Merge a job's reusable assets into a client's saved library: entries with
 * the same id are updated in place, new ones are appended, and saved entries
 * the job doesn't hold are kept. A job primary wins over the saved one.
 */
function mergeIntoClientLibrary(saved: ClientAssetLibrary, job: ClientAssetLibrary): ClientAssetLibrary {
  const mergeList = (base: PersonalizationAsset[] = [], incoming: PersonalizationAsset[] = []) => {
    const byId = new Map(incoming.map((asset) => [asset.id, asset]))
    const merged = base.map((asset) => byId.get(asset.id) ?? asset)
    const known = new Set(base.map((asset) => asset.id))
    for (const asset of incoming) if (!known.has(asset.id)) merged.push(asset)
    return merged
  }
  return {
    identities: mergeList(saved.identities, job.identities),
    primaryIdentity: job.primaryIdentity ?? saved.primaryIdentity ?? null,
    logos: mergeList(saved.logos, job.logos),
    primaryLogo: job.primaryLogo ?? saved.primaryLogo ?? null,
    products: mergeList(saved.products, job.products),
    brandReferences: mergeList(saved.brandReferences, job.brandReferences),
  }
}

const EMPTY_ASSET_LIBRARY: AssetLibrary = {
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

const EMPTY_PROMPT_STATE: PromptState = {
  original: '',
  personalized: '',
  edited: '',
}

const EMPTY_GENERATION_OPTIONS: GenerationOptions = {
  engine: 'smartvideo-recommended',
  preserveAudio: true,
  exactLogoHandling: 'final-overlay',
  exactCtaHandling: 'final-end-card',
  firstFrameMode: 'none',
  lastFrameMode: 'none',
  consentGiven: false,
}

const MAX_REFERENCE_UPLOADS = 10

// ── Guided Simple Mode + free preview helpers ────────────────────────────────
//
// The preview is a free, local Remotion composition: it never calls MuAPI or
// OpenAI. Everything below only derives/clamps settings and reads/writes the
// browser mirror used when Supabase has no saved state.

/** Per-run generation settings (see runGenerate). */
interface GenerateOverrides {
  options?: Partial<GenerationOptions>
  burnInLayers?: boolean
}

/**
 * The URL a remote service (social publishing) can fetch for a result, or ''
 * when the video only exists in this browser (a blob: render whose upload
 * failed, or a branded render that is downloaded, not stored).
 */
/**
 * The video URL another studio can load: the stored copy when the result
 * itself is browser-only (layers burned in locally), else a non-blob result URL.
 */
/**
 * The library without the assets placed automatically from the given
 * discovered-asset ids, wherever the user moved them. Edited copies stay. If
 * the primary logo goes, the first remaining logo becomes primary (flag and
 * pointer together) so the preview keeps a logo; the person slot likewise.
 */
export function withoutAutoImported(prev: AssetLibrary, ids: ReadonlySet<string>): AssetLibrary {
  const isAuto = (asset: PersonalizationAsset | null | undefined) =>
    Boolean(
      asset?.sourceDiscoveredAssetId &&
        ids.has(asset.sourceDiscoveredAssetId) &&
        // An automatic background-removal cutout is not a user edit.
        (!asset.edited || (asset.editMetadata as { engine?: string } | undefined)?.engine === 'bg0'),
    )
  const logos = prev.logos.filter((asset) => !isAuto(asset))
  const primaryWasAuto = isAuto(prev.primaryLogo)
  const promoted = primaryWasAuto && logos[0] ? { ...logos[0], isPrimary: true } : null
  const keptIdentities = prev.identities.filter((asset) => !isAuto(asset))
  const identityWasAuto = isAuto(prev.primaryIdentity)
  const promotedIdentity = identityWasAuto && keptIdentities[0] ? { ...keptIdentities[0], isPrimary: true } : null
  const identities = promotedIdentity
    ? keptIdentities.map((asset) => (asset.id === promotedIdentity.id ? promotedIdentity : asset))
    : keptIdentities
  return {
    ...prev,
    logos: promoted ? logos.map((asset) => (asset.id === promoted.id ? promoted : asset)) : logos,
    primaryLogo: primaryWasAuto ? promoted : prev.primaryLogo,
    products: prev.products.filter((asset) => !isAuto(asset)),
    brandReferences: prev.brandReferences.filter((asset) => !isAuto(asset)),
    identities,
    primaryIdentity: identityWasAuto ? promotedIdentity : prev.primaryIdentity,
    firstFrame: isAuto(prev.firstFrame) ? null : prev.firstFrame,
    lastFrame: isAuto(prev.lastFrame) ? null : prev.lastFrame,
    ctaGraphic: isAuto(prev.ctaGraphic) ? null : prev.ctaGraphic,
  }
}

/** Shown when a final video is missing the on-video layers the user approved. */
export const LAYERS_MISSING_NOTE =
  "This video doesn't include your on-video layers: they couldn't be added or saved. Create the final video again to add them."

/** The URL a saved project keeps for a result: the result itself unless it
 *  is browser-only, else its stored copy ('' if there is none). */
export function projectOutputUrl(result: GenerationResult | null | undefined): string {
  if (!result) return ''
  if (result.url && !result.url.startsWith('blob:')) return result.url
  const stored = (result.metadata as Record<string, unknown> | undefined)?.storedUrl
  return typeof stored === 'string' && /^https?:\/\//.test(stored) ? stored : ''
}

export function studioVideoUrl(result: GenerationResult | null | undefined): string {
  if (!result) return ''
  return publishableUrl(result) || (result.url && !result.url.startsWith('blob:') ? result.url : '')
}

export function publishableUrl(result: GenerationResult | null | undefined): string {
  if (!result) return ''
  const isRemote = (url: unknown): url is string => typeof url === 'string' && /^https?:\/\//.test(url)
  const meta = result.metadata as Record<string, unknown> | undefined
  if (meta && 'publishUrl' in meta) return isRemote(meta.publishUrl) ? meta.publishUrl : ''
  return isRemote(result.url) ? result.url : ''
}

/**
 * The video a new recast replaces. Recasting a recast keeps the original
 * footage from before the first recast, so "Use original video" still goes
 * back to it.
 */
export function videoBeforeRecast(current: PreviewVideoRef | null | undefined): PreviewVideoRef | null {
  if (!current) return null
  if (current.kind === 'recast') return current.beforeRecast ?? null
  return current
}

/**
 * A saved preview video that can be shown again. In-browser (blob:) URLs do
 * not survive a reload, so they are dropped, including on the video a recast
 * replaced.
 */
export function restorablePreviewVideo(stored: unknown): PreviewVideoRef | null {
  if (!stored || typeof stored !== 'object') return null
  const video = stored as PreviewVideoRef
  if (typeof video.url !== 'string' || video.url.startsWith('blob:')) return null
  if (video.kind !== 'recast') {
    const rest = { ...video }
    delete rest.beforeRecast
    return rest
  }
  const restored: PreviewVideoRef = { ...video, beforeRecast: restorablePreviewVideo(video.beforeRecast) }
  // An in-browser sound URL doesn't survive a reload either.
  if (restored.audioUrl !== undefined && (typeof restored.audioUrl !== 'string' || restored.audioUrl.startsWith('blob:'))) {
    restored.audioUrl = null
  }
  return restored
}

function clampPreviewNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function clampPreviewFrame(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(0, n)
}

/** Keeps layer geometry/opacity/timing inside the ranges the renderer supports. */
function clampPreviewLayer(layer: PreviewLayer): PreviewLayer {
  return {
    ...layer,
    x: clampPreviewNumber(layer.x, 0, 1, 0),
    y: clampPreviewNumber(layer.y, 0, 1, 0),
    scale: clampPreviewNumber(layer.scale, 0.02, 2, 1),
    opacity: clampPreviewNumber(layer.opacity, 0, 1, 1),
    animationDelay: clampPreviewFrame(layer.animationDelay, 0),
    startFrame: clampPreviewFrame(layer.startFrame, 0),
    endFrame:
      typeof layer.endFrame === 'number' && Number.isFinite(layer.endFrame)
        ? clampPreviewFrame(layer.endFrame, clampPreviewFrame(layer.startFrame, 0))
        : undefined,
  }
}

/** The demo's own aspect ratio when it is one the preview can render. */
function sourceAspectRatio(source: PersonalizationSource): PreviewAspectRatio {
  const ratio = source.aspectRatio
  return ratio === '9:16' || ratio === '1:1' || ratio === '4:5' ? ratio : '16:9'
}

/** Default preview composition seeded from a freshly opened source. */
function sourcePreviewDefaults(source: PersonalizationSource): PersonalizationPreviewSettings {
  const aspectRatio = sourceAspectRatio(source)
  const { width, height } = getCompositionDimensions(aspectRatio)
  const seconds =
    typeof source.duration === 'number' && Number.isFinite(source.duration) && source.duration > 0
      ? source.duration
      : 5
  const fps = createDefaultPreviewSettings().fps
  return createDefaultPreviewSettings({
    aspectRatio,
    width,
    height,
    durationInFrames: Math.max(1, Math.round(fps * seconds)),
  })
}

interface PersistedPreviewState {
  previewSettings?: unknown
  previewVideo?: unknown
  guidedStep?: unknown
  viewMode?: unknown
  advancedTab?: unknown
  advancedSections?: unknown
  /** Motion Studio template selected in Step 2 (full metadata), so the
   *  in-modal preview survives a reload. The provider re-resolves it through
   *  `getMotionTemplate` on restore; storing the full object (not just an id)
   *  keeps the preview renderable even before the catalog finishes loading. */
  motionTemplate?: unknown
}

const PREVIEW_STORAGE_PREFIX = 'smartvideo_preview_state_'

const ADVANCED_TAB_IDS: AdvancedEditingTab[] = ['client', 'assets', 'recast', 'create']
function toAdvancedTab(value: unknown): AdvancedEditingTab {
  return ADVANCED_TAB_IDS.includes(value as AdvancedEditingTab) ? (value as AdvancedEditingTab) : 'client'
}

/** First section of each tab; must match ADVANCED_SECTIONS in advanced/AdvancedWorkspace.tsx. */
export const DEFAULT_ADVANCED_SECTIONS: AdvancedEditingSections = {
  client: 'find',
  assets: 'yours',
  recast: 'recast',
  create: 'overlays',
}
function toAdvancedSections(value: unknown): AdvancedEditingSections {
  const stored = value && typeof value === 'object' ? (value as Partial<AdvancedEditingSections>) : {}
  const next = { ...DEFAULT_ADVANCED_SECTIONS }
  for (const tab of ADVANCED_TAB_IDS) {
    if (typeof stored[tab] === 'string' && stored[tab]) next[tab] = stored[tab] as string
  }
  return next
}
/** The download route accepts at most this many URLs per request. */
const DOWNLOAD_BATCH_SIZE = 20

/**
 * Build the localStorage key for the preview mirror. The key is scoped to the
 * current user so two visitors sharing a browser never see each other's
 * in-progress preview state — and so the restore path can refuse to rehydrate
 * another user's mirror. The `userScope` is opaque; the provider receives it
 * via a prop or derives it from the per-user MuAPI key.
 */
function previewStorageKey(sourceId: string, userScope: string): string {
  return `${PREVIEW_STORAGE_PREFIX}${userScope}_${sourceId}`
}

/** Defensive localStorage read — never throws and never returns garbage. */
function readPreviewStorage(sourceId: string, userScope: string): PersistedPreviewState | null {
  if (typeof window === 'undefined' || !sourceId || !userScope) return null
  try {
    // Primary key: user-scoped, so two visitors sharing a browser never see
    // each other's in-progress preview state.
    const raw = localStorage.getItem(previewStorageKey(sourceId, userScope))
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as PersistedPreviewState
      }
    }
    // Backward-compat fallback: the pre-fix key was `${prefix}${sourceId}`
    // with no user scope. Only honor it when the current scope is anonymous,
    // so authenticated users never restore another user's stale mirror.
    if (userScope === 'anonymous') {
      const legacyRaw = localStorage.getItem(`${PREVIEW_STORAGE_PREFIX}${sourceId}`)
      if (legacyRaw) {
        const parsed: unknown = JSON.parse(legacyRaw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as PersistedPreviewState
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Defensive localStorage write — best-effort, never throws. */
function writePreviewStorage(sourceId: string, userScope: string, state: PersistedPreviewState): void {
  if (typeof window === 'undefined' || !sourceId || !userScope) return
  try {
    localStorage.setItem(previewStorageKey(sourceId, userScope), JSON.stringify(state))
  } catch {
    /* best-effort; do not throw */
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getGenerationAssetUrl(asset: PersonalizationAsset | null | undefined): string | undefined {
  if (!asset) return undefined
  if (asset.uploadStatus !== 'ready') return undefined
  const url = asset.uploadedUrl || asset.url
  if (!url || typeof url !== 'string' || url.startsWith('blob:')) return undefined
  return url
}
function isBlobUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('blob:')
}

/**
 * Every blob URL an asset still depends on — its preview plus the original
 * kept for revert.  Only `blob:` URLs are ever returned: durable HTTPS
 * (Supabase storage) URLs must never be revoked.
 */
function assetBlobUrls(asset: PersonalizationAsset | null | undefined): string[] {
  if (!asset) return []
  const urls = new Set<string>()
  for (const url of [asset.url, asset.uploadedUrl, asset.originalUrl]) {
    if (isBlobUrl(url)) urls.add(url)
  }
  return Array.from(urls)
}

/**
 * Counts how many assets of a library still reference each blob URL.
 * Accepts partial libraries (e.g. the saved-client library, which has no
 * frame/audio/saved-reference sections) — missing sections count as zero.
 */
function countBlobUrlReferences(library: Partial<AssetLibrary> | null | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (asset: PersonalizationAsset | null | undefined) => {
    for (const url of assetBlobUrls(asset)) {
      counts.set(url, (counts.get(url) ?? 0) + 1)
    }
  }
  if (!library) return counts
  library.identities?.forEach(bump)
  library.logos?.forEach(bump)
  library.products?.forEach(bump)
  library.brandReferences?.forEach(bump)
  bump(library.firstFrame)
  bump(library.lastFrame)
  bump(library.ctaGraphic)
  library.audio?.forEach(bump)
  library.savedReferences?.forEach(bump)
  return counts
}

function findAssetInLibrary(library: AssetLibrary, id: string): PersonalizationAsset | null {
  const all = [
    ...library.identities,
    ...library.logos,
    ...library.products,
    ...library.brandReferences,
    library.firstFrame,
    library.lastFrame,
    library.ctaGraphic,
    ...library.audio,
    ...library.savedReferences,
  ].filter(Boolean) as PersonalizationAsset[]
  return all.find((a) => a.id === id) ?? null
}

/** Revokes a blob URL at most once for the lifetime of the provider. */
function revokeBlobUrlOnce(revokedUrls: Set<string>, url: string | null | undefined): boolean {
  if (!isBlobUrl(url)) return false
  if (revokedUrls.has(url)) return false
  revokedUrls.add(url)
  URL.revokeObjectURL(url)
  return true
}

/**
 * Releases the blob URLs owned by `assetId`.
 *
 * Ownership is tracked independently of React state (see `ownedJobBlobUrlsRef`),
 * so this still finds the blob when an upload resolves before React commits the
 * asset that created it.  A URL is revoked only when no live entry in EITHER
 * library references it any more: URLs replaced by the pending change
 * (`superseded`) count as dead, as does the revert `originalUrl` when the asset
 * itself is destroyed (`dropOriginal`).  Anything still referenced — including
 * by a saved-client library entry that shares the blob — is left alone:
 * correctness over eagerness.
 */
function releaseOwnedBlobUrls(
  ownedByAsset: Map<string, Set<string>>,
  revokedUrls: Set<string>,
  assetId: string,
  liveCounts: Map<string, number>,
  asset: PersonalizationAsset | null | undefined,
  current: PersonalizationAsset | null | undefined,
  opts: { superseded?: (string | null | undefined)[]; dropOriginal?: boolean } = {},
): number {
  const owned = ownedByAsset.get(assetId)
  if (!owned || owned.size === 0) return 0

  // Race guard: a newer version of this asset is already live with different
  // URLs (an edit was applied, or a second upload completed first).  This
  // completion is stale — leave bookkeeping untouched so a URL owned by the
  // newer asset is never revoked.
  if (asset && current && current.url !== asset.url) return 0

  const live = liveCounts
  // One release removes exactly ONE asset's worth of references: the asset's
  // own URLs and the URLs the caller marks superseded describe the same
  // entry being replaced, so they are deduped together.  Dropping the same
  // URL twice would under-count references still held by the saved library
  // and revoke a blob that is still rendered.
  const removed = new Set<string>()
  const mark = (url: string | null | undefined) => {
    if (isBlobUrl(url)) removed.add(url)
  }
  if (asset) {
    mark(asset.url)
    mark(asset.uploadedUrl)
    if (opts.dropOriginal) mark(asset.originalUrl)
  }
  for (const url of opts.superseded ?? []) mark(url)
  for (const url of removed) {
    const next = (live.get(url) ?? 0) - 1
    if (next > 0) live.set(url, next)
    else live.delete(url)
  }

  let released = 0
  for (const url of owned) {
    if (live.has(url)) continue
    owned.delete(url)
    if (revokeBlobUrlOnce(revokedUrls, url)) released += 1
  }
  if (owned.size === 0) ownedByAsset.delete(assetId)
  return released
}

/** Releases every owned blob URL that `live` does not still reference. */
function releaseAllOwnedBlobUrls(
  ownedByAsset: Map<string, Set<string>>,
  revokedUrls: Set<string>,
  live: Map<string, number>,
): number {
  let released = 0
  for (const [assetId, owned] of ownedByAsset) {
    for (const url of owned) {
      if (live.has(url)) continue
      owned.delete(url)
      if (revokeBlobUrlOnce(revokedUrls, url)) released += 1
    }
    if (owned.size === 0) ownedByAsset.delete(assetId)
  }
  return released
}

// ── Blob URL lifecycle (reference-counted) ───────────────────────────────────
//
// Blob URLs are created outside React's state flow, so ownership is tracked
// in refs keyed by asset id and captured synchronously at creation, instead
// of read back from `assetsRef` (which only syncs once React commits).  This
// keeps a blob revocable when its upload resolves before that commit, and
// `revokedBlobUrls` makes every release idempotent.  A URL is revoked only
// when no live asset still references it — correctness over eagerness, so
// removing or editing one asset never invalidates blob URLs still referenced
// by another asset.

// ── Context ──────────────────────────────────────────────────────────────────
type OpenPersonalizeOptions = {
  source: unknown
  trigger?: HTMLElement | null
  /**
   * Which backend the modal may call. Chosen by the caller that opens the
   * modal (the landing page asks for 'anonymous'), never inferred by the modal
   * and always re-checked server-side. Defaults to 'authenticated' so every
   * existing entry point keeps the full pipeline unchanged.
   */
  access?: PersonalizationAccessMode
  /**
   * Which surface opened the modal. Recorded on the persisted project and on
   * the shared-media entry so a studio run is distinguishable from the demo
   * flow. Absent → the historical literal `'demo-personalization'`, so every
   * existing call site (landing, demo, viral, free-discovery, the design
   * preview) keeps its exact behaviour.
   */
  originStudio?: string
  /**
   * Pre-seed the modal's brand-asset library. The library starts empty and is
   * normally filled by upload/discovery; a studio that already owns brand
   * assets can hand them over with the open call.
   */
  initialAssets?: AssetLibrary
  /**
   * Called once, with the finished outputs, when the run produces a final
   * result. Cleared when the modal closes, so it never leaks into the next
   * open.
   */
  onComplete?: (completion: PersonalizationCompletion) => void
  /**
   * Where the finished result is handed off when the run completes. Uses the
   * existing cross-studio transport (`StudioHandoff` / `writeHandoff`) — the
   * modal writes the hand-off and navigates to the target studio.
   */
  returnTo?: StudioTarget
  /** Free-form payload carried along with the hand-off. */
  returnPayload?: Record<string, unknown>
}

export interface BusinessLoadSummary {
  domain: string
  details: number
  logo: boolean
  photos: number
}

/** Discovered categories auto-placed into empty client-asset cards (never people). */
const AUTO_IMPORT_PHOTO_CATEGORIES: Record<string, 'products' | 'brand'> = {
  product: 'products',
  service: 'products',
  completed_work: 'products',
  storefront: 'brand',
  office: 'brand',
  branded_vehicle: 'brand',
  team: 'brand',
  brand: 'brand',
}
const AUTO_IMPORT_PHOTOS_PER_CARD = 3

function discoveredAssetRank(asset: DiscoveredAsset): number {
  return (asset.recommended ? 100 : 0)
    + (asset.relevanceScore ?? 0)
    + (asset.qualityScore ?? 0)
    + (asset.confidence ?? 0)
}

/**
 * Which discovered assets to place automatically after a business is found:
 * the best logo when the Logo card is empty, and up to three photos for each
 * empty Products / Brand Refs card. People are never auto-placed.
 */
export function pickAutoImportAssets(discovered: DiscoveredAsset[], library: AssetLibrary): DiscoveredAsset[] {
  const usable = discovered.filter((asset) => !asset.rejected && asset.previewUrl)
  const ranked = [...usable].sort((a, b) => discoveredAssetRank(b) - discoveredAssetRank(a))
  const picked: DiscoveredAsset[] = []
  if (library.logos.length === 0) {
    const logo = ranked.find((asset) => asset.category === 'logo')
    if (logo) picked.push({ ...logo, assignedSection: 'logo' })
  }
  const cards: Array<{ section: 'products' | 'brand'; empty: boolean }> = [
    { section: 'products', empty: library.products.length === 0 },
    { section: 'brand', empty: library.brandReferences.length === 0 },
  ]
  for (const { section, empty } of cards) {
    if (!empty) continue
    ranked
      .filter((asset) => AUTO_IMPORT_PHOTO_CATEGORIES[asset.category] === section)
      .slice(0, AUTO_IMPORT_PHOTOS_PER_CARD)
      .forEach((asset) => picked.push({ ...asset, assignedSection: section }))
  }
  return picked
}

/** Website lookup for a business whose listing has no owned website. */
export interface WebsiteLookupState {
  status: 'idle' | 'searching' | 'found' | 'not_found' | 'error'
  businessId?: string
  businessName?: string
  website?: string
}

export interface ImportDiscoveredAssetsOptions {
  ids?: string[]
  section?: AssignedSection
}

export type DemoPersonalizeContextValue = {
  // Modal
  isOpen: boolean
  source: PersonalizationSource | null
  sourceTypeLabel?: string
  openPersonalize: (opts: OpenPersonalizeOptions) => void
  closePersonalize: () => void

  // Access mode (which discovery endpoint this session may call)
  access: PersonalizationAccessMode

  // Automated "Find My Brand" workflow: one call that populates the client
  // form (through the existing selectBusiness mapping), runs the shared
  // research path and then asset discovery for one website URL. `options.business`
  // is the OpenStreetMap record when the visitor picked a search result; without
  // it a minimal record is derived from the URL itself.
  runDiscoveryWorkflow: (
    websiteUrl: string,
    options?: { business?: BusinessDiscoveryRecord },
  ) => Promise<void>

  // Client
  clients: ClientProfile[]
  selectedClientId: string
  clientForm: Partial<ClientProfile>
  selectClient: (id: string) => void
  createClient: (partial: Partial<ClientProfile>) => ClientProfile
  saveClient: () => Promise<ClientProfile | null>
  updateClient: (client: ClientProfile) => void
  deleteClient: (id: string) => void
  updateClientForm: (patch: Partial<ClientProfile>) => void

  // Assets
  assets: AssetLibrary
  addIdentityFiles: (files: FileList | null) => void
  addIdentityUrl: (url: string) => void
  removeIdentity: (id: string) => void
  setPrimaryIdentity: (id: string) => void
  addLogoFiles: (files: FileList | null) => void
  addLogoUrl: (url: string) => void
  removeLogo: (id: string) => void
  setPrimaryLogo: (id: string) => void
  addProductFiles: (files: FileList | null) => void
  addProductUrl: (url: string) => void
  removeProduct: (id: string) => void
  addBrandReferenceFiles: (files: FileList | null) => void
  addBrandReferenceUrl: (url: string) => void
  removeBrandReference: (id: string) => void
  setFirstFrameFile: (file: File | null) => void
  setFirstFrameUrl: (url: string) => void
  removeFirstFrame: () => void
  setLastFrameFile: (file: File | null) => void
  setLastFrameUrl: (url: string) => void
  removeLastFrame: () => void
  setCtaGraphicFile: (file: File | null) => void
  setCtaGraphicUrl: (url: string) => void
  removeCtaGraphic: () => void
  retryAssetUpload: (id: string) => Promise<void>
  applyEditedPersonalizationAsset: (
    assetId: string,
    dataUrl: string,
    meta: {
      operation: string
      prompt: string
      model: string
      quality: string
      transparent: boolean
      videoReady: boolean
      responseId?: string | null
      imageGenerationCallId?: string | null
      revisedPrompt?: string | null
      outputFormat?: 'png' | 'jpeg' | 'webp'
      outputCompression?: number | null
      inputFidelity?: 'high' | 'low'
      visionAnalysis?: PersonalizationVisionAnalysis
      visionValidation?: PersonalizationVisionValidation
    },
  ) => Promise<void>
  applyEditedSavedClientAsset: (
    clientId: string,
    assetId: string,
    dataUrl: string,
    meta: {
      operation: string
      prompt: string
      model: string
      quality: string
      transparent: boolean
      videoReady: boolean
      responseId?: string | null
      imageGenerationCallId?: string | null
      revisedPrompt?: string | null
      outputFormat?: 'png' | 'jpeg' | 'webp'
      outputCompression?: number | null
      inputFidelity?: 'high' | 'low'
      visionAnalysis?: PersonalizationVisionAnalysis
      visionValidation?: PersonalizationVisionValidation
    },
  ) => Promise<void>

  // Discovered assets
  discoveredAssets: DiscoveredAsset[]
  discoveryStatus: 'idle' | 'discovering' | 'reviewing' | 'importing'
  discoveryError: string | null
  /** Shows (or clears with `null`) the discovery error banner. */
  setDiscoveryError: (message: string | null) => void
  importConfirmation: { count: number; clientName?: string } | null
  setDiscoveredAssets: (assets: DiscoveredAsset[]) => void
  toggleDiscoveredAssetSelection: (id: string) => void
  rejectDiscoveredAsset: (id: string) => void
  restoreDiscoveredAsset: (id: string) => void
  updateDiscoveredAssetCategory: (id: string, category: DiscoveredAssetCategory) => void
  removeDiscoveredAssetFromSection: (id: string) => void
  moveDiscoveredAssetToSection: (id: string, section: AssignedSection) => void
  revertDiscoveredAssetEdit: (id: string) => void
  /** On-device background removal for discovered assets (auto queue + manual controls). */
  autoCutout: AutoCutoutControls
  selectRecommendedDiscoveredAssets: () => void
  /** Imports the selected assets, or only `ids` into `section` (a drop onto a section). */
  /** Resolves with the ids of the discovered assets it placed. */
  importDiscoveredAssets: (options?: ImportDiscoveredAssetsOptions) => Promise<string[]>
  cancelDiscovery: () => void
  discoverAssets: (websiteUrl: string) => Promise<void>
  visionStatus: 'idle' | 'analyzing' | 'complete' | 'error'
  visionError: string | null
  analyzeDiscoveredAssets: () => Promise<void>

  // Library asset actions
  moveLibraryAssetToSection: (assetId: string, section: AssignedSection) => void
  removeLibraryAssetFromSection: (assetId: string) => void
  deleteLibraryAsset: (assetId: string) => void
  revertLibraryAssetToOriginal: (assetId: string) => void

  // Business search
  businessSearchMode: 'idle' | 'searching' | 'results' | 'selected' | 'error'
  businessSearchResults: BusinessDiscoveryRecord[]
  businessSearchError: string | null
  businessSearchQuery: { niche: string; location: string; radiusMiles: number } | null
  selectedBusiness: BusinessDiscoveryRecord | null
  businessResearch: {
    status: 'idle' | 'researching' | 'done' | 'error'
    result?: BusinessResearchResult
    error?: string
  }
  findBusinesses: (niche: string, location: string, radiusMiles: number) => Promise<void>
  selectBusiness: (business: BusinessDiscoveryRecord) => void
  /** Client-form fields still holding a value the business finder filled in. */
  autoFilledKeys: Set<AutoFillKey>
  /** What finding the current business loaded, for the one-line summary. */
  businessLoadSummary: BusinessLoadSummary | null
  /**
   * Finds a selected business's OWN website when OpenStreetMap lists only a
   * social page (or nothing). Resolves the verified URL or `null`.
   */
  resolveBusinessWebsite: (business: BusinessDiscoveryRecord) => Promise<string | null>
  /** Status of the most recent website lookup (shown next to the website field). */
  websiteLookup: WebsiteLookupState
  researchBusiness: (retryUrl?: string) => Promise<void>
  clearBusinessSearch: () => void
  setBusinessSearchMode: (mode: 'idle' | 'searching' | 'results' | 'selected' | 'error') => void

  // Prompt
  promptState: PromptState
  personalizePrompt: () => Promise<void>
  updatePersonalizedPrompt: (text: string) => void
  resetPrompt: () => void

  // Output / mode / options
  outputType: OutputType
  setOutputType: (type: OutputType) => void
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  setMode: (mode: VideoPersonalizationMode | ImagePersonalizationMode | null) => void
  /**
   * How the final video is made. `browser` = a local Remotion render of the approved overlays (no AI, no credits,
   * no prompt personalization, no mode needed); `ai` = the existing generation pipeline, which needs a mode.
   * Derived from the saved mode for old projects (an AI mode => `ai`, otherwise `browser`).
   */
  creationMethod: 'browser' | 'ai'
  setCreationMethod: (method: 'browser' | 'ai') => void
  genOptions: GenerationOptions
  updateGenOptions: (patch: Partial<GenerationOptions>) => void
  consent: boolean
  setConsent: (value: boolean) => void

  // Generation
  generate: () => Promise<void>
  retry: () => Promise<void>
  generateAgain: () => Promise<void>
  retryBranding: () => Promise<void>
  generation: GenerationState

  // Result
  result: GenerationResult | null
  resultTab: 'prompt' | 'images' | 'videos'
  setResultTab: (tab: 'prompt' | 'images' | 'videos') => void
  editInImageStudio: () => void
  editInVideoStudio: () => void
  openImageEditor?: (asset: {
    id: string
    name: string
    imageUrl: string
    originalImageUrl: string
    category: string | undefined
    role: string
    source: string
    businessName?: string
    industry?: string
    productService?: string
    brandDescription?: string
    referenceImages: string[]
    visionAnalysis?: any
  }, operation: string) => void
  publish: () => void
  download: () => void

  // Shared media
  sharedMediaEntries: SharedMediaEntry[]
  eligibility: PersonalizationEligibility

  // Saved client assets
  savedClientAssets: ClientAssetLibrary
  savedAssetLibraryTab: 'identities' | 'logos' | 'products' | 'brandReferences'
  setSavedAssetLibraryTab: (tab: 'identities' | 'logos' | 'products' | 'brandReferences') => void
  useSavedClient: (id: string) => void
  deleteSavedClient: (id: string) => void
  selectSavedAsset: (asset: PersonalizationAsset) => void
  setPrimarySavedAsset: (role: 'identity' | 'logo', assetId: string) => void
  removeSavedAsset: (assetId: string) => void

  // Project restore (Phase 14)
  loadedProject: {
    id: string
    sourceDemoId: string
    personalizedPrompt: string
    clientId: string | null
    status: string
    updatedAt: string
  } | null
  restoring: boolean
  /**
   * The last saved project for this source, offered instead of restored: the
   * modal opens with an empty form and the user picks "Continue" to load it.
   */
  resumableProject: { label: string } | null
  resumeLastProject: () => Promise<void>
  dismissResumableProject: () => void

  // Guided Simple Mode + free Remotion preview
  viewMode: PersonalizationViewMode
  setViewMode: (mode: PersonalizationViewMode) => void
  /** Active tab of the Advanced Editing workspace. */
  advancedTab: AdvancedEditingTab
  setAdvancedTab: (tab: AdvancedEditingTab) => void
  /** The section (pill) shown inside each Advanced Editing tab. */
  advancedSections: AdvancedEditingSections
  setAdvancedSection: (tab: AdvancedEditingTab, section: string) => void

  // Full Body Recast (Advanced Editing). The job outlives the panel and the
  // modal, and resumes after a reload.
  recastJob: RecastJob | null
  startRecast: (input: Omit<StartRecastInput, 'ownerKey'>) => Promise<void>
  cancelRecast: () => void
  retryRecast: () => boolean
  dismissRecast: () => void
  /** The video shown before a recast was applied (for "Use original video"). */
  preRecastVideo: PreviewVideoRef | null
  restoreOriginalVideo: () => void
  applyPresenterVideo: (assetId: string) => void
  removePresenterVideo: (assetId: string) => void
  guidedStep: GuidedStep
  setGuidedStep: (step: GuidedStep) => void
  previewSettings: PersonalizationPreviewSettings
  previewVideo: PreviewVideoRef | null
  setPreviewVideo: (video: PreviewVideoRef | null) => void
  setPreviewLayout: (layout: PreviewLayoutId) => void
  updatePreviewLayer: (layerId: string, patch: Partial<PreviewLayer>) => void
  /** Locks/unlocks a layer: a locked layer is never moved by the editor, a reflow or the placement engine. */
  setPreviewLayerLocked: (layerId: string, locked: boolean) => void
  /** Regions of the footage the overlays must not cover (customer-marked subject areas). */
  setPreviewProtectedZones: (zones: ProtectedZone[]) => void
  /**
   * Applies placement-engine results. Locked layers are skipped; the layers are
   * marked `recommended` (not `manual`), so a later recommendation may move them again.
   * With `overrideManual`, hand-placed layers are replaced too (Restore Recommended Placement).
   */
  applyPreviewPlacements: (items: { layerId: string; x: number; y: number; scale?: number }[], options?: { overrideManual?: boolean }) => void
  updatePreviewBrandColors: (patch: Partial<PreviewBrandColors>) => void
   updatePreviewComposition: (patch: Partial<Pick<PersonalizationPreviewSettings, 'aspectRatio' | 'fps' | 'durationInFrames' | 'showEndCard'>>) => void
   resetPreviewLayout: () => void
   /**
    * Every registered Remotion design, in registration order. Empty when no
    * catalog is bundled.
    */
   remotionDesignTemplates: RemotionDesignTemplate[]
   /** Id of the design currently applied to the preview, or null. */
   activeRemotionDesignId: string | null
   /** Applies a design, or clears the applied design when given null. */
   setRemotionDesign: (designId: string | null) => void
  /** Adds a design on top of the current layout (every existing layer is kept), instead of replacing it. */
  addRemotionDesign: (designId: string) => void
  /** Takes one design layer off the video, leaving the other layers. */
  removePreviewDesignLayer: (layerId: string) => void
  /** Undo / redo of edits to the preview (layers, designs, layout). */
  undoPreview: () => void
  redoPreview: () => void
  canUndoPreview: boolean
  canRedoPreview: boolean
   /** Why the last `setRemotionDesign` call failed, or null. */
   remotionDesignError: string | null
   previewApproved: boolean
  /** The approval was cleared by a later change (approve again). */
  approvalStale?: boolean
   approvePersonalization: () => void
   /**
    * Creates the final video. `approveNow` is the customer pressing the create button in Advanced Editing, where the live
    * preview sits beside the controls and there is no separate approve step: that click approves what is on screen.
    */
   createFinalVideo: (options?: { approveNow?: boolean }) => Promise<void>
   cancelExport: () => void
   apiKey: string
   setPreviewAudio: (file: File) => Promise<void>
   removePreviewAudio: () => void
   previewAudioError: string | null
  /** Set when the prompt was filled in without the AI (the AI call failed). */
  promptNotice?: string | null
  /** Publish only works where a SocialPublishProvider is mounted. */
  canPublish?: boolean
  /** Why Publish is unavailable for this result ('' when it is available). */
  publishNote?: string
  /** Video Studio needs a stored video URL and a presenter photo. */
  canEditInVideoStudio?: boolean

   // Motion Studio recipe (the full library — 124 cards / 150 shots / 10
   // categories — is exposed by `src/data/motionRecipeCatalog.ts`; the
   // provider only holds the customer's currently-selected recipe and the
   // handoff back to the canonical `/studio/motion-studio` route).
   motionTemplate: import('@ohb/data/motionRecipeCatalog').MotionTemplate | null
   useMotionTemplate: (template: import('@ohb/data/motionRecipeCatalog').MotionTemplate) => void
   launchMotionTemplate: (template: import('@ohb/data/motionRecipeCatalog').MotionTemplate) => void
 }

const PersonalizationContext = createContext<DemoPersonalizeContextValue | null>(null)

export function useDemoPersonalize(): DemoPersonalizeContextValue {
  const ctx = useContext(PersonalizationContext)
  if (!ctx) throw new Error('useDemoPersonalize must be used within DemoPersonalizeProvider')
  return ctx
}

interface DemoPersonalizeProviderProps {
  children: ReactNode
  testMode?: boolean
  /**
   * Access mode for this mount. The public landing surface mounts the provider
   * with `access="anonymous"` (free discovery only); every existing entry point
   * omits it and keeps the full authenticated pipeline. The server remains the
   * authority on every request — this only selects which endpoint the client
   * calls and which UI the modal offers.
   */
  access?: PersonalizationAccessMode
  /**
   * Stable per-user identifier used to scope the localStorage preview mirror
   * so two visitors sharing a browser never see each other's in-progress
   * preview state. The orchestrator typically passes the Clerk user id; if
   * omitted, the provider falls back to the per-user MuAPI key (which is
   * already unique per user) and finally to the literal `'anonymous'`.
   */
  userScope?: string
}

/**
 * The `?demo=1` landing-page flag: lets a public entry point open the shared
 * modal in anonymous mode by URL alone, without prop wiring. It selects the
 * client-side endpoint/UI only; each endpoint still enforces its own rules.
 */
function detectAnonymousAccessFlag(): PersonalizationAccessMode | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1' ? 'anonymous' : null
  } catch {
    return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

  function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(',')
    const mimeMatch = header.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
    const binary =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(base64)
        : (() => {
            const buf = Buffer.from(base64, 'base64')
            let str = ''
            for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i])
            return str
          })()
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  } catch {
    return new Blob([''], { type: 'application/octet-stream' })
  }
}

function createAsset(file: File | Blob, role: PersonalizationAsset['role'], opts: Partial<PersonalizationAsset> = {}): PersonalizationAsset {
  const fileObj = file as File
  return {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    name: fileObj.name || 'discovered',
    url: URL.createObjectURL(file),
    isPrimary: false,
    mimeType: fileObj.type || '',
    createdAt: new Date().toISOString(),
    uploadStatus: 'local',
    uploadError: null,
    file: fileObj as File,
    ...opts,
  }
}

function createAssetFromUrl(url: string, role: PersonalizationAsset['role'], opts: Partial<PersonalizationAsset> = {}): PersonalizationAsset {
  return {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    name: url.split('/').pop() || url,
    url,
    uploadedUrl: url,
    isPrimary: false,
    mimeType: '',
    createdAt: new Date().toISOString(),
    uploadStatus: 'ready',
    uploadError: null,
    file: null,
    ...opts,
  }
}

function updateAssetInLibrary(library: AssetLibrary, asset: PersonalizationAsset): AssetLibrary {
  switch (asset.role) {
    case 'presenter_identity':
    case 'face_identity':
    case 'character_identity':
      return {
        ...library,
        identities: [...library.identities, asset],
        primaryIdentity: library.primaryIdentity || asset,
      }
    case 'logo':
      return {
        ...library,
        logos: [...library.logos, asset],
        primaryLogo: library.primaryLogo || asset,
      }
    case 'product_reference':
      return { ...library, products: [...library.products, asset] }
    case 'brand_reference':
      return { ...library, brandReferences: [...library.brandReferences, asset] }
    case 'first_frame':
      return { ...library, firstFrame: asset }
    case 'last_frame':
      return { ...library, lastFrame: asset }
    case 'cta_graphic':
      return { ...library, ctaGraphic: asset }
    case 'presenter_video':
      return { ...library, presenterVideos: [...(library.presenterVideos || []), asset] }
    default:
      return library
  }
}


function replaceAssetInLibrary(library: AssetLibrary, asset: PersonalizationAsset): AssetLibrary {
  switch (asset.role) {
    case 'presenter_identity':
    case 'face_identity':
    case 'character_identity':
      return {
        ...library,
        identities: library.identities.map((a) => (a.id === asset.id ? asset : a)),
        primaryIdentity: library.primaryIdentity?.id === asset.id ? asset : library.primaryIdentity,
      }
    case 'logo':
      return {
        ...library,
        logos: library.logos.map((a) => (a.id === asset.id ? asset : a)),
        primaryLogo: library.primaryLogo?.id === asset.id ? asset : library.primaryLogo,
      }
    case 'product_reference':
      return { ...library, products: library.products.map((a) => (a.id === asset.id ? asset : a)) }
    case 'brand_reference':
      return { ...library, brandReferences: library.brandReferences.map((a) => (a.id === asset.id ? asset : a)) }
    case 'first_frame':
      return { ...library, firstFrame: asset }
    case 'last_frame':
      return { ...library, lastFrame: asset }
    case 'cta_graphic':
      return { ...library, ctaGraphic: asset }
    default:
      return library
  }
}

// ── Business → client form mapping (the ONLY one) ────────────────────────────
//
// `selectBusiness()` is the existing mapping used by the lead-finder result
// cards. The automated "Find My Brand" workflow must populate exactly the same
// fields with exactly the same values, so the mapping lives here once and both
// paths call it — there is no second implementation to drift.

/** Maps a business record onto the client profile fields, as `selectBusiness` does. */
export function clientFormFromBusiness(business: BusinessDiscoveryRecord): Partial<ClientProfile> {
  return {
    businessName: business.name,
    industry: business.category,
    location: [business.city, business.region].filter(Boolean).join(', ') || undefined,
    phone: business.phone,
    // Only the business's OWN website: a Facebook/Instagram page or a
    // directory listing has none of its brand assets (older saved leads may
    // still carry one in `website`).
    website: isOwnedWebsite(business.website) ? business.website : undefined,
  }
}

/** Hostname without `www.`, used to name a business before research resolves a title. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Adds a scheme when the visitor pasted a bare `example.com`. */
export function normalizeWebsiteInput(value: string): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// ── Free (anonymous) discovery payload mapping ───────────────────────────────
//
// Structural subset of `POST /api/demo/discover`. Declared here instead of
// importing the server module so the client bundle never pulls the discovery
// pipeline (axios/cheerio/networkSafety) in, and so every field is validated
// the same defensive way the endpoint's own consumer expects.

interface DemoDiscoveryAssetPayload {
  kind?: unknown
  url?: unknown
  source?: unknown
}

interface DemoDiscoveryResponse {
  ok?: unknown
  cached?: unknown
  url?: unknown
  title?: unknown
  description?: unknown
  logo?: unknown
  assets?: unknown
  brandColors?: unknown
}

/**
 * `/api/demo/discover` asset kind → the shared `DiscoveredAssetCategory`.
 *
 * The free pipeline has no vision model, so the section an asset is OFFERED in
 * comes from the pipeline's own signal:
 *   logo   → Logo (the page's declared brand mark)
 *   product→ Products (a JSON-LD/og product shot)
 *   photo  → Person (the page's own photos are the only free signal for a
 *            presenter/person shot; the visitor reviews and can re-categorise
 *            or move it, exactly like a paid discovery result)
 *   brand  → Brand (card/microdata brand imagery)
 */
const DEMO_ASSET_KIND_TO_CATEGORY: Record<string, DiscoveredAssetCategory> = {
  logo: 'logo',
  product: 'product',
  photo: 'person',
  brand: 'brand',
}

/** The client-asset section each demo kind is offered in. */
const DEMO_ASSET_KIND_TO_SECTION: Record<string, AssignedSection> = {
  logo: 'logo',
  product: 'products',
  photo: 'person',
  brand: 'brand',
}

function demoAssetId(index: number): string {
  return `demo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Maps the free discovery payload onto the SAME `DiscoveredAsset` list the paid
 * pipeline produces, so the shared review UI, section assignment, re-category
 * and drag-and-drop behave identically in both modes.
 */
export function demoAssetsToDiscoveredAssets(payload: DemoDiscoveryResponse): DiscoveredAsset[] {
  const rawAssets = Array.isArray(payload.assets) ? payload.assets : []
  const mapped: DiscoveredAsset[] = []

  for (let index = 0; index < rawAssets.length; index += 1) {
    const raw = rawAssets[index] as DemoDiscoveryAssetPayload | null
    if (!raw || typeof raw !== 'object') continue
    const url = typeof raw.url === 'string' ? raw.url.trim() : ''
    if (!url) continue
    const kind = typeof raw.kind === 'string' ? raw.kind : ''
    const category = DEMO_ASSET_KIND_TO_CATEGORY[kind]
    if (!category) continue
    mapped.push({
      id: demoAssetId(index),
      sourceUrl: url,
      previewUrl: url,
      sourceType: 'WEBSITE',
      category,
      selected: true,
      recommended: true,
      rejected: false,
      assignedSection: DEMO_ASSET_KIND_TO_SECTION[kind] ?? null,
      autoAssigned: true,
    })
  }

  return mapped
}

/**
 * URL-only entry: the smallest business record the shared `selectBusiness`
 * mapping accepts. The hostname names the business until research resolves a
 * page title; every other field stays undefined rather than guessing.
 */
function businessRecordFromWebsite(website: string): BusinessDiscoveryRecord {
  return {
    id: `url:${website}`,
    source: 'OPENSTREETMAP',
    name: hostnameOf(website),
    category: '',
    website,
    websiteStatus: 'unknown',
    verificationStatus: 'verified',
  }
}

/**
 * Reuses the existing `BusinessResearchResult` shape (rendered by the Selected
 * Business Summary panel) so a free discovery result is displayed by the very
 * same research UI instead of a second results surface.
 */
function businessResearchFromDemoPayload(payload: DemoDiscoveryResponse): BusinessResearchResult {
  const website = typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : ''
  const logo = typeof payload.logo === 'string' && payload.logo.trim() ? payload.logo.trim() : ''
  const assets = Array.isArray(payload.assets) ? payload.assets : []
  return {
    canonicalUrl: website,
    finalUrl: website,
    reachable: assets.length > 0 || Boolean(logo),
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : undefined,
    description: typeof payload.description === 'string' && payload.description.trim() ? payload.description.trim() : undefined,
    logoUrl: logo || undefined,
    socialLinks: {},
    jsonLd: [],
    openGraph: {},
    twitterCard: {},
    contactInfo: { phones: [], emails: [], addresses: [] },
    ...brandColorsOf(payload.brandColors),
  }
}

function brandColorsOf(value: unknown): { brandColors?: { primary?: string; accent?: string } } {
  const brandColors = researchBrandColors(value)
  return brandColors ? { brandColors } : {}
}


/** Turns a shared research result into the business-record shape the mapping consumes. */
// ── Provider ─────────────────────────────────────────────────────────────────

export function DemoPersonalizeProvider({ children, testMode, access: accessProp, userScope: userScopeProp }: DemoPersonalizeProviderProps) {
  // Navigation & publish integration
  const router = useRouter()
  const socialPublish = useOptionalSocialPublish()
  const { apiKey, openaiKey } = useAuthConfig()
  // Modal
  const [isOpen, setIsOpen] = useState(false)
  const [source, setSource] = useState<PersonalizationSource | null>(null)
  const [sourceTypeLabel, setSourceTypeLabel] = useState<string | undefined>(undefined)
  // Which discovery backend this session may call. Seeded from the mount prop
  // (or the ?demo=1 landing flag) and re-set by the caller of openPersonalize;
  // never inferred here and never used to grant permission on its own (every
  // endpoint enforces its own rules, and the 401 path below is unchanged).
  const [access, setAccess] = useState<PersonalizationAccessMode>(
    () => accessProp || detectAnonymousAccessFlag() || 'authenticated',
  )
  const triggerRef = useRef<HTMLElement | null>(null)

  // ── Studio hand-off options (Phase 1) ─────────────────────────────────────
  //
  // The open call may carry extra context that only matters for the lifetime
  // of one modal session: which studio opened it, the brand assets to seed,
  // a completion callback and a return destination. They live in refs (not
  // state) because they are read from deep inside the generation callbacks
  // and must never trigger a re-render; they are cleared on close so a stale
  // callback can never fire on the next open.
  const originStudioRef = useRef<string | null>(null)
  const initialAssetsRef = useRef<AssetLibrary | null>(null)
  const onCompleteRef = useRef<((completion: PersonalizationCompletion) => void) | null>(null)
  const returnToRef = useRef<StudioTarget | null>(null)
  const returnPayloadRef = useRef<Record<string, unknown> | null>(null)
  /** Guards the completion callback so one open fires it at most once. */
  const onCompleteFiredRef = useRef(false)

  // Client
  const [clients, setClients] = useState<ClientProfile[]>(loadClients)
  const [selectedClientId, setSelectedClientId] = useState<string>(() => getCurrentClientId() || '')
  const [clientForm, setClientForm] = useState<Partial<ClientProfile>>({})
  // Values the business finder filled in. A field keeps its "from website" tag
  // only while it still holds that value, so editing it removes the tag.
  const autoFilledRef = useRef<AutoFilledValues>({})
  const [autoFilledContent, setAutoFilledContent] = useState<AutoFilledValues>({})
  // The URL-only path names the business after its hostname until research
  // finds the real name; that placeholder may be replaced.
  const placeholderNameRef = useRef('')
  // Set when a business is found, consumed once its discovery finishes.
  const autoImportPendingRef = useRef(false)
  // Bumped whenever another business is selected; discovery, research and
  // imports started for an earlier one check it and drop their results.
  const businessSessionRef = useRef(0)
  // Each discoverAssets call; a superseded call's results are dropped.
  const discoveryRequestRef = useRef(0)
  // Each findBusinesses call; a cleared or superseded search's results are dropped.
  const businessSearchRequestRef = useRef(0)
  // Set once removeAutoImportedAssets is declared (it is declared later).
  const removeAutoImportedAssetsRef = useRef<(() => void) | null>(null)
  // Discovered-asset ids that were placed automatically for this business.
  const autoImportedDiscoveredIdsRef = useRef<Set<string>>(new Set())
  const [businessLoadSummary, setBusinessLoadSummary] = useState<BusinessLoadSummary | null>(null)

  // Saved client assets (persisted per-client library)
  const [savedClientAssets, setSavedClientAssets] = useState<ClientAssetLibrary>(() =>
    loadClientAssets(getCurrentClientId() || ''),
  )
  const [savedAssetLibraryTab, setSavedAssetLibraryTab] = useState<'identities' | 'logos' | 'products' | 'brandReferences'>('identities')

  // Assets
  const [assets, setAssets] = useState<AssetLibrary>({ ...EMPTY_ASSET_LIBRARY })
  const assetsRef = useRef(assets)
  useEffect(() => { assetsRef.current = assets }, [assets])

  // The saved-client library is a second source of live blob references: an
  // entry copied into a client library keeps referencing its blob URL even
  // after the job-library copy is removed, so blob releases must consult both.
  const savedClientAssetsRef = useRef(savedClientAssets)
  useEffect(() => { savedClientAssetsRef.current = savedClientAssets }, [savedClientAssets])

  /** Blob URLs still referenced by any live entry (job + saved libraries). */
  const liveBlobUrlCounts = useCallback((): Map<string, number> => {
    const counts = countBlobUrlReferences(assetsRef.current)
    const savedCounts = countBlobUrlReferences(savedClientAssetsRef.current)
    for (const [url, count] of savedCounts) {
      counts.set(url, (counts.get(url) ?? 0) + count)
    }
    return counts
  }, [])

  /**
   * Live references while the JOB library is being discarded entirely
   * (source reset / modal close).  The job library is emptied by this change,
   * so its current references must not keep a blob alive — but saved-client
   * entries legitimately still render theirs.
   */
  const savedOnlyBlobUrlCounts = useCallback((): Map<string, number> =>
    countBlobUrlReferences(savedClientAssetsRef.current), [])

  // ── Object URL ownership ───────────────────────────────────────────────────
  // Blob URLs are created outside React's state flow, so ownership is tracked
  // in refs keyed by asset id and captured synchronously at creation, instead
  // of read back from `assetsRef` (which only syncs once React commits).  This
  // keeps a blob revocable when its upload resolves before that commit, and
  // `revokedBlobUrls` makes every release idempotent.
  const ownedJobBlobUrlsRef = useRef<Map<string, Set<string>>>(new Map())
  const ownedSavedBlobUrlsRef = useRef<Map<string, Set<string>>>(new Map())
  const revokedBlobUrlsRef = useRef<Set<string>>(new Set())

  /** Records the blob URL created for a job-library asset. */
  const registerOwnedBlobUrl = useCallback((assetId: string, url: string | null | undefined) => {
    if (!isBlobUrl(url)) return
    const owned = ownedJobBlobUrlsRef.current.get(assetId)
    if (owned) owned.add(url)
    else ownedJobBlobUrlsRef.current.set(assetId, new Set([url]))
  }, [])

  /** Records the blob URL created for a saved-client library asset. */
  const registerOwnedSavedBlobUrl = useCallback((assetId: string, url: string | null | undefined) => {
    if (!isBlobUrl(url)) return
    const owned = ownedSavedBlobUrlsRef.current.get(assetId)
    if (owned) owned.add(url)
    else ownedSavedBlobUrlsRef.current.set(assetId, new Set([url]))
  }, [])

  /** Creates a job asset and takes ownership of its blob URL immediately. */
  const createOwnedAsset = useCallback((
    file: File | Blob,
    role: PersonalizationAsset['role'],
    opts: Partial<PersonalizationAsset> = {},
  ): PersonalizationAsset => {
    const asset = createAsset(file, role, opts)
    registerOwnedBlobUrl(asset.id, asset.url)
    return asset
  }, [registerOwnedBlobUrl])

  const releaseJobBlobUrls = useCallback((
    assetId: string,
    asset: PersonalizationAsset | null | undefined,
    opts: { superseded?: (string | null | undefined)[]; dropOriginal?: boolean } = {},
  ) => releaseOwnedBlobUrls(
    ownedJobBlobUrlsRef.current,
    revokedBlobUrlsRef.current,
    assetId,
    liveBlobUrlCounts(),
    asset,
    findAssetInLibrary(assetsRef.current, assetId),
    opts,
  ), [liveBlobUrlCounts])

  const releaseSavedBlobUrls = useCallback((
    assetId: string,
    asset: PersonalizationAsset | null | undefined,
    opts: { superseded?: (string | null | undefined)[]; dropOriginal?: boolean } = {},
  ) => releaseOwnedBlobUrls(
    ownedSavedBlobUrlsRef.current,
    revokedBlobUrlsRef.current,
    assetId,
    liveBlobUrlCounts(),
    asset,
    findAssetInLibrary(assetsRef.current, assetId),
    opts,
  ), [liveBlobUrlCounts])

  /**
   * Releases every job blob URL that no live entry still references (used when
   * the library is reset/closed).  Blobs a saved-client entry points at stay
   * alive — those entries outlive the job library.
   */
  const releaseAllJobBlobUrls = useCallback(() => {
    releaseAllOwnedBlobUrls(
      ownedJobBlobUrlsRef.current,
      revokedBlobUrlsRef.current,
      savedOnlyBlobUrlCounts(),
    )
  }, [savedOnlyBlobUrlCounts])

  /** Releases every blob URL the provider still owns (job + saved client). */
  const releaseAllBlobUrls = useCallback(() => {
    releaseAllOwnedBlobUrls(ownedJobBlobUrlsRef.current, revokedBlobUrlsRef.current, new Map())
    releaseAllOwnedBlobUrls(ownedSavedBlobUrlsRef.current, revokedBlobUrlsRef.current, new Map())
  }, [])

  // Discovered assets (temporary review state — NOT part of permanent AssetLibrary)
  const [discoveredAssets, setDiscoveredAssetsState] = useState<DiscoveredAsset[]>([])
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'discovering' | 'reviewing' | 'importing'>('idle')
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [importConfirmation, setImportConfirmation] = useState<{ count: number; failedCount?: number; clientName?: string } | null>(null)
  const autoCutout = useAutoCutout(discoveredAssets, setDiscoveredAssetsState, { paused: discoveryStatus === 'importing', disabled: access === 'anonymous' })
  // Warm the model up while the modal is open (never without consent, with auto mode off, or where unsupported).
  useEffect(() => {
    if (!isOpen || !autoCutout.willAutoCutOut) return undefined
    void prefetchBackgroundRemovalModel()
    return () => cancelBackgroundRemovalPrefetch()
  }, [isOpen, autoCutout.willAutoCutOut])
  const [visionStatus, setVisionStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle')
  const [visionError, setVisionError] = useState<string | null>(null)

  useEffect(() => {
    if (!importConfirmation) return
    const timer = setTimeout(() => setImportConfirmation(null), 5000)
    return () => clearTimeout(timer)
  }, [importConfirmation])

  // Business search state
  const [businessSearchMode, setBusinessSearchMode] = useState<'idle' | 'searching' | 'results' | 'selected' | 'error'>('idle')
  const [businessSearchResults, setBusinessSearchResults] = useState<BusinessDiscoveryRecord[]>([])
  const [businessSearchError, setBusinessSearchError] = useState<string | null>(null)
  const [businessSearchQuery, setBusinessSearchQuery] = useState<{ niche: string; location: string; radiusMiles: number } | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessDiscoveryRecord | null>(null)
  const [websiteLookup, setWebsiteLookup] = useState<WebsiteLookupState>({ status: 'idle' })
  // The business the latest lookup belongs to, so a slow answer for a
  // previously selected business never lands on the current one.
  const websiteLookupBusinessRef = useRef<string | null>(null)
  // The business whose website lookup has already finished (found or not).
  const websiteLookupSettledRef = useRef<string | null>(null)
  const [businessResearch, setBusinessResearch] = useState<{
    status: 'idle' | 'researching' | 'done' | 'error'
    result?: BusinessResearchResult
    error?: string
  }>({ status: 'idle' })

  // Prompt
  const [promptState, setPromptState] = useState<PromptState>({ ...EMPTY_PROMPT_STATE })

  // Output / mode / options
  const [outputType, setOutputType] = useState<OutputType>('prompt')
  const [mode, setMode] = useState<VideoPersonalizationMode | ImagePersonalizationMode | null>(null)
  // The customer opened "Generate with AI" but has not picked a mode yet.
  const [aiChosen, setAiChosen] = useState(false)
  const [genOptions, setGenOptions] = useState<GenerationOptions>({ ...EMPTY_GENERATION_OPTIONS })
  // Read when a recast is applied ("Keep the original video's sound").
  const preserveAudioRef = useRef(true)
  preserveAudioRef.current = genOptions.preserveAudio !== false
  const [consent, setConsent] = useState(false)

  // Generation
  const [generation, setGeneration] = useState<GenerationState>({ ...EMPTY_GENERATION_STATE })

  // Result
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [resultTab, setResultTab] = useState<'prompt' | 'images' | 'videos'>('prompt')

  // Shared media
  const [sharedMediaEntries, setSharedMediaEntries] = useState<SharedMediaEntry[]>(getSharedMedia)

  // Eligibility
  const [eligibility, setEligibility] = useState<PersonalizationEligibility>({
    enabled: false,
    outputs: ['prompt'],
    videoModes: [],
    imageModes: [],
    recommendedMode: undefined,
  })

  // Project restore (Phase 14)
  const [loadedProject, setLoadedProject] = useState<{
    id: string
    sourceDemoId: string
    personalizedPrompt: string
    clientId: string | null
    status: string
    updatedAt: string
  } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [resumableProject, setResumableProject] = useState<{ label: string } | null>(null)
  // While true the modal shows a fresh form and autosave holds off, so an empty
  // session never replaces the saved project the user may still resume.
  const freshStartRef = useRef(false)
  /** An explicit edit ends the fresh start, so it is saved like any other work. */
  const markSessionStarted = useCallback(() => {
    if (!freshStartRef.current) return
    freshStartRef.current = false
    setResumableProject(null)
  }, [])
  /** Mirror of the restored project's id, readable from the run callbacks. */
  const loadedProjectIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    loadedProjectIdRef.current = loadedProject?.id
  }, [loadedProject])

  // Guided Simple Mode + free Remotion preview
  const [viewMode, setViewMode] = useState<PersonalizationViewMode>('simple')
  const [advancedTab, setAdvancedTab] = useState<AdvancedEditingTab>('client')
  const [advancedSections, setAdvancedSections] = useState<AdvancedEditingSections>(DEFAULT_ADVANCED_SECTIONS)
  const setAdvancedSection = useCallback((tab: AdvancedEditingTab, section: string) => {
    setAdvancedSections((prev) => (prev[tab] === section ? prev : { ...prev, [tab]: section }))
  }, [])
  const [guidedStep, setGuidedStepState] = useState<GuidedStep>(1)
  const [previewSettings, setPreviewSettings] = useState<PersonalizationPreviewSettings>(() =>
    createDefaultPreviewSettings(),
  )
  const [previewVideo, setPreviewVideo] = useState<PreviewVideoRef | null>(null)

  // ── Full Body Recast (Advanced Editing tab) ────────────────────────────────
  // The video shown before a recast was applied, so "Use original video" can
  // undo it. It travels on the recast preview itself, so it is saved and
  // restored with the project it belongs to.
  const preRecastVideo = previewVideo?.kind === 'recast' ? previewVideo.beforeRecast ?? null : null
  const previewVideoRef = useRef<PreviewVideoRef | null>(null)
  previewVideoRef.current = previewVideo
  const recastMarkAppliedRef = useRef<() => void>(() => {})

  /**
   * The preview (and the branded render built from it) runs as long as the
   * video now shown, so a longer recast is not cut to the old length. Uses the
   * clip's real length when it can be read, else `fallbackSeconds`. Skipped if
   * another video has been chosen in the meantime.
   */
  const sourceMediaRef = useRef<string | null>(null)
  sourceMediaRef.current = source?.sourceMedia || null
  // The demo's own video as an explicit undo target. Creating a final video
  // later rewrites `source.sourceMedia`, so undo must not rely on it.
  const sourceVideoRef = useRef<PreviewVideoRef | null>(null)
  sourceVideoRef.current = source?.sourceMedia
    ? { url: source.sourceMedia, poster: source.poster ?? null, title: source.title || 'Original video', kind: 'source' }
    : null
  const fitPreviewLengthToVideo = useCallback(async (url: string | null | undefined, fallbackSeconds?: number) => {
    if (!url) return
    const clip = await readClipMetadata(url).catch(() => null)
    const seconds = clip && clip.durationSeconds > 0 ? clip.durationSeconds : fallbackSeconds
    if (!seconds || !(seconds > 0)) return
    // With no video chosen, the preview shows the demo's own video.
    if ((previewVideoRef.current?.url || sourceMediaRef.current || null) !== url) return
    setPreviewSettings((prev) => {
      const durationInFrames = Math.max(1, Math.round(seconds * (prev.fps || 30)))
      return prev.durationInFrames === durationInFrames ? prev : { ...prev, durationInFrames }
    })
  }, [])

  /** A finished recast becomes the video and is saved with the client's assets. */
  const handleRecastDone = useCallback((job: RecastJob) => {
    setPreviewVideo({
      url: job.resultUrl,
      poster: null,
      title: `Full Body Recast — ${job.identityName || 'Presenter'}`,
      kind: 'recast',
      beforeRecast: videoBeforeRecast(previewVideoRef.current) ?? sourceVideoRef.current,
      // The recast is silent; keep the performance clip's sound under it.
      audioUrl: preserveAudioRef.current && job.sourceUrl ? job.sourceUrl : null,
    })
    previewVideoRef.current = { url: job.resultUrl, poster: null, title: '', kind: 'recast' }
    void fitPreviewLengthToVideo(job.resultUrl, job.duration)
    setAssets((prev) => {
      if ((prev.presenterVideos || []).some((asset) => asset.url === job.resultUrl)) return prev
      return updateAssetInLibrary(prev, createAssetFromUrl(job.resultUrl, 'presenter_video', {
        name: `${job.identityName || 'Presenter'} — Full Body Recast`,
        mimeType: 'video/mp4',
        editMetadata: { operation: 'full_body_recast', model: RECAST_MODEL, prompt: job.prompt, sourceUrl: job.sourceUrl },
      }))
    })
    try {
      registerSharedMedia({
        originStudio: 'demo-personalization',
        sourceType: source?.sourceType || 'unknown',
        sourceDemoId: source?.id,
        sourceMedia: job.sourceUrl,
        personalizationMode: 'full_body',
        model: RECAST_MODEL,
        originalPrompt: job.prompt,
        personalizedPrompt: job.prompt,
        identityAssetIds: job.identityId ? [job.identityId] : [],
        outputUrls: [job.resultUrl],
        outputType: 'video',
      })
      setSharedMediaEntries(getSharedMedia())
    } catch {
      // History is best effort.
    }
    if (access === 'authenticated') {
      void registerGeneratedVideo({
        source_type: source?.sourceType || null,
        source_url: job.sourceUrl,
        personalization_mode: 'full_body',
        model: RECAST_MODEL,
        prompt: job.prompt,
        selected_asset_ids: job.identityId ? [job.identityId] : [],
        provider_job_id: job.requestId || null,
        video_url: job.resultUrl,
        duration_seconds: job.duration,
        metadata: { feature: 'advanced_full_body_recast' },
      })
    }
    recastMarkAppliedRef.current()
  }, [source, access, fitPreviewLengthToVideo])

  // Recast jobs and saved recast videos belong to the signed-in user (same
  // scope as the preview store), never to whoever used this browser before.
  const recastOwner = recastOwnerKey(userScopeProp || apiKey || 'anonymous')
  const recast = useRecastJob({ apiKey, sourceId: source?.id, ownerKey: recastOwner, onDone: handleRecastDone })
  const startRecast = useCallback(
    (input: Omit<StartRecastInput, 'ownerKey'>) => recast.start({ ...input, ownerKey: recastOwner }),
    [recast.start, recastOwner],
  )
  recastMarkAppliedRef.current = recast.markApplied

  /** Undo: go back to the video shown before the recast was applied. */
  const restoreOriginalVideo = useCallback(() => {
    setPreviewVideo(preRecastVideo)
    // The preview runs as long as the original video again.
    previewVideoRef.current = preRecastVideo
    void fitPreviewLengthToVideo(preRecastVideo?.url || source?.sourceMedia)
  }, [preRecastVideo, source?.sourceMedia, fitPreviewLengthToVideo])

  /** Re-apply a saved recast video from the client's assets. */
  const applyPresenterVideo = useCallback((assetId: string) => {
    const asset = (assets.presenterVideos || []).find((candidate) => candidate.id === assetId)
    if (!asset) return
    setPreviewVideo({
      url: asset.url,
      poster: null,
      title: asset.name,
      kind: 'recast',
      beforeRecast: videoBeforeRecast(previewVideoRef.current) ?? sourceVideoRef.current,
      audioUrl: preserveAudioRef.current && asset.editMetadata?.sourceUrl ? asset.editMetadata.sourceUrl : null,
    })
    previewVideoRef.current = { url: asset.url, poster: null, title: asset.name, kind: 'recast' }
    void fitPreviewLengthToVideo(asset.url)
  }, [assets.presenterVideos, fitPreviewLengthToVideo])

  const removePresenterVideo = useCallback((assetId: string) => {
    const removed = (assets.presenterVideos || []).find((asset) => asset.id === assetId)
    setAssets((prev) => ({
      ...prev,
      presenterVideos: (prev.presenterVideos || []).filter((asset) => asset.id !== assetId),
    }))
    // Removing the video in use goes back to the video from before the recast.
    if (removed && previewVideoRef.current?.kind === 'recast' && previewVideoRef.current.url === removed.url) {
      setPreviewVideo(preRecastVideo)
      previewVideoRef.current = preRecastVideo
      void fitPreviewLengthToVideo(preRecastVideo?.url || source?.sourceMedia)
    }
  }, [assets.presenterVideos, preRecastVideo, source?.sourceMedia, fitPreviewLengthToVideo])
  const [previewApproved, setPreviewApproved] = useState(false)
  /** True when an approval was cleared because something changed after it. */
  const [approvalStale, setApprovalStale] = useState(false)
  /** Shown under the prompt when it was filled in without the AI. */
  const [promptNotice, setPromptNotice] = useState<string | null>(null)
  const [previewAudioError, setPreviewAudioError] = useState<string | null>(null)
  // ── Remotion design registry ───────────────────────────────────────────────
  // The design catalog registers itself on import, so the list of designs can
  // grow after the first render. The registry is observable, hence the
  // subscription.
  const [remotionDesignError, setRemotionDesignError] = useState<string | null>(null)
  /** The design id the last failed `setRemotionDesign` call referred to. */
  const remotionDesignErrorIdRef = useRef<string | null>(null)
  // Motion Studio recipe selected in Step 2. The full catalog (150 shots,
  // 124 cards, 10 categories) lives in `@/data/motionRecipeCatalog`; this
  // state holds the customer's single picked recipe.
  const [motionTemplate, setMotionTemplate] = useState<MotionTemplate | null>(null)
  // Set when the preview hands off to the existing generate() path after the
  // source has been patched with the selected preview video.
  // Set by createFinalVideo while the swapped-in source commits; the effect
  // below then runs the generation with these settings.
  const pendingFinalGenerateRef = useRef<GenerateOverrides | null>(null)
  // Whether the last run was a final video (createFinalVideo) or a plain
  // generate(); Retry and Generate Again repeat the same kind.
  const lastRunWasFinalVideoRef = useRef(false)
  /** Object URL of the last layered video, revoked when a newer one replaces it. */
  const lastLayeredVideoUrlRef = useRef<string | null>(null)
  const createFinalVideoRef = useRef<((options?: { approveNow?: boolean }) => Promise<void>) | null>(null)

  // Guards async uploads against writing state (and revoking blobs) after the
  // provider has unmounted, which would double-revoke blobs released on unmount.
  const mountedRef = useRef(true)

  // Refs for studio handoff persistence
  const lastResultRef = useRef<GenerationResult | null>(null)
  const lastProjectRef = useRef<{
    source: PersonalizationSource
    client: Partial<ClientProfile>
    assets: AssetLibrary
    mode: VideoPersonalizationMode | ImagePersonalizationMode | null
    personalizedPrompt?: string
  } | null>(null)

  // Stable per-user scope for the localStorage preview mirror. The prop wins
  // (orchestrators pass the Clerk user id); the per-user MuAPI key is a safe
  // fallback because each user has their own; the literal `'anonymous'`
  // keeps unauthenticated mounts from cross-contaminating the mirror.
  const previewUserScope = userScopeProp || apiKey || 'anonymous'

  // The catalog registers itself on import, which can happen after this
  // provider mounted. The registered list therefore lives in STATE and is
  // re-derived from the registry whenever the registry announces a change.
  const [remotionDesignTemplates, setRemotionDesignTemplates] = useState<
    RemotionDesignTemplate[]
  >(() => listRemotionDesignTemplates())

  useEffect(
    () =>
      subscribeRemotionDesignRegistry(() =>
        setRemotionDesignTemplates(listRemotionDesignTemplates()),
      ),
    [],
  )

  // A design refused because its catalog had not registered yet becomes
  // usable once the catalog lands; drop the stale error then.
  useEffect(() => {
    const failedId = remotionDesignErrorIdRef.current
    if (!failedId) return
    if (!getRemotionDesignTemplate(failedId)) return
    remotionDesignErrorIdRef.current = null
    setRemotionDesignError(null)
  }, [remotionDesignTemplates])
  // Debounced Supabase project persistence
  const projectPersistence = useRef(createProjectPersistence({ debounceMs: 1500 }))
  // Bumped by every restore and by closing the modal. A restore response that
  // arrives after the session moved on (another source opened, or the modal
  // closed) is discarded, so a late source-A response can never apply A's data
  // to source B or point B's autosaves at A's row.
  const restoreSessionRef = useRef(0)

  // ── Derived ────────────────────────────────────────────────────────────────

  const _currentClient = clients.find((c) => c.id === selectedClientId) || null

  // Seed context for the free preview layout presets: the client form and asset
  // library the visitor already filled in, so the preview matches the run
  // without any extra network call. URLs stay `undefined` (not null) so the
  // context stays assignable to the layout-preset context.
  const previewSeed = useMemo(() => ({
    businessName: clientForm.businessName || clientForm.name || '',
    headline: clientForm.businessName ? `${clientForm.businessName}` : '',
    tagline: clientForm.brandDescription || '',
    offer: clientForm.offer || '',
    cta: clientForm.callToAction || (clientForm.website ? `Visit ${clientForm.website}` : ''),
    phone: clientForm.phone || '',
    website: clientForm.website || '',
    logoUrl: assets.primaryLogo?.uploadedUrl || assets.primaryLogo?.url || undefined,
    productUrl: assets.products[0]?.uploadedUrl || assets.products[0]?.url || undefined,
    serviceUrl:
      assets.products[1]?.uploadedUrl ||
      assets.products[1]?.url ||
      assets.products[0]?.uploadedUrl ||
      assets.products[0]?.url ||
      undefined,
  }), [
    clientForm.businessName,
    clientForm.name,
    clientForm.brandDescription,
    clientForm.offer,
    clientForm.callToAction,
    clientForm.phone,
    clientForm.website,
    assets.primaryLogo,
    assets.products,
  ])

  // Ref mirror so preview actions always see the freshest seed without
  // re-creating the callbacks on every form keystroke.
  const previewSeedRef = useRef(previewSeed)
  useEffect(() => {
    previewSeedRef.current = previewSeed
  }, [previewSeed])

  // Ends the current business session: a Find My Brand run, research or
  // auto-import still in flight belongs to the project being closed or
  // replaced, so its late results are dropped instead of filling the next one.
  const endBusinessSession = useCallback(() => {
    businessSessionRef.current += 1
    autoImportPendingRef.current = false
    autoImportedDiscoveredIdsRef.current = new Set()
    setDiscoveredAssetsState([])
    setDiscoveryStatus('idle')
    setDiscoveryError(null)
    setVisionStatus('idle')
    setVisionError(null)
    setBusinessResearch({ status: 'idle' })
    // The next project starts with an empty business search; a search dropped
    // by the guard above must not leave the form busy either.
    businessSearchRequestRef.current += 1
    setSelectedBusiness(null)
    setBusinessSearchResults([])
    setBusinessSearchQuery(null)
    setBusinessSearchError(null)
    setBusinessLoadSummary(null)
    setBusinessSearchMode('idle')
  }, [])

  // ── Reset on source change ─────────────────────────────────────────────────

  // Tracks the id the reset last ran for. `createFinalVideo` patches the
  // source object in place (same id, new media) to hand the selected video to
  // the generation workflow — that is NOT a source change and must not wipe the
  // in-progress project, so the reset only runs when the id actually changes.
  const resetSourceIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!source) return
    const nextId = source.id ?? null
    if (resetSourceIdRef.current === nextId) return
    resetSourceIdRef.current = nextId
    endBusinessSession()
    // Revoke any outstanding blob URLs before resetting state. A studio that
    // seeded its own brand assets gets them back instead of an empty library;
    // every other caller still starts from the empty library.
    const seededAssets = initialAssetsRef.current
    setAssets((prev) => {
      releaseAllJobBlobUrls()
      return seededAssets
        ? { ...EMPTY_ASSET_LIBRARY, ...seededAssets }
        : { ...EMPTY_ASSET_LIBRARY }
    })
    setPromptState({
      original: source.originalPrompt || source.fullPrompt || source.shortPrompt || '',
      personalized: '',
      edited: '',
    })
    setOutputType('prompt')
    setMode(null)
    setGenOptions({ ...EMPTY_GENERATION_OPTIONS })
    setConsent(false)
    setGeneration({ ...EMPTY_GENERATION_STATE })
    setResult(null)
    setResultTab('prompt')
    setClientForm({})
    setEligibility(getEligibility(source))
    // Guided Simple Mode + preview reset happens here, BEFORE the restore
    // effect (below) hydrates anything durable, so a saved project always wins.
    // The view mode is intentionally NOT reset: an explicit Advanced Editing
    // choice is a session preference and survives opening another source.
    setGuidedStepState(1)
    setPreviewSettings(sourcePreviewDefaults(source))
    setPreviewVideo(null)
    setPreviewApproved(false)
    setApprovalStale(false)
  }, [source?.id, source, endBusinessSession])

  // A Full Body Recast that finished while the modal was closed (or before a
  // reload) is applied once its source is open again. Declared after the reset
  // effect above so the reset cannot wipe it.
  useEffect(() => {
    const job = recast.job
    if (!source?.id || !job || job.sourceId !== source.id) return
    if (job.status === 'done' && !job.applied) handleRecastDone(job)
  }, [source?.id, recast.job, handleRecastDone])

  // Finished recasts are kept per user and demo, and come back when the demo
  // is reopened (they were only in memory before). Loaded after the reset
  // effect above, then saved whenever the list changes.
  const recastVideosLoadedForRef = useRef<string | null>(null)
  // What storage holds now, so only a real change is written.
  const recastVideosSavedRef = useRef('[]')
  const recastVideosOwnerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!source?.id) {
      recastVideosLoadedForRef.current = null
      return
    }
    const key = `${recastOwner}:${source.id}`
    if (recastVideosLoadedForRef.current === key) return
    recastVideosLoadedForRef.current = key
    // Another account signed in: the previous account's recasts leave the
    // library, so they are never saved under the new account.
    const ownerChanged = recastVideosOwnerRef.current !== null && recastVideosOwnerRef.current !== recastOwner
    recastVideosOwnerRef.current = recastOwner
    if (ownerChanged) {
      // The previous account's recast must not stay on screen (or be used to
      // generate, or be saved) for the new account.
      setPreviewVideo((prev) => (prev?.kind === 'recast' ? null : prev))
      setAssets((prev) => ({
        ...prev,
        presenterVideos: (prev.presenterVideos || []).filter((asset) => asset.editMetadata?.operation !== 'full_body_recast'),
      }))
    }
    const saved = loadRecastVideos(source.id, recastOwner)
    recastVideosSavedRef.current = JSON.stringify(saved)
    if (!saved.length) return
    setAssets((prev) => {
      const have = new Set((prev.presenterVideos || []).map((asset) => asset.url))
      let next = prev
      for (const video of saved) {
        if (have.has(video.url)) continue
        next = updateAssetInLibrary(next, createAssetFromUrl(video.url, 'presenter_video', {
          name: video.name,
          mimeType: 'video/mp4',
          editMetadata: { operation: 'full_body_recast', model: RECAST_MODEL, ...(video.sourceUrl ? { sourceUrl: video.sourceUrl } : {}) },
        }))
      }
      return next
    })
  }, [source?.id, recastOwner])
  useEffect(() => {
    if (!source?.id || recastVideosLoadedForRef.current !== `${recastOwner}:${source.id}`) return
    const videos = (assets.presenterVideos || [])
      .filter((asset) => asset.editMetadata?.operation === 'full_body_recast' && /^https?:\/\//.test(asset.url))
      .map((asset) => ({
        id: asset.id,
        url: asset.url,
        name: asset.name || 'Full Body Recast',
        // Kept so a saved recast still gets its performance clip's sound.
        ...(asset.editMetadata?.sourceUrl && /^https?:\/\//.test(asset.editMetadata.sourceUrl) ? { sourceUrl: asset.editMetadata.sourceUrl } : {}),
      }))
    const serialized = JSON.stringify(videos)
    if (serialized === recastVideosSavedRef.current) return
    recastVideosSavedRef.current = serialized
    saveRecastVideos(source.id, recastOwner, videos)
  }, [assets.presenterVideos, source?.id, recastOwner])

  // Persist the job's reusable assets to the selected client's saved library.
  //
  // remix-new-editor: only what CHANGED in the job is written, and only for the
  // client it changed under.
  //  - `assets` starts empty on load and is reset when a new source opens while
  //    the selected client is kept, so writing the whole job would wipe (or,
  //    merged, rewrite) the client's library: changes are merged INTO it.
  //  - Picking another saved client leaves the job's assets as they are; that
  //    alone must never copy client A's assets (and primaries) into client B.
  //    A client switch therefore only re-baselines; nothing is written.
  // Saved entries are only dropped by the explicit actions (removeSavedAsset,
  // deleteSavedClient).
  const lastPersistedRef = useRef<{ clientId: string; assets: ClientAssetLibrary } | null>(null)
  useEffect(() => {
    if (!selectedClientId) {
      lastPersistedRef.current = null
      return
    }
    const current: ClientAssetLibrary = {
      identities: assets.identities,
      primaryIdentity: assets.primaryIdentity,
      logos: assets.logos,
      primaryLogo: assets.primaryLogo,
      products: assets.products,
      brandReferences: assets.brandReferences,
    }
    const last = lastPersistedRef.current
    lastPersistedRef.current = { clientId: selectedClientId, assets: current }
    if (!last || last.clientId !== selectedClientId) return

    const changed = (now: PersonalizationAsset[], before: PersonalizationAsset[]) => {
      const seen = new Set(before)
      return now.filter((asset) => !seen.has(asset))
    }
    const delta: ClientAssetLibrary = {
      identities: changed(current.identities, last.assets.identities),
      primaryIdentity: current.primaryIdentity !== last.assets.primaryIdentity ? current.primaryIdentity : null,
      logos: changed(current.logos, last.assets.logos),
      primaryLogo: current.primaryLogo !== last.assets.primaryLogo ? current.primaryLogo : null,
      products: changed(current.products, last.assets.products),
      brandReferences: changed(current.brandReferences, last.assets.brandReferences),
    }
    const nothing =
      !delta.identities.length && !delta.logos.length && !delta.products.length && !delta.brandReferences.length &&
      !delta.primaryIdentity && !delta.primaryLogo
    if (nothing) return
    const library = mergeIntoClientLibrary(loadClientAssets(selectedClientId), delta)
    saveClientAssets(selectedClientId, library)
    setSavedClientAssets(library)
  }, [
    assets.identities,
    assets.primaryIdentity,
    assets.logos,
    assets.primaryLogo,
    assets.products,
    assets.brandReferences,
    selectedClientId,
  ])

  // Orphan reap: once the saved library has committed (its ref is fresh),
  // release owned blobs that JUST lost their last live reference — e.g. a
  // mirror that replaced a saved entry's URL, or a saved entry removed while
  // its job copy was already gone. Runs outside any state updater and is a
  // no-op whenever everything owned is still referenced.
  useEffect(() => {
    releaseAllOwnedBlobUrls(ownedJobBlobUrlsRef.current, revokedBlobUrlsRef.current, liveBlobUrlCounts())
    releaseAllOwnedBlobUrls(ownedSavedBlobUrlsRef.current, revokedBlobUrlsRef.current, liveBlobUrlCounts())
  }, [savedClientAssets, liveBlobUrlCounts])

  // Single builder for the persisted project payload, shared by the debounced
  // persist effect below and by the immediate flush on approval so they can
  // never drift. The payload is purely additive over the previous fields.
  const buildProjectPayload = useCallback((): PersonalizationProjectState => ({
    // Which surface opened the modal. A studio hand-off records its own slug;
    // every other caller keeps the historical demo literal.
    originStudio: originStudioRef.current || 'demo-personalization',
    sourceType: source!.sourceType,
    sourceDemoId: source!.id,
    sourceDemoSlug: (source as { slug?: string }).slug ?? null,
    sourceMedia: source!.sourceMedia,
    sourceUrl: source!.sourceUrl ?? null,
    personalizationMode: mode || null,
    model: source!.model || genOptions.model || null,
    originalPrompt: promptState.original,
    personalizedPrompt: promptState.personalized || promptState.edited,
    identityAssetIds: assets.identities.map((i) => i.id),
    logoAssetIds: assets.logos.map((l) => l.id),
    productAssetIds: assets.products.map((p) => p.id),
    brandReferenceAssetIds: assets.brandReferences.map((b) => b.id),
    firstFrameAssetId: assets.firstFrame?.id || null,
    lastFrameAssetId: assets.lastFrame?.id || null,
    // The id lists alone cannot be restored; persist each asset's durable URL
    // next to its id (blob:/data: URLs are dropped by `durableAssetUrls`).
    assetUrls: durableAssetUrls(
      Object.fromEntries(
        [
          ...assets.identities,
          ...assets.logos,
          ...assets.products,
          ...assets.brandReferences,
          ...(assets.firstFrame ? [assets.firstFrame] : []),
          ...(assets.lastFrame ? [assets.lastFrame] : []),
        ].map((a) => [a.id, a.uploadedUrl || a.url]),
      ),
    ),
    // A layered video plays from a browser-only blob: URL; the project keeps
    // the stored copy (the blob would be stripped before saving).
    outputUrls: result?.urls || (projectOutputUrl(result) ? [projectOutputUrl(result)] : []),
    outputType,
    clientId: selectedClientId || null,
    status: generation.status === 'complete' ? 'complete' : 'draft',
    ctaHeadline: clientForm.ctaHeadline || null,
    callToAction: clientForm.callToAction || null,
    generationSettings: {
      engine: genOptions.engine,
      preserveAudio: genOptions.preserveAudio,
      exactLogoHandling: genOptions.exactLogoHandling,
      exactCtaHandling: genOptions.exactCtaHandling,
      firstFrameMode: genOptions.firstFrameMode,
      lastFrameMode: genOptions.lastFrameMode,
      advancedModel: genOptions.advancedModel || null,
      aspectRatio: genOptions.aspectRatio || null,
      duration: genOptions.duration || null,
      resolution: genOptions.resolution || null,
      quality: genOptions.quality || null,
      consentGiven: genOptions.consentGiven,
    },
    aiAssistState: {},
    previewSettings,
    previewVideo: previewVideo && previewVideo.url && !previewVideo.url.startsWith('blob:') ? previewVideo : null,
    guidedStep,
    viewMode,
    ...((result?.metadata as Record<string, unknown> | undefined)?.layersMissing === true ? { layersMissing: true } : {}),
  }), [
    source,
    mode,
    promptState.original,
    promptState.personalized,
    promptState.edited,
    assets,
    outputType,
    selectedClientId,
    generation.status,
    result?.url,
    result?.urls,
    result?.metadata,
    clientForm.ctaHeadline,
    clientForm.callToAction,
    genOptions,
    previewSettings,
    previewVideo,
    guidedStep,
    viewMode,
  ])

  // Debounced Supabase project persistence. Exactly ONE effect may schedule
  // this write: `persist` coalesces calls inside the debounce window, so a
  // second identical effect never added a request, but it doubled the payload
  // build + scheduling on every commit and hid which effect owns the write.
  // `DemoPersonalizePersistence.test.tsx` pins one `persist` per commit.
  useEffect(() => {
    // Anonymous sessions persist nothing: the free discovery run writes no
    // project row, no identity and no saved asset.
    if (!source || access !== 'authenticated') return
    // A fresh session saves nothing until the user starts on something, so
    // opening the modal never replaces the project they may want to resume.
    if (freshStartRef.current) {
      // Saved recasts are a reusable library loaded automatically on open,
      // not something the user started here (applying one sets previewVideo).
      const { presenterVideos: _savedRecasts, ...ownAssets } = assets
      const hasAssets = Object.values(ownAssets).some((v) => (Array.isArray(v) ? v.length > 0 : v != null))
      const started =
        Boolean(clientForm.businessName || clientForm.website || clientForm.ctaHeadline || clientForm.callToAction || promptState.personalized || promptState.edited) ||
        hasAssets ||
        Boolean(previewVideo) ||
        Boolean(result?.url || result?.urls?.length)
      if (!started) return
      freshStartRef.current = false
      setResumableProject(null)
    }
    projectPersistence.current.persist(buildProjectPayload())
  }, [
    source?.id,
    source,
    mode,
    promptState.original,
    promptState.personalized,
    promptState.edited,
    assets,
    outputType,
    selectedClientId,
    generation.status,
    result?.url,
    result?.urls,
    clientForm.businessName,
    clientForm.website,
    clientForm.ctaHeadline,
    clientForm.callToAction,
    genOptions,
    previewSettings,
    previewVideo,
    guidedStep,
    viewMode,
    access,
    buildProjectPayload,
  ])

  // Local mirror of the guided/preview state, so save/restore works in the
  // browser even when Supabase has no row for this source (same rule as the
  // project persistence above: anonymous sessions write nothing).
  useEffect(() => {
    if (!source?.id || access !== 'authenticated') return
    // Keep the saved preview intact while "Continue" is still on offer.
    if (freshStartRef.current) return
    const timer = setTimeout(() => {
      if (freshStartRef.current) return
      writePreviewStorage(source.id, previewUserScope, {
        previewSettings,
        previewVideo: previewVideo && previewVideo.url && !previewVideo.url.startsWith('blob:') ? previewVideo : null,
        guidedStep,
        viewMode,
        advancedTab,
        advancedSections,
        motionTemplate: motionTemplate ?? null,
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [previewSettings, previewVideo, guidedStep, viewMode, advancedTab, advancedSections, motionTemplate, source?.id, access, previewUserScope])

  // Cancel pending project persistence and release every still-owned blob URL
  // on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      releaseAllBlobUrls()
      projectPersistence.current.cancel()
      releaseAllBlobUrls()
    }
  }, [releaseAllBlobUrls])

  // ── Project restore (Phase 14) ──────────────────────────────────────────────
  // When the modal opens with a source, attempt to load the most-recently-saved
  // project for that source from Supabase.  The debounced-persist effect above
  // will write state changes back; localStorage is left as a fast local cache
  // but Supabase is the durable source of truth.
  //
  // When Supabase has no row for the source (fresh row, RLS filter, source-id
  // mismatch, or a transient fetch error), the per-user localStorage mirror is
  // applied so the visitor's in-progress preview still survives a reload. The
  // mirror is user-scoped so two visitors sharing a browser never see each
  // other's preview; the localStorage read is still defensive against blob:
  // URLs and missing layers via the existing helpers.

  // Apply the per-user localStorage preview mirror to the live state. Used
  // when Supabase has no row (the Supabase-miss fall-through) AND as the
  // "field missing on entry" fall-through inside the entry-driven path.
  // "field missing on entry" fall-through inside the entry-driven path.
  const applyLocalPreviewState = useCallback((srcId: string) => {
    const stored = readPreviewStorage(srcId, previewUserScope)
    if (!stored) return
    setPreviewSettings(
      stored.previewSettings === undefined || stored.previewSettings === null
        ? normalizePreviewSettings(undefined)
        : normalizePreviewSettings(stored.previewSettings),
    )
    const storedVideo = stored.previewVideo
    setPreviewVideo(restorablePreviewVideo(storedVideo))
    const storedStep = stored.guidedStep
    setGuidedStepState(
      typeof storedStep === 'number' && storedStep >= 1 && storedStep <= 4
        ? (storedStep as GuidedStep)
        : 1,
    )
    const storedViewMode = stored.viewMode
    setViewMode(storedViewMode === 'advanced' ? 'advanced' : 'simple')
    setAdvancedTab(toAdvancedTab(stored.advancedTab))
    setAdvancedSections(toAdvancedSections(stored.advancedSections))
    setPreviewApproved(false)
    // Re-resolve the stored Motion Studio template through the catalog so a
    // stale id resolves to the current canonical entry (or null if it was
    // removed/renamed upstream). The catalog import is tree-shake-friendly
    // and resolves synchronously.
    const storedTemplate = stored.motionTemplate
    setMotionTemplate(
      storedTemplate && typeof storedTemplate === 'object'
        ? getMotionTemplate((storedTemplate as MotionTemplate).id) ?? null
        : null,
    )
  }, [previewUserScope])

  const restoreProject = useCallback(async (src: PersonalizationSource): Promise<void> => {
    if (!src?.id) return
    const session = ++restoreSessionRef.current
    projectPersistence.current.cancel() // don't race with an in-flight save
    // A new source writes to its own row: forget the previous source's row id
    // until this source's saved project (if any) is known.
    projectPersistence.current.setProjectId(null)

    let result: LoadProjectResult
    try {
      result = await loadProject({ sourceId: src.id })
    } catch {
      if (session !== restoreSessionRef.current) return
      // Network/parse failure: Supabase is unreachable but the visitor's
      // per-user localStorage mirror may still have their in-progress
      // preview, so fall through to it instead of abandoning the session.
      applyLocalPreviewState(src.id)
      return
    }
    // A newer restore started, or the modal closed, while this one loaded.
    if (session !== restoreSessionRef.current) return

    if (!result.ok || !result.data) {
      // Supabase returned no durable row for this source. The localStorage
      // mirror is authoritative for the visitor's preview in this branch.
      applyLocalPreviewState(src.id)
      return
    }

    const entry = result.data

    const savedClient = entry.clientId
      ? clients.find((c) => c.id === entry.clientId) ?? loadClients().find((c) => c.id === entry.clientId)
      : null

    const clientFormPatch: Partial<ClientProfile> = { ...(savedClient ?? {}) }
    if (entry.ctaHeadline) clientFormPatch.ctaHeadline = entry.ctaHeadline
    if (entry.callToAction) clientFormPatch.callToAction = entry.callToAction
    setClientForm(clientFormPatch)

    if (savedClient) {
      setSelectedClientId(savedClient.id)
      setCurrentClientId(savedClient.id)
    }

    // ── Restore assets ───────────────────────────────────────────────────────
    // Each saved id is rebuilt from its persisted durable URL. An id with no
    // loadable URL (a row saved before `assetUrls` existed) is skipped: an
    // asset whose `url` is an opaque id would break generation and previews.
    const assetEntries: { id: string; url: string; role: PersonalizationAsset['role']; isPrimary: boolean }[] = []
    const pushRestored = (id: string, role: PersonalizationAsset['role'], isPrimary: boolean) => {
      const url = resolveRestoredAssetUrl(id, entry.assetUrls)
      if (url) assetEntries.push({ id, url, role, isPrimary })
    }

    entry.identityAssetIds.forEach((id, idx) => pushRestored(id, 'presenter_identity', idx === 0))
    entry.logoAssetIds.forEach((id, idx) => pushRestored(id, 'logo', idx === 0))
    entry.productAssetIds.forEach((id) => pushRestored(id, 'product_reference', false))
    entry.brandReferenceAssetIds.forEach((id) => pushRestored(id, 'brand_reference', false))
    if (entry.firstFrameAssetId) pushRestored(entry.firstFrameAssetId, 'first_frame', true)
    if (entry.lastFrameAssetId) pushRestored(entry.lastFrameAssetId, 'last_frame', true)

    // Build the AssetLibrary in one shot to avoid intermediate empty states
    const restoredLibrary = assetEntries.reduce<AssetLibrary>((lib, a) => {
      const asset: PersonalizationAsset = {
        id: a.id,
        role: a.role,
        name: a.url.split('/').pop() || a.id,
        url: a.url,
        uploadedUrl: a.url,
        isPrimary: a.isPrimary,
        mimeType: '',
        createdAt: new Date().toISOString(),
        uploadStatus: 'ready',
        uploadError: null,
        file: null,
      }
      return updateAssetInLibrary(lib, asset)
    }, { ...EMPTY_ASSET_LIBRARY })

    // The saved-recast library isn't part of the project; keep it, or the
    // recast save effect would erase the saved recasts.
    setAssets((prev) => ({ ...restoredLibrary, presenterVideos: prev.presenterVideos }))

    // ── Restore prompt ───────────────────────────────────────────────────────
    setPromptState({
      original: entry.originalPrompt || src.originalPrompt || src.fullPrompt || '',
      personalized: entry.personalizedPrompt || '',
      edited: entry.personalizedPrompt || '',
    })

    // ── Restore generation settings ──────────────────────────────────────────
    if (entry.generationSettings && typeof entry.generationSettings === 'object') {
      const gs = entry.generationSettings as Record<string, unknown>
      setGenOptions((prev) => ({
        ...prev,
        engine: typeof gs.engine === 'string' ? gs.engine : prev.engine,
        preserveAudio: gs.preserveAudio !== false,
        exactLogoHandling: (typeof gs.exactLogoHandling === 'string' ? gs.exactLogoHandling : prev.exactLogoHandling) as GenerationOptions['exactLogoHandling'],
        exactCtaHandling: (typeof gs.exactCtaHandling === 'string' ? gs.exactCtaHandling : prev.exactCtaHandling) as GenerationOptions['exactCtaHandling'],
        firstFrameMode: (typeof gs.firstFrameMode === 'string' ? gs.firstFrameMode : prev.firstFrameMode) as GenerationOptions['firstFrameMode'],
        lastFrameMode: (typeof gs.lastFrameMode === 'string' ? gs.lastFrameMode : prev.lastFrameMode) as GenerationOptions['lastFrameMode'],
        advancedModel: typeof gs.advancedModel === 'string' ? gs.advancedModel : prev.advancedModel,
        aspectRatio: typeof gs.aspectRatio === 'string' ? gs.aspectRatio : prev.aspectRatio,
        duration: typeof gs.duration === 'number' ? gs.duration : prev.duration,
        resolution: typeof gs.resolution === 'string' ? gs.resolution : prev.resolution,
        quality: typeof gs.quality === 'string' ? gs.quality : prev.quality,
        consentGiven: gs.consentGiven === true,
      }))
    }
    // Top-level `model` field is the durable record of which model the user
    // picked; `generationSettings` does not carry it, so restore it separately
    // and let an explicit generationSettings value (older payloads) win.
    if (typeof entry.model === 'string' && entry.model) {
      setGenOptions((prev) => (prev.model === entry.model ? prev : { ...prev, model: entry.model! }))
    }

    // ── Restore guided Simple Mode + free preview ────────────────────────────
    // Supabase wins; the per-user localStorage mirror is only consulted when
    // the saved project predates the preview (or has no preview state of its
    // own), so older projects fall back to the mirror's values for the same
    // user. Other users' mirrors are skipped automatically because the key is
    // user-scoped.
    const stored = readPreviewStorage(src.id, previewUserScope)
    const storedSettings =
      entry.previewSettings !== undefined && entry.previewSettings !== null
        ? entry.previewSettings
        : stored?.previewSettings
    setPreviewSettings(
      storedSettings === undefined || storedSettings === null
        ? normalizePreviewSettings(undefined)
        : normalizePreviewSettings(storedSettings),
    )
    const storedVideo =
      entry.previewVideo !== undefined && entry.previewVideo !== null
        ? entry.previewVideo
        : stored?.previewVideo
    setPreviewVideo(restorablePreviewVideo(storedVideo))
    const storedStep =
      typeof entry.guidedStep === 'number' ? entry.guidedStep : stored?.guidedStep
    setGuidedStepState(
      typeof storedStep === 'number' && storedStep >= 1 && storedStep <= 4
        ? (storedStep as GuidedStep)
        : 1,
    )
    const storedViewMode =
      entry.viewMode !== undefined && entry.viewMode !== null
        ? entry.viewMode
        : stored?.viewMode
    setViewMode(storedViewMode === 'advanced' ? 'advanced' : 'simple')
    setAdvancedTab(toAdvancedTab(stored?.advancedTab))
    setAdvancedSections(toAdvancedSections(stored?.advancedSections))
    setPreviewApproved(false)
    // Re-resolve the stored Motion Studio template through the catalog so a
    // stale id (e.g. from an older session) maps to the current canonical
    // entry. The mirror is the source of truth here; the project entry does
    // not carry recipe metadata.
    const storedTemplate = stored?.motionTemplate
    setMotionTemplate(
      storedTemplate && typeof storedTemplate === 'object'
        ? getMotionTemplate((storedTemplate as MotionTemplate).id) ?? null
        : null,
    )

    // ── Restore output type ──────────────────────────────────────────────────
    if (entry.outputType && ['prompt', 'image', 'video', 'everything'].includes(entry.outputType)) {
      setOutputType(entry.outputType as OutputType)
    }

    // ── Restore mode ─────────────────────────────────────────────────────────
    const validModes = src.mediaType === 'video'
      ? ['face_only', 'full_body', 'recreate', 'complete']
      : src.mediaType === 'image'
        ? ['keep_design', 'replace_face', 'replace_person', 'recreate', 'complete']
        : []
    if (entry.personalizationMode && validModes.includes(entry.personalizationMode)) {
      setMode(entry.personalizationMode as VideoPersonalizationMode | ImagePersonalizationMode)
    }

    // ── Restore CTA ──────────────────────────────────────────────────────────
    if (entry.ctaHeadline || entry.callToAction) {
      setClientForm((prev) => ({
        ...prev,
        ctaHeadline: entry.ctaHeadline ?? prev.ctaHeadline,
        callToAction: entry.callToAction ?? prev.callToAction,
      }))
    }

    // ── Restore result URLs (non-blob) ───────────────────────────────────────
    if (Array.isArray(entry.outputUrls) && entry.outputUrls.length > 0) {
      const durableUrls = entry.outputUrls.filter((u) => typeof u === 'string' && !u.startsWith('blob:'))
      if (durableUrls.length > 0) {
        setResult({
          type: entry.outputType as GenerationResult['type'],
          urls: durableUrls,
          prompt: entry.personalizedPrompt || undefined,
          // A saved clip without the approved layers says so again, and is
          // not offered for publishing as if it were the final video.
          ...(entry.layersMissing
            ? { metadata: { layersMissing: true, publishUrl: '', layersNote: LAYERS_MISSING_NOTE } }
            : {}),
        })
      }
    }

    // Later autosaves update the restored row rather than inserting a new one.
    projectPersistence.current.setProjectId(entry.id)

    // Expose restore summary to the UI
    setLoadedProject({
      id: entry.id || '',
      sourceDemoId: entry.sourceDemoId || src.id,
      personalizedPrompt: entry.personalizedPrompt,
      clientId: entry.clientId ?? null,
      status: entry.status || 'draft',
      updatedAt: new Date().toISOString(),
    })
  }, [clients, previewUserScope, applyLocalPreviewState])

  // Hydrate state from Supabase whenever the modal opens with a source.
  // The reset-on-source-change effect (above) runs first, clearing state;
  // this effect then fills it back in from durable storage. Anonymous sessions
  // have no durable storage to hydrate from (and issue no authenticated
  // request), so the free run always starts from a clean slate.
  //
  // `restoreProject` is read through a ref: its identity changes whenever
  // `previewUserScope` does (the auth-config API key hydrates AFTER mount on
  // every real page load), and re-running the restore then would re-apply the
  // just-written localStorage mirror over the user's live session — silently
  // reverting their view mode, guided step and preview state to what they
  // were ~800ms after the modal opened. The restore must run once per
  // source/open, with the latest closure — never again because the scope
  // arrived late.
  const restoreProjectRef = useRef(restoreProject)
  useEffect(() => {
    restoreProjectRef.current = restoreProject
  }, [restoreProject])

  const resumeLastProject = useCallback(async () => {
    if (!source) return
    freshStartRef.current = false
    setResumableProject(null)
    setRestoring(true)
    try {
      await restoreProjectRef.current(source)
    } finally {
      setRestoring(false)
    }
  }, [source])

  const dismissResumableProject = useCallback(() => {
    setResumableProject(null)
  }, [])

  useEffect(() => {
    if (!source?.id || !isOpen || access !== 'authenticated') return
    let cancelled = false
    setLoadedProject(null)
    setResumableProject(null)
    // The modal opens with an empty form. The last saved project is only
    // offered ("Continue with …"); loading it happens on the user's request.
    freshStartRef.current = true
    // A fresh form must not stay attached to the last saved client, or saving
    // a new business would overwrite that client's profile. Continue (or
    // picking a saved client) re-attaches it.
    setSelectedClientId('')
    setCurrentClientId(null)
    projectPersistence.current.cancel()
    projectPersistence.current.setProjectId(null)

    loadProject({ sourceId: source.id })
      .then((result) => {
        if (cancelled || !freshStartRef.current) return
        if (!result.ok || !result.data) {
          // No saved row, but this browser kept the visitor's preview.
          if (readPreviewStorage(source.id, previewUserScope)) setResumableProject({ label: 'your last project' })
          return
        }
        const entry = result.data
        const savedClient = entry.clientId
          ? clients.find((c) => c.id === entry.clientId) ?? loadClients().find((c) => c.id === entry.clientId)
          : null
        const label = savedClient?.businessName || savedClient?.website || 'your last project'
        setResumableProject({ label })
      })
      .catch(() => {
        // No offer when the saved project cannot be read; the fresh form stands.
      })

    return () => {
      cancelled = true
    }
    // `restoreProject` is intentionally absent: it is read through
    // `restoreProjectRef` above so a late `previewUserScope` change (the
    // auth-config API key hydrating) never re-triggers this restore and
    // clobbers the visitor's live session. See the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, isOpen, access])

  // ── Modal actions ──────────────────────────────────────────────────────────

  const openPersonalize = useCallback((opts: OpenPersonalizeOptions) => {
    const normalized = normalizePersonalizationSource(opts.source)
    if (normalized) {
      const label =
        normalized.sourceType === 'go-ai-viral-prompt' || normalized.sourceType === 'go-ai-viral-video'
          ? 'SmartVideo GO AI'
          : undefined
      setSourceTypeLabel(label)
      setAccess(opts.access || accessProp || 'authenticated')
      // Set source BEFORE isOpen so the restore effect (which watches
      // source?.id && isOpen) runs in the same render cycle as the modal
      // appearing — and AFTER the reset-on-source-change effect clears state.
      setSource(normalized)
      setIsOpen(true)
      triggerRef.current = opts.trigger || null
      // ── Studio hand-off context (Phase 1) ──────────────────────────────────
      // Stored in refs so the generation callbacks can read them without
      // re-rendering, and reset here so a second open never inherits the
      // previous open's callback, assets or destination.
      originStudioRef.current = opts.originStudio || null
      initialAssetsRef.current = opts.initialAssets || null
      onCompleteRef.current = opts.onComplete || null
      returnToRef.current = opts.returnTo || null
      returnPayloadRef.current = opts.returnPayload || null
      onCompleteFiredRef.current = false
      if (opts.initialAssets) {
        // Applied eagerly as well as in the reset effect below: re-opening the
        // SAME source id skips the reset, so the seeded assets would otherwise
        // never be re-applied.
        setAssets({ ...EMPTY_ASSET_LIBRARY, ...opts.initialAssets })
      }
    }
  }, [accessProp])

  const closePersonalize = useCallback(() => {
    // Invalidate any restore still loading for the session being closed.
    restoreSessionRef.current += 1
    // A branded render still running for the closing session stops too.
    cancelActiveExport()
    // Reopening the same source must reset the form again: the personalizer
    // always opens empty, with the last project offered rather than kept.
    resetSourceIdRef.current = undefined
    endBusinessSession()
    // Revoke outstanding blob URLs (reference-counted, idempotent;
    // outside the state updater — updaters must stay pure for Strict Mode replay)
    releaseAllBlobUrls()
    setIsOpen(false)
    setSource(null)
    setSourceTypeLabel(undefined)
    setAccess(accessProp || 'authenticated')
    setResult(null)
    setGeneration({ ...EMPTY_GENERATION_STATE })
    // Drop the studio hand-off context so a completion callback can never
    // fire on a later open.
    originStudioRef.current = null
    initialAssetsRef.current = null
    onCompleteRef.current = null
    returnToRef.current = null
    returnPayloadRef.current = null
    onCompleteFiredRef.current = false
    triggerRef.current?.focus()
    triggerRef.current = null
  }, [accessProp, releaseAllBlobUrls, endBusinessSession])

  // ── Client actions ─────────────────────────────────────────────────────────

  const selectClient = useCallback((id: string) => {
    // A saved client's fields are the user's own, not website auto-fill.
    autoFilledRef.current = {}
    placeholderNameRef.current = ''
    setAutoFilledContent({})
    // A Find My Brand run still in flight belongs to the previous business:
    // its results must not be imported into this client's assets.
    businessSessionRef.current += 1
    autoImportPendingRef.current = false
    // The previous business's auto-placed logo and photos are not this client's.
    removeAutoImportedAssetsRef.current?.()
    setDiscoveredAssetsState([])
    setDiscoveryStatus('idle')
    setDiscoveryError(null)
    setVisionStatus('idle')
    setVisionError(null)
    // The previous business's summary and selection describe it, not this client.
    setBusinessLoadSummary(null)
    setSelectedBusiness(null)
    setBusinessSearchMode((mode) => (mode === 'selected' || mode === 'searching' ? 'idle' : mode))
    setBusinessResearch({ status: 'idle' })
    setSelectedClientId(id)
    if (!id) {
      setCurrentClientId(null)
      setClientForm({})
      return
    }
    const found = clients.find((c) => c.id === id)
    if (found) {
      setCurrentClientId(id)
      setClientForm({ ...found })
    }
  }, [clients])

  const createClientRecord = useCallback((partial: Partial<ClientProfile>): ClientProfile => {
    return createClient(partial)
  }, [])

  const saveClient = useCallback(async (): Promise<ClientProfile | null> => {
    try {
      const partial = clientForm as Partial<ClientProfile>
      let saved: ClientProfile
      if (selectedClientId && clients.some((c) => c.id === selectedClientId)) {
        saved = saveClientRecord({ ...partial, id: selectedClientId } as ClientProfile)
      } else {
        saved = createClient(partial)
        // A brand-new client takes the assets already in the job; switching to
        // an existing client never copies anything (see the persist effect).
        const library = mergeIntoClientLibrary(loadClientAssets(saved.id), {
          identities: assets.identities,
          primaryIdentity: assets.primaryIdentity,
          logos: assets.logos,
          primaryLogo: assets.primaryLogo,
          products: assets.products,
          brandReferences: assets.brandReferences,
        })
        saveClientAssets(saved.id, library)
        setSavedClientAssets(library)
      }
      setClients(loadClients())
      setSelectedClientId(saved.id)
      setCurrentClientId(saved.id)
      return saved
    } catch {
      return null
    }
  }, [clientForm, selectedClientId, clients, assets])

  const updateClient = useCallback((client: ClientProfile) => {
    saveClientRecord(client)
    setClients(loadClients())
  }, [])

  const deleteClient = useCallback((id: string) => {
    deleteClientRecord(id)
    setClients(loadClients())
    if (selectedClientId === id) {
      setSelectedClientId('')
      setCurrentClientId(null)
      setClientForm({})
    }
  }, [selectedClientId])

  const updateClientForm = useCallback((patch: Partial<ClientProfile>) => {
    setClientForm((prev) => ({ ...prev, ...patch }))
  }, [])

  /**
   * Additive research merge.
   *
   * Research results fill ONLY empty client-form fields: a value the visitor
   * edited is never overwritten, and a missing research value never clobbers
   * an existing one. The canonical URL therefore no longer replaces a
   * hand-corrected website — the visitor's value always wins.
   */
  // The brand-colour pair last applied from research (see applyResearchedBrandColors).
  const autoAppliedBrandColorsRef = useRef<BrandColorPair | null>(null)
  const mergeResearchIntoClientForm = useCallback((research: BusinessResearchResult) => {
    const incoming = businessContentFromResearch(research)
    // No description in the page's metadata: the first real paragraph of the
    // site's own text is a better start than an empty field.
    if (!incoming.brandDescription) {
      const paragraph = firstParagraphOf(research.pageMarkdown)
      if (paragraph) incoming.brandDescription = paragraph
    }
    setClientForm((prev) => {
      const merged = mergeAutoFilledContent(prev, incoming, autoFilledRef.current, {
        placeholderName: placeholderNameRef.current,
      })
      autoFilledRef.current = merged.autoFilled
      return merged.form
    })
    // The site's own brand colours theme the preview, unless the visitor has
    // picked colours (then theirs win). Colours auto-applied for an earlier
    // business are replaced, never mistaken for the visitor's choice.
    const researchedColors = researchBrandColors(research.brandColors)
    // Read once, outside the updater, so a re-run updater (StrictMode) sees
    // the same input and produces the same result.
    const previouslyAutoApplied = autoAppliedBrandColorsRef.current
    setPreviewSettings((prev) => {
      const { colors, autoApplied } = applyResearchedBrandColors(
        prev.brandColors,
        researchedColors,
        previouslyAutoApplied,
      )
      autoAppliedBrandColorsRef.current = autoApplied
      return colors === prev.brandColors ? prev : { ...prev, brandColors: colors }
    })
  }, [])

  // The merge records what it filled in a ref (it runs inside a state
  // updater); mirror it into state so the "from website" tags re-render.
  useEffect(() => {
    setAutoFilledContent(autoFilledRef.current)
  }, [clientForm])

  const autoFilledKeys = useMemo(
    () => autoFilledKeysOf(clientForm, autoFilledContent),
    [clientForm, autoFilledContent],
  )

  // ── Saved client assets actions ─────────────────────────────────────────────

  const useSavedClient = useCallback((id: string) => {
    selectClient(id)
    const library = loadClientAssets(id)
    setSavedClientAssets(library)
  }, [selectClient])

  const deleteSavedClient = useCallback((id: string) => {
    // Release the blobs owned by this client's saved entries before the
    // library is dropped.  Job copies sharing a URL survive via the liveness
    // check inside the release helper.
    const doomed = loadClientAssets(id)
    const doomedAssets = [
      ...doomed.identities,
      ...doomed.logos,
      ...doomed.products,
      ...doomed.brandReferences,
    ].filter(Boolean) as PersonalizationAsset[]
    doomedAssets.forEach((asset) => releaseSavedBlobUrls(asset.id, asset, { dropOriginal: true }))
    deleteClientAssets(id)
    setSavedClientAssets({ ...EMPTY_CLIENT_ASSET_LIBRARY })
    setClients((prev) => prev.filter((c) => c.id !== id))
    setSelectedClientId((prev) => {
      if (prev === id) {
        deleteClientRecord(id)
        setCurrentClientId(null)
        setClientForm({})
        lastResultRef.current = null
        lastProjectRef.current = null
        return ''
      }
      return prev
    })
  }, [releaseSavedBlobUrls])

  const selectSavedAsset = useCallback((asset: PersonalizationAsset) => {
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [])

  const setPrimarySavedAsset = useCallback((role: 'identity' | 'logo', assetId: string) => {
    if (!selectedClientId) return
    const next = setPrimaryInClientLibrary(selectedClientId, role, assetId)
    setSavedClientAssets(next)
  }, [selectedClientId])

  const removeSavedAsset = useCallback((assetId: string) => {
    if (!selectedClientId) return
    // Release the saved entry's own ownership of its blob URLs before the
    // entry is dropped.  A job-library copy sharing the same URLs stays alive
    // through the liveness check inside the release helper.
    const savedAsset = [
      ...savedClientAssets.identities,
      ...savedClientAssets.logos,
      ...savedClientAssets.products,
      ...savedClientAssets.brandReferences,
    ].filter(Boolean).find((a) => a?.id === assetId)
    if (savedAsset) releaseSavedBlobUrls(savedAsset.id, savedAsset, { dropOriginal: true })
    const next = removeAssetFromClientLibrary(selectedClientId, assetId)
    setSavedClientAssets(next)
    // Also remove from current job if present
    const jobAsset = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter(Boolean).find((a) => a?.id === assetId)
    if (jobAsset) releaseJobBlobUrls(jobAsset.id, jobAsset, { dropOriginal: true })
    // Drop it from whichever list holds it; everything else (other lists,
    // frames, CTA, audio, recast videos) stays exactly as it was.
    if (jobAsset) {
      setAssets((prev) => {
        const without = (list: PersonalizationAsset[]) => list.filter((a) => a.id !== assetId)
        const identities = without(prev.identities)
        const logos = without(prev.logos)
        return {
          ...prev,
          identities,
          logos,
          products: without(prev.products),
          brandReferences: without(prev.brandReferences),
          primaryIdentity: prev.primaryIdentity?.id === assetId ? identities[0] || null : prev.primaryIdentity,
          primaryLogo: prev.primaryLogo?.id === assetId ? logos[0] || null : prev.primaryLogo,
          firstFrame: prev.firstFrame?.id === assetId ? null : prev.firstFrame,
          lastFrame: prev.lastFrame?.id === assetId ? null : prev.lastFrame,
          ctaGraphic: prev.ctaGraphic?.id === assetId ? null : prev.ctaGraphic,
        }
      })
    }
  }, [selectedClientId, savedClientAssets, assets, releaseSavedBlobUrls, releaseJobBlobUrls])

  // ── Asset upload helpers ───────────────────────────────────────────────────

  const _updateAsset = useCallback((asset: PersonalizationAsset) => {
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [])

  const setAssetUploadStatus = useCallback((id: string, status: PersonalizationAsset['uploadStatus'], error?: string | null) => {
    setAssets((prev) => {
      const all = [
        ...prev.identities,
        ...prev.logos,
        ...prev.products,
        ...prev.brandReferences,
        prev.firstFrame,
        prev.lastFrame,
        prev.ctaGraphic,
        ...prev.audio,
        ...prev.savedReferences,
      ].filter(Boolean) as PersonalizationAsset[]

      const target = all.find((a) => a.id === id)
      if (!target) return prev

      const updated = { ...target, uploadStatus: status, uploadError: error || null }

      switch (target.role) {
        case 'presenter_identity':
        case 'face_identity':
        case 'character_identity':
          return {
            ...prev,
            identities: prev.identities.map((a) => (a.id === id ? updated : a)),
            primaryIdentity: prev.primaryIdentity?.id === id ? updated : prev.primaryIdentity,
          }
        case 'logo':
          return {
            ...prev,
            logos: prev.logos.map((a) => (a.id === id ? updated : a)),
            primaryLogo: prev.primaryLogo?.id === id ? updated : prev.primaryLogo,
          }
        case 'product_reference':
          return { ...prev, products: prev.products.map((a) => (a.id === id ? updated : a)) }
        case 'brand_reference':
          return { ...prev, brandReferences: prev.brandReferences.map((a) => (a.id === id ? updated : a)) }
        case 'first_frame':
          return { ...prev, firstFrame: updated }
        case 'last_frame':
          return { ...prev, lastFrame: updated }
        case 'cta_graphic':
          return { ...prev, ctaGraphic: updated }
        default:
          return prev
      }
    })
  }, [])

  const uploadAsset = useCallback(async (asset: PersonalizationAsset): Promise<string> => {
    // No MuAPI key is needed to save an asset: the upload service stores it
    // durably and defers the MuAPI copy to generation time.

    // The local blob URL captured synchronously from the asset object this
    // upload was started with.  Ownership was registered when the asset was
    // created (via createOwnedAsset), so releaseJobBlobUrls can free it
    // independently of React state — correct even when the upload resolves
    // before React commits the asset.
    const localBlobUrl = asset.url && asset.url.startsWith('blob:') ? asset.url : null

    // Swaps the local preview for a durable URL and releases the blob URL that
    // was captured for this asset when it was created — independent of
    // `assetsRef`, so this is correct even when the upload resolves before
    // React commits the asset.
    const commitDurableUrl = (durableUrl: string) => {
      releaseJobBlobUrls(asset.id, asset, { superseded: [localBlobUrl, asset.uploadedUrl] })
      setAssets((prev) => {
        const updater = (list: PersonalizationAsset[]) => list.map((a) => (a.id === asset.id ? { ...a, url: durableUrl, uploadedUrl: durableUrl } : a))
        return {
          ...prev,
          identities: updater(prev.identities),
          logos: updater(prev.logos),
          products: updater(prev.products),
          brandReferences: updater(prev.brandReferences),
          firstFrame: prev.firstFrame?.id === asset.id ? { ...prev.firstFrame, url: durableUrl, uploadedUrl: durableUrl } : prev.firstFrame,
          lastFrame: prev.lastFrame?.id === asset.id ? { ...prev.lastFrame, url: durableUrl, uploadedUrl: durableUrl } : prev.lastFrame,
          ctaGraphic: prev.ctaGraphic?.id === asset.id ? { ...prev.ctaGraphic, url: durableUrl, uploadedUrl: durableUrl } : prev.ctaGraphic,
        }
      })
    }

    // Test-only bypass: avoid real network uploads in test mode with the placeholder key.
    if (
      process.env.NODE_ENV !== 'production' &&
      apiKey === 'test-mode-key' &&
      testMode
    ) {
      const fakeUrl = 'https://example.com/test-uploaded-asset.png'
      setAssetUploadStatus(asset.id, 'ready', null)
      commitDurableUrl(fakeUrl)
      return fakeUrl
    }

    if (!asset.file) throw new Error('Missing file for upload')

    setAssetUploadStatus(asset.id, 'uploading')
    try {
      const { url } = await uploadPersonalizationAsset(apiKey, {
        file: asset.file as File,
      })
      if (!mountedRef.current) return url
      setAssetUploadStatus(asset.id, 'ready', null)
      // The local blob is being replaced by the durable CDN URL, so free it —
      // but only when the asset is still present. If it was removed (or the
      // provider unmounted) the blob was already released by the removal or
      // unmount path, so revoking again would double-revoke.
      commitDurableUrl(url)
      return url
    } catch (error) {
      // On failure the blob URL stays the asset's live `url` (the user sees a
      // preview plus a retry affordance), so it must NOT be revoked here — it
      // is still released by removeLogo()/removeProduct()/removeIdentity()/…
      // when the asset is dropped.
      if (!mountedRef.current) throw error
      const message = error instanceof Error ? error.message : 'Upload failed'
      setAssetUploadStatus(asset.id, 'error', message)
      throw error
    }
  }, [apiKey, setAssetUploadStatus, testMode, mountedRef, releaseJobBlobUrls])

  const retryAssetUpload = useCallback(async (id: string) => {
    const all = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter(Boolean) as PersonalizationAsset[]
    const asset = all.find((a) => a.id === id)
    if (!asset || !asset.file) return
    await uploadAsset(asset)
  }, [assets, uploadAsset])

  const applyEditedPersonalizationAsset = useCallback(async (
    assetId: string,
    dataUrl: string,
    meta: {
      operation: string
      prompt: string
      model: string
      quality: string
      transparent: boolean
      videoReady: boolean
      responseId?: string | null
      imageGenerationCallId?: string | null
      revisedPrompt?: string | null
      outputFormat?: 'png' | 'jpeg' | 'webp'
      outputCompression?: number | null
      inputFidelity?: 'high' | 'low'
      visionAnalysis?: PersonalizationVisionAnalysis
      visionValidation?: PersonalizationVisionValidation
    },
  ) => {
    const currentJobAssets = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter(Boolean) as PersonalizationAsset[]

    const savedAssets = [
      ...savedClientAssets.identities,
      ...savedClientAssets.logos,
      ...savedClientAssets.products,
      ...savedClientAssets.brandReferences,
    ]

    const target = currentJobAssets.find((a) => a.id === assetId) || savedAssets.find((a) => a.id === assetId)
    if (!target) throw new Error('Asset not found')
    const blob = dataUrlToBlob(dataUrl)
    if (!blob) throw new Error('Edited image could not be read')

    const extension = blob.type === 'image/webp' ? 'webp' : 'png'
    const baseName = (target.name || 'edited-image').replace(/\.[^.]+$/, '')
    const file = new File([blob], baseName + '-edited.' + extension, { type: blob.type || 'image/png' })
    const localUrl = URL.createObjectURL(file)
    // Take ownership of the edited preview blob synchronously, before it is
    // committed to state.
    registerOwnedBlobUrl(target.id, localUrl)
    const originalUrl = target.originalUrl || target.uploadedUrl || target.url

    const editedAsset: PersonalizationAsset = {
      ...target,
      name: file.name,
      url: localUrl,
      uploadedUrl: target.uploadedUrl,
      file,
      mimeType: file.type,
      uploadStatus: 'local',
      uploadError: null,
      originalUrl,
      edited: true,
      editedDataUrl: dataUrl,
      videoReady: meta.videoReady,
      hasTransparency: meta.transparent,
      editMetadata: {
        operation: meta.operation,
        prompt: meta.prompt,
        model: meta.model,
        quality: meta.quality,
        responseId: meta.responseId,
        imageGenerationCallId: meta.imageGenerationCallId,
        revisedPrompt: meta.revisedPrompt,
        outputFormat: meta.outputFormat,
        outputCompression: meta.outputCompression,
        inputFidelity: meta.inputFidelity,
      },
      visionAnalysis: meta.visionAnalysis || target.visionAnalysis,
      visionValidation: meta.visionValidation,
    }

    setAssets((prev) => replaceAssetInLibrary(prev, editedAsset))

    let supabaseUrl: string | undefined
    try {
      const persistResult = await persistEditedPersonalizationAsset({
        assetId: editedAsset.id,
        dataUrl,
        blob,
        mimeType: file.type,
        width: editedAsset.width || 0,
        height: editedAsset.height || 0,
        originalAssetId: target.id,
        clientId: selectedClientId || undefined,
        category: target.sourceCategory,
        role: target.role,
        name: file.name,
        operation: meta.operation,
        prompt: meta.prompt,
        model: meta.model,
        quality: meta.quality,
        outputFormat: meta.outputFormat,
        outputCompression: meta.outputCompression,
        inputFidelity: meta.inputFidelity,
        responseId: meta.responseId,
        imageGenerationCallId: meta.imageGenerationCallId,
        revisedPrompt: meta.revisedPrompt,
        editMetadata: editedAsset.editMetadata,
        visionAnalysis: meta.visionAnalysis as Record<string, unknown> | undefined,
        visionValidation: meta.visionValidation as Record<string, unknown> | undefined,
        sourceCategory: target.sourceCategory,
        sourceType: target.sourceType,
        sourceDiscoveredAssetId: target.sourceDiscoveredAssetId,
        videoReady: meta.videoReady,
        transparent: meta.transparent,
      })

      if (persistResult.ok && persistResult.publicUrl) {
        supabaseUrl = persistResult.publicUrl
        // The durable URL replaces the local preview blob — release the blob
        // captured for this edit (the revert `originalUrl` stays referenced, so
        // it is left alone). Done outside the state updater.
        releaseJobBlobUrls(editedAsset.id, editedAsset, { superseded: [editedAsset.url, editedAsset.uploadedUrl] })
        setAssets((prev) => {
          const updater = (list: PersonalizationAsset[]) =>
            list.map((a) => (a.id === editedAsset.id ? { ...a, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : a))
          return {
            ...prev,
            identities: updater(prev.identities),
            logos: updater(prev.logos),
            products: updater(prev.products),
            brandReferences: updater(prev.brandReferences),
            firstFrame: prev.firstFrame?.id === editedAsset.id ? { ...prev.firstFrame, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.firstFrame,
            lastFrame: prev.lastFrame?.id === editedAsset.id ? { ...prev.lastFrame, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.lastFrame,
            ctaGraphic: prev.ctaGraphic?.id === editedAsset.id ? { ...prev.ctaGraphic, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.ctaGraphic,
          }
        })
      }
    } catch {
      // Supabase persistence failed — fall back to MuAPI upload below
    }

    if (!supabaseUrl) {
      await uploadAsset(editedAsset)
    }
  }, [assets, uploadAsset, selectedClientId, registerOwnedBlobUrl, releaseJobBlobUrls])

  const applyEditedSavedClientAsset = useCallback(async (
    clientId: string,
    assetId: string,
    dataUrl: string,
    meta: {
      operation: string
      prompt: string
      model: string
      quality: string
      transparent: boolean
      videoReady: boolean
      responseId?: string | null
      imageGenerationCallId?: string | null
      revisedPrompt?: string | null
      outputFormat?: 'png' | 'jpeg' | 'webp'
      outputCompression?: number | null
      inputFidelity?: 'high' | 'low'
      visionAnalysis?: PersonalizationVisionAnalysis
      visionValidation?: PersonalizationVisionValidation
    },
  ) => {
    if (!clientId) throw new Error('A selected client is required to save a client asset edit')

    const library = loadClientAssets(clientId)
    const allSaved = [
      ...library.identities,
      ...library.logos,
      ...library.products,
      ...library.brandReferences,
    ]
    const savedTarget = allSaved.find((a) => a.id === assetId)
    if (!savedTarget) throw new Error('Saved client asset not found')

    const blob = dataUrlToBlob(dataUrl)
    if (!blob) throw new Error('Edited image could not be read')

    const extension = blob.type === 'image/webp' ? 'webp' : 'png'
    const baseName = (savedTarget.name || 'edited-image').replace(/\.[^.]+$/, '')
    const file = new File([blob], baseName + '-edited.' + extension, { type: blob.type || 'image/png' })
    const localUrl = URL.createObjectURL(file)
    // Take ownership of the edited preview blob synchronously: the saved
    // library entry owns it, and so does the job library copy when the same
    // asset is currently assigned to this job.
    registerOwnedSavedBlobUrl(savedTarget.id, localUrl)
    const originalUrl = savedTarget.originalUrl || savedTarget.uploadedUrl || savedTarget.url

    const editedAsset: PersonalizationAsset = {
      ...savedTarget,
      name: file.name,
      url: localUrl,
      uploadedUrl: undefined,
      file,
      mimeType: file.type,
      uploadStatus: 'local',
      uploadError: null,
      originalUrl,
      edited: true,
      videoReady: meta.videoReady,
      hasTransparency: meta.transparent,
      editMetadata: {
        operation: meta.operation,
        prompt: meta.prompt,
        model: meta.model,
        quality: meta.quality,
        responseId: meta.responseId,
        imageGenerationCallId: meta.imageGenerationCallId,
        revisedPrompt: meta.revisedPrompt,
        outputFormat: meta.outputFormat,
        outputCompression: meta.outputCompression,
        inputFidelity: meta.inputFidelity,
      },
      visionAnalysis: meta.visionAnalysis || savedTarget.visionAnalysis,
      visionValidation: meta.visionValidation,
    }

    const updatedLibrary = updateAssetInClientLibrary(clientId, editedAsset)
    setSavedClientAssets(updatedLibrary)

    const currentJobTarget = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter((a): a is PersonalizationAsset => Boolean(a)).find((a) => a.id === assetId)

    if (currentJobTarget) {
      registerOwnedBlobUrl(editedAsset.id, localUrl)
      setAssets((prev) => replaceAssetInLibrary(prev, editedAsset))
    }

    let supabaseUrl: string | undefined
    try {
      const persistResult = await persistEditedPersonalizationAsset({
        assetId: editedAsset.id,
        dataUrl,
        blob,
        mimeType: file.type,
        width: editedAsset.width || 0,
        height: editedAsset.height || 0,
        originalAssetId: savedTarget.id,
        clientId,
        category: savedTarget.sourceCategory,
        role: savedTarget.role,
        name: file.name,
        operation: meta.operation,
        prompt: meta.prompt,
        model: meta.model,
        quality: meta.quality,
        outputFormat: meta.outputFormat,
        outputCompression: meta.outputCompression,
        inputFidelity: meta.inputFidelity,
        responseId: meta.responseId,
        imageGenerationCallId: meta.imageGenerationCallId,
        revisedPrompt: meta.revisedPrompt,
        editMetadata: editedAsset.editMetadata,
        visionAnalysis: meta.visionAnalysis as Record<string, unknown> | undefined,
        visionValidation: meta.visionValidation as Record<string, unknown> | undefined,
        sourceCategory: savedTarget.sourceCategory,
        sourceType: savedTarget.sourceType,
        sourceDiscoveredAssetId: savedTarget.sourceDiscoveredAssetId,
        videoReady: meta.videoReady,
        transparent: meta.transparent,
      })

      if (persistResult.ok && persistResult.publicUrl) {
        supabaseUrl = persistResult.publicUrl
        const finalSavedAsset: PersonalizationAsset = {
          ...editedAsset,
          url: supabaseUrl!,
          uploadedUrl: supabaseUrl,
          uploadStatus: 'ready',
        }
        updateAssetInClientLibrary(clientId, finalSavedAsset)
        setSavedClientAssets(updateAssetInClientLibrary(clientId, finalSavedAsset))

        // The durable URL replaces the local preview blob — release the blob
        // captured for this edit (idempotent across the job + saved entries).
        releaseSavedBlobUrls(editedAsset.id, editedAsset, { superseded: [editedAsset.url, editedAsset.uploadedUrl] })
        if (currentJobTarget) {
          releaseJobBlobUrls(editedAsset.id, editedAsset, { superseded: [editedAsset.url, editedAsset.uploadedUrl] })
          setAssets((prev) => {
            const updater = (list: PersonalizationAsset[]) =>
              list.map((a) => (a.id === editedAsset.id ? { ...a, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : a))
            return {
              ...prev,
              identities: updater(prev.identities),
              logos: updater(prev.logos),
              products: updater(prev.products),
              brandReferences: updater(prev.brandReferences),
              firstFrame: prev.firstFrame?.id === editedAsset.id ? { ...prev.firstFrame, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.firstFrame,
              lastFrame: prev.lastFrame?.id === editedAsset.id ? { ...prev.lastFrame, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.lastFrame,
              ctaGraphic: prev.ctaGraphic?.id === editedAsset.id ? { ...prev.ctaGraphic, url: supabaseUrl!, uploadedUrl: supabaseUrl!, uploadStatus: 'ready' as const } : prev.ctaGraphic,
            }
          })
        }
      }
    } catch {
      // Supabase persistence failed — fall back to MuAPI upload below
    }

    if (!supabaseUrl) {
      // MuAPI fallback: `uploadAsset` swaps the job-library copy for the
      // durable URL and releases the job-side ownership of the edit blob.
      const durableUrl = await uploadAsset(editedAsset)
      const finalSavedAsset: PersonalizationAsset = {
        ...editedAsset,
        url: durableUrl,
        uploadedUrl: durableUrl,
        uploadStatus: 'ready',
      }
      updateAssetInClientLibrary(clientId, finalSavedAsset)
      setSavedClientAssets(updateAssetInClientLibrary(clientId, finalSavedAsset))
      // The saved library entry owned its own reference to the edit blob —
      // release it too so the saved entry never keeps (and renders) a URL the
      // job-side release already revoked.  Idempotent via `revokedBlobUrls`.
      releaseSavedBlobUrls(editedAsset.id, editedAsset, {
        superseded: [editedAsset.url, editedAsset.uploadedUrl],
      })
    }
  }, [assets, uploadAsset, registerOwnedSavedBlobUrl, registerOwnedBlobUrl, releaseSavedBlobUrls, releaseJobBlobUrls])

  // ── Asset actions ──────────────────────────────────────────────────────────

  const addIdentityFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const maxImages = source ? resolveModelCapabilities(source, genOptions).maxImages : 1
    const remaining = maxImages - assets.identities.length
    const filesToAdd = imageFiles.slice(0, Math.max(0, remaining))
    if (filesToAdd.length === 0) return

    const newAssets = filesToAdd.map((file) => createOwnedAsset(file, 'presenter_identity', {
      isPrimary: assets.identities.length === 0,
    }))
    newAssets.forEach((asset) => {
      setAssets((prev) => updateAssetInLibrary(prev, asset))
      uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
    })
  }, [assets.identities.length, uploadAsset, source, genOptions, createOwnedAsset])

  const addIdentityUrl = useCallback((url: string) => {
    const asset = createAssetFromUrl(url, 'presenter_identity', {
      isPrimary: assets.identities.length === 0,
    })
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [assets.identities.length])

  const removeIdentity = useCallback((id: string) => {
    // Only release the asset actually being removed (an unknown id used to
    // release the primary's blob and break its preview).
    const asset = assets.identities.find((a) => a.id === id) || (assets.primaryIdentity?.id === id ? assets.primaryIdentity : null)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => ({
      ...prev,
      identities: prev.identities.filter((a) => a.id !== id),
      primaryIdentity: prev.primaryIdentity?.id === id ? null : prev.primaryIdentity,
    }))
  }, [assets, releaseJobBlobUrls])

  const setPrimaryIdentity = useCallback((id: string) => {
    setAssets((prev) => {
      const next = prev.identities.find((a) => a.id === id)
      if (!next) return prev
      return {
        ...prev,
        identities: prev.identities.map((a) => ({ ...a, isPrimary: a.id === id })),
        primaryIdentity: next,
      }
    })
  }, [])

  const addLogoFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const remaining = MAX_REFERENCE_UPLOADS - assets.logos.length
    const filesToAdd = imageFiles.slice(0, Math.max(0, remaining))
    if (filesToAdd.length === 0) return

    const newAssets = filesToAdd.map((file) => createOwnedAsset(file, 'logo', {
      isPrimary: assets.logos.length === 0,
    }))
    newAssets.forEach((asset) => {
      setAssets((prev) => updateAssetInLibrary(prev, asset))
      uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
    })
  }, [assets.logos.length, uploadAsset, createOwnedAsset])

  const addLogoUrl = useCallback((url: string) => {
    const asset = createAssetFromUrl(url, 'logo', {
      isPrimary: assets.logos.length === 0,
    })
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [assets.logos.length])

  const removeLogo = useCallback((id: string) => {
    const asset = assets.logos.find((a) => a.id === id) || (assets.primaryLogo?.id === id ? assets.primaryLogo : null)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => {
      return {
        ...prev,
        logos: prev.logos.filter((a) => a.id !== id),
        primaryLogo: prev.primaryLogo?.id === id ? null : prev.primaryLogo,
      }
    })
  }, [assets, releaseJobBlobUrls])

  const setPrimaryLogo = useCallback((id: string) => {
    setAssets((prev) => {
      const next = prev.logos.find((a) => a.id === id)
      if (!next) return prev
      return {
        ...prev,
        logos: prev.logos.map((a) => ({ ...a, isPrimary: a.id === id })),
        primaryLogo: next,
      }
    })
  }, [])

  const addProductFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (validFiles.length === 0) return

    const remaining = MAX_REFERENCE_UPLOADS - assets.products.length
    const filesToAdd = validFiles.slice(0, Math.max(0, remaining))
    if (filesToAdd.length === 0) return

    const newAssets = filesToAdd.map((file) => createOwnedAsset(file, 'product_reference'))
    newAssets.forEach((asset) => {
      setAssets((prev) => updateAssetInLibrary(prev, asset))
      uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
    })
  }, [assets.products.length, uploadAsset, createOwnedAsset])

  const addProductUrl = useCallback((url: string) => {
    const asset = createAssetFromUrl(url, 'product_reference')
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [])

  const removeProduct = useCallback((id: string) => {
    const asset = assets.products.find((a) => a.id === id)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => ({
      ...prev,
      products: prev.products.filter((a) => a.id !== id),
    }))
  }, [assets, releaseJobBlobUrls])

  const addBrandReferenceFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (validFiles.length === 0) return

    const remaining = MAX_REFERENCE_UPLOADS - assets.brandReferences.length
    const filesToAdd = validFiles.slice(0, Math.max(0, remaining))
    if (filesToAdd.length === 0) return

    const newAssets = filesToAdd.map((file) => createOwnedAsset(file, 'brand_reference'))
    newAssets.forEach((asset) => {
      setAssets((prev) => updateAssetInLibrary(prev, asset))
      uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
    })
  }, [assets.brandReferences.length, uploadAsset, createOwnedAsset])

  const addBrandReferenceUrl = useCallback((url: string) => {
    const asset = createAssetFromUrl(url, 'brand_reference')
    setAssets((prev) => updateAssetInLibrary(prev, asset))
  }, [])

  const removeBrandReference = useCallback((id: string) => {
    const asset = assets.brandReferences.find((a) => a.id === id)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => ({
      ...prev,
      brandReferences: prev.brandReferences.filter((a) => a.id !== id),
    }))
  }, [assets, releaseJobBlobUrls])

  /** Releases the blob URL of a single-slot asset that is being displaced. */
  const releaseDisplacedFrameBlob = useCallback((
    slot: 'firstFrame' | 'lastFrame' | 'ctaGraphic',
    replacedAssetId?: string,
  ) => {
    const current = slot === 'firstFrame'
      ? assetsRef.current.firstFrame
      : slot === 'lastFrame'
        ? assetsRef.current.lastFrame
        : assetsRef.current.ctaGraphic
    if (!current || current.id === replacedAssetId) return
    releaseJobBlobUrls(current.id, current, { dropOriginal: true })
  }, [releaseJobBlobUrls])

  const setFirstFrameFile = useCallback((file: File | null) => {
    if (!file) {
      releaseDisplacedFrameBlob('firstFrame')
      setAssets((prev) => ({ ...prev, firstFrame: null }))
      return
    }
    releaseDisplacedFrameBlob('firstFrame')
    const asset = createOwnedAsset(file, 'first_frame', { isPrimary: true })
    setAssets((prev) => ({ ...prev, firstFrame: asset }))
    uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
  }, [uploadAsset, createOwnedAsset, releaseDisplacedFrameBlob])

  const setFirstFrameUrl = useCallback((url: string) => {
    releaseDisplacedFrameBlob('firstFrame')
    const asset = createAssetFromUrl(url, 'first_frame', { isPrimary: true })
    setAssets((prev) => ({ ...prev, firstFrame: asset }))
  }, [releaseDisplacedFrameBlob])

  const removeFirstFrame = useCallback(() => {
    if (assets.firstFrame) releaseJobBlobUrls(assets.firstFrame.id, assets.firstFrame, { dropOriginal: true })
    setAssets((prev) => ({ ...prev, firstFrame: null }))
  }, [assets.firstFrame, releaseJobBlobUrls])

  const setLastFrameFile = useCallback((file: File | null) => {
    if (!file) {
      releaseDisplacedFrameBlob('lastFrame')
      setAssets((prev) => ({ ...prev, lastFrame: null }))
      return
    }
    releaseDisplacedFrameBlob('lastFrame')
    const asset = createOwnedAsset(file, 'last_frame', { isPrimary: true })
    setAssets((prev) => ({ ...prev, lastFrame: asset }))
    uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
  }, [uploadAsset, createOwnedAsset, releaseDisplacedFrameBlob])

  const setLastFrameUrl = useCallback((url: string) => {
    releaseDisplacedFrameBlob('lastFrame')
    const asset = createAssetFromUrl(url, 'last_frame', { isPrimary: true })
    setAssets((prev) => ({ ...prev, lastFrame: asset }))
  }, [releaseDisplacedFrameBlob])

  const removeLastFrame = useCallback(() => {
    if (assets.lastFrame) releaseJobBlobUrls(assets.lastFrame.id, assets.lastFrame, { dropOriginal: true })
    setAssets((prev) => ({ ...prev, lastFrame: null }))
  }, [assets.lastFrame, releaseJobBlobUrls])

  const setCtaGraphicFile = useCallback((file: File | null) => {
    if (!file) {
      releaseDisplacedFrameBlob('ctaGraphic')
      setAssets((prev) => ({ ...prev, ctaGraphic: null }))
      return
    }
    releaseDisplacedFrameBlob('ctaGraphic')
    const asset = createOwnedAsset(file, 'cta_graphic', { isPrimary: true })
    setAssets((prev) => ({ ...prev, ctaGraphic: asset }))
    uploadAsset(asset).catch((error) => { console.error('Upload failed:', error) })
  }, [uploadAsset, createOwnedAsset, releaseDisplacedFrameBlob])

  const setCtaGraphicUrl = useCallback((url: string) => {
    releaseDisplacedFrameBlob('ctaGraphic')
    const asset = createAssetFromUrl(url, 'cta_graphic', { isPrimary: true })
    setAssets((prev) => ({ ...prev, ctaGraphic: asset }))
  }, [releaseDisplacedFrameBlob])

  const removeCtaGraphic = useCallback(() => {
    if (assets.ctaGraphic) releaseJobBlobUrls(assets.ctaGraphic.id, assets.ctaGraphic, { dropOriginal: true })
    setAssets((prev) => ({ ...prev, ctaGraphic: null }))
  }, [assets.ctaGraphic, releaseJobBlobUrls])

  // ── Library asset move / remove / delete ────────────────────────────────────

  const moveLibraryAssetToSection = useCallback((assetId: string, section: AssignedSection) => {
    // Single-slot destinations displace the asset that currently occupies them.
    if (section === 'firstFrame' || section === 'lastFrame' || section === 'ctaGraphic') {
      releaseDisplacedFrameBlob(section, assetId)
    }
    setAssets((prev) => {
      const all = [
        ...prev.identities,
        ...prev.logos,
        ...prev.products,
        ...prev.brandReferences,
        prev.firstFrame,
        prev.lastFrame,
        prev.ctaGraphic,
        ...prev.audio,
        ...prev.savedReferences,
      ].filter(Boolean) as PersonalizationAsset[]

      const target = all.find((a) => a.id === assetId)
      if (!target) return prev

      // Determine new role from destination section
      const newRole = (() => {
        switch (section) {
          case 'person': return 'presenter_identity'
          case 'logo': return 'logo'
          case 'products': return 'product_reference'
          case 'brand': return 'brand_reference'
          case 'firstFrame': return 'first_frame'
          case 'lastFrame': return 'last_frame'
          case 'ctaGraphic': return 'cta_graphic'
          default: return target.role
        }
      })()

      const movedAsset: PersonalizationAsset = {
        ...target,
        role: newRole,
        // Preserve edited data and source classification
        sourceCategory: target.sourceCategory,
        originalUrl: target.originalUrl || target.uploadedUrl || target.url,
        edited: target.edited,
        editedDataUrl: target.editedDataUrl,
        editMetadata: target.editMetadata,
        visionAnalysis: target.visionAnalysis,
        visionValidation: target.visionValidation,
        videoReady: target.videoReady,
        hasTransparency: target.hasTransparency,
        isPrimary: section === 'person' || section === 'logo' ? target.isPrimary : false,
      }

      // Remove from old location first
      const next: AssetLibrary = {
        ...prev,
        identities: prev.identities.filter((a) => a.id !== assetId),
        logos: prev.logos.filter((a) => a.id !== assetId),
        products: prev.products.filter((a) => a.id !== assetId),
        brandReferences: prev.brandReferences.filter((a) => a.id !== assetId),
        firstFrame: prev.firstFrame?.id === assetId ? null : prev.firstFrame,
        lastFrame: prev.lastFrame?.id === assetId ? null : prev.lastFrame,
        ctaGraphic: prev.ctaGraphic?.id === assetId ? null : prev.ctaGraphic,
        audio: prev.audio.filter((a) => a.id !== assetId),
        savedReferences: prev.savedReferences.filter((a) => a.id !== assetId),
      }

      // Handle primary cleanup for person/logo
      if (section === 'person') {
        next.primaryIdentity = next.identities.find((a) => a.isPrimary) || next.primaryIdentity
      } else if (section === 'logo') {
        next.primaryLogo = next.logos.find((a) => a.isPrimary) || next.primaryLogo
      }
      
      // If moving away from person/logo, clear primary if the moved asset was primary
      if (section !== 'person' && prev.primaryIdentity?.id === assetId) {
        next.primaryIdentity = next.identities.find((a) => a.isPrimary) || null
      }
      if (section !== 'logo' && prev.primaryLogo?.id === assetId) {
        next.primaryLogo = next.logos.find((a) => a.isPrimary) || null
      }

      // Add to new location
      switch (newRole) {
        case 'presenter_identity':
        case 'face_identity':
        case 'character_identity':
          return {
            ...next,
            identities: [...next.identities, movedAsset],
            primaryIdentity: next.primaryIdentity || movedAsset,
          }
        case 'logo':
          return {
            ...next,
            logos: [...next.logos, movedAsset],
            primaryLogo: next.primaryLogo || movedAsset,
          }
        case 'product_reference':
          return { ...next, products: [...next.products, movedAsset] }
        case 'brand_reference':
          return { ...next, brandReferences: [...next.brandReferences, movedAsset] }
        case 'first_frame':
          return { ...next, firstFrame: movedAsset }
        case 'last_frame':
          return { ...next, lastFrame: movedAsset }
        case 'cta_graphic':
          return { ...next, ctaGraphic: movedAsset }
        default:
          return next
      }
    })
  }, [releaseDisplacedFrameBlob])

  const removeLibraryAssetFromSection = useCallback((assetId: string) => {
    const all = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
      ...assets.audio,
      ...assets.savedReferences,
    ].filter(Boolean) as PersonalizationAsset[]
    const asset = all.find((a) => a.id === assetId)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => ({
      ...prev,
      identities: prev.identities.filter((a) => a.id !== assetId),
      logos: prev.logos.filter((a) => a.id !== assetId),
      products: prev.products.filter((a) => a.id !== assetId),
      brandReferences: prev.brandReferences.filter((a) => a.id !== assetId),
      firstFrame: prev.firstFrame?.id === assetId ? null : prev.firstFrame,
      lastFrame: prev.lastFrame?.id === assetId ? null : prev.lastFrame,
      ctaGraphic: prev.ctaGraphic?.id === assetId ? null : prev.ctaGraphic,
      audio: prev.audio.filter((a) => a.id !== assetId),
      savedReferences: prev.savedReferences.filter((a) => a.id !== assetId),
      primaryIdentity: prev.primaryIdentity?.id === assetId ? null : prev.primaryIdentity,
      primaryLogo: prev.primaryLogo?.id === assetId ? null : prev.primaryLogo,
    }))
  }, [assets, releaseJobBlobUrls])

  const deleteLibraryAsset = useCallback((assetId: string) => {
    const all = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
      ...assets.audio,
      ...assets.savedReferences,
    ].filter(Boolean) as PersonalizationAsset[]
    const asset = all.find((a) => a.id === assetId)
    if (asset) releaseJobBlobUrls(asset.id, asset, { dropOriginal: true })
    setAssets((prev) => ({
      ...prev,
      identities: prev.identities.filter((a) => a.id !== assetId),
      logos: prev.logos.filter((a) => a.id !== assetId),
      products: prev.products.filter((a) => a.id !== assetId),
      brandReferences: prev.brandReferences.filter((a) => a.id !== assetId),
      firstFrame: prev.firstFrame?.id === assetId ? null : prev.firstFrame,
      lastFrame: prev.lastFrame?.id === assetId ? null : prev.lastFrame,
      ctaGraphic: prev.ctaGraphic?.id === assetId ? null : prev.ctaGraphic,
      audio: prev.audio.filter((a) => a.id !== assetId),
      savedReferences: prev.savedReferences.filter((a) => a.id !== assetId),
      primaryIdentity: prev.primaryIdentity?.id === assetId ? null : prev.primaryIdentity,
      primaryLogo: prev.primaryLogo?.id === assetId ? null : prev.primaryLogo,
    }))
  }, [assets, releaseJobBlobUrls])

  const revertLibraryAssetToOriginal = useCallback((assetId: string) => {
    const all = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
      ...assets.audio,
      ...assets.savedReferences,
    ].filter(Boolean) as PersonalizationAsset[]
    const target = all.find((a) => a.id === assetId)
    if (!target || !target.edited || !target.originalUrl) {
      setAssets((prev) => prev)
      return
    }
    // Release the edited preview blob, but keep `originalUrl` alive — the
    // reverted asset now renders from it.
    releaseJobBlobUrls(target.id, target, { superseded: [target.url, target.uploadedUrl] })
    const reverted: PersonalizationAsset = {
      ...target,
      url: target.originalUrl,
      uploadedUrl: target.originalUrl,
      edited: false,
      editedDataUrl: undefined,
      editMetadata: undefined,
      visionValidation: undefined,
      videoReady: false,
      hasTransparency: false,
      uploadStatus: 'ready',
      uploadError: null,
      file: null,
      name: target.name.replace('-edited.', '.').replace('_edited.', '.') || target.name,
    }
    setAssets((prev) => replaceAssetInLibrary(prev, reverted))
  }, [assets, releaseJobBlobUrls])

  // ── Discovered assets actions ───────────────────────────────────────────────

  const setDiscoveredAssets = useCallback((assets: DiscoveredAsset[]) => {
    setDiscoveredAssetsState(assets)
    setDiscoveryStatus('reviewing')
    setDiscoveryError(null)
  }, [])

  const toggleDiscoveredAssetSelection = useCallback((id: string) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)),
    )
  }, [])

  const rejectDiscoveredAsset = useCallback((id: string) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, rejected: true, selected: false } : a)),
    )
  }, [])

  const restoreDiscoveredAsset = useCallback((id: string) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, rejected: false } : a)),
    )
  }, [])

  const updateDiscoveredAssetCategory = useCallback((id: string, category: DiscoveredAssetCategory) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, category } : a)),
    )
  }, [])

  const selectRecommendedDiscoveredAssets = useCallback(() => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => ({ ...a, selected: a.recommended })),
    )
  }, [])

  const removeDiscoveredAssetFromSection = useCallback((id: string) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, assignedSection: null, autoAssigned: false } : a)),
    )
  }, [])

  const moveDiscoveredAssetToSection = useCallback((id: string, section: AssignedSection) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, assignedSection: section, autoAssigned: false } : a)),
    )
  }, [])

  const revertDiscoveredAssetEdit = useCallback((id: string) => {
    setDiscoveredAssetsState((prev) =>
      prev.map((a) => (a.id === id ? {
        ...a,
        editedDataUrl: undefined,
        edited: false,
        editMetadata: undefined,
        visionValidation: undefined,
        videoReady: false,
        hasTransparency: false,
        // Restoring the original also opts out of automatic background removal.
        bgOptOut: true,
        bgRemoval: { status: 'idle' },
        showOriginal: false,
      } : a)),
    )
  }, [])

  const importDiscoveredAssets = useCallback(async (options?: ImportDiscoveredAssetsOptions): Promise<string[]> => {
    // Buttons wire this straight to onClick, so the argument can be a click
    // event; only a real options object with ids narrows the import.
    const ids = options && Array.isArray((options as ImportDiscoveredAssetsOptions).ids)
      ? (options as ImportDiscoveredAssetsOptions).ids!
      : null
    const sectionOverride = ids ? (options as ImportDiscoveredAssetsOptions).section : undefined

    // An import for a business that is no longer selected places nothing.
    const importSession = businessSessionRef.current
    setDiscoveryStatus('importing')
    setDiscoveryError(null)

    // A drop onto a section imports exactly the dropped asset into that
    // section, selected or not; otherwise every selected asset is imported.
    const toImport = ids
      ? discoveredAssets
          .filter((a) => ids.includes(a.id) && !a.rejected)
          .map((a) => (sectionOverride ? { ...a, assignedSection: sectionOverride } : a))
      : discoveredAssets.filter((a) => a.selected && !a.rejected)
    if (toImport.length === 0) {
      setDiscoveryStatus('reviewing')
      return []
    }

    const sectionRoleMap: Record<string, PersonalizationAsset['role']> = {
      person: 'presenter_identity',
      logo: 'logo',
      products: 'product_reference',
      brand: 'brand_reference',
      firstFrame: 'first_frame',
      lastFrame: 'last_frame',
      ctaGraphic: 'cta_graphic',
    }

    const categoryRoleMap: Record<string, PersonalizationAsset['role']> = {
      person: 'presenter_identity',
      logo: 'logo',
      product: 'product_reference',
      service: 'product_reference',
      completed_work: 'product_reference',
      storefront: 'brand_reference',
      office: 'brand_reference',
      branded_vehicle: 'brand_reference',
      team: 'brand_reference',
      brand: 'brand_reference',
    }

    // 1. Discovered website images are linked by their web address: nothing
    // is downloaded or copied to storage. Only an image the browser cannot
    // load from its site (the site blocks it) is downloaded and stored, and
    // edited images keep their in-memory edit.
    const untouched = toImport.filter((item) => !item.editedDataUrl)
    const loads = await Promise.all(untouched.map((item) => imageLoadsInBrowser(item.originalPreviewUrl || item.previewUrl)))
    const linkedItems = untouched.filter((_, index) => loads[index])
    const remoteItems = untouched.filter((_, index) => !loads[index])
    const downloadedByUrl = new Map<string, string>()
    let partialDownloadError: string | null = null

    if (remoteItems.length > 0) {
      // The download route takes at most 20 URLs per request, so a full
      // import goes out in batches.
      const urls = remoteItems.map((a) => a.previewUrl)
      const results: Array<{ ok?: boolean; url?: string; dataUrl?: string }> = []
      for (let start = 0; start < urls.length; start += DOWNLOAD_BATCH_SIZE) {
        let downloadRes: Response
        try {
          downloadRes = await fetch('/api/personalization/download-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: urls.slice(start, start + DOWNLOAD_BATCH_SIZE) }),
            credentials: 'same-origin',
          })
        } catch (err) {
          setDiscoveryError(err instanceof Error ? err.message : 'Failed to reach download service')
          setDiscoveryStatus('reviewing')
          return []
        }

        if (!downloadRes.ok) {
          let data: Record<string, unknown>
          try {
            data = await downloadRes.json()
          } catch {
            data = {}
          }
          const status = downloadRes.status
          if (status === 401) {
            setDiscoveryError('Authentication required. Please sign in to continue.')
          } else if (status === 403) {
            setDiscoveryError('You do not have access to this feature. Contact your administrator.')
          } else {
            setDiscoveryError(typeof data?.error === 'string' ? data.error : `Download failed (HTTP ${status})`)
          }
          setDiscoveryStatus('reviewing')
          return []
        }

        const downloadData = await downloadRes.json()
        if (Array.isArray(downloadData?.results)) results.push(...downloadData.results)
      }
      const failedDownloads: string[] = []
      for (const result of results) {
        if (result?.ok && result?.url && result?.dataUrl) {
          downloadedByUrl.set(result.url, result.dataUrl)
        } else if (result?.url) {
          failedDownloads.push(result.url)
        }
      }
      const importedCount = downloadedByUrl.size + linkedItems.length
      if (failedDownloads.length > 0 && importedCount > 0) {
        partialDownloadError = `${failedDownloads.length} of ${untouched.length} assets failed to download. ${importedCount} assets were imported.`
      } else if (failedDownloads.length > 0) {
        setDiscoveryError('All assets failed to download. Please try again.')
        setDiscoveryStatus('reviewing')
        return []
      }
    }

    // 2. Build assets: linked website images carry no file; edited and
    // downloaded images carry the bytes to store.
    const assetsToCreate: { item: DiscoveredAsset; blob: Blob | null; role: PersonalizationAsset['role']; isPrimary: boolean }[] = []
    const linkedIds = new Set(linkedItems.map((item) => item.id))

    for (const item of toImport) {
      const role = sectionRoleMap[item.assignedSection || ''] || categoryRoleMap[item.category] || 'brand_reference'
      if (!role) continue

      let blob: Blob | null = null
      if (!linkedIds.has(item.id)) {
        const dataUrl = item.editedDataUrl || downloadedByUrl.get(item.previewUrl)
        if (!dataUrl) continue
        blob = dataUrlToBlob(dataUrl)
        if (!blob) continue
      }

      const isPrimary =
        role === 'presenter_identity' ? true :
        role === 'logo' ? true :
        false

      assetsToCreate.push({ item, blob, role, isPrimary })
    }

    if (assetsToCreate.length === 0) {
      setDiscoveryError(partialDownloadError || 'No valid images could be downloaded.')
      setDiscoveryStatus('reviewing')
      return []
    }

    // 3. Build asset objects before updating library so upload can reference them.
    const createdAssets: PersonalizationAsset[] = []
    for (const { item, blob, role, isPrimary } of assetsToCreate) {
      const websiteUrl = item.originalPreviewUrl || item.previewUrl
      const shared = {
        isPrimary,
        name: blob ? `discovered_${Date.now()}` : websiteUrl.split('/').pop() || 'discovered',
        originalUrl: websiteUrl,
        edited: Boolean(item.edited || item.editedDataUrl),
        editedDataUrl: item.editedDataUrl,
        videoReady: item.videoReady || false,
        hasTransparency: item.hasTransparency || false,
        editMetadata: item.editMetadata,
        visionAnalysis: item.visionAnalysis,
        visionValidation: item.visionValidation,
        sourceCategory: item.category,
        sourceType: item.sourceType,
        sourceDiscoveredAssetId: item.id,
      }
      // A linked image's permanent address is its address on the site.
      const asset = blob ? createOwnedAsset(blob, role, shared) : createAssetFromUrl(websiteUrl, role, shared)
      createdAssets.push(asset)
    }

    if (importSession !== businessSessionRef.current) return []

    // 3a. Add assets to library
    setAssets((prev) => {
      let next = { ...prev }
      for (const asset of createdAssets) {
        next = updateAssetInLibrary(next, asset)
      }
      return next
    })

    // 4. Store the assets that carry bytes; linked website images are ready.
    const uploadErrors: string[] = []
    const storedAssets = createdAssets.filter((asset) => asset.file)
    for (const asset of storedAssets) {
      try {
        await uploadAsset(asset)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload failed'
        uploadErrors.push(`${asset.name}: ${message}`)
        setAssetUploadStatus(asset.id, 'error', message)
      }
    }

    // Only assets that actually imported leave the review; failed ones stay
    // so they can be retried.
    const importedIds = new Set(assetsToCreate.map(({ item }) => item.id))
    const anyFailed = toImport.some((item) => !importedIds.has(item.id))
    if (ids || anyFailed) {
      setDiscoveredAssetsState((prev) => prev.filter((a) => !importedIds.has(a.id)))
      setDiscoveryStatus('reviewing')
    } else {
      setDiscoveredAssetsState([])
      setDiscoveryStatus('idle')
    }

    const totalAttempted = storedAssets.length
    const successCount = totalAttempted - uploadErrors.length
    if (uploadErrors.length > 0) {
      // Name the reason: a bare count left the user nothing to act on.
      const reason = uploadErrors[0].replace(/^[^:]*:\s*/, '')
      const summary = uploadErrors.length === totalAttempted
        ? `All ${totalAttempted} asset(s) failed to upload: ${reason}`
        : `${uploadErrors.length} of ${totalAttempted} asset(s) failed to upload (${reason}). ${successCount} succeeded.`
      setDiscoveryError(partialDownloadError
        ? `${partialDownloadError} ${summary}`
        : summary)
    } else if (partialDownloadError) {
      setDiscoveryError(partialDownloadError)
    }

    // The assets are in the session regardless of whether the durable upload
    // succeeded: `setAssets` above already placed every created asset into the
    // library, and the video personalization reads them from there. Reporting
    // `count: 0` when only the durable upload failed told a customer whose
    // BYOK key was missing that nothing had been added, while the assets were
    // in fact usable in the session.
    setImportConfirmation({
      count: createdAssets.length,
      failedCount: uploadErrors.length,
      clientName: clientForm.businessName || clientForm.name || undefined,
    })
    return createdAssets.map((asset) => asset.sourceDiscoveredAssetId).filter((id): id is string => Boolean(id))
  }, [discoveredAssets, setAssets, uploadAsset, clientForm, createOwnedAsset])

  /** Remove assets that were placed automatically for the previous business. */
  const removeAutoImportedAssets = useCallback(() => {
    const ids = autoImportedDiscoveredIdsRef.current
    if (ids.size === 0) return
    autoImportedDiscoveredIdsRef.current = new Set()
    // Filtered inside the updater, so an auto-import queued but not yet
    // rendered is removed too.
    setAssets((prev) => withoutAutoImported(prev, ids))
  }, [])
  removeAutoImportedAssetsRef.current = removeAutoImportedAssets

  // When a found business's discovery finishes, place the best logo and
  // photos into empty asset cards so the preview and overlays use them right
  // away. Everything stays reviewable in the Discovered Assets grid.
  //
  // Cut out first, then place: while on-device background removal is expected to
  // run, placement waits (up to AUTO_IMPORT_CUTOUT_WAIT_MS) until the picked
  // assets' cutouts have settled, so the cards and the preview get the
  // transparent versions. Auto mode off, a declined/failed model or a slow
  // download place the originals right away, exactly as before.
  const [autoImportWaitTick, setAutoImportWaitTick] = useState(0)
  const autoImportHoldSinceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!autoImportPendingRef.current || discoveryStatus !== 'reviewing' || discoveredAssets.length === 0) return
    const picks = pickAutoImportAssets(discoveredAssets, assets)
    // Also wait while the model-download consent (phones / data-saver) is undecided: placing the
    // originals now would remove the picks from the grid, and the consent prompt with them.
    if (picks.length > 0 && (autoCutout.willAutoCutOut || autoCutout.needsConsent)) {
      if (autoImportHoldSinceRef.current === null) autoImportHoldSinceRef.current = Date.now()
      const waited = Date.now() - autoImportHoldSinceRef.current
      if (shouldHoldAutoImport(picks.map((asset) => asset.id), discoveredAssets, { willAutoCutOut: true, waitedMs: waited })) {
        const timer = setTimeout(() => setAutoImportWaitTick((n) => n + 1), Math.max(0, AUTO_IMPORT_CUTOUT_WAIT_MS - waited))
        return () => clearTimeout(timer)
      }
    }
    autoImportHoldSinceRef.current = null
    autoImportPendingRef.current = false
    let domain = ''
    try {
      domain = clientForm.website ? new URL(normalizeWebsiteInput(clientForm.website)).hostname.replace(/^www\./, '') : ''
    } catch {
      domain = ''
    }
    const details = Object.keys(autoFilledRef.current).length
    const session = businessSessionRef.current
    // The summary says what was actually placed, once the import finished.
    const summarize = (placed: typeof picks) => {
      if (session !== businessSessionRef.current) return
      setBusinessLoadSummary({
        domain,
        details,
        logo: placed.some((asset) => asset.assignedSection === 'logo'),
        photos: placed.filter((asset) => asset.assignedSection !== 'logo').length,
      })
    }
    if (picks.length === 0) {
      summarize([])
      return
    }
    for (const asset of picks) autoImportedDiscoveredIdsRef.current.add(asset.id)
    // Only assets that were actually placed count as automatic; the rest can
    // still be placed by hand without being removed on a business switch.
    const forgetUnplaced = (placedIds: string[]) => {
      for (const asset of picks) if (!placedIds.includes(asset.id)) autoImportedDiscoveredIdsRef.current.delete(asset.id)
    }
    void importDiscoveredAssets({ ids: picks.map((asset) => asset.id) })
      .then((placedIds) => {
        forgetUnplaced(placedIds)
        summarize(picks.filter((asset) => placedIds.includes(asset.id)))
      })
      .catch(() => {
        forgetUnplaced([])
        summarize([])
      })
  }, [discoveryStatus, discoveredAssets, assets, importDiscoveredAssets, clientForm.website, autoCutout.willAutoCutOut, autoCutout.needsConsent, autoImportWaitTick])

  const cancelDiscovery = useCallback(() => {
    setDiscoveredAssetsState([])
    setDiscoveryStatus('idle')
    setDiscoveryError(null)
    setVisionStatus('idle')
    setVisionError(null)
  }, [])

  const analyzeDiscoveredAssets = useCallback(async () => {
    if (discoveredAssets.length === 0) {
      setVisionStatus('complete')
      return
    }
    setVisionStatus('analyzing')
    setVisionError(null)
    // Results for a business or project that is no longer open are dropped.
    const visionSession = businessSessionRef.current
    // A new discovery (same business) replaces the assets being analysed.
    const visionDiscovery = discoveryRequestRef.current
    const visionStale = () => visionSession !== businessSessionRef.current || visionDiscovery !== discoveryRequestRef.current

    const sectionForCategory = (category: DiscoveredAssetCategory): AssignedSection => {
      if (category === 'person') return 'person'
      if (category === 'logo') return 'logo'
      if (category === 'product' || category === 'service' || category === 'completed_work') return 'products'
      if (category === 'storefront' || category === 'office' || category === 'branded_vehicle' || category === 'team' || category === 'brand') return 'brand'
      return null
    }

    try {
      const analysesById = new Map<string, PersonalizationVisionAnalysis>()
      const candidates = discoveredAssets.filter((asset) => !asset.rejected && asset.previewUrl)

      for (let index = 0; index < candidates.length; index += 8) {
        const batch = candidates.slice(index, index + 8)
        const res = await fetch('/api/personalization/image-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            mode: 'analyze',
            images: batch.map((asset) => ({
              id: asset.id,
              imageUrl: asset.editedDataUrl || asset.previewUrl,
              categoryHint: asset.category,
              roleHint: asset.assignedSection || undefined,
            })),
            businessContext: {
              businessName: clientForm.businessName || clientForm.name,
              industry: clientForm.industry,
              productService: clientForm.productService,
              brandDescription: clientForm.brandDescription,
            },
            targetVideoFormat: genOptions.aspectRatio || source?.aspectRatio || undefined,
          }),
        })

        let data: Record<string, unknown>
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (!res.ok) {
          const status = res.status
          if (status === 401) {
            throw new Error('Authentication required. Please sign in to use SmartVideo GO Vision.')
          }
          if (status === 403) {
            throw new Error('You do not have the SmartVideo GO entitlement. Contact your administrator.')
          }
          throw new Error(typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : `Vision analysis failed (HTTP ${status})`)
        }

        const analyses = Array.isArray(data?.analyses) ? data.analyses : []
        if (analyses.length === 0 && candidates.length > 0) {
          throw new Error('Vision analysis returned no results. Please try again or check your images.')
        }

        for (const analysis of analyses) {
          if (analysis?.id) analysesById.set(analysis.id, analysis as PersonalizationVisionAnalysis)
        }
      }
      if (visionStale()) return

      setDiscoveredAssetsState((previous) => previous.map((asset) => {
        const analysis = analysesById.get(asset.id)
        if (!analysis) return asset

        const useVisionCategory = analysis.confidence >= 75
        const category = useVisionCategory ? analysis.category : asset.category
        const recommended =
          category !== 'irrelevant' &&
          !analysis.duplicateLikely &&
          analysis.relevanceScore >= 60 &&
          analysis.qualityScore >= 35

        return {
          ...asset,
          category,
          confidence: analysis.confidence,
          qualityScore: analysis.qualityScore,
          relevanceScore: analysis.relevanceScore,
          recommended,
          selected: asset.selected || recommended,
          assignedSection:
            useVisionCategory && !asset.assignedSection
              ? sectionForCategory(category)
              : asset.assignedSection,
          visionAnalysis: analysis,
        }
      }))

      // Cross-batch duplicate detection: propagate duplicateLikely to assets
      // with normalized matching URLs across all batches.
      const normalizedUrlIndex = new Map<string, string>()
      for (const asset of discoveredAssets) {
        const url = asset.editedDataUrl || asset.previewUrl
        if (!url) continue
        const normalized = normalizeUrl(url)
        if (normalizedUrlIndex.has(normalized)) {
          normalizedUrlIndex.set(normalized, asset.id)
        } else {
          normalizedUrlIndex.set(normalized, asset.id)
        }
      }

      setDiscoveredAssetsState((previous) => previous.map((asset) => {
        const analysis = analysesById.get(asset.id)
        if (!analysis) return asset
        const url = asset.editedDataUrl || asset.previewUrl
        if (!url) return asset
        const normalized = normalizeUrl(url)
        const duplicateOf = normalizedUrlIndex.get(normalized)
        if (duplicateOf && duplicateOf !== asset.id) {
          return {
            ...asset,
            selected: false,
            recommended: false,
            visionAnalysis: {
              ...analysis,
              duplicateLikely: true,
              duplicateOf,
            },
          }
        }
        return asset
      }))

      setVisionStatus('complete')
    } catch (error) {
      if (visionStale()) return
      setVisionStatus('error')
      setVisionError(error instanceof Error ? error.message : 'Vision analysis failed')
    }
  }, [
    clientForm.brandDescription,
    clientForm.businessName,
    clientForm.industry,
    clientForm.name,
    clientForm.productService,
    discoveredAssets,
    genOptions.aspectRatio,
    source?.aspectRatio,
  ])

  // ── Business search actions ────────────────────────────────────────────────

  const findBusinesses = useCallback(async (niche: string, location: string, radiusMiles: number) => {
    // Results for a project that has since been closed or changed are dropped.
    const searchSession = businessSessionRef.current
    const searchRequest = ++businessSearchRequestRef.current
    const stale = () => searchSession !== businessSessionRef.current || searchRequest !== businessSearchRequestRef.current
    setBusinessSearchError(null)
    setBusinessSearchMode('searching')
    setBusinessSearchQuery({ niche, location, radiusMiles })
    setSelectedBusiness(null)

    try {
      const res = await fetch('/api/personalization/find-businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location, radiusMiles }),
        credentials: 'same-origin',
      })

      if (!res.ok) {
        let data: Record<string, unknown>
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        throw new Error(typeof data?.error === 'string' ? data.error : `Business search failed (HTTP ${res.status})`)
      }

      const data = await res.json()
      if (stale()) return
      const businesses = Array.isArray(data?.businesses) ? data.businesses : []
      const query = data?.query || { niche, location, radiusMiles }

      setBusinessSearchQuery(query)
      setBusinessSearchResults(businesses)
      setBusinessSearchMode(businesses.length > 0 ? 'results' : 'error')
      if (businesses.length === 0) {
        setBusinessSearchError('No businesses found for this niche and location. Try a wider radius or different niche.')
      }
    } catch (err) {
      if (stale()) return
      const message = err instanceof Error ? err.message : 'Business search failed'
      setBusinessSearchError(message)
      setBusinessSearchMode('error')
    }
  }, [])

  const resolveBusinessWebsite = useCallback(async (business: BusinessDiscoveryRecord): Promise<string | null> => {
    websiteLookupBusinessRef.current = business.id
    setWebsiteLookup({ status: 'searching', businessId: business.id, businessName: business.name })
    try {
      const res = await fetch('/api/personalization/resolve-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: business.name,
          city: business.city,
          region: business.region,
          postalCode: business.postalCode,
          phone: business.phone,
          email: business.email,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { website?: unknown }
      if (websiteLookupBusinessRef.current !== business.id) return null
      if (!res.ok) {
        setWebsiteLookup({ status: 'error', businessId: business.id, businessName: business.name })
        return null
      }
      const website = typeof data.website === 'string' && isOwnedWebsite(data.website) ? data.website : null
      websiteLookupSettledRef.current = business.id
      setWebsiteLookup(website
        ? { status: 'found', businessId: business.id, businessName: business.name, website }
        : { status: 'not_found', businessId: business.id, businessName: business.name })
      return website
    } catch {
      if (websiteLookupBusinessRef.current === business.id) {
        setWebsiteLookup({ status: 'error', businessId: business.id, businessName: business.name })
      }
      return null
    }
  }, [])
  // selectBusiness keeps stable deps; it reaches the lookup through a ref.
  const resolveBusinessWebsiteRef = useRef(resolveBusinessWebsite)
  resolveBusinessWebsiteRef.current = resolveBusinessWebsite

  const selectBusiness = useCallback((business: BusinessDiscoveryRecord) => {
    businessSessionRef.current += 1
    setSelectedBusiness(business)
    setBusinessSearchMode('selected')
    setBusinessResearch({ status: 'idle' })

    // Any prior discovery reviewable state belongs to the previously selected
    // business's website. Clearing it here keeps the review UI honest: stale
    // assets cannot leak into the new business's import, and the research
    // panel never shows a summary from a different website. The
    // `runDiscoveryWorkflow` path resets the same state itself, so this is a
    // no-op on the anonymous automated path.
    setDiscoveredAssetsState([])
    setDiscoveryStatus('idle')
    setDiscoveryError(null)
    setVisionStatus('idle')
    setVisionError(null)

    // Content found for the previous business must not mix into this one:
    // drop its auto-filled fields (anything the user typed stays) and the
    // assets that were placed automatically.
    const previousAutoFilled = autoFilledRef.current
    removeAutoImportedAssets()
    autoImportPendingRef.current = false
    setBusinessLoadSummary(null)
    placeholderNameRef.current = business.id.startsWith('url:') ? business.name : ''

    // Populate client form from business, through the single shared mapping
    // (see `clientFormFromBusiness`) that the automated "Find My Brand"
    // workflow uses too. These values count as auto-filled.
    const fromRecord = clientFormFromBusiness(business)
    // A record made from a typed website only knows the hostname, so it never
    // replaces what the user typed (a business picked from search results does).
    const fromTypedWebsite = business.id.startsWith('url:')
    setClientForm((prev) => {
      const next: Partial<ClientProfile> = clearAutoFilledContent(prev, previousAutoFilled)
      const filled: AutoFilledValues = {}
      for (const [key, value] of Object.entries(fromRecord) as Array<[AutoFillKey, unknown]>) {
        if (typeof value !== 'string' || !value.trim()) continue
        const typed = next[key]
        // The submitted URL is the site being researched, so it always wins.
        if (fromTypedWebsite && key !== 'website' && typeof typed === 'string' && typed.trim()) {
          if (key === 'businessName') placeholderNameRef.current = ''
          continue
        }
        next[key] = value
        filled[key] = value
      }
      autoFilledRef.current = filled
      return next
    })

    // OpenStreetMap often lists only a Facebook/Instagram page. Look for the
    // business's own website in the background and fill the form when it is
    // verified (never over a website the visitor typed meanwhile).
    if (isOwnedWebsite(business.website)) {
      websiteLookupBusinessRef.current = null
      setWebsiteLookup({ status: 'idle' })
    } else if (websiteLookupSettledRef.current === business.id) {
      // Already looked up just before selecting (the result-card path); keep
      // that answer instead of asking again.
    } else {
      void resolveBusinessWebsiteRef.current(business).then((found) => {
        if (!found || websiteLookupBusinessRef.current !== business.id) return
        setSelectedBusiness((prev) => (prev && prev.id === business.id
          ? { ...prev, website: found, websiteStatus: 'confirmed' }
          : prev))
        setClientForm((prev) => (prev.website && prev.website.trim() ? prev : { ...prev, website: found }))
      })
    }

    // Asset discovery is NOT triggered here: the caller decides. The
    // "Find My Brand" workflow calls `runDiscoveryWorkflow` (which performs the
    // research + discovery run for a selected business or a pasted URL), and
    // the manual "Find Business Assets" button remains for the step-by-step
    // path.
  }, [removeAutoImportedAssets])

  /**
   * Free-tier discovery: the restricted anonymous pipeline behind
   * `POST /api/demo/discover`. It performs its own SSRF-gated research plus the
   * capped static asset extraction server-side, so the client makes exactly
   * one request and never touches an authenticated endpoint or a paid model.
   */
  const discoverDemoAssets = useCallback(async (rawWebsiteUrl: string): Promise<void> => {

    // Results for a business that is no longer selected are dropped.
    const discoverySession = businessSessionRef.current
    const live = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
      if (discoverySession === businessSessionRef.current) fn(...args)
    }
    const setFoundAssets = live(setDiscoveredAssetsState)
    const setStatus = live(setDiscoveryStatus)
    const setError = live(setDiscoveryError)
    const websiteUrl = (rawWebsiteUrl || '').trim()
    setError(null)
    setVisionError(null)
    setVisionStatus('idle')
    setStatus('discovering')

    const fail = (message: string) => {
      setError(message)
      setStatus('idle')
    }

    if (!websiteUrl) {
      fail('Enter a business website URL to find your brand assets.')
      return
    }

    let response: Response
    try {
      response = await fetch('/api/demo/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl }),
        credentials: 'same-origin',
      })
    } catch {
      fail('Website research failed. Please try again.')
      return
    }

    if (!response.ok) {
      let data: Record<string, unknown> = {}
      try {
        data = await response.json()
      } catch {
        data = {}
      }
      const serverMessage = typeof data?.error === 'string' ? data.error.trim() : ''
      if (response.status === 429) {
        fail(`The free demo is rate limited right now. Please try again later.${serverMessage ? ` ${serverMessage}` : ''}`)
        return
      }
      fail(serverMessage || `Website research failed (HTTP ${response.status}). Please try again.`)
      return
    }

    let data: DemoDiscoveryResponse
    try {
      data = await response.json()
    } catch {
      data = {}
    }
    // Contract guard: a 200 with a different shape must surface the safe
    // message rather than render junk.
    if (!data || data.ok !== true || !Array.isArray(data.assets)) {
      fail('Website research returned an unexpected response. Please try again later.')
      return
    }

    const assets = demoAssetsToDiscoveredAssets(data)
    if (assets.length === 0) {
      fail('No assets were found on that website. Try a different business or paste another URL.')
      return
    }

    // (b) Show the research result in the existing summary panel and merge it
    //     into the form ADDITIVELY: only empty fields are filled, so the value
    //     selectBusiness already wrote (business name, industry, location,
    //     phone, website) and anything the visitor edited are never clobbered.
    const research = businessResearchFromDemoPayload(data)
    // A late result for a business that is no longer selected must not fill
    // the new business's details.
    if (discoverySession !== businessSessionRef.current) return
    mergeResearchIntoClientForm(research)
    setBusinessResearch({ status: 'done', result: research })

    // (c) The same reviewable DiscoveredAsset list the paid pipeline produces.
    setFoundAssets(assets)
    setStatus('reviewing')
  }, [mergeResearchIntoClientForm])

  const discoverAssets = useCallback(async (websiteUrl: string) => {

    // Results for a business that is no longer selected, or from a superseded
    // request for the same business, are dropped.
    const discoverySession = businessSessionRef.current
    const requestId = ++discoveryRequestRef.current
    const live = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
      if (discoverySession === businessSessionRef.current && requestId === discoveryRequestRef.current) fn(...args)
    }
    const setFoundAssets = live(setDiscoveredAssetsState)
    const setStatus = live(setDiscoveryStatus)
    const setError = live(setDiscoveryError)

    const notOwned = websiteUrl ? nonOwnedWebsiteMessage(websiteUrl) : null
    if (notOwned) {
      setError(notOwned)
      setStatus('idle')
      return
    }

    // The access mode — not the modal — decides which endpoint is used.
    if (access === 'anonymous') {
      await discoverDemoAssets(websiteUrl)
      return
    }

    setError(null)
    setVisionError(null)
    setVisionStatus('idle')
    setStatus('discovering')

    // A closed modal must not receive this website's results: the provider
    // stays mounted across routes and the next business reuses its state.
    const session = restoreSessionRef.current
    const stale = () => restoreSessionRef.current !== session

    try {
      const res = await fetch('/api/personalization/discover-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl, testMode }),
        credentials: 'same-origin',
      })

      if (stale()) return

      if (!res.ok) {
        let data: Record<string, unknown>
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (stale()) return
        const status = res.status
        if (status === 401) {
          throw new Error('Authentication required. Please sign in to continue.')
        }
        if (status === 403) {
          throw new Error('You do not have access to this feature. Contact your administrator.')
        }
        throw new Error(typeof data?.error === 'string' ? data.error : `Discovery failed (HTTP ${status})`)
      }

      const data = await res.json()
      if (stale()) return
      const discoveredAssets: DiscoveredAsset[] = Array.isArray(data?.discoveredAssets) ? data.discoveredAssets : []
      const providerUsed = typeof data?.providerUsed === 'string' ? data.providerUsed : 'UNKNOWN'
      const jobId = typeof data?.jobId === 'string' ? data.jobId : null
      const browserQueued = Boolean(data?.browserQueued)
      const responseStatus = typeof data?.status === 'string' ? data.status : (res.status === 202 ? 'processing' : 'complete')

      // If background discovery is queued, show fast assets and poll for completion.
      // 'pending' means the job was accepted but the background worker has not
      // started yet — poll just the same.
      if (jobId && (responseStatus === 'processing' || responseStatus === 'pending' || browserQueued)) {
        if (discoveredAssets.length > 0) {
          setFoundAssets(discoveredAssets)
          setStatus('reviewing')
        } else {
          setStatus('discovering')
        }

        // Poll status endpoint until complete
        let pollCount = 0
        const maxPolls = 60
        const pollInterval = 2000

        const pollStatus = async (): Promise<void> => {
          while (pollCount < maxPolls) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval))
            if (stale()) return
            pollCount++

            try {
              const statusRes = await fetch(`/api/personalization/discover-assets/status?jobId=${encodeURIComponent(jobId)}`, {
                credentials: 'same-origin',
              })
              if (stale()) return

              if (!statusRes.ok) {
                let statusData: Record<string, unknown>
                try {
                  statusData = await statusRes.json()
                } catch {
                  statusData = {}
                }
                throw new Error(typeof statusData?.error === 'string' ? statusData.error : `Status lookup failed (HTTP ${statusRes.status})`)
              }

              const statusData = await statusRes.json()
              if (stale()) return
              const jobStatus = typeof statusData?.status === 'string' ? statusData.status : 'unknown'

              if (jobStatus === 'complete') {
                const finalAssets: DiscoveredAsset[] = Array.isArray(statusData?.result?.discoveredAssets)
                  ? statusData.result.discoveredAssets
                  : []

                if (finalAssets.length > 0) {
                  setFoundAssets(finalAssets)
                  setStatus('reviewing')
                  setError(null)
                } else {
                  setError('No useful assets were found on that website.')
                  setStatus('idle')
                }
                return
              }

              if (jobStatus === 'error') {
                // A background phase can fail while the static crawl already
                // produced real assets (a hosting runtime with no browser, a
                // site that refuses to render). Those assets are still valid
                // and still downloadable, so they are shown for review and the
                // failure is reported as a warning rather than as a dead end.
                const salvaged: DiscoveredAsset[] = Array.isArray(statusData?.result?.discoveredAssets)
                  ? statusData.result.discoveredAssets
                  : []

                if (salvaged.length > 0) {
                  setFoundAssets(salvaged)
                  setStatus('reviewing')
                  setError(
                    typeof statusData?.errorMessage === 'string'
                      ? `Some assets could not be verified (${statusData.errorMessage}). ${salvaged.length} asset(s) are ready to review.`
                      : `Some assets could not be verified. ${salvaged.length} asset(s) are ready to review.`,
                  )
                  return
                }

                const errorMessage = typeof statusData?.errorMessage === 'string'
                  ? statusData.errorMessage
                  : typeof statusData?.error === 'string'
                    ? statusData.error
                    : 'Discovery job failed'
                setError(errorMessage)
                setStatus('idle')
                return
              }

              // Still running; continue polling
            } catch {
              setError('Failed to check discovery status. Please try again.')
              setStatus('idle')
              return
            }
          }

          setError('Discovery timed out. Please try again.')
          setStatus('idle')
        }

        // Awaited so the caller's "busy" state lasts until the job finishes.
        // Returning early re-enabled the button mid-poll, so every extra click
        // started another discovery job.
        await pollStatus()
        return
      }

      // Immediate complete response
      if (discoveredAssets.length === 0) {
        const serverError = typeof data?.error === 'string' ? data.error : ''
        setError(
          serverError || 'No useful assets were found on that website.',
        )
        setStatus('idle')
        return
      }

      setFoundAssets(discoveredAssets)
      setStatus('reviewing')
      console.log(`[discovery] completed via ${providerUsed}: ${discoveredAssets.length} assets`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Discovery failed')
      setStatus('idle')
    }
  }, [access, discoverDemoAssets, setDiscoveredAssetsState, setDiscoveryError, setDiscoveryStatus, testMode])


  /**
   * Shared website-research path: one request to the existing
   * `/api/personalization/research-business` route that returns the parsed
   * result. Both the manual "Research Business" button and the automated
   * "Find My Brand" workflow run through this — there is no second research
   * implementation.
   */
  const fetchBusinessResearch = useCallback(async (website: string): Promise<BusinessResearchResult> => {
    const res = await fetch('/api/personalization/research-business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: website }),
      credentials: 'same-origin',
    })

    if (!res.ok) {
      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        data = {}
      }
      throw new Error(typeof data?.error === 'string' ? data.error : `Research failed (HTTP ${res.status})`)
    }

    const data = await res.json() as { research: BusinessResearchResult }
    const research = data.research

    if (!research || !research.finalUrl) {
      throw new Error('No research data returned')
    }

    return research
  }, [])

  const researchBusiness = useCallback(async (overrideUrl?: string) => {
    const website = overrideUrl || clientForm.website || selectedBusiness?.website
    if (!website) {
      setBusinessResearch({ status: 'error', error: 'No website available to research.' })
      return
    }

    // Dropped if another business is picked while this runs.
    const researchSession = businessSessionRef.current
    setBusinessResearch({ status: 'researching' })

    try {
      const research = await fetchBusinessResearch(website)
      if (researchSession !== businessSessionRef.current) return

      // Update business research state
      setBusinessResearch({
        status: 'done',
        result: research,
      })

      // Additive merge: fill only empty client fields, never overwrite a value
      // the visitor edited and never clobber when the research value is
      // missing (this replaces the old canonical-URL overwrite).
      mergeResearchIntoClientForm(research)
    } catch (err) {
      if (researchSession !== businessSessionRef.current) return
      const message = err instanceof Error ? err.message : 'Research failed'
      setBusinessResearch({ status: 'error', error: message })
    }
  }, [clientForm.website, fetchBusinessResearch, mergeResearchIntoClientForm, selectedBusiness])

  /**
   * The automated "Find My Brand" workflow.
   *
   * One call that, for a single website URL, (a) populates the client form
   * through the existing `selectBusiness` mapping, (b) runs the shared research
   * path and (c) runs asset discovery, leaving the visitor with one reviewable
   * result inside the same modal. Nothing is re-entered and no second screen is
   * opened.
   *
   * Which endpoint is used is decided by `access`, never by the UI:
   *   anonymous     → `POST /api/demo/discover` (restricted free pipeline)
   *   authenticated → the shared research path + `discover-assets`
   */
  const runDiscoveryWorkflow = useCallback(async (
    rawWebsiteUrl: string,
    options?: { business?: BusinessDiscoveryRecord },
  ) => {
    const website = normalizeWebsiteInput(rawWebsiteUrl)
    if (!website) {
      setDiscoveryError('Enter a business website URL to find your brand assets.')
      return
    }
    const notOwned = nonOwnedWebsiteMessage(website)
    if (notOwned) {
      setDiscoveryError(notOwned)
      return
    }

    // (a) Populate the form through the EXISTING selectBusiness mapping — from
    //     the OpenStreetMap record when the visitor picked a business, or from
    //     the pasted URL itself when they arrived with one. There is no second
    //     mapping, so both paths fill the same fields with the same rules.
    selectBusiness(options?.business || businessRecordFromWebsite(website))
    autoImportPendingRef.current = true
    autoImportHoldSinceRef.current = null // a new business starts a fresh wait
    const workflowSession = businessSessionRef.current

    setDiscoveryError(null)
    setVisionError(null)
    setVisionStatus('idle')
    setDiscoveryStatus('discovering')

    // Free discovery runs for every user — anonymous and authenticated alike.
    // It is never behind a paid entitlement or plan check.
    if (access === 'anonymous' || source?.sourceMetadata?.freeDiscovery === true) {
      // The free pipeline performs its own research + capped discovery in one
      // server round trip, so this single call covers research + discovery.
      await discoverDemoAssets(website)
      return
    }

    try {
      const research = await fetchBusinessResearch(website)
      if (workflowSession !== businessSessionRef.current) return
      // (b) Research summary in the existing panel + additive form merge
      //     (only empty fields are filled; edited values always win).
      setBusinessResearch({ status: 'done', result: research })
      mergeResearchIntoClientForm(research)
    } catch (err) {
      if (workflowSession !== businessSessionRef.current) return
      const message = err instanceof Error ? err.message : 'Research failed'
      setBusinessResearch({ status: 'error', error: message })
      setDiscoveryError(message)
      setDiscoveryStatus('idle')
      return
    }

    // (c) Existing discovery run for the same URL.
    await discoverAssets(website)
  }, [access, source, discoverAssets, discoverDemoAssets, fetchBusinessResearch, mergeResearchIntoClientForm, selectBusiness, setDiscoveryError, setDiscoveryStatus, setVisionError, setVisionStatus])

  const clearBusinessSearch = useCallback(() => {
    // A search still in flight must not refill the cleared form.
    businessSearchRequestRef.current += 1
    setBusinessSearchMode('idle')
    setBusinessSearchResults([])
    setBusinessSearchError(null)
    setBusinessSearchQuery(null)
    setSelectedBusiness(null)
    setBusinessResearch({ status: 'idle' })
  }, [])

  // ── Prompt actions ─────────────────────────────────────────────────────────

  const personalizePromptFn = useCallback(async () => {
    if (!source || !clientForm) return
    setGeneration((prev) => ({ ...prev, status: 'personalizing-prompt', progress: 10, progressMessage: 'Personalizing prompt...' }))
    setPromptNotice(null)
    let aiFailure: string | null = null
    try {
      const personalized = await personalizePrompt({
        originalPrompt: promptState.original,
        client: clientForm as ClientProfile,
        assets,
        outputType,
        onAiFailure: (error) => { aiFailure = error instanceof Error ? error.message : 'unknown error' },
      })
      if (personalized === promptState.original) {
        setGeneration((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: aiFailure
            ? `Couldn't reach the AI to personalize the prompt (${aiFailure}). Edit it manually or try again.`
            : 'Personalization returned the same prompt. Please edit manually or retry.',
          failedStage: 'prompt',
        }))
        return
      }
      setPromptState((prev) => ({ ...prev, personalized }))
      setGeneration((prev) => ({ ...prev, status: 'idle', progress: 100, progressMessage: 'Prompt personalized' }))
      // The prompt was still filled in from the client's details: say so.
      if (aiFailure) setPromptNotice(`Couldn't reach the AI (${aiFailure}) — the prompt was filled in from your client details. Review it or try again.`)
    } catch (error) {
      setGeneration((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Failed to personalize prompt',
        failedStage: 'prompt',
      }))
    }
  }, [source, clientForm, promptState.original, assets, outputType])

  const updatePersonalizedPrompt = useCallback((text: string) => {
    setPromptState((prev) => ({ ...prev, edited: text }))
  }, [])

  const resetPrompt = useCallback(() => {
    setPromptState((prev) => ({ ...prev, personalized: '', edited: '' }))
    setPromptNotice(null)
  }, [])

  // ── Generation actions ─────────────────────────────────────────────────────

  /**
   * Finish a run: deliver the outputs to whoever opened the modal and, when a
   * return destination was requested, hand the result to that studio through
   * the existing cross-studio transport.
   *
   * Both halves are opt-in: without an `onComplete` callback and without a
   * `returnTo` target this is a no-op, so the demo flow is unchanged.
   */
  const completeRun = useCallback((result: GenerationResult, personalizedPrompt: string) => {
    const callback = onCompleteRef.current
    const target = returnToRef.current
    if (!callback && !target) return
    if (onCompleteFiredRef.current) return
    onCompleteFiredRef.current = true

    const urls = result.urls || (result.url ? [result.url] : [])
    const outputs = {
      prompts: personalizedPrompt ? [personalizedPrompt] : [],
      images: result.type === 'image' ? urls : [],
      videos: result.type === 'video' ? urls : [],
    }

    callback?.({
      outputs,
      personalizedPrompt,
      projectId: loadedProjectIdRef.current,
      originStudio: originStudioRef.current || undefined,
      sourceId: source?.id,
    })

    if (!target) return

    // Hand the finished result to the target studio. The payload travels in the
    // existing `StudioHandoff` envelope so the target studio reads it exactly
    // like a storyboard hand-off.
    const project = lastProjectRef.current
    const videoUrl = result.type === 'video' ? urls[0] || null : null
    const referenceImageUrl = result.type === 'image' ? urls[0] || null : null
    const handoff = {
      version: 1 as const,
      target,
      from: 'demo-personalization' as const,
      projectName: project?.source?.title || 'Personalized Result',
      aspectRatio:
        ((project?.source?.aspectRatio as '16:9' | '9:16' | '1:1' | null) ||
          (result.type === 'image' ? '1:1' : '16:9')) as '16:9' | '9:16' | '1:1',
      episodeDuration: project?.source?.duration || 0,
      videoUrl,
      referenceImageUrl,
      characterNames: (project?.assets?.identities || []).map((i) => i.name).filter(Boolean),
      shots: [],
      combinedPrompt: personalizedPrompt,
      firstFrameUrl: null,
      metadata: {
        originStudio: originStudioRef.current || 'demo-personalization',
        ...(returnPayloadRef.current || {}),
      },
      createdAt: new Date().toISOString(),
    }
    writeHandoff(handoff)
    const readBack = readHandoff(target)
    if (!readBack) return
    closePersonalize()
    router.push(`/studio/${TARGET_SLUG[target]}`)
  }, [closePersonalize, loadedProjectIdRef, router, source])

  /**
   * Runs a generation. `overrides.options` replaces generation options for
   * this run (so callers don't race a same-tick setGenOptions), and
   * `overrides.burnInLayers` renders the approved on-video layers over a
   * generated video in the browser, in place of the MuAPI logo/end-card
   * watermark.
   */
  const runGenerate = useCallback(async (overrides?: GenerateOverrides) => {
    const options: GenerationOptions = overrides?.options ? { ...genOptions, ...overrides.options } : genOptions
    const burnInLayers = Boolean(overrides?.burnInLayers)
    if (source && mode && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(mode) && !options.consentGiven) {
      // Checked here too, not only by the disabled button.
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: "Confirm permission to use this person's likeness (Output & engine) before creating.",
      })
      return
    }
    if (!source) return
    // remix-new-editor: a run started in one modal session never writes into the next.
    const session = restoreSessionRef.current
    const stale = () => restoreSessionRef.current !== session
    // Image results come from OpenAI (generationRouter -> getOpenAiKey());
    // MuAPI is only used afterwards for the optional logo overlay. Video
    // and prompt-only sources run through MuAPI. Gate on the key the
    // selected operation needs, and say which one is missing.
    const missingKey =
      source.mediaType === 'image'
        ? (openaiKey ? null : 'OpenAI')
        : (apiKey ? null : 'MuAPI')
    if (missingKey) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: `Add your ${missingKey} API key in Settings to generate.`,
      })
      return
    }

    // Guard: block blob URLs from reaching generation
    const allAssets: PersonalizationAsset[] = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter(Boolean) as PersonalizationAsset[]

    const uploadingAssets = allAssets.filter((a) => a.uploadStatus === 'uploading')
    if (uploadingAssets.length > 0) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: `${uploadingAssets.length} asset(s) are still uploading. Please wait.`,
      })
      return
    }

    const failedAssets = allAssets.filter((a) => a.uploadStatus === 'error')
    if (failedAssets.length > 0) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: `${failedAssets.length} asset(s) failed to upload. Please retry or remove them.`,
      })
      return
    }

    const blobAssets = allAssets.filter((a) => typeof a.url === 'string' && a.url.startsWith('blob:'))
    if (blobAssets.length > 0) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: 'Some assets are not uploaded yet. Please wait for uploads to complete.',
      })
      return
    }

    setGeneration({ ...EMPTY_GENERATION_STATE, status: 'generating', progress: 5, progressMessage: 'Preparing assets...' })
    setResult(null)

    try {
      // Capabilities for the model this mode really calls (see optionsForGeneration).
      const modelOptions = optionsForGeneration(source, options, mode)
      const capabilities = resolveModelCapabilities(source, modelOptions)
      let resolved = resolveAssetsForModel(source, assets, mode, modelOptions, capabilities)

      // Generate from the video the user is looking at (a picked demo, an
      // upload, or a Full Body Recast) wherever a source video is used. Modes
      // that start from an image keep their image-to-video path.
      // The AI service fetches this itself: a site-relative demo path
      // ("/media/…") becomes a full address; browser-only blob: URLs are skipped.
      const chosenVideoUrl = previewVideo?.url && !previewVideo.url.startsWith('blob:')
        ? (/^https?:\/\//.test(previewVideo.url)
          ? previewVideo.url
          : previewVideo.url.startsWith('/') && typeof window !== 'undefined' ? new URL(previewVideo.url, window.location.origin).href : '')
        : ''
      if (
        chosenVideoUrl &&
        source.mediaType === 'video' &&
        (resolved.directInputs.video_url || mode === 'face_only' || mode === 'full_body')
      ) {
        resolved = { ...resolved, directInputs: { ...resolved.directInputs, video_url: chosenVideoUrl } }
      }

      const finalPrompt = promptState.edited || promptState.personalized || promptState.original

      // Pre-generate CTA end card if exact end-card handling is requested
      if (!burnInLayers && options.exactCtaHandling === 'final-end-card' && source.mediaType !== 'prompt-only') {
        setGeneration((prev) => ({ ...prev, progress: 3, progressMessage: 'Preparing branding assets...' }))
        const endCardUrl = await generateEndCardImage(clientForm as Record<string, unknown> | undefined, assets.primaryLogo?.file || assets.primaryLogo?.uploadedUrl || assets.primaryLogo?.url || null, apiKey)
        if (stale()) return
        if (endCardUrl) {
          resolved = {
            ...resolved,
            postProcessing: {
              ...resolved.postProcessing,
              endCard: endCardUrl,
            },
          }
        }
      }

      const project = {
        source,
        client: clientForm || {},
        assets,
        mode,
        personalizedPrompt: finalPrompt,
      }
      lastProjectRef.current = project

      const genResult = await runGeneration({
        source,
        client: clientForm || {},
        assets,
        resolved,
        prompt: finalPrompt,
        mode,
        options,
        apiKey,
        // Only the final-video render puts the source audio back on.
        restoresSourceAudio: burnInLayers,
        onProgress: (percent, message) => {
          if (stale()) return
          setGeneration((prev) => ({ ...prev, progress: percent, progressMessage: message }))
        },
      })
      if (stale()) return

      // The layers from the overlay editor (logo, headline, images, CTA, end
      // card — positions, timing and animation included) are rendered over the
      // generated video in this browser, exactly as previewed.
      let burned: { url: string; extension: string; mimeType: string; blob: Blob; fileName: string } | null = null
      let layersNote: string | null = null
      let exportWarning: string | null = null
      let soundExpected = false
      if (burnInLayers && genResult.type === 'video' && genResult.url) {
        setGeneration((prev) => ({ ...prev, progress: 88, progressMessage: 'Adding your layers to the video…' }))
        try {
          const { exportPersonalizedVideo, downloadWebExportBlob } = await import('./webExport')
          // Draw the layers at the generated clip's own length and shape.
          const clip = await readClipMetadata(genResult.url)
          // Without the clip's real size and length, layers would be drawn at a
          // guessed shape; fall back to branding without them instead.
          if (!clip) throw new Error('The clip length and shape could not be read.')
          const built = buildPreviewInput({
            source,
            previewSettings: fitSettingsToClip(previewSettings, clip),
            previewVideo: { url: genResult.url, poster: null, title: source.title, kind: 'source' },
            clientForm,
            assets,
          })
          // Full presenter comes back silent: "Keep the original video's
          // sound" puts the source video's audio under it. A selected Full
          // Body Recast is itself silent; its sound is its performance clip.
          const inputVideoUrl = (resolved.directInputs.video_url as string | undefined) || source.sourceMedia || null
          const selectedVideoSound = previewVideo?.audioUrl || null
          const keptSound = options.preserveAudio && !built.audioUrl
            ? (mode === 'full_body' ? selectedVideoSound || inputVideoUrl : selectedVideoSound)
            : null
          const inputProps = keptSound ? { ...built, audioUrl: keptSound } : built
          soundExpected = Boolean(inputProps.audioUrl) || (mode === 'full_body' && Boolean(options.preserveAudio))
          const exported = await exportPersonalizedVideo({
            inputProps,
            onProgress: (progress) => {
              const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
              setGeneration((prev) => ({ ...prev, progress: Math.max(88, Math.min(99, 88 + Math.round(percent / 9))), progressMessage: `Adding your layers to the video… ${percent}%` }))
            },
          })
          // The modal was closed (or reopened) meanwhile, or the export was cancelled by
          // closePersonalize(): stop before downloading, branding or writing a result.
          if (stale() || (!exported.ok && exported.reason === 'cancelled')) return
          if (exported.ok) {
            // e.g. no audio codec this browser can encode: the video is silent.
            exportWarning = exported.warning || null
            const fileName = `personalized-${Date.now().toString(36)}.${exported.extension}`
            downloadWebExportBlob(exported.blob, fileName)
            // The previous layered video (if any) is no longer shown.
            if (lastLayeredVideoUrlRef.current) URL.revokeObjectURL(lastLayeredVideoUrlRef.current)
            const url = URL.createObjectURL(exported.blob)
            lastLayeredVideoUrlRef.current = url
            burned = { url, extension: exported.extension, mimeType: exported.mimeType, blob: exported.blob, fileName }
          } else if (exported.reason !== 'cancelled') {
            layersNote = exported.error
          }
        } catch (error) {
          layersNote = error instanceof Error ? error.message : 'The layers could not be added in this browser.'
        }
      }

      // Without burned-in layers: deterministic post-processing (logo
      // overlay, CTA end card) as before.
      let postResult: Awaited<ReturnType<typeof applyPostProcessing>> = { finalUrl: genResult.url || '', originalUrl: genResult.url || '', applied: [] }
      if (!burned) {
        setGeneration((prev) => ({ ...prev, progress: 90, progressMessage: 'Applying branding...' }))
        let postProcessing = resolved.postProcessing
        // A layered run makes no end card up front (the layers carry the CTA);
        // when the layers could not be added, branding needs one like any run.
        if (burnInLayers && options.exactCtaHandling === 'final-end-card' && source.mediaType !== 'prompt-only' && !postProcessing.endCard) {
          try {
            const endCardUrl = await generateEndCardImage(
              clientForm as Record<string, unknown> | undefined,
              assets.primaryLogo?.file || assets.primaryLogo?.uploadedUrl || assets.primaryLogo?.url || null,
              apiKey,
            )
            if (stale()) return
            if (endCardUrl) postProcessing = { ...postProcessing, endCard: endCardUrl }
          } catch {
            // Branding still runs without the end card.
          }
        }
        postResult = await applyPostProcessing({
          generatedUrl: genResult.url || '',
          type: genResult.type as 'image' | 'video',
          postProcessing,
          apiKey,
        })
        if (stale()) return
      }

      const finalUrl = burned?.url || postResult.finalUrl || genResult.url || ''
      // The clip has none of the sound the run was meant to keep: either the
      // layered render (which adds it) didn't happen, or it succeeded without
      // audio because this browser can't encode any.
      const soundDroppedByExport = Boolean(burned && exportWarning && soundExpected)
      const soundMissing = Boolean(
        (burnInLayers && !burned && mode === 'full_body' && options.preserveAudio && genResult.type === 'video' && genResult.url)
        || soundDroppedByExport,
      )
      // Shared media and history keep a stored (non-blob) URL: the layered
      // video itself, saved to storage; if that fails, the generated clip.
      let storedUrl = finalUrl
      let layeredStored = false
      if (burned) {
        storedUrl = genResult.url || ''
        try {
          const stored = await uploadPersonalizationAsset('', {
            file: new File([burned.blob], burned.fileName, { type: burned.mimeType }),
          })
          if (stored?.durableUrl && /^https?:\/\//.test(stored.durableUrl)) {
            storedUrl = stored.durableUrl
            layeredStored = true
          }
        } catch {
          // History keeps the generated clip (without the layers).
        }
        if (stale()) return
      }
      // The layered video was made and downloaded, but storing it failed.
      const savedCopyMissingLayers = Boolean(burned && !layeredStored)
      const resultWithPostProcessing: GenerationResult = {
        ...genResult,
        url: finalUrl,
        metadata: {
          ...genResult.metadata,
          postProcessing: burned ? ['layers-burned-in'] : postResult.applied,
          postProcessingFailed: postResult.failed,
          originalUrl: postResult.originalUrl || genResult.url,
          postProcessingInput: resolved.postProcessing,
          ...(burned ? { layersBurnedIn: true, generatedUrl: genResult.url, storedUrl, container: burned.mimeType, extension: burned.extension } : {}),
          // What Publish sends: the stored layered video. If storing it failed,
          // nothing (the generated clip lacks the layers the user approved).
          // A full presenter clip made silent for "Keep the original video's
          // sound" only gets that sound back in the layered render; without it
          // the clip is silent, so it isn't offered as the finished video.
          // A clip that lacks the layers the customer approved is never offered for publishing.
          publishUrl: soundMissing || (burnInLayers && !burned && genResult.type === 'video') ? '' : burned ? (layeredStored ? storedUrl : '') : finalUrl,
          // Three independent outcomes, so one failing never reads as the others failing:
          //  generation (the AI clip), render (the approved layers added in this browser), cloudSave (the stored copy).
          exportStatus: {
            generation: 'ok',
            render: !burnInLayers || genResult.type !== 'video' ? 'not-needed' : burned ? 'ok' : 'failed',
            cloudSave: !burned ? 'not-needed' : layeredStored ? 'saved' : 'failed',
          },
          ...(soundMissing ? { soundMissing: true } : {}),
          ...(layersNote || soundMissing || exportWarning || savedCopyMissingLayers
            ? {
                layersNote: [
                  layersNote ? `Your on-video layers couldn't be added in this browser (${layersNote}).` : '',
                  savedCopyMissingLayers
                    ? "Your video with the layers was downloaded, but its saved copy couldn't be stored, so the saved copy doesn't include them. Create the final video again to save it."
                    : '',
                  soundDroppedByExport
                    ? "This browser couldn't add sound to the video, so it is silent. Create the final video again in Chrome or Edge to keep the sound."
                    : soundMissing
                      ? "The original video's sound couldn't be added either, so this clip is silent. Create the final video again in Chrome or Edge to add it."
                      : exportWarning || '',
                ].filter(Boolean).join(' '),
              }
            : {}),
          // Saved with the project so a restore shows the same notice.
          ...(burnInLayers && genResult.type === 'video' && genResult.url && !layeredStored ? { layersMissing: true } : {}),
        },
      }

      lastResultRef.current = resultWithPostProcessing
      setResult(resultWithPostProcessing)
      setResultTab('prompt')
      setGeneration({ ...EMPTY_GENERATION_STATE, status: 'complete', progress: 100, progressMessage: 'Complete' })

      // Register shared media
      const entry = registerSharedMedia({
        originStudio: originStudioRef.current || 'demo-personalization',
        sourceType: source.sourceType,
        sourceDemoId: source.id,
        sourceMedia: source.sourceMedia,
        personalizationMode: mode || undefined,
        model: resultWithPostProcessing.metadata?.model as string | undefined,
        originalPrompt: promptState.original,
        personalizedPrompt: finalPrompt,
        identityAssetIds: assets.identities.map((i) => i.id),
        logoAssetIds: assets.logos.map((l) => l.id),
        productAssetIds: assets.products.map((p) => p.id),
        brandReferenceAssetIds: assets.brandReferences.map((b) => b.id),
        firstFrameAssetId: assets.firstFrame?.id || null,
        lastFrameAssetId: assets.lastFrame?.id || null,
        outputUrls: resultWithPostProcessing.urls || (storedUrl ? [storedUrl] : []),
        outputType: resultWithPostProcessing.type,
        clientId: selectedClientId || undefined,
        ...(burnInLayers && genResult.type === 'video' && genResult.url && !layeredStored ? { layersMissing: true } : {}),
      })
      setSharedMediaEntries(getSharedMedia())

      // Also persist to Supabase server-side so history survives
      // across devices and browser clears. Best-effort: do not block UI.
      registerSupabaseSharedMedia({
        originStudio: originStudioRef.current || 'demo-personalization',
        sourceType: source.sourceType,
        sourceDemoId: source.id,
         sourceDemoSlug: (source as { slug?: string }).slug ?? null,
        sourceMedia: source.sourceMedia,
        sourceUrl: source.sourceUrl,
        personalizationMode: mode || null,
        model: resultWithPostProcessing.metadata?.model as string | undefined,
        originalPrompt: promptState.original,
        personalizedPrompt: finalPrompt,
        identityAssetIds: assets.identities.map((i) => i.id),
        logoAssetIds: assets.logos.map((l) => l.id),
        productAssetIds: assets.products.map((p) => p.id),
        brandReferenceAssetIds: assets.brandReferences.map((b) => b.id),
        firstFrameAssetId: assets.firstFrame?.id || null,
        lastFrameAssetId: assets.lastFrame?.id || null,
        outputUrls: resultWithPostProcessing.urls || (storedUrl ? [storedUrl] : []),
        outputType: resultWithPostProcessing.type,
        clientId: selectedClientId || undefined,
      }).catch(() => {
        // Supabase persistence is best-effort; localStorage remains the source of truth
      })

      // Hand the finished result back to whoever opened the modal (studio
      // hand-off) and, when a return destination was requested, to that studio.
      completeRun(resultWithPostProcessing, finalPrompt)
    } catch (error) {
      if (stale()) return
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Generation failed',
        failedStage: 'generation',
      })
    }
  }, [source, apiKey, openaiKey, assets, mode, genOptions, promptState, clientForm, selectedClientId, completeRun, previewVideo, previewSettings])

  const generate = useCallback(() => {
    lastRunWasFinalVideoRef.current = false
    return runGenerate()
  }, [runGenerate])

  // Retry / Generate Again repeat the same kind of run: a final video goes
  // through createFinalVideo again, so its layers (or branded render) are kept.
  const retry = useCallback(async () => {
    if (lastRunWasFinalVideoRef.current && createFinalVideoRef.current) await createFinalVideoRef.current()
    else await generate()
  }, [generate])

  const generateAgain = useCallback(async () => {
    if (lastRunWasFinalVideoRef.current && createFinalVideoRef.current) await createFinalVideoRef.current()
    else await generate()
  }, [generate])

  const retryBranding = useCallback(async () => {
    const lastResult = lastResultRef.current
    const lastProject = lastProjectRef.current
    if (!lastResult || !lastProject || !apiKey) return

    const originalUrl = lastResult.metadata?.originalUrl as string | undefined
    const postProcessingInput = (lastResult.metadata?.postProcessingInput || null) as Record<string, unknown> | null
    if (!originalUrl || !postProcessingInput) return

    setGeneration({ ...EMPTY_GENERATION_STATE, status: 'generating', progress: 85, progressMessage: 'Retrying branding...' })

    try {
      const postResult = await applyPostProcessing({
        generatedUrl: originalUrl,
        type: lastResult.type as 'image' | 'video',
        postProcessing: postProcessingInput,
        apiKey,
      })

      const finalUrl = postResult.finalUrl || originalUrl
      const metadata: Record<string, unknown> = {
        ...(lastResult.metadata || {}),
        postProcessing: postResult.applied,
        postProcessingFailed: postResult.failed,
        originalUrl: postResult.originalUrl,
        postProcessingInput,
        // Publish sends the newly branded video, not the earlier output
        // (unless that video is missing its sound or its on-video layers; see runGenerate).
        // Retrying the branding never renders the layers, so a clip that lacks them stays unpublishable.
        publishUrl: lastResult.metadata?.soundMissing === true || lastResult.metadata?.layersMissing === true ? '' : finalUrl,
      }
      const updatedResult: GenerationResult = {
        ...lastResult,
        url: finalUrl,
        metadata,
      }

      lastResultRef.current = updatedResult
      setResult(updatedResult)
      setGeneration({ ...EMPTY_GENERATION_STATE, status: 'complete', progress: 100, progressMessage: 'Branding updated' })
    } catch (error) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Branding retry failed',
      })
    }
  }, [apiKey])

  // ── Guided Simple Mode + free preview actions ──────────────────────────────
  //
  // The preview is entirely local: these actions only manipulate the
  // PersonalizationPreviewSettings composition. `createFinalVideo` is the only
  // place that hands off to the existing generate() pipeline.

  const setGuidedStep = useCallback((step: GuidedStep) => {
    const clamped = Math.min(4, Math.max(1, Math.round(step))) as GuidedStep
    setGuidedStepState(clamped)
  }, [])

  const setPreviewLayout = useCallback((layout: PreviewLayoutId) => {
    markSessionStarted()
    setPreviewSettings((prev) => applyLayoutPreset(prev, layout, previewSeedRef.current))
  }, [])

  /**
   * Applies a registered Remotion design to the preview, or clears the applied
   * design when given null.
   *
   * The design replaces the preview's layer list with its own `design` layer;
   * brand colours, aspect ratio, fps and duration are untouched. An unknown
   * design id is refused and reported through `remotionDesignError` instead of
   * silently doing nothing.
   */
  const setRemotionDesign = useCallback((designId: string | null) => {
    markSessionStarted()
    if (designId === null) {
      remotionDesignErrorIdRef.current = null
      setRemotionDesignError(null)
      setPreviewSettings((prev) => resetPreviewDesign(prev, previewSeedRef.current))
      return
    }
    if (!getRemotionDesignTemplate(designId)) {
      remotionDesignErrorIdRef.current = designId
      setRemotionDesignError(`That design is not available.`)
      return
    }
    remotionDesignErrorIdRef.current = null
    setRemotionDesignError(null)
    setPreviewSettings((prev) => applyDesignTemplate(prev, designId, previewSeedRef.current))
  }, [])

  const addRemotionDesign = useCallback((designId: string) => {
    markSessionStarted()
    if (!getRemotionDesignTemplate(designId)) {
      remotionDesignErrorIdRef.current = designId
      setRemotionDesignError(`That design is not available.`)
      return
    }
    remotionDesignErrorIdRef.current = null
    setRemotionDesignError(null)
    setPreviewSettings((prev) => addDesignTemplate(prev, designId, previewSeedRef.current))
  }, [])

  const removePreviewDesignLayer = useCallback((layerId: string) => {
    markSessionStarted()
    setPreviewSettings((prev) => removeDesignLayer(prev, layerId))
  }, [])

  // ── Undo / redo for edits to the preview ─────────────────────────────────
  // Every change to the preview settings (a drag, a text edit, applying or replacing a design…) is one history
  // step; rapid-fire changes (a drag, typing) within 600 ms coalesce so one Undo takes back the whole gesture.
  const historyRef = useRef<{ past: PersonalizationPreviewSettings[]; future: PersonalizationPreviewSettings[]; last: PersonalizationPreviewSettings | null; applying: boolean; lastPush: number; sourceId: string | null }>(
    { past: [], future: [], last: null, applying: false, lastPush: 0, sourceId: null },
  )
  const [, setHistoryTick] = useState(0)
  useEffect(() => {
    const h = historyRef.current
    const sourceId = source?.id ?? null
    if (h.sourceId !== sourceId) { h.past = []; h.future = []; h.last = previewSettings; h.sourceId = sourceId; setHistoryTick((t) => t + 1); return }
    if (h.applying) { h.applying = false; h.last = previewSettings; return }
    if (h.last === null || h.last === previewSettings) { h.last = previewSettings; return }
    const now = Date.now()
    if (now - h.lastPush > 600) {
      h.past.push(h.last)
      if (h.past.length > 50) h.past.shift()
    }
    h.lastPush = now
    h.future = []
    h.last = previewSettings
    setHistoryTick((t) => t + 1)
  }, [previewSettings, source?.id])
  const undoPreview = useCallback(() => {
    const h = historyRef.current
    const prev = h.past.pop()
    if (!prev || !h.last) return
    h.future.push(h.last)
    h.applying = true
    h.lastPush = 0
    setPreviewSettings(prev)
    setHistoryTick((t) => t + 1)
  }, [])
  const redoPreview = useCallback(() => {
    const h = historyRef.current
    const next = h.future.pop()
    if (!next || !h.last) return
    h.past.push(h.last)
    h.applying = true
    h.lastPush = 0
    setPreviewSettings(next)
    setHistoryTick((t) => t + 1)
  }, [])

  const updatePreviewLayer = useCallback((layerId: string, patch: Partial<PreviewLayer>) => {
    markSessionStarted()
    const touchesGeometry = 'x' in patch || 'y' in patch || 'scale' in patch
    setPreviewSettings((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => {
        if (layer.id !== layerId) return layer
        // A locked layer does not move or resize until it is unlocked.
        if (layer.locked && touchesGeometry && patch.locked !== false) return layer
        // A geometry edit through here is the customer's own: the placement
        // engine must never move the layer on its own afterwards.
        const source = touchesGeometry && patch.placementSource === undefined ? { placementSource: 'manual' as const } : {}
        return clampPreviewLayer({ ...layer, ...patch, ...source })
      }),
    }))
  }, [])

  // Measure each ASSIGNED image once (aspect ratio, transparent corners, an existing frame)
  // and keep the result in the shared preview settings, so the gallery card, editor,
  // preview and export all style the same image identically. Files are never modified.
  const measuredImageUrlsRef = useRef<Set<string>>(new Set())
  const assignedImageUrlsKey = [
    assets.primaryLogo?.uploadedUrl || assets.primaryLogo?.url,
    assets.products?.[0]?.uploadedUrl || assets.products?.[0]?.url,
    assets.products?.[1]?.uploadedUrl || assets.products?.[1]?.url,
    ...previewSettings.layers.map((l) => l.imageUrl),
  ]
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .join('|')
  useEffect(() => {
    const urls = (assignedImageUrlsKey ? assignedImageUrlsKey.split('|') : []).filter(
      (u) => !measuredImageUrlsRef.current.has(u) && !previewSettings.imageHints?.[u],
    )
    if (!urls.length) return
    urls.forEach((u) => measuredImageUrlsRef.current.add(u))
    // No stale-result guard: the merge is idempotent, and a URL is only measured once.
    void measureImageHints(urls).then((measured) => {
      if (!Object.keys(measured).length) return
      setPreviewSettings((prev) => ({ ...prev, imageHints: { ...(prev.imageHints ?? {}), ...measured } }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedImageUrlsKey])

  const setPreviewLayerLocked = useCallback((layerId: string, locked: boolean) => {
    markSessionStarted()
    setPreviewSettings((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => {
        if (layer.id !== layerId) return layer
        const next = { ...layer }
        if (locked) next.locked = true
        else delete next.locked
        return next
      }),
    }))
  }, [])

  const setPreviewProtectedZones = useCallback((zones: ProtectedZone[]) => {
    markSessionStarted()
    setPreviewSettings((prev) => {
      const next = { ...prev }
      if (zones.length) next.protectedZones = zones
      else delete next.protectedZones
      return next
    })
  }, [])

  const applyPreviewPlacements = useCallback(
    (items: { layerId: string; x: number; y: number; scale?: number }[], options?: { overrideManual?: boolean }) => {
      markSessionStarted()
      setPreviewSettings((prev) => ({
        ...prev,
        layers: prev.layers.map((layer) => {
          const item = items.find((i) => i.layerId === layer.id)
          if (!item || layer.locked) return layer
          if (layer.placementSource === 'manual' && !options?.overrideManual) return layer
          return clampPreviewLayer({
            ...layer,
            x: item.x,
            y: item.y,
            scale: item.scale ?? layer.scale,
            placementSource: 'recommended',
          })
        }),
      }))
    },
    [],
  )

  const updatePreviewBrandColors = useCallback((patch: Partial<PreviewBrandColors>) => {
    markSessionStarted()
    setPreviewSettings((prev) => ({
      ...prev,
      brandColors: { ...prev.brandColors, ...patch },
    }))
  }, [])

  const updatePreviewComposition = useCallback(
    (patch: Partial<Pick<PersonalizationPreviewSettings, 'aspectRatio' | 'fps' | 'durationInFrames' | 'showEndCard'>>) => {
      markSessionStarted()
      setPreviewSettings((prev) => {
        let next = { ...prev, ...patch }
        if (patch.aspectRatio) {
          const dimensions = getCompositionDimensions(patch.aspectRatio)
          next.width = dimensions.width
          next.height = dimensions.height
          // Untouched layout layers follow the new shape's default geometry;
          // anything the customer moved or resized is left exactly where it is.
          next = reflowLayersForAspect(next, prev.aspectRatio, patch.aspectRatio)
        }
        return next
      })
    },
    [],
  )

  const resetPreviewLayout = useCallback(() => {
    // "Restore default layout" must undo per-layer position/scale/visibility
    // edits, not only re-seed layers that are missing from the layout. Brand
    // content stays — it is re-derived from the form/asset seed below.
    markSessionStarted()
    setPreviewSettings((prev) => resetLayoutToDefaults(prev, prev.layout, previewSeedRef.current))
  }, [markSessionStarted])

  // The user-facing setters for the saved project's other fields: each change
  // ends the fresh start, like the preview edits above.
  const chooseOutputType = useCallback((type: OutputType) => {
    markSessionStarted()
    setOutputType(type)
  }, [markSessionStarted])

  const chooseMode = useCallback((next: VideoPersonalizationMode | ImagePersonalizationMode | null) => {
    markSessionStarted()
    setMode(next)
  }, [markSessionStarted])

  const creationMethod: 'browser' | 'ai' = aiChosen || chooseFinalOutputPath({ personalizationMode: mode || null }) === 'ai-generation' ? 'ai' : 'browser'
  const setCreationMethod = useCallback((method: 'browser' | 'ai') => {
    markSessionStarted()
    if (method === 'browser') { setAiChosen(false); setMode(null) } else setAiChosen(true)
  }, [markSessionStarted])

  const updateGenOptions = useCallback((patch: Partial<GenerationOptions>) => {
    markSessionStarted()
    setGenOptions((prev) => ({ ...prev, ...patch }))
  }, [markSessionStarted])

  const approvePersonalization = useCallback(() => {
    setApprovalStale(false)
    setPreviewApproved(true)
    // Write the approved preview through immediately instead of waiting for the
    // debounce window, so the durable project row matches what was approved.
    // Anonymous sessions keep this in memory only.
    if (!source || access !== 'authenticated') return
    projectPersistence.current.flush(buildProjectPayload())
  }, [source, access, buildProjectPayload])

  // An approval covers what was on screen then: changing the preview, the
  // video, the business details or the assets afterwards clears it, so the
  // render never silently uses edits that weren't approved.
  const approvalSignature = useMemo(() => JSON.stringify({
    settings: previewSettings,
    video: previewVideo?.url || null,
    client: [clientForm.businessName, clientForm.name, clientForm.website, clientForm.phone, clientForm.offer, clientForm.ctaHeadline, clientForm.callToAction, clientForm.productService],
    // The image too, not just the id: an edit replaces the image in place.
    // (A blob: URL is an upload in progress; it can't be rendered yet anyway.)
    assets: [assets.primaryLogo, assets.primaryIdentity, ...assets.logos, ...assets.products].map((a) => (
      a ? `${a.id}|${a.url?.startsWith('blob:') ? 'pending' : a.url}` : null
    )),
  }), [previewSettings, previewVideo?.url, clientForm, assets.primaryLogo, assets.primaryIdentity, assets.logos, assets.products])
  const approvedSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    if (!previewApproved) {
      approvedSignatureRef.current = null
      return
    }
    if (approvedSignatureRef.current === null) {
      approvedSignatureRef.current = approvalSignature
      return
    }
    if (approvedSignatureRef.current !== approvalSignature) {
      setPreviewApproved(false)
      setApprovalStale(true)
    }
  }, [previewApproved, approvalSignature])

  const createFinalVideo = useCallback(async (options?: { approveNow?: boolean }) => {
    lastRunWasFinalVideoRef.current = true
    const approved = previewApproved || options?.approveNow === true
    // Overlay-only personalizations (branding on the EXISTING selected video)
    // export through the local Remotion render pipeline — never through MuAPI
    // generation. Personalizations that genuinely need AI-generated imagery or
    // video keep the existing generate() flow exactly.
    if (access !== 'authenticated' || !source) return
    const finalPath = chooseFinalOutputPath({ personalizationMode: mode || null })

    if (finalPath === 'ai-generation') {
      const hasLogo = previewSettings.layers.some(
        (layer) => layer.kind === 'logo' && layer.visible && Boolean(layer.imageUrl || previewSeed.logoUrl),
      )
      const hasCta = previewSettings.layers.some((layer) => layer.kind === 'cta' && layer.visible)

      // The approved preview's settings for this run. They're also saved to
      // the options, but passed directly: a setGenOptions in the same tick
      // isn't visible to generate yet.
      // What the user chose, limited to what this mode's model can make.
      const fitted = fitToModel(
        resolveModelCapabilities(source, optionsForGeneration(source, genOptions, mode)),
        { aspectRatio: previewSettings.aspectRatio, durationSeconds: Math.max(1, Math.round(previewSettings.durationInFrames / previewSettings.fps)) },
        genOptions.aspectRatio,
      )
      const finalOptions: Partial<GenerationOptions> = {
        aspectRatio: fitted.aspectRatio,
        // The recast model makes 4–30 s clips; ask for what it can make.
        duration: mode === 'full_body' ? clampRecastDuration(fitted.duration) : fitted.duration,
        ...(hasLogo ? { exactLogoHandling: 'final-overlay' as const } : {}),
        ...(hasCta ? { exactCtaHandling: 'final-end-card' as const } : {}),
      }
      setGenOptions((prev) => ({ ...prev, ...finalOptions }))
      const finalRun: GenerateOverrides = { options: finalOptions, burnInLayers: true }

      // A selected preview video replaces the source media. The source update and
      // generate() cannot share a tick (generate would read the stale source), so
      // the pending ref lets the effect below run generate on the next commit.
      if (previewVideo && source && previewVideo.url !== source.sourceMedia) {
        setSource((prev) =>
          prev
            ? {
                ...prev,
                sourceMedia: previewVideo.url,
                poster: previewVideo.poster ?? prev.poster,
                title: previewVideo.title || prev.title,
              }
            : prev,
        )
        pendingFinalGenerateRef.current = finalRun
        return
      }

      await runGenerate(finalRun)
      return
    }

    // ── branded-render: in-browser render of the approved composition ────────
    //
    // The overlay-only final video is produced entirely in the browser by
    // @remotion/web-renderer — no server, no worker, no storage upload. The
    // flow requires an approved preview first, and the approved state is
    // snapshotted at call time so later edits cannot leak into the export.
    if (!approved) {
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: 'Approve the preview first so we render exactly the layout you signed off on, then render your branded video.',
      })
      return
    }

    if (options?.approveNow && !previewApproved) { setApprovalStale(false); setPreviewApproved(true) }

    // Snapshot the approved composition: the user may keep editing while the
    // render runs, and the export must stay the approved one.
    const frozenSettings = previewSettings
    const frozenVideo = previewVideo
    const frozenClientForm = clientForm
    const frozenAssets = assets
    const frozenSource = source
    const inputProps = buildPreviewInput({
      source: frozenSource,
      previewSettings: frozenSettings,
      previewVideo: frozenVideo,
      clientForm: frozenClientForm,
      assets: frozenAssets,
    })

    setGeneration({
      ...EMPTY_GENERATION_STATE,
      status: 'generating',
      progress: 5,
      progressMessage: 'Preparing your branded video…',
    })
    setResult(null)
    setResultTab('prompt')

    // A render started in one modal session must never report into the next:
    // closePersonalize() moves restoreSessionRef on (and cancels the export).
    const session = restoreSessionRef.current
    const stale = () => restoreSessionRef.current !== session

    try {
      // Loaded lazily so the renderer never lands in the main bundle.
      const { exportPersonalizedVideo, downloadWebExportBlob } = await import('./webExport')
      if (stale()) return

      const exported = await exportPersonalizedVideo({
        inputProps,
        onProgress: (progress) => {
          if (stale()) return
          // Real render progress from the web renderer, mapped into the
          // existing generation state (10..95%) so the UI stays a plain bar.
          const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
          setGeneration((prev) => ({
            ...prev,
            status: 'processing',
            progress: Math.max(10, Math.min(95, percent)),
            progressMessage: `Rendering your branded video… ${percent}%`,
          }))
        },
      })

      if (stale()) return

      if (!exported.ok) {
        if (exported.reason === 'cancelled') {
          setGeneration({ ...EMPTY_GENERATION_STATE, status: 'idle' })
          return
        }
        setGeneration({
          ...EMPTY_GENERATION_STATE,
          status: 'error',
          errorMessage: exported.error,
        })
        return
      }

      if (exported.warning) {
        // Non-fatal: e.g. the browser could not encode an audio codec.
        setGeneration((prev) => ({
          ...prev,
          progressMessage: `${prev.progressMessage || 'Rendering your branded video…'} ${exported.warning}`,
        }))
      }

      const fileName = `personalized-${Date.now().toString(36)}.${exported.extension}`
      const objectUrl = URL.createObjectURL(exported.blob)

      // Direct download: the file is handed to the user's device immediately,
      // so there is no storage cap and nothing is retained on a server.
      downloadWebExportBlob(exported.blob, fileName)

      const brandedResult: GenerationResult = {
        type: 'video',
        url: objectUrl,
        metadata: {
          source: 'branded-render',
          compositionId: 'PersonalizationComposition',
          container: exported.mimeType,
          extension: exported.extension,
          fileName,
          ...(exported.warning ? { warning: exported.warning } : {}),
        },
      }
      lastResultRef.current = brandedResult
      setResult(brandedResult)
      setResultTab('videos')
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'complete',
        progress: 100,
        progressMessage: 'Branded video ready',
      })
      // Hand the rendered result back to whoever opened the modal (studio
      // hand-off) and, when a return destination was requested, to that studio.
      completeRun(brandedResult, promptState.edited || promptState.personalized || promptState.original)
    } catch (error) {
      if (stale()) return
      setGeneration({
        ...EMPTY_GENERATION_STATE,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Branded render failed',
      })
    }
  }, [previewSettings, previewSeed, previewVideo, source, runGenerate, mode, access, apiKey, clientForm, assets, previewApproved, promptState, completeRun, genOptions])
  createFinalVideoRef.current = createFinalVideo

  const cancelExport = useCallback(() => {
    cancelActiveExport()
  }, [])

  const setPreviewAudio = useCallback(async (file: File) => {
    markSessionStarted()
    setPreviewAudioError(null)

    const blobUrl = URL.createObjectURL(file)
    const name = file.name
    const audioAsset: PersonalizationAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'audio_reference',
      name,
      url: blobUrl,
      isPrimary: false,
      mimeType: file.type || '',
      createdAt: new Date().toISOString(),
      uploadStatus: 'local',
      uploadError: null,
      file,
    }

    setAssets((prev) => ({ ...prev, audio: [...prev.audio, audioAsset] }))
    setPreviewSettings((prev) => ({ ...prev, audio: { url: blobUrl, name } }))

    // Register ownership of the preview blob URL so it can be released on
    // upload completion or removal.
    registerOwnedBlobUrl(audioAsset.id, blobUrl)

    try {
      const { url: durableUrl } = await uploadPersonalizationAsset(apiKey, { file })
      setAssets((prev) => ({
        ...prev,
        audio: prev.audio.map((a) =>
          a.id === audioAsset.id
            ? { ...a, uploadedUrl: durableUrl, uploadStatus: 'ready' as const, url: durableUrl }
            : a,
        ),
      }))
      // Only swap the preview to the durable URL if this track is still the
      // selected one: removing it, choosing another track, or opening another
      // source while the upload ran must not bring it back.
      setPreviewSettings((prev) =>
        prev.audio?.url === blobUrl ? { ...prev, audio: { url: durableUrl, name } } : prev,
      )
      releaseJobBlobUrls(audioAsset.id, audioAsset, { superseded: [blobUrl] })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      setPreviewAudioError(message)
      setAssets((prev) => ({
        ...prev,
        audio: prev.audio.map((a) =>
          a.id === audioAsset.id
            ? { ...a, uploadStatus: 'error' as const, uploadError: message }
            : a,
        ),
      }))
    }
  }, [apiKey, registerOwnedBlobUrl, releaseJobBlobUrls])

  const removePreviewAudio = useCallback(() => {
    setAssets((prev) => {
      prev.audio.forEach((a) => releaseJobBlobUrls(a.id, a, { dropOriginal: true }))
      return { ...prev, audio: [] }
    })
    setPreviewSettings((prev) => ({ ...prev, audio: null }))
    setPreviewAudioError(null)
  }, [releaseJobBlobUrls])

  // Hands off to the existing generate() path once the patched source (selected
  // preview video) has committed.
  useEffect(() => {
    const pending = pendingFinalGenerateRef.current
    if (!pending) return
    pendingFinalGenerateRef.current = null
    void runGenerate(pending)
  }, [runGenerate])

  // ── Result actions ─────────────────────────────────────────────────────────

  const editInImageStudio = useCallback(async () => {
    if (!lastResultRef.current || !lastProjectRef.current || lastResultRef.current.type !== 'image') return
    const result = lastResultRef.current
    const project = lastProjectRef.current
    const prompt = result.prompt || project.personalizedPrompt || project.source.originalPrompt || ''
    let safeUrl = result.url && !result.url.startsWith('blob:') ? result.url : (project.source.sourceMedia && !project.source.sourceMedia.startsWith('blob:') ? project.source.sourceMedia : null)

    if (!safeUrl) return

    // A generated image can come back as a base64 data URL. The studios only
    // accept http(s) references, so store the bytes and hand off that URL.
    if (safeUrl.startsWith('data:')) {
      try {
        const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(safeUrl)
        if (!match) return
        const type = match[1] || 'image/png'
        const raw = match[2] ? atob(match[3]) : decodeURIComponent(match[3])
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'
        const file = new File([bytes], `personalized-image.${ext}`, { type })
        const { url } = await uploadPersonalizationAsset(apiKey, { file })
        if (!url) return
        safeUrl = url
      } catch {
        return
      }
    }

    const handoff = {
      version: 1 as const,
      target: 'image' as const,
      from: 'demo-personalization' as const,
      projectName: project.source.title || 'Personalized Image',
      aspectRatio: (project.source.aspectRatio as '16:9' | '9:16' | '1:1' | null) || '1:1',
      episodeDuration: 0,
      videoUrl: null,
      referenceImageUrl: safeUrl,
      characterNames: project.assets.identities.map((i) => i.name).filter(Boolean),
      shots: prompt
        ? [{ scene: project.source.title || 'Personalized', prompt, duration: 0, characterNames: [] }]
        : [],
      combinedPrompt: prompt,
      firstFrameUrl: safeUrl,
      createdAt: new Date().toISOString(),
    }

    writeHandoff(handoff)
    const readBack = readHandoff('image')
    if (!readBack || readBack.referenceImageUrl !== handoff.referenceImageUrl || readBack.projectName !== handoff.projectName) return

    closePersonalize()
    router.push('/studio/image')
  }, [apiKey, closePersonalize, router])

  const editInVideoStudio = useCallback(() => {
    if (!lastResultRef.current || !lastProjectRef.current || lastResultRef.current.type !== 'video') return
    const result = lastResultRef.current
    const project = lastProjectRef.current
    const prompt = result.prompt || project.personalizedPrompt || project.source.originalPrompt || ''
    const videoUrl = studioVideoUrl(result) || null
    const referenceImageUrl = getGenerationAssetUrl(project.assets.primaryIdentity)
    const firstFrameUrl = getGenerationAssetUrl(project.assets.firstFrame)

    // A replacement identity is optional (Recreate mode has none), so only the
    // finished video is required; the studio opens with whichever reference exists.
    if (!videoUrl) return

    const handoff = {
      version: 1 as const,
      target: 'video' as const,
      from: 'demo-personalization' as const,
      projectName: project.source.title || 'Personalized Video',
      aspectRatio: (project.source.aspectRatio as '16:9' | '9:16' | '1:1' | null) || '16:9',
      episodeDuration: project.source.duration || 0,
      videoUrl,
      referenceImageUrl: referenceImageUrl || firstFrameUrl || null,
      characterNames: project.assets.identities.map((i) => i.name).filter(Boolean),
      shots: prompt
        ? [{ scene: project.source.title || 'Personalized', prompt, duration: project.source.duration || 0, characterNames: [] }]
        : [],
      combinedPrompt: prompt,
      firstFrameUrl: firstFrameUrl || null,
      createdAt: new Date().toISOString(),
    }

    writeHandoff(handoff)
    const readBack = readHandoff('video')
    if (!readBack || readBack.videoUrl !== handoff.videoUrl || readBack.projectName !== handoff.projectName) return

    closePersonalize()
    router.push('/studio/video')
  }, [closePersonalize, router])

  // Select a Motion Studio recipe from the full catalog (124 cards / 150
  // shots / 10 categories) as the wizard's preview source. The recipe is
  // stored both in dedicated state (so the browser can re-render the in-modal
  // preview across reloads) and as a `PreviewVideoRef` with the new
  // `'motion-template'` kind (so the existing preview pipeline, the before/
  // after pane and the export path all see it without further wiring).
  const useMotionTemplate = useCallback((template: MotionTemplate) => {
    if (!template || !template.componentName) return
    markSessionStarted()
    setMotionTemplate(template)
    // `template.preview` is the real ShotCraft MP4 clip (an absolute URL);
    // `template.poster` is the optional still frame. They are distinct
    // assets — building the poster from `preview` would hand the pipeline an
    // MP4 as a poster image.
    const clip = template.preview || ''
    const poster = template.poster
      ? template.poster.startsWith('http://') || template.poster.startsWith('https://')
        ? template.poster
        : template.poster.startsWith('/')
          ? template.poster
          : `/${template.poster}`
      : null
    setPreviewVideo({
      url: clip,
      poster,
      title: template.nameEn ? motionTemplateTitle(template) : template.name,
      kind: 'motion-template',
      demoId: undefined,
      templateId: template.componentName,
      templateSlug: template.slug,
      sourceRepo: template.sourceRepo,
    })
  }, [])

  // Hand the selected Motion Studio recipe off to the canonical
  // `/studio/motion-studio` route so the full editing + export surface can
  // take over. The query param follows the existing
  // `?template={sourceRepo}|{slug}` contract consumed by
  // `app/studio/[[...slug]]/page.js` — passing `motion-studio|{componentName}`
  // is the canonical way to identify a recipe in the studio.
  const launchMotionTemplate = useCallback((template: MotionTemplate) => {
    if (!template || !template.componentName) return
    setMotionTemplate(template)
    const search = new URLSearchParams()
    search.set('template', `${template.sourceRepo}|${template.componentName}`)
    closePersonalize()
    router.push(`/studio/motion-director?${search.toString()}`)
  }, [closePersonalize, router])

  const publish = useCallback(() => {
    if (!lastResultRef.current?.url) return
    if (!socialPublish) return
    const result = lastResultRef.current
    const project = lastProjectRef.current
    // Never hand a browser-only blob: URL to the publishing service.
    const mediaUrl = publishableUrl(result)
    if (!mediaUrl) return

    socialPublish.openPublish({
      mediaUrl,
      mediaType: result.type === 'video' ? 'video' : 'image',
      title: project?.source?.title || 'Personalized content',
      caption: result.prompt || project?.personalizedPrompt || project?.source?.originalPrompt || '',
    })
  }, [socialPublish])

  const download = useCallback(() => {
    if (!lastResultRef.current?.url) return
    const link = document.createElement('a')
    link.href = lastResultRef.current.url
    link.download = `personalized-${lastResultRef.current.type}-${Date.now()}.${lastResultRef.current.type === 'video' ? 'mp4' : 'png'}`
    link.click()
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  const ctxValue: DemoPersonalizeContextValue = {
    // Modal
    isOpen,
    source,
    sourceTypeLabel,
    openPersonalize,
    closePersonalize,

    // Client
    clients,
    selectedClientId,
    clientForm,
    selectClient,
    createClient: createClientRecord,
    saveClient,
    updateClient,
    deleteClient,
    updateClientForm,

    // Saved client assets
    savedClientAssets,
    savedAssetLibraryTab,
    setSavedAssetLibraryTab,
    useSavedClient,
    deleteSavedClient,
    selectSavedAsset,
    setPrimarySavedAsset,
    removeSavedAsset,

    // Access mode + automated discovery workflow
    access,
    runDiscoveryWorkflow,

    // Assets
    assets,
    addIdentityFiles,
    addIdentityUrl,
    removeIdentity,
    setPrimaryIdentity,
    addLogoFiles,
    addLogoUrl,
    removeLogo,
    setPrimaryLogo,
    addProductFiles,
    addProductUrl,
    removeProduct,
    addBrandReferenceFiles,
    addBrandReferenceUrl,
    removeBrandReference,
    setFirstFrameFile,
    setFirstFrameUrl,
    removeFirstFrame,
    setLastFrameFile,
    setLastFrameUrl,
    removeLastFrame,
    setCtaGraphicFile,
    setCtaGraphicUrl,
    removeCtaGraphic,
    retryAssetUpload,
    applyEditedPersonalizationAsset,
    applyEditedSavedClientAsset,

    // Discovered assets
    discoveredAssets,
    discoveryStatus,
    discoveryError,
    setDiscoveryError,
    importConfirmation,
    setDiscoveredAssets,
    toggleDiscoveredAssetSelection,
    rejectDiscoveredAsset,
    restoreDiscoveredAsset,
    updateDiscoveredAssetCategory,
    removeDiscoveredAssetFromSection,
    moveDiscoveredAssetToSection,
    revertDiscoveredAssetEdit,
    autoCutout,
    selectRecommendedDiscoveredAssets,
    importDiscoveredAssets,
    cancelDiscovery,
    discoverAssets,
    visionStatus,
    visionError,
    analyzeDiscoveredAssets,
    // Library asset actions
    moveLibraryAssetToSection,
    removeLibraryAssetFromSection,
    deleteLibraryAsset,
    revertLibraryAssetToOriginal,

    // Business search
    businessSearchMode,
    businessSearchResults,
    businessSearchError,
    businessSearchQuery,
    selectedBusiness,
    businessResearch,
    findBusinesses,
    selectBusiness,
    autoFilledKeys,
    businessLoadSummary,
    resolveBusinessWebsite,
    websiteLookup,
    researchBusiness,
    clearBusinessSearch,
    setBusinessSearchMode,

    // Prompt
    promptState,
    personalizePrompt: personalizePromptFn,
    updatePersonalizedPrompt,
    resetPrompt,

    // Output / mode / options
    outputType,
    setOutputType: chooseOutputType,
    mode,
    setMode: chooseMode,
    creationMethod,
    setCreationMethod,
    genOptions,
    updateGenOptions,
    consent,
    setConsent,

    // Generation
    generate,
    retry,
    generateAgain,
    retryBranding,
    generation,

    // Result
    result,
    resultTab,
    setResultTab,
    editInImageStudio,
    editInVideoStudio,
    publish,
    download,

    // Shared media
    sharedMediaEntries,
    eligibility,

    // Project restore (Phase 14)
    loadedProject,
    restoring,
    resumableProject,
    resumeLastProject,
    dismissResumableProject,

    // Guided Simple Mode + free Remotion preview
    viewMode,
    setViewMode,
    advancedTab,
    setAdvancedTab,
    advancedSections,
    setAdvancedSection,
    recastJob: recast.job,
    startRecast,
    cancelRecast: recast.cancel,
    retryRecast: recast.retry,
    dismissRecast: recast.dismiss,
    preRecastVideo,
    restoreOriginalVideo,
    applyPresenterVideo,
    removePresenterVideo,
    guidedStep,
    setGuidedStep,
    previewSettings,
    previewVideo,
    setPreviewVideo,
    setPreviewLayout,
    updatePreviewLayer,
    setPreviewLayerLocked,
    setPreviewProtectedZones,
    applyPreviewPlacements,
    updatePreviewBrandColors,
    updatePreviewComposition,
    resetPreviewLayout,
    remotionDesignTemplates,
    activeRemotionDesignId: previewSettings.remotionDesignId ?? null,
    setRemotionDesign,
    addRemotionDesign,
    removePreviewDesignLayer,
    undoPreview,
    redoPreview,
    canUndoPreview: historyRef.current.past.length > 0,
    canRedoPreview: historyRef.current.future.length > 0,
    remotionDesignError,
    previewApproved,
    approvalStale,
    approvePersonalization,
     createFinalVideo,
     cancelExport,
     apiKey,
     setPreviewAudio,
     removePreviewAudio,
     previewAudioError,
    promptNotice,
    canPublish: Boolean(socialPublish) && (!result || Boolean(publishableUrl(result))),
    publishNote: socialPublish && result && !publishableUrl(result)
      ? 'This video is only saved in this browser, so it can’t be published from here. Download it to share it.'
      : '',
    canEditInVideoStudio: Boolean(
      result?.type === 'video' &&
      studioVideoUrl(result) &&
      getGenerationAssetUrl(lastProjectRef.current?.assets.primaryIdentity ?? null),
    ),

     // Motion Studio recipe (full catalog: 124 cards / 150 shots / 10
     // categories, exposed by `@/data/motionRecipeCatalog`). The selected
     // recipe is held here so the in-modal preview can re-render it across
     // reloads, and the launch action hands it off to the canonical
     // `/studio/motion-studio` route.
     motionTemplate,
     useMotionTemplate,
     launchMotionTemplate,
    }

  return (
    <PersonalizationContext.Provider value={ctxValue}>
      {children}
      {isOpen && source && (
        <PersonalizationModal />
      )}
    </PersonalizationContext.Provider>
  )
}
