/**
 * The font list overlays (Smart Text, Text Mask, Lower Thirds) offer: upstream's own list (OVERLAY_FONTS), the extra families the host
 * passes in (CineGen passes the captions' Google families from the OpenChatCut catalogue, which this plain module does not import), and any
 * font the user imported (kept in this browser, see cinegen/lib/occ/user-fonts.ts). One list, de-duplicated, imported fonts first.
 */
import { OVERLAY_FONTS } from './overlayData.js';

const key = (f) => String(f).trim().toLowerCase();

/** [value, label, group] triples for a `font` field. `userFamilies` = fonts imported by the user, `extraFamilies` = more families the host
 *  offers, `systemFamilies` = fonts installed on this computer (listed last, as their own group, because there can be hundreds). */
export function overlayFontOptions(userFamilies = [], extraFamilies = [], systemFamilies = []) {
  const seen = new Set();
  const out = [];
  const add = (family, label = family, group = 'Fonts') => {
    const k = key(family);
    if (!family || seen.has(k)) return;
    seen.add(k);
    out.push([family, label, group]);
  };
  [...userFamilies].sort((a, b) => a.localeCompare(b)).forEach((f) => add(f, `${f} (imported)`, 'Imported'));
  const shared = [...OVERLAY_FONTS, ...extraFamilies];
  const named = shared.filter((f) => !seen.has(key(f)));
  // keep upstream's order for its own fonts, then the extra caption families alphabetically
  const upstream = new Set(OVERLAY_FONTS.map(key));
  named.filter((f) => upstream.has(key(f))).forEach((f) => add(f));
  named.filter((f) => !upstream.has(key(f))).sort((a, b) => a.localeCompare(b)).forEach((f) => add(f));
  [...systemFamilies].sort((a, b) => a.localeCompare(b)).forEach((f) => add(f, f, 'Installed on this computer'));
  return out;
}
