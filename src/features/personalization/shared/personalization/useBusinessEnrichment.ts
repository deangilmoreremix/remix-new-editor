import { useEffect, useRef, useState } from 'react';
import type { BusinessEnrichment } from '../../../../../netlify/functions/_personalization/src/server/businessEnrichment/types';
import type { BusinessDiscoveryRecord } from '../../../../../netlify/functions/_personalization/src/server/businessDiscovery';
import { isOwnedWebsite } from './websiteClassification';

export type EnrichState = { status: 'loading' } | { status: 'done'; data: BusinessEnrichment } | { status: 'failed' }

const BATCH = 5; // the endpoint's per-request cap

/**
 * Looks up contact details (emails, phones, social profiles) on the websites of the businesses
 * currently on screen, via POST /api/personalization/enrich-business. Free: it only reads each
 * business's own public website (robots.txt respected). Each business is requested once per
 * session; results are kept so paging back does not refetch. Stops quietly when rate limited.
 */
export function useBusinessEnrichment(visible: BusinessDiscoveryRecord[]): Record<string, EnrichState> {
  const [states, setStates] = useState<Record<string, EnrichState>>({});
  const requested = useRef(new Set<string>());
  const stopped = useRef(false);
  const alive = useRef(true);
  const unmountCtl = useRef(new AbortController());
  useEffect(() => {
    // A fresh controller per mount: React StrictMode mounts, unmounts and re-mounts every effect in development,
    // and a controller aborted by that first cleanup would otherwise cancel every request made afterwards.
    alive.current = true;
    const c = new AbortController();
    unmountCtl.current = c;
    return () => { alive.current = false; c.abort(); };
  }, []);

  useEffect(() => {
    const todo = visible.filter((b) => b.website && isOwnedWebsite(b.website) && !requested.current.has(b.id));
    if (!todo.length || stopped.current) return;
    todo.forEach((b) => requested.current.add(b.id));
    setStates((s) => ({ ...s, ...Object.fromEntries(todo.map((b) => [b.id, { status: 'loading' } as EnrichState])) }));

    // The lookup survives the list growing ("Show 8 more"): the only thing that cancels it is unmounting.
    const ctl = unmountCtl.current
    ;(async () => {
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        try {
          const res = await fetch('/api/personalization/enrich-business', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
            body: JSON.stringify({ businesses: batch.map((b) => ({ id: b.id, website: b.website })) }),
          });
          if (res.status === 429) { stopped.current = true; throw new Error('rate-limited'); }
          const body = await res.json();
          if (!alive.current) return;
          const byId = new Map<string, EnrichState>();
          for (const r of (body?.results ?? []) as Array<{ id?: string; ok: boolean; enrichment?: BusinessEnrichment }>) {
            if (r.id) byId.set(r.id, r.ok && r.enrichment ? { status: 'done', data: r.enrichment } : { status: 'failed' });
          }
          setStates((s) => ({ ...s, ...Object.fromEntries(batch.map((b) => [b.id, byId.get(b.id) ?? ({ status: 'failed' } as EnrichState)])) }));
        } catch {
          if (!alive.current) return;
          // Rate-limited: this batch and everything queued behind it is marked failed so no card spins forever.
          const failed = stopped.current ? todo.slice(i) : batch;
          setStates((s) => ({ ...s, ...Object.fromEntries(failed.map((b) => [b.id, { status: 'failed' } as EnrichState])) }));
          if (stopped.current) return;
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((b) => b.id).join('|')]);

  return states;
}

const pct = (c: number) => `${Math.round(c * 100)}%`;

/** Contact details for a card: the OpenStreetMap value wins; otherwise the best enriched value, with its provenance. */
export function mergeCardContacts(b: BusinessDiscoveryRecord, st?: EnrichState) {
  const data = st?.status === 'done' ? st.data : undefined;
  const email = b.email ? { value: b.email, title: 'Listed in OpenStreetMap' } : data?.emails[0]
    ? { value: data.emails[0].value, title: `Found on ${data.emails[0].sourceUrl} (${data.emails[0].method}, confidence ${pct(data.emails[0].confidence)})` } : null;
  const social = (n: 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok') => {
    const own = b[n];
    if (own) return { value: own as string, title: 'Listed in OpenStreetMap' };
    const ev = data?.socials[n];
    return ev ? { value: ev.value, title: `Found on ${ev.sourceUrl} (${ev.method}, confidence ${pct(ev.confidence)})` } : null;
  };
  const nets = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;
  const links: Partial<Record<(typeof nets)[number], string>> = {};
  const titles: Partial<Record<(typeof nets)[number], string>> = {};
  for (const n of nets) { const s = social(n); if (s) { links[n] = s.value; titles[n] = s.title; } }
  return { email, links, titles, loading: st?.status === 'loading' };
}
