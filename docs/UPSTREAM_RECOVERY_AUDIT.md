# UPSTREAM RECOVERY AUDIT

**Source Repository:** `Anil-matcha/Open-Generative-AI`
**Clone Path:** `/tmp/open-generative-ai-upstream`
**Total Commits:** 3,118
**Audit Date:** 2026-08-11
**Auditor:** Kilo Forensic Engineering

---

## METHODOLOGY

Every row in this table is traceable to actual upstream source code, assets, or Git commits. No README claims are used as proof. No invented functionality is reported.

---

## AUDIT TABLE

| Studio | Control | Playground | Asset | Type | Upstream File | Commit | Recovery Action |
|--------|---------|------------|-------|------|---------------|--------|-----------------|
| Image | Model selector (T2I/I2I categories, provider logos, search) | Model card selector with scroll | Provider logos (25 CDN URLs) | Control + Asset | `packages/studio/src/components/ImageStudio.jsx:585-860` | `9dfc4e8` | Present in SmartVideo via `modelSelectorUI.js`; re-wire to all studios |
| Image | Aspect ratio dropdown | Popover menu | Aspect ratio icons | Control | `ImageStudio.jsx:1617-1647` | `91ce11d` | Present in SmartVideo |
| Image | Quality/Resolution dropdown | Popover menu | Quality icons | Control | `ImageStudio.jsx:1650-1682` | `91ce11d` | Present in SmartVideo |
| Image | Effect type dropdown (I2I-only) | Popover menu | Effect icons | Control | `ImageStudio.jsx:1685-1720` | `c73a1cd` | Present in SmartVideo via `EffectsStudio.js`; upstream embeds in ImageStudio |
| Image | Batch size stepper (-/+) | Inline buttons | — | Control | `ImageStudio.jsx:1722-1741` | `91ce11d` | Present in SmartVideo |
| Image | Draw button | Opens DrawModal | — | Control | `ImageStudio.jsx:1743-1756` | `de01d6d` | Present in SmartVideo |
| Image | Reference image upload | UploadButton with history grid | Upload thumbnails | Playground | `ImageStudio.jsx:66-551` | `9965718` | Present in SmartVideo via `UploadPicker.js` |
| Image | Swap face upload | Conditional upload button | — | Control | `ImageStudio.jsx:1543-1552` | `c73a1cd` | Present in SmartVideo |
| Image | Upload history (localStorage) | 3-column grid with hover delete | History thumbnails | Playground | `ImageStudio.jsx:446-530` | `e5424a0` | Present in SmartVideo |
| Image | Model switching heuristic (T2I↔I2I) | Automatic on upload/clear | — | Control | `ImageStudio.jsx:1101-1201` | `d1a060a2` | Present in SmartVideo |
| Image | DrawModal canvas editor | Drawing/sketch playground | — | Playground | `DrawModal.jsx` | `de01d6d` | Present in SmartVideo |
| Image | Fullscreen result preview | Modal overlay | — | Playground | `ImageStudio.jsx:1778-1804` | `91ce11d` | Present in SmartVideo |
| Image | Empty state floating cards | 4 floating image cards | `sdxl-image.avif`, `chroma-image.avif`, `neta-lumina.avif`, `perfect-pony-xl.avif` | Playground + Asset | `ImageStudio.jsx:1462-1491` | `91ce11d` | Missing in SmartVideo; recover CloudFront URLs |
| Image | Negative prompt (schema-only) | Not rendered in UI | — | Control | `models.js:2384-2390, 2710-2720` | `e0efb74` | Missing in SmartVideo; schema exists but no UI |
| Image | Seed (schema-only) | Not rendered in UI | — | Control | `models.js:2384-2390` | `e0efb74` | Missing in SmartVideo; schema exists but no UI |
| Image | Guidance/Strength (schema-only) | Hardcoded to 0.6 in muapi.js | — | Control | `muapi.js:72` | `e0efb74` | Missing in SmartVideo UI; hardcoded upstream |
| Video | Model dropdown (25 providers, categories, search) | Visual card selector | 25 provider logo PNGs | Control + Asset | `VideoStudio.jsx:119-444` | `9dfc4e8` | Present in SmartVideo via `modelSelectorUI.js` |
| Video | Aspect ratio dropdown | Popover menu | Aspect ratio icons | Control | `VideoStudio.jsx:1963-2002` | `91ce11d` | Present in SmartVideo |
| Video | Duration dropdown | Popover menu | Duration/clock icon | Control | `VideoStudio.jsx:2057-2097` | `91ce11d` | Present in SmartVideo |
| Video | Resolution dropdown | Popover menu | Resolution icon | Control | `VideoStudio.jsx:2099-2139` | `91ce11d` | Present in SmartVideo |
| Video | Quality dropdown | Popover menu | Quality icon | Control | `VideoStudio.jsx:2099-2139` | `91ce11d` | Present in SmartVideo |
| Video | Mode selector (model-specific) | Dropdown | — | Control | `VideoStudio.jsx:659, 490` | `82215cb` | Present in SmartVideo |
| Video | Effect type dropdown (I2V-only) | Popover menu | Effect icons | Control | `VideoStudio.jsx:2004-2055` | `c73a1cd` | Present in SmartVideo |
| Video | First frame / reference image | Media preview strip + upload | Reference thumbnails | Playground | `VideoStudio.jsx:1620-1883` | `6eebebc9` | Present in SmartVideo |
| Video | Last frame / end frame | Upload button with END badge | End frame thumbnail | Playground | `VideoStudio.jsx:983-1004, 1648-1651` | `8cbaf7fc` | Present in SmartVideo |
| Video | Multiple reference images | Multi-upload chips | Multi-image thumbnails | Playground | `VideoStudio.jsx:816-824, 1669-1687` | `e68e7f7d` | Present in SmartVideo |
| Video | Draw reference button | Opens DrawModal | — | Control | `VideoStudio.jsx:2141-2161` | `0725694e` | Present in SmartVideo |
| Video | Seedance 2.0 extend mode | Extend banner + button | — | Playground | `VideoStudio.jsx:1385-1397, 1897-1912` | `d707604` | Present in SmartVideo |
| Video | Drag & drop file handling | Drop zone | — | Playground | `VideoStudio.jsx:900-912` | `fddc2ff` | Present in SmartVideo |
| Video | Central history gallery | Responsive grid with hover actions | History thumbnails | Playground | `VideoStudio.jsx:1432-1615` | `8fadaed` | Present in SmartVideo |
| Video | Empty state floating cards | 4 floating image cards | `sdxl-image.avif`, `chroma-image.avif`, `neta-lumina.avif`, `perfect-pony-xl.avif` | Playground + Asset | `VideoStudio.jsx:1572-1614` | `91ce11d` | Missing in SmartVideo; recover CloudFront URLs |
| Video | Fullscreen video modal | Fixed overlay | — | Playground | `VideoStudio.jsx:2186-2213` | `91ce11d` | Present in SmartVideo |
| Cinema | ScrollColumn visual camera/lens selector | 4 vertical scrolling columns | 20 cinema .webp assets | Playground + Asset | `CinemaStudio.jsx:214-393` | `fdc28b80` | Present in SmartVideo |
| Cinema | Camera dropdown | ScrollColumn with images | Camera .webp files | Control + Asset | `CinemaStudio.jsx:492-498` | `f9adf55` | Present in SmartVideo |
| Cinema | Lens dropdown | ScrollColumn with images | Lens .webp files | Control + Asset | `CinemaStudio.jsx:499-504` | `f9adf55` | Present in SmartVideo |
| Cinema | Focal Length dropdown | ScrollColumn (text-only) | — | Control | `CinemaStudio.jsx:506-511` | `f9adf55` | Present in SmartVideo |
| Cinema | Aperture dropdown | ScrollColumn with images | `f_1_4.webp`, `f_4.webp`, `f_11.webp` | Control + Asset | `CinemaStudio.jsx:513-518` | `f9adf55` | Present in SmartVideo |
| Cinema | Aspect ratio dropdown | Dropdown button | — | Control | `CinemaStudio.jsx:1135-1161` | `f9adf55` | Present in SmartVideo |
| Cinema | Resolution dropdown | Dropdown button | — | Control | `CinemaStudio.jsx:1163-1188` | `f9adf55` | Present in SmartVideo |
| Cinema | Camera Builder (vanilla JS only) | Collapsible panel with 4 selects | — | Control | `CameraControls.js:189-355` | `f9adf55` | Missing in SmartVideo Next.js version |
| Cinema | Selected-state visual behavior | Opacity/scale/blur transitions | — | Playground | `CinemaStudio.jsx:357-380` | `fdc28b80` | Present in SmartVideo |
| Cinema | 20 cinema .webp assets | ScrollColumn items | `modular_8k_digital.webp`, `full_frame_cine_digital.webp`, `grand_format_70mm_film.webp`, `studio_digital_s35.webp`, `classic_16mm_film.webp`, `premium_large_format_digital.webp`, `creative_tilt_lens.webp`, `compact_anamorphic.webp`, `extreme_macro.webp`, `70s_cinema_prime.webp`, `classic_anamorphic.webp`, `premium_modern_prime.webp`, `warm_cinema_prime.webp`, `swirl_bokeh_portrait.webp`, `vintage_prime.webp`, `halation_diffusion.webp`, `clinical_sharp_prime.webp`, `f_1_4.webp`, `f_4.webp`, `f_11.webp` | Asset | `public/assets/cinema/` | `f9adf55` | Present in SmartVideo |
| Influencer | Visual attribute grid (3 tabs, 20 subcats, 118 options) | 3-column image grid | 118 .webp option images | Playground + Asset | `AiInfluencerStudio.jsx:17-279` | `5823f149` | Present in SmartVideo via `InfluencerStudio.js`; upstream has 118 options vs SmartVideo's 20 style presets |
| Influencer | HoverPill preview | 72x72px tooltip thumbnail | Option image | Playground | `AiInfluencerStudio.jsx:304-335` | `cdce42a5` | Missing in SmartVideo |
| Influencer | Selected tags bar | Hoverable pills with image thumbnails | Option images | Playground | `AiInfluencerStudio.jsx:660-689` | `cdce42a5` | Missing in SmartVideo |
| Influencer | CDN image URLs | Image grid buttons | `https://cdn.muapi.ai/influencer/*.webp` | Asset | `AiInfluencerStudio.jsx:11, 24+` | `5823f149` | Present in SmartVideo (uses CDN) |
| Influencer | 200 local .webp assets | Image grid | `public/assets/influencer/*.webp` | Asset | `public/assets/influencer/` | `5823f149` | Deleted in commit `c84e1d9`; now uses CDN |
| Influencer | 26 local .webp assets (influencer_studio dir) | Image grid | `public/assets/influencer_studio/*.webp` | Asset | `public/assets/influencer_studio/` | `5823f149` | Deleted in commit `c84e1d9` |
| Audio | Dynamic schema-driven controls | Form with toggles, sliders, dropdowns | — | Control | `AudioStudio.jsx:763-964` | `a0864207` | Present in SmartVideo; upstream has more dynamic schema rendering |
| Audio | File uploaders (audio + list) | Upload areas with progress | — | Playground | `AudioStudio.jsx:70-228` | `cda3208` | Missing in SmartVideo; SmartVideo has basic upload only |
| Audio | PremiumAudioPlayer | Full playback controls + equalizer | — | Playground | `AudioStudio.jsx:233-473` | `cda3208` | Missing in SmartVideo; SmartVideo uses WaveSurfer.js |
| Audio | History grid | Card-based selector | History thumbnails | Playground | `AudioStudio.jsx:1084-1119` | `8fadaed` | Missing in SmartVideo |
| Audio | Toast notifications | Inline toasts | — | Playground | `AudioStudio.jsx` (throughout) | `4c971d5` | Missing in SmartVideo; uses inline error divs |
| Audio | scopedPersistKey persistence | localStorage | — | Playground | `AudioStudio.jsx:489` | `8fadaed` | Missing in SmartVideo |
| Audio | Prompt example chips | Clickable chips | — | Control | `AudioStudio.jsx:922-934` | `cda3208` | Missing in SmartVideo |
| Effects | Effect dropdown in ImageStudio | Popover menu | — | Control | `ImageStudio.jsx:1685-1720` | `c73a1cd` | Present in SmartVideo via `EffectsStudio.js` |
| Effects | Effect dropdown in VideoStudio | Popover menu | — | Control | `VideoStudio.jsx:2004-2055` | `c73a1cd` | Present in SmartVideo via `EffectsStudio.js` |
| Effects | 350+ effect models (6 categories) | Tabbed browser | 252 effect thumbnails | Control + Asset | `models.js:8678-12253`, `EffectsStudio.js` | `c73a1cd` | Present in SmartVideo |
| Edit | Edit model suffixes (-edit) | Automatic T2I→I2I mapping | — | Control | `ImageStudio.jsx:1114-1142` | `d1a060a2` | Present in SmartVideo via `EditStudio.js` |
| Edit | Draw-to-edit tab | DrawModal with edit models | — | Playground | `DrawModal.jsx:11-15, 1594-1641` | `de01d6d` | Present in SmartVideo |
| Clipping | AI video clipping/highlight extraction | Upload + result grid | — | Playground | `ClippingStudio.jsx` (1150 lines) | `6aa3372` | Missing in SmartVideo |
| Clipping | num_highlights control | Dropdown/input | — | Control | `ClippingStudio.jsx:219-221` | `6aa3372` | Missing in SmartVideo |
| Clipping | aspect_ratio control | Dropdown | — | Control | `ClippingStudio.jsx:219-221` | `6aa3372` | Missing in SmartVideo |
| Clipping | return_coordinates_only toggle | Toggle | — | Control | `ClippingStudio.jsx:219-221` | `6aa3372` | Missing in SmartVideo |
| Recast | MediaPickerButton (video + image) | Upload with progress rings | — | Playground | `RecastStudio.jsx:42-155` | `6aa3372` | Missing in SmartVideo |
| Recast | Assets Library dropdown | Tabs: videos/images/results | — | Playground | `RecastStudio.jsx:160-311` | `6aa3372` | Missing in SmartVideo |
| Recast | Character orientation dropdown | Dropdown (kling-v3.0-pro-recast) | — | Control | `RecastStudio.jsx:1059-1094` | `6aa3372` | Missing in SmartVideo |
| VibeMotion | Generate/Edit mode toggle | Segmented control | — | Control | `VibeMotionStudio.jsx:515-532` | `6aa3372` | Missing in SmartVideo |
| VibeMotion | Edit source picker | Dropdown with video thumbnails | — | Control | `VibeMotionStudio.jsx:647-689` | `6aa3372` | Missing in SmartVideo |
| VibeMotion | Aspect ratio dropdown | Dropdown | — | Control | `VibeMotionStudio.jsx:585-613` | `6aa3372` | Missing in SmartVideo |
| VibeMotion | Duration dropdown | Dropdown | — | Control | `VibeMotionStudio.jsx:616-644` | `6aa3372` | Missing in SmartVideo |
| VibeMotion | Edit/remix mode | Text prompt + request_id | — | Control | `VibeMotionStudio.jsx:90-185` | `6aa3372` | Missing in SmartVideo |
| Workflow | Template/My Workflows/Community tabs | Tabbed navigation | — | Playground | `WorkflowStudio.jsx:903-934` | `6aa3372` | Missing in SmartVideo |
| Workflow | Playground/Full Workflow sub-tabs | Sub-tab navigation | — | Playground | `WorkflowStudio.jsx:478-509` | `6aa3372` | Missing in SmartVideo |
| Workflow | Schema-driven form inputs | Dynamic textarea, select, text | — | Control | `WorkflowStudio.jsx:590-651` | `6aa3372` | Missing in SmartVideo |
| Workflow | Workflow execution | Run button with inputs | — | Control | `WorkflowStudio.jsx:413-447` | `6aa3372` | Missing in SmartVideo |
| Apps | 69 app cards (5 template + 64 dummy) | Visual card grid | 68 CDN thumbnails | Playground + Asset | `AppsStudio.jsx:13-130` | `fe87f4a` | Present in SmartVideo via `AppsHub.js`; different implementation |
| Apps | App interest registration | Get Template modal | — | Playground | `AppsStudio.jsx:328-361` | `fe87f4a` | Missing in SmartVideo |
| Apps | External repo/demo links | Card hover actions | — | Control | `AppsStudio.jsx:230-248` | `fe87f4a` | Missing in SmartVideo |
| Marketing | Avatar preset selector | 8 avatar cards | 8 avatar image assets | Playground + Asset | `MarketingStudio.jsx:92-100` | `6aa3372` | Missing in SmartVideo |
| Marketing | Avatar dropdown with preview | Dropdown with enlarge option | — | Control | `MarketingStudio.jsx:661-706` | `6aa3372` | Missing in SmartVideo |
| Marketing | Avatar prev/next navigation | Arrow buttons | — | Control | `MarketingStudio.jsx:838-950` | `6aa3372` | Missing in SmartVideo |
| Shared | PromptComposer system | Shared prompt bar | — | Playground | `packages/studio/src/components/prompt/PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo; architectural mismatch (React vs vanilla) |
| Shared | PromptControls | Control buttons container | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptTextarea | Auto-resizing textarea | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptPopover/PromptMenuList/PromptMenuItem | Dropdown popover system | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptAspectRatioIcon | Aspect ratio icon | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptDurationIcon | Duration/clock icon | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptQualityIcon | Resolution/quality icon | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | PromptAction | Generate button | — | Control | `PromptComposer.jsx` | `3cc1313` | Missing in SmartVideo |
| Shared | MediaPickerButton | Upload button with 3 states | — | Playground | `packages/studio/src/components/prompt/` | `abd5c06` | Missing in SmartVideo; SmartVideo has UploadPicker.js |
| Shared | MobileGenerationActions | Mobile-specific action menu | — | Playground | `MobileGenerationActions.jsx` | `abd5c06` | Missing in SmartVideo |
| Shared | GenerationCopyButtons | Copy prompt buttons on cards | — | Control | `MobileGenerationActions.jsx` | `aea3166` | Missing in SmartVideo |
| Shared | scopedPersistKey | API-key-scoped localStorage | — | Playground | `persistKey.js` | `8fadaed` | Missing in SmartVideo |
| Shared | migrateLegacyPersistKey | Legacy key migration | — | Control | `persistKey.js` | `8fadaed` | Missing in SmartVideo |
| Shared | formatErrorMessage | Standardized error formatting | — | Control | `utils/formatError.js` | `1ed51d4` | Missing in SmartVideo |
| Shared | toast notifications | react-hot-toast | — | Playground | (throughout studios) | `4c971d5` | Missing in SmartVideo; uses inline errors + alert() |

---

## KEY FINDINGS

### Upstream-Only Studios (Not in SmartVideo)
- `ClippingStudio.jsx` (1,150 lines) — AI video clipping
- `RecastStudio.jsx` (1,222 lines) — Body swap
- `VibeMotionStudio.jsx` (353 lines) — Motion graphics
- `WorkflowStudio.jsx` (1,012 lines) — Workflow builder
- `MarketingStudio.jsx` (424 lines) — Marketing ads
- `AiInfluencerStudio.jsx` (46 lines JSX, 118 options) — Character builder
- `AgentStudio.jsx` (637 lines) — Agent chat
- `McpCliStudio.jsx` (114 lines) — MCP/CLI

### SmartVideo-Only Studios (Not in Upstream)
- `CharacterStudio.js`
- `StoryboardStudio.js`
- `StoryboardPanel.js`
- `StoryboardPage.js`
- `TemplateStudio.js`
- `EffectsStudio.js`
- `EditStudio.js`
- `CommercialStudio.js`
- `VideoToolsStudio.js`
- `ChatStudio.js`
- `AvatarStudio.js`
- `TrainingStudio.js`
- `UpscaleStudio.js`
- `LibraryPage.js`
- `ExplorePage.js`
- `AssistPage.js`
- `CommunityPage.js`
- `CinemaTemplateStudio.js`
- `VideoToVideoPage.js`
- `SpacesCanvas.jsx`

### Shared Studios (Both Repos)
- ImageStudio / ImageStudio.js
- VideoStudio / VideoStudio.js
- CinemaStudio / CinemaStudio.js
- LipSyncStudio / LipSyncStudio.js
- AudioStudio / AudioStudio.js
- AppsStudio / AppsHub.js
