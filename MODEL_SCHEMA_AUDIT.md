# SmartVideo Model Schema Audit

**Source:** `src/lib/models.js` (auto-generated from `models_dump.json`)
**Commit:** `cb987b2f` — "feat: consolidate cinema templates, AI workflows, and API key fixes"
**Total Models:** 246

## Model Registry Overview

| Family | Count | Description |
|--------|-------|-------------|
| `t2iModels` | 46 | Text-to-Image generation |
| `t2vModels` | 42 | Text-to-Video generation |
| `i2iModels` | 54 | Image-to-Image editing/transformations |
| `i2vModels` | 60 | Image-to-Video generation |
| `v2vModels` | 1 | Video-to-Video processing |
| `lipsyncModels` | 9 | Lip sync / speech-to-video |
| `audioModels` | 6 | Text-to-Audio, music, voice cloning |
| `avatarModels` | 12 | AI avatar generation |
| `trainingModels` | 2 | LoRA training models |
| `videoToolsModels` | 11 | Video tools (upscale, edit, translate) |
| `textModels` | 3 | LLM / text generation |

---

## t2iModels

### nano-banana

- **Name:** Nano Banana
- **Provider:** Google
- **Endpoint:** `nano-banana`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] |

**Required Inputs:** `prompt`

---

### flux-dev

- **Name:** Flux Dev
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-dev-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 128 | 2048 | 64 |  |
| `height` | Height | int | 1024 | 128 | 2048 | 64 |  |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-kontext-dev-t2i

- **Name:** Flux Kontext Dev T2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-dev-t2i`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### ai-anime-generator

- **Name:** Ai Anime Generator
- **Provider:** MuAPI
- **Endpoint:** `ai-anime-generator`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### wan2.1-text-to-image

- **Name:** Wan2.1 Text To Image
- **Provider:** Wan
- **Endpoint:** `wan2.1-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-kontext-pro-t2i

- **Name:** Flux Kontext Pro T2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-pro-t2i`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '16:21'] |

**Required Inputs:** `prompt`

---

### flux-kontext-max-t2i

- **Name:** Flux Kontext Max T2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-max-t2i`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '16:21'] |

**Required Inputs:** `prompt`

---

### gpt4o-text-to-image

- **Name:** Gpt4o Text To Image
- **Provider:** OpenAI
- **Endpoint:** `gpt4o-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '2:3', '3:2'] |
| `num_images` | Number of images | int | 1 |  |  |  | [1, 2, 4] |

**Required Inputs:** `prompt`

---

### midjourney-v7-text-to-image

- **Name:** Midjourney v7 Text To Image
- **Provider:** Midjourney
- **Endpoint:** `midjourney-v7-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `speed` | Speed | string | relaxed |  |  |  | ['relaxed', 'fast', 'turbo'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '1:2', '2:1', '2:3', '3:2', '5:6', '6:5'] |
| `variety` | Variety | int | 5 | 0 | 100 | 5 |  |
| `stylization` | Stylization | int | 1 | 0 | 1000 | 1 |  |
| `weirdness` | Weirdness | int | 1 | 0 | 3000 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-schnell

- **Name:** Flux Schnell
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-schnell-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 128 | 2048 | 64 |  |
| `height` | Height | int | 1024 | 128 | 2048 | 64 |  |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### qwen-image

- **Name:** Qwen Image
- **Provider:** Alibaba
- **Endpoint:** `qwen-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', '3:2', '2:3'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-pulid

- **Name:** Flux Pulid
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-pulid`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `image_url` | Image URL | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |

**Required Inputs:** `prompt`

**Image Inputs:** `image_url`

---

### ideogram-v3-t2i

- **Name:** Ideogram v3 T2I
- **Provider:** Ideogram
- **Endpoint:** `ideogram-v3-t2i`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `render_speed` | Render Speed | string | Balanced |  |  |  | ['Turbo', 'Balanced', 'Quality'] |
| `style` | Style | string | Auto |  |  |  | ['Auto', 'General', 'Realistic', 'Design'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '3:4', '4:3', '9:16', '16:9'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### google-imagen4

- **Name:** Google Imagen4
- **Provider:** Google
- **Endpoint:** `google-imagen4`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### google-imagen4-fast

- **Name:** Google Imagen4 Fast
- **Provider:** Google
- **Endpoint:** `google-imagen4-fast`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### google-imagen4-ultra

- **Name:** Google Imagen4 Ultra
- **Provider:** Google
- **Endpoint:** `google-imagen4-ultra`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |

**Required Inputs:** `prompt`

---

### sdxl-image

- **Name:** Sdxl Image
- **Provider:** Stability AI
- **Endpoint:** `sdxl-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### bytedance-seedream-v4

- **Name:** Bytedance Seedream v4
- **Provider:** ByteDance
- **Endpoint:** `bytedance-seedream-v4`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 4K |  |  |  | ['1K', '2K', '4K'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### hunyuan-image-2.1

- **Name:** Hunyuan Image 2.1
- **Provider:** Hunyuan
- **Endpoint:** `hunyuan-image-2.1`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### chroma-image

- **Name:** Chroma Image
- **Provider:** MuAPI
- **Endpoint:** `chroma-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-redux

- **Name:** Flux Redux
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-redux`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `image_url` | Image URL | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

**Image Inputs:** `image_url`

---

### flux-krea-dev

- **Name:** Flux Krea Dev
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-krea-dev`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### perfect-pony-xl

- **Name:** Perfect Pony Xl
- **Provider:** MuAPI
- **Endpoint:** `perfect-pony-xl`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### neta-lumina

- **Name:** Neta Lumina
- **Provider:** MuAPI
- **Endpoint:** `neta-lumina`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### wan2.5-text-to-image

- **Name:** Wan2.5 Text To Image
- **Provider:** Wan
- **Endpoint:** `wan2.5-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 768 | 1440 | 1 |  |
| `height` | Height | int | 1322 | 768 | 1440 | 1 |  |

**Required Inputs:** `prompt`

---

### hunyuan-image-3.0

- **Name:** Hunyuan Image 3.0
- **Provider:** Hunyuan
- **Endpoint:** `hunyuan-image-3.0`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### leonardoai-phoenix-1.0

- **Name:** Leonardoai Phoenix 1.0
- **Provider:** Leonardo AI
- **Endpoint:** `leonardoai-phoenix-1.0`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '4:5', '5:4', '2:3', '3:2'] |

**Required Inputs:** `prompt`

---

### leonardoai-lucid-origin

- **Name:** Leonardoai Lucid Origin
- **Provider:** Leonardo AI
- **Endpoint:** `leonardoai-lucid-origin`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '4:5', '5:4', '2:3', '3:2'] |

**Required Inputs:** `prompt`

---

### reve-text-to-image

- **Name:** Reve Text To Image
- **Provider:** Reve
- **Endpoint:** `reve-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '9:21'] |

**Required Inputs:** `prompt`

---

### grok-imagine-text-to-image

- **Name:** Grok Imagine Text To Image
- **Provider:** Grok
- **Endpoint:** `grok-imagine-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['9:16', '16:9', '2:3', '3:2', '1:1'] |

**Required Inputs:** `prompt`

---

### nano-banana-pro

- **Name:** Nano Banana Pro
- **Provider:** Google
- **Endpoint:** `nano-banana-pro`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |

**Required Inputs:** `prompt`

---

### kling-o1-text-to-image

- **Name:** Kling O1 Text To Image
- **Provider:** Kling
- **Endpoint:** `kling-o1-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |
| `num_images` | Number of images | int | 1 | 1 | 9 | 1 |  |

**Required Inputs:** `prompt`

---

### z-image-turbo

- **Name:** Z Image Turbo
- **Provider:** MuAPI
- **Endpoint:** `z-image-turbo`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-2-dev

- **Name:** Flux 2 Dev
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-dev`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-2-flex

- **Name:** Flux 2 Flex
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-flex`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |

**Required Inputs:** `prompt`

---

### flux-2-pro

- **Name:** Flux 2 Pro
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-pro`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |

**Required Inputs:** `prompt`

---

### vidu-q2-text-to-image

- **Name:** Vidu Q2 Text To Image
- **Provider:** Vidu
- **Endpoint:** `vidu-q2-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |

**Required Inputs:** `prompt`

---

### bytedance-seedream-v4.5

- **Name:** Bytedance Seedream V4.5
- **Provider:** ByteDance
- **Endpoint:** `bytedance-seedream-v4.5`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `quality` | Quality | string | basic |  |  |  | ['basic', 'high'] |

**Required Inputs:** `prompt`

---

### gpt-image-1.5

- **Name:** Gpt Image 1.5
- **Provider:** OpenAI
- **Endpoint:** `gpt-image-1.5`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '2:3', '3:2'] |
| `quality` | Quality | string | medium |  |  |  | ['low', 'medium', 'high'] |

**Required Inputs:** `prompt`

---

### wan2.6-text-to-image

- **Name:** Wan2.6 Text To Image
- **Provider:** Wan
- **Endpoint:** `wan2.6-text-to-image`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 768 | 1440 | 1 |  |
| `height` | Height | int | 1024 | 768 | 1440 | 1 |  |

**Required Inputs:** `prompt`

---

### qwen-text-to-image-2512

- **Name:** Qwen Text To Image 2512
- **Provider:** Alibaba
- **Endpoint:** `qwen-text-to-image-2512`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | integer | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | integer | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-2-klein-4b

- **Name:** Flux 2 Klein 4b
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-klein-4b`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '9:21'] |

**Required Inputs:** `prompt`

---

### flux-2-klein-9b

- **Name:** Flux 2 Klein 9b
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-klein-9b`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '9:21'] |

**Required Inputs:** `prompt`

---

### z-image-base

- **Name:** Z Image Base
- **Provider:** MuAPI
- **Endpoint:** `z-image-base`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `image_url` | Image URL | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '9:21'] |
| `strength` | Strength | int | 0.6 | 0 | 1 | 0.01 |  |

**Required Inputs:** `prompt`

**Image Inputs:** `image_url`

---

### nano-banana-2

- **Name:** Nano Banana 2
- **Provider:** Google
- **Endpoint:** `nano-banana-2`
- **Family:** `nano`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | auto |  |  |  | ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |
| `google_search` | Google Search | boolean | False |  |  |  |  |
| `output_format` | Output Format | string | jpg |  |  |  | ['jpg', 'png'] |

**Required Inputs:** `prompt`

---

### seedream-5.0

- **Name:** Seedream 5.0
- **Provider:** ByteDance
- **Endpoint:** `seedream-5.0`
- **Family:** `seedream`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `quality` | Quality | string | basic |  |  |  | ['basic', 'high'] |

**Required Inputs:** `prompt`

---

## t2vModels

### seedance-lite-t2v

- **Name:** Seedance Lite
- **Provider:** ByteDance
- **Endpoint:** `seedance-lite-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### seedance-pro-t2v

- **Name:** Seedance Pro
- **Provider:** ByteDance
- **Endpoint:** `seedance-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### seedance-pro-t2v-fast

- **Name:** Seedance Pro Fast
- **Provider:** ByteDance
- **Endpoint:** `seedance-pro-t2v-fast`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### seedance-v1.5-pro-t2v

- **Name:** Seedance v1.5 Pro
- **Provider:** ByteDance
- **Endpoint:** `seedance-v1.5-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### seedance-v1.5-pro-t2v-fast

- **Name:** Seedance v1.5 Pro Fast
- **Provider:** ByteDance
- **Endpoint:** `seedance-v1.5-pro-t2v-fast`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |

**Required Inputs:** `prompt`

---

### seedance-v2.0-t2v

- **Name:** Seedance 2.0
- **Provider:** ByteDance
- **Endpoint:** `seedance-v2.0-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10, 15] |
| `quality` | Quality | string | basic |  |  |  | ['high', 'basic'] |

**Required Inputs:** `prompt`

---

### seedance-v2.0-extend

- **Name:** Seedance 2.0 Extend
- **Provider:** ByteDance
- **Endpoint:** `seedance-v2.0-extend`
- **Requires Request ID:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `request_id` | Request ID | string |  |  |  |  |  |
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 |  |  |  | [5, 10, 15] |
| `quality` | Quality | string | basic |  |  |  | ['high', 'basic'] |

**Required Inputs:** `prompt`

**Video Inputs:** `request_id`

---

### kling-v2.1-master-t2v

- **Name:** Kling v2.1 Master
- **Provider:** Kling
- **Endpoint:** `kling-v2.1-master-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  |  |

**Required Inputs:** `prompt`

---

### kling-v2.5-turbo-pro-t2v

- **Name:** Kling v2.5 Turbo Pro
- **Provider:** Kling
- **Endpoint:** `kling-v2.5-turbo-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 9:16 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  |  |

**Required Inputs:** `prompt`

---

### kling-v2.6-pro-t2v

- **Name:** Kling v2.6 Pro
- **Provider:** Kling
- **Endpoint:** `kling-v2.6-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### kling-o1-text-to-video

- **Name:** Kling O1 Pro
- **Provider:** Kling
- **Endpoint:** `kling-o1-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### kling-v3.0-pro-text-to-video

- **Name:** Kling v3.0 Pro
- **Provider:** Kling
- **Endpoint:** `kling-v3.0-pro-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  |  |

**Required Inputs:** `prompt`

---

### kling-v3.0-standard-text-to-video

- **Name:** Kling v3.0 Standard
- **Provider:** Kling
- **Endpoint:** `kling-v3.0-standard-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  |  |

**Required Inputs:** `prompt`

---

### veo3-text-to-video

- **Name:** Veo 3
- **Provider:** MuAPI
- **Endpoint:** `veo3-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### veo3-fast-text-to-video

- **Name:** Veo 3 Fast
- **Provider:** MuAPI
- **Endpoint:** `veo3-fast-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### veo3.1-text-to-video

- **Name:** Veo 3.1
- **Provider:** MuAPI
- **Endpoint:** `veo3.1-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 8 |  |  |  | [8] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### veo3.1-fast-text-to-video

- **Name:** Veo 3.1 Fast
- **Provider:** MuAPI
- **Endpoint:** `veo3.1-fast-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 8 |  |  |  | [8] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### runway-text-to-video

- **Name:** Runway Gen-3
- **Provider:** Runway
- **Endpoint:** `runway-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 8] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |

**Required Inputs:** `prompt`

---

### wan2.1-text-to-video

- **Name:** Wan 2.1
- **Provider:** Wan
- **Endpoint:** `wan2.1-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |

**Required Inputs:** `prompt`

---

### wan2.2-text-to-video

- **Name:** Wan 2.2
- **Provider:** Wan
- **Endpoint:** `wan2.2-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |

**Required Inputs:** `prompt`

---

### wan2.2-5b-fast-t2v

- **Name:** Wan 2.2 Fast
- **Provider:** Wan
- **Endpoint:** `wan2.2-5b-fast-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '580p', '720p'] |

**Required Inputs:** `prompt`

---

### wan2.5-text-to-video

- **Name:** Wan 2.5
- **Provider:** Wan
- **Endpoint:** `wan2.5-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### wan2.5-text-to-video-fast

- **Name:** Wan 2.5 Fast
- **Provider:** Wan
- **Endpoint:** `wan2.5-text-to-video-fast`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |

**Required Inputs:** `prompt`

---

### wan2.6-text-to-video

- **Name:** Wan 2.6
- **Provider:** Wan
- **Endpoint:** `wan2.6-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10, 15] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |

**Required Inputs:** `prompt`

---

### hunyuan-text-to-video

- **Name:** Hunyuan
- **Provider:** Hunyuan
- **Endpoint:** `hunyuan-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |

**Required Inputs:** `prompt`

---

### hunyuan-fast-text-to-video

- **Name:** Hunyuan Fast
- **Provider:** Hunyuan
- **Endpoint:** `hunyuan-fast-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |

**Required Inputs:** `prompt`

---

### pixverse-v4.5-t2v

- **Name:** Pixverse v4.5
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v4.5-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '540p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### pixverse-v5-t2v

- **Name:** Pixverse v5
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v5-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '540p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### pixverse-v5.5-t2v

- **Name:** Pixverse v5.5
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v5.5-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 8, 10] |
| `resolution` | Resolution | string | 360p |  |  |  | ['360p', '540p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-02-standard-t2v

- **Name:** Hailuo 02 Standard
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-02-standard-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |
| `resolution` | Resolution | string | 768P |  |  |  | ['768P'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-02-pro-t2v

- **Name:** Hailuo 02 Pro
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-02-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6] |
| `resolution` | Resolution | string | 1080P |  |  |  | ['1080P'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-2.3-pro-t2v

- **Name:** Hailuo 2.3 Pro
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-2.3-pro-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-2.3-standard-t2v

- **Name:** Hailuo 2.3 Standard
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-2.3-standard-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |

**Required Inputs:** `prompt`

---

### openai-sora

- **Name:** Sora
- **Provider:** OpenAI
- **Endpoint:** `openai-sora`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

### openai-sora-2-text-to-video

- **Name:** Sora 2
- **Provider:** OpenAI
- **Endpoint:** `openai-sora-2-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 10 |  |  |  | [10, 15] |

**Required Inputs:** `prompt`

---

### openai-sora-2-pro-text-to-video

- **Name:** Sora 2 Pro
- **Provider:** OpenAI
- **Endpoint:** `openai-sora-2-pro-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 10 |  |  |  | [10, 15, 25] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |

**Required Inputs:** `prompt`

---

### vidu-v2.0-t2v

- **Name:** Vidu v2.0
- **Provider:** Vidu
- **Endpoint:** `vidu-v2.0-t2v`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 9:16 |  |  |  | ['9:16'] |
| `duration` | Duration | int | 4 |  |  |  | [4] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### ovi-text-to-video

- **Name:** OVI
- **Provider:** OVI
- **Endpoint:** `ovi-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### grok-imagine-text-to-video

- **Name:** Grok Imagine
- **Provider:** Grok
- **Endpoint:** `grok-imagine-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['9:16', '16:9', '2:3', '3:2', '1:1'] |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |

**Required Inputs:** `prompt`

---

### ltx-2-pro-text-to-video

- **Name:** LTX 2 Pro
- **Provider:** LTX
- **Endpoint:** `ltx-2-pro-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 8, 10] |

**Required Inputs:** `prompt`

---

### ltx-2-fast-text-to-video

- **Name:** LTX 2 Fast
- **Provider:** LTX
- **Endpoint:** `ltx-2-fast-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 8, 10, 12, 14, 16, 18, 20] |

**Required Inputs:** `prompt`

---

### ltx-2-19b-text-to-video

- **Name:** LTX 2 19B
- **Provider:** LTX
- **Endpoint:** `ltx-2-19b-text-to-video`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |

**Required Inputs:** `prompt`

---

## i2iModels

### ai-image-upscaler

- **Name:** AI Image Upscaler
- **Provider:** MuAPI
- **Endpoint:** `ai-image-upscale`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### ai-image-face-swap

- **Name:** AI Image Face Swap
- **Provider:** MuAPI
- **Endpoint:** `ai-image-face-swap`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `target_index` | Target Index | int | 0 | 0 | 10 | 1 |  |

---

### ai-dress-change

- **Name:** AI Dress Change
- **Provider:** MuAPI
- **Endpoint:** `ai-dress-change`
- **Family:** `tools`
- **Image Field:** `model_image_url`
- **Has Prompt:** `False`
---

### ai-background-remover

- **Name:** AI Background Remover
- **Provider:** MuAPI
- **Endpoint:** `ai-background-remover`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### ai-product-shot

- **Name:** AI Product Shot
- **Provider:** MuAPI
- **Endpoint:** `ai-product-shot`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `scene_description` | Scene Description | string |  |  |  |  |  |

---

### ai-skin-enhancer

- **Name:** AI Skin Enhancer
- **Provider:** MuAPI
- **Endpoint:** `ai-skin-enhancer`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### ai-color-photo

- **Name:** AI Color Photo
- **Provider:** MuAPI
- **Endpoint:** `ai-color-photo`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### flux-kontext-dev-i2i

- **Name:** Flux Kontext Dev I2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-dev-i2i`
- **Family:** `kontext`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### ai-product-photography

- **Name:** AI Product Photography
- **Provider:** MuAPI
- **Endpoint:** `ai-product-photography`
- **Family:** `tools`
- **Image Field:** `person_image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### ai-ghibli-style

- **Name:** AI Ghibli Style
- **Provider:** MuAPI
- **Endpoint:** `ai-ghibli-style`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### ai-image-extension

- **Name:** AI Image Extension
- **Provider:** MuAPI
- **Endpoint:** `ai-image-extension`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### ai-object-eraser

- **Name:** AI Object Eraser
- **Provider:** MuAPI
- **Endpoint:** `ai-object-eraser`
- **Family:** `tools`
- **Image Field:** `image_url`
- **Has Prompt:** `False`
---

### flux-kontext-pro-i2i

- **Name:** Flux Kontext Pro I2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-pro-i2i`
- **Family:** `kontext`
- **Image Field:** `images_list`
- **Max Images:** `2`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '16:21'] |

**Required Inputs:** `prompt`

---

### flux-kontext-max-i2i

- **Name:** Flux Kontext Max I2I
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-max-i2i`
- **Family:** `kontext`
- **Image Field:** `images_list`
- **Max Images:** `2`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '16:21'] |

**Required Inputs:** `prompt`

---

### gpt4o-image-to-image

- **Name:** GPT-4o Image To Image
- **Provider:** OpenAI
- **Endpoint:** `gpt4o-image-to-image`
- **Family:** `gpt`
- **Image Field:** `images_list`
- **Max Images:** `5`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '2:3', '3:2'] |
| `num_images` | Number of images | int | 1 |  |  |  | [1, 2, 4] |

**Required Inputs:** `prompt`

---

### gpt4o-edit

- **Name:** GPT-4o Edit
- **Provider:** OpenAI
- **Endpoint:** `gpt4o-edit`
- **Family:** `gpt`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '2:3', '3:2'] |
| `num_images` | Number of images | int | 1 |  |  |  | [1, 2, 4] |

**Required Inputs:** `prompt`

---

### midjourney-v7-image-to-image

- **Name:** Midjourney v7 Image To Image
- **Provider:** Midjourney
- **Endpoint:** `midjourney-v7-image-to-image`
- **Family:** `midjourney`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `speed` | Speed | string | relaxed |  |  |  | ['relaxed', 'fast', 'turbo'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '1:2', '2:1', '2:3', '3:2', '5:6', '6:5'] |
| `variety` | Variety | int | 5 | 0 | 100 | 5 |  |
| `stylization` | Stylization | int | 1 | 0 | 1000 | 1 |  |
| `weirdness` | Weirdness | int | 1 | 0 | 3000 | 1 |  |

**Required Inputs:** `prompt`

---

### bytedance-seededit-v3

- **Name:** Bytedance Seededit v3
- **Provider:** ByteDance
- **Endpoint:** `bytedance-seededit-image`
- **Family:** `seedream`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### midjourney-v7-style-reference

- **Name:** Midjourney v7 Style Reference
- **Provider:** Midjourney
- **Endpoint:** `midjourney-v7-style-reference`
- **Family:** `midjourney`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `speed` | Speed | string | relaxed |  |  |  | ['relaxed', 'fast', 'turbo'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '1:2', '2:1', '2:3', '3:2', '5:6', '6:5'] |
| `variety` | Variety | int | 5 | 0 | 100 | 5 |  |
| `stylization` | Stylization | int | 1 | 0 | 1000 | 1 |  |
| `weirdness` | Weirdness | int | 1 | 0 | 3000 | 1 |  |

**Required Inputs:** `prompt`

---

### midjourney-v7-omni-reference

- **Name:** Midjourney v7 Omni Reference
- **Provider:** Midjourney
- **Endpoint:** `midjourney-v7-omni-reference`
- **Family:** `midjourney`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `speed` | Speed | string | relaxed |  |  |  | ['relaxed', 'fast', 'turbo'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '1:2', '2:1', '2:3', '3:2', '5:6', '6:5'] |
| `weight` | Weight | int | 100 | 1 | 1000 | 1 |  |
| `variety` | Variety | int | 5 | 0 | 100 | 5 |  |
| `stylization` | Stylization | int | 1 | 0 | 1000 | 1 |  |
| `weirdness` | Weirdness | int | 1 | 0 | 3000 | 1 |  |

**Required Inputs:** `prompt`

---

### minimax-image-01-subject-reference

- **Name:** Minimax Image 01 Subject Reference
- **Provider:** MiniMax
- **Endpoint:** `minimax-01-subject-reference`
- **Family:** `minimax`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### ideogram-character

- **Name:** Ideogram Character
- **Provider:** Ideogram
- **Endpoint:** `ideogram-character`
- **Family:** `ideogram`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `render_speed` | Render Speed | string | Balanced |  |  |  | ['Turbo', 'Balanced', 'Quality'] |
| `style` | Style | string | Auto |  |  |  | ['Auto', 'Realistic', 'Fiction'] |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-pulid

- **Name:** Flux Pulid
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-pulid`
- **Family:** `flux`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |

**Required Inputs:** `prompt`

---

### qwen-image-edit

- **Name:** Qwen Image Edit
- **Provider:** Alibaba
- **Endpoint:** `qwen-image-edit`
- **Family:** `qwen`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', '3:2', '2:3'] |

**Required Inputs:** `prompt`

---

### image-effects

- **Name:** Image Effects
- **Provider:** MuAPI
- **Endpoint:** `image-effects`
- **Family:** `effects`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `name` | Effect Name | string | Angel Figurine |  |  |  | ['Acrylic Ornaments', 'Advanced Photography', 'American Comic Style', 'Angel Figurine', 'Blurry Selfie', 'Cyberpunk', 'Exotic Charm', 'Felt 3D Polaroid', 'Felt Keychain', 'Furry Dream Doll', 'Futuristic American Comics', 'Glass Ball', 'In The Stadium', 'Lofi Pixel Character', 'Lying On Fluffy Belly', 'Landscape Mini World', 'My World', 'Plastic Bubble Figure'] |

---

### nano-banana-edit

- **Name:** Nano Banana Edit
- **Provider:** Google
- **Endpoint:** `nano-banana-edit`
- **Family:** `nano`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | Auto |  |  |  | ['Auto', '1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] |

**Required Inputs:** `prompt`

---

### ideogram-v3-reframe

- **Name:** Ideogram v3 Reframe
- **Provider:** Ideogram
- **Endpoint:** `ideogram-v3-reframe`
- **Family:** `ideogram`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `render_speed` | Render Speed | string | Balanced |  |  |  | ['Turbo', 'Balanced', 'Quality'] |
| `style` | Style | string | Auto |  |  |  | ['Auto', 'General', 'Realistic', 'Design'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

---

### bytedance-seedream-edit-v4

- **Name:** Bytedance Seedream Edit v4
- **Provider:** ByteDance
- **Endpoint:** `bytedance-seedream-edit-v4`
- **Family:** `seedream`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 4K |  |  |  | ['1K', '2K', '4K'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### nano-banana-effects

- **Name:** Nano Banana Effects
- **Provider:** Google
- **Endpoint:** `nano-banana-effects`
- **Family:** `nano`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `name` | Effect Name | string | 3D Figurine |  |  |  | ['3D Figurine', '16bit Game Character', '1920s Decade', '1950s Decade', '1970s Decade', '1980s Decade', 'Action Figure', 'American Gothic Art', 'Egypts Landmark', 'Eiffel Tower Landmark', 'Famous Art', 'Great Wall of China Landmark', 'Mona Lisa Art', 'Persistent Memory Art', 'Statue of Liberty Landmark', 'Taj Mahal Landmark', 'Vincent Van Gogh Art'] |
| `aspect_ratio` | Aspect Ratio | string | Auto |  |  |  | ['Auto', '1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] |

---

### flux-kontext-effects

- **Name:** Flux Kontext Effects
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-kontext-effects`
- **Family:** `kontext`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `name` | Effect Name | string | Age Progression |  |  |  | ['Age Progression', 'Background Change', 'Cartoonify', 'Color Correction', 'Expression Change', 'Face Enhancement', 'Hair Change', 'Object Removal', 'Professional Photo', 'Scene Composition', 'Style Transfer', 'Time of Day', 'Weather Effect'] |

**Required Inputs:** `prompt`

---

### flux-redux

- **Name:** Flux Redux
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-redux`
- **Family:** `flux`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'] |
| `num_images` | Number of images | int | 1 | 1 | 4 | 1 |  |

**Required Inputs:** `prompt`

---

### qwen-image-edit-plus

- **Name:** Qwen Image Edit Plus
- **Provider:** Alibaba
- **Endpoint:** `qwen-image-edit-plus`
- **Family:** `qwen`
- **Image Field:** `images_list`
- **Max Images:** `3`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### wan2.5-image-edit

- **Name:** Wan2.5 Image Edit
- **Provider:** Wan
- **Endpoint:** `wan2.5-image-edit`
- **Family:** `wan2.5`
- **Image Field:** `images_list`
- **Max Images:** `2`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 2048 | 384 | 5000 | 1 |  |
| `height` | Height | int | 2048 | 384 | 5000 | 1 |  |

**Required Inputs:** `prompt`

---

### reve-image-edit

- **Name:** Reve Image Edit
- **Provider:** Reve
- **Endpoint:** `reve-image-edit`
- **Family:** `reve`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### topaz-image-upscale

- **Name:** Topaz Image Upscale
- **Provider:** Topaz
- **Endpoint:** `topaz-image-upscale`
- **Family:** `topaz`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `upscale_factor` | Upscale Factor | string | 2 |  |  |  | [1, 2, 4, 8] |

---

### seedvr2-image-upscale

- **Name:** Seedvr2 Image Upscale
- **Provider:** ByteDance
- **Endpoint:** `seedvr2-image-upscale`
- **Family:** `seedvr2`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 4k |  |  |  | ['2k', '4k', '8k'] |

---

### qwen-image-edit-plus-lora

- **Name:** Qwen Image Edit Plus Lora
- **Provider:** Alibaba
- **Endpoint:** `qwen-image-edit-plus-lora`
- **Family:** `qwen`
- **Image Field:** `images_list`
- **Max Images:** `3`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `rotate_right_left` | Rotate Right-Left (degrees°) | int | 0 | -90 | 90 | 1 |  |
| `move_forward` | Move Forward → Close-Up | int | 0 | 0 | 10 | 0.1 |  |
| `vertical_angle` | Vertical Angle (Bird ⬄ Worm) | int | 0 | -1 | 1 | 0.1 |  |
| `wide_angle_lens` | Wide-Angle Lens | boolean | False |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

---

### nano-banana-pro-edit

- **Name:** Nano Banana Pro Edit
- **Provider:** Google
- **Endpoint:** `nano-banana-pro-edit`
- **Family:** `nano`
- **Image Field:** `images_list`
- **Max Images:** `8`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |

**Required Inputs:** `prompt`

---

### kling-o1-edit-image

- **Name:** Kling O1 Edit Image
- **Provider:** Kling
- **Endpoint:** `kling-o1-edit-image`
- **Family:** `kling-o1`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |

**Required Inputs:** `prompt`

---

### flux-2-dev-edit

- **Name:** Flux 2 Dev Edit
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-dev-edit`
- **Family:** `flux-2`
- **Image Field:** `images_list`
- **Max Images:** `3`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | int | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | int | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### flux-2-flex-edit

- **Name:** Flux 2 Flex Edit
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-flex-edit`
- **Family:** `flux-2`
- **Image Field:** `images_list`
- **Max Images:** `8`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |

**Required Inputs:** `prompt`

---

### flux-2-pro-edit

- **Name:** Flux 2 Pro Edit
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-pro-edit`
- **Family:** `flux-2`
- **Image Field:** `images_list`
- **Max Images:** `8`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k'] |

**Required Inputs:** `prompt`

---

### vidu-q2-reference-to-image

- **Name:** Vidu Q2 Reference To Image
- **Provider:** Vidu
- **Endpoint:** `vidu-q2-reference-to-image`
- **Family:** `vidu-q2`
- **Image Field:** `images_list`
- **Max Images:** `7`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |

**Required Inputs:** `prompt`

---

### bytedance-seedream-v4.5-edit

- **Name:** Bytedance Seedream v4.5 Edit
- **Provider:** ByteDance
- **Endpoint:** `bytedance-seedream-v4.5-edit`
- **Family:** `seedream-v45`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `quality` | Quality | string | basic |  |  |  | ['basic', 'high'] |

**Required Inputs:** `prompt`

---

### qwen-image-edit-2511

- **Name:** Qwen Image Edit 2511
- **Provider:** Alibaba
- **Endpoint:** `qwen-image-edit-2511`
- **Family:** `qwen`
- **Image Field:** `images_list`
- **Max Images:** `3`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | integer | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | integer | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### wan2.6-image-edit

- **Name:** Wan2.6 Image Edit
- **Provider:** Wan
- **Endpoint:** `wan2.6-image-edit`
- **Family:** `wan2.6`
- **Image Field:** `images_list`
- **Max Images:** `3`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### qwen-text-to-image-2512

- **Name:** Qwen Text To Image 2512
- **Provider:** Alibaba
- **Endpoint:** `qwen-text-to-image-2512`
- **Family:** `qwen`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `width` | Width | integer | 1024 | 256 | 1536 | 1 |  |
| `height` | Height | integer | 1024 | 256 | 1536 | 1 |  |

**Required Inputs:** `prompt`

---

### gpt-image-1.5-edit

- **Name:** Gpt Image 1.5 Edit
- **Provider:** OpenAI
- **Endpoint:** `gpt-image-1.5-edit`
- **Family:** `gpt-1.5`
- **Image Field:** `images_list`
- **Max Images:** `10`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '2:3', '3:2'] |
| `quality` | Quality | string | medium |  |  |  | ['low', 'medium', 'high'] |

**Required Inputs:** `prompt`

---

### grok-imagine-image-to-image

- **Name:** Grok Imagine Image To Image
- **Provider:** Grok
- **Endpoint:** `grok-imagine-image-to-image`
- **Family:** `grok`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### flux-2-klein-4b-edit

- **Name:** Flux 2 Klein 4b Edit
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-klein-4b-edit`
- **Family:** `flux-2`
- **Image Field:** `images_list`
- **Max Images:** `4`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '9:21'] |

**Required Inputs:** `prompt`

---

### flux-2-klein-9b-edit

- **Name:** Flux 2 Klein 9b Edit
- **Provider:** Black Forest Labs
- **Endpoint:** `flux-2-klein-9b-edit`
- **Family:** `flux-2`
- **Image Field:** `images_list`
- **Max Images:** `4`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '9:21'] |

**Required Inputs:** `prompt`

---

### add-image-watermark

- **Name:** Add Image Watermark
- **Provider:** MuAPI
- **Endpoint:** `add-image-watermark`
- **Family:** `watermark`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `position` | Position | string | bottom-right |  |  |  | ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] |
| `opacity` | Opacity | number | 0.7 |  |  |  |  |
| `scale` | Scale | number | 0.2 |  |  |  |  |

---

### nano-banana-2-edit

- **Name:** Nano Banana 2 Edit
- **Provider:** Google
- **Endpoint:** `nano-banana-2-edit`
- **Family:** `nano`
- **Image Field:** `images_list`
- **Max Images:** `14`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | auto |  |  |  | ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto'] |
| `resolution` | Resolution | string | 1k |  |  |  | ['1k', '2k', '4k'] |
| `google_search` | Google Search | boolean | False |  |  |  |  |
| `output_format` | Output Format | string | jpg |  |  |  | ['jpg', 'png'] |

**Required Inputs:** `prompt`

---

### seedream-5.0-edit

- **Name:** Seedream 5.0 Edit
- **Provider:** ByteDance
- **Endpoint:** `seedream-5.0-edit`
- **Family:** `seedream`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'] |
| `quality` | Quality | string | basic |  |  |  | ['basic', 'high'] |

**Required Inputs:** `prompt`

---

## i2vModels

### ai-video-effects

- **Name:** AI Video Effects
- **Provider:** MuAPI
- **Endpoint:** `generate_wan_ai_effects`
- **Family:** `effects`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `name` | Effect Type | string | Cakeify |  |  |  | ['360 Rotation', 'Abandoned Places', 'Angry', 'Animal Documentary', 'Assassin It', 'Baby It', 'Boxing', 'Bride It', 'Cakeify', 'Cartoon Jaw Drop', 'Cats', 'Crush It', 'Crying', 'Cyberpunk 2077', 'Deflate It', 'Disney Princess It', 'Dogs', 'Eye Close-Up', 'Fantasy Landscapes', 'Film Noir', 'Fire', 'Glamor', 'Goblin', 'Gun Reveal', 'Hug Jesus', 'Hulk Transformation', 'Inflate It', 'Jungle It', 'Jumpscare', 'Kamehameha', 'Kiss Cam', 'Kissing', 'Lego', 'Laughing', 'Little Planet', 'Live Wallpaper', 'Looping Pixel Art', 'Melt It', 'Mona Lisa It', 'Museum It', 'Muscle Show Off', 'Orc', 'Pixar', 'Pirate Captain', 'POV Driving', 'Princess It', 'Puppy it', 'Robotic Face Reveal', 'Samurai It', 'Sharingan Eyes', 'Skyrim Fus-Ro-Dah', 'Snow White It', 'Squish It', 'Steamboat Willie', 'Super Saiyan Transformation', 'Tsunami', 'Ultra Wide', 'VHS Footage', 'VIP It', 'Warrior It', 'Wind Blast', 'Younger Self Selfie', 'Zen It', 'Zoom Call'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### motion-controls

- **Name:** Motion Controls
- **Provider:** MuAPI
- **Endpoint:** `generate_wan_ai_effects`
- **Family:** `effects`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `name` | Effect Type | string | 360 Orbit |  |  |  | ['360 Orbit', 'Arc Shot', 'Car Chase', 'Car Mount Cam', 'Crash Zoom In', 'Crash Zoom Out', 'Crane Down', 'Crane Overhead', 'Crane Punch-In', 'Crane Up', 'Dirty Lens', 'Dolly In', 'Dolly Left', 'Dolly Out', 'Dolly Right', 'Dolly Zoom In', 'Dolly Zoom Out', 'Dutch Angle', 'Fast Dolly Zoom In', 'Fast Dolly Zoom Out', 'Fisheye Lens', 'Focus Shift', 'FPV Drone Cam', 'Handheld Cam', 'Head Tracking', 'Hero Run', 'Human Timelapse', 'Landscape Timelapse', 'Lazy Susan', 'Lens Crack', 'Lens Flare', 'Matrix Shot', 'Motion Blur', 'Object POV', 'Overhead', 'Rap Video Cam', 'Robotic Cam', 'Snorricam', 'Tilt Down', 'Tilt Up', 'Whip Pan', 'Wiggle', 'Zoom In', 'Zoom In Through Object', 'Zoom Into Mouth', 'Zoom Out', 'Zoom Out Through Object'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### vfx

- **Name:** VFX
- **Provider:** MuAPI
- **Endpoint:** `generate_wan_ai_effects`
- **Family:** `effects`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `name` | Effect Type | string | Car Explosion |  |  |  | ['Building Explosion', 'Car Explosion', 'Decay Time-Lapse', 'Disintegration', 'Electricity', 'Flying', 'Huge Explosion', 'Levitate', 'Tornado'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### veo3-image-to-video

- **Name:** Veo3 Image To Video
- **Provider:** MuAPI
- **Endpoint:** `veo3-image-to-video`
- **Family:** `veo`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### veo3-fast-image-to-video

- **Name:** Veo3 Fast Image To Video
- **Provider:** MuAPI
- **Endpoint:** `veo3-fast-image-to-video`
- **Family:** `veo`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### runway-image-to-video

- **Name:** Runway Image To Video
- **Provider:** Runway
- **Endpoint:** `runway-image-to-video`
- **Family:** `runway`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 8] |

**Required Inputs:** `prompt`

---

### wan2.1-image-to-video

- **Name:** Wan2.1 Image To Video
- **Provider:** Wan
- **Endpoint:** `wan2.1-image-to-video`
- **Family:** `wan2.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### midjourney-v7-image-to-video

- **Name:** Midjourney v7 Image To Video
- **Provider:** Midjourney
- **Endpoint:** `midjourney-v7-image-to-video`
- **Family:** `midjourney`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['1:1', '16:9', '9:16', '3:4', '4:3', '1:2', '2:1', '2:3', '3:2', '5:6', '6:5'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '1080p'] |
| `num_videos` | Number of videos | int | 1 |  |  |  | [1, 2, 4] |
| `variety` | Variety | int | 5 | 0 | 100 | 5 |  |
| `stylization` | Stylization | int | 1 | 0 | 1000 | 1 |  |
| `weirdness` | Weirdness | int | 1 | 0 | 3000 | 1 |  |

**Required Inputs:** `prompt`

**Video Inputs:** `num_videos`

---

### hunyuan-image-to-video

- **Name:** Hunyuan Image To Video
- **Provider:** Hunyuan
- **Endpoint:** `hunyuan-image-to-video`
- **Family:** `hunyuan`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |

**Required Inputs:** `prompt`

---

### kling-v2.1-master-i2v

- **Name:** Kling v2.1 Master I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.1-master-i2v`
- **Family:** `kling-v2.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### kling-v2.1-standard-i2v

- **Name:** Kling v2.1 Standard I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.1-standard-i2v`
- **Family:** `kling-v2.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### kling-v2.1-pro-i2v

- **Name:** Kling v2.1 Pro I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.1-pro-i2v`
- **Family:** `kling-v2.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### wan2.2-image-to-video

- **Name:** Wan2.2 Image To Video
- **Provider:** Wan
- **Endpoint:** `wan2.2-image-to-video`
- **Family:** `wan2.2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `quality` | Quality | string | medium |  |  |  | ['medium', 'high'] |
| `duration` | Duration | int | 5 | 5 | 8 | 3 |  |

**Required Inputs:** `prompt`

---

### runway-act-two-i2v

- **Name:** Runway Act Two I2V
- **Provider:** Runway
- **Endpoint:** `runway-act-two-i2v`
- **Family:** `runway`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] |

---

### pixverse-v4.5-i2v

- **Name:** Pixverse v4.5 I2V
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v4.5-i2v`
- **Family:** `pixverse-v4.5`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '540p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 5 | 8 | 3 |  |

**Required Inputs:** `prompt`

---

### vidu-v2.0-i2v

- **Name:** Vidu v2.0 I2V
- **Provider:** Vidu
- **Endpoint:** `vidu-v2.0-i2v`
- **Family:** `vidu-v2`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '1:1'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '720p', '1080p'] |
| `duration` | Duration | int | 4 |  |  |  | [4] |

**Required Inputs:** `prompt`

---

### vidu-q1-reference

- **Name:** Vidu Q1 Reference
- **Provider:** Vidu
- **Endpoint:** `vidu-q1-reference`
- **Family:** `vidu-q1`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 1:1 |  |  |  | ['16:9', '9:16', '1:1'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-02-standard-i2v

- **Name:** Minimax Hailuo 02 Standard I2V
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-02-standard-i2v`
- **Family:** `minimax-2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |
| `resolution` | Resolution | string | 512P |  |  |  | ['512P', '768P'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-02-pro-i2v

- **Name:** Minimax Hailuo 02 Pro I2V
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-02-pro-i2v`
- **Family:** `minimax-2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### video-effects

- **Name:** Video Effects
- **Provider:** MuAPI
- **Endpoint:** `video-effects`
- **Family:** `effects`
- **Image Field:** `image_url`
- **Has Prompt:** `False`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `name` | Effect Name | string | Balloon Flyaway |  |  |  | ['Balloon Flyaway', 'Blow Kiss', 'Body Shake', 'Break Glass', 'Carry Me', 'Cartoon Doll', 'Cheek Kiss', 'Child Memory', 'Couple Arrival', 'Fairy Me', 'Fashion Stride', 'Fisherman', 'Flower Receive', 'Flying', 'French Kiss', 'Gender Swap', 'Golden Epoch', 'Hair Swap', 'Hugging', 'Jiggle Up', 'Kissing Pro', 'Live Memory', 'Love Drop', 'Melt', 'Minecraft', 'Muscling', 'Nap Me 360p', 'Paperman', 'Pilot', 'Pinch', 'Pixel Me', 'Romantic Lift', 'Sexy Me', 'Slice Therapy', 'Soul Depart', 'Split Stance Human', 'Squid Game', 'Toy Me', 'Walk Forward', 'Zoom In Fast', 'Zoom Out'] |

---

### seedance-lite-i2v

- **Name:** Seedance Lite I2V
- **Provider:** ByteDance
- **Endpoint:** `seedance-lite-i2v`
- **Family:** `bytedance`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 3 | 12 | 1 |  |
| `camera_fixed` | Camera Fixed | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

---

### seedance-pro-i2v

- **Name:** Seedance Pro I2V
- **Provider:** ByteDance
- **Endpoint:** `seedance-pro-i2v`
- **Family:** `bytedance`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 3 | 12 | 1 |  |
| `camera_fixed` | Camera Fixed | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

---

### pixverse-v5-i2v

- **Name:** Pixverse v5 I2V
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v5-i2v`
- **Family:** `pixverse-v5`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '540p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 5 | 8 | 3 |  |

**Required Inputs:** `prompt`

---

### seedance-lite-reference-video

- **Name:** Seedance Lite Reference Video
- **Provider:** ByteDance
- **Endpoint:** `seedance-lite-reference-to-video`
- **Family:** `bytedance`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `duration` | Duration | int | 5 | 3 | 12 | 1 |  |

**Required Inputs:** `prompt`

---

### wan2.1-reference-video

- **Name:** Wan2.1 Reference Video
- **Provider:** Wan
- **Endpoint:** `wan2.1-reference-video`
- **Family:** `wan2.1`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### kling-v2.5-turbo-pro-i2v

- **Name:** Kling v2.5 Turbo Pro I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.5-turbo-pro-i2v`
- **Family:** `kling-v2.5`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### wan2.5-image-to-video

- **Name:** Wan2.5 Image To Video
- **Provider:** Wan
- **Endpoint:** `wan2.5-image-to-video`
- **Family:** `wan2.5`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### wan2.5-image-to-video-fast

- **Name:** Wan2.5 Image To Video Fast
- **Provider:** Wan
- **Endpoint:** `wan2.5-image-to-video-fast`
- **Family:** `wan2.5`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### openai-sora-2-image-to-video

- **Name:** Openai Sora 2 Image To Video
- **Provider:** OpenAI
- **Endpoint:** `openai-sora-2-image-to-video`
- **Family:** `sora`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 10 |  |  |  | [10, 15] |
| `remove_watermark` | Remove Watermark | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Conditional Inputs:** `remove_watermark`

---

### ovi-image-to-video

- **Name:** Ovi Image To Video
- **Provider:** OVI
- **Endpoint:** `ovi-image-to-video`
- **Family:** `ovi`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |

**Required Inputs:** `prompt`

---

### openai-sora-2-pro-image-to-video

- **Name:** Openai Sora 2 Pro Image To Video
- **Provider:** OpenAI
- **Endpoint:** `openai-sora-2-pro-image-to-video`
- **Family:** `sora`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 10 |  |  |  | [10, 15, 25] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `remove_watermark` | Remove Watermark | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Conditional Inputs:** `remove_watermark`

---

### leonardoai-motion-2.0

- **Name:** Leonardoai Motion 2.0
- **Provider:** Leonardo AI
- **Endpoint:** `leonardoai-motion-2.0`
- **Family:** `leonardoai`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |

**Required Inputs:** `prompt`

---

### veo3.1-image-to-video

- **Name:** Veo3.1 Image To Video
- **Provider:** MuAPI
- **Endpoint:** `veo3.1-image-to-video`
- **Family:** `veo3.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 8 |  |  |  | [8] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### veo3.1-fast-image-to-video

- **Name:** Veo3.1 Fast Image To Video
- **Provider:** MuAPI
- **Endpoint:** `veo3.1-fast-image-to-video`
- **Family:** `veo3.1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16'] |
| `duration` | Duration | int | 8 |  |  |  | [8] |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### veo3.1-reference-to-video

- **Name:** Veo3.1 Reference To Video
- **Provider:** MuAPI
- **Endpoint:** `veo3.1-reference-to-video`
- **Family:** `veo3.1`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 8 |  |  |  | [8] |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### seedance-pro-i2v-fast

- **Name:** Seedance Pro I2V Fast
- **Provider:** ByteDance
- **Endpoint:** `seedance-pro-i2v-fast`
- **Family:** `bytedance`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 2 | 12 | 1 |  |
| `camera_fixed` | Camera Fixed | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

---

### ltx-2-pro-image-to-video

- **Name:** Ltx 2 Pro Image To Video
- **Provider:** LTX
- **Endpoint:** `ltx-2-pro-image-to-video`
- **Family:** `ltx`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 8, 10] |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### ltx-2-fast-image-to-video

- **Name:** Ltx 2 Fast Image To Video
- **Provider:** LTX
- **Endpoint:** `ltx-2-fast-image-to-video`
- **Family:** `ltx`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 8, 10, 12, 14, 16, 18, 20] |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### vidu-q2-reference

- **Name:** Vidu Q2 Reference
- **Provider:** Vidu
- **Endpoint:** `vidu-q2-reference`
- **Family:** `vidu-q2`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['360p', '540p', '720p', '1080p'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '4:3', '3:4', '1:1'] |
| `duration` | Duration | int | 5 | 2 | 8 | 1 |  |
| `movement_amplitude` | Movement Amplitude | string | auto |  |  |  | ['auto', 'small', 'medium', 'large'] |

**Required Inputs:** `prompt`

---

### vidu-q2-turbo-start-end-video

- **Name:** Vidu Q2 Turbo Start End Video
- **Provider:** Vidu
- **Endpoint:** `vidu-q2-turbo-start-end-video`
- **Family:** `vidu-q2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 | 2 | 8 | 1 |  |
| `bgm` | Bgm | boolean | True |  |  |  |  |
| `movement_amplitude` | Movement Amplitude | string | auto |  |  |  | ['auto', 'small', 'medium', 'large'] |

**Required Inputs:** `prompt`

---

### vidu-q2-pro-start-end-video

- **Name:** Vidu Q2 Pro Start End Video
- **Provider:** Vidu
- **Endpoint:** `vidu-q2-pro-start-end-video`
- **Family:** `vidu-q2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 | 2 | 8 | 1 |  |
| `bgm` | Bgm | boolean | True |  |  |  |  |
| `movement_amplitude` | Movement Amplitude | string | auto |  |  |  | ['auto', 'small', 'medium', 'large'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-2.3-pro-i2v

- **Name:** Minimax Hailuo 2.3 Pro I2V
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-2.3-pro-i2v`
- **Family:** `minimax-2.3`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 1080p |  |  |  | ['1080p'] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-2.3-standard-i2v

- **Name:** Minimax Hailuo 2.3 Standard I2V
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-2.3-standard-i2v`
- **Family:** `minimax-2.3`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |

**Required Inputs:** `prompt`

---

### minimax-hailuo-2.3-fast

- **Name:** Minimax Hailuo 2.3 Fast
- **Provider:** MiniMax
- **Endpoint:** `minimax-hailuo-2.3-fast`
- **Family:** `minimax-2.3`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |
| `go_fast` | Go Fast | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

---

### kling-v2.5-turbo-std-i2v

- **Name:** Kling v2.5 Turbo Std I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.5-turbo-std-i2v`
- **Family:** `kling-v2.5`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 | 5 | 10 | 5 |  |

**Required Inputs:** `prompt`

---

### grok-imagine-image-to-video

- **Name:** Grok Imagine Image To Video
- **Provider:** Grok
- **Endpoint:** `grok-imagine-image-to-video`
- **Family:** `grok`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `mode` | Mode | string | normal |  |  |  | ['fun', 'normal', 'spicy'] |
| `duration` | Duration | int | 6 |  |  |  | [6, 10] |

**Required Inputs:** `prompt`

**Conditional Inputs:** `mode`

---

### kling-o1-image-to-video

- **Name:** Kling O1 Image To Video
- **Provider:** Kling
- **Endpoint:** `kling-o1-image-to-video`
- **Family:** `kling-o1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### kling-o1-reference-to-video

- **Name:** Kling O1 Reference To Video
- **Provider:** Kling
- **Endpoint:** `kling-o1-reference-to-video`
- **Family:** `kling-o1`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 | 3 | 10 | 1 |  |
| `keep_original_sound` | Keep Original Sound | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

---

### kling-v2.6-pro-i2v

- **Name:** Kling v2.6 Pro I2V
- **Provider:** Kling
- **Endpoint:** `kling-v2.6-pro-i2v`
- **Family:** `kling-v2.6`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |
| `sound` | Sound | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Conditional Inputs:** `sound`

---

### pixverse-v5.5-i2v

- **Name:** Pixverse v5.5 I2V
- **Provider:** Pixverse
- **Endpoint:** `pixverse-v5.5-i2v`
- **Family:** `pixverse-v5.5`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `style` | Style | string | none |  |  |  | ['none', 'anime', '3d_animation', 'clay', 'comic', 'cyberpunk'] |
| `thinking` | Thinking | string | auto |  |  |  | ['auto', 'enabled', 'disabled'] |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '4:3', '3:4'] |
| `resolution` | Resolution | string | 360p |  |  |  | ['360p', '540p', '720p', '1080p'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 8, 10] |
| `audio` | Audio | boolean | False |  |  |  |  |
| `multi_clip` | Multi Clip | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `audio`

---

### wan2.2-spicy-image-to-video

- **Name:** Wan2.2 Spicy Image To Video
- **Provider:** Wan
- **Endpoint:** `wan2.2-spicy-image-to-video`
- **Family:** `wan2.2`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 8] |

**Required Inputs:** `prompt`

---

### wan2.6-image-to-video

- **Name:** Wan2.6 Image To Video
- **Provider:** Wan
- **Endpoint:** `wan2.6-image-to-video`
- **Family:** `wan2.6`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10, 15] |
| `shot_type` | Shot Type | string | single |  |  |  | ['single', 'multi'] |

**Required Inputs:** `prompt`

---

### kling-o1-standard-image-to-video

- **Name:** Kling O1 Standard Image To Video
- **Provider:** Kling
- **Endpoint:** `kling-o1-standard-image-to-video`
- **Family:** `kling-o1`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### kling-o1-standard-reference-to-video

- **Name:** Kling O1 Standard Reference To Video
- **Provider:** Kling
- **Endpoint:** `kling-o1-standard-reference-to-video`
- **Family:** `kling-o1`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10] |

**Required Inputs:** `prompt`

---

### seedance-v1.5-pro-i2v

- **Name:** Seedance v1.5 Pro I2V
- **Provider:** ByteDance
- **Endpoint:** `seedance-v1.5-pro-i2v`
- **Family:** `seedance-v1.5-pro`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 4 | 12 | 1 |  |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |
| `camera_fixed` | Camera Fixed | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### seedance-v1.5-pro-i2v-fast

- **Name:** Seedance v1.5 Pro I2V Fast
- **Provider:** ByteDance
- **Endpoint:** `seedance-v1.5-pro-i2v-fast`
- **Family:** `seedance-v1.5-pro`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9'] |
| `resolution` | Resolution | string | 720p |  |  |  | ['720p', '1080p'] |
| `duration` | Duration | int | 5 | 4 | 12 | 1 |  |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |
| `camera_fixed` | Camera Fixed | boolean | False |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### ltx-2-19b-image-to-video

- **Name:** Ltx 2 19b Image To Video
- **Provider:** LTX
- **Endpoint:** `ltx-2-19b-image-to-video`
- **Family:** `ltx`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |
| `duration` | Duration | int | 5 | 5 | 20 | 1 |  |

**Required Inputs:** `prompt`

---

### kling-v3.0-pro-image-to-video

- **Name:** Kling v3.0 Pro Image To Video
- **Provider:** Kling
- **Endpoint:** `kling-v3.0-pro-image-to-video`
- **Family:** `kling-v3.0`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 | 3 | 15 | 1 |  |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### kling-v3.0-standard-image-to-video

- **Name:** Kling v3.0 Standard Image To Video
- **Provider:** Kling
- **Endpoint:** `kling-v3.0-standard-image-to-video`
- **Family:** `kling-v3.0`
- **Image Field:** `image_url`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `duration` | Duration | int | 5 | 3 | 15 | 1 |  |
| `generate_audio` | Generate Audio | boolean | True |  |  |  |  |

**Required Inputs:** `prompt`

**Audio Inputs:** `generate_audio`

---

### seedance-v2.0-i2v

- **Name:** Seedance 2.0 I2V
- **Provider:** ByteDance
- **Endpoint:** `seedance-v2.0-i2v`
- **Family:** `seedance-v2.0`
- **Image Field:** `images_list`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `prompt` | Prompt | string |  |  |  |  |  |
| `aspect_ratio` | Aspect Ratio | string | 16:9 |  |  |  | ['16:9', '9:16', '4:3', '3:4'] |
| `duration` | Duration | int | 5 |  |  |  | [5, 10, 15] |
| `quality` | Quality | string | basic |  |  |  | ['high', 'basic'] |

**Required Inputs:** `prompt`

---

## v2vModels

### video-watermark-remover

- **Name:** AI Video Watermark Remover
- **Provider:** MuAPI
- **Endpoint:** `video-watermark-remover`
- **Family:** `tools`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

## lipsyncModels

### infinitetalk-image-to-video

- **Name:** Infinite Talk
- **Provider:** InfiniteTalk
- **Endpoint:** `infinitetalk-image-to-video`
- **Family:** `infinitetalk`
- **Category:** `image`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |

---

### wan2.2-speech-to-video

- **Name:** Wan 2.2 Speech to Video
- **Provider:** Wan
- **Endpoint:** `wan2.2-speech-to-video`
- **Family:** `wan`
- **Category:** `image`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |

---

### ltx-2.3-lipsync

- **Name:** LTX 2.3 Lipsync
- **Provider:** LTX
- **Endpoint:** `ltx-2.3-lipsync`
- **Family:** `ltx`
- **Category:** `image`
- **Has Prompt:** `True`
- **Has Seed:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |

---

### ltx-2-19b-lipsync

- **Name:** LTX 2 19B Lipsync
- **Provider:** LTX
- **Endpoint:** `ltx-2-19b-lipsync`
- **Family:** `ltx`
- **Category:** `image`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 720p |  |  |  | ['480p', '720p', '1080p'] |

---

### sync-lipsync

- **Name:** Sync Lipsync
- **Provider:** MuAPI
- **Endpoint:** `sync-lipsync`
- **Family:** `lipsync`
- **Category:** `video`
- **Has Prompt:** `False`
---

### latent-sync

- **Name:** LatentSync
- **Provider:** LatentSync
- **Endpoint:** `latentsync-video`
- **Family:** `lipsync`
- **Category:** `video`
- **Has Prompt:** `False`
---

### creatify-lipsync

- **Name:** Creatify Lipsync
- **Provider:** Creatify
- **Endpoint:** `creatify-lipsync`
- **Family:** `lipsync`
- **Category:** `video`
- **Has Prompt:** `False`
---

### veed-lipsync

- **Name:** Veed Lipsync
- **Provider:** Veed
- **Endpoint:** `veed-lipsync`
- **Family:** `lipsync`
- **Category:** `video`
- **Has Prompt:** `False`
---

### infinitetalk-video-to-video

- **Name:** Infinite Talk V2V
- **Provider:** InfiniteTalk
- **Endpoint:** `infinitetalk-video-to-video`
- **Family:** `infinitetalk`
- **Category:** `video`
- **Has Prompt:** `True`

**Inputs:**

| Field | Title | Type | Default | Min | Max | Step | Enum |
|-------|-------|------|---------|-----|-----|------|------|
| `resolution` | Resolution | string | 480p |  |  |  | ['480p', '720p'] |

---

## audioModels

### minimax-speech-2.6-turbo

- **Name:** Minimax Speech Turbo
- **Provider:** MiniMax
- **Endpoint:** `minimax-speech-2.6-turbo`
- **Family:** `audio`
- **Type:** `tts`
- **Has Prompt:** `True`
- **Voice Options:** `True`
---

### minimax-speech-2.6-hd

- **Name:** Minimax Speech HD
- **Provider:** MiniMax
- **Endpoint:** `minimax-speech-2.6-hd`
- **Family:** `audio`
- **Type:** `tts`
- **Has Prompt:** `True`
- **Voice Options:** `True`
---

### minimax-voice-clone

- **Name:** Minimax Voice Clone
- **Provider:** MiniMax
- **Endpoint:** `minimax-voice-clone`
- **Family:** `audio`
- **Type:** `voice-clone`
- **Requires Audio:** `True`
- **Has Prompt:** `False`
---

### suno-create-music

- **Name:** Suno Create Music
- **Provider:** Suno
- **Endpoint:** `suno-create-music`
- **Family:** `audio`
- **Type:** `music`
- **Has Prompt:** `True`
- **Supports Styles:** `True`
---

### suno-extend-music

- **Name:** Suno Extend Music
- **Provider:** Suno
- **Endpoint:** `suno-extend-music`
- **Family:** `audio`
- **Type:** `music`
- **Has Prompt:** `True`
- **Has Audio:** `True`
---

### suno-remix-music

- **Name:** Suno Remix Music
- **Provider:** Suno
- **Endpoint:** `suno-remix-music`
- **Family:** `audio`
- **Type:** `music`
- **Has Prompt:** `True`
- **Has Audio:** `True`
---

## avatarModels

### ltx-2.3-lipsync

- **Name:** LTX LipSync
- **Provider:** LTX
- **Endpoint:** `ltx-2.3-lipsync`
- **Family:** `avatar`
- **Subtype:** `lipsync`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### ltx-2-19b-lipsync

- **Name:** LTX 19B LipSync
- **Provider:** LTX
- **Endpoint:** `ltx-2-19b-lipsync`
- **Family:** `avatar`
- **Subtype:** `lipsync`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### veed-lipsync

- **Name:** VEED LipSync
- **Provider:** Veed
- **Endpoint:** `veed-lipsync`
- **Family:** `avatar`
- **Subtype:** `lipsync`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### creatify-lipsync

- **Name:** Creatify LipSync
- **Provider:** Creatify
- **Endpoint:** `creatify-lipsync`
- **Family:** `avatar`
- **Subtype:** `lipsync`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### latent-sync

- **Name:** LatentSync
- **Provider:** LatentSync
- **Endpoint:** `latentsync-video`
- **Family:** `avatar`
- **Subtype:** `lipsync`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### kling-v2-avatar-pro

- **Name:** Kling Avatar v2 Pro
- **Provider:** Kling
- **Endpoint:** `kling-v2-avatar-pro`
- **Family:** `avatar`
- **Subtype:** `avatar`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### kling-v2-avatar-standard

- **Name:** Kling Avatar v2 Standard
- **Provider:** Kling
- **Endpoint:** `kling-v2-avatar-standard`
- **Family:** `avatar`
- **Subtype:** `avatar`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### kling-v1-avatar-pro

- **Name:** Kling Avatar v1 Pro
- **Provider:** Kling
- **Endpoint:** `kling-v1-avatar-pro`
- **Family:** `avatar`
- **Subtype:** `avatar`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### kling-v1-avatar-standard

- **Name:** Kling Avatar v1 Standard
- **Provider:** Kling
- **Endpoint:** `kling-v1-avatar-standard`
- **Family:** `avatar`
- **Subtype:** `avatar`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### wan2.2-speech-to-video

- **Name:** WAN 2.2 Speech to Video
- **Provider:** Wan
- **Endpoint:** `wan2.2-speech-to-video`
- **Family:** `avatar`
- **Subtype:** `speech-to-video`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### infinitetalk-image-to-video

- **Name:** InfiniteTalk Image to Video
- **Provider:** InfiniteTalk
- **Endpoint:** `infinitetalk-image-to-video`
- **Family:** `avatar`
- **Subtype:** `talking-image`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

### infinitetalk-video-to-video

- **Name:** InfiniteTalk Video to Video
- **Provider:** InfiniteTalk
- **Endpoint:** `infinitetalk-video-to-video`
- **Family:** `avatar`
- **Subtype:** `talking-video`
- **Has Prompt:** `False`
- **Has Audio:** `True`
- **Has Video:** `True`
---

## trainingModels

### wan2.1-lora-t2v

- **Name:** WAN 2.1 LoRA T2V
- **Provider:** Wan
- **Endpoint:** `wan2.1-lora-t2v`
- **Family:** `training`
- **Subtype:** `wan-t2v`
- **Requires Images:** `True`
- **Has Prompt:** `False`
---

### wan2.1-lora-i2v

- **Name:** WAN 2.1 LoRA I2V
- **Provider:** Wan
- **Endpoint:** `wan2.1-lora-i2v`
- **Family:** `training`
- **Subtype:** `wan-i2v`
- **Requires Images:** `True`
- **Has Prompt:** `False`
---

## videoToolsModels

### ai-video-upscaler

- **Name:** AI Video Upscaler
- **Provider:** MuAPI
- **Endpoint:** `ai-video-upscaler`
- **Family:** `videotools`
- **Subtype:** `upscale`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### ai-video-upscaler-pro

- **Name:** AI Video Upscaler Pro
- **Provider:** MuAPI
- **Endpoint:** `ai-video-upscaler-pro`
- **Family:** `videotools`
- **Subtype:** `upscale`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### topaz-video-upscale

- **Name:** Topaz Video Upscale
- **Provider:** Topaz
- **Endpoint:** `topaz-video-upscale`
- **Family:** `videotools`
- **Subtype:** `upscale`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### wan2.2-edit-video

- **Name:** WAN 2.2 Edit Video
- **Provider:** Wan
- **Endpoint:** `wan2.2-edit-video`
- **Family:** `videotools`
- **Subtype:** `edit`
- **Video Field:** `video_url`
- **Has Prompt:** `True`
---

### wan2.2-animate

- **Name:** WAN 2.2 Animate
- **Provider:** Wan
- **Endpoint:** `wan2.2-animate`
- **Family:** `videotools`
- **Subtype:** `animate`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### luma-flash-reframe

- **Name:** Luma Flash Reframe
- **Provider:** Luma
- **Endpoint:** `luma-flash-reframe`
- **Family:** `videotools`
- **Subtype:** `reframe`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### luma-modify-video

- **Name:** Luma Modify Video
- **Provider:** Luma
- **Endpoint:** `luma-modify-video`
- **Family:** `videotools`
- **Subtype:** `modify`
- **Video Field:** `video_url`
- **Has Prompt:** `True`
---

### ai-clipping

- **Name:** AI Clipping
- **Provider:** MuAPI
- **Endpoint:** `ai-clipping`
- **Family:** `videotools`
- **Subtype:** `clip`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### remix-video

- **Name:** Remix Video
- **Provider:** MuAPI
- **Endpoint:** `remix-video`
- **Family:** `videotools`
- **Subtype:** `remix`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### heygen-video-translate

- **Name:** HeyGen Video Translate
- **Provider:** HeyGen
- **Endpoint:** `heygen-video-translate`
- **Family:** `videotools`
- **Subtype:** `translate`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

### seedance-2.0-watermark-remover

- **Name:** Seedance Watermark Remover
- **Provider:** ByteDance
- **Endpoint:** `seedance-2.0-watermark-remover`
- **Family:** `videotools`
- **Subtype:** `watermark`
- **Video Field:** `video_url`
- **Has Prompt:** `False`
---

## textModels

### gpt-5-mini

- **Name:** GPT-5 Mini
- **Provider:** OpenAI
- **Endpoint:** `gpt-5-mini`
- **Family:** `llm`
- **Type:** `chat`
- **Has Prompt:** `True`
---

### gpt-5-nano

- **Name:** GPT-5 Nano
- **Provider:** OpenAI
- **Endpoint:** `gpt-5-nano`
- **Family:** `llm`
- **Type:** `chat`
- **Has Prompt:** `True`
---

### openrouter-vision

- **Name:** OpenRouter Vision
- **Provider:** OpenRouter
- **Endpoint:** `openrouter-vision`
- **Family:** `llm`
- **Type:** `vision`
- **Has Prompt:** `True`
---
