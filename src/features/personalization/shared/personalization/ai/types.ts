/**
 * AI Assist types for Personalization
 */

export type ToolId =
  | 'list_assets'
  | 'recommend_assets'
  | 'classify_asset'
  | 'move_asset'
  | 'select_asset'
  | 'set_primary_logo'
  | 'analyze_asset'
  | 'edit_asset'
  | 'remove_background'
  | 'make_video_ready'
  | 'personalize_prompt'
  | 'validate_project'
  | 'build_generation_plan'
  | 'prepare_everything'
  | 'generate_video'

export type ToolCategory = 'read' | 'recommend' | 'mutate' | 'cost'

export interface ToolDefinition {
  id: ToolId
  name: string
  description: string
  category: ToolCategory
  requiredArgs: string[]
  optionalArgs: string[]
  validateArgs: (args: Record<string, unknown>) => { valid: boolean; error?: string }
  requiresConfirmation: boolean
  costLabel?: string
}

export interface ToolAction {
  id: ToolId
  args: Record<string, unknown>
  requiresConfirmation: boolean
  targetProjectId: string
  targetAssetId?: string
  authorization: 'user_confirmed' | 'auto_execute' | 'denied'
}

export interface AIRecommendation {
  type: string
  message: string
  assetId?: string
  suggestedAction?: string
  priority: 'high' | 'medium' | 'low'
}

export interface AIMissingRequirement {
  field: string
  label: string
  severity: 'error' | 'warning'
  message: string
}

export interface AIWarning {
  code: string
  message: string
  assetId?: string
}

export interface ReadinessCheck {
  key: string
  label: string
  status: 'ready' | 'warning' | 'error'
  message: string
  action?: ToolId
  actionLabel?: string
  actionArgs?: Record<string, unknown>
}

export interface AIGenerationPlan {
  mode: string
  outputType: string
  model: string
  estimatedSteps: string[]
  estimatedCost?: string
  estimatedDuration?: string
}

export interface AIStructuredResponse {
  message: string
  recommendations: AIRecommendation[]
  actions: ToolAction[]
  missingRequirements: AIMissingRequirement[]
  warnings: AIWarning[]
  readiness: 'ready' | 'needs_input' | 'blocked'
  generationPlan?: AIGenerationPlan
  readinessChecks?: ReadinessCheck[]
}

export type AIAssistStatus = 'idle' | 'thinking' | 'awaiting_confirmation' | 'executing' | 'complete' | 'error'

export interface AIAssistState {
  status: AIAssistStatus
  lastResponse: AIStructuredResponse | null
  pendingActions: ToolAction[]
  executedActions: ToolAction[]
  error: string | null
}

export const EMPTY_AI_ASSIST_STATE: AIAssistState = {
  status: 'idle',
  lastResponse: null,
  pendingActions: [],
  executedActions: [],
  error: null,
}
