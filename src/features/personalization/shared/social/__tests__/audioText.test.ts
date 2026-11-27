import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_AUDIO, AUDIO_PRESETS, clampSettings, isUnchanged, dbToGain, buildAudioChain, renderAudio, peaks, peakDb, rmsDb, levelAdvice, audioBufferToWav, makeAudioReplacer, decodeFileAudio } from '../audioTools'
import { textFrame, toKeyframes, wrapLines, drawTextOverlay, defaultOverlay, easeOutBack, easeOutBounce, TEXT_PRESETS, type TextPreset } from '../animatedText'
import { processVideo, MediaUnsupportedError } from '../mediaProcessing'

// --- a recording fake of the Web Audio pieces we use ---
const fakeCtx = () => {
  const log: any[] = []
  const param = (name: string) => ({ value: 0, setValueAtTime: (...a: any[]) => log.push([name, 'set', ...a]), linearRampToValueAtTime: (...a: any[]) => log.push([name, 'ramp', ...a]) })
  const node = (kind: string) => ({ kind, connect(n: any) { log.push(['connect', kind, n.kind ?? 'dest']); return n }, type: '', frequency: param('freq'), gain: param('gain'), Q: param('q'), threshold: param('th'), ratio: param('ratio'), knee: param('knee'), attack: param('attack'), release: param('release') })
  const ctx: any = { currentTime: 0, createGain: () => node('gain'), createBiquadFilter: () => node('biquad'), createDynamicsCompressor: () => node('compressor') }
  return { ctx, log, node }
}

describe('audio settings', () => {
  it('clamps to safe ranges and keeps fades inside the clip', () => {
    const s = clampSettings({ gainDb: 99, lowDb: -50, highpassHz: 5000, fadeInSec: 8, fadeOutSec: 8, ratio: 100, thresholdDb: 10 }, 10)
    expect(s).toMatchObject({ gainDb: 18, lowDb: -12, highpassHz: 400, ratio: 20, thresholdDb: 0 })
    expect(s.fadeInSec + s.fadeOutSec).toBeLessThanOrEqual(10)
    expect(clampSettings({ highpassHz: 0 }, 5).highpassHz).toBe(0)
    expect(clampSettings({ gainDb: NaN as any }, 5).gainDb).toBe(-30)
  })
  it('knows when nothing was changed, and presets are valid', () => {
    expect(isUnchanged(DEFAULT_AUDIO)).toBe(true)
    expect(isUnchanged({ ...DEFAULT_AUDIO, gainDb: 3 })).toBe(false)
    for (const p of Object.values(AUDIO_PRESETS)) expect(() => clampSettings(p.settings, 30)).not.toThrow()
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(6)).toBeCloseTo(1.995, 2)
  })
})

describe('Web Audio chain', () => {
  it('builds only the stages that are on, in order, and ends at the fade gain', () => {
    const { ctx, log, node } = fakeCtx()
    const input: any = node('input')
    buildAudioChain(ctx, input, { ...DEFAULT_AUDIO, highpassHz: 100, lowDb: 3, highDb: 2, compressor: true }, 10)
    const order = log.filter((l) => l[0] === 'connect').map((l) => l[2])
    expect(order).toEqual(['biquad', 'biquad', 'biquad', 'compressor', 'gain']) // highpass, low shelf, high shelf (mid is 0 dB so skipped), compressor, gain
  })
  it('applies volume and schedules fade in/out on the gain', () => {
    const { ctx, log, node } = fakeCtx()
    const { gain } = buildAudioChain(ctx, node('input') as any, { ...DEFAULT_AUDIO, gainDb: 6, fadeInSec: 1, fadeOutSec: 2 }, 10)
    expect((gain as any).gain.value).toBeCloseTo(dbToGain(6), 4)
    const g = log.filter((l) => l[0] === 'gain')
    expect(g).toEqual([['gain', 'set', 0, 0], ['gain', 'ramp', expect.closeTo(dbToGain(6), 4), 1], ['gain', 'set', expect.closeTo(dbToGain(6), 4), 8], ['gain', 'ramp', 0, 10]])
  })
  it('does not schedule fades for a live (unbounded) preview', () => {
    const { ctx, log, node } = fakeCtx()
    buildAudioChain(ctx, node('input') as any, { ...DEFAULT_AUDIO, fadeInSec: 1, fadeOutSec: 1 }, Infinity)
    expect(log.filter((l) => l[0] === 'gain')).toEqual([])
  })
  it('renders offline through the chain and reports a browser without Web Audio', async () => {
    const out = { duration: 2 }
    class Offline { destination = { kind: 'dest' }; constructor(public ch: number, public len: number, public rate: number) {} createGain() { return fakeCtx().ctx.createGain() } createBiquadFilter() { return fakeCtx().ctx.createBiquadFilter() } createDynamicsCompressor() { return fakeCtx().ctx.createDynamicsCompressor() } createBufferSource() { return { kind: 'src', connect: (n: any) => n, start: vi.fn() } } startRendering() { return Promise.resolve(out) } }
    const buf: any = { numberOfChannels: 2, length: 96000, sampleRate: 48000, duration: 2 }
    expect(await renderAudio(buf, { ...DEFAULT_AUDIO, gainDb: 3 }, Offline as any)).toBe(out)
    await expect(renderAudio(buf, DEFAULT_AUDIO, undefined as any)).rejects.toThrow(/Web Audio is missing/)
  })
  it('explains a file the browser cannot decode', async () => {
    class Ctx { decodeAudioData() { return Promise.reject(new Error('x')) } close() { return Promise.resolve() } }
    await expect(decodeFileAudio(new Blob(['x']), Ctx)).rejects.toThrow(/could not read an audio track/)
    await expect(decodeFileAudio(new Blob(['x']), null)).rejects.toThrow(/Web Audio is missing/)
  })
})

describe('waveform, levels, WAV', () => {
  it('computes peaks per slice and dB levels', () => {
    const x = new Float32Array([0, 0.5, -1, 0.25, 0, 0, 0.1, -0.1])
    const pk = peaks(x, 4)
    expect(pk.slice(0, 3)).toEqual([0.5, 1, 0])
    expect(pk[3]).toBeCloseTo(0.1, 5)
    expect(peaks(new Float32Array(0), 3)).toEqual([0, 0, 0])
    expect(peakDb(new Float32Array([1]))).toBeCloseTo(0, 5)
    expect(peakDb(new Float32Array([0.5]))).toBeCloseTo(-6.02, 1)
    expect(rmsDb(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(-6.02, 1)
    expect(rmsDb(new Float32Array(0))).toBe(-120)
  })
  it('gives plain advice', () => {
    expect(levelAdvice(0, -12)).toMatch(/distort/)
    expect(levelAdvice(-10, -40)).toMatch(/very quiet/)
    expect(levelAdvice(-3, -6)).toMatch(/very loud/)
    expect(levelAdvice(-6, -18)).toMatch(/healthy/)
  })
  it('writes a valid 16-bit PCM WAV', async () => {
    const wav = audioBufferToWav({ numberOfChannels: 1, sampleRate: 8000, length: 3, getChannelData: () => new Float32Array([0, 1, -1]) })
    expect(wav.type).toBe('audio/wav')
    const buf: ArrayBuffer = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(wav) })
    const v = new DataView(buf)
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(v.getUint32(24, true)).toBe(8000)
    expect(v.getUint32(40, true)).toBe(6)
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)]).toEqual([0, 32767, -32768])
  })
})

describe('replacing a video\'s audio (mediabunny hook)', () => {
  it('drops the original samples, emits the rendered audio exactly once at t=0, and releases inputs', () => {
    const from = vi.fn(() => ['rendered'])
    const replace = makeAudioReplacer({ duration: 1 } as any, from)
    const close = vi.fn()
    expect(replace({ close })).toEqual(['rendered'])
    expect(replace({ close })).toBeNull()
    expect(replace({ close })).toBeNull()
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith({ duration: 1 }, 0)
    expect(close).toHaveBeenCalledTimes(3)
  })
  it('refuses to combine new audio with trimming (and says what to do), and still needs WebCodecs', async () => {
    const orig = (globalThis as any).VideoEncoder
    ;(globalThis as any).VideoEncoder = function () {}; (globalThis as any).VideoDecoder = function () {}
    await expect(processVideo({ file: new Blob(['x']), audioBuffer: {} as any, trim: { start: 0, end: 2 } })).rejects.toThrow(/two separate steps/)
    delete (globalThis as any).VideoEncoder; delete (globalThis as any).VideoDecoder
    await expect(processVideo({ file: new Blob(['x']), audioBuffer: {} as any })).rejects.toBeInstanceOf(MediaUnsupportedError)
    ;(globalThis as any).VideoEncoder = orig
  })
})

describe('animated text', () => {
  const all = TEXT_PRESETS.map((p) => p.id)
  it('every preset is hidden outside its time range and visible inside it', () => {
    for (const p of all) {
      expect(textFrame(p, -0.1, 3).opacity).toBe(0)
      expect(textFrame(p, 3.1, 3).opacity).toBe(0)
      expect(textFrame(p, 1.5, 3, { length: 10 }).opacity).toBeGreaterThan(0.99)
      expect(textFrame(p, 0, 0).opacity).toBe(0) // zero duration shows nothing
    }
  })
  it('every preset fades out at the end', () => {
    for (const p of all) expect(textFrame(p, 3, 3).opacity).toBe(0)
  })
  it('each preset moves the property it is named for', () => {
    const at = (p: TextPreset, t: number) => textFrame(p, t, 3, { length: 20 })
    expect(at('fade', 0.1).opacity).toBeLessThan(at('fade', 0.4).opacity)
    expect(at('slide', 0).dy).toBeGreaterThan(0)
    expect(at('slide', 1.5).dy).toBe(0)
    expect(at('scale', 0).scale).toBeCloseTo(0.6)
    expect(at('scale', 1.5).scale).toBe(1)
    expect(Math.max(...[0.1, 0.2, 0.3, 0.4].map((t) => at('pop', t).scale))).toBeGreaterThan(1) // overshoot
    expect(at('typewriter', 0.2).chars).toBeLessThan(at('typewriter', 0.8).chars)
    expect(at('typewriter', 2).chars).toBe(1)
    expect(at('bounce', 0).dy).toBeLessThan(0)
    expect(at('reveal', 0.1).reveal).toBeLessThan(at('reveal', 0.4).reveal)
    expect(at('reveal', 2).reveal).toBe(1)
  })
  it('easings hit their endpoints', () => {
    expect(easeOutBack(0)).toBeCloseTo(0); expect(easeOutBack(1)).toBeCloseTo(1)
    expect(easeOutBounce(0)).toBe(0); expect(easeOutBounce(1)).toBeCloseTo(1)
  })
  it('the preview keyframes are sampled from the same function the export draws with', () => {
    for (const p of all) {
      const frames = toKeyframes(p, 3, {}, 8)
      expect(frames).toHaveLength(9)
      frames.forEach((k, i) => {
        const f = textFrame(p, (3 * i) / 8, 3)
        expect(k.opacity).toBeCloseTo(f.opacity, 5)
        expect(String(k.transform)).toContain(`scale(${f.scale.toFixed(4)})`)
        expect(String(k.clipPath)).toContain(`${((1 - f.reveal) * 100).toFixed(2)}%`)
      })
    }
  })
})

describe('painting text onto frames', () => {
  const fakeCanvas = () => {
    const calls: any[] = []
    const ctx: any = new Proxy({}, { get: (_t, k: string) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : (...a: any[]) => calls.push([k, ...a])), set: (_t, k: string, v) => { calls.push(['set', k, v]); return true } })
    return { ctx, calls }
  }
  it('wraps words greedily by width', () => {
    const m = (s: string) => s.length * 10
    expect(wrapLines('one two three four', 90, m)).toEqual(['one two', 'three', 'four'])
    expect(wrapLines('', 90, m)).toEqual([''])
    expect(wrapLines('a\nb', 90, m)).toEqual(['a', 'b'])
  })
  it('draws only inside its time range', () => {
    const { ctx, calls } = fakeCanvas()
    const o = defaultOverlay({ text: 'Hello', start: 1, end: 4, preset: 'fade' })
    expect(drawTextOverlay(ctx, o, 0.5, 1000, 500)).toBe(false)
    expect(drawTextOverlay(ctx, o, 4.5, 1000, 500)).toBe(false)
    expect(calls).toHaveLength(0)
    expect(drawTextOverlay(ctx, o, 2.5, 1000, 500)).toBe(true)
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === 'Hello')).toBe(true)
    expect(calls.filter((c) => c[0] === 'save')).toHaveLength(calls.filter((c) => c[0] === 'restore').length) // state always restored
  })
  it('typewriter shows only the typed part; position moves the block', () => {
    const { ctx, calls } = fakeCanvas()
    drawTextOverlay(ctx, defaultOverlay({ text: 'ABCDEFGHIJ', start: 0, end: 5, preset: 'typewriter' }), 0.25, 1000, 500)
    const typed = calls.find((c) => c[0] === 'fillText')?.[1] as string
    expect(typed.length).toBeGreaterThan(0)
    expect(typed.length).toBeLessThan(10)
    const top = fakeCanvas(), bottom = fakeCanvas()
    drawTextOverlay(top.ctx, defaultOverlay({ position: 'top', preset: 'fade' }), 1.5, 1000, 500)
    drawTextOverlay(bottom.ctx, defaultOverlay({ position: 'bottom', preset: 'fade' }), 1.5, 1000, 500)
    const y = (c: any) => c.calls.find((x: any) => x[0] === 'translate')[2]
    expect(y(top)).toBeLessThan(y(bottom))
  })
  it('skips empty text', () => {
    const { ctx } = fakeCanvas()
    expect(drawTextOverlay(ctx, defaultOverlay({ text: '   ' }), 1, 1000, 500)).toBe(false)
  })
})
