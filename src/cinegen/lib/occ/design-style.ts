// [remix] OpenChatCut design presets (editor/design-presets.ts: 24 brand colour/font presets) → caption style override.
// Same role lookups as their design-style panel (colorOf / fontOf); only roles that exist in the preset are set, and the
// heading font is only used when it is a loadable family in their font catalog (googleFontCatalog.ts).
import { colorOf, fontOf, type DesignStyle } from '../../../openchatcut/editor/designTypes';
import { GOOGLE_FONT_CATALOG, resolveCanonicalFamily } from '../../../openchatcut/fonts/googleFontCatalog';
import type { CaptionStyleOverride } from '../../../openchatcut/captions/styles';

export const CAPTION_FONT_FAMILIES: string[] = GOOGLE_FONT_CATALOG.filter((f) => f.loadable).map((f) => f.family);

export function presetCaptionOverride(style: DesignStyle): CaptionStyleOverride {
  const out: CaptionStyleOverride = {};
  const text = colorOf(style, 'text') ?? colorOf(style, 'text-on-dark');
  const accent = colorOf(style, 'accent') ?? colorOf(style, 'primary') ?? colorOf(style, 'secondary');
  const heading = fontOf(style, 'heading');
  const family = heading ? resolveCanonicalFamily(heading) : null;
  if (text && /^#|^rgb/i.test(text)) out.color = text;
  if (accent && /^#|^rgb/i.test(accent)) out.highlightColor = accent;
  if (family) out.fontFamily = family;
  return out;
}
