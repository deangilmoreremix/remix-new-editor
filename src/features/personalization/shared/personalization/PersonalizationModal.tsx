/**
 * PersonalizationModal
 *
 * Context-driven modal for the SmartVideo personalization workflow.
 * Implements the approved full-width design hierarchy (HTML source of truth).
 *
 * Design tokens mirror the approved HTML:
 *   --bg: #050505, --modal: #0a0a0a, --panel: #141414, --panel-soft: #101010
 *   --cyan: #d9ff00, --cyan-soft: rgba(217,255,0,.12)
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

import { RECAST_MAX_SECONDS } from './recast/recastJob'
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
import { DEFAULT_ADVANCED_SECTIONS, useDemoPersonalize } from './DemoPersonalizeProvider'
import type { AutoFillKey } from './businessContentFromResearch'
import type { AdvancedEditingSections, AdvancedEditingTab } from './types'
import {
  AdvancedPreviewColumn,
  AdvancedSectionPanel,
  AdvancedSectionPills,
  AdvancedStepBar,
  AdvancedTabFooter,
  AdvancedTabPanel,
  SECTION_LOCATION,
} from './advanced/AdvancedWorkspace'
import { FullBodyRecastSection } from './advanced/FullBodyRecastPanel'
import { ReadinessChecklist, blockingByTab, focusRequirementControl, requirementLocation } from './advanced/ReadinessChecklist'
import { validateProjectRequirements } from './ai/toolExecutor'
import { chooseFinalOutputPath } from './finalOutput'
import type { AIMissingRequirement } from './ai/types'
import type { PersonalizationAsset, DiscoveredAsset, DiscoveredAssetCategory, AssignedSection, AssetRole, PersonalizationVisionAnalysis, BusinessDiscoveryRecord, BusinessOwnership, PersonalizationSource } from './types'
import { LEAD_STAGES, isLeadStage } from './leadStages'
import { ownershipBadgeStyle, ownershipLabel } from './ownershipBadge'
import { modelForGeneration, resolveModelCapabilities } from './modelCapabilityResolver'
import { getModelById, getVideoModelById } from '@ohb/packages/studio/src/models.js'
import { NICHE_CONTENT } from '@ohb/data/nicheContent'
import { BUSINESS_NICHES } from './businessNiches'
import ImageEditorModal, {
  type ImageEditorApplyResult,
  type PersonalizationImageEditorAsset,
} from './image-editor/ImageEditorModal'
import { makeDiscoveredAssetVideoReady } from './image-editor/batchVideoReady'
import { isImageEditSupported } from './image-editor/imageEditSupport'
import { DiscoveredAssetGrid, type DiscoveredAssetDropZone } from './DiscoveredAssetGrid'
import { ResumeProjectBanner } from './ResumeProjectBanner'
import { SimpleModeWizard } from './guided/SimpleModeWizard'
import { OverlayEditor } from './guided/OverlayEditor'
import { buildPreviewInput } from './guided/buildPreviewInput'
import { BeforeAfterPreview } from './preview/BeforeAfterPreview'
import { isOwnedWebsite } from './websiteClassification'
import { C } from './guided/tokens'

// ── Design tokens: shared remix palette (see guided/tokens.ts) ──────────────

/**
 * Niche copy marks emphasis with `<strong>…</strong>` only. Render that as
 * React elements and everything else as plain text, so the copy can never
 * inject markup (no dangerouslySetInnerHTML).
 */
function renderStrongMarkup(text: string): Array<string | JSX.Element> {
  return String(text || '')
    .split(/(<strong>[\s\S]*?<\/strong>)/g)
    .filter(Boolean)
    .map((part, index) => {
      const match = /^<strong>([\s\S]*?)<\/strong>$/.exec(part)
      return match ? <strong key={index}>{match[1]}</strong> : part
    })
}

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

function Field({ label, value, placeholder, onChange, full = false, autoFilled = false, required = false, focusId }: { label: string; value: string | undefined | null; placeholder: string; onChange: (v: string) => void; full?: boolean; autoFilled?: boolean; required?: boolean; focusId?: string }) {
  const missing = required && !String(value || '').trim()
  return (
    <div className={full ? 'col-span-full' : ''} data-pz-focus={focusId}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: C.muted, fontSize: 10 }}>
        {label}
        {required && (
          <span
            data-testid="pz-required-tag"
            style={{ padding: '1px 6px', borderRadius: 999, background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.35)', color: '#fcd34d', fontSize: 9, fontWeight: 700 }}
          >
            Required
          </span>
        )}
        {autoFilled && (
          <span
            data-testid="pz-autofilled-tag"
            title="Loaded from the business website. Edit to replace it."
            style={{ padding: '1px 6px', borderRadius: 999, background: C.cyanSoft, border: `1px solid ${C.cyanBorder}`, color: C.cyan, fontSize: 9, fontWeight: 700 }}
          >
            from website
          </span>
        )}
      </label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-required={required || undefined}
        className="w-full outline-none"
        style={{
          minHeight: 40,
          padding: '0 11px',
          border: `1px solid ${missing ? 'rgba(251,191,36,.45)' : C.border}`,
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
    return 'Needs a clear photo of the person\'s face — add one under Assets › Your assets › Person / Presenter.'
  }
  if (modeKey === 'full_body' || modeKey === 'replace_person') {
    return 'Needs a full-body photo of the person — add one under Assets › Your assets › Person / Presenter.'
  }
  return 'Not available for the current source/model.'
}

/** Modes that a presenter photo unlocks (the "Add a presenter photo" link). */
function modeNeedsPresenter(modeKey: string): boolean {
  return ['face_only', 'replace_face', 'full_body', 'replace_person'].includes(modeKey)
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
  collapsed = false,
  addLabel = '+ Add more',
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
  /** The card already has images: show one compact row until it is opened. */
  collapsed?: boolean
  addLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [expanded, setExpanded] = useState(false)

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

  if (collapsed && !expanded) {
    // Filled card: the URL box and big dropzone fold into one row (files can
    // still be dropped on it).
    return (
      <button
        type="button"
        data-testid="pz-upload-collapsed"
        data-pz-upload-zone
        onClick={() => setExpanded(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled}
        className="w-full rounded-[10px] border border-dashed text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
        style={{
          minHeight: 36,
          borderColor: isDragOver ? C.cyanBorder : 'rgba(255,255,255,.22)',
          background: isDragOver ? 'rgba(217,255,0,.06)' : 'transparent',
          color: C.cyan,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {disabled ? 'Limit reached — remove one to add another' : isDragOver ? 'Drop to add' : addLabel}
      </button>
    )
  }

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
        data-pz-upload-zone
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
            ? 'border-[var(--cyan-border)] bg-[rgba(217,255,0,.04)]'
            : 'border-[rgba(255,255,255,.22)] bg-[rgba(0,0,0,.16)] hover:border-[var(--cyan-border)] hover:bg-[rgba(217,255,0,.04)]',
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
function ThumbPlaceholder({ label, add = false, onClick, title }: { label: string; add?: boolean; onClick?: () => void; title?: string }) {
  // Clickable slots are real buttons (keyboard + screen readers); the label
  // says what kind of photo goes there.
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, 'aria-label': title || (add ? 'Add' : `Add ${label.toLowerCase()} photo`), title: title || (add ? undefined : `Add a ${label.toLowerCase()} photo`) } : {})}
      onClick={onClick}
      className={classNames(
        'w-[82px] min-h-[86px] rounded-[9px] border overflow-hidden flex items-end justify-center p-1.5 text-[9px] font-extrabold',
        onClick && 'cursor-pointer hover:brightness-125',
      )}
      style={{
        borderColor: add ? 'rgba(255,255,255,.22)' : C.border,
        background: add ? 'rgba(0,0,0,.10)' : 'linear-gradient(145deg, #3f3f46, #141414)',
        color: add ? C.muted : 'white',
        alignItems: add ? 'center' : 'flex-end',
        justifyContent: 'center',
        fontSize: add ? 22 : 9,
        borderStyle: add ? 'dashed' : 'solid',
      }}
    >
      {label}
    </Tag>
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
  onMakePrimary,
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
  /** Shown when this isn't the primary photo/logo yet. */
  onMakePrimary?: () => void
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
        background: light ? '#f6f7f9' : 'linear-gradient(145deg, #3f3f46, #141414)',
        color: light ? '#0f0f0f' : 'white',
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
          style={{ background: 'rgba(217,255,0,.92)', color: '#000000' }}
          aria-label="Edit image"
        >
          {EDIT_WITH_AI}
        </button>
      )}
      {asset.edited && onRevert && (
        // Left column (Edit / Primary / Revert), clear of the Remove ✕ in the
        // top-right and the section menu along the bottom.
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRevert() }}
          className="absolute left-1 top-11 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
          aria-label="Revert to original"
        >
          Revert
        </button>
      )}
      {label && (
        <span className="relative text-[9px] font-extrabold z-[1]" style={{ color: light ? '#0f0f0f' : 'white' }}>
          {label}
        </span>
      )}
      {onMakePrimary && isReady && (
        <button
          type="button"
          data-testid="pz-make-primary"
          onClick={(e) => { e.stopPropagation(); onMakePrimary() }}
          className="absolute left-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,.75)', color: C.cyan }}
          aria-label="Make primary"
        >
          ★ Primary
        </button>
      )}
      {/* Failed uploads can be removed too, not only retried. */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className={`absolute top-0.5 right-0.5 z-20 rounded-full p-0.5 transition-opacity ${isError ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
          style={{ background: 'rgba(239,68,68,.85)' }}
          aria-label="Remove"
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
            // Narrow, so it stays in its corner and doesn't cover the buttons.
            className="text-[7px] font-bold rounded px-0.5 py-0.5 outline-none max-w-[46px]"
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
    autoCutout,
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
    resolveBusinessWebsite,
    websiteLookup,
    setDiscoveryError,
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
    creationMethod,
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
  // true = copied, 'failed' = the browser refused the clipboard.
  const [copiedPrompt, setCopiedPrompt] = useState<boolean | 'failed'>(false)
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

    // A file dropped on the card's own upload area is handled there.
    if ((e.target as HTMLElement | null)?.closest?.('[data-pz-upload-zone]')) return

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
      // Importing needs an account; visitors only rearrange the grid.
      if (!isAnonymous) void importDiscoveredAssets({ ids: [assetId], section: section as AssignedSection })
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
  }, [importDiscoveredAssets, isAnonymous, moveDiscoveredAssetToSection, moveLibraryAssetToSection, selectSavedAsset])

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

  // The model a run will really call (Face only / Full presenter always use
  // their own), so the settings shown are the ones that model takes.
  const effectiveModelId = modelForGeneration(source, genOptions, mode)

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
    } catch {
      setCopiedPrompt('failed')
    }
    setTimeout(() => setCopiedPrompt(false), 1800)
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

  const brandedRenderInWizard =
    simpleModeActive &&
    ctx.guidedStep === 4 &&
    chooseFinalOutputPath({ personalizationMode: mode || null }) === 'branded-render' &&
    (generation.status === 'generating' ||
      generation.status === 'processing' ||
      generation.status === 'error' ||
      (generation.status === 'complete' && result?.metadata?.source === 'branded-render'))

  // Advanced Editing is the body: on wide screens the dialog becomes a fixed
  // frame whose panes scroll on their own (see advanced/AdvancedWorkspace.tsx).
  const advancedFrame =
    !(generation.status === 'complete' && result) &&
    generation.status !== 'error' &&
    !personalizationInProgress &&
    !simpleModeActive

  const generateLabel = outputType === 'prompt'
    ? '✦ Personalize Prompt'
    : outputType === 'image'
    ? '✦ Generate Image'
    : outputType === 'video'
    ? '✦ Personalize Video'
    : '✦ Generate Everything'

  // What is still missing, shown before the click (checklist, step bar, footer).
  const projectRequirements = validateProjectRequirements(ctx)
  const blockingRequirement = projectRequirements.find((r) => r.severity === 'error' && requirementLocation(r.field))
  const fixRequirement = (field: string) => {
    const location = requirementLocation(field)
    if (!location) return
    ctx.setAdvancedSection?.(location.tab, location.section)
    ctx.setAdvancedTab?.(location.tab)
    focusRequirementControl(location.focus)
  }

  return (
      <div
        className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5"
        style={{
          background: 'radial-gradient(circle at top, rgba(217,255,0,.07), transparent 30%), #0a0a0a',
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
        className={`w-full overflow-hidden shadow-2xl flex flex-col ${advancedFrame ? (isFullscreen ? 'xl:h-screen' : 'xl:h-[90vh]') : ''}`}
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
          className="flex items-start justify-between gap-3 md:gap-6 flex-shrink-0"
          style={{ padding: advancedFrame ? '12px 24px' : '24px 28px', borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex gap-3.5 min-w-0 flex-1">
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
                  {advancedFrame && (clientForm.businessName || clientForm.name) && (
                    <span
                      data-testid="pz-header-business"
                      className="ml-2.5 align-middle"
                      style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.cyan, fontSize: 11, fontWeight: 800, letterSpacing: 0 }}
                    >
                      {clientForm.businessName || clientForm.name}
                    </span>
                  )}
                </h1>
                {/* The intro is hidden in Advanced Editing (it needs the room)
                    and on phones (it pushed the title into the buttons). */}
                {niche ? (
                  <p
                    className={`${advancedFrame ? 'hidden' : 'hidden md:block'} mt-1.5 max-w-[900px] text-[13px] leading-[1.55]`}
                    style={{ color: C.muted }}
                  >
                    {renderStrongMarkup(niche.ctaBody)}
                  </p>
                ) : (
                  <p
                    className={`${advancedFrame ? 'hidden' : 'hidden md:block'} mt-1.5 max-w-[900px] text-[13px] leading-[1.55]`}
                    style={{ color: C.muted }}
                  >
                    {isAnonymous
                      ? 'Find My Brand: paste your business website — or search for a business — and we surface the logos, photos, products and branding its page already has, for you to review and arrange below. Nothing is generated and nothing is charged.'
                      : 'Turn this demo into a custom version for yourself, your business, or a customer. Personalize the person, branding, products, prompt, offer and CTA.'}
                  </p>
                )}
              </div>
          </div>
          {/* Actions stay together on the right, so the title never runs under them. */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Prompt-only sources have no Simple Mode, so no toggle. */}
            {guidedApiAvailable && source.mediaType !== 'prompt-only' && (
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
                {/* Icon-only on phones; the label stays the button's name. */}
                <span className="sr-only sm:not-sr-only">{viewMode === 'simple' ? 'Advanced Editing' : 'Simple Mode'}</span>
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
          </div>
        </header>

        {/* ── BODY ──────────────────────────────────────────────────── */}
        <main
          className={`flex-1 overflow-y-auto ${advancedFrame ? 'xl:overflow-hidden xl:flex xl:flex-col xl:min-h-0' : ''}`}
          data-pz-scroll-root
          style={{ padding: '0 26px' }}
        >
          {/* A reopened project whose saved video is missing the approved
              layers says so, even before a new result is shown. */}
          {generation.status !== 'complete' && result?.metadata?.layersMissing === true && typeof result.metadata.layersNote === 'string' && (
            <div data-testid="pz-layers-note-restored" role="status" className="rounded-xl p-3 text-xs" style={{ margin: '12px 0', border: '1px solid rgba(251,191,36,.35)', background: 'rgba(251,191,36,.06)', color: '#fcd34d' }}>
              {result.metadata.layersNote}
            </div>
          )}
          {brandedRenderInWizard ? (
            // A branded render started from Simple Mode stays in Step 4, which
            // shows its progress, Cancel, any error and Download / Upload.
            <SimpleModeWizard onEditDiscoveredAsset={isAnonymous ? undefined : openDiscoveredImageEditor} />
          ) : generation.status === 'complete' && result ? (
            <ResultView
              canPublish={ctx.canPublish}
              publishNote={ctx.publishNote}
              canEditInVideoStudio={ctx.canEditInVideoStudio}
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
               isReadyToGenerate={Boolean((clientForm.businessName || clientForm.name) && (outputType === 'prompt' || mode || creationMethod === 'browser')) && !blockingRequirement}
               requirements={projectRequirements}
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
              resolveBusinessWebsite={resolveBusinessWebsite}
              websiteLookup={websiteLookup}
              setDiscoveryError={setDiscoveryError}
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
                autoCutout={autoCutout}
              />
          )}
        </main>

        {/* ── STICKY FOOTER ────────────────────────────────────────── */}
        {/* Anonymous sessions never generate: no footer action is offered. */}
        {/* Simple Mode replaces the footer with the wizard's own step navigation. */}
        {!isAnonymous && !personalizationInProgress && !simpleModeActive && generation.status !== 'complete' && generation.status !== 'error' && (
          <footer
            className="flex flex-wrap items-center justify-end gap-2.5 flex-shrink-0"
            style={{
              padding: '18px 26px 22px',
              borderTop: `1px solid ${C.border}`,
              background: '#121212',
            }}
          >
            {blockingRequirement && (
              // Why the main button is disabled, and a jump to fix it.
              <button
                type="button"
                data-testid="pz-footer-reason"
                onClick={() => fixRequirement(blockingRequirement.field)}
                className="w-full sm:w-auto sm:mr-auto text-left text-[11px] font-bold"
                style={{ background: 'transparent', border: 0, color: '#fcd34d', cursor: 'pointer', padding: 0 }}
              >
                ⚠ {blockingRequirement.message} <span style={{ color: C.cyan, textDecoration: 'underline' }}>Fix it</span>
              </button>
            )}
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
              // Videos go through createFinalVideo, so the on-video layers from
              // Create › Overlays end up in the file (not only in the preview).
              onClick={outputType === 'prompt' ? handlePersonalize : outputType === 'image' || !isVideo ? generate : () => { void ctx.createFinalVideo({ approveNow: true }) }}
              disabled={!((clientForm.businessName || clientForm.name) && (outputType === 'prompt' || mode || creationMethod === 'browser')) || Boolean(blockingRequirement) || personalizationInProgress}
              title={blockingRequirement ? blockingRequirement.message : undefined}
              className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{
                minWidth: 190,
                minHeight: 42,
                padding: '0 19px',
                border: `1px solid ${C.cyan}`,
                background: C.cyan,
                color: '#000000',
                boxShadow: '0 8px 26px rgba(217,255,0,.18)',
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
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: `linear-gradient(to right, ${C.cyan}, #c4e600)` }} />
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
          style={{ background: 'rgba(217,255,0,0.15)', border: '1px solid rgba(217,255,0,0.3)', color: C.cyan }}
        >
          <RefreshCw size={14} /> {retryLabel}
        </button>
        {stage !== 'prompt' && (
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: C.cyan, color: '#000000' }}
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
    canPublish = true, canEditInVideoStudio = true, publishNote = '',
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
            className={classNames('px-4 py-2 text-sm font-medium transition-colors', resultTab === tab ? 'text-primary' : 'text-white/50 hover:text-white/80')}
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
          <div className="rounded-xl border border-primary/20 bg-black/30 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.cyan }}>Personalized Prompt</span>
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/90 mt-2">
              {promptState.edited || promptState.personalized || promptState.original}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={generateAgain} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(217,255,0,0.15)', border: '1px solid rgba(217,255,0,0.3)', color: C.cyan }}>
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
            {/* Only offered where publishing is available on this page. */}
            {canPublish && (
              <button onClick={publish} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(217,255,0,0.15)', border: '1px solid rgba(217,255,0,0.3)', color: C.cyan }}>
                <Share2 size={14} /> Publish
              </button>
            )}
            {!canPublish && publishNote && (
              <span data-testid="pz-publish-note" className="self-center text-xs" style={{ color: C.muted }}>{publishNote}</span>
            )}
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
            {/* Video Studio needs a stored video and a presenter photo (not a
                video rendered in this browser). */}
            {canEditInVideoStudio && (
              <button onClick={editInVideoStudio} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:bg-white/5">
                Edit in Video Studio
              </button>
            )}
            {/* Only offered where publishing is available on this page. */}
            {canPublish && (
              <button onClick={publish} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(217,255,0,0.15)', border: '1px solid rgba(217,255,0,0.3)', color: C.cyan }}>
                <Share2 size={14} /> Publish
              </button>
            )}
            {!canPublish && publishNote && (
              <span data-testid="pz-publish-note" className="self-center text-xs" style={{ color: C.muted }}>{publishNote}</span>
            )}
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

      {typeof result.metadata?.layersNote === 'string' && (
        <div data-testid="pz-layers-note" role="status" className="rounded-xl p-3 text-xs" style={{ border: '1px solid rgba(251,191,36,.35)', background: 'rgba(251,191,36,.06)', color: '#fcd34d' }}>
          {result.metadata.layersNote}
        </div>
      )}
      {result.metadata?.layersBurnedIn === true && (
        <div data-testid="pz-layers-burned" className="text-xs" style={{ color: C.green }}>
          ✓ Your on-video layers are in this video, and a copy was downloaded to your device.
        </div>
      )}
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
              style={{ background: 'rgba(217,255,0,0.15)', border: '1px solid rgba(217,255,0,0.3)', color: C.cyan }}
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

/** Business search results shown per "Show more" page in Advanced Editing. */
const RESULTS_PAGE = 8

/** Drop targets under the "Found on website" grid in Advanced Editing. */
const ADVANCED_DROP_ZONES: DiscoveredAssetDropZone[] = [
  { section: 'person', label: 'Person' },
  { section: 'logo', label: 'Logo' },
  { section: 'products', label: 'Products' },
  { section: 'brand', label: 'Brand' },
  { section: 'firstFrame', label: 'First frame' },
  { section: 'lastFrame', label: 'Last frame' },
  { section: 'ctaGraphic', label: 'CTA graphic' },
]

function ConfigurationView(props: any) {
  const {
    autoFilledKeys,
    businessLoadSummary,
    advancedTab: ctxAdvancedTab,
    setAdvancedTab: ctxSetAdvancedTab,
    advancedSections: ctxAdvancedSections,
    setAdvancedSection: ctxSetAdvancedSection,
    previewVideo: ctxPreviewVideo,
    creationMethod: ctxCreationMethod,
    setCreationMethod: ctxSetCreationMethod,
    moveDiscoveredAssetToSection: ctxMoveDiscoveredAssetToSection,
    previewSettings: ctxPreviewSettings,
    promptNotice,
    updatePreviewComposition: ctxUpdatePreviewComposition,
  } = useDemoPersonalize()
  const isAuto = (key: AutoFillKey) => Boolean(autoFilledKeys?.has(key))
  // Contexts without the tab API (partial test doubles) still get a working
  // local tab state.
  const [localAdvancedTab, setLocalAdvancedTab] = useState<AdvancedEditingTab>('client')
  const advancedTab: AdvancedEditingTab = ctxAdvancedTab || localAdvancedTab
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [localAdvancedSections, setLocalAdvancedSections] = useState<AdvancedEditingSections>(DEFAULT_ADVANCED_SECTIONS)
  const advancedSections: AdvancedEditingSections = ctxAdvancedSections || localAdvancedSections
  const activeSection = advancedSections[advancedTab]
  const scrollToTop = () => {
    // Start the newly shown section at its top (pane on wide screens, page otherwise).
    document.querySelector('[data-pz-pane-scroll]')?.scrollTo?.({ top: 0 })
    document.querySelector('[data-pz-scroll-root]')?.scrollTo?.({ top: 0 })
  }
  const selectAdvancedTab = useCallback((tab: AdvancedEditingTab) => {
    if (typeof ctxSetAdvancedTab === 'function') ctxSetAdvancedTab(tab)
    else setLocalAdvancedTab(tab)
    scrollToTop()
  }, [ctxSetAdvancedTab])
  const selectAdvancedSection = useCallback((tab: AdvancedEditingTab, section: string) => {
    if (typeof ctxSetAdvancedSection === 'function') ctxSetAdvancedSection(tab, section)
    else setLocalAdvancedSections((prev) => ({ ...prev, [tab]: section }))
    scrollToTop()
  }, [ctxSetAdvancedSection])
  /** Show a tab and one of its sections. */
  const goToSection = useCallback((tab: AdvancedEditingTab, section: string) => {
    selectAdvancedSection(tab, section)
    selectAdvancedTab(tab)
  }, [selectAdvancedSection, selectAdvancedTab])
  const requirements = (props.requirements || []) as AIMissingRequirement[]
  /** Open where a missing requirement is fixed and focus that control. */
  const fixRequirement = (field: string) => {
    const location = requirementLocation(field)
    if (!location) return
    goToSection(location.tab, location.section)
    focusRequirementControl(location.focus)
  }
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
    resolveBusinessWebsite,
    websiteLookup,
    setDiscoveryError,
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
    autoCutout,
  } = props

  // ── Access mode ────────────────────────────────────────────────────────────
  // The access mode is chosen by the caller of openPersonalize (the landing page
  // asks for 'anonymous'), never inferred here, and every endpoint re-checks it
  // server-side. It decides which discovery endpoint is used and which paid/AI
  // affordances exist — the modal never renders a paid action the server has not
  // granted.
  const isAnonymous = access !== 'authenticated'
  // Face only / Full presenter models set their own resolution and quality.
  const modelSetsQuality = mode === 'face_only' || mode === 'full_body'
  // Saved clients are picked one way at a time: the cards (customer audience)
  // or else the dropdown in the profile form.
  const showSavedClientCards = !isAnonymous && clientForm.audience === 'customer' && clients.length > 0
  /** Clear the form for a client that isn't saved yet (keeping who it's for). */
  const startNewClient = () => {
    const audience = clientForm.audience
    selectClient('')
    if (audience) updateClientForm({ audience })
  }
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
  const [clientSaveStatus, setClientSaveStatus] = useState<'saved' | 'error' | null>(null)

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
    if (!window.confirm('Remove this saved lead?')) return
    let res: Response
    try {
      res = await fetch(`/api/personalization/leads/${leadId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    } catch {
      setSavedLeadsError("Couldn't reach the server — check your connection and try again.")
      return
    }
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
  // Long result lists show a page at a time so the section stays short.
  const [shownResultCount, setShownResultCount] = useState(RESULTS_PAGE)
  useEffect(() => { setShownResultCount(RESULTS_PAGE) }, [businessSearchResults])
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
  //
  // OpenStreetMap often lists only a Facebook/Instagram page as the
  // "website". Those pages carry none of the business's brand assets, so a
  // lead without an OWNED website first goes through the free website lookup,
  // and discovery runs on the business's real site once it is verified.
  // Each selection takes a new number, and so does unmounting (this view only exists while the modal is
  // open); a website lookup that finishes after a newer selection or a close is dropped instead of
  // replacing that newer state.
  const businessSelectSeqRef = useRef(0)
  useEffect(() => () => { businessSelectSeqRef.current += 1 }, [])
  const handleSelectBusiness = useCallback(async (business: BusinessDiscoveryRecord) => {
    const seq = ++businessSelectSeqRef.current
    const listed = business.website?.trim()
    if (listed && isOwnedWebsite(listed)) {
      // Populate, research and discover in one automated run.
      void runDiscoveryWorkflow(listed, { business })
      return
    }

    setDiscoveryError(null)
    const found = resolveBusinessWebsite ? await resolveBusinessWebsite(business) : null
    // Superseded or closed while the lookup ran (resolveBusinessWebsite returns null then too).
    if (seq !== businessSelectSeqRef.current) return
    if (found) {
      void runDiscoveryWorkflow(found, {
        business: { ...business, website: found, websiteStatus: 'confirmed' },
      })
      return
    }

    // Select it anyway, so the Selected panel opens with its Website field
    // and "Load from website"; the message says why nothing was loaded.
    selectBusiness(business)
    const hasSocial = Boolean(business.facebook || business.instagram || (listed && !isOwnedWebsite(listed)))
    setDiscoveryError(hasSocial
      ? `We couldn't find ${business.name}'s own website — only a social media page is listed. Paste the business website in the Website field and use Find My Brand.`
      : `We couldn't find a website for ${business.name}. Paste one in the Website field and use Find My Brand.`)
  }, [resolveBusinessWebsite, runDiscoveryWorkflow, selectBusiness, setDiscoveryError])

  const handleOpenSavedLead = useCallback((lead: LeadRecord) => {
    // Same selection path the result cards use, so the Personalization handoff
    // (anonymous automated run or authenticated select) is identical.
    setSavedLeadsOpen(false)
    void handleSelectBusiness(lead.business)
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

    const advancedTabsDone: Partial<Record<AdvancedEditingTab, boolean>> = {
      client: Boolean(clientForm.businessName || clientForm.name),
      assets: Boolean(assets.primaryIdentity || assets.identities?.length || assets.logos?.length || assets.products?.length),
      recast: ctxPreviewVideo?.kind === 'recast',
      create: Boolean(mode) || Boolean(promptState?.personalized || promptState?.edited),
    }

    return (
      <div
        className="pz-adv-root xl:flex xl:flex-col xl:h-full xl:min-h-0"
        onClickCapture={(event) => {
          // A link to a section on another tab or pill shows it first.
          const link = (event.target as HTMLElement | null)?.closest?.('a[href^="#pz-"]')
          const id = link?.getAttribute('href')?.slice(1)
          const location = id ? SECTION_LOCATION[id] : undefined
          if (location) goToSection(location.tab, location.section)
        }}
      >
        {dropError && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.danger}`, background: 'rgba(239,68,68,.08)', color: '#fca5a5', fontSize: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} />
            <span>{dropError}</span>
          </div>
        )}
        {/* Hidden file inputs for add-more placeholders */}
       <input ref={identityInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleIdentityUpload(e.target.files); e.target.value = '' }} />
       <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleLogoUpload(e.target.files); e.target.value = '' }} />
       <input ref={productInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { handleProductUpload(e.target.files); e.target.value = '' }} />
       <input ref={brandRefInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { handleBrandRefUpload(e.target.files); e.target.value = '' }} />

      <AdvancedStepBar
        active={advancedTab}
        onSelect={selectAdvancedTab}
        done={advancedTabsDone}
        issues={isAnonymous ? {} : blockingByTab(requirements)}
      />
      <AdvancedSectionPills
        tab={advancedTab}
        active={activeSection}
        onSelect={(section) => selectAdvancedSection(advancedTab, section)}
        badges={{ found: discoveryStatus === 'reviewing' ? discoveredAssets.length : 0 }}
      />

      {/* ── IMPORT CONFIRMATION ───────────────────────────────────── */}
      {importConfirmation && (
        <div className="flex-none" style={{ padding: '10px 14px', border: `1px solid ${C.cyan}`, borderRadius: 12, background: 'rgba(217,255,0,.08)', margin: '10px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: C.cyan, fontSize: 18 }}>✓</span>
            <div>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
                {importConfirmation.count} asset{importConfirmation.count === 1 ? '' : 's'} added{importConfirmation.clientName ? ` to ${importConfirmation.clientName}` : ''}
              </div>
              <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                Assets are now in Assets → Your assets.
              </div>
            </div>
            <button
              type="button"
              onClick={() => goToSection('assets', 'yours')}
              style={{ marginLeft: 'auto', minHeight: 30, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.cyan}`, background: 'transparent', color: C.cyan, fontSize: 11, fontWeight: 800 }}
            >
              View →
            </button>
          </div>
        </div>
      )}

      {/* ── WORKSPACE: active tab | sticky live preview ─────────────────
          Every existing section is kept and only regrouped into tabs. All
          panels stay mounted (inactive ones hidden) so switching tabs never
          loses input, and every section id stays in the DOM.             */}
      <div
        className="pz-adv-layout grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] xl:flex-1 xl:min-h-0"
        style={{ columnGap: 24 }}
      >
        <button
          type="button"
          className="order-first xl:hidden"
          onClick={() => setMobilePreviewOpen((open) => !open)}
          aria-expanded={mobilePreviewOpen}
          style={{ marginTop: 12, minHeight: 34, borderRadius: 10, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.cyan, fontSize: 11, fontWeight: 800 }}
        >
          {mobilePreviewOpen ? 'Hide preview' : 'Show preview'}
        </button>
        <div className="pz-adv-pane min-w-0 xl:h-full xl:overflow-y-auto xl:min-h-0" data-pz-pane-scroll style={{ paddingRight: 4 }}>
      <AdvancedTabPanel tab="client" active={advancedTab}>
        {discoveryStatus === 'reviewing' && discoveredAssets.length > 0 && (
          <div
            data-testid="pz-review-assets-callout"
            role="status"
            className="flex items-center justify-between flex-wrap"
            style={{ gap: 10, marginTop: 14, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, fontSize: 12 }}
          >
            <span style={{ color: C.text, fontWeight: 700 }}>
              ✓ Found {discoveredAssets.length} asset{discoveredAssets.length === 1 ? '' : 's'} on the website
              {businessLoadSummary?.logo || businessLoadSummary?.photos ? ' — the best ones are already placed' : ''}.
            </span>
            <button
              type="button"
              onClick={() => goToSection('assets', 'found')}
              style={{ minHeight: 32, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.cyan}`, background: C.cyan, color: '#000000', fontSize: 11, fontWeight: 900 }}
            >
              Review in Assets →
            </button>
          </div>
        )}
      {/* ── TOP OVERVIEW: Source Demo | Client Profile ────────────── */}
      <section id="pz-overview" style={{ padding: '14px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        {/* Client: "Find business" and "Profile" sections */}
        <AdvancedSectionPanel tab="client" section="find" sections={advancedSections}>
        <div id="pz-find-business" className="panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <h2 style={{ margin: '0 0 13px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>WHO IS THIS FOR?</h2>

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
              background: 'rgba(217,255,0,.05)',
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
                  color: '#000000',
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
                  background: clientForm.audience === key ? C.cyan : '#121212',
                  color: clientForm.audience === key ? '#000000' : C.text,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Find Local Business */}
          {clientForm.audience === 'customer' && businessSearchMode === 'idle' && !clientEntryDismissed && (
            <div style={{ marginBottom: 18, padding: 14, border: `1px dashed ${C.border}`, borderRadius: 10, background: 'rgba(217,255,0,.03)' }}>
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
                  onClick={() => {
                    handleClientEntryDismiss()
                    goToSection('client', 'profile')
                    focusRequirementControl('businessName')
                  }}
                  className="rounded-lg text-[11px] font-extrabold uppercase tracking-wide"
                  style={{
                    minHeight: 38,
                    padding: '0 16px',
                    border: `1px solid ${C.border}`,
                    background: '#121212',
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
                        background: '#121212',
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
                  color: '#000000',
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
            <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${C.danger}`, borderRadius: 10, background: 'rgba(239,68,68,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.danger, fontSize: 14 }}>⚠</span>
                <span style={{ color: C.danger, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Business Search Failed</span>
              </div>
              <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,.72)', fontSize: 11, lineHeight: 1.5 }}>{businessSearchError}</p>
              <button
                type="button"
                onClick={() => {
                  // Re-run the same search; without one, reopen the form.
                  if (searchNiche && searchLocation.trim()) runBusinessSearch(searchRadius)
                  else setBusinessSearchMode?.('searching')
                }}
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
                {businessSearchResults.slice(0, shownResultCount).map((business) => (
                  <div
                    key={business.id}
                    style={{
                      padding: 12,
                      border: `1px solid ${selectedBusiness?.id === business.id ? C.cyanBorder : C.border}`,
                      borderRadius: 10,
                      background: selectedBusiness?.id === business.id ? 'rgba(217,255,0,.06)' : '#121212',
                      cursor: 'pointer',
                    }}
                    onClick={() => { void handleSelectBusiness(business) }}
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
                          {isOwnedWebsite(business.website) ? (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.green }}>✓ Website</span>
                          ) : business.facebook || business.instagram || business.website ? (
                            <span
                              style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted2 }}
                              title="Only a social media page is listed. We'll look for the business's own website when you use it."
                            >
                              Social page only
                            </span>
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
                              border: `1px solid ${leadSaveState[business.id] === 'saved' ? 'rgba(34,197,94,.45)' : leadSaveState[business.id] === 'error' ? C.danger : C.border}`,
                              background: leadSaveState[business.id] === 'saved' ? 'rgba(34,197,94,.12)' : C.panel,
                              color: leadSaveState[business.id] === 'saved' ? C.green : leadSaveState[business.id] === 'error' ? C.danger : 'white',
                            }}
                          >
                            {leadSaveState[business.id] === 'saved' ? 'Saved ✓' : leadSaveState[business.id] === 'error' ? 'Save failed' : leadSaveState[business.id] === 'saving' ? 'Saving…' : 'Save Lead'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleSelectBusiness(business) }}
                          className="rounded-lg text-[10px] font-extrabold uppercase tracking-wide"
                          style={{
                            minHeight: 32,
                            padding: '0 12px',
                            border: `1px solid ${C.cyan}`,
                            background: C.cyan,
                            color: '#000000',
                          }}
                        >
                          {websiteLookup?.status === 'searching' && websiteLookup.businessId === business.id
                            ? 'Finding website…'
                            : 'Use This Business'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {businessSearchResults.length > shownResultCount && (
                  <button
                    type="button"
                    data-testid="pz-results-show-more"
                    onClick={() => setShownResultCount((count) => count + RESULTS_PAGE)}
                    style={{ minHeight: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.cyan, fontSize: 11, fontWeight: 800 }}
                  >
                    Show {Math.min(RESULTS_PAGE, businessSearchResults.length - shownResultCount)} more of {businessSearchResults.length - shownResultCount}
                  </button>
                )}
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
                        background: '#121212',
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
                                color: lead.starred ? '#f59e0b' : C.muted2,
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
                                color: '#000000',
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
            <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${C.cyan}`, borderRadius: 10, background: 'rgba(217,255,0,.06)' }}>
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
                {!selectedBusiness.website && (
                  <div data-testid="pz-add-website-hint" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: C.muted2 }}>Add their website to load their logo, photos and offer.</span>
                    <button
                      type="button"
                      disabled={!clientForm.website?.trim() || brandRunInFlight}
                      onClick={() => {
                        const website = clientForm.website?.trim()
                        if (website) void runDiscoveryWorkflow(website, { business: { ...selectedBusiness, website } })
                      }}
                      className="rounded-[8px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-40"
                      style={{ minHeight: 28, padding: '0 10px', border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.cyan }}
                    >
                      Load from website
                    </button>
                  </div>
                )}
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
                      background: businessResearch.status === 'done' ? '#000000' : C.cyan,
                      color: businessResearch.status === 'done' ? C.cyan : '#000000',
                    }}
                  >
                    {businessResearch.status === 'researching' ? 'Researching...' : businessResearch.status === 'done' ? 'Research Complete' : 'Research Business'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (businessSearchResults.length > 0 ? setBusinessSearchMode?.('results') : clearBusinessSearch())}
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
                <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, background: '#121212' }}>
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
                <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.danger}`, borderRadius: 8, background: 'rgba(239,68,68,.08)' }}>
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

        </div>
        </AdvancedSectionPanel>

        <AdvancedSectionPanel tab="client" section="profile" sections={advancedSections}>
        <div id="pz-client-profile" className="panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          {/* Saved Clients — entitlement-gated: free visitors have no saved
              profiles, so the control is not offered at all. */}
          {showSavedClientCards && (
            <div style={{ marginBottom: 18 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Saved Clients</div>
                <button
                  type="button"
                  data-testid="pz-new-client"
                  onClick={startNewClient}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/70 hover:bg-white/10"
                >
                  + New client
                </button>
              </div>
              <div className="flex flex-wrap gap-2" style={{ maxHeight: 132, overflowY: 'auto' }} data-testid="pz-saved-clients">
                {clients.map((c: any) => {
                  const isSelected = selectedClientId === c.id
                  // The card picks the client; Edit/Delete sit beside the pick
                  // button (not inside it), so each action works on its own.
                  return (
                    <div
                      key={c.id}
                      data-testid="pz-saved-client-card"
                      style={{
                        minWidth: 160,
                        border: `1px solid ${isSelected ? C.cyan : C.border}`,
                        borderRadius: 10,
                        background: isSelected ? 'rgba(217,255,0,.08)' : C.panelSoft,
                        color: C.text,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => useSavedClient(c.id)}
                        aria-pressed={isSelected}
                        className="block w-full text-left"
                        style={{ padding: '10px 12px 6px', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{c.businessName || c.name || 'Untitled'}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                          {[c.industry, c.location].filter(Boolean).join(' • ') || 'No details'}
                        </div>
                      </button>
                      {isSelected && (
                        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => focusRequirementControl('businessName')}
                            className="text-[10px] font-extrabold uppercase"
                            style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm('Delete this client and their saved assets?')) deleteSavedClient(c.id) }}
                            className="text-[10px] font-extrabold uppercase"
                            style={{ color: C.danger, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <ResumeProjectBanner />
          <h2 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Client Profile</h2>
          <p data-testid="pz-profile-required-hint" style={{ margin: '0 0 13px', color: C.muted, fontSize: 11 }}>
            Only the business name is required — everything else improves the result.
          </p>
          {businessLoadSummary && businessLoadSummary.details > 0 && (
            <div
              data-testid="pz-business-load-summary"
              role="status"
              style={{ margin: '-4px 0 12px', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.text, fontSize: 11 }}
            >
              ✓ Loaded {businessLoadSummary.details} detail{businessLoadSummary.details === 1 ? '' : 's'}
              {businessLoadSummary.logo ? ', the logo' : ''}
              {businessLoadSummary.photos ? ` and ${businessLoadSummary.photos} photo${businessLoadSummary.photos === 1 ? '' : 's'}` : ''}
              {businessLoadSummary.domain ? ` from ${businessLoadSummary.domain}` : ''}. Fields tagged “from website” can be edited.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
            <div className="col-span-full">
              <Field autoFilled={isAuto('website')} label="Website" value={clientForm.website} placeholder="https://joesroofing.com" onChange={(v) => updateClientForm({ ...clientForm, website: v })} full />
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
                  color: '#000000',
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
                <div style={{ marginTop: 10, padding: 12, border: `1px solid ${C.danger}`, borderRadius: 10, background: 'rgba(239,68,68,.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: C.danger, fontSize: 14 }}>⚠</span>
                    <span style={{ color: C.danger, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>We couldn&apos;t find business assets</span>
                  </div>
                  <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,.72)', fontSize: 11, lineHeight: 1.5 }}>{discoveryError}</p>
                  <button
                    type="button"
                    onClick={() => discoverAssets(clientForm.website)}
                    disabled={!clientForm.website?.trim()}
                    title={clientForm.website?.trim() ? undefined : 'Enter a website first'}
                    className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.danger}`, background: C.danger, color: '#fff' }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            {/* The dropdown is the picker when the saved-client cards above
                are not shown (one way to pick a client at a time). */}
            {!isAnonymous && !showSavedClientCards && (
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
                    onClick={startNewClient}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                  >
                    New
                  </button>
                </div>
              </div>
            )}
            <Field autoFilled={isAuto('businessName')} required focusId="businessName" label="Business Name" value={clientForm.businessName} placeholder="ABC Roofing" onChange={(v) => updateClientForm({ ...clientForm, businessName: v })} />
            <Field autoFilled={isAuto('industry')} label="Industry" value={clientForm.industry} placeholder="Roofing" onChange={(v) => updateClientForm({ ...clientForm, industry: v })} />
            <Field autoFilled={isAuto('location')} label="Location" value={clientForm.location} placeholder="Tampa, Florida" onChange={(v) => updateClientForm({ ...clientForm, location: v })} />
            <Field autoFilled={isAuto('phone')} focusId="phone" label="Phone" value={clientForm.phone} placeholder="555-555-5555" onChange={(v) => updateClientForm({ ...clientForm, phone: v })} />
            {!isAnonymous && (
              <div className="col-span-full flex gap-2">
                <button
                  onClick={async () => {
                    const saved = await saveClient()
                    setClientSaveStatus(saved ? 'saved' : 'error')
                    window.setTimeout(() => setClientSaveStatus(null), 2500)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'rgba(217,255,0,.12)', border: `1px solid ${C.cyanBorder}`, color: C.cyan }}
                >
                  <Save size={14} /> {selectedClientId ? 'Update Client' : 'Save Client'}
                </button>
                {selectedClientId && (
                  <button
                    // Same as the saved-client card's Delete: confirm, and the
                    // client's saved assets go too.
                    onClick={() => { if (window.confirm('Delete this client and their saved assets?')) deleteSavedClient(selectedClientId) }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium border"
                    style={{ color: C.danger, borderColor: 'rgba(239,68,68,.25)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                {clientSaveStatus && (
                  <span role="status" data-testid="pz-client-save-status" className="self-center text-[11px] font-bold" style={{ color: clientSaveStatus === 'saved' ? C.green : C.danger }}>
                    {clientSaveStatus === 'saved' ? 'Saved ✓' : "Couldn't save this client — try again"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        </AdvancedSectionPanel>
      </section>

      </AdvancedTabPanel>

      <AdvancedTabPanel tab="assets" active={advancedTab}>

      <AdvancedSectionPanel tab="assets" section="yours" sections={advancedSections}>
      {/* ── CLIENT ASSETS (full width, 6 numbered cards) ──────────── */}
      <section id="pz-client-assets" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>YOUR ASSETS</h2>
        <p data-testid="pz-assets-usage-note" style={{ margin: '6px 0 0', color: C.muted, fontSize: 11 }}>
          The presenter photo drives Face only / Full presenter. The logo and product photos appear as on-video layers
          (Overlays); brand photos and frames guide the AI where the chosen model supports them.
        </p>
        <p style={{ margin: '6px 0 18px', color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
          Add the people, products, branding and visual references SmartVideo should use when personalizing this demo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {/* 1. Person / Presenter */}
          <article
            className="asset-card"
            data-pz-focus="presenter"
            data-asset-section="person"
            onDragEnter={(e) => handleSectionDragEnter('person', e)}
            onDragOver={(e) => handleSectionDragOver('person', e)}
            onDragLeave={(e) => handleSectionDragLeave('person', e)}
            onDrop={(e) => handleSectionDrop('person', e)}
            style={{
              minHeight: 250,
              padding: 18,
              background: dragOverSection === 'person' ? 'rgba(217,255,0,.04)' : C.panelSoft,
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
            <UploadZone primary="Add Photos" secondary="Drag & drop or browse" collapsed={assets.identities.length > 0} addLabel="+ Add more photos" onFiles={handleIdentityUpload} multiple disabled={assets.identities.length >= capabilities.maxImages && capabilities.maxImages > 0} onUrl={handleIdentityUrl} urlLabel="Add Photo URL" urlPlaceholder="Paste image URL and press Enter" />
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
                    onMakePrimary={assets.identities.length > 1 && assets.primaryIdentity?.id !== asset.id ? () => setPrimaryIdentity(asset.id) : undefined}
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
                  <ThumbPlaceholder label="FACE" onClick={handleIdentityAddClick} />
                  <ThumbPlaceholder label="BODY" onClick={handleIdentityAddClick} />
                  <ThumbPlaceholder label="SIDE" onClick={handleIdentityAddClick} />
                </>
              )}
              <ThumbPlaceholder label="+" add onClick={handleIdentityAddClick} />
            </div>
            {assets.primaryIdentity && (
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>★ Primary</span>
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
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'logo' ? 'rgba(217,255,0,.04)' : C.panelSoft, border: dragOverSection === 'logo' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🏷</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>2. Logo</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Upload the client&apos;s exact logo for exact branding.</p>
              </div>
            </div>
            <UploadZone primary="Upload Logo" secondary="Drag & drop or browse" collapsed={assets.logos.length > 0} addLabel="+ Add another logo" onFiles={handleLogoUpload} onUrl={handleLogoUrl} urlLabel="Add Logo URL" urlPlaceholder="Paste logo URL and press Enter" />
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
                background: assets.primaryLogo?.url ? '#000' : 'linear-gradient(145deg, #373737, #0f0f0f)',
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
              {onEditLibrary && assets.primaryLogo?.uploadStatus === 'ready' && isImageEditSupported(assets.primaryLogo) && (
                <button
                  type="button"
                  onClick={() => onEditLibrary(assets.primaryLogo)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(217,255,0,.92)', color: '#000000' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.primaryLogo?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.primaryLogo!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,68,68,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
              {assets.primaryLogo && (
                <>
                  {assets.primaryLogo.edited && (
                    <button
                      type="button"
                      onClick={() => revertLibraryAssetToOriginal(assets.primaryLogo!.id)}
                      className="absolute right-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                      style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
                    >
                      Revert
                    </button>
                  )}
                  {assets.primaryLogo.uploadStatus !== 'error' && (
                    <button
                      type="button"
                      data-testid="pz-primary-logo-remove"
                      onClick={() => removeLogo(assets.primaryLogo!.id)}
                      className="absolute top-1 right-1 z-20 rounded-full p-1"
                      style={{ background: 'rgba(239,68,68,.85)' }}
                      aria-label="Remove logo"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  )}
                </>
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
                   onMakePrimary={() => setPrimaryLogo(asset.id)}
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
                <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>★ Primary</span>
                <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, marginTop: 8, marginRight: 4, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Final Overlay</span>
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
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'products' ? 'rgba(217,255,0,.04)' : C.panelSoft, border: dragOverSection === 'products' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>📦</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>3. Products / Services</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Add products, finished work, locations or service images.</p>
              </div>
            </div>
            <UploadZone primary="Add Images" secondary="Drag & drop or browse" collapsed={assets.products.length > 0} onFiles={handleProductUpload} multiple onUrl={handleProductUrl} urlLabel="Add Image/Video URL" urlPlaceholder="Paste image or video URL and press Enter" accept="image/*,video/*" />
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
                  <ThumbPlaceholder label="1" title="Add a product photo" onClick={handleProductAddClick} />
                  <ThumbPlaceholder label="2" title="Add a product photo" onClick={handleProductAddClick} />
                  <ThumbPlaceholder label="3" title="Add a product photo" onClick={handleProductAddClick} />
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
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'brand' ? 'rgba(217,255,0,.04)' : C.panelSoft, border: dragOverSection === 'brand' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🏢</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>4. Brand References</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Show SmartVideo what the client&apos;s business and brand look like.</p>
              </div>
            </div>
            <UploadZone primary="Add Images" secondary="Drag & drop or browse" collapsed={assets.brandReferences.length > 0} onFiles={handleBrandRefUpload} multiple onUrl={handleBrandRefUrl} urlLabel="Add Image/Video URL" urlPlaceholder="Paste image or video URL and press Enter" accept="image/*,video/*" />
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
                  <ThumbPlaceholder label="STORE" onClick={handleBrandRefAddClick} />
                  <ThumbPlaceholder label="TEAM" onClick={handleBrandRefAddClick} />
                  <ThumbPlaceholder label="VEHICLE" onClick={handleBrandRefAddClick} />
                </>
              )}
              <ThumbPlaceholder label="+" add onClick={handleBrandRefAddClick} />
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
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'firstFrame' ? 'rgba(217,255,0,.04)' : C.panelSoft, border: dragOverSection === 'firstFrame' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🎬</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>5. First Frame</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Control how the personalized video begins.</p>
              </div>
            </div>
            <UploadZone primary="Upload Image" collapsed={Boolean(assets.firstFrame)} addLabel="Replace image" onFiles={handleFirstFrameUpload} onUrl={handleFirstFrameUrl} urlLabel="Add Image URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
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
                background: assets.firstFrame?.url ? '#000' : 'linear-gradient(145deg, #27272a, #0f0f0f)',
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
                {onEditLibrary && assets.firstFrame?.uploadStatus === 'ready' && isImageEditSupported(assets.firstFrame) && (
                <button
                  type="button"
                  onClick={() => onEditLibrary(assets.firstFrame)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(217,255,0,.92)', color: '#000000' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.firstFrame?.edited && (
                <button
                  type="button"
                  onClick={() => revertLibraryAssetToOriginal(assets.firstFrame!.id)}
                  className="absolute right-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
                >
                  Revert
                </button>
              )}
              {assets.firstFrame?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.firstFrame!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,68,68,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>First Frame</span>
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
            style={{ minHeight: 250, padding: 18, background: dragOverSection === 'lastFrame' ? 'rgba(217,255,0,.04)' : C.panelSoft, border: dragOverSection === 'lastFrame' ? `1px solid ${C.cyanBorder}` : `1px solid ${C.border}`, borderRadius: 16, transition: 'border-color .15s, background .15s' }}
          >
            <div className="flex gap-2.5 items-start" style={{ marginBottom: 14 }}>
              <div className="w-[35px] h-[35px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: C.cyanSoft, color: C.cyan, fontSize: 16 }}>🎯</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>6. Last Frame / CTA</h3>
                <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.4 }}>Control how the personalized video ends.</p>
              </div>
            </div>
            <UploadZone primary="Upload Image" collapsed={Boolean(assets.lastFrame)} addLabel="Replace image" onFiles={handleLastFrameUpload} onUrl={handleLastFrameUrl} urlLabel="Add Image URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
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
                background: assets.lastFrame?.url ? '#000' : 'linear-gradient(145deg, #27272a, #0f0f0f)',
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
              {onEditLibrary && assets.lastFrame?.uploadStatus === 'ready' && isImageEditSupported(assets.lastFrame) && (
                <button
                  type="button"
                  onClick={() => onEditLibrary(assets.lastFrame)}
                  className="absolute left-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(217,255,0,.92)', color: '#000000' }}
                >
                  {EDIT_WITH_AI}
                </button>
              )}
              {assets.lastFrame?.edited && (
                <button
                  type="button"
                  onClick={() => revertLibraryAssetToOriginal(assets.lastFrame!.id)}
                  className="absolute right-1 bottom-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
                >
                  Revert
                </button>
              )}
              {assets.lastFrame?.uploadStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => retryAssetUpload(assets.lastFrame!.id)}
                  className="absolute top-1 right-1 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
                  style={{ background: 'rgba(239,68,68,.9)', color: '#fff' }}
                >
                  Retry
                </button>
              )}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Last Frame</span>
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
                  background: savedAssetLibraryTab === key ? C.cyan : '#121212',
                  color: savedAssetLibraryTab === key ? '#000000' : C.text,
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
                   {/* Clicking adds the saved asset to this project (once). */}
                   <button
                     type="button"
                     data-testid="pz-saved-asset-add"
                     disabled={isAssetInCurrentJob(asset, assets)}
                     title={isAssetInCurrentJob(asset, assets) ? 'Already in this project' : 'Add to this project'}
                     style={{
                       display: 'block',
                       width: '100%',
                       height: 80,
                       padding: 0,
                       border: 0,
                       borderRadius: 8,
                       overflow: 'hidden',
                       background: '#000',
                       marginBottom: 6,
                       cursor: isAssetInCurrentJob(asset, assets) ? 'default' : 'pointer',
                     }}
                     onClick={() => selectSavedAsset(asset)}
                   >
                     <img src={asset.uploadedUrl || asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   </button>
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
                     {/* Only people and logos have a primary. */}
                     {(savedAssetLibraryTab === 'identities' || savedAssetLibraryTab === 'logos') && !asset.isPrimary && (
                       <button
                         type="button"
                         onClick={() => setPrimarySavedAsset(savedAssetLibraryTab === 'identities' ? 'identity' : 'logo', asset.id)}
                         className="text-[9px] font-extrabold uppercase"
                         style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                       >
                         Set Primary
                       </button>
                     )}
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

      </AdvancedSectionPanel>

      <AdvancedSectionPanel tab="assets" section="found" sections={advancedSections}>
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
                    style={{ minHeight: 36, padding: '0 14px', border: '1px solid rgba(196,230,0,.45)', background: 'rgba(196,230,0,.10)', color: '#e6ff66' }}
                  >
                    {visionStatus === 'analyzing' ? 'Analyzing…' : visionStatus === 'complete' ? '✓ Vision Analyzed' : '✦ Analyze with GO Vision'}
                  </button>
                  <button
                    type="button"
                    onClick={selectRecommendedDiscoveredAssets}
                    // With nothing flagged it would only clear the selection.
                    disabled={!discoveredAssets.some((a) => a.recommended && !a.rejected)}
                    title={discoveredAssets.some((a) => a.recommended && !a.rejected) ? undefined : 'No recommended assets — run GO Vision or pick assets yourself'}
                    className="rounded-[10px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
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
                    style={{ minHeight: 36, padding: '0 14px', border: `1px solid ${C.cyan}`, background: C.cyan, color: '#000000' }}
                  >
                    Use Selected Assets
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  // Cancelling throws away every found asset.
                  if (discoveredAssets.length === 0 || window.confirm('Discard all assets found on this website?')) cancelDiscovery()
                }}
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
                border: visionError ? '1px solid rgba(239,68,68,.3)' : '1px solid rgba(196,230,0,.35)',
                background: visionError ? 'rgba(239,68,68,.08)' : 'rgba(196,230,0,.08)',
                color: visionError ? '#fca5a5' : '#e6ff66',
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
                border: `1px solid ${batchVideoReady.error ? 'rgba(239,68,68,.3)' : C.cyanBorder}`,
                background: batchVideoReady.error ? 'rgba(239,68,68,.08)' : C.cyanSoft,
                color: batchVideoReady.error ? '#fca5a5' : C.cyan,
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
            cutout={autoCutout}
            onSaveToAssets={isAnonymous ? undefined : (id) => { void importDiscoveredAssets({ ids: [id] }) }}
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
            // The client-asset cards are on the "Your assets" pill, so this
            // grid brings its own drop targets (the same ones Simple Mode uses).
            dropZones={ADVANCED_DROP_ZONES}
            pageSize={12}
            onDropToSection={(id, section) => {
              ctxMoveDiscoveredAssetToSection?.(id, section)
              // Importing needs an account; visitors only rearrange the grid.
              if (!isAnonymous) void importDiscoveredAssets({ ids: [id], section })
            }}
          />
        </section>
      )}

      {!(discoveryStatus === 'reviewing' && discoveredAssets.length > 0) && (
        <div data-testid="pz-found-empty" style={{ margin: '16px 0', padding: '18px 16px', border: `1px dashed ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
          Nothing found on a website yet. Use <b style={{ color: C.text }}>Find My Brand</b> or pick a business on the{' '}
          <button type="button" onClick={() => goToSection('client', 'find')} style={{ color: C.cyan, background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>
            Client → Find business
          </button>{' '}
          tab; its logo and photos show up here for review.
        </div>
      )}
      </AdvancedSectionPanel>

      <AdvancedSectionPanel tab="assets" section="content" sections={advancedSections}>
      {/* ── CTA & BUSINESS CONTENT ────────────────────────────── */}
      <section id="pz-content" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>CTA & BUSINESS CONTENT</h2>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 18, gap: 12 }}>
          <Field autoFilled={isAuto('productService')} label="Product / Service" value={clientForm.productService} placeholder="Residential Roof Replacement" onChange={(v) => updateClientForm({ ...clientForm, productService: v })} />
          <Field autoFilled={isAuto('offer')} label="Offer" value={clientForm.offer} placeholder="Free Roof Inspection" onChange={(v) => updateClientForm({ ...clientForm, offer: v })} />
          <Field autoFilled={isAuto('ctaHeadline')} label="CTA Headline" value={clientForm.ctaHeadline} placeholder="Protect Your Home Today" onChange={(v) => updateClientForm({ ...clientForm, ctaHeadline: v })} />
          <Field autoFilled={isAuto('callToAction')} label="Button / Action" value={clientForm.callToAction} placeholder="Book Your Inspection" onChange={(v) => updateClientForm({ ...clientForm, callToAction: v })} />
          {/* The phone is edited once, in the Profile; the CTA uses it from there. */}
          <div data-testid="pz-content-phone" className="col-span-full" style={{ color: C.muted, fontSize: 11 }}>
            Phone on the CTA: <span style={{ color: C.text, fontWeight: 700 }}>{clientForm.phone || 'none yet'}</span>{' · '}
            <button
              type="button"
              onClick={() => { goToSection('client', 'profile'); focusRequirementControl('phone') }}
              style={{ color: C.cyan, background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}
            >
              {clientForm.phone ? 'Edit in Profile' : 'Add in Profile'}
            </button>
          </div>
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
            background: dragOverSection === 'ctaGraphic' ? 'rgba(217,255,0,.04)' : 'transparent',
            transition: 'border-color .15s, background .15s',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>CTA Graphic</div>
          <UploadZone primary="Upload CTA Graphic" secondary="Drag & drop or browse" collapsed={Boolean(assets.ctaGraphic)} addLabel="Replace graphic" onFiles={handleCtaUpload} onUrl={handleCtaUrl} urlLabel="Add CTA URL" urlPlaceholder="Paste image URL and press Enter" accept="image/*,video/*" />
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

      </AdvancedSectionPanel>
      </AdvancedTabPanel>

      <AdvancedTabPanel tab="recast" active={advancedTab}>
        <FullBodyRecastSection source={source} />
      </AdvancedTabPanel>

      <AdvancedTabPanel tab="create" active={advancedTab}>
      <AdvancedSectionPanel tab="create" section="overlays" sections={advancedSections}>
      {/* ── PREVIEW & ON-VIDEO OVERLAYS (guided preview, shared state) ──
          Free browser-based Remotion preview of the personalized composition
          plus the direct on-video overlay editor. Renders only for video and
          image sources, and only when the provider exposes the guided API. */}
      {(source?.mediaType === 'video' || source?.mediaType === 'image') && (
        <AdvancedOverlaySection source={source} />
      )}

      {!(source?.mediaType === 'video' || source?.mediaType === 'image') && (
        <div style={{ margin: '16px 0', color: C.muted, fontSize: 12 }}>On-video overlays are available for video and image demos.</div>
      )}
      </AdvancedSectionPanel>

      <AdvancedSectionPanel tab="create" section="prompt" sections={advancedSections}>
      {/* ── PERSONALIZE THE PROMPT ──────────────────────────── */}
      <section id="pz-prompt" data-pz-focus="prompt" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>PERSONALIZE THE PROMPT</h2>
        {mode === 'face_only' && outputType !== 'prompt' && (
          <p data-testid="pz-prompt-unused-note" style={{ margin: '6px 0 0', color: '#fcd34d', fontSize: 11 }}>
            Face only swaps the face in the demo video — the prompt isn&apos;t used for this mode.
          </p>
        )}
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
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.cyan}`, background: C.cyan, color: '#000000' }}
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
              disabled={!promptState.personalized && !promptState.edited}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
            >
              {copiedPrompt === 'failed' ? "Couldn't copy" : copiedPrompt ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={resetPrompt}
              disabled={!promptState.personalized && !promptState.edited}
              className="rounded-[9px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.border}`, background: C.panel, color: 'white' }}
            >
              Reset
            </button>
          </div>
        )}
        {promptNotice && (
          <div data-testid="pz-prompt-notice" role="status" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(251,191,36,.35)', background: 'rgba(251,191,36,.06)', color: '#fcd34d', fontSize: 11 }}>
            {promptNotice}
          </div>
        )}
      </section>

      </AdvancedSectionPanel>

      <AdvancedSectionPanel tab="create" section="output" sections={advancedSections}>
      {/* ── OUTPUT ──────────────────────────────────────────
          Generation configuration only exists for entitled users. */}
      {!isPromptOnly && !isAnonymous && (
        <section id="pz-output" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>OUTPUT &amp; ENGINE</h2>
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
                    background: active ? 'rgba(217,255,0,.045)' : C.panelSoft,
                    boxShadow: active ? 'inset 0 0 0 1px rgba(217,255,0,.25)' : 'none',
                  }}
                >
                  {active && (
                    <div className="absolute" style={{ right: 10, top: 10, width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.cyan, color: '#000000', fontSize: 11, fontWeight: 900 }}>✓</div>
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
      {/* ── HOW TO CREATE ──────────────────────────────────────
          Without AI: a free, local render of the approved overlays on the chosen video. With AI: the generation modes below. */}
      {showModes && !isAnonymous && outputType !== 'prompt' && (
        <section id="pz-creation-method" className="break-inside-avoid" style={{ padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>How should the video be made?</h2>
          <div role="group" aria-label="Creation method" className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 14, gap: 12 }}>
            {([
              { id: 'browser', label: 'Create without AI', note: 'Free · no credits. Your overlays, text and assets are rendered on the video you chose, in this browser.' },
              { id: 'ai', label: 'Generate with AI', note: 'Uses credits. Changes the people or scenes in the video (face, full body, recreate, complete).' },
            ] as const).map((o) => (
              <button
                key={o.id}
                type="button"
                data-testid={`pz-method-${o.id}`}
                aria-pressed={ctxCreationMethod === o.id}
                onClick={() => ctxSetCreationMethod(o.id)}
                className="text-left rounded-[12px] border"
                style={{ padding: 14, borderColor: ctxCreationMethod === o.id ? C.cyan : C.borderStrong, background: ctxCreationMethod === o.id ? 'rgba(217,255,0,.045)' : C.panelSoft }}
              >
                <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase' }}>{o.label}</h4>
                <p style={{ margin: 0, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{o.note}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {showModes && !isAnonymous && ctxCreationMethod === 'ai' && (
        <section id="pz-mode" data-pz-focus="mode" className="break-inside-avoid" style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>HOW SHOULD THIS BE PERSONALIZED?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 18, gap: 12 }}>
            {eligibleModes.map((m: any) => {
              const active = mode === m.key
              const isUnavailable = !active && isModeUnavailable(m.key, assets, capabilities)
              return (
                <div key={m.key} className="flex flex-col" style={{ gap: 6 }}>
                <button
                  onClick={() => setMode(m.key)}
                  disabled={isUnavailable}
                  aria-pressed={active}
                  className="text-left p-4 rounded-[12px] border relative disabled:opacity-60"
                  style={{
                    minHeight: 95,
                    padding: 16,
                    borderColor: active ? C.cyan : isUnavailable ? C.border : C.borderStrong,
                    background: active ? 'rgba(217,255,0,.045)' : isUnavailable ? C.panel : C.panelSoft,
                    boxShadow: active ? 'inset 0 0 0 1px rgba(217,255,0,.25)' : 'none',
                  }}
                >
                  {active && (
                    <div className="absolute" style={{ right: 10, top: 10, width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.cyan, color: '#000000', fontSize: 11, fontWeight: 900 }}>✓</div>
                  )}
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase' }}>{m.label}</h4>
                  <p style={{ margin: 0, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{m.description}</p>
                  {isUnavailable && (
                    <p data-testid={`pz-mode-reason-${m.key}`} style={{ margin: '6px 0 0', color: '#fcd34d', fontSize: 10, lineHeight: 1.4 }}>
                      {getModeUnavailableReason(m.key, assets)}
                    </p>
                  )}
                  {m.key === 'full_body' && ctxPreviewVideo?.kind === 'recast' && (
                    <p data-testid="pz-mode-already-recast" style={{ margin: '6px 0 0', color: C.cyan, fontSize: 9, lineHeight: 1.4 }}>
                      Already recast in the Full Body Recast tab. Pick Recreate or Complete, or recast again there.
                    </p>
                  )}
                </button>
                {isUnavailable && modeNeedsPresenter(m.key) && (
                  // Outside the (disabled) card so it stays clickable.
                  <button
                    type="button"
                    data-testid={`pz-mode-fix-${m.key}`}
                    onClick={() => { goToSection('assets', 'yours'); focusRequirementControl('presenter') }}
                    className="self-start"
                    style={{ color: C.cyan, background: 'none', border: 0, padding: 0, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Add a presenter photo →
                  </button>
                )}
                </div>
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
            background: 'linear-gradient(90deg, rgba(217,255,0,.10), rgba(217,255,0,.03))',
            boxShadow: '0 0 26px rgba(217,255,0,.08), inset 0 0 0 1px rgba(217,255,0,.08)',
          }}
        >
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(217,255,0,.15)', color: C.cyan }}>✦</div>
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
        {mode === 'full_body' && ctxPreviewSettings && ctxPreviewSettings.durationInFrames > RECAST_MAX_SECONDS * ctxPreviewSettings.fps && (
          <div data-testid="pz-full-body-too-long" style={{ color: '#f59e0b', fontSize: 11, margin: '8px 0' }}>
            Full presenter makes clips up to {RECAST_MAX_SECONDS} s, but the preview is {Math.round(ctxPreviewSettings.durationInFrames / ctxPreviewSettings.fps)} s; layers after {RECAST_MAX_SECONDS} s would be cut.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => ctxUpdatePreviewComposition?.({ durationInFrames: RECAST_MAX_SECONDS * ctxPreviewSettings.fps })}
            >
              Trim preview to {RECAST_MAX_SECONDS} s
            </button>
          </div>
        )}
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 p-4 mt-2 rounded-xl border" style={{ borderColor: C.border, background: '#101010' }}>
            {mode === 'full_body' ? (
              // The recast keeps the source clip's shape.
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Aspect Ratio</label>
                <div style={{ padding: '8px 0', color: C.muted, fontSize: 13 }}>Matches the source video</div>
              </div>
            ) : capabilities.aspectRatioOptions.length > 0 ? (
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Aspect Ratio</label>
                {/* One aspect ratio for the preview, the AI run and the final
                    file (the preview's own setting used to override this). */}
                <select
                  value={
                    (ctxPreviewSettings && capabilities.aspectRatioOptions.includes(ctxPreviewSettings.aspectRatio) ? ctxPreviewSettings.aspectRatio : '') ||
                    genOptions?.aspectRatio || source.aspectRatio || capabilities.aspectRatioOptions[0] || ''
                  }
                  onChange={(e) => {
                    updateGenOptions({ ...genOptions, aspectRatio: e.target.value })
                    if (['16:9', '9:16', '1:1', '4:5'].includes(e.target.value)) {
                      ctxUpdatePreviewComposition?.({ aspectRatio: e.target.value as '16:9' | '9:16' | '1:1' | '4:5' })
                    }
                  }}
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
                  disabled={modelSetsQuality}
                  title={modelSetsQuality ? 'Set by the face-swap / recast model' : undefined}
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
                  disabled={modelSetsQuality}
                  title={modelSetsQuality ? 'Set by the face-swap / recast model' : undefined}
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
                  onChange={(e) => {
                    const seconds = e.target.value ? parseInt(e.target.value) : undefined
                    updateGenOptions({ ...genOptions, duration: seconds })
                    // Same length for the preview and the final file.
                    if (seconds && ctxPreviewSettings) ctxUpdatePreviewComposition?.({ durationInFrames: seconds * ctxPreviewSettings.fps })
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: C.border, background: C.field, color: C.text }}
                >
                  {capabilities.durationOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}s</option>
                  ))}
                </select>
              </div>
            )}
            {modelSetsQuality && (
              <div className="col-span-2" style={{ color: C.muted, fontSize: 11 }}>
                Resolution and quality are set by the {mode === 'face_only' ? 'face-swap' : 'recast'} model.
              </div>
            )}
            {/* Only Full presenter changes the sound (its model returns a
                silent video); the other modes keep the clip's own audio. */}
            {mode === 'full_body' && (
            <div className="flex flex-col justify-end gap-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: C.muted }}>
                <input
                  type="checkbox"
                  checked={genOptions?.preserveAudio ?? true}
                  onChange={(e) => updateGenOptions({ ...genOptions, preserveAudio: e.target.checked })}
                  className="rounded"
                />
                Keep the original video&apos;s sound
              </label>
              {/* Full presenter clips come back silent; only the final-video
                  render can put the original sound back under them. */}
              {mode === 'full_body' && (
                <span data-testid="pz-preserve-audio-note" className="text-[10px]" style={{ color: C.muted }}>
                  Applies to Create final video. A quick Generate uses the AI&apos;s own sound.
                </span>
              )}
            </div>
            )}
          </div>
        )}
        {mode && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(mode) && (
          <label data-pz-focus="consent" className="flex gap-2 items-center pt-[18px] text-[11px]" style={{ color: 'rgba(255,255,255,.72)' }}>
            <input
              type="checkbox"
              checked={genOptions?.consentGiven ?? false}
              onChange={(e) => updateGenOptions({ ...genOptions, consentGiven: e.target.checked })}
            />
            I confirm that I have permission to use this person&apos;s likeness.
            {!genOptions?.consentGiven && (
              <span style={{ padding: '1px 6px', borderRadius: 999, background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.35)', color: '#fcd34d', fontSize: 9, fontWeight: 700 }}>
                Required
              </span>
            )}
          </label>
        )}
      </section>
      )}
      {(isPromptOnly || isAnonymous) && (
        <div style={{ margin: '16px 0', color: C.muted, fontSize: 12 }}>Output and engine settings are available for signed-in video and image projects.</div>
      )}
      </AdvancedSectionPanel>
      </AdvancedTabPanel>

      <AdvancedTabFooter tab={advancedTab} section={activeSection} onGo={goToSection} />
        </div>

        <div className={`order-first xl:order-last xl:h-full xl:min-h-0 ${mobilePreviewOpen ? '' : 'hidden xl:block'}`}>
          <AdvancedPreviewColumn>
            {!isAnonymous && <ReadinessChecklist requirements={requirements} onFix={fixRequirement} />}
            {/* The source demo shows here whenever the live preview cannot. */}
            {!((source?.mediaType === 'video' || source?.mediaType === 'image') && ctxPreviewSettings) && (
              <>
        {/* Source Demo */}
        <div className="panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <h2 style={{ margin: '0 0 13px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Source Demo</h2>
          <div
            className="relative"
            style={{
              aspectRatio: '16 / 10',
              borderRadius: 13,
              overflow: 'hidden',
              background: 'linear-gradient(rgba(0,0,0,.24), rgba(0,0,0,.38)), linear-gradient(135deg, #3a3a3a, #101010 70%)',
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
                {/* Nothing to play here (no media): a label, not a button. */}
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)' }}
                >
                  No preview
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 text-base font-bold">{source.title}</div>
          <div className="mt-1 text-[11px] uppercase" style={{ color: C.muted }}>
            {isFreeDiscovery ? 'Free discovery' : source.mediaType?.toUpperCase()} {source.aspectRatio ? `• ${source.aspectRatio}` : ''}
          </div>
        </div>

              </>
            )}
            {(source?.mediaType === 'video' || source?.mediaType === 'image') && (
              <AdvancedLivePreview source={source} />
            )}
       {/* ── WHAT SMARTVIDEO WILL USE ─────────────────────────────── */}
       <section data-testid="pz-will-use" style={{ padding: '14px', border: `1px solid ${C.border}`, borderRadius: 14, background: C.panel }}>
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
               style={{ background: 'rgba(217,255,0,.06)', border: `1px solid rgba(217,255,0,.18)` }}
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

          </AdvancedPreviewColumn>
        </div>
      </div>
    </div>
  )
}

// ── Advanced Editing: preview & on-video overlays ────────────────────────────
// A section inside the existing ConfigurationView that mounts the same free
// Remotion preview and the same on-video overlay editor Simple Mode uses, over
// the same provider state. It renders nothing when the guided preview API is
// unavailable, so partially-wired contexts keep the previous behavior.

/** Builds the preview props shared by the live preview and the overlay editor. */
function useAdvancedPreviewInput(source: PersonalizationSource | null) {
  const ctx = useDemoPersonalize()
  const guidedAvailable =
    typeof (ctx as { setGuidedStep?: unknown }).setGuidedStep === 'function' &&
    Boolean((ctx as { previewSettings?: unknown }).previewSettings)
  if (!guidedAvailable || !ctx.previewSettings) return null
  return buildPreviewInput({
    source,
    previewSettings: ctx.previewSettings,
    previewVideo: ctx.previewVideo ?? null,
    clientForm: ctx.clientForm || {},
    assets: ctx.assets,
  })
}

/**
 * The always-visible before/after preview in the workspace's sticky column.
 * Opens in single-view "Switch" mode (the column is narrow); Compare is one
 * click away.
 */
function AdvancedLivePreview({ source }: { source: PersonalizationSource | null }) {
  const inputProps = useAdvancedPreviewInput(source)
  const { previewVideo, preRecastVideo } = useDemoPersonalize()
  if (!inputProps) return null
  // After a Full Body Recast, BEFORE shows the original performer and AFTER
  // the recast person, so the swap itself is visible.
  const beforeVideoUrl = previewVideo?.kind === 'recast'
    ? preRecastVideo?.url || source?.sourceMedia || null
    : null
  return (
    <section data-testid="pz-live-preview" style={{ padding: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.panel }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 12, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>
        Live Preview
      </h2>
      {/* Opens on the personalized result; "Before" is one click away. */}
      <BeforeAfterPreview inputProps={inputProps} defaultMode="toggle" initialSide="after" beforeVideoUrl={beforeVideoUrl} />
    </section>
  )
}

function AdvancedOverlaySection({ source }: { source: PersonalizationSource | null }) {
  const inputProps = useAdvancedPreviewInput(source)
  const { outputType } = useDemoPersonalize()
  if (!inputProps) return null
  // Say where these layers end up for the chosen output.
  const layersInVideo = outputType === 'video' || outputType === 'everything'

  return (
    <section
      id="pz-onvideo-overlays"
      className="break-inside-avoid"
      style={{ padding: '20px 0', scrollMarginTop: 64, borderBottom: `1px solid ${C.border}` }}
    >
      <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>
        On-Video Overlays
      </h2>
      <p className="mt-1.5 max-w-[900px] text-[12px] leading-[1.55]" style={{ color: C.muted }}>
        Drag, resize and edit every layer on the video itself — the live preview beside this updates as you go.
        Nothing here is generated or charged.
      </p>
      <p
        data-testid="pz-overlay-output-note"
        className="mt-2 max-w-[900px] text-[11px] font-bold"
        style={{ color: layersInVideo ? C.green : '#fcd34d' }}
      >
        {layersInVideo
          ? '✓ These layers are burned into your final video, exactly as previewed.'
          : 'Layers apply to video outputs only — choose Video or Everything under Output & engine to include them.'}
      </p>
      <div style={{ marginTop: 16 }}>
        <OverlayEditor inputProps={inputProps} />
      </div>
    </section>
  )
}
