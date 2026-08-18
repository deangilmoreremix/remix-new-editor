# Multi-Repo Enhancement Plan

**Status:** Planned — implementation pending  
**Scope:** Additive enhancements across 17 repos; existing designs, features, and functions are preserved.  
**Exclusions (explicitly not in scope):**
- `2 MCP servers + ComfyUI nodes → backend Agent Mode tool surface (ComfyUI kept as reference only)`
- `+ MuAPI 20%‑off offer for LLM routing`

## 0. Integration Spine Confirmation

All 17 repos share one backend already in use: **MuAPI** (`https://api.muapi.ai`, `x-api-key`, async `POST → request_id → poll`).

Current client chain:
```
src/lib/models.js (auto-generated from models_dump.json)
  → dynamic control engine (modelInputExtensions.js)
  → lib/muapi.js
  → supabase/functions/muapi-proxy
  → MuAPI
```

The dynamic control engine auto-renders controls from each model's `inputs` schema, so adding a model is primarily a **data-entry exercise** — no new UI chrome is required for basic model support.

## 1. Phase 0 — Critical: Extend muapi-proxy

**Why first:** New model families use slug shapes and multimodal reference payloads the current proxy does not route correctly.

| Gap | Current | Required |
|-----|---------|----------|
| Slug routing | Client uses `/api/v1/generate` | SDKs use `/api/v1/{slug}`; proxy must normalize both shapes |
| Multimodal refs | Single `image_url` | `reference_images`, `reference_videos`, `reference_audios` arrays; `last_image_url`; `sheet_url` |

### Tasks
- [ ] T0.1 Update `supabase/functions/muapi-proxy/index.ts` to accept both `/generate` and `/{slug}` request shapes.
- [ ] T0.2 Add payload normalization for multimodal references: arrays + `last_image_url` + `sheet_url`.
- [ ] T0.3 Update `lib/muapi.js` submit/poll helpers to pass through normalized fields unchanged.
- [ ] T0.4 Add proxy integration tests for each new slug shape and multimodal payload.

## 2. Phase 1 — Model Catalog Expansion

**Source:** 6 model SDK repos captured exact payloads.

### New families to add to `models_dump.json`
| Family | Example slugs | Notes |
|--------|--------------|-------|
| MiniMax H3 | `minimax-h3-*` | New endpoint family |
| Wan 3.0 | `wan-3.0-*` | Native audio support |
| FLUX 3 | `flux-3-*` | Image + video + audio; Dev/flagship variants |
| Grok Imagine 2 | `grok-imagine-image-2` | ≤5 reference edit |
| Seedance 2.5 | `seedance-2.5-*` | 72 endpoint combos; character consistency; first/last frame; omni-reference |

### Tasks
- [ ] T1.1 Add all new slugs to `models_dump.json` with correct `inputs` schemas.
- [ ] T1.2 Deduplicate duplicated `flux-3-*` slugs.
- [ ] T1.3 Regenerate `src/lib/models.js` from updated `models_dump.json`.
- [ ] T1.4 Verify the dynamic control engine renders correct controls for each new family's `inputs`.

## 3. Phase 2 — Prompt Gallery

**Sources:** 3 prompt/awesome repos.

### Components
- MiniMax prompt catalog (21 prompts)
- Seedance prompt catalog (30 prompts)
- FLUX prompt catalog (14 prompts)
- Unified camera/lighting vocabulary dropdown
- Structured prompt builder (tied to model `inputs`)

### Tasks
- [ ] T2.1 Create `src/lib/promptCatalogs.js` importing and normalizing all three catalogs.
- [ ] T2.2 Add camera/lighting vocabulary to `src/lib/promptVocabulary.js` (dropdown data).
- [ ] T2.3 Build `src/components/modals/PromptGalleryModal.jsx`:
  - Catalog browser with search/filter
  - One-click prompt injection into active studio
  - Camera/lighting dropdown wired to prompt builder
- [ ] T2.4 Wire Prompt Gallery button into all 16 studio headers.
- [ ] T2.5 Persist user favorites to `localStorage`.

## 4. Phase 3 — Intelligent Model Picker

**Sources:** 2 comparison repos with price/speed/quality data for ~40 models.

### Tasks
- [ ] T3.1 Create `src/lib/modelComparisonData.js` with price/speed/quality per model.
- [ ] T3.2 Build `src/components/modals/ModelPickerModal.jsx`:
  - Sort/filter by cost, speed, quality
  - Side-by-side comparison view
  - "Recommended for…" labels derived from model metadata
- [ ] T3.3 Replace every studio's static model `<select>` with the Model Picker dropdown.
- [ ] T3.4 Add model-switch cost warning when a higher-cost model is selected.

## 5. Phase 4 — Recipe Engine

**Sources:** Generative-Media-Skills (70+ skills) + 13 `.opencode` MuAPI recipes.

### Tasks
- [ ] T4.1 Create `src/lib/recipeEngine.js` with recipe registry (id, name, steps, expected payloads).
- [ ] T4.2 Build `src/components/modals/RecipeModal.jsx`:
  - Recipe browser grouped by category
  - "Run Recipe" button chains steps through `muapi.js`
  - Progress indicator for multi-step recipes
- [ ] T4.3 Add Recipe button to studio headers.
- [ ] T4.4 Add user recipe recording (save current session steps as custom recipe).

## 6. Phase 5 — Monetization Hub

**Source:** ai-creator-academy (15-track monetization curriculum + pricing/outreach/contract templates).

### Tasks
- [ ] T5.1 Create `src/lib/monetizationCurriculum.js` with 15 tracks and lesson data.
- [ ] T5.2 Create `src/lib/businessTemplates.js` with pricing/outreach/contract templates.
- [ ] T5.3 Build `src/components/modals/MonetizationHubModal.jsx`:
  - Track selector with progress
  - Template library with copy/download
  - In-app calculator for pricing suggested by curriculum
- [ ] T5.4 Add Monetization Hub launcher to Sidebar and landing page.

## 7. Phase 6 — Character Consistency

**Sources:** Existing Flux PuLID and Subject Reference models + new Seedance 2.5 character consistency + omni-reference.

### Tasks
- [ ] T6.1 Extend `CharacterStudio.js` to support:
  - Seedance 2.5 character consistency mode
  - Omni-reference sheet upload (`sheet_url`)
  - First-frame / last-frame locking for video generation
- [ ] T6.2 Add character-lock toggle to Video Studio and Cinema Studio.
- [ ] T6.3 Persist character references per project in IndexedDB.

## 8. Phase 7 — Native-Audio Toggle

**Sources:** Wan 3.0 native audio, FLUX 3 audio, Grok Imagine audio.

### Tasks
- [ ] T7.1 Add `native_audio: true/false` flag to `modelInputExtensions.js` for audio-capable models.
- [ ] T7.2 Render audio toggle control in Video Studio and Audio Studio when model supports native audio.
- [ ] T7.3 Pass `native_audio` flag through `muapi.js` submit payload.
- [ ] T7.4 Update `models_dump.json` entries for Wan 3.0, FLUX 3, Grok Imagine 2 with `native_audio: true`.

## 9. Studio Integration Matrix

| Studio | Prompt Gallery | Model Picker | Recipes | Char. Consistency | Native Audio |
|--------|---------------|--------------|---------|-------------------|--------------|
| Image Studio | ✅ | ✅ | ✅ | ✅ | — |
| Video Studio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cinema Studio | ✅ | ✅ | ✅ | ✅ | — |
| Effects Studio | ✅ | ✅ | ✅ | — | — |
| Edit Studio | ✅ | ✅ | ✅ | — | — |
| Upscale Suite | — | ✅ | ✅ | — | — |
| Character Studio | ✅ | ✅ | ✅ | ✅ | — |
| Influencer Studio | ✅ | ✅ | ✅ | — | — |
| Commercial Studio | ✅ | ✅ | ✅ | — | — |
| Audio Studio | — | ✅ | ✅ | — | ✅ |
| Avatar Studio | ✅ | ✅ | ✅ | — | ✅ |
| Training Studio | — | ✅ | ✅ | — | — |
| Video Tools Studio | ✅ | ✅ | ✅ | — | ✅ |
| Chat Studio | ✅ | ✅ | ✅ | — | — |
| Lip Sync Studio | ✅ | ✅ | ✅ | — | ✅ |
| Storyboard Studio | ✅ | ✅ | ✅ | — | — |
| Template Studio | ✅ | ✅ | ✅ | — | — |
| Cinema Template Studio | ✅ | ✅ | ✅ | — | — |

## 10. Acceptance Criteria

1. All new models render correct controls via the dynamic control engine without per-model UI code.
2. `models_dump.json` contains all new families with deduplicated slugs; `src/lib/models.js` regenerates cleanly.
3. Prompt Gallery is accessible from every studio and injects prompts without losing existing form state.
4. Model Picker replaces all static model selects and surfaces price/speed/quality data.
5. Recipe engine runs at least one multi-step recipe end-to-end through `muapi-proxy`.
6. Monetization Hub loads curriculum and templates; templates copy/download.
7. Character consistency works for both image and video modes with Seedance 2.5 + omni-reference.
8. Native-audio toggle appears only for models with `native_audio: true` and passes the flag to MuAPI.
9. No existing studio behavior is altered; all enhancements are additive (new modals, new buttons, new options).
10. Excluded items (MCP/ComfyUI Agent Mode, MuAPI 20% off LLM routing) have no code paths, UI entries, or configuration references added.
