'use client'

/**
 * "Many recipients" tools for the overlay editor (Stage 10): import a list from a CSV, check it, then make each person's thumbnail,
 * GIF and (optionally) video from the current design, one after another in THIS tab. Progress is saved after every step, so a closed
 * or crashed tab can be resumed. It is not a background service: nothing is made while the tab is closed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PreviewInputProps } from '../preview/types'
import { buildRecipients, CORE_FIELDS, parseCsv, suggestMapping, type ColumnTarget, type ImportResult, type ParsedCsv, type Recipient } from '../bulk/csv'
import { canResume, createIdbStores, createJob, markStepsMissing, retryFailed, runBatch, summarize, withExclusiveRun, type ArtifactStore, type BatchJob, type JobStore, type RunDeps, type StepName } from '../bulk/batchJob'
import { buildPackage } from '../bulk/outputPackage'
import { chunk, linkLabels, templateFingerprint } from '../bulk/recipientInput'
import { issueRecipientLinks, parseVideoId } from '../publish/recipientLinksClient'
import { createBatchRunner } from './batchSteps'
import { browserDownloadBlob } from './ThumbnailGifPanel'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface BulkPanelProps {
  inputProps: PreviewInputProps
  /** Test seams. */
  storesFn?: () => Promise<{ store: JobStore; artifacts: ArtifactStore }>
  runnerFn?: (base: PreviewInputProps, recipients: Recipient[]) => RunDeps
  downloadFn?: (fileName: string, blob: Blob) => void
  issueLinksFn?: typeof issueRecipientLinks
  locks?: LockManager | undefined
  retryDelayMs?: number
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const STEP_LABEL: Record<StepName, string> = { thumbnail: 'Thumbnail picture', gif: 'Animated GIF', video: 'Video (slow)' }
const TARGETS: Array<[string, string]> = [['', 'Ignore'], ...CORE_FIELDS.map((f): [string, string] => [f, f[0].toUpperCase() + f.slice(1)]), ['custom', 'Merge field']]
const targetValue = (t: ColumnTarget) => (t === null ? '' : typeof t === 'string' ? t : 'custom')
const RECIPIENTS_KEY = (jobId: string) => `${jobId}/recipients`

export function BulkPanel({ inputProps, storesFn, runnerFn, downloadFn, issueLinksFn, locks, retryDelayMs }: BulkPanelProps) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<ColumnTarget[]>([])
  const [steps, setSteps] = useState<StepName[]>(['thumbnail', 'gif'])
  const [job, setJob] = useState<BatchJob | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  const [videoAddress, setVideoAddress] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})
  const stores = useRef<Awaited<ReturnType<NonNullable<typeof storesFn>>> | null>(null)
  const abort = useRef<AbortController | null>(null)
  const fingerprint = useMemo(() => templateFingerprint(inputProps.settings, { v: inputProps.videoUrl, b: inputProps.brand }), [inputProps])
  const dl = downloadFn ?? browserDownloadBlob
  const say = (t: string, bad = false) => setMessage({ text: t, bad })

  const getStores = useCallback(async () => (stores.current ??= await (storesFn ?? createIdbStores)()), [storesFn])

  // A batch saved by an earlier visit (reload, crash, closed tab).
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const s = await getStores(); const saved = await s.store.load(); if (!saved || !live) return
        const blob = await s.artifacts.get(RECIPIENTS_KEY(saved.id)); const list = blob ? (JSON.parse(await blob.text()) as Recipient[]) : []
        if (!live) return; setJob({ ...saved, state: saved.state === 'running' ? 'paused' : saved.state }); setRecipients(list)
      } catch { /* storage unavailable: the panel still works for this visit */ }
    })()
    return () => { live = false }
  }, [getStores])
  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (!running) return undefined
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  const result: ImportResult | null = useMemo(() => (parsed ? buildRecipients(parsed.rows, parsed.header, mapping) : null), [parsed, mapping])

  const load = (csv: string) => {
    const p = parseCsv(csv); setParsed(p); setMapping(suggestMapping(p.header)); setMessage(p.rows.length === 0 ? { text: p.problems.join(' ') || 'No rows found.', bad: true } : null)
  }
  const onFile = async (file: File | undefined) => { if (!file) return; if (file.size > 5_000_000) { say('That file is larger than 5 MB.', true); return } const t = await file.text(); setText(t); load(t) }
  const setTarget = (col: number, value: string) => setMapping((m) => m.map((t, i) => {
    if (i !== col) return value && value !== 'custom' && t === value ? null : t // a field can only come from one column
    return value === '' ? null : value === 'custom' ? { custom: (parsed?.header[col] ?? 'field').replace(/[^A-Za-z0-9]+/g, '') || 'field' } : (value as ColumnTarget)
  }))

  const run = useCallback(async (j: BatchJob, list: Recipient[]) => {
    const s = await getStores(); const ac = new AbortController(); abort.current = ac
    const exclusive = await withExclusiveRun(j.id, async () => {
      setRunning(true)
      try {
        const deps = (runnerFn ?? ((b, r) => createBatchRunner(b, r)))(inputProps, list)
        return await runBatch(j, deps, { store: s.store, artifacts: s.artifacts, signal: ac.signal, concurrency: 1, maxAttempts: 2, retryDelayMs, onProgress: (snap) => setJob(snap) })
      } finally { setRunning(false) }
    }, locks)
    if (!exclusive.ran) { say('This batch is already running in another tab. Close that tab or wait for it to finish.', true); return }
    const final = exclusive.value; setJob(final)
    say(final.state === 'completed' ? `Finished: ${summarize(final).done} done, ${summarize(final).failed} could not be made.` : final.message ?? 'Paused. You can resume it.', final.state !== 'completed' && Boolean(final.message))
  }, [getStores, inputProps, locks, retryDelayMs, runnerFn])

  const start = async () => {
    if (!result?.recipients.length || !steps.length) return
    const s = await getStores(); if (job) await s.artifacts.clearJob(job.id)
    const j = createJob(result.recipients.map((r) => ({ id: r.id, label: r.company || r.name || r.email })), steps, fingerprint)
    try { await s.artifacts.put(RECIPIENTS_KEY(j.id), new Blob([JSON.stringify(result.recipients)], { type: 'application/json' })); await s.store.save(j) } catch { say('This browser would not let the batch keep its files (storage may be full or blocked, for example in a private window). A batch needs that storage to hold the files until you download them, so it was not started. Free some space or use a normal window.', true); return }
    setRecipients(result.recipients); setJob(j); setLinks({}); await run(j, result.recipients)
  }
  const resume = async (retry = false) => {
    if (!job) return
    const ok = canResume(job, fingerprint); if (!ok.ok) { say(ok.reason, true); return }
    await run(retry ? retryFailed(job) : job, recipients)
  }
  const discard = async () => { abort.current?.abort(); const s = await getStores(); if (job) await s.artifacts.clearJob(job.id); await s.store.clear(); setJob(null); setRecipients([]); setLinks({}); say('The saved batch was removed.') }
  const [lost, setLost] = useState(0)
  const download = async (partial = false) => {
    if (!job) return; const s = await getStores()
    try {
      const pkg = await buildPackage({ job, recipients, artifacts: s.artifacts, links })
      if (pkg.missing > 0 && !partial) {
        // Some stored files can no longer be read (private windows and storage cleanup do this). Do not hand over a short package:
        // mark exactly those steps to be made again, and let the owner resume.
        const fixed = markStepsMissing(job, pkg.missingSteps); setJob(fixed); setLost(pkg.missing); try { await s.store.save(fixed) } catch { /* the in-memory job is still correct */ }
        say(`${pkg.missing} file${pkg.missing === 1 ? ' was' : 's were'} lost from this browser's storage (this can happen in private windows). Press Resume to make ${pkg.missing === 1 ? 'it' : 'them'} again, then download.`, true); return
      }
      dl('personalized-videos.zip', pkg.blob)
      const stillMissing = Math.max(lost, pkg.missing); setLost(0)
      say(`Package downloaded: ${pkg.included} files${stillMissing ? `. ${stillMissing} file${stillMissing === 1 ? ' is' : 's are'} missing; those recipients show as not finished in the manifest` : ''}.`, stillMissing > 0)
    } catch (e) { say(String((e as Error)?.message ?? e), true) }
  }
  const makeLinks = async () => {
    const id = parseVideoId(videoAddress); if (!id) { say('That does not look like a published video address (…/watch/<id>).', true); return }
    const labels = linkLabels(recipients); const made: Record<string, string> = {}
    for (const part of chunk(labels.map((l, i) => ({ l, i })), 50)) {
      const res = await (issueLinksFn ?? issueRecipientLinks)(id, part.map((p) => p.l))
      if (!res.ok) { say(res.message, true); setLinks(made); return }
      const byLabel = new Map(res.data.map((d) => [d.label.toLowerCase(), d.url]))
      for (const p of part) { const url = byLabel.get(p.l.toLowerCase()); if (url) made[recipients[p.i].id] = url }
    }
    setLinks(made); say(`${Object.keys(made).length} personal links made. They are shown only once: download the package now.`)
  }

  const sum = job ? summarize(job) : null
  const stale = job ? !canResume(job, fingerprint).ok : false
  const toggle = (s: StepName) => setSteps((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : (['thumbnail', 'gif', 'video'] as StepName[]).filter((x) => x === s || cur.includes(x))))
  const errorsShown = (result?.issues ?? []).filter((i) => i.level === 'error').slice(0, 8)

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="bulk-panel">
      <div style={labelStyle}>Many recipients</div>
      <p style={hintStyle}>Paste or open a spreadsheet saved as CSV. Each person gets their own copy of this design with their company, name and other columns filled in. Files are made one after another in this tab; keep it open. Progress is saved, so you can resume after a reload.</p>

      {job && sum ? (
        <div data-testid="bulk-job" style={{ ...hintStyle, color: C.text }}>
          <div role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sum.percent} style={{ height: 8, background: C.field, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${sum.percent}%`, height: '100%', background: C.accent }} /></div>
          <div data-testid="bulk-summary">{sum.done} of {sum.total} done{sum.failed ? `, ${sum.failed} could not be made` : ''}{running ? ' — working…' : job.state === 'paused' ? ' — paused' : job.state === 'completed' ? ' — finished' : ''}</div>
          {stale ? <div role="alert">The video design changed since this batch started. Start a new batch to use the new design, or download what was already made.</div> : null}
          <div style={row}>
            {running ? <button type="button" style={small} onClick={() => abort.current?.abort()}>Pause</button> : null}
            {!running && job.state !== 'completed' && job.state !== 'cancelled' ? <button type="button" style={small} disabled={stale} onClick={() => void resume()}>Resume</button> : null}
            {!running && sum.failed > 0 ? <button type="button" style={small} disabled={stale} onClick={() => void resume(true)}>Try the failed ones again</button> : null}
            {!running && sum.done + sum.failed > 0 ? <button type="button" style={small} onClick={() => void download()}>Download package (.zip)</button> : null}
            {!running && lost > 0 ? <button type="button" style={small} onClick={() => void download(true)}>Download without them</button> : null}
            {!running ? <button type="button" style={small} onClick={() => void discard()}>Discard batch</button> : null}
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 16, maxHeight: 120, overflow: 'auto' }}>
            {job.items.filter((i) => i.status === 'failed').slice(0, 20).map((i) => <li key={i.id}>{i.label}: {i.error}</li>)}
          </ul>
          {recipients.length > 0 && !running ? (
            <div style={{ ...row, marginTop: 6 }}>
              <input aria-label="Published video address for personal links" placeholder="Optional: …/watch/<id> to add personal links" value={videoAddress} onChange={(e) => setVideoAddress(e.target.value)} style={{ ...inputStyle, minHeight: 28, padding: '0 6px', flex: 1, minWidth: 180 }} />
              <button type="button" style={small} disabled={!videoAddress.trim()} onClick={() => void makeLinks()}>Make personal links</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!running ? (
        <>
          <textarea aria-label="CSV text" rows={4} placeholder={'Company,Email,Website,First name\nAcme Roofing,ann@acme.com,acme.com,Ann'} value={text} onChange={(e) => setText(e.target.value)} style={{ ...inputStyle, padding: 6, width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
          <div style={row}>
            <input aria-label="Open a CSV file" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} style={{ fontSize: 11, color: C.muted }} />
            <button type="button" style={small} disabled={!text.trim()} onClick={() => load(text)}>Read the list</button>
          </div>
        </>
      ) : null}

      {parsed && result && !running ? (
        <div data-testid="bulk-import">
          {parsed.problems.map((p) => <div key={p} style={hintStyle}>⚠ {p}</div>)}
          <table style={{ width: '100%', fontSize: 11, color: C.text }}>
            <thead><tr><th align="left">Column</th><th align="left">Use as</th><th align="left">First value</th></tr></thead>
            <tbody>{parsed.header.map((h, i) => (
              <tr key={`${h}-${i}`}><td>{h}</td>
                <td><select aria-label={`Use column ${h} as`} value={targetValue(mapping[i])} onChange={(e) => setTarget(i, e.target.value)} style={{ ...inputStyle, minHeight: 24, fontSize: 11 }}>{TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  {typeof mapping[i] === 'object' && mapping[i] ? <span style={hintStyle}> as {'{{'}{(mapping[i] as { custom: string }).custom}{'}}'}</span> : null}</td>
                <td style={{ color: C.muted }}>{parsed.rows[0]?.[i] ?? ''}</td></tr>))}</tbody>
          </table>
          <div data-testid="bulk-counts" style={{ ...hintStyle, color: C.text }}>{result.counts.accepted} recipients ready{result.counts.skipped ? `; ${result.counts.skipped} rows skipped (${result.counts.duplicates} repeats)` : ''}.</div>
          {errorsShown.map((i) => <div key={`${i.row}-${i.code}`} style={hintStyle}>Row {i.row}: {i.message}</div>)}
          <div style={row}>{(['thumbnail', 'gif', 'video'] as StepName[]).map((s) => <label key={s} style={{ ...hintStyle, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={steps.includes(s)} onChange={() => toggle(s)} />{STEP_LABEL[s]}</label>)}</div>
          <button type="button" style={small} disabled={result.counts.accepted === 0 || steps.length === 0} onClick={() => void start()}>Start making {result.counts.accepted} {result.counts.accepted === 1 ? 'set' : 'sets'} of files</button>
        </div>
      ) : null}

      {message ? <div role={message.bad ? 'alert' : 'status'} data-testid="bulk-message" style={hintStyle}>{message.text}</div> : null}
      <p style={hintStyle}>The manifest in the package lists every recipient and any file that could not be made. Spreadsheet formulas in your data are neutralised in the manifest.</p>
    </div>
  )
}
