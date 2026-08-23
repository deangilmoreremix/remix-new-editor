# Thumbnail Studio Modal — Split-Pane Model Selector Plan

## Goal
Redesign ONLY the thumbnail studio modal's model selector to match the **Open Generative AI** split-pane design, using the **muapi model catalog** for selection while keeping **OpenAI as the primary backend** for generation and other features.

---

## Architecture

### Model Selection: muapi catalog
- The split-pane dropdown shows **muapi models** (from `src/lib/models.js`: `t2iModels`, `i2iModels`, etc.)
- Provider logos from `cdn.muapi.ai/models/{provider}.png`
- Search + provider sidebar + checkmarks as per reference design

### Generation Backend: OpenAI Images API
- When user clicks Generate, the selected model ID is passed to the edge function
- The edge function (`ai-thumbnail-generator`) checks if the model is an OpenAI model or a muapi model
  - **OpenAI models** (`gpt-image-2`, `gpt-image-1.5`, etc.): use OpenAI SDK directly (current behavior)
  - **muapi models** (`flux-dev`, `flux-schnell`, etc.): route through the existing `muapi-proxy` edge function to `api.muapi.ai`
- This hybrid approach lets users select from the full muapi catalog while maintaining backward compatibility with OpenAI

### Other Features: OpenAI
- Refine, inpaint, prompts, save: remain on OpenAI APIs
- Responses model dropdown: keep OpenAI models (`gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`)

---

## Current State

### Files involved
- `src/components/modals/TemplateThumbnailModal.jsx` — main modal with 5-step flow
- `src/components/modals/StudioThumbnailModal.jsx` — thin wrapper that passes studio context
- `src/components/modals/StudioThumbnailPanel.jsx` — side-panel variant with its own brief form and model selector
- `src/lib/config/openaiConfig.js` — provides `thumbnailModel`, `thumbnailNCandidates`, etc.
- `src/lib/thumbnailService.js` — calls `ai-thumbnail-generator` edge function
- `src/lib/models.js` — muapi model catalog (`t2iModels`, `i2iModels`, etc.)
- `supabase/functions/ai-thumbnail-generator/index.ts` — edge function that currently uses OpenAI SDK only
- `supabase/functions/muapi-proxy/index.ts` — existing proxy for muapi API calls

---

## Proposed Changes

### 1. Create split-pane model selector
**New file**: `src/components/modals/ModelSelectorDropdown.jsx`

- Vanilla JS component (not React)
- Exports: `renderModelSelectorDropdown(anchorBtn, { models, selectedModel, onSelect })`
- Left sidebar: `w-14` (56px), circular provider buttons with logos/badges
- Right pane: search bar + scrollable model list
- Uses existing utilities from `modelSelectorUI.js`

### 2. Update `TemplateThumbnailModal.jsx`
- Replace `<select id="thumb-image-model">` with split-pane dropdown
- Populate from `src/lib/models.js` muapi catalog (image models)
- Update `this.model` when user selects a model
- Update subtitle to remove "OpenAI's image model" language

### 3. Update `StudioThumbnailPanel.jsx`
- Same replacement for `<select id="thumb-model">`
- Use muapi catalog for options

### 4. Update `openaiConfig.js`
- Change `thumbnailModel` default from `gpt-image-2` to a muapi image model (e.g., `flux-dev-image` or first in `t2iModels`)
- Update `getThumbnailOutputSettings()` to return muapi models instead of OpenAI-only list
- Add helper: `isOpenAIImageModel(modelId)` → boolean

### 5. Update edge function `ai-thumbnail-generator/index.ts`
In `handleGenerate()`:
- Detect if model is OpenAI or muapi
- **OpenAI path**: existing `openai.images.generate()` call (unchanged)
- **muapi path**: forward to `muapi-proxy` edge function with:
  - `endpoint`: normalized muapi model ID
  - `params`: prompt, size, n, etc.
  - `muapi_api_key`: user's muapi key (from request body)
  - `generationType: 'image'`
- Normalize muapi response to match OpenAI response shape (`{ candidates: [{ b64_json, revised_prompt }] }`)
- Handle user key resolution: if user provided muapi key, use it; otherwise fall back to server key or error

### 6. Update `ThumbnailService.js`
- Add muapi key resolution alongside OpenAI key
- Pass `muapi_api_key` in request body when generating with muapi models
- Keep OpenAI key passing for OpenAI models

### 7. Update subtitle text
**In `StudioThumbnailModal.renderBody()`**:
- Change: `"Generate a custom thumbnail for your ${this.studioOutputType} using OpenAI's image model..."`
- To: `"Generate a custom thumbnail for your ${this.studioOutputType} using AI..."`

---

## Files to modify

| File | Action |
|------|--------|
| `src/components/modals/ModelSelectorDropdown.jsx` | **Create** — split-pane dropdown |
| `src/components/modals/TemplateThumbnailModal.jsx` | Replace `<select>` with dropdown |
| `src/components/modals/StudioThumbnailPanel.jsx` | Replace `<select>` with dropdown |
| `src/components/modals/StudioThumbnailModal.jsx` | Update subtitle text |
| `src/lib/config/openaiConfig.js` | Switch thumbnail defaults to muapi |
| `src/lib/thumbnailService.js` | Add muapi key resolution + routing |
| `supabase/functions/ai-thumbnail-generator/index.ts` | Add muapi routing branch |

---

## What stays the same

- The 5-step flow: Brief → Generate → Refine → Text Overlay → Saved
- The step indicator
- The button gating logic (already fixed)
- The button colors (already fixed)
- OpenAI for refine, inpaint, prompts, save
- Responses model dropdown stays on OpenAI

---

## Risks

1. **Response normalization**: muapi returns different JSON than OpenAI. Edge function must normalize.
2. **Parameter mapping**: muapi models use different param names than OpenAI. Need a mapping layer.
3. **Key management**: Users need muapi keys for muapi models. Settings modal may need updating.
4. **Model compatibility**: Not all muapi models support the same parameters (size, quality, etc.).

---

## Approval

This plan is ready for implementation. The key change is adding a muapi routing branch in the edge function while keeping OpenAI as the default backend.
