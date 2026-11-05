/**
 * Minimal `next/server` replacement for the ported OpenHiggsBolt routes.
 *
 * Netlify Functions v2 already speak the web `Request`/`Response` API, so
 * `NextRequest` only needs Next's two conveniences the routes use
 * (`nextUrl` and `cookies.getAll()`) and `NextResponse.json` is
 * `Response.json`. `after()` hands work to the platform's `waitUntil`, which
 * keeps the function alive until it settles, like Next's `after()`.
 */
import { currentRequestContext } from './requestContext'

function parseCookies(header: string | null): Array<{ name: string; value: string }> {
  if (!header) return []
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      const name = eq === -1 ? part : part.slice(0, eq)
      const value = eq === -1 ? '' : part.slice(eq + 1)
      let decoded = value
      try { decoded = decodeURIComponent(value) } catch { /* keep raw */ }
      return { name: name.trim(), value: decoded }
    })
}

export class NextRequest extends Request {
  readonly nextUrl: URL
  readonly cookies: {
    getAll: () => Array<{ name: string; value: string }>
    get: (name: string) => { name: string; value: string } | undefined
  }

  constructor(input: Request | string | URL, init?: RequestInit) {
    super(input as Request, init)
    this.nextUrl = new URL(this.url)
    const all = parseCookies(this.headers.get('cookie'))
    this.cookies = {
      getAll: () => all.slice(),
      get: (name: string) => all.find((c) => c.name === name),
    }
  }
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    const headers = new Headers(init?.headers)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    return new NextResponse(JSON.stringify(body), { ...init, headers })
  }
}

export function after(task: Promise<unknown> | (() => unknown)): void {
  const ctx = currentRequestContext()
  if (!ctx) throw new Error('after() was called outside a request scope')
  const promise = Promise.resolve().then(() => (typeof task === 'function' ? (task as () => unknown)() : task))
  promise.catch((err) => console.error('[personalization-api] after() task failed:', err?.message || err))
  if (ctx.waitUntil) ctx.waitUntil(promise)
}
