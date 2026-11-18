// [remix] Stage 11 (port H): offline pitch shift / time stretch with SoundTouch JS (LGPL-2.1+, ../../vendor-soundtouch/time-stretch.ts, unmodified
// copy of FreeCut's file; replace that one file to change the engine). Pure JS: runs in vitest (node), a worker or the main thread.
// The driver below is new code (FreeCut only drives SoundTouch through a pull-based worklet filter).
import { TimeStretchProcessor } from '../../vendor-soundtouch/time-stretch';
import { pitchRatio, type PitchPlan } from './pitch';

export interface StretchOptions { signal?: AbortSignal; /** input frames per step (default 16384) */ chunkFrames?: number; yieldEvery?: number }

/** Output length in frames for `inFrames` input frames. Pitch never changes the length; tempo and rate do. */
export const stretchedFrames = (inFrames: number, plan: Pick<PitchPlan, 'tempo' | 'rate'>): number => Math.round(inFrames / (plan.tempo * plan.rate));

const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));
const abortError = () => new DOMException('Pitch render cancelled', 'AbortError');

/**
 * Pitch-shift and / or time-stretch PCM. `channels` are 1 or 2 Float32Arrays (mono is processed as dual mono and returned as mono).
 * Returns channels of exactly `stretchedFrames(length, plan)` frames (the SoundTouch tail is flushed with silence).
 */
export async function renderPitchStretch(channels: Float32Array[], plan: PitchPlan, opts: StretchOptions = {}): Promise<Float32Array[]> {
  const n = channels[0]?.length ?? 0;
  const mono = channels.length < 2;
  const outFrames = stretchedFrames(n, plan);
  const outCh = mono ? [new Float32Array(outFrames)] : [new Float32Array(outFrames), new Float32Array(outFrames)];
  if (n === 0 || outFrames === 0) return outCh;
  const L = channels[0]; const R = mono ? channels[0] : channels[1];
  const st = new TimeStretchProcessor();
  st.rate = plan.rate; st.tempo = plan.tempo; st.pitch = pitchRatio(plan.semitones);
  const chunk = Math.max(256, opts.chunkFrames ?? 16384);
  const flush = 16384; // SoundTouch holds back about one analysis window: push silence after the end to release it
  const total = n + flush;
  let produced = 0;
  let steps = 0;
  const drain = () => {
    const out = st.outputBuffer;
    const take = Math.min(out.frameCount, outFrames - produced);
    if (take > 0) {
      const tmp = new Float32Array(take * 2);
      out.receiveSamples(tmp, take);
      for (let i = 0; i < take; i++) { outCh[0][produced + i] = tmp[2 * i]; if (!mono) outCh[1][produced + i] = tmp[2 * i + 1]; }
      produced += take;
    }
    if (out.frameCount > 0 && produced >= outFrames) out.receive(out.frameCount);
  };
  for (let pos = 0; pos < total && produced < outFrames; pos += chunk) {
    if (opts.signal?.aborted) throw abortError();
    const m = Math.min(chunk, total - pos);
    const inter = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) { const k = pos + i; inter[2 * i] = k < n ? L[k] : 0; inter[2 * i + 1] = k < n ? R[k] : 0; }
    st.inputBuffer.putSamples(inter, 0, m);
    st.process();
    drain();
    if (++steps % (opts.yieldEvery ?? 8) === 0) await yieldToEventLoop();
  }
  return outCh;
}
