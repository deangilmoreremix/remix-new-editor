// [remix] Stage 4: level maths for the stereo meters. Pure.
export interface ChannelLevel { peak: number; rms: number; peakDb: number; rmsDb: number }
export const METER_FLOOR_DB = -60;

export const toDb = (linear: number): number => (linear > 1e-6 ? 20 * Math.log10(linear) : -120);

/** Peak and RMS of a block of time-domain samples (Web Audio AnalyserNode.getFloatTimeDomainData output). */
export function channelLevel(samples: ArrayLike<number>): ChannelLevel {
  let peak = 0; let sum = 0;
  const n = samples.length;
  for (let i = 0; i < n; i++) { const v = Math.abs(samples[i]); if (v > peak) peak = v; sum += samples[i] * samples[i]; }
  const rms = n ? Math.sqrt(sum / n) : 0;
  return { peak, rms, peakDb: toDb(peak), rmsDb: toDb(rms) };
}

/** 0..1 bar fraction for a dB value on a -60..0 dBFS scale. */
export const dbToFraction = (db: number, floorDb = METER_FLOOR_DB): number => Math.min(1, Math.max(0, (db - floorDb) / -floorDb));

/** Peak-hold with linear fall-off (dB per second). */
export function holdPeak(prevHoldDb: number, peakDb: number, dtSec: number, fallDbPerSec = 20): number {
  return Math.max(peakDb, prevHoldDb - fallDbPerSec * Math.max(0, dtSec));
}
