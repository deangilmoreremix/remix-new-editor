/**
 * Fill a recipe's template words from what the site says, with no model call: the
 * fallback when no OpenAI key is on file or the director could not be reached.
 */
import type { SiteContent } from './filmChat';
import { fitToLayout, keepsShape } from './directorPlan';
import type { TextMap } from './textOverrides';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const FONT_STACK = /sans-serif|monospace|system-ui|\bserif\b|helvetica|arial/i;

/** The scene a recipe plays in: its own headline and caption lead the lines, so repeats of one recipe never share words. */
export interface SceneWords {
  index: number;
  headline?: string;
  caption?: string;
}

/**
 * The scene's headline fills the recipe's first line and its caption the second; the other
 * sentences take the site's headline, description and headings, and short labels its menu
 * entries and calls to action, starting further down the list for each scene (`used` is shared
 * by the scenes of one film). Each replacement is about as long as the line it replaces so the
 * layout holds. Lines nothing fits keep the template's words.
 */
export function fallbackTexts(strings: readonly string[], content: SiteContent | null | undefined, name: string, scene?: SceneWords, used: Set<string> = new Set(), keepShape = false): TextMap {
  const clean = (v: string | undefined) => (v ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const rotate = <T,>(list: T[]): T[] => (list.length && scene ? [...list.slice(scene.index % list.length), ...list.slice(0, scene.index % list.length)] : list);
  const sentences = rotate([content?.headline, content?.description, ...(content?.headings ?? [])].map(clean).filter(Boolean));
  const labels = rotate([...(content?.nav ?? []), ...(content?.ctas ?? []), ...(content?.headings ?? [])].map(clean).filter((v) => v && words(v) <= 3));
  const take = (pool: string[], max: number): string | undefined => {
    const hit = pool.find((c) => !used.has(c) && c.length <= max);
    if (hit) used.add(hit);
    return hit;
  };
  const lead = [clean(scene?.headline), clean(scene?.caption)].filter(Boolean);
  const out: TextMap = {};
  let slot = 0;
  for (const line of strings) {
    if (FONT_STACK.test(line) || (name && line.toLowerCase().includes(name.toLowerCase()))) continue;
    const long = words(line) >= 3;
    const limit = Math.max(long ? 18 : 14, Math.round(line.length * (long ? 1.25 : 1.4)));
    let to: string | undefined;
    // The scene's own words first, cut to the line's length at a word.
    while (!to && slot < lead.length) {
      const want = lead[slot++];
      to = want.length <= limit ? want : fitToLayout(want, line);
      if (to.length > limit) to = undefined;
    }
    to ??= long ? take(sentences, limit) : take(labels, limit);
    // Words that are part of an effect keep their word count and length.
    if (to && (!keepShape || keepsShape(to, line))) out[line] = to;
  }
  return out;
}
