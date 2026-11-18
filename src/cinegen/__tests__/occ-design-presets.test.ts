// [remix] OpenChatCut design presets + font catalog (editor/design-presets.ts, fonts/googleFontCatalog.ts) applied to captions.
import { describe, it, expect } from 'vitest';
import { DESIGN_STYLE_PRESETS } from '../../openchatcut/editor/design-presets';
import { colorOf, fontOf } from '../../openchatcut/editor/designTypes';
import { GOOGLE_FONT_CATALOG, resolveCanonicalFamily } from '../../openchatcut/fonts/googleFontCatalog';
import { presetCaptionOverride } from '@cinegen/lib/occ/design-style';

describe('design presets', () => {
  it('ships all 24 presets with colors and fonts', () => {
    expect(DESIGN_STYLE_PRESETS).toHaveLength(24);
    for (const p of DESIGN_STYLE_PRESETS) { expect(p.style.colors.length).toBeGreaterThan(0); expect(p.style.fonts.length).toBeGreaterThan(0); }
  });
  it('maps a preset to a caption style override (text colour, accent, heading font)', () => {
    const p = DESIGN_STYLE_PRESETS[0];
    const o = presetCaptionOverride(p.style);
    expect(o.fontFamily).toBe(fontOf(p.style, 'heading'));
    expect(o.color).toBe(colorOf(p.style, 'text'));
  });
  it('resolves catalog families', () => {
    expect(GOOGLE_FONT_CATALOG.length).toBeGreaterThan(20);
    expect(resolveCanonicalFamily('montserrat')).toBe('Montserrat');
  });
});
