import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateThumbnail, isModerationBlocked } from '../thumbnailService'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const ok = () => new Response(JSON.stringify({ urls: ['data:image/png;base64,AAAA'], request_id: 'r' }), { status: 200 })

describe('thumbnail service content filter', () => {
  it('sends moderation only when relaxed', async () => {
    const f = vi.fn(async () => ok())
    globalThis.fetch = f as any
    await generateThumbnail({ prompt: 'p', moderation: 'low' })
    await generateThumbnail({ prompt: 'p', moderation: 'auto' })
    await generateThumbnail({ prompt: 'p' })
    const bodies = f.mock.calls.map((c: any) => JSON.parse(c[1].body))
    expect(bodies[0].moderation).toBe('low')
    expect(bodies[1].moderation).toBeUndefined()
    expect(bodies[2].moderation).toBeUndefined()
  })

  it('keeps the readable message and flags a moderation block', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "OpenAI's content filter blocked your prompt or picture (violence).", code: 'moderation_blocked', moderation_details: { moderation_stage: 'input' } }), { status: 400 })) as any
    const err = await generateThumbnail({ prompt: 'p' }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/content filter/)
    expect(isModerationBlocked(err)).toBe(true)
    expect(isModerationBlocked(new Error('other'))).toBe(false)
  })
})
