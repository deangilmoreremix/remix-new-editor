import { describe, expect, it } from 'vitest'
import { normalizeCaptions } from '../captions'

const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: i * 400, toMs: i * 400 + 400 })
const studio = { pages: [{ startMs: 0, durationMs: 1600, tokens: ['hello', 'brave', 'world'].map(tok) }], style: { fontFamily: 'Anton', weight: 'light', fontSize: 6, positionY: 0.3 } }

describe('captions made in the Caption Studio', () => {
  it('are kept, cleaned, next to the lines and style the older layer draws', () => {
    const c = normalizeCaptions({ enabled: true, cues: [], style: {}, studio })!
    expect(c.studio?.pages).toHaveLength(1)
    expect(c.studio?.style).toMatchObject({ fontFamily: 'Anton', weight: 'light', positionY: 0.3 })
  })
  it('drop invalid studio data without losing the captions', () => {
    const c = normalizeCaptions({ enabled: true, cues: [], style: {}, studio: { pages: 'nope' } })!
    expect(c.studio).toBeUndefined()
    expect(c.enabled).toBe(true)
  })
  it('leave older projects (no studio) unchanged', () => {
    expect(normalizeCaptions({ enabled: true, cues: [], style: {} })!.studio).toBeUndefined()
  })
})
