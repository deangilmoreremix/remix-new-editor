# UPSTREAM CONTROL INVENTORY

**Source Repository:** `Anil-matcha/Open-Generative-AI`
**Clone Path:** `/tmp/open-generative-ai-upstream`
**Inventory Date:** 2026-08-11

---

## METHODOLOGY

Every control listed below is traceable to actual upstream source code in `Anil-matcha/Open-Generative-AI`. Controls are organized by studio and categorized by type. No README claims are used as proof.

---

## IMAGE STUDIO CONTROLS

**Source File:** `packages/studio/src/components/ImageStudio.jsx` (1,817 lines)
**Also:** `src/components/ImageStudio.js` (vanilla JS)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Model selector (T2I/I2I categories) | Dropdown/Popover | 585-860, 1569-1613 | Yes | `9dfc4e8` |
| Aspect ratio | Dropdown/Popover | 1617-1647 | Yes | `91ce11d` |
| Quality/Resolution | Dropdown/Popover | 1650-1682 | Yes | `91ce11d` |
| Effect type (I2I-only) | Dropdown/Popover | 1685-1720 | Yes | `c73a1cd` |
| Batch size | Stepper buttons (-/+) | 1722-1741 | No | `91ce11d` |
| Draw | Button | 1743-1756 | No | `de01d6d` |
| Reference image upload | Upload button + panel | 1531-1539, 66-551 | No | `9965718` |
| Swap face upload | Upload button + panel | 1543-1552 | Conditional on `swapField` | `c73a1cd` |
| Prompt textarea | Text input | 1556-1561 | No | `91ce11d` |
| Generate | Button | 1759-1774 | No | `91ce11d` |
| Negative prompt | Text input | — (schema-only, no UI) | Schema only | `e0efb74` |
| Seed | Text/number input | — (schema-only, no UI) | Schema only | `e0efb74` |
| Guidance scale | Slider | — (schema-only, no UI) | Schema only | `e0efb74` |
| Strength | Slider | — (hardcoded 0.6 in muapi.js) | Schema only | `e0efb74` |
| Image count (maxImages) | Enforced dynamically | 918, 1223, 1153 | Yes | `e5424a0` |
| First frame | Image upload | — (schema `images_list`) | Schema only | `e68e7f7d` |
| Last frame | Image upload | — (I2V only) | Schema only | `8cbaf7fc` |
| Multiple reference images | Multi-upload | 816-824 | Yes | `e68e7f7d` |
| Advanced settings | Panel | — (not rendered) | Schema-driven | `e0efb74` |

**Note:** Upstream ImageStudio does NOT render negative prompt, seed, guidance, or strength in the main UI. These exist in model schemas but are not surfaced. Strength is hardcoded to 0.6 in `muapi.js:72`.

---

## VIDEO STUDIO CONTROLS

**Source File:** `packages/studio/src/components/VideoStudio.jsx` (2,225 lines)
**Also:** `src/components/VideoStudio.js` (vanilla JS)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Mode selector (T2V/I2V/V2V) | Implicit (state-based) | 471-472 | No | `6eebebc9` |
| Model dropdown (25 providers) | Visual card selector | 119-444 | No | `9dfc4e8` |
| Category tabs (All/T2V/I2V/V2V) | Segmented buttons | 151-176, 370-388 | No | `9dfc4e8` |
| Provider sidebar | Logo buttons | 322-365 | No | `9dfc4e8` |
| Search input | Text input | 389-410 | No | `9dfc4e8` |
| Aspect ratio | Dropdown/Popover | 1963-2002 | Yes | `91ce11d` |
| Duration | Dropdown/Popover | 2057-2097 | Yes | `91ce11d` |
| Resolution | Dropdown/Popover | 2099-2139 | Yes | `91ce11d` |
| Quality | Dropdown/Popover | 2099-2139 | Yes | `91ce11d` |
| Mode (model-specific) | Dropdown/Popover | 659, 490 | Yes | `82215cb` |
| Effect type (I2V-only) | Dropdown/Popover | 2004-2055 | Yes | `c73a1cd` |
| Start frame / reference image | Upload + preview | 1620-1883 | No | `6eebebc9` |
| End frame / last frame | Upload + END badge | 983-1004, 1648-1651 | Yes (`lastImageField`) | `8cbaf7fc` |
| Multiple reference images | Multi-upload chips | 816-824, 1669-1687 | Yes (`maxImages`) | `e68e7f7d` |
| Draw reference button | Button | 2141-2161 | No | `0725694e` |
| Prompt textarea | Text input | 1887-1893 | No | `91ce11d` |
| Seedance 2.0 extend banner | Banner + button | 1897-1912, 1385-1397 | Yes (`requiresRequestId`) | `d707604` |
| Generate | Button | 2165-2181 | No | `91ce11d` |
| Drag & drop video | Drop zone | 900-912 | No | `fddc2ff` |

**Note:** VideoStudio does NOT expose FPS, guidance, steps, or seed in the UI. These are either not in the schema or not rendered.

---

## CINEMA STUDIO CONTROLS

**Source File:** `packages/studio/src/components/CinemaStudio.jsx` (48,650 bytes)
**Also:** `src/components/CinemaStudio.js` (27,815 bytes), `src/components/CameraControls.js` (11,155 bytes)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Camera | ScrollColumn (visual cards) | 492-498, 214-393 | No | `f9adf55` |
| Lens | ScrollColumn (visual cards) | 499-504, 214-393 | No | `f9adf55` |
| Focal Length | ScrollColumn (text-only) | 506-511, 214-393 | No | `f9adf55` |
| Aperture | ScrollColumn (visual cards) | 513-518, 214-393 | No | `f9adf55` |
| Aspect ratio | Dropdown button | 1135-1161 | Yes | `f9adf55` |
| Resolution | Dropdown button | 1163-1188 | Yes | `f9adf55` |
| Camera Builder | Collapsible panel (vanilla JS only) | 189-355 | No | `f9adf55` |
| Prompt textarea | Text input | 1121 | No | `f9adf55` |
| Reference image upload | File input | 1050-1118 | No | `f9adf55` |
| Generate (Shoot) | Button | 1205-1219 | No | `f9adf55` |

**Note:** The vanilla JS version (`CameraControls.js`) has the Camera Builder collapsible panel with 4 `<select>` dropdowns. The Next.js version (`CinemaStudio.jsx`) uses ScrollColumn visual selectors instead.

---

## AI INFLUENCER STUDIO CONTROLS

**Source File:** `packages/studio/src/components/AiInfluencerStudio.jsx` (788 lines)

| Control | Type | Lines | Options | Upstream Commit |
|---------|------|-------|---------|----------------|
| Face tab | Tab button | — | — | `5823f149` |
| Body tab | Tab button | — | — | `5823f149` |
| Style tab | Tab button | — | — | `5823f149` |
| Character Type | Visual image grid | 17-147 | 13 options (Human, Elf, Alien, etc.) | `5823f149` |
| Gender | Visual image grid | 17-147 | 5 options | `5823f149` |
| Ethnicity/Origin | Visual image grid | 17-147 | 6 options | `5823f149` |
| Eye Color | Visual image grid | 17-147 | 12 options | `5823f149` |
| Eye Type | Visual image grid | 17-147 | 3 options | `5823f149` |
| Eye Features | Visual image grid | 17-147 | 4 options | `5823f149` |
| Mouth & Teeth | Visual image grid | 17-147 | 7 options | `5823f149` |
| Ears | Visual image grid | 17-147 | 4 options | `5823f149` |
| Horns | Visual image grid | 17-147 | 3 options | `5823f149` |
| Skin Conditions | Visual image grid | 17-147 | 9 options | `5823f149` |
| Face Skin Material | Visual image grid | 148-238 | 6 options | `5823f149` |
| Skin Pattern | Visual image grid | 148-238 | 7 options | `5823f149` |
| Body Type | Visual image grid | 148-238 | 7 options | `5823f149` |
| Left Arm | Visual image grid | 148-238 | 6 options | `5823f149` |
| Right Arm | Visual image grid | 148-238 | 6 options | `5823f149` |
| Left Leg | Visual image grid | 148-238 | 6 options | `5823f149` |
| Right Leg | Visual image grid | 148-238 | 6 options | `5823f149` |
| Hair/Head Growth | Visual image grid | 239-279 | 8 options | `5823f149` |
| Accessories & Markings | Visual image grid | 239-279 | 5 options | `5823f149` |
| Rendering Style | Visual image grid | 239-279 | 4 options | `5823f149` |
| Shuffle (randomizer) | Button | 389-398 | — | `5823f149` |
| Aspect ratio | Button group | 461 | 3:4, 1:1, 9:16, 16:9 | `5823f149` |
| Generate | Button | — | — | `5823f149` |
| HoverPill preview | Hover tooltip | 304-335 | 72x72px image thumbnail | `cdce42a5` |
| Selected tags bar | Hoverable pills | 660-689 | Image thumbnails | `cdce42a5` |

**Total:** 20 subcategories, 118 options across 3 tabs.

---

## AUDIO STUDIO CONTROLS

**Source File:** `packages/studio/src/components/AudioStudio.jsx` (1,127 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Model selector | Custom dropdown | 712-752 | Yes | `a0864207` |
| Boolean toggles | Custom toggle switch | 793-818 | Yes | `a0864207` |
| Enum dropdowns | Custom dropdown | 821-873 | Yes | `a0864207` |
| Number sliders | Range input | 877-906 | Yes | `a0864207` |
| Text inputs | Standard input | 909-962 | Yes | `a0864207` |
| Textarea | Prompt textarea | 909-962 | Yes | `a0864207` |
| Prompt example chips | Clickable chips | 922-934 | Yes | `cda3208` |
| Audio file uploader | Upload button | 70-194 | No | `cda3208` |
| Audio list uploader | Multi-file upload | 199-228 | No | `cda3208` |
| Generate | Button | 970-989 | No | `cda3208` |
| Audio player | PremiumAudioPlayer | 233-473 | No | `cda3208` |

**Note:** SmartVideo AudioStudio.js has hardcoded controls (style, voice, tone, emotion, speed, pitch) instead of dynamic schema-driven controls.

---

## CLIPPING STUDIO CONTROLS

**Source File:** `packages/studio/src/components/ClippingStudio.jsx` (1,150 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Video upload | Upload button | — | No | `6aa3372` |
| num_highlights | Number input/dropdown | 219-221 | Yes | `6aa3372` |
| aspect_ratio | Dropdown | 219-221 | Yes | `6aa3372` |
| return_coordinates_only | Toggle | 219-221 | Yes | `6aa3372` |
| Generate (Run Clipping) | Button | 450-457 | No | `6aa3372` |

**Note:** ClippingStudio does NOT exist in SmartVideo.

---

## RECAST STUDIO CONTROLS

**Source File:** `packages/studio/src/components/RecastStudio.jsx` (1,222 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Video upload | MediaPickerButton | 42-155 | No | `6aa3372` |
| Image upload | MediaPickerButton | 42-155 | No | `6aa3372` |
| Model selector | Dropdown | 994-1024 | No | `6aa3372` |
| Aspect ratio | Dropdown | 1027-1056 | Yes | `6aa3372` |
| Character orientation | Dropdown | 1059-1094 | Model-specific | `6aa3372` |
| Assets Library | Dropdown with tabs | 160-311 | No | `6aa3372` |
| Prompt textarea | PromptComposer | 938-988 | No | `6aa3372` |
| Generate | Button | — | No | `6aa3372` |

**Note:** RecastStudio does NOT exist in SmartVideo.

---

## VIBE MOTION STUDIO CONTROLS

**Source File:** `packages/studio/src/components/VibeMotionStudio.jsx` (715 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Mode toggle (Generate/Edit) | Segmented control | 515-532 | No | `6aa3372` |
| Edit source picker | Dropdown | 647-689 | No | `6aa3372` |
| Aspect ratio | Dropdown | 585-613 | No | `6aa3372` |
| Duration | Dropdown | 616-644 | No | `6aa3372` |
| Prompt textarea | Text input | 558-570 | No | `6aa3372` |
| Generate/Remix | Button | — | No | `6aa3372` |

**Note:** VibeMotionStudio does NOT exist in SmartVideo.

---

## WORKFLOW STUDIO CONTROLS

**Source File:** `packages/studio/src/components/WorkflowStudio.jsx` (1,012 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| Templates tab | Tab button | 903-934 | No | `6aa3372` |
| My Workflows tab | Tab button | 903-934 | No | `6aa3372` |
| Community tab | Tab button | 903-934 | No | `6aa3372` |
| Playground sub-tab | Sub-tab | 478-509 | No | `6aa3372` |
| Full Workflow sub-tab | Sub-tab | 478-509 | No | `6aa3372` |
| Schema-driven form inputs | Dynamic fields | 590-651 | Yes | `6aa3372` |
| Rename modal | Modal | 968-1009 | No | `6aa3372` |
| Run/Execute button | Button | 413-447 | No | `6aa3372` |

**Note:** WorkflowStudio does NOT exist in SmartVideo.

---

## APPS STUDIO CONTROLS

**Source File:** `packages/studio/src/components/AppsStudio.jsx` (377 lines)

| Control | Type | Lines | Schema-Driven | Upstream Commit |
|---------|------|-------|---------------|-----------------|
| App card grid | Visual cards | 180-193 | No | `fe87f4a` |
| Get Template modal | Modal | 328-361 | No | `fe87f4a` |
| External repo link | Hover action | 230-248 | No | `fe87f4a` |
| External demo link | Hover action | 230-248 | No | `fe87f4a` |

**Note:** SmartVideo has `AppsHub.js` instead, with a different implementation.

---

## DRAW MODAL CONTROLS

**Source File:** `packages/studio/src/components/DrawModal.jsx` (68,477 bytes)

| Control | Type | Lines | Upstream Commit |
|---------|------|-------|----------------|
| Canvas tools (pointer, pencil, eraser, rect, arrow, text, image) | Tool buttons | 1326-1498 | `de01d6d` |
| Brush color presets | Color swatches | 62-71, 1502-1516 | `de01d6d` |
| Brush size slider | Range slider | 1687-1698 | `de01d6d` |
| Undo/Redo | Buttons | 160-190 | `de01d6d` |
| Background image upload | Upload button | 783-793 | `de01d6d` |
| Object selection/manipulation | Drag, resize handles | 571-734 | `de01d6d` |
| Model selector | Dropdown | 1594-1648 | `de01d6d` |
| Aspect ratio | Dropdown | — | `de01d6d` |
| Generate | Button | 859-972 | `de01d6d` |

**Note:** SmartVideo has DrawModal integrated into ImageStudio and VideoStudio.

---

## SHARED PROMPT COMPOSER CONTROLS

**Source File:** `packages/studio/src/components/prompt/PromptComposer.jsx` (1,409 lines)

| Control | Type | Lines | Upstream Commit |
|---------|------|-------|----------------|
| PromptComposer wrapper | Component | 1-409 | `3cc1313` |
| PromptTextarea | Auto-resizing textarea | — | `3cc1313` |
| PromptControls | Control buttons container | — | `3cc1313` |
| PromptFooter | Row wrapper | — | `3cc1313` |
| PromptAction | Generate button | — | `3cc1313` |
| PromptPopover | Dropdown popover | — | `3cc1313` |
| PromptPopoverHeader | Popover header | — | `3cc1313` |
| PromptMenuList | Scrollable menu list | — | `3cc1313` |
| PromptMenuItem | Individual menu item | — | `3cc1313` |
| PromptChevronIcon | Chevron icon | — | `3cc1313` |
| PromptAspectRatioIcon | Aspect ratio icon | — | `3cc1313` |
| PromptDurationIcon | Duration/clock icon | — | `3cc1313` |
| PromptQualityIcon | Resolution/quality icon | — | `3cc1313` |
| promptControlClassName | CSS helper | — | `3cc1313` |
| promptMediaButtonClassName | CSS helper | — | `3cc1313` |

**Note:** PromptComposer is a React component system. SmartVideo does NOT have an equivalent shared component; each studio builds its own prompt bar with vanilla DOM APIs.

---

## SCHEMA-DRIVEN CONTROL HELPERS (models.js)

**Source File:** `packages/studio/src/models.js` (698,080 bytes)

| Helper Function | Lines | Purpose |
|----------------|-------|---------|
| `getAspectRatiosForModel` | — | Returns aspect ratios for T2I models |
| `getResolutionsForModel` | — | Returns resolutions for T2I models |
| `getQualityFieldForModel` | — | Returns quality field for T2I models |
| `getAspectRatiosForI2IModel` | — | Returns aspect ratios for I2I models |
| `getResolutionsForI2IModel` | — | Returns resolutions for I2I models |
| `getQualityFieldForI2IModel` | — | Returns quality field for I2I models |
| `getMaxImagesForI2IModel` | — | Returns max reference images for I2I |
| `getEffectsForI2IModel` | 19478-19481 | Returns effect enum for I2I |
| `getDefaultEffectForI2IModel` | 19483-19486 | Returns default effect for I2I |
| `getAspectRatiosForVideoModel` | — | Returns aspect ratios for T2V |
| `getDurationsForModel` | — | Returns durations for T2V |
| `getResolutionsForVideoModel` | — | Returns resolutions for T2V |
| `getAspectRatiosForI2VModel` | — | Returns aspect ratios for I2V |
| `getDurationsForI2VModel` | — | Returns durations for I2V |
| `getResolutionsForI2VModel` | — | Returns resolutions for I2V |
| `getEffectsForI2VModel` | — | Returns effect enum for I2V |
| `getDefaultEffectForI2VModel` | — | Returns default effect for I2V |
| `getModesForModel` | — | Returns mode enum for video models |
| `getMaxImagesForI2VModel` | — | Returns max reference images for I2V |
| `getResolutionsForLipSyncModel` | — | Returns resolutions for lip sync |
| `getAspectRatiosForRecastModel` | — | Returns aspect ratios for recast |
| `getRecastModelById` | — | Returns recast model by ID |

**Note:** SmartVideo has its own `models.js` (`src/lib/models.js`) with similar helpers but different implementations.

---

## PERSISTENCE CONTROLS

| Control | Type | Source File | Lines | Upstream Commit |
|---------|------|-------------|-------|-----------------|
| scopedPersistKey | localStorage scoping | `persistKey.js` | — | `8fadaed` |
| migrateLegacyPersistKey | Legacy migration | `persistKey.js` | — | `8fadaed` |
| ImageStudio persistence | Debounced save | `ImageStudio.jsx` | 998-1034 | `91ce11d` |
| VideoStudio persistence | Debounced save | `VideoStudio.jsx` | 725-742 | `8fadaed` |
| AudioStudio persistence | Debounced save | `AudioStudio.jsx` | 565-573 | `8fadaed` |
| LipSyncStudio persistence | Debounced save | `LipSyncStudio.jsx` | 331-461 | `8fadaed` |
| History limit (30 items) | Constant | `VideoStudio.jsx` | 1116 | `8fadaed` |

**Note:** SmartVideo uses raw localStorage keys without API-key scoping.

---

## ERROR HANDLING CONTROLS

| Control | Type | Source File | Lines | Upstream Commit |
|---------|------|-------------|-------|-----------------|
| formatErrorMessage | Error formatting | `utils/formatError.js` | — | `1ed51d4` |
| react-hot-toast | Toast notifications | (throughout) | — | `4c971d5` |
| Toaster container | Fixed overlay | (throughout) | — | `0905178` |
| Loading overlay | Spinner + progress | — | — | `8fadaed` |
| Inline error banner | Accessible error | — | — | `1ed51d4` |

**Note:** SmartVideo uses inline error divs and `alert()` instead of toast notifications.

---

## MODEL SWITCHING CONTROLS

| Control | Type | Source File | Lines | Upstream Commit |
|---------|------|-------------|-------|-----------------|
| T2I→I2I sibling mapping | Heuristic lookup | `ImageStudio.jsx` | 1101-1157 | `d1a060a2` |
| I2I→T2I reverse mapping | Heuristic lookup | `ImageStudio.jsx` | 1159-1201 | `d1a060a2` |
| T2V→I2V family mapping | Family-based | `VideoStudio.jsx` | 1071-1112 | `b2d331e7` |
| Hardcoded exceptions | Map | `ImageStudio.jsx` | 1114-1124 | `d1a060a2` |

**Note:** SmartVideo has similar heuristics in `EditStudio.js` and `InfluencerStudio.js`.

---

## UPLOAD / MEDIA CONTROLS

| Control | Type | Source File | Lines | Upstream Commit |
|---------|------|-------------|-------|-----------------|
| UploadButton (ImageStudio) | Inline picker | `ImageStudio.jsx` | 66-551 | `9965718` |
| MediaPickerButton (shared) | Reusable upload | `prompt/` | — | `abd5c06` |
| File validation (10MB limit) | Validation | `ImageStudio.jsx` | 161-168 | `9965718` |
| Multi-select enforcement | UI state | `ImageStudio.jsx` | 136-145 | `9965718` |
| Upload progress indicator | Progress bar | `ImageStudio.jsx` | 188-191 | `9965718` |
| Drag & drop | Drop zone | `VideoStudio.jsx` | 900-912 | `fddc2ff` |

**Note:** SmartVideo has `UploadPicker.js` (752 lines) with similar functionality but a different API.

---

## GENERATION HISTORY CONTROLS

| Control | Type | Source File | Lines | Upstream Commit |
|---------|------|-------------|-------|-----------------|
| History gallery (grid) | Responsive grid | `VideoStudio.jsx` | 1432-1615 | `8fadaed` |
| History cards with hover actions | Card grid | `VideoStudio.jsx` | 1458-1512 | `8fadaed` |
| MobileGenerationActions | Mobile menu | `MobileGenerationActions.jsx` | — | `abd5c06` |
| GenerationCopyButtons | Copy buttons | `MobileGenerationActions.jsx` | — | `aea3166` |
| Fullscreen video modal | Overlay | `VideoStudio.jsx` | 2186-2213 | `91ce11d` |
| Server-backed deletion | API call | `ImageStudio.jsx` | — | `2f71b75` |
| Local history limit (30) | Constant | `VideoStudio.jsx` | 1116 | `8fadaed` |

**Note:** SmartVideo has `StudioThumbnailModal` and `StudioThumbnailPanel` for history, but no server-backed deletion.
