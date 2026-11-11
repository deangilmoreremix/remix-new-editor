import type {
  PersonalizationSource,
  ClientProfile,
  AssetLibrary,
  PromptState,
  OutputType,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  GenerationOptions,
  GenerationState,
  DiscoveredAsset,
  PersonalizationVisionAnalysis,
  BusinessResearchResult,
  PersonalizationAsset,
} from '../types'

/**
 * AI Assist context types
 */

export interface AIAssistContext {
  project: {
    id: string | null
    sourceType: string | null
    mediaType: string | null
    sourceMediaUrl: string | null
    posterUrl: string | null
    title: string | null
    model: string | null
    duration: number | null
    aspectRatio: string | null
    category: string | null
    sourceUrl: string | null
    sourceMetadata: Record<string, unknown>
  }
  client: {
    id: string | null
    audience: string | null
    businessName: string | null
    industry: string | null
    location: string | null
    productService: string | null
    offer: string | null
    ctaHeadline: string | null
    callToAction: string | null
    phone: string | null
    website: string | null
    brandDescription: string | null
  }
  business: {
    id: string
    name: string
    category: string
    website: string | null
    research: {
      title: string | null
      description: string | null
      logoUrl: string | null
      socialLinks: Record<string, string>
      reachable: boolean
    } | null
  } | null
  assets: {
    identities: Array<{
      id: string
      role: string
      name: string
      url: string
      status: string
      isPrimary: boolean
      edited: boolean
      videoReady: boolean
      hasTransparency: boolean
      editMetadata: {
        operation: string | null
        model: string | null
        quality: string | null
        responseId: string | null
      } | null
      visionAnalysis: {
        category: string
        confidence: number
        qualityScore: number
        relevanceScore: number
        summary: string
        issues: string[]
        recommendedOperations: string[]
        transparencyRecommended: boolean
        precisionRecommended: boolean
        textDetected: boolean
        duplicateLikely: boolean
      } | null
    }>
    primaryIdentity: { id: string; role: string; name: string; url: string; isPrimary: boolean; edited: boolean; videoReady: boolean } | null
    logos: Array<{ id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean }>
    primaryLogo: { id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean } | null
    products: Array<{ id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean }>
    brandReferences: Array<{ id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean }>
    firstFrame: { id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean } | null
    lastFrame: { id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean } | null
    ctaGraphic: { id: string; role: string; name: string; url: string; status: string; isPrimary: boolean; edited: boolean; videoReady: boolean } | null
    discovered: Array<{
      id: string
      sourceUrl: string
      previewUrl: string
      sourceType: string
      category: string
      confidence: number | null
      qualityScore: number | null
      relevanceScore: number | null
      selected: boolean
      rejected: boolean
      assignedSection: string | null
      autoAssigned: boolean
      edited: boolean
      videoReady: boolean
      hasTransparency: boolean
      visionAnalysis: {
        category: string
        confidence: number
        qualityScore: number
        relevanceScore: number
        summary: string
        issues: string[]
        recommendedOperations: string[]
        transparencyRecommended: boolean
        precisionRecommended: boolean
        textDetected: boolean
        duplicateLikely: boolean
      } | null
    }>
    visionSummaries: Array<{
      assetId: string
      category: string
      confidence: number
      qualityScore: number
      relevanceScore: number
      summary: string
      issues: string[]
      recommendedOperations: string[]
      transparencyRecommended: boolean
      precisionRecommended: boolean
      textDetected: boolean
      duplicateLikely: boolean
    }>
  }
  prompt: {
    original: string | null
    personalized: string | null
    edited: string | null
  }
  generationSettings: {
    outputType: string
    mode: string | null
    engine: string
    preserveAudio: boolean
    exactLogoHandling: string
    exactCtaHandling: string
    firstFrameMode: string
    lastFrameMode: string
    consentGiven: boolean
    aspectRatio: string | null
    duration: number | null
    quality: string | null
    resolution: string | null
    advancedModel: string | null
  }
  readiness: {
    hasClient: boolean
    hasAssets: boolean
    hasPrompt: boolean
    hasMode: boolean
    hasOutputType: boolean
    hasSource: boolean
    allAssetsReady: boolean
    allAssetsVideoReady: boolean
    ctaReady: boolean
  }
  discoveredAssetCount: number
  selectedDiscoveredCount: number
  visionAnalysisCount: number
  generationStatus: string
  cta: {
    graphicAssetId: string | null
    graphicUrl: string | null
    headline: string | null
    buttonText: string | null
  }
}

export function buildAIAssistContext(params: {
  source: PersonalizationSource | null
  client: Partial<ClientProfile>
  assets: AssetLibrary
  promptState: PromptState
  outputType: OutputType
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  genOptions: GenerationOptions
  generation: GenerationState
  discoveredAssets: DiscoveredAsset[]
  visionAnalyses: Map<string, PersonalizationVisionAnalysis>
  selectedBusiness: { id: string; name: string; category: string; website?: string } | null
  businessResearch: BusinessResearchResult | null
  readiness: {
    hasClient: boolean
    hasAssets: boolean
    hasPrompt: boolean
    hasMode: boolean
    hasOutputType: boolean
    hasSource: boolean
    allAssetsReady: boolean
    allAssetsVideoReady: boolean
    ctaReady: boolean
  }
}): AIAssistContext {
  const {
    source,
    client,
    assets,
    promptState,
    outputType,
    mode,
    genOptions,
    generation,
    discoveredAssets,
    visionAnalyses,
    selectedBusiness,
    businessResearch,
    readiness,
  } = params

  const assetSummaries = buildAssetSummaries(assets, discoveredAssets, visionAnalyses)

  return {
    project: {
      id: source?.id || null,
      sourceType: source?.sourceType || null,
      mediaType: source?.mediaType || null,
      sourceMediaUrl: source?.sourceMedia || null,
      posterUrl: source?.poster || null,
      title: source?.title || null,
      model: source?.model || genOptions.model || null,
      duration: source?.duration || null,
      aspectRatio: source?.aspectRatio || null,
      category: source?.category || null,
      sourceUrl: source?.sourceUrl || null,
      sourceMetadata: source?.sourceMetadata || {},
    },
    client: {
      id: client.id || null,
      audience: client.audience || null,
      businessName: client.businessName || client.name || null,
      industry: client.industry || null,
      location: client.location || null,
      productService: client.productService || null,
      offer: client.offer || null,
      ctaHeadline: client.ctaHeadline || null,
      callToAction: client.callToAction || null,
      phone: client.phone || null,
      website: client.website || null,
      brandDescription: client.brandDescription || null,
    },
    business: selectedBusiness
      ? {
          id: selectedBusiness.id,
          name: selectedBusiness.name,
          category: selectedBusiness.category,
          website: selectedBusiness.website || null,
          research: businessResearch
            ? {
                title: businessResearch.title || null,
                description: businessResearch.description || null,
                logoUrl: businessResearch.logoUrl || null,
                socialLinks: Object.fromEntries(
                  Object.entries(businessResearch.socialLinks || {}).filter(([, v]) => v),
                ) as Record<string, string>,
                reachable: businessResearch.reachable,
              }
            : null,
        }
      : null,
    assets: assetSummaries,
    prompt: {
      original: promptState.original || null,
      personalized: promptState.personalized || null,
      edited: promptState.edited || null,
    },
    generationSettings: {
      outputType,
      mode: mode || null,
      engine: genOptions.engine,
      preserveAudio: genOptions.preserveAudio,
      exactLogoHandling: genOptions.exactLogoHandling,
      exactCtaHandling: genOptions.exactCtaHandling,
      firstFrameMode: genOptions.firstFrameMode,
      lastFrameMode: genOptions.lastFrameMode,
      consentGiven: genOptions.consentGiven,
      aspectRatio: genOptions.aspectRatio || null,
      duration: genOptions.duration || null,
      quality: genOptions.quality || null,
      resolution: genOptions.resolution || null,
      advancedModel: genOptions.advancedModel || null,
    },
    readiness,
    discoveredAssetCount: discoveredAssets.length,
    selectedDiscoveredCount: discoveredAssets.filter((a) => a.selected && !a.rejected).length,
    visionAnalysisCount: visionAnalyses.size,
    generationStatus: generation.status,
    cta: {
      graphicAssetId: assets.ctaGraphic?.id || null,
      graphicUrl: assets.ctaGraphic?.uploadedUrl || assets.ctaGraphic?.url || null,
      headline: client.ctaHeadline || null,
      buttonText: client.callToAction || null,
    },
  }
}

function buildAssetSummaries(
  assets: AssetLibrary,
  discoveredAssets: DiscoveredAsset[],
  visionAnalyses: Map<string, PersonalizationVisionAnalysis>,
): AIAssistContext['assets'] {
  const allDiscovered = discoveredAssets.filter((a) => !a.rejected)
  const effectivePrimaryIdentity = assets.primaryIdentity || assets.identities.find((i) => i.isPrimary) || null
  const effectivePrimaryLogo = assets.primaryLogo || assets.logos.find((l) => l.isPrimary) || null

  return {
    identities: assets.identities.map(summarizeAsset),
    primaryIdentity: effectivePrimaryIdentity ? summarizeAsset(effectivePrimaryIdentity) : null,
    logos: assets.logos.map(summarizeAsset),
    primaryLogo: effectivePrimaryLogo ? summarizeAsset(effectivePrimaryLogo) : null,
    products: assets.products.map(summarizeAsset),
    brandReferences: assets.brandReferences.map(summarizeAsset),
    firstFrame: assets.firstFrame ? summarizeAsset(assets.firstFrame) : null,
    lastFrame: assets.lastFrame ? summarizeAsset(assets.lastFrame) : null,
    ctaGraphic: assets.ctaGraphic ? summarizeAsset(assets.ctaGraphic) : null,
    discovered: allDiscovered.map(summarizeDiscoveredAsset),
    visionSummaries: [
      ...Array.from(visionAnalyses.values()).map((v) => ({
        assetId: v.targetRole,
        category: v.category,
        confidence: v.confidence,
        qualityScore: v.qualityScore,
        relevanceScore: v.relevanceScore,
        summary: v.summary,
        issues: v.issues,
        recommendedOperations: v.recommendedOperations,
        transparencyRecommended: v.transparencyRecommended,
        precisionRecommended: v.precisionRecommended,
        textDetected: v.textDetected,
        duplicateLikely: v.duplicateLikely,
      })),
      ...allDiscovered
        .filter((a) => a.visionAnalysis)
        .map((a) => ({
          assetId: a.id,
          category: a.visionAnalysis!.category,
          confidence: a.visionAnalysis!.confidence,
          qualityScore: a.visionAnalysis!.qualityScore,
          relevanceScore: a.visionAnalysis!.relevanceScore,
          summary: a.visionAnalysis!.summary,
          issues: a.visionAnalysis!.issues,
          recommendedOperations: a.visionAnalysis!.recommendedOperations,
          transparencyRecommended: a.visionAnalysis!.transparencyRecommended,
          precisionRecommended: a.visionAnalysis!.precisionRecommended,
          textDetected: a.visionAnalysis!.textDetected,
          duplicateLikely: a.visionAnalysis!.duplicateLikely,
        })),
    ],
  }
}

function summarizeAsset(asset: PersonalizationAsset): AIAssistContext['assets']['identities'][number] {
  return {
    id: asset.id,
    role: asset.role,
    name: asset.name,
    url: asset.uploadedUrl || asset.url,
    status: asset.uploadStatus || 'local',
    isPrimary: asset.isPrimary,
    edited: asset.edited || false,
    videoReady: asset.videoReady || false,
    hasTransparency: asset.hasTransparency || false,
    editMetadata: asset.editMetadata
      ? {
          operation: asset.editMetadata.operation || null,
          model: asset.editMetadata.model || null,
          quality: asset.editMetadata.quality || null,
          responseId: asset.editMetadata.responseId || null,
        }
      : null,
    visionAnalysis: asset.visionAnalysis
      ? {
          category: asset.visionAnalysis.category,
          confidence: asset.visionAnalysis.confidence,
          qualityScore: asset.visionAnalysis.qualityScore,
          relevanceScore: asset.visionAnalysis.relevanceScore,
          summary: asset.visionAnalysis.summary,
          issues: asset.visionAnalysis.issues,
          recommendedOperations: asset.visionAnalysis.recommendedOperations,
          transparencyRecommended: asset.visionAnalysis.transparencyRecommended,
          precisionRecommended: asset.visionAnalysis.precisionRecommended,
          textDetected: asset.visionAnalysis.textDetected,
          duplicateLikely: asset.visionAnalysis.duplicateLikely,
        }
      : null,
  }
}

function summarizeDiscoveredAsset(asset: DiscoveredAsset): AIAssistContext['assets']['discovered'][number] {
  return {
    id: asset.id,
    sourceUrl: asset.sourceUrl,
    previewUrl: asset.previewUrl,
    sourceType: asset.sourceType,
    category: asset.category,
    confidence: asset.confidence || null,
    qualityScore: asset.qualityScore || null,
    relevanceScore: asset.relevanceScore || null,
    selected: asset.selected,
    rejected: asset.rejected,
    assignedSection: asset.assignedSection,
    autoAssigned: asset.autoAssigned,
    edited: asset.edited || false,
    videoReady: asset.videoReady || false,
    hasTransparency: asset.hasTransparency || false,
    visionAnalysis: asset.visionAnalysis
      ? {
          category: asset.visionAnalysis.category,
          confidence: asset.visionAnalysis.confidence,
          qualityScore: asset.visionAnalysis.qualityScore,
          relevanceScore: asset.visionAnalysis.relevanceScore,
          summary: asset.visionAnalysis.summary,
          issues: asset.visionAnalysis.issues,
          recommendedOperations: asset.visionAnalysis.recommendedOperations,
          transparencyRecommended: asset.visionAnalysis.transparencyRecommended,
          precisionRecommended: asset.visionAnalysis.precisionRecommended,
          textDetected: asset.visionAnalysis.textDetected,
          duplicateLikely: asset.visionAnalysis.duplicateLikely,
        }
      : null,
  }
}
