// @vitest-environment jsdom
/**
 * Stage 2 — the website-background panel with a fake capture service: success, every failure kind, cancel, empty input,
 * motion controls, role assignment and attribution; plus the pure helpers and the website motion inside saved layouts.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WebsiteBackgroundPanel, type CaptureFn, type WebsiteCapture } from '../WebsiteBackgroundPanel'
import { ASSET_ROLE_LABEL, assignAssetToRole, attributionText, describeCaptureError, patchWebsiteBackground } from '../websiteAssets'
import { applyLayout, normalizeSavedLayouts, snapshotLayout } from '../savedLayouts'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { normalizeWebsiteBackground, type WebsiteBackground } from '../../preview/websiteBackground'
import type { PersonalizationPreviewSettings } from '../../preview/types'

const CAPTURE: WebsiteCapture = {
  url: 'https://acme.example/',
  title: 'Acme Roofing',
  pages: [
    { name: 'home', path: '/', url: 'https://cdn.example.com/home.jpg', width: 3840, height: 3492, layout: { pageH: 1746, sections: [{ x: 0, y: 0, width: 1920, height: 600 }, { x: 0, y: 900, width: 1920, height: 400 }] } },
    { name: 'about', path: '/about', url: 'https://cdn.example.com/about.jpg', width: 3840, height: 2400, layout: null },
  ],
  crops: ['https://cdn.example.com/crop-1.jpg'],
  cropInfo: [{ route: '/', width: 3840, height: 800, text: 'Our services' }],
  logo: 'https://cdn.example.com/logo.png',
  images: ['https://cdn.example.com/img-1.jpg'],
  assets: [{ url: 'https://cdn.example.com/team.jpg', category: 'people', alt: 'The team' }],
}

let latest: PersonalizationPreviewSettings

function Harness({ captureFn, initial }: { captureFn: CaptureFn; initial?: PersonalizationPreviewSettings }) {
  const [settings, setSettings] = useState(initial ?? createDefaultPreviewSettings())
  latest = settings
  return <WebsiteBackgroundPanel settings={settings} edit={(fn) => setSettings((p) => fn(p))} captureFn={captureFn} />
}

const fakeCapture = (result: WebsiteCapture | Error, delayMs = 0): CaptureFn =>
  vi.fn(async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    if (result instanceof Error) throw result
    return result
  })
const err = (code: string, status = 0, message = 'x') => Object.assign(new Error(message), { code, status })
const bg = () => latest.websiteBackground as WebsiteBackground

async function captureAndPick(fn: CaptureFn = fakeCapture(CAPTURE), pageLabel = 'Use page home') {
  render(<Harness captureFn={fn} />)
  fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'acme.example' } })
  await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
  fireEvent.click(await screen.findByLabelText(pageLabel))
}
afterEach(() => cleanup())

describe('capture flow', () => {
  it('captures, lists the pages found, and turns the chosen page into a website background with its source recorded', async () => {
    const fn = fakeCapture(CAPTURE)
    await captureAndPick(fn)
    expect(fn).toHaveBeenCalledWith('acme.example', expect.objectContaining({ onProgress: expect.any(Function), cancelled: expect.any(Function) }))
    expect(bg().page).toEqual({ url: 'https://cdn.example.com/home.jpg', width: 3840, height: 3492 })
    expect(bg().source).toMatchObject({ url: 'https://acme.example/', title: 'Acme Roofing' })
    expect(bg().sections).toHaveLength(2)
    expect(bg().endFrame).toBeGreaterThan(bg().startFrame)
    expect(screen.getByTestId('website-attribution').textContent).toMatch(/Captured from acme\.example on \d{4}-\d{2}-\d{2}.*permission/)
  })
  it('switching page replaces the picture', async () => {
    await captureAndPick()
    fireEvent.click(screen.getByLabelText('Use page about'))
    expect(bg().page.url).toBe('https://cdn.example.com/about.jpg')
  })
  it('does not call the service for an empty address', async () => {
    const fn = fakeCapture(CAPTURE)
    render(<Harness captureFn={fn} />)
    await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
    expect(fn).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/Enter the website address/)
  })
  it.each([
    ['UNAUTHENTICATED', 401, /Sign in/],
    ['FORBIDDEN', 403, /SmartVideo GO plan/],
    ['RATE_LIMITED', 429, /few minutes/],
    ['URL_REJECTED', 400, /private or internal/],
    ['TIMEOUT', 408, /too long/],
    ['CAPTURE_FAILED', 422, /block automated visits/],
  ])('explains a %s failure in plain words and leaves the project unchanged', async (code, status, text) => {
    render(<Harness captureFn={fakeCapture(err(code as string, status as number))} />)
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://acme.example' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
    expect((await screen.findByRole('alert')).textContent).toMatch(text as RegExp)
    expect(latest.websiteBackground).toBeUndefined()
  })
  it('a capture with no picture says so and changes nothing', async () => {
    render(<Harness captureFn={fakeCapture({ url: 'https://acme.example/', title: 'x', pages: [] })} />)
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://acme.example' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
    expect((await screen.findByRole('status')).textContent).toMatch(/only its text/)
    expect(latest.websiteBackground).toBeUndefined()
  })
  it('cancel stops the capture and the late result is ignored', async () => {
    render(<Harness captureFn={fakeCapture(CAPTURE, 40)} />)
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://acme.example' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
    fireEvent.click(screen.getByLabelText('Cancel capture'))
    await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
    expect(screen.queryByLabelText('Use page home')).toBeNull()
    expect(screen.getByLabelText('Capture website')).toBeTruthy()
    expect(latest.websiteBackground).toBeUndefined()
  })
})

describe('business website', () => {
  it('is pre-filled from the business\'s own website when the project knows it, and can be edited', async () => {
    const fn = fakeCapture(CAPTURE)
    render(<WebsiteBackgroundPanel settings={createDefaultPreviewSettings()} edit={() => {}} captureFn={fn} defaultUrl="  https://acme.example/  " />)
    const input = screen.getByLabelText('Website address') as HTMLInputElement
    expect(input.value).toBe('https://acme.example/')
    await act(async () => { fireEvent.click(screen.getByLabelText('Capture website')) })
    expect(fn).toHaveBeenCalledWith('https://acme.example/', expect.anything())
  })
  it('starts empty when no website is known', () => {
    render(<WebsiteBackgroundPanel settings={createDefaultPreviewSettings()} edit={() => {}} captureFn={fakeCapture(CAPTURE)} />)
    expect((screen.getByLabelText('Website address') as HTMLInputElement).value).toBe('')
  })
})

describe('motion controls write through the normalizer', () => {
  it('timing, transition, easing, scroll, zoom and focus', async () => {
    await captureAndPick()
    fireEvent.change(screen.getByLabelText('Website ends at (seconds)'), { target: { value: '3' } })
    expect(bg().endFrame).toBe(90)
    fireEvent.change(screen.getByLabelText('Website transition'), { target: { value: 'slide' } })
    expect(bg().transition).toBe('slide')
    fireEvent.change(screen.getByLabelText('Scroll easing'), { target: { value: 'linear' } })
    expect(bg().ease).toBe('linear')
    fireEvent.change(screen.getByLabelText('Scroll end'), { target: { value: '0.8' } })
    expect(bg().scroll.to).toBe(0.8)
    fireEvent.change(screen.getByLabelText('Website zoom end'), { target: { value: '2.5' } })
    expect(bg().zoom.to).toBe(2.5)
    fireEvent.change(screen.getByLabelText('Zoom centre left-right'), { target: { value: '0.2' } })
    expect(bg().focus.x).toBe(0.2)
  })
  it('an end time before the start is repaired, never an empty window', async () => {
    await captureAndPick()
    fireEvent.change(screen.getByLabelText('Website starts at (seconds)'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Website ends at (seconds)'), { target: { value: '1' } })
    expect(bg().endFrame).toBeGreaterThan(bg().startFrame)
  })
  it('"Scroll to section" computes the right scroll position', async () => {
    await captureAndPick()
    fireEvent.change(screen.getByLabelText('Scroll to section'), { target: { value: '1' } })
    // section 2 starts at css y=900 -> screenshot y=1800 -> 900 composition px; the page can scroll 666px -> clamped to the end
    expect(bg().scroll.to).toBe(1)
  })
  it('cursor presets, style, effect and clicks', async () => {
    await captureAndPick()
    fireEvent.change(screen.getByLabelText('Cursor movement'), { target: { value: 'cta-corner' } })
    expect(bg().cursor.path.at(-1)).toMatchObject({ x: 0.82, y: 0.12 })
    expect(bg().cursor.clicks).toEqual([0.75])
    fireEvent.change(screen.getByLabelText('Cursor style'), { target: { value: 'hand' } })
    fireEvent.change(screen.getByLabelText('Click effect'), { target: { value: 'pulse' } })
    expect(bg().cursor).toMatchObject({ style: 'hand', clickEffect: 'pulse' })
    fireEvent.click(screen.getByLabelText('Add a click'))
    expect(bg().cursor.clicks).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('Remove click at 75%'))
    expect(bg().cursor.clicks).toEqual([0.5])
    fireEvent.click(screen.getByLabelText('Show cursor'))
    expect(bg().cursor.enabled).toBe(false)
  })
  it('can hide, use a section picture, and remove the website background', async () => {
    await captureAndPick()
    fireEvent.click(screen.getByLabelText('Show website background'))
    expect(bg().enabled).toBe(false)
    fireEvent.click(screen.getByLabelText('Use section picture 1'))
    expect(bg().page).toEqual({ url: 'https://cdn.example.com/crop-1.jpg', width: 3840, height: 800 })
    expect(bg().sections).toEqual([])
    fireEvent.click(screen.getByLabelText('Remove website background'))
    expect(latest.websiteBackground).toBeUndefined()
  })
})

describe('assigning captured pictures to video roles', () => {
  it('puts the logo and pictures on the right layers, durable URLs only', async () => {
    await captureAndPick()
    fireEvent.click(screen.getByLabelText('Use picture 1 as logo'))
    expect(latest.layers.find((l) => l.kind === 'logo')?.imageUrl).toBe('https://cdn.example.com/logo.png')
    expect(screen.getByText(/Used as the logo/)).toBeTruthy()
    expect(screen.getAllByText(/pictures belong to that site's owner/).length).toBeGreaterThanOrEqual(1)
  })
  it('says so when the project has no layer for that role', async () => {
    await captureAndPick()
    fireEvent.click(screen.getByLabelText('Use picture 1 as product image'))
    expect(screen.getByText(/no product image layer/)).toBeTruthy()
  })
})

describe('helpers', () => {
  const s = createDefaultPreviewSettings()
  it('assignAssetToRole', () => {
    expect(assignAssetToRole(s, 'logo', 'https://x/l.png')).toMatchObject({ assigned: true })
    expect(assignAssetToRole(s, 'logo', 'blob:http://x/1')).toMatchObject({ assigned: false, reason: 'bad-url' })
    expect(assignAssetToRole(s, 'logo', 'data:image/png;base64,AA')).toMatchObject({ assigned: false, reason: 'bad-url' })
    expect(assignAssetToRole(s, 'service', 'https://x/s.png')).toMatchObject({ assigned: false, reason: 'no-layer' })
    expect(assignAssetToRole(s, 'logo', 'https://x/l.png').settings.layers.find((l) => l.kind === 'logo')?.visible).toBe(true)
    expect(s.layers.find((l) => l.kind === 'logo')?.imageUrl).toBeUndefined() // input untouched
    expect(ASSET_ROLE_LABEL.logo).toBe('Logo')
  })
  it('describeCaptureError never leaks raw internals and always says something', () => {
    expect(describeCaptureError(undefined)).toMatch(/Capture failed/)
    expect(describeCaptureError(err('WHATEVER', 500, 'boom'))).toBe('Capture failed: boom')
    expect(describeCaptureError({ code: 'CANCELLED' })).toBe('Capture stopped.')
  })
  it('attributionText', () => {
    expect(attributionText('https://acme.example/x', '2026-11-13T05:00:00Z')).toBe("Captured from acme.example on 2026-11-13. The pictures belong to that site's owner: use them only with permission.")
    expect(attributionText('not a url', '')).toMatch(/Captured from the website\./)
  })
  it('patchWebsiteBackground returns the same object when there is nothing to patch or the result is invalid', () => {
    expect(patchWebsiteBackground(s, { enabled: false })).toBe(s)
    const withBg = { ...s, websiteBackground: normalizeWebsiteBackground({ page: { url: 'https://x/p.jpg', width: 100, height: 100 } }) }
    expect(patchWebsiteBackground(withBg, { page: { url: 'blob:bad', width: 100, height: 100 } })).toBe(withBg)
    expect(patchWebsiteBackground(withBg, { zoom: { from: 1, to: 9 } }).websiteBackground?.zoom.to).toBe(3)
  })
})

describe('website motion in saved layouts', () => {
  const mk = (url: string, over: Record<string, unknown> = {}): PersonalizationPreviewSettings => ({
    ...createDefaultPreviewSettings(),
    websiteBackground: normalizeWebsiteBackground({
      source: { url: 'https://acme.example/', title: 'Acme Secret Title', capturedAt: '2026-11-13' }, page: { url, width: 3840, height: 3492 },
      sections: [{ label: 'Private section', y: 10, height: 100 }], scroll: { from: 0.1, to: 0.9 }, zoom: { from: 1, to: 2.2 },
      cursor: { enabled: true, path: [{ t: 0, x: 0.2, y: 0.2 }], clicks: [0.4] }, ...over,
    }),
  })
  it('stores the motion but never the URL, title, section names or picture', () => {
    const snap = snapshotLayout(mk('https://cdn.example.com/secret-page.jpg'), 'Website move', 'l1', 1)!
    const json = JSON.stringify(snap)
    expect(snap.websiteMotion?.zoom).toEqual({ from: 1, to: 2.2 })
    for (const leaked of ['acme.example', 'Acme Secret Title', 'Private section', 'secret-page.jpg', 'cdn.example.com']) expect(json).not.toContain(leaked)
  })
  it("applies to another prospect's website and leaves their picture and source alone", () => {
    const snap = snapshotLayout(mk('https://cdn.example.com/mine.jpg'), 'L', 'l1', 1)!
    const theirs = mk('https://cdn.example.com/theirs.jpg', { source: { url: 'https://other.example/', title: 'Other', capturedAt: 'x' }, scroll: { from: 0, to: 0.1 }, zoom: { from: 1, to: 1 } })
    const out = applyLayout(theirs, snap).settings.websiteBackground as WebsiteBackground
    expect(out.scroll).toEqual({ from: 0.1, to: 0.9 })
    expect(out.zoom.to).toBe(2.2)
    expect(out.page.url).toBe('https://cdn.example.com/theirs.jpg')
    expect(out.source.title).toBe('Other')
  })
  it('a project without a website is not given one by a layout', () => {
    const snap = snapshotLayout(mk('https://cdn.example.com/mine.jpg'), 'L', 'l1', 1)!
    expect(applyLayout(createDefaultPreviewSettings(), snap).settings.websiteBackground).toBeUndefined()
  })
  it('survives storage normalization and drops junk motion', () => {
    const snap = snapshotLayout(mk('https://cdn.example.com/mine.jpg'), 'L', 'l1', 1)!
    expect(normalizeSavedLayouts(JSON.parse(JSON.stringify([snap])))[0].websiteMotion).toEqual(snap.websiteMotion)
    expect(normalizeSavedLayouts([{ ...snap, websiteMotion: 'nope' }])[0].websiteMotion).toBeUndefined()
  })
})
