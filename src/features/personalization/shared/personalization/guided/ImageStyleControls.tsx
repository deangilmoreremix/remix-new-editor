'use client'

import { C, hintStyle, inputStyle, labelStyle, secondaryButtonStyle } from './tokens'
import type { ImagePresetId, ImageRole, ImageShadow, ImageShape, ImageStyle } from '../preview/imageStyle'
import { IMAGE_PRESETS, IMAGE_PRESET_ORDER, presetSuitsRole } from '../preview/imagePresets'

const SHAPES: { id: ImageShape; label: string }[] = [
  { id: 'rounded-rect', label: 'Rounded rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'pill', label: 'Pill' },
  { id: 'square', label: 'Original (square corners)' },
  { id: 'custom', label: 'Custom corners' },
]
const ROLE_OPTIONS: { id: ImageRole; label: string }[] = [
  { id: 'product', label: 'A product' }, { id: 'service', label: 'A service' }, { id: 'food', label: 'Food' },
  { id: 'real-estate', label: 'Real estate' }, { id: 'property', label: 'A storefront / office' },
  { id: 'portrait', label: 'A portrait / headshot' }, { id: 'portfolio', label: 'Completed work' }, { id: 'general', label: 'Something else' },
]
const SHADOWS: { id: ImageShadow; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'medium', label: 'Medium' },
]

/**
 * Image look controls for an image layer: shape, corner radius, border, shadow,
 * fit, crop focus and exit. Editing starts from the look currently shown (the
 * automatic one included) and marks the style as the customer's, so the system
 * never replaces it. "Automatic" hands control back.
 */
export function ImageStyleControls({
  style,
  isAuto,
  reason,
  onChange,
  onReset,
  role = 'general',
  onPreset,
  compShort = 1080,
  onRole,
  libraryOptions = [],
  extraUrls = [],
  onExtraUrls,
}: {
  style: ImageStyle
  isAuto: boolean
  reason: string
  onChange: (patch: Partial<ImageStyle>) => void
  onReset: () => void
  /** The image's explicit role (product, service, portrait, property, portfolio, general). */
  role?: ImageRole
  onPreset?: (id: ImagePresetId) => void
  /** Composition shorter side (px) so the corner radius shows in real pixels at 1080p scale. */
  compShort?: number
  /** Lets the customer state what the picture is (food, real estate…). */
  onRole?: (role: ImageRole) => void
  /** Library pictures the customer can add to a collage. */
  libraryOptions?: { value: string; label: string }[]
  extraUrls?: string[]
  onExtraUrls?: (urls: string[]) => void
}): React.JSX.Element {
  const row = { display: 'grid', gap: 4 } as const
  return (
    <div data-testid="image-style-controls" style={{ display: 'grid', gap: 10, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={labelStyle}>Image style</div>
        <span data-testid="image-style-mode" style={{ ...hintStyle, margin: 0 }}>{isAuto ? 'Automatic' : 'Your style'}</span>
      </div>
      {isAuto && <p style={{ ...hintStyle, margin: 0 }}>Chosen automatically: {reason}. Change anything below to take control.</p>}

      {onRole && role !== 'logo' && (
        <div style={row}>
          <label style={labelStyle}>This picture is</label>
          <select aria-label="Image role" value={role} onChange={(e) => onRole(e.target.value as ImageRole)} style={inputStyle}>
            {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      )}

      {onPreset && (
        <div data-testid="image-overlay-styles" style={{ display: 'grid', gap: 6 }}>
          <div style={labelStyle}>Image overlay styles</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {IMAGE_PRESET_ORDER.map((id) => {
              const preset = IMAGE_PRESETS[id]
              const active = style.presetId === id
              const suits = presetSuitsRole(id, role)
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`image-preset-${id}`}
                  aria-label={`Image style preset: ${preset.label}`}
                  aria-pressed={active}
                  title={preset.description + (preset.reusesDesign ? ` (Also available as the “${preset.reusesDesign.name}” template.)` : '')}
                  onClick={() => onPreset(id)}
                  style={{
                    textAlign: 'left', padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.text,
                    background: active ? C.cyanSoft : 'rgba(255,255,255,.03)',
                    border: `1px solid ${active ? C.cyanBorder : C.border}`,
                    opacity: suits ? 1 : 0.62,
                  }}
                >
                  {preset.label}
                  <span style={{ display: 'block', fontSize: 9, fontWeight: 600, color: C.muted, marginTop: 2 }}>
                    {suits ? `Suits ${role} images` : `Less suited to ${role} images`}
                  </span>
                </button>
              )
            })}
          </div>
          {style.presetId && IMAGE_PRESETS[style.presetId].reusesDesign && (
            <p data-testid="image-preset-reuse" style={{ ...hintStyle, margin: 0 }}>
              Want the animated full-scene version? The “{IMAGE_PRESETS[style.presetId].reusesDesign!.name}” template already provides it.
            </p>
          )}
        </div>
      )}

      {style.presetId === 'multi-image-collage' && onExtraUrls && (
        <div data-testid="collage-picker" style={{ display: 'grid', gap: 6 }}>
          <div style={labelStyle}>Collage pictures ({extraUrls.length + 1} of 2–4)</div>
          {libraryOptions.length === 0 && <p style={{ ...hintStyle, margin: 0 }}>Add more pictures to your assets to build a collage.</p>}
          {libraryOptions.map((o) => (
            <label key={o.value} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: C.text }}>
              <input
                type="checkbox"
                aria-label={`Collage picture: ${o.label}`}
                checked={extraUrls.includes(o.value)}
                onChange={(e) => {
                  const next = e.target.checked ? [...extraUrls, o.value] : extraUrls.filter((u) => u !== o.value)
                  onExtraUrls(next.slice(0, 3))
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}

      {style.presetId === 'split-screen' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={labelStyle}>Panel side {style.splitSideAuto ? '(automatic)' : ''}</label>
          <select aria-label="Split screen side" value={style.splitSide ?? 'right'} onChange={(e) => onChange({ splitSide: e.target.value as 'left' | 'right' | 'top' | 'bottom', splitSideAuto: false })} style={inputStyle}>
            <option value="left">Left</option><option value="right">Right</option><option value="top">Top</option><option value="bottom">Bottom</option>
          </select>
        </div>
      )}

      <div style={row}>
        <label style={labelStyle}>Shape</label>
        <select aria-label="Image shape" value={style.shape} onChange={(e) => onChange({ shape: e.target.value as ImageShape })} style={inputStyle}>
          {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {(style.shape === 'rounded-rect' || style.shape === 'custom') && (
        <div style={row}>
          <label style={labelStyle}>Corner radius ({style.radiusComp !== undefined ? `${Math.round(style.radiusComp * 1080)} px at 1080p` : `${Math.round(style.radius * 100)}%`})</label>
          {style.radiusComp !== undefined ? (
            <input type="range" aria-label="Corner radius" min={0} max={80} step={1} value={Math.round(style.radiusComp * 1080)}
              onChange={(e) => onChange({ radiusComp: Number(e.target.value) / 1080 })} style={{ width: '100%', accentColor: C.cyan }} />
          ) : (
            <input type="range" aria-label="Corner radius" min={0} max={0.5} step={0.01} value={style.radius}
              onChange={(e) => onChange({ radius: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
          )}
        </div>
      )}

      <div style={row}>
        <label style={labelStyle}>Border</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select aria-label="Border colour" value={style.borderWidth > 0 ? style.borderColor : 'none'}
            onChange={(e) => (e.target.value === 'none' ? onChange({ borderWidth: 0 }) : onChange({ borderColor: e.target.value, borderWidth: style.borderWidth > 0 ? style.borderWidth : 0.004 }))}
            style={{ ...inputStyle, flex: 1 }}>
            <option value="none">None</option>
            <option value="brand-primary">Brand colour</option>
            <option value="brand-accent">Accent colour</option>
            <option value="#ffffff">White</option>
            <option value="#000000">Black</option>
          </select>
          <input type="range" aria-label="Border width" min={0} max={0.015} step={0.001} value={style.borderWidth}
            disabled={style.borderWidth === 0} onChange={(e) => onChange({ borderWidth: Number(e.target.value) })} style={{ flex: 1, accentColor: C.cyan }} />
        </div>
      </div>

      <div style={row}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" aria-label="Shadow" checked={style.shadow !== 'none'}
            onChange={(e) => onChange({ shadow: e.target.checked ? (style.shadow === 'none' ? 'subtle' : style.shadow) : 'none' })} />
          Shadow
        </label>
        <select aria-label="Image shadow" value={style.shadow} onChange={(e) => onChange({ shadow: e.target.value as ImageShadow })} style={inputStyle}>
          {SHADOWS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {style.presetId === 'product-spotlight' && (
        <div style={row}>
          <label style={labelStyle}>Promo badge (optional)</label>
          <input aria-label="Promo badge text" maxLength={24} placeholder="e.g. 20% OFF" value={style.badge ?? ''}
            onChange={(e) => onChange({ badge: e.target.value.trim() ? e.target.value.slice(0, 24) : undefined })} style={inputStyle} />
        </div>
      )}

      <div style={row}>
        <label style={labelStyle}>Fit</label>
        <select aria-label="Image fit" value={style.fit} onChange={(e) => onChange({ fit: e.target.value as 'contain' | 'cover' })} style={inputStyle}>
          <option value="contain">Show the whole picture</option>
          <option value="cover">Fill the shape (crops)</option>
        </select>
      </div>

      {style.fit === 'cover' && (
        <>
          <div style={row}>
            <label style={labelStyle}>Crop: left–right</label>
            <input type="range" aria-label="Crop horizontal" min={0} max={1} step={0.01} value={style.cropX}
              onChange={(e) => onChange({ cropX: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
          </div>
          <div style={row}>
            <label style={labelStyle}>Crop: top–bottom</label>
            <input type="range" aria-label="Crop vertical" min={0} max={1} step={0.01} value={style.cropY}
              onChange={(e) => onChange({ cropY: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
          </div>
        </>
      )}

      <div style={row}>
        <label style={labelStyle}>When it leaves</label>
        <select aria-label="Image exit" value={style.exit ?? 'none'} onChange={(e) => onChange({ exit: e.target.value as 'none' | 'fade' | 'shrink' })} style={inputStyle}>
          <option value="none">Cut</option>
          <option value="fade">Fade out</option>
          <option value="shrink">Shrink and fade</option>
        </select>
      </div>

      {!isAuto && (
        <button type="button" data-testid="image-style-reset" aria-label="Reset image style" onClick={onReset} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11 }}>
          Back to automatic
        </button>
      )}
    </div>
  )
}
