import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createUserApiPool, isUserId, PoolBusyError } from './user-apis.mjs'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)
const C = 'c'.repeat(32)
const D = 'd'.repeat(32)

/** A pool whose "API processes" are records, so nothing real is started. */
const makePool = (options = {}) => {
  const started = []
  const stopped = []
  let clock = 1_000
  const pool = createUserApiPool({
    dataRoot: '/data/users',
    basePort: 4000,
    maxActive: 2,
    idleMs: 60_000,
    now: () => clock,
    waitHealthy: async () => {},
    spawnApi: ({ id, port, dataDir, downloadDir }) => {
      started.push({ id, port, dataDir, downloadDir })
      return { stop: () => stopped.push(id) }
    },
    ...options
  })
  return { pool, started, stopped, tick: (ms) => (clock += ms) }
}

describe('per-user API pool', () => {
  it('gives each user their own port and folders', async () => {
    const { pool, started } = makePool()
    const a = await pool.acquire(A)
    const b = await pool.acquire(B)
    assert.notEqual(a.url, b.url)
    assert.deepEqual(started.map((s) => s.dataDir), [`/data/users/${A}/vidbee`, `/data/users/${B}/vidbee`])
    assert.deepEqual(started.map((s) => s.downloadDir), [`/data/users/${A}/downloads`, `/data/users/${B}/downloads`])
  })

  it('reuses one process per user, including for simultaneous first requests', async () => {
    const { pool, started } = makePool()
    const [x, y] = await Promise.all([pool.acquire(A), pool.acquire(A)])
    assert.equal(x.url, y.url)
    assert.equal(started.length, 1)
  })

  it('rejects ids that are not the gate-made 32-hex form (no path tricks)', async () => {
    const { pool } = makePool()
    assert.equal(isUserId(A), true)
    for (const bad of ['', '../etc', 'A'.repeat(32), 'a'.repeat(31), undefined]) {
      assert.equal(isUserId(bad), false)
      await assert.rejects(() => pool.acquire(bad))
    }
  })

  it('at the cap, stops the least recently used idle API to make room', async () => {
    const { pool, stopped, tick } = makePool()
    const a = await pool.acquire(A)
    a.release()
    tick(10)
    const b = await pool.acquire(B)
    b.release()
    tick(10)
    await pool.acquire(C)
    assert.deepEqual(stopped, [A])
  })

  it('at the cap with every API busy, answers busy and stops nobody', async () => {
    const { pool, stopped } = makePool()
    await pool.acquire(A)
    await pool.acquire(B)
    await assert.rejects(() => pool.acquire(C), PoolBusyError)
    assert.deepEqual(stopped, [])
  })

  it('sweep stops only APIs that are idle past the limit and have no open request', async () => {
    const { pool, stopped, tick } = makePool()
    const a = await pool.acquire(A)
    const b = await pool.acquire(B)
    b.release()
    tick(61_000)
    pool.sweep()
    assert.deepEqual(stopped, [B])
    a.release()
    tick(61_000)
    pool.sweep()
    assert.deepEqual(stopped, [B, A])
  })

  it('does not leave a half-started user behind when the API never gets healthy', async () => {
    const { pool, stopped } = makePool({ waitHealthy: async () => { throw new Error('unhealthy') } })
    await assert.rejects(() => pool.acquire(D), /unhealthy/)
    assert.deepEqual(stopped, [D])
  })

  it('restarts a user whose API process exited', async () => {
    const started = []
    let onExit
    const pool = createUserApiPool({
      dataRoot: '/d',
      basePort: 4000,
      maxActive: 2,
      idleMs: 1000,
      waitHealthy: async () => {},
      spawnApi: ({ id }) => {
        started.push(id)
        return { stop() {}, onExit: (cb) => { onExit = cb } }
      }
    })
    await pool.acquire(A)
    onExit()
    await pool.acquire(A)
    assert.equal(started.length, 2)
  })
})
