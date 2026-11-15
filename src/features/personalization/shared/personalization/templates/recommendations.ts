/**
 * Design recommendations for the Preview step: a goal → a short list (about six) of designs that
 * suit it, instead of a wall of every design. Pure and deterministic (same input → same list).
 *
 * A design is only recommended when it can really render here: it supports the project's aspect ratio and
 * the pictures it REQUIRES exist (`requiredMedia`). Designs that cover the whole frame are ranked below
 * overlays unless the goal asks for a scene. The full library stays one click away (the template browser).
 */
import type { PreviewAspectRatio } from '../preview/types'
import type { RemotionDesignCategory, RemotionDesignMediaRole, RemotionDesignTemplate } from './types'

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
])

export interface RecommendInput {
  designs: readonly RemotionDesignTemplate[]
  aspectRatio: PreviewAspectRatio
  goal: DesignGoalId
  /** Which pictures the customer has assigned. */
  available: Partial<Record<RemotionDesignMediaRole, boolean>>
  /** Designs the aspect ratio rules out, already filtered by the caller's support check. */
  isSupported?: (design: RemotionDesignTemplate) => boolean
  limit?: number
}

export interface DesignRecommendation { design: RemotionDesignTemplate; score: number; reason: string }

export function recommendDesigns(input: RecommendInput): DesignRecommendation[] {
  const { designs, aspectRatio, goal, available, limit = 6 } = input
  const goalDef = DESIGN_GOALS.find((g) => g.id === goal) ?? DESIGN_GOALS[0]
  const scored: DesignRecommendation[] = []
  for (const design of designs) {
    if (input.isSupported && !input.isSupported(design)) continue
    if (design.aspectRatios && !design.aspectRatios.includes(aspectRatio)) continue
    if (design.previewCompatible === false) continue
    // A design that needs a picture the customer does not have would render empty.
    if ((design.requiredMedia ?? []).some((role) => !available[role])) continue
    const rank = goalDef.categories.indexOf(design.category)
    if (rank < 0) continue
    let score = 100 - rank * 20
    // overlays sit on the customer's footage; whole-frame scenes replace it
    if (design.category === 'full-scene' && goal !== 'stand-out') score -= 30
    // using the customer's own pictures/logo is a plus
    if ((design.media ?? []).some((m) => available[m.role])) score += 5
    scored.push({ design, score, reason: goalDef.label })
  }
  // deterministic: score desc, then name, then id
  scored.sort((a, b) => b.score - a.score || a.design.name.localeCompare(b.design.name) || a.design.id.localeCompare(b.design.id))
  return scored.slice(0, limit)
}
