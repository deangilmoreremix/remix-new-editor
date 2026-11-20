/**
 * Design recommendations for the Preview step: a goal → a short list (about six) of designs that
 * suit it, instead of a wall of every design. Pure and deterministic (same input → same list).
 *
 * A design is only recommended when it can really render here: it supports the project's aspect ratio and
 * the pictures it REQUIRES exist (`requiredMedia`). Designs that cover the whole frame are ranked below
 * overlays unless the goal asks for a scene. The full library stays one click away (the template browser).
 */
import type { PreviewAspectRatio } from '../preview/types';
import type { RemotionDesignCategory, RemotionDesignMediaRole, RemotionDesignTemplate } from './types';

export type DesignGoalId = 'introduce' | 'promote-offer' | 'show-product' | 'brand-moment' | 'stand-out'

export interface DesignGoal {
  id: DesignGoalId
  label: string
  description: string
  /** Categories that serve the goal, best first. */
  categories: RemotionDesignCategory[]
}

export const DESIGN_GOALS: readonly DesignGoal[] = Object.freeze([
  { id: 'introduce', label: 'Introduce my business', description: 'Name and headline up front.', categories: ['animated-headline', 'lower-third', 'logo-reveal'] },
  { id: 'promote-offer', label: 'Promote an offer', description: 'A clear call to action.', categories: ['promo-cta', 'animated-headline', 'lower-third'] },
  { id: 'show-product', label: 'Show a product', description: 'Pictures and numbers.', categories: ['other', 'data-visualization', 'promo-cta'] },
  { id: 'brand-moment', label: 'A brand moment', description: 'Logo reveal or end sting.', categories: ['logo-reveal', 'transition', 'visual-effect'] },
  { id: 'stand-out', label: 'Stand out', description: 'Bold motion and effects.', categories: ['visual-effect', 'full-scene', 'animated-headline'] },
]);

export interface RecommendInput {
  designs: readonly RemotionDesignTemplate[]
  aspectRatio: PreviewAspectRatio
  goal: DesignGoalId
  /** Which pictures the customer has assigned. */
  available: Partial<Record<RemotionDesignMediaRole, boolean>>
  /** Designs the aspect ratio rules out, already filtered by the caller's support check. */
  isSupported?: (design: RemotionDesignTemplate) => boolean
  /** Project facts that tune the ranking (all optional). */
  context?: RecommendContext
  limit?: number
}

/** What is known about the project, used to rank designs beyond the goal. All optional; absent = no opinion. */
export interface RecommendContext {
  /** Length of the longest text the design will show (headline / business name), in characters. */
  textLength?: number
  /** A logo is assigned. */
  hasLogo?: boolean
  /** Number of product/service pictures assigned. */
  imageCount?: number
}

/** Text longer than this wants a design built for a line of copy, not a one-word sting. */
export const LONG_TEXT_CHARS = 40;
/** Text at or under this is a name or a tagline: bold, short-copy designs suit it. */
export const SHORT_TEXT_CHARS = 18;

export interface DesignRecommendation {
  design: RemotionDesignTemplate
  score: number
  /** One line: the goal, then each reason this design suits THIS project ("why this one"). */
  reason: string
  reasons: string[]
}

export function recommendDesigns(input: RecommendInput): DesignRecommendation[] {
  const { designs, aspectRatio, goal, available, limit = 6 } = input;
  const goalDef = DESIGN_GOALS.find((g) => g.id === goal) ?? DESIGN_GOALS[0];
  const scored: DesignRecommendation[] = [];
  for (const design of designs) {
    if (input.isSupported && !input.isSupported(design)) continue;
    if (design.aspectRatios && !design.aspectRatios.includes(aspectRatio)) continue;
    if (design.previewCompatible === false) continue;
    // A design that needs a picture the customer does not have would render empty.
    if ((design.requiredMedia ?? []).some((role) => !available[role])) continue;
    const rank = goalDef.categories.indexOf(design.category);
    if (rank < 0) continue;
    let score = 100 - rank * 20;
    // overlays sit on the customer's footage; whole-frame scenes replace it
    if (design.category === 'full-scene' && goal !== 'stand-out') score -= 30;
    // using the customer's own pictures/logo is a plus
    if ((design.media ?? []).some((m) => available[m.role])) score += 5;
    const reasons: string[] = [goalDef.label];
    const ctx = input.context;
    if (ctx) {
      const wordy = design.category === 'animated-headline' || design.category === 'lower-third';
      if (typeof ctx.textLength === 'number') {
        if (ctx.textLength > LONG_TEXT_CHARS) {
          if (wordy) { score += 8; reasons.push('has room for longer text'); }
          else if (design.category === 'logo-reveal' || design.category === 'transition') score -= 8;
        } else if (ctx.textLength > 0 && ctx.textLength <= SHORT_TEXT_CHARS && (design.category === 'logo-reveal' || design.category === 'promo-cta')) {
          score += 4; reasons.push('suits a short name or line');
        }
      }
      const media = design.media ?? [];
      if (ctx.hasLogo && media.some((m) => m.role === 'logo')) { score += 6; reasons.push('shows your logo'); }
      const pictureRoles = media.filter((m) => m.role === 'product' || m.role === 'service').length;
      if ((ctx.imageCount ?? 0) >= 2 && pictureRoles >= 2) { score += 6; reasons.push('shows your pictures'); }
    }
    scored.push({ design, score, reason: reasons.join(' · '), reasons });
  }
  // deterministic: score desc, then name, then id
  scored.sort((a, b) => b.score - a.score || a.design.name.localeCompare(b.design.name) || a.design.id.localeCompare(b.design.id));
  return scored.slice(0, limit);
}

export interface GoalSuggestion { goal: DesignGoalId; reason: string }

/**
 * Which goal to preselect, and why. Uses only what is really known: an offer the customer entered,
 * a booking link the business's own site publishes, product pictures the customer assigned.
 * With none of those it falls back to "introduce" with no claim.
 */
export function suggestGoal(input: {
  hasOffer: boolean
  hasProductImages: boolean
  booking?: { sourceUrl: string; provider?: string } | null
}): GoalSuggestion {
  if (input.hasOffer) return { goal: 'promote-offer', reason: 'You added an offer, so a clear call to action fits.' };
  if (input.booking) {
    const via = input.booking.provider ? ` (${input.booking.provider})` : '';
    return { goal: 'promote-offer', reason: `Their website has online booking${via}, so a "book now" call to action fits.` };
  }
  if (input.hasProductImages) return { goal: 'show-product', reason: 'You have product pictures to show.' };
  return { goal: 'introduce', reason: 'A good first video: who you are and what you do.' };
}
