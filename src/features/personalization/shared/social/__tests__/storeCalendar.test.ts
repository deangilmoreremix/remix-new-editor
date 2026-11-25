import { describe, it, expect, vi } from 'vitest'
import { DraftStore, memoryKV, duplicateDraft, cloneCampaign, createAutosaver, type DraftRecord } from '../draftStore'
import { zonedParts, zonedToTimestamp, viewDays, dayKey, findConflicts, rescheduleToDay, plansByDay, queueBucket, shiftAnchor, isValidTimeZone, formatInZone, timeZoneLabel, type PlanItem } from '../calendar'

const plan = (o: Partial<PlanItem> = {}): PlanItem => ({ id: 'p1', title: 'Post', platforms: ['instagram'], scheduledAt: Date.UTC(2026, 5, 10, 13, 0), status: 'draft', ...o })
const rec = (o: Partial<DraftRecord> = {}): DraftRecord => ({ id: 'd1', updatedAt: 1, title: 'Post', snapshot: { copy: { master: 'hi' }, publishResults: [{ status: 'published' }], requestIds: { a: 'r' } }, plan: plan(), mediaRestorable: true, ...o })

describe('draft store', () => {
  it('saves, restores, lists newest first, removes', async () => {
    const s = new DraftStore(memoryKV())
    await s.save(rec({ id: 'a' }))
    await new Promise((r) => setTimeout(r, 2))
    await s.save(rec({ id: 'b' }))
    expect((await s.list()).map((d) => d.id)).toEqual(['b', 'a'])
    expect((await s.get('a'))?.snapshot.copy.master).toBe('hi')
    await s.remove('a')
    expect(await s.get('a')).toBeUndefined()
  })
  it('reports quota errors in plain language instead of throwing', async () => {
    const kv = { ...memoryKV(), set: async () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }) } }
    const r = await new DraftStore(kv).save(rec())
    expect(r).toMatchObject({ ok: false, reason: 'quota' })
  })
  it('estimates quota defensively', async () => {
    expect(await DraftStore.quota({})).toBeNull()
    expect(await DraftStore.quota({ storage: { estimate: async () => ({ usage: 1, quota: 10 }) } })).toEqual({ usage: 1, quota: 10 })
  })
})

describe('duplication', () => {
  it('gives unique ids and strips publish state of a published post', () => {
    const src = rec({ plan: plan({ status: 'published', requestIds: { instagram: 'req-1' } }) })
    const copy = duplicateDraft(src)
    expect(copy.id).not.toBe(src.id)
    expect(copy.plan.id).toBe(copy.id)
    expect(copy.plan.status).toBe('draft')
    expect(copy.plan.requestIds).toBeUndefined()
    expect(copy.snapshot.publishResults).toBeUndefined()
    expect(copy.snapshot.requestIds).toBeUndefined()
    expect(src.snapshot.publishResults).toBeDefined() // original untouched
  })
  it('retargets platforms/schedule and clones campaigns with an offset', () => {
    const c = duplicateDraft(rec(), { platforms: ['tiktok'], scheduledAt: null })
    expect(c.plan.platforms).toEqual(['tiktok'])
    expect(c.plan.scheduledAt).toBeNull()
    const camp = cloneCampaign([rec({ id: 'x' }), rec({ id: 'y', plan: plan({ scheduledAt: null }) })], 86_400_000)
    expect(new Set(camp.map((d) => d.id)).size).toBe(2)
    expect(camp[0].plan.scheduledAt).toBe(Date.UTC(2026, 5, 11, 13, 0))
    expect(camp[1].plan.scheduledAt).toBeNull()
  })
})

describe('autosaver', () => {
  it('debounces, flushes and cancels', async () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const a = createAutosaver(save, 100)
    a.touch(); a.touch(); a.touch()
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(1)
    a.touch(); expect(a.dirty).toBe(true)
    await a.flush()
    expect(save).toHaveBeenCalledTimes(2)
    a.touch(); a.cancel(); await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('calendar timezone handling', () => {
  it('shows the same instant on different days per timezone', () => {
    const ts = Date.UTC(2026, 5, 10, 2, 30) // 02:30 UTC
    expect(dayKey(ts, 'UTC')).toBe('2026-06-10')
    expect(dayKey(ts, 'America/Los_Angeles')).toBe('2026-06-09')
    expect(dayKey(ts, 'Asia/Tokyo')).toBe('2026-06-10')
    expect(zonedParts(ts, 'Asia/Tokyo')).toMatchObject({ hour: 11, minute: 30 })
  })
  it('round-trips wall-clock time across DST', () => {
    const tz = 'America/New_York'
    const winter = zonedToTimestamp(2026, 1, 15, 9, 0, tz)
    const summer = zonedToTimestamp(2026, 7, 15, 9, 0, tz)
    expect(new Date(winter).toISOString()).toBe('2026-01-15T14:00:00.000Z')
    expect(new Date(summer).toISOString()).toBe('2026-07-15T13:00:00.000Z')
    expect(zonedParts(summer, tz).hour).toBe(9)
  })
  it('builds day/week/month grids honouring week start', () => {
    const a = zonedToTimestamp(2026, 6, 10, 12, 0, 'UTC') // Wed
    expect(viewDays('day', a, 'UTC')).toEqual(['2026-06-10'])
    expect(viewDays('week', a, 'UTC', 0)[0]).toBe('2026-06-07')
    expect(viewDays('week', a, 'UTC', 1)[0]).toBe('2026-06-08')
    const m = viewDays('month', a, 'UTC', 0)
    expect(m.length % 7).toBe(0)
    expect(m).toContain('2026-06-30')
    expect(dayKey(shiftAnchor('month', a, 1, 'UTC'), 'UTC').slice(0, 7)).toBe('2026-07')
    expect(isValidTimeZone('Mars/Base')).toBe(false)
    expect(formatInZone(a, 'UTC', { hour: 'numeric', hourCycle: 'h23' }, 'en-US')).toBe('12')
    expect(timeZoneLabel(a, 'UTC', 'en-US')).toBe('UTC')
  })
})

describe('schedule changes + queue', () => {
  it('reschedules keeping wall-clock time, never moving published posts', () => {
    const tz = 'America/New_York'
    const p = plan({ scheduledAt: zonedToTimestamp(2026, 3, 7, 9, 0, tz) }) // day before US DST starts
    const moved = rescheduleToDay(p, '2026-03-10', tz)
    expect(zonedParts(moved.scheduledAt as number, tz)).toMatchObject({ day: 10, hour: 9, minute: 0 })
    const pub = plan({ status: 'published' })
    expect(rescheduleToDay(pub, '2026-06-20', 'UTC')).toBe(pub)
    expect(rescheduleToDay(plan({ scheduledAt: null }), '2026-06-20', 'UTC').scheduledAt).toBe(Date.UTC(2026, 5, 20, 9, 0))
  })
  it('detects conflicts per shared platform within the window', () => {
    const a = plan({ id: 'a' }), b = plan({ id: 'b', scheduledAt: a.scheduledAt! + 10 * 60_000 })
    const c = plan({ id: 'c', platforms: ['x'], scheduledAt: a.scheduledAt })
    const d = plan({ id: 'd', status: 'published' })
    expect(findConflicts([a, b, c, d])).toEqual([['a', 'b']])
  })
  it('groups by day and maps onto the real publish statuses', () => {
    const m = plansByDay([plan({ id: 'a' }), plan({ id: 'b', scheduledAt: null })], 'UTC')
    expect([...m.keys()]).toEqual(['2026-06-10'])
    expect(queueBucket(plan({ status: 'processing' }))).toBe('inProgress')
    expect(queueBucket(plan({ status: 'uploading' }))).toBe('inProgress')
    expect(queueBucket(plan({ status: 'failed' }))).toBe('failed')
    expect(queueBucket(plan({ status: 'published' }))).toBe('published')
    expect(queueBucket(plan({ scheduledAt: null }))).toBe('drafts')
    expect(queueBucket(plan())).toBe('scheduled')
  })
})

import { Collection } from '../collections'
describe('saved collections', () => {
  it('stores, lists newest first and removes', async () => {
    const c = new Collection(memoryKV(), 'caption-template')
    const a = await c.add('A', 'one')
    await new Promise((r) => setTimeout(r, 2))
    await c.add(' ', 'two')
    expect((await c.list()).map((i) => i.name)).toEqual(['Untitled', 'A'])
    await c.remove(a.id)
    expect(await c.list()).toHaveLength(1)
  })
})

import { defaultKV } from '../draftStore'
describe('defaultKV fallback', () => {
  it('falls back to memory when IndexedDB never answers', async () => {
    const orig = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = { open: () => ({}) } // never fires onsuccess/onerror
    const kv = await defaultKV(50)
    expect(kv.persistent).toBe(false)
    await kv.set('k', { a: 1 })
    expect(await kv.get('k')).toEqual({ a: 1 })
    ;(globalThis as any).indexedDB = orig
  })
  it('falls back to memory when IndexedDB is missing', async () => {
    const orig = (globalThis as any).indexedDB
    delete (globalThis as any).indexedDB
    expect((await defaultKV(50)).persistent).toBe(false)
    ;(globalThis as any).indexedDB = orig
  })
})
