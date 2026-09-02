# SmartVideo AI — Current Application UI/UX Audit
**Sub-Agent 1: CURRENT APP UI/UX AUDITOR**
**Date:** 2026-08-11
**Working Directory:** `/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery`

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Routing & Navigation](#routing--navigation)
3. [Global Layout (App Shell)](#global-layout-app-shell)
4. [Studio Inventory](#studio-inventory)
5. [Per-Studio Detailed Analysis](#per-studio-detailed-analysis)
6. [Shared UI Components](#shared-ui-components)
7. [Modals System](#modals-system)
8. [State Management](#state-management)
9. [Upload & Media Handling](#upload--media-handling)
10. [Generation Controls Patterns](#generation-controls-patterns)
11. [Empty / Loading / Error / Success States](#empty--loading--error--success-states)
12. [What's Missing at a Glance](#whats-missing-at-a-glance)
13. [Key Findings Summary](#key-findings-summary)

---

## Architecture Overview

### Tech Stack
- **Core:** Vanilla JavaScript (ES modules) — most studios are imperative DOM factories
- **Hybrid React:** `ModalContainer.jsx`, `elements-tab.jsx`, `element-modal.jsx`, `StudioThumbnailPanel.jsx` use React + MobX
- **State:** Custom `Store` class (pub/sub pattern) in `src/stores/base/Store.js`; `useStore`, `useSelector`, `useDispatch` hooks
- **Base Component:** `src/components/base/Component.js` — lifecycle, event cleanup, store subscriptions, error boundaries
- **Styling:** Tailwind CSS utility classes + custom CSS classes (`glass`, `shadow-3xl`, `shadow-4xl`, `custom-scrollbar`, `no-scrollbar`, `interactive-glow`, `animate-fade-in-up`, `gtm-boost-btn`, `studio-nav-btn`)
- **Routing:** Custom vanilla router in `src/lib/router.js` with lazy-loaded page factories
- **Icons:** Inline SVG strings
- **API Layer:** `src/lib/muapi.js`, `src/lib/apiKeyManager.js` (Muapi, OpenAI, VideoDB keys)
- **Auth:** Clerk entitlements (`src/lib/clerkEntitlements.js`), `AuthModal`
- **Media:** Upload via `src/components/UploadPicker.js` (file, URL, drag-drop, paste), `src/lib/uploadHistory.js`, `src/lib/security.js` (XSS-safe media)

### Architectural Inconsistencies (Notable)
- **Vanilla JS vs React:** 90% of studios are vanilla DOM factories; modals/elements are React+MobX. `ModalContainer.jsx` is the only React root in the studio layer.
- **Dual SettingsModal:** `src/components/SettingsModal.js` (vanilla, provider API key setup) AND `src/components/modals/SettingsModal.jsx` (React).
- **App.js vs Next.js pages:** `src/components/App.js` is a vanilla router with 4 routes; `pages/` directory has Next.js pages (`pages/index.js`, `pages/edit.js`, etc.). The app appears to have both a vanilla SPA shell and Next.js pages coexisting.

---

## Routing & Navigation

### Route Map (`src/lib/router.js`)
| Route ID | Studio/Page | Lazy Loaded Component |
|---|---|---|
| `/` | Landing Page | `LandingPage.js` |
| `/personalize` | Personalize Page | `PersonalizePage.js` |
| `/editor` | Video Editor | `VideoEditorPage.js` |
| `/smartvideo-demo` | Demo | inline |
| `/image` | Image Studio | `ImageStudio.js` |
| `/video` | Video Studio | `VideoStudio.js` |
| `/cinema` | Cinema Studio | `CinemaStudio.js` |
| `/apps` | Apps Hub | `AppsHub.js` |
| `/templates` | Templates | `TemplatesPage.js` |
| `/effects` | Effects Studio | `EffectsStudio.js` |
| `/edit` | Edit Studio | `EditStudio.js` |
| `/upscale` | Upscale Suite | `UpscaleStudio.js` |
| `/library` | Library | `LibraryPage.js` |
| `/character` | Character Studio | `CharacterStudio.js` |
| `/influencer` | AI Influencer Studio | `InfluencerStudio.js` |
| `/commercial` | Commercial Studio | `CommercialStudio.js` |
| `/explore` | Explore | `ExplorePage.js` |
| `/avatar` | Avatar Studio | `AvatarStudio.js` |
| `/audio` | Audio Studio | `AudioStudio.js` |
| `/training` | Training Studio | `TrainingStudio.js` |
| `/videotools` | Video Tools | `VideoToolsStudio.js` |
| `/chat` | Chat Studio | `ChatStudio.js` |
| `/lipsync` | Lip Sync Studio | `LipSyncStudio.js` |
| `/assist` | Assist | `AssistPage.js` |
| `/community` | Community | `CommunityPage.js` |
| `/storyboard` | Storyboard Studio | `StoryboardStudio.js` |
| `/text-to-image` | Text-to-Image | `TextToImagePage.js` |
| `/image-to-image` | Image-to-Image | `ImageToImagePage.js` |
| `/text-to-video` | Text-to-Video | `TextToVideoPage.js` |
| `/video-to-video` | Video-to-Video | `VideoToVideoPage.js` |
| `/render` | Render | `RenderPage.js` |
| `/video-agent` | Video Agent | `VideoAgentPage.js` |
| `/director` | Director | `DirectorPage.js` |
| `/timeline` | Timeline | `Timeline.js` |
| `/account` | Account | Next.js page |
| `/billing` | Billing | Next.js page |
| `/v/[id]` | Video share | Next.js page |

### Studio Drawer Navigation
- Every studio mounts a shared drawer via `mountStudioChrome()` / `mountStudioDrawer()` (`src/lib/studioChrome.js`)
- Drawer groups studios by category: **Home**, **Create**, **Tools**
- Drawer lists ~40+ routes from `STUDIO_ROUTES` in `src/lib/studioRoutes.js`
- Each drawer item has an icon from the shared `ICONS` map

---

## Global Layout (App Shell)

### Top Bar (`studioChrome.js`)
- **Menu button** (grid icon) → opens studio drawer overlay
- **Back button** (arrow) → navigates back
- **Title** → dynamically set per studio
- **Spacer** → pushes title to center

### Studio Drawer (`mountStudioDrawer`)
- Fixed full-screen overlay, z-[60]
- Left panel 300px (max-w-[85vw])
- Backdrop with blur
- Close button top-right
- Scrollable group list
- Groups: Home (Apps, Explore, Templates), Create (Image, Video, Cinema, Storyboard, Effects, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, Video Tools, Chat, Lip Sync, Influencer), Tools (Assist, Impeccable variants, Director, Timeline, Render, Video Agent, AI VFX, etc.)

### Landing Page (`src/components/landing/LandingPage.jsx`)
- Grid of all apps/studios (30+ tiles)
- Lazy-loaded sections via IntersectionObserver
- Each tile has: icon, title, description, link to route
- Hero banner area with animations
- Not a full studio — it's the home/hub

---

## Studio Inventory

| # | Studio | Route | File | Lines | Complexity |
|---|---|---|---|---|---|
| 1 | Image Studio | `/image` | `ImageStudio.js` | ~1100 | Very High |
| 2 | Video Studio | `/video` | `VideoStudio.js` | ~1100 | Very High |
| 3 | Cinema Studio 2.0 | `/cinema` | `CinemaStudio.js` | ~1117 | Very High |
| 4 | Storyboard Studio | `/storyboard` | `StoryboardStudio.js` | ~910 | High |
| 5 | Effects Studio | `/effects` | `EffectsStudio.js` | ~501 | High |
| 6 | Edit Studio | `/edit` | `EditStudio.js` | ~262 | Medium |
| 7 | Upscale Suite | `/upscale` | `UpscaleStudio.js` | ~184 | Medium |
| 8 | Character Studio | `/character` | `CharacterStudio.js` | ~297 | Medium |
| 9 | Commercial Studio | `/commercial` | `CommercialStudio.js` | ~235 | Medium |
| 10 | Audio Studio | `/audio` | `AudioStudio.js` | ~272 | Medium |
| 11 | Avatar Studio | `/avatar` | `AvatarStudio.js` | ~262 | Medium |
| 12 | Training Studio | `/training` | `TrainingStudio.js` | ~267 | Medium |
| 13 | Video Tools Studio | `/videotools` | `VideoToolsStudio.js` | ~230 | Medium |
| 14 | Chat Studio | `/chat` | `ChatStudio.js` | ~304 | Medium |
| 15 | Lip Sync Studio | `/lipsync` | `LipSyncStudio.js` | ~848 | High |
| 16 | AI Influencer Studio | `/influencer` | `InfluencerStudio.js` | ~233 | Medium |
| 17 | Timeline | `/timeline` | `Timeline.js` | ~344 | Medium |
| 18 | Director Page | `/director` | `DirectorPage.js` | ~1471 | Very High |
| 19 | Video-to-Video | `/video-to-video` | `VideoToVideoPage.js` | ~149 | Low |

**Total: 19 studio/page components audited**

---

## Per-Studio Detailed Analysis

### 1. Image Studio (`ImageStudio.js`)

**UI Structure:**
- Hero banner (gradient image, title, subtitle)
- Prompt bar (rounded card with glass effect)
  - Top row: Upload picker trigger + textarea + GTM Boost button
  - Bottom row: Model selector | Aspect Ratio | Quality/Resolution | Thumbnail | Advanced | Tools | Personalize | Generate
- Quick Tools Panel (collapsible)
  - Quick Starters (grid of preset prompt buttons)
  - Prompt Enhancer (base prompt input + ENHANCE_TAGS toggles + enhanced output + Copy/Use buttons)
- Advanced Options Panel (collapsible)
  - Style Presets (9 options: None → Cyberpunk)
  - Negative Prompt input
  - Guidance Scale slider (1-20)
  - Steps slider (1-50)
  - Seed input + Randomize button
  - Batch Count slider (1-4)
  - Width/Height custom inputs
  - Reference Strength slider (0-100%)
  - LoRA Model input + LoRA Weight
- Canvas Area (hidden until generation)
  - Result image (max-h-[60vh], rounded, interactive glow)
  - Canvas controls: Regenerate | Download | New
- History Sidebar (right, fixed, slide-in)
  - Vertical thumbnail strip with hover overlay download button
- Dropdown menus (model search, aspect ratio, quality)

**Controls:**
- t2iModels / i2iModels (auto-switches on image upload)
- Aspect ratio per model
- Quality/resolution per model
- 9 style presets
- Negative prompt
- Guidance scale, steps, seed, batch count
- Custom width/height
- Reference strength
- LoRA model ID + weight
- Quick starters (from QUICK_PROMPTS)
- ENHANCE_TAGS (from promptUtils)
- GTM Boost prompt enhancer modal
- Personalize popover (contact-based token replacement)

**Workflows:**
1. Text-to-Image: Select model → Enter prompt → Adjust advanced → Generate
2. Image-to-Image: Upload image → Auto-switches to i2i → Enter prompt → Generate
3. Multi-image I2I: Upload multiple → Describe transformation → Generate
4. Quick Starters: Click preset → Populate prompt → Generate
5. Prompt Enhancement: Base prompt + tags → Copy/Use → Generate

**Missing:**
- No explicit loading state during generation (canvas just appears)
- No progress indicator for generation
- No error state in canvas (just silently fails or alert)
- No batch result grid (batch count slider exists but no batch gallery shown)
- No comparison slider for variations
- No "favorite" or "save to project" on history items
- History is localStorage only, no server sync
- No undo/redo

---

### 2. Video Studio (`VideoStudio.js`)

**UI Structure:**
- Hero banner
- Prompt bar
  - Top row: Image upload picker | Video upload picker (v2v) | Textarea | GTM Boost
  - Personalized chip (when contact selected)
  - Extend mode banner (for seedance-v2.0)
  - Bottom row: Model | Aspect Ratio | Duration | Resolution | Quality | Advanced | Personalize | Thumbnail | Generate
- Advanced Options (negative prompt, seed)
- Canvas Area
  - Result video (autoplay, loop, muted, controls)
  - Controls: Regenerate | Extend (seedance only) | Download | Open in Render | New
- History Sidebar (right)

**Controls:**
- t2vModels, i2vModels, v2vModels (video-to-video tools)
- Aspect ratio, duration, resolution, quality
- v2v mode: upload video → auto-hides AR/duration/resolution/quality
- Extend mode banner for seedance-v2.0-t2v/i2v
- Personalized chip (contact-based)
- Negative prompt, seed

**Workflows:**
1. T2V: Select model → Prompt → Generate
2. I2V: Upload image → Auto-switches → Prompt → Generate
3. V2V: Upload video → Auto-switches to v2v → Generate (watermark removal)
4. Extend: View seedance result → Click Extend → Add prompt → Continue

**Missing:**
- No batch video generation
- No video timeline editor inline
- No frame-by-frame preview
- No interpolation controls
- No camera motion controls (unlike Cinema Studio)
- No style/look presets
- History has no video scrubber, only thumbnail

---

### 3. Cinema Studio 2.0 (`CinemaStudio.js`)

**UI Structure:**
- Hero banner ("What would you shoot with infinite budget?")
- Cinema Prompt Builder (collapsible)
  - Base scene description input
  - Camera select (Static, Dolly In, Dolly Out, Crane Up, Orbit, FPV Drone, Handheld, Pan, Tilt, Dolly Zoom)
  - Lens select (from LENS_MAP)
  - Live preview output text
  - "Use in Prompt" button
- Camera Controls Overlay (full-screen modal-like)
  - Camera movement selector
  - Film look selector (Natural, Anamorphic, Teal & Orange, Moody Noir, Vintage, Neon Nights, Documentary, Golden Hour)
  - Focal length, aperture
  - Generated prompt display
  - "Send to Video Studio" button
- Inline instructions
- Studio chrome (back, menu)

**Controls:**
- 9 camera movements (CAMERA_MOVEMENTS)
- Film looks (FILM_LOOKS)
- Camera/lens/focal/aperture from promptUtils
- Model selector (same catalog as Video Studio)
- Generates via `buildNanoBananaPrompt()`

**Workflows:**
1. Open builder → Select camera/lens → See generated cinematic prompt → Use in Video Studio
2. Open overlay → Full camera control → Send to Video Studio
3. Direct Video Studio generation from cinematic prompt

**Missing:**
- No direct generation from Cinema Studio (always routes to Video Studio)
- No timeline or shot sequence
- No storyboard integration
- No preview of the cinematic look
- No save/load of cinematic presets
- Camera builder and overlay are somewhat redundant

---

### 4. Storyboard Studio (`StoryboardStudio.js`)

**UI Structure:**
- Hero banner
- Control bar: Layout selector (Horizontal/Grid/Story) | Preset selector (7 shot presets)
- Fullscreen preview overlay (via `createFullscreenPreview`)
- Frame cards (default 3 frames: Wide, Medium, Close-Up)
  - Each frame: shot type, prompt, narration, notes, reference images
- Inline instructions

**Controls:**
- 7 shot types (Wide, Medium, Close-Up, Extreme Close-Up, POV, Overhead, Low Angle)
- 7 shot presets (with prompts)
- 3 layout modes
- 10 style options
- 9 lighting options
- 8 color options
- Model/AR selector (per frame)
- Reference image upload (per frame)
- Batch retry with exponential backoff (max 3 retries)
- Generation progress tracking

**Workflows:**
1. Select preset → All frames populated → Generate all
2. Manual: Set layout → Edit each frame prompt → Generate individually
3. Add reference images per frame → Generate with references
4. Retry failed frames

**Missing:**
- No drag-to-reorder frames
- No frame duplication
- No frame deletion (only 3 default frames)
- No export to PDF/image
- No narration audio recording
- No transition effects between frames
- No shot timing/duration
- Limited to 3 frames by default (hardcoded)

---

### 5. Effects Studio (`EffectsStudio.js`)

**UI Structure:**
- Hero banner
- Tab row: Image Effects | Nano Banana | Kontext Effects | AI Video Effects | Motion Controls | Video FX v2
- Split panel:
  - Left: Search + Effects grid (2-col)
  - Right: Preview panel
    - Input preview (with upload)
    - Output preview
    - Prompt input + Thumbnail button
- Fullscreen preview
- Inline instructions

**Controls:**
- 6 effect categories (tabs)
- 350+ effects (from model enum `name_field`)
- Search filter
- Image/video upload
- Optional prompt per effect
- Thumbnail generator

**Workflows:**
1. Select effect tab → Search/find effect → Upload media → Apply
2. Input/output split preview
3. Fullscreen preview of result

**Missing:**
- No effect intensity/strength slider
- No effect chaining (apply multiple effects sequentially)
- No effect favorites/recent
- No before/after comparison slider
- No batch apply to multiple images
- No save effect preset
- Effect descriptions/details not shown (only name)
- No undo/redo for effect chain

---

### 6. Edit Studio (`EditStudio.js`)

**UI Structure:**
- Hero banner
- Tool grid (2-5 cols responsive): 13 tools
  - Remove Object, Remove Background, Extend Image, AI Edit, Reframe, Change Dress, Enhance Skin, Colorize, Add Watermark, Upscale, Face Swap, Product Shot, Ghibli Style
- Work area (hidden until tool selected)
  - Tool title
  - Upload area (image/video)
  - Prompt field (conditional on tool)
  - Thumbnail button
  - "Apply Edit" button
  - Result area
- Personalize trigger row
- Inline instructions

**Controls:**
- 13 edit tools (EDIT_TOOLS array)
- Image/video upload per tool
- Conditional prompt (hasPrompt flag)
- Model selector (none — uses tool-specific model IDs)

**Workflows:**
1. Select tool → Upload media → (optional prompt) → Apply Edit → View result

**Missing:**
- No tool-specific parameter panels
- No adjustment sliders (strength, blend mode, etc.)
- No layer/mask support
- No history of edits
- No comparison view
- No batch processing
- No save/edit stack

---

### 7. Upscale Suite (`UpscaleStudio.js`)

**UI Structure:**
- Hero banner
- Method selector row: AI Upscaler | Topaz Upscale | Seed Upscale
- Factor row (for AI Upscaler only): 2x | 4x
- Form card: Upload + Thumbnail + Upscale button
- Result area
- Inline instructions

**Controls:**
- 3 upscale methods
- 2x/4x factor (AI Upscaler only)
- Image/video upload

**Missing:**
- No denoise level
- No face enhancement toggle
- No color correction options
- No batch upscale
- No comparison before/after
- No save presets for different content types
- Very minimal parameter set

---

### 8. Character Studio (`CharacterStudio.js`)

**UI Structure:**
- Hero banner
- Model selector: Flux PuLID | Subject Reference
- Form card: Upload reference face | Character description textarea | GTM Boost | Personalize | Thumbnail | Generate
- Expression Presets section (5 buttons: Happy, Sad, Angry, Surprised, Neutral)
- Inline instructions

**Controls:**
- 2 character models
- Reference face upload
- Character description prompt
- GTM Boost
- Personalize trigger
- 5 expression presets (append to prompt)

**Missing:**
- No expression strength/intensity
- No multiple reference images
- No character consistency across generations (no seed lock)
- No character library/saved characters
- No pose/angle controls
- No outfit/style reference beyond text prompt
- No age/gender controls

---

### 9. Commercial Studio (`CommercialStudio.js`)

**UI Structure:**
- Hero banner
- Model selector: Product Shot | Product Photography
- Form card:
  - Product Media upload
  - Scene Preset (9 options: Studio white, Luxury marble, Outdoor, Kitchen, Neon tech, Wooden, Minimalist gradient, Beach, Office)
  - Output Format (4 options: Ad Banner 16:9, Social Post 1:1, Story 9:16, Billboard 21:9)
  - GTM Boost (via personalze trigger)
  - Thumbnail
  - Generate button
- Result area
- Inline instructions

**Controls:**
- 2 product photography models
- 9 scene presets (chip selector)
- 4 format presets (with AR)
- Upload product image/video

**Missing:**
- No background replacement controls
- No lighting controls
- No angle/composition controls
- No text overlay on product
- No brand color input
- No multi-product composition
- No A/B variant generation

---

### 10. Audio Studio (`AudioStudio.js`)

**UI Structure:**
- Hero banner
- Model selector row (audioModels)
- Form card:
  - Prompt textarea (music description)
  - GTM Boost
  - Personalize trigger
  - Style selector (hidden by default, shown for music models): Pop, Rock, Electronic, Classical, Jazz, Hip Hop, Ambient
  - Duration selector: 15s, 30s, 60s, 120s
  - Thumbnail
  - Generate button
- Inline instructions
- Result area

**Controls:**
- Multiple audio models (speech + music)
- Conditional style selector (music models)
- Duration chips
- Prompt input

**Missing:**
- No waveform preview
- No audio editor (trim, fade, etc.)
- No lyrics input for singing
- No voice cloning controls
- No BGM mixing
- No stem separation
- No audio effects (reverb, EQ, etc.)

---

### 11. Avatar Studio (`AvatarStudio.js`)

**UI Structure:**
- Hero banner
- Model selector (avatarModels)
- Form card:
  - Source Video/Image upload
  - Audio upload (conditional)
  - Prompt textarea (conditional)
  - GTM Boost
  - Personalize trigger
  - Thumbnail
  - Generate button
- Inline instructions
- Result area

**Controls:**
- Multiple avatar models
- Conditional uploads (video/image based on model.hasVideo)
- Conditional audio upload (for lip sync models)
- Conditional prompt
- Dynamic form visibility per model

**Missing:**
- No avatar customization (hair, clothes, etc.)
- No background replacement
- No expression controls
- No voice selection beyond upload
- No avatar library
- No multi-speaker support

---

### 12. Training Studio (`TrainingStudio.js`)

**UI Structure:**
- Hero banner
- Model selector (trainingModels)
- Form card:
  - LoRA Name input
  - Trigger Word input
  - Training Epochs: 5, 10, 20, 30
  - Training Images upload (multi-file, 10-20 recommended)
  - Image count display
  - Thumbnail
  - Train LoRA button
- Inline instructions
- Result area

**Controls:**
- Training model selection
- LoRA naming
- Trigger word
- Epoch count
- Multi-image upload (10-20 recommended)

**Missing:**
- No learning rate control
- No batch size control
- No training preview/progress
- No dataset preview/gallery
- No validation split
- No resume training
- No LoRA metadata output

---

### 13. Video Tools Studio (`VideoToolsStudio.js`)

**UI Structure:**
- Hero banner
- Model selector (videoToolsModels)
- Form card:
  - Source Video upload
  - Prompt textarea (conditional, hasPrompt)
  - GTM Boost
  - Personalize trigger
  - Thumbnail
  - Process Video button
- Inline instructions
- Result area

**Controls:**
- Multiple video tool models
- Conditional prompt
- Video upload

**Missing:**
- No tool-specific parameters (each tool may need different controls)
- No processing progress/status
- No output format selection
- No quality/bitrate controls
- No batch processing

---

### 14. Chat Studio (`ChatStudio.js`)

**UI Structure:**
- Hero banner
- Model selector (textModels)
- Chat container (scrollable message list)
  - Empty state: "Start a conversation" with icon
- Input area:
  - System prompt input (optional)
  - Textarea + Send button + Thumbnail button
  - Advanced Options toggle
    - Temperature (0-2)
    - Max Tokens (1-4096)
- Inline instructions

**Controls:**
- Multiple text models
- System prompt
- Temperature slider (default 0.7)
- Max tokens (default 1024)
- Send message

**Missing:**
- No conversation history persistence (in-memory only)
- No conversation rename/delete
- No streaming response indicator
- No markdown rendering
- No code highlighting
- No copy message button
- No export conversation
- No stop generation button

---

### 15. Lip Sync Studio (`LipSyncStudio.js`)

**UI Structure:**
- Hero banner
- Mode toggle: Portrait Image | Video
- Uploads row:
  - Image upload button (64x64, with states: icon, spinner, ready)
  - Video upload button (64x64, hidden in image mode)
  - Audio upload button (64x64)
  - Textarea (optional talking style/motion)
  - GTM Boost
- Status labels (No image / No audio / No video)
- Model selector dropdown + Resolution dropdown
- Generate button
- Inline instructions

**Controls:**
- 2 input modes (image/video)
- Image upload (image mode)
- Video upload (video mode)
- Audio upload (both modes)
- Optional prompt
- Model selection
- Resolution selection

**Missing:**
- No audio waveform preview
- No lip sync timing adjustment
- No phoneme-level editing
- No multiple voice selection
- No background replacement for portrait
- No expression control beyond text prompt

---

### 16. AI Influencer Studio (`InfluencerStudio.js`)

**UI Structure:**
- Hero banner
- Form card:
  - Upload reference photo/video
  - Style Preset (20 options: Realistic, DigitalCam, Quiet luxury, FashionShow, 90s Grain, Sunset beach, Amalfi Summer, Bimbocore, Vintage PhotoBooth, Gorpcore, Indie sleaze, Fairycore, Avant-garde, Y2K Posters, Grunge, Coquette core, Tokyo Streetstyle, 2049, Night rider, Glazed doll skin makeup)
  - Output Format (4 options: Instagram Post 1:1, Story/Reel 9:16, YouTube Thumb 16:9, Pinterest Pin 2:3)
  - Additional instructions textarea
  - GTM Boost
  - Personalize trigger
  - Thumbnail
  - Generate button
- Result area
- Inline instructions

**Controls:**
- 20 style presets
- 4 format presets
- Reference upload
- Text prompt

**Missing:**
- No style intensity/blend
- No pose/angle controls
- No outfit customization
- No background swap
- No batch style variations
- No style favorites

---

### 17. Timeline (`Timeline.js`)

**UI Structure:**
- Timeline top toolbar
  - Tool group (empty placeholder)
  - Zoom out / Zoom in
  - Add Video/Audio/Text/B-Roll track buttons
  - Pill row (empty placeholder)
- Timeline shell
  - Header: Tracks | Timeline
  - Body: Playhead layer + Track rows
- Playhead (line + knob)
- Tracks: Video, Audio, Text, B-Roll (default)
  - Each track: mute, solo, lock toggles
  - Clips with left position and width

**Controls:**
- Zoom in/out
- Add tracks (4 types)
- Clip selection
- Track mute/solo/lock
- Playhead position
- Tool selection

**Missing:**
- No clip dragging/resizing
- No clip splitting/trimming
- No clip properties editor
- No timeline scrolling
- No snap-to-grid
- No keyboard shortcuts
- No undo/redo
- No media import to timeline
- No export/render from timeline

---

### 18. Director Page (`DirectorPage.js`)

**UI Structure:**
- 45 agent cards in a grid
- Categories: Analysis, Search, Extract, Translate, Accessibility, Enhance, Audio, Edit, Create, Social
- Each agent: icon, name, description, category badge
- Backend wiring: VideoDB, VideoAgent, FFmpeg agents
- Retry logic with exponential backoff
- Job polling (10-min timeout)
- Progress callbacks

**Controls:**
- 45 director agents
- Category filtering
- Agent execution with progress

**Missing:**
- No agent detail page/configuration
- No agent chaining/workflows
- No saved agent presets
- No agent history
- No custom agent creation

---

### 19. Video-to-Video Page (`VideoToVideoPage.js`)

**UI Structure:**
- Hero banner
- Features section (4 cards: Style Transfer, Speed Control, Professional Grading, Real-time Preview)
- Tools section (4 cards: Style Transfer, Color Grading, Slow Motion, Speed Ramping)
- Example Prompts section (3 cards with "Try this" buttons)

**Controls:**
- Static page — no actual generation controls
- 4 tool cards
- 3 example prompts

**Missing:**
- No actual generation UI (this is a landing/showcase page, not a functional studio)
- No upload
- No prompt input
- No generation button

---

## Shared UI Components

### UploadPicker (`UploadPicker.js`)
- **Trigger button:** 40x40, icon/spinner/thumbnail states, count badge
- **Panel:** 288px wide, glass effect, rounded-3xl
  - Header: "Reference Images" label + Upload New + From URL buttons
  - Empty state: 4 upload method tiles (Upload, URL, Drop, Paste)
  - History grid: 3-col, max-h-56, with hover overlay delete
  - Selection: single-select (auto-close) or multi-select (Done button, bottom bar)
  - Drop zone: dashed border, drag-drop support
  - URL input: inline form with Load button
  - Paste support: document-level paste listener
- **States:** Icon | Spinner | Thumbnail (with count badge)
- **Public API:** `reset()`, `setMaxImages(n)`, `getSelectedUrls()`, `setImage(url, thumbnail)`
- **Features:** Upload history persistence, thumbnail generation, drag-drop, paste, URL load, multi-select with ordering

### MediaPreview (`MediaPreview.js`)
- `createMediaPreview(options)`:
  - Empty state (no media loaded icon)
  - Image/video display with loading spinner
  - Meta bar (filename, resolution, duration, file size, model)
  - Download link in meta
  - `load(url, meta)`, `loadFile(file)`, `showLoading(msg)`, `showError(msg)`, `clear()`
- `createFullscreenPreview()`:
  - Full-screen overlay (z-200, backdrop blur)
  - Close on backdrop click
  - Image/video display
  - Prompt/model info
  - Download button

### StudioThumbnailModal (`modals/StudioThumbnailModal.jsx`)
- Extends `TemplateThumbnailModal`
- 5-step flow: brief → generate → refine → saved
- Used by Image, Video, Cinema, Effects, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Influencer studios
- Configurable: `appTheme`, `studioId`, `studioName`, `aspectRatio`, `outputType`, `onApply`, `onClear`

### SettingsModal (`SettingsModal.js`)
- Full-screen overlay, centered modal
- 3 provider forms: Muapi, OpenAI, VideoDB
- Each form: password input, "Grab API Key" link, status, Save/Clear/Test buttons
- Validation: whitespace, duplicate key, too short
- Test connection for OpenAI and VideoDB (real ping)
- Skip/Done buttons

### StudioChrome (`studioChrome.js`)
- `mountStudioChrome(rootContainer, opts)`:
  - Inserts topbar at root's first child
  - Topbar: menu button | back button | title | spacer
- `mountStudioDrawer(rootEl, opts)`:
  - Full-screen overlay drawer
  - 300px left panel
  - Groups: Home, Create, Tools
  - Close button + backdrop click to close

### Base Component (`base/Component.js`)
- Lifecycle: beforeMount, mounted, beforeUpdate, updated, beforeUnmount, unmounted
- Error boundary: onError → renderError
- State: setState, shouldUpdate, forceUpdate
- Store subscriptions: subscribeToStore, unsubscribeFromStores
- Event management: addEventListener, removeEventListener, removeAllEventListeners (auto-cleanup)
- DOM: createElementFromHTML, createElement, $, $$
- Utilities: debounce, throttle, generateId, clone, isBrowser, log, error

### Base Store (`stores/base/Store.js`)
- Pub/Sub pattern
- `getState`, `setState`, `update`
- `subscribe`, `unsubscribe`, `notify`
- `computed(dependencies, computeFn)`
- `action(name, fn)`
- `isEqual`, `reset`, `get`, `has`, `getInfo`
- Middleware: `logger`, `persistence`, `validation`
- Hooks: `useStore`, `useSelector`, `useDispatch`

---

## Modals System

### React + MobX ModalContainer (`ModalContainer.jsx`)
- Reads active modal IDs from `useModalStore()`
- Looks up config in `MODAL_CONFIG`
- Renders overlay + centered panel with inline styles
- Supports: className, maxWidth, header.title
- Out of scope: header.tabs, themeChange, permission gating

### Available Modals (27 modals in `src/components/modals/`)
| Modal | Purpose |
|---|---|
| `BaseModal.jsx` | Base modal wrapper |
| `SettingsModal.jsx` | React settings (API keys) |
| `StudioThumbnailModal.jsx` | Thumbnail generation flow |
| `TemplateThumbnailModal.jsx` | Template-based thumbnail |
| `TemplatePreviewModal.jsx` | Template preview |
| `TemplateGeneratorModal.jsx` | Template generation |
| `PersonalizeModal.jsx` | Personalization setup |
| `PersonalizationModal.jsx` | Personalization flow |
| `VideoPersonalizationHub.jsx` | Video personalization hub |
| `RecorderModal.jsx` | Screen/camera recorder |
| `EnhancedRecorderModal.jsx` | Enhanced recorder |
| `VideoPlayerModal.jsx` | Video player modal |
| `UrlVideoModal.jsx` | URL video import |
| `SubtitleEditorModal.jsx` | Subtitle editing |
| `ContactImporterModal.jsx` | Contact import |
| `LeadGeneratorModal.jsx` | Lead generation |
| `EmailCampaignModal.jsx` | Email campaign |
| `SocialPublisherModal.jsx` | Social publishing |
| `LandingPageBuilder.jsx` | Landing page builder |
| `PageShotModal.jsx` | Screenshot capture |
| `SaveProjectModal.jsx` | Project save |
| `CreateProjectModal.js` | Project creation |
| `ImageCropperModal.js` | Image cropping |
| `EndScreenModal.jsx` | End screen design |
| `ConnectModal.jsx` | Connect integration |
| `OpenAIImageEditorModal.jsx` | OpenAI image editing |
| `GTMPromptModal.jsx` | GTM prompt enhancer |
| `PreviewMediaModal.jsx` | Media preview |

### Vanilla JS Modals
- `AuthModal` (imported from `AuthModal.js`)
- `StudioThumbnailModal` (vanilla class wrapping TemplateThumbnailModal)
- `SettingsModal` function in `SettingsModal.js` (vanilla)

---

## State Management

### Patterns Observed
1. **Local component state:** Most studios use plain `let` variables in closure scope (e.g., `let selectedModel`, `let uploadedUrl`)
2. **Store class:** Used in Storyboard Studio (`storyboardStore`) and potentially others
3. **localStorage:** Used for:
   - `muapi_history` / `video_history` (generation history)
   - `prefill_prompt` (prefill from navigation)
   - `remix_selected_contact_id`, `remix_contacts`, `remix_contact_profiles` (personalization)
   - `uploadHistory` (upload picker history)
   - Custom thumbnails cache (per studio)
4. **URL routing state:** Current route drives which studio renders
5. **React state:** Only in ModalContainer and elements tab (useState)

### No Global App State
- There is no centralized app-level store visible in the studios
- Each studio manages its own state independently
- No cross-studio data sharing except via localStorage

---

## Upload & Media Handling

### Upload Methods (per UploadPicker)
1. **File picker:** `<input type="file">` with accept filtering
2. **URL load:** `fetchUrlAsFile()` via `appendUrlInput()`
3. **Drag and drop:** Panel-level and drop zone-level drag events
4. **Paste:** Document-level paste listener (captures clipboard files)

### Upload Flow
1. User triggers picker → Panel opens
2. Select file/URL/drop/paste
3. Spinner shown on trigger
4. `muapi.uploadFile(file)` → returns URL
5. `generateThumbnail(file)` → returns thumbnail URL
6. Entry saved to `uploadHistory` (localStorage)
7. Trigger shows thumbnail + count badge
8. `onSelect({ url, urls, thumbnail })` fires

### Multi-Image Support
- `maxImages` parameter controls single vs multi mode
- Multi-mode: "Done" button, "Use Selected" bottom bar, numbered badges
- Single-mode: Auto-select and close panel

### Upload History
- Stored in localStorage via `uploadHistory.js`
- Grid display with thumbnails
- Delete per entry
- Re-select from history

---

## Generation Controls Patterns

### Common Pattern (Simple Studios)
```
Hero Banner → Model Selector Row → Form Card → [Upload] → [Prompt/Params] → [Thumbnail] → [Generate] → Result Area
```

### Complex Pattern (Image/Video Studio)
```
Hero Banner → Prompt Bar (upload + textarea + GTM Boost) →
  Bottom Controls Row (Model | AR | Quality | Thumbnail | Advanced | Tools | Personalize | Generate) →
  Quick Tools Panel (collapsible) →
  Advanced Options Panel (collapsible) →
  Canvas Area (hidden until result) →
  History Sidebar (right, slide-in)
```

### Generation Flow
1. User fills prompt + params
2. Clicks Generate
3. `requireEntitlement()` check
4. `apiKeyManager.getMuapiKey()` check → AuthModal if missing
5. Button disabled + spinner text
6. API call via `muapi.generateT2I()` / `muapi.generateT2V()` / etc.
7. On success: Show result in canvas/result area
8. On error: `alert(err.message)` or console.error
9. Add to history (localStorage)
10. Button re-enabled

### No Streaming/Progress
- All generations are fire-and-forget with final result display
- No intermediate progress updates
- No cancellation mechanism visible

---

## Empty / Loading / Error / Success States

### Empty States
- **UploadPicker:** "4 ways to upload" tiles when history is empty
- **MediaPreview:** "No media loaded" with image icon
- **ChatStudio:** "Start a conversation" with chat icon
- **ElementsTab:** "Add your first element to get started"
- **Landing:** Not applicable (always has content)

### Loading States
- **UploadPicker trigger:** Spinner overlay while uploading
- **MediaPreview:** Spinner overlay while loading image/video
- **Generate button:** Text changes to "Generating..." with spinner, button disabled
- **VideoStudio video upload:** Icon → Spinner → Ready state
- **LipSyncStudio:** Icon/Spinner/Ready states for each upload type

### Error States
- **Upload failure:** `alert()` with error message
- **Generation failure:** `alert(err.message)` (most studios)
- **MediaPreview:** Error message with icon in preview area
- **API key validation:** Inline error text in SettingsModal
- **Auth failure:** AuthModal re-opens

### Success States
- **Upload:** Trigger shows thumbnail + count badge + green border
- **Generation:** Canvas/result area shows with fade-in animation
- **History:** Newest item highlighted with `border-primary shadow-glow`
- **Save:** Button text briefly changes to "Saved ✓" then reverts

---

## What's Missing at a Glance

### Critical UX Gaps
| Gap | Affected Studios | Severity |
|---|---|---|
| No consistent loading/progress indicator during generation | All studios | High |
| No cancellation mechanism for long-running generations | All studios | High |
| No error state UI in result areas (only `alert()`) | All studios | High |
| No batch result gallery (batch count slider in ImageStudio unused) | ImageStudio | Medium |
| No clip dragging/resizing in Timeline | Timeline | High |
| No conversation persistence in Chat | ChatStudio | Medium |
| No streaming responses in Chat | ChatStudio | Medium |
| No effect chaining in Effects | EffectsStudio | Medium |
| No before/after comparison | EffectsStudio, EditStudio | Medium |

### Feature Gaps
| Gap | Affected Studios | Severity |
|---|---|---|
| No undo/redo anywhere | All studios | Medium |
| No keyboard shortcuts | All studios | Medium |
| No project save/load system | All studios | High |
| No asset library integration | All studios | Medium |
| No collaboration features | All studios | Low |
| No i18n/l10n | All studios | Low |
| No dark/light theme toggle | All studios | Low |
| No accessibility audit (ARIA is partial) | All studios | Medium |

### Architectural Inconsistencies
| Issue | Details | Severity |
|---|---|---|
| Vanilla JS + React hybrid | 90% vanilla, modals/elements React+MobX | Medium |
| Dual SettingsModal | Vanilla + React versions exist | Low |
| App.js router vs Next.js pages | Two routing systems | Medium |
| No centralized state | Each studio manages own state | Medium |
| localStorage overuse | History, settings, personalization all in localStorage | Medium |

### Design System Gaps
| Gap | Details |
|---|---|
| No shared button/input components | Each studio creates its own buttons/inputs |
| No shared typography scale | Font sizes/weights vary |
| No shared spacing system | Padding/margin inconsistent |
| No shared color tokens beyond Tailwind | `primary`, `secondary`, `muted` used but not defined in one place |
| No shared animation library | `animate-fade-in-up` used but no standard set |
| Icon inconsistency | Mix of SVG, emoji (🎯 GTM Boost), and icon fonts |

---

## Key Findings Summary

1. **17+ production studios** with varying levels of UI richness — ImageStudio and VideoStudio are the most feature-complete; Video-to-Video is a placeholder.

2. **Two architectural layers:** A vanilla JS DOM factory layer (studios) and a React+MobX layer (modals, elements). They coexist but don't share components or patterns.

3. **Common studio pattern** is: Hero → Form Card → Upload → Prompt → Params → Generate → Result. This is consistent across ~12 studios.

4. **ImageStudio and VideoStudio are the gold standard** for UI richness: they have history sidebars, quick tools panels, advanced options, canvas areas, dropdown menus with search, and multiple input modes.

5. **Cinema Studio is unique** with its cinematic prompt builder and full-screen camera controls overlay — the most "director-like" experience.

6. **Effects Studio has the most content** (350+ effects) but lacks effect chaining, intensity controls, or before/after comparison.

7. **Timeline is skeletal** — it shows track/clip structure but lacks any editing interactions (drag, resize, trim, split).

8. **Director Page has 45 agents** but no agent configuration UI — it's a grid of agents that likely opens a generic execution flow.

9. **Upload infrastructure is excellent** — UploadPicker supports file, URL, drag-drop, paste, multi-select, and history with thumbnails.

10. **No project/asset management** — generations are ephemeral (localStorage history only), no project save/load, no asset library, no collaboration.

11. **GTM Boost prompt enhancer** is integrated into ~10 studios but inconsistently (sometimes as a button, sometimes via personalze trigger).

12. **Personalization** (contact-based token replacement) is present in ~8 studios via `mountPersonalizePopover` / `mountPersonalizeTrigger`.

13. **No server-side state sync** — all state is local (localStorage or closure variables). A page refresh loses all unsaved work.

14. **Error handling is primitive** — mostly `alert()` calls. No inline error states, no retry UI, no graceful degradation.

15. **Missing progressive disclosure** — studios either show all controls or hide them in an "Advanced" panel. No contextual help, no tooltips on most controls beyond `data-tooltip`.

---

*End of Audit Report*
*Generated by SUB-AGENT 1: CURRENT APP UI/UX AUDITOR*
