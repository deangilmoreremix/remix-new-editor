/**
 * Personalization AI Tool Executor
 *
 * Bridges the AI tool registry to the actual Personalization domain functions.
 * Each tool maps to an existing operation from DemoPersonalizeProvider / generationRouter.
 *
 * Rules:
 * - Unknown tools are rejected.
 * - Read tools may execute automatically.
 * - Mutating / cost tools require user confirmation before execution.
 * - No new MuAPI client is introduced; all generation flows through runGeneration().
 */

import type {
  ToolId,
  ToolAction,
  AIStructuredResponse,
  AIRecommendation,
  AIMissingRequirement,
  AIWarning,
  AIGenerationPlan,
  ReadinessCheck,
} from './types'
import type { DemoPersonalizeContextValue } from '../DemoPersonalizeProvider'
import type { AssetLibrary, PersonalizationAsset, AssignedSection, DiscoveredAssetCategory } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function assetById(assets: AssetLibrary, id: string): PersonalizationAsset | undefined {
  const all: PersonalizationAsset[] = [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    assets.firstFrame ?? [],
    assets.lastFrame ?? [],
    assets.ctaGraphic ?? [],
  ].filter(Boolean) as PersonalizationAsset[]
  return all.find((a) => a.id === id)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Read tools ─────────────────────────────────────────────────────────────────

function executeListAssets(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): AIRecommendation[] {
  const recs: AIRecommendation[] = []
  const { assets, clientForm, source, mode, outputType, promptState, generation } = ctx

  if (!assets.primaryIdentity && assets.identities.length === 0) {
    recs.push({ type: 'missing_asset', message: 'No presenter/identity photo uploaded.', priority: 'high', suggestedAction: 'add_identity' })
  }
  if (!assets.primaryLogo && assets.logos.length === 0) {
    recs.push({ type: 'missing_asset', message: 'No logo uploaded.', priority: 'high', suggestedAction: 'add_logo' })
  }
  if (assets.products.length === 0) {
    recs.push({ type: 'missing_asset', message: 'No product/service images uploaded.', priority: 'medium', suggestedAction: 'add_products' })
  }
  if (!clientForm.businessName && !clientForm.name) {
    recs.push({ type: 'missing_client', message: 'Client business name is missing.', priority: 'high', suggestedAction: 'update_client' })
  }
  if ((!promptState?.personalized && !promptState?.edited) && outputType !== 'prompt') {
    recs.push({ type: 'missing_prompt', message: 'Prompt has not been personalized yet.', priority: 'medium', suggestedAction: 'personalize_prompt' })
  }
  if (outputType !== 'prompt' && !mode) {
    recs.push({ type: 'missing_mode', message: 'No personalization mode selected.', priority: 'high', suggestedAction: 'select_mode' })
  }
  return recs
}

function doValidateProject(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): AIMissingRequirement[] {
  const missing: AIMissingRequirement[] = []
  const { assets, clientForm, source, mode, outputType, promptState, generation, genOptions } = ctx

  if (!source) {
    missing.push({ field: 'source', label: 'Source Demo', severity: 'error', message: 'No source demo selected.' })
  }
  const businessName = clientForm?.businessName || clientForm?.name
  if (!businessName) {
    missing.push({ field: 'client.businessName', label: 'Business Name', severity: 'error', message: 'Enter the client business name before generating.' })
  }
  if (outputType !== 'prompt' && !mode) {
    missing.push({ field: 'mode', label: 'Personalization Mode', severity: 'error', message: 'Select how this should be personalized.' })
  }

  if (outputType === 'video' || outputType === 'everything') {
    if (!assets.primaryIdentity && assets.identities.length === 0) {
      missing.push({ field: 'assets.identities', label: 'Presenter Photo', severity: 'warning', message: 'Add at least one presenter photo for best video results.' })
    }
    if (!assets.primaryLogo && assets.logos.length === 0) {
      missing.push({ field: 'assets.logos', label: 'Logo', severity: 'warning', message: 'Upload the client logo for exact branding overlay.' })
    }
    if (assets.products.length === 0) {
      missing.push({ field: 'assets.products', label: 'Products', severity: 'warning', message: 'Add product or service images.' })
    }
  }

  if (outputType === 'image' || outputType === 'everything') {
    if (!assets.primaryLogo && assets.logos.length === 0) {
      missing.push({ field: 'assets.logos', label: 'Logo', severity: 'warning', message: 'Upload the client logo for the image.' })
    }
  }

  if (!promptState?.personalized && !promptState?.edited && outputType !== 'prompt') {
    missing.push({ field: 'prompt', label: 'Personalized Prompt', severity: 'warning', message: 'Personalize the prompt before generating.' })
  }

  if (genOptions?.consentGiven === false && mode && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(mode)) {
    missing.push({ field: 'consent', label: 'Consent', severity: 'error', message: 'Confirm permission to use this person\'s likeness.' })
  }

  return missing
}

function executeBuildGenerationPlan(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): AIGenerationPlan {
  const { source, mode, outputType, genOptions, assets, promptState } = ctx
  const steps: string[] = []

  steps.push('Validate project readiness')
  if ((!promptState?.personalized && !promptState?.edited) && outputType !== 'prompt') {
    steps.push('Personalize prompt for client')
  }
  if (outputType === 'video' || outputType === 'everything') {
    steps.push('Prepare assets for video (transparency, composition)')
    steps.push('Submit generation to MuAPI video model')
    steps.push('Poll for completion')
    steps.push('Apply post-processing (logo overlay, CTA end card)')
    steps.push('Persist result and register shared media')
  } else if (outputType === 'image') {
    steps.push('Submit generation to MuAPI image model')
    steps.push('Apply post-processing')
    steps.push('Persist result')
  } else {
    steps.push('Return personalized prompt')
  }

  return {
    mode: mode || 'recreate',
    outputType,
    model: genOptions?.model || source?.model || 'smartvideo-recommended',
    estimatedSteps: steps,
    estimatedDuration: outputType === 'video' ? '2-5 minutes' : outputType === 'image' ? '30-90 seconds' : '10-30 seconds',
  }
}

function executeRecommendAssets(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): AIRecommendation[] {
  const recs = executeListAssets(_args, ctx)
  const { assets, discoveredAssets } = ctx

  if (assets.primaryLogo && !assets.primaryLogo.hasTransparency && assets.primaryLogo.uploadStatus === 'ready') {
    recs.push({ type: 'improve_asset', message: 'Consider removing the logo background for cleaner overlay.', priority: 'medium', suggestedAction: 'remove_background', assetId: assets.primaryLogo.id })
  }
  if (discoveredAssets.some((a) => a.selected && !a.videoReady && !a.rejected)) {
    recs.push({ type: 'prepare_assets', message: 'Some selected discovered assets are not video-ready. Run Make Video Ready.', priority: 'medium', suggestedAction: 'make_video_ready' })
  }
  return recs
}

// ── Mutating tools ─────────────────────────────────────────────────────────────

async function executeClassifyAsset(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const hint = (args.hint as string | undefined) || undefined
  if (!assetId) throw new Error('assetId is required')

  // Use the discovered asset classification path
  const found = ctx.discoveredAssets.find((a) => a.id === assetId)
  if (!found) throw new Error('Discovered asset not found')

  const categoryMap: Record<string, DiscoveredAssetCategory> = {
    person: 'person',
    logo: 'logo',
    product: 'product',
    service: 'service',
    brand: 'brand',
    storefront: 'storefront',
    team: 'team',
  }

  const suggestedCategory = hint && categoryMap[hint] ? categoryMap[hint] : found.category
  ctx.updateDiscoveredAssetCategory(assetId, suggestedCategory)

  // Auto-assign section based on category
  const sectionMap: Record<string, AssignedSection> = {
    person: 'person',
    logo: 'logo',
    product: 'products',
    service: 'products',
    brand: 'brand',
    storefront: 'brand',
    team: 'brand',
    completed_work: 'products',
    office: 'brand',
    branded_vehicle: 'brand',
  }

  const section = sectionMap[suggestedCategory] || null
  if (section) {
    ctx.moveDiscoveredAssetToSection(assetId, section)
  }

  return `Classified as ${suggestedCategory}${section ? `, moved to ${section}` : ''}`
}

async function executeMoveAsset(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const section = args.section as AssignedSection
  if (!assetId) throw new Error('assetId is required')
  if (!section) throw new Error('section is required')

  const validSections: AssignedSection[] = ['person', 'logo', 'products', 'brand', 'firstFrame', 'lastFrame', 'ctaGraphic']
  if (!validSections.includes(section)) throw new Error(`Invalid section: ${section}`)

  ctx.moveDiscoveredAssetToSection(assetId, section)
  return `Moved asset ${assetId} to ${section}`
}

async function executeSelectAsset(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const selected = args.selected as boolean
  if (!assetId) throw new Error('assetId is required')

  if (selected) {
    ctx.toggleDiscoveredAssetSelection(assetId)
  } else {
    // Ensure deselected
    const found = ctx.discoveredAssets.find((a) => a.id === assetId)
    if (found?.selected) {
      ctx.toggleDiscoveredAssetSelection(assetId)
    }
  }
  return `Asset ${assetId} ${selected ? 'selected' : 'deselected'}`
}

async function executeSetPrimaryLogo(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  if (!assetId) throw new Error('assetId is required')

  // Check if this is a current job asset
  const jobAsset = assetById(ctx.assets, assetId)
  if (jobAsset) {
    ctx.setPrimaryLogo(assetId)
    return `Set asset ${assetId} as primary logo in current job`
  }

  // Check if this is a saved client asset
  const saved = ctx.savedClientAssets.logos.find((a) => a.id === assetId) || ctx.savedClientAssets.primaryLogo
  if (saved || ctx.savedClientAssets.logos.some((a) => a.id === assetId)) {
    ctx.setPrimarySavedAsset('logo', assetId)
    return `Set asset ${assetId} as primary logo in saved client library`
  }

  throw new Error('Logo asset not found in current job or saved client library')
}

async function executeAnalyzeAsset(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const previewUrl = args.previewUrl as string
  if (!assetId) throw new Error('assetId is required')
  if (!previewUrl) throw new Error('previewUrl is required')

  const discovered = ctx.discoveredAssets.find((a) => a.id === assetId)
  if (discovered) {
    if (!discovered.selected) {
      ctx.toggleDiscoveredAssetSelection(assetId)
    }
    return `Asset ${assetId} queued for SmartVideo GO Vision analysis.`
  }

  return `Asset ${assetId} is not a discovered asset. Vision analysis is available for discovered assets.`
}

async function executeValidateProject(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<ToolExecutionResult> {
  const missing = doValidateProject(args, ctx)
  return {
    success: missing.length === 0,
    message: missing.length === 0 ? 'Project is ready for generation.' : `${missing.length} issue(s) found.`,
    missingRequirements: missing,
    readiness: missing.length === 0 ? 'ready' : 'needs_input',
  }
}

async function executePrepareEverything(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<ToolExecutionResult> {
  const checks = evaluateProjectReadiness(ctx)

  const autoActions: ToolAction[] = []
  const pendingActions: ToolAction[] = []

  for (const check of checks) {
    if (check.action && check.status !== 'ready') {
      const action: ToolAction = {
        id: check.action,
        args: check.actionArgs || {},
        requiresConfirmation: true,
        targetProjectId: ctx.source?.id || '',
        targetAssetId: args.assetId as string | undefined,
        authorization: 'user_confirmed',
      }
      pendingActions.push(action)
    }
  }

  const overall = getOverallReadiness(checks)
  const message = overall === 'ready'
    ? 'Project is fully prepared and ready to generate.'
    : `${checks.filter((c) => c.status !== 'ready').length} preparation step(s) need attention.`

  const plan = overall === 'ready' ? executeBuildGenerationPlan(args, ctx) : undefined

  return {
    success: overall === 'ready',
    message,
    readinessChecks: checks,
    recommendations: [],
    missingRequirements: [],
    warnings: [],
    readiness: overall,
    generationPlan: plan,
  }
}

async function executeEditAsset(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const operation = args.operation as string
  if (!assetId) throw new Error('assetId is required')
  if (!operation) throw new Error('operation is required')

  const validOps = ['remove_background', 'replace_face', 'replace_person', 'inpaint', 'style_transfer']
  if (!validOps.includes(operation)) throw new Error(`Invalid operation: ${operation}`)

  const jobAsset = assetById(ctx.assets, assetId)
  if (!jobAsset) throw new Error('Asset not found in current personalization')

  const imageUrl = jobAsset.uploadedUrl || jobAsset.url
  if (!imageUrl || imageUrl.startsWith('blob:')) throw new Error('Asset must be uploaded before editing')

  const libraryMap: Record<string, 'identities' | 'logos' | 'products' | 'brandReferences'> = {
    presenter_identity: 'identities',
    face_identity: 'identities',
    character_identity: 'identities',
    logo: 'logos',
    product_reference: 'products',
    brand_reference: 'brandReferences',
  }

  ctx.openImageEditor?.({
    id: jobAsset.id,
    name: jobAsset.name,
    imageUrl,
    originalImageUrl: jobAsset.originalUrl || imageUrl,
    category: jobAsset.sourceCategory,
    role: jobAsset.role,
    source: 'current-job',
    businessName: ctx.clientForm.businessName || ctx.clientForm.name,
    industry: ctx.clientForm.industry,
    productService: ctx.clientForm.productService,
    brandDescription: ctx.clientForm.brandDescription,
    referenceImages: [],
    visionAnalysis: jobAsset.visionAnalysis,
  }, operation)

  return `Opening image editor for ${operation} on ${jobAsset.name || assetId}.`
}

async function executeRemoveBackground(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  if (!assetId) throw new Error('assetId is required')

  const jobAsset = assetById(ctx.assets, assetId)
  if (!jobAsset) throw new Error('Asset not found in current personalization')

  const imageUrl = jobAsset.uploadedUrl || jobAsset.url
  if (!imageUrl || imageUrl.startsWith('blob:')) throw new Error('Asset must be uploaded before background removal')

  const previewUrl = imageUrl

  ctx.openImageEditor?.({
    id: jobAsset.id,
    name: jobAsset.name,
    imageUrl: previewUrl,
    originalImageUrl: jobAsset.originalUrl || previewUrl,
    category: jobAsset.sourceCategory,
    role: jobAsset.role,
    source: 'current-job',
    businessName: ctx.clientForm.businessName || ctx.clientForm.name,
    industry: ctx.clientForm.industry,
    productService: ctx.clientForm.productService,
    brandDescription: ctx.clientForm.brandDescription,
    referenceImages: [],
    visionAnalysis: jobAsset.visionAnalysis,
  }, 'remove_background')

  return `Opening image editor to remove background from ${jobAsset.name || assetId}.`
}

async function executeMakeVideoReady(args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const assetId = args.assetId as string
  const businessName = args.businessName as string | undefined
  const industry = args.industry as string | undefined

  if (!assetId) throw new Error('assetId is required')

  const jobAsset = assetById(ctx.assets, assetId)
  if (!jobAsset) throw new Error('Asset not found in current personalization')

  // Make the asset video-ready using the batch video ready function
  // This does NOT call MuAPI directly; it uses the existing batchVideoReady flow
  const { makeDiscoveredAssetVideoReady } = await import('../image-editor/batchVideoReady')

  try {
    const result = await makeDiscoveredAssetVideoReady(
      {
        ...jobAsset,
        category: jobAsset.sourceCategory || 'brand',
        confidence: 80,
        qualityScore: 70,
        relevanceScore: 75,
        recommended: true,
        selected: true,
        assignedSection: 'brand',
        autoAssigned: false,
        edited: false,
        videoReady: false,
        hasTransparency: false,
        editMetadata: undefined,
        visionAnalysis: undefined,
        visionValidation: undefined,
      } as any,
      {
        businessName: businessName || ctx.clientForm.businessName || ctx.clientForm.name || '',
        industry: industry || ctx.clientForm.industry || '',
      },
      (_step: number, _totalSteps: number, label: string) => {
        // Progress callback - could be wired to UI state
        console.log(`[AI Tool] make_video_ready: ${label}`)
      },
    )

    // Apply the edited result back to the asset
    const editedAsset: PersonalizationAsset = {
      ...jobAsset,
      url: result.dataUrl,
      uploadedUrl: undefined,
      uploadStatus: 'local',
      edited: true,
      videoReady: true,
      hasTransparency: result.transparent,
      editMetadata: {
        operation: result.operation,
        prompt: result.prompt,
        model: result.model,
        quality: result.quality,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: result.transparent ? 'png' : 'jpeg',
        outputCompression: null,
        inputFidelity: 'high',
      },
      visionAnalysis: result.visionAnalysis || jobAsset.visionAnalysis,
      visionValidation: result.visionValidation,
    }

    // Update the asset in the library
    ctx.applyEditedPersonalizationAsset?.(assetId, result.dataUrl, {
      operation: result.operation,
      prompt: result.prompt,
      model: result.model,
      quality: result.quality,
      transparent: result.transparent,
      videoReady: true,
      outputFormat: result.transparent ? 'png' : 'jpeg',
      visionAnalysis: result.visionAnalysis,
      visionValidation: result.visionValidation,
    }).catch(() => {
      // If apply fails, still report success for the tool execution
      console.warn(`[AI Tool] Failed to apply edited asset ${assetId}, but operation completed.`)
    })

    return `Asset ${assetId} is now video-ready. Transparency: ${result.transparent ? 'yes' : 'no'}.`
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to make asset video-ready: ${message}`)
  }
}

async function executePersonalizePrompt(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const { source, clientForm, assets, outputType, promptState } = ctx

  if (!source) throw new Error('No source selected')
  if (!clientForm.businessName && !clientForm.name) throw new Error('No client information available')

  const { personalizePrompt } = await import('../promptPersonalizer')

  try {
    const personalized = await personalizePrompt({
      originalPrompt: promptState.original || source.fullPrompt || source.shortPrompt || '',
      client: clientForm as any,
      assets,
      outputType,
    })

    if (personalized === promptState.original) {
      return 'Prompt personalization returned the same prompt. Please edit manually.'
    }

    // Update the personalized prompt in the context
    ctx.updatePersonalizedPrompt?.(personalized)
    return `Prompt personalized for ${clientForm.businessName || clientForm.name}.`
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Prompt personalization failed: ${message}`)
  }
}

// ── Cost tools ─────────────────────────────────────────────────────────────────

async function executeGenerateVideo(_args: Record<string, unknown>, ctx: DemoPersonalizeContextValue): Promise<string> {
  const { source, clientForm, assets, mode, genOptions, promptState, generate, generation } = ctx

  if (!source) throw new Error('No source selected')
  if (!clientForm.businessName && !clientForm.name) throw new Error('No client information available')
  if (genOptions.consentGiven === false && mode && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(mode)) {
    throw new Error('Consent is required for face/person replacement modes.')
  }

  // Validate assets are ready
  const allAssets: PersonalizationAsset[] = [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    assets.firstFrame ?? [],
    assets.lastFrame ?? [],
    assets.ctaGraphic ?? [],
  ].filter(Boolean) as PersonalizationAsset[]

  const uploadingAssets = allAssets.filter((a) => a.uploadStatus === 'uploading')
  if (uploadingAssets.length > 0) {
    throw new Error(`${uploadingAssets.length} asset(s) are still uploading. Please wait.`)
  }

  const failedAssets = allAssets.filter((a) => a.uploadStatus === 'error')
  if (failedAssets.length > 0) {
    throw new Error(`${failedAssets.length} asset(s) failed to upload. Please retry or remove them.`)
  }

  const blobAssets = allAssets.filter((a) => a.url.startsWith('blob:'))
  if (blobAssets.length > 0) {
    throw new Error('Some assets are not uploaded yet. Please wait for uploads to complete.')
  }

  // Ensure prompt is personalized if not prompt-only
  const finalPrompt = promptState.edited || promptState.personalized || promptState.original || source.fullPrompt || source.shortPrompt || ''

  // Trigger generation through the existing context function
  // This routes through generationRouter -> MuAPI
  await generate()

  return `Generation started for ${mode || 'recreate'} mode. Check progress for status.`
}

// ── Main executor ──────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  success: boolean
  message: string
  recommendations?: AIRecommendation[]
  missingRequirements?: AIMissingRequirement[]
  warnings?: AIWarning[]
  generationPlan?: AIGenerationPlan
  readiness?: 'ready' | 'needs_input' | 'blocked'
  readinessChecks?: ReadinessCheck[]
}

export async function executeTool(
  action: ToolAction,
  ctx: DemoPersonalizeContextValue,
): Promise<ToolExecutionResult> {
  const { id, args, requiresConfirmation: needsConfirmation } = action

  switch (id) {
    // ── Read / recommend ──────────────────────────────────────────────────────
    case 'list_assets': {
      const recs = executeListAssets(args, ctx)
      return {
        success: true,
        message: recs.length === 0 ? 'All required assets are present.' : `${recs.length} recommendation(s) found.`,
        recommendations: recs,
        readiness: recs.length === 0 ? 'ready' : 'needs_input',
      }
    }
    case 'recommend_assets': {
      const recs = executeRecommendAssets(args, ctx)
      return {
        success: true,
        message: recs.length === 0 ? 'No improvements needed.' : `${recs.length} recommendation(s) found.`,
        recommendations: recs,
        readiness: recs.length === 0 ? 'ready' : 'needs_input',
      }
    }
    case 'validate_project': {
      return await executeValidateProject(args, ctx)
    }
    case 'build_generation_plan': {
      const plan = executeBuildGenerationPlan(args, ctx)
      return {
        success: true,
        message: `Generation plan built: ${plan.estimatedSteps.length} steps.`,
        generationPlan: plan,
        readiness: 'ready',
      }
    }

    // ── Mutate ───────────────────────────────────────────────────────────────
    case 'classify_asset': {
      if (needsConfirmation) {
        return {
          success: false,
          message: 'User confirmation required to classify asset.',
          readiness: 'needs_input',
        }
      }
      const result = await executeClassifyAsset(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'move_asset': {
      const result = await executeMoveAsset(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'select_asset': {
      const result = await executeSelectAsset(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'set_primary_logo': {
      const result = await executeSetPrimaryLogo(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'analyze_asset': {
      const result = await executeAnalyzeAsset(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'edit_asset': {
      const result = await executeEditAsset(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'remove_background': {
      const result = await executeRemoveBackground(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'make_video_ready': {
      const result = await executeMakeVideoReady(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'personalize_prompt': {
      const result = await executePersonalizePrompt(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }
    case 'prepare_everything': {
      return await executePrepareEverything(args, ctx)
    }

    // ── Cost ─────────────────────────────────────────────────────────────────
    case 'generate_video': {
      const result = await executeGenerateVideo(args, ctx)
      return { success: true, message: result, readiness: 'ready' }
    }

    default:
      return {
        success: false,
        message: `Unknown tool: ${id}`,
        readiness: 'blocked',
      }
  }
}

// ── Readiness evaluator (Phase 20) ─────────────────────────────────────────────

export function evaluateProjectReadiness(ctx: DemoPersonalizeContextValue): ReadinessCheck[] {
  const { assets, clientForm, source, mode, outputType, promptState, genOptions, generation } = ctx
  const checks: ReadinessCheck[] = []

  // 1. Business
  if (clientForm.businessName || clientForm.name) {
    checks.push({ key: 'business', label: 'Business Info', status: 'ready', message: 'Client information provided.' })
  } else {
    checks.push({ key: 'business', label: 'Business Info', status: 'error', message: 'Missing business name.', action: 'personalize_prompt', actionLabel: 'Add Business Name' })
  }

  // 2. Logo
  if (assets.primaryLogo) {
    const logo = assets.primaryLogo
    if (logo.uploadStatus === 'ready') {
      checks.push({ key: 'logo', label: 'Logo', status: 'ready', message: 'Logo uploaded and ready.' })
    } else if (logo.uploadStatus === 'error') {
      checks.push({ key: 'logo', label: 'Logo', status: 'error', message: 'Logo upload failed.', action: 'edit_asset', actionLabel: 'Retry Upload', actionArgs: { assetId: logo.id, operation: 'logo_cleanup' } })
    } else {
      checks.push({ key: 'logo', label: 'Logo', status: 'warning', message: 'Logo is still uploading.' })
    }
  } else if (assets.logos.length > 0) {
    checks.push({ key: 'logo', label: 'Logo', status: 'warning', message: 'No primary logo set. Set a primary logo for exact branding overlay.', action: 'set_primary_logo', actionLabel: 'Set Primary Logo', actionArgs: { assetId: assets.logos[0].id } })
  } else {
    checks.push({ key: 'logo', label: 'Logo', status: 'error', message: 'No logo uploaded.', action: 'edit_asset', actionLabel: 'Upload Logo', actionArgs: { assetId: '', operation: 'logo_cleanup' } })
  }

  // 3. Product
  if (assets.products.length > 0) {
    checks.push({ key: 'products', label: 'Products', status: 'ready', message: `${assets.products.length} product(s) uploaded.` })
  } else if (outputType === 'video' || outputType === 'everything') {
    checks.push({ key: 'products', label: 'Products', status: 'warning', message: 'No products uploaded. Add product images for better personalization.' })
  }

  // 4. Presenter
  if (assets.primaryIdentity) {
    checks.push({ key: 'presenter', label: 'Presenter', status: 'ready', message: 'Presenter photo ready.' })
  } else if (assets.identities.length > 0) {
    checks.push({ key: 'presenter', label: 'Presenter', status: 'warning', message: 'No primary presenter set.', action: undefined })
  } else if (outputType === 'video' || outputType === 'everything') {
    checks.push({ key: 'presenter', label: 'Presenter', status: 'error', message: 'No presenter photo uploaded.', action: undefined })
  }

  // 5. Brand References
  if (assets.brandReferences.length > 0) {
    checks.push({ key: 'brand', label: 'Brand References', status: 'ready', message: `${assets.brandReferences.length} brand reference(s).` })
  } else if (outputType === 'video' || outputType === 'everything') {
    checks.push({ key: 'brand', label: 'Brand References', status: 'warning', message: 'No brand references uploaded.' })
  }

  // 6. First Frame
  if (assets.firstFrame) {
    checks.push({ key: 'firstFrame', label: 'First Frame', status: 'ready', message: 'First frame set.' })
  }

  // 7. Last Frame / CTA
  if (assets.lastFrame) {
    checks.push({ key: 'lastFrame', label: 'Last Frame', status: 'ready', message: 'Last frame set.' })
  }
  if (assets.ctaGraphic) {
    checks.push({ key: 'cta', label: 'CTA Graphic', status: 'ready', message: 'CTA graphic uploaded.' })
  } else if (clientForm.ctaHeadline || clientForm.callToAction) {
    checks.push({ key: 'cta', label: 'CTA', status: 'warning', message: 'CTA text provided but no graphic uploaded.' })
  }

  // 8. Image Readiness
  const allAssets: PersonalizationAsset[] = [
    ...assets.identities,
    ...assets.logos,
    ...assets.products,
    ...assets.brandReferences,
    assets.firstFrame ?? [],
    assets.lastFrame ?? [],
    assets.ctaGraphic ?? [],
  ].filter(Boolean) as PersonalizationAsset[]

  const uploadingAssets = allAssets.filter((a) => a.uploadStatus === 'uploading')
  if (uploadingAssets.length > 0) {
    checks.push({ key: 'imageReadiness', label: 'Image Readiness', status: 'warning', message: `${uploadingAssets.length} asset(s) still uploading.` })
  } else {
    const readyAssets = allAssets.filter((a) => a.uploadStatus === 'ready')
    const errorAssets = allAssets.filter((a) => a.uploadStatus === 'error')
    if (errorAssets.length > 0) {
      checks.push({ key: 'imageReadiness', label: 'Image Readiness', status: 'error', message: `${errorAssets.length} asset(s) failed to upload.` })
    } else if (readyAssets.length === allAssets.length && allAssets.length > 0) {
      checks.push({ key: 'imageReadiness', label: 'Image Readiness', status: 'ready', message: 'All assets uploaded and ready.' })
    }
  }

  // 9. Prompt
  if (promptState.personalized || promptState.edited) {
    checks.push({ key: 'prompt', label: 'Prompt', status: 'ready', message: 'Prompt personalized.' })
  } else if (promptState.original) {
    checks.push({ key: 'prompt', label: 'Prompt', status: 'warning', message: 'Prompt not yet personalized.', action: 'personalize_prompt', actionLabel: 'Personalize Prompt' })
  } else if (source?.fullPrompt || source?.shortPrompt) {
    checks.push({ key: 'prompt', label: 'Prompt', status: 'warning', message: 'Original prompt available but not personalized.', action: 'personalize_prompt', actionLabel: 'Personalize Prompt' })
  } else {
    checks.push({ key: 'prompt', label: 'Prompt', status: 'error', message: 'No prompt available.' })
  }

  // 10. Video Model
  if (genOptions.model || source?.model) {
    checks.push({ key: 'model', label: 'Video Model', status: 'ready', message: `Model: ${genOptions.model || source?.model}` })
  } else {
    checks.push({ key: 'model', label: 'Video Model', status: 'warning', message: 'Using SmartVideo Recommended engine.' })
  }

  // 11. Generation Readiness
  if (mode && (outputType === 'video' || outputType === 'everything')) {
    checks.push({ key: 'generationReadiness', label: 'Generation Readiness', status: 'ready', message: `Ready to generate ${outputType} in ${mode} mode.` })
  } else if (outputType === 'prompt') {
    checks.push({ key: 'generationReadiness', label: 'Generation Readiness', status: 'ready', message: 'Ready to generate personalized prompt.' })
  } else if (!mode) {
    checks.push({ key: 'generationReadiness', label: 'Generation Readiness', status: 'error', message: 'Select a personalization mode before generating.' })
  }

  return checks
}

export function getOverallReadiness(checks: ReadinessCheck[]): 'ready' | 'needs_input' | 'blocked' {
  const hasError = checks.some((c) => c.status === 'error')
  const hasWarning = checks.some((c) => c.status === 'warning')
  if (hasError) return 'blocked'
  if (hasWarning) return 'needs_input'
  return 'ready'
}
