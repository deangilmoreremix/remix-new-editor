// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The backup says "offer it" until `offerable` is turned off, which stands in for the user adding work to the draft.
const state = { offerable: true };
vi.mock('../../lib/outreach/draftBackup.js', () => ({
  loadBackup: async () => ({ savedAt: 1, draft: { name: 'Old draft' } }),
  clearBackup: async () => true,
  backupDraft: async () => true,
  shouldOfferRestore: () => state.offerable,
}));

const { OutreachStudio } = await import('../OutreachStudio.js');
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('restore offer in the studio', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); state.offerable = true; });

  it('is shown for an empty draft, and removed once work has been added since', async () => {
    // One saved campaign, so the Videos home has a Sort control to re-render it with.
    localStorage.setItem('outreach-library-v1', JSON.stringify({ c1: { savedAt: 1, draft: { name: 'Saved', campaign: { id: 'c1' }, contacts: [] } } }));
    document.body.appendChild(OutreachStudio());
    await flush();
    expect(document.querySelector('[data-outreach-restore]')).not.toBeNull();

    state.offerable = false; // work was added after the offer appeared
    // Any re-render of the Videos home (here, changing the sort) must drop the stale offer by itself:
    // neither "Restore it" nor "Not now" is clicked.
    const sort = document.querySelector('select[aria-label="Sort"]');
    sort.value = 'name';
    sort.dispatchEvent(new Event('change'));
    await flush();
    expect(document.querySelector('[data-outreach-restore]')).toBeNull();
  });
});
