/**
 * Pipeline stage 4, "final capture after the storyboard": the storyboard rows name the page state each
 * shot needs (the feature map's `pageState`, kept in the scene's `asset`). A row whose page the first
 * capture did not reach gets that page captured on its own — found among the site's own links — and
 * merged in before the film is built, so the shot shows the right page instead of the nearest one.
 */
import type { DirectorPlan } from './directorPlan';
import type { SiteCapture } from './directorClient';

const STOP = new Set(['page', 'pages', 'site', 'your', 'home', 'with', 'from', 'that', 'this', 'section', 'state', 'sample', 'hero', 'the', 'and', 'our']);
const words = (s: string): Set<string> => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, '')));
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

export interface NeededPage {
  scene: number;
  state: string;
  link: { name: string; path: string; url: string };
}

/** Rows whose page state matches no captured page but does match one of the site's other pages (at most `max`). */
export function neededPages(plan: DirectorPlan, capture: SiteCapture | null | undefined, max = 4, more = 2): NeededPage[] {
  if (!capture?.links?.length || capture.partial) return [];
  const captured = (capture.pages ?? []).map((p) => words(`${p.name} ${p.path}`));
  const have = new Set((capture.pages ?? []).map((p) => p.path.replace(/\/+$/, '').toLowerCase() || '/'));
  const out: NeededPage[] = [];
  const asked = new Set<string>();
  plan.scenes.forEach((s, scene) => {
    const state = (s.asset ?? '').trim();
    if (s.kind !== 'shot' || !state || out.length >= max) return;
    const want = words(state);
    if (!want.size || captured.some((c) => overlap(want, c) > 0)) return;
    const best = capture
      .links!.filter((l) => !have.has(l.path.replace(/\/+$/, '').toLowerCase() || '/') && !asked.has(l.url))
      .map((l) => ({ l, score: overlap(want, words(`${l.name} ${l.path}`)) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score === 0) return;
    asked.add(best.l.url);
    out.push({ scene, state, link: best.l });
  });
  // The quick capture before the storyboard took only a few routes: a couple more of the site's own pages
  // (its links come best first: services, about, team…) give the film more of the company to show.
  for (const l of capture.links) {
    if (more <= 0) break;
    if (asked.has(l.url) || have.has(l.path.replace(/\/+$/, '').toLowerCase() || '/')) continue;
    asked.add(l.url);
    out.push({ scene: -1, state: 'more of the site', link: l });
    more--;
  }
  return out;
}

/** The first capture with the targeted pages added: their full pages, card crops (with what they show), images. */
export function mergeCaptures(base: SiteCapture, extra: SiteCapture, as: { name: string; path: string }): SiteCapture {
  const name = as.name;
  const page = extra.pages?.[0] ?? (extra.page?.url ? { name, path: as.path, url: extra.page.url, width: extra.page.width, height: extra.page.height } : null);
  if (!page && !extra.crops.length) return base;
  const info = extra.cropInfo && extra.cropInfo.length === extra.crops.length ? extra.cropInfo.map((i) => ({ ...i, route: name })) : null;
  const baseInfo = base.cropInfo && base.cropInfo.length === base.crops.length ? base.cropInfo : null;
  return {
    ...base,
    pages: [...(base.pages ?? []), ...(page ? [{ ...page, name, path: as.path }] : [])],
    crops: [...base.crops, ...extra.crops],
    // Keep crop info only when both sides have it, so it stays in step with the crops.
    cropInfo: baseInfo && info ? [...baseInfo, ...info] : undefined,
    images: [...(base.images ?? []), ...(extra.images ?? [])],
  };
}
