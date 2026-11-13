// @vitest-environment jsdom
/**
 * Stage 5 — the Footage look and motion panel and the Text effects panel: every control writes a valid setting, presets,
 * clearing, the notes for removed backgrounds and for exits without an end time.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FootageEffectsPanel } from '../FootageEffectsPanel'
import { LayerEffectsPanel } from '../LayerEffectsPanel'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { defaultPresenter } from '../../preview/presenter'
import type { PersonalizationPreviewSettings } from '../../preview/types'

let latest: PersonalizationPreviewSettings
function FootageHarness({ initial, hasFootage = true }: { initial?: Partial<PersonalizationPreviewSettings>; hasFootage?: boolean }) {
  const [s, setS] = useState<PersonalizationPreviewSettings>(() => ({ ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 150, ...initial } as PersonalizationPreviewSettings))
  latest = s
  return <FootageEffectsPanel settings={s} edit={(fn) => setS((p) => fn(p))} hasFootage={hasFootage} />
}
function LayerHarness({ layer }: { layer?: Record<string, unknown> }) {
  const base = createDefaultPreviewSettings()
  const [s, setS] = useState<PersonalizationPreviewSettings>(() => ({ ...base, layers: [{ ...base.layers[0], id: 'headline', kind: 'headline', ...layer }] } as PersonalizationPreviewSettings))
  latest = s
  return <LayerEffectsPanel settings={s} edit={(fn) => setS((p) => fn(p))} selected={layer === undefined ? undefined : s.layers[0]} />
}
const range = (label: string, v: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(v) } })
afterEach(cleanup)

describe('FootageEffectsPanel', () => {
  it('needs footage', () => { render(<FootageHarness hasFootage={false} />); expect(screen.getByText(/Choose a video first/)).toBeTruthy(); expect(screen.queryByLabelText('Brightness')).toBeNull() })
  it('starts clean; each colour slider writes a clamped value and an identity look is not drawn later', () => {
    render(<FootageHarness />); expect(latest.footageEffects).toBeUndefined()
    range('Brightness', 1.2); range('Contrast', 1.1); range('Colour strength', 0.8); range('Warm / cool (negative = cool)', -0.4); range('Hue shift', 30); range('Sepia', 0.2); range('Black and white', 0.1); range('Vignette', 0.5); range('Soften (blur)', 4)
    expect(latest.footageEffects?.look).toEqual({ enabled: true, brightness: 1.2, contrast: 1.1, saturation: 0.8, hue: 30, temperature: -0.4, grayscale: 0.1, sepia: 0.2, blur: 4, vignette: 0.5 })
  })
  it('colour presets and camera presets apply; remove-all clears everything', () => {
    render(<FootageHarness />)
    fireEvent.change(screen.getByLabelText('Colour look preset'), { target: { value: 'cinematic' } }); expect(latest.footageEffects?.look).toMatchObject({ contrast: 1.25, vignette: 0.45 })
    fireEvent.change(screen.getByLabelText('Camera motion preset'), { target: { value: 'push-in' } }); expect(latest.footageEffects?.motion).toMatchObject({ enabled: true, zoom: { from: 1, to: 1.15 } })
    expect(screen.getByLabelText('Zoom at the end')).toBeTruthy()
    fireEvent.click(screen.getByText('Remove all effects')); expect(latest.footageEffects).toBeUndefined(); expect(screen.queryByText('Remove all effects')).toBeNull()
  })
  it('camera controls: zoom, drift (symmetric around the centre), easing, off', () => {
    render(<FootageHarness />); fireEvent.click(screen.getByLabelText('Camera motion')); expect(latest.footageEffects?.motion?.enabled).toBe(true)
    range('Zoom at the start', 1.1); range('Zoom at the end', 1.4); expect(latest.footageEffects?.motion?.zoom).toEqual({ from: 1.1, to: 1.4 })
    range('Drift left ↔ right', 0.1); expect(latest.footageEffects?.motion?.pan.x).toEqual({ from: -0.05, to: 0.05 })
    range('Drift up ↔ down', -0.06); expect(latest.footageEffects?.motion?.pan.y).toEqual({ from: 0.03, to: -0.03 })
    fireEvent.change(screen.getByLabelText('Camera motion easing'), { target: { value: 'linear' } }); expect(latest.footageEffects?.motion?.ease).toBe('linear')
    fireEvent.click(screen.getByLabelText('Camera motion')); expect(latest.footageEffects?.motion?.enabled).toBe(false); expect(screen.queryByLabelText('Zoom at the end')).toBeNull()
  })
  it('fades are in seconds and stored in frames; both ends are independent; zero removes', () => {
    render(<FootageHarness />); range('Fade in', 1); expect(latest.footageEffects?.fade).toEqual({ inFrames: 30, outFrames: 0 })
    range('Fade out', 2.5); expect(latest.footageEffects?.fade).toEqual({ inFrames: 30, outFrames: 75 })
    range('Fade in', 0); range('Fade out', 0); expect(latest.footageEffects).toBeUndefined()
  })
  it('explains why warm/cool and vignette are skipped when the presenter background is removed', () => {
    const presenter = { ...defaultPresenter('bubble'), background: { ...defaultPresenter('bubble').background, mode: 'remove' as const } }
    render(<FootageHarness initial={{ presenter }} />); expect(screen.getByText(/not drawn while the presenter's background is removed/)).toBeTruthy()
  })
})

describe('LayerEffectsPanel', () => {
  it('asks for a selection', () => { render(<LayerHarness />); expect(screen.getByText(/Select a text layer/)).toBeTruthy() })
  it('shadow, glow, outline write valid effects and can be removed', () => {
    render(<LayerHarness layer={{}} />)
    range('Text shadow', 0.6); expect(latest.layers[0].effect?.shadow).toBe(0.6)
    fireEvent.click(screen.getByLabelText('Text glow')); expect(latest.layers[0].effect?.glow).toEqual({ color: '#ffffff', strength: 0.6 })
    fireEvent.change(screen.getByLabelText('Glow colour'), { target: { value: '#ffcc00' } }); range('Glow strength', 0.9); expect(latest.layers[0].effect?.glow).toEqual({ color: '#ffcc00', strength: 0.9 })
    fireEvent.click(screen.getByLabelText('Text outline')); range('Outline width', 0.05); expect(latest.layers[0].effect?.outline).toEqual({ color: '#000000', width: 0.05 })
    fireEvent.click(screen.getByLabelText('Text glow')); expect(latest.layers[0].effect?.glow).toBeNull()
    fireEvent.click(screen.getByText('Remove text effects')); expect(latest.layers[0].effect).toBeUndefined()
  })
  it('exit: choose, set length, and the note appears when the layer has no end time', () => {
    render(<LayerHarness layer={{}} />)
    fireEvent.change(screen.getByLabelText('Exit animation'), { target: { value: 'slide-up' } }); expect(latest.layers[0].exit).toEqual({ animation: 'slide-up', frames: 15 })
    fireEvent.change(screen.getByLabelText('Exit length (frames)'), { target: { value: '40' } }); expect(latest.layers[0].exit?.frames).toBe(40)
    expect(screen.getByTestId('exit-needs-end').textContent).toMatch(/never leaves/)
    fireEvent.change(screen.getByLabelText('Exit animation'), { target: { value: 'none' } }); expect(latest.layers[0].exit).toBeUndefined(); expect(screen.queryByTestId('exit-needs-end')).toBeNull()
  })
  it('with an end time there is no warning; picture layers get no text controls', () => {
    const { unmount } = render(<LayerHarness layer={{ endFrame: 100, exit: { animation: 'fade', frames: 10 } }} />); expect(screen.queryByTestId('exit-needs-end')).toBeNull(); unmount()
    render(<LayerHarness layer={{ kind: 'logo' }} />); expect(screen.queryByLabelText('Text shadow')).toBeNull(); expect(screen.getByLabelText('Exit animation')).toBeTruthy()
  })
})
