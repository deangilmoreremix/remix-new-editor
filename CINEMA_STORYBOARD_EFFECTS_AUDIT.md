# CINEMA_STORYBOARD_EFFECTS_AUDIT.md
**Date:** 2026-08-11
**Working Directory:** `/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery`
**Baseline Commit:** `afad812a22d9f6f470222a99136b7cd651f61a89`
**Current HEAD:** `7a8fb1a0` (develop)
**Auditor:** SUB-AGENT 3 — CINEMA, STORYBOARD, EFFECTS FORENSICS

---

## CINEMA STUDIO

### Component
- **File:** `src/components/CinemaStudio.js`
- **Baseline lines:** 1141
- **Current lines:** 1117
- **Change:** −24 lines (net)

### What Changed (afad812a → HEAD)
1. **Model selector simplified** — Removed provider sidebar (`PROVIDER_LOGOS`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList`). Replaced branded provider icons with a generic "V" icon.
2. **GTM thumbnail bridge removed** — `subscribeToGtmThumbnails` import and subscription removed.
3. **`selectedProvider` state removed** — No longer tracks provider filter.
4. **Model button icon simplified** — No longer shows provider logos or branded initials; always shows "V".

### What's Missing from Current vs Historical
The historical audit (`HISTORICAL_UIUX_AUDIT.md` §3) identified these gaps in Cinema Studio 2.0, and **all remain unresolved**:

| Missing Feature | Severity | Notes |
|---|---|---|
| No direct generation from Cinema Studio | High | Always routes to Video Studio; no "Shoot" button that stays in Cinema |
| No timeline or shot sequence | High | Cannot arrange multiple shots in sequence |
| No storyboard integration | Medium | Cannot link to Storyboard Studio frames |
| No preview of cinematic look | Medium | No visual preview of film look / camera movement before generation |
| No save/load of cinematic presets | Medium | Cannot persist and reuse camera + lens + movement + look combinations |
| Camera builder and overlay are redundant | Medium | Two separate UIs (collapsible builder + full-screen overlay) control the same settings |
| No shot duration control per scene | Medium | Duration is inherited from model defaults only |
| No B-roll / multi-shot planning | Medium | Single-shot generation only |

### Protected Systems (Do NOT Touch)
- Director (`/director`)
- Video Agent (`/video-agent`)
- Timeline (`/timeline`)
- Render (`/render`)

### Protected Systems Status
These are separate route-level pages and are **not modified** by Cinema Studio. Cinema Studio is a standalone generation studio that feeds prompts to the Video Studio generation pipeline.

---

## STORYBOARD STUDIO

### Component
- **File:** `src/components/StoryboardStudio.js`
- **Baseline lines:** 1351
- **Current lines:** 910
- **Change:** −441 lines (significant feature removal)

### What Changed (afad812a → HEAD)
1. **Undo/Redo system removed** — `createUndoRedo()` function, undo/redo buttons, and Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts all removed.
2. **Autosave removed** — `createAutosave`, `scheduleDraftSave` replaces `autosave.schedule(getStoryboardState())` but is a simpler inline debounced save without the persistence layer.
3. **Supabase cloud persistence removed** — `saveProject`, `loadProjectFromStorage`, `setSupabaseClient`, `supabaseAvailable`, and all Supabase import logic removed. Save/load now uses only local `/api/storyboard/` endpoint.
4. **Comparison mode removed** — Full comparison overlay (`comparisonOverlay`, `openComparison`, `closeComparison`, `renderComparison`, `compareIndices`, `compareBtn`) removed.
5. **Timeline strip removed** — `timelineStrip`, `renderTimelineStrip()`, `frameDurations`, shot abbreviation map, duration-based segment widths, and total duration label all removed.
6. **Frame duration controls removed** — `frameDurations` array and per-frame duration editing removed.
7. **Provider-branded model selector removed** — `PROVIDER_LOGOS`, `invertLogos`, `getProviderStyle`, `getAvailableProviders`, `filterModels`, `renderProviderSidebar`, `renderSearchBar`, `renderModelList` all removed. Model dropdown now uses simple search-only list.
8. **Per-frame reference images removed** — `createUploadPicker` per-frame reference upload with thumbnail preview and remove button replaced with a non-functional "📎 Reference" text button.
9. **GTM thumbnail bridge removed** — `subscribeToGtmThumbnails` removed.
10. **`buildNanoBananaPrompt` removed** — Prompt construction simplified to string concatenation.
11. **`getStoryboardState()` removed** — No centralized state object for the studio.
12. **Keyboard shortcuts removed** — Escape for comparison close, Ctrl+S for save, Ctrl+Z/Y for undo/redo all removed.
13. **`ENHANCE_TAGS` import retained but unused** — Import still present but not used in current code.

### What's Missing from Current vs Historical
| Missing Feature | Severity | Notes |
|---|---|---|
| Undo/Redo | Medium | No way to recover from accidental frame edits or reorders |
| Autosave with persistence | Medium | `scheduleDraftSave` is a stub; no actual autosave implementation visible |
| Cloud save/load (Supabase) | High | Projects cannot be synced across devices or collaborators |
| Frame comparison mode | Medium | Cannot side-by-side compare two storyboard frames |
| Timeline duration strip | Medium | No visual representation of scene timing or total duration |
| Per-frame duration controls | Medium | Cannot set how long each shot lasts |
| Per-frame reference images | Medium | Reference button is non-functional placeholder |
| Provider-branded model selector | Low | Visual polish; model selection still works |
| Keyboard shortcuts | Low | Ctrl+Z, Ctrl+S, Escape no longer functional |
| GTM thumbnail bridge | Low | Cross-studio thumbnail sync removed |
| Frame duplication | Medium | No "Duplicate Frame" button; must manually copy content |
| Export to PDF | Low | Export PDF button exists and works (print-based) |
| Narration audio recording | Low | Never implemented; narration is text-only |

### Remaining Features (Current)
- 3 default frames with drag-to-reorder (HTML5 drag-and-drop)
- Layout selector (Horizontal, Grid, Story)
- Preset selector (7 shot presets)
- Style, Lighting, Color selectors
- Model/Aspect Ratio dropdowns
- GTM Boost per-frame and global
- Thumbnail generation
- Personalization trigger
- Batch generate all frames with retry logic
- Export to PDF (print-based)

---

## EFFECTS STUDIO

### Component
- **File:** `src/components/EffectsStudio.js`
- **Baseline lines:** 1358
- **Current lines:** 501
- **Change:** −857 lines (massive feature removal)

### What Changed (afad812a → HEAD)
1. **Advanced generation controls removed** — Entire advanced panel with:
   - Guidance scale slider (1–20)
   - Steps slider (1–50)
   - Seed input + randomize button
   - Negative prompt input
   - Effect strength slider (0–100%)
   - Denoise strength slider (0–1)
   - CFG scale slider
   - Advanced settings persistence to localStorage (`effects_studio_advanced_settings`)
   - Reset to defaults button
2. **Keyframe animation system removed** — `fxKeyframes`, `fxAnimatedProps`, `addAnimateToggle`, `buildKeyframeSegments`, `interpolateKeyframes`, `generateWithKeyframes` all removed.
3. **Effect layers/compositing removed** — `fxLayers`, `addEffectLayer`, `removeEffectLayer`, `renderLayersList`, `updateLayersPreview`, `EffectCompositor`, `generateWithLayers` all removed.
4. **Video segment stitching removed** — `stitchVideoSegments`, `MediaRecorder`-based video stitching, `generateWithKeyframes` all removed.
5. **Before/after comparison mode removed** — `comparisonMode`, `compareBtn`, `mobileCompareBtn`, `updateComparisonView`, comparison CSS styles, comparison overlay all removed.
6. **Output action buttons removed** — Download button, "Add to Library" button, "Insert into Timeline" button all removed.
7. **Asset library integration removed** — `saveGeneratedAsset`, `navigate('timeline', ...)`, `saveToLibrary` all removed.
8. **Effect parameter validation removed** — `validateEffectParams`, `EFFECT_PARAM_SCHEMA`, `createSliderControl`, `createAdvancedSection` all removed.
9. **AbortController/timeout generation removed** — No more `AbortController`, `timeoutId`, or `controller.signal` in API calls.
10. **Multiple generation paths collapsed** — `generateSingle`, `generateWithLayers`, `generateWithKeyframes`, `buildBaseParams`, `handleResult` all replaced with simple `handleGenerate`.
11. **Imports removed** — `navigate`, `saveGeneratedAsset`, `validateEffectParams`, `EFFECT_PARAM_SCHEMA`, `createSliderControl`, `createAdvancedSection`, `EffectCompositor`.
12. **Mobile compare toggle removed** — `mobileCompareBtn` removed from mobile controls.

### What's Missing from Current vs Historical
| Missing Feature | Severity | Notes |
|---|---|---|
| Effect intensity/strength slider | High | No way to control how strongly an effect is applied |
| Effect chaining / layers | High | Cannot stack multiple effects with blend modes |
| Keyframe animation | High | Cannot animate effect parameters over time |
| Before/after comparison slider | Medium | Cannot easily compare input vs output |
| Advanced parameter controls | Medium | No guidance scale, steps, seed, negative prompt, denoise, CFG |
| Effect presets | Medium | No save/load of favorite effect parameter combinations |
| Timeline integration | Medium | Cannot insert effect result directly into timeline |
| Asset library integration | Medium | Cannot save effect results to media library |
| Download button in output | Low | Output preview click-to-fullscreen exists, but no explicit download |
| Effect descriptions/details | Low | Only effect name shown; no description or parameter info |
| Undo/redo for effect chain | Low | Never fully implemented in current version either |
| Batch apply to multiple images | Low | Not present in either version |

### Remaining Features (Current)
- 6 effect category tabs (Image Effects, Nano Banana, Kontext Effects, AI Video Effects, Motion Controls, Video FX v2)
- 350+ effects via model enum
- Search filter
- Image/video upload (with UploadPicker)
- Optional prompt per effect
- Input/output split preview (desktop)
- Mobile-friendly stacked preview
- Fullscreen preview
- Thumbnail generation
- Personalization trigger
- History persistence (localStorage)

---

## SUMMARY

### Cinema Studio
- **Net change:** −24 lines (minor simplification of model selector)
- **Status:** Functionally similar to baseline; missing features remain the same as historical audit
- **Key gaps preserved:** No direct generation, no timeline, no storyboard integration, no presets

### Storyboard Studio
- **Net change:** −441 lines (massive simplification)
- **Status:** Significantly regressed — lost undo/redo, autosave, Supabase sync, comparison mode, timeline strip, frame durations, per-frame references, provider-branded selector
- **Key gaps introduced:** Cloud persistence, frame comparison, undo/redo, frame duplication, keyboard shortcuts

### Effects Studio
- **Net change:** −857 lines (most aggressive simplification)
- **Status:** Severely regressed — lost advanced controls, keyframe animation, effect layers/compositing, video stitching, comparison mode, timeline/library integration, asset management
- **Key gaps introduced:** Effect intensity, effect chaining, animation, before/after comparison, advanced parameters, timeline integration

### Cross-Cutting Concerns
1. **No undo/redo** in any of the three studios (baseline had it in Storyboard)
2. **No keyboard shortcuts** in any of the three studios
3. **No before/after comparison** in any of the three studios (baseline had it in Storyboard and Effects)
4. **Simplified model selectors** — all three studios lost provider sidebar branding
5. **No timeline integration** — Effects cannot insert into timeline; Storyboard lost its duration strip
6. **No cloud sync** — Storyboard lost Supabase persistence

---

*End of CINEMA_STORYBOARD_EFFECTS_AUDIT.md*
