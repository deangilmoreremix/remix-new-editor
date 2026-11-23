import assert from 'node:assert/strict'
import test from 'node:test'
import { hub } from './electron-stub.mjs'

const listen = (clientId) => {
  const got = []
  const l = Object.assign((channel, args) => got.push({ channel, args }), { clientId })
  hub.listeners.add(l)
  return { got, stop: () => hub.listeners.delete(l) }
}

test('a dialog goes only to the tab that asked, and only that tab can answer', async () => {
  const a = listen('client-aaaaaaaa')
  const b = listen('client-bbbbbbbb')
  const answer = hub.request('open', {}, { canceled: true }, 5000, 'client-aaaaaaaa')
  assert.equal(a.got.length, 1)
  assert.equal(b.got.length, 0)
  const id = a.got[0].args[0].id
  hub.respond(id, { canceled: true }, 'client-bbbbbbbb') // wrong tab: ignored
  hub.respond(id, { filePaths: ['/x'] }, 'client-aaaaaaaa')
  assert.deepEqual(await answer, { filePaths: ['/x'] })
  a.stop(); b.stop()
})

test('a request for a client that is gone resolves with the fallback', async () => {
  assert.deepEqual(await hub.request('open', {}, { canceled: true }, 5000, 'client-gone0000'), { canceled: true })
})
