/**
 * The Supabase client that owns published videos: the account's when signed in, otherwise a private guest identity
 * (src/lib/guestIdentity.js), so "Get link" works without an account. Same rule as the Timeline editor's publish tab
 * (src/cinegen/components/leads/use-publish.ts getClient).
 */
export const isSignedIn = () => !!globalThis.window?.Clerk?.user;

export async function getPublishOwnerClient() {
  if (!isSignedIn()) return (await import('../guestIdentity.js')).getGuestOwnerClient();
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
