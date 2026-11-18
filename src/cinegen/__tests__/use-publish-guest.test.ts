// [remix] Publishing from the Leads / Export tabs works without an account.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { guestClient, accountClient, claim } = vi.hoisted(() => ({ guestClient: { who: 'guest' }, accountClient: { who: 'account' }, claim: vi.fn() }));
vi.mock('../../lib/guestIdentity.js', () => ({
  getGuestOwnerClient: vi.fn(async () => guestClient),
  hasGuestIdentity: vi.fn(() => true),
  claimGuestContent: claim,
}));
vi.mock('../../lib/hybrid-supabase.js', () => ({ supabase: { supabase: accountClient, refreshUserHeader: vi.fn(async () => {}) }, uploadFileToStorage: vi.fn() }));
vi.mock('../../lib/supabase.js', () => ({ getSupabaseAccessToken: vi.fn(), primeSupabaseIdentity: vi.fn() }));
vi.mock('../../lib/editor/publish/publishClient.js', () => ({}));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({}) }));
vi.mock('@cinegen/lib/leads/project-link', () => ({}));
vi.mock('@cinegen/lib/leads/thumbnail', () => ({}));
vi.mock('@cinegen/lib/leads/publish-state', () => ({}));

import { getClient, offerGuestClaim } from '../components/leads/use-publish';
const w = window as unknown as { Clerk?: unknown };

beforeEach(() => { delete w.Clerk; claim.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('who owns the published video', () => {
  it('is a private guest when nobody is signed in', async () => {
    expect(await getClient()).toBe(guestClient);
  });
  it('is the account when signed in', async () => {
    w.Clerk = { user: { id: 'user_1' } };
    expect(await getClient()).toBe(accountClient);
  });
});

describe('moving guest content after sign-in', () => {
  it('asks nothing while signed out', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await offerGuestClaim()).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });
  it('does not move anything when the person says no', async () => {
    w.Clerk = { user: { id: 'user_1' }, session: { getToken: async () => 'tok' } };
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await offerGuestClaim()).toBeNull();
    expect(claim).not.toHaveBeenCalled();
  });
});
