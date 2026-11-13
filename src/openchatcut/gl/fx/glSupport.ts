// [remix] WebGL2 availability for per-clip GL effects. When WebGL2 is missing every GL effect is skipped (the clip shows
// its unprocessed picture) and ONE warning is logged, instead of throwing in the render loop.
let cached: boolean | null = null;
let warned = false;

export function glFxSupported(create: () => { getContext: (...args: string[]) => unknown } | null = () => (typeof document === 'undefined' ? null : document.createElement('canvas'))): boolean {
  if (cached !== null) return cached;
  try { cached = !!create()?.getContext('webgl2'); } catch { cached = false; }
  return cached;
}

/** Log (once) that effects are being skipped because WebGL2 is unavailable. */
export function warnGlFxSkipped(reason = 'WebGL2 is not available'): boolean {
  if (warned) return false;
  warned = true;
  console.warn(`[clip-fx] ${reason}: GL effects are skipped and clips render without them (preview and export).`);
  return true;
}

export function resetGlSupportForTests(): void { cached = null; warned = false; }
