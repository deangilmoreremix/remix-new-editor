# Why We Only Enhanced a Subset of Studios — and the Complete Plan for All of Them

## The Short Answer

We prioritized the studios where the audited repo content actually applies. The external repos are almost entirely about **video generation, image generation, prompt engineering, model selection, and automation workflows**. That naturally maps to the video/image/create studios. The other studios — tools, home pages, placeholder routes — don't have relevant content in these repos.

But that doesn't mean they should be ignored. This document provides the **complete studio-by-studio mapping** with three tiers:
- **Tier 1:** Direct, immediate enhancements from repo content
- **Tier 2:** Indirect enhancements via shared infrastructure (model catalog, templates, prompts)
- **Tier 3:** No direct enhancement from these repos, but noted for future work

---

## Complete Studio Inventory and Enhancement Plan

### Functional Studios with Component Files (18 core studios)

| Route Key | Label | Component File | Tier | Enhancement Plan |
|---|---|---|---|---|
| `apps` | Apps | `AppsHub.js` | 3 | No direct enhancement. Could feature "Apps Built with AI" showcase using ai-creator-academy case studies. |
| `explore` | Explore | `ExplorePage.js` | 2 | Add model comparison widget from awesome-ai-video-models / awesome-ai-image-models. Add "Trending Prompts" section from prompt libraries. |
| `image` | Image Studio | `ImageStudio.js` | 1 | Add FLUX 3 image prompts, Grok Imagine multi-reference editing, product photography templates, Nano Banana Pro presets. Add model comparison sidebar. |
| `video` | Video Studio | `VideoStudio.js` | 1 | Full enhancement: Seedance 2.5, MiniMax H3, Wan 3.0, FLUX 3 Video models. Template prompt library dropdown. First/last-frame mode. Reference mode panel. Native audio toggle. |
| `cinema` | Cinema Studio | `CinemaStudio.js` | 1 | Full enhancement: Seedance 2.5 variants (standard/intl/spicy), 4K resolution, camera vocabulary panel (15 moves, 11 lighting keywords), character sheet upload, omni reference panel, duration to 30s. Cinematic template gallery (10 prompts). |
| `storyboard` | Storyboard Studio | `StoryboardStudio.js` | 1 | Add Seedance multi-shot sequence templates. Shot script format support (timecodes, beat sheets). Import storyboard templates from awesome-seedance-2.5-api-prompts (multi-shot section). Add "Shot Script" output mode. |
| `effects` | Effects Studio | `EffectsStudio.js` | 1 | Add Wan 3.0 video effect presets. FLUX 3 Video effect presets with native audio sync. Seedance 2.5 video edit presets (background swap, object removal, style transfer). |
| `edit` | Edit Studio | `EditStudio.js` | 1 | Add Grok Imagine Image 2 multi-reference tool (up to 5 images). Add FLUX 3 image-to-image. Add reference recipe panel (same-dancer-new-room, product-page-breathes). Add Nano Banana Pro edit presets. |
| `upscale` | Upscale Suite | `UpscaleStudio.js` | 2 | Add model comparison data for upscaling models (Topaz Video AI, FlashVSR, Video2X, REAL Video Enhancer from awesome-ai-video-models). Add pricing calculator for upscale operations. |
| `character` | Character Studio | `CharacterStudio.js` | 1 | Add Seedance 2.5 character consistency workflow. Character sheet generation panel. Outfit description input. Character ID storage and reuse. Import character templates from awesome-minimax-h3-prompts (fashion, anime). |
| `commercial` | Commercial Studio | `CommercialStudio.js` | 1 | Add MiniMax H3 ads & products templates (product commercial formula). Seedance 2.5 brand film templates (Crystal Ball Match-Cut, Mechanical Flower Bloom). Add pricing calculator using ai-creator-academy anchors. |
| `audio` | Audio Studio | `AudioStudio.js` | 2 | Add audio generation recipes from Generative-Media-Skills (TTS, sound effects, music). Add MiniMax H3 audio references (if supported). Add audio-led video template support (night-market-sound-map pattern). |
| `avatar` | Avatar Studio | `AvatarStudio.js` | 2 | Add avatar prompt templates from ai-creator-academy Track 5 (AI Avatars & Influencers). Add talking-head video recipes. Add HeyGen/Synthesia/D-ID comparison data. |
| `training` | Training Studio | `TrainingStudio.js` | 3 | No direct enhancement from these repos. Could eventually host ai-creator-academy curriculum content, but that's a separate initiative. |
| `videotools` | Video Tools | `VideoToolsStudio.js` | 2 | Add workflow recipe shortcuts from Generative-Media-Skills (41 recipes). Add clipping, highlight extraction, YouTube Shorts presets. Add video enhancement presets (upscale, denoise, interpolate). |
| `chat` | Chat Studio | `ChatStudio.js` | 2 | Add Fable 5 integration patterns from awesome-claude-fable-5. Add model selector with Fable 5, GPT-5.5, Claude Opus 4.8. Add coding agent workflow templates. |
| `lipsync` | Lip Sync | `LipSyncStudio.js` | 2 | Add audio-sync workflow templates. Add Seedance 2.5 generate_audio toggle pattern. Add MMuAPI audio tools integration (from Generative-Media-Skills). |
| `influencer` | AI Influencer | `InfluencerStudio.js` | 1 | Add MiniMax H3 fashion/social templates (fashion, vlog, music, viral short). Add UGC-style preset prompts. Add influencer persona templates from ai-creator-academy Track 5. |
| `templates` | Templates | `TemplatesPage.js` | 1 | Add model-family filter (Seedance 2.5, MiniMax H3, FLUX 3, Wan 3.0, Grok Imagine). Add Launch It monetization panels. Add recipe pack browser. Add template categories from all prompt repos. |
| `community` | Community | `CommunityPage.js` | 3 | No direct enhancement from these repos. Could eventually feature user-generated templates and prompt sharing, but that's a separate social feature. |
| `assist` | Assist | `AssistPage.js` | 2 | Add prompt engineering assistant using camera vocab and lighting keywords from Seedance 2.5 guide. Add template curator assistant. |
| `text-to-image` | Text to Image | `TextToImagePage.js` | 1 | Add FLUX 3 image prompts, Grok Imagine multi-reference, Nano Banana Pro presets. Add model comparison widget. Add prompt enhancer with 5-part FLUX formula. |
| `image-to-image` | Image to Image | `ImageToImagePage.js` | 1 | Add FLUX 3 image-to-image editing presets (background swap, style transfer, character consistency). Add Grok Imagine multi-reference (up to 5 images). Add Nano Banana Pro edit. |
| `text-to-video` | Text to Video | `TextToVideoPage.js` | 1 | Add Seedance 2.5, MiniMax H3, Wan 3.0, FLUX 3 Video models. Template prompt library. 6-step formula helper. Camera vocab panel. |
| `image-to-video` | Image to Video | `ImageToImagePage.js` | 1 | Add first/last-frame mode. Reference mode. MiniMax H3 i2v, Seedance 2.5 i2v, FLUX 3 i2v, Wan 3.0 i2v. Template prompt library. |
| `video-to-video` | Video to Video | `VideoToVideoPage.js` | 1 | Add Seedance 2.5 video edit/extend. Add Wan 3.0 reference-to-video. Add style transfer presets. Add background swap presets. |
| `video-watermark` | Watermark Remover | `VideoWatermarkPage.js` | 2 | Add Seedance 2.5 video edit preset for object removal. Add model comparison for watermark removal tools. |
| `video-agent` | Video Agent | `VideoAgentPage.js` | 1 | Add new agent categories: Prompt Engineering Agent, Camera Director Agent, Template Curator Agent, Model Router Agent. Add Fable 5 integration patterns. |
| `director` | Director | `DirectorPage.js` | 1 | Add 41 workflow recipes from Generative-Media-Skills as executable agent pipelines. Add Fable 5 relay workflow pattern. Add model router agent. Add pricing advisor agent. |
| `ai-vfx` | AI VFX | `AIVFXPage.js` | 1 | Add Seedance 2.5 video edit VFX presets. Add Wan 3.0 motion control presets. Add FLUX 3 Video effect presets. |
| `render` | Video Render | `RenderPage.js` | 2 | Add render queue with pricing estimates. Add model selection for final output. Add format/quality presets based on model capabilities. |
| `timeline` | Timeline | `TimelineEditorPage.jsx` | 2 | Add Seedance 2.5 multi-shot timeline templates. Add shot script import from timecode format. Add audio track sync helpers. |
| `library` | Library | `LibraryPage.js` | 2 | Add template library browser. Add prompt library browser. Add model comparison cards. Add recipe pack browser. |
| `content-library` | Content Library | `ContentLibraryPage.js` | 2 | Add generated content tagging with template/project metadata. Add monetization track categorization. Add licensing guidance from ai-creator-academy. |

### Page Routes (duplicate/simplified versions of studios)

| Route Key | Label | Component File | Tier | Enhancement Plan |
|---|---|---|---|---|
| `character-page` | Character | `CharacterPage.js` | 1 | Same as CharacterStudio — character sheet workflow, Seedance 2.5 consistency. |
| `cinema-page` | Cinema Studio | `CinemaPage.js` | 1 | Same as CinemaStudio — Seedance 2.5, camera vocab, cinematic templates. |
| `effects-page` | Vibe Motion | `EffectsPage.js` | 1 | Same as EffectsStudio — Wan 3.0, FLUX 3, Seedance 2.5 VFX presets. |
| `storyboard-page` | Storyboard | `StoryboardPage.js` | 1 | Same as StoryboardStudio — multi-shot templates, shot scripts. |
| `influencer-page` | AI Influencer | `InfluencerPage.js` | 1 | Same as InfluencerStudio — MiniMax H3 fashion/social templates. |
| `commercial-page` | Commercial | `CommercialPage.js` | 1 | Same as CommercialStudio — ads, brand films, pricing calculator. |
| `upscale-page` | Upscale | `UpscalePage.js` | 2 | Same as UpscaleStudio — upscaling model comparison, pricing. |

### Placeholder / No Component Routes

| Route Key | Label | Status | Tier | Notes |
|---|---|---|---|---|
| `impeccable` | Impeccable | Placeholder | 3 | 22 `impeccable-*` sub-variants have no component files. These are future tool sub-views. No repo content applies yet. |
| `impeccable-craft` | Impeccable · Craft | No component | 3 | Future sub-view. |
| `impeccable-init` | Impeccable · Init | No component | 3 | Future sub-view. |
| `impeccable-document` | Impeccable · Document | No component | 3 | Future sub-view. Document generation could use Fable 5 / Claude patterns. |
| `impeccable-extract` | Impeccable · Extract | No component | 3 | Future sub-view. |
| `impeccable-shape` | Impeccable · Shape | No component | 3 | Future sub-view. |
| `impeccable-critique` | Impeccable · Critique | No component | 3 | Future sub-view. Could use Fable 5 review patterns. |
| `impeccable-audit` | Impeccable · Audit | No component | 3 | Future sub-view. Could use Fable 5 PR review patterns. |
| `impeccable-polish` | Impeccable · Polish | No component | 3 | Future sub-view. |
| `impeccable-bolder` | Impeccable · Bolder | No component | 3 | Future sub-view. |
| `impeccable-quieter` | Impeccable · Quieter | No component | 3 | Future sub-view. |
| `impeccable-distill` | Impeccable · Distill | No component | 3 | Future sub-view. |
| `impeccable-harden` | Impeccable · Harden | No component | 3 | Future sub-view. |
| `impeccable-onboard` | Impeccable · Onboard | No component | 3 | Future sub-view. |
| `impeccable-animate` | Impeccable · Animate | No component | 3 | Future sub-view. Animation could use Seedance/FLUX presets. |
| `impeccable-colorize` | Impeccable · Colorize | No component | 3 | Future sub-view. |
| `impeccable-typeset` | Impeccable · Typeset | No component | 3 | Future sub-view. |
| `impeccable-layout` | Impeccable · Layout | No component | 3 | Future sub-view. |
| `impeccable-delight` | Impeccable · Delight | No component | 3 | Future sub-view. |
| `impeccable-clarify` | Impeccable · Clarify | No component | 3 | Future sub-view. |
| `impeccable-adapt` | Impeccable · Adapt | No component | 3 | Future sub-view. |
| `impeccable-optimize` | Impeccable · Optimize | No component | 3 | Future sub-view. |
| `impeccable-live` | Impeccable · Live | No component | 3 | Future sub-view. |
| `impeccable-overdrive` | Impeccable · Overdrive | No component | 3 | Future sub-view. |
| `contacts` | Contacts | PlaceholderPage | 3 | No component. No repo content applies. |
| `timeline-iframe-warning` | Timeline Warning | Inline div | 3 | Warning page. No enhancement needed. |
| `pexels-media` | Stock Media | `PexelsMediaPage.js` | 2 | Could add Pexels media browser enhancements, but that's outside these repos' scope. |

---

## Why We Focused on 8 Studios First

### The Content-Reality Check

The 15 audited repos contain:

| Content Type | Repos | Applies To |
|---|---|---|
| Video generation prompts (70+) | awesome-seedance-2.5, awesome-minimax-h3, awesome-flux-3 | VideoStudio, CinemaStudio, TemplateStudio |
| Image generation prompts | awesome-flux-3, Grok-Imagine-Image-2 | ImageStudio, EditStudio |
| Video model SDKs (5 families) | MiniMax-H3-API, Wan-3.0-API, Flux-3-Dev-API, flux-3-video-api, Seedance-2.5-API | VideoStudio, CinemaStudio, EffectsStudio |
| Image model SDKs (2 families) | Grok-Imagine-Image-2-API, Flux-3-Dev-API | ImageStudio, EditStudio |
| Prompt engineering guides | awesome-seedance-2.5, awesome-flux-3 | All create studios |
| Camera/lighting vocab | awesome-seedance-2.5 | CinemaStudio |
| Workflow recipes (41) | Generative-Media-Skills | DirectorPage, TemplateStudio |
| Monetization curriculum | ai-creator-academy | TemplateStudio, CommercialStudio |
| Model comparison data | awesome-ai-video-models, awesome-ai-image-models | Model catalog (all studios) |
| Fable 5 use cases | awesome-claude-fable-5 | DirectorPage, ChatStudio |
| ComfyUI nodes | seedance2.5-comfyui | Reference for workflow design |
| MCP servers | seedance-2.5-mcp, seedance-2-mcp | Backend automation |

**What's NOT in these repos:**
- UI/UX design patterns for non-video studios
- Content for placeholder routes (`impeccable-*`)
- Audio-specific generation content (only tangential references)
- Training/educational content (ai-creator-academy is about business, not tool training)
- Social/community features

### The Studio Relevance Matrix

```
RELEVANCE: High = repo content maps directly to studio's core purpose
            Medium = repo content enhances shared infrastructure or adjacent features
            Low = no direct mapping

Studio                    Relevance    Reason
--------------------------------------------------------------
VideoStudio               HIGH         Core video generation — all 5 video model families
CinemaStudio               HIGH         Cinematic prompts, camera vocab, Seedance 2.5 advanced features
TemplateStudio             HIGH         Template system — all 70+ prompts become templates
EditStudio                 HIGH         Image editing — Grok multi-reference, FLUX 3 i2i
EffectsStudio              HIGH         Video effects — Wan 3.0, FLUX 3, Seedance 2.5 edit
ImageStudio                HIGH         Image generation — FLUX 3, Grok Imagine, Nano Banana
StoryboardStudio           HIGH         Multi-shot sequences, shot scripts, Seedance templates
CharacterStudio            HIGH         Character consistency, Seedance 2.5 sheets
CommercialStudio           HIGH         Product ads, brand films, pricing calculator
InfluencerStudio           HIGH         Fashion/social templates, UGC content, MiniMax H3
DirectorPage               HIGH         Workflow recipes, agent pipelines, Fable 5 patterns
TextToImagePage            HIGH         Same as ImageStudio — direct model mapping
TextToVideoPage            HIGH         Same as VideoStudio — direct model mapping
ImageToVideoPage           HIGH         Same as VideoStudio — first/last-frame, reference
VideoToVideoPage           HIGH         Same as EffectsStudio — edit, style transfer
--------------------------------------------------------------
ExplorePage                MEDIUM       Model comparison widget, trending prompts
UpscaleStudio              MEDIUM       Upscaling model comparison, pricing
VideoToolsStudio           MEDIUM       Workflow recipes, clipping, highlights
AudioStudio                MEDIUM       Audio generation recipes, TTS presets
AvatarStudio               MEDIUM       Avatar templates, talking-head recipes
ChatStudio                 MEDIUM       Fable 5 integration, model selector
LibraryPage                MEDIUM       Template browser, prompt library, recipe pack
ContentLibraryPage         MEDIUM       Tagging, categorization, licensing guidance
AIVFXPage                  MEDIUM       VFX presets from video models
RenderPage                 MEDIUM       Render queue pricing, format presets
TimelineEditorPage         MEDIUM       Multi-shot timeline templates, audio sync
AssistPage                 MEDIUM       Prompt engineering assistant, template curator
VideoAgentPage             MEDIUM       Agent categories from repo workflows
--------------------------------------------------------------
AppsHub                    LOW          No direct mapping; could showcase AI-built apps
CommunityPage              LOW          No direct mapping; social features separate
TrainingStudio             LOW          No direct mapping; curriculum is business-focused
PexelsMediaPage            LOW          Stock media; outside repo scope
Contacts                   LOW          Placeholder
All impeccable-* routes    LOW          Placeholder routes without components
```

---

## The Tiered Enhancement Strategy

### Tier 1: Direct Model/Prompt Integration (8 studios)

These studios are the primary surface for the repo content. They get:
- New model entries in the selector
- Template prompt libraries
- Parameter panels expanded to match model capabilities
- Camera/lighting vocab panels
- Character sheet workflows
- Reference mode panels
- Native audio toggles
- Pricing/Launch It panels

**Studios:** VideoStudio, CinemaStudio, TemplateStudio, EditStudio, EffectsStudio, ImageStudio, StoryboardStudio, CharacterStudio, CommercialStudio, InfluencerStudio, DirectorPage, TextToImagePage, TextToVideoPage, ImageToVideoPage, VideoToVideoPage

**Effort:** 6-8 weeks of active development

### Tier 2: Shared Infrastructure Enhancement (10 studios)

These studios don't get new model families, but they benefit from:
- Model catalog enrichment (comparison data, pricing)
- Template browser integration
- Prompt engineering assistants
- Workflow recipe shortcuts
- Pricing calculators
- Audio sync helpers

**Studios:** ExplorePage, UpscaleStudio, VideoToolsStudio, AudioStudio, AvatarStudio, ChatStudio, LibraryPage, ContentLibraryPage, AIVFXPage, RenderPage, TimelineEditorPage, AssistPage, VideoAgentPage

**Effort:** 2-3 weeks of active development

### Tier 3: No Direct Enhancement (15+ studios)

These are either:
- Placeholder routes without components (`impeccable-*`, `contacts`)
- Home/navigation pages (`apps`, `community`)
- Outside repo scope (`pexels-media`, `training`)

**Studios:** AppsHub, CommunityPage, TrainingStudio, PexelsMediaPage, Contacts, all `impeccable-*` variants, `timeline-iframe-warning`

**Effort:** 0 weeks from these repos. These need separate product decisions.

---

## What "Enhancing a Studio" Actually Means

For Tier 1 studios, the enhancement is NOT just "add a model to the dropdown." It's:

1. **Model catalog entry** — add the model family with all parameters, constraints, pricing
2. **Studio UI panel** — add model-specific controls (variant select, quality toggle, resolution suffix, native audio, character sheet upload)
3. **Template bundle** — import curated prompts as clickable templates that pre-fill everything
4. **Prompt compilation** — extend templateEngine to handle model-specific prompt assembly
5. **Generation wiring** — extend MuapiClient with new methods, route resolution, parameter validation
6. **Analytics** — track which templates/models are used
7. **Error handling** — model-specific error messages, fallback behavior
8. **Documentation** — studio help text updated with new capabilities

For Tier 2 studios, it's lighter:
1. **Shared widget** — model comparison, pricing calculator, template browser
2. **Navigation link** — link to relevant templates/workflows in Tier 1 studios
3. **Contextual help** — prompt engineering tips, model selection guidance

---

## The Real Question: Why Not All Studios?

The honest answer: **most of the 60 routes are either placeholders or duplicates.**

| Category | Count | Example |
|---|---|---|
| Core create studios (real components) | ~18 | ImageStudio, VideoStudio, CinemaStudio... |
| Page routes (simplified duplicates) | ~7 | cinema-page, effects-page, storyboard-page... |
| Generate routes (direct creation) | ~6 | text-to-image, text-to-video, image-to-video... |
| Placeholder routes (no component) | ~22 | impeccable-*, contacts, timeline-iframe-warning |
| Home/nav pages | ~4 | apps, explore, templates, community |
| Tools/agents | ~3 | director, video-agent, ai-vfx |

The 22 `impeccable-*` routes are particularly notable — they're registered in `studioRoutes.js` but have **zero component files**. They're aspirational route names for a future tool suite that doesn't exist yet. Enhancing them would mean building the tools first, which is a product decision, not a content-integration decision.

The 7 `*-page` routes are simplified versions of the core studios. They share component code with their main counterparts (e.g., `cinema-page` uses `CinemaPage.js` which wraps `CinemaStudio.js`). Enhancing the main studio automatically enhances the page route.

---

## Updated Prioritization

### Sprint 1 (Weeks 1-4): Core Video/Image Studios
- VideoStudio, CinemaStudio, TemplateStudio, EditStudio, ImageStudio
- These are the highest-traffic creation surfaces
- They cover all 5 video model families + FLUX 3 + Grok Imagine

### Sprint 2 (Weeks 5-6): Adjacent Creation Studios
- EffectsStudio, StoryboardStudio, CharacterStudio, CommercialStudio, InfluencerStudio
- These build on the model catalog and template infrastructure from Sprint 1
- Character consistency, brand films, UGC content, multi-shot sequences

### Sprint 3 (Weeks 7-8): Tool & Agent Studios
- DirectorPage, VideoAgentPage, VideoToolsStudio, AIVFXPage, RenderPage, TimelineEditorPage
- Workflow recipes, agent pipelines, Fable 5 patterns
- These need the backend automation layer

### Sprint 4 (Weeks 9-10): Supporting Studios
- ExplorePage, LibraryPage, ContentLibraryPage, AudioStudio, AvatarStudio, ChatStudio, AssistPage
- Model comparison widgets, template browsers, prompt assistants
- These are "force multipliers" that make the Tier 1 studios discoverable

### Not Planned (Separate Initiative)
- All `impeccable-*` routes — need product specs first
- TrainingStudio — needs curriculum integration decision
- CommunityPage — needs social feature specs
- AppsHub — needs app showcase strategy

---

## Document Metadata

- **Created:** 2026-08-14
- **Purpose:** Explain the scoping decision and provide complete studio-by-studio mapping
- **Sources:** Full codebase audit of 60 studio routes, 15 external repos
- **Scope:** All studios mapped to Tier 1/2/3 enhancement levels
