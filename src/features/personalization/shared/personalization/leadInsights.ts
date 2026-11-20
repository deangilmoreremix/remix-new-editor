/**
 * Pure helpers that turn the businesses the finder already returned (plus whatever contact enrichment found) into
 * things a person can act on: a CSV export, look-alike and nearby-competitor suggestions, "seen before" marks and
 * freshness labels. Nothing here fetches anything.
 */
import type { BusinessDiscoveryRecord } from './types';
import type { BusinessEnrichment } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';
import { identityKeys } from '../../../../../netlify/functions/_personalization/src/server/businessDiscovery/backfill';
import { openStatus } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/openingHours';

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Neutralises spreadsheet formula injection ("=HYPERLINK(...)") and quotes per RFC 4180. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const LEAD_CSV_COLUMNS = [
  'Name', 'Category', 'Ownership', 'Address', 'City', 'State', 'Phone', 'Website', 'Email (found on website)', 'Email source',
  'Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'Opening hours', 'Open now', 'Has contact form', 'Online booking',
  'Video on site', 'Lead score', 'Video opportunity', 'Contacts found', 'Source',
] as const;

export interface CsvOptions { enrichment?: Record<string, BusinessEnrichment | undefined>; now?: Date }

export function leadsToCsv(businesses: BusinessDiscoveryRecord[], opts: CsvOptions = {}): string {
  const rows = businesses.map((b) => {
    const e = opts.enrichment?.[b.id];
    const best = (list?: Array<{ value: string }>) => list?.[0]?.value;
    const status = b.openingHours ? openStatus(b.openingHours, b.region, opts.now) : { state: 'unknown' as const };
    const sig = e?.siteSignals;
    const social = (n: 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok') => (b as unknown as Record<string, string | undefined>)[n] || e?.socials?.[n]?.value;
    return [
      b.name, b.category, (b as { ownership?: string }).ownership, b.address, b.city, b.region, b.phone || best(e?.phones), b.website,
      b.email || best(e?.emails), e?.emails?.[0]?.sourceUrl,
      social('facebook'), social('instagram'), social('linkedin'), social('youtube'), social('tiktok'),
      b.openingHours, status.state === 'unknown' ? '' : status.state,
      sig ? (sig.contactForm ? 'yes' : 'not found') : '', sig ? (sig.booking ? (sig.booking.provider ? `yes (${sig.booking.provider})` : 'yes') : 'not found') : '',
      sig ? (sig.video ? sig.video.kinds.join('/') : 'none found on pages read') : '',
      (b as { leadScore?: number }).leadScore, (b as { videoOpportunityScore?: number }).videoOpportunityScore,
      e ? `${e.pagesVisited.length} page(s) read` : '', b.source,
    ];
  });
  return [LEAD_CSV_COLUMNS.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

// ── Seen before ──────────────────────────────────────────────────────────────

/** Remembers which businesses were already shown in this session, across searches, by every identity key. */
export function createSeenTracker() {
  const seen = new Set<string>();
  return {
    /** Marks `list` as seen and returns the ids that had ALREADY been seen before this call. */
    mark(list: BusinessDiscoveryRecord[]): Set<string> {
      const before = list.filter((b) => identityKeys(b).some((k) => seen.has(k))).map((b) => b.id);
      for (const b of list) for (const k of identityKeys(b)) seen.add(k);
      return new Set(before);
    },
    get size() { return seen.size; },
  };
}

// ── Look-alikes & competitors ────────────────────────────────────────────────

const tokens = (s?: string) => new Set((s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));

export function haversineKm(a: { latitude?: number; longitude?: number }, b: { latitude?: number; longitude?: number }): number | null {
  if ([a.latitude, a.longitude, b.latitude, b.longitude].some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null;
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude! - a.latitude!), dLon = rad(b.longitude! - a.longitude!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude!)) * Math.cos(rad(b.latitude!)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function categoryOverlap(a: BusinessDiscoveryRecord, b: BusinessDiscoveryRecord): number {
  const ta = tokens(a.category), tb = tokens(b.category);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

/** Businesses in the same category as `target`, best match first. Uses only the list already fetched. */
export function lookalikes(target: BusinessDiscoveryRecord, pool: BusinessDiscoveryRecord[], limit = 4): BusinessDiscoveryRecord[] {
  return pool
    .filter((b) => b.id !== target.id)
    .map((b) => ({ b, score: categoryOverlap(target, b) * 2 + (b.website ? 0.3 : 0) + (b.phone ? 0.2 : 0) }))
    .filter(({ score }) => score >= 1)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ b }) => b);
}

/** The closest other businesses of the same kind (potential competitors), with distance in miles. */
export function nearbyCompetitors(target: BusinessDiscoveryRecord, pool: BusinessDiscoveryRecord[], limit = 4): Array<{ business: BusinessDiscoveryRecord; miles: number }> {
  return pool
    .filter((b) => b.id !== target.id && categoryOverlap(target, b) >= 0.5)
    .map((business) => ({ business, km: haversineKm(target, business) }))
    .filter((x): x is { business: BusinessDiscoveryRecord; km: number } => x.km !== null)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ business, km }) => ({ business, miles: Math.round(km * 0.621371 * 10) / 10 }));
}

// ── Freshness ────────────────────────────────────────────────────────────────

export function freshnessLabel(enrichedAt: string | undefined, now: Date = new Date()): string | null {
  const t = enrichedAt ? Date.parse(enrichedAt) : NaN;
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  if (mins < 2) return 'checked just now';
  if (mins < 60) return `checked ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `checked ${hours} h ago`;
  return `checked ${Math.round(hours / 24)} days ago`;
}
