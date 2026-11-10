// [hyperframes] HyperFrames catalog animations as an additive overlay kind. Modelled on lib/occ/mg-templates.ts
// (library pick -> overlay on the lane -> sandboxed preview -> export), and OFF unless the feature flag is on.
// Only verified, pinned catalog items (src/lib/hyperframes/catalog.enabled.json) can be added.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JSON from the main app's lib
import enabledJson from '../../../lib/hyperframes/catalog.enabled.json';

export interface HfEditable {
  key: string; label: string; type: 'text' | 'color'; defaultValue: string;
  /** Where the value goes in the block, as an SDK-style OverrideSet entry: `<hfId>.text`, `<hfId>.style.<prop>`, `<hfId>.attr.<name>`. */
  target: { hfId: string; kind: 'text' | 'style' | 'attr'; prop?: string };
}
export interface HfItem {
  id: string; title: string; description: string; tags: string[]; category: string;
  dimensions: { width: number; height: number }; duration: number; sourceSha256: string; editables: HfEditable[];
}

export const hyperframesItems = (): HfItem[] => (enabledJson as { items: HfItem[] }).items;
export const hyperframesItem = (id: string): HfItem | undefined => hyperframesItems().find((i) => i.id === id);

/** Search over title, description, tags and id; `tag` narrows to one category tag. */
export function searchHyperframes(items: HfItem[], query: string, tag = 'all'): HfItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (tag === 'all' || i.tags.includes(tag) || i.category === tag) && (!q || `${i.title} ${i.description} ${i.tags.join(' ')} ${i.id}`.toLowerCase().includes(q)));
}

export function createHyperframesOverlay(item: HfItem, startSec: number): OverlayClip {
  const id = `hf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const start = Math.max(0, startSec);
  const props: Record<string, string> = {};
  for (const e of item.editables) props[e.key] = e.defaultValue;
  return {
    id, type: 'hyperframes', name: item.title, start, end: start + Math.max(1, item.duration),
    blockId: item.id, hfSchema: 1, props,
    propSchema: item.editables.map((e) => ({ key: e.key, label: e.label, type: e.type, defaultValue: e.defaultValue })),
    blockWidth: item.dimensions.width, blockHeight: item.dimensions.height,
  };
}

/** Sparse OverrideSet from the overlay's edited props (only values that differ from the master's defaults). */
export function overridesFromProps(item: HfItem, props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of item.editables) {
    const v = props[e.key];
    if (typeof v !== 'string' || v === e.defaultValue) continue;
    const { hfId, kind, prop } = e.target;
    out[kind === 'text' ? `${hfId}.text` : kind === 'style' ? `${hfId}.style.${prop}` : `${hfId}.attr.${prop}`] = v;
  }
  return out;
}

/** Composition layer for an overlay (export + the sandbox preview frame). Unknown / non-enabled blocks yield a layer that renders nothing. */
export function hyperframesOverlayLayer(o: OverlayClip, fps: number) {
  const item = hyperframesItem(String(o.blockId ?? ''));
  const from = Math.round(o.start * fps);
  return {
    id: o.id, kind: 'hyperframes', trackIndex: 99, from, durationInFrames: Math.max(1, Math.round((o.end - o.start) * fps)), effects: [],
    blockId: String(o.blockId ?? ''), overrides: item ? overridesFromProps(item, (o.props as Record<string, unknown>) ?? {}) : {},
    blockWidth: Number(o.blockWidth) || 1920, blockHeight: Number(o.blockHeight) || 1080, title: o.name,
  };
}
