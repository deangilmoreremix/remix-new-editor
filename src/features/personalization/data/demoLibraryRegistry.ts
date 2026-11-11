/**
 * Demo Library Registry
 * ===================================================================
 * The single, complete index of every locally-hosted demo video that may be
 * offered in the product's demo surfaces (landing showcase, demo pages, and
 * the Personalization modal's step-2 "choose a video" grid).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `src/shared/personalization/guided/curatedDemos.ts` used to build
 * `GUIDED_DEMO_VIDEOS` from a hardcoded 12-slug allowlist, so only 12 of the
 * 123 usable demo videos ever reached the UI. The allowlist was the bug: the
 * media is already on disk and already described by the per-source catalogs in
 * `src/data/*`. This registry replaces the allowlist with the full,
 * verified set and gives every entry a stable, source-qualified id.
 *
 * WHAT COUNTS AS A DEMO (eligibility)
 * -----------------------------------
 * A video is registered only when ALL of the following hold:
 *
 *  1. It is a LOCAL file under `public/media/**` — no remote CDN URLs. The
 *     GO AI Viral catalogs (`src/data/seedance2PromptDemos.ts`,
 *     `src/data/seedance_prompts.json`) point at `cdn.seedance2prompt.com`
 *     and are therefore NOT part of this registry.
 *  2. The file exists, is non-empty, and starts with a real container magic
 *     number (WebM `1a 45 df a3`, MP4 `ftyp`). See `DEMO_MEDIA_FACTS` below.
 *  3. The file is described by one of the `VideoDemo` source catalogs, so it
 *     has a real title, prompt, category and studio route.
 *  4. It is not behind a paid entitlement gate. No local video collection is
 *     entitlement-gated in this codebase — the entitlement model
 *     (`src/access/entitlements.ts`) gates GENERATION, not browsing, and
 *     `app/api/go-ai-viral/{prompts,seedance}/route.ts` are explicitly on the
 *     read-only allowlist in `src/access/__tests__/api-gates-contract.test.ts`.
 *
 * Excluded collections and the reason for each are recorded in
 * `EXCLUDED_DEMO_COLLECTIONS`. Each excluded record states whether the
 * exclusion is entitlement-driven (`entitlementGated: true`) or not — none of
 * them currently are.
 *
 * RECONCILED TOTALS
 * ------------------
 * A full audit of the repo found exactly FIVE local demo video collections,
 * all of them under `public/media/<collection>/videos`:
 *
 *   | collection       | on disk | verified | registered |
 *   |------------------|---------|----------|------------|
 *   | minimax-h3       |      30 |       30 |         30 |
 *   | promptfeed       |      29 |       29 |         29 |
 *   | seedance-1       |      14 |       14 |         14 |
 *   | seedance-25      |      50 |       50 |         50 |
 *   | seedance-prompts |      14 |        0 |          0 |
 *   |------------------|---------|----------|------------|
 *   | TOTAL            |     137 |      123 |        123 |
 *
 * 137 video files exist under `public/media/`; 14 of them (the whole
 * `seedance-prompts` collection) are 9-byte "Not Found" error bodies with no
 * media container, so exactly 123 videos are eligible and all 123 are
 * registered. No other local demo video collection exists: the only other
 * videos in the repo are the 47 AI Creator Academy course assets under
 * `public/academy/` (registered separately in `src/data/academyAssets.ts`)
 * and `docs/assets/demo.mp4`, a documentation asset that no code references.
 * The `ai-viral` catalogs hold 2419 entries, all of them remote CDN URLs.
 *
 * HOW THE MEDIA FACTS WERE OBTAINED
 * ----------------------------------
 * `DEMO_MEDIA_FACTS` was produced by a ONE-OFF probe script (run outside the
 * repo, not shipped) that parsed each container's bytes directly:
 *   - MP4  : `moov/mvhd` (timescale + duration) and `moov/trak/tkhd` (16.16
 *            fixed-point width/height)
 *   - WebM : EBML `Segment > Info` (TimecodeScale, Duration) and
 *            `Segment > Tracks > TrackEntry > Video` (PixelWidth, PixelHeight)
 * The table is baked in as static data so this module stays dependency-free
 * and runs in the browser. It doubles as the verification allowlist: an entry
 * is registered only when its `videoSrc` has a fact row, so a video that was
 * never probed (or failed the magic-number check) can never be registered.
 *
 * When the source catalog declares an aspect ratio or duration, the catalog
 * wins. The probed facts are the fallback for entries whose catalog is silent,
 * and the raw media dimensions are always exposed on `entry.media`.
 */

import type { DemoCategory, VideoDemo } from './types'
import { DEMO_CATEGORIES as CANONICAL_CATEGORY_IDS } from './types'
import { MINIMAX_H3_DEMOS } from './minimaxH3Demos'
import { SEEDANCE_25_DEMOS } from './seedance25Demos'
import { SEEDANCE_1_DEMOS } from './seedance1Demos'
import { PROMPTFEED_DEMOS } from './promptFeedDemos'

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** Ids of the collections that are registered in the demo library. */
export const DEMO_COLLECTION_IDS = [
  'minimax-h3',
  'promptfeed',
  'seedance-1',
  'seedance-25',
] as const

export type DemoCollectionId = (typeof DEMO_COLLECTION_IDS)[number]

export type DemoCollectionMeta = {
  /** Stable collection id — the id prefix used by every entry id. */
  id: DemoCollectionId
  /** Human display name shown in the UI. */
  label: string
  /** The `sourceRepo` key used by `getCreateUrl()` template ids. */
  sourceRepo: string
  /** Upstream project the collection was ingested from. */
  sourceUrl: string
  /** Number of registered demos in this collection. */
  count: number
}

/**
 * Collections that are NOT part of the demo library, with the reason.
 * Kept next to the registry so the audit trail travels with the data.
 */
export type ExcludedDemoCollection = {
  id: string
  label: string
  /** Videos physically present under `public/media/<id>/videos`. */
  videoCountOnDisk: number
  /** Videos that passed the magic-number / non-empty verification. */
  verifiedVideoCount: number
  /**
   * True only when the collection is withheld because of a paid entitlement
   * gate. False means the collection was withheld for a non-paywall reason
   * (broken/absent media, remote-only delivery, or a different data model) —
   * it is free to browse, it simply has nothing eligible to show.
   */
  entitlementGated: boolean
  reason: string
}

export const EXCLUDED_DEMO_COLLECTIONS: readonly ExcludedDemoCollection[] = [
  {
    id: 'seedance-prompts',
    label: 'Seedance Prompts',
    videoCountOnDisk: 14,
    verifiedVideoCount: 0,
    entitlementGated: false,
    reason:
      'NOT entitlement-gated — the exclusion is a broken-media exclusion. All 14 files under `public/media/seedance-prompts/videos/` are 9-byte HTTP error bodies containing the literal ASCII text "Not Found" (hex 4e6f7420466f756e64) saved with an .mp4 extension: no `ftyp` box, no WebM `1a45dfa3` magic, no decodable container. They were committed that way in df587766f ("feat: expand landing video demos and add go-ai-viral studio") and were never valid media. Upstream cause: the source repo HuyLe82US/awesome-seedance-prompts hosts its proof clips on GitHub `user-attachments` URLs that return 404, and the ingest saved the 404 body verbatim as the media file. Consequently the source catalog `src/data/seedancePromptsDemos.ts` is empty (0 entries) and there is no per-video poster (only one shared `previews/placeholder.svg`). Registering it would ship unplayable cards, so it stays excluded until the videos are re-downloaded from a working source.',
  },
  {
    id: 'academy',
    label: 'AI Creator Academy course assets',
    videoCountOnDisk: 47,
    verifiedVideoCount: 47,
    entitlementGated: false,
    reason:
      'NOT entitlement-gated — the exclusion is a wrong-data-model exclusion. `public/academy/` holds 47 .mp4 course assets (all 47 pass the `ftyp` magic check) plus 47 matching animated .gif previews and 56 .jpg posters, registered separately in `src/data/academyAssets.ts` with its own `AcademyAsset` type and `src/data/academyMediaManifest.json`. They are bound to lessons and templates rather than being product demo videos: they have no `sourceRepo`/`slug`/`studioTab`, so `getCreateUrl()` cannot route them to a studio, and mixing them into the shared demo grid would give the Personalize/Create flow a dead template id. They are already reachable through the Academy UI.',
  },
  {
    id: 'ai-viral',
    label: 'GO AI Viral Studio video content',
    videoCountOnDisk: 0,
    verifiedVideoCount: 0,
    entitlementGated: false,
    reason:
      'NOT entitlement-gated — the exclusion is a remote-only-delivery exclusion. The AI Viral Studio serves its video content from remote CDN URLs (`cdn.seedance2prompt.com`) via `app/api/go-ai-viral/seedance/route.ts` and `src/data/seedance_prompts.json`; its source catalog `src/data/seedance2PromptDemos.ts` holds 2419 entries, every one of them a remote URL and none of them a local file. Nothing is served from `public/media/`, so none of it can be registered as a local demo.',
  },
]

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type DemoCategoryDescriptor = {
  /** Canonical category id — matches `DemoCategory` in `src/data/types.ts`. */
  id: DemoCategory
  /** Human label for UI. */
  label: string
}

/**
 * The canonical landing categories with their display labels.
 * (Distinct from the plain id list `DEMO_CATEGORIES` in `src/data/types.ts`,
 * which this module re-exports as `DEMO_CATEGORY_IDS`.)
 */
export const DEMO_CATEGORIES: readonly DemoCategoryDescriptor[] = [
  { id: 'Action', label: 'Action' },
  { id: 'Animation', label: 'Animation' },
  { id: 'Cinema', label: 'Cinema' },
  { id: 'Commercial', label: 'Commercial' },
  { id: 'Fashion', label: 'Fashion' },
  { id: 'Social', label: 'Social' },
  { id: 'UGC', label: 'UGC' },
]

/** The plain canonical category id list (same ids as `src/data/types.ts`). */
export const DEMO_CATEGORY_IDS: readonly DemoCategory[] = CANONICAL_CATEGORY_IDS

// ---------------------------------------------------------------------------
// Probed media facts (verification allowlist + fallback metadata)
// ---------------------------------------------------------------------------

export type DemoMediaFacts = {
  /** Decoded picture width in pixels. */
  width: number
  /** Decoded picture height in pixels. */
  height: number
  /** Decoded duration in seconds, rounded to 2 decimals. */
  durationSeconds: number
}

/**
 * Verified media facts keyed by the site's absolute media path.
 * Only files that passed the magic-number check are listed.
 */
export const DEMO_MEDIA_FACTS: Readonly<Record<string, DemoMediaFacts>> = {
  '/media/minimax-h3/videos/1980s-open-source-family-comedy.webm': { width: 1280, height: 720, durationSeconds: 11.62 },
  '/media/minimax-h3/videos/bamboo-forest-wuxia-mystery.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/black-and-gold-perfume-commercial.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/blackberry-vanilla-soda-ugc-vlog.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/blue-haired-hero-and-spirit-fox-escape.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/cyber-warrior-vs-primordial-fighter.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/emerald-bio-serum-product-film.webm': { width: 720, height: 1280, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/giant-koi-park-incident.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/golden-guardian-web-hero-loop.webm': { width: 1280, height: 720, durationSeconds: 30.24 },
  '/media/minimax-h3/videos/gourmet-burger-ugc-taste-test.webm': { width: 1698, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/greenhouse-tea-isekai-anime.webm': { width: 1280, height: 720, durationSeconds: 15.24 },
  '/media/minimax-h3/videos/ice-gunslinger-interactive-web-loop.webm': { width: 1278, height: 720, durationSeconds: 15.26 },
  '/media/minimax-h3/videos/kintsugi-sword-seamless-loop.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/low-angle-fashion-tracking-film.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/luxury-perfume-commercial.webm': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/minimax-h3/videos/luxury-skincare-storyboard-commercial.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/macaw-scream-in-extreme-slow-motion.webm': { width: 1698, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/modern-warfare-fps-gameplay.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/morning-lip-oil-ugc-testimonial.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/nighttime-motorcycle-chase-synced-to-music.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/porto-francesinha-comedy-recipe.webm': { width: 1698, height: 720, durationSeconds: 15.24 },
  '/media/minimax-h3/videos/radio-operator-evacuation-bridge.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/ramen-bowl-ugc-taste-test.webm': { width: 1280, height: 544, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/storm-lit-pirate-galleon-battle.webm': { width: 1280, height: 720, durationSeconds: 10.22 },
  '/media/minimax-h3/videos/stormy-claymation-whale-breach.webm': { width: 1280, height: 720, durationSeconds: 10.22 },
  '/media/minimax-h3/videos/strawberry-drink-transformation-commercial.webm': { width: 1280, height: 720, durationSeconds: 7.37 },
  '/media/minimax-h3/videos/surreal-blue-studio-dance-with-a-horse.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/theme-park-memory-montage.webm': { width: 1280, height: 720, durationSeconds: 5.14 },
  '/media/minimax-h3/videos/y2k-k-pop-candy-typography-music-video.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/minimax-h3/videos/yellow-sunglasses-in-a-black-studio.webm': { width: 1280, height: 720, durationSeconds: 15.18 },
  '/media/seedance-25/videos/video-12cc426781d121f8.webm': { width: 720, height: 764, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-148a664d1d6d89d8.webm': { width: 1280, height: 720, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-15d773e393d0b933.webm': { width: 1280, height: 720, durationSeconds: 64.54 },
  '/media/seedance-25/videos/video-166866b736ecda0b.webm': { width: 1728, height: 720, durationSeconds: 50.77 },
  '/media/seedance-25/videos/video-1e799988479e3f91.webm': { width: 1280, height: 720, durationSeconds: 30.08 },
  '/media/seedance-25/videos/video-2503ba98404071af.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-32ba5442fa856d7c.webm': { width: 1070, height: 610, durationSeconds: 30.17 },
  '/media/seedance-25/videos/video-36a9c5019a1fcb0f.webm': { width: 1280, height: 720, durationSeconds: 28.59 },
  '/media/seedance-25/videos/video-37890e3d802442e7.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-399a3a97f528104c.webm': { width: 1706, height: 720, durationSeconds: 32.63 },
  '/media/seedance-25/videos/video-3b60e3c265f54dd5.webm': { width: 720, height: 1280, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-3f856d6f703053cd.webm': { width: 1280, height: 720, durationSeconds: 88.11 },
  '/media/seedance-25/videos/video-3fffc9610f693073.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-457affc3886e4839.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-49a74c05cd8db885.webm': { width: 1280, height: 720, durationSeconds: 30.17 },
  '/media/seedance-25/videos/video-4af57f18c573c7d0.webm': { width: 1280, height: 720, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-4e80d24d44619e26.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-576e30d3d7cd8478.webm': { width: 1280, height: 720, durationSeconds: 30.09 },
  '/media/seedance-25/videos/video-5d2b8c5d54ca198d.webm': { width: 1278, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-5f58ba69d98f6c6f.webm': { width: 720, height: 804, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-629787f47dd0f835.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-631a86726f200b23.webm': { width: 1280, height: 720, durationSeconds: 30.05 },
  '/media/seedance-25/videos/video-637580523ff615f6.webm': { width: 720, height: 1280, durationSeconds: 33.14 },
  '/media/seedance-25/videos/video-68b16c85fb3d6311.webm': { width: 1280, height: 720, durationSeconds: 30.09 },
  '/media/seedance-25/videos/video-6b644fc5f97d874e.webm': { width: 1280, height: 720, durationSeconds: 30.13 },
  '/media/seedance-25/videos/video-6e7e561eee9b9da0.webm': { width: 1280, height: 720, durationSeconds: 70.32 },
  '/media/seedance-25/videos/video-700b5821bd9c9068.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-77c0ad66c83880b2.webm': { width: 1280, height: 720, durationSeconds: 36.32 },
  '/media/seedance-25/videos/video-784f0d1bf377b35f.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-7a23a7826e25c5be.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-8193ba59a818bf92.webm': { width: 1280, height: 720, durationSeconds: 58.87 },
  '/media/seedance-25/videos/video-89bf2fc4cd1d671f.webm': { width: 1280, height: 720, durationSeconds: 30.18 },
  '/media/seedance-25/videos/video-8c5adaf031d6961c.webm': { width: 720, height: 1280, durationSeconds: 27.96 },
  '/media/seedance-25/videos/video-8ec60e5a86be4ce2.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-9bc5f48c72d506ac.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-a33093f28a1daa8b.webm': { width: 720, height: 1280, durationSeconds: 98.2 },
  '/media/seedance-25/videos/video-b2e61a88132e5e20.webm': { width: 720, height: 720, durationSeconds: 33.23 },
  '/media/seedance-25/videos/video-b51bdf9fed1d559e.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-25/videos/video-b7fdf0a40fd8d0a4.webm': { width: 1280, height: 720, durationSeconds: 31.1 },
  '/media/seedance-25/videos/video-ca3142256c322af3.webm': { width: 1280, height: 720, durationSeconds: 24.12 },
  '/media/seedance-25/videos/video-cc1c1617eab973cd.webm': { width: 1456, height: 624, durationSeconds: 60.85 },
  '/media/seedance-25/videos/video-d12a72e081eb2c5b.webm': { width: 1280, height: 720, durationSeconds: 32.63 },
  '/media/seedance-25/videos/video-dcbf8625a8d83951.webm': { width: 1456, height: 624, durationSeconds: 31.94 },
  '/media/seedance-25/videos/video-dfa08d4d31cde8dc.webm': { width: 1280, height: 720, durationSeconds: 28.78 },
  '/media/seedance-25/videos/video-e03498e492c4affa.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-e73a1d985b779098.webm': { width: 1280, height: 720, durationSeconds: 30.1 },
  '/media/seedance-25/videos/video-ea51c42d0d305c4a.webm': { width: 1280, height: 720, durationSeconds: 37.48 },
  '/media/seedance-25/videos/video-ed330e25450df86c.webm': { width: 960, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-f2fc1e8469fd757a.webm': { width: 1280, height: 720, durationSeconds: 30.12 },
  '/media/seedance-25/videos/video-f3424e4cae5380e2.webm': { width: 1280, height: 720, durationSeconds: 30.15 },
  '/media/seedance-1/videos/denis-villeneuve-style-epic-desert-scene.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/figure-1-vs-figure-2-martial-arts-tournament.mp4': { width: 1280, height: 720, durationSeconds: 10.15 },
  '/media/seedance-1/videos/giant-orange-cat-meme-style.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/hollywood-professional-racing-movie-style.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/luffy-coding.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/motion-graphics.mp4': { width: 640, height: 360, durationSeconds: 15.12 },
  '/media/seedance-1/videos/muji-brand-promotional-video.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/nezha-and-ao-bing-ice-fire-clash-space-time-folding.mp4': { width: 720, height: 1280, durationSeconds: 5.11 },
  '/media/seedance-1/videos/otter-mecha-anime-battle-mech-vs-octopus.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/perfume-mg-animation-style.mp4': { width: 640, height: 360, durationSeconds: 15.15 },
  '/media/seedance-1/videos/surrealistic-documentary-style.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/tournament-of-power.mp4': { width: 1470, height: 630, durationSeconds: 15.12 },
  '/media/seedance-1/videos/van-gogh-animation.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/seedance-1/videos/wong-kar-wai-film-style-rainy-phone-booth-scene.mp4': { width: 2940, height: 1260, durationSeconds: 10.1 },
  '/media/promptfeed/videos/1507_15-second-hyper-realistic-cinematic-luxury-jewelry-commercia.mp4': { width: 1080, height: 1200, durationSeconds: 15.13 },
  '/media/promptfeed/videos/1521_luxury-diamond-ring-commercial-storyboard.mp4': { width: 720, height: 960, durationSeconds: 15.14 },
  '/media/promptfeed/videos/1523_handheld-16mm-gym-vlog-pov-of-chase-in-an-evening-gym.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/promptfeed/videos/1530_cinematic-vertical-beauty-vlog-for-skincare-product.mp4': { width: 834, height: 1112, durationSeconds: 15.14 },
  '/media/promptfeed/videos/1949_handheld-coffee-vlog-with-mini-dv-aesthetic.mp4': { width: 1280, height: 720, durationSeconds: 30.1 },
  '/media/promptfeed/videos/1950_animated-forest-riverside-picnic.mp4': { width: 1280, height: 720, durationSeconds: 11.19 },
  '/media/promptfeed/videos/2082_tresemm-luxury-haircare-commercial.mp4': { width: 1280, height: 720, durationSeconds: 15.09 },
  '/media/promptfeed/videos/2291_pixar-style-30-second-3d-animated-short-of-a-beggar-and-a-cr.mp4': { width: 2568, height: 1440, durationSeconds: 30 },
  '/media/promptfeed/videos/2477_30-second-vertical-ai-ugc-product-commercial-for-premium-cof.mp4': { width: 1080, height: 1920, durationSeconds: 30.14 },
  '/media/promptfeed/videos/2673_15-second-live-action-video-prompt-alex-time-warp-disaster.mp4': { width: 1280, height: 720, durationSeconds: 15.12 },
  '/media/promptfeed/videos/2690_cinematic-korean-convenience-store-snack-challenge-vlog.mp4': { width: 1280, height: 720, durationSeconds: 30.11 },
  '/media/promptfeed/videos/2777_pov-river-to-campfire-trout-cooking-sequence-30s-video.mp4': { width: 1280, height: 720, durationSeconds: 28.35 },
  '/media/promptfeed/videos/2781_30-second-photorealistic-smartphone-travel-vlog-of-a-japanes.mp4': { width: 1470, height: 630, durationSeconds: 30.11 },
  '/media/promptfeed/videos/2783_premium-photorealistic-fashion-commercial-and-behind-the-sce.mp4': { width: 1280, height: 720, durationSeconds: 49.54 },
  '/media/promptfeed/videos/2904_30-second-ultra-realistic-cinematic-horror-comedy-ad-for-phi.mp4': { width: 1280, height: 720, durationSeconds: 30.11 },
  '/media/promptfeed/videos/2984_the-decadent-snap-artisanal-chocolate-bar-video-prompt.mp4': { width: 720, height: 1280, durationSeconds: 15.12 },
  '/media/promptfeed/videos/3030_surreal-tokyo-dessert-animation.mp4': { width: 1280, height: 720, durationSeconds: 10.09 },
  '/media/promptfeed/videos/3052_kitkat-break-focus-commercial.mp4': { width: 1280, height: 720, durationSeconds: 30.17 },
  '/media/promptfeed/videos/3155_young-traveler-hikes-through-lush-mountain-forest-to-hidden-.mp4': { width: 1920, height: 1080, durationSeconds: 15.12 },
  '/media/promptfeed/videos/3185_colossal-kaiju-vs-fighter-jet-in-coastal-city.mp4': { width: 3840, height: 2160, durationSeconds: 15.07 },
  '/media/promptfeed/videos/3215_cute-cinematic-14-second-3d-cartoon-of-a-woman-and-boy-chasi.mp4': { width: 1088, height: 720, durationSeconds: 14.94 },
  '/media/promptfeed/videos/3227_neo-seoul-overdrive-30-second-mecha-transformation.mp4': { width: 1280, height: 720, durationSeconds: 30.14 },
  '/media/promptfeed/videos/3275_glow-up-time.mp4': { width: 1280, height: 720, durationSeconds: 15.14 },
  '/media/promptfeed/videos/3283_whole-life-cycle-time-lapse-of-a-seed-in-a-glass-jar.mp4': { width: 1280, height: 720, durationSeconds: 15.08 },
  '/media/promptfeed/videos/3285_morning-rush-cinematic-sequence-prompt.mp4': { width: 1280, height: 720, durationSeconds: 15.14 },
  '/media/promptfeed/videos/3304_ultra-realistic-ugc-luxury-fashion-review-of-cap-and-shoes-i.mp4': { width: 1248, height: 1664, durationSeconds: 29.34 },
  '/media/promptfeed/videos/3310_handheld-selfie-vlog-eating-oden-in-hotel-room.mp4': { width: 1280, height: 720, durationSeconds: 30.14 },
  '/media/promptfeed/videos/3312_curious-fox-mountain-stream-vlog.mp4': { width: 1280, height: 720, durationSeconds: 30.11 },
  '/media/promptfeed/videos/3320_cozy-crochet-amigurumi-girl-ordering-pizza-seedance-2-5-stop.mp4': { width: 720, height: 1280, durationSeconds: 20.13 },
}

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

export type DemoLibraryEntry = {
  /**
   * Stable, source-qualified id — `"<collectionId>:<slug>"`.
   * Never a bare slug (slugs can repeat across libraries) and never a numeric
   * index (indexes shift when a source library is re-ingested).
   */
  id: string
  title: string
  /** Collection this demo belongs to. */
  collectionId: DemoCollectionId
  /** Human display name of the collection. */
  collectionName: string
  /** Absolute site path to the video file. */
  videoSrc: string
  /** Absolute site path to the poster file. */
  posterSrc: string
  /** Aspect ratio as `"W:H"`. */
  aspectRatio: string
  /** Duration in seconds when known. */
  durationSeconds?: number
  /** Canonical category. */
  category: DemoCategory
  /** Style hint from the source catalog (its `rawCategory` / first tag). */
  style: string
  /** Slug within the source collection (unique inside its collection). */
  slug: string
  /** `sourceRepo` key used by `getCreateUrl()` template ids. */
  sourceRepo: string
  /** Studio tab this demo routes to. */
  studioTab: string
  /** The original generation prompt. */
  prompt: string
  /** Free-form tags from the source catalog. */
  tags: string[]
  /** The source catalog's own raw category string. */
  rawCategory: string
  /** The source catalog's use-case string. */
  useCase: string
  /** The source catalog's numeric id (unique only WITHIN its collection). */
  legacyId: number
  /** The source catalog's duration label, e.g. `"15s"`. */
  durationLabel?: string
  featured?: boolean
  hero?: boolean
  interactive?: boolean
  /** Original source URL for attribution. */
  sourceUrl?: string
  /** Optional model id to pre-select in the target studio. */
  model?: string
  /** Optional model display name. */
  modelName?: string
  /** Probed facts for the real file behind `videoSrc`. */
  media: DemoMediaFacts
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** Aspect ratios a probed file is snapped to when the catalog is silent. */
const STANDARD_ASPECT_RATIOS = [
  '1:1',
  '4:3',
  '3:4',
  '5:4',
  '4:5',
  '3:2',
  '2:3',
  '16:9',
  '9:16',
  '21:9',
] as const

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a
}

/** Derive an `"W:H"` aspect ratio string from real pixel dimensions. */
export function deriveAspectRatio(facts: DemoMediaFacts): string {
  const ratio = facts.width / facts.height
  let best: string = ''
  let bestDelta = Number.POSITIVE_INFINITY
  for (const candidate of STANDARD_ASPECT_RATIOS) {
    const [w, h] = candidate.split(':').map(Number)
    const delta = Math.abs(w / h - ratio)
    if (delta < bestDelta) {
      bestDelta = delta
      best = candidate
    }
  }
  // Only snap when the file is genuinely close to the standard ratio;
  // otherwise keep the exact reduced ratio so nothing is misrepresented.
  if (best && bestDelta <= 0.05) return best
  const divisor = gcd(facts.width, facts.height) || 1
  return `${Math.round(facts.width / divisor)}:${Math.round(facts.height / divisor)}`
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function styleHint(demo: VideoDemo): string {
  const raw = typeof demo.rawCategory === 'string' ? demo.rawCategory.trim() : ''
  if (raw) return raw
  const tag = Array.isArray(demo.tags) ? demo.tags.find((t) => typeof t === 'string' && t.trim()) : undefined
  if (tag) return tag.trim()
  return demo.category
}

const SOURCE_LIBRARIES: ReadonlyArray<{
  id: DemoCollectionId
  label: string
  sourceUrl: string
  demos: VideoDemo[]
}> = [
  {
    id: 'minimax-h3',
    label: 'MiniMax H3',
    sourceUrl: 'https://github.com/Anil-matcha/awesome-minimax-h3-prompts',
    demos: MINIMAX_H3_DEMOS,
  },
  {
    id: 'promptfeed',
    label: 'PromptFeed',
    sourceUrl: 'https://github.com/Hanyuyu/visual-prompt-feed',
    demos: PROMPTFEED_DEMOS,
  },
  {
    id: 'seedance-1',
    label: 'Seedance 1',
    sourceUrl: 'https://github.com/ZeroLu/awesome-seedance',
    demos: SEEDANCE_1_DEMOS,
  },
  {
    id: 'seedance-25',
    label: 'Seedance 2.5',
    sourceUrl: 'https://github.com/BeatAPI/awesome-seedance-2-5-prompts',
    demos: SEEDANCE_25_DEMOS,
  },
]

function buildRegistry(): DemoLibraryEntry[] {
  const entries: DemoLibraryEntry[] = []
  const seenIds = new Set<string>()

  for (const library of SOURCE_LIBRARIES) {
    for (const demo of library.demos) {
      // A demo is only registered when its file was probed and verified.
      const media = DEMO_MEDIA_FACTS[demo.videoSrc]
      if (!media) continue
      // Never register a demo without playable local media.
      if (!demo.videoSrc || demo.videoSrc.startsWith('blob:') || demo.videoSrc.startsWith('http')) continue
      if (!demo.posterSrc) continue

      const id = `${library.id}:${demo.slug}`
      if (seenIds.has(id)) continue
      seenIds.add(id)

      const durationSeconds = positiveNumber(demo.duration) ?? media.durationSeconds

      entries.push({
        id,
        title: demo.title,
        collectionId: library.id,
        collectionName: library.label,
        videoSrc: demo.videoSrc,
        posterSrc: demo.posterSrc,
        aspectRatio: demo.aspectRatio || deriveAspectRatio(media),
        durationSeconds,
        category: demo.category,
        style: styleHint(demo),
        slug: demo.slug,
        sourceRepo: demo.sourceRepo,
        studioTab: demo.studioTab,
        prompt: demo.prompt,
        tags: demo.tags ?? [],
        rawCategory: demo.rawCategory,
        useCase: demo.useCase,
        legacyId: demo.id,
        durationLabel: demo.durationLabel,
        featured: demo.featured,
        hero: demo.hero,
        interactive: demo.interactive,
        sourceUrl: demo.sourceUrl,
        model: demo.model,
        modelName: demo.modelName,
        media,
      })
    }
  }

  return entries
}

/** Every eligible demo video in the library, across all collections. */
export const DEMO_LIBRARY_REGISTRY: readonly DemoLibraryEntry[] = buildRegistry()

/** Collection metadata, in registry order. */
export const demoCollections: readonly DemoCollectionMeta[] = SOURCE_LIBRARIES.map((library) => ({
  id: library.id,
  label: library.label,
  sourceRepo: library.id,
  sourceUrl: library.sourceUrl,
  count: DEMO_LIBRARY_REGISTRY.filter((entry) => entry.collectionId === library.id).length,
}))

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const REGISTRY_BY_ID = new Map(DEMO_LIBRARY_REGISTRY.map((entry) => [entry.id, entry]))

/** Look up a demo by its stable source-qualified id. */
export function getDemoById(id: string): DemoLibraryEntry | undefined {
  return REGISTRY_BY_ID.get(id)
}

/** All registered demos of one collection, in registry order. */
export function getDemosByCollection(collectionId: DemoCollectionId): DemoLibraryEntry[] {
  return DEMO_LIBRARY_REGISTRY.filter((entry) => entry.collectionId === collectionId)
}

/** All registered demos of one canonical category, in registry order. */
export function getDemosByCategory(category: DemoCategory): DemoLibraryEntry[] {
  return DEMO_LIBRARY_REGISTRY.filter((entry) => entry.category === category)
}

/** Probed media facts for a video path, when the file was verified. */
export function getMediaFacts(videoSrc: string): DemoMediaFacts | undefined {
  return DEMO_MEDIA_FACTS[videoSrc]
}

/**
 * Convert a registry entry back into the legacy `VideoDemo` shape so every
 * existing consumer (`getCreateUrl()`, the landing showcase, the demo pages,
 * `buildDemoPersonalizeSource()`) keeps working unchanged.
 */
export function toVideoDemo(entry: DemoLibraryEntry): VideoDemo {
  return {
    id: entry.legacyId,
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    rawCategory: entry.rawCategory,
    useCase: entry.useCase,
    duration: entry.durationSeconds,
    durationLabel: entry.durationLabel,
    aspectRatio: entry.aspectRatio,
    videoSrc: entry.videoSrc,
    posterSrc: entry.posterSrc,
    prompt: entry.prompt,
    featured: entry.featured,
    hero: entry.hero,
    interactive: entry.interactive,
    studioTab: entry.studioTab,
    tags: entry.tags,
    sourceUrl: entry.sourceUrl,
    sourceRepo: entry.sourceRepo,
    model: entry.model,
    modelName: entry.modelName,
  }
}

/** The legacy `VideoDemo[]` view of the whole registry. */
export const DEMO_LIBRARY_VIDEO_DEMOS: VideoDemo[] = DEMO_LIBRARY_REGISTRY.map(toVideoDemo)
