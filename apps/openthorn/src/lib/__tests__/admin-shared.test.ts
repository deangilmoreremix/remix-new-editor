import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const USER_ID = '11111111-1111-4111-8111-111111111111'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('admin server helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  describe('verifyUser and builder suspension', () => {
    const authOk = () => jsonResponse({ id: USER_ID, email: 'a@b.co' })

    it('accepts a valid token whose profile is not suspended', async () => {
      fetchMock.mockResolvedValueOnce(authOk()).mockResolvedValueOnce(jsonResponse([{ suspended: false }]))
      const { verifyUser } = await import('../../../api/_shared')
      await expect(verifyUser('Bearer t')).resolves.toEqual({ id: USER_ID, email: 'a@b.co' })
      expect(String(fetchMock.mock.calls[1][0])).toContain(`/rest/v1/wb_profiles?id=eq.${USER_ID}&select=suspended`)
    })

    it('rejects an existing session once the profile is suspended', async () => {
      fetchMock.mockResolvedValueOnce(authOk()).mockResolvedValueOnce(jsonResponse([{ suspended: true }]))
      const { verifyUser } = await import('../../../api/_shared')
      await expect(verifyUser('Bearer t')).resolves.toBeNull()
    })

    it('fails closed when the suspension lookup errors', async () => {
      fetchMock.mockResolvedValueOnce(authOk()).mockResolvedValueOnce(jsonResponse({}, false, 500))
      const { verifyUser } = await import('../../../api/_shared')
      await expect(verifyUser('Bearer t')).resolves.toBeNull()
    })

    it('skips the check when no service role key is configured (local dev)', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      fetchMock.mockResolvedValueOnce(authOk())
      const { verifyUser } = await import('../../../api/_shared')
      await expect(verifyUser('Bearer t')).resolves.toEqual({ id: USER_ID, email: 'a@b.co' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('isAdminUser returns true when the profile row has is_admin', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: true }]))
    const { isAdminUser } = await import('../../../api/_shared')
    await expect(isAdminUser(USER_ID)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain(`/rest/v1/wb_profiles?id=eq.${USER_ID}`)
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('isAdminUser returns false on non-admin, error, or missing service key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: false }]))
    const shared = await import('../../../api/_shared')
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)
  })

  it('adminSetUserSuspended only flags the builder profile and never touches auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminSetUserSuspended } = await import('../../../api/_shared')
    await adminSetUserSuspended(USER_ID, true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://test.supabase.co/rest/v1/wb_profiles?id=eq.${USER_ID}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ suspended: true })
    await adminSetUserSuspended(USER_ID, false)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ suspended: false })
  })

  it('adminDeleteUser removes builder rows only and never calls the auth admin API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await adminDeleteUser(USER_ID)
    const urls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(urls.some((u) => u.includes('/auth/v1/'))).toBe(false)
    expect(urls.every((u) => /\/rest\/v1\/wb_[a-z_]+\?/.test(u))).toBe(true)
    expect(urls).toContain(`https://test.supabase.co/rest/v1/wb_projects?user_id=eq.${USER_ID}`)
    expect(urls[urls.length - 1]).toBe(`https://test.supabase.co/rest/v1/wb_profiles?id=eq.${USER_ID}`)
    expect(fetchMock.mock.calls.every(([, i]) => i.method === 'DELETE')).toBe(true)
  })

  it('admin mutations throw when the database errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, false, 500))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await expect(adminDeleteUser(USER_ID)).rejects.toThrow()
  })

  it('triggerDeploy posts to the configured hook and throws without it', async () => {
    const shared = await import('../../../api/_shared')

    delete process.env.VERCEL_DEPLOY_HOOK_URL
    await expect(shared.triggerDeploy()).rejects.toThrow()

    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    fetchMock.mockResolvedValueOnce(jsonResponse({ job: { id: 'j1' } }))
    await shared.triggerDeploy()
    const last = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(String(last[0])).toBe('https://api.vercel.com/v1/integrations/deploy/abc')
    expect(last[1].method).toBe('POST')
  })
})
