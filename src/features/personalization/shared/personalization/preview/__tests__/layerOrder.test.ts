import { describe, it, expect } from 'vitest'
import { canMoveLayer, moveLayer, reorderLayers } from '../layerOrder'

const L = (...ids: string[]) => ids.map((id) => ({ id }))
const ids = (l: { id: string }[]) => l.map((x) => x.id)

describe('reorderLayers', () => {
  it('applies the given order', () => {
    expect(ids(reorderLayers(L('a', 'b', 'c'), ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
  })
  it('ignores unknown and repeated ids and keeps unlisted layers at the end in their order', () => {
    expect(ids(reorderLayers(L('a', 'b', 'c', 'd'), ['c', 'zzz', 'c', 'a']))).toEqual(['c', 'a', 'b', 'd'])
  })
  it('never loses or duplicates a layer', () => {
    const out = reorderLayers(L('a', 'b', 'c'), [])
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })
  it('keeps the original objects', () => {
    const layers = [{ id: 'a', x: 1 }, { id: 'b', x: 2 }]
    expect(reorderLayers(layers, ['b', 'a'])[0]).toBe(layers[1])
  })
})

describe('moveLayer', () => {
  const base = L('a', 'b', 'c', 'd')
  it('moves one step either way', () => {
    expect(ids(moveLayer(base, 'b', 'forward'))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(moveLayer(base, 'c', 'backward'))).toEqual(['a', 'c', 'b', 'd'])
  })
  it('moves to the very front or back', () => {
    expect(ids(moveLayer(base, 'a', 'front'))).toEqual(['b', 'c', 'd', 'a'])
    expect(ids(moveLayer(base, 'd', 'back'))).toEqual(['d', 'a', 'b', 'c'])
  })
  it('is a no-op at either end or for an unknown id, and never mutates the input', () => {
    expect(ids(moveLayer(base, 'd', 'forward'))).toEqual(ids(base))
    expect(ids(moveLayer(base, 'a', 'backward'))).toEqual(ids(base))
    expect(ids(moveLayer(base, 'nope', 'front'))).toEqual(ids(base))
    expect(ids(base)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('canMoveLayer', () => {
  it('is false where a move would do nothing', () => {
    const l = L('a', 'b', 'c')
    expect(canMoveLayer(l, 'a', 'back')).toBe(false)
    expect(canMoveLayer(l, 'a', 'forward')).toBe(true)
    expect(canMoveLayer(l, 'c', 'front')).toBe(false)
    expect(canMoveLayer(l, 'c', 'backward')).toBe(true)
    expect(canMoveLayer(l, 'x', 'forward')).toBe(false)
  })
})
