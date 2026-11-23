import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { netFetch } from './net-fetch.mjs'

const dir = mkdtempSync(path.join(os.tmpdir(), 'vb-net-'))
const file = path.join(dir, 'clip.mp4')
writeFileSync(file, Buffer.from('0123456789'))
const href = pathToFileURL(file).href

test('serves a whole file with its type and length', async () => {
  const res = await netFetch(href, {})
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'video/mp4')
  assert.equal(res.headers.get('content-length'), '10')
  assert.equal(await res.text(), '0123456789')
})

test('honours byte ranges, from a Headers object as Electron passes them', async () => {
  const res = await netFetch(href, { headers: new Headers({ range: 'bytes=2-5' }) })
  assert.equal(res.status, 206)
  assert.equal(res.headers.get('content-range'), 'bytes 2-5/10')
  assert.equal(await res.text(), '2345')
  const tail = await netFetch(href, { headers: { range: 'bytes=-3' } })
  assert.equal(await tail.text(), '789')
})

test('rejects a range past the end and a missing file', async () => {
  assert.equal((await netFetch(href, { headers: { range: 'bytes=99-' } })).status, 416)
  await assert.rejects(() => netFetch(pathToFileURL(path.join(dir, 'missing.mp4')).href, {}))
})

test('anything that is not a file: URL goes to the normal fetch', async () => {
  const res = await netFetch('https://example.test/x', {}, async (input) => new Response(`passed ${input}`))
  assert.equal(await res.text(), 'passed https://example.test/x')
})
