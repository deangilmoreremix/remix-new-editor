// [remix] Stage 11 (port H): loads the pitch AudioWorklet module and creates its nodes. Vite bundles pitch-worklet.processor.js (with the vendored
// SoundTouch) as a separate same-origin asset in dev and in `vite build`; `?worker&url` gives its URL. When AudioWorklet is missing or the module
// fails to load, `loadPitchWorklet` resolves false and the preview plays the clip without the shift (the Audio tab says so).
import workletModuleUrl from './pitch-worklet.processor.js?worker&url';
import { PITCH_PROCESSOR_NAME, type PitchWorkletMessage } from './pitch-worklet-shared';

const loads = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** AudioWorklet exists in this context (secure context + API). */
export function pitchWorkletSupported(ctx: BaseAudioContext): boolean {
  return typeof AudioWorkletNode !== 'undefined' && !!(ctx as AudioContext).audioWorklet;
}

export function loadPitchWorklet(ctx: BaseAudioContext): Promise<boolean> {
  if (!pitchWorkletSupported(ctx)) return Promise.resolve(false);
  const hit = loads.get(ctx);
  if (hit) return hit;
  const p = (ctx as AudioContext).audioWorklet.addModule(workletModuleUrl).then(() => true, (e) => { console.warn('[cinegen] pitch worklet failed to load', e); return false; });
  loads.set(ctx, p);
  return p;
}

/** Stereo-in / stereo-out node; call only after `loadPitchWorklet` resolved true. */
export function createPitchNode(ctx: BaseAudioContext, semitones: number): AudioWorkletNode {
  const node = new AudioWorkletNode(ctx, PITCH_PROCESSOR_NAME, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
  setPitchNode(node, semitones);
  return node;
}
export function setPitchNode(node: AudioWorkletNode, semitones: number): void {
  node.port.postMessage({ type: 'pitch', semitones } satisfies PitchWorkletMessage);
}
