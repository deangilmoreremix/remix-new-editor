// The 3-2-1 before a take. onTick(n) for each number; the promise resolves true when it reaches zero
// (or is skipped), false when cancelled.
export function createCountdown(seconds, { onTick = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;
  let done;
  const promise = new Promise((resolve) => { done = resolve; });
  const finish = (ok) => { if (timer != null) clearTimer(timer); timer = null; const d = done; done = null; d?.(ok); };
  const tick = (n) => {
    if (!done) return;
    if (n <= 0) { finish(true); return; }
    onTick(n);
    timer = setTimer(() => tick(n - 1), 1000);
  };
  tick(Math.max(0, Math.floor(seconds)));
  return { promise, skip: () => finish(true), cancel: () => finish(false) };
}
