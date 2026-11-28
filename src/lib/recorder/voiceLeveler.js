// src/lib/recorder/voiceLeveler.js
//
// The voice leveler (requirement 2): a noise gate, a slow level normalizer and a limiter, in plain JavaScript so the same code
// runs inside an AudioWorklet while recording and in unit tests. It is gentle on purpose:
//   gate        sound far below speech is turned down (not cut to zero), so room hiss between sentences fades
//   normalizer  a slow gain that moves speech toward a comfortable level, never more than +12 dB, never turning anything down
//   limiter     a soft ceiling just under full scale, so a loud word cannot distort
// It does not remove noise that is as loud as the voice (that is what the browser's noise suppression is for).

export const LEVELER = Object.freeze({
  gateDb: -55,        // below this the gate closes
  gateFloor: 0.1,     // a closed gate leaves 10% (-20 dB) of the sound, not silence
  targetRms: 0.1,     // about -20 dBFS: a comfortable speech level
  maxGain: 4,         // +12 dB at most
  ceiling: 0.89,      // about -1 dBFS
  knee: 0.6,          // below this the limiter does nothing
});

const dbToLin = (db) => 10 ** (db / 20);
const coef = (seconds, rate) => Math.exp(-1 / Math.max(1, seconds * rate));

export class VoiceLeveler {
  constructor(sampleRate = 48000, opts = {}) {
    this.o = { ...LEVELER, ...opts };
    this.rate = sampleRate;
    this.gate = dbToLin(this.o.gateDb);
    this.cEnvAtk = coef(0.005, sampleRate); this.cEnvRel = coef(0.2, sampleRate);
    this.cGateAtk = coef(0.01, sampleRate); this.cGateRel = coef(0.15, sampleRate);
    this.cRms = coef(1.5, sampleRate); this.cNorm = coef(2, sampleRate);
    this.env = 0; this.gateGain = this.o.gateFloor; this.rms2 = 0; this.norm = 1;
  }

  /** Limit one sample: untouched up to the knee, then a smooth curve that never passes the ceiling. */
  limit(x) {
    const { knee, ceiling } = this.o;
    const a = Math.abs(x);
    if (a <= knee) return x;
    const y = knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee));
    return x < 0 ? -y : y;
  }

  /** Process one render block. ins/outs are arrays of channels (Float32Array). Silent or missing input gives silent output. */
  processBlock(ins, outs) {
    const n = outs[0]?.length || 0;
    const chans = Math.min(ins.length, outs.length);
    for (let i = 0; i < n; i += 1) {
      let peak = 0;
      for (let c = 0; c < chans; c += 1) { const v = Math.abs(ins[c][i]) || 0; if (v > peak) peak = v; }
      this.env = peak > this.env ? peak + (this.env - peak) * this.cEnvAtk : peak + (this.env - peak) * this.cEnvRel;
      const open = this.env > this.gate;
      const gTarget = open ? 1 : this.o.gateFloor;
      const gc = gTarget > this.gateGain ? this.cGateAtk : this.cGateRel;
      this.gateGain = gTarget + (this.gateGain - gTarget) * gc;
      // Level estimate from the speech only (while the gate is open), and a slow gain toward the target.
      if (open) {
        this.rms2 = peak * peak + (this.rms2 - peak * peak) * this.cRms;
        const rms = Math.sqrt(this.rms2);
        const want = rms > 1e-4 ? Math.min(this.o.maxGain, Math.max(1, this.o.targetRms / rms)) : 1;
        this.norm = want + (this.norm - want) * this.cNorm;
      }
      const g = this.gateGain * this.norm;
      for (let c = 0; c < chans; c += 1) outs[c][i] = this.limit((ins[c][i] || 0) * g);
    }
    for (let c = chans; c < outs.length; c += 1) outs[c].fill(0);
    return true;
  }
}
