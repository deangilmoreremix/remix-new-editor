import { vi } from 'vitest'

if (!process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
}
if (!process.env.VITE_SUPABASE_ANON_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
}
if (!process.env.KEY_ENCRYPTION_SECRET) {
  process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
}
if (!process.env.SUPABASE_OAUTH_CLIENT_ID) {
  process.env.SUPABASE_OAUTH_CLIENT_ID = 'test-cid'
}
if (!process.env.SUPABASE_OAUTH_CLIENT_SECRET) {
  process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'test-csecret'
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
}

vi.stubGlobal('import.meta.env', {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
})
