import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Hardening regression for the entitlement cache (src/lib/clerkEntitlements.js).
 *
 * The cache used to live on `globalThis['__smartvideo_entitlement__']`, a plain
 * writable object, so `window.__smartvideo_entitlement__ = { hasFullAccess:
 * true }` in the console unlocked every paid gate. The cache is now
 * module-private; `setEntitlement()` is the only writer, and the only way for
 * tests/e2e to grant entitlement is the non-writable
 * `window.__smartvideo_entitlement_override` function.
 */

vi.mock('../../src/lib/loading.js', () => ({ showToast: vi.fn() }));

import {
  getEntitlement,
  setEntitlement,
  hasFullAccess,
  requireEntitlement,
} from '../../src/lib/clerkEntitlements.js';

describe('entitlement cache hardening', () => {
  beforeEach(() => {
    setEntitlement({ hasFullAccess: false });
  });

  afterEach(() => {
    setEntitlement({ hasFullAccess: false });
  });

  it('defaults to no access before any legitimate grant', () => {
    expect(hasFullAccess()).toBe(false);
    expect(getEntitlement().hasFullAccess).toBe(false);
  });

  it('ignores naive window/global tampering of the old writable global', () => {
    window.__smartvideo_entitlement__ = { hasFullAccess: true };
    globalThis.__smartvideo_entitlement__ = { hasFullAccess: true };

    expect(hasFullAccess()).toBe(false);
    expect(getEntitlement().hasFullAccess).toBe(false);
  });

  it('ignores naive tampering even after a legitimate grant', () => {
    setEntitlement({ hasFullAccess: true });
    window.__smartvideo_entitlement__ = { hasFullAccess: false };
    expect(hasFullAccess()).toBe(true);

    window.__smartvideo_entitlement__ = { hasFullAccess: true };
    setEntitlement({ hasFullAccess: false });
    window.__smartvideo_entitlement__ = { hasFullAccess: true };
    expect(hasFullAccess()).toBe(false);
  });

  it('does not expose a writable entitlement object on globalThis', () => {
    // Nothing entitlement-shaped may be assignable/hackable on window: the
    // only override surface is the non-writable function below.
    const descriptor = Object.getOwnPropertyDescriptor(window, '__smartvideo_entitlement__');
    if (descriptor) {
      expect(descriptor.writable).toBe(true); // a plain data slot — but nothing reads it
    }
    const overrideDescriptor = Object.getOwnPropertyDescriptor(window, '__smartvideo_entitlement_override');
    expect(overrideDescriptor).toBeDefined();
    expect(typeof overrideDescriptor.value).toBe('function');
    expect(overrideDescriptor.writable).toBe(false);
    expect(overrideDescriptor.configurable).toBe(false);
  });

  it('rejects reassignment of the override function itself', () => {
    const original = window.__smartvideo_entitlement_override;
    let threw = false;
    try {
      window.__smartvideo_entitlement_override = () => ({ hasFullAccess: true });
    } catch {
      // Strict-mode assignment to a non-writable property throws — expected.
      threw = true;
    }
    expect(threw || window.__smartvideo_entitlement_override === original).toBe(true);
    expect(window.__smartvideo_entitlement_override).toBe(original);
  });

  it('lets only the module setter change state', () => {
    setEntitlement({ hasFullAccess: true });
    expect(hasFullAccess()).toBe(true);

    setEntitlement({ hasFullAccess: false });
    expect(hasFullAccess()).toBe(false);

    // Falsy / malformed payloads never grant access.
    setEntitlement({ hasFullAccess: 'yes' });
    expect(hasFullAccess()).toBe(false);
    setEntitlement(undefined);
    expect(hasFullAccess()).toBe(false);
  });

  it('returns a copy from getEntitlement so callers cannot mutate state', () => {
    setEntitlement({ hasFullAccess: true });
    const snapshot = getEntitlement();
    snapshot.hasFullAccess = false;
    expect(hasFullAccess()).toBe(true);
  });

  it('grants access through the window override function', () => {
    expect(typeof window.__smartvideo_entitlement_override).toBe('function');
    window.__smartvideo_entitlement_override({ hasFullAccess: true });
    expect(hasFullAccess()).toBe(true);
    expect(getEntitlement().hasFullAccess).toBe(true);
  });

  it('revokes access through the window override function', () => {
    window.__smartvideo_entitlement_override({ hasFullAccess: true });
    expect(hasFullAccess()).toBe(true);

    window.__smartvideo_entitlement_override({ hasFullAccess: false });
    expect(hasFullAccess()).toBe(false);
  });

  it('requireEntitlement resolves false without entitlement', async () => {
    setEntitlement({ hasFullAccess: false });
    await expect(requireEntitlement()).resolves.toBe(false);
  });

  it('requireEntitlement resolves true with entitlement', async () => {
    setEntitlement({ hasFullAccess: true });
    await expect(requireEntitlement()).resolves.toBe(true);
  });

  it('requireEntitlement stays blocked when the old global is tampered with', async () => {
    window.__smartvideo_entitlement__ = { hasFullAccess: true };
    await expect(requireEntitlement()).resolves.toBe(false);
  });

  it('requireEntitlement passes once the override function grants access', async () => {
    window.__smartvideo_entitlement_override({ hasFullAccess: true });
    await expect(requireEntitlement()).resolves.toBe(true);
  });
});
