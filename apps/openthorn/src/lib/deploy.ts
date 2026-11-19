import { supabase } from './supabase'
import { apiUrl } from './api'

export interface DeployResult {
  url: string
  siteId: string
}

/** Thrown when the user has not connected their own Cloudflare account yet. */
export class CloudflareNotConnectedError extends Error {
  constructor(message = 'Connect your Cloudflare account in Settings → Hosting to publish.') {
    super(message)
    this.name = 'CloudflareNotConnectedError'
  }
}

export async function deploySite(
  projectId: string,
  html: string,
  existingSiteId?: string | null,
): Promise<DeployResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('You must be signed in to publish a site.')
  }

  const res = await fetch(apiUrl('deploy'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, html, existingSiteId }),
  })

  if (res.status === 409 || res.status === 503) {
    const info = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    if (info.error === 'cloudflare_not_connected') throw new CloudflareNotConnectedError(info.message)
    if (info.error === 'cloudflare_not_configured') throw new Error(info.message || "Publishing isn't set up on this site yet.")
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Deploy failed: ${body || res.statusText}`)
  }

  const data2 = await res.json()
  if (!data2?.url || !data2?.siteId) {
    throw new Error('Deploy failed: invalid response from deploy endpoint')
  }

  return {
    url: String(data2.url),
    siteId: String(data2.siteId),
  }
}
