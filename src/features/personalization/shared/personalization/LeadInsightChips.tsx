import React from 'react';
import type { BusinessDiscoveryRecord } from './types';
import type { BusinessEnrichment } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';
import { openStatus } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/openingHours';
import { freshnessLabel } from './leadInsights';

const chip = (color: string): React.CSSProperties => ({ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color });
const GREEN = '#3ddc97', MUTED = '#8b98a5', AMBER = '#f5b942';

export interface LeadInsightChipsProps {
  business: BusinessDiscoveryRecord
  enrichment?: BusinessEnrichment | null
  seenBefore?: boolean
  now?: Date
}

/**
 * Small, honest status chips for a result card. Every chip says what was observed and where; "not found" never
 * claims absence — only "on the pages we read".
 */
export function LeadInsightChips({ business, enrichment, seenBefore, now }: LeadInsightChipsProps) {
  const status = business.openingHours ? openStatus(business.openingHours, business.region, now) : { state: 'unknown' as const };
  const sig = enrichment?.siteSignals;
  const checked = enrichment ? freshnessLabel(enrichment.enrichedAt, now) : null;
  const readPages = enrichment?.pagesVisited.length ?? 0;
  const chips: React.ReactNode[] = [];

  if (status.state !== 'unknown') {
    chips.push(
      <span key="open" data-testid="chip-open" style={chip(status.state === 'open' ? GREEN : AMBER)} title={`From OpenStreetMap hours (${business.openingHours}), in the business's local time`}>
        {status.state === 'open' ? 'Open now' : 'Closed now'}
      </span>,
    );
  }
  if (sig?.contactForm) chips.push(<span key="form" data-testid="chip-form" style={chip(GREEN)} title={`Contact form on ${sig.contactForm.sourceUrl}`}>Contact form</span>);
  if (sig?.booking) chips.push(<span key="book" data-testid="chip-booking" style={chip(GREEN)} title={`Booking link: ${sig.booking.href}`}>{sig.booking.provider ? `Booking · ${sig.booking.provider}` : 'Online booking'}</span>);
  if (sig?.video) chips.push(<span key="vid" data-testid="chip-video" style={chip(AMBER)} title={`Already uses video (${sig.video.kinds.join(', ')}) — seen on ${sig.video.sourceUrl}`}>Has video</span>);
  else if (readPages > 0) chips.push(<span key="novid" data-testid="chip-novideo" style={chip(MUTED)} title={`No embedded video seen on the ${readPages} page(s) we read — that does not prove the business has none`}>No video seen</span>);
  if (sig?.quality?.looksOutdated) chips.push(<span key="old" data-testid="chip-outdated" style={chip(AMBER)} title={`Footer copyright says ${sig.quality.copyrightYear} — a hint the site may be dated, not proof`}>Site may be dated</span>);
  if (seenBefore) chips.push(<span key="seen" data-testid="chip-seen" style={chip(MUTED)} title="You already saw this business in an earlier search this session">Seen earlier</span>);
  if (checked) chips.push(<span key="fresh" data-testid="chip-fresh" style={{ fontSize: 9, color: MUTED }}>{checked}</span>);

  if (!chips.length) return null;
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>{chips}</div>;
}
