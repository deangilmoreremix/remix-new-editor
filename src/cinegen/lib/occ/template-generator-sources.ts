// [remix] The Template Generator's extra media libraries inside the Timeline Studio Editor: Animations (HyperFrames + RemotionUI),
// Motion graphics templates, and End screens / lead forms. The wizard is plain JS, so each library is a small adapter:
//   search()        → cards for the grid (paged, filtered by category, searched by text)
//   resolve(ref)    → the real overlay (or template) that is placed on the overlay lane when the generator adds its composition
//   mountPreview()  → the same sandboxed live preview the Animations / Motion graphics modals use (never run in the page itself)
// The generator keeps only a small reference to what was picked, so saved templates stay light and pick up library updates.
import { hyperframesItems, hyperframesItem, createHyperframesOverlay, hyperframesOverlayLayer, hfGroupOf, type HfItem } from '@cinegen/lib/hyperframes/overlay';
import { loadMgTemplates, createMgOverlay, mgOverlayLayer, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { overlayTemplates, isConnectTemplate } from '@cinegen/lib/overlays/overlays';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS flag module
import { isHyperframesEnabled } from '../../../lib/hyperframes/featureFlag.js';

const FPS = 30;
const PER_PAGE = 24;

export interface GeneratorCard { id: string; kind: 'animation'; source: string; title: string; description?: string; badge: string; category: string; duration: number; placeAt?: 'spread' | 'end'; glyph?: string; poster?: string }
export interface GeneratorSource {
  id: string; label: string; blurb: string; group?: string; filters: Array<[string, string]>;
  search: (q: { query: string; filter: string; page: number }) => Promise<{ items: GeneratorCard[]; hasMore: boolean }>;
  resolve: (ref: { id: string }) => Promise<{ overlay?: OverlayClip; templateId?: string }>;
  mountPreview?: (host: HTMLElement, item: GeneratorCard) => () => void;
}

const GLYPH: Record<string, string> = { 'Lower thirds': '▭', 'Titles & text': 'T', 'Social & UI': '◎', 'Data & charts': '▤', Code: '</>', Transitions: '⇄', 'Backgrounds & effects': '▨', Scenes: '▣', Primitives: '◇', Compositions: '▶', 'Data & media': '♪', 'Paths & shapes': '✎', 'Motion graphics': '✺', 'Maps & device': '⌖', '3D': '◈', Shaders: '◐' };
const matches = (q: string, ...parts: Array<string | undefined>) => !q || parts.join(' ').toLowerCase().includes(q.toLowerCase());
const page = <T,>(list: T[], n: number) => ({ items: list.slice((n - 1) * PER_PAGE, n * PER_PAGE), hasMore: list.length > n * PER_PAGE });

/** A live, looping preview of one overlay layer in the editor's sandboxed code-preview frame. */
function mountLayerPreview(host: HTMLElement, build: () => { layer: { durationInFrames: number }; width: number; height: number }): () => void {
  let live = true; let timer = 0;
  let handle: { update: (m: unknown) => Promise<void>; frame: (f: number) => void; destroy: () => void } | null = null;
  void import('../../../lib/editor/remotion/codePreviewClient.js').then(async ({ createCodePreview }: { createCodePreview: (h: HTMLElement) => NonNullable<typeof handle> }) => {
    if (!live) return;
    const { layer, width, height } = build();
    handle = createCodePreview(host);
    await handle.update({ version: 1, fps: FPS, width, height, durationInFrames: layer.durationInFrames, background: 'transparent', layers: [layer], audio: [], transitions: [], fonts: [] });
    let f = 0; timer = window.setInterval(() => { f = (f + 1) % layer.durationInFrames; handle?.frame(f); }, 1000 / FPS);
  }).catch(() => { /* the glyph stays as the preview */ });
  return () => { live = false; window.clearInterval(timer); handle?.destroy(); };
}

const hfCard = (i: HfItem): GeneratorCard => ({
  id: `anim:${i.id}`, kind: 'animation', source: 'animations', title: i.title, description: i.description,
  badge: i.type === 'example' ? 'SCENE' : i.type === 'component' ? 'COMPONENT' : 'ANIMATION', category: hfGroupOf(i), duration: i.duration, glyph: GLYPH[hfGroupOf(i)] ?? '✺',
});

export function animationsSource(): GeneratorSource | null {
  if (!isHyperframesEnabled()) return null; // the library is hidden (QA switch) → don't offer it here either
  const all = hyperframesItems();
  const groups = [...new Set(all.map(hfGroupOf))];
  return {
    id: 'animations', label: 'Animations', group: 'Motion & templates',
    blurb: 'Animated lower thirds, titles, charts, social cards and scenes (HyperFrames + RemotionUI).',
    filters: [['all', 'All'], ...groups.map((g): [string, string] => [g, g])],
    async search({ query, filter, page: n }) { return page(all.filter((i) => (filter === 'all' || hfGroupOf(i) === filter) && matches(query, i.title, i.description, i.tags.join(' '), i.id)).map(hfCard), n); },
    async resolve(ref) {
      const item = hyperframesItem(ref.id.replace(/^anim:/, ''));
      if (!item) throw new Error('Animation not found');
      return { overlay: createHyperframesOverlay(item, 0) };
    },
    mountPreview: (host, card) => mountLayerPreview(host, () => {
      const item = hyperframesItem(card.id.replace(/^anim:/, ''))!;
      return { layer: hyperframesOverlayLayer(createHyperframesOverlay(item, 0), FPS), width: item.dimensions.width, height: item.dimensions.height };
    }),
  };
}

const mgCard = (t: MgTemplate): GeneratorCard => ({
  id: `mg:${t.id}`, kind: 'animation', source: 'motion', title: t.name, description: t.description, badge: 'MOTION GRAPHIC', category: t.category,
  duration: Math.round((t.durationInFrames / t.fps) * 10) / 10, glyph: '✺', // the pack's own thumbnails are blank placeholders, so these cards use the glyph tile like the library modal's text cards
});

export function motionGraphicsSource(): GeneratorSource {
  const usable = () => loadMgTemplates().then((all) => all.filter((t) => t.usable));
  return {
    id: 'motion', label: 'Motion graphics', group: 'Motion & templates',
    blurb: 'Ready-made motion-graphics templates: titles, counters, callouts and social shorts.',
    filters: [['all', 'All'], ['title', 'Titles'], ['social', 'Social'], ['data', 'Data']],
    async search({ query, filter, page: n }) {
      const all = await usable();
      const inFilter = (t: MgTemplate) => filter === 'all' || `${t.category} ${t.name}`.toLowerCase().includes(filter);
      return page(all.filter((t) => inFilter(t) && matches(query, t.name, t.description, t.category)).map(mgCard), n);
    },
    async resolve(ref) {
      const t = (await usable()).find((x) => `mg:${x.id}` === ref.id);
      if (!t) throw new Error('Template not found');
      return { overlay: createMgOverlay(t, 0) };
    },
    mountPreview: (host, card) => mountLayerPreview(host, () => ({ layer: { durationInFrames: Math.max(1, Math.round(card.duration * FPS)) }, width: 1920, height: 1080 })),
  };
}

export function endScreensSource(): GeneratorSource {
  // Connect forms ask for the viewer's phone number, which the wizard can't collect: the timeline's own overlay menu still offers them.
  const all = overlayTemplates().filter((t) => !isConnectTemplate(t.id));
  const card = (t: (typeof all)[number]): GeneratorCard => ({
    id: `tpl:${t.id}`, kind: 'animation', source: 'endscreens', title: t.name.replace(/^[^:]+:\s*/, ''), description: t.description,
    badge: t.library === 'endScreens' ? 'END SCREEN' : 'FORM', category: t.library, duration: t.library === 'endScreens' ? 6 : 8,
    placeAt: t.library === 'endScreens' ? 'end' : 'spread', glyph: t.library === 'endScreens' ? '⏹' : '▭',
  });
  const libs = [...new Set(all.map((t) => t.library))];
  return {
    id: 'endscreens', label: 'End screens & forms', group: 'Motion & templates',
    blurb: 'End screens, calls to action and lead forms, placed at the end of your video or where they fit.',
    filters: [['all', 'All'], ...libs.map((l): [string, string] => [l, l === 'endScreens' ? 'End screens' : 'Lead forms'])],
    async search({ query, filter, page: n }) { return page(all.filter((t) => (filter === 'all' || t.library === filter) && matches(query, t.name, t.description)).map(card), n); },
    async resolve(ref) { return { templateId: ref.id.replace(/^tpl:/, '') }; },
  };
}

/** Everything the generator can offer in this editor (the Animations library only when it is switched on). */
export function buildGeneratorSources(): GeneratorSource[] {
  // the motion-graphics pack is checked through the code gate once (a couple of seconds): start now so it is ready when the user opens it
  void loadMgTemplates().catch(() => undefined);
  return [animationsSource(), motionGraphicsSource(), endScreensSource()].filter((s): s is GeneratorSource => !!s);
}
