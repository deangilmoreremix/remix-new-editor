# Effect Studio Control Features Audit

**Date:** 2026-08-06  
**Scope:** Effects Studio, EffectsStudio.js, AI VFX, RenderPage, CameraEffects, ColorCorrectionSystem, and related generation pipelines  
**Auditor:** Kilo (Automated Codebase + Competitor Analysis)  
**Status:** Missing Features & Gap Analysis

---

## 1. Executive Summary

The Effect Studio currently supports **350+ effect presets** across **6 tabs** (image effects, video effects, motion controls, VFX), with basic generation controls (prompt, effect name, resolution, quality, duration, aspect ratio) and post-production capabilities (color grading, transitions, camera effects, render export). However, a thorough audit against modern AI video/image generation APIs and professional VFX tools reveals **significant gaps** in:

- **AI generation control parameters** (CFG/guidance scale, denoising strength, steps, seed, negative prompts)
- **Spatial control** (motion brushes, static masks, keyframe controls, trajectory editing)
- **Layer-based compositing** (blend modes, opacity per effect, masking, stacking)
- **Temporal control** (keyframe animation of effect parameters, speed ramping, time remapping)
- **Advanced AI features** (reference images, multi-shot, lip-sync, audio sync, video extend/interpolate)
- **Professional VFX controls** (lens effects, particle systems, displacement maps, tracking)

---

## 2. Current State Inventory

### 2.1 Effect Categories

| Tab | Effect Count | Type | Notes |
|-----|-------------|------|-------|
| image-effects | 150+ | i2i | Multiple model backends |
| nano-banana-effects | 50+ | i2i | Specific model |
| flux-kontext-effects | 75+ | i2i | Kontext models |
| ai-video-effects | 64 | i2v | Wan AI Effects presets |
| motion-controls | 47 | i2v | Camera motion presets |
| video-effects | 9 | i2v | VFX category |

### 2.2 Current Controls in EffectsStudio.js

| Control | Type | Range/Options |
|---------|------|---------------|
| Effect search/filter | Text input | — |
| Effect selection grid | Grid picker | 350+ presets |
| Upload picker | File input | Images + videos |
| Optional prompt | Textarea | — |
| Personalization tokens | Text replacement | Contact profiles |
| Thumbnail generator | Button | StudioThumbnailModal |
| Apply Effect | Button | Triggers generation |
| Comparison mode | Toggle | Side-by-side with draggable divider |
| Download | Button | Downloads result |
| Add to Library | Button | Saves to media library |
| Insert into Timeline | Button | Sends to timeline editor |
| Fullscreen preview | Click | Fullscreen output view |

### 2.3 Current Controls in AI VFX App

| Control | Type | Notes |
|---------|------|-------|
| Filter tabs | Tabs | AI Effects, Motion Controls, VFX |
| Effect selection grids | 5-column grid | With thumbnails |
| File upload | Drag & drop + picker | Images + videos |
| Image URL input | Text input | Paste URL directly |
| Prompt textarea | Textarea | — |
| Resolution selector | Select | — |
| Quality selector | Select | — |
| Duration selector | Select | — |
| Aspect ratio selector | Select | — |
| API Key modal | Modal | MuAPI auth |

### 2.4 Current Controls in RenderPage

| Control | Type | Options |
|---------|------|---------|
| Output Format | Select | WebM (VP9), MP4 (H.264), MP4 (H.265) |
| Frame Rate | Select | 24 FPS, 30 FPS, 60 FPS |
| Quality slider | Slider (1-100) | Default: 82 |
| Cinematic Presets | Select | Luxury Brand Grade, Documentary Contrast, Film Trailer Punch, Emotional Story Tone |
| Export Video | Button | — |
| Download Frame | Button | PNG |
| Queue Render | Button | Background processing |
| Trailer Cut | Button | First 30s |
| Social Resize | Button | 9:16, 1:1, 4:5 |
| Remix Scene | Button | Brightness/contrast effects |
| Copy Prompt | Button | — |
| Duplicate Render | Button | — |
| Save as Template | Button | — |
| Send to Storyboard | Button | — |
| Publish/Deliver | Button | Multi-format package |

### 2.5 Current Camera Effects Parameters

| Parameter | Range | Default |
|-----------|-------|---------|
| Intensity | 1-50px | 10 |
| Duration | 0.5-10s | 2 |
| Frequency | 5-30Hz | 15 |
| Decay | 0-1 | 0.8 |
| Start Scale | 50-200% | 100% |
| End Scale | 50-200% | 150% |
| Radius | 10-200px | 50 |
| Speed | 0.1-5 rev/s | 1 |
| Distance | 10-500px | 100 |

### 2.6 Current Color Correction Controls

| Parameter | Range | Default |
|-----------|-------|---------|
| Brightness | 0-200% | 100% |
| Contrast | 0-200% | 100% |
| Gamma | 0.1-4 | 1.0 |
| Saturation | 0-200% | 100% |
| Hue | -180° to 180° | 0° |
| Vibrance | -100 to 100 | 0 |
| Temperature | 2000K-12000K | 6500K |
| Tint | -50 to 50 | 0 |
| RGB Channel Gain | 0-200% | 100% |
| LUT Strength | 0-100% | — |
| Curve Spline Tension | 0-1 | 0.5 |

---

## 3. Industry Standards & Competitor Analysis

### 3.1 Standard AI Video Generation Parameters

Modern AI video APIs (Runway, Pika, Luma, Kling, Wan, Together AI, xAI) consistently expose:

| Parameter | Type | Typical Range | Purpose |
|-----------|------|---------------|---------|
| `guidance_scale` | float | 1.0-20.0 (typically 6-12) | Controls prompt adherence |
| `steps` / `num_steps` | int | 10-50+ | Diffusion denoising steps |
| `seed` | int | Any integer / random | Reproducibility |
| `negative_prompt` | string | — | What to avoid |
| `denoise_strength` | float | 0.0-1.0 | How much to change from source |
| `cfg_scale` | float | 0-7 (Kling), 6-10 (Wan) | Alternative guidance control |
| `duration` | int/float | Seconds (model-dependent) | Video length |
| `resolution` | string/enum | 480p/720p/1080p/1440p/2160p | Output resolution |
| `aspect_ratio` | string | 16:9, 9:16, 1:1, 4:3, etc. | Output shape |
| `fps` | int | 15-60 | Frame rate |
| `output_format` | string | MP4, WEBM | Container format |
| `output_quality` | int | Bitrate/quality level | Compression |

### 3.2 Advanced Motion Control (Kling, Runway, I2VControl)

| Feature | Description | Status in Our Studio |
|---------|-------------|---------------------|
| Motion Brush | Paint areas to move with trajectories | **MISSING** |
| Static Brush | Paint areas to remain fixed | **MISSING** |
| Camera Control | 6-DOF camera movement (pan/tilt/zoom/dolly) | **MISSING** (only presets exist) |
| First/Last Frame | Control start and end of video | **MISSING** |
| Multi-shot Narrative | Automatic shot changes (wide→close-up) | **MISSING** |
| Object Drag | Click and drag objects in frame | **MISSING** |
| Reference Images | Guide style/composition | **MISSING** |
| Audio Sync | Lip-sync with audio | **MISSING** |

### 3.3 Professional VFX Tool Standards (Boris FX Sapphire/Continuum, After Effects)

| Feature | Description | Status in Our Studio |
|---------|-------------|---------------------|
| Masking per effect | Shape masks, luminance keys, color keys | **MISSING** (only global comparison mode) |
| Blend modes | Layer compositing (add, screen, multiply, overlay, etc.) | **MISSING** |
| Opacity per effect | Effect strength/opacity control | **PARTIAL** (only CameraEffects and ColorCorrection have this) |
| Keyframe animation | Animate any parameter over time | **PARTIAL** (exists in timeline but not in effect generation) |
| Tracking/Mocha | Track masks to moving objects | **MISSING** |
| Particle systems | Fire, smoke, rain, sparks | **MISSING** |
| Lens effects | Lens flare, distortion, chromatic aberration | **MISSING** |
| Displacement maps | Image-based distortion | **MISSING** |
| Glow/Blur variants | Directional blur, edge-aware blur, rack defocus | **MISSING** |
| Film grain/Halation | Analog film emulation | **MISSING** |
| Beat Reactor | Sync effects to audio | **MISSING** |
| Pixel Chooser | Isolate effects to regions | **MISSING** |
| Depth Map masking | AI-based depth isolation | **MISSING** |

---

## 4. Missing Controls & Features — Detailed Breakdown

### 4.1 CRITICAL: AI Generation Control Parameters

**Problem:** The main `EffectsStudio.js` passes only `prompt` and `name` to the API. No client-side control over generation quality, adherence, or reproducibility.

**Missing Controls:**

| Control | API Equivalent | Impact |
|---------|---------------|--------|
| **Guidance Scale / CFG** | `guidance_scale` (6-12 typical) | Users cannot balance prompt adherence vs creativity |
| **Denoising Steps** | `steps` (10-50 typical) | Users cannot trade speed for quality |
| **Seed** | `seed` (integer) | No reproducibility; cannot iterate on a good result |
| **Negative Prompt** | `negative_prompt` | No way to exclude unwanted elements |
| **Denoising Strength** | `denoise` (0-1) | Cannot control how much source image is preserved in i2i/i2v |
| **Prompt Weight** | Token emphasis | Cannot highlight parts of prompt |

**Evidence from research:**
- Together AI docs: "Lower guidance_scale to 6-7 for more creative; raise to 9-10 for strict adherence"
- NVIDIA NIM: "guidance_scale default 7.0, range 1.0-10.0"
- Nano Banana 2 handbook: cfg_scale 7-9 recommended, denoise 0.6-0.75 for i2v

### 4.2 HIGH: Spatial Control & Masking

**Problem:** No ability to control WHERE effects apply or how specific regions move.

**Missing Controls:**

| Feature | Description | Competitor Support |
|---------|-------------|-------------------|
| **Motion Brush** | Paint regions to move along trajectories | Kling, I2VControl, Runway |
| **Static Brush** | Paint regions to stay fixed | Kling, I2VControl |
| **Mask Editor** | Draw/edit masks for effect regions | Boris FX, After Effects |
| **Luminance/Color Key** | Mask based on brightness or color | Boris FX Continuum |
| **Gradient Mask** | Linear/radial gradient masking | Boris FX Optics |
| **Depth Mask** | AI-generated depth-based masking | Boris FX Depth Map ML |
| **Face Mask** | Auto-detect and mask facial regions | Boris FX Face ML |

### 4.3 HIGH: Layer-Based Compositing

**Problem:** Effects are applied as single presets with no layering, blending, or compositing.

**Missing Controls:**

| Feature | Description | Competitor Support |
|---------|-------------|-------------------|
| **Effect Layers** | Stack multiple effects with order control | After Effects, Photoshop |
| **Blend Modes** | How layers composite (normal, add, screen, multiply, overlay, etc.) | All professional editors |
| **Per-Effect Opacity** | Adjust strength of individual effect layers | After Effects, DaVinci Resolve |
| **Layer Masking** | Mask individual layers | Photoshop, After Effects |
| **Layer Groups** | Organize and apply effects to groups | After Effects |
| **Adjustment Layers** | Non-destructive effect application | After Effects, DaVinci Resolve |

### 4.4 HIGH: Advanced Video Generation Modes

**Problem:** Only basic i2i and i2v are supported. Modern tools offer much more.

**Missing Modes:**

| Mode | Description | Competitor Support |
|------|-------------|-------------------|
| **Video-to-Video (v2v)** | Transform existing video with style/motion | Runway, Pika, Kling |
| **Video Extension** | Continue video from its last frame | Luma Dream Machine, xAI Grok |
| **Reverse Extend** | Generate video leading up to provided video | Luma Dream Machine |
| **Video Interpolation** | Generate video between two existing videos | Luma Dream Machine |
| **Reference-to-Video** | Guide generation with reference images | Runway, xAI |
| **Multi-shot Narrative** | Automatic shot changes in one generation | Wan 2.6/2.7, Kling |
| **Text-to-Video** | Generate video from prompt alone (no input image) | All major platforms |
| **Image Animation** | Animate specific parts of a static image | Kling Motion Brush |

### 4.5 MEDIUM: Keyframe & Temporal Animation

**Problem:** Effects are static applications. No animation of effect parameters over time.

**Missing Controls:**

| Feature | Description | Competitor Support |
|---------|-------------|-------------------|
| **Parameter Keyframes** | Animate any effect parameter (opacity, blur, position, etc.) | After Effects, DaVinci Resolve |
| **Easing Functions** | Control interpolation between keyframes | All professional editors |
| **Speed Ramping** | Variable speed within a clip | DaVinci Resolve, LUXEA |
| **Time Remapping** | Stretch/compress time in video | After Effects, DaVinci Resolve |
| **Expression Control** | Link parameters with math/expressions | After Effects |
| **Pre-roll/Post-roll** | Animate before/after effect application | After Effects |

### 4.6 MEDIUM: Camera Control

**Problem:** Camera effects are limited to preset names with no numerical control.

**Missing Controls:**

| Feature | Description | Current State |
|---------|-------------|---------------|
| **Camera Path Keyframes** | Define camera position/rotation at specific times | **MISSING** |
| **Focal Length** | Control lens focal length | **MISSING** |
| **Aperture/DoF** | Control depth of field | **MISSING** |
| **Camera Shake Parameters** | Intensity, duration, frequency, decay | **PARTIAL** (exists in timeline CameraEffects) |
| **Dolly/Zoom Controls** | Independent dolly and zoom | **PARTIAL** (presets only) |
| **Orbit Controls** | Radius, speed, direction, center | **PARTIAL** (presets only) |

### 4.7 MEDIUM: Advanced Image/Video Processing

**Problem:** Image editors are stubs; no real processing capabilities.

**Missing Features:**

| Feature | Description | Current State |
|---------|-------------|---------------|
| **Crop & Resize** | With aspect ratio lock | **STUB** (Pintura/Imgly/Pixo not implemented) |
| **Background Removal** | AI-powered background removal | **STUB** (CutoutPro placeholder) |
| **Inpainting/Outpainting** | Edit specific regions | **MISSING** |
| **Super Resolution** | Upscale images/videos | **MISSING** |
| **Frame Interpolation** | Generate intermediate frames | **MISSING** |
| **Stabilization** | Smooth shaky footage | **MISSING** |
| **De-interlacing** | Convert interlaced to progressive | **MISSING** |
| **Noise Reduction** | AI-powered denoising | **MISSING** |
| **Face Retouching** | Beauty/portrait enhancement | **MISSING** |
| **Object Removal** | Remove unwanted objects | **MISSING** |

### 4.8 MEDIUM: Effect Intensity & Blending

**Problem:** No fine-grained control over effect strength.

**Missing Controls:**

| Feature | Description |
|---------|-------------|
| **Effect Intensity Slider** | Global strength control for each effect (0-100%) |
| **Before/After Mix** | Blend between original and affected (similar to denoise strength) |
| **Effect Stacking Order** | Control which effects apply first |
| **Region-Specific Intensity** | Vary strength across the frame |
| **Temporal Fade** | Fade effect in/out over time |

### 4.9 LOW-MEDIUM: Audio Features

**Problem:** No audio control or generation in the effect studio.

**Missing Features:**

| Feature | Description |
|---------|-------------|
| **Audio Upload** | Add audio to video generation |
| **Auto-Dubbing** | Generate dubbed audio in multiple languages |
| **Text-to-Speech** | Generate voiceover from script |
| **Music Generation** | AI-generated background music |
| **Audio Sync** | Sync video motion to audio beats |
| **Volume/Gain Control** | Adjust audio levels |
| **Audio Effects** | Reverb, EQ, compression |
| **Lip-Sync** | Match lip movements to audio |

### 4.10 LOW: UI/UX Enhancements

**Problem:** Missing professional-grade UI features.

**Missing Features:**

| Feature | Description |
|---------|-------------|
| **Real-time Preview** | Live preview while adjusting parameters (currently batch) |
| **Effect Comparison** | Side-by-side A/B comparison of different effect settings |
| **Preset Favorites** | Save/organize favorite effect configurations |
| **Batch Processing** | Apply same effect to multiple media items |
| **History/Undo** | Full undo/redo stack for all edits |
| **Non-destructive Editing** | All effects as adjustable layers, not baked |
| **Snapshots** | Save comparison points during editing |
| **Zoom/ Pan Preview** | Inspect details at 100% |
| **Histogram/Waveform** | Analyze image/video levels |
| **Safe Zones** | Overlay guides for social media framing |

---

## 5. Prioritized Recommendations

### 5.1 P0 — Critical (Implement Immediately)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| 1 | **Guidance Scale / CFG Slider** | Core control for prompt adherence; affects every generation | Low |
| 2 | **Denoising Steps Slider** | Core quality/speed tradeoff | Low |
| 3 | **Seed Input** | Enables reproducibility and iteration | Low |
| 4 | **Negative Prompt** | Essential for excluding artifacts; standard in all modern tools | Low |
| 5 | **Effect Intensity Slider** | Users need to dial effect strength | Low |

**Implementation Notes:**
- Add these as collapsible "Advanced Settings" section in EffectsStudio.js
- Wire into `muapi.js` `generateI2I()`, `generateI2V()`, `generateVideoEffect()`
- Add client-side validation (guidance 1-20, steps 1-50, seed ≥ 0)
- Persist settings per effect type in localStorage

### 5.2 P1 — High (Next Sprint)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| 6 | **Denoising Strength** | Critical for i2i/i2v control | Low |
| 7 | **Video-to-Video Support** | Major mode gap vs competitors | Medium |
| 8 | **Video Extension** | Highly requested; supported by Luma, Grok | Medium |
| 9 | **Motion Brush (Static + Dynamic Masks)** | Competitive parity with Kling | High |
| 10 | **Effect Layers + Blend Modes** | Professional compositing requirement | High |
| 11 | **Per-Effect Opacity** | Basic layering control | Low |
| 12 | **Reference Image Support** | Style guidance; supported by Runway, Pika | Medium |

### 5.3 P2 — Medium (Following Sprints)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| 13 | **Keyframe Animation for Effect Parameters** | Timeline integration; professional standard | High |
| 14 | **Multi-shot Narrative Support** | Wan 2.6/2.7, Kling feature | Medium |
| 15 | **Camera Control Numerical Inputs** | Beyond presets; user-defined camera moves | Medium |
| 16 | **First/Last Frame Video Control** | Precise motion control | Medium |
| 17 | **Mask Editor (Shape, Luminance, Color, Gradient)** | Regional effect control | High |
| 18 | **Audio Upload + Sync** | Complete video generation | Medium |
| 19 | **Real-time Parameter Preview** | UX improvement | Medium |

### 5.4 P3 — Low (Future)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| 20 | **Particle System** | Advanced VFX | Very High |
| 21 | **Displacement Maps** | Advanced distortion | High |
| 22 | **Lens Effects (Flare, Chromatic Aberration)** | Cinematic polish | Medium |
| 23 | **Beat Reactor / Audio-reactive Effects** | Music video feature | High |
| 24 | **AI Depth Masking** | Smart region selection | Medium |
| 25 | **Object Tracking** | Follow moving objects with effects | High |
| 26 | **Inpainting/Outpainting** | Content editing | High |

---

## 6. Architecture Recommendations

### 6.1 EffectsStudio.js Refactor

```
Current: EffectsStudio.js (single file, 3000+ lines)
Recommended: Modular architecture

src/components/effects-studio/
├── EffectsStudio.jsx              # Main container
├── controls/
│   ├── GenerationControls.jsx     # Prompt, negative prompt, seed, steps, CFG
│   ├── EffectSelector.jsx         # Grid + search + filter
│   ├── IntensityControl.jsx       # Effect strength slider
│   ├── AdvancedSettings.jsx       # Collapsible advanced params
│   └── PersonalizationBar.jsx     # Token replacement
├── preview/
│   ├── ComparisonView.jsx         # Before/after with divider
│   ├── FullscreenPreview.jsx      # Fullscreen modal
│   └── ThumbnailGenerator.jsx     # Custom thumbnails
├── layers/
│   ├── EffectLayer.jsx            # Individual effect layer
│   ├── LayerStack.jsx             # Layer ordering + visibility
│   └── BlendModeSelect.jsx        # Per-layer blend mode
├── masks/
│   ├── MaskEditor.jsx             # Drawing masks on canvas
│   ├── MotionBrush.jsx            # Kling-style motion trajectories
│   └── StaticBrush.jsx            # Fixed region painter
└── actions/
    ├── ApplyEffect.jsx            # Generation trigger
    ├── ExportActions.jsx          # Download, timeline, library
    └── BatchActions.jsx           # Batch processing
```

### 6.2 Parameter Schema (Standardized)

```javascript
// Standardized effect parameters schema
const EffectParametersSchema = {
  // Core generation
  prompt: { type: "string", required: true },
  negative_prompt: { type: "string", required: false },
  seed: { type: "integer", required: false, default: "random" },
  
  // Quality controls
  guidance_scale: { type: "float", min: 1, max: 20, default: 7.5, step: 0.5 },
  steps: { type: "integer", min: 1, max: 50, default: 20 },
  denoise_strength: { type: "float", min: 0, max: 1, default: 0.7, step: 0.05 },
  
  // Output specs
  resolution: { type: "enum", values: ["480p", "720p", "1080p", "1440p", "2160p"], default: "720p" },
  aspect_ratio: { type: "enum", values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" },
  duration: { type: "float", min: 1, max: 15, default: 5 },
  fps: { type: "integer", values: [15, 24, 25, 30, 60], default: 24 },
  output_format: { type: "enum", values: ["mp4", "webm"], default: "mp4" },
  
  // Effect application
  effect_strength: { type: "float", min: 0, max: 1, default: 1.0, step: 0.05 },
  blend_mode: { type: "enum", values: ["normal", "add", "screen", "multiply", "overlay", "soft-light"], default: "normal" },
  
  // Advanced
  cfg_scale: { type: "float", min: 0, max: 7, default: 0.5, step: 0.1 }, // Kling-style
  prompt_extend: { type: "boolean", default: false },
  multi_shot: { type: "boolean", default: false },
};
```

### 6.3 API Client Updates (muapi.js)

```javascript
// Current: generateVideoEffect() only passes name, prompt, image_url
// Required: Pass full parameter set

async function generateVideoEffect(params) {
  const {
    prompt,
    negative_prompt,
    name,
    image_url,
    seed,
    guidance_scale,
    steps,
    denoise_strength,
    resolution,
    aspect_ratio,
    duration,
    quality,
    effect_strength,
    mask_url,
    static_masks,
    dynamic_masks,
    frame_images,
    reference_images,
  } = params;

  // Validate
  validateEffectName(name);
  validateResolution(resolution);
  
  // Build request
  const body = {
    prompt,
    negative_prompt,
    name,
    image_url,
    seed,
    guidance_scale,
    steps,
    denoise_strength,
    resolution,
    aspect_ratio,
    duration,
    quality,
    effect_strength,
    mask_url,
    static_masks,
    dynamic_masks,
    frame_images,
    reference_images,
  };

  return proxyPost("/api/generate/video-effect", body);
}
```

### 6.4 Mask Editor Architecture

```
Mask Editor Component
├── Canvas Layer (main preview)
├── Drawing Tools
│   ├── Brush (paint mask)
│   ├── Eraser
│   ├── Rectangle
│   ├── Ellipse
│   └── Lasso
├── Mask Types
│   ├── Motion Brush (dynamic mask)
│   ├── Static Brush (fixed region)
│   ├── Shape Mask (geometric)
│   ├── Luminance Mask (based on brightness)
│   └── Color Mask (based on hue)
├── Trajectory Editor (for motion brush)
│   ├── Point placement
│   ├── Path smoothing
│   └── Speed control
└── Output
    ├── mask_url (transparent PNG)
    └── mask_data (JSON coordinates)
```

---

## 7. Feature Comparison Matrix

| Feature Category | Current | Industry Standard | Gap |
|-----------------|---------|-------------------|-----|
| **Generation Controls** | | | |
| Prompt | ✅ | ✅ | — |
| Negative Prompt | ❌ | ✅ | **HIGH** |
| Guidance Scale / CFG | ❌ | ✅ | **CRITICAL** |
| Denoising Steps | ❌ | ✅ | **CRITICAL** |
| Seed | ❌ | ✅ | **CRITICAL** |
| Denoise Strength | ❌ | ✅ | **HIGH** |
| **Video Modes** | | | |
| Image-to-Video | ✅ | ✅ | — |
| Text-to-Video | ❌ | ✅ | **HIGH** |
| Video-to-Video | ❌ | ✅ | **HIGH** |
| Video Extension | ❌ | ✅ | **MEDIUM** |
| Video Interpolation | ❌ | ✅ | **MEDIUM** |
| Reference-to-Video | ❌ | ✅ | **MEDIUM** |
| Multi-shot | ❌ | ✅ | **MEDIUM** |
| **Spatial Control** | | | |
| Motion Brush | ❌ | ✅ | **HIGH** |
| Static Brush | ❌ | ✅ | **HIGH** |
| Mask Editor | ❌ | ✅ | **HIGH** |
| Keyframe Control | ❌ | ✅ | **MEDIUM** |
| **Compositing** | | | |
| Effect Layers | ❌ | ✅ | **HIGH** |
| Blend Modes | ❌ | ✅ | **HIGH** |
| Per-Effect Opacity | Partial | ✅ | **MEDIUM** |
| Layer Masking | ❌ | ✅ | **HIGH** |
| **Temporal** | | | |
| Parameter Keyframes | Partial | ✅ | **MEDIUM** |
| Speed Ramping | Partial | ✅ | **MEDIUM** |
| Time Remapping | ❌ | ✅ | **MEDIUM** |
| **Camera** | | | |
| Numerical Controls | Partial | ✅ | **MEDIUM** |
| 6-DOF Camera | ❌ | ✅ | **MEDIUM** |
| **Audio** | | | |
| Audio Upload | ❌ | ✅ | **MEDIUM** |
| Auto-Dub | ❌ | ✅ | **LOW** |
| Lip-Sync | ❌ | ✅ | **LOW** |
| TTS | ❌ | ✅ | **LOW** |
| **Professional VFX** | | | |
| Particle Systems | ❌ | ✅ | **LOW** |
| Lens Effects | ❌ | ✅ | **LOW** |
| Displacement Maps | ❌ | ✅ | **LOW** |
| Tracking | ❌ | ✅ | **LOW** |
| Depth Masking | ❌ | ✅ | **LOW** |

---

## 8. Recommended Implementation Roadmap

### Phase 1: Core Generation Controls (1-2 sprints)
- Add Guidance Scale, Steps, Seed, Negative Prompt to EffectsStudio.js
- Update muapi.js to pass full parameter set
- Add Effect Intensity slider
- Update EffectParametersSchema
- Add client-side validation

### Phase 2: Video Mode Expansion (2-3 sprints)
- Implement Text-to-Video mode
- Implement Video-to-Video mode
- Implement Video Extension (extend from last frame)
- Add First/Last Frame control
- Add Reference Image support

### Phase 3: Spatial Control (3-4 sprints)
- Build Mask Editor component (brush, shapes, luminance, color)
- Implement Motion Brush with trajectory editor
- Implement Static Brush
- Add mask output to API calls
- Wire into Wan/Kling motion brush APIs

### Phase 4: Layer Compositing (3-4 sprints)
- Refactor EffectsStudio to use layer-based architecture
- Implement LayerStack component
- Add blend mode support per layer
- Implement per-effect opacity
- Add layer masking

### Phase 5: Advanced Temporal (2-3 sprints)
- Extend keyframe system to effect parameters
- Implement parameter animation in timeline
- Add easing functions
- Implement speed ramping for generated videos
- Add time remapping

### Phase 6: Audio & Polish (2 sprints)
- Add audio upload and sync
- Implement auto-dubbing
- Add TTS integration
- Real-time preview optimization
- Non-destructive editing pipeline

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **API limitations** — Backend may not support all new parameters | High | High | Verify MuAPI capabilities; add feature flags |
| **Performance** — More controls = slower generation | Medium | Medium | Implement progressive enhancement; lazy-load controls |
| **UI complexity** — Too many controls overwhelm users | High | Medium | Use collapsible "Advanced" sections; progressive disclosure |
| **Backward compatibility** — Existing effect presets may break | Low | High | Maintain preset compatibility; add defaults for new params |
| **Mobile responsiveness** — More controls = layout issues | Medium | Low | Responsive design; hide advanced controls on mobile |

---

## 10. Success Metrics

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Effect controls per generation | 3 (prompt, name, image) | 10+ |
| Supported generation modes | 2 (i2i, i2v) | 6+ |
| Effect layer stacking | 1 | 5+ |
| Mask/brush tools | 0 | 3+ |
| User-reported "missing feature" tickets | Baseline | -50% |
| Time to desired result (iterations) | Baseline | -30% |

---

## 11. Appendix: API Parameter Mapping

### 11.1 MuAPI Current Support (from codebase analysis)

From `muapi.js`:
```javascript
// Currently supported in generateVideoEffect:
{
  name,           // Effect preset name
  prompt,         // Text prompt
  image_url,      // Source image
  aspect_ratio,   // "16:9", "9:16", "1:1"
  resolution,     // "480p", "720p"
  quality,        // "medium", "high"
  duration,       // Seconds
}

// Also supported in generateI2I/generateI2V:
{
  model,          // Model identifier
  seed,           // Random seed (client-side)
  // Rate limiting + polling already implemented
}
```

### 11.2 Parameters Ready to Add (Low Effort)

| Parameter | API Field | Validation | UI Component |
|-----------|-----------|------------|--------------|
| `negative_prompt` | `negative_prompt` | String, max 500 chars | Textarea |
| `guidance_scale` | `guidance_scale` | Float 1-20, step 0.5 | Slider |
| `steps` | `steps` | Int 1-50 | Slider |
| `seed` | `seed` | Int ≥ 0 | Number input + randomize button |
| `denoise_strength` | `denoise` | Float 0-1, step 0.05 | Slider |
| `effect_strength` | `strength` | Float 0-1, step 0.05 | Slider |
| `fps` | `fps` | Int 15/24/25/30/60 | Select |
| `output_format` | `output_format` | "mp4" / "webm" | Select |

### 11.3 Parameters Requiring Backend Changes

| Parameter | API Field | Backend Work Required |
|-----------|-----------|----------------------|
| `mask_url` | `mask_url` | Accept mask image upload |
| `static_masks` / `dynamic_masks` | `motion_brush` | Implement motion brush endpoint |
| `frame_images` | `frame_images` | Multi-frame input support |
| `reference_images` | `reference_images` | Reference image handling |
| `cfg_scale` | `cfg_scale` | Model-specific parameter pass-through |
| `prompt_extend` | `prompt_extend` | Enable prompt rewriting |
| `multi_shot` | `shot_type` | Multi-shot generation mode |

---

## 12. Conclusion

The Effect Studio has a solid foundation with **350+ effect presets** and basic generation/export capabilities. However, it is **significantly behind** modern AI video generation tools and professional VFX suites in terms of user control.

**The most critical gaps are:**
1. **No guidance scale / CFG control** — Users cannot control prompt adherence
2. **No seed control** — No reproducibility
3. **No negative prompts** — Cannot exclude artifacts
4. **No denoising strength** — Cannot control transformation intensity
5. **No motion brushes / masks** — Cannot control spatial motion
6. **No layer compositing** — Cannot stack or blend effects
7. **No text-to-video mode** — Cannot generate from prompt alone

Implementing the **P0 and P1 recommendations** would bring the studio to **competitive parity** with current market offerings. The **P2 and P3 features** would differentiate it as a **professional-grade** tool.

**Estimated effort for P0+P1:** 6-8 sprints (12-16 weeks) with a full-stack team.

---

*End of Audit Report*
