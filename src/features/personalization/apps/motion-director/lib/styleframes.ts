/**
 * Styleframes for the co-creation direction step (upstream guided-free-creation §3): before the person picks a
 * visual direction, each option is shown as two real still frames in its colours — the site's page in the hub,
 * and the closing logo — so a direction is judged by what it looks like, not by a paragraph. The frames come from
 * the same brand scene cards the film uses, rendered by the web renderer at a small size, no video encoded.
 */
import type { DirectionOptions, DirectorPalette, DirectorPlan } from './directorPlan';
import type { SiteCapture } from './directorClient';
import { planToProject, type FilmCapture } from './buildFilm';
import { brandFor } from './filmPipeline';

export interface Styleframe {
  direction: string;
  frames: string[];
}

const HUB_SEC = 3;
const LOGO_SEC = 3;
const OPEN_SEC = 3;

const captureFor = (c: SiteCapture): FilmCapture => ({
  screens: [c.page.url, ...(c.pages ?? []).slice(1).map((p) => p.url)].filter(Boolean),
  crops: [...(c.images ?? []), ...c.crops],
  title: c.title,
  sections: (c.pages?.[0]?.layout?.sections ?? []).map((r) => r.y),
  pageH: c.pages?.[0]?.layout?.pageH ?? c.page.height,
  sectionNames: c.content?.headings ?? [],
  nav: c.content?.nav ?? [],
  ctas: c.content?.ctas ?? [],
  address: c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
});

/**
 * The short film the stills are taken from: the site in the hub, then the closing logo. With `opening`
 * (pipeline stage 1: "2–3 static key frames" of the chosen direction) the URL scan that opens a film comes first.
 */
export function styleframeProject(palette: DirectorPalette, title: string, capture: SiteCapture | null, opts: { opening?: boolean } = {}) {
  const lead = opts.opening ? [{ kind: 'shot', recipeId: 'brand/url-scan', durationSec: OPEN_SEC, headline: capture?.title ?? title, caption: '', transition: 'cut' }] : [];
  const plan = {
    title,
    summary: '',
    palette,
    scenes: [
      ...lead,
      { kind: 'shot', recipeId: 'brand/hub', durationSec: HUB_SEC, headline: capture?.content?.headline ?? '', caption: '', transition: 'cut' },
      { kind: 'shot', recipeId: 'brand/logo-reveal', durationSec: LOGO_SEC, headline: capture?.content?.ctas?.[0] ?? '', caption: '', transition: 'cut' },
    ],
  } as DirectorPlan;
  const project = planToProject(plan, { aspectRatio: '16:9', capture: capture ? captureFor(capture) : null, brand: brandFor(plan, capture) });
  const fps = project.fps;
  const at = opts.opening ? Math.round(OPEN_SEC * fps) : 0;
  const frames = [at + Math.round(HUB_SEC * fps * 0.8), at + Math.round(HUB_SEC * fps) + Math.round(LOGO_SEC * fps * 0.6)];
  return { project, frames: opts.opening ? [Math.round(OPEN_SEC * fps * 0.75), ...frames] : frames };
}

/**
 * Render the two stills of each direction (object URLs; the caller revokes them). Best effort: a browser that
 * cannot render stills, a timeout or a cancel gives back what was done so far, never an error.
 */
export async function renderStyleframes(opts: { options: DirectionOptions; capture: SiteCapture | null; product: string; signal?: AbortSignal; budgetMs?: number; opening?: boolean }): Promise<Styleframe[]> {
  let render: typeof import('../webRenderer').renderStillOnWebExport;
  try {
    render = (await import('../webRenderer')).renderStillOnWebExport;
  } catch {
    return [];
  }
  const fallback: DirectorPalette = { background: opts.capture?.brand.background ?? '#0b1020', text: opts.capture?.brand.text ?? '#f5f7ff', accent: opts.capture?.brand.accent ?? '#2f80ff' };
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), opts.budgetMs ?? 25_000);
  const stop = () => timeout.abort();
  opts.signal?.addEventListener('abort', stop);
  const out: Styleframe[] = [];
  try {
    for (const d of opts.options.directions) {
      if (timeout.signal.aborted) break;
      const { project, frames } = styleframeProject(d.palette ?? fallback, opts.product, opts.capture, { opening: opts.opening });
      const urls: string[] = [];
      for (const f of frames) {
        try {
          const still = await render(project, f, timeout.signal, 0.35);
          urls.push(URL.createObjectURL(still.blob));
        } catch {
          break;
        }
      }
      if (urls.length) out.push({ direction: d.name, frames: urls });
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', stop);
  }
  return out;
}
