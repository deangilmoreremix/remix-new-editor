/**
 * One-time cleanup of a builder session saved under supabase-js's DEFAULT
 * storage key.
 *
 * Before the builder got its own key (see supabase.ts), signing in wrote the
 * builder's session to `sb-<project-ref>-auth-token`, the same key SmartVideo's
 * own Supabase client reads on this origin. Anyone who signed in to the builder
 * in that window can still have that entry in their browser, where SmartVideo
 * would keep using (and refreshing) the builder's session.
 *
 * This removes that entry, and only when it is a builder login. A SmartVideo
 * session (or anything unreadable) at that key is never touched.
 */

type StorageLike = Pick<Storage, 'getItem' | 'removeItem'>

/** supabase-js's default key: `sb-<first label of the project host>-auth-token`. */
export function legacySupabaseStorageKey(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname
    const ref = host.split('.')[0]
    return ref ? `sb-${ref}-auth-token` : null
  } catch {
    return null
  }
}

interface StoredSession {
  user?: {
    user_metadata?: { wb_login_proof?: unknown } | null
    app_metadata?: { source?: unknown } | null
  } | null
}

function isBuilderSession(value: unknown): boolean {
  const user = (value as StoredSession | null)?.user
  if (!user) return false
  return (
    typeof user.user_metadata?.wb_login_proof === 'string' ||
    user.app_metadata?.source === 'smart-website-builder'
  )
}

/** @returns true when a builder session was found at the legacy key and removed. */
export function removeLegacyBuilderSession(storage: StorageLike | undefined, supabaseUrl: string): boolean {
  try {
    const key = legacySupabaseStorageKey(supabaseUrl)
    if (!storage || !key) return false
    const raw = storage.getItem(key)
    if (!raw) return false
    if (!isBuilderSession(JSON.parse(raw))) return false
    storage.removeItem(key)
    return true
  } catch {
    // Unreadable storage or malformed JSON: leave whatever is there alone.
    return false
  }
}
