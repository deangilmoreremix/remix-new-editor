// [remix] The Template Generator's extra media libraries inside the Timeline Studio Editor: Animations (HyperFrames + RemotionUI),
// Motion graphics templates, and End screens / lead forms. The wizard is plain JS, so each library is a small adapter:
//   search()        → cards for the grid (paged, filtered by category, searched by text)
//   resolve(ref)    → the real overlay (or template) that is placed on the overlay lane when the generator adds its composition
//   mountPreview()  → the same sandboxed live preview the Animations / Motion graphics modals use (never run in the page itself)
// The generator keeps only a small reference to what was picked, so saved templates stay light and pick up library updates.
import { hyperframesItems, hyperframesItem, createHyperframesOverlay, hyperframesOverlayLayer, hfGroupOf, type HfItem } from '@cinegen/lib/hyperframes/overlay';
import { loadMgTemplates, createMgOverlay, mgOverlayLayer, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { overlayTemplates, isConnectTemplate } from '@cinegen/lib/overlays/overlays';
import { hfThumb, mgThumb, tplThumb } from '@cinegen/lib/occ/template-thumbs';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JSON written by scripts/generate-template-generator-thumbs.mjs
import blocklistJson from '@cinegen/lib/occ/mg-render-blocklist.json';
// @ts-expect-error plain JS flag module
import { isHyperframesEnabled } from '../../../lib/hyperframes/featureFlag.js';

import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { ensureSampleFrame } from '../../../openchatcut/gl/sampleFrames';
import {
  transitionThumbUrlAsync, drawTransitionFrame, acquireTransitionThumbRuntime, releaseTransitionThumbRuntime,
  THUMB_W, THUMB_H, HOVER_DURATION_MS, HOVER_HOLD_FRACTION,
} from '../../../openchatcut/gl/transitionThumb';
import type { GlslTransitionType } from '../../../openchatcut/types';

const FPS = 30;
const PER_PAGE = 24;

export interface GeneratorCard { id: string; kind: 'animation'; source: string; title: string; description?: string; badge: string; category: string; duration: number; needsPhone?: boolean; placeAt?: 'spread' | 'end'; glyph?: string; /** real still of the animation (made by scripts/generate-template-generator-thumbs.mjs) */ poster: string; ratio?: number }
export interface GeneratorSource {
  id: string; label: string; blurb: string; group?: string; filters: Array<[string, string]>;
  search: (q: { query: string; filter: string; page: number }) => Promise<{ items: GeneratorCard[]; hasMore: boolean }>;
  resolve: (ref: { id: string; call?: { phone: string; country?: string; buttonText?: string } }) => Promise<{ overlay?: OverlayClip; templateId?: string; call?: { phone: string; country?: string; buttonText?: string } }>;
  mountPreview?: (host: HTMLElement, item: GeneratorCard) => () => void;
}

const GLYPH: Record<string, string> = { 'Lower thirds': '▭', 'Titles & text': 'T', 'Social & UI': '◎', 'Data & charts': '▤', Code: '</>', Transitions: '⇄', 'Backgrounds & effects': '▨', Scenes: '▣', Primitives: '◇', Compositions: '▶', 'Data & media': '♪', 'Paths & shapes': '✎', 'Motion graphics': '✺', 'Maps & device': '⌖', '3D': '◈', Shaders: '◐' };
const matches = (q: string, ...parts: Array<string | undefined>) => !q || parts.join(' ').toLowerCase().includes(q.toLowerCase());
const page = <T,>(list: T[], n: number) => ({ items: list.slice((n - 1) * PER_PAGE, n * PER_PAGE), hasMore: list.length > n * PER_PAGE });

/** A live, looping preview of one overlay layer in the editor's sandboxed code-preview frame. */
function mountLayerPreview(host: HTMLElement, build: () => { layer: { durationInFrames: number }; width: number; height: number } | Promise<{ layer: { durationInFrames: number }; width: number; height: number }>): () => void {
  let live = true; let timer = 0;
  let handle: { update: (m: unknown) => Promise<void>; frame: (f: number) => void; destroy: () => void } | null = null;
  void import('../../../lib/editor/remotion/codePreviewClient.js').then(async ({ createCodePreview }: { createCodePreview: (h: HTMLElement) => NonNullable<typeof handle> }) => {
    if (!live) return;
    const { layer, width, height } = await build();
    if (!live) return;
    handle = createCodePreview(host);
    await handle.update({ version: 1, fps: FPS, width, height, durationInFrames: layer.durationInFrames, background: 'transparent', layers: [layer], audio: [], transitions: [], fonts: [] });
    let f = 0; timer = window.setInterval(() => { f = (f + 1) % layer.durationInFrames; handle?.frame(f); }, 1000 / FPS);
  }).catch(() => { /* the glyph stays as the preview */ });
  return () => { live = false; window.clearInterval(timer); handle?.destroy(); };
}

const hfCard = (i: HfItem): GeneratorCard => ({
  id: `anim:${i.id}`, kind: 'animation', source: 'animations', title: i.title, description: i.description,
  badge: i.type === 'example' ? 'SCENE' : i.type === 'component' ? 'COMPONENT' : 'ANIMATION', category: hfGroupOf(i), duration: i.duration, glyph: GLYPH[hfGroupOf(i)] ?? '✺',
  poster: hfThumb(i.id), ratio: i.dimensions.width / i.dimensions.height,
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
  duration: Math.round((t.durationInFrames / t.fps) * 10) / 10, glyph: '✺', poster: mgThumb(t.id), ratio: t.width / t.height,
});

export function motionGraphicsSource(): GeneratorSource {
  // templates the code gate accepts but the sandboxed renderer draws as nothing are not offered (list kept by the thumbnail script)
  const blocked = new Set(Object.keys((blocklistJson as { ids?: Record<string, string> }).ids ?? {}));
  const usable = () => loadMgTemplates().then((all) => all.filter((t) => t.usable && !blocked.has(t.id)));
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
    mountPreview: (host, card) => mountLayerPreview(host, async () => {
      const t = (await usable()).find((x) => `mg:${x.id}` === card.id);
      if (!t) throw new Error('Template not found');
      return { layer: mgOverlayLayer(createMgOverlay(t, 0), FPS), width: t.width, height: t.height };
    }),
  };
}

export function endScreensSource(): GeneratorSource {
  // Connect forms are click-to-call buttons: the wizard's "Call button" panel collects the business's own number before they are added.
  const all = overlayTemplates();
  const card = (t: (typeof all)[number]): GeneratorCard => ({
    id: `tpl:${t.id}`, kind: 'animation', source: 'endscreens', title: t.name.replace(/^[^:]+:\s*/, ''), description: t.description,
    badge: t.library === 'endScreens' ? 'END SCREEN' : isConnectTemplate(t.id) ? 'CALL' : 'FORM', category: t.library, duration: t.library === 'endScreens' ? 6 : 8,
    ...(isConnectTemplate(t.id) ? { needsPhone: true } : {}),
    placeAt: t.library === 'endScreens' ? 'end' : 'spread', glyph: t.library === 'endScreens' ? '⏹' : '▭', poster: tplThumb(t.id), ratio: 16 / 9,
  });
  const libs = [...new Set(all.map((t) => t.library))];
  return {
    id: 'endscreens', label: 'End screens & forms', group: 'Motion & templates',
    blurb: 'End screens, calls to action and lead forms, placed at the end of your video or where they fit.',
    filters: [['all', 'All'], ...libs.map((l): [string, string] => [l, l === 'endScreens' ? 'End screens' : l === 'connect' ? 'Call buttons' : 'Lead forms'])],
    async search({ query, filter, page: n }) { return page(all.filter((t) => (filter === 'all' || t.library === filter) && matches(query, t.name, t.description)).map(card), n); },
    async resolve(ref) { return { templateId: ref.id.replace(/^tpl:/, ''), ...(ref.call?.phone ? { call: ref.call } : {}) }; },
    /** The template window's own preview: the real overlays, animated, over the same backdrop the window uses. */
    mountPreview(host, item) {
      let dead = false; let engine: { play: () => void; seekToFrame: (f: number) => void; destroy: () => void } | null = null;
      void (async () => {
        const [{ createPreviewEngine }, { timelineToComposition }, lib, { presetToClips }] = await Promise.all([
          import('../../../lib/editor/remotion/previewEngine.jsx'),
          import('../../../lib/editor/remotion/timelineToComposition.js'),
          import('../../../lib/editor/addons/templateLibrary.js'),
          import('../../../lib/editor/addons/overlayPresets.js'),
          import('../../../lib/editor/addons/index.js'),
        ]) as unknown as [{ createPreviewEngine: (h: HTMLElement, o: unknown) => typeof engine }, { timelineToComposition: (p: unknown, o: unknown) => unknown }, { getTemplate: (id: string) => unknown; templatePreviewProject: (t: unknown, f: unknown) => unknown }, { presetToClips: unknown }];
        if (dead) return;
        const tpl = lib.getTemplate(item.id.replace(/^tpl:/, ''));
        if (!tpl) return;
        const model = timelineToComposition(lib.templatePreviewProject(tpl, presetToClips), { quality: '720p' });
        engine = createPreviewEngine(host, { model, onReady: () => engine?.play(), onEnded: () => { engine?.seekToFrame(0); engine?.play(); } });
      })().catch(() => { /* the still stays as the preview */ });
      return () => { dead = true; try { engine?.destroy(); } catch { /* ignore */ } };
    },
  };
}

/** Everything the generator can offer in this editor (the Animations library only when it is switched on). */
export function buildGeneratorSources(): GeneratorSource[] {
  // the motion-graphics pack is checked through the code gate once (a couple of seconds): start now so it is ready when the user opens it
  void loadMgTemplates().catch(() => undefined);
  return [animationsSource(), motionGraphicsSource(), endScreensSource()].filter((s): s is GeneratorSource => !!s);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Real transitions for the Overlay step: the editor's own GL transitions (what the timeline actually renders), in categories, with the
// same real A/B preview the Transitions window shows. The picked id is carried into the timeline (template-composition.ts → glType).
export interface GeneratorTransition {
  id: string; label: string; category: 'fade' | 'wipe' | 'motion'; description: string;
  /** real still (a data URL) of the transition half-way through, or '' when it cannot be drawn */
  thumb: () => Promise<string>;
  /** plays the real transition into `host` (a loop of clip A → clip B); returns a function that stops it */
  mountPreview: (host: HTMLElement) => () => void;
}

const TRANSITION_META: Record<string, { category: GeneratorTransition['category']; description: string }> = {
  'cross-dissolve': { category: 'fade', description: 'A smooth cross-fade between the two clips.' },
  'dip-to-black': { category: 'fade', description: 'Fades out through black, then into the next clip.' },
  'dip-to-color': { category: 'fade', description: 'Fades out through a colour, then into the next clip.' },
  flash: { category: 'fade', description: 'A bright flash covers the cut.' },
  'luma-blend': { category: 'fade', description: 'Bright areas blend first, for a glowing mix.' },
  'organic-dissolve': { category: 'fade', description: 'A soft, light-leak style dissolve.' },
  'clean-line-wipe': { category: 'wipe', description: 'A thin white line sweeps across and reveals the next clip.' },
  'soft-wipe': { category: 'wipe', description: 'A feathered edge wipes to the next clip.' },
  'circle-wipe': { category: 'wipe', description: 'A circle opens up on the next clip.' },
  'page-curl': { category: 'wipe', description: 'The clip peels away like a page.' },
  'anticipation-zoom': { category: 'motion', description: 'Pushes in, then breaks through to the next clip.' },
  'whip-pan': { category: 'motion', description: 'A fast camera whip with motion blur.' },
  'impact-shake': { category: 'motion', description: 'A hard shake on the cut.' },
  'radial-blur': { category: 'motion', description: 'A spinning blur carries you to the next clip.' },
  'rack-focus': { category: 'motion', description: 'Focus shifts from one clip to the other.' },
  'glitch-cut': { category: 'motion', description: 'A digital glitch on the cut.' },
};

const hoverProgress = (elapsed: number) => {
  const c = (elapsed % HOVER_DURATION_MS) / HOVER_DURATION_MS;
  return c < HOVER_HOLD_FRACTION ? 0 : c > 1 - HOVER_HOLD_FRACTION ? 1 : (c - HOVER_HOLD_FRACTION) / (1 - 2 * HOVER_HOLD_FRACTION);
};

export function generatorTransitions(): GeneratorTransition[] {
  return GL_TRANSITION_ORDER.map((id) => {
    const meta = TRANSITION_META[id] ?? { category: 'fade' as const, description: '' };
    return {
      id, label: glTransitionLabel(id), category: meta.category, description: meta.description,
      thumb: async () => { try { return await transitionThumbUrlAsync(id as GlslTransitionType); } catch { return ''; } },
      mountPreview: (host: HTMLElement) => {
        let raf = 0; let dead = false; let held = false;
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_W; canvas.height = THUMB_H; canvas.className = 'tg-tr-live';
        host.appendChild(canvas);
        void Promise.all([ensureSampleFrame('out'), ensureSampleFrame('in')]).then(() => {
          if (dead) return;
          acquireTransitionThumbRuntime(); held = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            if (dead) return;
            if (!drawTransitionFrame(canvas, id as GlslTransitionType, hoverProgress(now - t0))) { canvas.remove(); return; } // cannot draw: the still stays
            raf = requestAnimationFrame(tick);
          };
          tick(t0);
        }).catch(() => canvas.remove());
        return () => { dead = true; cancelAnimationFrame(raf); canvas.remove(); if (held) releaseTransitionThumbRuntime(); };
      },
    };
  });
}
