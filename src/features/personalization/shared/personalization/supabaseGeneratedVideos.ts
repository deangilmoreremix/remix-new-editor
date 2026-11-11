/**
 * Supabase-backed persistence for generated videos.
 *
 * Stores durable metadata after MuAPI video generation completes so history
 * survives browser clears and is accessible across devices.
 */

export interface GeneratedVideoEntry {
  id?: string
  project_id?: string | null
  client_id?: string | null
  source_type?: string | null
  source_media?: string | null
  source_url?: string | null
  personalization_mode?: string | null
  model: string
  prompt: string
  selected_asset_ids?: string[]
  provider_job_id?: string | null
  video_url: string
  storage_path?: string | null
  status?: string
  duration_seconds?: number | null
  aspect_ratio?: string | null
  resolution?: string | null
  quality?: string | null
  effect?: string | null
  metadata?: Record<string, unknown>
}

const API_ROUTE = '/api/video/record'

export async function registerGeneratedVideo(entry: GeneratedVideoEntry): Promise<{ ok: boolean; error?: string }> {
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
