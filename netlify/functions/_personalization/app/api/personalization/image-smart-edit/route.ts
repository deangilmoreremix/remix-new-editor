import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { getOpenAiKeyForUser } from '../../../../src/lib/openaiKeyServer'
import { rateLimit, rateLimit429 } from '../../../../lib/rateLimit'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'
export const maxDuration = 120

const RESPONSES_URL = 'https://api.openai.com/v1/responses'
const ORCHESTRATOR_MODEL = process.env.SMARTVIDEO_RESPONSES_MODEL || 'gpt-6-astra'
const MAX_REFERENCES = 6
const MAX_DATA_URL_CHARS = 14_000_000

type SmartEditBody = {
  imageUrl?: string
  referenceImages?: string[]
  prompt: string
  previousResponseId?: string
  imageModel?: 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  action?: 'auto' | 'edit' | 'generate'
  quality?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
  size?: string
  background?: 'transparent' | 'opaque' | 'auto'
  inputFidelity?: 'high' | 'low'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number
  stream?: boolean
  partialImages?: number
  businessContext?: {
    businessName?: string
    industry?: string
    productService?: string
    brandDescription?: string
    targetRole?: string
    preserve?: string[]
  }
}

function validImageReference(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_DATA_URL_CHARS) return false
  if (value.startsWith('data:image/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const limit = rateLimit(`personalization-smart-edit:${userId}`, { windowMs: 60_000, max: 10 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const key = await getOpenAiKeyForUser()
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_KEY_REQUIRED', message: 'Add your OpenAI API key in SmartVideo GO Settings.' },
      { status: 401 },
    )
  }

  try {
    const body = (await req.json()) as SmartEditBody
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 })

    const previousResponseId =
      typeof body.previousResponseId === 'string' && body.previousResponseId.startsWith('resp_')
        ? body.previousResponseId
        : undefined

    if (!previousResponseId && !validImageReference(body.imageUrl)) {
      return NextResponse.json({ error: 'A valid source image is required for the first Smart Edit turn.' }, { status: 400 })
    }

    const references = Array.isArray(body.referenceImages)
      ? body.referenceImages.filter(validImageReference).slice(0, MAX_REFERENCES)
      : []

    const preserve = Array.isArray(body.businessContext?.preserve)
      ? body.businessContext!.preserve!.map(String).filter(Boolean).slice(0, 20)
      : []

    const context = [
      body.businessContext?.businessName ? `Business: ${body.businessContext.businessName}.` : '',
      body.businessContext?.industry ? `Industry: ${body.businessContext.industry}.` : '',
      body.businessContext?.productService ? `Product/service: ${body.businessContext.productService}.` : '',
      body.businessContext?.brandDescription ? `Brand description: ${body.businessContext.brandDescription}.` : '',
      body.businessContext?.targetRole ? `Target SmartVideo GO role: ${body.businessContext.targetRole}.` : '',
      preserve.length ? `Preserve as closely as possible: ${preserve.join(', ')}.` : '',
    ].filter(Boolean).join(' ')

    const instruction =
      'Edit the image for SmartVideo GO according to the user request. ' +
      'Preserve everything that is not explicitly requested to change. ' +
      'Do not unnecessarily redesign real people, logos, products, packaging, signage, printed text, phone numbers, URLs, or brand colors. ' +
      context + ' User request: ' + prompt

    const input = previousResponseId
      ? instruction
      : [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instruction },
              { type: 'input_text', text: 'Primary image to edit:' },
              { type: 'input_image', image_url: body.imageUrl, detail: 'original' },
              ...references.flatMap((imageUrl, index) => [
                { type: 'input_text', text: `Reference image ${index + 1}. Use only as relevant context; do not replace the primary subject unless requested.` },
                { type: 'input_image', image_url: imageUrl, detail: 'high' },
              ]),
            ],
          },
        ]

    const imageModel =
      body.imageModel === 'gpt-image-2.5-flare'
        ? 'gpt-image-2.5-flare'
        : 'gpt-image-2.5-sunburst'
    const outputFormat =
      body.outputFormat === 'jpeg' || body.outputFormat === 'webp' ? body.outputFormat : 'png'
    const outputCompression =
      typeof body.outputCompression === 'number' && Number.isFinite(body.outputCompression)
        ? Math.max(0, Math.min(100, Math.round(body.outputCompression)))
        : undefined
    const background = body.background || 'auto'
    if (background === 'transparent' && outputFormat === 'jpeg') {
      return NextResponse.json({ error: 'Transparent Smart Edit output requires PNG or WebP.' }, { status: 400 })
    }

    const tool: Record<string, unknown> = {
      type: 'image_generation',
      model: imageModel,
      action: body.action || 'edit',
      quality: body.quality || 'auto',
      background,
      output_format: outputFormat,
    }
    // gpt-image-2.5 models reject input_fidelity, so it is not forwarded.
    if (outputCompression !== undefined && outputFormat !== 'png') {
      tool.output_compression = outputCompression
    }
    if (body.size && body.size !== 'original') tool.size = body.size
    const stream = body.stream === true
    const partialImages = stream
      ? Math.max(1, Math.min(3, Math.round(Number(body.partialImages) || 2)))
      : undefined
    if (partialImages) tool.partial_images = partialImages

    const upstream = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ORCHESTRATOR_MODEL,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        input,
        tools: [tool],
        tool_choice: { type: 'image_generation' },
        ...(stream ? { stream: true } : {}),
      }),
      signal: AbortSignal.timeout(110_000),
    })

    if (stream) {
      if (!upstream.ok) {
        const payload = await upstream.json().catch(() => ({}))
        return NextResponse.json(
          {
            error: payload?.error?.message || payload?.error || 'Smart Edit streaming failed.',
            upstreamStatus: upstream.status,
          },
          { status: upstream.status },
        )
      }
      if (!upstream.body) {
        return NextResponse.json({ error: 'The Responses API returned no streaming body.' }, { status: 502 })
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-SmartVideo-Image-Model': imageModel,
          'X-SmartVideo-Output-Format': outputFormat,
        },
      })
    }

    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: payload?.error?.message || payload?.error || 'Smart Edit failed.',
          upstreamStatus: upstream.status,
        },
        { status: upstream.status },
      )
    }

    const calls = Array.isArray(payload?.output)
      ? payload.output.filter((item: any) => item?.type === 'image_generation_call')
      : []
    const call = calls[0]
    const result = typeof call?.result === 'string' ? call.result : ''

    if (!result) {
      return NextResponse.json({ error: 'The Responses API returned no edited image.' }, { status: 502 })
    }

    return NextResponse.json({
      imageDataUrl: `data:image/${outputFormat};base64,${result}`,
      outputFormat,
      outputCompression: outputCompression ?? null,
      responseId: payload.id || null,
      imageGenerationCallId: call?.id || null,
      revisedPrompt: call?.revised_prompt || null,
      model: imageModel,
      orchestratorModel: ORCHESTRATOR_MODEL,
      usage: payload?.usage || null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Smart Edit failed.' },
      { status: 500 },
    )
  }
}
