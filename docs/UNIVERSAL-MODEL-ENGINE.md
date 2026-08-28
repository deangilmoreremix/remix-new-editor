# SmartVideo Universal Model Engine — Deliverables

## Architecture Summary

The SmartVideo Universal Model Engine (UME) is a provider-agnostic architecture that allows SmartVideo to dynamically support hundreds of MuAPI models without hard-coded UI forms or per-model integrations.

### Data Flow

```
MuAPI
   ↓
MuAPI Provider Adapter
   ↓
SmartVideo Model Registry
   ↓
Schema Normalizer
   ↓
Canonical SmartVideo Fields
   ↓
Dynamic Model Form Engine
   ↓
Validation
   ↓
Cost Estimation
   ↓
Generation Gateway
   ↓
Job Polling
   ↓
Output Normalization
   ↓
SmartVideo Library
```

## Files Created

### Core Types
- `src/types/ai/index.ts` — Provider-independent type system

### Adapter Layer
- `src/lib/ai/MuapiAdapter.ts` — MuAPI provider adapter implementing `AIProviderAdapter`

### Registry & Sync
- `src/lib/ai/ModelRegistry.ts` — Supabase-backed model registry with caching
- `src/lib/ai/CatalogSync.ts` — Server-side catalog synchronization

### Schema Normalization
- `src/lib/ai/FieldAliases.ts` — Field alias dictionary (provider → canonical)
- `src/lib/ai/FieldTypeInference.ts` — SmartFieldType inference from JSON Schema
- `src/lib/ai/SchemaNormalizer.ts` — MuAPI schema → SmartField[] converter

### Pricing & Generation
- `src/lib/ai/PricingEngine.ts` — Credit cost calculation with markup rules
- `src/lib/ai/GenerationGateway.ts` — Universal generation gateway with auth, validation, credit checks

### Dynamic Form Components
- `src/components/ai/DynamicModelForm.tsx` — Auto-rendering form based on SmartField[]
- `src/components/ai/PromptComposer.tsx` — Enhanced prompt input
- `src/components/ai/AspectRatioPicker.tsx` — Visual aspect ratio selector
- `src/components/ai/ResolutionPicker.tsx` — Visual resolution selector
- `src/components/ai/DurationPicker.tsx` — Visual duration selector
- `src/components/ai/MediaImagePicker.tsx` — Image upload/library picker
- `src/components/ai/MultiImagePicker.tsx` — Multi-image picker
- `src/components/ai/MediaVideoPicker.tsx` — Video upload picker
- `src/components/ai/MediaAudioPicker.tsx` — Audio upload picker
- `src/components/ai/FirstFramePicker.tsx` — First frame image picker
- `src/components/ai/LastFramePicker.tsx` — Last frame image picker
- `src/components/ai/SliderField.tsx` — Numeric slider
- `src/components/ai/SelectField.tsx` — Dropdown select
- `src/components/ai/ChipSelector.tsx` — Chip-based multi-select
- `src/components/ai/ToggleField.tsx` — Toggle switch
- `src/components/ai/NumberField.tsx` — Numeric input
- `src/components/ai/TextField.tsx` — Text input
- `src/components/ai/TextAreaField.tsx` — Multi-line text input
- `src/components/ai/SeedControl.tsx` — Seed input with randomize
- `src/components/ai/LoRASelector.tsx` — LoRA model selector
- `src/components/ai/CameraMotionSelector.tsx` — Camera motion selector
- `src/components/ai/StrengthSlider.tsx` — Strength/guidance slider
- `src/components/ai/OutputFormatSelector.tsx` — Output format selector

### Reusable Components
- `src/components/ai/ModelGenerator.tsx` — Studio-agnostic model generation component
- `src/hooks/ai/useModelRegistry.ts` — React hook for model registry
- `src/hooks/ai/useModelGenerator.ts` — React hook for model generation

### Admin Interface
- `src/pages/admin/AdminModelRegistry.tsx` — Model registry admin page

### API Endpoints
- `api/generate.ts` — Universal generation endpoint
- `api/model-registry.ts` — Model registry API

### Edge Functions
- `supabase/functions/sync-muapi-models/index.ts` — Server-side catalog sync

### Database Migrations
- `supabase/migrations/20260828000000_create_universal_model_engine.sql` — New tables:
  - `ai_models` — Universal model registry
  - `model_ui_overrides` — Per-model UI customization
  - `model_pricing_rules` — Per-model pricing markup
  - `generation_jobs` — Universal generation job tracking

### Tests
- `src/lib/__tests__/ai/universal-model-engine.test.ts` — 37 passing tests

## Files Modified

- `src/App.tsx` — Added admin model registry route and import
- `src/pages/admin/AdminLayout.tsx` — Added Model Registry nav link
- `vite.config.ts` — Added `/api/generate` and `/api/model-registry` dev middleware

## Database Migrations

Run the new migration:
```bash
supabase migration up
```

Or apply directly via Supabase Dashboard SQL editor.

## Environment Variables Required

| Variable | Purpose | Required |
|----------|---------|----------|
| `MUAPI_API_KEY` | MuAPI API key for proxy/catalog sync | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role for server ops | Yes |

## MuAPI Endpoints Integrated

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/models` | GET | Catalog discovery |
| `/api/v1/models/{name}` | GET | Per-model schema retrieval |
| `/api/v1/{endpoint}` | POST | Generation submission |
| `/api/v1/predictions/{id}/result` | GET | Result polling |

## Supported Canonical Field Types

| SmartFieldType | UI Component | Description |
|---------------|-------------|-------------|
| `prompt` | PromptComposer | Main prompt text |
| `textarea` | TextAreaField | Multi-line text (negative prompts) |
| `text` | TextField | Single-line text |
| `number` | NumberField | Numeric input |
| `slider` | SliderField | Range slider |
| `select` | SelectField | Dropdown |
| `chips` | ChipSelector | Multi-select chips |
| `toggle` | ToggleField | Boolean toggle |
| `image` | MediaImagePicker | Single image upload/picker |
| `images` | MultiImagePicker | Multiple image upload/picker |
| `video` | MediaVideoPicker | Video upload picker |
| `audio` | MediaAudioPicker | Audio upload picker |
| `aspect-ratio` | AspectRatioPicker | Visual ratio selector |
| `resolution` | ResolutionPicker | Visual resolution selector |
| `duration` | DurationPicker | Visual duration selector |
| `seed` | SeedControl | Seed with randomize |
| `lora` | LoRASelector | LoRA model selector |
| `camera-motion` | CameraMotionSelector | Camera motion dropdown |
| `first-frame` | FirstFramePicker | First frame image picker |
| `last-frame` | LastFramePicker | Last frame image picker |
| `strength` | StrengthSlider | Strength/guidance slider |
| `output-format` | OutputFormatSelector | Format selector |

## Studio Mappings

Models are automatically mapped to studios based on:
- `category` (e.g., "Text to Video" → `video`, `cinema`)
- `family` (e.g., "image" → `image`)
- `group_of` (e.g., "avatar" → `avatar`, `character`)

Manual overrides available via admin panel.

## Admin Workflow

1. Admin navigates to `/admin/model-registry`
2. Clicks "Sync MuAPI Catalog"
3. New models appear with `enabled: false`
4. Admin can:
   - Preview generated form
   - Enable/disable models
   - Set featured/recommended flags
   - Manage studio mappings
5. Enabled models appear in studio model selectors

## Cost-Estimation Flow

1. User selects model → schema loads
2. User adjusts parameters → cost estimate updates (debounced 300ms)
3. Frontend calls `MuapiAdapter.estimateCost()`
4. If dynamic pricing, calls MuAPI estimate endpoint
5. `PricingEngine` applies markup rules
6. Displayed as: `{credits} credits (Provider: ${providerCost})`

## Generation Flow

1. Frontend submits to `/api/generate`
2. Backend validates auth, model enabled, inputs
3. `GenerationGateway` translates canonical → provider fields
4. Estimates cost, checks credits, reserves credits
5. Submits to MuAPI via adapter
6. Stores job in `generation_jobs`
7. Returns `requestId`
8. Frontend polls `GenerationGateway.pollResult()`
9. On completion, saves outputs to `assets` and `generation_history`

## Testing Results

**37 tests passing** covering:
- Field alias resolution
- Field type inference (22 scenarios)
- Schema normalization (5 scenarios)
- Acceptance criteria (Tests A–G)
- Pricing engine architecture

## Remaining Edge Cases

1. **Complex nested schemas**: Current normalizer handles flat JSON Schema objects. Nested `allOf`/`oneOf` compositions need additional logic.
2. **Array of objects**: Multi-image uploads work for URL arrays, but structured object arrays (e.g., `[{url, weight}]`) need custom renderers.
3. **Conditional schemas**: JSON Schema `if/then/else` is not yet parsed into `visibleWhen` conditions.
4. **Streaming outputs**: Real-time progress updates for long-running generations need WebSocket or SSE.
5. **Provider fallback**: If MuAPI is down, there's no automatic failover to cached schemas or alternative providers.
6. **Schema versioning**: Model schemas can change; version tracking and migration logic is not implemented.
7. **Large catalogs**: With 600+ models, pagination and virtual scrolling may be needed in admin and model selectors.
8. **Credit refunds**: Failed generations should refund reserved credits atomically.

## MuAPI Schemas That Could Not Be Normalized Generically

- **Custom LoRA weight sliders**: Some models accept per-LoRA weight parameters that aren't in the standard schema.
- **Regional restrictions**: Some models have geo-based availability not expressed in the schema.
- **Rate limit fields**: Models may expose `rate_limit_rpm` which isn't a user input.

## Recommendations for Next Phase

1. **Add more provider adapters**: Implement `OpenAIAdapter`, `GoogleAdapter`, `FalAdapter` using the same interface.
2. **Add schema caching**: Cache fetched schemas in Redis/Upstash with TTL for faster loads.
3. **Add schema versioning**: Track schema changes per model to detect breaking API changes.
4. **Add WebSocket polling**: Replace HTTP polling with WebSocket for real-time generation updates.
5. **Add credit refund on failure**: Automatically refund credits when generation fails.
6. **Add model comparison**: Allow side-by-side comparison of 2-3 models with same inputs.
7. **Add batch generation**: Submit same prompt to multiple models simultaneously.
8. **Add A/B testing**: Randomly route users to different models for quality comparison.
9. **Add model health monitoring**: Track latency, success rate, and cost per model.
10. **Add prompt templates**: Pre-built prompts optimized per model.
