/**
 * OpenAI Image API — gpt-image-2
 * Supports: generation, editing, reference images, masking, streaming
 * Docs: https://developers.openai.com/api/docs/guides/image-generation
 */

const BASE = 'https://api.openai.com/v1'

// NOTE: Raw API keys must not be persisted in localStorage.
// Generation calls are proxied through /api/proxy/openai-image,
// which resolves the key server-side from the authenticated user's record.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
export type ImageFormat  = 'png' | 'jpeg' | 'webp'
export type ImageSize    = '1024x1024' | '1536x1024' | '1024x1536' | '2048x2048' | '2048x1152' | '3840x2160' | `${number}x${number}` | 'auto'
export type Moderation   = 'auto' | 'low'

export interface GenerateImageParams {
  prompt: string
  model?: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'gpt-image-2' | 'gpt-image-1' | 'gpt-image-1.5' | 'gpt-image-1-mini' | 'dall-e-3' | 'dall-e-2'
  n?: number                    // 1-10 images
  quality?: ImageQuality
  size?: ImageSize
  output_format?: ImageFormat
  output_compression?: number   // 0-100 for jpeg/webp
  moderation?: Moderation
  partial_images?: number       // 0-3 for streaming
  background?: 'transparent' | 'opaque' | 'auto'
}

export interface EditImageParams {
  prompt: string
  image: File | Blob | string   // file, blob, or base64 data URL
  mask?: File | Blob            // optional mask for inpainting
  model?: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'gpt-image-2'
  n?: number
  quality?: ImageQuality
  size?: ImageSize
  output_format?: ImageFormat
  output_compression?: number   // 0-100 for jpeg/webp
  background?: 'transparent' | 'opaque' | 'auto'
  input_fidelity?: 'high' | 'low'
}

export interface ImageResult {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

// ── Helper: headers ───────────────────────────────────────────────────────────
// Client-side calls go through the server-side proxy, so no Authorization
// header is needed here. For FormData uploads, DO NOT set Content-Type so
// the runtime can inject the multipart boundary automatically.
function authHeaders(isFormData = false) {
  if (isFormData) {
    return {} as Record<string, string>;
  }
  return { 'Content-Type': 'application/json' }
}

// ── Helper: convert b64 to object URL for display ────────────────────────────
export function b64ToObjectUrl(b64: string, format: ImageFormat = 'png'): string {
  const byteChars = atob(b64)
  const byteNums = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
  const byteArray = new Uint8Array(byteNums)
  const blob = new Blob([byteArray], { type: `image/${format}` })
  return URL.createObjectURL(blob)
}

// ── Generate images from text ─────────────────────────────────────────────────
export async function generateImages(params: GenerateImageParams): Promise<ImageResult[]> {
  const body: Record<string, any> = {
    model: params.model || 'gpt-image-2',
    prompt: params.prompt,
    n: params.n || 1,
    quality: params.quality || 'auto',
    size: params.size || 'auto',
  }
  if (params.output_format) body.output_format = params.output_format
  if (params.output_compression !== undefined) body.output_compression = params.output_compression
  if (params.moderation) body.moderation = params.moderation
  if (params.background) body.background = params.background

  const res = await fetch('/api/proxy/openai-image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message || res.statusText
    if (err?.error?.code === 'moderation_blocked') {
      throw new Error('Content moderation blocked this request. Please revise your prompt.')
    }
    throw new Error(`OpenAI Image API error: ${msg}`)
  }

  const data = await res.json()
  return data.data as ImageResult[]
}

// ── Edit / inpaint an existing image ─────────────────────────────────────────
export async function editImage(params: EditImageParams): Promise<ImageResult[]> {
  const formData = new FormData()
  formData.append('model', params.model || 'gpt-image-2')
  formData.append('prompt', params.prompt)
  formData.append('n', String(params.n || 1))
  if (params.quality) formData.append('quality', params.quality)
  if (params.size) formData.append('size', params.size)
  if (params.output_format) formData.append('output_format', params.output_format)
  if (params.output_compression !== undefined) formData.append('output_compression', String(params.output_compression))
  if (params.background) formData.append('background', params.background)
  if (params.input_fidelity) formData.append('input_fidelity', params.input_fidelity)

  // Handle image input
  if (typeof params.image === 'string') {
    // base64 data URL — convert to blob
    const res = await fetch(params.image)
    const blob = await res.blob()
    formData.append('image[]', blob, 'image.png')
  } else {
    formData.append('image[]', params.image, 'image.png')
  }

  // Optional mask
  if (params.mask) {
    formData.append('mask', params.mask, 'mask.png')
  }

  const res = await fetch('/api/proxy/openai-image', {
    method: 'POST',
    headers: authHeaders(true),
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Edit API error: ${res.statusText}`)
  }

  const data = await res.json()
  return data.data as ImageResult[]
}

// ── Streaming generation (returns async generator of partial images) ──────────
export async function* generateImageStream(
  params: GenerateImageParams & { partial_images?: number }
): AsyncGenerator<{ partial: boolean; index: number; b64: string }> {
  const body: Record<string, any> = {
    model: params.model || 'gpt-image-2',
    prompt: params.prompt,
    n: 1,
    quality: params.quality || 'medium',
    size: params.size || 'auto',
    stream: true,
    partial_images: params.partial_images ?? 2,
  }
  if (params.output_format) body.output_format = params.output_format

  const res = await fetch('/api/proxy/openai-image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...body, _endpoint: 'images/generations' }),
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Stream failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        const event = JSON.parse(raw)
        if (event.type === 'image_generation.partial_image') {
          yield { partial: true, index: event.partial_image_index, b64: event.b64_json }
        } else if (event.data?.[0]?.b64_json) {
          yield { partial: false, index: 0, b64: event.data[0].b64_json }
        }
      } catch {}
    }
  }
}

// ── Streaming image edit / inpaint (returns async generator) ──────────────────
export async function* editImageStream(
  params: EditImageParams & { partial_images?: number }
): AsyncGenerator<{ partial: boolean; index: number; b64: string }> {
  const formData = new FormData()
  formData.append('model', params.model || 'gpt-image-2')
  formData.append('prompt', params.prompt)
  formData.append('n', String(params.n || 1))
  formData.append('stream', 'true')
  formData.append('partial_images', String(params.partial_images ?? 2))
  if (params.quality) formData.append('quality', params.quality)
  if (params.size) formData.append('size', params.size)
  if (params.output_format) formData.append('output_format', params.output_format)
  if (params.output_compression !== undefined) formData.append('output_compression', String(params.output_compression))
  if (params.background) formData.append('background', params.background)
  if (params.input_fidelity) formData.append('input_fidelity', params.input_fidelity)

  // Handle reference image input(s)
  if (typeof params.image === 'string') {
    const res = await fetch(params.image)
    const blob = await res.blob()
    formData.append('image[]', blob, 'image.png')
  } else {
    formData.append('image[]', params.image, 'image.png')
  }

  // Optional mask
  if (params.mask) {
    formData.append('mask', params.mask, 'mask.png')
  }

  const res = await fetch('/api/proxy/openai-image', {
    method: 'POST',
    headers: authHeaders(true),
    body: formData,
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Edit stream failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        const event = JSON.parse(raw)
        if (event.type === 'image_edit.partial_image') {
          yield { partial: true, index: event.partial_image_index, b64: event.b64_json }
        } else if (event.type === 'image_edit.completed') {
          yield { partial: false, index: 0, b64: event.b64_json }
        } else if (event.data?.[0]?.b64_json) {
          // Fallback for non-event final payloads
          yield { partial: false, index: 0, b64: event.data[0].b64_json }
        }
      } catch {}
    }
  }
}

// ── OpenAI Responses API — multi-turn image generation ───────────────────────
export async function generateWithResponses(params: {
  prompt: string
  previousResponseId?: string
  quality?: ImageQuality
  size?: ImageSize
  action?: 'auto' | 'generate' | 'edit'
}): Promise<{ b64: string; revisedPrompt?: string; responseId: string }> {
  const body: Record<string, any> = {
    model: 'gpt-4o',
    input: params.prompt,
    tools: [{
      type: 'image_generation',
      action: params.action || 'auto',
      ...(params.quality && { quality: params.quality }),
      ...(params.size && { size: params.size }),
    }],
  }
  if (params.previousResponseId) body.previous_response_id = params.previousResponseId

  const res = await fetch('/api/proxy/openai-image', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, _endpoint: 'responses' }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Responses API error')
  }

  const data = await res.json()
  const imageCall = data.output?.find((o: any) => o.type === 'image_generation_call')
  if (!imageCall) throw new Error('No image generated')

  return {
    b64: imageCall.result,
    revisedPrompt: imageCall.revised_prompt,
    responseId: data.id,
  }
}

// ── Thumbnail-specific size presets ──────────────────────────────────────────
export const THUMBNAIL_SIZES: Record<string, { size: ImageSize; label: string; description: string }> = {
  '16:9':  { size: '1280x720',  label: '16:9',  description: 'YouTube standard (1280×720)' },
  '16:9-hd': { size: '1920x1080', label: '16:9 HD', description: 'YouTube HD (1920×1080)' },
  '1:1':   { size: '1024x1024', label: '1:1',   description: 'Instagram square (1024×1024)' },
  '9:16':  { size: '1024x1792', label: '9:16',  description: 'Shorts/TikTok (1024×1792)' },
  '4:3':   { size: '1280x960',  label: '4:3',   description: 'Classic format (1280×960)' },
  '2k':    { size: '2048x1152', label: '2K',    description: '2K landscape (2048×1152)' },
  '4k':    { size: '3840x2160', label: '4K',    description: '4K landscape (experimental)' },
}
