# UIUX Recovery Implementation Plan
**Project:** SmartVideo AI — Remix New Editor
**Baseline Commit:** afad812a22d9f6f470222a99136b7cd651f61a89
**Current HEAD:** coral-cemetery worktree
**Plan Date:** 2026-08-11
**Author:** SUB-AGENT 23 — IMPLEMENTATION ORCHESTRATOR

---

## Executive Summary

This plan synthesizes findings from 11 specialized audit reports covering 19 studios, shared infrastructure, and the full UI/UX layer. Between baseline (`afad812a`) and current HEAD, the codebase underwent a **systematic simplification campaign** that removed sophisticated UX patterns across nearly every studio. The three most damaging regressions are:

1. **Timeline Editor** — reduced from 6,946 lines to 344 lines (−95%), removing drag-and-drop, keyframes, transitions, color correction, subtitles, and multi-track editing.
2. **Edit Studio** — reduced from 649 lines to 262 lines (−60%), removing per-tool parameter panels, watermark controls, face swap target index, dynamic schema-driven controls.
3. **Effects Studio** — reduced from 1,358 lines to 501 lines (−63%), removing keyframe animation, effect layers/compositing, video stitching, before/after comparison, and advanced generation controls.

Additionally, **all 19 studios** lost the sophisticated `modelSelectorUI.js` provider-aware split-pane model selector, replaced with flat button grids. Three studios (Template, Cinema Template, AI VFX) are entirely absent from the current app. The Video-to-Video studio is a static placeholder.

This plan prioritizes **restoring lost functionality** over building new features, grouped into 4 phases with clear dependency ordering.

---

## Priority Definitions

| Priority | Criteria |
|----------|----------|
| **P0** | Clearly missing and highly valuable — affects core user workflow, blocks primary use cases |
| **P1** | Useful advanced functionality — significant UX improvement, enables new workflows |
| **P2** | Nice-to-have historical UX — quality-of-life improvements, consistency enhancements |
| **P3** | Deprecated or unnecessary — features no longer relevant, superseded, or not viable |

---

## Feature Recovery Matrix

### STUDIO: Timeline / Editor

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 1 | Timeline drag-and-drop (clip move/resize) | `editor/dragDrop.js` (47KB), `TimelineEditorPage.jsx` | ❌ Missing — Timeline.js is skeletal (344 lines) | **P0** | Create new — restore `editor/` library | Very High | `Timeline.js` route protected; `editor/TimelineState.js` new file |
| 2 | Clip splitting/trimming | `TimelineEditorPage.jsx` baseline | ❌ Missing | **P0** | Create new — part of drag-drop restore | Very High | Same as above |
| 3 | Multi-track editing (Video, Audio, Text, B-Roll) | `TimelineEditorPage.jsx` baseline | 🔶 Partial — track rows exist but no editing | **P0** | Enhance existing | High | `/timeline` route |
| 4 | Keyframe animation system | `editor/keyframeSystem.jsx` baseline | ❌ Missing | **P1** | Create new | High | None |
| 5 | Transitions between clips | `editor/transitionEditor.js` baseline | ❌ Missing | **P1** | Create new | Medium | None |
| 6 | Subtitle timeline | `editor/subtitleTimeline.js` baseline | ❌ Missing | **P1** | Create new | Medium | None |
| 7 | Color correction system | `editor/colorCorrectionSystem.jsx` (50KB) | ❌ Missing | **P2** | Create new | High | None |
| 8 | Animation controls | `editor/animationControls.jsx` (32KB) | ❌ Missing | **P2** | Create new | Medium | None |
| 9 | Export/render from timeline | SettingsModal Export tab baseline | ❌ Missing | **P1** | Create new | High | `/render` route (protected) — do NOT modify |
| 10 | Timeline zoom/scroll | `TimelineEditorPage.jsx` baseline | 🔶 Partial — zoom buttons exist | **P0** | Enhance existing | Low | None |
| 11 | Snap-to-grid | `TimelineEditorPage.jsx` baseline | ❌ Missing | **P2** | Create new | Low | None |
| 12 | Undo/redo for timeline | `TimelineEditorPage.jsx` baseline | ❌ Missing | **P1** | Create new | Medium | None |
| 13 | Keyboard shortcuts (timeline) | SettingsModal Keyboard tab baseline | ❌ Missing | **P2** | Create new | Low | None |
| 14 | Media import to timeline | `TimelineEditorPage.jsx` baseline | ❌ Missing | **P1** | Enhance existing | Medium | UploadPicker (shared) |
| 15 | Multi-camera / PiP / split-screen | `TimelineEditorPage.jsx` baseline | ❌ Missing | **P2** | Create new | High | None |
| 16 | Timeline state persistence | `useTimelineStore.jsx`, `editor/TimelineState.js` (26KB) | ❌ Missing | **P1** | Create new | Medium | localStorage (shared) |

---

### STUDIO: Edit Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 17 | Per-tool parameter panels | `showControlsForTool()`, `buildDynamicControls()` baseline (649 lines) | ❌ Removed — all tools now generic | **P0** | Enhance existing | High | `models.js` (protected — read only) |
| 18 | Model selector for AI Edit (33 models) | `EDIT_AI_MODELS` array, `getI2IModelById` baseline | ❌ Removed — tool ID hardcoded | **P0** | Enhance existing | Medium | `models.js` (protected) |
| 19 | Dynamic schema-driven controls | `buildDynamicControls()` from `models.js` inputs | ❌ Removed | **P0** | Enhance existing | High | `models.js` (protected) |
| 20 | Reframe: aspect ratio selector (8 options) | Baseline `ideogram-v3-reframe` controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 21 | Reframe: render speed (Turbo/Balanced/Quality) | Baseline controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 22 | Reframe: style select (Auto/General/Realistic/Design) | Baseline controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 23 | Reframe: num images (1-4) | Baseline controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 24 | Watermark: position, opacity, scale | Baseline `add-image-watermark` controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 25 | Face Swap: target face index (0-10) | Baseline `ai-image-face-swap` controls | ❌ Removed | **P0** | Enhance existing | Low | None |
| 26 | Product Shot: `scene_description` param mapping | Baseline `ai-product-shot` special param | ❌ Removed — now sends generic `prompt` | **P1** | Enhance existing | Low | None |
| 27 | Blob URL memory management | `URL.revokeObjectURL` baseline | ❌ Removed — memory leak risk | **P1** | Enhance existing | Low | None |
| 28 | Preview onerror handler | Baseline `previewImg.onerror` | ❌ Removed | **P1** | Enhance existing | Low | None |
| 29 | No-result error state in result area | Baseline inline error | ❌ Removed | **P1** | Enhance existing | Low | None |
| 30 | Masks/brush controls | Never implemented | ❌ Missing | **P2** | Create new | High | None |
| 31 | Strength/intensity sliders | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 32 | Before/after comparison | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 33 | Batch processing | Never implemented | ❌ Missing | **P2** | Create new | Medium | UploadPicker (shared) |
| 34 | Edit history sidebar | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 35 | GTM Boost wired to edit tools | Baseline not wired | ❌ Missing | **P1** | Enhance existing | Low | GTMPromptModal (shared) |

---

### STUDIO: Effects Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 36 | Effect intensity/strength slider | Baseline advanced panel | ❌ Removed (857 lines removed) | **P0** | Enhance existing | Medium | None |
| 37 | Effect chaining / layers | `fxLayers`, `EffectCompositor`, `addEffectLayer` baseline | ❌ Removed | **P0** | Create new | High | None |
| 38 | Keyframe animation for effects | `fxKeyframes`, `buildKeyframeSegments` baseline | ❌ Removed | **P1** | Create new | High | None |
| 39 | Before/after comparison slider | `comparisonMode`, `compareBtn` baseline | ❌ Removed | **P1** | Create new | Medium | None |
| 40 | Advanced parameter controls | Guidance scale, steps, seed, negative prompt, denoise, CFG — baseline advanced panel | ❌ Removed | **P1** | Enhance existing | Medium | None |
| 41 | Effect parameter validation | `validateEffectParams`, `EFFECT_PARAM_SCHEMA` baseline | ❌ Removed | **P1** | Enhance existing | Low | None |
| 42 | Advanced settings persistence | `effects_studio_advanced_settings` localStorage | ❌ Removed | **P1** | Enhance existing | Low | localStorage (shared) |
| 43 | AbortController / cancel generation | Baseline `AbortController`, `timeoutId` | ❌ Removed | **P1** | Enhance existing | Low | None |
| 44 | Output action buttons (download, add to library, insert to timeline) | Baseline output actions | ❌ Removed | **P1** | Enhance existing | Low | None |
| 45 | Asset library integration | `saveGeneratedAsset`, `navigate('timeline')` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |
| 46 | Effect presets (save/load) | Never fully implemented | ❌ Missing | **P2** | Create new | Medium | localStorage (shared) |
| 47 | Effect descriptions/details | Never implemented | ❌ Missing | **P2** | Enhance existing | Low | None |
| 48 | Undo/redo for effect chain | Never fully implemented | ❌ Missing | **P3** | Create new | High | None |
| 49 | Batch apply to multiple images | Never implemented | ❌ Missing | **P3** | Create new | Medium | UploadPicker (shared) |

---

### STUDIO: Image Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 50 | Provider-aware model selector | `modelSelectorUI.js` baseline | ❌ Removed — replaced with flat dropdown | **P1** | Enhance existing | Medium | `models.js` (protected) |
| 51 | Provider logo display in model button | `updateModelBtnIcon()`, `PROVIDER_LOGOS` baseline | ❌ Removed — static "G" icon | **P2** | Enhance existing | Low | None |
| 52 | GTM thumbnail bridge | `subscribeToGtmThumbnails` baseline | ❌ Removed | **P1** | Enhance existing | Low | GTMPromptModal (shared) |
| 53 | GTM context restoration on mount | `getGtmContext` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |
| 54 | Batch result grid | Batch count slider exists (1-4) but unused | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 55 | Variations result display | Baseline has batch count | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 56 | Loading/progress indicator | Historical had spinner + "Generating..." | 🔶 Partial — button text only | **P0** | Enhance existing | Low | None |
| 57 | Cancellation mechanism | Never fully implemented | ❌ Missing | **P1** | Create new | Medium | AbortController pattern |
| 58 | Inline error state in canvas | Baseline: red error + button reset | ❌ Missing — only `alert()` | **P0** | Enhance existing | Low | None |
| 59 | Undo/redo | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 60 | Keyboard shortcuts | Never implemented | ❌ Missing | **P2** | Create new | Low | None |
| 61 | Fix duplicate DOM append bug | Lines 353, 486-487 current code | ❌ Bug | **P0** | Enhance existing | Low | None |
| 62 | Server-side history sync | Baseline: localStorage only | ❌ Missing | **P2** | Create new | High | Backend API (new) |
| 63 | History delete button | Baseline: download only | ❌ Missing | **P2** | Enhance existing | Low | None |
| 64 | Save to project / Favorites | Never implemented | ❌ Missing | **P3** | Create new | High | Project system (new) |

---

### STUDIO: Video Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 65 | Provider-aware model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P1** | Enhance existing | Medium | `models.js` (protected) |
| 66 | GTM thumbnail bridge | `subscribeToGtmThumbnails` baseline | ❌ Removed | **P1** | Enhance existing | Low | GTMPromptModal (shared) |
| 67 | Camera motion controls | Cinema Studio has these; Video Studio does not | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 68 | Motion strength slider | Effects Studio "Motion Controls" tab | ❌ Missing | **P1** | Enhance existing | Low | None |
| 69 | Last frame upload (I2V) | Never implemented | ❌ Missing | **P1** | Enhance existing | Low | None |
| 70 | Batch video generation | ImageStudio has batch count; VideoStudio does not | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 71 | Style/look presets | ImageStudio has 9; VideoStudio has 0 | ❌ Missing | **P1** | Enhance existing | Low | None |
| 72 | Guidance scale / CFG | ImageStudio has 1-20; VideoStudio does not | ❌ Missing | **P1** | Enhance existing | Low | None |
| 73 | Quick starters / prompt templates | `QUICK_PROMPTS` baseline for Video | ❌ Missing | **P2** | Enhance existing | Low | `promptUtils.js` (shared) |
| 74 | Frame-by-frame preview | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 75 | Inline timeline scrubber | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 76 | Video history scrubber | Baseline: thumbnail only | ❌ Missing | **P2** | Enhance existing | Low | None |
| 77 | Variation / Remix result actions | Baseline had Regenerate/Download/Extend only | ❌ Missing | **P3** | Enhance existing | Low | None |
| 78 | Loading/progress indicator | Historical had proper states | 🔶 Partial | **P0** | Enhance existing | Low | None |
| 79 | Inline error state | Baseline: red error + button reset | ❌ Missing | **P0** | Enhance existing | Low | None |

---

### STUDIO: Storyboard Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 80 | Undo/redo system | `createUndoRedo()`, Ctrl+Z/Y baseline | ❌ Removed (−441 lines) | **P1** | Create new | Medium | None |
| 81 | Cloud save/load (Supabase) | `saveProject`, `loadProjectFromStorage`, Supabase client baseline | ❌ Removed | **P1** | Create new | High | Supabase client (new) |
| 82 | Frame comparison mode | `comparisonOverlay`, `openComparison` baseline | ❌ Removed | **P1** | Create new | Medium | None |
| 83 | Timeline duration strip | `renderTimelineStrip()`, `frameDurations` baseline | ❌ Removed | **P1** | Enhance existing | Medium | None |
| 84 | Per-frame duration controls | `frameDurations` array baseline | ❌ Removed | **P1** | Enhance existing | Low | None |
| 85 | Per-frame reference images | `createUploadPicker` per-frame baseline | 🔶 Degraded — non-functional text button | **P1** | Enhance existing | Medium | UploadPicker (shared) |
| 86 | Frame duplication | Never fully implemented | ❌ Missing | **P1** | Enhance existing | Low | None |
| 87 | Frame deletion | Hardcoded 3 frames only | ❌ Missing | **P0** | Enhance existing | Low | None |
| 88 | Keyboard shortcuts | Ctrl+S, Ctrl+Z, Escape baseline | ❌ Removed | **P2** | Create new | Low | None |
| 89 | GTM thumbnail bridge | `subscribeToGtmThumbnails` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |
| 90 | Autosave with persistence | `createAutosave`, `scheduleDraftSave` baseline | 🔶 Stub only | **P1** | Enhance existing | Low | localStorage (shared) |
| 91 | Export to PDF | Print-based export baseline | ✅ Works | ➖ | Keep | — | — |
| 92 | More than 3 default frames | Hardcoded limit | ❌ Missing | **P1** | Enhance existing | Low | None |
| 93 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Cinema Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 94 | Direct generation from Cinema Studio | Baseline always routed to Video Studio | ❌ Missing — routes to Video Studio | **P0** | Enhance existing | Medium | None |
| 95 | Shot sequence / multi-shot planning | Baseline had single-shot only | ❌ Missing | **P1** | Create new | High | None |
| 96 | Storyboard integration | Baseline had no link to Storyboard | ❌ Missing | **P1** | Enhance existing | Medium | StoryboardStudio (shared) |
| 97 | Save/load cinematic presets | Never fully implemented | ❌ Missing | **P2** | Create new | Low | localStorage (shared) |
| 98 | Cinematic look preview | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 99 | Camera builder vs overlay deduplication | Two separate UIs for same settings | 🔶 Partial — redundant | **P2** | Enhance existing | Low | None |
| 100 | Shot duration control per scene | Never implemented | ❌ Missing | **P2** | Enhance existing | Low | None |
| 101 | B-roll / multi-shot planning | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 102 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Upscale Suite

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 103 | Denoise level control | Baseline had denoise option | ❌ Missing | **P1** | Enhance existing | Low | None |
| 104 | Face enhancement toggle | Baseline had face enhance | ❌ Missing | **P1** | Enhance existing | Low | None |
| 105 | Color correction options | Baseline had color correction | ❌ Missing | **P2** | Enhance existing | Low | None |
| 106 | Before/after comparison slider | Never fully implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 107 | Batch upscale (multi-file) | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | UploadPicker (shared) |
| 108 | Save presets for content types | Never implemented | ❌ Missing | **P3** | Create new | Low | localStorage (shared) |
| 109 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Character Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 110 | Expression strength/intensity | Baseline had no slider | ❌ Missing | **P1** | Enhance existing | Low | None |
| 111 | Multiple reference images | Baseline had single only | ❌ Missing | **P1** | Enhance existing | Medium | UploadPicker (shared) |
| 112 | Seed lock for consistency | Never implemented | ❌ Missing | **P1** | Enhance existing | Low | None |
| 113 | Character library (save button) | Baseline had read-only display | 🔶 Partial — library exists but no save button | **P1** | Enhance existing | Low | localStorage (shared) |
| 114 | Pose/angle controls | Never implemented | ❌ Missing | **P2** | Create new | Medium | None |
| 115 | Outfit/style reference upload | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | UploadPicker (shared) |
| 116 | Age/gender controls | Never implemented | ❌ Missing | **P3** | Create new | Low | None |
| 117 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Commercial Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 118 | Background replacement controls | Baseline had no controls | ❌ Missing | **P1** | Create new | Medium | None |
| 119 | Lighting controls | Baseline had no controls | ❌ Missing | **P1** | Create new | Medium | None |
| 120 | Angle/composition controls | Baseline had no controls | ❌ Missing | **P2** | Create new | Low | None |
| 121 | Text overlay on product | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 122 | Brand color input | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Low | None |
| 123 | Multi-product composition | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 124 | A/B variant generation | Never implemented | ❌ Missing | **P3** | Create new | Medium | None |
| 125 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Audio Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 126 | Voice selection (TTS models) | `selectedVoice`, voice `<select>` baseline | ❌ Removed — TTS regression | **P0** | Enhance existing | Medium | None |
| 127 | TTS-specific generation path | `muapi.generateAudio({ text, speed, voice })` baseline | ❌ Removed — now uses `generateAudio({ prompt })` | **P0** | Enhance existing | Medium | `muapi.js` (protected) |
| 128 | Music-specific generation path | `muapi.generateMusic()` baseline | ❌ Removed — now unified | **P1** | Enhance existing | Medium | `muapi.js` (protected) |
| 129 | Speed/pitch controls | Baseline TTS controls | ❌ Missing | **P1** | Enhance existing | Low | None |
| 130 | Tone/emotion controls | Baseline had no controls | ❌ Missing | **P2** | Create new | Low | None |
| 131 | Waveform preview | Baseline had native `<audio controls>` only | ❌ Missing | **P1** | Create new | Medium | None |
| 132 | Audio editor (trim, fade) | Never implemented | ❌ Missing | **P2** | Create new | High | None |
| 133 | Lyrics input | Never implemented | ❌ Missing | **P3** | Create new | Medium | None |
| 134 | Voice cloning controls | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 135 | BGM mixing | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 136 | Stem separation | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 137 | Audio effects (reverb, EQ) | Never implemented | ❌ Missing | **P3** | Create new | High | None |
| 138 | SettingsModal Audio tab | Baseline had Audio tab (devices, sample rate, normalization, noise reduction, echo cancellation) | ❌ Missing | **P1** | Enhance existing | Medium | SettingsModal (shared) |
| 139 | SettingsModal Export tab | Baseline had Export tab (format, quality, bitrate) | ❌ Missing | **P2** | Enhance existing | Medium | SettingsModal (shared) |
| 140 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Avatar Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 141 | Avatar customization (hair, clothes, skin) | Baseline had no controls | ❌ Missing | **P1** | Create new | High | None |
| 142 | Background replacement | Baseline had no controls | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 143 | Expression controls | Baseline had no controls (Character Studio has 5 presets) | ❌ Missing | **P1** | Enhance existing | Low | None |
| 144 | Voice selection dropdown | Baseline had audio upload only | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 145 | Avatar library (save/load) | Baseline had no library | ❌ Missing | **P2** | Create new | Medium | localStorage (shared) |
| 146 | Multi-speaker support | Baseline had no support | ❌ Missing | **P3** | Create new | High | None |
| 147 | Script/dialogue editor | Baseline had no editor | ❌ Missing | **P3** | Create new | Medium | None |
| 148 | Subtitles/captions | Baseline had no support | ❌ Missing | **P3** | Create new | Medium | None |
| 149 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Training Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 150 | Learning rate control | Baseline had no controls | ❌ Missing | **P1** | Enhance existing | Low | None |
| 151 | Batch size control | Baseline had no controls | ❌ Missing | **P1** | Enhance existing | Low | None |
| 152 | Training progress indicator | Baseline had no progress UI | ❌ Missing | **P1** | Create new | Medium | None |
| 153 | Dataset preview/gallery | Baseline had no gallery | ❌ Missing | **P1** | Enhance existing | Medium | UploadPicker (shared) |
| 154 | Validation split | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Low | None |
| 155 | Resume training | Baseline had no resume | ❌ Missing | **P2** | Create new | Medium | None |
| 156 | LoRA metadata output | Baseline had no metadata editor | ❌ Missing | **P2** | Enhance existing | Low | None |
| 157 | LoRA rank/dimension | Baseline had no rank selector | ❌ Missing | **P2** | Enhance existing | Low | None |
| 158 | LoRA alpha control | Baseline had no alpha control | ❌ Missing | **P2** | Enhance existing | Low | None |
| 159 | Training presets | Baseline had no presets | ❌ Missing | **P3** | Create new | Low | None |
| 160 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Video Tools Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 161 | Tool-specific parameter panels | Baseline had no per-tool params | ❌ Missing | **P1** | Enhance existing | Medium | `models.js` (protected) |
| 162 | Processing progress/status | Baseline had no progress UI | ❌ Missing | **P1** | Create new | Low | None |
| 163 | Output format selection | Baseline had no format selector | ❌ Missing | **P1** | Enhance existing | Low | None |
| 164 | Quality/bitrate controls | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Low | None |
| 165 | Batch processing | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | UploadPicker (shared) |
| 166 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Chat Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 167 | Conversation persistence | Baseline had in-memory only | ❌ Missing | **P1** | Create new | Medium | localStorage or backend |
| 168 | Conversation rename/delete | Baseline had no management | ❌ Missing | **P2** | Enhance existing | Low | None |
| 169 | Streaming response indicator | Baseline had no streaming | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 170 | Markdown rendering | Baseline had plain text | ❌ Missing | **P1** | Create new | Medium | None |
| 171 | Code syntax highlighting | Baseline had plain text | ❌ Missing | **P1** | Create new | Medium | None |
| 172 | Copy message button | Baseline had no copy | ❌ Missing | **P2** | Enhance existing | Low | None |
| 173 | Export conversation | Baseline had no export | ❌ Missing | **P2** | Create new | Low | None |
| 174 | Stop generation button | Baseline had no stop | ❌ Missing | **P1** | Enhance existing | Low | AbortController |
| 175 | Conversation sidebar/list | Baseline had no sidebar | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 176 | Provider-branded model selector | `modelSelectorUI.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: Lip Sync Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 177 | Audio waveform preview | Baseline had native `<audio>` only | ❌ Missing | **P1** | Create new | Medium | None |
| 178 | Lip sync timing adjustment | Baseline had no timing controls | ❌ Missing | **P2** | Create new | High | None |
| 179 | Phoneme-level editing | Baseline had no phoneme editor | ❌ Missing | **P3** | Create new | Very High | None |
| 180 | Multiple voice selection | Baseline had audio upload only | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 181 | Background replacement for portrait | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 182 | Expression controls | Baseline had text prompt only | ❌ Missing | **P2** | Enhance existing | Low | None |
| 183 | Provider-branded model selector | `modelSelectorUI.js`, `updateModelBtnIcon()` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |

---

### STUDIO: AI Influencer Studio

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 184 | Style intensity/blend slider | Baseline had no slider | ❌ Missing | **P1** | Enhance existing | Low | None |
| 185 | Pose/angle controls | Baseline had no controls | ❌ Missing | **P1** | Create new | Medium | None |
| 186 | Background swap | Baseline had no controls | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 187 | Batch style variations | Never implemented | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 188 | Style favorites | Never implemented | ❌ Missing | **P3** | Create new | Low | localStorage (shared) |
| 189 | History sidebar | Image/Video Studio have one; Influencer does not | ❌ Missing | **P2** | Enhance existing | Medium | None |
| 190 | Character consistency (seed lock) | Never implemented | ❌ Missing | **P1** | Enhance existing | Low | None |
| 191 | Visual style preset previews | Thumbnails exist for effects but not influencer styles | ❌ Missing | **P2** | Create new | Medium | None |

---

### GLOBAL: Shared Infrastructure

| # | Feature | Historical Source | Current Status | Priority | Approach | Complexity | Protected Dependencies |
|---|---------|------------------|----------------|----------|----------|------------|------------------------|
| 192 | 6-tab Settings Modal (General, API, Audio, Video, Keyboard, Export) | `SettingsModal.jsx` baseline (6 tabs) | ❌ Current has only API key forms (vanilla) | **P1** | Enhance existing | High | Auth system (protected) — do NOT touch auth logic |
| 193 | 24-icon Sidebar navigation | `Sidebar.js` baseline (24 icon nav items) | ❌ Missing | **P1** | Enhance existing | Medium | None |
| 194 | Template Studio (template-driven generation) | `TemplateStudio.js`, `templateEngine.js`, `templateSpecs.js` baseline | ❌ Completely missing from current | **P0** | Create new | Very High | `templateEngine.js` (may exist in lib) |
| 195 | Thumbnail Studio (5-step: Brief → Generate → Refine → Text Overlay → Saved) | `ThumbnailStudio.js`, `TemplateThumbnailModal.jsx` (1,598 lines) baseline | 🔶 Partial — `StudioThumbnailModal.jsx` exists as modal, not full studio | **P1** | Enhance existing | High | None |
| 196 | Model selector library restore | `modelSelectorUI.js` — used by ALL studios at baseline | ❌ Removed from all studios | **P0** | Enhance existing | High | `models.js` (protected) |
| 197 | GTM thumbnail bridge | `gtmThumbnailBridge.js` baseline | ❌ Removed from all studios | **P1** | Enhance existing | Low | GTMPromptModal (shared) |
| 198 | GTM context store | `gtmContextStore.js` baseline | ❌ Removed | **P2** | Enhance existing | Low | None |
| 199 | Template Gallery with search/filter | `TemplatesPage.js` baseline (254 templates) | 🔶 Route exists but may be non-functional | **P1** | Enhance existing | Medium | None |
| 200 | ExplorePage: 12 curated prompts | `ExplorePage.js` baseline | ✅ Present | ➖ | Keep | — | — |
| 201 | Project save/load system | Never fully implemented | ❌ Missing | **P1** | Create new | Very High | Backend API (new) |
| 202 | Undo/redo global pattern | Storyboard baseline only | ❌ Missing globally | **P1** | Create new | High | None |
| 203 | Keyboard shortcuts global | SettingsModal baseline only | ❌ Missing globally | **P2** | Create new | Low | None |
| 204 | Before/after comparison (global) | Storyboard + Effects baseline | ❌ Missing globally | **P2** | Create new | Medium | None |
| 205 | Loading/progress indicator (global) | Baseline had better states | 🔶 Partial — all studios need improvement | **P0** | Enhance existing | Low | None |
| 206 | Inline error states (global) | Baseline: red error + button reset | ❌ Missing — all studios use `alert()` | **P0** | Enhance existing | Low | None |
| 207 | Skeleton loaders (global) | Baseline had `thumb-skeleton` | ❌ Missing | **P2** | Enhance existing | Low | None |
| 208 | Batch processing framework | ImageStudio has batch count (unused) | ❌ Missing framework | **P2** | Create new | Medium | None |
| 209 | Streaming generation feedback | GTM Boost baseline had streaming | 🔶 Partial | **P1** | Enhance existing | Medium | None |
| 210 | Video-to-Video as functional studio | `VideoToVideoPage.js` baseline was full studio | ❌ Current is static placeholder (149 lines) | **P0** | Create new | High | `models.js` (protected) |
| 211 | Cinema Template Studio | `CinemaTemplateStudio.js` baseline | ❌ Completely missing | **P2** | Create new | Medium | None |
| 212 | AI VFX page | `AIVFXPage.js` baseline | ❌ Missing | **P3** | Create new | Medium | None |
| 213 | Video Agent page | `VideoAgentPage.js` baseline | 🔶 Route exists (`/video-agent`) | P3 (protected) | Protected — do NOT modify | — | Protected system |
| 214 | Assist page | `AssistPage.js` baseline | 🔶 Route exists (`/assist`) | P3 (protected) | Protected — do NOT modify | — | Protected system |
| 215 | Render page | `RenderPage.js` baseline | 🔶 Route exists (`/render`) | P3 (protected) | Protected — do NOT modify | — | Protected system |
| 216 | Director page agent configuration | Baseline had agent detail/chain UI | 🔶 Partial — 45 agent cards, no config | **P2** | Enhance existing | High | `/director` (protected) — do NOT modify route |
| 217 | Audio waveform visualization | Baseline had native audio only | ❌ Missing | **P1** | Create new | Medium | None |
| 218 | Conversation history (Chat) | Baseline had in-memory only | ❌ Missing | **P1** | Create new | Medium | localStorage or backend |
| 219 | Effect descriptions/details | Never shown (only names) | ❌ Missing | **P2** | Enhance existing | Low | None |

---

## Phased Implementation Plan

### PHASE 1: Shared Components and Infrastructure

**Goal:** Restore the foundational libraries and shared UI components that all studios depend on.

**Prerequisites:** None — this is the foundation.

| Task | Features | Priority | Complexity |
|------|----------|----------|------------|
| 1.1 | Restore `modelSelectorUI.js` — provider-aware split-pane dropdown with sidebar, search, model list, provider logos (#196) | **P0** | High |
| 1.2 | Fix `models.js` — re-add `provider`, `provider_name` fields to model definitions (#196 dep) | **P0** | Medium |
| 1.3 | Restore GTM thumbnail bridge — `subscribeToGtmThumbnails` cross-studio sync (#197) | **P1** | Low |
| 1.4 | Restore GTM context store — `getGtmContext` / `setGtmContext` (#198) | **P2** | Low |
| 1.5 | Create `gtmResponses.js` — GTM prompt generation via OpenAI Responses API | **P1** | Medium |
| 1.6 | Create `gtmContentLibrary.js` — roles, industries, methodologies, tonalities | **P1** | Low |
| 1.7 | Restore `thumbnailPresets.js` — preset system for thumbnails | **P2** | Low |
| 1.8 | Build shared `LoadingOverlay` component — progress indicator + cancel button (#205, #206) | **P0** | Low |
| 1.9 | Build shared `InlineError` component — replaces bare `alert()` in all studios (#206) | **P0** | Low |
| 1.10 | Build shared `BeforeAfterSlider` component (#204) | **P2** | Medium |
| 1.11 | Build shared `ModelSelectorDropdown` wrapper — standardized across all studios | **P0** | Medium |
| 1.12 | Create `editor/` directory — `TimelineState.js`, `dragDrop.js` skeleton (#1, #2) | **P0** | High |
| 1.13 | Restore `useTimelineStore.jsx` — React timeline state with localStorage persistence | **P0** | Medium |
| 1.14 | Build `UndoRedo` mixin/utility — reusable across studios (#202) | **P1** | Medium |
| 1.15 | Build `BatchProcessor` utility — framework for batch generation across studios (#208) | **P2** | Medium |
| 1.16 | Restore `PROVIDER_LOGOS` map and `getProviderStyle()` utility | **P0** | Low |

**Phase 1 Deliverables:**
- `src/lib/modelSelectorUI.js` (restored)
- `src/lib/gtmThumbnailBridge.js` (restored)
- `src/lib/gtmContextStore.js` (restored)
- `src/lib/gtmResponses.js` (new)
- `src/lib/gtmContentLibrary.js` (new)
- `src/lib/thumbnailPresets.js` (restored)
- `src/components/shared/LoadingOverlay.jsx`
- `src/components/shared/InlineError.jsx`
- `src/components/shared/BeforeAfterSlider.jsx`
- `src/components/shared/ModelSelectorDropdown.jsx`
- `src/editor/TimelineState.js` (restored)
- `src/editor/dragDrop.js` (restored)
- `src/hooks/useTimelineStore.jsx` (restored)
- `src/lib/undoRedo.js` (new)
- `src/lib/batchProcessor.js` (new)

---

### PHASE 2: High-Priority Studio Enhancements (P0)

**Goal:** Restore the most critical missing functionality that blocks core user workflows.

**Dependencies:** Phase 1 must be complete. `modelSelectorUI.js` must be restored before studio work.

| Task | Studio | Features | Complexity |
|------|--------|----------|------------|
| 2.1 | Timeline | Restore clip drag-and-drop, resize, split/trim (#1, #2, #3, #10) | Very High |
| 2.2 | Timeline | Restore multi-track editing with mute/solo/lock (#3) | High |
| 2.3 | Edit Studio | Restore per-tool parameter panels — AI Edit (33 models), Reframe (AR, speed, style, count), Watermark (pos/opacity/scale), Face Swap (target index) (#17-26) | High |
| 2.4 | Edit Studio | Restore dynamic schema-driven controls from `models.js` inputs (#19) | High |
| 2.5 | Edit Studio | Fix blob URL memory management + preview onerror (#27, #28) | Low |
| 2.6 | Edit Studio | Restore no-result error state in result area (#29) | Low |
| 2.7 | Effects Studio | Restore effect intensity/strength slider (#36) | Medium |
| 2.8 | Effects Studio | Restore effect chaining / layers with blend modes (#37) | High |
| 2.9 | Image Studio | Fix duplicate DOM append bug (#61) | Low |
| 2.10 | Image Studio | Add loading/progress indicator during generation (#56) | Low |
| 2.11 | Image Studio | Add inline error state in canvas area (#58) | Low |
| 2.12 | Video Studio | Add loading/progress indicator (#78) | Low |
| 2.13 | Video Studio | Add inline error state (#79) | Low |
| 2.14 | Audio Studio | Restore voice selection for TTS models (#126) | Medium |
| 2.15 | Audio Studio | Restore TTS-specific generation path (`text`, `speed`, `voice` params) (#127) | Medium |
| 2.16 | Storyboard Studio | Add frame deletion (#87) | Low |
| 2.17 | Storyboard Studio | Remove hardcoded 3-frame limit, add dynamic frame management (#92) | Low |
| 2.18 | Cinema Studio | Add direct generation button (stay in Cinema, don't route to Video) (#94) | Medium |
| 2.19 | Template Studio | Create new Template Studio — template-driven generation (#194) | Very High |
| 2.20 | Video-to-Video | Rebuild as functional studio with upload, prompt, model selector, generate (#210) | High |
| 2.21 | All Studios | Wire up `ModelSelectorDropdown` with provider sidebar (#196, #50, #65, etc.) | High |

**Phase 2 Deliverables:**
- `src/components/Timeline.js` — fully functional with drag-drop, resize, split, multi-track
- `src/editor/keyframeSystem.jsx` (restored)
- `src/editor/transitionEditor.js` (restored)
- `src/editor/subtitleTimeline.js` (restored)
- `src/components/EditStudio.js` — restored with per-tool controls
- `src/components/EffectsStudio.js` — restored with intensity slider + chaining
- `src/components/ImageStudio.js` — bug fixes + error/loading states
- `src/components/VideoStudio.js` — error/loading states
- `src/components/AudioStudio.js` — restored TTS path + voice selection
- `src/components/StoryboardStudio.js` — frame deletion + dynamic frames
- `src/components/CinemaStudio.js` — direct generation button
- `src/components/TemplateStudio.js` (new)
- `src/components/VideoToVideoPage.js` — rebuilt as functional studio
- All studios wired with `ModelSelectorDropdown`

---

### PHASE 3: Medium-Priority Enhancements (P1)

**Goal:** Implement useful advanced functionality that significantly improves UX and enables new workflows.

**Dependencies:** Phase 1 complete. Phase 2 studio work in progress.

| Task | Studio | Features | Complexity |
|------|--------|----------|------------|
| 3.1 | Settings Modal | Restore 6-tab Settings Modal — General, API, Audio, Video, Keyboard, Export (#192) | High |
| 3.2 | Sidebar | Restore 24-icon Sidebar navigation (#193) | Medium |
| 3.3 | Template Gallery | Fix TemplatesPage — search, category/niche filters, thumbnail grid (#199) | Medium |
| 3.4 | Thumbnail Studio | Enhance `StudioThumbnailModal` → full studio with 5-step flow (#195) | High |
| 3.5 | Project System | Create project save/load framework (#201) | Very High |
| 3.6 | Edit Studio | Add GTM Boost wiring to all edit tools (#35) | Low |
| 3.7 | Edit Studio | Add batch processing (#33) | Medium |
| 3.8 | Edit Studio | Add before/after comparison (#32) | Medium |
| 3.9 | Effects Studio | Restore keyframe animation system (#38) | High |
| 3.10 | Effects Studio | Restore before/after comparison slider (#39) | Medium |
| 3.11 | Effects Studio | Restore advanced parameter controls (guidance, steps, seed, denoise, CFG) (#40) | Medium |
| 3.12 | Effects Studio | Restore AbortController / cancel generation (#43) | Low |
| 3.13 | Image Studio | Add batch result grid (#54) | Medium |
| 3.14 | Image Studio | Add cancellation mechanism (#57) | Medium |
| 3.15 | Video Studio | Add camera motion controls (from Cinema Studio patterns) (#67) | Medium |
| 3.16 | Video Studio | Add motion strength slider (#68) | Medium |
| 3.17 | Video Studio | Add last frame upload for I2V (#69) | Low |
| 3.18 | Video Studio | Add style/look presets, guidance scale (#71, #72) | Low |
| 3.19 | Video Studio | Add batch video generation (#70) | Medium |
| 3.20 | Storyboard Studio | Restore undo/redo (#80) | Medium |
| 3.21 | Storyboard Studio | Restore cloud save/load (Supabase or equivalent) (#81) | High |
| 3.22 | Storyboard Studio | Restore frame comparison mode (#82) | Medium |
| 3.23 | Storyboard Studio | Restore timeline duration strip + per-frame durations (#83, #84) | Medium |
| 3.24 | Storyboard Studio | Restore per-frame reference images (#85) | Medium |
| 3.25 | Storyboard Studio | Add frame duplication (#86) | Low |
| 3.26 | Storyboard Studio | Restore autosave with persistence (#90) | Low |
| 3.27 | Cinema Studio | Add shot sequence / multi-shot planning (#95) | High |
| 3.28 | Cinema Studio | Add storyboard integration (#96) | Medium |
| 3.29 | Audio Studio | Add waveform preview (#131) | Medium |
| 3.30 | Audio Studio | Restore music-specific generation path (#128) | Medium |
| 3.31 | Audio Studio | Add speed/pitch controls (#129) | Low |
| 3.32 | Character Studio | Add expression strength/intensity (#110) | Low |
| 3.33 | Character Studio | Add multiple reference images (#111) | Medium |
| 3.34 | Character Studio | Add seed lock for consistency (#112) | Low |
| 3.35 | Character Studio | Add save button to character library (#113) | Low |
| 3.36 | Chat Studio | Add conversation persistence (#167) | Medium |
| 3.37 | Chat Studio | Add streaming response indicator (#169) | Medium |
| 3.38 | Chat Studio | Add markdown rendering + code highlighting (#170, #171) | Medium |
| 3.39 | Chat Studio | Add stop generation button (#174) | Low |
| 3.40 | Director Page | Add agent detail/configuration panel (do NOT modify route) (#216) | High |
| 3.41 | Upscale Studio | Add denoise level, face enhancement (#103, #104) | Low |
| 3.42 | Upscale Studio | Add before/after comparison (#106) | Medium |
| 3.43 | Upscale Studio | Add batch upscale (#107) | Medium |
| 3.44 | All Studios | Add GTM thumbnail bridge wiring (#197) | Low |
| 3.45 | All Studios | Add streaming generation feedback in GTM Boost | Medium |

**Phase 3 Deliverables:**
- `src/components/modals/SettingsModal.jsx` (restored 6-tab version)
- `src/components/Sidebar.js` (restored 24-icon nav)
- `src/components/TemplatesPage.js` (functional)
- `src/components/ThumbnailStudio.js` (new, 5-step flow)
- `src/lib/projectStore.js` (new)
- Batch processing across Image, Video, Upscale studios
- Undo/redo in Storyboard, Edit, Effects
- Camera/motion controls in Video Studio
- Waveform in Audio Studio
- Conversation persistence in Chat Studio
- Agent configuration in Director page

---

### PHASE 4: Nice-to-Have Enhancements (P2)

**Goal:** Polish, consistency, and quality-of-life improvements.

**Dependencies:** Phases 1-3 complete.

| Task | Studio | Features | Complexity |
|------|--------|----------|------------|
| 4.1 | Global | Add keyboard shortcuts framework (#203) | Low |
| 4.2 | Global | Add skeleton loaders (#207) | Low |
| 4.3 | Global | Add undo/redo pattern to all studios | Medium |
| 4.4 | Global | Add before/after comparison to all result areas | Medium |
| 4.5 | Image Studio | Add provider logo display in model button (#51) | Low |
| 4.6 | Image Studio | Restore GTM context restoration (#53) | Low |
| 4.7 | Image Studio | Add variations result display (#55) | Medium |
| 4.8 | Image Studio | Add history delete button (#63) | Low |
| 4.9 | Video Studio | Add quick starters / prompt templates (#73) | Low |
| 4.10 | Video Studio | Add frame-by-frame preview (#74) | Medium |
| 4.11 | Video Studio | Add video history scrubber (#76) | Low |
| 4.12 | Cinema Studio | Save/load cinematic presets (#97) | Low |
| 4.13 | Cinema Studio | Cinematic look preview (#98) | Medium |
| 4.14 | Cinema Studio | Deduplicate camera builder vs overlay (#99) | Low |
| 4.15 | Cinema Studio | Shot duration control per scene (#100) | Low |
| 4.16 | Storyboard Studio | Add keyboard shortcuts (#88) | Low |
| 4.17 | Storyboard Studio | Add GTM thumbnail bridge (#89) | Low |
| 4.18 | Effects Studio | Add effect presets (save/load) (#46) | Medium |
| 4.19 | Effects Studio | Add effect descriptions/details (#47) | Low |
| 4.20 | Effects Studio | Add asset library integration (#45) | Medium |
| 4.21 | Upscale Studio | Add color correction options (#105) | Low |
| 4.22 | Upscale Studio | Add batch upscale (#107) | Medium |
| 4.23 | Character Studio | Add pose/angle controls (#114) | Medium |
| 4.24 | Character Studio | Add outfit/style reference upload (#115) | Medium |
| 4.25 | Character Studio | Add avatar library (full CRUD) (#145) | Medium |
| 4.26 | Commercial Studio | Add angle/composition controls (#120) | Low |
| 4.27 | Commercial Studio | Add text overlay on product (#121) | Medium |
| 4.28 | Commercial Studio | Add brand color input (#122) | Low |
| 4.29 | Chat Studio | Add conversation rename/delete (#168) | Low |
| 4.30 | Chat Studio | Add copy message button (#172) | Low |
| 4.31 | Chat Studio | Add export conversation (#173) | Low |
| 4.32 | Chat Studio | Add conversation sidebar/list (#175) | Medium |
| 4.33 | Chat Studio | Add provider-branded model selector | Low |
| 4.34 | Audio Studio | Add tone/emotion controls (#130) | Low |
| 4.35 | Audio Studio | Add audio editor (trim, fade) (#132) | High |
| 4.36 | Audio Studio | Restore SettingsModal Audio/Export tabs (#138, #139) | Medium |
| 4.37 | Avatar Studio | Add avatar customization panel (#141) | High |
| 4.38 | Avatar Studio | Add avatar library (#145) | Medium |
| 4.39 | Avatar Studio | Add script/dialogue editor (#147) | Medium |
| 4.40 | Training Studio | Add validation split (#154) | Low |
| 4.41 | Training Studio | Add resume training (#155) | Medium |
| 4.42 | Training Studio | Add LoRA metadata output (#156) | Low |
| 4.43 | Training Studio | Add training presets (#159) | Low |
| 4.44 | Video Tools | Add quality/bitrate controls (#164) | Low |
| 4.45 | Video Tools | Add batch processing (#165) | Medium |
| 4.46 | Influencer Studio | Add style intensity/blend slider (#184) | Low |
| 4.47 | Influencer Studio | Add history sidebar (#189) | Medium |
| 4.48 | Influencer Studio | Add character consistency (seed lock) (#190) | Low |
| 4.49 | Influencer Studio | Add visual style preset previews | Medium |
| 4.50 | Director Page | Add agent chaining/workflows (do NOT modify route) | High |
| 4.51 | Director Page | Add agent history (do NOT modify route) | Medium |
| 4.52 | Global | Restore `openaiConfig.js` per-studio color schemes | Low |

---

### PHASE 5: Deprecated / Low-Value Features (P3)

**Goal:** De-prioritize or remove features that are no longer viable.

| Feature | Reason | Action |
|---------|--------|--------|
| Phoneme-level editing (Lip Sync) | Very high complexity, niche use case | Defer indefinitely |
| Multi-speaker support (Avatar) | Very high complexity, niche use case | Defer indefinitely |
| Voice cloning (Audio) | Very high complexity, privacy concerns | Defer indefinitely |
| BGM mixing / Stem separation (Audio) | Very high complexity | Defer indefinitely |
| Multi-product composition (Commercial) | Very high complexity, niche use case | Defer indefinitely |
| Style favorites (Influencer) | Low value, easy to add later | Defer |
| Save to project / Favorites (Image) | Depends on project system (P1) | Defer until project system exists |
| Age/gender controls (Character) | Low value | Defer |
| A/B variant generation (Commercial) | Low value | Defer |
| AI VFX page | Not in current router, unclear viability | Evaluate separately |
| Video Agent / Assist / Render routes | Protected systems — do NOT modify | Protected |
| Undo/redo for effect chain | Never fully implemented in baseline | Defer |

---

## Dependency Graph

```
PHASE 1: Shared Infrastructure
├── 1.1 modelSelectorUI.js ──────┐
├── 1.2 models.js provider fields ─┤
├── 1.8 LoadingOverlay ──────────┤
├── 1.9 InlineError ─────────────┤
├── 1.12 TimelineState.js ───────┤
├── 1.13 useTimelineStore.jsx ───┤
│                                 │
│     ┌───────────────────────────┘
│     │
│     ▼
PHASE 2: P0 Studio Enhancements
├── 2.1 Timeline drag-drop ← 1.12, 1.13
├── 2.3 Edit Studio per-tool controls ← 1.1 (modelSelectorUI)
├── 2.7 Effects intensity ← 1.9 (InlineError)
├── 2.8 Effects chaining ← 1.8 (LoadingOverlay)
├── 2.18 Cinema direct generation
├── 2.19 Template Studio ← 1.1, 1.5, 1.6
├── 2.20 Video-to-Video rebuild ← 1.1
└── 2.21 All studios ModelSelectorDropdown ← 1.1
        │
        ▼
PHASE 3: P1 Medium Enhancements
├── 3.1 Settings Modal 6-tab
├── 3.2 Sidebar 24-icon nav
├── 3.5 Project system
├── 3.9 Effects keyframes ← 2.8 (chaining)
├── 3.20 Storyboard undo/redo ← 1.14 (UndoRedo)
├── 3.27 Cinema shot sequence
├── 3.36 Chat conversation persistence
└── ... (45 tasks)
        │
        ▼
PHASE 4: P2 Nice-to-Have
└── ... (50 tasks)
```

---

## Protected System Dependencies

**DO NOT MODIFY THESE SYSTEMS.** They are outside the scope of this recovery plan:

| System | Route/File | Reason |
|--------|-----------|--------|
| Director | `/director`, `DirectorPage.js` | Protected — agent orchestration system |
| Video Agent | `/video-agent`, `VideoAgentPage.js` | Protected — agent execution system |
| Render | `/render`, `RenderPage.js` | Protected — render queue management |
| Assist | `/assist`, `AssistPage.js` | Protected — AI assistant system |
| muapi.js | `src/lib/muapi.js` | Protected — API client (read-only access) |
| models.js | `src/lib/models.js` | Protected — model catalog (read-only access; add `provider` fields) |
| apiKeyManager.js | `src/lib/apiKeyManager.js` | Protected — key management |
| Clerk entitlements | `src/lib/clerkEntitlements.js` | Protected — auth system |
| AuthModal | `src/components/AuthModal.js` | Protected — auth flow |
| UploadPicker | `src/components/UploadPicker.js` | Shared — use but do not refactor |
| StudioThumbnailModal | `src/components/modals/StudioThumbnailModal.jsx` | Shared — use but do not refactor |
| GTMPromptModal | `src/components/modals/GTMPromptModal.jsx` | Shared — use but do not refactor |
| BaseComponent | `src/components/base/Component.js` | Shared — use but do not refactor |
| BaseStore | `src/stores/base/Store.js` | Shared — use but do not refactor |

**Note on `models.js`:** While `models.js` is protected from structural changes, adding `provider` and `provider_name` fields to model definitions is necessary to restore the model selector UI. This is a data addition, not a structural change.

---

## Critical Path

The fastest path to maximum user value:

```
Week 1: Phase 1.1-1.4, 1.8-1.11, 1.16
  → Restore model selector, loading/error states, provider logos
  → All 19 studios immediately get better model selection

Week 2: Phase 1.12-1.15, 2.1-2.4
  → Restore Timeline drag-drop, Edit Studio per-tool controls
  → Two most degraded studios restored

Week 3: Phase 2.7-2.10, 2.14-2.18, 2.20
  → Effects chaining, error states, Audio TTS, Cinema direct gen, V2V rebuild
  → 5 more studios significantly improved

Week 4-5: Phase 2.19 (Template Studio), Phase 3.1-3.5
  → Template Studio (very high value but very high complexity)
  → Settings Modal, Sidebar, Template Gallery

Week 6+: Phase 3 remainder, Phase 4
  → Remaining P1 features, then P2 polish
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `models.js` schema changes break existing studios | Medium | High | Read-only access; add fields, don't change structure |
| Timeline restore conflicts with existing `/timeline` route | Medium | High | Extend existing `Timeline.js`, don't replace |
| Model selector UI changes affect all 19 studios simultaneously | High | Medium | Roll out to 2 pilot studios first (Image, Video) |
| Audio TTS path change breaks existing music generation | Medium | Medium | Feature-flag the TTS path; A/B test |
| Supabase cloud sync for Storyboard requires new backend | Medium | Medium | Start with localStorage-only; add cloud later |
| Template Studio is very high complexity — scope creep | High | High | Strict MVP: template select → form → generate → output tabs only |
| Effects chaining requires new state management | Medium | Medium | Use existing Store class pattern |
| Director page modifications blocked by protected status | Low | Low | Agent config UI in separate component, not route modification |

---

## Estimated Effort Summary

| Phase | Task Count | Estimated Complexity |
|-------|------------|---------------------|
| Phase 1: Shared Infrastructure | 16 tasks | 3 Very High, 5 High, 6 Medium, 2 Low |
| Phase 2: P0 Enhancements | 21 tasks | 5 Very High, 9 High, 5 Medium, 2 Low |
| Phase 3: P1 Enhancements | 45 tasks | 3 Very High, 12 High, 20 Medium, 10 Low |
| Phase 4: P2 Enhancements | 50 tasks | 0 Very High, 5 High, 15 Medium, 30 Low |
| Phase 5: P3 (Deferred) | 11 features | Deferred |
| **Total** | **132 tasks** | **11 Very High, 31 High, 46 Medium, 44 Low** |

---

## Appendix: Studios Ranked by Recovery Urgency

| Rank | Studio | Baseline → Current | Primary Gap | Priority |
|------|--------|-------------------|-------------|----------|
| 1 | Timeline | 6946 → 344 lines (−95%) | Full NLE removed | **P0** |
| 2 | Edit Studio | 649 → 262 lines (−60%) | All tool controls removed | **P0** |
| 3 | Effects Studio | 1358 → 501 lines (−63%) | Animation/chaining removed | **P0** |
| 4 | Template Studio | Present → Missing | Entire studio missing | **P0** |
| 5 | Video-to-Video | Functional → Placeholder | Studio replaced with static page | **P0** |
| 6 | Storyboard Studio | 1351 → 910 lines (−33%) | Undo/redo, cloud sync, comparison removed | **P0/P1** |
| 7 | Audio Studio | Functional → Simplified | TTS path broken, voice selection removed | **P0** |
| 8 | All Studios | Model selector degraded | Provider sidebar removed everywhere | **P0/P1** |
| 9 | Settings | 6 tabs → 1 tab | All tabs except API removed | **P1** |
| 10 | Cinema Studio | 1141 → 1117 lines (−2%) | No direct generation | **P1** |
| 11 | Video Studio | 1429 → 1326 lines (−7%) | No camera/motion controls | **P1** |
| 12 | Chat Studio | 330 → 304 lines (−8%) | No persistence, no streaming | **P1** |
| 13 | Image Studio | 1257 → 1202 lines (−4%) | Model selector simplified | **P1** |
| 14 | Upscale Suite | 269 → 184 lines (−32%) | Minimal parameters | **P1** |
| 15 | Character Studio | 384 → 297 lines (−23%) | No expression intensity | **P1** |
| 16 | Commercial Studio | 334 → 235 lines (−30%) | No lighting/background controls | **P1** |
| 17 | Video Tools | ~230 → ~230 lines | No tool-specific params | **P1** |
| 18 | Avatar Studio | ~262 → ~262 lines | No customization | **P1** |
| 19 | Training Studio | ~267 → ~267 lines | No training progress | **P1** |
| 20 | AI Influencer | ~233 → ~233 lines | No history, no intensity | **P2** |
| 21 | Lip Sync | ~848 → ~848 lines | No waveform, no timing | **P2** |
| 22 | Director Page | Functional | No agent config UI | **P2** |

---

*End of UIUX Recovery Implementation Plan*
*Generated by SUB-AGENT 23: IMPLEMENTATION ORCHESTRATOR*
*Synthesized from 11 audit reports covering 19 studios and shared infrastructure*
