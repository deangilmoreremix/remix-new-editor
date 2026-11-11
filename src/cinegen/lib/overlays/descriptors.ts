// [remix] Settings schemas for the overlay add-ons, in the format the old editor's settings renderer (`renderAddonEditor`) reads.
// List Builder uses the old editor's own `listBuilderFields`; Lead Generator and CTA use the same option names the old add-on clips save.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS add-on registry
import { getAddon, addonOptions } from '../../../lib/editor/addons/registry.js';
import { isRegistryOverlay } from './overlays';
// @ts-expect-error plain JS
import { listBuilderFields, FORM_FONTS } from '../../../lib/editor/addons/listBuilder.js';
// @ts-expect-error plain JS
import { CTA_ANIMATIONS } from '../../../lib/editor/addons/ctaLottie.js';

const LEAD_FIELD_TYPES: Array<[string, string]> = [['email', 'Email'], ['text', 'Text'], ['phone', 'Phone'], ['number', 'Number'], ['date', 'Date'], ['multiline', 'Multiline']];

const LEAD_FORM_FIELDS = [
  { key: 'heading', label: 'Heading', type: 'textarea', tab: 'Basic' },
  { key: 'ctaText', label: 'Button label', type: 'text', tab: 'Basic' },
  { key: 'skipButtonEnabled', label: 'Show a Skip button', type: 'toggle', tab: 'Basic' },
  { key: 'brandLogoUrl', label: 'Brand logo URL', type: 'url', tab: 'Basic' },
  { key: 'style.fontFamily', label: 'Font', type: 'select', options: FORM_FONTS, tab: 'Style' },
  { key: 'style.backgroundColor', label: 'Background colour', type: 'color', tab: 'Style' },
  { key: 'style.buttonColor', label: 'Button colour', type: 'color', tab: 'Style' },
  { key: 'style.buttonFontColor', label: 'Button text colour', type: 'color', tab: 'Style' },
  { key: 'style.buttonBorderRadius', label: 'Button corner radius', type: 'range', min: 0, max: 50, tab: 'Style' },
  { key: 'style.captionFontSize', label: 'Heading font size', type: 'range', min: 10, max: 200, tab: 'Style' },
  { key: 'style.fontSize', label: 'Font size', type: 'range', min: 10, max: 200, tab: 'Style' },
  { key: 'style.fontColor', label: 'Font colour', type: 'color', tab: 'Style' },
  { key: 'style.innerWidth', label: 'Inner width', type: 'range', min: 10, max: 100, tab: 'Style' },
  { key: 'style.innerHeight', label: 'Inner height', type: 'range', min: 10, max: 100, tab: 'Style' },
  { key: 'style.innerColor', label: 'Inner colour', type: 'color', tab: 'Style' },
  { key: 'style.innerOpacity', label: 'Inner opacity', type: 'range', min: 0, max: 100, tab: 'Style' },
  { key: 'style.captionAlignment', label: 'Heading alignment', type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], tab: 'Style' },
  { key: 'fields', label: 'Form fields (1–5)', type: 'fieldList', min: 1, max: 5, fieldTypes: LEAD_FIELD_TYPES, tab: 'Fields' },
  { key: 'privacyText', label: 'Privacy text', type: 'textarea', tab: 'Fields' },
  { key: 'privacyPolicyCaption', label: 'Privacy policy label', type: 'text', tab: 'Fields' },
  { key: 'privacyPolicyLink', label: 'Privacy policy link', type: 'url', tab: 'Fields' },
  { key: 'webhookEnabled', label: 'Send leads to a webhook', type: 'toggle', tab: 'Integrations' },
  { key: 'webhookUrl', label: 'Webhook address', type: 'url', tab: 'Integrations', showIf: (o: Record<string, unknown>) => !!o.webhookEnabled },
  { key: 'fbPixelId', label: 'Facebook Pixel ID', type: 'text', tab: 'Integrations' },
];

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
  if (overlay.type === 'list-builder') return { fieldsFor: (o) => listBuilderFields(o), options: (overlay.config ?? {}) as Record<string, unknown> };
  if (overlay.type === 'click-to-call') return { fields: CTA_FIELDS, options: overlay };
  return { fields: LEAD_FORM_FIELDS, options: overlay };
}
