# Video Prompt & Example Integration Plan

## Problem Statement

How might we integrate curated video generation prompts and examples from external repos into existing studios, turning one-off prompt collections into reusable, structured templates that map directly to each studio's UI and video generation logic?

## Recommended Direction

Treat external prompt repos as **content libraries**, not UI rework. Each repo's prompts should be normalized into the app's existing template schema (`lib/templates.js`, `src/lib/templateSpecs.js`) and routed to the studio whose UI already supports that model family's parameters. The `MuapiClient` already proxies most of these models — the missing piece is the template layer that pre-fills prompts, selects the correct model, and constrains the UI to the right parameter set.

## Studio Mapping

| Repo / Model Family | Primary Studio | Secondary Studio | Rationale |
|---|---|---|---|
| **Seedance 2.5** (ByteDance) | `cinema` | `video`, `template` | Rich cinematic prompts, camera/lens vocab, 6-step formula, character consistency, omni-reference. CinemaStudio already has camera builder + cinematic prompt compilation. |
| **MiniMax H3** | `video` | `influencer`, `commercial` | Social/viral, fashion, anime, ads, gameplay, music. InfluencerStudio covers fashion/vlog/social; CommercialStudio covers product/ads. |
| **FLUX 3 Video** | `video` | `cinema`, `template` | T2V/I2V with native audio, cinematic descriptions. Fits VideoStudio's t2v/i2v modes and CinemaStudio's cinematic flow. |
| **Wan 3.0** | `video` | `effects` | General video generation plus motion controls/effects. Wan is already wired into VideoStudio and EffectsStudio's motion/vfx tabs. |
| **Grok Imagine Image 2** | `edit` | `image` | Image editing + multi-reference. EditStudio already lists `grok-imagine-image-to-image`; ImageStudio is the t2i/i2i surface. |

## Integration Architecture

### 1. Template Data Layer

**Files to modify:**
- `lib/templates.js` — add new template entries
- `src/lib/templateSpecs.js` — add enriched specs for video templates

**New template schema (video-specific):**

```js
{
  id: 'seedance-cinematic-cyberpunk-rain',
  name: 'Cyberpunk Rain City',
  category: 'cinematic',
  studio: 'cinema',          // maps to which studio loads this
  model: 'seedance-v2.5-t2v',
  workflow: 't2v',           // t2v | i2v | first_last_frame | omni_reference | video_edit | video_extend | character_consistency
  prompt: 'A cinematic slow-motion shot...',
  promptTemplate: 'A {{style}} shot of {{subject}} in {{environment}}, {{camera}}',
  // UI hints
  ui: {
    heroTitle: 'Cyberpunk City',
    heroSubtitle: 'Neon-drenched rain',
    quickInputs: [
      { key: 'subject', label: 'Subject', type: 'text', default: 'cyberpunk city' },
      { key: 'environment', label: 'Environment', type: 'text', default: 'rain-slicked streets' },
      { key: 'camera', label: 'Camera Move', type: 'select', options: ['dolly in', 'tracking shot', 'steadicam follow'] }
    ],
    advancedInputs: [
      { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', options: ['16:9', '9:16', '21:9', '1:1'] },
      { key: 'duration', label: 'Duration (s)', type: 'number', default: 5, min: 4, max: 30 },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['480p', '720p', '1080p', '4k'] },
      { key: 'seed', label: 'Seed', type: 'number', default: -1 },
      { key: 'generate_audio', label: 'Generate Audio', type: 'boolean', default: true },
      { key: 'camera_fixed', label: 'Fixed Camera', type: 'boolean', default: false },
      { key: 'variant', label: 'Variant', type: 'select', options: ['standard', 'intl', 'spicy'] },
      { key: 'quality', label: 'Quality', type: 'select', options: ['basic', 'high'] },
      { key: 'output_format', label: 'Format', type: 'select', options: ['mp4', 'mov'] }
    ]
  },
  // Enriched spec (already exists in templateSpecs.js pattern)
  spec: {
    coreUseCase: 'Cinematic brand film',
    visualStyle: 'cyberpunk noir',
    cinematography: 'slow push in, rain reflections, neon rim light',
    enhancerKeywords: ['cinematic', '8k', 'film grain', 'volumetric light'],
    negativePrompt: 'blurry, oversaturated, cartoon, watermark'
  }
}
```

### 2. Template Categories & Studios

Create **template category bundles** per repo, each routed to the appropriate studio:

| Bundle ID | Repo | Studio | Count (target) |
|---|---|---|---|
| `seedance-cinematic` | awesome-seedance-2.5-api-prompts | `cinema` | 15 |
| `seedance-social` | awesome-seedance-2.5-api-prompts | `video` | 10 |
| `seedance-character` | awesome-seedance-2.5-api-prompts | `character` | 5 |
| `minimax-social` | awesome-minimax-h3-prompts | `influencer` | 12 |
| `minimax-ads` | awesome-minimax-h3-prompts | `commercial` | 8 |
| `flux3-video` | Flux-3-Dev-API / flux-3-video-api | `video` | 8 |
| `flux3-cinematic` | Flux-3-Dev-API | `cinema` | 6 |
| `wan-general` | Wan-3.0-API | `video` | 10 |
| `wan-effects` | Wan-3.0-API | `effects` | 8 |
| `grok-edit` | Grok-Imagine-Image-2-API | `edit` | 8 |

### 3. Studio-Specific Integration Points

#### CinemaStudio (`src/components/CinemaStudio.js`)
- **Add:** New "Prompt Library" panel in the collapsible Cinema Prompt Builder.
- **Behavior:** When a user selects a Seedance/FLUX cinematic template, auto-fill the base prompt, camera, lens, movement, and film look selects from the template's `spec.cinematography`.
- **Model routing:** If `template.model` starts with `seedance` or `flux-3`, lock the model selector to that family and expand the parameter panel (duration up to 30s, 4K, quality toggle).

#### VideoStudio (`src/components/VideoStudio.js`)
- **Add:** "Prompt Templates" dropdown/panel next to the prompt textarea.
- **Behavior:** Selecting a template pre-fills the prompt, sets the model, and updates the controls (duration, resolution, aspect ratio) to match the template's constraints.
- **Workflow detection:** If `template.workflow === 'i2v'`, auto-activate the image upload picker; if `t2v`, clear it.

#### TemplateStudio (`src/components/TemplateStudio.js`)
- **Add:** Model-family filter in the template catalog sidebar.
- **Behavior:** When a video template is selected, render `quickInputs` as the primary form and `advancedInputs` under an "Advanced" toggle. The TemplateStudio already supports `template.inputs` — extend it to read `template.ui.quickInputs` and `template.ui.advancedInputs`.
- **Output:** Compile the final prompt via `promptTemplate` variable substitution + `spec.enhancerKeywords`.

#### EditStudio (`src/components/EditStudio.js`)
- **Add:** "Reference Recipes" panel for Grok multi-reference templates.
- **Behavior:** Selecting a Grok template pre-fills the prompt and pre-loads reference images into the `images_list` field.

### 4. Video Generation Logic Connection

The generation path already exists:

```
Studio component → MuapiClient method → /functions/v1/muapi-proxy → MuAPI
```

**What changes:**

1. **Model ID mapping** — Ensure the model IDs used in templates match those already in the app's model catalog. Verify:
   - `seedance-v2.5-t2v` / `seedance-v2.5-i2v` exist in `modelCatalogService.js`
   - `minimax-hailuo-2.3-standard-i2v` and t2v equivalents exist
   - `flux-3-text-to-video`, `flux-3-image-to-video` exist
   - `wan-3.0-t2v`, `wan-3.0-i2v` exist
   - `grok-imagine-image-2` exists

2. **Parameter validation per model** — Add a `parameterConstraints` field to template specs:
   ```js
   parameterConstraints: {
     maxDuration: 30,
     maxResolution: '4k',
     supportedAspectRatios: ['16:9', '9:16', '21:9', '1:1', '4:3', '3:4', '9:21'],
     supportsAudio: true,
     supportsCharacterSheet: true
   }
   ```
   Studios should clamp/disable controls outside these bounds.

3. **Prompt compilation** — Extend `src/lib/templateEngine.js` to handle video template prompt assembly:
   - Substitute `{{variables}}` in `promptTemplate`
   - Append `spec.cinematography` keywords for cinematic templates
   - Append `spec.enhancerKeywords` when GTM Boost is active
   - Merge `spec.negativePrompt` into the negative prompt field

### 5. Implementation Sequence

**Phase 1: Data ingestion (no UI changes)**
1. Create `src/lib/videoTemplateBundles.js` — exported arrays of template objects per repo, normalized to the schema above.
2. Create a build script or manual import to merge these into `lib/templates.js` and `src/lib/templateSpecs.js`.
3. Add `studio` and `workflow` fields to existing template entries where missing.

**Phase 2: TemplateStudio wiring**
1. Update `TemplateStudio.js` to read `template.ui.quickInputs` / `advancedInputs` and render them dynamically.
2. Add model-family filter to the template catalog.
3. Wire prompt compilation through `templateEngine.js`.

**Phase 3: CinemaStudio + VideoStudio panels**
1. Add "Prompt Library" side panel to CinemaStudio and VideoStudio.
2. Wire template selection to pre-fill prompts and sync model/parameter controls.
3. Clamp parameter controls to `parameterConstraints`.

**Phase 4: EditStudio + InfluencerStudio**
1. Add reference recipe panels.
2. Wire Grok multi-reference image pre-loading.

**Phase 5: Testing & Polish**
1. E2E tests for each studio with a video template.
2. Verify generation succeeds end-to-end for each model family.
3. Add template thumbnails to `thumbnails` table (or generate via existing thumbnail pipeline).

## Key Assumptions to Validate

- [ ] The model IDs used in the external repos match the IDs already registered in the app's model catalog. If not, add aliases in `modelCatalogService.js`.
- [ ] `MuapiClient` exposes all needed parameter fields (e.g., `variant`, `quality`, `camera_fixed`, `generate_audio`) for Seedance 2.5 and FLUX 3 Video. If methods are missing, extend `muapi.js`.
- [ ] TemplateStudio can render dynamic `quickInputs` without breaking existing `template.inputs` flow. Test with a non-video template first.
- [ ] Users expect to find these prompts inside the studio they're already in, not in a separate "Prompt Library" section. Validate with a simple user test.

## Not Doing

- **Not building a separate prompt marketplace or social feed.** Prompts live inside studios as templates.
- **Not duplicating the external repos.** We import curated examples, not the full SDKs or MCP servers.
- **Not rebuilding the generation pipeline.** `MuapiClient` + proxy already works; we're adding the template layer on top.
- **Not adding Seedance/FLUX/Wan-specific UI chrome to every studio.** Only studios that already support that model family get the template panel.
- **Not migrating templates to the database in this phase.** Keep them in frontend JS for speed; database migration is a separate task.

## Open Questions

- Should video templates support versioning (e.g., re-rolls with different seeds) via `generation_versions`?
- Do we want users to submit their own prompt templates, or is this read-only import from curated repos?
- Should cinematic templates in CinemaStudio also appear in TemplateStudio, or should they remain studio-specific?
