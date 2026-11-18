'use client'

import { useEffect, useRef, useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { loadImageBlob } from '../backgroundRemoval/loadImageBlob'
import { LogoTraceError, traceLogo } from '../preview/logoVectorize'
import { upscaleImage } from '../localAI/engine'
import { useLocalAI } from '../localAI/useLocalAI'
import { blobToFile, fileToFileList, sharpenedFileName, shouldOfferSharpen } from '../preview/imageUpscale'
import { LocalAINotice } from './LocalAINotice'
import { summarizeAssetUsage, type AssetUsage } from '../preview/assetUsage'
import { buildPreviewInput } from './buildPreviewInput'
import { C, badgeStyle, hintStyle, panelStyle, secondaryButtonStyle } from './tokens'

const STATE_LABEL: Record<AssetUsage['state'], string> = { imported: 'Imported — not used', assigned: 'Assigned — hidden', rendered: 'In the video' }

/**
 * "Which pictures are actually in the video?" Importing only adds a picture to the library; a picture appears
 * in the preview and export only when a visible layer draws it. This panel says so plainly, lists each
 * picture's state, and lets the customer put one on the Product / Service image layer or take it off.
 * Pictures that are not used stay in the library and can be used any time.
 */
export function AssetUsagePanel(): React.JSX.Element | null {
  const ctx = useDemoPersonalize()
  const { assets, previewSettings, updatePreviewLayer } = ctx
  const [tracing, setTracing] = useState<string | null>(null)
  const [traceNote, setTraceNote] = useState<{ id: string; text: string } | null>(null)
  const sharpenAi = useLocalAI('upscale')
  // Which client/session this panel belongs to. A trace that finishes after the person moved to another client (or
  // closed the modal) must not add its logo to the new client's library.
  // A counter, not a comparison of keys: it moves on EVERY client/session change and on unmount, so a trace started for
  // client A cannot be mistaken for current after A -> B -> A.
  const sessionKey = `${ctx.clientForm?.id ?? ''}|${ctx.source?.id ?? ''}`
  const epochRef = useRef(0)
  useEffect(() => {
    // Entering a client (first render or a switch): nothing from a previous one is still "tracing".
    setTracing(null); setTraceNote(null)
    return () => { epochRef.current += 1 }
  }, [sessionKey])
  const library = [...(assets.logos ?? []), ...(assets.products ?? [])]
  if (library.length === 0) return null
  const { brand } = buildPreviewInput(ctx)
  const summary = summarizeAssetUsage(library, previewSettings, brand)
  const layerOf = (kind: 'productImage' | 'serviceImage') => previewSettings.layers.find((l) => l.kind === kind)

  const assign = (a: AssetUsage, kind: 'productImage' | 'serviceImage') => {
    const layer = layerOf(kind)
    if (layer) updatePreviewLayer(layer.id, { imageUrl: a.url, visible: true, imageStyle: undefined })
  }
  const remove = (a: AssetUsage) => {
    for (const kind of ['productImage', 'serviceImage'] as const) {
      const layer = layerOf(kind)
      if (layer && (layer.imageUrl === a.url)) updatePreviewLayer(layer.id, { imageUrl: undefined, visible: false })
      else if (layer && a.usedBy.length && !layer.imageUrl) updatePreviewLayer(layer.id, { visible: false })
    }
  }

  const logoIds = new Set((assets.logos ?? []).map((l) => l.id))
  // Free, in-browser: redraws a raster logo as a crisp SVG and adds it as an extra logo (the original stays).
  const trace = async (a: AssetUsage) => {
    const startedIn = epochRef.current
    setTracing(a.assetId); setTraceNote(null)
    try {
      const blob = await loadImageBlob(a.url)
      const out = await traceLogo(blob)
      if (epochRef.current !== startedIn) return // the client/session changed while tracing: drop the result
      ctx.addLogoUrl(out.dataUrl)
      setTraceNote({ id: a.assetId, text: 'Added a traced SVG copy to your logos. Make it the main logo if it looks right.' })
    } catch (e) {
      if (epochRef.current === startedIn) setTraceNote({ id: a.assetId, text: e instanceof LogoTraceError ? e.message : 'The logo could not be traced.' })
    } finally {
      // Only the trace that still belongs to the current client/session may clear the busy state; an older one finishing
      // must not re-enable the buttons while a newer trace is still running.
      if (epochRef.current === startedIn) setTracing(null)
    }
  }

  // Free, on-device 2x upscale. The sharper copy is ADDED next to the original; a result for a client the person has
  // since left is dropped, like the logo trace.
  const sharpen = async (a: AssetUsage) => {
    const startedIn = epochRef.current
    setTraceNote(null)
    const asset = [...(assets.logos ?? []), ...(assets.products ?? [])].find((x) => x.id === a.assetId)
    const blob = await sharpenAi.request((helpers) => upscaleImage(a.url, helpers))
    if (!blob || epochRef.current !== startedIn) return
    const file = blobToFile(blob, sharpenedFileName(asset?.name || a.name))
    const list = fileToFileList(file)
    const isLogo = logoIds.has(a.assetId)
    if (list) { if (isLogo) ctx.addLogoFiles(list); else ctx.addProductFiles(list) }
    else if (isLogo) ctx.addLogoUrl(URL.createObjectURL(blob))
    else ctx.addProductUrl(URL.createObjectURL(blob))
    setTraceNote({ id: a.assetId, text: 'Added a sharper 2× copy to your pictures. The original is still there.' })
  }
  const canSharpen = (a: AssetUsage) => {
    const asset = [...(assets.logos ?? []), ...(assets.products ?? [])].find((x) => x.id === a.assetId)
    return shouldOfferSharpen(asset?.width, asset?.height, `${asset?.mimeType ?? ''} ${a.url.slice(0, 40)}`)
  }

  return (
    <div data-testid="asset-usage-panel" style={panelStyle}>
      <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
        Your pictures in the video
      </h3>
      <p data-testid="asset-usage-summary" style={{ ...hintStyle, margin: '0 0 10px' }}>
        {summary.total} imported · <strong style={{ color: C.text }}>{summary.rendered} in the video</strong> · {summary.unused} not used.
        Importing a picture does not put it in the video — choose which ones appear.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {summary.items.map((a) => (
          <li key={a.assetId} data-testid={`asset-usage-${a.assetId}`} data-state={a.state} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text }}>
            <img src={a.url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}` }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span style={badgeStyle(a.state === 'rendered' ? 'green' : undefined)}>
              {STATE_LABEL[a.state]}{a.state !== 'imported' && a.auto ? ' · automatic' : ''}{a.usedBy.length ? ` · ${a.usedBy.join(', ')}` : ''}
            </span>
            <button type="button" aria-label={`Use ${a.name} as the product image`} onClick={() => assign(a, 'productImage')} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Product</button>
            <button type="button" aria-label={`Use ${a.name} as the service image`} onClick={() => assign(a, 'serviceImage')} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Service</button>
            {logoIds.has(a.assetId) && !a.url.startsWith('data:image/svg') && (
              <button type="button" data-testid={`logo-trace-${a.assetId}`} disabled={tracing !== null} aria-label={`Trace ${a.name} to SVG`} onClick={() => void trace(a)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>
                {tracing === a.assetId ? 'Tracing…' : 'Trace to SVG'}
              </button>
            )}
            {canSharpen(a) && (
              <button type="button" data-testid={`sharpen-${a.assetId}`} disabled={sharpenAi.phase !== 'idle'} aria-label={`Sharpen ${a.name} 2×`} title="Free, on this device. Adds a sharper copy." onClick={() => void sharpen(a)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>
                Sharpen 2×
              </button>
            )}
            {logoIds.has(a.assetId) && assets.primaryLogo?.id !== a.assetId && (
              <button type="button" aria-label={`Use ${a.name} as the main logo`} onClick={() => ctx.setPrimaryLogo(a.assetId)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Main logo</button>
            )}
            {a.state !== 'imported' && (
              <button type="button" aria-label={`Remove ${a.name} from the video`} onClick={() => remove(a)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      <LocalAINotice ai={sharpenAi} doing="makes small pictures 2× sharper" />
      {traceNote && <p role="status" data-testid="logo-trace-note" style={{ ...hintStyle, margin: '8px 0 0', color: C.cyan }}>{traceNote.text}</p>}
    </div>
  )
}
