import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.VIDBEE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'vb-byok-'))
process.env.VIDBEE_AI_MODE = 'byok'
process.env.OPENAI_API_KEY = 'sk-server-env-key'

const { withClientAi, clientAi, parseClientAi } = await import('../src/lib/byok.ts')
const { getOpenAiConfig, aiSettingsFile } = await import('../src/lib/openai-responses.ts')

test('only the visitor\'s own key is used, never the environment or a saved one', () => {
  writeFileSync(aiSettingsFile, JSON.stringify({ apiKey: 'sk-saved-on-server', baseUrl: 'https://evil.example/v1' }))
  // no key from the visitor: no key at all
  assert.equal(getOpenAiConfig().apiKey, undefined)
  assert.equal(getOpenAiConfig().keyFromEnv, false)
  withClientAi({ 'x-vidbee-openai-key': 'sk-visitor-key-1234', 'x-vidbee-openai-model': 'gpt-4.1' }, () => {
    const cfg = getOpenAiConfig()
    assert.equal(cfg.apiKey, 'sk-visitor-key-1234')
    assert.equal(cfg.model, 'gpt-4.1')
    // the address is the server's, not the saved one
    assert.equal(cfg.baseUrl, 'https://api.openai.com/v1')
  })
})

test('two visitors at the same time never see each other\'s key', async () => {
  const seen = []
  await Promise.all(
    ['sk-aaaaaaaa-visitor-a', 'sk-bbbbbbbb-visitor-b'].map(
      (key) =>
        new Promise((resolve) =>
          withClientAi({ 'x-vidbee-openai-key': key }, async () => {
            await new Promise((r) => setTimeout(r, key.includes('aaaa') ? 30 : 5))
            seen.push([key, clientAi().apiKey])
            resolve()
          })
        )
    )
  )
  for (const [expected, actual] of seen) assert.equal(actual, expected)
})

test('malformed keys and models are dropped', () => {
  assert.deepEqual(parseClientAi({ 'x-vidbee-openai-key': 'short', 'x-vidbee-openai-model': 'bad model!' }), {
    apiKey: undefined,
    model: undefined
  })
  assert.equal(parseClientAi({ 'x-vidbee-openai-key': 'sk-ok-key-12345678' }).apiKey, 'sk-ok-key-12345678')
})

test('the key survives into work started by the request after it returns (hook pattern used by the server)', async () => {
  const Fastify = (await import('fastify')).default
  const app = Fastify()
  app.addHook('onRequest', (request, _reply, done) => withClientAi(request.headers, done))
  let later = null
  app.get('/go', (_request, reply) => {
    const captured = getOpenAiConfig() // what the server captures at the start of a job
    void (async () => {
      await new Promise((r) => setTimeout(r, 20))
      later = getOpenAiConfig().apiKey
    })()
    reply.send({ captured: captured.apiKey })
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const port = app.server.address().port
  const body = await new Promise((resolve) =>
    http.get({ port, path: '/go', headers: { 'x-vidbee-openai-key': 'sk-through-fastify-1234' } }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(JSON.parse(data)))
    })
  )
  assert.equal(body.captured, 'sk-through-fastify-1234')
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(later, 'sk-through-fastify-1234')
  await app.close()
})
