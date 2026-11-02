// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/supabase', () => ({ createServerClient: vi.fn() }))

import { sanitizeValue } from '../app/api/personalization/project/route'

describe('project route sanitizeValue', () => {
  it('truncates long text', () => {
    expect(sanitizeValue('abcdef', 3)).toBe('abc...')
  })

  it('drops an oversized data URL instead of saving a corrupt image', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(50)
    const small = 'data:image/png;base64,AAAA'
    expect(
      sanitizeValue(
        { outputUrls: [big, 'https://cdn.example/a.png', small], preview: big, caption: 'hi' },
        40,
      ),
    ).toEqual({ outputUrls: ['https://cdn.example/a.png', small], caption: 'hi' })
  })
})
