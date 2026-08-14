# Model Selector Redesign Plan

## Goal
Redesign the current image/video model selector to match the **Open Generative AI** reference design (`https://github.com/Anil-matcha/Open-Generative-AI`), using the muapi model catalog instead of OpenAI models, and add the new split-pane provider sidebar.

---

## Current State

### Files
- `src/lib/modelSelectorUI.js` — shared HTML-string helpers (`renderProviderSidebar`, `renderSearchBar`, `renderModelList`, `getModelLogoHtml`)
- `src/components/ImageStudio.js` — inline dropdown rendering with string concatenation + `innerHTML`
- `src/components/VideoStudio.js` — same pattern as ImageStudio
- `src/components/TemplateStudio.js`, `CinemaStudio.js`, `LipSyncStudio.js`, `StoryboardStudio.js` — also use the shared helpers

### Current UI
- Dropdown anchored above the prompt bar
- Provider sidebar rendered as HTML string injected into `[data-provider-sidebar]`
- Model list rendered as HTML string injected into `[data-model-list]`
- Search bar rendered as HTML string
- Selected checkmark: `#d9ff00` (yellow-green), stroke-width 4
- Provider badges: same color map as reference
- Logos: same CDN URLs (`cdn.muapi.ai/models/{provider}.png`)
- Inversion list: `openai`, `blackforest`, `runway`, `ideogram`, `lightricks`, `grok`

### What works
- Provider filtering via sidebar
- Real-time search by model name/ID
- Provider logo display with fallback text badges
- Dynamic provider discovery from model list

---

## Reference Design (Open Generative AI)

### Source files
- `packages/studio/src/components/ImageStudio.jsx` — `ModelDropdown` inline component
- `packages/studio/src/components/VideoStudio.jsx` — `ModelDropdown` inline component
- `packages/studio/src/components/prompt/PromptComposer.jsx` — `PromptPopover` styling

### Key design decisions
1. **Split-pane popover**: 56px left sidebar (`w-14`) + flexible right pane
2. **Provider tabs**: `w-8 h-8 rounded-full` circular buttons with logos or 2-letter badges
3. **Selected state**: `scale-105`, colored border, tinted background, `shadow-md`
4. **Search bar**: full-width, `bg-white/5 rounded-xl`, placeholder "Search models..."
5. **Model rows**: `p-3 hover:bg-white/5 rounded-lg`, logo + name + provider label + cyan checkmark
6. **Checkmark**: `#22d3ee` (cyan), stroke-width 4
7. **Active scroll**: `scrollIntoView({ block: "nearest" })` on open
8. **Provider pre-select**: sidebar auto-selects current model's provider on open
9. **VideoStudio extras**: "Video models" header + "Video Tools" section with orange separator
10. **No standalone component**: `ModelDropdown` is inlined in each studio as a function component

---

## Proposed Changes

### 1. Extract `ModelDropdown` into a shared component
**New file**: `src/components/model-selector/ModelDropdown.jsx`

- Convert the current string-based HTML generation into a proper DOM-based component
- Keep it vanilla JS (not React) to match the rest of the codebase
- Export: `openModelDropdown(anchorBtn, { models, selectedModel, onSelect, mode })`
- The component creates its own DOM elements and appends them to a popover container

### 2. Update `modelSelectorUI.js`
**Changes**:
- Keep `PROVIDER_LOGOS`, `invertLogos`, `getProviderStyle`, `getAvailableProviders`, `filterModels` as-is
- Deprecate `renderProviderSidebar`, `renderSearchBar`, `renderModelList` — move their logic into `ModelDropdown.jsx`
- Keep `getModelLogoHtml` for the small trigger-button icon in the prompt bar

### 3. Rewire `ImageStudio.js`
**Changes**:
- Replace the inline `showDropdown('model', ...)` string-template logic with a call to `openModelDropdown(modelBtn, { models: currentModels, selectedModel, onSelect, mode: imageMode ? 'i2i' : 't2i' })`
- Keep the existing AR, duration, quality, resolution dropdowns as-is
- Update the checkmark color from `#d9ff00` to `#22d3ee` (cyan) to match reference
- Add `scrollIntoView` behavior when opening the dropdown

### 4. Rewire `VideoStudio.js`
**Changes**:
- Same as ImageStudio, but pass `mode: 't2v' | 'i2v' | 'v2v'`
- Ensure v2v models appear in a separate "Video Tools" section with orange header
- Update checkmark color to `#22d3ee`

### 5. Update remaining studios
**Studios to update**: `TemplateStudio.js`, `CinemaStudio.js`, `LipSyncStudio.js`, `StoryboardStudio.js`
- Replace calls to `renderProviderSidebar` / `renderSearchBar` / `renderModelList` with `openModelDropdown`
- Ensure they pass the correct model list for their domain

### 6. Switch thumbnail studio to muapi models
**Current**: `StudioThumbnailPanel.jsx` uses OpenAI models (`gpt-image-2`, `gpt-image-1.5`, etc.)
**Proposed**: Use the muapi image model catalog
- Replace `this.model` default from `gpt-image-2` to the first muapi image model
- Update `openaiConfig.defaultConfig.thumbnailModel` to point to a muapi image model ID
- Ensure the thumbnail modal's model selector (`#thumb-model`) uses the muapi catalog
- The thumbnail service (`ThumbnailService.js`) already supports any model ID via the `model` field in `generateCandidates`

### 7. Visual polish
- Update checkmark color across all studios from `#d9ff00` → `#22d3ee`
- Ensure provider sidebar uses the same `w-14` width and circular `w-8 h-8` buttons
- Ensure selected provider has `scale-105`, `shadow-md`, and colored border
- Add `scrollIntoView` for the selected model on dropdown open
- Ensure "All Providers" star icon uses yellow-400 when selected

---

## Files to modify

| File | Action |
|------|--------|
| `src/lib/modelSelectorUI.js` | Deprecate HTML-string renderers, keep utilities |
| `src/components/model-selector/ModelDropdown.jsx` | **Create** — new shared split-pane dropdown |
| `src/components/ImageStudio.js` | Rewire model dropdown to use `ModelDropdown` |
| `src/components/VideoStudio.js` | Rewire model dropdown to use `ModelDropdown` |
| `src/components/TemplateStudio.js` | Rewire model dropdown |
| `src/components/CinemaStudio.js` | Rewire model dropdown |
| `src/components/LipSyncStudio.js` | Rewire model dropdown |
| `src/components/StoryboardStudio.js` | Rewire model dropdown |
| `src/components/modals/StudioThumbnailPanel.jsx` | Switch to muapi image models |
| `src/lib/config/openaiConfig.js` | Update `thumbnailModel` default to muapi model |
| `src/components/modals/TemplateThumbnailModal.jsx` | Switch to muapi models if needed |

---

## What stays the same

- The bottom prompt bar layout (model button, AR button, duration, quality, generate button)
- The upload picker and multi-image logic
- The advanced options panels
- The GTM Boost button
- The thumbnail studio step flow and button gating (already fixed)
- The `ThumbnailService` API wiring (it already accepts any model ID)

---

## Risks / Open questions

1. **React vs vanilla JS**: The reference repo uses React + Tailwind. Our repo uses vanilla JS with string HTML. We will port the *design* without adopting React.
2. **Model catalog sync**: The reference repo has ~400 models in `models.js`. Our repo has its own `models.js`. We need to ensure our muapi catalog includes all the providers/logos that the UI expects.
3. **Thumbnail studio model compatibility**: Not all muapi image models support the same parameters (size, quality, etc.). We need to verify that the thumbnail service edge function handles muapi model IDs correctly.
4. **Checkmark color change**: `#d9ff00` → `#22d3ee` is a visible change. Need to confirm this is acceptable.

---

## Approval needed

Please confirm:
1. Approve the overall approach (port design to vanilla JS, keep existing architecture)
2. Approve the checkmark color change from yellow-green to cyan
3. Approve switching the thumbnail studio to muapi image models
4. Any studios to exclude from the rewrite?
5. Priority order: all at once, or phased (Image/Video first, then others)?
