import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { contentDisposition } from '../src/lib/content-disposition.ts'

/** Send the header through a real Node HTTP response, as the API does, and return what the client sees. */
const roundTrip = (value) =>
  new Promise((resolve, reject) => {
    const server = http
      .createServer((req, res) => {
        try {
          res.setHeader('content-disposition', value)
          res.end('ok')
        } catch (error) {
          res.statusCode = 500
          res.end(String(error.code))
        }
      })
      .listen(0, '127.0.0.1', () => {
        http
          .get({ host: '127.0.0.1', port: server.address().port }, (res) => {
            res.resume()
            res.on('end', () => server.close(() => resolve({ status: res.statusCode, header: res.headers['content-disposition'] })))
          })
          .on('error', reject)
      })
  })

test('plain ASCII names are unchanged', () => {
  assert.equal(contentDisposition('attachment', 'talk.mp4'), `attachment; filename="talk.mp4"; filename*=UTF-8''talk.mp4`)
})

test('Japanese and emoji titles are delivered, not a 500', async () => {
  for (const name of ['日本語のテスト.srt', 'Demo 🎬 clip.mp4', 'ñandú café.vtt']) {
    const { status, header } = await roundTrip(contentDisposition('attachment', name))
    assert.equal(status, 200, name)
    assert.match(header, /^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''/)
    const encoded = /filename\*=UTF-8''(.+)$/.exec(header)[1]
    assert.equal(decodeURIComponent(encoded), name)
  }
})

test('the old header would have thrown for the same names', async () => {
  const { status } = await roundTrip('attachment; filename="日本語.mp4"')
  assert.equal(status, 500)
})

test('quotes, backslashes and line breaks cannot break out of the header', async () => {
  const value = contentDisposition('inline', 'a"b\\c\r\nSet-Cookie: x=1.mp4')
  const { status, header } = await roundTrip(value)
  assert.equal(status, 200)
  assert.equal(header.includes('\n'), false)
  assert.equal(value.startsWith('inline; filename="a_b_c__Set-Cookie: x=1.mp4"'), true)
})

test("apostrophes and parentheses are percent-encoded in the filename* form", () => {
  assert.match(contentDisposition('attachment', "it's (a) *test*.mp4"), /filename\*=UTF-8''it%27s%20%28a%29%20%2Atest%2A\.mp4$/)
})
