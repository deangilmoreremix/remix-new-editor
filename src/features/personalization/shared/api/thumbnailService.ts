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
    throw Object.assign(new Error(errorData.error || `Thumbnail service error: ${response.status}`), {
      code: typeof errorData.code === 'string' ? errorData.code : undefined,
      moderationDetails: errorData.moderation_details,
    })
  }

  return response.json() as Promise<Record<string, unknown>>
}

/** One event of the thumbnail stream (see the thumbnail-generate route). */
export type ThumbnailStreamEvent =
  | { type: 'partial'; index: number; url: string }
  | { type: 'done'; urls: string[]; model?: string; request_id?: string; usage?: unknown; revised_prompt?: string; fallback_from?: string }
  | { type: 'error'; error: string; code?: string }

/** Reads a text/event-stream body and calls `onEvent` for each JSON `data:` block. */
export async function readSse(response: Response, onEvent: (event: ThumbnailStreamEvent) => void): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The thumbnail service sent no stream.')
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = (block: string) => {
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
    if (!data) return
    try {
      onEvent(JSON.parse(data) as ThumbnailStreamEvent)
    } catch {
      // A malformed block is skipped; the stream's own done/error event still ends the request.
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut = buffer.indexOf('\n\n')
    while (cut !== -1) {
      flush(buffer.slice(0, cut))
      buffer = buffer.slice(cut + 2)
      cut = buffer.indexOf('\n\n')
    }
  }
  if (buffer.trim()) flush(buffer)
}

/** Options for a live-preview generation: partial pictures arrive while it draws. */
export interface ThumbnailStreamOptions {
  onPartial?: (url: string, index: number) => void
  signal?: AbortSignal
}

async function postStreaming(url: string, body: Record<string, unknown>, options: ThumbnailStreamOptions): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true, partial_images: 2 }),
    signal: options.signal,
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw Object.assign(new Error(errorData.error || `Thumbnail service error: ${response.status}`), {
      code: typeof errorData.code === 'string' ? errorData.code : undefined,
      moderationDetails: errorData.moderation_details,
    })
  }
  if (!(response.headers.get('content-type') || '').includes('text/event-stream')) {
    return response.json() as Promise<Record<string, unknown>> // an older server answered normally
  }
  let final: Record<string, unknown> | null = null
  let failure: Error | null = null
  await readSse(response, (event) => {
    if (event.type === 'partial') options.onPartial?.(event.url, event.index)
    else if (event.type === 'done') final = { urls: event.urls, model: event.model, request_id: event.request_id, usage: event.usage, revised_prompt: event.revised_prompt, fallback_from: event.fallback_from }
    else if (event.type === 'error') failure = Object.assign(new Error(event.error), { code: event.code })
  })
  if (failure) throw failure
  if (!final) throw new Error('The picture stream ended early. Try again.')
  return final
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
  outputFormat?: 'png' | 'jpeg' | 'webp' | 'svg' | 'gif'
  outputCompression?: number
  /** gif only: 2 to 16 frames (default 9). */
  frameCount?: number
  /** gif only: 20 to 2000 ms per frame (default 200). */
  frameDurationMs?: number
  /** Content filter: 'auto' (standard, default) or 'low' (less restrictive). */
  moderation?: 'auto' | 'low'
}

/** True when OpenAI's content filter blocked the request (it should not be retried unchanged). */
export function isModerationBlocked(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'moderation_blocked'
}

function imageControlFields(params: ThumbnailImageControls): Record<string, unknown> {
  return {
    ...(params.complexity ? { complexity: params.complexity } : {}),
    ...(params.size ? { size: params.size } : {}),
    ...(params.background ? { background: params.background } : {}),
    ...(params.outputFormat ? { output_format: params.outputFormat } : {}),
    ...(params.outputCompression !== undefined ? { output_compression: params.outputCompression } : {}),
    ...(params.moderation && params.moderation !== 'auto' ? { moderation: params.moderation } : {}),
    ...(params.frameCount !== undefined ? { frame_count: params.frameCount } : {}),
    ...(params.frameDurationMs !== undefined ? { frame_duration_ms: params.frameDurationMs } : {}),
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
  /** Token usage reported by OpenAI for this request. */
  usage?: unknown
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
  /** Images 2.6 only: PNG data URL of drawn arrows/notes (transparent elsewhere). Not combinable with maskUrl. */
  markupUrl?: string
}

export interface ThumbnailRefineResult {
  url: string
  responseId?: string
  revisedPrompt?: string
  /** Model that actually produced the image (may differ from the one asked for). */
  model?: string
  /** Set when the requested model was unavailable and GPT Image 2 was used instead. */
  fallbackFrom?: string
  usage?: unknown
}

/**
 * Generate thumbnail(s) via the server-side proxy.
 * The client never receives or persists raw API keys.
 */
export async function generateThumbnail(params: ThumbnailGenerateParams, stream?: ThumbnailStreamOptions): Promise<ThumbnailGenerateResult[]> {
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

  const wantsStream = !!stream?.onPartial && (params.n ?? 1) === 1 && !params.imageUrl
  const data = wantsStream
    ? await postStreaming('/api/proxy/thumbnail-generate', body, stream!)
    : await postToEdgeFunction('/api/proxy/thumbnail-generate', body)

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
        usage: data.usage,
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
    ...(params.markupUrl ? { markup_url: params.markupUrl } : {}),
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
        usage: data.usage,
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
