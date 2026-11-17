// @vitest-environment jsdom
/**
 * One render at a time. The browser renderer and the module's single "active render" controller are shared, so a
 * second render started while the first is running (or still settling after a cancel) must be refused, not allowed to
 * overwrite the controller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CANCEL_SETTLE_GRACE_MS, cancelActiveExport, exportPersonalizedVideo, isExportActive, resetActiveExport } from '../webExport'
import { audioCodecPresets, makeInputProps, makeStubBlob, videoCodecPresets } from './_webRendererHarness'

const mocks = vi.hoisted(() => ({
  canRenderMediaOnWeb: vi.fn(),
  renderMediaOnWeb: vi.fn(),
  getEncodableVideoCodecs: vi.fn(),
  getEncodableAudioCodecs: vi.fn(),
}))
vi.mock('@remotion/web-renderer', () => ({
  canRenderMediaOnWeb: mocks.canRenderMediaOnWeb,
  renderMediaOnWeb: mocks.renderMediaOnWeb,
  getEncodableVideoCodecs: mocks.getEncodableVideoCodecs,
  getEncodableAudioCodecs: mocks.getEncodableAudioCodecs,
}))

beforeEach(() => {
  resetActiveExport()
  vi.clearAllMocks()
  mocks.getEncodableVideoCodecs.mockImplementation(videoCodecPresets.full)
  mocks.getEncodableAudioCodecs.mockImplementation(audioCodecPresets.full)
  mocks.canRenderMediaOnWeb.mockResolvedValue({ canRender: true, issues: [] as unknown[] })
})

/** A render that stays "in flight" until `settle()` is called, and honours the abort signal like the real one. */
function slowRender() {
  let settle!: () => void
  mocks.renderMediaOnWeb.mockImplementation(({ signal }: { signal: AbortSignal }) =>
    new Promise((resolve, reject) => {
      settle = () => resolve({ getBlob: async () => makeStubBlob() })
      signal.addEventListener('abort', () => setTimeout(() => reject(new Error('aborted')), 0), { once: true })
    }),
  )
  return { settle: () => settle() }
}
const flush = () => new Promise((r) => setTimeout(r, 20))

describe('one render at a time', () => {
  it('refuses a second render while the first is running, and leaves the first untouched', async () => {
    const gate = slowRender()
    const first = exportPersonalizedVideo({ inputProps: makeInputProps() })
    await flush()
    expect(isExportActive()).toBe(true)
    const second = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(second).toMatchObject({ ok: false, reason: 'busy' })
    expect(mocks.renderMediaOnWeb).toHaveBeenCalledTimes(1)
    gate.settle()
    expect((await first).ok).toBe(true)
    expect(isExportActive()).toBe(false)
  })

  it('still counts as busy after a cancel until the cancelled render has settled', async () => {
    slowRender()
    const first = exportPersonalizedVideo({ inputProps: makeInputProps() })
    await flush()
    expect(cancelActiveExport()).toBe(true)
    // the abort was requested but the renderer has not finished unwinding yet
    const second = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(second).toMatchObject({ ok: false, reason: 'busy' })
    expect(await first).toMatchObject({ ok: false, reason: 'cancelled' })
  })

  it('accepts a new render once the previous one has settled', async () => {
    const gate = slowRender()
    const first = exportPersonalizedVideo({ inputProps: makeInputProps() })
    await flush()
    gate.settle()
    await first
    mocks.renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => makeStubBlob() }))
    expect((await exportPersonalizedVideo({ inputProps: makeInputProps() })).ok).toBe(true)
  })
})

describe('a renderer that never settles after a cancel', () => {
  it('does not block later renders forever: they are refused only for the grace period', async () => {
    // a renderer that ignores the abort signal entirely
    mocks.renderMediaOnWeb.mockImplementationOnce(() => new Promise(() => {}))
    void exportPersonalizedVideo({ inputProps: makeInputProps() })
    await flush()
    const now = Date.now()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(cancelActiveExport()).toBe(true)
    expect(await exportPersonalizedVideo({ inputProps: makeInputProps() })).toMatchObject({ ok: false, reason: 'busy' })
    // ...but once the grace period has passed, a new render is allowed to start
    spy.mockReturnValue(now + CANCEL_SETTLE_GRACE_MS + 1)
    mocks.renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => makeStubBlob() }))
    expect((await exportPersonalizedVideo({ inputProps: makeInputProps() })).ok).toBe(true)
    spy.mockRestore()
  })
})
