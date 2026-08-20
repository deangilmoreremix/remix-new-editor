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

## Key Risks
| Risk | Impact | Mitigation |
|---|---|---|
| 103 academy media files add bundle weight | High | Lazy-load gallery videos; use poster images |
| Academy prompts are frameworks, not complete | Medium | Present as "script templates" / "prompt frameworks" |
| Query param collision | Low | `template` vs `academy-template` — separate namespaces |
| Studios without gallery pattern | Medium | Each studio gets same gallery component pattern |
| Media mirroring maintenance | Low | `ATTRIBUTION.md` + stable slugs; mirror script can be re-run |
