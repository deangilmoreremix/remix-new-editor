/**
 * downloadImageAsDataUrl builds `data:<type>;base64,...` from an upstream-controlled Content-Type header.
 * Only a bare `image/<subtype>` may go into it: parameters or a comma in the raw header could change what the
 * data URL means. SVG stays allowed (discovery keeps SVG brand marks); it only ever travels inside JSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const axiosGet = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { get: axiosGet } }))
vi.mock('../../lib/networkSafety', () => ({
  checkDestination: vi.fn(async () => ({ ok: true, hostname: 'cdn.example.test' })),
  safeRequestConfig: vi.fn(() => ({})),
  REDIRECT_STATUSES: [301, 302, 303, 307, 308],
  MAX_REDIRECT_HOPS: 5,
}))

import { downloadImageAsDataUrl } from '../downloadImage'

const respond = (contentType: string | undefined) =>
  axiosGet.mockResolvedValue({
    status: 200,
    data: Buffer.from('hello'),
    headers: contentType === undefined ? {} : { 'content-type': contentType },
  })

beforeEach(() => axiosGet.mockReset())

describe('downloadImageAsDataUrl content type', () => {
  it('puts only the bare media type in the data URL', async () => {
    respond('Image/PNG; charset=binary; foo=bar')
    expect(await downloadImageAsDataUrl('https://cdn.example.test/a.png')).toBe(`data:image/png;base64,${Buffer.from('hello').toString('base64')}`)
  })

  it('refuses a header that tries to smuggle content into the data URL', async () => {
    respond('image/png,<svg onload=alert(1)>')
    await expect(downloadImageAsDataUrl('https://cdn.example.test/a.png')).rejects.toThrow(/Invalid content type/)
  })

  it('refuses non-images and a missing type', async () => {
    respond('text/html')
    await expect(downloadImageAsDataUrl('https://cdn.example.test/a')).rejects.toThrow(/Invalid content type/)
    respond(undefined)
    await expect(downloadImageAsDataUrl('https://cdn.example.test/a')).rejects.toThrow(/Invalid content type/)
  })

  it('still returns SVG brand marks', async () => {
    respond('image/svg+xml')
    expect(await downloadImageAsDataUrl('https://cdn.example.test/logo.svg')).toMatch(/^data:image\/svg\+xml;base64,/)
  })
})
