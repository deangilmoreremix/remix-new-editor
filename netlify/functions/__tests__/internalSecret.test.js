import { describe, it, expect } from 'vitest'
import { resolveInternalSecret } from '../_personalization/shims/internalSecret'

describe('resolveInternalSecret', () => {
  it('prefers an explicit INTERNAL_FUNCTION_SECRET', () => {
    expect(resolveInternalSecret({ INTERNAL_FUNCTION_SECRET: 'explicit', PERSONALIZATION_DISCOVERY_SECRET: 'disc', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBe('explicit')
  })
  it('then remix\'s discovery secret', () => {
    expect(resolveInternalSecret({ PERSONALIZATION_DISCOVERY_SECRET: 'disc', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBe('disc')
  })
  it('then a value derived from the service key: stable, different per key, never the key itself', () => {
    const a = resolveInternalSecret({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-one' })
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(resolveInternalSecret({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-one' }))
    expect(a).not.toBe(resolveInternalSecret({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-two' }))
    expect(a).not.toContain('service-key-one')
  })
  it('is empty when nothing is configured', () => {
    expect(resolveInternalSecret({})).toBe('')
  })
})

describe('env shim', () => {
  it('lets the personalization routes pass env validation with only the service key set', async () => {
    const { vi } = await import('vitest')
    const saved = { ...process.env }
    try {
      for (const k of ['INTERNAL_FUNCTION_SECRET', 'PERSONALIZATION_DISCOVERY_SECRET']) delete process.env[k]
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
      vi.resetModules()
      await import('../_personalization/shims/env')
      const { validatePersonalizationEnv } = await import('../_personalization/src/server/envValidation')
      expect(validatePersonalizationEnv()).toMatchObject({ valid: true, missingRequired: [] })
      expect(process.env.INTERNAL_FUNCTION_SECRET).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
      Object.assign(process.env, saved)
    }
  })
})
