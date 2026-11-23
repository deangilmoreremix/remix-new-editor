/**
 * Allow one task at a time. The lock is taken synchronously, before the task's first `await`, and released in a `finally`,
 * so two requests that arrive together cannot both get past the check, and one finishing never frees the lock for another
 * that is still running.
 */
export const createExclusive = () => {
  let busy = false
  return {
    isBusy: (): boolean => busy,
    /** Run `task`, or call `onBusy` (which should throw) when another task holds the lock. */
    run: async <T>(task: () => Promise<T>, onBusy: () => never): Promise<T> => {
      if (busy) {
        return onBusy()
      }
      busy = true
      try {
        return await task()
      } finally {
        busy = false
      }
    }
  }
}
