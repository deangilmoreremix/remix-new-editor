// Stage 11 (port H): the preview graph's pitch wiring with a minimal fake AudioContext (the real AudioWorklet is exercised in the browser smoke).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AudioFxGraph } from '@cinegen/lib/audio/audio-graph';

class FakeNode { connections: FakeNode[] = []; connect(n: FakeNode) { this.connections.push(n); return n; } disconnect() { this.connections = []; } channelCount = 2; channelCountMode = ''; channelInterpretation = ''; gain = { value: 1 }; fftSize = 0; }
const fakeCtx = () => ({ destination: new FakeNode(), createGain: () => new FakeNode(), createChannelSplitter: () => new FakeNode(), createAnalyser: () => Object.assign(new FakeNode(), { fftSize: 1024 }), createBiquadFilter: () => new FakeNode() }) as unknown as AudioContext;
const PITCH = { semitones: 12, cents: 0, preservePitch: true };

afterEach(() => { vi.unstubAllGlobals(); });

describe('pitch in the preview graph', () => {
  it('without AudioWorklet: the clip still plays (source -> gain), a warning is raised once per change, pitchAvailable() is false', () => {
    vi.stubGlobal('AudioWorkletNode', undefined);
    const g = new AudioFxGraph(fakeCtx());
    const warn = vi.fn(); g.onPitchWarning = warn;
    const source = new FakeNode(); const gain = new FakeNode();
    g.wire('el', source as unknown as AudioNode, gain as unknown as GainNode);
    g.setPitch('el', PITCH);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/AudioWorklet/);
    expect(g.pitchAvailable()).toBe(false);
    expect(source.connections).toContain(gain); // unshifted path intact
    g.setPitch('el', PITCH); expect(warn).toHaveBeenCalledTimes(1); // same setting: no repeat
    g.setPitch('el', undefined); // reset: no warning
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('sets the element preservesPitch from the clip (false = tape mode), default true', () => {
    vi.stubGlobal('AudioWorkletNode', undefined);
    const g = new AudioFxGraph(fakeCtx());
    const el = { preservesPitch: true } as unknown as HTMLMediaElement;
    g.setPitch('x', { semitones: 0, cents: 0, preservePitch: false }, el);
    expect(el.preservesPitch).toBe(false);
    g.setPitch('x', undefined, el);
    expect(el.preservesPitch).toBe(true);
  });
  it('with a (fake) worklet: the node is inserted between source and gain, updated on change and removed on reset', async () => {
    const created: Array<{ posted: unknown[]; connections: unknown[] }> = [];
    class FakeWorkletNode extends FakeNode { posted: unknown[] = []; port = { postMessage: (m: unknown) => this.posted.push(m) }; constructor() { super(); created.push(this); } }
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
    const ctx = Object.assign(fakeCtx(), { audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) } });
    const g = new AudioFxGraph(ctx);
    const source = new FakeNode(); const gain = new FakeNode();
    g.wire('el', source as unknown as AudioNode, gain as unknown as GainNode);
    g.setPitch('el', PITCH);
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0].posted).toEqual([{ type: 'pitch', semitones: 12 }]);
    expect(source.connections).toContain(created[0]); expect(source.connections).not.toContain(gain);
    expect((created[0] as unknown as FakeNode).connections).toContain(gain);
    g.setPitch('el', { ...PITCH, semitones: -5 }); await new Promise((r) => setTimeout(r, 0));
    expect(created).toHaveLength(1); expect(created[0].posted.at(-1)).toEqual({ type: 'pitch', semitones: -5 });
    g.setPitch('el', undefined);
    expect(source.connections).toContain(gain); expect(source.connections).not.toContain(created[0]);
  });
});
