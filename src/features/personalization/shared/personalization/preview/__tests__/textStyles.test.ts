// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_TEXT_STYLES, addStyle, applyCaptionStyle, applyTextStyle, captureCaptionStyle, captureTextStyle, deleteStyle, normalizeTextStyles,
  readBrowserStyles, renameStyle, rememberInBrowser, uniqueName, BROWSER_STYLES_KEY, type SavedTextStyle,
} from '../textStyles'
import { normalizePreviewSettings } from '../presets'
import type { PreviewLayer } from '../types'

const brand = { primary: '#112233', accent: '#ddeeff', text: '#ffffff' }
const other = { primary: '#aa0000', accent: '#00aa00', text: '#0000aa' }
const layer = { id: 'headline', kind: 'headline', visible: true, x: 0.3, y: 0.4, scale: 1.4, animation: 'pop', animationDelay: 6, startFrame: 12, endFrame: 90, opacity: 0.9, rotation: -5, text: 'Hello', color: '#112233', locked: false, keyframes: [{ frame: 5, easing: 'linear' }] } as unknown as PreviewLayer

afterEach(() => window.localStorage.clear())

describe('captureTextStyle / applyTextStyle', () => {
  it('captures only the look, never text, position, timing, lock or keyframes', () => {
    const look = captureTextStyle(layer, brand)
    expect(Object.keys(look).sort()).toEqual(['animation', 'animationDelay', 'color', 'opacity', 'rotation', 'scale'])
    const patch = applyTextStyle(look, brand)
    for (const k of ['text', 'x', 'y', 'startFrame', 'endFrame', 'locked', 'keyframes']) expect(k in patch).toBe(false)
  })
  it('stores brand colors as references and resolves them against another project', () => {
    const look = captureTextStyle(layer, brand)
    expect(look.color).toBe('@primary')
    expect(applyTextStyle(look, other).color).toBe('#aa0000')
  })
  it('keeps a color that is not a brand color as it is', () => {
    expect(captureTextStyle({ ...layer, color: '#abcdef' }, brand).color).toBe('#abcdef')
  })
  it('clears the rotation and delay a style does not have', () => {
    const patch = applyTextStyle({ scale: 1, opacity: 1, animation: 'fade' }, brand)
    expect(patch.animationDelay).toBe(0)
    expect(patch.rotation).toBeUndefined()
  })
})

describe('captions styles', () => {
  it('keeps only the look (style and position), never the words or timing', () => {
    const look = captureCaptionStyle({ style: 'bold', position: 'top', enabled: true, forUrl: 'x', cues: [{ startMs: 0, endMs: 1, text: 'hi' }] } as never)
    expect(look).toEqual({ style: 'bold', position: 'top' })
    expect(applyCaptionStyle(look)).toEqual({ style: 'bold', position: 'top' })
  })
  it('round-trips a Capite look id through normalizing', () => {
    const [saved] = normalizeTextStyles([{ id: 'a', name: 'Mine', kind: 'captions', style: { style: 'hormozi', position: 'middle' } }]) ?? []
    expect(saved?.kind === 'captions' && saved.style).toEqual({ style: 'hormozi', position: 'middle' })
  })
  it('drops a caption look with an unknown position or a junk id', () => {
    expect(normalizeTextStyles([{ id: 'a', name: 'X', kind: 'captions', style: { style: 'bold', position: 'left' } }])).toBeUndefined()
    expect(normalizeTextStyles([{ id: 'a', name: 'X', kind: 'captions', style: { style: '<b>', position: 'top' } }])).toBeUndefined()
  })
})

describe('list operations', () => {
  const mk = (name: string) => addStyle([], { kind: 'text', name, style: captureTextStyle(layer, brand) } as never).list
  it('makes names unique per kind', () => {
    const list = mk('Hero')
    expect(uniqueName('hero', list, 'text')).toBe('hero 2')
    expect(uniqueName('Hero', list, 'captions')).toBe('Hero')
  })
  it('renames, deletes and caps', () => {
    let list = mk('A')
    list = renameStyle(list, list[0].id, '  B  ')
    expect(list[0].name).toBe('B')
    expect(deleteStyle(list, list[0].id)).toEqual([])
    let full: SavedTextStyle[] = []
    for (let i = 0; i < MAX_TEXT_STYLES; i++) full = addStyle(full, { kind: 'text', name: `s${i}`, style: captureTextStyle(layer, brand) } as never).list
    expect(addStyle(full, { kind: 'text', name: 'x', style: captureTextStyle(layer, brand) } as never).added).toBeNull()
  })
})

describe('normalizeTextStyles', () => {
  it('drops bad entries and clamps', () => {
    const good = mkLook()
    const out = normalizeTextStyles([good, { id: 'x', name: '', kind: 'text', style: good.style }, { id: 'y', name: 'n', kind: 'text', style: { scale: 'a' } }, { ...good, id: good.id }, 5, null])!
    expect(out).toHaveLength(1)
    expect(normalizeTextStyles([{ ...good, style: { ...good.style, scale: 99, color: 'red' } }])![0].style).toMatchObject({ scale: 6 })
    expect(normalizeTextStyles('nope')).toBeUndefined()
    expect(normalizeTextStyles([])).toBeUndefined()
  })
  it('is read by normalizePreviewSettings and absent otherwise', () => {
    const base = normalizePreviewSettings({ textStyles: [mkLook()] } as never)
    expect(base.textStyles).toHaveLength(1)
    expect(normalizePreviewSettings({} as never).textStyles).toBeUndefined()
  })
})

describe('this browser library', () => {
  it('remembers styles, replaces same-name ones, survives bad data and blocked storage', () => {
    const a = mkLook('Hero')
    rememberInBrowser(a)
    rememberInBrowser({ ...a, id: 'other', style: { ...a.style, scale: 2 } } as SavedTextStyle)
    const list = readBrowserStyles()
    expect(list).toHaveLength(1)
    expect((list[0].style as { scale: number }).scale).toBe(2)
    window.localStorage.setItem(BROWSER_STYLES_KEY, '{bad')
    expect(readBrowserStyles()).toEqual([])
    const spy = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked') } })
    expect(readBrowserStyles()).toEqual([])
    expect(() => rememberInBrowser(a)).not.toThrow()
    Object.defineProperty(window, 'localStorage', spy)
  })
})

function mkLook(name = 'Hero'): SavedTextStyle & { kind: 'text' } {
  return { id: `id-${name}`, name, kind: 'text', style: captureTextStyle(layer, brand) }
}
