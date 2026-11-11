import { createClient, SupabaseClient } from '@supabase/supabase-js'

function env(name: string, fallback = '') {
  return (process.env as Record<string, string | undefined>)[name] ?? fallback
}

let browserSingleton: SupabaseClient | undefined

function getBrowserClient(): SupabaseClient {
  if (browserSingleton) return browserSingleton

  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable'
    )
  }

  browserSingleton = createClient(url, key)
  return browserSingleton
}

// Server copy: the anon client is created on first use instead of at import,
// so a missing anon key can never crash the whole function at load time.
export function getSupabaseClient(): SupabaseClient {
  return getBrowserClient()
}

export function createServerClient(): SupabaseClient {
  const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL') || ''
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function mirrorUrlToStorage(
  url: string,
  filename: string,
  folder: string
): Promise<string> {
  const client = createServerClient()

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    )
  }

  const blob = await response.blob()
  const path = `${folder}/${filename}`

  const { error } = await client.storage.from('brand-assets').upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'application/octet-stream',
  })

  if (error) throw error

  const { data } = client.storage.from('brand-assets').getPublicUrl(path)
  return data.publicUrl
}
