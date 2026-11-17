'use client'

import { useMemo, useState } from 'react'
import { Palette, Save, Trash2 } from 'lucide-react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { applyBrandKit, buildBrandKit, isBrandKitApplied } from '../../brand/brandKit'
import { C, hintStyle, inputStyle, secondaryButtonStyle, softPanelStyle } from '../tokens'
import {
  MAX_SAVED_TEMPLATES, captureTemplate, deleteTemplate, loadTemplates, normalizeTemplateName, planTemplateApplication, saveTemplate, type SavedTemplate,
} from './savedTemplates'

/**
 * Two free, in-browser helpers above the editor: "Brand kit" (colours found on the customer's site applied to the
 * whole overlay in one click) and "My templates" (this overlay's look saved in this browser and re-applied to any
 * project). Nothing is uploaded; templates never carry text or pictures.
 */
export function BrandAndTemplates(): React.JSX.Element | null {
  const ctx = useDemoPersonalize()
  const { previewSettings: settings, businessResearch, updatePreviewBrandColors, updatePreviewLayer, updatePreviewComposition } = ctx
  const kit = useMemo(
    () => buildBrandKit(businessResearch?.result?.brandColors, settings.brandColors.backgroundDim),
    [businessResearch?.result?.brandColors, settings.brandColors.backgroundDim],
  )
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates())
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const applied = kit ? isBrandKitApplied(kit, settings) : false
  const onApplyKit = () => {
    if (!kit) return
    const plan = applyBrandKit(kit, settings)
    updatePreviewBrandColors(plan.brandColors)
    for (const { layerId, patch } of plan.layerPatches) updatePreviewLayer(layerId, patch)
    setNote('Brand colours applied.')
  }

  const onSave = () => {
    // captureTemplate falls back to "My template" for an empty name, which would silently replace that look.
    if (!normalizeTemplateName(name)) { setNote('Give the template a name first.'); return }
    const res = saveTemplate(captureTemplate(settings, name))
    if (!res.ok) { setNote(res.reason === 'name-empty' ? 'Give the template a name first.' : 'This browser would not save it (storage is blocked or full).'); return }
    setTemplates(res.templates); setName(''); setNote('Saved in this browser.')
  }
  const onDelete = (t: SavedTemplate) => {
    const res = deleteTemplate(t.id)
    setTemplates(res.templates)
    setNote(res.ok ? `Deleted “${t.name}”.` : 'This browser would not save the change (storage is blocked or full), so the template is still there.')
  }
  const onApply = (t: SavedTemplate) => {
    const plan = planTemplateApplication(t, settings)
    updatePreviewBrandColors(plan.brandColors)
    updatePreviewComposition({ showEndCard: plan.showEndCard })
    for (const { layerId, patch } of plan.layerPatches) updatePreviewLayer(layerId, patch)
    const parts = [`Applied “${t.name}”.`]
    if (t.aspectRatio !== settings.aspectRatio) parts.push(`It was made for ${t.aspectRatio}, so check the positions.`)
    if (plan.skipped) parts.push(`${plan.skipped} layer${plan.skipped === 1 ? '' : 's'} it styled ${plan.skipped === 1 ? 'is' : 'are'} not in this project.`)
    setNote(parts.join(' '))
  }

  return (
    <div data-testid="brand-and-templates" style={{ ...softPanelStyle, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Palette size={13} color={C.cyan} />
        <strong style={{ fontSize: 11, color: C.text }}>Brand kit</strong>
        {kit ? (
          <>
            <span aria-hidden style={{ display: 'inline-flex', gap: 3 }}>
              {kit.palette.slice(0, 6).map((c) => <span key={c} title={c} style={{ width: 14, height: 14, borderRadius: 4, background: c, border: `1px solid ${C.border}` }} />)}
            </span>
            <button type="button" data-testid="brand-kit-apply" onClick={onApplyKit} disabled={applied} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', opacity: applied ? 0.5 : 1 }}>
              {applied ? 'Brand kit applied' : 'Apply brand kit'}
            </button>
          </>
        ) : (
          <span style={{ ...hintStyle, margin: 0 }}>No brand colours were found for this business yet.</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Save size={13} color={C.cyan} />
        <strong style={{ fontSize: 11, color: C.text }}>My templates</strong>
        <input
          aria-label="Template name" data-testid="template-name" value={name} maxLength={40} placeholder="Name this look"
          onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, minHeight: 28, height: 28, width: 150, fontSize: 11, padding: '0 8px' }}
        />
        <button type="button" data-testid="template-save" onClick={onSave} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}>Save this look</button>
      </div>
      {templates.length > 0 && (
        <ul data-testid="template-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {templates.map((t) => (
            <li key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button type="button" data-testid={`template-apply-${t.id}`} title={`${t.aspectRatio} · saved ${t.createdAt.slice(0, 10)}`} onClick={() => onApply(t)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 9px' }}>{t.name}</button>
              <button type="button" aria-label={`Delete ${t.name}`} data-testid={`template-delete-${t.id}`} onClick={() => onDelete(t)} style={{ ...secondaryButtonStyle, minHeight: 26, minWidth: 26, padding: 0, display: 'inline-grid', placeItems: 'center' }}><Trash2 size={11} /></button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ ...hintStyle, margin: 0 }}>
        Saved only in this browser (up to {MAX_SAVED_TEMPLATES}). A template keeps position, size, timing, colours and styles — never your text or pictures.
      </p>
      {note && <p role="status" data-testid="brand-templates-note" style={{ ...hintStyle, margin: 0, color: C.cyan }}>{note}</p>}
    </div>
  )
}
