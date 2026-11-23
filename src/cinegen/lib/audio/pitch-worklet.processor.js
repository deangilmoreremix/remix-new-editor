// [remix] Stage 11 (port H): AudioWorklet processor for the live pitch shift in the preview. Loaded through Vite (`?worker&url`, see
// pitch-worklet.ts) so it is bundled with the vendored SoundTouch (../../vendor-soundtouch/time-stretch.ts, LGPL-2.1+) and served same-origin.
// Adapted from FreeCut's worklets/soundtouch-preview-processor.worklet.ts (MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165). FreeCut's version
// pulls decoded buffers it is sent; CineGen plays <audio>/<video> elements, so this one is push-based: the element's audio comes in on the
// input and the pitch-shifted audio goes out (tempo 1, pitch p, so input and output run at the same average rate; latency is about 50 to 100 ms).
// Plain JavaScript on purpose: Vite's dev server does not run TypeScript syntax stripping on a `?worker_file` entry.
import { TimeStretchProcessor } from '../../vendor-soundtouch/time-stretch';
import { PITCH_PROCESSOR_NAME } from './pitch-worklet-shared';

// AudioWorkletGlobalScope globals
const Base = globalThis.AudioWorkletProcessor;
const register = globalThis.registerProcessor;

class PitchProcessor extends Base {
  constructor() {
    super();
    this.st = new TimeStretchProcessor();
    this.scratchIn = new Float32Array(256);
    this.scratchOut = new Float32Array(256);
    this.apply(1);
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'pitch') this.apply(Math.pow(2, (Number(e.data.semitones) || 0) / 12));
      else if (e.data && e.data.type === 'reset') this.st.clear();
    };
  }

  apply(ratio) {
    this.st.tempo = 1; this.st.rate = 1; this.st.pitch = Math.max(0.01, ratio);
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const frames = out[0].length;
    const inp = inputs[0];
    const l = inp && inp[0];
    const r = (inp && inp[1]) || l;
    if (this.scratchIn.length < frames * 2) { this.scratchIn = new Float32Array(frames * 2); this.scratchOut = new Float32Array(frames * 2); }
    if (l) {
      for (let i = 0; i < frames; i++) { this.scratchIn[2 * i] = l[i] || 0; this.scratchIn[2 * i + 1] = (r && r[i]) || 0; }
      this.st.inputBuffer.putSamples(this.scratchIn, 0, frames);
      this.st.process();
    }
    const buf = this.st.outputBuffer;
    const outR = out[1] || out[0];
    out[0].fill(0); if (outR !== out[0]) outR.fill(0);
    // output only whole quanta: an underrun (start-up, or a silent input that produces nothing) stays silent instead of stuttering
    if (buf.frameCount >= frames) {
      buf.receiveSamples(this.scratchOut, frames);
      for (let i = 0; i < frames; i++) { out[0][i] = this.scratchOut[2 * i]; if (outR !== out[0]) outR[i] = this.scratchOut[2 * i + 1]; }
    }
    return true;
  }
}

register(PITCH_PROCESSOR_NAME, PitchProcessor);
