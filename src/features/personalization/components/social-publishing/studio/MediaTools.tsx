'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ASPECTS, type AspectKey } from '@ohb/shared/social/platformConfig'
import { validateFileType } from '@ohb/shared/social/validation'
import { COMPRESSION_PRESETS, TRIM_PRESETS, clampTrim, presetTrim, estimateVideoBytes, formatBytes, type CompressionPreset, type FitMode } from '@ohb/shared/social/mediaPrep'
import { reframeImage, compressImage, probeVideo, processVideo, MediaCancelledError, MediaUnsupportedError } from '@ohb/shared/social/mediaProcessing'
import { parseSubtitles, toSrt, toVtt, shiftCues, validateCues, type Cue } from '@ohb/shared/social/subtitles'
import { exportFilename, downloadBlob } from '@ohb/shared/social/exportNames'
import { imagesFromPasteEvent } from '@ohb/shared/social/clipboard'
import type { Asset, ThumbnailState } from '../types'
import { useCapabilities, useObjectUrls, blobToDataUrl, type MediaMeta, btn, btnPrimary, field, h4 } from './useStudio'
import { AudioTools } from './AudioTools'
import { TextOverlayTools } from './TextOverlayTools'

interface Props {
  asset: Asset
  title: string
  meta: MediaMeta
  onReplaceAsset?: (a: Asset) => void
  onUpdateThumbnail: (t: ThumbnailState) => void
}

interface LibItem { id: string; name: string; kind: 'image' | 'video'; blob: Blob; url: string }
interface Output { id: string; label: string; kind: 'image' | 'video'; blob: Blob; url: string }

let seq = 0
const nid = () => `m${++seq}-${Date.now().toString(36)}`

export function MediaTools({ asset, title, meta, onReplaceAsset, onUpdateThumbnail }: Props) {
  const caps = useCapabilities()
  const urls = useObjectUrls()
  const [lib, setLib] = useState<LibItem[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const dragIdx = useRef<number | null>(null)
  const [aspect, setAspect] = useState<AspectKey>('9:16')
  const [mode, setMode] = useState<FitMode>('fill')
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 })
  const [preset, setPreset] = useState<CompressionPreset>('balanced')
  const [trim, setTrim] = useState({ start: 0, end: 0 })
  const [frameAt, setFrameAt] = useState(0)
  const [job, setJob] = useState<{ label: string; progress: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const [subPos, setSubPos] = useState<'top' | 'middle' | 'bottom'>('bottom')
  const [shift, setShift] = useState(0)
  const dur = meta.duration && Number.isFinite(meta.duration) ? meta.duration : 0

  useEffect(() => { if (dur) setTrim({ start: 0, end: dur }) }, [dur, asset.url])
  useEffect(() => () => abortRef.current?.abort(), [])

  const addFiles = useCallback((files: File[]) => {
    const bad: string[] = []
    const ok: LibItem[] = []
    for (const f of files) {
      const v = validateFileType(f.type)
      if (!v.ok || !v.kind) { bad.push(`${f.name}: ${v.reason}`); continue }
      ok.push({ id: nid(), name: f.name, kind: v.kind, blob: f, url: urls.create(f) })
    }
    setRejected(bad)
    if (ok.length) setLib((l) => [...l, ...ok])
  }, [urls])

  // Paste images anywhere inside the panel.
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = imagesFromPasteEvent(e as any)
    if (imgs.length) { e.preventDefault(); addFiles(imgs) }
  }

  const source = async (): Promise<Blob> => {
    const picked = lib.find((l) => l.url === asset.url)
    if (picked) return picked.blob
    try {
      const r = await fetch(asset.url)
      if (!r.ok) throw new Error(String(r.status))
      return await r.blob()
    } catch {
      throw new Error('This media is hosted somewhere the browser cannot read for editing (CORS). Download it and drop the file here to edit it.')
    }
  }

  const addOutput = (o: Omit<Output, 'id' | 'url'>) => setOutputs((x) => [{ ...o, id: nid(), url: urls.create(o.blob) }, ...x])

  const run = async (label: string, fn: (signal: AbortSignal, progress: (f: number) => void) => Promise<void>) => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setErr(null); setJob({ label, progress: 0 })
    try { await fn(ac.signal, (f) => setJob({ label, progress: f })) }
    catch (e: any) { if (!(e instanceof MediaCancelledError)) setErr(e instanceof MediaUnsupportedError ? `${e.message}` : `${label} failed: ${e?.message ?? e}. Your original file is unchanged and can still be published.`) }
    finally { setJob(null) }
  }

  const doReframe = () => run('Reframe', async (signal, progress) => {
    const blob = await source()
    if (asset.type === 'image') addOutput({ label: `Reframed ${aspect} (${mode})`, kind: 'image', blob: await reframeImage(blob, aspect, mode, { focus, signal }) })
    else { const r = await processVideo({ file: blob, aspect, mode, focus, preset, longEdge: 1920, onProgress: progress, signal, trim: trim.end > trim.start && dur ? trim : undefined }); addOutput({ label: `Reframed ${aspect} ${r.width}×${r.height}`, kind: 'video', blob: r.blob }) }
  })
  const doTrim = () => run('Trim', async (signal, progress) => {
    const r = await processVideo({ file: await source(), trim: clampTrim(trim, dur), preset: 'high', onProgress: progress, signal })
    addOutput({ label: `Trimmed ${trim.start.toFixed(1)}–${trim.end.toFixed(1)}s`, kind: 'video', blob: r.blob })
  })
  const doCompress = () => run('Compress', async (signal, progress) => {
    const blob = await source()
    if (asset.type === 'image') { const r = await compressImage(blob, preset, 2048, signal); addOutput({ label: `Compressed (${COMPRESSION_PRESETS[preset].label}) ${formatBytes(blob.size)} → ${formatBytes(r.blob.size)}`, kind: 'image', blob: r.blob }) }
    else { const r = await processVideo({ file: blob, preset, longEdge: 1920, onProgress: progress, signal }); addOutput({ label: `Compressed (${COMPRESSION_PRESETS[preset].label}) ${formatBytes(blob.size)} → ${formatBytes(r.blob.size)}`, kind: 'video', blob: r.blob }) }
  })
  const doFrame = () => run('Capture frame', async () => {
    const f = await probeVideo(await source(), frameAt)
    if (!f.frame) throw new Error('No frame captured.')
    onUpdateThumbnail({ imageUrl: await blobToDataUrl(f.frame) })
    addOutput({ label: `Frame @ ${frameAt.toFixed(1)}s (set as thumbnail)`, kind: 'image', blob: f.frame })
  })

  const ext = (b: Blob) => (b.type.split('/')[1] || 'bin').replace('jpeg', 'jpg')
  const download = (o: Output) => downloadBlob(o.blob, exportFilename(o.kind, title, ext(o.blob), { aspect }))
  const sizeEstimate = asset.type === 'video' && dur ? estimateVideoBytes(preset, Math.max(0, trim.end - trim.start || dur)) : null
  const nSource = lib.find((l) => l.url === asset.url)?.blob.size

  return (
    <div className="space-y-5" onPaste={onPaste}>
      <section aria-label="Media library">
        <h4 className={h4}>Media library</h4>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]) }}
          className={`rounded-xl border-2 border-dashed p-4 text-center text-xs transition-colors ${dragOver ? 'border-[#d9ff00] bg-[#d9ff00]/10 text-white' : 'border-white/15 text-white/50'}`}
        >
          Drop images/videos here, paste an image, or{' '}
          <label className="underline cursor-pointer text-white/80">browse<input type="file" multiple accept={'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'} className="sr-only" onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = '' }} /></label>
          <p className="mt-1 text-[10px] text-white/30">JPG · PNG · WebP · GIF · MP4 · MOV · WebM. Files stay on this device until you publish.</p>
        </div>
        {rejected.length > 0 && <ul role="alert" className="mt-2 text-[11px] text-red-300 space-y-0.5">{rejected.map((r) => <li key={r}>{r}</li>)}</ul>}
        <ul className="mt-2 space-y-1">
          {lib.map((l, i) => (
            <li key={l.id} draggable onDragStart={() => { dragIdx.current = i }} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const from = dragIdx.current; if (from === null || from === i) return; setLib((x) => { const c = [...x]; const [m] = c.splice(from, 1); c.splice(i, 0, m); return c }); dragIdx.current = null }}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] cursor-grab">
              <span aria-hidden className="text-white/30">⠿</span>
              {l.kind === 'image' ? <img src={l.url} alt="" className="w-8 h-8 object-cover rounded" /> : <span className="w-8 h-8 grid place-items-center rounded bg-white/10">▶</span>}
              <span className="flex-1 truncate">{l.name} <span className="text-white/40">({formatBytes(l.blob.size)})</span></span>
              <button type="button" className={btn} disabled={!onReplaceAsset} onClick={() => onReplaceAsset?.({ ...asset, type: l.kind, url: l.url })}>Use</button>
              <button type="button" aria-label={`Remove ${l.name}`} className="text-white/40 hover:text-red-300" onClick={() => { if (l.url !== asset.url) urls.revoke(l.url); setLib((x) => x.filter((y) => y.id !== l.id)) }}>×</button>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-white/40">MuAPI publishes one media file per post, so the library is for choosing and preparing it. Drag to reorder.</p>
      </section>

      <section aria-label="Reframe">
        <h4 className={h4}>Reframe (resize for a platform shape)</h4>
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="Aspect ratio" className={`${field} !w-auto`} value={aspect} onChange={(e) => setAspect(e.target.value as AspectKey)}>{Object.entries(ASPECTS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}</select>
          <select aria-label="Fit mode" className={`${field} !w-auto`} value={mode} onChange={(e) => setMode(e.target.value as FitMode)}><option value="fill">Fill (crop)</option><option value="fit">Fit (letterbox)</option></select>
        </div>
        {mode === 'fill' && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/60">
            <label>Horizontal<input type="range" min={0} max={1} step={0.01} value={focus.x} onChange={(e) => setFocus({ ...focus, x: +e.target.value })} className="w-full" /></label>
            <label>Vertical<input type="range" min={0} max={1} step={0.01} value={focus.y} onChange={(e) => setFocus({ ...focus, y: +e.target.value })} className="w-full" /></label>
          </div>
        )}
        <button type="button" className={`${btnPrimary} mt-2`} disabled={!!job || !asset.url} onClick={doReframe}>Reframe {asset.type}</button>
        {asset.type === 'video' && !caps.webCodecs && <p className="mt-1 text-[11px] text-amber-200">Video editing needs WebCodecs, which this browser lacks. Image tools still work, and you can publish the original video.</p>}
      </section>

      {asset.type === 'video' && (
        <section aria-label="Trim and frames">
          <h4 className={h4}>Trim &amp; thumbnail frame</h4>
          {dur ? (
            <>
              <video src={asset.url} controls muted playsInline preload="metadata" className="w-full max-h-48 rounded-lg bg-black" aria-label="Scrub preview"
                onTimeUpdate={(e) => setFrameAt((e.target as HTMLVideoElement).currentTime)} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/60">
                <label>Start (s)<input type="number" className={field} min={0} max={dur} step={0.1} value={trim.start} onChange={(e) => setTrim(clampTrim({ ...trim, start: +e.target.value }, dur))} /></label>
                <label>End (s)<input type="number" className={field} min={0} max={dur} step={0.1} value={trim.end} onChange={(e) => setTrim(clampTrim({ ...trim, end: +e.target.value }, dur))} /></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{TRIM_PRESETS.map((p) => <button key={p.id} type="button" className={btn} onClick={() => setTrim(presetTrim(p.seconds, dur, trim.start))}>{p.label}</button>)}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} disabled={!!job} onClick={doTrim}>Trim to {(trim.end - trim.start).toFixed(1)}s</button>
                <button type="button" className={btn} disabled={!!job} onClick={doFrame}>Use frame at {frameAt.toFixed(1)}s as thumbnail</button>
              </div>
              <p className="mt-1 text-[10px] text-white/40">Edits create a new file; your original is never changed.</p>
            </>
          ) : <p className="text-[11px] text-white/40">Loading video details…</p>}
        </section>
      )}

      {asset.type === 'video' && <AudioTools title={title} getSource={source} onOutput={addOutput} />}
      {asset.type === 'video' && <TextOverlayTools duration={dur} getSource={source} onOutput={addOutput} />}

      <section aria-label="Compression">
        <h4 className={h4}>Compress</h4>
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="Quality" className={`${field} !w-auto`} value={preset} onChange={(e) => setPreset(e.target.value as CompressionPreset)}>{Object.entries(COMPRESSION_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
          <button type="button" className={btn} disabled={!!job} onClick={doCompress}>Compress {asset.type}</button>
        </div>
        <p className="mt-1 text-[10px] text-white/40">{sizeEstimate ? `Estimated output ≈ ${formatBytes(sizeEstimate)} (a rough guide). ` : ''}{nSource ? `Current file: ${formatBytes(nSource)}. ` : ''}Output is MP4 (H.264) when the browser can encode it, otherwise WebM.</p>
      </section>

      {(job || err) && (
        <div role="status" className="rounded-lg border border-white/10 p-2 text-[11px]">
          {job && <>
            <div className="flex justify-between"><span>{job.label}…</span><button type="button" className="underline" onClick={() => abortRef.current?.abort()}>Cancel</button></div>
            <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-full rounded bg-[#d9ff00]" style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
          </>}
          {err && <p role="alert" className="text-red-300">{err}</p>}
        </div>
      )}

      {outputs.length > 0 && (
        <section aria-label="Prepared files">
          <h4 className={h4}>Prepared files</h4>
          <ul className="space-y-2">
            {outputs.map((o) => (
              <li key={o.id} className="rounded-lg border border-white/10 p-2 text-[11px]">
                {o.kind === 'image' ? <img src={o.url} alt={o.label} className="max-h-32 rounded mb-1" /> : <video src={o.url} controls muted playsInline className="max-h-32 rounded mb-1" />}
                <div className="flex flex-wrap items-center gap-2"><span className="flex-1">{o.label} · {formatBytes(o.blob.size)}</span>
                  <button type="button" className={btnPrimary} disabled={!onReplaceAsset || !validateFileType(o.blob.type).ok} onClick={() => onReplaceAsset?.({ ...asset, type: o.kind, url: o.url })}>Use as post media</button>
                  <button type="button" className={btn} onClick={() => download(o)}>Download</button></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Subtitles">
        <h4 className={h4}>Subtitles</h4>
        <label className={`${btn} inline-block cursor-pointer`}>Import .srt / .vtt<input type="file" accept=".srt,.vtt,text/vtt" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const c = parseSubtitles(await f.text()); setCues(c); if (!c.length) setErr('No valid cues found in that file.') } e.target.value = '' }} /></label>
        <button type="button" className={`${btn} ml-2`} onClick={() => setCues((c) => [...c, { start: (c[c.length - 1]?.end ?? 0), end: (c[c.length - 1]?.end ?? 0) + 2, text: 'New caption' }])}>Add cue</button>
        {cues.length > 0 && (
          <>
            <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {cues.map((c, i) => (
                <li key={i} className="grid grid-cols-[64px_64px_1fr_auto] gap-1 items-center">
                  <input aria-label={`Cue ${i + 1} start`} type="number" step={0.1} className={field} value={c.start} onChange={(e) => setCues((x) => x.map((y, j) => (j === i ? { ...y, start: +e.target.value } : y)))} />
                  <input aria-label={`Cue ${i + 1} end`} type="number" step={0.1} className={field} value={c.end} onChange={(e) => setCues((x) => x.map((y, j) => (j === i ? { ...y, end: +e.target.value } : y)))} />
                  <input aria-label={`Cue ${i + 1} text`} className={field} value={c.text} onChange={(e) => setCues((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))} />
                  <button type="button" aria-label={`Delete cue ${i + 1}`} className="text-white/40 hover:text-red-300" onClick={() => setCues((x) => x.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
            {validateCues(cues).slice(0, 3).map((m) => <p key={m} className="text-[10px] text-amber-200">{m}</p>)}
            <div className="mt-2 flex flex-wrap gap-2 items-center text-[11px] text-white/60">
              <label>Shift all (s) <input type="number" step={0.1} className={`${field} !w-20 inline-block`} value={shift} onChange={(e) => setShift(+e.target.value)} /></label>
              <button type="button" className={btn} onClick={() => { setCues((c) => shiftCues(c, shift)); setShift(0) }}>Apply</button>
              <select aria-label="Subtitle position" className={`${field} !w-auto`} value={subPos} onChange={(e) => setSubPos(e.target.value as any)}><option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option></select>
              <button type="button" className={btn} onClick={() => downloadBlob(new Blob([toSrt(cues)], { type: 'application/x-subrip' }), exportFilename('subtitles', title, 'srt'))}>Export SRT</button>
              <button type="button" className={btn} onClick={() => downloadBlob(new Blob([toVtt(cues, subPos)], { type: 'text/vtt' }), exportFilename('subtitles', title, 'vtt'))}>Export VTT</button>
            </div>
            <p className="mt-1 text-[10px] text-white/40">Subtitle files are for download or upload to platforms that accept them. Burned-in captions and on-device speech-to-text are not part of this panel yet.</p>
          </>
        )}
      </section>
    </div>
  )
}
