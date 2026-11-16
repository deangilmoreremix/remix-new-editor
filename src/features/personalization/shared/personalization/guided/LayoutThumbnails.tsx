'use client'

import { useMemo, useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { PREVIEW_LAYOUTS, applyLayoutPreset } from '../preview/presets'
import type { PreviewInputProps, PreviewLayoutId } from '../preview/types'
import { buildPreviewInput } from './buildPreviewInput'
import { previewBrandContext, TemplateLivePreview } from './PersonalizationTemplateBrowser'
import { C, hintStyle, tileStyle } from './tokens'

/**
 * The five layouts as picture buttons: each one is the customer's own video with THAT layout's logo, text and
 * images drawn on it, so the choice is made by looking, not by reading a name. Previews are a still frame; only
 * the hovered or focused one plays. Browser-only, never a paid call.
 */
export function LayoutThumbnails({
  onChoose,
  activeLayoutId,
}: {
  onChoose: (layoutId: PreviewLayoutId) => void
  /** The layout drawn on the video now, or null while an animated design replaced it. */
  activeLayoutId: PreviewLayoutId | null
}): React.JSX.Element {
  const { previewSettings, source, previewVideo, clientForm, assets } = useDemoPersonalize()
  const [hoverId, setHoverId] = useState<PreviewLayoutId | null>(null)

  const baseInput = useMemo<PreviewInputProps | null>(
    () => (previewSettings ? buildPreviewInput({ source, previewSettings, previewVideo, clientForm: clientForm ?? {}, assets }) : null),
    [source, previewSettings, previewVideo, clientForm, assets],
  )

  return (
    <div
      role="group"
      aria-label="Layout"
      data-testid="layout-picker"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}
    >
      {PREVIEW_LAYOUTS.map((layout) => {
        const active = activeLayoutId === layout.id
        const inputProps: PreviewInputProps | null = baseInput
          ? { ...baseInput, settings: applyLayoutPreset(baseInput.settings, layout.id, previewBrandContext(baseInput)) }
          : null
        const item = { kind: 'layout' as const, id: layout.id, name: layout.name, description: layout.description, category: 'layouts' as const }
        return (
          <button
            key={layout.id}
            type="button"
            data-testid={`layout-thumb-${layout.id}`}
            aria-pressed={active}
            title={layout.description}
            onClick={() => onChoose(layout.id)}
            onMouseEnter={() => setHoverId(layout.id)}
            onMouseLeave={() => setHoverId(null)}
            onFocus={() => setHoverId(layout.id)}
            onBlur={() => setHoverId(null)}
            style={{ ...tileStyle(active), padding: 6, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {inputProps ? (
              <TemplateLivePreview item={item} inputProps={inputProps} playing={hoverId === layout.id} />
            ) : (
              <div style={{ aspectRatio: '16 / 9', borderRadius: 8, background: '#0b1220' }} />
            )}
            <span style={{ color: active ? C.cyan : C.text, fontSize: 12, fontWeight: 700 }}>{layout.name}</span>
            {inputProps ? null : <span style={hintStyle}>{layout.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
