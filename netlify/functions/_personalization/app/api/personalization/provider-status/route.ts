import { NextResponse } from '../../../../shims/next-server'
import { overpassHealth } from '../../../../src/server/businessDiscovery/overpassProvider'
import { nominatimHealth } from '../../../../src/server/businessDiscovery/nominatimSearchProvider'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export type ProviderState = 'ok' | 'degraded' | 'cooling-down' | 'unknown'

/**
 * How the free map-data providers behind the Business Finder are doing, as seen by THIS server instance.
 * It reflects recent failures this instance has had (a circuit breaker), not a live probe, so a cold instance
 * says "ok"/"unknown" until it has made requests. No provider URLs or error text are exposed.
 */
export function summarizeProviders(
  overpass: { tracked: number; coolingDown: number },
  nominatim: { coolingDown: boolean; consecutiveFailures: number },
): { overpass: ProviderState; nominatim: ProviderState } {
  const o: ProviderState = overpass.tracked === 0 ? 'unknown' : overpass.coolingDown === 0 ? 'ok' : overpass.coolingDown >= overpass.tracked ? 'cooling-down' : 'degraded'
  const n: ProviderState = nominatim.coolingDown ? 'cooling-down' : nominatim.consecutiveFailures > 0 ? 'degraded' : 'ok'
  return { overpass: o, nominatim: n }
}

export async function GET() {
  const providers = summarizeProviders(overpassHealth(), nominatimHealth())
  return NextResponse.json(
    { ok: true, providers, scope: 'this server instance', checkedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
