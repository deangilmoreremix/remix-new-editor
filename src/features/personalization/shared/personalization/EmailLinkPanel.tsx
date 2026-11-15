'use client'
import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { EMAIL_PROVIDERS, mergeTagLink } from './emailMergeLink'

const STORAGE_KEY = 'pz-email-link-base'

function readSaved(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

const isHttpUrl = (v: string) => {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

/**
 * One link for a whole email campaign: the email provider (Mailchimp, Klaviyo, …)
 * replaces each merge tag with that recipient's value when it sends.
 * `tokens` are the {{tokens}} the personalized content uses.
 */
export default function EmailLinkPanel({ tokens }: { tokens: string[] }) {
  const [base, setBase] = useState(readSaved)
  const [providerKey, setProviderKey] = useState(EMAIL_PROVIDERS[0].key)
  const [preload, setPreload] = useState(true)
  const [copied, setCopied] = useState(false)

  const provider = EMAIL_PROVIDERS.find((p) => p.key === providerKey) || EMAIL_PROVIDERS[0]
  const baseOk = isHttpUrl(base.trim())
  const result = useMemo(
    () => (baseOk ? mergeTagLink(base.trim(), tokens, provider, { preload }) : null),
    [base, baseOk, tokens, provider, preload],
  )

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
              {provider.label} has no standard field for {result.unmapped.join(', ')}. Create a custom field with that name there, or those values stay blank.
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-xs text-white/40">Not in the link (images can't be merge tags): {result.skipped.join(', ')}.</p>
          )}
        </div>
      )}
    </div>
  )
}
