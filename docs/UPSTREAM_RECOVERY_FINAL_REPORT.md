# UPSTREAM RECOVERY FINAL REPORT

**Source Repository:** `Anil-matcha/Open-Generative-AI`
**Clone Path:** `/tmp/open-generative-ai-upstream`
**Total Commits Analyzed:** 3,118
**Report Date:** 2026-08-11
**Current SmartVideo HEAD:** `7a8fb1a0` (develop)
**Worktree:** coral-cemetery

---

## EXECUTIVE SUMMARY

The forensic recovery investigated the complete upstream repository `Anil-matcha/Open-Generative-AI` (3,118 commits) against the current SmartVideo application. The investigation reveals a **fundamental architectural divergence**: the upstream is a Next.js/React monorepo with a studio set focused on media modalities (Image, Video, Cinema, Audio, LipSync, Clipping, Recast, VibeMotion, Workflow, Apps, Influencer, Agent), while SmartVideo is a vanilla JS app with a broader surface set including Character, Storyboard, Template, Effects, Edit, Commercial, VideoTools, Chat, Avatar, Training, Upscale, and more.

**Key finding:** SmartVideo has **19 studios that do not exist upstream** and upstream has **9 studios that do not exist in SmartVideo**. The correct recovery strategy is **selective integration** — port upstream patterns, controls, and assets into SmartVideo where SmartVideo is weaker, while preserving SmartVideo's unique features.

---

## 1. WHAT ADVANCED CONTROLS EXISTED UPSTREAM?

### Image Studio
- Model selector with T2I/I2I category tabs, provider logos, search (`ImageStudio.jsx:585-860`)
- Aspect ratio dropdown (schema-driven) (`ImageStudio.jsx:1617-1647`)
- Quality/Resolution dropdown (schema-driven) (`ImageStudio.jsx:1650-1682`)
- Effect type dropdown, I2I-only (schema-driven) (`ImageStudio.jsx:1685-1720`)
- Batch size stepper buttons (-/+) (`ImageStudio.jsx:1722-1741`)
- Draw button opening DrawModal (`ImageStudio.jsx:1743-1756`)
- Reference image upload with history grid (`ImageStudio.jsx:66-551`)
- Swap face upload (conditional on `swapField` in schema) (`ImageStudio.jsx:1543-1552`)
- Prompt textarea (`ImageStudio.jsx:1556-1561`)
- Generate button (`ImageStudio.jsx:1759-1774`)
- **Schema-only (no UI):** Negative prompt (Midjourney, Z-Image-P, Qwen3), seed, guidance/strength (hardcoded 0.6 in muapi.js:72)

### Video Studio
- Mode selector (T2V/I2V/V2V) — implicit state (`VideoStudio.jsx:471-472`)
- Model dropdown with 25 providers, category tabs, search (`VideoStudio.jsx:119-444`)
- Aspect ratio dropdown (schema-driven) (`VideoStudio.jsx:1963-2002`)
- Duration dropdown (schema-driven) (`VideoStudio.jsx:2057-2097`)
- Resolution dropdown (schema-driven) (`VideoStudio.jsx:2099-2139`)
- Quality dropdown (schema-driven) (`VideoStudio.jsx:2099-2139`)
- Mode selector (model-specific enum) (`VideoStudio.jsx:659, 490`)
- Effect type dropdown, I2V-only (schema-driven) (`VideoStudio.jsx:2004-2055`)
- Start frame / reference image upload (`VideoStudio.jsx:1620-1883`)
- End frame / last frame upload with END badge (`VideoStudio.jsx:983-1004, 1648-1651`)
- Multiple reference images with numbered chips (`VideoStudio.jsx:816-824, 1669-1687`)
- Draw reference button (`VideoStudio.jsx:2141-2161`)
- Seedance 2.0 extend mode banner + button (`VideoStudio.jsx:1385-1397, 1897-1912`)
- Drag & drop video upload (`VideoStudio.jsx:900-912`)
- **Not exposed:** FPS, guidance, steps, seed (exist in schema or muapi but not rendered)

### Cinema Studio
- Camera visual selector (ScrollColumn with images) (`CinemaStudio.jsx:492-498, 214-393`)
- Lens visual selector (ScrollColumn with images) (`CinemaStudio.jsx:499-504, 214-393`)
- Focal Length visual selector (ScrollColumn, text-only) (`CinemaStudio.jsx:506-511, 214-393`)
- Aperture visual selector (ScrollColumn with images) (`CinemaStudio.jsx:513-518, 214-393`)
- Aspect ratio dropdown (`CinemaStudio.jsx:1135-1161`)
- Resolution dropdown (`CinemaStudio.jsx:1163-1188`)
- Camera Builder (vanilla JS only, collapsible panel with 4 selects) (`CameraControls.js:189-355`)
- Prompt textarea (`CinemaStudio.jsx:1121`)
- Reference image upload (`CinemaStudio.jsx:1050-1118`)
- Generate button ("Shoot") (`CinemaStudio.jsx:1205-1219`)

### AI Influencer Studio
- 3 tabs: Face, Body, Style
- 20 subcategories with 118 total options:
  - Face (10 subcats, 65 options): Character Type, Gender, Ethnicity, Eye Color, Eye Type, Eye Features, Mouth & Teeth, Ears, Horns, Skin Conditions
  - Body (7 subcats, 43 options): Face Skin Material, Skin Pattern, Body Type, Left Arm, Right Arm, Left Leg, Right Leg
  - Style (3 subcats, 20 options): Hair/Head Growth, Accessories & Markings, Rendering Style
- Each option is an image-driven button with `{id, label, img, promptVal}`
- Shuffle randomizer button
- Aspect ratio button group (3:4, 1:1, 9:16, 16:9)
- Generate button
- HoverPill preview (72x72px tooltip thumbnail) — introduced by `cdce42a5`
- Selected tags bar with hoverable image thumbnails — introduced by `cdce42a5`

### Audio Studio
- Model selector dropdown (custom styled) (`AudioStudio.jsx:712-752`)
- Dynamic schema-driven boolean toggles (`AudioStudio.jsx:793-818`)
- Dynamic schema-driven enum dropdowns (`AudioStudio.jsx:821-873`)
- Dynamic schema-driven number sliders (`AudioStudio.jsx:877-906`)
- Dynamic schema-driven text inputs/textareas (`AudioStudio.jsx:909-962`)
- Prompt example chips (clickable) (`AudioStudio.jsx:922-934`)
- Audio file uploader (single, 20MB limit) (`AudioStudio.jsx:70-194`)
- Audio list uploader (multi-file, maxItems default 2) (`AudioStudio.jsx:199-228`)
- Generate button (`AudioStudio.jsx:970-989`)
- PremiumAudioPlayer with 18-bar equalizer (`AudioStudio.jsx:233-473`)

### Clipping Studio (Upstream-only)
- Video upload
- num_highlights control (default: 3)
- aspect_ratio control (default: "9:16")
- return_coordinates_only toggle (default: false)
- Generate button (runClipping API)

### Recast Studio (Upstream-only)
- Video upload (MediaPickerButton)
- Image upload (MediaPickerButton)
- Model selector dropdown
- Aspect ratio dropdown
- Character orientation dropdown (kling-v3.0-pro-recast only)
- Assets Library dropdown with tabs (videos/images/results)
- Prompt textarea (PromptComposer)
- Generate button

### Vibe Motion Studio (Upstream-only)
- Mode toggle: Generate / Edit (segmented control)
- Edit source picker dropdown
- Aspect ratio dropdown (16:9, 9:16, 1:1)
- Duration dropdown (5-30s options)
- Prompt textarea
- Generate/Remix button

### Workflow Studio (Upstream-only)
- Templates / My Workflows / Community tabs
- Playground / Full Workflow sub-tabs
- Schema-driven dynamic form inputs (textarea, select, text)
- Rename modal
- Run/Execute button with workflow execution

### Apps Studio (Upstream-only)
- 69 app cards (5 template + 64 dummy) with external CDN thumbnails
- Get Template modal (email-less interest registration)
- External repo/demo links on hover

### Shared PromptComposer System (Upstream-only)
- PromptComposer wrapper
- PromptTextarea (auto-resizing)
- PromptControls (container)
- PromptFooter (row wrapper)
- PromptAction (generate button)
- PromptPopover / PromptPopoverHeader / PromptMenuList / PromptMenuItem
- PromptChevronIcon / PromptAspectRatioIcon / PromptDurationIcon / PromptQualityIcon
- promptControlClassName / promptMediaButtonClassName (CSS helpers)

---

## 2. WHICH CONTROLS ARE MISSING FROM SMARTVIDEO?

| Control | Upstream Source | SmartVideo Status | Gap Severity |
|---------|----------------|-------------------|--------------|
| Negative prompt UI | `ImageStudio.jsx` schema | Missing (schema exists in models.js but no UI) | Medium |
| Seed UI | `ImageStudio.jsx` schema | Missing | Medium |
| Guidance/Strength UI | `muapi.js:72` (hardcoded 0.6) | Missing | Medium |
| Dynamic schema-driven controls (Audio) | `AudioStudio.jsx:763-964` | Partial (SmartVideo has hardcoded style/voice/tone) | High |
| Audio file uploaders | `AudioStudio.jsx:70-228` | Missing (basic upload only) | High |
| PremiumAudioPlayer | `AudioStudio.jsx:233-473` | Missing (uses WaveSurfer.js instead) | Medium |
| Audio history grid | `AudioStudio.jsx:1084-1119` | Missing | Medium |
| Audio toast notifications | `AudioStudio.jsx` throughout | Missing (uses inline errors) | Low |
| scopedPersistKey persistence | `persistKey.js` | Missing (raw localStorage keys) | Medium |
| HoverPill preview | `AiInfluencerStudio.jsx:304-335` | Missing | Low |
| Selected tags bar with image thumbnails | `AiInfluencerStudio.jsx:660-689` | Missing | Low |
| 118 influencer options | `AiInfluencerStudio.jsx` | Partial (SmartVideo has 20 style presets) | High |
| ClippingStudio controls | `ClippingStudio.jsx` | Missing entire studio | High |
| RecastStudio controls | `RecastStudio.jsx` | Missing entire studio | High |
| VibeMotionStudio controls | `VibeMotionStudio.jsx` | Missing entire studio | Medium |
| WorkflowStudio controls | `WorkflowStudio.jsx` | Missing entire studio | Medium |
| PromptComposer shared system | `PromptComposer.jsx` | Missing (architectural mismatch) | High |
| MediaPickerButton | `prompt/PromptComposer.jsx` | Missing (SmartVideo has UploadPicker.js) | Low |
| MobileGenerationActions | `MobileGenerationActions.jsx` | Missing | Low |
| GenerationCopyButtons | `MobileGenerationActions.jsx` | Missing | Low |
| formatErrorMessage | `utils/formatError.js` | Missing | Low |
| Empty state floating cards (CloudFront AVIFs) | `ImageStudio.jsx:1462-1491` | Missing | Low |
| Empty state floating cards (VideoStudio) | `VideoStudio.jsx:1572-1614` | Missing | Low |
| Avatar preset selector (8 avatars) | `MarketingStudio.jsx:92-100` | Missing | Medium |
| Avatar dropdown with preview | `MarketingStudio.jsx:661-706` | Missing | Medium |
| Avatar prev/next navigation | `MarketingStudio.jsx:838-950` | Missing | Medium |

---

## 3. WHAT PLAYGROUNDS EXISTED UPSTREAM?

| Playground | Studio | Description | Upstream File | Lines | Commit |
|-----------|--------|-------------|---------------|-------|--------|
| Model card selector | Image, Video | Visual card grid with provider logos, search, category tabs | `ImageStudio.jsx`, `VideoStudio.jsx` | 585-860, 119-444 | `9dfc4e8` |
| Upload history grid | Image | 3-column grid of uploaded image thumbnails with hover delete | `ImageStudio.jsx` | 446-530 | `9965718` |
| Reference image playground | Image, Video | UploadButton with popover panel, multi-select, history | `ImageStudio.jsx` | 66-551 | `9965718` |
| Drawing/sketch playground | Image, Video | DrawModal canvas with tools, undo/redo, color presets | `DrawModal.jsx` | 1326-1498 | `de01d6d` |
| Central history gallery | Video | Responsive grid with hover-to-play, overlay actions | `VideoStudio.jsx` | 1432-1615 | `8fadaed` |
| Empty state floating cards | Image, Video, Recast, LipSync, VibeMotion | 4 floating animated image cards | `ImageStudio.jsx`, `VideoStudio.jsx`, etc. | 1462-1491, 1572-1614 | `91ce11d` |
| ScrollColumn visual selector | Cinema | 4 vertical scrolling columns with snap behavior | `CinemaStudio.jsx` | 214-393 | `fdc28b80` |
| Visual attribute grid | Influencer | 3-column image grid with 118 options | `AiInfluencerStudio.jsx` | 17-279 | `5823f149` |
| HoverPill preview | Influencer | 72x72px tooltip thumbnail on selected tags | `AiInfluencerStudio.jsx` | 304-335 | `cdce42a5` |
| Selected tags bar | Influencer | Hoverable pills with image thumbnails below preview | `AiInfluencerStudio.jsx` | 660-689 | `cdce42a5` |
| History grid | Audio | Card-based selector with model badge, active state | `AudioStudio.jsx` | 1084-1119 | `8fadaed` |
| Audio player | Audio | PremiumAudioPlayer with 18-bar equalizer | `AudioStudio.jsx` | 233-473 | `cda3208` |
| Fullscreen video modal | Video, LipSync | Fixed overlay with native video controls | `VideoStudio.jsx`, `LipSyncStudio.jsx` | 2186-2213, 1130-1157 | `91ce11d` |
| Assets Library dropdown | Recast | Tabs: videos/images/results | `RecastStudio.jsx` | 160-311 | `6aa3372` |
| Workflow builder | Workflow | Schema-driven form + execution | `WorkflowStudio.jsx` | 590-651 | `6aa3372` |
| App card grid | Apps | 69 cards with hover actions | `AppsStudio.jsx` | 180-193 | `fe87f4a` |
| Get Template modal | Apps | Email-less interest registration | `AppsStudio.jsx` | 328-361 | `fe87f4a` |
| Prompt composer (shared) | All studios | Standardized prompt bar with controls | `PromptComposer.jsx` | 1-409 | `3cc1313` |
| Mobile actions menu | Image, Video | Mobile-specific action menu | `MobileGenerationActions.jsx` | — | `abd5c06` |
| Toast notifications | All studios | react-hot-toast overlay | (throughout) | — | `4c971d5` |

---

## 4. WHICH PLAYGROUNDS ARE MISSING FROM SMARTVIDEO?

| Playground | Upstream Source | SmartVideo Status | Recovery Priority |
|-----------|----------------|-------------------|-------------------|
| Empty state floating cards (ImageStudio) | `ImageStudio.jsx:1462-1491` | Missing | Low |
| Empty state floating cards (VideoStudio) | `VideoStudio.jsx:1572-1614` | Missing | Low |
| HoverPill preview (Influencer) | `AiInfluencerStudio.jsx:304-335` | Missing | Low |
| Selected tags bar (Influencer) | `AiInfluencerStudio.jsx:660-689` | Missing | Low |
| Audio history grid | `AudioStudio.jsx:1084-1119` | Missing | Medium |
| PremiumAudioPlayer | `AudioStudio.jsx:233-473` | Missing (WaveSurfer.js instead) | Medium |
| ClippingStudio | `ClippingStudio.jsx` (entire studio) | Missing | High |
| RecastStudio | `RecastStudio.jsx` (entire studio) | Missing | High |
| VibeMotionStudio | `VibeMotionStudio.jsx` (entire studio) | Missing | Medium |
| WorkflowStudio | `WorkflowStudio.jsx` (entire studio) | Missing | Medium |
| PromptComposer shared system | `PromptComposer.jsx` | Missing (architectural mismatch) | High |
| MobileGenerationActions | `MobileGenerationActions.jsx` | Missing | Low |
| GenerationCopyButtons | `MobileGenerationActions.jsx` | Missing | Low |
| scopedPersistKey persistence | `persistKey.js` | Missing (raw localStorage keys) | Medium |
| formatErrorMessage | `utils/formatError.js` | Missing | Low |
| Avatar preset selector | `MarketingStudio.jsx:92-100` | Missing | Medium |
| Avatar dropdown with preview | `MarketingStudio.jsx:661-706` | Missing | Medium |
| Avatar prev/next navigation | `MarketingStudio.jsx:838-950` | Missing | Medium |

---

## 5. WHAT SAMPLE IMAGES EXIST?

### Upstream Local Sample Images

| Asset | Path | Purpose | Commit |
|-------|------|---------|--------|
| `banner.png` | `/public/banner.png` | Site banner | `5db9f98` |
| `vite.svg` | `/public/vite.svg` | Vite logo | `5db9f98` |
| `javascript.svg` | `/src/javascript.svg` | JS icon | `5db9f98` |
| `thumbnail.png` | `/thumbnail.png` | Repo thumbnail | `f059ea6` |
| `thumbnail-ai-v2-1920x1080.png` | `/thumbnail-ai-v2-1920x1080.png` | AI thumbnail | `61e8ad5` |
| `video-27-minimax-hailuo-h3-guide-v3.png` | `/video-27-minimax-hailuo-h3-guide-v3.png` | Video guide | `e674d57` |
| `demo.mp4` | `/docs/assets/demo.mp4` | Demo video | `50f5bb3` |
| `generated_example.webp` | `/docs/assets/generated_example.webp` | Generated example | `50f5bb3` |
| `studio_demo.webp` | `/docs/assets/studio_demo.webp` | Studio demo | `c80b21b` |
| `video-23-thumbnail-v2.png` | `/docs/assets/video-23-thumbnail-v2.png` | Video thumb | `5517c1f` |
| `video-23-thumbnail.png` | `/docs/assets/video-23-thumbnail.png` | Video thumb | `c67c0a4` |
| `video-20-thumbnail.png` | `/docs/assets/video-20-thumbnail.png` | Video thumb | `59fee8d` |
| `video-17-thumbnail.png` | `/docs/assets/video-17-thumbnail.png` | Video thumb | `38127c6` |
| 20 cinema .webp files | `/public/assets/cinema/*.webp` | Camera/lens/aperture presets | `f9adf55` |

### Upstream External Sample Images (CDN)

| Asset | URL Pattern | Purpose | Count | Commit |
|-------|------------|---------|-------|--------|
| Provider logos | `https://cdn.muapi.ai/models/*.png` | Model selector | 25 | `9dfc4e8` |
| Influencer options | `https://cdn.muapi.ai/influencer/*.webp` | Attribute grid | 118+ | `5823f149` |
| App thumbnails | `https://cdn.muapi.ai/apps/*` | App cards | 68 | `fe87f4a` |
| Empty state cards | `https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/*.avif` | Empty states | 4 | `91ce11d` |
| Avatar presets | (embedded in MarketingStudio.jsx) | Avatar picker | 8 | `6aa3372` |

### Deleted Upstream Local Sample Images

| Asset | Path | Purpose | Introduced | Deleted |
|-------|------|---------|-----------|---------|
| 200+ influencer .webp | `/public/assets/influencer/*.webp` | Attribute options | `5823f149` | `c84e1d9` |
| 26 influencer_studio .webp | `/public/assets/influencer_studio/*.webp` | Attribute options | `5823f149` | `c84e1d9` |

---

## 6. WHAT SAMPLE VIDEOS EXIST?

| Asset | Path/URL | Purpose | Commit |
|-------|----------|---------|--------|
| `demo.mp4` | `/docs/assets/demo.mp4` | Studio demo video in README | `50f5bb3` |

**Note:** Upstream has only 1 local sample video. SmartVideo has additional demo videos (`video-personalization-demo.html`, `timeline-redesign-prototype.html`, etc.) that are not in upstream.

---

## 7. WHAT THUMBNAILS EXIST?

### Upstream Local Thumbnails

| Thumbnail | Path | Purpose | Commit |
|-----------|------|---------|--------|
| `thumbnail.png` | `/thumbnail.png` | Repo thumbnail | `f059ea6` |
| `thumbnail-ai-v2-1920x1080.png` | `/thumbnail-ai-v2-1920x1080.png` | AI thumbnail | `61e8ad5` |
| `video-27-minimax-hailuo-h3-guide-v3.png` | `/video-27-minimax-hailuo-h3-guide-v3.png` | Video guide | `e674d57` |
| `video-23-thumbnail-v2.png` | `/docs/assets/video-23-thumbnail-v2.png` | Video thumb | `5517c1f` |
| `video-23-thumbnail.png` | `/docs/assets/video-23-thumbnail.png` | Video thumb | `c67c0a4` |
| `video-20-thumbnail.png` | `/docs/assets/video-20-thumbnail.png` | Video thumb | `59fee8d` |
| `video-17-thumbnail.png` | `/docs/assets/video-17-thumbnail.png` | Video thumb | `38127c6` |
| 20 cinema .webp | `/public/assets/cinema/*.webp` | Camera/lens/aperture thumbnails | `f9adf55` |

### Upstream External Thumbnails (CDN)

| Thumbnail | URL Pattern | Purpose | Count | Commit |
|-----------|------------|---------|-------|--------|
| App thumbnails | `https://cdn.muapi.ai/apps/*` | App cards | 68 | `fe87f4a` |
| Influencer options | `https://cdn.muapi.ai/influencer/*.webp` | Attribute grid | 118+ | `5823f149` |
| Provider logos | `https://cdn.muapi.ai/models/*.png` | Model selector | 25 | `9dfc4e8` |

### SmartVideo-Only Thumbnails (Not in Upstream)

| Thumbnail | Path | Count | Purpose |
|-----------|------|-------|---------|
| Template thumbnails | `/public/thumbnails/templates/` | 254 | Template cards |
| Effect thumbnails | `/public/thumbnails/effects/` | 252 | Effect cards |
| Studio hero thumbnails | `/public/thumbnails/studios/` | 16 | Studio banners |
| Hero banners | `/public/thumbnails/heroes/` | 23 | Page banners |
| Category icons | `/public/thumbnails/categories/` | 8 | Category badges |
| Page thumbnails | `/public/thumbnails/pages/` | 6 | Page thumbnails |

---

## 8. WHAT VISUAL SELECTORS EXIST?

| Visual Selector | Studio | Description | Upstream File | Lines | Commit |
|-----------|--------|-------------|---------------|-------|--------|
| Model card selector | Image, Video | Visual card grid with provider logos, search, category tabs | `ImageStudio.jsx`, `VideoStudio.jsx` | 585-860, 119-444 | `9dfc4e8` |
| ScrollColumn camera selector | Cinema | 4 vertical scrolling columns with snap behavior | `CinemaStudio.jsx` | 214-393 | `fdc28b80` |
| Visual attribute grid | Influencer | 3-column image grid with 118 options | `AiInfluencerStudio.jsx` | 17-279 | `5823f149` |
| HoverPill preview | Influencer | Hover tooltip thumbnail on selected tags | `AiInfluencerStudio.jsx` | 304-335 | `cdce42a5` |
| Empty state floating cards | Image, Video, Recast, LipSync, VibeMotion | 4 floating animated image cards | `ImageStudio.jsx`, `VideoStudio.jsx`, etc. | 1462-1491, 1572-1614 | `91ce11d` |
| History card grid | Video, Audio | Card-based selector with hover actions | `VideoStudio.jsx`, `AudioStudio.jsx` | 1432-1615, 1084-1119 | `8fadaed` |
| App card grid | Apps | 69 cards with thumbnail, hover lift, external links | `AppsStudio.jsx` | 180-193 | `fe87f4a` |
| Upload history grid | Image | 3-column grid with selection state, hover delete | `ImageStudio.jsx` | 446-530 | `9965718` |
| MediaPickerButton | Recast, LipSync | Upload button with progress rings | `RecastStudio.jsx` | 42-155 | `6aa3372` |
| Assets Library dropdown | Recast | Tabbed dropdown with thumbnails | `RecastStudio.jsx` | 160-311 | `6aa3372` |
| Avatar preset cards | Marketing | 8 avatar cards with prev/next navigation | `MarketingStudio.jsx` | 92-100, 661-706, 838-950 | `6aa3372` |

---

## 9. WHAT DEMO DATA EXISTS?

### Upstream Demo Data

| Demo Data | Location | Type | Commit |
|-----------|----------|------|--------|
| 5 template apps | `AppsStudio.jsx:13-64` | Hardcoded JS array | `fe87f4a` |
| 64 dummy apps | `AppsStudio.jsx:66-130` | Hardcoded JS array | `fe87f4a` |
| 118 influencer options | `AiInfluencerStudio.jsx:17-279` | Hardcoded JS array | `5823f149` |
| 20 cinema presets | `CameraControls.js:4-30`, `CinemaStudio.jsx:492-518` | Hardcoded JS arrays | `f9adf55` |
| 25 provider logos | `VideoStudio.jsx:119-145` | Hardcoded CDN map | `9dfc4e8` |
| 6 effect categories | `EffectsStudio.js` (SmartVideo) / models.js (upstream) | Hardcoded enum | `c73a1cd` |
| 13 edit tools | `EditStudio.js` (SmartVideo) | Hardcoded array | SmartVideo-only |
| 8 avatar presets | `MarketingStudio.jsx:92-100` | Hardcoded JS array | `6aa3372` |
| 12 curated prompts | `ExplorePage.js` (SmartVideo) | Hardcoded array | SmartVideo-only |
| 9 quick prompt categories | `promptUtils.js` (SmartVideo) | Hardcoded array | SmartVideo-only |
| 4 enhancement tag categories | `promptUtils.js` (SmartVideo) | Hardcoded array | SmartVideo-only |
| 11 lens types | `promptUtils.js` (SmartVideo) | Hardcoded array | SmartVideo-only |

### Upstream Schema-Driven Demo Data

| Data | Source | Description | Commit |
|------|--------|-------------|--------|
| 400+ models | `models.js` | Model catalog with schema, endpoints, inputs | `e0efb74` |
| Model input schemas | `models.js:inputs` | Enum values, defaults, ranges for controls | `e0efb74` |
| Effect enums | `models.js:inputs.name.enum` | 350+ effect options across 6 categories | `c73a1cd` |
| Duration ranges | `models.js` | Per-model duration min/max/step | `609267b1` |
| Aspect ratio enums | `models.js` | Per-model aspect ratios | `91ce11d` |
| Resolution enums | `models.js` | Per-model resolutions | `91ce11d` |
| Quality enums | `models.js` | Per-model quality options | `91ce11d` |
| Mode enums | `models.js` | Per-model mode options | `82215cb` |
| Max images | `models.js:maxImages` | Per-model reference image limits | `e68e7f7d` |

---

## 10. WHERE IS EVERY ITEM LOCATED?

### Upstream Repository Structure

```
/tmp/open-generative-ai-upstream/
├── packages/studio/src/
│   ├── components/
│   │   ├── AgentStudio.jsx
│   │   ├── AiInfluencerStudio.jsx
│   │   ├── AppsStudio.jsx
│   │   ├── AudioStudio.jsx
│   │   ├── CinemaStudio.jsx
│   │   ├── ClippingStudio.jsx
│   │   ├── DesignAgentStudio.jsx
│   │   ├── DrawModal.jsx
│   │   ├── ImageStudio.jsx
│   │   ├── LipSyncStudio.jsx
│   │   ├── MarketingStudio.jsx
│   │   ├── McpCliStudio.jsx
│   │   ├── MobileGenerationActions.jsx
│   │   ├── RecastStudio.jsx
│   │   ├── VibeMotionStudio.jsx
│   │   ├── VideoStudio.jsx
│   │   ├── WorkflowStudio.jsx
│   │   └── WorkflowUI.jsx
│   ├── models.js (698KB)
│   ├── muapi.js
│   ├── persistKey.js
│   └── utils/
│       └── formatError.js
├── src/components/ (vanilla JS, older)
│   ├── ImageStudio.js
│   ├── VideoStudio.js
│   ├── CinemaStudio.js
│   ├── CameraControls.js
│   ├── LipSyncStudio.js
│   ├── UploadPicker.js
│   └── ...
├── public/assets/cinema/ (20 .webp files)
├── docs/assets/ (7 media files)
└── thumbnail.png, thumbnail-ai-v2-1920x1080.png, video-27-*.png
```

### SmartVideo Repository Structure

```
/Users/deanellgilmore/.../coral-cemetery/
├── src/components/
│   ├── ImageStudio.js
│   ├── VideoStudio.js
│   ├── CinemaStudio.js
│   ├── CameraControls.js
│   ├── EditStudio.js
│   ├── EffectsStudio.js
│   ├── CharacterStudio.js
│   ├── CommercialStudio.js
│   ├── AudioStudio.js
│   ├── AvatarStudio.js
│   ├── TrainingStudio.js
│   ├── VideoToolsStudio.js
│   ├── ChatStudio.js
│   ├── LipSyncStudio.js
│   ├── InfluencerStudio.js
│   ├── TemplateStudio.js
│   ├── StoryboardStudio.js
│   ├── StoryboardPanel.js
│   ├── AppsHub.js
│   ├── ExplorePage.js
│   ├── LibraryPage.js
│   ├── UpscaleStudio.js
│   └── ...
├── src/lib/
│   ├── models.js
│   ├── muapi.js
│   ├── modelSelectorUI.js
│   ├── UploadPicker.js
│   └── ...
├── public/
│   ├── assets/
│   ├── thumbnails/
│   │   ├── templates/ (254 files)
│   │   ├── effects/ (252 files)
│   │   ├── studios/ (16 files)
│   │   ├── heroes/ (23 files)
│   │   └── ...
│   └── ...
└── docs/
    └── (new upstream recovery docs)
```

---

## 11. WHICH GIT COMMIT INTRODUCED EACH ITEM?

### Key Commits (All Verified in Upstream)

| Commit | Description | Files Changed | Impact |
|--------|-------------|---------------|--------|
| `e0efb74` | Add image generation studio with Muapi API integration | 19 files, +7397/-439 | Foundation commit for ImageStudio, models.js, muapi.js |
| `6eebebc9` | Added Video Studio | 4 files, +1015/-2 | Foundation commit for VideoStudio |
| `f9adf55` | Cinema studio feature supported | Multiple files | Introduced all 20 cinema .webp assets, CameraControls.js |
| `fdc28b80` | Redesign Cinema camera settings | CinemaStudio.jsx, +179/-156 | ScrollColumn visual selector replaces dropdown |
| `5823f149` | Add AI Influencer Studio with full attributes customizer | 201 files, +840/-2 | 118 options, 200+ local .webp assets |
| `cdce42a5` | Show selected options as hoverable labels with image thumbnails | AiInfluencerStudio.jsx, +77 | HoverPill + selected tags bar |
| `91ce11d` | Finalize studio persistence and multiple reference image upload UI | 9 files, +3851/-2827 | Major refactor of ImageStudio, VideoStudio, CinemaStudio, LipSyncStudio |
| `c73a1cd3` | Add effect-type picker for effects-style models | 4 files, +158/-1 | Effect dropdown in ImageStudio + VideoStudio |
| `9965718` | Add image upload history, i2i/i2v model support | 6 files, +5921/-85 | UploadPicker.js, uploadHistory.js, model switching |
| `e5424a0` | Persist Reference Images upload history in localStorage | ImageStudio.jsx, +29/-2 | Upload history persistence |
| `3ef4ec2c` | Preserve model selection when uploading images | ImageStudio.jsx, +20/-9 | I2I model switching |
| `d1a060a2` | Restore correct t2i/i2i model pairing | ImageStudio.jsx, +71/-26 | Sibling model mapping |
| `e68e7f7d` | Support multi-image upload and list payload formatting | VideoStudio.jsx, models.js, muapi.js, +400/-92 | Multi-reference images |
| `8cbaf7fc` | First/last frame support for i2v models | VideoStudio.js + models.js + muapi.js, +73 | End frame upload |
| `5e01f607` | Port first/last frame i2v support to web JSX | VideoStudio.jsx + models.js + muapi.js, +135/-8 | End frame in Next.js |
| `aa4a4202` | Support kling motion-control + correct endpoints | 5 files, +184/-62 | Motion control effects |
| `0725694e` | Add reference drawing to Video Studio | VideoStudio.jsx, +171/-126 | DrawModal integration |
| `d707604` | Add Seedance 2.0 text-to-video model | README + models.js, +18/-2 | Extend mode |
| `9dfc4e8` | Group studio models by provider, use CDN logo URLs | models.js, +... | Provider logo system |
| `a0864207` | Replace default select elements with custom dropdowns in AudioStudio | AudioStudio.jsx, +52/-13 | Dynamic schema controls |
| `cda3208` | Added audio studio | AudioStudio.js + models.js | AudioStudio foundation |
| `fe87f4a` | Integrate Explore Apps studio with backend parity | AppsStudio.jsx + 4 files, +421/-2 | 68 app thumbnails |
| `de01d6d` | Implement premium drawing canvas editor (DrawModal) | DrawModal.jsx | Canvas editor |
| `8fadaed` | Add server-backed generation history and localStorage scoping | Multiple studios | History + persistence |
| `4c971d5` | Replace button error text with react-hot-toast | Multiple studios | Toast notifications |
| `3cc1313` | Unify studio prompt composer controls | Multiple studios | PromptComposer system |
| `abd5c06` | Align media previews and Draw availability | Multiple studios | MediaPickerButton |
| `aea3166` | Display unique studio metadata tags and copy prompt buttons | Multiple studios | GenerationCopyButtons |
| `ac01316` | Move navigation tabs to collapsible left sidebar | Multiple studios | Sidebar navigation |
| `6aa3372` | Restore complete Studio sources | Multiple studios | Major restoration commit |
| `df7d2dd` | Convert to Next.js monorepo with shared studio component library | Multiple files | Monorepo migration |

---

## 12. WHAT SHOULD BE COPIED INTO SMARTVIDEO?

### High Priority (P0)

| Item | Source | Target | Reason |
|------|--------|--------|--------|
| **AiInfluencerStudio.jsx** | `packages/studio/src/components/AiInfluencerStudio.jsx` | `src/components/InfluencerStudio.js` | SmartVideo has only 20 style presets; upstream has full 118-option visual attribute system with HoverPill |
| **118 influencer option images** | CDN: `https://cdn.muapi.ai/influencer/*.webp` | Reference in InfluencerStudio | Complete the attribute system |
| **HoverPill component** | `AiInfluencerStudio.jsx:304-335` | `src/components/InfluencerStudio.js` | Historical hover-preview behavior |
| **Selected tags bar** | `AiInfluencerStudio.jsx:660-689` | `src/components/InfluencerStudio.js` | Selected-option hover image thumbnails |
| **Empty state floating cards** | `ImageStudio.jsx:1462-1491`, `VideoStudio.jsx:1572-1614` | `src/components/ImageStudio.js`, `src/components/VideoStudio.js` | Improve empty states |
| **AudioStudio dynamic schema controls** | `AudioStudio.jsx:763-964` | `src/components/AudioStudio.js` | Replace hardcoded style/voice/tone with schema-driven UI |
| **Audio file uploaders** | `AudioStudio.jsx:70-228` | `src/components/AudioStudio.js` | Add audio URL input + multi-file upload |
| **PremiumAudioPlayer** | `AudioStudio.jsx:233-473` | `src/components/AudioStudio.js` | Replace WaveSurfer.js with upstream player |
| **Audio history grid** | `AudioStudio.jsx:1084-1119` | `src/components/AudioStudio.js` | Card-based history selector |
| **scopedPersistKey pattern** | `persistKey.js` | `src/lib/persistKey.js` | Multi-identity localStorage scoping |
| **formatErrorMessage** | `utils/formatError.js` | `src/lib/formatError.js` | Standardized error formatting |
| **Toast notification integration** | `react-hot-toast` (upstream) | `src/components/AudioStudio.js`, others | Replace inline errors + alert() |

### Medium Priority (P1)

| Item | Source | Target | Reason |
|------|--------|--------|--------|
| **ClippingStudio.jsx** | `packages/studio/src/components/ClippingStudio.jsx` | `src/components/ClippingStudio.js` | New studio: AI video clipping/highlight extraction |
| **RecastStudio.jsx** | `packages/studio/src/components/RecastStudio.jsx` | `src/components/RecastStudio.js` | New studio: body swap |
| **VibeMotionStudio.jsx** | `packages/studio/src/components/VibeMotionStudio.jsx` | `src/components/VibeMotionStudio.js` | New studio: motion graphics + remix |
| **WorkflowStudio.jsx** | `packages/studio/src/components/WorkflowStudio.jsx` | `src/components/WorkflowStudio.js` | New studio: workflow builder |
| **Avatar preset selector** | `MarketingStudio.jsx:92-100` | `src/components/AvatarStudio.js` | 8 preset avatars with prev/next navigation |
| **Camera Builder (vanilla JS)** | `CameraControls.js:189-355` | `src/components/CameraControls.js` | Collapsible panel with 4 selects |
| **MobileGenerationActions** | `MobileGenerationActions.jsx` | New component | Mobile-specific action menu |
| **GenerationCopyButtons** | `MobileGenerationActions.jsx` | New component | Copy prompt buttons on history cards |

### Low Priority (P2)

| Item | Source | Target | Reason |
|------|--------|--------|--------|
| **PromptComposer styling constants** | `PromptComposer.jsx` CSS classes | `src/styles/` | Standardize prompt bar styling across studios |
| **PromptAspectRatioIcon** | `PromptComposer.jsx` | Reimplement in vanilla JS | Consistent aspect ratio icon |
| **PromptDurationIcon** | `PromptComposer.jsx` | Reimplement in vanilla JS | Consistent duration icon |
| **PromptQualityIcon** | `PromptComposer.jsx` | Reimplement in vanilla JS | Consistent quality icon |
| **Empty state AVIF assets** | CloudFront CDN | `public/assets/empty-states/` | Replace with local copies or keep CDN |

---

## 13. WHAT SHOULD NOT BE COPIED INTO SMARTVIDEO?

### Obsolete / Replaced by SmartVideo

| Item | Reason to Exclude |
|------|-------------------|
| **PromptComposer React component** | SmartVideo uses vanilla JS; porting React components would require framework migration. Instead, extract styling patterns and reimplement in vanilla JS. |
| **Upstream ImageStudio.jsx / VideoStudio.jsx** | SmartVideo already has `ImageStudio.js` and `VideoStudio.js` with equivalent or superior functionality (server-backed history, ModelSelectorDropdown, etc.). Do NOT wholesale replace. |
| **Upstream CinemaStudio.jsx** | SmartVideo already has `CinemaStudio.js` with the same ScrollColumn visual selector. Do NOT replace. |
| **Upstream LipSyncStudio.jsx** | SmartVideo already has `LipSyncStudio.js` with additional features (pending job resume, fullscreen canvas). Do NOT replace. |
| **Upstream AudioStudio.jsx** | SmartVideo already has `AudioStudio.js` with hardcoded controls that are simpler for users. Only merge specific features (file uploaders, history grid). |
| **InfluencerStudio.jsx (upstream)** | Upstream has `AiInfluencerStudio.jsx` (118 options); SmartVideo has `InfluencerStudio.js` (20 presets). SmartVideo's implementation is newer but less complete. Merge upstream's 118-option system into SmartVideo, don't replace. |
| **AppsStudio.jsx** | SmartVideo has `AppsHub.js` with search, recents, and navigation. Upstream has 68 CDN thumbnails but no search. Keep SmartVideo version. |
| **TemplateStudio.jsx** | Does NOT exist in upstream. SmartVideo's `TemplateStudio.js` is unique and should be preserved. |
| **EffectsStudio.js** | Does NOT exist upstream as a standalone file. SmartVideo's `EffectsStudio.js` is a SmartVideo-only feature. Preserve. |
| **EditStudio.js** | Does NOT exist upstream as a standalone file. SmartVideo's `EditStudio.js` is a SmartVideo-only feature. Preserve. |
| **CharacterStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **StoryboardStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **CommercialStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **VideoToolsStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **ChatStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **AvatarStudio.js** | Does NOT exist upstream (avatar is in MarketingStudio.jsx). SmartVideo-only. Preserve. |
| **TrainingStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **UpscaleStudio.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **LibraryPage.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **ExplorePage.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **AssistPage.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |
| **CommunityPage.js** | Does NOT exist upstream. SmartVideo-only. Preserve. |

### Conflicts with Newer SmartVideo Functionality

| Upstream Feature | SmartVideo Superior Alternative | Conflict |
|------------------|--------------------------------|----------|
| Inline React model dropdowns | `modelSelectorUI.js` + `ModelSelectorDropdown.jsx` | SmartVideo has provider-aware split-pane with logos |
| Basic upload picker | `UploadPicker.js` (752 lines) | SmartVideo has multi-image, video, URL, drag-drop, paste, history |
| react-hot-toast | Custom toast system | SmartVideo has more integrated notifications |
| No project system | `ProjectStore.js` + `ProjectPanel.jsx` | SmartVideo has localStorage-backed project CRUD |
| No undo/redo | `undoRedo.js` library | SmartVideo has undo/redo library (not yet wired to all studios) |
| No batch processing | `batchProcessor.js` | SmartVideo has concurrent batch framework |
| No thumbnail modal | `StudioThumbnailModal.jsx` | SmartVideo has full thumbnail generation flow |
| No GTM Boost | `GTMPromptModal.jsx` + `uiIntegration.js` | SmartVideo has prompt enhancement system |
| No personalization | `PersonalizeModal.jsx` + `personalizePopover.js` | SmartVideo has token replacement system |
| No Timeline Editor | `TimelineEditorPage.jsx` (7,218 lines) | SmartVideo has full NLE with keyframes, transitions, color correction |
| No Template Studio cinematic wizard | `TemplateStudio.js` | SmartVideo has unique template-driven generation |
| No effect thumbnails | `public/thumbnails/effects/` (252 files) | SmartVideo has local effect preview assets |

---

## RECOMMENDED IMPLEMENTATION SEQUENCE

### Phase 1: Influencer Studio (P0)
1. Replace `InfluencerStudio.js` with upstream's `AiInfluencerStudio.jsx` port
2. Add 118 option images (use CDN URLs `https://cdn.muapi.ai/influencer/*.webp`)
3. Add HoverPill component (72x72px tooltip)
4. Add selected tags bar with image thumbnails
5. Add shuffle randomizer
6. Preserve SmartVideo's GTM Boost, thumbnail modal, and personalize trigger

### Phase 2: Audio Studio Enhancements (P0)
1. Add `AudioFileUploader` and `AudioListUploader`
2. Replace WaveSurfer.js with `PremiumAudioPlayer` or integrate upstream equalizer
3. Add history grid
4. Add `scopedPersistKey` persistence
5. Add `formatErrorMessage` + toast notifications
6. Replace hardcoded style/voice/tone with dynamic schema-driven controls

### Phase 3: New Studios from Upstream (P1)
1. **ClippingStudio** — Port 1,150 lines, low conflict
2. **RecastStudio** — Port 1,222 lines, low conflict
3. **VibeMotionStudio** — Port 715 lines, low conflict
4. **WorkflowStudio** — Port 1,012 lines, evaluate against SmartVideo SpacesCanvas

### Phase 4: Shared Infrastructure (P1)
1. Port `scopedPersistKey` + `migrateLegacyPersistKey` to all studios
2. Port `formatErrorMessage` to all studios
3. Add `MobileGenerationActions` to ImageStudio and VideoStudio
4. Add `GenerationCopyButtons` to history cards
5. Add empty state floating cards to ImageStudio and VideoStudio

### Phase 5: Avatar & Marketing (P2)
1. Import 8 avatar presets from MarketingStudio.jsx
2. Add avatar dropdown with preview and prev/next navigation
3. Evaluate MarketingStudio.jsx for CommercialStudio alignment

### Phase 6: PromptComposer Alignment (P2)
1. Extract Tailwind class constants from upstream PromptComposer
2. Create vanilla JS `PromptBar.js` helper
3. Standardize prompt textarea, controls row, and action buttons across studios

---

## RISKS AND MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| React vs vanilla JS architecture mismatch | High | High | Do NOT port React components; extract patterns and reimplement in vanilla JS |
| CDN asset dependency | Medium | Medium | Preserve CDN URLs for muapi.ai assets; document external dependency |
| Model schema drift | Medium | High | SmartVideo has its own models.js; only merge schema helpers, don't overwrite model catalog |
| Upstream repo is different product | High | High | Accept that upstream and SmartVideo are divergent; only port applicable features |
| Breaking existing SmartVideo features | Low | High | Never replace SmartVideo files; only merge/append specific features |
| 200+ deleted influencer assets | Low | Low | Upstream migrated to CDN; SmartVideo can do the same |

---

## CONCLUSION

The forensic recovery confirms that `Anil-matcha/Open-Generative-AI` is a **different product** from SmartVideo, with a different studio set, different architecture (Next.js vs vanilla JS), and different feature priorities. The correct recovery strategy is **selective integration**:

1. **Port** upstream-only studios that add value: ClippingStudio, RecastStudio, VibeMotionStudio, WorkflowStudio
2. **Enhance** SmartVideo studios with upstream patterns: InfluencerStudio (118 options + HoverPill), AudioStudio (dynamic controls + file uploaders + history grid)
3. **Preserve** all SmartVideo-only features: TemplateStudio, EffectsStudio, EditStudio, CharacterStudio, StoryboardStudio, CommercialStudio, VideoToolsStudio, ChatStudio, AvatarStudio, TrainingStudio, UpscaleStudio, TimelineEditorPage, GTM Boost, PersonalizeModal, ProjectStore
4. **Extract** shared patterns: scopedPersistKey, formatErrorMessage, toast notifications, empty state assets
5. **Do NOT copy**: React components, upstream-only studio files that SmartVideo already has better implementations for, or obsolete patterns

The upstream repository is a **source of patterns and isolated features**, not a wholesale replacement for SmartVideo.
