// [remix] Publishing from the Leads / Export tabs works without an account.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { guestClient, accountClient, claim } = vi.hoisted(() => ({ guestClient: { who: 'guest' }, accountClient: { who: 'account' }, claim: vi.fn() }));
vi.mock('../../lib/guestIdentity.js', () => ({
  getGuestOwnerClient: vi.fn(async () => guestClient),
  hasGuestIdentity: vi.fn(() => true),
  claimGuestContent: claim,
}));
vi.mock('../../lib/hybrid-supabase.js', () => ({ supabase: { supabase: accountClient, refreshUserHeader: vi.fn(async () => {}) }, uploadFileToStorage: vi.fn() }));
const tokenState = vi.hoisted(() => ({ token: 'verified-token' as string | null, failure: null as string | null }));
vi.mock('../../lib/supabase.js', () => ({ getSupabaseAccessToken: vi.fn(async () => tokenState.token), getTokenExchangeFailure: vi.fn(() => tokenState.failure), primeSupabaseIdentity: vi.fn() }));
vi.mock('../../lib/editor/publish/publishClient.js', () => ({}));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({}) }));
vi.mock('@cinegen/lib/leads/project-link', () => ({}));
vi.mock('@cinegen/lib/leads/thumbnail', () => ({}));
vi.mock('@cinegen/lib/leads/publish-state', () => ({}));

import { getClient, offerGuestClaim } from '../components/leads/use-publish';
const w = window as unknown as { Clerk?: unknown };

beforeEach(() => { delete w.Clerk; claim.mockReset(); tokenState.token = 'verified-token'; tokenState.failure = null; });
afterEach(() => { vi.restoreAllMocks(); });

describe('who owns the published video', () => {
  it('is a private guest when nobody is signed in', async () => {
    expect(await getClient()).toBe(guestClient);
  });
  it('is the account when signed in', async () => {
    w.Clerk = { user: { id: 'user_1' } };
    expect(await getClient()).toBe(accountClient);
  });
  it('says why when signed in but the database token cannot be obtained (instead of a generic sign-in error)', async () => {
    w.Clerk = { user: { id: 'user_1' } };
    tokenState.token = null;
    tokenState.failure = 'The server is missing SUPABASE_JWT_SECRET, so it cannot issue a database token (HTTP 503).';
    await expect(getClient()).rejects.toThrow(/SUPABASE_JWT_SECRET/);
  });
  it('never applies the token check to a guest', async () => {
    tokenState.token = null;
    expect(await getClient()).toBe(guestClient);
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
