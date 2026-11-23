import { describe, expect, it } from 'vitest'
import { friendlyRenderError } from '../webExport'

describe('friendlyRenderError', () => {
  it('replaces the browsers\' bare fetch failures with a plain-language message', () => {
    for (const m of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
      expect(friendlyRenderError(new TypeError(m))).toMatch(/couldn't read this video/)
    }
  })
  it('keeps every other message, and has a default', () => {
    expect(friendlyRenderError(new Error('Encoder crashed'))).toBe('Encoder crashed')
    expect(friendlyRenderError('x')).toBe('The in-browser render failed.')
  })
})
