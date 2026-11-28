import { describe, it, expect, vi } from 'vitest';
import { levelStream, levelSources } from '../levelStream.js';

class Track { constructor(kind) { this.kind = kind; this.stopped = false; } stop() { this.stopped = true; } }
class Stream { constructor(tracks = []) { this.tracks = tracks; } getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); } getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); } getTracks() { return this.tracks; } }

function fakeContext({ failLoad = false, noWorklet = false } = {}) {
  const made = { nodes: [], closed: 0, resumed: 0 };
  const processed = new Track('audio');
  class Ctx {
    constructor() { this.audioWorklet = noWorklet ? undefined : { addModule: vi.fn(async () => { if (failLoad) throw new Error('module blocked'); }) }; made.ctx = this; }
    createMediaStreamSource(s) { const n = { s, connect: vi.fn(), disconnect: vi.fn() }; made.source = n; return n; }
    createMediaStreamDestination() { return { stream: new Stream([processed]) }; }
    async resume() { made.resumed += 1; }
    async close() { made.closed += 1; }
  }
  class Node { constructor(ctx, name, opts) { this.ctx = ctx; this.name = name; this.opts = opts; this.connect = vi.fn(); this.disconnect = vi.fn(); made.nodes.push(this); } }
  return { made, processed, deps: { AudioCtx: Ctx, NodeCtor: Node, Stream, moduleUrl: '/leveler.js' } };
}

describe('levelStream', () => {
  it('routes the microphone through the leveler and keeps the video', async () => {
    const mic = new Track('audio'); const cam = new Track('video');
    const input = new Stream([cam, mic]);
    const { made, processed, deps } = fakeContext();
    const r = await levelStream(input, deps);
    expect(r.leveled).toBe(true);
    expect(made.ctx.audioWorklet.addModule).toHaveBeenCalledWith('/leveler.js');
    expect(made.nodes[0].name).toBe('voice-leveler');
    expect(r.stream.getVideoTracks()).toEqual([cam]);
    expect(r.stream.getAudioTracks()).toEqual([processed]);
    expect(made.resumed).toBe(1);
  });
  it('stopping the take also stops the original microphone, and stop() closes the audio context', async () => {
    const mic = new Track('audio');
    const { made, deps } = fakeContext();
    const r = await levelStream(new Stream([mic]), deps);
    expect(r.stream.sourceTracks).toContain(mic);
    r.stop();
    expect(made.closed).toBe(1);
  });
  it('falls back to the untouched stream when the browser has no AudioWorklet', async () => {
    const input = new Stream([new Track('audio')]);
    for (const deps of [fakeContext({ noWorklet: true }).deps, { ...fakeContext().deps, NodeCtor: undefined }, { ...fakeContext().deps, AudioCtx: undefined }]) {
      const r = await levelStream(input, deps);
      expect(r).toMatchObject({ stream: input, leveled: false });
      expect(() => r.stop()).not.toThrow();
    }
  });
  it('falls back, and closes what it opened, when the module will not load', async () => {
    const input = new Stream([new Track('audio')]);
    const { made, deps } = fakeContext({ failLoad: true });
    const r = await levelStream(input, deps);
    expect(r).toMatchObject({ stream: input, leveled: false });
    expect(made.closed).toBe(1);
  });
  it('does nothing for a stream with no sound', async () => {
    const input = new Stream([new Track('video')]);
    expect((await levelStream(input, fakeContext().deps)).leveled).toBe(false);
    expect((await levelStream(null, fakeContext().deps)).leveled).toBe(false);
  });
});

describe('levelSources', () => {
  it('levels the sources with sound, leaves the others, and reports a source it could not level', async () => {
    const withSound = { prefix: 'webcam', stream: new Stream([new Track('video'), new Track('audio')]) };
    const silent = { prefix: 'display', stream: new Stream([new Track('video')]) };
    const ok = await levelSources([withSound, silent], fakeContext().deps);
    expect(ok.leveled).toBe(1); expect(ok.failed).toBe(false); expect(ok.stops).toHaveLength(1);
    expect(ok.sources[0].prefix).toBe('webcam');
    expect(ok.sources[0].stream).not.toBe(withSound.stream);
    expect(ok.sources[1]).toBe(silent);
    const bad = await levelSources([withSound], fakeContext({ failLoad: true }).deps);
    expect(bad).toMatchObject({ leveled: 0, failed: true });
    expect(bad.sources[0]).toBe(withSound); // recorded as it was
  });
});
