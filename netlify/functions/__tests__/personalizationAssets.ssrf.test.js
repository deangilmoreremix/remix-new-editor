// @vitest-environment node
/**
 * The asset finder's URL check must refuse EVERY non-public destination the shared guard refuses, whether the address is
 * typed into the URL or is what a public-looking hostname resolves to (DNS rebinding style). It used to cover only the
 * classic private ranges and let CGNAT (100.64/10), benchmarking, documentation, multicast and reserved ranges through.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dnsAnswers = new Map()
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host) => {
    const answer = dnsAnswers.get(host)
    if (!answer) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
    return answer.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }),
}))

const { sanitizePublicHttpUrl } = await import('../_personalizationAssets.js')
const { isBlockedIpAddress } = await import('../_personalization/src/lib/networkSafety')

beforeEach(() => dnsAnswers.clear())

const NON_PUBLIC_V4 = [
  '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.254', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
  '192.0.0.8', '192.0.2.10', '192.168.1.1', '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255',
]
const NON_PUBLIC_V6 = ['::1', '::', 'fe80::1', 'fd00::1', 'fc00::1', 'ff02::1', '::ffff:169.254.169.254', '::ffff:100.64.0.1', '::ffff:172.16.0.1', '::ffff:127.0.0.1', '2001:db8::1']
const PUBLIC = ['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']

describe('typed IPv4 literals', () => {
  it.each(NON_PUBLIC_V4)('rejects http://%s/', async (ip) => {
    await expect(sanitizePublicHttpUrl(`http://${ip}/`)).rejects.toThrow(/Private network addresses are not allowed/)
  })
  it.each(['http://2130706433/', 'http://0x7f.0.0.1/', 'http://127.1/', 'http://0177.0.0.1/', 'http://[::1]/', 'http://localhost/', 'http://printer.local/', 'http://db.internal/'])('rejects the disguised form %s', async (u) => {
    await expect(sanitizePublicHttpUrl(u)).rejects.toThrow()
  })
})

describe('hostnames that RESOLVE to a non-public address', () => {
  it.each([...NON_PUBLIC_V4, ...NON_PUBLIC_V6])('rejects a name resolving to %s', async (ip) => {
    dnsAnswers.set('looks-public.example', [ip])
    await expect(sanitizePublicHttpUrl('https://looks-public.example/')).rejects.toThrow(/Private network addresses are not allowed/)
  })
  it('rejects when ANY answer is non-public (a public one next to a private one is still a rebinding risk)', async () => {
    dnsAnswers.set('mixed.example', ['93.184.216.34', '100.64.0.9'])
    await expect(sanitizePublicHttpUrl('https://mixed.example/')).rejects.toThrow(/Private network addresses are not allowed/)
  })
  it('rejects an empty answer and a name that does not resolve', async () => {
    dnsAnswers.set('empty.example', [])
    await expect(sanitizePublicHttpUrl('https://empty.example/')).rejects.toThrow()
    await expect(sanitizePublicHttpUrl('https://nowhere.example/')).rejects.toThrow(/could not be resolved/)
  })
})

describe('public destinations still work', () => {
  it.each(PUBLIC)('accepts a name resolving to %s', async (ip) => {
    dnsAnswers.set('shop.example', [ip])
    await expect(sanitizePublicHttpUrl('https://shop.example/menu#top')).resolves.toBe('https://shop.example/menu')
  })
  it('adds https:// to a bare name and refuses other schemes', async () => {
    dnsAnswers.set('bare.example', ['93.184.216.34'])
    await expect(sanitizePublicHttpUrl('bare.example')).resolves.toBe('https://bare.example/')
    for (const bad of ['file:///etc/passwd', 'ftp://x.example/', 'javascript:alert(1)', '']) await expect(sanitizePublicHttpUrl(bad)).rejects.toThrow()
  })
})

describe('parity with the shared guard', () => {
  it('every address the shared guard blocks is rejected here too, and every public one it allows is accepted', async () => {
    for (const ip of [...NON_PUBLIC_V4, ...NON_PUBLIC_V6, ...PUBLIC]) {
      dnsAnswers.set('parity.example', [ip])
      const shared = isBlockedIpAddress(ip)
      let rejected = false
      try { await sanitizePublicHttpUrl('https://parity.example/') } catch { rejected = true }
      expect(rejected, `${ip}: shared guard blocks=${shared}, asset finder rejects=${rejected}`).toBe(shared)
    }
  })
})
