# Edit Studio — Control Matrix
**Sub-Agent 8: EDIT STUDIO SPECIALIST**
**Date:** 2026-08-11
**Baseline Commit:** afad812a22d9f6f470222a99136b7cd651f61a89
**Current HEAD:** 9211eeb7 (most recent: "feat(edit-studio): restore advanced editing controls")
**Source File:** `src/components/EditStudio.js`
**Lines Baseline:** 649 | **Lines HEAD:** 262

---

## Executive Summary

Between baseline `afad812a` and current HEAD, EditStudio.js was **reduced from 649 lines to 262 lines** (-60%). The commit `9211eeb7` titled "restore advanced editing controls" paradoxically sits at HEAD but the diff shows controls were **removed**, not restored. This audit documents the full delta per tool.

**What was removed:**
- `EDIT_AI_MODELS` array (32 generic I2I models) — replaced by hardcoded tool IDs used directly as model IDs
- `showControlsForTool()` — per-tool control panel dispatcher
- `buildDynamicControls()` — schema-driven dynamic controls from `models.js`
- Static tool-specific controls: aspect ratio, quality, render speed, style, num images, watermark position/opacity/scale, target face index
- Model selector dropdown (was only shown for `seedream-5.0-edit`)
- Blob URL memory management (`currentBlobUrl`, `URL.revokeObjectURL`)
- Preview error handler (`previewImg.onerror`)
- "Edit completed, but no result image was returned" error state in result area
- `getI2IModelById` import from `models.js`
- `thumbnail_url` param key (replaced with `customThumbnailUrl`)

**What changed at tool-definition level (4 tools gained `hasPrompt: true`):**
- `ai-object-eraser`: `false` → `true` (placeholder: "What to remove...")
- `ai-image-extension`: `false` → `true` (placeholder: "What to extend with...")
- `ai-dress-change`: `false` → `true` (placeholder: "Describe the outfit...")
- `add-image-watermark`: `false` → `true` (placeholder: "Watermark text...")
- `ai-product-shot`: placeholder "Describe the scene..." → "Product style..."

---

## Global UI Structure

### Baseline (afad812a)
```
Hero Banner
├── Tool Grid (2-5 cols, 13 cards with thumbnails)
├── Inline Instructions
├── Personalize Trigger Row
└── Work Card (shown on tool select)
    ├── Tool Title
    ├── Upload Section
    │   ├── Upload Trigger + Hint + Clear Button
    │   └── Preview Image (with blob URL management + onerror handler)
    ├── Prompt Field (conditional on tool)
    ├── Controls Row (hidden by default, shown per-tool)
    │   ├── Model Selector (only for seedream-5.0-edit, 33 options)
    │   ├── Aspect Ratio Select (8 options)
    │   ├── Quality Select (Basic/High)
    │   ├── Num Images Select (1-4)
    │   ├── Render Speed Select (Turbo/Balanced/Quality)
    │   ├── Style Select (Auto/General/Realistic/Design)
    │   ├── Target Index Input (0-10)
    │   ├── Watermark Position Select (5 positions)
    │   ├── Watermark Opacity Input (0-1, step 0.1)
    │   └── Watermark Scale Input (0.1-1, step 0.1)
    ├── Dynamic Controls Container (hidden, built from model.inputs schema)
    ├── Thumbnail Button
    ├── Apply Edit Button
    └── Result Area (with no-result error state)
```

### Current HEAD
```
Hero Banner
├── Tool Grid (2-5 cols, 13 cards with thumbnails)
├── Inline Instructions
├── Personalize Trigger Row
└── Work Card (shown on tool select)
    ├── Tool Title
    ├── Upload Section
    │   ├── Upload Trigger + Hint + Clear Button
    │   └── Preview Image (no blob URL management, no onerror)
    ├── Prompt Field (conditional on tool.hasPrompt)
    ├── Thumbnail Button (with 🖼 emoji)
    ├── Apply Edit Button
    └── Result Area (no no-result error state)
```

---

## Per-Tool Control Matrix

Legend:
- ✅ Present | ❌ Missing | 🔶 Partial | ➖ Not Applicable

| Attribute | ai-object-eraser | ai-background-remover | ai-image-extension | seedream-5.0-edit | ideogram-v3-reframe | ai-dress-change | ai-skin-enhancer | ai-color-photo | add-image-watermark | ai-image-upscaler | ai-image-face-swap | ai-product-shot | ai-ghibli-style |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tool Card in Grid** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Upload Input** | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video | ✅ Image/Video |
| **Prompt Input** | ✅ Head | ❌ | ✅ Head | ✅ Head | ❌ | ✅ Head | ❌ | ❌ | ✅ Head | ❌ | ❌ | ✅ Head | ❌ |
| **Prompt Placeholder** | "What to remove..." | — | "What to extend with..." | "Describe the edit..." | — | "Describe the outfit..." | — | — | "Watermark text..." | — | — | "Product style..." | — |
| **Model Selector Dropdown** | ❌ | ❌ | ❌ | ✅ (33 models, Baseline only) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Aspect Ratio Select** | ❌ | ❌ | ❌ | ✅ (8 options, Baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Quality Select** | ❌ | ❌ | ❌ | ✅ (Basic/High, Baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Num Images Select** | ❌ | ❌ | ❌ | ❌ | ✅ (1-4, Baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Render Speed Select** | ❌ | ❌ | ❌ | ❌ | ✅ (Turbo/Balanced/Quality, Baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Style Select** | ❌ | ❌ | ❌ | ❌ | ✅ (Auto/General/Realistic/Design, Baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Target Index Input** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (0-10, Baseline) | ❌ | ❌ |
| **Watermark Position** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (5 positions, Baseline) | ❌ | ❌ | ❌ | ❌ |
| **Watermark Opacity** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (0-1, Baseline) | ❌ | ❌ | ❌ | ❌ |
| **Watermark Scale** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (0.1-1, Baseline) | ❌ | ❌ | ❌ | ❌ |
| **Dynamic Controls (schema)** | ❌ | ❌ | ❌ | ✅ (from model.inputs) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Prompt + Token Replacement** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Personalize Trigger** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Thumbnail Button** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Masks/Brush Controls** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Strength/Intensity Slider** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Feather/Blur Slider** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reference Image Input** | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) | ✅ (via UploadPicker) |
| **Reference Image Multi-Select** | 🔶 (UploadPicker supports it) | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 | 🔶 |
| **Aspect Ratio / Output Settings** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Presets** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Preview / Before-After** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Result: Image Display** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Result: Download Link** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Result: Error State (no result)** | ❌ (removed) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Blob URL Memory Mgmt** | ❌ (removed) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Preview onerror Handler** | ❌ (removed) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Detailed Tool Notes

### 1. ai-object-eraser — Remove Object
- **Current:** Upload image/video → optional text prompt ("What to remove...") → Apply Edit
- **Baseline:** Same upload + prompt flow but `hasPrompt: false` (prompt hidden by default)
- **Advanced controls:** None in either version
- **Delta:** Gained `hasPrompt: true` in HEAD; all tool-specific params still absent

### 2. ai-background-remover — Remove Background
- **Current / Baseline:** Upload only, no prompt, no additional controls
- **Delta:** Identical in both versions — fully static tool

### 3. ai-image-extension — Extend Image
- **Current:** Upload + prompt ("What to extend with...") → Apply Edit
- **Baseline:** Upload only, `hasPrompt: false` (no prompt shown)
- **Advanced controls:** None in either version
- **Delta:** Gained `hasPrompt: true` in HEAD

### 4. seedream-5.0-edit — AI Edit ⭐ (Most degraded)
- **Current:** Upload + prompt ("Describe the edit...") → Apply Edit using tool ID as model
- **Baseline:** Upload + **Model Selector** (33 options: Seedream 5.0 default + 32 EDIT_AI_MODELS) + **Dynamic Controls** (built from `getI2IModelById(modelId).inputs` schema) + prompt
- **Baseline tool-specific params:** aspect_ratio, quality
- **Advanced controls:** Dynamic schema-driven controls (enum selects, int/number ranges) from `models.js` input definitions
- **Delta:** Lost model selector, lost dynamic controls, lost aspect ratio/quality params. Model is now hardcoded to tool ID `seedream-5.0-edit`.

### 5. ideogram-v3-reframe — Reframe ⭐ (Most degraded)
- **Current:** Upload only, no prompt, no controls → Apply Edit using tool ID as model
- **Baseline:** Upload + **4 static controls:**
  - Aspect Ratio Select (1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 21:9)
  - Render Speed Select (Turbo / Balanced / Quality)
  - Style Select (Auto / General / Realistic / Design)
  - Num Images Select (1–4)
- **Baseline params sent:** `aspect_ratio`, `render_speed`, `style`, `num_images`
- **Delta:** Lost all 4 control panels entirely. No aspect ratio, speed, style, or count control remains.

### 6. ai-dress-change — Change Dress
- **Current:** Upload + prompt ("Describe the outfit...") → Apply Edit
- **Baseline:** Upload only, `hasPrompt: false` (no prompt shown)
- **Advanced controls:** None in either version
- **Delta:** Gained `hasPrompt: true` in HEAD

### 7. ai-skin-enhancer — Enhance Skin
- **Current / Baseline:** Upload only, no prompt, no additional controls
- **Delta:** Identical in both versions — fully static tool

### 8. ai-color-photo — Colorize
- **Current / Baseline:** Upload only, no prompt, no additional controls
- **Delta:** Identical in both versions — fully static tool

### 9. add-image-watermark — Add Watermark ⭐ (Degraded)
- **Current:** Upload + prompt ("Watermark text...") → Apply Edit
- **Baseline:** Upload + **3 static controls:**
  - Watermark Position Select (top-left, top-right, bottom-left, bottom-right, center)
  - Watermark Opacity Input (0–1, step 0.1, default 0.7)
  - Watermark Scale Input (0.1–1, step 0.1, default 0.2)
- **Baseline params sent:** `position`, `opacity`, `scale`
- **Delta:** Lost all watermark layout controls. Gained `hasPrompt: true` but prompt was not a baseline feature.

### 10. ai-image-upscaler — Upscale
- **Current / Baseline:** Upload only, no prompt, no additional controls
- **Delta:** Identical in both versions — fully static tool

### 11. ai-image-face-swap — Face Swap ⭐ (Degraded)
- **Current:** Upload only, no prompt, no controls → Apply Edit using tool ID as model
- **Baseline:** Upload + **1 static control:** Target Index Input (number, 0–10, default 0)
- **Baseline params sent:** `target_index`
- **Delta:** Lost target face index selector entirely

### 12. ai-product-shot — Product Shot ⭐ (Degraded)
- **Current:** Upload + prompt ("Product style...") → Apply Edit using tool ID as model
- **Baseline:** Upload + prompt ("Describe the scene...") + `hasPrompt: true` + **special param mapping** (`params.scene_description` instead of `params.prompt`)
- **Delta:** Lost `scene_description` param mapping (now sends generic `prompt`). Placeholder text changed.

### 13. ai-ghibli-style — Ghibli Style
- **Current / Baseline:** Upload only, no prompt, no additional controls
- **Delta:** Identical in both versions — fully static tool

---

## Advanced Controls Summary

| Control | Baseline | HEAD | Notes |
|---|---|---|---|
| **Model Selector Dropdown** | ✅ (33 options for AI Edit) | ❌ | Removed; tool ID used directly |
| **Dynamic Schema Controls** | ✅ (`buildDynamicControls` from `models.js` inputs) | ❌ | Removed entirely |
| **Aspect Ratio** | ✅ (8 options, for Reframe + AI Edit) | ❌ | Removed |
| **Quality** | ✅ (Basic/High, for AI Edit) | ❌ | Removed |
| **Render Speed** | ✅ (3 options, for Reframe) | ❌ | Removed |
| **Style** | ✅ (4 options, for Reframe) | ❌ | Removed |
| **Num Images** | ✅ (1-4, for Reframe) | ❌ | Removed |
| **Target Face Index** | ✅ (0-10, for Face Swap) | ❌ | Removed |
| **Watermark Position** | ✅ (5 positions) | ❌ | Removed |
| **Watermark Opacity** | ✅ (0-1 slider/input) | ❌ | Removed |
| **Watermark Scale** | ✅ (0.1-1 slider/input) | ❌ | Removed |
| **EDIT_AI_MODELS catalog** | ✅ (32 models) | ❌ | Removed import and array |
| **getI2IModelById import** | ✅ | ❌ | Removed |
| **Blob URL cleanup** | ✅ (`URL.revokeObjectURL`) | ❌ | Memory leak risk |
| **Preview onerror handler** | ✅ | ❌ | Silent failure on broken previews |
| **No-result error state** | ✅ (inline red error) | ❌ | Removed from result area |

---

## Input Requirements Summary

| Input Type | Baseline | HEAD |
|---|---|---|
| Image upload | ✅ All tools | ✅ All tools |
| Video upload | ✅ All tools | ✅ All tools |
| Text prompt | 8 tools (hasPrompt: true) | 8 tools (4 gained prompt in HEAD) |
| URL load | ✅ (via UploadPicker) | ✅ (via UploadPicker) |
| Drag & drop | ✅ (via UploadPicker) | ✅ (via UploadPicker) |
| Paste | ✅ (via UploadPicker) | ✅ (via UploadPicker) |
| Multi-image select | 🔶 (UploadPicker supports) | 🔶 (UploadPicker supports) |
| Model selector | ✅ (AI Edit only, 33 options) | ❌ |
| Aspect ratio | ✅ (Reframe + AI Edit) | ❌ |
| Quality | ✅ (AI Edit) | ❌ |
| Render speed | ✅ (Reframe) | ❌ |
| Style | ✅ (Reframe) | ❌ |
| Num images | ✅ (Reframe) | ❌ |
| Target face index | ✅ (Face Swap) | ❌ |
| Watermark position | ✅ (Add Watermark) | ❌ |
| Watermark opacity | ✅ (Add Watermark) | ❌ |
| Watermark scale | ✅ (Add Watermark) | ❌ |
| Dynamic model inputs | ✅ (AI Edit, schema-driven) | ❌ |

---

## Masks / Brush Controls

**Baseline:** ❌ Not present
**HEAD:** ❌ Not present
**Note:** Neither version has any mask, brush, inpainting mask upload, or region selection controls. All editing is prompt-based or fully automated.

---

## Sliders (Strength, Feather, Intensity)

**Baseline:** ❌ No sliders — all controls are `<select>` dropdowns or `<input type="number">`
**HEAD:** ❌ No sliders
**Note:** No strength, feather, intensity, opacity, or blend sliders exist in either version.

---

## Prompt / Reference Image Support

| Feature | Baseline | HEAD |
|---|---|---|
| Text prompt input | ✅ 8 tools | ✅ 8 tools (4 additional tools gained prompt) |
| Prompt placeholder | ✅ per-tool | ✅ per-tool (updated for 4 tools) |
| Token replacement (personalize) | ✅ | ✅ |
| Reference image upload | ✅ (via UploadPicker) | ✅ (via UploadPicker) |
| Reference image multi-select | 🔶 | 🔶 |
| Reference image history | ✅ (localStorage) | ✅ (localStorage) |
| Prompt enhancement (GTM Boost) | ❌ (not wired) | ❌ (not wired) |

---

## Aspect Ratio / Output Settings

| Feature | Baseline | HEAD |
|---|---|---|
| Aspect ratio select (Reframe) | ✅ (8 options) | ❌ Removed |
| Aspect ratio select (AI Edit) | ✅ (8 options) | ❌ Removed |
| Output format | ❌ | ❌ |
| Width/height custom input | ❌ | ❌ |
| Batch count | ❌ | ❌ |

---

## Presets

| Feature | Baseline | HEAD |
|---|---|---|
| Tool presets | ❌ | ❌ |
| Style presets | ❌ | ❌ |
| Quick starters | ❌ | ❌ |
| Saved edit presets | ❌ | ❌ |

---

## Preview / Before-After

| Feature | Baseline | HEAD |
|---|---|---|
| Upload preview image | ✅ | ✅ |
| Fullscreen preview | ❌ | ❌ |
| Before/after comparison slider | ❌ | ❌ |
| Split preview | ❌ | ❌ |
| Preview onerror handling | ✅ | ❌ (removed) |

---

## Result Actions

| Action | Baseline | HEAD |
|---|---|---|
| Result image display | ✅ | ✅ |
| Download link | ✅ | ✅ |
| Regenerate | ❌ | ❌ |
| New / Clear | ❌ | ❌ |
| Extend | ❌ | ❌ |
| No-result error message | ✅ (inline) | ❌ (removed) |
| History sidebar | ❌ | ❌ |

---

## Git History Summary

```
9211eeb7 feat(edit-studio): restore advanced editing controls   ← HEAD
afad812a feat(edit-studio): add dynamic model selector and controls for 32 AI edit variants  ← Baseline
71edaf7d fix(muapi): align app call sites with upstream endpoint schemas
1e20c042 WIP on main...
b7474265 fix(build): add placeholder apps dir for Render submodule path
982ee71c Resolve DirectorPage.js rebase conflict
d8e8018b feat(thumbnail): replace modal with side drawer panel matching GTM design
a389f63d feat(thumbnail): replace modal with side drawer panel matching GTM design
e27f4a6d refactor(thumbnail): match GTM Boost design system
7b9185f9 refactor(thumbnail): match GTM Boost design system
9aa8f905 feat(thumbnail): wire StudioThumbnailModal into all remaining studios
b348ee7b feat(thumbnail): wire StudioThumbnailModal into all remaining studios
0cb5292b feat(upload): fix obfuscated API key reads + add 4 upload methods
9de5345b feat(studios): add back button + all-studios side-menu to every studio
eef5b593 feat(studios): add back button + all-studios side-menu to every studio
7bf9d611 feat(personalize): add trigger button to all image/video creation studios
```

Note: The HEAD commit message claims to "restore advanced editing controls" but the diff from baseline `afad812a` to HEAD shows **controls removed**, not added. This suggests the restoration was either reverted in a subsequent uncommitted change, or the diff direction is opposite to the commit's intent. The working tree (262 lines) is definitively simpler than the baseline (649 lines).

---

## Key Findings

1. **Regression of -60% file size:** EditStudio.js dropped from 649 → 262 lines between baseline and HEAD, with most tool-specific control code removed.

2. **5 tools fully degraded (lost all unique controls):**
   - `seedream-5.0-edit`: Lost model selector (33→1), dynamic schema controls, aspect ratio, quality
   - `ideogram-v3-reframe`: Lost aspect ratio, render speed, style, num images
   - `add-image-watermark`: Lost position, opacity, scale controls
   - `ai-image-face-swap`: Lost target face index input
   - `ai-product-shot`: Lost `scene_description` param mapping

3. **4 tools gained prompt support:** Remove Object, Extend Image, Change Dress, Add Watermark — these previously had `hasPrompt: false`.

4. **No masks, brushes, or sliders exist** in either version. All editing is fully automated or text-prompt-driven.

5. **Memory management regression:** Blob URL revocation (`URL.revokeObjectURL`) and preview `onerror` handler removed — potential memory leak for large image uploads.

6. **Error state regression:** "Edit completed, but no result image was returned" inline error removed from result area. Only `alert()` remains for error reporting.

7. **No before/after, no history, no presets, no batch processing** in either version.

8. **`EDIT_AI_MODELS` (32-model catalog) and `getI2IModelById`** were removed — the studio no longer consults the model schema for tool-specific inputs. All 13 tools now send their hardcoded tool ID as the model parameter.

---

*End of EDIT_STUDIO_CONTROL_MATRIX.md*
