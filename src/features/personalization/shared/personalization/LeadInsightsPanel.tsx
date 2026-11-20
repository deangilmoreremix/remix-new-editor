import React, { useState } from 'react';
import type { BusinessDiscoveryRecord } from './types';
import type { BusinessEnrichment } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';
import { lookalikes, nearbyCompetitors } from './leadInsights';
import { outreachDraft } from './outreachDraft';

const MUTED = '#8b98a5', TEXT = '#e6edf3', CYAN = '#d9ff00';

export interface LeadInsightsPanelProps {
  business: BusinessDiscoveryRecord
  results: BusinessDiscoveryRecord[]
  enrichment?: BusinessEnrichment | null
  onPick?: (b: BusinessDiscoveryRecord) => void
  /** Offers an editable outreach draft built from the facts found about this business. */
  showOutreach?: boolean
}

/** For the selected business: how its own site looks, plus similar and nearby businesses from the search already run. */
export function LeadInsightsPanel({ business, results, enrichment, onPick, showOutreach = false }: LeadInsightsPanelProps) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [copied, setCopied] = useState(false);
  const similar = lookalikes(business, results);
  const nearby = nearbyCompetitors(business, results);
  const q = enrichment?.siteSignals?.quality;
  if (!similar.length && !nearby.length && !q && !showOutreach) return null;
  const yes = (v: boolean) => (v ? '✓' : '✗');
  return (
    <div data-testid="lead-insights" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, color: MUTED }}>
      {q && (
        <div data-testid="site-quality" title={`Read from the homepage ${q.sourceUrl}. Hints, not a grade.`}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Website check</span>{' '}
          {yes(q.https)} HTTPS · {yes(q.mobileViewport)} mobile-ready · {yes(q.hasTitle)} title · {yes(q.hasMetaDescription)} description · {yes(q.hasStructuredData)} structured data
          {q.copyrightYear ? ` · © ${q.copyrightYear}` : ''}
        </div>
      )}
      {showOutreach && (
        <div data-testid="outreach">
          <button
            type="button"
            data-testid="outreach-toggle"
            onClick={(e) => {
              e.stopPropagation();
              if (!draftOpen) setDraftText(outreachDraft(business, enrichment).body);
              setDraftOpen((v) => !v);
              setCopied(false);
            }}
            style={{ background: 'transparent', border: 0, padding: 0, color: CYAN, cursor: 'pointer', fontSize: 10 }}
          >
            {draftOpen ? 'Hide outreach draft' : 'Draft an outreach message'}
          </button>
          {draftOpen && (() => {
            const draft = outreachDraft(business, enrichment);
            return (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {draft.observations.length > 0 && (
                  <div data-testid="outreach-facts">Based on: {draft.observations.join(' · ')}</div>
                )}
                <textarea
                  data-testid="outreach-text"
                  value={draftText}
                  onChange={(e) => { setDraftText(e.target.value); setCopied(false); }}
                  rows={8}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', color: TEXT, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: 6, fontSize: 11 }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    data-testid="outreach-copy"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = `Subject: ${draft.subject}

${draftText}`;
                      try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
                    }}
                    style={{ background: 'transparent', border: `1px solid ${CYAN}`, borderRadius: 6, color: CYAN, cursor: 'pointer', fontSize: 10, padding: '2px 8px' }}
                  >
                    Copy subject + message
                  </button>
                  {copied && <span data-testid="outreach-copied">Copied</span>}
                  <span>Edit before sending — nothing is sent from here.</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {similar.length > 0 && (
        <div data-testid="lookalikes">
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Similar businesses in this search</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {similar.map((b) => (
              <button key={b.id} type="button" onClick={(e) => { e.stopPropagation(); onPick?.(b); }} style={{ background: 'transparent', border: 0, padding: 0, color: CYAN, cursor: 'pointer', fontSize: 10 }}>{b.name}</button>
            ))}
          </div>
        </div>
      )}
      {nearby.length > 0 && (
        <div data-testid="competitors">
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>Nearest competitors</span>
          <div style={{ marginTop: 2, color: TEXT }}>
            {nearby.map(({ business: b, miles }) => <div key={b.id}>{b.name} <span style={{ color: MUTED }}>· {miles} mi</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
