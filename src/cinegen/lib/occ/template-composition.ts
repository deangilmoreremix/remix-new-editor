// [remix] Template Generator → CineGen timeline. The classic generator builds a composition (lib/editor/templateCompositionBuilder.js:
// tracks of timed clips + transitions) and hands it to `timelineApi.applyTemplate`. This is that hand-off for the Timeline Studio Editor:
// media becomes assets + clips on the matching tracks (consecutive footage, as built), text / overlay clips become overlay-lane items
// (Smart Text), and the builder's transitions become dissolves between the same neighbouring clips.
import type { Asset } from '@cinegen/types/project';
import type { Timeline, Transition } from '@cinegen/types/timeline';
import type { OverlayClip } from '@cinegen/types/workspace';
import { addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { createOverlay, createTemplateOverlays } from '@cinegen/lib/overlays/overlays';
import { generateId } from '@cinegen/lib/utils/ids';

interface CompClip { _overlayConfig?: { animation?: { overlay?: OverlayClip; templateId?: string } }; type?: string; name?: string; duration?: number; startTime?: number; text?: string; assetId?: string; asset?: { id?: string; type?: string; name?: string; url?: string; duration?: number; thumbnail?: string } | null }
interface CompTrack { type?: string; name?: string; clips?: CompClip[] }
export interface Composition { name?: string; tracks?: CompTrack[]; transitions?: Array<{ fromClipIndex: number; toClipIndex: number; inTrack?: number; type?: string; duration?: number }> }

export interface AppliedComposition { timeline: Timeline; assets: Asset[]; overlays: OverlayClip[]; clipIds: string[] }

export function applyComposition(timeline: Timeline, comp: Composition): AppliedComposition {
  let tl = timeline;
  const assets: Asset[] = [];
  const overlays: OverlayClip[] = [];
  const placed = new Map<number, string[]>(); // composition track index → timeline clip ids in order
  const base = Math.max(0, tl.duration || 0);
  const T = Math.max(10, base + 1);
  // where the generated cut ends on this timeline (end screens are anchored there)
  const compEnd = base + Math.max(1, ...(comp.tracks ?? []).flatMap((t) => (t.clips ?? []).map((c) => (c.startTime ?? 0) + (c.duration ?? 0))));

  (comp.tracks ?? []).forEach((track, ti) => {
    const ids: string[] = [];
    for (const c of track.clips ?? []) {
      const start = base + Math.max(0, c.startTime ?? 0);
      const dur = Math.max(0.1, c.duration ?? 3);
      const a = c.asset;
      if (a?.url && (a.type === 'video' || a.type === 'image' || a.type === 'audio')) {
        const asset: Asset = { id: a.id ?? generateId(), name: a.name ?? c.name ?? 'Media', type: a.type, url: a.url, fileRef: a.url, thumbnailUrl: a.thumbnail, duration: a.duration ?? dur, createdAt: new Date().toISOString() };
        const kind = a.type === 'audio' ? 'audio' : 'video';
        const target = tl.tracks.find((t) => t.kind === kind && !t.locked) ?? tl.tracks.find((t) => t.kind === kind);
        if (!target) continue;
        const before = new Set(tl.clips.map((x) => x.id));
        tl = addClipToTrack(tl, target.id, { ...asset, duration: asset.type === 'image' ? dur : asset.duration }, start);
        const added = tl.clips.find((x) => !before.has(x.id) && x.assetId === asset.id && x.trackId === target.id);
        if (added) ids.push(added.id);
        assets.push(asset);
      } else if (c.type === 'cta' || c.type === 'lead-form' || c.type === 'lower-third' || c.type === 'sticker') {
        // wizard overlay kinds → the matching overlay-lane kind (defaults from the overlay's own descriptor)
        const kind = { cta: 'click-to-call', 'lead-form': 'lead-form', 'lower-third': 'overlay-lower-third', sticker: 'overlay-sticker' }[c.type] as 'click-to-call';
        const o = createOverlay(kind, start, T + dur);
        // a wizard call button sits low in the frame so it does not cover the text overlay (both default to the centre)
        overlays.push({ ...o, start, end: start + dur, ...(kind === 'click-to-call' ? { style: { ...((o.style as Record<string, unknown>) ?? {}), posTop: 72 } } : {}) });
      } else if (c.type === 'animation') {
        // an animation / motion graphic picked in the wizard: the overlay its library resolved, re-timed to this cut; or an end-screen / form template
        const cfg = c._overlayConfig?.animation;
        if (cfg?.overlay) overlays.push({ ...cfg.overlay, id: generateId(), start, end: start + dur });
        else if (cfg?.templateId) overlays.push(...createTemplateOverlays(cfg.templateId, start, compEnd));
      } else if (c.text) {
        const o = createOverlay('overlay-text', start, T + dur);
        const addon = { ...((o.addon as Record<string, unknown>) ?? {}), text: c.text };
        overlays.push({ ...o, addon, start, end: start + dur, name: c.name ?? 'Text' });
      }
    }
    placed.set(ti, ids);
  });

  const transitions: Transition[] = [];
  for (const t of comp.transitions ?? []) {
    // the builder's `inTrack` indexes its base tracks; fall back to the first track that actually holds the footage
    const direct = placed.get(t.inTrack ?? 0) ?? [];
    const ids = direct.length >= 2 ? direct : ([...placed.values()].find((v) => v.length >= 2) ?? []);
    const a = ids[t.fromClipIndex]; const b = ids[t.toClipIndex];
    if (a && b) transitions.push({ id: generateId(), type: 'dissolve', duration: Math.max(0.1, Math.min(t.duration ?? 1, 2)), clipAId: a, clipBId: b });
  }
  if (transitions.length) tl = { ...tl, transitions: [...tl.transitions, ...transitions] };
  return { timeline: tl, assets, overlays, clipIds: [...placed.values()].flat() };
}
