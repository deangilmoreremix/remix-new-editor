/**
 * Shared server-side OpenAI client for the Personalization system.
 *
 * Centralizes:
 * - Base endpoint handling (https://api.openai.com/v1)
 * - Authorization (Bearer key header)
 * - Timeouts (AbortSignal.timeout)
 * - Consistent error normalization
 * - Request ID capture from x-request-id headers
 * - Response JSON parsing with fallback
 *
 * IMPORTANT: This module is server-only. Do not import it from client bundles.
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

type FetchInit = {
  method: string
  headers: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
}

function buildHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

function withTimeout(signal?: AbortSignal, timeoutMs = 120_000): AbortSignal | undefined {
  if (timeoutMs > 0) {
    return AbortSignal.timeout(timeoutMs)
  }
  return signal
}

export type OpenAIUpstreamError = Error & {
  status?: number
  upstreamStatus?: number
  requestId?: string
  body?: unknown
}

export function createOpenAIUpstreamError(
  message: string,
  options: {
    status?: number
    upstreamStatus?: number
    requestId?: string
    body?: unknown
  } = {},
): OpenAIUpstreamError {
  const error = new Error(message) as OpenAIUpstreamError
  error.status = options.status
  error.upstreamStatus = options.upstreamStatus
  error.requestId = options.requestId
  error.body = options.body
  return error
}

export function normalizeOpenAIErrorMessage(data: unknown, fallback = 'OpenAI request failed.'): string {
  if (typeof data !== 'object' || data === null) return fallback
  const record = data as Record<string, unknown>
  const message =
    (typeof record.error === 'object' && record.error !== null && typeof (record.error as any).message === 'string'
      ? (record.error as any).message
      : undefined) ||
    (typeof record.error === 'string' ? record.error : undefined) ||
    (typeof record.message === 'string' ? record.message : undefined) ||
    fallback
  return message
}

export function extractOpenAIRequestId(response: Response): string | undefined {
  const requestId = response.headers.get('x-request-id')
  if (requestId) return requestId
  const openaiRequestId = response.headers.get('openai-organization-id')
  if (openaiRequestId) return openaiRequestId
  return undefined
}

async function parseResponseJson(response: Response): Promise<{ status: number; data: unknown; requestId?: string }> {
  const requestId = extractOpenAIRequestId(response)
  const data = await response.json().catch(() => ({}))
  return { status: response.status, data, requestId }
}

export type PersonalizationOpenAIClientOptions = {
  key: string
}

export type OpenAIImageGenerationParams = {
  prompt: string
  model?: string
  size?: string
  quality?: string
  n?: number
}

export type OpenAIImageEditParams = {
  prompt: string
  image: Blob | File
  mask?: Blob | File | null
  model?: string
  size?: string
  quality?: string
  outputFormat?: 'png' | 'jpeg' | 'webp'
  background?: 'transparent' | 'opaque' | 'auto'
  inputFidelity?: 'high' | 'low'
}

export type OpenAIImageResult = {
  url?: string
  b64_json?: string
  revisedPrompt?: string
}

export class PersonalizationOpenAIClient {
  private readonly baseUrl: string
  private readonly key: string

  constructor(private readonly options: PersonalizationOpenAIClientOptions) {
    this.baseUrl = OPENAI_BASE_URL
    this.key = options.key
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`
  }

  private async fetch<T>(
    path: string,
    init: FetchInit & { timeoutMs?: number },
  ): Promise<T> {
    const response = await fetch(this.url(path), {
      ...init,
      signal: withTimeout(init.signal, init.timeoutMs ?? 120_000),
    })

    const { status, data, requestId } = await parseResponseJson(response)

    if (!response.ok) {
      const message = normalizeOpenAIErrorMessage(data, `OpenAI request failed (HTTP ${status}).`)
      throw createOpenAIUpstreamError(message, {
        status,
        upstreamStatus: status,
        requestId,
        body: data,
      })
    }

    return data as T
  }

  async postJson<T>(
    path: string,
    body: unknown,
    timeoutMs = 120_000,
  ): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      headers: buildHeaders(this.key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      timeoutMs,
    })
  }

  async postFormData<T>(
    path: string,
    form: FormData,
    timeoutMs = 120_000,
  ): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      headers: buildHeaders(this.key),
      body: form,
      timeoutMs,
    })
  }

  async postStream(
    path: string,
    body: unknown,
    timeoutMs = 110_000,
  ): Promise<Response> {
    const response = await fetch(this.url(path), {
      method: 'POST',
      headers: buildHeaders(this.key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: withTimeout(undefined, timeoutMs),
    })

    const requestId = extractOpenAIRequestId(response)

    if (!response.ok) {
      const { data, status } = await parseResponseJson(response)
      const message = normalizeOpenAIErrorMessage(data, `OpenAI stream request failed (HTTP ${status}).`)
      throw createOpenAIUpstreamError(message, {
        status,
        upstreamStatus: status,
        requestId,
        body: data,
      })
    }

    if (!response.body) {
      throw createOpenAIUpstreamError('OpenAI stream returned no body.', {
        status: response.status,
        upstreamStatus: response.status,
        requestId,
      })
    }

    return response
  }

  async generateImage(params: OpenAIImageGenerationParams): Promise<OpenAIImageResult[]> {
    const data = await this.postJson<{ data: OpenAIImageResult[] }>('/images/generations', {
      model: params.model || 'dall-e-3',
      prompt: params.prompt,
      size: params.size || '1024x1024',
      quality: params.quality || 'standard',
      n: Math.min(params.n || 1, 4),
    })
    return data.data || []
  }

  async editImage(params: OpenAIImageEditParams): Promise<OpenAIImageResult[]> {
    const form = new FormData()
    form.append('prompt', params.prompt)
    form.append('model', params.model || 'gpt-image-2.5-flare')
    form.append('size', params.size || 'auto')
    form.append('quality', params.quality || 'auto')
    form.append('output_format', params.outputFormat || 'png')
    form.append('background', params.background || 'auto')
    form.append('input_fidelity', params.inputFidelity || 'high')
    form.append('image', params.image, 'source.' + (params.image.type.split('/')[1] || 'png'))
    if (params.mask) {
      form.append('mask', params.mask, 'mask.png')
    }

    const data = await this.postFormData<{ data: OpenAIImageResult[] }>('/images/edits', form)
    return data.data || []
  }
}

export function createPersonalizationOpenAIClient(key: string): PersonalizationOpenAIClient {
  return new PersonalizationOpenAIClient({ key })
}
