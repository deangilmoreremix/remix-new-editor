'use client'

/**
 * The discovered-asset review grid, shared by Advanced Editing and the guided
 * (Simple mode) "Find your business" step, so both show every asset with the
 * same controls: select, remove / restore, change category, Edit with AI,
 * revert an edit, drag into a client-asset section, and (when `cutout` is
 * passed) on-device background removal with a before/after viewer.
 */

import { useEffect, useState, type DragEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import type { AssignedSection, DiscoveredAsset, DiscoveredAssetCategory } from './types'
import { isImageEditSupported } from './image-editor/imageEditSupport'
import { C } from './guided/tokens'
import { BeforeAfterSlider, CHECKERBOARD } from './BeforeAfterSlider'
import type { AutoCutoutControls } from './backgroundRemoval/useAutoCutout'

const EDIT_WITH_AI = 'Edit with AI'
const REMOVE_BG = 'Remove BG'

/** What a tile / the viewer shows: the cutout by default, the original on request. */
export function discoveredAssetDisplayUrl(a: DiscoveredAsset): string {
  return a.showOriginal ? a.originalPreviewUrl || a.previewUrl : a.editedDataUrl || a.previewUrl
}

/** True once BG0 produced a transparent cutout for this asset. */
export function hasBgCutout(a: DiscoveredAsset): boolean {
  return Boolean(a.editedDataUrl) && a.editMetadata?.engine === 'bg0' && Boolean(a.hasTransparency)
}

function showsTransparency(a: DiscoveredAsset): boolean {
  return Boolean(a.hasTransparency) && !a.showOriginal
}

export const DISCOVERED_ASSET_CATEGORIES: readonly DiscoveredAssetCategory[] = [
  'person',
  'logo',
  'product',
  'service',
  'completed_work',
  'storefront',
  'office',
  'branded_vehicle',
  'team',
  'brand',
  'irrelevant',
]

/** The drag payload type a drop zone in this grid accepts. */
const DRAG_MIME = 'application/x-discovered-asset-id'

export function DiscoveredAssetThumb({
  asset,
  onToggle,
  onRemove,
  onCategoryChange,
  onEdit,
  onRevert,
  onRemoveFromSection,
  cutout,
  draggable = false,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  asset: DiscoveredAsset
  onToggle: () => void
  onRemove: () => void
  onCategoryChange: (cat: DiscoveredAssetCategory) => void
  onEdit?: () => void
  onRevert?: () => void
  onRemoveFromSection?: () => void
  /** On-device background removal; omitted where it is not offered. */
  cutout?: AutoCutoutControls
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
  /** Clicking the card opens it full screen. */
  onOpen?: () => void
}) {
  const canEdit = Boolean(onEdit) && isImageEditSupported(asset)
  const bg = asset.bgRemoval
  const bgBusy = bg?.status === 'running' || bg?.status === 'queued'
  const cutDone = hasBgCutout(asset)
  const handleOpen = () => {
    if (onOpen) onOpen()
    else onToggle()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${asset.category.replace(/_/g, ' ')} asset full screen`}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleOpen()
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative w-[82px] min-h-[86px] rounded-[9px] border overflow-hidden"
      style={{
        borderColor: asset.selected ? C.cyanBorder : asset.rejected ? 'rgba(239,68,68,.4)' : C.border,
        background: asset.rejected ? 'rgba(239,68,68,.08)' : showsTransparency(asset) ? CHECKERBOARD : 'linear-gradient(145deg, #3f3f46, #141414)',
        opacity: asset.rejected ? 0.5 : 1,
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      {discoveredAssetDisplayUrl(asset) ? (
        // The image itself is not draggable: dragging it would start a native
        // image drag instead of the card's asset drag.
        <img
          src={discoveredAssetDisplayUrl(asset)}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full ${showsTransparency(asset) ? 'object-contain' : 'object-cover'}`}
        />
      ) : null}
      {bgBusy && (
        <div
          className="pointer-events-none absolute inset-0 z-[15] flex flex-col items-center justify-center gap-1"
          style={{ background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 8, fontWeight: 800, textTransform: 'uppercase' }}
          role="status"
          aria-label={bg?.status === 'running' ? 'Removing background' : 'Waiting to remove background'}
        >
          {bg?.status === 'running' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>{bg.progress ? `${Math.round(bg.progress * 100)}%` : 'Cutting out'}</span>
            </>
          ) : (
            <span>Queued</span>
          )}
        </div>
      )}
      {cutout && !asset.rejected && !bgBusy && (
        cutDone ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cutout.toggleOriginal(asset.id) }}
            className="absolute bottom-[19px] left-1 right-1 z-20 truncate rounded-md py-0.5 text-center text-[7px] font-black uppercase leading-none"
            style={{ background: 'rgba(0,0,0,.75)', color: '#fff', border: '1px solid rgba(255,255,255,.35)' }}
            aria-label={asset.showOriginal ? 'Show cutout' : 'Show original'}
            title={asset.showOriginal ? 'Show the background-removed version' : 'Show the original image'}
          >
            {asset.showOriginal ? 'Cutout' : 'Original'}
          </button>
        ) : bg?.status === 'error' ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cutout.retry(asset.id) }}
            className="absolute bottom-[19px] left-1 right-1 z-20 truncate rounded-md py-0.5 text-center text-[7px] font-black uppercase leading-none"
            style={{ background: 'rgba(239,68,68,.9)', color: '#fff' }}
            aria-label="Retry background removal"
            title={bg.message}
          >
            Retry BG
          </button>
        ) : bg?.status === 'skipped' ? (
          <div
            className="pointer-events-none absolute bottom-[19px] left-1 right-1 z-20 truncate rounded-md py-0.5 text-center text-[7px] font-black uppercase leading-none"
            style={{ background: 'rgba(0,0,0,.65)', color: '#d4d4d8' }}
            title={bg.message}
          >
            {bg.message || 'No change'}
          </div>
        ) : !asset.hasTransparency ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cutout.requestRemoval([asset.id]) }}
            className="absolute bottom-[19px] left-1 right-1 z-20 truncate rounded-md py-0.5 text-center text-[7px] font-black uppercase leading-none"
            style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
            aria-label="Remove background"
          >
            {REMOVE_BG}
          </button>
        ) : null
      )}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit?.() }}
          className="absolute right-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(217,255,0,.92)', color: '#000000' }}
          aria-label="Edit discovered image"
        >
          {EDIT_WITH_AI}
        </button>
      )}
      {asset.edited && onRevert && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRevert() }}
          className="absolute left-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(255,255,255,.9)', color: '#000000' }}
          aria-label="Revert to original"
        >
          Revert
        </button>
      )}
      {(asset.videoReady || (asset.edited && !onRevert)) && !cutDone && (
        <div className="pointer-events-none absolute left-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase" style={{ background: 'rgba(34,197,94,.9)', color: '#fff' }}>
          {asset.videoReady ? 'Video Ready' : 'Edited'}
        </div>
      )}
      {asset.visionAnalysis && (
        <div
          className="absolute left-1 top-[42px] z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(196,230,0,.9)', color: '#fff' }}
          title={asset.visionAnalysis.summary}
        >
          Vision {Math.round(asset.visionAnalysis.confidence)}%
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent 60%)' }} />
      {/* Select checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="absolute top-1 left-1 z-10 rounded-full w-4 h-4 flex items-center justify-center"
        style={{
          border: `2px solid ${asset.selected ? C.cyan : 'rgba(255,255,255,.5)'}`,
          background: asset.selected ? C.cyan : 'transparent',
        }}
        aria-label={asset.selected ? 'Deselect' : 'Select'}
      >
        {asset.selected && <span style={{ fontSize: 8, color: '#000000', fontWeight: 900 }}>✓</span>}
      </button>
      {asset.autoAssigned && (
        <div
          className="absolute top-1 left-6 z-10 rounded-full px-1.5 py-0.5"
          style={{ background: 'rgba(16,185,129,.9)', color: 'white', fontSize: 7, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}
        >
          AUTO
        </div>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute top-1 right-1 z-10 rounded-full p-0.5"
        style={{ background: 'rgba(239,68,68,.85)' }}
        aria-label="Remove"
      >
        <X size={8} className="text-white" />
      </button>
      {asset.assignedSection && onRemoveFromSection && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoveFromSection() }}
          className="absolute bottom-8 right-1 z-10 rounded-full p-0.5"
          style={{ background: 'rgba(255,255,255,.2)' }}
          aria-label="Remove from section"
          title="Remove from section"
        >
          <span style={{ fontSize: 7, color: 'white', fontWeight: 800 }}>✕</span>
        </button>
      )}
      <div
        className="absolute bottom-8 left-1 right-1 z-10 rounded px-1 py-0.5 text-center pointer-events-none"
        style={{ background: 'rgba(0,0,0,.6)', color: 'white', fontSize: 7, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}
      >
        {/* Browser-phase assets carry no sourceType. */}
        {(asset.sourceType || 'website').replace('_', ' ')}
      </div>
      <select
        value={asset.category}
        onChange={(e) => onCategoryChange(e.target.value as DiscoveredAssetCategory)}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-1 left-1 right-1 z-10 text-[7px] font-bold rounded px-0.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-black"
        style={{ background: 'rgba(0,0,0,.6)', color: 'white', border: '1px solid rgba(255,255,255,.2)', fontSize: 7 }}
        aria-label="Change category"
      >
        {DISCOVERED_ASSET_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * Full-screen viewer for the discovered assets: one asset at a time, with
 * previous / next arrows (and the arrow keys) to step through all of them.
 */
export function DiscoveredAssetLightbox({
  assets,
  index,
  onIndexChange,
  onClose,
  onToggle,
  onRemove,
  onEdit,
  onRevert,
  cutout,
  onSaveToAssets,
}: {
  assets: DiscoveredAsset[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onEdit?: (asset: DiscoveredAsset) => void
  onRevert?: (id: string) => void
  cutout?: AutoCutoutControls
  /** Save this asset to the project's assets (imports it). */
  onSaveToAssets?: (id: string) => void
}) {
  const [compare, setCompare] = useState(false)
  const asset = assets[index]
  const count = assets.length
  const go = (delta: number) => onIndexChange((index + delta + count) % count)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
    }
    // Capture phase, so Escape closes the viewer before it can close the modal.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!asset) return null
  const src = discoveredAssetDisplayUrl(asset)
  const canEdit = Boolean(onEdit) && isImageEditSupported(asset)
  const cutDone = hasBgCutout(asset)
  const bgBusy = asset.bgRemoval?.status === 'running' || asset.bgRemoval?.status === 'queued'
  const showCompare = cutDone && compare && Boolean(asset.editedDataUrl)
  const arrowStyle = {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 48,
    height: 48,
    borderRadius: 999,
    border: `1px solid ${C.borderStrong}`,
    background: 'rgba(0,0,0,.55)',
    color: 'white',
    fontSize: 22,
    cursor: 'pointer',
  }
  const actionStyle = {
    minHeight: 34,
    padding: '0 14px',
    borderRadius: 10,
    border: `1px solid ${C.borderStrong}`,
    background: C.panel,
    color: 'white',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Discovered asset viewer"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,6,9,.94)', display: 'flex', flexDirection: 'column' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', color: C.text }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'capitalize' }}>{asset.category.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{index + 1} / {count}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.sourceUrl || asset.previewUrl}
        </span>
        <button type="button" onClick={onClose} aria-label="Close viewer" style={{ ...actionStyle, padding: '0 10px' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 72px' }}>
        {showCompare ? (
          <BeforeAfterSlider
            beforeUrl={asset.originalPreviewUrl || asset.previewUrl}
            afterUrl={asset.editedDataUrl as string}
            alt={`${asset.category} asset ${index + 1}`}
          />
        ) : src ? (
          <img
            src={src}
            alt={`${asset.category} asset ${index + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
              background: showsTransparency(asset) ? CHECKERBOARD : undefined,
            }}
          />
        ) : null}
        {bgBusy && (
          <div
            role="status"
            style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.75)', color: 'white', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 800 }}
          >
            <Loader2 size={14} className="animate-spin" />
            {asset.bgRemoval?.status === 'running'
              ? `Removing background${asset.bgRemoval.progress ? ` ${Math.round(asset.bgRemoval.progress * 100)}%` : '…'}`
              : 'Queued for background removal'}
          </div>
        )}
        {count > 1 && (
          <>
            <button type="button" aria-label="Previous asset" onClick={(e) => { e.stopPropagation(); go(-1) }} style={{ ...arrowStyle, left: 14 }}>‹</button>
            <button type="button" aria-label="Next asset" onClick={(e) => { e.stopPropagation(); go(1) }} style={{ ...arrowStyle, right: 14 }}>›</button>
          </>
        )}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, flexWrap: 'wrap' }}
      >
        <button
          type="button"
          onClick={() => onToggle(asset.id)}
          style={{ ...actionStyle, borderColor: asset.selected ? C.cyanBorder : C.borderStrong, color: asset.selected ? C.cyan : 'white' }}
        >
          {asset.selected ? 'Selected ✓' : 'Select'}
        </button>
        {canEdit && (
          <button type="button" onClick={() => { onClose(); onEdit?.(asset) }} style={{ ...actionStyle, background: C.cyan, color: '#000000', borderColor: C.cyan }}>
            {EDIT_WITH_AI}
          </button>
        )}
        {cutout && !cutDone && !bgBusy && !asset.hasTransparency && (
          <button type="button" onClick={() => cutout.requestRemoval([asset.id])} style={actionStyle}>
            {asset.bgRemoval?.status === 'error' ? 'Retry Background Removal' : 'Remove Background'}
          </button>
        )}
        {cutout && cutDone && (
          <>
            <button
              type="button"
              onClick={() => { setCompare(false); cutout.toggleOriginal(asset.id) }}
              style={actionStyle}
            >
              {asset.showOriginal ? 'Show Cutout' : 'Show Original'}
            </button>
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((v) => !v)}
              style={{ ...actionStyle, borderColor: compare ? C.cyanBorder : C.borderStrong, color: compare ? C.cyan : 'white' }}
            >
              Before / After
            </button>
            <a
              href={asset.editedDataUrl}
              download={`bg-removed-${asset.id}.png`}
              style={{ ...actionStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              Download Transparent PNG
            </a>
            {onRevert && (
              <button type="button" onClick={() => { setCompare(false); onRevert(asset.id) }} style={actionStyle}>
                Restore Original
              </button>
            )}
          </>
        )}
        {onSaveToAssets && (
          <button
            type="button"
            disabled={bgBusy}
            onClick={() => { onSaveToAssets(asset.id); if (count <= 1) onClose() }}
            style={{ ...actionStyle, opacity: bgBusy ? 0.5 : 1, cursor: bgBusy ? 'not-allowed' : 'pointer' }}
          >
            Save to Assets
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onRemove(asset.id)
            // The removed asset leaves the list; stay on the same position.
            if (count <= 1) onClose()
            else if (index >= count - 1) onIndexChange(index - 1)
          }}
          style={{ ...actionStyle, color: C.danger, borderColor: 'rgba(239,68,68,.45)' }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

/**
 * Controls for on-device background removal above the grid: the auto switch,
 * progress, the first-use model-download notice and "Remove Background From
 * Selected". Everything else in the grid works the same with or without it.
 */
export function BackgroundRemovalBar({ assets, cutout }: { assets: DiscoveredAsset[]; cutout: AutoCutoutControls }) {
  const { stats } = cutout
  const selectedToCut = assets.filter(
    (a) => a.selected && !a.rejected && !a.hasTransparency && a.bgRemoval?.status !== 'running' && a.bgRemoval?.status !== 'queued',
  )
  const barButton = {
    minHeight: 26,
    padding: '0 10px',
    borderRadius: 8,
    border: `1px solid ${C.borderStrong}`,
    background: C.panel,
    color: 'white',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  }
  return (
    <div data-testid="background-removal-bar" style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          role="switch"
          aria-checked={cutout.autoEnabled}
          onClick={() => cutout.setAutoEnabled(!cutout.autoEnabled)}
          style={{ ...barButton, borderColor: cutout.autoEnabled ? C.cyanBorder : C.borderStrong, color: cutout.autoEnabled ? C.cyan : 'white' }}
        >
          Auto-remove backgrounds: {cutout.autoEnabled ? 'On' : 'Off'}
        </button>
        {stats.active && !cutout.needsConsent && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.cyan }}>
            <Loader2 size={12} className="animate-spin" />
            Removing backgrounds {Math.min(stats.finished, stats.total)}/{stats.total}…
          </span>
        )}
        {!stats.active && stats.total > 0 && stats.finished === stats.total && stats.failed === 0 && (
          <span style={{ fontSize: 11, color: C.green }}>Backgrounds removed — switch an image back to Original anytime.</span>
        )}
        {stats.failed > 0 && !stats.active && (
          <span style={{ fontSize: 11, color: C.danger }}>{stats.failed} could not be processed.</span>
        )}
        {stats.active && (
          <button type="button" onClick={cutout.cancelAll} style={barButton}>Cancel</button>
        )}
        {selectedToCut.length > 0 && (
          <button type="button" onClick={() => cutout.requestRemoval(selectedToCut.map((a) => a.id))} style={barButton}>
            Remove Background From Selected ({selectedToCut.length})
          </button>
        )}
      </div>
      {cutout.halted && (
        <div role="alert" style={{ fontSize: 11, color: C.danger }}>
          The background-removal model could not be loaded. Check your connection, reload the page and try again.
        </div>
      )}
      {cutout.needsConsent && (
        <div
          role="dialog"
          aria-label="Download background-removal model"
          style={{ border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, borderRadius: 10, padding: 10, fontSize: 11, color: C.text }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Remove backgrounds on this device?</div>
          <div style={{ color: C.muted, lineHeight: 1.5 }}>
            This downloads a one-time ~{cutout.modelMB} MB model (kept on your device afterwards). Your images are processed
            locally and are not uploaded. On mobile data this may use a lot of your plan.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={cutout.grantConsent} style={{ ...barButton, background: C.cyan, color: '#000000', borderColor: C.cyan }}>
              Download &amp; remove
            </button>
            <button type="button" onClick={cutout.declineConsent} style={barButton}>Not now</button>
          </div>
        </div>
      )}
    </div>
  )
}

export interface DiscoveredAssetDropZone {
  section: AssignedSection
  label: string
}

export function DiscoveredAssetGrid({
  assets,
  onToggle,
  onRemove,
  onCategoryChange,
  onEdit,
  onRevert,
  onRemoveFromSection,
  onRestoreAll,
  onDragStart,
  onDragEnd,
  dropZones,
  onDropToSection,
  cutout,
  onSaveToAssets,
}: {
  assets: DiscoveredAsset[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onCategoryChange: (id: string, category: DiscoveredAssetCategory) => void
  /** Omitted when AI editing is not available (anonymous sessions). */
  onEdit?: (asset: DiscoveredAsset) => void
  onRevert?: (id: string) => void
  onRemoveFromSection?: (id: string) => void
  onRestoreAll?: () => void
  /** A caller with its own drop targets (Advanced Editing) supplies its drag handlers. */
  onDragStart?: (asset: DiscoveredAsset, e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
  /** Drop targets rendered under the grid; used where the page has none of its own. */
  dropZones?: DiscoveredAssetDropZone[]
  onDropToSection?: (id: string, section: AssignedSection) => void
  /** On-device background removal (auto queue + manual controls). Omitted = feature off. */
  cutout?: AutoCutoutControls
  /** Save one asset to the project's assets from the viewer. */
  onSaveToAssets?: (id: string) => void
}) {
  const [dragOverZone, setDragOverZone] = useState<AssignedSection | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const hasZones = Boolean(dropZones && dropZones.length > 0 && onDropToSection)
  const removedCount = assets.filter((a) => a.rejected).length
  // The viewer steps through the assets in the order the grid shows them.
  const visible = DISCOVERED_ASSET_CATEGORIES.flatMap((cat) => assets.filter((a) => a.category === cat && !a.rejected))

  const startDrag = (asset: DiscoveredAsset, e: DragEvent) => {
    // The grid's own zones read the asset id; a caller's handler adds its payload.
    e.dataTransfer.setData(DRAG_MIME, asset.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(asset, e)
  }

  return (
    <div>
      {viewerIndex !== null && visible.length > 0 && (
        <DiscoveredAssetLightbox
          assets={visible}
          index={Math.min(viewerIndex, visible.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onToggle={onToggle}
          onRemove={onRemove}
          onEdit={onEdit}
          onRevert={onRevert}
          cutout={cutout}
          onSaveToAssets={onSaveToAssets}
        />
      )}
      {cutout && assets.length > 0 && <BackgroundRemovalBar assets={assets} cutout={cutout} />}
      {DISCOVERED_ASSET_CATEGORIES.map((cat) => {
        const items = assets.filter((a) => a.category === cat && !a.rejected)
        if (items.length === 0) return null
        const catLabel = cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        return (
          <div key={cat} style={{ marginBottom: 16 }} data-category={cat}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
              {catLabel} ({items.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((asset) => (
                <DiscoveredAssetThumb
                  key={asset.id}
                  asset={asset}
                  onToggle={() => onToggle(asset.id)}
                  onRemove={() => onRemove(asset.id)}
                  onCategoryChange={(newCat) => onCategoryChange(asset.id, newCat)}
                  onEdit={onEdit ? () => onEdit(asset) : undefined}
                  onRevert={onRevert ? () => onRevert(asset.id) : undefined}
                  onRemoveFromSection={onRemoveFromSection ? () => onRemoveFromSection(asset.id) : undefined}
                  cutout={cutout}
                  draggable={Boolean(onDragStart) || hasZones}
                  onDragStart={(e) => startDrag(asset, e)}
                  onDragEnd={(e) => {
                    setDragOverZone(null)
                    onDragEnd?.(e)
                  }}
                  onOpen={() => setViewerIndex(visible.findIndex((a) => a.id === asset.id))}
                />
              ))}
            </div>
          </div>
        )
      })}

      {removedCount > 0 && onRestoreAll && (
        <div style={{ marginTop: 12, fontSize: 10, color: C.muted2 }}>
          {removedCount} removed —{' '}
          <button
            type="button"
            onClick={onRestoreAll}
            style={{ color: C.cyan, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10 }}
          >
            Restore all removed
          </button>
        </div>
      )}

      {hasZones && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
            Drag an asset onto a section to add it
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 8 }}>
            {dropZones!.map((zone) => (
              <div
                key={zone.section}
                data-drop-section={zone.section}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverZone(zone.section)
                }}
                onDragLeave={() => setDragOverZone((current) => (current === zone.section ? null : current))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverZone(null)
                  const id = e.dataTransfer.getData(DRAG_MIME)
                  if (id) onDropToSection!(id, zone.section)
                }}
                style={{
                  minHeight: 54,
                  borderRadius: 10,
                  border: `1px dashed ${dragOverZone === zone.section ? C.cyan : C.borderStrong}`,
                  background: dragOverZone === zone.section ? C.cyanSoft : 'transparent',
                  color: dragOverZone === zone.section ? C.cyan : C.muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {zone.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
