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

test('collects web-search citations and renders a Sources list', async () => {
  const { sourcesMarkdown } = await import('../src/lib/openai-responses.ts')
  const out = await run([
    {
      type: 'response.completed',
      response: {
        output: [
          { type: 'web_search_call', id: 'ws_1', status: 'completed' },
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Paris is the capital.',
                annotations: [
                  { type: 'url_citation', url: 'https://example.org/a', title: 'Atlas [1]' },
                  { type: 'url_citation', url: 'https://example.org/a', title: 'dup' },
                  { type: 'url_citation', url: 'javascript:alert(1)', title: 'bad' }
                ]
              }
            ]
          }
        ]
      }
    }
  ])
  assert.deepEqual(out.sources, [{ title: 'Atlas [1]', url: 'https://example.org/a' }])
  assert.equal(sourcesMarkdown(out.sources), '\n\n**Sources**\n- [Atlas 1](https://example.org/a)')
  assert.equal(sourcesMarkdown([]), '')
})
