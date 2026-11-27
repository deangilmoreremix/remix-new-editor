import { describe, it, expect, vi } from 'vitest'
import { encryptKey, decryptKey } from '../_shared/socialKeyCrypto.js'
import { processJob, runTick, summarize, backoffMs, PUBLISH_ENDPOINTS } from '../_shared/scheduledPublish.js'
import { pushTypeBlock } from '../_shared/pushAdapter.js'
import { handle as keyHandle } from '../social-publish-key.js'

const ENV = { SCHEDULER_KEY_SECRET: Buffer.alloc(32, 7).toString('base64'), SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' }
const KEY = 'muapi-test-key-0123456789'
const json = (status, data) => ({ ok: status < 400, status, json: async () => data })
const job = (o = {}) => ({ id: 'row1', job_key: 'jk1', clerk_user_id: 'user_1', attempts: 0, max_attempts: 3, results: [], jobs: [{ platform: 'instagram', account_id: 5, payload: { account_id: 5, media_url: 'https://cdn/x.mp4', caption: 'hi' } }], ...o })
const harness = (responses) => {
  const calls = []
  const fetchImpl = vi.fn(async (url, init) => { calls.push({ url, method: init?.method || 'GET', body: init?.body && JSON.parse(init.body) }); return responses(url, init, calls) })
  return { fetchImpl, calls }
}
const run = (row, fetchImpl, extra = {}) => {
  const saves = []
  let t = 0
  const p = processJob(row, { key: KEY, fetchImpl, now: () => (t += 10), deadline: 100000, sleep: async () => {}, save: async (patch) => { saves.push(JSON.parse(JSON.stringify(patch.results))) }, ...extra })
  return p.then((s) => ({ s, saves }))
}

describe('key encryption', () => {
  it('round-trips, binds to the owner and detects tampering', () => {
    const blob = encryptKey(KEY, 'user_1', ENV)
    expect(blob).not.toContain(KEY)
    expect(decryptKey(blob, 'user_1', ENV)).toBe(KEY)
    expect(decryptKey(blob, 'user_2', ENV)).toBeNull()
    expect(decryptKey(blob.slice(0, -4) + 'AAAA', 'user_1', ENV)).toBeNull()
    expect(decryptKey(blob, 'user_1', { SCHEDULER_KEY_SECRET: 'x'.repeat(40) })).toBeNull()
    expect(() => encryptKey(KEY, 'user_1', {})).toThrow()
  })
})

describe('publishing a due job', () => {
  it('submits once, polls to completion, records the post url', async () => {
    const { fetchImpl, calls } = harness((url) => url.includes('instagram-publish') ? json(200, { request_id: 'req1' }) : json(200, { status: 'completed', output: { url: 'https://instagram.com/p/abc' } }))
    const { s, saves } = await run(job(), fetchImpl)
    expect(s).toMatchObject({ final: true, outcome: 'published', patch: { status: 'posted' } })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.muapi.ai/api/v1/instagram-publish')
    const last = saves.at(-1)[0]
    expect(last).toMatchObject({ status: 'published', request_id: 'req1', url: 'https://instagram.com/p/abc' })
    expect(saves[0][0].status).toBe('submitting') // duplicate guard written BEFORE the request
  })

  it('never re-sends a destination that already published or has a request id', async () => {
    const { fetchImpl, calls } = harness(() => json(200, { status: 'completed', output: { url: 'https://u' } }))
    const row = job({ results: [{ platform: 'instagram', account_id: 5, status: 'processing', request_id: 'req9' }] })
    const { s } = await run(row, fetchImpl)
    expect(calls.every((c) => c.method === 'GET')).toBe(true) // resumed by polling only
    expect(s.outcome).toBe('published')
    const done = job({ results: [{ platform: 'instagram', account_id: 5, status: 'published', url: 'https://u' }] })
    const h2 = harness(() => json(500, {}))
    expect((await run(done, h2.fetchImpl)).s.outcome).toBe('published')
    expect(h2.calls).toHaveLength(0)
  })

  it('an interrupted submit is marked unknown and NOT posted again', async () => {
    const { fetchImpl, calls } = harness(() => json(200, {}))
    const row = job({ attempts: 1, results: [{ platform: 'instagram', account_id: 5, status: 'submitting' }] })
    const { s } = await run(row, fetchImpl)
    expect(calls).toHaveLength(0)
    expect(s).toMatchObject({ final: true, outcome: 'failed' })
    expect(s.patch.last_error).toMatch(/unknown/i)
  })

  it('a network failure mid-submit is ambiguous, never retried automatically', async () => {
    const { fetchImpl } = harness(() => { throw new Error('socket hang up') })
    const { s } = await run(job(), fetchImpl)
    expect(s.outcome).toBe('failed')
    expect(s.patch.status).toBe('failed')
  })

  it('retries 5xx/429 with backoff up to max attempts, then fails', async () => {
    const { fetchImpl } = harness(() => json(503, {}))
    const first = (await run(job(), fetchImpl)).s
    expect(first).toMatchObject({ final: false, patch: { status: 'scheduled', attempts: 1 } })
    expect(Date.parse(first.patch.next_attempt_at)).toBeGreaterThan(0)
    const last = (await run(job({ attempts: 2, results: [{ platform: 'instagram', account_id: 5, status: 'failed', retryable: true }] }), fetchImpl)).s
    expect(last).toMatchObject({ final: true, outcome: 'failed', patch: { status: 'failed', attempts: 3 } })
    expect(backoffMs(1)).toBe(120000)
    expect(backoffMs(2)).toBe(240000)
  })

  it('does not retry client errors and gives a plain reason', async () => {
    const { fetchImpl } = harness(() => json(409, { detail: 'disconnected' }))
    const { s } = await run(job(), fetchImpl)
    expect(s).toMatchObject({ final: true, outcome: 'failed' })
    expect(s.patch.last_error).toMatch(/not connected/i)
  })

  it('manual retry (attempts reset) re-sends a cleanly failed destination but not an ambiguous one', async () => {
    const jobs = [
      { platform: 'instagram', account_id: 5, payload: { a: 1 } },
      { platform: 'x', account_id: 6, payload: { b: 1 } },
    ]
    const results = [
      { platform: 'instagram', account_id: 5, status: 'failed', permanent: true, error: 'gone' },
      { platform: 'x', account_id: 6, status: 'failed', permanent: true, ambiguous: true, error: 'unknown' },
    ]
    const { fetchImpl, calls } = harness((url) => (url.includes('instagram-publish') ? json(200, { request_id: 'r2' }) : json(200, { status: 'completed', output: { url: 'https://i' } })))
    await run(job({ jobs, results, attempts: 0 }), fetchImpl)
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url.split('/').pop())).toEqual(['instagram-publish'])
  })

  it('a failed result LOOKUP on an accepted post is unknown, kept, and never re-sent by Retry', async () => {
    const { fetchImpl, calls } = harness((url) => (url.includes('-publish') ? json(200, { request_id: 'r1' }) : json(404, {})))
    const first = (await run(job(), fetchImpl)).s
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1) // submitted exactly once
    expect(first.outcome).toBe('failed')
    const res = first.patch
    expect(res.last_error).toMatch(/already sent|may still go live/i)
    // the stored result keeps the request id and is ambiguous
    const saved = []
    calls.length = 0
    await processJob(job(), { key: KEY, fetchImpl, now: () => 1, deadline: 99999, sleep: async () => {}, save: async (p) => saved.push(JSON.parse(JSON.stringify(p.results))) })
    const stored = saved.at(-1)[0]
    expect(stored).toMatchObject({ status: 'failed', ambiguous: true, request_id: 'r1' })
    // owner presses Retry (attempts reset to 0, everything finished): must NOT submit again
    const h2 = harness(() => json(200, { request_id: 'r2' }))
    await run(job({ attempts: 0, results: [stored] }), h2.fetchImpl)
    expect(h2.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('a resumed first attempt is not mistaken for a manual retry', async () => {
    const jobs = [{ platform: 'instagram', account_id: 5, payload: { a: 1 } }, { platform: 'x', account_id: 6, payload: { b: 1 } }]
    // instagram failed permanently earlier in this run; x is still processing (tick ran out of time). attempts is still 0.
    const results = [
      { platform: 'instagram', account_id: 5, status: 'failed', permanent: true, error: 'gone' },
      { platform: 'x', account_id: 6, status: 'processing', request_id: 'rx' },
    ]
    const { fetchImpl, calls } = harness(() => json(200, { status: 'processing' }))
    await run(job({ jobs, results, attempts: 0 }), fetchImpl, { now: (() => { let t = 0; return () => (t += 40000) })(), deadline: 100000 })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0) // no automatic resubmission
  })

  it('stops at the deadline and resumes later without losing the request id', async () => {
    const { fetchImpl } = harness((url) => (url.includes('-publish') ? json(200, { request_id: 'r1' }) : json(200, { status: 'processing' })))
    let t = 0
    const { s, saves } = await run(job(), fetchImpl, { now: () => (t += 5000), deadline: 25000 })
    expect(s).toMatchObject({ final: false, patch: { status: 'publishing' } })
    expect(saves.at(-1)[0]).toMatchObject({ status: 'processing', request_id: 'r1' })
  })

  it('only allows the known MuAPI publish endpoints', async () => {
    expect(Object.keys(PUBLISH_ENDPOINTS).sort()).toEqual(['facebook', 'instagram', 'linkedin', 'pinterest', 'threads', 'tiktok', 'x', 'youtube'])
    const { fetchImpl, calls } = harness(() => json(200, {}))
    const { s } = await run(job({ jobs: [{ platform: 'evil/../admin', account_id: 1, payload: {} }] }), fetchImpl)
    expect(calls).toHaveLength(0)
    expect(s.outcome).toBe('failed')
  })

  it('summarize: partial success is reported as failed with counts', () => {
    const jobs = [{ platform: 'a', account_id: 1 }, { platform: 'b', account_id: 2 }]
    const s = summarize({ attempts: 0, max_attempts: 3 }, jobs, [{ platform: 'a', account_id: 1, status: 'published' }, { platform: 'b', account_id: 2, status: 'failed', permanent: true, error: 'nope' }], Date.now())
    expect(s).toMatchObject({ final: true, outcome: 'failed', published: 1, total: 2 })
  })
})

describe('scheduler tick', () => {
  const mkCall = (rows, creds) => {
    const log = []
    const call = async (path, opts = {}) => {
      log.push({ path, ...opts })
      if (path.startsWith('rpc/claim')) return rows
      if (path.startsWith('social_publish_credentials')) return creds
      return null
    }
    return { call, log }
  }
  it('publishes with the decrypted key, stores results and writes a notification', async () => {
    const { call, log } = mkCall([job()], [{ key_ciphertext: encryptKey(KEY, 'user_1', ENV) }])
    const { fetchImpl } = harness((url, init) => { expect(init.headers['x-api-key']).toBe(KEY); return url.includes('-publish') ? json(200, { request_id: 'r' }) : json(200, { status: 'completed', output: { url: 'https://u' } }) })
    const out = await runTick({ call, fetchImpl, env: ENV, sleep: async () => {} })
    expect(out).toMatchObject({ claimed: 1, posted: 1 })
    expect(log.find((l) => l.path === 'owner_notifications').body).toMatchObject({ type: 'post_published', dedupe_key: 'post:jk1:published' })
    expect(log.some((l) => l.method === 'PATCH' && l.body?.status === 'posted')).toBe(true)
    expect(JSON.stringify(log)).not.toContain(KEY)
  })
  it('fails visibly (never silently) when the stored key is missing', async () => {
    const { call, log } = mkCall([job()], [])
    const out = await runTick({ call, fetchImpl: vi.fn(), env: ENV })
    expect(out.no_key).toBe(1)
    expect(log.find((l) => l.method === 'PATCH').body.status).toBe('failed')
    expect(log.find((l) => l.path === 'owner_notifications').body.type).toBe('post_failed')
  })
  it('a slow job cannot starve the jobs behind it in the same tick', async () => {
    const mk = (id, acct) => job({ id, job_key: id, clerk_user_id: 'user_1', jobs: [{ platform: 'instagram', account_id: acct, payload: { a: acct } }] })
    const { call } = mkCall([mk('slow', 1), mk('b', 2), mk('c', 3)], [{ key_ciphertext: encryptKey(KEY, 'user_1', ENV) }])
    let t = 0
    const submitted = []
    const fetchImpl = vi.fn(async (url, init) => {
      t += 1000
      if (url.includes('-publish')) { submitted.push(JSON.parse(init.body).a); return json(200, { request_id: `r${submitted.length}` }) }
      return json(200, { status: 'processing' }) // every result check says "still processing"
    })
    await runTick({ call, fetchImpl, env: ENV, now: () => t, budgetMs: 22000, sleep: async () => { t += 2000 } })
    expect(submitted).toEqual([1, 2, 3]) // all three were submitted in this one tick
  })
  it('reports a claim failure instead of throwing', async () => {
    const out = await runTick({ call: async () => { throw Object.assign(new Error('x'), { status: 404 }) }, env: ENV })
    expect(out.error).toBe('claim_failed_404')
  })
})

describe('push + key endpoint', () => {
  it('publish results push by default and can only be muted via push_types', () => {
    expect(pushTypeBlock({ enabled_types: ['new_lead'], push_types: null }, 'post_published')).toBeNull()
    expect(pushTypeBlock({ enabled_types: [], push_types: ['new_lead'] }, 'post_failed')).toBe('type_push_disabled')
    expect(pushTypeBlock({ enabled_types: ['new_lead'] }, 'high_interest')).toBe('type_disabled')
  })
  it('stores the key encrypted, requires consent, never returns it', async () => {
    const stored = []
    const fetchImpl = vi.fn(async (url, init) => { stored.push({ url, init }); return { ok: true, status: 200, text: async () => '' } })
    const ev = (m, body) => ({ httpMethod: m, body: body && JSON.stringify(body), auth: { userId: 'user_1' } })
    expect((await keyHandle(ev('PUT', { apiKey: KEY }), { env: ENV, fetchImpl })).statusCode).toBe(400)
    expect((await keyHandle(ev('PUT', { apiKey: 'short', consent: true }), { env: ENV, fetchImpl })).statusCode).toBe(400)
    const ok = await keyHandle(ev('PUT', { apiKey: KEY, consent: true }), { env: ENV, fetchImpl })
    expect(ok.statusCode).toBe(200)
    expect(ok.body).not.toContain(KEY)
    const sent = JSON.parse(stored.at(-1).init.body)
    expect(sent.key_ciphertext).not.toContain(KEY)
    expect(decryptKey(sent.key_ciphertext, 'user_1', ENV)).toBe(KEY)
    expect((await keyHandle(ev('PUT', { apiKey: KEY, consent: true }), { env: {}, fetchImpl })).statusCode).toBe(503)
  })
  it('turning it off removes the key and cancels pending automatic jobs', async () => {
    const calls = []
    const fetchImpl = vi.fn(async (url, init) => { calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => '' } })
    const r = await keyHandle({ httpMethod: 'DELETE', auth: { userId: 'user_1' } }, { env: ENV, fetchImpl })
    expect(r.statusCode).toBe(200)
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: { status: 'cancelled' } })
    expect(calls[1]).toMatchObject({ method: 'DELETE' })
    expect(calls[0].url).toContain('auto_publish=eq.true')
  })
})
