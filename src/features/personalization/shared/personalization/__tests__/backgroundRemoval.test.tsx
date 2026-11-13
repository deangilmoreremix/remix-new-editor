// @vitest-environment jsdom
/**
 * On-device background removal (BG0) for the Asset Finder: the sequential
 * client, the auto-cutout queue, and the grid / viewer controls. BG0 itself
 * is mocked (it needs WebGPU/WASM and a ~192 MB model).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DiscoveredAsset } from '../types'

const state = vi.hoisted(() => ({
  active: 0,
  maxActive: 0,
  order: [] as string[],
  fail: null as null | { code: string },
}))

vi.mock('@bg0/browser', () => ({
  getBrowserCapabilities: () => ({ webgpu: false, wasm: true }),
  removeBackground: vi.fn(async (blob: Blob, opts?: { signal?: AbortSignal }) => {
    state.active++
    state.maxActive = Math.max(state.maxActive, state.active)
    state.order.push(
      await new Promise<string>((resolve) => {
        const reader = new FileReader() // jsdom's Blob has no .text()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsText(blob)
      }),
    )
    await new Promise((r) => setTimeout(r, 5))
    state.active--
    if (opts?.signal?.aborted) throw Object.assign(new Error('x'), { code: 'cancelled' })
    if (state.fail) throw Object.assign(new Error('boom'), { code: state.fail.code })
    return { blob: new Blob(['CUTOUT'], { type: 'image/png' }), width: 4, height: 4, provider: 'wasm', quality: 'quality', durationMs: 5 }
  }),
}))

vi.mock('../backgroundRemoval/loadImageBlob', () => ({
  // The "image" is its own URL, typed as jpeg unless the URL says png.
  loadImageBlob: vi.fn(async (url: string) => new Blob([url], { type: url.endsWith('.png') ? 'image/png' : 'image/jpeg' })),
}))

vi.mock('../alphaVerification', () => ({
  // A real cutout is whatever carries the CUTOUT marker; the originals do not,
  // except one that is flagged as already transparent.
  verifyAlphaChannel: vi.fn(async (dataUrl: string) => {
    const text = atob(dataUrl.split(',')[1] || '')
    const transparent = text.includes('CUTOUT') || text.includes('already')
    return { hasTransparentPixels: transparent, transparentRatio: transparent ? 0.4 : 0 }
  }),
}))

import { removeAssetBackground, BackgroundRemovalFailure } from '../backgroundRemoval/backgroundRemovalClient'
import { loadImageBlob } from '../backgroundRemoval/loadImageBlob'
import { useAutoCutout, type AutoCutoutControls } from '../backgroundRemoval/useAutoCutout'
import { DiscoveredAssetGrid } from '../DiscoveredAssetGrid'

function asset(overrides: Partial<DiscoveredAsset>): DiscoveredAsset {
  return {
    id: 'a',
    previewUrl: 'https://shop.example/a.jpg',
    sourceUrl: 'https://shop.example/a.jpg',
    sourceType: 'WEBSITE',
    category: 'product',
    selected: false,
    recommended: false,
    rejected: false,
    assignedSection: null,
    autoAssigned: false,
    ...overrides,
  } as DiscoveredAsset
}

let root: Root | null = null
let container: HTMLDivElement | null = null
let latest: { assets: DiscoveredAsset[]; cutout: AutoCutoutControls }

let harnessDisabled = false
function Harness({ initial, paused }: { initial: DiscoveredAsset[]; paused?: boolean }) {
  const [assets, setAssets] = useState(initial)
  const cutout = useAutoCutout(assets, setAssets, { paused, disabled: harnessDisabled })
  latest = { assets, cutout }
  return null
}

async function mount(initial: DiscoveredAsset[], paused = false) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<Harness initial={initial} paused={paused} />)
  })
}

/** Waits for `done()` (or `ms` when there is nothing to wait for), flushing React each tick. */
async function settle(ms = 120, done?: () => boolean) {
  const start = Date.now()
  while (Date.now() - start < (done ? 4000 : ms)) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    if (done?.()) return
  }
  if (done) throw new Error('settle timed out')
}
const allDone = () => latest.assets.filter((a) => !a.rejected).every((a) => a.bgRemoval && a.bgRemoval.status !== 'running' && a.bgRemoval.status !== 'queued')

beforeEach(() => {
  harnessDisabled = false
  // BG0 decodes with createImageBitmap, which jsdom lacks; the hook stays idle without it.
  vi.stubGlobal('createImageBitmap', vi.fn())
  state.active = 0
  state.maxActive = 0
  state.order = []
  state.fail = null
  localStorage.clear()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

describe('removeAssetBackground (BG0 client)', () => {
  it('runs jobs strictly one at a time', async () => {
    const jobs = ['1', '2', '3'].map((n) => removeAssetBackground(new Blob([n], { type: 'image/png' })))
    const results = await Promise.all(jobs)
    expect(results.every((r) => r.blob.type === 'image/png')).toBe(true)
    expect(state.maxActive).toBe(1)
    expect(state.order).toEqual(['1', '2', '3'])
  })

  it('rejects unsupported formats and oversized files before loading the model', async () => {
    await expect(removeAssetBackground(new Blob(['x'], { type: 'image/gif' }))).rejects.toMatchObject({ code: 'unsupported-image' })
    const big = new Blob(['x'], { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 41 * 1024 * 1024 })
    await expect(removeAssetBackground(big)).rejects.toMatchObject({ code: 'image-too-large' })
    expect(state.order).toEqual([])
  })

  it('maps a failed model load to a reload-required failure and keeps the queue alive', async () => {
    state.fail = { code: 'model-load-failed' }
    const err = await removeAssetBackground(new Blob(['x'], { type: 'image/png' })).catch((e) => e)
    expect(err).toBeInstanceOf(BackgroundRemovalFailure)
    expect(err.needsReload).toBe(true)
    state.fail = null
    await expect(removeAssetBackground(new Blob(['y'], { type: 'image/png' }))).resolves.toBeTruthy()
  })

  it('does not start a job whose signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(removeAssetBackground(new Blob(['x'], { type: 'image/png' }), { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
    expect(state.order).toEqual([])
  })
})

describe('useAutoCutout (auto queue)', () => {
  it('removes the background of every found asset, best first, one at a time, keeping the original', async () => {
    await mount([
      asset({ id: 'plain', previewUrl: 'https://shop.example/plain.jpg' }),
      asset({ id: 'best', previewUrl: 'https://shop.example/best.jpg', recommended: true }),
      asset({ id: 'rejected', previewUrl: 'https://shop.example/rejected.jpg', rejected: true }),
    ])
    await settle(0, allDone)

    expect(state.order).toEqual(['https://shop.example/best.jpg', 'https://shop.example/plain.jpg'])
    expect(state.maxActive).toBe(1)
    const best = latest.assets.find((a) => a.id === 'best')!
    expect(best.editedDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(best.hasTransparency).toBe(true)
    expect(best.edited).toBe(true)
    expect(best.originalPreviewUrl).toBe('https://shop.example/best.jpg')
    expect(best.previewUrl).toBe('https://shop.example/best.jpg')
    expect(best.editMetadata).toMatchObject({ operation: 'remove_background', engine: 'bg0' })
    expect(best.bgRemoval?.status).toBe('done')
    // Rejected assets are never processed.
    expect(latest.assets.find((a) => a.id === 'rejected')!.bgRemoval).toBeUndefined()
  })

  it('leaves an already-transparent image alone', async () => {
    await mount([asset({ id: 'logo', previewUrl: 'https://shop.example/already.png', category: 'logo' })])
    await settle(0, allDone)
    const logo = latest.assets[0]
    expect(state.order).toEqual([])
    expect(logo.editedDataUrl).toBeUndefined()
    expect(logo.hasTransparency).toBe(true)
    expect(logo.bgRemoval).toMatchObject({ status: 'skipped', message: 'Transparent' })
  })

  it('does nothing automatically when auto mode is off, but still runs a manual request', async () => {
    localStorage.setItem('smartvideo.bgRemoval.auto', '0')
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await settle(80)
    expect(state.order).toEqual([])

    await act(async () => latest.cutout.requestRemoval(['one']))
    await settle(0, allDone)
    expect(state.order).toEqual(['https://shop.example/one.jpg'])
    expect(latest.assets[0].hasTransparency).toBe(true)
  })

  it('never re-processes an asset the user restored to its original', async () => {
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg', bgOptOut: true, bgRemoval: { status: 'idle' } })])
    await settle(120)
    expect(state.order).toEqual([])
  })

  it('Cancel really stops: nothing restarts, a manual request still works afterwards', async () => {
    await mount([
      asset({ id: 'a', previewUrl: 'https://shop.example/a.jpg', recommended: true }),
      asset({ id: 'b', previewUrl: 'https://shop.example/b.jpg' }),
    ])
    await act(async () => latest.cutout.cancelAll())
    await settle(400) // long enough for a restarted queue to have run
    expect(state.order.length).toBeLessThanOrEqual(1) // at most the job that was already in flight
    expect(latest.assets.every((a) => a.editedDataUrl === undefined || a.bgRemoval?.status === 'done')).toBe(true)
    expect(latest.assets.filter((a) => a.bgRemoval?.status === 'queued' || a.bgRemoval?.status === 'running')).toHaveLength(0)
    const processedBefore = state.order.length
    await settle(300)
    expect(state.order.length).toBe(processedBefore) // still nothing new started on its own

    await act(async () => latest.cutout.requestRemoval(['b']))
    await settle(0, () => latest.assets.find((a) => a.id === 'b')?.bgRemoval?.status === 'done')
    expect(latest.assets.find((a) => a.id === 'b')!.hasTransparency).toBe(true)
  })

  it('Cancel frees the queue even when an image download is stuck', async () => {
    // A host that never answers: the download only ends when the job's signal aborts.
    vi.mocked(loadImageBlob).mockImplementation((url: string, options?: { signal?: AbortSignal }) =>
      url.includes('stall')
        ? new Promise<Blob>((_, reject) => {
            options?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
          })
        : Promise.resolve(new Blob([url], { type: url.endsWith('.png') ? 'image/png' : 'image/jpeg' })),
    )
    await mount([
      asset({ id: 'stuck', previewUrl: 'https://slow.example/stall.jpg', recommended: true }),
      asset({ id: 'fine', previewUrl: 'https://shop.example/fine.jpg' }),
    ])
    await settle(200)
    expect(latest.assets.find((a) => a.id === 'stuck')!.bgRemoval?.status).toBe('running') // stuck in the download
    expect(state.order).toEqual([]) // and it holds the queue: 'fine' has not started

    await act(async () => latest.cutout.cancelAll())
    await settle(150)
    const stuck = latest.assets.find((a) => a.id === 'stuck')!
    expect(stuck.bgRemoval?.status).toBe('idle') // cancelled, not reported as an error
    await act(async () => latest.cutout.requestRemoval(['fine']))
    await settle(0, () => latest.assets.find((a) => a.id === 'fine')?.bgRemoval?.status === 'done')
    expect(state.order).toEqual(['https://shop.example/fine.jpg'])
  })

  it('records a failure on the asset (with retry) without blocking the others', async () => {
    state.fail = { code: 'inference-failed' }
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await settle(0, allDone)
    expect(latest.assets[0].bgRemoval).toMatchObject({ status: 'error' })
    expect(latest.assets[0].editedDataUrl).toBeUndefined()

    state.fail = null
    await act(async () => latest.cutout.retry('one'))
    await settle(0, allDone)
    expect(latest.assets[0].bgRemoval?.status).toBe('done')
  })

  it('holds the queue on a phone until the user accepts the model download', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile')
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await settle(120)
    expect(latest.cutout.needsConsent).toBe(true)
    expect(state.order).toEqual([])

    await act(async () => latest.cutout.grantConsent())
    await settle(0, allDone)
    expect(state.order).toEqual(['https://shop.example/one.jpg'])
    expect(localStorage.getItem('smartvideo.bgRemoval.consent')).toBe('granted')
  })

  it('declining the download switches auto mode off and downloads nothing', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) Mobile')
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await act(async () => latest.cutout.declineConsent())
    await settle(120)
    expect(state.order).toEqual([])
    expect(latest.cutout.autoEnabled).toBe(false)
  })

  it('pauses while assets are being imported', async () => {
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })], true)
    await settle(120)
    expect(state.order).toEqual([])
  })
})

describe('when the caller disables background removal (e.g. signed-out visitors)', () => {
  it('stays idle: nothing is fetched or processed, and nothing waits for cutouts', async () => {
    harnessDisabled = true
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await settle(150)
    expect(state.order).toEqual([])
    expect(latest.cutout.supported).toBe(false)
    expect(latest.cutout.willAutoCutOut).toBe(false)
    expect(latest.assets[0].bgRemoval).toBeUndefined()
  })
})

describe('browsers that cannot run background removal', () => {
  it('stay idle: no automatic processing, nothing waits for cutouts', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    await mount([asset({ id: 'one', previewUrl: 'https://shop.example/one.jpg' })])
    await settle(150)
    expect(state.order).toEqual([])
    expect(latest.cutout.supported).toBe(false)
    expect(latest.cutout.willAutoCutOut).toBe(false)
    expect(latest.cutout.needsConsent).toBe(false)
    expect(latest.cutout.stats.active).toBe(false)
    expect(latest.assets[0].bgRemoval).toBeUndefined()
  })
})

describe('DiscoveredAssetGrid with background removal', () => {
  function renderGrid(assets: DiscoveredAsset[], extra: Record<string, unknown> = {}) {
    const cutout: AutoCutoutControls = {
      autoEnabled: true,
      setAutoEnabled: vi.fn(),
      consent: 'granted',
      grantConsent: vi.fn(),
      declineConsent: vi.fn(),
      needsConsent: false,
      halted: false,
      willAutoCutOut: true,
      supported: true,
      stats: { total: 0, finished: 0, running: 0, queued: 0, failed: 0, active: false },
      modelMB: 192,
      requestRemoval: vi.fn(),
      retry: vi.fn(),
      toggleOriginal: vi.fn(),
      cancelAll: vi.fn(),
      ...(extra.cutout as object),
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const props = {
      assets,
      onToggle: vi.fn(),
      onRemove: vi.fn(),
      onCategoryChange: vi.fn(),
      onEdit: vi.fn(),
      onRevert: vi.fn(),
      cutout,
      onSaveToAssets: vi.fn(),
    }
    act(() => {
      root!.render(<DiscoveredAssetGrid {...props} />)
    })
    return { cutout, props }
  }

  const cutAsset = asset({
    id: 'cut',
    previewUrl: 'https://shop.example/cut.jpg',
    originalPreviewUrl: 'https://shop.example/cut.jpg',
    editedDataUrl: 'data:image/png;base64,Q1VUT1VU',
    edited: true,
    hasTransparency: true,
    videoReady: true,
    editMetadata: { operation: 'remove_background', engine: 'bg0' },
    bgRemoval: { status: 'done' },
  })

  it('shows the cutout by default and keeps every existing tile control', () => {
    renderGrid([cutAsset])
    const img = container!.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,Q1VUT1VU')
    expect(container!.querySelector('[aria-label="Edit discovered image"]')).not.toBeNull()
    // A cutout restores from the viewer / Original toggle; a tile Revert would overlap Edit with AI.
    expect(container!.querySelector('[aria-label="Revert to original"]')).toBeNull()
    expect(container!.querySelector('[aria-label="Show original"]')).not.toBeNull()
    expect(container!.querySelector('[aria-label="Change category"]')).not.toBeNull()
    expect(container!.querySelector('[aria-label="Remove"]')).not.toBeNull()
  })

  it('keeps the tile Revert for an asset edited with AI (not a BG0 cutout)', () => {
    renderGrid([asset({ id: 'ai', edited: true, editedDataUrl: 'data:image/png;base64,QQ==', originalPreviewUrl: 'https://shop.example/a.jpg', editMetadata: { operation: 'edit' } })])
    expect(container!.querySelector('[aria-label="Revert to original"]')).not.toBeNull()
  })

  it('toggles between cutout and original per tile', () => {
    const { cutout } = renderGrid([cutAsset])
    act(() => (container!.querySelector('[aria-label="Show original"]') as HTMLButtonElement).click())
    expect(cutout.toggleOriginal).toHaveBeenCalledWith('cut')

    act(() => root!.unmount())
    container!.remove()
    renderGrid([{ ...cutAsset, showOriginal: true }])
    expect((container!.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('https://shop.example/cut.jpg')
  })

  it('offers Remove BG on an untouched tile and a bulk action for the selection', () => {
    const { cutout } = renderGrid([asset({ id: 'raw', selected: true })])
    act(() => (container!.querySelector('[aria-label="Remove background"]') as HTMLButtonElement).click())
    expect(cutout.requestRemoval).toHaveBeenCalledWith(['raw'])

    const bulk = Array.from(container!.querySelectorAll('button')).find((b) => /Remove Background From Selected/.test(b.textContent || ''))
    expect(bulk).toBeTruthy()
    act(() => bulk!.click())
    expect(cutout.requestRemoval).toHaveBeenLastCalledWith(['raw'])
  })

  it('shows the model-download notice and the auto switch', () => {
    const { cutout } = renderGrid([asset({ id: 'raw' })], { cutout: { needsConsent: true } })
    expect(container!.textContent).toMatch(/192 MB/)
    act(() => (Array.from(container!.querySelectorAll('button')).find((b) => /Download/.test(b.textContent || '')) as HTMLButtonElement).click())
    expect(cutout.grantConsent).toHaveBeenCalled()
    act(() => (container!.querySelector('[role="switch"]') as HTMLButtonElement).click())
    expect(cutout.setAutoEnabled).toHaveBeenCalledWith(false)
  })

  it('opens the viewer with Before/After, Download Transparent PNG, Restore Original and Save to Assets', () => {
    const { props } = renderGrid([cutAsset])
    act(() => (container!.querySelector('[role="button"]') as HTMLElement).click())
    const text = () => document.body.textContent || ''
    expect(text()).toContain('Download Transparent PNG')
    expect(text()).toContain('Restore Original')
    expect(text()).toContain('Save to Assets')
    expect(text()).toContain('Edit with AI')

    const link = Array.from(document.querySelectorAll('a')).find((a) => /Download Transparent PNG/.test(a.textContent || '')) as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('bg-removed-cut.png')
    expect(link.getAttribute('href')).toBe('data:image/png;base64,Q1VUT1VU')

    act(() => (Array.from(document.querySelectorAll('button')).find((b) => /Before \/ After/.test(b.textContent || '')) as HTMLButtonElement).click())
    expect(document.querySelector('[data-testid="before-after-slider"]')).not.toBeNull()

    act(() => (Array.from(document.querySelectorAll('button')).find((b) => /Save to Assets/.test(b.textContent || '')) as HTMLButtonElement).click())
    expect(props.onSaveToAssets).toHaveBeenCalledWith('cut')
  })

  it('hides all background-removal controls when the browser cannot run it', () => {
    renderGrid([asset({ id: 'raw', selected: true })], { cutout: { supported: false } })
    expect(container!.querySelector('[data-testid="background-removal-bar"]')).toBeNull()
    expect(container!.querySelector('[aria-label="Remove background"]')).toBeNull()
  })

  it('saves an asset once even if Save to Assets is clicked repeatedly', () => {
    const { props } = renderGrid([cutAsset, asset({ id: 'other' })])
    act(() => (container!.querySelector('[role="button"]') as HTMLElement).click())
    const save = () => Array.from(document.querySelectorAll('button')).find((b) => /Save to Assets/.test(b.textContent || '')) as HTMLButtonElement
    act(() => save().click())
    expect(save().disabled).toBe(true)
    act(() => save().click())
    act(() => save().click())
    expect(props.onSaveToAssets).toHaveBeenCalledTimes(1)
    expect(props.onSaveToAssets).toHaveBeenCalledWith('cut')
  })

  it('renders exactly as before when background removal is not provided', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(
        <DiscoveredAssetGrid assets={[asset({ id: 'raw' })]} onToggle={vi.fn()} onRemove={vi.fn()} onCategoryChange={vi.fn()} />,
      )
    })
    expect(container.querySelector('[data-testid="background-removal-bar"]')).toBeNull()
    expect(container.querySelector('[aria-label="Remove background"]')).toBeNull()
  })
})
