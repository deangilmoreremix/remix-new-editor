function getSupabaseUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_SUPABASE_URL
  }
  return undefined
}

const SUPABASE_URL = getSupabaseUrl()

async function postToEdgeFunction(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Thumbnail service error: ${response.status}`)
  }

  return response.json() as Promise<Record<string, unknown>>
}

export type ThumbnailQuality = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ThumbnailComplexity = 'low' | 'medium' | 'high'

/** Optional OpenAI image controls shared by generate and refine. */
export interface ThumbnailImageControls {
  /** Composition planning; only sent for Images 2.6 models. */
  complexity?: ThumbnailComplexity
  /** 'WxH' in pixels (multiples of 16); overrides the aspect-ratio derived size. */
  size?: string
  background?: 'transparent' | 'opaque' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number
}

function imageControlFields(params: ThumbnailImageControls): Record<string, unknown> {
  return {
    ...(params.complexity ? { complexity: params.complexity } : {}),
    ...(params.size ? { size: params.size } : {}),
    ...(params.background ? { background: params.background } : {}),
    ...(params.outputFormat ? { output_format: params.outputFormat } : {}),
    ...(params.outputCompression !== undefined ? { output_compression: params.outputCompression } : {}),
  }
}

export interface ThumbnailGenerateParams extends ThumbnailImageControls {
  prompt: string
  model?: string
  aspectRatio?: string
  n?: number
  imageUrl?: string
  strength?: number
  headline?: string
  subheadline?: string
  templateId?: string
  templateValues?: Record<string, any>
  referenceUrls?: string[]
  style?: string
  quality?: ThumbnailQuality
}

export interface ThumbnailGenerateResult {
  url: string
  responseId?: string
  revisedPrompt?: string
  templateId?: string
  aspectRatio?: string
  model?: string
  fallbackFrom?: string
}

export interface ThumbnailRefineParams extends ThumbnailImageControls {
  imageUrl: string
  prompt: string
  model?: string
  aspectRatio?: string
  n?: number
  strength?: number
  quality?: ThumbnailQuality
  /** PNG data URL; transparent pixels mark the region to repaint (inpainting). */
  maskUrl?: string
}

export interface ThumbnailRefineResult {
  url: string
  responseId?: string
  revisedPrompt?: string
  /** Model that actually produced the image (may differ from the one asked for). */
  model?: string
  /** Set when the requested model was unavailable and GPT Image 2 was used instead. */
  fallbackFrom?: string
}

/**
 * Generate thumbnail(s) via the server-side proxy.
 * The client never receives or persists raw API keys.
 */
export async function generateThumbnail(params: ThumbnailGenerateParams): Promise<ThumbnailGenerateResult[]> {
  const body: Record<string, unknown> = {
    action: 'generate',
    prompt: params.prompt,
    model: params.model || 'gpt-image-2',
    aspect_ratio: params.aspectRatio || '16:9',
    n: Math.min(Math.max(params.n || 1, 1), 4),
    headline: params.headline || '',
    subheadline: params.subheadline || '',
    style: params.style || 'vibrant',
    quality: params.quality || 'medium',
    ...(params.templateId ? { template_id: params.templateId, template_values: params.templateValues || {} } : {}),
    ...(params.referenceUrls?.length ? { reference_urls: params.referenceUrls } : {}),
    ...imageControlFields(params),
  }

  if (params.imageUrl) {
    body.image_url = params.imageUrl
    body.strength = params.strength ?? 0.6
  }

  const data = await postToEdgeFunction('/api/proxy/thumbnail-generate', body)

  const results: ThumbnailGenerateResult[] = []
  const urls = data.urls || data.images || data.outputs || []
  const urlArray = Array.isArray(urls) ? urls : [urls].filter(Boolean)

  urlArray.forEach((u: unknown, i: number) => {
    if (typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:image'))) {
      results.push({
        url: u,
        responseId: typeof data.request_id === 'string' ? `${data.request_id}-${i}` : undefined,
        revisedPrompt: typeof data.revised_prompt === 'string' ? data.revised_prompt : undefined,
        templateId: params.templateId,
        aspectRatio: params.aspectRatio,
        model: typeof data.model === 'string' ? data.model : undefined,
        fallbackFrom: typeof data.fallback_from === 'string' ? data.fallback_from : undefined,
      })
    } else if (u && typeof u === 'object' && 'url' in u && typeof (u as { url?: unknown }).url === 'string') {
      results.push({
        url: (u as { url: string }).url,
        responseId: (u as { response_id?: string }).response_id,
        revisedPrompt: (u as { revised_prompt?: string }).revised_prompt,
        templateId: params.templateId,
        aspectRatio: params.aspectRatio,
      })
    }
  })

  return results
}

/**
 * Refine an existing thumbnail image via the server-side proxy.
 */
export async function refineThumbnail(params: ThumbnailRefineParams): Promise<ThumbnailRefineResult[]> {
  const body: Record<string, unknown> = {
    action: 'refine',
    image_url: params.imageUrl,
    prompt: params.prompt,
    model: params.model || 'gpt-image-2',
    aspect_ratio: params.aspectRatio || '16:9',
    n: Math.min(Math.max(params.n || 1, 1), 4),
    strength: params.strength ?? 0.5,
    ...(params.quality ? { quality: params.quality } : {}),
    ...(params.maskUrl ? { mask_url: params.maskUrl } : {}),
    ...imageControlFields(params),
  }

  const data = await postToEdgeFunction('/api/proxy/thumbnail-generate', body)

  const results: ThumbnailRefineResult[] = []
  const urls = data.urls || data.images || data.outputs || []
  const urlArray = Array.isArray(urls) ? urls : [urls].filter(Boolean)

  urlArray.forEach((u: unknown, i: number) => {
    if (typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:image'))) {
      results.push({
        url: u,
        responseId: typeof data.request_id === 'string' ? `${data.request_id}-${i}` : undefined,
        revisedPrompt: typeof data.revised_prompt === 'string' ? data.revised_prompt : undefined,
        model: typeof data.model === 'string' ? data.model : undefined,
        fallbackFrom: typeof data.fallback_from === 'string' ? data.fallback_from : undefined,
      })
    } else if (u && typeof u === 'object' && 'url' in u && typeof (u as { url?: unknown }).url === 'string') {
      results.push({
        url: (u as { url: string }).url,
        responseId: (u as { response_id?: string }).response_id,
        revisedPrompt: (u as { revised_prompt?: string }).revised_prompt,
      })
    }
  })

  return results
}

/**
 * AI-suggested thumbnail templates for the current post context.
 * Calls the server-side proxy which forwards the request with the user's key.
 */
export async function suggestThumbnails(
  title: string,
  description: string,
  platform: string = 'youtube'
): Promise<
  {
    templateId: string
    label: string
    category: string
    prompt: string
    referenceType: string
    referenceLabel: string
  }[]
> {
  const response = await fetch('/api/proxy/openai-enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, platform }),
  })

  if (!response.ok) {
    throw new Error(`Suggestion failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    suggestions?: {
      templateId: string
      label: string
      category: string
      prompt: string
      referenceType: string
      referenceLabel: string
    }[]
  }

  return data.suggestions || []
}
