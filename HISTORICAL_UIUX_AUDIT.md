# HISTORICAL_UIUX_AUDIT — SmartVideo AI
**Repository:** https://github.com/deangilmoreremix/remix-new-editor  
**Baseline Commit:** afad812a22d9f6f470222a99136b7cd651f61a89  
**Audit Date:** 2026-08-11  
**Auditor:** SUB-AGENT 2 — HISTORICAL UI/UX FORENSICS  

---

## 1. EXECUTIVE SUMMARY

The historical repository at baseline commit `afad812` is a mature, feature-rich AI video/image generation platform called **SmartVideo AI** (also referred to as "Remix New Editor"). It contains **30+ studio surfaces**, a sophisticated **timeline editor**, **template engine**, **GTM Boost** prompt enhancement system, and extensive **model selector** infrastructure. The codebase is primarily vanilla JavaScript with selective React/JSX usage in modals and timeline components.

**Key architectural traits:**
- Vanilla DOM manipulation with class-based component factories (`*Studio.js` pattern)
- Pub/sub state management via custom `Store` base class
- Extensive `localStorage` persistence for history, settings, drafts
- Modular `lib/` directory with 100+ utility modules
- SCSS + Tailwind CSS utility classes
- 1,695+ static image assets in `public/`

---

## 2. STUDIO COMPONENTS & STRUCTURE

### 2.1 Studio Inventory

| Studio | File | Primary Function |
|--------|------|------------------|
| **Edit Studio** | `src/components/EditStudio.js` | 13 AI image editing tools (object removal, background removal, face swap, upscale, etc.) |
| **Image Studio** | `src/components/ImageStudio.js` | Text-to-image + image-to-image generation |
| **Video Studio** | `src/components/VideoStudio.js` | Text-to-video, image-to-video, video-to-video |
| **Effects Studio** | `src/components/EffectsStudio.js` | 350+ visual effects (image + video) |
| **Character Studio** | `src/components/CharacterStudio.js` | Consistent character generation via face ID preservation |
| **Template Studio** | `src/components/TemplateStudio.js` | Template-driven cinematic video/image generation |
| **Cinema Studio** | `src/components/CinemaStudio.js` | Cinematic video creation |
| **Cinema Template Studio** | `src/components/CinemaTemplateStudio.js` | Cinematic template variants |
| **Commercial Studio** | `src/components/CommercialStudio.js` | Commercial/advertising content |
| **Influencer Studio** | `src/components/InfluencerStudio.js` | Influencer-style content |
| **Avatar Studio** | `src/components/AvatarStudio.js` | Avatar generation |
| **Lip Sync Studio** | `src/components/LipSyncStudio.js` | Lip-sync video generation |
| **Storyboard Studio** | `src/components/StoryboardStudio.js` | AI storyboard creation |
| **Upscale Studio** | `src/components/UpscaleStudio.js` | Video/image upscaling |
| **Audio Studio** | `src/components/AudioStudio.js` | Audio generation/editing |
| **Video Tools Studio** | `src/components/VideoToolsStudio.js` | Video utility tools |
| **Training Studio** | `src/components/TrainingStudio.js` | Model training interface |
| **AI VFX** | `src/components/AIVFXPage.js` | AI-powered VFX |
| **Video Editor** | `src/components/VideoEditorPage.js` | Full timeline-based video editor |
| **Director** | `src/components/DirectorPage.js` | AI director interface |
| **Video Agent** | `src/components/VideoAgentPage.js` | AI video agent |
| **Assist** | `src/components/AssistPage.js` | AI assistant |
| **Chat Studio** | `src/components/ChatStudio.js` | Chat-based interaction |
| **Render** | `src/components/RenderPage.js` | Render queue/management |
| **Timeline Editor** | `src/components/TimelineEditorPage.jsx` | Advanced multi-track timeline editor |

### 2.2 Studio Chrome Pattern

All studios use a shared chrome system (`src/lib/studioChrome.js`):
- **Top bar** with hamburger menu + back button
- **Slide-in drawer** listing all studio routes (grouped by category)
- Consistent `mountStudioChrome(container, { currentRoute })` API
- Left rail spacer (68px) for icon-based sidebar on desktop

### 2.3 Component Architecture

- **Vanilla class factories**: `EditStudio()`, `VideoStudio()`, etc. return DOM containers
- **React components**: Used selectively in modals, timeline, and landing pages
- **Lifecycle**: Components have `render()`, `afterRender()`, `destroy()` methods
- **Router**: Custom vanilla router (`src/lib/router.js`) with `navigate()` function

---

## 3. TOOL COMPONENTS

### 3.1 EditStudio Tools (13 tools)

```
ai-object-eraser, ai-background-remover, ai-image-extension,
seedream-5.0-edit, ideogram-v3-reframe, ai-dress-change,
ai-skin-enhancer, ai-color-photo, add-image-watermark,
ai-image-upscaler, ai-image-face-swap, ai-product-shot,
ai-ghibli-style
```

Each tool has:
- SVG icon (20x20)
- Name + description
- `hasPrompt` flag
- Optional `promptPlaceholder`
- Tool-specific controls (aspect ratio, quality, watermark params, etc.)

### 3.2 EffectsStudio Tabs (6 categories)

```
image-effects, nano-banana-effects, flux-kontext-effects,
ai-video-effects, motion-controls, video-effects-v2
```

Effects are model-driven via `i2iModels` and `i2vModels` with `name.enum` values.

### 3.3 Tool Grid Pattern

- Grid layout: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Card style: `bg-white/[0.03] border border-white/5 rounded-xl`
- Hover: `hover:bg-white/[0.06] hover:border-white/10`
- Thumbnail hero with skeleton loader
- Active state: `border-primary`

---

## 4. CONTROLS

### 4.1 Control Types

| Control | Usage | Example |
|---------|-------|---------|
| **Select dropdown** | Model, aspect ratio, duration, resolution, quality | ImageStudio, VideoStudio |
| **Custom dropdown** | Model selector with provider sidebar + search | All studios |
| **Slider (range)** | Guidance scale, steps, batch count, reference strength, compression | ImageStudio advanced, ThumbnailStudio |
| **Toggle switch** | Auto-save, tooltips, GPU acceleration, AI enhancer | SettingsModal, TemplateStudio |
| **Text input** | Prompts, API keys, negative prompts, seed | All studios |
| **Textarea** | Prompts, descriptions, output | All studios |
| **Number input** | Width, height, seed, target index | ImageStudio, EditStudio |
| **File input** | Image/video upload | All studios |
| **Color picker** | Brand colors | ThumbnailStudio |
| **Button group** | Style presets, format options | ImageStudio, ThumbnailStudio |

### 4.2 Control Styling Patterns

```css
/* Base input style */
bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
focus:outline-none focus:border-primary/50 transition-colors

/* Control button */
flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10
rounded-xl border border-white/5 group whitespace-nowrap
```

### 4.3 Model Selector Dropdown

Reusable `ModelSelectorDropdown` class (`src/components/modals/ModelSelectorDropdown.jsx`):
- Split-pane: provider sidebar (icon grid) + model list + search bar
- Provider logos from `PROVIDER_LOGOS` map
- Filter by provider, search by name
- Used in ImageStudio, VideoStudio, TemplateStudio, CharacterStudio

---

## 5. SETTINGS, FORMS, MODALS, DRAWERS, SIDEBARS, PANELS

### 5.1 Settings Modal

`src/components/modals/SettingsModal.jsx` — 6 tabs:
- **General**: Theme (dark/light/system), language, auto-save, tooltips, waveform
- **API**: OpenAI key management
- **Audio**: Input/output devices, sample rate, normalization, noise reduction, echo cancellation
- **Video**: GPU acceleration, hardware decoding, preview/render quality, default resolution
- **Keyboard**: Shortcut categories (Playback, Editing, Timeline, Export) with reset
- **Export**: Format (MP4/WebM/MOV), quality presets, bitrate

### 5.2 Modal System

`BaseModal.jsx` provides:
- Overlay with backdrop blur
- Size variants: small (400px), medium (600px), large (800px), full (90vw)
- Header, body, footer
- CSS custom properties for theming
- 30+ modal implementations in `src/components/modals/`

### 5.3 Drawers & Panels

| Component | Type | Purpose |
|-----------|------|---------|
| `mountStudioDrawer` | Slide-in drawer | All-studios navigation |
| `StudioThumbnailPanel` | Right-side panel | Thumbnail generation |
| `historySidebar` | Right-side slide-in | Generation history |
| `SettingsModal` | Centered modal | App settings |
| `GTMPromptModal` | Centered modal | Prompt enhancement |
| `PersonalizationModal` | Centered modal | Token management |
| `ContactImporterModal` | Centered modal | Contact import |

### 5.4 Sidebar Navigation

`src/components/Sidebar.js` — 24 icon-based nav items + settings:
- Fixed 68px width
- Active state highlighting
- Bottom settings button
- Hidden on mobile (`hidden md:flex`)

---

## 6. TABS, TOOLBARS

### 6.1 Tabs

| Location | Tabs |
|----------|------|
| **SettingsModal** | General, API, Audio, Video, Keyboard, Export |
| **TemplateStudio** | Enhanced Prompt, Scene Beats, Voiceover, Negative Prompt |
| **EffectsStudio** | Image Effects, Nano Banana, Kontext Effects, AI Video Effects, Motion Controls, Video FX v2 |
| **ThumbnailStudio** | Brief, Brand/Platform, Generate, Refine, Text Overlay, Saved |

### 6.2 Toolbars

- **Studio top bar**: Menu + back + title
- **Prompt bar**: Upload + textarea + GTM Boost + controls
- **Control row**: Model, AR, duration, resolution, quality, advanced, thumbnail, personalize
- **Canvas controls**: Regenerate, download, extend, render, new
- **Timeline toolbar**: Multi-camera, pip, split-screen, subtitles, transitions

---

## 7. PRESETS, ADVANCED SETTINGS

### 7.1 Style Presets (ImageStudio)

```
None, Photorealistic, Anime, Cinematic, Oil Painting,
Watercolor, Digital Art, Concept Art, Cyberpunk
```

### 7.2 Advanced Options Panels

**ImageStudio Advanced:**
- Style presets (button group)
- Negative prompt
- Guidance scale slider (1-20)
- Steps slider (1-50)
- Seed input + randomize
- Batch count slider (1-4)
- Width/height custom dimensions
- Reference strength slider (0-100%)
- LoRA model input + weight

**VideoStudio Advanced:**
- Negative prompt
- Seed input + randomize

**TemplateStudio Advanced:**
- Template type select
- Niche select
- Business type, audience, subject, setting inputs
- Visual style select
- CTA input
- Extra instructions textarea

**EffectsStudio Advanced:**
- Persisted to localStorage
- Guidance scale, steps, seed
- Negative prompt
- Denoise strength, effect strength, cfg scale

**ThumbnailStudio Advanced:**
- Model, n candidates, responses model
- Custom size, background, moderation
- Style, input fidelity, output format
- Compression slider
- Streaming partials, store responses
- Reference images (multi-file upload + URL)
- Brand kit (name, colors, logo)

---

## 8. GALLERIES, PREVIEW SYSTEMS

### 8.1 Template Gallery (TemplatesPage)

- Category sections with count badges
- Niche-based grouping
- Search + filter chips
- Card grid with thumbnail hero
- Hover-reveal thumbnail studio button
- Session-cached thumbnails

### 8.2 Explore Page

- Trending templates grid
- Prompt library (12 curated prompts)
- Category browser with counts
- "Try this prompt" → prefill + navigate

### 8.3 History Sidebar

- Fixed right-side, 80-96px wide
- Vertical thumbnail strip
- Download overlay on hover
- Click to restore to canvas
- Persisted to localStorage (30 video, 50 image entries)

### 8.4 Preview Systems

| Component | Preview Type |
|-----------|--------------|
| `MediaPreview.js` | Image/video preview with fullscreen |
| `createFullscreenPreview` | Fullscreen media viewer |
| `createMediaPreview` | Inline media preview |
| Canvas area | Result display with regenerate/download/new |
| ThumbnailStudio | Candidate grid with selection |

### 8.5 Thumbnail Systems

- `getTemplateThumbnail` / `getCategoryThumbnail` — fallback chains
- `createThumbnailImg` — safe image creation
- `getHeroSection` — banner backgrounds
- Custom thumbnail cache per studio
- GTM thumbnail bridge for cross-studio thumbnails

---

## 9. GENERATION WORKFLOWS, RESULT WORKFLOWS

### 9.1 Image Generation Flow

```
Prompt → Model Select → [Upload] → [Advanced] → Generate
  → Loading spinner → Canvas display → History → Download/Regenerate/New
```

### 9.2 Video Generation Flow

```
Prompt/Image/Video → Model Select → Controls → [Advanced] → Generate
  → Loading → Canvas (video player) → History → Download/Extend/Regenerate/Render/New
```

### 9.3 Template Flow

```
Template select → Form inputs → [AI Enhancer toggle] → [Advanced]
  → [GTM Boost] → Generate → Output tabs → Preview
```

### 9.4 Thumbnail Flow (5-step)

```
1. Brief (prompt + quality/style/platform)
2. Generate (3 candidates)
3. Refine (chat-based editing)
4. Text Overlay
5. Saved (upload to storage + apply)
```

### 9.5 Edit Tool Flow

```
Tool select → Upload image/video → Tool-specific controls → Apply Edit
  → Result image → Download
```

### 9.6 Result States

- **Loading**: Animated spinner + "Generating..." / "Processing..."
- **Success**: Result in canvas with action buttons
- **Error**: Red error message + button text reset after 3s
- **Empty**: Standby text in preview area

---

## 10. STATE MANAGEMENT PATTERNS

### 10.1 Store Base Class

`src/stores/base/Store.js` — Pub/sub with:
- `getState()`, `setState()`, `update()`
- `subscribe()`, `unsubscribe()`, `notify()`
- `computed()` for derived values
- `action()` wrapper for debugging
- Middleware: `logger`, `persistence`, `validation`
- `useStore`, `useSelector`, `useDispatch` hooks

### 10.2 React State

`useTimelineStore.jsx` — useState + useEffect with localStorage persistence:
- Clips, tracks, currentTime, zoom, duration, playing, selectedClipId
- Actions: addClip, removeClip, updateClip, addTrack, removeTrack, etc.

### 10.3 Component-Level State

Most studios use **module-level closures**:
```javascript
let selectedModel = defaultModel.id;
let uploadedUrl = null;
let showAdvanced = false;
```

### 10.4 Persistence Strategies

| Data | Storage | Key |
|------|---------|-----|
| Video history | localStorage | `video_history` |
| Image history | localStorage | `muapi_history` |
| Timeline state | localStorage | `timeline-state` |
| Advanced settings | localStorage | `effects_studio_advanced_settings` |
| Contact profiles | localStorage | `remix_contact_profiles` |
| Selected contact | localStorage | `remix_selected_contact_id` |
| GTM context | localStorage | `gtm_context_*` |
| Thumbnail cache | sessionStorage | `templatesThumbCache:*` |
| Custom thumbnails | localStorage | per-studio keys |

---

## 11. UX FLOWS

### 11.1 Navigation Flow

```
Landing → Apps Hub → Studio (via sidebar/drawer)
  or /personalize, /editor, /smartvideo-demo
```

### 11.2 Studio Entry Flow

1. User clicks studio icon in sidebar
2. `navigate(route)` triggers router
3. Router instantiates studio component
4. `mountStudioChrome` adds top bar + drawer
5. Studio renders hero, controls, work area

### 11.3 Generation Flow

1. User enters prompt / uploads media
2. Selects model, adjusts controls
3. Clicks Generate
4. Entitlement check (`requireEntitlement()`)
5. Auth check → opens AuthModal if needed
6. Button shows spinner + "Generating..."
7. API call via `muapi`
8. On success: hide hero/prompt, show canvas with result
9. Add to history sidebar
10. On error: show error message, reset button after 3s

### 11.4 Personalization Flow

1. User selects contact from personalization popover
2. Contact profile loaded from localStorage
3. Token insertion via `{{token}}` syntax in prompt
4. Fallback: auto-prepend context block
5. Chip shows active personalization
6. Generation injects personalized prompt

### 11.5 GTM Boost Flow

1. User clicks "🎯 GTM Boost"
2. Modal opens with app-specific theming
3. User selects role, industry, methodology, tonality
4. Advanced: conversion focus, cinematic elements
5. Click Generate → streaming response
6. Result injected back into studio prompt
7. Option to generate thumbnail from same modal

---

## 12. SAMPLE CONTENT, TEMPLATES, EXAMPLES, PLAYGROUNDS

### 12.1 Curated Prompts (ExplorePage)

12 pre-written prompts across categories: Cinematic, Sci-Fi, Art, Lifestyle, Fashion, Fantasy, Commercial, Nature, Style

### 12.2 Templates

- Category-based organization
- Niche templates (restaurant, med-spa, fitness, real-estate, etc.)
- Enhanced specs: `sceneBlueprint`, `cinematography`, `visualStyle`, `enhancerKeywords`
- Cinematic wizard for `cinematic: true` templates

### 12.3 Demo Pages

- `/smartvideo-demo` — static integration demo
- `demo/index.html` — standalone demo
- Multiple `video-personalization-*.html` files
- `timeline-standalone.html`, `timeline-redesign-prototype.html`

### 12.4 Test Files

- 30+ test files in `src/test/`
- E2E tests in `e2e/`
- Component tests, integration tests, performance tests

---

## 13. EMPTY STATES, LOADING STATES

### 13.1 Loading States

| Pattern | Implementation |
|---------|----------------|
| **Skeleton** | `thumb-skeleton` absolute inset div with animation |
| **Spinner** | `animate-spin inline-block` with ◌ character |
| **Generating text** | Button text: "Generating...", "Processing..." |
| **Thumbnail loading** | Skeleton until image loads, then fade-in |
| **Model loading** | "Loading models..." text in dropdown |
| **History empty** | Sidebar hidden (`translate-x-full`) until first generation |

### 13.2 Empty States

| State | Message |
|-------|---------|
| No templates | "No templates available" |
| No models found | "No models found" in dropdown |
| No prompt | Alert: "Please enter a prompt" |
| No upload | Alert: "Upload an image/video first" |
| Preview standby | "Upload an image and click Generate to see results" |
| No history | Sidebar hidden, no message |

---

## 14. CONTENT FILES

### 14.1 Static Assets

- **1,695 files** in `public/static/`
- **1,695 image files** (PNG/JPG/SVG/WebP)
- ID photo dress assets (man, woman, child categories)
- SVG icons for UI
- `favicon.webp`

### 14.2 Demo HTML Files

- `blend-mode-test.html`
- `thumbnail-generator.html`
- `timeline-redesign-prototype.html`
- `timeline-standalone.html`
- `video-personalization-demo.html`
- `video-personalization-flow-visualization.html`

### 14.3 Sample Data

- `sample-contacts.csv`
- `models_dump.json`
- `DATABASE_SAMPLE_QUERIES.sql`

---

## 15. KEY LIBRARIES & INFRASTRUCTURE

### 15.1 Core Libraries

| Library | Purpose |
|---------|---------|
| `muapi.js` | MU API client for generation |
| `models.js` | Model catalog (t2i, i2i, i2v, v2v) with inputs/schemas |
| `modelSelectorUI.js` | Provider sidebar, search bar, model list rendering |
| `studioChrome.js` | Shared studio navigation chrome |
| `router.js` | Custom vanilla JS router |
| `apiKeyManager.js` | API key storage/retrieval |
| `thumbnails.js` | Thumbnail generation/caching |
| `templateEngine.js` | Template prompt enrichment |
| `templateSpecs.js` | Enhanced template specs |
| `promptUtils.js` | Quick prompts, enhancement tags |
| `uiIntegration.js` | Cross-component UI integration (GTM, extend, etc.) |
| `gtmResponses.js` | GTM prompt generation via OpenAI Responses API |
| `gtmContentLibrary.js` | Roles, industries, methodologies, tonalities |
| `thumbnailService.js` | OpenAI thumbnail generation service |
| `thumbnailPresets.js` | Preset system for thumbnails |
| `clerkEntitlements.js` | Auth/entitlement checks |

### 15.2 Editor Libraries

| Library | Purpose |
|---------|---------|
| `editor/TimelineState.js` | Timeline state management (26KB) |
| `editor/dragDrop.js` | Drag-and-drop system (47KB) |
| `editor/animationControls.jsx` | Animation primitives (32KB) |
| `editor/colorCorrectionSystem.jsx` | Color correction (50KB) |
| `editor/subtitleTimeline.js` | Subtitle system |
| `editor/transitionEditor.js` | Transition editing |
| `editor/keyframeSystem.jsx` | Keyframe animation |

### 15.3 Agent System

```
src/lib/agents/
  baseAgent.js, directorAgent.js, editorAgent.js,
  cameraOperatorAgent.js, screenwriterAgent.js,
  characterExtractorAgent.js
```

---

## 16. DESIGN SYSTEM

### 16.1 CSS Variables

- `--bg`, `--panel`, `--panel-soft`, `--border`, `--border-soft`
- `--text`, `--muted`, `--dim`, `--cyan`, `--cyan-soft`, `--emerald`, `--danger`
- `--radius-xl`, `--radius-lg`, `--radius-md`, `--radius-sm`
- `--shadow`, `--font`
- `--color-primary` (dynamic per studio theme)

### 16.2 Studio Color Schemes

Defined in `openaiConfig.js` — each studio has primary/accent colors:
- Video: emerald/green
- Image: primary/accent
- Edit: primary/accent
- Template: emerald/green
- Effects: violet/indigo

### 16.3 Animation System

- `animate-fade-in-up` — entrance animation
- `transition-all duration-700` — smooth transitions
- Custom scrollbar styles
- Glass morphism: `backdrop-blur-xl bg-white/[0.03]`

---

## 17. ACCESSIBILITY

- ARIA labels on inputs and buttons
- `role="status"` + `aria-live="polite"` on result areas
- Keyboard shortcuts in SettingsModal
- Focus management in modals
- `aria-label` on icon-only buttons
- Toggle switches with proper labeling

---

## 18. NOTABLE UX PATTERNS

### 18.1 Personalization Chip

Shows active contact in prompt bar with clear button:
```
👤 Personalized for John at Acme Corp  ✕
```

### 18.2 History Sidebar

- Hidden by default (`translate-x-full opacity-0`)
- Slides in on first generation
- Vertical thumbnail strip with hover download
- Click to restore previous result

### 18.3 GTM Boost Integration

- Consistent button styling across all studios
- App-specific theming via `appTheme` prop
- Streaming generation with live text
- Thumbnail generation bridge

### 18.4 Studio Thumbnail

- Per-studio custom thumbnail support
- Cached in localStorage
- Studio-specific aspect ratios
- GTM thumbnail bridge for cross-studio reuse

### 18.5 Extend Mode

- Seedance 2.0 video extension
- Stores `request_id` for continuation
- "Extend" button appears on compatible generations

---

## 19. TECHNICAL DEBT & OBSERVATIONS

1. **Mixed paradigms**: Vanilla JS + React + JSX in same codebase
2. **State scattering**: Module-level closures, localStorage, Store class, React useState
3. **No TypeScript**: Minimal type safety (`.d.ts` files exist but unused)
4. **Large components**: VideoStudio.js is 1,429 lines, ImageStudio.js is 1,257 lines
5. **Inline HTML strings**: Heavy use of `innerHTML` with template literals
6. **Event listener leaks**: Some `setTimeout(() => document.addEventListener(...))` patterns without cleanup
7. **Duplicate code**: Similar dropdown implementations across studios
8. **CSS duplication**: Inline styles mixed with Tailwind classes
9. **No error boundaries**: Limited error handling in vanilla components
10. **XSS risk**: `innerHTML` usage with user data (some sanitization exists)

---

## 20. MIGRATION IMPLICATIONS

### 20.1 Components to Port

| Priority | Component | Complexity |
|----------|-----------|------------|
| HIGH | ImageStudio | Medium — core generation flow |
| HIGH | VideoStudio | High — multiple modes (t2v/i2v/v2v) |
| HIGH | EditStudio | Medium — tool switching |
| HIGH | TemplateStudio | High — complex form + output tabs |
| HIGH | TimelineEditorPage | Very High — 6,946 lines |
| MEDIUM | EffectsStudio | Medium — tabbed effect system |
| MEDIUM | ThumbnailStudio | High — 5-step flow with chat |
| MEDIUM | GTMPromptModal | Medium — streaming + forms |
| LOW | SettingsModal | Low — tabbed settings |
| LOW | Sidebar | Low — icon navigation |

### 20.2 State to Migrate

- `Store` base class → React Context/Zustand
- `useTimelineStore` → Zustand/React context
- localStorage persistence → IndexedDB or backend
- Module closures → useState/useReducer

### 20.3 Assets to Migrate

- 1,695 static images → CDN or `public/`
- Thumbnail cache → backend storage
- Demo HTML files → separate docs or archive

---

## 21. FILE INVENTORY (KEY FILES)

### Components
- `src/components/App.js` — Main app router
- `src/components/EditStudio.js` — 13-image editing tools
- `src/components/VideoStudio.js` — Video generation (1,429 lines)
- `src/components/ImageStudio.js` — Image generation (1,257 lines)
- `src/components/EffectsStudio.js` — 350+ effects (1,358 lines)
- `src/components/TemplateStudio.js` — Template-driven generation
- `src/components/TimelineEditorPage.jsx` — Full timeline editor (6,946 lines)
- `src/components/Sidebar.js` — Icon navigation sidebar

### Modals
- `src/components/modals/BaseModal.jsx` — Modal foundation
- `src/components/modals/SettingsModal.jsx` — 6-tab settings
- `src/components/modals/GTMPromptModal.jsx` — GTM prompt enhancement
- `src/components/modals/TemplateThumbnailModal.jsx` — 5-step thumbnail studio (1,598 lines)
- `src/components/modals/StudioThumbnailPanel.jsx` — Side drawer thumbnail studio

### State
- `src/stores/base/Store.js` — Pub/sub store base class
- `src/hooks/useTimelineStore.jsx` — React timeline state hook

### Lib
- `src/lib/studioChrome.js` — Shared studio chrome
- `src/lib/models.js` — Model catalog
- `src/lib/modelSelectorUI.js` — Model selector UI components
- `src/lib/thumbnails.js` — Thumbnail system
- `src/lib/templateEngine.js` — Template prompt engine
- `src/lib/promptUtils.js` — Quick prompts + enhancement tags

### Styles
- `styles/_variables.scss` — SCSS variables
- `styles/index.scss` — Main stylesheet
- `styles/timeline-editor-page.css` — Timeline-specific styles

---

## 22. CONCLUSION

The historical repository represents a **mature, complex AI generation platform** with:

- **20+ specialized studios** for different content types
- **Sophisticated UX flows** with personalization, GTM enhancement, and history tracking
- **Rich control systems** with dynamic model-specific inputs
- **Template engine** with cinematic intelligence
- **Advanced timeline editor** with drag-drop, keyframes, transitions, AI features
- **Thumbnail generation system** with 5-step workflow and conversational refinement
- **Extensive static assets** and demo content

The codebase is **production-ready but technically heterogeneous**, mixing vanilla JS, React, and inline HTML strings. The primary migration challenges will be:
1. Consolidating state management patterns
2. Porting large vanilla components to React
3. Migrating localStorage persistence to backend
4. Preserving the extensive UX flows and empty/loading states
5. Maintaining the design system consistency

---

*Audit completed. Report generated from baseline commit afad812a22d9f6f470222a99136b7cd651f61a89.*
