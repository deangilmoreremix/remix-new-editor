/**
 * Template Generator — what plays under the video: the voiceover and the music, with the volumes from the mix panel.
 * One plan feeds the live preview, the composition handed to the editor, and the saved template, so what you hear in the preview is what lands.
 *
 * Volumes are 0..1. Music is shown with a fade in/out and (optionally) ducked under the voice; the keyframes already include the music
 * volume (the editor's export uses keyframe values as the final level), times are seconds from the music clip start.
 */
import { duckingKeyframes } from '../../../lib/editor/agent/audioGen.js';
import { musicTrack } from './music.js';

const clamp01 = (v, d = 1) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : d);

/** @returns {{ cut: number, voice: null|object, music: null|object, footageVolume: number }} */
export function audioPlan(s, cutSeconds) {
  const cut = Math.max(0, Number(cutSeconds) || 0);
  const mix = { footage: 1, voice: 1, music: 0.3, ...(s.mix || {}) };
  const asset = s.voice?.enabled && s.voice.generatedAsset?.url ? s.voice.generatedAsset : null;
  const voice = asset
    ? { id: 'voice', name: 'Voice Narration', url: asset.url, start: 0, duration: Number(asset.duration) || cut || 3, volume: clamp01(mix.voice) }
    : null;
  const track = musicTrack(s.music?.id);
  let music = null;
  if (track && cut > 0) {
    const base = clamp01(mix.music, 0.3);
    const ducked = s.music?.duck !== false && voice;
    const raw = duckingKeyframes(0, cut, ducked ? [[voice.start, voice.start + voice.duration]] : []);
    music = {
      id: 'music', name: track.name, url: track.url, start: 0, duration: cut, volume: base, trackId: track.id, sourceDuration: track.duration,
      keyframes: raw.map((k) => ({ ...k, v: Math.round(k.v * base * 1000) / 1000 })),
    };
  }
  return { cut, voice, music, footageVolume: clamp01(mix.footage) };
}
