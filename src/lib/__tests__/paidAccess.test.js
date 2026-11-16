// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@clerk/react', () => ({ useAuth: () => ({}), useUser: () => ({}) }));
import { hasPaidAccess, setEntitlement, PAID_FEATURE } from '../clerkEntitlements.js';
import UpgradePrompt from '../../components/UpgradePrompt.js';

const clerkWith = ({ user = { id: 'u1', publicMetadata: {} }, plan = false, mount = true } = {}) => ({
  user,
  session: { checkAuthorization: vi.fn(({ feature }) => plan && feature === PAID_FEATURE), reload: vi.fn(async () => {}) },
  ...(mount ? { mountPricingTable: vi.fn(), unmountPricingTable: vi.fn() } : {}),
  openSignIn: vi.fn(),
});

describe('SmartVideo full access', () => {
  beforeEach(() => { setEntitlement({ hasFullAccess: false }); document.body.innerHTML = ''; });

  it('the paid plan or legacy access; nobody signed out', () => {
    expect(hasPaidAccess(clerkWith({ plan: true }))).toBe(true);
    expect(hasPaidAccess(clerkWith({ plan: false }))).toBe(false);
    expect(hasPaidAccess(clerkWith({ user: { id: 'u1', publicMetadata: { legacy_access: true } } }))).toBe(true);
    expect(hasPaidAccess({ user: null })).toBe(false);
    expect(hasPaidAccess(undefined)).toBe(false);
  });

  it('the upgrade screen shows Clerk’s pricing table and checks again on close (a purchase unlocks)', async () => {
    const clerk = clerkWith({ plan: false });
    const done = UpgradePrompt({ feature: 'Video Outreach', clerk });
    expect(document.body.textContent).toContain('Unlock SmartVideo full access');
    expect(document.body.textContent).toContain('Video Outreach');
    const host = document.querySelector('[data-upgrade-pricing]');
    expect(clerk.mountPricingTable).toHaveBeenCalledWith(host, expect.any(Object));
    clerk.session.checkAuthorization.mockImplementation(() => true); // bought in the table
    document.querySelector('[aria-label="Close"]').click();
    expect(await done).toBe(true);
    expect(clerk.unmountPricingTable).toHaveBeenCalledWith(host);
    expect(clerk.session.reload).toHaveBeenCalled();
    expect(document.querySelector('[data-upgrade]')).toBeNull();
  });

  it('signed out: asks to sign in; without the pricing table: says so', async () => {
    const out = clerkWith({ user: null });
    const a = UpgradePrompt({ clerk: out });
    document.querySelector('[data-upgrade-signin]').click();
    expect(out.openSignIn).toHaveBeenCalled();
    expect(await a).toBe(false);
    const b = UpgradePrompt({ clerk: clerkWith({ mount: false }) });
    expect(document.querySelector('[data-upgrade-unavailable]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await b).toBe(false);
  });
});
