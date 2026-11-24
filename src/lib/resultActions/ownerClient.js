/**
 * The Supabase client that owns published videos: the account's when signed in, otherwise a private guest identity
 * (src/lib/guestIdentity.js), so "Get link" works without an account. Same rule as the Timeline editor's publish tab
 * (src/cinegen/components/leads/use-publish.ts getClient).
 */
export const isSignedIn = () => !!globalThis.window?.Clerk?.user;

/** `signedIn` is passed in so one click uses ONE identity from the copy to the publish (it can change mid-way). */
export async function getPublishOwnerClient({ signedIn = isSignedIn() } = {}) {
  if (!signedIn) return (await import('../guestIdentity.js')).getGuestOwnerClient();
  const { supabase } = await import('../hybrid-supabase.js');
  await supabase.refreshUserHeader?.();
  if (!supabase.supabase) throw new Error('The video service is unavailable — check your connection');
  return supabase.supabase;
}

/** Clerk id when signed in, else 'anonymous': the folder name the storage policies expect (smartvideo/<key>/...). */
export async function getOwnerKey() {
  const { getUserKey } = await import('../hybrid-supabase.js');
  return getUserKey();
}

const SALT_KEY = 'resultbar.guestSalt.v1';

/**
 * A random value kept in this browser. Every signed-out person has the owner key 'anonymous', so ids and storage
 * names built from it would collide between people; mixing this in keeps each browser's links its own.
 */
export function getGuestSalt(storage = (() => { try { return globalThis.localStorage; } catch { return null; } })()) {
  try {
    const existing = storage?.getItem(SALT_KEY);
    if (existing && /^[a-z0-9]{12,40}$/.test(existing)) return existing;
  } catch { /* storage blocked */ }
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes); else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
  const salt = Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  try { storage?.setItem(SALT_KEY, salt); } catch { /* the salt then lasts for this page only */ }
  return salt;
}
