import { describe, it, expect } from 'vitest'
import { parseOpeningHours, openStatus, timeZoneForRegion } from '../openingHours'

// 2026-11-16 is a Monday. FL = America/New_York (EST, UTC-5 in November).
const at = (isoUtc: string) => new Date(isoUtc)
describe('parseOpeningHours', () => {
  it('parses day ranges, lists, multiple time ranges and 24/7', () => {
    expect(parseOpeningHours('24/7')).toBe('24/7')
    expect(parseOpeningHours('Mo-Fr 09:00-17:00; Sa 10:00-14:00')).toHaveLength(2)
    expect(parseOpeningHours('Mo,We-Fr 09:00-12:00,13:00-17:00')).toHaveLength(1)
  })
  it('returns null (unknown) for anything it does not fully understand', () => {
    for (const bad of ['Mo-Fr 09:00-17:00; PH off', 'sunrise-sunset', 'Jan-Mar Mo 09:00-17:00', 'by appointment', '', undefined, 'Mo-Fr 9am-5pm', 'week 1-4 Mo 09:00-10:00']) expect(parseOpeningHours(bad as never)).toBeNull()
  })
})
describe('openStatus', () => {
  it('open during hours, closed after, in the BUSINESS time zone', () => {
    // Monday 10:00 EST = 15:00Z
    expect(openStatus('Mo-Fr 09:00-17:00', 'FL', at('2026-11-16T15:00:00Z'))).toEqual({ state: 'open' })
    // Monday 18:00 EST = 23:00Z
    expect(openStatus('Mo-Fr 09:00-17:00', 'FL', at('2026-11-16T23:00:00Z'))).toEqual({ state: 'closed' })
    // same instant in Los Angeles is 15:00 PST → still open there
    expect(openStatus('Mo-Fr 09:00-17:00', 'CA', at('2026-11-16T23:00:00Z'))).toEqual({ state: 'open' })
  })
  it('weekend rule, "off" override, and 24/7', () => {
    expect(openStatus('Mo-Su 09:00-17:00; Su off', 'FL', at('2026-11-15T17:00:00Z'))).toEqual({ state: 'closed' }) // Sunday noon
    expect(openStatus('24/7', undefined, at('2026-11-16T03:00:00Z'))).toEqual({ state: 'open' })
  })
  it('ranges that cross midnight stay open into the next morning', () => {
    // Fri 22:00 open; Sat 01:00 still open (Fr 18:00-02:00). Saturday 01:00 EST = 06:00Z on 2026-11-21 (Saturday)
    expect(openStatus('Fr 18:00-02:00', 'FL', at('2026-11-21T06:00:00Z'))).toEqual({ state: 'open' })
    expect(openStatus('Fr 18:00-02:00', 'FL', at('2026-11-21T08:00:00Z'))).toEqual({ state: 'closed' }) // 03:00 EST Sat
  })
  it('unknown when hours are unparseable or the time zone cannot be determined', () => {
    expect(openStatus('Mo-Fr 09:00-17:00; PH off', 'FL', at('2026-11-16T15:00:00Z'))).toEqual({ state: 'unknown' })
    expect(openStatus('Mo-Fr 09:00-17:00', undefined, at('2026-11-16T15:00:00Z'))).toEqual({ state: 'unknown' })
    expect(openStatus('Mo-Fr 09:00-17:00', 'ZZ', at('2026-11-16T15:00:00Z'))).toEqual({ state: 'unknown' })
  })
  it('maps states to zones', () => { expect(timeZoneForRegion(' fl ')).toBe('America/New_York'); expect(timeZoneForRegion('TX')).toBe('America/Chicago'); expect(timeZoneForRegion('')).toBeNull() })
})
