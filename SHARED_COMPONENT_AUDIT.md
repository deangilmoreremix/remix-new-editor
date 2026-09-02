# SHARED_COMPONENT_AUDIT.md
**Sub-Agent 21: SHARED COMPONENT SPECIALIST**
**Date:** 2026-08-11
**Working Directory:** `/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery`

---

## 1. EXECUTIVE SUMMARY

The current codebase has **no centralized shared controls library** for AI generation studios. Each studio (`ImageStudio.js`, `VideoStudio.js`, etc.) implements its own inline dropdowns, sliders, buttons, and panels using closure-scoped helper functions like `createControlBtn()` and `createDropdown()`. A rich shared component library (`modelSelectorUI.js`) existed in the historical baseline (`afad812a`) but was **removed** across most studios during a simplification refactor, degrading UX consistency and provider-aware model selection.

The `packages/layout/`, `packages/navigation/`, and `packages/tokens/` directories exist but contain **only app-shell layout wrappers and CSS tokens** — no generation controls, selectors, sliders, or media components.

---

## 2. CURRENT SHARED COMPONENT INVENTORY

### 2.1 Existing Shared Components (Should Be ENHANCED)

| Component | File | Type | Studios Using | Status |
|-----------|------|------|---------------|--------|
| `createUploadPicker` | `src/components/UploadPicker.js` | Factory function | Image, Video, Cinema, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Influencer, Effects, Storyboard, Template, EditorPage | ✅ Functional — needs video support standardization and error state improvements |
| `createMediaPreview` | `src/components/MediaPreview.js` | Factory function | Effects, EditorPage | ✅ Functional — needs before/after comparison mode, better error states |
| `createFullscreenPreview` | `src/components/MediaPreview.js` | Factory function | Storyboard, Effects, EditorPage | ✅ Functional — needs standardized close behavior |
| `BaseModal.jsx` | `src/components/modals/BaseModal.jsx` | React component | All modal-based features | ✅ Functional — needs size variants, header tabs, permission gating |
| `StudioThumbnailModal.jsx` | `src/components/modals/StudioThumbnailModal.jsx` | React component | Image, Video, Cinema, Effects, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Influencer | ✅ Functional |
| `StudioThumbnailPanel.jsx` | `src/components/modals/StudioThumbnailPanel.jsx` | React component | Thumbnail generation | ✅ Functional |
| `GTMPromptModal.jsx` | `src/components/modals/GTMPromptModal.jsx` | React component | Image, Video, Cinema, Character, Commercial, Audio, Avatar, VideoTools, Influencer | ✅ Functional |
| `PersonalizeModal.jsx` | `src/components/modals/PersonalizeModal.jsx` | React component | Image, Video, Character, Commercial, Audio, Avatar, VideoTools, Influencer | ✅ Functional |
| `mountStudioChrome` | `src/lib/studioChrome.js` | Vanilla JS function | All studios | ✅ Functional |
| `mountStudioDrawer` | `src/lib/studioChrome.js` | Vanilla JS function | All studios | ✅ Functional |
| `BaseComponent.js` | `src/components/base/Component.js` | Base class | Component authors | ✅ Functional |
| `Store.js` | `src/stores/base/Store.js` | Pub/sub store | Storyboard, some modals | ✅ Functional |
| `createControlBtn` | Inline in ImageStudio, VideoStudio, StoryboardStudio | Local factory | Image, Video, Storyboard | ⚠️ Duplicated — should be shared |
| `createDropdown` | Inline in CinemaStudio, Header.js | Local factory | Cinema, Header | ⚠️ Duplicated — should be shared |

### 2.2 Missing Shared Components (Should Be CREATED)

| Component | Type | Studios Needing | Priority |
|-----------|------|-----------------|----------|
| `ModelSelector` | Provider-aware dropdown | Image, Video, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer, Cinema, Storyboard, Edit, Upscale | 🔴 **P0 — Critical** |
| `ControlPanel` | Collapsible advanced settings container | Image, Video, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer | 🔴 **P0 — Critical** |
| `ParameterSlider` | Reusable range slider with label/value | Image, Video, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer | 🔴 **P0 — Critical** |
| `StyleSelector` | Chip/button group for style presets | Image, Cinema, Audio, Character, Commercial, Influencer | 🟠 **P1 — High** |
| `AspectRatioSelector` | Dropdown with AR preview icons | Image, Video, Storyboard, Character, Commercial, Influencer, Cinema | 🟠 **P1 — High** |
| `ResolutionSelector` | Dropdown for resolution options | Video, Audio, LipSync, Cinema | 🟠 **P1 — High** |
| `PresetSelector` | Reusable chip selector for presets | Storyboard, Character, Commercial, Audio, Influencer, Cinema | 🟠 **P1 — High** |
| `GenerationControls` | Unified generate button + state management | All 19 studios | 🟠 **P1 — High** |
| `ResultActions` | Action bar (regenerate, download, new, etc.) | Image, Video, Cinema, Edit, Upscale, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer | 🟠 **P1 — High** |
| `LoadingState` | Spinner + progress indicator | All studios (generation, upload, processing) | 🟠 **P1 — High** |
| `ProgressIndicator` | Progress bar for batch/long operations | Image, Video, Edit, Effects, Training, Render | 🟠 **P1 — High** |
| `EmptyState` | Consistent empty state with icon + message | All studios (canvas, gallery, chat, history) | 🟡 **P2 — Medium** |
| `PromptEditor` | Textarea + enhance + history | Image, Video, Cinema, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer | 🟡 **P2 — Medium** |
| `ImageUploader` / `VideoUploader` | Specialized upload components | All studios with upload needs | 🟡 **P2 — Medium** |
| `MediaGallery` | Grid/slider gallery for history/results | Image, Video, Effects, Edit, Storyboard | 🟡 **P2 — Medium** |
| `PreviewModal` / `BeforeAfter` | Comparison slider + fullscreen preview | Image, Video, Effects, Edit, Upscale, Character, Commercial, Influencer | 🟡 **P2 — Medium** |

---

## 3. COMPONENT DETAIL ANALYSIS

### 3.1 ModelSelector (Provider-Aware Dropdown)

**Historical Implementation:** `src/lib/modelSelectorUI.js` (253 lines, removed in current)
**Current State:** Inline flat search dropdowns in each studio, or button grids

**Historical Features Lost:**
- Split-pane layout: provider sidebar (icon grid) + model list + search bar
- `PROVIDER_LOGOS` map with 35+ provider logo URLs
- `getProviderStyle()` fallback for unknown providers
- `invertLogos` support for dark theme logos
- `getAvailableProviders()` discovery
- `filterModels()` by provider + search
- `renderProviderSidebar()`, `renderSearchBar()`, `renderModelList()` HTML generators

**Current Implementations:**
| Studio | Selector Type | Lines of Code | Provider Awareness |
|--------|--------------|---------------|-------------------|
| ImageStudio | Flat dropdown with search | ~60 | ❌ None |
| VideoStudio | Flat dropdown with search | ~60 | ❌ None |
| CinemaStudio | Flat dropdown | ~40 | ❌ None |
| StoryboardStudio | Flat dropdown | ~40 | ❌ None |
| EditStudio | None (hardcoded tool IDs) | 0 | ❌ None |
| ChatStudio | Button grid | ~20 | ❌ None |
| VideoToolsStudio | Button grid | ~20 | ❌ None |
| LipSyncStudio | Flat dropdown | ~30 | ❌ None |
| CharacterStudio | Flat dropdown | ~30 | ❌ None |
| CommercialStudio | Flat dropdown | ~30 | ❌ None |
| AudioStudio | Flat dropdown | ~30 | ❌ None |
| AvatarStudio | Flat dropdown | ~30 | ❌ None |
| TrainingStudio | Flat dropdown | ~30 | ❌ None |
| InfluencerStudio | Flat dropdown | ~30 | ❌ None |
| UpscaleStudio | Flat dropdown | ~30 | ❌ None |

**Studios Needing ModelSelector:** All 15 generation/studio components
**Implementation Priority:** 🔴 P0 — Critical (affects every studio, major UX regression from baseline)

---

### 3.2 ControlPanel / AdvancedSettings

**Current State:** Each studio has its own collapsible panel with unique controls
- ImageStudio: 9 style presets, negative prompt, guidance scale, steps, seed, batch count, width/height, reference strength, LoRA
- VideoStudio: negative prompt, seed
- EditStudio: None (all removed in current)
- CinemaStudio: Camera controls overlay (unique)
- ChatStudio: Temperature, max tokens
- TrainingStudio: LoRA name, trigger word, epochs
- CharacterStudio: Expression presets
- CommercialStudio: Scene presets, output format
- AudioStudio: Style selector, duration
- InfluencerStudio: Style presets, output format
- UpscaleStudio: Factor (2x/4x)
- VideoToolsStudio: None (conditional prompt only)
- AvatarStudio: Conditional prompt
- LipSyncStudio: None beyond mode toggle
- StoryboardStudio: Layout, shot presets, style, lighting, color

**Studios Needing ControlPanel:** All 15 studios
**Implementation Priority:** 🔴 P0 — Critical (consistency, maintainability)

---

### 3.3 ParameterSlider

**Current State:** No shared slider component. Studios implement inline range inputs or omit sliders entirely.

**Existing Sliders in Codebase:**
| Studio | Slider | Implementation |
|--------|--------|---------------|
| ImageStudio | Guidance scale (1-20) | Inline `<input type="range">` |
| ImageStudio | Steps (1-50) | Inline `<input type="range">` |
| ImageStudio | Batch count (1-4) | Inline `<input type="range">` |
| ImageStudio | Reference strength (0-100%) | Inline `<input type="range">` |
| ImageStudio | LoRA weight (0-4) | Inline `<input type="range">` |
| ChatStudio | Temperature (0-2) | Inline `<input type="range">` |
| Historical EditStudio | Watermark opacity (0-1) | Removed in current |

**Studios Needing ParameterSlider:** All studios with numeric parameters
**Implementation Priority:** 🔴 P0 — Critical (reduces duplication, ensures consistent UX)

---

### 3.4 StyleSelector

**Current State:** Each studio implements its own chip/button group for style presets
- ImageStudio: 9 styles (None → Cyberpunk) as button group
- AudioStudio: 7 styles (Pop, Rock, etc.) as chips
- CharacterStudio: 5 expressions as buttons
- CommercialStudio: 9 scene presets as chips
- InfluencerStudio: 20 style presets as chips
- CinemaStudio: 8 film looks as cards

**Studios Needing StyleSelector:** Image, Audio, Character, Commercial, Influencer, Cinema, Effects
**Implementation Priority:** 🟠 P1 — High

---

### 3.5 AspectRatioSelector

**Current State:** Each studio implements its own AR dropdown
- ImageStudio: Per-model ARs via `getAspectRatiosForModel()`
- VideoStudio: Per-model ARs via `getAspectRatiosForVideoModel()` with visual preview icons
- StoryboardStudio: Per-model ARs
- CinemaStudio: Hardcoded `['16:9', '21:9', '9:16', '1:1', '4:5']`

**Studios Needing AspectRatioSelector:** Image, Video, Storyboard, Character, Commercial, Influencer, Cinema
**Implementation Priority:** 🟠 P1 — High

---

### 3.6 ResolutionSelector

**Current State:** Only VideoStudio has resolution selection
- VideoStudio: Per-model resolutions (720p, 1080p, etc.)

**Studios Needing ResolutionSelector:** Video, Audio, LipSync, Cinema
**Implementation Priority:** 🟠 P1 — High

---

### 3.7 PresetSelector

**Current State:** No shared preset selector
- StoryboardStudio: 7 shot presets
- CharacterStudio: 5 expression presets
- AudioStudio: 5 style presets + duration chips
- CommercialStudio: 9 scene presets + 4 format presets
- InfluencerStudio: 20 style presets + 4 format presets

**Studios Needing PresetSelector:** Storyboard, Character, Commercial, Audio, Influencer, Cinema
**Implementation Priority:** 🟠 P1 — High

---

### 3.8 GenerationControls

**Current State:** Each studio has its own generate button with inline loading state
- Pattern: Button text changes to "Generating..." + disabled + alert on error
- No shared cancellation, no progress tracking, no retry UI

**Studios Needing GenerationControls:** All 19 studios
**Implementation Priority:** 🟠 P1 — High

---

### 3.9 ResultActions

**Current State:** Each studio has its own action buttons
- ImageStudio: Regenerate, Download, New
- VideoStudio: Regenerate, Extend, Download, Open in Render, New
- EditStudio: Download only
- EffectsStudio: Download only
- UpscaleStudio: Download only
- CharacterStudio: Download only
- CommercialStudio: Download only
- AudioStudio: Download only
- AvatarStudio: Download only
- TrainingStudio: None visible
- VideoToolsStudio: Download only
- ChatStudio: None
- LipSyncStudio: Download, Regenerate, New
- InfluencerStudio: Download, Generate Again
- CinemaStudio: None (routes to Video)
- StoryboardStudio: Download per frame

**Studios Needing ResultActions:** All studios with generation output
**Implementation Priority:** 🟠 P1 — High

---

### 3.10 LoadingState / ProgressIndicator

**Current State:** No shared loading/progress component
- UploadPicker: Spinner on trigger button
- MediaPreview: Spinner overlay
- Generate button: Text changes to "Generating..." + disabled
- VideoStudio video upload: Icon → Spinner → Ready states
- LipSyncStudio: Icon/Spinner/Ready states per upload

**Studios Needing LoadingState:** All studios
**Implementation Priority:** 🟠 P1 — High

---

### 3.11 EmptyState

**Current State:** Inline implementations scattered
- UploadPicker: "4 ways to upload" tiles
- MediaPreview: "No media loaded" with icon
- ChatStudio: "Start a conversation" with chat icon
- ElementsTab: "Add your first element to get started"
- RenderPage: `showEmptyState()` / `hideEmptyState()` functions

**Studios Needing EmptyState:** All studios
**Implementation Priority:** 🟡 P2 — Medium

---

### 3.12 PromptEditor

**Current State:** Each studio has its own textarea + optional GTM Boost button
- No shared prompt enhancement, history, or token replacement UI

**Studios Needing PromptEditor:** Image, Video, Cinema, Character, Commercial, Audio, Avatar, Training, VideoTools, Chat, LipSync, Influencer
**Implementation Priority:** 🟡 P2 — Medium

---

### 3.13 ImageUploader / VideoUploader

**Current State:** `createUploadPicker` serves both but has limitations
- `acceptVideo` parameter exists but not uniformly used
- Video upload in VideoStudio uses separate picker from image picker
- No shared "upload zone" component

**Studios Needing ImageUploader/VideoUploader:** All studios with media input
**Implementation Priority:** 🟡 P2 — Medium

---

### 3.14 MediaGallery

**Current State:** No shared gallery component
- ImageStudio: History sidebar (vertical strip)
- VideoStudio: History sidebar (vertical strip)
- EffectsStudio: Split preview panel
- StoryboardStudio: Frame cards grid

**Studios Needing MediaGallery:** Image, Video, Effects, Edit, Storyboard
**Implementation Priority:** 🟡 P2 — Medium

---

### 3.15 PreviewModal / BeforeAfter

**Current State:** No shared comparison slider or preview modal
- `createFullscreenPreview` exists but is a simple fullscreen viewer
- No before/after comparison in any studio UI

**Studios Needing PreviewModal/BeforeAfter:** Image, Video, Effects, Edit, Upscale, Character, Commercial, Influencer
**Implementation Priority:** 🟡 P2 — Medium

---

## 4. PACKAGES DIRECTORY ANALYSIS

### 4.1 `packages/layout/`

**Files:**
- `src/react/`: AppShell, Sidebar, Header, ContentArea (React)
- `src/vue/`: AppShell, Sidebar, Header, ContentArea (Vue)
- `src/vanilla/`: AppShell, Sidebar, Header, ContentArea (Vanilla JS)
- `src/core/`: TypeScript core abstractions

**Status:** Contains only **app-shell layout wrappers**. No studio-specific controls, no generation components, no media components.

**Gap:** Missing all generation UI components (ModelSelector, sliders, buttons, panels).

### 4.2 `packages/navigation/`

**Files:**
- `src/menu-config.ts`: Menu configuration
- `src/route-events.ts`: Route event handling
- `src/navigation-manager.ts`: Navigation state

**Status:** Contains only **routing/navigation logic**. No UI components for studio controls.

**Gap:** Missing studio navigation components (drawer items, breadcrumbs, studio tabs).

### 4.3 `packages/tokens/`

**Files:**
- `src/index.ts`: CSS entry point
- `src/index.css`: Main stylesheet
- `src/layout.css`: Layout styles
- `src/themes.css`: Theme definitions

**Status:** Contains **CSS custom properties and theme classes**. No component-level token system.

**Gap:** Missing component-level design tokens (button variants, input sizes, spacing scales for controls).

---

## 5. HISTORICAL MODELSELECTORUI.JS ANALYSIS

**File:** `src/lib/modelSelectorUI.js` (253 lines, baseline `afad812a`)
**Current Status:** Removed from codebase. Last referenced in commit `c7b107ff`.

**Exported API:**
```javascript
// Provider branding
PROVIDER_LOGOS          // Map of 35+ provider logo URLs
invertLogos             // Providers needing CSS invert for dark theme
getProviderStyle(provider) // Returns { text, bg } for unknown providers

// Discovery & filtering
getAvailableProviders(models)    // Extract unique providers from model list
filterModels(models, search, selectedProvider) // Filter by provider + search

// HTML generators
renderProviderSidebar(availableProviders, selectedProvider, onSelectProvider)
renderSearchBar()
renderModelList(filteredModels, selectedModel, showProviderName, onSelect)
```

**Usage in Baseline (afad812a):**
- ImageStudio: Full split-pane dropdown
- VideoStudio: Full split-pane dropdown
- ChatStudio: Full split-pane dropdown
- VideoToolsStudio: Full split-pane dropdown
- LipSyncStudio: Full split-pane dropdown
- TemplateStudio: Full split-pane dropdown

**Current Status:**
- All imports removed from studios
- Replaced with inline flat dropdowns or button grids
- Provider logos, provider filtering, and search all lost

**Impact:** Users can no longer browse/filter models by provider. Provider branding lost. Dropdown width reduced from 480px to ~320px.

---

## 6. DUPLICATED CODE AUDIT

### 6.1 `createControlBtn` (Duplicated 3x)

| Location | Lines | Signature |
|----------|-------|-----------|
| `ImageStudio.js` | 185 | `createControlBtn(icon, label, id, tooltip)` |
| `VideoStudio.js` | 334 | `createControlBtn(icon, label, id, tooltip)` |
| `StoryboardStudio.js` | 576 | `createControlBtn(icon, label, id, tooltip)` |

**Differences:**
- ImageStudio: Adds `aria-label`, `data-tooltip`, click-outside dropdown handler
- VideoStudio: Same pattern but with slightly different class names
- StoryboardStudio: Same pattern, simplified

**Recommendation:** Extract to `packages/layout/src/vanilla/ControlButton.js` or `src/components/base/ControlButton.js`.

### 6.2 `createDropdown` (Duplicated 2x)

| Location | Lines | Signature |
|----------|-------|-----------|
| `CinemaStudio.js` | 396 | `createDropdown(items, selected, onSelect, trigger)` |
| `Header.js` | 44 | `createDropdown(items, parent)` |

**Differences:**
- CinemaStudio: Full dropdown with search + scroll + click-outside
- Header.js: Simple nav dropdown

**Recommendation:** Extract to shared `Dropdown.js` component.

### 6.3 Model Selector Logic (Duplicated 15x)

Every studio reimplements model selection with slight variations:
- Flat dropdown with search (Image, Video, Cinema, Storyboard, etc.)
- Button grid (Chat, VideoTools)
- No selector (Edit, Upscale)

**Recommendation:** Extract to shared `ModelSelector.js` using historical `modelSelectorUI.js` as reference.

### 6.4 Advanced Options Panel (Duplicated 15x)

Each studio implements its own collapsible panel:
- ImageStudio: 9 controls in glass card
- VideoStudio: 2 controls in glass card
- ChatStudio: 2 controls in glass card
- TrainingStudio: 4 controls in glass card

**Recommendation:** Extract to shared `ControlPanel.js` with configurable children.

---

## 7. STUDIO COMPONENT COVERAGE MATRIX

| Component | Image | Video | Cinema | Storyboard | Effects | Edit | Upscale | Character | Commercial | Audio | Avatar | Training | VideoTools | Chat | LipSync | Influencer |
|-----------|-------|-------|--------|------------|---------|------|---------|-----------|------------|-------|--------|----------|-----------|------|---------|-----------|
| ModelSelector | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ControlPanel | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| ParameterSlider | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| StyleSelector | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| AspectRatioSelector | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ResolutionSelector | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| PresetSelector | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| GenerationControls | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ResultActions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| LoadingState | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| EmptyState | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| PromptEditor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ImageUploader | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| VideoUploader | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| MediaGallery | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PreviewModal | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| BeforeAfter | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ = Implemented (inline) | ⚠️ = Partial/inconsistent | ❌ = Missing

---

## 8. IMPLEMENTATION PRIORITY MATRIX

### 🔴 P0 — Critical (Blocking for all studios)

| Component | Rationale | Effort | Studios Impacted |
|-----------|-----------|--------|------------------|
| `ModelSelector` | Major UX regression from baseline. Every studio needs provider-aware selection. | Medium | 15 studios |
| `ControlPanel` | Eliminates 15+ duplicated collapsible panels. Required for advanced settings consistency. | Low | 15 studios |
| `ParameterSlider` | Eliminates inline slider duplication. Required for any numeric parameter. | Low | 12+ studios |

### 🟠 P1 — High (Major UX improvements)

| Component | Rationale | Effort | Studios Impacted |
|-----------|-----------|--------|------------------|
| `GenerationControls` | Unifies generate button + loading + error + cancellation across all studios. | Medium | 19 studios |
| `ResultActions` | Standardizes action bars (regenerate, download, new, etc.) across studios. | Low | 12 studios |
| `StyleSelector` | Standardizes style/chip selection UI across 7 studios. | Low | 7 studios |
| `AspectRatioSelector` | Standardizes AR selection with preview icons across 7 studios. | Low | 7 studios |
| `PresetSelector` | Standardizes preset chips across 6 studios. | Low | 6 studios |
| `ResolutionSelector` | Standardizes resolution dropdown across 4 studios. | Low | 4 studios |
| `LoadingState` | Adds consistent loading indicators to all studios. | Low | 19 studios |
| `ProgressIndicator` | Adds progress tracking for batch/long operations. | Medium | 6 studios |

### 🟡 P2 — Medium (Feature completeness)

| Component | Rationale | Effort | Studios Impacted |
|-----------|-----------|--------|------------------|
| `EmptyState` | Standardizes empty state messaging across 12+ studios. | Low | 12+ studios |
| `PromptEditor` | Unifies prompt input + enhancement + token replacement. | Medium | 12 studios |
| `ImageUploader` / `VideoUploader` | Standardizes upload UX with drag-drop, paste, URL, history. | Medium | 15+ studios |
| `MediaGallery` | Standardizes history/result gallery across 5 studios. | Medium | 5 studios |
| `PreviewModal` / `BeforeAfter` | Adds comparison slider and fullscreen preview to 8 studios. | High | 8 studios |

---

## 9. RECOMMENDED PACKAGE STRUCTURE

```
packages/
  controls/                    # NEW: Shared studio controls
    src/
      index.ts
      ModelSelector/
        ModelSelector.ts      # Provider-aware dropdown (port from modelSelectorUI.js)
        ModelSelectorButton.ts # Trigger button with provider logo
      ControlPanel/
        ControlPanel.tsx       # Collapsible advanced settings container
      ParameterSlider/
        ParameterSlider.tsx    # Range slider with label, value display, tooltip
      StyleSelector/
        StyleSelector.tsx      # Chip/button group for style presets
      AspectRatioSelector/
        AspectRatioSelector.tsx # Dropdown with AR preview icons
      ResolutionSelector/
        ResolutionSelector.tsx  # Dropdown for resolution options
      PresetSelector/
        PresetSelector.tsx     # Reusable chip selector
      GenerationControls/
        GenerationControls.tsx # Generate button + loading + error + cancel
      ResultActions/
        ResultActions.tsx      # Action bar (regenerate, download, new, etc.)
      LoadingState/
        LoadingState.tsx       # Spinner + progress indicator
        ProgressIndicator.tsx  # Progress bar for batch operations
      EmptyState/
        EmptyState.tsx         # Consistent empty state component
      PromptEditor/
        PromptEditor.tsx       # Textarea + enhance + history
      Upload/
        ImageUploader.tsx      # Specialized image upload component
        VideoUploader.tsx      # Specialized video upload component
      MediaGallery/
        MediaGallery.tsx       # Grid/slider gallery for results
      Preview/
        PreviewModal.tsx       # Fullscreen preview modal
        BeforeAfterSlider.tsx  # Comparison slider

  layout/                      # EXISTING: App shell wrappers
    src/
      ... (no changes needed)

  navigation/                  # EXISTING: Routing logic
    src/
      ... (no changes needed)

  tokens/                      # EXISTING: CSS variables + themes
    src/
      ... (needs component-level token additions)
```

---

## 10. KEY FINDINGS SUMMARY

1. **No shared generation controls library exists.** Every studio reimplements dropdowns, sliders, and buttons inline, leading to 15+ duplicated implementations of the same patterns.

2. **ModelSelector regression is the most critical gap.** The historical `modelSelectorUI.js` (253 lines) provided a professional provider-aware split-pane dropdown with logos, search, and filtering. It was removed across all studios, replaced with simpler flat dropdowns or button grids. This affects every studio with model selection.

3. **`createControlBtn` is duplicated 3 times** (ImageStudio, VideoStudio, StoryboardStudio) with near-identical implementations.

4. **`createDropdown` is duplicated 2 times** (CinemaStudio, Header.js) with different feature sets.

5. **Model selector logic is duplicated 15 times** across studios, each with slight variations (flat dropdown, button grid, or hardcoded IDs).

6. **Advanced options panels are duplicated 15 times**, each with unique controls but identical collapsible container pattern.

7. **`packages/layout/` contains only app-shell wrappers** (AppShell, Sidebar, Header, ContentArea). No generation controls, selectors, or media components exist in any package.

8. **`packages/tokens/` contains only CSS custom properties.** No component-level design tokens (button variants, input sizes, spacing scales for controls).

9. **`createUploadPicker` is the only well-shared component**, used by 15+ studios. It should be enhanced with video support standardization and error state improvements.

10. **Loading states, empty states, and error states are inconsistently implemented** — some studios have spinners, some have button text changes, some have `alert()` only. No shared components exist.

11. **No before/after comparison, no batch result gallery, no progress indicator** for long-running operations exist in any studio.

12. **EditStudio has the most severe regression** — all tool-specific controls (model selector, aspect ratio, quality, watermark params, dynamic schema controls) were removed between baseline and current, reducing the file from 649 to 262 lines (-60%).

---

*End of SHARED_COMPONENT_AUDIT.md*
*Generated by SUB-AGENT 21: SHARED COMPONENT SPECIALIST*
