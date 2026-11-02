/**
 * remix-new-editor shim for OpenHiggsBolt's `@/lib/supabase`.
 * The browser client is remix's Clerk-authenticated client.
 * `primeSupabaseIdentity()` awaits the Clerk → Supabase token exchange so the
 * next storage/RLS request carries the verified identity.
 */
export { supabase, primeSupabaseIdentity } from '../../../lib/supabase.js'
