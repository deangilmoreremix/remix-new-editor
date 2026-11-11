'use client'

/**
 * Design Agent presentation primitives.
 *
 * Pure UI — no sessions, jobs, uploads or API calls. The Design Agent renders
 * its home and chat views from these, and Motion Studio reuses them so both
 * studios share one visual language without sharing a backend.
 */
import { forwardRef, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, FolderOpen, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'
import { semantic } from '../../shared/styles/designTokens'

/** Typewriter placeholder that cycles through `phrases`; frozen while `paused`. */
export function useTypingPlaceholder(phrases: readonly string[], paused: boolean): string {
  const [placeholder, setPlaceholder] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    if (paused || !phrases.length) return
    const target = phrases[placeholderIdx % phrases.length]
    if (isTyping) {
      if (charIdx < target.length) {
        const timer = setTimeout(() => { setPlaceholder(target.slice(0, charIdx + 1)); setCharIdx(value => value + 1) }, 40)
        return () => clearTimeout(timer)
      }
      const timer = setTimeout(() => setIsTyping(false), 1800)
      return () => clearTimeout(timer)
    }
    if (charIdx > 0) {
      const timer = setTimeout(() => { setPlaceholder(target.slice(0, charIdx - 1)); setCharIdx(value => value - 1) }, 20)
      return () => clearTimeout(timer)
    }
    setPlaceholderIdx(value => (value + 1) % phrases.length)
    setIsTyping(true)
  }, [charIdx, isTyping, placeholderIdx, paused, phrases])

  return placeholder
}

/** "Design is easier with Go-AI" hero. */
export function HomeHero({ lead, accent, subtitle }: { lead: string; accent: string; subtitle: string }) {
  return (
    <div className="text-center space-y-2">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{lead} <span style={{ color: 'var(--color-primary)' }}>{accent}</span></h1>
      <p className="text-base" style={{ color: semantic.textSecondary }}>{subtitle}</p>
    </div>
  )
}

/** Rounded glass card that holds the prompt textarea and its toolbar. */
export function PromptCard({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={`rounded-2xl ${compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}>
      {children}
    </div>
  )
}

type PromptInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** Animated overlay text shown while the field is empty. */
  typingText: string
  rows?: number
  disabled?: boolean
  /** Native placeholder — kept for accessibility/tests, visually replaced by `typingText`. */
  placeholder?: string
  'aria-label'?: string
}

/** Textarea with the Design Agent typewriter overlay; Enter submits, Shift+Enter breaks. */
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput(
  { value, onChange, onSubmit, typingText, rows = 3, disabled, placeholder = '', 'aria-label': ariaLabel },
  ref,
) {
  return (
    <div className="relative">
      {!value && <div className="absolute top-0 left-0 right-0 text-sm pointer-events-none select-none" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', lineHeight: '1.5' }}>{typingText}<span className="animate-pulse">|</span></div>}
      <textarea
        ref={ref}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit() } }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        rows={rows}
        className="w-full bg-transparent resize-none outline-none text-sm relative placeholder:text-transparent"
        style={{ color: 'white', caretColor: 'var(--color-primary)', zIndex: 1 }}
      />
    </div>
  )
})

export function AttachButton({ onClick, disabled, label = 'Upload reference media', testId }: { onClick: () => void; disabled?: boolean; label?: string; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="p-1.5 rounded-full transition-all hover:bg-white/10 disabled:opacity-30" style={{ color: semantic.textMuted }} aria-label={label} title={label} data-testid={testId}><Plus size={16} /></button>
  )
}

/** Blue "✦ Templates ▾" pill. */
export function TemplatesPill({ onClick, label = 'Templates', ariaLabel }: { onClick: () => void; label?: string; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}><Sparkles size={11} />{label}<ChevronDown size={11} /></button>
  )
}

/** Blue chip for the selected template, with a clear button. */
export function SelectedChip({ label, onClear, clearLabel = 'Clear template' }: { label: string; onClear: () => void; clearLabel?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}><Sparkles size={11} />{label}<button type="button" onClick={onClear} aria-label={clearLabel}><X size={10} /></button></div>
  )
}

export function SendButton({ onClick, disabled, active, label = 'Send message' }: { onClick: () => void; disabled?: boolean; active: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="p-2 rounded-full transition-all disabled:opacity-30" style={{ color: active ? 'var(--color-primary)' : semantic.textMuted }} aria-label={label} title={label}><Send size={16} /><span className="sr-only">{label}</span></button>
  )
}

/** Round pill used for modes, Brand Kit and view switching. `tone` picks the active colour. */
export function PillButton({ active, onClick, children, tone = 'blue', title, testId, pressed, asTab = false }: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'blue' | 'green'
  title?: string
  testId?: string
  pressed?: boolean
  /** Render as a `role="tab"` whose `aria-selected` follows `active`. */
  asTab?: boolean
}) {
  const on = tone === 'green'
    ? { background: 'rgba(34,197,94,0.12)', color: '#86efac' }
    : { background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      role={asTab ? 'tab' : undefined}
      aria-selected={asTab ? active : undefined}
      data-testid={testId}
      className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all whitespace-nowrap"
      style={{ background: active ? on.background : 'var(--bg-card)', border: '1px solid var(--border-color)', color: active ? on.color : semantic.textSecondary }}
    >
      {children}
    </button>
  )
}

export function NewProjectTile({ onClick, label = 'New Project' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:border-white/20" style={{ border: '1px dashed var(--border-color)', background: 'transparent' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}><Plus size={16} style={{ color: 'rgba(255,255,255,0.6)' }} /></div>
      <span className="text-xs" style={{ color: semantic.textSecondary }}>{label}</span>
    </button>
  )
}

/** Recent-project tile: preview (or folder icon), name and delete on hover. */
export function ProjectTile({ name, preview, meta, onOpen, onDelete }: { name: string; preview?: string; meta?: string; onOpen: () => void; onDelete?: () => void }) {
  return (
    <div role="button" tabIndex={0} aria-label={`Open project ${name}`} className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/20" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} onClick={onOpen} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      {preview ? <img src={preview} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><FolderOpen size={20} style={{ color: semantic.textDisabled }} /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-2">
        <p className="text-xs font-medium truncate">{name}</p>
        {meta && <p className="text-[10px] truncate" style={{ color: semantic.textSecondary }}>{meta}</p>}
        {onDelete && <button type="button" onClick={event => { event.stopPropagation(); onDelete() }} className="absolute top-2 right-2 p-1 rounded-lg transition-all" style={{ background: 'rgba(0,0,0,0.6)' }} aria-label={`Delete project ${name}`}><Trash2 size={11} className="text-red-400" /></button>}
      </div>
    </div>
  )
}

/** Chat bubble: primary-filled for the user, card surface for the assistant. */
export function ChatBubble({ role, children, below, preWrap = false }: { role: 'user' | 'assistant'; children: ReactNode; below?: ReactNode; preWrap?: boolean }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%] space-y-2">
        <div className={`px-4 py-3 rounded-2xl text-sm${preWrap ? ' whitespace-pre-wrap break-words' : ''}`} style={{ background: role === 'user' ? 'var(--color-primary)' : 'var(--bg-card)', color: role === 'user' ? 'black' : 'white', border: role === 'assistant' ? '1px solid var(--border-color)' : 'none' }}>{children}</div>
        {below}
      </div>
    </div>
  )
}

/** Design Agent template-picker dialog shell: header, search, scrolling body, footer. */
export function TemplatePickerModal({ open, onClose, title, subtitle, search, setSearch, searchPlaceholder = 'Search templates...', footerLabel, children }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  search: string
  setSearch: (value: string) => void
  searchPlaceholder?: string
  footerLabel: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up" style={{ background: '#111', border: '1px solid var(--border-color)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={event => event.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.2)' }}><Sparkles size={18} style={{ color: '#60a5fa' }} /></div>
            <div><h2 className="text-base font-semibold">{title}</h2><p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label={`Close ${title}`}><X size={17} /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={searchPlaceholder} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'white' }} />
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 p-4 pt-2">{children}</div>
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.3)' }}><Sparkles size={12} /><span className="text-xs">{footerLabel}</span></div>
          <button type="button" onClick={onClose} className="text-xs font-medium transition-all hover:text-white" style={{ color: 'rgba(255,255,255,0.4)' }}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}

/** One template/recipe card inside `TemplatePickerModal`. */
export function TemplateOption({ label, description, onSelect, selected, testId, media, meta, onActiveChange }: {
  label: string
  description: string
  onSelect: () => void
  selected?: boolean
  testId?: string
  /** Optional preview shown above the label (e.g. a thumbnail or player). */
  media?: ReactNode
  /** Optional secondary line under the label (e.g. an upstream key). */
  meta?: string
  /** Hover/focus in (true) and out (false) — lets the caller drive one live preview. */
  onActiveChange?: (active: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onActiveChange && (() => onActiveChange(true))}
      onMouseLeave={onActiveChange && (() => onActiveChange(false))}
      onFocus={onActiveChange && (() => onActiveChange(true))}
      onBlur={onActiveChange && (() => onActiveChange(false))}
      aria-pressed={selected}
      data-testid={testId}
      className="p-4 rounded-xl text-left transition-all hover:bg-white/5"
      style={{ border: selected ? '1px solid rgba(96,165,250,0.6)' : '1px solid var(--border-color)', background: selected ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)' }}
    >
      {media && <div className="mb-3">{media}</div>}
      <div className="flex items-center gap-2 mb-2"><Sparkles size={13} style={{ color: '#60a5fa', flexShrink: 0 }} /><span className="text-sm font-medium">{label}</span></div>
      {meta && <div className="-mt-1 mb-2 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{meta}</div>}
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{description}</p>
    </button>
  )
}

/** Design Agent plan card: proposed steps with Approve / Revise. */
export function PlanCard({ eyebrow, title, meta, steps, onApprove, onReject, busy, approveLabel = 'Approve & Generate', rejectLabel = 'Reject / Revise', testId }: {
  eyebrow: string
  title: string
  meta: string
  steps: Array<{ key: string; label: string; detail: string; media?: ReactNode }>
  onApprove: () => void
  onReject: () => void
  busy: boolean
  approveLabel?: string
  rejectLabel?: string
  testId?: string
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(96,165,250,0.28)' }} data-testid={testId}>
      <div className="flex items-start justify-between gap-4">
        <div><div className="text-xs font-semibold" style={{ color: '#60a5fa' }}>{eyebrow}</div><div className="mt-1 text-sm font-semibold">{title}</div></div>
        <div className="text-xs whitespace-nowrap" style={{ color: semantic.textSecondary }}>{meta}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {steps.map((step, index) => (
          <div key={step.key} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            {step.media && <div className="mb-2">{step.media}</div>}
            <div className="text-xs font-medium">{index + 1}. {step.label}</div>
            <div className="mt-1 text-[11px]" style={{ color: semantic.textMuted }}>{step.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onReject} className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: semantic.textSecondary }}>{rejectLabel}</button>
        <button type="button" disabled={busy} onClick={onApprove} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: 'var(--color-primary)', color: 'white' }}>{approveLabel}</button>
      </div>
    </div>
  )
}

/** Running / done / error activity lines (Design Agent attachment strip style). */
export function ActivityList({ items }: { items: Array<{ label: string; status: 'running' | 'done' | 'error' }> }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl p-2" role="status" aria-live="polite" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-color)' }}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="text-xs" style={{ color: item.status === 'error' ? '#f87171' : item.status === 'done' ? '#86efac' : '#60a5fa' }}>
          {item.status === 'done' ? '✓' : item.status === 'error' ? '!' : '●'} {item.label}
        </div>
      ))}
    </div>
  )
}
