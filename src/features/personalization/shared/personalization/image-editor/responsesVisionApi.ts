import type {
  DiscoveredAssetCategory,
  PersonalizationVisionAnalysis,
  PersonalizationVisionValidation,
} from '../types'

export type VisionAnalyzeInput = {
  id: string
  imageUrl: string
  categoryHint?: DiscoveredAssetCategory
  roleHint?: string
}

export type VisionBusinessContext = {
  businessName?: string
  industry?: string
  productService?: string
  brandDescription?: string
}

export async function analyzePersonalizationImages(params: {
  images: VisionAnalyzeInput[]
  businessContext?: VisionBusinessContext
  targetVideoFormat?: string
}): Promise<PersonalizationVisionAnalysis[]> {
  const response = await fetch('/api/personalization/image-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      mode: 'analyze',
      images: params.images,
      businessContext: params.businessContext,
      targetVideoFormat: params.targetVideoFormat,
    }),
  })

  let payload: Record<string, unknown>
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error('SmartVideo GO Vision analysis failed')
    throw new Error('Unable to parse vision analysis response')
  }
  if (!response.ok) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'SmartVideo GO Vision analysis failed')
  }

  return Array.isArray(payload?.analyses) ? payload.analyses : []
}

export async function validatePersonalizationImageEdit(params: {
  originalImageUrl: string
  editedImageUrl: string
  preserve?: string[]
  intendedOperation?: string
  businessContext?: Pick<VisionBusinessContext, 'businessName' | 'industry'>
}): Promise<PersonalizationVisionValidation> {
  const response = await fetch('/api/personalization/image-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      mode: 'validate',
      ...params,
    }),
  })

  let payload: Record<string, unknown>
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error('SmartVideo GO Vision validation failed')
    throw new Error('Unable to parse vision validation response')
  }
  if (!response.ok) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'SmartVideo GO Vision validation failed')
  }
  if (!payload?.validation) throw new Error('SmartVideo GO Vision returned no validation result.')
  return payload.validation as PersonalizationVisionValidation
}

export type ResponsesSmartEditResult = {
  imageDataUrl: string
  responseId: string | null
  imageGenerationCallId: string | null
  revisedPrompt: string | null
  model: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  orchestratorModel?: string
  usage?: unknown
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number | null
}

export async function responsesSmartEdit(params: {
  imageUrl?: string
  referenceImages?: string[]
  prompt: string
  previousResponseId?: string
  imageModel: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  action?: 'auto' | 'edit' | 'generate'
  quality?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
  size?: string
  background?: 'transparent' | 'opaque' | 'auto'
  inputFidelity?: 'high' | 'low'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number
  businessContext?: VisionBusinessContext & {
    targetRole?: string
    preserve?: string[]
  }
}): Promise<ResponsesSmartEditResult> {
  const response = await fetch('/api/personalization/image-smart-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(params),
  })

  let payload: Record<string, unknown>
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error('SmartVideo GO Smart Edit failed')
    throw new Error('Unable to parse smart edit response')
  }
  if (!response.ok) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'SmartVideo GO Smart Edit failed')
  }
  if (!payload?.imageDataUrl) throw new Error('SmartVideo GO Smart Edit returned no image.')

  return payload as ResponsesSmartEditResult
}

export async function responsesSmartEditStream(
  params: Parameters<typeof responsesSmartEdit>[0] & { partialImages?: number },
  onPartialImage: (dataUrl: string, index: number) => void,
): Promise<ResponsesSmartEditResult> {
  const response = await fetch('/api/personalization/image-smart-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      ...params,
      stream: true,
      partialImages: Math.max(1, Math.min(3, Math.round(params.partialImages || 2))),
    }),
  })

  if (!response.ok) {
    let payload: Record<string, unknown>
    try {
      payload = await response.json()
    } catch {
      throw new Error('SmartVideo GO Smart Edit streaming failed')
    }
    throw new Error(typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'SmartVideo GO Smart Edit streaming failed')
  }
  if (!response.body) throw new Error('SmartVideo GO Smart Edit returned no stream.')

  const outputFormat =
    params.outputFormat === 'jpeg' || params.outputFormat === 'webp' ? params.outputFormat : 'png'
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResponse: any = null

  const readWithTimeout = async (): Promise<{ value?: Uint8Array; done: boolean }> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SmartVideo GO Smart Edit streaming timed out after 90 seconds')), 90000)
    })
    try {
      return await Promise.race([reader.read(), timeoutPromise])
    } catch (err) {
      try {
        await reader.cancel()
      } catch {
        // ignore cancel errors
      }
      throw err
    }
  }

  const handleEvent = (raw: string) => {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
    if (!dataLines.length) return
    const data = dataLines.join('\n')
    if (!data || data === '[DONE]') return

    let event: any
    try {
      event = JSON.parse(data)
    } catch {
      return
    }

    if (event?.type === 'response.image_generation_call.partial_image' && event.partial_image_b64) {
      onPartialImage(
        `data:image/${outputFormat};base64,${event.partial_image_b64}`,
        Number(event.partial_image_index) || 0,
      )
      return
    }

    if (event?.type === 'response.completed' && event.response) {
      finalResponse = event.response
      return
    }

    if (event?.type === 'error' || event?.type === 'response.failed') {
      throw new Error(
        event?.error?.message ||
        event?.response?.error?.message ||
        'SmartVideo GO Smart Edit streaming failed',
      )
    }
  }

  while (true) {
    const { value, done } = await readWithTimeout()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    if (done) break
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const raw of events) handleEvent(raw)
  }
  buffer += decoder.decode()
  if (buffer.trim()) handleEvent(buffer)

  const calls = Array.isArray(finalResponse?.output)
    ? finalResponse.output.filter((item: any) => item?.type === 'image_generation_call')
    : []
  const call = calls[0]
  const result = typeof call?.result === 'string' ? call.result : ''
  if (!result) throw new Error('SmartVideo GO Smart Edit stream returned no final image.')

  return {
    imageDataUrl: `data:image/${outputFormat};base64,${result}`,
    responseId: finalResponse?.id || null,
    imageGenerationCallId: call?.id || null,
    revisedPrompt: call?.revised_prompt || null,
    model: params.imageModel,
    orchestratorModel: finalResponse?.model,
    usage: finalResponse?.usage,
    outputFormat,
    outputCompression: params.outputCompression ?? null,
  }
}
