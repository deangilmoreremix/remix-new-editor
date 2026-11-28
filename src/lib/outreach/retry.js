// src/lib/outreach/retry.js
//
// Retry a flaky network step a few times with a growing pause (upload recovery, requirement 43).
// It never retries what cannot get better (a 4xx other than 429, sign-in problems, a cancel), and a cancel
// stops the wait at once.

/** Whether trying again could help. */
export function isRetryable(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  const status = Number(err.status ?? err.statusCode);
  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  if (/sign in|not allowed|too large|unsupported|invalid/i.test(String(err.message || ''))) return false;
  return true; // a dropped connection, a timeout, a 5xx
}

const defaultSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })); return; }
  const t = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })); }, { once: true });
});

/**
 * @param {() => Promise<T>} fn
 * @param {{ tries?:number, baseMs?:number, signal?:AbortSignal, onRetry?:(info:{attempt:number, of:number, waitMs:number, error:Error})=>void,
 *   shouldRetry?:(e:Error)=>boolean, sleep?:(ms:number, signal?:AbortSignal)=>Promise<void> }} [o]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { tries = 3, baseMs = 800, signal, onRetry, shouldRetry = isRetryable, sleep = defaultSleep } = {}) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    try { return await fn(attempt); } catch (err) {
      last = err;
      if (attempt >= tries || !shouldRetry(err)) throw err;
      const waitMs = baseMs * 2 ** (attempt - 1);
      onRetry?.({ attempt: attempt + 1, of: tries, waitMs, error: err });
      await sleep(waitMs, signal);
    }
  }
  throw last;
}
