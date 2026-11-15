/**
 * Browser client for the owner's saved Lead Finder leads (GET /api/personalization/leads, Clerk-authenticated, owner-scoped on the server).
 * Never throws: failures come back as a plain-language message, like the other personalization clients.
 */
import type { SavedLead } from './leadToRecipient'

export type SavedLeadsResult = { ok: true; leads: SavedLead[] } | { ok: false; message: string }
export const LEADS_API = '/api/personalization/leads'

export async function fetchSavedLeads(fetchFn: typeof fetch = fetch): Promise<SavedLeadsResult> {
  let res: Response
  try { res = await fetchFn(LEADS_API, { headers: { Accept: 'application/json' }, credentials: 'same-origin' }) }
  catch { return { ok: false, message: 'Could not reach your saved leads. Check your connection and try again.' } }
  const body = (await res.json().catch(() => ({}))) as { leads?: unknown; error?: unknown }
  if (res.status === 401) return { ok: false, message: 'Sign in to use your saved leads.' }
  if (res.status >= 500) return { ok: false, message: 'Saved leads are not available right now. Please try again later.' }
  if (!res.ok) return { ok: false, message: typeof body.error === 'string' && body.error.length < 120 ? body.error : 'Could not load your saved leads.' }
  const leads = (Array.isArray(body.leads) ? body.leads : []).filter((l): l is SavedLead => !!l && typeof l === 'object' && typeof (l as { id?: unknown }).id === 'string')
  return { ok: true, leads }
}
