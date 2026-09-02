# Historical Studio Audit — SmartVideo

## Audit Scope

- **Baseline commit**: `afad812a22d9f6f470222a99136b7cd651f61a89`
- **Latest scanned commit**: `cb987b2f`
- **Method**: Read-only `git log`, `git show`, and `git diff` across all branches. No application code was modified.
- **Report date**: 2026-08-10

## Summary

For the majority of studios, the **latest commit (`cb987b2f`)** is the most feature-complete implementation. Significant feature growth occurred in:
- **CinemaTemplateStudio.js** (1,014 → 2,235 lines)
- **StoryboardStudio.js** (1,351 → 1,542 lines)
- **AudioStudio.js** (215 → 404 lines)
- **EditStudio.js** (baseline already at 649 lines)
- **EffectsStudio.js** (baseline already at 1,358 lines)

The following pages were audited alongside their primary studio components:
- `CharacterPage.js` (124 lines, unchanged across history)
- `CommercialPage.js` (104 lines, unchanged across history)
- `InfluencerPage.js` (104 lines, unchanged across history)

---

## 1. Image Studio (`src/components/ImageStudio.js`)

### Best Commit
**`cb987b2f`** — 1,257 lines

### Modes
- **T2I** (Text-to-Image) — default
- **I2I** (Image-to-Image) — triggered by image upload; switches model list to `i2iModels`

### Basic Controls
- Prompt textarea (auto-growing)
- Model selector with provider-aware sidebar + search (`PROVIDER_LOGOS`, `filterModels`)
- Aspect ratio selector
- Quality/Resolution selector (model-dependent)
- Image upload picker (multi-image support for I2I)
- Generate button
- GTM Boost prompt enhancer
- Thumbnail studio modal

### Advanced Controls
- Negative prompt
- Guidance scale slider (1–20)
- Steps slider (1–50)
- Seed input with randomize button
- Batch count slider (1–4)
- Custom width/height inputs
- Reference strength slider (0–100%, for I2I models)
- LoRA model ID input + weight
- Style presets: None, Photorealistic, Anime, Cinematic, Oil Painting, Watercolor, Digital Art, Concept Art, Cyberpunk

### Model-Specific Controls
- `getAspectRatiosForModel` / `getAspectRatiosForI2IModel`
- `getResolutionsForModel` / `getResolutionsForI2IModel`
- `getQualityFieldForModel` / `getQualityFieldForI2IModel`
- `getMaxImagesForI2IModel` — multi-image I2I support

### Workflows
- Upload → auto-switch to I2I mode → generate
- Clear upload → revert to T2I
- Generate → preview → download (via output preview)
- Quick tools panel with prompt starters + enhance tags
- Personalize popover with contact token replacement

### Presets
- 9 style presets (see Advanced Controls)
- `QUICK_PROMPTS` from `lib/promptUtils.js`
- `ENHANCE_TAGS` categories

### Hidden/Conditional Features
- `imageMode` flag toggles between T2I/I2I model catalogs
- GTM context restoration from localStorage (`getGtmContext('image-studio')`)
- Custom thumbnail cache (`getCustomThumbnailFromCache` / `saveCustomThumbnailToCache`)
- Provider sidebar with logo inversion logic (`invertLogos`)

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 2. Video Studio (`src/components/VideoStudio.js`)

### Best Commit
**`cb987b2f`** — 1,429 lines

### Modes
- **T2V** (Text-to-Video) — default
- **I2V** (Image-to-Video) — triggered by image upload
- **V2V** (Video-to-Video) — triggered by video upload; watermark removal mode

### Basic Controls
- Prompt textarea
- Model selector with provider-aware sidebar + search
- Aspect ratio selector
- Duration selector (model-dependent)
- Resolution selector (model-dependent)
- Quality selector (model-dependent)
- Image upload picker (I2V)
- Video upload picker (V2V)
- Generate button
- GTM Boost prompt enhancer
- Thumbnail studio modal
- Personalize popover

### Advanced Controls
- Negative prompt
- Seed input with randomize button
- Extend generation banner (for models with `requiresRequestId`, e.g., Seedance 2.0)

### Model-Specific Controls
- `getAspectRatiosForVideoModel` / `getAspectRatiosForI2VModel`
- `getDurationsForModel` / `getDurationsForI2VModel`
- `getResolutionsForVideoModel` / `getResolutionsForI2VModel`
- `getQualitiesForModel` — quality enum per model
- V2V models grouped separately in dropdown with "Video Tools" label
- `updateControlsForModel()` — conditionally shows/hides AR, duration, resolution, quality based on model

### Workflows
- T2V: prompt → generate → preview → download
- I2V: upload image → prompt → generate
- V2V: upload video → auto-switch to v2v mode → generate (watermark removal)
- Extend previous generation (Seedance 2.0 continuation)
- Timeline insert (via `saveGeneratedAsset` + `navigate('timeline', ...)`)
- Library save

### Presets
- GTM Boost prompt enhancer for video
- Provider-aware model list with logos

### Hidden/Conditional Features
- `v2vMode` flag hides all parameter controls when active
- `extendBanner` shown only for models with `requiresRequestId`
- Video upload spinner/ready states
- `lastGenerationId` / `lastGenerationModel` tracking
- Personalization chip (shows active contact)

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 3. Cinema Studio (`src/components/CinemaStudio.js`)

### Best Commit
**`cb987b2f`** — 1,141 lines

### Modes
- **T2V** (Text-to-Video) — default
- **I2V** (Image-to-Video) — triggered by reference image upload

### Basic Controls
- Prompt textarea
- Model selector with provider-aware sidebar + search
- Aspect ratio selector (16:9, 21:9, 9:16, 1:1, 4:5)
- Resolution selector (1K, 2K, 4K)
- Reference image upload
- Generate button
- GTM Boost prompt enhancer
- Thumbnail studio modal
- Personalize trigger

### Advanced Controls
- Cinema Prompt Builder (collapsible):
  - Camera selection (from `CAMERA_MAP`)
  - Lens selection (from `LENS_MAP`)
  - Focal length (from `FOCAL_PERSPECTIVE`)
  - Aperture (from `APERTURE_EFFECT`)
  - Movement (from `CAMERA_MOVEMENTS`)
  - Film look (from `FILM_LOOKS`)
- Camera Controls Overlay (full-screen modal):
  - Camera, lens, focal, aperture sliders/selects
  - Movement and look selectors
  - Live preview of composed prompt
- Summary card showing current camera/lens/movement/look

### Model-Specific Controls
- `getVideoModelById` / `getI2VModelById`
- `getDurationsForModel` / `getDurationsForI2VModel`
- `getResolutionsForVideoModel` / `getResolutionsForI2VModel`
- Model catalog updates controls when reference image is loaded

### Workflows
- T2V: prompt → generate → history sidebar → download/regenerate/new shot
- I2V: upload reference image → prompt → generate
- Camera builder → use in prompt
- History sidebar with video/image thumbnails

### Presets
- `CAMERA_MOVEMENTS`: Static, Dolly In, Dolly Out, Crane Up, Orbit, FPV Drone, Handheld, Pan, Tilt, Dolly Zoom
- `FILM_LOOKS`: Natural, Anamorphic, Teal & Orange, Moody Noir, Vintage, Neon Nights, Documentary, Golden Hour

### Hidden/Conditional Features
- `currentSettings.referenceUrl` toggles between T2V and I2V model lists
- History sidebar renders `<video>` for video results, `<img>` for images
- `createSafeImage` used for history thumbnails
- GTM context restoration from localStorage

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 4. Cinema Template Studio (`src/components/CinemaTemplateStudio.js`)

### Best Commit
**`cb987b2f`** — 2,235 lines (major growth from 1,014 lines at baseline)

### Modes
- **Quick mode** — template browsing and selection
- **Advanced mode** — full template builder with scene customization

### Basic Controls
- Template registry browser
- Template categories
- Model selector with provider-aware sidebar + search
- Prompt input
- Thumbnail generation
- Template application to timeline

### Advanced Controls
- `TemplateInputBuilder` — structured input collection
- `PromptAssemblyEngine` — prompt composition
- `SceneBuilder` — scene generation
- `RenderHandoff` — render pipeline integration
- `TemplateStorage` — save/load templates
- Negative prompt composition (`composeNegativePrompt`)
- Prompt enrichment (`enrichPromptString`)
- Scene selection (`selectScenes`)
- GTM Boost prompt enhancer
- Personalize trigger

### Model-Specific Controls
- `getEnrichedModels` from `lib/modelCatalog.js`
- `t2iModels` / `i2vModels` integration
- Provider-aware model selector with search

### Workflows
- Browse templates → select → customize → generate
- Embedded `StoryboardStudio` with handoff callback (`window.useStoryboardInTemplate`)
- Save/load projects
- Timeline integration
- Template thumbnail management

### Presets
- `CINEMATIC_CATEGORIES`
- `OUTPUT_STYLES`
- `VISUAL_STYLES`
- `PACING_OPTIONS`
- `CTA_TYPES`
- `ENDING_TYPES`
- `SCENE_STRUCTURES`
- `SHOT_TYPES`
- `CAMERA_MOVEMENTS`
- `BRAND_VOICES`
- `TARGET_AUDIENCES`

### Hidden/Conditional Features
- `incomingStoryboard` / `storyboardProjectId` for embedded storyboard handoff
- `selectedScenes` array
- `generationResult` / `retryCount` / `MAX_RETRIES` for retry logic
- `isGenerating` flag
- `lastBuiltPrompt` tracking
- `outputTabValues` / `activeTab` state
- `showMobileOutput` flag
- `promptManuallyEdited` flag
- `browseFilter` (all | favorites | recent | custom)
- `sceneTimelineDebounce`

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 5. Storyboard Studio (`src/components/StoryboardStudio.js`)

### Best Commit
**`cb987b2f`** — 1,542 lines (major growth from 1,351 lines at baseline)

### Modes
- **Standalone** — full studio mode
- **Embedded** — embedded in CinemaTemplateStudio (`options = { embedded: true, onBack }`)

### Basic Controls
- Frame-based storyboard editor
- Shot presets dropdown
- Model selector with provider-aware sidebar + search
- Prompt input per frame
- Narration input per frame
- Add/remove frames
- GTM Boost prompt enhancer
- Thumbnail studio modal
- Fullscreen preview

### Advanced Controls
- Undo/redo (`createUndoRedo` with max history 50)
- Autosave (`createAutosave` with 1.5s debounce)
- Supabase persistence (`saveProject`, `loadProjectFromStorage`)
- Comparison mode (side-by-side frame comparison)
- `frameDurations` array
- Style presets
- Lighting presets
- Color grade presets
- Video Intent section (collapsible):
  - Video type (commercial, brand film, trailer, social reel, testimonial, documentary, short film, explainer)
  - Duration (10–300s)
  - Aspect ratio
  - Tone (dramatic, cinematic, upbeat, luxury, gritty, minimal, emotional, humorous)
  - Style preset
  - Lighting preset
  - Color grade
  - Target audience
  - Call to action
  - Subject
  - Premise
  - Generate storyboard from intent (`generateStoryboardFromIntent`)

### Model-Specific Controls
- `getAspectRatiosForModel`
- Provider-aware model selector with search

### Workflows
- Create frames → edit prompts → generate → preview
- Save/load projects (local + Supabase)
- Video intent → auto-generate storyboard
- Timeline insertion
- Library save

### Presets
- `SHOT_TYPES`: Wide Shot, Medium Shot, Close-Up, Extreme Close-Up, POV, Overhead, Low Angle
- `SHOT_PRESETS`: predefined prompt/shots combinations
- Style, lighting, and color presets

### Hidden/Conditional Features
- `comparisonMode` / `compareIndices` for side-by-side comparison
- `supabaseAvailable` flag
- `generatedStoryboard` state
- `selectedLighting` / `selectedColor` state
- `referenceImages` per frame
- `notes` per frame

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 6. Effects Studio (`src/components/EffectsStudio.js`)

### Best Commit
**`cb987b2f`** — 1,358 lines (same as `5c74d6f1` which added advanced controls)

### Modes
- **Image Effects** (I2I)
- **Nano Banana** (I2I)
- **Flux Kontext** (I2I)
- **AI Video Effects** (I2V)
- **Motion Controls** (I2V)
- **Video FX v2** (I2V)

### Basic Controls
- Tabbed effect browser (350+ effects)
- Search effects
- Upload image/video
- Effect prompt input
- Apply Effect button
- Input/output preview panels
- Compare mode toggle
- Download button
- Add to Library button
- Insert into Timeline button
- Thumbnail studio modal
- Personalize trigger

### Advanced Controls
- Guidance scale slider (1–20)
- Steps slider (1–50)
- Seed input with randomize button
- Negative prompt
- Effect strength slider (0–100%)
- Denoise strength slider (0–1)
- CFG scale slider
- `createSliderControl` / `createAdvancedSection` from `lib/effectParamValidator.js`
- `validateEffectParams` / `EFFECT_PARAM_SCHEMA`
- Advanced settings persisted to localStorage

### Model-Specific Controls
- `getEffectsForModel(modelId)` — returns effect enum from model.inputs.name
- Effect-specific parameter validation via `EFFECT_PARAM_SCHEMA`

### Workflows
- Upload media → select effect → configure → apply → preview → download/save/insert
- Comparison mode (side-by-side)
- Library save
- Timeline insert

### Presets
- 350+ effects across 6 categories (image effects, nano banana, kontext, video effects, motion controls, video FX v2)

### Hidden/Conditional Features
- `comparisonMode` / `updateComparisonView()`
- `lastResultUrl` / `lastResultType` / `lastInputUrl` tracking
- `EffectCompositor` from `lib/editor/effectCompositor.js`
- Fullscreen preview (`createFullscreenPreview`)

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 7. Edit Studio (`src/components/EditStudio.js`)

### Best Commit
**`cb987b2f`** — 649 lines (baseline `afad812a` already at 649 lines)

### Modes
- **Static tools** — no model selector, direct tool execution
- **AI Edit** — model-dependent dynamic controls

### Basic Controls (Static Tools)
- 13 editing tools in grid:
  1. Remove Object
  2. Remove Background
  3. Extend Image
  4. AI Edit (instruction-based)
  5. Reframe
  6. Change Dress
  7. Enhance Skin
  8. Colorize
  9. Add Watermark
  10. Upscale
  11. Face Swap
  12. Product Shot
  13. Ghibli Style
- Upload image/video
- Tool selection → dynamic controls appear

### Advanced Controls (Dynamic Controls)
- 32 AI edit models (`EDIT_AI_MODELS`):
  - Flux Kontext Dev/Pro/Max I2I
  - GPT-4o Image To Image / Edit
  - Gpt Image 1.5 Edit
  - Midjourney v7 variants (Image To Image, Style Reference, Omni Reference)
  - Bytedance Seededit v3 / Seedream Edit v4 / Seedream v4.5 Edit
  - Nano Banana Edit/Pro/2 Edit
  - Qwen Image Edit/Plus/2511
  - Ideogram Character
  - Wan2.5/2.6 Image Edit
  - Reve Image Edit
  - Kling O1 Edit Image
  - Vidu Q2 Reference To Image
  - Grok Imagine Image To Image
  - Flux 2 Dev/Flex/Pro/Klein 4b/9b Edit
  - Flux Redux
- `buildDynamicControls(modelId)` — renders controls from `model.inputs`
- Aspect ratio, quality, number of images, render speed, style, target index (face swap)
- Watermark position, opacity, scale
- Watermark image upload

### Model-Specific Controls
- `getI2IModelById(modelId)` — fetches model definition from `lib/models.js`
- Dynamic controls rendered from `model.inputs` schema

### Workflows
- Select tool → upload media → configure → apply → preview → download
- AI Edit models: select model → upload → prompt → generate
- Watermark tool: upload watermark image → configure → apply

### Presets
- None beyond tool-specific defaults

### Hidden/Conditional Features
- `modelControlValues` object tracks per-model control state
- `dynamicControlsContainer` created/destroyed per model
- Watermark image upload (second image)
- `currentBlobUrl` for blob URL cleanup

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 8. Upscale Suite (`src/components/UpscaleStudio.js`)

### Best Commit
**`cb987b2f`** — 269 lines

### Modes
- Single upscale method selection (not generation modes)

### Basic Controls
- Method selector: AI Upscaler (2x/4x), Topaz Upscale, Seed Upscale
- Factor selector (2x/4x for AI Upscaler)
- Image upload
- Generate button
- Result preview
- Download button

### Advanced Controls
- None beyond basic factor selection

### Model-Specific Controls
- `UPSCALE_METHODS` array with provider-aware dropdown
- `getModelLogoHtml` / `PROVIDER_LOGOS` for logos

### Workflows
- Upload image → select method/factor → upscale → preview → download

### Presets
- None

### Hidden/Conditional Features
- Provider-aware model selector with sidebar
- `selectedFactor` state

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 9. Character Studio (`src/components/CharacterStudio.js`)

### Best Commit
**`cb987b2f`** — 384 lines

### Modes
- Single mode (character generation with face preservation)

### Basic Controls
- Model selector: Flux PuLID, Subject Reference
- Image upload
- Prompt input
- Generate button
- Result preview
- Download button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic prompt

### Model-Specific Controls
- `CHARACTER_MODELS` array with provider metadata
- `hasPrompt` flag per model

### Workflows
- Upload reference image → prompt → generate → preview → download

### Presets
- None

### Hidden/Conditional Features
- Provider-aware model selector
- `getModelLogoHtml` for logos

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 10. Commercial Studio (`src/components/CommercialStudio.js`)

### Best Commit
**`cb987b2f`** — 334 lines

### Modes
- Single mode (product photography/commercial content)

### Basic Controls
- Model selector: Product Shot, Product Photography
- Image upload
- Scene preset selector (9 presets)
- Format preset selector (4 presets)
- Prompt input
- Generate button
- Result preview
- Download button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic prompt and presets

### Model-Specific Controls
- `COMMERCIAL_MODELS` array
- Provider-aware model selector

### Workflows
- Upload product image → select scene/format → prompt → generate → download

### Presets
- `SCENE_PRESETS`: Studio white background, Luxury marble surface, Outdoor natural light, Lifestyle kitchen counter, Neon tech showroom, Wooden table cozy, Minimalist gradient, Beach sand and waves, Office desk setup
- `FORMAT_PRESETS`: Ad Banner (16:9), Social Post (1:1), Story (9:16), Billboard (21:9)

### Hidden/Conditional Features
- Provider-aware model selector
- `getModelLogoHtml` for logos

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 11. Audio Studio (`src/components/AudioStudio.js`)

### Best Commit
**`cb987b2f`** — 404 lines (major growth from 215 lines at commit `a5f9c4b8`)

### Modes
- **Music** — text-to-music generation
- **TTS** (Text-to-Speech) — speech generation
- **Generic Audio** — model-dependent

### Basic Controls
- Model selector with provider-aware sidebar + search
- Prompt input (for music/TTS)
- Style selector (Pop, Rock, Electronic, Classical, Jazz, Hip Hop, Ambient)
- Duration selector (15s, 30s, 60s, 120s)
- Voice selector (Female 1, Male Qingse) — for TTS
- Generate button
- Audio player result
- Download button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic controls

### Model-Specific Controls
- `audioModels` from `lib/models.js`
- `hasPrompt` flag — shows/hides prompt input
- `supportsStyles` flag — shows/hides style selector
- `type === 'tts'` — shows/hides voice selector
- `updateFormVisibility()` — conditional form rendering

### Workflows
- Select model → configure (prompt/style/duration/voice) → generate → preview → download

### Presets
- 7 music style presets (Pop, Rock, Electronic, Classical, Jazz, Hip Hop, Ambient)

### Hidden/Conditional Features
- `updateFormVisibility()` toggles prompt/style/voice based on model type
- GTM Boost prompt enhancer
- Personalize trigger with contact token replacement

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 12. Avatar Studio (`src/components/AvatarStudio.js`)

### Best Commit
**`cb987b2f`** — 347 lines

### Modes
- Single mode (talking avatar / lip sync video)

### Basic Controls
- Model selector with provider-aware sidebar + search
- Video/image upload
- Audio upload (for lip sync models)
- Prompt input (optional)
- Generate button
- Result preview
- Download button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic prompt

### Model-Specific Controls
- `avatarModels` from `lib/models.js`
- `hasVideo` / `hasAudio` / `hasPrompt` flags
- `updateFormVisibility()` — conditionally shows video/audio/prompt uploads

### Workflows
- Upload video/image → optionally upload audio → prompt → generate → preview → download

### Presets
- None

### Hidden/Conditional Features
- `updateFormVisibility()` toggles upload fields based on model capabilities
- GTM Boost prompt enhancer
- Personalize trigger

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 13. Training Studio (`src/components/TrainingStudio.js`)

### Best Commit
**`cb987b2f`** — 352 lines

### Modes
- Single mode (LoRA training)

### Basic Controls
- Model selector with provider-aware sidebar + search
- LoRA name input
- Trigger word input
- Epochs input
- Image upload (multiple)
- Train button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic inputs

### Model-Specific Controls
- `trainingModels` from `lib/models.js`
- Provider-aware model selector

### Workflows
- Select model → enter LoRA name/trigger word → upload training images → train

### Presets
- None

### Hidden/Conditional Features
- Provider-aware model selector
- `getModelLogoHtml` for logos

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 14. Video Tools Studio (`src/components/VideoToolsStudio.js`)

### Best Commit
**`cb987b2f`** — 314 lines

### Modes
- Single mode (video enhancement/editing)

### Basic Controls
- Model selector with provider-aware sidebar + search
- Video upload
- Prompt input
- Generate button
- Result preview
- Download button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic prompt

### Model-Specific Controls
- `videoToolsModels` from `lib/models.js`
- Provider-aware model selector

### Workflows
- Upload video → prompt → generate → preview → download

### Presets
- None

### Hidden/Conditional Features
- Provider-aware model selector
- `getModelLogoHtml` for logos

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 15. Chat Studio (`src/components/ChatStudio.js`)

### Best Commit
**`cb987b2f`** — 386 lines

### Modes
- Single mode (text generation / conversation)

### Basic Controls
- Model selector with provider-aware sidebar + search
- Chat message input
- Send button
- Chat history display
- Clear conversation button
- Thumbnail modal
- Video intent store integration

### Advanced Controls
- None beyond basic chat

### Model-Specific Controls
- `textModels` from `lib/models.js`
- Provider-aware model selector

### Workflows
- Select model → type message → send → receive response → continue conversation
- Video intent storage (`getVideoIntent`, `setVideoIntent`, `resetVideoIntent`)

### Presets
- None

### Hidden/Conditional Features
- `messages` array for chat history
- `isGenerating` flag
- `getVideoIntent` / `setVideoIntent` / `resetVideoIntent` from `lib/videoIntentStore.js`
- `navigate` for routing

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## 16. AI Influencer (`src/components/InfluencerStudio.js`)

### Best Commit
**`cb987b2f`** — 233 lines

### Modes
- Single mode (influencer content generation)

### Basic Controls
- Image/video upload
- Style preset selector (20+ presets)
- Output format selector (4 presets)
- Prompt input (optional)
- Generate button
- Result preview
- Download button
- Regenerate button
- Thumbnail modal
- Personalize trigger

### Advanced Controls
- None beyond basic prompt and presets

### Model-Specific Controls
- Fixed model: `higgsfield-soul-image-to-image`
- `selectedStyle` / `selectedFormat` state

### Workflows
- Upload reference photo → select style/format → prompt → generate → download/regenerate

### Presets
- `STYLE_PRESETS` (20): Realistic, DigitalCam, Quiet luxury, FashionShow, 90s Grain, Sunset beach, Amalfi Summer, Bimbocore, Vintage PhotoBooth, Gorpcore, Indie sleaze, Fairycore, Avant-garde, Y2K Posters, Grunge, Coquette core, Tokyo Streetstyle, 2049, Night rider, Glazed doll skin makeup
- `FORMAT_PRESETS` (4): Instagram Post (1:1), Story / Reel (9:16), YouTube Thumb (16:9), Pinterest Pin (2:3)

### Hidden/Conditional Features
- `customThumbnailUrl` passed in generation params
- GTM Boost prompt enhancer
- Personalize trigger with contact token replacement

### Features Missing from Current Code (relative to historical max)
None identified — current code at `cb987b2f` appears to be the most complete version.

---

## Supporting Files

### `lib/models.js`
- 355 lines
- Defines `MODELS` object with 200+ models
- Types: text-to-image, image-to-image, text-to-video, image-to-video, video-to-video, voice-cloning, text-to-speech, lip-sync
- Helper functions: `getModelsByType`, `getModelById`, `getTextToImageModels`, etc.
- `DEFAULT_MODELS` for avatar, video, imageToVideo, lipSync, upscale, enhance
- `MODEL_CATEGORIES` for UI organization

### `lib/instructions.js`
- 371 lines
- `STUDIO_INSTRUCTIONS` object with tutorials for:
  - personalize
  - ai-video-creator
  - contact-importer
  - token-editor
  - video-uploader
  - video-personalizer
- `COMMON_ISSUES` object with troubleshooting guides

### Model Inputs Pattern
Across history, models use `inputs` objects to declare conditional parameters:
```js
{
  id: 'flux-dev',
  inputs: {
    aspect_ratio: { enum: ['1:1', '16:9', ...], default: '1:1' },
    resolution: { enum: ['1K', '2K', '4K'], default: '2K' },
    quality: { enum: ['basic', 'high'], default: 'basic' },
    duration: { min: 1, max: 10, default: 5 },
    style: { enum: [...], default: 'None' }
  }
}
```
Studios read these schemas to dynamically render controls (`buildDynamicControls` in EditStudio, `getEffectsForModel` in EffectsStudio, etc.).

---

## Commit Recommendations

| Studio | Best Commit | Lines | Notes |
|--------|-------------|-------|-------|
| Image Studio | `cb987b2f` | 1,257 | Latest |
| Video Studio | `cb987b2f` | 1,429 | Latest |
| Cinema Studio | `cb987b2f` | 1,141 | Latest |
| Cinema Template Studio | `cb987b2f` | 2,235 | Major growth from baseline |
| Storyboard Studio | `cb987b2f` | 1,542 | Major growth from baseline |
| Effects Studio | `cb987b2f` | 1,358 | Advanced controls added in `5c74d6f1` |
| Edit Studio | `cb987b2f` | 649 | Dynamic controls for 32 models |
| Upscale Suite | `cb987b2f` | 269 | Latest |
| Character Studio | `cb987b2f` | 384 | Latest |
| Commercial Studio | `cb987b2f` | 334 | Latest |
| Audio Studio | `cb987b2f` | 404 | Major growth from earlier versions |
| Avatar Studio | `cb987b2f` | 347 | Latest |
| Training Studio | `cb987b2f` | 352 | Latest |
| Video Tools | `cb987b2f` | 314 | Latest |
| Chat Studio | `cb987b2f` | 386 | Latest |
| Lip Sync | `cb987b2f` | 923 | Latest |
| AI Influencer | `cb987b2f` | 233 | Latest |

---

## Audit Limitations

- This audit is based on static code inspection via `git show` and `git diff`.
- Runtime behavior, API compatibility, and backend integration were not tested.
- Some studios (Audio, Avatar, Training, VideoTools, Chat, Influencer) have not changed between baseline and latest, suggesting the baseline commit was already the most complete for those components.
- `AIStoryboardStudio.jsx` was not found in any commit (always 0 lines).
