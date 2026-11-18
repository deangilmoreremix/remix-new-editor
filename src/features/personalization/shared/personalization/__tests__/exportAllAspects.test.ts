import { describe, expect, it, vi } from 'vitest'
import { ALL_ASPECT_RATIOS, exportAllAspects, settingsForAspect } from '../exportAllAspects'
import { createDefaultPreviewSettings } from '../preview/presets'
import type { PreviewInputProps } from '../preview/types'
import type { WebExportResult } from '../webExport'

const props = (): PreviewInputProps => ({
  videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null,
  settings: createDefaultPreviewSettings(),
  brand: { businessName: 'Joe', headline: '', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
})
const ok = (): WebExportResult => ({ ok: true, blob: new Blob(['x']), mimeType: 'video/mp4', extension: 'mp4', warning: null })

describe('settingsForAspect', () => {
  it('re-dimensions for the target shape and leaves the original untouched', () => {
    const base = createDefaultPreviewSettings()
    const tall = settingsForAspect(base, '9:16')
    expect(tall.aspectRatio).toBe('9:16')
    expect(tall.height).toBeGreaterThan(tall.width)
    expect(base.aspectRatio).toBe('16:9')
    expect(settingsForAspect(base, '16:9')).toBe(base)
  })
})

describe('exportAllAspects', () => {
  it('exports every shape once, in order, with the right dimensions', async () => {
    const seen: string[] = []
    const out = await exportAllAspects({ inputProps: props(), exportOne: async (p) => { seen.push(`${p.settings.aspectRatio}:${p.settings.width}x${p.settings.height}`); return ok() } })
    expect(out.map((o) => o.aspect)).toEqual([...ALL_ASPECT_RATIOS])
    expect(new Set(seen).size).toBe(4)
    expect(seen[1].startsWith('9:16')).toBe(true)
  })
  it('one failure does not stop the other shapes', async () => {
    let n = 0
    const out = await exportAllAspects({ inputProps: props(), exportOne: async () => (++n === 2 ? { ok: false, reason: 'render-failed', error: 'boom' } as WebExportResult : ok()) })
    expect(out.map((o) => o.result.ok)).toEqual([true, false, true, true])
  })
  it('a cancelled render ends the run; an aborted signal never starts', async () => {
    let n = 0
    const out = await exportAllAspects({ inputProps: props(), exportOne: async () => (++n === 2 ? { ok: false, reason: 'cancelled', error: 'c' } as WebExportResult : ok()) })
    expect(out).toHaveLength(2)
    const ctl = new AbortController(); ctl.abort()
    const exportOne = vi.fn()
    expect(await exportAllAspects({ inputProps: props(), exportOne, signal: ctl.signal })).toEqual([])
    expect(exportOne).not.toHaveBeenCalled()
  })
  it('delivers each file as soon as it is ready', async () => {
    const got: string[] = []
    await exportAllAspects({ inputProps: props(), aspects: ['1:1', '4:5'], exportOne: async () => ok(), onResult: (o) => got.push(o.aspect) })
    expect(got).toEqual(['1:1', '4:5'])
  })
})
