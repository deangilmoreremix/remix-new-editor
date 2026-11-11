/**
 * Supabase-backed persistence for personalization outputs.
 *
 * Stores metadata and URLs server-side so completed personalizations
 * survive browser clears and are accessible across devices.
 */

export interface SupabaseSharedMediaEntry {
  id?: string
  originStudio?: string
  sourceType: string
  sourceDemoId?: string | null
  sourceDemoSlug?: string | null
  viralRecordId?: string | null
  sourceMedia?: string | null
  sourceUrl?: string | null
  personalizationMode?: string | null
  model?: string | null
  originalPrompt: string
  personalizedPrompt: string
  identityAssetIds: string[]
  logoAssetIds: string[]
  productAssetIds: string[]
  brandReferenceAssetIds: string[]
  firstFrameAssetId?: string | null
  lastFrameAssetId?: string | null
  outputUrls: string[]
  outputType: string
  clientId?: string | null
  createdAt?: string
}

const API_ROUTE = '/api/personalization/record'

export async function registerSupabaseSharedMedia(
  entry: SupabaseSharedMediaEntry
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(API_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
