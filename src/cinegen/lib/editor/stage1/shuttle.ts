// [remix] Stage 1: J / K / L shuttle (pure). Rate is signed: negative = reverse, 0 = stopped.
export const SHUTTLE_STEPS = [1, 2, 4, 8] as const;
export const MAX_SHUTTLE = 8;
/** The PlaybackEngine plays forward up to 4x (setSpeed clamps there); faster / reverse is driven by seeking. */
export const ENGINE_MAX_RATE = 4;

export type ShuttleKey = 'J' | 'K' | 'L';

export function nextShuttleRate(rate: number, key: ShuttleKey): number {
  if (key === 'K') return 0;
  const dir = key === 'L' ? 1 : -1;
  if (rate === 0) return dir;
  if (Math.sign(rate) === dir) return dir * Math.min(MAX_SHUTTLE, Math.abs(rate) * 2);
  // pressing the opposite key brakes first: halve the speed, stop below 1x
  const slowed = Math.abs(rate) / 2;
  return slowed < 1 ? 0 : Math.sign(rate) * slowed;
}

/** Next playhead time of a seek-driven shuttle (reverse, or forward above the engine's range). Clamped to [0, max]. */
export function shuttleTick(time: number, rate: number, dtSeconds: number, max: number): number {
  return Math.max(0, Math.min(max, time + rate * dtSeconds));
}

export const needsSeekDriver = (rate: number) => rate < 0 || rate > ENGINE_MAX_RATE;
