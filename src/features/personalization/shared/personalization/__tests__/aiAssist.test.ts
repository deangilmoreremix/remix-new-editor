// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateToolAction, getToolDefinition, TOOL_REGISTRY, isReadTool, isMutatingTool, isCostTool, requiresConfirmation } from '../ai/toolRegistry'
import { executeTool } from '../ai/toolExecutor'
import { buildStructuredAIResponse } from '../ai/responseBuilder'
import { buildAIAssistContext } from '../ai/contextProvider'
import type { AIAssistContext } from '../ai/contextProvider'
import type { ToolAction } from '../ai/types'
import type { PersonalizationSource, AssetLibrary, PromptState, GenerationState, DiscoveredAsset } from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function createSource(overrides: Partial<PersonalizationSource> = {}): PersonalizationSource {
  return {
    id: 'src_1',
    sourceType: 'go-ai-viral-video',
    mediaType: 'video',
    sourceMedia: 'https://example.com/source.mp4',
    poster: 'https://example.com/poster.jpg',
    title: 'Test Demo',
    fullPrompt: 'A presenter speaking to camera about roofing',
    originalPrompt: 'A presenter speaking to camera about roofing',
    shortPrompt: 'Roofing presenter',
    model: 'seedance',
    duration: 30,
    aspectRatio: '16:9',
    category: 'home-services',
    sourceUrl: 'https://example.com/demo',
    sourceMetadata: { nicheId: 'home-services' },
    ...overrides,
  }
}

function createAssetLibrary(overrides: Partial<AssetLibrary> = {}): AssetLibrary {
  return {
    identities: [],
    primaryIdentity: null,
    logos: [],
    primaryLogo: null,
    products: [],
    brandReferences: [],
    firstFrame: null,
    lastFrame: null,
    ctaGraphic: null,
    audio: [],
    savedReferences: [],
    ...overrides,
  }
}

function createPromptState(overrides: Partial<PromptState> = {}): PromptState {
  return {
    original: 'Original prompt',
    personalized: '',
    edited: '',
    ...overrides,
  }
}

function createGenerationState(overrides: Partial<GenerationState> = {}): GenerationState {
  return {
    status: 'idle',
    progress: 0,
    progressMessage: '',
    errorMessage: null,
    failedStage: undefined,
    ...overrides,
  }
}

function createDiscoveredAsset(overrides: Partial<DiscoveredAsset> = {}): DiscoveredAsset {
  return {
    id: 'disc_1',
    sourceUrl: 'https://example.com/asset.jpg',
    previewUrl: 'https://example.com/asset.jpg',
    sourceType: 'WEBSITE',
    category: 'logo',
    confidence: 80,
    qualityScore: 70,
    relevanceScore: 75,
    selected: false,
    recommended: false,
    rejected: false,
    assignedSection: 'logo',
    autoAssigned: false,
    originalPreviewUrl: 'https://example.com/asset.jpg',
    edited: false,
    videoReady: false,
    hasTransparency: false,
    editMetadata: undefined,
    visionAnalysis: undefined,
    visionValidation: undefined,
    ...overrides,
  }
}

function buildContext(overrides: {
  source?: Partial<PersonalizationSource> | null
  assets?: Partial<AssetLibrary>
  promptState?: Partial<PromptState>
  generation?: Partial<GenerationState>
  discoveredAssets?: DiscoveredAsset[]
} = {}): AIAssistContext {
  const source = overrides.source === null ? null : createSource(overrides.source)
  const assets = createAssetLibrary(overrides.assets)
  const promptState = createPromptState(overrides.promptState)
  const generation = createGenerationState(overrides.generation)
  const discoveredAssets = overrides.discoveredAssets || []

  return buildAIAssistContext({
    source,
    client: { businessName: 'Test Business' },
    assets,
    promptState,
    outputType: 'video',
    mode: 'recreate',
    genOptions: { model: 'seedance', consentGiven: true } as any,
    generation,
    discoveredAssets,
    visionAnalyses: new Map(),
    selectedBusiness: null,
    businessResearch: null,
    readiness: {
      hasClient: true,
      hasAssets: true,
      hasPrompt: true,
      hasMode: true,
      hasOutputType: true,
      hasSource: true,
      allAssetsReady: true,
      allAssetsVideoReady: true,
      ctaReady: true,
    },
  })
}

// ── Tool Registry Tests ────────────────────────────────────────────────────────

describe('AI Assist Tool Registry', () => {
  it('registers all 14 tools', () => {
    expect(TOOL_REGISTRY.size).toBe(15)
  })

  it('rejects unknown tool IDs', () => {
    const result = validateToolAction({ id: 'unknown_tool' as any, args: {}, targetProjectId: 'p1' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })

  it('rejects missing required args', () => {
    const result = validateToolAction({ id: 'move_asset', args: { assetId: 'a1' }, targetProjectId: 'p1' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing required args')
  })

  it('rejects invalid arg values', () => {
    const result = validateToolAction({ id: 'move_asset', args: { assetId: 'a1', section: 'invalid_section' }, targetProjectId: 'p1' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid arguments')
  })

  it('accepts valid tool action', () => {
    const result = validateToolAction({ id: 'list_assets', args: {}, targetProjectId: 'p1' })
    expect(result.valid).toBe(true)
  })

  it('categorizes read tools correctly', () => {
    expect(isReadTool('read')).toBe(true)
    expect(isReadTool('recommend')).toBe(true)
    expect(isReadTool('mutate')).toBe(false)
    expect(isReadTool('cost')).toBe(false)
  })

  it('categorizes mutating tools correctly', () => {
    expect(isMutatingTool('mutate')).toBe(true)
    expect(isMutatingTool('read')).toBe(false)
  })

  it('categorizes cost tools correctly', () => {
    expect(isCostTool('cost')).toBe(true)
    expect(isCostTool('read')).toBe(false)
  })

  it('requires confirmation for cost tools', () => {
    expect(requiresConfirmation('cost', false)).toBe(true)
  })

  it('requires confirmation for mutating tools when tool flag is set', () => {
    expect(requiresConfirmation('mutate', true)).toBe(true)
    expect(requiresConfirmation('mutate', false)).toBe(false)
  })

  it('does not require confirmation for read/recommend tools', () => {
    expect(requiresConfirmation('read', false)).toBe(false)
    expect(requiresConfirmation('recommend', false)).toBe(false)
  })

  it('looks up tool definitions by ID', () => {
    const def = getToolDefinition('generate_video')
    expect(def?.id).toBe('generate_video')
    expect(def?.category).toBe('cost')
    expect(def?.requiresConfirmation).toBe(true)
  })

  it('marks list_assets as read and no confirmation', () => {
    const def = getToolDefinition('list_assets')
    expect(def?.category).toBe('read')
    expect(def?.requiresConfirmation).toBe(false)
  })

  it('marks build_generation_plan as read and no confirmation', () => {
    const def = getToolDefinition('build_generation_plan')
    expect(def?.category).toBe('read')
    expect(def?.requiresConfirmation).toBe(false)
  })
})

// ── Response Builder Tests ─────────────────────────────────────────────────────

describe('AI Assist Response Builder', () => {
  it('returns blocked readiness when client is missing', () => {
    const ctxWithoutClient = buildContext({})
    const response = buildStructuredAIResponse('help', {
      ...ctxWithoutClient,
      client: { businessName: null, industry: null, location: null, productService: null, offer: null, ctaHeadline: null, callToAction: null, phone: null, website: null, brandDescription: null, audience: null, id: null },
    })
    expect(response.readiness).toBe('blocked')
    expect(response.missingRequirements.some((r) => r.field === 'client')).toBe(true)
  })

  it('returns blocked when source is missing', () => {
    const ctx = buildContext({ source: null as any })
    const response = buildStructuredAIResponse('help', ctx)
    expect(response.readiness).toBe('blocked')
  })

  it('returns blocked when mode is missing for non-prompt output', () => {
    const ctx = buildContext({})
    const ctxNoMode = {
      ...ctx,
      generationSettings: { ...ctx.generationSettings, mode: null, outputType: 'video' },
    }
    const response = buildStructuredAIResponse('help', ctxNoMode)
    expect(response.readiness).toBe('blocked')
    expect(response.missingRequirements.some((r) => r.field === 'mode')).toBe(true)
  })

  it('suggests adding assets when none uploaded', () => {
    const ctx = buildContext({
      assets: { identities: [], logos: [], products: [], brandReferences: [], firstFrame: null, lastFrame: null, ctaGraphic: null, primaryIdentity: null, primaryLogo: null },
    })
    const response = buildStructuredAIResponse('what do i need', ctx)
    expect(response.recommendations.some((r) => r.type === 'add_assets')).toBe(true)
  })

  it('flags unselected discovered assets', () => {
    const discovered = [
      createDiscoveredAsset({ id: 'd1', selected: false, rejected: false, assignedSection: null }),
      createDiscoveredAsset({ id: 'd2', selected: true, rejected: false }),
    ]
    const ctx = buildContext({ discoveredAssets: discovered })
    const response = buildStructuredAIResponse('help', ctx)
    expect(response.recommendations.some((r) => r.type === 'import_discovered')).toBe(true)
  })

  it('flags non-video-ready selected assets', () => {
    const discovered = [
      createDiscoveredAsset({ id: 'd1', selected: true, rejected: false, videoReady: false }),
    ]
    const ctx = buildContext({ discoveredAssets: discovered })
    const response = buildStructuredAIResponse('help', ctx)
    expect(response.recommendations.some((r) => r.type === 'make_video_ready')).toBe(true)
  })

  it('warns about consent for face modes', () => {
    const ctx = buildContext({})
    const ctxNoConsent = {
      ...ctx,
      generationSettings: { ...ctx.generationSettings, mode: 'face_only', consentGiven: false },
    }
    const response = buildStructuredAIResponse('help', ctxNoConsent)
    expect(response.warnings.some((w) => w.code === 'consent_not_given')).toBe(true)
  })

  it('includes generation plan when user asks about plan', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('build a plan', ctx)
    expect(response.actions.some((a) => a.id === 'build_generation_plan')).toBe(true)
    expect(response.generationPlan).toBeDefined()
  })

  it('auto_executes read actions', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('validate project', ctx)
    expect(response.actions.some((a) => a.id === 'validate_project' && a.authorization === 'auto_execute')).toBe(true)
  })

  it('requires confirmation for generate_video', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('generate video', ctx)
    expect(response.actions.some((a) => a.id === 'generate_video' && a.authorization === 'user_confirmed')).toBe(true)
  })

  it('requires confirmation for personalize_prompt', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('personalize my prompt', ctx)
    expect(response.actions.some((a) => a.id === 'personalize_prompt' && a.authorization === 'user_confirmed')).toBe(true)
  })
})

// ── Tool Executor Tests ────────────────────────────────────────────────────────

describe('AI Assist Tool Executor', () => {
  it('rejects unknown tools', async () => {
    const ctx = buildContext({})
    const action: ToolAction = { id: 'unknown_tool' as any, args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, {
      ...ctx,
      clientForm: { businessName: 'Test' },
      assets: createAssetLibrary(),
      discoveredAssets: [],
    } as any)
    expect(result.success).toBe(false)
    expect(result.readiness).toBe('blocked')
  })

  it('list_assets returns recommendations for missing assets', async () => {
    const ctx = buildContext({
      assets: { identities: [], logos: [], products: [], brandReferences: [], firstFrame: null, lastFrame: null, ctaGraphic: null, primaryIdentity: null, primaryLogo: null },
    })
    const action: ToolAction = { id: 'list_assets', args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, {
      ...ctx,
      clientForm: { businessName: 'Test' },
      assets: createAssetLibrary({ identities: [], logos: [], products: [], brandReferences: [], firstFrame: null, lastFrame: null, ctaGraphic: null }),
      discoveredAssets: [],
    } as any)
    expect(result.success).toBe(true)
    expect(result.recommendations?.length).toBeGreaterThan(0)
    expect(result.readiness).toBe('needs_input')
  })

  it('validate_project returns missing requirements', async () => {
    const ctx = buildContext({ source: null as any })
    const action: ToolAction = { id: 'validate_project', args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, {
      ...ctx,
      source: null,
      clientForm: { businessName: 'Test' },
      assets: createAssetLibrary(),
      discoveredAssets: [],
    } as any)
    expect(result.success).toBe(false)
    expect(result.missingRequirements?.length).toBeGreaterThan(0)
  })

  it('build_generation_plan returns a plan', async () => {
    const ctx = buildContext({})
    const action: ToolAction = { id: 'build_generation_plan', args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, {
      ...ctx,
      source: createSource(),
      clientForm: { businessName: 'Test' },
      assets: createAssetLibrary(),
      discoveredAssets: [],
    } as any)
    expect(result.success).toBe(true)
    expect(result.generationPlan).toBeDefined()
    expect(result.generationPlan?.estimatedSteps.length).toBeGreaterThan(0)
  })

  it('recommend_assets returns suggestions', async () => {
    const ctx = buildContext({})
    const action: ToolAction = { id: 'recommend_assets', args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, {
      ...ctx,
      clientForm: { businessName: 'Test' },
      assets: createAssetLibrary(),
      discoveredAssets: [],
    } as any)
    expect(result.success).toBe(true)
    expect(result.recommendations).toBeDefined()
  })
})

// ── Context Builder Tests ──────────────────────────────────────────────────────

describe('AI Assist Context Builder', () => {
  it('includes project metadata', () => {
    const source = createSource({ id: 'src_42', title: 'My Demo' })
    const ctx = buildContext({ source: { id: 'src_42', title: 'My Demo' } as any })
    expect(ctx.project.id).toBe('src_42')
    expect(ctx.project.title).toBe('My Demo')
    expect(ctx.project.sourceMediaUrl).toBe('https://example.com/source.mp4')
  })

  it('includes client info', () => {
    const ctx = buildContext({})
    expect(ctx.client.businessName).toBe('Test Business')
  })

  it('includes asset summaries with URLs not binary data', () => {
    const assets = createAssetLibrary({
      logos: [{ id: 'logo_1', role: 'logo', name: 'logo.png', url: 'https://example.com/logo.png', uploadStatus: 'ready', isPrimary: true, edited: false, videoReady: false, createdAt: '' }],
    })
    const ctx = buildContext({ assets })
    expect(ctx.assets.primaryLogo?.url).toBe('https://example.com/logo.png')
    expect(ctx.assets.logos[0].url).toBe('https://example.com/logo.png')
  })

  it('includes vision summaries', () => {
    const discovered = [
      createDiscoveredAsset({ id: 'd1', visionAnalysis: { category: 'logo', confidence: 90, qualityScore: 80, relevanceScore: 85, summary: 'Clear logo', issues: [], recommendedOperations: [], transparencyRecommended: false, precisionRecommended: false, textDetected: false, duplicateLikely: false, targetRole: 'logo', preserve: [], analyzedAt: '' } }),
    ]
    const ctx = buildContext({ discoveredAssets: discovered })
    expect(ctx.assets.visionSummaries.length).toBe(1)
    expect(ctx.assets.visionSummaries[0].category).toBe('logo')
  })

  it('includes CTA info', () => {
    const assets = createAssetLibrary({
      ctaGraphic: { id: 'cta_1', role: 'cta_graphic', name: 'cta.png', url: 'https://example.com/cta.png', uploadStatus: 'ready', isPrimary: false, edited: false, videoReady: false, createdAt: '' },
    })
    const ctx = buildContext({ assets })
    expect(ctx.cta.graphicUrl).toBe('https://example.com/cta.png')
  })

  it('includes generation settings', () => {
    const ctx = buildContext({})
    expect(ctx.generationSettings.outputType).toBe('video')
    expect(ctx.generationSettings.mode).toBe('recreate')
  })

  it('includes readiness state', () => {
    const ctx = buildContext({})
    expect(ctx.readiness.hasClient).toBe(true)
    expect(ctx.readiness.hasSource).toBe(true)
    expect(ctx.readiness.allAssetsReady).toBe(true)
  })
})

// ── Phase 19: Read vs Mutating Actions ────────────────────────────────────────

describe('Phase 19 Read vs Mutating Actions', () => {
  it('read tools do not require confirmation', () => {
    const readTools = ['list_assets', 'recommend_assets', 'validate_project', 'build_generation_plan']
    for (const toolId of readTools) {
      const def = getToolDefinition(toolId)
      expect(def?.requiresConfirmation).toBe(false)
      expect(def?.category).toMatch(/read|recommend/)
    }
  })

  it('cost tools always require confirmation', () => {
    const costTools = ['personalize_prompt', 'generate_video']
    for (const toolId of costTools) {
      const def = getToolDefinition(toolId)
      expect(def?.requiresConfirmation).toBe(true)
      expect(def?.category).toBe('cost')
    }
  })

  it('mutating tools require confirmation by default', () => {
    const mutateTools = ['move_asset', 'set_primary_logo', 'edit_asset', 'remove_background', 'make_video_ready', 'classify_asset']
    for (const toolId of mutateTools) {
      const def = getToolDefinition(toolId)
      expect(def?.requiresConfirmation).toBe(true)
      expect(def?.category).toBe('mutate')
    }
  })

  it('response builder marks read actions as auto_execute', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('list my assets', ctx)
    expect(response.actions.every((a) => a.authorization === 'auto_execute')).toBe(true)
  })

  it('response builder marks cost actions as user_confirmed', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('generate video', ctx)
    expect(response.actions.every((a) => a.authorization === 'user_confirmed')).toBe(true)
  })
})

// ── Phase 18: Structured Responses ────────────────────────────────────────────

describe('Phase 18 Structured Responses', () => {
  it('includes all required fields', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('help', ctx)
    expect(response).toHaveProperty('message')
    expect(response).toHaveProperty('recommendations')
    expect(response).toHaveProperty('actions')
    expect(response).toHaveProperty('missingRequirements')
    expect(response).toHaveProperty('warnings')
    expect(response).toHaveProperty('readiness')
  })

  it('every action has a known action ID', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('generate video', ctx)
    for (const action of response.actions) {
      expect(TOOL_REGISTRY.has(action.id)).toBe(true)
    }
  })

  it('every action has validated arguments', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('move asset to logo', ctx)
    for (const action of response.actions) {
      const validation = validateToolAction(action)
      expect(validation.valid).toBe(true)
    }
  })

  it('every action has target project', () => {
    const ctx = buildContext({})
    const response = buildStructuredAIResponse('help', ctx)
    for (const action of response.actions) {
      expect(action.targetProjectId).toBeTruthy()
    }
  })

  it('rejects unknown actions in executor', async () => {
    const ctx = buildContext({})
    const action: ToolAction = { id: 'totally_fake_tool' as any, args: {}, requiresConfirmation: false, targetProjectId: 'p1', authorization: 'auto_execute' }
    const result = await executeTool(action, ctx as any)
    expect(result.success).toBe(false)
    expect(result.readiness).toBe('blocked')
  })
})

// ── Phase 17: Tool Registry Completeness ──────────────────────────────────────

describe('Phase 17 Tool Registry Completeness', () => {
  const expectedTools = [
    'list_assets',
    'recommend_assets',
    'classify_asset',
    'move_asset',
    'select_asset',
    'set_primary_logo',
    'analyze_asset',
    'edit_asset',
    'remove_background',
    'make_video_ready',
    'personalize_prompt',
    'validate_project',
    'build_generation_plan',
    'generate_video',
  ] as const

  it('registers all expected tools', () => {
    for (const toolId of expectedTools) {
      expect(TOOL_REGISTRY.has(toolId)).toBe(true)
    }
  })

  it('each tool has a unique id, name, description, category, and validation', () => {
    for (const [id, def] of TOOL_REGISTRY) {
      expect(def.id).toBe(id)
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      expect(['read', 'recommend', 'mutate', 'cost']).toContain(def.category)
      expect(typeof def.validateArgs).toBe('function')
      expect(typeof def.requiresConfirmation).toBe('boolean')
    }
  })
})

// ── Phase 16: Context Completeness ────────────────────────────────────────────

describe('Phase 16 Context Completeness', () => {
  it('provides controlled context without binary data', () => {
    const ctx = buildContext({})
    expect(ctx.project.sourceMediaUrl).toBe('https://example.com/source.mp4')
    expect(ctx.project.sourceMediaUrl).not.toContain('data:')
    expect(ctx.project.sourceMediaUrl).not.toContain('blob:')

    for (const asset of ctx.assets.identities) {
      expect(asset.url).not.toContain('data:')
      expect(asset.url).not.toContain('blob:')
    }
  })

  it('includes all required context sections', () => {
    const ctx = buildContext({})
    expect(ctx.project).toBeDefined()
    expect(ctx.client).toBeDefined()
    expect(ctx.business).toBeNull()
    expect(ctx.assets).toBeDefined()
    expect(ctx.prompt).toBeDefined()
    expect(ctx.generationSettings).toBeDefined()
    expect(ctx.readiness).toBeDefined()
    expect(ctx.cta).toBeDefined()
  })

  it('uses IDs and URLs instead of binary blobs', () => {
    const assets = createAssetLibrary({
      logos: [
        { id: 'logo_1', role: 'logo', name: 'logo.png', url: 'https://cdn.example.com/logo.png', uploadStatus: 'ready', isPrimary: true, edited: false, videoReady: false, hasTransparency: false, createdAt: '' },
      ],
      primaryLogo:         { id: 'logo_1', role: 'logo', name: 'logo.png', url: 'https://cdn.example.com/logo.png', uploadStatus: 'ready', isPrimary: true, edited: false, videoReady: false, hasTransparency: false, createdAt: '' },
    })
    const ctx = buildContext({ assets })
    expect(ctx.assets.primaryLogo?.id).toBe('logo_1')
    expect(ctx.assets.primaryLogo?.url).toBe('https://cdn.example.com/logo.png')
  })
})
