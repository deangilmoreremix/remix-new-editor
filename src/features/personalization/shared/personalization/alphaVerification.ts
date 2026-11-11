/**
 * Client-side alpha channel verification for Personalization edited images.
 *
 * These utilities verify programmatically that transparent pixels are
 * preserved in edited images before and after persistence.
 *
 * A checkerboard UI is not proof; a white background is not transparency.
 * These utilities inspect the actual decoded pixel data.
 */

export interface AlphaVerificationResult {
  formatSupportsAlpha: boolean
  hasTransparentPixels: boolean
  hasAlphaChannel: boolean
  transparentPixelCount: number
  totalPixelCount: number
  transparentRatio: number
  transparencyMismatch: boolean
}

const MAX_VERIFICATION_BYTES = 20 * 1024 * 1024

/**
 * Verify that an image data URL has a real alpha channel with preserved transparency.
 *
 * Decodes the image and counts pixels with alpha < 255.
 */
export async function verifyAlphaChannel(dataUrl: string): Promise<AlphaVerificationResult> {
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) {
    return {
      formatSupportsAlpha: false,
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }

  if (blob.size > MAX_VERIFICATION_BYTES) {
    return {
      formatSupportsAlpha: blob.type === 'image/png' || blob.type === 'image/webp',
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }

  const formatSupportsAlpha = blob.type === 'image/png' || blob.type === 'image/webp'

  if (!formatSupportsAlpha) {
    return {
      formatSupportsAlpha: false,
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const width = bitmap.width
    const height = bitmap.height
    const totalPixels = width * height

    if (totalPixels === 0) {
      bitmap.close()
      return {
        formatSupportsAlpha: true,
        hasTransparentPixels: false,
        hasAlphaChannel: false,
        transparentPixelCount: 0,
        totalPixelCount: 0,
        transparentRatio: 0,
        transparencyMismatch: false,
      }
    }

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return {
        formatSupportsAlpha: true,
        hasTransparentPixels: false,
        hasAlphaChannel: false,
        transparentPixelCount: 0,
        totalPixelCount: 0,
        transparentRatio: 0,
        transparencyMismatch: false,
      }
    }

    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, width, height)
    bitmap.close()

    const data = imageData.data
    let transparentCount = 0
    let hasAlphaChannel = false

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha < 255) {
        transparentCount++
        hasAlphaChannel = true
      }
    }

    return {
      formatSupportsAlpha: true,
      hasTransparentPixels: transparentCount > 0,
      hasAlphaChannel,
      transparentPixelCount: transparentCount,
      totalPixelCount: totalPixels,
      transparentRatio: transparentCount / totalPixels,
      transparencyMismatch: false,
    }
  } catch {
    return {
      formatSupportsAlpha: true,
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }
}

/**
 * Verify that a canvas element has preserved alpha transparency.
 */
export async function verifyAlphaChannelCanvas(canvas: HTMLCanvasElement): Promise<AlphaVerificationResult> {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      formatSupportsAlpha: true,
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }

  const width = canvas.width
  const height = canvas.height
  const totalPixels = width * height

  if (totalPixels === 0) {
    return {
      formatSupportsAlpha: true,
      hasTransparentPixels: false,
      hasAlphaChannel: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      transparentRatio: 0,
      transparencyMismatch: false,
    }
  }

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  let transparentCount = 0
  let hasAlphaChannel = false

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 255) {
      transparentCount++
      hasAlphaChannel = true
    }
  }

  return {
    formatSupportsAlpha: true,
    hasTransparentPixels: transparentCount > 0,
    hasAlphaChannel,
    transparentPixelCount: transparentCount,
    totalPixelCount: totalPixels,
    transparentRatio: transparentCount / totalPixels,
    transparencyMismatch: false,
  }
}

/**
 * Get the MIME type that preserves alpha for a given format and transparency requirement.
 */
export function getAlphaPreservingMimeType(format: string, transparent: boolean): string {
  if (transparent) {
    if (format === 'jpeg') return 'image/png'
    if (format === 'webp') return 'image/webp'
    return 'image/png'
  }
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/**
 * Assert that an alpha verification result meets the expected transparency level.
 */
export function assertAlphaPreserved(result: AlphaVerificationResult, expectedTransparent: boolean): void {
  if (!result.formatSupportsAlpha && expectedTransparent) {
    throw new Error('Output format does not support alpha channel but transparency was requested')
  }
  if (expectedTransparent && !result.hasAlphaChannel) {
    throw new Error('Alpha channel was requested but is not present in the output image')
  }
  if (expectedTransparent && result.transparentPixelCount === 0) {
    throw new Error('Transparency was requested but no transparent pixels were found in the output image')
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',')
    const header = parts[0] || ''
    const base64 = parts[1] || ''
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}
