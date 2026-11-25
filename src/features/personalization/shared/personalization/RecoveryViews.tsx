'use client'

import React from 'react'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { C } from './guided/tokens'

export type FailedStage = 'prompt' | 'generation' | 'research' | 'discovery' | 'upload'

export const RETRY_LABELS: Record<FailedStage, string> = {
  prompt: 'Retry Personalization',
  generation: 'Retry Generation',
  research: 'Retry Research',
  discovery: 'Retry Discovery',
  upload: 'Retry Upload',
}

export interface ErrorViewProps {
  errorMessage: string | null
  /** Repeats EXACTLY the operation that failed (same kind of run), once per click. */
  retry: () => void
  /** Leaves the error and goes back to editing. Sends nothing, changes nothing. */
  returnToEditing: () => void
  stage?: FailedStage
  /** True while a run is already in flight: the buttons are disabled so a retry can never be started twice. */
  busy?: boolean
}

/**
 * Shown when a run fails. Two choices, never a third: retry what failed, or go back and keep editing.
 * There is deliberately no button that starts a *different* run (e.g. a fresh paid generation after a browser render failed).
 */
export function ErrorView({ errorMessage, retry, returnToEditing, stage, busy = false }: ErrorViewProps) {
  const retryLabel = stage ? RETRY_LABELS[stage] : 'Retry failed operation'
  return (
    <div className="px-6 py-16 text-center space-y-4" data-testid="pz-error-view">
      <AlertTriangle size={40} style={{ color: C.danger }} className="mx-auto" />
      <h3 className="text-lg font-bold text-white">We Could Not Complete This Personalization</h3>
      <p className="text-sm text-white/60 max-w-md mx-auto" role="alert">{errorMessage || 'An unexpected error occurred.'}</p>
      <p className="text-xs text-white/40">Your client, assets, footage, template and edits have been kept.</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="pz-error-retry"
          disabled={busy}
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{ background: C.cyan, color: '#041014' }}
        >
          <RefreshCw size={14} /> {retryLabel}
        </button>
        <button
          type="button"
          data-testid="pz-error-return"
          disabled={busy}
          onClick={returnToEditing}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan }}
        >
          <ArrowLeft size={14} /> Return to editing
        </button>
      </div>
      <p className="text-[11px] text-white/35 max-w-md mx-auto">
        Retrying repeats the same operation once per click and may use credits again. It never starts a different one.
      </p>
    </div>
  )
}
