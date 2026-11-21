// The server's OpenAI key must only ever go to the address it was configured for.
// Run: node --import tsx --test tests/ai-credentials.nodetest.mjs   (from apps/vidbee/apps/api)
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const SERVER_KEY = 'server-secret-key'
const seen = { legit: [], other: [] }
const INTERNAL_BODY = 'internal-service-secret-body'
const listen = (name) =>
  new Promise((resolve) => {
    const server = http
      .createServer((req, res) => {
        req.resume()
        req.on('end', () => {
          seen[name].push(req.headers.authorization)
          res.writeHead(200, { 'content-type': 'text/event-stream' })
          const done = { type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ready' }] }] } }
          res.end(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'ready' })}\n\nevent: response.completed\ndata: ${JSON.stringify(done)}\n\n`)
        })
      })
      .listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }))
  })

let ai
let legit
let other
let internal
before(async () => {
  legit = await listen('legit')
  other = await listen('other')
  internal = await new Promise((resolve) => {
    const server = http
      .createServer((req, res) => {
        req.resume()
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end(INTERNAL_BODY)
      })
      .listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }))
  })
  const base = mkdtempSync(path.join(os.tmpdir(), 'vb-ai-cred-'))
  Object.assign(process.env, {
    VIDBEE_DATA_DIR: path.join(base, 'data'),
    VIDBEE_DOWNLOAD_DIR: path.join(base, 'dl'),
    VIDBEE_PERSIST_QUEUE: '0',
    OPENAI_API_KEY: SERVER_KEY,
    OPENAI_BASE_URL: legit.url
  })
  delete process.env.VIDBEE_AI_LOCK_SETTINGS
  ai = await import('../src/lib/ai-host.ts')
})
// The API opens a database and timers on import, so end the process explicitly once the tests are done.
after(() => {
  legit.server.close()
  other.server.close()
  internal.server.close()
  setTimeout(() => process.exit(0), 50).unref()
})

describe('server key and base URL', () => {
  it('tests the saved configuration with the saved key', async () => {
    const result = await ai.testConnection({})
    assert.equal(result.ok, true)
    assert.deepEqual(seen.legit.at(-1), `Bearer ${SERVER_KEY}`)
  })

  it('never sends the server key to a different base URL', async () => {
    const result = await ai.testConnection({ baseUrl: other.url })
    assert.equal(result.ok, false)
    assert.match(result.error, /enter the API key/i)
    assert.equal(seen.other.length, 0)
  })

  it('sends only the key the caller typed when they test a different base URL', async () => {
    await ai.testConnection({ baseUrl: other.url, apiKey: 'typed-by-user' })
    assert.deepEqual(seen.other, ['Bearer typed-by-user'])
    assert.equal(seen.other.includes(`Bearer ${SERVER_KEY}`), false)
  })

  it('does not echo what another address returns (a base URL can point at an internal service)', async () => {
    const result = await ai.testConnection({ baseUrl: internal.url, apiKey: 'typed-by-user' })
    assert.equal(result.ok, false)
    assert.equal(result.error.includes(INTERNAL_BODY), false)
    assert.match(result.error, /OpenAI error 500/)
  })

  it('when the settings are locked, nothing the caller sends is used', async () => {
    process.env.VIDBEE_AI_LOCK_SETTINGS = '1'
    try {
      const before = seen.other.length
      const result = await ai.testConnection({ baseUrl: other.url, apiKey: 'x', model: 'other-model' })
      assert.equal(result.ok, true)
      assert.equal(seen.other.length, before)
      assert.deepEqual(seen.legit.at(-1), `Bearer ${SERVER_KEY}`)
      assert.throws(() => ai.setAiSettings({ model: 'm2' }), /managed by the server/i)
    } finally {
      delete process.env.VIDBEE_AI_LOCK_SETTINGS
    }
  })

  it('refuses to save a different base URL without the key, and accepts the same URL or a new key', () => {
    assert.throws(() => ai.setAiSettings({ baseUrl: other.url }), /enter the API key/i)
    assert.doesNotThrow(() => ai.setAiSettings({ baseUrl: `${legit.url}/`, model: 'm' }))
    assert.doesNotThrow(() => ai.setAiSettings({ baseUrl: other.url, apiKey: 'fresh-key' }))
  })
})
