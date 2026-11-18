import type { CopyState } from './types'

const pick = (a?: string, b?: string) => (a && a.trim() ? a : b || '')

/**
 * The Write step edits `writeCopy`; the Thumbnail/Destinations/Review steps and
 * publishing read the result of this merge. Write-step text wins over the
 * title/caption the studio handed over when the modal opened, so edited and
 * AI-written copy is what actually gets published.
 *
 * `write.edited` records which fields the learner touched. An edited field is
 * authoritative even when cleared (clearing a title must not silently bring the
 * studio title back), and an edited master / title also outranks the studio's
 * separate caption / TikTok title.
 */
export function mergeCopy(write: CopyState, social: CopyState): CopyState {
  const ed = write.edited || {}
  const platforms: CopyState['platforms'] = { ...(social.platforms || {}) }
  for (const [id, w] of Object.entries(write.platforms || {})) {
    const s = platforms[id] || {}
    const pe = ed.platforms?.[id] || {}
    platforms[id] = {
      title: ed.title || pe.title ? w?.title ?? '' : pick(w?.title, s.title),
      // an edited (even cleared) platform field is authoritative; otherwise fall back to the studio's value
      description: pe.description ? w?.description ?? '' : pick(w?.description, s.description),
      caption: pe.caption ? w?.caption ?? '' : pick(w?.caption, s.caption),
    }
  }
  // Once the learner touched any caption, the studio's separate caption must not come back (not even as a fallback
  // for a platform whose caption they cleared); publishing then falls back to their own master text.
  const touchedCaption = !!ed.master || Object.values(ed.platforms || {}).some((p) => p?.caption)
  return {
    ...social,
    ...write,
    master: pick(write.master, social.master),
    title: ed.title ? write.title ?? '' : pick(write.title, social.title),
    description: pick(write.description, social.description),
    tags: pick(write.tags, social.tags),
    caption: pick(write.caption, touchedCaption ? '' : social.caption),
    tiktokTitle: pick(write.tiktokTitle, ed.title ? '' : social.tiktokTitle),
    platforms,
    variants: write.variants?.length ? write.variants : social.variants || [],
  }
}
