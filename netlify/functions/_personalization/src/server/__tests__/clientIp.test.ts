import { describe, it, expect } from 'vitest'
import { clientIpFromHeaders } from '../clientIp'
const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })

describe('clientIpFromHeaders', () => {
  it('trusts Netlify\'s header over everything a client can send', () => {
    expect(clientIpFromHeaders(h({ 'x-nf-client-connection-ip': '203.0.113.9', 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '6.6.6.6' }))).toBe('203.0.113.9')
  })
  it('falls back to x-real-ip, then the LAST x-forwarded-for hop', () => {
    expect(clientIpFromHeaders(h({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '6.6.6.6' }))).toBe('198.51.100.7')
    expect(clientIpFromHeaders(h({ 'x-forwarded-for': 'attacker-chosen, 6.6.6.6, 198.51.100.2' }))).toBe('198.51.100.2')
  })
  it('a spoofed first hop never becomes the key, so rotating it does not mint new buckets', () => {
    const a = clientIpFromHeaders(h({ 'x-forwarded-for': '9.9.9.1, 198.51.100.2' }))
    const b = clientIpFromHeaders(h({ 'x-forwarded-for': '9.9.9.2, 198.51.100.2' }))
    expect(a).toBe(b)
  })
  it('rejects junk values and returns undefined when nothing usable exists', () => {
    expect(clientIpFromHeaders(h({ 'x-nf-client-connection-ip': 'not an ip!' }))).toBeUndefined()
    expect(clientIpFromHeaders(h({ 'x-real-ip': 'x'.repeat(200) }))).toBeUndefined()
    expect(clientIpFromHeaders(h({}))).toBeUndefined()
  })
  it('accepts IPv6', () => { expect(clientIpFromHeaders(h({ 'x-nf-client-connection-ip': '2001:db8::1' }))).toBe('2001:db8::1') })
})
