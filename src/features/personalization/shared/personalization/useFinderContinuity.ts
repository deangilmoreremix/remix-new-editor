'use client';

/**
 * Saved searches and "looks wrong" flags for the Business Finder, backed by
 * /api/personalization/saved-searches and /api/personalization/lead-feedback (signed-in users only).
 *
 * Nothing here is required for the finder to work: when the user is signed out, or a request fails, the finder
 * behaves exactly as before and the error is surfaced as a short message. Flags are the user's own; they only hide
 * a business for that user and never change anything shared.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { flagKeyFor, flagMatches } from './finderFlagKeys';
import type { BusinessDiscoveryRecord } from './types';

export const FLAG_REASONS = [
  { key: 'is_a_chain', label: 'It is a chain / franchise' },
  { key: 'wrong_category', label: 'Wrong type of business' },
  { key: 'closed', label: 'Closed or gone' },
  { key: 'wrong_contact', label: 'Contact details are wrong' },
  { key: 'not_local', label: 'Not local to this area' },
  { key: 'other', label: 'Something else' },
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number]['key']

export interface SavedSearch { id: string; name: string; niche: string; location: string; radius_miles: number; include_chains: boolean }
/** `business_id` is a stable identity key (domain / name+address / phone), see finderFlagKeys.ts — not a result id. */
export interface LeadFlag { business_id: string; reason: FlagReason }
type FlaggableBusiness = Pick<BusinessDiscoveryRecord, 'id'> & Partial<BusinessDiscoveryRecord>

export interface SaveSearchInput { name: string; niche: string; location: string; radiusMiles: number; includeChains?: boolean }
type Outcome = { ok: true } | { ok: false; error: string }

async function errorOf(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return 'Sign in to use this.';
  const body = await res.json().catch(() => null) as { error?: string } | null;
  return typeof body?.error === 'string' && body.error ? body.error : `${fallback} (HTTP ${res.status})`;
}

export function useFinderContinuity(enabled: boolean) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [flags, setFlags] = useState<LeadFlag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // One load per signed-in mount. A per-effect AbortController (not a shared one) keeps React StrictMode's
  // double mount from cancelling the request that actually matters.
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController()
    ;(async () => {
      try {
        const [s, f] = await Promise.all([
          fetch('/api/personalization/saved-searches', { credentials: 'same-origin', signal: controller.signal }),
          fetch('/api/personalization/lead-feedback', { credentials: 'same-origin', signal: controller.signal }),
        ]);
        if (s.status === 401 || f.status === 401) { setLoaded(false); return; }
        if (s.ok) { const d = await s.json(); setSearches(Array.isArray(d?.searches) ? d.searches : []); }
        if (f.ok) { const d = await f.json(); setFlags(Array.isArray(d?.flags) ? d.flags : []); }
        setLoaded(true);
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') { startedRef.current = false; setError('Could not load saved searches and flags.'); }
      }
    })();
    return () => { controller.abort(); startedRef.current = false; };
  }, [enabled]);

  const saveSearch = useCallback(async (input: SaveSearchInput): Promise<Outcome> => {
    try {
      const res = await fetch('/api/personalization/saved-searches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ name: input.name, niche: input.niche, location: input.location, radiusMiles: input.radiusMiles, includeChains: input.includeChains ?? false }),
      });
      if (!res.ok) return { ok: false, error: await errorOf(res, 'Could not save the search') };
      const d = await res.json();
      if (d?.search) setSearches((prev) => [d.search as SavedSearch, ...prev.filter((x) => x.id !== d.search.id)]);
      return { ok: true };
    } catch { return { ok: false, error: 'Could not save the search. Check your connection.' }; }
  }, []);

  const deleteSearch = useCallback(async (id: string): Promise<Outcome> => {
    try {
      const res = await fetch(`/api/personalization/saved-searches?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok && res.status !== 404) return { ok: false, error: await errorOf(res, 'Could not delete the search') };
      setSearches((prev) => prev.filter((x) => x.id !== id));
      return { ok: true };
    } catch { return { ok: false, error: 'Could not delete the search. Check your connection.' }; }
  }, []);

  // Flags apply at once (optimistic) and roll back if the server refuses, so the list never lies about what is saved.
  // A flag is stored under the business's identity key, so the same business is still hidden if it comes back under a
  // different result id.
  const flag = useCallback(async (business: FlaggableBusiness, reason: FlagReason): Promise<Outcome> => {
    const key = flagKeyFor(business, reason);
    setFlags((prev) => (prev.some((f) => f.business_id === key && f.reason === reason) ? prev : [{ business_id: key, reason }, ...prev]));
    const rollback = () => setFlags((prev) => prev.filter((f) => !(f.business_id === key && f.reason === reason)));
    try {
      const res = await fetch('/api/personalization/lead-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ businessId: key, reason }),
      });
      if (!res.ok) { rollback(); return { ok: false, error: await errorOf(res, 'Could not save the flag') }; }
      return { ok: true };
    } catch { rollback(); return { ok: false, error: 'Could not save the flag. Check your connection.' }; }
  }, []);

  const isFlagged = useCallback((business: FlaggableBusiness): boolean => flags.some((f) => flagMatches(f, business)), [flags]);

  /** Removes every flag that applies to any of these businesses (each stored flag is deleted once). */
  const unflagAll = useCallback(async (businesses: FlaggableBusiness[]): Promise<Outcome> => {
    const mine = flags.filter((f) => businesses.some((b) => flagMatches(f, b)));
    if (!mine.length) return { ok: true };
    const same = (a: LeadFlag, b: LeadFlag) => a.business_id === b.business_id && a.reason === b.reason;
    setFlags((prev) => prev.filter((f) => !mine.some((m) => same(m, f))));
    const restore = () => setFlags((prev) => [...mine.filter((m) => !prev.some((f) => same(m, f))), ...prev]);
    try {
      const results = await Promise.all(mine.map((f) =>
        fetch(`/api/personalization/lead-feedback?businessId=${encodeURIComponent(f.business_id)}&reason=${f.reason}`, { method: 'DELETE', credentials: 'same-origin' })));
      if (results.some((r) => !r.ok && r.status !== 404)) { restore(); return { ok: false, error: 'Could not undo the flag.' }; }
      return { ok: true };
    } catch { restore(); return { ok: false, error: 'Could not undo the flag. Check your connection.' }; }
  }, [flags]);

  return { enabled, loaded, error, searches, flags, saveSearch, deleteSearch, flag, isFlagged, unflagAll };
}
