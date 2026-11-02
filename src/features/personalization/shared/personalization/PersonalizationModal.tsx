/**
 * PersonalizationModal
 *
 * Context-driven modal for the SmartVideo personalization workflow.
 * Implements the approved full-width design hierarchy (HTML source of truth).
 *
 * Design tokens mirror the approved HTML:
 *   --bg: #080b0f, --modal: #101419, --panel: #151a20, --panel-soft: #12171c
 *   --cyan: #29d3f2, --cyan-soft: rgba(41,211,242,.12)
 *   radii: 22px modal, 16px panels, 12px zones, 9px thumbs
 *
 * Keeps all functional features wired through the existing context:
 *   - durable uploads via uploadFile()
 *   - generation via runGeneration() / runPersonalization()
 *   - prompt personalization via personalizePrompt()
 *   - client CRUD via clientProfile helpers
 *   - Image/Video Studio handoffs via writeHandoff() + next/navigation
 *   - Publish via SocialPublishProvider
 *   - Shared Media registration via sharedMedia
 */

'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  X,
  Copy,
  Download,
  RefreshCw,
  Loader2,
  Save,
  Trash2,
  AlertTriangle,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'
import { useDemoPersonalize } from './DemoPersonalizeProvider'
import type { PersonalizationAsset, DiscoveredAsset, DiscoveredAssetCategory, AssignedSection, AssetRole, PersonalizationVisionAnalysis, BusinessDiscoveryRecord, BusinessOwnership, PersonalizationSource } from './types'
import { LEAD_STAGES, isLeadStage } from './leadStages'
import { ownershipBadgeStyle, ownershipLabel } from './ownershipBadge'
import { resolveModelCapabilities, FACE_SWAP_MODEL, FULL_BODY_MODEL, DEFAULT_T2V_MODEL, DEFAULT_I2I_MODEL } from './modelCapabilityResolver'
import { getModelById, getVideoModelById } from '@ohb/packages/studio/src/models.js'
import { NICHE_CONTENT } from '@ohb/data/nicheContent'
import { BUSINESS_NICHES } from './businessNiches'
import ImageEditorModal, {
  type ImageEditorApplyResult,
  type PersonalizationImageEditorAsset,
} from './image-editor/ImageEditorModal'
import { makeDiscoveredAssetVideoReady } from './image-editor/batchVideoReady'
import { isImageEditSupported } from './image-editor/imageEditSupport'
import { DiscoveredAssetGrid } from './DiscoveredAssetGrid'
import { ResumeProjectBanner } from './ResumeProjectBanner'
import { SimpleModeWizard } from './guided/SimpleModeWizard'
import { OverlayEditor } from './guided/OverlayEditor'
import { buildPreviewInput } from './guided/buildPreviewInput'
import { BeforeAfterPreview } from './preview/BeforeAfterPreview'

// ── Design tokens (mirror the approved HTML CSS variables) ──────────────────

const C = {
  bg: '#080b0f',
  modal: '#101419',
  panel: '#151a20',
  panelSoft: '#12171c',
  field: '#0d1116',
  border: 'rgba(255,255,255,.10)',
  borderStrong: 'rgba(255,255,255,.16)',
  text: '#f7f9fb',
  muted: 'rgba(255,255,255,.58)',
  muted2: 'rgba(255,255,255,.36)',
  cyan: '#29d3f2',
  cyanSoft: 'rgba(41,211,242,.12)',
  cyanBorder: 'rgba(41,211,242,.45)',
  green: '#28c98b',
  danger: '#ef5b67',
} as const

// ── Domain constants ────────────────────────────────────────────────────────

const VIDEO_MODES = [
  { key: 'face_only', label: 'Face Only', description: 'Keep the original body, clothing, movement, scene and timing. Change face.' },
  { key: 'full_body', label: 'Full Presenter', description: 'Replace the presenter with the uploaded person where supported.' },
  { key: 'recreate', label: 'Recreate For Client', description: 'Recreate the viral concept using this client\'s assets and personalized prompt.' },
  { key: 'complete', label: 'Complete Personalization', description: 'Person + products + brand + logo + CTA + prompt.' },
] as const

const IMAGE_MODES = [
  { key: 'keep_design', label: 'Keep This Design', description: 'Use the original image as the visual base.' },
  { key: 'replace_face', label: 'Replace Face', description: 'Keep the design and replace the face.' },
  { key: 'replace_person', label: 'Replace Person', description: 'Replace or recreate the person while preserving the composition.' },
  { key: 'recreate', label: 'Recreate For Client', description: 'Use the original concept and personalized prompt for a fresh client-specific image.' },
  { key: 'complete', label: 'Complete Personalization', description: 'Use client identity, products, brand references, logo, and exact text/logo overlays.' },
] as const

const OUTPUT_OPTIONS_VIDEO = [
  { key: 'prompt', label: 'Prompt', description: 'Create a personalized prompt only.' },
  { key: 'video', label: 'Video', description: 'Generate a personalized video.' },
  { key: 'everything', label: 'Everything', description: 'Prompt + Video + Assets + CTA.' },
] as const

function destinationRoleForSection(section: AssignedSection): PersonalizationAsset['role'] | undefined {
  if (section === 'person') return 'presenter_identity'
  if (section === 'logo') return 'logo'
  if (section === 'products') return 'product_reference'
  if (section === 'brand') return 'brand_reference'
  if (section === 'firstFrame') return 'first_frame'
  if (section === 'lastFrame') return 'last_frame'
  if (section === 'ctaGraphic') return 'cta_graphic'
  return undefined
}

const OUTPUT_OPTIONS_IMAGE = [
  { key: 'prompt', label: 'Prompt', description: 'Create a personalized prompt only.' },
  { key: 'image', label: 'Image', description: 'Generate a personalized image.' },
  { key: 'everything', label: 'Everything', description: 'Prompt + Image + Assets + CTA.' },
] as const

const OUTPUT_OPTIONS_PROMPT = [
  { key: 'prompt', label: 'Prompt', description: 'Create a personalized prompt only.' },
] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * One-line scoring evidence for a result-card tooltip. Kept out of the card
 * body because the full signal list is too noisy at this size.
 */
function businessOpportunityTitle(business: BusinessDiscoveryRecord): string | undefined {
  const breakdown = business.scoreBreakdown
  if (!breakdown) return undefined
  const parts = [
    `Video opportunity ${Math.round(breakdown.videoOpportunity)}`,
    `Contactability ${Math.round(breakdown.contactability)}`,
    ownershipLabel(breakdown.ownership),
  ]
  if (business.videoOpportunity?.signals?.length) parts.push(...business.videoOpportunity.signals)
  return parts.join(' · ')
}

function classNames(...classes: (string | boolean | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

type PersonalizationDragSource = 'discovered' | 'current-job' | 'saved-client'

type PersonalizationDragPayload = {
  assetId: string
  source: PersonalizationDragSource
  assetType: string
  url: string
  uploadedUrl?: string
  metadata: {
    role?: string
    name?: string
    sourceCategory?: string
    sourceType?: string
  }
}

function isUsableImageSource(url?: string): boolean {
  const candidate = url || ''
  if (!candidate || candidate.startsWith('blob:')) return false
  if (candidate.startsWith('data:')) {
    return candidate.startsWith('data:image/')
  }
  const path = candidate.split(/[?#]/, 1)[0]
  const ext = path.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) return true
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function Field({ label, value, placeholder, onChange, full = false }: { label: string; value: string | undefined | null; placeholder: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label style={{ display: 'block', marginBottom: 6, color: C.muted, fontSize: 10 }}>{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full outline-none"
        style={{
          minHeight: 40,
          padding: '0 11px',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          background: C.field,
          color: C.text,
        }}
      />
    </div>
  )
}

function isModeUnavailable(modeKey: string, assets: { primaryIdentity?: PersonalizationAsset | null; identities?: PersonalizationAsset[] }, capabilities: Record<string, unknown>): boolean {
  if (modeKey === 'face_only' || modeKey === 'replace_face') {
    return !assets.primaryIdentity && !assets.identities?.length
  }
  if (modeKey === 'full_body' || modeKey === 'replace_person') {
    return !assets.primaryIdentity && !assets.identities?.length
  }
  return false
}

function getModeUnavailableReason(modeKey: string, assets: { primaryIdentity?: PersonalizationAsset | null; identities?: PersonalizationAsset[] }): string {
  if (modeKey === 'face_only' || modeKey === 'replace_face') {
    return 'Requires a person/identity photo.'
  }
  if (modeKey === 'full_body' || modeKey === 'replace_person') {
    return 'Requires a person/identity photo.'
  }
  return 'Not available for the current source/model.'
}

// ── Reusable sub-components ──────────────────────────────────────────────────

/** Upload drop zone matching the approved HTML design. */
function UploadZone({
  primary,
  secondary,
  onFiles,
  multiple = false,
  disabled,
  accept = 'image/*',
  urlLabel,
  urlPlaceholder,
  onUrl,
}: {
  primary: string
  secondary?: string
  onFiles: (files: FileList | null) => void
  multiple?: boolean
  disabled?: boolean
  accept?: string
  urlLabel?: string
  urlPlaceholder?: string
  onUrl?: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [urlValue, setUrlValue] = useState('')

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    onFiles(e.dataTransfer.files)
  }, [disabled, onFiles])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files)
    e.target.value = ''
  }, [onFiles])

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlValue.trim()
    if (!trimmed || !onUrl) return
    onUrl(trimmed)
    setUrlValue('')
  }, [urlValue, onUrl])

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleUrlSubmit()
    }
  }, [handleUrlSubmit])

  return (
    <div>
      {onUrl && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder={urlPlaceholder || 'Paste URL and press Enter'}
            className="w-full outline-none"
            style={{
              minHeight: 38,
              padding: '0 11px',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: C.field,
              color: C.text,
              fontSize: 12,
            }}
          />
          {urlValue.trim() && (
            <button
              type="button"
              onClick={handleUrlSubmit}
              className="mt-1.5 rounded-[8px] text-[10px] font-extrabold uppercase tracking-wide"
              style={{
                minHeight: 32,
                padding: '0 12px',
                border: `1px solid ${C.cyanBorder}`,
                background: C.cyanSoft,
                color: C.cyan,
              }}
            >
              {urlLabel || 'Add from URL'}
            </button>
          )}
        </div>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={classNames(
          'grid place-items-center text-center rounded-[12px] border border-dashed transition-colors cursor-pointer min-h-[106px] px-3 py-3',
          isDragOver
            ? 'border-[var(--cyan-border)] bg-[rgba(41,211,242,.04)]'
            : 'border-[rgba(255,255,255,.22)] bg-[rgba(0,0,0,.16)] hover:border-[var(--cyan-border)] hover:bg-[rgba(41,211,242,.04)]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        style={{ ['--cyan-border' as any]: C.cyanBorder }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
        <div>
          <div style={{ fontSize: 24, marginBottom: 4, color: 'rgba(255,255,255,.72)' }}>⇧</div>
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-white">{primary}</div>
          {secondary && <div className="text-[10px] text-[rgba(255,255,255,.36)] mt-0.5">{secondary}</div>}
        </div>
      </div>
    </div>
  )
}

/** Thumb pill for placeholder slots in the asset cards. */
function ThumbPlaceholder({ label, add = false, onClick }: { label: string; add?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={classNames(
        'w-[82px] min-h-[86px] rounded-[9px] border overflow-hidden flex items-end justify-center p-1.5 text-[9px] font-extrabold',
        add && onClick && 'cursor-pointer',
      )}
      style={{
        borderColor: add ? 'rgba(255,255,255,.22)' : C.border,
        background: add ? 'rgba(0,0,0,.10)' : 'linear-gradient(145deg, #3b4652, #151a20)',
        color: add ? C.muted : 'white',
        alignItems: add ? 'center' : 'flex-end',
        justifyContent: 'center',
        fontSize: add ? 22 : 9,
        borderStyle: add ? 'dashed' : 'solid',
      }}
    >
      {label}
    </div>
  )
}

const EDIT_WITH_AI = 'Edit with AI'

/** Uploaded asset thumb with status overlays and actions. */
function ThumbUploaded({
  asset,
  label,
  onRemove,
  onRetry,
  onEdit,
  onRevert,
  onMoveToSection,
  light = false,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  asset: PersonalizationAsset
  label?: string
  onRemove?: () => void
  onRetry?: () => void
  onEdit?: () => void
  onRevert?: () => void
  onMoveToSection?: (section: AssignedSection) => void
  light?: boolean
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
}) {
  const status = asset.uploadStatus
  const isUploading = status === 'uploading'
  const isError = status === 'error'
  const isReady = status === 'ready'
  const displayUrl = asset.uploadedUrl || asset.url

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative w-[82px] min-h-[86px] rounded-[9px] border overflow-hidden flex items-end justify-center p-1.5 group"
      style={{
        borderColor: C.border,
        background: light ? '#f6f7f9' : 'linear-gradient(145deg, #3b4652, #151a20)',
        color: light ? '#101820' : 'white',
        cursor: draggable ? 'grab' : 'default',
        opacity: isUploading ? 0.7 : 1,
      }}
    >
      {isUploading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <Loader2 size={14} className="animate-spin text-white" />
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-red-900/40 p-1">
          {onRetry && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              className="rounded bg-white/20 px-1.5 py-0.5 text-[8px] text-white hover:bg-white/30"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {isReady && (
        <div className="absolute top-0.5 right-0.5 z-10 flex items-center gap-0.5 rounded-full bg-emerald-500/90 px-1.5 py-0.5">
          <span className="text-[7px] font-bold text-white">✓</span>
        </div>
      )}
      {displayUrl ? (
        <img src={displayUrl} alt={asset.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      {onEdit && isReady && isImageEditSupported(asset) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="absolute left-1 top-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(41,211,242,.92)', color: '#041014' }}
          aria-label="Edit image"
        >
          {EDIT_WITH_AI}
        </button>
      )}
      {asset.edited && onRevert && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRevert() }}
          className="absolute right-1 top-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(255,255,255,.9)', color: '#041014' }}
          aria-label="Revert to original"
        >
          Revert
        </button>
      )}
      {label && (
        <span className="relative text-[9px] font-extrabold z-[1]" style={{ color: light ? '#101820' : 'white' }}>
          {label}
        </span>
      )}
      {onRemove && !isError && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute top-0.5 right-0.5 z-20 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,91,103,.85)' }}
        >
          <X size={8} className="text-white" />
        </button>
      )}
      {onMoveToSection && (
        <div
          className="absolute bottom-0.5 right-0.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value=""
            onChange={(e) => {
              e.stopPropagation()
              if (e.target.value) onMoveToSection(e.target.value as AssignedSection)
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[7px] font-bold rounded px-0.5 py-0.5 outline-none"
            style={{
              background: 'rgba(0,0,0,.7)',
              color: 'white',
              border: '1px solid rgba(255,255,255,.25)',
              fontSize: 7,
            }}
            aria-label="Move to section"
          >
            <option value="">Move To…</option>
            <option value="person">Person</option>
            <option value="logo">Logo</option>
            <option value="products">Products</option>
            <option value="brand">Brand</option>
            <option value="firstFrame">First Frame</option>
            <option value="lastFrame">Last Frame</option>
            <option value="ctaGraphic">CTA</option>
          </select>
        </div>
      )}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-hooks/rules-of-hooks
export default function PersonalizationModal() {
  const ctx = useDemoPersonalize()
  const {
    isOpen,
    source,
    closePersonalize,
    sourceTypeLabel,
    access,
    clients,
    selectedClientId,
    clientForm,
    saveClient,
    selectClient,
    deleteClient,
    updateClientForm,
    savedClientAssets,
    savedAssetLibraryTab,
    setSavedAssetLibraryTab,
    useSavedClient,
    deleteSavedClient,
    selectSavedAsset,
    setPrimarySavedAsset,
    removeSavedAsset,
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
    discoveredAssets,
    discoveryStatus,
    discoveryError,
    importConfirmation,
    setDiscoveredAssets,
    toggleDiscoveredAssetSelection,
    rejectDiscoveredAsset,
    restoreDiscoveredAsset,
    updateDiscoveredAssetCategory,
    removeDiscoveredAssetFromSection,
    moveDiscoveredAssetToSection,
    revertDiscoveredAssetEdit,
    selectRecommendedDiscoveredAssets,
    importDiscoveredAssets,
    cancelDiscovery,
    discoverAssets,
    runDiscoveryWorkflow,
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
    researchBusiness,
    clearBusinessSearch,
    setBusinessSearchMode,
    promptState,
    updatePersonalizedPrompt,
    resetPrompt,
    personalizePrompt,
    outputType,
    setOutputType,
    mode,
    setMode,
    genOptions,
    updateGenOptions,
    generation,
    generate,
    retry,
    generateAgain,
    retryBranding,
    result,
    resultTab,
    setResultTab,
    editInImageStudio,
    editInVideoStudio,
    publish,
    download,
    sharedMediaEntries,
  } = ctx

  // Guided Simple Mode is the default presentation whenever the provider
  // exposes the guided API (always in production). A partial context (unit-test
  // mocks) falls back to the full ConfigurationView unchanged.
  const guidedApiAvailable =
    typeof (ctx as { setGuidedStep?: unknown }).setGuidedStep === 'function' &&
    Boolean((ctx as { previewSettings?: unknown }).previewSettings)
  const [localViewMode, setLocalViewMode] = useState<'simple' | 'advanced'>('simple')
  const viewMode: 'simple' | 'advanced' = guidedApiAvailable && ctx.viewMode ? ctx.viewMode : localViewMode
  const setViewMode: (mode: 'simple' | 'advanced') => void =
    guidedApiAvailable && ctx.setViewMode ? ctx.setViewMode : setLocalViewMode
  // Simple Mode shows the four guided steps; prompt-only sources keep the
  // existing configuration view (there is no video to preview or brand).
  const simpleModeActive = viewMode === 'simple' && guidedApiAvailable && source?.mediaType !== 'prompt-only'

  // Access mode for this session ('anonymous' on the free landing surface).
  // The server remains the authority; this decides which paid/AI affordances
  // the modal renders at all — never which endpoint grants permission.
  const isAnonymous = access !== 'authenticated'

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imageEditorAsset, setImageEditorAsset] = useState<PersonalizationImageEditorAsset | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Drag and drop state
  const [dragPayload, setDragPayload] = useState<PersonalizationDragPayload | null>(null)
  const [dragOverSection, setDragOverSection] = useState<AssignedSection | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const dragPayloadRef = useRef(dragPayload)
  useEffect(() => { dragPayloadRef.current = dragPayload }, [dragPayload])

  const savedClientAssetsRef = useRef(savedClientAssets)
  useEffect(() => { savedClientAssetsRef.current = savedClientAssets }, [savedClientAssets])

  const sectionDragCountersRef = useRef<Record<string, number>>({})

  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  /**
   * The inline `overflow` value the document body had *before* the modal locked
   * scrolling. Restoring a hard-coded `''` on close silently destroyed any
   * value the page (or an enclosing studio) had already set — e.g. `overflow:
   * hidden` on a scrolled panel, or `overflow: auto`. The captured value is
   * restored verbatim instead, including the empty string.
   */
  const previousBodyOverflowRef = useRef<string | null>(null)

  const personalizationInProgress =
    generation.status === 'generating' || generation.status === 'processing' || generation.status === 'personalizing-prompt'

  // ── Drag and drop handlers ──────────────────────────────────────────────────

  const handleAssetDragStart = useCallback((
    payload: PersonalizationDragPayload,
    e: DragEvent,
  ) => {
    setDropError(null)
    setDragPayload(payload)
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleAssetDragEnd = useCallback(() => {
    setDragPayload(null)
    setDragOverSection(null)
    setDropError(null)
    Object.keys(sectionDragCountersRef.current).forEach((key) => {
      sectionDragCountersRef.current[key] = 0
    })
  }, [])

  const handleSectionDragEnter = useCallback((section: string, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropError(null)
    sectionDragCountersRef.current[section] = (sectionDragCountersRef.current[section] || 0) + 1
    setDragOverSection(section as AssignedSection)
  }, [])

  const handleSectionDragOver = useCallback((section: AssignedSection, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSection(section)
  }, [])

  const handleSectionDragLeave = useCallback((section: string, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    sectionDragCountersRef.current[section] = Math.max(0, (sectionDragCountersRef.current[section] || 0) - 1)
    if (sectionDragCountersRef.current[section] === 0) {
      setDragOverSection((current) => current === section ? null : current)
    }
  }, [])

  const handleSectionDrop = useCallback((section: string, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    sectionDragCountersRef.current[section] = 0
    setDragOverSection(null)
    setDragPayload(null)

    // Reject arbitrary text/HTML drops
    const hasText = e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('text/html')
    const hasJson = e.dataTransfer.types.includes('application/json')
    if (hasText && !hasJson) {
      setDropError('Only personalization assets can be dropped here.')
      setTimeout(() => setDropError(null), 3000)
      return
    }

    // Reject external video file drops
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith('video/')) {
          setDropError('Video files cannot be dropped here. Use the URL field instead.')
          setTimeout(() => setDropError(null), 3000)
          return
        }
      }
    }

    let payload: PersonalizationDragPayload | null = null
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) payload = JSON.parse(data) as PersonalizationDragPayload
    } catch {
      // ignore invalid payload
    }
    if (!payload) {
      payload = dragPayloadRef.current
    }
    if (!payload) {
      setDropError('Invalid drop. Only personalization assets are accepted.')
      setTimeout(() => setDropError(null), 3000)
      return
    }

    // Validate normalized payload shape
    if (!payload.assetId || !payload.source || !payload.assetType || !payload.url) {
      setDropError('Malformed asset. Please try again.')
      setTimeout(() => setDropError(null), 3000)
      return
    }

    const validSources: PersonalizationDragSource[] = ['discovered', 'current-job', 'saved-client']
    if (!validSources.includes(payload.source)) {
      setDropError('Unknown asset source.')
      setTimeout(() => setDropError(null), 3000)
      return
    }

    // Reject assets without a usable image source
    const candidate = payload.uploadedUrl || payload.url
    if (!isUsableImageSource(candidate)) {
      setDropError('This asset does not have a usable image source.')
      setTimeout(() => setDropError(null), 3000)
      return
    }

    const { assetId, source } = payload

    // Discovered assets are imported into the section they were dropped on.
    // Only tagging them with the section changed nothing on screen: the
    // section cards show imported assets, so the drop looked like it failed.
    if (source === 'discovered') {
      moveDiscoveredAssetToSection(assetId, section as AssignedSection)
      void importDiscoveredAssets({ ids: [assetId], section: section as AssignedSection })
      return
    }

    // Handle saved client assets: add to current job
    if (source === 'saved-client') {
      const savedAssets = savedClientAssetsRef.current
      const savedAsset = [
        ...savedAssets.identities,
        ...savedAssets.logos,
        ...savedAssets.products,
        ...savedAssets.brandReferences,
      ].find((a) => a.id === assetId)
      if (savedAsset) {
        selectSavedAsset(savedAsset)
      }
      return
    }

    // Handle current job assets: move between sections
    moveLibraryAssetToSection(assetId, section as AssignedSection)
  }, [importDiscoveredAssets, moveDiscoveredAssetToSection, moveLibraryAssetToSection, selectSavedAsset])

  // ── Focus trap & Escape ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return
    previousActiveElementRef.current = document.activeElement as HTMLElement
    // Capture the body's inline overflow *before* locking, so cleanup can put
    // back exactly what was there (possibly '' / unset) instead of clobbering
    // a value the page or an enclosing studio had already applied.
    previousBodyOverflowRef.current = document.body.style.overflow
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !personalizationInProgress && !imageEditorAsset) closePersonalize()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflowRef.current ?? ''
      previousBodyOverflowRef.current = null
      previousActiveElementRef.current?.focus()
    }
  }, [isOpen, closePersonalize, personalizationInProgress, imageEditorAsset])

  useEffect(() => {
    setMode(null)
  }, [source?.id, setMode])

  const editorReferenceImages = useMemo(() => {
    const candidates = [
      assets.primaryLogo,
      assets.primaryIdentity,
      ...assets.products.slice(0, 2),
      ...assets.brandReferences.slice(0, 2),
    ].filter(Boolean) as PersonalizationAsset[]

    return Array.from(new Set(
      candidates
        .map((item) => item.uploadedUrl || item.url)
        .filter((url): url is string => Boolean(url) && !url.startsWith('blob:')),
    )).slice(0, 6)
  }, [assets.brandReferences, assets.primaryIdentity, assets.primaryLogo, assets.products])

  // ── Image editor asset normalization ─────────────────────────────────────

  const normalizeImageEditorAsset = useCallback((
    raw: {
      id: string
      name?: string
      imageUrl: string
      originalImageUrl: string
      category?: DiscoveredAssetCategory
      role?: AssetRole
      source: 'discovered' | 'current-job' | 'saved-client'
      clientId?: string
      businessName?: string
      industry?: string
      productService?: string
      brandDescription?: string
      referenceImages?: string[]
      visionAnalysis?: PersonalizationVisionAnalysis
      file?: File
    },
  ) => raw, [])

  const loadAssetIntoEditor = useCallback((asset: PersonalizationImageEditorAsset) => {
    setImageEditorAsset(asset)
  }, [])

  const openDiscoveredImageEditor = useCallback((asset: DiscoveredAsset) => {
    loadAssetIntoEditor(normalizeImageEditorAsset({
      id: asset.id,
      name: asset.category.replace(/_/g, ' '),
      imageUrl: asset.editedDataUrl || asset.previewUrl,
      originalImageUrl: asset.previewUrl,
      category: asset.category,
      role: destinationRoleForSection(asset.assignedSection),
      source: 'discovered',
      businessName: clientForm.businessName || clientForm.name,
      industry: clientForm.industry,
      productService: clientForm.productService,
      brandDescription: clientForm.brandDescription,
      referenceImages: editorReferenceImages.filter((url) => url !== asset.previewUrl && url !== asset.editedDataUrl),
      visionAnalysis: asset.visionAnalysis,
      file: (asset as { file?: File }).file,
    }))
  }, [
    clientForm.brandDescription,
    clientForm.businessName,
    clientForm.industry,
    clientForm.name,
    clientForm.productService,
    editorReferenceImages,
    loadAssetIntoEditor,
    normalizeImageEditorAsset,
  ])

  const isAssetInCurrentJob = useCallback((asset: PersonalizationAsset): boolean => {
    const all = [
      ...assets.identities,
      ...assets.logos,
      ...assets.products,
      ...assets.brandReferences,
      assets.firstFrame,
      assets.lastFrame,
      assets.ctaGraphic,
    ].filter(Boolean) as PersonalizationAsset[]
    return all.some((a) => a.id === asset.id || a.url === asset.url || a.uploadedUrl === asset.uploadedUrl)
  }, [assets])

  const openLibraryImageEditor = useCallback((asset: PersonalizationAsset) => {
    const imageUrl = asset.uploadedUrl || asset.url
    const source = isAssetInCurrentJob(asset) ? 'current-job' : 'saved-client'
    loadAssetIntoEditor(normalizeImageEditorAsset({
      id: asset.id,
      name: asset.name,
      imageUrl,
      originalImageUrl: imageUrl,
      category: asset.sourceCategory,
      role: asset.role,
      source,
      businessName: clientForm.businessName || clientForm.name,
      industry: clientForm.industry,
      productService: clientForm.productService,
      brandDescription: clientForm.brandDescription,
      referenceImages: editorReferenceImages.filter((url) => url !== imageUrl),
      visionAnalysis: asset.visionAnalysis,
      file: asset.file ?? undefined,
    }))
  }, [
    clientForm.brandDescription,
    clientForm.businessName,
    clientForm.industry,
    clientForm.name,
    clientForm.productService,
    editorReferenceImages,
    isAssetInCurrentJob,
    loadAssetIntoEditor,
    normalizeImageEditorAsset,
  ])

  const openCurrentJobImageEditor = useCallback((asset: PersonalizationAsset) => {
    const imageUrl = asset.uploadedUrl || asset.url
    loadAssetIntoEditor(normalizeImageEditorAsset({
      id: asset.id,
      name: asset.name,
      imageUrl,
      originalImageUrl: imageUrl,
      category: asset.sourceCategory,
      role: asset.role,
      source: 'current-job',
      businessName: clientForm.businessName || clientForm.name,
      industry: clientForm.industry,
      productService: clientForm.productService,
      brandDescription: clientForm.brandDescription,
      referenceImages: editorReferenceImages.filter((url) => url !== imageUrl),
      visionAnalysis: asset.visionAnalysis,
      file: asset.file ?? undefined,
    }))
  }, [
    clientForm.brandDescription,
    clientForm.businessName,
    clientForm.industry,
    clientForm.name,
    clientForm.productService,
    editorReferenceImages,
    loadAssetIntoEditor,
    normalizeImageEditorAsset,
  ])

  const handleImageEditorDrop = useCallback((payload: { assetId: string; source: string; assetType: string }) => {
    const { assetId, source } = payload

    if (source === 'discovered') {
      const discovered = discoveredAssets.find((a) => a.id === assetId)
      if (discovered) {
        openDiscoveredImageEditor(discovered)
        return
      }
    }

    if (source === 'library' || source === 'saved') {
      const allAssets: PersonalizationAsset[] = [
        ...assets.identities,
        ...assets.logos,
        ...assets.products,
        ...assets.brandReferences,
        assets.firstFrame,
        assets.lastFrame,
        assets.ctaGraphic,
        ...savedClientAssets.identities,
        ...savedClientAssets.logos,
        ...savedClientAssets.products,
        ...savedClientAssets.brandReferences,
      ].filter(Boolean) as PersonalizationAsset[]
      const libraryAsset = allAssets.find((a) => a.id === assetId)
      if (libraryAsset) {
        if (isAssetInCurrentJob(libraryAsset)) {
          openCurrentJobImageEditor(libraryAsset)
        } else {
          openLibraryImageEditor(libraryAsset)
        }
        return
      }
    }
  }, [
    assets.brandReferences,
    assets.ctaGraphic,
    assets.firstFrame,
    assets.identities,
    assets.lastFrame,
    assets.logos,
    assets.products,
    discoveredAssets,
    isAssetInCurrentJob,
    openCurrentJobImageEditor,
    openDiscoveredImageEditor,
    openLibraryImageEditor,
    savedClientAssets.brandReferences,
    savedClientAssets.identities,
    savedClientAssets.logos,
    savedClientAssets.products,
  ])

  const handleImageEditorApply = useCallback(async (result: ImageEditorApplyResult) => {
    if (!imageEditorAsset) return
    if (imageEditorAsset.source === 'discovered') {
      setDiscoveredAssets(discoveredAssets.map((item) => (
        item.id === imageEditorAsset.id
          ? {
              ...item,
              originalPreviewUrl: item.originalPreviewUrl || item.previewUrl,
              editedDataUrl: result.dataUrl,
              edited: true,
              videoReady: result.videoReady,
              hasTransparency: result.transparent,
              editMetadata: {
                operation: result.operation,
                prompt: result.prompt,
                model: result.model,
                quality: result.quality,
                responseId: result.responseId,
                imageGenerationCallId: result.imageGenerationCallId,
                revisedPrompt: result.revisedPrompt,
              },
              visionAnalysis: result.visionAnalysis || item.visionAnalysis,
              visionValidation: result.visionValidation,
            }
          : item
      )))
      return
    }

    if (imageEditorAsset.source === 'current-job') {
      await applyEditedPersonalizationAsset(imageEditorAsset.id, result.dataUrl, {
        operation: result.operation,
        prompt: result.prompt,
        model: result.model,
        quality: result.quality,
        transparent: result.transparent,
        videoReady: result.videoReady,
        responseId: result.responseId,
        imageGenerationCallId: result.imageGenerationCallId,
        revisedPrompt: result.revisedPrompt,
        outputFormat: result.outputFormat,
        outputCompression: result.outputCompression,
        inputFidelity: result.inputFidelity,
        visionAnalysis: result.visionAnalysis,
        visionValidation: result.visionValidation,
      })
      return
    }

    await applyEditedPersonalizationAsset(imageEditorAsset.id, result.dataUrl, {
      operation: result.operation,
      prompt: result.prompt,
      model: result.model,
      quality: result.quality,
      transparent: result.transparent,
      videoReady: result.videoReady,
      responseId: result.responseId,
      imageGenerationCallId: result.imageGenerationCallId,
      revisedPrompt: result.revisedPrompt,
      outputFormat: result.outputFormat,
      outputCompression: result.outputCompression,
      inputFidelity: result.inputFidelity,
      visionAnalysis: result.visionAnalysis,
      visionValidation: result.visionValidation,
    })
  }, [applyEditedPersonalizationAsset, discoveredAssets, imageEditorAsset, setDiscoveredAssets])

  // NOTE: these memo hooks live ABOVE the early return below on purpose, so the
  // hook order is identical whether or not the modal is open. The provider
  // mounts the modal only while it is open; keeping the hook list stable also
  // makes an unconditional mount safe.
  const niche = useMemo(() => {
    const nicheId = source?.sourceMetadata?.nicheId
    if (!nicheId) return undefined
    return NICHE_CONTENT.find((n) => n.id === nicheId)
  }, [source?.sourceMetadata?.nicheId])

  if (!isOpen || !source) return null

  const isVideo = source.mediaType === 'video'
  const isImage = source.mediaType === 'image'
  const isPromptOnly = source.mediaType === 'prompt-only'
  const eligibleModes = isVideo ? VIDEO_MODES : isImage ? IMAGE_MODES : []
  const outputOptions = isVideo ? OUTPUT_OPTIONS_VIDEO : isImage ? OUTPUT_OPTIONS_IMAGE : OUTPUT_OPTIONS_PROMPT
  const showModes = outputType !== 'prompt' && eligibleModes.length > 0

  const effectiveModelId =
    genOptions.advancedModel ||
    genOptions.model ||
    source.model ||
    (isVideo
      ? mode === 'face_only'
        ? FACE_SWAP_MODEL
        : mode === 'full_body'
          ? FULL_BODY_MODEL
          : DEFAULT_T2V_MODEL
      : DEFAULT_I2I_MODEL)

  const capabilities = resolveModelCapabilities(source, { ...genOptions, model: effectiveModelId })

  // ── Auto model recommendation based on duration ─────────────────────────────
  const recommendedModelId = useMemo(() => {
    if (!isVideo || mode === 'face_only' || mode === 'full_body') return effectiveModelId
    const selectedDuration = genOptions.duration || source.duration
    if (!selectedDuration || selectedDuration <= 15) return effectiveModelId
    return 'veo-4-text-to-video'
  }, [isVideo, mode, effectiveModelId, genOptions.duration, source.duration])

  const recommendedModel = useMemo(() => {
    return getVideoModelById(recommendedModelId) || getModelById(recommendedModelId)
  }, [recommendedModelId])

  const currentModel = useMemo(() => {
    return getVideoModelById(effectiveModelId) || getModelById(effectiveModelId)
  }, [effectiveModelId])

  const isUsingRecommendedModel = effectiveModelId === recommendedModelId

  // ── Upload handlers ────────────────────────────────────────────────────────

  const handleIdentityUpload = (files: FileList | null) => {
    if (!files) return
    setUploadError(null)
    const currentCount = assets.identities.length
    const remaining = capabilities.maxImages - currentCount
    if (remaining <= 0) {
      setUploadError(`Maximum ${capabilities.maxImages} identity image(s) allowed for the selected model.`)
      return
    }
    const filesToAdd = Array.from(files).slice(0, remaining)
    if (filesToAdd.length < files.length) {
      setUploadError(`Maximum ${capabilities.maxImages} identity image(s) allowed. Adding ${filesToAdd.length} of ${files.length} selected.`)
    }
    if (filesToAdd.length > 0) {
      const dt = new DataTransfer()
      filesToAdd.forEach(f => dt.items.add(f))
      addIdentityFiles(dt.files)
    }
  }
  const handleLogoUpload = useCallback((files: FileList | null) => {
    if (files) addLogoFiles(files)
  }, [addLogoFiles])
  const handleProductUpload = useCallback((files: FileList | null) => {
    if (files) addProductFiles(files)
  }, [addProductFiles])
  const handleBrandRefUpload = useCallback((files: FileList | null) => {
    if (files) addBrandReferenceFiles(files)
  }, [addBrandReferenceFiles])
  const handleFirstFrameUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setFirstFrameFile(files[0])
  }, [setFirstFrameFile])
  const handleLastFrameUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setLastFrameFile(files[0])
  }, [setLastFrameFile])
  const handleCtaUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setCtaGraphicFile(files[0])
  }, [setCtaGraphicFile])

  const handleIdentityUrl = useCallback((url: string) => {
    setUploadError(null)
    addIdentityUrl(url)
  }, [addIdentityUrl])
  const handleLogoUrl = useCallback((url: string) => {
    addLogoUrl(url)
  }, [addLogoUrl])
  const handleProductUrl = useCallback((url: string) => {
    addProductUrl(url)
  }, [addProductUrl])
  const handleBrandRefUrl = useCallback((url: string) => {
    addBrandReferenceUrl(url)
  }, [addBrandReferenceUrl])
  const handleFirstFrameUrl = useCallback((url: string) => {
    setFirstFrameUrl(url)
  }, [setFirstFrameUrl])
  const handleLastFrameUrl = useCallback((url: string) => {
    setLastFrameUrl(url)
  }, [setLastFrameUrl])
  const handleCtaUrl = useCallback((url: string) => {
    setCtaGraphicUrl(url)
  }, [setCtaGraphicUrl])

  // ── Discovery actions ──────────────────────────────────────────────────────

  // ── Prompt actions ───────────────────────────────────────────────────────

  const handleCopyPrompt = useCallback(async () => {
    const text = promptState.edited || promptState.personalized || promptState.original
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 1800)
    } catch { /* ignore */ }
  }, [promptState])

  const handlePersonalize = useCallback(async () => {
    if (!mountedRef.current) return
    setIsPersonalizing(true)
    try { await personalizePrompt() } finally { if (mountedRef.current) setIsPersonalizing(false) }
  }, [personalizePrompt])

  const handleRegenerate = useCallback(async () => {
    if (!mountedRef.current) return
    setIsRegenerating(true)
    try { await personalizePrompt() } finally { if (mountedRef.current) setIsRegenerating(false) }
  }, [personalizePrompt])

  const generateLabel = outputType === 'prompt'
    ? '✦ Personalize Prompt'
    : outputType === 'image'
    ? '✦ Generate Image'
    : outputType === 'video'
    ? '✦ Personalize Video'
    : '✦ Generate Everything'

  return (
      <div
        className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5"
        style={{
          background: 'radial-gradient(circle at top, rgba(41,211,242,.07), transparent 30%), #07090d',
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (personalizationInProgress) return
          if (discoveryStatus === 'discovering' || discoveryStatus === 'reviewing' || discoveryStatus === 'importing') return
          closePersonalize()
        }}
      >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalize-title"
        tabIndex={-1}
        className="w-full overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: C.modal,
          border: isFullscreen ? 'none' : `1px solid ${C.borderStrong}`,
          borderRadius: isFullscreen ? 0 : 22,
          maxWidth: isFullscreen ? '100vw' : 1480,
          maxHeight: isFullscreen ? '100vh' : '90vh',
          boxShadow: isFullscreen ? 'none' : '0 30px 90px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.025)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header
          className="flex items-start justify-between gap-6 flex-shrink-0"
          style={{ padding: '24px 28px', borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex gap-3.5 min-w-0">
            <div
              className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center flex-shrink-0"
              style={{ background: C.cyanSoft, color: C.cyan, fontSize: 20 }}
            >
              ✦
            </div>
              <div>
                <h1
                  id="personalize-title"
                  className="text-[19px] leading-[1.1] tracking-tight font-bold m-0"
                  style={{ color: C.text }}
                >
                  {niche ? niche.ctaHeading : source.sourceMetadata?.freeDiscovery ? 'Find My Brand' : 'Personalize this demo'}
                </h1>
                {niche ? (
                  <p
                    className="mt-1.5 max-w-[900px] text-[13px] leading-[1.55]"
                    style={{ color: C.muted }}
                    dangerouslySetInnerHTML={{ __html: niche.ctaBody }}
                  />
                ) : (
                  <p
                    className="mt-1.5 max-w-[900px] text-[13px] leading-[1.55]"
                    style={{ color: C.muted }}
                  >
                    {isAnonymous
                      ? 'Find My Brand: paste your business website — or search for a business — and we surface the logos, photos, products and branding its page already has, for you to review and arrange below. Nothing is generated and nothing is charged.'
                      : 'Turn this demo into a custom version for yourself, your business, or a customer. Personalize the person, branding, products, prompt, offer and CTA.'}
                  </p>
                )}
              </div>
          </div>
          <button
            type="button"
            onClick={closePersonalize}
            disabled={personalizationInProgress}
            className="w-[38px] h-[38px] border-0 rounded-[10px] text-[22px] flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
            style={{ background: 'transparent', color: C.muted }}
            aria-label="Close personalization modal"
          >
            ×
          </button>
          {guidedApiAvailable && (
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'simple' ? 'advanced' : 'simple')}
              disabled={personalizationInProgress}
              className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
              style={{
                minHeight: 38,
                padding: '0 13px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
              }}
            >
              <SlidersHorizontal size={13} />
              {viewMode === 'simple' ? 'Advanced Editing' : 'Simple Mode'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="w-[38px] h-[38px] border-0 rounded-[10px] text-[18px] flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: 'transparent', color: C.muted }}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? '🗗' : '⛶'}
          </button>
        </header>

        {/* ── BODY ──────────────────────────────────────────────────── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: '0 26px' }}
        >
          {generation.status === 'complete' && result ? (
            <ResultView
              result={result}
              resultTab={resultTab}
              setResultTab={setResultTab}
              source={source}
              promptState={promptState}
              generateAgain={generateAgain}
              retryBranding={retryBranding}
              outputType={outputType}
              setOutputType={setOutputType}
              download={download}
              editInImageStudio={editInImageStudio}
              editInVideoStudio={editInVideoStudio}
              publish={publish}
              sharedMediaCount={sharedMediaEntries?.length || 0}
              isVideo={isVideo}
              eligibleModes={eligibleModes}
              mode={mode}
              setMode={setMode}
            />
          ) : generation.status === 'error' ? (
            <ErrorView
              errorMessage={generation.errorMessage}
              retry={generation.failedStage === 'prompt' ? handlePersonalize : retry}
              generate={generate}
              stage={generation.failedStage}
            />
          ) : personalizationInProgress ? (
            <ProgressView
              status={generation.status}
              progress={generation.progress}
              message={generation.progressMessage}
            />
          ) : simpleModeActive ? (
            // Image edits are refused server-side for anonymous sessions, so
            // the guided flow only offers "Edit with AI" to signed-in users.
            <SimpleModeWizard onEditDiscoveredAsset={isAnonymous ? undefined : openDiscoveredImageEditor} />
          ) : (
            <ConfigurationView
              source={source}
              sourceTypeLabel={sourceTypeLabel}
              clients={clients}
              selectedClientId={selectedClientId}
              clientForm={clientForm}
              selectClient={selectClient}
              saveClient={saveClient}
              deleteClient={deleteClient}
              updateClientForm={updateClientForm}
              savedClientAssets={savedClientAssets}
              savedAssetLibraryTab={savedAssetLibraryTab}
              setSavedAssetLibraryTab={setSavedAssetLibraryTab}
              useSavedClient={useSavedClient}
              deleteSavedClient={deleteSavedClient}
              selectSavedAsset={selectSavedAsset}
              setPrimarySavedAsset={setPrimarySavedAsset}
              removeSavedAsset={removeSavedAsset}
              assets={assets}
              handleIdentityUpload={handleIdentityUpload}
              handleIdentityUrl={handleIdentityUrl}
              removeIdentity={removeIdentity}
              setPrimaryIdentity={setPrimaryIdentity}
              handleLogoUpload={handleLogoUpload}
              handleLogoUrl={handleLogoUrl}
              removeLogo={removeLogo}
              setPrimaryLogo={setPrimaryLogo}
              handleProductUpload={handleProductUpload}
              handleProductUrl={handleProductUrl}
              removeProduct={removeProduct}
              handleBrandRefUpload={handleBrandRefUpload}
              handleBrandRefUrl={handleBrandRefUrl}
              removeBrandReference={removeBrandReference}
              handleFirstFrameUpload={handleFirstFrameUpload}
              handleFirstFrameUrl={handleFirstFrameUrl}
              removeFirstFrame={removeFirstFrame}
              handleLastFrameUpload={handleLastFrameUpload}
              handleLastFrameUrl={handleLastFrameUrl}
              removeLastFrame={removeLastFrame}
              handleCtaUpload={handleCtaUpload}
              handleCtaUrl={handleCtaUrl}
              removeCtaGraphic={removeCtaGraphic}
              retryAssetUpload={retryAssetUpload}
              openDiscoveredImageEditor={openDiscoveredImageEditor}
              openLibraryImageEditor={openLibraryImageEditor}
              promptState={promptState}
              updatePersonalizedPrompt={updatePersonalizedPrompt}
              resetPrompt={resetPrompt}
              isPersonalizing={isPersonalizing}
              isRegenerating={isRegenerating}
              handlePersonalize={handlePersonalize}
              handleRegenerate={handleRegenerate}
              handleCopyPrompt={handleCopyPrompt}
              copiedPrompt={copiedPrompt}
              canPersonalize={Boolean(clientForm.businessName || clientForm.name)}
              capabilities={capabilities}
              uploadError={uploadError}
              outputOptions={outputOptions as any}
              outputType={outputType}
              setOutputType={setOutputType}
              isPromptOnly={isPromptOnly}
              showModes={showModes}
              eligibleModes={eligibleModes as any}
              mode={mode}
              setMode={setMode}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              genOptions={genOptions}
              updateGenOptions={updateGenOptions}
               generate={generate}
               closePersonalize={closePersonalize}
               isReadyToGenerate={Boolean((clientForm.businessName || clientForm.name) && (outputType === 'prompt' || mode))}
               effectiveModelId={effectiveModelId}
               recommendedModelId={recommendedModelId}
               recommendedModel={recommendedModel}
               currentModel={currentModel}
                 isUsingRecommendedModel={isUsingRecommendedModel}
                 discoveredAssets={discoveredAssets}
                 discoveryStatus={discoveryStatus}
                 discoveryError={discoveryError}
                 importConfirmation={importConfirmation}
                 setDiscoveredAssets={setDiscoveredAssets}
                toggleDiscoveredAssetSelection={toggleDiscoveredAssetSelection}
                rejectDiscoveredAsset={rejectDiscoveredAsset}
                restoreDiscoveredAsset={restoreDiscoveredAsset}
                updateDiscoveredAssetCategory={updateDiscoveredAssetCategory}
                removeDiscoveredAssetFromSection={removeDiscoveredAssetFromSection}
                moveDiscoveredAssetToSection={moveDiscoveredAssetToSection}
                selectRecommendedDiscoveredAssets={selectRecommendedDiscoveredAssets}
              importDiscoveredAssets={importDiscoveredAssets}
              cancelDiscovery={cancelDiscovery}
              discoverAssets={discoverAssets}
              visionStatus={visionStatus}
              visionError={visionError}
              analyzeDiscoveredAssets={analyzeDiscoveredAssets}
              access={access}
              runDiscoveryWorkflow={runDiscoveryWorkflow}
              // Business search
              businessSearchMode={businessSearchMode}
              businessSearchResults={businessSearchResults}
              businessSearchError={businessSearchError}
              businessSearchQuery={businessSearchQuery}
              selectedBusiness={selectedBusiness}
              businessResearch={businessResearch}
              findBusinesses={findBusinesses}
              selectBusiness={selectBusiness}
              researchBusiness={researchBusiness}
               clearBusinessSearch={clearBusinessSearch}
               setBusinessSearchMode={setBusinessSearchMode}
                // Drag and drop
                dragPayload={dragPayload}
                dragOverSection={dragOverSection}
                dropError={dropError}
                handleAssetDragStart={handleAssetDragStart}
                handleAssetDragEnd={handleAssetDragEnd}
                handleSectionDragEnter={handleSectionDragEnter}
                handleSectionDragOver={handleSectionDragOver}
                handleSectionDragLeave={handleSectionDragLeave}
                handleSectionDrop={handleSectionDrop}
                moveLibraryAssetToSection={moveLibraryAssetToSection}
                removeLibraryAssetFromSection={removeLibraryAssetFromSection}
                deleteLibraryAsset={deleteLibraryAsset}
                revertLibraryAssetToOriginal={revertLibraryAssetToOriginal}
                revertDiscoveredAssetEdit={revertDiscoveredAssetEdit}
              />
          )}
        </main>

        {/* ── STICKY FOOTER ────────────────────────────────────────── */}
        {/* Anonymous sessions never generate: no footer action is offered. */}
        {/* Simple Mode replaces the footer with the wizard's own step navigation. */}
        {!isAnonymous && !personalizationInProgress && !simpleModeActive && generation.status !== 'complete' && generation.status !== 'error' && (
          <footer
            className="flex justify-end gap-2.5 flex-shrink-0"
            style={{
              padding: '18px 26px 22px',
              borderTop: `1px solid ${C.border}`,
              background: '#0e1216',
            }}
          >
            <button
              onClick={closePersonalize}
              className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide"
              style={{
                minHeight: 42,
                padding: '0 19px',
                border: `1px solid ${C.border}`,
                background: C.panel,
                color: 'white',
              }}
            >
              Cancel
            </button>
            <button
              onClick={outputType === 'prompt' ? handlePersonalize : generate}
              disabled={!Boolean((clientForm.businessName || clientForm.name) && (outputType === 'prompt' || mode)) || personalizationInProgress}
              className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{
                minWidth: 190,
                minHeight: 42,
                padding: '0 19px',
                border: `1px solid ${C.cyan}`,
                background: C.cyan,
                color: '#041014',
                boxShadow: '0 8px 26px rgba(41,211,242,.18)',
              }}
            >
              {generateLabel}
            </button>
          </footer>
        )}
      </div>
      <ImageEditorModal
        open={Boolean(imageEditorAsset)}
        asset={imageEditorAsset}
        onClose={() => setImageEditorAsset(null)}
        onApply={handleImageEditorApply}
        onDropAsset={handleImageEditorDrop}
      />
    </div>
  )
}
// eslint-enable react-hooks/rules-of-hooks

// ── Sub-views ────────────────────────────────────────────────────────────────

function ProgressView({ status, progress, message }: { status: string; progress: number; message: string }) {
  return (
    <div className="px-6 py-16 text-center space-y-4">
      <Loader2 size={40} className="mx-auto animate-spin" style={{ color: C.cyan }} />
      <h3 className="text-lg font-bold text-white">{message || (status === 'personalizing-prompt' ? 'Personalizing Prompt...' : 'Generating...')}</h3>
      <div className="max-w-xs mx-auto">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: `linear-gradient(to right, ${C.cyan}, #a855f7)` }} />
        </div>
        <p className="text-xs text-white/40 mt-1">{progress}%</p>
      </div>
    </div>
  )
}

function ErrorView({ errorMessage, retry, generate, stage }: { errorMessage: string | null; retry: () => void; generate: () => void; stage?: 'prompt' | 'generation' | 'research' | 'discovery' | 'upload' }) {
  const retryLabel = stage === 'prompt' ? 'Retry Personalization' : stage === 'generation' ? 'Retry Generation' : stage === 'research' ? 'Retry Research' : stage === 'discovery' ? 'Retry Discovery' : stage === 'upload' ? 'Retry Upload' : 'Retry'
  return (
    <div className="px-6 py-16 text-center space-y-4">
      <AlertTriangle size={40} style={{ color: C.danger }} className="mx-auto" />
      <h3 className="text-lg font-bold text-white">We Could Not Complete This Personalization</h3>
      <p className="text-sm text-white/60 max-w-md mx-auto">{errorMessage || 'An unexpected error occurred.'}</p>
      <p className="text-xs text-white/40">Your client, assets, and settings have been preserved.</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}
        >
          <RefreshCw size={14} /> {retryLabel}
        </button>
        {stage !== 'prompt' && (
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: C.cyan, color: '#041014' }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

function ResultView(props: any) {
  const {
    result, resultTab, setResultTab, source, promptState,
    generateAgain, retryBranding, outputType, setOutputType, download,
    editInImageStudio, editInVideoStudio, publish,
    sharedMediaCount, isVideo, eligibleModes, mode, setMode,
  } = props

  return (
    <div className="py-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white">Your Personalized Content Is Ready</h3>
        <p className="text-xs mt-1 text-white/40">Original on the left, personalized result on the right.</p>
      </div>
      <div className="flex gap-2 border-b border-white/10 pb-px">
        {(result.type === 'prompt' ? ['prompt'] : result.type === 'image' ? ['prompt', 'images'] : ['prompt', 'videos']).map((tab: string) => (
          <button
            key={tab}
            onClick={() => setResultTab(tab)}
            className={classNames('px-4 py-2 text-sm font-medium transition-colors', resultTab === tab ? 'text-cyan-300' : 'text-white/50 hover:text-white/80')}
            style={{ borderBottom: resultTab === tab ? `2px solid ${C.cyan}` : '2px solid transparent' }}
          >
            {tab === 'prompt' ? 'Prompt' : tab === 'images' ? 'Images' : 'Videos'}
          </button>
        ))}
      </div>

      {resultTab === 'prompt' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Original Prompt</span>
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(promptState.original) } catch { /* ignore */ } }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/70">{promptState.original}</pre>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-black/30 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.cyan }}>Personalized Prompt</span>
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/90 mt-2">
              {promptState.edited || promptState.personalized || promptState.original}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={generateAgain} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}>
              <RefreshCw size={14} /> Generate Again
            </button>
          </div>
        </div>
      )}

      {resultTab === 'images' && result.type === 'image' && result.url && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="p-2 border-b border-white/10"><span className="text-xs font-semibold text-white/40">ORIGINAL</span></div>
              {source.sourceMedia && <img src={source.sourceMedia} alt="Original" className="w-full object-contain" style={{ maxHeight: '50vh' }} />}
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.cyanBorder }}>
              <div className="p-2 border-b" style={{ borderColor: C.cyanBorder }}><span className="text-xs font-semibold" style={{ color: C.cyan }}>PERSONALIZED</span></div>
              <img src={result.url} alt="Personalized" className="w-full object-contain" style={{ maxHeight: '50vh' }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              <Download size={14} /> Download
            </button>
            <button onClick={editInImageStudio} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              Edit in Image Studio
            </button>
            <button onClick={publish} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}>
              <Share2 size={14} /> Publish
            </button>
            <button onClick={generateAgain} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              <RefreshCw size={14} /> Generate Again
            </button>
          </div>
        </div>
      )}

      {resultTab === 'videos' && result.type === 'video' && result.url && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="p-2 border-b border-white/10"><span className="text-xs font-semibold text-white/40">ORIGINAL</span></div>
              {source.sourceMedia && <video src={source.sourceMedia} controls autoPlay muted playsInline loop className="w-full" style={{ maxHeight: '50vh' }} />}
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.cyanBorder }}>
              <div className="p-2 border-b" style={{ borderColor: C.cyanBorder }}><span className="text-xs font-semibold" style={{ color: C.cyan }}>PERSONALIZED</span></div>
              <video src={result.url} controls autoPlay muted playsInline loop className="w-full" style={{ maxHeight: '50vh' }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              <Download size={14} /> Download
            </button>
            <button onClick={editInVideoStudio} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              Edit in Video Studio
            </button>
            <button onClick={publish} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}>
              <Share2 size={14} /> Publish
            </button>
            <button onClick={generateAgain} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
              <RefreshCw size={14} /> Generate Again
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">✓ Saved to Shared Media ({sharedMediaCount} total entries)</span>
        </div>
      </div>

      {result.metadata?.postProcessingFailed && retryBranding && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-300">Branding Could Not Be Applied</span>
          </div>
          <p className="text-xs text-white/60 mb-3">
            Your media was generated, but the exact logo or CTA overlay failed. Your original generation is preserved.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={retryBranding}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}
            >
              <RefreshCw size={14} /> Retry Branding
            </button>
            {result.metadata?.originalUrl && (
              <button
                onClick={() => { window.open(result.metadata.originalUrl, '_blank') }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border border-white/10 text-white hover:bg-white/5"
              >
                <Download size={14} /> Download Unbranded Version
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Configuration view (main editing UI) ─────────────────────────────────────

function isAssetInCurrentJob(asset: { id?: string; url?: string; uploadedUrl?: string } | null | undefined, assets: { identities?: PersonalizationAsset[]; logos?: PersonalizationAsset[]; products?: PersonalizationAsset[]; brandReferences?: PersonalizationAsset[]; firstFrame?: PersonalizationAsset | null; lastFrame?: PersonalizationAsset | null; ctaGraphic?: PersonalizationAsset | null; savedReferences?: PersonalizationAsset[] }): boolean {
  if (!asset) return false
  const all = [
    ...(assets.identities || []),
    ...(assets.logos || []),
    ...(assets.products || []),
    ...(assets.brandReferences || []),
    assets.firstFrame,
    assets.lastFrame,
    assets.ctaGraphic,
    ...(assets.savedReferences || []),
  ].filter(Boolean)
  return all.some((a) => a && (a.id === asset.id || a.url === asset.url || a.uploadedUrl === asset.uploadedUrl))
}

function ConfigurationView(props: any) {
  const {
    source, clients, selectedClientId, clientForm,
    selectClient, saveClient, deleteClient, updateClientForm,
    // Saved client assets
    savedClientAssets,
    savedAssetLibraryTab,
    setSavedAssetLibraryTab,
    useSavedClient,
    deleteSavedClient,
    selectSavedAsset,
    setPrimarySavedAsset,
    removeSavedAsset,
    assets,
    handleIdentityUpload, handleIdentityUrl, removeIdentity, setPrimaryIdentity,
    handleLogoUpload, handleLogoUrl, removeLogo, setPrimaryLogo,
    handleProductUpload, handleProductUrl, removeProduct,
    handleBrandRefUpload, handleBrandRefUrl, removeBrandReference,
    handleFirstFrameUpload, handleFirstFrameUrl, removeFirstFrame,
    handleLastFrameUpload, handleLastFrameUrl, removeLastFrame,
    handleCtaUpload, handleCtaUrl, removeCtaGraphic,
    retryAssetUpload,
    openDiscoveredImageEditor,
    openLibraryImageEditor,
    promptState, updatePersonalizedPrompt, resetPrompt,
    isPersonalizing, isRegenerating,
    handlePersonalize, handleRegenerate, handleCopyPrompt, copiedPrompt,
    canPersonalize,
    capabilities,
    uploadError,
    outputOptions, outputType, setOutputType, isPromptOnly,
    showModes, eligibleModes, mode, setMode,
    showAdvanced, setShowAdvanced, genOptions, updateGenOptions,
    effectiveModelId, recommendedModelId, recommendedModel, currentModel, isUsingRecommendedModel,
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
    selectRecommendedDiscoveredAssets,
    importDiscoveredAssets,
    cancelDiscovery,
    discoverAssets,
    visionStatus,
    visionError,
    analyzeDiscoveredAssets,
    // Business search
    businessSearchMode,
    businessSearchResults,
    businessSearchError,
    businessSearchQuery,
    selectedBusiness,
    businessResearch,
    findBusinesses,
    selectBusiness,
    researchBusiness,
    runDiscoveryWorkflow,
    access,
    clearBusinessSearch,
    setBusinessSearchMode,
    dragPayload,
    dragOverSection,
    dropError,
    handleAssetDragStart,
    handleAssetDragEnd,
    handleSectionDragEnter,
    handleSectionDragOver,
    handleSectionDragLeave,
    handleSectionDrop,
    moveLibraryAssetToSection,
    removeLibraryAssetFromSection,
    deleteLibraryAsset,
    revertLibraryAssetToOriginal,
    revertDiscoveredAssetEdit,
  } = props

  // ── Access mode ────────────────────────────────────────────────────────────
  // The access mode is chosen by the caller of openPersonalize (the landing page
  // asks for 'anonymous'), never inferred here, and every endpoint re-checks it
  // server-side. It decides which discovery endpoint is used and which paid/AI
  // affordances exist — the modal never renders a paid action the server has not
  // granted.
  const isAnonymous = access !== 'authenticated'
  const isFreeDiscovery = isAnonymous && source?.sourceMetadata?.freeDiscovery === true
  // Generation config/output sections only exist for entitled users.
  const showGenerationSections = !isAnonymous && !isPromptOnly

  // ── Find Local Business (lead finder) entry flow ───────────────────────────
  // The chooser/how-to-enter panel and the search form are local UI state: the
  // chooser is dismissed once the client decides how to enter their profile,
  // and the search form is controlled so the search can be blocked until both
  // a niche and a location are filled in.
  const [clientEntryDismissed, setClientEntryDismissed] = useState(false)
  const [searchNiche, setSearchNiche] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [searchRadius, setSearchRadius] = useState(15)

  const searchFormReady = Boolean(searchNiche && searchLocation.trim())

  // `businessSearchMode === 'searching'` doubles as "the search form is open"
  // and "a search request is in flight" (the provider sets it before the fetch
  // and flips to results/error afterwards), so a separate flag marks the moment
  // a search was actually fired and blocks duplicate submissions.
  const [businessSearchInFlight, setBusinessSearchInFlight] = useState(false)
  // Ref mirror of the flag so duplicate submissions are rejected even when two
  // click handlers fire in the same tick, before the state update has flushed.
  const businessSearchInFlightRef = useRef(false)

  const isSearchingBusinesses = businessSearchInFlight && businessSearchMode === 'searching'

  // Once the provider reports back (results or error) the form is no longer busy.
  useEffect(() => {
    if (businessSearchMode !== 'searching') {
      businessSearchInFlightRef.current = false
      setBusinessSearchInFlight(false)
    }
  }, [businessSearchMode])

  const handleClientEntryDismiss = useCallback(() => setClientEntryDismissed(true), [])

  // Re-arm the chooser whenever the audience changes, so the entry decision is
  // made again for each audience instead of being remembered forever.
  useEffect(() => {
    setClientEntryDismissed(false)
  }, [clientForm.audience])

  const runBusinessSearch = useCallback((radiusMiles: number) => {
    if (!searchNiche || !searchLocation.trim()) return
    if (businessSearchInFlightRef.current) return
    businessSearchInFlightRef.current = true
    setBusinessSearchInFlight(true)
    setSearchRadius(radiusMiles)
    findBusinesses(searchNiche, searchLocation.trim(), radiusMiles)
  }, [findBusinesses, searchLocation, searchNiche])

  // ── Saved Leads (lead finder shortlist) ────────────────────────────────────
  // Per-user shortlist behind /api/personalization/leads (Clerk-authenticated).
  // Anonymous sessions never render the save affordance or the panel: the API
  // answers 401 for them, matching how the modal hides every other
  // authenticated action (see isAnonymous handling below).
  type LeadRecord = {
    id: string
    business: BusinessDiscoveryRecord
    stage: string
    notes: string | null
    starred: boolean
    niche?: string | null
    location?: string | null
  }
  const [savedLeadsOpen, setSavedLeadsOpen] = useState(false)
  const [savedLeads, setSavedLeads] = useState<LeadRecord[]>([])
  const [savedLeadsLoaded, setSavedLeadsLoaded] = useState(false)
  const [savedLeadsLoading, setSavedLeadsLoading] = useState(false)
  const [savedLeadsError, setSavedLeadsError] = useState<string | null>(null)
  // Per-business save state for the result cards: 'saving' | 'saved' | 'error'.
  const [leadSaveState, setLeadSaveState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})

  const fetchSavedLeads = useCallback(async () => {
    setSavedLeadsLoading(true)
    setSavedLeadsError(null)
    try {
      const res = await fetch('/api/personalization/leads', { credentials: 'same-origin' })
      if (res.status === 401) {
        setSavedLeads([])
        setSavedLeadsError('Sign in to view your saved leads.')
        setSavedLeadsLoaded(false)
        return
      }
      if (!res.ok) throw new Error(`Could not load saved leads (HTTP ${res.status})`)
      const data = await res.json()
      setSavedLeads(Array.isArray(data?.leads) ? data.leads : [])
      setSavedLeadsLoaded(true)
    } catch (err) {
      setSavedLeadsError(err instanceof Error ? err.message : 'Could not load saved leads')
    } finally {
      setSavedLeadsLoading(false)
    }
  }, [])

  const toggleSavedLeads = useCallback(() => {
    const next = !savedLeadsOpen
    setSavedLeadsOpen(next)
    if (next && !savedLeadsLoaded) void fetchSavedLeads()
  }, [fetchSavedLeads, savedLeadsLoaded, savedLeadsOpen])

  // Persist one field change (stage / notes / starred) to the API and merge the
  // authoritative lead row back into the panel state.
  const patchLead = useCallback(async (leadId: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/personalization/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const message = res.status === 401 ? 'Sign in to update saved leads.' : `Update failed (HTTP ${res.status})`
      throw new Error(message)
    }
    const data = await res.json()
    if (data?.lead) {
      setSavedLeads(prev => prev.map((lead) => (lead.id === leadId ? (data.lead as LeadRecord) : lead)))
    }
  }, [])

  const handleSaveLead = useCallback(async (business: BusinessDiscoveryRecord) => {
    if (isAnonymous) return
    setLeadSaveState(prev => ({ ...prev, [business.id]: 'saving' }))
    try {
      const res = await fetch('/api/personalization/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          business,
          stage: 'New',
          niche: businessSearchQuery?.niche || searchNiche || undefined,
          location: businessSearchQuery?.location || searchLocation.trim() || undefined,
        }),
      })
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Sign in to save leads.' : `Save failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      if (data?.lead && savedLeadsLoaded) {
        setSavedLeads(prev => [data.lead as LeadRecord, ...prev.filter((lead) => lead.id !== data.lead.id)])
      }
      setLeadSaveState(prev => ({ ...prev, [business.id]: 'saved' }))
    } catch {
      setLeadSaveState(prev => ({ ...prev, [business.id]: 'error' }))
    }
  }, [businessSearchQuery, isAnonymous, savedLeadsLoaded, searchLocation, searchNiche])

  const handleDeleteLead = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/personalization/leads/${leadId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const message = res.status === 401 ? 'Sign in to delete saved leads.' : `Delete failed (HTTP ${res.status})`
      setSavedLeadsError(message)
      return
    }
    setSavedLeads(prev => prev.filter((lead) => lead.id !== leadId))
  }, [])


  // ── Find My Brand (the automated workflow) ────────────────────────────────
  // ONE starting action that accepts a website URL or opens the existing
  // niche/location search. Submitting runs the provider's `runDiscoveryWorkflow`,
  // which populates the client form via the existing `selectBusiness` mapping,
  // runs the shared research path and then asset discovery — for both a URL
  // submission and a search-result selection. Nothing is re-entered and the
  // visitor never leaves this modal.
  const [findMyBrandUrl, setFindMyBrandUrl] = useState('')
  const [brandRunInFlight, setBrandRunInFlight] = useState(false)
  const brandRunInFlightRef = useRef(false)

  const handleFindMyBrand = useCallback(async () => {
    const website = findMyBrandUrl.trim()
    if (!website || brandRunInFlightRef.current) return
    brandRunInFlightRef.current = true
    setBrandRunInFlight(true)
    try {
      await runDiscoveryWorkflow(website)
    } finally {
      brandRunInFlightRef.current = false
      setBrandRunInFlight(false)
    }
  }, [findMyBrandUrl, runDiscoveryWorkflow])

  // Selecting a business from the search results. In every mode the selection
  // runs the same automated workflow: populate the client form, research the
  // business and discover its brand assets in one run. Discovery is free for
  // all users — never behind a paid entitlement or plan check.
  const handleSelectBusiness = useCallback((business: BusinessDiscoveryRecord) => {
    if (!business.website || !business.website.trim()) {
      setDiscoveryError('No website is listed for this business. Paste one in the Website field and use Find My Brand.')
      return
    }
    // Populate, research and discover in one automated run.
    void runDiscoveryWorkflow(business.website.trim(), { business })
  }, [runDiscoveryWorkflow, selectBusiness, setDiscoveryError])

  const handleOpenSavedLead = useCallback((lead: LeadRecord) => {
    // Same selection path the result cards use, so the Personalization handoff
    // (anonymous automated run or authenticated select) is identical.
    setSavedLeadsOpen(false)
    handleSelectBusiness(lead.business)
  }, [handleSelectBusiness])

  const handleOpenBusinessSearch = useCallback(() => {
    // The existing niche/location search form is gated on the customer
    // audience, so ask for it explicitly: the same form now doubles as the
    // "or search for my business instead" branch of Find My Brand.
    updateClientForm({ audience: 'customer' })
    setBusinessSearchMode('searching')
  }, [setBusinessSearchMode, updateClientForm])

  // A single progress indicator covers the whole run: research and discovery in
  // anonymous mode are one server round trip, and in authenticated mode the
  // indicator stays lit across both phases.
  const showBrandRunProgress = brandRunInFlight || discoveryStatus === 'discovering'
  const brandRunProgressMessage = 'Reading the website and finding the brand assets already on it…'

  // ── Paid AI affordances (never offered to free visitors) ───────────────────
  // The server refuses image edits / vision / generation for anonymous
  // sessions, so the matching "Edit with AI" affordances are not rendered at
  // all instead of failing after the click.
  //
  // Extension point: transparent-logo generation and advanced categorisation
  // both plug in ON TOP of these handlers (same discovered-asset thumb, same
  // section assignment) — they never need a second results surface or a second
  // modal, so the free surface gains them by re-enabling these affordances for
  // the entitlement that grants them.
  const onEditDiscovered = isAnonymous ? null : openDiscoveredImageEditor
  const onEditLibrary = isAnonymous ? null : openLibraryImageEditor

  const identityInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const brandRefInputRef = useRef<HTMLInputElement>(null)
  const [batchVideoReady, setBatchVideoReady] = useState<{
    running: boolean
    current: number
    total: number
    label: string
    error: string | null
  }>({ running: false, current: 0, total: 0, label: '', error: null })
  const batchVideoReadyRunningRef = useRef(batchVideoReady.running)

  const handleIdentityAddClick = useCallback(() => {
    identityInputRef.current?.click()
  }, [])
  const handleLogoAddClick = useCallback(() => {
    logoInputRef.current?.click()
  }, [])
  const handleProductAddClick = useCallback(() => {
    productInputRef.current?.click()
  }, [])
  const handleBrandRefAddClick = useCallback(() => {
    brandRefInputRef.current?.click()
  }, [])

  // ── What SmartVideo Will Use summary ─────────────────────────────────────

  const assetSummary = useMemo(() => {
    const items: { id: string; section: string; name: string; url: string }[] = []
    if (assets.primaryIdentity) {
      items.push({ id: assets.primaryIdentity.id, section: 'Person', name: assets.primaryIdentity.name, url: assets.primaryIdentity.uploadedUrl || assets.primaryIdentity.url })
    }
    assets.identities.forEach((a) => {
      if (a.id === assets.primaryIdentity?.id) return
      items.push({ id: a.id, section: 'Person', name: a.name, url: a.uploadedUrl || a.url })
    })
    if (assets.primaryLogo) {
      items.push({ id: assets.primaryLogo.id, section: 'Logo', name: assets.primaryLogo.name, url: assets.primaryLogo.uploadedUrl || assets.primaryLogo.url })
    }
    assets.logos.forEach((a) => {
      if (a.id === assets.primaryLogo?.id) return
      items.push({ id: a.id, section: 'Logo', name: a.name, url: a.uploadedUrl || a.url })
    })
    assets.products.forEach((a) => items.push({ id: a.id, section: 'Products', name: a.name, url: a.uploadedUrl || a.url }))
    assets.brandReferences.forEach((a) => items.push({ id: a.id, section: 'Brand', name: a.name, url: a.uploadedUrl || a.url }))
    if (assets.firstFrame) items.push({ id: assets.firstFrame.id, section: 'First Frame', name: assets.firstFrame.name, url: assets.firstFrame.uploadedUrl || assets.firstFrame.url })
    if (assets.lastFrame) items.push({ id: assets.lastFrame.id, section: 'Last Frame', name: assets.lastFrame.name, url: assets.lastFrame.uploadedUrl || assets.lastFrame.url })
    if (assets.ctaGraphic) items.push({ id: assets.ctaGraphic.id, section: 'CTA', name: assets.ctaGraphic.name, url: assets.ctaGraphic.uploadedUrl || assets.ctaGraphic.url })
    return items
  }, [assets])

  const handleBatchMakeVideoReady = useCallback(async () => {
    const selected = discoveredAssets.filter((asset: DiscoveredAsset) =>
      asset.selected &&
      !asset.rejected &&
      asset.category !== 'irrelevant' &&
      !asset.videoReady
    )
    if (selected.length === 0 || batchVideoReadyRunningRef.current) return

    batchVideoReadyRunningRef.current = true
    setBatchVideoReady({ running: true, current: 0, total: selected.length, label: 'Preparing assets', error: null })
    let nextAssets = [...discoveredAssets]
    const failures: string[] = []

    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index]
      setBatchVideoReady((previous) => ({
        ...previous,
        current: index + 1,
        label: item.category.replace(/_/g, ' ') + ' · starting',
      }))

      try {
        const result = await makeDiscoveredAssetVideoReady(
          item,
          {
            businessName: clientForm.businessName || clientForm.name,
            industry: clientForm.industry,
          },
          (_step, _totalSteps, label) => {
            setBatchVideoReady((previous) => ({
              ...previous,
              current: index + 1,
              label,
            }))
          },
        )

        nextAssets = nextAssets.map((asset: DiscoveredAsset) => (
          asset.id === item.id
            ? {
                ...asset,
                originalPreviewUrl: asset.originalPreviewUrl || asset.previewUrl,
                editedDataUrl: result.dataUrl,
                edited: true,
                videoReady: true,
                hasTransparency: result.transparent,
                editMetadata: {
                  operation: result.operation,
                  prompt: result.prompt,
                  model: result.model,
                  quality: result.quality,
                },
                visionAnalysis: result.visionAnalysis || asset.visionAnalysis,
                visionValidation: result.visionValidation,
              }
            : asset
        ))
        setDiscoveredAssets(nextAssets)
      } catch (error) {
        failures.push(
          item.category.replace(/_/g, ' ') + ': ' +
          (error instanceof Error ? error.message : 'Video Ready failed')
        )
      }
    }

    setBatchVideoReady({
      running: false,
      current: selected.length,
      total: selected.length,
      label: failures.length ? 'Completed with errors' : 'Selected assets are video ready',
      error: failures.length ? failures.join(' • ') : null,
    })
    batchVideoReadyRunningRef.current = false
  }, [clientForm.businessName, clientForm.industry, clientForm.name, discoveredAssets, setDiscoveredAssets])

    return (
      <div>
        {dropError && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.danger}`, background: 'rgba(239,91,103,.08)', color: '#ff9ba3', fontSize: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} />
            <span>{dropError}</span>
          </div>
        )}
        {/* Hidden file inputs for add-more placeholders */}
       <input ref={identityInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleIdentityUpload(e.target.files); e.target.value = '' }} />
       <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleLogoUpload(e.target.files); e.target.value = '' }} />
       <input ref={productInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { handleProductUpload(e.target.files); e.target.value = '' }} />
       <input ref={brandRefInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { handleBrandRefUpload(e.target.files); e.target.value = '' }} />

       {/* ── WHAT SMARTVIDEO WILL USE ─────────────────────────────── */}
       <section style={{ padding: '18px 0 10px', borderBottom: `1px solid ${C.border}` }}>
         <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 10 }}>
           <div>
             <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>What SmartVideo Will Use</h2>
             <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11 }}>
               {assetSummary.length} asset{assetSummary.length === 1 ? '' : 's'} assigned across {new Set(assetSummary.map((a) => a.section)).size} block{new Set(assetSummary.map((a) => a.section)).size === 1 ? '' : 's'}
             </p>
           </div>
         </div>
         <div className="flex flex-wrap gap-2">
           {assetSummary.map((item) => (
             <div
               key={item.id}
               className="flex items-center gap-1.5 rounded-lg px-2 py-1"
               style={{ background: 'rgba(41,211,242,.06)', border: `1px solid rgba(41,211,242,.18)` }}
             >
               <img src={item.url} alt="" className="w-5 h-5 rounded object-cover" style={{ background: '#000' }} />
               <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{item.name?.split('.')?.[0]?.toUpperCase()?.slice(0, 8) || 'ASSET'}</span>
               <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: C.cyan }}>{item.section}</span>
             </div>
           ))}
           {assetSummary.length === 0 && (
             <span style={{ fontSize: 11, color: C.muted2 }}>No assets assigned yet.</span>
           )}
         </div>
       </section>

      {/* ── TOP OVERVIEW: Source Demo | Client Profile ────────────── */}
      <section id="pz-overview" className="grid grid-cols-1 lg:grid-cols-2" style={{ padding: '20px 0', gap: 18, scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        {/* Source Demo */}
        <div className="panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <h2 style={{ margin: '0 0 13px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Source Demo</h2>
          <div
            className="relative"
            style={{
              aspectRatio: '16 / 10',
              borderRadius: 13,
              overflow: 'hidden',
              background: 'linear-gradient(rgba(0,0,0,.24), rgba(0,0,0,.38)), linear-gradient(135deg, #303944, #12171c 70%)',
              border: `1px solid ${C.border}`,
            }}
          >
            {source.aspectRatio && (
              <div className="absolute" style={{ right: 10, top: 10, fontSize: 10, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,0,0,.55)' }}>
                {source.aspectRatio}
              </div>
            )}
            {source.mediaType === 'video' && source.sourceMedia ? (
              <video
                src={source.sourceMedia}
                poster={source.poster || undefined}
                controls
                autoPlay
                muted
                playsInline
                loop
                className="w-full h-full"
                style={{ maxHeight: '50vh', objectFit: 'contain' }}
              />
            ) : source.mediaType === 'image' && source.sourceMedia ? (
              <img
                src={source.sourceMedia}
                alt={source.title}
                className="w-full h-full"
                style={{ maxHeight: '50vh', objectFit: 'contain' }}
              />
            ) : isFreeDiscovery ? (
              /* Free landing surface: there is no media to preview — the run
                 reads the visitor's own website. Kept inside the shared Source
                 Demo panel so the layout is identical in both modes. The
                 branded-preview enhancement plugs in here later. */
              <div className="flex flex-col items-center justify-center w-full h-full gap-2 p-6 text-center">
                <span style={{ fontSize: 26, color: C.cyan }}>✦</span>
                <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: C.text }}>
                  Your website is the source
                </span>
                <span className="text-[11px] leading-5" style={{ color: C.muted }}>
                  Paste it above and we show the brand assets it already has.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <button
                  className="w-[62px] h-[62px] rounded-full flex items-center justify-center text-2xl"
                  style={{ border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.18)', color: 'white', backdropFilter: 'blur(8px)' }}
                  aria-label="Play source preview"
                >
                  ▶
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 text-base font-bold">{source.title}</div>
          <div className="mt-1 text-[11px] uppercase" style={{ color: C.muted }}>
            {isFreeDiscovery ? 'Free discovery' : source.mediaType?.toUpperCase()} {source.aspectRatio ? `• ${source.aspectRatio}` : ''}
          </div>
        </div>

        {/* Client Profile */}
        <div className="panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <h2 style={{ margin: '0 0 13px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>STEP 1 — WHO IS THIS FOR?</h2>

          {/* ── FIND MY BRAND — the single primary starting action ───────────
              Available in every personalization modal (anonymous and
              authenticated alike). Discovery itself is free for all users —
              it is never behind a paid entitlement or plan check.            */}
          <div
            id="pz-find-my-brand"
            data-testid="find-my-brand"
            style={{
              marginBottom: 18,
              padding: 14,
              border: `1px solid ${C.cyan}`,
              borderRadius: 10,
              background: 'rgba(41,211,242,.05)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.cyan, marginBottom: 6, letterSpacing: '.04em' }}>
              Find My Brand
            </div>
            <p style={{ margin: '0 0 10px', color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
              Paste a business website. We read the page it already has and show the logos, photos, products and branding found on it — nothing is generated and nothing is charged.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="find-my-brand-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://yourbusiness.com"
                value={findMyBrandUrl}
                onChange={(e) => setFindMyBrandUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleFindMyBrand() } }}
                disabled={brandRunInFlight}
                className="w-full min-w-0 outline-none disabled:opacity-60"
                style={{
                  minHeight: 42,
                  padding: '0 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  background: C.field,
                  color: C.text,
                  fontSize: 12,
                }}
              />
              <button
                type="button"
                id="find-my-brand-submit"
                data-testid="find-my-brand-submit"
                onClick={() => void handleFindMyBrand()}
                disabled={brandRunInFlight || !findMyBrandUrl.trim()}
                className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  minHeight: 42,
                  padding: '0 18px',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${C.cyan}`,
                  background: C.cyan,
                  color: '#041014',
                }}
              >
                {brandRunInFlight ? 'Finding…' : '✦ Find My Brand'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpenBusinessSearch}
              disabled={brandRunInFlight}
              className="mt-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 30, padding: '0 10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.cyan }}
            >
              Or find a local business by niche &amp; location
            </button>

            {/* One progress indicator for the whole run: research + discovery. */}
            {showBrandRunProgress && (
              <div
                data-testid="find-my-brand-progress"
                role="status"
                aria-live="polite"
                style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text }}
              >
                <Loader2 size={14} className="animate-spin" aria-hidden="true" style={{ color: C.cyan }} />
                <span>{brandRunProgressMessage}</span>
              </div>
            )}
            {discoveryError && (
              <p
                role="alert"
                data-testid="find-my-brand-error"
                style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: C.danger }}
              >
                {discoveryError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 18 }}>
            {[
              { key: 'me', label: 'Me' },
              { key: 'my-business', label: 'My Business' },
              { key: 'customer', label: 'Client' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => updateClientForm({ ...clientForm, audience: key })}
                className="rounded-lg text-[11px] font-extrabold uppercase tracking-wide"
                style={{
                  minHeight: 38,
                  border: `1px solid ${clientForm.audience === key ? C.cyan : C.border}`,
                  background: clientForm.audience === key ? C.cyan : '#11161b',
                  color: clientForm.audience === key ? '#051014' : C.text,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Find Local Business */}
          {clientForm.audience === 'customer' && businessSearchMode === 'idle' && !clientEntryDismissed && (
            <div style={{ marginBottom: 18, padding: 14, border: `1px dashed ${C.border}`, borderRadius: 10, background: 'rgba(41,211,242,.03)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>How would you like to add this client?</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBusinessSearchMode && setBusinessSearchMode('searching')}
                  className="rounded-lg text-[11px] font-extrabold uppercase tracking-wide"
                  style={{
                    minHeight: 38,
                    padding: '0 16px',
                    border: `1px solid ${C.cyan}`,
                    background: C.cyanSoft,
                    color: C.cyan,
                  }}
                >
                  Find Local Business
                </button>
                <button
                  type="button"
                  onClick={handleClientEntryDismiss}
                  className="rounded-lg text-[11px] font-extrabold uppercase tracking-wide"
                  style={{
                    minHeight: 38,
                    padding: '0 16px',
                    border: `1px solid ${C.border}`,
                    background: '#11161b',
                    color: C.text,
                  }}
                >
                  Enter Business Manually
                </button>
              </div>
              <p style={{ marginTop: 8, color: C.muted2, fontSize: 10, lineHeight: 1.5 }}>
                Find businesses by niche and location, then personalize this creative for a selected business.
              </p>
            </div>
          )}

          {/* Business Search Form */}
          {clientForm.audience === 'customer' && businessSearchMode === 'searching' && (
            <div style={{ marginBottom: 18, padding: 16, border: `1px solid ${C.border}`, borderRadius: 10, background: C.panelSoft }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Find Local Business</div>
              <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
                Find businesses by niche and location, then personalize this creative for a selected business.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10, marginBottom: 12 }}>
                <div>
                  <label htmlFor="business-niche" style={{ display: 'block', marginBottom: 4, color: C.muted, fontSize: 10 }}>Business Type / Niche</label>
                  <select
                    id="business-niche"
                    value={searchNiche}
                    onChange={(e) => setSearchNiche(e.target.value)}
                    className="w-full outline-none"
                    style={{
                      minHeight: 40,
                      padding: '0 11px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: C.field,
                      color: C.text,
                    }}
                  >
                    <option value="">Select a niche...</option>
                    {BUSINESS_NICHES.map((niche) => (
                      <option key={niche.key} value={niche.key}>{niche.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="business-location" style={{ display: 'block', marginBottom: 4, color: C.muted, fontSize: 10 }}>Location</label>
                  <input
                    id="business-location"
                    type="text"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="Hollywood, Florida"
                    className="w-full outline-none"
                    style={{
                      minHeight: 40,
                      padding: '0 11px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: C.field,
                      color: C.text,
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, color: C.muted, fontSize: 10 }}>Search Radius</label>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 25, 50].map((miles) => (
                    <button
                      key={miles}
                      type="button"
                      onClick={() => runBusinessSearch(miles)}
                      disabled={!searchFormReady || isSearchingBusinesses}
                      className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                      style={{
                        minHeight: 34,
                        padding: '0 12px',
                        border: `1px solid ${searchRadius === miles ? C.cyan : C.border}`,
                        background: '#11161b',
                        color: C.text,
                      }}
                    >
                      {miles} mi
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => runBusinessSearch(searchRadius)}
                disabled={!searchFormReady || isSearchingBusinesses}
                className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  minHeight: 42,
                  padding: '0 19px',
                  border: `1px solid ${C.cyan}`,
                  background: C.cyan,
                  color: '#041014',
                }}
              >
                Find Businesses
              </button>
              <button
                type="button"
                onClick={() => clearBusinessSearch()}
                className="ml-2 rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide"
                style={{
                  minHeight: 42,
                  padding: '0 19px',
                  border: `1px solid ${C.border}`,
                  background: C.panel,
                  color: 'white',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Business Search Error */}
          {clientForm.audience === 'customer' && businessSearchMode === 'error' && businessSearchError && (
            <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${C.danger}`, borderRadius: 10, background: 'rgba(239,91,103,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.danger, fontSize: 14 }}>⚠</span>
                <span style={{ color: C.danger, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Business Search Failed</span>
              </div>
              <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,.72)', fontSize: 11, lineHeight: 1.5 }}>{businessSearchError}</p>
              <button
                type="button"
                onClick={() => setBusinessSearchMode && setBusinessSearchMode('searching')}
                className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide"
                style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.danger}`, background: C.danger, color: '#fff' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Business Search Results */}
          {clientForm.audience === 'customer' && businessSearchMode === 'results' && businessSearchResults.length > 0 && (
            <div style={{ marginBottom: 18, padding: 16, border: `1px solid ${C.border}`, borderRadius: 10, background: C.panelSoft }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Search Results</div>
                  <div style={{ fontSize: 11, color: C.text }}>
                    {businessSearchResults.length} businesses found for {businessSearchQuery?.niche} near {businessSearchQuery?.location}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!isAnonymous && (
                    <button
                      type="button"
                      onClick={toggleSavedLeads}
                      className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                      style={{
                        minHeight: 32,
                        padding: '0 12px',
                        border: `1px solid ${savedLeadsOpen ? C.cyanBorder : C.border}`,
                        background: savedLeadsOpen ? C.cyanSoft : C.panel,
                        color: savedLeadsOpen ? C.cyan : 'white',
                      }}
                    >
                      Saved Leads{savedLeadsLoaded ? ` (${savedLeads.length})` : ''}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => clearBusinessSearch()}
                    className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                    style={{
                      minHeight: 32,
                      padding: '0 12px',
                      border: `1px solid ${C.border}`,
                      background: C.panel,
                      color: 'white',
                    }}
                  >
                    New Search
                  </button>
                </div>
              </div>
              {!savedLeadsOpen && (
              <div className="flex flex-col gap-2">
                {businessSearchResults.map((business) => (
                  <div
                    key={business.id}
                    style={{
                      padding: 12,
                      border: `1px solid ${selectedBusiness?.id === business.id ? C.cyanBorder : C.border}`,
                      borderRadius: 10,
                      background: selectedBusiness?.id === business.id ? 'rgba(41,211,242,.06)' : '#11161b',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSelectBusiness(business)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                          {business.name}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                          {business.category}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                          {[business.address, business.city, business.region].filter(Boolean).join(', ')}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                          {business.phone && (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.green }}>✓ Phone</span>
                          )}
                          {business.website ? (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.green }}>✓ Website</span>
                          ) : (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted2 }}>Not listed in OpenStreetMap</span>
                          )}
                          {business.instagram && (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.cyan }}>✓ Instagram</span>
                          )}
                          {business.facebook && (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.cyan }}>✓ Facebook</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {business.ownership && (
                            <span style={ownershipBadgeStyle(business.ownership)}>{ownershipLabel(business.ownership)}</span>
                          )}
                          <div
                            style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: C.cyan }}
                            title={businessOpportunityTitle(business)}
                          >
                            {Math.round(business.leadScore || 0)}% match
                          </div>
                        </div>
                        {!isAnonymous && (
                          <button
                            type="button"
                            disabled={leadSaveState[business.id] === 'saving'}
                            onClick={(e) => { e.stopPropagation(); void handleSaveLead(business) }}
                            className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                            style={{
                              minHeight: 32,
                              padding: '0 12px',
                              border: `1px solid ${leadSaveState[business.id] === 'saved' ? 'rgba(40,201,139,.45)' : leadSaveState[business.id] === 'error' ? C.danger : C.border}`,
                              background: leadSaveState[business.id] === 'saved' ? 'rgba(40,201,139,.12)' : C.panel,
                              color: leadSaveState[business.id] === 'saved' ? C.green : leadSaveState[business.id] === 'error' ? C.danger : 'white',
                            }}
                          >
                            {leadSaveState[business.id] === 'saved' ? 'Saved ✓' : leadSaveState[business.id] === 'error' ? 'Save failed' : leadSaveState[business.id] === 'saving' ? 'Saving…' : 'Save Lead'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectBusiness(business) }}
                          className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                          style={{
                            minHeight: 32,
                            padding: '0 12px',
                            border: `1px solid ${C.cyan}`,
                            background: C.cyan,
                            color: '#041014',
                          }}
                        >
                          Use This Business
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
              {!savedLeadsOpen && (
                <p style={{ marginTop: 10, color: C.muted2, fontSize: 9, lineHeight: 1.4 }}>
                  © OpenStreetMap contributors. Website absence in OpenStreetMap does not mean the business has no website.
                </p>
              )}
              {savedLeadsOpen && (
                <div className="flex flex-col gap-2">
                  {savedLeadsLoading && (
                    <div style={{ padding: 12, fontSize: 11, color: C.muted }}>Loading saved leads…</div>
                  )}
                  {savedLeadsError && (
                    <div style={{ padding: 12, fontSize: 11, color: C.danger }}>{savedLeadsError}</div>
                  )}
                  {!savedLeadsLoading && !savedLeadsError && savedLeads.length === 0 && (
                    <div style={{ padding: 12, fontSize: 11, color: C.muted }}>
                      No saved leads yet. Use “Save Lead” on a search result to build your shortlist.
                    </div>
                  )}
                  {savedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        padding: 12,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        background: '#11161b',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <button
                              type="button"
                              aria-label={lead.starred ? 'Unstar lead' : 'Star lead'}
                              onClick={() => {
                                setSavedLeadsError(null)
                                void patchLead(lead.id, { starred: !lead.starred }).catch((err: Error) => setSavedLeadsError(err.message))
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                lineHeight: 1,
                                padding: 0,
                                color: lead.starred ? '#f5b545' : C.muted2,
                              }}
                            >
                              {lead.starred ? '★' : '☆'}
                            </button>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                              {lead.business?.name || 'Saved business'}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
                            {[lead.business?.category, lead.business?.city].filter(Boolean).join(' · ')}
                          </div>
                          {lead.business?.ownership && (
                            <span style={ownershipBadgeStyle(lead.business.ownership)}>
                              {ownershipLabel(lead.business.ownership)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select
                              aria-label="Lead stage"
                              value={isLeadStage(lead.stage) ? lead.stage : LEAD_STAGES[0]}
                              onChange={(e) => {
                                const stage = e.target.value
                                setSavedLeads(prev => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)))
                                setSavedLeadsError(null)
                                void patchLead(lead.id, { stage }).catch((err: Error) => setSavedLeadsError(err.message))
                              }}
                              className="rounded-lg outline-none"
                              style={{
                                minHeight: 32,
                                padding: '0 8px',
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                background: C.field,
                                color: C.text,
                                fontSize: 11,
                              }}
                            >
                              {LEAD_STAGES.map((stage) => (
                                <option key={stage} value={stage}>{stage}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Notes"
                            defaultValue={lead.notes || ''}
                            onBlur={(e) => {
                              const notes = e.target.value
                              if (notes === (lead.notes ?? '')) return
                              setSavedLeadsError(null)
                              void patchLead(lead.id, { notes }).catch((err: Error) => setSavedLeadsError(err.message))
                            }}
                            className="rounded-lg outline-none"
                            style={{
                              minHeight: 32,
                              width: 200,
                              padding: '0 8px',
                              border: `1px solid ${C.border}`,
                              borderRadius: 8,
                              background: C.field,
                              color: C.text,
                              fontSize: 11,
                            }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenSavedLead(lead)}
                              className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                              style={{
                                minHeight: 32,
                                padding: '0 12px',
                                border: `1px solid ${C.cyan}`,
                                background: C.cyan,
                                color: '#041014',
                              }}
                            >
                              Open in Personalization
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteLead(lead.id)}
                              className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                              style={{
                                minHeight: 32,
                                padding: '0 12px',
                                border: `1px solid ${C.border}`,
                                background: C.panel,
                                color: C.muted,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Business Summary — also shown for the Find My Brand
              workflow, whose result arrives here rather than on a second screen. */}
          {businessSearchMode === 'selected' && selectedBusiness && (
            <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${C.cyan}`, borderRadius: 10, background: 'rgba(41,211,242,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.cyan, fontSize: 14 }}>✓</span>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Selected: {selectedBusiness.name}</span>
              </div>
              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                {[selectedBusiness.category, selectedBusiness.address, selectedBusiness.city, selectedBusiness.region].filter(Boolean).join(' • ')}
                {selectedBusiness.phone && <div>Phone: {selectedBusiness.phone}</div>}
                <div>
                  <label style={{ display: 'block', marginBottom: 4, color: C.muted, fontSize: 10 }}>Website</label>
                  <input
                    type="text"
                    value={clientForm.website || ''}
                    onChange={(e) => updateClientForm({ ...clientForm, website: e.target.value })}
                    placeholder={selectedBusiness.website || 'https://corrected-website.com'}
                    className="w-full outline-none"
                    style={{
                      minHeight: 34,
                      padding: '0 10px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: C.field,
                      color: C.text,
                      fontSize: 11,
                    }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!isAnonymous && (
                  <button
                    type="button"
                    onClick={() => researchBusiness()}
                    disabled={businessResearch.status === 'researching'}
                    className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                    style={{
                      minHeight: 38,
                      padding: '0 16px',
                      border: `1px solid ${C.cyan}`,
                      background: businessResearch.status === 'done' ? '#041014' : C.cyan,
                      color: businessResearch.status === 'done' ? C.cyan : '#041014',
                    }}
                  >
                    {businessResearch.status === 'researching' ? 'Researching...' : businessResearch.status === 'done' ? 'Research Complete' : 'Research Business'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => clearBusinessSearch()}
                  className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide"
                  style={{
                    minHeight: 38,
                    padding: '0 16px',
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.muted,
                  }}
                >
                  Choose Different Business
                </button>
              </div>
              {businessResearch.status === 'researching' && (
                <div style={{ marginTop: 8, fontSize: 10, color: C.muted }}>
                  SmartVideo GO AI is verifying this business and finding available brand assets...
                </div>
              )}
              {businessResearch.status === 'done' && businessResearch.result && (
                <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, background: '#11161b' }}>
                  {businessResearch.result.title && (
                    <div style={{ fontSize: 10, color: C.text, marginBottom: 2 }}>
                      <strong>Title:</strong> {businessResearch.result.title}
                    </div>
                  )}
                  {businessResearch.result.description && (
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                      <strong>Description:</strong> {businessResearch.result.description}
                    </div>
                  )}
                  {businessResearch.result.logoUrl && (
                    <div style={{ fontSize: 10, color: C.cyan, marginBottom: 2 }}>
                      <strong>Logo:</strong> <a href={businessResearch.result.logoUrl} target="_blank" rel="noopener noreferrer">Found</a>
                    </div>
                  )}
                  {businessResearch.result.socialLinks && Object.keys(businessResearch.result.socialLinks).length > 0 && (
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                      <strong>Social:</strong> {Object.keys(businessResearch.result.socialLinks).join(', ')}
                    </div>
                  )}
                  {businessResearch.result.contactInfo?.phones?.length > 0 && (
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                      <strong>Phones:</strong> {businessResearch.result.contactInfo.phones.join(', ')}
                    </div>
                  )}
                  {businessResearch.result.contactInfo?.emails?.length > 0 && (
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                      <strong>Emails:</strong> {businessResearch.result.contactInfo.emails.join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: C.muted2, marginTop: 4 }}>
                    Website reachable: {businessResearch.result.reachable ? '✓ Yes' : '✗ No'}
                  </div>
                </div>
              )}
              {businessResearch.status === 'error' && businessResearch.error && (
                <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.danger}`, borderRadius: 8, background: 'rgba(239,91,103,.08)' }}>
                  <div style={{ fontSize: 10, color: C.danger }}>Research failed: {businessResearch.error}</div>
                  {!isAnonymous && (
                    <button
                      type="button"
                      onClick={() => researchBusiness()}
                      className="mt-2 rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide"
                      style={{ minHeight: 30, padding: '0 10px', border: `1px solid ${C.danger}`, background: C.danger, color: '#fff' }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Saved Clients — entitlement-gated: free visitors have no saved
              profiles, so the control is not offered at all. */}
          {!isAnonymous && clientForm.audience === 'customer' && clients.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Saved Clients</div>
              <div className="flex flex-wrap gap-2">
                {clients.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => useSavedClient(c.id)}
                    className="text-left"
                    style={{
                      minWidth: 160,
                      padding: '10px 12px',
                      border: `1px solid ${selectedClientId === c.id ? C.cyan : C.border}`,
                      borderRadius: 10,
                      background: selectedClientId === c.id ? 'rgba(34,211,242,.08)' : C.panelSoft,
                      color: C.text,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{c.businessName || c.name || 'Untitled'}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      {[c.industry, c.location].filter(Boolean).join(' • ') || 'No details'}
                    </div>
                    {selectedClientId === c.id && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); updateClientForm({ ...clientForm, ...c }) }}
                          className="text-[10px] font-extrabold uppercase"
                          style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this client and their saved assets?')) deleteSavedClient(c.id) }}
                          className="text-[10px] font-extrabold uppercase"
                          style={{ color: C.danger, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ResumeProjectBanner />
          <h2 style={{ margin: '0 0 13px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Client Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
            <div className="col-span-full">
              <Field label="Website" value={clientForm.website} placeholder="https://joesroofing.com" onChange={(v) => updateClientForm({ ...clientForm, website: v })} full />
              <button
                type="button"
                onClick={() => discoverAssets(clientForm.website)}
                disabled={!clientForm.website || discoveryStatus === 'discovering'}
                aria-busy={discoveryStatus === 'discovering'}
                className="mt-2 rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                style={{
                  minHeight: 42,
                  padding: '0 19px',
                  border: `1px solid ${C.cyan}`,
                  background: C.cyan,
                  color: '#041014',
                }}
              >
                {discoveryStatus === 'discovering' ? 'Discovering...' : 'Find Business Assets'}
              </button>
              <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {discoveryStatus === 'discovering' && 'Finding business assets'}
                {discoveryStatus === 'reviewing' && `Discovery complete. ${discoveredAssets.filter((a) => !a.rejected).length} assets found.`}
                {importConfirmation && `${importConfirmation.count} assets imported`}
                {discoveryError && `Discovery error: ${discoveryError}`}
              </div>
              <p style={{ marginTop: 6, color: C.muted, fontSize: 10, lineHeight: 1.5 }}>
                Optional — use your website to find business assets automatically, or add them manually below.
              </p>
              {discoveryError && (
                <div style={{ marginTop: 10, padding: 12, border: `1px solid ${C.danger}`, borderRadius: 10, background: 'rgba(239,91,103,.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: C.danger, fontSize: 14 }}>⚠</span>
                    <span style={{ color: C.danger, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>We couldn&apos;t find business assets</span>
                  </div>
                  <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,.72)', fontSize: 11, lineHeight: 1.5 }}>{discoveryError}</p>
                  <button
                    type="button"
                    onClick={() => discoverAssets(clientForm.website)}
                    className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide"
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.danger}`, background: C.danger, color: '#fff' }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            {!isAnonymous && (
              <div className="col-span-full">
                <label style={{ display: 'block', marginBottom: 6, color: C.muted, fontSize: 10 }}>Select Existing Client</label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => selectClient(e.target.value)}
                    className="flex-1 outline-none"
                    style={{
                      minHeight: 40,
                      padding: '0 11px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: C.field,
                      color: C.text,
                    }}
                  >
                    <option value="">Select Existing Client</option>
                    {clients?.map?.((c: any) => (
                      <option key={c.id} value={c.id}>{c.businessName || c.name || c.id}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { selectClient(''); updateClientForm({ ...clientForm, id: '', name: '', businessName: '' }) }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                  >
                    New
                  </button>
                </div>
              </div>
            )}
            <Field label="Business Name" value={clientForm.businessName} placeholder="ABC Roofing" onChange={(v) => updateClientForm({ ...clientForm, businessName: v })} />
            <Field label="Industry" value={clientForm.industry} placeholder="Roofing" onChange={(v) => updateClientForm({ ...clientForm, industry: v })} />
            <Field label="Location" value={clientForm.location} placeholder="Tampa, Florida" onChange={(v) => updateClientForm({ ...clientForm, location: v })} />
            <Field label="Phone" value={clientForm.phone} placeholder="555-555-5555" onChange={(v) => updateClientForm({ ...clientForm, phone: v })} />
            {!isAnonymous && (
              <div className="col-span-full flex gap-2">
                <button
                  onClick={saveClient}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'rgba(41,211,242,.12)', border: `1px solid ${C.cyanBorder}`, color: C.cyan }}
                >
                  <Save size={14} /> {selectedClientId ? 'Update Client' : 'Save Client'}
                </button>
                {selectedClientId && (
                  <button
                    onClick={() => deleteClient(selectedClientId)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium border"
                    style={{ color: C.danger, borderColor: 'rgba(239,91,103,.25)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── IMPORT CONFIRMATION ───────────────────────────────────── */}
      {importConfirmation && (
        <div style={{ padding: '14px 18px', border: `1px solid ${C.cyan}`, borderRadius: 12, background: 'rgba(41,211,242,.08)', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: C.cyan, fontSize: 18 }}>✓</span>
            <div>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
                {importConfirmation.count} asset{importConfirmation.count === 1 ? '' : 's'} added{importConfirmation.clientName ? ` to ${importConfirmation.clientName}` : ''}
              </div>
              <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                Assets are now available in Client Assets below.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION NAV (sticky) ───────────────────────────────────────
          Native anchor links (no JS) so keyboard/screen-reader users can
          jump between the (now two-column) sections. Chips only render for
          sections that are currently visible.                            */}
      <nav
        aria-label="Personalization sections"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5"
        style={{ padding: '10px 0', background: C.modal, borderBottom: `1px solid ${C.border}` }}
      >
        {[
          { id: 'pz-overview', label: 'Overview' },
          ...(discoveryStatus === 'reviewing' && discoveredAssets.length > 0
            ? [{ id: 'pz-discovered', label: 'Discovered' }]
            : []),
          { id: 'pz-client-assets', label: 'Client Assets' },
          ...(!isAnonymous && selectedClientId ? [{ id: 'pz-saved-assets', label: 'Saved Assets' }] : []),
          ...(source?.mediaType === 'video' || source?.mediaType === 'image'
            ? [{ id: 'pz-onvideo-overlays', label: 'Preview' }]
            : []),
          { id: 'pz-content', label: 'Business' },
          { id: 'pz-prompt', label: 'Prompt' },
          ...(!isPromptOnly && !isAnonymous ? [{ id: 'pz-output', label: 'Output' }] : []),
          ...(showModes && !isAnonymous ? [{ id: 'pz-mode', label: 'Mode' }] : []),
          ...(!isAnonymous ? [{ id: 'pz-engine', label: 'Engine' }] : []),
        ].map((chip) => (
          <a
            key={chip.id}
            href={`#${chip.id}`}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,.03)',
              color: C.muted,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.04em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {chip.label}
          </a>
        ))}
      </nav>

      {/* ── TWO-COLUMN BODY (xl+) ──────────────────────────────────────
          CSS multi-column keeps DOM/reading/tab order intact while roughly
          halving vertical scroll depth on wide viewports. Below `xl` the
          content collapses back to the original single column.            */}
      <div className="xl:columns-2 xl:gap-x-7">

      {/* ── DISCOVERED ASSETS REVIEW ────────────────────────────────── */}
      {discoveryStatus === 'reviewing' && discoveredAssets.length > 0 && (
        <section id="pz-discovered" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Discovered Assets</h2>
              <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11 }}>
                Found {discoveredAssets.filter((a) => !a.rejected).length} potential assets — {discoveredAssets.filter((a) => a.selected && !a.rejected).length} selected
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Paid/AI affordances are never offered to free visitors — the
                  server refuses them, so the UI does not surface them at all. */}
              {!isAnonymous && (
                <>
                  <button
                    type="button"
                    onClick={analyzeDiscoveredAssets}
                    disabled={visionStatus === 'analyzing'}
                    className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                    style={{ minHeight: 36, padding: '0 14px', border: '1px solid rgba(168,85,247,.45)', background: 'rgba(168,85,247,.10)', color: '#c4b5fd' }}
                  >
                    {visionStatus === 'analyzing' ? 'Analyzing…' : visionStatus === 'complete' ? '✓ Vision Analyzed' : '✦ Analyze with GO Vision'}
                  </button>
                  <button
                    type="button"
                    onClick={selectRecommendedDiscoveredAssets}
                    className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide"
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
                  >
                    Select Recommended
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchMakeVideoReady}
                    disabled={
                      batchVideoReady.running ||
                      discoveredAssets.filter((a) => a.selected && !a.rejected && a.category !== 'irrelevant' && !a.videoReady).length === 0
                    }
                    className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.cyan }}
                  >
                    {batchVideoReady.running
                      ? `Preparing ${batchVideoReady.current}/${batchVideoReady.total}…`
                      : '✨ Make Selected Video Ready'}
                  </button>
                  <button
                    type="button"
                    onClick={importDiscoveredAssets}
                    disabled={batchVideoReady.running || discoveredAssets.filter((a) => a.selected && !a.rejected).length === 0}
                    className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.cyan}`, background: C.cyan, color: '#041014' }}
                  >
                    Use Selected Assets
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={cancelDiscovery}
                className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide"
                style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Free run: the sign-up / deferred-enhancement plug-in point. Branded
              preview, transparent-logo generation and one-click AI Assist all
              land here or immediately above, without a second results screen. */}
          {isAnonymous && (
            <p style={{ margin: '0 0 16px', color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
              Review the assets below — drag any of them into the section you want it in. Sign in to import
              them and generate personalized videos with them.
            </p>
          )}

          {(visionStatus === 'analyzing' || visionStatus === 'complete' || visionError) && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 10,
                border: visionError ? '1px solid rgba(239,91,103,.3)' : '1px solid rgba(168,85,247,.35)',
                background: visionError ? 'rgba(239,91,103,.08)' : 'rgba(168,85,247,.08)',
                color: visionError ? '#ff9ba3' : '#c4b5fd',
                fontSize: 10,
              }}
            >
              {visionStatus === 'analyzing' && <Loader2 size={12} className="mr-1.5 inline animate-spin" />}
              {visionError
                ? 'SmartVideo GO Vision: ' + visionError
                : visionStatus === 'complete'
                  ? 'SmartVideo GO Vision analyzed the discovered assets, refined categories and scores, and identified preservation rules and recommended edits.'
                  : 'SmartVideo GO Vision is analyzing business assets…'}
            </div>
          )}

          {(batchVideoReady.running || batchVideoReady.label || batchVideoReady.error) && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${batchVideoReady.error ? 'rgba(239,91,103,.3)' : C.cyanBorder}`,
                background: batchVideoReady.error ? 'rgba(239,91,103,.08)' : C.cyanSoft,
                color: batchVideoReady.error ? '#ff9ba3' : C.cyan,
                fontSize: 10,
              }}
            >
              {batchVideoReady.running && <Loader2 size={12} className="mr-1.5 inline animate-spin" />}
              {batchVideoReady.label}
              {batchVideoReady.error ? ` — ${batchVideoReady.error}` : ''}
            </div>
          )}

          <DiscoveredAssetGrid
            assets={discoveredAssets}
            onToggle={toggleDiscoveredAssetSelection}
            onRemove={rejectDiscoveredAsset}
            onCategoryChange={updateDiscoveredAssetCategory}
            onEdit={onEditDiscovered || undefined}
            onRevert={revertDiscoveredAssetEdit}
            onRemoveFromSection={removeDiscoveredAssetFromSection}
            onRestoreAll={() => setDiscoveredAssets((prev) => prev.map((a) => ({ ...a, rejected: false })))}
            onDragStart={(asset, e) => handleAssetDragStart({
              assetId: asset.id,
              source: 'discovered',
              assetType: asset.category,
              // URL-only candidates carry no sourceUrl; without a url the
              // drop was rejected as malformed.
              url: asset.sourceUrl || asset.previewUrl,
              uploadedUrl: asset.editedDataUrl || undefined,
              metadata: {
                sourceCategory: asset.category,
                sourceType: asset.sourceType,
              },
            }, e)}
            onDragEnd={handleAssetDragEnd}
          />
        </section>
      )}

      {/* ── CLIENT ASSETS (full width, 6 numbered cards) ──────────── */}
      <section id="pz-client-assets" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>STEP 2 — CLIENT ASSETS</h2>
        <p style={{ margin: '6px 0 18px', color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
          Add the people, products, branding and visual references SmartVideo should use when personalizing this demo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {/* 1. Person / Presenter */}
          <article
            className="asset-card"
            data-asset-section="person"
            onDragEnter={(e) => handleSectionDragEnter('person', e)}
            onDragOver={(e) => handleSectionDragOver('person', e)}
            onDragLeave={(e) => handleSectionDragLeave('person', e)}
            onDrop={(e) => handleSectionDrop('person', e)}
            style={{
              minHeight: 250,
              padding: 18,
              background: dragOverSection === 'person' ? 'rgba(41,211,242,.04)' : C.panelSoft,
              border: dragOverSection === 'person' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`,
              borderRadius: 16,
              transition: 'border-color .15s, background .15s',
            }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>👤</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>1. Person / Presenter</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Upload one or more photos of the person who should appear in the content.</p>
              </div>
            </div>
            <UploadZone primary="Add Photos" secondary="Drag & drop or browse" onFiles={handleIdentityUpload} multiple disabled={assets.identities.length >= capabilities.maxImages && capabilities.maxImages > 0} onUrl={handleIdentityUrl} urlLabel="Add Photo URL" urlPlaceholder="Paste image URL and press Enter" />
            {capabilities.maxImages > 1 && (
              <div style={{ marginTop: 8, fontSize: 10, color: C.muted }}>{assets.identities.length} / {capabilities.maxImages} images uploaded</div>
            )}
            {uploadError && (
              <div style={{ marginTop: 6, fontSize: 10, color: C.danger }}>{uploadError}</div>
            )}
            <div className="asset-label" style={{ marginTop: 13, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Your Photos</div>
            <div className="flex flex-wrap gap-2">
              {assets.identities.length > 0 ? (
                assets.identities.map((asset: PersonalizationAsset) => (
                  <ThumbUploaded
                    key={asset.id}
                    asset={asset}
                    label={asset.name?.split('.')?.[0]?.toUpperCase()?.slice(0, 8) || 'PHOTO'}
                    onRemove={() => removeIdentity(asset.id)}
                    onRetry={() => retryAssetUpload(asset.id)}
                    onEdit={onEditLibrary ? () => onEditLibrary(asset) : undefined}
                    onRevert={() => revertLibraryAssetToOriginal(asset.id)}
                    draggable
                    onDragStart={(e) => handleAssetDragStart({
                      assetId: asset.id,
                      source: 'current-job',
                      assetType: asset.role,
                      url: asset.url,
                      uploadedUrl: asset.uploadedUrl,
                      metadata: {
                        role: asset.role,
                        name: asset.name,
                        sourceCategory: asset.sourceCategory,
                        sourceType: asset.sourceType,
                      },
                    }, e)}
                    onDragEnd={handleAssetDragEnd}
                    onMoveToSection={(section) => moveLibraryAssetToSection(asset.id, section)}
                  />
                ))
              ) : (
                <>
                  <ThumbPlaceholder label="FACE" />
                  <ThumbPlaceholder label="BODY" />
                  <ThumbPlaceholder label="SIDE" />
                </>
              )}
              <ThumbPlaceholder label="+" add onClick={handleIdentityAddClick} />
            </div>
            {assets.primaryIdentity && (
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#071014', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>★ Primary</span>
            )}
            <div style={{ marginTop: 9, color: C.muted2, fontSize: 10 }}>Recommended: Face + Full Body + 3/4</div>
          </article>

          {/* 2. Logo */}
          <article
            className="asset-card"
            data-asset-section="logo"
            onDragEnter={(e) => handleSectionDragEnter('logo', e)}
            onDragOver={(e) => handleSectionDragOver('logo', e)}
            onDragLeave={(e) => handleSectionDragLeave('logo', e)}
            onDrop={(e) => handleSectionDrop('logo', e)}
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'logo' ? 'rgba(41,211,242,.04)' : C.panelSoft, border: dragOverSection === 'logo' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🏷</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>2. Logo</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Upload the client&apos;s exact logo for exact branding.</p>
              </div>
            </div>
            <UploadZone primary="Upload Logo" secondary="Drag & drop or browse" onFiles={handleLogoUpload} onUrl={handleLogoUrl} urlLabel="Add Logo URL" urlPlaceholder="Paste logo URL and press Enter" />
            <div
              className="logo-preview frame-preview"
              draggable
              onDragStart={(e) => assets.primaryLogo && handleAssetDragStart({
                assetId: assets.primaryLogo.id,
                source: 'current-job',
                assetType: 'logo',
                url: assets.primaryLogo.url,
                uploadedUrl: assets.primaryLogo.uploadedUrl,
                metadata: {
                  role: assets.primaryLogo.role,
                  name: assets.primaryLogo.name,
                  sourceCategory: assets.primaryLogo.sourceCategory,
                  sourceType: assets.primaryLogo.sourceType,
                },
              }, e)}
              onDragEnd={handleAssetDragEnd}
              style={{
                marginTop: 12,
                height: 105,
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                background: assets.primaryLogo?.url ? '#000' : 'linear-gradient(145deg, #2d3742, #10151a)',
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                color: 'white',
                cursor: assets.primaryLogo ? 'grab' : 'default',
              }}
            >
              {assets.primaryLogo?.url ? (
                <img src={assets.primaryLogo.uploadedUrl || assets.primaryLogo.url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                'Logo'
              )}
              {assets.primaryLogo?.uploadStatus === 'ready' && isImageEditSupported(assets.primaryLogo) && (
                <button
                  type="button"
                  onClick={() => openLibraryImageEditor(assets.primaryLogo)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(41,211,242,.92)', color: '#041014' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.primaryLogo?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.primaryLogo!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,91,103,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {assets.logos.filter((a) => a.id !== assets.primaryLogo?.id).map((asset: PersonalizationAsset) => (
                 <ThumbUploaded
                   key={asset.id}
                   asset={asset}
                   label={asset.name?.split('.')?.[0]?.toUpperCase()?.slice(0, 8) || 'LOGO'}
                   onRemove={() => removeLogo(asset.id)}
                   onRetry={() => retryAssetUpload(asset.id)}
                   onEdit={onEditLibrary ? () => onEditLibrary(asset) : undefined}
                   onRevert={() => revertLibraryAssetToOriginal(asset.id)}
                   draggable
                   onDragStart={(e) => handleAssetDragStart({
                     assetId: asset.id,
                     source: 'current-job',
                     assetType: asset.role,
                     url: asset.url,
                     uploadedUrl: asset.uploadedUrl,
                     metadata: {
                       role: asset.role,
                       name: asset.name,
                       sourceCategory: asset.sourceCategory,
                       sourceType: asset.sourceType,
                     },
                   }, e)}
                   onDragEnd={handleAssetDragEnd}
                   onMoveToSection={(section) => moveLibraryAssetToSection(asset.id, section)}
                 />
              ))}
              <ThumbPlaceholder label="+" add onClick={handleLogoAddClick} />
            </div>
            {assets.primaryLogo && (
              <>
                <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#071014', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>★ Primary</span>
                <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#071014', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Final Overlay</span>
              </>
            )}
          </article>

          {/* 3. Products / Services */}
          <article
            className="asset-card"
            data-asset-section="products"
            onDragEnter={(e) => handleSectionDragEnter('products', e)}
            onDragOver={(e) => handleSectionDragOver('products', e)}
            onDragLeave={(e) => handleSectionDragLeave('products', e)}
            onDrop={(e) => handleSectionDrop('products', e)}
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'products' ? 'rgba(41,211,242,.04)' : C.panelSoft, border: dragOverSection === 'products' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>📦</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>3. Products / Services</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Add products, finished work, locations or service images.</p>
              </div>
            </div>
            <UploadZone primary="Add Images" secondary="Drag & drop or browse" onFiles={handleProductUpload} multiple onUrl={handleProductUrl} urlLabel="Add Image/Video URL" urlPlaceholder="Paste image or video URL and press Enter" accept="image/*,video/*" />
            <div className="asset-label" style={{ marginTop: 13, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Uploaded Images</div>
            <div className="flex flex-wrap gap-2">
              {assets.products.length > 0 ? (
                assets.products.map((asset: PersonalizationAsset, i: number) => (
                 <ThumbUploaded
                   key={asset.id}
                   asset={asset}
                   label={String(i + 1)}
                   onRemove={() => removeProduct(asset.id)}
                   onRetry={() => retryAssetUpload(asset.id)}
                   onEdit={onEditLibrary ? () => onEditLibrary(asset) : undefined}
                   onRevert={() => revertLibraryAssetToOriginal(asset.id)}
                   draggable
                   onDragStart={(e) => handleAssetDragStart({
                     assetId: asset.id,
                     source: 'current-job',
                     assetType: asset.role,
                     url: asset.url,
                     uploadedUrl: asset.uploadedUrl,
                     metadata: {
                       role: asset.role,
                       name: asset.name,
                       sourceCategory: asset.sourceCategory,
                       sourceType: asset.sourceType,
                     },
                   }, e)}
                   onDragEnd={handleAssetDragEnd}
                   onMoveToSection={(section) => moveLibraryAssetToSection(asset.id, section)}
                 />
                ))
              ) : (
                <>
                  <ThumbPlaceholder label="1" />
                  <ThumbPlaceholder label="2" />
                  <ThumbPlaceholder label="3" />
                </>
              )}
              <ThumbPlaceholder label="+" add onClick={handleProductAddClick} />
            </div>
          </article>

          {/* 4. Brand References */}
          <article
            className="asset-card"
            data-asset-section="brand"
            onDragEnter={(e) => handleSectionDragEnter('brand', e)}
            onDragOver={(e) => handleSectionDragOver('brand', e)}
            onDragLeave={(e) => handleSectionDragLeave('brand', e)}
            onDrop={(e) => handleSectionDrop('brand', e)}
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'brand' ? 'rgba(41,211,242,.04)' : C.panelSoft, border: dragOverSection === 'brand' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🏢</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>4. Brand References</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Show SmartVideo what the client&apos;s business and brand look like.</p>
              </div>
            </div>
            <UploadZone primary="Add Images" secondary="Drag & drop or browse" onFiles={handleBrandRefUpload} multiple onUrl={handleBrandRefUrl} urlLabel="Add Image/Video URL" urlPlaceholder="Paste image or video URL and press Enter" accept="image/*,video/*" />
            <div className="asset-label" style={{ marginTop: 13, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Brand Images</div>
            <div className="flex flex-wrap gap-2">
              {assets.brandReferences.length > 0 ? (
                assets.brandReferences.map((asset: PersonalizationAsset) => (
                 <ThumbUploaded
                   key={asset.id}
                   asset={asset}
                   label={asset.name?.split('.')?.[0]?.toUpperCase()?.slice(0, 10) || 'BRAND'}
                   onRemove={() => removeBrandReference(asset.id)}
                   onRetry={() => retryAssetUpload(asset.id)}
                   onEdit={onEditLibrary ? () => onEditLibrary(asset) : undefined}
                   onRevert={() => revertLibraryAssetToOriginal(asset.id)}
                   draggable
                   onDragStart={(e) => handleAssetDragStart({
                     assetId: asset.id,
                     source: 'current-job',
                     assetType: asset.role,
                     url: asset.url,
                     uploadedUrl: asset.uploadedUrl,
                     metadata: {
                       role: asset.role,
                       name: asset.name,
                       sourceCategory: asset.sourceCategory,
                       sourceType: asset.sourceType,
                     },
                   }, e)}
                   onDragEnd={handleAssetDragEnd}
                   onMoveToSection={(section) => moveLibraryAssetToSection(asset.id, section)}
                 />
                ))
              ) : (
                <>
                  <ThumbPlaceholder label="STORE" />
                  <ThumbPlaceholder label="TEAM" />
                  <ThumbPlaceholder label="VEHICLE" />
                </>
              )}
            </div>
            <div style={{ marginTop: 9, color: C.muted2, fontSize: 10 }}>Storefront • Team • Vehicle • Packaging • Brand Photography</div>
          </article>

          {/* 5. First Frame */}
          <article
            className="asset-card"
            data-asset-section="firstFrame"
            onDragEnter={(e) => handleSectionDragEnter('firstFrame', e)}
            onDragOver={(e) => handleSectionDragOver('firstFrame', e)}
            onDragLeave={(e) => handleSectionDragLeave('firstFrame', e)}
            onDrop={(e) => handleSectionDrop('firstFrame', e)}
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'firstFrame' ? 'rgba(41,211,242,.04)' : C.panelSoft, border: dragOverSection === 'firstFrame' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🎬</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>5. First Frame</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Control how the personalized video begins.</p>
              </div>
            </div>
            <UploadZone primary="Upload Image" onFiles={handleFirstFrameUpload} onUrl={handleFirstFrameUrl} urlLabel="Add Image URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
            <div
              className="frame-preview"
              draggable={!!assets.firstFrame}
              onDragStart={(e) => assets.firstFrame && handleAssetDragStart({
                assetId: assets.firstFrame.id,
                source: 'current-job',
                assetType: 'first_frame',
                url: assets.firstFrame.url,
                uploadedUrl: assets.firstFrame.uploadedUrl,
                metadata: {
                  role: assets.firstFrame.role,
                  name: assets.firstFrame.name,
                  sourceCategory: assets.firstFrame.sourceCategory,
                  sourceType: assets.firstFrame.sourceType,
                },
              }, e)}
              onDragEnd={handleAssetDragEnd}
              style={{
                marginTop: 12,
                height: 105,
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                background: assets.firstFrame?.url ? '#000' : 'linear-gradient(145deg, #2d3740, #10151a)',
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                color: 'white',
                cursor: assets.firstFrame ? 'grab' : 'default',
              }}
            >
              {assets.firstFrame?.url ? (
                <img src={assets.firstFrame.uploadedUrl || assets.firstFrame.url} alt="First Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                'First Frame'
              )}
                {assets.firstFrame?.uploadStatus === 'ready' && isImageEditSupported(assets.firstFrame) && (
                <button
                  type="button"
                  onClick={() => openLibraryImageEditor(assets.firstFrame)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(41,211,242,.92)', color: '#041014' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.firstFrame?.edited && (
                <button
                  type="button"
                  onClick={() => revertLibraryAssetToOriginal(assets.firstFrame!.id)}
                  className="absolute right-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(255,255,255,.9)', color: '#041014' }}
                >
                  Revert
                </button>
              )}
              {assets.firstFrame?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.firstFrame!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,91,103,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, background: C.cyan, color: '#071014', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>First Frame</span>
              {assets.firstFrame && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFirstFrame() }}
                  className="text-[9px] font-extrabold uppercase"
                  style={{ color: C.danger, background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </article>

          {/* 6. Last Frame / CTA */}
          <article
            className="asset-card"
            data-asset-section="lastFrame"
            onDragEnter={(e) => handleSectionDragEnter('lastFrame', e)}
            onDragOver={(e) => handleSectionDragOver('lastFrame', e)}
            onDragLeave={(e) => handleSectionDragLeave('lastFrame', e)}
            onDrop={(e) => handleSectionDrop('lastFrame', e)}
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'lastFrame' ? 'rgba(41,211,242,.04)' : C.panelSoft, border: dragOverSection === 'lastFrame' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🎯</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>6. Last Frame / CTA</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Control how the personalized video ends.</p>
              </div>
            </div>
            <UploadZone primary="Upload Image" onFiles={handleLastFrameUpload} onUrl={handleLastFrameUrl} urlLabel="Add Image URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
            <div
              className="frame-preview"
              draggable={!!assets.lastFrame}
              onDragStart={(e) => assets.lastFrame && handleAssetDragStart({
                assetId: assets.lastFrame.id,
                source: 'current-job',
                assetType: 'last_frame',
                url: assets.lastFrame.url,
                uploadedUrl: assets.lastFrame.uploadedUrl,
                metadata: {
                  role: assets.lastFrame.role,
                  name: assets.lastFrame.name,
                  sourceCategory: assets.lastFrame.sourceCategory,
                  sourceType: assets.lastFrame.sourceType,
                },
              }, e)}
              onDragEnd={handleAssetDragEnd}
              style={{
                marginTop: 12,
                height: 105,
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                background: assets.lastFrame?.url ? '#000' : 'linear-gradient(145deg, #2d3740, #10151a)',
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                padding: 8,
                color: 'white',
                cursor: assets.lastFrame ? 'grab' : 'default',
              }}
            >
              {assets.lastFrame?.url ? (
                <img src={assets.lastFrame.uploadedUrl || assets.lastFrame.url} alt="Last Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                'Last Frame/CTA'
              )}
              {assets.lastFrame?.uploadStatus === 'ready' && isImageEditSupported(assets.lastFrame) && (
                <button
                  type="button"
                  onClick={() => openLibraryImageEditor(assets.lastFrame)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(41,211,242,.92)', color: '#041014' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.lastFrame?.edited && (
                <button
                  type="button"
                  onClick={() => revertLibraryAssetToOriginal(assets.lastFrame!.id)}
                  className="absolute right-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(255,255,255,.9)', color: '#041014' }}
                >
                  Revert
                </button>
              )}
              {assets.lastFrame?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.lastFrame!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,91,103,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, background: C.cyan, color: '#071014', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Last Frame</span>
              {assets.lastFrame && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeLastFrame() }}
                  className="text-[9px] font-extrabold uppercase"
                  style={{ color: C.danger, background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ── SAVED CLIENT ASSETS ─────────────────────────────────────
          Saved-profile controls are never offered to free visitors.        */}
      {!isAnonymous && selectedClientId && (
        <section id="pz-saved-assets" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>SAVED CLIENT ASSETS</h2>
              <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11 }}>
                Reuse previously saved assets for this client. Click to add them to the current personalization.
              </p>
            </div>
          </div>
          <div className="flex gap-2" style={{ marginBottom: 14 }}>
            {([
              { key: 'identities', label: 'People' },
              { key: 'logos', label: 'Logos' },
              { key: 'products', label: 'Products' },
              { key: 'brandReferences', label: 'Brand' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSavedAssetLibraryTab(key)}
                className="rounded-lg text-[11px] font-extrabold uppercase tracking-wide"
                style={{
                  minHeight: 34,
                  padding: '0 14px',
                  border: `1px solid ${savedAssetLibraryTab === key ? C.cyan : C.border}`,
                  background: savedAssetLibraryTab === key ? C.cyan : '#11161b',
                  color: savedAssetLibraryTab === key ? '#051014' : C.text,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(savedAssetLibraryTab === 'identities' ? savedClientAssets.identities :
              savedAssetLibraryTab === 'logos' ? savedClientAssets.logos :
              savedAssetLibraryTab === 'products' ? savedClientAssets.products :
              savedClientAssets.brandReferences).length > 0 ? (
              (savedAssetLibraryTab === 'identities' ? savedClientAssets.identities :
                savedAssetLibraryTab === 'logos' ? savedClientAssets.logos :
                savedAssetLibraryTab === 'products' ? savedClientAssets.products :
                savedClientAssets.brandReferences
               ).map((asset) => (
                 <div
                   key={asset.id}
                   className="text-left"
                   draggable
                     onDragStart={(e) => {
                       const tabKey = savedAssetLibraryTab === 'identities' ? 'identity' : savedAssetLibraryTab === 'logos' ? 'logo' : savedAssetLibraryTab === 'products' ? 'product' : 'brand'
                       handleAssetDragStart({
                         assetId: asset.id,
                         source: 'saved-client',
                         assetType: tabKey,
                         url: asset.url,
                         uploadedUrl: asset.uploadedUrl,
                         metadata: {
                           role: asset.role,
                           name: asset.name,
                           sourceCategory: asset.sourceCategory,
                           sourceType: asset.sourceType,
                         },
                       }, e)
                     }}
                   onDragEnd={handleAssetDragEnd}
                   style={{
                     width: 110,
                     padding: 8,
                     border: `1px solid ${C.border}`,
                     borderRadius: 10,
                     background: C.panelSoft,
                     position: 'relative',
                     cursor: 'grab',
                   }}
                 >
                   <div
                     style={{
                       width: '100%',
                       height: 80,
                       borderRadius: 8,
                       overflow: 'hidden',
                       background: '#000',
                       marginBottom: 6,
                       cursor: 'pointer',
                     }}
                     onClick={() => selectSavedAsset(asset)}
                   >
                     <img src={asset.uploadedUrl || asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   </div>
                   <div style={{ fontSize: 10, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name?.split('.')?.[0]?.toUpperCase()?.slice(0, 10) || 'ASSET'}</div>
                   <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                     {asset.isPrimary && (
                       <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: C.cyan }}>★ Primary</span>
                     )}
                     {isAssetInCurrentJob(asset, assets) && (
                       <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: C.green }}>✓ In Job</span>
                     )}
                     {isImageEditSupported(asset) && (
                       <button
                         type="button"
                         onClick={() => openLibraryImageEditor(asset)}
                         className="text-[9px] font-extrabold uppercase"
                         style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                       >
                         Edit with AI
                       </button>
                     )}
                     <button
                       type="button"
                       onClick={() => {
                         if (savedAssetLibraryTab === 'identities') setPrimarySavedAsset('identity', asset.id)
                         else if (savedAssetLibraryTab === 'logos') setPrimarySavedAsset('logo', asset.id)
                       }}
                       className="text-[9px] font-extrabold uppercase"
                       style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                     >
                       Set Primary
                     </button>
                     <button
                       type="button"
                       onClick={() => { if (window.confirm('Remove this asset from the saved client library?')) removeSavedAsset(asset.id) }}
                       className="text-[9px] font-extrabold uppercase"
                       style={{ color: C.danger, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                     >
                       Delete
                     </button>
                   </div>
                 </div>
               ))
            ) : (
              <div style={{ padding: 18, border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11 }}>
                No saved assets yet. Upload assets in the sections above and they will be saved automatically for this client.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── PREVIEW & ON-VIDEO OVERLAYS (guided preview, shared state) ──
          Free browser-based Remotion preview of the personalized composition
          plus the direct on-video overlay editor. Renders only for video and
          image sources, and only when the provider exposes the guided API. */}
      {(source?.mediaType === 'video' || source?.mediaType === 'image') && (
        <AdvancedOverlaySection source={source} />
      )}

      {/* ── CTA & BUSINESS CONTENT ────────────────────────────── */}
      <section id="pz-content" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>CTA & BUSINESS CONTENT</h2>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 18, gap: 12 }}>
          <Field label="Product / Service" value={clientForm.productService} placeholder="Residential Roof Replacement" onChange={(v) => updateClientForm({ ...clientForm, productService: v })} />
          <Field label="Offer" value={clientForm.offer} placeholder="Free Roof Inspection" onChange={(v) => updateClientForm({ ...clientForm, offer: v })} />
          <Field label="CTA Headline" value={clientForm.ctaHeadline} placeholder="Protect Your Home Today" onChange={(v) => updateClientForm({ ...clientForm, ctaHeadline: v })} />
          <Field label="Button / Action" value={clientForm.callToAction} placeholder="Book Your Inspection" onChange={(v) => updateClientForm({ ...clientForm, callToAction: v })} />
          <Field label="Phone" value={clientForm.phone} placeholder="555-555-5555" onChange={(v) => updateClientForm({ ...clientForm, phone: v })} />
        </div>
        <div
          data-asset-section="ctaGraphic"
          onDragEnter={(e) => handleSectionDragEnter('ctaGraphic', e)}
          onDragOver={(e) => handleSectionDragOver('ctaGraphic', e)}
          onDragLeave={(e) => handleSectionDragLeave('ctaGraphic', e)}
          onDrop={(e) => handleSectionDrop('ctaGraphic', e)}
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            border: dragOverSection === 'ctaGraphic' ? `1px solid ${C.cyanBorder}` : `1px solid transparent`,
            background: dragOverSection === 'ctaGraphic' ? 'rgba(41,211,242,.04)' : 'transparent',
            transition: 'border-color .15s, background .15s',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>CTA Graphic</div>
          <UploadZone primary="Upload CTA Graphic" secondary="Drag & drop or browse" onFiles={handleCtaUpload} onUrl={handleCtaUrl} urlLabel="Add CTA URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
          {assets.ctaGraphic?.url && (
            <div className="mt-3" style={{ maxWidth: 200 }}>
              <ThumbUploaded
                asset={assets.ctaGraphic}
                onRemove={removeCtaGraphic}
                onRetry={() => assets.ctaGraphic && retryAssetUpload(assets.ctaGraphic.id)}
                onEdit={onEditLibrary ? () => onEditLibrary(assets.ctaGraphic!) : undefined}
                onRevert={() => assets.ctaGraphic && revertLibraryAssetToOriginal(assets.ctaGraphic.id)}
                draggable
                onDragStart={(e) => assets.ctaGraphic && handleAssetDragStart({
                  assetId: assets.ctaGraphic.id,
                  source: 'current-job',
                  assetType: 'cta_graphic',
                  url: assets.ctaGraphic.url,
                  uploadedUrl: assets.ctaGraphic.uploadedUrl,
                  metadata: {
                    role: assets.ctaGraphic.role,
                    name: assets.ctaGraphic.name,
                    sourceCategory: assets.ctaGraphic.sourceCategory,
                    sourceType: assets.ctaGraphic.sourceType,
                  },
                }, e)}
                onDragEnd={handleAssetDragEnd}
                onMoveToSection={(section) => moveLibraryAssetToSection(assets.ctaGraphic!.id, section)}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── PERSONALIZE THE PROMPT ──────────────────────────── */}
      <section id="pz-prompt" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>STEP 3 — PERSONALIZE THE PROMPT</h2>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 18, gap: 14 }}>
          <div className="prompt-box" style={{ minHeight: 150, border: `1px solid ${C.border}`, borderRadius: 12, background: C.field, padding: 14 }}>
            <h4 style={{ margin: '0 0 9px', fontSize: 11, textTransform: 'uppercase' }}>Original Prompt</h4>
            <p style={{ margin: 0, color: 'rgba(255,255,255,.72)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {promptState.original || 'No original prompt available.'}
            </p>
          </div>
          <div className="prompt-box" style={{ minHeight: 150, border: `1px solid ${C.border}`, borderRadius: 12, background: C.field, padding: 14 }}>
            <h4 style={{ margin: '0 0 9px', fontSize: 11, textTransform: 'uppercase' }}>Personalized Prompt</h4>
            <textarea
              value={promptState.edited || promptState.personalized}
              onChange={(e) => updatePersonalizedPrompt(e.target.value)}
              rows={6}
              placeholder="Click Personalize Prompt to generate a client-specific version."
              className="w-full text-[12px] leading-[1.5] outline-none resize-y"
              style={{ background: 'transparent', color: 'rgba(255,255,255,.9)', border: 'none', padding: 0, caretColor: C.cyan }}
            />
          </div>
        </div>
        {/* AI prompt actions are entitlement-gated: free visitors are never
            offered a paid model call. Deferred one-click AI Assist plugs in
            here for entitled users. */}
        {!isAnonymous && (
          <div className="flex flex-wrap gap-2 justify-end" style={{ marginTop: 12 }}>
            <button
              onClick={handlePersonalize}
              disabled={!canPersonalize || isPersonalizing}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.cyan}`, background: C.cyan, color: '#051014' }}
            >
              {isPersonalizing ? <Loader2 size={12} className="animate-spin inline" /> : '✦'} Personalize Prompt
            </button>
            <button
              onClick={handleRegenerate}
              disabled={!canPersonalize || isRegenerating || !promptState.personalized}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
            >
              Regenerate
            </button>
            <button
              onClick={handleCopyPrompt}
              disabled={!promptState.personalized}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
            >
              {copiedPrompt ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={resetPrompt}
              disabled={!promptState.personalized}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
            >
              Reset
            </button>
          </div>
        )}
      </section>

      {/* ── OUTPUT ──────────────────────────────────────────
          Generation configuration only exists for entitled users. */}
      {!isPromptOnly && !isAnonymous && (
        <section id="pz-output" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>STEP 4 — CREATE</h2>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ marginTop: 18, gap: 12 }}>
            {outputOptions.map(({ key, label, description }: any) => {
              const active = outputType === key
              return (
                <button
                  key={key}
                  onClick={() => setOutputType(key)}
                  className="text-left p-4 rounded-[12px] border relative"
                  style={{
                    minHeight: 95,
                    padding: 16,
                    borderColor: active ? C.cyan : C.border,
                    background: active ? 'rgba(41,211,242,.045)' : C.panelSoft,
                    boxShadow: active ? 'inset 0 0 0 1px rgba(41,211,242,.25)' : 'none',
                  }}
                >
                  {active && (
                    <div className="absolute" style={{ right: 10, top: 10, width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.cyan, color: '#071014', fontSize: 11, fontWeight: 900 }}>✓</div>
                  )}
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase' }}>{label}</h4>
                  <p style={{ margin: 0, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{description}</p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── PERSONALIZATION MODE ──────────────────────────────
          Same entitlement gate as the output selector above. */}
      {showModes && !isAnonymous && (
        <section id="pz-mode" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>HOW SHOULD THIS BE PERSONALIZED?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 18, gap: 12 }}>
            {eligibleModes.map((m: any) => {
              const active = mode === m.key
              const isUnavailable = !active && isModeUnavailable(m.key, assets, capabilities)
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  disabled={isUnavailable}
                  aria-pressed={active}
                  className="text-left p-4 rounded-[12px] border relative disabled:opacity-60"
                  style={{
                    minHeight: 95,
                    padding: 16,
                    borderColor: active ? C.cyan : isUnavailable ? C.border : C.borderStrong,
                    background: active ? 'rgba(41,211,242,.045)' : isUnavailable ? C.panel : C.panelSoft,
                    boxShadow: active ? 'inset 0 0 0 1px rgba(41,211,242,.25)' : 'none',
                  }}
                >
                  {active && (
                    <div className="absolute" style={{ right: 10, top: 10, width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.cyan, color: '#071014', fontSize: 11, fontWeight: 900 }}>✓</div>
                  )}
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase' }}>{m.label}</h4>
                  <p style={{ margin: 0, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{m.description}</p>
                  {isUnavailable && (
                    <p style={{ margin: '6px 0 0', color: C.muted2, fontSize: 9, lineHeight: 1.4 }}>
                      {getModeUnavailableReason(m.key, assets)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── ENGINE: SmartVideo Recommended ──────────────────────
          Engine/advanced settings configure paid generation, so the whole
          section is entitlement-gated. */}
      {!isAnonymous && (
      <section id="pz-engine" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>SMARTVIDEO ENGINE</h2>
        <div
          className="flex items-center justify-between gap-5"
          style={{
            marginTop: 18,
            border: `1px solid ${C.cyan}`,
            borderRadius: 14,
            padding: '18px 20px',
            background: 'linear-gradient(90deg, rgba(41,211,242,.10), rgba(41,211,242,.03))',
            boxShadow: '0 0 26px rgba(41,211,242,.08), inset 0 0 0 1px rgba(41,211,242,.08)',
          }}
        >
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(41,211,242,.15)', color: C.cyan }}>✦</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 850, letterSpacing: '.02em' }}>
                SmartVideo <span style={{ color: C.cyan }}>Recommended</span>
              </h3>
              <div style={{ marginTop: 5, color: C.muted, fontSize: 11 }}>
                {isUsingRecommendedModel
                  ? `Using ${recommendedModel?.name || effectiveModelId} — best match for your content and duration.`
                  : `Recommended for this duration: ${recommendedModel?.name || recommendedModelId}. Current: ${currentModel?.name || effectiveModelId}.`}
              </div>
            </div>
          </div>
          {!isUsingRecommendedModel && (
            <button
              onClick={() => updateGenOptions({ ...genOptions, model: recommendedModelId, advancedModel: undefined })}
              className="text-[11px] whitespace-nowrap"
              style={{ color: C.cyan }}
            >
              Use Recommended ›
            </button>
          )}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] whitespace-nowrap"
            style={{ color: 'rgba(255,255,255,.75)' }}
          >
            Advanced Settings ›
          </button>
        </div>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 p-4 mt-2 rounded-xl border" style={{ borderColor: C.border, background: '#0c1014' }}>
            {capabilities.aspectRatioOptions.length > 0 ? (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Aspect Ratio</label>
                <select
                  value={genOptions?.aspectRatio || source.aspectRatio || capabilities.aspectRatioOptions[0] || ''}
                  onChange={(e) => updateGenOptions({ ...genOptions, aspectRatio: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: C.border, background: C.field, color: C.text }}
                >
                  {capabilities.aspectRatioOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ) : source.aspectRatio ? (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Aspect Ratio</label>
                <div style={{ padding: '8px 0', color: C.muted, fontSize: 13 }}>{source.aspectRatio}</div>
              </div>
            ) : null}
            {capabilities.resolutionOptions.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Resolution</label>
                <select
                  value={genOptions?.resolution || ''}
                  onChange={(e) => updateGenOptions({ ...genOptions, resolution: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: C.border, background: C.field, color: C.text }}
                >
                  <option value="">Default</option>
                  {capabilities.resolutionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
            {capabilities.qualityOptions.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Quality</label>
                <select
                  value={genOptions?.quality || ''}
                  onChange={(e) => updateGenOptions({ ...genOptions, quality: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: C.border, background: C.field, color: C.text }}
                >
                  <option value="">Default</option>
                  {capabilities.qualityOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
            {capabilities.durationOptions.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Duration</label>
                <select
                  value={genOptions?.duration || source.duration || ''}
                  onChange={(e) => updateGenOptions({ ...genOptions, duration: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: C.border, background: C.field, color: C.text }}
                >
                  {capabilities.durationOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}s</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Engine</label>
              <select
                value={genOptions?.engine || 'smartvideo-recommended'}
                onChange={(e) => updateGenOptions({ ...genOptions, engine: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: C.border, background: C.field, color: C.text }}
              >
                <option value="smartvideo-recommended">SmartVideo Recommended</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: C.muted }}>
                <input
                  type="checkbox"
                  checked={genOptions?.preserveAudio ?? true}
                  onChange={(e) => updateGenOptions({ ...genOptions, preserveAudio: e.target.checked })}
                  className="rounded"
                />
                Preserve Audio
              </label>
            </div>
          </div>
        )}
        {mode && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(mode) && (
          <label className="flex gap-2 items-center pt-[18px] text-[11px]" style={{ color: 'rgba(255,255,255,.72)' }}>
            <input
              type="checkbox"
              checked={genOptions?.consentGiven ?? false}
              onChange={(e) => updateGenOptions({ ...genOptions, consentGiven: e.target.checked })}
            />
            I confirm that I have permission to use this person&apos;s likeness.
          </label>
        )}
      </section>
      )}

      </div>
    </div>
  )
}

// ── Advanced Editing: preview & on-video overlays ────────────────────────────
// A section inside the existing ConfigurationView that mounts the same free
// Remotion preview and the same on-video overlay editor Simple Mode uses, over
// the same provider state. It renders nothing when the guided preview API is
// unavailable, so partially-wired contexts keep the previous behavior.

function AdvancedOverlaySection({ source }: { source: PersonalizationSource | null }) {
  const ctx = useDemoPersonalize()
  const guidedAvailable =
    typeof (ctx as { setGuidedStep?: unknown }).setGuidedStep === 'function' &&
    Boolean((ctx as { previewSettings?: unknown }).previewSettings)
  if (!guidedAvailable || !ctx.previewSettings) return null

  const inputProps = buildPreviewInput({
    source,
    previewSettings: ctx.previewSettings,
    previewVideo: ctx.previewVideo ?? null,
    clientForm: ctx.clientForm || {},
    assets: ctx.assets,
  })

  return (
    <section
      id="pz-onvideo-overlays"
      className="break-inside-avoid"
      style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}
    >
      <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>
        Preview &amp; On-Video Overlays
      </h2>
      <p className="mt-1.5 max-w-[900px] text-[12px] leading-[1.55]" style={{ color: C.muted }}>
        A free, browser-based preview of your branding placed directly on the video — before and after, side by
        side. Drag, resize and edit every layer on the video itself. Nothing here is generated or charged.
      </p>
      <div style={{ marginTop: 16 }}>
        <BeforeAfterPreview inputProps={inputProps} defaultMode="split" />
      </div>
      <div style={{ marginTop: 16 }}>
        <OverlayEditor inputProps={inputProps} />
      </div>
    </section>
  )
}
