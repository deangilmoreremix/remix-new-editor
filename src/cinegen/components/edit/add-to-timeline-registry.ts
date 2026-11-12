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
  onOpenGenerator?: () => void;
  onOpenPersonalization?: () => void;
}

export type CatalogTab = 'ai' | 'overlays' | 'endscreens';
export interface CatalogEntry { id: string; tab: CatalogTab; label: string; blurb: string; badge: string; preview: CardPreview; run: () => void }

/** Overlay clips of a preview, moved so the first one starts at 0 (end-screen templates are anchored to the timeline end). */
function fromZero(clips: OverlayClip[]): OverlayClip[] {
  const t0 = Math.min(...clips.map((c) => c.start));
  return clips.map((c) => ({ ...c, start: c.start - t0, end: c.end - t0 }));
}
const spanOf = (clips: OverlayClip[]) => Math.max(1, ...clips.map((c) => c.end));

const kindPreview = (kind: OverlayKind): CardPreview => {
  const make = () => fromZero([createOverlay(kind, 0, 6)]);
  const d = spanOf(make());
  // forms are shown at once; animated overlays are shown a little way in
  return { kind: 'overlay', build: make, duration: d, still: kind === 'lead-form' || kind === 'list-builder' ? 0.2 : Math.min(d * 0.5, 2.5) };
};
const templatePreview = (id: string): CardPreview => {
  const make = () => fromZero(createTemplateOverlays(id, 0, 10));
  const d = spanOf(make());
  return { kind: 'overlay', build: make, duration: d, still: Math.min(d * 0.6, 3) };
};

/** Looping demo clip for Personalization (a local file the demo library already ships). */
const PERSONALIZE_DEMO: CardPreview = { kind: 'video', src: '/media/awesome-seedance/videos/adam.mp4', poster: '/media/awesome-seedance/previews/adam.webp' };

const mgCache = new WeakMap<MgTemplate, CardPreview>();
export function mgPreview(t: MgTemplate): CardPreview {
  const hit = mgCache.get(t); if (hit) return hit;
  const base = t.thumb ? t.thumb.split('/').pop() : undefined;
  const dur = t.durationInFrames / t.fps;
  const p: CardPreview = { kind: 'overlay', build: () => [createMgOverlay(t, 0)], duration: dur, frame: { width: t.width, height: t.height }, still: dur * 0.5, image: base ? `/occ-templates/thumbs/${base}` : undefined };
  mgCache.set(t, p);
  return p;
}
const hfCache = new Map<string, CardPreview>();
export function hfPreview(i: HfItem): CardPreview {
  const hit = hfCache.get(i.id); if (hit) return hit;
  const p: CardPreview = { kind: 'overlay', build: () => [createHyperframesOverlay(i, 0)], duration: i.duration, frame: { width: i.dimensions.width, height: i.dimensions.height }, image: `/hyperframes/thumbs/${i.id.replace(':', '-')}.jpg` };
  hfCache.set(i.id, p);
  return p;
}

/** AI & personalization, basic overlays, and End screen / Connect form templates. Animations and Motion graphics are catalogs of their own (mgPreview / hfPreview). */
export function buildCatalog(a: AddToTimelineActions, ui: { close: () => void; askPhone: (templateId: string) => void }): CatalogEntry[] {
  const list: CatalogEntry[] = [];
  if (a.onOpenGenerator) list.push({ id: 'generator', tab: 'ai', label: 'Template Generator', blurb: 'Generate a templated video or overlay from a prompt.', badge: 'AI', preview: { kind: 'art', art: 'generator' }, run: a.onOpenGenerator });
  if (a.onOpenPersonalization) list.push({ id: 'personalize', tab: 'ai', label: 'Personalization', blurb: 'Personalize the video for each contact.', badge: 'Video', preview: PERSONALIZE_DEMO, run: a.onOpenPersonalization });
  for (const k of OVERLAY_KINDS) list.push({ id: k.kind, tab: 'overlays', label: k.label, blurb: k.blurb, badge: 'Overlay', preview: kindPreview(k.kind), run: () => { a.onAddKind(k.kind); ui.close(); } });
  for (const t of overlayTemplates()) {
    const connect = isConnectTemplate(t.id);
    list.push({ id: `tpl:${t.id}`, tab: 'endscreens', label: t.name, blurb: t.description, badge: connect ? 'Connect form' : 'End screen', preview: templatePreview(t.id), run: () => { if (connect) ui.askPhone(t.id); else { a.onAddTemplate(t.id); ui.close(); } } });
  }
  return list;
}
