/** Thrown by `withDbTimeout` when the database does not answer in time. */
export class DiscoveryDbTimeoutError extends Error {
  constructor() {
    super('Discovery database did not respond in time')
    this.name = 'DiscoveryDbTimeoutError'
  }
}

/** Shown to callers when the database is too slow to take a discovery job. */
export const DISCOVERY_BUSY_MESSAGE = 'Asset discovery is busy right now. Please try again in a minute.'

/**
 * Bounds a job-table call so a slow or unavailable database fails fast with a
 * clear message instead of holding the request open until Netlify's 30s 504.
 */
export function withDbTimeout<T>(promise: Promise<T>, ms = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DiscoveryDbTimeoutError()), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
