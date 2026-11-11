// @vitest-environment jsdom
/**
 * Regression tests for defect I6 (Agent C):
 *   "Apply Local Edit does nothing on a discovered (remote, crawled)
 *    image because the canvas is tainted by a cross-origin image and
 *    toDataURL throws."
 *
 * Root cause: applyLocalAdjustments used to funnel every remote URL
 * through /api/personalization/download-image and then load the
 * resulting data URL. In jsdom / in browsers where the proxy route is
 * not reachable (or where an existing data URL had already been
 * substituted for the remote one), the code could end up handing a
 * raw cross-origin URL to <img src=...> without
 * crossOrigin='anonymous'. That taints the canvas and toDataURL
 * throws, so appendVersion is never reached and the user sees no
 * visible edit.
 *
 * Fix:
 *   1. loadImage() now sets img.crossOrigin = 'anonymous' for http(s)
 *      URLs (data: / blob: stay same-origin).
 *   2. applyLocalAdjustments first tries loadImage(displayUrl)
 *      directly. If it fails (CORS rejected by the remote host), it
 *      falls back to the existing same-origin
 *      /api/personalization/download-image proxy (which already
 *      enforces SSRF / private-IP / MIME / size / timeout) and then
 *      loadImage()s the data URL the proxy returns.
 *
 * No new endpoints, no security-control weakening.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

vi.mock('@ohb/shared/api/openaiImage', () => ({
  editImage: vi.fn(),
}))

vi.mock('../responsesVisionApi', () => ({
  responsesSmartEditStream: vi.fn(async (_params: any, _onPartial: any) => ({
    imageDataUrl: 'data:image/png;base64,RklOQUw=',
    responseId: 'resp_1',
    imageGenerationCallId: 'ig_1',
    revisedPrompt: 'Revised',
    model: _params.imageModel,
    outputFormat: _params.outputFormat,
    outputCompression: _params.outputCompression ?? null,
  })),
  analyzePersonalizationImages: vi.fn(async () => ({})),
  validatePersonalizationImageEdit: vi.fn(async () => ({ passed: true })),
}))

import ImageEditorModal from '../ImageEditorModal'

interface MockImageInstance {
  crossOrigin: string
  naturalWidth: number
  naturalHeight: number
  onload: ((this: MockImageInstance, ev?: Event) => unknown) | null
  onerror: ((this: MockImageInstance, ev?: Event) => unknown) | null
}

function makeMockImageCtor(opts: { remoteSucceeds: boolean }): { Ctor: new () => MockImageInstance; created: { src: string; crossOrigin: string }[] } {
  const created: { src: string; crossOrigin: string }[] = []
  class MockImage {
    crossOrigin = ''
    naturalWidth = 16
    naturalHeight = 16
    onload: ((ev?: Event) => unknown) | null = null
    onerror: ((ev?: Event) => unknown) | null = null
    private _src = ''
    get src() { return this._src }
    set src(value: string) {
      this._src = value
      created.push({ src: value, crossOrigin: this.crossOrigin })
      const isRemote = /^https?:\/\//i.test(value)
      queueMicrotask(() => {
        if (isRemote && !opts.remoteSucceeds) {
          this.onerror?.call(this)
        } else {
          this.onload?.call(this)
        }
      })
    }
  }
  return { Ctor: MockImage as unknown as new () => MockImageInstance, created }
}

function makeEditedDataUrl(): string {
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])
  return `data:image/png;base64,${pngBytes.toString('base64')}`
}

function installImageMock(opts: { remoteSucceeds: boolean }) {
  const { Ctor, created } = makeMockImageCtor(opts)
  ;(window as any).Image = Ctor
  return created
}

function installCanvasMock(dataUrl: string) {
  const toDataURLMock = vi.fn(() => dataUrl)
  HTMLCanvasElement.prototype.toDataURL = toDataURLMock as any
  const fakeCtx: any = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'filter' || prop === 'fillStyle' || prop === 'strokeStyle' ||
          prop === 'shadowColor' || prop === 'globalAlpha' || prop === 'textAlign' ||
          prop === 'textBaseline' || prop === 'lineWidth' || prop === 'font') return ''
      return () => undefined
    },
    set() { return true },
  })
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as any
  return { toDataURLMock }
}

function proxyFetchSpy(returnDataUrl: string) {
  const fetchMock = vi.fn(async (url: string, _options?: any) => {
    if (typeof url === 'string' && url.includes('/api/personalization/download-image')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          results: [{ url, dataUrl: returnDataUrl, ok: true }],
        }),
      } as any
    }
    return { ok: false, status: 404, json: async () => ({}) } as any
  })
  globalThis.fetch = fetchMock as any
  return fetchMock
}

function renderModal(imageUrl: string) {
  return render(
    <ImageEditorModal
      open
      asset={{
        id: 'disc-1',
        name: 'Discovered photo',
        imageUrl,
        originalImageUrl: imageUrl,
        category: 'product',
        source: 'discovered',
        businessName: 'Acme Roofing',
        industry: 'Roofing',
      }}
      onClose={vi.fn()}
      onApply={vi.fn()}
    />,
  )
}

async function clickApplyLocalEdit(container: HTMLElement) {
  const applyLocalBtn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Apply Local Edit',
  ) as HTMLButtonElement | undefined
  if (!applyLocalBtn) {
    throw new Error('Apply Local Edit button not found. Did the test forget to switch to Advanced mode and open the Local Canvas Tools details?')
  }
  await act(async () => {
    applyLocalBtn.click()
  })
}

async function openApplyLocalEdit(container: HTMLElement) {
  // Switch the modal from Simple -> Advanced, then open the "Local
  // Canvas Tools" <details> so the button is visible/interactable.
  const advancedBtn = Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent || '').includes('Advanced Edit'),
  ) as HTMLButtonElement | undefined
  if (!advancedBtn) throw new Error('Advanced Edit button not found')
  await act(async () => {
    advancedBtn.click()
  })

  const localCanvasDetails = Array.from(container.querySelectorAll('details')).find(
    (d) => d.querySelector('summary')?.textContent?.includes('Local Canvas Tools'),
  ) as HTMLDetailsElement | undefined
  if (!localCanvasDetails) throw new Error('Local Canvas Tools details not found')
  await act(async () => {
    localCanvasDetails.open = true
  })
}

describe('I6: ImageEditorModal local edit applies to cross-origin images', () => {
  let originalImage: typeof window.Image
  let originalFetch: typeof globalThis.fetch
  let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext

  beforeEach(() => {
    originalImage = window.Image
    originalFetch = globalThis.fetch
    originalToDataURL = HTMLCanvasElement.prototype.toDataURL
    originalGetContext = HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    ;(window as any).Image = originalImage
    globalThis.fetch = originalFetch
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL
    HTMLCanvasElement.prototype.getContext = originalGetContext
    vi.restoreAllMocks()
  })

  it('loads a same-origin (data:) image directly without calling the proxy', async () => {
    const dataUrl = 'data:image/png;base64,AA=='
    const created = installImageMock({ remoteSucceeds: true })
    const fetchMock = proxyFetchSpy('data:image/png;base64,SHOULD_NOT_BE_USED')
    const { toDataURLMock } = installCanvasMock(makeEditedDataUrl())

    const { container } = renderModal(dataUrl)
    await openApplyLocalEdit(container)
    await clickApplyLocalEdit(container)

    await waitFor(() => {
      expect(toDataURLMock).toHaveBeenCalled()
    })

    // Same-origin image was loaded directly; the proxy was NEVER called.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(created.length).toBeGreaterThanOrEqual(1)
    expect(created[0].src).toBe(dataUrl)
    expect(created[0].crossOrigin).toBe('')

    // The canvas produced a non-empty PNG data URL.
    const out = toDataURLMock.mock.results[0]?.value as string
    expect(out).toMatch(/^data:image\/png;base64,.+/)
    expect(out.length).toBeGreaterThan(40)
  })

  it('uses crossOrigin=anonymous for a remote URL but falls back to the proxy on CORS failure', async () => {
    const remoteUrl = 'https://acme-roofing.example/products/shingle.png'
    const proxyDataUrl = 'data:image/png;base64,proxy-resolved-content'
    const editedDataUrl = makeEditedDataUrl()
    const created = installImageMock({ remoteSucceeds: false })
    const fetchMock = proxyFetchSpy(proxyDataUrl)
    const { toDataURLMock } = installCanvasMock(editedDataUrl)

    const { container } = renderModal(remoteUrl)
    await openApplyLocalEdit(container)
    await clickApplyLocalEdit(container)

    await waitFor(() => {
      expect(toDataURLMock).toHaveBeenCalled()
    })

    expect(created.length).toBeGreaterThanOrEqual(2)
    // First attempt: remote URL with crossOrigin=anonymous.
    expect(created[0].src).toBe(remoteUrl)
    expect(created[0].crossOrigin).toBe('anonymous')
    // Second attempt: the data URL the proxy returned.
    expect(created[1].src).toBe(proxyDataUrl)
    expect(created[1].crossOrigin).toBe('')

    // The proxy WAS called and the local edit produced a data URL.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]
    expect(String(calledUrl)).toContain('/api/personalization/download-image')
    expect(JSON.parse(String(calledInit?.body)).urls).toEqual([remoteUrl])

    const out = toDataURLMock.mock.results[0]?.value as string
    expect(out).toBe(editedDataUrl)
    expect(out).toMatch(/^data:image\/png;base64,.+/)
    expect(out.length).toBeGreaterThan(40)
  })

  it('uses direct CORS load when the remote host sends permissive CORS headers', async () => {
    const remoteUrl = 'https://cdn.example.com/photo.jpg'
    const editedDataUrl = makeEditedDataUrl()
    const created = installImageMock({ remoteSucceeds: true })
    const fetchMock = proxyFetchSpy('data:image/png;base64,SHOULD_NOT_BE_USED')
    const { toDataURLMock } = installCanvasMock(editedDataUrl)

    const { container } = renderModal(remoteUrl)
    await openApplyLocalEdit(container)
    await clickApplyLocalEdit(container)

    await waitFor(() => {
      expect(toDataURLMock).toHaveBeenCalled()
    })

    // Direct CORS load succeeded -> proxy never used.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(created.length).toBeGreaterThanOrEqual(1)
    expect(created[0].src).toBe(remoteUrl)
    expect(created[0].crossOrigin).toBe('anonymous')

    const out = toDataURLMock.mock.results[0]?.value as string
    expect(out).toBe(editedDataUrl)
    expect(out).toMatch(/^data:image\/png;base64,.+/)
  })
})