# Personalization Source Audit — OpenHiggsBolt → remix-new-editor

**Generated:** 2026-10-12
**Generator:** SA-2 (OpenHiggsBolt Forensics Specialist, read-only).
**Source code paths verified via direct file read and grep; no installs/builds.**

## 1. Executive Summary

The authoritative, most-complete OpenHiggsBolt personalization implementation lives at:

- **Source dir:** `/Users/shasheemoore/Downloads/oldhiggsfieldbolt/OpenHiggsBolt`
- **Branch:** `main` (HEAD `3d041d3b` "fix: remove scope violations from Task 5")
- **Personalization code location:** `src/shared/personalization/` (12 files, ~4.8K LOC) + `app/api/personalization/record/route.ts` + `app/api/proxy/openai-{enhance,image}/route.ts` + `supabase/migrations/20260905000000_create_personalization_outputs.sql` + `packages/studio/src/muapi.js` (3K+ LOC) + `packages/studio/src/models.js` (10K+ LOC) + tests in `src/shared/personalization/__tests__/` (4 vitest files, 1480 LOC) + `e2e/personalization-*.spec.ts` (3 Playwright files) + `tests/crossStudio.test.ts`.

The other 4 candidate source dirs were evaluated and rejected:

| Rank | Dir | Why rejected |
|---|---|---|
| 1 | `~/Downloads/oldhiggsfieldbolt/OpenHiggsBolt` | **CHOSEN** — feature surface matches the 8-area spec exactly. |
| 2 | `~/Downloads/Higgsfield` (`codex/build-videoremix-personalized-video-platform` @ `f59a2bfd`) | Wrong shape — public-profile-scan cold-email pipeline using Maigret+GitHub OSINT; no asset library of spec shape. |
| 3 | `~/Downloads/Open-Higgsfield-AI` (same branch) | Same as #2, fewer files. |
| 4 | `~/Downloads/oldhiggsfieldbolt/Open-Generative-AI` | Zero personalization files. |
| 5 | `~/Downloads/Higgsfield-Migration-Lab` | Empty repo, no commits. |

## 2. Completeness Per Area (8 areas)

| Area | Status | Detail |
|---|---|---|
| 1. Profiles (Who-Is-This-For, Client Profile, persistent preferences) | **COMPLETE** | `ClientProfile` interface (`types.ts:48-64`) + localStorage CRUD (`clientProfile.ts`) + UI in `PersonalizationModal.tsx:1122,1145` + React Context provider `DemoPersonalizeProvider.tsx`. |
| 2. Asset library (face/body/side, logos, products, brand, first/last frame, audio, drag-drop, primary, remove) | **COMPLETE** | `AssetLibrary` interface (`types.ts:85-97`) covers all 12 `AssetRole` values; `PersonalizationModal.tsx` has section headings + `UploadZone` components at lines 1216, 1259, 1305, 1338, 1371, 1408; primary setters + remove at `DemoPersonalizeProvider.tsx:613,625,651,663,685,710`. Native HTML5 drag-drop, not dnd-kit. |
| 3. Website asset discovery (sitemap / Crawlee / Cheerio / headless / SSRF / private-IP / DNS rebinding / dup / social-domain / junk / async job+status) | **MISSING** | No `cheerio`/`crawlee`/`sitemap`/`robots.txt` hits anywhere. Only direct URL + file upload. **Requires greenfield implementation in remix-new-editor.** |
| 4. AI Assist (image editing for Person/Logo/Product/Brand/FirstFrame/LastFrame via OpenAI) | **COMPLETE** | Default I2I model: `gpt-image-2-edit` (endpoint `gpt-image-2-image-to-image`, provider `openai`). Router: `src/shared/personalization/generationRouter.ts:113-165`. Image-edit client: `src/shared/api/openaiImage.ts:22` supports `gpt-image-2`/`gpt-image-1`/`gpt-image-1.5`/`gpt-image-1-mini`/`dall-e-3`/`dall-e-2`. Direct proxy: `app/api/proxy/openai-image/route.ts` (`POST /v1/images/{edits|generations}`). |
| 5. Upload + media persistence (MuAPI + Supabase, temp vs permanent) | **COMPLETE** | MuAPI `uploadFile` XHR (`packages/studio/src/muapi.js:317` with `x-api-key` header, 300s timeout). Supabase bucket `brand-assets` (`src/lib/supabase.ts:62`, `src/lib/assetGenerator.ts:173`). External URLs are mirrored server-side via `mirrorUrlToStorage`. Personalization outputs persisted to `personalization_outputs` table with RLS via `app.clerk_user_id` setting. |
| 6. Dependencies (relevant subset) | **PARTIAL** | `@clerk/nextjs ^7.5.13`, `@supabase/supabase-js ^2.108.2`, `openai ^6.44.0` present; `playwright` for e2e; **MISSING** zustand (uses React Context), cheerio/crawlee (no discovery), dnd-kit (uses native HTML5). |
| 7. Tests (vitest unit + Playwright e2e) | **COMPLETE** | 4 vitest files (1480 LOC): `DemoPersonalizeProvider.test.tsx`, `PersonalizationModal.test.tsx`, `modelCapabilityResolver.test.ts`, `postProcessor.test.ts`. 3 Playwright files: `personalization-demo.spec.ts`, `personalization-debug.spec.ts`, `personalization-live.spec.ts`. Plus `tests/crossStudio.test.ts` (280 LOC) for cross-studio handoff. |
| 8. Auth architecture (Clerk + Supabase RLS via `set_config`) | **COMPLETE** | Clerk `auth()` in API routes. `app/api/personalization/record/route.ts` calls `supabase.rpc('set_config', { setting: 'app.clerk_user_id', value: userId, is_local: true })` to inject Clerk userId into Supabase session for RLS check `clerk_user_id = current_setting('app.clerk_user_id', true)`. |

## 3. Schemas (verbatim from source)

### 3.1 `ClientProfile` (TypeScript)
```ts
// src/shared/personalization/types.ts:48
export interface ClientProfile {
  id: string
  audience: 'me' | 'my-business' | 'customer'
  name: string
  businessName: string
  industry: string
  location: string
  productService: string
  offer: string
  ctaHeadline: string
  callToAction: string
  phone: string
  website: string
  brandDescription: string
  createdAt: string
  updatedAt: string
}
```

### 3.2 `AssetLibrary` (TypeScript)
```ts
// src/shared/personalization/types.ts:85
export interface AssetLibrary {
  identities: PersonalizationAsset[]
  primaryIdentity: PersonalizationAsset | null
  logos: PersonalizationAsset[]
  primaryLogo: PersonalizationAsset | null
  products: PersonalizationAsset[]
  brandReferences: PersonalizationAsset[]
  firstFrame: PersonalizationAsset | null
  lastFrame: PersonalizationAsset | null
  ctaGraphic: PersonalizationAsset | null
  audio: PersonalizationAsset[]
  savedReferences: PersonalizationAsset[]
}
```

### 3.3 `PersonalizationAsset` (TypeScript)
```ts
// src/shared/personalization/types.ts:67
export interface PersonalizationAsset {
  id: string
  role: AssetRole
  name: string
  url: string
  uploadedUrl?: string
  isPrimary: boolean
  // + metadata fields
  file?: File | null
}
```

### 3.4 SQL DDL — `personalization_outputs` table
```sql
-- supabase/migrations/20260905000000_create_personalization_outputs.sql
create table if not exists public.personalization_outputs (
  id text primary key default gen_random_uuid()::text,
  clerk_user_id text not null,
  origin_studio text not null default 'demo-personalization',
  source_type text not null,
  source_demo_id text,
  source_demo_slug text,
  viral_record_id text,
  source_media text,
  source_url text,
  personalization_mode text,
  model text,
  original_prompt text not null,
  personalized_prompt text not null,
  identity_asset_ids text[] not null default '{}',
  logo_asset_ids text[] not null default '{}',
  product_asset_ids text[] not null default '{}',
  brand_reference_asset_ids text[] not null default '{}',
  first_frame_asset_id text,
  last_frame_asset_id text,
  output_urls text[] not null default '{}',
  output_type text not null,
  client_id text,
  created_at timestamptz not null default now()
);
create index ... on public.personalization_outputs(clerk_user_id);
create index ... on public.personalization_outputs(created_at desc);
alter table public.personalization_outputs enable row level security;
create policy "Users can view own personalization outputs"
  ... using (clerk_user_id = current_setting('app.clerk_user_id', true));
create policy "Users can insert own personalization outputs"
  ... with check (clerk_user_id = current_setting('app.clerk_user_id', true));
```

## 4. API Contracts (verbatim from source)

### 4.1 `POST /api/personalization/record`
- **Auth:** Clerk `auth()` — returns 401 if no userId.
- **Body:** `{ entry: SupabaseSharedMediaEntry }` (also accepts raw entry).
- **Response:** `{ ok: true, data: { id, created_at } }` or `{ error }` with 4xx/5xx.
- **Side effects:** Inserts into `public.personalization_outputs` after `supabase.rpc('set_config', { setting: 'app.clerk_user_id', value: userId, is_local: true })` for RLS.

### 4.2 `POST /api/proxy/openai-enhance`
- **Auth:** Clerk + entitlement `SMARTVIDEO_GO`; server-resolves OpenAI key via `getOpenAiKeyForUser()`.
- **Body:** `{ prompt?, mode?, messages? }`.
- **Upstream:** `POST ${SUPABASE_URL}/functions/v1/enhance-prompt` with `x-openai-key` header; falls back to `/.netlify/functions/enhance-prompt`.
- **Response:** passthrough JSON from upstream (60s timeout).

### 4.3 `POST /api/proxy/openai-image`
- **Auth:** Clerk + `SMARTVIDEO_GO`; server-resolves OpenAI key.
- **Body:** JSON `{ model, prompt, n?, quality, output_format?, ... }` OR multipart (`image[]`, `mask?`).
- **Upstream:** `POST https://api.openai.com/v1/images/{edits|generations}` (auto-detected from content-type; JSON body may override `_endpoint`).
- **Response:** JSON or `text/event-stream` passthrough (120s timeout).

### 4.4 MuAPI direct (browser proxied to `/api/...`)
`BASE_URL/api/v1/{model.endpoint}` (e.g. `gpt-image-2-image-to-image`, `add-image-watermark`, `add-video-watermark`, `ai-video-face-swap`, `kling-v3.0-pro-motion-control`, `veo-4-text-to-video`). Header `x-api-key:<muapi_key>`. Returns `{ request_id }` → poll until `outputs[0].url`.

## 5. Verified Provider Contracts (from SA-old-4)

### 5.1 MuAPI File Upload (https://muapi.ai/docs/file-upload)
- **Base URL:** `https://api.muapi.ai`
- **Endpoint:** `POST /api/v1/upload_file`
- **Method:** POST
- **Auth header:** `x-api-key: <KEY>` (no Bearer prefix)
- **Content-Type:** `multipart/form-data`
- **Body field:** `file` (single file part)
- **Limits:** Images 10 MB (`.jpg`, `.png`, `.webp`); Videos 50 MB (`.mp4`, `.mov`); Other 10 MB (`.zip`, `.pdf`, `.json`)
- **Response:** `{ "url": "https://s3.amazonaws.com/muapi-assets/outputs/..." }` — **TEMPORARY** (presigned S3 URL, expires 1 hour)
- **Cost:** Free, but credit balance must be `> 0`

### 5.2 OpenAI Responses API
- **Endpoint:** `POST https://api.openai.com/v1/responses`
- **Tool `image_generation`:** `{ "type": "image_generation", "model": "<gpt-image-...>", "action": "auto"|"generate"|"edit", "partial_images"?: 0-3 }`
- **Image inputs:** `type: "input_image"` with `file_id` or `image_url` (data: base64 OK)
- **Streaming:** SSE; events `response.image_generation_call.partial_image`, `response.completed`

### 5.3 OpenAI Image Edits (`/v1/images/edits`)
- Default model: `gpt-image-2.5-sunburst` (also `gpt-image-2.5-flare`, `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`)
- Up to 16 input images; accepts `images: [{file_id|image_url}]`, `prompt`, `mask?`
- Streaming: `image_edit.partial_image`, `image_edit.completed`

## 6. Model IDs (exact strings used by OpenHiggsBolt)

| Purpose | ID | Endpoint | Provider |
|---|---|---|---|
| Default I2I (Person/Logo/Product/Brand editing) | `gpt-image-2-edit` | `gpt-image-2-image-to-image` | openai |
| Alt I2I | `gpt-image-1.5-edit` | `gpt-image-1.5-edit` | openai |
| Alt T2I | `gpt-image-2` | `gpt-image-2-text-to-image` | openai |
| Face swap | `ai-video-face-swap` | `ai-video-face-swap` | muapi |
| Full body / person replacement | `kling-v3.0-pro-recast` | `kling-v3.0-pro-motion-control` | muapi |
| Default text-to-video | `veo-4-text-to-video` | `veo-4-text-to-video` | — |
| Image logo overlay | `add-image-watermark` | `add-image-watermark` | muapi |
| Video logo overlay | `add-video-watermark` | `add-video-watermark` | muapi |
| Asset library tools (catalog) | `ai-image-upscaler`, `ai-image-face-swap`, `ai-dress-change`, `ai-background-remover`, `ai-image-extension`, `ai-product-shot`, `ai-skin-enhancer`, `ai-color-photo`, `flux-kontext-dev-i2i`, `nano-banana`, `flux-dev` | (each) | muapi / google |
| Prompt rewrite | (server-side `gpt-4o` via `enhance-prompt` Edge Function) | `POST /v1/responses` | openai |

**NOTE on drift:** the `fix/personalization-i2i-model-and-test-alias` branch (HEAD `38e15f94`) renamed/aliased the I2I model ID; the drift register is in `docs/personalization-verify-muapi-drift.md` on the source side. Re-verify each ID before port.

## 7. Port Manifest

Target convention: `src/` paths inside `/Users/shasheemoore/Downloads/remix-new-editor/`.

| Source file (OpenHiggsBolt) | Suggested target (remix-new-editor) | Notes |
|---|---|---|
| `src/shared/personalization/types.ts` | `src/components/personalize/types.ts` | Source of truth — keep all 12 `AssetRole` values |
| `src/shared/personalization/clientProfile.ts` | `src/components/personalize/clientProfileStore.js` | localStorage CRUD. Consider migrating to zustand `persist` middleware |
| `src/shared/personalization/sharedMedia.ts` | `src/components/personalize/sharedMediaStore.js` | localStorage history of generated outputs |
| `src/shared/personalization/supabaseSharedMedia.ts` | `src/components/personalize/supabaseSharedMedia.js` | Mirrors `sharedMedia` to `/api/personalization/record` |
| `src/shared/personalization/index.ts` | `src/components/personalize/index.js` | Re-export barrel |
| `src/shared/personalization/sourceNormalizer.ts` | `src/components/personalize/sourceNormalizer.js` | Pure mapping; keep as-is |
| `src/shared/personalization/modelCapabilityResolver.ts` | `src/components/personalize/modelCapabilityResolver.js` | Update import path to new models catalog |
| `src/shared/personalization/generationRouter.ts` | `src/components/personalize/generationRouter.js` | Routes to MuAPI; switch base to `muapiService` |
| `src/shared/personalization/promptPersonalizer.ts` | `src/components/personalize/promptPersonalizer.js` | Replace import path: `@/shared/api/openai` → local OpenAI client |
| `src/shared/personalization/postProcessor.ts` | `src/components/personalize/postProcessor.js` | Canvas end-card + MuAPI watermark |
| `src/shared/personalization/PersonalizationModal.tsx` | `src/components/personalize/PersonalizationModal.tsx` | 1745 LOC; split into sub-components (`AssetGrid.tsx`, `ClientProfileForm.tsx`, `ModeSelector.tsx`) |
| `src/shared/personalization/DemoPersonalizeProvider.tsx` | `src/components/personalize/PersonalizeProvider.jsx` | Convert from React Context to **zustand** store to match modern idiom |
| `app/personalization-demo/page.tsx` | `src/pages/personalization-demo/page.tsx` (or equivalent) | Demo shell |
| `app/api/personalization/record/route.ts` | `src/app/api/personalization/record/route.ts` (Next-style) or `src/server/routes/personalizationRecord.ts` | Verify Clerk + Supabase `set_config` RLS pattern matches remix-new-editor auth |
| `supabase/migrations/20260905000000_create_personalization_outputs.sql` | `supabase/migrations/<ts>_create_personalization_outputs.sql` | Re-apply verbatim |
| `app/api/proxy/openai-enhance/route.ts` | keep existing or port | Prompt-rewrite proxy |
| `app/api/proxy/openai-image/route.ts` | keep existing or port | Direct OpenAI image edits (multipart `images/edits`) |
| `src/shared/api/openai.ts` | `src/shared/api/openai.ts` | Used by promptPersonalizer |
| `src/shared/api/openaiImage.ts` | `src/shared/api/openaiImage.ts` | Direct OpenAI image edit client |
| `src/lib/supabase.ts` | `src/lib/supabase.ts` | Contains `mirrorUrlToStorage` using bucket `brand-assets` |
| `packages/studio/src/muapi.js` | `src/lib/muapi.js` | Upload + I2I/I2V/V2V/Recast client (3000+ LOC) |
| `packages/studio/src/models.js` | `src/lib/models.js` | Full model catalog |
| `src/shared/personalization/__tests__/*.test.tsx` | `src/components/personalize/__tests__/*.test.tsx` | 1480 LOC of vitest; re-host under new paths |
| `e2e/personalization-*.spec.ts` | `e2e/personalization-*.spec.ts` | Playwright |
| `components/landing/PersonalizedHeroHeading.js` | `src/components/landing/PersonalizedHeroHeading.jsx` | Landing CTA trigger |
| `docs/personalization-manual-smoke-test.md` | `docs/personalization-manual-smoke-test.md` | QA doc |
| `docs/personalization-verify-muapi-drift.md` | `docs/personalization-verify-muapi-drift.md` | Drift register |
| **GREENFIELD** | `src/components/personalize/discovery/` (new) | **Website discovery** — sitemap, Cheerio, Crawlee, headless fallback, SSRF/private-IP/DNS-rebinding/invalid-media/dup/social-domain/junk guards, async job+status |

## 8. Risks

1. **MuAPI model ID drift.** `gpt-image-2-edit` was renamed/aliased on `fix/personalization-i2i-model-and-test-alias` (commit `62b5dfeb`). Re-verify each ID against `muapi.ai/api/v1/models` before port.
2. **OpenAI model drift.** `callOpenAIResponses` hardcodes `gpt-4o` (`src/shared/api/openai.ts:139`). Update to current model.
3. **Auth surface change.** OpenHiggsBolt uses Clerk + Supabase `set_config('app.clerk_user_id', ...)` RLS pattern. remix-new-editor has its own auth — confirm equivalent pattern; `personalization_outputs` RLS policies must be re-implemented or the table will be locked to zero rows.
4. **Upload bucket not in spec.** `brand-assets` is a Supabase bucket assumed pre-provisioned with public-read RLS. Not in the repo's migrations — must be created in remix-new-editor.
5. **Security hole — `x-api-key` in browser.** OpenHiggsBolt sends MuAPI key from the client (`muapi.js:317` XHR with `x-api-key`). The browser path is proxied through `/api/*` but server-side proxies still pass the user-supplied MuAPI key. **MUST be server-managed only in remix-new-editor.**
6. **Security hole — no URL validation on pasted image URLs.** `handleIdentityUrl`/`handleLogoUrl` etc. accept arbitrary user URLs with no SSRF/private-IP check. If website discovery is built, apply the same guards to discovery as well.
7. **Breaking change — localStorage keys.** Existing OpenHiggsBolt users have `smartvideo_clients`, `smartvideo_current_client_id`, `smartvideo_shared_media` in localStorage. The remix-new-editor token schema (`src/components/personalize/tokenSchema.js`) uses camelCase keys (`{{firstName}}`) — different from OpenHiggsBolt's `ClientProfile`. Provide a one-time migration or document incompatibility.
8. **State management mismatch.** OpenHiggsBolt uses React Context. remix-new-editor idiom is zustand (`src/stores/`). The port should rewrite to zustand.
9. **Component monolith.** `PersonalizationModal.tsx` is 1745 LOC containing UI + business logic + drag-drop + validation. Plan to split into `ClientProfileForm`, `AssetGrid`, `PromptEditor`, `ModeSelector`, `OutputPanel` before port.
10. **No website discovery.** This is the largest gap. Greenfield implementation required: sitemap parsing, Crawlee, Cheerio, headless browser fallback, SSRF guards, async job+status workflow, all protections (private network, DNS rebinding, invalid media, duplicates, social domains, junk files).

## 9. Test Inventory (verbatim)

| Path | LOC | Coverage |
|---|---|---|
| `src/shared/personalization/__tests__/DemoPersonalizeProvider.test.tsx` | 876 | Provider state, identity/logo CRUD, primary setters, generation lifecycle |
| `src/shared/personalization/__tests__/PersonalizationModal.test.tsx` | 217 | Modal render, upload flow, mode selection, "Who Is This For" |
| `src/shared/personalization/__tests__/modelCapabilityResolver.test.ts` | 207 | `resolveModelCapabilities`, `resolveAssetsForModel` (face swap, recast, first/last frame routing) |
| `src/shared/personalization/__tests__/postProcessor.test.ts` | 180 | `applyPostProcessing` (image logo watermark, end-card canvas, MuAPI calls) |
| `e2e/personalization-demo.spec.ts` | ~50 | Demo page renders, missing-API-key state |
| `e2e/personalization-debug.spec.ts` | ~80 | Live modal open assertions on `/personalization-demo` |
| `e2e/personalization-live.spec.ts` | ~150 | Mock MuAPI + OpenAI routes, end-to-end click flow |
| `tests/crossStudio.test.ts` | 280 | Cross-studio handoff payload to/from localStorage |
