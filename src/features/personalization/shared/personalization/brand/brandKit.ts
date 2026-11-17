/**
 * Brand kit: turns the colours found on the customer's site into one consistent look for the whole overlay.
 * Pure and offline: the palette comes from research the studio already ran, the readability maths from
 * `colorMath`. Nothing here fetches anything.
 */
import { autoTextColor, contrastBetween, parseHex } from '../guided/editor/colorMath'
import { worstCaseBackdrop } from '../preview/placement/a11y'
import type { PersonalizationPreviewSettings, PreviewBrandColors, PreviewLayer } from '../preview/types'

export interface BrandKitSource {
  primary?: string
  accent?: string
  palette?: string[]
}

export interface BrandKit {
  /** Every distinct colour found, `#rrggbb`, in the order the site listed them. */
  palette: string[]
  primary: string
  accent: string
  text: string
}

export interface BrandKitApplication {
  brandColors: Partial<PreviewBrandColors>
  layerPatches: { layerId: string; patch: Partial<PreviewLayer> }[]
}

const TEXT_KINDS: ReadonlySet<PreviewLayer['kind']> = new Set(['businessName', 'headline', 'tagline', 'offer'])
/** An accent this close to the primary reads as the same colour; look for a more distinct one. */
const MIN_ACCENT_DISTANCE = 1.4

function distinct(list: (string | undefined)[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const hex = parseHex(raw)
    if (hex && !out.includes(hex)) out.push(hex)
  }
  return out
}

/**
 * The kit for a site, or null when it found no usable colour (so the button is not offered).
 * `backgroundDim` decides the text colour: it must read on the brightest footage the dim can leave.
 */
export function buildBrandKit(source: BrandKitSource | undefined | null, backgroundDim: number): BrandKit | null {
  if (!source) return null
  const palette = distinct([source.primary, source.accent, ...(source.palette ?? [])])
  if (palette.length === 0) return null
  const primary = parseHex(source.primary) ?? palette[0]
  let accent = parseHex(source.accent)
  if (!accent || contrastBetween(accent, primary) < MIN_ACCENT_DISTANCE) {
    // The most distinct other colour from the palette, else keep the primary (a one-colour brand).
    const others = palette.filter((c) => c !== primary)
    accent = others.sort((a, b) => contrastBetween(b, primary) - contrastBetween(a, primary))[0] ?? primary
  }
  return { palette, primary, accent, text: autoTextColor(worstCaseBackdrop(backgroundDim)) }
}

/**
 * What applying the kit changes: the three brand colours, plus the colour of any layer the customer had
 * given an explicit colour (those would otherwise ignore the brand). Locked layers are left alone.
 */
export function applyBrandKit(kit: BrandKit, settings: PersonalizationPreviewSettings): BrandKitApplication {
  const layerPatches: BrandKitApplication['layerPatches'] = []
  for (const layer of settings.layers) {
    if (layer.locked || !layer.color) continue
    if (layer.kind === 'cta') layerPatches.push({ layerId: layer.id, patch: { color: kit.accent } })
    // A design with an explicit colour draws it (e.g. text designs), so it follows the kit like the plain text layers.
    else if (TEXT_KINDS.has(layer.kind) || layer.kind === 'design') layerPatches.push({ layerId: layer.id, patch: { color: kit.text } })
  }
  return { brandColors: { primary: kit.primary, accent: kit.accent, text: kit.text }, layerPatches }
}

/**
 * True when applying the kit would change nothing: the brand colours already match AND no layer with an explicit
 * colour differs from the colour the kit would give it. A layer the customer recoloured afterwards keeps the
 * button available, so the kit can be re-applied to bring it back in line.
 */
export function isBrandKitApplied(kit: BrandKit, settings: Pick<PersonalizationPreviewSettings, 'brandColors' | 'layers'>): boolean {
  const c = settings.brandColors
  if (!(parseHex(c.primary) === kit.primary && parseHex(c.accent) === kit.accent && parseHex(c.text) === kit.text)) return false
  return applyBrandKit(kit, settings as PersonalizationPreviewSettings).layerPatches.every(({ layerId, patch }) => {
    const layer = settings.layers.find((l) => l.id === layerId)
    return parseHex(layer?.color) === parseHex(patch.color)
  })
}
