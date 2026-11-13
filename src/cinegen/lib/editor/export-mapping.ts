// [remix] CineGen preview -> export hand-off (pure, no DOM). The editor preview is the PlaybackEngine; the export is the shared Remotion
// composition fed by timelineToComposition. This module closes the gaps between them:
//   - track mute / solo (same rule as PlaybackEngine.updateMutedTracks: muted-track clips do not play or show),
//   - track visibility (hidden video track: picture dropped, its sound kept),
//   - track volume (audio tracks, same as PlaybackEngine.updateAudioGraph) and clip volume, with the >1 boost clamped to unity and reported,
//   - static clip opacity, flipH / flipV,
//   - plain dissolve / fadeToBlack / fadeFromBlack (same opacity ramps as PlaybackEngine.applyTransitionOpacity),
//   - one composition track per CineGen track, so stacking order matches the preview.
// GL transitions (transition.glType) keep their own GL layer in adapters/web-api.ts and are NOT turned into opacity ramps here.
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import { resolveFit, LEGACY_FIT } from '@cinegen/lib/occ/frame-geometry';
import { clipFxInstances } from '@cinegen/lib/occ/clip-fx';
import { userLutTextSync } from '@cinegen/lib/occ/user-luts';
import { pluginFxSnapshotSync, type FxSnapshot } from '@cinegen/lib/occ/plugins';

export interface ExportTrackInfo { id: string; kind: 'video' | 'audio'; muted: boolean; solo: boolean; visible: boolean; volume: number }
export interface ExportTransitionInfo { type?: 'dissolve' | 'fadeToBlack' | 'fadeFromBlack'; duration?: number; clipAId: string; clipBId?: string; glType?: string; glDef?: unknown }
export interface ExportClipInput {
  id?: string; name?: string; inputPath: string; startTime: number; duration: number; trimStart: number; speed: number; volume: number; type: 'video' | 'audio' | 'image';
  trackKind?: string; trackId?: string; linkedClipIds?: string[]; opacity?: number; flipH?: boolean; flipV?: boolean;
  kf?: Array<{ time: number; property: string; value: number }>;
  [k: string]: unknown;
}
export interface ExportItem { id: string; type: string; volume: number; keyframes?: Record<string, Array<{ t: number; v: number }>>; [k: string]: unknown }

/** Clip list sent to `electronAPI.export.start`, built from the active timeline (was inline in export-tab.tsx). */
export function exportClipsFromTimeline(timeline: Timeline, assets: Asset[]): ExportClipInput[] {
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  return timeline.clips.flatMap((clip) => {
    const asset = assetsById.get(clip.assetId);
    const inputPath = asset?.fileRef || asset?.url;
    const duration = clipEffectiveDuration(clip);
    if (!asset || !inputPath || duration <= 0) return [];
    return [{
      id: clip.id, name: clip.name, inputPath, startTime: clip.startTime, duration, trimStart: clip.trimStart, speed: clip.speed || 1,
      volume: clip.volume ?? 1, type: asset.type,
      // a clip on an audio track plays sound only, even when its media file is a video
      trackKind: timeline.tracks.find((t) => t.id === clip.trackId)?.kind, trackId: clip.trackId,
      linkedClipIds: clip.linkedClipIds, // [remix] Stage 4: lets the export mute a video clip whose sound is exported by its linked audio clip
      opacity: clip.opacity ?? 1, flipH: clip.flipH, flipV: clip.flipV,
      eq: clip.eq, // [remix] Stage 4: baked into the audio at export (lib/audio/export-audio.ts)
      fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, kf: clip.keyframes, transform: clip.transform, fit: resolveFit(clip, timeline), fx: clip.fx,
      lut: clip.lut, blendMode: clip.blendMode, zoom: clip.zoom, captions: clip.captions,
    }];
  });
}

export function exportTracksFromTimeline(timeline: Timeline): ExportTrackInfo[] {
  return timeline.tracks.map((t) => ({ id: t.id, kind: t.kind, muted: !!t.muted, solo: !!t.solo, visible: t.visible !== false, volume: t.volume ?? 1 }));
}

/** Every transition, for the export hand-off (GL ones carry glType/glDef, plain ones are turned into opacity ramps). */
export function exportTransitionsFromTimeline(timeline: Timeline): ExportTransitionInfo[] {
  return (timeline.transitions ?? []).map((t) => ({ type: t.type, duration: t.duration, clipAId: t.clipAId, clipBId: t.clipBId, glType: t.glType, glDef: t.glDef }));
}

/** Same rule as PlaybackEngine.updateMutedTracks: with any solo only soloed tracks play, otherwise muted tracks are silent (and hidden). */
export function silencedTrackIds(tracks: ExportTrackInfo[]): Set<string> {
  const hasSolo = tracks.some((t) => t.solo);
  return new Set(tracks.filter((t) => (hasSolo ? !t.solo : t.muted)).map((t) => t.id));
}


type FxClip = { fx?: Array<{ id: string; def?: FxSnapshot; props: Record<string, number | number[]>; enabled?: boolean }>; lut?: { id: string; intensity: number; def?: FxSnapshot } };
// OpenChatCut effects + LUT of an export clip, as plain {id, overrides} for the composition's GL layer.
const occFxList = (c: FxClip) =>
  clipFxInstances(c as never).map(({ def, overrides, keys }) => ({
    id: def.id, overrides, ...(keys ? { keys } : {}),
    // the sandboxed export runner has no IndexedDB: user .cube LUTs travel with the render
    ...(def.id.startsWith('user:lut-') ? { name: def.name, cubeText: userLutTextSync(def.id) } : {}),
    // plugin fx / LUT: a self-contained snapshot travels with the render (the runner has no installed packs)
    ...(def.id.startsWith('plugin:') ? { def: c.fx?.find((f) => f.id === def.id)?.def ?? (c.lut?.id === def.id ? c.lut.def : undefined) ?? pluginFxSnapshotSync(def.id) } : {}),
  }));

/** CineGen opacity/volume keyframes ({time,value}) -> composition keyframes ({t,v}) per property. */
function kfToComposition(kf: Array<{ time: number; property: string; value: number }>) {
  const out: Record<string, Array<{ t: number; v: number }>> = {};
  for (const k of kf) (out[k.property] ??= []).push({ t: k.time, v: k.value });
  return out;
}

/** The base composition item for one export clip (moved from adapters/web-api.ts; track state / volume / opacity / flip are applied by buildExportState). */
export function exportItem(c: ExportClipInput, i: number): ExportItem {
  const k = c as ExportClipInput & { zoom?: unknown; transform?: unknown; fit?: 'contain' | 'cover'; fadeIn?: number; fadeOut?: number; blendMode?: string };
  return {
    id: `c${i}`, type: c.type === 'audio' ? 'audio' : c.type === 'image' ? 'image' : 'video', src: c.inputPath,
    start: c.startTime, end: c.startTime + c.duration, trimIn: c.trimStart, playbackRate: c.speed || 1, volume: c.kf?.some((x) => x.property === 'volume') ? 1 : (c.volume ?? 1),
    // OpenChatCut effects / LUT -> burned in by the composition's GL layer
    occFx: occFxList(c as unknown as FxClip),
    ...(k.zoom ? { zoom: k.zoom } : {}),
    ...(k.transform ? { transform: k.transform } : {}),
    fit: k.fit ?? LEGACY_FIT,
    ...(k.fadeIn ? { fadeIn: k.fadeIn } : {}), ...(k.fadeOut ? { fadeOut: k.fadeOut } : {}),
    ...(c.kf?.length ? { keyframes: kfToComposition(c.kf) } : {}),
    ...(k.blendMode && k.blendMode !== 'normal' ? { blendMode: k.blendMode } : {}),
  };
}

interface Ramp { t0: number; t1: number; v0: number; v1: number }
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const rampAt = (r: Ramp, t: number) => (t <= r.t0 ? r.v0 : t >= r.t1 ? r.v1 : r.v0 + ((t - r.t0) / (r.t1 - r.t0)) * (r.v1 - r.v0));

function kfAt(kfs: Array<{ time: number; value: number }>, base: number, t: number): number {
  if (!kfs.length) return base;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i + 1].time) {
      const f = kfs[i + 1].time === kfs[i].time ? 0 : (t - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
      return kfs[i].value + f * (kfs[i + 1].value - kfs[i].value);
    }
  }
  return last.value;
}

/**
 * Opacity over the clip as composition keyframes ({t,v}, seconds from the clip start, linear) = the preview's
 * (opacity keyframes or static opacity) x (transition ramps). Null when it is a constant 1 (nothing to send).
 */
export function opacityEnvelope(opts: { base: number; kfs: Array<{ time: number; value: number }>; ramps: Ramp[]; duration: number }): Array<{ t: number; v: number }> | null {
  const { base, ramps, duration } = opts;
  const kfs = [...opts.kfs].sort((a, b) => a.time - b.time);
  if (!(duration > 0)) return null;
  if (!kfs.length && !ramps.length && Math.abs(base - 1) < 1e-6) return null;
  const times = new Set<number>([0, duration]);
  for (const k of kfs) if (k.time > 0 && k.time < duration) times.add(r4(k.time));
  for (const r of ramps) {
    for (let i = 0; i <= 8; i++) { const t = r.t0 + ((r.t1 - r.t0) * i) / 8; if (t >= 0 && t <= duration) times.add(r4(t)); }
  }
  const value = (t: number) => Math.max(0, Math.min(1, kfAt(kfs, base, t) * ramps.reduce((m, r) => m * rampAt(r, t), 1)));
  const out = [...times].sort((a, b) => a - b).map((t) => ({ t, v: r4(value(t)) }));
  return out.every((p) => p.v === 1) ? null : out;
}

export interface BuildExportStateInput {
  clips: ExportClipInput[];
  tracks?: ExportTrackInfo[];
  transitions?: ExportTransitionInfo[];
  overlays?: Array<Record<string, unknown> & { id?: string }>;
  totalDuration: number;
  /** [remix] Stage 4: timeline master volume (0 to 1; the preview's master gain node). Multiplies every clip's sound. */
  masterVolume?: number;
}

/**
 * The `state` object timelineToComposition consumes, from the export hand-off.
 * `makeItem` builds the base composition item for one clip (fx, zoom, transform, fades, ...; see adapters/web-api.ts); this function
 * then applies track state, volume, opacity, flip and transitions on top and groups items into one composition track per CineGen track.
 */
export function buildExportState(input: BuildExportStateInput, makeItem: (c: ExportClipInput, i: number) => ExportItem): { state: { timelineSeconds: number; tracks: Array<{ id: string; type: string; items: unknown[] }> }; warnings: string[] } {
  const { clips, totalDuration } = input;
  const master = Math.max(0, Number.isFinite(input.masterVolume) ? (input.masterVolume as number) : 1); // [remix] Stage 4
  const tracks = input.tracks ?? [];
  const warnings: string[] = [];
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const silenced = silencedTrackIds(tracks);
  const byId = new Map(clips.filter((c) => c.id).map((c) => [c.id as string, c]));

  // opacity ramps from plain (non-GL) transitions
  const ramps = new Map<string, Ramp[]>();
  const addRamp = (id: string | undefined, r: Ramp) => { if (id && r.t1 > r.t0) ramps.set(id, [...(ramps.get(id) ?? []), r]); };
  for (const t of input.transitions ?? []) {
    if (t.glType) continue;
    const a = byId.get(t.clipAId);
    if (!a) continue;
    const type = t.type ?? 'dissolve';
    if (type === 'dissolve') {
      const b = t.clipBId ? byId.get(t.clipBId) : undefined;
      if (!b) continue;
      const start = b.startTime; const end = a.startTime + a.duration;
      if (end <= start) continue;
      addRamp(a.id, { t0: start - a.startTime, t1: end - a.startTime, v0: 1, v1: 0 });
      addRamp(b.id, { t0: 0, t1: end - b.startTime, v0: 0, v1: 1 });
    } else if (type === 'fadeFromBlack') {
      addRamp(a.id, { t0: 0, t1: Math.min(t.duration ?? 0, a.duration), v0: 0, v1: 1 });
    } else if (type === 'fadeToBlack') {
      const d = Math.min(t.duration ?? 0, a.duration);
      addRamp(a.id, { t0: a.duration - d, t1: a.duration, v0: 1, v1: 0 });
    }
  }

  const perTrack = new Map<string, ExportItem[]>();
  const push = (key: string, it: ExportItem) => perTrack.set(key, [...(perTrack.get(key) ?? []), it]);
  const label = (c: ExportClipInput, i: number) => `"${c.name || c.id || `clip ${i + 1}`}"`;

  clips.forEach((c, i) => {
    const track = c.trackId ? trackById.get(c.trackId) : undefined;
    if (track && silenced.has(track.id)) return; // muted / not soloed: nothing plays or shows (as in the preview)
    const isAudioTrack = (track?.kind ?? c.trackKind) === 'audio';
    const hidden = !!track && track.visible === false && !isAudioTrack;
    if (hidden && c.type === 'image') return;
    // [remix] Stage 4: in the preview a video-track clip is silent and its sound comes from the linked audio-track clip (the video element is only
    // unmuted to play that clip). The export used to play both, doubling the sound (and an EQ'd copy would be mixed with the dry one).
    const hasLinkedAudio = !isAudioTrack && c.type !== 'audio' && (c.linkedClipIds ?? []).some((id) => { const o = byId.get(id); return !!o && ((o.trackId ? trackById.get(o.trackId)?.kind : o.trackKind) ?? o.trackKind) === 'audio'; });
    if (hasLinkedAudio && hidden) return; // picture is hidden and its sound is exported by the linked audio clip
    const asAudio = isAudioTrack || c.type === 'audio' || hidden; // a hidden video clip keeps its sound
    const item = makeItem(asAudio ? { ...c, type: 'audio' } : c, asAudio ? 1000 + i : i);
    item.id = `${asAudio ? 'a' : 'c'}${i}`;

    // volume: keyframes replace the clip volume (as in the preview); audio tracks scale by track volume; export is capped at unity
    const gain = (isAudioTrack ? track?.volume ?? 1 : 1) * master;
    const volKf = (c.kf ?? []).filter((k) => k.property === 'volume');
    if (hasLinkedAudio) {
      item.volume = 0;
      if (item.keyframes?.volume) { const { volume: _drop, ...rest } = item.keyframes; item.keyframes = rest; }
    } else if (volKf.length) {
      let boosted = false;
      item.keyframes = { ...(item.keyframes ?? {}), volume: volKf.map((k) => { const v = k.value * gain; if (v > 1) boosted = true; return { t: k.time, v: Math.max(0, Math.min(1, v)) }; }) };
      item.volume = 1;
      if (boosted) warnings.push(`Volume above 100% on ${label(c, i)} is exported at 100% (no boost in export).`);
    } else {
      const v = Math.max(0, (c.volume ?? 1) * gain);
      item.volume = Math.min(1, v);
      if (v > 1 + 1e-6) warnings.push(`Volume above 100% on ${label(c, i)} is exported at 100% (no boost in export).`);
    }

    if (!asAudio) {
      if (c.flipH) item.flipH = true;
      if (c.flipV) item.flipV = true;
      const op = opacityEnvelope({ base: c.opacity ?? 1, kfs: (c.kf ?? []).filter((k) => k.property === 'opacity'), ramps: (c.id && ramps.get(c.id)) || [], duration: c.duration });
      if (op) item.keyframes = { ...(item.keyframes ?? {}), opacity: op };
    }
    push(track ? track.id : asAudio ? '__a' : '__v', item);
  });

  const out: Array<{ id: string; type: string; items: unknown[] }> = [];
  const ordered = [...tracks];
  const emit = (t: { id: string; kind: string }) => { const items = perTrack.get(t.id); if (items?.length) out.push({ id: t.id, type: t.kind, items }); };
  ordered.filter((t) => t.kind === 'video').forEach(emit);
  if (perTrack.get('__v')?.length) out.push({ id: 'v', type: 'video', items: perTrack.get('__v') as ExportItem[] });
  if ((input.overlays ?? []).length) out.push({ id: 'ov', type: 'text', items: (input.overlays ?? []).map((o, i) => ({ ...o, id: o.id ?? `ov${i}` })) });
  ordered.filter((t) => t.kind === 'audio').forEach(emit);
  if (perTrack.get('__a')?.length) out.push({ id: 'a', type: 'audio', items: perTrack.get('__a') as ExportItem[] });
  return { state: { timelineSeconds: Math.max(1, totalDuration), tracks: out }, warnings: [...new Set(warnings)] };
}
