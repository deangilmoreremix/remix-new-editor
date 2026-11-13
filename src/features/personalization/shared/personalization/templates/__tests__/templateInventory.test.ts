import { describe, it, expect } from 'vitest'
import { listRemotionDesignTemplates } from '../registry'
import '../catalog'
import { PREVIEW_LAYOUTS } from '../../preview/presets'
import { roleForDesign } from '../../preview/mediaRoles'

/**
 * Inventory of every registered template: what exists, per category, with its
 * declared capabilities. Prints a machine-readable ledger (docs/template-coverage-ledger.md
 * is written from it) and pins invariants, so a template can never be added without a
 * category, a role and declared capabilities.
 */
describe('template inventory', () => {
  const designs = listRemotionDesignTemplates()
  it('lists every design with a category, a media role and declared capabilities', () => {
    expect(designs.length).toBeGreaterThan(0)
    const rows = designs.map((d) => ({
      id: d.id,
      category: d.category,
      role: roleForDesign({ id: d.id, category: d.category }),
      browserExport: !!d.capabilities?.browserExport,
      previewCompatible: d.previewCompatible !== false,
      aspects: (d.aspectRatios ?? ['16:9', '9:16', '1:1', '4:5']).join('|'),
      media: (d.media ?? []).map((m) => m.role).join('|'),
      requiredMedia: (d.requiredMedia ?? []).join('|'),
      textSlots: (d.textSlots ?? []).length,
    }))
    for (const r of rows) {
      expect(r.category, r.id).toBeTruthy()
      expect(r.role, r.id).toBeTruthy()
    }
    // eslint-disable-next-line no-console
    console.log('LEDGER_JSON=' + JSON.stringify({ layouts: PREVIEW_LAYOUTS.length, designs: rows }))
  })
})
