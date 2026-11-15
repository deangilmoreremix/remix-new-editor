/**
 * Prompt Personalizer
 *
 * Rewrites the original prompt to include client-specific details while
 * preserving the creative concept, camera movement, lighting, pacing, etc.
 *
 * Uses the existing callOpenAIChat infrastructure from the AiAssistant.
 */

import { callOpenAIChat } from '@ohb/shared/api/openai'
import type { ClientProfile, AssetLibrary, PersonalizationAsset } from './types'

function buildVisionAssetIntelligence(assets: AssetLibrary): string {
  const all: Array<{ label: string; asset: PersonalizationAsset }> = []
  if (assets.primaryIdentity) all.push({ label: 'Presenter', asset: assets.primaryIdentity })
  if (assets.primaryLogo) all.push({ label: 'Logo', asset: assets.primaryLogo })
  assets.products.slice(0, 4).forEach((asset, index) => all.push({ label: 'Product/Service ' + (index + 1), asset }))
  assets.brandReferences.slice(0, 4).forEach((asset, index) => all.push({ label: 'Brand Reference ' + (index + 1), asset }))
  if (assets.firstFrame) all.push({ label: 'First Frame', asset: assets.firstFrame })
  if (assets.lastFrame) all.push({ label: 'Last Frame', asset: assets.lastFrame })
  if (assets.ctaGraphic) all.push({ label: 'CTA Graphic', asset: assets.ctaGraphic })

  return all
    .filter(({ asset }) => Boolean(asset.visionAnalysis || asset.videoReady))
    .map(({ label, asset }) => {
      const vision = asset.visionAnalysis
      const parts = [
        label + ': ' + (vision?.summary || asset.name),
        vision?.targetRole ? 'target role: ' + vision.targetRole : '',
        asset.sourceCategory ? 'asset type: ' + asset.sourceCategory.replace(/_/g, ' ') : '',
        vision?.preserve?.length ? 'protect: ' + vision.preserve.slice(0, 8).join(', ') : '',
        asset.videoReady ? 'status: video ready' : '',
      ].filter(Boolean)
      return '- ' + parts.join('; ')
    })
    .join('\n')
}
export interface PersonalizePromptInput {
  originalPrompt: string
  client: ClientProfile
  assets: AssetLibrary
  outputType: string
  /** Called when the AI call fails and the prompt is filled from the client's details instead. */
  onAiFailure?: (error: unknown) => void
}

export async function personalizePrompt({
  originalPrompt,
  client,
  assets,
  outputType,
  onAiFailure,
}: PersonalizePromptInput): Promise<string> {
  const identity = assets.primaryIdentity?.name || assets.identities[0]?.name || ''
  const logo = assets.primaryLogo?.name || ''
  const products = assets.products.map((p) => p.name).join(', ')
  const brandRefs = assets.brandReferences.map((b) => b.name).join(', ')
  const visionAssetIntelligence = buildVisionAssetIntelligence(assets)

  const systemPrompt = `You are a professional video/image prompt personalization engine for SmartVideo GO.
Your job is to PERSONALIZE an existing creative prompt for a specific client while preserving EVERY creative detail.

RULES:
1. PRESERVE: creative concept, camera movement, shot composition, lighting, pacing, visual style, scene structure, technical model instructions, aspect-ratio guidance, important motion instructions.
2. ONLY REPLACE generic/placeholder details with the client's actual information.
3. Do NOT invent missing facts. If a field is empty, skip it or keep the original generic reference.
4. Return ONLY the complete personalized prompt — no commentary, no quotes, no markdown.
5. The output must be a fully-formed generation prompt ready to send to an AI model.
6. When SmartVideo GO Vision asset intelligence is provided, use it to describe the real available assets accurately and honor its protection cues. Do not invent visual facts that Vision did not identify.
7. If an asset is marked video ready, prefer using that prepared asset as the intended visual reference rather than asking the generation model to redesign it.`

  const userPrompt = `ORIGINAL PROMPT:
${originalPrompt}

CLIENT INFORMATION:
${client.businessName ? `Business: ${client.businessName}` : ''}
${client.industry ? `Industry: ${client.industry}` : ''}
${client.location ? `Location: ${client.location}` : ''}
${client.productService ? `Product/Service: ${client.productService}` : ''}
${client.offer ? `Offer: ${client.offer}` : ''}
${client.ctaHeadline ? `CTA Headline: ${client.ctaHeadline}` : ''}
${client.callToAction ? `Button / Action: ${client.callToAction}` : ''}
${client.phone ? `Phone: ${client.phone}` : ''}
${client.website ? `Website: ${client.website}` : ''}
${client.brandDescription ? `Brand Description: ${client.brandDescription}` : ''}
${client.name ? `Contact Name: ${client.name}` : ''}

ASSETS AVAILABLE:
${identity ? `Presenter Identity: ${identity}` : ''}
${logo ? `Logo: ${logo}` : ''}
${products ? `Products/Services: ${products}` : ''}
${brandRefs ? `Brand References: ${brandRefs}` : ''}
${visionAssetIntelligence ? `\nSMARTVIDEO GO VISION ASSET INTELLIGENCE:\n${visionAssetIntelligence}` : ''}

OUTPUT TYPE: ${outputType}

PERSONALIZE THE PROMPT:
Replace generic references with the client's actual details. Keep the entire creative structure intact. Return ONLY the personalized prompt.`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ]

  try {
    const result = await callOpenAIChat(messages)
    const trimmed = result.trim()
    if (trimmed === originalPrompt) {
      throw new Error('PERSONALIZATION_NOOP')
    }
    return trimmed
  } catch (error) {
    console.error('Prompt personalization failed:', error)
    if (error instanceof Error && error.message === 'PERSONALIZATION_NOOP') {
      // The AI answered with the same prompt; not a connection problem.
    } else {
      onAiFailure?.(error)
    }
    let personalized = originalPrompt
    if (client.businessName) personalized = personalized.replace(/\{business_name\}/gi, client.businessName)
    if (client.productService) personalized = personalized.replace(/\{product\}/gi, client.productService)
    if (client.location) personalized = personalized.replace(/\{location\}/gi, client.location)
    if (client.offer) personalized = personalized.replace(/\{offer\}/gi, client.offer)
    if (client.ctaHeadline) personalized = personalized.replace(/\{cta_headline\}/gi, client.ctaHeadline)
    if (client.callToAction) personalized = personalized.replace(/\{cta_button\}/gi, client.callToAction)
    if (client.website) personalized = personalized.replace(/\{website\}/gi, client.website)
    if (client.phone) personalized = personalized.replace(/\{phone\}/gi, client.phone)
    return personalized
  }
}

export async function regeneratePrompt(
  originalPrompt: string,
  client: ClientProfile,
  assets: AssetLibrary,
  outputType: string,
): Promise<string> {
  return personalizePrompt({ originalPrompt, client, assets, outputType })
}
