import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGainWithCeiling, clampVoiceParams, encodeWav, VOICE_CLARITY } from '../audioProcess'
import { buildCopyPrompt, builtInAIStatus, generateCopyOnDevice, groundedOnly } from '../builtInAI'
import { coverMapBox, nativeFaceDetectorAvailable, unionFaceZone } from '../faceZones'
import { normalizeCutout } from '../../preview/cutout/cutoutSettings'

afterEach(() => { delete (globalThis as { LanguageModel?: unknown }).LanguageModel; delete (globalThis as { FaceDetector?: unknown }).FaceDetector })

describe('voice processing helpers', () => {
  it('writes a valid mono 16-bit WAV', async () => {
    const blob = encodeWav(Float32Array.from([0, 0.5, -0.5, 1, -1, 2]), 8000)
    const buf = await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(blob) })
    const v = new DataView(buf)
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
    expect([tag(0), tag(8), tag(36)]).toEqual(['RIFF', 'WAVE', 'data'])
    expect(v.getUint16(22, true)).toBe(1); expect(v.getUint32(24, true)).toBe(8000); expect(v.getUint16(34, true)).toBe(16)
    expect(blob.size).toBe(44 + 12)
    expect(v.getInt16(44 + 3 * 2, true)).toBe(32767); expect(v.getInt16(44 + 5 * 2, true)).toBe(32767) // clipped input is clamped, not wrapped
  })
  it('boosts a quiet clip but never past the ceiling', () => {
    const quiet = Float32Array.from([0.05, -0.05, 0.02])
    const { gain } = applyGainWithCeiling(quiet, 100, -1)
    expect(Math.max(...quiet.map(Math.abs))).toBeCloseTo(Math.pow(10, -1 / 20), 4)
    expect(gain).toBeLessThan(100)
    const loud = Float32Array.from([0.5, -0.5]); applyGainWithCeiling(loud, 0.5, -1)
    expect(loud[0]).toBeCloseTo(0.25)
  })
  it('keeps every parameter inside a safe range', () => {
    const p = clampVoiceParams({ highpassHz: 9999, ratio: -3, presenceDb: NaN, targetLufs: 0 })
    expect(p.highpassHz).toBe(300); expect(p.ratio).toBe(1); expect(p.presenceDb).toBe(VOICE_CLARITY.presenceDb); expect(p.targetLufs).toBe(-10)
  })
})

describe('built-in browser AI', () => {
  const facts = { businessName: 'Sunny Dental', industry: 'Dentist', location: 'Austin, TX', phone: '555-0100' }
  it('drops lines that add figures or claims that are not in the facts, keeps phone numbers that are', () => {
    const { kept, rejected } = groundedOnly(['1. Your smile, our care', '- 50% off whitening', 'Free checkups for all', 'Call 555-0100 today', 'Best dentist in town', '"Sunny Dental in Austin"'], facts)
    expect(kept).toEqual(['Your smile, our care', 'Call 555-0100 today', 'Sunny Dental in Austin'])
    expect(rejected).toBe(3)
  })
  it('allows a claim only when the customer supplied it', () => {
    expect(groundedOnly(['Free first visit'], { ...facts, offer: 'Free first visit' }).kept).toEqual(['Free first visit'])
  })
  it('puts only the supplied facts in the prompt', () => {
    const p = buildCopyPrompt('headline', facts)
    expect(p).toContain('Sunny Dental'); expect(p).not.toMatch(/Website:|Existing offer:/); expect(p).toMatch(/Do not mention prices/)
  })
  it('reports unsupported without a LanguageModel and the browser status when present', async () => {
    expect(await builtInAIStatus()).toBe('unsupported')
    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: async () => 'downloadable', create: vi.fn() }
    expect(await builtInAIStatus()).toBe('downloadable')
  })
  it('generates through the browser model and filters the output; destroys the session', async () => {
    const destroy = vi.fn()
    const create = vi.fn(async () => ({ prompt: async () => 'Smiles made simple\n20% off this week\nTrusted care in Austin', destroy }))
    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: async () => 'available', create }
    const r = await generateCopyOnDevice('headline', facts)
    expect(r.lines).toEqual(['Smiles made simple', 'Trusted care in Austin']); expect(r.rejected).toBe(1); expect(destroy).toHaveBeenCalled()
  })
  it('fails plainly with no built-in AI instead of calling anything else', async () => {
    await expect(generateCopyOnDevice('cta', facts)).rejects.toThrow(/no built-in/)
  })
})

describe('face zones', () => {
  it('maps a face in a 16:9 source onto a 9:16 cover crop, and clips faces outside it', () => {
    const centre = coverMapBox({ x: 0.45, y: 0.3, w: 0.1, h: 0.2 }, 1920, 1080, 1080, 1920)
    expect(centre.x).toBeGreaterThan(0.3); expect(centre.x + centre.w).toBeLessThan(0.7)
    const edge = coverMapBox({ x: 0.0, y: 0.3, w: 0.1, h: 0.2 }, 1920, 1080, 1080, 1920)
    expect(edge.x + edge.w).toBeLessThan(0) // fully cropped out of the portrait frame
  })
  it('unions faces with padding inside the frame, and returns null for none', () => {
    const z = unionFaceZone([{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { x: 0.6, y: 0.2, w: 0.2, h: 0.2 }])!
    expect(z.x).toBeLessThan(0.1); expect(z.x + z.w).toBeGreaterThan(0.8); expect(z.x + z.w).toBeLessThanOrEqual(1)
    expect(unionFaceZone([])).toBeNull()
  })
  it('detects the native detector only when it exists', () => {
    expect(nativeFaceDetectorAvailable()).toBe(false)
    ;(globalThis as { FaceDetector?: unknown }).FaceDetector = class {}
    expect(nativeFaceDetectorAvailable()).toBe(true)
  })
})

describe('cutout gradient and shadow settings', () => {
  it('round-trips a gradient and clamps its angle; shadow is omitted when zero', () => {
    const c = normalizeCutout({ enabled: true, background: { kind: 'gradient', from: '#000', to: '#fff', angle: 999 }, presenter: {}, edge: { feather: 0.2, shift: 0, shadow: 0 } })!
    expect(c.background).toEqual({ kind: 'gradient', from: '#000', to: '#fff', angle: 360 })
    expect('shadow' in c.edge).toBe(false)
    expect(normalizeCutout({ enabled: true, background: { kind: 'color', color: '#111' }, edge: { shadow: 0.5 } })!.edge.shadow).toBe(0.5)
  })
  it('falls back safely on a broken gradient', () => {
    const c = normalizeCutout({ enabled: true, background: { kind: 'gradient' } })!
    expect(c.background.kind).toBe('gradient')
  })
})
