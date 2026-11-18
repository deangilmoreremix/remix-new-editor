import { describe, it, expect, vi } from 'vitest'
import { REMOVE_BRANDING_MODEL, affordability, describeCost, loadQuote, removeBranding, type RemovalDeps } from '../brandingRemoval'

const deps = (over: Partial<RemovalDeps> = {}): RemovalDeps => ({
  processV2V: vi.fn(async () => ({ url: 'https://cdn.test/clean.mp4' })),
  estimateV2VCost: vi.fn(async () => ({ cost: 0.12, currency: 'USD' })),
  getUserBalance: vi.fn(async () => ({ balance: 42 })),
  ...over,
})

describe('loadQuote', () => {
  it('asks for the estimate and the balance for the watermark model, and never submits a job', async () => {
    const d = deps()
    const q = await loadQuote(d, { apiKey: 'k', videoUrl: 'https://v/a.mp4' })
    expect(q).toEqual({ estimate: { cost: 0.12, currency: 'USD' }, balance: 42 })
    expect(d.estimateV2VCost).toHaveBeenCalledWith({ model: REMOVE_BRANDING_MODEL, video_url: 'https://v/a.mp4' }, undefined)
    expect(d.getUserBalance).toHaveBeenCalledWith('k')
    expect(d.processV2V).not.toHaveBeenCalled()
  })

  it('keeps going when either lookup fails', async () => {
    const q = await loadQuote(deps({ estimateV2VCost: vi.fn(async () => { throw new Error('nope') }) }), { apiKey: 'k', videoUrl: 'u' })
    expect(q).toEqual({ estimate: null, balance: 42 })
    const q2 = await loadQuote(deps({ getUserBalance: vi.fn(async () => { throw new Error('401') }) }), { apiKey: 'k', videoUrl: 'u' })
    expect(q2).toEqual({ estimate: { cost: 0.12, currency: 'USD' }, balance: null })
  })

  it('does not wait forever: a hung lookup is given up on after the timeout', async () => {
    vi.useFakeTimers()
    try {
      const never = new Promise<never>(() => {})
      const p = loadQuote(deps({ estimateV2VCost: vi.fn(() => never), getUserBalance: vi.fn(() => never) }), { apiKey: 'k', videoUrl: 'u', timeoutMs: 1000 })
      await vi.advanceTimersByTimeAsync(1100)
      expect(await p).toEqual({ estimate: null, balance: null })
    } finally { vi.useRealTimers() }
  })

  it('a lookup that throws synchronously is also just unknown', async () => {
    const q = await loadQuote(deps({ estimateV2VCost: vi.fn(() => { throw new Error('boom') }) }), { apiKey: 'k', videoUrl: 'u' })
    expect(q.estimate).toBeNull()
    expect(q.balance).toBe(42)
  })

  it('treats a non-numeric balance as unknown', async () => {
    const q = await loadQuote(deps({ getUserBalance: vi.fn(async () => ({ balance: 'lots' })) }), { apiKey: 'k', videoUrl: 'u' })
    expect(q.balance).toBeNull()
  })
})

describe('affordability', () => {
  it('never blocks on an unknown balance', () => {
    expect(affordability(null, null).ok).toBe(true)
    expect(affordability(null, 5).ok).toBe(true)
  })
  it('with no configured price, blocks only an empty balance', () => {
    expect(affordability(0, null).ok).toBe(false)
    expect(affordability(-3, null).ok).toBe(false)
    expect(affordability(0.01, null).ok).toBe(true)
  })
  it('with a configured price, blocks a balance below it and says how many credits are needed', () => {
    const r = affordability(3, 5)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('5 credits')
    expect(affordability(5, 5).ok).toBe(true)
  })
})

describe('describeCost', () => {
  it('prefers the configured credits, then the live estimate, and never invents a number', () => {
    expect(describeCost(null, 5)).toBe('5 credits')
    expect(describeCost(null, 1)).toBe('1 credit')
    expect(describeCost({ estimate: { cost: 0.123, currency: 'USD' }, balance: null }, null)).toBe('about 0.12 USD')
    expect(describeCost({ estimate: null, balance: 9 }, null)).toBe('uses credits')
    expect(describeCost(null, null)).toBe('uses credits')
  })
})

describe('removeBranding', () => {
  it('submits the watermark model with the video and returns the cleaned URL', async () => {
    const d = deps()
    const onRequestId = vi.fn()
    const r = await removeBranding(d, { apiKey: 'k', videoUrl: 'https://v/a.mp4', onRequestId })
    expect(r).toEqual({ url: 'https://cdn.test/clean.mp4' })
    expect(d.processV2V).toHaveBeenCalledWith('k', { model: REMOVE_BRANDING_MODEL, video_url: 'https://v/a.mp4', onRequestId })
  })
  it('throws, without calling the service, when there is no key or no video', async () => {
    const d = deps()
    await expect(removeBranding(d, { apiKey: '  ', videoUrl: 'u' })).rejects.toThrow(/Sign in/)
    await expect(removeBranding(d, { apiKey: 'k', videoUrl: '' })).rejects.toThrow(/no video/)
    expect(d.processV2V).not.toHaveBeenCalled()
  })
  it('throws when the service finishes without a video, so a half result is never applied', async () => {
    await expect(removeBranding(deps({ processV2V: vi.fn(async () => ({ url: '' })) }), { apiKey: 'k', videoUrl: 'u' })).rejects.toThrow(/without returning a video/)
    await expect(removeBranding(deps({ processV2V: vi.fn(async () => null) }), { apiKey: 'k', videoUrl: 'u' })).rejects.toThrow()
  })
  it('passes a provider failure through', async () => {
    await expect(removeBranding(deps({ processV2V: vi.fn(async () => { throw new Error('402 payment required') }) }), { apiKey: 'k', videoUrl: 'u' })).rejects.toThrow('402')
  })
})
