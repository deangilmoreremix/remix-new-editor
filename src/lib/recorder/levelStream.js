// src/lib/recorder/levelStream.js
//
// Run a recording's microphone sound through the voice leveler (an AudioWorklet), with a safe way out: when the browser has no
// AudioWorklet, the module will not load, or anything goes wrong, the original stream is returned untouched and the take is
// recorded exactly as it would have been. The sound is processed on this device and nothing is uploaded.
import workletUrl from './voiceLeveler.worklet.js?worker&url';

const NAME = 'voice-leveler';

/**
 * @param {MediaStream} stream
 * @returns {Promise<{ stream: MediaStream, leveled: boolean, stop: () => void }>}
 */
export async function levelStream(stream, {
  AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext,
  NodeCtor = globalThis.AudioWorkletNode,
  Stream = globalThis.MediaStream,
  moduleUrl = workletUrl,
} = {}) {
  const passthrough = { stream, leveled: false, stop() {} };
  const track = stream?.getAudioTracks?.()[0];
  if (!track || !AudioCtx || !NodeCtor || !Stream) return passthrough;
  let ctx;
  try {
    ctx = new AudioCtx();
    if (!ctx.audioWorklet?.addModule) throw new Error('no AudioWorklet');
    await ctx.audioWorklet.addModule(moduleUrl);
    const source = ctx.createMediaStreamSource(new Stream([track]));
    const node = new NodeCtor(ctx, NAME, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
    const dest = ctx.createMediaStreamDestination();
    source.connect(node); node.connect(dest);
    await ctx.resume?.();
    const processed = dest.stream.getAudioTracks()[0];
    if (!processed) throw new Error('no processed track');
    const out = new Stream([...(stream.getVideoTracks?.() || []), processed]);
    // Stopping the take stops the original microphone too (the recorder stops every sourceTrack).
    out.sourceTracks = [...(stream.sourceTracks || []), track];
    out.stopMix = stream.stopMix; // a mixer behind this stream (computer sound + microphone) is still closed with the take
    return { stream: out, leveled: true, stop() { try { source.disconnect(); node.disconnect(); } catch { /* gone */ } ctx.close?.().catch?.(() => {}); } };
  } catch {
    try { ctx?.close?.(); } catch { /* gone */ }
    return passthrough;
  }
}

/**
 * Level every source that has sound.
 * @param {{ prefix?:string, stream:MediaStream }[]} sources
 * @returns {Promise<{ sources: object[], stops: (() => void)[], leveled: number, failed: boolean }>}
 *   failed = true when some source had sound but could not be leveled (it is recorded as it was)
 */
export async function levelSources(sources, deps) {
  const stops = []; let leveled = 0; let failed = false;
  const out = [];
  for (const s of sources) {
    if (!s.stream?.getAudioTracks?.().length) { out.push(s); continue; }
    const r = await levelStream(s.stream, deps);
    if (r.leveled) { leveled += 1; stops.push(r.stop); out.push({ ...s, stream: r.stream }); } else { failed = true; out.push(s); }
  }
  return { sources: out, stops, leveled, failed };
}
