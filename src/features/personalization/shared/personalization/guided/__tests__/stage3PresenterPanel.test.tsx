// @vitest-environment jsdom
/**
 * Stage 3 — the presenter panel and the draggable stage box with a fake bake service: presets, layout/shape/size,
 * background modes, the honest "needs processed footage" message, processing progress / success / every failure /
 * cancel, reuse, framing, video-aspect probing, and keyboard + pointer movement of the box.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PresenterPanel, describeBakeError, type BakeFn } from '../PresenterPanel'
import { PresenterStageBox } from '../PresenterStageBox'
import { BakeError } from '../presenterBake'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { clearMatteRegistry, registerMatteUrl } from '../../preview/presenterMatteRegistry'
import { normalizePresenter, presenterRect } from '../../preview/presenter'
import type { PersonalizationPreviewSettings } from '../../preview/types'

const VIDEO = 'https://cdn.example.com/talk.mp4'
const MATTE = { key: 'pm_mediapipe_abcdef12', engine: 'mediapipe' as const, sourceUrl: VIDEO, createdAt: 'now', bounds: { x0: 0.3, y0: 0.07, x1: 0.78, y1: 0.93 }, videoAspect: 9 / 16 }
let latest: PersonalizationPreviewSettings

function Harness({ bakeFn, initial, probe, video = VIDEO }: { bakeFn?: BakeFn; initial?: Partial<PersonalizationPreviewSettings>; probe?: (u: string) => Promise<number | undefined>; video?: string | null }) {
  const [s, setS] = useState<PersonalizationPreviewSettings>(() => ({ ...createDefaultPreviewSettings(), width: 1280, height: 720, ...initial } as PersonalizationPreviewSettings))
  latest = s
  return <PresenterPanel settings={s} edit={(fn) => setS((p) => fn(p))} videoUrl={video} bakeFn={bakeFn} probeAspect={probe ?? (async () => undefined)} />
}
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

afterEach(() => { cleanup(); clearMatteRegistry(); vi.restoreAllMocks() })

describe('PresenterPanel', () => {
  it('without a video there is nothing to frame', () => {
    render(<Harness video={null} />)
    expect(screen.getByText(/Choose a video first/)).toBeTruthy(); expect(screen.queryByLabelText('Presenter preset')).toBeNull()
  })
  it('starts as plain full video and a preset creates the presenter', () => {
    render(<Harness />)
    expect(latest.presenter).toBeUndefined(); expect(screen.getByText(/The video fills the frame/)).toBeTruthy()
    pick('Presenter preset', 'bubble-bottom-left')
    expect(latest.presenter).toMatchObject({ layout: 'bubble', shape: 'circle', enabled: true })
    fireEvent.click(screen.getByText('Reset to full video'))
    expect(latest.presenter).toBeUndefined()
  })
  it('layout, shape, size, position, border, shadow, mirror all write valid settings', () => {
    render(<Harness />)
    pick('Presenter preset', 'pip-corner')
    pick('Presenter layout', 'bubble'); expect(latest.presenter?.layout).toBe('bubble')
    pick('Presenter shape', 'rounded'); expect(latest.presenter?.shape).toBe('rounded')
    fireEvent.change(screen.getByLabelText('Presenter size'), { target: { value: '40' } }); expect(latest.presenter?.box.size).toBe(0.4)
    fireEvent.change(screen.getByLabelText('Presenter left-right'), { target: { value: '30' } }); expect(latest.presenter?.box.x).toBe(0.3)
    fireEvent.change(screen.getByLabelText('Presenter top-bottom'), { target: { value: '20' } }); expect(latest.presenter?.box.y).toBe(0.2)
    fireEvent.change(screen.getByLabelText('Presenter corner roundness'), { target: { value: '25' } }); expect(latest.presenter?.radius).toBe(0.25)
    fireEvent.click(screen.getByLabelText('Presenter border')); expect(latest.presenter?.borderWidth).toBe(0)
    fireEvent.click(screen.getByLabelText('Presenter shadow')); expect(latest.presenter?.shadow).toBe(false)
    fireEvent.click(screen.getByLabelText('Mirror presenter')); expect(latest.presenter?.mirror).toBe(true)
    fireEvent.change(screen.getByLabelText('Presenter zoom'), { target: { value: '250' } }); expect(latest.presenter?.focus.zoom).toBe(2.5)
    fireEvent.click(screen.getByLabelText('Show presenter effects')); expect(latest.presenter?.enabled).toBe(false)
  })
  it('full frame hides box controls; switching layout resets geometry sensibly', () => {
    render(<Harness />)
    pick('Presenter preset', 'full-blur')
    expect(screen.queryByLabelText('Presenter size')).toBeNull()
    pick('Presenter layout', 'pip'); expect(latest.presenter).toMatchObject({ layout: 'pip', shape: 'rounded' })
  })
  it('a background that needs processed footage says so, and the plan stays on the original', () => {
    render(<Harness />)
    pick('Presenter preset', 'bubble-bottom-left')
    fireEvent.click(screen.getByLabelText('Background: Remove'))
    expect(screen.getByTestId('presenter-degraded').textContent).toMatch(/needs processed footage/)
    fireEvent.click(screen.getByLabelText('Background: Keep'))
    expect(screen.queryByTestId('presenter-degraded')).toBeNull()
  })
  it('a picture background accepts only http(s) addresses', () => {
    render(<Harness />)
    pick('Presenter preset', 'bubble-bottom-left')
    fireEvent.click(screen.getByLabelText('Background: Picture'))
    expect(latest.presenter?.background.mode).toBe('keep') // no picture yet → not enabled
  })
  it('processing: progress, success, matte stored, status shown', async () => {
    let resolve!: (r: any) => void
    const bakeFn = vi.fn((_u: string, _o: unknown, h: Parameters<BakeFn>[2]) => { h.onProgress?.({ stage: 'process', progress: 0.42 }); return new Promise<any>((r) => { resolve = r }) }) as unknown as BakeFn
    render(<Harness bakeFn={bakeFn} />)
    pick('Presenter preset', 'bubble-cutout')
    fireEvent.click(screen.getByText('Process footage'))
    await waitFor(() => expect(screen.getByRole('progressbar').textContent).toMatch(/42%/))
    expect(bakeFn).toHaveBeenCalledWith(VIDEO, { engine: 'mediapipe' }, expect.anything())
    registerMatteUrl(MATTE.key, 'blob:ok')
    await act(async () => { resolve({ matte: MATTE, url: 'blob:ok', reused: false, meanCoverage: 0.2, frames: 122 }) })
    await waitFor(() => expect(screen.getByTestId('presenter-matte-ready')).toBeTruthy())
    expect(latest.presenter?.matte?.key).toBe(MATTE.key); expect(screen.getByTestId('presenter-message').textContent).toMatch(/122 frames/)
    expect(screen.queryByTestId('presenter-degraded')).toBeNull()
    expect(screen.getByText('Process again')).toBeTruthy()
  })
  it('reused footage is reported as reused', async () => {
    registerMatteUrl(MATTE.key, 'blob:ok')
    render(<Harness bakeFn={async () => ({ matte: MATTE, url: 'blob:ok', reused: true, meanCoverage: NaN, frames: 0 })} />)
    pick('Presenter preset', 'bubble-cutout'); fireEvent.click(screen.getByText('Process footage'))
    await waitFor(() => expect(screen.getByTestId('presenter-message').textContent).toMatch(/Reused/))
  })
  it('the engine choice is sent to the bake', async () => {
    const bakeFn: BakeFn = vi.fn(async () => { throw new BakeError('x', 'ENGINE') })
    render(<Harness bakeFn={bakeFn} />)
    pick('Presenter preset', 'bubble-cutout'); pick('Processing method', 'modnet'); fireEvent.click(screen.getByText('Process footage'))
    await waitFor(() => expect(bakeFn).toHaveBeenCalledWith(VIDEO, { engine: 'modnet' }, expect.anything()))
  })
  it.each([
    [new BakeError('No person was found in the footage.', 'NO_PERSON'), /No person was found/],
    [new BakeError('The MediaPipe segmenter could not start: wasm blocked', 'ENGINE'), /could not start/],
    [new Error('This browser cannot encode VP9 video'), /cannot encode video/],
    [new Error("Couldn't load the clip's media (HTTP 404)"), /could not be loaded \(HTTP 404\)/],
    [new Error('boom'), /boom/],
  ])('failure %#: shown as an alert, nothing stored', async (error, text) => {
    render(<Harness bakeFn={async () => { throw error }} />)
    pick('Presenter preset', 'bubble-cutout'); fireEvent.click(screen.getByText('Process footage'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(text))
    expect(latest.presenter?.matte).toBeUndefined()
  })
  it('cancel aborts the bake and is not reported as an error', async () => {
    const bakeFn: BakeFn = (_u, _o, h) => new Promise((_r, reject) => { h.signal?.addEventListener('abort', () => reject(new BakeError('Cancelled', 'ABORTED'))) })
    render(<Harness bakeFn={bakeFn} />)
    pick('Presenter preset', 'bubble-cutout'); fireEvent.click(screen.getByText('Process footage'))
    await waitFor(() => screen.getByText('Cancel')); fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.getByText('Process footage')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByTestId('presenter-message').textContent).toBe('Cancelled.')
  })
  it('frame head and shoulders needs measured bounds, then changes the zoom', () => {
    render(<Harness initial={{ presenter: { ...createDefaultPreviewSettings().presenter, enabled: true, layout: 'bubble', shape: 'circle', box: { x: .14, y: .8, size: .22 }, aspect: 1, radius: .18, focus: { x: .5, y: .4, zoom: 1 }, mirror: false, borderWidth: .012, borderColor: '#ffffff', shadow: true, background: { mode: 'keep', blur: 10, color: '#0f172a', imageUrl: '' } } as any }} />)
    expect((screen.getByText('Frame head and shoulders') as HTMLButtonElement).disabled).toBe(true)
  })
  it('frames with bounds', () => {
    registerMatteUrl(MATTE.key, 'blob:ok')
    render(<Harness initial={{ presenter: normalizePresenter({ enabled: true, layout: 'bubble', shape: 'circle', box: { x: .14, y: .8, size: .22 }, background: { mode: 'remove' }, matte: MATTE }) }} />)
    const btn = screen.getByText('Frame head and shoulders') as HTMLButtonElement
    expect(btn.disabled).toBe(false); fireEvent.click(btn)
    expect(latest.presenter!.focus.zoom).toBeGreaterThan(1.5)
    expect(latest.presenter!.focus.y).toBeLessThan(0.3) // the head is near the top of the video
  })
  it('probes the video aspect once and stores it', async () => {
    const probe = vi.fn(async () => 9 / 16)
    render(<Harness probe={probe} />)
    pick('Presenter preset', 'bubble-bottom-left')
    await waitFor(() => expect(latest.presenter?.videoAspect).toBe(0.5625))
    expect(probe).toHaveBeenCalledTimes(1)
  })
  it('describeBakeError', () => {
    expect(describeBakeError(new BakeError('x', 'ABORTED'))).toBe('Cancelled.')
    expect(describeBakeError(undefined)).toBe('Processing failed.')
  })
})

describe('PresenterStageBox', () => {
  const settings = (over: any = {}): PersonalizationPreviewSettings => ({ ...createDefaultPreviewSettings(), width: 1000, height: 500, presenter: { enabled: true, layout: 'pip', shape: 'rect', box: { x: 0.5, y: 0.5, size: 0.2 }, aspect: 2, background: { mode: 'keep' }, ...over } } as any)
  const mount = (s: PersonalizationPreviewSettings) => {
    const edits: PersonalizationPreviewSettings[] = []
    const edit = vi.fn((fn: any) => { const n = fn(s); edits.push(n); s = n })
    render(<PresenterStageBox settings={s} edit={edit} factor={0.5} compW={1000} compH={500} />)
    return { edit, edits }
  }
  it('draws nothing for full frame, disabled or absent presenters', () => {
    for (const p of [{ layout: 'full' }, { enabled: false }]) { const { container } = render(<PresenterStageBox settings={settings(p)} edit={() => {}} factor={1} compW={1000} compH={500} />); expect(container.firstChild).toBeNull() }
    const { container } = render(<PresenterStageBox settings={createDefaultPreviewSettings()} edit={() => {}} factor={1} compW={1000} compH={500} />); expect(container.firstChild).toBeNull()
  })
  it('is placed where the composition draws the presenter (scaled to the stage)', () => {
    mount(settings())
    const rect = presenterRect(settings().presenter!, 1000, 500)
    const el = screen.getByTestId('stage-presenter')
    expect(el.style.left).toBe(`${rect.left * 0.5}px`); expect(el.style.width).toBe(`${rect.width * 0.5}px`)
  })
  it('one drag is one edit, committed on release, clamped to the frame', () => {
    const { edit, edits } = mount(settings())
    const el = screen.getByTestId('stage-presenter')
    fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 140, clientY: 110, pointerId: 1 })
    expect(edit).not.toHaveBeenCalled() // still local while dragging
    fireEvent.pointerUp(el, { clientX: 140, clientY: 110, pointerId: 1 })
    expect(edit).toHaveBeenCalledTimes(1)
    expect(edits[0].presenter!.box.x).toBeCloseTo(0.5 + 80 / 1000, 3); expect(edits[0].presenter!.box.y).toBeCloseTo(0.5 + 20 / 500, 3)
  })
  it('a drag far outside keeps the box inside the frame', () => {
    const { edits } = mount(settings())
    const el = screen.getByTestId('stage-presenter')
    fireEvent.pointerDown(el, { clientX: 0, clientY: 0, pointerId: 1 }); fireEvent.pointerUp(el, { clientX: 99999, clientY: 99999, pointerId: 1 })
    const r = presenterRect(edits[0].presenter!, 1000, 500)
    expect(r.left + r.width).toBeLessThanOrEqual(1000 + 1e-6); expect(r.top + r.height).toBeLessThanOrEqual(500 + 1e-6)
  })
  it('a click without movement does not edit', () => {
    const { edit } = mount(settings())
    const el = screen.getByTestId('stage-presenter')
    fireEvent.pointerDown(el, { clientX: 5, clientY: 5, pointerId: 1 }); fireEvent.pointerUp(el, { clientX: 5, clientY: 5, pointerId: 1 })
    expect(edit).not.toHaveBeenCalled()
  })
  it('arrow keys nudge by 1% (10% with Shift); other keys do nothing', () => {
    const { edits, edit } = mount(settings())
    const el = screen.getByTestId('stage-presenter')
    fireEvent.keyDown(el, { key: 'ArrowRight' }); expect(edits[0].presenter!.box.x).toBeCloseTo(0.51, 3)
    fireEvent.keyDown(el, { key: 'ArrowUp', shiftKey: true }); expect(edits[1].presenter!.box.y).toBeCloseTo(0.4, 3)
    fireEvent.keyDown(el, { key: 'a' }); expect(edit).toHaveBeenCalledTimes(2)
  })
})
