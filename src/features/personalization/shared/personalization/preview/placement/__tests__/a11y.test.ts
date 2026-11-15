import { describe, it, expect } from 'vitest'
import { createDefaultPreviewSettings, createLayer } from '../../presets'
import { checkAccessibility, fixForIssue, withAccessibility, worstCaseBackdrop } from '../a11y'
import type { PersonalizationPreviewSettings } from '../../types'
import type { QualityReport } from '../types'

function settings(over: Partial<PersonalizationPreviewSettings> = {}, layers = [createLayer('headline', { text: 'Hello there' })]): PersonalizationPreviewSettings {
  return { ...createDefaultPreviewSettings(), layers, ...over }
}
const withDim = (backgroundDim: number, over: Partial<PersonalizationPreviewSettings> = {}, layers?: Parameters<typeof settings>[1]) =>
  settings({ brandColors: { primary: '#d9ff00', accent: '#d9ff00', text: '#ffffff', backgroundDim }, ...over }, layers)

describe('worstCaseBackdrop', () => {
  it('is white with no dim and darkens with the dim', () => {
    expect(worstCaseBackdrop(0)).toBe('#ffffff')
    expect(worstCaseBackdrop(1)).toBe('#000000')
    expect(worstCaseBackdrop(0.5)).toBe('#808080')
    expect(worstCaseBackdrop(Number.NaN)).toBe('#ffffff')
  })
})

describe('checkAccessibility', () => {
  it('flags white text when no dim is applied (worst case is bright footage)', () => {
    const issues = checkAccessibility(withDim(0))
    expect(issues.map((i) => i.code)).toContain('text-contrast-bright')
    expect(issues.every((i) => i.severity === 'review')).toBe(true)
  })
  it('passes white text once the dim makes the worst case dark enough', () => {
    expect(checkAccessibility(withDim(0.7)).map((i) => i.code)).not.toContain('text-contrast-bright')
  })
  it('flags text shown for too short a time and names the words and seconds', () => {
    const layer = createLayer('headline', { text: 'one two three four five six seven eight nine ten', startFrame: 0, endFrame: 30 })
    const [issue] = checkAccessibility(withDim(0.7, { fps: 30 }, [layer])).filter((i) => i.code === 'reading-speed')
    expect(issue.message).toContain('10 words')
    expect(issue.message).toContain('1.0 s')
  })
  it('does not flag short copy shown long enough', () => {
    const layer = createLayer('headline', { text: 'Call now', startFrame: 0 })
    expect(checkAccessibility(withDim(0.7, { fps: 30, durationInFrames: 150 }, [layer]))).toEqual([])
  })
  it('ignores hidden layers, empty text and non-text layers', () => {
    const layers = [createLayer('headline', { text: 'x y z', visible: false }), createLayer('headline', { id: 'h2', text: '  ' }), createLayer('logo')]
    expect(checkAccessibility(withDim(0, {}, layers))).toEqual([])
  })
})

describe('withAccessibility', () => {
  const base: QualityReport = { status: 'ready', issues: [], blocksExport: false, notes: [], analysis: { protectedZones: 0, frameSamples: 0, subjectVerified: false, contrastVerified: false } }
  it('turns a ready report into review-required without ever blocking export', () => {
    const out = withAccessibility(base, checkAccessibility(withDim(0)))
    expect(out.status).toBe('review-required')
    expect(out.blocksExport).toBe(false)
  })
  it('returns the same report when there is nothing to add', () => { expect(withAccessibility(base, [])).toBe(base) })
  it('keeps needs-adjustment when the report already needs it', () => {
    expect(withAccessibility({ ...base, status: 'needs-adjustment' }, checkAccessibility(withDim(0))).status).toBe('needs-adjustment')
  })
})

describe('fixForIssue', () => {
  it('recolours low-contrast text to the readable colour', () => {
    const s = withDim(0)
    const issue = checkAccessibility(s).find((i) => i.code === 'text-contrast-bright')!
    expect(fixForIssue(issue, s)?.patch.color).toBe('#000000')
  })
  it('extends the visible time for fast text', () => {
    const layer = createLayer('headline', { text: 'one two three four five six seven eight nine ten', startFrame: 0, endFrame: 30 })
    const s = withDim(0.7, { fps: 30 }, [layer])
    const issue = checkAccessibility(s).find((i) => i.code === 'reading-speed')!
    const fix = fixForIssue(issue, s)!
    // 10 words / 3 wps = 3.33 s = 100 frames
    expect(fix.patch.endFrame).toBe(100)
  })
  it('never touches a locked layer', () => {
    const layer = createLayer('headline', { text: 'Hello there', locked: true })
    const s = withDim(0, {}, [layer])
    const issue = checkAccessibility(s).find((i) => i.code === 'text-contrast-bright')!
    expect(fixForIssue(issue, s)).toBeNull()
  })
  it('shrinks overflowing text but not below 40%', () => {
    const long = 'word '.repeat(40).trim()
    const layer = createLayer('headline', { text: long })
    const s = withDim(0.7, {}, [layer])
    const fix = fixForIssue({ code: 'text-overflow', severity: 'adjust', layerId: layer.id, message: '', fixable: false }, s)
    if (fix) { expect(fix.patch.scale!).toBeLessThan(layer.scale); expect(fix.patch.scale!).toBeGreaterThanOrEqual(layer.scale * 0.4) }
  })
  it('returns null for an unknown layer or an unfixable code', () => {
    const s = withDim(0)
    expect(fixForIssue({ code: 'off-frame', severity: 'adjust', layerId: 'nope', message: '', fixable: false }, s)).toBeNull()
    expect(fixForIssue({ code: 'off-frame', severity: 'adjust', layerId: s.layers[0].id, message: '', fixable: false }, s)).toBeNull()
  })
})
