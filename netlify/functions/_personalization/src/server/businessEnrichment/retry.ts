/** Retry with exponential backoff + jitter, and a small per-host circuit breaker. */
export interface RetryOptions {
  attempts?: number
  baseMs?: number
  maxMs?: number
  jitter?: () => number // 0..1
  sleep?: (ms: number) => Promise<void>
  shouldRetry?: (err: unknown, attempt: number) => boolean
  signal?: AbortSignal
}

export function isTransientError(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string; name?: string }
  const status = e?.response?.status
  if (status) return status === 408 || status === 429 || status >= 500
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN'].includes(e?.code ?? '')
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const attempts = o.attempts ?? 3
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const jitter = o.jitter ?? Math.random
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(i) } catch (err) {
      lastErr = err
      if (o.signal?.aborted || i === attempts || !(o.shouldRetry ?? isTransientError)(err, i)) throw err
      const backoff = Math.min((o.baseMs ?? 400) * 2 ** (i - 1), o.maxMs ?? 5000)
      await sleep(backoff / 2 + (backoff / 2) * jitter())
    }
  }
  throw lastErr
}

export class CircuitBreaker {
  private fails = new Map<string, { n: number; openUntil: number }>()
  constructor(private threshold = 3, private coolMs = 30_000, private now: () => number = Date.now) {}
  isOpen(key: string): boolean { return (this.fails.get(key)?.openUntil ?? 0) > this.now() }
  success(key: string) { this.fails.delete(key) }
  failure(key: string) {
    const cur = this.fails.get(key) ?? { n: 0, openUntil: 0 }
    cur.n++
    if (cur.n >= this.threshold) cur.openUntil = this.now() + this.coolMs
    this.fails.set(key, cur)
  }
}
