// listPages: "My pages" lists only the signed-in owner's pages. Published pages are readable by anyone (so their public
// link works), so without the owner filter every user would see everyone's published pages in their list.
import { describe, it, expect } from 'vitest';
import { listPages } from '../client.js';

function fakeClient(rows) {
  const calls = [];
  const q = {
    select(cols) { calls.push(['select', cols]); return q; },
    eq(col, val) { calls.push(['eq', col, val]); return q; },
    order(col, opts) { calls.push(['order', col, opts]); return Promise.resolve({ data: rows, error: null }); },
  };
  return { calls, from(table) { calls.push(['from', table]); return q; } };
}

describe('listPages', () => {
  it('asks only for the owner\'s own pages', async () => {
    const c = fakeClient([{ id: 'mine12345' }]);
    expect(await listPages(c, 'user_A')).toEqual([{ id: 'mine12345' }]);
    expect(c.calls).toContainEqual(['from', 'landing_pages']);
    expect(c.calls).toContainEqual(['eq', 'clerk_user_id', 'user_A']);
  });

  it('returns nothing without a signed-in owner, and never runs an unfiltered query', async () => {
    const c = fakeClient([{ id: 'someone-else' }]);
    expect(await listPages(c, '')).toEqual([]);
    expect(await listPages(c, undefined)).toEqual([]);
    expect(c.calls).toEqual([]);
  });
});
