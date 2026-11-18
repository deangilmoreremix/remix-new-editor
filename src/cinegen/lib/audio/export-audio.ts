// [remix] Stage 4: audio hand-off for export (pure apart from the injected bake function).
//   - which clips get their EQ baked, and the warning for the ones that cannot (a video clip on a video track plays its own sound inside
//     the composition's <Video>, so its source cannot be swapped for an EQ'd file; the preview does apply the EQ there),
//   - master volume (applied inside buildExportState in lib/editor/export-mapping.ts).
import { isEqActive, normalizeClipEq, type ClipEq } from './eq';
import { silencedTrackIds, type ExportClipInput, type ExportTrackInfo } from '../editor/export-mapping';

export type EqClip = ExportClipInput & { eq?: ClipEq };

/** Whether this clip's sound goes into the composition as an <Audio> item (mirrors buildExportState's `asAudio`). */
export function exportsAsAudio(c: ExportClipInput, track: ExportTrackInfo | undefined): boolean {
  const isAudioTrack = (track?.kind ?? c.trackKind) === 'audio';
  const hidden = !!track && track.visible === false && !isAudioTrack;
  return isAudioTrack || c.type === 'audio' || hidden;
}

export interface EqBakeResult { clips: EqClip[]; warnings: string[]; baked: number }

/**
 * Replace the source of every audio-routed clip that has an active EQ with the EQ'd file made by `bake`.
 * A failing bake (or an abort) never loses the clip: it exports without EQ and says so.
 */
export async function bakeEqForExport(
  clips: EqClip[], tracks: ExportTrackInfo[] | undefined,
  bake: (url: string, eq: ClipEq, signal?: AbortSignal) => Promise<string>, signal?: AbortSignal,
): Promise<EqBakeResult> {
  const trackById = new Map((tracks ?? []).map((t) => [t.id, t]));
  const silenced = silencedTrackIds(tracks ?? []);
  const byId = new Map(clips.filter((c) => c.id).map((c) => [c.id as string, c]));
  const warnings: string[] = [];
  let baked = 0;
  const out: EqClip[] = [];
  for (const c of clips) {
    const eq = normalizeClipEq(c.eq);
    const track = c.trackId ? trackById.get(c.trackId) : undefined;
    if (!eq || !isEqActive(eq) || (track && silenced.has(track.id))) { out.push(c); continue; }
    const label = `"${c.name || c.id || 'clip'}"`;
    if (!exportsAsAudio(c, track)) {
      // a video clip whose sound comes from its linked audio clip is silent in the export: nothing to warn about
      if ((c.linkedClipIds ?? []).some((id) => { const o = byId.get(id); return !!o && ((o.trackId ? trackById.get(o.trackId)?.kind : undefined) ?? o.trackKind) === 'audio'; })) { out.push(c); continue; }
      warnings.push(`EQ on ${label} is preview-only: its sound plays inside the video. Unlink the audio (it then sits on an audio track) to export the EQ.`);
      out.push(c);
      continue;
    }
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    try {
      out.push({ ...c, inputPath: await bake(c.inputPath, eq, signal) });
      baked++;
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') throw e;
      warnings.push(`EQ on ${label} was not applied to the export: ${e instanceof Error ? e.message : String(e)}`);
      out.push(c);
    }
  }
  return { clips: out, warnings, baked };
}
