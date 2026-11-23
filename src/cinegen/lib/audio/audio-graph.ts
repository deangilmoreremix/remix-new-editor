// [remix] Stage 4: the preview's Web Audio effects graph, owned by the PlaybackEngine.
//   media element source -> [pitch worklet, Stage 11, only when the clip has a pitch shift] -> [EQ biquad chain, only when the clip has an active EQ] -> clip gain -> master gain -> destination
//                                                                                              \-> splitter -> L / R AnalyserNode (meters)
// The engine keeps creating one source + gain per media element exactly as before; this class only takes over the wiring after the gain.
import { type ClipEq, eqKey, isEqActive, webAudioQ } from './eq';
import { channelLevel, type ChannelLevel } from './meter';
import { type ClipPitch, isPitchShiftActive, pitchKey, pitchShiftSemitones } from './pitch'; // [remix] Stage 11
import { createPitchNode, loadPitchWorklet, pitchWorkletSupported, setPitchNode } from './pitch-worklet';

interface ElementNodes { source: AudioNode; gain: GainNode; eq: BiquadFilterNode[]; key: string; eqCfg?: ClipEq | null; pitch: AudioWorkletNode | null; pitchKey: string }
export interface StereoLevels { left: ChannelLevel; right: ChannelLevel }

export class AudioFxGraph {
  readonly master: GainNode;
  readonly analyserL: AnalyserNode;
  readonly analyserR: AnalyserNode;
  private nodes = new Map<unknown, ElementNodes>();
  private bufL: Float32Array<ArrayBuffer>;
  private bufR: Float32Array<ArrayBuffer>;

  constructor(private ctx: BaseAudioContext) {
    this.master = ctx.createGain();
    // mono sources are up-mixed to L/R here, otherwise the (discrete) splitter would leave the right meter silent
    this.master.channelCount = 2; this.master.channelCountMode = 'explicit'; this.master.channelInterpretation = 'speakers';
    const splitter = ctx.createChannelSplitter(2);
    this.analyserL = ctx.createAnalyser();
    this.analyserR = ctx.createAnalyser();
    this.analyserL.fftSize = this.analyserR.fftSize = 1024;
    this.master.connect(ctx.destination);
    this.master.connect(splitter);
    splitter.connect(this.analyserL, 0);
    splitter.connect(this.analyserR, 1);
    this.bufL = new Float32Array(this.analyserL.fftSize);
    this.bufR = new Float32Array(this.analyserR.fftSize);
  }

  /** Called once per media element when the engine creates its source + gain. */
  wire(key: unknown, source: AudioNode, gain: GainNode): void {
    this.nodes.set(key, { source, gain, eq: [], key: '', pitch: null, pitchKey: '' });
    source.connect(gain);
    gain.connect(this.master);
  }

  /** Release the element (the engine disconnects source and gain itself). */
  release(key: unknown): void {
    const n = this.nodes.get(key);
    if (!n) return;
    for (const f of n.eq) { try { f.disconnect(); } catch { /* already gone */ } }
    try { n.pitch?.disconnect(); } catch { /* already gone */ }
    this.nodes.delete(key);
  }

  /** Insert, change or remove the EQ chain of one element. Cheap when nothing changed. */
  setEq(key: unknown, eq: ClipEq | null | undefined): void {
    const n = this.nodes.get(key);
    if (!n) return;
    const next = eqKey(eq);
    if (next === n.key) return;
    n.key = next; n.eqCfg = eq;
    this.relink(n);
  }

  /** (Re)wire source -> [pitch] -> [EQ chain] -> gain. */
  private relink(n: ElementNodes): void {
    try { n.source.disconnect(); } catch { /* not connected */ }
    try { n.pitch?.disconnect(); } catch { /* not connected */ }
    for (const f of n.eq) { try { f.disconnect(); } catch { /* not connected */ } }
    n.eq = [];
    let tail: AudioNode = n.source;
    if (n.pitch) { tail.connect(n.pitch); tail = n.pitch; }
    const eq = n.eqCfg;
    if (isEqActive(eq)) {
      for (const band of eq!.bands) {
        if (!band.enabled) continue;
        const f = this.ctx.createBiquadFilter();
        f.type = band.type;
        f.frequency.value = band.frequency;
        f.gain.value = band.gain;
        f.Q.value = webAudioQ(band);
        tail.connect(f);
        tail = f;
        n.eq.push(f);
      }
    }
    tail.connect(n.gain);
  }

  /** [remix] Stage 11: false when the browser has no AudioWorklet or the module failed to load: pitch shifts are then skipped (clips play unshifted). */
  pitchAvailable(): boolean { return this.workletOk !== false && pitchWorkletSupported(this.ctx); }
  private workletOk: boolean | null = null;
  /** Called (once per change) with a user-facing message when a pitch shift cannot be applied. */
  onPitchWarning: ((message: string) => void) | null = null;

  /** [remix] Stage 11: insert, change or remove the pitch worklet of one element (the user's shift in semitones; speed-follows-pitch is the element's own). */
  setPitch(key: unknown, pitch: ClipPitch | null | undefined, el?: HTMLMediaElement): void {
    if (el && 'preservesPitch' in el) { const keep = pitch?.preservePitch !== false; if (el.preservesPitch !== keep) el.preservesPitch = keep; } // false: the element's pitch follows its playbackRate
    const n = this.nodes.get(key);
    if (!n) return;
    const active = isPitchShiftActive(pitch);
    const next = active ? pitchKey(pitch) : '';
    if (next === n.pitchKey) return;
    n.pitchKey = next;
    if (!active) {
      if (n.pitch) { try { n.pitch.disconnect(); } catch { /* not connected */ } n.pitch = null; this.relink(n); }
      return;
    }
    if (!pitchWorkletSupported(this.ctx)) { this.workletOk = false; this.onPitchWarning?.('Pitch shift needs AudioWorklet, which this browser does not provide. The clip plays without the shift (the export still has it).'); return; }
    const apply = () => {
      if (n.pitchKey !== next || !this.nodes.has(key)) return; // changed or released while the module loaded
      const semis = pitchShiftSemitones(pitch);
      if (n.pitch) setPitchNode(n.pitch, semis);
      else { n.pitch = createPitchNode(this.ctx, semis); this.relink(n); }
    };
    void loadPitchWorklet(this.ctx).then((ok) => {
      this.workletOk = ok;
      if (!ok) { this.onPitchWarning?.('The pitch shift module could not be loaded. The clip plays without the shift (the export still has it).'); return; }
      apply();
    });
  }

  setMaster(volume: number): void {
    const v = Math.max(0, Number.isFinite(volume) ? volume : 1);
    if (Math.abs(this.master.gain.value - v) > 1e-4) this.master.gain.value = v;
  }

  /** Current peak / RMS of the left and right master output. */
  levels(): StereoLevels {
    this.analyserL.getFloatTimeDomainData(this.bufL);
    this.analyserR.getFloatTimeDomainData(this.bufR);
    return { left: channelLevel(this.bufL), right: channelLevel(this.bufR) };
  }
}
