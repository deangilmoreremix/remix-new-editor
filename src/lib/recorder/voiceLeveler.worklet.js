// The AudioWorklet processor for the voice leveler (src/lib/recorder/voiceLeveler.js). Loaded through Vite (?worker&url, see
// levelStream.js) so it is bundled with the leveler code and served from this site. Plain JavaScript on purpose.
import { VoiceLeveler } from './voiceLeveler.js';

export const LEVELER_PROCESSOR = 'voice-leveler';

// AudioWorkletGlobalScope globals (absent when this file is imported by a test)
const Base = globalThis.AudioWorkletProcessor;
const register = globalThis.registerProcessor;

if (Base && register) {
  class VoiceLevelerProcessor extends Base {
    constructor() { super(); this.lv = new VoiceLeveler(globalThis.sampleRate || 48000); }
    process(inputs, outputs) {
      const i = inputs[0]; const o = outputs[0];
      if (!i || !i.length || !o || !o.length) return true;
      return this.lv.processBlock(i, o);
    }
  }
  register(LEVELER_PROCESSOR, VoiceLevelerProcessor);
}
