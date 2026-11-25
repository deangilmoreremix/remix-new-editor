import type { RemotionDesignTemplate } from './types'

/**
 * The description shown to the customer. Transitions play once, in the first seconds of the clip, so a mid-clip
 * preview shows plain footage; say so instead of letting the customer think nothing happened.
 */
export function designDescription(design: Pick<RemotionDesignTemplate, 'description' | 'category'>): string {
  return design.category === 'transition' ? `${design.description} Plays at the start of your video.` : design.description
}
