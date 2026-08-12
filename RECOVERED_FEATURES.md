# Recovered Features

## Dynamic Control Engine
The core dynamic control engine recovers the historical SmartVideo pattern of rendering model-specific advanced controls automatically from model schemas, rather than hardcoding every parameter in each studio.

### Features Recovered
1. **Model-driven UI** - Controls render based on `model.inputs` schema
2. **Conditional visibility** - `visibleWhen` expressions hide/show controls based on state
3. **Grouped controls** - Basic, advanced, and LoRA groups with collapsible sections
4. **18 control types** - string, text, textarea, prompt, number, int, slider, boolean, select, enum, image, image[], video, audio, color, aspect_ratio, seed, model_selector
5. **API payload builder** - `buildApiPayload()` maps control values to API params with field mapping and exclusions
6. **Studio-specific exclusions** - `exclude` parameter prevents studio-specific fields from leaking into API calls
7. **Model extensions** - `modelInputExtensions.js` augments auto-generated schemas with missing advanced params (negative_prompt, guidance_scale, steps, seed, LoRA, etc.)

## Studio-Specific Enhancements

### Image Studio
- Dynamic advanced controls panel rendered from model schema
- Removed 6 dead static event handlers
- Generation wired to `dynamicControls.getPayload()`
- Style preset and batch count excluded from API payload

### Edit Studio
- Dynamic controls for dropdown AI models (Seedream, GPT-4o, Midjourney, etc.)
- Existing tool-specific controls preserved (aspect ratio, quality, watermark, face swap)

### Video Studio
- Dynamic controls for text-to-video and image-to-video models
- Existing advanced panel toggle preserved

### Lip Sync Studio
- Dynamic controls for lip sync models
- Existing advanced panel toggle preserved

### Cinema Studio
- Dynamic controls for video generation models
- Existing settings panel preserved

### Storyboard Studio
- Dynamic controls for storyboard generation
- Existing advanced panel toggle preserved

### Character Studio (NEW)
- Dynamic controls for character preservation models (Flux PuLID, Subject Reference)
- Model-specific inputs rendered automatically

### Commercial Studio (NEW)
- Dynamic controls for product shot models
- Scene presets and format presets preserved

### Upscale Studio (NEW)
- Dynamic controls for upscaler models (AI Upscaler, Topaz, Seed)
- Upscale factor buttons preserved

### Influencer Studio (NEW)
- Dynamic controls for influencer generation model
- Style presets and format presets preserved

### Avatar Studio (NEW)
- Dynamic controls for avatar/talking head models
- Video/audio upload and prompt preserved

### Video Tools Studio (NEW)
- Dynamic controls for video processing tools
- Video upload and prompt preserved

## Protected Systems (Untouched)
- Director
- Video Agent
- Timeline
- Render
