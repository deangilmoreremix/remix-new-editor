// Stage 3: the REAL provider + OverlayEditor (with the Presenter panel and stage box) + the REAL preview Player, plus the app's own exporter.
import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { PlayerRef } from '@remotion/player'
import { DemoPersonalizeProvider, useDemoPersonalize } from '@ohb/shared/personalization/DemoPersonalizeProvider'
import { OverlayEditor } from '@ohb/shared/personalization/guided/OverlayEditor'
import { buildPreviewInput } from '@ohb/shared/personalization/guided/buildPreviewInput'
import { PersonalizationPlayer } from '@ohb/shared/personalization/preview/PersonalizationPlayer'
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'

let setFixtureVideo: (u: string | null) => void = () => {}
function Harness() {
  const ctx = useDemoPersonalize()
  ;(window as any).__ctx = ctx
  const playerRef = useRef<PlayerRef | null>(null)
  ;(window as any).__player = playerRef
  const [video, setVideo] = useState<string | null>(null)
  setFixtureVideo = setVideo
  useEffect(() => {
    ctx.openPersonalize({
      source: { sourceType: 'landing-demo', id: 'demo-1', title: 'Harness', mediaType: 'video', sourceMedia: 'https://example.com/none.mp4', poster: null, shortPrompt: 't', fullPrompt: 't', originalPrompt: 't', sourceMetadata: {} } as any,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const base = buildPreviewInput({ source: ctx.source, previewSettings: ctx.previewSettings, previewVideo: ctx.previewVideo, clientForm: ctx.clientForm, assets: ctx.assets })
  const inputProps = { ...base, videoUrl: video, posterUrl: null, isImageSource: false }
  ;(window as any).__inputProps = inputProps
  return (
    <div style={{ color: '#fff' }}>
      {ctx.previewSettings ? <OverlayEditor inputProps={inputProps} /> : null}
      <div data-testid="preview-wrap" style={{ width: ctx.previewSettings.width, height: ctx.previewSettings.height, marginTop: 16, background: '#000' }}>
        {ctx.previewSettings ? <PersonalizationPlayer inputProps={inputProps} width={ctx.previewSettings.width} height={ctx.previewSettings.height} hideTransport playerRefOverride={playerRef} /> : null}
      </div>
    </div>
  )
}
;(window as any).__setVideo = (u: string | null) => setFixtureVideo(u)
;(window as any).__export = async () => {
  const props = (window as any).__inputProps
  const t0 = performance.now()
  const result: any = await exportPersonalizedVideo({ inputProps: props })
  const ms = Math.round(performance.now() - t0)
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, ms }
  const buf = new Uint8Array(await result.blob.arrayBuffer())
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { ok: true, ext: result.extension, mime: result.mimeType, warning: result.warning, bytes: buf.length, ms, b64: btoa(s) }
}
createRoot(document.getElementById('root')!).render(<DemoPersonalizeProvider testMode><Harness /></DemoPersonalizeProvider>)
;(window as any).ready = true
