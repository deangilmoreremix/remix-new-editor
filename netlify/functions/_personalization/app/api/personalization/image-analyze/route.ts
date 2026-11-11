import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { getOpenAiKeyForUser } from '../../../../src/lib/openaiKeyServer'
import { rateLimit, rateLimit429 } from '../../../../lib/rateLimit'
import { IMAGE_EDIT_OPERATIONS } from '../../../../src/shared/personalization/image-editor/imageEditRegistry'
import type { DiscoveredAssetCategory } from '../../../../src/shared/personalization/types'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'
export const maxDuration = 120

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const VISION_MODEL = process.env.SMARTVIDEO_VISION_MODEL || 'gpt-6-astra'
const ALLOWED_VISION_MODELS = new Set(['gpt-6-astra', 'gpt-4o', 'gpt-4o-mini'])
if (!ALLOWED_VISION_MODELS.has(VISION_MODEL)) {
  throw new Error(
    `Invalid SMARTVIDEO_VISION_MODEL "${VISION_MODEL}". Allowed values: ${Array.from(ALLOWED_VISION_MODELS).join(', ')}`,
  )
}
const MAX_IMAGES = 8
const MAX_DATA_URL_CHARS = 14_000_000
const ALLOWED_CATEGORIES: DiscoveredAssetCategory[] = [
  'person',
  'logo',
  'product',
  'service',
  'completed_work',
  'storefront',
  'office',
  'branded_vehicle',
  'team',
  'brand',
  'irrelevant',
]
const OPERATION_IDS = new Set(Object.keys(IMAGE_EDIT_OPERATIONS))

type AnalyzeImageInput = {
  id: string
  imageUrl: string
  categoryHint?: DiscoveredAssetCategory
  roleHint?: string
}

type AnalyzeRequestBody = {
  mode?: 'analyze'
  images: AnalyzeImageInput[]
  businessContext?: {
    businessName?: string
    industry?: string
    productService?: string
    brandDescription?: string
  }
  targetVideoFormat?: string
}

type ValidateRequestBody = {
  mode: 'validate'
  originalImageUrl: string
  editedImageUrl: string
  preserve?: string[]
  intendedOperation?: string
  businessContext?: {
    businessName?: string
    industry?: string
  }
}

type RequestBody = AnalyzeRequestBody | ValidateRequestBody

function isSupportedImageReference(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  if (value.length > MAX_DATA_URL_CHARS) return false
  if (value.startsWith('data:image/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function detailFor(categoryHint?: DiscoveredAssetCategory, validation = false): 'high' | 'original' {
  if (validation) return 'original'
  if (categoryHint === 'logo' || categoryHint === 'product' || categoryHint === 'branded_vehicle') {
    return 'original'
  }
  return 'high'
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload?.output)) return ''
  for (const item of payload.output) {
    if (item?.type !== 'message' || !Array.isArray(item?.content)) continue
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') return content.text
    }
  }
  return ''
}

function analysisSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['analyses'],
    properties: {
      analyses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'category',
            'confidence',
            'qualityScore',
            'relevanceScore',
            'targetRole',
            'preserve',
            'issues',
            'recommendedOperations',
            'transparencyRecommended',
            'precisionRecommended',
            'textDetected',
            'duplicateLikely',
            'summary',
          ],
          properties: {
            id: { type: 'string' },
            category: { type: 'string', enum: ALLOWED_CATEGORIES },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            qualityScore: { type: 'number', minimum: 0, maximum: 100 },
            relevanceScore: { type: 'number', minimum: 0, maximum: 100 },
            targetRole: { type: 'string' },
            preserve: { type: 'array', items: { type: 'string' } },
            issues: { type: 'array', items: { type: 'string' } },
            recommendedOperations: { type: 'array', items: { type: 'string' } },
            transparencyRecommended: { type: 'boolean' },
            precisionRecommended: { type: 'boolean' },
            textDetected: { type: 'boolean' },
            duplicateLikely: { type: 'boolean' },
            summary: { type: 'string' },
          },
        },
      },
    },
  }
}

function validationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['passed', 'confidence', 'issues', 'preserved', 'changed', 'summary'],
    properties: {
      passed: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
      issues: { type: 'array', items: { type: 'string' } },
      preserved: { type: 'array', items: { type: 'string' } },
      changed: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
    },
  }
}

async function callResponses(key: string, body: Record<string, unknown>) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110_000),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error ||
      `OpenAI Responses request failed (HTTP ${response.status})`
    const error = new Error(String(message)) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return payload
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const limit = rateLimit(`personalization-vision:${userId}`, { windowMs: 60_000, max: 12 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const key = await getOpenAiKeyForUser()
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_KEY_REQUIRED', message: 'Add your OpenAI API key in SmartVideo GO Settings.' },
      { status: 401 },
    )
  }

  try {
    const body = (await req.json()) as RequestBody
    const mode = body.mode || 'analyze'

    const visionModel = process.env.SMARTVIDEO_VISION_MODEL || 'gpt-6-astra'
    if (!ALLOWED_VISION_MODELS.has(visionModel)) {
      return NextResponse.json(
        {
          error: 'INVALID_VISION_MODEL',
          message: `Invalid SMARTVIDEO_VISION_MODEL "${visionModel}". Allowed values: ${Array.from(ALLOWED_VISION_MODELS).join(', ')}`,
        },
        { status: 500 },
      )
    }

    if (mode === 'validate') {
      const validateBody = body as ValidateRequestBody
      const originalImageUrl = validateBody.originalImageUrl
      const editedImageUrl = validateBody.editedImageUrl
      if (!isSupportedImageReference(originalImageUrl) || !isSupportedImageReference(editedImageUrl)) {
        return NextResponse.json({ error: 'Two valid image references are required.' }, { status: 400 })
      }

      const preserve = Array.isArray(validateBody.preserve)
        ? validateBody.preserve.map(String).filter(Boolean).slice(0, 20)
        : []
      const intendedOperation = String(validateBody.intendedOperation || 'image edit')
      const businessName = String(validateBody.businessContext?.businessName || '')
      const industry = String(validateBody.businessContext?.industry || '')

      const prompt =
        'You are SmartVideo GO visual QA. Compare image 1 (original) with image 2 (edited). ' +
        'Judge whether the intended edit succeeded without unintended changes. ' +
        'Pay special attention to identity, logos, product geometry, packaging, printed text, signage, phone numbers, URLs, brand colors, cropping, missing subjects, and artifacts. ' +
        `Intended operation: ${intendedOperation}. ` +
        (preserve.length ? `Things that should be preserved: ${preserve.join(', ')}. ` : '') +
        (businessName ? `Business: ${businessName}. ` : '') +
        (industry ? `Industry: ${industry}. ` : '') +
        'Set passed=false only when there is a meaningful unintended change or the intended edit clearly failed.'

      const payload = await callResponses(key, {
        model: VISION_MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_text', text: 'Image 1 — original' },
              { type: 'input_image', image_url: originalImageUrl, detail: detailFor(undefined, true) },
              { type: 'input_text', text: 'Image 2 — edited' },
              { type: 'input_image', image_url: editedImageUrl, detail: detailFor(undefined, true) },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'smartvideo_go_image_validation',
            strict: true,
            schema: validationSchema(),
          },
        },
        max_output_tokens: 1600,
      })

      const text = extractOutputText(payload)
      if (!text) throw new Error('Vision validation returned no structured output.')
      const parsed = JSON.parse(text)

      return NextResponse.json({
        validation: {
          ...parsed,
          analyzedAt: new Date().toISOString(),
          model: VISION_MODEL,
        },
      })
    }

    const analyzeBody = body as AnalyzeRequestBody
    const images = Array.isArray(analyzeBody.images) ? analyzeBody.images.slice(0, MAX_IMAGES) : []
    if (!images.length) {
      return NextResponse.json({ error: 'At least one image is required.' }, { status: 400 })
    }

    for (const image of images) {
      if (!image?.id || !isSupportedImageReference(image.imageUrl)) {
        return NextResponse.json({ error: 'Each image requires an id and valid imageUrl.' }, { status: 400 })
      }
    }

    const businessName = String(analyzeBody.businessContext?.businessName || '')
    const industry = String(analyzeBody.businessContext?.industry || '')
    const productService = String(analyzeBody.businessContext?.productService || '')
    const brandDescription = String(analyzeBody.businessContext?.brandDescription || '')
    const targetVideoFormat = String(analyzeBody.targetVideoFormat || '')

    const prompt =
      'You are the SmartVideo GO personalization vision planner. Analyze each supplied business image independently and return one analysis for every image id. ' +
      'Classify the asset into the allowed categories, score visual quality and business relevance from 0-100, identify important details that AI editing should preserve, identify practical visual issues, and recommend only editing operation ids that are useful. ' +
      'Do not recommend destructive creative changes unless clearly justified by the business context. ' +
      'For logos, products, branded vehicles, packaging, signage, CTA graphics, and images with small text, prioritize exact visual fidelity. ' +
      'For people, prioritize identity, face, hair, skin tone, clothing, and body proportions. ' +
      'Use duplicateLikely only when another supplied image appears to show essentially the same asset/content. ' +
      `Allowed operation ids: ${Array.from(OPERATION_IDS).join(', ')}. ` +
      (businessName ? `Business: ${businessName}. ` : '') +
      (industry ? `Industry: ${industry}. ` : '') +
      (productService ? `Product/service: ${productService}. ` : '') +
      (brandDescription ? `Brand description: ${brandDescription}. ` : '') +
      (targetVideoFormat ? `Target video format: ${targetVideoFormat}. ` : '')

    const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }]
    for (const image of images) {
      content.push({
        type: 'input_text',
        text:
          `Asset id: ${image.id}. ` +
          (image.categoryHint ? `Existing category hint: ${image.categoryHint}. ` : '') +
          (image.roleHint ? `Existing personalization role hint: ${image.roleHint}. ` : ''),
      })
      content.push({
        type: 'input_image',
        image_url: image.imageUrl,
        detail: detailFor(image.categoryHint),
      })
    }

    const payload = await callResponses(key, {
      model: VISION_MODEL,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'smartvideo_go_asset_analysis',
          strict: true,
          schema: analysisSchema(),
        },
      },
      max_output_tokens: 4000,
    })

    const outputText = extractOutputText(payload)
    if (!outputText) throw new Error('Vision analysis returned no structured output.')
    const parsed = JSON.parse(outputText)
    const analyses = Array.isArray(parsed?.analyses) ? parsed.analyses : []

    const normalized = analyses
      .filter((analysis: any) => images.some((image) => image.id === analysis?.id))
      .map((analysis: any) => ({
        ...analysis,
        recommendedOperations: Array.isArray(analysis.recommendedOperations)
          ? analysis.recommendedOperations.filter((id: unknown) => typeof id === 'string' && OPERATION_IDS.has(id))
          : [],
        analyzedAt: new Date().toISOString(),
        model: VISION_MODEL,
      }))

    return NextResponse.json({ analyses: normalized, model: VISION_MODEL })
  } catch (error) {
    const status =
      typeof (error as any)?.status === 'number' && (error as any).status >= 400
        ? (error as any).status
        : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Vision analysis failed.' },
      { status },
    )
  }
}
