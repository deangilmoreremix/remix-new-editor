'use client'

/**
 * Advanced Editing → "Full Body Recast" tab.
 *
 * Put the client's person into a performance video (open-genjutsu style): a
 * 4–30 s source clip + one character photo → MuAPI seedance-2.5-motion-control.
 * Shown as Source performance | Character image | Recast result. The finished
 * recast becomes the video the preview, overlays and Step 4 use, and is saved
 * with the client's assets. The job itself lives in the provider, so it keeps
 * running when the user switches tab or closes the modal.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useDemoPersonalize, getGenerationAssetUrl } from '../DemoPersonalizeProvider'
import { uploadPersonalizationAsset } from '../assetUploadService'
import { resolveModelCapabilities } from '../modelCapabilityResolver'
import type { PersonalizationAsset, PersonalizationSource } from '../types'
import { C } from '../guided/tokens'
import {
  RECAST_MAX_SECONDS,
  RECAST_MIN_SECONDS,
  formatElapsed,
  readVideoDuration,
  validateRecastClipFile,
  validateRecastDuration,
} from '../recast/recastJob'

type ClipState = {
  kind: 'current' | 'upload'
  url: string
  label: string
  previewUrl: string
  duration: number
  status: 'idle' | 'reading' | 'uploading' | 'ready' | 'error'
  error: string
}

const EMPTY_CLIP: ClipState = { kind: 'current', url: '', label: '', previewUrl: '', duration: 0, status: 'idle', error: '' }

const STEPS = ['Source clip', 'Person', 'Recast', 'Use it'] as const

function panelCaption(text: string): CSSProperties {
  return {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, padding: '8px 10px', margin: 0,
    background: 'linear-gradient(rgba(0,0,0,.85), rgba(0,0,0,.55))', color: '#fff',
    fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
  }
}

function RecastPanel({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure style={{ position: 'relative', margin: 0, minHeight: 260, aspectRatio: '3 / 4', background: '#0b0d10', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <figcaption style={panelCaption(caption)}>{caption}</figcaption>
      {children}
    </figure>
  )
}

const mediaStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

/** Bundled example (open-genjutsu sample media, MIT) in public/media/recast-example. */
export const RECAST_EXAMPLE = {
  source: '/media/recast-example/source-performance.mp4',
  sourcePoster: '/media/recast-example/source-poster.jpg',
  character: '/media/recast-example/character.jpg',
  result: '/media/recast-example/recast-result.mp4',
  resultPoster: '/media/recast-example/result-poster.jpg',
} as const

/**
 * "See an example result": what a recast does, before the user spends
 * anything. The source and result clips play in sync.
 */
function RecastExample({ defaultOpen }: { defaultOpen: boolean }) {
  const sourceRef = useRef<HTMLVideoElement | null>(null)
  const resultRef = useRef<HTMLVideoElement | null>(null)
  const sync = () => {
    const source = sourceRef.current
    const result = resultRef.current
    if (!source || !result) return
    source.currentTime = result.currentTime
  }
  const exampleCaption: CSSProperties = { ...panelCaption(''), fontSize: 9, padding: '6px 8px' }
  const tile: CSSProperties = { position: 'relative', margin: 0, aspectRatio: '9 / 16', maxHeight: 300, background: '#0b0d10', overflow: 'hidden' }
  return (
    <details open={defaultOpen} data-testid="pz-recast-example" style={{ margin: '12px 0 4px', border: `1px solid ${C.border}`, borderRadius: 14, background: C.panel, padding: '10px 12px' }}>
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: C.text }}>
        See an example result
      </summary>
      <div className="grid grid-cols-3" style={{ gap: 4, marginTop: 10, borderRadius: 12, overflow: 'hidden', background: '#000', maxWidth: 520 }}>
        <figure style={tile}>
          <figcaption style={exampleCaption}>Source performance</figcaption>
          <video ref={sourceRef} src={RECAST_EXAMPLE.source} poster={RECAST_EXAMPLE.sourcePoster} muted loop playsInline autoPlay preload="metadata" style={mediaStyle} />
        </figure>
        <figure style={tile}>
          <figcaption style={exampleCaption}>Character image</figcaption>
          <img src={RECAST_EXAMPLE.character} alt="Example character" style={mediaStyle} loading="lazy" />
        </figure>
        <figure style={tile}>
          <figcaption style={exampleCaption}>Recast result</figcaption>
          <video
            ref={resultRef}
            src={RECAST_EXAMPLE.result}
            poster={RECAST_EXAMPLE.resultPoster}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            onPlay={sync}
            onSeeked={sync}
            style={mediaStyle}
            data-testid="pz-recast-example-result"
          />
        </figure>
      </div>
      <p style={{ margin: '8px 0 0', color: C.muted2, fontSize: 10, lineHeight: 1.5, maxWidth: 520 }}>
        Example with a fictional performer and character: the studio, movement and camera stay the same and the
        person is swapped. Your result uses your clip and your client’s photo. Sample media:{' '}
        <a href="https://github.com/deangilmoreremix/open-genjutsu" target="_blank" rel="noreferrer" style={{ color: C.muted }}>open-genjutsu</a> (MIT).
      </p>
    </details>
  )
}

export function FullBodyRecastSection({ source }: { source: PersonalizationSource | null }) {
  const ctx = useDemoPersonalize()
  const {
    apiKey, access, assets, previewVideo, preRecastVideo, genOptions, updateGenOptions,
    recastJob, startRecast, cancelRecast, retryRecast, dismissRecast,
    restoreOriginalVideo, applyPresenterVideo, removePresenterVideo, addIdentityFiles,
  } = ctx
  const isAnonymous = access !== 'authenticated'

  // The video in use right now: the chosen preview video, else the source clip.
  const currentVideoUrl = (previewVideo?.kind !== 'recast' ? previewVideo?.url : preRecastVideo?.url) || source?.sourceMedia || ''
  const [clip, setClip] = useState<ClipState>(EMPTY_CLIP)
  const [identityId, setIdentityId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [now, setNow] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null)

  // Default the source clip to the current video, reading its length.
  useEffect(() => {
    if (clip.kind !== 'current') return
    if (!currentVideoUrl) {
      setClip(EMPTY_CLIP)
      return
    }
    let cancelled = false
    setClip({ kind: 'current', url: currentVideoUrl, label: 'Current video', previewUrl: currentVideoUrl, duration: 0, status: 'reading', error: '' })
    readVideoDuration(currentVideoUrl)
      .then((duration) => {
        if (cancelled) return
        const error = validateRecastDuration(duration)
        setClip((prev) => ({ ...prev, duration, status: error ? 'error' : 'ready', error: error ? `${error} Upload a clip instead.` : '' }))
      })
      .catch(() => {
        if (cancelled) return
        setClip((prev) => ({ ...prev, status: 'error', error: 'Could not read the current video. Upload a clip instead.' }))
      })
    return () => { cancelled = true }
  }, [currentVideoUrl, clip.kind])

  const identities = assets.identities || []
  // The provider ignores photos past the model's limit, so say so up front.
  const photoLimitReached = Boolean(source) && identities.length >= resolveModelCapabilities(source!, genOptions).maxImages
  const selectedIdentity: PersonalizationAsset | null =
    identities.find((asset) => asset.id === identityId) || assets.primaryIdentity || identities[0] || null
  const identityUrl = getGenerationAssetUrl(selectedIdentity)

  const running = recastJob?.status === 'running'
  const done = recastJob?.status === 'done'
  const usingRecast = previewVideo?.kind === 'recast'

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  // The clip picked last, so an older pick's upload is skipped.
  const latestPreviewRef = useRef('')
  const handleClipFile = async (file: File | null) => {
    const fileError = validateRecastClipFile(file)
    if (fileError || !file) {
      setClip((prev) => ({ ...prev, error: fileError }))
      return
    }
    const previewUrl = URL.createObjectURL(file)
    latestPreviewRef.current = previewUrl
    setClip({ kind: 'upload', url: '', label: file.name, previewUrl, duration: 0, status: 'reading', error: '' })
    try {
      const duration = await readVideoDuration(previewUrl)
      const durationError = validateRecastDuration(duration)
      if (durationError) throw new Error(durationError)
      if (latestPreviewRef.current !== previewUrl) return
      setClip((prev) => (prev.previewUrl === previewUrl ? { ...prev, duration, status: 'uploading' } : prev))
      const uploaded = await uploadPersonalizationAsset(apiKey, { file })
      setClip((prev) => (prev.previewUrl === previewUrl ? { ...prev, url: uploaded.url, status: 'ready' } : prev))
    } catch (error) {
      setClip((prev) => (prev.previewUrl === previewUrl
        ? { ...prev, status: 'error', error: error instanceof Error ? error.message : 'The clip could not be uploaded.' }
        : prev))
    }
  }

  const useCurrentVideo = () => setClip({ ...EMPTY_CLIP, kind: 'current' })

  // The recast service fetches the clip itself: a site-relative demo path
  // becomes a full address; a browser-only blob: URL can't be fetched.
  const remoteClipUrl = /^https?:\/\//.test(clip.url)
    ? clip.url
    : clip.url.startsWith('/') && typeof window !== 'undefined' ? new URL(clip.url, window.location.origin).href : ''
  const canRecast = !isAnonymous && Boolean(apiKey) && !running && !clip.error && clip.status === 'ready' && Boolean(remoteClipUrl) && Boolean(identityUrl) && Boolean(genOptions.consentGiven)
  const blocker = isAnonymous
    ? 'Sign in to recast videos.'
    : !apiKey
      ? 'Connect your SmartVideo (MuAPI) API key in Settings.'
    : !clip.url || clip.status !== 'ready'
      ? 'Choose a 4–30 s source clip.'
      : !remoteClipUrl
        ? 'This video is only in your browser. Upload it as a clip instead.'
      : !selectedIdentity
        ? 'Add a photo of the person.'
        : !identityUrl
          ? 'The person’s photo is still uploading…'
          : !genOptions.consentGiven
            ? 'Confirm you have permission to use this person’s likeness.'
            : ''

  const runRecast = () => {
    if (!canRecast || !selectedIdentity || !identityUrl || !source) return
    void startRecast({
      sourceId: source.id,
      sourceUrl: remoteClipUrl,
      sourceLabel: clip.label,
      identityId: selectedIdentity.id,
      identityName: selectedIdentity.name?.replace(/\.[a-z0-9]+$/i, '') || 'Presenter',
      identityUrl,
      duration: clip.duration,
      prompt,
    })
  }

  // While a job exists, its own inputs are what the panels show.
  const shownSourceUrl = recastJob && recastJob.status !== 'cancelled' ? recastJob.sourceUrl : clip.previewUrl
  const shownSourceLength = recastJob && recastJob.status !== 'cancelled' ? recastJob.duration : clip.duration
  const shownIdentityUrl = recastJob && recastJob.status !== 'cancelled' ? recastJob.identityUrl : (selectedIdentity?.url || '')

  const stepIndex = done || usingRecast ? 3 : running ? 2 : clip.status === 'ready' && selectedIdentity ? 2 : clip.status === 'ready' ? 1 : 0

  const presenterVideos = useMemo(() => [...(assets.presenterVideos || [])].reverse(), [assets.presenterVideos])

  return (
    <section id="pz-recast" style={{ padding: '20px 0', scrollMarginTop: 64 }}>
      <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '.05em', fontWeight: 800, textTransform: 'uppercase' }}>Full Body Recast</h2>
      <p className="mt-1.5 max-w-[900px] text-[12px] leading-[1.55]" style={{ color: C.muted }}>
        Put this client’s person into a performance video. The clip’s movement, camera and location are kept;
        the performer is replaced. The result becomes the video for the preview, overlays and Step 4.
      </p>

      <RecastExample defaultOpen={!recastJob && presenterVideos.length === 0} />

      <ol aria-label="Recast steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6, listStyle: 'none', margin: '14px 0', padding: 0 }}>
        {STEPS.map((label, index) => {
          const active = index === stepIndex
          const complete = index < stepIndex
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                background: active ? C.cyanSoft : C.panel, color: active ? C.cyan : complete ? C.text : C.muted,
                border: `1px solid ${active ? C.cyanBorder : C.border}`,
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: complete ? C.green : active ? C.cyan : 'rgba(255,255,255,.06)', color: complete || active ? '#000000' : C.muted, fontSize: 9 }}>
                {complete ? '✓' : index + 1}
              </span>
              <span className="truncate">{label}</span>
            </li>
          )
        })}
      </ol>

      {usingRecast && (
        <div data-testid="pz-recast-applied" role="status" className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, fontSize: 11 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>✓ Using the recast video for the preview, overlays and Step 4.</span>
          {/* The original is the earlier preview video, else the demo's own clip. */}
          {(preRecastVideo || source?.mediaType === 'video') && (
            <button type="button" onClick={restoreOriginalVideo} style={{ minHeight: 28, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 10, fontWeight: 800 }}>
              Use original video
            </button>
          )}
          {done && (
            <button type="button" onClick={() => { dismissRecast(); setClip({ ...EMPTY_CLIP, kind: 'current' }) }} style={{ minHeight: 28, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.cyanBorder}`, background: 'transparent', color: C.cyan, fontSize: 10, fontWeight: 800 }}>
              Recast again
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3" style={{ gap: 4, borderRadius: 14, overflow: 'hidden', background: '#000' }}>
        <RecastPanel caption="Source performance">
          {shownSourceUrl ? (
            <>
              <video ref={sourceVideoRef} src={shownSourceUrl} muted loop playsInline preload="metadata" controls style={mediaStyle} data-testid="pz-recast-source" />
              {shownSourceLength > 0 && (
                <span style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 2, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                  {Math.round(shownSourceLength)}s
                </span>
              )}
            </>
          ) : (
            <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, padding: 16, textAlign: 'center' }}>Upload a clip of one person, head to toe in view</span>
          )}
          {(clip.status === 'reading' || clip.status === 'uploading') && !recastJob && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {clip.status === 'reading' ? 'Reading clip…' : 'Uploading clip…'}
            </div>
          )}
        </RecastPanel>

        <RecastPanel caption="Character image">
          {shownIdentityUrl ? (
            <img src={shownIdentityUrl} alt={selectedIdentity?.name || 'Character'} style={mediaStyle} data-testid="pz-recast-character" />
          ) : (
            <button type="button" onClick={() => photoInputRef.current?.click()} style={{ color: C.cyan, background: 'transparent', border: `1px dashed ${C.cyanBorder}`, borderRadius: 10, padding: '14px 16px', fontSize: 11, fontWeight: 800 }}>
              + Add a photo of the person
            </button>
          )}
        </RecastPanel>

        <RecastPanel caption="Recast result">
          {done && recastJob?.resultUrl ? (
            <video
              src={recastJob.resultUrl}
              muted
              loop
              playsInline
              autoPlay
              controls
              style={mediaStyle}
              data-testid="pz-recast-result"
              onPlay={(event) => {
                const sourceVideo = sourceVideoRef.current
                if (!sourceVideo) return
                sourceVideo.currentTime = event.currentTarget.currentTime % (sourceVideo.duration || Infinity)
                void sourceVideo.play().catch(() => {})
              }}
              onPause={() => sourceVideoRef.current?.pause()}
            />
          ) : running ? (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#fff', fontSize: 11, textAlign: 'center', padding: 16 }}>
              <span className="animate-spin" style={{ width: 22, height: 22, borderRadius: 999, border: '2px solid rgba(255,255,255,.2)', borderTopColor: C.cyan }} />
              <span>Recasting… usually 2–5 minutes</span>
              <b data-testid="pz-recast-elapsed" style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(now - (recastJob?.startedAt || now))}</b>
              <span style={{ color: 'rgba(255,255,255,.55)' }}>You can switch tabs or close this — it keeps going.</span>
            </div>
          ) : (
            <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 11, textAlign: 'center', padding: 12 }}>✦ Your recast appears here<br />(see the example above)</span>
          )}
        </RecastPanel>
      </div>

      {/* Source clip + person choices */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Source clip</span>
          <button
            type="button"
            disabled={running || !currentVideoUrl}
            onClick={useCurrentVideo}
            aria-pressed={clip.kind === 'current'}
            style={{ minHeight: 30, padding: '0 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, border: `1px solid ${clip.kind === 'current' ? C.cyanBorder : C.border}`, background: clip.kind === 'current' ? C.cyanSoft : 'transparent', color: clip.kind === 'current' ? C.cyan : C.text }}
          >
            Current video
          </button>
          <button
            type="button"
            disabled={running || isAnonymous}
            onClick={() => fileInputRef.current?.click()}
            aria-pressed={clip.kind === 'upload'}
            style={{ minHeight: 30, padding: '0 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, border: `1px solid ${clip.kind === 'upload' ? C.cyanBorder : C.border}`, background: clip.kind === 'upload' ? C.cyanSoft : 'transparent', color: clip.kind === 'upload' ? C.cyan : C.text }}
          >
            {clip.kind === 'upload' ? `↑ ${clip.label}` : '↑ Upload a clip'}
          </button>
          <span style={{ color: C.muted2, fontSize: 10 }}>MP4/MOV · {RECAST_MIN_SECONDS}–{RECAST_MAX_SECONDS} s · 50 MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            className="hidden"
            data-testid="pz-recast-file"
            onChange={(event) => { void handleClipFile(event.target.files?.[0] || null); event.target.value = '' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Person</span>
          {identities.map((asset) => {
            const active = asset.id === selectedIdentity?.id
            return (
              <button
                key={asset.id}
                type="button"
                disabled={running}
                onClick={() => setIdentityId(asset.id)}
                aria-pressed={active}
                title={asset.name}
                data-testid="pz-recast-person"
                style={{ width: 36, height: 36, padding: 0, borderRadius: 8, overflow: 'hidden', border: `2px solid ${active ? C.cyan : 'transparent'}`, background: 'none' }}
              >
                <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            )
          })}
          <button
            type="button"
            data-testid="pz-recast-add-photo"
            disabled={running || isAnonymous || photoLimitReached}
            title={photoLimitReached ? 'Photo limit reached — remove a photo in Assets first' : undefined}
            onClick={() => photoInputRef.current?.click()}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: `1px dashed ${C.border}`, background: 'transparent', color: C.muted, fontSize: 10, fontWeight: 800, opacity: running || isAnonymous || photoLimitReached ? 0.5 : 1 }}
          >
            {photoLimitReached ? 'Photo limit reached' : '+ Photo'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => { addIdentityFiles(event.target.files); event.target.value = '' }}
          />
        </div>
      </div>

      {/* Direction + consent + run */}
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 12 }}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
          disabled={running}
          placeholder="Optional direction, e.g. keep the hand gesture natural"
          className="outline-none"
          style={{ flex: '1 1 280px', minHeight: 40, padding: '0 11px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.field, color: C.text, fontSize: 12 }}
        />
        {running ? (
          <button type="button" onClick={cancelRecast} style={{ minHeight: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 800 }}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={runRecast}
            disabled={!canRecast}
            data-testid="pz-recast-run"
            className="disabled:opacity-40"
            style={{ minHeight: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: C.cyan, color: '#000000', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.04em' }}
          >
            ✦ {done ? 'Recast again' : 'Recast full body'}
          </button>
        )}
      </div>
      <label className="flex items-center" style={{ gap: 8, marginTop: 10, color: C.muted, fontSize: 11 }}>
        <input
          type="checkbox"
          checked={Boolean(genOptions.consentGiven)}
          onChange={(event) => updateGenOptions({ ...genOptions, consentGiven: event.target.checked })}
        />
        I have permission to use this person’s likeness.
      </label>

      {(clip.error || blocker || recastJob?.status === 'error') && (
        <div role={clip.error || recastJob?.status === 'error' ? 'alert' : undefined} style={{ marginTop: 8, fontSize: 11, color: clip.error || recastJob?.status === 'error' ? C.danger : C.muted2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{recastJob?.status === 'error' ? recastJob.error : clip.error || blocker}</span>
          {recastJob?.status === 'error' && recastJob.requestId && Boolean(apiKey) && (
            <button type="button" onClick={() => retryRecast()} style={{ minHeight: 26, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.cyanBorder}`, background: 'transparent', color: C.cyan, fontSize: 10, fontWeight: 800 }}>
              ↻ Retry
            </button>
          )}
        </div>
      )}

      <details style={{ marginTop: 12, color: C.muted, fontSize: 11 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 800, color: C.text }}>Tips for a great result</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Use a clip with one person, head to toe in frame, and a steady camera.</li>
          <li>Use a well-lit, front-facing photo of the new person; full-body photos work best.</li>
          <li>The clip’s movement, camera and location are kept. The result is silent.</li>
        </ul>
      </details>

      {presenterVideos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>Saved recast videos</div>
          <div className="flex flex-wrap" style={{ gap: 10 }}>
            {presenterVideos.map((asset) => {
              const inUse = usingRecast && previewVideo?.url === asset.url
              return (
                <div key={asset.id} style={{ width: 120 }} data-testid="pz-presenter-video">
                  <video src={asset.url} muted playsInline preload="metadata" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
                  <div className="flex" style={{ gap: 4, marginTop: 4 }}>
                    <button type="button" disabled={inUse} onClick={() => applyPresenterVideo(asset.id)} style={{ flex: 1, minHeight: 24, borderRadius: 6, border: `1px solid ${inUse ? C.cyanBorder : C.border}`, background: inUse ? C.cyanSoft : 'transparent', color: inUse ? C.cyan : C.text, fontSize: 9, fontWeight: 800 }}>
                      {inUse ? 'In use' : 'Use'}
                    </button>
                    <button type="button" aria-label={`Remove ${asset.name}`} onClick={() => removePresenterVideo(asset.id)} style={{ minHeight: 24, padding: '0 6px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 9 }}>
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
