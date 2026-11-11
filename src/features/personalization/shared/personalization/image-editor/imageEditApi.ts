import type { ImageFormat, ImageQuality, ImageResult, ImageSize } from '@ohb/shared/api/openaiImage'
import type { EditorOperationId } from './imageEditRegistry'

export type SmartVideoGoImageEditRequest = {
  operation: EditorOperationId
  prompt: string
  image: Blob
  mask?: Blob | null
  model: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  quality: ImageQuality
  size: ImageSize
  outputFormat: ImageFormat
  outputCompression?: number
  background: 'transparent' | 'opaque' | 'auto'
  inputFidelity: 'high' | 'low'
}

export async function editSmartVideoGoImage(params: SmartVideoGoImageEditRequest): Promise<ImageResult[]> {
  const form = new FormData()
  form.append('operation', params.operation)
  form.append('prompt', params.prompt)
  form.append('model', params.model)
  form.append('quality', params.quality)
  form.append('size', params.size)
  form.append('output_format', params.outputFormat)
  if (params.outputCompression !== undefined) form.append('output_compression', String(params.outputCompression))
  form.append('background', params.background)
  form.append('input_fidelity', params.inputFidelity)
  form.append('image', params.image, 'source.' + (params.image.type.split('/')[1] || 'png'))

  if (params.mask) {
    form.append('mask', params.mask, 'mask.png')
  }

  const response = await fetch('/api/personalization/image-edit', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })

  let payload: Record<string, unknown>
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error('SmartVideo GO image edit failed')
    throw new Error('Unable to parse image edit response')
  }
  if (!response.ok) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'SmartVideo GO image edit failed')
  }

  return Array.isArray(payload?.data) ? payload.data : []
}
