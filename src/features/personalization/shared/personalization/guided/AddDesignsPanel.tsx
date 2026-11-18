'use client'

import { useMemo } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { canAddDesign, listAddedDesigns } from '../preview/designAddons'
import { getRemotionDesignTemplate } from '../templates/registry'
import { getRemotionDesignFixedSvgIdWarning } from '../templates/catalog'
import { suggestGoal } from '../templates/recommendations'
import { DesignRecommendations } from './DesignRecommendations'
import { C, hintStyle, labelStyle, secondaryButtonStyle, softPanelStyle } from './tokens'

/**
 * Every template (the layouts and all registered designs) with the add-on rules, plus the list of designs
 * already on the video. One component used by Simple Mode Step 4, the on-video editor and Advanced Editing,
 * so the three places behave identically and share the provider's single preview state.
 */
export function AddDesignsPanel(): React.JSX.Element | null {
  const ctx = useDemoPersonalize()
  const {
    previewSettings,
    assets,
    remotionDesignTemplates = [],
    activeRemotionDesignId = null,
    setRemotionDesign,
    addRemotionDesign,
    setPreviewLayout,
    removePreviewDesignLayer,
    moveAddedDesign,
    remotionDesignError = null,
    updatePreviewLayer,
    clientForm = {},
  } = ctx

  const available = useMemo(
    () => ({
      logo: Boolean(assets?.primaryLogo),
      product: (assets?.products?.length || 0) > 0,
      service: (assets?.products?.length || 0) > 0,
    }),
    [assets],
  )
  const added = listAddedDesigns(previewSettings)
  if (remotionDesignTemplates.length === 0) return null
  const fixedSvgIdWarning = getRemotionDesignFixedSvgIdWarning(activeRemotionDesignId)
  const fps = previewSettings.fps || 30

  return (
    <div data-testid="add-designs-panel">
      <div style={{ ...labelStyle, marginBottom: 6 }}>Added to your video</div>
      {added.length === 0 ? (
        <p style={{ ...hintStyle, marginTop: 0 }}>No animated designs yet — pick one below. Your layout and edits stay as they are.</p>
      ) : (
        <ul data-testid="added-designs" style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {added.map((layer, index) => {
            const design = layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
            const end = typeof layer.endFrame === 'number' ? `${(layer.endFrame / fps).toFixed(1)}s` : 'end'
            return (
              <li key={layer.id} data-testid={`added-design-${layer.designId}`} style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{design?.name ?? layer.designId}</span>
                <span style={{ color: C.muted, fontSize: 10 }}>{(layer.startFrame / fps).toFixed(1)}s – {end}</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                  <button type="button" aria-label={`Move ${design?.name ?? 'design'} earlier`} disabled={index === 0} onClick={() => moveAddedDesign(layer.id, -1)} style={{ ...secondaryButtonStyle, minHeight: 26, padding: '0 8px' }}><ArrowUp size={12} /></button>
                  <button type="button" aria-label={`Move ${design?.name ?? 'design'} later`} disabled={index === added.length - 1} onClick={() => moveAddedDesign(layer.id, 1)} style={{ ...secondaryButtonStyle, minHeight: 26, padding: '0 8px' }}><ArrowDown size={12} /></button>
                  <button type="button" data-testid={`remove-design-${layer.designId}`} onClick={() => removePreviewDesignLayer(layer.id)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={11} /> Remove
                  </button>
                  <button type="button" onClick={() => updatePreviewLayer(layer.id, { text: undefined, textSlotOverrides: undefined, color: undefined, fontFamily: undefined, imageUrl: undefined })} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>
                    Restore defaults
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <DesignRecommendations
        designs={remotionDesignTemplates}
        aspectRatio={previewSettings.aspectRatio}
        activeDesignId={activeRemotionDesignId}
        available={available}
        context={{
          textLength: Math.max(0, ...(previewSettings.layers ?? []).filter((l) => l.visible && l.kind !== 'design').map((l) => (l.text ?? '').trim().length)),
          hasLogo: Boolean(assets?.primaryLogo),
          imageCount: assets?.products?.length || 0,
        }}
        onSelectDesign={setRemotionDesign}
        onAddDesign={addRemotionDesign}
        onSelectLayout={setPreviewLayout}
        addCheck={(design) => canAddDesign(previewSettings, design, available)}
        suggestion={suggestGoal({ hasOffer: Boolean(clientForm.offer?.trim()), hasProductImages: available.product, booking: ctx.foundSignals?.booking })}
      />
      {fixedSvgIdWarning ? <p role="note" style={{ ...hintStyle, marginTop: 8 }}>{fixedSvgIdWarning}</p> : null}
      {remotionDesignError ? <p role="alert" style={{ ...hintStyle, color: C.danger, marginTop: 8 }}>{remotionDesignError}</p> : null}
    </div>
  )
}

