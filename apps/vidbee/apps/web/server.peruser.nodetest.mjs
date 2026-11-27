import assert from 'node:assert/strict'
import http from 'node:http'
import { describe, it } from 'node:test'

// server.mjs imports @vidbee/logger, which only exists after the workspace install; skip cleanly when it is absent.
let createWebServer
let PoolBusyError
try {
  ;({ createWebServer } = await import('./server.mjs'))
  ;({ PoolBusyError } = await import('./user-apis.mjs'))
} catch {
  // not installed here
}

const A = 'a'.repeat(32)
const send = (server, path, headers = {}) =>
  new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      http
        .request({ host: '127.0.0.1', port: server.address().port, path, headers }, (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => server.close(() => resolve({ status: res.statusCode, body, headers: res.headers })))
        })
        .on('error', reject)
        .end()
    })
  })

describe('web server per-user routing', { skip: !createWebServer }, () => {
  const gate = { 'x-vidbee-gate': 'secret' }

  it('refuses to start per-user mode without the gate secret', () => {
    assert.throws(() => createWebServer({ pool: { acquire() {} }, gateToken: '' }), /VIDBEE_GATE_TOKEN/)
  })

  it('answers 400 without a valid user id, and never touches the pool', async () => {
    let calls = 0
    const server = createWebServer({ pool: { acquire: async () => { calls += 1 } }, gateToken: 'secret', basePath: '/vidbee' })
    assert.equal((await send(server, '/vidbee/rpc/x', gate)).status, 400)
    const again = createWebServer({ pool: { acquire: async () => { calls += 1 } }, gateToken: 'secret', basePath: '/vidbee' })
    assert.equal((await send(again, '/vidbee/rpc/x', { ...gate, 'x-smartvid-user': '../etc' })).status, 400)
    assert.equal(calls, 0)
  })

  it('proxies to the API the pool names for that user, then releases it', async () => {
    const api = http.createServer((req, res) => res.end(`api saw ${req.url}`))
    await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve))
    let released = 0
    const pool = { acquire: async (id) => (id === A ? { url: `http://127.0.0.1:${api.address().port}`, release: () => (released += 1) } : assert.fail('wrong user')) }
    const server = createWebServer({ pool, gateToken: 'secret', basePath: '/vidbee' })
    const res = await send(server, '/vidbee/rpc/list', { ...gate, 'x-smartvid-user': A })
    api.close()
    assert.equal(res.status, 200)
    assert.equal(res.body, 'api saw /rpc/list')
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(released, 1)
  })

  it('answers 503 with Retry-After when every slot is busy', async () => {
    const server = createWebServer({ pool: { acquire: async () => { throw new PoolBusyError() } }, gateToken: 'secret', basePath: '/vidbee' })
    const res = await send(server, '/vidbee/rpc/x', { ...gate, 'x-smartvid-user': A })
    assert.equal(res.status, 503)
    assert.equal(res.headers['retry-after'], '30')
  })
})
