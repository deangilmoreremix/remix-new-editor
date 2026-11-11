// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAPTURE_UPLOAD_TYPES } from '../src/server/motionCaptureWorker'

describe('motion-capture bucket', () => {
  it('accepts every image type the capture worker uploads (WebP and GIF included)', () => {
    const sql = readFileSync('supabase/migrations/20261102000000_lead_finder_personalization.sql', 'utf8')
    const row = sql.slice(sql.indexOf("('motion-capture'"))
    const allowlist = row.slice(row.indexOf('array['), row.indexOf(']') + 1)
    expect(CAPTURE_UPLOAD_TYPES.has('image/webp')).toBe(true)
    expect(CAPTURE_UPLOAD_TYPES.has('image/gif')).toBe(true)
    for (const type of CAPTURE_UPLOAD_TYPES) expect(allowlist).toContain(`'${type}'`)
  })
})
