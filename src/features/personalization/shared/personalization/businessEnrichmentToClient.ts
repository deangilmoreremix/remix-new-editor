/**
 * Turns a website-enrichment result into client-profile auto-fill values.
 *
 * Pure and conservative: only values the business's own website published, only at or above a confidence floor,
 * and only for fields the profile can hold. It returns candidates; `mergeAutoFilledContent` then decides whether a
 * field is actually empty/replaceable, so anything the user typed or an OpenStreetMap value already there wins.
 */
import type { BusinessEnrichment, Evidence } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';
import type { AutoFilledValues } from './businessContentFromResearch';

/** Below this the method is too weak to put into a profile on the user's behalf (e.g. a lone page-text match). */
export const ENRICHMENT_CONFIDENCE_FLOOR = 0.7;

/** `value` is what was found; the UI shows the source only while the profile still holds exactly that value. */
export interface ContactSource { value: string; sourceUrl: string; confidence: number; method: string }
export type ContactSources = Partial<Record<'email' | 'phone' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok', ContactSource>>

const NETWORKS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;

const src = (e: Evidence): ContactSource => ({ value: e.value, sourceUrl: e.sourceUrl, confidence: e.confidence, method: e.method });

export function enrichmentToAutoFill(enrichment: BusinessEnrichment | null | undefined): { values: AutoFilledValues; sources: ContactSources } {
  const values: AutoFilledValues = {};
  const sources: ContactSources = {};
  if (!enrichment) return { values, sources };

  const email = enrichment.emails.find((e) => e.confidence >= ENRICHMENT_CONFIDENCE_FLOOR);
  if (email) { values.email = email.value; sources.email = src(email); }

  const phone = enrichment.phones.find((e) => e.confidence >= ENRICHMENT_CONFIDENCE_FLOOR);
  if (phone) { values.phone = phone.value; sources.phone = src(phone); }

  for (const n of NETWORKS) {
    const ev = enrichment.socials[n];
    if (ev && ev.confidence >= ENRICHMENT_CONFIDENCE_FLOOR) { values[n] = ev.value; sources[n] = src(ev); }
  }
  return { values, sources };
}

/** What the business's own site publishes that helps choose a video goal. Absent = not found (never "no"). */
export interface FoundSignals {
  booking?: { sourceUrl: string; provider?: string }
  hasVideo?: boolean
  /** The rating the business's own page publishes. */
  rating?: { value: number; count: number; best: number; sourceUrl: string }
}

export function foundSignalsOf(enrichment: BusinessEnrichment | null | undefined): FoundSignals {
  const sig = enrichment?.siteSignals;
  if (!sig) return {};
  const out: FoundSignals = {};
  if (sig.booking) out.booking = { sourceUrl: sig.booking.sourceUrl, ...(sig.booking.provider ? { provider: sig.booking.provider } : {}) };
  if (sig.video) out.hasVideo = true;
  if (sig.rating) out.rating = { ...sig.rating };
  return out;
}
