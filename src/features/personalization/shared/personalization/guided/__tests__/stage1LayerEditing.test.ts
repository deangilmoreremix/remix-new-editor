/**
 * Stage 1 — advanced layer editing: pure behaviour (no DOM, no Remotion).
 * Covers rotation/zoom/custom-field helpers, settings persistence round-trip,
 * duplicate, z-order, grouping, group-aware move, alignment, snapping and the
 * reusable-layout store.
 */
import { describe, it, expect } from 'vitest'
import {
  applyCustomFields,
  clampImageZoom,
  normalizeCustomFields,
  normalizeRotation,
  normalizeSourceTransform,
  rotationCss,
  sourceMediaStyle,
  wrapRotation,
} from '../../preview/layerTransform'
import { imageMediaStyle, normalizeImageStyle, ROUNDED_RECT_DEFAULT } from '../../preview/imageStyle'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../../preview/presets'
import type { PersonalizationPreviewSettings, PreviewLayer } from '../../preview/types'
import {
  alignLayers,
  computeSnap,
  duplicateLayer,
  groupLayers,
  groupMemberIds,
  layerRect,
  moveLayers,
  reorderLayer,
  ungroupLayers,
} from '../layerOps'
import {
  MAX_SAVED_LAYOUTS,
  applyLayout,
  loadSavedLayouts,
  normalizeSavedLayouts,
  persistSavedLayouts,
  snapshotLayout,
  SAVED_LAYOUTS_KEY,
} from '../savedLayouts'

const W = 1920
const H = 1080

function layer(id: string, kind: PreviewLayer['kind'], patch: Partial<PreviewLayer> = {}): PreviewLayer {
  return {
    id, kind, visible: true, x: 0.5, y: 0.5, scale: 0.3, animation: 'none', animationDelay: 0,
    startFrame: 0, opacity: 1, ...patch,
  }
}

function settingsWith(layers: PreviewLayer[]): PersonalizationPreviewSettings {
  return { ...createDefaultPreviewSettings(), layers }
}

describe('rotation helpers', () => {
  it('wraps any angle into (-180, 180]', () => {
    expect(wrapRotation(190)).toBe(-170)
    expect(wrapRotation(-190)).toBe(170)
    expect(wrapRotation(360)).toBe(0)
    expect(wrapRotation(180)).toBe(180)
    expect(wrapRotation(45.26)).toBe(45.3)
  })
  it('treats non-finite input as 0 and stores 0 as absent', () => {
    expect(wrapRotation(NaN)).toBe(0)
    expect(wrapRotation('x')).toBe(0)
    expect(normalizeRotation(0)).toBeUndefined()
    expect(normalizeRotation(720)).toBeUndefined()
    expect(normalizeRotation(30)).toBe(30)
  })
  it('emits a CSS fragment only when rotated', () => {
    expect(rotationCss(undefined)).toBe('')
    expect(rotationCss(0)).toBe('')
    expect(rotationCss(-12.5)).toBe('rotate(-12.5deg)')
  })
})

describe('source transform (presenter reposition/zoom)', () => {
  it('drops the identity and clamps everything else', () => {
    expect(normalizeSourceTransform({ x: 0.5, y: 0.5, zoom: 1 })).toBeUndefined()
    expect(normalizeSourceTransform(null)).toBeUndefined()
    expect(normalizeSourceTransform([])).toBeUndefined()
    expect(normalizeSourceTransform({ x: 9, y: -3, zoom: 99 })).toEqual({ x: 1, y: 0, zoom: 4 })
    expect(normalizeSourceTransform({ x: 0.2, y: 0.5, zoom: 0.1 })).toEqual({ x: 0.2, y: 0.5, zoom: 1 })
  })
  it('produces identical CSS for pan and zoom', () => {
    expect(sourceMediaStyle(undefined)).toEqual({})
    expect(sourceMediaStyle({ x: 0.25, y: 0.5, zoom: 1 })).toEqual({
      objectPosition: '25% 50%', transform: undefined, transformOrigin: undefined,
    })
    expect(sourceMediaStyle({ x: 0.25, y: 0.75, zoom: 2 })).toEqual({
      objectPosition: '25% 75%', transform: 'scale(2)', transformOrigin: '25% 75%',
    })
  })
})

describe('custom fields', () => {
  it('keeps safe keys and string values only, capped', () => {
    const many: Record<string, string> = {}
    for (let i = 0; i < 30; i++) many[`f${i}`] = 'v'
    expect(Object.keys(normalizeCustomFields(many) ?? {})).toHaveLength(20)
    expect(normalizeCustomFields({ 'bad key': 'x', '1abc': 'x', ok_1: 'y', num: 5 as unknown as string })).toEqual({ ok_1: 'y' })
    expect(normalizeCustomFields({ a: 'x'.repeat(900) })?.a).toHaveLength(500)
    expect(normalizeCustomFields({})).toBeUndefined()
    expect(normalizeCustomFields('nope')).toBeUndefined()
  })
  it('replaces only known keys and never re-scans a value', () => {
    const fields = { city: 'Austin', tricky: '{{city}}' }
    expect(applyCustomFields('Hi from {{ city }}!', fields)).toBe('Hi from Austin!')
    expect(applyCustomFields('{{firstName}} in {{city}}', fields)).toBe('{{firstName}} in Austin')
    expect(applyCustomFields('{{tricky}}', fields)).toBe('{{city}}')
    expect(applyCustomFields('plain', fields)).toBe('plain')
    expect(applyCustomFields('{{city}}', undefined)).toBe('{{city}}')
    expect(applyCustomFields('{{toString}}', {})).toBe('{{toString}}')
  })
})

describe('image zoom', () => {
  it('clamps zoom and stores it only when above 1', () => {
    expect(clampImageZoom(0.2)).toBe(1)
    expect(clampImageZoom(9)).toBe(4)
    expect(clampImageZoom('x')).toBe(1)
    expect(normalizeImageStyle({ zoom: 2.5 })?.zoom).toBe(2.5)
    expect(normalizeImageStyle({ zoom: 1 })?.zoom).toBeUndefined()
  })
  it('applies zoom only when the picture fills its shape', () => {
    const cover = { ...ROUNDED_RECT_DEFAULT, fit: 'cover' as const, cropX: 0.3, cropY: 0.6, zoom: 2 }
    expect(imageMediaStyle(cover)).toEqual({ objectPosition: '30% 60%', transform: 'scale(2)', transformOrigin: '30% 60%' })
    expect(imageMediaStyle({ ...cover, fit: 'contain' })).toEqual({ objectPosition: '30% 60%' })
    expect(imageMediaStyle({ ...cover, fit: 'contain' }, true).transform).toBe('scale(2)')
    expect(imageMediaStyle({ ...cover, zoom: undefined })).toEqual({ objectPosition: '30% 60%' })
  })
})

describe('persistence round-trip (what the save/reload path keeps)', () => {
  it('keeps rotation, group, source transform and custom fields through JSON and normalize', () => {
    const base = createDefaultPreviewSettings()
    const s: PersonalizationPreviewSettings = {
      ...base,
      layers: base.layers.map((l, i) => (i === 0 ? { ...l, rotation: 33, groupId: 'group-1' } : l)),
      sourceTransform: { x: 0.3, y: 0.6, zoom: 1.5 },
      customFields: { city: 'Austin' },
    }
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify(s)))
    expect(restored.layers[0].rotation).toBe(33)
    expect(restored.layers[0].groupId).toBe('group-1')
    expect(restored.sourceTransform).toEqual({ x: 0.3, y: 0.6, zoom: 1.5 })
    expect(restored.customFields).toEqual({ city: 'Austin' })
  })
  it('old projects without the new fields still load, and junk values are dropped', () => {
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify(createDefaultPreviewSettings())))
    expect(restored.layers.every((l) => l.rotation === undefined && l.groupId === undefined)).toBe(true)
    expect(restored.sourceTransform).toBeUndefined()
    expect(restored.customFields).toBeUndefined()
    const junk = normalizePreviewSettings({
      ...createDefaultPreviewSettings(),
      layers: [{ ...layer('a', 'logo'), rotation: 'spin', groupId: 5 }],
      sourceTransform: 'big',
      customFields: [1, 2],
    })
    expect(junk.layers[0].rotation).toBeUndefined()
    expect(junk.layers[0].groupId).toBeUndefined()
    expect(junk.sourceTransform).toBeUndefined()
    expect(junk.customFields).toBeUndefined()
  })
})

describe('duplicateLayer', () => {
  it('inserts an offset, unlocked, ungrouped copy directly above the original', () => {
    const s = settingsWith([
      layer('logo', 'logo', { locked: true, groupId: 'group-1', rotation: 10 }),
      layer('cta', 'cta'),
    ])
    const out = duplicateLayer(s, 'logo', W, H)
    expect(out).not.toBeNull()
    const layers = out!.settings.layers
    expect(layers.map((l) => l.id)).toEqual(['logo', 'logo-2', 'cta'])
    const copy = layers[1]
    expect(copy.locked).toBeUndefined()
    expect(copy.groupId).toBeUndefined()
    expect(copy.rotation).toBe(10)
    expect(copy.x).toBeGreaterThan(0.5)
    expect(copy.placementSource).toBe('manual')
    expect(s.layers).toHaveLength(2) // input untouched
  })
  it('produces unique ids when duplicating repeatedly and refuses design layers', () => {
    let s = settingsWith([layer('logo', 'logo')])
    for (let i = 0; i < 3; i++) s = duplicateLayer(s, 'logo', W, H)!.settings
    expect(new Set(s.layers.map((l) => l.id)).size).toBe(4)
    expect(duplicateLayer(settingsWith([layer('d', 'design', { designId: 'x' })]), 'd', W, H)).toBeNull()
    expect(duplicateLayer(s, 'missing', W, H)).toBeNull()
  })
})

describe('reorderLayer', () => {
  const s = settingsWith([layer('a', 'logo'), layer('b', 'cta'), layer('c', 'offer')])
  const ids = (x: PersonalizationPreviewSettings) => x.layers.map((l) => l.id).join('')
  it('moves one step or to the ends', () => {
    expect(ids(reorderLayer(s, 'a', 'forward'))).toBe('bac')
    expect(ids(reorderLayer(s, 'c', 'backward'))).toBe('acb')
    expect(ids(reorderLayer(s, 'a', 'front'))).toBe('bca')
    expect(ids(reorderLayer(s, 'c', 'back'))).toBe('cab')
  })
  it('returns the same object when nothing can move', () => {
    expect(reorderLayer(s, 'c', 'forward')).toBe(s)
    expect(reorderLayer(s, 'a', 'back')).toBe(s)
    expect(reorderLayer(s, 'zzz', 'front')).toBe(s)
  })
})

describe('group / ungroup', () => {
  const base = settingsWith([layer('a', 'logo'), layer('b', 'cta'), layer('c', 'offer'), layer('d', 'design', { designId: 'x' })])
  it('needs two real layers and excludes designs', () => {
    expect(groupLayers(base, ['a'])).toBeNull()
    expect(groupLayers(base, ['a', 'd'])).toBeNull()
    const g = groupLayers(base, ['a', 'b', 'd'])!
    expect(g.groupId).toBe('group-1')
    expect(g.settings.layers.find((l) => l.id === 'd')!.groupId).toBeUndefined()
    expect(groupMemberIds(g.settings.layers, 'a').sort()).toEqual(['a', 'b'])
    expect(groupMemberIds(g.settings.layers, 'c')).toEqual(['c'])
  })
  it('allocates a fresh group id and dissolves a group left with one member', () => {
    const g1 = groupLayers(base, ['a', 'b'])!.settings
    const g2 = groupLayers(g1, ['b', 'c'])! // b leaves group-1 for group-2
    expect(g2.groupId).toBe('group-2')
    expect(g2.settings.layers.find((l) => l.id === 'a')!.groupId).toBeUndefined() // orphan dissolved
    expect(groupMemberIds(g2.settings.layers, 'b').sort()).toEqual(['b', 'c'])
  })
  it('ungroup removes the whole group', () => {
    const g = groupLayers(base, ['a', 'b', 'c'])!.settings
    const u = ungroupLayers(g, ['a'])
    expect(u.layers.every((l) => l.groupId === undefined)).toBe(true)
    expect(ungroupLayers(base, ['a'])).toBe(base)
  })
})

describe('moveLayers (group-aware)', () => {
  it('moves every member by the same amount', () => {
    const s = settingsWith([layer('a', 'logo', { x: 0.3, y: 0.3, scale: 0.1 }), layer('b', 'logo', { x: 0.6, y: 0.7, scale: 0.1 })])
    const out = moveLayers(s, ['a', 'b'], 0.05, 0.02, W, H)
    expect(out.layers[0].x - 0.3).toBeCloseTo(0.05, 3)
    expect(out.layers[1].x - 0.6).toBeCloseTo(0.05, 3)
    expect(out.layers[0].y - 0.3).toBeCloseTo(0.02, 3)
    expect(out.layers[1].y - 0.7).toBeCloseTo(0.02, 3)
    expect(out.layers[0].placementSource).toBe('manual')
  })
  it('does not deform the group at the frame edge: the whole group stops together', () => {
    const s = settingsWith([layer('a', 'logo', { x: 0.2, y: 0.3 }), layer('b', 'logo', { x: 0.8, y: 0.3 })])
    const out = moveLayers(s, ['a', 'b'], 0.5, 0, W, H)
    const gap = out.layers[1].x - out.layers[0].x
    expect(gap).toBeCloseTo(0.6, 3) // spacing preserved
    expect(out.layers[1].x).toBeLessThan(0.98)
    expect(out.layers[1].x).toBeGreaterThan(0.8) // it did move up to the limit
  })
  it('leaves locked members in place and returns the input when nothing can move', () => {
    const s = settingsWith([layer('a', 'logo', { x: 0.3 }), layer('b', 'logo', { x: 0.6, locked: true })])
    const out = moveLayers(s, ['a', 'b'], 0.05, 0, W, H)
    expect(out.layers[1].x).toBe(0.6)
    expect(out.layers[0].x).toBeGreaterThan(0.3)
    expect(moveLayers(settingsWith([layer('a', 'logo', { locked: true })]), ['a'], 0.1, 0, W, H).layers[0].x).toBe(0.5)
  })
})

describe('alignLayers', () => {
  const rectOf = (s: PersonalizationPreviewSettings, id: string) =>
    layerRect(s.layers.find((l) => l.id === id)!, W, H)
  it('a single layer aligns to the safe area', () => {
    const s = settingsWith([layer('a', 'logo', { x: 0.4, y: 0.4 })])
    const left = alignLayers(s, ['a'], 'left', W, H)
    expect(rectOf(left, 'a').x).toBeCloseTo(0.02, 2)
    const right = alignLayers(s, ['a'], 'right', W, H)
    const r = rectOf(right, 'a')
    expect(r.x + r.w).toBeCloseTo(0.98, 2)
    const c = rectOf(alignLayers(s, ['a'], 'hcenter', W, H), 'a')
    expect(c.x + c.w / 2).toBeCloseTo(0.5, 2)
  })
  it('several layers align to their own bounding box', () => {
    const s = settingsWith([
      layer('a', 'logo', { x: 0.25, y: 0.3 }),
      layer('b', 'logo', { x: 0.7, y: 0.6, scale: 0.2 }),
    ])
    const top = alignLayers(s, ['a', 'b'], 'top', W, H)
    expect(rectOf(top, 'a').y).toBeCloseTo(rectOf(top, 'b').y, 2)
    const bottom = alignLayers(s, ['a', 'b'], 'bottom', W, H)
    const ra = rectOf(bottom, 'a'); const rb = rectOf(bottom, 'b')
    expect(ra.y + ra.h).toBeCloseTo(rb.y + rb.h, 2)
  })
  it('does not move locked layers', () => {
    const s = settingsWith([layer('a', 'logo', { x: 0.4, locked: true })])
    expect(alignLayers(s, ['a'], 'left', W, H).layers[0].x).toBe(0.4)
  })
})

describe('computeSnap', () => {
  const box = (x: number, y: number, w = 0.2, h = 0.1) => ({ x, y, w, h })
  it('snaps the centre to the frame centre and reports a guide', () => {
    const r = computeSnap(box(0.395, 0.1), [])
    expect(r.dx).toBeCloseTo(0.005, 5)
    expect(r.guides).toContainEqual({ axis: 'x', at: 0.5, kind: 'frame' })
  })
  it('snaps edges to the safe area and to other layers', () => {
    expect(computeSnap(box(0.026, 0.3), []).dx).toBeCloseTo(-0.006, 5)
    const other = box(0.6, 0.6, 0.2, 0.1)
    const r = computeSnap(box(0.31, 0.595), [other])
    expect(r.guides.some((g) => g.axis === 'y' && g.kind === 'layer')).toBe(true)
  })
  it('does nothing outside the threshold', () => {
    const r = computeSnap(box(0.25, 0.27), [])
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] })
  })
  it('snaps to the grid only when asked', () => {
    expect(computeSnap(box(0.24, 0.3), [], { grid: null }).dx).toBe(0)
    const r = computeSnap(box(0.2, 0.23), [], { grid: 0.05 })
    expect(r.guides.some((g) => g.kind === 'grid')).toBe(true)
  })
  it('is deterministic', () => {
    const a = computeSnap(box(0.395, 0.298), [box(0.6, 0.6)], { grid: 0.05 })
    const b = computeSnap(box(0.395, 0.298), [box(0.6, 0.6)], { grid: 0.05 })
    expect(a).toEqual(b)
  })
})

describe('saved layouts', () => {
  const a = settingsWith([
    layer('logo', 'logo', { x: 0.1, y: 0.1, scale: 0.2, rotation: 15, text: 'secret', imageUrl: 'https://x/secret.png' }),
    layer('cta', 'cta', { x: 0.7, y: 0.8, locked: true, groupId: 'group-1', text: 'Call Bob' }),
  ])
  it('snapshots geometry only — never text, images or URLs', () => {
    const snap = snapshotLayout({ ...a, sourceTransform: { x: 0.3, y: 0.4, zoom: 2 } }, '  Corner logo  ', 'l1', 123)!
    const json = JSON.stringify(snap)
    expect(json).not.toContain('secret')
    expect(json).not.toContain('Bob')
    expect(snap.name).toBe('Corner logo')
    expect(snap.layers[0]).toMatchObject({ id: 'logo', x: 0.1, rotation: 15 })
    expect(snap.sourceTransform).toEqual({ x: 0.3, y: 0.4, zoom: 2 })
    expect(snapshotLayout(a, '   ', 'l', 1)).toBeNull()
    expect(snapshotLayout(settingsWith([layer('d', 'design')]), 'x', 'l', 1)).toBeNull()
  })
  it("applies onto another prospect's project without touching their content", () => {
    const snap = snapshotLayout(a, 'L', 'l1', 1)!
    const target = settingsWith([
      layer('logo', 'logo', { x: 0.5, y: 0.5, text: 'Other Co', imageUrl: 'https://other/logo.png' }),
      layer('cta-9', 'cta', { text: 'Other CTA' }),
      layer('tag', 'tagline', { x: 0.2 }),
    ])
    const { settings: out, matched } = applyLayout(target, snap)
    expect(matched).toBe(2)
    expect(out.layers[0]).toMatchObject({ x: 0.1, y: 0.1, scale: 0.2, rotation: 15, text: 'Other Co', imageUrl: 'https://other/logo.png' })
    expect(out.layers[1]).toMatchObject({ x: 0.7, y: 0.8, locked: true, text: 'Other CTA' }) // matched by kind
    expect(out.layers[2].x).toBe(0.2) // unmentioned layer untouched
    expect(JSON.stringify(out)).not.toContain('secret')
  })
  it('clears stale rotation/lock when the layout has none', () => {
    const plain = snapshotLayout(settingsWith([layer('logo', 'logo')]), 'P', 'p', 1)!
    const target = settingsWith([layer('logo', 'logo', { rotation: 40, locked: true, groupId: 'g' })])
    const out = applyLayout(target, plain).settings.layers[0]
    expect(out.rotation).toBeUndefined()
    expect(out.locked).toBeUndefined()
    expect(out.groupId).toBeUndefined()
  })
  it('validates stored data and tolerates broken storage', () => {
    expect(normalizeSavedLayouts('x')).toEqual([])
    expect(normalizeSavedLayouts([{ id: 'a', name: '', layers: [] }, { name: 'n' }, null])).toEqual([])
    const good = normalizeSavedLayouts([{ id: 'a', name: 'N', aspectRatio: '1:1', layers: [{ id: 'l', kind: 'logo', x: 5, y: -1, scale: 9, opacity: 2 }, { id: 'd', kind: 'design' }] }])
    expect(good).toHaveLength(1)
    expect(good[0].layers).toEqual([{ id: 'l', kind: 'logo', x: 1, y: 0, scale: 1, opacity: 1, visible: true }])
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, name: `n${i}`, layers: [{ id: 'l', kind: 'logo' }] }))
    expect(normalizeSavedLayouts(many)).toHaveLength(MAX_SAVED_LAYOUTS)

    const mem: Record<string, string> = {}
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } } as unknown as Storage
    expect(persistSavedLayouts(good, store)).toBe(true)
    expect(loadSavedLayouts(store)).toEqual(good)
    mem[SAVED_LAYOUTS_KEY] = '{not json'
    expect(loadSavedLayouts(store)).toEqual([])
    const boom = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('full') } } as unknown as Storage
    expect(loadSavedLayouts(boom)).toEqual([])
    expect(persistSavedLayouts(good, boom)).toBe(false)
    expect(persistSavedLayouts(good, null)).toBe(false)
  })
})
