'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutTemplate, Palette } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { PREVIEW_LAYOUTS } from '../preview/presets'
import { C, hintStyle, inputStyle, labelStyle, panelStyle, primaryButtonStyle, softPanelStyle } from './tokens'
import { PersonalizationTemplateBrowser } from './PersonalizationTemplateBrowser'
import type { ClientProfile } from '../types'
import type { PreviewLayerKind, PreviewLayoutId } from '../preview/types'

const LAYER_LABELS: Record<PreviewLayerKind, string> = {
  logo: 'Logo',
  businessName: 'Business name',
  headline: 'Headline',
  offer: 'Offer',
  cta: 'Call to action',
  productImage: 'Product image',
  serviceImage: 'Service image',
  tagline: 'Tagline',
  endCard: 'Branded end card',
  design: 'Design',
}

/**
 * The layout SmartVideo GO AI applies for the customer when they have not
 * picked one. Derived only from what actually exists:
 *   • a logo          → 'business-introduction' (leads with the brand mark)
 *   • product images  → 'product-showcase'
 *   • neither         → 'service-promotion'
 *
 * With nothing at all the provider's own neutral 'business-introduction'
 * default still applies, so a compatible layout always exists.
 */
function preferredLayout(options: { hasLogo: boolean; hasProductImages: boolean }): PreviewLayoutId {
  if (options.hasLogo) return 'business-introduction'
  if (options.hasProductImages) return 'product-showcase'
  return 'service-promotion'
}

/**
 * Simple Mode step 3 — personalize the selected video.
 *
 * Layout choice is NEVER a gate: SmartVideo GO AI applies a compatible layout
 * automatically from what already exists, and the visitor may change it in the
 * optional strip below. Every visible field is editable; nothing is invented
 * (an empty Offer stays empty rather than being filled with a made-up promo).
 */
export interface StepPersonalizeProps {
  /**
   * Set once the visitor picks a layout chip. Held by the wizard so the choice
   * survives leaving and returning to step 3 (whose component unmounts).
   */
  layoutChosenByUser?: boolean
  /** Called when the visitor picks a layout chip, so the wizard can remember it. */
  onChooseLayout?: () => void
}

export function StepPersonalize({
  layoutChosenByUser: chosenByWizard,
  onChooseLayout,
}: StepPersonalizeProps = {}): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    clientForm = {},
    updateClientForm,
    assets,
    previewSettings,
    setPreviewLayout,
    updatePreviewLayer,
    updatePreviewBrandColors,
    updatePreviewComposition,
    setGuidedStep,
  } = ctx

  // LOCAL-only marker: once the visitor picks a layout chip, the auto-apply
  // below stops overriding their choice for the rest of this visit. Falls back
  // to local state when the component is used outside the wizard.
  const [localChosenByUser, setLocalChosenByUser] = useState(false)
  const layoutChosenByUser = chosenByWizard || localChosenByUser

  const layers = previewSettings.layers
  const logoAvailable = Boolean(assets?.primaryLogo)
  const productAvailable = (assets?.products?.length || 0) > 0
  const taglineLayer = layers.find((item) => item.kind === 'tagline')
  const activeLayout = PREVIEW_LAYOUTS.find((layout) => layout.id === previewSettings.layout) || PREVIEW_LAYOUTS[0]

  // Auto-apply a compatible layout on mount, and again while nothing was chosen
  // explicitly (e.g. a product photo imported later). The ref guard keeps it to
  // one call per source, so it can never loop.
  const autoAppliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (layoutChosenByUser) return
    const next = preferredLayout({ hasLogo: logoAvailable, hasProductImages: productAvailable })
    if (previewSettings.layout === next) {
      autoAppliedRef.current = previewSettings.layout
      return
    }
    if (autoAppliedRef.current === next) return
    autoAppliedRef.current = next
    setPreviewLayout(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: keyed on availability, not the settings object
  }, [logoAvailable, productAvailable, previewSettings.layout, layoutChosenByUser, setPreviewLayout])

  // Keep the tagline layer in sync with the Tagline field whenever the active
  // layout has one — e.g. the customer typed a tagline under a layout without
  // a tagline layer and then switched. A non-empty field value is pushed onto
  // the layer; an empty field never wipes text the customer did not type.
  const taglineSyncRef = useRef<string>('')
  useEffect(() => {
    const fieldText = clientForm.brandDescription || ''
    const key = `${taglineLayer?.id ?? ''}|${taglineLayer?.text ?? ''}|${fieldText}`
    if (taglineSyncRef.current === key) return
    taglineSyncRef.current = key
    if (!fieldText || !taglineLayer) return
    if ((taglineLayer.text || '') === fieldText) return
    updatePreviewLayer(taglineLayer.id, { text: fieldText })
  }, [clientForm.brandDescription, taglineLayer?.id, taglineLayer?.text, updatePreviewLayer])

  /** Update a client field AND the matching layer text so both stay in sync. */
  const setField = (field: keyof ClientProfile, value: string, layerKind: PreviewLayerKind) => {
    updateClientForm({ ...clientForm, [field]: value })
    const layer = layers.find((item) => item.kind === layerKind)
    if (layer) updatePreviewLayer(layer.id, { text: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Personalize automatically</h2>
        <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>
          SmartVideo GO AI places your real logo, photos and details on your video — edit anything you see.
        </p>
      </div>

      {/* ── Auto-applied layout (optional, never a step gate) ───────────── */}
      <div style={softPanelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <LayoutTemplate size={15} color={C.cyan} />
          <span style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Layout (optional)
          </span>
          <span style={{ marginLeft: 'auto', color: C.muted2, fontSize: 10 }}>
            {layoutChosenByUser ? 'Your choice' : 'Chosen for you'}
          </span>
        </div>
        <p style={{ ...hintStyle, marginTop: 6 }}>
          We applied <strong style={{ color: C.text }}>{activeLayout.name}</strong> for you — {activeLayout.description} You
          can switch to another at any time; nothing is required to continue.
        </p>
        <PersonalizationTemplateBrowser
          onSelect={(layoutId) => {
            setLocalChosenByUser(true)
            onChooseLayout?.()
            setPreviewLayout(layoutId)
          }}
        />
      </div>

      {/* ── Editable content ────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          Your details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="guided-business-name">Business name</label>
            <input
              id="guided-business-name"
              value={clientForm.businessName || clientForm.name || ''}
              onChange={(event) => setField('businessName', event.target.value, 'businessName')}
              placeholder="Your business name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-headline">Headline</label>
            <input
              id="guided-headline"
              value={clientForm.ctaHeadline || ''}
              onChange={(event) => setField('ctaHeadline', event.target.value, 'headline')}
              placeholder={clientForm.businessName || clientForm.name || 'A short opening line'}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-tagline">Tagline (optional)</label>
            <input
              id="guided-tagline"
              value={clientForm.brandDescription || ''}
              onChange={(event) => setField('brandDescription', event.target.value, 'tagline')}
              placeholder="A short line about what makes your business different"
              style={inputStyle}
            />
            <p style={hintStyle}>Optional — leave it empty if you would rather not show one.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-offer">Offer (optional)</label>
            <input
              id="guided-offer"
              value={clientForm.offer || ''}
              onChange={(event) => setField('offer', event.target.value, 'offer')}
              placeholder="Leave empty unless you have one"
              style={inputStyle}
            />
            <p style={hintStyle}>Only add an offer you actually provide — we never invent discounts or prices.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-cta">Call to action</label>
            <input
              id="guided-cta"
              value={clientForm.callToAction || ''}
              onChange={(event) => setField('callToAction', event.target.value, 'cta')}
              placeholder={clientForm.website ? `Visit ${clientForm.website}` : clientForm.phone ? `Call ${clientForm.phone}` : 'e.g. Book a free quote'}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="guided-phone">Phone</label>
            <input
              id="guided-phone"
              value={clientForm.phone || ''}
              onChange={(event) => updateClientForm({ ...clientForm, phone: event.target.value })}
              placeholder="(optional)"
              style={inputStyle}
            />
            <p style={hintStyle}>Shown on the branded end card.</p>
          </div>
        </div>
      </div>

      {/* ── Brand colors ────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Palette size={15} color={C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Brand colors
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }}>
          {(
            [
              ['Primary', 'primary'],
              ['Accent', 'accent'],
              ['Text', 'text'],
            ] as const
          ).map(([label, key]) => (
            <div key={key}>
              <label style={labelStyle} htmlFor={`guided-color-${key}`}>{label}</label>
              <input
                id={`guided-color-${key}`}
                type="color"
                value={previewSettings.brandColors[key]}
                onChange={(event) => updatePreviewBrandColors({ [key]: event.target.value })}
                style={{ width: '100%', height: 40, borderRadius: 8, border: `1px solid ${C.border}`, background: C.field, padding: 3 }}
              />
            </div>
          ))}
          <div>
            <label style={labelStyle} htmlFor="guided-dim">Shade behind text</label>
            <input
              id="guided-dim"
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={previewSettings.brandColors.backgroundDim}
              onChange={(event) => updatePreviewBrandColors({ backgroundDim: Number(event.target.value) })}
              style={{ width: '100%', accentColor: C.cyan }}
            />
          </div>
        </div>
      </div>

      {/* ── What will be placed ─────────────────────────────────────────── */}
      <div style={panelStyle}>
        <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          What will be placed on your video
        </h3>
        <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
          Based on the {activeLayout.name} layout — the preview updates as you edit.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 8 }}>
          {layers.map((layer) => {
            const isImageLayer = layer.kind === 'logo' || layer.kind === 'productImage' || layer.kind === 'serviceImage'
            const hasImage = isImageLayer ? Boolean(layer.imageUrl) : true
            const text = layer.text || ''
            const ready = layer.kind === 'endCard' ? previewSettings.showEndCard : hasImage && (isImageLayer || text.trim().length > 0)
            return (
              <div key={layer.id} style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    flexShrink: 0,
                    background: ready ? C.green : C.muted2,
                  }}
                />
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{LAYER_LABELS[layer.kind]}</span>
                <span style={{ marginLeft: 'auto', color: ready ? C.green : C.muted, fontSize: 10, fontWeight: 700 }}>
                  {ready ? 'Ready' : layer.kind === 'productImage' && !productAvailable ? 'Add a photo in Advanced Editing' : isImageLayer && !hasImage ? 'Add an image' : 'Nothing to show'}
                </span>
              </div>
            )
          })}
        </div>
        {!logoAvailable && (
          <p style={hintStyle}>No logo yet — add one in Advanced Editing, or the layout works without it.</p>
        )}
        {!productAvailable && (
          <p style={hintStyle}>No product or service photos yet — add them in Advanced Editing to use those layouts fully.</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.text, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={previewSettings.showEndCard}
              onChange={(event) => updatePreviewComposition({ showEndCard: event.target.checked })}
            />
            Show a branded ending card
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setGuidedStep(4)} style={primaryButtonStyle}>
          Preview my video
        </button>
      </div>
    </div>
  )
}
