/**
 * AI response builder
 *
 * In production, this would call an LLM with structured output constraints.
 * For now, it builds a structured response based on context analysis.
 */

import type { AIStructuredResponse, AIRecommendation, AIMissingRequirement, AIWarning, AIGenerationPlan, ToolAction, ReadinessCheck } from './types'
import type { AIAssistContext } from './contextProvider'
import { validateToolAction } from './toolRegistry'

export function buildStructuredAIResponse(
  userMessage: string,
  context: AIAssistContext,
): AIStructuredResponse {
  const lowerMessage = userMessage.toLowerCase()
  const recommendations: AIRecommendation[] = []
  const missingRequirements: AIMissingRequirement[] = []
  const warnings: AIWarning[] = []
  const actions: ToolAction[] = []
  let readinessChecks: ReadinessCheck[] = []

  const isPrepareIntent = /prepare|ready\s*to\s*(generate|go|start)|check\s*(readiness|status)|what\s*(do\s*i\s*need|is\s*missing)/i.test(lowerMessage)
  const isPersonalizeIntent = /personalize|rewrite\s*prompt|customize\s*prompt/i.test(lowerMessage)
  const isGenerateIntent = /generate|create|make\s*video|build\s*video/i.test(lowerMessage)
  const isPlanIntent = /plan|steps|how\s*will\s*this\s*work/i.test(lowerMessage)
  const isListIntent = /list\s*(my\s*)?assets|show\s*(my\s*)?assets|what\s*assets/i.test(lowerMessage)
  const isValidateIntent = /validate\s*project|check\s*(project|readiness)|is\s*project\s*ready|project\s*ready/i.test(lowerMessage)

  if (isListIntent) {
    actions.push({
      id: 'list_assets',
      args: {},
      requiresConfirmation: false,
      targetProjectId: context.project.id || '',
      authorization: 'auto_execute',
    })
  }

  if (isValidateIntent) {
    actions.push({
      id: 'validate_project',
      args: {},
      requiresConfirmation: false,
      targetProjectId: context.project.id || '',
      authorization: 'auto_execute',
    })
  }

  if (isPersonalizeIntent) {
    if (context.client.businessName && context.project.id) {
      actions.push({
        id: 'personalize_prompt',
        args: {},
        requiresConfirmation: true,
        targetProjectId: context.project.id || '',
        authorization: 'user_confirmed',
      })
    }
  }

  if (isGenerateIntent) {
    if (context.client.businessName && context.project.id && context.generationSettings.mode) {
      actions.push({
        id: 'build_generation_plan',
        args: {},
        requiresConfirmation: true,
        targetProjectId: context.project.id || '',
        authorization: 'user_confirmed',
      })
      actions.push({
        id: 'generate_video',
        args: {},
        requiresConfirmation: true,
        targetProjectId: context.project.id || '',
        authorization: 'user_confirmed',
      })
    }
  }

  if (isPlanIntent) {
    actions.push({
      id: 'build_generation_plan',
      args: {},
      requiresConfirmation: false,
      targetProjectId: context.project.id || '',
      authorization: 'auto_execute',
    })
  }

  if (!context.client.businessName) {
    missingRequirements.push({
      field: 'client',
      label: 'Client Profile',
      severity: 'error',
      message: 'Add a business name or select a client before generating.',
    })
  }

  if (!context.project.id && !context.project.sourceMediaUrl) {
    missingRequirements.push({
      field: 'source',
      label: 'Source Media',
      severity: 'error',
      message: 'No source demo selected.',
    })
  }

  if (!context.generationSettings.mode && context.generationSettings.outputType !== 'prompt') {
    missingRequirements.push({
      field: 'mode',
      label: 'Personalization Mode',
      severity: 'error',
      message: 'Select a personalization mode before generating.',
    })
  }

  if (context.assets.identities.length === 0 && context.assets.logos.length === 0) {
    recommendations.push({
      type: 'add_assets',
      message: 'Add at least one identity or logo asset for better personalization.',
      priority: 'high',
    })
  }

  if (!context.cta.graphicUrl && !context.client.ctaHeadline && !context.client.callToAction) {
    recommendations.push({
      type: 'add_cta',
      message: 'Add a CTA graphic and button text for complete branding.',
      priority: 'medium',
    })
  }

  const unselectedDiscovered = context.assets.discovered.filter((a) => !a.selected && !a.rejected && !a.assignedSection)
  if (unselectedDiscovered.length > 0) {
    recommendations.push({
      type: 'import_discovered',
      message: `${unselectedDiscovered.length} discovered assets are available for import.`,
      priority: 'medium',
    })
  }

  const notVideoReady = context.assets.discovered.filter((a) => a.selected && !a.videoReady && !a.rejected)
  if (notVideoReady.length > 0) {
    recommendations.push({
      type: 'make_video_ready',
      message: `${notVideoReady.length} selected assets are not video-ready. Consider making them video-ready.`,
      priority: 'medium',
    })
  }

  if (context.visionAnalysisCount === 0 && context.assets.discovered.length > 0) {
    recommendations.push({
      type: 'analyze_assets',
      message: 'Run GO Vision analysis on discovered assets for better categorization.',
      priority: 'low',
    })
  }

  if (context.assets.identities.length > 0 && !context.readiness.allAssetsReady) {
    warnings.push({
      code: 'assets_not_ready',
      message: 'Some assets are still uploading.',
    })
  }

  if (context.generationSettings.consentGiven === false && ['face_only', 'full_body', 'replace_face', 'replace_person'].includes(context.generationSettings.mode || '')) {
    warnings.push({
      code: 'consent_not_given',
      message: 'Consent not given for likeness replacement.',
    })
  }

  let readiness: AIStructuredResponse['readiness'] = 'ready'
  if (missingRequirements.some((r) => r.severity === 'error')) {
    readiness = 'blocked'
  } else if (missingRequirements.some((r) => r.severity === 'warning') || readinessChecks.some((c) => c.status === 'error')) {
    readiness = 'needs_input'
  }

  let message = ''
  if (isPrepareIntent) {
    message = readiness === 'ready'
      ? 'Project is fully prepared and ready to generate.'
      : `${readinessChecks.filter((c) => c.status !== 'ready').length} preparation step(s) need attention. Review the checks below and approve actions to continue.`
  } else if (readiness === 'blocked') {
    message = `I can't proceed yet. ${missingRequirements.filter((r) => r.severity === 'error').map((r) => r.message).join(' ')}`
  } else if (readiness === 'needs_input') {
    message = `Almost ready. ${missingRequirements.map((r) => r.message).join(' ')}`
  } else if (actions.length > 0) {
    const autoActions = actions.filter((a) => a.authorization === 'auto_execute')
    const confirmActions = actions.filter((a) => a.authorization === 'user_confirmed')
    if (autoActions.length > 0 && confirmActions.length > 0) {
      message = `I can automatically run ${autoActions.map((a) => a.id.replace(/_/g, ' ')).join(', ')}. ${confirmActions.length > 0 ? `${confirmActions.map((a) => a.id.replace(/_/g, ' ')).join(', ')} requires your confirmation.` : ''}`
    } else if (autoActions.length > 0) {
      message = `Running ${autoActions.map((a) => a.id.replace(/_/g, ' ')).join(', ')} automatically.`
    } else if (confirmActions.length > 0) {
      message = `${confirmActions.map((a) => a.id.replace(/_/g, ' ')).join(', ')} requires your confirmation.`
    }
  } else {
    message = `Project is ready. ${recommendations.map((r) => r.message).join(' ')}`
  }

  let generationPlan: AIGenerationPlan | undefined
  if (actions.some((a) => a.id === 'build_generation_plan' || a.id === 'generate_video')) {
    generationPlan = {
      mode: context.generationSettings.mode || 'recreate',
      outputType: context.generationSettings.outputType,
      model: context.generationSettings.advancedModel || context.project.model || 'smartvideo-recommended',
      estimatedSteps: [
        'Validate project readiness',
        'Resolve and upload assets',
        'Personalize prompt',
        'Run generation',
        'Apply post-processing (logo/CTA)',
      ],
      estimatedDuration: context.project.duration ? `${context.project.duration}s` : '~30s',
      estimatedCost: 'Varies by model and duration',
    }
  }

  return {
    message,
    recommendations,
    actions,
    missingRequirements,
    warnings,
    readiness,
    generationPlan,
    readinessChecks: readinessChecks.length > 0 ? readinessChecks : undefined,
  }
}
