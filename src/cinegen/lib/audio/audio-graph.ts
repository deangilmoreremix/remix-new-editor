// [remix] Stage 4: the preview's Web Audio effects graph, owned by the PlaybackEngine.
//   media element source -> [EQ biquad chain, only when the clip has an active EQ] -> clip gain -> master gain -> destination
//                                                                                              \-> splitter -> L / R AnalyserNode (meters)
// The engine keeps creating one source + gain per media element exactly as before; this class only takes over the wiring after the gain.
import { type ClipEq, eqKey, isEqActive, webAudioQ } from './eq';
import { channelLevel, type ChannelLevel } from './meter';

interface ElementNodes { source: AudioNode; gain: GainNode; eq: BiquadFilterNode[]; key: string }
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
    this.nodes.set(key, { source, gain, eq: [], key: '' });
    source.connect(gain);
    gain.connect(this.master);
  }

  /** Release the element (the engine disconnects source and gain itself). */
  release(key: unknown): void {
    const n = this.nodes.get(key);
    if (!n) return;
    for (const f of n.eq) { try { f.disconnect(); } catch { /* already gone */ } }
    this.nodes.delete(key);
  }

  /** Insert, change or remove the EQ chain of one element. Cheap when nothing changed. */
  setEq(key: unknown, eq: ClipEq | null | undefined): void {
    const n = this.nodes.get(key);
    if (!n) return;
    const next = eqKey(eq);
    if (next === n.key) return;
    n.key = next;
    try { n.source.disconnect(); } catch { /* not connected */ }
    for (const f of n.eq) { try { f.disconnect(); } catch { /* not connected */ } }
    n.eq = [];
    let tail: AudioNode = n.source;
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
