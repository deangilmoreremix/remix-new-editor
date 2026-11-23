import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { reviveBinary } from './ipc-binary.mjs'

// Run the browser shim's real encoder: the code between its markers in web-shim.js.
const shim = readFileSync(new URL('./web-shim.js', import.meta.url), 'utf8')
const snippet = /\/\/ binary-replacer-start([\s\S]*?)\/\/ binary-replacer-end/.exec(shim)?.[1]
assert.ok(snippet, 'binary replacer markers not found in web-shim.js')
const { binaryReplacer } = new Function('btoa', `${snippet}; return { binaryReplacer };`)(btoa)

const roundTrip = (value) => JSON.parse(JSON.stringify(value, binaryReplacer), reviveBinary)
const bytes = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256)

test('plain JSON arguments are unchanged', () => {
  const args = [{ defaultFileName: 'card.png', nested: { list: [1, 'two', null, true] } }, 'text', 42]
  assert.deepEqual(roundTrip(args), args)
})

test('an ArrayBuffer (a Blob\'s bytes) arrives intact; it used to become {}', () => {
  const source = bytes(2000)
  assert.equal(JSON.stringify({ data: source.buffer }), '{"data":{}}') // what the old shim sent
  const out = roundTrip([{ data: source.buffer, defaultFileName: 'card.png' }])
  assert.equal(out[0].defaultFileName, 'card.png')
  assert.deepEqual([...new Uint8Array(out[0].data)], [...source])
})

test('typed-array views keep only their own bytes, and large buffers survive chunked encoding', () => {
  const whole = bytes(100)
  const view = whole.subarray(10, 30)
  assert.deepEqual([...roundTrip({ v: view }).v], [...view])
  const big = bytes(3 * 1024 * 1024 + 17)
  assert.equal(Buffer.compare(roundTrip({ b: big.buffer }).b, Buffer.from(big)), 0)
})

test('upstream\'s `new Uint8Array(options.data)` gets the real bytes', () => {
  const png = bytes(64)
  const { data } = roundTrip({ data: png.buffer })
  assert.deepEqual([...new Uint8Array(data)], [...png])
})
