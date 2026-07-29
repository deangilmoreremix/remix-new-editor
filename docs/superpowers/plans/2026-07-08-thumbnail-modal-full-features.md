# Thumbnail Modal — Full Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the full set of OpenAI Responses API + Images API v2 features (quality, style, background, format, compression, aspect-ratio override, partial-image streaming, structured-output prompts, store/include, revised-prompt surfacing, reference-image inputs, in-Responses inpainting) plus a thumbnail preset system and a `template_thumbnail_jobs` completion table. Fix the existing `onConflict` upsert bug.

**Architecture:** Edge Function (`supabase/functions/ai-thumbnail-generator/index.ts`) gets new `prompts` schema, `store` + `include`, streaming via SSE, and richer return shapes. Client modal (`TemplateThumbnailModal.jsx`) gets a controls sidebar and a preset chip row. New `src/lib/thumbnailPresets.js` defines preset definitions. New migration adds `template_thumbnail_jobs` and updates the RLS. No model switcher.

**Tech Stack:** Deno + Supabase Edge Functions (TS), vanilla JS/JSX, Supabase Storage + Postgres, OpenAI Responses API (`image_generation` tool) + Images API v2.

## Global Constraints

- No model switcher. Default to `gpt-image-2` (Images API) + mainline text model (Responses API). Model choice stays in `IMG_GEN_MAINLINE_MODEL` env var.
- No new npm dependencies.
- No TypeScript syntax in `src/` (use `.js`/`.jsx`). Edge Function stays `.ts`.
- All OpenAI calls stay server-side. `OPENAI_API_KEY` never leaves the Edge Function.
- `gpt-image-2` does not support `background: "transparent"`. Modal must hide that option or fall back to `auto`.
- Every task ends with a commit. Every commit message uses `feat:` / `fix:` / `chore:` prefix.
- Existing modal CSS uses inline `<style>` injection (`THUMB_STYLES` constant). New modal styles extend that same string, not a separate SCSS file.

---

## File Structure (locked in by this plan)

| File | Action | Responsibility |
|---|---|---|
| `supabase/functions/ai-thumbnail-generator/index.ts` | Modify | All OpenAI calls, 5 actions + streaming, structured output, store/include, inpaint-on-tool, in-Responses mask |
| `supabase/migrations/20260708b_thumbnail_jobs.sql` | Create | `template_thumbnail_jobs` table + RLS |
| `src/lib/thumbnailPresets.js` | Create | Preset definitions + `getPresetFor(template)` + `applyPresetToControls(preset, controls)` |
| `src/lib/thumbnailService.js` | Modify | New client methods: `generateCandidates(opts)`, `refineLastImage(opts)`, `inpaint(opts)`, `saveToStorage(opts)` accept full control object. New: `analyzeImage` (vision), `uploadReferenceImage`. |
| `src/lib/config/openaiConfig.js` | Modify | New thumbnail defaults: `thumbnailQuality`, `thumbnailStyle`, `thumbnailBackground`, `thumbnailOutputFormat`, `thumbnailCompression`, `thumbnailAspectRatios` |
| `src/components/modals/TemplateThumbnailModal.jsx` | Modify | Sidebar controls, preset chips, reference-image input, streaming preview, revised-prompt pill, completion timestamp |
| `src/components/TemplateStudio.js` | Modify | Wire preset selection to modal; pass latest saved job id to calling code |
| `src/components/TemplatesPage.js` | Modify | No change required for features; verify still works |

---

### Task 1: Fix `onConflict` bug in `persistThumbnailRow`

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:97`

- [ ] **Step 1: Change onConflict target**

Edit line 97 of `index.ts`:

```ts
{ onConflict: "user_id, target_id" }
```

Replace the existing `{ onConflict: "target_type, target_id, user_id" }`.

- [ ] **Step 2: Verify partial unique index matches**

Open `supabase/migrations/20260708_template_thumbnail_extensions.sql` line 22-24. Confirm index is `ON thumbnails(user_id, target_id) WHERE target_type = 'template' AND is_custom = true`. It is — no DB change needed; the `onConflict` value just needs to match `(user_id, target_id)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "fix(thumbnail): align persistThumbnailRow onConflict with partial unique index"
```

---

### Task 2: Add `template_thumbnail_jobs` table migration

**Files:**
- Create: `supabase/migrations/20260708b_thumbnail_jobs.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Template Thumbnail Jobs — completion tracking
BEGIN;

CREATE TABLE IF NOT EXISTS template_thumbnail_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  preset_key text,
  prompt_used text,
  image_url text,
  image_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_thumb_jobs_user_template
  ON template_thumbnail_jobs(user_id, template_id);

CREATE INDEX IF NOT EXISTS idx_thumb_jobs_status
  ON template_thumbnail_jobs(status, completed_at DESC);

ALTER TABLE template_thumbnail_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_thumb_job_read" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_read"
  ON template_thumbnail_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_thumb_job_write" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_write"
  ON template_thumbnail_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_thumb_job_update" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_update"
  ON template_thumbnail_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260708b_thumbnail_jobs.sql
git commit -m "feat(thumbnail): add template_thumbnail_jobs table for completion tracking"
```

---

### Task 3: Extend `openaiConfig` thumbnail defaults

**Files:**
- Modify: `src/lib/config/openaiConfig.js:8-26`

- [ ] **Step 1: Replace thumbnail defaults block**

In `openaiConfig.js`, replace the `thumbnailModel` through `thumbnailCompression` lines (lines 19-25) with:

```js
      // Thumbnail overrides used by ThumbnailService / ai-thumbnail-generator
      thumbnailModel: 'gpt-image-2',
      thumbnailDefaultSize: '1792x1024',
      thumbnailAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      thumbnailQuality: 'high',
      thumbnailQualities: ['low', 'medium', 'high', 'auto'],
      thumbnailStyle: 'vivid',
      thumbnailStyles: ['vivid', 'natural'],
      thumbnailBackground: 'auto',
      thumbnailBackgrounds: ['auto', 'opaque'], // gpt-image-2: no transparent
      thumbnailFormat: 'webp',
      thumbnailFormats: ['webp', 'jpeg', 'png'],
      thumbnailCompression: 80,
      thumbnailPartialImages: 1,
      thumbnailStoreResponses: true,
      thumbnailInclude: ['reasoning.encrypted_content'],
```

- [ ] **Step 2: Extend `getThumbnailOutputSettings()`**

Replace the `getThumbnailOutputSettings()` method (lines 174-183) with:

```js
  getThumbnailOutputSettings() {
    return {
      model: this.defaultConfig.thumbnailModel,
      size: this.defaultConfig.thumbnailDefaultSize,
      aspectRatios: [...this.defaultConfig.thumbnailAspectRatios],
      quality: this.defaultConfig.thumbnailQuality,
      qualities: [...this.defaultConfig.thumbnailQualities],
      style: this.defaultConfig.thumbnailStyle,
      styles: [...this.defaultConfig.thumbnailStyles],
      background: this.defaultConfig.thumbnailBackground,
      backgrounds: [...this.defaultConfig.thumbnailBackgrounds],
      format: this.defaultConfig.thumbnailFormat,
      formats: [...this.defaultConfig.thumbnailFormats],
      compression: this.defaultConfig.thumbnailCompression,
      partialImages: this.defaultConfig.thumbnailPartialImages,
      store: this.defaultConfig.thumbnailStoreResponses,
      include: [...this.defaultConfig.thumbnailInclude],
    };
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/config/openaiConfig.js
git commit -m "feat(thumbnail): extend openaiConfig with full control surface"
```

---

### Task 4: Create thumbnail preset library

**Files:**
- Create: `src/lib/thumbnailPresets.js`

- [ ] **Step 1: Create preset file**

```js
/**
 * Thumbnail Preset Library
 *
 * Curated presets for common template niches / categories. Each preset locks
 * in a brief modifier + control defaults. Selecting a preset in the modal
 * overrides the auto-composed brief.
 *
 * Preset schema:
 *   key:           string id
 *   name:          string display name
 *   matchNiches:   string[] — template.niche values that auto-select this preset
 *   matchCategories: string[] — template.category values
 *   briefModifier: string — appended to the auto-composed brief
 *   controls:      { quality, style, background, format, compression, aspectRatio }
 */

export const THUMBNAIL_PRESETS = {
  cinematic: {
    key: 'cinematic',
    name: '🎬 Cinematic',
    matchNiches: ['cinema', 'film', 'cinematic'],
    matchCategories: ['cinema', 'cinema-template-studio'],
    briefModifier: 'widescreen cinematic composition, shallow depth of field, anamorphic lens, color graded, 24fps, editorial framing',
    controls: { quality: 'high', style: 'vivid', background: 'opaque', format: 'webp', compression: 80, aspectRatio: '16:9' },
  },
  productCutout: {
    key: 'productCutout',
    name: '📦 Product Cutout',
    matchNiches: ['product', 'ecom', 'retail'],
    matchCategories: [],
    briefModifier: 'isolated product on plain background, centered, crisp silhouette, no halos, label legible, soft contact shadow',
    controls: { quality: 'high', style: 'natural', background: 'opaque', format: 'webp', compression: 85, aspectRatio: '1:1' },
  },
  lifestyle: {
    key: 'lifestyle',
    name: '🌿 Lifestyle',
    matchNiches: ['fitness', 'wellness', 'lifestyle', 'salon', 'medspa', 'restaurant'],
    matchCategories: [],
    briefModifier: 'lifestyle photography, warm natural light, candid moment, real-people feel, gentle color palette, inviting atmosphere',
    controls: { quality: 'high', style: 'natural', background: 'auto', format: 'webp', compression: 80, aspectRatio: '4:3' },
  },
  boldText: {
    key: 'boldText',
    name: '💥 Bold Text',
    matchNiches: [],
    matchCategories: [],
    briefModifier: 'high-contrast composition, single dominant subject, large negative space for headline overlay, punchy colors, thumbnail-readable from arm’s length',
    controls: { quality: 'high', style: 'vivid', background: 'opaque', format: 'webp', compression: 75, aspectRatio: '16:9' },
  },
  minimal: {
    key: 'minimal',
    name: '⚪ Minimal',
    matchNiches: ['legal', 'finance', 'consulting'],
    matchCategories: [],
    briefModifier: 'minimal composition, generous negative space, restrained palette, single subtle subject, professional restraint',
    controls: { quality: 'high', style: 'natural', background: 'opaque', format: 'webp', compression: 90, aspectRatio: '16:9' },
  },
  vertical: {
    key: 'vertical',
    name: '📱 Vertical',
    matchNiches: ['tiktok', 'reels', 'shorts', 'stories'],
    matchCategories: ['video-studio', 'text-to-video'],
    briefModifier: 'vertical 9:16 framing, top-of-frame subject, lower-third space for caption, mobile-readable',
    controls: { quality: 'high', style: 'vivid', background: 'auto', format: 'webp', compression: 80, aspectRatio: '9:16' },
  },
};

export const DEFAULT_PRESET_KEY = 'cinematic';

/**
 * Pick a preset for a template based on niche/category.
 * Returns the first matching preset or DEFAULT_PRESET_KEY.
 */
export function getPresetForTemplate(template) {
  if (!template) return THUMBNAIL_PRESETS[DEFAULT_PRESET_KEY];
  const niche = (template.niche || '').toLowerCase();
  const category = (template.category || '').toLowerCase();
  for (const preset of Object.values(THUMBNAIL_PRESETS)) {
    if (preset.matchNiches.some((n) => n.toLowerCase() === niche)) return preset;
    if (preset.matchCategories.some((c) => c.toLowerCase() === category)) return preset;
  }
  return THUMBNAIL_PRESETS[DEFAULT_PRESET_KEY];
}

/**
 * Apply a preset's controls to an existing control object.
 * Pure function; returns a new controls object.
 */
export function applyPresetToControls(preset, currentControls = {}) {
  return { ...currentControls, ...preset.controls };
}

/**
 * Apply a preset's brief modifier to an existing brief string.
 * Pure function; returns a new brief string.
 */
export function applyPresetToBrief(preset, baseBrief) {
  if (!preset || !preset.briefModifier) return baseBrief;
  return `${baseBrief}\n\nStyle direction: ${preset.briefModifier}`;
}

export const PRESET_LIST = Object.values(THUMBNAIL_PRESETS);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/thumbnailPresets.js
git commit -m "feat(thumbnail): add preset library for niche/category-aware defaults"
```

---

### Task 5: Edge Function — `prompts` action with structured output

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:46-59, 173-222`

- [ ] **Step 1: Extend `PromptsRequest` interface**

Replace lines 117-129:

```ts
interface PromptsRequest {
  action: "prompts";
  templateId: string;
  brief?: string;
  template?: {
    name: string;
    aspectRatio?: string;
    outputType?: string;
    visualStyle?: string;
    cinematography?: string;
    niche?: string;
  };
  presetKey?: string;
  presetModifier?: string;
}
```

- [ ] **Step 2: Add `THUMBNAIL_PRESETS` to the edge function**

Add a constant near the top of the file (after the `IMG_GEN_MAINLINE_MODEL` constant, around line 28):

```ts
// Server-side preset definitions — keep in sync with src/lib/thumbnailPresets.js.
// The brief modifier is appended to the auto-composed brief.
const PRESET_MODIFIERS: Record<string, string> = {
  cinematic: 'widescreen cinematic composition, shallow depth of field, anamorphic lens, color graded, 24fps, editorial framing',
  productCutout: 'isolated product on plain background, centered, crisp silhouette, no halos, label legible, soft contact shadow',
  lifestyle: 'lifestyle photography, warm natural light, candid moment, real-people feel, gentle color palette, inviting atmosphere',
  boldText: 'high-contrast composition, single dominant subject, large negative space for headline overlay, punchy colors, thumbnail-readable from arm’s length',
  minimal: 'minimal composition, generous negative space, restrained palette, single subtle subject, professional restraint',
  vertical: 'vertical 9:16 framing, top-of-frame subject, lower-third space for caption, mobile-readable',
};
```

- [ ] **Step 3: Replace `handlePrompts` with structured-output version**

Replace lines 173-222:

```ts
async function handlePrompts(body: PromptsRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const baseBrief =
    body.brief ||
    buildPromptBrief(body.template?.name || body.templateId, {
      visualStyle: body.template?.visualStyle,
      cinematography: body.template?.cinematography,
      niche: body.template?.niche,
      aspectRatio: body.template?.aspectRatio || "16:9",
      outputType: body.template?.outputType || "video",
    });

  const modifier = body.presetKey && PRESET_MODIFIERS[body.presetKey]
    ? body.presetModifier || PRESET_MODIFIERS[body.presetKey]
    : "";

  const brief = modifier ? `${baseBrief}\n\nStyle direction: ${modifier}` : baseBrief;

  const systemInstruction = `You are a thumbnail prompt engineer for gpt-image-2.
Using the template context below, write 3 DISTINCT thumbnail prompts.
Each prompt must:
- Lead with a single hero subject/scene
- Include 3-5 cinematic modifiers (lighting, lens, palette, mood)
- End with quality/style tokens (e.g. "editorial, 4K, high contrast")
- AVOID text, logos, watermarks, UI elements

Return JSON matching the provided schema.`;

  const userInstruction = `TEMPLATE CONTEXT:\n${brief}`;

  const promptVariantsSchema = {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 20 },
      },
    },
    required: ["prompts"],
    additionalProperties: false,
  };

  try {
    const completion = await openai.responses.create({
      model: IMG_GEN_MAINLINE_MODEL,
      instructions: systemInstruction,
      input: userInstruction,
      store: true,
      text: {
        format: {
          type: "json_schema",
          name: "thumbnail_prompt_variants",
          strict: true,
          schema: promptVariantsSchema,
        },
      },
    });

    let parsed: { prompts?: string[] } = {};
    const text = (completion.output_text as string) || "";
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { prompts: [] };
    }

    return jsonResponse({
      variants: parsed.prompts || [],
      response_id: completion.id,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Prompt generation failed" }, 502);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "feat(thumbnail): use structured json_schema output for prompt variants"
```

---

### Task 6: Edge Function — `generate` accepts full control surface

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:131-136, 224-253`

- [ ] **Step 1: Extend `GenerateRequest` interface**

Replace lines 131-136:

```ts
interface GenerateRequest {
  action: "generate";
  prompt: string;
  aspectRatio: string;
  n?: number;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
}
```

- [ ] **Step 2: Replace `handleGenerate` with full-param version**

Replace lines 224-253:

```ts
async function handleGenerate(body: GenerateRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio);
  const n = Math.min(body.n || 3, 3);
  const quality = body.quality || "high";
  const style = body.style || "vivid";
  // gpt-image-2 does not support transparent — clamp to auto if requested
  const background = body.background === "transparent" ? "auto" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";
  const outputCompression = body.outputCompression ?? 80;

  try {
    const result = await openai!.images.generate({
      model: "gpt-image-2",
      prompt: body.prompt,
      n,
      size,
      quality,
      style,
      background,
      output_format: outputFormat,
      output_compression: outputCompression,
      response_format: "b64_json",
      moderation: "auto",
    });

    const candidates = result.data.map((img) => ({
      b64_json: img.b64_json,
      revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
    }));

    return jsonResponse({ candidates, params: { quality, style, background, outputFormat, outputCompression, size } });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Image generation failed" }, 502);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "feat(thumbnail): generate action accepts quality, style, background, format, compression"
```

---

### Task 7: Edge Function — `inpaint` accepts full control surface

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:144-150, 286-322`

- [ ] **Step 1: Extend `InpaintRequest` interface**

Replace lines 144-150:

```ts
interface InpaintRequest {
  action: "inpaint";
  prompt: string;
  imageB64: string;
  maskB64: string;
  aspectRatio?: string;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
}
```

- [ ] **Step 2: Replace `handleInpaint` with full-param version**

Replace lines 286-322:

```ts
async function handleInpaint(body: InpaintRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio || "16:9");
  const quality = body.quality || "high";
  const style = body.style || "vivid";
  const background = body.background === "transparent" ? "auto" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";

  try {
    const imageBytes = await base64ToUint8Array(body.imageB64);
    const maskBytes = await base64ToUint8Array(body.maskB64);

    const imageBlob = new Blob([imageBytes], { type: "image/png" });
    const maskBlob = new Blob([maskBytes], { type: "image/png" });

    const result = await openai!.images.edit({
      model: "gpt-image-2",
      image: imageBlob,
      mask: maskBlob,
      prompt: body.prompt,
      n: 1,
      size,
      quality,
      style,
      background,
      output_format: outputFormat,
      response_format: "b64_json",
    });

    const img = result.data[0];
    return jsonResponse({
      result: {
        b64_json: img.b64_json,
        revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
        response_id: "",
      },
      params: { quality, style, background, outputFormat, size },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Inpaint failed" }, 502);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "feat(thumbnail): inpaint action accepts quality, style, background, format"
```

---

### Task 8: Edge Function — `refine` with `store`/`include`, streaming, and tool options

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:138-142, 255-284`

- [ ] **Step 1: Extend `RefineRequest` interface**

Replace lines 138-142:

```ts
interface RefineRequest {
  action: "refine";
  prompt: string;
  previousResponseId: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  partialImages?: number;
  store?: boolean;
  include?: string[];
  // For reference-image input on multi-modal refine
  referenceImageB64?: string;
  referenceImageUrl?: string;
  referenceImageFileId?: string;
  imageDetail?: "low" | "high" | "original" | "auto";
}
```

- [ ] **Step 2: Replace `handleRefine` with full version**

Replace lines 255-284:

```ts
async function handleRefine(body: RefineRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const imageGenTool: Record<string, unknown> = { type: "image_generation" };
  if (body.size) imageGenTool.size = body.size;
  if (body.quality) imageGenTool.quality = body.quality;
  if (body.background) {
    imageGenTool.background = body.background === "transparent" ? "auto" : body.background;
  }
  if (body.outputFormat) imageGenTool.output_format = body.outputFormat;
  if (typeof body.outputCompression === "number") imageGenTool.output_compression = body.outputCompression;
  if (typeof body.partialImages === "number" && body.partialImages > 0) {
    imageGenTool.partial_images = Math.min(body.partialImages, 3);
  }

  // Build the input content. If a reference image is supplied, attach it as
  // an input_image alongside the text.
  const userContent: Array<Record<string, unknown>> = [
    { type: "input_text", text: body.prompt },
  ];
  if (body.referenceImageB64) {
    userContent.push({
      type: "input_image",
      image_url: `data:image/png;base64,${body.referenceImageB64}`,
      detail: body.imageDetail || "auto",
    });
  } else if (body.referenceImageUrl) {
    userContent.push({
      type: "input_image",
      image_url: body.referenceImageUrl,
      detail: body.imageDetail || "auto",
    });
  } else if (body.referenceImageFileId) {
    userContent.push({
      type: "input_image",
      file_id: body.referenceImageFileId,
      detail: body.imageDetail || "auto",
    });
  }

  const reqBody: Record<string, unknown> = {
    model: IMG_GEN_MAINLINE_MODEL,
    input: [{ role: "user", content: userContent }],
    tools: [imageGenTool],
  };
  if (body.previousResponseId) reqBody.previous_response_id = body.previousResponseId;
  if (typeof body.store === "boolean") reqBody.store = body.store;
  if (Array.isArray(body.include) && body.include.length > 0) reqBody.include = body.include;

  try {
    const completion = await openai.responses.create(reqBody as Parameters<typeof openai.responses.create>[0]);

    const imageCalls = completion.output.filter((o) => o.type === "image_generation_call");
    const first = imageCalls[0] as { result?: string; revised_prompt?: string } | undefined;

    return jsonResponse({
      result: {
        b64_json: first?.result ?? "",
        revised_prompt: (first as { revised_prompt?: string })?.revised_prompt ?? "",
        response_id: completion.id,
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Refine failed" }, 502);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "feat(thumbnail): refine action accepts tool options, store/include, reference image input"
```

---

### Task 9: Edge Function — `save` action persists `template_thumbnail_jobs` row

**Files:**
- Modify: `supabase/functions/ai-thumbnail-generator/index.ts:152-159, 324-344`

- [ ] **Step 1: Extend `SaveRequest` interface**

Replace lines 152-159:

```ts
interface SaveRequest {
  action: "save";
  templateId: string;
  imageB64: string;
  altText: string;
  userId: string;
  promptUsed: string;
  presetKey?: string;
  controls?: {
    quality?: string;
    style?: string;
    background?: string;
    outputFormat?: string;
    outputCompression?: number;
    aspectRatio?: string;
  };
}
```

- [ ] **Step 2: Add `persistJob` helper**

Add this function after `persistThumbnailRow` (after line 100):

```ts
async function persistJob(params: {
  templateId: string;
  userId: string;
  presetKey?: string;
  promptUsed: string;
  imageUrl: string;
  imagePath: string;
  status: "draft" | "completed" | "archived";
}): Promise<void> {
  if (!supabase) return;
  const row: Record<string, unknown> = {
    template_id: params.templateId,
    user_id: params.userId,
    preset_key: params.presetKey || null,
    prompt_used: params.promptUsed,
    image_url: params.imageUrl,
    image_path: params.imagePath,
    status: params.status,
  };
  if (params.status === "completed") row.completed_at = new Date().toISOString();
  const { error } = await supabase.from("template_thumbnail_jobs").insert(row);
  if (error) console.error("[ai-thumbnail-generator] job persist error", error);
}
```

- [ ] **Step 3: Update `handleSave` to also write a job row**

Replace lines 324-344:

```ts
async function handleSave(body: SaveRequest) {
  if (!supabase) return jsonResponse({ error: "Supabase not configured" }, 500);

  try {
    const imageBuffer = await base64ToUint8Array(body.imageB64);
    const filename = `${body.templateId}/${crypto.randomUUID()}.${body.controls?.outputFormat || "webp"}`;
    const imageUrl = await uploadBufferToStorage(imageBuffer, filename);

    await persistThumbnailRow({
      templateId: body.templateId,
      imagePath: imageUrl,
      promptUsed: body.promptUsed,
      altText: body.altText || body.templateId,
      userId: body.userId,
    });

    await persistJob({
      templateId: body.templateId,
      userId: body.userId,
      presetKey: body.presetKey,
      promptUsed: body.promptUsed,
      imageUrl,
      imagePath: filename,
      status: "completed",
    });

    return jsonResponse({
      imageUrl,
      path: filename,
      job: {
        templateId: body.templateId,
        presetKey: body.presetKey,
        controls: body.controls,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Save failed" }, 502);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-thumbnail-generator/index.ts
git commit -m "feat(thumbnail): save action also writes template_thumbnail_jobs row"
```

---

### Task 10: Extend `thumbnailService` client

**Files:**
- Modify: `src/lib/thumbnailService.js:38-117`

- [ ] **Step 1: Update `buildPromptVariants` to pass preset**

Replace lines 38-56:

```js
  async buildPromptVariants(brief, presetKey) {
    const body = {
      action: 'prompts',
      templateId: this.templateId,
      brief,
      template: {
        name: this.options.templateName,
        aspectRatio: this.options.aspectRatio,
        outputType: this.options.outputType,
        visualStyle: this.options.visualStyle,
        cinematography: this.options.cinematography,
        niche: this.options.niche,
      },
    };
    if (presetKey) body.presetKey = presetKey;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to build prompt variants');
    return { variants: data?.variants || [], responseId: data?.response_id || null };
  }
```

- [ ] **Step 2: Update `generateCandidates` to accept control object**

Replace lines 58-70:

```js
  async generateCandidates(prompt, opts = {}) {
    const body = {
      action: 'generate',
      prompt,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      n: Math.min(opts.n ?? 3, 3),
    };
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to generate candidates');
    return { candidates: data?.candidates || [], params: data?.params || null };
  }
```

- [ ] **Step 3: Update `refineLastImage` to accept control object**

Replace lines 72-83:

```js
  async refineLastImage(opts) {
    const body = {
      action: 'refine',
      prompt: opts.prompt,
      previousResponseId: opts.previousResponseId || '',
    };
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (typeof opts.store === 'boolean') body.store = opts.store;
    if (Array.isArray(opts.include) && opts.include.length) body.include = opts.include;
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    if (opts.referenceImageUrl) body.referenceImageUrl = opts.referenceImageUrl;
    if (opts.referenceImageFileId) body.referenceImageFileId = opts.referenceImageFileId;
    if (opts.imageDetail) body.imageDetail = opts.imageDetail;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to refine image');
    return data?.result;
  }
```

- [ ] **Step 4: Update `inpaint` to accept control object**

Replace lines 85-98:

```js
  async inpaint(opts) {
    const body = {
      action: 'inpaint',
      prompt: opts.prompt,
      imageB64: opts.imageB64,
      maskB64: opts.maskB64,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
    };
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to inpaint image');
    return data?.result;
  }
```

- [ ] **Step 5: Update `saveToStorage` to accept preset + controls**

Replace lines 100-117:

```js
  async saveToStorage(opts) {
    const userId = this.options.userId || await this.currentUserId();
    if (!userId) throw new Error('User not authenticated');

    const body = {
      action: 'save',
      templateId: this.templateId,
      imageB64: opts.imageB64,
      altText: this.options.altText || this.templateId,
      userId,
      promptUsed: opts.promptUsed || '',
    };
    if (opts.presetKey) body.presetKey = opts.presetKey;
    if (opts.controls) body.controls = opts.controls;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to save thumbnail');
    return data;
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/thumbnailService.js
git commit -m "feat(thumbnail): client service accepts full control object for all actions"
```

---

### Task 11: Modal — preset chips + sidebar controls

**Files:**
- Modify: `src/components/modals/TemplateThumbnailModal.jsx`

- [ ] **Step 1: Import presets and update imports**

Replace line 3 (imports block) with:

```jsx
import { BaseModal } from './BaseModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, getPresetForTemplate, applyPresetToControls, applyPresetToBrief } from '../../lib/thumbnailPresets.js';
```

- [ ] **Step 2: Extend `THUMB_STYLES` with sidebar + chip + revised-pill CSS**

Replace the `THUMB_STYLES` constant (lines 5-101) with the existing string plus these new rules appended before the closing backtick:

```css
.thumb-modal__layout { display: grid; grid-template-columns: 1fr 220px; gap: 16px; min-height: 0; }
.thumb-modal__main { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; }
.thumb-modal__sidebar { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.025); }
.thumb-modal__sidebar-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #71717a; }
.thumb-modal__field { display: flex; flex-direction: column; gap: 4px; }
.thumb-modal__field label { font-size: 10px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.12em; }
.thumb-modal__select, .thumb-modal__input {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
  color: #d4d4d8; font-size: 12px; padding: 6px 8px; border-radius: 8px; font-family: inherit;
}
.thumb-modal__select:focus, .thumb-modal__input:focus { outline: none; border-color: #22d3ee; }
.thumb-modal__presets { display: flex; flex-wrap: wrap; gap: 6px; }
.thumb-modal__preset-chip {
  display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
  color: #a1a1aa; font-size: 11px; cursor: pointer; font-family: inherit;
  transition: all 120ms ease;
}
.thumb-modal__preset-chip:hover { border-color: #22d3ee; color: white; }
.thumb-modal__preset-chip--active { border-color: #22d3ee; background: rgba(34,211,238,0.12); color: white; }
.thumb-modal__revised {
  font-size: 10px; color: #71717a; line-height: 1.4;
  padding: 6px 8px; border-radius: 8px; background: rgba(0,0,0,0.25);
  border: 1px dashed rgba(255,255,255,0.06); max-height: 60px; overflow: auto;
}
.thumb-modal__partial {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); color: #a1a1aa; font-size: 11px; letter-spacing: 0.08em;
}
.thumb-modal__partial img { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
.thumb-modal__ref-upload { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #a1a1aa; }
```

- [ ] **Step 3: Add state in constructor**

In the `constructor` (line 124-169), add these new state fields before the `maskCanvas` line (line 167):

```js
    this.preset = null;
    this.presetKey = null;
    this.controls = {
      quality: openaiConfig.defaultConfig.thumbnailQuality,
      style: openaiConfig.defaultConfig.thumbnailStyle,
      background: openaiConfig.defaultConfig.thumbnailBackground,
      outputFormat: openaiConfig.defaultConfig.thumbnailFormat,
      outputCompression: openaiConfig.defaultConfig.thumbnailCompression,
      aspectRatio: this.template?.aspectRatio || '16:9',
    };
    this.referenceImage = null; // { source: 'b64'|'url'|'fileId', value: string, previewDataUrl?: string }
    this.imageDetail = 'auto';
    this.partialPreview = null; // data URL of latest partial-image preview
    this.completedAt = null;
    this.revisedPrompt = '';
```

- [ ] **Step 4: Update `open()` to set preset**

Replace the `open()` method (lines 713-730). Add preset initialization before `super.open()`:

```js
  open() {
    injectThumbStyles();
    this.step = 'brief';
    this.brief = this.buildInitialBrief();
    this.variants = [];
    this.selectedVariantIndex = -1;
    this.candidates = [];
    this.selectedIndex = -1;
    this.isGenerating = false;
    this._error = null;
    this.refineInput = '';
    this.lastResponseId = '';
    this.savedImageUrl = '';
    this.savedPromptUsed = '';
    this.maskCanvas = null;
    this.maskB64 = '';
    this.partialPreview = null;
    this.referenceImage = null;
    this.completedAt = null;
    this.revisedPrompt = '';

    // Apply auto-detected preset for this template
    this.preset = getPresetForTemplate(this.template);
    this.presetKey = this.preset.key;
    this.brief = applyPresetToBrief(this.preset, this.brief);
    this.controls = applyPresetToControls(this.preset, { ...this.controls, aspectRatio: this.template?.aspectRatio || '16:9' });

    super.open();
  }
```

- [ ] **Step 5: Add preset chip handler**

Add this method to the class (anywhere in the Actions section, e.g. after `selectCandidate` at line 482):

```js
  selectPreset(presetKey) {
    const preset = PRESET_LIST.find((p) => p.key === presetKey);
    if (!preset) return;
    this.preset = preset;
    this.presetKey = presetKey;
    this.brief = applyPresetToBrief(preset, this.buildInitialBrief());
    this.controls = applyPresetToControls(preset, { ...this.controls, aspectRatio: this.template?.aspectRatio || '16:9' });
    this.updateBody(this.renderBody());
  }
```

- [ ] **Step 6: Add `renderSidebar()` method**

Add this method to the class (after `renderRefine` or near other render methods):

```js
  renderSidebar() {
    const opts = openaiConfig.getThumbnailOutputSettings();
    const c = this.controls;
    return `
      <div class="thumb-modal__sidebar">
        <div class="thumb-modal__sidebar-title">Presets</div>
        <div class="thumb-modal__presets">
          ${PRESET_LIST.map((p) => `
            <button class="thumb-modal__preset-chip ${p.key === this.presetKey ? 'thumb-modal__preset-chip--active' : ''}"
                    onclick="window._thumbModal.selectPreset('${p.key}')">${p.name}</button>
          `).join('')}
        </div>
        <div class="thumb-modal__sidebar-title" style="margin-top:8px;">Output</div>
        <div class="thumb-modal__field">
          <label>Aspect ratio</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('aspectRatio', this.value)">
            ${opts.aspectRatios.map((r) => `<option value="${r}" ${c.aspectRatio === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="thumb-modal__field">
          <label>Quality</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('quality', this.value)">
            ${opts.qualities.map((q) => `<option value="${q}" ${c.quality === q ? 'selected' : ''}>${q}</option>`).join('')}
          </select>
        </div>
        <div class="thumb-modal__field">
          <label>Style</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('style', this.value)">
            ${opts.styles.map((s) => `<option value="${s}" ${c.style === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="thumb-modal__field">
          <label>Background</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('background', this.value)">
            ${opts.backgrounds.map((b) => `<option value="${b}" ${c.background === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="thumb-modal__field">
          <label>Format</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('outputFormat', this.value)">
            ${opts.formats.map((f) => `<option value="${f}" ${c.outputFormat === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="thumb-modal__field">
          <label>Compression</label>
          <input class="thumb-modal__input" type="number" min="0" max="100" value="${c.outputCompression}"
                 onchange="window._thumbModal.updateControl('outputCompression', Number(this.value))" />
        </div>
        <div class="thumb-modal__sidebar-title" style="margin-top:8px;">Refine</div>
        <div class="thumb-modal__field">
          <label>Reference image (optional)</label>
          <input type="file" accept="image/*" onchange="window._thumbModal.loadReferenceFile(this)" />
        </div>
        <div class="thumb-modal__field">
          <label>Detail</label>
          <select class="thumb-modal__select" onchange="window._thumbModal.updateControl('imageDetail', this.value)">
            ${['low', 'high', 'original', 'auto'].map((d) => `<option value="${d}" ${this.imageDetail === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        ${this.referenceImage ? `
          <div class="thumb-modal__ref-upload">
            <span>📎 Reference set</span>
            <button class="thumb-modal__btn thumb-modal__btn--ghost" style="height:24px;font-size:10px;padding:0 6px;" onclick="window._thumbModal.clearReference()">Clear</button>
          </div>
        ` : ''}
      </div>
    `;
  }
```

- [ ] **Step 7: Add control/reference helpers**

Add these methods after `selectPreset`:

```js
  updateControl(key, value) {
    this.controls = { ...this.controls, [key]: value };
    if (key === 'imageDetail') this.imageDetail = value;
    this.updateBody(this.renderBody());
  }

  async loadReferenceFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.split(',')[1] || '';
      this.referenceImage = { source: 'b64', value: b64, previewDataUrl: dataUrl };
      this.updateBody(this.renderBody());
    };
    reader.readAsDataURL(file);
  }

  clearReference() {
    this.referenceImage = null;
    this.updateBody(this.renderBody());
  }
```

- [ ] **Step 8: Commit**

```bash
git add src/components/modals/TemplateThumbnailModal.jsx
git commit -m "feat(thumbnail): add preset chips + sidebar controls (quality, style, bg, format, aspect, ref img)"
```

---

### Task 12: Modal — wrap render methods in the new layout

**Files:**
- Modify: `src/components/modals/TemplateThumbnailModal.jsx`

- [ ] **Step 1: Update `renderBody` to include sidebar**

Replace `renderBody` (lines 195-211):

```js
  renderBody() {
    if (this._error) return this.renderError();
    if (this.isGenerating) return this.renderLoading();

    let main = '';
    switch (this.step) {
      case 'brief':
        main = this.renderBrief();
        break;
      case 'generate':
        main = this.renderGenerate();
        break;
      case 'refine':
        main = this.renderRefine();
        break;
      case 'saved':
        main = this.renderSaved();
        break;
      default:
        main = this.renderBrief();
    }

    return `<div class="thumb-modal__layout"><div class="thumb-modal__main">${main}</div>${this.renderSidebar()}</div>`;
  }
```

- [ ] **Step 2: Add revised-prompt pill in `renderGenerate` candidate card**

In `renderGenerate` (lines 244-293), inside the candidate `.map` callback, after the existing candidate-actions block, add a revised-prompt element if available. Replace the candidate HTML:

```js
      : this.candidates.map((c, i) => {
          const src = c.dataUrl || ThumbnailService.b64ToDataUrl(c.b64_json);
          const revised = c.revised_prompt ? `<div class="thumb-modal__revised" title="Revised by the model">${this.escapeHtml(c.revised_prompt)}</div>` : '';
          return `
            <div class="thumb-modal__candidate ${i === this.selectedIndex ? 'thumb-modal__candidate--selected' : ''} ${this.isGenerating ? 'thumb-modal__candidate--busy' : ''}"
                 onclick="window._thumbModal.selectCandidate(${i})">
              <img src="${src}" alt="Candidate ${i + 1}" loading="lazy" />
              <div class="thumb-modal__candidate-actions">
                <button class="thumb-modal__btn thumb-modal__btn--ghost" style="height:28px;font-size:11px;padding:0 8px;"
                        onclick="event.stopPropagation(); window._thumbModal.selectCandidate(${i}); window._thumbModal.goRefine()">
                  Refine
                </button>
              </div>
              ${revised}
            </div>
          `;
        }).join('');
```

- [ ] **Step 3: Add partial-image overlay to `renderRefine` preview**

In `renderRefine` (lines 295-340), replace the preview block:

```js
        <div class="thumb-modal__section">
          <div class="thumb-modal__label">Selected Image</div>
          <div class="thumb-modal__preview">
            ${selected ? `<img src="${imgSrc}" alt="Selected" />` : '<div class="thumb-modal__empty">No image selected</div>'}
            ${this.partialPreview ? `<div class="thumb-modal__partial"><img src="${this.partialPreview}" alt="Partial preview" /></div>` : ''}
          </div>
        </div>
```

- [ ] **Step 4: Surface completed-at + preset in `renderSaved`**

In `renderSaved` (lines 342-363), replace the entire method:

```js
  renderSaved() {
    const presetLabel = this.preset ? this.preset.name : 'Default';
    const completedLabel = this.completedAt ? new Date(this.completedAt).toLocaleString() : 'just now';
    return `
      <div class="thumb-modal">
        <div class="thumb-modal__empty" style="padding:24px;">
          <div class="thumb-modal__empty-icon">✅</div>
          <div style="font-size:14px;color:#d4d4d8;font-weight:600;">Thumbnail saved</div>
          <div style="font-size:12px;color:#71717a;">Preset: ${presetLabel} · Completed ${completedLabel}</div>
        </div>
        <div class="thumb-modal__preview" style="margin-top:8px;">
          ${this.savedImageUrl ? `<img src="${this.savedImageUrl}" alt="Saved thumbnail" />` : ''}
        </div>
        ${this.revisedPrompt ? `<div class="thumb-modal__revised" style="margin-top:8px;"><strong>Revised prompt:</strong> ${this.escapeHtml(this.revisedPrompt)}</div>` : ''}
        <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px;">
          <button class="thumb-modal__btn thumb-modal__btn--primary" data-action="apply" onclick="window._thumbModal.confirmApply()">
            Apply to Template
          </button>
          <button class="thumb-modal__btn thumb-modal__btn--secondary" data-action="regenerate" onclick="window._thumbModal.regenerate()">
            🔄 Regenerate
          </button>
        </div>
      </div>
    `;
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/TemplateThumbnailModal.jsx
git commit -m "feat(thumbnail): wrap modal in grid layout with revised-prompt pills and partial preview"
```

---

### Task 13: Modal — pass controls/preset to service calls

**Files:**
- Modify: `src/components/modals/TemplateThumbnailModal.jsx`

- [ ] **Step 1: Update `buildPrompts` to send presetKey**

Replace `buildPrompts` (lines 440-455):

```js
  async buildPrompts() {
    this.clearError();
    const briefText = document.getElementById('thumb-brief')?.value || this.brief;
    this.brief = briefText;
    this.setLoading('Drafting prompt variants…');

    try {
      const { variants, responseId } = await this.thumbnailService.buildPromptVariants(briefText, this.presetKey);
      this.variants = variants;
      this.selectedVariantIndex = variants.length > 0 ? 0 : -1;
      this.lastResponseId = responseId || this.lastResponseId;
      this.isGenerating = false;
      this.updateBody(this.renderBody());
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Failed to draft prompts');
    }
  }
```

- [ ] **Step 2: Update `goGenerate` to pass full controls**

Replace `goGenerate` (lines 457-472):

```js
  async goGenerate() {
    this.clearError();
    const promptText = document.getElementById('thumb-prompt')?.value || this.selectedPromptText();
    this.setLoading('Generating candidates…');

    try {
      const { candidates, params } = await this.thumbnailService.generateCandidates(promptText, {
        n: 3,
        aspectRatio: this.controls.aspectRatio,
        quality: this.controls.quality,
        style: this.controls.style,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
        outputCompression: this.controls.outputCompression,
      });
      this.candidates = (candidates || []).map((c) => ({ ...c, dataUrl: ThumbnailService.b64ToDataUrl(c.b64_json) }));
      this.selectedIndex = this.candidates.length > 0 ? 0 : -1;
      if (params) this.lastParams = params;
      this.step = 'generate';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Failed to generate candidates');
    }
  }
```

- [ ] **Step 3: Update `applyRefine` to pass full controls + optional reference image**

Replace `applyRefine` (lines 492-517):

```js
  async applyRefine() {
    this.clearError();
    const input = document.getElementById('thumb-refine-input');
    const instruction = input?.value || this.refineInput;
    if (!instruction.trim()) return;
    this.refineInput = instruction;

    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    this.setLoading('Refining…');
    this.partialPreview = null;

    try {
      const result = await this.thumbnailService.refineLastImage({
        prompt: instruction,
        previousResponseId: this.lastResponseId || '',
        quality: this.controls.quality,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
        outputCompression: this.controls.outputCompression,
        partialImages: 1,
        store: true,
        include: ['reasoning.encrypted_content'],
        referenceImageB64: this.referenceImage?.source === 'b64' ? this.referenceImage.value : undefined,
        referenceImageUrl: this.referenceImage?.source === 'url' ? this.referenceImage.value : undefined,
        imageDetail: this.imageDetail,
      });
      if (result?.b64_json) {
        selected.b64_json = result.b64_json;
        selected.revised_prompt = result.revised_prompt;
        selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      }
      if (result?.response_id) this.lastResponseId = result.response_id;
      this.revisedPrompt = selected.revised_prompt || '';
      this.isGenerating = false;
      this._error = null;
      this.partialPreview = null;
      this.updateBody(this.renderBody());
      setTimeout(() => this.initMaskCanvas(), 50);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Refine failed');
    }
  }
```

- [ ] **Step 4: Update `applyInpaint` to pass full controls**

Replace `applyInpaint` (lines 519-545):

```js
  async applyInpaint() {
    this.clearError();
    const prompt = document.getElementById('thumb-refine-input')?.value || 'Fill this area naturally';
    const selected = this.candidates[this.selectedIndex];
    if (!selected) return;

    this.maskB64 = this.readMaskCanvas();
    if (!this.maskB64) {
      this.setError('Draw a mask on the canvas first (paint the area you want to change)');
      return;
    }

    this.setLoading('Inpainting…');

    try {
      const result = await this.thumbnailService.inpaint({
        prompt,
        imageB64: selected.b64_json,
        maskB64: this.maskB64,
        aspectRatio: this.controls.aspectRatio,
        quality: this.controls.quality,
        style: this.controls.style,
        background: this.controls.background,
        outputFormat: this.controls.outputFormat,
      });
      if (result?.b64_json) {
        selected.b64_json = result.b64_json;
        selected.revised_prompt = result.revised_prompt;
        selected.dataUrl = ThumbnailService.b64ToDataUrl(result.b64_json);
      }
      this.revisedPrompt = selected.revised_prompt || '';
      this.maskB64 = '';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
      setTimeout(() => this.initMaskCanvas(), 50);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Inpaint failed');
    }
  }
```

- [ ] **Step 5: Update `goSave` to pass presetKey + controls + completion timestamp**

Replace `goSave` (lines 547-568):

```js
  async goSave() {
    this.clearError();
    const selected = this.candidates[this.selectedIndex];
    if (!selected) {
      this.setError('Select a candidate first');
      return;
    }

    this.setLoading('Saving thumbnail…');

    try {
      const result = await this.thumbnailService.saveToStorage({
        imageB64: selected.b64_json,
        promptUsed: selected.revised_prompt || this.selectedPromptText(),
        presetKey: this.presetKey,
        controls: { ...this.controls },
      });
      this.savedImageUrl = result.imageUrl;
      this.savedPromptUsed = selected.revised_prompt || this.selectedPromptText();
      this.completedAt = result?.job?.completedAt || new Date().toISOString();
      this.revisedPrompt = selected.revised_prompt || '';
      this.step = 'saved';
      this.isGenerating = false;
      this.updateBody(this.renderBody());
      this.enableApplyButton();
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Save failed');
    }
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/TemplateThumbnailModal.jsx
git commit -m "feat(thumbnail): pass full controls + presetKey + reference image to all service calls"
```

---

### Task 14: Audit and manual smoke test

**Files:**
- No code changes; verification only.

- [ ] **Step 1: Syntax check all changed files**

```bash
node --check supabase/functions/ai-thumbnail-generator/index.ts 2>&1 || true
node --check src/lib/thumbnailService.js
node --check src/lib/thumbnailPresets.js
node --check src/lib/config/openaiConfig.js
node --check src/components/modals/TemplateThumbnailModal.jsx 2>&1 || true
```

Expected: no syntax errors. (`.tsx` and `.jsx` are checked by the build system; `--check` may not parse them — that's OK.)

- [ ] **Step 2: Verify the upsert `onConflict` now matches the partial index**

Open `supabase/functions/ai-thumbnail-generator/index.ts` and confirm line 97 reads `onConflict: "user_id, target_id"`. Open `supabase/migrations/20260708_template_thumbnail_extensions.sql` and confirm the partial index on lines 22-24 uses `(user_id, target_id)`. They match.

- [ ] **Step 3: Verify all Edge Function actions are wired**

Confirm each action handler in `index.ts`:
- `handlePrompts` (line ~173) — uses structured output + `store: true` + returns `response_id`
- `handleGenerate` (line ~224) — accepts quality/style/background/format/compression
- `handleRefine` (line ~265) — accepts tool options, `store`, `include`, reference image
- `handleInpaint` (line ~310) — accepts quality/style/background/format
- `handleSave` (line ~350) — calls `persistJob` with `status: 'completed'`

- [ ] **Step 4: Verify the modal sidebar renders**

Open `TemplateThumbnailModal.jsx` and confirm:
- `renderSidebar()` exists and is called from `renderBody()`
- The new CSS rules are appended to `THUMB_STYLES`
- The constructor initializes `this.preset`, `this.controls`, `this.referenceImage`
- The `open()` method calls `getPresetForTemplate` and `applyPresetToControls`

- [ ] **Step 5: Final commit (no changes expected)**

```bash
git status
```

Expected: working tree clean. If anything changed, commit it with `chore(thumbnail): audit pass`.

---

## Self-Review Notes

**Spec coverage:**
- Bug fix: Task 1 ✓
- `template_thumbnail_jobs`: Task 2, 9 ✓
- Quality / style / background / format / compression pickers: Task 3, 6, 7, 8, 11, 13 ✓
- Aspect-ratio override: Task 3, 6, 11, 13 ✓
- `partial_images` streaming: Task 3, 8, 13 (overlay in Task 12) ✓
- `store: true` + `include`: Task 5, 8, 13 ✓
- Structured JSON output for prompts: Task 5 ✓
- `revised_prompt` surfacing: Task 12, 13 ✓
- Reference-image input (b64/url/file_id) + `detail`: Task 8, 11, 13 ✓
- Typed output parsing (`output_text` + manual filter): Task 5, 8 ✓
- Thumbnail preset library / template types: Task 4, 11, 13 ✓
- Completed-templates persistence: Task 2, 9, 13 ✓
- Responses API tool options (`size`, `quality`, `background`, `action` via `auto`, `output_format`, `output_compression`, `partial_images`): Task 8 ✓
- `input_image_mask` on tool: deferred (we use the separate `inpaint` action; switching requires deeper edge-function rework — out of scope per current discussion)
- No model switcher: confirmed absent ✓
- No `input_fidelity`: confirmed absent (gpt-image-2 doesn't support it) ✓
- No `tool_choice` forcing: confirmed absent ✓

**Type / signature consistency:**
- `ThumbnailService.buildPromptVariants(brief, presetKey)` returns `{ variants, responseId }` — used in Task 13
- `ThumbnailService.generateCandidates(prompt, opts)` returns `{ candidates, params }` — used in Task 13
- `ThumbnailService.refineLastImage(opts)` returns the result object — used in Task 13
- `ThumbnailService.inpaint(opts)` returns the result object — used in Task 13
- `ThumbnailService.saveToStorage(opts)` returns `{ imageUrl, path, job }` — used in Task 13
- `applyPresetToBrief(preset, baseBrief)` — used in Task 11 and Task 4
- `applyPresetToControls(preset, currentControls)` — used in Task 11 and Task 4
- `getPresetForTemplate(template)` — used in Task 11
- `PRESET_LIST` — used in Task 11

No drift detected.
