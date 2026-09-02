# Video Studio Deep Audit
**Sub-Agent 5: VIDEO STUDIO SPECIALIST**
**Date:** 2026-08-11
**Working Directory:** `/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery`
**Baseline Commit:** `afad812a22d9f6f470222a99136b7cd651f61a89`

---

## 1. EXECUTIVE SUMMARY

Video Studio (`/video`, `src/components/VideoStudio.js`) is a **Very High complexity** studio (~1,326 lines current, 1,429 lines at baseline). It is the primary interface for AI video generation supporting **Text-to-Video (T2V)**, **Image-to-Video (I2V)**, and **Video-to-Video (V2V)** workflows. The studio has undergone a significant **simplification/refactor** between baseline and current HEAD, removing the provider-aware split-pane model selector in favor of a simpler search-based dropdown, and removing GTM thumbnail bridge integration.

**Key change:** Lines decreased from 1,429 → 1,326 (-103 lines, -7.2%).

---

## 2. BASELINE (afad812a) vs CURRENT HEAD COMPARISON

| Metric | Baseline (afad812a) | Current HEAD | Delta |
|--------|-------------------|--------------|-------|
| File lines | 1,429 | 1,326 | -103 (-7.2%) |
| Model selector | Provider-aware split-pane | Simple search dropdown | Simplified |
| Upload pipeline | `processFileUpload()` | `muapi.uploadFile()` | Unified |
| GTM thumbnails | `subscribeToGtmThumbnails` active | Removed | Removed |
| GTM context | Restored on mount | Removed | Removed |
| Provider logos | Dynamic per provider | Generic colored icon | Simplified |
| i2v quality param | Not passed (Wan-specific) | Always passed | Added |
| i2v aspect_ratio | Wan-specific only | Always passed | Added |
| i2v negative_prompt/seed | Wan-specific only | Always passed | Added |

### 2.1 What Was Removed

| Removed Item | Description |
|---|---|
| `processFileUpload` import | Replaced with direct `muapi.uploadFile()` |
| `subscribeToGtmThumbnails` | Cross-studio GTM thumbnail bridge removed |
| `getGtmContext` import | GTM context restoration on mount removed |
| `modelSelectorUI` imports | `PROVIDER_LOGOS`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList`, `filterModels`, `getAvailableProviders`, `getProviderStyle`, `invertLogos` all removed |
| `selectedProvider` state | No longer tracks selected provider filter |
| `updateModelBtnIcon()` | Dynamic provider logo icon replaced with static colored "V" icon |
| Provider sidebar in dropdown | Split-pane provider sidebar removed |
| Provider badge | No longer shows selected provider name |
| GTM context log on mount | No longer logs restored GTM context |

### 2.2 What Was Added/Changed

| Added/Changed Item | Description |
|---|---|
| Unified upload | `muapi.uploadFile()` directly instead of `processFileUpload` pipeline |
| Quality in i2v | `selectedQuality` now passed to I2V API |
| Aspect ratio in i2v | `selectedAr` now always passed to I2V (was Wan-only) |
| Negative prompt in i2v | Now always passed (was Wan-only) |
| Seed in i2v | Now always passed (was Wan-only) |
| Thumbnail in i2v | Always passed if available (was conditional on non-Wan) |
| `saveGeneratedAsset` | Video can now be persisted to Render via asset store |
| `navigate('render')` | "Open in Render" button navigates to Render studio |
| `createSafeVideo` | XSS-safe video element creation for history thumbnails |
| `extendBtn` | Extend button for Seedance 2.0 generations |
| `lastGenerationId` / `lastGenerationModel` | State tracking for Seedance 2.0 extend flow |

---

## 3. CURRENT UI STRUCTURE

### 3.1 Layout Components

| Component | Description |
|---|---|
| **Hero Banner** | `createHeroSection('video', ...)` — gradient background with "Video Studio" title and subtitle |
| **Prompt Bar** | Glass-morphism card (`bg-[#111]/90 backdrop-blur-xl`) containing: |
| — Top Row | Image upload picker + Video upload picker + Textarea + GTM Boost button |
| — Personalized Chip | Shows active contact info when personalization is enabled |
| — Extend Banner | Shows when Seedance 2.0 extend mode is active |
| — Bottom Row | Model \| AR \| Duration \| Resolution \| Quality \| Advanced \| Personalize \| Thumbnail \| Generate |
| **Advanced Panel** | Collapsible: Negative Prompt + Seed (with Randomize) |
| **Canvas Area** | Full-screen result display with video player + action buttons |
| **History Sidebar** | Fixed right panel, 80-96px wide, vertical thumbnail strip |
| **Inline Instructions** | Contextual help text below prompt bar |

### 3.2 Prompt Bar Controls (Bottom Row)

| Control | Type | Values | Default |
|---|---|---|---|
| Model | Dropdown | t2vModels / i2vModels / v2vModels | t2vModels[0] |
| Aspect Ratio | Dropdown | Per-model ARs | 16:9 |
| Duration | Dropdown | Per-model durations | 5s |
| Resolution | Dropdown | Per-model resolutions | 720p |
| Quality | Dropdown | Per-model qualities | basic |
| Advanced | Toggle | Shows advanced panel | Hidden |
| Personalize | Popover | Contact-based personalization | None |
| Thumbnail | Button | Opens StudioThumbnailModal | — |
| Generate | Button | Fires generation | — |

### 3.3 Advanced Options

| Option | Type | Default | Range |
|---|---|---|---|
| Negative Prompt | Text input | Empty | Free text |
| Seed | Number input | -1 (random) | -1 to 999,999,999 |

---

## 4. MODES & WORKFLOWS

### 4.1 Three Operating Modes

| Mode | Trigger | Models Used | Prompt Required | Uploads |
|---|---|---|---|---|
| **Text-to-Video (T2V)** | Default, no uploads | `t2vModels` | Yes (required) | None |
| **Image-to-Video (I2V)** | Image upload | `i2vModels` | Optional | Image |
| **Video-to-Video (V2V)** | Video upload | `v2vModels` | No (disabled) | Video (watermark removal) |

### 4.2 Mode Switching Logic

1. **T2V → I2V**: User uploads image via `createUploadPicker` → `imageMode = true` → model switches to `i2vModels[0]`
2. **I2V → T2V**: User clears image picker → `imageMode = false` → model switches to `t2vModels[0]`
3. **T2V/I2V → V2V**: User uploads video → `v2vMode = true` → image mode cleared → model switches to `v2vModels[0]`
4. **V2V → T2V**: User clears video upload → `v2vMode = false` → model switches to `t2vModels[0]`
5. **Extend mode**: User clicks Extend on Seedance 2.0 result → model switches to `seedance-v2.0-extend`

### 4.3 Generation Flows

#### T2V Flow
```
Select model → Enter prompt → (optional: Advanced params) → Generate
  → requireEntitlement() check → AuthModal if no API key
  → muapi.generateVideo(params) → result video URL
  → Show in canvas → Add to history
```

#### I2V Flow
```
Upload image → Auto-switches to i2v mode → (optional: prompt, AR, duration, resolution, quality, negative, seed) → Generate
  → muapi.generateI2V(params) → result video URL
  → Show in canvas → Add to history
  → If seedance-v2.0-i2v: enable Extend button
```

#### V2V Flow
```
Upload video → Auto-switches to v2v mode → Generate (prompt disabled)
  → muapi.processV2V({ model, video_url, thumbnail_url? }) → result video URL
  → Show in canvas → Add to history
```

#### Extend Flow
```
View seedance-v2.0 result → Click Extend → Model switches to seedance-v2.0-extend
  → (optional: continuation prompt) → Generate
  → muapi.generateVideo({ model: 'seedance-v2.0-extend', request_id: lastGenerationId, ... }) → extended video
```

---

## 5. CONTROLS AUDIT

### 5.1 Model Selection

| Aspect | Current Status |
|---|---|
| **Selector type** | Custom dropdown with search bar |
| **Provider sidebar** | **REMOVED** — no longer shows provider logos or filters |
| **Search** | Yes — text search by model name/ID |
| **Model categories** | T2V/I2V (generation) + V2V (Video Tools section) |
| **Visual identity** | Generic colored icon with model first letter (kling=blue, veo=purple, sora=rose, others=primary) |
| **Selection indicator** | Checkmark SVG for selected model |

**Historical note:** Baseline had a sophisticated provider-aware split-pane model selector with:
- Provider sidebar with icon grid (from `PROVIDER_LOGOS`)
- Search bar
- Provider badge
- Model list with provider logos
- Provider filtering

### 5.2 Duration

| Aspect | Current Status |
|---|---|
| **Source** | `getDurationsForModel()` or `getDurationsForI2VModel()` |
| **Default** | 5 seconds |
| **Display** | Dropdown showing "Xs" values |
| **V2V** | Hidden in v2v mode |
| **Extend** | Hidden in extend mode |

### 5.3 Aspect Ratio

| Aspect | Current Status |
|---|---|
| **Source** | `getAspectRatiosForVideoModel()` or `getAspectRatiosForI2VModel()` |
| **Default** | 16:9 |
| **Display** | Dropdown with visual AR preview icons |
| **V2V** | Hidden in v2v mode |
| **I2V** | Always passed to API (was Wan-specific in baseline) |

### 5.4 Resolution

| Aspect | Current Status |
|---|---|
| **Source** | `getResolutionsForVideoModel()` or `getResolutionsForI2VModel()` |
| **Default** | 720p |
| **Display** | Dropdown |
| **V2V** | Hidden in v2v mode |

### 5.5 Quality

| Aspect | Current Status |
|---|---|
| **Source** | `model.inputs.quality.enum` |
| **Default** | basic |
| **Display** | Dropdown |
| **T2V** | Available if model has quality enum |
| **I2V** | Now always passed to API (added in current) |
| **V2V** | Hidden in v2v mode |

### 5.6 Camera Controls

| Aspect | Current Status |
|---|---|
| **Camera movement** | **NOT PRESENT** — no camera motion controls in Video Studio |
| **Lens selection** | **NOT PRESENT** |
| **Focal length** | **NOT PRESENT** |
| **Aperture** | **NOT PRESENT** |
| **Film looks** | **NOT PRESENT** |

**Note:** Cinema Studio has these controls (9 camera movements, 8 film looks, lens/focal/aperture) and can "Send to Video Studio" — but Video Studio itself has no camera controls.

### 5.7 Motion Controls

| Aspect | Current Status |
|---|---|
| **Motion strength** | **NOT PRESENT** |
| **Camera motion** | **NOT PRESENT** |
| **Interpolation** | **NOT PRESENT** |
| **Frame-by-frame** | **NOT PRESENT** |

**Note:** Effects Studio has a "Motion Controls" tab but Video Studio does not.

### 5.8 Prompt

| Aspect | Current Status |
|---|---|
| **Input** | Auto-expanding textarea |
| **Placeholder** | Context-aware (T2V: "Describe the video...", I2V: "Describe the motion...", V2V: "Video ready...", Extend: "Optional: describe how to continue...") |
| **Prefill** | Supports `prefill_prompt` from localStorage |
| **GTM Boost** | Yes — opens `openGTMPromptModal('video-studio', callback)` |
| **Personalization** | Yes — token replacement + context injection via `replaceTokensInPrompt` |
| **V2V** | Disabled when in v2v mode |

### 5.9 Negative Prompt

| Aspect | Current Status |
|---|---|
| **Location** | Advanced Options panel |
| **Input** | Text input |
| **T2V** | Passed to API |
| **I2V** | Now always passed (was Wan-specific in baseline) |
| **V2V** | Not applicable |

### 5.10 Image-to-Video

| Aspect | Current Status |
|---|---|
| **Upload method** | `createUploadPicker` — file, URL, drag-drop, paste |
| **Auto-switch** | Yes — selecting image switches to i2v mode |
| **Mode indicator** | Textarea placeholder changes |
| **First frame** | Uploaded image serves as first frame |
| **Last frame** | **NOT SUPPORTED** |
| **Reference image** | Uploaded image only (single) |

### 5.11 Text-to-Video

| Aspect | Current Status |
|---|---|
| **Default mode** | Yes — studio opens in T2V mode |
| **Prompt required** | Yes — enforced with alert |
| **Model selection** | Full t2vModels catalog |

### 5.12 First Frame / Last Frame

| Aspect | Current Status |
|---|---|
| **First frame** | Supported via image upload (I2V mode) |
| **Last frame** | **NOT SUPPORTED** — no last frame upload control |

### 5.13 Reference Image

| Aspect | Current Status |
|---|---|
| **Reference image** | **NOT A SEPARATE CONTROL** — only via I2V upload |
| **Style reference** | Mentioned in personalization ("Reference style: portrait of...") |
| **Multiple references** | **NOT SUPPORTED** |

### 5.14 Motion Strength

| Aspect | Current Status |
|---|---|
| **Motion strength** | **NOT PRESENT** |
| **Camera motion** | **NOT PRESENT** |

### 5.15 Creativity

| Aspect | Current Status |
|---|---|
| **Guidance scale / CFG** | **NOT PRESENT** — ImageStudio has guidance scale (1-20), VideoStudio does not |
| **Temperature** | **NOT PRESENT** |

### 5.16 Seed

| Aspect | Current Status |
|---|---|
| **Location** | Advanced Options panel |
| **Default** | -1 (random) |
| **Randomize** | Yes — "Randomize" button |
| **T2V** | Passed to API |
| **I2V** | Now always passed (was Wan-specific in baseline) |
| **V2V** | Not applicable |
| **Extend** | Not applicable (uses request_id) |

### 5.17 Generation Count

| Aspect | Current Status |
|---|---|
| **Batch count** | **NOT PRESENT** — ImageStudio has batch count (1-4), VideoStudio does not |
| **Single generation** | Only single video per generation |

### 5.18 Video Preview

| Aspect | Current Status |
|---|---|
| **Player** | HTML5 `<video>` with controls, loop, autoplay, muted |
| **Max display** | `max-h-[60vh] max-w-[80vw]` |
| **Styling** | Rounded-3xl, shadow-3xl, interactive-glow |
| **Loading state** | Button shows "Generating..." with spinner |
| **Error state** | Button shows "Error: {message}" for 3s then resets |
| **Frame preview** | **NOT PRESENT** — no frame-by-frame preview |
| **Timeline scrubber** | **NOT PRESENT** inline |

### 5.19 Result Controls

| Control | Current Status | Notes |
|---|---|---|
| **Regenerate** | Yes | Re-triggers Generate with same params |
| **Download** | Yes | Fetches blob and triggers download |
| **Extend** | Yes | Seedance 2.0 only — switches to extend model |
| **Open in Render** | Yes | Saves asset and navigates to Render studio |
| **New** | Yes | Resets to prompt bar, clears all state |
| **Variation** | **NOT PRESENT** |
| **Remix** | **NOT PRESENT** |
| **Upscale** | **NOT PRESENT** |

---

## 6. HISTORICAL CONTROLS NOT IN CURRENT

The following controls existed in the historical codebase but are **NOT present** in the current VideoStudio:

| Historical Control | Location in Codebase | Current Status |
|---|---|---|
| Provider-aware split-pane model selector | `modelSelectorUI.js` | **REMOVED** — simplified to search dropdown |
| Provider logo icons in model selector | `PROVIDER_LOGOS` map | **REMOVED** — generic colored icons |
| Provider filtering | `selectedProvider` state | **REMOVED** |
| GTM thumbnail bridge | `gtmThumbnailBridge.js` | **REMOVED** |
| GTM context restoration on mount | `gtmContextStore.js` | **REMOVED** |
| Style presets | (from promptUtils) | **NOT PRESENT** — ImageStudio has 9 style presets |
| Guidance scale | (1-20 slider) | **NOT PRESENT** |
| Steps slider | (1-50) | **NOT PRESENT** |
| Batch count | (1-4) | **NOT PRESENT** |
| Custom width/height | Number inputs | **NOT PRESENT** |
| Reference strength | (0-100%) | **NOT PRESENT** |
| LoRA model + weight | Input + slider | **NOT PRESENT** |
| Camera/lens controls | (from CinemaStudio) | **NOT PRESENT** — only in Cinema Studio |
| Motion controls | Effects Studio tab | **NOT PRESENT** |
| Quick starters | `QUICK_PROMPTS` | **NOT PRESENT** |
| Prompt enhancer tags | `ENHANCE_TAGS` | **NOT PRESENT** |
| Video timeline inline | (from Timeline) | **NOT PRESENT** |

---

## 7. EXAMPLE CONTENT & TEMPLATES

### 7.1 Video Studio Specific

**No example content or templates were found specifically for Video Studio.** The studio opens with an empty prompt bar and no pre-filled prompts, starters, or template presets.

### 7.2 Available Elsewhere

| Resource | Location | Relevance |
|---|---|---|
| ExplorePage prompts | `src/components/ExplorePage.js` | 12 curated prompts (Cinematic, Sci-Fi, Art, etc.) — accessible via `/explore` |
| Templates | `/templates` route | Template-driven generation with cinematic specs |
| Demo pages | `/smartvideo-demo` | Static integration demo |
| Cinema Studio | `/cinema` | Has cinematic prompt builder that "sends to Video Studio" |
| Thumbnail presets | `thumbnailPresets.js` | Video aspect ratio presets |
| Inline instructions | `InlineInstructions.js` | Contextual help text (shown below prompt bar) |

### 7.3 Gaps

- No "Quick Start" prompts specific to video generation
- No video-specific template gallery
- No example videos or sample outputs
- No preset "scenes" or shot types (Storyboard Studio has 7 shot types but Video Studio does not)

---

## 8. HISTORY SIDEBAR

| Aspect | Status |
|---|---|
| **Persistence** | `localStorage` key: `video_history` (max 30 entries) |
| **Display** | Fixed right panel, 80-96px wide, vertical thumbnails |
| **Thumbnail** | Video element with `preload='metadata'`, XSS-safe via `createSafeVideo` |
| **Hover overlay** | Download button appears on hover |
| **Click behavior** | Restores video to canvas, highlights entry |
| **Newest highlight** | `border-primary shadow-glow` |
| **Scrubber** | **NOT PRESENT** — no inline video scrubber |
| **Metadata** | Shows URL only — no prompt, model, or timestamp display |

---

## 9. STATE MANAGEMENT

| State Variable | Type | Purpose |
|---|---|---|
| `selectedModel` | String | Current model ID |
| `selectedModelName` | String | Display name |
| `selectedAr` | String | Aspect ratio |
| `selectedDuration` | Number | Duration in seconds |
| `selectedResolution` | String | Resolution (e.g., "720p") |
| `selectedQuality` | String | Quality level |
| `lastGenerationId` | String | For Seedance extend |
| `lastGenerationModel` | String | For Seedance extend |
| `uploadedImageUrl` | String | I2V image URL |
| `imageMode` | Boolean | T2V vs I2V |
| `v2vMode` | Boolean | V2V active |
| `uploadedVideoUrl` | String | V2V video URL |
| `negativePrompt` | String | Advanced option |
| `seed` | Number | Advanced option |
| `showAdvanced` | Boolean | Advanced panel toggle |
| `customThumbnailUrl` | String | Custom thumbnail |
| `generationHistory` | Array | In-memory history |

All state is **module-level closures** — no Store class, no React state, no cross-studio sharing.

---

## 10. API INTEGRATION

| API Method | Used For | Params |
|---|---|---|
| `muapi.generateVideo(params)` | T2V + Extend | model, prompt, negative_prompt, seed, request_id (extend), aspect_ratio, duration, resolution, quality, thumbnail_url |
| `muapi.generateI2V(params)` | I2V | model, image_url, prompt, negative_prompt, seed, aspect_ratio, duration, resolution, quality, thumbnail_url |
| `muapi.processV2V(params)` | V2V | model, video_url, thumbnail_url |
| `muapi.uploadFile(file)` | Video upload | File → URL |
| `saveGeneratedAsset()` | Render integration | Asset persistence |
| `requireEntitlement()` | Auth check | Clerk entitlement |

---

## 11. MISSING FEATURES (GAP ANALYSIS)

### 11.1 Critical Gaps

| Gap | Severity | Notes |
|---|---|---|
| No camera motion controls | High | Cinema Studio has these; Video Studio does not |
| No motion strength control | High | No way to control animation intensity |
| No last frame upload | High | Only first frame (I2V) supported |
| No batch generation | Medium | ImageStudio has batch count; VideoStudio does not |
| No inline timeline/scrubber | Medium | History sidebar has no video scrubber |
| No style/look presets | Medium | ImageStudio has 9 style presets |
| No guidance scale/creativity | Medium | ImageStudio has 1-20 guidance scale |
| No quick starters/templates | Medium | No pre-written prompts for video |

### 11.2 Comparison Gaps vs Cinema Studio

Cinema Studio offers controls that Video Studio lacks:
- 9 camera movements (Static, Dolly In/Out, Crane Up, Orbit, FPV Drone, Handheld, Pan, Tilt, Dolly Zoom)
- 8 film looks (Natural, Anamorphic, Teal & Orange, Moody Noir, Vintage, Neon Nights, Documentary, Golden Hour)
- Lens selection
- Focal length
- Aperture
- Cinematic prompt builder
- "Send to Video Studio" integration

### 11.3 Comparison Gaps vs Image Studio

Image Studio offers controls that Video Studio lacks:
- 9 style presets
- Guidance scale (1-20)
- Steps (1-50)
- Batch count (1-4)
- Custom width/height
- Reference strength (0-100%)
- LoRA model + weight
- Quick starters
- Prompt enhancer tags
- Batch result grid

---

## 12. MODEL CATALOG

Video Studio uses three model arrays from `models.js`:

| Array | Purpose | Count (typical) |
|---|---|---|
| `t2vModels` | Text-to-video models | ~5-10 |
| `i2vModels` | Image-to-video models | ~5-10 |
| `v2vModels` | Video tools (watermark removal, etc.) | ~2-5 |

Model selection is **dynamic** — the dropdown shows different models based on current mode (T2V shows t2vModels, I2V shows i2vModels, both show v2vModels in a "Video Tools" section).

---

## 13. STABILITY & ROBUSTNESS

| Aspect | Status |
|---|---|
| **XSS protection** | `createSafeVideo()` used for history thumbnails; `escapeHtml()` for contact names |
| **Storage errors** | Wrapped in try/catch with silent fallback |
| **API errors** | `alert()` with truncated message (40 chars), 3s reset |
| **Auth flow** | `requireEntitlement()` + `AuthModal` on missing API key |
| **Prefill** | `prefill_prompt` from localStorage, cleared after use |
| **Personalization** | Token replacement + context injection with fallbacks |
| **Event cleanup** | No explicit cleanup in factory function |

---

## 14. KEY FINDINGS SUMMARY

1. **Video Studio simplified between baseline and current** — 103 lines removed (-7.2%), primarily from removing the provider-aware split-pane model selector and GTM thumbnail bridge.

2. **Provider logos removed from model selector** — replaced with generic colored icons (kling=blue, veo=purple, sora=rose). The `modelSelectorUI.js` infrastructure is no longer used in VideoStudio.

3. **I2V API calls standardized** — aspect_ratio, duration, resolution, quality, negative_prompt, and seed are now always passed to I2V (previously Wan-specific conditionals).

4. **No camera/motion controls** — unlike Cinema Studio (which has 9 camera movements, 8 film looks, lens/aperture), Video Studio has zero camera or motion controls.

5. **No batch generation** — ImageStudio has batch count (1-4) but VideoStudio generates only one video per request.

6. **No quick starters or templates** — Video Studio has no pre-written prompts or example content, unlike some other studios.

7. **Three clean modes** — T2V, I2V, V2V with clear mode switching and context-aware UI (placeholders, disabled controls).

8. **Extend flow for Seedance 2.0** — properly implemented with `lastGenerationId` tracking and extend mode banner.

9. **Render integration added** — "Open in Render" button saves asset and navigates to Render studio (new in current HEAD).

10. **Missing result actions** — No variation, remix, or upscale buttons (only Regenerate, Download, Extend, Open in Render, New).

---

*End of VIDEO_STUDIO_DEEP_AUDIT.md*
*Generated by SUB-AGENT 5: VIDEO STUDIO SPECIALIST*
