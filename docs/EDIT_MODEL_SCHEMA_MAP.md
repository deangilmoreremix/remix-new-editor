# Edit Model Schema Map

## Source
- **File**: `src/lib/models.js`
- **Section**: `i2iModels` (lines 2502-4681)
- **Helper**: `getI2IModelById(id)` (line 7773)

## I2I Models Used by Edit Studio Tools

### Tool Models (direct tool→model mapping)

| Tool ID | Model ID | Provider | Endpoint | Image Field | Has Prompt | Model Inputs |
|---------|----------|----------|----------|-------------|------------|--------------|
| ai-object-eraser | ai-object-eraser | muapi | ai-object-eraser | image_url | false | none |
| ai-background-remover | ai-background-remover | muapi | ai-background-remover | image_url | false | none |
| ai-image-extension | ai-image-extension | muapi | ai-image-extension | image_url | false | none |
| seedream-5.0-edit | seedream-5.0-edit | bytedance | seedream-5.0-edit | images_list | true | prompt, aspect_ratio (enum), quality (enum) |
| ideogram-v3-reframe | ideogram-v3-reframe | ideogram | ideogram-v3-reframe | image_url | false | aspect_ratio (enum), render_speed (enum), style (enum), num_images (int) |
| ai-dress-change | ai-dress-change | muapi | ai-dress-change | model_image_url | false | none |
| ai-skin-enhancer | ai-skin-enhancer | muapi | ai-skin-enhancer | image_url | false | none |
| ai-color-photo | ai-color-photo | muapi | ai-color-photo | image_url | false | none |
| add-image-watermark | add-image-watermark | muapi | add-image-watermark | image_url | false | watermark_image_url (string), position (enum), opacity (number), scale (number) |
| ai-image-upscaler | ai-image-upscaler | muapi | ai-image-upscale | image_url | false | none |
| ai-image-face-swap | ai-image-face-swap | muapi | ai-image-face-swap | image_url | false | target_index (int) |
| ai-product-shot | ai-product-shot | muapi | ai-product-shot | image_url | false | scene_description (string) |
| ai-ghibli-style | ai-ghibli-style | muapi | ai-ghibli-style | image_url | false | none |

### AI Edit Models (user-selectable models for AI Edit tool)

| Model ID | Provider | Endpoint | Image Field | Has Prompt | Inputs |
|----------|----------|----------|-------------|------------|--------|
| flux-kontext-dev-i2i | blackforest | flux-kontext-dev-i2i | images_list | true | prompt, aspect_ratio (enum), num_images (int 1-4) |
| flux-kontext-pro-i2i | blackforest | flux-kontext-pro-i2i | images_list | true | prompt, aspect_ratio (enum) |
| flux-kontext-max-i2i | blackforest | flux-kontext-max-i2i | images_list | true | prompt, aspect_ratio (enum) |
| gpt4o-image-to-image | openai | gpt4o-image-to-image | images_list | true | prompt, aspect_ratio (enum), num_images (int enum: 1,2,4) |
| gpt4o-edit | openai | gpt4o-edit | image_url | true | prompt, aspect_ratio (enum) |
| gpt-image-1.5-edit | openai | gpt-image-1.5-edit | image_url | true | prompt, aspect_ratio (enum) |
| midjourney-v7-image-to-image | midjourney | midjourney-v7-image-to-image | image_url | true | prompt, speed (enum), aspect_ratio (enum), variety (int 0-100 step 5), stylization (int 0-1000 step 1), weirdness (int 0-3000 step 1) |
| midjourney-v7-style-reference | midjourney | midjourney-v7-style-reference | image_url | true | prompt, speed (enum), aspect_ratio (enum), variety (int 0-100 step 5), stylization (int 0-1000 step 1), weirdness (int 0-3000 step 1) |
| midjourney-v7-omni-reference | midjourney | midjourney-v7-omni-reference | image_url | true | prompt, speed (enum), aspect_ratio (enum), weight (int 1-1000 step 1), variety (int 0-100 step 5), stylization (int 0-1000 step 1), weirdness (int 0-3000 step 1) |
| bytedance-seededit-v3 | bytedance | bytedance-seededit-v3 | image_url | true | prompt |
| bytedance-seedream-edit-v4 | bytedance | bytedance-seedream-edit-v4 | image_url | true | prompt, aspect_ratio (enum), resolution (enum), num_images (int 1-4) |
| bytedance-seedream-v4.5-edit | bytedance | bytedance-seedream-v4.5-edit | image_url | true | prompt, aspect_ratio (enum), quality (enum) |
| nano-banana-edit | google | nano-banana-edit | image_url | true | prompt, aspect_ratio (enum) |
| nano-banana-pro-edit | google | nano-banana-pro-edit | image_url | true | prompt, aspect_ratio (enum), resolution (enum) |
| nano-banana-2-edit | google | nano-banana-2-edit | image_url | true | prompt, aspect_ratio (enum), resolution (enum), google_search (boolean), output_format (enum) |
| qwen-image-edit | alibaba | qwen-image-edit | image_url | true | prompt |
| qwen-image-edit-plus | alibaba | qwen-image-edit-plus | image_url | true | prompt, width (int 256-1536 step 1), height (int 256-1536 step 1) |
| qwen-image-edit-2511 | alibaba | qwen-image-edit-2511 | image_url | true | prompt, width (integer 256-1536 step 1), height (integer 256-1536 step 1) |
| ideogram-character | ideogram | ideogram-character | image_url | true | prompt, render_speed (enum), style (enum), aspect_ratio (enum), num_images (int 1-4) |
| wan2.5-image-edit | wan | wan2.5-image-edit | image_url | true | prompt, width (int 384-5000 step 1), height (int 384-5000 step 1) |
| wan2.6-image-edit | wan | wan2.6-image-edit | image_url | true | prompt |
| reve-image-edit | reve | reve-image-edit | image_url | true | prompt |
| kling-o1-edit-image | kling | kling-o1-edit-image | image_url | true | prompt |
| vidu-q2-reference-to-image | vidu | vidu-q2-reference-to-image | image_url | true | prompt, aspect_ratio (enum) |
| grok-imagine-image-to-image | grok | grok-imagine-image-to-image | image_url | true | prompt, aspect_ratio (enum) |
| flux-2-dev-edit | blackforest | flux-2-dev-edit | image_url | true | prompt, width (int 256-1536 step 1), height (int 256-1536 step 1) |
| flux-2-flex-edit | blackforest | flux-2-flex-edit | image_url | true | prompt, aspect_ratio (enum) |
| flux-2-pro-edit | blackforest | flux-2-pro-edit | image_url | true | prompt, aspect_ratio (enum) |
| flux-2-klein-4b-edit | blackforest | flux-2-klein-4b-edit | image_url | true | prompt |
| flux-2-klein-9b-edit | blackforest | flux-2-klein-9b-edit | image_url | true | prompt |
| flux-redux | blackforest | flux-redux | image_url | true | prompt, aspect_ratio (enum), num_images (int 1-4) |

## Model Input Type Reference

| Type | Current UI | Recommended UI | Examples |
|------|-----------|----------------|---------|
| enum | `<select>` | `<select>` | aspect_ratio, style, render_speed |
| int (small range ≤10 opts) | `<select>` | `<select>` | num_images (1-4) |
| int (large range >10 opts) | `<select>` (BAD) | `<input type="number">` | variety (0-100), stylization (0-1000) |
| integer | `<select>` (BAD) | `<input type="number">` | width, height |
| number | `<select>` (BAD) | `<input type="number">` | opacity, scale |
| boolean | Not supported | `<input type="checkbox">` | google_search |
| string (free-form) | `<select>` (BAD) | `<input type="text">` or `<textarea>` | prompt, scene_description |
| image | Not supported | Image uploader | watermark_image_url |
| image array | Not supported | Multi-image uploader | images_list |

## API Endpoint Mapping

| Model ID | Endpoint | generationType | studioType |
|----------|----------|----------------|------------|
| seedream-5.0-edit | seedream-5.0-edit | i2i | video (legacy) |
| ideogram-v3-reframe | ideogram-v3-reframe | i2i | video (legacy) |
| ai-image-face-swap | ai-image-face-swap | i2i | video (legacy) |
| ai-product-shot | ai-product-shot | i2i | video (legacy) |
| add-image-watermark | add-image-watermark | i2i | video (legacy) |
| (all others) | model.id | i2i | video (legacy) |

Note: The `studioType` in `generateI2I` is hardcoded to `'video'` in the current muapi.js implementation, which appears to be a legacy naming issue but is functional.
