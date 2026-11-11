// [remix] Overlays on the video (Lead Generator, List Builder, CTA). They reuse the old editor's add-on clips and renderers
// (src/lib/editor/addons, src/lib/editor/publish/viewerOverlays.js); CineGen's Clip needs a media asset, so overlays are kept in
// their own list in the project state and saved with it (like Sets).
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
// @ts-expect-error plain JS add-on registry from the main app
import { createAddonClip } from '../../../lib/editor/addons/registry.js';
// @ts-expect-error plain JS add-ons (registers lead-form / click-to-call)
import '../../../lib/editor/addons/interactiveAddons.js';
// @ts-expect-error plain JS add-ons (registers Smart Text, Text Mask, Image, Personalized Image, Stickers, Wrapper, Lower Thirds)
import { getAddon } from '../../../lib/editor/addons/registry.js';
// @ts-expect-error plain JS add-ons
import '../../../lib/editor/addons/overlayAddons.js';
// @ts-expect-error plain JS List Builder defaults
import { defaultListBuilder } from '../../../lib/editor/addons/listBuilder.js';

export const OVERLAY_KINDS: Array<{ kind: OverlayKind; label: string; blurb: string }> = [
  { kind: 'lead-form', label: 'Lead Generator', blurb: 'Opt-in form over the video; pauses playback until the viewer submits or skips.' },
  { kind: 'list-builder', label: 'List Builder', blurb: 'Sign-up / personalizer form over the video.' },
  { kind: 'click-to-call', label: 'CTA', blurb: 'Call-to-action button that dials or opens a link.' },
  { kind: 'overlay-text', label: 'Smart Text', blurb: 'Text over the video with personalization tokens and animations.' },
  { kind: 'overlay-text-mask', label: 'Text Mask', blurb: 'Video shows through the letters.' },
  { kind: 'overlay-image', label: 'Image', blurb: 'An image over the video.' },
  { kind: 'overlay-personalized-image', label: 'Personalized Image', blurb: 'An image taken from each contact.' },
  { kind: 'overlay-sticker', label: 'Stickers', blurb: 'Emoji, shapes and animated stickers.' },
  { kind: 'overlay-background', label: 'Wrapper', blurb: 'A colour or gradient background behind the video.' },
  { kind: 'overlay-lower-third', label: 'Lower Thirds', blurb: 'Name and title bars that animate in and out.' },
];

/** Length of the List Builder's marker on the lane (only visual: the video waits at 0s until the form is submitted). */
export const GATE_SECONDS = 3;
/** List Builder / Personalizer are gates: locked at 0s, and only one per video. */
export const isGateOverlay = (o: { type: string }) => o.type === 'list-builder';
export const findGate = (overlays: OverlayClip[]) => overlays.find(isGateOverlay);
/** A new overlay never lands on top of the gate's marker (the gate holds the video at 0s, so it would show two forms at once). */
export const startAfterGate = (overlays: OverlayClip[], startSec: number) => (findGate(overlays) ? Math.max(startSec, GATE_SECONDS) : startSec);

const KINDS = new Set<string>([...OVERLAY_KINDS.map((k) => k.kind), 'mg-template', 'hyperframes']);

/** Add-ons driven by the old registry's schema (options live under `addon`), as opposed to the flat forms. */
export const isRegistryOverlay = (kind: string) => !['lead-form', 'list-builder', 'click-to-call'].includes(kind) && !!getAddon(kind);

export function normalizeOverlays(value: unknown): OverlayClip[] {
  if (!Array.isArray(value)) return [];
  return value.filter((o): o is OverlayClip => !!o && typeof o === 'object' && KINDS.has((o as OverlayClip).type) && typeof (o as OverlayClip).start === 'number');
}

/** A new overlay at `startSec` (clamped inside the timeline), with the old add-on's default options. */
export function createOverlay(kind: OverlayKind, startSec: number, timelineSeconds: number): OverlayClip {
  const id = `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (kind === 'list-builder') {
    // The List Builder is a registration wall on the whole video: a locked gate at 0s (it takes no video time), one per video.
    return { id, type: kind, name: 'List Builder', start: 0, end: GATE_SECONDS, config: { ...defaultListBuilder('list-builder'), enabled: true } };
  }
  const clip = createAddonClip(kind, { startSec, timelineSeconds, id }) as Record<string, unknown>;
  if (isRegistryOverlay(kind)) clip.name = getAddon(kind).label;
  return { ...clip, id, type: kind, name: String(clip.name ?? kind), start: Number(clip.start), end: Number(clip.end) } as OverlayClip;
}

// [remix] End Screens and Connect Form template libraries (the old editor's windows → items on the overlay lane)
// @ts-expect-error plain JS template library
import { TEMPLATE_LIBRARIES, getTemplate, templateStart, applyCallSetup } from '../../../lib/editor/addons/templateLibrary.js';
// @ts-expect-error plain JS preset → clips
import { presetToClips } from '../../../lib/editor/addons/overlayPresets.js';

export interface OverlayTemplateEntry { id: string; name: string; description: string; library: string }
export const overlayTemplates = (): OverlayTemplateEntry[] => (Object.values(TEMPLATE_LIBRARIES) as Array<{ id: string; title: string; templates: Array<{ id: string; name: string; description: string }> }>)
  .flatMap((lib) => lib.templates.map((t) => ({ id: t.id, name: `${lib.title}: ${t.name}`, description: t.description, library: lib.id })));

/** The overlay clips of an End Screen / Connect Form template, placed at the timeline end (end screens) or the playhead. */
export function createTemplateOverlays(templateId: string, playheadSec: number, timelineSeconds: number, call?: { phone: string; country?: string; buttonText?: string; notify?: string }): OverlayClip[] {
  const found = getTemplate(templateId);
  if (!found) return [];
  // Connect Form = click-to-call: the user's own number replaces the placeholder in every call button
  const tpl = call?.phone ? applyCallSetup(found, call) : found;
  const anchor = (Object.values(TEMPLATE_LIBRARIES) as Array<{ anchor: string; templates: Array<{ id: string }> }>).find((l) => l.templates.some((t) => t.id === templateId))?.anchor ?? 'playhead';
  const start = templateStart(tpl, anchor, { playheadSec, timelineSeconds });
  const base = Date.now();
  return (presetToClips({ id: tpl.id, name: tpl.name, items: tpl.items }, start, timelineSeconds, base) as Array<Record<string, unknown>>)
    .map((c, i) => ({ ...c, id: `ov-${base.toString(36)}-${i}`, start: Number(c.start), end: Number(c.end), name: String(c.name ?? c.type) }) as unknown as OverlayClip)
    .filter((o) => KINDS.has(o.type));
}

export const isConnectTemplate = (templateId: string): boolean => !!(TEMPLATE_LIBRARIES.connect as { templates: Array<{ id: string }> }).templates.some((t) => t.id === templateId);

export const overlaysAt = (overlays: OverlayClip[], time: number) => overlays.filter((o) => time >= o.start && time < o.end);
