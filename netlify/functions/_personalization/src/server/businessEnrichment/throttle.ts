/**
 * Polite request pacing. Technique reimplemented from Scrapling's AutoThrottle + per-domain
 * CapacityLimiter: per-domain adaptive delay driven by observed latency, honouring robots
 * Crawl-delay and Retry-After, doubling the delay after block-like responses, with a per-domain
 * and a global concurrency cap. Time and sleep are injectable so it is deterministic in tests.
 */
export interface ThrottleOptions {
  minDelayMs?: number
  maxDelayMs?: number
  /** Target concurrency per domain used by the latency-driven delay (latency / target). */
  targetConcurrency?: number
  perDomainConcurrency?: number
  globalConcurrency?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const BLOCK_STATUSES = new Set([403, 429, 503])

export class DomainThrottle {
  private delays = new Map<string, number>()
  private nextAt = new Map<string, number>()
  private inflight = new Map<string, number>()
  private globalInflight = 0
  private waiters: Array<() => void> = []
  private readonly o: Required<ThrottleOptions>

  constructor(opts: ThrottleOptions = {}) {
    this.o = {
      minDelayMs: opts.minDelayMs ?? 500,
      maxDelayMs: opts.maxDelayMs ?? 15_000,
      targetConcurrency: opts.targetConcurrency ?? 1,
      perDomainConcurrency: opts.perDomainConcurrency ?? 2,
      globalConcurrency: opts.globalConcurrency ?? 6,
      now: opts.now ?? Date.now,
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    }
  }

  private floors = new Map<string, number>()

  /** Current pacing for a domain; never below the global minimum or the site's robots Crawl-delay. */
  delayFor(domain: string): number { return Math.max(this.delays.get(domain) ?? this.o.minDelayMs, this.floors.get(domain) ?? 0) }

  /** Robots Crawl-delay is a floor the adaptive delay may never go under. */
  setFloor(domain: string, delaySec: number | null) {
    if (!delaySec || delaySec <= 0) return
    const floor = Math.min(delaySec * 1000, this.o.maxDelayMs)
    this.floors.set(domain, floor) // persistent minimum: adaptive speed-ups can never go under it
    this.nextAt.set(domain, Math.max(this.nextAt.get(domain) ?? 0, this.o.now() + floor)) // applies to the very next request too
  }

  /** Sleeps for `ms`, rejecting as soon as `signal` aborts so a deadline can cancel a throttle/Retry-After wait. */
  private async wait(ms: number, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('aborted')
    if (!signal) return this.o.sleep(ms)
    let onAbort!: () => void
    const aborted = new Promise<never>((_, rej) => { onAbort = () => rej(new Error('aborted')); signal.addEventListener('abort', onAbort, { once: true }) })
    try { await Promise.race([this.o.sleep(ms), aborted]) } finally { signal.removeEventListener('abort', onAbort) }
  }

  /** Runs `task` under the per-domain/global caps and the domain's pacing; records latency. */
  async run<T extends { status?: number; retryAfterMs?: number }>(domain: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(domain)
    try {
      const wait = Math.max(0, (this.nextAt.get(domain) ?? 0) - this.o.now())
      if (wait > 0) await this.wait(wait, signal)
      const started = this.o.now()
      let result: T
      try {
        result = await task()
      } catch (e) {
        this.observe(domain, this.o.now() - started, 0)
        throw e
      }
      this.observe(domain, this.o.now() - started, result.status ?? 200, result.retryAfterMs)
      return result
    } finally {
      this.release(domain)
    }
  }

  private observe(domain: string, latencyMs: number, status: number, retryAfterMs?: number) {
    let delay = this.delayFor(domain)
    const floor = Math.max(this.o.minDelayMs, this.floors.get(domain) ?? 0)
    if (BLOCK_STATUSES.has(status)) {
      delay = Math.max(delay * 2, retryAfterMs ?? 0) // block backoff ×2 (or the server's own ask)
    } else {
      // latency-driven target, smoothed; never below the (robots-adjusted) current floor
      const target = latencyMs / this.o.targetConcurrency
      delay = Math.max(floor, (delay + target) / 2)
    }
    delay = Math.min(delay, this.o.maxDelayMs)
    this.delays.set(domain, delay)
    this.nextAt.set(domain, this.o.now() + Math.max(delay, retryAfterMs ?? 0))
  }

  private async acquire(domain: string) {
    while (this.globalInflight >= this.o.globalConcurrency || (this.inflight.get(domain) ?? 0) >= this.o.perDomainConcurrency) {
      await new Promise<void>((r) => this.waiters.push(r))
    }
    this.globalInflight++
    this.inflight.set(domain, (this.inflight.get(domain) ?? 0) + 1)
  }

  private release(domain: string) {
    this.globalInflight--
    this.inflight.set(domain, (this.inflight.get(domain) ?? 1) - 1)
    const w = this.waiters.splice(0)
    w.forEach((r) => r())
  }
}

/** Parses a Retry-After header (seconds or HTTP date) into ms; null when absent/invalid. */
export function parseRetryAfter(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : Math.max(0, at - now)
}
