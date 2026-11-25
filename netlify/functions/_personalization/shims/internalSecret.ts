/**
 * The shared secret between the personalization API and its workers (browser discovery, motion capture).
 *
 * Preference order: an explicit INTERNAL_FUNCTION_SECRET, then remix's PERSONALIZATION_DISCOVERY_SECRET, then a value
 * derived from the Supabase service-role key. The derived value is an HMAC, so the service key itself is never
 * exposed, it is stable across functions and deploys, and a deployment that has a service key needs no extra setting.
 */
import { createHmac } from 'node:crypto'

type Env = Record<string, string | undefined>

export function resolveInternalSecret(env: Env): string {
  const explicit = env.INTERNAL_FUNCTION_SECRET || env.PERSONALIZATION_DISCOVERY_SECRET
  if (explicit) return explicit
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return ''
  return createHmac('sha256', serviceKey).update('remix-internal-function-secret').digest('hex')
}
