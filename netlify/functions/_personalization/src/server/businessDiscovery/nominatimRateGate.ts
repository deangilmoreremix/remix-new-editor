/**
 * Shared rate gate for every request the app makes to Nominatim.
 *
 * Nominatim's public instance allows roughly one request per second. The
 * policy is about the REQUEST RATE, not about how many requests may be in
 * flight at once, so this gate only paces the moment a request is STARTED:
 *
 *  - consecutive starts are always at least `MIN_REQUEST_INTERVAL_MS` apart,
 *    process-wide (the gate is module-level on purpose — it must cover every
 *    caller in the process, not just one request);
 *  - requests may overlap while they are in flight, so a slow response never
 *    blocks the next query. That is what keeps the Lead Finder search inside
 *    its latency budget: three Nominatim queries cost ~2.2s of pacing plus
 *    the slowest single response instead of the SUM of all three.
 *
 * The gate is shared by the geocoder (`nominatimProvider.ts`) and the
 * business-list search (`nominatimSearchProvider.ts`) so the app-wide rate
 * stays within policy no matter which one is used.
 */

/**
 * Nominatim's public instance is limited to ~1 request/second. Every call is
 * paced through this interval so a burst of searches cannot exceed it.
 */
export const MIN_REQUEST_INTERVAL_MS = 1_100

let startChain: Promise<void> = Promise.resolve()
let lastRequestStartedAt = 0

/** An abort error shaped like the one `fetch` throws, so callers can treat
 *  a cancelled request and a cancelled wait the same way. */
function abortError(): Error {
  const err = new Error('The operation was aborted')
  err.name = 'AbortError'
  return err
}

/**
 * Waits `ms` milliseconds, rejecting early when `signal` aborts.
 *
 * The abort path matters for the request budget: a queued reservation that is
 * no longer needed (the stage budget is spent) must release the queue
 * immediately instead of holding the slot for another pacing interval.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Reserves the next request start slot and resolves once the caller may
 * issue its request. The returned promise resolves BEFORE the request is
 * sent, so callers must perform the request immediately after awaiting it.
 *
 * When `signal` aborts while the caller is queued, the reservation is
 * abandoned (no request start is consumed) and the call rejects with an
 * `AbortError`.
 */
export async function reserveNominatimStart(signal?: AbortSignal): Promise<void> {
  const turn = startChain.then(async () => {
    if (signal?.aborted) throw abortError()
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt)
    if (wait > 0) await sleep(wait, signal)
    if (signal?.aborted) throw abortError()
    lastRequestStartedAt = Date.now()
  })
  // Keep the chain alive regardless of this reservation's outcome.
  startChain = turn.then(
    () => undefined,
    () => undefined,
  )
  await turn
}

/**
 * Test-only helper. Resets the gate so a fresh test starts from a clean
 * state (no pending pacing from a previous test).
 */
export function __resetNominatimRateGateForTests(): void {
  lastRequestStartedAt = 0
  startChain = Promise.resolve()
}
