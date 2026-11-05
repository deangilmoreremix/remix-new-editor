/**
 * Deadline primitives for the business-discovery chain.
 *
 * The Lead Finder free path runs on a serverless function behind a proxy that
 * gives up on a request that has not produced a byte for ~30s and answers
 * with an HTML "Inactivity Timeout" page. The only way to avoid that page is
 * to answer with JSON BEFORE the proxy gives up.
 *
 * Every provider stage therefore gets an explicit budget:
 *  - `createStageDeadline` opens a budget and exposes an AbortSignal that
 *    fires when the budget is spent, so in-flight upstream requests are
 *    cancelled instead of lingering.
 *  - `withDeadline` races the work against the budget, so a stage can never
 *    outrun it no matter how badly the upstream behaves.
 *
 * The budgets are deliberately far below the platform ceiling; the worst-case
 * arithmetic is pinned by
 * `src/server/businessDiscovery/__tests__/zz-lead-finder-request-budget.test.ts`.
 */

export class DeadlineExceededError extends Error {
  /** Stable, machine-readable code surfaced to the caller. */
  readonly code = 'DEADLINE_EXCEEDED'
  /** Public-safe copy: no provider internals, actionable for the user. */
  readonly userMessage =
    'Business search timed out. Please try a smaller radius or a different location.'

  constructor(stage: string) {
    super(`Deadline exceeded during ${stage}`)
    this.name = 'DeadlineExceededError'
  }
}

/**
 * Hard budget for the whole `find-businesses` request.
 *
 * Worst-case arithmetic (all provider stages are bounded by their own
 * deadlines, see the provider budgets):
 *
 *   geocode      ≤ 12s  (nominatimProvider REQUEST_TIMEOUT)
 *   discovery    ≤ 9s   (overpassProvider stage deadline; the Nominatim
 *                        search runs concurrently and is bounded by 7s)
 *   serialize    ~0.1s
 *   -------------------------------
 *   worst case  ≈ 21.1s
 *
 * The budget is deliberately well under the platform ceiling so a degraded
 * upstream can never turn into the platform's HTML "Inactivity Timeout" page.
 */
export const ROUTE_DEADLINE_MS = 24_000

/**
 * The platform's inactivity ceiling for a synchronous request.
 *
 * A request that has not produced a single byte for this long is aborted by
 * the proxy in front of the function and answered with an HTML page that no
 * client can use. Every budget in the discovery chain must fit under it.
 */
export const PLATFORM_REQUEST_CEILING_MS = 30_000

export interface StageDeadline {
  /** Human-readable stage name (used in logs and error messages). */
  readonly stage: string
  /** Absolute epoch ms at which the budget expires. */
  readonly at: number
  /** Fires when the budget expires; pass it to `fetch` to cancel the work. */
  readonly signal: AbortSignal
  /** Milliseconds left in the budget (never negative). */
  remaining(): number
  /** True once the budget is spent. */
  expired(): boolean
  /** Rejects with `DeadlineExceededError` when the budget expires. */
  readonly expired$: Promise<never>
}

/**
 * Opens a budget of `budgetMs` milliseconds.
 *
 * The returned `expired$` promise is pre-handled so it never surfaces as an
 * unhandled rejection when the work finishes before the budget does.
 */
export function createStageDeadline(stage: string, budgetMs: number): StageDeadline {
  const controller = new AbortController()
  const at = Date.now() + budgetMs

  const expired$ = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort()
      reject(new DeadlineExceededError(stage))
    }, budgetMs)
    // Do not hold the event loop open for a budget nobody is waiting on.
    const unrefable = timer as unknown as { unref?: () => void }
    if (typeof unrefable.unref === 'function') unrefable.unref()
  })
  expired$.catch(() => undefined)

  return {
    stage,
    at,
    signal: controller.signal,
    remaining: () => Math.max(0, at - Date.now()),
    expired: () => Date.now() >= at,
    expired$,
  }
}

/**
 * Races `work` against `deadline`. The returned promise rejects with
 * `DeadlineExceededError` as soon as the budget is spent, even if the
 * underlying work is still running.
 */
export function withDeadline<T>(work: Promise<T>, deadline: StageDeadline): Promise<T> {
  return Promise.race([work, deadline.expired$])
}
