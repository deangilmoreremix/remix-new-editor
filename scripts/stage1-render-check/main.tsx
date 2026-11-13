// Browser side of the Stage 1 real-render check. Renders the REAL PersonalizationComposition through
// Remotion's web renderer (the same renderer the app's export uses) so preview/export parity of the
// Stage 1 layer properties is verified in an actual browser, not under jsdom mocks.
import * as Remotion from 'remotion'
import { renderStillOnWeb } from '@remotion/web-renderer'
import { PersonalizationComposition } from '@ohb/shared/personalization/preview/PersonalizationComposition'
import { createDefaultPreviewSettings } from '@ohb/shared/personalization/preview/presets'

// A deterministic 4-quadrant poster so pan/zoom is measurable: red | green / blue | yellow (drawn in-browser, no network).
function poster(): string {
  const c = document.createElement('canvas')
  c.width = 1920
  c.height = 1080
  const g = c.getContext('2d')!
  const q = [['#c0392b', '#27ae60'], ['#2980b9', '#f1c40f']]
  for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { g.fillStyle = q[r][k]; g.fillRect(k * 960, r * 540, 960, 540) }
  return c.toDataURL('image/png')
}
const POSTER = poster()

;(window as any).renderCase = async (patch: any) => {
  const base = createDefaultPreviewSettings()
  const layer = {
    id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.5, scale: 0.09, animation: 'none',
    animationDelay: 0, startFrame: 0, opacity: 1, text: patch.text ?? 'Hello {{city}}', color: '#ffffff',
    ...(patch.layer ?? {}),
  }
  const settings = { ...base, layers: [layer], showEndCard: false, brandColors: { ...base.brandColors, backgroundDim: 0 }, ...(patch.settings ?? {}) }
  const props = {
    videoUrl: null, posterUrl: POSTER, isImageSource: true, audioUrl: null, settings,
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
  }
  const result = await renderStillOnWeb({
    composition: { id: 'p', component: PersonalizationComposition as any, width: 1920, height: 1080, fps: 30, durationInFrames: 150, defaultProps: props as any },
    inputProps: props as any, frame: 30, imageFormat: 'png', licenseKey: 'free-license', delayRenderTimeoutInMilliseconds: 20000,
  } as any)
  const blob = await (result as any).blob({ format: 'png' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}
;(window as any).internalsInfo = () => ({ sequenceManager: typeof (Remotion as any).Internals.SequenceManager })
;(window as any).ready = true
