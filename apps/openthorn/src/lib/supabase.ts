import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

let _supabase: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { transport: ws as unknown as typeof WebSocket },
    })
  }
  return _supabase
}

// Lazy-loaded Supabase client proxy. The underlying client is not created
// until first property/method access. This avoids eager RealtimeClient init
// during SSR/prerender on Node < 22.
export const supabase = new Proxy(getClient, {
  apply(_target, _thisArg, _argumentsList) {
    return getClient()
  },
  get(_, prop: string) {
    const client = getClient()
    const value = (client as unknown as Record<string, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
  set() {
    throw new Error('Cannot assign to the Supabase client')
  },
}) as unknown as SupabaseClient
