// clerk-js v6 has no prebuilt components of its own: clerkInit must hand Clerk the UI from the CDN
// or <UserButton> (the signed-in account menu) throws "Clerk was not loaded with Ui components".
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@clerk/clerk-js', () => ({ Clerk: class {} }));
vi.mock('@clerk/shared/loadClerkJsScript', () => ({ loadClerkUIScript: vi.fn() }));

const { loadClerkUI } = await import('../clerkInit.js');

afterEach(() => { delete globalThis.__internal_ClerkUICtor; });

describe('loadClerkUI', () => {
  test('loads the UI script with the publishable key and resolves to the UI constructor', async () => {
    const ctor = class ClerkUI {};
    const loadScript = vi.fn(async () => { globalThis.__internal_ClerkUICtor = ctor; return null; });
    await expect(loadClerkUI('pk_live_x', loadScript)).resolves.toBe(ctor);
    expect(loadScript).toHaveBeenCalledWith({ publishableKey: 'pk_live_x' });
  });

  test('rejects (sign-in keeps working without components) when the script gives no constructor', async () => {
    await expect(loadClerkUI('pk_live_x', vi.fn(async () => null))).rejects.toThrow('Clerk UI did not load');
  });

  test('rejects when the script itself fails to load', async () => {
    await expect(loadClerkUI('pk_live_x', vi.fn(async () => { throw new Error('blocked'); }))).rejects.toThrow('blocked');
  });
});
