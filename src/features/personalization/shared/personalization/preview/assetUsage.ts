/**
 * Where each imported picture stands: imported → assigned → rendered.
 *
 *  - imported : in the client's asset library only. NOTHING is drawn for it.
 *  - assigned : set as the logo, or as a layer's picture (explicitly), or filled into a
 *               product/service layer by the AUTOMATIC fallback (first library pictures) — marked `auto`.
 *  - rendered : assigned AND a visible layer that draws it (so it appears in the preview and the export).
 *
 * Pure (no React): the summary the customer sees and the tests share one definition, so the UI can never
 * imply that "25 pictures" appear when only the few that a layer draws do.
 */
import type { PersonalizationAsset } from '../types'
import type { PreviewInputProps, PreviewLayer, PersonalizationPreviewSettings } from './types'
import { resolveLayerImageUrl } from './layerContent'

export type AssetUsageState = 'imported' | 'assigned' | 'rendered'

export interface AssetUsage {
  assetId: string
  name: string
  url: string
  state: AssetUsageState
  /** Where it is drawn, e.g. "Logo", "Product image". */
  usedBy: string[]
  /** Assigned only by the automatic fallback (library order), not by the customer. */
  auto: boolean
}

export interface AssetUsageSummary {
  total: number
  imported: number
  assigned: number
  rendered: number
  /** Not drawn anywhere (imported or assigned-but-hidden). */
  unused: number
  items: AssetUsage[]
}

const IMAGE_KINDS = new Set(['logo', 'productImage', 'serviceImage'])
const KIND_LABEL: Record<string, string> = { logo: 'Logo', productImage: 'Product image', serviceImage: 'Service image' }

const urlOf = (a: PersonalizationAsset) => (a.uploadedUrl || a.url || '').trim()

export function summarizeAssetUsage(
  library: PersonalizationAsset[],
  settings: Pick<PersonalizationPreviewSettings, 'layers'>,
  brand: PreviewInputProps['brand'],
): AssetUsageSummary {
  const drawn = new Map<string, { labels: Set<string>; visibleLabels: Set<string>; explicit: boolean }>()
  const note = (url: string, label: string, visible: boolean, explicit: boolean) => {
    if (!url) return
    const e = drawn.get(url) ?? { labels: new Set<string>(), visibleLabels: new Set<string>(), explicit: false }
    e.labels.add(label)
    if (visible) e.visibleLabels.add(label)
    if (explicit) e.explicit = true
    drawn.set(url, e)
  }
  for (const layer of settings.layers as PreviewLayer[]) {
    if (!IMAGE_KINDS.has(layer.kind)) continue
    const label = KIND_LABEL[layer.kind]
    note(resolveLayerImageUrl(layer, brand), label, layer.visible, Boolean(layer.imageUrl))
    // extra pictures of a collage
    for (const u of layer.imageUrls ?? []) note(u, `${label} (collage)`, layer.visible, true)
  }

  const items: AssetUsage[] = library.map((asset) => {
    const url = urlOf(asset)
    const entry = drawn.get(url) ?? drawn.get((asset.url || '').trim())
    if (!entry) return { assetId: asset.id, name: asset.name, url, state: 'imported', usedBy: [], auto: false }
    const rendered = entry.visibleLabels.size > 0
    return {
      assetId: asset.id, name: asset.name, url,
      state: rendered ? 'rendered' : 'assigned',
      usedBy: [...(rendered ? entry.visibleLabels : entry.labels)],
      auto: !entry.explicit,
    }
  })
  const count = (s: AssetUsageState) => items.filter((i) => i.state === s).length
  return {
    total: items.length,
    imported: count('imported'),
    assigned: count('assigned'),
    rendered: count('rendered'),
    unused: items.filter((i) => i.state !== 'rendered').length,
    items,
  }
}
