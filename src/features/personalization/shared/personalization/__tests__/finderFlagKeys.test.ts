import { describe, expect, it } from 'vitest';
import { flagKeyFor, flagMatches, flagScope, matchKeysFor } from '../finderFlagKeys';

const shop = (over: Record<string, unknown> = {}) => ({ id: 'a1', name: "Joe's Pizza", address: '1 Main St', city: 'Tampa', region: 'FL', website: 'https://www.joespizza.com', phone: '(813) 555-0100', osmType: 'node', osmId: '1', ...over }) as never;

describe('flag keys', () => {
  it('scopes "is a chain" to the whole business and everything else to one location', () => {
    expect(flagScope('is_a_chain')).toBe('business');
    for (const r of ['closed', 'wrong_contact', 'wrong_category', 'not_local', 'other'] as const) expect(flagScope(r)).toBe('location');
  });
  it('stores a chain flag under the website domain, a location flag under name+address, with sensible fallbacks', () => {
    expect(flagKeyFor(shop(), 'is_a_chain')).toBe('domain:joespizza.com');
    expect(flagKeyFor(shop(), 'closed')).toMatch(/^na:/);
    expect(flagKeyFor(shop({ address: undefined, city: undefined }), 'closed')).toBe('phone:8135550100');
    expect(flagKeyFor(shop({ address: undefined, city: undefined, phone: undefined }), 'closed')).toBe('osm:node/1');
    expect(flagKeyFor({ id: 'x9' } as never, 'closed')).toBe('id:x9'); // no name at all: still no crash
  });
  it('the same business under a different result id still matches', () => {
    const flag = { business_id: flagKeyFor(shop(), 'closed'), reason: 'closed' as const };
    expect(flagMatches(flag, shop({ id: 'totally-different-id', osmId: '999' }))).toBe(true);                  // same name + address
    expect(flagMatches(flag, shop({ id: 'b', phone: undefined, website: undefined, osmId: '77' }))).toBe(true); // phone and website missing this time
  });
  it('a chain flag hides every location of the same website, a closed flag only that location', () => {
    const branchA = shop({ id: 'a', phone: '(813) 555-0100', address: '1 Main St' });
    const branchB = shop({ id: 'b', phone: '(727) 555-0199', address: '9 Bay Rd', osmId: '2' });
    const chain = { business_id: flagKeyFor(branchA, 'is_a_chain'), reason: 'is_a_chain' as const };
    expect(flagMatches(chain, branchB)).toBe(true);
    const closed = { business_id: flagKeyFor(branchA, 'closed'), reason: 'closed' as const };
    expect(flagMatches(closed, branchB)).toBe(false);
    expect(flagMatches(closed, branchA)).toBe(true);
  });
  it('never merges two same-named shops in one city with different phone and address', () => {
    const one = shop({ phone: '(813) 555-0100', website: undefined, address: '1 Main St', osmId: '1' });
    const two = shop({ id: 'z', phone: '(813) 555-0222', website: undefined, address: '77 Oak Ave', osmId: '2' });
    const flag = { business_id: flagKeyFor(one, 'closed'), reason: 'closed' as const };
    expect(flagMatches(flag, two)).toBe(false);
    expect(matchKeysFor(two, 'location').some((k) => k.startsWith('nc:'))).toBe(false);
  });
  it('a bare shared-host page identifies nobody', () => {
    const fbOnly = shop({ website: 'https://www.facebook.com/', phone: undefined });
    expect(matchKeysFor(fbOnly, 'business').some((k) => k.startsWith('domain:'))).toBe(false);
  });
  it('keeps keys within the 120-character column limit', () => {
    const long = shop({ phone: undefined, address: 'x'.repeat(300) });
    for (const k of matchKeysFor(long, 'location')) expect(k.length).toBeLessThanOrEqual(120);
  });
});
