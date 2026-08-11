# Edit Tool Control Matrix

## Mapping: Tool → Historical Controls → Current Controls → Missing Controls

### 1. Remove Object (ai-object-eraser)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 2. Remove Background (ai-background-remover)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 3. Extend Image (ai-image-extension)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 4. AI Edit (seedream-5.0-edit)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Model selector | ✅ | ✅ | — |
| Prompt field | ✅ | ✅ | — |
| Aspect ratio | ✅ (hardcoded) | ✅ (hardcoded) | Dynamic from model schema |
| Quality | ✅ (hardcoded) | ✅ (hardcoded) | Dynamic from model schema |
| Dynamic model controls | ✅ | ✅ (crude) | Proper widget types per input schema |
| **Status** | **Partially improved** | | **Dynamic control UX needs upgrade** |

**Gap**: The dynamic controls are generated as `<select>` for ALL types. For models like `midjourney-v7-image-to-image` with `variety` (0-100), `stylization` (0-1000), `weirdness` (0-3000), this creates selects with 21, 1001, and 3001 options respectively. These should be `<input type="number">` with min/max/step. For `nano-banana-2-edit` with `google_search` (boolean), this creates a broken single-option select instead of a checkbox.

### 5. Reframe (ideogram-v3-reframe)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Aspect ratio | ✅ | ✅ | — |
| Render speed | ✅ | ✅ | — |
| Style | ✅ | ✅ | — |
| Number of images | ✅ | ✅ | — |
| **Status** | **Fully implemented** | | |

### 6. Change Dress (ai-dress-change)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 7. Enhance Skin (ai-skin-enhancer)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 8. Colorize (ai-color-photo)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 9. Add Watermark (add-image-watermark)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Source image | ✅ | ✅ | — |
| Watermark image | ✅ (model input) | ❌ (NOT in UI) | **Watermark image upload** |
| Position | ✅ | ✅ | — |
| Opacity | ✅ | ✅ | — |
| Scale | ✅ | ✅ | — |
| **Status** | **Partially implemented** | | **Missing watermark image uploader** |

**Gap**: The `add-image-watermark` model has `watermark_image_url` input, but the current UI doesn't provide a second upload picker for the watermark image. Users can only set position/opacity/scale.

### 10. Upscale (ai-image-upscaler)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

### 11. Face Swap (ai-image-face-swap)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Source image | ✅ | ✅ | — |
| Target face | ✅ | ✅ (implicit via upload) | — |
| Target face index | ✅ | ✅ | — |
| **Status** | **Fully implemented** | | |

### 12. Product Shot (ai-product-shot)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Product image | ✅ | ✅ | — |
| Scene prompt | ✅ | ✅ | — |
| **Status** | **Fully implemented** | | |

### 13. Ghibli Style (ai-ghibli-style)

| Control | Historical | Current | Missing |
|---------|-----------|---------|---------|
| Upload image | ✅ | ✅ | — |
| Apply button | ✅ | ✅ | — |
| Model-specific controls | none | none | — |
| **Status** | **Fully implemented** | | |

## Summary of Missing Controls

| Priority | Control | Tool | Impact |
|----------|---------|------|--------|
| HIGH | Dynamic model controls: proper widget types | AI Edit | Users get broken/ugly controls for models with numeric ranges >10 options, booleans, or free-form strings |
| MEDIUM | Watermark image upload | Add Watermark | Users cannot specify a separate watermark image; only position/opacity/scale work |
| LOW | Input validation | All | No runtime validation before API call |
| LOW | Inline error display | All | Uses `alert()` instead of inline error rendering |
