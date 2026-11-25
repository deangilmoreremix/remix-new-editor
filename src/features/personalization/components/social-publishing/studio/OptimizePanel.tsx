'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { suggestHashtags, appendHashtags, formatHashtags, NICHE_POOLS, dedupeTags, type HashtagGroup } from '@ohb/shared/social/hashtags'
import { rewriteCaption, summarizeText, translateText, shortenLocal, bulletsLocal, REWRITE_TONES, AiUnavailableError, type RewriteTone } from '@ohb/shared/social/copyTools'
import { aiAvailability, type AvailabilityState } from '@ohb/shared/social/capabilities'
import { copyText } from '@ohb/shared/social/clipboard'
import { hasBlockingErrors, type Finding } from '@ohb/shared/social/validation'
import type { SavedItem } from '@ohb/shared/social/collections'
import type { CopyState } from '../types'
import { useCapabilities, type Stores, btn, btnPrimary, field, h4 } from './useStudio'

interface Props {
  copy: CopyState
  writeCopy: CopyState
  onUpdateWriteCopy: (c: CopyState) => void
  findings: Finding[]
  stores: Stores | null
}

const LANGS = [['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['hi', 'Hindi']] as const
const SEV_STYLE = { error: 'border-red-500/30 bg-red-500/10 text-red-200', warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200', info: 'border-white/10 bg-white/5 text-white/70' }

type Pending = { kind: string; text: string; original: string } | null

export function OptimizePanel({ copy, writeCopy, onUpdateWriteCopy, findings, stores }: Props) {
  const caps = useCapabilities()
  const master = writeCopy.master || copy.master || ''
  const setMaster = useCallback((text: string) => onUpdateWriteCopy({ ...writeCopy, master: text, edited: { ...(writeCopy.edited || {}), master: true } }), [writeCopy, onUpdateWriteCopy])

  const [niche, setNiche] = useState<string>('')
  const [groups, setGroups] = useState<SavedItem[]>([])
  const [templates, setTemplates] = useState<SavedItem[]>([])
  const [tone, setTone] = useState<RewriteTone>('conversational')
  const [lang, setLang] = useState('es')
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [needsDownload, setNeedsDownload] = useState<null | (() => void)>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [avail, setAvail] = useState<Record<string, AvailabilityState>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    void Promise.all([aiAvailability('prompt'), aiAvailability('summarizer'), aiAvailability('translator', globalThis as any, { sourceLanguage: 'en', targetLanguage: lang })])
      .then(([prompt, summarizer, translator]) => setAvail({ prompt, summarizer, translator }))
  }, [lang])
  useEffect(() => {
    if (!stores) return
    void stores.collection('hashtag-group').list().then(setGroups)
    void stores.collection('caption-template').list().then(setTemplates)
  }, [stores])

  const suggestions = suggestHashtags(master, { niche: niche || null, existing: (master.match(/#[\p{L}\p{N}_]+/gu) || []) })
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? null : c)), 3500) }

  /** Run a browser-AI task. If a model download is needed, ask first; never download silently. */
  const runAi = async (kind: string, task: (allowDownload: boolean, onProgress: (f: number) => void, signal: AbortSignal) => Promise<string>, fallback?: () => string) => {
    if (!master.trim()) return flash('Write a caption first.')
    const go = async (allow: boolean) => {
      abortRef.current?.abort()
      const ac = new AbortController(); abortRef.current = ac
      setBusy(kind); setNeedsDownload(null); setProgress(null)
      try {
        const text = await task(allow, setProgress, ac.signal)
        setPending({ kind, text, original: master })
      } catch (e: any) {
        if (ac.signal.aborted) return
        if (e instanceof AiUnavailableError && e.state === 'downloadable') {
          setNeedsDownload(() => () => void go(true))
          setMsg(`${e.message} It runs on your device; nothing is sent to a server.`)
        } else if (fallback) {
          setPending({ kind: `${kind} (basic, on-device rules)`, text: fallback(), original: master })
          setMsg(`${e?.message || 'Browser AI is unavailable.'} Showing a simple rule-based result instead.`)
        } else setMsg(e?.message || 'That action failed.')
      } finally { setBusy(null); setProgress(null) }
    }
    await go(false)
  }

  const copyOut = async (text: string, what: string) => { const r = await copyText(text); flash(r.ok ? `${what} copied.` : r.message) }

  return (
    <div className="space-y-5">
      <section aria-label="Pre-publish checks">
        <h4 className={h4}>Pre-publish checks</h4>
        {findings.length === 0 ? <p className="text-xs text-emerald-300">No issues found.</p> : (
          <>
            <p className="text-[11px] text-white/50 mb-2">{hasBlockingErrors(findings) ? 'Fix the errors to publish. Warnings are optional.' : 'Nothing blocks publishing; these are recommendations.'}</p>
            <ul className="space-y-1.5">
              {findings.map((f) => (
                <li key={f.id} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${SEV_STYLE[f.severity]}`}>
                  <b className="uppercase mr-1">{f.severity}</b>{f.message}{f.fix && <span className="block opacity-80">→ {f.fix}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Hashtags">
        <h4 className={h4}>Hashtags</h4>
        <div className="flex gap-2 mb-2">
          <select aria-label="Niche" className={field} value={niche} onChange={(e) => setNiche(e.target.value)}>
            <option value="">Auto-detect niche</option>
            {Object.keys(NICHE_POOLS).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.length === 0 && <span className="text-[11px] text-white/40">Write a caption to get suggestions.</span>}
          {suggestions.map((t) => <button key={t} type="button" className={btn} onClick={() => setMaster(appendHashtags(master, [t]))}>#{t}</button>)}
        </div>
        <p className="mt-1.5 text-[10px] text-white/40">Suggestions come from your own text plus static niche lists. They are not live trending data.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!suggestions.length} onClick={() => setMaster(appendHashtags(master, suggestions.slice(0, 5)))}>Insert top 5</button>
          <button type="button" className={btn} onClick={() => void copyOut(formatHashtags(dedupeTags(master.match(/#[\p{L}\p{N}_]+/gu) || [])), 'Hashtags')}>Copy hashtags</button>
          <button type="button" className={btn} disabled={!stores || !suggestions.length} onClick={async () => { await stores!.collection('hashtag-group').add(niche || 'Group', suggestions.join(' ')); setGroups(await stores!.collection('hashtag-group').list()); flash('Hashtag group saved.') }}>Save as group</button>
        </div>
        {groups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <span key={g.id} className="inline-flex items-center rounded-lg border border-white/10 text-[11px]">
                <button type="button" className="px-2 py-1 text-white/80 hover:text-white" title={g.value} onClick={() => setMaster(appendHashtags(master, g.value.split(' ')))}>＋ {g.name}</button>
                <button type="button" aria-label={`Delete group ${g.name}`} className="px-1.5 py-1 text-white/40 hover:text-red-300" onClick={async () => { await stores!.collection('hashtag-group').remove(g.id); setGroups(await stores!.collection('hashtag-group').list()) }}>×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Caption tools">
        <h4 className={h4}>Rewrite, translate, summarize</h4>
        <p className="text-[10px] text-white/40 mb-2">Uses your browser's built-in on-device AI when available (Chrome/Edge, experimental). Your original is kept until you accept a result.</p>
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <select aria-label="Tone" className={`${field} !w-auto`} value={tone} onChange={(e) => setTone(e.target.value as RewriteTone)}>{REWRITE_TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          <button type="button" className={btn} disabled={!!busy} title={caps.promptApi ? '' : 'Prompt API not detected; a basic fallback will be used where possible'}
            onClick={() => runAi('Rewrite', (allow, onProgress, signal) => rewriteCaption(master, tone, { allowDownload: allow, onProgress, signal }), tone === 'short' ? () => shortenLocal(master, 150) : undefined)}>Rewrite</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <select aria-label="Translate to" className={`${field} !w-auto`} value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          <button type="button" className={btn} disabled={!!busy || !caps.translator} onClick={() => runAi('Translate', (allow, onProgress, signal) => translateText(master, 'en', lang, { allowDownload: allow, onProgress, signal }))}>Translate</button>
          {!caps.translator && <span className="text-[10px] text-white/40">Translation isn't available in this browser.</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!!busy} onClick={() => runAi('Short caption', (a, p, s) => summarizeText(master, 'caption', { allowDownload: a, onProgress: p, signal: s }), () => shortenLocal(master, 150))}>Long → short</button>
          <button type="button" className={btn} disabled={!!busy} onClick={() => runAi('Bullet summary', (a, p, s) => summarizeText(master, 'bullets', { allowDownload: a, onProgress: p, signal: s }), () => bulletsLocal(master).map((b) => `• ${b}`).join('\n'))}>Bullets</button>
        </div>
        <p className="mt-1.5 text-[10px] text-white/40">Availability — rewrite: {avail.prompt ?? '…'} · summarize: {avail.summarizer ?? '…'} · translate: {avail.translator ?? '…'}. Summaries use the text you wrote or a transcript, not the video itself.</p>
        {busy && <p role="status" className="mt-2 text-[11px] text-white/70">{busy}…{progress !== null && ` model download ${Math.round(progress * 100)}%`} <button type="button" className="underline ml-2" onClick={() => abortRef.current?.abort()}>Cancel</button></p>}
        {needsDownload && <button type="button" className={`${btnPrimary} mt-2`} onClick={needsDownload}>Download on-device model &amp; continue</button>}
        {msg && <p role="status" className="mt-2 text-[11px] text-amber-200">{msg}</p>}
        {pending && (
          <div className="mt-3 rounded-lg border border-[#d9ff00]/30 bg-[#d9ff00]/5 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">{pending.kind} — suggestion</p>
            <textarea aria-label="Suggested text (editable)" className={`${field} min-h-[80px]`} value={pending.text} onChange={(e) => setPending({ ...pending, text: e.target.value })} />
            <div className="mt-2 flex gap-2">
              <button type="button" className={btnPrimary} onClick={() => { setMaster(pending.text); setPending(null) }}>Replace caption</button>
              <button type="button" className={btn} onClick={() => { setMaster(`${master}\n\n${pending.text}`); setPending(null) }}>Append instead</button>
              <button type="button" className={btn} onClick={() => setPending(null)}>Discard</button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Caption templates">
        <h4 className={h4}>Saved captions &amp; templates</h4>
        <div className="flex gap-2 mb-2">
          <button type="button" className={btn} disabled={!stores || !master.trim()} onClick={async () => { await stores!.collection('caption-template').add(master.slice(0, 32), master); setTemplates(await stores!.collection('caption-template').list()); flash('Saved to templates.') }}>Save current caption</button>
          <button type="button" className={btn} onClick={() => void copyOut(master, 'Post text')} disabled={!master}>Copy post text</button>
        </div>
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-[11px]">
              <button type="button" className="flex-1 truncate text-left text-white/80 hover:text-white" title={t.value} onClick={() => setMaster(t.value)}>{t.name}</button>
              <button type="button" aria-label={`Delete template ${t.name}`} className="text-white/40 hover:text-red-300" onClick={async () => { await stores!.collection('caption-template').remove(t.id); setTemplates(await stores!.collection('caption-template').list()) }}>×</button>
            </li>
          ))}
          {templates.length === 0 && <li className="text-[11px] text-white/40">No saved captions yet.</li>}
        </ul>
        {stores && !stores.persistent && <p className="mt-1 text-[10px] text-amber-200">Browser storage isn't available, so saved items only last until you close this tab.</p>}
      </section>
    </div>
  )
}
