import type { SiteCapture } from './directorClient';

/**
 * Every picture a capture brought back, labelled so each scene of the film can be given the pictures
 * that suit it (upstream's feature -> shot map names the page state each shot shows; this is the hosted
 * equivalent). Kinds come from what the capture read off the page when it cut each shot (words, picture
 * share, portraits, maps) and from the page it was cut from.
 */
export type PictureKind =
  | 'page' // a whole page of the site (a route)
  | 'hero' // the top band of a page
  | 'people' // team / staff / client portraits
  | 'testimonial' // a quote, a review, a client story
  | 'photo' // a picture-led block: product, work, place
  | 'card' // a service / feature card: words + maybe an icon
  | 'section' // a full-width slice of a page
  | 'contact' // the contact block, form, address
  | 'logo'
  | 'map' // a map: not a picture of the company, never shown in a shot
  | 'blank'; // nearly empty: never shown

export interface Picture {
  id: string;
  url: string;
  kind: PictureKind;
  /** The route it was cut from ('home' = the page asked for). */
  route: string;
  /** The words on it. */
  words: string;
  width: number;
  height: number;
}

const PEOPLE_ROUTE = /team|people|staff|leadership|about|who-we-are|our-story|company/i;
const QUOTE_ROUTE = /testimonial|review|case-stud|stories|clients?|customers?/i;
const CONTACT_ROUTE = /contact|location|areas?-serv|find-us|directions/i;
const QUOTE_WORDS = /[“”"]|\b(?:they|their) (?:team|service)|\bhighly recommend|\bthank(?:s| you)\b|\b(?:client|customer) since\b|★/i;
const CONTACT_WORDS = /\b(?:phone|email|e-mail|address|call us|contact us|send message|get in touch|suite|fax)\b|\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/i;

/** Never shown in a shot: not a picture of the company. */
export const HIDDEN_KINDS: ReadonlySet<PictureKind> = new Set(['map', 'blank']);

const assetKind = (category: string): PictureKind =>
  /person|team/.test(category) ? 'people' : /brand/.test(category) ? 'logo' : 'photo';

export function cropKind(info: NonNullable<SiteCapture['cropInfo']>[number]): PictureKind {
  const words = info.text ?? '';
  if (info.map) return 'map';
  if (info.portraits >= 1 && (PEOPLE_ROUTE.test(info.route) || words.length < 160)) return 'people';
  if (QUOTE_ROUTE.test(info.route) || QUOTE_WORDS.test(words)) return 'testimonial';
  if (CONTACT_ROUTE.test(info.route) && CONTACT_WORDS.test(words)) return 'contact';
  if (CONTACT_WORDS.test(words) && info.imageShare < 0.2 && words.length < 220) return 'contact';
  if (info.imageShare >= 0.45) return 'photo';
  if (words.length < 12 && info.imageShare < 0.08) return 'blank';
  if (info.cut === 'band') return 'section';
  return 'card';
}

/** Words normalised for spotting the same block repeated on many pages (footers, banners). */
const sameBlock = (p: Picture) => `${p.kind}|${p.words.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120)}`;

export function buildCatalogue(capture: SiteCapture | null | undefined): Picture[] {
  if (!capture) return [];
  const out: Picture[] = [];
  const pages = capture.pages?.length ? capture.pages : capture.page?.url ? [{ name: 'home', path: '/', url: capture.page.url, width: capture.page.width, height: capture.page.height }] : [];
  pages.forEach((p, i) => p.url && out.push({ id: `page-${i}`, url: p.url, kind: 'page', route: p.name || p.path || 'home', words: p.path || '', width: p.width, height: p.height }));
  (capture.assets ?? []).forEach((a, i) => a.url && out.push({ id: `asset-${i}`, url: a.url, kind: assetKind(a.category), route: 'site', words: a.alt || a.category.replace(/_/g, ' '), width: 0, height: 0 }));
  (capture.images ?? []).forEach((url, i) => url && out.push({ id: `image-${i}`, url, kind: 'photo', route: 'home', words: '', width: 0, height: 0 }));
  const info = capture.cropInfo && capture.cropInfo.length === capture.crops.length ? capture.cropInfo : null;
  capture.crops.forEach((url, i) => {
    if (!url) return;
    const meta = info?.[i];
    out.push(
      meta
        ? { id: `crop-${i}`, url, kind: cropKind(meta), route: meta.route, words: meta.text, width: meta.width, height: meta.height }
        : { id: `crop-${i}`, url, kind: 'card', route: 'home', words: '', width: 0, height: 0 },
    );
  });
  if (capture.logo) out.push({ id: 'logo', url: capture.logo, kind: 'logo', route: 'home', words: '', width: 0, height: 0 });
  // The first slice of each page is its hero.
  const firstBand = new Set<string>();
  for (const p of out) {
    if (p.kind === 'section' && !firstBand.has(p.route)) {
      firstBand.add(p.route);
      p.kind = 'hero';
    }
  }
  // The same block on every page (footer banners, a repeated quote) is kept once.
  const seen = new Set<string>();
  return out.filter((p) => {
    if (p.kind === 'page' || p.kind === 'logo' || !p.words || p.words.length < 20) return true;
    const key = sameBlock(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** How many of each kind, for the chat ("27 pages, 40 people, 18 testimonials…"). */
export function catalogueSummary(pictures: readonly Picture[]): string {
  const order: PictureKind[] = ['page', 'people', 'photo', 'testimonial', 'card', 'hero', 'section', 'contact'];
  const names: Record<string, string> = { page: 'pages', people: 'people shots', photo: 'photos', testimonial: 'testimonials', card: 'service cards', hero: 'page heroes', section: 'page sections', contact: 'contact blocks' };
  const count = (k: PictureKind) => pictures.filter((p) => p.kind === k).length;
  return order.filter((k) => count(k)).map((k) => `${count(k)} ${names[k]}`).join(' · ');
}
