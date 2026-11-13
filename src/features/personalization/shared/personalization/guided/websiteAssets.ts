/**
 * Helpers for the website-background panel that are independent of React and the network, so they are unit-tested:
 * assigning a captured picture to a video role, and explaining why a capture failed.
 */
import { isDurableHttpUrl, normalizeWebsiteBackground, type WebsiteBackground } from '../preview/websiteBackground'
import type { PersonalizationPreviewSettings, PreviewLayer, PreviewLayerKind } from '../preview/types'

export type AssetRole = 'logo' | 'product' | 'service'

export const ASSET_ROLE_LAYER: Record<AssetRole, PreviewLayerKind> = {
  logo: 'logo',
  product: 'productImage',
  service: 'serviceImage',
}

export const ASSET_ROLE_LABEL: Record<AssetRole, string> = {
  logo: 'Logo',
  product: 'Product image',
  service: 'Service image',
}

/**
 * Puts a captured picture on the first layer of the role's kind. The picture's own URL is used as-is (nothing is copied or
 * re-hosted here). Refuses non-durable URLs (blob:/data:/relative) because they would not survive a reload, and refuses a
 * role the project has no layer for, so the caller can say so instead of silently doing nothing.
 */
export function assignAssetToRole(
  settings: PersonalizationPreviewSettings,
  role: AssetRole,
  url: string,
): { settings: PersonalizationPreviewSettings; assigned: boolean; reason?: 'bad-url' | 'no-layer' } {
  if (!isDurableHttpUrl(url)) return { settings, assigned: false, reason: 'bad-url' }
  const kind = ASSET_ROLE_LAYER[role]
  const index = settings.layers.findIndex((l) => l.kind === kind)
  if (index < 0) return { settings, assigned: false, reason: 'no-layer' }
  const layers = settings.layers.map((l, i): PreviewLayer =>
    i === index ? { ...l, imageUrl: url, visible: true } : l,
  )
  return { settings: { ...settings, layers }, assigned: true }
}

export interface CaptureErrorLike {
  code?: string
  status?: number
  message?: string
}

/** A plain-language reason for a failed capture (sign-in, plan, quota, refused address, timeout, anything else). */
export function describeCaptureError(error: unknown): string {
  const e = (error ?? {}) as CaptureErrorLike
  const code = String(e.code ?? '')
  const status = Number(e.status ?? 0)
  if (code === 'CANCELLED') return 'Capture stopped.'
  if (code === 'UNAUTHENTICATED' || status === 401) return 'Sign in to capture a website.'
  if (status === 403 || /ENTITLEMENT|FORBIDDEN/i.test(code)) return 'Capturing websites is part of the SmartVideo GO plan, which this account does not have.'
  if (status === 429 || /RATE/i.test(code)) return 'You have captured a lot of pages in a short time. Wait a few minutes and try again.'
  if (code === 'URL_REJECTED') return 'That address cannot be captured. Use a public http(s) page (private or internal addresses are refused for safety).'
  if (code === 'BAD_REQUEST') return 'Enter the website address to capture.'
  if (code === 'TIMEOUT' || status === 408) return 'The website took too long to capture. Try again, or try a lighter page.'
  if (code === 'CAPTURE_FAILED' || code === 'CAPTURE_STOPPED') return 'The page could not be captured. It may block automated visits.'
  const message = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : ''
  return message ? `Capture failed: ${message}` : 'Capture failed. Try again.'
}

/** What the customer is told about where a picture came from and their duty to have the right to use it. */
export function attributionText(siteUrl: string, capturedAt: string): string {
  let host = ''
  try { host = new URL(siteUrl).host } catch { /* shown without a host */ }
  const when = capturedAt ? new Date(capturedAt) : null
  const date = when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : ''
  return `Captured from ${host || 'the website'}${date ? ` on ${date}` : ''}. The pictures belong to that site's owner: use them only with permission.`
}

/**
 * Applies a partial change to the project's website background through the full normalizer (so ranges, ordering and URL rules
 * always hold). Returns the same object when there is no background or the result would be invalid.
 */
export function patchWebsiteBackground(
  settings: PersonalizationPreviewSettings,
  patch: Partial<Omit<WebsiteBackground, 'cursor'>> & { cursor?: Partial<WebsiteBackground['cursor']> },
): PersonalizationPreviewSettings {
  const current = settings.websiteBackground
  if (!current) return settings
  const next = normalizeWebsiteBackground({ ...current, ...patch, cursor: { ...current.cursor, ...(patch.cursor ?? {}) } })
  return next ? { ...settings, websiteBackground: next } : settings
}
