import { describe, expect, it } from 'vitest'
import { FEEDBACK_REASONS, mapRpcError, validateBusinessId, validateFeedback, validateReason, validateSavedSearch, validateUuid } from '../validate'

const good = { name: 'Tampa pizza', niche: 'restaurants-food', location: 'Tampa, FL', radiusMiles: 25, includeChains: false }

describe('validateSavedSearch', () => {
  it('accepts a good body and applies defaults', () => {
    expect(validateSavedSearch(good)).toEqual({ ok: true, value: good })
    const d = validateSavedSearch({ name: 'x', niche: 'beauty', location: 'Miami' })
    expect(d).toEqual({ ok: true, value: { name: 'x', niche: 'beauty', location: 'Miami', radiusMiles: 15, includeChains: false } })
  })
  it('trims and collapses whitespace', () => {
    const r = validateSavedSearch({ ...good, name: '  Tampa   pizza  ' })
    expect(r.ok && r.value.name).toBe('Tampa pizza')
  })
  it('rejects bad input with a specific message', () => {
    expect(validateSavedSearch(null).ok).toBe(false)
    expect(validateSavedSearch([]).ok).toBe(false)
    for (const bad of [
      { ...good, name: '' }, { ...good, name: 'a'.repeat(81) }, { ...good, name: 'bad\u0000name' }, { ...good, name: 5 },
      { ...good, niche: 'not-a-niche' }, { ...good, niche: undefined },
      { ...good, location: '' }, { ...good, location: 'x'.repeat(121) },
      { ...good, radiusMiles: 0 }, { ...good, radiusMiles: 51 }, { ...good, radiusMiles: 2.5 }, { ...good, radiusMiles: '15' },
      { ...good, includeChains: 'yes' },
    ]) expect(validateSavedSearch(bad).ok, JSON.stringify(bad)).toBe(false)
  })
})

describe('feedback validation', () => {
  it('accepts every fixed reason and rejects anything else', () => {
    for (const r of FEEDBACK_REASONS) expect(validateReason(r)).toBe(r)
    for (const bad of ['made_up', '', null, 5, undefined, 'IS_A_CHAIN']) expect(validateReason(bad as never)).toBeNull()
  })
  it('validates a feedback body, note optional and bounded', () => {
    expect(validateFeedback({ businessId: 'osm-node-1', reason: 'closed' })).toEqual({ ok: true, value: { businessId: 'osm-node-1', reason: 'closed', note: null } })
    const withNote = validateFeedback({ businessId: 'a', reason: 'other', note: ' permanently closed ' })
    expect(withNote.ok && withNote.value.note).toBe('permanently closed')
    expect(validateFeedback({ businessId: 'a', reason: 'other', note: 'x'.repeat(281) }).ok).toBe(false)
    expect(validateFeedback({ businessId: '', reason: 'other' }).ok).toBe(false)
    expect(validateFeedback({ businessId: 'a'.repeat(121), reason: 'other' }).ok).toBe(false)
    expect(validateFeedback({ businessId: 'a', reason: 'nope' }).ok).toBe(false)
    expect(validateFeedback('x').ok).toBe(false)
  })
  it('validates ids', () => {
    expect(validateBusinessId('  osm-way-9 ')).toBe('osm-way-9')
    expect(validateBusinessId('bad\nid')).toBeNull()
    expect(validateUuid('123E4567-E89B-12D3-A456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(validateUuid('not-a-uuid')).toBeNull()
    expect(validateUuid(undefined)).toBeNull()
  })
})

describe('mapRpcError', () => {
  it('maps limits, bad values, auth, and everything else without leaking the raw message', () => {
    expect(mapRpcError({ code: '54000', message: 'limit of 25' })).toMatchObject({ status: 409, code: 'LIMIT_REACHED' })
    expect(mapRpcError({ code: '23514' }).status).toBe(422)
    expect(mapRpcError({ code: '22023' }).status).toBe(422)
    expect(mapRpcError({ code: '28000' }).status).toBe(401)
    const other = mapRpcError({ code: 'XX000', message: 'secret internal detail' })
    expect(other.status).toBe(502)
    expect(other.message).not.toContain('secret')
    expect(mapRpcError(null).status).toBe(502)
  })
})
