/**
 * Attach the caller's identity to the ported personalization API calls.
 *
 * OpenHiggsBolt ran on Next.js, where Clerk's session cookie reached its API
 * routes automatically, so its client code calls `fetch('/api/personalization/…')`
 * with no auth header. remix serves those routes from a Netlify Function
 * (netlify/functions/personalization-api.mts) that verifies a Clerk session
 * bearer token. This wraps `window.fetch` once, and only for these route
 * prefixes, to add:
 *   - `Authorization: Bearer <Clerk session token>` when signed in
 *   - `x-openai-key` with the user's own OpenAI key from Settings, which the
 *     image analyze/edit routes prefer over the deployment key
 */
import { apiKeyManager } from '../../../lib/apiKeyManager.js'

const PREFIXES = ['/api/personalization/', '/api/demo/discover', '/api/video/record', '/api/proxy/openai-enhance']
const OPENAI_KEY_ROUTES = [
  '/api/personalization/image-analyze',
  '/api/personalization/image-edit',
  '/api/personalization/image-smart-edit',
  '/api/proxy/openai-enhance',
]

let installed = false

function pathOf(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return url.pathname
  } catch {
    return null
  }
}

async function clerkToken(): Promise<string | null> {
  try {
    const clerk = (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk
    return (await clerk?.session?.getToken?.()) || null
  } catch {
    return null
  }
}

export function installPersonalizationApiAuth(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(input)
    if (!path || !PREFIXES.some((prefix) => path.startsWith(prefix))) return nativeFetch(input, init)

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    if (!headers.has('authorization')) {
      const token = await clerkToken()
      if (token) headers.set('authorization', `Bearer ${token}`)
    }
    if (OPENAI_KEY_ROUTES.some((route) => path.startsWith(route)) && !headers.has('x-openai-key')) {
      try {
        const key = apiKeyManager.getOpenAIKey()
        if (key) headers.set('x-openai-key', key)
      } catch {
        /* no key configured — the server falls back to its own */
      }
    }
    if (input instanceof Request) return nativeFetch(new Request(input, { ...init, headers }))
    return nativeFetch(input, { ...init, headers })
  }
}
