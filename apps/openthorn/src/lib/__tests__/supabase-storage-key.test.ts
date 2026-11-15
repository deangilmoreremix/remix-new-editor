import { afterEach, describe, expect, it, vi } from 'vitest'

// The builder shares an origin (and localStorage) with SmartVideo's own Supabase
// client, which uses supabase-js's default key `sb-<project-ref>-auth-token`.
// If the builder used the same key the two apps would overwrite each other's
// sessions.
describe('builder Supabase session storage key', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function load() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    return import('../supabase')
  }

  it('is not the supabase-js default key that the main app uses', async () => {
    const { BUILDER_AUTH_STORAGE_KEY } = await load()
    const mainAppDefault = 'sb-abcdefghijklmnopqrst-auth-token'
    expect(BUILDER_AUTH_STORAGE_KEY).not.toBe(mainAppDefault)
    expect(BUILDER_AUTH_STORAGE_KEY).not.toMatch(/^sb-.*-auth-token$/)
  })

  it('is the key the live client actually uses', async () => {
    const { supabase, BUILDER_AUTH_STORAGE_KEY } = await load()
    const used = (supabase.auth as unknown as { storageKey: string }).storageKey
    expect(used).toBe(BUILDER_AUTH_STORAGE_KEY)
  })
})
