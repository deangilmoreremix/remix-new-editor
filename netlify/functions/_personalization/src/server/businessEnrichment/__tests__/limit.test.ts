import { describe, it, expect } from 'vitest'
import { createLimiter } from '../limit'

describe('createLimiter', () => {
  it('never runs more than `max` tasks at once and keeps result order', async () => {
    const limit = createLimiter(3)
    let active = 0, peak = 0
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => limit(async () => {
      active++; peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5 + (i % 3)))
      active--
      return i
    })))
    expect(peak).toBe(3)
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  it('a failing task rejects only itself and frees its slot', async () => {
    const limit = createLimiter(1)
    const a = limit(async () => { throw new Error('boom') })
    const b = limit(async () => 'ok')
    await expect(a).rejects.toThrow('boom')
    await expect(b).resolves.toBe('ok')
  })
  it('treats a nonsensical max as 1', async () => {
    const limit = createLimiter(0)
    let active = 0, peak = 0
    await Promise.all([1, 2, 3].map(() => limit(async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 2)); active-- })))
    expect(peak).toBe(1)
  })
})
