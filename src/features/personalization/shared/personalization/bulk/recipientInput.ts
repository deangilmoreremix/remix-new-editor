/**
 * One recipient → one set of preview input (Stage 10). The base design is never modified: each recipient gets a copy whose business
 * details and `{{fields}}` come from that recipient's row, so a batch cannot leak one person's values into another's video.
 */
import { buildPreviewInput, type BuildPreviewInputContext } from '../guided/buildPreviewInput'
import { normalizeCustomFields } from '../preview/layerTransform'
import type { PreviewInputProps } from '../preview/types'
import type { Recipient } from './csv'

export function contextForRecipient(base: BuildPreviewInputContext, r: Recipient): BuildPreviewInputContext {
  const businessName = r.company || r.name
  return {
    ...base,
    clientForm: { ...base.clientForm, businessName, name: r.name || base.clientForm.name, website: r.website || '', phone: r.phone || '', location: r.location || '' },
    previewSettings: { ...base.previewSettings, customFields: normalizeCustomFields({ ...(base.previewSettings.customFields ?? {}), ...r.values }) },
  }
}
export const inputForRecipient = (base: BuildPreviewInputContext, r: Recipient): PreviewInputProps => buildPreviewInput(contextForRecipient(base, r))

/** Names that fit a file system and a spreadsheet: "01-acme-roofing". */
export function recipientFolder(r: Recipient, index: number): string {
  const slug = (r.company || r.name || r.email.split('@')[0] || 'recipient').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recipient'
  return `${String(index + 1).padStart(3, '0')}-${slug}`
}
/** Unique, short labels for personal links (the Stage 8 API refuses repeats, case-insensitively). */
export function linkLabels(list: Recipient[]): string[] {
  const used = new Set<string>()
  return list.map((r) => {
    const base = (r.company || r.name || r.email).slice(0, 70); let label = base; let n = 2
    while (used.has(label.toLowerCase())) { label = `${base.slice(0, 74)} (${n})`; n += 1 }
    used.add(label.toLowerCase()); return label
  })
}

/** A stable fingerprint of the design a batch was started with (so a changed design is noticed on resume). */
export function templateFingerprint(settings: unknown, extra: unknown = {}): string {
  const text = JSON.stringify([settings, extra], (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))
  let h = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return `${(h >>> 0).toString(16).padStart(8, '0')}-${text.length}`
}

/**
 * The same, starting from the editor's finished preview props (what the overlay editor has): a copy per recipient with that
 * recipient's business details and {{fields}}. The input is never modified.
 */
export function propsForRecipient(base: PreviewInputProps, r: Recipient): PreviewInputProps {
  const businessName = r.company || r.name
  const b = base.brand
  const swap = (text: string, from: string, to: string) => (from && to ? text.split(from).join(to) : text)
  return {
    ...base,
    settings: { ...base.settings, customFields: normalizeCustomFields({ ...(base.settings.customFields ?? {}), ...r.values }) },
    brand: {
      ...b, businessName,
      headline: b.headline === b.businessName || !b.headline ? businessName : b.headline,
      website: r.website, phone: r.phone,
      // the call to action text was built from the base website / phone ("Visit acme.com"): follow the recipient's
      cta: swap(swap(b.cta, b.website, r.website), b.phone, r.phone),
    },
  }
}

export function chunk<T>(list: T[], size: number): T[][] { const out: T[][] = []; for (let i = 0; i < list.length; i += Math.max(1, size)) out.push(list.slice(i, i + size)); return out }
