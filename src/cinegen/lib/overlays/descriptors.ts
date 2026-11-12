// [remix] Settings schemas for the overlay add-ons, in the format the old editor's settings renderer (`renderAddonEditor`) reads.
// List Builder and Lead Generator use the same shared schema (`listBuilderFields`: Styles / Fields / Pointer / Integrations); CTA keeps its own.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS add-on registry
import { getAddon, addonOptions } from '../../../lib/editor/addons/registry.js';
import { isRegistryOverlay } from './overlays';
// @ts-expect-error plain JS
import { listBuilderFields, leadFormToOptin, normalizeListBuilder } from '../../../lib/editor/addons/listBuilder.js';
// @ts-expect-error plain JS
import { CTA_ANIMATIONS } from '../../../lib/editor/addons/ctaLottie.js';

const CTA_FIELDS = [
  { key: 'buttonText', label: 'Button text', type: 'text' },
  { key: 'phoneNumber', label: 'Phone number', type: 'text' },
  { key: 'linkUrl', label: 'Link (instead of a phone number)', type: 'url' },
  { key: 'animation', label: 'Animation', type: 'select', options: CTA_ANIMATIONS },
  { key: 'style.buttonColor', label: 'Button colour', type: 'color' },
  { key: 'textColor', label: 'Text colour', type: 'color' },
];

/** The schema + the option object the settings form edits for an overlay. */
export function overlaySchema(overlay: OverlayClip): { fields?: unknown[]; fieldsFor?: (o: unknown) => unknown[]; options: Record<string, unknown>; onFieldChange?: (key: string, o: unknown) => unknown } {
  if (isRegistryOverlay(overlay.type)) {
    const addon = getAddon(overlay.type);
    return { fields: addon.fields, onFieldChange: addon.onFieldChange, options: addonOptions(overlay) as Record<string, unknown> };
  }
  // List Builder / Personalizer and Lead Generator share ONE design and settings (Styles / Fields / Pointer / Integrations).
  if (overlay.type === 'list-builder') return { fieldsFor: (o) => listBuilderFields(o), options: normalizeListBuilder({ ...(overlay.config ?? {}) }) as Record<string, unknown> };
  if (overlay.type === 'click-to-call') return { fields: CTA_FIELDS, options: overlay };
  // The Lead Generator keeps the flat clip shape the old editor saved; leadFormToOptin / applyOptinToLeadForm adapt it.
  return { fieldsFor: (o) => listBuilderFields({ ...(o as Record<string, unknown>), kind: 'lead-generator' }), options: leadFormToOptin(overlay) as Record<string, unknown> };
}
