import assert from 'node:assert/strict'
import test from 'node:test'
import { createExclusive } from '../src/lib/exclusive.ts'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const busy = () => {
  throw new Error('busy')
}

test('two tasks that start together: only one runs (the check used to sit before an await)', async () => {
  const lock = createExclusive()
  let started = 0
  const task = async () => {
    started += 1
    await wait(30) // stands in for the async file validation and ffmpeg
    return 'done'
  }
  const results = await Promise.allSettled([lock.run(task, busy), lock.run(task, busy), lock.run(task, busy)])
  assert.equal(started, 1)
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'rejected', 'rejected'])
})

test('a task finishing does not free the lock for one that is still running', async () => {
  const lock = createExclusive()
  const first = lock.run(() => wait(10), busy)
  await first
  const second = lock.run(() => wait(60), busy)
  await wait(10)
  assert.equal(lock.isBusy(), true)
  await assert.rejects(() => lock.run(() => wait(1), busy), /busy/)
  await second
  assert.equal(lock.isBusy(), false)
})

test('the lock is released when the task fails, including a failure before its first await', async () => {
  const lock = createExclusive()
  await assert.rejects(() => lock.run(async () => { throw new Error('validation failed') }, busy), /validation failed/)
  assert.equal(lock.isBusy(), false)
  assert.equal(await lock.run(async () => 'ok', busy), 'ok')
})
