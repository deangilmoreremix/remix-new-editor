# Multi-Repo Enhancement — Step-by-Step Completion Plan (Updated)

**Status:** In progress (worktree `alive-barn`). Phases 0–7 are largely scaffolded; phases 4–7 still need verification + wiring fixes before commit.
**Source plan:** `plans/MULTI_REPO_ENHANCEMENT_PLAN.md`
**Goal:** Additive enhancements across 17 studios — no existing studio behavior may change.
**Hard constraint:** Do NOT change the current split-pane design of the model picker. Phase 3 must *enhance* it, not replace it.

---

## Current State (verified 2026-08-17)

| Phase | Status | Files present | Remaining |
|-------|--------|---------------|-----------|
| 0 — muapi-proxy | ✅ Done | `supabase/functions/muapi-proxy/index.ts` (slug regex, multimodal refs) | None |
| 1 — Model Catalog | ✅ Done | `models_dump.json`, `src/lib/models.js` (new families, `native_audio`/`character_consistency` schemas) | None |
| 2 — Prompt Gallery | ✅ Done | `src/lib/promptCatalogs.js`, `src/lib/promptVocabulary.js`, `src/components/modals/PromptGalleryModal.jsx`, `src/lib/promptGalleryIntegration.js`, button in 15 studios | Verify injection works |
| 3 — Model Picker | ✅ Done | `src/lib/modelComparisonData.js`, `src/components/modals/ModelPickerModal.jsx`, `src/lib/modelPickerIntegration.js`, "AI Pick" button in 9 studios; `TemplateStudio` reverted to original `<select>` | None |
| 4 — Recipe Engine | ⚠️ Partial | `src/lib/recipeEngine.js`, `src/components/modals/RecipeModal.jsx`, `src/lib/recipeIntegration.js`, button in 15 studios | Fix `_runRecipe` to call correct `muapi` method per step type |
| 5 — Monetization Hub | ⚠️ Partial | `src/lib/monetizationCurriculum.js`, `src/lib/businessTemplates.js`, `src/components/modals/MonetizationHubModal.jsx`, `src/lib/monetizationIntegration.js`, button in 15 studios | Sidebar/landing launcher; verify copy |
| 6 — Character Consistency | ⚠️ Partial | `src/lib/characterConsistency.js` (IndexedDB), `CharacterStudio.js` UI (omni-ref, first/last frame, toggle) | Wire refs into generation params; add toggle to VideoStudio + CinemaStudio |
| 7 — Native-Audio Toggle | ⚠️ Partial | `muapi.js` passthrough (5 methods), toggles in Video/Audio/Avatar/VideoTools/LipSync studios | Fix double `;;`, make conditional on `model.inputs?.native_audio`, verify params pass |

**Excluded (must remain absent):** MCP/ComfyUI Agent Mode, MuAPI 20% off LLM routing. Verify no code paths/UI/config reference these.

---

## Step-by-Step Completion

### Step 1 — Fix Recipe Engine `_runRecipe` — HIGH
**File:** `src/components/modals/RecipeModal.jsx` (~line 95)
- Current code always calls `muapi.generateImage(payload)` regardless of `step.type`.
- Map each step type to the correct method:
  - `image` → `muapi.generateImage`
  - `i2i` → `muapi.generateI2I`
  - `t2v` → `muapi.generateVideo`
  - `i2v` → `muapi.generateI2V`
  - `audio` → `muapi.generateAudio`
  - `avatar` → `muapi.generateAvatar`
  - `video-tool` → `muapi.processVideoTool`
  - `lipsync` → `muapi.processLipSync`
- Pass `step.model` as `model` param and use `step.prompt` template substitution (`{{previous}}`, `{{prompt}}`).
- **Commit:** `fix(recipes): route each step to correct muapi method`

### Step 2 — Verify Recipe/Monetization launcher buttons — MEDIUM
**Files:** 15 studio files (Image, Video, Cinema, Edit, Effects, Character, Influencer, Commercial, Avatar, Audio, VideoTools, LipSync, Storyboard, Template, CinemaTemplate)
- Confirm `openRecipeModal` and `openMonetizationHub` import lines exist and buttons append correctly.
- Confirm `RecipeModal` and `MonetizationHubModal` import cleanly (JSX parse via Vite build).
- **Commit:** (group with Step 1 if same review pass) `feat(recipes+monetization): wire launchers into studios`

### Step 3 — Fix Native-Audio toggle bugs — HIGH
**Files:** `src/components/AudioStudio.js`, `AvatarStudio.js`, `VideoToolsStudio.js` (and verify LipSyncStudio, VideoStudio)
1. Remove the double semicolon: `if (nativeAudio) params.native_audio = nativeAudio;;` → `;`
2. Make the toggle **conditional** on `selectedModel.inputs?.native_audio` (or the model's `MODEL_COMPARISON`/schema). If unsupported, hide the toggle row.
3. Verify each studio actually passes `native_audio` into the `params` object before the `muapi.*` call.
4. **Commit:** `fix(native-audio): conditional toggle + cleanup double semicolon`

### Step 4 — Wire Character Consistency into generation — HIGH
**File:** `src/components/CharacterStudio.js`
- Capture `omniUrl`, `firstFrameUrl`, `lastFrameUrl`, `characterConsistency` into the generation `params` when the user clicks Generate.
- When `characterConsistency` is on and model is Seedance 2.5, pass `character_consistency: true` + `reference_images: [omniUrl]` / first/last frame URLs.
- Persist references via `saveCharacterReference` (already imported).
- **Commit:** `feat(character): wire omni-reference + frames into generation params`

### Step 5 — Add Character-Consistency toggle to Video + Cinema — MEDIUM
**Files:** `src/components/VideoStudio.js`, `src/components/CinemaStudio.js`
- Add a "Character Lock" toggle in the controls area.
- When on, store the last generated character reference (image URL) and reuse it as `reference_images` / `reference_videos` on subsequent generations.
- Reuse `src/lib/characterConsistency.js` for persistence keyed by project/session.
- **Commit:** `feat(character): lock toggle in Video + Cinema studios`

### Step 6 — Monetization Hub launcher (Sidebar/Landing) — LOW
**Files:** `src/components/landing/Sidebar.js` (or equivalent), `src/components/landing/LandingPage.jsx`
- Add a "💼 Monetize" entry that calls `openMonetizationHub()`.
- Confirm copy-to-clipboard works for templates (`data-action="copy-template"`).
- **Commit:** `feat(monetization): sidebar + landing launcher`

### Step 7 — Final verification & production readiness — HIGH
1. Syntax check all new/changed JS/JSX files (`node --check` where possible; Vite build for JSX).
2. Confirm `models.js` is valid (no duplicate `flux-3-*` slugs collide).
3. Confirm dynamic control engine renders new model families without per-model UI code.
4. Grep for excluded items: `mcp`, `comfyui`, `agent mode`, `20% off`, `llm routing` — must return only pre-existing unrelated references (e.g. landing `mcp-cli` label), none added by this work.
5. Confirm no existing studio behavior changed (diff review).
6. **Commit:** `chore: final verification of multi-repo enhancement phases 0–7`

---

## Acceptance Criteria (from source plan)
1. All new models render correct controls via dynamic control engine — no per-model UI code.
2. `models_dump.json` contains all new families with deduplicated slugs; `models.js` regenerates cleanly.
3. Prompt Gallery accessible from every studio; injects without losing form state.
4. Model Picker enhances (does NOT replace) split-pane selector; surfaces price/speed/quality.
5. Recipe engine runs ≥1 multi-step recipe end-to-end through `muapi-proxy`.
6. Monetization Hub loads curriculum + templates; templates copy/download.
7. Character consistency works for image + video (Seedance 2.5 + omni-reference).
8. Native-audio toggle appears ONLY for `native_audio: true` models and passes the flag.
9. No existing studio behavior altered — all enhancements additive.
10. Excluded items (MCP/ComfyUI Agent Mode, MuAPI 20% off LLM routing) have no code paths/UI/config.

## How to commit
- One commit per step above, with the suggested message.
- Keep `models_dump.json` + `models.js` changes grouped.
- Do NOT mix Phase file creation with wiring commits — create first, wire next, so review is clean.
- Run a build (`npm run build` or Vite) after Steps 1, 3, 4, 5 before committing.
