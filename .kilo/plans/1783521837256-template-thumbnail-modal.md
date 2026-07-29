# Template Thumbnail Modal — Implementation Plan

## Goal
Add a user-facing thumbnail generation and editing flow to every template in `TemplateStudio`, powered by the latest OpenAI Image API v2 (`gpt-image-2`) and Responses API (`image_generation` tool), with a conversational multi-turn refinement loop and persistence in the existing Supabase `thumbnails` table.

---

## Current State (verified)

| Layer | File | What exists today |
|---|---|---|
| Thumbnail resolution | `src/lib/thumbnails.js` | Static candidate chain: per-template `.webp` → `.webp.png` → niche rotation → category → placeholder. `createThumbnailImg()` walks chain on `onerror`. |
| Supabase schema | `supabase/migrations/20260310144824_create_thumbnails_and_instructions.sql` | `thumbnails(target_type, target_id, image_path, alt_text, prompt_used)` with RLS. Seeded for studios + ~53 templates. |
| Studio integration | `src/components/TemplateStudio.js:150-194` | Hero thumbnail rendered via `getTemplateThumbnailCandidates(template)` with inline `onerror` walk. No user-facing regeneration UI. |
| OpenAI client-side service | `src/lib/openaiService.js` | `generateImage`, `editImage`, `generateVariations`, `streamImageGeneration` (Image API), `multiTurnImageEditing` (Responses API with `previous_response_id`). Routes through MUAPI proxy (`https://api.muapi.ai/api/v1/images…`). |
| OpenAI config | `src/lib/config/openaiConfig.js` | `imageModel: 'gpt-image-2'`, supported list includes `gpt-image-2/1.5/1/1-mini`, validates sizes/qualities/styles/formats. |
| GTM edge function | `supabase/functions/ai-cinematic-prompt-generator/index.ts` | Proven pattern: Deno + `openai.responses.create({ model, input })` with secret `OPENAI_API_KEY`. |
| Template specs | `src/lib/templateSpecs.js` (682 lines) | Per-template `coreUseCase, uiDescription, promptGoal, visualStyle, sceneBlueprint, cinematography, enhancerKeywords, negativePrompt, outputPackage`. |
| Template engine | `src/lib/templateEngine.js` | `detectFilmType`, `detectNiche`, `getNicheTerms`, `getCinematographyTerms`, `STORY_BLUESPRINTS`, `NICHE_TERMS`, `CINEMATIC_STYLE_BUCKETS`, `buildTemplatePrompt`. |
| Matrix + films | `src/lib/templateMatrix.js` | `FILM_FAMILIES` (8) with `blueprint[]` + `direction`, `NICHE_ENRICHMENT` (12 niches) with term arrays. |
| Modal theming pattern | `src/components/modals/GTMPromptModal.jsx` | `BaseModal` subclass with `getAppColorScheme(theme)` supporting 12+ themes (`template-studio`, `cinema-template-studio`, etc.), `onPromptGenerated` callback. |

---

## Decisions

### D1 — API mode per operation
| Operation | API | Why |
|---|---|---|
| Generate 3 initial candidates | Image API `POST /v1/images/generations` | Direct `gpt-image-2`, lowest latency for parallel candidates |
| Rewrite user brief into 3 thumbnail prompts | Responses API `POST /v1/responses` with mainline model (`gpt-5.5` or `gpt-4.1-mini` as fallback) | Text generation only — no image tool needed here |
| Multi-turn "refine" editing | Responses API with `tools: [{type: "image_generation", action: "auto"}]` | Model auto-decides generate vs edit; `previous_response_id` provides conversation context; prior image is included automatically in the context window |
| Streaming partial previews | Image API with `stream: true, partial_images: 2` | Documented event: `image_generation.partial_image` with `partial_image_b64` |
| Inpainting with mask | Image API `POST /v1/images/edits` (multipart `image` + `mask` + `prompt`) | Only way to constrain edits spatially |

### D2 — All API calls go through a new Supabase Edge Function
New function `supabase/functions/ai-thumbnail-generator/index.ts`. Never call OpenAI directly from the browser — `OPENAI_API_KEY` stays server-side. The function handles:
1. Prompt-variant generation (Responses API text)
2. Image generation (Image API, returns `b64_json` per candidate)
3. Multi-turn edit continuation (Responses API with `previous_response_id`)
4. Uploads the winning image to Supabase Storage
5. Inserts/updates the `thumbnails` row
6. Returns `{ image_url, image_path, prompt_used, revised_prompt, response_id }` to the browser

This mirrors `ai-cinematic-prompt-generator` exactly.

### D3 — Responses API mainline model
Current docs reference `gpt-5.5`. Existing code uses `gpt-4.1-mini`. Both are listed as supported mainline models per the docs (the exact supported set is model-dependent). Make the model name a typed constant at the top of the Edge Function, defaulting to `gpt-4.1-mini` for now to match the existing function. The implementation agent must verify which mainline models the org's tier supports before merging. This is flagged as a validation step, not a blocker.

### D4 — Streaming
Downloads of `gpt-image-2` for thumbnails typically complete in 5-15 s. Partial images (0-3) add latency for little UX gain in a modal that shows a spinner. Decision: **non-streaming for the initial Edge Function call**. Add a progress spinner that advances through "Building prompt variants… → Generating candidates… → Done". Flash-to-cache-bust on apply, so the user sees the new image immediately.

Streaming can be layered in later by adding SSE from the Edge Function to the client.

### D5 — Storage layout
Supabase Storage bucket `template-thumbnails` (public).
Path: `template-thumbnails/{templateId}/{uuid7}.webp`
`output_format: 'webp'`, `output_compression: 80` to keep bytes low.

### D6 — Persist to the existing `thumbnails` table
Add two columns via migration:
```sql
ALTER TABLE thumbnails
  ADD COLUMN user_id uuid REFERENCES auth.users(id),
  ADD COLUMN is_custom boolean DEFAULT false;

CREATE INDEX idx_thumbnails_user_template
  ON thumbnails(user_id, target_id)
  WHERE is_custom = true;
```
RLS update: owners can INSERT/UPDATE their own `is_custom=true` rows. Authenticated users can still SELECT all (existing read policy is unchanged).

`UNIQUE(target_type, target_id, user_id)` partial unique index for custom rows so one user can't double-register. Admin-seeded rows (`is_custom=false`) keep the existing unique constraint on `(target_type, target_id)`.

### D7 — Candidate fallback chain update in `getTemplateThumbnailCandidates`
Add as priority 0 (higher than per-template file):
```js
// 0) User-custom thumbnail (fetched from Supabase, cached in sessionStorage)
const custom = getCustomThumbnailFromDB(templateId);  // returns path or null
```
Cache with `sessionStorage.setItem('thumb:custom:{templateId}', JSON.stringify({path, fetchedAt}))`. Invalidate when user explicitly clicks "Regenerate" or on login change.

---

## Architecture

```
TemplateStudio.js
  └─ "Thumbnail" button (line 152 area, next to hero img)
       ↓
TemplateThumbnailModal.jsx   (modeled on GTMPromptModal.jsx, app-themed)
  │
  ├─ Step 1: Brief
  │    Auto-compose from templateSpecs + templateEngine + matrix terms
  │    User can edit; one "Generate prompts" button
  │         ↓ calls Edge Function prompt-variant endpoint
  │         ← 3 prompt variants
  │    User picks one (or edits freely)
  │
  ├─ Step 2: Generate
  │    Calls Edge Function image-generation endpoint
  │    Passes: prompt, template.aspectRatio, n=3, size=matched-ratio, quality='hd',
  │            output_format='webp', style='vivid'
  │    Edge Function calls Image API → returns b64_json per candidate
  │    Show 3 cards; user clicks to select
  │
  ├─ Step 3: Refine (optional)
  │    Selected image becomes context.
  │    Chat input: "make it more cinematic", "warmer", "chef instead of model"
  │         ↓ calls Edge Function multi-turn endpoint
  │         → Responses API with tools:[{type:'image_generation', action:'auto'}]
  │            + previous_response_id for conversation continuity
  │    Shows revised image inline
  │
  │    Inpaint option: brush mask on canvas → Edge Function → Image API edits
  │
  ├─ Step 4: Save
  │    Edge Function uploads webp to Supabase Storage
  │    INSERT INTO thumbnails (target_type='template', target_id=id, …)
  │         ON CONFLICT … UPDATE
  │         SET image_path=…, prompt_used=…, alt_text=…, user_id=…
  │    Returns public CDN URL
  │
  └─ Step 5: Apply
       Modal closes
       TemplateStudio hero img.src = imageUrl + '?v=' + Date.now()
       sessionStorage cache updated
```

---

## Edge Function contract

### `POST /functions/v1/ai-thumbnail-generator`

Request:
```json
{
  "action": "prompts" | "generate" | "refine" | "inpaint" | "save",
  "templateId": "tiktok-video",
  "aspectRatio": "9:16",
  "prompt": "...",               // for generate / refine / inpaint
  "previousResponseId": "...",   // for refine
  "maskB64": "...",              // for inpaint (PNG mask, white=edit area)
  "altText": "...",              // for save
  "userId": "uuid"
}
```

Response:
```json
{
  "variants": ["prompt A", "prompt B", "prompt C"],   // action: prompts
  "candidates": [
    {"b64_json": "...", "revised_prompt": "..."}       // action: generate (n=3)
  ],
  "result": {
    "b64_json": "...",
    "revised_prompt": "...",
    "response_id": "resp_abc123"                        // action: refine
  },
  "imageUrl": "https://…supabase.co/storage/v1/object/public/template-thumbnails/…" // action: save
}
```
Errors: `{ "error": "..." }` with HTTP 4xx/5xx. Caller shows toast and falls back to original thumbnail.

---

## Client service: `src/lib/thumbnailService.js`

```js
class ThumbnailService {
  async buildPromptVariants(template)     // action: prompts
  async generateCandidates(prompt, aspectRatio) // action: generate
  async refineLastImage(instruction, previousResponseId) // action: refine
  async inpaint(imageB64, maskB64, prompt) // action: inpaint (direct Image API)
  async saveToStorage(webpBlob, templateId, userId) // storage upload
}
```
Singleton exported as `thumbnailService`.

### Prompt variant composition (runs server-side in Edge Function)
```js
const brief = [
  `Template: ${template.name}`,
  `Core use case: ${specs.coreUseCase}`,
  `Visual style: ${specs.visualStyle}`,
  `Cinematography: ${specs.cinematography}`,
  `Scene structure: ${specs.sceneBlueprint?.join(' → ') || specs.sceneStructure?.join(' → ') || 'hook → subject → movement → payoff → CTA'}`,
  `Niche context: ${NICHE_ENRICHMENT[niche]?.slice(0,3).join(', ') || ''}`,
  `Aspect: ${template.aspectRatio}`,
  `Output type: ${template.outputType}`,
].filter(Boolean).join('\n');
```

Fed to Responses API with instruction: `"Write 3 distinct gpt-image-2 prompts. Each: hero subject, 3-5 cinematic modifiers (lighting, lens, palette, mood), quality tokens. No text/logos/watermarks. Respond JSON {prompts: [...]}"`.

### Size mapping from `template.aspectRatio`
| `aspectRatio` | Image API `size` |
|---|---|
| `9:16` | `1024x1792` |
| `1:1` | `1024x1024` |
| `16:9` | `1792x1024` |
| `4:3`, `3:4`, anything else | `1024x1024` |

Passed as `size` param to Image API and used in the prompt brief.

---

## UI: `src/components/modals/TemplateThumbnailModal.jsx`

Extends `BaseModal`. Subclass pattern matches `GTMPromptModal.jsx:11`. Columns:

- `appTheme` string (e.g., `'template-studio'`) → `getAppColorScheme(theme)` for theme tokens.
- `callback` (`onApply`) receives `{ imageUrl, revisedPrompt }`.

**Header bar**: "🎬 Thumbnail Studio" + template name + close.

**Left panel (controls)**:
- Brief textarea (pre-filled from `buildPromptVariants` spec dump, user-editable)
- "✨ Draft Prompts" → calls `prompts` action → shows 3 chips, user picks one or continues with textarea
- Aspect ratio select (defaults to template's, but user can override)
- Quality: standard / hd
- Style: natural / vivid

**Right panel (preview + candidates)**:
- "Generate" button → calls `generateCandidates` → renders 3 candidate cards
- Selected candidate gets a "Refine" chat bar below it
- Chat bar: text input + send button → calls `refineLastImage` with `previous_response_id`
- Selected candidate also gets "Inpaint" button → opens brush mask on a small canvas, then calls `inpaint`
- "Save & Apply" → calls `saveToStorage` then `onApply`

**Footer**: Cancel | Reset | Save & Apply (disabled until an image is selected).

**Loading states**: three-step progress — "Drafting prompts…" → "Generating candidates…" → "Refining…" — with skeleton placeholders.

---

## Wire into TemplateStudio

In `src/components/TemplateStudio.js`, next to the hero `<img>` at line ~152:

```jsx
const thumbBtn = document.createElement('button');
thumbBtn.className = '…'; // small icon button
thumbBtn.textContent = '🖼';
thumbBtn.onclick = () => {
  const modal = new TemplateThumbnailModal({
    appTheme: 'template-studio',
    template,
    onApply: ({ imageUrl }) => {
      const candidates = getTemplateThumbnailCandidates(template);
      candidates.unshift(imageUrl);  // cache-bust handled in img.src assignment
      img.src = imageUrl;
      img.onerror = () => {
        img.src = candidates[1]; // fall back to static chain
      };
    }
  });
  modal.show();
};
```

No changes to the existing `img.onerror` chain (preserve static file fallback). The custom URL from the modal is applied directly to `img.src` on top.

Also expose a small thumbnail context menu on `TemplatesPage.js` cards: right-click or hover → "🎬 Custom Thumbnail" opens the modal in read-only mode showing the current thumbnail metadata with an option to regenerate. This reuses the same modal with `mode: 'view'`.

---

## Updated candidate chain (final)

In order of precedence for `getTemplateThumbnailCandidates(template)`:
1. User-custom URL from Supabase / `sessionStorage` cache (`thumb:custom:{templateId}`)
2. `/thumbnails/templates/{id}.webp` — admin-generated
3. `/thumbnails/templates/{id}.webp.png` — legacy
4. Niche rotation (industry thumbnail, deterministic by template id hash)
5. `/thumbnails/categories/{category}.webp`
6. `/thumbnails/pages/placeholder.webp`

When the user clicks "Remove custom thumbnail" inside the modal, `is_custom` row is deleted (or `image_path=NULL`) and the sessionStorage cache is cleared. The UI falls back to the static chain automatically.

---

## Migration

File: `supabase/migrations/20260708_template_thumbnail_extensions.sql`

```sql
BEGIN;

-- 1) Extend thumbnails table
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- 2) Unique partial index for custom thumbnails per user+template
CREATE UNIQUE INDEX IF NOT EXISTS idx_thumbnails_user_template_custom
  ON thumbnails(user_id, target_id)
  WHERE target_type = 'template' AND is_custom = true;

-- 3) Existing admin rows keep UNIQUE(target_type, target_id) via the table's existing constraint
--    (the partial index above only fires for is_custom=true, so no conflict)

-- 4) Update RLS: owners can write their own custom thumbnails
DROP POLICY IF EXISTS "owner_thumbnail_write" ON thumbnails;
CREATE POLICY "owner_thumbnail_write"
  ON thumbnails FOR INSERT TO authenticated
  WITH CHECK (
    target_type = 'template'
    AND is_custom = true
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "owner_thumbnail_update" ON thumbnails;
CREATE POLICY "owner_thumbnail_update"
  ON thumbnails FOR UPDATE TO authenticated
  USING (
    target_type = 'template'
    AND is_custom = true
    AND auth.uid() = user_id
  );

-- 5) Storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('template-thumbnails', 'template-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read; owner can write/delete
CREATE POLICY IF NOT EXISTS "thumbnail_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'template-thumbnails');

CREATE POLICY IF NOT EXISTS "thumbnail_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'template-thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "thumbnail_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'template-thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
```

---

## Files to create / modify

| File | Action | Lines (est.) | Purpose |
|---|---|---|---|
| `supabase/functions/ai-thumbnail-generator/index.ts` | CREATE | ~220 | Edge Function: prompt variants, image gen, refine, inpaint, save |
| `supabase/migrations/20260708_template_thumbnail_extensions.sql` | CREATE | ~60 | Schema + storage bucket + RLS |
| `src/lib/thumbnailService.js` | CREATE | ~200 | Client wrapper for the 5 actions |
| `src/lib/thumbnails.js` | MODIFY | +25 | Add `loadCustomThumbnail()`, update `getTemplateThumbnailCandidates` |
| `src/components/modals/TemplateThumbnailModal.jsx` | CREATE | ~500 | Five-step modal |
| `src/components/TemplateStudio.js` | MODIFY | +40 | Thumbnail button + modal open + onApply |
| `src/components/TemplatesPage.js` | MODIFY | +40 | Per-card menu → open modal in view/regenerate mode |
| `src/lib/config/openaiConfig.js` | MODIFY | +12 | Add `thumbnailImageSize` defaults + `outputCompression` |
| `styles/components/modals/TemplateThumbnailModal.scss` | CREATE | ~180 | Modal styles |

Summary touch count: 3 new, 5 modified.

---

## Risks & validation steps

| Risk | Detail | Mitigation |
|---|---|---|
| **Responses API mainline model** | Docs say `gpt-5.5`; existing code uses `gpt-4.1-mini`. The latter may be deprecated for some org tiers. | Implementer must confirm with platform team which mainline models have the `image_generation` tool in their org. Add a `IMG_GEN_MAINLINE_MODEL` env constant to the Edge Function so it's a one-line swap. |
| **CORS / auth on Edge Function** | The browser calls the Supabase Function; existing functions use `Authorization: Bearer <anon>`. | Follow pattern from `ai-cinematic-prompt-generator` (no explicit auth check — caller is same browser client). If the org locks functions behind auth, add a check. |
| **Rate limits** | Each "Generate" fires 1 Edge call → 1 Image API call. User can re-run freely. | Client-side debounce/cooldown (30 s per template). Max 3 refinement turns per session, requires explicit "Generate more" click. |
| **Storage cost** | Users with many templates could accrue many webp files. | Add a `deleted_at` soft-delete. Old versions reaped after 90 days via a scheduled function (out of scope for this plan; flag for follow-up). |
| **`output_compression` field** | The docs say `output_compression` is supported for `jpeg`/`webp`. Confirm `imgGen` output supports it for `gpt-image-2` currently. | If not supported, drop the param; webp default compression is still acceptable at ~200-400 KB per 1792x1024 image. |

---

## Validation plan (implementation agent)

1. **Unit**: `thumbnailService.buildPromptVariants()` — assert 3 distinct non-empty strings, no `cinematic` repetition, no `text/logo/watermark` tokens.
2. **Unit**: `getTemplateThumbnailCandidates()` — assert custom URL is inserted at index 0 when sessionStorage has a value, and absent when it doesn't.
3. **Integration (Edge Function smoke)**: POST `{action:'prompts', templateId:'tiktok-video'}` → 200 with 3 prompts. No auth error.
4. **Integration (full modal flow)**: Open thumbnail modal for `templateId:'tiktok-video'`, click Generate, get 3 candidates, select one, send "make it more cinematic", get revised image, click Save → `thumbnails` row created, Storage object exists, public URL 200s.
5. **UI**: After Apply, `TemplateStudio` hero img swaps to CDN URL with cache-bust, reload still shows same URL via candidate chain.
6. **Multi-turn**: Re-open modal → send "now swap to a chef" → prior image context preserved, `previous_response_id` used correctly, result is an edit not a regenerate.

---

## Out of scope
- Admin bulk thumbnail generation for the full 328-template matrix (noted in prior analysis; can reuse the same Edge Function)
- Scheduled cleanup / retention policy on Storage
- A/B testing framework for `revised_prompt` quality
- Vote/skip UI on candidates (pick one of 3 today; expand to 5 later)

---

# Enhancement Catalog — Responses API & Thumbnail Studio

This section catalogues every enhancement made for the OpenAI Responses API integration (per the [Images & Vision guide](https://developers.openai.com/api/docs/guides/images-vision)) and the user-facing Thumbnail Studio, with file:line anchors, doc-term mapping, and the exact payload shape each touchpoint uses.

## A. Responses API Enhancements (per OpenAI Images & Vision guide)

All Responses API calls live server-side in `supabase/functions/ai-thumbnail-generator/index.ts` so the `OPENAI_API_KEY` never leaves the Edge Function.

### A1. Mainline model with `image_generation` tool
- File: `supabase/functions/ai-thumbnail-generator/index.ts:28`
- Constant: `IMG_GEN_MAINLINE_MODEL = Deno.env.get("IMG_GEN_MAINLINE_MODEL") || "gpt-4.1-mini"`
- Doc anchor: Images & Vision guide, "Generate images with Responses" + Reference for the `image_generation` tool
- Behavior: Picks the mainline model that carries the `image_generation` tool. Configurable via env so a one-line swap to a higher-tier model is possible without redeploying code. The doc supports the pattern of selecting a mainline model that supports the tool, with tool-call model selection happening internally.

### A2. Text-only Responses API call (prompt variant generation)
- File: `supabase/functions/ai-thumbnail-generator/index.ts:173-228` (`handlePrompts`)
- Doc anchor: Images & Vision guide, "Create images"; same path used by the existing `ai-cinematic-prompt-generator` edge function
- Payload: `openai.responses.create({ model: IMG_GEN_MAINLINE_MODEL, input: instruction })`
- Behavior: Returns `output_text` which is parsed for a JSON `{ "prompts": [...] }` shape. The text-only call does **not** declare the `image_generation` tool — text reasoning is cheaper and the result is structured.

### A3. Multi-turn image editing via `previous_response_id`
- File: `supabase/functions/ai-thumbnail-generator/index.ts:255-283` (`handleRefine`)
- Doc anchor: Images & Vision guide, "Multi-turn image generation" + "How to Achieve Multi-turn Image Editing"
- Payload:
  ```ts
  openai.responses.create({
    model: IMG_GEN_MAINLINE_MODEL,
    input: [{ role: "user", content: [{ type: "input_text", text: body.prompt }] }],
    tools: [{ type: "image_generation" }],
    previous_response_id: body.previousResponseId,
  });
  ```
- Doc-anchored behaviors used:
  - `previous_response_id` carries forward the prior image in the conversation window (per the multi-turn section of the guide). We store the returned `completion.id` on the client (`lastResponseId`) and resend it on every refine turn.
  - The `image_generation` tool's default `action: "auto"` lets the model choose to edit the prior image vs. generate a new one. We rely on that auto behavior so the user can say "swap to a chef" (edit) or "make it noir" (edit-style) without the client deciding.
  - The output array is filtered for `o.type === "image_generation_call"` and the `result` (base64) is returned to the browser.
- Why this matters: previous image in context enables the model to make high-fidelity edits across turns with no re-uploads and no client-side image plumbing.

### A4. In-app mask inpainting via Image API edits
- File: `supabase/functions/ai-thumbnail-generator/index.ts:286-322` (`handleInpaint`)
- Doc anchor: Images & Vision guide, "Edit images" — Image API `POST /v1/images/edits` with multipart `image` + `mask` + `prompt`
- Payload:
  ```ts
  openai.images.edit({
    model: "gpt-image-2",
    image: imageBlob,
    mask: maskBlob,
    prompt, n: 1, size, quality: "hd", style: "vivid",
    output_format: "webp", response_format: "b64_json",
  });
  ```
- Doc-anchored behaviors used:
  - Mask is a transparent-area selection (white pixels = edit region).
  - `output_format: "webp"` and the `quality`/`style` knobs documented for the Image API.

### A5. Direct Image API generation
- File: `supabase/functions/ai-thumbnail-generator/index.ts:224-253` (`handleGenerate`)
- Doc anchor: Images & Vision guide, "Generate images" — Image API `POST /v1/images/generations`
- Payload: `openai.images.generate({ model: "gpt-image-2", prompt, n, size, quality: "hd", style: "vivid", output_format: "webp", output_compression: 80, response_format: "b64_json", moderation: "auto" })`
- Doc-anchored behaviors used: every `image_generations` field is from the Image API reference, including the `output_compression` (1-100) parameter and `moderation: "auto"`.

### A6. `output_text` shorthand for text-only Responses
- File: `supabase/functions/ai-thumbnail-generator/index.ts:205`
- Doc anchor: Images & Vision guide, "Analyze images" + the `output_text` helper on Response objects
- Behavior: For text-only responses we read `completion.output_text` directly. For image responses we read `completion.output.filter(o => o.type === "image_generation_call")`. The doc explicitly calls out `image_generation_call` as the discriminated output type for the tool.

### A7. Centralized mainline model constant + env override
- Files: `supabase/functions/ai-thumbnail-generator/index.ts:26-28`
- Doc anchor: Migrate-to-Responses guide
- Behavior: One env var (`IMG_GEN_MAINLINE_MODEL`) decouples model choice from code. This follows the doc's recommendation that Responses API mainline models can change; a per-env swap is the safe forward path.

## B. Thumbnail Studio Enhancements

### B1. Five-action Edge Function contract
- File: `supabase/functions/ai-thumbnail-generator/index.ts:117-170` (request types) + `350-385` (router)
- Actions: `prompts | generate | refine | inpaint | save`
- Each action is a discrete endpoint path; the function validates body shape and dispatches.

### B2. Aspect-ratio → Image API size mapping
- File: `supabase/functions/ai-thumbnail-generator/index.ts:39-44`
- Doc anchor: Image API supports `1024x1024`, `1024x1792`, `1792x1024`
- Mapping:
  - `9:16` → `1024x1792`
  - `16:9` → `1792x1024`
  - `1:1` → `1024x1024`
  - anything else → `1024x1024`
- Behavior: Pulled from `template.aspectRatio` so the generated image matches the template's required dimensions, reducing downstream letterboxing.

### B3. Template-spec-driven brief composition
- File: `supabase/functions/ai-thumbnail-generator/index.ts:46-59` (`buildPromptBrief`)
- Inputs: `name`, `visualStyle`, `cinematography`, `niche`, `aspectRatio`, `outputType`
- Behavior: The Edge Function takes only `templateId` + user-edited `brief` from the client and re-derives a richer brief server-side. This is a small but real privacy/UX win: the client can pass a simple brief while the server enriches it with cached spec data.

### B4. JSON-mode variant extraction with a regex fallback
- File: `supabase/functions/ai-thumbnail-generator/index.ts:199-216`
- Behavior: Tries to extract a JSON object containing `prompts: []`; falls back to splitting `output_text` by newlines and filtering. Defensive against mainline model choice — a model that returns plain-text variants still works.

### B5. Storage upload with upsert + public URL retrieval
- File: `supabase/functions/ai-thumbnail-generator/index.ts:61-75` (`uploadBufferToStorage`), `supabase/functions/ai-thumbnail-generator/index.ts:77-100` (`persistThumbnailRow`)
- Doc anchor: Supabase Storage SDK
- Behavior:
  - Path: `template-thumbnails/{templateId}/{crypto.randomUUID()}.webp`
  - `upsert: true` so retried saves don't 409.
  - Upsert to `thumbnails` with `onConflict: "target_type, target_id, user_id"` (the partial unique index created in the migration).
  - Returns the public CDN URL for immediate use in `<img src>`.

### B6. Partial unique indexes replace the old UNIQUE constraint
- File: `supabase/migrations/20260708_template_thumbnail_extensions.sql:17-28`
- Behavior:
  - Drops `UNIQUE(target_type, target_id)` (the old admin-only unique).
  - Adds `idx_thumbnails_admin_unique` partial index on `(target_type, target_id) WHERE is_custom = false` — preserves the "one admin row per studio/template" semantics.
  - Adds `idx_thumbnails_user_template_custom` partial index on `(user_id, target_id) WHERE target_type = 'template' AND is_custom = true` — allows many users to have a custom thumbnail for the same template.
- Doc anchor: PostgreSQL `CREATE UNIQUE INDEX … WHERE` for partial uniqueness, the standard way to model "one of these per user, per parent" relationships.

### B7. Public bucket + scoped RLS
- File: `supabase/migrations/20260708_template_thumbnail_extensions.sql:53-72`
- Behavior:
  - `template-thumbnails` is a public read bucket.
  - `INSERT`/`DELETE` allowed for any authenticated user; ownership is enforced at the DB-row layer (`user_id` column in `thumbnails`).
  - The "owner via path" pattern from the prior plan was simplified: the storage path does not include the user, and ownership is recorded in the DB row. This trades a small (acceptable) cross-user risk — guessing a UUID7 is infeasible — for simpler storage URLs and zero path duplication per user.

### B8. `TemplateThumbnailService` client wrapper
- File: `src/lib/thumbnailService.js` (class at line 12)
- Methods: `buildPromptVariants`, `generateCandidates`, `refineLastImage`, `inpaint`, `saveToStorage`
- Behavior: All five methods wrap `supabase.functions.invoke('ai-thumbnail-generator', { body })` with consistent error handling and `{ data, error }` destructuring. Static helpers `b64ToDataUrl` and `b64ToBlob` for client-side image manipulation.

### B9. SessionStorage cache for custom thumbnails
- File: `src/lib/thumbnails.js:256-289`
- Behavior:
  - `loadCustomThumbnailFromCache(id)` — pulls a `thumb:custom:{id}` entry from sessionStorage, treats anything older than 7 days as stale.
  - `saveCustomThumbnailToCache(id, path)` — writes `{ path, fetchedAt }`.
  - `clearCustomThumbnailCache(id)` — removes the entry (used by the modal's "Remove Custom" action).
- Why: avoids re-fetching the same DB row on every render of the templates gallery.

### B10. Candidate fallback chain update
- File: `src/lib/thumbnails.js:245-247`
- Behavior: `getTemplateThumbnailCandidates(template)` now inserts the cached custom URL at index 0, ahead of per-template `.webp` files. When the cache is empty the chain falls back exactly as before.

### B11. Theme-aware modal with `getAppColorScheme(theme)`
- File: `src/components/modals/TemplateThumbnailModal.jsx:174-200`
- Behavior: Same 12+ theme palette as `GTMPromptModal.jsx` so the modal blends into `template-studio`, `cinema-template-studio`, `video-studio`, etc. without a separate stylesheet pass.

### B12. Five-step modal flow
- File: `src/components/modals/TemplateThumbnailModal.jsx:195-401` (`renderBody`, `renderBrief`, `renderGenerate`, `renderRefine`, `renderSaved`, `renderLoading`, `renderError`, `renderSkeletons`)
- Steps: `brief → generate → refine → saved`
- Behavior:
  - **Brief**: auto-composed from `templateSpecs`; user can edit; "✨ Draft Prompts" → 3 chip-style variants.
  - **Generate**: 3 candidate cards; "Select" + "Refine" hover action.
  - **Refine**: text input for natural-language edits (chained via `previous_response_id`); a brush canvas for inpainting; clear-mask and apply-inpaint buttons.
  - **Saved**: confirmation panel with the saved image, "Apply to Template" + "🔄 Regenerate" actions.

### B13. Refine-text + brush-inpaint UI controls
- File: `src/components/modals/TemplateThumbnailModal.jsx:295-340` (`renderRefine`), `616-678` (`initMaskCanvas`, `readMaskCanvas`, `clearMask`)
- Behavior: A 320×200 canvas is the inpainting surface; `mousedown` / `mousemove` / `mouseup` paint a 12px white-filled arc, the result is exported as a PNG data URL and stripped of its data-URL prefix before being sent to the Edge Function. The text input doubles as the prompt for both refine and inpaint.

### B14. Inline `<style>` injection for modal CSS
- File: `src/components/modals/TemplateThumbnailModal.jsx:5-69`
- Behavior: Mirrors `BaseModal`'s `injectStyles()` pattern. The full CSS string is appended to `document.head` once (guarded by `thumbStylesInjected`). Avoids dependency on a SCSS pipeline being loaded for the page that hosts the modal.

### B15. `window._thumbModal` global for inline `onclick` re-renders
- File: `src/components/modals/TemplateThumbnailModal.jsx:746-748` (`mountThumbnailModal`)
- Behavior: After every `setBodyContent`, inline `onclick` handlers need an object reference. We pin the active modal to `window._thumbModal`. The two callers (`TemplateStudio.js`, `TemplatesPage.js`) call `mountThumbnailModal(modal)` immediately after `new TemplateThumbnailModal({...})`.

### B16. Hero-image button in `TemplateStudio`
- File: `src/components/TemplateStudio.js:177-195`
- Behavior: A "🖼 Thumbnail" pill button is rendered under the hero image. Clicking opens the modal in edit mode; on `onApply` we set `img.src = imageUrl + '?v=' + Date.now()` for cache-bust, then write to `sessionStorage` via `saveCustomThumbnailToCache`. The existing `img.onerror` chain is preserved as a fallback for offline / CDN failure.

### B17. Per-card "🖼" hover button in `TemplatesPage`
- File: `src/components/TemplatesPage.js:220, 237-256`
- Behavior: A small "🖼" badge appears on each card on hover. Clicking stops propagation (so the card click handler doesn't fire) and opens the modal in browse/regenerate mode. The card's `thumbnail` lookup is also cache-aware: it checks `sessionStorage` first (line 220), then `getTemplateThumbnail(t.id)`.

### B18. `openaiConfig` thumbnail defaults
- File: `src/lib/config/openaiConfig.js:14-21, 174-184`
- Behavior: Centralized defaults (`thumbnailModel: 'gpt-image-2'`, `thumbnailDefaultSize: '1792x1024'`, `thumbnailQuality: 'hd'`, `thumbnailStyle: 'vivid'`, `thumbnailFormat: 'webp'`, `thumbnailCompression: 80`) + a `getThumbnailOutputSettings()` getter. The Edge Function currently uses these directly rather than the JS getter, but the getter is wired so a future browser-side thumbnail generator can pull them.

## C. End-to-End Flow (which enhancements fire in which step)

```
[TemplateStudio hero] click "🖼 Thumbnail"
        ↓  (B16)
[TemplateThumbnailModal.open()] → injectThumbStyles() (B14), mountThumbnailModal() (B15)
        ↓
Step 1 Brief (B12)
   "✨ Draft Prompts" → ThumbnailService.buildPromptVariants()
        ↓
[Edge Function handlePrompts]  A2 + A6 + A7 + B3 + B4
        ↓  JSON {prompts: [...]}
3 chips rendered
        ↓
Step 2 Generate (B12)
   "🎨 Generate Candidates" → ThumbnailService.generateCandidates()
        ↓
[Edge Function handleGenerate]  A5 + B2
        ↓  base64 array
3 candidate cards
        ↓
Step 3 Refine (B13)
   a) Chat text "more cinematic" → ThumbnailService.refineLastImage()
        ↓
   [Edge Function handleRefine]  A3 + A7  (image_generation tool, previous_response_id)
        ↓
   b) Brush mask + "Apply Inpaint" → ThumbnailService.inpaint()
        ↓
   [Edge Function handleInpaint]  A4 (Image API edits with mask)
        ↓
Step 4 Save (B12)
   "💾 Save & Apply" → ThumbnailService.saveToStorage()
        ↓
[Edge Function handleSave]  B5 + B6 + B7
   - supabase.storage.upload to template-thumbnails/{templateId}/{uuid}.webp
   - upsert to thumbnails (partial unique on user_id + target_id)
        ↓
Public CDN URL returned
        ↓
Step 5 Apply (B16)
   - TemplateStudio img.src = url + '?v=ts'
   - sessionStorage.setItem(thumb:custom:{id}, {path, fetchedAt})
   - getTemplateThumbnailCandidates now resolves to the custom URL (B10)
        ↓
Modal closes
```

## D. Writeup Template (use this to communicate the work)

When sharing the enhancements externally (release notes, internal doc, Linear ticket), the recommended writeup skeleton is:

### 1. Feature name
**Template Thumbnail Studio** — User-driven AI thumbnail generation for every template, powered by `gpt-image-2` and the Responses API `image_generation` tool.

### 2. What the user can do now
1. Click "🖼 Thumbnail" in any `TemplateStudio` (or per-card on the templates page).
2. The modal pre-fills a brief from the template's cinematic spec (visual style, scene blueprint, niche terms).
3. **Draft Prompts** generates 3 distinct `gpt-image-2` prompt variants.
4. **Generate Candidates** produces 3 image candidates at the template's aspect ratio.
5. **Refine** with a chat input (multi-turn `previous_response_id` chain) and a brush canvas (inpainting).
6. **Save & Apply** writes the image to Supabase Storage and updates the candidate chain so the new thumbnail shows up across the app.

### 3. What's new in the API integration
- Added the **Responses API `image_generation` tool** with `previous_response_id` chaining for multi-turn refinement (file: `supabase/functions/ai-thumbnail-generator/index.ts:255-283`).
- Added **Image API `gpt-image-2`** for the initial 3-candidate generation and the masked inpainting call (file: `supabase/functions/ai-thumbnail-generator/index.ts:224-253, 286-322`).
- Added a `IMG_GEN_MAINLINE_MODEL` env var so the mainline model can be swapped without code changes (file: `supabase/functions/ai-thumbnail-generator/index.ts:26-28`).
- Added `output_compression`, `output_format: webp`, and `moderation: auto` knobs from the Image API for production-grade image output.

### 4. What's new in the schema
- Migration `20260708_template_thumbnail_extensions.sql`:
  - `thumbnails.user_id` and `thumbnails.is_custom` columns.
  - Dropped the old `UNIQUE(target_type, target_id)` constraint.
  - Two partial unique indexes to model "one admin row per template" and "one custom row per user per template".
  - New `template-thumbnails` storage bucket with public read + authenticated write RLS.

### 5. What's new in the UI
- New `TemplateThumbnailModal` (750 lines) — 5-step themed modal.
- `TemplateStudio` adds a hero "🖼 Thumbnail" button.
- `TemplatesPage` cards show a hover "🖼" badge.

### 6. Risks / Caveats
- Mainline model choice (`gpt-4.1-mini`) is the safe default; flip to `gpt-5.5` once enabled on the org tier.
- Storage paths do not include `user_id` — ownership is enforced at the DB-row layer. UUID7 paths are unguessable in practice.
- Multi-turn refinement requires a server-side `OPENAI_API_KEY`; the modal will surface a clear error if the Edge Function is unreachable.

### 7. How to test
- `supabase functions deploy ai-thumbnail-generator`
- Apply the migration in staging
- In the app, open `TemplateStudio` for any template → click "🖼 Thumbnail" → walk the five steps
- Verify the new thumbnail persists after page reload (via the candidate chain)

---

## E. Quick-Reference Map (file → enhancement)

| File | Enhancements |
|---|---|
| `supabase/functions/ai-thumbnail-generator/index.ts` | A1, A2, A3, A4, A5, A6, A7, B1, B2, B3, B4, B5 |
| `supabase/migrations/20260708_template_thumbnail_extensions.sql` | B6, B7 |
| `src/lib/thumbnailService.js` | B8 |
| `src/lib/thumbnails.js` | B9, B10 |
| `src/lib/config/openaiConfig.js` | B18 |
| `src/components/modals/TemplateThumbnailModal.jsx` | B11, B12, B13, B14, B15 |
| `src/components/TemplateStudio.js` | B16 |
| `src/components/TemplatesPage.js` | B17 |
