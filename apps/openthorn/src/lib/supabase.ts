import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

/**
 * Browser storage key for the builder's Supabase session.
 *
 * The builder is embedded in SmartVideo on the same origin, and SmartVideo's own
 * Supabase client (src/lib/supabase.js, persistSession: true) uses supabase-js's
 * default key, `sb-<project-ref>-auth-token`. If the builder used the default
 * too, signing in here would hand SmartVideo the builder's session, and the
 * builder's local sign-out / session clear would wipe SmartVideo's. Keep this
 * different from the default.
 */
export const BUILDER_AUTH_STORAGE_KEY = 'smartvideo-website-builder-auth'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: BUILDER_AUTH_STORAGE_KEY },
})
