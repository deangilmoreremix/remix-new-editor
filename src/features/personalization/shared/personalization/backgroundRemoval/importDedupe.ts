import type { DiscoveredAsset, PersonalizationAsset } from '../types'

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$)/i

/** A website image address reduced to what identifies the picture (no hash, tracking params or trailing slash). */
export function normalizeImageAddress(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  if (/^(data|blob):/i.test(url)) return null
  try {
    const parsed = new URL(url.trim())
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key)
    }
    parsed.searchParams.sort()
    const out = parsed.toString()
    return out.endsWith('/') ? out.slice(0, -1) : out
  } catch {
    return null
  }
}

type LibraryEntry = Pick<PersonalizationAsset, 'url' | 'uploadedUrl' | 'originalUrl' | 'editedDataUrl' | 'edited'>

const hasCutout = (a: { editedDataUrl?: string; editMetadata?: { engine?: string } | null }) =>
  Boolean(a.editedDataUrl)

/**
 * Discovered images that are already in the library (same website picture) and must not be added again.
 * A cutout of a picture whose library copy is still the untouched original is NOT a repeat: both are kept.
 * Two items of the same picture within one import keep only the first (per kind: original / cutout).
 */
export function findAlreadyImported(
  items: Array<Pick<DiscoveredAsset, 'id' | 'previewUrl' | 'originalPreviewUrl' | 'editedDataUrl'>>,
  library: LibraryEntry[],
): Set<string> {
  const seen = new Map<string, Set<'original' | 'cutout'>>()
  const mark = (address: string | null, kind: 'original' | 'cutout') => {
    if (!address) return
    const kinds = seen.get(address) || new Set()
    kinds.add(kind)
    seen.set(address, kinds)
  }
  for (const entry of library) {
    const kind = entry.editedDataUrl || entry.edited ? 'cutout' : 'original'
    mark(normalizeImageAddress(entry.originalUrl), kind)
    mark(normalizeImageAddress(entry.url), kind)
    mark(normalizeImageAddress(entry.uploadedUrl), kind)
  }
  const skip = new Set<string>()
  for (const item of items) {
    const address = normalizeImageAddress(item.originalPreviewUrl || item.previewUrl)
    if (!address) continue
    const kind = hasCutout(item) ? 'cutout' : 'original'
    if (seen.get(address)?.has(kind)) skip.add(item.id)
    else mark(address, kind)
  }
  return skip
}
