'use client'

import React from 'react'
import { Check, X, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { Destination, PublishResult } from '../types'

interface AccountCardProps {
  destination: Destination
  selected: boolean
  onToggle: (id: string) => void
  onDisconnect: (accountId: string) => void
  onExpand: (id: string) => void
  expanded: boolean
  platformName: string
  platformIcon: React.ComponentType<any>
  platformAccent: string
  result?: PublishResult
  onRetry?: (id: string) => void
  retrying?: boolean
  children?: React.ReactNode
}

export default function AccountCard({
  destination,
  selected,
  onToggle,
  onDisconnect,
  onExpand,
  expanded,
  platformName,
  platformIcon: Icon,
  platformAccent,
  result,
  onRetry,
  retrying,
  children,
}: AccountCardProps) {
  const statusLabel = result?.status || 'idle'
  const isPending = statusLabel === 'queued' || statusLabel === 'uploading' || statusLabel === 'processing'
  const isFailed = statusLabel === 'failed'
  const isPublished = statusLabel === 'published'

  const statusColor = isPublished ? '#22c55e' : isFailed ? '#ef4444' : isPending ? '#eab308' : '#71717a'

  return (
    <div
      className={`rounded-xl border transition-all ${
        selected ? 'bg-white/[0.03]' : 'bg-white/[0.01]'
      }`}
      style={selected ? { borderColor: `${platformAccent}55` } : { borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => onToggle(destination.id)}
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={
            selected
              ? { backgroundColor: platformAccent, borderColor: platformAccent }
              : { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent' }
          }
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${destination.accountName || destination.accountId} for ${platformName}`}
        >
          {selected && <Check size={12} className="text-black" strokeWidth={3} />}
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${platformAccent}20` }}
        >
          <Icon size={16} style={{ color: platformAccent }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {destination.accountName || destination.accountId || 'Unknown account'}
          </p>
          <p className="text-[11px] text-white/40 truncate">
            {platformName}
            {destination.accountId ? ` · #${destination.accountId}` : ''}
          </p>
        </div>

        {result && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {isPending && <Loader2 size={10} className="animate-spin" />}
            {isFailed && <AlertCircle size={10} />}
            {isPublished && <Check size={10} />}
            {statusLabel}
          </span>
        )}

        <button
          type="button"
          onClick={() => onExpand(destination.id)}
          className="p-1 text-white/40 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} settings for ${destination.accountName || destination.accountId}`}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          {children}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onDisconnect(destination.accountId!)}
              disabled={!destination.accountId}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
            >
              <X size={12} />
              Disconnect
            </button>
            {isFailed && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(destination.id)}
                disabled={retrying}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ color: platformAccent, backgroundColor: `${platformAccent}15` }}
              >
                {retrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
