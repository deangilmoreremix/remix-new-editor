# Edit Studio Historical Specification

## Source
- **File**: `src/components/EditStudio.js`
- **Commit**: `afad812a22d9f6f470222a99136b7cd651f61a89`
- **Author**: Deanell Gilmore
- **Date**: Fri Aug 7 23:26:27 2026 -0400
- **Message**: feat(edit-studio): add dynamic model selector and controls for 32 AI edit variants

## Overview
The historical implementation is a vanilla JavaScript component (649 lines) that creates DOM elements imperatively. It is NOT a React component.

## Architecture

### Dependencies
- `muapi` from `../lib/muapi.js` — API client
- `apiKeyManager` from `../lib/apiKeyManager.js` — API key management
- `mountStudioChrome` from `../lib/studioChrome.js` — Studio layout wrapper
- `AuthModal` from `./AuthModal.js` — Authentication modal
- `createUploadPicker` from `./UploadPicker.js` — Image/video uploader
- `createInlineInstructions` from `./InlineInstructions.js` — Inline help text
- `createHeroSection`, `getToolThumbnail`, `createThumbnailImg`, `getCustomThumbnailFromCache`, `saveCustomThumbnailToCache`, `clearCustomThumbnailCache` from `../lib/thumbnails.js` — Thumbnail system
- `mountPersonalizeTrigger`, `replaceTokensInPrompt` from `./personalize/personalizePopover.js` — Personalization
- `StudioThumbnailModal`, `mountStudioThumbnailModal` from `./modals/StudioThumbnailPanel.jsx` — Thumbnail modal
- `requireEntitlement` from `../lib/clerkEntitlements.js` — Billing/entitlement check
- `getI2IModelById` from `../lib/models.js` — Model lookup

### Constants

#### EDIT_AI_MODELS (32 models)
```javascript
const EDIT_AI_MODELS = [
  { id: 'flux-kontext-dev-i2i', name: 'Flux Kontext Dev I2I', hasPrompt: true },
  { id: 'flux-kontext-pro-i2i', name: 'Flux Kontext Pro I2I', hasPrompt: true },
  { id: 'flux-kontext-max-i2i', name: 'Flux Kontext Max I2I', hasPrompt: true },
  { id: 'gpt4o-image-to-image', name: 'GPT-4o Image To Image', hasPrompt: true },
  { id: 'gpt4o-edit', name: 'GPT-4o Edit', hasPrompt: true },
  { id: 'gpt-image-1.5-edit', name: 'Gpt Image 1.5 Edit', hasPrompt: true },
  { id: 'midjourney-v7-image-to-image', name: 'Midjourney v7 Image To Image', hasPrompt: true },
  { id: 'midjourney-v7-style-reference', name: 'Midjourney v7 Style Reference', hasPrompt: true },
  { id: 'midjourney-v7-omni-reference', name: 'Midjourney v7 Omni Reference', hasPrompt: true },
  { id: 'bytedance-seededit-v3', name: 'Bytedance Seededit v3', hasPrompt: true },
  { id: 'bytedance-seedream-edit-v4', name: 'Bytedance Seedream Edit v4', hasPrompt: true },
  { id: 'bytedance-seedream-v4.5-edit', name: 'Bytedance Seedream v4.5 Edit', hasPrompt: true },
  { id: 'nano-banana-edit', name: 'Nano Banana Edit', hasPrompt: true },
  { id: 'nano-banana-pro-edit', name: 'Nano Banana Pro Edit', hasPrompt: true },
  { id: 'nano-banana-2-edit', name: 'Nano Banana 2 Edit', hasPrompt: true },
  { id: 'qwen-image-edit', name: 'Qwen Image Edit', hasPrompt: true },
  { id: 'qwen-image-edit-plus', name: 'Qwen Image Edit Plus', hasPrompt: true },
  { id: 'qwen-image-edit-2511', name: 'Qwen Image Edit 2511', hasPrompt: true },
  { id: 'ideogram-character', name: 'Ideogram Character', hasPrompt: true },
  { id: 'wan2.5-image-edit', name: 'Wan2.5 Image Edit', hasPrompt: true },
  { id: 'wan2.6-image-edit', name: 'Wan2.6 Image Edit', hasPrompt: true },
  { id: 'reve-image-edit', name: 'Reve Image Edit', hasPrompt: true },
  { id: 'kling-o1-edit-image', name: 'Kling O1 Edit Image', hasPrompt: true },
  { id: 'vidu-q2-reference-to-image', name: 'Vidu Q2 Reference To Image', hasPrompt: true },
  { id: 'grok-imagine-image-to-image', name: 'Grok Imagine Image To Image', hasPrompt: true },
  { id: 'flux-2-dev-edit', name: 'Flux 2 Dev Edit', hasPrompt: true },
  { id: 'flux-2-flex-edit', name: 'Flux 2 Flex Edit', hasPrompt: true },
  { id: 'flux-2-pro-edit', name: 'Flux 2 Pro Edit', hasPrompt: true },
  { id: 'flux-2-klein-4b-edit', name: 'Flux 2 Klein 4b Edit', hasPrompt: true },
  { id: 'flux-2-klein-9b-edit', name: 'Flux 2 Klein 9b Edit', hasPrompt: true },
  { id: 'flux-redux', name: 'Flux Redux', hasPrompt: true },
];
```

#### EDIT_TOOLS (13 tools)
```javascript
const EDIT_TOOLS = [
  { id: 'ai-object-eraser', name: 'Remove Object', hasPrompt: false },
  { id: 'ai-background-remover', name: 'Remove Background', hasPrompt: false },
  { id: 'ai-image-extension', name: 'Extend Image', hasPrompt: false },
  { id: 'seedream-5.0-edit', name: 'AI Edit', hasPrompt: true, promptPlaceholder: 'Describe the edit...' },
  { id: 'ideogram-v3-reframe', name: 'Reframe', hasPrompt: false },
  { id: 'ai-dress-change', name: 'Change Dress', hasPrompt: false },
  { id: 'ai-skin-enhancer', name: 'Enhance Skin', hasPrompt: false },
  { id: 'ai-color-photo', name: 'Colorize', hasPrompt: false },
  { id: 'add-image-watermark', name: 'Add Watermark', hasPrompt: false },
  { id: 'ai-image-upscaler', name: 'Upscale', hasPrompt: false },
  { id: 'ai-image-face-swap', name: 'Face Swap', hasPrompt: false },
  { id: 'ai-product-shot', name: 'Product Shot', hasPrompt: true, promptPlaceholder: 'Describe the scene...' },
  { id: 'ai-ghibli-style', name: 'Ghibli Style', hasPrompt: false },
];
```

### State Variables
```javascript
let activeTool = null;
let uploadedUrl = null;
let customThumbnailUrl = getCustomThumbnailFromCache('edit-studio');
let currentBlobUrl = null;
let selectedModelId = 'seedream-5.0-edit';

// Static tool controls
let aspectRatioValue = '1:1';
let qualityValue = 'basic';
let targetIndexValue = '0';
let numImagesValue = '1';
let renderSpeedValue = 'Balanced';
let styleValue = 'Auto';
let watermarkPositionValue = 'bottom-right';
let watermarkOpacityValue = '0.7';
let watermarkScaleValue = '0.2';

// Dynamic model controls
const modelControlValues = {};
let dynamicControlsContainer = null;
```

### UI Controls

#### General Controls (always created, visibility toggled)
1. **Aspect Ratio** (`<select>`) — 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 21:9
2. **Quality** (`<select>`) — Basic, High
3. **Number of Images** (`<select>`) — 1, 2, 3, 4
4. **Render Speed** (`<select>`) — Turbo, Balanced, Quality
5. **Style** (`<select>`) — Auto, General, Realistic, Design

#### Tool-Specific Controls
6. **Target Face Index** (`<input type="number">`) — min=0, max=10, default=0
7. **Watermark Position** (`<select>`) — top-left, top-right, bottom-left, bottom-right, center
8. **Watermark Opacity** (`<input type="number">`) — min=0, max=1, step=0.1, default=0.7
9. **Watermark Scale** (`<input type="number">`) — min=0.1, max=1, step=0.1, default=0.2

#### Model Controls
10. **Model Selector** (`<select>`) — All EDIT_AI_MODELS, sorted alphabetically, default=seedream-5.0-edit

#### Prompt Controls
11. **Prompt Field** (`<input type="text">`) — hidden by default, shown for tools with `hasPrompt: true`

#### Dynamic Controls (model-specific)
Generated by `buildDynamicControls(modelId)` based on `model.inputs`:
- Skips `prompt` field
- For `enum` → `<select>` with enum values
- For `int`/`integer` → `<select>` with min-to-max stepping (CRUDE: generates potentially hundreds of options)
- For other types → `<select>` with single default value (CRUDE)

### Execution Logic

```javascript
editBtn.onclick = async () => {
  // 1. Check entitlement
  // 2. Check active tool
  // 3. Check upload
  // 4. Check API key
  // 5. Build params:
  //    - model: selectedModelId || activeTool.id
  //    - image_url: uploadedUrl
  //    - thumbnail_url: customThumbnailUrl
  //    - prompt: for tools with hasPrompt=true, or ai-product-shot (scene_description)
  //    - aspect_ratio, quality: for seedream-5.0-edit
  //    - aspect_ratio, render_speed, style, num_images: for ideogram-v3-reframe
  //    - position, opacity, scale: for add-image-watermark
  //    - target_index: for ai-image-face-swap
  //    - Dynamic model inputs from modelControlValues
  // 6. Call muapi.generateI2I(params)
  // 7. Render result or error
};
```

### Result Handling
- On success: shows `<img>` + download link
- On failure: shows error message in resultArea
- On no URL: shows "Edit completed, but no result image was returned"

### Historical Deficiencies (vs task requirements)

1. **Dynamic controls are crude**: ALL non-prompt model inputs are rendered as `<select>` dropdowns, even for:
   - Integer ranges with 100+ options (e.g., stylization: 0-1000)
   - Number inputs (e.g., opacity: 0.0-1.0)
   - Boolean inputs (e.g., google_search: true/false)
   - Free-form string inputs

2. **No validation**: Static controls have min/max attributes but no runtime validation before API call.

3. **Poor error UX**: Uses `alert()` for errors instead of inline display.

4. **Loading state is minimal**: Only changes button text, no spinner element.

5. **Model selector is hardcoded to AI Edit**: Only shown when `toolId === 'seedream-5.0-edit'`.

## Files That Reference EditStudio
- `src/lib/router.js` — route registration
- `src/components/EditStudio.js` — the component itself

## Related Model Definitions (from src/lib/models.js)

### i2iModels entry for seedream-5.0-edit
```json
{
  "id": "seedream-5.0-edit",
  "name": "Seedream 5.0 Edit",
  "provider": "bytedance",
  "endpoint": "seedream-5.0-edit",
  "family": "seedream",
  "imageField": "images_list",
  "hasPrompt": true,
  "inputs": {
    "prompt": { "type": "string", "title": "Prompt", "name": "prompt" },
    "aspect_ratio": { "type": "string", "enum": ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","21:9"], "default": "1:1" },
    "quality": { "type": "string", "enum": ["basic","high"], "default": "basic" }
  }
}
```

### i2iModels entry for ideogram-v3-reframe
```json
{
  "id": "ideogram-v3-reframe",
  "name": "Ideogram V3 Reframe",
  "provider": "ideogram",
  "endpoint": "ideogram-v3-reframe",
  "family": "reframe",
  "imageField": "image_url",
  "hasPrompt": false,
  "inputs": {
    "aspect_ratio": { "type": "string", "enum": [...], "default": "1:1" },
    "render_speed": { "type": "string", "enum": ["Turbo","Balanced","Quality"], "default": "Balanced" },
    "style": { "type": "string", "enum": ["Auto","General","Realistic","Design"], "default": "Auto" },
    "num_images": { "type": "int", "default": 1, "minValue": 1, "maxValue": 4, "step": 1 }
  }
}
```

### i2iModels entry for add-image-watermark
```json
{
  "id": "add-image-watermark",
  "name": "Add Image Watermark",
  "provider": "muapi",
  "endpoint": "add-image-watermark",
  "family": "tools",
  "imageField": "image_url",
  "hasPrompt": false,
  "inputs": {
    "watermark_image_url": { "type": "string", "title": "Watermark Image", "name": "watermark_image_url" },
    "position": { "type": "string", "enum": ["top-left","top-right","bottom-left","bottom-right","center"], "default": "bottom-right" },
    "opacity": { "type": "number", "default": 0.7, "minValue": 0, "maxValue": 1, "step": 0.1 },
    "scale": { "type": "number", "default": 0.2, "minValue": 0.1, "maxValue": 1, "step": 0.1 }
  }
}
```

### i2iModels entry for ai-image-face-swap
```json
{
  "id": "ai-image-face-swap",
  "name": "AI Image Face Swap",
  "provider": "muapi",
  "endpoint": "ai-image-face-swap",
  "family": "tools",
  "imageField": "image_url",
  "hasPrompt": false,
  "inputs": {
    "target_index": { "type": "int", "default": 0, "minValue": 0, "maxValue": 10, "step": 1 }
  }
}
```

### i2iModels entry for ai-product-shot
```json
{
  "id": "ai-product-shot",
  "name": "AI Product Shot",
  "provider": "muapi",
  "endpoint": "ai-product-shot",
  "family": "tools",
  "imageField": "image_url",
  "hasPrompt": false,
  "inputs": {
    "scene_description": { "type": "string", "title": "Scene Description", "name": "scene_description" }
  }
}
```
