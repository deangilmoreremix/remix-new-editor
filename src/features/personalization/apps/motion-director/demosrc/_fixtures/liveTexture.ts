import { createContext, use } from 'react';
import { staticFile } from 'remotion';

/**
 * Product textures for the screenshot-based shots.
 *
 * These shots were tuned on upstream's sample product ("live"): full pages
 * captured 1920 CSS px wide at 2x, plus element crops of its cards. A clip can
 * swap in the user's own captures — same geometry, captured the same way — by
 * providing overrides keyed by the sample file name. Shots read every texture
 * through `liveTexture()`, so without overrides they render exactly as before.
 */
export type TextureOverrides = Readonly<Record<string, string>>;

export const LiveTextureContext = createContext<TextureOverrides>({});

const LIVE_DIR = 'motion-studio/textures/live/';

/** Sample full-page textures, in the order captured pages replace them. */
export const PAGE_TEXTURES = [
  'projects-full.png',
  'detail-full.png',
  'wbr-full.png',
  'papers-full.png',
  'projects-empty.png',
] as const;

/** Sample element crops (cards), in the order captured crops replace them. */
export const CROP_TEXTURES = [
  'card4.png',
  'card1.png',
  'card2.png',
  'card3.png',
  'card5.png',
  'card6.png',
  'card7.png',
  'card8.png',
  'card9.png',
  'card10.png',
] as const;

/** URL for a sample texture file, or the clip's capture that replaces it. Call during render. */
export function liveTexture(file: string): string {
  const overrides = use(LiveTextureContext);
  return overrides[file] ?? staticFile(`${LIVE_DIR}${file}`);
}

/** `liveTexture` for a full `motion-studio/textures/live/<file>` path. */
export function liveTexturePath(path: string): string {
  return path.startsWith(LIVE_DIR) ? liveTexture(path.slice(LIVE_DIR.length)) : staticFile(path);
}

/**
 * The user's own captured page for a sample screen, or null when the clip carries none (the sample
 * UI is drawn instead). Only a clip's supplied captures count; the bundled sample files never do.
 */
export function realPage(index = 0): string | null {
  const overrides = use(LiveTextureContext);
  return overrides[PAGE_TEXTURES[index % PAGE_TEXTURES.length]] ?? null;
}

/** The user's own captured card crop for sample card number `seed`, or null. */
export function realCrop(seed = 0): string | null {
  const overrides = use(LiveTextureContext);
  return overrides[CROP_TEXTURES[Math.abs(Math.round(seed)) % CROP_TEXTURES.length]] ?? null;
}

const usable = (value: unknown): value is string =>
  typeof value === 'string' && /^(https?:|blob:|data:image\/)/.test(value);

/**
 * Map captured pages and crops onto the sample texture slots. Pages fill the
 * full-page slots in order (cycling when there are fewer captures than slots);
 * crops fill the card slots the same way, and `card4-hires.png` — the close-up
 * several shots zoom into — follows `card4.png`.
 */
export function textureOverrides(screens: readonly unknown[] = [], crops: readonly unknown[] = []): TextureOverrides {
  const pages = screens.filter(usable);
  const cards = crops.filter(usable);
  const out: Record<string, string> = {};
  if (pages.length) PAGE_TEXTURES.forEach((file, i) => { out[file] = pages[i % pages.length]; });
  if (cards.length) {
    CROP_TEXTURES.forEach((file, i) => { out[file] = cards[i % cards.length]; });
    out['card4-hires.png'] = out['card4.png'];
    // Every card of the clip, numbered: recipes that draw many cards show this many distinct pictures.
    cards.forEach((url, i) => { out[`card:${i}`] = url; });
    out['card:count'] = String(cards.length);
  }
  return out;
}

/** How many pictures of its own the clip carries (0 = the recipe's sample cards). */
export function liveCardCount(): number {
  return Number(use(LiveTextureContext)['card:count'] ?? 0);
}

/**
 * Card `index` of the clip's own pictures (each distinct while there are enough of them), else the
 * sample file the recipe was designed with. For recipes that draw many cards (deck deal, wall, stack).
 */
export function liveCard(index: number, sampleFile: string): string {
  const overrides = use(LiveTextureContext);
  const n = Number(overrides['card:count'] ?? 0);
  return n > 0 ? overrides[`card:${((index % n) + n) % n}`] : liveTexture(sampleFile);
}

/**
 * Picture `index` of the scene's own site pictures (cards, photos, page slices, each distinct while
 * there are enough), or null when the clip carries none — then the recipe draws its sample UI as designed.
 * For recipes that draw a made-up interface: a panel, window, card or thumbnail shows the site instead.
 */
export function realCard(index: number): string | null {
  const overrides = use(LiveTextureContext);
  const n = Number(overrides['card:count'] ?? 0);
  return n > 0 ? overrides[`card:${((index % n) + n) % n}`] : null;
}
