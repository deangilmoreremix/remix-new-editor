'use client'

/**
 * The discovered-asset review grid, shared by Advanced Editing and the guided
 * (Simple mode) "Find your business" step, so both show every asset with the
 * same controls: select, remove / restore, change category, Edit with AI,
 * revert an edit, and drag into a client-asset section.
 */

import { useEffect, useState, type DragEvent } from 'react'
import { X } from 'lucide-react'
import type { AssignedSection, DiscoveredAsset, DiscoveredAssetCategory } from './types'
import { isImageEditSupported } from './image-editor/imageEditSupport'
import { C } from './guided/tokens'

const EDIT_WITH_AI = 'Edit with AI'

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
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
  /** Clicking the card opens it full screen. */
  onOpen?: () => void
}) {
  const canEdit = Boolean(onEdit) && isImageEditSupported(asset)
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
        borderColor: asset.selected ? C.cyanBorder : asset.rejected ? 'rgba(239,91,103,.4)' : C.border,
        background: asset.rejected ? 'rgba(239,91,103,.08)' : 'linear-gradient(145deg, #3b4652, #151a20)',
        opacity: asset.rejected ? 0.5 : 1,
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      {(asset.editedDataUrl || asset.previewUrl) ? (
        // The image itself is not draggable: dragging it would start a native
        // image drag instead of the card's asset drag.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.editedDataUrl || asset.previewUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit?.() }}
          className="absolute right-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(41,211,242,.92)', color: '#041014' }}
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
          style={{ background: 'rgba(255,255,255,.9)', color: '#041014' }}
          aria-label="Revert to original"
        >
          Revert
        </button>
      )}
      {(asset.videoReady || (asset.edited && !onRevert)) && (
        <div className="pointer-events-none absolute left-1 top-6 z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase" style={{ background: 'rgba(40,201,139,.9)', color: '#fff' }}>
          {asset.videoReady ? 'Video Ready' : 'Edited'}
        </div>
      )}
      {asset.visionAnalysis && (
        <div
          className="absolute left-1 top-[42px] z-20 rounded-md px-1.5 py-1 text-[7px] font-black uppercase"
          style={{ background: 'rgba(168,85,247,.9)', color: '#fff' }}
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
        {asset.selected && <span style={{ fontSize: 8, color: '#041014', fontWeight: 900 }}>✓</span>}
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
        style={{ background: 'rgba(239,91,103,.85)' }}
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
        className="absolute bottom-1 left-1 right-1 z-10 text-[7px] font-bold rounded px-0.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
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
}: {
  assets: DiscoveredAsset[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onEdit?: (asset: DiscoveredAsset) => void
}) {
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
  const src = asset.editedDataUrl || asset.previewUrl
  const canEdit = Boolean(onEdit) && isImageEditSupported(asset)
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
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${asset.category} asset ${index + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        ) : null}
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
          <button type="button" onClick={() => { onClose(); onEdit?.(asset) }} style={{ ...actionStyle, background: C.cyan, color: '#041014', borderColor: C.cyan }}>
            {EDIT_WITH_AI}
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
          style={{ ...actionStyle, color: C.danger, borderColor: 'rgba(239,91,103,.45)' }}
        >
          Remove
        </button>
      </div>
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
        />
      )}
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
