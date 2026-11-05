/**
 * Personalization AI Tool Registry
 *
 * Controlled set of tools the AI can invoke. Each tool maps to an existing
 * domain function from the Personalization modal/provider.
 *
 * Rules:
 * - Unknown tools are rejected.
 * - Every action must specify a known tool id and validated arguments.
 * - Mutating / cost-incurring tools require user confirmation.
 * - Read / recommend tools may execute automatically when safe.
 */

import type { ToolId, ToolDefinition, ToolCategory, ToolAction } from './types'
import { buildStructuredAIResponse } from './responseBuilder'
import { buildAIAssistContext } from './contextProvider'
import type {
  PersonalizationSource,
  ClientProfile,
  AssetLibrary,
  DiscoveredAsset,
  GenerationOptions,
  GenerationState,
  OutputType,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  PromptState,
  BusinessResearchResult,
} from '../types'

// ── AI Assist snapshot type ───────────────────────────────────────────────────

export type PersonalizationContextSnapshot = {
  source: PersonalizationSource | null
  clientForm: Partial<ClientProfile>
  assets: AssetLibrary
  discoveredAssets: DiscoveredAsset[]
  visionStatus: string
  visionError: string | null
  businessResearch: {
    status: string
    result?: BusinessResearchResult
    error?: string
  }
  selectedBusiness: { id: string; name: string; category: string; website?: string } | null
  promptState: PromptState
  outputType: OutputType
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  genOptions: GenerationOptions
  generation: GenerationState
  capabilities: Record<string, unknown>
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
}

// ── Tool registry ──────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    id: 'list_assets',
    name: 'List Assets',
    description: 'Return a structured summary of current assets (identities, logos, products, brand refs, frames, CTA).',
    category: 'read',
    requiredArgs: [],
    optionalArgs: ['category', 'role', 'status'],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: false,
  },
  {
    id: 'recommend_assets',
    name: 'Recommend Assets',
    description: 'Analyze current project state and suggest which assets to add, replace, or remove.',
    category: 'recommend',
    requiredArgs: [],
    optionalArgs: ['context'],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: false,
  },
  {
    id: 'classify_asset',
    name: 'Classify Asset',
    description: 'Classify a discovered or uploaded asset into a category and suggest a section assignment.',
    category: 'mutate',
    requiredArgs: ['assetId', 'previewUrl'],
    optionalArgs: ['hint'],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      if (typeof args.previewUrl !== 'string' || !args.previewUrl) return { valid: false, error: 'previewUrl is required' }
      return { valid: true }
    },
    requiresConfirmation: true,
  },
  {
    id: 'move_asset',
    name: 'Move Asset',
    description: 'Move a discovered asset to a different section assignment.',
    category: 'mutate',
    requiredArgs: ['assetId', 'section'],
    optionalArgs: [],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      const validSections = ['person', 'logo', 'products', 'brand', 'firstFrame', 'lastFrame', 'ctaGraphic']
      if (typeof args.section !== 'string' || !validSections.includes(args.section)) {
        return { valid: false, error: `section must be one of: ${validSections.join(', ')}` }
      }
      return { valid: true }
    },
    requiresConfirmation: true,
    costLabel: 'Reassigns asset to a different personalization section.',
  },
  {
    id: 'select_asset',
    name: 'Select Asset',
    description: 'Select or deselect a discovered asset for import.',
    category: 'mutate',
    requiredArgs: ['assetId', 'selected'],
    optionalArgs: [],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      if (typeof args.selected !== 'boolean') return { valid: false, error: 'selected must be a boolean' }
      return { valid: true }
    },
    requiresConfirmation: false,
  },
  {
    id: 'set_primary_logo',
    name: 'Set Primary Logo',
    description: 'Set a specific logo asset as the primary logo for exact branding overlay.',
    category: 'mutate',
    requiredArgs: ['assetId'],
    optionalArgs: [],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      return { valid: true }
    },
    requiresConfirmation: true,
    costLabel: 'Changes the primary logo used for exact branding overlay.',
  },
  {
    id: 'analyze_asset',
    name: 'Analyze Asset',
    description: 'Run GO Vision analysis on a specific discovered asset.',
    category: 'read',
    requiredArgs: ['assetId', 'previewUrl'],
    optionalArgs: ['categoryHint'],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      if (typeof args.previewUrl !== 'string' || !args.previewUrl) return { valid: false, error: 'previewUrl is required' }
      return { valid: true }
    },
    requiresConfirmation: false,
  },
  {
    id: 'edit_asset',
    name: 'Edit Asset',
    description: 'Open the image editor for a specific asset with a suggested operation.',
    category: 'mutate',
    requiredArgs: ['assetId', 'operation'],
    optionalArgs: ['prompt', 'model', 'quality'],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      if (typeof args.operation !== 'string' || !args.operation) return { valid: false, error: 'operation is required' }
      const validOps = ['remove_background', 'replace_face', 'replace_person', 'inpaint', 'style_transfer']
      if (!validOps.includes(args.operation)) {
        return { valid: false, error: `operation must be one of: ${validOps.join(', ')}` }
      }
      return { valid: true }
    },
    requiresConfirmation: true,
    costLabel: 'Opens the image editor and applies an AI-powered operation. May incur generation cost.',
  },
  {
    id: 'remove_background',
    name: 'Remove Background',
    description: 'Remove the background from an asset to make it transparent.',
    category: 'mutate',
    requiredArgs: ['assetId'],
    optionalArgs: [],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      return { valid: true }
    },
    requiresConfirmation: true,
    costLabel: 'Applies background removal. May incur generation cost.',
  },
  {
    id: 'make_video_ready',
    name: 'Make Video Ready',
    description: 'Process an asset to make it video-ready (transparency, composition, etc.).',
    category: 'mutate',
    requiredArgs: ['assetId'],
    optionalArgs: ['businessName', 'industry'],
    validateArgs: (args) => {
      if (typeof args.assetId !== 'string' || !args.assetId) return { valid: false, error: 'assetId is required' }
      return { valid: true }
    },
    requiresConfirmation: true,
    costLabel: 'Processes asset for video use. May incur generation cost.',
  },
  {
    id: 'personalize_prompt',
    name: 'Personalize Prompt',
    description: 'Generate a personalized prompt from the current project state.',
    category: 'cost',
    requiredArgs: [],
    optionalArgs: [],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: true,
    costLabel: 'Calls the LLM to generate a personalized prompt.',
  },
  {
    id: 'validate_project',
    name: 'Validate Project',
    description: 'Validate the current project state for readiness and completeness.',
    category: 'read',
    requiredArgs: [],
    optionalArgs: [],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: false,
  },
  {
    id: 'build_generation_plan',
    name: 'Build Generation Plan',
    description: 'Create a step-by-step generation plan for the current project.',
    category: 'read',
    requiredArgs: [],
    optionalArgs: ['mode', 'outputType'],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: false,
  },
  {
    id: 'prepare_everything',
    name: 'Prepare Everything',
    description: 'Evaluate project readiness and prepare all assets for generation.',
    category: 'read',
    requiredArgs: [],
    optionalArgs: [],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: false,
  },
  {
    id: 'generate_video',
    name: 'Generate Video',
    description: 'Trigger video/image generation with current settings.',
    category: 'cost',
    requiredArgs: [],
    optionalArgs: [],
    validateArgs: () => ({ valid: true }),
    requiresConfirmation: true,
    costLabel: 'Triggers video/image generation. This is an expensive operation.',
  },
]

export const TOOL_REGISTRY = new Map<string, ToolDefinition>(
  TOOL_DEFINITIONS.map((t) => [t.id, t]),
)

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.get(id)
}

export function validateToolAction(action: Partial<ToolAction> & { id: string }): { valid: boolean; error?: string } {
  const tool = TOOL_REGISTRY.get(action.id)
  if (!tool) {
    return { valid: false, error: `Unknown tool: ${action.id}` }
  }

  const missingRequired = tool.requiredArgs.filter((arg) => !(arg in (action.args || {})))
  if (missingRequired.length > 0) {
    return { valid: false, error: `Missing required args: ${missingRequired.join(', ')}` }
  }

  const { valid, error } = tool.validateArgs(action.args || {})
  if (!valid) {
    return { valid: false, error: error ? `Invalid arguments: ${error}` : 'Invalid arguments' }
  }

  return { valid: true }
}

export function isReadTool(category: ToolCategory): boolean {
  return category === 'read' || category === 'recommend'
}

export function isMutatingTool(category: ToolCategory): boolean {
  return category === 'mutate'
}

export function isCostTool(category: ToolCategory): boolean {
  return category === 'cost'
}

export function requiresConfirmation(category: ToolCategory, toolRequiresConfirmation: boolean): boolean {
  if (isCostTool(category)) return true
  if (isMutatingTool(category)) return toolRequiresConfirmation
  return false
}

export type ActionHandlers = Record<string, (...args: any[]) => any>

export interface ToolRegistry extends Record<string, (...args: any[]) => any> {
  processQuery: (query: string, snapshot: PersonalizationContextSnapshot) => any
}

export function createDefaultToolRegistry(handlers: ActionHandlers): ToolRegistry {
  const registry = {} as ToolRegistry
  for (const tool of TOOL_DEFINITIONS) {
    const handler = handlers[tool.id]
    if (typeof handler === 'function') {
      registry[tool.id] = handler
    }
  }
  registry.processQuery = (query: string, snapshot: PersonalizationContextSnapshot) => {
    const ctx = buildAIAssistContext({
      source: snapshot.source,
      client: snapshot.clientForm,
      assets: snapshot.assets,
      promptState: snapshot.promptState,
      outputType: snapshot.outputType,
      mode: snapshot.mode,
      genOptions: snapshot.genOptions,
      generation: snapshot.generation,
      discoveredAssets: snapshot.discoveredAssets,
      visionAnalyses: new Map(),
      selectedBusiness: snapshot.selectedBusiness,
      businessResearch: snapshot.businessResearch.result ?? null,
      readiness: snapshot.readiness,
    })
    return buildStructuredAIResponse(query, ctx)
  }
  return registry
}
