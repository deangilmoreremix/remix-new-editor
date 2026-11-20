import { supabase } from './supabase'
import { apiUrl } from './api'

export interface CloudflareStatus {
  /** False until the site owner has set the server secrets that protect saved tokens. */
  configured: boolean
  connected: boolean
  accountId: string | null
  tokenLast4: string | null
}

async function call(method: 'GET' | 'POST' | 'DELETE', body?: { accountId: string; token: string }): Promise<CloudflareStatus> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in.')
  const res = await fetch(apiUrl('cloudflare'), {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as Partial<CloudflareStatus> & { message?: string; error?: string }
  if (!res.ok) throw new Error(json.message || json.error || `Request failed ${res.status}`)
  return {
    configured: json.configured !== false,
    connected: Boolean(json.connected),
    accountId: json.accountId ?? null,
    tokenLast4: json.tokenLast4 ?? null,
  }
}

export const getCloudflareStatus = () => call('GET')
export const connectCloudflare = (accountId: string, token: string) => call('POST', { accountId, token })
export const disconnectCloudflare = () => call('DELETE')
