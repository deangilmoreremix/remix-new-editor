/**
 * AIAssistPanel
 *
 * Scoped AI Assist experience inside PersonalizationModal.
 * Feels like part of Personalization — not a separate stacked modal.
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, AlertTriangle, CheckCircle2, X, ChevronRight, Sparkles, Wrench } from 'lucide-react'
import type { AIStructuredResponse, AIAssistState, ToolAction, AIRecommendation, AIMissingRequirement, AIWarning, AIGenerationPlan } from './types'
import { EMPTY_AI_ASSIST_STATE } from './types'
import { validateToolAction, requiresConfirmation, isReadTool } from './toolRegistry'

const C = {
  panel: '#151a20',
  field: '#0d1116',
  border: 'rgba(255,255,255,.10)',
  borderStrong: 'rgba(255,255,255,.16)',
  text: '#f7f9fb',
  muted: 'rgba(255,255,255,.58)',
  muted2: 'rgba(255,255,255,.36)',
  cyan: '#29d3f2',
  cyanSoft: 'rgba(41,211,242,.12)',
  cyanBorder: 'rgba(41,211,242,.45)',
  green: '#28c98b',
  danger: '#ef5b67',
  purple: '#a855f7',
  purpleSoft: 'rgba(168,85,247,.12)',
}

function classNames(...classes: (string | boolean | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

interface AIAssistPanelProps {
  state: AIAssistState
  onSendMessage: (message: string) => Promise<void>
  onConfirmAction: (action: ToolAction) => Promise<void>
  onDismissAction: (actionId: string) => void
  onDismiss: () => void
  disabled?: boolean
}

export default function AIAssistPanel({ state, onSendMessage, onConfirmAction, onDismissAction, onDismiss, disabled }: AIAssistPanelProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.lastResponse, state.pendingActions])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending || disabled) return
    setIsSending(true)
    try {
      await onSendMessage(trimmed)
      setInput('')
    } finally {
      setIsSending(false)
    }
  }, [input, isSending, disabled, onSendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleConfirmAction = useCallback(async (action: ToolAction) => {
    setConfirmingAction(action.id + (action.targetAssetId || ''))
    try {
      await onConfirmAction(action)
    } finally {
      setConfirmingAction(null)
    }
  }, [onConfirmAction])

  if (state.status === 'idle' && !state.lastResponse) {
    return (
      <div className="rounded-[16px] border p-5 space-y-4" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: C.cyanSoft, color: C.cyan }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: C.text }}>AI Assist</h3>
              <p className="text-[10px]" style={{ color: C.muted }}>Ask for help with assets, prompts, or generation.</p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} className="rounded-lg p-1" style={{ color: C.muted }}>
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Try: &quot;What assets do I need?&quot; or &quot;Personalize my prompt&quot;"
            disabled={disabled}
            className="flex-1 rounded-[10px] text-xs outline-none"
            style={{
              minHeight: 40,
              padding: '0 12px',
              border: `1px solid ${C.border}`,
              background: C.field,
              color: C.text,
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending || disabled}
            className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
            style={{
              minHeight: 40,
              padding: '0 14px',
              border: `1px solid ${C.cyan}`,
              background: C.cyan,
              color: '#041014',
            }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    )
  }

  const response = state.lastResponse

  return (
    <div className="rounded-[16px] border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: C.cyanSoft, color: C.cyan }}>
            <Sparkles size={14} />
          </div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: C.text }}>AI Assist</h3>
          {state.status === 'thinking' && (
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.cyan }}>
              <Loader2 size={10} className="inline animate-spin mr-1" />
              Thinking
            </span>
          )}
          {state.status === 'executing' && (
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.purple }}>
              <Loader2 size={10} className="inline animate-spin mr-1" />
              Executing
            </span>
          )}
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg p-1" style={{ color: C.muted }}>
          <X size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="px-4 space-y-3 overflow-y-auto" style={{ maxHeight: 320 }}>
        {response && (
          <>
            {/* Message */}
            <div className="rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: C.field, color: C.text, border: `1px solid ${C.border}` }}>
              {response.message}
            </div>

            {/* Missing requirements */}
            {response.missingRequirements.length > 0 && (
              <div className="space-y-1.5">
                {response.missingRequirements.map((req: AIMissingRequirement) => (
                  <div key={req.field} className="flex items-start gap-2 rounded-[8px] p-2.5" style={{ background: req.severity === 'error' ? 'rgba(239,91,103,.08)' : 'rgba(251,191,36,.08)', border: `1px solid ${req.severity === 'error' ? 'rgba(239,91,103,.2)' : 'rgba(251,191,36,.2)'}` }}>
                    <AlertTriangle size={12} style={{ color: req.severity === 'error' ? C.danger : '#fbbf24', marginTop: 1 }} />
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: req.severity === 'error' ? C.danger : '#fbbf24' }}>{req.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{req.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {response.warnings.length > 0 && (
              <div className="space-y-1.5">
                {response.warnings.map((warning: AIWarning, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-[8px] p-2.5" style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.15)' }}>
                    <AlertTriangle size={12} style={{ color: '#fbbf24', marginTop: 1 }} />
                    <div className="text-[10px]" style={{ color: C.muted }}>{warning.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {response.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>Recommendations</div>
                {response.recommendations.map((rec: AIRecommendation, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-[8px] p-2.5" style={{ background: C.cyanSoft, border: `1px solid ${C.cyanBorder}` }}>
                    <ChevronRight size={12} style={{ color: C.cyan, marginTop: 1 }} />
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: C.text }}>{rec.message}</div>
                      {rec.priority === 'high' && (
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.cyan }}>High Priority</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generation plan */}
            {response.generationPlan && (
              <div className="rounded-[10px] p-3 space-y-2" style={{ background: C.purpleSoft, border: `1px solid rgba(168,85,247,.25)` }}>
                <div className="flex items-center gap-2">
                  <Wrench size={12} style={{ color: C.purple }} />
                  <span className="text-[11px] font-bold" style={{ color: '#c4b5fd' }}>Generation Plan</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="text-[10px]" style={{ color: C.muted }}>Mode</div>
                  <div className="text-[10px] font-medium" style={{ color: C.text }}>{response.generationPlan.mode}</div>
                  <div className="text-[10px]" style={{ color: C.muted }}>Output</div>
                  <div className="text-[10px] font-medium" style={{ color: C.text }}>{response.generationPlan.outputType}</div>
                  <div className="text-[10px]" style={{ color: C.muted }}>Model</div>
                  <div className="text-[10px] font-medium" style={{ color: C.text }}>{response.generationPlan.model}</div>
                  {response.generationPlan.estimatedDuration && (
                    <>
                      <div className="text-[10px]" style={{ color: C.muted }}>Est. Duration</div>
                      <div className="text-[10px] font-medium" style={{ color: C.text }}>{response.generationPlan.estimatedDuration}</div>
                    </>
                  )}
                  {response.generationPlan.estimatedCost && (
                    <>
                      <div className="text-[10px]" style={{ color: C.muted }}>Est. Cost</div>
                      <div className="text-[10px] font-medium" style={{ color: C.text }}>{response.generationPlan.estimatedCost}</div>
                    </>
                  )}
                </div>
                {response.generationPlan.estimatedSteps.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {response.generationPlan.estimatedSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: C.muted }}>
                        <span className="font-bold" style={{ color: C.purple }}>{i + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending actions requiring confirmation */}
            {state.pendingActions.filter(a => a.authorization === 'user_confirmed').length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: '#fbbf24' }}>Awaiting Confirmation</div>
                {state.pendingActions.filter(a => a.authorization === 'user_confirmed').map((action: ToolAction) => (
                  <div key={action.id + (action.targetAssetId || '')} className="rounded-[10px] p-3 space-y-2" style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench size={12} style={{ color: '#fbbf24' }} />
                        <span className="text-[11px] font-bold" style={{ color: '#fbbf24' }}>{action.id.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <div className="text-[10px]" style={{ color: C.muted }}>
                      Target: {action.targetAssetId || 'project'}
                      {Object.keys(action.args).length > 0 && (
                        <span className="ml-2">Args: {JSON.stringify(action.args)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmAction(action)}
                        disabled={confirmingAction === action.id + (action.targetAssetId || '')}
                        className="rounded-[8px] text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50"
                        style={{
                          minHeight: 32,
                          padding: '0 12px',
                          border: `1px solid ${C.cyan}`,
                          background: C.cyan,
                          color: '#041014',
                        }}
                      >
                        {confirmingAction === action.id + (action.targetAssetId || '') ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissAction(action.id + (action.targetAssetId || ''))}
                        className="rounded-[8px] text-[10px] font-extrabold uppercase tracking-wide"
                        style={{
                          minHeight: 32,
                          padding: '0 12px',
                          border: `1px solid ${C.border}`,
                          background: C.panel,
                          color: 'white',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Readiness indicator */}
            <div className="flex items-center gap-2">
              {response.readiness === 'ready' && <CheckCircle2 size={12} style={{ color: C.green }} />}
              {response.readiness === 'needs_input' && <AlertTriangle size={12} style={{ color: '#fbbf24' }} />}
              {response.readiness === 'blocked' && <AlertTriangle size={12} style={{ color: C.danger }} />}
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: response.readiness === 'ready' ? C.green : response.readiness === 'needs_input' ? '#fbbf24' : C.danger }}>
                {response.readiness}
              </span>
            </div>

            {/* Readiness checks (Phase 20) */}
            {response.readinessChecks && response.readinessChecks.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: C.muted }}>Preparation Status</div>
                {response.readinessChecks.map((check: any) => (
                  <div key={check.key} className="flex items-start gap-2 rounded-[8px] p-2.5" style={{
                    background: check.status === 'ready' ? 'rgba(40,201,139,.08)' : check.status === 'warning' ? 'rgba(251,191,36,.08)' : 'rgba(239,91,103,.08)',
                    border: `1px solid ${check.status === 'ready' ? 'rgba(40,201,139,.2)' : check.status === 'warning' ? 'rgba(251,191,36,.2)' : 'rgba(239,91,103,.2)'}`,
                  }}>
                    {check.status === 'ready' && <CheckCircle2 size={12} style={{ color: C.green, marginTop: 1 }} />}
                    {check.status === 'warning' && <AlertTriangle size={12} style={{ color: '#fbbf24', marginTop: 1 }} />}
                    {check.status === 'error' && <AlertTriangle size={12} style={{ color: C.danger, marginTop: 1 }} />}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold" style={{ color: C.text }}>{check.label}</span>
                        {check.action && check.status !== 'ready' && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: C.cyanSoft, color: C.cyan }}>
                            {check.actionLabel || 'Fix'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{check.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {state.status === 'thinking' && !response && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={14} className="animate-spin" style={{ color: C.cyan }} />
            <span className="text-[11px]" style={{ color: C.muted }}>Analyzing project state...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 pb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for help..."
          disabled={disabled || state.status === 'thinking' || state.status === 'executing'}
          className="flex-1 rounded-[10px] text-xs outline-none"
          style={{
            minHeight: 40,
            padding: '0 12px',
            border: `1px solid ${C.border}`,
            background: C.field,
            color: C.text,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isSending || disabled || state.status === 'thinking' || state.status === 'executing'}
          className="rounded-[10px] text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          style={{
            minHeight: 40,
            padding: '0 14px',
            border: `1px solid ${C.cyan}`,
            background: C.cyan,
            color: '#041014',
          }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  )
}
