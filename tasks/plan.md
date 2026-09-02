# Implementation Plan: Minimax + Academy Example Galleries

## Overview
Add horizontally scrolling example galleries to the bottom of 10 creation studios. Two independent content systems—30 Minimax demos and 103 Academy assets—share the same gallery component pattern. All galleries sit below existing studio controls and generate buttons.

## Architecture

### Two Parallel Systems
- Minimax: query param `template=minimax-h3-{slug}` → `CATEGORY_ROUTES` → studio
- Academy: query param `academy-template={slug}` → `studio` field → studio

Both use the same in-studio gallery pattern with "View Prompt" and "Create This Style" actions.

## Complete Asset Routing

### Minimax Demos → Studios (30)
| Studio | Route | Count |
|---|---|---|
| Cinema Studio | `cinema` | 7 |
| Commercial Studio | `commercial` | 7 |
| Video Studio | `video` | 7 |
| Character Studio | `character` | 2 |
| AI Influencer | `influencer` | 3 |
| AI VFX | `ai-vfx` | 2 |

### Academy Assets → Studios (103)
| Studio | Route | Count |
|---|---|---|
| Commercial Studio | `commercial` | 8 |
| Video Studio | `video` | 12 |
| Character Studio | `character` | 16 |
| Cinema Studio | `cinema` | 8 |
| AI Influencer | `influencer` | 8 |
| Image Studio | `image` | 10 |
| Audio Studio | `audio` | 5 |
| Effects Studio | `effects` | 10 |
| Edit Studio | `edit` | 5 |
| Storyboard Studio | `storyboard` | 5 |

## Implementation Phases

### Phase 1: Foundation
1. Create `src/data/academyAssets.js` — 103 asset entries
2. Create `src/data/academyStudioAdapters.js` — 10 studio adapters
3. Create `src/lib/academyTemplateBridge.js` — `useAcademyTemplate()` helper
4. Mirror academy media to `public/media/academy/track-01/` through `track-15/`
5. Create `public/media/academy/ATTRIBUTION.md`

### Phase 2: Shared Gallery Component
6. Create `src/components/studios/ExampleGallery.jsx` — reusable horizontal scroll gallery
7. Props: `title`, `assets`, `getSlug`, `getHref`, `onViewPrompt`
8. Lazy-load video posters; mobile snap scroll; in-place apply when source === current route

### Phase 2b: Minimax Bridge
9. Create `src/lib/minimaxTemplateBridge.js` — `useMinimaxTemplate()` wrapper
10. Update `src/data/minimaxH3Demos.js` if needed for prompt data

### Phase 3: Studio Integration — Priority (Weeks 2-3)
11. Commercial Studio — 8 academy + 7 minimax = 15 cards
12. Video Studio — 12 academy + 7 minimax = 19 cards
13. Character Studio — 16 academy + 2 minimax = 18 cards
14. Cinema Studio — 8 academy + 7 minimax = 15 cards
15. AI Influencer — 8 academy + 3 minimax = 11 cards
16. Image Studio — 10 academy + 0 minimax = 10 cards

### Phase 4: Studio Integration — Secondary (Week 4)
17. Audio Studio — 5 academy cards
18. Effects Studio — 10 academy cards
19. Edit Studio — 5 academy cards
20. Storyboard Studio — 5 academy cards

### Phase 5: Landing Page (Week 4)
21. Add academy showcase section to `LandingPage.jsx`
22. Add minimax academy CTA atoms if needed

### Phase 6: Testing (Week 5)
23. Verify all 133 assets route correctly
24. Test in-place apply within studios
25. Test cross-studio navigation
26. Mobile responsive testing
27. Performance testing with lazy loading

## Gallery Design Specification

### Placement
- Located at the **bottom** of each studio page, below all controls and generate buttons
- Full-width section with max-width constraint for content
- Fixed height with horizontal scroll

### Visual Design
```
┌─────────────────────────────────────────────────────┐
│  From the Academy / Example Demos                    │
│  ─────────────────────────────────────────           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Card │ │ Card │ │ Card │ │ Card │ │ Card │ →     │
│  │  1   │ │  2   │ │  3   │ │  4   │ │  5   │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  [video/gif preview]                                │
│  Title text                                         │
│  Track badge                                        │
│  [View Prompt] [Create This Style]                  │
└─────────────────────────────────────────────────────┘
```

### Card Specifications
- Width: 240px fixed
- Height: 320px fixed
- Media: 16:9 or 9:16 video/GIF with poster fallback
- Title: 1-2 lines max, truncate
- Badge: Small pill showing track/source
- Actions: Two buttons side by side

### Scroll Behavior
- Horizontal scroll with `overflow-x: auto`
- Snap scrolling on mobile
- Lazy load media as cards enter viewport
- Smooth scroll behavior

### Responsive Breakpoints
- Desktop: 4-5 cards visible
- Tablet: 3 cards visible
- Mobile: 1.5-2 cards visible, snap scroll

## Files to Create

| File | Purpose |
|---|---|
| `src/data/academyAssets.js` | Academy asset manifest (103 entries) |
| `src/data/academyStudioAdapters.js` | Per-studio template adapters |
| `src/lib/academyTemplateBridge.js` | `useAcademyTemplate()` helper |
| `src/lib/minimaxTemplateBridge.js` | `useMinimaxTemplate()` helper |
| `src/components/studios/ExampleGallery.jsx` | Reusable gallery component |
| `public/media/academy/ATTRIBUTION.md` | Upstream attribution |
| `public/media/academy/track-01/` through `track-15/` | Mirrored media files |

## Files to Modify

| File | Changes |
|---|---|
| `src/components/CommercialStudio.js` | Add gallery import + mount |
| `src/components/VideoStudio.js` | Add gallery import + mount |
| `src/components/CharacterStudio.js` | Add gallery import + mount |
| `src/components/CinemaStudio.js` | Add gallery import + mount |
| `src/components/InfluencerStudio.js` | Add gallery import + mount |
| `src/components/ImageStudio.js` | Add gallery import + mount |
| `src/components/AudioStudio.js` | Add gallery import + mount |
| `src/components/EffectsStudio.js` | Add gallery import + mount |
| `src/components/EditStudio.js` | Add gallery import + mount |
| `src/components/StoryboardStudio.js` | Add gallery import + mount |
| `src/components/landing/LandingPage.jsx` | Add academy section |

## What We Are NOT Doing
- Not creating an "Academy" studio — assets route to existing studios
- Not duplicating academy markdown — lessons stay in upstream repo
- Not building an in-app lesson viewer — link out to GitHub
- Not changing Minimax integration — additive parallel system
- Not claiming academy prompts are complete — they're frameworks/scripts for user adaptation

## Work State

### Completed
- `src/data/academy/catalog.js` — Auto-generated 103-entry `ACADEMY_ASSETS` manifest with `getAssetById`, `thumbnail`/`src` paths, and `ACADEMY_TRACKS`/`ACADEMY_LESSONS`/`ACADEMY_TEMPLATE_META`.
- `src/data/academyAssets.js` — Thin public re-export wrapper around `academy/catalog.js`.
- `src/data/academyStudioAdapters.js` — 31 studio adapter entries mapping academy asset IDs to studio routes, prompts, style presets, aspect ratios, and tags.
- `src/data/minimaxH3Demos.js` — 30-entry demo manifest with `posterSrc`, `videoSrc`, `CATEGORY_ROUTES`, and `getCreateTarget()`.
- `src/lib/exampleGalleryBridge.js` — Unified bridge handling `handleCreateThisStyle` and `handleViewPrompt` for both Minimax and Academy sources.
- `src/components/studios/ExampleGallery.js` — Reusable horizontal-scroll gallery component.
- `public/media/minimax-h3/` — 30 videos (`/media/minimax-h3/videos/*.webm`) and 30 previews (`/media/minimax-h3/previews/*.webp`/`.jpg`); all 30 poster and video paths verified present.
- `public/academy/` — Mirrored upstream media (images, gifs, videos) for tracks 02, 03, 07, 10, 11, 12; all 103 academy `thumbnail`/`src` paths verified present.
- Studio integration (partial):
  - Cinema Studio — mounted
  - Video Studio — mounted
  - Image Studio — mounted
- Landing page — academy showcase section mounted in `LandingPage.jsx`.

### Remaining
- `src/lib/academyTemplateBridge.js` — Not created (functionality absorbed into `exampleGalleryBridge.js`).
- `src/lib/minimaxTemplateBridge.js` — Not created (functionality absorbed into `exampleGalleryBridge.js`).
- Studio integration (7 studios remaining):
  - Audio Studio
  - Character Studio
  - Commercial Studio
  - Edit Studio
  - Effects Studio
  - Influencer Studio
  - Storyboard Studio
- Verify remaining academy tracks (04, 05, 06, 08, 09, 13, 14, 15) have mirrored media in `public/academy/` if not already present.

## MiniMax + Academy Gallery Summary

### File List
| Layer | Files |
|---|---|
| Data | `src/data/minimaxH3Demos.js`, `src/data/academy/catalog.js`, `src/data/academyAssets.js`, `src/data/academyStudioAdapters.js` |
| Logic | `src/lib/exampleGalleryBridge.js` |
| UI | `src/components/studios/ExampleGallery.js` |
| Media | `public/media/minimax-h3/{videos,previews}/`, `public/academy/{track-XX}/{images,gifs,videos}/` |

### Routing Behavior
- **MiniMax (30 demos):** Each demo carries `posterSrc` and `videoSrc` under `/media/minimax-h3/`. "Create This Style" uses `CATEGORY_ROUTES[demo.category]` to navigate to a studio route with query params `template=minimax-h3-{slug}&ref=minimax-h3`. "View Prompt" lazy-loads `minimaxH3Prompts.js` and shows a modal.
- **Academy (103 assets):** Each adapter references an asset ID resolved via `getAssetById()` in `academy/catalog.js`. Thumbnails fall back to `asset.src`. "Create This Style" uses `getAcademyCreateTarget()` to navigate to the adapter's `studio` route with `academy-template={assetId}` plus prompt/style/aspect_ratio/duration params. "View Prompt" navigates to `#/academy?template={assetId}`.
- **Gallery component:** `ExampleGallery({ studioId, assets, maxCards })` filters the shared `EXAMPLE_ASSETS` array by studio, renders up to `maxCards` cards with poster/video preview, title, tags, and two action buttons. Studios without matching assets render an empty state.

## Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 103 academy media files add bundle weight | High | Lazy-load gallery videos; use poster images |
| Academy prompts are frameworks, not complete | Medium | Present as "script templates" / "prompt frameworks" |
| Query param collision | Low | `template` vs `academy-template` — separate namespaces |
| Studios without gallery pattern | Medium | Each studio gets same gallery component pattern |
| Media mirroring maintenance | Low | `ATTRIBUTION.md` + stable slugs; mirror script can be re-run |
