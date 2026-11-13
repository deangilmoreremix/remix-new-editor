// Browser side of the Stage 1 real-browser editor check: the REAL DemoPersonalizeProvider and the REAL OverlayEditor
// (with its LayerToolsPanel, snapping, Konva handles and image-crop dialog) mounted in a page, driven by Playwright with real
// pointer events. Network is intercepted by the runner, so no Supabase/Clerk keys are needed.
import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoPersonalizeProvider, useDemoPersonalize } from '@ohb/shared/personalization/DemoPersonalizeProvider'
import { OverlayEditor } from '@ohb/shared/personalization/guided/OverlayEditor'
import { buildPreviewInput } from '@ohb/shared/personalization/guided/buildPreviewInput'
import { normalizePreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { stripSessionScopedUrls } from '@ohb/shared/personalization/supabaseProjectPersistence'

function logoDataUrl(): string {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 400, 300); grad.addColorStop(0, '#ff7a18'); grad.addColorStop(1, '#af002d')
  g.fillStyle = grad; g.fillRect(0, 0, 400, 300)
  g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.fillText('ACME', 90, 170)
  return c.toDataURL('image/png')
}

function Harness() {
  const ctx = useDemoPersonalize()
  ;(window as any).__ctx = ctx
  useEffect(() => {
    ctx.openPersonalize({
      source: {
        sourceType: 'landing-demo', id: 'demo-1', title: 'Harness', mediaType: 'image', sourceMedia: logoDataUrl(),
        poster: logoDataUrl(), shortPrompt: 't', fullPrompt: 't', originalPrompt: 't', sourceMetadata: {},
      } as any,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const inputProps = buildPreviewInput({
    source: ctx.source, previewSettings: ctx.previewSettings, previewVideo: ctx.previewVideo, clientForm: ctx.clientForm, assets: ctx.assets,
  })
  return <div style={{ color: '#fff' }}>{ctx.previewSettings ? <OverlayEditor inputProps={inputProps} /> : null}</div>
}

;(window as any).__helpers = { normalizePreviewSettings, stripSessionScopedUrls, logoDataUrl }
createRoot(document.getElementById('root')!).render(<DemoPersonalizeProvider testMode><Harness /></DemoPersonalizeProvider>)
;(window as any).ready = true
