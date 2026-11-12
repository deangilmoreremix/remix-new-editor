// [hyperframes] HyperFrames catalog animations as an additive overlay kind. Modelled on lib/occ/mg-templates.ts
// (library pick -> overlay on the lane -> sandboxed preview -> export), and OFF unless the feature flag is on.
// Only verified, pinned catalog items (src/lib/hyperframes/catalog.enabled.json) can be added.
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JSON from the main app's lib
import enabledJson from '../../../lib/hyperframes/catalog.enabled.json';
// @ts-expect-error plain JSON from the main app's lib
import disabledJson from '../../../lib/hyperframes/catalog.disabled.json';
// @ts-expect-error plain JS flag module
import { isHyperframesRuntimeDisabled } from '../../../lib/hyperframes/featureFlag.js';

// @ts-expect-error plain JSON from the main app's lib
import ruiJson from '../../../lib/remotionui/catalog.json';

export interface HfEditable {
  key: string; label: string; type: 'text' | 'color' | 'number' | 'boolean' | 'select'; defaultValue: string | number | boolean;
  min?: number; max?: number; step?: number; options?: Array<string | { value: string; label?: string }>;
  /** Where the value goes in the block, as an OverrideSet entry: `<hfId>.text`, `<hfId>.style.<prop>`, `<hfId>.attr.<name>`, or `cfg.<path>` (a leaf of the block's published `var CONFIG` object), or `var.<id>` (a declared composition variable). */
  target: { hfId?: string; kind: 'text' | 'style' | 'attr' | 'cfg' | 'var' | 'prop'; prop?: string; path?: string; id?: string };
}
export interface HfItem {
  id: string; type?: 'block' | 'component' | 'example' | 'remotionui'; source?: 'HyperFrames' | 'RemotionUI'; title: string; description: string; tags: string[]; category: string;
  dimensions: { width: number; height: number }; duration: number; sourceSha256: string; editables: HfEditable[];
  /** Exports this animation noticeably slower than most (measured in the browser exporter); shown as a note on the card. */
  slow?: boolean;
}

interface RuiRaw { id: string; title: string; description: string; tags: string[]; category: string; dimensions: { width: number; height: number }; duration: number; sourceSha256: string; enabled: boolean; slow?: boolean; editables: Array<Omit<HfEditable, 'target'>> }
/** RemotionUI items (vendored, MIT). Same overlay kind as HyperFrames; `blockId` is `rui:<name>`; the editable fields are the component's own props. */
const ruiToItem = (r: RuiRaw): HfItem => ({
  id: r.id, type: 'remotionui', source: 'RemotionUI', title: r.title, description: r.description, tags: r.tags, category: r.category, dimensions: r.dimensions, duration: r.duration, sourceSha256: r.sourceSha256, slow: r.slow,
  editables: r.editables.map((e) => ({ ...e, target: { kind: 'prop', id: e.key } })),
});
const ruiAll: HfItem[] = ((ruiJson as { items: RuiRaw[] }).items).map(ruiToItem);
const ruiEnabled = new Set(((ruiJson as { items: RuiRaw[] }).items).filter((r) => r.enabled).map((r) => r.id));
const catalogDisabled = new Set<string>((disabledJson as { ids: string[] }).ids ?? []);
/** Items a customer can ADD (library). Catalog-disabled ids are hidden here but still resolve below, so saved projects keep working. */
export const hyperframesItems = (): HfItem[] => [...(enabledJson as { items: HfItem[] }).items.filter((i) => !catalogDisabled.has(i.id)).map((i) => ({ ...i, source: 'HyperFrames' as const })), ...ruiAll.filter((i) => ruiEnabled.has(i.id) && !catalogDisabled.has(i.id))];
/** Every pinned item, including catalog-disabled ones: used to render and export what is already in a project. */
export const hyperframesItem = (id: string): HfItem | undefined => (id.startsWith('rui:') ? ruiAll.find((i) => i.id === id) : (enabledJson as { items: HfItem[] }).items.find((i) => i.id === id));
export const isCatalogDisabled = (id: string): boolean => catalogDisabled.has(id);

/** The catalog has 24 raw categories; libraries show a handful of customer-friendly groups (display only, the catalog data is unchanged). */
export const HF_GROUPS: Array<[string, string[]]> = [
  ['Lower thirds', ['lower-third', 'broadcast']],
  ['Titles & text', ['handwritten', 'typography', 'annotation', 'branding', 'logo']],
  ['Social & UI', ['social', 'showcase', 'video-primitive']],
  ['Data & charts', ['data', 'data-viz', 'diagram', 'instrument']],
  ['Code', ['code']],
  ['Transitions', ['transition']],
  ['Backgrounds & effects', ['background', 'snow', 'starfield', 'vfx', 'camcorder', 'motion-primitive', 'placeholder']],
];
/** Customer-facing group of an item. RemotionUI items already carry friendly categories and are shown as they are. */
export const hfGroupOf = (i: HfItem): string => (i.type === 'remotionui' ? i.category : (HF_GROUPS.find(([, cats]) => cats.includes(i.category))?.[0] ?? 'More'));

/** Search over title, description, tags and id; `tag` narrows to one category tag. */
export function searchHyperframes(items: HfItem[], query: string, tag = 'all'): HfItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (tag === 'all' || i.tags.includes(tag) || i.category === tag) && (!q || `${i.title} ${i.description} ${i.tags.join(' ')} ${i.id}`.toLowerCase().includes(q)));
}

export function createHyperframesOverlay(item: HfItem, startSec: number): OverlayClip {
  const id = `hf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const start = Math.max(0, startSec);
  const props: Record<string, string | number | boolean> = {};
  for (const e of item.editables) props[e.key] = e.defaultValue;
  return {
    id, type: 'hyperframes', name: item.title, start, end: start + Math.max(1, item.duration),
    blockId: item.id, hfSchema: 1, props,
    propSchema: item.editables.map((e) => ({ key: e.key, label: e.label, type: e.type, defaultValue: e.defaultValue, min: e.min, max: e.max, step: e.step, options: e.options })),
    blockWidth: item.dimensions.width, blockHeight: item.dimensions.height,
  };
}

/** Sparse OverrideSet from the overlay's edited props (only values that differ from the master's defaults). */
export function overridesFromProps(item: HfItem, props: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const e of item.editables) {
    const v = props[e.key];
    if (v === undefined || v === e.defaultValue || typeof v !== typeof e.defaultValue) continue;
    const { hfId, kind, prop, path, id } = e.target;
    if (kind === 'prop') { if (id) out[id] = v as string | number | boolean; continue; }
    if (kind === 'var') { if (id) out[`var.${id}`] = v as string | number | boolean; continue; }
    if (kind === 'cfg') { if (path) out[`cfg.${path}`] = v as string | number | boolean; continue; }
    if (typeof v !== 'string' || !hfId) continue;
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
    ...(isHyperframesRuntimeDisabled() ? { runtimeDisabled: true } : {}),
  };
}
