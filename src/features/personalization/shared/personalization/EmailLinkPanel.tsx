'use client'
import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { EMAIL_PROVIDERS, mergeTagLink, leadLinks, leadLinksCsv, recipientIdTagFor, previewLink, emailSnippet } from './emailMergeLink'

const STORAGE_KEY = 'pz-email-link-base'

function readSaved(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch { /* private mode */ }
  // Optional default for the video link (Next inlines NEXT_PUBLIC_* at build time; other bundlers have no `process`).
  try { return process.env.NEXT_PUBLIC_PERSONALIZED_VIDEO_BASE_URL || '' } catch { return '' }
}

type SavedLead = { id: string; business: { name?: string; email?: string; city?: string; region?: string } }

const CUSTOM_KEY = 'pz-email-custom-provider'
type CustomDef = { open: string; close: string; fields: string }
const DEFAULT_CUSTOM: CustomDef = { open: '{{', close: '}}', fields: '' }

function readCustom(): CustomDef {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CUSTOM_KEY) || 'null')
    if (raw && typeof raw === 'object') {
      return { open: String(raw.open ?? ''), close: String(raw.close ?? ''), fields: String(raw.fields ?? '') }
    }
  } catch { /* private mode or bad JSON */ }
  return DEFAULT_CUSTOM
}

/** "firstName=FNAME" lines -> { firstName: 'FNAME' } (blank or malformed lines are ignored). */
function parseFields(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i < 1) continue
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (k && v) out[k] = v
  }
  return out
}

const isHttpUrl = (v: string) => {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

/**
 * One link for a whole email campaign: the email provider (Mailchimp, Klaviyo, …)
 * replaces each merge tag with that recipient's value when it sends.
 * `tokens` are the {{tokens}} the personalized content uses.
 */
export default function EmailLinkPanel({ tokens, noDefaults = [] }: { tokens: string[]; noDefaults?: string[] }) {
  const [base, setBase] = useState(readSaved)
  const [providerKey, setProviderKey] = useState(EMAIL_PROVIDERS[0].key)
  const [preload, setPreload] = useState(true)
  const [custom, setCustom] = useState<CustomDef>(readCustom)
  const [recipientOverride, setRecipientOverride] = useState<string | null>(null)
  const [utm, setUtm] = useState('')
  const [includePrivate, setIncludePrivate] = useState(false)
  const [poster, setPoster] = useState('')
  const [snippetCopied, setSnippetCopied] = useState(false)
  const [copied, setCopied] = useState(false)
  const [leads, setLeads] = useState<SavedLead[] | null>(null)
  const [leadsState, setLeadsState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [leadsError, setLeadsError] = useState('')

  const builtIn = EMAIL_PROVIDERS.find((p) => p.key === providerKey) || EMAIL_PROVIDERS[0]
  // "Custom" is the user's own provider: their wrapper and field names (empty wrapper falls back to {{ }}).
  const provider = useMemo(
    () => (builtIn.key === 'custom'
      ? { ...builtIn, label: 'your email provider', open: custom.open.trim() ? custom.open : '{{', close: custom.close.trim() ? custom.close : '}}', fields: parseFields(custom.fields) }
      : builtIn),
    [builtIn, custom],
  )
  const onCustom = (patch: Partial<CustomDef>) => {
    const next = { ...custom, ...patch }
    setCustom(next)
    try { window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }
  const baseOk = isHttpUrl(base.trim())
  // A unique recipient id lets views be told apart per recipient (the watch page records it as the contact).
  const recipientId = recipientOverride ?? recipientIdTagFor(provider)
  const result = useMemo(
    () => (baseOk ? mergeTagLink(base.trim(), tokens, provider, { preload, recipientId, utmCampaign: utm, includePrivate }) : null),
    [base, baseOk, tokens, provider, preload, recipientId, utm, includePrivate],
  )
  const preview = useMemo(() => (baseOk ? previewLink(base.trim(), tokens) : ''), [base, baseOk, tokens])
  const snippet = useMemo(() => (result ? emailSnippet({ link: result.link, posterUrl: poster }) : ''), [result, poster])
  const copySnippet = async () => {
    try { await navigator.clipboard.writeText(snippet); setSnippetCopied(true); setTimeout(() => setSnippetCopied(false), 1800) } catch { /* ignore */ }
  }

  const rows = useMemo(
    () => (baseOk && leads ? leadLinks(base.trim(), tokens, leads, { includePrivate }) : []),
    [base, baseOk, tokens, leads, includePrivate],
  )
  const loadLeads = async () => {
    setLeadsState('loading')
    setLeadsError('')
    try {
      const res = await fetch('/api/personalization/leads', { credentials: 'same-origin' })
      if (res.status === 401) throw new Error('Sign in to use your saved leads.')
      if (!res.ok) throw new Error(`Could not load saved leads (HTTP ${res.status})`)
      const data = await res.json()
      setLeads(Array.isArray(data?.leads) ? data.leads : [])
      setLeadsState('idle')
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : 'Could not load saved leads')
      setLeadsState('error')
    }
  }
  const downloadCsv = () => {
    const blob = new Blob([leadLinksCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'personal-links.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const onBase = (v: string) => {
    setBase(v)
    try { window.localStorage.setItem(STORAGE_KEY, v.trim()) } catch { /* private mode */ }
  }
  const copy = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  if (!tokens.length) {
    return (
      <p data-testid="pz-email-empty" className="text-sm text-white/50">
        Use {'{{tokens}}'} such as {'{{firstName}}'} in your prompt to get one link your email provider can personalize for every recipient.
      </p>
    )
  }

  return (
    <div data-testid="pz-email-panel" className="space-y-4">
      <p className="text-xs text-white/40">
        Paste the link to your published personalized video, pick your email provider, and paste the result into your campaign.
      </p>
      <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
        Video link
        <input
          data-testid="pz-email-base"
          value={base}
          onChange={(e) => onBase(e.target.value)}
          placeholder="https://your-site.com/watch/abc123"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm normal-case text-white"
        />
      </label>
      {base.trim() && !baseOk && <p className="text-xs text-amber-300">Enter a full link starting with https://</p>}
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Email provider
          <select
            data-testid="pz-email-provider"
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            className="ml-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm normal-case text-white"
          >
            {EMAIL_PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input type="checkbox" checked={preload} onChange={(e) => setPreload(e.target.checked)} /> Preload video
        </label>
      </div>
      {builtIn.key === 'custom' && (
        <div data-testid="pz-email-custom" className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs text-white/40">Tell us how your email provider writes a merge tag, for example <code>{'<<'}</code> and <code>{'>>'}</code> for <code>{'<<FirstName>>'}</code>.</p>
          <div className="flex gap-3">
            <label className="text-xs text-white/60">Starts with
              <input data-testid="pz-email-custom-open" value={custom.open} onChange={(e) => onCustom({ open: e.target.value })} className="ml-2 w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
            </label>
            <label className="text-xs text-white/60">Ends with
              <input data-testid="pz-email-custom-close" value={custom.close} onChange={(e) => onCustom({ close: e.target.value })} className="ml-2 w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
            </label>
          </div>
          <label className="block text-xs text-white/60">Field names (optional, one per line as <code>firstName=FirstName</code>)
            <textarea data-testid="pz-email-custom-fields" rows={3} value={custom.fields} onChange={(e) => onCustom({ fields: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
          </label>
        </div>
      )}
      {!baseOk && (
        <p className="text-xs text-white/40">The link must point to a page that reads token values from the link (for example a published personalized video).</p>
      )}
      {result && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <pre data-testid="pz-email-link" className="whitespace-pre-wrap break-all text-sm text-white/90">{result.link}</pre>
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
          </button>
          {result.unmapped.length > 0 && (
            <p className="text-xs text-amber-300">
              {builtIn.key === 'custom'
                ? `No field name set for ${result.unmapped.join(', ')}, so the token name is used as-is.`
                : `${provider.label} has no standard field for ${result.unmapped.join(', ')}. Create a custom field with that name there, or those values stay blank.`}
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-xs text-white/40">Not in the link (images can't be merge tags): {result.skipped.join(', ')}.</p>
          )}
        </div>
      )}
      {result && (
        <div data-testid="pz-email-options" className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Campaign options</span>
          <label className="block text-xs text-white/60">Recipient id tag (to see views per recipient)
            <input
              data-testid="pz-email-recipient"
              value={recipientId}
              onChange={(e) => setRecipientOverride(e.target.value)}
              placeholder={`your provider's unique id tag, e.g. ${provider.open}ID${provider.close}`}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/60">Campaign name for analytics (UTM, optional)
            <input data-testid="pz-email-utm" value={utm} onChange={(e) => setUtm(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input data-testid="pz-email-private" type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} />
            Put email and phone in the link (they will be visible in the URL)
          </label>
        </div>
      )}
      {result && (
        <div data-testid="pz-email-preflight" className="space-y-1 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Before you send</span>
          <p className={recipientId.trim() ? 'text-emerald-300' : 'text-amber-300'}>
            {recipientId.trim() ? `✓ Views will show per recipient.${provider.recipientUnverified && recipientId === recipientIdTagFor(provider) ? ` ${provider.label} doesn't list this tag in its own docs: send yourself a test to confirm it fills in.` : ''}` : '! No recipient id: every view will look the same. Add your provider\'s unique id tag above.'}
          </p>
          <p className={result.unmapped.length ? 'text-amber-300' : 'text-emerald-300'}>
            {result.unmapped.length ? `! Create a field in ${builtIn.key === 'custom' ? 'your provider' : provider.label} for: ${result.unmapped.join(', ')}.` : '✓ Every token has a field in your provider.'}
          </p>
          <p className={noDefaults.length ? 'text-amber-300' : 'text-emerald-300'}>
            {noDefaults.length ? `! No fallback for ${noDefaults.join(', ')}: a blank in your list leaves a gap. Write {{d ${noDefaults[0]} "there"}} to set one.` : '✓ Every token has a fallback if a value is blank.'}
          </p>
          {result.excluded.length > 0 && <p className="text-white/50">Left out of the link so they don't show in the URL: {result.excluded.join(', ')}.</p>}
          <p className="pt-1">
            <a data-testid="pz-email-preview" href={preview} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline">Preview as a recipient ↗</a>
            <span className="text-white/40"> (opens the video with sample details)</span>
          </p>
        </div>
      )}
      {result && (
        <div data-testid="pz-email-snippet" className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Email snippet</span>
          <p className="text-xs text-white/40">Email can't play video. Paste this into your email: it shows a picture (or a button) that opens the personalized video.</p>
          <input data-testid="pz-email-poster" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="Poster image URL (optional, https://…)" className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
          <pre data-testid="pz-email-snippet-code" className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-white/70">{snippet}</pre>
          <button onClick={copySnippet} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
            {snippetCopied ? <Check size={14} /> : <Copy size={14} />} {snippetCopied ? 'Copied' : 'Copy snippet'}
          </button>
        </div>
      )}
      {baseOk && (
        <div data-testid="pz-email-leads" className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">One link per saved lead</span>
            {leads === null && (
              <button onClick={loadLeads} disabled={leadsState === 'loading'} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5">
                {leadsState === 'loading' ? 'Loading…' : 'Load saved leads'}
              </button>
            )}
            {leads !== null && rows.length > 0 && (
              <button onClick={downloadCsv} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5">Download CSV ({rows.length})</button>
            )}
          </div>
          {leadsError && <p className="text-xs text-amber-300">{leadsError}</p>}
          {leads !== null && rows.length === 0 && <p className="text-xs text-white/40">No saved leads yet. Save businesses from the lead finder first.</p>}
          {rows.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto text-xs text-white/70">
              {rows.slice(0, 50).map((r, i) => <li key={i} className="truncate" title={r.link}>{r.name}{r.email ? ` · ${r.email}` : ''}</li>)}
              {rows.length > 50 && <li className="text-white/40">Showing 50 of {rows.length}. The CSV has them all.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
