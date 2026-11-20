/**
 * How a "looks wrong" flag finds the business again. A flag used to be tied to one result id, so the same business
 * coming back under a different id (another OpenStreetMap element, another search) was no longer hidden. Flags are
 * now stored under a stable identity key (website domain, name+address, or phone) and matched on any of them.
 *
 * Scope depends on WHY it was flagged:
 *   - "is a chain" is about the whole business, so the website domain counts: every location of that site matches.
 *   - everything else (closed, wrong contact, wrong category, not local, other) is about ONE location, so the shared
 *     website domain does NOT count, or flagging one closed branch would hide all its siblings.
 * The weak name+city key is never used: two unrelated shops with the same name in one town must not merge.
 * Pure (no React), reuses the same identity keys as the finder's duplicate detection and "seen earlier" chips.
 */
import { identityKeys, phoneDigits, websiteIdentity } from '../../../../../netlify/functions/_personalization/src/server/businessDiscovery/backfill';
import type { BusinessDiscoveryRecord } from './types';
import type { FlagReason } from './useFinderContinuity';

const MAX_KEY = 120;
type Scope = 'business' | 'location'

export const flagScope = (reason: FlagReason): Scope => (reason === 'is_a_chain' ? 'business' : 'location');

/** Every key a business can be matched on for the given scope. Always includes a last-resort `id:` key. */
export function matchKeysFor(b: Pick<BusinessDiscoveryRecord, 'id'> & Partial<BusinessDiscoveryRecord>, scope: Scope): string[] {
  // The finder's own `domain:` identity key also carries the place (`domain:site|city`) so two branches of one chain stay distinct
  // when de-duplicating results. A chain flag must match EVERY location of the site, so it uses the bare domain instead.
  const allowed = ['na:', 'osm:'];
  // A record without a name would make the shared key builder throw; real records always have one, but never crash a list over it.
  const keys = identityKeys({ name: '', ...b } as BusinessDiscoveryRecord).filter((k) => allowed.some((p) => k.startsWith(p))).map((k) => k.slice(0, MAX_KEY));
  // Likewise `phone:` carries the place there; a flag is the user's own statement about this business, so a bare phone number is
  // the right fallback when a record has no address (the same number on another record is the same business to the user).
  const phone = phoneDigits(b.phone);
  if (phone) keys.push(`phone:${phone}`.slice(0, MAX_KEY));
  if (scope === 'business') {
    const site = websiteIdentity(b.website);
    if (site) keys.unshift(`domain:${site}`.slice(0, MAX_KEY));
  }
  keys.push(`id:${b.id}`.slice(0, MAX_KEY));
  return keys;
}

/** The single key a new flag is stored under: the most stable one available for its scope. */
export function flagKeyFor(b: Pick<BusinessDiscoveryRecord, 'id'> & Partial<BusinessDiscoveryRecord>, reason: FlagReason): string {
  const keys = matchKeysFor(b, flagScope(reason));
  // Name+address comes back the same from any search, so it is preferred; a phone is often missing from one of two records.
  const order = flagScope(reason) === 'business' ? ['domain:', 'na:', 'phone:', 'osm:', 'id:'] : ['na:', 'phone:', 'osm:', 'id:'];
  for (const prefix of order) {
    const hit = keys.find((k) => k.startsWith(prefix));
    if (hit) return hit;
  }
  return keys[keys.length - 1];
}

/** True when a stored flag applies to this business. */
export function flagMatches(flag: { business_id: string; reason: FlagReason }, b: Pick<BusinessDiscoveryRecord, 'id'> & Partial<BusinessDiscoveryRecord>): boolean {
  return matchKeysFor(b, flagScope(flag.reason)).includes(flag.business_id);
}
