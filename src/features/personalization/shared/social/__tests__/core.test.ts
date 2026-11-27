import { describe, it, expect, vi } from 'vitest'
import { PLATFORM_ORDER, buildPublishPayload } from '../../api/socialPayloads'
import { PLATFORM_PRESETS, closestAspect, aspectWarning, acceptsMedia } from '../platformConfig'
import { detectCapabilities, aiAvailability } from '../capabilities'
import { rewriteCaption, summarizeText, translateText, AiUnavailableError, shortenLocal, bulletsLocal } from '../copyTools'
import { extractKeywords, suggestHashtags, dedupeTags, appendHashtags, detectNiche } from '../hashtags'
import { parseSubtitles, toSrt, toVtt, shiftCues, validateCues, parseTimestamp } from '../subtitles'
import { validatePost, validateFileType, hasBlockingErrors, similarity, temporaryMediaScheduleError, TEMP_UPLOAD_SAFE_MS } from '../validation'
import { computeReframe, clampTrim, presetTrim, estimateVideoBytes, limitResolution, even } from '../mediaPrep'
import { exportFilename, slug } from '../exportNames'
import { copyText, readClipboardText, imagesFromPasteEvent } from '../clipboard'
import { requestNotificationPermission, notify, dueNow } from '../notifications'

describe('MuAPI regression guard', () => {
  it('never adds schedule/local-only fields to any platform payload', () => {
    for (const platform of PLATFORM_ORDER) {
      const { payload } = buildPublishPayload({ platform, accountId: 7, mediaUrl: 'https://cdn.example.com/a.mp4', mediaType: 'video', copy: { master: 'hi', title: 'T' } })
      if (!payload) continue
      const keys = Object.keys(payload).join(',')
      expect(keys).not.toMatch(/schedul|publish_at|alt|timezone|draft/i)
      expect(payload.account_id).toBe(7)
    }
  })
})

describe('platform config', () => {
  it('reuses MuAPI hard limits instead of redefining them', () => {
    expect(PLATFORM_PRESETS.x.hardCaptionMax).toBe(280)
    expect(PLATFORM_PRESETS.youtube.hardTitleMax).toBe(100)
    expect(PLATFORM_PRESETS.tiktok.hardTitleMax).toBe(150)
  })
  it('detects aspect and warns on mismatch', () => {
    expect(closestAspect(1080, 1920)).toBe('9:16')
    expect(closestAspect(1000, 1333)).toBeNull()
    expect(aspectWarning('tiktok', 1920, 1080)).toMatch(/9:16/)
    expect(aspectWarning('tiktok', 1080, 1920)).toBeNull()
    expect(acceptsMedia('youtube', 'image')).toBe(false)
  })
})

describe('capabilities + fallbacks', () => {
  it('reports everything unsupported for an empty environment', () => {
    const c = detectCapabilities({})
    expect(Object.values({ ...c, notificationPermission: 0 }).filter((v) => v === true)).toHaveLength(0)
    expect(c.notificationPermission).toBe('unsupported')
  })
  it('maps availability states and swallows errors', async () => {
    expect(await aiAvailability('prompt', {})).toBe('unavailable')
    expect(await aiAvailability('summarizer', { Summarizer: { availability: async () => 'downloadable' } })).toBe('downloadable')
    expect(await aiAvailability('translator', { Translator: { availability: async () => { throw new Error('x') } } })).toBe('unavailable')
  })
  it('refuses AI calls when unsupported and never downloads without consent', async () => {
    await expect(rewriteCaption('hello', 'short', { g: {} })).rejects.toBeInstanceOf(AiUnavailableError)
    const create = vi.fn()
    const g = { Summarizer: { availability: async () => 'downloadable', create } }
    await expect(summarizeText('long text', 'caption', { g })).rejects.toThrow(/download/i)
    expect(create).not.toHaveBeenCalled()
    const g2 = { Translator: { availability: async () => 'unavailable' } }
    await expect(translateText('hi', 'en', 'es', { g: g2 })).rejects.toThrow(/not available/i)
  })
  it('runs the Prompt API when available and destroys the session', async () => {
    const destroy = vi.fn()
    const g = { LanguageModel: { availability: async () => 'available', create: async () => ({ prompt: async () => ' Rewritten ', destroy }) } }
    expect(await rewriteCaption('hello', 'professional', { g })).toBe('Rewritten')
    expect(destroy).toHaveBeenCalled()
  })
  it('has deterministic local fallbacks', () => {
    expect(shortenLocal('word '.repeat(100), 50).length).toBeLessThanOrEqual(50)
    expect(bulletsLocal('One thing here. Two things there! Three? Four items now.', 2)).toHaveLength(2)
  })
})

describe('hashtags', () => {
  it('extracts keywords, ignores stopwords and dedupes', () => {
    const k = extractKeywords('Training for a marathon: marathon training plans and running tips #Running')
    expect(k[0]).toBe('running')
    expect(k).toContain('marathon')
    expect(k).not.toContain('and')
    expect(new Set(k).size).toBe(k.length)
  })
  it('suggests niche tags without duplicating existing ones', () => {
    const s = suggestHashtags('my gym workout routine', { existing: ['#gym'] })
    expect(s).not.toContain('gym')
    expect(detectNiche('best gym workout')).toBe('fitness')
    expect(s).toContain('fitness')
  })
  it('appends only missing tags and normalises', () => {
    expect(dedupeTags(['#A', 'a', '#B!'])).toEqual(['a', 'b'])
    expect(appendHashtags('Hello #one', ['one', '#Two'])).toBe('Hello #one\n\n#two')
  })
})

describe('subtitles', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld\n'
  it('round-trips SRT and converts to VTT', () => {
    const cues = parseSubtitles(srt)
    expect(cues).toHaveLength(2)
    expect(toSrt(cues)).toBe(srt)
    expect(toVtt(cues)).toMatch(/^WEBVTT\n\n1\n00:00:01\.000 --> 00:00:02\.500/)
    expect(parseSubtitles(toVtt(cues))).toEqual(cues.map((c, i) => ({ ...c, id: String(i + 1) })))
  })
  it('skips malformed blocks, shifts and flags overlaps', () => {
    expect(parseSubtitles('garbage\n\n1\n00:00:05,000 --> 00:00:04,000\nbad')).toEqual([])
    expect(parseTimestamp('01:02.5')).toBe(62.5)
    expect(parseTimestamp('nope')).toBeNull()
    const shifted = shiftCues(parseSubtitles(srt), -2)
    expect(shifted[0].start).toBe(0)
    expect(validateCues([{ start: 0, end: 2, text: 'a' }, { start: 1, end: 3, text: 'b' }])[0]).toMatch(/overlaps/)
  })
})

describe('validation', () => {
  const base = { platforms: ['x' as const], mediaType: 'video' as const, mediaUrl: 'https://cdn.example.com/a.mp4', captions: { x: 'hello' }, now: 1000 }
  it('passes a valid post with no errors', () => expect(hasBlockingErrors(validatePost(base))).toBe(false))
  it('blocks only on real errors; recommendations stay warnings', () => {
    const f = validatePost({ ...base, captions: { x: 'a'.repeat(300) }, hasCaptions: false, mediaWidth: 1080, mediaHeight: 1080 })
    expect(f.find((x) => x.id === 'len-x')?.severity).toBe('error')
    expect(f.find((x) => x.id === 'captions-missing')?.severity).toBe('warning')
    expect(validatePost({ ...base, hasCaptions: false }).some((x) => x.severity === 'error')).toBe(false)
  })
  it('flags missing media, past schedules, missing alt, YouTube title and duplicates', () => {
    expect(validatePost({ ...base, mediaUrl: undefined }).some((x) => x.id === 'media-missing')).toBe(true)
    expect(validatePost({ ...base, scheduledAt: 500 }).some((x) => x.id === 'sched-past')).toBe(true)
    expect(validatePost({ ...base, scheduledAt: NaN }).some((x) => x.id === 'sched-invalid')).toBe(true)
    expect(validatePost({ ...base, mediaType: 'image', platforms: ['instagram'], captions: { instagram: 'x' } }).some((x) => x.id === 'alt-missing')).toBe(true)
    expect(validatePost({ ...base, platforms: ['youtube'], captions: { youtube: 'd' } }).some((x) => x.id === 'yt-title')).toBe(true)
    const dup = validatePost({ ...base, scheduledAt: 5000, otherSchedules: [{ id: 'o', scheduledAt: 5000, platforms: ['x'], caption: 'HELLO' }] })
    expect(dup.map((x) => x.id)).toEqual(expect.arrayContaining(['dup-o', 'dup-content']))
  })
  it('validates file types and similarity', () => {
    expect(validateFileType('video/mp4')).toMatchObject({ ok: true, kind: 'video' })
    expect(validateFileType('application/pdf').ok).toBe(false)
    expect(similarity('a b c', 'a b c')).toBe(1)
  })
})

describe('media prep', () => {
  it('fit letterboxes and fill crops with focus', () => {
    const fit = computeReframe(1920, 1080, '9:16', 'fit')
    expect(fit.dw).toBe(1080)
    expect(fit.dy).toBeGreaterThan(0)
    const fill = computeReframe(1920, 1080, '9:16', 'fill', { x: 0, y: 0.5 })
    expect(fill.sx).toBe(0)
    expect(fill.sw / fill.sh).toBeCloseTo(9 / 16)
    expect(computeReframe(1920, 1080, '1:1', 'fill', { x: 5, y: 5 }).sx + 1080).toBeCloseTo(1920)
    expect(() => computeReframe(0, 0, '1:1', 'fit')).toThrow()
    expect(computeReframe(100, 100, '16:9', 'fit', undefined, 960).out).toEqual({ w: 960, h: 540 })
  })
  it('clamps trims and presets', () => {
    expect(clampTrim({ start: -3, end: 99 }, 20)).toEqual({ start: 0, end: 20 })
    expect(clampTrim({ start: 19.9, end: 20 }, 20).end - clampTrim({ start: 19.9, end: 20 }, 20).start).toBeCloseTo(0.5)
    expect(presetTrim(60, 30)).toEqual({ start: 0, end: 30 })
  })
  it('estimates sizes and limits resolution without upscaling', () => {
    expect(estimateVideoBytes('small', 10)).toBeLessThan(estimateVideoBytes('high', 10))
    expect(limitResolution(1920, 1080, 1280)).toEqual({ w: 1280, h: 720 })
    expect(limitResolution(640, 360, 1280)).toEqual({ w: 640, h: 360 })
    expect(even(7)).toBe(8)
  })
})

describe('export names', () => {
  it('creates clear safe filenames', () => {
    expect(slug('Café Launch!! 2026')).toBe('cafe-launch-2026')
    expect(exportFilename('thumbnail', 'My Reel', '.png', { platform: 'youtube', aspect: '16:9', date: new Date('2026-01-02T00:00:00Z') })).toBe('my-reel_youtube_16x9_thumbnail_2026-01-02.png')
  })
})

describe('clipboard (permission denial + unsupported)', () => {
  it('handles unsupported, denied and success', async () => {
    expect((await copyText('x', {})).ok).toBe(false)
    const denied = await copyText('x', { clipboard: { writeText: async () => { throw Object.assign(new Error('n'), { name: 'NotAllowedError' }) } } })
    expect(denied).toMatchObject({ ok: false, reason: 'denied' })
    expect((await copyText('x', { clipboard: { writeText: async () => {} } })).ok).toBe(true)
    expect(await readClipboardText({ clipboard: { readText: async () => '' } })).toMatchObject({ ok: false, reason: 'empty' })
  })
  it('extracts pasted images only', () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' })
    const items = [{ kind: 'file', type: 'image/png', getAsFile: () => f }, { kind: 'string', type: 'text/plain', getAsFile: () => null }]
    expect(imagesFromPasteEvent({ clipboardData: { items } })).toEqual([f])
  })
})

describe('notifications', () => {
  it('only asks when undecided and never throws', async () => {
    expect(await requestNotificationPermission({})).toBe('unsupported')
    const ask = vi.fn(async () => 'granted')
    expect(await requestNotificationPermission({ Notification: { permission: 'default', requestPermission: ask } })).toBe('granted')
    const ask2 = vi.fn()
    expect(await requestNotificationPermission({ Notification: { permission: 'denied', requestPermission: ask2 } })).toBe('denied')
    expect(ask2).not.toHaveBeenCalled()
  })
  it('notifies only when granted', () => {
    const ctor = vi.fn() as any
    ctor.permission = 'denied'
    expect(notify('published', 'x', { Notification: ctor })).toBe(false)
    ctor.permission = 'granted'
    expect(notify('failed', 'x', { Notification: ctor })).toBe(true)
  })
  it('finds due plans once', () => {
    const plans = [{ id: 'a', scheduledAt: 5, status: 'draft' }, { id: 'b', scheduledAt: 5, status: 'published' }, { id: 'c', scheduledAt: 99, status: 'draft' }]
    expect(dueNow(plans, 10).map((p) => p.id)).toEqual(['a'])
    expect(dueNow(plans, 10, new Set(['a']))).toEqual([])
  })
})

describe('temporary upload links vs automatic scheduling', () => {
  const now = 1_000_000_000_000
  const pub = 'https://cdn.example.com/a.mp4'
  it('allows permanent public links at any time', () => {
    expect(temporaryMediaScheduleError({ mediaUrl: pub, scheduledAt: now + 30 * 86_400_000 }, now)).toBe('')
    expect(temporaryMediaScheduleError({ mediaUrl: pub, coverUrls: ['https://cdn.example.com/c.png'], scheduledAt: now + 86_400_000 }, now)).toBe('')
  })
  it('blocks a device-only file scheduled beyond the safe window, before anything is uploaded', () => {
    const msg = temporaryMediaScheduleError({ mediaUrl: 'blob:abc', scheduledAt: now + TEMP_UPLOAD_SAFE_MS + 60_000 }, now)
    expect(msg).toMatch(/expires in about an hour/)
    expect(msg).toMatch(/permanent public https link/)
    expect(temporaryMediaScheduleError({ mediaUrl: 'data:image/png;base64,xx', scheduledAt: now + 3 * 3_600_000 }, now)).not.toBe('')
  })
  it('allows a device-only file inside the safe window, and when there is no time yet', () => {
    expect(temporaryMediaScheduleError({ mediaUrl: 'blob:abc', scheduledAt: now + 10 * 60_000 }, now)).toBe('')
    expect(temporaryMediaScheduleError({ mediaUrl: 'blob:abc', scheduledAt: now + TEMP_UPLOAD_SAFE_MS }, now)).toBe('')
    expect(temporaryMediaScheduleError({ mediaUrl: 'blob:abc', scheduledAt: null }, now)).toBe('')
  })
  it('also blocks when only the cover image is device-only, and says so', () => {
    const msg = temporaryMediaScheduleError({ mediaUrl: pub, coverUrls: [undefined, 'data:image/png;base64,xx'], scheduledAt: now + 5 * 3_600_000 }, now)
    expect(msg).toMatch(/^The cover image/)
  })
})
