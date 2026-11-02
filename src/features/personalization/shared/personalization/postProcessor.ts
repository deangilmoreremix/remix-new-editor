/**
 * Post-Processing Service for Personalization
 *
 * Handles deterministic post-generation compositing:
 * - Exact logo overlay on images and videos
 * - Exact CTA/end-card generation and compositing
 *
 * Image overlays (logo / CTA end card) are composited deterministically on a
 * canvas and returned as PNG data URLs, so branding is pixel-exact and needs no
 * round-trip. MuAPI add-image-watermark is only used as a fallback when canvas
 * compositing is unavailable.
 *
 * Video overlays go through the MuAPI add-video-watermark endpoint, which
 * requires a remotely reachable watermark URL, so canvas output is uploaded
 * before it is submitted.
 *
 * For CTA end cards requiring exact text, generates a deterministic canvas
 * image as a PNG data URL and composites it onto the generated media.
 */

import { generateI2I, uploadFile } from '@ohb/packages/studio/src/muapi'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PostProcessingInput {
  generatedUrl: string
  type: 'image' | 'video'
  postProcessing: Record<string, unknown>
  apiKey: string
}

export interface PostProcessingResult {
  finalUrl: string | null
  originalUrl: string
  applied: string[]
  failed?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function overlayOrigin(
  position: string,
  canvasWidth: number,
  canvasHeight: number,
  overlayWidth: number,
  overlayHeight: number,
  margin: number,
): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: canvasWidth - overlayWidth - margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: canvasHeight - overlayHeight - margin }
    case 'center':
      return { x: (canvasWidth - overlayWidth) / 2, y: (canvasHeight - overlayHeight) / 2 }
    default:
      return {
        x: canvasWidth - overlayWidth - margin,
        y: canvasHeight - overlayHeight - margin,
      }
  }
}

// ── Canvas Overlay Compositing ───────────────────────────────────────────────

async function compositeImageOverlay(
  baseUrl: string,
  overlayUrl: string,
  position = 'bottom-right',
  opacity = 0.8,
  scale = 0.2,
): Promise<string | null> {
  if (!isBrowser()) return null

  try {
    const [base, overlay] = await Promise.all([
      loadImageElement(baseUrl),
      loadImageElement(overlayUrl),
    ])

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const width = base.naturalWidth || base.width || 1
    const height = base.naturalHeight || base.height || 1
    canvas.width = width
    canvas.height = height
    ctx.drawImage(base, 0, 0, width, height)

    const overlayWidth = Math.max(1, Math.round(width * scale))
    const sourceWidth = overlay.naturalWidth || overlay.width || overlayWidth
    const sourceHeight = overlay.naturalHeight || overlay.height || sourceWidth
    const overlayHeight = Math.max(
      1,
      Math.round((sourceHeight / Math.max(1, sourceWidth)) * overlayWidth),
    )
    const margin = Math.max(8, Math.round(width * 0.02))
    const { x, y } = overlayOrigin(position, width, height, overlayWidth, overlayHeight, margin)

    ctx.globalAlpha = Math.min(1, Math.max(0, opacity))
    ctx.drawImage(overlay, x, y, overlayWidth, overlayHeight)
    ctx.globalAlpha = 1

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('[Personalization Post-Process] Canvas compositing failed:', error)
    return null
  }
}

// ── Canvas End Card Generation ───────────────────────────────────────────────

/**
 * A logo linked by its website address is read through the same-origin
 * download route: drawing the remote image directly would taint the canvas
 * and make the end card impossible to export.
 */
async function logoDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const res = await fetch('/api/personalization/download-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ urls: [url] }),
    // A hung download must not stall generation: the caller draws the end
    // card without the logo instead.
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json().catch(() => ({}))
  const result = data?.results?.[0]
  if (!res.ok || !result?.ok || typeof result.dataUrl !== 'string') throw new Error('Logo could not be downloaded')
  return result.dataUrl
}

export async function generateEndCardImage(
  client: Record<string, unknown> | undefined,
  logo?: File | string | null,
  apiKey?: string,
): Promise<string | null> {
  if (!isBrowser()) return null
  if (!apiKey) return null

  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Premium dark background
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  bg.addColorStop(0, '#0a0a0a')
  bg.addColorStop(0.5, '#131313')
  bg.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Top accent line
  ctx.fillStyle = '#d9ff00'
  ctx.fillRect(0, 0, canvas.width, 4)

  // Bottom accent line
  ctx.fillStyle = '#d9ff00'
  ctx.fillRect(0, canvas.height - 4, canvas.width, 4)

  // Logo (top-right, max 100px height)
  if (logo) {
    try {
      const objectUrl = typeof logo === 'string' ? null : URL.createObjectURL(logo)
      const logoUrl = objectUrl ?? (await logoDataUrl(logo as string))
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load logo'))
        img.src = logoUrl
      })
      const maxHeight = 100
      const scale = Math.min(1, maxHeight / Math.max(1, img.height))
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, canvas.width - w - 40, 40, w, h)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    } catch {
      // Logo load failed — continue without it
    }
  }

  // Business Name
  const businessName = (client?.businessName as string) || ''
  if (businessName) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(businessName, canvas.width / 2, 260)
  }

  // CTA Headline
  const ctaHeadline = (client?.ctaHeadline as string) || ''
  if (ctaHeadline) {
    ctx.fillStyle = '#d9ff00'
    ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ctaHeadline, canvas.width / 2, 360)
  }

  // Offer
  const offer = (client?.offer as string) || ''
  if (offer) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(offer, canvas.width / 2, 430)
  }

  // Button / Action text
  const buttonText = (client?.callToAction as string) || ctaHeadline || ''
  if (buttonText) {
    const btnWidth = 340
    const btnHeight = 60
    const btnX = (canvas.width - btnWidth) / 2
    const btnY = 500

    ctx.fillStyle = '#d9ff00'
    ctx.beginPath()
    const r = 12
    ctx.moveTo(btnX + r, btnY)
    ctx.lineTo(btnX + btnWidth - r, btnY)
    ctx.quadraticCurveTo(btnX + btnWidth, btnY, btnX + btnWidth, btnY + r)
    ctx.lineTo(btnX + btnWidth, btnY + btnHeight - r)
    ctx.quadraticCurveTo(btnX + btnWidth, btnY + btnHeight, btnX + btnWidth - r, btnY + btnHeight)
    ctx.lineTo(btnX + r, btnY + btnHeight)
    ctx.quadraticCurveTo(btnX, btnY + btnHeight, btnX, btnY + btnHeight - r)
    ctx.lineTo(btnX, btnY + r)
    ctx.quadraticCurveTo(btnX, btnY, btnX + r, btnY)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#000000'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(buttonText, canvas.width / 2, btnY + btnHeight / 2)
    ctx.textBaseline = 'alphabetic'
  }

  // Phone + Website
  const parts = [client?.phone, client?.website].filter(Boolean)
  if (parts.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(parts.join('  |  '), canvas.width / 2, 620)
  }

  // Deterministic output: the rendered canvas as a PNG data URL.
  try {
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('[Personalization Post-Process] End card export failed:', error)
    return null
  }
}

// ── MuAPI Post-Processing Calls ──────────────────────────────────────────────

async function applyImageWatermark(
  apiKey: string,
  imageUrl: string,
  watermarkUrl: string,
  position = 'bottom-right',
  opacity = 0.8,
  scale = 0.2,
): Promise<string | null> {
  // Deterministic client-side compositing — exact placement, no round-trip.
  const composited = await compositeImageOverlay(imageUrl, watermarkUrl, position, opacity, scale)
  if (composited) return composited

  // Fallback to server-side compositing when canvas compositing is unavailable
  // (no 2d context, or the base image taints the canvas via cross-origin pixels).
  try {
    const result = (await generateI2I(apiKey, {
      model: 'add-image-watermark',
      prompt: '',
      image_url: imageUrl,
      watermark_image_url: watermarkUrl,
      position,
      opacity,
      scale,
    })) as any
    return result?.url || result?.output?.url || result?.outputs?.[0] || null
  } catch (error) {
    console.error('[Personalization Post-Process] Image watermark failed:', error)
    return null
  }
}

async function applyVideoWatermark(
  apiKey: string,
  videoUrl: string,
  watermarkUrl: string,
): Promise<string | null> {
  try {
    const { processV2V } = await import('@ohb/packages/studio/src/muapi')
    const result = await processV2V(apiKey, {
      model: 'add-video-watermark',
      video_url: videoUrl,
      image_url: watermarkUrl,
    })
    return (result as any).url || (result as any).output?.url || (result as any).outputs?.[0] || null
  } catch (error) {
    console.error('[Personalization Post-Process] Video watermark failed:', error)
    return null
  }
}

// MuAPI endpoints require a remotely reachable watermark URL. Canvas output is
// a data URL, so upload it before submitting.
async function resolveWatermarkUrl(apiKey: string, url: string): Promise<string | null> {
  if (!url.startsWith('data:')) return url

  try {
    const blob = await (await fetch(url)).blob()
    const uploaded = await uploadFile(
      apiKey,
      new File([blob], 'watermark.png', { type: blob.type || 'image/png' }),
    )
    return uploaded || null
  } catch (error) {
    console.error('[Personalization Post-Process] Watermark upload failed:', error)
    return null
  }
}

// ── Main Post-Processing Entry ───────────────────────────────────────────────

export async function applyPostProcessing(
  input: PostProcessingInput,
): Promise<PostProcessingResult> {
  const { generatedUrl, type, postProcessing, apiKey } = input
  const applied: string[] = []
  let currentUrl = generatedUrl

  const logoUrl = postProcessing.logo as string | undefined
  const endCardUrl = postProcessing.endCard as string | undefined
  const ctaGraphicUrl = postProcessing.ctaGraphic as string | undefined

  // ── Image post-processing ──────────────────────────────────────────────────

  if (type === 'image') {
    // Logo overlay via MuAPI add-image-watermark
    const watermarkSource = logoUrl || ctaGraphicUrl
    if (watermarkSource) {
      const result = await applyImageWatermark(
        apiKey,
        currentUrl,
        watermarkSource,
        'bottom-right',
        0.8,
        0.2,
      )
      if (result) {
        currentUrl = result
        applied.push('logo-overlay')
      } else {
        return {
          finalUrl: currentUrl,
          originalUrl: generatedUrl,
          applied,
          failed: 'logo-overlay',
        }
      }
    }

    // End card overlay for CTA (if endCardUrl is provided and differs from logo)
    if (endCardUrl && endCardUrl !== logoUrl && endCardUrl !== ctaGraphicUrl) {
      const result = await applyImageWatermark(
        apiKey,
        currentUrl,
        endCardUrl,
        'bottom-right',
        1.0,
        0.5,
      )
      if (result) {
        currentUrl = result
        applied.push('end-card-overlay')
      } else {
        return {
          finalUrl: currentUrl,
          originalUrl: generatedUrl,
          applied,
          failed: 'end-card-overlay',
        }
      }
    }
  }

  // ── Video post-processing ──────────────────────────────────────────────────

  if (type === 'video') {
    // Collect watermark sources: logo + CTA graphic + end card
    const watermarkSources = [logoUrl, ctaGraphicUrl, endCardUrl].filter(Boolean) as string[]

    for (const wmUrl of watermarkSources) {
      const watermarkUrl = await resolveWatermarkUrl(apiKey, wmUrl)
      if (!watermarkUrl) {
        return {
          finalUrl: currentUrl,
          originalUrl: generatedUrl,
          applied,
          failed: 'video-overlay',
        }
      }

      const result = await applyVideoWatermark(apiKey, currentUrl, watermarkUrl)
      if (result) {
        currentUrl = result
        applied.push('video-overlay')
      } else {
        return {
          finalUrl: currentUrl,
          originalUrl: generatedUrl,
          applied,
          failed: 'video-overlay',
        }
      }
    }
  }

  return {
    finalUrl: currentUrl,
    originalUrl: generatedUrl,
    applied,
  }
}
