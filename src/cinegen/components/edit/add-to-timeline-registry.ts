// [remix] The catalog behind the "Add to timeline" modal. ONE entry per card: what it is, how it previews, what it does.
// `preview` is required by the type, so adding a feature here forces you to say how it looks (see preview-card.tsx).
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
import type { HfItem } from '@cinegen/lib/hyperframes/overlay';
import { createHyperframesOverlay } from '@cinegen/lib/hyperframes/overlay';
import { createMgOverlay, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { OVERLAY_KINDS, overlayTemplates, createOverlay, createTemplateOverlays, isConnectTemplate } from '@cinegen/lib/overlays/overlays';
import type { CardPreview } from './preview-types';

export interface AddToTimelineActions {
  onPickAnimation?: (item: HfItem) => void; // omitted when the HyperFrames flag is off
  onPickMotion: (t: MgTemplate) => void;
  onAddKind: (kind: OverlayKind) => void;
  onAddTemplate: (templateId: string, phone?: string) => void;
}

export type CatalogTab = 'animations' | 'motion' | 'overlays' | 'endscreens';
/** `keywords` is extra text the search matches (tags, category). */
export interface CatalogEntry { id: string; tab: CatalogTab; label: string; blurb: string; badge: string; preview: CardPreview; run: () => void; keywords?: string; testId?: string }

/** Overlay clips of a preview, moved so the first one starts at 0 (end-screen templates are anchored to the timeline end). */
function fromZero(clips: OverlayClip[]): OverlayClip[] {
  const t0 = Math.min(...clips.map((c) => c.start));
  return clips.map((c) => ({ ...c, start: c.start - t0, end: c.end - t0 }));
}
const spanOf = (clips: OverlayClip[]) => Math.max(1, ...clips.map((c) => c.end));

/** The List Builder shows a "pointer hint" (dimmed backdrop, arrow and bubble) for its first seconds. That is right in the video but at card size it
 *  overlaps the form and reads as jumbled text, so the preview copy turns it off. The overlay that is really added is made by createOverlay and keeps it. */
const forPreview = (clips: OverlayClip[]): OverlayClip[] => clips.map((c) => (c.type === 'list-builder' ? { ...c, config: { ...(c.config as object), pointerEnabled: false } } : c));

const kindPreview = (kind: OverlayKind): CardPreview => {
  const make = () => forPreview(fromZero([createOverlay(kind, 0, 6)]));
  const d = spanOf(make());
  // forms are shown at once; animated overlays are shown a little way in
  return { kind: 'overlay', build: make, duration: d, still: kind === 'lead-form' || kind === 'list-builder' ? 0.2 : Math.min(d * 0.5, 2.5) };
};
const templatePreview = (id: string): CardPreview => {
  const make = () => fromZero(createTemplateOverlays(id, 0, 10));
  const d = spanOf(make());
  return { kind: 'overlay', build: make, duration: d, still: Math.min(d * 0.6, 3) };
};

const mgCache = new WeakMap<MgTemplate, CardPreview>();
export function mgPreview(t: MgTemplate): CardPreview {
  const hit = mgCache.get(t); if (hit) return hit;
  const base = t.thumb ? t.thumb.split('/').pop() : undefined;
  const dur = t.durationInFrames / t.fps;
  const p: CardPreview = { kind: 'overlay', build: () => [createMgOverlay(t, 0)], duration: dur, frame: { width: t.width, height: t.height }, still: dur * 0.5, image: base ? `/occ-templates/thumbs/${base}` : undefined };
  mgCache.set(t, p);
  return p;
}
/** Pre-made picture of an animation (public/hyperframes/thumbs). Every ':' in the id becomes '-'. */
export const thumbOf = (id: string): string => `/hyperframes/thumbs/${id.replace(/:/g, '-')}.jpg`;

const hfCache = new Map<string, CardPreview>();
export function hfPreview(i: HfItem): CardPreview {
  const hit = hfCache.get(i.id); if (hit) return hit;
  const p: CardPreview = { kind: 'overlay', build: () => [createHyperframesOverlay(i, 0)], duration: i.duration, frame: { width: i.dimensions.width, height: i.dimensions.height }, image: thumbOf(i.id) };
  hfCache.set(i.id, p);
  return p;
}

const aspectOf = (w: number, h: number) => (Math.abs(w - h) < 8 ? '1:1' : w > h ? '16:9' : '9:16');

/** Animations library (HyperFrames). `onPick` is called when a card is clicked. */
export function hfEntries(items: HfItem[], onPick: (i: HfItem) => void): CatalogEntry[] {
  return items.map((i) => ({ id: `hf:${i.id}`, tab: 'animations' as const, label: i.title, blurb: `${i.duration.toFixed(0)}s · ${aspectOf(i.dimensions.width, i.dimensions.height)}${i.slow ? ' · slower export' : ''}`, badge: 'Animation', preview: hfPreview(i), run: () => onPick(i), keywords: `${i.description} ${i.tags.join(' ')} ${i.id}`, testId: `animation-${i.id}` }));
}
/** Motion graphics templates. Only templates the code gate accepts are offered. */
export function mgEntries(templates: MgTemplate[], onPick: (t: MgTemplate) => void): CatalogEntry[] {
  return templates.filter((t) => t.usable).map((t) => ({ id: `mg:${t.id}`, tab: 'motion' as const, label: t.name, blurb: `${t.category} · ${t.width}×${t.height} · ${(t.durationInFrames / t.fps).toFixed(1)}s`, badge: 'Motion graphic', preview: mgPreview(t), run: () => onPick(t), keywords: `${t.description ?? ''} ${t.category}`, testId: `mg-${t.id}` }));
}

/** Basic overlays and End screen / Connect form templates (single-click items). Smart Speech, Template Generator and Personalization have their own modals and are not here. */
export function buildCatalog(a: Pick<AddToTimelineActions, 'onAddKind' | 'onAddTemplate'>, ui: { close: () => void; askPhone: (templateId: string) => void }): CatalogEntry[] {
  const list: CatalogEntry[] = [];
  for (const k of OVERLAY_KINDS) list.push({ id: k.kind, tab: 'overlays', label: k.label, blurb: k.blurb, badge: 'Overlay', preview: kindPreview(k.kind), run: () => { a.onAddKind(k.kind); ui.close(); }, testId: `add-${k.kind}` });
  for (const t of overlayTemplates()) {
    const connect = isConnectTemplate(t.id);
    list.push({ id: `tpl:${t.id}`, tab: 'endscreens', label: t.name, blurb: t.description, badge: connect ? 'Connect form' : 'End screen', preview: templatePreview(t.id), run: () => { if (connect) ui.askPhone(t.id); else { a.onAddTemplate(t.id); ui.close(); } }, testId: `add-tpl:${t.id}` });
  }
  return list;
}

/** The Library sidebar (a sibling of the timeline) opens the modal through this window event; TimelineEditor listens for it. */
export const OPEN_ADD_MODAL_EVENT = 'cinegen:open-add-to-timeline';
/** True when the editor took the event (it calls preventDefault); false when no timeline editor is mounted to open the window. */
export const openAddToTimeline = (): boolean => !window.dispatchEvent(new CustomEvent(OPEN_ADD_MODAL_EVENT, { cancelable: true }));
