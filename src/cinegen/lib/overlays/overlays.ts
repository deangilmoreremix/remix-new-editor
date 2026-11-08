// [remix] Overlays on the video (Lead Generator, List Builder, CTA). They reuse the old editor's add-on clips and renderers
// (src/lib/editor/addons, src/lib/editor/publish/viewerOverlays.js); CineGen's Clip needs a media asset, so overlays are kept in
// their own list in the project state and saved with it (like Sets).
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
// @ts-expect-error plain JS add-on registry from the main app
import { createAddonClip } from '../../../lib/editor/addons/registry.js';
// @ts-expect-error plain JS add-ons (registers lead-form / click-to-call)
import '../../../lib/editor/addons/interactiveAddons.js';
// @ts-expect-error plain JS List Builder defaults
import { defaultListBuilder } from '../../../lib/editor/addons/listBuilder.js';

export const OVERLAY_KINDS: Array<{ kind: OverlayKind; label: string; blurb: string }> = [
  { kind: 'lead-form', label: 'Lead Generator', blurb: 'Opt-in form over the video; pauses playback until the viewer submits or skips.' },
  { kind: 'list-builder', label: 'List Builder', blurb: 'Sign-up / personalizer form over the video.' },
  { kind: 'click-to-call', label: 'CTA', blurb: 'Call-to-action button that dials or opens a link.' },
];

const KINDS = new Set<string>(['lead-form', 'list-builder', 'click-to-call']);

export function normalizeOverlays(value: unknown): OverlayClip[] {
  if (!Array.isArray(value)) return [];
  return value.filter((o): o is OverlayClip => !!o && typeof o === 'object' && KINDS.has((o as OverlayClip).type) && typeof (o as OverlayClip).start === 'number');
}

/** A new overlay at `startSec` (clamped inside the timeline), with the old add-on's default options. */
export function createOverlay(kind: OverlayKind, startSec: number, timelineSeconds: number): OverlayClip {
  const id = `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (kind === 'list-builder') {
    const length = 5;
    const start = Math.max(0, Math.min(startSec, Math.max(0, timelineSeconds - length)));
    return { id, type: kind, name: 'List Builder', start, end: start + length, config: defaultListBuilder('list-builder') };
  }
  const clip = createAddonClip(kind, { startSec, timelineSeconds, id }) as Record<string, unknown>;
  return { ...clip, id, type: kind, name: String(clip.name ?? kind), start: Number(clip.start), end: Number(clip.end) } as OverlayClip;
}

export const overlaysAt = (overlays: OverlayClip[], time: number) => overlays.filter((o) => time >= o.start && time < o.end);
