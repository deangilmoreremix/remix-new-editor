import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { ColorField } from './editor/ColorField'
import { Tip } from './editor/Tip'
import { C, chipStyle, hintStyle, labelStyle, panelStyle, secondaryButtonStyle } from './tokens'
import { DEFAULT_CUTOUT, CUTOUT_SCALE_MAX, CUTOUT_SCALE_MIN, PRESENTER_PRESETS, type CutoutBackground, type CutoutSettings } from '../preview/cutout/cutoutSettings'
import { cancelMasks, ensureMasks, getCutoutStatus, masksVersion, subscribeMasks } from '../preview/cutout/maskStore'
import type { PreviewInputProps } from '../preview/types'

/**
 * Presenter background removal controls (Step 4, beside the layers). Segmentation runs in this browser and
 * costs no credits; the result is previewed live and drawn by the same code that exports it.
 */
export function CutoutPanel({ inputProps }: { inputProps: PreviewInputProps }): React.JSX.Element | null {
  const { previewSettings, updatePreviewComposition } = useDemoPersonalize()
  const videoUrl = inputProps.videoUrl
  useSyncExternalStore(subscribeMasks, masksVersion, masksVersion)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pickKind, setPickKind] = useState<'image' | 'video'>('image')

  const cutout: CutoutSettings = previewSettings.cutout ?? DEFAULT_CUTOUT
  const status = getCutoutStatus(videoUrl)
  const usable = Boolean(videoUrl) && !inputProps.isImageSource

  // A reopened project remembers that background removal was on, but the masks are not saved: measure them
  // again (free, in this browser) so the preview and export show the same thing.
  useEffect(() => {
    if (usable && videoUrl && cutout.enabled && status.state === 'idle') void ensureMasks(videoUrl).catch(() => undefined)
  }, [usable, videoUrl, cutout.enabled, status.state])

  if (!usable || !videoUrl) return null
  const processing = status.state === 'processing'
  const set = (patch: Partial<CutoutSettings>) => updatePreviewComposition({ cutout: { ...cutout, ...patch } })

  const start = () => {
    set({ enabled: true })
    void ensureMasks(videoUrl).catch(() => undefined)
  }
  const cancel = () => {
    cancelMasks(videoUrl)
    set({ enabled: false })
  }
  const setBackground = (background: CutoutBackground) => set({ background })

  const brand = previewSettings.brandColors
  const bg = cutout.background
  const business: { label: string; url: string }[] = [
    inputProps.brand.logoUrl ? { label: 'Your logo', url: inputProps.brand.logoUrl } : null,
    inputProps.brand.productUrl ? { label: 'Product image', url: inputProps.brand.productUrl } : null,
    inputProps.brand.serviceUrl ? { label: 'Service image', url: inputProps.brand.serviceUrl } : null,
  ].filter((v): v is { label: string; url: string } => Boolean(v))

  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setBackground(pickKind === 'image' ? { kind: 'image', url } : { kind: 'video', url })
  }

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void) => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )

  return (
    <div data-testid="cutout-panel" style={{ ...panelStyle, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eraser size={14} color={C.cyan} aria-hidden />
        <button type="button" data-testid="cutout-toggle-panel" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', flex: 1, textAlign: 'left' }}>
          Presenter background {cutout.enabled && status.state === 'ready' ? '· On' : ''}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!cutout.enabled && !processing && (
            <>
              <p style={{ ...hintStyle, margin: 0 }}>Cut the person out of this video and place them on a new background. Done in your browser; no credits used.</p>
              <Tip id="cutoutRemove" side="top">
                <button type="button" data-testid="cutout-remove" onClick={start} style={{ ...secondaryButtonStyle, minHeight: 32, borderColor: C.cyan, color: C.cyan }}>Remove background</button>
              </Tip>
              {status.state === 'error' && <div role="alert" data-testid="cutout-error" style={{ color: '#fca5a5', fontSize: 11 }}>{status.error}</div>}
            </>
          )}

          {processing && (
            <div data-testid="cutout-progress">
              <div style={{ color: C.text, fontSize: 11 }}>Removing background… {Math.round(status.progress * 100)}%</div>
              <progress max={1} value={status.progress} style={{ width: '100%' }} aria-label="Background removal progress" />
              <button type="button" data-testid="cutout-cancel" onClick={cancel} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, marginTop: 6 }}>Cancel</button>
            </div>
          )}

          {cutout.enabled && status.state === 'error' && !processing && (
            <div role="alert" data-testid="cutout-error" style={{ color: '#fca5a5', fontSize: 11 }}>
              {status.error}{' '}
              <button type="button" onClick={start} style={{ ...secondaryButtonStyle, minHeight: 24, fontSize: 10, padding: '0 8px' }}>Try again</button>
            </div>
          )}

          {cutout.enabled && status.state === 'ready' && (
            <>
              <div>
                <Tip id="cutoutBackground" side="top"><div style={labelStyle}>Background</div></Tip>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {([['none', 'None'], ['color', 'Color'], ['blur', 'Blur'], ['image', 'Image'], ['video', 'Video']] as const).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      data-testid={`cutout-bg-${kind}`}
                      aria-pressed={bg.kind === kind}
                      onClick={() => {
                        if (kind === 'none') setBackground({ kind: 'none' })
                        else if (kind === 'color') setBackground({ kind: 'color', color: bg.kind === 'color' ? bg.color : brand.primary })
                        else if (kind === 'blur') setBackground({ kind: 'blur', amount: 24 })
                        else { setPickKind(kind); fileRef.current?.click() }
                      }}
                      style={{ ...chipStyle(bg.kind === kind), minHeight: 28, fontSize: 10 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input ref={fileRef} type="file" hidden data-testid="cutout-bg-file" accept={pickKind === 'image' ? 'image/*' : 'video/*'} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
                {business.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {business.map((b) => (
                      <button key={b.url} type="button" data-testid="cutout-bg-business" onClick={() => setBackground({ kind: 'image', url: b.url })} style={{ ...chipStyle(bg.kind === 'image' && bg.url === b.url), minHeight: 26, fontSize: 10 }}>{b.label}</button>
                    ))}
                  </div>
                )}
                {bg.kind === 'color' && (
                  <div style={{ marginTop: 6 }}>
                    <ColorField id="cutout-bg-color" label="Background color" ariaLabel="Background color" tipId="cutoutColor" value={bg.color} onChange={(hex) => setBackground({ kind: 'color', color: hex })} brand={brand} posterUrl={inputProps.posterUrl} />
                  </div>
                )}
                {bg.kind === 'blur' && slider('cutout-bg-blur', 'Blur amount', bg.amount, 4, 60, 1, (v) => setBackground({ kind: 'blur', amount: v }))}
              </div>

              <div>
                <Tip id="cutoutPresenter" side="top"><div style={labelStyle}>Presenter</div></Tip>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                  {PRESENTER_PRESETS.map((p) => (
                    <button key={p.id} type="button" data-testid={`cutout-preset-${p.id}`} onClick={() => set({ presenter: p.presenter })} style={{ ...chipStyle(false), minHeight: 26, fontSize: 10 }}>{p.label}</button>
                  ))}
                </div>
                {slider('cutout-scale', 'Size', cutout.presenter.scale, CUTOUT_SCALE_MIN, CUTOUT_SCALE_MAX, 0.01, (v) => set({ presenter: { ...cutout.presenter, scale: v } }))}
                {slider('cutout-x', 'Horizontal position', cutout.presenter.x, -0.25, 1.25, 0.01, (v) => set({ presenter: { ...cutout.presenter, x: v } }))}
                {slider('cutout-y', 'Vertical position', cutout.presenter.y, -0.25, 1.25, 0.01, (v) => set({ presenter: { ...cutout.presenter, y: v } }))}
                {slider('cutout-rotation', 'Tilt', cutout.presenter.rotation, -45, 45, 1, (v) => set({ presenter: { ...cutout.presenter, rotation: v } }))}
              </div>

              <div>
                <Tip id="cutoutEdge" side="top"><div style={labelStyle}>Edge</div></Tip>
                {slider('cutout-feather', 'Soften', cutout.edge.feather, 0, 1, 0.01, (v) => set({ edge: { ...cutout.edge, feather: v } }))}
                {slider('cutout-shift', 'Edge (shrink / grow)', cutout.edge.shift, -1, 1, 0.01, (v) => set({ edge: { ...cutout.edge, shift: v } }))}
              </div>

              <Tip id="cutoutRestore" side="top">
                <button type="button" data-testid="cutout-restore" onClick={() => set({ enabled: false })} style={{ ...secondaryButtonStyle, minHeight: 30, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={11} /> Restore original video
                </button>
              </Tip>
            </>
          )}
        </div>
      )}
    </div>
  )
}
