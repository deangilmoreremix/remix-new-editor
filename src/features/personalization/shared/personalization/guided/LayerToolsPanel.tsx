'use client'

/**
 * Stage 1 tools that sit beside the overlay stage: rotate, duplicate, stack
 * order, group/ungroup, align, snap-to-grid, presenter (source footage)
 * reposition/zoom, user-defined fields and reusable layouts.
 *
 * Every control calls a pure function from `layerOps` / `savedLayouts` and
 * applies it through `edit` (the provider's `editPreviewSettings`), so each
 * action is one undo step, is autosaved with the project and is rendered by the
 * same Remotion composition as the preview and the export.
 */
import { useState } from 'react'
import { isValidCustomFieldKey, normalizeSourceTransform } from '../preview/layerTransform'
import type { PersonalizationPreviewSettings, PreviewLayer } from '../preview/types'
import {
  alignLayers,
  duplicateLayer,
  groupLayers,
  reorderLayer,
  setLayerRotation,
  ungroupLayers,
  type AlignMode,
  type ReorderMode,
} from './layerOps'
import { applyLayout, snapshotLayout, type SavedLayout } from './savedLayouts'
import { useSavedLayouts } from './useSavedLayouts'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export type EditSettings = (
  edit: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings,
) => void

export interface LayerToolsPanelProps {
  settings: PersonalizationPreviewSettings
  /** The primary selected layer (undefined when nothing is selected). */
  selected: PreviewLayer | undefined
  /** Every selected layer id, primary first. */
  selectionIds: string[]
  compW: number
  compH: number
  edit: EditSettings
  onSelect: (id: string) => void
  snapGrid: boolean
  onSnapGridChange: (on: boolean) => void
  /** Test seams: the network and storage the saved-layouts list uses. Default to the real ones. */
  layoutFetch?: typeof fetch
  layoutStorage?: Storage | null
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const disabledStyle = { opacity: 0.45, cursor: 'not-allowed' } as const
const btn = (enabled: boolean) => (enabled ? small : { ...small, ...disabledStyle })

const ALIGN_BUTTONS: { mode: AlignMode; label: string }[] = [
  { mode: 'left', label: 'Left' },
  { mode: 'hcenter', label: 'Centre' },
  { mode: 'right', label: 'Right' },
  { mode: 'top', label: 'Top' },
  { mode: 'vcenter', label: 'Middle' },
  { mode: 'bottom', label: 'Bottom' },
]

const ORDER_BUTTONS: { mode: ReorderMode; label: string }[] = [
  { mode: 'back', label: 'To back' },
  { mode: 'backward', label: 'Back' },
  { mode: 'forward', label: 'Forward' },
  { mode: 'front', label: 'To front' },
]

function newLayoutId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `layout-${crypto.randomUUID()}`
  } catch { /* fall through */ }
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function LayerToolsPanel({
  settings, selected, selectionIds, compW, compH, edit, onSelect, snapGrid, onSnapGridChange, layoutFetch, layoutStorage,
}: LayerToolsPanelProps) {
  const { layouts, status: syncStatus, statusMessage, note: syncNote, setNote: setLayoutNote, save: saveSynced, remove: removeSynced, upload: uploadLayout } =
    useSavedLayouts({ fetchFn: layoutFetch, storage: layoutStorage })
  const [layoutName, setLayoutName] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [fieldError, setFieldError] = useState('')

  const hasLayer = !!selected && selected.kind !== 'endCard'
  const isDesign = selected?.kind === 'design'
  const locked = selected?.locked === true
  const canRotate = hasLayer && !isDesign && !locked
  const canDuplicate = hasLayer && !isDesign
  const canAlign = hasLayer && !isDesign
  const selectedGroupable = settings.layers.filter((l) => selectionIds.includes(l.id) && l.kind !== 'design')
  const canGroup = selectedGroupable.length >= 2

  const setRotation = (value: number) => {
    if (!selected) return
    edit((prev) => setLayerRotation(prev, selected.id, value))
  }

  const setSource = (patch: Partial<{ x: number; y: number; zoom: number }>) => {
    edit((prev) => {
      const cur = prev.sourceTransform ?? { x: 0.5, y: 0.5, zoom: 1 }
      const next = normalizeSourceTransform({ ...cur, ...patch })
      const { sourceTransform: _old, ...rest } = prev
      return (next ? { ...rest, sourceTransform: next } : rest) as PersonalizationPreviewSettings
    })
  }
  const source = settings.sourceTransform ?? { x: 0.5, y: 0.5, zoom: 1 }

  const addField = () => {
    const key = fieldKey.trim()
    if (!isValidCustomFieldKey(key)) {
      setFieldError('Use a name that starts with a letter and has only letters, numbers or _ (max 40).')
      return
    }
    if (settings.customFields && key in settings.customFields) {
      setFieldError(`"${key}" already exists — edit its value below.`)
      return
    }
    if (Object.keys(settings.customFields ?? {}).length >= 20) {
      setFieldError('You can add up to 20 custom fields.')
      return
    }
    setFieldError('')
    edit((prev) => ({ ...prev, customFields: { ...(prev.customFields ?? {}), [key]: fieldValue.slice(0, 500) } }))
    setFieldKey('')
    setFieldValue('')
  }
  const setFieldValueFor = (key: string, value: string) =>
    edit((prev) => ({ ...prev, customFields: { ...(prev.customFields ?? {}), [key]: value.slice(0, 500) } }))
  const removeField = (key: string) =>
    edit((prev) => {
      const { [key]: _gone, ...rest } = prev.customFields ?? {}
      const { customFields: _old, ...base } = prev
      return (Object.keys(rest).length ? { ...base, customFields: rest } : base) as PersonalizationPreviewSettings
    })

  const saveLayout = () => {
    const snap = snapshotLayout(settings, layoutName, newLayoutId(), Date.now())
    if (!snap) {
      setLayoutNote('Give the layout a name first.')
      return
    }
    setLayoutNote('')
    setLayoutName('')
    void saveSynced(snap)
  }
  const applySaved = (layout: SavedLayout) => {
    const { matched } = applyLayout(settings, layout)
    edit((prev) => applyLayout(prev, layout).settings)
    const sameShape = layout.aspectRatio === settings.aspectRatio
    setLayoutNote(
      matched === 0
        ? `“${layout.name}” matched none of this project's layers.`
        : `Applied “${layout.name}” to ${matched} layer${matched === 1 ? '' : 's'}${sameShape ? '' : ` (saved for ${layout.aspectRatio}; check the result at ${settings.aspectRatio})`}.`,
    )
  }
  const deleteSaved = (layout: Parameters<typeof removeSynced>[0]) => {
    setLayoutNote('')
    void removeSynced(layout)
  }

  const row = { display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }

  return (
    <div data-testid="layer-tools" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      {hasLayer && (
        <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Arrange</div>

          <div>
            <label style={labelStyle} htmlFor="layer-rotation">Rotate</label>
            <div style={row}>
              <input
                id="layer-rotation" type="range" aria-label="Rotation" min={-180} max={180} step={1}
                disabled={!canRotate} value={selected?.rotation ?? 0}
                onChange={(e) => setRotation(Number(e.target.value))}
                style={{ flex: 1, minWidth: 120, accentColor: C.cyan }}
              />
              <input
                type="number" aria-label="Rotation degrees" min={-180} max={180} step={1} disabled={!canRotate}
                value={selected?.rotation ?? 0}
                onChange={(e) => setRotation(Number(e.target.value))}
                style={{ ...inputStyle, width: 64, minHeight: 28, padding: '0 6px' }}
              />
              <button type="button" aria-label="Reset rotation" disabled={!canRotate || !selected?.rotation} onClick={() => setRotation(0)} style={btn(canRotate && !!selected?.rotation)}>0°</button>
            </div>
            {isDesign ? <p style={hintStyle}>Full-frame designs are not rotated.</p> : locked ? <p style={hintStyle}>Unlock the layer to rotate it.</p> : null}
          </div>

          <div style={row}>
            <button
              type="button" aria-label="Duplicate layer" disabled={!canDuplicate} style={btn(canDuplicate)}
              onClick={() => {
                if (!selected) return
                const result = duplicateLayer(settings, selected.id, compW, compH)
                if (!result) return
                edit((prev) => duplicateLayer(prev, selected.id, compW, compH)?.settings ?? prev)
                onSelect(result.newId)
              }}
            >Duplicate</button>
            {ORDER_BUTTONS.map(({ mode, label }) => (
              <button
                key={mode} type="button" aria-label={`Move layer ${label.toLowerCase()}`} style={small}
                onClick={() => selected && edit((prev) => reorderLayer(prev, selected.id, mode))}
              >{label}</button>
            ))}
          </div>

          <div>
            <div style={labelStyle}>Group</div>
            <div style={row}>
              <button
                type="button" aria-label="Group selected layers" disabled={!canGroup} style={btn(canGroup)}
                onClick={() => edit((prev) => groupLayers(prev, selectionIds)?.settings ?? prev)}
              >Group{canGroup ? ` (${selectedGroupable.length})` : ''}</button>
              <button
                type="button" aria-label="Ungroup layers" disabled={!selected?.groupId} style={btn(!!selected?.groupId)}
                onClick={() => selected && edit((prev) => ungroupLayers(prev, [selected.id]))}
              >Ungroup</button>
              {selected?.groupId ? <span style={{ color: C.muted, fontSize: 10 }}>In {selected.groupId.replace('-', ' ')} — dragging moves the whole group</span> : null}
            </div>
            <p style={hintStyle}>Shift-click layers to select several, then Group so they move together.</p>
          </div>

          <div>
            <div style={labelStyle}>{selectionIds.length > 1 ? 'Align selection' : 'Align to frame'}</div>
            <div style={row}>
              {ALIGN_BUTTONS.map(({ mode, label }) => (
                <button
                  key={mode} type="button" aria-label={`Align ${label.toLowerCase()}`} disabled={!canAlign} style={btn(canAlign)}
                  onClick={() => edit((prev) => alignLayers(prev, selectionIds, mode, compW, compH))}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Stage</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.text, cursor: 'pointer' }}>
          <input type="checkbox" aria-label="Snap to grid" checked={snapGrid} onChange={(e) => onSnapGridChange(e.target.checked)} />
          Snap to a 5% grid
        </label>
        <p style={hintStyle}>Layers always snap to the frame edges, the centre and other layers. Hold Alt while dragging to turn snapping off.</p>
      </div>

      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Presenter / background footage</div>
        {(['x', 'y'] as const).map((axis) => (
          <div key={axis}>
            <label style={labelStyle} htmlFor={`source-${axis}`}>{axis === 'x' ? 'Position: left–right' : 'Position: top–bottom'}</label>
            <input id={`source-${axis}`} type="range" aria-label={axis === 'x' ? 'Footage horizontal position' : 'Footage vertical position'} min={0} max={1} step={0.01} value={source[axis]} onChange={(e) => setSource({ [axis]: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
          </div>
        ))}
        <div>
          <label style={labelStyle} htmlFor="source-zoom">Zoom {source.zoom.toFixed(2)}×</label>
          <input id="source-zoom" type="range" aria-label="Footage zoom" min={1} max={4} step={0.05} value={source.zoom} onChange={(e) => setSource({ zoom: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
        </div>
        <div style={row}>
          <button type="button" aria-label="Reset footage position" disabled={!settings.sourceTransform} style={btn(!!settings.sourceTransform)} onClick={() => setSource({ x: 0.5, y: 0.5, zoom: 1 })}>Reset</button>
        </div>
        <p style={hintStyle}>Moves and zooms the whole video frame (e.g. to keep the presenter in shot). It is applied the same way in the preview and the exported video.</p>
      </div>

      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Custom fields</div>
        <p style={hintStyle}>Add your own fields, then type {'{{name}}'} in any text layer to fill it in.</p>
        {Object.entries(settings.customFields ?? {}).map(([key, value]) => (
          <div key={key} style={row}>
            <code style={{ color: C.cyan, fontSize: 11, minWidth: 70 }}>{`{{${key}}}`}</code>
            <input aria-label={`Value for ${key}`} value={value} maxLength={500} onChange={(e) => setFieldValueFor(key, e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 90, minHeight: 28, padding: '0 8px' }} />
            <button type="button" aria-label={`Remove field ${key}`} style={small} onClick={() => removeField(key)}>Remove</button>
          </div>
        ))}
        <div style={row}>
          <input aria-label="New field name" placeholder="name" value={fieldKey} maxLength={40} onChange={(e) => setFieldKey(e.target.value)} style={{ ...inputStyle, width: 90, minHeight: 28, padding: '0 8px' }} />
          <input aria-label="New field value" placeholder="value" value={fieldValue} maxLength={500} onChange={(e) => setFieldValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addField() }} style={{ ...inputStyle, flex: 1, minWidth: 90, minHeight: 28, padding: '0 8px' }} />
          <button type="button" aria-label="Add custom field" style={small} onClick={addField}>Add</button>
        </div>
        {fieldError ? <p role="alert" style={{ ...hintStyle, color: '#fca5a5' }}>{fieldError}</p> : null}
      </div>

      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Saved layouts</div>
        <div style={row}>
          <input aria-label="Layout name" placeholder="Name this layout" value={layoutName} maxLength={60} onChange={(e) => setLayoutName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveLayout() }} style={{ ...inputStyle, flex: 1, minWidth: 110, minHeight: 28, padding: '0 8px' }} />
          <button type="button" aria-label="Save layout" style={small} onClick={saveLayout}>Save</button>
        </div>
        <p data-testid="layouts-sync-status" style={hintStyle}>
          {syncStatus === 'account'
            ? 'Saved to your account: available on any device you sign in on.'
            : syncStatus === 'checking'
              ? 'Checking for your account…'
              : `${statusMessage || 'Layouts stay in this browser.'}`}
        </p>
        {layouts.length === 0 ? <p style={hintStyle}>Saves positions, sizes, rotation and stacking only — never text or pictures — so you can reuse an arrangement on another prospect.</p> : null}
        {layouts.map((layout) => (
          <div key={layout.id} style={row}>
            <span style={{ color: C.text, fontSize: 11, flex: 1, minWidth: 80 }}>
              {layout.name} <span style={{ color: C.muted }}>· {layout.aspectRatio} · {layout.source === 'account' ? 'account' : 'this browser'}</span>
            </span>
            <button type="button" aria-label={`Apply layout ${layout.name}`} style={small} onClick={() => applySaved(layout)}>Apply</button>
            {layout.source === 'browser' && syncStatus === 'account' ? (
              <button type="button" aria-label={`Upload layout ${layout.name} to my account`} style={small} onClick={() => void uploadLayout(layout)}>Upload</button>
            ) : null}
            <button type="button" aria-label={`Delete layout ${layout.name}`} style={small} onClick={() => deleteSaved(layout)}>Delete</button>
          </div>
        ))}
        {syncNote ? <p role="status" style={hintStyle}>{syncNote}</p> : null}
      </div>
    </div>
  )
}
