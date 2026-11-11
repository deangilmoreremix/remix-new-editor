/**
 * The shared resolver for a design's editable text slots.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the rule in
 * `docs/phase2/INTERFACE-slots.md` §2:
 *
 *     effective(slot) =
 *         primary slot  ->  layer.text          (when it is a string, even an
 *                                             empty one)
 *                      ->  brand[slot.field]   (when layer.text is absent)
 *         other slot    ->  layer.textSlotOverrides[slot.key]
 *                                             (when it is a non-empty string)
 *                      ->  brand[slot.field]   (absent / blank / malformed)
 *
 * It lives in the `core` lane (not in `guided/`) because BOTH sides need it:
 *
 *  - the inspector (`guided/OverlayEditor.tsx`) shows the value the customer
 *    is editing, and
 *  - the composition (`preview/PersonalizationComposition.tsx`) draws it.
 *
 * The composition must NOT import it from `guided/OverlayEditor.tsx`: that
 * file imports `DemoPersonalizeProvider`, which imports `PersonalizationModal`,
 * which imports `OverlayEditor` again — a require cycle
 * (Composition -> OverlayEditor -> Provider -> Modal -> OverlayEditor).
 *
 * Every import here is TYPE-ONLY, so this module has no runtime dependency at
 * all: it cannot take part in a cycle.
 */

import type {
  RemotionDesignTemplate,
  RemotionDesignTextField,
  RemotionDesignTextSlot,
} from '../templates/types'
import type { PreviewInputProps, PreviewLayer } from './types'

/**
 * The layer field that carries the customer's per-slot text overrides.
 *
 * The PRIMARY slot keeps using `layer.text` (the field the inspector has
 * always written), so nothing about the primary slot changes. Every OTHER
 * slot the design declares is edited through this map, keyed by
 * `RemotionDesignTextSlot.key`.
 */
export const DESIGN_SLOT_OVERRIDES_FIELD = 'textSlotOverrides'

/**
 * The brand value behind a design text slot.
 *
 * A missing brand value is the empty string — never `undefined` and never a
 * crash.
 */
export function brandSlotValue(
  field: RemotionDesignTextField,
  brand: PreviewInputProps['brand'],
): string {
  switch (field) {
    case 'businessName':
      return brand.businessName ?? ''
    case 'headline':
      return brand.headline ?? ''
    case 'offer':
      return brand.offer ?? ''
    case 'cta':
      return brand.cta ?? ''
    case 'phone':
      return brand.phone ?? ''
    case 'website':
      return brand.website ?? ''
    default:
      return ''
  }
}

/**
 * The per-slot overrides stored on a layer.
 *
 * Never throws: a missing, malformed or non-object field yields an empty
 * map, so the caller falls back to the brand-derived values.
 */
export function designSlotOverrides(layer: PreviewLayer): Record<string, string> {
  const raw = (layer as PreviewLayer & { textSlotOverrides?: unknown }).textSlotOverrides
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of Object.keys(source)) {
    if (typeof key !== 'string' || !key) continue
    const value = source[key]
    if (typeof value !== 'string') continue
    out[key] = value
  }
  return out
}

/** True when the slot owns the layer's own text (`layer.text`). */
export function isPrimaryDesignSlot(slot: RemotionDesignTextSlot): boolean {
  return Boolean(slot) && slot.primary === true
}

/** The customer-facing label of a brand field, used when a slot has none. */
function slotFieldLabel(field: RemotionDesignTextField): string {
  switch (field) {
    case 'businessName':
      return 'Business name'
    case 'headline':
      return 'Headline'
    case 'offer':
      return 'Offer'
    case 'cta':
      return 'Call to action'
    case 'phone':
      return 'Phone'
    case 'website':
      return 'Website'
    default:
      return 'Text'
  }
}

/** The label shown above a slot's field: the slot's own, else a derived one. */
export function designSlotLabel(slot: RemotionDesignTextSlot): string {
  const label = typeof slot?.label === 'string' ? slot.label.trim() : ''
  if (label) return label
  return slotFieldLabel(slot?.field)
}

/**
 * The effective value of every text slot of a design.
 *
 * Precedence, per slot:
 *  1. the PRIMARY slot takes the layer's own `text` (the legacy contract —
 *     an empty string blanks the slot);
 *  2. any other slot takes its stored override, when that override is a
 *     non-empty string;
 *  3. otherwise the slot falls back to its brand field.
 *
 * This is the contract the composition renders with; see
 * `docs/phase2/INTERFACE-slots.md`.
 */
export function resolveDesignSlotValues(
  design: RemotionDesignTemplate,
  layer: PreviewLayer,
  brand: PreviewInputProps['brand'],
): Record<string, string> {
  const slots: Record<string, string> = {}
  const declared = Array.isArray(design?.textSlots) ? design.textSlots : []
  const overrides = designSlotOverrides(layer)
  for (const slot of declared) {
    if (!slot || typeof slot.key !== 'string' || !slot.key) continue
    if (isPrimaryDesignSlot(slot)) {
      slots[slot.key] =
        typeof layer.text === 'string' ? layer.text : brandSlotValue(slot.field, brand)
      continue
    }
    const override = overrides[slot.key]
    slots[slot.key] =
      typeof override === 'string' && override.trim()
        ? override
        : brandSlotValue(slot.field, brand)
  }
  return slots
}
