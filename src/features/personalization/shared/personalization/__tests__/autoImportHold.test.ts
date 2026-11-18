// @vitest-environment jsdom
/**
 * "Cut out first, then place": automatic placement of the found logo / photos
 * waits for their background removal, but only while cutouts are expected and
 * only for a limited time. Every other case places the originals immediately,
 * exactly as before background removal existed.
 */
import { describe, it, expect } from 'vitest'
import type { DiscoveredAsset } from '../types'
import { AUTO_IMPORT_CUTOUT_WAIT_MS, isCutoutPending, shouldHoldAutoImport } from '../backgroundRemoval/useAutoCutout'

function asset(id: string, overrides: Partial<DiscoveredAsset> = {}): DiscoveredAsset {
  return {
    id,
    previewUrl: `https://shop.example/${id}.jpg`,
    sourceUrl: `https://shop.example/${id}.jpg`,
    sourceType: 'WEBSITE',
    category: 'product',
    selected: false,
    recommended: true,
    rejected: false,
    assignedSection: null,
    autoAssigned: false,
    ...overrides,
  } as DiscoveredAsset
}

const on = { willAutoCutOut: true, waitedMs: 0 }

describe('isCutoutPending', () => {
  it('is pending when queued, running, or untouched and eligible', () => {
    expect(isCutoutPending(asset('a'))).toBe(true)
    expect(isCutoutPending(asset('a', { bgRemoval: { status: 'queued' } }))).toBe(true)
    expect(isCutoutPending(asset('a', { bgRemoval: { status: 'running', progress: 0.4 } }))).toBe(true)
  })
  it('is settled when done, skipped, failed, restored, rejected, already edited or transparent', () => {
    for (const bgRemoval of [{ status: 'done' }, { status: 'skipped' }, { status: 'error' }] as const) {
      expect(isCutoutPending(asset('a', { bgRemoval: { ...bgRemoval } }))).toBe(false)
    }
    expect(isCutoutPending(asset('a', { bgOptOut: true, bgRemoval: { status: 'idle' } }))).toBe(false)
    expect(isCutoutPending(asset('a', { rejected: true }))).toBe(false)
    expect(isCutoutPending(asset('a', { edited: true, editedDataUrl: 'data:image/png;base64,AA==' }))).toBe(false)
    expect(isCutoutPending(asset('a', { hasTransparency: true }))).toBe(false)
  })
})

describe('shouldHoldAutoImport', () => {
  const found = [asset('logo'), asset('p1'), asset('p2'), asset('extra')]

  it('holds while any picked asset is still waiting for its cutout', () => {
    const progressing = [asset('logo', { bgRemoval: { status: 'done' } }), asset('p1', { bgRemoval: { status: 'running' } }), asset('extra')]
    expect(shouldHoldAutoImport(['logo', 'p1'], progressing, on)).toBe(true)
  })

  it('places as soon as every pick has settled, even if other found assets are still queued', () => {
    const settled = [asset('logo', { bgRemoval: { status: 'skipped' } }), asset('p1', { bgRemoval: { status: 'done' } }), asset('extra', { bgRemoval: { status: 'queued' } })]
    expect(shouldHoldAutoImport(['logo', 'p1'], settled, on)).toBe(false)
  })

  it('a failed cutout does not block placement', () => {
    const failed = [asset('p1', { bgRemoval: { status: 'error', message: 'x' } })]
    expect(shouldHoldAutoImport(['p1'], failed, on)).toBe(false)
  })

  it('never holds when cutouts are not expected (auto off, declined, or model failed)', () => {
    expect(shouldHoldAutoImport(['logo', 'p1'], found, { willAutoCutOut: false, waitedMs: 0 })).toBe(false)
  })

  it('stops waiting after the limit and places the originals', () => {
    expect(shouldHoldAutoImport(['p1'], found, { willAutoCutOut: true, waitedMs: AUTO_IMPORT_CUTOUT_WAIT_MS - 1 })).toBe(true)
    expect(shouldHoldAutoImport(['p1'], found, { willAutoCutOut: true, waitedMs: AUTO_IMPORT_CUTOUT_WAIT_MS })).toBe(false)
  })

  it('does not hold when nothing is picked', () => {
    expect(shouldHoldAutoImport([], found, on)).toBe(false)
  })
})
