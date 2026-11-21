import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { createResponse } from '../src/lib/openai-responses.ts'

const serve = (events) =>
  new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const e of events) {
        res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
      }
      res.end()
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })

const run = async (events) => {
  const server = await serve(events)
  try {
    return await createResponse({
      body: { input: 'hi' },
      config: { apiKey: 'k', baseUrl: `http://127.0.0.1:${server.address().port}`, model: 'm' }
    })
  } finally {
    server.close()
  }
}

test('rejects a stream that ends without response.completed', async () => {
  await assert.rejects(run([{ type: 'response.output_text.delta', delta: 'partial' }]), /before the response completed/)
})

test('rejects response.incomplete', async () => {
  await assert.rejects(run([{ type: 'response.incomplete', response: {} }]), /incomplete/)
})

test('accepts a completed stream', async () => {
  const out = await run([
    { type: 'response.output_text.delta', delta: 'ok' },
    { type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] } }
  ])
  assert.equal(out.text, 'ok')
})
