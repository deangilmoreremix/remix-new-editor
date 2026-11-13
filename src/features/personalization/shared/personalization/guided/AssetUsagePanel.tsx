'use client'

import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { summarizeAssetUsage, type AssetUsage } from '../preview/assetUsage'
import { buildPreviewInput } from './buildPreviewInput'
import { C, badgeStyle, hintStyle, panelStyle, secondaryButtonStyle } from './tokens'

const STATE_LABEL: Record<AssetUsage['state'], string> = { imported: 'Imported — not used', assigned: 'Assigned — hidden', rendered: 'In the video' }

/**
 * "Which pictures are actually in the video?" Importing only adds a picture to the library; a picture appears
 * in the preview and export only when a visible layer draws it. This panel says so plainly, lists each
 * picture's state, and lets the customer put one on the Product / Service image layer or take it off.
 * Pictures that are not used stay in the library and can be used any time.
 */
export function AssetUsagePanel(): React.JSX.Element | null {
  const ctx = useDemoPersonalize()
  const { assets, previewSettings, updatePreviewLayer } = ctx
  const library = [...(assets.logos ?? []), ...(assets.products ?? [])]
  if (library.length === 0) return null
  const { brand } = buildPreviewInput(ctx)
  const summary = summarizeAssetUsage(library, previewSettings, brand)
  const layerOf = (kind: 'productImage' | 'serviceImage') => previewSettings.layers.find((l) => l.kind === kind)

  const assign = (a: AssetUsage, kind: 'productImage' | 'serviceImage') => {
    const layer = layerOf(kind)
    if (layer) updatePreviewLayer(layer.id, { imageUrl: a.url, visible: true, imageStyle: undefined })
  }
  const remove = (a: AssetUsage) => {
    for (const kind of ['productImage', 'serviceImage'] as const) {
      const layer = layerOf(kind)
      if (layer && (layer.imageUrl === a.url)) updatePreviewLayer(layer.id, { imageUrl: undefined, visible: false })
      else if (layer && a.usedBy.length && !layer.imageUrl) updatePreviewLayer(layer.id, { visible: false })
    }
  }

  return (
    <div data-testid="asset-usage-panel" style={panelStyle}>
      <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
        Your pictures in the video
      </h3>
      <p data-testid="asset-usage-summary" style={{ ...hintStyle, margin: '0 0 10px' }}>
        {summary.total} imported · <strong style={{ color: C.text }}>{summary.rendered} in the video</strong> · {summary.unused} not used.
        Importing a picture does not put it in the video — choose which ones appear.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {summary.items.map((a) => (
          <li key={a.assetId} data-testid={`asset-usage-${a.assetId}`} data-state={a.state} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text }}>
            <img src={a.url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}` }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span style={badgeStyle(a.state === 'rendered' ? 'green' : undefined)}>
              {STATE_LABEL[a.state]}{a.state !== 'imported' && a.auto ? ' · automatic' : ''}{a.usedBy.length ? ` · ${a.usedBy.join(', ')}` : ''}
            </span>
            <button type="button" aria-label={`Use ${a.name} as the product image`} onClick={() => assign(a, 'productImage')} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Product</button>
            <button type="button" aria-label={`Use ${a.name} as the service image`} onClick={() => assign(a, 'serviceImage')} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Service</button>
            {a.state !== 'imported' && (
              <button type="button" aria-label={`Remove ${a.name} from the video`} onClick={() => remove(a)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Remove</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
