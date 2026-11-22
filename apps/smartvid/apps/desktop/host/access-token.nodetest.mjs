import assert from 'node:assert/strict'
import test from 'node:test'
import { createTokenCheck, safeDecode } from './access-token.mjs'

const check = createTokenCheck('s3cret-token')

test('accepts the token as a Bearer header or a (URL-encoded) cookie', () => {
  assert.equal(check({ authorization: 'Bearer s3cret-token' }), true)
  assert.equal(check({ cookie: 'a=1; smartvid_token=s3cret-token; b=2' }), true)
  assert.equal(createTokenCheck('a b/c')({ cookie: `smartvid_token=${encodeURIComponent('a b/c')}` }), true)
})

test('rejects wrong, empty and missing credentials', () => {
  assert.equal(check({}), false)
  assert.equal(check({ authorization: 'Bearer nope' }), false)
  assert.equal(check({ cookie: 'smartvid_token=nope' }), false)
  assert.equal(check({ authorization: 'Bearer ' }), false)
})

test('a malformed cookie is rejected instead of throwing (it used to crash the process)', () => {
  assert.doesNotThrow(() => check({ cookie: 'smartvid_token=%' }))
  assert.equal(check({ cookie: 'smartvid_token=%' }), false)
  assert.equal(check({ cookie: 'smartvid_token=%E0%A4%A' }), false)
  assert.equal(check({ authorization: 'Bearer %' }), false)
  assert.equal(safeDecode('%'), '')
})

test('same string length but different byte length is rejected (timingSafeEqual would throw)', () => {
  const ascii = createTokenCheck('aa')
  assert.doesNotThrow(() => ascii({ authorization: 'Bearer éa' }))
  assert.equal(ascii({ authorization: 'Bearer éa' }), false)
})
