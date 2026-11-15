/**
 * Minimal concurrency limiter (replaces the `p-limit` import, which was never declared in package.json and
 * therefore failed type-checking on Netlify's strict install).
 *
 * `limit(task)` runs at most `max` tasks at once; extra tasks wait their turn in call order.
 */
export function createLimiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  const limit = Math.max(1, Math.floor(max))
  let active = 0
  const queue: Array<() => void> = []
  const next = () => { active--; queue.shift()?.() }
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => { active++; task().then(resolve, reject).finally(next) }
      if (active < limit) run(); else queue.push(run)
    })
}
