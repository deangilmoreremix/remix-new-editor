# Recovery Audit: Legacy Studio Model Pickers (Task 1)

## Goal
Ensure every studio that requires **category-aware** model selection uses the
upstream rich selector (Image/Video), and that simpler selectors are preserved
(not over-engineered into the catalog picker — YAGNI, Global Constraint #4).

Already migrated upstream (completed prior): `ImageStudio`, `VideoStudio`,
`CinemaStudio`.

## Method
1. `grep -rn "mountModelSelector(" src/components/` → 12 call sites in 12 files.
2. Read each call site's config (`models`, `categories`, `selectedCategory`,
   `onSelect*`, `loadingMessage`, async loading) and the model-array source.
3. Check whether each passes `categories:` (multi-category) → requires category-aware picker.

## Results

| Studio file | Models source | Multi-category? | Custom extensions | Disposition |
|---|---|---|---|---|
| AudioStudio.js | `audioModels` (lib/models.js:8998) | no (single list) | `onSelectProvider`, `onSearch`, `refreshModelSelector` | **KEEP** — audio domain; image/video catalog pickers do not fit |
| StoryboardStudio.js | `storyboardModels = t2iModels` | no (single list, t2i) | `getExtendedModel`, `getModelById`/`getI2IModelById`/`getI2VModelById`/`getV2VModelById` | **KEEP** — single-list (t2i); forcing catalog would change model set (behavior change) |
| VideoToolsStudio.js | `videoToolsModels` (lib/models.js:9386) | no (single list) | `buildDynamicControls`, `updateFormVisibility` | **KEEP** — simple list; not category-aware |
| CinemaTemplateStudio.js | dynamic `getEnrichedModels(modelType)` | no (single dynamic list) | `loadingMessage`, `withTimeout(5s)`, `renderModelPanel`, async catalog load | **KEEP** — already a richer custom/dynamic picker; legacy `mountModelSelector` is just the render target |
| UpscaleStudio.js | `UPSCALE_METHODS` | no | — | **KEEP** — not AI models at all; it is a fixed upscale-method dropdown misusing the picker UI |
| modals/ModelSelectorDropdown.jsx | `this.models` (generic prop) | no | generic `onSelect`, `_positionPopover` | **KEEP** — generic shared primitive; studio-specific rich pickers are not its job |
| CommercialStudio.js | `COMMERCIAL_MODELS` (inline array) | no (single list) | — | **KEEP** — simple single-list custom array (plan: do not force to catalog picker) |
| CharacterStudio.js | `CHARACTER_MODELS` (inline array) | no (single list) | `buildDynamicControls` | **KEEP** — simple single-list custom array |
| AvatarStudio.js | `avatarModels` (lib/models.js:9123) | no (single list) | `buildDynamicControls`, `updateFormVisibility` | **KEEP** — simple single-list custom array |
| TemplateStudio.js | dynamic `getEnrichedModels` | no (single dynamic list) | `loadingMessage`, `withTimeout`, `renderModelPanel`, async catalog load | **KEEP** — already richer custom/dynamic picker |
| LipSyncStudio.js | `imageLipSyncModels` / `videoLipSyncModels` | **yes** ({image},{video} via `inputMode`) | `getCurrentModels`, resolution selection, prompt textarea (`model.hasPrompt`) | **KEEP** — already category-aware with a custom UI; shared rich picker does NOT support its resolution/prompt extensions, so migrating would regress behavior (YAGNI — preserve) |
| InfluencerStudio.js | `i2iModels` (lib/models.js:2806) | no (single list) | — | **KEEP** — simple single-list (i2i) |

## Conclusion
**No additional migrations are warranted.** Only `LipSyncStudio` is genuinely
category-aware, and it already has a custom category-aware UI whose extensions
(image/video resolution + conditional prompt textarea) are not supported by the
shared Image/Video rich pickers — migrating it would be a regression, not parity.

The remaining 12 sites are: single-list custom arrays (Commercial, Character,
Avatar, VideoTools, Influencer, Storyboard, Audio); a non-AI methods dropdown
(Upscale); a generic shared primitive (ModelSelectorDropdown.jsx); or
already-custom richer/dynamic pickers (CinemaTemplateStudio, TemplateStudio,
LipSync). All correctly "preserved simpler selectors" per the plan.

`mountModelSelector` (legacy flat mount) is therefore **NOT dead code** — it is
still used by 12 legitimate sites — so it is retained in
`src/lib/modelSelectorUI.js`. The richer `mountImageModelSelector` /
`mountVideoModelSelector` / `mountTemplateModelSelector` remain the canonical
pickers for Image/Video/Cinema and any future studio needing category-aware
catalog selection.

## Tests
No code changed in this task. Verification deferred to Task 6 (full build/lint/unit gate). Confirmed via grep: 12 legacy call sites remain, 0 forced to catalog picker (no new code).
