/**
 * Client IP for rate limiting.
 *
 * Preference order (most to least trustworthy):
 *  1. `x-nf-client-connection-ip` — set by Netlify's edge for every request; a client cannot choose it.
 *  2. `x-real-ip` — stamped by a trusted reverse proxy / load balancer.
 *  3. the LAST `x-forwarded-for` hop — append-only, so the last entry is the one the nearest proxy added;
 *     the first entries are whatever the client sent and must never be trusted.
 * Returns undefined when none exist, so the caller falls back to its shared (higher-limit) anonymous bucket.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | undefined {
  const valid = (v: string | null | undefined): string | undefined => {
    const t = v?.trim()
    return t && t.length <= 64 && /^[0-9a-fA-F:.]+$/.test(t) ? t : undefined
  }
  const nf = valid(headers.get('x-nf-client-connection-ip'))
  if (nf) return nf
  const real = valid(headers.get('x-real-ip'))
  if (real) return real
  const hops = (headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return valid(hops[hops.length - 1])
}
