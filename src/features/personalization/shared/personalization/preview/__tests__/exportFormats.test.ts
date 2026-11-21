import { describe, it, expect, vi } from 'vitest'
import { EXPORT_FORMATS, exportFormats, formatFileSuffix, settingsForAspect } from '../exportFormats'
import { createDefaultPreviewSettings } from '../presets'
import type { PreviewInputProps } from '../types'
import type { WebExportResult } from '../../webExport'

const input = (): PreviewInputProps => ({ settings: createDefaultPreviewSettings() } as PreviewInputProps)
const ok = (): WebExportResult => ({ ok: true, blob: new Blob(['x']), mimeType: 'video/mp4', extension: 'mp4', warning: null })

describe('settingsForAspect', () => {
  it('returns the same object for the current shape', () => {
    const s = createDefaultPreviewSettings()
    expect(settingsForAspect(s, s.aspectRatio)).toBe(s)
  })
  it('sets the frame size for each shape and never mutates the source', () => {
    const s = createDefaultPreviewSettings()
    const before = JSON.stringify(s)
    expect(settingsForAspect(s, '9:16')).toMatchObject({ aspectRatio: '9:16', width: 1080, height: 1920 })
    expect(settingsForAspect(s, '1:1')).toMatchObject({ width: 1080, height: 1080 })
    expect(settingsForAspect(s, '4:5')).toMatchObject({ width: 1080, height: 1350 })
    expect(JSON.stringify(s)).toBe(before)
  })
  it('keeps the same layers (ids, text) in every shape', () => {
    const s = createDefaultPreviewSettings()
    expect(settingsForAspect(s, '9:16').layers.map((l) => l.id)).toEqual(s.layers.map((l) => l.id))
  })
})

describe('formats', () => {
  it('lists the four shapes and makes file-safe suffixes', () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(['9:16', '1:1', '4:5', '16:9'])
    expect(formatFileSuffix('9:16')).toBe('9x16')
  })
})

describe('exportFormats keeps burned-in captions', () => {
  it('carries the captions into every extra shape, so they are drawn in each exported file', async () => {
    const captions = { enabled: true, forUrl: 'https://x/clip.mp4', style: 'bold' as const, position: 'bottom' as const, cues: [{ startMs: 0, endMs: 900, text: 'Hi' }] }
    const seen: unknown[] = []
    const exporter = vi.fn(async (o: any) => { seen.push(o.inputProps.settings.captions); return ok() })
    const props = { settings: { ...createDefaultPreviewSettings(), captions } } as unknown as PreviewInputProps
    await exportFormats({ inputProps: props, aspects: ['9:16', '1:1'], exporter })
    expect(seen).toEqual([captions, captions])
    expect(settingsForAspect(props.settings, '9:16').captions).toEqual(captions)
  })
})

describe('exportFormats luma samples', () => {
  const sample = [{ t: 1, cols: 2, rows: 2, luma: [0, 0, 0, 0] }]
  it('keeps the footage brightness samples only for a frame of the same size', async () => {
    const seen: Record<string, boolean> = {}
    const exporter = vi.fn(async (o: any) => { seen[o.inputProps.settings.aspectRatio] = 'lumaSamples' in o.inputProps; return ok() })
    const props = { settings: createDefaultPreviewSettings(), lumaSamples: sample } as unknown as PreviewInputProps
    await exportFormats({ inputProps: props, aspects: ['16:9', '9:16', '1:1'], exporter })
    expect(seen).toEqual({ '16:9': true, '9:16': false, '1:1': false })
  })
})

describe('exportFormats', () => {
  it('renders each shape once, in order, with the right frame size, and reports overall progress', async () => {
    const sizes: string[] = []
    const exporter = vi.fn(async (o: any) => { sizes.push(`${o.inputProps.settings.width}x${o.inputProps.settings.height}`); o.onProgress?.(0.5); o.onProgress?.(1); return ok() })
    const progress: number[] = []
    const files: string[] = []
    const res = await exportFormats({ inputProps: input(), aspects: ['9:16', '1:1', '9:16'], exporter, onProgress: (p) => progress.push(p), onFile: (a) => files.push(a) })
    expect(res.map((r) => r.aspect)).toEqual(['9:16', '1:1'])
    expect(sizes).toEqual(['1080x1920', '1080x1080'])
    expect(files).toEqual(['9:16', '1:1'])
    expect(progress[progress.length - 1]).toBe(1)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })
  it('keeps going after one shape fails', async () => {
    const exporter = vi.fn()
      .mockResolvedValueOnce({ ok: false, reason: 'render-failed', error: 'boom' })
      .mockResolvedValueOnce(ok())
    const res = await exportFormats({ inputProps: input(), aspects: ['9:16', '1:1'], exporter })
    expect(res.map((r) => r.result.ok)).toEqual([false, true])
  })
  it('stops everything on cancel', async () => {
    const exporter = vi.fn().mockResolvedValue({ ok: false, reason: 'cancelled', error: 'x' })
    const res = await exportFormats({ inputProps: input(), aspects: ['9:16', '1:1', '4:5'], exporter })
    expect(exporter).toHaveBeenCalledTimes(1)
    expect(res).toHaveLength(1)
  })
  it('stops on a busy renderer instead of trying every remaining shape', async () => {
    const exporter = vi.fn().mockResolvedValue({ ok: false, reason: 'busy', error: 'busy' })
    const res = await exportFormats({ inputProps: input(), aspects: ['9:16', '1:1', '4:5'], exporter })
    expect(exporter).toHaveBeenCalledTimes(1)
    expect(res).toHaveLength(1)
  })
  it('does not start when already aborted', async () => {
    const exporter = vi.fn()
    const ac = new AbortController(); ac.abort()
    const res = await exportFormats({ inputProps: input(), aspects: ['9:16'], exporter, signal: ac.signal })
    expect(exporter).not.toHaveBeenCalled()
    expect(res[0].result).toMatchObject({ ok: false, reason: 'cancelled' })
  })
})
