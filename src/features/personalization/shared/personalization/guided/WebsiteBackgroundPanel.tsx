'use client'

/**
 * "Website background" tools for the overlay editor: capture a business website with the EXISTING capture service
 * (Clerk sign-in, plan entitlement, SSRF guard and quotas all stay on the server), pick the page or a section picture,
 * tune the scroll / zoom / cursor / click / hand-over motion, and assign the site's logo and pictures to video roles.
 *
 * Everything is written to the project's `websiteBackground` through `edit` (so it is one undo step, autosaved and
 * rendered by the same Remotion composition as the preview and the export).
 */
import { useRef, useState } from 'react'
import {
  defaultWebsiteBackground,
  scrollFractionForSection,
  websiteHost,
  type CapturedPage,
  type CursorPoint,
} from '../preview/websiteBackground'
import type { PersonalizationPreviewSettings } from '../preview/types'
import {
  ASSET_ROLE_LABEL,
  assignAssetToRole,
  attributionText,
  describeCaptureError,
  patchWebsiteBackground,
  type AssetRole,
} from './websiteAssets'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

/** The slice of the existing capture result this panel uses (see motion-director/lib/directorClient SiteCapture). */
export interface WebsiteCapture {
  url: string
  title: string
  pages?: CapturedPage[]
  page?: { url: string; width: number; height: number }
  crops?: string[]
  cropInfo?: Array<{ route: string; width: number; height: number; text: string }>
  logo?: string | null
  images?: string[]
  assets?: Array<{ url: string; category: string; alt: string }>
}

export type CaptureFn = (url: string, opts: { onProgress?: (sec: number) => void; cancelled?: () => boolean }) => Promise<WebsiteCapture>

export interface WebsiteBackgroundPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** Test seam; defaults to the app's capture client, loaded on demand. */
  captureFn?: CaptureFn
  /** The business's own website when the project already knows it (Lead Finder / client details), so it need not be retyped. */
  defaultUrl?: string
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

const CURSOR_PRESETS: Record<string, { label: string; path: CursorPoint[]; clicks: number[] }> = {
  'glide-click': { label: 'Glide to centre and click', path: [{ t: 0, x: 0.78, y: 0.82 }, { t: 0.55, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }], clicks: [0.7] },
  'cta-corner': { label: 'Go to the top-right button and click', path: [{ t: 0, x: 0.3, y: 0.6 }, { t: 0.6, x: 0.82, y: 0.12 }, { t: 1, x: 0.82, y: 0.12 }], clicks: [0.75] },
  sweep: { label: 'Sweep across the page', path: [{ t: 0, x: 0.15, y: 0.3 }, { t: 1, x: 0.85, y: 0.7 }], clicks: [] },
  hover: { label: 'Rest in the middle', path: [{ t: 0, x: 0.5, y: 0.5 }], clicks: [] },
}

async function defaultCapture(url: string, opts: { onProgress?: (sec: number) => void; cancelled?: () => boolean }): Promise<WebsiteCapture> {
  const { captureSite } = await import('../../../apps/motion-director/lib/captureClient')
  return (await captureSite(url, opts)) as unknown as WebsiteCapture
}

export function WebsiteBackgroundPanel({ settings, edit, captureFn, defaultUrl }: WebsiteBackgroundPanelProps) {
  const bg = settings.websiteBackground
  const fps = Math.max(1, settings.fps)
  const seconds = (frames: number) => Math.round((frames / fps) * 10) / 10
  const toFrames = (s: number) => Math.round(s * fps)
  const total = Math.max(1, settings.durationInFrames)

  const [url, setUrl] = useState(() => (defaultUrl ?? '').trim())
  const [state, setState] = useState<'idle' | 'capturing' | 'error'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const [capture, setCapture] = useState<WebsiteCapture | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const cancelRef = useRef(false)

  const patch = (p: Parameters<typeof patchWebsiteBackground>[1]) => edit((prev) => patchWebsiteBackground(prev, p))
  const compW = Math.max(1, settings.width)
  const compH = Math.max(1, settings.height)

  const start = async () => {
    const target = url.trim()
    if (!target) { setState('error'); setMessage(describeCaptureError({ code: 'BAD_REQUEST' })); return }
    cancelRef.current = false
    setState('capturing'); setElapsed(0); setMessage(''); setCapture(null)
    try {
      const run = captureFn ?? defaultCapture
      const result = await run(target, { onProgress: setElapsed, cancelled: () => cancelRef.current })
      if (cancelRef.current) { setState('idle'); return }
      setCapture(result); setPageIndex(0); setState('idle')
      const pages = result.pages?.length ? result.pages : result.page?.url ? [{ url: result.page.url, width: result.page.width, height: result.page.height }] : []
      setMessage(pages.length ? '' : 'The page was captured without a picture (only its text), so there is nothing to use as a background.')
    } catch (error) {
      setState('error'); setMessage(describeCaptureError(error))
    }
  }

  const pages: CapturedPage[] = capture ? (capture.pages?.length ? capture.pages : capture.page?.url ? [{ url: capture.page.url, width: capture.page.width, height: capture.page.height }] : []) : []

  const usePage = (pg: CapturedPage) => {
    if (!capture) return
    const next = defaultWebsiteBackground({ pageSource: pg, site: { url: capture.url, title: capture.title }, capturedAt: new Date().toISOString(), fps, durationInFrames: total })
    if (!next) { setMessage('That picture cannot be used (it is not a permanent web address).'); return }
    setMessage('')
    edit((prev) => ({ ...prev, websiteBackground: next }))
  }

  const useCrop = (index: number) => {
    if (!capture || !bg) return
    const src = capture.crops?.[index]
    const info = capture.cropInfo?.[index]
    if (!src || !info?.width || !info?.height) return
    edit((prev) => patchWebsiteBackground(prev, { page: { url: src, width: info.width, height: info.height }, sections: [], scroll: { from: 0, to: 0 } }))
  }

  const assign = (role: AssetRole, pictureUrl: string) => {
    const result = assignAssetToRole(settings, role, pictureUrl)
    if (!result.assigned) {
      setMessage(result.reason === 'no-layer' ? `This project has no ${ASSET_ROLE_LABEL[role].toLowerCase()} layer to put it on.` : 'That picture cannot be used (it is not a permanent web address).')
      return
    }
    setMessage(`Used as the ${ASSET_ROLE_LABEL[role].toLowerCase()}.`)
    edit((prev) => assignAssetToRole(prev, role, pictureUrl).settings)
  }

  const pictures: Array<{ url: string; label: string }> = capture
    ? [
        ...(capture.logo ? [{ url: capture.logo, label: 'Logo' }] : []),
        ...(capture.assets ?? []).map((a) => ({ url: a.url, label: a.category || 'Picture' })),
        ...((capture.images ?? []).map((u) => ({ url: u, label: 'Image' }))),
      ].filter((p, i, a) => p.url && a.findIndex((x) => x.url === p.url) === i)
    : []

  return (
    <div data-testid="website-background-panel" style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>Website background</div>
      <p style={hintStyle}>Capture a prospect&apos;s website and let it scroll behind your video. Only capture sites you own or have permission to use. Private or internal addresses are refused.</p>

      <div style={row}>
        <input aria-label="Website address" placeholder="https://their-business.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && state !== 'capturing') void start() }} style={{ ...inputStyle, flex: 1, minWidth: 150, minHeight: 30, padding: '0 8px' }} />
        {state === 'capturing' ? (
          <button type="button" aria-label="Cancel capture" style={small} onClick={() => { cancelRef.current = true; setState('idle'); setMessage('Capture stopped.') }}>Cancel</button>
        ) : (
          <button type="button" aria-label="Capture website" style={small} onClick={() => void start()}>Capture</button>
        )}
      </div>
      {state === 'capturing' ? <p role="status" style={hintStyle}>Capturing the website… {elapsed}s. This can take a minute or two.</p> : null}
      {message ? <p role={state === 'error' ? 'alert' : 'status'} style={{ ...hintStyle, color: state === 'error' ? '#fca5a5' : C.muted }}>{message}</p> : null}

      {capture && pages.length > 0 ? (
        <div>
          <div style={labelStyle}>Pages found</div>
          <div style={row}>
            {pages.map((pg, i) => (
              <button key={`${pg.url}-${i}`} type="button" aria-label={`Use page ${pg.name || pg.path || i + 1}`} style={{ ...small, ...(i === pageIndex ? { borderColor: C.cyanBorder } : {}) }} onClick={() => { setPageIndex(i); usePage(pg) }}>
                {pg.name || pg.path || `Page ${i + 1}`}
              </button>
            ))}
          </div>
          <p style={hintStyle}>Choosing a page makes it the background with a starting animation you can change below.</p>
        </div>
      ) : null}

      {bg ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <img src={bg.page.url} alt="" style={{ width: 64, height: 40, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, border: `1px solid ${C.border}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div data-testid="website-attribution" style={hintStyle}>{attributionText(bg.source.url, bg.source.capturedAt)}</div>
            </div>
          </div>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: C.text }}>
            <input type="checkbox" aria-label="Show website background" checked={bg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            Show the website
          </label>

          <div>
            <div style={labelStyle}>When it shows (seconds)</div>
            <div style={row}>
              <label style={hintStyle} htmlFor="wb-start">From</label>
              <input id="wb-start" type="number" aria-label="Website starts at (seconds)" min={0} step={0.1} value={seconds(bg.startFrame)} onChange={(e) => patch({ startFrame: toFrames(Number(e.target.value)) })} style={{ ...inputStyle, width: 70, minHeight: 28, padding: '0 6px' }} />
              <label style={hintStyle} htmlFor="wb-end">to</label>
              <input id="wb-end" type="number" aria-label="Website ends at (seconds)" min={0.1} step={0.1} value={seconds(bg.endFrame)} onChange={(e) => patch({ endFrame: toFrames(Number(e.target.value)) })} style={{ ...inputStyle, width: 70, minHeight: 28, padding: '0 6px' }} />
            </div>
            <p style={hintStyle}>After it ends your video shows again{bg.endFrame > total ? ' (the end is later than the video: it will be cut off)' : ''}.</p>
          </div>

          <div style={row}>
            <label style={labelStyle} htmlFor="wb-transition">Hand-over</label>
            <select id="wb-transition" aria-label="Website transition" value={bg.transition} onChange={(e) => patch({ transition: e.target.value as 'cut' | 'fade' | 'slide' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="cut">Cut</option>
            </select>
            <label style={labelStyle} htmlFor="wb-ease">Easing</label>
            <select id="wb-ease" aria-label="Scroll easing" value={bg.ease} onChange={(e) => patch({ ease: e.target.value as 'linear' | 'ease-in-out' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
              <option value="ease-in-out">Smooth</option>
              <option value="linear">Steady</option>
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="wb-scroll-from">Scroll from {Math.round(bg.scroll.from * 100)}%</label>
            <input id="wb-scroll-from" type="range" aria-label="Scroll start" min={0} max={1} step={0.01} value={bg.scroll.from} onChange={(e) => patch({ scroll: { from: Number(e.target.value), to: bg.scroll.to } })} style={{ width: '100%', accentColor: C.cyan }} />
            <label style={labelStyle} htmlFor="wb-scroll-to">Scroll to {Math.round(bg.scroll.to * 100)}%</label>
            <input id="wb-scroll-to" type="range" aria-label="Scroll end" min={0} max={1} step={0.01} value={bg.scroll.to} onChange={(e) => patch({ scroll: { from: bg.scroll.from, to: Number(e.target.value) } })} style={{ width: '100%', accentColor: C.cyan }} />
            {bg.sections.length > 0 ? (
              <div style={row}>
                <label style={hintStyle} htmlFor="wb-section">Scroll to section</label>
                <select id="wb-section" aria-label="Scroll to section" value="" onChange={(e) => {
                  const section = bg.sections[Number(e.target.value)]
                  if (section) patch({ scroll: { from: bg.scroll.from, to: scrollFractionForSection(section, bg, compW, compH) } })
                }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px', maxWidth: 180 }}>
                  <option value="">Choose…</option>
                  {bg.sections.map((s, i) => <option key={i} value={i}>{s.label || `Section ${i + 1}`}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <label style={labelStyle} htmlFor="wb-zoom-to">Zoom to {bg.zoom.to.toFixed(2)}×</label>
            <input id="wb-zoom-to" type="range" aria-label="Website zoom end" min={1} max={3} step={0.05} value={bg.zoom.to} onChange={(e) => patch({ zoom: { from: bg.zoom.from, to: Number(e.target.value) } })} style={{ width: '100%', accentColor: C.cyan }} />
            <label style={labelStyle} htmlFor="wb-zoom-from">Zoom from {bg.zoom.from.toFixed(2)}×</label>
            <input id="wb-zoom-from" type="range" aria-label="Website zoom start" min={1} max={3} step={0.05} value={bg.zoom.from} onChange={(e) => patch({ zoom: { from: Number(e.target.value), to: bg.zoom.to } })} style={{ width: '100%', accentColor: C.cyan }} />
            <div style={row}>
              <label style={hintStyle} htmlFor="wb-focus-x">Zoom centre</label>
              <input id="wb-focus-x" type="range" aria-label="Zoom centre left-right" min={0} max={1} step={0.01} value={bg.focus.x} onChange={(e) => patch({ focus: { x: Number(e.target.value), y: bg.focus.y } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
              <input type="range" aria-label="Zoom centre top-bottom" min={0} max={1} step={0.01} value={bg.focus.y} onChange={(e) => patch({ focus: { x: bg.focus.x, y: Number(e.target.value) } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: C.text }}>
              <input type="checkbox" aria-label="Show cursor" checked={bg.cursor.enabled} onChange={(e) => patch({ cursor: { enabled: e.target.checked, path: bg.cursor.path.length ? bg.cursor.path : CURSOR_PRESETS['glide-click'].path } })} />
              Animated cursor and clicks
            </label>
            {bg.cursor.enabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <div style={row}>
                  <select aria-label="Cursor movement" value="" onChange={(e) => { const pr = CURSOR_PRESETS[e.target.value]; if (pr) patch({ cursor: { path: pr.path, clicks: pr.clicks } }) }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                    <option value="">Cursor movement…</option>
                    {Object.entries(CURSOR_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select aria-label="Cursor style" value={bg.cursor.style} onChange={(e) => patch({ cursor: { style: e.target.value as 'arrow' | 'hand' } })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                    <option value="arrow">Arrow</option>
                    <option value="hand">Hand</option>
                  </select>
                  <select aria-label="Click effect" value={bg.cursor.clickEffect} onChange={(e) => patch({ cursor: { clickEffect: e.target.value as 'ripple' | 'pulse' } })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                    <option value="ripple">Ripple</option>
                    <option value="pulse">Pulse</option>
                  </select>
                </div>
                <div style={row}>
                  <span style={hintStyle}>Clicks:</span>
                  {bg.cursor.clicks.map((c, i) => (
                    <button key={i} type="button" aria-label={`Remove click at ${Math.round(c * 100)}%`} style={small} onClick={() => patch({ cursor: { clicks: bg.cursor.clicks.filter((_, j) => j !== i) } })}>{Math.round(c * 100)}% ✕</button>
                  ))}
                  <button type="button" aria-label="Add a click" style={small} onClick={() => patch({ cursor: { clicks: [...bg.cursor.clicks, 0.5] } })}>+ Add click</button>
                </div>
              </div>
            ) : null}
          </div>

          {capture?.crops && capture.crops.length > 0 && capture.cropInfo ? (
            <div>
              <div style={labelStyle}>Section pictures</div>
              <div style={row}>
                {capture.crops.map((src, i) => capture.cropInfo?.[i] ? (
                  <button key={src} type="button" aria-label={`Use section picture ${i + 1}`} style={{ padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', cursor: 'pointer' }} onClick={() => useCrop(i)}>
                    <img src={src} alt="" style={{ width: 70, height: 44, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  </button>
                ) : null)}
              </div>
              <p style={hintStyle}>Use just one section of the page instead of the whole page.</p>
            </div>
          ) : null}

          <button type="button" aria-label="Remove website background" style={small} onClick={() => edit((prev) => { const { websiteBackground: _gone, ...rest } = prev; return rest as PersonalizationPreviewSettings })}>Remove website background</button>
        </>
      ) : null}

      {pictures.length > 0 ? (
        <div>
          <div style={labelStyle}>Pictures from {websiteHost(capture?.url ?? '')}</div>
          <p style={hintStyle}>{attributionText(capture?.url ?? '', new Date().toISOString())}</p>
          {pictures.slice(0, 12).map((p, i) => (
            <div key={p.url} style={{ ...row, marginBottom: 4 }}>
              <img src={p.url} alt="" style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border}` }} />
              <span style={{ ...hintStyle, flex: 1, minWidth: 50 }}>{p.label}</span>
              {(['logo', 'product', 'service'] as AssetRole[]).map((role) => (
                <button key={role} type="button" aria-label={`Use picture ${i + 1} as ${ASSET_ROLE_LABEL[role].toLowerCase()}`} style={small} onClick={() => assign(role, p.url)}>{ASSET_ROLE_LABEL[role]}</button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
