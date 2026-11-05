/**
 * Cross-studio hand-off transport.
 *
 * The studio shell mounts one studio at a time and unmounts the others, and
 * there is no shared React context spanning studios. localStorage is already
 * the de-facto cross-studio channel in this app (each studio persists its own
 * state to its own key). We reuse the same pattern: the storyboard writes a
 * hand-off payload to a single key, then navigates to the target studio; the
 * target studio reads (and clears) that key on mount.
 */

export type StudioTarget =
  | 'video'
  | 'cinema'
  | 'vfx-studio'
  | 'image'
  | 'thumbnail-studio'
  | 'ai-influencer'
  | 'marketing'
  | 'clipping'
  | 'vibe-motion'
  | 'lipsync'
  | 'recast'

/** A single shot, flattened for downstream consumption. */
export interface HandoffShot {
  scene: string
  /** Fully-compiled prompt (camera + character specs folded in). */
  prompt: string
  duration: number
  frameUrl?: string
  characterNames: string[]
}

export interface StudioHandoff {
  /** Schema version for forward-compat. */
  version: 1
  /** Which studio should receive this payload. */
  target: StudioTarget
  /** Source studio identifier, for diagnostics. */
  from: 'storyboard' | 'go-ai-viral' | 'demo-personalization'
  projectName: string
  aspectRatio: '16:9' | '9:16' | '1:1' | null
  episodeDuration: number
  /** Generated video URL (if any). */
  videoUrl: string | null
  /** First reference image, when available. */
  referenceImageUrl: string | null
  /** Character names defined in the project. */
  characterNames: string[]
  shots: HandoffShot[]
  /** One combined prompt (all shots joined) for text-only studios. */
  combinedPrompt: string
  /** First frame URL, used as a reference image in image-driven studios. */
  firstFrameUrl: string | null
  /**
   * Optional free-form payload from the sender. Used by the Personalization
   * modal to carry the originating studio and the caller's own return
   * payload. Ignored by every existing producer and consumer.
   */
  metadata?: Record<string, unknown>
  createdAt: string
}

const HANDOFF_KEY = 'storyboard_to_studio'

/**
 * In-memory cache of the most recent hand-off. localStorage alone is not
 * reliable across React Strict Mode's mount/remount + effect double-invoke
 * ordering: the first effect run can pop the key before the component instance
 * that should display it settles. The module-level cache outlives component
 * instances within a page session, so the first effect to run always gets the
 * payload, and a subsequent consume (or a remount) sees `null` and no-ops.
 */
let pendingHandoff: StudioHandoff | null = null

/** Map a studio target to the URL slug the shell uses to switch tabs. */
export const TARGET_SLUG: Record<StudioTarget, string> = {
  video: 'video',
  cinema: 'cinema',
  'vfx-studio': 'vfx-studio',
  image: 'image',
  'thumbnail-studio': 'thumbnail-studio',
  'ai-influencer': 'ai-influencer',
  marketing: 'marketing',
  'clipping': 'clipping',
  'vibe-motion': 'vibe-motion',
  'lipsync': 'lipsync',
  'recast': 'recast',
}

export const TARGET_LABEL: Record<StudioTarget, string> = {
  video: 'Video Studio',
  cinema: 'Cinema Studio',
  'vfx-studio': 'VFX Studio',
  image: 'Image Studio',
  'thumbnail-studio': 'Thumbnail Studio',
  'ai-influencer': 'AI Influencer Studio',
  marketing: 'Marketing Studio',
  clipping: 'Clipping Studio',
  'vibe-motion': 'Vibe Motion',
  lipsync: 'Lip Sync',
  recast: 'Recast',
}

export function writeHandoff(payload: StudioHandoff): void {
  if (typeof window === 'undefined') return
  pendingHandoff = payload
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / serialization errors */
  }
}

/**
 * Read the hand-off payload WITHOUT consuming it.
 *
 * We deliberately do NOT clear on read. React Strict Mode (dev) double-invokes
 * effects and remounts components; if we cleared here, the remounted instance
 * would start from empty `useState('')` and the imported data would be lost.
 * Instead each studio applies the payload idempotently (guarded by a ref keyed
 * on `createdAt`) and clears only localStorage via `clearHandoff()` once
 * applied, while the in-memory cache survives the session for any remount.
 */
export function readHandoff(target?: StudioTarget): StudioHandoff | null {
  if (typeof window === 'undefined') return null
  const candidate = pendingHandoff
  if (!candidate) {
    try {
      const raw = localStorage.getItem(HANDOFF_KEY)
      if (!raw) return null
      pendingHandoff = JSON.parse(raw) as StudioHandoff
    } catch {
      return null
    }
  }
  if (target && pendingHandoff && pendingHandoff.target !== target) {
    return null
  }
  return pendingHandoff
}

/** Backward-compatible alias for older import names. */
export const readStoryboardHandoff = readHandoff

export function clearHandoff(): void {
  if (typeof window === 'undefined') return
  // Clear the persisted copy. The in-memory cache is intentionally kept so a
  // remounted studio instance (the shell may re-mount on a client-side tab
  // switch) can re-apply the payload idempotently. Call clearHandoffCache()
  // when the user explicitly edits the prompt to drop it for the session.
  try {
    localStorage.removeItem(HANDOFF_KEY)
  } catch {
    /* ignore */
  }
}

/** Backward-compatible alias for older import names. */
export const clearStoryboardHandoff = clearHandoff

/** Fully drop the in-memory hand-off cache (call when the user edits the prompt). */
export function clearHandoffCache(): void {
  pendingHandoff = null
}

/**
 * Notify the host shell to switch to the target studio. The storyboard runs
 * inside its own MemoryRouter, so react-router navigation can't change the
 * shell's active tab — the shell listens for this event and calls its own
 * tab-switch handler.
 */
export const SEND_TO_EVENT = 'storyboard:send-to'

export function emitSendTo(target: StudioTarget): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SEND_TO_EVENT, { detail: { target } }))
}

// ── GO-Viral helpers ────────────────────────────────────────────────────────────

export type ViralSourceMedia = 'image' | 'video'

/** Which creation studios are relevant for a given source media type. */
export const VIRAL_TARGETS_BY_MEDIA: Record<ViralSourceMedia, StudioTarget[]> = {
  image: ['image', 'thumbnail-studio', 'ai-influencer', 'marketing'],
  video: ['video', 'cinema', 'vfx-studio', 'clipping', 'vibe-motion', 'lipsync', 'recast'],
}

/**
 * Narrow creation targets for the canonical demo-card / detail-page
 * `Create This Style` workflow. Only `video` and `cinema` are offered here,
 * regardless of the demo's original `studioTab`.
 */
export const VIDEO_DEMO_CREATE_TARGETS: readonly StudioTarget[] = [
  'video',
  'cinema',
] as const

export interface CreateViralHandoffOptions {
  target: StudioTarget
  record: {
    title?: string | null
    prompt?: string | null
    fullPrompt?: string | null
    mediaType?: string | null
    media?: { role?: string; previewUrl?: string | null; altText?: string | null }[]
    outputUrl?: string | null
    detailHref?: string | null
  }
}

/**
 * Build a cross-studio handoff payload from a GO-Viral prompt record so the
 * user can continue creation in the target studio with one click.
 */
export function createViralHandoff({ target, record }: CreateViralHandoffOptions): StudioHandoff {
  const prompt = record.prompt || record.fullPrompt || ''
  const projectName = record.title || prompt.slice(0, 60)
  const aspectRatio = record.mediaType === 'video' ? '16:9' : '1:1'
  const firstFrameUrl =
    (record.media && record.media.find((m) => m.role === 'result')?.previewUrl) ||
    record.media?.[0]?.previewUrl ||
    null

  return {
    version: 1,
    target,
    from: 'go-ai-viral',
    projectName,
    aspectRatio,
    episodeDuration: 0,
    videoUrl: record.outputUrl || null,
    referenceImageUrl: firstFrameUrl,
    characterNames: [],
    shots: [{ scene: projectName, prompt, duration: 0, characterNames: [] }],
    combinedPrompt: prompt,
    firstFrameUrl,
    createdAt: new Date().toISOString(),
  }
}
