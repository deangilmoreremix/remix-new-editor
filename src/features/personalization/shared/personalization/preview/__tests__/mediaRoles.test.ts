import { describe, it, expect } from 'vitest'
import {
  MEDIA_ROLE_CONTRACTS,
  PICTURE_IN_PICTURE_DESIGN_IDS,
  FULL_FRAME_DESIGN_IDS,
  contractFor,
  layerZIndex,
  roleForDesign,
  roleForLayer,
  type OverlayMediaRole,
} from '../mediaRoles'
import { createLayer, toBox, LAYER_IDS_BY_LAYOUT } from '../presets'
import { listRemotionDesignTemplates } from '../../templates/registry'
import '../../templates/catalog'

describe('overlay media-role contract', () => {
  it('every layer kind of every layout resolves to a role', () => {
    const kinds = new Set(Object.values(LAYER_IDS_BY_LAYOUT).flat())
    for (const kind of kinds) {
      expect(roleForLayer({ kind }), kind).toBeTruthy()
    }
  })

  it('logos are contained, never stretched, inside a square box that stays in the safe area', () => {
    const c = contractFor(roleForLayer({ kind: 'logo' }))
    expect(c.role).toBe('logo')
    expect(c.objectFit).toBe('contain')
    expect(c.preserveAspectRatio).toBe(true)
    expect(c.boxShape).toBe('square')
    expect(c.clampToSafeArea).toBe(true)
  })

  it('product and service images are their own roles, never picture-in-picture', () => {
    expect(roleForLayer({ kind: 'productImage' })).toBe('product-image')
    expect(roleForLayer({ kind: 'serviceImage' })).toBe('service-image')
    for (const kind of ['productImage', 'serviceImage'] as const) {
      const c = contractFor(roleForLayer({ kind }))
      expect(c.role).not.toBe('picture-in-picture')
      expect(c.objectFit).toBe('contain')
      expect(c.mayCoverSubject).toBe(false)
    }
  })

  it('only explicitly listed designs are picture-in-picture or full-frame', () => {
    expect(roleForDesign({ id: 'rve-picture-in-picture' })).toBe('picture-in-picture')
    expect(roleForDesign({ id: 'rve-polaroid-frame' })).toBe('picture-in-picture')
    expect(roleForDesign({ id: 'rve-ken-burns' })).toBe('full-frame-replacement')
    expect(roleForDesign({ id: 'starfield-warp', category: 'visual-effect' })).toBe('decorative')
    expect(roleForDesign({ id: 'lower-third', category: 'lower-third' })).toBe('text')
    expect(roleForDesign({ id: 'logo-reveal', category: 'logo-reveal' })).toBe('logo')
    expect(roleForDesign(null)).toBe('decorative')
  })

  it('the explicit design id lists point at real registered designs', () => {
    const ids = new Set(listRemotionDesignTemplates().map((d) => d.id))
    for (const id of [...PICTURE_IN_PICTURE_DESIGN_IDS, ...FULL_FRAME_DESIGN_IDS]) {
      expect(ids.has(id), `stale design id in the role lists: ${id}`).toBe(true)
    }
  })

  it('every registered design resolves to a role and the role mix is recorded', () => {
    const counts: Record<string, number> = {}
    for (const d of listRemotionDesignTemplates()) {
      const role = roleForDesign({ id: d.id, category: d.category })
      expect(MEDIA_ROLE_CONTRACTS[role]).toBeTruthy()
      counts[role] = (counts[role] ?? 0) + 1
    }
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(listRemotionDesignTemplates().length)
    expect(counts['picture-in-picture']).toBe(PICTURE_IN_PICTURE_DESIGN_IDS.size)
  })

  it('full-frame, effect and picture-in-picture designs are never clamped or user-dragged by accident', () => {
    for (const role of ['full-frame-replacement', 'decorative', 'picture-in-picture'] as OverlayMediaRole[]) {
      expect(contractFor(role).clampToSafeArea).toBe(false)
      expect(contractFor(role).autoPlaceable).toBe(false)
    }
    expect(contractFor('full-frame-replacement').userMovable).toBe(false)
    expect(contractFor('decorative').userResizable).toBe(false)
  })

  it('stacking is decided by role: effects < PiP < images < logo < text < caption', () => {
    const order: OverlayMediaRole[] = ['background-video', 'full-frame-replacement', 'decorative', 'picture-in-picture', 'product-image', 'logo', 'text', 'caption']
    const z = order.map((r) => layerZIndex(r, 0))
    expect([...z].sort((a, b) => a - b)).toEqual(z)
    // list position only orders layers of the same role
    expect(layerZIndex('text', 3)).toBeGreaterThan(layerZIndex('text', 1))
    expect(layerZIndex('product-image', 99)).toBeLessThan(layerZIndex('logo', 0))
  })

  it('toBox follows the contract: roles that clamp stay in the safe area, design boxes are untouched', () => {
    const logo = toBox(createLayer('logo', { x: 0, y: 0.1, scale: 0.3 }), 1920, 1080)
    expect(logo.leftPx).toBe(Math.round(1920 * 0.02))
    const design = toBox(createLayer('design', { x: 0, y: 0.5, scale: 1 }), 1920, 1080)
    expect(design.leftPx).toBe(-960)
  })
})
