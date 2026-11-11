import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { getOpenAiKeyForUser } from '../../../../src/lib/openaiKeyServer'
import { rateLimit, rateLimit429 } from '../../../../lib/rateLimit'
import { IMAGE_EDIT_OPERATIONS, type EditorOperationId } from '../../../../src/shared/personalization/image-editor/imageEditRegistry'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

const OPENAI_EDIT_URL = 'https://api.openai.com/v1/images/edits'
const ALLOWED_MODELS = new Set(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'])
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'auto'])
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp'])
const ALLOWED_BACKGROUNDS = new Set(['transparent', 'opaque', 'auto'])
const ALLOWED_FIDELITY = new Set(['high', 'low'])
const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_MASK_BYTES = 4 * 1024 * 1024
const MAX_PROMPT_LENGTH = 32_000
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 12

function isImageFile(value: FormDataEntryValue | null): value is File {
  if (!(value instanceof File)) return false
  return ['image/png', 'image/jpeg', 'image/webp'].includes(value.type)
}

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function isAllowedSize(size: string) {
  if (size === 'auto') return true
  const match = size.match(/^(\d{2,5})x(\d{2,5})$/)
  if (!match) return false
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false
  if (width % 16 !== 0 || height % 16 !== 0) return false
  if (width > 3840 || height > 3840) return false

  const aspectRatio = width / height
  if (aspectRatio < 1 / 3 || aspectRatio > 3) return false

  const pixels = width * height
  return pixels >= 655_360 && pixels <= 8_294_400
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const limit = rateLimit('personalization-image-edit:' + userId, {
    windowMs: RATE_WINDOW_MS,
    max: RATE_MAX,
  })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const key = await getOpenAiKeyForUser()
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_KEY_REQUIRED', message: 'Add an OpenAI API key in SmartVideo GO Settings before using AI image editing.' },
      { status: 401 },
    )
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Request must be multipart/form-data' }, { status: 400 })
    }

    const incoming = await req.formData()
    const image = incoming.get('image') || incoming.get('image[]')
    const mask = incoming.get('mask')
    const prompt = cleanString(incoming.get('prompt'))
    const operation = cleanString(incoming.get('operation')) as EditorOperationId
    const model = cleanString(incoming.get('model')) || 'gpt-image-2.5-flare'
    const quality = cleanString(incoming.get('quality')) || 'auto'
    const size = cleanString(incoming.get('size')) || 'auto'
    const outputFormat = cleanString(incoming.get('output_format')) || 'png'
    const compressionRaw = cleanString(incoming.get('output_compression'))
    const outputCompression = compressionRaw ? Number(compressionRaw) : undefined
    const background = cleanString(incoming.get('background')) || 'auto'
    const inputFidelity = cleanString(incoming.get('input_fidelity')) || 'high'

    if (!isImageFile(image)) {
      return NextResponse.json({ error: 'A PNG, JPEG, or WebP source image is required.' }, { status: 400 })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Source image exceeds the 50 MB limit.' }, { status: 413 })
    }
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: 'A valid image-edit prompt is required.' }, { status: 400 })
    }
    if (!operation || !IMAGE_EDIT_OPERATIONS[operation]) {
      return NextResponse.json({ error: 'Unsupported SmartVideo GO image-edit operation.' }, { status: 400 })
    }
    if (!ALLOWED_MODELS.has(model)) {
      return NextResponse.json({ error: 'Unsupported image model.' }, { status: 400 })
    }
    if (!ALLOWED_QUALITIES.has(quality)) {
      return NextResponse.json({ error: 'Unsupported quality value.' }, { status: 400 })
    }
    if (!isAllowedSize(size)) {
      return NextResponse.json({ error: 'Unsupported image size.' }, { status: 400 })
    }
    if (!ALLOWED_FORMATS.has(outputFormat)) {
      return NextResponse.json({ error: 'Unsupported output format.' }, { status: 400 })
    }
    if (
      outputCompression !== undefined &&
      (!Number.isFinite(outputCompression) || outputCompression < 0 || outputCompression > 100)
    ) {
      return NextResponse.json({ error: 'Output compression must be between 0 and 100.' }, { status: 400 })
    }
    if (outputCompression !== undefined && outputFormat === 'png') {
      return NextResponse.json({ error: 'Output compression is only supported for JPEG or WebP.' }, { status: 400 })
    }
    if (!ALLOWED_BACKGROUNDS.has(background)) {
      return NextResponse.json({ error: 'Unsupported background mode.' }, { status: 400 })
    }
    if (!ALLOWED_FIDELITY.has(inputFidelity)) {
      return NextResponse.json({ error: 'Unsupported input fidelity.' }, { status: 400 })
    }
    if (background === 'transparent' && outputFormat === 'jpeg') {
      return NextResponse.json({ error: 'Transparent output requires PNG or WebP.' }, { status: 400 })
    }

    if (mask !== null) {
      if (!(mask instanceof File) || mask.type !== 'image/png') {
        return NextResponse.json({ error: 'Mask must be a PNG image with an alpha channel.' }, { status: 400 })
      }
      if (image.type !== 'image/png') {
        return NextResponse.json({ error: 'Masked edits require the source image to be normalized to PNG.' }, { status: 400 })
      }
      if (mask.size > MAX_MASK_BYTES) {
        return NextResponse.json({ error: 'Mask exceeds the 4 MB API limit.' }, { status: 413 })
      }
    }

    const upstream = new FormData()
    upstream.append('model', model)
    upstream.append('prompt', prompt)
    upstream.append('image[]', image, image.name || 'source.png')
    upstream.append('n', '1')
    upstream.append('quality', quality)
    upstream.append('size', size)
    upstream.append('output_format', outputFormat)
    if (outputCompression !== undefined && outputFormat !== 'png') {
      upstream.append('output_compression', String(Math.round(outputCompression)))
    }
    upstream.append('background', background)
    // input_fidelity is validated for compatibility but never forwarded: the
    // only allowed models (gpt-image-2.5) reject it.

    if (mask instanceof File) {
      upstream.append('mask', mask, mask.name || 'mask.png')
    }

    const response = await fetch(OPENAI_EDIT_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: upstream,
      signal: AbortSignal.timeout(120_000),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        'SmartVideo GO image edit failed.'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    return NextResponse.json({
      ...data,
      smartvideo: {
        operation,
        model,
        rateLimitRemaining: limit.remaining,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image edit failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
