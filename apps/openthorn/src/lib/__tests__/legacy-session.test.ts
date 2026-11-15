import { describe, expect, it } from 'vitest'
import { legacySupabaseStorageKey, removeLegacyBuilderSession } from '../legacy-session'

const URL_ = 'https://abcdefghijklmnopqrst.supabase.co'
const KEY = 'sb-abcdefghijklmnopqrst-auth-token'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    removeItem: (k: string) => { data.delete(k) },
    keys: () => [...data.keys()],
  }
}

const session = (user: Record<string, unknown>) => JSON.stringify({ access_token: 'a', refresh_token: 'r', user })

describe('legacySupabaseStorageKey', () => {
  it('matches the supabase-js default key', () => {
    expect(legacySupabaseStorageKey(URL_)).toBe(KEY)
  })
  it('returns null for an unusable url', () => {
    expect(legacySupabaseStorageKey('not a url')).toBeNull()
    expect(legacySupabaseStorageKey('')).toBeNull()
  })
})

describe('removeLegacyBuilderSession', () => {
  it('removes a builder session identified by the login proof', () => {
    const s = memoryStorage({ [KEY]: session({ user_metadata: { wb_login_proof: 'abc' } }) })
    expect(removeLegacyBuilderSession(s, URL_)).toBe(true)
    expect(s.keys()).toEqual([])
  })

  it('removes a builder session identified by the app_metadata source', () => {
    const s = memoryStorage({ [KEY]: session({ app_metadata: { source: 'smart-website-builder' } }) })
    expect(removeLegacyBuilderSession(s, URL_)).toBe(true)
    expect(s.keys()).toEqual([])
  })

  it('never touches a normal SmartVideo session at that key', () => {
    const normal = session({ user_metadata: { name: 'Someone' }, app_metadata: { provider: 'email' } })
    const s = memoryStorage({ [KEY]: normal })
    expect(removeLegacyBuilderSession(s, URL_)).toBe(false)
    expect(s.getItem(KEY)).toBe(normal)
  })

  it('leaves the builder\'s own key and other keys alone', () => {
    const own = session({ user_metadata: { wb_login_proof: 'abc' } })
    const s = memoryStorage({ 'smartvideo-website-builder-auth': own, other: 'x' })
    expect(removeLegacyBuilderSession(s, URL_)).toBe(false)
    expect(s.keys().sort()).toEqual(['other', 'smartvideo-website-builder-auth'])
  })

  it('tolerates a missing key, malformed JSON, no storage and a bad url', () => {
    expect(removeLegacyBuilderSession(memoryStorage(), URL_)).toBe(false)
    const bad = memoryStorage({ [KEY]: '{not json' })
    expect(removeLegacyBuilderSession(bad, URL_)).toBe(false)
    expect(bad.getItem(KEY)).toBe('{not json')
    expect(removeLegacyBuilderSession(undefined, URL_)).toBe(false)
    expect(removeLegacyBuilderSession(memoryStorage({ [KEY]: session({}) }), 'nope')).toBe(false)
  })
})
