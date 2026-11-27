import { useEffect, useState } from 'react'
import { Bookmark, Check, Pencil, Trash2 } from 'lucide-react'
import { Tip } from './editor/Tip'
import { C, hintStyle, inputStyle, labelStyle, secondaryButtonStyle } from './tokens'
import {
  MAX_STYLE_NAME, MAX_TEXT_STYLES, addStyle, deleteStyle, readBrowserStyles, rememberInBrowser, renameStyle,
  type SavedTextStyle,
} from '../preview/textStyles'

interface Props {
  kind: SavedTextStyle['kind']
  idPrefix: string
  /** The project's saved styles (all kinds). */
  styles: SavedTextStyle[]
  onStylesChange: (next: SavedTextStyle[]) => void
  /** The look as it is now, to save. */
  capture: () => SavedTextStyle['style']
  onApply: (style: SavedTextStyle) => void
  /** When true (a locked layer) applying is off. */
  applyDisabled?: boolean
  defaultName?: string
}

/** Save the current look under a name, apply a saved look, rename or delete it, and bring in looks saved in this browser. */
export function SavedStylesBar({ kind, idPrefix, styles, onStylesChange, capture, onApply, applyDisabled, defaultName = 'My style' }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [browser, setBrowser] = useState<SavedTextStyle[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const mine = styles.filter((s) => s.kind === kind)
  useEffect(() => { setBrowser(readBrowserStyles()) }, [styles])
  const otherBrowser = browser.filter((b) => b.kind === kind && !mine.some((m) => m.name.toLowerCase() === b.name.toLowerCase()))
  const full = styles.length >= MAX_TEXT_STYLES

  const save = () => {
    const { list, added } = addStyle(styles, { kind, name: name.trim() || defaultName, style: capture() } as never)
    if (!added) { setNotice(`You can keep up to ${MAX_TEXT_STYLES} styles. Delete one first.`); return }
    onStylesChange(list)
    rememberInBrowser(added)
    setBrowser(readBrowserStyles())
    setName('')
    setNotice(`Saved as “${added.name}”.`)
  }
  const addFromBrowser = (b: SavedTextStyle) => {
    const { list, added } = addStyle(styles, { kind: b.kind, name: b.name, style: b.style } as never)
    if (!added) { setNotice(`You can keep up to ${MAX_TEXT_STYLES} styles. Delete one first.`); return }
    onStylesChange(list)
    setNotice(`Added “${added.name}” to this project.`)
  }
  const commitRename = (id: string) => {
    const next = renameStyle(styles, id, editName)
    onStylesChange(next)
    const renamed = next.find((s) => s.id === id)
    if (renamed) rememberInBrowser(renamed)
    setEditingId(null)
  }
  const row: React.CSSProperties = { display: 'flex', gap: 4, alignItems: 'center' }
  const iconBtn: React.CSSProperties = { ...secondaryButtonStyle, minHeight: 26, width: 28, padding: 0, display: 'grid', placeItems: 'center' }

  return (
    <div data-testid={`${idPrefix}-saved-styles`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Tip id="savedStyles" side="top"><div style={{ ...labelStyle, display: 'flex', gap: 5, alignItems: 'center' }}><Bookmark size={11} aria-hidden /> Saved styles</div></Tip>

      {mine.length === 0 && <p style={{ ...hintStyle, margin: 0 }}>None yet. Style it how you like, then save the look to reuse it.</p>}
      {mine.map((s) => (
        <div key={s.id} data-testid={`${idPrefix}-style-row`} style={row}>
          {editingId === s.id ? (
            <>
              <input data-testid={`${idPrefix}-style-rename-input`} aria-label={`New name for ${s.name}`} value={editName} maxLength={MAX_STYLE_NAME} autoFocus
                onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingId(null) }}
                style={{ ...inputStyle, minHeight: 28, padding: '0 8px', fontSize: 11, flex: 1 }} />
              <button type="button" data-testid={`${idPrefix}-style-rename-save`} aria-label="Save name" onClick={() => commitRename(s.id)} style={iconBtn}><Check size={12} aria-hidden /></button>
            </>
          ) : (
            <>
              <button type="button" data-testid={`${idPrefix}-style-apply`} disabled={applyDisabled} title={applyDisabled ? 'Unlock the layer to apply a style' : `Apply “${s.name}”`}
                onClick={() => onApply(s)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', flex: 1, textAlign: 'left', opacity: applyDisabled ? 0.5 : 1 }}>{s.name}</button>
              <button type="button" data-testid={`${idPrefix}-style-rename`} aria-label={`Rename ${s.name}`} onClick={() => { setEditingId(s.id); setEditName(s.name) }} style={iconBtn}><Pencil size={12} aria-hidden /></button>
              <button type="button" data-testid={`${idPrefix}-style-delete`} aria-label={`Delete ${s.name}`} onClick={() => { onStylesChange(deleteStyle(styles, s.id)); setNotice(`Deleted “${s.name}”. Layers that used it keep their look.`) }} style={iconBtn}><Trash2 size={12} aria-hidden /></button>
            </>
          )}
        </div>
      ))}

      <div style={row}>
        <input data-testid={`${idPrefix}-style-name`} aria-label="Name for this style" placeholder={defaultName} value={name} maxLength={MAX_STYLE_NAME}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          style={{ ...inputStyle, minHeight: 28, padding: '0 8px', fontSize: 11, flex: 1 }} />
        <button type="button" data-testid={`${idPrefix}-style-save`} disabled={full} onClick={save} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', borderColor: C.cyan, color: C.cyan }}>Save look</button>
      </div>

      {otherBrowser.length > 0 && (
        <div data-testid={`${idPrefix}-browser-styles`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tip id="savedStylesBrowser" side="top"><div style={labelStyle}>From this browser</div></Tip>
          {otherBrowser.map((b) => (
            <div key={b.id} style={row}>
              <span style={{ flex: 1, fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
              <button type="button" data-testid={`${idPrefix}-browser-add`} aria-label={`Add ${b.name} to this project`} disabled={full} onClick={() => addFromBrowser(b)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Add to this project</button>
            </div>
          ))}
        </div>
      )}
      {notice && <div role="status" data-testid={`${idPrefix}-style-notice`} style={{ ...hintStyle, margin: 0 }}>{notice}</div>}
    </div>
  )
}
