import { describe, expect, it } from 'vitest'
import { CUTOUT_SCALE_MAX, CUTOUT_SCALE_MIN, DEFAULT_CUTOUT, cutoutForSave, normalizeCutout } from '../cutoutSettings'
import { normalizePreviewSettings } from '../../presets'

describe('normalizeCutout', () => {
  it('returns undefined when nothing was saved, so old projects are untouched', () => {
    expect(normalizeCutout(undefined)).toBeUndefined()
    expect(normalizeCutout('x')).toBeUndefined()
    expect(normalizePreviewSettings({}).cutout).toBeUndefined()
  })

  it('falls back to safe values for junk', () => {
    const c = normalizeCutout({ enabled: 'yes', background: { kind: 'nope' }, presenter: { scale: 'big', x: NaN }, edge: null })!
    expect(c.enabled).toBe(false)
    expect(c.background).toEqual(DEFAULT_CUTOUT.background)
    expect(c.presenter).toEqual(DEFAULT_CUTOUT.presenter)
    expect(c.edge).toEqual(DEFAULT_CUTOUT.edge)
  })

  it('clamps numbers into range', () => {
    const c = normalizeCutout({ enabled: true, presenter: { x: 9, y: -9, scale: 99, rotation: 999 }, edge: { feather: 5, shift: -5 } })!
    expect(c.enabled).toBe(true)
    expect(c.presenter).toEqual({ x: 1.5, y: -0.5, scale: CUTOUT_SCALE_MAX, rotation: 180 })
    expect(c.edge).toEqual({ feather: 1, shift: -1 })
    expect(normalizeCutout({ presenter: { scale: 0 } })!.presenter.scale).toBe(CUTOUT_SCALE_MIN)
  })

  it('keeps every background kind and rejects ones missing a url', () => {
    expect(normalizeCutout({ background: { kind: 'none' } })!.background).toEqual({ kind: 'none' })
    expect(normalizeCutout({ background: { kind: 'color', color: '#fff' } })!.background).toEqual({ kind: 'color', color: '#fff' })
    expect(normalizeCutout({ background: { kind: 'image', url: 'https://a/b.png' } })!.background).toEqual({ kind: 'image', url: 'https://a/b.png' })
    expect(normalizeCutout({ background: { kind: 'video', url: 'https://a/b.mp4' } })!.background).toEqual({ kind: 'video', url: 'https://a/b.mp4' })
    expect(normalizeCutout({ background: { kind: 'image' } })!.background).toEqual(DEFAULT_CUTOUT.background)
    expect(normalizeCutout({ background: { kind: 'blur', amount: 999 } })!.background).toEqual({ kind: 'blur', amount: 60 })
  })

  it('survives normalizePreviewSettings', () => {
    const out = normalizePreviewSettings({ cutout: { enabled: true, background: { kind: 'color', color: '#123456' } } })
    expect(out.cutout?.enabled).toBe(true)
    expect(out.cutout?.background).toEqual({ kind: 'color', color: '#123456' })
  })
})

describe('cutoutForSave', () => {
  it('swaps session-only backgrounds for a color but keeps durable ones', () => {
    const base = { ...DEFAULT_CUTOUT, enabled: true }
    expect(cutoutForSave({ ...base, background: { kind: 'image', url: 'blob:abc' } })!.background.kind).toBe('color')
    expect(cutoutForSave({ ...base, background: { kind: 'video', url: 'data:video/mp4;base64,AAA' } })!.background.kind).toBe('color')
    const durable = { ...base, background: { kind: 'image', url: 'https://cdn/x.png' } as const }
    expect(cutoutForSave(durable)).toBe(durable)
    expect(cutoutForSave(undefined)).toBeUndefined()
  })
})
