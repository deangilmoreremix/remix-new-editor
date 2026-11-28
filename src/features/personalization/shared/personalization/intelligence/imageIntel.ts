/**
 * Asset intelligence: perceptual hashing, sharpness, palette and role heuristics on raw pixels.
 * Pure and offline (no network, no model). `pixelLoader.ts` is the only browser-dependent part.
 * Nothing here deletes or reassigns an asset: it only produces a report the customer reviews.
 */

export interface PixelBuffer { data: ArrayLike<number>; width: number; height: number }

export type AssetRole = 'logo' | 'product' | 'photo' | 'unknown'

export interface PaletteColor { hex: string; share: number }

export interface ImageMetrics {
  /** 128-bit perceptual hash (see `dHash`), 32 hex chars. */
  hash: string
  /** Mean opaque RGB. */
  avg: [number, number, number]
  /** Variance of the Laplacian on a downscaled copy: higher is sharper. */
  sharpness: number
  hasAlpha: boolean
  /** Distinct colour buckets that hold >=1% of the opaque pixels (logos have few). */
  colorCount: number
  palette: PaletteColor[]
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

/** Mean-box downscale of luma to w x h (alpha-aware: transparent pixels count as white). */
function lumaGrid(buf: PixelBuffer, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  const cnt = new Float32Array(w * h)
  const { data, width, height } = buf
  for (let y = 0; y < height; y++) {
    const gy = Math.min(h - 1, Math.floor((y * h) / height))
    for (let x = 0; x < width; x++) {
      const gx = Math.min(w - 1, Math.floor((x * w) / width))
      const i = (y * width + x) * 4
      const a = (data[i + 3] ?? 255) / 255
      const l = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      out[gy * w + gx]! += l * a + 255 * (1 - a)
      cnt[gy * w + gx]! += 1
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i]! > 0 ? out[i]! / cnt[i]! : 255
  return out
}

/**
 * 128-bit perceptual hash: dHash (horizontal gradient direction, 64 bits) + aHash (cell brighter than the mean,
 * 64 bits). dHash alone gives all zeros for smooth or flat pictures, which would make unrelated images look identical.
 * Robust to resizing and mild recompression.
 */
export function dHash(buf: PixelBuffer): string {
  const g = lumaGrid(buf, 9, 8)
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g[y * 9 + x]! > g[y * 9 + x + 1]! + 1 ? '1' : '0'
  const a = lumaGrid(buf, 8, 8)
  const mean = a.reduce((s, v) => s + v, 0) / a.length
  for (let i = 0; i < 64; i++) bits += a[i]! > mean + 1 ? '1' : '0'
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

/** Mean opaque colour, used to keep different flat-colour pictures from being grouped as duplicates. */
export function averageColor(buf: PixelBuffer): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0
  const { data, width, height } = buf
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10000)))
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4
    if ((data[i + 3] ?? 255) < 128) continue
    r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255]
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return a.length * 4
  let d = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)
    while (x) { d += x & 1; x >>= 1 }
  }
  return d
}

/** Variance of the 4-neighbour Laplacian on a luma grid at most 128px wide. */
export function sharpnessScore(buf: PixelBuffer): number {
  const w = Math.min(128, buf.width)
  const h = Math.max(3, Math.round((buf.height * w) / Math.max(1, buf.width)))
  if (w < 3) return 0
  const g = lumaGrid(buf, w, h)
  let sum = 0, sumSq = 0, n = 0
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const v = 4 * g[y * w + x]! - g[y * w + x - 1]! - g[y * w + x + 1]! - g[(y - 1) * w + x]! - g[(y + 1) * w + x]!
    sum += v; sumSq += v * v; n++
  }
  if (!n) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

/** Quantises to 4 bits/channel, merges near buckets, returns the dominant colours (opaque pixels only). */
export function extractPalette(buf: PixelBuffer, count = 5): { palette: PaletteColor[]; colorCount: number; hasAlpha: boolean } {
  const { data, width, height } = buf
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  let opaque = 0
  let hasAlpha = false
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)))
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4
    const a = data[i + 3] ?? 255
    if (a < 250) hasAlpha = true
    if (a < 128) continue
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += r; e.g += g; e.b += b
    buckets.set(key, e)
    opaque++
  }
  if (!opaque) return { palette: [], colorCount: 0, hasAlpha }
  const all = [...buckets.values()].sort((a, b) => b.n - a.n)
  const colorCount = all.filter((e) => e.n / opaque >= 0.01).length
  const picked: { r: number; g: number; b: number; n: number }[] = []
  for (const e of all) {
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n }
    const near = picked.find((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 48)
    if (near) near.n += c.n
    else picked.push(c)
    if (picked.length >= count * 3) break
  }
  picked.sort((a, b) => b.n - a.n)
  return { palette: picked.slice(0, count).map((c) => ({ hex: toHex(c.r, c.g, c.b), share: c.n / opaque })), colorCount, hasAlpha }
}

export function analyzePixels(buf: PixelBuffer): ImageMetrics {
  const { palette, colorCount, hasAlpha } = extractPalette(buf)
  return { hash: dHash(buf), avg: averageColor(buf), sharpness: sharpnessScore(buf), hasAlpha, colorCount, palette }
}

const saturation = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  return mx === 0 ? 0 : (mx - mn) / mx
}
const isNeutral = (hex: string) => saturation(hex) < 0.18

/**
 * Suggested brand palette: primary = most common non-neutral colour, accent = most saturated colour that is
 * clearly different from it, secondary = next distinct. Falls back to neutrals when the images have no colour.
 */
export function suggestBrandPalette(colors: PaletteColor[]): { primary?: string; secondary?: string; accent?: string } {
  const merged: PaletteColor[] = []
  for (const c of colors) {
    const dup = merged.find((m) => hexDistance(m.hex, c.hex) < 40)
    if (dup) dup.share += c.share
    else merged.push({ ...c })
  }
  merged.sort((a, b) => b.share - a.share)
  const chromatic = merged.filter((c) => !isNeutral(c.hex))
  const pool = chromatic.length ? chromatic : merged
  const primary = pool[0]?.hex
  const rest = pool.filter((c) => c.hex !== primary && primary && hexDistance(c.hex, primary) >= 70)
  const accent = [...rest].sort((a, b) => saturation(b.hex) - saturation(a.hex))[0]?.hex
  const secondary = rest.find((c) => c.hex !== accent)?.hex
  return { primary, secondary, accent }
}

export function hexDistance(a: string, b: string): number {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  return Math.hypot(((pa >> 16) & 255) - ((pb >> 16) & 255), ((pa >> 8) & 255) - ((pb >> 8) & 255), (pa & 255) - (pb & 255))
}

export interface RoleInput { width: number; height: number; metrics: ImageMetrics; category?: string }

/** Likely role from measurable cues only. 'unknown' is a valid answer; never a claim about authenticity. */
export function guessRole({ width, height, metrics, category }: RoleInput): AssetRole {
  if (category === 'logo') return 'logo'
  const aspect = width / Math.max(1, height)
  const fewColors = metrics.colorCount <= 6
  if ((metrics.hasAlpha && fewColors) || (fewColors && aspect > 0.4 && aspect < 4 && Math.max(width, height) <= 1200)) return 'logo'
  if (metrics.colorCount >= 12 && aspect > 0.5 && aspect < 2) return 'product'
  if (metrics.colorCount >= 12) return 'photo'
  return 'unknown'
}

export interface AssetInput { id: string; url: string; width: number; height: number; category?: string; metrics: ImageMetrics }

export interface AssetFlag { code: 'blurry' | 'low-resolution' | 'duplicate' | 'extreme-aspect'; message: string }

export interface AssetReportItem {
  id: string
  url: string
  width: number
  height: number
  role: AssetRole
  /** 0-100 suitability for use in a video. */
  score: number
  flags: AssetFlag[]
  /** Id of the better copy when this one is a near-duplicate; the original is never removed. */
  duplicateOf?: string
  palette: PaletteColor[]
}

export interface AssetReport {
  items: AssetReportItem[]
  duplicateGroups: string[][]
  suggestedPalette: { primary?: string; secondary?: string; accent?: string }
  bestByRole: Partial<Record<AssetRole, string>>
  summary: { analyzed: number; duplicates: number; blurry: number; lowRes: number }
}

export const BLUR_THRESHOLD = 40
export const MIN_SIDE = 400

export function groupDuplicates(items: { id: string; hash: string; avg?: [number, number, number] }[], maxDistance = 12): string[][] {
  const parent = new Map(items.map((i) => [i.id, i.id]))
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const ai = items[i]!.avg, aj = items[j]!.avg
    const sameColor = !ai || !aj || Math.hypot(ai[0] - aj[0], ai[1] - aj[1], ai[2] - aj[2]) < 40
    if (sameColor && hammingDistance(items[i]!.hash, items[j]!.hash) <= maxDistance) parent.set(find(items[i]!.id), find(items[j]!.id))
  }
  const groups = new Map<string, string[]>()
  for (const i of items) { const r = find(i.id); groups.set(r, [...(groups.get(r) ?? []), i.id]) }
  return [...groups.values()].filter((g) => g.length > 1)
}

export function suitabilityScore(a: { width: number; height: number; metrics: ImageMetrics; role: AssetRole }): number {
  const side = Math.min(a.width, a.height)
  const res = Math.min(1, side / 800)
  const sharp = a.role === 'logo' && a.metrics.colorCount <= 6 ? 1 : Math.min(1, a.metrics.sharpness / 300)
  const aspect = a.width / Math.max(1, a.height)
  const shape = aspect > 0.25 && aspect < 4 ? 1 : 0.4
  const alpha = a.role === 'logo' && a.metrics.hasAlpha ? 1 : a.role === 'logo' ? 0.8 : 1
  return Math.round(100 * (0.4 * res + 0.35 * sharp + 0.15 * shape + 0.1 * alpha))
}

export function buildAssetReport(inputs: AssetInput[]): AssetReport {
  const roles = new Map(inputs.map((a) => [a.id, guessRole(a)]))
  const scored = inputs.map((a) => ({ a, role: roles.get(a.id)!, score: suitabilityScore({ ...a, role: roles.get(a.id)! }) }))
  const groups = groupDuplicates(inputs.map((a) => ({ id: a.id, hash: a.metrics.hash, avg: a.metrics.avg })))
  const best = new Map<string, string>()
  for (const g of groups) {
    const keep = [...g].sort((x, y) => {
      const sx = scored.find((s) => s.a.id === x)!, sy = scored.find((s) => s.a.id === y)!
      return (sy.a.width * sy.a.height) - (sx.a.width * sx.a.height) || sy.score - sx.score
    })[0]!
    for (const id of g) if (id !== keep) best.set(id, keep)
  }
  const items: AssetReportItem[] = scored.map(({ a, role, score }) => {
    const flags: AssetFlag[] = []
    const isVector = a.url.startsWith('data:image/svg') || /\.svg(\?|$)/i.test(a.url)
    if (!isVector && Math.min(a.width, a.height) < MIN_SIDE) flags.push({ code: 'low-resolution', message: `Only ${a.width}×${a.height}px: may look soft on a full-screen video.` })
    if (!isVector && a.metrics.sharpness < BLUR_THRESHOLD && a.metrics.colorCount > 6) flags.push({ code: 'blurry', message: 'Looks blurry. Sharpening cannot restore lost detail; prefer a sharper source.' })
    const asp = a.width / Math.max(1, a.height)
    if (asp > 4 || asp < 0.25) flags.push({ code: 'extreme-aspect', message: 'Very wide or tall: needs a crop to fit.' })
    if (best.has(a.id)) flags.push({ code: 'duplicate', message: 'Near-duplicate of a larger or sharper copy. Nothing is deleted.' })
    return { id: a.id, url: a.url, width: a.width, height: a.height, role, score, flags, duplicateOf: best.get(a.id), palette: a.metrics.palette }
  })
  const bestByRole: AssetReport['bestByRole'] = {}
  for (const it of items) {
    if (it.duplicateOf || it.role === 'unknown') continue
    const cur = bestByRole[it.role] && items.find((x) => x.id === bestByRole[it.role])
    if (!cur || it.score > cur.score) bestByRole[it.role] = it.id
  }
  const logoColors = items.filter((i) => i.role === 'logo').flatMap((i) => i.palette)
  const suggestedPalette = suggestBrandPalette(logoColors.length ? logoColors : items.flatMap((i) => i.palette))
  return {
    items: items.sort((a, b) => b.score - a.score),
    duplicateGroups: groups,
    suggestedPalette,
    bestByRole,
    summary: {
      analyzed: items.length,
      duplicates: best.size,
      blurry: items.filter((i) => i.flags.some((f) => f.code === 'blurry')).length,
      lowRes: items.filter((i) => i.flags.some((f) => f.code === 'low-resolution')).length,
    },
  }
}
