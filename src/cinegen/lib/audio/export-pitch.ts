// [remix] Stage 11 (port H): export hand-off for pitch (pure apart from the injected bake function). Mirrors export-audio.ts (EQ).
// Order in the export: pitch bake first, then the EQ bake on the result, then buildExportState applies track / master volume as gain. That is the
// preview's order too (source -> pitch worklet -> EQ -> clip gain -> master), and nothing is processed twice: a baked clip is exported at speed 1
// from 0 on the baked file, so the composition adds no stretching of its own.
import type { ExportClipInput, ExportTrackInfo } from '../editor/export-mapping';
import { silencedTrackIds } from '../editor/export-mapping';
import { exportsAsAudio } from './export-audio';
import { defaultClipPitch, needsPitchBake, normalizeClipPitch, type ClipPitch } from './pitch';

export type PitchClip = ExportClipInput & { pitch?: ClipPitch };
export interface PitchBakeResult { clips: PitchClip[]; warnings: string[]; baked: number }
export type PitchBakeFn = (req: { url: string; trimStart: number; duration: number; speed: number; pitch: ClipPitch }, signal?: AbortSignal) => Promise<string>;

export async function bakePitchForExport(clips: PitchClip[], tracks: ExportTrackInfo[] | undefined, bake: PitchBakeFn, signal?: AbortSignal): Promise<PitchBakeResult> {
  const trackById = new Map((tracks ?? []).map((t) => [t.id, t]));
  const silenced = silencedTrackIds(tracks ?? []);
  const byId = new Map(clips.filter((c) => c.id).map((c) => [c.id as string, c]));
  const warnings: string[] = [];
  let baked = 0;
  const out: PitchClip[] = [];
  for (const c of clips) {
    const explicit = normalizeClipPitch(c.pitch);
    const pitch = explicit ?? defaultClipPitch(); // no setting = pitch preserved, no shift
    const track = c.trackId ? trackById.get(c.trackId) : undefined;
    if (!needsPitchBake(pitch, c.speed) || (track && silenced.has(track.id))) { out.push(c); continue; }
    const label = `"${c.name || c.id || 'clip'}"`;
    if (!exportsAsAudio(c, track)) {
      if ((c.linkedClipIds ?? []).some((id) => { const o = byId.get(id); return !!o && ((o.trackId ? trackById.get(o.trackId)?.kind : undefined) ?? o.trackKind) === 'audio'; })) { out.push(c); continue; }
      if (explicit) warnings.push(`Pitch on ${label} is preview-only: its sound plays inside the video. Unlink the audio (it then sits on an audio track) to export the pitch.`);
      out.push(c);
      continue;
    }
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    try {
      const url = await bake({ url: c.inputPath, trimStart: c.trimStart, duration: c.duration, speed: c.speed || 1, pitch }, signal);
      out.push({ ...c, inputPath: url, trimStart: 0, speed: 1 });
      baked++;
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') throw e;
      warnings.push(`Pitch on ${label} was not applied to the export: ${e instanceof Error ? e.message : String(e)}`);
      out.push(c);
    }
  }
  return { clips: out, warnings, baked };
}
