# Comprehensive Enhancement Plan: Video Prompts, Model Catalog, Studios & Automation

## Executive Summary

This plan synthesizes a full audit of 15 external repositories related to AI video/image generation, prompt engineering, model comparison, automation skills, and creator monetization. The goal is to enhance the current application's studios, template system, model catalog, backend generation logic, and UX with curated, structured content from these repos.

**Audited repos:** awesome-seedance-2.5-api-prompts, awesome-minimax-h3-prompts, MiniMax-H3-API, Wan-3.0-API, Flux-3-Dev-API, Grok-Imagine-Image-2-API, flux-3-video-api, ai-creator-academy, Generative-Media-Skills, Seedance-2.5-API, seedance2.5-comfyui, seedance-2-mcp, seedance-2.5-mcp, awesome-claude-fable-5, awesome-ai-video-models, awesome-ai-image-models, awesome-flux-3-api-prompts.

---

## 1. Asset Inventory by Repo

### 1.1 Prompt Libraries (Template Content)

| Repo | Prompt Count | Structure | Model Family | Key Features |
|---|---|---|---|---|
| **awesome-seedance-2.5-api-prompts** | 30+ | Categorized with metadata (duration, ratio, mode, references) | Seedance 2.5 | 6-step formula, camera vocab (15 moves), lighting keywords (11 looks), multimodal @tag syntax, shot script timecodes, 72-route API reference |
| **awesome-minimax-h3-prompts** | 18+ gallery + catalog | JSON with slug, prompt, duration, ratio, category, source, video/preview assets | MiniMax H3 | First/last-frame, reference-to-video, identity-lock, motion-transfer, regeneration, text-rendering, seamless-loop modes |
| **awesome-flux-3-api-prompts** | 14+ | Categorized with aspect ratio, duration, model variant | FLUX 3 | 5-part formula, lighting/camera vocab, multi-reference editing syntax, native audio cues |
| **awesome-seedance-2.5-api-prompts (catalog.json)** | 12+ | Structured JSON with mode, duration, ratio, prompt, references, tags | Seedance 2.5 | first-last-frame, reference, regeneration, motion-transfer, ui-ux, audio-led, text-rendering |

**Structured prompt schema found across repos:**
```json
{
  "slug": "string",
  "title": "string",
  "prompt": "string",
  "category": "string",
  "mode": "t2v | i2v | first-last-frame | reference | regeneration",
  "duration_seconds": 5,
  "ratio": "16:9",
  "model": "string",
  "references": [{"role": "first_frame|last_frame|reference_image|reference_video|reference_audio", "asset": "string"}],
  "tags": ["string"],
  "source": {"kind": "original|attributed", "author": "string", "url": "string"},
  "verification_status": "untested|tested",
  "rights_note": "string"
}
```

### 1.2 Python SDKs (Generation Logic Reference)

| Repo | SDK File | Methods | Model Endpoints | Key Parameters |
|---|---|---|---|---|
| **MiniMax-H3-API** | `minimax_h3_api.py` | `text_to_video`, `image_to_video`, `reference_to_video`, `first_last_frame`, `upload_file`, `get_result`, `wait_for_completion` | `minimax-h3-text-to-video`, `minimax-h3-image-to-video`, `minimax-h3-reference-to-video` | `aspect_ratio` (6 options), `resolution=2k`, `duration` (5-15s), `last_image_url`, `reference_images/videos/audios` |
| **Wan-3.0-API** | `wan_api.py` | `text_to_video`, `image_to_video`, `reference_to_video`, `upload_file`, `get_result`, `wait_for_completion` | `wan-3.0-t2v`, `wan-3.0-i2v`, `wan-3.0-reference-to-video` | `aspect_ratio`, `duration`, `resolution=720p`, `seed`, `audio` bool, `images_list`, `video_urls`, `audio_urls` |
| **Flux-3-Dev-API** | `flux3_dev_api.py` | `generate` (Dev T2I), `text_to_image`, `image_to_image`, `text_to_video`, `image_to_video`, `upload_file`, `get_result`, `wait_for_completion` | `flux-3-dev`, `flux-3-text-to-image`, `flux-3-image-to-image`, `flux-3-text-to-video`, `flux-3-image-to-video` | `aspect_ratio` (9 options), `resolution` (1k/2k/4k image, 480p/720p/1080p video), `duration` (4-10s), `generate_audio` bool |
| **Grok-Imagine-Image-2-API** | `grok_imagine_image_2_api.py` | `text_to_image`, `edit_image`, `generate`, `upload_file`, `get_result`, `wait_for_completion` | `grok-imagine-image-2` | `aspect_ratio` (9 options), `images_list` (max 5), validation on aspect ratio enum |
| **flux-3-video-api** | `flux_3_video_api.py` (inferred) | `text_to_video`, `image_to_video`, `upload_file`, `get_result`, `wait_for_completion` | `flux-3-text-to-video`, `flux-3-image-to-video` | `aspect_ratio` (5 options), `resolution` (480p/720p/1080p), `duration` (4-10s), `generate_audio` bool |
| **Seedance-2.5-API** | `seedance_api.py` (inferred) | `generate` (72 routes), `text_to_video`, `image_to_video`, `consistent_video`, `first_last_frame`, `omni_reference`, `video_edit`, `video_extend`, `upload_file`, `get_result`, `wait_for_completion` | 72 Seedance 2.5 routes (6 workflows × 3 variants × 4 resolutions) | `aspect_ratio` (7 options), `duration` (4-30s), `resolution` (480p/720p/1080p/4k), `seed`, `variant` (standard/intl/spicy), `generate_audio`, `camera_fixed`, `output_format` (mp4/mov), `quality` (basic/high), `character_id`, `outfit_description` |

### 1.3 ComfyUI Nodes (Workflow Blueprints)

**Repo:** seedance2.5-comfyui (`seedance25_nodes.py`)

| Node Class | Workflow | Key Inputs |
|---|---|---|
| `Seedance25TextToVideo` | T2V | prompt, resolution, aspect_ratio, quality, duration, generate_audio, camera_fixed, seed, output_format, character_id |
| `Seedance25ImageToVideo` | I2V | + image (uploaded) |
| `Seedance25FirstLastFrame` | First/Last | + first_image, last_image |
| `Seedance25SpicyTextToVideo` | Spicy T2V | 720p fixed, no resolution select |
| `Seedance25SpicyImageToVideo` | Spicy I2V | + image |
| `Seedance25OmniReference` | Omni Reference | + 20 images, 6 videos, 6 audios |
| `Seedance25Character` | Character Sheet | outfit_description, character_name, 1-3 images → returns sheet_url, character_id |
| `Seedance25ConsistentVideo` | Consistent Video | sheet_image/sheet_url, 2-5 scene images, anchored prompt with `@image1` |
| `Seedance25Extend` | Video Extend | request_id, quality, duration, output_format, optional prompt |

**Shared option schema:**
```python
{
  "aspect_ratio": ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"],
  "quality": ["basic", "high"],
  "duration": {"type": "INT", "default": 5, "min": 4, "max": 30},
  "generate_audio": {"type": "BOOLEAN", "default": True},
  "camera_fixed": {"type": "BOOLEAN", "default": False},
  "seed": {"type": "INT", "default": -1, "min": -1, "max": 2147483647},
  "output_format": ["mp4", "mov"]
}
```

### 1.4 MCP Servers (Agent Integration)

| Repo | Tools | Workflows |
|---|---|---|
| **seedance-2.5-mcp** | `seedance_25_text_to_video`, `seedance_25_image_to_video`, `seedance_25_first_last_frame`, `seedance_25_omni_reference`, `muapi_predict_result`, `muapi_account_balance` | stdio + HTTP bridge, 720p/480p explicit selection, up to 20 images / 6 videos / 6 audios |
| **seedance-2-mcp** | `seedance_2_text_to_video`, `seedance_2_image_to_video`, `seedance_2_first_last_frame`, `seedance_2_omni_reference`, `muapi_predict_result`, `muapi_account_balance` | stdio + HTTP bridge, standard/fast quality |
| **Generative-Media-Skills** | 19 MCP tools (muapi_image_generate, muapi_video_generate, muapi_video_from_image, muapi_audio_create, muapi_enhance_upscale, muapi_enhance_bg_remove, muapi_enhance_face_swap, muapi_enhance_ghibli, muapi_edit_lipsync, muapi_edit_clipping, etc.) | 41 workflow recipes, 100+ models, agent-native JSON outputs |

### 1.5 Model Comparison & Pricing

**Video models (awesome-ai-video-models):**

| Model | Maker | Price/sec | Max Res | Max Duration | Best For |
|---|---|---|---|---|---|
| Veo 3.1 | Google | $0.15 Fast / $0.40 Quality | 1080p/4K | ~8s | Realism + native audio |
| Sora 2 | OpenAI | $0.10 Std / $0.30-0.50 Pro | 720p-1080p | ≤25s | Coherence, long shots (API sunsets Sept 2026) |
| Kling 3.0 | Kuaishou | ~$0.10 | 1080p | 5-10s | Motion, prompt adherence |
| Runway Gen-4.5 | Runway | $0.12 (Turbo $0.05) | 1080p | ~10s | Creative control, editing |
| Seedance 2.0 | ByteDance | ~$0.03 Fast / ~$0.05 Pro | 1080p | 5-10s | Value, speed, quality |
| Hailuo 2.3 | MiniMax | $0.045 (768p) / ~$0.017 (512p) | 1080p | ≤10s | Character motion |
| Luma Ray 3 | Luma | ~$0.21 (HDR ~2×) | 1080p+HDR | 5-10s | Fast iteration, HDR |
| Pika 2.2 | Pika | ~$0.05 | 1080p | ~5s | Effects, stylization |

**Image models (awesome-ai-image-models):**

| Model | Maker | Price/image | Best For |
|---|---|---|---|
| Nano Banana Pro | Google | ~$0.20 (4K ~$0.24) | 4K, editing, realism |
| GPT Image 1.5 | OpenAI | ~$0.04 | Instruction following, text |
| FLUX.2 [pro] | BFL | ~$0.015-0.02 | Cheapest premium, 4MP |
| Seedream 4.5 | ByteDance | ~$0.04 | Value + quality |
| Imagen 4 | Google | ~$0.04 | Photorealism |
| Ideogram v3 | Ideogram | ~$0.07 | In-image text, typography |
| Midjourney v7 | Midjourney | Subscription | Aesthetic / artistic |

### 1.6 Monetization Curriculum (ai-creator-academy)

**15 tracks, 64 modules mapped:**

| Track | Business Model | Key Studios |
|---|---|---|
| 1. AI Video Ads & UGC | Sell ad batches to brands | VideoStudio, CinemaStudio, CommercialStudio |
| 2. AI Filmmaking | Short films, trailers, music videos | CinemaStudio, StoryboardStudio |
| 3. Faceless AI Channels | YouTube/TikTok channels | VideoStudio, DirectorPage |
| 4. AI Content Factories | Idea → script → video → publish at volume | TemplateStudio, VideoStudio, DirectorPage |
| 5. AI Avatars & Influencers | Consistent AI character business | AvatarStudio, InfluencerStudio |
| 6. AI Audio & Music | Voice cloning, dubbing, podcasts | AudioStudio |
| 7. AI Product Photography | Studio-quality product shots | ImageStudio, CommercialStudio |
| 8. AI Fashion & Virtual Try-On | Garment try-on for e-commerce | ImageStudio, EditStudio |
| 9. AI Real Estate Staging | Empty room → staged listing | ImageStudio, EditStudio |
| 10. AI Headshots & Portraits | Consistent professional headshots | ImageStudio, CharacterStudio |
| 11. AI Print-on-Demand & Merch | Sellable AI art on merch | ImageStudio, TemplateStudio |
| 12. AI Stock Content & Licensing | Licensable stock catalog | ImageStudio, VideoStudio |
| 13. AI Tools Mastery | Model buyer's guide | N/A (educational) |
| 14. AI Freelancing & Agency | Pricing, contracts, clients | N/A (business) |
| 15. AI Agents & Vibe-Coding | Sellable micro-tools | DirectorPage, ChatStudio |

**Pricing anchors from Track 1:**
- Gig-level per ad: $10–$55
- Project batch (5-8 ads): $150–$300
- Agency retainer: $1,500–$3,000/mo

### 1.7 Claude Fable 5 Use Cases (awesome-claude-fable-5)

**94 cases** across 8 categories. Most relevant to studios:

| Category | Cases | Studio Relevance |
|---|---|---|
| Visual, Design, Video, 3D | Cases 13-16 | CinemaStudio, VideoStudio, ImageStudio |
| Coding and Code Generation | Cases 1-6 | DirectorPage (backend tools) |
| Agents and Long-Running Automation | Cases 7-8 | DirectorPage, VideoAgent |
| Games and Interactive Demos | Cases 9-12 | Entertainment studios |

---

## 2. Gap Analysis vs Current Application

### 2.1 What the App Has Today

| Capability | Status | Location |
|---|---|---|
| Seedance 2.0 models (t2v, i2v, extend) | ✅ Implemented | VideoStudio, CinemaStudio, modelCatalogService |
| Wan models (2.1, 2.5, 2.6 image edit, effects) | ✅ Implemented | VideoStudio, EditStudio, EffectsStudio |
| MiniMax Hailuo 2.3 i2v | ✅ Implemented | VideoStudio |
| FLUX Kontext (image edit) | ✅ Implemented | EditStudio |
| Grok Imagine i2i | ✅ Implemented | EditStudio |
| Kling v2.6 pro | ✅ Implemented | CinemaStudio |
| Template system (JS-only) | ✅ Implemented | lib/templates.js, templateSpecs.js |
| GTM Boost prompt enhancer | ✅ Implemented | All studios |
| MuapiClient proxy | ✅ Implemented | src/lib/muapi.js |
| Director/VideoAgent backend | ✅ Implemented | DirectorPage, videoAgentService |
| Storyboard studio | ✅ Implemented | StoryboardStudio |

### 2.2 What's Missing (Gaps to Fill)

| Gap | Source Repo(s) | Impact |
|---|---|---|
| **Seedance 2.5** (72 routes, 30s clips, 4K, spicy, character consistency, omni-reference, video edit/extend) | awesome-seedance-2.5-api-prompts, Seedance-2.5-API, seedance2.5-comfyui, seedance-2.5-mcp | HIGH — model catalog + studio UI updates |
| **MiniMax H3** (t2v, i2v, first/last-frame, reference-to-video) | MiniMax-H3-API, awesome-minimax-h3-prompts | HIGH — new model family + templates |
| **Wan 3.0** (t2v, i2v, reference-to-video) | Wan-3.0-API | MEDIUM — upgrade from 2.x |
| **FLUX 3 Video** (t2v, i2v with native audio) | Flux-3-Dev-API, flux-3-video-api, awesome-flux-3-api-prompts | HIGH — new video model family |
| **Grok Imagine Image 2** (multi-reference editing, 5 images) | Grok-Imagine-Image-2-API | MEDIUM — enhance existing EditStudio |
| **Prompt template library** (70+ structured video prompts) | awesome-seedance-2.5-api-prompts, awesome-minimax-h3-prompts, awesome-flux-3-api-prompts | HIGH — user-facing feature |
| **Camera/lens vocabulary system** | awesome-seedance-2.5-api-prompts | MEDIUM — CinemaStudio enhancement |
| **Workflow recipes** (41 end-to-end pipelines) | Generative-Media-Skills | MEDIUM — TemplateStudio + DirectorPage |
| **MCP tool integration** (19 tools, agent pipelines) | Generative-Media-Skills, seedance-2-mcp, seedance-2.5-mcp | MEDIUM — backend/automation |
| **Model comparison data** (pricing, speed, quality) | awesome-ai-video-models, awesome-ai-image-models | LOW — model catalog enrichment |
| **Monetization tracks** (15 tracks, pricing anchors) | ai-creator-academy | MEDIUM — TemplateStudio "Launch It" sections |
| **Fable 5 use cases** (94 cases) | awesome-claude-fable-5 | LOW — DirectorPage agent prompts |

---

## 3. Studio-Specific Enhancement Plan

### 3.1 CinemaStudio (`src/components/CinemaStudio.js`)

**Current:** Camera builder, cinematic prompt compilation, model selector (Kling v2.6, Seedance 2.0).

**Enhancements:**

1. **Upgrade to Seedance 2.5**
   - Add model variants: `seedance-v2.5-t2v`, `seedance-v2.5-i2v`, `seedance-v2.5-spicy-t2v`, `seedance-v2.5-spicy-i2v`
   - Add resolution tiers: `-480p`, `-720p`, `-1080p`, `-4k` (route suffix mapping)
   - Add quality toggle: `basic` / `high`
   - Add `camera_fixed` toggle
   - Add `output_format` select: `mp4` / `mov`
   - Extend duration slider to 4–30s (from current max 15s)

2. **Camera Vocabulary Panel**
   - Add collapsible "Camera Vocabulary" drawer populated from Seedance 2.5 prompt guide
   - 15 movement keywords organized by category (approach, retreat, horizontal, vertical, follow, rotate, etc.)
   - Click-to-insert into prompt bar
   - 11 lighting keywords with one-click insertion

3. **Cinematic Template Gallery**
   - Import top 10 Seedance 2.5 cinematic prompts (Steampunk Odyssey, Crystal Ball Match-Cut, Oceanic Civilization, etc.)
   - Auto-fill: prompt, camera, lens, movement, film look, aspect ratio, duration
   - Store in `src/lib/videoTemplateBundles.js` → merge into `templateSpecs.js`

4. **Character Consistency Mode**
   - Add "Character Sheet" upload panel (1-3 reference images)
   - Add `outfit_description` textarea
   - Route to `seedance-v2.5-character` for sheet generation
   - Store `character_id` in session for reuse in subsequent generations

5. **Omni Reference Panel**
   - Add multi-asset upload: up to 20 images, 6 videos, 6 audio clips
   - Role tagging UI: `reference_image`, `reference_video`, `reference_audio`
   - @tag syntax helper (auto-insert `@image1`, `@video1`, `@audio1` references into prompt)

### 3.2 VideoStudio (`src/components/VideoStudio.js`)

**Current:** T2V/I2V/V2V modes, Pexels integration, model selector, duration/resolution/ratio controls.

**Enhancements:**

1. **Model Catalog Expansion**
   - Add MiniMax H3: `minimax-h3-text-to-video`, `minimax-h3-image-to-video`, `minimax-h3-reference-to-video`
   - Add Wan 3.0: `wan-3.0-t2v`, `wan-3.0-i2v`, `wan-3.0-reference-to-video`
   - Add FLUX 3 Video: `flux-3-text-to-video`, `flux-3-image-to-video`
   - Add Seedance 2.5: all 72 routes (model + variant + resolution in UI)
   - Add Grok Imagine Image 2: `grok-imagine-image-2` (for i2i workflows)

2. **First/Last Frame Mode**
   - Add mode toggle: `t2v | i2v | first-last-frame | reference`
   - For first-last-frame: dual image uploader (start frame + end frame)
   - Route to model-specific endpoint (`seedance-v2.5-first-last-frame`, `minimax-h3-image-to-video` with `last_image_url`)

3. **Reference Mode Panel**
   - Multi-asset upload: images (up to 30 for Seedance, 5 for Grok), videos, audio
   - Role assignment dropdown per asset
   - Prompt helper with @tag insertion

4. **Template Prompt Library**
   - Dropdown/panel with curated prompts from all repos
   - Filter by: model family, category, duration, aspect ratio
   - One-click load: fills prompt, sets model, constrains UI controls to template's parameter range
   - Categories: Cinematic, Fashion, Nature, Ads, Sci-Fi, Social, Anime, Product, Food, Beauty

5. **Native Audio Toggle**
   - For FLUX 3 Video and Seedance 2.5 Edit/Extend: show `generate_audio` toggle
   - For Wan: show `audio` bool parameter

### 3.3 TemplateStudio (`src/components/TemplateStudio.js`)

**Current:** Per-template route, dynamic inputs from `template.inputs`, AI Enhancer, Creative Intelligence, model selector.

**Enhancements:**

1. **Video Template Support**
   - Extend template schema to support `workflow` field: `t2v | i2v | first_last_frame | omni_reference | video_edit | video_extend | character_consistency`
   - Add `ui.quickInputs` and `ui.advancedInputs` rendering
   - Quick inputs: subject, environment, camera movement (select from vocab), style
   - Advanced inputs: aspect_ratio, duration, resolution, seed, generate_audio, camera_fixed, variant, quality, output_format

2. **Model-Family Filter**
   - Add sidebar filter: All | Seedance 2.5 | MiniMax H3 | FLUX 3 | Wan 3.0 | Grok Imagine
   - Filter templates by `template.model` prefix

3. **Prompt Compilation Engine**
   - Extend `src/lib/templateEngine.js`:
     - Substitute `{{variables}}` in `promptTemplate`
     - Append `spec.cinematography` keywords for cinematic templates
     - Append `spec.enhancerKeywords` when GTM Boost active
     - Merge `spec.negativePrompt` into negative prompt field
     - Inject camera/lens/movement metadata from template spec

4. **Monetization "Launch It" Sections**
   - Add pricing/positioning panel for templates in monetization tracks
   - Show: suggested price, target client, deliverable format, platform recommendations
   - Source: ai-creator-academy pricing anchors

5. **Recipe Pack Integration**
   - Add "Workflow Recipes" tab showing 41 end-to-end pipelines from Generative-Media-Skills
   - Each recipe: inputs list, step-by-step instructions, output expectations
   - Example recipes: "Product Photo → Cinematic 10s Ad", "Person Photo → 3D Action Figure", "UGC Video Factory"

### 3.4 EditStudio (`src/components/EditStudio.js`)

**Current:** 13 AI edit tools, 25+ edit models, upload + prompt flow.

**Enhancements:**

1. **Grok Imagine Image 2 Multi-Reference**
   - Add "Multi-Reference Edit" tool
   - Upload up to 5 reference images
   - Prompt: "Place subject from image 1 into scene from image 2, preserving identity"
   - Route to `grok-imagine-image-2` with `images_list`

2. **FLUX 3 Image-to-Image**
   - Add FLUX 3 i2i to model list (up to 4 reference images)
   - Add instruction-driven editing preset: "Replace background", "Style transfer", "Character consistency"

3. **Reference Recipe Panel**
   - Pre-built multi-reference workflows from awesome-minimax-h3-prompts
   - Example: "Same dancer, new room" (image + video references)
   - Example: "Product page that breathes" (product image → animated landing page)

### 3.5 EffectsStudio (`src/components/EffectsStudio.js`)

**Current:** 6 tabs, 64 image effects, 47 motion controls, 9 vfx, comparison mode.

**Enhancements:**

1. **Wan 3.0 Video Effects**
   - Add Wan 3.0 motion control presets (when SDK exposes effect names)
   - Add FLUX 3 Video effect presets (native audio sync options)

2. **Seedance 2.5 Video Edit Presets**
   - Add "Background Swap", "Object Removal", "Style Transfer" presets
   - Pre-built prompts for video editing workflows
   - Route to `seedance-v2.5-video-edit`

### 3.6 InfluencerStudio (`src/components/InfluencerStudio.js`)

**Current:** AI influencer generation, avatar types, voice types.

**Enhancements:**

1. **MiniMax H3 Fashion/Social Templates**
   - Import fashion, lifestyle, vlog, music templates from awesome-minimax-h3-prompts
   - Add UGC-style preset prompts
   - Add viral short formula templates

### 3.7 CommercialStudio (`src/components/CommercialStudio.js`)

**Current:** Commercial ad generation, product-focused.

**Enhancements:**

1. **MiniMax H3 Ads & Products**
   - Import ads, products, e-commerce templates from awesome-minimax-h3-prompts
   - Add product commercial formula: "Hero reveal → Detail close-up → Transformation → Environment transition → Hero finale"

2. **Seedance 2.5 Brand Films**
   - Import brand film templates (Crystal Ball Match-Cut, Mechanical Flower Bloom)
   - Add match-cut editing preset

### 3.8 DirectorPage (`src/components/DirectorPage.js`)

**Current:** 45 agents, VideoDB proxy, FFmpeg actions.

**Enhancements:**

1. **New Agent Categories**
   - **Prompt Engineering Agent:** Apply 6-step Seedance formula, 5-part FLUX formula to user prompts
   - **Camera Director Agent:** Insert camera movement vocabulary, lighting keywords
   - **Template Curator Agent:** Match user intent to best prompt template from library
   - **Pricing Advisor Agent:** Suggest pricing based on ai-creator-academy anchors
   - **Model Router Agent:** Choose best model/API based on task requirements (from awesome-ai-video-models comparison)

2. **Workflow Recipe Execution**
   - Import 41 Generative-Media-Skills recipes as executable agent workflows
   - Example: "UGC Video Factory" → person photo + product photo + script → 10s vertical UGC video

3. **Fable 5 Integration Patterns**
   - Add agent prompts inspired by awesome-claude-fable-5 cases
   - Long-horizon relay pattern: Fable 5 for planning/architecture, cheaper models for execution, Fable 5 for review
   - Use cases: code review, infrastructure diagnosis, creative brief generation

---

## 4. Model Catalog Expansion

### 4.1 New Model Entries

**Add to `modelCatalogService.js`:**

```javascript
// Seedance 2.5 family (72 routes → compress to UI-relevant entries)
{
  id: 'seedance-v2.5-t2v',
  name: 'Seedance 2.5 Text-to-Video',
  provider: 'ByteDance',
  category: 'video',
  type: 't2v',
  maxDuration: 30,
  maxResolution: '4k',
  resolutions: ['480p', '720p', '1080p', '4k'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
  supportsAudio: true,
  supportsCharacterSheet: true,
  maxRefImages: 30,
  maxRefVideos: 10,
  maxRefAudio: 10,
  pricePerSec: 0.34,
  endpoint: 'seedance-2.5-text-to-video',
  variants: ['standard', 'intl', 'spicy']
},
{
  id: 'seedance-v2.5-i2v',
  // ... similar
},
{
  id: 'seedance-v2.5-first-last-frame',
  // ...
},
{
  id: 'seedance-v2.5-omni-reference',
  // ...
},
{
  id: 'seedance-v2.5-video-edit',
  // ...
},
{
  id: 'seedance-v2.5-video-extend',
  // ...
},
{
  id: 'seedance-v2.5-character',
  // ...
},

// MiniMax H3 family
{
  id: 'minimax-h3-text-to-video',
  name: 'MiniMax H3 Text-to-Video',
  provider: 'MiniMax',
  category: 'video',
  type: 't2v',
  maxDuration: 15,
  maxResolution: '2k',
  resolutions: ['2k'],
  aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  supportsAudio: true,
  endpoint: 'minimax-h3-text-to-video'
},
{
  id: 'minimax-h3-image-to-video',
  // ...
},
{
  id: 'minimax-h3-reference-to-video',
  // ...
},

// Wan 3.0 family
{
  id: 'wan-3.0-t2v',
  name: 'Wan 3.0 Text-to-Video',
  provider: 'Alibaba',
  category: 'video',
  type: 't2v',
  maxDuration: null, // not specified in SDK
  maxResolution: null,
  resolutions: ['720p'],
  aspectRatios: ['16:9'], // default, may support more
  endpoint: 'wan-3.0-t2v'
},
{
  id: 'wan-3.0-i2v',
  // ...
},
{
  id: 'wan-3.0-reference-to-video',
  // ...
},

// FLUX 3 Video family
{
  id: 'flux-3-text-to-video',
  name: 'FLUX 3 Text-to-Video',
  provider: 'Black Forest Labs',
  category: 'video',
  type: 't2v',
  maxDuration: 10,
  maxResolution: '1080p',
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  supportsAudio: true,
  endpoint: 'flux-3-text-to-video'
},
{
  id: 'flux-3-image-to-video',
  // ...
},

// Grok Imagine Image 2 (enhance existing entry)
{
  id: 'grok-imagine-image-2',
  name: 'Grok Imagine Image 2.0',
  provider: 'xAI',
  category: 'image',
  type: 'edit',
  maxRefImages: 5,
  aspectRatios: ['1:1', '1:2', '2:1', '9:16', '16:9', '2:3', '3:2', '3:4', '4:3'],
  endpoint: 'grok-imagine-image-2'
}
```

### 4.2 Parameter Constraints Per Model

Add to model catalog entries:
```javascript
parameterConstraints: {
  maxDuration: 30,
  minDuration: 4,
  maxResolution: '4k',
  supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
  supportsAudio: true,
  supportsCharacterSheet: true,
  supportsSpicyVariant: true,
  supportsQualityToggle: true,
  supportsOutputFormat: true,
  maxRefImages: 30,
  maxRefVideos: 10,
  maxRefAudio: 10,
  nativeResolutionPixels: {
    '16:9': { '480p': [854, 480], '720p': [1280, 720], '1080p': [1920, 1080], '4k': [3840, 2160] },
    // ...
  }
}
```

---

## 5. Template System Enhancement

### 5.1 New Template Schema

Extend existing `lib/templates.js` and `src/lib/templateSpecs.js` with video-specific fields:

```javascript
{
  id: 'seedance-cinematic-steampunk',
  name: 'Steampunk Clockwork Odyssey',
  category: 'cinematic',
  studio: 'cinema',
  model: 'seedance-v2.5-t2v',
  workflow: 't2v',
  prompt: 'A premium, highly cinematic 30-second 3D motion-graphics sequence...',
  promptTemplate: 'A {{style}} shot of {{subject}} in {{environment}}, {{camera}}',
  ui: {
    heroTitle: 'Steampunk Odyssey',
    heroSubtitle: 'Clockwork fantasy adventure',
    quickInputs: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'mechanical ornithopter' },
      { key: 'environment', label: 'Environment', type: 'text', default: 'miniature canyon of stacked books' },
      { key: 'camera', label: 'Camera Move', type: 'select', options: ['dive downward', 'glide forward', 'orbit', 'pan downward'] }
    ],
    advancedInputs: [
      { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', options: ['16:9', '21:9', '9:16'] },
      { key: 'duration', label: 'Duration (s)', type: 'number', default: 30, min: 4, max: 30 },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['480p', '720p', '1080p', '4k'] },
      { key: 'seed', label: 'Seed', type: 'number', default: -1 },
      { key: 'generate_audio', label: 'Generate Audio', type: 'boolean', default: false },
      { key: 'camera_fixed', label: 'Fixed Camera', type: 'boolean', default: false },
      { key: 'variant', label: 'Variant', type: 'select', options: ['standard', 'intl', 'spicy'] },
      { key: 'quality', label: 'Quality', type: 'select', options: ['basic', 'high'] },
      { key: 'output_format', label: 'Format', type: 'select', options: ['mp4', 'mov'] }
    ]
  },
  spec: {
    coreUseCase: 'Cinematic brand film',
    visualStyle: 'steampunk, brass and gold tones, miniature landscape',
    cinematography: 'dive downward through gears, glide forward, orbit shot, pan downward',
    enhancerKeywords: ['cinematic', 'hyper-real mechanical textures', 'shallow depth of field', 'epic fantasy'],
    negativePrompt: 'blurry, oversaturated, cartoon, watermark, jump cuts'
  },
  references: [],
  source: {
    kind: 'attributed',
    author: 'Anil-matcha prompt lab',
    url: 'https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts'
  },
  tags: ['cinematic', '3d', 'motion-graphics', 'fantasy', 'brand-film']
}
```

### 5.2 Template Bundle Files

Create `src/lib/videoTemplateBundles.js`:

```javascript
export const SEEDANCE_CINEMATIC_TEMPLATES = [ /* 15 templates */ ];
export const SEEDANCE_SOCIAL_TEMPLATES = [ /* 10 templates */ ];
export const MINIMAX_SOCIAL_TEMPLATES = [ /* 12 templates */ ];
export const MINIMAX_ADS_TEMPLATES = [ /* 8 templates */ ];
export const FLUX3_VIDEO_TEMPLATES = [ /* 8 templates */ ];
export const FLUX3_CINEMATIC_TEMPLATES = [ /* 6 templates */ ];
export const WAN_GENERAL_TEMPLATES = [ /* 10 templates */ ];
export const GROK_EDIT_TEMPLATES = [ /* 8 templates */ ];
```

Merge into `lib/templates.js` via build script or direct import.

### 5.3 Template Engine Extensions

Extend `src/lib/templateEngine.js`:

```javascript
// Add to existing engine
function compileVideoPrompt(template, inputs, gtmBoostActive) {
  let prompt = template.promptTemplate;
  
  // Substitute {{variables}}
  for (const [key, value] of Object.entries(inputs)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  // Append cinematography keywords
  if (template.spec?.cinematography) {
    prompt += `, ${template.spec.cinematography}`;
  }
  
  // Append enhancer keywords if GTM Boost active
  if (gtmBoostActive && template.spec?.enhancerKeywords) {
    prompt += `, ${template.spec.enhancerKeywords.join(', ')}`;
  }
  
  // Append negative prompt
  const negativePrompt = template.spec?.negativePrompt || '';
  
  return { prompt, negativePrompt };
}

function detectWorkflowFromTemplate(template) {
  return template.workflow || 't2v';
}

function getParameterConstraintsForModel(modelId, modelCatalog) {
  const model = modelCatalog.find(m => m.id === modelId);
  return model?.parameterConstraints || {};
}
```

---

## 6. Backend & API Integration

### 6.1 MuapiClient Extensions

Extend `src/lib/muapi.js` with missing methods:

```javascript
// Seedance 2.5 methods
async generateVideoEdit(params) {
  // POST /seedance-2.5-video-edit or /seedance-2.5-intl-video-edit or /seedance-2.5-spicy-video-edit
  // params: { prompt, video, reference_images, reference_audios, generate_audio, duration, aspect_ratio, variant, resolution }
}

async generateVideoExtend(params) {
  // POST /seedance-v2.0-extend or /seedance-2.5-video-extend
  // params: { request_id, prompt, last_image, duration, quality, output_format }
}

async generateOmniReference(params) {
  // POST /seedance-2.5-omni-reference
  // params: { prompt, images_list, videos_list, audios_list, aspect_ratio, duration, variant, resolution }
}

async generateFirstLastFrame(params) {
  // POST /seedance-2.5-first-last-frame
  // params: { prompt, images_list: [first, last], aspect_ratio, duration, variant, resolution }
}

async generateCharacterSheet(params) {
  // POST /seedance-2-character
  // params: { images_list, prompt, character_name }
}

// MiniMax H3 methods
async generateMiniMaxT2V(params) { /* POST /minimax-h3-text-to-video */ }
async generateMiniMaxI2V(params) { /* POST /minimax-h3-image-to-video */ }
async generateMiniMaxReference(params) { /* POST /minimax-h3-reference-to-video */ }

// Wan 3.0 methods
async generateWanT2V(params) { /* POST /wan-3.0-t2v */ }
async generateWanI2V(params) { /* POST /wan-3.0-i2v */ }
async generateWanReference(params) { /* POST /wan-3.0-reference-to-video */ }

// FLUX 3 Video methods
async generateFlux3T2V(params) { /* POST /flux-3-text-to-video */ }
async generateFlux3I2V(params) { /* POST /flux-3-image-to-video */ }
```

### 6.2 Route Resolution Logic

Add to MuapiClient:
```javascript
resolveEndpoint(modelId, workflow) {
  const routeMap = {
    'seedance-v2.5-t2v': { base: 'seedance-2.5-text-to-video', suffixByResolution: { '480p': '-480p', '720p': '', '1080p': '-1080p', '4k': '-4k' } },
    'seedance-v2.5-spicy-t2v': { base: 'seedance-2.5-spicy-text-to-video', suffixByResolution: { '480p': '-480p', '720p': '', '1080p': '-1080p', '4k': '-4k' } },
    'minimax-h3-text-to-video': { base: 'minimax-h3-text-to-video', suffixByResolution: {} },
    'wan-3.0-t2v': { base: 'wan-3.0-t2v', suffixByResolution: {} },
    'flux-3-text-to-video': { base: 'flux-3-text-to-video', suffixByResolution: {} },
    // ...
  };
  const route = routeMap[modelId];
  if (!route) throw new Error(`Unknown model: ${modelId}`);
  const suffix = route.suffixByResolution[params.resolution] || '';
  return route.base + suffix;
}
```

### 6.3 Parameter Validation

Add per-model validation in MuapiClient:
```javascript
validateParams(modelId, params) {
  const constraints = this.getParameterConstraints(modelId);
  if (params.duration && params.duration > constraints.maxDuration) {
    params.duration = constraints.maxDuration; // clamp
  }
  if (params.aspectRatio && !constraints.supportedAspectRatios.includes(params.aspectRatio)) {
    params.aspectRatio = constraints.supportedAspectRatios[0]; // fallback
  }
  // ...
}
```

---

## 7. Automation & MCP Integration

### 7.1 Backend MCP Server

Add MCP server to backend (mirroring seedance-2.5-mcp pattern):

```python
# backend/mcp_server.py
from mcp.server import Server
from mcp.types import Tool, TextContent

app = Server("open-generative-ai-mcp")

@app.list_tools()
async def list_tools():
    return [
        Tool(name="studio_generate_video", description="Generate video in any studio", inputSchema={...}),
        Tool(name="studio_generate_image", description="Generate image in any studio", inputSchema={...}),
        Tool(name="template_list", description="List available templates", inputSchema={...}),
        Tool(name="template_generate", description="Generate from template", inputSchema={...}),
        Tool(name="director_run_agent", description="Run a Director agent", inputSchema={...}),
        Tool(name="model_catalog_list", description="List available models", inputSchema={...}),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "studio_generate_video":
        return await handle_video_generation(arguments)
    # ...
```

### 7.2 Workflow Recipe Execution

Add recipe runner to backend:
```javascript
// backend/services/recipeRunnerService.js
async function executeRecipe(recipeName, inputs) {
  const recipe = RECIPES[recipeName]; // from Generative-Media-Skills
  const results = [];
  for (const step of recipe.steps) {
    const result = await executeStep(step, inputs, results);
    results.push(result);
  }
  return results;
}
```

### 7.3 Agent Pipeline Integration

Add to `aiAgentService.js`:
```javascript
const AGENT_PIPELINES = {
  'ugc-video-factory': {
    steps: [
      { agent: 'script-writer', action: 'write_script' },
      { agent: 'image-generator', action: 'generate_hero_image' },
      { agent: 'video-generator', action: 'animate_image', model: 'seedance-v2.5-i2v' },
      { agent: 'audio-generator', action: 'add_narration' },
      { agent: 'video-compiler', action: 'stitch_clips' }
    ]
  },
  // ... 40 more recipes
};
```

---

## 8. Monetization & UX Integration

### 8.1 TemplateStudio "Launch It" Panel

Add to `TemplateStudio.js`:
```jsx
<div className="launch-panel">
  <h3>Launch It</h3>
  <div className="pricing-card">
    <span className="price">$150–$300</span>
    <span className="label">Project batch (5-8 ads)</span>
  </div>
  <div className="deliverables">
    <h4>Deliverables</h4>
    <ul>
      <li>5-8 vertical UGC video ads</li>
      <li>MP4 + MOV formats</li>
      <li>Platform crops for TikTok, Reels, Shorts</li>
    </ul>
  </div>
  <div className="client-finder">
    <h4>Where to find clients</h4>
    <p>Fiverr, Upwork, Shopify stores, DTC brands</p>
  </div>
</div>
```

### 8.2 Pricing Calculator

Add pricing estimator to relevant studios:
```jsx
function PricingCalculator({ model, duration, resolution, quantity }) {
  const pricePerSec = MODEL_PRICES[model] || 0.10;
  const basePrice = pricePerSec * duration * quantity;
  const markup = 3; // 3x markup for client pricing
  return (
    <div className="pricing-estimate">
      <div>Cost: ${basePrice.toFixed(2)}</div>
      <div>Suggested price: ${(basePrice * markup).toFixed(2)}</div>
    </div>
  );
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create `src/lib/videoTemplateBundles.js` with all curated prompts normalized to schema
- [ ] Extend `lib/templates.js` with video template entries (70+ new templates)
- [ ] Extend `src/lib/templateSpecs.js` with enriched video specs
- [ ] Add new model entries to `modelCatalogService.js`
- [ ] Add `parameterConstraints` to all new model entries
- [ ] Extend `src/lib/templateEngine.js` with video prompt compilation

### Phase 2: MuapiClient Expansion (Weeks 3-4)
- [ ] Add Seedance 2.5 methods (6 workflows × 3 variants × 4 resolutions = 72 route support)
- [ ] Add MiniMax H3 methods (t2v, i2v, reference)
- [ ] Add Wan 3.0 methods (t2v, i2v, reference)
- [ ] Add FLUX 3 Video methods (t2v, i2v)
- [ ] Add Grok Imagine Image 2 multi-reference support
- [ ] Add route resolution logic with suffix mapping
- [ ] Add parameter validation/clamping per model

### Phase 3: Studio UI Updates (Weeks 5-8)
- [ ] **CinemaStudio:** Seedance 2.5 model variants, camera vocab panel, character sheet upload, omni reference panel, duration to 30s
- [ ] **VideoStudio:** Template prompt library dropdown, first/last-frame mode, reference mode panel, MiniMax H3/Wan 3.0/FLUX 3 models
- [ ] **TemplateStudio:** Video template support, model-family filter, prompt compilation, Launch It panel
- [ ] **EditStudio:** Grok multi-reference tool, FLUX 3 i2i, reference recipe panel
- [ ] **EffectsStudio:** Wan 3.0/FLUX 3 effect presets, Seedance 2.5 video edit presets
- [ ] **InfluencerStudio:** MiniMax H3 fashion/social templates
- [ ] **CommercialStudio:** MiniMax H3 ads, Seedance brand films
- [ ] **DirectorPage:** New agent categories (Prompt Engineering, Camera Director, Template Curator, Model Router)

### Phase 4: Automation Layer (Weeks 9-10)
- [ ] Backend MCP server (stdio + HTTP bridge)
- [ ] Recipe runner service (41 workflows from Generative-Media-Skills)
- [ ] Agent pipeline definitions in `aiAgentService.js`
- [ ] Fable 5 integration patterns in DirectorPage

### Phase 5: Testing & Polish (Weeks 11-12)
- [ ] E2E tests for each studio with video templates
- [ ] Verify generation succeeds end-to-end for each model family
- [ ] Template thumbnail generation
- [ ] Pricing calculator integration
- [ ] Documentation updates

---

## 10. Not Doing

- **Not building a separate prompt marketplace or social feed.** Prompts live inside studios as templates.
- **Not duplicating the external repos.** We import curated examples and schemas, not the full SDKs or MCP servers.
- **Not rebuilding the generation pipeline.** `MuapiClient` + proxy already works; we're extending it.
- **Not adding model-specific UI chrome to every studio.** Only studios that already support that model family get the new panels.
- **Not migrating templates to the database in this phase.** Keep them in frontend JS for speed.
- **Not implementing local model hosting.** All generation goes through MuAPI proxy.
- **Not building a custom ComfyUI competitor.** ComfyUI nodes are reference only; we're enhancing the existing studio UIs.
- **Not implementing the full ai-creator-academy curriculum.** We extract pricing anchors and positioning guidance, not the full courseware.

---

## 11. Open Questions

1. **Model ID mapping:** Do the exact model IDs from the Python SDKs (`seedance-2.5-text-to-video`, `minimax-h3-text-to-video`, `wan-3.0-t2v`, `flux-3-text-to-video`) match what's already registered in the app's model catalog, or do we need aliases?

2. **MuapiClient method coverage:** Does the current `MuapiClient` expose all needed parameter fields (e.g., `variant`, `quality`, `camera_fixed`, `generate_audio`, `output_format`) for Seedance 2.5 and FLUX 3 Video, or do we need to extend the proxy endpoint?

3. **TemplateStudio dynamic inputs:** Can `TemplateStudio.js` render `ui.quickInputs` / `ui.advancedInputs` dynamically without breaking the existing `template.inputs` flow? Should we test with a non-video template first?

4. **User discovery:** Do users expect to find video prompts inside the studio they're already in, or in a separate "Prompt Library" section? Should we do both?

5. **Template versioning:** Should video templates support versioning (e.g., re-rolls with different seeds) via `generation_versions`?

6. **User-submitted templates:** Do we want users to submit their own prompt templates, or is this read-only import from curated repos?

7. **Studio overlap:** Should cinematic templates in CinemaStudio also appear in TemplateStudio, or remain studio-specific?

8. **Wan 3.0 API stability:** The Wan 3.0 SDK docs show `wan-3.0-reference-to-video` returning `video_urls` and `audio_urls` arrays, but the MuAPI unified schema might use `videos_list` / `audios_list`. Which is correct?

9. **MiniMax H3 endpoint deprecation:** The SDK shows `first_last_frame()` is deprecated in favor of `image_to_video(..., last_image_url=...)`. Should we use the newer pattern?

10. **Seedance 2.5 availability:** Is Seedance 2.5 generally available on MuAPI, or still early-access gated to Pro/Business plans? This affects whether we show it to all users or only paid tiers.

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model IDs don't match MuAPI registry | Medium | High | Add alias mapping layer; test each endpoint before UI wiring |
| Seedance 2.5 still gated/early-access | Medium | Medium | Show as "coming soon" with waitlist CTA; fall back to Seedance 2.0 |
| Parameter schema drift between repos | Medium | Medium | Source-of-truth = MuAPI live schema; use repo data as reference only |
| Template overload (70+ new templates) | Low | Medium | Add filters, search, categories; lazy-load template catalog |
| Frontend bundle size increase | Medium | Low | Split template bundles into lazy-loaded chunks |
| Wan 3.0 endpoint naming inconsistency | Low | Medium | Test both `video_urls` and `videos_list`; normalize in client |
| FLUX 3 Video still in early access | Medium | Medium | Gate behind feature flag; show placeholder UI |

---

## 13. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Template coverage | 70+ new video templates across 5 model families | Count in template catalog |
| Studio integration | 8 studios enhanced with new models/panels | Feature flags per studio |
| Generation success rate | >95% end-to-end success for new models | Generation history status = completed |
| Prompt template usage | >30% of generations start from a template | Analytics event on template select |
| Model catalog size | 200+ models (up from ~100) | Count in modelCatalogService |
| Monetization content | 15 tracks with pricing anchors visible | Count in Launch It panels |
| Automation recipes | 41 workflows available in DirectorPage | Count in agent pipeline registry |

---

## Document Metadata

- **Created:** 2026-08-14
- **Status:** Draft — awaiting validation of open questions before implementation
- **Sources:** 15 GitHub repositories audited for full content beyond READMEs
- **Scope:** All studios, template system, model catalog, backend generation logic, UX, automation layer
