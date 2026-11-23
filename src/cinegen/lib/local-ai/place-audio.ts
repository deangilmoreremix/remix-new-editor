// [remix] Port I2: a generated audio buffer becomes a normal audio asset (media pool + IndexedDB blob store through the adapter's
// importBlob) and a clip on the first unlocked audio track at `at`. Same path as the voice-over recorder, so preview, waveform jobs,
// persistence across reloads and the Remotion export treat it like any imported audio file.
import type { Asset } from '@cinegen/types/project';
import type { Timeline, Track } from '@cinegen/types/timeline';
import { addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { generateId } from '@cinegen/lib/utils/ids';
import { audioStats, encodeWav } from './wav';
import type { RawAudio } from './audio-manager';

export interface Provenance { model: string; modelName: string; licence: string; prompt: string; kind: 'tts' | 'music'; voice?: string }
export type ImportBlob = (a: { blob: Blob; name: string }) => Promise<{ assetId: string; filePath: string }>;

export const MIN_AUDIBLE_PEAK = 1e-3;

export async function placeGeneratedAudio(o: { timeline: Timeline; audio: RawAudio; name: string; at: number; provenance: Provenance; importBlob: ImportBlob; now?: () => string }): Promise<{ asset: Asset; timeline: Timeline; seconds: number }> {
  const { peak } = audioStats(o.audio.samples);
  if (peak < MIN_AUDIBLE_PEAK) throw new Error('The model produced silence; nothing was added. Try again or pick another voice.');
  const seconds = o.audio.samples.length / o.audio.sampleRate;
  const blob = encodeWav(o.audio.samples, o.audio.sampleRate);
  const fileName = `${o.name.replace(/[^\w .-]+/g, ' ').trim().slice(0, 48) || 'Generated audio'}.wav`;
  const imp = await o.importBlob({ blob, name: fileName });
  const asset: Asset = {
    id: imp.assetId, name: fileName, type: 'audio', url: imp.filePath, fileRef: imp.filePath, duration: seconds, fileSize: blob.size,
    createdAt: (o.now ?? (() => new Date().toISOString()))(), status: 'processing',
    metadata: { source: 'local-ai', processingJobs: ['extract_metadata', 'compute_waveform'], ...o.provenance },
  };
  let tl = o.timeline;
  let track = tl.tracks.find((t) => t.kind === 'audio' && !t.locked);
  if (!track) {
    track = { id: generateId(), name: `Audio ${tl.tracks.filter((t) => t.kind === 'audio').length + 1}`, kind: 'audio', color: '#34d399', muted: false, solo: false, locked: false, visible: true, volume: 1 } satisfies Track;
    tl = { ...tl, tracks: [...tl.tracks, track] };
  }
  return { asset, timeline: addClipToTrack(tl, track.id, asset, Math.max(0, o.at)), seconds };
}
