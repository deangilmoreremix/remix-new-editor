import { describe, it, expect } from 'vitest'
import { addDesignTemplate, applyDesignTemplate, applyLayoutPreset, createDefaultPreviewSettings, removeDesignLayer } from '../presets'
import { listRemotionDesignTemplates } from '../../templates'

const base = () => {
  const s = applyLayoutPreset(createDefaultPreviewSettings(), 'business-introduction')
  return { ...s, layers: s.layers.map((l, i) => (i === 0 ? { ...l, text: 'My own headline', x: 0.31, y: 0.22, locked: true } : l)) }
}
const design = listRemotionDesignTemplates()[0].id

describe('Add vs Replace a design', () => {
  it('Replace (existing behaviour) drops the layout\'s layers', () => {
    const r = applyDesignTemplate(base(), design)
    expect(r.layers).toHaveLength(1)
    expect(r.layers[0].kind).toBe('design')
  })
  it('Add keeps every existing layer exactly and appends one design layer with a new stable id', () => {
    const b = base()
    const r = addDesignTemplate(b, design)
    expect(r.layers).toHaveLength(b.layers.length + 1)
    expect(r.layers.slice(0, b.layers.length)).toEqual(b.layers) // customer edits, positions, locks untouched
    const added = r.layers[r.layers.length - 1]
    expect(added.kind).toBe('design')
    expect(b.layers.map((l) => l.id)).not.toContain(added.id)
    expect(r.remotionDesignId).toBe(design)
  })
  it('Add is idempotent for the same design and a no-op for an unknown id; never mutates its input', () => {
    const b = base(); const snapshot = JSON.stringify(b)
    const once = addDesignTemplate(b, design)
    expect(addDesignTemplate(once, design)).toBe(once)
    expect(addDesignTemplate(b, 'nope')).toBe(b)
    expect(JSON.stringify(b)).toBe(snapshot)
  })
  it('removeDesignLayer takes off only that design layer and keeps the rest', () => {
    const b = base()
    const added = addDesignTemplate(b, design)
    const id = added.layers[added.layers.length - 1].id
    const removed = removeDesignLayer(added, id)
    expect(removed.layers).toEqual(b.layers)
    expect(removed.remotionDesignId).toBeNull()
    expect(removeDesignLayer(b, 'missing')).toBe(b)
  })
})

import { normalizePreviewSettings } from '../presets'
describe('persistence of an added design', () => {
  it('a layout plus an added design survives a JSON save/restore with edits, ids and roles intact', () => {
    const b = base()
    const added = addDesignTemplate(b, design)
    const layers = added.layers.map((l, i) => (i === 1 ? { ...l, imageRole: 'food' as const } : l))
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify({ ...added, layers })))
    expect(restored.layers.map((l) => l.id)).toEqual(layers.map((l) => l.id))
    expect(restored.layers[0]).toMatchObject({ text: 'My own headline', locked: true, x: 0.31, y: 0.22 })
    expect(restored.layers[restored.layers.length - 1].kind).toBe('design')
    expect(restored.layers[1].imageRole).toBe('food')
    expect(restored.remotionDesignId).toBe(design)
  })
})
